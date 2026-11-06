import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  asConnectedAccountId,
  asInboxItemId,
  asUserId,
  asWorkspaceId,
  type InboxItemId,
  type PostId,
  type SocialPlatform,
} from "@postific/shared";

type Row = {
  id: string;
  workspaceId: string;
  connectedAccountId: string;
  platform: string;
  type: string;
  externalId: string;
  authorHandle: string;
  content: string;
  status: string;
  postId: string | null;
  receivedAt: Date;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const { table } = vi.hoisted(() => ({ table: [] as unknown[] }));
const rows = table as Row[];

type Where = {
  id?: string;
  workspaceId?: string;
  status?: string;
  readAt?: null;
  receivedAt?: { gte: Date };
  connectedAccountId?: string;
  platform?: string;
  postId?: string | null;
};

function matches(row: Row, where: Where): boolean {
  return (
    (where.id === undefined || row.id === where.id) &&
    (where.workspaceId === undefined ||
      row.workspaceId === where.workspaceId) &&
    (where.status === undefined || row.status === where.status) &&
    (where.readAt === undefined || row.readAt === null) &&
    (where.receivedAt === undefined ||
      row.receivedAt >= where.receivedAt.gte) &&
    (where.connectedAccountId === undefined ||
      row.connectedAccountId === where.connectedAccountId) &&
    (where.platform === undefined || row.platform === where.platform) &&
    (where.postId === undefined || row.postId === where.postId)
  );
}

// Tabel in-memory yang menafsirkan `where` seperti Prisma, supaya tes
// menegaskan perilaku akhir baris, bukan bentuk panggilan.
const tx = {
  engagementInboxItem: {
    updateMany: async ({
      where,
      data,
    }: {
      where: Where;
      data: Partial<Row>;
    }) => {
      const hit = rows.filter((row) => matches(row, where));
      hit.forEach((row) => Object.assign(row, data));
      return { count: hit.length };
    },
    findFirst: async ({ where }: { where: Where }) =>
      rows.find((row) => matches(row, where)) ?? null,
    count: async ({ where }: { where: Where }) =>
      rows.filter((row) => matches(row, where)).length,
    findMany: async ({ where }: { where: Where }) =>
      rows
        .filter((row) => matches(row, where))
        .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime()),
    // `GROUP BY` ala Prisma: kunci = kombinasi kolom `by`, `_count` dan
    // `_max.receivedAt` dihitung per kunci.
    groupBy: async ({ by, where }: { by: (keyof Row)[]; where: Where }) => {
      const groups = new Map<string, Row[]>();
      for (const row of rows.filter((r) => matches(r, where))) {
        const key = JSON.stringify(by.map((column) => row[column]));
        groups.set(key, [...(groups.get(key) ?? []), row]);
      }
      return [...groups.values()].map((members) => ({
        ...Object.fromEntries(by.map((column) => [column, members[0][column]])),
        _count: { _all: members.length },
        _max: {
          receivedAt: new Date(
            Math.max(...members.map((m) => m.receivedAt.getTime())),
          ),
        },
      }));
    },
  },
};

vi.mock("@/lib/prisma/with-current-user", () => ({
  withCurrentUser: async (_userId: string, fn: (t: typeof tx) => unknown) =>
    fn(tx),
}));

import { engagementRepository } from "./engagement.repository";

const WORKSPACE = asWorkspaceId("11111111-1111-4111-8111-111111111111");
const OTHER_WORKSPACE = asWorkspaceId("99999999-9999-4999-8999-999999999999");
const USER = asUserId("user-1");

function seed(id: string, overrides: Partial<Row> = {}): InboxItemId {
  rows.push({
    id,
    workspaceId: WORKSPACE,
    connectedAccountId: "22222222-2222-4222-8222-222222222222",
    platform: "instagram",
    type: "comment",
    externalId: `ext-${id}`,
    authorHandle: "@a",
    content: "hi",
    status: "unread",
    postId: null,
    receivedAt: new Date("2026-10-01T00:00:00.000Z"),
    readAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  });
  return asInboxItemId(id);
}

describe("engagementRepository.markInboxItemStatus", () => {
  beforeEach(() => {
    rows.length = 0;
  });

  it("mengisi readAt saat pertama kali keluar dari unread dan tidak menimpanya setelahnya", async () => {
    const id = seed("a");
    const input = { workspaceId: WORKSPACE, inboxItemId: id };

    const first = await engagementRepository.markInboxItemStatus(
      { ...input, status: "resolved" },
      USER,
    );
    const firstReadAt = first?.readAt;
    expect(firstReadAt).toBeInstanceOf(Date);

    await engagementRepository.markInboxItemStatus(
      { ...input, status: "unread" },
      USER,
    );
    const reopenedThenDismissed =
      await engagementRepository.markInboxItemStatus(
        { ...input, status: "dismissed" },
        USER,
      );

    expect(reopenedThenDismissed?.status).toBe("dismissed");
    expect(reopenedThenDismissed?.readAt).toEqual(firstReadAt);
  });

  it("tidak mengubah baris bila onlyFromStatus tidak cocok dan mengembalikan baris apa adanya", async () => {
    const id = seed("a", { status: "resolved", readAt: new Date(5) });

    const result = await engagementRepository.markInboxItemStatus(
      {
        workspaceId: WORKSPACE,
        inboxItemId: id,
        status: "replied",
        onlyFromStatus: "unread",
      },
      USER,
    );

    expect(result?.status).toBe("resolved");
    expect(rows[0].status).toBe("resolved");
  });

  it("mengubah baris bila onlyFromStatus cocok", async () => {
    const id = seed("a");

    const result = await engagementRepository.markInboxItemStatus(
      {
        workspaceId: WORKSPACE,
        inboxItemId: id,
        status: "replied",
        onlyFromStatus: "unread",
      },
      USER,
    );

    expect(result?.status).toBe("replied");
    expect(result?.readAt).toBeInstanceOf(Date);
  });

  it("mengembalikan null bila baris bukan milik workspace", async () => {
    const id = seed("a");

    await expect(
      engagementRepository.markInboxItemStatus(
        { workspaceId: OTHER_WORKSPACE, inboxItemId: id, status: "resolved" },
        USER,
      ),
    ).resolves.toBeNull();
    expect(rows[0].status).toBe("unread");
  });
});

describe("engagementRepository.countUnreadInboxItems", () => {
  beforeEach(() => {
    rows.length = 0;
  });

  it("hanya menghitung unread milik workspace dengan receivedAt >= since", async () => {
    const since = new Date("2025-11-06T00:00:00.000Z");
    seed("recent");
    seed("edge", { receivedAt: since });
    seed("old", { receivedAt: new Date("2025-11-05T23:59:59.000Z") });
    seed("resolved", { status: "resolved" });
    seed("replied", { status: "replied" });
    seed("other-ws", { workspaceId: OTHER_WORKSPACE });

    await expect(
      engagementRepository.countUnreadInboxItems(
        { workspaceId: WORKSPACE, since },
        USER,
      ),
    ).resolves.toBe(2);
  });
});

describe("engagementRepository.aggregateInboxByPost", () => {
  const POST_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const POST_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  beforeEach(() => {
    rows.length = 0;
  });

  it("mengelompokkan per posting dan status dengan jumlah dan komentar terbaru, termasuk tanpa posting", async () => {
    seed("a", { postId: POST_1, receivedAt: new Date("2026-10-01T00:00:00Z") });
    seed("b", { postId: POST_1, receivedAt: new Date("2026-10-03T00:00:00Z") });
    seed("c", { postId: POST_1, status: "resolved" });
    seed("d", { postId: null });
    seed("e", { postId: POST_2 });

    const result = await engagementRepository.aggregateInboxByPost(
      { workspaceId: WORKSPACE },
      USER,
    );

    const unreadPost1 = result.find(
      (r) => r.postId === POST_1 && r.status === "unread",
    );
    expect(unreadPost1).toMatchObject({
      count: 2,
      latestReceivedAt: new Date("2026-10-03T00:00:00Z"),
    });
    expect(
      result.find((r) => r.postId === POST_1 && r.status === "resolved")?.count,
    ).toBe(1);
    expect(result.find((r) => r.postId === null)?.count).toBe(1);
    expect(result.find((r) => r.postId === POST_2)?.count).toBe(1);
  });

  it("menghormati workspace, akun, platform, dan rentang tanggal", async () => {
    const since = new Date("2026-09-01T00:00:00Z");
    seed("in", { postId: POST_1 });
    seed("old", {
      postId: POST_1,
      receivedAt: new Date("2026-08-01T00:00:00Z"),
    });
    seed("other-ws", { postId: POST_1, workspaceId: OTHER_WORKSPACE });
    seed("other-acc", {
      postId: POST_1,
      connectedAccountId: "33333333-3333-4333-8333-333333333333",
    });
    seed("other-platform", { postId: POST_1, platform: "facebook" });

    const result = await engagementRepository.aggregateInboxByPost(
      {
        workspaceId: WORKSPACE,
        connectedAccountId: asConnectedAccountId(
          "22222222-2222-4222-8222-222222222222",
        ),
        platform: "instagram" as SocialPlatform,
        receivedSince: since,
      },
      USER,
    );

    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(1);
  });
});

describe("engagementRepository.listInboxItems (T-218)", () => {
  const POST_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  beforeEach(() => {
    rows.length = 0;
  });

  it("memfilter satu posting, kelompok tanpa posting (null), dan rentang tanggal", async () => {
    seed("p1", { postId: POST_1 });
    seed("none", { postId: null });
    seed("old", {
      postId: POST_1,
      receivedAt: new Date("2026-01-01T00:00:00Z"),
    });

    const forPost = await engagementRepository.listInboxItems(
      { workspaceId: WORKSPACE, postId: POST_1 as PostId },
      USER,
    );
    expect(forPost.map((i) => i.id).sort()).toEqual(["old", "p1"]);

    const noPost = await engagementRepository.listInboxItems(
      { workspaceId: WORKSPACE, postId: null },
      USER,
    );
    expect(noPost.map((i) => i.id)).toEqual(["none"]);

    const recent = await engagementRepository.listInboxItems(
      {
        workspaceId: WORKSPACE,
        postId: POST_1 as PostId,
        receivedSince: new Date("2026-06-01T00:00:00Z"),
      },
      USER,
    );
    expect(recent.map((i) => i.id)).toEqual(["p1"]);
  });

  it("tanpa filter posting mengembalikan semua komentar workspace", async () => {
    seed("p1", { postId: POST_1 });
    seed("none", { postId: null });
    const all = await engagementRepository.listInboxItems(
      { workspaceId: WORKSPACE },
      USER,
    );
    expect(all).toHaveLength(2);
  });
});
