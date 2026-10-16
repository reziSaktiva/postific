## Decision ADR-025

### Title

System Architecture Baseline v1.0 — product-discovery/05-architecture/

### Status

Accepted — Amended by ADR-040 (2026-07-23)

### Date

2026-07-15

### Decision

Seluruh 7 dokumen pada folder `product-discovery/05-architecture/` ditetapkan sebagai **System Architecture Baseline v1.0**:

- `domain-model.md` — 10 bounded context, context map, shared types, domain boundary rules.
- `database-strategy.md` — multi-tenancy via RLS, 22 tabel untuk 10 BC, storage, index, dan soft delete strategy.
- `application-layer.md` — 4-layer stack, Server Actions untuk UI mutations, Route Handlers untuk webhook/external, Repository Pattern, cross-domain communication via public module API.
- `integration-layer.md` — Anti-Corruption Layer via OutstandAdapter, ConnectedAccount OAuth flow, webhook handling via HMAC, engagement sync, analytics sync.
- `background-jobs.md` — PostgreSQL job queue + Railway Cron sebagai trigger, 4 job types, retry strategy.
- `realtime-strategy.md` — Supabase Realtime untuk notifikasi in-app, manual refresh untuk data konten, notification type registry, RLS subscription rules.
- `auth-architecture.md` — Better Auth, HTTP-only session cookie, Middleware workspace context resolution, RBAC di Application Service, RLS defense-in-depth.

Dokumen-dokumen ini telah melalui Architecture Review (8 inkonsistensi ditemukan dan diperbaiki: ARCH-REVIEW-01 s/d ARCH-REVIEW-08) dan dinyatakan konsisten satu sama lain.

### Reason

- Seluruh 7 topik M5 — System Architecture telah selesai didokumentasikan.
- Architecture Review telah dilakukan dan semua inkonsistensi telah diselesaikan.
- Baseline diperlukan sebagai titik referensi tetap sebelum Engineering Planning (M6) dimulai.
- Sesuai Definition of Done M5: seluruh dokumen selesai, ADR tercatat, tidak ada blocker.

### Alternatives Considered

- Tidak menetapkan baseline formal — berisiko inkonsistensi saat Engineering Planning memodifikasi arsitektur tanpa anchor point yang jelas.
- Menunggu Engineering Planning selesai dulu — tidak diperlukan; System Architecture sudah cukup matang dan lengkap sebagai input M6.

---
