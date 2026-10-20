import {
  asConnectedAccountId,
  asWorkspaceId,
  ContentFormat,
} from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import { classifyImportedPostTargetsTx } from "./classify-imported-post-targets";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const CONNECTED_ACCOUNT_ID = asConnectedAccountId("account-1");

/**
 * Fake `tx` — hanya mengimplementasikan `publishingPostTarget.updateMany`,
 * satu-satunya method Prisma yang dipakai `classifyImportedPostTargetsTx`
 * (pola sama `backfill-outstand-post-ids.test.ts`, tapi jauh lebih sederhana
 * karena fungsi ini murni `UPDATE`, tanpa lock/`findMany`).
 */
function createFakeTx(
  seededTargets: Array<{
    connectedAccountId: string;
    platformPostId: string;
    workspaceId: string;
    deletedAt: Date | null;
  }>,
) {
  const updateManyCalls: unknown[] = [];
  const contentFormatByKey = new Map<string, string>();

  return {
    tx: {
      publishingPostTarget: {
        updateMany: vi.fn(
          async ({
            where,
            data,
          }: {
            where: {
              connectedAccountId: string;
              platformPostId: string;
              post: { workspaceId: string; deletedAt: null };
            };
            data: { contentFormat: ContentFormat };
          }) => {
            updateManyCalls.push({ where, data });
            const matches = seededTargets.filter(
              (target) =>
                target.connectedAccountId === where.connectedAccountId &&
                target.platformPostId === where.platformPostId &&
                target.workspaceId === where.post.workspaceId &&
                target.deletedAt === null,
            );
            for (const match of matches) {
              contentFormatByKey.set(
                `${match.connectedAccountId}:${match.platformPostId}`,
                data.contentFormat,
              );
            }
            return { count: matches.length };
          },
        ),
      },
    } as never,
    updateManyCalls,
    contentFormatByKey,
  };
}

describe("classifyImportedPostTargetsTx (T-132.4, ADR-135)", () => {
  it("returns updatedCount 0 immediately without touching tx when updates is empty", async () => {
    const { tx, updateManyCalls } = createFakeTx([]);

    const result = await classifyImportedPostTargetsTx(
      tx,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [],
    );

    expect(result).toEqual({ updatedCount: 0 });
    expect(updateManyCalls).toHaveLength(0);
  });

  it("updates PublishingPostTarget.contentFormat for a matching (connectedAccountId, platformPostId) row", async () => {
    const { tx, contentFormatByKey } = createFakeTx([
      {
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        platformPostId: "platform-post-1",
        workspaceId: WORKSPACE_ID,
        deletedAt: null,
      },
    ]);

    const result = await classifyImportedPostTargetsTx(
      tx,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [
        {
          platformPostId: "platform-post-1",
          contentFormat: ContentFormat.Reel,
        },
      ],
    );

    expect(result).toEqual({ updatedCount: 1 });
    expect(
      contentFormatByKey.get(`${CONNECTED_ACCOUNT_ID}:platform-post-1`),
    ).toBe(ContentFormat.Reel);
  });

  it("processes multiple updates in the same call, summing updatedCount", async () => {
    const { tx } = createFakeTx([
      {
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        platformPostId: "platform-post-1",
        workspaceId: WORKSPACE_ID,
        deletedAt: null,
      },
      {
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        platformPostId: "platform-post-2",
        workspaceId: WORKSPACE_ID,
        deletedAt: null,
      },
    ]);

    const result = await classifyImportedPostTargetsTx(
      tx,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [
        {
          platformPostId: "platform-post-1",
          contentFormat: ContentFormat.Reel,
        },
        {
          platformPostId: "platform-post-2",
          contentFormat: ContentFormat.Story,
        },
      ],
    );

    expect(result).toEqual({ updatedCount: 2 });
  });

  it("silently skips (does not throw) when platformPostId is not found for this connectedAccountId", async () => {
    const { tx } = createFakeTx([]);

    const result = await classifyImportedPostTargetsTx(
      tx,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [
        {
          platformPostId: "unknown-platform-post",
          contentFormat: ContentFormat.Post,
        },
      ],
    );

    expect(result).toEqual({ updatedCount: 0 });
  });

  it("does not match a row belonging to a different connectedAccountId (scoped update)", async () => {
    const { tx } = createFakeTx([
      {
        connectedAccountId: "other-account",
        platformPostId: "platform-post-1",
        workspaceId: WORKSPACE_ID,
        deletedAt: null,
      },
    ]);

    const result = await classifyImportedPostTargetsTx(
      tx,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [
        {
          platformPostId: "platform-post-1",
          contentFormat: ContentFormat.Reel,
        },
      ],
    );

    expect(result).toEqual({ updatedCount: 0 });
  });

  it("does not match a soft-deleted post (deletedAt not null)", async () => {
    const { tx } = createFakeTx([
      {
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        platformPostId: "platform-post-1",
        workspaceId: WORKSPACE_ID,
        deletedAt: new Date(),
      },
    ]);

    const result = await classifyImportedPostTargetsTx(
      tx,
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      [
        {
          platformPostId: "platform-post-1",
          contentFormat: ContentFormat.Reel,
        },
      ],
    );

    expect(result).toEqual({ updatedCount: 0 });
  });
});
