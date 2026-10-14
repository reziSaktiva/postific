import {
  asPostId,
  asUserId,
  asWorkspaceId,
  ContentStatus,
  MemberRole,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError } from "@/lib/utils/errors";
import type { IOutstandAdapter } from "../adapters/outstand-adapter";
import type {
  IPublishingRepository,
  PublishingCancelScheduleRecord,
  PublishingPostRecord,
} from "../repositories/publishing.repository";
import { CancelScheduleUseCase } from "./cancel-schedule.use-case";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const AUTHOR_ID = asUserId("user-1");
const POST_ID = asPostId("post-1");

function createFakeRepository(
  overrides: Partial<IPublishingRepository> = {},
): IPublishingRepository {
  return {
    createDraft: async ({
      workspaceId,
      authorId,
      caption,
    }): Promise<PublishingPostRecord> => ({
      id: POST_ID,
      workspaceId,
      authorId,
      caption,
      status: ContentStatus.Draft,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }),
    listDrafts: async () => [],
    findDraftById: async () => null,
    updateDraftCaption: async () => null,
    schedulePost: async () => null,
    publishNow: async () => null,
    updateTargetOutcome: async () => undefined,
    setOutstandPostId: async () => undefined,
    countScheduledByAccount: async () => new Map(),
    listQueue: async () => [],
    listCalendarPosts: async () => [],
    getCalendarPostById: async () => null,
    listHistory: async () => [],
    getHistoryById: async () => null,
    getHistoryPostById: async () => null,
    cancelSchedule: async () => null,
    markPostFailed: async () => undefined,
    markPostPublished: async () => undefined,
    getRetryTarget: async () => null,
    resetTargetForRetry: async () => undefined,
    setRetryOutstandPostId: async () => undefined,
    reconcilePostStatusAfterRetry: async () => undefined,
    findPostTargetsByOutstandPostId: async () => null,
    softDeletePost: async () => null,
    listSyncablePostsByConnectedAccount: async () => [],
    findPostOutstandId: async () => null,
    findPostSnapshotForEngagement: async () => null,
    upsertImportedPosts: async () => ({
      insertedCount: 0,
      skippedDuplicateCount: 0,
    }),
    ...overrides,
  };
}

function createFakeOutstandAdapter(
  overrides: Partial<IOutstandAdapter> = {},
): IOutstandAdapter {
  return {
    connectAccount: async () => ({ redirectUrl: "/unused" }),
    listPendingFacebookPages: async () => ({ pages: [] }),
    confirmFacebookPagesConnection: async () => ({ accounts: [] }),
    listPinterestBoards: async () => [],
    uploadMediaWorkingCopy: async () => ({
      outstandMediaId: "unused",
      outstandMediaUrl: "https://fake.outstand.local/media/unused",
      expiresAt: new Date(),
    }),
    resolveConnectCallback: async () => ({
      outstandAccountId: "unused",
      platform: "instagram" as never,
      handle: "unused",
      status: "active",
    }),
    schedulePost: async () => ({ outstandPostId: "fake-post" }),
    publishNow: async () => ({ outstandPostId: "fake-post" }),
    fetchPostOutcome: async () => [],
    cancelScheduledPost: async () => undefined,
    deletePost: async () => undefined,
    fetchPostMetrics: async () => ({
      impressions: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: null,
      engagementRate: 0,
    }),
    fetchWorkspaceMetrics: async () => ({
      totalPosts: 0,
      totalReach: 0,
      totalEngagements: 0,
      avgEngagementRate: 0,
    }),
    fetchComments: async () => ({ comments: [], nextCursor: null }),
    replyToComment: async () => ({ outstandReplyId: "fake-reply" }),
    importPosts: async () => ({ importJobId: "fake-import-job" }),
    fetchImportJobStatus: async () => ({
      status: "completed" as const,
      posts: [],
      error: null,
    }),
    ...overrides,
  };
}

function baseCancelRecord(
  outstandPostId: string | null,
): PublishingCancelScheduleRecord {
  return {
    id: POST_ID,
    workspaceId: WORKSPACE_ID,
    authorId: AUTHOR_ID,
    caption: "Hello world",
    status: ContentStatus.Draft,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    outstandPostId,
  };
}

describe("CancelScheduleUseCase.execute", () => {
  it("happy path: post kembali ke Draft, memanggil adapter.cancelScheduledPost SEKALI dengan outstandPostId post-level (redesain 2026-08-26)", async () => {
    const cancelledPostIds: string[] = [];
    const repository = createFakeRepository({
      cancelSchedule: async () => baseCancelRecord("fake-post-shared"),
    });
    const adapter = createFakeOutstandAdapter({
      cancelScheduledPost: async (outstandPostId) => {
        cancelledPostIds.push(outstandPostId);
      },
    });

    const useCase = new CancelScheduleUseCase(repository, adapter);

    const result = await useCase.execute({
      workspaceId: WORKSPACE_ID,
      postId: POST_ID,
      actorRole: MemberRole.Creator,
      actingUserId: AUTHOR_ID,
    });

    expect(result.status).toBe(ContentStatus.Draft);
    expect(cancelledPostIds).toEqual(["fake-post-shared"]);
  });

  it("skips adapter call ketika outstandPostId null (belum pernah dijadwalkan sampai adapter)", async () => {
    let adapterCallCount = 0;
    const repository = createFakeRepository({
      cancelSchedule: async () => baseCancelRecord(null),
    });
    const adapter = createFakeOutstandAdapter({
      cancelScheduledPost: async () => {
        adapterCallCount += 1;
      },
    });

    const useCase = new CancelScheduleUseCase(repository, adapter);

    await useCase.execute({
      workspaceId: WORKSPACE_ID,
      postId: POST_ID,
      actorRole: MemberRole.Creator,
      actingUserId: AUTHOR_ID,
    });

    expect(adapterCallCount).toBe(0);
  });

  it("tetap mengembalikan record sukses walau adapter.cancelScheduledPost gagal (best-effort)", async () => {
    const repository = createFakeRepository({
      cancelSchedule: async () => baseCancelRecord("fake-post-shared"),
    });
    const adapter = createFakeOutstandAdapter({
      cancelScheduledPost: async () => {
        throw new Error("Outstand sedang down");
      },
    });

    const useCase = new CancelScheduleUseCase(repository, adapter);

    await expect(
      useCase.execute({
        workspaceId: WORKSPACE_ID,
        postId: POST_ID,
        actorRole: MemberRole.Creator,
        actingUserId: AUTHOR_ID,
      }),
    ).resolves.toMatchObject({ status: ContentStatus.Draft });
  });

  it.each([MemberRole.Owner, MemberRole.Admin, MemberRole.Creator])(
    "allows role %s (ADR-074 — Scheduled → Draft diizinkan untuk ketiga role)",
    async (role) => {
      const repository = createFakeRepository({
        cancelSchedule: async () => baseCancelRecord(null),
      });
      const adapter = createFakeOutstandAdapter();
      const useCase = new CancelScheduleUseCase(repository, adapter);

      await expect(
        useCase.execute({
          workspaceId: WORKSPACE_ID,
          postId: POST_ID,
          actorRole: role,
          actingUserId: AUTHOR_ID,
        }),
      ).resolves.toBeDefined();
    },
  );

  it("rejects an invalid actorRole before touching repository or adapter", async () => {
    let repositoryCalled = false;
    let adapterCalled = false;
    const repository = createFakeRepository({
      cancelSchedule: async () => {
        repositoryCalled = true;
        return null;
      },
    });
    const adapter = createFakeOutstandAdapter({
      cancelScheduledPost: async () => {
        adapterCalled = true;
      },
    });
    const useCase = new CancelScheduleUseCase(repository, adapter);

    await expect(
      useCase.execute({
        workspaceId: WORKSPACE_ID,
        postId: POST_ID,
        // Nilai di luar 3 role sah — mensimulasikan header ter-tamper /
        // corrupt yang tidak tervalidasi runtime di `getWorkspaceContext()`.
        actorRole: "superadmin" as MemberRole,
        actingUserId: AUTHOR_ID,
      }),
    ).rejects.toThrow(AuthorizationError);

    expect(repositoryCalled).toBe(false);
    expect(adapterCalled).toBe(false);
  });

  it("throws ConflictError when the repository guard rejects (post tidak ditemukan / bukan status Scheduled)", async () => {
    const repository = createFakeRepository({
      cancelSchedule: async () => null,
    });
    const adapter = createFakeOutstandAdapter();
    const useCase = new CancelScheduleUseCase(repository, adapter);

    await expect(
      useCase.execute({
        workspaceId: WORKSPACE_ID,
        postId: POST_ID,
        actorRole: MemberRole.Creator,
        actingUserId: AUTHOR_ID,
      }),
    ).rejects.toThrow(ConflictError);
  });
});
