## Decision ADR-017

### Title

Application Layer — Repository Pattern

### Status

Accepted — Amended by ADR-031 (2026-07-17)

### Date

2026-07-15

### Decision

Setiap domain module menggunakan **Repository Pattern eksplisit**:

- Interface repository didefinisikan di dalam domain module.
- Implementasi menggunakan **Prisma** (ORM formal — ADR-031). Versi awal keputusan menyebut Supabase client; diganti oleh ADR-031.
- Satu repository per Aggregate Root.
- Application Service hanya berinteraksi dengan database melalui repository — tidak langsung akses Prisma client atau Supabase client.
- Supabase client tetap dipakai di luar repository CRUD untuk **Realtime** dan **Storage** (lihat ADR-031).

### Reason

- Selaras dengan DDD dan Modular Monolith architecture.
- Domain logic dapat di-unit-test tanpa setup database.
- Batas dependency antar layer menjadi eksplisit dan mudah ditelusuri.

### Alternatives Considered

- Langsung akses Supabase client di Application Service — lebih simple, tapi coupling tinggi dan sulit di-test.

---
