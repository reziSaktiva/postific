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
// T-056/KI-065 — `getInboxItemDetailAction` sekarang juga merakit
// `MediaService` untuk resolve thumbnail post asli; di-stub sama seperti
// repository lain di atas (tidak diuji di file ini, fokus tetap
// `refreshInboxAction`).
vi.mock("@/lib/repositories/media", () => ({ mediaRepository: {} }));
vi.mock("@/lib/adapters/outstand", () => ({
  getOutstandAdapter: () => ({}),
}));

import { EngagementService, SyncCommentsUseCase } from "@/domains/engagement";
import { MediaService } from "@/domains/media";
import { WorkspaceService } from "@/domains/workspace";
import { listInboxByPostAction, refreshInboxAction } from "./actions";

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
    vi.spyOn(EngagementService.prototype, "listInboxByPost").mockResolvedValue([
      group("post-1", ["m1", "m2"]),
      group("post-2", []),
      group(null, []),
    ]);
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
    vi.spyOn(EngagementService.prototype, "listInboxByPost").mockResolvedValue([
      group("post-1", ["m1"]),
    ]);
    vi.spyOn(MediaService.prototype, "listByIds").mockRejectedValue(
      new Error("storage down"),
    );

    const result = await listInboxByPostAction();

    expect(result.error).toBeUndefined();
    expect(result.data?.[0].postSnapshot?.thumbnail).toBeNull();
    errorSpy.mockRestore();
  });
});
