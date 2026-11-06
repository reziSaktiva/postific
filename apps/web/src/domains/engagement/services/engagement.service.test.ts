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
import { noopFetchAllPostIdMappings } from "@/lib/testing/outstand-post-id-backfill-stubs";
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
    countUnreadInboxItems: async () => 0,
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
    fetchAllPostIdMappings: noopFetchAllPostIdMappings,
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
    const items = [makeInboxItem(), makeInboxItem({ status: "resolved" })];
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

/**
 * Repository in-memory yang menghormati kontrak `IEngagementRepository`
 * (`onlyFromStatus`, `readAt` sekali isi, jendela `since`), supaya tes
 * status menguji perilaku lewat batas publik service, bukan urutan panggilan.
 */
function createStatefulRepository(initial: EngagementInboxItemRecord[]) {
  const rows = new Map(initial.map((item) => [item.id, { ...item }]));
  const repository = createFakeRepository({
    findInboxItemById: async ({ inboxItemId }) => {
      const row = rows.get(inboxItemId);
      return row ? { ...row } : null;
    },
    markInboxItemStatus: async ({ inboxItemId, status, onlyFromStatus }) => {
      const row = rows.get(inboxItemId);
      if (!row) return null;
      if (!onlyFromStatus || row.status === onlyFromStatus) {
        row.status = status;
        if (status !== "unread" && row.readAt === null) {
          row.readAt = new Date(1);
        }
      }
      return { ...row };
    },
    countUnreadInboxItems: async ({ since }) =>
      [...rows.values()].filter(
        (row) => row.status === "unread" && row.receivedAt >= since,
      ).length,
  });
  return { repository, rows };
}

describe("EngagementService.changeStatus", () => {
  it.each([
    ["unread", "resolved"],
    ["unread", "dismissed"],
    ["unread", "replied"],
    ["replied", "resolved"],
    ["replied", "dismissed"],
    ["resolved", "unread"],
    ["dismissed", "unread"],
  ] as const)("mengizinkan transisi %s -> %s", async (from, to) => {
    const { repository } = createStatefulRepository([
      makeInboxItem({ status: from }),
    ]);
    const service = createService(repository);

    const result = await service.changeStatus(
      { workspaceId: WORKSPACE_ID, inboxItemId: INBOX_ITEM_ID, status: to },
      USER_ID,
    );

    expect(result.status).toBe(to);
  });

  it.each([
    ["resolved", "dismissed"],
    ["dismissed", "resolved"],
    ["resolved", "replied"],
    ["replied", "unread"],
  ] as const)(
    "menolak transisi %s -> %s dengan ConflictError",
    async (from, to) => {
      const { repository, rows } = createStatefulRepository([
        makeInboxItem({ status: from }),
      ]);
      const service = createService(repository);

      await expect(
        service.changeStatus(
          { workspaceId: WORKSPACE_ID, inboxItemId: INBOX_ITEM_ID, status: to },
          USER_ID,
        ),
      ).rejects.toThrow(ConflictError);
      expect(rows.get(INBOX_ITEM_ID)?.status).toBe(from);
    },
  );

  it("idempoten untuk status yang sama", async () => {
    const { repository } = createStatefulRepository([
      makeInboxItem({ status: "resolved" }),
    ]);
    const service = createService(repository);

    const result = await service.changeStatus(
      {
        workspaceId: WORKSPACE_ID,
        inboxItemId: INBOX_ITEM_ID,
        status: "resolved",
      },
      USER_ID,
    );

    expect(result.status).toBe("resolved");
  });

  it("menolak status tak dikenal dengan ValidationError", async () => {
    const { repository } = createStatefulRepository([makeInboxItem()]);
    const service = createService(repository);

    await expect(
      service.changeStatus(
        {
          workspaceId: WORKSPACE_ID,
          inboxItemId: INBOX_ITEM_ID,
          status: "archived" as InboxItemStatus,
        },
        USER_ID,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("ConflictError bila status berubah di antara baca dan tulis (balapan)", async () => {
    const { repository, rows } = createStatefulRepository([makeInboxItem()]);
    const find = repository.findInboxItemById;
    repository.findInboxItemById = async (input, userId) => {
      const snapshot = await find(input, userId);
      // pihak lain menutup komentar tepat setelah service membaca `unread`
      rows.get(INBOX_ITEM_ID)!.status = "resolved";
      return snapshot;
    };
    const service = createService(repository);

    await expect(
      service.changeStatus(
        {
          workspaceId: WORKSPACE_ID,
          inboxItemId: INBOX_ITEM_ID,
          status: "dismissed",
        },
        USER_ID,
      ),
    ).rejects.toThrow(ConflictError);
    expect(rows.get(INBOX_ITEM_ID)?.status).toBe("resolved");
  });

  it("throw NotFoundError kalau item tidak ditemukan/bukan milik workspace ini", async () => {
    const service = createService(createStatefulRepository([]).repository);

    await expect(
      service.changeStatus(
        {
          workspaceId: WORKSPACE_ID,
          inboxItemId: INBOX_ITEM_ID,
          status: "resolved",
        },
        USER_ID,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("EngagementService.countUnread (T-217.7)", () => {
  const NOW = new Date("2026-11-06T00:00:00.000Z");

  it("menghitung unread dalam 12 bulan terakhir dan mengabaikan yang lebih tua atau sudah ditangani", async () => {
    const { repository } = createStatefulRepository([
      makeInboxItem({
        id: asInboxItemId("recent"),
        receivedAt: new Date("2026-11-01T00:00:00.000Z"),
      }),
      makeInboxItem({
        id: asInboxItemId("edge-inside"),
        receivedAt: new Date("2025-11-06T00:00:00.000Z"),
      }),
      makeInboxItem({
        id: asInboxItemId("too-old"),
        receivedAt: new Date("2025-11-05T23:59:59.000Z"),
      }),
      makeInboxItem({
        id: asInboxItemId("resolved"),
        status: "resolved",
        receivedAt: new Date("2026-11-01T00:00:00.000Z"),
      }),
    ]);
    const service = createService(repository);

    await expect(service.countUnread(WORKSPACE_ID, USER_ID, NOW)).resolves.toBe(
      2,
    );
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

describe("EngagementService.reply menandai replied (T-217.3)", () => {
  async function replyTo(status: InboxItemStatus) {
    const { repository, rows } = createStatefulRepository([
      makeInboxItem({ status, postId: asPostId("post-1") }),
    ]);
    const service = createService(repository);
    await service.reply(
      {
        workspaceId: WORKSPACE_ID,
        inboxItemId: INBOX_ITEM_ID,
        content: "Terima kasih!",
      },
      USER_ID,
    );
    return rows.get(INBOX_ITEM_ID)?.status;
  }

  it("unread menjadi replied setelah balasan terkirim", async () => {
    await expect(replyTo("unread")).resolves.toBe("replied");
  });

  it.each(["replied", "resolved", "dismissed"] as const)(
    "tidak mengubah status %s",
    async (status) => {
      await expect(replyTo(status)).resolves.toBe(status);
    },
  );

  it("tidak menandai replied bila pengiriman ke Outstand gagal", async () => {
    const { repository, rows } = createStatefulRepository([
      makeInboxItem({ postId: asPostId("post-1") }),
    ]);
    const service = createService(
      repository,
      createFakeAdapter({
        replyToComment: async () => {
          throw new Error("Outstand down");
        },
      }),
    );

    await expect(
      service.reply(
        {
          workspaceId: WORKSPACE_ID,
          inboxItemId: INBOX_ITEM_ID,
          content: "Halo",
        },
        USER_ID,
      ),
    ).rejects.toThrow("Outstand down");
    expect(rows.get(INBOX_ITEM_ID)?.status).toBe("unread");
  });

  it("balasan tetap sukses walau penandaan replied gagal, dan kegagalan tercatat di log", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { repository } = createStatefulRepository([
      makeInboxItem({ postId: asPostId("post-1") }),
    ]);
    repository.markInboxItemStatus = async () => {
      throw new Error("db down");
    };
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
    ).resolves.toMatchObject({ content: "Halo" });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain(INBOX_ITEM_ID);
    expect(errorSpy.mock.calls[0][1]).toEqual(new Error("db down"));
    errorSpy.mockRestore();
  });
});
