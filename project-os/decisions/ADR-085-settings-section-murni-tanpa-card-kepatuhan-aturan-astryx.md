## Decision ADR-085

### Title

Settings Pakai `Section` Murni Tanpa `Card` (Kepatuhan Aturan Astryx "Dense Data Jangan Card-Wrapped") — ADR-085 & ADR-086 Versi Lama Dihapus Total

### Status

Accepted

### Date

2026-08-21

### Context

Pada tanggal yang sama, dua ADR sempat dibuat untuk memperbaiki bug visual
`Section` (Astryx) di Settings:

1. **ADR-085 versi lama** (`Section > Card` Membungkus Table/List di
   Settings — Pengecualian Sadar atas Aturan Astryx "Dense Data Jangan
   Card-Wrapped") — mengonfirmasi `SettingsSectionCard` membungkus dense
   data (`MembersTable`, `ConnectedAccountsList`) dengan pola
   `Section > Card`, sebagai pengecualian sadar terhadap aturan Astryx.
2. **ADR-086 versi lama** (`Section variant="transparent"` untuk Container
   Fit-Content Non-Region + Verifikasi Visual Wajib Light DAN Dark Mode) —
   menambahkan `variant="transparent"` pada `Section` di `DashboardHome.tsx`
   dan `SettingsSectionCard.tsx` untuk menghilangkan artifact border siku
   Section yang menonjol dari lengkungan border Card di light mode.

Setelah diskusi lebih lanjut dengan King Rezi, kedua pendekatan itu
dikonfirmasi **melanggar aturan resmi Astryx**, dicek langsung lewat CLI:

- `bunx astryx docs layout` — section "Cards vs Rows": _"Dense data
  (anything the user scans, filters, or selects) belongs in rows...
  ✗ Nesting Cards inside Cards... ✗ Wrapping each list item in a Card"_.
- `bunx astryx docs shape` — `Section` adalah _page region_ flat
  (`radius: none`), sedangkan `Card` memakai `--radius-container` (12px,
  rounded). Kedua komponen ini **secara desain tidak dibuat untuk
  ditumpuk** — artifact border siku Section menonjol dari lengkungan Card
  bukan sekadar soal warna/kontras (seperti yang sempat dikira di versi
  lama ADR-086), melainkan konsekuensi struktural dari menumpuk dua
  komponen yang tidak dirancang bersusun.

Root cause bug jadi jelas: masalahnya bukan warna (`variant="transparent"`
hanya menyamarkan gejalanya di sebagian kasus), melainkan pola
`Section > Card` itu sendiri yang salah dari awal untuk membungkus dense
data.

### Decision

1. `SettingsSectionCard` awalnya direstrukturisasi total — `Card` dihapus
   sepenuhnya, `Section` langsung membungkus `children` tanpa `variant`
   (default) — sebagai wrapper tipis:

   ```tsx
   import type { ReactNode } from "react";
   import { Section } from "@astryxdesign/core/Section";

   export function SettingsSectionCard({ children }: { children: ReactNode }) {
     return <Section>{children}</Section>;
   }
   ```

   **Langkah lanjutan (keputusan final, hari yang sama):** King Rezi menilai
   wrapper ini jadi trivial — hanya `<Section>{children}</Section>` tanpa
   value tambahan dibanding memakai `<Section>` langsung — sehingga
   `SettingsSectionCard.tsx` **dihapus total** (file `apps/web/src/app/(app)/settings/components/SettingsSectionCard.tsx`
   sudah di-`rm`, bukan lagi dipertahankan sebagai wrapper tipis). Tiga
   pemakainya diupdate untuk mengimpor `Section` langsung dari
   `@astryxdesign/core/Section`:

   - `apps/web/src/app/(app)/settings/account/components/ProfileForm.tsx` —
     `<SettingsSectionCard>` yang membungkus `<form>` diganti `<Section>`
     langsung.
   - `apps/web/src/app/(app)/settings/members/components/MembersTable.tsx` —
     `<SettingsSectionCard>` yang membungkus `EmptyState`/`Table` diganti
     `<Section>` langsung.
   - `apps/web/src/app/(app)/settings/connected-accounts/components/ConnectedAccountsList.tsx` —
     `<SettingsSectionCard>` yang membungkus `EmptyState`/`List` diganti
     `<Section>` langsung.

   Dikonfirmasi tidak ada sisa referensi `SettingsSectionCard` di
   `apps/web/src` (grep bersih), `tsc --noEmit` tidak ada error terkait
   ketiga file ini, dan ketiga halaman (Profile, Members, Connected
   Accounts) sudah diverifikasi visual jalan normal di browser (light
   mode).

2. `DashboardHome.tsx` — Section "Analytics Snapshot" **dikembalikan** ke
   default (tanpa `variant="transparent"`, tanpa `variant` sama sekali).
   Perbaikan yang didokumentasikan versi lama ADR-086 untuk file ini
   di-revert total, dianggap batal bersama ADR-086 versi lama.
3. Konsekuensi visual disadari dan diterima eksplisit oleh King Rezi:
   3 halaman Settings (Profile, Members, Connected Accounts) sekarang
   tampil **flat/persegi** (mengikuti bentuk asli `Section`, tanpa rounded
   border ala Card) — bukan lagi kotak rounded seperti mockup Claude
   Design sebelumnya. Ini deviasi sadar dari mockup demi kepatuhan aturan
   Astryx resmi, bukan bug yang belum ditemukan.
4. **ADR-085 dan ADR-086 versi lama dihapus total** dari
   `project-os/DECISIONS.md` dan filenya di
   `project-os/decisions/` — bukan diamandemen dengan tag
   "Accepted — Amended by ADR-XXX" seperti pola append-only ADR yang
   biasanya berlaku di project ini (lihat `PROJECT_RULES.md` §
   Append-Only). Ini **pengecualian eksplisit** yang disengaja: kedua ADR
   itu baru dibuat pada hari yang sama (2026-08-21), pendekatannya sendiri
   sudah terbukti salah sebelum sempat menyebar jadi preseden di tempat
   lain (task/kode/dokumentasi lain), sehingga King Rezi memutuskan
   riwayatnya dihapus bersih alih-alih menumpuk amandemen di atas
   keputusan yang keliru dari awal.
5. Konsekuensi penomoran: nomor `ADR-085` dipakai ulang untuk ADR ini
   (bukan melompat ke `ADR-087`) karena nomor lama sudah dihapus total dari
   `DECISIONS.md` sebelum ADR baru ini dibuat — tidak ada dua entri hidup
   berdampingan dengan nomor sama. Entri ini sengaja mencatat riwayat
   penomoran ini secara eksplisit, supaya kalau ada audit riwayat git di
   masa depan menemukan commit lama yang menyebut "ADR-085: Section > Card
   di Settings" (topik berbeda dari isi file `ADR-085` yang sekarang), ada
   jejak alasan resmi di sini — bukan dianggap inkonsistensi atau korupsi
   dokumentasi.

### Reason

- Aturan resmi Astryx (`astryx docs layout`, `astryx docs shape`) eksplisit
  melarang pola `Section > Card` untuk dense data — pengecualian yang
  dicatat di versi lama ADR-085 tidak valid; itu bukan trade-off yang bisa
  diterima, melainkan penyimpangan dari desain sistem Astryx yang berakibat
  bug visual struktural (bukan sekadar kosmetik).
- `variant="transparent"` (versi lama ADR-086) menutupi gejala tanpa
  mengoreksi akar masalah — begitu pola `Section > Card` dihapus total,
  masalah artifact border pun hilang dengan sendirinya tanpa perlu
  `variant` khusus.
- Menghapus total (bukan mengamandemen) dua ADR yang baru lahir dan salah
  sejak awal lebih jujur secara historis dibanding menumpuk amandemen di
  atas keputusan yang sudah terbukti keliru — mencegah `DECISIONS.md`
  menyimpan rasionalisasi untuk pendekatan yang sudah ditinggalkan
  sepenuhnya, sekaligus mencegah kebingungan pembaca masa depan yang
  mencari "kenapa Settings pakai Section+Card" padahal kodenya sudah tidak
  begitu lagi.

### Alternatives Considered

- **Mengamandemen ADR-085/086 lama** (menambah tag "Accepted — Amended by
  ADR-085 baru") — ditolak; pola amandemen cocok untuk keputusan yang
  pernah valid lalu berubah karena konteks baru, bukan untuk keputusan yang
  ternyata salah sejak awal dan belum sempat jadi preseden di tempat lain.
  King Rezi eksplisit memilih hapus total untuk kasus ini.
- **Mempertahankan `Section > Card` tapi mencari cara styling lain untuk
  menghilangkan artifact border** (mis. `xstyle` custom radius) — ditolak;
  `xstyle` sudah dihapus total (ADR-082), dan lebih fundamental, pola
  `Section > Card` untuk dense data tetap melanggar aturan Astryx terlepas
  dari cara stylingnya.
- **Custom komponen non-Astryx untuk mockup kotak rounded** — ditolak;
  keluar dari kebijakan UI produk hanya memakai Astryx (rule 14
  `AGENTS.md`, ADR-041).

### Impact / Baseline yang diamandemen

- `apps/web/src/app/(app)/settings/components/SettingsSectionCard.tsx` —
  **dihapus total** (bukan lagi dipertahankan sebagai wrapper tipis;
  perubahan kode sudah diterapkan di sesi terpisah, sudah diverifikasi
  King Rezi lewat browser preview untuk ketiga halaman Settings).
- `apps/web/src/app/(app)/settings/account/components/ProfileForm.tsx`,
  `apps/web/src/app/(app)/settings/members/components/MembersTable.tsx`,
  `apps/web/src/app/(app)/settings/connected-accounts/components/ConnectedAccountsList.tsx`
  — masing-masing diupdate mengimpor `Section` dari
  `@astryxdesign/core/Section` langsung, tanpa lapisan abstraksi
  `SettingsSectionCard` di antaranya.
- `apps/web/src/app/(app)/components/DashboardHome.tsx` — Section
  "Analytics Snapshot" dikembalikan ke default, revert total dari versi
  lama ADR-086 (perubahan kode sudah diterapkan di sesi terpisah).
- `project-os/DECISIONS.md` — baris indeks ADR-085/086 versi lama
  dihapus, diganti baris `ADR-085` baru (isi ini) tepat di posisi yang
  sama secara urutan (setelah `ADR-084`).
- `project-os/decisions/ADR-085-section-card-dense-data-settings-pengecualian-aturan-astryx.md`
  dan
  `project-os/decisions/ADR-086-section-transparent-fit-content-dan-verifikasi-dual-mode-light-dark-wajib.md`
  — dihapus total.
- `context/ctx-development.md` — item checklist "verifikasi visual light
  DAN dark mode wajib" yang sebelumnya ditambahkan mengacu ADR-086 versi
  lama, dihapus total dari "Checklist sebelum selesai task kode". Item
  lama soal smoke test UI + dark mode khusus upgrade Astryx (sudah ada
  sebelum ADR-086 versi lama dibuat) **tetap dipertahankan**, tidak ikut
  terhapus.
- `project-os/COMPLETE_TASK.md` — entri lama yang mencatat pembuatan
  ADR-085/086 versi lama dihapus total, digantikan entri baru untuk ADR
  ini.
- Konsekuensi visual produk: 3 halaman Settings (Profile, Members,
  Connected Accounts) jadi flat/persegi, menyimpang dari mockup Claude
  Design yang sebelumnya minta tampilan kotak rounded — deviasi sadar,
  belum disinkronkan ulang ke Claude Design (next step terpisah, di luar
  cakupan ADR ini).

---
