## Decision ADR-148

### Title

`hugeicons` Menjadi Library Ikon UI; `react-icons` Dibatasi untuk Logo Brand Berwarna (T-165; Menggantikan ADR-068, Mengamandemen ADR-058 Poin 6)

### Status

Accepted

### Date

2026-10-28

### Context

ADR-068 menetapkan `react-icons` sebagai library ikon tunggal untuk seluruh UI. Sesudah migrasi shadcn (T-095, ADR-097), `apps/web/.claude/CLAUDE.md` memakai `hugeicons` (preset Maia, dikonfirmasi King Rezi 2026-09-01) sebagai `iconLibrary`, dan Start Page (ADR-144 poin 15) memakai `hugeicons` monokrom untuk ikon platform. Dua sumber itu bertentangan. Kondisi kode saat ini: `hugeicons` di 32 berkas, `react-icons` di berkas yang tersisa, yaitu `platform-icons.tsx` (logo brand berwarna) dan `calendar-grid-shared.ts` (ikon generik).

### Decision

1. `hugeicons` (`@hugeicons/react` + `@hugeicons/core-free-icons`) adalah library ikon untuk seluruh UI, termasuk ikon platform monokrom.
2. `react-icons` (`react-icons/fa6`) hanya untuk logo brand berwarna per platform (`platform-icons.tsx`), karena `hugeicons` tidak menyediakannya dengan warna brand.
3. Ikon generik yang masih memakai `react-icons` (`calendar-grid-shared.ts`) dimigrasi ke `hugeicons` lewat T-169. T-165 tidak mengubah kode.
4. Satu komponen baru tidak mencampur kedua library untuk ikon generik.

### Reason

Sumber kebenaran ikon harus satu dan sama dengan konfigurasi shadcn. `react-icons` tetap diperlukan hanya untuk logo brand berwarna.

### Alternatives Considered

- **`hugeicons` tunggal, `react-icons` dihapus total.** Ditolak untuk saat ini: logo brand berwarna harus diganti SVG lokal dan cakupan migrasi lebih besar.
- **Tetap `react-icons` tunggal (ADR-068).** Ditolak: bertentangan dengan konfigurasi shadcn dan kode yang sudah berjalan.

### Impact / Baseline yang diamandemen

- ADR-068: status menjadi Superseded by ADR-148.
- ADR-058 poin 6: logo brand tetap `react-icons`; ikon generik lain tidak lagi mengikuti ADR-068.
- `apps/web/.claude/CLAUDE.md` § Icons diselaraskan.

---
