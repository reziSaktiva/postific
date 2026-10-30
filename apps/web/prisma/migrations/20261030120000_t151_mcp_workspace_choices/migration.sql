-- T-151 (ADR-139, ADR-141): pilihan workspace per sesi login pada alur OAuth
-- klien AI. Menggantikan `Map` di memori harness spike T-148 (tidak tahan
-- multi-instance dan restart).
--
-- Isi (additive saja, tidak menyentuh tabel yang ada):
--   1. CREATE mcp_workspace_choices + indeks `expires_at` (untuk pembersihan
--      JOB-08).
--   2. ENABLE ROW LEVEL SECURITY + satu policy `app_runtime` dalam migrasi
--      yang sama (ADR-141; pola sama dengan 20261026140000). Role
--      `app_runtime` TIDAK melewati RLS: RLS aktif tanpa policy untuk role itu
--      menolak semua tulis (42501). Policy dijaga IF EXISTS karena shadow DB
--      tidak punya role itu. `anon` dan `authenticated` tidak punya policy
--      (default-deny). Policy ini tidak memisahkan pengguna di level DB;
--      isolasi ada di application layer dan filter repository
--      (pengecualian DB-D05, ADR-141).
--
-- Tanpa FK: `session_id` dan `user_id` milik tabel identitas plugin (sama
-- seperti `mcp_grants.user_id`), dan `workspace_id` divalidasi sebagai member
-- aktif saat ditulis serta saat grant dibuat (`mcp_grants` punya FK).
--
-- Rollback: DROP TABLE "mcp_workspace_choices" (data sementara, 10 menit).

-- CreateTable
CREATE TABLE "mcp_workspace_choices" (
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mcp_workspace_choices_pkey" PRIMARY KEY ("session_id")
);

-- CreateIndex
CREATE INDEX "mcp_workspace_choices_expires_at_idx" ON "mcp_workspace_choices"("expires_at");

-- RLS: aktif + policy app_runtime dalam migrasi yang sama (ADR-141)
ALTER TABLE "mcp_workspace_choices" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE POLICY "mcp_workspace_choices_app_runtime" ON "mcp_workspace_choices"
      FOR ALL TO "app_runtime" USING (true) WITH CHECK (true);
  END IF;
END
$$;
