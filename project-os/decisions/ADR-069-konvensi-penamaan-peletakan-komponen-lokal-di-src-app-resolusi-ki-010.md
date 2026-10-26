## Decision ADR-069

### Title

Konvensi Penamaan & Peletakan Komponen Lokal di `src/app/` (Resolusi KI-010) — Ganti Prefix Underscore dengan PascalCase-untuk-Component + LCA Placement

### Status

Accepted

### Date

2026-08-06

### Context

KI-010 (dicatat di `PROJECT_STATE.md` sejak review PR #42, 2026-08-05) mencatat
bahwa konvensi folder underscore-prefix (`_draft-editor`, `_sidebar-channels`)
di `apps/web/src/app/` — pola implisit yang diikuti sejak T-011.2 — belum
pernah ditulis sebagai konvensi resmi di baseline manapun. King Rezi eksplisit
menyatakan tidak nyaman dengan penamaan underscore-prefix tersebut.

Setelah diskusi, disepakati bahwa opsi yang diambil bukan mendokumentasikan
underscore-prefix apa adanya, melainkan mengganti konvensinya sekaligus.

### Decision

1. **Penamaan file** — hanya file yang meng-export React component memakai
   PascalCase, sama seperti nama exportnya (mis. `Modal.tsx`, bukan
   `modal.tsx`). File non-component (Server Action seperti `actions.ts`,
   helper/pure function seperti `status-badge.ts`, atau file berisi data map
   seperti `platform-icons.tsx`) tetap kebab-case — tidak ikut PascalCase.
2. **Penamaan folder** — seluruh folder tetap kebab-case sepenuhnya, tidak
   ada folder PascalCase. Folder yang sebelumnya memakai prefix underscore
   (`_draft-editor`, `_sidebar-channels`) kehilangan underscore-nya saja
   (`draft-editor`, `sidebar-channels`) — bukan berubah jadi PascalCase.
3. **Peletakan folder `components/`** — ditaruh pada lowest common ancestor
   (LCA) route App Router dari seluruh pemakai komponen tersebut:
   - Dipakai di 1 route saja → `components/` lokal tepat di route itu.
   - Dipakai lintas beberapa route dalam satu subtree → naik ke level route
     leluhur terendah yang mencakup semua pemakai.
   - Dipakai lintas subtree yang tidak berkaitan (termasuk dari
     `app/layout.tsx` root) → naik ke `src/components/`.
   - File wajib Next.js (`page.tsx`, `layout.tsx`, `route.ts`) tidak
     terpengaruh — tetap lowercase sesuai kontrak framework Next.js.
4. **Berlaku juga untuk `src/components/[feature]/`** — aturan penamaan yang
   sama (PascalCase untuk file component, kebab-case untuk folder & file
   non-component) berlaku di sana, bukan hanya untuk `components/` di dalam
   `src/app/`.

### Reason

- Underscore-prefix folder (`_draft-editor`) valid secara teknis di Next.js
  App Router (opt-out dari routing), tapi King Rezi menilainya kurang jelas
  membedakan "ini folder khusus" vs konvensi umum penamaan komponen di
  ekosistem React (PascalCase untuk component).
- Memisahkan aturan file-component (PascalCase) dari folder (tetap
  kebab-case) menghindari ambiguitas: folder tidak pernah PascalCase,
  sehingga tidak ada risiko folder disalahartikan sebagai nama komponen atau
  sebaliknya.
- Aturan peletakan berbasis LCA route memberi kriteria objektif untuk
  memutuskan folder `components/` ditaruh di level mana — menghindari
  duplikasi komponen antar route atau penumpukan semua komponen di root
  `app/` tanpa alasan.

### Alternatives Considered

- **Dokumentasikan underscore-prefix apa adanya sebagai konvensi resmi**
  (opsi awal KI-010). Ditolak — King Rezi eksplisit tidak nyaman dengan
  penamaan ini, bukan sekadar minta didokumentasikan.
- **Folder ikut PascalCase juga** (`DraftEditor/` bukan `draft-editor/`).
  Ditolak — akan menciptakan dua gaya folder berbeda dalam satu tree
  (domain module tetap kebab-case per ADR-026), memecah konsistensi
  penamaan folder di seluruh repo.
- **Satu folder `components/` tunggal di `app/` root untuk semua komponen
  lokal** (tanpa aturan LCA). Ditolak — untuk komponen yang benar-benar
  lokal ke satu route, menaikkan semuanya ke root menjauhkan komponen dari
  konteks pemakaiannya dan menyulitkan penelusuran.

### Impact / Baseline yang diamandemen

- `product-discovery/06-engineering/monorepo-setup.md` — section baru
  "Penamaan & peletakan folder `components/` lokal (KI-010)" di bawah
  `## src/app/ — App Router Structure`, plus update rujukan di
  `## src/components/ — UI Components`.
- `context/ctx-development.md` — item baru di "Naming & file" (poin 13).
- `context/ctx-implementation.md` — bullet baru di "## UI Components
  (ADR-041)".

### Catatan implementasi

- Migrasi kode sudah selesai untuk seluruh komponen colocated di
  `apps/web/src/app/` — bukan hanya `_draft-editor`/`_sidebar-channels`,
  tapi juga auth forms, onboarding form, workspace-side-nav,
  publish-tabbar, drafts-list, dan `providers.tsx`. Contoh:
  `app/[slug]/_draft-editor/*` → `app/[slug]/components/draft-editor/*`,
  `app/providers.tsx` → `src/components/Providers.tsx` (LCA-nya seluruh
  app, jadi masuk lokasi shared yang sudah ada, bukan folder baru di
  `app/`).
- Direview Ridwan Architecture Reviewer — PASS, tanpa temuan pelanggaran
  hard rules (entry point tetap tanpa business logic, tidak ada import
  baru yang melanggar domain logic, cross-domain tetap lewat barrel
  `index.ts`).
- Di-QA Najwa QA Engineer — PASS: typecheck/lint/test hijau, browser E2E
  (sidebar Channels + drag-reorder, Draft Editor modal, Save as Draft,
  `/publish/drafts` DraftsList + Status Badge, Edit Draft) semua berjalan
  normal tanpa regresi.
- KI-010 ditutup dengan status `Resolved`, merujuk ADR ini.

---
