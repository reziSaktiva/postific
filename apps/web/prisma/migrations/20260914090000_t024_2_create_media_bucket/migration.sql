-- T-024.2: buat bucket Supabase Storage `media` (Private) untuk file
-- konten yang diupload user (gambar, video, gif) — lihat
-- product-discovery/05-architecture/database-strategy.md § Storage Strategy:
-- "File konten tidak boleh diakses langsung via URL publik tanpa
-- authentication. Signed URL digunakan untuk generate link sementara saat
-- merender konten." Beda dari bucket `avatars` (Public).
--
-- Idempotent lewat ON CONFLICT DO UPDATE, pola sama migration
-- `20260806120000_extend_avatars_bucket_user_profile`.
--
-- allowed_mime_types menegakkan whitelist MIME yang sama dengan
-- `ALLOWED_MEDIA_MIME_TYPES` (apps/web/src/domains/media/validation.ts) di
-- level Storage juga, supaya jalur upload lain ke bucket yang sama tidak
-- lolos tanpa guardrail.
--
-- file_size_limit = 52428800 bytes (50 MB) — batas ukuran file media MVP
-- dikonfirmasi King Rezi via AskUserQuestion (follow-up T-024.2). Nilai ini
-- HARUS tetap sinkron dengan `MAX_MEDIA_FILE_SIZE_BYTES`
-- (apps/web/src/domains/media/validation.ts), yang menegakkan batas yang
-- sama di level aplikasi SEBELUM upload dipanggil ke Storage.
--
-- Catatan: `storage.buckets` adalah tabel milik Supabase Storage, bukan
-- bagian dari schema.prisma — migration ini raw SQL, tidak digenerate dari
-- perubahan model Prisma.
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values (
  'media',
  'media',
  false,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime'
  ],
  52428800
)
on conflict (id) do update set
  public = excluded.public,
  allowed_mime_types = excluded.allowed_mime_types,
  file_size_limit = excluded.file_size_limit;
