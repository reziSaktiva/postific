import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AlreadyConnectedError, ConflictError } from "@/lib/utils/errors";
import { getCachedSession } from "@/lib/better-auth/session";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { createWorkspaceServiceWithOutstandAdapter } from "@/lib/workspace/outstand-workspace-service";

import { outstandConnectNonceCookieName } from "@/lib/workspace/outstand-connect-nonce-cookie";

// CI runs with `SKIP_ENV_VALIDATION=1` (BETTER_AUTH_URL unset) — route.ts
// needs a real origin to build redirect URLs (pola sama `proxy.test.ts`).
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ BETTER_AUTH_URL: "http://localhost:3000" }),
  secureCookiesEnabled: () => false,
}));

// Tidak dipanggil di jalur Facebook (branch `session` return SEBELUM
// `getWorkspaceContext()`/`getCachedSession()` dieksekusi) — di-mock murni
// supaya import module ini tidak butuh DB/Better Auth sungguhan.
vi.mock("@/lib/better-auth/session", () => ({
  getCachedSession: vi.fn(),
}));
vi.mock("@/lib/workspace/workspace-context", () => ({
  getWorkspaceContext: vi.fn(),
}));
vi.mock("@/lib/workspace/outstand-workspace-service", () => ({
  createWorkspaceServiceWithOutstandAdapter: vi.fn(),
}));

const { GET, POST } = await import("./route");

function encodeState(payload: {
  nonce: string;
  redirectAccountId?: string;
  workspaceId?: string;
  platform?: string;
}): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function makeRequest(
  method: "GET" | "POST",
  searchParams: Record<string, string>,
  cookie?: string,
): NextRequest {
  const url = new URL(
    "/api/integrations/outstand/callback",
    "http://localhost:3000",
  );
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url, {
    method,
    headers: cookie ? { cookie } : undefined,
  });
}

/**
 * Regresi Bug #1 (405 Method Not Allowed, investigasi King Rezi + Elon
 * Backend Engineer, 2026-09-24, T-025.4/KI-070) — direproduksi konsisten
 * di browser real: klik natural "Connect Account → Facebook" memicu Next.js
 * App Router mengirim POST (bukan GET) ke Route Handler ini saat mengikuti
 * redirect dari Server Action `initiateConnectAccountAction` (idiosinkrasi
 * client-side navigation Next.js untuk redirect ke Route Handler yang bukan
 * page — lihat docstring `POST` di `route.ts`). Fix: alias `POST = GET`,
 * karena `GET` sepenuhnya idempoten (baca query+cookie, redirect) — test di
 * bawah membuktikan alias ini nyata (bukan re-implementasi terpisah yang
 * bisa diam-diam divergen) DAN membuktikan behavior POST identik dengan GET
 * untuk skenario yang benar-benar memicu bug di browser (Facebook
 * session-token loopback) plus 2 skenario lain di route ini.
 */
describe("POST /api/integrations/outstand/callback (alias GET, Bug #1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is the exact same function reference as GET (bukan re-implementasi terpisah)", async () => {
    expect(POST).toBe(GET);
  });

  it("POST dengan session token + state + nonce cookie valid (skenario Facebook, persis kondisi 405 di browser) redirect ke dialog Page-picker — identik dengan GET", async () => {
    const nonce = "nonce-1";
    const state = encodeState({ nonce });
    const cookieName = outstandConnectNonceCookieName(nonce);

    const getRequest = makeRequest(
      "GET",
      { session: "fake-fb-session-123", state },
      `${cookieName}=1`,
    );
    const postRequest = makeRequest(
      "POST",
      { session: "fake-fb-session-123", state },
      `${cookieName}=1`,
    );

    const getResponse = await GET(getRequest);
    const postResponse = await POST(postRequest);

    expect(getResponse.status).toBe(307);
    expect(postResponse.status).toBe(getResponse.status);

    const getLocation = new URL(getResponse.headers.get("location")!);
    const postLocation = new URL(postResponse.headers.get("location")!);
    expect(postLocation.pathname).toBe(getLocation.pathname);
    // Session token TIDAK di query (httpOnly cookie) — hanya flag + state.
    expect(postLocation.searchParams.get("connectFacebook")).toBe("1");
    expect(postLocation.searchParams.get("connectFacebookState")).toBe(state);
    expect(
      postLocation.searchParams.get("connectFacebookSessionToken"),
    ).toBeNull();
    // Session cookie diset di response (nonce cookie TIDAK dihapus — flow
    // belum selesai). Cek lewat header `Set-Cookie`.
    const setCookie = postResponse.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`outstandFacebookSession_${nonce}=`);
    expect(setCookie).toContain("fake-fb-session-123");
    expect(setCookie).toContain(`outstand-connect-nonce-${nonce}=1`);
    expect(setCookie.toLowerCase()).toContain("max-age=1800");
  });

  it("POST dengan session token tapi TANPA nonce cookie (CSRF invalid) redirect ke ?connect=error — identik dengan GET", async () => {
    const nonce = "nonce-2";
    const state = encodeState({ nonce });

    const getRequest = makeRequest("GET", {
      session: "fake-fb-session-456",
      state,
    });
    const postRequest = makeRequest("POST", {
      session: "fake-fb-session-456",
      state,
    });

    const getResponse = await GET(getRequest);
    const postResponse = await POST(postRequest);

    const getLocation = new URL(getResponse.headers.get("location")!);
    const postLocation = new URL(postResponse.headers.get("location")!);
    expect(postLocation.search).toBe(getLocation.search);
    expect(postLocation.searchParams.get("connect")).toBe("error");
  });

  it("POST tanpa query param apa pun (pola prefetch/revalidate Next.js) no-op redirect — identik dengan GET", async () => {
    const getRequest = makeRequest("GET", {});
    const postRequest = makeRequest("POST", {});

    const getResponse = await GET(getRequest);
    const postResponse = await POST(postRequest);

    const getLocation = new URL(getResponse.headers.get("location")!);
    const postLocation = new URL(postResponse.headers.get("location")!);
    expect(postLocation.pathname).toBe(getLocation.pathname);
    expect(postLocation.search).toBe("");
    expect(getLocation.search).toBe("");
  });

  it("akun yang sudah terhubung dari flow terpisah (AlreadyConnectedError, KI-079) redirect ?connect=already-connected — BUKAN success diam-diam", async () => {
    vi.mocked(getCachedSession).mockResolvedValue({
      user: { id: "user-1" },
    } as never);
    vi.mocked(getWorkspaceContext).mockResolvedValue({
      workspaceId: "workspace-1",
    } as never);
    vi.mocked(createWorkspaceServiceWithOutstandAdapter).mockReturnValue({
      completeAccountConnection: vi
        .fn()
        .mockRejectedValue(
          new AlreadyConnectedError(
            "Akun ini sudah terhubung di workspace ini.",
          ),
        ),
    } as never);

    const nonce = "nonce-dup";
    const state = encodeState({ nonce });
    const request = makeRequest(
      "GET",
      { account_id: "acc-1", username: "ada", state },
      `${outstandConnectNonceCookieName(nonce)}=1`,
    );

    const response = await GET(request);
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("connect")).toBe("already-connected");
  });

  it("ConflictError generik lain (BUKAN AlreadyConnectedError) redirect ?connect=error, bukan lagi diserap sebagai success (KI-079 memindah disambiguasi double-submit ke WorkspaceService, route.ts tidak lagi menangani ConflictError generik secara khusus)", async () => {
    vi.mocked(getCachedSession).mockResolvedValue({
      user: { id: "user-1" },
    } as never);
    vi.mocked(getWorkspaceContext).mockResolvedValue({
      workspaceId: "workspace-1",
    } as never);
    vi.mocked(createWorkspaceServiceWithOutstandAdapter).mockReturnValue({
      completeAccountConnection: vi
        .fn()
        .mockRejectedValue(
          new ConflictError(
            "Conflict lain yang tidak terkait double-submit connect.",
          ),
        ),
    } as never);

    const nonce = "nonce-other-conflict";
    const state = encodeState({ nonce });
    const request = makeRequest(
      "GET",
      { account_id: "acc-1", username: "ada", state },
      `${outstandConnectNonceCookieName(nonce)}=1`,
    );

    const response = await GET(request);
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("connect")).toBe("error");
  });
});
