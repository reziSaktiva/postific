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

type SeededTarget = {
  postId: string;
  platformPostId: string | null;
  connectedAccountId: string;
  workspaceId: string;
  postStatus: string;
  postOutstandPostId: string | null;
  postDeletedAt: Date | null;
};

type GlobalOwner = {
  outstandPostId: string;
  postId: string;
  workspaceId: string;
  connectedAccountId: string;
};

/**
 * Fake `tx` — hanya mengimplementasikan method Prisma yang dipakai
 * `backfillImportedPostOutstandIdsTx`. `selectUsesSeedOutstandPostId`
 * membuat SELECT tetap melihat nilai seed (null) sementara UPDATE melihat
 * nilai live — simulasi race antara SELECT dan UPDATE.
 */
function createStore(
  seededTargets: SeededTarget[],
  options: {
    globalOwners?: GlobalOwner[];
    selectUsesSeedOutstandPostId?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const postOutstandPostIds = new Map<string, string | null>();
  const postSkippedAt = new Map<string, Date | null>();
  const postWorkspaceIds = new Map<string, string>();
  for (const target of seededTargets) {
    if (!postOutstandPostIds.has(target.postId)) {
      postOutstandPostIds.set(target.postId, target.postOutstandPostId);
      postSkippedAt.set(target.postId, null);
      postWorkspaceIds.set(target.postId, target.workspaceId);
    }
  }
  const updateCalls: { id: string; outstandPostId: string }[] = [];
  const skipCalls: { id: string }[] = [];

  function visibleOutstandPostId(target: SeededTarget): string | null {
    if (options.selectUsesSeedOutstandPostId) return target.postOutstandPostId;
    return postOutstandPostIds.get(target.postId) ?? null;
  }

  const tx = {
    $executeRaw: async (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => {
      const sql = strings.join("?");
      calls.push(
        sql.includes("publishing.outstand_post_id")
          ? `post-lock:${String(values[0])}`
          : `lock:${String(values[0])}`,
      );
      return 1;
    },
    $queryRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const outstandPostId = String(values[0]);
      calls.push(`global:${outstandPostId}`);
      return (options.globalOwners ?? [])
        .filter((row) => row.outstandPostId === outstandPostId)
        .map((row) => ({
          post_id: row.postId,
          workspace_id: row.workspaceId,
          connected_account_id: row.connectedAccountId,
        }));
    },
    publishingPostTarget: {
      findMany: async (args: {
        where: {
          connectedAccountId: string;
          post: {
            workspaceId: string;
            status: string;
            outstandPostId: null;
            deletedAt: null;
            outstandIdBackfillSkippedAt: null;
          };
        };
      }) => {
        calls.push("target.findMany");
        return seededTargets
          .filter((target) => {
            const skippedAt = postSkippedAt.get(target.postId) ?? null;
            return (
              target.connectedAccountId === args.where.connectedAccountId &&
              target.workspaceId === args.where.post.workspaceId &&
              target.postStatus === args.where.post.status &&
              visibleOutstandPostId(target) === null &&
              target.postDeletedAt === null &&
              skippedAt === null
            );
          })
          .map((target) => ({
            postId: target.postId,
            platformPostId: target.platformPostId,
          }));
      },
    },
    publishingPost: {
      findMany: async (args: {
        where: { outstandPostId: { in: string[] }; deletedAt: null };
      }) => {
        calls.push("post.findMany");
        const wanted = new Set(args.where.outstandPostId.in);
        const rows: {
          id: string;
          workspaceId: string;
          outstandPostId: string;
        }[] = [];
        for (const [postId, outstandPostId] of postOutstandPostIds) {
          if (outstandPostId && wanted.has(outstandPostId)) {
            rows.push({
              id: postId,
              workspaceId: postWorkspaceIds.get(postId) ?? WORKSPACE_ID,
              outstandPostId,
            });
          }
        }
        return rows;
      },
      updateMany: async (args: {
        where: {
          id: string;
          workspaceId: string;
          outstandPostId: null;
          deletedAt: null;
          outstandIdBackfillSkippedAt: null;
        };
        data: { outstandPostId?: string; outstandIdBackfillSkippedAt?: Date };
      }) => {
        calls.push("post.updateMany");
        if (args.where.workspaceId !== postWorkspaceIds.get(args.where.id)) {
          return { count: 0 };
        }
        const current = postOutstandPostIds.get(args.where.id);
        const skippedAt = postSkippedAt.get(args.where.id) ?? null;
        if (current !== null && current !== undefined) return { count: 0 };
        if (skippedAt !== null) return { count: 0 };

        if (args.data.outstandIdBackfillSkippedAt) {
          postSkippedAt.set(
            args.where.id,
            args.data.outstandIdBackfillSkippedAt,
          );
          skipCalls.push({ id: args.where.id });
          return { count: 1 };
        }

        const nextId = args.data.outstandPostId;
        if (!nextId) return { count: 0 };
        for (const [postId, existing] of postOutstandPostIds) {
          if (postId !== args.where.id && existing === nextId) {
            throw new Error(
              `unique violation: ${nextId} already owned by ${postId}`,
            );
          }
        }
        postOutstandPostIds.set(args.where.id, nextId);
        updateCalls.push({ id: args.where.id, outstandPostId: nextId });
        return { count: 1 };
      },
    },
  };

  return {
    tx,
    calls,
    updateCalls,
    skipCalls,
    postOutstandPostIds,
    postSkippedAt,
  };
}

function importedTarget(
  overrides: Partial<SeededTarget> &
    Pick<SeededTarget, "postId" | "platformPostId">,
): SeededTarget {
  return {
    connectedAccountId: CONNECTED_ACCOUNT_ID,
    workspaceId: WORKSPACE_ID,
    postStatus: "imported",
    postOutstandPostId: null,
    postDeletedAt: null,
    ...overrides,
  };
}

describe("backfillImportedPostOutstandIdsTx (T-114)", () => {
  it("complete empty history marks every remaining gap row skipped", async () => {
    const { tx, skipCalls, updateCalls } = createStore([
      importedTarget({ postId: "post-a", platformPostId: "platform-a" }),
      importedTarget({ postId: "post-b", platformPostId: "platform-b" }),
    ]);

    const result = await backfillImportedPostOutstandIdsTx(
      tx as never,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [],
      true,
    );

    expect(result).toEqual({ updatedCount: 0, skippedCount: 2 });
    expect(updateCalls).toEqual([]);
    expect(skipCalls.map((call) => call.id).sort()).toEqual([
      "post-a",
      "post-b",
    ]);
  });

  it("returns updatedCount 0 immediately without touching tx when mappings is empty", async () => {
    const { tx, calls } = createStore([]);

    const result = await backfillImportedPostOutstandIdsTx(
      tx as never,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [],
      false,
    );

    expect(result).toEqual({ updatedCount: 0, skippedCount: 0 });
    expect(calls).toEqual([]);
  });

  it("updates a matching Imported row and marks an unmatched platformPostId as skipped", async () => {
    const { tx, updateCalls, skipCalls } = createStore([
      importedTarget({ postId: "post-a", platformPostId: "platform-a" }),
      importedTarget({
        postId: "post-b",
        platformPostId: "platform-b",
        postOutstandPostId: "outstand-already-set",
      }),
      importedTarget({
        postId: "post-c",
        platformPostId: "platform-no-mapping",
      }),
    ]);

    const result = await backfillImportedPostOutstandIdsTx(
      tx as never,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [
        mapping({ platformPostId: "platform-a", outstandPostId: "outstand-a" }),
        mapping({ platformPostId: "platform-b", outstandPostId: "outstand-b" }),
      ],
      true,
    );

    expect(result).toEqual({ updatedCount: 1, skippedCount: 1 });
    expect(updateCalls).toEqual([
      { id: "post-a", outstandPostId: "outstand-a" },
    ]);
    expect(skipCalls).toEqual([{ id: "post-c" }]);
  });

  it("acquires the workspace lock first, then per-outstandPostId locks in sorted order, before any update", async () => {
    const { tx, calls } = createStore([
      importedTarget({ postId: "post-b", platformPostId: "platform-b" }),
      importedTarget({ postId: "post-a", platformPostId: "platform-a" }),
    ]);

    await backfillImportedPostOutstandIdsTx(
      tx as never,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [
        mapping({ platformPostId: "platform-b", outstandPostId: "outstand-b" }),
        mapping({ platformPostId: "platform-a", outstandPostId: "outstand-a" }),
      ],
      true,
    );

    const updateAt = calls.indexOf("post.updateMany");
    expect(calls[0]).toBe(`lock:${WORKSPACE_ID}`);
    expect(calls.indexOf(`lock:${WORKSPACE_ID}`)).toBeLessThan(
      calls.indexOf("target.findMany"),
    );
    expect(calls.indexOf("post-lock:outstand-a")).toBeLessThan(
      calls.indexOf("post-lock:outstand-b"),
    );
    expect(calls.indexOf("post-lock:outstand-b")).toBeLessThan(updateAt);
    expect(calls.indexOf("global:outstand-a")).toBeLessThan(updateAt);
  });

  it("second idempotent guard: a row that becomes non-null between SELECT and UPDATE is skipped, not overwritten", async () => {
    const { tx, postOutstandPostIds } = createStore(
      [importedTarget({ postId: "post-a", platformPostId: "platform-a" })],
      { selectUsesSeedOutstandPostId: true },
    );
    postOutstandPostIds.set("post-a", "outstand-from-concurrent-import");

    const result = await backfillImportedPostOutstandIdsTx(
      tx as never,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [mapping({ platformPostId: "platform-a", outstandPostId: "outstand-a" })],
      true,
    );

    expect(result).toEqual({ updatedCount: 0, skippedCount: 0 });
    expect(postOutstandPostIds.get("post-a")).toBe(
      "outstand-from-concurrent-import",
    );
  });

  it("a global owner of the same outstandPostId does not abort the batch — that row is skipped and the other row is still updated", async () => {
    const { tx, updateCalls, skipCalls } = createStore(
      [
        importedTarget({ postId: "post-a", platformPostId: "platform-a" }),
        importedTarget({ postId: "post-b", platformPostId: "platform-b" }),
      ],
      {
        globalOwners: [
          {
            outstandPostId: "outstand-taken",
            postId: "post-other-workspace",
            workspaceId: "workspace-2",
            connectedAccountId: "account-2",
          },
        ],
      },
    );

    const result = await backfillImportedPostOutstandIdsTx(
      tx as never,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [
        mapping({
          platformPostId: "platform-a",
          outstandPostId: "outstand-taken",
        }),
        mapping({
          platformPostId: "platform-b",
          outstandPostId: "outstand-free",
        }),
      ],
      true,
    );

    expect(result).toEqual({ updatedCount: 1, skippedCount: 1 });
    expect(updateCalls).toEqual([
      { id: "post-b", outstandPostId: "outstand-free" },
    ]);
    expect(skipCalls).toEqual([{ id: "post-a" }]);
  });

  it("two local posts that map to the same outstandPostId — the first is written, the second is skipped, and the unique index is not hit", async () => {
    const { tx, updateCalls, skipCalls, postOutstandPostIds } = createStore([
      importedTarget({ postId: "post-a", platformPostId: "platform-a" }),
      importedTarget({ postId: "post-b", platformPostId: "platform-b" }),
    ]);

    const result = await backfillImportedPostOutstandIdsTx(
      tx as never,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [
        mapping({
          platformPostId: "platform-a",
          outstandPostId: "outstand-shared",
        }),
        mapping({
          platformPostId: "platform-b",
          outstandPostId: "outstand-shared",
        }),
      ],
      true,
    );

    expect(result).toEqual({ updatedCount: 1, skippedCount: 1 });
    expect(updateCalls).toEqual([
      { id: "post-a", outstandPostId: "outstand-shared" },
    ]);
    expect(skipCalls).toEqual([{ id: "post-b" }]);
    expect(postOutstandPostIds.get("post-b")).toBeNull();
  });

  it("a null platformPostId and a platformPostId missing from the history are marked skipped and are not selected again", async () => {
    const store = createStore([
      importedTarget({ postId: "post-null", platformPostId: null }),
      importedTarget({ postId: "post-gone", platformPostId: "platform-gone" }),
      importedTarget({ postId: "post-ok", platformPostId: "platform-ok" }),
    ]);

    const first = await backfillImportedPostOutstandIdsTx(
      store.tx as never,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [
        mapping({
          platformPostId: "platform-ok",
          outstandPostId: "outstand-ok",
        }),
      ],
      true,
    );

    expect(first).toEqual({ updatedCount: 1, skippedCount: 2 });
    expect(store.skipCalls.map((call) => call.id).sort()).toEqual([
      "post-gone",
      "post-null",
    ]);

    const callsBeforeSecondPass = store.calls.length;
    const second = await backfillImportedPostOutstandIdsTx(
      store.tx as never,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [
        mapping({
          platformPostId: "platform-ok",
          outstandPostId: "outstand-ok",
        }),
        mapping({
          platformPostId: "platform-gone",
          outstandPostId: "outstand-late",
        }),
      ],
      true,
    );

    expect(second).toEqual({ updatedCount: 0, skippedCount: 0 });
    expect(store.calls.slice(callsBeforeSecondPass)).toEqual([
      `lock:${WORKSPACE_ID}`,
      "target.findMany",
    ]);
    expect(store.postSkippedAt.get("post-gone")).toBeInstanceOf(Date);
    expect(store.postOutstandPostIds.get("post-gone")).toBeNull();
  });

  it("incomplete history still writes a free id and skips a collided id, but leaves a not-yet-seen platformPostId unmarked", async () => {
    const { tx, updateCalls, skipCalls, postSkippedAt } = createStore(
      [
        importedTarget({
          postId: "post-free",
          platformPostId: "platform-free",
        }),
        importedTarget({
          postId: "post-taken",
          platformPostId: "platform-taken",
        }),
        importedTarget({
          postId: "post-later",
          platformPostId: "platform-later",
        }),
      ],
      {
        globalOwners: [
          {
            outstandPostId: "outstand-taken",
            postId: "post-owner",
            workspaceId: "workspace-2",
            connectedAccountId: "account-2",
          },
        ],
      },
    );

    const result = await backfillImportedPostOutstandIdsTx(
      tx as never,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [
        mapping({
          platformPostId: "platform-free",
          outstandPostId: "outstand-free",
        }),
        mapping({
          platformPostId: "platform-taken",
          outstandPostId: "outstand-taken",
        }),
      ],
      false,
    );

    expect(result).toEqual({ updatedCount: 1, skippedCount: 1 });
    expect(updateCalls).toEqual([
      { id: "post-free", outstandPostId: "outstand-free" },
    ]);
    expect(skipCalls).toEqual([{ id: "post-taken" }]);
    expect(postSkippedAt.get("post-later")).toBeNull();
  });
});
