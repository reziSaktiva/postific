import { describe, expect, it } from "vitest";
import type { prisma as prismaClient } from "@/lib/prisma/client";

/**
 * T-196 (KI-106, ADR-167) — integration test against a real Postgres:
 * the eight tables that had RLS disabled now have RLS on, one `app_runtime`
 * policy each, and deny the public `anon` and `authenticated` roles, while
 * the app's own connection (`postgres`, owner, BYPASSRLS) still reads them.
 *
 * Opt-in: needs a real `DATABASE_URL` AND `T196_RLS_DB_TEST=1`, and the
 * migration `20261127100000_t196_enable_rls_exposed_tables` applied. Read
 * only: role switches run inside a transaction that is always rolled back.
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

  /** Runs `fn` as `role` inside a transaction that is always rolled back. */
  async function asRole<T>(
    prisma: typeof prismaClient,
    role: "anon" | "authenticated",
    fn: (
      tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    ) => Promise<T>,
  ): Promise<T> {
    let result: T | undefined;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
        result = await fn(tx);
        throw ROLLBACK;
      });
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }
    return result as T;
  }

  it("has RLS enabled and exactly one app_runtime policy on each table", async () => {
    const prisma = await getPrisma();
    const rows = await prisma.$queryRaw<
      { relname: string; rls: boolean; policies: string[] }[]
    >`
      SELECT c.relname,
             c.relrowsecurity AS rls,
             COALESCE(
               array_agg(p.policyname) FILTER (WHERE p.policyname IS NOT NULL),
               '{}'
             ) AS policies
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      LEFT JOIN pg_policies p
        ON p.schemaname = 'public' AND p.tablename = c.relname
      WHERE c.relname = ANY(${[...TABLES]})
      GROUP BY c.relname, c.relrowsecurity
    `;

    expect(rows.map((r) => r.relname).sort()).toEqual([...TABLES].sort());
    for (const row of rows) {
      expect(row.rls, row.relname).toBe(true);
      expect(row.policies, row.relname).toEqual([`${row.relname}_app_runtime`]);
    }
  });

  it.each(["anon", "authenticated"] as const)(
    "%s reads zero rows from every table",
    async (role) => {
      const prisma = await getPrisma();
      for (const table of TABLES) {
        const rows = await asRole(prisma, role, (tx) =>
          tx.$queryRawUnsafe<{ n: bigint }[]>(
            `SELECT count(*)::bigint AS n FROM "${table}"`,
          ),
        );
        expect(Number(rows[0]?.n), `${role} on ${table}`).toBe(0);
      }
    },
  );

  it("the app connection still reads the tables (owner bypasses RLS)", async () => {
    const prisma = await getPrisma();
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM "_prisma_migrations"`,
    );
    expect(Number(rows[0]?.n)).toBeGreaterThan(0);
  });
});
