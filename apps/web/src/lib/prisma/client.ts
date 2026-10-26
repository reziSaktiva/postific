import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Singleton PrismaClient (database-orm.md, Prisma 7).
 * Runtime uses pooled DATABASE_URL via pg adapter (DO-D04).
 * Server-only — do not import from Client Components.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required for PrismaClient (pooled Supavisor URL — DO-D04)",
    );
  }

  // Query pada satu koneksi diantri oleh patches/@prisma+adapter-pg@7.8.0.patch
  // (KI-091, prisma/orm#29979) sampai perbaikan itu ada di rilis Prisma.
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
