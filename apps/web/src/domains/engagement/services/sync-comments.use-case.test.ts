import {
  asConnectedAccountId,
  asPostId,
  asUserId,
  asWorkspaceId,
  SocialPlatform,
  type PostId,
} from "@postific/shared";
import type { IOutstandAdapter, InboxCommentData } from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import type { IEngagementRepository } from "../repositories/engagement.repository";
import type { EngagementInboxItemRecord } from "../types";
import { SyncCommentsUseCase } from "./sync-comments.use-case";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const CONNECTED_ACCOUNT_ID = asConnectedAccountId("account-1");
const USER_ID = asUserId("user-1");
const ACCOUNT_USERNAME = "@fake.account";
const POST_ID_1 = asPostId("post-1");
const POST_ID_2 = asPostId("post-2");
const OUTSTAND_POST_ID_1 = "outstand-post-1";
const OUTSTAND_POST_ID_2 = "outstand-post-2";

function makeComment(
  index: number,
  outstandPostId: string = OUTSTAND_POST_ID_1,
): InboxCommentData {
  return {
    outstandCommentId: `comment-${index}`,
    platform: SocialPlatform.Instagram,
    authorHandle: `@user${index}`,
    content: `Komentar ke-${index}`,
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
 * Fake port `engagement` → `publishing` (redesain KI-068/ADR-113) — lihat
 * `refresh-inbox.use-case.test.ts` untuk penjelasan lengkap. Default satu
 * post (`POST_ID_1`/`OUTSTAND_POST_ID_1`) supaya test yang tidak spesifik
 * menguji multi-post tidak perlu mengurus daftar ini sendiri.
 */
function createFakePublishingPosts(
  posts: {
    postId: PostId;
    outstandPostId: string;
    platform: SocialPlatform;
  }[] = [
    {
      postId: POST_ID_1,
      outstandPostId: OUTSTAND_POST_ID_1,
      platform: SocialPlatform.Instagram,
    },
  ],
) {
  return {
    listSyncablePostsByConnectedAccount: async () => posts,
  };
}

const PAYLOAD = {
  workspaceId: WORKSPACE_ID,
  connectedAccountId: CONNECTED_ACCOUNT_ID,
  accountUsername: ACCOUNT_USERNAME,
};

describe("SyncCommentsUseCase.sync", () => {
  it("mengupsert setiap komentar hasil fetchComments dan menghitung yang benar-benar baru", async () => {
    const upsertedInputs: { externalId: string; postId?: PostId }[] = [];
    const repository = createFakeRepository({
      upsertInboxItem: async (input) => {
        upsertedInputs.push({
          externalId: input.externalId,
          postId: input.postId,
        });
        return {
          item: {} as EngagementInboxItemRecord,
          isNew: true,
        };
      },
    });
    const adapter = createFakeAdapter(async () => ({
      comments: [makeComment(1), makeComment(2)],
    }));
    const useCase = new SyncCommentsUseCase(
      repository,
      adapter,
      createFakePublishingPosts(),
    );

    const result = await useCase.sync(PAYLOAD, USER_ID);

    expect(result).toEqual({ newCommentsCount: 2 });
    expect(upsertedInputs).toEqual([
      { externalId: "comment-1", postId: POST_ID_1 },
      { externalId: "comment-2", postId: POST_ID_1 },
    ]);
  });

  it("idempoten — sync kedua untuk komentar yang sama tidak menghitung komentar baru", async () => {
    // Simulasikan state persisten sederhana: sekali externalId pernah
    // di-upsert, panggilan berikutnya untuk externalId yang sama
    // mengembalikan isNew: false (persis perilaku implementasi Prisma
    // nyata, yang membedakan lewat findUnique SEBELUM upsert).
    const seen = new Set<string>();
    const repository = createFakeRepository({
      upsertInboxItem: async (input) => {
        const isNew = !seen.has(input.externalId);
        seen.add(input.externalId);
        return { item: {} as EngagementInboxItemRecord, isNew };
      },
    });
    const adapter = createFakeAdapter(async () => ({
      comments: [makeComment(1), makeComment(2)],
    }));
    const useCase = new SyncCommentsUseCase(
      repository,
      adapter,
      createFakePublishingPosts(),
    );

    const first = await useCase.sync(PAYLOAD, USER_ID);
    const second = await useCase.sync(PAYLOAD, USER_ID);

    expect(first).toEqual({ newCommentsCount: 2 });
    expect(second).toEqual({ newCommentsCount: 0 });
  });

  it("melanjutkan post lain kalau fetchComments satu post gagal (isolasi per-post)", async () => {
    const upserted: string[] = [];
    const fetchComments = vi
      .fn<IOutstandAdapter["fetchComments"]>()
      .mockImplementation(async ({ outstandPostId }) => {
        if (outstandPostId === OUTSTAND_POST_ID_1) {
          throw new Error("Outstand 404 for post-1");
        }
        return {
          comments: [makeComment(2, outstandPostId)],
        };
      });
    const repository = createFakeRepository({
      upsertInboxItem: async (input) => {
        upserted.push(input.externalId);
        return { item: {} as EngagementInboxItemRecord, isNew: true };
      },
    });
    const publishingPosts = createFakePublishingPosts([
      {
        postId: POST_ID_1,
        outstandPostId: OUTSTAND_POST_ID_1,
        platform: SocialPlatform.Instagram,
      },
      {
        postId: POST_ID_2,
        outstandPostId: OUTSTAND_POST_ID_2,
        platform: SocialPlatform.Instagram,
      },
    ]);
    const useCase = new SyncCommentsUseCase(
      repository,
      createFakeAdapter(fetchComments),
      publishingPosts,
    );

    const result = await useCase.sync(PAYLOAD, USER_ID);

    expect(result).toEqual({ newCommentsCount: 1 });
    expect(upserted).toEqual(["comment-2"]);
    expect(fetchComments).toHaveBeenCalledTimes(2);
  });

  it("memanggil fetchComments SEKALI PER POST syncable (redesain KI-068 — bukan lagi cursor per akun)", async () => {
    const requestedOutstandPostIds: string[] = [];
    const fetchComments = vi
      .fn<IOutstandAdapter["fetchComments"]>()
      .mockImplementation(async ({ outstandPostId }) => {
        requestedOutstandPostIds.push(outstandPostId);
        return {
          comments: [
            makeComment(
              outstandPostId === OUTSTAND_POST_ID_1 ? 1 : 2,
              outstandPostId,
            ),
          ],
        };
      });
    const repository = createFakeRepository();
    const adapter = createFakeAdapter(fetchComments);
    const publishingPosts = createFakePublishingPosts([
      {
        postId: POST_ID_1,
        outstandPostId: OUTSTAND_POST_ID_1,
        platform: SocialPlatform.Instagram,
      },
      {
        postId: POST_ID_2,
        outstandPostId: OUTSTAND_POST_ID_2,
        platform: SocialPlatform.Instagram,
      },
    ]);
    const useCase = new SyncCommentsUseCase(
      repository,
      adapter,
      publishingPosts,
    );

    const result = await useCase.sync(PAYLOAD, USER_ID);

    expect(result).toEqual({ newCommentsCount: 2 });
    expect(requestedOutstandPostIds).toEqual([
      OUTSTAND_POST_ID_1,
      OUTSTAND_POST_ID_2,
    ]);
    expect(fetchComments).toHaveBeenCalledTimes(2);
    for (const call of fetchComments.mock.calls) {
      expect(call[0].accountUsername).toBe(ACCOUNT_USERNAME);
      expect(call[0].platform).toBe(SocialPlatform.Instagram);
    }
  });

  it("mengirim SATU notifikasi aggregate per member aktif kalau ada komentar baru (bukan per-komentar)", async () => {
    const notify = vi.fn<
      (input: { userId: string; body: string }) => Promise<undefined>
    >(async () => undefined);
    const repository = createFakeRepository();
    const adapter = createFakeAdapter(async () => ({
      comments: [makeComment(1), makeComment(2), makeComment(3)],
    }));
    const memberA = asUserId("member-a");
    const memberB = asUserId("member-b");
    const useCase = new SyncCommentsUseCase(
      repository,
      adapter,
      createFakePublishingPosts(),
      { notify },
      {
        listActiveMembers: async () => [
          { userId: memberA },
          { userId: memberB },
        ],
      },
    );

    await useCase.sync(PAYLOAD, USER_ID);

    expect(notify).toHaveBeenCalledTimes(2);
    const notifiedUserIds = notify.mock.calls.map((call) => call[0].userId);
    expect(notifiedUserIds.sort()).toEqual([memberA, memberB].sort());
    for (const call of notify.mock.calls) {
      expect(call[0].body).toContain("3 komentar baru");
    }
  });

  it("tidak throw dan tidak mengirim notifikasi kalau port notifikasi/workspace member tidak disuplai", async () => {
    const repository = createFakeRepository();
    const adapter = createFakeAdapter(async () => ({
      comments: [makeComment(1)],
    }));
    const useCase = new SyncCommentsUseCase(
      repository,
      adapter,
      createFakePublishingPosts(),
    );

    const result = await useCase.sync(PAYLOAD, USER_ID);

    expect(result).toEqual({ newCommentsCount: 1 });
  });

  it("tidak mengirim notifikasi kalau tidak ada komentar baru sama sekali", async () => {
    const notify = vi.fn(async () => undefined);
    const repository = createFakeRepository({
      upsertInboxItem: async () => ({
        item: {} as EngagementInboxItemRecord,
        isNew: false,
      }),
    });
    const adapter = createFakeAdapter(async () => ({
      comments: [makeComment(1)],
    }));
    const useCase = new SyncCommentsUseCase(
      repository,
      adapter,
      createFakePublishingPosts(),
      { notify },
      {
        listActiveMembers: async () => [{ userId: asUserId("member-a") }],
      },
    );

    const result = await useCase.sync(PAYLOAD, USER_ID);

    expect(result).toEqual({ newCommentsCount: 0 });
    expect(notify).not.toHaveBeenCalled();
  });

  it("tidak memanggil fetchComments sama sekali kalau tidak ada post syncable untuk akun ini", async () => {
    const fetchComments = vi.fn<IOutstandAdapter["fetchComments"]>();
    const repository = createFakeRepository();
    const adapter = createFakeAdapter(fetchComments);
    const useCase = new SyncCommentsUseCase(
      repository,
      adapter,
      createFakePublishingPosts([]),
    );

    const result = await useCase.sync(PAYLOAD, USER_ID);

    expect(result).toEqual({ newCommentsCount: 0 });
    expect(fetchComments).not.toHaveBeenCalled();
  });
});
