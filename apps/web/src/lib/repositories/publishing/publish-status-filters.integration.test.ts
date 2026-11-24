import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  asConnectedAccountId,
  asPostId,
  asUserId,
  asWorkspaceId,
  ContentFormat,
  ContentStatus,
  MemberRole,
  MemberStatus,
  SocialPlatform,
  type PostId,
  type UserId,
  type WorkspaceId,
} from "@postific/shared";

import type { prisma as prismaClient } from "@/lib/prisma/client";

/**
 * T-296/T-297 on a real Postgres: the status filters of
 * `publishingRepository` accept `Draft`, `In Review` and `Ready to Schedule`
 * and reject `Scheduled` and `Imported`, for schedule, publish now, update
 * caption and soft delete. Repository level only: no Outstand call, no use
 * case.
 *
 * Opt-in like the other DB integration tests: needs a real `DATABASE_URL`
 * AND `PUBLISHING_STATUS_DB_TEST=1`; otherwise the suite is skipped. Fixtures
 * use a random suffix, are removed in `afterAll` through the workspace
 * cascade, and the test FAILS when anything is left.
 */
const enabled =
  Boolean(process.env.DATABASE_URL) &&
  process.env.SKIP_ENV_VALIDATION !== "1" &&
  process.env.PUBLISHING_STATUS_DB_TEST === "1";

describe.skipIf(!enabled)(
  "publishingRepository status filters (Postgres, T-296, T-297)",
  () => {
    const suffix = randomUUID().slice(0, 8);
    const prefix = `t-status-${suffix}`;
    const owner: UserId = asUserId(`${prefix}-owner`);

    let prisma: typeof prismaClient;
    let withCurrentUser: typeof import("@/lib/prisma/with-current-user").withCurrentUser;
    let repo: typeof import("@/lib/repositories/publishing").publishingRepository;
    let workspace: WorkspaceId;
    let accountId: string;

    const ACCEPTED = [
      ContentStatus.Draft,
      ContentStatus.InReview,
      ContentStatus.ReadyToSchedule,
    ] as const;
    const REJECTED = [ContentStatus.Scheduled, ContentStatus.Imported] as const;

    async function createPost(status: ContentStatus): Promise<PostId> {
      const post = await withCurrentUser(owner, (tx) =>
        tx.publishingPost.create({
          data: {
            workspaceId: workspace,
            authorId: status === ContentStatus.Imported ? null : owner,
            caption: "original",
            status,
            scheduledAt:
              status === ContentStatus.Scheduled
                ? new Date(Date.now() + 86_400_000)
                : null,
            publishedAt: status === ContentStatus.Imported ? new Date() : null,
          },
        }),
      );
      return asPostId(post.id);
    }

    const storedPost = (postId: PostId) =>
      withCurrentUser(owner, (tx) =>
        tx.publishingPost.findUniqueOrThrow({ where: { id: postId } }),
      );

    const targets = () => [
      {
        connectedAccountId: asConnectedAccountId(accountId),
        platform: SocialPlatform.Instagram,
        contentFormat: ContentFormat.Post,
      },
    ];

    beforeAll(async () => {
      ({ prisma } = await import("@/lib/prisma/client"));
      ({ withCurrentUser } = await import("@/lib/prisma/with-current-user"));
      ({ publishingRepository: repo } =
        await import("@/lib/repositories/publishing"));

      const ws = await prisma.workspace.create({
        data: {
          name: `T-STATUS-DB-TEST ${suffix}`,
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
      const account = await withCurrentUser(owner, (tx) =>
        tx.workspaceConnectedAccount.create({
          data: {
            workspaceId: ws.id,
            platform: SocialPlatform.Instagram,
            outstandAccountId: `${prefix}-ig`,
            handle: `${prefix}-ig`,
          },
        }),
      );
      accountId = account.id;
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
          where: { name: { startsWith: `T-STATUS-DB-TEST ${suffix}` } },
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
      console.info(`[status-db-test ${suffix}] leftover test data:`, leftover);
      expect(Object.values(leftover).every((count) => count === 0)).toBe(true);
    });

    describe("schedulePost", () => {
      it.each(ACCEPTED)("schedules a %s post", async (status) => {
        const postId = await createPost(status);
        const result = await repo.schedulePost(
          {
            workspaceId: workspace,
            postId,
            scheduledAt: new Date(Date.now() + 86_400_000),
            targets: targets(),
          },
          owner,
        );
        expect(result).not.toBeNull();
        expect((await storedPost(postId)).status).toBe(ContentStatus.Scheduled);
      });

      it.each(REJECTED)("rejects a %s post", async (status) => {
        const postId = await createPost(status);
        const result = await repo.schedulePost(
          {
            workspaceId: workspace,
            postId,
            scheduledAt: new Date(Date.now() + 2 * 86_400_000),
            targets: targets(),
          },
          owner,
        );
        expect(result).toBeNull();
        expect((await storedPost(postId)).status).toBe(status);
      });
    });

    describe("publishNow", () => {
      it.each(ACCEPTED)("publishes a %s post", async (status) => {
        const postId = await createPost(status);
        const result = await repo.publishNow(
          { workspaceId: workspace, postId, targets: targets() },
          owner,
        );
        expect(result).not.toBeNull();
        expect((await storedPost(postId)).status).toBe(ContentStatus.Published);
      });

      it.each(REJECTED)("rejects a %s post", async (status) => {
        const postId = await createPost(status);
        const result = await repo.publishNow(
          { workspaceId: workspace, postId, targets: targets() },
          owner,
        );
        expect(result).toBeNull();
        expect((await storedPost(postId)).status).toBe(status);
      });
    });

    describe("updateDraftCaption", () => {
      it.each(ACCEPTED)(
        "updates the caption of a %s post and keeps its status",
        async (status) => {
          const postId = await createPost(status);
          const result = await repo.updateDraftCaption(
            { workspaceId: workspace, postId, caption: "edited" },
            owner,
          );
          expect(result).not.toBeNull();
          const stored = await storedPost(postId);
          expect(stored.caption).toBe("edited");
          expect(stored.status).toBe(status);
        },
      );

      it.each(REJECTED)("rejects a %s post", async (status) => {
        const postId = await createPost(status);
        const result = await repo.updateDraftCaption(
          { workspaceId: workspace, postId, caption: "edited" },
          owner,
        );
        expect(result).toBeNull();
        expect((await storedPost(postId)).caption).toBe("original");
      });
    });

    describe("softDeletePost", () => {
      it.each(ACCEPTED)("soft deletes a %s post", async (status) => {
        const postId = await createPost(status);
        const result = await repo.softDeletePost(
          { workspaceId: workspace, postId },
          owner,
        );
        expect(result).not.toBeNull();
        expect((await storedPost(postId)).deletedAt).not.toBeNull();
      });

      it.each(REJECTED)("rejects a %s post", async (status) => {
        const postId = await createPost(status);
        const result = await repo.softDeletePost(
          { workspaceId: workspace, postId },
          owner,
        );
        expect(result).toBeNull();
        expect((await storedPost(postId)).deletedAt).toBeNull();
      });
    });
  },
);
