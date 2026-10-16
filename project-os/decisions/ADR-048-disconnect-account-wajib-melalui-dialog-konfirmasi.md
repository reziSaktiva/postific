## Decision ADR-048

### Title

Disconnect Account — Wajib Melalui Dialog Konfirmasi

### Status

Accepted

### Date

2026-07-29

### Context

Audit menyeluruh atas seluruh aksi produk (dipicu diskusi Safety Check /
Double Confirmation untuk Publish Now, ADR-047) menemukan bahwa
**Disconnect Account** (KSP-08-F05) sama sekali tidak punya spesifikasi
konfirmasi di `key-screen-patterns.md` — hanya "pengguna dapat melepas
koneksi akun". Ini berbeda dari kasus Remove Member/Transfer
Ownership/Delete Workspace (yang screen-nya sendiri belum pernah
dirancang) karena Disconnect Account **sudah** punya screen resmi
(KSP-08, salah satu dari 8 KSP) dan sudah diimplementasikan di App
Prototype Claude Design (`settings-connected-accounts.html`) — jadi gap
ini langsung actionable tanpa perlu merancang layar baru.

### Decision

1. Disconnect Account **wajib** menampilkan dialog konfirmasi sebelum
   eksekusi — fungsi baru **KSP-08-F07 (Disconnect Confirmation)**.
2. Dialog ini **bukan** varian dari Confirmation Summary (KSP-05-F06,
   dipakai Schedule/Publish Now) — cukup peringatan singkat + dua tombol
   (`Batal` / `Putuskan Koneksi`), karena Disconnect bukan aksi
   mempublikasikan konten dan tidak perlu ringkasan multi-field.
3. Isi dialog wajib mengingatkan konsekuensi yang sudah didokumentasikan
   di KSP-D09: post yang sudah terjadwal untuk akun ini **tetap di
   antrean**, tidak otomatis dibatalkan.
4. Tidak ada perubahan RBAC — akses Disconnect tetap Owner/Admin saja,
   sesuai `roles-permissions.md` yang sudah ada ("Tambah/hapus connected
   accounts").
5. `key-screen-patterns.md` — pola baru "Pola: Disconnect Flow" + baris
   Decision Log KSP-D14.

### Reason

- UXP-04 (Publishing Trust) berlaku juga di sini secara tidak langsung:
  memutus akun yang punya post terjadwal aktif adalah aksi yang bisa
  mengejutkan pengguna kalau dieksekusi tanpa peringatan — walau bukan
  aksi publish itu sendiri.
- Disconnect Account adalah satu-satunya dari 4 aksi berisiko yang
  ditemukan saat audit (bersama Remove Member, Transfer Ownership, Delete
  Workspace) yang sudah punya screen nyata — jadi bisa diselesaikan
  sekarang tanpa menunggu desain layar Workspace Settings lain yang lebih
  besar scope-nya.

### Alternatives Considered

- **Pakai pola Confirmation Summary yang sama seperti Schedule/Publish
  Now** — ditolak; Disconnect tidak punya data multi-field (caption,
  akun, waktu) untuk diringkas — dialog peringatan sederhana sudah cukup
  dan tidak menambah friksi yang tidak perlu (UXP-03).
- **Tidak menambah apa pun, biarkan sebagai gap terdokumentasi** —
  ditolak; user secara eksplisit meminta gap ini diperbaiki begitu
  ditemukan saat audit, bukan sekadar dicatat.

### Impact

- `key-screen-patterns.md`, `roles-permissions.md` sudah diselaraskan.
- Remove Member, Transfer Ownership, dan Delete Workspace **sengaja tidak
  disentuh** oleh ADR ini — screen-nya belum pernah dirancang, ditunda ke
  inisiatif terpisah (lihat diskusi sesi 2026-07-29).
- Implementasi App Prototype (dialog Disconnect Confirmation di
  `settings-connected-accounts.html` + `AppPrototype.dc.html`) dan kode
  nyata belum berjalan — task lanjutan terpisah.

---
