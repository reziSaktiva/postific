## Decision ADR-145

### Title

Foto Profil Start Page Diunggah ke Storage dengan Nama Berkas Unik per Unggahan (T-159; Mengamandemen ADR-071 dan ADR-144)

### Status

Accepted

### Date

2026-10-28

### Context

ADR-144 menunda unggah avatar Start Page dan memakai URL https. T-159 menggantikannya dengan unggah berkas ke bucket publik `avatars`. ADR-071 dan `database-strategy.md` menetapkan path `avatars/{workspace_id}/avatar.{ext}`, yaitu satu path tetap per ekstensi yang ditimpa dengan `upsert`.

Review PR 203 menemukan dua masalah pada path tetap:

- Bila tulis database gagal sesudah unggah, rollback menghapus path yang sama, sehingga foto lama yang masih dirujuk `avatarUrl` ikut hilang dan halaman publik menampilkan gambar rusak.
- Berkas di bucket sudah berganti sebelum ada jaminan database tersimpan, jadi URL lama (tanpa cache-bust) bisa menampilkan gambar lama atau campuran.

### Decision

1. Foto profil Start Page diunggah ke bucket `avatars` di folder workspace dengan **nama unik per unggahan**: `avatars/{workspace_id}/avatar-{uuid}.{ext}`, tanpa `upsert`. Folder `avatars/{workspace_id}/` dan bucket tetap sama seperti ADR-071.
2. Urutan: unggah berkas baru, tulis `avatarUrl` ke database, lalu hapus berkas lain di folder workspace. Bila tulis database gagal, hanya berkas baru yang dihapus. Menghapus foto (`avatarUrl: null`) menghapus semua berkas di folder.
3. Cache-bust `?v=` tidak dipakai lagi; URL baru otomatis berbeda.
4. Validasi di server: JPG/PNG, maksimal 2MB (konstanta dibagi dengan domain `identity`), dan byte awal berkas dicocokkan dengan tipe yang diklaim. Ukuran dicek sebelum berkas dibaca ke memori.
5. Pembersihan hanya menyentuh berkas berpola `avatar-{uuid}.{jpg|png}` di folder workspace dan hanya yang lebih tua dari 10 menit (menghindari saling hapus pada simpan serentak dan berkas non-Start-Page, diperjelas 2026-10-28 dari hasil code-review PR 203).
6. Kegagalan hapus berkas bersifat best-effort: dicatat ke log, tidak menggagalkan simpan profil. Berkas yatim tetap mungkin tertinggal dan dibersihkan pada simpan berikutnya.
7. Domain `start-page` tidak memanggil Supabase: port `IStartPageAvatarStorage` (`uploadAvatar`, `deleteAvatar`, `deleteOtherAvatars`), implementasi di `apps/web/src/lib/adapters/avatar-storage/`.

### Reason

Nama unik membuat unggah tidak merusak berkas yang sedang dirujuk database, jadi rollback aman dan tidak butuh transaksi lintas Storage dan Postgres. Satu bucket dan satu folder per workspace tetap dipakai, sehingga tidak ada migrasi bucket.

### Alternatives Considered

- **Path tetap dengan `upsert` (ADR-071).** Ditolak: rollback menghapus foto lama dan unggah tidak aman terhadap kegagalan.
- **Cadangkan berkas lama sebelum menimpa.** Ditolak: lebih banyak operasi Storage dan tetap rawan bila proses mati di tengah.

### Impact / Baseline yang diamandemen

- ADR-071 poin 2 (path avatar workspace) berlaku sebagai folder; nama berkas Start Page kini `avatar-{uuid}.{ext}`.
- ADR-144: bagian "avatar URL https (upload ditunda)" digantikan oleh unggah berkas. Validasi `avatarUrl` https di sisi render tetap.
- `product-discovery/05-architecture/database-strategy.md` § Storage Strategy: contoh path diperbarui.

---
