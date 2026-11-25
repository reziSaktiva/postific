import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  asPageCursor,
  asUserId,
  asWorkspaceId,
  MemberRole,
  MemberStatus,
  NotificationType,
  type UserId,
  type WorkspaceId,
} from "@postific/shared";

import type { prisma as prismaClient } from "@/lib/prisma/client";

/**
 * T-304 proof in real Postgres: the cursor query of the Notifications panel
 * (order `created_at DESC, id DESC`), including two notifications with the
 * SAME time across a page boundary, the true unread count and "mark all".
 * Unit tests cannot show this: the ordering and the cursor comparison are SQL.
 *
 * Opt-in like the other integration tests: needs a real `DATABASE_URL` AND
 * `NOTIFICATION_DB_TEST=1`; otherwise the suite is skipped. Fixtures use a
 * random suffix and are removed in `afterAll` by cascading the workspace.
 */
const enabled =
  Boolean(process.env.DATABASE_URL) &&
  process.env.SKIP_ENV_VALIDATION !== "1" &&
  process.env.NOTIFICATION_DB_TEST === "1";

describe.skipIf(!enabled)(
  "notification cursor paging (Postgres, T-304)",
  () => {
    const prefix = `t-notif-${randomUUID().slice(0, 8)}`;
    const user: UserId = asUserId(`${prefix}-user`);
    const otherUser: UserId = asUserId(`${prefix}-other`);

    let prisma: typeof prismaClient;
    let withCurrentUser: typeof import("@/lib/prisma/with-current-user").withCurrentUser;
    let repo: typeof import("./notification.repository").notificationRepository;
    let workspaceId: WorkspaceId;

    const at = (minute: number) => new Date(Date.UTC(2026, 10, 1, 12, minute));

    async function insert(createdAt: Date, isRead = false) {
      const row = await withCurrentUser(user, (tx) =>
        tx.notification.create({
          data: {
            workspaceId,
            userId: user,
            type: NotificationType.OwnershipTransferRequested,
            title: prefix,
            body: "body",
            isRead,
            createdAt,
          },
        }),
      );
      return row.id;
    }

    /** Reads every page with `limit` per page; returns the pages' ids. */
    async function readAll(limit: number) {
      const pages: string[][] = [];
      let cursor = null as ReturnType<typeof asPageCursor> | null;
      for (let guard = 0; guard < 20; guard += 1) {
        const page = await repo.listPage(user, { cursor, limit });
        pages.push(page.items.map((n) => n.id));
        if (!page.nextCursor) return pages;
        cursor = page.nextCursor;
      }
      throw new Error("cursor never ended");
    }

    beforeAll(async () => {
      ({ prisma } = await import("@/lib/prisma/client"));
      ({ withCurrentUser } = await import("@/lib/prisma/with-current-user"));
      ({ notificationRepository: repo } =
        await import("./notification.repository"));
      const ws = await prisma.workspace.create({
        data: {
          name: `T-NOTIF-DB-TEST ${prefix}`,
          slug: prefix,
          ownerId: user,
        },
      });
      workspaceId = asWorkspaceId(ws.id);
      await prisma.workspaceMember.createMany({
        data: {
          workspaceId: ws.id,
          userId: user,
          role: MemberRole.Owner,
          status: MemberStatus.Active,
          joinedAt: new Date(),
        },
      });
    });

    afterAll(async () => {
      if (!prisma) return;
      await prisma.workspace.deleteMany({ where: { id: workspaceId } });
      const left = await prisma.notification.count({
        where: { userId: { in: [user, otherUser] } },
      });
      expect(left).toBe(0);
    });

    it("returns an empty last page for a user with no notifications", async () => {
      expect(await repo.listPage(user, { cursor: null, limit: 20 })).toEqual({
        items: [],
        nextCursor: null,
      });
    });

    it("pages newest first and loses nothing when two items share a time across a page boundary", async () => {
      const newest = await insert(at(50));
      // Same instant, deliberately on both sides of the boundary at limit 2.
      const sameA = await insert(at(40));
      const sameB = await insert(at(40));
      const sameC = await insert(at(40));
      const older = await insert(at(10), true);
      const oldest = await insert(at(5), true);

      const tied = [sameA, sameB, sameC].sort().reverse(); // id DESC tie-break
      const expected = [newest, ...tied, older, oldest];

      const pages = await readAll(2);
      expect(pages.map((p) => p.length)).toEqual([2, 2, 2]);
      // Every item exactly once, in the same order as a single big page.
      expect(pages.flat()).toEqual(expected);
      const single = await repo.listPage(user, { cursor: null, limit: 20 });
      expect(single.items.map((n) => n.id)).toEqual(expected);
      expect(single.nextCursor).toBeNull();
    });

    it("is not capped at 50: reaches rows past the old limit", async () => {
      const before = (await readAll(20)).flat().length;
      await withCurrentUser(user, (tx) =>
        tx.notification.createMany({
          data: Array.from({ length: 55 }, (_, i) => ({
            workspaceId,
            userId: user,
            type: NotificationType.OwnershipTransferRequested,
            title: prefix,
            body: "bulk",
            createdAt: new Date(Date.UTC(2026, 9, 1, 0, i)),
          })),
        }),
      );
      const all = (await readAll(20)).flat();
      expect(all.length).toBe(before + 55);
      expect(new Set(all).size).toBe(all.length);
    });

    it("countUnread counts every unread notification, and markAllAsRead clears all of them", async () => {
      const unread = await repo.countUnread(user);
      expect(unread).toBeGreaterThan(50);
      await repo.markAllAsRead(user);
      expect(await repo.countUnread(user)).toBe(0);
    });

    it("rejects a malformed cursor", async () => {
      await expect(
        repo.listPage(user, {
          cursor: asPageCursor("not-a-cursor"),
          limit: 20,
        }),
      ).rejects.toThrow(/cursor/i);
      const wrongShape = Buffer.from(
        JSON.stringify({ v: 1, id: "x" }),
      ).toString("base64url");
      await expect(
        repo.listPage(user, { cursor: asPageCursor(wrongShape), limit: 20 }),
      ).rejects.toThrow(/cursor/i);
    });
  },
);
