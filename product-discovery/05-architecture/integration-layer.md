# Integration Layer

Dokumen ini mendefinisikan **Integration Layer** untuk produk **Postific** — arsitektur integrasi dengan Outstand API sebagai social media integration provider, meliputi Anti-Corruption Layer, ConnectedAccount management, publishing flow, webhook handling, engagement sync, analytics sync, dan strategi error handling.

Dokumen ini menjadi acuan desain integrasi eksternal dan tidak mencakup implementasi kode. Detail implementasi (HTTP client, retry library, folder structure) didokumentasikan di Engineering Planning (M6).

---

# Tujuan

* Mendefinisikan posisi Outstand API dalam arsitektur sistem.
* Menetapkan Anti-Corruption Layer (ACL) sebagai batas antara domain internal dan sistem eksternal.
* Mendokumentasikan alur ConnectedAccount management via OAuth Outstand.
* Mendefinisikan alur publishing ke social media melalui Outstand API.
* Menetapkan pola webhook handling untuk event dari Outstand.
* Mendokumentasikan strategi sinkronisasi data engagement dan analytics.
* Mendefinisikan error handling strategy untuk kegagalan integrasi.

---

# Keputusan Pra-Architecture

Keputusan berikut sudah ditetapkan sebelum dokumen ini dibuat dan menjadi fondasi Integration Layer:

| Topik | Keputusan | Sumber |
|-------|-----------|--------|
| Social Media Integration Provider | Outstand API | ADR-005 |
| Entry Point untuk webhook | Route Handler | ADR-016 |
| Cross-domain communication | Service-to-service call via public module API | ADR-018 |

---

# Posisi Outstand dalam Arsitektur

Outstand API adalah **external system** — berada di luar batas domain internal. Seluruh interaksi dengan Outstand dilakukan secara eksklusif melalui **Anti-Corruption Layer** sehingga domain internal tidak pernah bergantung langsung pada struktur data atau kontrak API Outstand.

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTERNAL SYSTEM                               │
│                                                                  │
│  Publishing BC ──────────────────────────────►                  │
│  Workspace BC  ──────────────────────────────►                  │
│  Engagement BC ──────────────────────────────►  OutstandAdapter │
│  Analytics BC  ──────────────────────────────►  (ACL)           │
│                                                      │           │
└──────────────────────────────────────────────────────┼──────────┘
                                                        │
                                               Outstand HTTP API
                                                        │
┌──────────────────────────────────────────────────────┼──────────┐
│                    EXTERNAL SYSTEM                    │           │
│                                                       ▼           │
│  Instagram · Facebook · Twitter · LinkedIn · TikTok · YouTube    │
│                  · Threads · Pinterest                           │
└─────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEBHOOK FLOW (Inbound)                        │
│                                                                  │
│  Outstand ──► Route Handler `/api/webhooks/outstand`             │
│                   └──► WebhookProcessor                          │
│                             └──► ApplicationService (domain)     │
└─────────────────────────────────────────────────────────────────┘
```

---

# Anti-Corruption Layer

## Prinsip

Anti-Corruption Layer (ACL) adalah layer terjemahan yang:

1. Mengisolasi domain internal dari perubahan breaking pada Outstand API.
2. Menerjemahkan konsep Outstand ke konsep domain internal (dan sebaliknya).
3. Menjadi satu-satunya titik yang mengetahui struktur data Outstand.

**Aturan ACL:**
- Domain internal **tidak boleh** mengimport tipe atau struktur data Outstand secara langsung.
- Seluruh response dari Outstand API diparse dan divalidasi di dalam `OutstandAdapter` sebelum dikembalikan ke domain.
- Jika Outstand mengubah response format, hanya `OutstandAdapter` yang perlu diperbarui — tidak ada perubahan di domain.

## OutstandAdapter

`OutstandAdapter` adalah modul khusus yang mengimplementasikan seluruh komunikasi dengan Outstand API.

**(ADR-079)** Contract `IOutstandAdapter` dipromosikan dari lokasi domain-only
(`domains/publishing/adapters/`) ke `packages/shared/src/contracts/` sebagai
**cross-domain shared contract** — awalnya dibangun untuk kebutuhan Publishing
(ADR-059), tapi Analytics BC (metric ingestion) juga butuh mengimplementasikan
method yang sama (`fetchPostMetrics`, `fetchWorkspaceMetrics`). File lokasi
lama di domain `publishing` dipertahankan sebagai re-export barrel. Ini
pengecualian baru pada aturan `packages/shared` (AGENTS.md rule 8): port/ACL
contract kini termasuk kategori yang boleh hidup di sana, selain shared types.

**(amandemen ADR-092)** `schedulePost`/`publishNow` menerima SEMUA target
sekaligus dalam satu call dan mengembalikan SATU `outstandPostId` — bukan
lagi satu call per akun. Status per akun (`platformPostId`,
`platformPostUrl`, `status`, dsb.) tidak tersedia sinkron dari call ini;
harus di-resolve belakangan lewat `fetchPostOutcome`.

```
OutstandAdapter (Anti-Corruption Layer)
  ├── connectAccount(params) → ConnectedAccountData
  ├── disconnectAccount(outstandAccountId) → void
  ├── requestMediaUpload(params) → OutstandUploadTarget
  ├── uploadMedia(uploadUrl, bytes, contentType) → void
  ├── confirmMediaUpload(uploadId) → OutstandMediaData
  ├── schedulePost(targets[], params) → { outstandPostId }
  │     // targets: seluruh akun tujuan post ini sekaligus (1 call, 1 post.id)
  │     // params mencakup: caption, outstandMediaUrls, scheduledAt,
  │     // contentFormat, platformOptions? — dipetakan ke override Outstand di ACL
  ├── publishNow(targets[], params) → { outstandPostId }
  ├── fetchPostOutcome(outstandPostId, expectedOutstandAccountIds[]) → PostTargetOutcome[]
  │     // wajib dipanggil untuk resolve status per akun (pending|published|failed);
  │     // tidak diasumsikan sinkron dari schedulePost/publishNow
  │     // (amandemen ADR-108) daftar akun target dikirim ulang eksplisit oleh
  │     // caller — adapter tidak boleh bergantung pada state hasil panggilan
  │     // schedulePost/publishNow sebelumnya (rusak lintas proses/module chunk
  │     // Server Action ↔ Route Handler yang terpisah, ditemukan T-027.5)
  ├── cancelScheduledPost(outstandPostId) → void
  ├── fetchComments(outstandAccountId, cursor?) → CommentPage
  ├── replyToComment(outstandCommentId, text) → ReplyResult
  ├── fetchPostMetrics(outstandPostId) → PostMetricsData
  └── fetchWorkspaceMetrics(outstandAccountId, period) → WorkspaceMetricsData
```

**Tanggung Jawab OutstandAdapter:**
- Menyusun HTTP request ke Outstand API (auth header, base URL, timeout).
- Memparse dan memvalidasi response Outstand.
- Menerjemahkan error Outstand ke `IntegrationError` yang dikenali domain.
- Menyembunyikan pagination, retry, dan detail protokol dari pemanggil.

**Bukan tanggung jawab OutstandAdapter:**
- Business logic (validasi otorisasi, domain rules).
- Persistensi data ke database.
- Notifikasi ke user.

---

# ConnectedAccount Management

## Alur Connect Account

Menghubungkan akun media sosial ke workspace dilakukan melalui OAuth flow yang dikelola oleh Outstand.

```
┌─────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌──────────────┐
│  User   │    │  Next.js Server  │    │  Outstand API   │    │ Social Media │
│ Browser │    │  (Route Handler) │    │                 │    │  Platform    │
└────┬────┘    └────────┬─────────┘    └────────┬────────┘    └──────┬───────┘
     │                  │                        │                    │
     │  Click "Connect" │                        │                    │
     │─────────────────►│                        │                    │
     │                  │  Request OAuth URL     │                    │
     │                  │───────────────────────►│                    │
     │                  │  Return OAuth URL      │                    │
     │                  │◄───────────────────────│                    │
     │  Redirect to     │                        │                    │
     │  Outstand OAuth  │                        │                    │
     │◄─────────────────│                        │                    │
     │                  │                        │  OAuth consent     │
     │──────────────────────────────────────────►│───────────────────►│
     │                  │                        │  OAuth callback    │
     │                  │                        │◄───────────────────│
     │  Redirect to     │                        │                    │
     │  /callback URL   │                        │                    │
     │─────────────────►│                        │                    │
     │                  │  Verify + get account  │                    │
     │                  │───────────────────────►│                    │
     │                  │  Return account data   │                    │
     │                  │◄───────────────────────│                    │
     │                  │  Create ConnectedAccount│                   │
     │                  │  (WorkspaceService)    │                    │
     │  Account connected│                       │                    │
     │◄─────────────────│                        │                    │
```

**Entry Point:** Route Handler di `/api/integrations/outstand/callback`

**Langkah-langkah:**
1. User klik "Connect Account" di Settings → Workspace Service meminta OAuth URL dari `OutstandAdapter`.
2. User diarahkan ke Outstand OAuth URL — Outstand menangani OAuth dengan platform.
3. Setelah consent, Outstand mengarahkan ke `/api/integrations/outstand/callback` dengan `code` dan `state`.
4. Route Handler memverifikasi `state` (CSRF protection) dan memanggil `WorkspaceService.completeAccountConnection(code)`.
5. `WorkspaceService` memanggil `OutstandAdapter.connectAccount(code)` untuk menukar code dengan data akun.
6. `WorkspaceService` membuat entitas `ConnectedAccount` dan menyimpan ke repository.

**Data yang disimpan pada `ConnectedAccount`:**
- `outstandAccountId` — ID dari Outstand (external reference permanen).
- `platform` — platform yang terhubung (`instagram`, `facebook`, dst.).
- `handle` — nama akun atau halaman.
- `status` — `active`.

**Catatan:**
- Access token OAuth **tidak disimpan** di database internal. Token dikelola sepenuhnya oleh Outstand.
- Revoke token dilakukan melalui Outstand API, bukan secara langsung ke platform.
- **Twitter/X tetap platform MVP dengan BYOK wajib.** Project Owner mengonfigurasi Client ID/Client Secret X secara manual di dashboard Outstand untuk setiap environment. Aplikasi hanya memakai akun yang sudah tersedia melalui Outstand dan **tidak menerima, menyimpan, atau meneruskan secret X**.

## Alur Disconnect Account

1. User memilih "Disconnect" di Settings.
2. `WorkspaceService` memanggil `OutstandAdapter.disconnectAccount(outstandAccountId)`.
3. `WorkspaceService` mengubah `ConnectedAccount.status` menjadi `disconnected`.
4. Post yang sudah dijadwalkan ke akun ini ditandai `failed` di Publishing BC.

---

# Publishing Flow

## Alur Jadwalkan Post ke Outstand

Publishing ke social media dilakukan melalui Outstand API — sistem internal tidak berinteraksi langsung dengan API platform social media.

**(amandemen ADR-092)** Diagram dan langkah di bawah merefleksikan model
1-call-semua-target: `schedulePost` dipanggil SEKALI untuk seluruh
`PostTarget` pada post yang sama, mengembalikan SATU `outstandPostId` di
level `Post`. Outcome per akun (`platformPostId`, `platformPostUrl`,
`status`) TIDAK dikembalikan sinkron oleh call ini — harus diresolve
belakangan lewat `OutstandAdapter.fetchPostOutcome(outstandPostId, expectedOutstandAccountIds)`
(amandemen ADR-108; webhook T-026 dan job T-027/JOB-07 sama-sama memakai
jalur ini sekarang).

```
┌──────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│  PublishingService│    │  OutstandAdapter (ACL)│    │  Outstand API   │
└────────┬─────────┘    └──────────┬───────────┘    └────────┬────────┘
         │                          │                          │
         │  schedulePost(targets[]) │                          │
         │─────────────────────────►│                          │
         │                          │  POST /v1/posts/         │
         │                          │  (accounts: [...])       │
         │                          │─────────────────────────►│
         │                          │  Return { post.id, ... } │
         │                          │◄─────────────────────────│
         │  Return { outstandPostId}│                          │
         │◄─────────────────────────│                          │
         │                          │                          │
         │  Save outstandPostId      │                          │
         │  on Post (bukan PostTarget)│                        │
         │                          │                          │
         │  fetchPostOutcome(...)   │                          │
         │  (async/polling, resolve │                          │
         │  status per PostTarget)  │                          │
```

**Trigger:** Status `Post` bertransisi ke `Scheduled` (setelah review approved atau user langsung schedule).

**Langkah-langkah:**
1. `PublishingService` memvalidasi bahwa semua `PostTarget` memiliki `ConnectedAccount` yang `active`.
2. `PublishingService` memvalidasi `contentFormat` tiap `PostTarget` terhadap matriks platform (ADR-039) serta kelengkapan media / `platformOptions` (mis. Pinterest pin).
3. Untuk setiap media original dari Supabase Storage, `PublishingService` meminta working copy melalui ACL: request upload URL Outstand → `PUT` bytes ke URL tersebut → confirm upload → terima URL media Outstand.
4. `PublishingService` memanggil `OutstandAdapter.schedulePost(targets[], params)` SEKALI untuk seluruh `PostTarget` pada post ini, dengan:
   - `outstandAccountId` tiap target dari `ConnectedAccount`-nya.
   - Caption, URL working copy media dari Outstand, dan waktu tayang.
   - `contentFormat` + `platformOptions` per target — diterjemahkan ACL ke override Outstand (Story/Reel/Pin, dll.).
5. Outstand mengembalikan SATU `post.id` untuk seluruh target (bukan job per akun).
6. `PublishingService` menyimpan `outstandPostId` pada `Post` (bukan `PostTarget`) dan mengubah `Post.status` ke `Scheduled`. `PostTarget.status` tetap `pending` sampai outcome per akun diresolve.
7. `PublishingService` memanggil `OutstandAdapter.fetchPostOutcome(outstandPostId, expectedOutstandAccountIds)` (amandemen ADR-108; segera untuk Publish Now, atau lewat webhook T-026/job T-027 JOB-07 untuk Schedule) untuk mengisi `platformPostId`/`platformPostUrl`/`status` per `PostTarget`.

**Catatan:**
- Media original tetap menjadi milik aplikasi di bucket private Supabase Storage. Signed URL Supabase hanya boleh dipakai untuk akses internal/UI, **bukan** sebagai URL publishing ke Outstand.
- URL/media ID working copy Outstand boleh disimpan sebagai metadata opsional untuk observability, reuse aman, atau cleanup; ia bukan source of truth aset original.
- **(amandemen ADR-092)** Karena `schedulePost` sekarang 1 call untuk semua target (all-or-nothing di level call), kegagalan call tersebut menandai SEMUA `PostTarget` pada post itu `failed` sekaligus — bukan lagi kegagalan independen per target. Partial success (sebagian akun gagal publish setelah call berhasil) baru diketahui belakangan lewat `fetchPostOutcome`/webhook, dan itu ditandai per `PostTarget` secara independen.
- **Content format (ADR-039):** Outstand memfasilitasi Post / Reel / Story (dan opsi platform lain seperti Pinterest board). Domain menyimpan `ContentFormat` per target; hanya `OutstandAdapter` yang mengetahui bentuk field API Outstand (mis. flag Story / routing Reel / metadata Pin).

## Alur Batalkan Post

1. User membatalkan jadwal dari UI → `PublishingService.cancelScheduledPost(postId)`.
2. **(amandemen ADR-092)** `PublishingService` memanggil `OutstandAdapter.cancelScheduledPost(outstandPostId)` SEKALI per post (bukan per `PostTarget`) — konsisten dengan model 1-post-banyak-target.
3. `PostTarget.status` diubah ke `pending` (kembali ke antrean atau draft).

---

# Webhook Handling

## Overview

Outstand mengirim event webhook untuk hasil publikasi dan masa berlaku token akun. Engagement tidak menggunakan webhook pada MVP.

**Endpoint:** `POST /api/webhooks/outstand`

## Keamanan Webhook

Setiap request webhook dari Outstand harus diverifikasi atas **raw body** sebelum payload diparse:

```
Request masuk
    └── Route Handler `/api/webhooks/outstand`
            ├── Baca raw body
            ├── Verifikasi signature HMAC-SHA256 atas raw body
            ├── Tolak jika signature tidak valid → 401
            ├── Persist receipt idempoten ke outstand_webhook_events
            └── ACK 2xx; pemrosesan dilanjutkan oleh JOB-01
```

- Outstand menyertakan header `X-Outstand-Signature` berisi HMAC-SHA256 dari request body.
- Webhook secret disimpan di environment variable, tidak di database.
- Jika signature tidak valid, response `401 Unauthorized` dikembalikan tanpa memproses payload.

## Daftar Event Webhook

| Event | Deskripsi | Domain yang Dinotifikasi |
|-------|-----------|--------------------------|
| `post.published` | Sedikitnya satu target berhasil dipublikasikan; outcome tetap dibaca per akun | Publishing BC |
| `post.error` | Semua target gagal setelah retry Outstand; ACL memetakan outcome per akun ke status domain `failed` | Publishing BC, Notification BC |
| `account.token_expired` | Token akun kedaluwarsa; ACL memetakan akun ke `error` dan membutuhkan reconnect | Workspace BC, Notification BC |

Event `comment.received`, `message.received`, mention, dan webhook engagement lainnya **bukan kontrak MVP**.

## Alur Pemrosesan Webhook

```
Outstand
    └── POST /api/webhooks/outstand
            └── Route Handler
                    ├── Baca raw body + verifikasi HMAC
                    ├── INSERT idempoten outstand_webhook_events
                    ├── Enqueue JOB-01 untuk receipt baru
                    └── ACK 2xx

JOB-01
    └── WebhookProcessor.process(receipt)
            ├── post.published / post.error
            │     → OutstandAdapter.fetchPostOutcome(...)
            │     → PublishingService.applyTargetOutcomes(...)
            └── account.token_expired → ACL mapping
                                      → WorkspaceService.markAccountReconnectRequired(...)
```

**Prinsip pemrosesan webhook:**
- Route Handler **tidak** mengandung business logic — hanya membaca raw body, memverifikasi HMAC, melakukan durable idempotent receipt, enqueue, lalu ACK.
- `WebhookProcessor` memanggil Application Service yang tepat menggunakan `outstandPostId` (amandemen ADR-092, sebelumnya `outstandJobId`) atau `outstandAccountId` sebagai external reference.
- Respons `2xx` hanya dikembalikan **setelah** receipt berhasil dipersistenkan. Kegagalan persistensi mengembalikan non-2xx agar Outstand dapat melakukan retry delivery.
- Retry delivery dari Outstand berhenti pada boundary receipt/ACK. Retry pemrosesan internal dilakukan terpisah oleh `JOB-01`; kegagalan pemrosesan tidak meminta Outstand mengirim ulang event.

## Idempotency

Outstand dapat mengirim event yang sama lebih dari sekali. `outstand_webhook_events.outstand_event_id` menyimpan event ID vendor jika tersedia; jika kontrak delivery tidak menyediakannya, ingestion menggunakan fingerprint deterministik (SHA-256 raw body) sebagai identity receipt. Duplicate valid di-ACK `2xx` tanpa enqueue ulang.

- Handler domain tetap idempoten dan menerapkan outcome per `PostTarget`. Event `post.published` tidak boleh menandai seluruh target berhasil karena event tersebut juga dapat mewakili partial success.
- Status receipt mencatat `received | processing | processed | failed | dead_lettered` untuk audit pemrosesan internal.

---

# Engagement Data Sync

## Sumber Data

Engagement MVP hanya mencakup **komentar dan reply**. Direct Message dan mention berada di luar scope MVP.

| Mekanisme | Trigger | Kegunaan |
|-----------|---------|----------|
| **Periodic pull** | JOB-03 setiap 30 menit | Sumber utama komentar baru/perubahan |
| **Manual refresh** | Aksi user | Menjalankan sync komentar on-demand lalu memuat data terbaru |

`OutstandAdapter.fetchComments` mentranslasikan response Outstand menjadi data komentar domain. `EngagementService` melakukan upsert idempoten berdasarkan external comment ID. Jika sync menemukan item baru, service membuat notifikasi internal `engagement_new` secara agregat; notifikasi ini **berasal dari sync**, bukan webhook.

**Atribut `InboxItem` yang berasal dari Outstand:**
- `outstandItemId` — ID unik dari Outstand, digunakan untuk idempotency check.
- `platform` — dari `ConnectedAccount`.
- `authorName` — nama pengirim komentar.
- `content` — teks komentar.
- `postId` — referensi ke `Post` jika komentar terkait post internal (matched via `outstandPostId`, amandemen ADR-092, sebelumnya `outstandJobId`).
- `receivedAt` — timestamp dari Outstand.

## Reply via Outstand API

Ketika user membalas dari Engagement Inbox:

1. `EngagementService.reply(inboxItemId, text)` dipanggil.
2. `EngagementService` memanggil `OutstandAdapter.replyToComment(outstandCommentId, text)`.
3. Setelah berhasil, `Reply` entity disimpan di repository sebagai audit trail.

---

# Analytics Data Sync

## Sumber Data

Data analytics (metrics post dan metrics workspace) diambil melalui polling periodik ke Outstand API. Outstand mengaggregasikan data dari platform social media.

| Data | Frekuensi Polling | Disimpan Sebagai |
|------|-------------------|------------------|
| Post metrics (likes, comments, shares, reach) | Per-job setelah publish | `analytics_post_metrics` |
| Workspace metrics (followers, reach harian/mingguan) | Harian | `analytics_workspace_snapshots` |

## Alur Sync

```
Background Job (scheduler)
    └── AnalyticsService.syncPostMetrics(workspaceId)
            └── OutstandAdapter.fetchPostMetrics(outstandPostId)
                    // amandemen ADR-092: rename dari outstandJobId. Bentuk hasil
                    // (per-akun metrics + aggregated_metrics) belum direvisi mengikuti
                    // response asli get-post-analytics — follow-up saat T-041 disentuh.
                    └── AnalyticsService.upsertPostMetrics(postId, metricsData)

Background Job (scheduler)
    └── AnalyticsService.syncWorkspaceMetrics(workspaceId, period)
            └── OutstandAdapter.fetchWorkspaceMetrics(outstandAccountId, period)
                    └── AnalyticsService.upsertWorkspaceSnapshot(workspaceId, snapshotData)
```

**Catatan:**
- Scheduling background job untuk polling analytics didefinisikan di `background-jobs.md`.
- Analytics tidak menggunakan webhook — Outstand tidak menyediakan webhook untuk perubahan metrics.
- Data metrics bersifat **append-only** atau **upsert** — snapshot lama tidak dihapus.

---

# Error Handling Strategy

## Klasifikasi Error

| Tipe Error | Contoh | Penanganan |
|------------|--------|------------|
| **Transient** | Timeout, 5xx, network error | Retry dengan exponential backoff |
| **Client Error** | 400 Bad Request, invalid params | Log + gagalkan operasi, jangan retry |
| **Auth Error** | 401 Unauthorized (API key salah) | Alert ke developer (monitoring), jangan retry |
| **Account Error** | 403 (akun dicabut aksesnya) | Tandai `ConnectedAccount.status = error`, notifikasi workspace owner |
| **Not Found** | 404 (job tidak ditemukan) | Log + skip (idempotent) |

## Strategi per Operasi

**Connect Account:**
- Gagal pada OAuth callback → tampilkan pesan error ke user, jangan simpan `ConnectedAccount` yang invalid.

**Schedule Post:**
- Gagal (transient) → retry via background job (maks 3x).
- Gagal (permanent) → tandai `PostTarget.status = failed`, simpan `PostTarget.error`, notifikasi creator.

**Webhook Processing:**
- Gagal memproses receipt → JOB-01 dijadwalkan ulang secara internal dan receipt ditandai `failed`.
- Retry maks 3x dengan exponential backoff: 5 menit, 15 menit, 60 menit (sesuai JOB-01 di `background-jobs.md`).
- Setelah maks retry habis → job `failed` dan receipt `dead_lettered`, dicatat untuk inspeksi manual.

**Analytics Sync:**
- Gagal polling → log error, skip siklus ini, coba lagi di jadwal berikutnya.
- Kegagalan tidak memblokir operasi lain.

## IntegrationError

Seluruh error dari Outstand API diterjemahkan oleh `OutstandAdapter` ke tipe `IntegrationError` sebelum dikembalikan ke domain:

```
IntegrationError
  ├── type: 'transient' | 'client_error' | 'auth_error' | 'account_error' | 'not_found'
  ├── outstandErrorCode: string?
  ├── message: string
  └── retryable: boolean
```

Domain internal **tidak pernah** melihat HTTP error code Outstand secara langsung.

---

# Keputusan Integration Layer

| ID | Topik | Keputusan |
|----|-------|-----------|
| IL-D01 | ACL Pattern | Anti-Corruption Layer via `OutstandAdapter` — satu-satunya titik interaksi dengan Outstand API |
| IL-D02 | Token Management | OAuth access token tidak disimpan di database internal — dikelola sepenuhnya oleh Outstand |
| IL-D03 | Webhook Security | HMAC-SHA256 diverifikasi atas raw body sebelum parse/persist |
| IL-D04 | Webhook Response | Durable-before-ACK: receipt idempoten tersimpan dan JOB-01 terjadwal sebelum respons `2xx` |
| IL-D05 | Webhook Idempotency | Event ID vendor atau fingerprint SHA-256 raw body pada `outstand_webhook_events`; handler domain tetap idempoten |
| IL-D06 | Analytics Strategy | Pull-based polling periodik — tidak ada webhook dari Outstand untuk metrics |
| IL-D07 | Media Strategy | Original di Supabase Storage; working copy diunggah via Outstand request URL → PUT → confirm; URL Outstand dipakai untuk publish |
| IL-D08 | Error Translation | Seluruh error Outstand diterjemahkan ke `IntegrationError` di dalam `OutstandAdapter` |
| IL-D09 | Engagement MVP | Comments/replies only melalui JOB-03 30 menit + manual refresh; tanpa webhook/DM/mention |
| IL-D10 | X BYOK | Project Owner mengatur kredensial X di dashboard Outstand; aplikasi tidak menyimpan X client secret |
| IL-D11 | Publish Outcome | `post.published`/`post.error` memicu pembacaan outcome per akun; status setiap `PostTarget` diperbarui independen |
| IL-D12 | ADR-040 | IL-D03–D11 mengamandemen kontrak lama sesuai ADR-040 |

---

# Related Documents

* `domain-model.md` — definisi `ConnectedAccount`, `PostTarget`, `outstandPostId`/`platformPostId` sebagai external reference (ADR-092)
* `database-strategy.md` — tabel `workspace_connected_accounts`, `publishing_post_targets`, `analytics_post_metrics`, `analytics_workspace_snapshots`
* `application-layer.md` — Route Handler sebagai entry point webhook; Application Service sebagai pemanggil OutstandAdapter
* `background-jobs.md` — strategi retry webhook event dan jadwal polling analytics
* `auth-architecture.md` — workspace membership check pada setiap operasi ConnectedAccount
* `../../project-manager/DECISIONS.md` — ADR-005, ADR-016, ADR-018, ADR-019, ADR-020, ADR-021, ADR-079, ADR-092
