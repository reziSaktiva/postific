## Decision ADR-111

### Title

Badge Status Variant (`success`/`warning`/`destructive`) Jadi Solid Fill — Tambah Token `--destructive-foreground` (Amandemen ADR-098)

### Status

Accepted

### Date

2026-09-23

### Context

King Rezi melaporkan warna badge di seluruh aplikasi (khususnya status
"Active"/"Disconnected" di Channels sidebar, KI-066) tidak sesuai Claude
Design. Investigasi menemukan dua masalah:

1. **Gaya render salah** — `apps/web/src/components/ui/badge.tsx` men-styling
   variant `success`/`warning`/`destructive` sebagai *tinted/soft*
   (`bg-success/10 text-success`, opacity 10-20%). Claude Design
   (`components/status-chips.html`, `styles.css` § "Semantic status (solid
   — loud, reserve for states needing attention)", `readme.md` UXP-04:
   "Keep failed/disconnected states visually loud (solid Badge error
   variant) — they must never blend into the neutral ground") secara
   eksplisit mendefinisikan seluruh status chip (`chip-active`/
   `-disconnected`/`-published`/`-failed`/`-review`) sebagai **solid
   fill** — background token penuh + foreground kontras, bukan tinted.
   Nilai token warnanya sendiri sudah benar (ADR-098 sudah memverifikasi
   `--success`/`--warning` + pasangan foreground copy verbatim dari Claude
   Design) — murni cara `badge.tsx` menerapkan token yang keliru.
2. **Token hilang** — `--destructive-foreground` tidak pernah didefinisikan
   di `apps/web/src/app/globals.css` (hanya `--destructive` yang ada).
   Claude Design punya padanannya, `--color-on-error`, didokumentasikan
   eksplisit sebagai "derived — Stone has no destructive-foreground, so
   --color-on-error is derived to match the same contrast pattern as
   success/warning": light `#ffffff`, dark `#2b1512`.
3. Bug terpisah ditemukan bersamaan: badge status "Active" di
   `ChannelsSection.tsx` memakai `variant="secondary"` (abu-abu netral),
   seharusnya `variant="success"` sesuai `.chip-active` Claude Design.

### Decision

1. `apps/web/src/components/ui/badge.tsx` — variant `destructive`/
   `warning`/`success` diubah dari tinted (`bg-X/10 text-X ...
   dark:bg-X/20`) jadi solid fill (`bg-X text-X-foreground`), pola hover
   dipertahankan (mis. `[a]:hover:bg-destructive/90`, bukan diubah
   mekanismenya) — konsisten dengan variant `default`/`secondary` yang
   memang sudah solid di file yang sama.
2. `apps/web/src/app/globals.css` — tambah token `--destructive-foreground`
   yang sebelumnya tidak ada: `#ffffff` di `:root`, `#2b1512` di `.dark`,
   plus wiring `--color-destructive-foreground: var(--destructive-foreground);`
   di `@theme inline`, mengikuti persis pola `--success-foreground`/
   `--warning-foreground` yang sudah ada (ADR-098).
3. `apps/web/src/app/(app)/components/sidebar-channels/ChannelsSection.tsx`
   — badge "Active" diubah dari `variant="secondary"` jadi
   `variant="success"`.
4. Ini **mengamandemen ADR-098** (menambah token baru ke pemetaan yang
   sama, bukan mengubah nilai yang sudah ada) — bukan mengamandemen
   ADR-097 secara keseluruhan.
5. Dampak ripple disengaja: variant `success`/`warning`/`destructive`
   dipakai luas (Draft Editor Modal, Calendar entries, History Detail,
   Connected Accounts settings, Members "Pending", Analyze dashboard delta
   badge) — semua ikut jadi solid, konsisten dengan cakupan "seluruh badge"
   yang diminta King Rezi dan sejalan dengan treatment seragam Claude
   Design untuk token semantik ini. Mapping semantik status→variant lain
   (`Draft`→`outline`, `ReadyToSchedule`→`secondary`, dst.) TIDAK diubah —
   itu keputusan pemilihan variant per status, bukan bagian solid-vs-soft
   yang diamandemen di sini.
6. Verifikasi: browser (light + dark mode) di Channels sidebar,
   `/settings/connected-accounts`, `/publish/history` + detail, Draft
   Editor Modal (Account Selector "Disconnected"), `/settings/members`.
   Tidak ada regresi kontras teks ditemukan. Tidak ada `vitest`/`tsc`
   tambahan yang relevan — perubahan murni styling Tailwind/CSS token,
   tidak menyentuh logic.

### Reason

* Claude Design mendokumentasikan rationale UX eksplisit (UXP-04): status
  gagal/disconnect harus mencolok agar user tidak salah kira publish/
  koneksi baik-baik saja — tinted 10% opacity gagal memenuhi tujuan itu.
* Nilai token warna sudah benar sejak ADR-098; memperbaiki cara
  penerapannya (solid, bukan tinted) adalah perbaikan tepat sasaran tanpa
  perlu re-derive palet baru.
* `--destructive-foreground` adalah gap murni (token belum pernah ada),
  bukan keputusan desain baru — nilainya sudah diverifikasi ada padanan
  derivasinya di Claude Design (`--color-on-error`).

### Alternatives Considered

* **Override className solid di tiap call-site** (bukan ubah `badge.tsx`
  itu sendiri) — ditolak; variant `success`/`warning`/`destructive` dipakai
  di >10 file, override per-lokasi akan mudah divergen/keliru saat ada
  screen baru. Mengubah sumber cva sekali menjamin konsistensi ke depan,
  sesuai bagaimana ADR-098 sendiri menambahkan token di level Tailwind
  config, bukan per pemakaian.
* **Biarkan Analyze dashboard delta badge tetap soft** (kasus terpisah dari
  status chip) — dipertimbangkan, tapi ditolak untuk sesi ini karena
  Claude Design tidak mendokumentasikan varian solid-vs-soft terpisah untuk
  delta indicator, dan `badge.tsx` adalah komponen bersama tunggal — kalau
  ke depannya butuh varian soft terpisah untuk delta, itu perlu primitive/
  variant baru (di luar scope perbaikan bug hari ini), bukan pengecualian
  diam-diam di variant yang sama.

### Impact / Baseline yang diamandemen

* `apps/web/src/components/ui/badge.tsx` — 3 variant (`destructive`/
  `warning`/`success`) diubah dari tinted ke solid fill.
* `apps/web/src/app/globals.css` — token baru `--destructive-foreground`
  (`:root` + `.dark`) + wiring `@theme inline`.
* `apps/web/src/app/(app)/components/sidebar-channels/ChannelsSection.tsx`
  — 1 baris, `variant="secondary"` → `variant="success"` untuk state
  Active.
* Mengamandemen ADR-098 (menambah token, bukan mengubah nilai yang sudah
  ditetapkan di sana).
* Tidak ada baseline `product-discovery/` yang diamandemen — Claude Design
  (`components/status-chips.html`, `readme.md` UXP-04) sudah lebih dulu
  mendokumentasikan solid fill ini sejak awal, kode yang menyusul.

---
