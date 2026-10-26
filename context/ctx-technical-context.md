# Context — Technical Context

Indeks **stack & infrastruktur**: runtime, ORM, auth config, env, deploy, CI, dependency.  
Bukan tempat pola folder domain atau aturan gaya kode (itu `ctx-implementation` / `ctx-development`).

---

## Baca dulu

| Dokumen                                                                                            | Topik                                                                                                                                 |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [`../product-discovery/06-engineering/README.md`](../product-discovery/06-engineering/README.md)   | Indeks Engineering Baseline v1.0 (ADR-036)                                                                                            |
| [`monorepo-setup.md`](../product-discovery/06-engineering/monorepo-setup.md)                       | Layout Hybrid Monorepo, Bun workspaces                                                                                                |
| [`database-orm.md`](../product-discovery/06-engineering/database-orm.md)                           | Prisma 7, migrate, pooling, batas Supabase client (ADR-031)                                                                           |
| [`auth-strategy.md`](../product-discovery/06-engineering/auth-strategy.md)                         | Better Auth, Google OAuth, JWT Realtime (ADR-030)                                                                                     |
| [`environment-management.md`](../product-discovery/06-engineering/environment-management.md)       | Env vars, secrets, local menumpang project staging (ADR-033, amandemen ADR-081)                                                       |
| [`deployment-infrastructure.md`](../product-discovery/06-engineering/deployment-infrastructure.md) | Railway + Supabase SEA (ADR-028, ADR-029)                                                                                             |
| [`cicd-pipeline.md`](../product-discovery/06-engineering/cicd-pipeline.md)                         | GitHub Actions gates, Railway CD (ADR-032)                                                                                            |
| [`dependency-strategy.md`](../product-discovery/06-engineering/dependency-strategy.md)             | Caret default, lockfile, `@postific/shared` (ADR-035); pengecualian exact pin Astryx Beta superseded oleh migrasi shadcn/ui (ADR-097) |
| [`design-tokens.md`](../product-discovery/06-engineering/design-tokens.md)                         | SoT visual tokens — co-equal dengan artifact desain, dikunci iteratif tanpa menunggu designer eksternal (ADR-038, ADR-140, ADR-057)   |

Implementasi di repo:

| Path                            | Peran                             |
| ------------------------------- | --------------------------------- |
| `apps/web/`                     | Next.js App Router                |
| `apps/web/prisma/schema.prisma` | Schema Prisma                     |
| `apps/web/prisma.config.ts`     | Migrate URL (`DIRECT_URL`)        |
| `apps/web/src/lib/prisma/`      | Prisma client singleton + adapter |
| `apps/web/src/lib/better-auth/` | Auth server                       |
| `apps/web/src/lib/env.ts`       | Env fail-fast                     |
| `apps/web/.env.example`         | Katalog env (EM-D04)              |
| `packages/shared/`              | Shared types                      |
| `.github/workflows/ci.yml`      | CI gates                          |

---

## Stack (ingat cepat)

| Area                    | Pilihan                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime / PM            | Bun                                                                                                                                                                                                                                                                                                                          |
| App                     | Next.js (`apps/web`)                                                                                                                                                                                                                                                                                                         |
| Auth                    | Better Auth (email/password + Google)                                                                                                                                                                                                                                                                                        |
| ORM                     | Prisma **7.x** — migrate via `DIRECT_URL`, runtime via `@prisma/adapter-pg` + `DATABASE_URL`                                                                                                                                                                                                                                 |
| DB / Storage / Realtime | Supabase                                                                                                                                                                                                                                                                                                                     |
| Social API              | Outstand (via ACL — lihat `ctx-architecture`)                                                                                                                                                                                                                                                                                |
| Deploy                  | Railway (web + cron)                                                                                                                                                                                                                                                                                                         |
| CI                      | GitHub Actions                                                                                                                                                                                                                                                                                                               |
| UI Components           | shadcn/ui — fondasi permanen (ADR-097, membalik ADR-041); Stone theme token (ADR-087) sebagai acuan; Light/Dark Mode Toggle fitur resmi (ADR-055, diamandemen ADR-097); migrasi dari Astryx ke shadcn/ui selesai (ADR-097) — detail status lihat `PROJECT_STATE.md` / `../project-os/tickets/v07-astryx-shadcn-migration.md` |
| Styling                 | Tailwind CSS — styling langsung komponen shadcn (bukan lagi layout-only, ADR-097)                                                                                                                                                                                                                                            |

---

## Aturan operasional

1. Env lokal: `apps/web/.env.local` (dari `.env.example`) — **jangan commit**.
2. Supabase JS: **hanya** Realtime + Storage. CRUD lewat Prisma.
3. Prisma 7: jangan mengasumsikan pola v6 (URL di schema saja); ikuti `database-orm.md` + `prisma.config.ts`.
4. Dependency: ikut `dependency-strategy.md` — shared package tanpa business
   logic; shadcn/ui adalah kode sumber yang di-copy ke repo (ADR-097), tidak
   ada isu exact pin/Beta seperti Astryx sebelumnya.
5. CI wajib: install → prisma generate/validate → typecheck → lint → test.
6. Email transactional memakai Resend (ADR-126, AS-D04). Jangan menambah provider lain. Katalog env ada di `environment-management.md` (T-005.2). Wiring Better Auth masih T-005.3–.5.
7. Jangan ubah Engineering Baseline tanpa ADR.
8. Design tokens: SoT di `design-tokens.md`, co-equal dengan artifact desain
   (folder `design/` sudah dihapus dan tidak dibuat ulang, ADR-045, ADR-057
   — tidak ada designer eksternal, permanen). Gunakan Stone theme (ADR-087)
   sebagai acuan nilai token, dipetakan ke CSS variable shadcn/ui
   (ADR-097), dan jangan hardcode custom brand hex. Nilai final di-lock
   iteratif kapan pun stabil (ADR-056), bukan menunggu event "designer
   masuk". Light/Dark Mode Toggle (ADR-055, diamandemen ADR-097) tetap
   berjalan di atas token Stone theme (ADR-087) — bukan tema/token baru,
   mekanismenya lewat Tailwind `dark:` + shadcn theme provider.
9. Outstand/X (**ADR-040**): Project Owner mengatur BYOK X secara manual di
   dashboard Outstand. Jangan menambah env var, form, tabel, atau secret store
   aplikasi untuk Client ID/Client Secret X.
10. Media publishing: Supabase Storage menyimpan original; Outstand Media API
    menyimpan working copy setelah alur upload URL → `PUT` → confirm. Jangan
    menganggap signed URL Supabase sebagai URL publish Outstand.
11. Kompatibilitas tool Claude Code ↔ Cursor (ADR-064) — lihat tabel di bawah.

---

## Kompatibilitas tool: Claude Code ↔ Cursor (ADR-064)

Project ini dikerjakan di **dua tool**: Claude Code (utama) dan Cursor.
Sebagian aset agent terbaca di keduanya, sebagian tidak:

| Aset                                   | Claude Code                                     | Cursor                                            |
| -------------------------------------- | ----------------------------------------------- | ------------------------------------------------- |
| `AGENTS.md` (pintu masuk + hard rules) | ✅ via `CLAUDE.md`                              | ✅ native                                         |
| `.claude/skills/`                      | ✅ satu-satunya lokasi                          | ✅ compatibility path                             |
| `.claude/agents/` (7 subagent kerja)   | ✅                                              | ✅ compatibility path                             |
| Config MCP (`xds` Astryx)              | ✅ `.mcp.json`                                  | ⚠️ `.cursor/mcp.json` — **file terpisah**         |
| Proteksi baca secret                   | ✅ `.claude/settings.json` (`permissions.deny`) | ⚠️ `.cursorignore` — **file terpisah**            |
| `.claude/launch.json` (preview server) | ✅                                              | ❌ tidak ada padanan — jalankan dev server manual |

**Dua pasang file kembar yang WAJIB dijaga sinkron.** Config MCP dan proteksi
secret tidak punya jalur kompatibilitas lintas tool — masing-masing tool
hanya membaca formatnya sendiri, dan tidak bisa disatukan lewat symlink tanpa
mengulang pola rapuh yang dibuang di ADR-064. Konsekuensinya:

1. Menambah/mengubah MCP server → ubah **`.mcp.json` dan `.cursor/mcp.json`**
   dalam perubahan yang sama. Formatnya identik (kunci `mcpServers`).
2. Menambah/mengubah pola file rahasia → ubah **`permissions.deny` di
   `.claude/settings.json` dan `.cursorignore`** dalam perubahan yang sama.
   Kalau hanya satu yang diubah, salah satu tool kehilangan proteksinya
   tanpa peringatan apa pun.

Aturan lain (skill, subagent, hard rules, alur dokumentasi) berlaku identik di
kedua tool — tidak ada instruksi khusus per-tool selain tabel di atas.

---

## Related context

- Arsitektur sistem → `ctx-architecture.md`
- Script, lint, konvensi coding → `ctx-development.md`
- Pola fitur di kode → `ctx-implementation.md`
