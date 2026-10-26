# Astryx Styling Gaps

**Known Issue Report**

Ringkasan KI-029, KI-030, dan KI-031 — tiga Known Issue yang muncul dari batasan resmi Astryx (masih Beta) dan bug pihak ketiga di ekosistem StyleX, bukan kesalahan konfigurasi implementasi kita.

- **Branch:** fix/ki-029-stylex-babel-plugin
- **Astryx:** v0.4.3
- **Diperbarui:** 2026-08-19
- **Sumber:** project-os/PROJECT_STATE.md

## Verdict singkat

Ketiga isu ini terbukti berasal dari **batas resmi dokumentasi Astryx** (KI-029, sebagian KI-031) atau **gap prop yang memang belum disediakan Astryx** (KI-030, KI-031) — bukan dari cara kita memakai komponennya. Setiap klaim di bawah disertai kutipan langsung dari dokumentasi resmi (`astryx docs`, `astryx component`) atau rilis upstream, dicek ulang lewat CLI lokal dan registry publik, bukan diasumsikan dari memori.

**KI-031 hanya sebagian terkait KI-029** — hanya opsi "swizzle DOM manual" yang terhalang; opsi "tunggu Astryx tambah trailing-icon" berdiri sendiri.

**Daftar isi:** [KI-029](#ki-029-xstyle--stylex) · [KI-030](#ki-030-timeinput-input-guard) · [KI-031](#ki-031-icon-position--tab-order)

---

## KI-029 · xstyle / StyleX

_Tech-Debt · Terkait T-029, ADR-041 · Status: Open_

### Prop `xstyle` belum bisa dipakai

Astryx mendokumentasikan `xstyle` + `stylex.create()` sebagai cara resmi kustomisasi komponen. Tapi dokumentasi Astryx sendiri secara eksplisit memperingatkan bahwa jalur "obvious" (Babel plugin) **tidak kompatibel** dengan Next.js App Router — dan jalur alternatif yang mereka rekomendasikan (SWC-based, pihak ketiga) ternyata punya bug ekstraksi CSS yang terbukti lewat pengujian langsung, tiga putaran, dua versi paket berbeda.

#### Bukti resmi — Astryx memperingatkan sendiri

> **astryx docs styling** — CLI resmi, Astryx v0.4.3, dijalankan lokal via `bun run astryx -- docs styling`
>
> Next.js (App Router) is the sharp edge. StyleX's canonical compiler is a Babel plugin, but introducing a Babel config in Next.js disables the SWC compiler, which in turn breaks SWC-dependent features like **next/font**. So the "obvious" Babel setup is actively incompatible with a standard Next 15 App Router app.
>
> - Symptom of a missing compiler: swizzled component renders with no styles, but no build or runtime error.
> - Do NOT add @stylexjs/babel-plugin to a Next.js App Router app; it disables SWC and breaks next/font.

> **Astryx changelog resmi** — [astryx.atmeta.com/changelog](https://astryx.atmeta.com/changelog), entri #3373
>
> astryx swizzle: swizzled components ship raw StyleX source that needs a build-time StyleX compiler, and without one they render unstyled with no error. The command now prints a StyleX build-setup note after copying (including the Next.js caveat that the **StyleX Babel plugin disables SWC and breaks next/font**, so an SWC-based transform is required).

#### Yang sudah dicoba (3 putaran, semua di-revert bersih)

- **Putaran 1 — `@stylexjs/nextjs-plugin`** (jalur webpack lama): gagal total. Next.js 16 project ini pakai Turbopack secara default, dan hook `webpack()` paket ini tidak pernah terpanggil.
- **Putaran 2 — `@stylexswc/nextjs-plugin@0.18.3`** (SWC-based, dist-tag `latest` resmi npm): compiler jalan, tidak ada error build — tapi nilai numerik dan warna hilang dari CSS hasil ekstraksi.
- **Putaran 3 — `@stylexswc/nextjs-plugin@0.18.4-rc.2`** (pre-release, changelog upstream menyebut "fix number rendering"): bug tetap identik, dikonfirmasi lewat perbandingan classname baseline-vs-`xstyle`, bukan dugaan.

#### Bukti pengukuran putaran 2 & 3 — identik

| Properti                            | Jenis nilai    | Hasil ekstraksi CSS |
| ----------------------------------- | -------------- | ------------------- |
| `borderStyle: 'dashed'`             | keyword string | ✅ Ter-extract      |
| `marginInline: 'auto'`              | keyword string | ✅ Ter-extract      |
| `maxWidth: 420`                     | numerik        | ❌ Hilang total     |
| `marginBlock: 48`                   | numerik        | ❌ Hilang total     |
| `borderWidth: 4`                    | numerik        | ❌ Hilang total     |
| `backgroundColor: 'rgb(255,0,128)'` | fungsi warna   | ❌ Hilang total     |
| `borderColor: 'rgb(0,0,0)'`         | fungsi warna   | ❌ Hilang total     |

> **GitHub release upstream** — [Dwlad90/stylex-swc-plugin @ 0.18.4-rc.2](https://github.com/Dwlad90/stylex-swc-plugin/releases/tag/0.18.4-rc.2), publish 2026-08-17
>
> Bug Fixes 🐛
>
> - **Fix number rendering, rounding, and unsupported value handling** by @Dwlad90 in #1258
>
> — fix ini secara eksplisit menyasar masalah yang sama persis dengan yang kami temukan, tapi pengujian langsung membuktikan bug tetap ada di code path PostCSS+Turbopack yang kami pakai.

**Kenapa ini bukan salah implementasi kami:** kami mengikuti persis panduan resmi Astryx (bukan jalur yang mereka larang), lalu memverifikasi tiga kombinasi package berbeda dengan bukti terukur (bukan "tidak error" saja) — computed style, isi CSS terkirim, dan perbandingan classname baseline. Bug tetap konsisten di seluruh percobaan, dan changelog upstream sendiri mengonfirmasi ini area yang masih aktif diperbaiki.

**Opsi ke depan:**

1. Lapor issue ke upstream `Dwlad90/stylex-swc-plugin` dengan reproduksi minimal.
2. Uji jalur `--webpack` (kehilangan Turbopack — trade-off arsitektur, butuh ADR).
3. Tunggu rilis stable `0.18.4`, cek ulang.
4. Tunda — lanjut pakai `className` Tailwind untuk kustomisasi yang tidak butuh nilai numerik/warna kustom.

---

## KI-030 · TimeInput input guard

_Tech-Debt · Terkait T-029, ADR-041 · Status: Open_

### `TimeInput` tak membatasi input real-time

Field `TimeInput` menerima ketikan bebas tanpa batas (bisa >4 digit atau huruf apa saja). Ini bukan salah konfigurasi kita — Astryx mendesain komponen ini untuk di-parse saat blur, bukan masking real-time per-keystroke, dan tabel props resminya **memang tidak menyediakan** prop untuk membatasi input saat mengetik.

#### Bukti resmi — daftar props lengkap TimeInput

> **astryx component TimeInput --dense** — CLI resmi, Astryx v0.4.3, dijalankan lokal
>
> label · isLabelHidden · description · isOptional · isRequired · isDisabled · disabledMessage · value · onChange · changeAction · isLoading · min · max · hasSeconds · hasClear · hourFormat · increment · placeholder · size · status · statusVariant · labelTooltip · width · **xstyle**
>
> — tidak ada satupun dari 24 prop resmi ini (`maxLength`, `pattern`, `onKeyDown`, atau sejenisnya) yang berfungsi membatasi keystroke individual saat mengetik.

#### Konfirmasi tambahan di level DOM

- Inspeksi elemen `<input>` internal: `type="text"` tanpa `maxLength`/`pattern` sama sekali — bukan atribut yang sengaja dilepas oleh kode kita, memang tidak pernah diset oleh komponennya.
- Wrapper `onKeyDownCapture`/`onPaste` sempat dicoba sebagai mitigasi level "wrapper selektif" (bukan swizzle) — tapi tidak solid (tidak menangkap paste/IME sepenuhnya) dan dihapus atas keputusan King Rezi.

**Kenapa ini bukan gap implementasi kami:** daftar props di atas adalah permukaan API lengkap yang diekspos Astryx sendiri untuk versi yang ter-install — tidak ada prop pembatas input yang "terlewat" dipakai, karena memang belum ada.

**Opsi ke depan:**

1. Tunggu Astryx menambah prop resmi untuk ini (masih Beta, KI-005).
2. Coba ulang mitigasi wrapper dengan pendekatan berbeda, jika prioritas naik.

---

## KI-031 · Icon position / tab order

_Tech-Debt · Terkait T-029, ADR-041 · Status: Open_

### Ikon kalender/jam tak bisa pindah kanan tanpa merusak tab order

Memindah ikon `DateInput`/`TimeInput` ke kanan lewat `flex-row-reverse` hanya membalik urutan visual — ikon tetap jadi elemen DOM pertama, sehingga keyboard Tab dan screen reader tetap mengunjunginya lebih dulu. Ini mismatch WCAG 2.4.3 (Focus Order), dan Astryx tidak menyediakan prop resmi untuk mengatur posisi ikon.

#### Bukti resmi — anatomi komponen tidak menyediakan opsi posisi

> **astryx component DateInput --dense** — CLI resmi, Astryx v0.4.3
>
> Anatomy: Label (required) → Text input (required) → **Calendar icon (required)** → Calendar popover → Clear button → Status message
>
> Props: label · isLabelHidden · description · isOptional · isRequired · isDisabled · disabledMessage · value · onChange · changeAction · isLoading · min · max · dateConstraints · placeholder · size · status · statusVariant · labelTooltip · hasClear · numberOfMonths · weekStartsOn · format · width · xstyle
>
> — tidak ada prop seperti `iconPosition` atau `trailingIcon` di kedua komponen (`DateInput` maupun `TimeInput`); urutan anatomi ikon-lalu-input bersifat tetap di versi ini.

#### Konfirmasi platform — kenapa CSS saja tak cukup

> **MDN Web Docs** — properti CSS `order`
>
> The order property does not affect layout order used for other purposes, such as speech order for accessibility tools, or the navigation order when pressing the Tab key

- Source komponen Astryx yang ter-install dicek langsung: tidak ada `tabIndex` maupun CSS `order` pada ikon — mengonfirmasi urutan DOM memang tetap fixed.

#### Hubungan dengan KI-029 — hanya sebagian

Ada dua opsi yang tersisa untuk kasus ini, dan hanya satu yang terhalang KI-029:

- **Restrukturisasi DOM manual (swizzle)** — _terhalang KI-029_. `astryx swizzle` meng-eject raw StyleX source yang butuh compiler StyleX yang benar-benar jalan (persis yang gagal diverifikasi di KI-029) supaya hasilnya ter-styling, bukan render tanpa style.
- **Menunggu Astryx menambah opsi trailing-icon resmi** — _berdiri sendiri_, tidak butuh swizzle maupun `xstyle` sama sekali.

**Kenapa ini bukan bug implementasi kami:** fix yang diterapkan (revert ke posisi default kiri) sudah benar secara a11y berdasarkan spesifikasi CSS `order` di MDN dan anatomi resmi Astryx — trade-off yang tersisa (kecocokan visual vs a11y) murni menunggu Astryx menambah API resmi, bukan sesuatu yang bisa diselesaikan lewat konfigurasi kita.

---

Sumber lengkap & log investigasi per-putaran: [project-os/PROJECT_STATE.md](../PROJECT_STATE.md) (entri KI-029, KI-030, KI-031) di branch `fix/ki-029-stylex-babel-plugin`. Semua kutipan diverifikasi langsung lewat CLI lokal (`astryx docs`, `astryx component`), npm registry, dan GitHub Releases upstream pada 2026-08-18 — bukan dari memori/asumsi.
