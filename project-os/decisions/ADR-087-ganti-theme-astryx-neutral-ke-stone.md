## Decision ADR-087

### Title

Ganti Theme Astryx dari Neutral ke Stone ("Warm Stone and Slate Tones; Montserrat + Figtree Type")

### Status

Accepted

### Date

2026-08-21

### Context

Sejak ADR-041, project ini memakai `@astryxdesign/theme-neutral` sebagai
theme Astryx selama fase M8 ("neutral theme selama M8" — dicatat eksplisit
di `AGENTS.md` § Stack & layout). King Rezi meminta **secara eksplisit**
mengganti theme dari Neutral ke **Stone** ("Warm stone and slate tones;
Montserrat + Figtree type" — deskripsi resmi dari `astryx docs theme`). Ini
bukan temuan bug atau hasil audit teknis — murni preferensi visual King
Rezi.

King Rezi juga meminta eksplisit: proses perubahan ini **sekarang**, tapi
**jangan sentuh Claude Design dulu** — fokus hanya ke code dan dokumentasi.
Artinya rule 17 `AGENTS.md` (wajib cek Claude Design sebelum implementasi
UI/UX) **sengaja dilewati** untuk task ini atas instruksi eksplisit King
Rezi sendiri, bukan kelalaian AI — dicatat di sini supaya jelas alasannya
kalau ditemukan di audit berikutnya.

### Decision

1. Theme Astryx project diganti dari `@astryxdesign/theme-neutral` ke
   `@astryxdesign/theme-stone` (versi `0.4.3`, sama seperti versi
   `@astryxdesign/core`/`@astryxdesign/cli` yang sudah ter-pin di
   `apps/web`).
2. Perubahan kode (sudah diterapkan & diverifikasi di sesi terpisah sebelum
   ADR ini ditulis — computed style browser menunjukkan
   `data-astryx-theme="stone"`, font heading/body sudah Montserrat/Figtree,
   dan `bun run build` production build hijau tanpa error untuk seluruh 30
   route):
   - `apps/web/package.json` — field `"astryx": { "theme": ... }` diubah
     dari `"@astryxdesign/theme-neutral"` ke `"@astryxdesign/theme-stone"`;
     dependency `@astryxdesign/theme-neutral` dihapus (`bun remove`),
     diganti `@astryxdesign/theme-stone` versi `0.4.3`.
   - `apps/web/src/app/globals.css` — `@import
"@astryxdesign/theme-neutral/theme.css";` diganti `@import
"@astryxdesign/theme-stone/theme.css";`.
   - `apps/web/src/components/Providers.tsx` — import `neutralTheme` dari
     `@astryxdesign/theme-neutral/built` diganti `stoneTheme` dari
     `@astryxdesign/theme-stone/built`; pemakaian `<Theme mode={mode}
theme={neutralTheme}>` diganti `<Theme mode={mode}
theme={stoneTheme}>`.
   - Dikonfirmasi tidak ada sisa referensi `theme-neutral`/`neutralTheme`
     di `apps/web/src` maupun `package.json` (grep bersih).
3. Rule 17 `AGENTS.md` (gate Claude Design sebelum implementasi UI/UX)
   **sengaja dilewati** untuk task ini atas instruksi eksplisit King Rezi.
   Item ini ditandai **terbuka** — lihat section Open Item di bawah.

### Reason

- Permintaan eksplisit King Rezi, murni preferensi visual (bukan bug,
  bukan temuan audit) — tidak memerlukan justifikasi teknis tambahan.
- Theme Stone adalah theme resmi Astryx (bukan custom token buatan
  sendiri), sehingga tetap konsisten dengan ADR-041 (Astryx sebagai
  fondasi komponen permanen) dan ADR-057 (tidak ada designer eksternal,
  token visual mengikuti apa yang disediakan Astryx/Claude Design).
- Rule 17 dilewati atas instruksi eksplisit — King Rezi meminta proses
  code + dokumentasi dulu, sinkronisasi Claude Design menyusul terpisah.
  Ini konsisten dengan pola pengecualian sekali-pakai yang pernah dicatat
  di ADR-084 (urutan implementasi-dulu-dokumentasi-menyusul untuk task
  ad-hoc, bukan preseden permanen untuk task lain).

### Alternatives Considered

- **Menunda perubahan kode sampai Claude Design disinkronkan lebih dulu**
  (mengikuti rule 17 apa adanya) — ditolak; King Rezi eksplisit meminta
  code + dokumentasi diproses dulu, Claude Design menyusul terpisah.
- **Mengubah token warna secara manual tanpa ganti theme package** —
  ditolak; Astryx menyediakan theme resmi (Stone) yang sudah mencakup
  palet warna + font pairing (Montserrat + Figtree) secara konsisten,
  mengarang token manual akan melanggar ADR-041/ADR-057.

### Impact / Baseline yang diamandemen

- `AGENTS.md` § Stack & layout — baris "neutral theme selama M8" diganti
  "Stone theme", merujuk ADR-087 ini.
- `context/ctx-technical-context.md` — baris "Astryx — neutral theme
  selama M8" diganti menjadi Stone theme + rujukan ADR-087.
- `context/ctx-design.md` — baris yang menyebut "gunakan neutral theme
  Astryx" dan penjelasan Light/Dark Mode Toggle terkait
  `@astryxdesign/theme-neutral` (ADR-055) disesuaikan ke Stone theme;
  makna kalimat asli (toggle dark mode bukan pelanggaran theme karena
  hanya expose mekanisme bawaan, bukan tema/token baru) tidak berubah.
- `apps/web/package.json`, `apps/web/src/app/globals.css`,
  `apps/web/src/components/Providers.tsx` — sudah diubah di sesi
  terpisah (lihat Decision poin 2), tidak diubah ulang di sesi
  dokumentasi ini.
- Tidak ada baseline `product-discovery/` (04-ux, 05-architecture,
  06-engineering) yang diamandemen — perubahan ini murni ganti theme
  package Astryx, bukan perubahan IA/flow/component contract.
- Verifikasi kode: computed style browser (`data-astryx-theme="stone"`,
  font Montserrat/Figtree) + `bun run build` hijau untuk 30 route, sudah
  dilakukan di sesi terpisah sebelum ADR ini ditulis.

### Open Item (belum selesai)

**Claude Design (project "Social Media Management") belum disinkronkan
dengan theme Stone ini** — seluruh KSP (Key Screen Pattern) dan App
Prototype di Claude Design masih merepresentasikan visual theme Neutral
lama (warna, font Montserrat/Figtree belum diterapkan di mockup). Ini
**item terbuka**, sengaja ditunda atas instruksi eksplisit King Rezi
(lihat Context di atas), perlu ditindaklanjuti sebagai langkah terpisah —
kemungkinan lewat Neymar Product Designer. Jangan anggap task ini selesai
penuh sampai item ini ditutup.

---
