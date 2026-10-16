## Decision ADR-010

### Title

Engineering Planning sebagai Fase Baru di Product Discovery

### Status

Accepted

### Date

2026-07-14

### Decision

Menambahkan folder `product-discovery/06-engineering/` sebagai fase baru dalam proses product discovery, yang mendokumentasikan seluruh keputusan teknis sebelum implementasi kode dimulai.

Fase ini mencakup:

- Monorepo structure dan workspace setup
- Deployment platform dan infrastructure (Railway, dsb.)
- Authentication strategy (Better Auth, dsb.)
- ORM dan database access layer (Prisma, dsb.)
- CI/CD pipeline dan workflow
- Environment management (local, staging, production)
- Package dan dependency strategy
- Developer experience tooling

Fase ini menjadi milestone baru: **M6 — Engineering Planning**, ditempatkan setelah M5 — System Architecture dan sebelum M7 — Repository & Bootstrap.

Milestone sebelumnya disesuaikan:

| Sebelum                     | Sesudah                     |
| --------------------------- | --------------------------- |
| M6 — Repository & Bootstrap | M7 — Repository & Bootstrap |
| M7 — Development            | M8 — Development            |
| M8 — Testing & Release      | M9 — Testing & Release      |

### Reason

- Keputusan teknis (auth library, ORM, deployment platform, CI/CD) berdampak besar terhadap arsitektur dan harus terdokumentasi sebelum implementasi.
- Mendokumentasikan keputusan teknis sebagai ADR mencegah inkonsistensi saat development dimulai.
- Engineering Planning menjadi jembatan antara System Architecture (konseptual) dan Repository & Bootstrap (implementasi awal).
- Selaras dengan prinsip project: Documentation First.

### Alternatives Considered

- Memasukkan keputusan teknis langsung ke dalam 05-architecture (tidak dipilih — scope arsitektur dan engineering berbeda)
- Mendokumentasikan keputusan teknis saat development berlangsung (tidak dipilih — melanggar Documentation First)

---
