import { randomUUID } from "node:crypto";

import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
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
  waitUntilHydrated,
  type ConnectedClient,
} from "./support/mcp";
import { sleep } from "./support/sleep";
import {
  assertWorkspaceId,
  hasDbConnection,
  probeSandboxMember,
  readMemberStatus,
  restoreMemberActive,
  setMemberStatus,
  type SandboxMemberRef,
} from "./support/member-db";
import {
  hasAppRuntimeConnection,
  probeRateLimitWrite,
  probeWorkspaceChoicesWrite,
  readRateLimitRows,
  readRole,
  readTableRls,
} from "./support/mcp-tables-db";
import { E2E_WORKSPACE_NAME } from "./support/workspace";

/**
 * T-178 (S-002, ADR-149, ADR-139): E2E MCP terhadap staging. Tes memainkan
 * peran klien MCP (daftar, OAuth + PKCE, JSON-RPC ke `/api/mcp`) memakai akun
 * test dan workspace E2E Sandbox. Tool baca dipanggil bebas; skenario yang
 * menulis sungguhan semuanya opt-in: (h) `schedule_posts` (`E2E_MCP_SCHEDULE=1`,
 * menjadwalkan post ke Outstand, MCP tanpa tool batal, ADR-138), (i) draft
 * (`E2E_MCP_DRAFTS=1`, dihapus lewat UI Drafts), (k2) upload media
 * (`E2E_MCP_UPLOAD=1`). (j), (k), (m) hanya membaca/menolak; (n) menghabiskan
 * kuota `calls` workspace dan harus terakhir. Tidak pernah menyentuh workspace
 * nyata: data yang diubah hanya klien `e2e-*`, baris member akun test di E2E
 * Sandbox (f), dan data opt-in di atas.
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
 *   detik per IP; tes memakai beberapa pendaftaran per run, jadi run beruntun
 *   < 60 detik membuat `registerClient` menunggu jendela itu (hingga ~66
 *   detik) dan makan sebagian batas waktu tes. Klien read-only (g) dipakai
 *   ulang oleh (j), (k), (n); klien draft oleh (i), (k), (k2), (m).
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

/** Format waktu jadwal tanpa offset untuk `daysAhead` hari dari sekarang, jam 10:00. */
function localScheduleTime(daysAhead: number): string {
  const day = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return `${day.toISOString().slice(0, 10)}T10:00:00`;
}

interface AccountItem {
  id: string;
  platform: string;
  status: string;
  reconnectRequired: boolean;
  supportedContentFormats: string[];
}

/** Cermin `platformsWhosePostRequiresMedia()` (domain tidak bisa diimpor dari E2E). */
const POST_REQUIRES_MEDIA_PLATFORMS = ["instagram", "tiktok", "youtube"];

/** Akun sandbox yang bisa dipakai menjadwalkan format `post` (bukan Pinterest, tanpa perlu hubung ulang). */
function pickPostAccount(items: AccountItem[]): AccountItem | undefined {
  return items.find(
    (account) =>
      account.status === "active" &&
      !account.reconnectRequired &&
      account.platform !== "pinterest" &&
      // ADR-154: Post wajib media di platform ini; golden path tanpa media.
      !POST_REQUIRES_MEDIA_PLATFORMS.includes(account.platform) &&
      account.supportedContentFormats.includes("post"),
  );
}

const STAGING_WRITE_NOTE =
  "MCP tidak punya tool hapus, jadi tes ini menulis ke staging; jalankan hanya dengan opt-in eksplisit.";

const DRAFT_CLEANUP_PREFIX = "[e2e] create_draft";

/**
 * Hapus SEMUA draft berawalan `[e2e] create_draft` lewat UI Drafts
 * (pembersihan; MCP tak punya tool hapus). Menangkap caption lama maupun
 * baru bila update (i) gagal di tengah. Dipanggil hanya bila draft pernah
 * dibuat, jadi nol baris dilempar sebagai galat jelas, bukan diam-diam.
 */
async function deleteE2eDraftsViaUi(context: BrowserContext): Promise<void> {
  const page = await context.newPage();
  try {
    await page.goto("/publish/drafts");
    // Layar siap dulu: filter sumber pasti ada di Drafts dan harus terhidrasi
    // sebelum baris dihitung, supaya "nol baris" tidak berarti "belum dimuat".
    const trigger = page.getByRole("combobox", { name: "Filter sumber" });
    await expect(trigger, "Drafts: filter sumber").toBeVisible();
    await waitUntilHydrated(trigger, "Drafts");
    const rows = page.locator("tr", { hasText: DRAFT_CLEANUP_PREFIX });
    if ((await rows.count()) === 0) {
      throw new Error(
        `unverified: draft "${DRAFT_CLEANUP_PREFIX}" pernah dibuat tetapi tidak ada di Drafts saat dibersihkan (sudah terhapus atau tidak muncul)`,
      );
    }
    for (let guard = 0; guard < 10 && (await rows.count()) > 0; guard += 1) {
      const before = await rows.count();
      await rows.first().getByRole("button", { name: "Hapus draft" }).click();
      await page
        .getByRole("button", { name: "Hapus Draft", exact: true })
        .click();
      await expect(rows).toHaveCount(before - 1);
    }
    await expect(rows, "semua draft [e2e] terhapus").toHaveCount(0);
  } finally {
    await page.close();
  }
}

/** Buka dropdown filter sumber dan pilih satu opsi. */
async function chooseSource(page: Page, label: string): Promise<void> {
  const trigger = page.getByRole("combobox", { name: "Filter sumber" });
  await trigger.click();
  await page.getByRole("option", { name: label, exact: true }).click();
  await expect(trigger).toContainText(label);
}

const MCP_BADGE_TEXT = "Dibuat lewat MCP oleh";
const MCP_EMPTY_TITLE = "Belum ada konten dari klien AI";

/**
 * Kontrak filter sumber di satu layar (T-157): bawaan "Semua Sumber"; "Dibuat
 * Manual" tidak pernah menampilkan badge MCP; "Lewat MCP" menampilkan hanya
 * item berbadge, atau state kosong khusus dengan "Tampilkan Semua" yang
 * mengembalikan ke bawaan.
 */
async function assertSourceFilterContract(
  page: Page,
  path: string,
): Promise<void> {
  await page.goto(path);
  const trigger = page.getByRole("combobox", { name: "Filter sumber" });
  await expect(trigger, `${path}: filter sumber`).toBeVisible();
  await waitUntilHydrated(trigger, path);
  await expect(trigger, `${path}: bawaan`).toContainText("Semua Sumber");

  await chooseSource(page, "Dibuat Manual");
  await expect(
    page.getByText(MCP_BADGE_TEXT),
    `${path}: Dibuat Manual menyembunyikan badge MCP`,
  ).toHaveCount(0);

  await chooseSource(page, "Lewat MCP");
  const badges = page.getByText(MCP_BADGE_TEXT);
  const empty = page.getByText(MCP_EMPTY_TITLE);
  await expect(
    badges.first().or(empty),
    `${path}: Lewat MCP berisi item berbadge atau state kosong`,
  ).toBeVisible();
  if (await empty.isVisible()) {
    await page.getByRole("button", { name: "Tampilkan Semua" }).click();
    await expect(trigger).toContainText("Semua Sumber");
  }
}

/** Batas kuota `calls` per menit (sama dengan server; env hanya bila server diubah). */
const RATE_LIMIT_CALLS = Number(process.env.E2E_MCP_RATE_LIMIT_CALLS) || 60;

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
  /** Klien scope `read` saja dari (g): dipakai ulang oleh (j), (k), (n) agar tidak menambah pendaftaran klien (batas 5/menit/IP). */
  let readOnlyClient: ConnectedClient | undefined;
  /** Epoch ms sebelum (n) memanggil MCP; dipakai (o) membatasi baris penghitung run ini. */
  let rateLimitStartedAt: number | undefined;
  /** Klien read+draft dari (i)/(k); namanya dicari di badge sumber pada (m). */
  let draftClient: ConnectedClient | undefined;
  /** Caption draft `[e2e] create_draft` dari (i), lama dan baru; dihapus lewat UI Drafts di `afterAll`. */
  const createdDraftCaptions: string[] = [];
  /** Caption post `[e2e]` yang dijadwalkan (h) (hanya bila opt-in); dicari di Queue pada (m). */
  let scheduledMcpCaption: string | undefined;

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
      await step("hapus draft [e2e] lewat UI Drafts", async () => {
        if (createdDraftCaptions.length > 0) {
          await deleteE2eDraftsViaUi(session);
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

  test("(g) schedule_posts: tanpa scope schedule ditolak; batas 10 konten dan waktu lampau ditolak tanpa efek samping", async () => {
    const readOnly = await connectClient(session, api, BASE_URL, "noschedule", [
      "mcp:read",
    ]);
    readOnlyClient = readOnly;
    const denied = await callTool(api, readOnly.accessToken, "schedule_posts", {
      posts: [],
    });
    expect(denied.isError).toBe(true);
    expect(denied.errorCode).toBe("token_scope_insufficient");

    const scheduler = await connectClient(session, api, BASE_URL, "schedule", [
      "mcp:read",
      "mcp:schedule",
    ]);
    const claims = decodeJwtClaims(scheduler.accessToken);
    expect(String(claims.scope).split(" ")).toContain("mcp:schedule");

    const list = await mcpRequest(api, {
      token: scheduler.accessToken,
      method: "tools/list",
    });
    const tool = (
      (list.body?.result?.tools ?? []) as {
        name: string;
        annotations?: { readOnlyHint?: boolean };
      }[]
    ).find((candidate) => candidate.name === "schedule_posts");
    expect(tool, "schedule_posts ada di tools/list").toBeTruthy();
    expect(tool?.annotations?.readOnlyHint).toBe(false);

    const accounts = await callTool(
      api,
      scheduler.accessToken,
      "list_accounts",
    );
    expect(accounts.isError, JSON.stringify(accounts.payload)).toBe(false);
    const account = pickPostAccount(
      (accounts.payload as { items: AccountItem[] }).items,
    );
    const accountId = account?.id ?? "99999999-9999-4999-8999-999999999999";
    const target = { accountId, contentFormat: "post" };

    // Batas 10 konten: ditolak utuh sebelum ada yang diproses.
    const tooMany = await callTool(
      api,
      scheduler.accessToken,
      "schedule_posts",
      {
        posts: Array.from({ length: 11 }, () => ({
          caption: "[e2e] tidak boleh terjadwal",
          scheduledAt: localScheduleTime(29),
          targets: [target],
        })),
      },
    );
    expect(tooMany.isError).toBe(true);
    expect(tooMany.errorCode).toBe("invalid_input");

    // Waktu lampau ditolak per konten oleh Safety Check; tidak ada yang terjadwal.
    const past = await callTool(api, scheduler.accessToken, "schedule_posts", {
      posts: [
        {
          caption: "[e2e] waktu lampau",
          scheduledAt: "2020-01-01T10:00:00",
          targets: [target],
        },
      ],
    });
    expect(past.isError, JSON.stringify(past.payload)).toBe(false);
    const pastData = past.payload as {
      summary: { requested: number; scheduled: number; failed: number };
      results: { status: string; error?: { code: string; message: string } }[];
    };
    expect(pastData.summary).toEqual({ requested: 1, scheduled: 0, failed: 1 });
    expect(pastData.results[0]?.status).toBe("failed");
    expect(pastData.results[0]?.error?.code).toBe("invalid_input");
    if (account) {
      expect(pastData.results[0]?.error?.message).toMatch(/sudah lewat/);
    } else {
      // Tanpa akun sandbox yang cocok, penolakan waktu lampau tidak bisa
      // dibedakan dari penolakan target: jangan diam-diam dianggap terbukti.
      const note =
        "(g) pesan 'sudah lewat' TIDAK diverifikasi: E2E Sandbox tidak punya akun terhubung aktif (non-Pinterest, format post).";
      console.warn(`[mcp.e2e] ${note}`);
      test.info().annotations.push({ type: "unverified", description: note });
    }
  });

  test("(h) golden path schedule_posts: batch sebagian berhasil, waktu di zona pengguna, tampil di list_scheduled_posts", async () => {
    const reason =
      "Golden path schedule_posts menjadwalkan SATU post sungguhan ke akun terhubung E2E Sandbox via Outstand dan MCP tidak punya tool batal (ADR-138): jalankan hanya dengan opt-in E2E_MCP_SCHEDULE=1, lalu batalkan post berawalan [e2e] di Publish > Queue.";
    if (process.env.E2E_MCP_SCHEDULE !== "1")
      console.warn(`[mcp.e2e] (h) DI-SKIP: ${reason}`);
    test.skip(process.env.E2E_MCP_SCHEDULE !== "1", reason);

    const client = await connectClient(session, api, BASE_URL, "schedule-gp", [
      "mcp:read",
      "mcp:schedule",
    ]);
    const workspace = await callTool(api, client.accessToken, "get_workspace");
    expect(workspace.isError, JSON.stringify(workspace.payload)).toBe(false);
    const { timezone } = workspace.payload as { timezone: string };
    expect(timezone, "zona waktu pemilik koneksi").toBeTruthy();

    const accounts = await callTool(api, client.accessToken, "list_accounts");
    const account = pickPostAccount(
      (accounts.payload as { items: AccountItem[] }).items,
    );
    const noAccount =
      "E2E Sandbox tidak punya akun terhubung aktif (non-Pinterest, format post) untuk golden path schedule_posts.";
    if (!account) console.warn(`[mcp.e2e] (h) DI-SKIP: ${noAccount}`);
    test.skip(!account, noAccount);
    if (!account) return;

    const stamp = Date.now().toString(36);
    const caption = `[e2e] schedule_posts ${stamp}`;
    scheduledMcpCaption = caption;
    const when = localScheduleTime(29);
    const outcome = await callTool(api, client.accessToken, "schedule_posts", {
      posts: [
        {
          caption,
          scheduledAt: when,
          targets: [{ accountId: account.id, contentFormat: "post" }],
        },
        {
          caption: `[e2e] lampau ${stamp}`,
          scheduledAt: "2020-01-01T10:00:00",
          targets: [{ accountId: account.id, contentFormat: "post" }],
        },
      ],
    });
    expect(outcome.isError, JSON.stringify(outcome.payload)).toBe(false);
    const data = outcome.payload as {
      timezone: string;
      summary: { requested: number; scheduled: number; failed: number };
      results: {
        index: number;
        status: string;
        postId?: string;
        scheduledAt?: string;
        targets?: { accountId: string; contentFormat: string }[];
        error?: { code: string };
      }[];
    };
    expect(data.timezone).toBe(timezone);
    expect(data.summary).toEqual({ requested: 2, scheduled: 1, failed: 1 });

    const [ok, bad] = data.results;
    expect(ok?.status, JSON.stringify(ok)).toBe("scheduled");
    expect(ok?.postId).toBeTruthy();
    // Jam 10:00 tanpa offset dibaca di zona pengguna: hasil memuat jam yang sama plus offset.
    expect(ok?.scheduledAt).toMatch(new RegExp(`^${when}[+-]\\d{2}:\\d{2}$`));
    expect(ok?.targets).toEqual([
      expect.objectContaining({ accountId: account.id, contentFormat: "post" }),
    ]);
    expect(bad?.status).toBe("failed");
    expect(bad?.error?.code).toBe("invalid_input");

    // Post terjadwal tampil di Queue; antrean naik menurut waktu, jadi telusuri halaman.
    let cursor: string | undefined;
    let found = false;
    for (let page = 0; page < 10 && !found; page += 1) {
      const queue = await callTool(
        api,
        client.accessToken,
        "list_scheduled_posts",
        cursor ? { cursor } : {},
      );
      expect(queue.isError, JSON.stringify(queue.payload)).toBe(false);
      const body = queue.payload as {
        items: { id: string }[];
        nextCursor: string | null;
      };
      found = body.items.some((item) => item.id === ok?.postId);
      if (!body.nextCursor) break;
      cursor = body.nextCursor;
    }
    expect(found, "post terjadwal muncul di list_scheduled_posts").toBe(true);
  });
  // -------------------------------------------------------------------------
  // T-189.3: create_draft / update_draft (T-152)
  // -------------------------------------------------------------------------

  test("(i) create_draft dan update_draft: created_via mcp, client id terisi, post non-draft ditolak", async () => {
    test.setTimeout(240_000);
    const reason = `Menulis draft [e2e] ke E2E Sandbox (dihapus lewat UI Drafts di akhir). ${STAGING_WRITE_NOTE} Set E2E_MCP_DRAFTS=1.`;
    if (process.env.E2E_MCP_DRAFTS !== "1")
      console.warn(`[mcp.e2e] (i) DI-SKIP: ${reason}`);
    test.skip(process.env.E2E_MCP_DRAFTS !== "1", reason);

    draftClient = await connectClient(session, api, BASE_URL, "drafts", [
      "mcp:read",
      "mcp:draft",
    ]);
    const token = draftClient.accessToken;
    const clientId = draftClient.clientId;
    const stamp = Date.now().toString(36);
    const caption = `[e2e] create_draft ${stamp}`;
    createdDraftCaptions.push(caption);

    const created = await callTool(api, token, "create_draft", { caption });
    expect(created.isError, JSON.stringify(created.payload)).toBe(false);
    const draft = created.payload as {
      id: string;
      status: string;
      caption: string;
      createdVia: string;
    };
    expect(draft.id).toBeTruthy();
    expect(draft.status).toBe("draft");
    expect(draft.caption).toBe(caption);
    expect(draft.createdVia).toBe("mcp");

    // Terbaca kembali lewat tool baca: penanda sumber dan id klien OAuth.
    const readBack = async () => {
      let cursor: string | undefined;
      for (let page = 0; page < 10; page += 1) {
        const out = await callTool(
          api,
          token,
          "list_drafts",
          cursor ? { cursor } : {},
        );
        expect(out.isError, JSON.stringify(out.payload)).toBe(false);
        const body = out.payload as {
          items: {
            id: string;
            caption: string;
            createdVia: string;
            createdViaClientId: string | null;
          }[];
          nextCursor: string | null;
        };
        const hit = body.items.find((item) => item.id === draft.id);
        if (hit) return hit;
        if (!body.nextCursor) break;
        cursor = body.nextCursor;
      }
      return undefined;
    };
    const listed = await readBack();
    expect(listed, "draft baru muncul di list_drafts").toBeTruthy();
    expect(listed?.createdVia).toBe("mcp");
    expect(listed?.createdViaClientId).toBe(clientId);

    // update_draft: caption berganti, penanda sumber dan klien tidak berubah.
    const newCaption = `${caption} (diubah)`;
    // Catat caption baru DI SAMPING yang lama: bila update gagal di tengah,
    // cleanup tetap menemukan baris mana pun yang tersisa.
    createdDraftCaptions.push(newCaption);
    const updated = await callTool(api, token, "update_draft", {
      postId: draft.id,
      caption: newCaption,
    });
    expect(updated.isError, JSON.stringify(updated.payload)).toBe(false);
    expect((updated.payload as { caption: string }).caption).toBe(newCaption);
    const after = await readBack();
    expect(after?.caption).toBe(newCaption);
    expect(after?.createdVia).toBe("mcp");
    expect(after?.createdViaClientId).toBe(clientId);

    // Post yang bukan draft ditolak `conflict`. Memakai post Scheduled yang
    // sudah ada di E2E Sandbox (tanpa menulis apa pun); tanpa itu, post
    // terbit sebagai pengganti, dan bila keduanya tidak ada ditandai belum terbukti.
    // Post nyata (bukan "[e2e]") dikirimi caption yang SAMA dengan miliknya,
    // jadi bila penolakan `conflict` regresi, update itu tanpa efek.
    const pickNonDraft = async (tool: string) => {
      const out = await callTool(api, token, tool);
      expect(out.isError, JSON.stringify(out.payload)).toBe(false);
      const items = (
        out.payload as { items: { id: string; caption?: string }[] }
      ).items;
      const own = items.find((item) => item.caption?.startsWith("[e2e]"));
      if (own) return { id: own.id, caption: "[e2e] harus ditolak" };
      const real = items.find((item) => item.caption);
      return real
        ? { id: real.id, caption: real.caption as string }
        : undefined;
    };
    const scheduled = await pickNonDraft("list_scheduled_posts");
    const published = scheduled
      ? undefined
      : await pickNonDraft("list_published_posts");
    const target = scheduled ?? published;
    const targetStatus = scheduled ? "scheduled" : "published";
    if (target) {
      const rejected = await callTool(api, token, "update_draft", {
        postId: target.id,
        caption: target.caption,
      });
      expect(
        rejected.isError,
        `update_draft pada post ${targetStatus} harus ditolak`,
      ).toBe(true);
      expect(rejected.errorCode).toBe("conflict");
      if (!scheduled) {
        test.info().annotations.push({
          type: "unverified",
          description:
            "(i) penolakan diuji pada post published; E2E Sandbox tidak punya post Scheduled (jalankan (h) dengan E2E_MCP_SCHEDULE=1 lebih dulu).",
        });
      }
    } else {
      test.info().annotations.push({
        type: "unverified",
        description:
          "(i) penolakan post non-draft TIDAK terbukti: E2E Sandbox tidak punya post terjadwal/terbit berkaption (tanpa caption, tak ada nilai aman untuk dikirim).",
      });
    }
  });

  test("(j) scope read saja: create_draft dan update_draft ditolak token_scope_insufficient", async () => {
    expect(readOnlyClient, "klien read-only dari (g)").toBeTruthy();
    const token = (readOnlyClient as ConnectedClient).accessToken;
    expect(String(decodeJwtClaims(token).scope).split(" ")).not.toContain(
      "mcp:draft",
    );

    const create = await callTool(api, token, "create_draft", {
      caption: "[e2e] tidak boleh tercipta",
    });
    expect(create.isError).toBe(true);
    expect(create.errorCode).toBe("token_scope_insufficient");

    const update = await callTool(api, token, "update_draft", {
      postId: "99999999-9999-4999-8999-999999999999",
      caption: "[e2e] tidak boleh",
    });
    expect(update.isError).toBe(true);
    expect(update.errorCode).toBe("token_scope_insufficient");

    // Tidak ada efek samping: draft yang ditolak tidak tercipta.
    const drafts = await callTool(api, token, "list_drafts");
    expect(drafts.isError, JSON.stringify(drafts.payload)).toBe(false);
    const items = (drafts.payload as { items: { caption: string }[] }).items;
    expect(
      items.some((item) => item.caption === "[e2e] tidak boleh tercipta"),
    ).toBe(false);
  });

  // -------------------------------------------------------------------------
  // T-155.7: upload_media (T-155)
  // -------------------------------------------------------------------------

  test("(k) upload_media menolak URL berbahaya dan scope read saja, tanpa unduhan", async () => {
    test.setTimeout(240_000);
    draftClient ??= await connectClient(session, api, BASE_URL, "drafts", [
      "mcp:read",
      "mcp:draft",
    ]);
    const token = draftClient.accessToken;
    // Skema, userinfo, dan IP literal ditolak pada validasi URL, sebelum DNS
    // atau koneksi apa pun. Host `.invalid` (RFC 2606) lolos validasi lalu
    // gagal resolve DNS (paling jauh satu lookup, tanpa koneksi HTTP): tidak
    // ada unduhan dari mana pun dan tidak ada tulis ke Media Library.
    // Pesan galat server dicocokkan per kelas (lihat safe-fetch.ts MESSAGES).
    const invalidUrlMessage = "URL tidak valid";
    const blockedMessage = "tidak diizinkan atau tidak dapat dijangkau";
    const dangerous: { url: string; message: string }[] = [
      {
        url: "http://e2e-no-such-host.invalid/a.png",
        message: invalidUrlMessage,
      },
      {
        url: "https://user:pass@e2e-no-such-host.invalid/a.png",
        message: invalidUrlMessage,
      },
      { url: "https://127.0.0.1/a.png", message: blockedMessage },
      {
        url: "https://169.254.169.254/latest/meta-data/",
        message: blockedMessage,
      },
      {
        url: "https://e2e-no-such-host.invalid/a.png",
        message: blockedMessage,
      },
    ];
    for (const { url, message } of dangerous) {
      const outcome = await callTool(api, token, "upload_media", { url });
      expect(outcome.isError, url).toBe(true);
      expect(outcome.errorCode, url).toBe("invalid_input");
      expect(
        (outcome.payload as { error?: { message?: string } }).error?.message,
        `${url}: pesan galat`,
      ).toContain(message);
    }
    expect(readOnlyClient, "klien read-only dari (g)").toBeTruthy();
    const denied = await callTool(
      api,
      (readOnlyClient as ConnectedClient).accessToken,
      "upload_media",
      { url: "https://e2e-no-such-host.invalid/a.png" },
    );
    expect(denied.isError).toBe(true);
    expect(denied.errorCode).toBe("token_scope_insufficient");
  });

  test("(k2) golden path upload_media: unggah dari URL tepercaya, muncul di list_media", async () => {
    test.setTimeout(240_000);
    const uploadUrl = process.env.E2E_MCP_UPLOAD_URL;
    const reason = `Golden path upload_media mengunduh E2E_MCP_UPLOAD_URL (URL https publik milik tim ke JPEG/PNG/WebP/GIF kecil, jangan URL pihak lain) dan menulis MediaItem ke E2E Sandbox tanpa jalur hapus di MCP. ${STAGING_WRITE_NOTE} Set E2E_MCP_UPLOAD=1 dan E2E_MCP_UPLOAD_URL.`;
    const enabled = process.env.E2E_MCP_UPLOAD === "1" && Boolean(uploadUrl);
    if (!enabled) console.warn(`[mcp.e2e] (k2) DI-SKIP: ${reason}`);
    test.skip(!enabled, reason);

    draftClient ??= await connectClient(session, api, BASE_URL, "drafts", [
      "mcp:read",
      "mcp:draft",
    ]);
    const token = draftClient.accessToken;
    const filename = `e2e-upload-${Date.now().toString(36)}.png`;
    const outcome = await callTool(api, token, "upload_media", {
      url: uploadUrl,
      filename,
    });
    expect(outcome.isError, JSON.stringify(outcome.payload)).toBe(false);
    const media = outcome.payload as {
      id: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
    };
    expect(media.id).toBeTruthy();
    expect(media.filename).toBe(filename);
    expect(media.mimeType).toMatch(
      /^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime))$/,
    );
    expect(media.sizeBytes).toBeGreaterThan(0);

    let cursor: string | undefined;
    let found = false;
    for (let page = 0; page < 10 && !found; page += 1) {
      const list = await callTool(
        api,
        token,
        "list_media",
        cursor ? { cursor } : {},
      );
      expect(list.isError, JSON.stringify(list.payload)).toBe(false);
      const body = list.payload as {
        items: { id: string }[];
        nextCursor: string | null;
      };
      found = body.items.some((item) => item.id === media.id);
      if (!body.nextCursor) break;
      cursor = body.nextCursor;
    }
    expect(found, "media hasil upload muncul di list_media").toBe(true);
    test.info().annotations.push({
      type: "written",
      description: `MediaItem ${filename} tertinggal di Media Library E2E Sandbox (hapus manual).`,
    });
  });

  // -------------------------------------------------------------------------
  // T-156.5: Settings klien AI
  // -------------------------------------------------------------------------

  test("(l) Settings klien AI: grant tampil di daftar, Cabut memutus akses klien", async () => {
    test.setTimeout(240_000);
    const client = await connectClient(session, api, BASE_URL, "settings", [
      "mcp:read",
    ]);
    const before = await callTool(api, client.accessToken, "get_workspace");
    expect(before.isError, JSON.stringify(before.payload)).toBe(false);

    const page = await session.newPage();
    try {
      await page.goto("/settings/account/ai-clients");
      // Baris dikenali dari nama klien (unik per run), bukan dari urutan.
      const row = page.locator("tr", { hasText: client.clientName });
      await expect(row, "grant klien tampil di daftar").toBeVisible();
      await expect(row).toContainText(E2E_WORKSPACE_NAME);
      await expect(row).toContainText(/read/);

      const revoke = row.getByRole("button", { name: "Cabut", exact: true });
      await waitUntilHydrated(revoke, "Settings Klien AI");
      await revoke.click();

      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText(`Cabut akses ${client.clientName}?`);
      // Batal tidak mencabut apa pun.
      await dialog.getByRole("button", { name: "Batal" }).click();
      await expect(dialog).toBeHidden();
      await expect(row).toBeVisible();
      const stillWorks = await callTool(
        api,
        client.accessToken,
        "get_workspace",
      );
      expect(stillWorks.isError, "Batal tidak boleh mencabut").toBe(false);

      await revoke.click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Cabut Akses" })
        .click();
      await expect(
        page.locator("tr", { hasText: client.clientName }),
        "baris hilang setelah dicabut",
      ).toHaveCount(0);
    } finally {
      await page.close();
    }

    // Batas publik: token klien yang dicabut dari UI ditolak server MCP.
    const after = await callTool(api, client.accessToken, "get_workspace");
    expect(after.isError).toBe(true);
    expect(after.errorCode).toBe("no_active_grant");
  });

  // -------------------------------------------------------------------------
  // T-157.1: badge dan filter sumber MCP
  // -------------------------------------------------------------------------

  test("(m) badge dan filter sumber MCP di Drafts, Queue, dan History", async () => {
    const page = await session.newPage();
    try {
      // Drafts: draft MCP asli dari (i), bila ada.
      await assertSourceFilterContract(page, "/publish/drafts");
      if (draftClient && createdDraftCaptions.length > 0) {
        const caption = createdDraftCaptions[createdDraftCaptions.length - 1];
        await page.goto("/publish/drafts");
        const trigger = page.getByRole("combobox", { name: "Filter sumber" });
        await waitUntilHydrated(trigger, "Drafts");
        const row = page.locator("tr", { hasText: caption });
        await expect(row, "draft MCP tampil di Drafts").toBeVisible();
        await expect(row, "badge memuat nama klien").toContainText(
          `${MCP_BADGE_TEXT} ${draftClient.clientName}`,
        );
        await chooseSource(page, "Lewat MCP");
        await expect(row).toBeVisible();
        await chooseSource(page, "Dibuat Manual");
        await expect(row, "draft MCP disembunyikan filter manual").toHaveCount(
          0,
        );
        await chooseSource(page, "Semua Sumber");
        await expect(row).toBeVisible();
      } else {
        test.info().annotations.push({
          type: "unverified",
          description:
            "(m) badge pada draft MCP nyata TIDAK terbukti: (i) di-skip (set E2E_MCP_DRAFTS=1). Hanya kontrak filter yang diperiksa.",
        });
      }

      await assertSourceFilterContract(page, "/publish/queue");
      if (scheduledMcpCaption) {
        await page.goto("/publish/queue");
        await waitUntilHydrated(
          page.getByRole("combobox", { name: "Filter sumber" }),
          "Queue",
        );
        const card = page.locator('[data-slot="card"]', {
          hasText: scheduledMcpCaption,
        });
        await expect(card, "post MCP terjadwal tampil di Queue").toBeVisible();
        await expect(card).toContainText(MCP_BADGE_TEXT);
        await chooseSource(page, "Dibuat Manual");
        await expect(card).toHaveCount(0);
      } else {
        test.info().annotations.push({
          type: "unverified",
          description:
            "(m) badge pada post MCP nyata di Queue TIDAK terbukti: (h) di-skip (set E2E_MCP_SCHEDULE=1). History tak bisa dipenuhi lewat MCP (tak ada tool publish).",
        });
      }

      await assertSourceFilterContract(page, "/publish/history");
    } finally {
      await page.close();
    }
  });

  // -------------------------------------------------------------------------
  // T-189.4: rate limit (T-154). HARUS terakhir: menghabiskan kuota `calls`
  // WORKSPACE (bukan per klien/token) untuk sisa menit itu, jadi tidak boleh
  // ada E2E lain yang memanggil MCP sesudahnya (berkas lain, worker paralel).
  // -------------------------------------------------------------------------

  test("(n) panggilan ke-61 dalam semenit ditolak rate_limited dengan retryAfterSeconds", async () => {
    test.setTimeout(240_000);
    expect(readOnlyClient, "klien read-only dari (g)").toBeTruthy();
    const token = (readOnlyClient as ConnectedClient).accessToken;
    const limit = RATE_LIMIT_CALLS;
    const WINDOW_MS = 60_000;

    // Jendela tetap kelipatan menit epoch (UTC): mulai sesaat setelah batas
    // supaya semua panggilan jatuh di satu jendela dan penolakan tepat di limit+1.
    // Sebelum sleep: `window_start` adalah batas menit di depan, bukan `startedAt`.
    rateLimitStartedAt = Date.now();
    await sleep(WINDOW_MS - (Date.now() % WINDOW_MS) + 3_000);
    const startedAt = Date.now();

    // Gelombang paralel (10 sekaligus) agar 60 panggilan selesai jauh di
    // dalam jendela walau latensi staging tinggi.
    const BATCH = 10;
    for (let first = 1; first <= limit; first += BATCH) {
      const calls = Array.from(
        { length: Math.min(BATCH, limit - first + 1) },
        (_, index) => first + index,
      );
      const results = await Promise.all(
        calls.map(async (call) => ({
          call,
          out: await callTool(api, token, "get_workspace"),
        })),
      );
      for (const { call, out } of results) {
        expect(
          out.isError,
          `panggilan ke-${call} (limit ${limit}) tidak boleh ditolak: ${JSON.stringify(out.payload)}`,
        ).toBe(false);
      }
      expect(
        Date.now() - startedAt,
        "panggilan terlalu lambat: jendela 60 detik terlewati, hasil tak bisa dinilai",
      ).toBeLessThan(WINDOW_MS - 5_000);
    }

    const denied = await callTool(api, token, "get_workspace");
    expect(denied.isError, JSON.stringify(denied.payload)).toBe(true);
    expect(denied.errorCode).toBe("rate_limited");
    const details = (
      denied.payload as {
        error: { retryAfterSeconds: number; quota: string; limit: number };
      }
    ).error;
    expect(details.quota).toBe("calls");
    expect(details.limit).toBe(limit);
    expect(details.retryAfterSeconds).toBeGreaterThan(0);
    expect(details.retryAfterSeconds).toBeLessThanOrEqual(60);

    // Penolakan tidak membuka jalan: panggilan berikutnya di jendela itu tetap ditolak.
    const again = await callTool(api, token, "get_workspace");
    expect(again.errorCode).toBe("rate_limited");
  });

  // -------------------------------------------------------------------------
  // (o) T-189.1 dan T-189.4: perilaku role `app_runtime` pada tabel MCP lewat
  // koneksi langsung `DATABASE_URL`. Bukan bukti jalur aplikasi (consent,
  // T-189.2) dan bukan bukti bahwa runtime Railway memakai role itu; hanya
  // bukti bahwa role + policy + RLS mengizinkan operasi yang dibutuhkan jalur
  // aplikasi. Tidak memanggil MCP, jadi aman sesudah (n).
  // -------------------------------------------------------------------------

  test("(o) app_runtime pada mcp_workspace_choices dan mcp_rate_limit_windows (T-189.1, T-189.4)", async () => {
    const noDbReason =
      "DATABASE_URL (role app_runtime) tidak tersedia: bukti RLS app_runtime butuh koneksi itu, DIRECT_URL (superuser) tidak berarti.";
    if (!hasAppRuntimeConnection())
      console.warn(`[mcp.e2e] (o) DI-SKIP: ${noDbReason}`);
    test.skip(!hasAppRuntimeConnection(), noDbReason);
    expect(sandboxWorkspaceId, "workspace E2E dari (a)").not.toBe("");
    expect(rateLimitStartedAt, "(n) mencatat waktu mulai").toBeDefined();

    const role = await readRole();
    console.log(
      `[mcp.e2e] (o) DB: role ${role.role}, bypass RLS ${role.bypassRls}`,
    );
    test.info().annotations.push({
      type: "db-role",
      description: `DATABASE_URL role=${role.role} bypassRls=${role.bypassRls}`,
    });
    expect(role.role, "role koneksi").toBe("app_runtime");
    expect(role.bypassRls, "app_runtime tidak boleh melewati RLS").toBe(false);

    // Struktur: RLS aktif, policy untuk app_runtime ada, dan app_runtime bukan
    // pemilik tabel (pemilik melewati RLS karena tabel tidak FORCE).
    for (const table of [
      "mcp_workspace_choices",
      "mcp_rate_limit_windows",
    ] as const) {
      const rls = await readTableRls(table);
      expect(rls.rlsEnabled, `${table}: RLS aktif`).toBe(true);
      expect(rls.policies, `${table}: policy app_runtime`).toContain(
        `${table}_app_runtime`,
      );
      expect(rls.owner, `${table}: pemilik bukan app_runtime`).not.toBe(
        "app_runtime",
      );
    }

    // T-189.1: sebagai app_runtime (RLS berlaku) INSERT, SELECT, DELETE pada
    // mcp_workspace_choices lolos; di-ROLLBACK. Tanpa FK, jadi workspace uji acak.
    const choices = await probeWorkspaceChoicesWrite({
      userId: "e2e-rls-probe-user",
      workspaceId: randomUUID(),
    });
    expect(choices.readBack, "baris terbaca kembali sebagai app_runtime").toBe(
      1,
    );
    expect(choices.deleted, "baris terhapus sebagai app_runtime").toBe(1);

    // T-189.4: upsert penghitung seperti repository, baca, dan DELETE (purge
    // JOB-08) pada mcp_rate_limit_windows sebagai app_runtime; di-ROLLBACK.
    const write = await probeRateLimitWrite(sandboxWorkspaceId);
    expect(write.inserted, "INSERT penghitung").toBe(1);
    expect(write.upserted, "ON CONFLICT DO UPDATE penghitung").toBe(1);
    expect(write.count, "penghitung naik 1 lalu 2").toBe(2);
    expect(write.deleted, "DELETE penghitung").toBe(1);

    // Penghitung yang ditulis aplikasi oleh (n) pada run ini: dibatasi sejak
    // (n) mulai agar baris run lama tidak membuat tes lulus basi.
    const rows = await readRateLimitRows(
      sandboxWorkspaceId,
      new Date(rateLimitStartedAt as number),
    );
    const calls = rows.filter((row) => row.quota === "calls");
    expect(calls.length, "baris calls dari (n) pada run ini").toBeGreaterThan(
      0,
    );
    expect(
      Math.max(...calls.map((row) => row.count)),
      "penghitung calls tepat di limit",
    ).toBe(RATE_LIMIT_CALLS);
  });
});
