## Decision ADR-034

### Title

DX Tooling — ESLint + Prettier, Lefthook + lint-staged, Vitest

### Status

Accepted

### Date

2026-07-17

### Decision

- **Lint/format:** ESLint + Prettier (dengan `eslint-config-prettier`), konfigurasi monorepo di root.
- **Pre-commit:** Lefthook + lint-staged — lint/format pada file staged saja; bukan full test suite.
- **Test runner:** Vitest, dipanggil via `bun run test` (gate CI-D02).
- **Scripts root:** kontrak seragam `typecheck`, `lint`, `format`, `test`, `db:generate`, `db:migrate`, `db:deploy` selaras CI dan local setup.

Detail lengkap: `product-discovery/06-engineering/dx-tooling.md` (DX-D01 s/d DX-D05).

### Reason

- ESLint + Prettier punya ekosistem plugin Next/React paling matang dan sudah menjadi acuan implisit di dokumen M6 sebelumnya.
- Lefthook ringan dan cocok alur Bun; memberi feedback sebelum CI tanpa menjalankan suite penuh.
- Vitest menyediakan mock/coverage yang lebih kaya untuk domain tests di Modular Monolith.

### Alternatives Considered

- Biome — all-in-one dan cepat; dikesampingkan demi ekosistem ESLint/Prettier yang dipilih eksplisit.
- Oxlint + Prettier — lint cepat, tetapi ekosistem rule Next kurang lengkap dibanding ESLint.
- Husky + lint-staged — valid, lebih banyak boilerplate.
- Tanpa pre-commit (hanya CI) — feedback lebih lambat.
- Bun test — lebih native, ekosistem assertion/mock lebih tipis untuk kebutuhan domain testing.

---
