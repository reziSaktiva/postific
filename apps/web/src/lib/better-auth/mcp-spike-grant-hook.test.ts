import { createHash, randomBytes } from "node:crypto";

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { getAuthTables } from "better-auth/db";
import { decodeJwt } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { MemberStatus } from "@postific/shared";

import {
  authorizeSpikeCall,
  readClaims,
  type SpikeAuthorizeDeps,
} from "@/lib/mcp-spike/authorize";
import {
  createInMemorySpikeGrantStore,
  type SpikeGrantStore,
} from "@/lib/mcp-spike/grant-store";

import { newestConsent } from "./mcp-spike-grant-hook";
import { createMcpSpikePlugins, rememberWorkspaceChoice } from "./mcp-spike";

/**
 * T-149.2 — bukti titik kait grant (opsi A: `hooks.after` pada
 * `/oauth2/consent`). Menjalankan Better Auth NYATA (plugin `jwt` +
 * `oauthProvider` dengan konfigurasi harness yang sama + plugin grant) di atas
 * adapter memori, lewat `auth.handler(Request)`: sign-up, pendaftaran klien,
 * authorize, consent, token. SEMENTARA, ikut dibuang bersama harness.
 */

const BASE = "http://localhost:3000";
const MCP = `${BASE}/api/mcp`;
const REDIRECT = "http://localhost:9999/callback";
const ALL_SCOPES = "mcp:read mcp:draft mcp:schedule offline_access";

type World = ReturnType<typeof createWorld>;

function createWorld(store: SpikeGrantStore) {
  const options = {
    baseURL: BASE,
    secret: "t149-2-test-secret-t149-2-test-secret",
    emailAndPassword: { enabled: true },
    plugins: createMcpSpikePlugins({ baseUrl: BASE, grantStore: store }),
  } satisfies BetterAuthOptions;
  // Adapter memori butuh tabel yang sudah ada, termasuk tabel plugin.
  const db: Record<string, unknown[]> = {};
  for (const table of Object.values(getAuthTables(options))) {
    db[table.modelName] = [];
  }
  const auth = betterAuth({ ...options, database: memoryAdapter(db) });

  const memberships = new Map<string, string>(); // `${workspaceId}:${userId}` -> status
  const deps: SpikeAuthorizeDeps = {
    getMembership: async (workspaceId, userId) => {
      const status = memberships.get(`${workspaceId}:${userId}`);
      return status ? { status } : null;
    },
    findActiveGrant: (key) => store.findActive(key),
  };

  return { auth, store, memberships, deps };
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
  rememberWorkspaceChoice(who.sessionId, opts.workspaceId);
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

describe("T-149.2 titik kait grant (opsi A: hooks.after /oauth2/consent)", () => {
  let store: ReturnType<typeof createInMemorySpikeGrantStore>;
  let world: World;

  beforeEach(() => {
    store = createInMemorySpikeGrantStore();
    world = createWorld(store);
  });

  describe("syarat 1: scope grant = scope consent", () => {
    it("menyalin hanya scope yang dicentang pengguna (schedule tidak dicentang)", async () => {
      const who = await signUp(world, "a@example.com");
      world.memberships.set(`ws_A:${who.userId}`, MemberStatus.Active);
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
      const grant = await store.findActive({
        userId: who.userId,
        clientId,
        workspaceId: "ws_A",
      });
      // scope grant = scope consent, tanpa scope non-tool (offline_access).
      expect(grant!.scopes.sort()).toEqual(["mcp:draft", "mcp:read"]);
      expect(grant!.scopes).not.toContain("mcp:schedule");

      // Dan gerbang per panggilan menolak schedule.
      const claims = readClaims(decodeJwt(await exchange(world, c)))!;
      expect(
        await authorizeSpikeCall(world.deps, claims, "mcp:read"),
      ).toBeNull();
      expect(
        await authorizeSpikeCall(world.deps, claims, "mcp:schedule"),
      ).toMatch(/tidak diberikan/);
    });

    it("re-consent yang menyempit menyempitkan grant dan berlaku pada token lama", async () => {
      const who = await signUp(world, "b@example.com");
      world.memberships.set(`ws_A:${who.userId}`, MemberStatus.Active);
      const clientId = await registerClient(world);

      const first = asConnect(
        await connect(world, who, clientId, {
          workspaceId: "ws_A",
          granted: "mcp:read mcp:schedule",
        }),
      );
      const oldToken = await exchange(world, first);
      const oldClaims = readClaims(decodeJwt(oldToken))!;
      expect(oldClaims.scopes).toContain("mcp:schedule");
      expect(
        await authorizeSpikeCall(world.deps, oldClaims, "mcp:schedule"),
      ).toBeNull();

      // Consent sudah ada dan mencakup scope yang diminta, jadi authorize
      // melompati layar consent; paksa lewat prompt=consent seperti klien
      // yang meminta persetujuan ulang.
      rememberWorkspaceChoice(who.sessionId, "ws_A");
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

      const grant = await store.findActive({
        userId: who.userId,
        clientId,
        workspaceId: "ws_A",
      });
      expect(grant!.scopes).toEqual(["mcp:read"]);
      // Token lama masih membawa mcp:schedule, tetapi grant sudah menyempit.
      expect(
        await authorizeSpikeCall(world.deps, oldClaims, "mcp:schedule"),
      ).toMatch(/tidak diberikan/);
      expect(
        await authorizeSpikeCall(world.deps, oldClaims, "mcp:read"),
      ).toBeNull();
    });
  });

  describe("syarat 2: workspace_id grant = referenceId consent", () => {
    it("grant, consent, dan klaim JWT memakai workspace yang sama; workspace lain = grant terpisah", async () => {
      const who = await signUp(world, "c@example.com");
      world.memberships.set(`ws_A:${who.userId}`, MemberStatus.Active);
      world.memberships.set(`ws_B:${who.userId}`, MemberStatus.Active);
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
      expect(
        await store.findActive({
          userId: who.userId,
          clientId,
          workspaceId: "ws_A",
        }),
      ).toMatchObject({ workspaceId: "ws_A", scopes: ["mcp:read"] });
      // Belum ada grant untuk ws_B.
      expect(
        await store.findActive({
          userId: who.userId,
          clientId,
          workspaceId: "ws_B",
        }),
      ).toBeNull();

      // Klaim workspace_id yang dipalsukan (ws_B) tidak punya grant: ditolak.
      const claimsA = readClaims(decodeJwt(tokenA))!;
      expect(
        await authorizeSpikeCall(
          world.deps,
          { ...claimsA, workspaceId: "ws_B" },
          "mcp:read",
        ),
      ).toMatch(/dicabut/);

      // Menyambungkan klien yang sama ke ws_B membuat grant kedua, bukan menimpa.
      const b = asConnect(
        await connect(world, who, clientId, {
          workspaceId: "ws_B",
          granted: "mcp:read mcp:draft",
        }),
      );
      expect(b.consentResponse.status).toBe(200);
      expect(store.all().filter((g) => g.revokedAt === null)).toHaveLength(2);
      expect(
        (await store.findActive({
          userId: who.userId,
          clientId,
          workspaceId: "ws_B",
        }))!.scopes.sort(),
      ).toEqual(["mcp:draft", "mcp:read"]);
      expect(
        (await store.findActive({
          userId: who.userId,
          clientId,
          workspaceId: "ws_A",
        }))!.scopes,
      ).toEqual(["mcp:read"]);
    });
  });

  describe("syarat 3: fail closed", () => {
    it("grant gagal dibuat: consent mengembalikan error tanpa kode, consent dikompensasi, panggilan ditolak", async () => {
      const failing: SpikeGrantStore = {
        ...store,
        upsertActive: async () => {
          throw new Error("db down");
        },
      };
      world = createWorld(failing);
      const who = await signUp(world, "d@example.com");
      world.memberships.set(`ws_A:${who.userId}`, MemberStatus.Active);
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
      expect(
        await store.findActive({
          userId: who.userId,
          clientId,
          workspaceId: "ws_A",
        }),
      ).toBeNull();

      // Gerbang per panggilan menolak walau klaim token seolah sah.
      expect(
        await authorizeSpikeCall(
          world.deps,
          {
            userId: who.userId,
            clientId,
            workspaceId: "ws_A",
            scopes: ["mcp:read"],
          },
          "mcp:read",
        ),
      ).toMatch(/dicabut/);
    });

    it("percobaan ulang pada instance yang sama setelah kegagalan menampilkan consent lagi", async () => {
      let broken = true;
      const flaky: SpikeGrantStore = {
        upsertActive: async (grant) => {
          if (broken) {
            throw new Error("db down");
          }
          return store.upsertActive(grant);
        },
        findActive: (key) => store.findActive(key),
        revoke: (key) => store.revoke(key),
      };
      world = createWorld(flaky);
      const who = await signUp(world, "e@example.com");
      world.memberships.set(`ws_A:${who.userId}`, MemberStatus.Active);
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
      const claims = readClaims(decodeJwt(await exchange(world, connected)))!;
      expect(
        await authorizeSpikeCall(world.deps, claims, "mcp:read"),
      ).toBeNull();
    });

    it("consent ada tanpa grant (hook terlewati/gagal kompensasi): authorize melompati consent, token terbit, tetapi gerbang per panggilan menolak", async () => {
      const who = await signUp(world, "f@example.com");
      world.memberships.set(`ws_A:${who.userId}`, MemberStatus.Active);
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
      rememberWorkspaceChoice(who.sessionId, "ws_A");
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

      const claims = readClaims(decodeJwt(token))!;
      expect(claims.workspaceId).toBe("ws_A");
      expect(claims.scopes).toContain("mcp:read");
      // Token sah, member aktif, consent ada, tetapi tidak ada grant: ditolak.
      expect(await authorizeSpikeCall(world.deps, claims, "mcp:read")).toMatch(
        /dicabut/,
      );
    });

    it("grant dicabut saat token masih berlaku: ditolak; member dikeluarkan: ditolak", async () => {
      const who = await signUp(world, "g@example.com");
      world.memberships.set(`ws_A:${who.userId}`, MemberStatus.Active);
      const clientId = await registerClient(world);
      const c = asConnect(
        await connect(world, who, clientId, {
          workspaceId: "ws_A",
          granted: "mcp:read",
        }),
      );
      const claims = readClaims(decodeJwt(await exchange(world, c)))!;
      expect(
        await authorizeSpikeCall(world.deps, claims, "mcp:read"),
      ).toBeNull();

      world.memberships.set(`ws_A:${who.userId}`, "removed");
      expect(await authorizeSpikeCall(world.deps, claims, "mcp:read")).toMatch(
        /member aktif/,
      );
      world.memberships.set(`ws_A:${who.userId}`, MemberStatus.Active);

      await store.revoke({ userId: who.userId, clientId, workspaceId: "ws_A" });
      expect(await authorizeSpikeCall(world.deps, claims, "mcp:read")).toMatch(
        /dicabut/,
      );
    });
  });

  describe("titik kait lain yang dibuka plugin", () => {
    it("pengguna menolak (accept=false): tidak ada consent dan tidak ada grant", async () => {
      const who = await signUp(world, "h@example.com");
      const clientId = await registerClient(world);
      rememberWorkspaceChoice(who.sessionId, "ws_A");
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
      expect(store.all()).toHaveLength(0);
    });

    it("scope di luar yang diminta (consent ditolak endpoint): tidak ada grant", async () => {
      const who = await signUp(world, "i@example.com");
      world.memberships.set(`ws_A:${who.userId}`, MemberStatus.Active);
      const clientId = await registerClient(world);
      const c = asConnect(
        await connect(world, who, clientId, {
          workspaceId: "ws_A",
          requested: "mcp:read",
          granted: "mcp:read mcp:schedule",
        }),
      );
      expect(c.consentResponse.status).toBe(400);
      expect(store.all()).toHaveLength(0);
      expect(await consentRows(world)).toHaveLength(0);
    });

    it("/oauth2/delete-consent mencabut grant lebih dulu; /oauth2/update-consent ditolak", async () => {
      const who = await signUp(world, "j@example.com");
      world.memberships.set(`ws_A:${who.userId}`, MemberStatus.Active);
      const clientId = await registerClient(world);
      const c = asConnect(
        await connect(world, who, clientId, {
          workspaceId: "ws_A",
          granted: "mcp:read",
        }),
      );
      const claims = readClaims(decodeJwt(await exchange(world, c)))!;
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

      const del = await post(
        world,
        "/oauth2/delete-consent",
        { id: consent!.id },
        who.cookie,
      );
      expect(del.status).toBe(200);
      expect(await consentRows(world)).toHaveLength(0);
      expect(await authorizeSpikeCall(world.deps, claims, "mcp:read")).toMatch(
        /dicabut/,
      );
    });
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
