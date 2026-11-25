import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  asConnectedAccountId,
  asPageCursor,
  asUserId,
  asWorkspaceId,
  ContentFormat,
  ContentStatus,
  MemberRole,
  MemberStatus,
  PostCreatedVia,
  SocialPlatform,
  type PageCursor,
  type UserId,
  type WorkspaceId,
} from "@postific/shared";

import {
  InvalidPageCursorError,
  type PublishPostSelection,
} from "@/domains/publishing";
import type { prisma as prismaClient } from "@/lib/prisma/client";

/**
 * T-302 (S-009) on a real Postgres: the keyset pages of `listPostPage` and
 * the totals of `countPosts`. Covers posts with the same sort time across a
 * page edge, times that differ below a millisecond, each order, the source
 * and channel filters, and a bad cursor.
 *
 * Opt-in like the other DB integration tests: needs a real `DATABASE_URL`
 * AND `PUBLISHING_PAGE_DB_TEST=1`; otherwise the suite is skipped. Fixtures
 * use a random suffix, are removed in `afterAll` through the workspace
 * cascade, and the test FAILS when anything is left.
 */
const enabled =
  Boolean(process.env.DATABASE_URL) &&
  process.env.SKIP_ENV_VALIDATION !== "1" &&
  process.env.PUBLISHING_PAGE_DB_TEST === "1";

describe.skipIf(!enabled)(
  "publishingRepository listPostPage and countPosts (Postgres, T-302)",
  () => {
    const suffix = randomUUID().slice(0, 8);
    const prefix = `t-page-${suffix}`;
    const owner: UserId = asUserId(`${prefix}-owner`);

    let prisma: typeof prismaClient;
    let withCurrentUser: typeof import("@/lib/prisma/with-current-user").withCurrentUser;
    let repo: typeof import("@/lib/repositories/publishing").publishingRepository;
    let workspace: WorkspaceId;
    let accountA: string;
    let accountB: string;

    async function createPost(input: {
      status: ContentStatus;
      /** Postgres timestamptz text, microseconds allowed. */
      updatedAt: string;
      scheduledAt?: string;
      publishedAt?: string;
      createdVia?: PostCreatedVia;
      accountId?: string;
    }): Promise<string> {
      return withCurrentUser(owner, async (tx) => {
        const post = await tx.publishingPost.create({
          data: {
            workspaceId: workspace,
            authorId: input.status === ContentStatus.Imported ? null : owner,
            caption: "page test",
            status: input.status,
            createdVia: input.createdVia ?? PostCreatedVia.App,
            // CHECK `publishing_posts_created_via_check` (T-152): an `mcp` row
            // must name its AI client; `clientId` has no FK.
            createdViaClientId:
              input.createdVia === PostCreatedVia.Mcp
                ? "t302-page-test-client"
                : null,
            ...(input.accountId
              ? {
                  targets: {
                    create: {
                      connectedAccountId: input.accountId,
                      platform: SocialPlatform.Instagram,
                      contentFormat: ContentFormat.Post,
                    },
                  },
                }
              : {}),
          },
        });
        // Exact times (microseconds) are set in SQL: Prisma would keep
        // milliseconds only, and `@updatedAt` would overwrite the value.
        await tx.$executeRaw`
          UPDATE "publishing_posts"
          SET "updated_at" = ${input.updatedAt}::timestamptz,
              "scheduled_at" = ${input.scheduledAt ?? null}::timestamptz,
              "published_at" = ${input.publishedAt ?? null}::timestamptz
          WHERE "id" = ${post.id}::uuid
        `;
        return post.id;
      });
    }

    async function readAll(
      selection: PublishPostSelection,
      limit: number,
    ): Promise<string[][]> {
      const pages: string[][] = [];
      let cursor: PageCursor | null = null;
      do {
        const page = await repo.listPostPage(
          { ...selection, cursor, limit },
          owner,
        );
        pages.push(page.items.map((item) => item.id));
        cursor = page.nextCursor;
      } while (cursor && pages.length < 50);
      return pages;
    }

    const select = (
      over: Partial<PublishPostSelection>,
    ): PublishPostSelection => ({
      workspaceId: workspace,
      statuses: [ContentStatus.Draft],
      order: "updated-desc",
      ...over,
    });

    beforeAll(async () => {
      ({ prisma } = await import("@/lib/prisma/client"));
      ({ withCurrentUser } = await import("@/lib/prisma/with-current-user"));
      ({ publishingRepository: repo } =
        await import("@/lib/repositories/publishing"));

      const ws = await prisma.workspace.create({
        data: {
          name: `T-PAGE-DB-TEST ${suffix}`,
          slug: prefix,
          ownerId: owner,
        },
      });
      workspace = asWorkspaceId(ws.id);
      // createMany (no RETURNING): the member row is not visible to the
      // select policy before it exists, so `create` trips RLS.
      await prisma.workspaceMember.createMany({
        data: [
          {
            workspaceId: ws.id,
            userId: owner,
            role: MemberRole.Owner,
            status: MemberStatus.Active,
            joinedAt: new Date(),
          },
        ],
      });
      const [a, b] = await withCurrentUser(owner, (tx) =>
        Promise.all(
          ["a", "b"].map((name) =>
            tx.workspaceConnectedAccount.create({
              data: {
                workspaceId: ws.id,
                platform: SocialPlatform.Instagram,
                outstandAccountId: `${prefix}-${name}`,
                handle: `${prefix}-${name}`,
              },
            }),
          ),
        ),
      );
      accountA = a!.id;
      accountB = b!.id;
    });

    beforeEach(async () => {
      await withCurrentUser(owner, (tx) =>
        tx.publishingPost.deleteMany({ where: { workspaceId: workspace } }),
      );
    });

    afterAll(async () => {
      if (!prisma) {
        return;
      }
      if (workspace) {
        // FK cascade: members, accounts, posts, targets.
        await prisma.workspace.deleteMany({ where: { id: workspace } });
      }
      const [workspaces, members, accounts, posts] = await Promise.all([
        prisma.workspace.count({
          where: { name: { startsWith: `T-PAGE-DB-TEST ${suffix}` } },
        }),
        prisma.workspaceMember.count({
          where: { userId: { startsWith: prefix } },
        }),
        prisma.workspaceConnectedAccount.count({
          where: { outstandAccountId: { startsWith: prefix } },
        }),
        prisma.publishingPost.count({ where: { workspaceId: workspace } }),
      ]);
      const leftover = { workspaces, members, accounts, posts };
      console.info(`[page-db-test ${suffix}] leftover test data:`, leftover);
      expect(Object.values(leftover).every((count) => count === 0)).toBe(true);
    });

    it("pages posts with the same sort time across a page edge without repeats or gaps, id descending", async () => {
      const same = "2026-11-25 10:00:00.123456+00";
      const ids = await Promise.all(
        [0, 1, 2].map(() =>
          createPost({ status: ContentStatus.Draft, updatedAt: same }),
        ),
      );
      const newer = await createPost({
        status: ContentStatus.Draft,
        updatedAt: "2026-11-25 11:00:00+00",
      });

      const pages = await readAll(select({}), 2);

      expect(pages.map((page) => page.length)).toEqual([2, 2]);
      expect(pages.flat()).toEqual([newer, ...[...ids].sort().reverse()]);
    });

    it("keeps posts whose times differ below a millisecond", async () => {
      const first = await createPost({
        status: ContentStatus.Draft,
        updatedAt: "2026-11-25 10:00:00.123900+00",
      });
      const second = await createPost({
        status: ContentStatus.Draft,
        updatedAt: "2026-11-25 10:00:00.123500+00",
      });
      const third = await createPost({
        status: ContentStatus.Draft,
        updatedAt: "2026-11-25 10:00:00.123100+00",
      });

      expect((await readAll(select({}), 1)).flat()).toEqual([
        first,
        second,
        third,
      ]);
    });

    it("orders the Queue by publish time, soonest first, and leaves out posts without one", async () => {
      const later = await createPost({
        status: ContentStatus.Scheduled,
        updatedAt: "2026-11-20 00:00:00+00",
        scheduledAt: "2026-12-02 08:00:00+00",
      });
      const sooner = await createPost({
        status: ContentStatus.Scheduled,
        updatedAt: "2026-11-21 00:00:00+00",
        scheduledAt: "2026-12-01 08:00:00+00",
      });
      await createPost({
        status: ContentStatus.Scheduled,
        updatedAt: "2026-11-21 00:00:00+00",
      });
      const queue = select({
        statuses: [ContentStatus.Scheduled],
        order: "scheduled-asc",
      });

      expect((await readAll(queue, 1)).flat()).toEqual([sooner, later]);
      expect(await repo.countPosts(queue, owner)).toBe(2);
    });

    it("orders History by business time, failed posts by their failure time", async () => {
      const published = await createPost({
        status: ContentStatus.Published,
        updatedAt: "2026-11-25 12:00:00+00",
        publishedAt: "2026-11-20 08:00:00+00",
      });
      const imported = await createPost({
        status: ContentStatus.Imported,
        updatedAt: "2026-11-25 12:00:00+00",
        publishedAt: "2026-11-22 08:00:00+00",
      });
      const failed = await createPost({
        status: ContentStatus.Failed,
        updatedAt: "2026-11-21 08:00:00+00",
      });
      const history = select({
        statuses: [
          ContentStatus.Published,
          ContentStatus.Failed,
          ContentStatus.Imported,
        ],
        order: "occurred-desc",
      });

      expect((await readAll(history, 2)).flat()).toEqual([
        imported,
        failed,
        published,
      ]);
    });

    it("counts and pages with the source and channel filters", async () => {
      const mcpOnA = await createPost({
        status: ContentStatus.InReview,
        updatedAt: "2026-11-25 10:00:00+00",
        createdVia: PostCreatedVia.Mcp,
        accountId: accountA,
      });
      const appOnA = await createPost({
        status: ContentStatus.InReview,
        updatedAt: "2026-11-25 09:00:00+00",
        accountId: accountA,
      });
      const appOnB = await createPost({
        status: ContentStatus.InReview,
        updatedAt: "2026-11-25 08:00:00+00",
        accountId: accountB,
      });
      const base = { statuses: [ContentStatus.InReview] };

      const all = select(base);
      const onA = select({
        ...base,
        connectedAccountIds: [asConnectedAccountId(accountA)],
      });
      const mcp = select({ ...base, source: "mcp" });
      const manualOnA = select({
        ...base,
        source: "manual",
        connectedAccountIds: [asConnectedAccountId(accountA)],
      });

      expect((await readAll(all, 20)).flat()).toEqual([mcpOnA, appOnA, appOnB]);
      expect((await readAll(onA, 1)).flat()).toEqual([mcpOnA, appOnA]);
      expect((await readAll(mcp, 20)).flat()).toEqual([mcpOnA]);
      expect((await readAll(manualOnA, 20)).flat()).toEqual([appOnA]);
      expect(
        await Promise.all(
          [all, onA, mcp, manualOnA].map((selection) =>
            repo.countPosts(selection, owner),
          ),
        ),
      ).toEqual([3, 2, 1, 1]);
    });

    it("returns the true total, not the page length", async () => {
      for (let index = 0; index < 25; index += 1) {
        await createPost({
          status: ContentStatus.Draft,
          updatedAt: `2026-11-25 10:00:${String(index).padStart(2, "0")}+00`,
        });
      }
      const page = await repo.listPostPage(
        { ...select({}), cursor: null, limit: 20 },
        owner,
      );
      expect(page.items).toHaveLength(20);
      expect(page.nextCursor).not.toBeNull();
      expect(await repo.countPosts(select({}), owner)).toBe(25);
    });

    it("rejects a broken cursor before any query", async () => {
      await expect(
        repo.listPostPage(
          { ...select({}), cursor: asPageCursor("broken"), limit: 20 },
          owner,
        ),
      ).rejects.toBeInstanceOf(InvalidPageCursorError);
    });
  },
);
