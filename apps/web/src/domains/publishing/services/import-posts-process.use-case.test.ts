import {
  asConnectedAccountId,
  asUserId,
  asWorkspaceId,
  SocialPlatform,
} from "@postific/shared";
import type { ImportedPostData } from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import type {
  ImportedPostTargetInput,
  IPublishingRepository,
  UpsertImportedPostsResult,
} from "../repositories/publishing.repository";
import { ImportPostsProcessUseCase } from "./import-posts-process.use-case";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const CONNECTED_ACCOUNT_ID = asConnectedAccountId("account-1");
const ACTING_USER_ID = asUserId("user-1");

function buildImportedPostData(
  overrides: Partial<ImportedPostData> = {},
): ImportedPostData {
  return {
    platformPostId: "platform-post-1",
    caption: "Halo dunia",
    publishedAt: new Date("2026-09-01T00:00:00Z"),
    platformPostUrl: "https://instagram.com/p/xyz",
    mediaUrls: [],
    ...overrides,
  };
}

describe("ImportPostsProcessUseCase (T-090.4, ADR-093 poin 3-4, 7)", () => {
  it("maps ImportedPostData[] to ImportedPostTargetInput[] with the account's platform and delegates to repository.upsertImportedPosts", async () => {
    let received: {
      workspaceId: typeof WORKSPACE_ID;
      posts: ImportedPostTargetInput[];
    } | null = null;

    const repository = {
      upsertImportedPosts: vi.fn(
        async (input: {
          workspaceId: typeof WORKSPACE_ID;
          posts: ImportedPostTargetInput[];
        }): Promise<UpsertImportedPostsResult> => {
          received = input;
          return {
            insertedCount: input.posts.length,
            skippedDuplicateCount: 0,
          };
        },
      ),
    } as unknown as IPublishingRepository;

    const useCase = new ImportPostsProcessUseCase(repository);

    const posts = [
      buildImportedPostData({ platformPostId: "p-1" }),
      buildImportedPostData({
        platformPostId: "p-2",
        mediaUrls: ["https://x/1.jpg"],
      }),
    ];

    const result = await useCase.process({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      posts,
      actingUserId: ACTING_USER_ID,
    });

    expect(result).toEqual({ insertedCount: 2, skippedDuplicateCount: 0 });
    expect(received).not.toBeNull();
    expect(received!.workspaceId).toBe(WORKSPACE_ID);
    expect(received!.posts).toHaveLength(2);
    for (const target of received!.posts) {
      expect(target.connectedAccountId).toBe(CONNECTED_ACCOUNT_ID);
      expect(target.platform).toBe(SocialPlatform.Instagram);
    }
    expect(received!.posts[1]!.mediaUrls).toEqual(["https://x/1.jpg"]);

    expect(repository.upsertImportedPosts).toHaveBeenCalledWith(
      expect.anything(),
      ACTING_USER_ID,
    );
  });

  it("returns an empty upsert call when posts is empty (no-op, repository still invoked)", async () => {
    const repository = {
      upsertImportedPosts: vi.fn(async () => ({
        insertedCount: 0,
        skippedDuplicateCount: 0,
      })),
    } as unknown as IPublishingRepository;
    const useCase = new ImportPostsProcessUseCase(repository);

    const result = await useCase.process({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      posts: [],
      actingUserId: ACTING_USER_ID,
    });

    expect(result).toEqual({ insertedCount: 0, skippedDuplicateCount: 0 });
  });
});
