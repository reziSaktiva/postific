# Background Jobs & Scheduler

Dokumen ini mendefinisikan **Background Jobs & Scheduler Architecture** untuk produk **Postific** — strategi eksekusi pekerjaan asinkron yang mencakup scheduling konten, retry mekanisme, sinkronisasi engagement, sinkronisasi analytics, dan penanganan job yang gagal.

Dokumen ini menjadi acuan desain background job dan tidak mencakup implementasi kode. Detail implementasi (library, konfigurasi cron expression) didokumentasikan di Engineering Planning (M6).

---

# Tujuan

* Mendefinisikan tipe-tipe background job yang dibutuhkan dalam sistem.
* Menetapkan arsitektur job queue berbasis PostgreSQL.
* Mendefinisikan mekanisme retry dan penanganan job yang gagal.
* Menetapkan strategi scheduling untuk periodic sync jobs.
* Mendokumentasikan integrasi background job dengan domain yang membutuhkannya.

---

# Keputusan Pra-Architecture

Keputusan berikut sudah ditetapkan sebelum dokumen ini dibuat dan menjadi fondasi Background Jobs Architecture:

| Topik | Keputusan | Sumber |
|-------|-----------|--------|
| Database Platform | Supabase PostgreSQL Cloud | Keputusan pra-architecture |
| Deployment | Railway | Keputusan pra-architecture |
| Social Media Integration | Outstand API (webhook untuk status post) | ADR-005 |
| Webhook Handling | Verifikasi raw-body HMAC → durable receipt idempoten → ACK 2xx → proses internal | ADR-020, ADR-040 |
| Schema Organization | Single schema `public` dengan domain prefix | ADR-014 |

---

# Overview Tipe Job

Sistem membutuhkan dua kategori background job:

| Kategori | Trigger | Contoh |
|----------|---------|--------|
| **Event-driven** | Dipicu oleh event domain tertentu | Pemrosesan receipt webhook, notifikasi publish |
| **Periodic** | Dijadwalkan berulang pada interval tetap | Sinkronisasi engagement, sinkronisasi analytics |

---

# Arsitektur Job Queue

## Pendekatan: PostgreSQL Job Queue + Railway Cron

Sistem menggunakan **PostgreSQL-backed job queue** dengan tabel `background_jobs` sebagai sumber kebenaran status job. Eksekusi job dipicu oleh:

1. **Railway Cron** — memanggil Route Handler `/api/jobs/run` pada interval tertentu (setiap menit untuk event-driven jobs dan setiap 30 menit untuk JOB-03 Engagement sync; Analytics memiliki jadwal harian tersendiri).
2. **Ingestion/Application Service** — menulis job baru ke tabel `background_jobs` saat ada receipt webhook baru atau operasi async lain.

```
┌──────────────────────────────────────────────────────────────────┐
│                    JOB LIFECYCLE                                  │
│                                                                   │
│  Domain Event / Cron Trigger                                      │
│         │                                                         │
│         ▼                                                         │
│  background_jobs table                                            │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  id · type · payload · status · scheduled_at             │     │
│  │  attempts · max_attempts · last_error · created_at       │     │
│  └──────────────────────────────┬──────────────────────────┘     │
│                                  │                                 │
│                  Railway Cron ───► POST /api/jobs/run              │
│                                  │  (JobRunner Route Handler)      │
│                                  │                                 │
│                                  ▼                                 │
│                         Pick next pending job                      │
│                         Execute job handler                        │
│                         Update status (done / failed / retry)      │
└──────────────────────────────────────────────────────────────────┘
```

## Tabel `background_jobs`

```
background_jobs
├── id                UUID PK
├── type              TEXT        -- tipe job (lihat Job Type Registry)
├── payload           JSONB       -- data yang dibutuhkan job handler
├── status            TEXT        -- pending | running | done | failed
├── scheduled_at      TIMESTAMPTZ -- waktu job boleh dieksekusi (untuk delay/retry)
├── started_at        TIMESTAMPTZ
├── completed_at      TIMESTAMPTZ
├── attempts          INT DEFAULT 0
├── max_attempts      INT DEFAULT 3
├── last_error        TEXT
└── created_at        TIMESTAMPTZ DEFAULT now()
```

**Status transitions:**

```
pending → running → done
                 → failed (attempts < max_attempts → scheduled_at updated → pending)
                 → failed (attempts >= max_attempts → status = failed, tidak retry)
```

## JobRunner Route Handler

`POST /api/jobs/run` adalah endpoint internal yang hanya dipanggil oleh Railway Cron.

**Keamanan:**
- Request harus menyertakan secret header `X-Job-Secret` yang dicocokkan dengan environment variable.
- Request dari luar (bukan Railway Cron) ditolak dengan `401 Unauthorized`.

**Eksekusi:**
1. Route Handler mengambil batch job dengan `status = pending` dan `scheduled_at <= now()`.
2. Tiap job dieksekusi oleh handler yang sesuai berdasarkan `type`.
3. Status diperbarui setelah eksekusi selesai.
4. Maksimum **10 job per run** untuk mencegah timeout Railway.

---

# Job Type Registry

## JOB-01 — Internal Webhook Processing

**Trigger:** Receipt baru berhasil dipersistenkan ke `outstand_webhook_events`, atau percobaan pemrosesan internal sebelumnya gagal.

**Tipe:** `outstand.webhook.process`

**Payload:**
```
{
  "webhookEventId": "uuid"
}
```

**Handler:** Memuat raw payload receipt yang sudah lolos HMAC dari `outstand_webhook_events`, menandai `processing`, lalu memanggil `WebhookProcessor`. Event resmi MVP: `post.published`, `post.error`, `account.token_expired`. ACL memetakan `post.error` → status domain `failed`, serta `account.token_expired` → status akun `error`/reconnect.

**Retry:** Maksimal 3 kali. Interval: 5 menit, 15 menit, 60 menit (exponential backoff).

**On permanent failure:** Catat di log, tandai receipt `dead_lettered`, kirim notifikasi internal (jika ada monitoring).

**Boundary retry:** Retry delivery oleh Outstand hanya terjadi jika ingestion tidak berhasil durable/ACK. Setelah ACK `2xx`, semua retry adalah mekanisme internal JOB-01 dan tidak bergantung pada delivery ulang vendor.

---

## JOB-02 — Post Status Notification

**Trigger:** JOB-01 menyelesaikan `post.published` atau memetakan `post.error` ke status domain `failed`.

**Tipe:** `notification.post_status`

**Payload:**
```
{
  "postId": "uuid",
  "postTargetId": "uuid",
  "workspaceId": "uuid",
  "userId": "uuid",        -- pemilik post
  "eventType": "published | failed",
  "platform": "instagram | facebook | ..."
}
```

**Handler:** Memanggil `NotificationService.createPostStatusNotification(payload)`.

**Retry:** Maksimal 3 kali. Interval: 1 menit, 5 menit, 15 menit.

---

## JOB-03 — Engagement Sync

**Trigger:** Railway Cron (periodik, setiap 30 menit).

**Tipe:** `engagement.sync`

**Payload:**
```
{
  "workspaceId": "uuid",
  "connectedAccountId": "uuid",
  "outstandAccountId": "string"
}
```

**Handler:**
1. Memanggil `OutstandAdapter.fetchComments(outstandAccountId, cursor?)`.
2. Membandingkan dengan data yang sudah ada di tabel `engagement_inbox_items`.
3. Menyimpan/upsert komentar baru melalui `EngagementService`.
4. Memanggil `NotificationService.notify(workspaceId, { type: 'engagement_new', ... })` dari hasil sync. Hanya mengirim satu notifikasi aggregate jika banyak komentar baru ditemukan.

**Retry:** Maksimal 2 kali. Interval: 10 menit.

**Catatan:** JOB-03 adalah sumber utama Engagement MVP dan dibuat per `ConnectedAccount` yang `active`. Manual refresh memicu handler sync yang sama secara on-demand. Tidak ada webhook komentar, DM, atau mention; scope hanya comments/replies.

---

## JOB-04 — Analytics Sync

**Trigger:** Railway Cron (periodik, setiap 24 jam — tengah malam UTC).

**Tipe:** `analytics.sync`

**Payload:**
```
{
  "workspaceId": "uuid",
  "connectedAccountId": "uuid",
  "outstandAccountId": "string",
  "period": "last_7_days | last_30_days"
}
```

**Handler:**
1. Memanggil `OutstandAdapter.fetchWorkspaceMetrics(outstandAccountId, period)`.
2. Memanggil `OutstandAdapter.fetchPostMetrics(outstandPostId)` per post yang belum memiliki snapshot (amandemen ADR-092, rename dari `outstandJobId` — sekarang ID post-level yang mencakup semua target).
3. Menyimpan snapshot melalui `AnalyticsService`.

**Retry:** Maksimal 2 kali. Interval: 30 menit.

---

## JOB-07 — Resolve Scheduled Post Outcome

**Trigger:** `SchedulePostsUseCase` meng-enqueue job ini saat sebuah post
terjadwal (`Scheduled`) sudah melewati `scheduledAt` (due) — bukan dibuat
langsung oleh Railway Cron, melainkan oleh domain publishing sendiri;
Railway Cron memicu `/api/jobs/run` yang mengklaim & mengeksekusi job
generik apa pun yang sudah due, termasuk tipe ini (T-027, nomor JOB-07
dipakai karena JOB-05/JOB-06 sudah direservasi ADR-093 untuk Import Posts,
belum diimplementasikan saat entry ini ditulis).

**Tipe:** `publishing.scheduled_post.resolve_outcome`

**Payload:**
```
{
  "outstandPostId": "string"
}
```

**Handler:** `ResolveScheduledPostOutcomeJobHandler` memanggil
`OutstandAdapter.fetchPostOutcome(outstandPostId, expectedOutstandAccountIds)`
(ADR-108) lalu reuse `OutstandWebhookProcessor.resolvePostOutcome` — method
yang sama dipakai JOB-01/webhook T-026 — untuk resolve status per target
(`PublishingPostTarget`) dan mengagregasi status level-post
(`PublishingPost.status` → `Published`/`Failed`, ADR-109).

**Retry:** Mengikuti retry generik job runner (lihat § Retry Strategy di
bawah — 5m/15m/60m), bukan retry khusus terpisah.

---

# Retry Strategy

## Exponential Backoff

Retry delay dihitung berdasarkan jumlah `attempts`:

| Attempt | Delay |
|---------|-------|
| 1 (first retry) | 5 menit |
| 2 | 15 menit |
| 3 | 60 menit |

Delay dari tabel eksplisit (lookup, bukan formula) — tidak mengikuti rasio
pangkat dua yang konsisten (5→15 adalah ×3, 15→60 adalah ×4). Diimplementasikan
sebagai array `RETRY_DELAY_MINUTES = [5, 15, 60]` di
`apps/web/src/lib/jobs/backoff.ts` (T-027.3, KI-062).

## Dead Letter

Job yang mencapai `max_attempts` tanpa sukses diubah statusnya ke `failed` dan tidak akan dieksekusi ulang secara otomatis. Dead letter jobs dicatat dan dapat diinspeksi untuk debugging.

**Untuk MVP:** Dead letter hanya dicatat di tabel `background_jobs` dengan `status = failed`. Tidak ada alerting otomatis — monitoring dilakukan secara manual via Railway dashboard atau query ke tabel.

---

# Integrasi dengan Domain

## Publishing BC → Background Job

```
PublishingService
  └── Webhook POST /api/webhooks/outstand
        └── Verify raw HMAC → persist outstand_webhook_events → ACK 2xx
              └── JOB-01 (internal processing)
                    ├── Sukses → update receipt + status domain → buat JOB-02
                    └── Gagal → retry internal; delivery Outstand tetap terpisah
```

## Workspace BC → Background Job

```
WorkspaceService
  └── ConnectedAccount created/activated
        └── JobScheduler.scheduleEngagementSync(connectedAccount)
              └── Buat JOB-03 (engagement sync, scheduled_at = sekarang + 30m)
```

## Cron Trigger → Background Job

```
Railway Cron (*/30 * * * *)
  └── POST /api/jobs/run
        └── JobRunner.runScheduledJobs()
              ├── Ambil semua ConnectedAccount active
              ├── Buat JOB-03 per ConnectedAccount (jika belum ada yang pending)
              └── Eksekusi job pending yang scheduled_at <= now()

Railway Cron (0 0 * * *)
  └── POST /api/jobs/run?type=analytics
        └── JobRunner.runAnalyticsSync()
              └── Buat JOB-04 per ConnectedAccount active
```

---

# Concurrency & Locking

Untuk mencegah race condition saat multiple Railway Cron worker mengeksekusi job yang sama:

**Pessimistic Locking via `SELECT FOR UPDATE SKIP LOCKED`:**

```sql
SELECT * FROM background_jobs
WHERE status = 'pending'
  AND scheduled_at <= now()
ORDER BY created_at
LIMIT 10
FOR UPDATE SKIP LOCKED;
```

`SKIP LOCKED` memastikan dua worker tidak mengambil job yang sama secara bersamaan.

Setelah diambil, status segera diubah ke `running` dalam satu transaksi sebelum eksekusi dimulai.

---

# Error Handling

| Skenario | Perilaku |
|----------|----------|
| Job handler throw error | Status → pending dengan delay (jika attempts < max_attempts) |
| Job timeout (>30 detik) | Status → pending, attempts + 1 |
| Database tidak tersedia | JobRunner gagal start, Railway Cron akan mencoba lagi di interval berikutnya |
| Outstand API down | Job handler gagal → retry via exponential backoff |
| Job handler permanent failure | Status → failed, dicatat di last_error |

---

# Monitoring (MVP)

Untuk MVP, monitoring dilakukan secara sederhana:

* Query ke tabel `background_jobs` untuk melihat job yang `status = failed`.
* Railway dashboard untuk melihat log cron execution.
* Error yang terjadi di job handler dicatat via `console.error` (Railway log stream).

Monitoring yang lebih advanced (alerting, dashboard) didokumentasikan di Engineering Planning (M6) dan diimplementasikan post-MVP.

---

# Decision Log

| ID | Keputusan | Alasan |
|----|-----------|--------|
| BG-D01 | PostgreSQL job queue via tabel `background_jobs` | Tidak perlu tambah infrastruktur baru — Supabase PostgreSQL sudah ada; sederhana dan reliable untuk MVP volume |
| BG-D02 | Railway Cron sebagai trigger eksekusi | Railway sudah digunakan sebagai deployment platform; built-in cron tidak perlu service tambahan |
| BG-D03 | `SELECT FOR UPDATE SKIP LOCKED` untuk concurrency | Native PostgreSQL feature — atomic, tidak perlu Redis atau distributed lock |
| BG-D04 | Exponential backoff: 5m, 15m, 60m | Pragmatis untuk MVP — memberi waktu yang cukup untuk Outstand recovery tanpa terlalu lama |
| BG-D05 | Max 10 job per run | Mencegah Railway timeout (max 30 detik per request) |
| BG-D06 | Dead letter = status `failed` di tabel | Cukup untuk MVP; tidak perlu queue terpisah |
| BG-D07 | JOB-01 memproses durable receipt internal (`outstand.webhook.process`) | Memisahkan retry delivery vendor dari retry pemrosesan internal |
| BG-D08 | JOB-03 adalah sumber utama comments/replies setiap 30 menit + manual refresh | Outstand tidak menyediakan webhook Engagement MVP |
| BG-D09 | ADR-040 | BG-D07–D08 mengamandemen semantik JOB-01 dan Engagement lama |

---

# Related Documents

* `domain-model.md` — bounded context yang membutuhkan background job (BC-03, BC-05, BC-06, BC-09)
* `integration-layer.md` — webhook handling dan retry yang memicu JOB-01
* `realtime-strategy.md` — notifikasi yang dibuat oleh JOB-02
* `database-strategy.md` — tabel `background_jobs` sebagai bagian dari schema
* `../../project-manager/DECISIONS.md` — ADR-022
