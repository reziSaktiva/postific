# DX Tooling

Dokumen ini mendefinisikan **tooling Developer Experience** untuk produk Postific: linting, formatting, pre-commit hooks, test runner, script workspace, dan alur local development.

Dokumen ini menkonkretkan perintah yang disebut di `cicd-pipeline.md` (`bun run lint`, `bun run test`, `bun run typecheck`) dan melengkapi script root di `monorepo-setup.md`. Env lokal mengikuti `environment-management.md`.

---

# Tujuan

* Menetapkan stack lint/format secara definitif sebelum Repository & Bootstrap (M7).
* Memastikan quality gates CI dan feedback lokal memakai perintah yang sama.
* Menetapkan pre-commit hook yang cepat tanpa menghambat alur solo developer.
* Menetapkan test runner untuk gate `bun run test`.
* Mendefinisikan checklist local setup yang selaras monorepo Bun + Next.js + Prisma.

---

# Keputusan yang Sudah Terkunci (dari Baseline)

| Topik | Keputusan | Sumber |
|-------|-----------|--------|
| Runtime / package manager | Bun | ADR-002 |
| Monorepo | Hybrid — root scripts, app di `apps/web` | ADR-026 |
| CI gates | install → prisma → typecheck → lint → test | CI-D02, ADR-032 |
| Local DB | Supabase Cloud, menumpang project staging + `.env.local` | EM-D02, EM-D03, ADR-081 |
| TypeScript | Base `tsconfig` di root | `monorepo-setup.md` |

---

# Keputusan DX Tooling (Ditetapkan di Dokumen Ini)

| ID | Topik | Keputusan |
|----|-------|-----------|
| DX-D01 | Lint + format | **ESLint** (lint) + **Prettier** (format) — config monorepo di root |
| DX-D02 | Pre-commit | **Lefthook** + **lint-staged** — jalankan lint/format hanya pada file staged |
| DX-D03 | Test runner | **Vitest** — unit/domain tests; dipanggil via `bun run test` |
| DX-D04 | Script root | Seragam: `dev`, `build`, `typecheck`, `lint`, `lint:fix`, `format`, `format:check`, `test`, `test:watch`, `db:generate`, `db:migrate`, `db:deploy` |
| DX-D05 | Editor | Format on save Prettier + ESLint fix disarankan; bukan wajib di CI selain perintah eksplisit |
| DX-D06 | Vitest config | `vitest.config.ts` di **root** |
| DX-D07 | Lefthook install | Script root `prepare` → `lefthook install` |

---

# Lint & Format (DX-D01)

## Stack

| Tool | Peran |
|------|-------|
| ESLint | Static analysis TypeScript/React/Next — error & warning kualitas kode |
| Prettier | Formatting (indent, quotes, line width, import sorting bila dikonfigurasi) |
| `eslint-config-prettier` | Mematikan rule ESLint yang bentrok dengan Prettier |

## Scope

* Lint/format mencakup `apps/web` dan `packages/shared`.
* Abaikan artefak build: `.next/`, `dist/`, `coverage/`, `node_modules/`.
* Rule set MVP: preset TypeScript + React Hooks + Next.js yang relevan; hindari rule set terlalu ketat yang menghambat bootstrap — boleh diperketat bertahap.

## Perintah

| Script | Perintah (acuan) | Dipakai di |
|--------|------------------|------------|
| `lint` | ESLint seluruh workspace sumber | CI (wajib), lokal, pre-commit (staged) |
| `lint:fix` | ESLint `--fix` | Lokal saja |
| `format` | Prettier `--write` | Lokal, pre-commit (staged) |
| `format:check` | Prettier `--check` | Opsional di CI nanti; MVP CI mengandalkan lint + konsistensi via pre-commit |

CI MVP **wajib** menjalankan `bun run lint` (CI-D02). `format:check` boleh ditambahkan kemudian jika drift formatting muncul tanpa pre-commit.

## Konfigurasi (lokasi M7)

```
/
├── eslint.config.*          ← flat config monorepo (atau .eslintrc.* jika diperlukan)
├── .prettierrc / prettier.config.*
├── .prettierignore
├── lefthook.yml
└── package.json             ← script + lint-staged config
```

Dependency tooling monorepo-level di-install di **root** (selaras `monorepo-setup.md`).

---

# Pre-commit Hooks (DX-D02)

## Stack

| Tool | Peran |
|------|-------|
| Lefthook | Menjalankan git hooks; cepat, config YAML, cocok Bun |
| lint-staged | Membatasi ESLint/Prettier ke file yang di-stage |

## Perilaku MVP

Pada `pre-commit`:

1. `lint-staged` menjalankan Prettier + ESLint (fix aman bila memungkinkan) pada file staged yang relevan (`*.{ts,tsx,js,jsx,json,md}` — sesuaikan di M7).
2. Hook gagal → commit ditolak sampai diperbaiki.
3. **Tidak** menjalankan full test suite atau `prisma migrate` di pre-commit (terlalu lambat); test tetap di CI + lokal on-demand.

## Install hook

Setelah clone: `bun install` menjalankan script `prepare` di root (`lefthook install`). Alternatif manual: `bunx lefthook install`.

Solo developer tetap diuntungkan: mencegah commit format/lint yang akan gagal di CI.

---

# Test Runner (DX-D03)

## Stack

| Aspek | Keputusan |
|-------|-----------|
| Runner | **Vitest** |
| Fokus MVP | Unit/domain tests (entities, services murni, helpers) |
| Environment | Node/Bun-compatible via Vitest; mock I/O (Prisma, Outstand, Better Auth) |
| Coverage | Opsional di MVP; tidak menjadi gate CI awal |
| E2E | Di luar scope MVP CI (`cicd-pipeline.md`) |

## Perintah

| Script | Peran |
|--------|-------|
| `test` | `vitest run` — CI & pre-push mental model |
| `test:watch` | `vitest` watch — lokal |

## Aturan tes

* Tes tidak membutuhkan secret production; mock dependency infrastruktur.
* Tes domain tidak mengimpor implementasi repository konkret jika bisa di-mock lewat interface (selaras DDD).
* Suite boleh minimal di awal M8 — yang penting perintah `bun run test` ada dan hijau di CI.

Konfigurasi: `vitest.config.ts` di **root** monorepo (M7) — alias `@postific/shared` dan `@/` di-resolve dari satu tempat; suite mencakup `apps/web` dan `packages/shared`.

---

# Workspace Scripts (DX-D04)

Acuan root `package.json` (melengkapi `monorepo-setup.md`):

```json
{
  "scripts": {
    "dev": "bun run --cwd apps/web dev",
    "build": "bun run --cwd apps/web build",
    "typecheck": "bun run --cwd apps/web typecheck",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "bun run --cwd apps/web db:generate",
    "db:migrate": "bun run --cwd apps/web db:migrate",
    "db:deploy": "bun run --cwd apps/web db:deploy"
  }
}
```

Mapping Prisma di `apps/web` (acuan):

| Script | Perintah |
|--------|----------|
| `db:generate` | `prisma generate` |
| `db:migrate` | `prisma migrate dev` — **hanya** terhadap project staging yang ditumpangi local (ADR-081), sesuai kredensial di `.env.local` |
| `db:deploy` | `prisma migrate deploy` — dipakai di Railway release; jarang dipanggil manual lokal |

Perintah persis (path binary `bunx prisma` vs script) difinalkan di M7; nama script di atas adalah kontrak untuk CI dan dokumentasi.

---

# Local Development Setup

Checklist setelah repo di-bootstrap (M7):

1. **Prasyarat:** Bun (versi selaras ADR-002), Git, akses Supabase Cloud, akun Google Cloud (OAuth).
2. **Clone & install:** `bun install` di root (frozen lockfile di CI; lokal biasa).
3. **Env:** salin `.env.example` → `.env.local`, isi kredensial project staging yang ditumpangi local (ADR-081, `environment-management.md`).
4. **Hooks:** pastikan Lefthook ter-install (`bunx lefthook install`).
5. **DB:** `bun run db:generate` → `bun run db:migrate`.
6. **Dev server:** `bun run dev` → `http://localhost:3000`.
7. **Verifikasi DX:** `bun run typecheck && bun run lint && bun run test`.

## Workflow harian

```
1. bun run dev                          ← coding
2. bun run test:watch                   ← saat ubah domain logic
3. git add … → pre-commit (lint-staged)
4. PR → staging → CI gates (typecheck, lint, test, prisma validate)
```

Jangan arahkan `.env.local` ke project staging/prod (EM-D02, EM-D06).

---

# Typecheck

* `bun run typecheck` tetap gate CI terpisah dari ESLint.
* `tsc --noEmit` (atau script Next) di `apps/web`; packages di-typecheck via project references atau path yang sama — detail `tsconfig` di `monorepo-setup.md`.

---

# Artefak yang Diharapkan di M7

* Config ESLint + Prettier di root (+ ignore files).
* `lefthook.yml` + konfigurasi lint-staged.
* `vitest.config.ts` + minimal smoke/unit test agar CI hijau.
* Script root sesuai tabel DX-D04.
* `.env.example` selaras katalog `environment-management.md`.
* Dokumentasi singkat setup di README root repo (bukan di folder discovery) saat bootstrap.

---

# Decision Log

| ID | Keputusan | Alasan | Alternatif |
|----|-----------|--------|-----------|
| DX-D01 | ESLint + Prettier | Ekosistem terbesar, plugin Next/React matang, sudah disebut sebagai acuan di dokumen M6 sebelumnya | Biome (all-in-one, lebih sederhana); Oxlint + Prettier |
| DX-D02 | Lefthook + lint-staged | Hook cepat, config ringan, cocok Bun; feedback sebelum CI | Husky + lint-staged (lebih banyak boilerplate); tanpa pre-commit (hanya CI) |
| DX-D03 | Vitest | API familiar, mock/coverage matang, monorepo-friendly | Bun test (lebih native, ekosistem assertion/mock lebih tipis) |
| DX-D04 | Script root seragam untuk CI & lokal | Satu kontrak perintah (`lint`/`test`/`typecheck`) | Script hanya di `apps/web` tanpa alias root |
| DX-D05 | Editor format-on-save disarankan, bukan digate ketat di awal | DX lokal tanpa memblokir bootstrap | Wajib `format:check` di setiap PR sejak hari pertama |
| DX-D06 | `vitest.config.ts` di root | Alias monorepo (`@postific/shared`, `@/`) satu sumber; CI memanggil `bun run test` dari root | Config hanya di `apps/web` |
| DX-D07 | Lefthook via `prepare` di root | Hook terpasang otomatis setelah `bun install` | Hanya dokumentasikan `bunx lefthook install` manual |

---

# Related Documents

* `README.md` — scope dan workflow Engineering Planning
* `monorepo-setup.md` — struktur workspace, `tsconfig`, aturan dependency root
* `cicd-pipeline.md` — gates yang memanggil script ini (CI-D02)
* `environment-management.md` — `.env.local`, local menumpang project staging (ADR-081)
* `database-orm.md` — Prisma generate/migrate di local
* `dependency-strategy.md` — versi eksternal, lockfile, penempatan dep (ADR-035)
* `../../project-manager/DECISIONS.md` — ADR-032, ADR-034, ADR-035
