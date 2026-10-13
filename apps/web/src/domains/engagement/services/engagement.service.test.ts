import {
  asConnectedAccountId,
  asInboxItemId,
  asMediaId,
  asPostId,
  asReplyId,
  asUserId,
  asWorkspaceId,
  SocialPlatform,
  type IOutstandAdapter,
  type MediaId,
  type ReplyToCommentResult,
} from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/utils/errors";
import type { IEngagementRepository } from "../repositories/engagement.repository";
import type {
  EngagementInboxItemRecord,
  EngagementReplyRecord,
  InboxItemStatus,
} from "../types";
import { EngagementService } from "./engagement.service";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const CONNECTED_ACCOUNT_ID = asConnectedAccountId("account-1");
const USER_ID = asUserId("user-1");
const INBOX_ITEM_ID = asInboxItemId("inbox-item-1");

function makeInboxItem(
  overrides: Partial<EngagementInboxItemRecord> = {},
): EngagementInboxItemRecord {
  return {
    id: INBOX_ITEM_ID,
    workspaceId: WORKSPACE_ID,
    connectedAccountId: CONNECTED_ACCOUNT_ID,
    platform: SocialPlatform.Instagram,
    type: "comment",
    externalId: "external-1",
    authorHandle: "@rezi",
    content: "Halo, ini komentar",
    status: "unread",
    postId: null,
    receivedAt: new Date(0),
    readAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

function createFakeRepository(
  overrides: Partial<IEngagementRepository> = {},
): IEngagementRepository {
  return {
    listInboxItems: async () => [],
    findInboxItemById: async () => null,
    upsertInboxItem: async () => ({ item: makeInboxItem(), isNew: true }),
    markInboxItemStatus: async () => null,
    createReply: async ({ inboxItemId, userId, content, outstandReplyId }) => ({
      id: asReplyId("reply-1"),
      inboxItemId,
      userId,
      content,
      outstandReplyId,
      status: "sent",
      sentAt: new Date(0),
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }),
    listRepliesByInboxItemId: async () => [],
    ...overrides,
  };
}

/**
 * Fake `IOutstandAdapter` — pola sama `sync-comments.use-case.test.ts`.
 * Hanya `replyToComment` yang relevan untuk `EngagementService.reply`;
 * method lain distub `unused` (tidak dipanggil test manapun di file ini).
 */
function createFakeAdapter(
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
      platform: SocialPlatform.Instagram,
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
    fetchComments: async () => ({ comments: [] }),
    replyToComment: async (): Promise<ReplyToCommentResult> => ({
      outstandReplyId: "fake-reply-1",
    }),
    importPosts: async () => ({ importJobId: "unused" }),
    fetchImportJobStatus: async () => ({
      status: "completed" as const,
      posts: [],
      error: null,
    }),
    ...overrides,
  };
}

/**
 * Fake port `engagement` → `publishing` (redesain KI-068/ADR-113) — resolve
 * `outstandPostId` dari `postId` internal. Default selalu mengembalikan
 * `"fake-outstand-post-1"` (post yang "sudah pernah publish") supaya test
 * yang tidak secara spesifik menguji jalur "belum pernah publish"/"post
 * tidak terhubung" tidak perlu mengurus override ini.
 */
function createFakePublishingPosts(
  overrides: Partial<{
    findPostOutstandId: (
      input: unknown,
      userId: unknown,
    ) => Promise<string | null>;
    findPostSnapshotForEngagement: (
      input: unknown,
      userId: unknown,
    ) => Promise<{
      caption: string;
      mediaIds: MediaId[];
      platformPostUrl: string | null;
    } | null>;
  }> = {},
) {
  return {
    findPostOutstandId: async () => "fake-outstand-post-1",
    /**
     * T-056, KI-065 — default `null` (paling umum di test lama yang tidak
     * menguji T-056 — item biasanya `postId: null`); test T-056 mengoverride
     * eksplisit.
     */
    findPostSnapshotForEngagement: async () => null,
    ...overrides,
  };
}

/**
 * Fake port `engagement` → `workspace` (KI-071) — resolve handle akun
 * untuk `accountUsername`. Default mengembalikan handle `"@acme"` supaya
 * golden path reply tidak perlu override; test ConflictError mengoverride
 * ke `null` / handle kosong.
 */
function createFakeConnectedAccounts(
  overrides: Partial<{
    findConnectedAccountById: (
      workspaceId: unknown,
      connectedAccountId: unknown,
      userId: unknown,
    ) => Promise<{ handle: string } | null>;
  }> = {},
) {
  return {
    findConnectedAccountById: async () => ({ handle: "@acme" }),
    ...overrides,
  };
}

function createService(
  repository: IEngagementRepository = createFakeRepository(),
  adapter: IOutstandAdapter = createFakeAdapter(),
  publishingPosts = createFakePublishingPosts(),
  connectedAccounts = createFakeConnectedAccounts(),
) {
  return new EngagementService(
    repository,
    adapter,
    publishingPosts,
    connectedAccounts,
  );
}

describe("EngagementService.listInbox", () => {
  it("meneruskan filter ke repository dan mengembalikan hasilnya apa adanya", async () => {
    const items = [makeInboxItem(), makeInboxItem({ status: "done" })];
    let receivedFilter: unknown;
    const repository = createFakeRepository({
      listInboxItems: async (filter) => {
        receivedFilter = filter;
        return items;
      },
    });
    const service = createService(repository);

    const result = await service.listInbox(
      {
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        status: "unread" as InboxItemStatus,
      },
      USER_ID,
    );

    expect(result).toBe(items);
    expect(receivedFilter).toEqual({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      status: "unread",
    });
  });
});

describe("EngagementService.getInboxItemDetail", () => {
  it("mengembalikan item beserta replies-nya kalau ditemukan", async () => {
    const item = makeInboxItem();
    const replies: EngagementReplyRecord[] = [
      {
        id: asReplyId("reply-1"),
        inboxItemId: item.id,
        userId: USER_ID,
        content: "Balasan pertama",
        outstandReplyId: null,
        status: "sent",
        sentAt: new Date(0),
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    ];
    const repository = createFakeRepository({
      findInboxItemById: async () => item,
      listRepliesByInboxItemId: async () => replies,
    });
    const service = createService(repository);

    const result = await service.getInboxItemDetail(
      { workspaceId: WORKSPACE_ID, inboxItemId: item.id },
      USER_ID,
    );

    expect(result).toEqual({ ...item, replies, postSnapshot: null });
  });

  it("menyertakan postSnapshot kalau item.postId ada dan publishing menemukan snapshot-nya (T-056, KI-065)", async () => {
    const item = makeInboxItem({ postId: asPostId("post-1") });
    const repository = createFakeRepository({
      findInboxItemById: async () => item,
    });
    let receivedSnapshotInput: unknown;
    const publishingPosts = createFakePublishingPosts({
      findPostSnapshotForEngagement: async (input) => {
        receivedSnapshotInput = input;
        return {
          caption: "Caption post asli",
          mediaIds: [asMediaId("media-1")],
          platformPostUrl: "https://instagram.com/p/xyz",
        };
      },
    });
    const service = createService(
      repository,
      createFakeAdapter(),
      publishingPosts,
      createFakeConnectedAccounts(),
    );

    const result = await service.getInboxItemDetail(
      { workspaceId: WORKSPACE_ID, inboxItemId: item.id },
      USER_ID,
    );

    expect(receivedSnapshotInput).toEqual({
      workspaceId: WORKSPACE_ID,
      postId: item.postId,
      connectedAccountId: item.connectedAccountId,
    });
    expect(result.postSnapshot).toEqual({
      caption: "Caption post asli",
      mediaIds: [asMediaId("media-1")],
      platformPostUrl: "https://instagram.com/p/xyz",
    });
  });

  it("postSnapshot null kalau publishing tidak menemukan post/target-nya (soft-deleted dll)", async () => {
    const item = makeInboxItem({ postId: asPostId("post-1") });
    const repository = createFakeRepository({
      findInboxItemById: async () => item,
    });
    const service = createService(
      repository,
      createFakeAdapter(),
      createFakePublishingPosts({
        findPostSnapshotForEngagement: async () => null,
      }),
      createFakeConnectedAccounts(),
    );

    const result = await service.getInboxItemDetail(
      { workspaceId: WORKSPACE_ID, inboxItemId: item.id },
      USER_ID,
    );

    expect(result.postSnapshot).toBeNull();
  });

  it("throw NotFoundError kalau item tidak ditemukan", async () => {
    const repository = createFakeRepository({
      findInboxItemById: async () => null,
    });
    const service = createService(repository);

    await expect(
      service.getInboxItemDetail(
        { workspaceId: WORKSPACE_ID, inboxItemId: INBOX_ITEM_ID },
        USER_ID,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("EngagementService.markAsDone", () => {
  it("mengubah status inbox item jadi done", async () => {
    const doneItem = makeInboxItem({ status: "done", readAt: new Date(1) });
    let receivedStatusInput: unknown;
    const repository = createFakeRepository({
      markInboxItemStatus: async (input) => {
        receivedStatusInput = input;
        return doneItem;
      },
    });
    const service = createService(repository);

    const result = await service.markAsDone(
      { workspaceId: WORKSPACE_ID, inboxItemId: INBOX_ITEM_ID },
      USER_ID,
    );

    expect(result).toBe(doneItem);
    expect(receivedStatusInput).toEqual({
      workspaceId: WORKSPACE_ID,
      inboxItemId: INBOX_ITEM_ID,
      status: "done",
    });
  });

  it("throw NotFoundError kalau item tidak ditemukan/bukan milik workspace ini", async () => {
    const repository = createFakeRepository({
      markInboxItemStatus: async () => null,
    });
    const service = createService(repository);

    await expect(
      service.markAsDone(
        { workspaceId: WORKSPACE_ID, inboxItemId: INBOX_ITEM_ID },
        USER_ID,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("EngagementService.reply", () => {
  it("golden path: reply lewat OutstandAdapter lalu persist outstandReplyId", async () => {
    const item = makeInboxItem({
      externalId: "outstand-comment-1",
      postId: asPostId("post-1"),
    });
    let receivedReplyArgs: unknown;
    let receivedCreateReplyInput: unknown;
    const adapter = createFakeAdapter({
      replyToComment: async (input) => {
        receivedReplyArgs = input;
        return { outstandReplyId: "fake-reply-42" };
      },
    });
    const repository = createFakeRepository({
      findInboxItemById: async () => item,
      createReply: async (input) => {
        receivedCreateReplyInput = input;
        return {
          id: asReplyId("reply-1"),
          inboxItemId: input.inboxItemId,
          userId: input.userId,
          content: input.content,
          outstandReplyId: input.outstandReplyId,
          status: "sent",
          sentAt: new Date(0),
          createdAt: new Date(0),
          updatedAt: new Date(0),
        };
      },
    });
    const service = createService(
      repository,
      adapter,
      createFakePublishingPosts(),
      createFakeConnectedAccounts({
        findConnectedAccountById: async () => ({ handle: "@brand_ig" }),
      }),
    );

    const result = await service.reply(
      {
        workspaceId: WORKSPACE_ID,
        inboxItemId: item.id,
        content: "  Terima kasih ya!  ",
      },
      USER_ID,
    );

    expect(receivedReplyArgs).toEqual({
      outstandPostId: "fake-outstand-post-1",
      content: "Terima kasih ya!",
      accountUsername: "@brand_ig",
      parentOutstandCommentId: "outstand-comment-1",
    });
    expect(receivedCreateReplyInput).toEqual({
      inboxItemId: item.id,
      userId: USER_ID,
      content: "Terima kasih ya!",
      outstandReplyId: "fake-reply-42",
    });
    expect(result.outstandReplyId).toBe("fake-reply-42");
    expect(result.content).toBe("Terima kasih ya!");
  });

  it("meneruskan handle akun terhubung sebagai accountUsername ke adapter", async () => {
    const item = makeInboxItem({
      connectedAccountId: asConnectedAccountId("account-special"),
      postId: asPostId("post-1"),
    });
    let receivedReplyArgs: unknown;
    let receivedLookupArgs: unknown;
    const adapter = createFakeAdapter({
      replyToComment: async (input) => {
        receivedReplyArgs = input;
        return { outstandReplyId: "fake-reply-handle" };
      },
    });
    const repository = createFakeRepository({
      findInboxItemById: async () => item,
    });
    const service = createService(
      repository,
      adapter,
      createFakePublishingPosts(),
      createFakeConnectedAccounts({
        findConnectedAccountById: async (
          workspaceId,
          connectedAccountId,
          userId,
        ) => {
          receivedLookupArgs = { workspaceId, connectedAccountId, userId };
          return { handle: "  mycompany  " };
        },
      }),
    );

    await service.reply(
      { workspaceId: WORKSPACE_ID, inboxItemId: item.id, content: "Halo" },
      USER_ID,
    );

    expect(receivedLookupArgs).toEqual({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: asConnectedAccountId("account-special"),
      userId: USER_ID,
    });
    expect(receivedReplyArgs).toMatchObject({
      accountUsername: "mycompany",
    });
  });

  it("throw ValidationError kalau content kosong/whitespace-only", async () => {
    const service = createService();

    await expect(
      service.reply(
        {
          workspaceId: WORKSPACE_ID,
          inboxItemId: INBOX_ITEM_ID,
          content: "   ",
        },
        USER_ID,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("throw NotFoundError kalau inbox item tidak ditemukan/bukan milik workspace ini", async () => {
    const repository = createFakeRepository({
      findInboxItemById: async () => null,
    });
    const service = createService(repository);

    await expect(
      service.reply(
        {
          workspaceId: WORKSPACE_ID,
          inboxItemId: INBOX_ITEM_ID,
          content: "Halo",
        },
        USER_ID,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("throw ConflictError kalau item.postId null (data lama sebelum redesain KI-068)", async () => {
    const item = makeInboxItem({ postId: null });
    const repository = createFakeRepository({
      findInboxItemById: async () => item,
    });
    const service = createService(repository);

    await expect(
      service.reply(
        { workspaceId: WORKSPACE_ID, inboxItemId: item.id, content: "Halo" },
        USER_ID,
      ),
    ).rejects.toThrow(ConflictError);
  });

  it("throw ConflictError kalau post terkait belum pernah publish di Outstand (findPostOutstandId null)", async () => {
    const item = makeInboxItem({ postId: asPostId("post-1") });
    const repository = createFakeRepository({
      findInboxItemById: async () => item,
    });
    const service = createService(
      repository,
      createFakeAdapter(),
      createFakePublishingPosts({ findPostOutstandId: async () => null }),
    );

    await expect(
      service.reply(
        { workspaceId: WORKSPACE_ID, inboxItemId: item.id, content: "Halo" },
        USER_ID,
      ),
    ).rejects.toThrow(ConflictError);
  });

  it("throw ConflictError kalau akun terhubung tidak ditemukan", async () => {
    const item = makeInboxItem({ postId: asPostId("post-1") });
    const repository = createFakeRepository({
      findInboxItemById: async () => item,
    });
    const replyToComment = vi.fn(async () => ({
      outstandReplyId: "should-not-send",
    }));
    const service = createService(
      repository,
      createFakeAdapter({ replyToComment }),
      createFakePublishingPosts(),
      createFakeConnectedAccounts({
        findConnectedAccountById: async () => null,
      }),
    );

    await expect(
      service.reply(
        { workspaceId: WORKSPACE_ID, inboxItemId: item.id, content: "Halo" },
        USER_ID,
      ),
    ).rejects.toThrow(
      /Komentar tidak bisa dibalas karena akun terhubung tidak ditemukan/,
    );
    expect(replyToComment).not.toHaveBeenCalled();
  });

  it("throw ConflictError kalau handle akun terhubung kosong", async () => {
    const item = makeInboxItem({ postId: asPostId("post-1") });
    const repository = createFakeRepository({
      findInboxItemById: async () => item,
    });
    const replyToComment = vi.fn(async () => ({
      outstandReplyId: "should-not-send",
    }));
    const service = createService(
      repository,
      createFakeAdapter({ replyToComment }),
      createFakePublishingPosts(),
      createFakeConnectedAccounts({
        findConnectedAccountById: async () => ({ handle: "   " }),
      }),
    );

    await expect(
      service.reply(
        { workspaceId: WORKSPACE_ID, inboxItemId: item.id, content: "Halo" },
        USER_ID,
      ),
    ).rejects.toThrow(
      /Komentar tidak bisa dibalas karena akun terhubung tidak punya username/,
    );
    expect(replyToComment).not.toHaveBeenCalled();
  });
});
