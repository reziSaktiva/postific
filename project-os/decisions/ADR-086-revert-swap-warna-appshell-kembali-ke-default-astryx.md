## Decision ADR-086

### Title

Revert Total Swap Warna AppShell — Kembali ke Default `neutralTheme` Astryx Murni (Membatalkan ADR-084)

### Status

Accepted

### Date

2026-08-21

### Context

ADR-084 (2026-08-20) sebelumnya memperkenalkan 1 blok `@layer components` di
`apps/web/src/app/globals.css` yang menukar warna AppShell untuk light mode
saja: sidebar (`.astryx-app-shell-sidenav`) dari abu (`#f1f1f1`) → putih, dan
area konten utama (`.astryx-layout-content` di luar dialog) dari putih →
abu (`#f1f1f1`). Dark mode tidak disentuh.

King Rezi sedang melakukan **audit menyeluruh terhadap seluruh override
warna custom** di project ini (preseden terdekat: pembatalan pola
`Section > Card` di Settings pada hari yang sama, lihat ADR-085) dan
memutuskan AppShell **tidak perlu kustomisasi warna apapun** — kembali murni
ke default `neutralTheme` bawaan Astryx. Ini bukan revisi kecil terhadap
ADR-084, melainkan pembatalan penuh substansinya: sidebar kembali abu-abu,
konten kembali putih di light mode, persis seperti sebelum ADR-084 dibuat.

Berbeda dari kasus ADR-085/086 versi lama (yang dihapus total karena baru
seumur jagung dan belum jadi preseden di tempat lain), ADR-084 sudah
berjalan lebih dari sehari dan sudah dikutip di beberapa dokumen lain
(`PROJECT_STATE.md`, `.claude/agents/README.md`, `ADR-085` — lihat section
Impact di bawah untuk daftar lengkap yang disesuaikan). Karena sudah jadi
rujukan, ADR-084 **tidak dihapus** — mengikuti pola append-only project ini,
pembatalan dicatat sebagai ADR baru dan status ADR-084 di index
`DECISIONS.md` ditandai "Reverted by ADR-086", bukan dihapus/diedit.

### Decision

1. Seluruh blok `@layer components` yang ditambahkan ADR-084 di
   `apps/web/src/app/globals.css` (2 rule CSS: selector shell/sidenav dan
   selector layout-content, beserta comment penjelasannya) **dihapus
   total**. File `globals.css` sekarang hanya berisi `@layer` declaration,
   `@import`, `@theme inline` font vars, dan style `body { font-family:
... }` — tidak ada override warna AppShell apapun.
2. AppShell kembali ke behavior default `neutralTheme` Astryx sepenuhnya:
   sidebar abu-abu, konten putih di light mode (sama seperti sebelum
   ADR-084 dibuat); dark mode tidak berubah (memang tidak pernah disentuh
   ADR-084).
3. Body ADR-084 **tidak diedit** — tetap utuh sebagai jejak historis
   keputusan yang pernah berlaku. Hanya kolom `Status` di baris index
   `DECISIONS.md` yang diubah menjadi
   `Accepted — Reverted by ADR-086 (2026-08-21)`.
4. Perubahan kode (`apps/web/src/app/globals.css`) sudah diterapkan dan
   diverifikasi visual (browser, light mode dan dark mode) di sesi
   terpisah sebelum ADR ini ditulis — tidak ada regresi ditemukan.

### Reason

- King Rezi memutuskan project ini tidak memerlukan override warna custom
  apapun di luar theme default Astryx — konsisten dengan keputusan
  pembatalan `Section > Card` (ADR-085) pada hari yang sama, keduanya bagian
  dari audit menyeluruh terhadap kustomisasi visual yang menyimpang dari
  default Astryx.
- Mengembalikan ke default mengurangi permukaan CSS custom yang perlu
  dijaga tetap sinkron dengan setiap upgrade Astryx (`.astryx-app-shell`,
  `.astryx-layout-content` adalah selector internal Astryx yang bisa
  berubah antar versi — ADR-084 sendiri sudah mencatat risiko ini secara
  implisit lewat kebutuhan verifikasi computed style manual).
- ADR-084 tidak dihapus (berbeda dari ADR-085/086 versi lama) karena sudah
  dikutip sebagai preseden/rujukan di dokumen lain — menghapusnya akan
  meninggalkan referensi rusak dan kehilangan jejak historis kenapa pola
  itu pernah dicoba.

### Alternatives Considered

- **Mengedit isi ADR-084 langsung untuk mencerminkan revert** — ditolak;
  melanggar aturan Append-Only `DECISIONS.md` (`PROJECT_RULES.md`), yang
  hanya mengizinkan perubahan pada kolom `Status`, bukan isi keputusan.
- **Menghapus ADR-084 total seperti kasus ADR-085/086 versi lama** —
  ditolak; ADR-084 sudah lebih dari sehari dan sudah jadi rujukan di
  `PROJECT_STATE.md`, `.claude/agents/README.md`, dan body `ADR-085` —
  berbeda dari ADR-085/086 versi lama yang baru dibuat hari yang sama dan
  belum dikutip di tempat lain.

### Impact / Baseline yang diamandemen

- `apps/web/src/app/globals.css` — blok `@layer components` dari ADR-084
  dihapus total. Tidak ada perubahan token/theme Astryx, tidak ada
  dependency baru/dihapus.
- `project-os/DECISIONS.md` — baris index `ADR-084` diubah kolom
  `Status` menjadi `Accepted — Reverted by ADR-086 (2026-08-21)`, mengikuti
  pola "Amended by" yang sudah ada untuk ADR lain di file yang sama.
- `project-os/decisions/ADR-084-swap-warna-appshell-light-mode-css-selector-scoped-bukan-defineTheme.md`
  — header `### Status` diubah menjadi
  `Accepted — Reverted by ADR-086 (2026-08-21)`. Isi body lainnya (Context,
  Decision, Reason, Alternatives, Impact) **tidak diedit** sama sekali.
- `project-os/PROJECT_STATE.md` — bullet "Swap warna sidebar ↔ konten
  AppShell" di section Completed dan Recent Decisions dikoreksi/ditandai
  reverted supaya tidak menyesatkan pembaca yang mengira state itu masih
  berlaku saat ini.
- Tidak ada baseline `product-discovery/` (04-ux, 05-architecture,
  06-engineering) yang diamandemen — ADR-084 sendiri sudah mencatat bahwa
  tidak ada baseline produk yang disentuh; revert ini pun murni CSS.
- Verifikasi: browser (light mode dan dark mode), dilakukan di sesi
  terpisah sebelum ADR ini ditulis, tidak ada regresi.

---
