# CI/CD Pipeline

Dokumen ini mendefinisikan **pipeline Continuous Integration dan Continuous Deployment** untuk produk Postific: tooling CI, trigger, quality gates, alur promosi kode, dan kapan migrasi database dijalankan.

Dokumen ini menkonkretkan trigger deploy dari `deployment-infrastructure.md` (DI-D05) dan alur migrasi dari `database-orm.md` (DO-D03). Detail perintah lint/format/test ditetapkan di `dx-tooling.md` (ESLint + Prettier + Vitest, ADR-034); dokumen ini menetapkan **apa yang wajib lulus di CI**, bukan konfigurasi tool-nya.

---

# Tujuan

* Menetapkan tooling CI/CD secara definitif sebelum Repository & Bootstrap (M7).
* Memastikan kode tidak masuk ke `staging` / `main` tanpa melewati quality gates.
* Menyelaraskan CI dengan deploy otomatis Railway (DI-D05).
* Menetapkan kapan dan di mana `prisma migrate deploy` dijalankan.
* Mendefinisikan alur promosi fitur → staging → production untuk solo developer.

---

# Keputusan yang Sudah Terkunci (dari Baseline)

| Topik | Keputusan | Sumber |
|-------|-----------|--------|
| Deploy platform | Railway | pra-architecture, ADR-029 |
| Deploy trigger | Push `staging` → staging; push `main` → production | DI-D05 |
| Runtime / package manager | Bun | ADR-002 |
| Monorepo | Hybrid — build dari root, unit deploy `apps/web` | ADR-026 |
| Migrasi skema | Prisma Migrate; staging dulu lalu production | DO-D03, DI-D03 |
| Rollback app | Redeploy deployment Railway sebelumnya | DI-D06 |

---

# Keputusan CI/CD (Ditetapkan di Dokumen Ini)

| ID | Topik | Keputusan |
|----|-------|-----------|
| CI-D01 | CI tooling | **GitHub Actions** — workflow di `.github/workflows/` |
| CI-D02 | Quality gates (PR) | Wajib lulus sebelum merge: **install → prisma generate → prisma validate → typecheck → lint → test** |
| CI-D03 | Branch & promosi | `feature/*` → PR ke `staging` → verifikasi → PR `staging` ke `main` |
| CI-D04 | CD (deploy) | Tetap **Railway auto-deploy** dari branch (bukan deploy dari GitHub Actions) |
| CI-D05 | Migrasi DB | `prisma migrate deploy` di **Railway release/pre-start** per environment (`DIRECT_URL`) — bukan di job PR |
| CI-D06 | Secrets di CI | PR CI **tidak** membutuhkan secret produksi; secret DB/migrate hanya di Railway (dan opsional mirror staging di GitHub Secrets jika nanti ada job migrate terpisah) |

---

# Pipeline Overview

```
┌──────────────┐     PR + CI gates      ┌──────────┐     Railway      ┌─────────────┐
│ feature/*    │ ────────────────────►  │ staging  │ ───────────────► │ Staging env │
└──────────────┘                        └────┬─────┘   migrate+web   └─────────────┘
                                             │
                                             │ PR + CI gates
                                             ▼
                                        ┌──────────┐     Railway      ┌─────────────┐
                                        │   main   │ ───────────────► │ Production  │
                                        └──────────┘   migrate+web   └─────────────┘
```

1. **CI (GitHub Actions)** — memvalidasi kualitas pada setiap Pull Request menuju `staging` atau `main`.
2. **Merge** — hanya setelah gates hijau (branch protection).
3. **CD (Railway)** — push ke branch environment memicu build & deploy `web` + `cron`.
4. **Migrate** — sebelum aplikasi baru melayani traffic, Railway menjalankan `prisma migrate deploy` terhadap project Supabase environment tersebut.

---

# Continuous Integration — GitHub Actions (CI-D01, CI-D02)

## Trigger

| Event | Branch target | Tujuan |
|-------|---------------|--------|
| `pull_request` | `staging`, `main` | Quality gates sebelum merge |
| `push` (opsional) | `staging`, `main` | Re-run gates setelah merge (visibility); **bukan** pengganti Railway deploy |

Deploy aplikasi **tidak** dipicu dari GitHub Actions (CI-D04).

## Jobs & Gates (MVP)

Satu workflow utama (mis. `ci.yml`) dengan steps berurutan:

| Step | Perintah (acuan) | Gagal = blokir merge |
|------|------------------|----------------------|
| Checkout | `actions/checkout` | ya |
| Setup Bun | versi selaras ADR-002 / M7 | ya |
| Install | `bun install --frozen-lockfile` di root | ya |
| Prisma generate | `bunx prisma generate` (di `apps/web`) | ya |
| Prisma validate | `bunx prisma validate` | ya |
| Typecheck | `bun run typecheck` | ya |
| Lint | `bun run lint` — detail rule di `dx-tooling.md` | ya |
| Test | `bun run test` — unit/domain tests; boleh suite minimal di awal M8 | ya |

**Di luar scope MVP CI:**
- E2E browser (Playwright/Cypress) — post-MVP atau ditambah saat fitur kritis stabil.
- Deploy preview Railway per-PR — ditolak di ADR-029.
- `prisma migrate deploy` terhadap staging/prod dari job PR — terlalu berbahaya dan tidak perlu (CI-D05).

## Branch Protection (disarankan)

Pada `staging` dan `main`:
- Require PR sebelum merge.
- Require status check CI hijau.
- Tidak force-push ke `main` / `staging`.

Untuk solo developer, protection tetap berguna sebagai pengaman terhadap merge tidak sengaja dan sebagai dokumentasi living dari gates.

---

# Branch Strategy & Promosi (CI-D03)

| Branch | Peran |
|--------|--------|
| `feature/<nama>` atau `fix/<nama>` | Kerja harian; tidak auto-deploy ke Railway environment persisten |
| `staging` | Integrasi pra-rilis; auto-deploy ke Railway **staging** |
| `main` | Produksi; auto-deploy ke Railway **production** |

**Alur rilis MVP:**

```
1. Kerjakan di feature/*
2. Buka PR → staging
3. CI gates harus hijau → merge
4. Railway staging deploy + prisma migrate deploy (staging DIRECT_URL)
5. Verifikasi manual di staging (smoke: login, alur kritis)
6. Buka PR staging → main
7. CI gates hijau → merge
8. Railway production deploy + prisma migrate deploy (production DIRECT_URL)
```

Hotfix darurat: boleh branch dari `main`, PR langsung ke `main` **hanya** jika perubahan kecil dan sudah diverifikasi; migrasi breaking tetap harus expand-and-contract (DI-D06).

---

# Continuous Deployment — Railway (CI-D04)

Selaras DI-D05 — tidak diulang sebagai keputusan baru:

| Branch | Railway environment | Services |
|--------|---------------------|----------|
| `staging` | staging | `web` + `cron` |
| `main` | production | `web` + `cron` |

Build notes monorepo (install di root, start `apps/web`) tetap mengikuti `deployment-infrastructure.md`.

**Pemisahan tanggung jawab:**
- GitHub Actions = **kualitas kode**.
- Railway = **build artefak + jalankan service + migrasi DB environment**.

---

# Database Migration di Pipeline (CI-D05)

## Di mana migrate dijalankan

`prisma migrate deploy` dijalankan sebagai **langkah release / pre-start** pada service `web` di Railway (setiap environment memakai `DIRECT_URL`-nya sendiri).

Contoh urutan start (acuan M7):

```bash
bunx prisma migrate deploy   # membutuhkan DIRECT_URL
bun run --cwd apps/web start
```

Atau setara Railway Release Command jika dipisah dari Start Command.

## Apa yang tidak dilakukan

| Anti-pattern | Alasan |
|--------------|--------|
| Migrate dari job PR | PR belum tentu di-merge; risiko menulis ke DB bersama dari fork/branch eksperimental |
| Migrate hanya manual lewat laptop ke production | Rawan terlupa; tidak reproducible |
| `prisma migrate reset` di staging/prod bersama | Menghapus data |

## Urutan aman dengan dua environment

1. Migration file sudah ada di Git (hasil `migrate dev` lokal).
2. Merge ke `staging` → Railway staging menjalankan `migrate deploy` → verifikasi.
3. Merge ke `main` → Railway production menjalankan `migrate deploy`.

Ini mengejawantahkan alur di `database-orm.md` langkah 4–7.

---

# Secrets & Environment (CI-D06)

| Lokasi | Isi | Dipakai untuk |
|--------|-----|----------------|
| GitHub Actions (PR CI) | Tidak wajib secret app/DB untuk MVP gates | typecheck/lint/test/validate bersifat lokal di runner |
| Railway staging | Seluruh env staging (`DATABASE_URL`, `DIRECT_URL`, auth, Outstand, …) | runtime + migrate staging |
| Railway production | Seluruh env production | runtime + migrate production |

Detail katalog env var: `environment-management.md`.  
CI tidak menjadi tempat menyimpan `SUPABASE_SERVICE_ROLE_KEY` atau `DIRECT_URL` production.

Jika di masa depan ditambah job “migrate-only” di GitHub Actions, secret harus di-scope per environment dan job hanya jalan pada `push` ke branch terkait — bukan pada `pull_request` dari fork.

---

# Failure & Rollback di Pipeline

| Kegagalan | Tindakan |
|-----------|----------|
| CI merah di PR | Jangan merge; perbaiki di feature branch |
| Build Railway gagal | Deployment baru tidak menggantikan yang sehat (Railway); perbaiki dan push ulang |
| `migrate deploy` gagal | App start dihentikan; perbaiki migration (forward-fix), jangan reset DB bersama |
| App buruk setelah deploy sukses | Rollback app via redeploy Railway sebelumnya (DI-D06); pastikan skema tetap compatible (expand-and-contract) |

---

# Artefak yang Diharapkan di M7

Saat Repository & Bootstrap:

* `.github/workflows/ci.yml` — gates CI-D02.
* Branch protection rules pada `staging` dan `main`.
* Railway: mapping branch → environment; Release/Start command mencakup `prisma migrate deploy`.
* Script root `package.json`: `typecheck`, `lint`, `test` (isi konkret di `dx-tooling.md`).

---

# Decision Log

| ID | Keputusan | Alasan | Alternatif |
|----|-----------|--------|-----------|
| CI-D01 | GitHub Actions sebagai CI | Native ke GitHub, cukup untuk monorepo Bun, tanpa platform CI tambahan | Railway CI saja (gates lemah sebelum merge); CircleCI/other (overhead untuk solo MVP) |
| CI-D02 | Gates: install, prisma generate/validate, typecheck, lint, test | Menangkap error tipe/skema/style sebelum masuk branch deploy | Hanya typecheck (terlalu longgar); wajib E2E di setiap PR (berat untuk MVP) |
| CI-D03 | Promosi feature → staging → main | Staging sebagai mirror uji (DI-D02) sebelum production | Langsung feature → main (mengorbankan tempat uji aman) |
| CI-D04 | CD tetap di Railway auto-deploy | Sudah dikunci DI-D05; hindari dua sistem deploy | Deploy dari GitHub Actions ke Railway API (duplikasi kontrol) |
| CI-D05 | `migrate deploy` di Railway release/pre-start | Migrate terikat environment yang sama dengan kode yang di-deploy; staging dulu lalu prod | Migrate di GitHub Actions (perlu secret DB di GitHub); migrate manual |
| CI-D06 | Secret sensitif tidak di PR CI | Minimalkan blast radius; Railway sudah punya env per environment | Mirror semua secret ke GitHub Secrets sejak MVP |

---

# Related Documents

* `README.md` — scope dan workflow Engineering Planning
* `deployment-infrastructure.md` — DI-D05 deploy trigger, Railway services, rollback
* `database-orm.md` — Prisma Migrate, `DIRECT_URL`, alur staging → production
* `environment-management.md` — katalog env vars & secrets (ADR-033)
* `dx-tooling.md` — perintah lint/format/test konkret (ADR-034)
* `monorepo-setup.md` — scripts root workspace
* `../../project-manager/DECISIONS.md` — ADR-029, ADR-032
