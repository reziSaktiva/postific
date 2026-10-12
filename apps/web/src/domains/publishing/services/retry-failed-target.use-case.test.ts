import {
  asConnectedAccountId,
  asPostId,
  asPostTargetId,
  asUserId,
  asWorkspaceId,
  ContentFormat,
  ContentStatus,
  MemberRole,
  SocialPlatform,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
} from "@/lib/utils/errors";
import type {
  IOutstandAdapter,
  PostTargetOutcome,
} from "../adapters/outstand-adapter";
import type {
  IPublishingRepository,
  PublishingPostRecord,
  RetryTargetRecord,
} from "../repositories/publishing.repository";
import { RetryFailedTargetUseCase } from "./retry-failed-target.use-case";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const AUTHOR_ID = asUserId("user-1");
const POST_ID = asPostId("post-1");
const TARGET_ID = asPostTargetId("target-1");
const CONNECTED_ACCOUNT_ID = asConnectedAccountId("conn-1");

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
      status: ContentStatus.Failed,
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
    publishNow: async () => ({ outstandPostId: "fake-post-retry" }),
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

function baseRetryTarget(
  overrides: Partial<RetryTargetRecord> = {},
): RetryTargetRecord {
  return {
    postId: POST_ID,
    workspaceId: WORKSPACE_ID,
    postOutstandPostId: "fake-post-original",
    caption: "Hello world",
    mediaIds: [],
    targetId: TARGET_ID,
    targetStatus: "failed",
    connectedAccountId: CONNECTED_ACCOUNT_ID,
    outstandAccountId: "outstand-acc-1",
    platform: SocialPlatform.Instagram,
    contentFormat: ContentFormat.Post,
    platformOptions: null,
    hasSiblingLiveTargets: false,
    ...overrides,
  };
}

function publishedOutcome(outstandAccountId: string): PostTargetOutcome {
  return {
    outstandAccountId,
    status: "published",
    error: null,
    platformPostId: `platform-${outstandAccountId}`,
    platformPostUrl: `https://fake.outstand.local/posts/${outstandAccountId}`,
    publishedAt: new Date(0),
  };
}

function failedOutcome(
  outstandAccountId: string,
  error: string,
): PostTargetOutcome {
  return {
    outstandAccountId,
    status: "failed",
    error,
    platformPostId: null,
    platformPostUrl: null,
    publishedAt: null,
  };
}

describe("RetryFailedTargetUseCase.execute", () => {
  it("golden path: deletes best-effort, recreates via publishNow, resolves outcome, and reconciles post from Failed to Published", async () => {
    const retryTarget = baseRetryTarget();
    const deletePostCalls: { outstandPostId: string; accountIds?: string[] }[] =
      [];
    let resetCalls = 0;
    const setRetryOutstandPostIdCalls: {
      targetId: string;
      retryOutstandPostId: string;
    }[] = [];
    const updateOutcomeCalls: Parameters<
      IPublishingRepository["updateTargetOutcome"]
    >[0][] = [];
    const reconcileCalls: { workspaceId: string; postId: string }[] = [];

    const repository = createFakeRepository({
      getRetryTarget: async () => retryTarget,
      resetTargetForRetry: async () => {
        resetCalls += 1;
      },
      setRetryOutstandPostId: async (input) => {
        setRetryOutstandPostIdCalls.push(input);
      },
      updateTargetOutcome: async (input) => {
        updateOutcomeCalls.push(input);
      },
      reconcilePostStatusAfterRetry: async (input) => {
        reconcileCalls.push(input);
      },
    });

    const adapter = createFakeOutstandAdapter({
      deletePost: async (outstandPostId, accountIds) => {
        deletePostCalls.push({ outstandPostId, accountIds });
      },
      publishNow: async ({ targets, caption }) => {
        expect(targets).toHaveLength(1);
        expect(targets[0].outstandAccountId).toBe("outstand-acc-1");
        expect(caption).toBe("Hello world");
        return { outstandPostId: "fake-post-retry" };
      },
      fetchPostOutcome: async (outstandPostId, expectedOutstandAccountIds) => {
        expect(outstandPostId).toBe("fake-post-retry");
        // T-027 bug fix (root-cause) — akun yang di-retry, BUKAN dari
        // memori adapter.
        expect(expectedOutstandAccountIds).toEqual(["outstand-acc-1"]);
        return [publishedOutcome("outstand-acc-1")];
      },
    });

    const useCase = new RetryFailedTargetUseCase(repository, adapter);

    const result = await useCase.execute({
      workspaceId: WORKSPACE_ID,
      postId: POST_ID,
      targetId: TARGET_ID,
      actorRole: MemberRole.Creator,
      actingUserId: AUTHOR_ID,
    });

    // Sole target (hasSiblingLiveTargets=false) → full delete tanpa accountIds.
    expect(deletePostCalls).toEqual([
      { outstandPostId: "fake-post-original", accountIds: undefined },
    ]);
    expect(resetCalls).toBe(1);
    expect(setRetryOutstandPostIdCalls).toEqual([
      { targetId: TARGET_ID, retryOutstandPostId: "fake-post-retry" },
    ]);
    expect(updateOutcomeCalls).toEqual([
      {
        postTargetId: TARGET_ID,
        status: "published",
        platformPostId: "platform-outstand-acc-1",
        platformPostUrl: "https://fake.outstand.local/posts/outstand-acc-1",
        error: undefined,
      },
    ]);
    expect(reconcileCalls).toEqual([
      { workspaceId: WORKSPACE_ID, postId: POST_ID },
    ]);
    expect(result).toEqual({
      targetId: TARGET_ID,
      status: "published",
      error: null,
      platformPostUrl: "https://fake.outstand.local/posts/outstand-acc-1",
    });
  });

  it("skips deletePost when sibling targets are still live (published/scheduled/pending)", async () => {
    const retryTarget = baseRetryTarget({ hasSiblingLiveTargets: true });
    const deletePostCalls: unknown[] = [];

    const repository = createFakeRepository({
      getRetryTarget: async () => retryTarget,
    });
    const adapter = createFakeOutstandAdapter({
      deletePost: async (...args) => {
        deletePostCalls.push(args);
      },
      publishNow: async () => ({ outstandPostId: "fake-post-retry" }),
      fetchPostOutcome: async () => [publishedOutcome("outstand-acc-1")],
    });

    const useCase = new RetryFailedTargetUseCase(repository, adapter);
    await useCase.execute({
      workspaceId: WORKSPACE_ID,
      postId: POST_ID,
      targetId: TARGET_ID,
      actorRole: MemberRole.Creator,
      actingUserId: AUTHOR_ID,
    });

    expect(deletePostCalls).toEqual([]);
  });

  it("keeps target/post Failed when the retry publish fails again", async () => {
    const retryTarget = baseRetryTarget();
    let reconcileCalls = 0;
    const updateOutcomeCalls: Parameters<
      IPublishingRepository["updateTargetOutcome"]
    >[0][] = [];

    const repository = createFakeRepository({
      getRetryTarget: async () => retryTarget,
      updateTargetOutcome: async (input) => {
        updateOutcomeCalls.push(input);
      },
      reconcilePostStatusAfterRetry: async () => {
        reconcileCalls += 1;
      },
    });
    const adapter = createFakeOutstandAdapter({
      publishNow: async () => {
        throw new Error("outstand down again");
      },
    });

    const useCase = new RetryFailedTargetUseCase(repository, adapter);

    const result = await useCase.execute({
      workspaceId: WORKSPACE_ID,
      postId: POST_ID,
      targetId: TARGET_ID,
      actorRole: MemberRole.Creator,
      actingUserId: AUTHOR_ID,
    });

    expect(updateOutcomeCalls).toEqual([
      {
        postTargetId: TARGET_ID,
        status: "failed",
        error: "outstand down again",
      },
    ]);
    // Reconcile tetap dipanggil (idempoten) — tapi karena target masih
    // failed, implementasi repository asli tidak akan meng-update apa pun;
    // di sini kita hanya memastikan use-case tetap memanggilnya.
    expect(reconcileCalls).toBe(1);
    expect(result).toEqual({
      targetId: TARGET_ID,
      status: "failed",
      error: "outstand down again",
      platformPostUrl: null,
    });
  });

  it("also reports failure via fetchPostOutcome (not just thrown errors)", async () => {
    const retryTarget = baseRetryTarget();
    const repository = createFakeRepository({
      getRetryTarget: async () => retryTarget,
    });
    const adapter = createFakeOutstandAdapter({
      publishNow: async () => ({ outstandPostId: "fake-post-retry" }),
      fetchPostOutcome: async () => [
        failedOutcome("outstand-acc-1", "rejected by platform"),
      ],
    });

    const useCase = new RetryFailedTargetUseCase(repository, adapter);

    const result = await useCase.execute({
      workspaceId: WORKSPACE_ID,
      postId: POST_ID,
      targetId: TARGET_ID,
      actorRole: MemberRole.Creator,
      actingUserId: AUTHOR_ID,
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("rejected by platform");
  });

  it("skips deletePost when the post never got a post-level outstandPostId", async () => {
    const retryTarget = baseRetryTarget({ postOutstandPostId: null });
    let deletePostCalls = 0;
    const repository = createFakeRepository({
      getRetryTarget: async () => retryTarget,
    });
    const adapter = createFakeOutstandAdapter({
      deletePost: async () => {
        deletePostCalls += 1;
      },
    });

    const useCase = new RetryFailedTargetUseCase(repository, adapter);

    await useCase.execute({
      workspaceId: WORKSPACE_ID,
      postId: POST_ID,
      targetId: TARGET_ID,
      actorRole: MemberRole.Creator,
      actingUserId: AUTHOR_ID,
    });

    expect(deletePostCalls).toBe(0);
  });

  it("does not fail the whole retry when deletePost throws (best-effort, logged only)", async () => {
    const retryTarget = baseRetryTarget();
    const repository = createFakeRepository({
      getRetryTarget: async () => retryTarget,
    });
    const adapter = createFakeOutstandAdapter({
      deletePost: async () => {
        throw new Error("delete failed on real outstand");
      },
      fetchPostOutcome: async () => [publishedOutcome("outstand-acc-1")],
    });

    const useCase = new RetryFailedTargetUseCase(repository, adapter);

    const result = await useCase.execute({
      workspaceId: WORKSPACE_ID,
      postId: POST_ID,
      targetId: TARGET_ID,
      actorRole: MemberRole.Creator,
      actingUserId: AUTHOR_ID,
    });

    expect(result.status).toBe("published");
  });

  it("rejects when the target is not found (or not part of this post/workspace)", async () => {
    const repository = createFakeRepository({
      getRetryTarget: async () => null,
    });
    const adapter = createFakeOutstandAdapter();
    const useCase = new RetryFailedTargetUseCase(repository, adapter);

    await expect(
      useCase.execute({
        workspaceId: WORKSPACE_ID,
        postId: POST_ID,
        targetId: TARGET_ID,
        actorRole: MemberRole.Creator,
        actingUserId: AUTHOR_ID,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("rejects when the target status is not 'failed'", async () => {
    const retryTarget = baseRetryTarget({ targetStatus: "published" });
    const repository = createFakeRepository({
      getRetryTarget: async () => retryTarget,
    });
    const adapter = createFakeOutstandAdapter();
    const useCase = new RetryFailedTargetUseCase(repository, adapter);

    await expect(
      useCase.execute({
        workspaceId: WORKSPACE_ID,
        postId: POST_ID,
        targetId: TARGET_ID,
        actorRole: MemberRole.Creator,
        actingUserId: AUTHOR_ID,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("rejects an invalid actorRole before touching repository or adapter (RBAC, same rule as Publish Now)", async () => {
    let repositoryCalled = false;
    let adapterCalled = false;
    const repository = createFakeRepository({
      getRetryTarget: async () => {
        repositoryCalled = true;
        return null;
      },
    });
    const adapter = createFakeOutstandAdapter({
      publishNow: async () => {
        adapterCalled = true;
        return { outstandPostId: "should-not-happen" };
      },
    });
    const useCase = new RetryFailedTargetUseCase(repository, adapter);

    await expect(
      useCase.execute({
        workspaceId: WORKSPACE_ID,
        postId: POST_ID,
        targetId: TARGET_ID,
        // Nilai di luar 3 role sah — mensimulasikan header ter-tamper.
        actorRole: "superadmin" as MemberRole,
        actingUserId: AUTHOR_ID,
      }),
    ).rejects.toThrow(AuthorizationError);

    expect(repositoryCalled).toBe(false);
    expect(adapterCalled).toBe(false);
  });

  it.each([MemberRole.Owner, MemberRole.Admin, MemberRole.Creator])(
    "allows role %s (sama seperti Publish Now, ADR-074)",
    async (role) => {
      const retryTarget = baseRetryTarget();
      const repository = createFakeRepository({
        getRetryTarget: async () => retryTarget,
      });
      const adapter = createFakeOutstandAdapter({
        fetchPostOutcome: async () => [publishedOutcome("outstand-acc-1")],
      });
      const useCase = new RetryFailedTargetUseCase(repository, adapter);

      await expect(
        useCase.execute({
          workspaceId: WORKSPACE_ID,
          postId: POST_ID,
          targetId: TARGET_ID,
          actorRole: role,
          actingUserId: AUTHOR_ID,
        }),
      ).resolves.toBeDefined();
    },
  );
});
