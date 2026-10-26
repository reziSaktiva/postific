## Decision ADR-040

### Title

Penyelarasan Kontrak Resmi Outstand

### Status

Accepted

### Date

2026-07-23

### Decision

Baseline Product, UX, Architecture, dan Engineering diselaraskan dengan kontrak
resmi Outstand yang berlaku pada 2026-07-23:

1. **Webhook resmi yang digunakan MVP** adalah `post.published`, `post.error`,
   dan `account.token_expired`. `post.error` dipetakan oleh
   `OutstandAdapter` ke status domain `failed`; `account.token_expired`
   dipetakan ke status akun `error` dan kebutuhan reconnect. Nama event vendor
   tidak menjadi tipe domain.
2. **Webhook ingestion bersifat durable-before-ACK:** Route Handler
   memverifikasi HMAC atas raw body, menyimpan receipt idempoten ke
   `outstand_webhook_events`, lalu mengembalikan respons `2xx`. Pemrosesan
   domain dan retry dilakukan secara internal melalui PostgreSQL job queue.
   Retry delivery milik Outstand dan retry pemrosesan internal adalah dua
   mekanisme berbeda.
3. **Engagement MVP dibatasi ke komentar dan reply.** Data diambil melalui
   periodic pull setiap 30 menit serta manual refresh. Direct Message, mention,
   dan webhook engagement tidak termasuk MVP. Notifikasi `engagement_new`
   dibuat dari hasil sinkronisasi internal.
4. **Media publishing memakai Outstand Media API.** Original media tetap
   menjadi milik aplikasi di Supabase Storage. Saat diperlukan untuk publishing,
   aplikasi meminta upload URL Outstand, melakukan `PUT`, mengonfirmasi upload,
   lalu memakai URL working copy Outstand untuk membuat atau menjadwalkan post.
5. **X/Twitter tetap platform MVP tetapi wajib BYOK.** Project Owner
   mengonfigurasi kredensial X secara manual di dashboard Outstand. Aplikasi
   tidak menerima atau menyimpan Client ID/Client Secret X.
6. Tipe notifikasi internal seperti `post_failed` tetap dipertahankan. ACL
   bertanggung jawab menerjemahkan event eksternal ke bahasa domain.

Keputusan ini mengamendemen:

- ADR-005 — batas kemampuan Outstand dan prasyarat X BYOK.
- ADR-008 — scope Engagement MVP menjadi komentar/reply saja.
- ADR-013 — flow dan screen Engagement memakai pull + manual refresh.
- ADR-019 — kontrak `OutstandAdapter` mencakup event mapping, media upload,
  comment sync, dan reply.
- ADR-020 — webhook dipersistenkan sebelum ACK; daftar event resmi diperbarui.
- ADR-022 — `outstand.webhook.retry` digantikan
  `outstand.webhook.process` untuk pemrosesan/retry internal dan
  `engagement.sync` menjadi sumber utama Engagement.
- ADR-023 — notifikasi engagement berasal dari hasil sync, bukan webhook.
- ADR-025 — System Architecture Baseline diperbarui secara aditif.
- ADR-036 — Engineering Baseline diperbarui untuk schema, migrasi, dan
  prasyarat operasional Outstand.

### Reason

- Dokumentasi resmi Outstand hanya mencantumkan webhook `post.published`,
  `post.error`, `account.token_expired`, `import.completed`, dan
  `import.failed`; webhook komentar/DM yang diasumsikan baseline tidak ada.
- API resmi menyediakan baca/balas komentar, tetapi tidak menyediakan unified
  Direct Message API yang diperlukan scope lama.
- Outstand mengharuskan media di-upload dan dikonfirmasi sebelum URL hasil
  upload dipakai untuk post; signed URL Supabase langsung bukan kontrak
  publishing yang didukung.
- Menyimpan receipt sebelum ACK mencegah kehilangan event jika proses internal
  gagal setelah Outstand menerima respons sukses.
- X memerlukan kredensial developer milik customer; konfigurasi manual di
  dashboard Outstand paling sederhana dan tidak memperluas tanggung jawab
  aplikasi atas secret platform.

### Alternatives Considered

- Mempertahankan asumsi baseline lama sampai implementasi — ditolak karena
  akan menghasilkan kontrak ACL dan schema yang salah.
- Mempertahankan DM sebagai MVP dengan integrasi platform langsung — ditolak
  karena melanggar ADR-005 dan memperbesar scope integrasi.
- Mengirim signed URL Supabase langsung ke Outstand — ditolak karena bukan
  alur media resmi Outstand.
- ACK sebelum durable persistence — ditolak karena berisiko kehilangan event.
- Mengelola kredensial X melalui aplikasi — ditolak untuk MVP; dashboard
  Outstand lebih sederhana dan membatasi exposure secret.

---
