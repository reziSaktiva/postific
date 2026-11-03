import { Client } from "pg";

/**
 * Bukti perilaku role runtime `app_runtime` pada tabel MCP (T-189.1, T-189.4;
 * ADR-141, ADR-153). Hanya `DATABASE_URL` (pooler, role `app_runtime`): role
 * yang melewati RLS (`postgres`, BYPASSRLS) tidak membuktikan apa pun, jadi
 * `DIRECT_URL` tidak pernah dipakai di sini.
 *
 * Keselamatan:
 * - Tidak ada tulis permanen. Pemeriksaan tulis memakai transaksi yang selalu
 *   di-ROLLBACK, dan `session_id` uji bertanda `e2e-rls-probe-`.
 * - Probe tulis `mcp_rate_limit_windows` memakai quota `e2e_rls_probe` pada
 *   workspace E2E Sandbox nyata (FK), jendela 2099, dan di-ROLLBACK; kunci FK
 *   baris sandbox tertahan sebentar sampai ROLLBACK.
 * - Baca hanya baris milik workspace E2E Sandbox (id dari `get_workspace`).
 * - Pesan galat driver tidak diteruskan mentah (hanya kode); nilai env tidak
 *   pernah dicetak.
 */

const STATEMENT_TIMEOUT_MS = 10_000;

export const MCP_APP_RUNTIME_TABLES = [
  "mcp_workspace_choices",
  "mcp_rate_limit_windows",
] as const;

export type McpAppRuntimeTable = (typeof MCP_APP_RUNTIME_TABLES)[number];

export interface RoleReport {
  role: string;
  bypassRls: boolean;
}

export interface TableRlsReport {
  rlsEnabled: boolean;
  /** Pemilik tabel: pemilik melewati RLS bila tabel tidak FORCE. */
  owner: string;
  /** Nama policy `FOR ALL` yang berlaku untuk `app_runtime`. */
  policies: string[];
}

export interface RateLimitRow {
  quota: string;
  count: number;
  windowStart: Date;
}

export class McpTablesDbError extends Error {}

export function hasAppRuntimeConnection(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function dbErrorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string") return code;
  return error instanceof Error ? error.name : "tidak diketahui";
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new McpTablesDbError("DATABASE_URL tidak tersedia.");
  }
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: STATEMENT_TIMEOUT_MS,
    query_timeout: STATEMENT_TIMEOUT_MS,
  });
  client.on("error", (error) => {
    console.warn(
      `[mcp.e2e] DATABASE_URL: error koneksi DB (kode ${dbErrorCode(error)})`,
    );
  });
  let connected = false;
  try {
    await client.connect();
    connected = true;
    return await fn(client);
  } catch (error) {
    if (error instanceof McpTablesDbError) throw error;
    throw new McpTablesDbError(
      `DATABASE_URL: operasi DB gagal (kode ${dbErrorCode(error)})`,
    );
  } finally {
    if (connected) await client.end().catch(() => undefined);
  }
}

export async function readRole(): Promise<RoleReport> {
  return withClient(async (client) => {
    const result = await client.query<{ who: string; bypass: boolean }>(
      "SELECT current_user AS who, (rolsuper OR rolbypassrls) AS bypass FROM pg_roles WHERE rolname = current_user",
    );
    return {
      role: result.rows[0]?.who ?? "tidak diketahui",
      // Konservatif (beda arah dari member-db.ts, yang `=== true`): role tak
      // terbaca dianggap bypass, supaya bukti RLS tidak lulus karena data hilang.
      bypassRls: result.rows[0]?.bypass !== false,
    };
  });
}

/** Struktur RLS tabel: RLS aktif, pemilik tabel, dan policy `FOR ALL` yang mencakup `app_runtime`. */
export async function readTableRls(
  table: McpAppRuntimeTable,
): Promise<TableRlsReport> {
  return withClient(async (client) => {
    const cls = await client.query<{ rls: boolean; owner: string }>(
      `SELECT c.relrowsecurity AS rls, pg_get_userbyid(c.relowner) AS owner
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = $1`,
      [table],
    );
    if (cls.rows.length !== 1) {
      throw new McpTablesDbError(
        `tabel ${table} tidak ditemukan di schema public.`,
      );
    }
    const policies = await client.query<{ policyname: string }>(
      `SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = $1 AND cmd = 'ALL'
          AND ('app_runtime' = ANY (roles) OR 'public' = ANY (roles))`,
      [table],
    );
    return {
      rlsEnabled: cls.rows[0].rls,
      owner: cls.rows[0].owner,
      policies: policies.rows.map((row) => row.policyname),
    };
  });
}

/**
 * Buktikan lewat transaksi ber-ROLLBACK bahwa `app_runtime` (RLS berlaku) boleh
 * INSERT, SELECT, dan DELETE di `mcp_workspace_choices`. Tanpa policy, INSERT
 * ditolak 42501. Tidak meninggalkan baris. Mengembalikan jumlah baris yang
 * terbaca kembali di dalam transaksi (harus 1).
 */
export async function probeWorkspaceChoicesWrite(input: {
  userId: string;
  workspaceId: string;
}): Promise<{ readBack: number; deleted: number }> {
  return withClient(async (client) => {
    const sessionId = `e2e-rls-probe-${Date.now()}`;
    await client.query("BEGIN");
    try {
      await client.query(
        `SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`,
      );
      await client.query(
        `INSERT INTO mcp_workspace_choices (session_id, user_id, workspace_id, expires_at)
         VALUES ($1, $2, $3, now() + interval '1 minute')`,
        [sessionId, input.userId, input.workspaceId],
      );
      const read = await client.query(
        "SELECT 1 FROM mcp_workspace_choices WHERE session_id = $1",
        [sessionId],
      );
      const del = await client.query(
        "DELETE FROM mcp_workspace_choices WHERE session_id = $1",
        [sessionId],
      );
      return { readBack: read.rowCount ?? 0, deleted: del.rowCount ?? 0 };
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
    }
  });
}

/**
 * Sebagai `app_runtime` (RLS berlaku): upsert penghitung setara repository (bentuk statement tidak identik)
 * (`INSERT ... ON CONFLICT DO UPDATE`), baca kembali, lalu DELETE (jalur purge
 * JOB-08). Jendela 2099 agar tidak bentrok dengan baris nyata; seluruhnya di-ROLLBACK.
 */
export async function probeRateLimitWrite(workspaceId: string): Promise<{
  inserted: number;
  upserted: number;
  count: number;
  deleted: number;
}> {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(
        `SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`,
      );
      const upsert = `INSERT INTO mcp_rate_limit_windows (workspace_id, quota, window_start, expires_at, count)
         VALUES ($1, 'e2e_rls_probe', '2099-01-01T00:00:00Z', '2099-01-01T00:02:00Z', 1)
         ON CONFLICT (workspace_id, quota, window_start)
         DO UPDATE SET count = mcp_rate_limit_windows.count + 1`;
      const first = await client.query(upsert, [workspaceId]);
      const second = await client.query(upsert, [workspaceId]);
      const read = await client.query<{ count: number }>(
        `SELECT count FROM mcp_rate_limit_windows
          WHERE workspace_id = $1 AND quota = 'e2e_rls_probe'`,
        [workspaceId],
      );
      const del = await client.query(
        `DELETE FROM mcp_rate_limit_windows
          WHERE workspace_id = $1 AND quota = 'e2e_rls_probe'`,
        [workspaceId],
      );
      return {
        inserted: first.rowCount ?? 0,
        upserted: second.rowCount ?? 0,
        count: read.rows[0]?.count ?? -1,
        deleted: del.rowCount ?? 0,
      };
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
    }
  });
}

/**
 * Baris penghitung yang ditulis aplikasi (sebagai `app_runtime`, lewat
 * `INSERT ... ON CONFLICT`) untuk workspace ini, jendela terbaru lebih dulu.
 * Hanya SELECT.
 */
export async function readRateLimitRows(
  workspaceId: string,
  since: Date,
): Promise<RateLimitRow[]> {
  return withClient(async (client) => {
    const result = await client.query<{
      quota: string;
      count: number;
      window_start: Date;
    }>(
      `SELECT quota, count, window_start FROM mcp_rate_limit_windows
        WHERE workspace_id = $1 AND window_start >= $2
        ORDER BY window_start DESC
        LIMIT 20`,
      [workspaceId, since],
    );
    return result.rows.map((row) => ({
      quota: row.quota,
      count: row.count,
      windowStart: row.window_start,
    }));
  });
}
