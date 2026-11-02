import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { getAuthTables } from "better-auth/db";
import { describe, expect, it, vi } from "vitest";

import {
  MCP_CLIENT_REGISTRATION_RATE_LIMIT,
  createMcpSpikePlugins,
} from "./mcp-spike";

// `mcp-spike.ts` mengimpor composition root produksi (Prisma); tes ini tidak
// memakainya.
vi.mock("@/lib/mcp-access/get-mcp-access-service", () => ({
  getMcpAccessService: vi.fn(),
}));
vi.mock("@/lib/mcp-access/get-mcp-consent-service", () => ({
  getMcpConsentService: vi.fn(),
}));

/**
 * T-150.9 — pendaftaran klien dinamis tanpa login menambah satu baris
 * `identity_oauth_client` per panggilan. Better Auth NYATA di atas adapter
 * memori dengan rate limit aktif (produksi menyalakannya otomatis).
 */
const BASE = "http://localhost:3000";

function createAuth() {
  const options = {
    baseURL: BASE,
    secret: "t150-9-test-secret-t150-9-test-secret",
    rateLimit: { enabled: true },
    plugins: createMcpSpikePlugins({
      baseUrl: BASE,
      getAccess: () => {
        throw new Error("tidak dipakai");
      },
      getChoices: () => {
        throw new Error("tidak dipakai");
      },
    }),
  };
  const db: Record<string, unknown[]> = {};
  for (const table of Object.values(getAuthTables(options))) {
    db[table.modelName] = [];
  }
  return betterAuth({ ...options, database: memoryAdapter(db) });
}

function register(auth: ReturnType<typeof createAuth>, ip: string) {
  return auth.handler(
    new Request(`${BASE}/api/auth/oauth2/register`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({
        client_name: "Klien Uji",
        redirect_uris: ["http://localhost:9999/callback"],
        token_endpoint_auth_method: "none",
      }),
    }),
  );
}

describe("unauthenticated dynamic client registration rate limit", () => {
  it("rejects registrations beyond the limit per IP, but not other IPs", async () => {
    const auth = createAuth();
    const { max } = MCP_CLIENT_REGISTRATION_RATE_LIMIT;

    for (let i = 0; i < max; i += 1) {
      expect((await register(auth, "203.0.113.7")).status).toBe(200);
    }
    expect((await register(auth, "203.0.113.7")).status).toBe(429);
    expect((await register(auth, "203.0.113.8")).status).toBe(200);
  });
});
