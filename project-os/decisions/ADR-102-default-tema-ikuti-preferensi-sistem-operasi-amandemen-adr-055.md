## Decision ADR-102

### Title

Default Tema Ikuti Preferensi Sistem Operasi — Amandemen ADR-055

### Status

Accepted

### Date

2026-09-08

### Decision

Default tema aplikasi (saat cookie `theme` belum pernah ditulis, artinya
user belum pernah menekan toggle Light/Dark secara eksplisit) tidak lagi
hardcode ke **Light**, melainkan mengikuti preferensi sistem operasi user
(`prefers-color-scheme`). Begitu user menekan toggle Light/Dark eksplisit
di Settings → Account → Preferences, cookie `theme` ditulis dan menjadi
preferensi permanen yang **override** sistem — perilaku toggle itu sendiri
tidak berubah.

Ini mengamendemen ADR-055 (yang menetapkan default selalu Light) dan
melanjutkan mekanisme persistensi cookie yang sudah pernah disinggung di
ADR-097 poin 9 ("mengamendemen ADR-055 — mekanisme toggle" dipersist via
cookie, bukan reset ke Light tiap reload).

Mekanisme teknis (tetap menjaga prinsip "no flash" dari ADR-055):

> **Amendemen mekanisme (2026-10-29, T-177, KI-104):** butir 1 di bawah
> ditulis dengan `<Script strategy="beforeInteractive">`. Ternyata di App
> Router `next/script` `beforeInteractive` TIDAK menjadi `<script>` inline yang
> berjalan saat HTML di-parse: Next mengantrekannya ke `self.__next_s`, yang
> baru dieksekusi (`loadScriptsInSequence`, `next/dist/client/app-bootstrap.js`)
> setelah chunk framework dimuat, sehingga halaman sempat dilukis terang
> dulu. Mekanisme yang berlaku sekarang: `<script>` inline biasa di `<head>`
> (`dangerouslySetInnerHTML`, isi dari `SYSTEM_DARK_CLASS_SCRIPT` di
> `lib/theme/theme-cookie.ts`), dengan `nonce` dari header `x-nonce` di `/u/*`
> (CSP `strict-dynamic`, T-160). Keputusan produknya (default ikuti OS,
> cookie eksplisit menang, prinsip "no flash") TIDAK berubah; hanya cara
> pemasangan skripnya. Jangan kembalikan ke `next/script`.

1. `apps/web/src/app/layout.tsx` — kalau cookie `theme` tidak ada di
   request, RSC merender `<script>` inline sinkron di `<head>` (semula
   `<Script id="theme-system-default" strategy="beforeInteractive">`, lihat
   amendemen di atas) yang langsung menambahkan class `dark`
   ke `<html>` SEBELUM `<body>` dilukis (kalau
   `matchMedia("(prefers-color-scheme: dark)").matches`), plus
   `suppressHydrationWarning` di `<html>`.
2. `apps/web/src/components/Providers.tsx` — state `mode` React tetap
   diinisialisasi identik dengan `initialMode` dari server (mencegah
   hydration mismatch di semua consumer seperti toggle icon
   `WorkspaceSideNav`/`Toaster`), lalu dikoreksi ke preferensi OS lewat
   `useLayoutEffect` (bukan `useEffect` biasa) SEBELUM browser paint
   pertama kalau belum ada cookie — jadi tidak pernah ada frame yang
   menampilkan state salah. Auto-persist cookie yang sebelumnya jalan di
   `useEffect` tiap render dipindah supaya HANYA terjadi saat user
   benar-benar menekan toggle (`toggleMode()`), bukan otomatis saat mount
   — supaya default hasil deteksi sistem tidak langsung "terkunci" jadi
   preferensi eksplisit sebelum user memilih.

`DEFAULT_THEME_MODE` di `apps/web/src/lib/theme/theme-cookie.ts` tetap ada
sebagai fallback terakhir (mis. SSR tanpa akses `matchMedia`, atau
environment yang tidak mendukung `prefers-color-scheme`), bukan dihapus.

### Reason

- King Rezi meminta default tema mengikuti preferensi OS user — pola umum
  aplikasi modern (mis. dark mode otomatis untuk user yang OS-nya di-set
  dark), mengurangi friksi user harus toggle manual setiap kali baru
  install/clear cookie.
- Preferensi eksplisit user (hasil toggle) tetap harus menang atas deteksi
  sistem begitu ada — konsisten dengan ekspektasi umum: sekali user
  memilih, pilihan itu permanen sampai diubah lagi, tidak ditimpa ulang
  oleh perubahan preferensi OS di kemudian hari.
- Prinsip "no flash" dari ADR-055/ADR-097 harus tetap terjaga — solusi
  React `useEffect` biasa (jalan setelah paint) akan menyebabkan flash
  tema salah selama sepersekian detik; `useLayoutEffect` + inline
  skrip inline di server dipilih spesifik untuk mencegah ini (semula
  `<Script beforeInteractive>`, diganti `<script>` inline sinkron pada
  T-177, lihat amendemen mekanisme di atas).

### Alternatives Considered

- **Resolve preferensi OS langsung di lazy initializer `useState`** —
  dicoba pertama, ditolak setelah review Ridwan Architecture Reviewer
  menemukan ini menyebabkan hydration mismatch baru (toggle icon/label di
  `WorkspaceSideNav` sempat menampilkan state salah sesaat sebelum
  dikoreksi) — server selalu merender `initialMode` dari cookie/default,
  sedangkan client langsung resolve ke preferensi OS di initializer,
  membuat markup awal client berbeda dari HTML yang dikirim server.
  Diperbaiki dengan pola `useLayoutEffect` (koreksi setelah mount, sebelum
  paint) yang dikombinasikan inline script server-side untuk mencegah
  flash.
- **Auto-persist cookie tetap jalan di setiap render/mount (perilaku
  lama)** — ditolak; kalau tetap dipertahankan, hasil deteksi OS akan
  langsung ditulis ke cookie saat mount pertama, membuatnya "terkunci"
  seolah-olah preferensi eksplisit user padahal user belum pernah memilih
  apa-apa — merusak niat mengikuti OS secara dinamis. Auto-persist
  dipindah supaya hanya terjadi saat `toggleMode()` benar-benar dipanggil
  user.
- **Tetap default Light selamanya (status quo ADR-055)** — ditolak atas
  permintaan eksplisit King Rezi di sesi ini.

### Impact

- File yang diubah: `apps/web/src/app/layout.tsx`,
  `apps/web/src/components/Providers.tsx`. `DEFAULT_THEME_MODE` di
  `apps/web/src/lib/theme/theme-cookie.ts` tidak dihapus, tetap dipakai
  sebagai fallback.
- Branch: `feature/t-039-4-onboarding-workspace-picker` — sudah di-commit &
  push, ikut dalam PR [#109](https://github.com/reziSaktiva/social-media-management/pull/109) ke `staging` (di branch yang sama dengan
  T-039.4 karena diminta King Rezi tepat setelah T-039.4 selesai, di sesi
  kerja yang sama), belum di-merge.
- Bukan task backlog formal (`TASKS.md`/`tickets/vXX-*.md`) — permintaan
  ad-hoc King Rezi di luar scope T-039.4, tidak menambah entri task baru.
- Verifikasi: typecheck bersih, lint bersih, 272 unit test pass (tidak ada
  test baru khusus ditambahkan untuk logic ini — dicatat sebagai gap,
  konsisten dengan keputusan sebelumnya untuk tidak over-test
  timing-sensitive React effect di codebase ini tanpa precedent test
  serupa). Diverifikasi manual di browser (emulasi `prefers-color-scheme`
  dark & light, toggle eksplisit tetap menulis cookie dengan benar).
- Tidak mengubah struktur ADR-055/ADR-097 lain (toggle, lokasi kontrol,
  Claude Design) — murni mengubah resolusi _default_ saat cookie belum
  ada.

---
