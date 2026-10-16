## Decision ADR-051

### Title

Claude Design — Kebijakan Fidelitas Astryx (foundations + component library)

### Status

Accepted

### Date

2026-07-29

### Decision

Project Claude Design (`Social Media Management`, ADR-042) tidak lagi berisi
komponen/token buatan manual — setiap nilai visual (warna, radius, shadow,
spacing, ukuran, tipografi) di `foundations/` dan `components/` sekarang
disalin langsung dari `@astryxdesign/core@0.1.8` +
`@astryxdesign/theme-neutral@0.1.8` (versi exact pin yang sama dengan
`apps/web`, ADR-041), diverifikasi lewat `bunx astryx docs <topic>` dan —
untuk nilai piksel yang tidak muncul di docs — `bunx astryx swizzle
<Component>` sementara (source dibaca lalu dihapus segera, tidak pernah
disimpan, sesuai larangan swizzle ADR-041). Karena Claude Design adalah
kanvas HTML/CSS statis (tidak bisa menjalankan React/StyleX asli), setiap
file component library sekarang mencantumkan anotasi eksplisit komponen +
props Astryx asli yang direplikasi (mis. `<Button variant="primary"
size="md">`), supaya implementasi di `apps/web` tinggal pasang komponen
asli, bukan menebak.

Dampak paling terlihat: warna accent berubah dari placeholder rekaan
(`#48517A`, slate-blue) menjadi accent asli tema neutral Astryx (`#262626`,
near-black) — tetap berstatus placeholder brand (ADR-038/ADR-041) sampai
designer mengunci warna final, tapi sekarang placeholder yang _nyata_,
bukan rekaan. Enam status konten (`draft/review/ready/scheduled/published/
failed`) dipetakan ke varian `Badge` asli
(`neutral/warning/info/purple/success/error`) — `scheduled` sengaja memakai
tag kategori "purple" (bukan varian semantik ke-6 yang tidak dimiliki
Astryx) supaya tetap berbeda dari `ready` (info/biru) tanpa mengarang
varian baru. `AppShell` dipetakan ke `variant="section"` (bukan
"elevated") untuk mempertahankan arah hairline-divider yang sudah
ditetapkan produk ini, memakai varian asli yang benar-benar ada, bukan
kombinasi custom.

Scope round ini: `foundations/` (color, type, layout) + `components/`
(buttons, cards, dialog, forms, navigation, status-chips, table) +
`styles.css` + `theme.json`. `templates/` (13 layar KSP + Auth +
App Prototype) **belum** disentuh — masih memakai nama token lama, yang
sekarang menjadi "legacy alias" di `styles.css` (`--color-bg`, `--space-4`,
`--radius-md`, dst., masing-masing di-alias ke token Astryx asli) supaya
halaman-halaman itu tidak rusak sebelum giliran migrasinya di sesi
terpisah.

### Reason

- Permintaan user eksplisit: seluruh komponen Claude Design harus memakai
  komponen yang disediakan `astryx.atmeta.com/components` (situs resmi
  Astryx, open-source Meta/Facebook, `github.com/facebook/astryx`), bukan
  CSS buatan tangan yang cuma "mirip-mirip".
- Cara kerja yang diinginkan user: dokumentasi (dibuat user+AI) → Design
  System merancang UI/UX berdasar dokumentasi itu → implementasi berkaca ke
  Design System. Supaya langkah ketiga (implementasi) tidak perlu menebak
  komponen/props, langkah kedua (Design System) harus eksplisit mengikat
  tiap elemen visual ke komponen Astryx asli yang persis — bukan hanya
  "terlihat mirip".
- Sumber kebenaran versi: CLI lokal v0.1.8 yang ter-pin di `apps/web`,
  bukan situs live (`astryx.atmeta.com`) yang saat verifikasi menunjukkan
  v0.1.9 — konsisten dengan aturan `AGENTS.md` #12 (MCP/situs live untuk
  eksplorasi, CLI lokal untuk keputusan final).

### Alternatives Considered

- **Biarkan Claude Design tetap CSS buatan manual, hanya perbaiki
  detail visual** — ditolak; tidak memenuhi permintaan eksplisit user
  ("saya tidak ingin component yang dibuat manual") dan tidak memberi
  jaminan implementasi kode akan cocok dengan mockup.
- **Coba jalankan React/Astryx asli di dalam Claude Design** — tidak
  memungkinkan secara teknis; Claude Design adalah kanvas HTML/CSS/JS
  statis tanpa bundler/npm. Direplikasi presisi + dianotasikan sebagai
  gantinya.
- **Migrasi `templates/` sekaligus dalam sesi yang sama** — ditolak oleh
  user; scope round ini dibatasi ke foundations + component library dulu
  (urutan kerja eksplisit dari user), `templates/` jadi sesi terpisah.

### Impact

- `context/ctx-design.md` — pointer Claude Design tetap sama; kebijakan
  fidelitas ini didokumentasikan penuh di `readme.md` project Claude
  Design sendiri ("Astryx fidelity policy"), bukan diduplikasi di sini.
- Project Claude Design: `styles.css`, `theme.json`, `readme.md`,
  `foundations/color.html`, `foundations/type.html`,
  `foundations/layout.html`, `components/buttons.html`,
  `components/cards.html`, `components/dialog.html`,
  `components/forms.html`, `components/navigation.html`,
  `components/status-chips.html`, `components/table.html` — 13 file
  ditulis ulang.
- **`templates/` (13 layar + App Prototype) belum bermigrasi** — next
  task untuk sesi terpisah, dijaga tetap berfungsi lewat legacy alias di
  `styles.css` sampai giliran migrasinya.

### Addendum (2026-07-29) — migrasi `templates/` selesai

Sesi lanjutan menyelesaikan migrasi `templates/` (13 layar + App
Prototype) yang tadinya ditunda: seluruh embedded `<style>`/inline style
di 8 layar KSP + 5 layar Auth + `AppPrototype.dc.html` diganti dari nama
token lama ke token Astryx asli langsung. Dua temuan tambahan saat proses:

1. **`thumbnail.html` rusak sejak push pertama ADR-051** — mereferensikan
   `--status-failed-bg`/`--status-published-bg`, token lama yang sudah
   dihapus total dari sistem token baru (diganti sistem varian `Badge`),
   bukan dialiaskan. Tidak ketahuan sampai file ini dicek ulang di sesi
   migrasi `templates/`. Diperbaiki ke `--color-error`/`--color-success`.
2. **Alias singkatan `--text-xs`/`--text-sm`/`--text-lg`** ternyata bukan
   nama token Astryx asli — buatan sendiri saat penulisan ulang pertama,
   dan masih dipakai aktif di banyak file (bukan cuma warisan template
   lama). Diganti ke nama token asli (`--font-size-sm`/`--font-size-lg`)
   di seluruh project sebelum blok "Legacy aliases" dihapus total.

Setelah addendum ini, blok "Legacy aliases" di `styles.css` sudah
dihapus sepenuhnya — tidak ada satu pun nama token buatan sendiri yang
tersisa di project Claude Design ini; semua menunjuk token
`@astryxdesign/theme-neutral@0.1.8` asli secara langsung.

---
