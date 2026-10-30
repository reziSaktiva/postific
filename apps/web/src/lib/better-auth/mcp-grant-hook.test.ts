import { createHash, randomBytes } from "node:crypto";

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { getAuthTables } from "better-auth/db";
import { decodeJwt } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemberStatus,
  asMcpGrantId,
  asUserId,
  asWorkspaceId,
} from "@postific/shared";

import {
  McpAccessDeniedError,
  McpAccessService,
  type IMcpAuditRepository,
  type IMcpGrantRepository,
  type IMcpGrantRevocationPort,
  type McpGrant,
  type McpScope,
} from "@/domains/mcp-access";
import { readMcpClaims, type McpClaims } from "@/lib/mcp/claims";

import {
  compensateConsent,
  newestConsent,
  type McpGrantAccess,
} from "./mcp-grant-hook";
import {
  createMcpSpikePlugins,
  type McpWorkspaceChoiceAccess,
} from "./mcp-spike";

// `mcp-spike.ts` mengimpor composition root produksi (Prisma). Tes memakai
// service dan pembaca pilihan workspace rakitan lokal, jadi kedua pabrik
// produksi di-mock.
vi.mock("@/lib/mcp-access/get-mcp-access-service", () => ({
  getMcpAccessService: vi.fn(() => {
    throw new Error("tes tidak boleh memakai composition root produksi");
  }),
}));
vi.mock("@/lib/mcp-access/get-mcp-consent-service", () => ({
  getMcpConsentService: vi.fn(() => {
    throw new Error("tes tidak boleh memakai composition root produksi");
  }),
}));

/**
 * T-150.4 — bukti plugin grant permanen. Menjalankan Better Auth NYATA
 * (plugin `jwt` + `oauthProvider` dengan konfigurasi plugin MCP yang sama +
 * plugin grant) di atas adapter memori, lewat `auth.handler(Request)`:
 * sign-up, pendaftaran klien, authorize, consent, token. Grant dibuat oleh
 * `McpAccessService` ASLI di atas repository/port palsu lokal (bukan store
 * memori produksi); gerbang yang diuji adalah `authorizeCall` asli.
 */

const BASE = "http://localhost:3000";
const MCP = `${BASE}/api/mcp`;
const REDIRECT = "http://localhost:9999/callback";
const ALL_SCOPES = "mcp:read mcp:draft mcp:schedule offline_access";

type World = ReturnType<typeof createWorld>;

/** Bagian adapter Better Auth yang dipakai port pencabutan palsu. */
type DbAdapter = {
  deleteMany(query: {
    model: string;
    where: { field: string; value: string }[];
  }): Promise<number>;
};

/** Repository grant palsu (di memori), perilaku sama dengan kontrak `IMcpGrantRepository`. */
function createFakeGrantRepository() {
  const rows: McpGrant[] = [];
  let seq = 0;

  const repo: IMcpGrantRepository = {
    async findById(id, userId) {
      return rows.find((g) => g.id === id && g.userId === userId) ?? null;
    },
    async findActiveByConnection({ userId, clientId, workspaceId }) {
      return (
        rows.find(
          (g) =>
            g.revokedAt === null &&
            g.userId === userId &&
            g.clientId === clientId &&
            g.workspaceId === workspaceId,
        ) ?? null
      );
    },
    async listActiveByUser(userId) {
      return rows.filter((g) => g.userId === userId && g.revokedAt === null);
    },
    async upsertActive(input) {
      const existing = rows.find(
        (g) =>
          g.revokedAt === null &&
          g.userId === input.userId &&
          g.clientId === input.clientId &&
          g.workspaceId === input.workspaceId,
      );
      if (existing) {
        existing.scopes = [...input.scopes];
        existing.clientName = input.clientName ?? existing.clientName;
        return { ...existing };
      }
      const created: McpGrant = {
        id: asMcpGrantId(`grant-${++seq}`),
        workspaceId: input.workspaceId,
        userId: input.userId,
        clientId: input.clientId,
        clientName: input.clientName,
        scopes: [...input.scopes],
        createdAt: input.createdAt,
        lastUsedAt: null,
        revokedAt: null,
      };
      rows.push(created);
      return { ...created };
    },
    async touchLastUsed() {},
    async findClientNames() {
      return new Map<string, string>();
    },
  };

  return { repo, rows };
}

const unusedAuditRepository: IMcpAuditRepository = {
  async create() {
    throw new Error("audit tidak dipakai plugin grant");
  },
  async deleteOlderThan() {
    throw new Error("audit tidak dipakai plugin grant");
  },
};

type WorldOptions = {
  /** Ganti akses service yang dilihat plugin (mis. untuk memaksa kegagalan). */
  access?: (service: McpAccessService) => McpGrantAccess;
  /** Bila true, port pencabutan melempar sebelum mengubah apa pun. */
  failRevocation?: () => boolean;
};

function createWorld(options: WorldOptions = {}) {
  const pluginOptions = {
    baseURL: BASE,
    secret: "t150-4-test-secret-t150-4-test-secret",
    emailAndPassword: { enabled: true },
  } satisfies BetterAuthOptions;

  const memberships = new Map<string, MemberStatus>(); // `${workspaceId}:${userId}`
  const { repo: grantRepo, rows: grantRows } = createFakeGrantRepository();
  const revocationCalls: unknown[] = [];

  // Diisi setelah `betterAuth` dibuat; port pencabutan menghapus consent lewat
  // adapter yang sama, meniru transaksi produksi (`revokeAtomically`).
  const ref: { adapter?: () => Promise<DbAdapter> } = {};

  const revocation: IMcpGrantRevocationPort = {
    async revokeAtomically(input) {
      revocationCalls.push(input);
      if (options.failRevocation?.()) {
        throw new Error("db down");
      }
      const grant = grantRows.find(
        (g) =>
          g.id === input.grantId &&
          g.revokedAt === null &&
          g.userId === input.userId &&
          g.clientId === input.clientId &&
          g.workspaceId === input.workspaceId,
      );
      if (!grant) {
        return { revoked: false };
      }
      grant.revokedAt = input.revokedAt;
      const adapter = await ref.adapter!();
      await adapter.deleteMany({
        model: "oauthConsent",
        where: [
          { field: "clientId", value: input.clientId },
          { field: "userId", value: input.userId },
          { field: "referenceId", value: input.workspaceId },
        ],
      });
      return { revoked: true };
    },
  };

  const service = new McpAccessService(
    grantRepo,
    unusedAuditRepository,
    revocation,
    {
      getMembership: async (workspaceId, userId) => {
        const status = memberships.get(`${workspaceId}:${userId}`);
        return status ? { status } : null;
      },
    },
  );

  // Pilihan workspace per ID sesi: pengganti `McpConsentService` produksi
  // (T-151, tabel `mcp_workspace_choices`) dengan kontrak baca yang sama.
  const workspaceChoices = new Map<string, string>();
  const choiceLookups: { sessionId: string; userId: string }[] = [];
  const choices: McpWorkspaceChoiceAccess = {
    async getActiveWorkspaceId(sessionId, userId) {
      choiceLookups.push({ sessionId, userId });
      const workspaceId = workspaceChoices.get(sessionId);
      return workspaceId ? asWorkspaceId(workspaceId) : null;
    },
    async clearWorkspaceChoice(sessionId) {
      workspaceChoices.delete(sessionId);
    },
  };
  const remember = (sessionId: string, workspaceId: string) => {
    workspaceChoices.set(sessionId, workspaceId);
  };

  const authOptions = {
    ...pluginOptions,
    plugins: createMcpSpikePlugins({
      baseUrl: BASE,
      getAccess: () => options.access?.(service) ?? service,
      getChoices: () => choices,
    }),
  } satisfies BetterAuthOptions;

  // Adapter memori butuh tabel yang sudah ada, termasuk tabel plugin.
  const db: Record<string, unknown[]> = {};
  for (const table of Object.values(getAuthTables(authOptions))) {
    db[table.modelName] = [];
  }
  const auth = betterAuth({ ...authOptions, database: memoryAdapter(db) });
  ref.adapter = async () => (await auth.$context).adapter as DbAdapter;

  return {
    auth,
    service,
    memberships,
    grantRows,
    grantRepo,
    revocationCalls,
    remember,
    hasChoice: (sessionId: string) => workspaceChoices.has(sessionId),
    choiceLookups,
  };
}

function member(world: World, workspaceId: string, userId: string) {
  world.memberships.set(`${workspaceId}:${userId}`, MemberStatus.Active);
}

function activeGrant(world: World, userId: string, workspaceId: string) {
  return world.grantRows.find(
    (g) =>
      g.revokedAt === null &&
      g.userId === userId &&
      g.workspaceId === workspaceId,
  );
}

/** Hasil gerbang per panggilan: `null` bila lolos, kalau tidak alasan penolakan. */
async function gate(
  world: World,
  claims: McpClaims,
  requiredScope: McpScope,
): Promise<string | null> {
  try {
    await world.service.authorizeCall({
      userId: claims.userId,
      clientId: claims.clientId,
      workspaceId: claims.workspaceId,
      tokenScopes: claims.scopes,
      requiredScope,
    });
    return null;
  } catch (error) {
    if (error instanceof McpAccessDeniedError) {
      return error.reason;
    }
    throw error;
  }
}

function claimsOf(token: string): McpClaims {
  return readMcpClaims(decodeJwt(token))!;
}

function cookieFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function json(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

function post(world: World, path: string, body: unknown, cookie?: string) {
  return world.auth.handler(
    new Request(`${BASE}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

async function signUp(world: World, email: string) {
  const response = await post(world, "/sign-up/email", {
    email,
    password: "password-12345",
    name: "Tester",
  });
  expect(response.status).toBe(200);
  const cookie = cookieFrom(response);
  const session = await world.auth.api.getSession({
    headers: new Headers({ cookie }),
  });
  return { cookie, userId: session!.user.id, sessionId: session!.session.id };
}

async function registerClient(world: World): Promise<string> {
  const response = await post(world, "/oauth2/register", {
    client_name: "Klien Uji",
    redirect_uris: [REDIRECT],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: ALL_SCOPES,
  });
  const body = await json(response);
  expect(response.status, JSON.stringify(body)).toBe(200);
  return body.client_id as string;
}

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

type Connect = {
  consentResponse: Response;
  consentBody: Record<string, unknown>;
  oauthQuery: string;
  pkceVerifier: string;
  clientId: string;
};

/** authorize (-> halaman consent) lalu POST /oauth2/consent. */
async function connect(
  world: World,
  who: { cookie: string; sessionId: string },
  clientId: string,
  opts: { workspaceId: string; requested?: string; granted?: string },
): Promise<Connect | { authorizeRedirect: string }> {
  world.remember(who.sessionId, opts.workspaceId);
  const { verifier, challenge } = pkce();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    scope: opts.requested ?? ALL_SCOPES,
    state: "s1",
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: MCP,
  });
  const authorize = await world.auth.handler(
    new Request(`${BASE}/api/auth/oauth2/authorize?${params}`, {
      headers: { cookie: who.cookie, accept: "text/html" },
    }),
  );
  const location = authorize.headers.get("location") ?? "";
  if (!location.startsWith("/consent")) {
    return { authorizeRedirect: location };
  }
  const oauthQuery = location.split("?")[1]!;
  const consentResponse = await post(
    world,
    "/oauth2/consent",
    {
      accept: true,
      scope: opts.granted,
      oauth_query: oauthQuery,
    },
    who.cookie,
  );
  const consentBody = await json(consentResponse);
  return {
    consentResponse,
    consentBody,
    oauthQuery,
    pkceVerifier: verifier,
    clientId,
  };
}

async function exchange(world: World, c: Connect): Promise<string> {
  const url = new URL(c.consentBody.url as string);
  const code = url.searchParams.get("code")!;
  const response = await world.auth.handler(
    new Request(`${BASE}/api/auth/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT,
        client_id: c.clientId,
        code_verifier: c.pkceVerifier,
        resource: MCP,
      }),
    }),
  );
  const body = await json(response);
  expect(response.status, JSON.stringify(body)).toBe(200);
  return body.access_token as string;
}

async function consentRows(world: World) {
  const ctx = await world.auth.$context;
  return ctx.adapter.findMany<{
    id: string;
    clientId: string;
    userId: string;
    referenceId: string;
    scopes: string[];
  }>({ model: "oauthConsent" });
}

function asConnect(value: Connect | { authorizeRedirect: string }): Connect {
  if (!("consentResponse" in value)) {
    throw new Error(
      `authorize tidak menuju consent: ${value.authorizeRedirect}`,
    );
  }
  return value;
}

describe("T-150.4 plugin grant permanen (hooks.after /oauth2/consent)", () => {
  let world: World;

  beforeEach(() => {
    world = createWorld();
  });

  describe("syarat 1: scope grant = scope consent", () => {
    it("menyalin hanya scope yang dicentang pengguna (schedule tidak dicentang)", async () => {
      const who = await signUp(world, "a@example.com");
      member(world, "ws_A", who.userId);
      const clientId = await registerClient(world);

      const c = asConnect(
        await connect(world, who, clientId, {
          workspaceId: "ws_A",
          granted: "mcp:read mcp:draft offline_access",
        }),
      );
      expect(c.consentResponse.status).toBe(200);

      const [consent] = await consentRows(world);
      expect(consent!.scopes.sort()).toEqual(
        ["mcp:draft", "mcp:read", "offline_access"].sort(),
      );
      const grant = activeGrant(world, who.userId, "ws_A");
      // scope grant = scope consent, tanpa scope non-tool (offline_access),
      // dalam nama logis (`read`, bukan `mcp:read`).
      expect(grant!.scopes).toEqual(["read", "draft"]);
      expect(grant!.clientId).toBe(clientId);
      expect(grant!.clientName).toBe("Klien Uji");

      // Dan gerbang per panggilan menolak schedule.
      const claims = claimsOf(await exchange(world, c));
      expect(await gate(world, claims, "read")).toBeNull();
      expect(await gate(world, claims, "schedule")).toBe(
        "token_scope_insufficient",
      );
    });

    it("consent sukses menghapus pilihan workspace sesi (T-180.1)", async () => {
      const who = await signUp(world, "clear@example.com");
      member(world, "ws_A", who.userId);
      const clientId = await registerClient(world);

      const c = asConnect(
        await connect(world, who, clientId, {
          workspaceId: "ws_A",
          granted: "mcp:read",
        }),
      );

      expect(c.consentResponse.status).toBe(200);
      expect(world.hasChoice(who.sessionId)).toBe(false);
    });

    it("re-consent yang menyempit menyempitkan grant dan berlaku pada token lama", async () => {
      const who = await signUp(world, "b@example.com");
      member(world, "ws_A", who.userId);
      const clientId = await registerClient(world);

      const first = asConnect(
        await connect(world, who, clientId, {
          workspaceId: "ws_A",
          granted: "mcp:read mcp:schedule",
        }),
      );
      const oldClaims = claimsOf(await exchange(world, first));
      expect(oldClaims.scopes).toContain("schedule");
      expect(await gate(world, oldClaims, "schedule")).toBeNull();

      // Consent sudah ada dan mencakup scope yang diminta, jadi authorize
      // melompati layar consent; paksa lewat prompt=consent seperti klien
      // yang meminta persetujuan ulang.
      world.remember(who.sessionId, "ws_A");
      const { challenge } = pkce();
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: REDIRECT,
        scope: ALL_SCOPES,
        state: "s2",
        code_challenge: challenge,
        code_challenge_method: "S256",
        resource: MCP,
        prompt: "consent",
      });
      const authorize = await world.auth.handler(
        new Request(`${BASE}/api/auth/oauth2/authorize?${params}`, {
          headers: { cookie: who.cookie, accept: "text/html" },
        }),
      );
      const oauthQuery = (authorize.headers.get("location") ?? "").split(
        "?",
      )[1]!;
      const second = await post(
        world,
        "/oauth2/consent",
        { accept: true, scope: "mcp:read", oauth_query: oauthQuery },
        who.cookie,
      );
      expect(second.status).toBe(200);

      // Satu grant aktif yang sama, scope menyempit (idempoten per koneksi).
      expect(world.grantRows.filter((g) => g.revokedAt === null)).toHaveLength(
        1,
      );
      expect(activeGrant(world, who.userId, "ws_A")!.scopes).toEqual(["read"]);
      // Token lama masih membawa mcp:schedule, tetapi grant sudah menyempit.
      expect(await gate(world, oldClaims, "schedule")).toBe(
        "grant_scope_insufficient",
      );
      expect(await gate(world, oldClaims, "read")).toBeNull();
    });
  });

  describe("syarat 2: workspace_id grant = referenceId consent", () => {
    it("grant, consent, dan klaim JWT memakai workspace yang sama; workspace lain = grant terpisah", async () => {
      const who = await signUp(world, "c@example.com");
      member(world, "ws_A", who.userId);
      member(world, "ws_B", who.userId);
      const clientId = await registerClient(world);

      const a = asConnect(
        await connect(world, who, clientId, {
          workspaceId: "ws_A",
          granted: "mcp:read",
        }),
      );
      const tokenA = await exchange(world, a);

      const rows = await consentRows(world);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.referenceId).toBe("ws_A");
      expect(decodeJwt(tokenA).workspace_id).toBe("ws_A");
      expect(activeGrant(world, who.userId, "ws_A")).toMatchObject({
        workspaceId: "ws_A",
        scopes: ["read"],
      });
      // Belum ada grant untuk ws_B.
      expect(activeGrant(world, who.userId, "ws_B")).toBeUndefined();

      // Klaim workspace_id yang dipalsukan (ws_B) tidak punya grant: ditolak.
      const claimsA = claimsOf(tokenA);
      expect(
        await gate(
          world,
          { ...claimsA, workspaceId: asWorkspaceId("ws_B") },
          "read",
        ),
      ).toBe("no_active_grant");

      // Menyambungkan klien yang sama ke ws_B membuat grant kedua, bukan menimpa.
      const b = asConnect(
        await connect(world, who, clientId, {
          workspaceId: "ws_B",
          granted: "mcp:read mcp:draft",
        }),
      );
      expect(b.consentResponse.status).toBe(200);
      expect(world.grantRows.filter((g) => g.revokedAt === null)).toHaveLength(
        2,
      );
      expect(activeGrant(world, who.userId, "ws_B")!.scopes).toEqual([
        "read",
        "draft",
      ]);
      expect(activeGrant(world, who.userId, "ws_A")!.scopes).toEqual(["read"]);
    });
  });

  describe("syarat 3: fail closed dengan kompensasi", () => {
    it("grant gagal dibuat: consent mengembalikan error tanpa kode, consent dikompensasi, panggilan ditolak", async () => {
      world = createWorld({
        access: (service) => ({
          ensureGrantFromConsent: async () => {
            throw new Error("db down");
          },
          revokeGrantForConnection: (key) =>
            service.revokeGrantForConnection(key),
        }),
      });
      const who = await signUp(world, "d@example.com");
      member(world, "ws_A", who.userId);
      const clientId = await registerClient(world);

      const c = asConnect(
        await connect(world, who, clientId, {
          workspaceId: "ws_A",
          granted: "mcp:read",
        }),
      );
      // Kode otorisasi tidak sampai ke klien.
      expect(c.consentResponse.status).toBe(500);
      expect(JSON.stringify(c.consentBody)).not.toContain("code=");
      expect(c.consentBody.url).toBeUndefined();
      // Consent dikompensasi: tidak ada consent tanpa grant.
      expect(await consentRows(world)).toHaveLength(0);
      expect(activeGrant(world, who.userId, "ws_A")).toBeUndefined();
      // Gagal: pilihan dipertahankan supaya percobaan ulang tidak mulai dari langkah 1.
      expect(world.hasChoice(who.sessionId)).toBe(true);

      // Gerbang per panggilan menolak walau klaim token seolah sah.
      expect(
        await gate(
          world,
          {
            userId: asUserId(who.userId),
            clientId,
            workspaceId: asWorkspaceId("ws_A"),
            scopes: ["read"],
          },
          "read",
        ),
      ).toBe("no_active_grant");
    });

    it("pengguna bukan member aktif workspace: grant ditolak service, consent dikompensasi", async () => {
      const who = await signUp(world, "d2@example.com");
      // Sengaja tanpa keanggotaan ws_A.
      const clientId = await registerClient(world);

      const c = asConnect(
        await connect(world, who, clientId, {
          workspaceId: "ws_A",
          granted: "mcp:read",
        }),
      );
      expect(c.consentResponse.status).toBe(500);
      expect(c.consentBody.url).toBeUndefined();
      expect(await consentRows(world)).toHaveLength(0);
      expect(world.grantRows).toHaveLength(0);
    });

    it("percobaan ulang setelah kegagalan menampilkan consent lagi dan grant terbentuk", async () => {
      let broken = true;
      world = createWorld({
        access: (service) => ({
          ensureGrantFromConsent: async (input) => {
            if (broken) {
              throw new Error("db down");
            }
            return service.ensureGrantFromConsent(input);
          },
          revokeGrantForConnection: (key) =>
            service.revokeGrantForConnection(key),
        }),
      });
      const who = await signUp(world, "e@example.com");
      member(world, "ws_A", who.userId);
      const clientId = await registerClient(world);

      const failed = asConnect(
        await connect(world, who, clientId, {
          workspaceId: "ws_A",
          requested: "mcp:read",
          granted: "mcp:read",
        }),
      );
      expect(failed.consentResponse.status).toBe(500);

      broken = false;
      const retry = await connect(world, who, clientId, {
        workspaceId: "ws_A",
        requested: "mcp:read",
        granted: "mcp:read",
      });
      // Layar consent muncul lagi (bukan lompat ke kode tanpa grant).
      const connected = asConnect(retry);
      expect(connected.consentResponse.status).toBe(200);
      const claims = claimsOf(await exchange(world, connected));
      expect(await gate(world, claims, "read")).toBeNull();
    });

    it("consent ada tanpa grant (hook terlewati/gagal kompensasi): authorize melompati consent, token terbit, tetapi gerbang per panggilan menolak", async () => {
      const who = await signUp(world, "f@example.com");
      member(world, "ws_A", who.userId);
      const clientId = await registerClient(world);

      // Suntik baris consent langsung (seolah hook tidak berjalan).
      const ctx = await world.auth.$context;
      await ctx.adapter.create({
        model: "oauthConsent",
        data: {
          clientId,
          userId: who.userId,
          referenceId: "ws_A",
          scopes: ["mcp:read", "mcp:draft"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // authorize langsung memberi kode (tanpa layar consent), jadi token terbit.
      world.remember(who.sessionId, "ws_A");
      const { verifier, challenge } = pkce();
      const authorize = await world.auth.handler(
        new Request(
          `${BASE}/api/auth/oauth2/authorize?${new URLSearchParams({
            response_type: "code",
            client_id: clientId,
            redirect_uri: REDIRECT,
            scope: "mcp:read",
            state: "s3",
            code_challenge: challenge,
            code_challenge_method: "S256",
            resource: MCP,
          })}`,
          { headers: { cookie: who.cookie, accept: "text/html" } },
        ),
      );
      const location = authorize.headers.get("location") ?? "";
      expect(location.startsWith(REDIRECT)).toBe(true);
      const token = await exchange(world, {
        consentResponse: authorize,
        consentBody: { url: location },
        oauthQuery: "",
        pkceVerifier: verifier,
        clientId,
      });

      const claims = claimsOf(token);
      expect(claims.workspaceId).toBe("ws_A");
      expect(claims.scopes).toContain("read");
      // Token sah, member aktif, consent ada, tetapi tidak ada grant: ditolak.
      expect(await gate(world, claims, "read")).toBe("no_active_grant");
    });

    it("grant dicabut saat token masih berlaku: ditolak; member dikeluarkan: ditolak", async () => {
      const who = await signUp(world, "g@example.com");
      member(world, "ws_A", who.userId);
      const clientId = await registerClient(world);
      const c = asConnect(
        await connect(world, who, clientId, {
          workspaceId: "ws_A",
          granted: "mcp:read",
        }),
      );
      const claims = claimsOf(await exchange(world, c));
      expect(await gate(world, claims, "read")).toBeNull();

      world.memberships.set(`ws_A:${who.userId}`, MemberStatus.Removed);
      expect(await gate(world, claims, "read")).toBe("not_workspace_member");
      member(world, "ws_A", who.userId);

      await world.service.revokeGrantForConnection({
        userId: asUserId(who.userId),
        clientId,
        workspaceId: asWorkspaceId("ws_A"),
      });
      expect(await gate(world, claims, "read")).toBe("no_active_grant");
    });
  });

  describe("pilihan workspace per sesi (T-151, tabel mcp_workspace_choices)", () => {
    function authorizeRequest(clientId: string, cookie: string) {
      const { challenge } = pkce();
      return world.auth.handler(
        new Request(
          `${BASE}/api/auth/oauth2/authorize?${new URLSearchParams({
            response_type: "code",
            client_id: clientId,
            redirect_uri: REDIRECT,
            scope: "mcp:read",
            state: "sw1",
            code_challenge: challenge,
            code_challenge_method: "S256",
            resource: MCP,
          })}`,
          { headers: { cookie, accept: "text/html" } },
        ),
      );
    }

    it("belum ada pilihan: authorize mengalihkan ke /select-workspace (langkah 1)", async () => {
      const who = await signUp(world, "sw1@example.com");
      const clientId = await registerClient(world);

      const authorize = await authorizeRequest(clientId, who.cookie);

      const location = authorize.headers.get("location") ?? "";
      expect(new URL(location, BASE).pathname).toBe("/select-workspace");
    });

    it("sudah ada pilihan: authorize menuju /consent (langkah 2), bukan memilih ulang", async () => {
      const who = await signUp(world, "sw2@example.com");
      const clientId = await registerClient(world);
      world.remember(who.sessionId, "ws_A");

      const authorize = await authorizeRequest(clientId, who.cookie);

      const location = authorize.headers.get("location") ?? "";
      expect(new URL(location, BASE).pathname).toBe("/consent");
    });

    it("membaca pilihan dengan ID sesi DAN ID pengguna sesi itu", async () => {
      const who = await signUp(world, "sw3@example.com");
      const clientId = await registerClient(world);

      await authorizeRequest(clientId, who.cookie);

      expect(world.choiceLookups).toContainEqual({
        sessionId: who.sessionId,
        userId: who.userId,
      });
    });

    it("pilihan sesi lain tidak terbaca: pengguna kedua tetap diminta memilih", async () => {
      const first = await signUp(world, "sw4@example.com");
      const second = await signUp(world, "sw5@example.com");
      const clientId = await registerClient(world);
      world.remember(first.sessionId, "ws_A");

      const authorize = await authorizeRequest(clientId, second.cookie);

      const location = authorize.headers.get("location") ?? "";
      expect(new URL(location, BASE).pathname).toBe("/select-workspace");
    });
  });

  describe("titik kait lain yang dibuka plugin", () => {
    it("pengguna menolak (accept=false): tidak ada consent dan tidak ada grant", async () => {
      const who = await signUp(world, "h@example.com");
      const clientId = await registerClient(world);
      world.remember(who.sessionId, "ws_A");
      const { challenge } = pkce();
      const authorize = await world.auth.handler(
        new Request(
          `${BASE}/api/auth/oauth2/authorize?${new URLSearchParams({
            response_type: "code",
            client_id: clientId,
            redirect_uri: REDIRECT,
            scope: "mcp:read",
            state: "s4",
            code_challenge: challenge,
            code_challenge_method: "S256",
            resource: MCP,
          })}`,
          { headers: { cookie: who.cookie, accept: "text/html" } },
        ),
      );
      const oauthQuery = (authorize.headers.get("location") ?? "").split(
        "?",
      )[1]!;
      const denied = await post(
        world,
        "/oauth2/consent",
        { accept: false, oauth_query: oauthQuery },
        who.cookie,
      );
      expect(denied.status).toBe(200);
      expect(await consentRows(world)).toHaveLength(0);
      expect(world.grantRows).toHaveLength(0);
    });

    it("scope di luar yang diminta (consent ditolak endpoint): tidak ada grant", async () => {
      const who = await signUp(world, "i@example.com");
      member(world, "ws_A", who.userId);
      const clientId = await registerClient(world);
      const c = asConnect(
        await connect(world, who, clientId, {
          workspaceId: "ws_A",
          requested: "mcp:read",
          granted: "mcp:read mcp:schedule",
        }),
      );
      expect(c.consentResponse.status).toBe(400);
      expect(world.grantRows).toHaveLength(0);
      expect(await consentRows(world)).toHaveLength(0);
    });

    it("/oauth2/update-consent ditolak dan scope consent tidak berubah", async () => {
      const who = await signUp(world, "j@example.com");
      member(world, "ws_A", who.userId);
      const clientId = await registerClient(world);
      asConnect(
        await connect(world, who, clientId, {
          workspaceId: "ws_A",
          granted: "mcp:read",
        }),
      );
      const [consent] = await consentRows(world);

      const update = await post(
        world,
        "/oauth2/update-consent",
        { id: consent!.id, update: { scopes: ["mcp:read", "mcp:schedule"] } },
        who.cookie,
      );
      expect(update.status).toBe(403);
      expect((await consentRows(world))[0]!.scopes).not.toContain(
        "mcp:schedule",
      );
      expect(activeGrant(world, who.userId, "ws_A")!.scopes).toEqual(["read"]);
    });

    it("/oauth2/delete-consent mencabut grant lebih dulu lewat service; token lama ditolak", async () => {
      const who = await signUp(world, "k@example.com");
      member(world, "ws_A", who.userId);
      const clientId = await registerClient(world);
      const c = asConnect(
        await connect(world, who, clientId, {
          workspaceId: "ws_A",
          granted: "mcp:read",
        }),
      );
      const claims = claimsOf(await exchange(world, c));
      expect(await gate(world, claims, "read")).toBeNull();
      const [consent] = await consentRows(world);

      const del = await post(
        world,
        "/oauth2/delete-consent",
        { id: consent!.id },
        who.cookie,
      );
      // Pencabutan atomik (di produksi dan di port palsu ini) menghapus
      // consent lebih dulu, jadi endpoint plugin tidak lagi menemukannya dan
      // membalas 404 walau pencabutan BERHASIL. Yang dijaga: grant tercabut
      // dan consent hilang. (Kejanggalan status ini dilaporkan, T-150.4.)
      expect(del.status).toBe(404);
      expect(world.revocationCalls).toHaveLength(1);
      expect(world.grantRows[0]!.revokedAt).not.toBeNull();
      expect(await consentRows(world)).toHaveLength(0);
      expect(await gate(world, claims, "read")).toBe("no_active_grant");
    });

    it("/oauth2/delete-consent: pencabutan gagal -> error, consent dan grant tetap (tanpa consent hilang diam-diam)", async () => {
      let failing = false;
      world = createWorld({ failRevocation: () => failing });
      const who = await signUp(world, "l@example.com");
      member(world, "ws_A", who.userId);
      const clientId = await registerClient(world);
      asConnect(
        await connect(world, who, clientId, {
          workspaceId: "ws_A",
          granted: "mcp:read",
        }),
      );
      const [consent] = await consentRows(world);

      failing = true;
      const del = await post(
        world,
        "/oauth2/delete-consent",
        { id: consent!.id },
        who.cookie,
      );
      expect(del.status).toBe(500);
      expect(await consentRows(world)).toHaveLength(1);
      expect(activeGrant(world, who.userId, "ws_A")).toBeDefined();
    });

    it("/oauth2/delete-consent: consent milik pengguna lain tidak mencabut grant pemiliknya", async () => {
      const owner = await signUp(world, "m@example.com");
      const intruder = await signUp(world, "n@example.com");
      member(world, "ws_A", owner.userId);
      const clientId = await registerClient(world);
      asConnect(
        await connect(world, owner, clientId, {
          workspaceId: "ws_A",
          granted: "mcp:read",
        }),
      );
      const [consent] = await consentRows(world);

      const byOther = await post(
        world,
        "/oauth2/delete-consent",
        { id: consent!.id },
        intruder.cookie,
      );
      expect(byOther.status).toBeGreaterThanOrEqual(400);
      const anonymous = await post(world, "/oauth2/delete-consent", {
        id: consent!.id,
      });
      expect(anonymous.status).toBeGreaterThanOrEqual(400);

      expect(world.revocationCalls).toHaveLength(0);
      expect(activeGrant(world, owner.userId, "ws_A")).toBeDefined();
      expect(await consentRows(world)).toHaveLength(1);
    });

    it("/oauth2/delete-consent tanpa sesi tidak mencabut grant", async () => {
      const owner = await signUp(world, "o@example.com");
      member(world, "ws_A", owner.userId);
      const clientId = await registerClient(world);
      asConnect(
        await connect(world, owner, clientId, {
          workspaceId: "ws_A",
          granted: "mcp:read",
        }),
      );
      const [consent] = await consentRows(world);

      const response = await post(world, "/oauth2/delete-consent", {
        id: consent!.id,
      });
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(world.revocationCalls).toHaveLength(0);
      expect(activeGrant(world, owner.userId, "ws_A")).toBeDefined();
      expect(await consentRows(world)).toHaveLength(1);
    });
  });
});

describe("compensateConsent", () => {
  function fakeCtx(rows: Record<string, unknown>[]) {
    const deleted: string[] = [];
    const ctx = {
      context: {
        adapter: {
          findMany: async <T>() => rows as T[],
          delete: async (q: { where: { value: string }[] }) => {
            deleted.push(q.where[0]!.value);
          },
        },
        logger: { error: vi.fn() },
      },
    };
    return { ctx, deleted };
  }
  const base = { clientId: "c1", userId: "u1", scopes: ["mcp:read"] };

  it("tanpa workspace: hanya baris tanpa referenceId (terbaru) yang dihapus", async () => {
    const { ctx, deleted } = fakeCtx([
      { ...base, id: "ok-ws", referenceId: "ws_A", createdAt: "2026-01-03" },
      { ...base, id: "old", referenceId: null, createdAt: "2026-01-01" },
      { ...base, id: "new", referenceId: null, createdAt: "2026-01-02" },
    ]);
    await compensateConsent(ctx, { userId: "u1", clientId: "c1" });
    expect(deleted).toEqual(["new"]);
  });

  it("tidak ada baris yang cocok: tidak menghapus apa pun", async () => {
    const { ctx, deleted } = fakeCtx([
      { ...base, id: "ok-ws", referenceId: "ws_A" },
    ]);
    await compensateConsent(ctx, { userId: "u1", clientId: "c1" });
    expect(deleted).toEqual([]);
  });

  it("kegagalan hapus hanya dicatat, tidak melempar", async () => {
    const { ctx } = fakeCtx([]);
    ctx.context.adapter.delete = async () => {
      throw new Error("db down");
    };
    await expect(
      compensateConsent(ctx, {
        userId: "u1",
        clientId: "c1",
        consentId: "x",
      }),
    ).resolves.toBeUndefined();
    expect(ctx.context.logger.error).toHaveBeenCalled();
  });
});

describe("newestConsent (consent tanpa constraint unik)", () => {
  const row = (
    id: string,
    scopes: string[],
    at?: string,
    updated?: string,
  ) => ({
    id,
    clientId: "c",
    userId: "u",
    referenceId: "ws_A",
    scopes,
    createdAt: at ?? null,
    updatedAt: updated ?? null,
  });

  it("memilih baris terbaru walau baris lama yang lebar terdaftar lebih dulu", () => {
    const stale = row(
      "old",
      ["mcp:read", "mcp:schedule"],
      "2026-10-01T00:00:00Z",
    );
    const fresh = row("new", ["mcp:read"], "2026-10-02T00:00:00Z");
    expect(newestConsent([stale, fresh])?.id).toBe("new");
    expect(newestConsent([fresh, stale])?.id).toBe("new");
  });

  it("updatedAt mengalahkan createdAt", () => {
    const edited = row(
      "edited",
      ["mcp:read"],
      "2026-10-01T00:00:00Z",
      "2026-10-05T00:00:00Z",
    );
    const created = row(
      "created",
      ["mcp:read", "mcp:draft"],
      "2026-10-03T00:00:00Z",
    );
    expect(newestConsent([created, edited])?.id).toBe("edited");
  });

  it("daftar kosong menghasilkan undefined", () => {
    expect(newestConsent([])).toBeUndefined();
  });
});
