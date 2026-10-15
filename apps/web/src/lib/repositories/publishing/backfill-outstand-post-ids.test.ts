import {
  asConnectedAccountId,
  asWorkspaceId,
  type OutstandPostIdMapping,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import { backfillImportedPostOutstandIdsTx } from "./backfill-outstand-post-ids";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const CONNECTED_ACCOUNT_ID = asConnectedAccountId("account-1");

function mapping(
  overrides: Partial<OutstandPostIdMapping> = {},
): OutstandPostIdMapping {
  return {
    platformPostId: "platform-post-1",
    outstandPostId: "outstand-post-1",
    ...overrides,
  };
}

/**
 * Fake `tx` — hanya mengimplementasikan method Prisma yang dipakai
 * `backfillImportedPostOutstandIdsTx`, pola sama `createStore` di
 * `upsert-imported-posts.test.ts`. `targets` adalah baris
 * `PublishingPostTarget` yang "sudah ada" di DB (milik post Imported
 * dengan `outstandPostId` null, kecuali diubah lewat `postOutstandPostId`).
 * `calls` merekam urutan pemanggilan (termasuk lock) supaya bisa
 * diverifikasi lock diambil SEBELUM SELECT/UPDATE mana pun.
 */
function createStore(
  seededTargets: {
    postId: string;
    platformPostId: string | null;
    connectedAccountId: string;
    workspaceId: string;
    postStatus: string;
    postOutstandPostId: string | null;
    postDeletedAt: Date | null;
  }[],
) {
  const calls: string[] = [];
  const postOutstandPostIds = new Map<string, string | null>();
  for (const target of seededTargets) {
    if (!postOutstandPostIds.has(target.postId)) {
      postOutstandPostIds.set(target.postId, target.postOutstandPostId);
    }
  }
  const updateCalls: { id: string; outstandPostId: string }[] = [];

  const tx = {
    $executeRaw: async (
      _strings: TemplateStringsArray,
      ...values: unknown[]
    ) => {
      calls.push(`lock:${String(values[0])}`);
      return 1;
    },
    publishingPostTarget: {
      findMany: async (args: {
        where: {
          connectedAccountId: string;
          platformPostId: { in: string[] };
          post: {
            workspaceId: string;
            status: string;
            outstandPostId: null;
            deletedAt: null;
          };
        };
      }) => {
        calls.push("target.findMany");
        const wantedPlatformPostIds = new Set(args.where.platformPostId.in);
        return seededTargets
          .filter(
            (target) =>
              target.connectedAccountId === args.where.connectedAccountId &&
              target.platformPostId !== null &&
              wantedPlatformPostIds.has(target.platformPostId) &&
              target.workspaceId === args.where.post.workspaceId &&
              target.postStatus === args.where.post.status &&
              target.postOutstandPostId === null &&
              target.postDeletedAt === null,
          )
          .map((target) => ({
            postId: target.postId,
            platformPostId: target.platformPostId,
          }));
      },
    },
    publishingPost: {
      updateMany: async (args: {
        where: { id: string; outstandPostId: null };
        data: { outstandPostId: string };
      }) => {
        calls.push("post.updateMany");
        const current = postOutstandPostIds.get(args.where.id);
        if (current !== null && current !== undefined) {
          // Simulasi `WHERE outstandPostId: null` — sudah terisi, no-op.
          return { count: 0 };
        }
        postOutstandPostIds.set(args.where.id, args.data.outstandPostId);
        updateCalls.push({
          id: args.where.id,
          outstandPostId: args.data.outstandPostId,
        });
        return { count: 1 };
      },
    },
  };

  return { tx, calls, updateCalls, postOutstandPostIds };
}

describe("backfillImportedPostOutstandIdsTx (T-114)", () => {
  it("returns updatedCount 0 immediately without touching tx when mappings is empty", async () => {
    const { tx, calls } = createStore([]);

    const result = await backfillImportedPostOutstandIdsTx(
      tx as never,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [],
    );

    expect(result).toEqual({ updatedCount: 0 });
    expect(calls).toEqual([]);
  });

  it("updates only PublishingPost rows whose platformPostId matches a mapping AND whose post is Imported with outstandPostId still null", async () => {
    const { tx, updateCalls } = createStore([
      {
        postId: "post-a",
        platformPostId: "platform-a",
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        workspaceId: WORKSPACE_ID,
        postStatus: "imported",
        postOutstandPostId: null,
        postDeletedAt: null,
      },
      {
        // Already backfilled (outstandPostId sudah terisi) — TIDAK ikut
        // query SELECT (filter `outstandPostId: null` di `where.post`).
        postId: "post-b",
        platformPostId: "platform-b",
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        workspaceId: WORKSPACE_ID,
        postStatus: "imported",
        postOutstandPostId: "outstand-already-set",
        postDeletedAt: null,
      },
      {
        // Outstand tidak mengembalikan mapping untuk platformPostId ini —
        // dibiarkan apa adanya, bukan error.
        postId: "post-c",
        platformPostId: "platform-no-mapping",
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        workspaceId: WORKSPACE_ID,
        postStatus: "imported",
        postOutstandPostId: null,
        postDeletedAt: null,
      },
    ]);

    const result = await backfillImportedPostOutstandIdsTx(
      tx as never,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [
        mapping({ platformPostId: "platform-a", outstandPostId: "outstand-a" }),
        mapping({ platformPostId: "platform-b", outstandPostId: "outstand-b" }),
      ],
    );

    expect(result).toEqual({ updatedCount: 1 });
    expect(updateCalls).toEqual([
      { id: "post-a", outstandPostId: "outstand-a" },
    ]);
  });

  it("acquires the SAME advisory-lock namespace as upsertImportedPostsTx (hashtext(workspaceId)) as the FIRST statement", async () => {
    const { tx, calls } = createStore([
      {
        postId: "post-a",
        platformPostId: "platform-a",
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        workspaceId: WORKSPACE_ID,
        postStatus: "imported",
        postOutstandPostId: null,
        postDeletedAt: null,
      },
    ]);

    await backfillImportedPostOutstandIdsTx(
      tx as never,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [mapping({ platformPostId: "platform-a" })],
    );

    expect(calls[0]).toBe(`lock:${WORKSPACE_ID}`);
    expect(calls.indexOf(`lock:${WORKSPACE_ID}`)).toBeLessThan(
      calls.indexOf("target.findMany"),
    );
  });

  it("second idempotent guard: a row that becomes non-null between SELECT and UPDATE (race) is skipped, not double-counted", async () => {
    const { tx, postOutstandPostIds } = createStore([
      {
        postId: "post-a",
        platformPostId: "platform-a",
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        workspaceId: WORKSPACE_ID,
        postStatus: "imported",
        postOutstandPostId: null,
        postDeletedAt: null,
      },
    ]);
    // Simulasikan race: antara SELECT dan UPDATE, baris ini SUDAH terisi
    // (mis. import baru yang sedang berjalan bersamaan) — guard kedua di
    // `publishingPost.updateMany` (`WHERE outstandPostId: null`) harus
    // membuat update ini no-op, bukan menimpa nilai yang sudah ada.
    postOutstandPostIds.set("post-a", "outstand-from-concurrent-import");

    const result = await backfillImportedPostOutstandIdsTx(
      tx as never,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [mapping({ platformPostId: "platform-a", outstandPostId: "outstand-a" })],
    );

    expect(result).toEqual({ updatedCount: 0 });
    expect(postOutstandPostIds.get("post-a")).toBe(
      "outstand-from-concurrent-import",
    );
  });
});
