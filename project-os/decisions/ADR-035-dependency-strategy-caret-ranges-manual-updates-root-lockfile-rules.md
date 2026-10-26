## Decision ADR-035

### Title

Dependency Strategy — caret ranges, manual updates, root lockfile rules

### Status

Accepted — Amended by ADR-041 (2026-07-23)

### Date

2026-07-17

### Decision

- **Version ranges eksternal:** caret (`^x.y.z`) di `package.json`; resolusi tepat dikunci `bun.lockb`.
- **Update dependency:** manual (`bun update` / bump saat perlu); tanpa Renovate/Dependabot di MVP.
- **Lockfile:** satu `bun.lockb` di root, wajib di-commit; CI memakai `bun install --frozen-lockfile`.
- **Penempatan:** root = tooling monorepo; `apps/web` = runtime; `packages/shared` = tanpa runtime dependencies.
- **Shared packages:** MVP hanya `@social/shared`; package baru di `packages/` hanya dengan alasan kuat.
- **Tanpa Bun Catalog** di MVP.

Detail lengkap: `product-discovery/06-engineering/dependency-strategy.md` (DS-D01 s/d DS-D06).

### Reason

- Caret + lockfile memberi reproduksibilitas tanpa noise exact-pin untuk solo MVP.
- Update manual cocok skala solo; otomasi bisa ditambah nanti jika frekuensi update jadi beban.
- Penempatan dependency menegaskan boundary Hybrid Monorepo (ADR-026) dan mencegah shared menjadi junk drawer (MS-D04).

### Alternatives Considered

- Exact pin semua dependency — audit ketat, terlalu banyak PR bump untuk fase ini.
- Bun Catalog — berguna multi-package; overkill untuk `apps/web` + `@social/shared`.
- Dependabot / Renovate — valid pasca-MVP atau saat kolaborator bertambah.

---
