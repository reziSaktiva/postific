## Decision ADR-053

### Title

Sidebar mendapat CTA "+ New Post" pinned, tersedia dari section manapun

### Status

Accepted

### Date

2026-07-31

### Decision

Sidebar (Persistent Sidebar Navigation, NP-D01 di `navigation-patterns.md`)
mendapat satu zona baru — CTA "+ New Post" (primary, full-width) — dipin
tepat di bawah Workspace Selector dan di atas navigation items (Home/
Publish/Engage/Analyze/Start Page). Tersedia dari section manapun,
melengkapi (bukan menggantikan) CTA "New Post" yang sudah ada di layar
Calendar/Queue/Drafts (NP-D09).

### Reason

- User ingin New Post lebih cepat diakses dari section manapun (Home/
  Engage/Analyze/Settings), bukan hanya saat sedang berada di dalam
  Publish.
- Pola umum di tools produktivitas sejenis (Linear "New Issue", Notion
  "New Page", Slack compose) menaruh CTA utama di puncak sidebar — posisi
  paling menonjol dan konsisten dengan ekspektasi pengguna.

### Alternatives Considered

- **CTA di sidebar-footer (bawah, dekat notifikasi/avatar)** — ditolak;
  posisi bawah lazim untuk aksi sekunder, bukan CTA utama.
- **CTA disisipkan di antara navigation items** — ditolak; beda semantik
  (nav item = link berpindah section, CTA = aksi membuka form).

### Impact

- `product-discovery/04-ux/navigation-patterns.md` — diagram "Model
  Navigasi Utama" dan "Struktur Sidebar" diperbarui menambah zona CTA;
  NP-D09 diberi catatan silang; Decision Log dapat entri NP-D12 baru;
  tabel Ringkasan Pola dapat baris baru. (Sudah dikerjakan langsung oleh
  main agent, bukan task Gibran Project Manager.)
- Claude Design (project "Social Media Management") — sudah
  diimplementasikan tanggal ini di 7 layar shell (`home.html`,
  `publish-calendar.html`, `publish-queue.html`, `publish-drafts.html`,
  `engage-inbox.html`, `analyze-dashboard.html`,
  `settings-connected-accounts.html`) + `components/navigation.html`
  (file spec) + `styles.css` (class baru `.sidebar-cta`). Tombol "New
  Post" yang sudah ada di Calendar/Queue/Drafts dipertahankan, tidak
  dihapus.
- Implementasi kode `apps/web` belum berjalan — menyusul di siklus
  implementasi berikutnya.

---
