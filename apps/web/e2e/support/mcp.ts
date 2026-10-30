import { createHash, randomBytes } from "node:crypto";

import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
  type Page,
} from "@playwright/test";

import { e2eName, isE2eData } from "./e2e-data";
import { sleep } from "./sleep";
import { E2E_WORKSPACE_NAME } from "./workspace";

/**
 * Helper tes E2E MCP (T-178.2, S-002, ADR-139). Tes memainkan peran klien
 * MCP: mendaftar lewat pendaftaran dinamis, OAuth + PKCE, lalu memanggil
 * `/api/mcp` lewat JSON-RPC. Kode di sini hanya untuk staging (lihat
 * `mcpSkipReason`).
 */

/** Redirect URI palsu: hanya ditangkap lewat `page.route`, tidak ada yang listen. */
const REDIRECT_URI = "http://127.0.0.1:53682/callback";

/** Scope yang diminta klien: baca, draft, dan refresh token. */
export const ALL_REQUESTED_SCOPES = "mcp:read mcp:draft offline_access";

// ---------------------------------------------------------------------------
// Guard staging-only
// ---------------------------------------------------------------------------

/**
 * Host staging Postific (Railway, `PROJECT_STATE.md`): satu-satunya target
 * bawaan. Bisa diganti lewat `E2E_STAGING_HOST` (hostname, tanpa skema), mis.
 * bila domain staging berubah.
 */
const DEFAULT_STAGING_HOST = "web-staging-60d7.up.railway.app";

/**
 * Alasan berkas MCP E2E harus di-skip, atau `null` bila boleh jalan.
 *
 * ALLOWLIST host persis, bukan denylist dan bukan akhiran domain: hanya
 * `https:` dengan host sama dengan `E2E_STAGING_HOST` (bawaan
 * `DEFAULT_STAGING_HOST`) yang lolos. Akhiran `.up.railway.app` terlalu longgar:
 * itu hosting bersama, jadi layanan produksi proyek ini atau aplikasi pihak
 * lain ikut lolos. Alasannya: `DATABASE_URL` lokal menunjuk DB staging yang
 * sama (ADR-081) dan flag MCP di server lokal bisa menulis kunci
 * `identity_jwks` yang dienkripsi dengan secret lokal, yang merusak staging
 * (temuan T-150.7, `/select-workspace` 500); selain itu tes ini menulis
 * (grant, status member) sehingga hanya boleh menyentuh target yang
 * dikenali. URL yang tidak terbaca di-skip dengan pesan jelas, bukan error
 * pemuatan modul.
 */
export function mcpSkipReason(
  baseURL: string | undefined = process.env.E2E_BASE_URL,
  stagingHost: string | undefined = process.env.E2E_STAGING_HOST,
): string | null {
  const onlyStaging =
    "Tes MCP hanya untuk staging (DB lokal = DB staging bersama, ADR-081; flag MCP di server lokal bisa merusak kunci identity_jwks staging, T-150.7).";
  if (!baseURL) {
    return `E2E_BASE_URL kosong (target local). ${onlyStaging}`;
  }
  let url: URL;
  try {
    url = new URL(baseURL);
  } catch {
    return `E2E_BASE_URL bukan URL yang valid. ${onlyStaging}`;
  }
  if (url.protocol !== "https:") {
    return `E2E_BASE_URL harus https: (dapat ${url.protocol}). ${onlyStaging}`;
  }
  const host = url.hostname.toLowerCase();
  const allowedHost = (
    stagingHost?.trim() || DEFAULT_STAGING_HOST
  ).toLowerCase();
  if (host === allowedHost) {
    return null;
  }
  return `Host ${host} bukan host staging yang diizinkan (${allowedHost}; ganti lewat E2E_STAGING_HOST). ${onlyStaging}`;
}

// ---------------------------------------------------------------------------
// Selektor layar harness (PUSAT, satu tempat)
// ---------------------------------------------------------------------------

/**
 * Selektor layar `/select-workspace` (langkah 1) dan `/consent` (langkah 2),
 * layar final T-151 (kartu desain ScreenOauthConsent). Semua selektor tes ada
 * di objek ini. Alurnya sendiri (pilih workspace lalu setujui scope) adalah
 * kontrak produk; teks judul memuat nama klien sehingga tidak dipakai sebagai
 * selektor, melainkan label bagian yang tetap.
 *
 * Klien uji mendaftar dengan redirect `http://127.0.0.1:...`, jadi layar
 * persetujuan memakai varian "host tidak lazim" dan tombol izinnya berlabel
 * "Saya paham, izinkan" (bukan "Izinkan"); selektor menerima keduanya.
 */
export const harnessScreens = {
  /** Scope MCP yang bisa dicentang di layar consent (id checkbox = nama scope). */
  scopes: ["mcp:read", "mcp:draft", "mcp:schedule"] as const,
  /** Daftar radio workspace (langkah 1). */
  workspaceHeading: (page: Page) =>
    page.getByRole("radiogroup", { name: "Workspace" }),
  workspaceOption: (page: Page, workspaceName: string) =>
    page.getByRole("radio", {
      name: new RegExp(workspaceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    }),
  workspaceContinue: (page: Page) =>
    page.getByRole("button", { name: "Lanjut", exact: true }),
  /** Label bagian daftar scope (langkah 2). */
  consentHeading: (page: Page) =>
    page.getByText("Izin yang diminta", { exact: true }),
  /** Checkbox scope; `id` = nama scope kabel (mis. `mcp:read`). */
  scopeCheckbox: (page: Page, scope: string) => page.locator(`[id="${scope}"]`),
  consentAllow: (page: Page) =>
    page.getByRole("button", { name: /^(Izinkan|Saya paham, izinkan)$/ }),
  /** Tombol yang menggantikan Izinkan setelah persetujuan gagal disimpan. */
  consentRetry: (page: Page) =>
    page.getByRole("button", { name: "Coba Lagi", exact: true }),
  /** Teks galat bila persetujuan gagal disimpan (untuk diagnosis). */
  alert: (page: Page) => page.getByRole("alert"),
};

// ---------------------------------------------------------------------------
// Tipe
// ---------------------------------------------------------------------------

export interface RegisteredClient {
  clientId: string;
  clientName: string;
  redirectUri: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string | undefined;
  scope: string;
  expiresIn: number;
}

export interface ConnectedClient extends RegisteredClient, TokenSet {}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface ConsentRow {
  id: string;
  clientId: string;
  referenceId?: string | null;
}

export interface ToolOutcome {
  /** `true` bila tool mengembalikan `isError` (penolakan atau galat). */
  isError: boolean;
  /** Isi JSON tool (data, atau `{ error: { code, message } }`). */
  payload: unknown;
  /** `error.code` bila `isError`. */
  errorCode: string | undefined;
}

async function readJson<T>(response: APIResponse): Promise<T> {
  return (await response.json()) as T;
}

/**
 * Samarkan token dan rahasia OAuth dari teks yang akan masuk pesan galat atau
 * log (header `Authorization`, `Cookie`, JWT, `refresh_token`, kode, dst.).
 */
export function scrub(text: string): string {
  return text
    .replace(/Bearer\s+[\w.~+/=-]+/gi, "Bearer [disamarkan]")
    .replace(
      /(authorization|cookie|set-cookie)(["']?\s*[:=]\s*)[^\n]*/gi,
      "$1$2[disamarkan]",
    )
    .replace(
      /"(refresh_token|access_token|id_token|code_verifier|client_secret)"\s*:\s*"[^"]*"/gi,
      '"$1":"[disamarkan]"',
    )
    .replace(
      /(refresh_token|access_token|code_verifier|client_secret|code)=[^&\s"]*/gi,
      "$1=[disamarkan]",
    )
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]*/g, "[jwt]");
}

/**
 * Jalankan satu panggilan HTTP; bila melempar, tulis ulang galatnya tanpa
 * call log Playwright (yang bisa memuat header `Authorization` atau body
 * `refresh_token`): hanya baris pertama, disamarkan, tanpa `cause`.
 */
async function guarded<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const first = (
      error instanceof Error ? error.message : String(error)
    ).split("\n")[0];
    throw new Error(
      `${label}: permintaan gagal (${scrub(first).slice(0, 200)})`,
    );
  }
}

// ---------------------------------------------------------------------------
// Pencatatan klien milik tes (untuk pembersihan)
// ---------------------------------------------------------------------------

const createdClientIds = new Set<string>();

// ---------------------------------------------------------------------------
// Pendaftaran klien dan PKCE
// ---------------------------------------------------------------------------

function base64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(48));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

/** Daftarkan klien publik baru (nama berawalan `e2e-`) lewat pendaftaran dinamis. */
export async function registerClient(
  api: APIRequestContext,
  label: string,
): Promise<RegisteredClient> {
  const clientName = e2eName(label);
  const send = () =>
    guarded("register klien", () =>
      api.post("/api/auth/oauth2/register", {
        data: {
          client_name: clientName,
          redirect_uris: [REDIRECT_URI],
          scope: ALL_REQUESTED_SCOPES,
          token_endpoint_auth_method: "none",
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
        },
      }),
    );
  let response = await send();
  if (response.status() === 429) {
    // Register dibatasi 5 permintaan/60 detik per IP (default plugin
    // oauth-provider); run beruntun menghabiskannya. Tunggu jendelanya lalu ulangi.
    const retryAfter = Number(response.headers()["x-retry-after"]) || 60;
    await sleep((Math.min(retryAfter, 65) + 1) * 1_000);
    response = await send();
  }
  // Staging membalas 200 (RFC 7591 menyebut 201); terima keduanya.
  expect(
    [200, 201],
    `register klien ${clientName}: ${response.status()} ${scrub(await response.text())}`,
  ).toContain(response.status());
  const body = await readJson<{ client_id?: string }>(response);
  expect(body.client_id, "client_id hasil register").toBeTruthy();
  const clientId = body.client_id as string;
  createdClientIds.add(clientId);
  return { clientId, clientName, redirectUri: REDIRECT_URI };
}

// ---------------------------------------------------------------------------
// Authorize di browser (pilih workspace, setujui scope)
// ---------------------------------------------------------------------------

export function resourceUrl(baseURL: string): string {
  return `${baseURL.replace(/\/+$/, "")}/api/mcp`;
}

/**
 * Buka `/oauth2/authorize` di konteks yang membawa sesi akun test, lewati
 * `/select-workspace` (bila muncul) dan `/consent`, lalu tangkap `code`.
 *
 * `/select-workspace` muncul hanya bila sesi belum punya pilihan workspace
 * yang berlaku di tabel `mcp_workspace_choices` (T-151, berlaku 10 menit),
 * jadi layar itu opsional di sini;
 * `/consent` muncul selama belum ada consent untuk klien baru ini.
 *
 * @param grantScopes scope MCP yang dicentang di layar consent
 *   (mis. `["mcp:draft"]` untuk mencabut `mcp:read`).
 */
export async function authorizeInBrowser(
  context: BrowserContext,
  baseURL: string,
  client: RegisteredClient,
  pkce: { challenge: string },
  grantScopes: readonly string[],
): Promise<string> {
  const page = await context.newPage();
  try {
    const state = base64Url(randomBytes(16));
    const redirect = new URL(client.redirectUri);

    let callbackUrl: URL | undefined;
    await page.route(`${redirect.origin}/**`, async (route) => {
      callbackUrl = new URL(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: "ok",
      });
    });

    const authorize = new URL("/api/auth/oauth2/authorize", baseURL);
    authorize.search = new URLSearchParams({
      response_type: "code",
      client_id: client.clientId,
      redirect_uri: client.redirectUri,
      scope: ALL_REQUESTED_SCOPES,
      state,
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
      resource: resourceUrl(baseURL),
    }).toString();
    await page.goto(authorize.toString());

    let pickedWorkspace = false;
    let consented = false;
    let consentRetries = 0;
    const deadline = Date.now() + 60_000;
    while (!callbackUrl) {
      if (Date.now() > deadline) {
        const visible = await page
          .locator("body")
          .innerText({ timeout: 2_000 })
          .catch(() => "(tidak terbaca)");
        throw new Error(
          scrub(
            `Authorize tidak sampai ke redirect_uri dalam 60 detik. URL: ${page.url()}. Teks layar: ${visible.slice(0, 300)}`,
          ),
        );
      }
      if (
        !pickedWorkspace &&
        (await harnessScreens.workspaceHeading(page).isVisible())
      ) {
        pickedWorkspace = true;
        await harnessScreens.workspaceOption(page, E2E_WORKSPACE_NAME).click();
        await harnessScreens.workspaceContinue(page).click();
      } else if (
        !consented &&
        (await harnessScreens.consentHeading(page).isVisible())
      ) {
        consented = true;
        for (const scope of harnessScreens.scopes) {
          const box = harnessScreens.scopeCheckbox(page, scope);
          if ((await box.count()) === 0) continue;
          const wanted = grantScopes.includes(scope);
          const checked = (await box.getAttribute("aria-checked")) === "true";
          if (wanted !== checked) await box.click();
        }
        await harnessScreens.consentAllow(page).click();
      } else if (
        consented &&
        (await harnessScreens.consentRetry(page).isVisible())
      ) {
        // Simpan gagal sesaat: tombol berubah jadi "Coba Lagi". Ulangi dua kali,
        // lalu gagal dengan alasan yang jelas (bukan menunggu timeout).
        if (consentRetries >= 2) {
          const reason = await harnessScreens
            .alert(page)
            .innerText({ timeout: 2_000 })
            .catch(() => "(tidak terbaca)");
          throw new Error(
            scrub(
              `Consent gagal disimpan setelah ${consentRetries} percobaan ulang: ${reason.slice(0, 300)}`,
            ),
          );
        }
        consentRetries += 1;
        await harnessScreens.consentRetry(page).click();
      }
      await page.waitForTimeout(250);
    }

    const code = callbackUrl.searchParams.get("code");
    expect(
      code,
      `redirect tanpa code: ${callbackUrl.search.replace(/code=[^&]*/, "code=...")}`,
    ).toBeTruthy();
    expect(callbackUrl.searchParams.get("state")).toBe(state);
    return code as string;
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

async function postToken(
  api: APIRequestContext,
  form: Record<string, string>,
  label: string,
): Promise<TokenSet> {
  const response = await guarded(label, () =>
    api.post("/api/auth/oauth2/token", { form }),
  );
  const body = await readJson<TokenResponse>(response);
  expect(
    response.status(),
    scrub(`${label}: ${body.error ?? ""} ${body.error_description ?? ""}`),
  ).toBe(200);
  expect(body.access_token, `${label}: access_token`).toBeTruthy();
  return {
    accessToken: body.access_token as string,
    refreshToken: body.refresh_token,
    scope: body.scope ?? "",
    expiresIn: body.expires_in ?? 0,
  };
}

/**
 * Tukar kode jadi token. `resource` wajib agar access token berupa JWT
 * beraudiens `<baseURL>/api/mcp` (`validAudiences` di `mcp-spike.ts`);
 * tanpa itu token opaque dan ditolak `/api/mcp`.
 */
export function exchangeCode(
  api: APIRequestContext,
  baseURL: string,
  client: RegisteredClient,
  code: string,
  verifier: string,
): Promise<TokenSet> {
  return postToken(
    api,
    {
      grant_type: "authorization_code",
      code,
      redirect_uri: client.redirectUri,
      client_id: client.clientId,
      code_verifier: verifier,
      resource: resourceUrl(baseURL),
    },
    "tukar kode",
  );
}

/** Refresh token; `resource` tetap dikirim supaya access token baru juga JWT. */
export function refreshAccessToken(
  api: APIRequestContext,
  baseURL: string,
  client: RegisteredClient,
  refreshToken: string,
): Promise<TokenSet> {
  return postToken(
    api,
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: client.clientId,
      resource: resourceUrl(baseURL),
    },
    "refresh token",
  );
}

/** Refresh yang diharapkan ditolak; mengembalikan status dan kode galat OAuth. */
export async function refreshExpectingFailure(
  api: APIRequestContext,
  baseURL: string,
  client: RegisteredClient,
  refreshToken: string,
): Promise<{ status: number; error: string | undefined }> {
  const response = await guarded("refresh token (diharapkan gagal)", () =>
    api.post("/api/auth/oauth2/token", {
      form: {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: client.clientId,
        resource: resourceUrl(baseURL),
      },
    }),
  );
  const body = await readJson<TokenResponse>(response).catch(
    () => ({}) as TokenResponse,
  );
  return { status: response.status(), error: body.error };
}

/** Daftar, authorize, lalu tukar kode: klien siap memanggil `/api/mcp`. */
export async function connectClient(
  context: BrowserContext,
  api: APIRequestContext,
  baseURL: string,
  label: string,
  grantScopes: readonly string[],
): Promise<ConnectedClient> {
  const client = await registerClient(api, label);
  const pkce = createPkce();
  const code = await authorizeInBrowser(
    context,
    baseURL,
    client,
    pkce,
    grantScopes,
  );
  const tokens = await exchangeCode(api, baseURL, client, code, pkce.verifier);
  return { ...client, ...tokens };
}

/** Klaim payload JWT (tanpa verifikasi; hanya untuk asersi tes). */
export function decodeJwtClaims(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("Bukan JWT (access token opaque?).");
  return JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Klien JSON-RPC ke /api/mcp
// ---------------------------------------------------------------------------

export interface RpcResponse {
  status: number;
  headers: Record<string, string>;
  /** Badan JSON-RPC (dari JSON atau event SSE terakhir); `undefined` bila bukan JSON. */
  body:
    | {
        result?: Record<string, unknown>;
        error?: { code: number; message: string };
      }
    | undefined;
  /** Teks badan, sudah DISAMARKAN (`scrub`); aman untuk pesan asersi. */
  text: string;
}

let rpcId = 0;

/**
 * Satu permintaan JSON-RPC ke `/api/mcp`. Server MCP stateless
 * (`sessionIdGenerator` kosong, `enableJsonResponse`): tidak butuh
 * `initialize` sebelum `tools/list` atau `tools/call`, dan balasan berupa
 * JSON biasa. Parser tetap menerima SSE bila server berubah.
 */
export async function mcpRequest(
  api: APIRequestContext,
  options: {
    token?: string;
    method: string;
    params?: Record<string, unknown>;
    headers?: Record<string, string>;
  },
): Promise<RpcResponse> {
  const response = await guarded(`POST /api/mcp ${options.method}`, () =>
    api.post("/api/mcp", {
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...options.headers,
      },
      data: {
        jsonrpc: "2.0",
        id: ++rpcId,
        method: options.method,
        params: options.params ?? {},
      },
    }),
  );
  const raw = await response.text();
  return {
    status: response.status(),
    headers: response.headers(),
    body: parseRpcBody(raw, response.headers()["content-type"] ?? ""),
    // Sudah disamarkan: aman dimasukkan ke pesan asersi.
    text: scrub(raw),
  };
}

function parseRpcBody(text: string, contentType: string): RpcResponse["body"] {
  try {
    if (contentType.includes("text/event-stream")) {
      const data = text
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .pop();
      return data ? (JSON.parse(data) as RpcResponse["body"]) : undefined;
    }
    return JSON.parse(text) as RpcResponse["body"];
  } catch {
    return undefined;
  }
}

/** Panggil satu tool dan urai hasilnya (isi JSON atau `{ error: { code } }`). */
export async function callTool(
  api: APIRequestContext,
  token: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolOutcome> {
  const response = await mcpRequest(api, {
    token,
    method: "tools/call",
    params: { name, arguments: args },
  });
  expect(
    response.status,
    `tools/call ${name}: ${response.text.slice(0, 300)}`,
  ).toBe(200);
  const result = response.body?.result;
  expect(result, `tools/call ${name}: tanpa result`).toBeTruthy();
  const content = (result?.content ?? []) as { type: string; text: string }[];
  // Teks non-JSON (mis. galat SDK "Unknown tool") tidak boleh menjadi
  // SyntaxError buram: simpan apa adanya (disamarkan) supaya pesan asersi
  // memperlihatkan jawaban server yang sebenarnya.
  let payload: unknown;
  if (content[0]) {
    try {
      payload = JSON.parse(content[0].text);
    } catch {
      payload = { rawText: scrub(content[0].text).slice(0, 300) };
    }
  }
  const isError = result?.isError === true;
  const errorCode = isError
    ? (payload as { error?: { code?: string } } | undefined)?.error?.code
    : undefined;
  return { isError, payload, errorCode };
}

// ---------------------------------------------------------------------------
// Consent dan pencabutan (konteks login)
// ---------------------------------------------------------------------------

function sameOriginHeaders(baseURL: string): Record<string, string> {
  return { origin: new URL(baseURL).origin };
}

/**
 * Consent milik akun test lewat endpoint plugin (`GET /oauth2/get-consents`,
 * butuh sesi), jadi id consent didapat tanpa menyentuh DB.
 */
export async function listConsents(
  sessionApi: APIRequestContext,
): Promise<ConsentRow[]> {
  const response = await guarded("get-consents", () =>
    sessionApi.get("/api/auth/oauth2/get-consents"),
  );
  expect(response.status(), "get-consents").toBe(200);
  return readJson<ConsentRow[]>(response);
}

/**
 * `POST /oauth2/delete-consent` dari konteks login. KEJANGGALAN YANG
 * DIKETAHUI (T-150.4, T-150.7): hook pencabutan menghapus consent lebih dulu
 * dalam satu transaksi, jadi endpoint plugin membalas 404 `no consent`
 * walau pencabutan berhasil. Status karena itu tidak diasertasi di sini;
 * pemanggil memverifikasi hasilnya lewat `listConsents` dan `/api/mcp`.
 */
export async function deleteConsent(
  sessionApi: APIRequestContext,
  baseURL: string,
  consentId: string,
): Promise<{ status: number; body: string }> {
  const response = await guarded("delete-consent", () =>
    sessionApi.post("/api/auth/oauth2/delete-consent", {
      headers: sameOriginHeaders(baseURL),
      data: { id: consentId },
    }),
  );
  return { status: response.status(), body: scrub(await response.text()) };
}

export async function findConsentFor(
  sessionApi: APIRequestContext,
  clientId: string,
): Promise<ConsentRow | undefined> {
  return (await listConsents(sessionApi)).find(
    (row) => row.clientId === clientId,
  );
}

/** Nama klien tidak berubah: satu GET per klien per proses cukup. */
const clientNames = new Map<string, string | undefined>();

async function clientNameOf(
  sessionApi: APIRequestContext,
  clientId: string,
): Promise<string | undefined> {
  if (clientNames.has(clientId)) return clientNames.get(clientId);
  const response = await guarded("public-client", () =>
    sessionApi.get(
      `/api/auth/oauth2/public-client?client_id=${encodeURIComponent(clientId)}`,
    ),
  );
  if (response.status() === 404) {
    clientNames.set(clientId, undefined);
    return undefined;
  }
  // Status lain (429, 5xx) TIDAK boleh dibaca sebagai "bukan klien e2e": sapuan
  // dan asersi "tanpa sisa" memakai predikat yang sama, jadi consent e2e-* sisa
  // akan lolos diam-diam. Gagal keras supaya terlihat.
  expect(response.status(), `public-client ${clientId}`).toBe(200);
  const body = await readJson<{ client_name?: string; name?: string }>(
    response,
  ).catch(() => undefined);
  const name = body?.client_name ?? body?.name;
  clientNames.set(clientId, name);
  return name;
}

/** Klien milik tes ini, atau klien lain yang namanya berawalan `E2E_PREFIX`. */
async function isE2eClient(
  sessionApi: APIRequestContext,
  clientId: string,
): Promise<boolean> {
  if (createdClientIds.has(clientId)) return true;
  const name = await clientNameOf(sessionApi, clientId);
  return name !== undefined && isE2eData(name);
}

/**
 * Cabut semua consent milik klien `e2e-*`: yang dibuat run ini, dan sisa run
 * yang terhenti (dikenali dari nama klien berawalan `E2E_PREFIX`; consent
 * klien lain tidak pernah disentuh). Mengembalikan berapa consent yang
 * ditarget dan berapa yang benar-benar hilang setelahnya (diverifikasi ulang
 * lewat `get-consents`, bukan menghitung percobaan).
 */
export async function cleanupE2eConsents(
  sessionApi: APIRequestContext,
  baseURL: string,
): Promise<{ targeted: number; revoked: number }> {
  const targeted = await listE2eConsents(sessionApi);
  for (const consent of targeted) {
    await deleteConsent(sessionApi, baseURL, consent.id);
  }
  const stillThere = new Set(
    (await listConsents(sessionApi)).map((consent) => consent.id),
  );
  return {
    targeted: targeted.length,
    revoked: targeted.filter((consent) => !stillThere.has(consent.id)).length,
  };
}

/** Consent `e2e-*` yang masih ada (untuk asersi bersih di akhir). */
export async function remainingE2eConsents(
  sessionApi: APIRequestContext,
): Promise<ConsentRow[]> {
  return listE2eConsents(sessionApi);
}

/** Consent milik klien `e2e-*`; pencarian nama klien berjalan paralel. */
async function listE2eConsents(
  sessionApi: APIRequestContext,
): Promise<ConsentRow[]> {
  const consents = await listConsents(sessionApi);
  const flags = await Promise.all(
    consents.map((consent) => isE2eClient(sessionApi, consent.clientId)),
  );
  return consents.filter((_, index) => flags[index]);
}
