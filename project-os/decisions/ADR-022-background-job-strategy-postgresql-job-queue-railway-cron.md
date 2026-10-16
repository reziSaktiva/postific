## Decision ADR-022

### Title

Background Job Strategy — PostgreSQL Job Queue + Railway Cron

### Status

Accepted — Amended by ADR-040 (2026-07-23)

### Date

2026-07-15

### Decision

Background job menggunakan **PostgreSQL-backed job queue** via tabel `background_jobs` dengan eksekusi dipicu oleh **Railway Cron** yang memanggil Route Handler `/api/jobs/run`.

Job types yang didefinisikan:

- `outstand.webhook.retry` — retry webhook gagal (max 3 kali, exponential backoff)
- `notification.post_status` — buat notifikasi saat post published/failed
- `engagement.sync` — sync engagement dari Outstand (periodik, setiap 30 menit)
- `analytics.sync` — sync analytics dari Outstand (periodik, setiap 24 jam)

Locking menggunakan `SELECT FOR UPDATE SKIP LOCKED` untuk mencegah race condition.

### Reason

- Tidak perlu menambah infrastruktur baru — Supabase PostgreSQL sudah tersedia.
- Railway sudah digunakan sebagai deployment platform; Railway Cron adalah fitur built-in.
- `SELECT FOR UPDATE SKIP LOCKED` adalah fitur native PostgreSQL — atomic, tanpa Redis atau distributed lock.
- Pragmatis untuk MVP volume; dapat di-upgrade ke managed queue (Trigger.dev, Inngest) post-MVP jika dibutuhkan.

### Alternatives Considered

- **Trigger.dev / Inngest** (managed background job service) — lebih powerful, tapi menambah external service dependency untuk MVP.
- **Supabase Edge Functions + pg_cron** — cocok untuk scheduled jobs, tapi Edge Functions memiliki batasan cold start dan runtime.
- **BullMQ + Redis** — perlu managed Redis instance tambahan; overkill untuk MVP volume.

---
