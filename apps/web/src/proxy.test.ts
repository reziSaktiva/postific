import {
  MemberRole,
  MemberStatus,
  asMemberId,
  asUserId,
  asWorkspaceId,
} from "@postific/shared";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionCookieMock, getSessionMock } = vi.hoisted(() => ({
  getSessionCookieMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock("better-auth/cookies", () => ({
  getSessionCookie: getSessionCookieMock,
}));

vi.mock("@/lib/better-auth/auth", () => ({
  auth: { api: { getSession: getSessionMock } },
}));

// `@/lib/repositories/workspace` loads the Prisma client at module scope —
// stub it out so this test doesn't need a real DB connection.
// `WorkspaceService.prototype.getMembership` is spied on directly below.
vi.mock("@/lib/repositories/workspace", () => ({
  workspaceRepository: {},
}));

// CI runs with `SKIP_ENV_VALIDATION=1` (BETTER_AUTH_URL unset) — proxy.ts
// needs a real origin to build redirect URLs, same as production.
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ BETTER_AUTH_URL: "http://localhost:3000" }),
}));

import { WorkspaceService } from "@/domains/workspace";
import { proxy } from "./proxy";

const WORKSPACE_ID = asWorkspaceId("workspace-1");

function makeRequest(
  pathname: string,
  cookie?: string,
  extraHeaders?: Record<string, string>,
): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3000"), {
    headers: { ...(cookie ? { cookie } : {}), ...extraHeaders },
  });
}

describe("proxy (middleware)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getSessionCookieMock.mockReset();
    getSessionMock.mockReset();
  });

  it("redirects to /login when there is no session cookie on a protected route", async () => {
    getSessionCookieMock.mockReturnValue(null);

    const response = await proxy(makeRequest("/"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it("passes through /login, /register, /forgot-password, /reset-password when there is no session cookie (regression: infinite redirect loop, QA Najwa)", async () => {
    getSessionCookieMock.mockReturnValue(null);

    for (const pathname of [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
    ]) {
      const response = await proxy(makeRequest(pathname));
      expect(response.headers.get("location")).toBeNull();
    }
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it("redirects to / when a session cookie exists on a public auth page", async () => {
    getSessionCookieMock.mockReturnValue("some-cookie-value");

    const response = await proxy(makeRequest("/login"));

    expect(new URL(response.headers.get("location")!).pathname).toBe("/");
  });

  it("passes /onboarding through without validating session or workspace", async () => {
    getSessionCookieMock.mockReturnValue("some-cookie-value");

    const response = await proxy(makeRequest("/onboarding"));

    expect(response.headers.get("location")).toBeNull();
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it("strips a client-forged x-workspace-id/x-workspace-role on /onboarding instead of forwarding it", async () => {
    getSessionCookieMock.mockReturnValue("some-cookie-value");

    const response = await proxy(
      makeRequest("/onboarding", undefined, {
        "x-workspace-id": "forged-workspace",
        "x-workspace-role": MemberRole.Owner,
      }),
    );

    expect(response.headers.get("x-middleware-override-headers")).not.toMatch(
      /x-workspace-id/,
    );
    expect(
      response.headers.get("x-middleware-request-x-workspace-id"),
    ).toBeNull();
  });

  it("strips a client-forged x-workspace-id/x-workspace-role on a bypassed API route", async () => {
    const response = await proxy(
      makeRequest("/api/jobs/run", undefined, {
        "x-workspace-id": "forged-workspace",
        "x-workspace-role": MemberRole.Owner,
      }),
    );

    expect(response.headers.get("x-middleware-override-headers")).not.toMatch(
      /x-workspace-id/,
    );
    expect(
      response.headers.get("x-middleware-request-x-workspace-id"),
    ).toBeNull();
  });

  it("redirects to /login when the session cookie is stale (getSession returns null)", async () => {
    getSessionCookieMock.mockReturnValue("some-cookie-value");
    getSessionMock.mockResolvedValue(null);

    const response = await proxy(
      makeRequest("/", "active-workspace-id=workspace-1"),
    );

    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });

  it("redirects to /onboarding when the active-workspace-id cookie is missing", async () => {
    getSessionCookieMock.mockReturnValue("some-cookie-value");
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    const getMembershipSpy = vi.spyOn(
      WorkspaceService.prototype,
      "getMembership",
    );

    const response = await proxy(makeRequest("/"));

    expect(new URL(response.headers.get("location")!).pathname).toBe(
      "/onboarding",
    );
    expect(getMembershipSpy).not.toHaveBeenCalled();
  });

  it("redirects to /onboarding when there is no membership for the cookie's workspace", async () => {
    getSessionCookieMock.mockReturnValue("some-cookie-value");
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    vi.spyOn(WorkspaceService.prototype, "getMembership").mockResolvedValue(
      null,
    );

    const response = await proxy(
      makeRequest("/", "active-workspace-id=workspace-1"),
    );

    expect(new URL(response.headers.get("location")!).pathname).toBe(
      "/onboarding",
    );
  });

  it("redirects to /onboarding when the membership is not Active", async () => {
    getSessionCookieMock.mockReturnValue("some-cookie-value");
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    vi.spyOn(WorkspaceService.prototype, "getMembership").mockResolvedValue({
      id: asMemberId("member-1"),
      workspaceId: WORKSPACE_ID,
      userId: asUserId("user-1"),
      role: MemberRole.Owner,
      status: MemberStatus.Removed,
    });

    const response = await proxy(
      makeRequest("/", "active-workspace-id=workspace-1"),
    );

    expect(new URL(response.headers.get("location")!).pathname).toBe(
      "/onboarding",
    );
  });

  it("injects x-workspace-id/x-workspace-role headers when membership is active", async () => {
    getSessionCookieMock.mockReturnValue("some-cookie-value");
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    vi.spyOn(WorkspaceService.prototype, "getMembership").mockResolvedValue({
      id: asMemberId("member-1"),
      workspaceId: WORKSPACE_ID,
      userId: asUserId("user-1"),
      role: MemberRole.Owner,
      status: MemberStatus.Active,
    });

    const response = await proxy(
      makeRequest("/", "active-workspace-id=workspace-1"),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-workspace-id")).toBe(
      WORKSPACE_ID,
    );
    expect(response.headers.get("x-middleware-request-x-workspace-role")).toBe(
      MemberRole.Owner,
    );
  });

  it("bypasses auth entirely for /api/auth, /api/jobs, /api/health", async () => {
    for (const pathname of [
      "/api/auth/session",
      "/api/jobs/run",
      "/api/health",
    ]) {
      getSessionCookieMock.mockReturnValue(null);
      const response = await proxy(makeRequest(pathname));
      expect(response.headers.get("location")).toBeNull();
    }
    expect(getSessionMock).not.toHaveBeenCalled();
  });
});
