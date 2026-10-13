## Decision ADR-039

### Title

Content Format (Post / Reel / Story / Pin) masuk MVP Publishing

### Status

Accepted — Amended by ADR-107 (2026-09-14)

### Date

2026-07-21

### Decision

1. MVP **wajib** mendukung pemilihan format publikasi per akun tujuan (`PostTarget`), bukan satu tipe generik “post” saja.
2. Matriks MVP:
   * **Instagram & Facebook:** `post` · `reel` · `story`
   * **TikTok:** `post` (tanpa selector Reel/Story di UI — selaras kemampuan/UX Outstand)
   * **Pinterest:** `pin` (+ metadata: title, destination link, board)
   * **Twitter/X, LinkedIn, YouTube, Threads:** `post` (default)
3. Source of Truth enum: `ContentFormat` di `packages/shared`. Field domain: `PostTarget.contentFormat` + optional `platformOptions`.
4. Outstand memfasilitasi format ini di API/produk mereka; ACL (`OutstandAdapter`) memetakan `ContentFormat` → override Outstand. Domain tidak mengimpor kontrak Outstand mentah.
5. UX: Content Format Selector di Draft Editor (KSP-05), **per akun** yang dipilih.

### Reason

* Product owner menetapkan fitur ini **harusnya ada di MVP** setelah membandingkan UI Create Post Outstand (FB/IG menampilkan Post·Reel·Story; TikTok/Pinterest berbeda).
* Tanpa format di model & UI, app kita tidak setara kemampuan provider integrasi dan kebutuhan publishing harian Marketing Team.
* Menyimpan format per `PostTarget` mendukung multi-account posting tanpa memaksa satu format untuk semua jaringan.

### Alternatives Considered

* MVP hanya feed `post`; Story/Reel post-MVP — ditolak oleh PM (opsi 1: MVP sekarang).
* Satu format global per `Post` — ditolak; bentrok multi-platform & multi-account.
* Meniru UI Buffer 1:1 tanpa matriks Outstand — ditolak; TikTok/Pinterest tidak memakai radio Post/Reel/Story yang sama.

---
