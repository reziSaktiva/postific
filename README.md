# Postific

Hybrid monorepo untuk platform Postific.

## Structure

```
apps/web          → Next.js app (@postific/web)
packages/shared   → Shared types (@postific/shared)
product-discovery → Product / architecture / engineering baselines
project-manager   → Project OS (state, decisions, rules)
design            → Design ops docs
```

## Prerequisites

- [Bun](https://bun.sh) (ADR-002)
- Git (untuk Lefthook pre-commit hooks)
- Project Supabase Cloud `social-media-local` (EM-D02) untuk develop lokal

## Setup

```bash
bun install
cp apps/web/.env.example apps/web/.env.local
# isi kredensial social-media-local + secrets di .env.local
bun run db:migrate
bun run dev
```

App: `http://localhost:3000`

## Scripts (root)

| Script                                             | Description              |
| -------------------------------------------------- | ------------------------ |
| `bun run dev`                                      | Start Next.js dev server |
| `bun run build`                                    | Production build         |
| `bun run start`                                    | Start production server  |
| `bun run typecheck`                                | TypeScript check         |
| `bun run lint` / `lint:fix`                        | ESLint                   |
| `bun run format` / `format:check`                  | Prettier                 |
| `bun run test` / `test:watch`                      | Vitest                   |
| `bun run db:generate` / `db:migrate` / `db:deploy` | Prisma                   |

## DX notes

- Pre-commit: Lefthook → lint-staged (ESLint + Prettier pada file staged di `apps/` & `packages/`)
- CI: `.github/workflows/ci.yml` (PR ke `staging` / `main`)
- Lint/format scope: kode app & shared; folder dokumentasi di-ignore Prettier
- Auth: Better Auth di `/api/auth/*`; DB via Prisma; Supabase client hanya Realtime/Storage

## Documentation

- AI agents (pintu masuk): `AGENTS.md`
- Project status: `project-manager/PROJECT_STATE.md`
- Engineering baseline: `product-discovery/06-engineering/`
- Monorepo layout: `product-discovery/06-engineering/monorepo-setup.md`
- AI Context: `context/` — indeks operasional agent (lihat `context/README.md`)
