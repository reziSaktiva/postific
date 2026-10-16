## Decision ADR-084

### Title

Swap Warna Sidebar ↔ Konten AppShell (Light Mode Saja) via CSS Selector Ter-scope — Bukan `defineTheme` Component Override

### Status

Accepted — Reverted by ADR-086 (2026-08-21)

### Date

2026-08-20

### Context

King Rezi meminta swap warna background AppShell untuk **light mode saja**
(dark mode sengaja tidak disentuh):

1. Sidebar (`.astryx-app-shell-sidenav`): dari abu (`#f1f1f1`) → **putih**
   (`#ffffff`).
2. Area konten utama (semua halaman workspace-scoped: Home, Publish/Queue/
   Calendar/Drafts/History, Engage, Analyze, Settings): dari putih
   (`#ffffff`) → **abu** (`#f1f1f1`).
3. Dark mode tidak berubah sama sekali — shell/sidenav tetap `#1b1b1b`,
   konten tetap `#262626`.

Investigasi menemukan jalur resmi yang biasa dipakai project untuk kasus
seperti ini (`apps/web/.claude/CLAUDE.md`: "Tokens for every value...
Brand/accent belongs in the theme via `astryx theme add`/`astryx theme
template`", lewat `defineTheme({ components: {...} })`) **tidak aman**
dipakai di sini: elemen yang warnanya perlu diubah —
`.astryx-app-shell-sidenav` untuk sidebar, dan `.astryx-layout-content`
(dari komponen generik `Layout`/`LayoutContent` Astryx) untuk konten — bukan
elemen yang unik untuk AppShell. Component key `LayoutContent` yang sama
persis dipakai ulang di dalam **seluruh dialog** aplikasi ini: Cancel
Schedule (Queue), Transfer Ownership & Hapus Workspace (Settings >
General), Invite Member (Settings > Members), dan Draft Editor Modal.
Override lewat `defineTheme({ components: { 'layout-content': {...} } })`
akan otomatis ikut mengubah warna area konten di semua dialog itu juga —
melanggar instruksi eksplisit King Rezi ("pertahankan warna yang lain,
kecuali kontras rusak baru boleh, itu pun tetap perlu persetujuan").

Semua dialog di aplikasi ini dirender via elemen native `<dialog>`
(dikonfirmasi lewat inspeksi DOM langsung), sehingga secara struktural bisa
dibedakan dari `LayoutContent` milik AppShell lewat selector CSS murni.

### Decision

1. Warna diterapkan lewat blok `@layer components` baru di
   `apps/web/src/app/globals.css` (akhir file), memakai **CSS selector
   ter-scope presisi ke slot AppShell**, bukan `defineTheme` component
   override:

   ```css
   @layer components {
     .astryx-app-shell[data-variant="elevated"],
     .astryx-app-shell-sidenav[data-variant="elevated"] {
       background-color: light-dark(#ffffff, #1b1b1b);
     }

     .astryx-app-shell[data-variant="elevated"]
       > .astryx-layout.fill
       .astryx-layout-content:not(dialog .astryx-layout-content) {
       background-color: light-dark(#f1f1f1, #262626);
     }
   }
   ```

2. Exclusion `:not(dialog .astryx-layout-content)` memastikan `LayoutContent`
   di dalam elemen native `<dialog>` manapun (Cancel Schedule, Transfer
   Ownership, Hapus Workspace, Invite Member, Draft Editor Modal) **tidak**
   ikut ter-match — warna dialog-dialog itu tidak berubah sama sekali.
3. Nilai `light-dark(<light>, <dark>)` dipakai supaya dark mode eksplisit
   dipertahankan identik dengan nilai lama (`#1b1b1b` shell, `#262626`
   konten) di selector yang sama — bukan cuma "tidak disentuh" secara
   kebetulan.
4. Semua nilai HEX yang dipakai (`#ffffff`, `#f1f1f1`, `#1b1b1b`,
   `#262626`) adalah nilai yang **sudah ada** di theme Astryx — diverifikasi
   lewat _computed style_ browser langsung terhadap elemen yang berjalan,
   bukan dikutip dari tabel `astryx docs tokens` (ditemukan nilainya beda
   dari built theme yang sebenarnya jalan di aplikasi). Tidak ada warna
   baru/brand baru yang diperkenalkan.
5. Pendekatan "selector CSS ter-scope ke data-attribute/class Astryx"
   ini sah menurut dokumentasi resmi Astryx sendiri (`astryx docs styling`
   → section "Preferred Selector Surface: Data Attributes") — **bukan**
   swizzle (dilarang ADR-041) dan **bukan** StyleX/`xstyle` (sudah dihapus
   total, ADR-082), tapi juga bukan token/component override
   `defineTheme` yang lazim, karena target itu justru terlalu luas (ikut
   mengenai seluruh dialog).
6. **Urutan kerja sekali-pakai:** implementasi ditulis lebih dulu, baru
   dokumentasi (ADR ini + `PROJECT_STATE.md`/`COMPLETE_TASK.md`) menyusul
   setelah verifikasi visual King Rezi selesai — dibalik dari urutan
   standar rule 17 `AGENTS.md` (cek Claude Design dulu sebelum kode).
   **Ini keputusan sekali-pakai untuk task ad-hoc ini saja**, King Rezi
   eksplisit menyatakan bukan perubahan proses permanen — rule 17 tetap
   berlaku penuh untuk task UI lain berikutnya. Sinkronisasi ke Claude
   Design (Neymar Product Designer) menyusul sebagai next step terpisah,
   di luar cakupan dokumentasi sesi ini.

### Reason

- `defineTheme` component override untuk `layout-content` akan mengubah
  warna konten di seluruh dialog aplikasi (regresi visual yang eksplisit
  dilarang King Rezi), sehingga bukan pilihan yang tepat sasaran meski itu
  jalur "resmi" yang biasa dipakai.
- Selector CSS ter-scope + exclusion `:not(dialog ...)` mencapai target
  presisi (hanya slot AppShell) tanpa menyentuh mekanisme lain (tidak
  swizzle, tidak StyleX/`xstyle`, tidak menambah dependency baru) dan tetap
  sesuai pola resmi Astryx untuk styling berbasis selector.
- Nilai warna diverifikasi dari computed style nyata (bukan dokumentasi
  statis yang ternyata sudah tidak akurat) untuk memastikan tidak ada
  penyimpangan dari theme yang sesungguhnya berjalan.

### Alternatives Considered

- **`defineTheme({ components: { 'layout-content': {...} } })`** —
  ditolak; target terlalu luas, ikut mengubah warna konten seluruh dialog
  (Cancel Schedule, Transfer Ownership, Hapus Workspace, Invite Member,
  Draft Editor Modal).
- **Swizzle komponen `Layout`/`LayoutContent`** — ditolak; dilarang
  eksplisit oleh ADR-041 pada tahap ini, dan opsi ini sudah tertutup lebih
  jauh sejak StyleX/`xstyle` dihapus (ADR-082, swizzle butuh compiler
  StyleX yang sama).
- **Menunggu Claude Design disinkronkan dulu sebelum implementasi** —
  ditolak untuk task spesifik ini atas permintaan eksplisit King Rezi
  (lihat poin 6 Decision); tetap berlaku sebagai default untuk task
  lain, tidak diubah sebagai preseden permanen.

### Impact / Baseline yang diamandemen

- `apps/web/src/app/globals.css` — 1 blok `@layer components` baru
  ditambahkan di akhir file (kutipan lengkap di section Decision poin 1).
  Tidak ada perubahan token/theme Astryx, tidak ada dependency baru.
- Tidak ada baseline `product-discovery/` (04-ux, 05-architecture,
  06-engineering) yang diamandemen — ini murni keputusan implementasi
  teknis styling, bukan perubahan fungsi/alur produk.
- Verifikasi: browser (light mode Queue + Settings; dialog Hapus Workspace
  dicek eksplisit tidak berubah; dark mode dicek identik sebelum/sesudah).
  Tidak ada Vitest/`tsc`/`eslint` tambahan yang relevan — perubahan murni
  CSS, tidak menyentuh logic/TypeScript.
- Sinkronisasi ke Claude Design (project "Social Media Management", via
  `DesignSync`) **sudah selesai** — 3 baris di `styles.css` (dipakai bersama
  oleh semua template screen: `.app-shell` & `.sidebar` dari
  `--color-background-body` → `--color-background-surface`, `.main`
  ditambah `background: var(--color-background-body)` eksplisit yang
  sebelumnya implisit lewat `.app-shell`). Dikerjakan langsung oleh main
  agent (bukan Neymar Product Designer) karena tool `DesignSync` saat itu
  tidak ter-load di sesi subagent — keterbatasan ini sudah dicatat di
  `.claude/agents/README.md`. Dialog/Card (`--color-background-card`) tidak
  disentuh, tetap putih, konsisten dengan kode nyata.

---
