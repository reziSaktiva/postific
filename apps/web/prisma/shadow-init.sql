-- Setup minimal untuk tabel platform Supabase Storage yang direferensikan
-- raw SQL di migration history Prisma (lihat
-- 20260806120000_extend_avatars_bucket_user_profile/migration.sql).
-- Dijalankan Prisma HANYA terhadap shadow database sebelum replay migration
-- history — bukan terhadap DB live/dev. Idempotent dan sengaja MINIMAL:
-- hanya kolom yang dipakai statement INSERT ... ON CONFLICT di migration
-- tersebut. Lihat KI-016 / ADR-073.

create schema if not exists "storage";

create table if not exists "storage"."buckets" (
  "id" text primary key,
  "name" text not null,
  "public" boolean not null default false,
  "file_size_limit" bigint,
  "allowed_mime_types" text[]
);

-- Same category of gap as above (KI-016 precedent), ditemukan T-110
-- (2026-09-28) saat `prisma migrate dev` mereplay migration history di
-- shadow database kosong: `20260831150000_t036_notifications_realtime_setup`
-- menjalankan `ALTER PUBLICATION supabase_realtime ADD TABLE ...`, tapi
-- publication `supabase_realtime` adalah objek platform Supabase (dibuat
-- otomatis oleh Supabase saat provisioning project, bukan fitur vanilla
-- Postgres) — tidak ada di shadow database ephemeral Prisma. Tanpa ini,
-- SETIAP `prisma migrate dev`/`migrate diff` yang mereplay seluruh history
-- gagal P3006 di migration itu, bukan hanya migration baru yang sedang
-- ditambahkan. Idempotent (guard via `pg_publication`) — DB live/dev sudah
-- punya publication ini sejak awal (Supabase-provisioned), jadi guard ini
-- murni untuk shadow database.
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end
$$;

-- Sama kategori (ditemukan sesi yang sama, T-110, 2026-09-28) — migration
-- yang sama (`20260831150000_t036_notifications_realtime_setup`) juga
-- memakai `auth.uid()` (skema `auth` milik Supabase Auth, bukan bagian
-- vanilla Postgres) di klausa USING sebuah `CREATE POLICY`. Postgres
-- memvalidasi keberadaan fungsi yang direferensikan saat DDL `CREATE
-- POLICY` dieksekusi (bukan hanya saat policy dievaluasi terhadap baris
-- sungguhan) — shadow database butuh stub minimal ini supaya replay
-- migration history berhasil secara struktural. Fungsi ini TIDAK PERNAH
-- dipanggil dengan data sungguhan (shadow database hanya untuk migration
-- diffing, bukan query nyata), jadi body `null::uuid` aman.
create schema if not exists "auth";

create or replace function "auth"."uid"()
returns uuid
language sql
stable
as $$ select null::uuid $$;
