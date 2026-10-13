import {
  asConnectedAccountId,
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

import { SyncCommentsUseCase } from "@/domains/engagement";
import { WorkspaceService } from "@/domains/workspace";
import { refreshInboxAction } from "./actions";

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
