## Decision ADR-073

### Title

Prisma External Tables (`initShadowDb`) untuk Shadow Database Menangani Tabel Platform Supabase — Resolusi KI-016

### Status

Accepted

### Date

2026-08-07

### Context

`prisma migrate dev` gagal dengan error **P3006** setiap kali menjalankan
migrasi baru. Root cause: Prisma me-replay **seluruh** migration history ke
shadow database kosong untuk validasi setiap kali. Migration lama
`apps/web/prisma/migrations/20260806120000_extend_avatars_bucket_user_profile/migration.sql`
berisi raw SQL:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
```

`storage.buckets` adalah tabel milik **Supabase Storage** — bukan model
Prisma, sehingga tidak pernah ada di shadow database kosong yang dibuat
ulang dari nol. Setiap replay migration history gagal di statement ini.

Untuk migrasi `20260807061502_add_workspace_invitations`, tim sempat memakai
workaround manual (`prisma migrate diff` ke DB live + `prisma db execute` +
`prisma migrate resolve --applied`) — ini tercatat sebagai **KI-016**
karena workaround itu harus diulang untuk **setiap** migrasi Prisma
berikutnya kalau tidak ditangani permanen. Constraint keras: migration.sql
yang sudah applied di DB bersama **tidak boleh diubah** (checksum
mismatch di environment lain). Solusi harus di level konfigurasi shadow DB
saja, bukan mengedit migration history.

Baseline `database-strategy.md` dan `database-orm.md` sebelumnya sama
sekali tidak menyebut mekanisme shadow database — KI-016 eksplisit minta
keputusan ini didokumentasikan.

### Decision

1. Memakai fitur resmi **Prisma 7 External Tables** untuk menandai
   `storage.buckets` sebagai tabel yang dimiliki platform lain (Supabase),
   bukan dikelola Prisma — tanpa mengubah `schema.prisma` maupun migration
   history yang sudah ada.
2. Konfigurasi di `apps/web/prisma.config.ts`:
   ```ts
   experimental: {
     externalTables: true,
   },
   migrations: {
     path: "prisma/migrations",
     initShadowDb: shadowDbInitScript, // isi SQL, dibaca dari file terpisah
   },
   tables: {
     external: ["storage.buckets"],
   },
   ```
3. File SQL baru `apps/web/prisma/shadow-init.sql` — stub minimal tabel
   `storage.buckets` (kolom yang dipakai statement `INSERT ... ON CONFLICT`
   di migration lama saja), idempotent (`create schema/table if not
exists`), dijalankan Prisma **hanya** terhadap shadow database sebelum
   replay migration history — tidak pernah menyentuh DB live/dev.
4. **Catatan teknis penting:** field `migrations.initShadowDb` di Prisma
   7.8.0 mengharapkan **isi SQL script (string)**, bukan path ke file —
   dikonfirmasi langsung dari kode CLI terkompilasi (tidak ada `fs.readFile`
   pada field ini di schema engine), berbeda dari dokumentasi umum yang
   menyiratkan path. Karena itu `prisma.config.ts` membaca file
   `shadow-init.sql` sendiri via `readFileSync` lalu mengoper isinya ke
   `initShadowDb` — supaya SQL tetap reviewable di file terpisah sambil
   memenuhi kontrak API yang sebenarnya.

### Reason

- External Tables adalah mekanisme resmi Prisma 7 untuk skenario tabel
  yang direferensikan raw SQL migration tapi dimiliki platform eksternal
  (Supabase Storage/Auth) — tidak perlu menambah model `@@ignore` +
  multi-schema di `schema.prisma` (opsi yang lebih invasif, sempat
  dipertimbangkan sebagai "Langkah C" tapi tidak jadi diperlukan).
- `initShadowDb` memberi Prisma cara membuat stub tabel eksternal di shadow
  DB sebelum replay migration history, tanpa mengubah migration.sql yang
  sudah applied di DB bersama manapun — memenuhi constraint keras di atas.
- Solusi murni di level konfigurasi (`prisma.config.ts` + satu file SQL
  baru) — reversibel dengan menghapus dua perubahan itu, tidak ada state DB
  yang perlu di-undo karena shadow DB efemeral.

### Alternatives Considered

- **Tambah model `@@ignore` + `@@schema("storage")` di `schema.prisma`**
  (multi-schema). Tidak diperlukan — External Tables + `initShadowDb` sudah
  cukup menyelesaikan tanpa menyentuh struktur schema domain.
- **Baseline ulang migration history** (squash migrasi lama, hilangkan
  referensi raw SQL `storage.buckets`). Ditolak — berisiko checksum
  mismatch untuk environment yang sudah menerapkan migration lama, dan
  tidak menyelesaikan masalah kalau ada raw SQL serupa di migrasi masa
  depan.

### Impact / Baseline yang diamandemen

- `product-discovery/06-engineering/database-orm.md` § Migration Strategy
  (DO-D03) — ditambah subsection tentang shadow database & external tables
  (baseline sebelumnya tidak menyebut shadow database sama sekali).

### Catatan implementasi

- File berubah: `apps/web/prisma.config.ts` (konfigurasi
  `experimental.externalTables`, `tables.external`, `migrations.initShadowDb`)
  dan file baru `apps/web/prisma/shadow-init.sql`.
- Verifikasi end-to-end (terhadap DB dev lokal, bukan DB bersama):
  `prisma migrate diff` dengan shadow database berhasil replay 6 migration
  history termasuk migration `storage.buckets` tanpa P3006; `prisma migrate
status` bersih ("up to date"); uji `prisma migrate dev --create-only`
  berhasil tanpa P3006 maupun error checksum apapun (folder migrasi kosong
  hasil uji dihapus lagi, tidak di-commit).
- Ditemukan & diperbaiki masalah **terpisah** (checksum drift) selama
  verifikasi: migration `20260806120000_extend_avatars_bucket_user_profile`
  di disk sudah diedit setelah pernah applied ke DB dev ini. Diperbaiki via
  UPDATE manual satu kolom (`checksum`) di tabel bookkeeping
  `_prisma_migrations`, dijalankan lewat `prisma db execute --stdin` atas
  persetujuan eksplisit King Rezi — hanya menyentuh metadata Prisma, tidak
  ada data aplikasi maupun skema yang berubah. Ini bukan bagian dari
  keputusan ADR ini, dicatat di sini hanya sebagai jejak verifikasi.
- Resolusi ini menutup **KI-016** (`PROJECT_STATE.md`) — migrasi Prisma
  berikutnya tidak perlu lagi workaround manual (`migrate diff` ke DB live
  - `db execute` + `migrate resolve --applied`) yang sebelumnya harus
    diulang tiap migrasi.

---
