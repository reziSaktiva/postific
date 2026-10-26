## Decision ADR-041

### Title

UI Component System — Astryx sebagai Fondasi Permanen dan Design-Later Workflow

### Status

Accepted — Amended by ADR-057 (2026-07-31), ADR-082 (2026-08-19), ADR-097 (2026-09-01)

### Date

2026-07-23

### Decision

1. **Astryx menggantikan shadcn/ui** sebagai UI component system project.
   Astryx menjadi fondasi komponen permanen, termasuk setelah designer masuk.
2. Selama implementasi feature M8, aplikasi memakai komponen dan
   **neutral theme bawaan Astryx**. Designer tersedia setelah feature project
   selesai untuk menetapkan visual direction dan nilai design tokens final.
   Hasil design diterapkan melalui Astryx theme, token bridge, dan wrapper
   selektif tanpa mengganti fondasi komponen.
3. **Tailwind CSS tetap dipertahankan**, tetapi dibatasi untuk layout, wrapper,
   spacing, grid, flex, dan responsive page composition. Astryx memiliki
   komponen, interaction behavior, accessibility, dan visual component theme.
4. Project memakai **wrapper selektif**, bukan wrapper menyeluruh. Wrapper
   dibuat hanya untuk komponen kritis, komponen yang dipakai luas, default
   aplikasi yang konsisten, atau adaptasi behavior produk.
5. Risiko Astryx Beta diterima dengan guardrail:
   - gunakan stable release dengan exact version; initial adoption memakai
     `@astryxdesign/core` dan theme versi `0.1.8`;
   - core dan theme di-upgrade sebagai satu unit;
   - jangan memakai canary release;
   - update dilakukan manual dan diverifikasi di staging;
   - hindari `swizzle` dan authoring StyleX pada tahap awal; dan
   - jalankan typecheck, lint, test, serta production build pada setiap upgrade.
6. Sebelum dipakai untuk implementasi feature secara luas, integrasi Astryx
   harus melewati smoke test Button, Dialog, form controls, Table, dark mode,
   Tailwind cascade layer, dan Next.js 16 production build.
7. Keputusan ini:
   - **mengamendemen ADR-035** dengan pengecualian exact version khusus paket
     Astryx selama masih Beta;
   - **mengamendemen ADR-038** pada urutan kerja: implementasi feature tidak
     menunggu design final; template design tokens tetap Draft/TBD sampai
     designer masuk setelah feature selesai; dan
   - menjadi addendum **ADR-036 Engineering Planning Baseline**, yang harus
     diselaraskan ke dokumen Engineering dan AI Context terkait sebelum
     implementasi UI feature.

### Reason

- Designer belum tersedia selama implementasi feature, sehingga project
  membutuhkan UI foundation yang dapat langsung dipakai tanpa mengarang visual
  design final.
- Astryx menyediakan komponen React accessible, typed, themeable, dark mode,
  template, serta tooling agent-ready yang sesuai workflow solo developer.
- Verifikasi 2026-07-23 mengonfirmasi lisensi MIT, dukungan React 19,
  precompiled CSS, jalur resmi Next.js + Tailwind CSS v4, serta CLI yang dapat
  dijalankan dengan Bun.
- Mempertahankan fondasi yang sama sebelum dan setelah designer masuk mencegah
  pembuangan implementasi interaction, accessibility, dan component structure.
- Tailwind tetap berguna untuk page composition, sedangkan pembatasan ownership
  styling mencegah konflik antara utility CSS dan internal component theme.
- Exact pin dan smoke test diperlukan karena Astryx masih Beta dan contoh resmi
  yang diverifikasi belum secara eksplisit menargetkan Next.js 16.

### Alternatives Considered

- Tetap memakai shadcn/ui — ditolak; Project Owner memilih Astryx sebagai
  fondasi permanen sebelum implementasi layar M8 berkembang.
- Menunda seluruh UI sampai designer tersedia — ditolak; akan memblokir
  implementasi dan validasi feature.
- Memakai Astryx hanya sebagai prototype sementara — ditolak; menghasilkan
  risiko rebuild komponen setelah designer masuk.
- Menghapus Tailwind dan memakai StyleX sepenuhnya — ditolak; menambah setup dan
  migrasi tanpa manfaat yang cukup untuk MVP.
- Wrapper untuk seluruh komponen Astryx — ditolak; menambah abstraksi dan beban
  maintenance tanpa kebutuhan nyata.
- Menggunakan Astryx langsung tanpa wrapper sama sekali — ditolak; komponen
  kritis tetap membutuhkan boundary untuk default dan adaptasi produk.

---
