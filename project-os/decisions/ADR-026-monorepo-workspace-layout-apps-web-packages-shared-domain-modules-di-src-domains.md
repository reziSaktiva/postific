## Decision ADR-026

### Title

Monorepo Workspace Layout — apps/web, packages/shared, domain modules di src/domains/

### Status

Accepted

### Date

2026-07-15

### Decision

Monorepo menggunakan layout berikut:

- **`apps/web`** — satu-satunya aplikasi MVP (Next.js, `@social/web`).
- **`packages/shared`** — shared types lintas domain (`@social/shared`): branded IDs, enums, value objects.
- **Domain modules di `src/domains/`** dalam apps/web — bukan workspace package terpisah.
- **Repository implementations di `src/lib/repositories/`** — dipisahkan dari domain folder.
- **App Router routing menggunakan `[slug]`** sebagai workspace dynamic segment.

Workspace dikonfigurasi via Bun Workspaces di root `package.json` dengan `"workspaces": ["apps/*", "packages/*"]`.

Detail lengkap: `product-discovery/06-engineering/monorepo-setup.md`.

### Reason

- Satu app (`apps/web`) sesuai Modular Monolith — tidak ada alasan memisahkan domain sebelum ada kebutuhan nyata.
- Domain modules di `src/domains/` (bukan package terpisah) mengurangi indirection tanpa kehilangan modularitas di fase MVP.
- Repository di `src/lib/` menjaga domain tetap pure — hanya tahu interface, bukan implementasi infrastruktur.
- `[slug]` di routing selaras dengan keputusan Middleware workspace context resolution (ADR-024, auth-architecture.md).
- `@social/shared` hanya untuk types yang genuinely cross-domain — mencegah shared menjadi junk drawer.

### Alternatives Considered

- Domain sebagai workspace packages (`packages/publishing`, `packages/workspace`, dst.) — premature separation untuk MVP single-app; menambah build complexity tanpa benefit nyata.
- Repository implementation di dalam domain folder — mencampur domain logic dengan infrastruktur; melanggar dependency direction.
- Query param `?workspace=slug` untuk workspace routing — kurang bersih, tidak selaras dengan URL-as-source-of-truth dari auth architecture.

---
