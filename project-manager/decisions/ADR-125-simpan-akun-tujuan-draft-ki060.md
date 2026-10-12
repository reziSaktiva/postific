## Decision ADR-125

### Title

Simpan akun tujuan bersama draft, lalu isi kembali Account Selector saat draft dibuka (KI-060, KI-032)

### Status

Accepted

### Date

2026-10-12

### Decision

Save Draft dan Update Draft ikut menulis akun tujuan ke `PublishingPostTarget`
(akun, content format, dan `platformOptions` seperti board/judul/link
Pinterest). Saat draft atau post terjadwal dibuka lagi di Draft Editor,
Account Selector diisi dari data itu.

Array kosong mengganti target yang tersimpan (semua akun tidak dicentang).
Kalau field target tidak dikirim, target yang sudah ada tidak diubah —
jalur Schedule dan Publish Now tetap menulis target lewat alurnya sendiri.

Tanggal dan jam jadwal tidak ikut disimpan pada Save Draft.

### Reason

- KI-060: membuka ulang draft menampilkan caption dan media, tetapi semua
  checkbox akun kosong. Save Draft sebelumnya hanya menulis caption dan
  media, jadi tidak ada akun yang bisa diisi kembali.
- KI-032: Publish Now dari Queue tidak bisa langsung ke langkah konfirmasi
  karena akun yang sudah dijadwalkan tidak dimuat. Data itu sudah ada di
  `PublishingPostTarget`; yang kurang adalah membacanya saat editor dibuka.
- Baseline UX (KSP-05) sudah menyebut batasan ini sebagai sesuatu yang
  menunggu perluasan persistensi, di luar scope ADR-052.

### Alternatives Considered

- Hanya mengisi checkbox kalau target sudah ada di database, tanpa
  menyimpan akun saat Save Draft. Itu menutup KI-032, tetapi draft yang
  baru disimpan tetap kehilangan akun yang dipilih (KI-060).
- Menyimpan tanggal dan jam jadwal sekaligus. Tidak diminta KI-060 dan
  tetap kosong sampai ada keputusan terpisah.
