## Decision ADR-054

### Title

Draft Editor — redirect otomatis ke sub-screen tujuan setelah aksi terminal
(Save as Draft / Schedule / Publish Now)

### Status

Accepted

### Date

2026-07-31

### Decision

Setelah salah satu dari tiga aksi terminal Draft Editor dieksekusi,
pengguna diarahkan ke sub-screen Publish yang menjadi tujuan konten —
bukan kembali ke sub-screen asal seperti pola tombol Close (KSP-05-F10):

- Save as Draft (KSP-05-F08) → Publish → Drafts
- Schedule Action (KSP-05-F09), setelah Confirmation Summary dikonfirmasi
  → Publish → Queue (perilaku ini sudah ada sejak awal di App Prototype,
  tidak berubah — baru diformalkan sebagai keputusan resmi di ADR ini)
- Publish Now (KSP-05-F12), setelah Confirmation Summary dikonfirmasi →
  Publish → History; karena History belum jadi layar terdokumentasi
  (KSP-D10), tujuan sementara adalah Publish → Calendar sampai layar itu
  dibangun

### Reason

- Sidebar CTA baru (ADR-053) membuat Draft Editor kini bisa dibuka dari
  section manapun (Home/Engage/Analyze/Settings), bukan cuma dari dalam
  Publish — sehingga "kembali ke asal" tidak lagi selalu masuk akal
  (misalnya asal = Analyze, tidak relevan menampilkan hasil Schedule di
  sana).
- Pengguna perlu langsung melihat hasil aksinya di section yang relevan —
  mendukung UXP-04 (Publishing Trust): kepercayaan datang dari melihat
  langsung bahwa aksi berhasil dan tahu ke mana harus mengecek statusnya.
- Tidak mengubah NP-D05 ("tidak ada redirect otomatis setelah
  cross-section navigation") — NP-D05 spesifik untuk kasus tautan status
  error → Settings, bukan aksi terminal form yang menghasilkan/mengubah
  konten. Didefinisikan sebagai pola terpisah (NP-D13).

### Alternatives Considered

- **Kembali ke sub-screen asal, sama seperti tombol Close (KSP-05-F10)**
  — ditolak; user eksplisit ingin diarahkan ke tab tujuan konten supaya
  hasil aksi langsung terlihat, bukan tertinggal di section yang mungkin
  sudah tidak relevan.
- **Publish Now tetap redirect ke Home (perilaku sebelumnya)** — ditolak;
  digantikan Calendar sebagai stand-in sementara History.

### Impact

- `product-discovery/04-ux/navigation-patterns.md` — pattern baru "Pola:
  Redirect setelah Aksi Terminal Draft Editor" ditambahkan di Contextual
  Navigation Pattern; Decision Log dapat entri NP-D13 baru; tabel
  Ringkasan Pola dapat baris baru. (Sudah dikerjakan langsung oleh main
  agent, bukan task Gibran Project Manager.)
- `product-discovery/04-ux/key-screen-patterns.md` — KSP-05-F08, F09, F12
  diberi catatan tujuan redirect; Decision Log dapat entri KSP-D15 baru.
  (Sudah dikerjakan langsung oleh main agent, bukan task Gibran Project
  Manager.)
- Claude Design (App Prototype,
  `templates/app-prototype/AppPrototype.dc.html`) — sudah
  diimplementasikan tanggal ini: fungsi `saveDraftFromEditor()` diubah
  dari sekadar menutup modal menjadi `go('publish-drafts', ...)`; handler
  `publishnow-confirm` diubah destinasi dari `'home'` ke
  `'publish-calendar'`. Handler `dialog-confirm` (Schedule) sudah
  mengarah ke `'publish-queue'` sejak file ini dibuat — tidak diubah,
  hanya baru diformalkan sebagai keputusan resmi.
- Implementasi kode `apps/web` belum berjalan — Schedule di kode nyata
  masih mock (lihat "Publishing MVP" di `PROJECT_STATE.md`), Publish Now
  belum ada implementasi kode sama sekali (ADR-047 masih menunggu
  implementasi).

---
