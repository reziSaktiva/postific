import { describe, expect, it } from "vitest";
import type { prisma as prismaClient } from "@/lib/prisma/client";

/**
 * T-196 (KI-106, ADR-167) — integration test against a real Postgres:
 * the eight tables that had RLS disabled now have RLS on, exactly one policy
 * each (for `app_runtime`), so the public `anon` and `authenticated` roles
 * (no BYPASSRLS, no policy) are denied, while the app's own connection still
 * reads and writes them.
 *
 * The app connects as `app_runtime` (verified 2026-11-27), which cannot
 * `SET ROLE anon`, so the deny for the public roles is proven from the
 * catalog here; a live read as `anon` was checked separately on staging.
 *
 * Opt-in: needs a real `DATABASE_URL` AND `T196_RLS_DB_TEST=1`, and the
 * migration `20261127100000_t196_enable_rls_exposed_tables` applied. The
 * write check runs in a transaction that is always rolled back.
 */
const enabled =
  Boolean(process.env.DATABASE_URL) &&
  process.env.SKIP_ENV_VALIDATION !== "1" &&
  process.env.T196_RLS_DB_TEST === "1";

const TABLES = [
  "identity_user",
  "identity_session",
  "identity_account",
  "identity_verification",
  "workspaces",
  "background_jobs",
  "outstand_webhook_events",
  "_prisma_migrations",
] as const;

const ROLLBACK = Symbol("rollback");

describe.skipIf(!enabled)("exposed tables RLS (Postgres, T-196)", () => {
  async function getPrisma(): Promise<typeof prismaClient> {
    const { prisma } = await import("@/lib/prisma/client");
    return prisma;
  }

  it("has RLS enabled and exactly one policy, for app_runtime, on each table", async () => {
    const prisma = await getPrisma();
    const rows = await prisma.$queryRaw<
      { relname: string; rls: boolean; policies: string[]; roles: string[] }[]
    >`
      SELECT c.relname::text AS relname,
             c.relrowsecurity AS rls,
             COALESCE(
               array_agg(p.policyname::text) FILTER (WHERE p.policyname IS NOT NULL),
               '{}'::text[]
             ) AS policies,
             COALESCE(
               array_agg(DISTINCT r.role::text) FILTER (WHERE r.role IS NOT NULL),
               '{}'::text[]
             ) AS roles
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      LEFT JOIN pg_policies p
        ON p.schemaname = 'public' AND p.tablename = c.relname
      LEFT JOIN LATERAL unnest(p.roles) AS r(role) ON true
      WHERE c.relname = ANY(${[...TABLES]}::text[])
      GROUP BY c.relname, c.relrowsecurity
    `;

    expect(rows.map((r) => r.relname).sort()).toEqual([...TABLES].sort());
    for (const row of rows) {
      expect(row.rls, row.relname).toBe(true);
      expect(row.policies, row.relname).toEqual([`${row.relname}_app_runtime`]);
      expect(row.roles, row.relname).toEqual(["app_runtime"]);
    }
  });

  it("anon and authenticated cannot bypass RLS, so no policy lets them in", async () => {
    const prisma = await getPrisma();
    const rows = await prisma.$queryRaw<{ rolname: string; bypass: boolean }[]>`
      SELECT rolname::text AS rolname, rolbypassrls AS bypass
      FROM pg_roles
      WHERE rolname IN ('anon', 'authenticated')
      ORDER BY rolname
    `;
    expect(rows).toEqual([
      { rolname: "anon", bypass: false },
      { rolname: "authenticated", bypass: false },
    ]);
  });

  it("the app connection still reads every table", async () => {
    const prisma = await getPrisma();
    for (const table of TABLES) {
      await expect(
        prisma.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`),
        table,
      ).resolves.toBeDefined();
    }
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM "_prisma_migrations"`,
    );
    expect(Number(rows[0]?.n)).toBeGreaterThan(0);
  });

  it("the app connection can still write (insert rolled back)", async () => {
    const prisma = await getPrisma();
    let inserted = 0;
    try {
      await prisma.$transaction(async (tx) => {
        inserted = await tx.$executeRawUnsafe(
          `INSERT INTO "identity_verification" (id, identifier, value, "expiresAt", "createdAt", "updatedAt")
           VALUES ('t196-rls-probe', 't196-rls-probe', 'x', now() + interval '1 minute', now(), now())`,
        );
        throw ROLLBACK;
      });
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }
    expect(inserted).toBe(1);
  });
});
