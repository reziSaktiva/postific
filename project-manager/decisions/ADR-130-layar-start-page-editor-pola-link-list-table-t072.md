## Decision ADR-130

### Title

Layar "Start Page → Page Editor" + pola Link List: Table tanpa header (T-072)

### Status

Accepted

### Date

2026-10-16

### Decision

Layar in-app **Start Page → Page Editor** (sesuai alur
`product-discovery/04-ux/information-architecture.md`: `Start Page → Page
Editor → Preview + Share`) dibuat sebagai `templates/start-page-editor.html`
di Claude Design (project "Postific") dan disambungkan ke nav item "Start
Page" di App Prototype (`AppPrototype.dc.html`, entry `SCREENS` baru
`{ key: 'start-page-editor', code: 'T-072' }`), menggantikan `href="#"`
yang sebelumnya tidak mengarah ke mana pun di 7 template yang punya sidebar
utama (`home.html`, `publish-calendar.html`, `publish-queue.html`,
`publish-drafts.html`, `publish-history.html`, `engage-inbox.html`,
`analyze-dashboard.html`).

Layar ini berisi 4 bagian:

1. **Profil Halaman** — Judul, Bio, Avatar (tanpa theme picker — field
   `theme` tetap `"default"`, T-073 "Theme configuration" eksplisit di luar
   scope, Should Have terpisah).
2. **Link List** — daftar tautan (label, url, status aktif, click count),
   drag-handle untuk reorder (reuse pola `.channel-drag` sidebar Channels),
   tombol tambah/edit/hapus per baris.
3. **Preview** — device frame mobile yang me-reuse langsung struktur
   `.sp-page`/`.sp-frame`/`.sp-b-*` dari `templates/start-page-option-b-card-stack.html`
   (LOCKED, ADR-129) — tanpa mengubah file itu, hanya dibungkus wrapper
   scoped baru.
4. **Share** — field URL publik (`postific.com/u/[slug]`, ADR-128) + tombol
   salin + toggle status Published/Unpublished (reuse pola `.settings-row`).

**Pola Link List dikunci: Table tanpa header** (wrapper rounded, baris rata)
— **LOCKED PATTERN** di `templates/start-page-editor.html`, bukan
`Item`/`ItemGroup` atau card-per-item gaya `.sp-b-link` publik.

**Catatan markup (penting untuk implementasi):** mockup di Claude Design
memakai composed `div` row (`.sp-link-row`, precedent `.queue-row`/
`.channel-row`), bukan tag `<table>` literal — karena tiap baris butuh drag
handle + beberapa kolom info + dua ikon aksi (lebih kaya dari sel tabel
polos). Di kode nyata, **literal shadcn `Table` tanpa `TableHeader`** atau
**composed `div` row** dianggap setara/sama-sama sah — syaratnya tetap tanpa
header kolom dan tanpa `Card` pembungkus terpisah per baris. Mark UI
Engineer bebas memilih salah satu tanpa perlu konfirmasi ulang.

### Reason

- Table tanpa header dipilih karena konsisten dengan pola "list yang
  dikelola user" yang sudah established di project ini (Drafts, Workspaces)
  — meminimalkan variasi pola shadcn untuk kasus yang secara fungsi mirip
  (CRUD list milik user, bukan daftar pilihan statis).
- Ada 2 pola alternatif yang valid secara teknis (`Item`/`ItemGroup` dan
  card-per-item meniru `.sp-b-link`) sehingga ini genuinely ambigu per gate
  T-103.2 (AGENTS.md rule 17) — Neymar Product Designer sengaja menulis
  pilihannya sebagai **tentatif** dan menahan diri untuk tidak mengunci
  sendiri, lalu King Rezi diminta memilih lewat `AskUserQuestion` sebelum
  dikunci final di ADR ini. Ini persis mekanisme yang gagal di
  KI-054/KI-055 (AI menebak pola yang ternyata bukan yang diinginkan) —
  di sini ditegakkan dengan benar: tidak ditebak, ditanya dulu.
- Preview me-reuse struktur Opsi B (bukan dibuat ulang) supaya editor dan
  tampilan publik tidak bisa divergen diam-diam — satu sumber kebenaran
  visual untuk bagian link-card publik.
- Theme Selector sengaja tidak dibangun penuh di layar ini — menghindari
  over-scoping T-072 (Link Management, Must Have) dengan T-073 (Theme
  configuration, Should Have, task terpisah dengan ADR/dependency sendiri).

### Alternatives Considered

- **`Item`/`ItemGroup`** — valid secara teknis (primitive shadcn generik
  untuk daftar vertikal dengan leading/trailing content), tidak dipilih
  karena King Rezi memilih konsistensi dengan pola list manajemen existing
  (Table) alih-alih variasi baru.
- **Card-per-item (gaya `.sp-b-link` publik)** — akan membuat editor dan
  preview publik terasa senada secara visual, tidak dipilih karena King
  Rezi memilih Table — kemungkinan untuk menjaga Link List tetap ringkas
  secara fungsi manajemen (bukan representasi visual publik).
- **Mengunci sendiri tanpa bertanya** (opsi yang DITOLAK sebagai proses,
  bukan sebagai pola) — eksplisit dihindari karena gate T-103.2 mewajibkan
  konfirmasi untuk pola ambigu seperti ini.

### Related

- ADR-128 — strategi routing publik `/u/[slug]`.
- ADR-129 — layout halaman publik Card Stack (Opsi B) yang di-reuse sebagai
  Preview di layar ini.
- `tasks/v06-start-page-mvp.md` § T-072 — task yang mengikuti keputusan ini.
- Claude Design, project "Postific" — `templates/start-page-editor.html`
  (LOCKED, Link List pattern), `templates/app-prototype/AppPrototype.dc.html`
  (wiring `SCREENS` + nav item "Start Page").
- `.claude/agents/README.md` § "Gate pola ambigu shadcn (T-103.2)".
