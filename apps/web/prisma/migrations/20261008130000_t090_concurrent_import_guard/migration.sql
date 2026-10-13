-- Code review PR #148 (finding #2) — guard concurrent-import per
-- `connectedAccountId` (ADR-093 poin 8) sebelumnya hanya aplikasi-level
-- ("check hasActiveImportSyncJob lalu insert createImportSyncJob" sebagai
-- dua query Prisma terpisah, tanpa transaction/lock) — TOCTOU race: dua
-- trigger yang nyaris bersamaan (double-click "Sync Now", atau periodic vs
-- manual tumpang tindih) bisa sama-sama membaca "tidak ada job aktif"
-- sebelum salah satunya sempat insert.
--
-- Partial unique index di bawah menutup celah itu di level DB: HANYA SATU
-- baris `background_jobs` bertipe `import.sync` dengan
-- `payload->>'connectedAccountId'` yang sama boleh berstatus
-- `pending`/`running` di satu waktu. Insert kedua yang lolos pre-check
-- aplikasi akan gagal di sini (P2002 di layer Prisma), ditangkap oleh
-- `importJobRepository.createImportSyncJob` dan diterjemahkan ke
-- `ConflictError` (pola sama `isConnectedAccountConflict` di
-- `workspace.repository.ts`).
--
-- NOTE (sama keterbatasan migration T-090.1): worktree sesi ini tidak
-- punya akses `DATABASE_URL`, jadi file ini ditulis manual mengikuti pola
-- DDL Prisma dan HARUS diverifikasi (`prisma migrate diff` / apply ke DB
-- dev) sebelum deploy.

CREATE UNIQUE INDEX IF NOT EXISTS "background_jobs_active_import_sync_account_key"
    ON "background_jobs" ((payload ->> 'connectedAccountId'))
    WHERE "type" = 'import.sync' AND "status" IN ('pending', 'running');
