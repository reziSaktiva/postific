# Real-time Strategy

Dokumen ini mendefinisikan **Real-time Strategy** untuk produk **Postific** — pendekatan notifikasi in-app, sinkronisasi status konten, dan pola update data tanpa full page reload.

Dokumen ini menjadi acuan desain real-time dan tidak mencakup implementasi kode. Detail implementasi (Supabase Realtime client setup, subscription lifecycle) didokumentasikan di Engineering Planning (M6).

---

# Tujuan

* Menetapkan scope real-time yang realistis untuk MVP.
* Mendefinisikan arsitektur notifikasi in-app berbasis Supabase Realtime.
* Menetapkan pola manual refresh untuk data konten dan status post.
* Mendokumentasikan mapping event domain ke notifikasi pengguna.
* Mendefinisikan aturan kapan sistem menggunakan Realtime vs polling vs manual refresh.

---

# Keputusan Pra-Architecture

Keputusan berikut sudah ditetapkan sebelum dokumen ini dibuat dan menjadi fondasi Real-time Strategy:

| Topik | Keputusan | Sumber |
|-------|-----------|--------|
| Real-time Approach | In-app notification + manual refresh | Keputusan pra-architecture |
| Database Platform | Supabase PostgreSQL Cloud | Keputusan pra-architecture |
| Notification BC | BC-09 Notification sebagai bounded context tersendiri | `domain-model.md` |
| Background Jobs | JOB-02 membuat notifikasi saat post published/failed | `background-jobs.md` |

---

# Scope Real-time MVP

Sistem **tidak** membangun full real-time collaboration (seperti Google Docs). Scope real-time dibatasi pada:

| Fitur | Pendekatan | Alasan |
|-------|-----------|--------|
| Notifikasi in-app (badge, toast) | Supabase Realtime | Diperlukan untuk awareness tim tanpa polling |
| Calendar/Queue/Drafts/History (4 screen Publish) | Supabase Realtime, granular client-side patch (ADR-094) | Kolaborasi tim ala Buffer — user lain lihat perubahan tanpa refresh manual; scope ditambahkan setelah baseline awal ini (lihat § "Perluasan ke `publishing_posts`" di bawah) |
| Engagement inbox (comments/replies) | JOB-03 pull 30 menit + manual refresh + badge | Sync internal mendeteksi komentar baru; tidak ada webhook Engagement MVP |
| Analytics | Manual refresh | Data snapshot harian — tidak perlu real-time |
| Presence (who's editing) | Post-MVP | Kompleksitas tinggi, bukan kebutuhan MVP |
| Collaborative editing | Post-MVP | Di luar scope MVP |

---

# Arsitektur Notifikasi In-App

## Notification Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION FLOW                              │
│                                                                   │
│  Domain Event (post published, post failed, engagement new)       │
│         │                                                         │
│         ▼                                                         │
│  Background Job (JOB-02)                                          │
│         │                                                         │
│         ▼                                                         │
│  NotificationService.create()                                     │
│         │                                                         │
│         ▼                                                         │
│  INSERT ke tabel notifications                                    │
│         │                                                         │
│         ▼ (PostgreSQL change → Supabase Realtime)                 │
│                                                                   │
│  Client (Next.js)                                                 │
│  └── Supabase Realtime subscription                               │
│        └── Terima payload notifikasi baru                         │
│              ├── Update notification badge count                  │
│              └── Tampilkan toast (opsional, berdasarkan tipe)     │
└──────────────────────────────────────────────────────────────────┘
```

## Supabase Realtime Subscription

Client berlangganan ke perubahan tabel `notifications` menggunakan Supabase Realtime dengan filter per user:

```
Channel: notifications:{userId}
Table:   notifications
Filter:  user_id = eq.{userId}
Event:   INSERT
```

**Aturan subscription:**
- Subscription dibuat saat user login dan workspace aktif dimuat.
- Subscription dihapus saat user logout atau session berakhir.
- Hanya subscribe ke event `INSERT` — update dan delete tidak diperlukan untuk notifikasi.
- Filter per `user_id` memastikan user hanya menerima notifikasi miliknya.

## Tabel `notifications`

Skema lengkap tabel ini didefinisikan di `database-strategy.md` (BC-09). Kolom yang relevan untuk Realtime subscription:

```
notifications
├── id                   UUID PK
├── workspace_id         UUID FK → workspaces
├── user_id              UUID       -- penerima notifikasi (filter subscription)
├── type                 TEXT       -- tipe notifikasi (lihat Notification Type Registry)
├── title                TEXT
├── body                 TEXT
├── is_read              BOOLEAN DEFAULT false
├── related_entity_type  TEXT       -- konteks: 'post' | 'inbox_item' | 'member' | ...
├── related_entity_id    UUID       -- ID entitas terkait
├── created_at           TIMESTAMPTZ DEFAULT now()
└── read_at              TIMESTAMPTZ
```

---

# Notification Type Registry

| Type | Trigger | Penerima | Toast |
|------|---------|----------|-------|
| `post_published` | JOB-01 memproses `post.published` | Pemilik post (Creator yang buat) | Ya |
| `post_failed` | JOB-01 memetakan event vendor `post.error` ke status domain `failed` | Pemilik post | Ya |
| `account_reconnect_required` | JOB-01 memetakan `account.token_expired` ke akun `error` | Account Owner, Admin | Ya |
| `engagement_new` | JOB-03/manual sync menemukan komentar baru | Creator, Admin, Account Owner | Tidak (hanya badge) |
| `post_scheduled_reminder` | Post akan tayang dalam 1 jam | Pemilik post | Tidak |

**Catatan:**
- `engagement_new` tidak menampilkan toast untuk menghindari spam saat sync menemukan banyak komentar sekaligus. Hanya badge count yang bertambah.
- Nama event vendor tidak dipakai sebagai `NotificationType`; nama internal seperti `post_failed` tetap kanonikal.
- `post_scheduled_reminder` adalah nice-to-have MVP — dapat diskip jika menambah kompleksitas.

---

# Perluasan ke `publishing_posts` (ADR-094)

**Amandemen RT-D01/RT-D02.** Baseline awal dokumen ini (di atas) membatasi
Supabase Realtime hanya untuk tabel `notifications`, dengan Content Calendar
manual-refresh-only. ADR-094 (2026-08-28) memperluas cakupan ke tabel
`publishing_posts`, khusus untuk 4 screen Publish (Calendar, Queue, Drafts,
History) — bukan aplikasi-wide, bukan tabel lain.

**Subscription:**
```
Channel: publishing_posts:{workspaceId}
Table:   publishing_posts
Filter:  workspace_id = eq.{workspaceId}
Event:   INSERT, UPDATE   -- tanpa DELETE, soft-delete tercermin sebagai UPDATE
```

Berbeda dari `notifications` (per-user), channel ini **per-workspace** — semua
anggota workspace perlu tahu perubahan, bukan cuma pemilik post.

**Strategi update: granular client-side patch** (bukan full-page refresh).
Tiap screen menyimpan list datanya sendiri sebagai client state
(diinisialisasi dari props Server Component awal). Saat event Realtime masuk
(`{postId, eventType}`), screen memanggil fungsi fetch-1-record dari
`PublishingService` (reuse, bukan refetch seluruh list), lalu **upsert atau
remove** ke local state berdasarkan apakah post itu masih cocok kriteria
tampilan screen tersebut (mis. Queue cuma tampilkan `Scheduled` — begitu
status berubah jadi `Published`, item dihapus dari local state Queue, bukan
di-update). Event dari aksi milik user sendiri (echo) diproses sama seperti
event orang lain — tidak ada deteksi/skip khusus, karena fetch-and-patch
sudah idempoten.

**RLS policy baru khusus Realtime** (bukan reuse policy server-side yang
sudah ada): `publishing_posts_realtime_workspace_members`, berbasis
`auth.uid()` — lihat varian tambahan di `database-strategy.md` § RLS Policy
Pattern.

**Subscription lifecycle per-screen** — dibuat saat screen di-mount, dilepas
saat unmount/pindah halaman/workspace (beda dari notification bell yang
global sepanjang sesi).

**Hard dependency ke T-036** (notification bell) — wiring generic Supabase
Realtime client + Better Auth↔Supabase JWT bridge dibangun di T-036 lebih
dulu; fitur ini murni reuse, bukan membangun ulang. History (T-034), karena
belum dibangun, wajib menyertakan pola Realtime ini sejak desain awal.

---

# Pola Manual Refresh

## Content Calendar & Post List

**Catatan:** section ini mendeskripsikan pola awal (pra-ADR-094). Untuk
Calendar/Queue/Drafts/History, pola Supabase Realtime granular patch di atas
kini berlaku begitu T-036 selesai — manual refresh di bawah ini tetap
relevan sebagai fallback/state sebelum implementasi Realtime tersebut jalan.

Sebelum ADR-094, content calendar tidak menggunakan Supabase Realtime. Alasannya saat itu:
- Data berubah terutama via aksi user itu sendiri atau via webhook (post published/failed).
- Notifikasi sudah menginformasikan perubahan status — user dapat refresh secara sadar.
- Real-time calendar subscription menambah kompleksitas tanpa manfaat yang signifikan untuk MVP.

**Pola yang digunakan:**
- Setelah user melakukan aksi (buat draft, jadwalkan post), UI di-update secara optimistic atau via Server Action yang mengembalikan data terbaru.
- User dapat menekan tombol refresh manual di Content Calendar.
- Saat notifikasi `post_published` atau `post_failed` diterima, UI menampilkan pesan "Status konten berubah. Refresh untuk melihat update." dengan tombol refresh.

## Engagement Inbox

Engagement inbox menggunakan kombinasi badge + manual refresh:
- JOB-03 menarik comments setiap 30 menit; tombol refresh memicu sync yang sama secara on-demand.
- Badge count diperbarui via Supabase Realtime saat notifikasi `engagement_new` dari hasil sync masuk.
- User membuka Engagement Inbox → data diambil fresh dari database (Server Component).
- Tidak ada auto-refresh tanpa interaksi user.
- Replies dikirim melalui Outstand API; DM, mention, dan webhook engagement berada di luar MVP.

## Analytics Dashboard

Analytics tidak memerlukan real-time — data adalah snapshot periodik (sync harian). User hanya melihat data historis. Tidak ada subscription atau polling.

---

# Aturan Real-time vs Polling vs Manual Refresh

| Kondisi | Pendekatan |
|---------|-----------|
| Notifikasi yang harus segera terlihat user | Supabase Realtime (INSERT subscription) |
| Status yang berubah karena aksi user sendiri | Optimistic update + Server Action response |
| Data yang berubah via background job / webhook receipt | Manual refresh + notifikasi badge/toast |
| Data snapshot (analytics, audit log) | Manual refresh on demand |
| Data yang jarang berubah (workspace settings) | Fetch saat halaman dimuat, tidak di-subscribe |

---

# RLS pada Supabase Realtime

Supabase Realtime menghormati Row-Level Security (RLS). Subscription ke tabel `notifications` hanya mengembalikan baris yang dapat dibaca user berdasarkan RLS policy yang berlaku.

**Policy untuk Realtime subscription:**
```sql
-- user hanya bisa subscribe ke notifikasi miliknya
CREATE POLICY "users_own_notifications"
ON notifications
FOR SELECT
USING (user_id = auth.uid());
```

Ini memastikan bahwa meskipun client salah mengkonfigurasi filter, server-side RLS tetap memproteksi data.

**Catatan:** `auth.uid()` di sini mengacu pada integrasi Better Auth + Supabase JWT yang dikonfigurasi di Engineering Planning (M6) — lihat detail di `auth-architecture.md`. Policy ini berlaku untuk Realtime subscription dari client (anon key), yang berbeda dengan server-side queries menggunakan service role key (menggunakan `current_setting('app.current_user_id')`).

---

# Notification Bell Component

Komponen UI untuk notifikasi in-app bekerja sebagai berikut:

```
NotificationBell (Client Component)
  ├── Supabase Realtime subscription on mount
  ├── Menampilkan badge count (unread notifications)
  ├── Dropdown: daftar 10 notifikasi terbaru
  ├── Klik notifikasi → tandai is_read = true → navigate ke konten terkait
  └── "Lihat semua" → halaman /notifications
```

**Badge count:**
- Dihitung dari `SELECT count(*) FROM notifications WHERE user_id = ? AND is_read = false`.
- Diperbarui secara realtime saat notifikasi baru masuk.
- Di-reset ketika user membuka dropdown (mark as read).

---

# Post-MVP Considerations

Fitur real-time berikut tidak masuk MVP tetapi perlu dipertimbangkan saat scaling:

| Fitur | Kompleksitas | Prioritas |
|-------|-------------|-----------|
| Presence indicator (siapa sedang edit draft) | Tinggi | Low |
| Live collaborative editing | Sangat tinggi | Sangat low |
| Auto-refresh content calendar | Medium | Medium |
| Push notification (browser/mobile) | Medium | Medium |

---

# Decision Log

| ID | Keputusan | Alasan |
|----|-----------|--------|
| RT-D01 | Supabase Realtime hanya untuk tabel `notifications` | Scope minimal — notifikasi adalah satu-satunya use case yang benar-benar butuh real-time di MVP |
| RT-D02 | Content calendar menggunakan manual refresh, bukan Realtime | Mengurangi kompleksitas; perubahan kalender terjadi melalui aksi user atau webhook yang sudah ditangani via notifikasi |
| RT-D03 | Filter Realtime subscription per `user_id` | Privacy — user tidak boleh menerima notifikasi user lain; sejalan dengan RLS |
| RT-D04 | `engagement_new` tidak memunculkan toast | Mencegah spam notifikasi saat sync menemukan banyak komentar sekaligus; badge count lebih appropriate |
| RT-D05 | Optimistic update untuk aksi user sendiri | UX yang responsif tanpa perlu menunggu konfirmasi database; fallback ke error state jika gagal |
| RT-D06 | Nama notifikasi internal memakai `snake_case`; ACL memisahkannya dari nama event vendor | Domain tidak bergantung pada kontrak Outstand; `post.error` tetap menghasilkan `post_failed` |
| RT-D07 | Engagement notification hanya berasal dari JOB-03/manual sync | Tidak ada webhook comment/DM/mention dalam kontrak MVP |
| RT-D08 | ADR-040 | RT-D06–D07 mengamandemen registry dan sumber notifikasi lama |
| RT-D09 | ADR-094 | RT-D01/RT-D02 diamandemen: `publishing_posts` ditambahkan sebagai target Realtime kedua (channel per-workspace, granular client-side patch), khusus 4 screen Publish; hard dependency ke T-036 |

---

# Related Documents

* `domain-model.md` — BC-09 Notification sebagai bounded context
* `database-strategy.md` — tabel `notifications`
* `background-jobs.md` — JOB-02 yang membuat notifikasi
* `integration-layer.md` — webhook yang memicu chain ke notifikasi
* `auth-architecture.md` — autentikasi diperlukan sebelum Realtime subscription
* `../../project-manager/DECISIONS.md` — ADR-023, ADR-094
