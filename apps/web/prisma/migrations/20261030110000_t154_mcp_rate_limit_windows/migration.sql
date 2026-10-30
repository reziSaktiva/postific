-- T-154 (ADR-138 poin 7, ADR-139 poin 6, ADR-141): penghitung rate limit MCP per
-- workspace di Postgres (tanpa Redis).
--
-- Isi:
--   1. CREATE mcp_rate_limit_windows: fixed window, satu baris per
--      (workspace, kuota, jendela). `quota` = calls | write_actions |
--      scheduled_contents (divalidasi application layer, bukan CHECK, supaya
--      menambah jenis kuota tidak butuh migrasi). Kenaikan penghitung dilakukan
--      repository dengan INSERT ... ON CONFLICT DO UPDATE ... WHERE
--      count + n <= limit (atomik, aman konkurensi antar instance).
--   2. ENABLE ROW LEVEL SECURITY + satu policy `app_runtime`, dalam migrasi yang
--      sama (ADR-141, pola mcp_grants/mcp_audit_logs di migrasi t149): role
--      `app_runtime` TIDAK melewati RLS, jadi tanpa policy semua tulis ditolak
--      (42501). Policy dijaga IF EXISTS karena shadow DB tidak punya role itu.
--      `anon` dan `authenticated` tanpa policy (default-deny). Isolasi workspace
--      ada di application layer (pengecualian DB-D05a).
--
-- Seluruhnya additive. Baris kedaluwarsa (`expires_at` lewat) dihapus JOB-08
-- (`mcp.audit.purge`), bukan cron baru.

-- ---------------------------------------------------------------------------
-- 1. Tabel dan indeks
-- ---------------------------------------------------------------------------

-- CreateTable
CREATE TABLE "mcp_rate_limit_windows" (
    "workspace_id" UUID NOT NULL,
    "quota" TEXT NOT NULL,
    "window_start" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "mcp_rate_limit_windows_pkey" PRIMARY KEY ("workspace_id","quota","window_start")
);

-- Penghitung tidak pernah negatif dan jendela selalu berujung setelah awalnya.
-- Tidak representable di schema.prisma (preseden 20261028140000 CHECK source).
ALTER TABLE "mcp_rate_limit_windows"
    ADD CONSTRAINT "mcp_rate_limit_windows_count_nonnegative" CHECK ("count" >= 0),
    ADD CONSTRAINT "mcp_rate_limit_windows_window_order" CHECK ("expires_at" > "window_start");

-- CreateIndex (purge JOB-08 menghapus per expires_at lintas workspace; awalan
-- workspace_id untuk Index Wajib sudah dipenuhi primary key)
CREATE INDEX "mcp_rate_limit_windows_expires_at_idx" ON "mcp_rate_limit_windows"("expires_at");

-- AddForeignKey
ALTER TABLE "mcp_rate_limit_windows" ADD CONSTRAINT "mcp_rate_limit_windows_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. RLS: aktif + policy app_runtime dalam migrasi yang sama (ADR-141)
-- ---------------------------------------------------------------------------

ALTER TABLE "mcp_rate_limit_windows" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE POLICY "mcp_rate_limit_windows_app_runtime" ON "mcp_rate_limit_windows"
      FOR ALL TO "app_runtime" USING (true) WITH CHECK (true);
  END IF;
END
$$;
