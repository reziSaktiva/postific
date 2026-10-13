## Decision ADR-124

### Title

Nama Produk Final: **Postific** — Rename Package Scope `@social/*` →
`@postific/*`, Hapus Label "(Working Title)"

### Status

Accepted

### Date

2026-10-09

### Decision

King Rezi memutuskan nama produk final: **Postific** (bukan lagi "Social
Media Management (Working Title)"). Keputusan diambil langsung oleh King
Rezi (bukan hasil brainstorm AI) — sesi ini hanya mengeksekusi penerapan.

Scope penerapan (dikonfirmasi King Rezi via `AskUserQuestion`):

1. **Kode & identifier teknis** — package scope `@social/*` di-rename
 total jadi `@postific/*`:
 - `package.json` root: `"name": "social-media-management"` →
 `"postific"`.
 - `apps/web/package.json`: `"name": "@social/web"` → `"@postific/web"`;
 dependency `"@social/shared": "workspace:*"` →
 `"@postific/shared": "workspace:*"`.
 - `packages/shared/package.json`: `"name": "@social/shared"` →
 `"@postific/shared"`.
 - Seluruh import `@social/shared` di `apps/web/src/**/*.ts(x)` (±150
 file) + alias `apps/web/tsconfig.json` + `vitest.config.ts` +
 `eslint-rules/local-rules.test.ts` + string literal di
 `apps/web/src/app/api/health/route.ts`.
 - `bun.lock` di-regenerate via `bun install` (bukan diedit manual).
 - Diverifikasi: `bun run typecheck` PASS, `bun run test` PASS (649
 passed / 6 skipped).
2. **Dokumentasi current-state / baseline** — seluruh referensi nama
 produk sebagai **proper noun** (bukan kategori/industri generik) di
 `README.md`, `AGENTS.md` (judul saja), `project-manager/
 PROJECT_OVERVIEW.md` (field "Project Name", hapus label
 `*(Working Title)*`), `project-manager/ARCHITECTURE_OVERVIEW.md`, dan
 seluruh `product-discovery/**` diganti "Postific". Referensi `@social/
 shared`/`@social/web` di dokumentasi baseline teknis
 (`monorepo-setup.md`, `dependency-strategy.md`, `domain-model.md`,
 `ctx-development.md`, `ctx-technical-context.md`, `06-engineering/
 README.md`, `dx-tooling.md`) ikut di-rename jadi `@postific/*`.
3. **SENGAJA TIDAK diubah** (di luar scope file-edit, berisiko
 memutus/mengaburkan referensi ke sistem lain atau sejarah):
 - **Historical records** — isi badan `project-manager/decisions/
 ADR-*.md` (ADR lama) dan `project-manager/COMPLETE_TASK.md` dibiarkan
 memakai nama/istilah lama apa adanya (append-only, bukan ditulis
 ulang) supaya catatan sejarah tetap akurat terhadap kondisi saat
 keputusan itu dibuat.
 - **Nama kategori/industri generik** — frasa seperti "platform Social
 Media Management", "tool Social Media Management", "kategori Social
 Media Management" (mis. di `competitor-analysis.md`,
 `discovery-plan.md`, beberapa baris `product-vision.md`/
 `product-scope.md`) merujuk ke **kategori produk di market**, bukan
 nama produk kita — dibiarkan apa adanya supaya makna kalimat tidak
 rusak.
 - **Project Claude Design** (`DesignSync`, projectId
 `84aded99-bb23-49b1-be9f-dd8f21c6873e`) masih **literal** bernama
 "Social Media Management" di sistem eksternal itu — belum di-rename
 di Claude Design itu sendiri, sehingga seluruh referensi ke project
 Claude Design (`AGENTS.md` rule 17, `context/ctx-design.md`,
 `project-manager/PROJECT_STATE.md`, `project-manager/tasks/
 v01-foundation.md`/`v02-publishing-mvp.md`/
 `v07-astryx-shadcn-migration.md`, `product-discovery/06-engineering/
 design-tokens.md`) sengaja TIDAK diubah — mengubahnya di teks tanpa
 me-rename project aslinya di Claude Design akan membuat dokumentasi
 tidak sinkron dengan kenyataan.
 - **Resource eksternal lain** yang nama literalnya masih
 "social-media-management": repo GitHub
 (`github.com/reziSaktiva/social-media-management`, seluruh link PR
 historis tetap valid dan tidak disentuh), project Railway staging,
 dan folder clone lokal di disk. Rename resource-resource ini
 (kalau King Rezi mau) adalah tindakan terpisah di luar text-edit
 (butuh akses langsung ke GitHub/Railway/filesystem) — direkomendasikan
 dilakukan terpisah, bukan bagian task ini.

### Context

Sebelumnya produk ini hanya punya *working title* "Social Media
Management" (identik dengan nama folder repo) — belum pernah ada nama
brand final. King Rezi memutuskan nama final "Postific" tanpa proses
brainstorming (sudah punya nama di kepala sebelum sesi ini).

### Consequences

- Seluruh dokumentasi baseline (`product-discovery/**`,
 `PROJECT_OVERVIEW.md`, `ARCHITECTURE_OVERVIEW.md`, `README.md`,
 `AGENTS.md`) + kode (`package.json` × 3, import `@social/shared` →
 `@postific/shared` di seluruh `apps/web/src`) konsisten memakai
 "Postific" / `@postific/*` sejak ADR ini.
- ADR lama & `COMPLETE_TASK.md` tetap menyebut nama lama di badan teks —
 ini BUKAN inkonsistensi, melainkan catatan sejarah yang disengaja tidak
 ditulis ulang (lihat poin 3 di atas).
- 4 resource eksternal (GitHub repo, Railway project, Claude Design
 project, folder lokal) masih memakai nama lama — perlu keputusan/aksi
 terpisah dari King Rezi kalau ingin disamakan juga.
