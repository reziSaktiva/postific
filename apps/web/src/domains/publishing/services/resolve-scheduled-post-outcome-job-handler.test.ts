import {
  asConnectedAccountId,
  asPostId,
  asPostTargetId,
  asUserId,
  asWorkspaceId,
  ContentStatus,
} from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import type {
  IOutstandAdapter,
  PostTargetOutcome,
} from "../adapters/outstand-adapter";
import type {
  IPublishingRepository,
  WebhookPostLookupRecord,
} from "../repositories/publishing.repository";
import { OutstandWebhookProcessor } from "./outstand-webhook-processor";
import { ResolveScheduledPostOutcomeJobHandler } from "./resolve-scheduled-post-outcome-job-handler";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const AUTHOR_ID = asUserId("user-author");
const POST_ID = asPostId("post-1");
const CONNECTED_ACCOUNT_ID_A = asConnectedAccountId("connected-a");
const CONNECTED_ACCOUNT_ID_B = asConnectedAccountId("connected-b");
const POST_TARGET_ID_A = asPostTargetId("target-a");
const POST_TARGET_ID_B = asPostTargetId("target-b");
const OUTSTAND_POST_ID = "outstand-post-1";

function createLookup(
  overrides: Partial<WebhookPostLookupRecord> = {},
): WebhookPostLookupRecord {
  return {
    postId: POST_ID,
    workspaceId: WORKSPACE_ID,
    authorId: AUTHOR_ID,
    targets: [
      {
        postTargetId: POST_TARGET_ID_A,
        connectedAccountId: CONNECTED_ACCOUNT_ID_A,
        outstandAccountId: "outstand-account-a",
      },
      {
        postTargetId: POST_TARGET_ID_B,
        connectedAccountId: CONNECTED_ACCOUNT_ID_B,
        outstandAccountId: "outstand-account-b",
      },
    ],
    ...overrides,
  };
}

function createFakeRepository(
  overrides: Partial<IPublishingRepository> = {},
): IPublishingRepository {
  return {
    createDraft: async ({ workspaceId, authorId, caption }) => ({
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
  } satisfies IPublishingRepository;
}

function outcome(
  outstandAccountId: string,
  status: PostTargetOutcome["status"],
  error: string | null = null,
): PostTargetOutcome {
  return {
    outstandAccountId,
    status,
    error,
    platformPostId:
      status === "published" ? `platform-${outstandAccountId}` : null,
    platformPostUrl:
      status === "published"
        ? `https://fake.outstand.local/${outstandAccountId}`
        : null,
    publishedAt: status === "published" ? new Date(0) : null,
  };
}

function createFakeAdapter(
  fetchPostOutcome: IOutstandAdapter["fetchPostOutcome"],
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
    schedulePost: async () => ({ outstandPostId: "unused" }),
    publishNow: async () => ({ outstandPostId: "unused" }),
    fetchPostOutcome,
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
  };
}

describe("ResolveScheduledPostOutcomeJobHandler.handle (T-027.5)", () => {
  it("throws a rescheduleable error when Outstand still reports a target as pending — job runner retries with backoff", async () => {
    const repository = createFakeRepository({
      findPostTargetsByOutstandPostId: async () => createLookup(),
    });
    const adapter = createFakeAdapter(async () => [
      outcome("outstand-account-a", "published"),
      // account-b tetap "pending" di sisi Outstand.
    ]);
    const processor = new OutstandWebhookProcessor(repository, adapter, {
      markAccountReconnectRequired: async () => null,
    });
    const handler = new ResolveScheduledPostOutcomeJobHandler(processor);

    await expect(
      handler.handle({ outstandPostId: OUTSTAND_POST_ID }),
    ).rejects.toThrow(/belum lengkap/);
  });

  it("resolves cleanly (no throw) once every target has a terminal outcome, AND marks the post Published (T-027 bug fix, post-level status)", async () => {
    const updateTargetOutcome = vi.fn(async () => undefined);
    const markPostPublished = vi.fn(async () => undefined);
    const repository = createFakeRepository({
      findPostTargetsByOutstandPostId: async () => createLookup(),
      updateTargetOutcome,
      markPostPublished,
    });
    const adapter = createFakeAdapter(async () => [
      outcome("outstand-account-a", "published"),
      outcome("outstand-account-b", "published"),
    ]);
    const processor = new OutstandWebhookProcessor(repository, adapter, {
      markAccountReconnectRequired: async () => null,
    });
    const handler = new ResolveScheduledPostOutcomeJobHandler(processor);

    await expect(
      handler.handle({ outstandPostId: OUTSTAND_POST_ID }),
    ).resolves.toBeUndefined();
    expect(updateTargetOutcome).toHaveBeenCalledTimes(2);
    // T-027 bug fix — sebelumnya PublishingPost.status tidak pernah naik
    // dari Scheduled ke Published walau semua target sudah resolved sukses
    // (ditemukan saat QA end-to-end, query DB langsung). Sekarang job T-027
    // yang menyelesaikan seluruh target juga membawa post-nya ke Published.
    expect(markPostPublished).toHaveBeenCalledWith(
      { workspaceId: WORKSPACE_ID, postId: POST_ID },
      AUTHOR_ID,
    );
  });

  it("notifies the author on total failure even without a webhook post.error event (beda dari webhook path)", async () => {
    const markPostFailed = vi.fn(async () => undefined);
    const notify = vi.fn(async () => undefined);
    const repository = createFakeRepository({
      findPostTargetsByOutstandPostId: async () => createLookup(),
      markPostFailed,
    });
    const adapter = createFakeAdapter(async () => [
      outcome("outstand-account-a", "failed", "quota exceeded"),
      outcome("outstand-account-b", "failed", "token invalid"),
    ]);
    const processor = new OutstandWebhookProcessor(
      repository,
      adapter,
      { markAccountReconnectRequired: async () => null },
      { notify },
    );
    const handler = new ResolveScheduledPostOutcomeJobHandler(processor);

    await handler.handle({ outstandPostId: OUTSTAND_POST_ID });

    expect(markPostFailed).toHaveBeenCalledWith(
      {
        workspaceId: WORKSPACE_ID,
        postId: POST_ID,
        // T-107 — reason gabungan unik dari error tiap target gagal.
        reason: "quota exceeded; token invalid",
      },
      AUTHOR_ID,
    );
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("no-ops (does not throw) when the post/target no longer matches — Cancel Schedule or a reschedule since the job was enqueued", async () => {
    const repository = createFakeRepository({
      findPostTargetsByOutstandPostId: async () => null,
    });
    const adapter = createFakeAdapter(async () => []);
    const processor = new OutstandWebhookProcessor(repository, adapter, {
      markAccountReconnectRequired: async () => null,
    });
    const handler = new ResolveScheduledPostOutcomeJobHandler(processor);

    await expect(
      handler.handle({ outstandPostId: "stale-outstand-post-id" }),
    ).resolves.toBeUndefined();
  });

  it("throws a clear validation error for a malformed payload instead of silently no-op'ing", async () => {
    const processor = new OutstandWebhookProcessor(
      createFakeRepository(),
      createFakeAdapter(async () => []),
      { markAccountReconnectRequired: async () => null },
    );
    const handler = new ResolveScheduledPostOutcomeJobHandler(processor);

    await expect(handler.handle({})).rejects.toThrow(/Payload job/);
    await expect(handler.handle(null)).rejects.toThrow(/Payload job/);
  });
});
