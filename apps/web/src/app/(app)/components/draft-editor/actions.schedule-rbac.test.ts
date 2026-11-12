import {
  asPostId,
  asUserId,
  asWorkspaceId,
  MemberRole,
} from "@postific/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * T-251 (T-205.4, ADR-074): Schedule dan Publish Now menegakkan peran di server
 * sebelum side effect apa pun. Peran yang sah lolos; nilai peran yang tidak
 * dikenal (header diubah, peran baru belum diputuskan) ditolak dengan notice galat.
 */
const WORKSPACE_ID = asWorkspaceId("workspace-1");
const { getSessionMock, roleRef } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  roleRef: { current: "owner" as string },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("@/lib/better-auth/session", () => ({
  getCachedSession: getSessionMock,
}));
vi.mock("@/lib/workspace/workspace-context", () => ({
  getWorkspaceContext: vi.fn(async () => ({
    workspaceId: WORKSPACE_ID,
    role: roleRef.current,
  })),
}));
vi.mock("@/lib/repositories/publishing", () => ({ publishingRepository: {} }));
vi.mock("@/lib/repositories/media", () => ({ mediaRepository: {} }));
vi.mock("@/lib/repositories/workspace", () => ({ workspaceRepository: {} }));
vi.mock("@/lib/adapters/outstand", () => ({
  getOutstandAdapter: vi.fn(() => ({})),
}));
vi.mock("@/lib/adapters/media-storage/supabase-media-storage-adapter", () => ({
  supabaseMediaStorageAdapter: {},
}));
vi.mock("@/lib/jobs/job-scheduler", () => ({
  backgroundJobScheduler: { scheduleJob: vi.fn(async () => undefined) },
}));

import { PublishingService, SchedulePostsUseCase } from "@/domains/publishing";
import { WorkspaceService } from "@/domains/workspace";
import { publishNowAction, scheduleDraftAction } from "./actions";

const scheduleInput = () => ({
  caption: "hello",
  scheduledAt: new Date().toISOString(),
  targets: [],
});

describe("RBAC server untuk Schedule dan Publish Now (T-251)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({ user: { id: asUserId("user-1") } });
  });

  it.each([MemberRole.Owner, MemberRole.Admin, MemberRole.Creator])(
    "Schedule: peran %s lolos pemeriksaan peran",
    async (role) => {
      roleRef.current = role;
      vi.spyOn(
        WorkspaceService.prototype,
        "listConnectedAccounts",
      ).mockResolvedValue([] as never);
      vi.spyOn(PublishingService.prototype, "saveDraft").mockResolvedValue({
        id: asPostId("p1"),
      } as never);
      vi.spyOn(SchedulePostsUseCase.prototype, "execute").mockResolvedValue({
        id: asPostId("p1"),
      } as never);

      const result = await scheduleDraftAction(scheduleInput());

      // Lolos RBAC: tidak ada notice izin. (Target kosong boleh gagal validasi lain.)
      if ("error" in result) {
        expect(result.error).not.toMatch(/izin/i);
      }
    },
  );

  it("Schedule: peran tidak dikenal ditolak sebelum side effect apa pun", async () => {
    roleRef.current = "guest";
    const accounts = vi.spyOn(
      WorkspaceService.prototype,
      "listConnectedAccounts",
    );
    const saveDraft = vi.spyOn(PublishingService.prototype, "saveDraft");
    const execute = vi.spyOn(SchedulePostsUseCase.prototype, "execute");

    const result = await scheduleDraftAction(scheduleInput());

    expect(result).toEqual({
      error: expect.stringContaining("tidak memiliki izin"),
    });
    expect(accounts).not.toHaveBeenCalled();
    expect(saveDraft).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("Publish Now: peran tidak dikenal ditolak dengan notice galat", async () => {
    roleRef.current = "guest";
    const saveDraft = vi.spyOn(PublishingService.prototype, "saveDraft");

    const result = await publishNowAction({ caption: "hello", targets: [] });

    expect(result).toEqual({
      error: expect.stringContaining("tidak memiliki izin"),
    });
    expect(saveDraft).not.toHaveBeenCalled();
  });
});
