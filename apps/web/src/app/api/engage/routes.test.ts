import { asWorkspaceId } from "@postific/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ValidationError } from "@/lib/utils/errors";

const { getSessionMock, loadPostGroupsPage, loadCommentsPage } = vi.hoisted(
  () => ({
    getSessionMock: vi.fn(),
    loadPostGroupsPage: vi.fn(),
    loadCommentsPage: vi.fn(),
  }),
);

vi.mock("@/lib/better-auth/auth", () => ({
  auth: { api: { getSession: getSessionMock } },
}));
vi.mock("@/app/(app)/engage/engage-queries", () => ({
  loadPostGroupsPage,
  loadCommentsPage,
}));

import { GET as getComments } from "./comments/route";
import { GET as getPostGroups } from "./post-groups/route";

const WORKSPACE = asWorkspaceId("11111111-1111-4111-8111-111111111111");

function request(path: string, withWorkspace = true): Request {
  return new Request(`http://localhost${path}`, {
    headers: withWorkspace ? { "x-workspace-id": WORKSPACE } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
});

describe("GET /api/engage/post-groups (T-303)", () => {
  it("menjawab 401 JSON (bukan redirect) tanpa sesi atau tanpa workspace", async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const noSession = await getPostGroups(request("/api/engage/post-groups"));
    expect(noSession.status).toBe(401);
    expect(await noSession.json()).toHaveProperty("error");

    const noWorkspace = await getPostGroups(
      request("/api/engage/post-groups", false),
    );
    expect(noWorkspace.status).toBe(401);
    expect(loadPostGroupsPage).not.toHaveBeenCalled();
  });

  it("memetakan query string ke parameter service dan mengembalikan halaman", async () => {
    loadPostGroupsPage.mockResolvedValue({
      groups: [],
      nextCursor: "n1",
      counts: null,
    });

    const response = await getPostGroups(
      request(
        "/api/engage/post-groups?cursor=c1&account=a1&platform=instagram&status=unread&sort=newest&range=30d&includeEmpty=1&counts=1",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      groups: [],
      nextCursor: "n1",
      counts: null,
    });
    expect(loadPostGroupsPage).toHaveBeenCalledWith(
      {
        connectedAccountId: "a1",
        platform: "instagram",
        status: "unread",
        sort: "newest",
        dateRange: "30d",
        cursor: "c1",
        includeEmpty: true,
        postId: undefined,
        withCounts: true,
      },
      WORKSPACE,
      "user-1",
    );
  });

  it("menjawab 400 dengan pesan untuk cursor atau filter tidak valid", async () => {
    loadPostGroupsPage.mockRejectedValue(
      new ValidationError("Cursor tidak valid atau kedaluwarsa."),
    );
    const response = await getPostGroups(
      request("/api/engage/post-groups?cursor=rusak"),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Cursor tidak valid atau kedaluwarsa.",
    });
  });

  it("menjawab 500 tanpa membocorkan error tak terduga", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    loadPostGroupsPage.mockRejectedValue(
      new Error("connection string: secret"),
    );
    const response = await getPostGroups(request("/api/engage/post-groups"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});

describe("GET /api/engage/comments (T-303)", () => {
  it("postId=none berarti Tanpa posting; tanpa postId berarti semua komentar", async () => {
    loadCommentsPage.mockResolvedValue({
      items: [],
      nextCursor: null,
      counts: null,
      postCaptions: {},
    });

    await getComments(request("/api/engage/comments?postId=none"));
    expect(loadCommentsPage.mock.calls[0][0].postId).toBeNull();

    await getComments(request("/api/engage/comments?captions=1&counts=1"));
    const all = loadCommentsPage.mock.calls[1][0];
    expect(all).not.toHaveProperty("postId");
    expect(all).toMatchObject({ includePostCaptions: true, withCounts: true });

    await getComments(
      request(
        "/api/engage/comments?postId=22222222-2222-4222-8222-222222222222",
      ),
    );
    expect(loadCommentsPage.mock.calls[2][0].postId).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
  });

  it("menjawab 401 JSON tanpa sesi", async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const response = await getComments(request("/api/engage/comments"));
    expect(response.status).toBe(401);
  });
});
