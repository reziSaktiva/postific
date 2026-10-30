import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
} from "@playwright/test";

import { AUTH_FILE } from "./support/auth";
import {
  callTool,
  cleanupE2eConsents,
  connectClient,
  decodeJwtClaims,
  findConsentFor,
  mcpRequest,
  mcpSkipReason,
  refreshAccessToken,
  refreshExpectingFailure,
  remainingE2eConsents,
  resourceUrl,
  deleteConsent,
  scrub,
  type ConnectedClient,
} from "./support/mcp";
import {
  assertWorkspaceId,
  hasDbConnection,
  probeSandboxMember,
  readMemberStatus,
  restoreMemberActive,
  setMemberStatus,
  type SandboxMemberRef,
} from "./support/member-db";
import { E2E_WORKSPACE_NAME } from "./support/workspace";

/**
 * T-178 (S-002, ADR-149, ADR-139): E2E MCP terhadap staging. Tes memainkan
 * peran klien MCP (daftar, OAuth + PKCE, JSON-RPC ke `/api/mcp`) memakai akun
 * test dan workspace E2E Sandbox. Hanya tool baca yang dipanggil; tidak ada
 * yang dipublikasikan. Tidak pernah menyentuh workspace nyata: data yang
 * diubah hanya klien `e2e-*` dan, di skenario (f), baris member akun test di
 * E2E Sandbox.
 *
 * Hanya staging (`mcpSkipReason`, allowlist host persis: `https:` + host
 * staging bawaan atau `E2E_STAGING_HOST`). Baris `identity_oauth_client` hasil pendaftaran
 * dinamis tidak bisa dihapus (klien tanpa pemilik; ditangani T-150.9): tes
 * hanya mencabut consent dan grant miliknya, klien `e2e-*` tersisa dan itu
 * diterima.
 *
 * Asumsi dan batas:
 * - Pilihan workspace di `/select-workspace` disimpan di tabel
 *   `mcp_workspace_choices` per ID sesi (T-151), bukan lagi di memori server,
 *   jadi tes tidak lagi bergantung pada satu instance Railway. Pegangan:
 *   klaim `workspace_id` token dicocokkan dengan workspace E2E Sandbox di (c).
 * - Batas 120 detik per tes. Pendaftaran klien dibatasi 5 permintaan per 60
 *   detik per IP; tes memakai 3 per run, jadi run beruntun < 60 detik
 *   membuat `registerClient` menunggu jendela itu (hingga ~66 detik) dan
 *   makan sebagian batas 120 detik.
 * - Skenario (f) butuh DB: `DATABASE_URL` (role `app_runtime`) hanya cukup
 *   bila E2E Sandbox punya member `active` lain; kalau tidak, (f) di-skip.
 *   `DIRECT_URL` (superuser) hanya dengan opt-in `E2E_ALLOW_DIRECT_URL=1`.
 *   Detail, RUNBOOK pemulihan manual, dan peringatan workspace "E2E Sandbox"
 *   ganda ada di `support/member-db.ts`. Member yang tertinggal `removed`
 *   dipulihkan di `globalSetup` (`support/heal-member.global.ts`), sebelum
 *   proyek `setup`, bukan di berkas ini.
 * - Tracing Playwright dimatikan untuk berkas ini: trace merekam header
 *   `Authorization` dan body token. Terbukti berlaku juga untuk konteks yang
 *   dibuat manual di `beforeAll` (2026-10-30): dengan `--trace on` dipaksa,
 *   `test-results/` hanya berisi trace proyek `setup`, tidak ada untuk tes ini.
 *   Cek ulang dengan `bun run test:e2e -- e2e/mcp.e2e.ts --trace on` bila
 *   versi Playwright berubah.
 */

test.use({ trace: "off" });

const BASE_URL = (process.env.E2E_BASE_URL ?? "").replace(/\/+$/, "");
const SKIP_REASON = mcpSkipReason(process.env.E2E_BASE_URL);
if (SKIP_REASON) {
  console.warn(`[mcp.e2e] DI-SKIP: ${SKIP_REASON}`);
}

const READ_TOOLS = [
  "get_workspace",
  "list_accounts",
  "list_media",
  "list_drafts",
  "list_scheduled_posts",
  "list_published_posts",
  "get_analytics",
  "list_comments",
];

test.describe("MCP server di staging", () => {
  test.skip(SKIP_REASON !== null, SKIP_REASON ?? "");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  /** Klien tanpa cookie: meniru klien MCP sungguhan (tidak membawa sesi web). */
  let api: APIRequestContext;
  /** Konteks browser dengan sesi tersimpan akun test (satu sesi untuk semua skenario). */
  let session: BrowserContext;

  let clientA: ConnectedClient;
  let sandboxWorkspaceId = "";
  let refreshed: { accessToken: string; refreshToken: string | undefined };
  /** Diisi sebelum status member diubah; dipulihkan di `afterAll` bila masih terisi. */
  let memberToRestore: SandboxMemberRef | undefined;

  test.beforeAll(async ({ browser, playwright }) => {
    api = await playwright.request.newContext({
      baseURL: BASE_URL,
      // Kosongkan eksplisit: klien MCP sungguhan tidak membawa cookie sesi web.
      storageState: { cookies: [], origins: [] },
    });
    session = await browser.newContext({
      baseURL: BASE_URL,
      storageState: AUTH_FILE,
    });
    // Sisa run yang terhenti: cabut consent klien `e2e-*` (hanya berawalan itu).
    const swept = await cleanupE2eConsents(session.request, BASE_URL);
    if (swept.targeted > 0) {
      console.log(
        `[mcp.e2e] sisa consent e2e-*: ${swept.revoked} dari ${swept.targeted} dicabut`,
      );
    }
  });

  test.afterAll(async () => {
    // Setiap langkah berdiri sendiri: kegagalan satu langkah tidak boleh
    // melewati yang lain (terutama pemulihan member). Galat dikumpulkan dan
    // dilempar di akhir.
    const errors: string[] = [];
    const step = async (label: string, run: () => Promise<unknown>) => {
      try {
        await run();
      } catch (error) {
        const first = (
          error instanceof Error ? error.message : String(error)
        ).split("\n")[0];
        errors.push(`${label}: ${scrub(first).slice(0, 300)}`);
      }
    };

    if (!SKIP_REASON) {
      await step("pulihkan member E2E", async () => {
        if (memberToRestore) {
          await restoreMemberActive(memberToRestore);
          memberToRestore = undefined;
        }
      });
      await step("sapuan consent e2e-*", async () => {
        const swept = await cleanupE2eConsents(session.request, BASE_URL);
        console.log(
          `[mcp.e2e] bersih-bersih: ${swept.revoked} dari ${swept.targeted} consent e2e-* dicabut`,
        );
      });
      await step("asersi tanpa sisa consent e2e-*", async () => {
        expect(
          await remainingE2eConsents(session.request),
          "consent e2e-* tersisa",
        ).toEqual([]);
      });
    }
    await step("tutup konteks browser", async () => session?.close());
    await step("tutup klien API", async () => api?.dispose());

    if (errors.length > 0) {
      throw new Error(`afterAll gagal: ${errors.join(" | ")}`);
    }
  });

  test("(a) golden path: initialize, tools/list, get_workspace, list_accounts", async () => {
    clientA = await connectClient(session, api, BASE_URL, "golden", [
      "mcp:read",
      "mcp:draft",
    ]);

    // Token: JWT beraudiens resource MCP, dari klien ini, dengan scope baca.
    const claims = decodeJwtClaims(clientA.accessToken);
    expect(claims.aud).toBe(resourceUrl(BASE_URL));
    expect(claims.azp).toBe(clientA.clientId);
    expect(String(claims.scope).split(" ")).toEqual(
      expect.arrayContaining(["mcp:read", "mcp:draft"]),
    );

    // Server stateless: `initialize` tidak wajib, tetapi harus tetap berfungsi.
    const init = await mcpRequest(api, {
      token: clientA.accessToken,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "e2e-mcp-client", version: "0.0.0" },
      },
    });
    expect(init.status, init.text.slice(0, 300)).toBe(200);
    expect(init.body?.result?.serverInfo).toMatchObject({ name: "postific" });

    const list = await mcpRequest(api, {
      token: clientA.accessToken,
      method: "tools/list",
    });
    expect(list.status, list.text.slice(0, 300)).toBe(200);
    const names = ((list.body?.result?.tools ?? []) as { name: string }[]).map(
      (tool) => tool.name,
    );
    expect(names).toEqual(expect.arrayContaining(READ_TOOLS));

    const workspace = await callTool(api, clientA.accessToken, "get_workspace");
    expect(workspace.isError, JSON.stringify(workspace.payload)).toBe(false);
    const data = workspace.payload as {
      workspaceId: string;
      name: string;
      grantedScopes: string[];
    };
    expect(data.name).toBe(E2E_WORKSPACE_NAME);
    expect([...data.grantedScopes].sort()).toEqual(["draft", "read"]);
    expect(data.workspaceId).toBe(claims.workspace_id);
    sandboxWorkspaceId = data.workspaceId;

    const accounts = await callTool(api, clientA.accessToken, "list_accounts");
    expect(accounts.isError, JSON.stringify(accounts.payload)).toBe(false);
    expect(Array.isArray((accounts.payload as { items?: unknown }).items)).toBe(
      true,
    );
  });

  test("(b) tanpa token 401, Origin asing 403, GET 405", async () => {
    const noToken = await mcpRequest(api, { method: "tools/list" });
    expect(noToken.status).toBe(401);
    expect(noToken.headers["www-authenticate"]).toBeTruthy();

    // Origin diperiksa sebelum token; pakai token sah supaya jelas bukan 401.
    const evil = await mcpRequest(api, {
      token: clientA.accessToken,
      method: "tools/list",
      headers: { origin: "https://evil.example" },
    });
    expect(evil.status).toBe(403);

    const get = await api.get("/api/mcp");
    expect(get.status()).toBe(405);
    expect(get.headers()["allow"]).toBe("POST");
  });

  test("(c) klien tanpa scope read ditolak token_scope_insufficient", async () => {
    const draftOnly = await connectClient(session, api, BASE_URL, "draft", [
      "mcp:draft",
    ]);
    const claims = decodeJwtClaims(draftOnly.accessToken);
    expect(claims.workspace_id).toBe(sandboxWorkspaceId);
    expect(String(claims.scope).split(" ")).not.toContain("mcp:read");
    expect(String(claims.scope).split(" ")).toContain("mcp:draft");

    for (const tool of ["get_workspace", "list_accounts"]) {
      const outcome = await callTool(api, draftOnly.accessToken, tool);
      expect(outcome.isError, tool).toBe(true);
      expect(outcome.errorCode, tool).toBe("token_scope_insufficient");
    }
  });

  test("(d) refresh token menerbitkan access token baru yang berfungsi", async () => {
    expect(clientA.refreshToken, "refresh token dari tukar kode").toBeTruthy();
    const next = await refreshAccessToken(
      api,
      BASE_URL,
      clientA,
      clientA.refreshToken as string,
    );
    // Dibandingkan sebagai boolean: gagal asersi tidak boleh mencetak token.
    expect(
      next.accessToken === clientA.accessToken,
      "access token hasil refresh harus berbeda",
    ).toBe(false);
    refreshed = {
      accessToken: next.accessToken,
      refreshToken: next.refreshToken,
    };

    // Catatan keluaran: apakah refresh token berotasi.
    const rotated =
      next.refreshToken !== undefined &&
      next.refreshToken !== clientA.refreshToken;
    const note = rotated
      ? "refresh token BEROTASI (token baru, yang lama tidak boleh dipakai lagi)"
      : next.refreshToken === undefined
        ? "respons refresh TANPA refresh_token baru (token lama tetap dipakai)"
        : "refresh token TIDAK berotasi (nilai sama)";
    console.log(`[mcp.e2e] (d) ${note}`);
    test
      .info()
      .annotations.push({ type: "refresh-rotation", description: note });

    const outcome = await callTool(api, next.accessToken, "get_workspace");
    expect(outcome.isError, JSON.stringify(outcome.payload)).toBe(false);
    expect((outcome.payload as { workspaceId: string }).workspaceId).toBe(
      sandboxWorkspaceId,
    );

    // Rotasi berarti refresh token lama tidak boleh bisa dipakai lagi (replay).
    // Dicoba setelah pemeriksaan di atas supaya tidak mengganggunya.
    if (rotated) {
      const replay = await refreshExpectingFailure(
        api,
        BASE_URL,
        clientA,
        clientA.refreshToken as string,
      );
      expect(replay.status, "refresh dengan token lama setelah rotasi").toBe(
        400,
      );
      expect(replay.error, "refresh dengan token lama setelah rotasi").toBe(
        "invalid_grant",
      );
    }
  });

  test("(e) pencabutan: delete-consent memutus grant, token, dan refresh", async () => {
    // Sebelum dicabut, token hasil refresh berfungsi.
    const before = await callTool(api, refreshed.accessToken, "get_workspace");
    expect(before.isError, JSON.stringify(before.payload)).toBe(false);

    // Id consent dari endpoint plugin (`get-consents`), tanpa DB.
    const consent = await findConsentFor(session.request, clientA.clientId);
    expect(consent, "consent klien (a) terdaftar").toBeTruthy();
    expect(consent?.referenceId).toBe(sandboxWorkspaceId);

    // Status balasan sengaja tidak diasertasi (404 `no consent` itu
    // kejanggalan yang diketahui: transaksi pencabutan menghapus consent
    // lebih dulu). Hasil diverifikasi lewat efeknya di bawah.
    const deleted = await deleteConsent(
      session.request,
      BASE_URL,
      (consent as { id: string }).id,
    );
    console.log(
      `[mcp.e2e] (e) delete-consent membalas ${deleted.status} ${deleted.body.slice(0, 120)}`,
    );
    test.info().annotations.push({
      type: "delete-consent-status",
      description: String(deleted.status),
    });

    expect(
      await findConsentFor(session.request, clientA.clientId),
    ).toBeUndefined();

    // Kedua access token (asli dan hasil refresh) ditolak, meski JWT-nya
    // masih berlaku (masa berlaku 1 jam).
    for (const [label, token] of [
      ["access token asli", clientA.accessToken],
      ["access token hasil refresh", refreshed.accessToken],
    ] as const) {
      const outcome = await callTool(api, token, "get_workspace");
      expect(outcome.isError, label).toBe(true);
      expect(outcome.errorCode, label).toBe("no_active_grant");
    }

    // Refresh token (terbaru dan yang asli) harus ditolak dengan 4xx: pencabutan
    // menghapus refresh token koneksi itu bersama consent (terbukti di staging:
    // 400 invalid_grant), jadi tidak ada token baru yang bisa terbit.
    const refreshTokens = [refreshed.refreshToken, clientA.refreshToken].filter(
      (token): token is string => Boolean(token),
    );
    for (const refreshToken of new Set(refreshTokens)) {
      const attempt = await refreshExpectingFailure(
        api,
        BASE_URL,
        clientA,
        refreshToken,
      );
      console.log(
        `[mcp.e2e] (e) refresh setelah pencabutan: ${attempt.status} ${attempt.error ?? ""}`,
      );
      // Persis 400 `invalid_grant` (bukti staging T-150.7): 429, 5xx, atau
      // `invalid_request` tidak membuktikan refresh token sudah dihapus.
      expect(attempt.status, "refresh setelah pencabutan").toBe(400);
      expect(attempt.error, "refresh setelah pencabutan").toBe("invalid_grant");
    }
  });

  test("(f) member dikeluarkan: not_workspace_member, lalu pulih", async () => {
    const noDbReason =
      "Tidak ada koneksi DB yang boleh dipakai (DATABASE_URL, atau DIRECT_URL dengan opt-in E2E_ALLOW_DIRECT_URL=1): skenario (f) butuh tulis DB langsung (status workspace_members) dan sengaja di-skip.";
    if (!hasDbConnection())
      console.warn(`[mcp.e2e] (f) DI-SKIP: ${noDbReason}`);
    test.skip(!hasDbConnection(), noDbReason);
    const email = process.env.E2E_USER_EMAIL;
    expect(email, "E2E_USER_EMAIL").toBeTruthy();

    const probe = await probeSandboxMember(email as string);
    if (!probe.ok) console.warn(`[mcp.e2e] (f) DI-SKIP: ${probe.reason}`);
    test.skip(!probe.ok, probe.ok ? "" : probe.reason);
    if (!probe.ok) return;
    const ref = probe.ref;
    console.log(
      `[mcp.e2e] (f) DB: koneksi ${ref.connectionVar}, role ${ref.role}, bypass RLS ${ref.bypassRls}`,
    );
    test.info().annotations.push({
      type: "db-role",
      description: `${ref.connectionVar} role=${ref.role} bypassRls=${ref.bypassRls}`,
    });

    // Sisa run terhenti ditangani `healLeftoverRemovedMember` di `beforeAll`;
    // di sini baris yang akan diubah harus E2E Sandbox milik akun test dan
    // berstatus `active` (status awal dibaca sebelum mengubah).
    assertWorkspaceId(ref, sandboxWorkspaceId);
    expect(ref.status, "status awal member E2E").toBe("active");

    const clientC = await connectClient(session, api, BASE_URL, "member", [
      "mcp:read",
      "mcp:draft",
    ]);
    const first = await callTool(api, clientC.accessToken, "get_workspace");
    expect(first.isError, JSON.stringify(first.payload)).toBe(false);
    assertWorkspaceId(
      ref,
      (first.payload as { workspaceId: string }).workspaceId,
    );

    // `memberToRestore` diisi sebelum mengubah: `afterAll` memulihkan bila
    // blok di bawah terhenti di tengah jalan.
    memberToRestore = ref;
    try {
      await setMemberStatus(ref, "removed", "active");
      const removed = await callTool(api, clientC.accessToken, "get_workspace");
      expect(removed.isError, JSON.stringify(removed.payload)).toBe(true);
      expect(removed.errorCode).toBe("not_workspace_member");
    } finally {
      // Idempoten dan dengan retry: membaca status terbaru dulu, jadi aman
      // juga bila `setMemberStatus` terputus timeout setelah berhasil di server.
      await restoreMemberActive(ref);
      memberToRestore = undefined;
    }
    expect(await readMemberStatus(ref)).toBe("active");

    const restored = await callTool(api, clientC.accessToken, "get_workspace");
    expect(restored.isError, JSON.stringify(restored.payload)).toBe(false);
    expect((restored.payload as { workspaceId: string }).workspaceId).toBe(
      sandboxWorkspaceId,
    );
  });
});
