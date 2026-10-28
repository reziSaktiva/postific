-- T-149.3 (ADR-138, ADR-139, ADR-141): tabel BC-04 MCP Access, dan penghapusan
-- tabel AI lama.
--
-- Isi:
--   1. CREATE mcp_grants dan mcp_audit_logs (kolom final: database-strategy.md
--      § BC-04) beserta indeks, termasuk indeks unik PARSIAL yang tidak bisa
--      dinyatakan di schema.prisma.
--   2. ENABLE ROW LEVEL SECURITY + satu policy `app_runtime` per tabel, dalam
--      migrasi yang sama (ADR-141). Role `app_runtime` TIDAK melewati RLS:
--      RLS aktif tanpa policy untuk role itu menolak semua tulis (42501).
--      Policy dijaga IF EXISTS karena shadow DB tidak punya role itu. `anon`
--      dan `authenticated` tidak punya policy (default-deny). Policy ini tidak
--      memisahkan workspace/pengguna di level DB; isolasi ada di application
--      layer (pengecualian DB-D05, ADR-141).
--   3. DROP ai_results lalu ai_requests (stub domain ai-assistant dihapus di
--      T-149.4, tidak ada pemakai di kode). Keduanya 0 baris di staging
--      (dicek 2026-10-26); guard di bawah menghentikan migrasi bila ternyata
--      ada isi, supaya tidak ada data yang hilang diam-diam.
--
-- Bagian 1 dan 2 additive. Bagian 3 destruktif dan tidak dapat dibalik tanpa
-- memulihkan skema dari migrasi init + t017 + t008.

-- ---------------------------------------------------------------------------
-- 1. Tabel dan indeks baru
-- ---------------------------------------------------------------------------

-- CreateTable
CREATE TABLE "mcp_grants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_name" TEXT,
    "scopes" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "mcp_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "grant_id" UUID,
    "client_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "input_summary" TEXT,
    "status" TEXT NOT NULL,
    "error_code" TEXT,
    "duration_ms" INTEGER,
    "target_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mcp_grants_workspace_id_idx" ON "mcp_grants"("workspace_id");

-- CreateIndex (PARSIAL, raw SQL: tidak representable di schema Prisma, preseden
-- 20260907130000_t026_unique_outstand_post_id). Paling banyak satu grant aktif
-- per (pengguna, klien, workspace); grant yang dicabut tetap sebagai riwayat.
-- Awalan user_id juga melayani listGrants.
CREATE UNIQUE INDEX "mcp_grants_active_user_client_workspace_key"
    ON "mcp_grants"("user_id", "client_id", "workspace_id")
    WHERE "revoked_at" IS NULL;

-- CreateIndex
CREATE INDEX "mcp_audit_logs_workspace_id_created_at_idx" ON "mcp_audit_logs"("workspace_id", "created_at");

-- CreateIndex (purge JOB-08 menghapus per created_at lintas workspace; indeks
-- (workspace_id, created_at) tidak melayani query global itu)
CREATE INDEX "mcp_audit_logs_created_at_idx" ON "mcp_audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "mcp_grants" ADD CONSTRAINT "mcp_grants_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_audit_logs" ADD CONSTRAINT "mcp_audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_audit_logs" ADD CONSTRAINT "mcp_audit_logs_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "mcp_grants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. RLS: aktif + policy app_runtime dalam migrasi yang sama (ADR-141)
-- ---------------------------------------------------------------------------

ALTER TABLE "mcp_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mcp_audit_logs" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE POLICY "mcp_grants_app_runtime" ON "mcp_grants"
      FOR ALL TO "app_runtime" USING (true) WITH CHECK (true);
    CREATE POLICY "mcp_audit_logs_app_runtime" ON "mcp_audit_logs"
      FOR ALL TO "app_runtime" USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 3. Hapus tabel AI lama
-- ---------------------------------------------------------------------------

-- Guard: batalkan migrasi bila ada baris tersisa (staging 0 baris per
-- 2026-10-26; ulangi cek count(*) sebelum deploy ke lingkungan lain).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ai_results" LIMIT 1)
     OR EXISTS (SELECT 1 FROM "ai_requests" LIMIT 1) THEN
    RAISE EXCEPTION 'T-149.3: ai_requests/ai_results masih berisi data, migrasi drop dibatalkan';
  END IF;
END
$$;

-- Policy (t017_add_rls_policies). Policy ai_results mereferensikan ai_requests
-- lewat subquery, jadi harus dilepas sebelum ai_requests di-drop.
DROP POLICY "ai_results_workspace_isolation" ON "ai_results";
DROP POLICY "ai_requests_workspace_isolation" ON "ai_requests";

-- DropForeignKey (FK ai_results.request_id -> ai_requests.id dan
-- ai_requests.workspace_id -> workspaces.id, terakhir diubah t008)
ALTER TABLE "ai_results" DROP CONSTRAINT "ai_results_request_id_fkey";
ALTER TABLE "ai_requests" DROP CONSTRAINT "ai_requests_workspace_id_fkey";

-- DropTable (anak lebih dulu; indeks ai_requests_workspace_id_idx ikut terhapus)
DROP TABLE "ai_results";
DROP TABLE "ai_requests";
