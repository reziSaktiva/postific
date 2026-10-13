## Decision ADR-071

### Title

Perluasan Bucket Supabase Storage `avatars` untuk Avatar User Personal (T-016.2)

### Status

Accepted — Amended by ADR-075 (2026-08-07)

### Date

2026-08-06

### Context

`database-strategy.md` (§ Storage Strategy, ditetapkan ADR-015) awalnya
mendefinisikan bucket publik `avatars` khusus untuk dua konsumen: **avatar
workspace** dan **avatar Start Page** — dengan konvensi path
`avatars/{workspace_id}/avatar.{ext}`.

Saat mengerjakan T-016.2 (`/account/profile` — edit nama + avatar user),
domain `identity` diisi pertama kali (`IIdentityRepository`,
`IAvatarStorageAdapter`, `IdentityService`) dan butuh tempat menyimpan avatar
milik **user personal** (bukan workspace) — entitas yang belum punya jalur
storage sama sekali di baseline sebelumnya.

Dua opsi yang dipertimbangkan: (a) bucket publik baru khusus avatar user,
atau (b) memperluas bucket `avatars` yang sudah ada untuk menampung path baru
`avatars/users/{user_id}/avatar.{ext}` di samping path workspace yang sudah
ada. Opsi (b) dipilih dan sudah dieksekusi (migration idempotent, lihat
Catatan implementasi) sebelum ADR ini ditulis — dokumen ini mencatat resmi
keputusan yang secara substansi sudah berjalan.

### Decision

1. Bucket Supabase Storage `avatars` (publik) diperluas cakupannya: bukan
   lagi khusus avatar workspace + Start Page, tapi juga menampung avatar user
   personal.
2. Konvensi path baru untuk avatar user: `avatars/users/{user_id}/avatar.{ext}`
   — dipisahkan dari path avatar workspace (`avatars/{workspace_id}/avatar.{ext}`)
   lewat prefix `users/` supaya tidak collide dan mudah dibedakan saat audit.
3. Tidak membuat bucket publik baru — satu bucket `avatars` tetap menaungi
   kedua jenis avatar (workspace dan user), karena keduanya sama-sama publik
   dengan alasan yang sama (ditampilkan di UI tanpa signed URL, termasuk
   Start Page yang halaman publik).
4. `database-strategy.md` § Storage Strategy diupdate merefleksikan
   perluasan ini (tabel bucket + alasan public + contoh path).

### Reason

* Avatar user personal punya sifat storage yang identik dengan avatar
  workspace (publik, kecil, tidak sensitif) — tidak ada alasan teknis untuk
  bucket terpisah, dan menambah bucket baru berarti menambah permission/RLS
  storage baru tanpa manfaat yang jelas.
* Prefix path (`users/` vs path workspace langsung) sudah cukup untuk
  memisahkan namespace tanpa perlu bucket kedua.
* Konsisten dengan pola `IAvatarStorageAdapter` yang meniru
  `IOutstandAdapter` — satu adapter, satu bucket, path ditentukan oleh
  pemanggil (workspace atau user).

### Alternatives Considered

* **Bucket publik baru khusus avatar user** (misal `user-avatars`). Ditolak
  — menambah satu entity Supabase Storage lagi (policy, RLS, bucket
  management) untuk kebutuhan yang secara sifat data sudah identik dengan
  bucket `avatars` yang ada; tidak ada requirement isolasi akses yang
  mengharuskan pemisahan.

### Impact / Baseline yang diamandemen

* `product-discovery/05-architecture/database-strategy.md` § Storage
  Strategy — tabel bucket (baris `avatars`), alasan public, dan contoh
  Naming Convention File (tambah baris `avatars/users/{user_id}/avatar.{ext}`).
  Ini perubahan struktural pada Static Reference — dicatat juga di
  `COMPLETE_TASK.md` sesuai `PROJECT_RULES.md`.

### Catatan implementasi

* Migration idempotent:
  `apps/web/prisma/migrations/20260806120000_extend_avatars_bucket_user_profile/migration.sql`
  — `insert into storage.buckets (id, name, public) values ('avatars',
  'avatars', true) on conflict (id) do nothing;`. Raw SQL (bukan digenerate
  dari `schema.prisma`) karena `storage.buckets` adalah tabel milik Supabase
  Storage, bukan model Prisma domain.
* Sudah diterapkan ke environment dev dan dikonfirmasi via `listBuckets()`
  (bucket sebelumnya memang belum eksis di dev, sehingga migration ini juga
  yang pertama kali membuatnya di environment tersebut).
* Diimplementasikan sebagai bagian `SupabaseAvatarStorageAdapter`
  (`apps/web/src/lib/adapters/avatar-storage/`), dipanggil dari
  `IdentityService` (`apps/web/src/domains/identity/`) — verifikasi end-to-end
  upload avatar user asli via browser sudah PASS (lihat T-016.2 di
  `tasks/v01-foundation.md`).

---
