## Decision ADR-036

### Title

Engineering Planning Baseline v1.0

### Status

Accepted — Amended by ADR-040 (2026-07-23); Addendum by ADR-041 (2026-07-23)

### Date

2026-07-17

### Decision

Seluruh 8 dokumen pada folder `product-discovery/06-engineering/` ditetapkan sebagai **Engineering Planning Baseline v1.0**:

- `monorepo-setup.md` — Hybrid Monorepo, Bun Workspaces, App Router (termasuk `/api/auth/*` dan `/api/jobs/run`), 9 domain modules MVP, import rules.
- `deployment-infrastructure.md` — Railway + Supabase SEA (Singapore), Production + Staging, service `web` + `cron`, rollback (ADR-028, ADR-029).
- `auth-strategy.md` — Better Auth config, providers, session cookie env-aware, JWT Supabase-compatible untuk Realtime (ADR-030).
- `database-orm.md` — Prisma ORM, batas Supabase client (Realtime/Storage), Prisma Migrate, Supavisor pooling (ADR-031).
- `cicd-pipeline.md` — GitHub Actions quality gates, promosi feature→staging→main, Railway CD, migrate on release (ADR-032).
- `environment-management.md` — katalog env vars, secret native, project Cloud `social-media-local` / staging / prod (ADR-033).
- `dx-tooling.md` — ESLint + Prettier, Lefthook + lint-staged, Vitest, script workspace (ADR-034).
- `dependency-strategy.md` — caret ranges, `bun.lockb` root, penempatan dep, aturan `@social/shared` (ADR-035).

Dokumen-dokumen ini telah melalui Engineering Planning Review (6 inkonsistensi ditemukan dan diperbaiki: ENG-REVIEW-01 s/d ENG-REVIEW-06) dan dinyatakan konsisten satu sama lain serta dengan System Architecture Baseline v1.0 (ADR-025).

**Addendum:** `design-tokens.md` ditambahkan kemudian sebagai SoT visual tokens (ADR-038) — template siap; nilai diisi setelah design approve.

Baseline ini menjadi acuan wajib untuk:

- M7 — Repository & Bootstrap
- M8 — Development

### Reason

- Seluruh 8 topik M6 — Engineering Planning telah selesai didokumentasikan.
- Engineering Planning Review telah dilakukan dan semua inkonsistensi telah diselesaikan.
- Keputusan signifikan M6 memiliki ADR (ADR-026, ADR-028 s/d ADR-035).
- Exit criteria M6 terpenuhi; tidak ada blocker. Dependency terbuka AS-D04 (transactional email) dicatat sebagai Known Issue dan tidak memblokir bootstrap.
- Baseline diperlukan sebagai titik referensi tetap sebelum inisialisasi repository dan kode.

### Alternatives Considered

- Tidak menetapkan baseline formal — berisiko bootstrap M7 tanpa anchor keputusan teknis yang jelas.
- Menunda baseline sampai email provider (AS-D04) dipilih — tidak diperlukan; auth core dan infrastruktur sudah cukup untuk memulai Repository & Bootstrap.

---
