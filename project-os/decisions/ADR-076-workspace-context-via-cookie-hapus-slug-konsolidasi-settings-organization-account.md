## Decision ADR-076

### Title

Workspace Context via Cookie (Hapus Dynamic Segment `[slug]`) + Konsolidasi Settings jadi "Organization" + "Account"

### Status

Accepted — Amended by ADR-077 (2026-08-11, mekanisme render Settings); Poin 4 Diamandemen oleh ADR-088 (2026-08-24)

### Date

2026-08-10

### Context

Baseline routing sebelumnya me-resolve workspace aktif dari dynamic segment
URL (`/dashboard/[workspaceSlug]/...`), dengan asumsi entry point-nya adalah
"Workspace Selector" — dropdown di puncak sidebar berisi daftar workspace,
opsi "Create New Workspace", dan link ke Workspace Settings
(`navigation-patterns.md` IA-D05/NP-D07 versi lama). Settings sendiri
terpecah jadi dua tempat terpisah: "Workspace Settings" (General, Connected
Accounts, Members, Roles & Permissions, Billing) dan "User Settings"
(Profile, Notifications, Preferences), masing-masing dengan entry point
sendiri.

Dua masalah nyata ditemukan:

1. **KI-023** (`PROJECT_STATE.md`) mencatat Workspace Selector yang
   didesain baseline sebagai satu-satunya entry point resmi ke Workspace
   Settings **tidak pernah dibangun** di kode — `WorkspaceSideNav.tsx` cuma
   heading statis tanpa dropdown/state apapun. Satu-satunya jalur nyata ke
   Workspace Settings dari UI utama cuma 2 deep-link kontekstual (badge
   channel bermasalah, link Reconnect di Draft Editor) — tidak ada jalur ke
   General/Members/Roles/Billing sama sekali kecuali mengetik URL langsung.
2. Referensi desain terbaru (screenshot yang dibagikan King Rezi) memakai
   pola satu halaman Settings dengan dua grup sidebar berlabel
   "Organization" dan "Account" — bukan dua destinasi terpisah dengan dua
   entry point.

King Rezi mengonfirmasi 3 keputusan lewat sesi klarifikasi (tercatat di
`project-os/CONVERSATIONS.md`, 2026-08-10):

1. Scope multi-workspace tidak berubah — user tetap efektif 1 workspace
   aktif pada MVP (`mvp-definition.md` tidak diubah, Multi Workspace
   Management tetap Out of Scope).
2. Hilangnya `[slug]` berlaku untuk **semua** route workspace-scoped (Home,
   Publish, Engage, Analyze, Start Page, Settings) — bukan cuma Settings.
3. Penamaan: "Workspace Settings" → **Organization Settings**, "User
   Settings" → **Account Settings**, konsisten dengan label sidebar
   "Organization"/"Account" di referensi desain.

Dua keputusan turunan (nama route group pengganti `[slug]`, dan nasib field
`Workspace.slug` di data model) diputuskan lewat `AskQuestion` pada sesi
yang sama sebelum 14 file baseline ditulis ulang — juga tercatat di
`CONVERSATIONS.md`.

### Decision

1. **Workspace context disimpan di cookie** `active-workspace-id`
   (HTTP-only), bukan di-resolve dari URL. Cookie tetap divalidasi ulang
   terhadap `workspace_members` oleh Middleware/`src/proxy.ts` di setiap
   request (bukan dipercaya mentah).
2. **Dynamic segment `[slug]` dihapus** dari App Router. Seluruh route
   workspace-scoped (Home, Publish, Engage, Analyze, Start Page, Settings)
   dipindah ke bawah route group baru **`(app)`** — pasangan idiomatis
   untuk `(auth)` (pre-login vs aplikasi utama pasca-login). Route group
   tidak muncul di URL (konvensi Next.js standar).
3. **Settings dikonsolidasi jadi satu section**, dua grup sidebar:
   **Organization** (General, Connected Accounts, Members, Roles &
   Permissions, Billing) dan **Account** (Profile, Notifications,
   Preferences). Satu-satunya entry point: avatar/user menu — menggantikan
   baik Workspace Selector (yang tidak pernah dibangun, KI-023) maupun
   entry point User Settings yang terpisah sebelumnya.
4. **Diamandemen oleh ADR-088 (2026-08-24)** — lihat ADR-088 untuk switcher
   deliberate (halaman Settings → Account → Workspaces) yang menutup gap
   pada poin ini. Poin 4 asli di bawah tetap berlaku apa adanya untuk
   skenario cookie hilang; ADR-088 menambahkan mekanisme switch yang
   disengaja sebagai kasus terpisah, bukan menggantikan isi poin ini.

   **`/onboarding` menangani dua skenario**: user baru tanpa workspace
   (buat workspace pertama) dan user existing yang kehilangan cookie
   workspace aktif (tampilkan picker daftar workspace). Picker ini **bukan**
   fitur "Multi Workspace Management" — ia re-entry point saat cookie
   hilang, bukan UI switch-workspace permanen (`mvp-definition.md` tidak
   berubah).

5. **`Workspace.slug` dipertahankan** di data model sebagai internal unique
   identifier (kolom `workspaces.slug` + index tetap ada) — tidak dipakai
   di routing/URL, hanya referensi human-readable untuk
   log/debugging/support dan future-proofing kalau multi-workspace
   URL-based direvisit post-MVP.

### Reason

- Workspace Selector sebagai satu-satunya entry point ke Workspace
  Settings adalah premis yang gagal diimplementasikan (KI-023) — membangun
  dropdown penuh (daftar workspace + create workspace) untuk fitur yang
  scope-nya tetap 1 workspace efektif per user adalah kompleksitas tanpa
  manfaat nyata. Menghapus konsep ini dan menggantinya dengan entry point
  avatar tunggal menyelaraskan baseline dengan kebutuhan riil produk.
- Cookie-based workspace context menghilangkan ketergantungan pada struktur
  URL untuk sesuatu yang tidak pernah benar-benar di-switch oleh user
  (single effective workspace) — `[slug]` menambah kompleksitas routing
  (parsing, validasi, propagasi ke semua sub-route) tanpa nilai UX
  tambahan selama tidak ada switching antar workspace via URL.
- `(app)` dipilih sebagai nama route group karena pasangan idiomatis untuk
  `(auth)` yang sudah ada — konvensi Next.js yang umum, netral terhadap
  detail implementasi, tidak menyebut istilah "workspace" yang sudah tidak
  relevan di level URL.
- Konsolidasi Settings jadi satu section dua grup mengikuti referensi
  desain terbaru dan mengurangi jumlah entry point yang harus diingat user
  dari dua (Workspace Selector + User Menu) jadi satu (User Menu saja).
- `Workspace.slug` dipertahankan (bukan dihapus total) karena tetap
  berguna sebagai identifier human-readable di konteks non-URL
  (log/debugging/support), dan menghapusnya total menutup opsi
  memakainya lagi kalau multi-workspace URL-based direvisit post-MVP —
  biaya mempertahankan kolom yang sudah ada jauh lebih kecil dibanding
  biaya migrasi ulang kalau dibutuhkan lagi nanti.

### Alternatives Considered

- **Bangun Workspace Selector dropdown seperti didesain awal.** Ditolak —
  menambah scope implementasi (state daftar workspace, create workspace
  dari dropdown) untuk fitur yang secara sadar dibatasi 1 workspace efektif
  per user; premisnya sendiri sudah terbukti tidak pernah dieksekusi
  (KI-023).
- **Pertahankan `[slug]` di URL, cuma perbaiki Workspace Selector-nya.**
  Ditolak — tidak menyelesaikan akar masalah (kompleksitas routing untuk
  fitur switching yang tidak ada), dan tidak menyelaraskan Settings dengan
  referensi desain terbaru.
- **Query param `?workspace=slug` sebagai pengganti dynamic segment.**
  Ditolak — kurang bersih, tidak SEO-friendly, tidak menyelesaikan masalah
  Settings yang tetap terpisah.
- **Nama route group lain** seperti `(dashboard)`, `(workspace)`. Ditolak
  — kurang eksplisit menyandingkan `(auth)` dibanding `(app)`.
- **Hapus total field `Workspace.slug`.** Ditolak — lihat Reason di atas;
  biaya mempertahankan kolom yang sudah ada minimal, sedangkan menghapus
  menutup opsi pemakaian ulang di masa depan.

### Impact / Baseline yang diamandemen

- `product-discovery/05-architecture/auth-architecture.md` — Workspace
  Context, Workspace Context Resolution, Middleware Strategy, Onboarding
  Flow, AU-D03, tabel Error Handling Auth.
- `product-discovery/06-engineering/monorepo-setup.md` — App Router
  Structure diagram (route group `(app)`, folder `settings/account/*`),
  aturan routing, MS-D03.
- `product-discovery/06-engineering/auth-strategy.md` — tabel Workspace
  Context.
- `product-discovery/05-architecture/application-layer.md` — diagram
  Middleware, tabel `updateWorkspace`, contoh navigasi Calendar.
- `product-discovery/05-architecture/domain-model.md`,
  `product-discovery/05-architecture/database-strategy.md` — deskripsi
  field/kolom `slug` (dipertahankan sebagai internal identifier).
- `product-discovery/04-ux/information-architecture.md` — Secondary
  Navigation, section Settings (gabungan Organization + Account), IA-D05,
  Pemetaan Fitur ke Layar.
- `product-discovery/04-ux/navigation-patterns.md` — hapus section
  "Workspace Selector", gabung "User Settings" jadi "Settings", NP-D07,
  Ringkasan Pola, jumlah zona sidebar.
- `product-discovery/04-ux/key-screen-patterns.md` — KSP-08 rename & entry
  points.
- `product-discovery/04-ux/user-flows.md` — rename "Workspace Settings" →
  "Organization Settings" di UF-05 dan Alternate Path.
- `product-discovery/02-product/feature-modules.md`,
  `product-discovery/02-product/roles-permissions.md` — rename istilah.
- `context/ctx-architecture.md`, `context/ctx-design.md` — reword topik
  pointer.
- `project-os/CONVERSATIONS.md` — log 2 keputusan turunan (nama route
  group, nasib `Workspace.slug`).
- **Tidak berubah:** `product-discovery/02-product/mvp-definition.md` —
  Multi Workspace Management tetap Out of Scope, sesuai keputusan #1.

### Catatan implementasi

- **Baseline-only pada PR ini** ([#61](https://github.com/reziSaktiva/social-media-management/pull/61)) — kode `apps/web` **belum** dimigrasikan.
  Struktur route saat ini masih memakai `apps/web/src/app/[slug]/...` dan
  `apps/web/src/app/account/...` terpisah. Migrasi kode (hapus `[slug]`,
  buat route group `(app)`, gabung `settings/account/*`, ganti resolusi
  Middleware dari URL ke cookie `active-workspace-id`, bangun halaman
  `/onboarding` dengan picker) adalah task implementasi terpisah yang
  belum dibuatkan T-XXX — perlu ditambahkan ke `TASKS.md` sebelum
  dikerjakan.
- **KI-023** di `PROJECT_STATE.md` direvisi mengikuti ADR ini — premis
  "Workspace Selector belum pernah dibangun" sekarang sudah tidak relevan
  karena konsepnya dihapus dari baseline; gap yang tersisa adalah migrasi
  kode ke skema baru (route group `(app)`, cookie, Settings gabungan).
- Review internal terhadap PR #61 menemukan dan memperbaiki 5 inkonsistensi
  sebelum ADR ini dibuat: (1) 2 referensi `/dashboard` basi di
  `auth-architecture.md` yang kontradiktif dengan flow Onboarding baru
  (diperbaiki jadi redirect ke `/onboarding`); (2) Decision Log MS-D03
  memakai bahasa "superseded" yang melanggar aturan baseline "tulis
  seolah final dari awal" (direword tanpa jejak riwayat); (3) folder
  `settings/account/` tidak punya `page.tsx` di root-nya padahal aturan
  routing mewajibkannya (ditambahkan `page.tsx` default = Account →
  Profile, pola sama dengan Organization → General); (4) contoh navigasi
  di `application-layer.md` menulis nama route group `(app)` seolah bagian
  dari URL (diperbaiki jadi `/publish/calendar` polos); (5) `navigation-patterns.md` masih menyebut sidebar "dua zona vertikal" padahal sudah 4
  zona (CTA, tengah, Channels, bawah) sejak ADR-053/ADR-058 (dikoreksi).

---
