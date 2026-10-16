## Decision ADR-031

### Title

Database Access — Prisma sebagai ORM Formal (Amandemen ADR-017)

### Status

Accepted

### Date

2026-07-17

### Decision

**Prisma** ditetapkan sebagai **ORM formal** untuk akses data domain:

- Repository implementations memakai **Prisma Client** (bukan Supabase JS client untuk CRUD).
- **Prisma Migrate** adalah tooling migrasi skema primer (menggantikan Supabase CLI sebagai sumber migrasi domain di catatan M5).
- **Supabase client** tetap dipakai hanya untuk **Supabase Realtime** (notifikasi in-app) dan **Supabase Storage** (media) — di luar repository CRUD.
- Better Auth terhubung ke PostgreSQL melalui **Prisma adapter** / driver yang selaras dengan Prisma schema (tabel prefix `identity_`).
- Connection pooling memakai **Supabase Supavisor** (pooled URL untuk runtime aplikasi; direct URL untuk migrasi).

Detail lengkap: `product-discovery/06-engineering/database-orm.md` (DO-D01 s/d DO-D06).

Keputusan ini **mengamandemen ADR-017** pada bagian implementasi repository.

### Reason

- Mengembalikan keputusan stack yang sempat tercatat di Technical Overview (`ORM | Prisma`) dan prinsip portabilitas (akses DB lewat ORM; Supabase sebagai platform managed).
- Type-safe query + migration workflow yang jelas untuk Modular Monolith + DDD.
- Memisahkan tanggung jawab: Prisma untuk persistence domain; Supabase client untuk fitur platform (Realtime, Storage) yang tidak digantikan ORM.

### Alternatives Considered

- Supabase client saja (tanpa ORM) — paling selaras teks awal ADR-017, tetapi melemahkan type-safety query dan portabilitas ORM yang sudah diinginkan sejak pra-architecture.
- Hybrid Drizzle + Supabase client — type-safe dan ringan, tetapi bukan pilihan yang sempat ditetapkan sebelumnya (Prisma).
- Prisma untuk semua termasuk Realtime/Storage — tidak feasible; Realtime dan Storage adalah API platform Supabase.

---
