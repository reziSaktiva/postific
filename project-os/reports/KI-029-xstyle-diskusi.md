# Diskusi KI-029 — Cara Styling Astryx & Masalah `xstyle`

Catatan diskusi dengan King Rezi, dasar sebelum keputusan lanjutan untuk KI-029.
Sumber: `astryx.atmeta.com/docs/styling`, `astryx.atmeta.com/docs/styling-libraries`,
`stylexjs.com/docs/learn/installation/nextjs`, dan investigasi 3 putaran di
`project-os/PROJECT_STATE.md` (KI-029).

---

## 1. Bagaimana cara resmi styling komponen Astryx?

Astryx punya **hirarki preferensi eksplisit** di `/docs/styling`, dari yang paling direkomendasikan:

| Urutan | Pendekatan                   | Untuk kasus apa                                                   |
| ------ | ---------------------------- | ----------------------------------------------------------------- |
| **1**  | **`xstyle` prop (StyleX)**   | Override spesifik komponen — padding, warna, border, pseudo-class |
| 2      | Design tokens                | Wajib dipakai di semua pendekatan                                 |
| 3      | Tailwind `className`         | **Layout & wrapper saja**, bukan override komponen                |
| 4      | `className`/`style` fallback | Integrasi CSS eksternal                                           |
| 5      | Data-attribute selector      | CSS eksternal yang targeted                                       |

Kutipan resmi: _"For layout and wrapper styling, Tailwind utilities on className work well. For component-specific overrides (padding, colors, borders), prefer `xstyle`."_

### Kenapa "Tailwind-only, drop StyleX" bukan solusi netral

Repo contoh resmi `facebook/astryx/apps/example-nextjs-tailwind` menunjukkan Astryx **bisa** dipakai tanpa compiler StyleX sama sekali (_"No StyleX build plugin needed... Astryx ships pre-compiled CSS with all component styles as atomic classes"_). Tapi ini pola untuk **konsumsi Astryx apa adanya tanpa kebutuhan kustomisasi komponen** — bukan pengganti resmi `xstyle`.

Kasus yang memicu KI-029 pertama kali (reposisi ikon kalender/jam `DateInput`/`TimeInput`) adalah **override spesifik komponen** — persis kategori yang menurut hirarki resmi Astryx seharusnya pakai `xstyle`, bukan Tailwind. Jadi memutuskan "drop StyleX, full Tailwind" berarti **sengaja menyimpang dari mekanisme kustomisasi #1** yang direkomendasikan Astryx, bukan "menemukan cara resmi yang lebih baik" — trade-off ini valid untuk diambil, tapi harus disadari konsekuensinya, bukan dianggap default netral.

### Dampak ke KI lain kalau opsi ini diambil

| KI     | Kategori masalah                          | Terpengaruh pola Tailwind-only?                                                                                                                     |
| ------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| KI-029 | Styling (`xstyle` numerik/warna)          | Ya — jadi "accepted trade-off", bukan bug terbuka                                                                                                   |
| KI-030 | Behavior (validasi keystroke `TimeInput`) | Tidak — beda domain, solusinya tidak terkait styling                                                                                                |
| KI-031 | DOM structure (tab order ikon)            | **Tidak membantu** — justru menutup opsi swizzle (satu dari dua opsi yang tersisa), karena swizzle butuh compiler StyleX untuk hasilnya ter-styling |

---

## 2. Apa sebenarnya masalah teknis pakai `xstyle`?

Masalahnya **bukan** di prop `xstyle` sebagai konsep — masalahnya ada di rantai proses sebelum kode sampai ke browser:

```
kode kita (stylex.create()) → [COMPILER] → CSS atomic class → browser
```

`xstyle` tidak berfungsi tanpa compiler StyleX yang jalan di build time. Compiler inilah yang bermasalah.

### Tiga jalur compiler yang relevan

**a) Babel plugin (jalur "wajar") — dilarang Astryx sendiri**
Menambahkan `babel.config.js` (untuk `@stylexjs/babel-plugin`) ke Next.js App Router mematikan SWC compiler, merusak `next/font`. Astryx docs eksplisit: _"Do NOT add @stylexjs/babel-plugin to a Next.js App Router app."_

**b) Jalur resmi StyleX alternatif (`@stylexjs/postcss-plugin`) — belum diuji di project kita**
Dokumentasi resmi StyleX (`stylexjs.com`) mengklaim kombinasi `@stylexjs/babel-plugin` + `@stylexjs/postcss-plugin` **kompatibel dengan Turbopack sejak Next.js 16.0.3** — _"Since Next.js 16.0.3, this works with both Webpack and Turbopack."_ Repo contoh resminya (`facebook/stylex/examples/example-nextjs`) pakai Next `^16.2.6` (nyaris identik project kita, `16.2.10`), `next.config.js` kosong. Ini **kontradiksi** dengan peringatan Astryx di atas dan **belum kita buktikan langsung** — status: menarik untuk dicoba, belum terverifikasi.

**c) Jembatan komunitas (`@stylexswc/nextjs-plugin`) — sudah diuji 3 putaran, terbukti buggy**

- Putaran 1 (`@stylexjs/nextjs-plugin`, jalur webpack lama): gagal total — Next.js 16 project ini pakai Turbopack default, hook `webpack()` tidak pernah terpanggil.
- Putaran 2 (`@stylexswc/nextjs-plugin@0.18.3`, stable): compiler jalan tanpa error, tapi:
  - Nilai keyword string (`'dashed'`, `'auto'`) → **ter-extract** dengan benar.
  - Nilai numerik (`420`, `48`, `4`) dan fungsi warna (`rgb(...)`) → **hilang total** dari CSS, meski classname sudah muncul di markup.
- Putaran 3 (`@stylexswc/nextjs-plugin@0.18.4-rc.2`, pre-release, changelog klaim "fix number rendering"): bug **identik**, tidak fixed.
- Ini bug proyek komunitas (`Dwlad90/stylex-swc-plugin`), bukan buatan Meta — kualitas testing/maturity di bawah StyleX/Astryx resmi.

### Kesimpulan

`xstyle` secara desain tidak cacat — masalahnya adalah **belum ada satupun compiler yang terbukti bekerja sempurna** di kombinasi Next.js 16 + Turbopack + monorepo Bun yang dipakai project ini:

| Jalur                     | Status                                                           |
| ------------------------- | ---------------------------------------------------------------- |
| Babel plugin (resmi #1)   | Dilarang — merusak SWC/`next/font`                               |
| PostCSS plugin (resmi #2) | Klaim kompatibel Turbopack, **belum diuji**                      |
| SWC plugin komunitas (#3) | Sudah diuji tuntas, **terbukti buggy** untuk nilai numerik/warna |

Opsi paling menjanjikan yang belum dieksplorasi: **jalur resmi StyleX #2** (`@stylexjs/postcss-plugin`) — kalau klaim kompatibilitas Turbopack-nya benar, ini bisa jadi solusi tanpa perlu menyerah pada `xstyle`.

---

## Opsi yang tersisa (belum diputuskan)

1. **Uji jalur resmi StyleX #2** (`@stylexjs/babel-plugin` + `@stylexjs/postcss-plugin`) di halaman test sekali-pakai — putaran 4, pola sama seperti 3 putaran sebelumnya (dibuktikan, lalu di-revert bersih).
2. **Lapor issue ke upstream** `Dwlad90/stylex-swc-plugin` untuk jalur komunitas — biaya rendah, tidak menyelesaikan masalah sekarang.
3. **Formalkan "Won't Fix"** — terima trade-off Tailwind-only, tutup KI-029 dengan ADR baru, sadari konsekuensi ke KI-031 (opsi swizzle ikut tertutup).
4. **Tunggu rilis stable** `@stylexswc` `0.18.4` — pantau berkala.

Belum ada keputusan final — menunggu arahan King Rezi.

**Update 2026-08-19:** keputusan sudah final — opsi 3 diambil. KI-029 ditutup **Won't Fix** (lihat ADR-082), KI-031 ditutup **Resolved**. Detail: `PROJECT_STATE.md`, `COMPLETE_TASK.md`.
