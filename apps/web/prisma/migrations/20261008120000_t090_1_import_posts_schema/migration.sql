-- T-090.1 (ADR-093) — Import Posts dari Social Account, status `Imported`.
--
-- 1. `publishing_posts.author_id` jadi nullable — invariant: `null` HANYA
--    kalau `status = 'imported'` (post ditarik langsung dari platform
--    sosial, tidak punya "penulis" internal). Tidak ada DB CHECK constraint
--    untuk invariant ini (tidak ada presedan CHECK lintas kolom seperti ini
--    di schema) — ditegakkan di level Application Service
--    (`ImportPostsProcessUseCase`), defense-in-depth ADR-059 poin 6.
-- 2. `workspace_connected_accounts` dapat 2 kolom watermark/cooldown baru
--    untuk JOB-05 (Import Posts Trigger, ADR-093 poin 6).
--
-- NOTE (ditulis manual oleh Elon Backend Engineer, dilaporkan ke King Rezi):
-- worktree sesi ini tidak punya akses `DATABASE_URL` (`.env.local` di-deny
-- oleh proteksi baca secret) sehingga `prisma migrate dev` tidak bisa
-- dijalankan untuk generate+apply migration ini secara normal. File ini
-- ditulis manual mengikuti pola DDL Prisma persis (ALTER COLUMN DROP NOT
-- NULL + ADD COLUMN, lihat migration serupa
-- `20260723121000_align_outstand_contract` dan
-- `20260909024403_t034_4_retry_outstand_post_id`) dan HARUS diverifikasi
-- (`prisma migrate diff` / `prisma validate` / apply ke DB dev) oleh
-- King Rezi atau sesi dengan akses `.env.local` sebelum di-deploy.

ALTER TABLE "publishing_posts" ALTER COLUMN "author_id" DROP NOT NULL;

ALTER TABLE "workspace_connected_accounts"
    ADD COLUMN "last_imported_until" TIMESTAMPTZ(6),
    ADD COLUMN "last_import_requested_at" TIMESTAMPTZ(6);
