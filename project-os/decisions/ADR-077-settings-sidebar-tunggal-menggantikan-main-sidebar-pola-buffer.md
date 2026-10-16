## Decision ADR-077

### Title

Settings Pakai Sidebar Tunggal yang Menggantikan Main Sidebar (Pola Buffer) — Amandemen Mekanisme Render ADR-076

### Status

Accepted

### Date

2026-08-11

### Context

ADR-076 mengonsolidasikan Settings jadi satu section dua grup (Organization +
Account), tapi tidak menetapkan _mekanisme render_-nya secara eksplisit di
teks ADR — mekanisme itu ditentukan lewat implementasi T-016.1 (v0.1) dan
diwarisi apa adanya oleh migrasi T-039.1-3: `SettingsSideNav` dirender
sebagai **secondary nav di dalam content area** (`Layout` + `LayoutPanel
role="navigation"` + `LayoutContent`), sementara main sidebar workspace
(`WorkspaceSideNav` — workspace switcher, Home/Publish/Engage/Analyze/Start
Page, Channels) tetap tampil berdampingan di kolom paling kiri, disuplai
oleh `AppShell` yang sama di `apps/web/src/app/(app)/layout.tsx`. Komentar
kode di `settings/layout.tsx` dan `SettingsSideNav.tsx` bahkan menyatakan
eksplisit bahwa pola ini "bukan pengganti WorkspaceSideNav primary" — sebuah
keputusan sadar pada saat itu.

King Rezi membagikan screenshot halaman Settings Buffer sebagai referensi
dan meminta pola itu ditiru: saat masuk Settings, main sidebar workspace
**hilang total**, digantikan satu sidebar khusus Settings di slot yang sama,
dengan header "← Settings" (back arrow + label) di atasnya yang menaut balik
ke halaman utama app. Dua sidebar berdampingan seperti kondisi sekarang
tidak ada di pola Buffer.

Desain untuk pola ini sudah dikerjakan langsung oleh King Rezi di Claude
Design (bukan lewat Neymar/subagent) — `readme.md` project Claude Design
sudah memuat class `.settings-sidebar`/`.settings-sidebar-header`/
`.settings-back-btn`/`.settings-sidebar-title` dan deskripsi pola ini
sebagai "T-039.1-4, Buffer-style single sidebar", jadi baseline ini
mengikuti apa yang sudah dikonfirmasi di sana, bukan mendahuluinya.

### Decision

1. **Main sidebar workspace digantikan total** oleh sidebar khusus Settings
   saat pengguna berada di bawah `/settings` — bukan ditambah sebagai
   sidebar kedua. Slot `sideNav` pada `AppShell` (`apps/web/src/app/(app)/
layout.tsx`) menjadi kondisional per-route: di luar `/settings` tetap
   `WorkspaceSideNav`, di dalam `/settings` menjadi `SettingsSideNav`.
2. **`SettingsSideNav` mendapat header back-navigation** di bagian atas:
   ikon back (←) + label "Settings", murni navigasi kembali ke halaman
   utama app (bukan submit/reload).
3. **Taksonomi grup Organization + Account tidak berubah** — keputusan
   ADR-076 Decision #3 (daftar item per grup) tetap berlaku apa adanya.
   Ini murni perubahan mekanisme render, bukan perubahan konten/struktur
   informasi.
4. **Cakupan perubahan terbatas pada halaman Settings saja.** Halaman lain
   (Home, Publish, Engage, Analyze, Start Page) tetap memakai
   `WorkspaceSideNav` seperti sekarang — tidak ada pola "contextual
   sidebar" baru yang diperluas ke section lain lewat ADR ini.
5. **Secondary nav berbasis `LayoutPanel` di dalam content area
   (`settings/layout.tsx`) dihapus** setelah sidebar-nya pindah ke slot
   `AppShell` — content area Settings jadi full-width, tanpa dua kolom
   sidebar seperti kondisi sebelumnya.

### Reason

- Dua sidebar berdampingan di halaman Settings (main sidebar + secondary
  nav) adalah pola transisi bawaan implementasi awal (T-016.1), bukan
  keputusan desain yang pernah eksplisit dibandingkan dengan alternatif
  single-sidebar — begitu ada referensi konkret (Buffer) yang menunjukkan
  pola lebih sederhana, King Rezi memilih menyelaraskan ke situ.
- Sidebar tunggal dengan tombol back mengurangi luas visual yang dipakai
  chrome navigasi di halaman yang secara sadar "bukan layar kerja harian"
  (IA-D05) — konsisten dengan alasan Settings ditaruh di luar primary nav
  sejak awal.
- Taksonomi grup (Organization/Account) sengaja dipertahankan karena
  ADR-076 baru saja merapikannya lewat proses konfirmasi eksplisit dengan
  King Rezi — tidak ada alasan baru untuk mengubahnya di ADR ini.
- Desain sudah dikerjakan lebih dulu di Claude Design oleh King Rezi
  sendiri (bukan proses AI-first), jadi ADR ini mendokumentasikan
  keputusan yang sudah dibuat, bukan mengusulkan opsi baru.

### Alternatives Considered

- **Pertahankan dua sidebar berdampingan seperti sekarang.** Ditolak —
  bukan lagi yang diinginkan King Rezi setelah melihat referensi Buffer;
  juga tidak efisien secara ruang untuk halaman yang bukan akses harian.
- **Main sidebar tetap ada, tapi isinya berubah jadi ringkas (collapsed)
  saat di Settings.** Ditolak — lebih rumit diimplementasikan (perlu state
  collapsed baru di `WorkspaceSideNav`) dibanding cukup menyuplai komponen
  sidebar berbeda ke slot yang sama; juga tidak sesuai referensi Buffer
  yang menggantikan total.
- **Perluas pola "sidebar tunggal saat masuk sub-section" ke section lain**
  (mis. Publish, Analyze). Ditolak untuk ADR ini — di luar scope yang
  diminta (murni halaman Settings); bisa dievaluasi terpisah kalau
  dibutuhkan nanti.

### Impact / Baseline yang diamandemen

- `product-discovery/04-ux/information-architecture.md` — "Secondary
  Navigation" (deskripsi mekanisme akses) dan section "6. Settings"
  (deskripsi render: sidebar tunggal menggantikan primary, bukan coexist).
- `product-discovery/04-ux/navigation-patterns.md` — section "Settings"
  (tambah deskripsi back-navigation), NP-D07, tabel ringkasan pola
  navigasi, dan catatan "tidak ada tombol back otomatis" (direvisi karena
  Settings sekarang justru punya tombol back permanen — pengecualian dari
  pola umum itu).
- `project-os/tickets/v01-foundation.md` — task T-039 mendapat subtask
  baru untuk migrasi kode pola sidebar ini di `apps/web` (`AppShell`
  `sideNav` kondisional per-route, hapus `LayoutPanel` secondary nav,
  tambah header back-navigation di `SettingsSideNav`).
- **Tidak berubah:** taksonomi grup Organization/Account (ADR-076 Decision
  #3), entry point ke Settings via avatar/user menu (NP-D07 tetap valid
  untuk _cara masuk_, hanya _apa yang terjadi setelah masuk_ yang berubah).

### Catatan implementasi

- **Baseline-only pada perubahan ini** — desain sudah selesai di Claude
  Design (readme.md project sudah memuat pola `.settings-sidebar`), tapi
  kode `apps/web` (`AppShell` sideNav kondisional, hapus `LayoutPanel`
  secondary nav di `settings/layout.tsx`) belum dimigrasikan. Ditambahkan
  sebagai subtask baru di T-039 (`v01-foundation.md`).

---
