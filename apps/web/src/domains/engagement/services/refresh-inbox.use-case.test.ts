import {
  asConnectedAccountId,
  asPostId,
  asUserId,
  asWorkspaceId,
  SocialPlatform,
  type ConnectedAccountId,
  type PostId,
} from "@postific/shared";
import type { IOutstandAdapter, InboxCommentData } from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import type { IEngagementRepository } from "../repositories/engagement.repository";
import type { EngagementInboxItemRecord } from "../types";
import { RefreshInboxUseCase } from "./refresh-inbox.use-case";
import { SyncCommentsUseCase } from "./sync-comments.use-case";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const USER_ID = asUserId("user-1");
const ACCOUNT_ACTIVE_1 = asConnectedAccountId("account-active-1");
const ACCOUNT_ACTIVE_2 = asConnectedAccountId("account-active-2");
const ACCOUNT_INACTIVE = asConnectedAccountId("account-inactive");

function makeComment(id: string, outstandPostId: string): InboxCommentData {
  return {
    outstandCommentId: id,
    platform: SocialPlatform.Instagram,
    authorHandle: "@user",
    content: `Komentar ${id}`,
    outstandPostId,
    receivedAt: new Date(0),
  };
}

function createFakeAdapter(
  fetchComments: IOutstandAdapter["fetchComments"],
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
    fetchComments,
    replyToComment: async () => ({ outstandReplyId: "fake-reply" }),
    importPosts: async () => ({ importJobId: "unused" }),
    fetchImportJobStatus: async () => ({
      status: "completed" as const,
      posts: [],
      error: null,
    }),
  };
}

function createFakeRepository(
  overrides: Partial<IEngagementRepository> = {},
): IEngagementRepository {
  return {
    listInboxItems: async () => [],
    findInboxItemById: async () => null,
    upsertInboxItem: async () => ({
      item: {} as EngagementInboxItemRecord,
      isNew: true,
    }),
    markInboxItemStatus: async () => null,
    createReply: async () => {
      throw new Error("not used in this test");
    },
    listRepliesByInboxItemId: async () => [],
    ...overrides,
  };
}

/**
 * Fake port `engagement` → `publishing` (redesain KI-068/ADR-113) — daftar
 * post "syncable" per `connectedAccountId`, sesuai
 * `SyncCommentsUseCase.publishingPosts`. `postsByAccount` dikunci by
 * `connectedAccountId` string (bukan branded type) supaya pemanggilan test
 * tetap ringkas.
 */
function createFakePublishingPosts(
  postsByAccount: Record<
    string,
    { postId: PostId; outstandPostId: string; platform: SocialPlatform }[]
  >,
) {
  return {
    listSyncablePostsByConnectedAccount: async ({
      connectedAccountId,
    }: {
      connectedAccountId: ConnectedAccountId;
    }) => postsByAccount[connectedAccountId] ?? [],
  };
}

describe("RefreshInboxUseCase.refreshAll", () => {
  it("sync hanya ConnectedAccount berstatus active dan mengakumulasi newCommentsCount lintas akun", async () => {
    const fetchedOutstandPostIds: string[] = [];
    const repository = createFakeRepository({
      upsertInboxItem: async () => ({
        item: {} as EngagementInboxItemRecord,
        isNew: true,
      }),
    });
    const adapter = createFakeAdapter(async ({ outstandPostId }) => {
      fetchedOutstandPostIds.push(outstandPostId);
      return {
        comments: [makeComment(`${outstandPostId}-1`, outstandPostId)],
      };
    });
    const publishingPosts = createFakePublishingPosts({
      [ACCOUNT_ACTIVE_1]: [
        {
          postId: asPostId("post-1"),
          outstandPostId: "outstand-post-1",
          platform: SocialPlatform.Instagram,
        },
      ],
      [ACCOUNT_ACTIVE_2]: [
        {
          postId: asPostId("post-2"),
          outstandPostId: "outstand-post-2",
          platform: SocialPlatform.Instagram,
        },
      ],
    });
    const syncCommentsUseCase = new SyncCommentsUseCase(
      repository,
      adapter,
      publishingPosts,
    );
    const useCase = new RefreshInboxUseCase(syncCommentsUseCase, {
      listConnectedAccounts: async () => [
        {
          id: ACCOUNT_ACTIVE_1,
          outstandAccountId: "outstand-active-1",
          handle: "@active-1",
          status: "active",
        },
        {
          id: ACCOUNT_INACTIVE,
          outstandAccountId: "outstand-inactive",
          handle: "@inactive",
          status: "reconnect-required",
        },
        {
          id: ACCOUNT_ACTIVE_2,
          outstandAccountId: "outstand-active-2",
          handle: "@active-2",
          status: "active",
        },
      ],
    });

    const result = await useCase.refreshAll(WORKSPACE_ID, USER_ID);

    expect(result).toEqual({ newCommentsCount: 2 });
    expect(fetchedOutstandPostIds).toEqual([
      "outstand-post-1",
      "outstand-post-2",
    ]);
  });

  it("mengembalikan newCommentsCount 0 tanpa memanggil sync kalau tidak ada akun aktif", async () => {
    const fetchComments = vi.fn<IOutstandAdapter["fetchComments"]>();
    const repository = createFakeRepository();
    const adapter = createFakeAdapter(fetchComments);
    const publishingPosts = createFakePublishingPosts({});
    const syncCommentsUseCase = new SyncCommentsUseCase(
      repository,
      adapter,
      publishingPosts,
    );
    const useCase = new RefreshInboxUseCase(syncCommentsUseCase, {
      listConnectedAccounts: async () => [
        {
          id: ACCOUNT_INACTIVE,
          outstandAccountId: "outstand-inactive",
          handle: "@inactive",
          status: "reconnect-required",
        },
      ],
    });

    const result = await useCase.refreshAll(WORKSPACE_ID, USER_ID);

    expect(result).toEqual({ newCommentsCount: 0 });
    expect(fetchComments).not.toHaveBeenCalled();
  });
});
