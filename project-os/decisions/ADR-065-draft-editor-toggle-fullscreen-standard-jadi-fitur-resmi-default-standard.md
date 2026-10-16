## Decision ADR-065

### Title

Draft Editor — Toggle Fullscreen/Standard Naik Status jadi Fitur Resmi, Default Diubah ke Standard (Amandemen ADR-052)

### Status

Accepted

### Date

2026-08-05

### Decision

Toggle Fullscreen/Standard di header dialog Draft Editor (New Post & Edit
Draft, KSP-05) — sebelumnya alat bantu perbandingan sementara untuk fase
Design System (ADR-052, addendum "Variant Dialog dibuka kembali untuk
perbandingan") — diangkat jadi **fitur resmi produk**, akan dibawa ke
implementasi kode `apps/web` (bukan lagi dibuang setelah fase desain
selesai). Detail:

- **Cakupan:** New Post dan Edit Draft, keduanya (sama seperti ADR-052).
- **Default tampilan diubah dari Fullscreen → Standard** (`.dialog-lg-backdrop`/
  `.dialog-lg` — floating card + dimmed backdrop) — override eksplisit
  terhadap ADR-052 addendum "Koreksi: default dikembalikan ke Fullscreen".
  Klik toggle beralih ke **Fullscreen** (`.dialog-fs` — menutupi seluruh
  viewport, tanpa backdrop gelap terlihat by design).
- **Posisi toggle tidak berubah** — tetap di header dialog, sebaris status
  chip, di sebelah kiri tombol Close (✕).
- **Tidak dipersist** — pilihan toggle reset setiap dialog dibuka ulang;
  selalu mulai dari Standard lagi. Pola ini sama dengan Light/Dark Mode
  Toggle (ADR-055) yang juga session-only per screen load.
- **Implementasi kode belum berjalan** — ADR ini hanya menetapkan keputusan
  - update Design System (Claude Design). Tahap 3 (implementasi `apps/web`)
    menyusul terpisah, sesuai pola kerja bertahap ADR-052/ADR-051.

### Reason

- User (King Rezi) menegaskan toggle ini bukan lagi sekadar alat banding
  internal fase desain — dua variant Fullscreen/Standard akan benar-benar
  dipakai user produk untuk berpindah tampilan dialog Draft Editor.
- Default Standard dipilih sebagai tampilan awal yang lebih jelas terlihat
  sebagai modal (floating card + backdrop gelap) dibanding Fullscreen yang
  sengaja tanpa backdrop — konsisten dengan alasan awal kenapa toggle ini
  pertama kali diminta (ADR-052 addendum: "tidak terasa seperti pakai
  komponen Dialog/Modal").
- Non-persistensi dipilih supaya tidak menambah kompleksitas state
  (localStorage/preference) untuk keputusan yang scope-nya baru soal
  tampilan awal + kontrol switch — bukan preferensi jangka panjang per user.

### Alternatives Considered

- **Toggle dipersist per user (localStorage/preference)** — ditolak untuk
  saat ini; King Rezi memilih reset tiap buka dialog supaya implementasi
  tetap sederhana. Bisa dipertimbangkan lagi lewat ADR baru kalau nanti
  ada kebutuhan nyata.
- **Tetap default Fullscreen, toggle hanya jadi shortcut ke Standard** —
  ditolak; King Rezi eksplisit meminta default berubah ke Standard.
- **Pertahankan toggle sebagai alat banding sementara (tidak dibawa ke
  `apps/web`)** — ditolak; keputusan baru ini justru membalik premis
  tersebut secara sengaja.

### Impact

- Claude Design (project "Social Media Management", projectId
  `84aded99-bb23-49b1-be9f-dd8f21c6873e`):
  - `templates/draft-editor.html` — default `variant` diubah ke
    `'standard'`, komentar & tooltip toggle diperbarui.
  - `templates/app-prototype/AppPrototype.dc.html` — `state.dialogVariant`
    default diubah ke `'standard'`, komentar & tooltip toggle diperbarui.
  - `readme.md` — section baru "Draft Editor Dialog Variant Toggle
    (official product feature, ADR-065)", "Don't" list dikoreksi (hapus
    larangan ship kedua variant), "Direction"/"Components"/"Files"/"How to
    Demo" diperbarui mengikuti default baru.
- `project-os/DECISIONS.md` — baris indeks baru untuk ADR-065.
- `project-os/PROJECT_STATE.md` — tidak ada perubahan phase/milestone;
  tidak diupdate lebih lanjut di luar indeks ADR (lihat Recent Decisions
  kalau perlu digeser).
