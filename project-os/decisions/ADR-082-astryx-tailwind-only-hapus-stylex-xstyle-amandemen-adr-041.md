## Decision ADR-082

### Title

Astryx Tailwind-Only — Hapus Dependency StyleX, `xstyle` Tidak Dipakai (Amandemen ADR-041)

### Status

Accepted — Amended by ADR-097 (2026-09-01)

### Date

2026-08-19

### Context

**KI-029** (`project-os/PROJECT_STATE.md`) mendokumentasikan 3 putaran
investigasi (2026-08-18 s/d 2026-08-19) untuk membuat prop `xstyle` Astryx
(mekanisme kustomisasi resmi #1 menurut hirarki `astryx.atmeta.com/docs/styling`)
bisa dipakai di project ini. Ketiga putaran gagal karena alasan berbeda:

1. **Jalur Babel plugin resmi** (`@stylexjs/babel-plugin`) — dilarang eksplisit
   oleh dokumentasi Astryx sendiri untuk Next.js App Router karena mematikan
   SWC compiler dan merusak `next/font`.
2. **Jalur jembatan komunitas** (`@stylexswc/nextjs-plugin`, dua versi:
   `0.18.3` stable dan `0.18.4-rc.2` pre-release) — compiler berhasil
   dipasang tanpa error, tapi punya bug ekstraksi CSS: nilai numerik
   (`maxWidth: 420`, dst.) dan fungsi warna (`rgb(...)`) hilang total dari
   CSS hasil ekstraksi, dikonfirmasi lewat `getComputedStyle` browser dan
   grep langsung isi CSS chunk terkirim — bukan dugaan.
3. **Jalur resmi StyleX alternatif** (`@stylexjs/postcss-plugin`, yang
   diklaim `stylexjs.com` kompatibel Turbopack sejak Next.js 16.0.3) —
   diidentifikasi dalam diskusi lanjutan (2026-08-19) sebagai opsi yang
   belum diuji, tapi **King Rezi memutuskan tidak perlu diuji lebih lanjut**
   — lihat Decision di bawah.

Dependency `@stylexjs/stylex` ada di `apps/web/package.json` sejak awal
(prasyarat internal Astryx), tapi **tidak ada satupun file di
`apps/web/src` yang memakai `stylex.create()` secara aktif** — seluruh
percobaan 3 putaran sudah di-revert bersih, tidak ada sisa kode permanen.

Repo contoh resmi Meta (`facebook/astryx/apps/example-nextjs-tailwind`,
diverifikasi 2026-08-19) mengonfirmasi Astryx **secara resmi mendukung**
pola konsumsi tanpa compiler StyleX sama sekali — dependency `package.json`
contoh ini cuma `@astryxdesign/core`, `@astryxdesign/theme-neutral`, dan
Tailwind CSS v4, tanpa paket StyleX apapun. Kutipan resmi: _"No StyleX
build plugin needed: Astryx components are consumed as a regular npm
package with a CSS import."_

Perlu dicatat jujur (dibahas eksplisit dengan King Rezi sebelum keputusan
ini): hirarki resmi `astryx.atmeta.com/docs/styling` tetap merekomendasikan
`xstyle` sebagai pilihan **pertama** untuk override spesifik komponen
(padding, warna, border, pseudo-class) — Tailwind resminya diposisikan
untuk layout/wrapper saja. Jadi keputusan ini adalah **penyimpangan sadar**
dari hirarki resmi #1, bukan "menemukan cara resmi yang lebih disukai" —
diambil murni karena pertimbangan biaya-manfaat (bug upstream yang belum
fix vs kebutuhan kustomisasi granular yang jarang terjadi di project ini).

### Decision

1. **`xstyle` tidak dipakai** di project ini untuk kustomisasi komponen
   Astryx apapun — baik sekarang maupun ke depan, kecuali ada ADR baru yang
   mencabut keputusan ini setelah ekosistem StyleX+Turbopack matang.
2. **Dependency `@stylexjs/stylex` dihapus** dari `apps/web/package.json`
   (dan `bun.lock`) — tidak pernah benar-benar dipakai, menganggur sejak
   awal.
3. Seluruh kebutuhan kustomisasi styling Astryx **sepenuhnya lewat Tailwind**
   (`className`, layout/wrapper, dan bagian komponen yang memang diekspos
   className-nya) — mengikuti pola resmi `example-nextjs-tailwind` (Meta).
4. **Batasan yang disadari dan diterima**: kustomisasi sub-elemen internal
   komponen yang **tidak** diekspos lewat `className` (contoh nyata: posisi
   ikon kalender/jam di `DateInput`/`TimeInput`, kasus KI-031) **tidak bisa**
   diselesaikan lewat Tailwind — hanya bisa lewat `xstyle` (yang kita
   putuskan tidak dipakai) atau `astryx swizzle` (yang butuh compiler StyleX
   yang sama, jadi ikut tidak realistis diambil selama keputusan ini
   berlaku). Konsekuensi konkret ke KI-031: opsi "restrukturisasi DOM manual
   via swizzle" praktis tertutup; satu-satunya opsi yang tersisa adalah
   menunggu Astryx menambah prop resmi posisi ikon (`trailingIcon`/
   `iconPosition`).
5. Status KI-029/KI-031 di `PROJECT_STATE.md` diperbarui menyusul ADR ini
   (task terpisah, disepakati dikerjakan setelah ADR ini).

### Reason

- Tiga putaran investigasi teknis (KI-029) sudah menghabiskan waktu
  signifikan tanpa hasil — bug ekstraksi CSS numerik/warna konsisten
  reproduksi di 2 versi paket komunitas berbeda, dan jalur resmi Babel
  plugin memang dilarang Astryx sendiri.
- Astryx (Meta) sendiri menyediakan dan mendukung resmi pola tanpa compiler
  StyleX (`example-nextjs-tailwind`) — ini bukan hack, melainkan opsi
  arsitektur yang sah, meski bukan hirarki preferensi tertinggi mereka.
- Kebutuhan nyata project ini terhadap kustomisasi granular lewat `xstyle`
  sejauh ini sangat jarang (baru 1 kasus konkret: reposisi ikon KI-031) —
  tidak sepadan menanggung beban maintenance dua sistem styling (StyleX +
  Tailwind) demi kasus langka, ditambah risiko bug upstream berulang di
  masa depan.
- King Rezi eksplisit menyatakan preferensi menghindari kerumitan/waktu
  investigasi lanjutan untuk masalah ini ("menghapus xstyle yang membuat
  saya pusing dari tadi", 2026-08-19).

### Alternatives Considered

- **Uji jalur resmi StyleX alternatif** (`@stylexjs/postcss-plugin`, klaim
  kompatibel Turbopack sejak Next 16.0.3) sebagai putaran 4 — **ditolak**
  King Rezi memilih tidak melanjutkan investigasi teknis apapun untuk
  `xstyle`, terlepas dari potensi jalur ini belum terbukti gagal maupun
  berhasil.
- **Opt-out Turbopack** (`--webpack`) untuk memakai jalur `@stylexswc/*`
  yang sudah diuji — **ditolak**, trade-off arsitektur terlalu besar
  (kehilangan Turbopack untuk seluruh app) demi satu fitur styling yang
  punya workaround lain.
- **Biarkan dependency `@stylexjs/stylex` tetap ada** (menganggur, tidak
  dipakai) untuk jaga-jaga kalau nanti dibutuhkan lagi — **ditolak**,
  dependency menganggur menambah kebingungan (memberi kesan `xstyle` bisa
  dipakai padahal tidak) dan menambah permukaan upgrade/audit yang tidak
  perlu.

### Impact / Baseline yang diamandemen

- `apps/web/package.json` — dependency `@stylexjs/stylex` dihapus.
- `bun.lock` — diperbarui menyusul penghapusan dependency.
- **ADR-041** (UI Component System — Astryx) — status ditandai
  `Accepted — Amended by ADR-082 (2026-08-19)` di `DECISIONS.md`; body
  ADR-041 sendiri tidak diedit, mengikuti pola amandemen sebelumnya
  (ADR-066/067, ADR-071/075, ADR-076/077, ADR-018/078, ADR-033/081).
- `project-os/PROJECT_STATE.md` — KI-029 dan KI-031 diperbarui
  menyusul ADR ini (task terpisah, belum dieksekusi saat ADR ini ditulis).
- Tidak menyentuh kode runtime lain — tidak ada `stylex.create()` aktif
  yang perlu dihapus (sudah nihil sejak 3 putaran investigasi di-revert
  bersih).
- Kalau di masa depan ekosistem StyleX+Turbopack matang (jalur resmi
  `@stylexjs/postcss-plugin` terbukti solid, atau jembatan komunitas fix
  bug ekstraksi numerik/warna), keputusan ini perlu ditinjau ulang lewat
  ADR baru — bukan diasumsikan berubah sendiri.

---
