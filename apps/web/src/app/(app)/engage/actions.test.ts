import {
  asConnectedAccountId,
  asMediaId,
  asPostId,
  asUserId,
  asWorkspaceId,
  MemberRole,
  SocialPlatform,
} from "@postific/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExternalServiceError } from "@/lib/utils/errors";

const { getSessionMock, redirectMock, revalidatePathMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/better-auth/auth", () => ({
  auth: { api: { getSession: getSessionMock } },
}));

// `getWorkspaceContext()` (ADR-076) membaca workspaceId/role dari header
// yang di-inject proxy.ts — disimulasikan lewat Headers, sama pola
// `settings/members/actions.test.ts`.
vi.mock("next/headers", () => ({
  headers: vi.fn(
    async () =>
      new Headers({
        "x-workspace-id": "workspace-1",
        "x-workspace-role": MemberRole.Owner,
      }),
  ),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

// Repository/adapter modules memuat Prisma client / env server di module
// scope — di-stub supaya test tidak butuh DB/env sungguhan. `WorkspaceService`
// dan `SyncCommentsUseCase` di-spy langsung di prototype-nya: test ini hanya
// memverifikasi wiring action→service (composition root), bukan logic
// domain/sync (sudah dicakup `workspace.service.test.ts` dan
// `sync-comments.use-case.test.ts`).
vi.mock("@/lib/repositories/workspace", () => ({ workspaceRepository: {} }));
vi.mock("@/lib/repositories/engagement", () => ({ engagementRepository: {} }));
vi.mock("@/lib/repositories/notification", () => ({
  notificationRepository: {},
}));
// Redesain KI-068/ADR-113 — `refreshInboxAction`/`replyToCommentAction` dkk
// sekarang juga merakit `publishingRepository` (dipassing sebagai
// `PublishingPostsPort`/`PublishingPostReferencePort` ke
// `SyncCommentsUseCase`/`EngagementService`) — di-stub sama seperti
// repository lain di atas supaya import module ini tidak menyentuh
// PrismaClient sungguhan (butuh `DATABASE_URL`).
vi.mock("@/lib/repositories/publishing", () => ({ publishingRepository: {} }));
// `listInboxByPostAction` merakit `MediaService` untuk thumbnail posting;
// repository media di-stub sama seperti repository lain di atas.
vi.mock("@/lib/repositories/media", () => ({ mediaRepository: {} }));
vi.mock("@/lib/adapters/outstand", () => ({
  getOutstandAdapter: () => ({}),
}));

import { EngagementService, SyncCommentsUseCase } from "@/domains/engagement";
import { MediaService } from "@/domains/media";
import { WorkspaceService } from "@/domains/workspace";
import {
  listInboxAction,
  listInboxByPostAction,
  refreshInboxAction,
} from "./actions";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const USER_ID = asUserId("user-1");
const ACCOUNT_ACTIVE = {
  id: asConnectedAccountId("account-1"),
  workspaceId: WORKSPACE_ID,
  platform: SocialPlatform.Instagram,
  outstandAccountId: "outstand-account-1",
  handle: "@acme",
  status: "active",
  reconnectRequired: false,
  connectedAt: new Date(),
  lastImportedUntil: null,
  lastImportRequestedAt: null,
};
const ACCOUNT_DISCONNECTED = {
  ...ACCOUNT_ACTIVE,
  id: asConnectedAccountId("account-2"),
  outstandAccountId: "outstand-account-2",
  status: "disconnected",
};

describe("refreshInboxAction", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getSessionMock.mockReset();
    redirectMock.mockClear();
    revalidatePathMock.mockClear();
  });

  it("redirects to /login and does not sync when unauthenticated", async () => {
    getSessionMock.mockResolvedValue(null);
    const syncSpy = vi.spyOn(SyncCommentsUseCase.prototype, "sync");

    await expect(refreshInboxAction()).rejects.toThrow("REDIRECT:/login");

    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(syncSpy).not.toHaveBeenCalled();
  });

  it("syncs only active connected accounts and accumulates newCommentsCount", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    vi.spyOn(
      WorkspaceService.prototype,
      "listConnectedAccounts",
    ).mockResolvedValue([ACCOUNT_ACTIVE, ACCOUNT_DISCONNECTED]);
    const syncSpy = vi
      .spyOn(SyncCommentsUseCase.prototype, "sync")
      .mockResolvedValue({ newCommentsCount: 3 });

    const result = await refreshInboxAction();

    expect(syncSpy).toHaveBeenCalledTimes(1);
    expect(syncSpy).toHaveBeenCalledWith(
      {
        workspaceId: WORKSPACE_ID,
        connectedAccountId: ACCOUNT_ACTIVE.id,
        accountUsername: ACCOUNT_ACTIVE.handle,
      },
      USER_ID,
    );
    expect(result).toEqual({ newCommentsCount: 3 });
    expect(revalidatePathMock).toHaveBeenCalledWith("/engage");
  });

  it("translates a domain error into { error } instead of throwing", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    vi.spyOn(
      WorkspaceService.prototype,
      "listConnectedAccounts",
    ).mockResolvedValue([ACCOUNT_ACTIVE]);
    vi.spyOn(SyncCommentsUseCase.prototype, "sync").mockRejectedValue(
      new ExternalServiceError("Outstand API tidak merespons."),
    );

    const result = await refreshInboxAction();

    expect(result).toEqual({ error: "Outstand API tidak merespons." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("listInboxByPostAction (T-218)", () => {
  const group = (postId: string | null, mediaIds: string[]) => ({
    postId: postId ? asPostId(postId) : null,
    connectedAccountId: ACCOUNT_ACTIVE.id,
    platform: SocialPlatform.Instagram,
    connectedAccountIds: [ACCOUNT_ACTIVE.id],
    totalCount: 2,
    unrepliedCount: 1,
    handledCount: 1,
    latestReceivedAt: new Date("2026-10-01T00:00:00Z"),
    statuses: ["unread" as const],
    postSnapshot: postId
      ? {
          caption: "Caption",
          mediaIds: mediaIds.map((id) => asMediaId(id)),
          platformPostUrl: null,
        }
      : null,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({ user: { id: USER_ID } });
  });

  it("mengganti mediaIds dengan thumbnail ber-URL segar lewat satu pencarian media", async () => {
    vi.spyOn(EngagementService.prototype, "listInboxByPost").mockResolvedValue({
      groups: [
        group("post-1", ["m1", "m2"]),
        group("post-2", []),
        group(null, []),
      ],
      truncated: false,
    });
    const listByIds = vi
      .spyOn(MediaService.prototype, "listByIds")
      .mockResolvedValue([
        {
          id: asMediaId("m1"),
          url: "https://signed.example/m1",
          type: "image",
        },
      ] as never);

    const result = await listInboxByPostAction({ sort: "newest" });
    expect(result.truncated).toBe(false);

    expect(listByIds).toHaveBeenCalledTimes(1);
    expect(listByIds.mock.calls[0][0].mediaIds).toEqual(["m1"]);
    expect(result.data?.[0].postSnapshot).toEqual({
      caption: "Caption",
      platformPostUrl: null,
      thumbnail: { url: "https://signed.example/m1", type: "image" },
    });
    expect(result.data?.[1].postSnapshot?.thumbnail).toBeNull();
    expect(result.data?.[2].postSnapshot).toBeNull();
    expect(result.data?.[0]).not.toHaveProperty("postSnapshot.mediaIds");
  });

  it("tetap mengembalikan daftar tanpa thumbnail bila resolve media gagal", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(EngagementService.prototype, "listInboxByPost").mockResolvedValue({
      groups: [group("post-1", ["m1"])],
      truncated: false,
    });
    vi.spyOn(MediaService.prototype, "listByIds").mockRejectedValue(
      new Error("storage down"),
    );

    const result = await listInboxByPostAction();

    expect(result.error).toBeUndefined();
    expect(result.data?.[0].postSnapshot?.thumbnail).toBeNull();
    errorSpy.mockRestore();
  });
});

describe("listInboxAction filter per posting (T-219)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({ user: { id: USER_ID } });
  });

  it("memetakan postId, null (Tanpa posting), dan dateRange ke filter service", async () => {
    const listInbox = vi
      .spyOn(EngagementService.prototype, "listInbox")
      .mockResolvedValue([]);

    await listInboxAction({ postId: "post-1", dateRange: "30d" });
    const withPost = listInbox.mock.calls[0][0];
    expect(withPost.postId).toBe("post-1");
    const since = withPost.receivedSince as Date;
    const days = (Date.now() - since.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);

    await listInboxAction({ postId: null });
    expect(listInbox.mock.calls[1][0].postId).toBeNull();

    await listInboxAction({});
    expect(listInbox.mock.calls[2][0]).not.toHaveProperty("postId");
    expect(listInbox.mock.calls[2][0]).not.toHaveProperty("receivedSince");
  });

  it("menolak rentang tanggal tak dikenal tanpa memanggil service", async () => {
    const listInbox = vi.spyOn(EngagementService.prototype, "listInbox");
    const result = await listInboxAction({ dateRange: "1y" as never });
    expect(result.error).toBeTruthy();
    expect(listInbox).not.toHaveBeenCalled();
  });
});
