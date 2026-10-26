import {
  asConnectedAccountId,
  asUserId,
  asWorkspaceId,
  ContentFormat,
  SocialPlatform,
  type FetchPostMetricsResult,
  type ImportedPostData,
  type IOutstandAdapter,
} from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import type {
  ClassifyImportedPostTargetUpdate,
  IPublishingRepository,
} from "../repositories/publishing.repository";
import {
  ClassifyImportedPostTargetsUseCase,
  mapFetchPostMetricsToContentFormat,
} from "./classify-imported-post-targets.use-case";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const CONNECTED_ACCOUNT_ID = asConnectedAccountId("account-1");
const ACTING_USER_ID = asUserId("user-1");

function metrics(
  overrides: Partial<FetchPostMetricsResult> = {},
): FetchPostMetricsResult {
  return {
    impressions: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    clicks: null,
    engagementRate: 0,
    ...overrides,
  };
}

describe("mapFetchPostMetricsToContentFormat (ADR-135, T-132.6 — mapping murni, tanpa network/DB)", () => {
  it.each([
    ["FEED", ContentFormat.Post],
    ["REELS", ContentFormat.Reel],
    ["STORY", ContentFormat.Story],
  ] as const)(
    "maps Instagram media_product_type %s to ContentFormat.%s",
    (mediaProductType, expected) => {
      const result = mapFetchPostMetricsToContentFormat(
        SocialPlatform.Instagram,
        metrics({ mediaProductType }),
      );
      expect(result).toBe(expected);
    },
  );

  it("falls back (undefined) for Instagram when mediaProductType is missing", () => {
    const result = mapFetchPostMetricsToContentFormat(
      SocialPlatform.Instagram,
      metrics({}),
    );
    expect(result).toBeUndefined();
  });

  it("maps Facebook isReel true to ContentFormat.Reel", () => {
    const result = mapFetchPostMetricsToContentFormat(
      SocialPlatform.Facebook,
      metrics({ isReel: true }),
    );
    expect(result).toBe(ContentFormat.Reel);
  });

  it("maps Facebook isReel false to ContentFormat.Post (confirmed non-Reel, not 'unknown')", () => {
    const result = mapFetchPostMetricsToContentFormat(
      SocialPlatform.Facebook,
      metrics({ isReel: false }),
    );
    expect(result).toBe(ContentFormat.Post);
  });

  it("falls back (undefined) for Facebook when isReel is missing (undefined, not false)", () => {
    const result = mapFetchPostMetricsToContentFormat(
      SocialPlatform.Facebook,
      metrics({}),
    );
    expect(result).toBeUndefined();
  });

  it("falls back (undefined) when storyExpired is true, regardless of platform or other fields", () => {
    const resultInstagram = mapFetchPostMetricsToContentFormat(
      SocialPlatform.Instagram,
      metrics({ mediaProductType: "FEED", storyExpired: true }),
    );
    const resultFacebook = mapFetchPostMetricsToContentFormat(
      SocialPlatform.Facebook,
      metrics({ isReel: true, storyExpired: true }),
    );
    expect(resultInstagram).toBeUndefined();
    expect(resultFacebook).toBeUndefined();
  });

  it.each([
    SocialPlatform.TikTok,
    SocialPlatform.Pinterest,
    SocialPlatform.LinkedIn,
    SocialPlatform.Twitter,
    SocialPlatform.Threads,
    SocialPlatform.YouTube,
  ])(
    "falls back (undefined) for platform %s — no official Outstand signal defined yet (ADR-135)",
    (platform) => {
      const result = mapFetchPostMetricsToContentFormat(
        platform,
        metrics({ mediaProductType: "FEED", isReel: true }),
      );
      expect(result).toBeUndefined();
    },
  );
});

function importedPost(
  overrides: Partial<ImportedPostData> = {},
): ImportedPostData {
  return {
    platformPostId: "platform-post-1",
    outstandPostId: "outstand-post-1",
    caption: "caption",
    publishedAt: new Date("2026-10-01T00:00:00.000Z"),
    platformPostUrl: null,
    mediaUrls: [],
    ...overrides,
  };
}

function createFakeOutstandAdapter(
  overrides: Partial<IOutstandAdapter> = {},
): IOutstandAdapter {
  return {
    connectAccount: async () => ({ redirectUrl: "/unused" }),
    resolveConnectCallback: async () => ({
      outstandAccountId: "unused",
      platform: SocialPlatform.Instagram,
      handle: "unused",
      status: "active",
    }),
    listPendingFacebookPages: async () => ({ pages: [] }),
    confirmFacebookPagesConnection: async () => ({ accounts: [] }),
    listPinterestBoards: async () => [],
    uploadMediaWorkingCopy: async () => ({
      outstandMediaId: "unused",
      outstandMediaUrl: "https://fake.outstand.local/media/unused",
      expiresAt: new Date(),
    }),
    schedulePost: async () => ({ outstandPostId: "unused" }),
    publishNow: async () => ({ outstandPostId: "unused" }),
    fetchPostOutcome: async () => [],
    cancelScheduledPost: async () => undefined,
    deletePost: async () => undefined,
    fetchPostMetrics: async () => metrics(),
    fetchWorkspaceMetrics: async () => ({
      totalPosts: 0,
      totalReach: 0,
      totalEngagements: 0,
      avgEngagementRate: 0,
    }),
    fetchComments: async () => ({ comments: [] }),
    replyToComment: async () => ({ outstandReplyId: "unused" }),
    importPosts: async () => ({ importJobId: "unused" }),
    fetchImportJobStatus: async () => ({
      status: "completed",
      posts: [],
      error: null,
    }),
    fetchAllPostIdMappings: async () => ({
      mappings: [],
      complete: true,
      shapeDrift: false,
    }),
    ...overrides,
  };
}

function createFakeRepository(
  overrides: Partial<IPublishingRepository> = {},
): IPublishingRepository {
  return {
    classifyImportedPostTargets: async () => ({ updatedCount: 0 }),
    ...overrides,
  } as IPublishingRepository;
}

describe("ClassifyImportedPostTargetsUseCase.classifyBatch (T-132.4, ADR-135)", () => {
  it("returns classifiedCount 0 and never calls the repository when posts is empty", async () => {
    const classify = vi.fn(async () => ({ updatedCount: 0 }));
    const repository = createFakeRepository({
      classifyImportedPostTargets: classify,
    });
    const useCase = new ClassifyImportedPostTargetsUseCase(
      repository,
      createFakeOutstandAdapter(),
    );

    const result = await useCase.classifyBatch({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      posts: [],
      actingUserId: ACTING_USER_ID,
    });

    expect(result).toEqual({ classifiedCount: 0 });
    expect(classify).not.toHaveBeenCalled();
  });

  it("skips posts without an outstandPostId (no id to call fetchPostMetrics with)", async () => {
    const fetchPostMetrics = vi.fn(async () =>
      metrics({ mediaProductType: "FEED" }),
    );
    const classify = vi.fn(async () => ({ updatedCount: 0 }));
    const useCase = new ClassifyImportedPostTargetsUseCase(
      createFakeRepository({ classifyImportedPostTargets: classify }),
      createFakeOutstandAdapter({ fetchPostMetrics }),
    );

    const result = await useCase.classifyBatch({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      posts: [importedPost({ outstandPostId: null })],
      actingUserId: ACTING_USER_ID,
    });

    expect(result).toEqual({ classifiedCount: 0 });
    expect(fetchPostMetrics).not.toHaveBeenCalled();
    expect(classify).not.toHaveBeenCalled();
  });

  it("calls fetchPostMetrics per post and forwards classified updates to the repository", async () => {
    const fetchPostMetrics = vi.fn(async (outstandPostId: string) =>
      outstandPostId === "outstand-1"
        ? metrics({ mediaProductType: "REELS" })
        : metrics({ mediaProductType: "FEED" }),
    );
    let receivedUpdates: ClassifyImportedPostTargetUpdate[] = [];
    const classify = vi.fn(async (input) => {
      receivedUpdates = input.updates;
      return { updatedCount: input.updates.length };
    });
    const useCase = new ClassifyImportedPostTargetsUseCase(
      createFakeRepository({ classifyImportedPostTargets: classify }),
      createFakeOutstandAdapter({ fetchPostMetrics }),
    );

    const result = await useCase.classifyBatch({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      posts: [
        importedPost({ platformPostId: "pp-1", outstandPostId: "outstand-1" }),
        importedPost({ platformPostId: "pp-2", outstandPostId: "outstand-2" }),
      ],
      actingUserId: ACTING_USER_ID,
    });

    expect(fetchPostMetrics).toHaveBeenCalledTimes(2);
    expect(fetchPostMetrics).toHaveBeenCalledWith("outstand-1");
    expect(fetchPostMetrics).toHaveBeenCalledWith("outstand-2");
    expect(receivedUpdates).toEqual([
      { platformPostId: "pp-1", contentFormat: ContentFormat.Reel },
      { platformPostId: "pp-2", contentFormat: ContentFormat.Post },
    ]);
    expect(classify).toHaveBeenCalledWith(
      {
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        updates: receivedUpdates,
      },
      ACTING_USER_ID,
    );
    expect(result).toEqual({ classifiedCount: 2 });
  });

  it("does not call the repository at all when every post in the batch falls back (no signal)", async () => {
    const classify = vi.fn(async () => ({ updatedCount: 0 }));
    const useCase = new ClassifyImportedPostTargetsUseCase(
      createFakeRepository({ classifyImportedPostTargets: classify }),
      createFakeOutstandAdapter({ fetchPostMetrics: async () => metrics({}) }),
    );

    const result = await useCase.classifyBatch({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      posts: [importedPost()],
      actingUserId: ACTING_USER_ID,
    });

    expect(result).toEqual({ classifiedCount: 0 });
    expect(classify).not.toHaveBeenCalled();
  });

  it("is best-effort per post — one fetchPostMetrics failure does not stop classification of the rest of the batch", async () => {
    const fetchPostMetrics = vi.fn(async (outstandPostId: string) => {
      if (outstandPostId === "outstand-fail") {
        throw new Error("Outstand down");
      }
      return metrics({ mediaProductType: "STORY" });
    });
    let receivedUpdates: ClassifyImportedPostTargetUpdate[] = [];
    const classify = vi.fn(async (input) => {
      receivedUpdates = input.updates;
      return { updatedCount: input.updates.length };
    });
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const useCase = new ClassifyImportedPostTargetsUseCase(
      createFakeRepository({ classifyImportedPostTargets: classify }),
      createFakeOutstandAdapter({ fetchPostMetrics }),
    );

    const result = await useCase.classifyBatch({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      posts: [
        importedPost({
          platformPostId: "pp-fail",
          outstandPostId: "outstand-fail",
        }),
        importedPost({
          platformPostId: "pp-ok",
          outstandPostId: "outstand-ok",
        }),
      ],
      actingUserId: ACTING_USER_ID,
    });

    expect(result).toEqual({ classifiedCount: 1 });
    expect(receivedUpdates).toEqual([
      { platformPostId: "pp-ok", contentFormat: ContentFormat.Story },
    ]);
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it("propagates a repository failure (caller — ImportPostsTriggerUseCase — is responsible for the outer best-effort try/catch)", async () => {
    const useCase = new ClassifyImportedPostTargetsUseCase(
      createFakeRepository({
        classifyImportedPostTargets: async () => {
          throw new Error("DB down");
        },
      }),
      createFakeOutstandAdapter({
        fetchPostMetrics: async () => metrics({ mediaProductType: "FEED" }),
      }),
    );

    await expect(
      useCase.classifyBatch({
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        platform: SocialPlatform.Instagram,
        posts: [importedPost()],
        actingUserId: ACTING_USER_ID,
      }),
    ).rejects.toThrow("DB down");
  });
});
