## Decision ADR-015

### Title

Database Strategy Baseline — Database Strategy v1.0

### Status

Accepted

### Date

2026-07-15

### Decision

`product-discovery/05-architecture/database-strategy.md` ditetapkan sebagai **Database Strategy Baseline** yang mencakup:

- Multi-tenancy: RLS dengan `workspace_id` sebagai unit isolasi.
- ID Generation: UUID v4 via `gen_random_uuid()`.
- Schema: Single schema `public` dengan domain prefix (ADR-014).
- Identity: BC-01 dikelola Better Auth dengan prefix `identity_`.
- RLS Approach: Application-enforced auth sebagai lapisan utama; RLS sebagai defense-in-depth.
- Soft Delete: Hard delete by default; `deleted_at` hanya pada `publishing_posts`.
- 22 tabel terdefinisi untuk 10 bounded context (2 tabel post-MVP untuk BC-10 Billing).

### Reason

- Seluruh entitas dari Domain Model (`domain-model.md`) telah dipetakan ke tabel database.
- Semua keputusan database strategy yang diperlukan sebagai input Engineering Planning telah terdokumentasi.
- Konsisten dengan keputusan pra-architecture (Supabase PostgreSQL, RLS, Better Auth, Supabase Storage).

### Alternatives Considered

- ULID sebagai ID strategy — sortable dan URL-friendly, tapi butuh library tambahan; UUID v4 sudah native di PostgreSQL/Supabase dan cukup untuk MVP.
- Soft delete semua tabel — konsistensi lebih baik, tapi menambah kompleksitas query di semua domain; hard delete lebih pragmatis untuk MVP.

---
