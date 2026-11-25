import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  asConnectedAccountId,
  asPageCursor,
  asUserId,
  asWorkspaceId,
  MemberRole,
  MemberStatus,
  SocialPlatform,
  type UserId,
  type WorkspaceId,
} from "@postific/shared";

import { ValidationError } from "@/lib/utils/errors";
import type { prisma as prismaClient } from "@/lib/prisma/client";

/**
 * Bukti T-218.5 dan T-303 di Postgres sungguhan: kelompok posting dan
 * komentar berhalaman dengan cursor (`listInboxPostGroups`,
 * `listInboxItemsPage`, hitungan), filter `postId`/`receivedSince`,
 * isolasi workspace, dan RLS lewat `withCurrentUser`. Termasuk dua baris
 * dengan waktu terima sama di batas halaman. Tes
 * unit hanya memakai tabel in-memory; di sini yang diuji SQL-nya.
 *
 * Opt-in ganda seperti tes integrasi lain: butuh `DATABASE_URL` sungguhan DAN
 * `ENGAGEMENT_DB_TEST=1`; tanpa itu seluruh suite di-skip. Fixture memakai
 * suffix acak, dihapus di `afterAll` lewat cascade workspace, dan tes GAGAL
 * bila ada sisa. Tidak memanggil Outstand.
 */
const enabled =
  Boolean(process.env.DATABASE_URL) &&
  process.env.SKIP_ENV_VALIDATION !== "1" &&
  process.env.ENGAGEMENT_DB_TEST === "1";

describe.skipIf(!enabled)("engagement per posting (Postgres, T-218.5)", () => {
  const suffix = randomUUID().slice(0, 8);
  const prefix = `t-eng-post-${suffix}`;
  const owner: UserId = asUserId(`${prefix}-owner`);
  const otherOwner: UserId = asUserId(`${prefix}-other-owner`);

  let prisma: typeof prismaClient;
  let withCurrentUser: typeof import("@/lib/prisma/with-current-user").withCurrentUser;
  let repo: typeof import("./engagement.repository").engagementRepository;
  let wsA: WorkspaceId;
  let wsB: WorkspaceId;
  let igId: string;
  let fbId: string;
  let foreignId: string;

  const post1 = randomUUID();
  const post2 = randomUUID();
  const at = (iso: string) => new Date(iso);
  let externalSeq = 0;

  async function comment(options: {
    workspace: WorkspaceId;
    account: string;
    platform: SocialPlatform;
    postId: string | null;
    status?: string;
    receivedAt: Date;
  }) {
    externalSeq += 1;
    // RLS `engagement_inbox_items`: insert lewat konteks pemilik workspace.
    const actor = options.workspace === wsA ? owner : otherOwner;
    await withCurrentUser(actor, (tx) =>
      tx.engagementInboxItem.create({
        data: {
          workspaceId: options.workspace,
          connectedAccountId: options.account,
          platform: options.platform,
          externalId: `${prefix}-${externalSeq}`,
          authorHandle: "@tester",
          content: "komentar uji",
          status: options.status ?? "unread",
          postId: options.postId,
          receivedAt: options.receivedAt,
        },
      }),
    );
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma/client"));
    ({ withCurrentUser } = await import("@/lib/prisma/with-current-user"));
    ({ engagementRepository: repo } = await import("./engagement.repository"));

    const a = await prisma.workspace.create({
      data: {
        name: `T-ENGPOST-DB-TEST ${suffix} A`,
        slug: `${prefix}-a`,
        ownerId: owner,
      },
    });
    const b = await prisma.workspace.create({
      data: {
        name: `T-ENGPOST-DB-TEST ${suffix} B`,
        slug: `${prefix}-b`,
        ownerId: otherOwner,
      },
    });
    wsA = asWorkspaceId(a.id);
    wsB = asWorkspaceId(b.id);
    const joinedAt = new Date();
    await prisma.workspaceMember.createMany({
      data: [
        {
          workspaceId: a.id,
          userId: owner,
          role: MemberRole.Owner,
          status: MemberStatus.Active,
          joinedAt,
        },
        {
          workspaceId: b.id,
          userId: otherOwner,
          role: MemberRole.Owner,
          status: MemberStatus.Active,
          joinedAt,
        },
      ],
    });
    const account = (
      workspaceId: string,
      platform: SocialPlatform,
      actor: UserId,
      key: string,
    ) =>
      // RLS `workspace_connected_accounts` menolak insert tanpa konteks
      // pengguna: buat lewat `withCurrentUser` (pola tes integrasi publishing).
      withCurrentUser(actor, (tx) =>
        tx.workspaceConnectedAccount.create({
          data: {
            workspaceId,
            platform,
            outstandAccountId: `${prefix}-${key}`,
            handle: `${prefix}-${key}`,
          },
        }),
      ).then((row) => row.id);
    igId = await account(a.id, SocialPlatform.Instagram, owner, "ig");
    fbId = await account(a.id, SocialPlatform.Facebook, owner, "fb");
    foreignId = await account(
      b.id,
      SocialPlatform.Instagram,
      otherOwner,
      "foreign",
    );
  });

  beforeEach(async () => {
    for (const [actor, workspaceId] of [
      [owner, wsA],
      [otherOwner, wsB],
    ] as const) {
      await withCurrentUser(actor, (tx) =>
        tx.engagementInboxItem.deleteMany({ where: { workspaceId } }),
      );
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    const ids = [wsA, wsB].filter(Boolean);
    if (ids.length > 0) {
      await prisma.workspace.deleteMany({ where: { id: { in: ids } } });
    }
    const [workspaces, members, accounts, items] = await Promise.all([
      prisma.workspace.count({
        where: { name: { startsWith: `T-ENGPOST-DB-TEST ${suffix}` } },
      }),
      prisma.workspaceMember.count({
        where: { userId: { startsWith: prefix } },
      }),
      prisma.workspaceConnectedAccount.count({
        where: { outstandAccountId: { startsWith: prefix } },
      }),
      prisma.engagementInboxItem.count({ where: { workspaceId: { in: ids } } }),
    ]);
    const leftover = { workspaces, members, accounts, items };
    console.info(
      `[engagement-post-db-test ${suffix}] sisa data uji:`,
      leftover,
    );
    expect(Object.values(leftover).every((count) => count === 0)).toBe(true);
  });

  /** Banyak komentar sekaligus (satu transaksi), tiap baris dengan id baru. */
  async function bulk(
    count: number,
    make: (index: number) => {
      postId: string | null;
      status?: string;
      receivedAt: Date;
    },
  ) {
    const data = Array.from({ length: count }, (_, index) => {
      externalSeq += 1;
      const row = make(index);
      return {
        workspaceId: wsA,
        connectedAccountId: igId,
        platform: SocialPlatform.Instagram,
        externalId: `${prefix}-${externalSeq}`,
        authorHandle: "@tester",
        content: "komentar uji",
        status: row.status ?? "unread",
        postId: row.postId,
        receivedAt: row.receivedAt,
      };
    });
    await withCurrentUser(owner, (tx) =>
      tx.engagementInboxItem.createMany({ data }),
    );
  }

  /** Telusuri semua halaman sampai habis; mengembalikan halaman-halamannya. */
  async function drain<T>(
    load: (cursor: never) => Promise<{ items: T[]; nextCursor: unknown }>,
  ) {
    const pages: T[][] = [];
    let cursor: unknown = null;
    do {
      const page = await load(cursor as never);
      pages.push(page.items);
      cursor = page.nextCursor;
      expect(pages.length).toBeLessThan(50);
    } while (cursor);
    return pages;
  }

  const ig = SocialPlatform.Instagram;
  const first = (limit = 20) => ({ sort: "newest" as const, limit });

  it("mengelompokkan per posting dengan hitungan, komentar terbaru dan tertua, status, dan akun", async () => {
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post1,
      receivedAt: at("2026-10-01T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post1,
      receivedAt: at("2026-10-03T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post1,
      status: "resolved",
      receivedAt: at("2026-10-02T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post1,
      status: "replied",
      receivedAt: at("2026-10-02T12:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: fbId,
      platform: SocialPlatform.Facebook,
      postId: post1,
      status: "done",
      receivedAt: at("2026-09-30T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: null,
      receivedAt: at("2026-10-04T00:00:00Z"),
    });
    await comment({
      workspace: wsB,
      account: foreignId,
      platform: ig,
      postId: post1,
      receivedAt: at("2026-10-05T00:00:00Z"),
    });

    const page = await repo.listInboxPostGroups(
      { workspaceId: wsA },
      "numbered",
      first(),
      owner,
    );

    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(1);
    const [group] = page.items;
    expect(group).toMatchObject({
      postId: post1,
      totalCount: 5,
      unrepliedCount: 2,
      handledCount: 3,
      repliedCount: 1,
      latestReceivedAt: at("2026-10-03T00:00:00Z"),
      oldestReceivedAt: at("2026-09-30T00:00:00Z"),
    });
    // `done` lama dihitung sebagai `resolved`.
    expect([...group.statuses].sort()).toEqual([
      "replied",
      "resolved",
      "unread",
    ]);
    expect([...group.connectedAccountIds].sort()).toEqual([igId, fbId].sort());
    // Akun utama stabil: id terkecil.
    expect(group.connectedAccountId).toBe([igId, fbId].sort()[0]);

    const none = await repo.listInboxPostGroups(
      { workspaceId: wsA },
      "none",
      first(),
      owner,
    );
    expect(none.items.map((g) => [g.postId, g.totalCount])).toEqual([
      [null, 1],
    ]);
    expect(none.nextCursor).toBeNull();

    // Hitungan sebenarnya: posting bernomor, dan belum dibalas termasuk Tanpa posting.
    expect(
      await repo.countInboxPostGroups({ workspaceId: wsA }, owner),
    ).toEqual({
      postCount: 1,
      unrepliedCount: 3,
    });
  });

  it("filter status menyaring kelompok tetapi hitungan tetap atas semua komentar (done = resolved)", async () => {
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post1,
      receivedAt: at("2026-10-01T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post1,
      status: "done",
      receivedAt: at("2026-10-02T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post2,
      receivedAt: at("2026-10-03T00:00:00Z"),
    });

    const resolved = await repo.listInboxPostGroups(
      { workspaceId: wsA, status: "resolved" },
      "numbered",
      first(),
      owner,
    );
    expect(resolved.items.map((g) => [g.postId, g.totalCount])).toEqual([
      [post1, 2],
    ]);
    expect(
      await repo.countInboxPostGroups(
        { workspaceId: wsA, status: "resolved" },
        owner,
      ),
    ).toEqual({ postCount: 1, unrepliedCount: 1 });
  });

  it("memfilter akun, platform, rentang tanggal, dan satu posting", async () => {
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post1,
      receivedAt: at("2026-10-01T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post1,
      receivedAt: at("2026-05-01T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: fbId,
      platform: SocialPlatform.Facebook,
      postId: post2,
      receivedAt: at("2026-10-01T00:00:00Z"),
    });

    const byAccount = await repo.listInboxPostGroups(
      {
        workspaceId: wsA,
        connectedAccountId: asConnectedAccountId(igId),
        receivedSince: at("2026-09-01T00:00:00Z"),
      },
      "numbered",
      first(),
      owner,
    );
    expect(byAccount.items.map((g) => [g.postId, g.totalCount])).toEqual([
      [post1, 1],
    ]);

    const byPlatform = await repo.listInboxPostGroups(
      { workspaceId: wsA, platform: SocialPlatform.Facebook },
      "numbered",
      first(),
      owner,
    );
    expect(byPlatform.items.map((g) => g.postId)).toEqual([post2]);

    const one = await repo.listInboxPostGroups(
      { workspaceId: wsA, postId: post2 as never },
      "numbered",
      first(),
      owner,
    );
    expect(one.items.map((g) => g.postId)).toEqual([post2]);
  });

  it.each(["unreplied_first", "newest", "oldest"] as const)(
    "kelompok posting berhalaman (%s): 45 posting, tanpa ulang dan tanpa hilang, termasuk waktu komentar yang sama di batas halaman",
    async (sort) => {
      const ids = Array.from({ length: 45 }, () => randomUUID());
      // Dua kelompok bersama waktu komentar terbaru dan jumlah belum dibalas
      // yang sama di tiap batas (kelipatan 3) memaksa tie-breaker id posting.
      await bulk(45, (index) => ({
        postId: ids[index],
        status: index % 4 === 0 ? "resolved" : "unread",
        receivedAt: at(
          `2026-10-${String(1 + (index % 3)).padStart(2, "0")}T00:00:00Z`,
        ),
      }));

      const pages = await drain((cursor) =>
        repo.listInboxPostGroups(
          { workspaceId: wsA },
          "numbered",
          { sort, limit: 20, cursor },
          owner,
        ),
      );

      expect(pages.map((p) => p.length)).toEqual([20, 20, 5]);
      const seen = pages.flat().map((g) => g.postId);
      expect(new Set(seen).size).toBe(45);
      expect([...seen].sort()).toEqual([...ids].sort());

      // Urutan lintas halaman = urutan satu kueri besar.
      const all = await repo.listInboxPostGroups(
        { workspaceId: wsA },
        "numbered",
        { sort, limit: 100 },
        owner,
      );
      expect(all.items.map((g) => g.postId)).toEqual(seen);
    },
  );

  it("cursor kelompok dari sort atau filter lain, atau rusak, ditolak", async () => {
    await bulk(3, (index) => ({
      postId: randomUUID(),
      receivedAt: at(`2026-10-0${index + 1}T00:00:00Z`),
    }));
    const page = await repo.listInboxPostGroups(
      { workspaceId: wsA },
      "numbered",
      { sort: "newest", limit: 1 },
      owner,
    );
    expect(page.nextCursor).not.toBeNull();

    await expect(
      repo.listInboxPostGroups(
        { workspaceId: wsA },
        "numbered",
        { sort: "oldest", limit: 1, cursor: page.nextCursor },
        owner,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      repo.listInboxPostGroups(
        { workspaceId: wsA, platform: SocialPlatform.Facebook },
        "numbered",
        { sort: "newest", limit: 1, cursor: page.nextCursor },
        owner,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      repo.listInboxPostGroups(
        { workspaceId: wsA },
        "numbered",
        { sort: "newest", limit: 1, cursor: asPageCursor("tidak-valid") },
        owner,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it.each(["newest", "oldest"] as const)(
    "komentar berhalaman (%s): dua komentar dengan waktu sama di batas halaman muncul sekali tiap satu",
    async (sort) => {
      const same = at("2026-10-05T00:00:00Z");
      await bulk(7, (index) => ({
        postId: post1,
        receivedAt: index < 4 ? same : at(`2026-10-0${index - 3}T00:00:00Z`),
      }));

      const pages = await drain((cursor) =>
        repo.listInboxItemsPage(
          { workspaceId: wsA },
          { sort, limit: 2, cursor },
          owner,
        ),
      );

      expect(pages.map((p) => p.length)).toEqual([2, 2, 2, 1]);
      const ids = pages.flat().map((i) => i.id);
      expect(new Set(ids).size).toBe(7);
      const all = await repo.listInboxItemsPage(
        { workspaceId: wsA },
        { sort, limit: 50 },
        owner,
      );
      expect(all.items.map((i) => i.id)).toEqual(ids);
      const times = all.items.map((i) => i.receivedAt.getTime());
      expect(times).toEqual(
        [...times].sort((a, b) => (sort === "oldest" ? a - b : b - a)),
      );
    },
  );

  it("komentar berhalaman, Belum dibalas dulu: unread dulu lalu sisanya, melewati batas bagian tanpa ulang", async () => {
    await bulk(6, (index) => ({
      postId: post1,
      status: index < 3 ? "unread" : index === 3 ? "replied" : "resolved",
      // Waktu sama di seluruh baris: hanya id yang memisahkan.
      receivedAt: at("2026-10-05T00:00:00Z"),
    }));

    const pages = await drain((cursor) =>
      repo.listInboxItemsPage(
        { workspaceId: wsA },
        { sort: "unreplied_first", limit: 2, cursor },
        owner,
      ),
    );

    const flat = pages.flat();
    expect(flat).toHaveLength(6);
    expect(new Set(flat.map((i) => i.id)).size).toBe(6);
    expect(flat.map((i) => i.status === "unread")).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
    expect(pages.map((p) => p.length)).toEqual([2, 2, 2]);
  });

  it("komentar berhalaman memfilter status, satu posting, Tanpa posting, dan rentang; hitungan dari count query", async () => {
    await bulk(25, (index) => ({
      postId: post1,
      status: index < 10 ? "unread" : "replied",
      receivedAt: at("2026-10-05T00:00:00Z"),
    }));
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post2,
      receivedAt: at("2026-10-06T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: null,
      receivedAt: at("2026-10-07T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post1,
      receivedAt: at("2026-01-01T00:00:00Z"),
    });

    const forPost = await drain((cursor) =>
      repo.listInboxItemsPage(
        {
          workspaceId: wsA,
          postId: post1 as never,
          receivedSince: at("2026-09-01T00:00:00Z"),
        },
        { sort: "newest", limit: 20, cursor },
        owner,
      ),
    );
    expect(forPost.map((p) => p.length)).toEqual([20, 5]);

    const unread = await repo.listInboxItemsPage(
      { workspaceId: wsA, status: "unread", postId: post1 as never },
      { sort: "unreplied_first", limit: 50 },
      owner,
    );
    expect(unread.items).toHaveLength(11);
    expect(unread.items.every((i) => i.status === "unread")).toBe(true);

    const none = await repo.listInboxItemsPage(
      { workspaceId: wsA, postId: null },
      first(),
      owner,
    );
    expect(none.items.map((i) => i.postId)).toEqual([null]);

    // 25 + 1 (post2) + 1 (tanpa posting) + 1 (lama) = 28 di workspace; rentang membuang yang lama.
    // Unread: 10 (bulk) + post2 + tanpa posting + lama = 13; tanpa yang lama = 12.
    expect(await repo.countInboxItems({ workspaceId: wsA }, owner)).toEqual({
      total: 28,
      unread: 13,
    });
    expect(
      await repo.countInboxItems(
        { workspaceId: wsA, receivedSince: at("2026-09-01T00:00:00Z") },
        owner,
      ),
    ).toEqual({ total: 27, unread: 12 });
    expect(
      await repo.countInboxItems(
        { workspaceId: wsA, status: "replied" },
        owner,
      ),
    ).toEqual({ total: 15, unread: 0 });
  });

  it("komentar baru di antara dua halaman tidak menggeser atau mengulang halaman berikutnya (tanpa offset)", async () => {
    await bulk(5, (index) => ({
      postId: post1,
      receivedAt: at(`2026-10-0${index + 1}T00:00:00Z`),
    }));
    const page1 = await repo.listInboxItemsPage(
      { workspaceId: wsA },
      { sort: "newest", limit: 2 },
      owner,
    );

    // Komentar terbaru masuk setelah halaman pertama dimuat.
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post1,
      receivedAt: at("2026-10-20T00:00:00Z"),
    });

    const page2 = await repo.listInboxItemsPage(
      { workspaceId: wsA },
      { sort: "newest", limit: 2, cursor: page1.nextCursor },
      owner,
    );
    const overlap = page2.items.filter((i) =>
      page1.items.some((p) => p.id === i.id),
    );
    expect(overlap).toEqual([]);
    expect(page2.items.map((i) => i.receivedAt.toISOString())).toEqual([
      "2026-10-03T00:00:00.000Z",
      "2026-10-02T00:00:00.000Z",
    ]);
  });

  it("cursor komentar dari sort atau filter lain, atau rusak, ditolak", async () => {
    await bulk(3, (index) => ({
      postId: post1,
      receivedAt: at(`2026-10-0${index + 1}T00:00:00Z`),
    }));
    const page = await repo.listInboxItemsPage(
      { workspaceId: wsA },
      { sort: "newest", limit: 1 },
      owner,
    );
    expect(page.nextCursor).not.toBeNull();

    await expect(
      repo.listInboxItemsPage(
        { workspaceId: wsA },
        { sort: "oldest", limit: 1, cursor: page.nextCursor },
        owner,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      repo.listInboxItemsPage(
        { workspaceId: wsA, postId: post1 as never },
        { sort: "newest", limit: 1, cursor: page.nextCursor },
        owner,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      repo.listInboxItemsPage(
        { workspaceId: wsA },
        { sort: "newest", limit: 1, cursor: asPageCursor("tidak-valid") },
        owner,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("findPostIdsWithInboxItems mengembalikan posting yang punya komentar dalam cakupan", async () => {
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post1,
      receivedAt: at("2026-10-01T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post2,
      receivedAt: at("2026-01-01T00:00:00Z"),
    });

    const found = await repo.findPostIdsWithInboxItems(
      {
        workspaceId: wsA,
        postIds: [post1, post2, randomUUID()] as never,
        receivedSince: at("2026-09-01T00:00:00Z"),
      },
      owner,
    );
    expect(found).toEqual([post1]);
    expect(
      await repo.findPostIdsWithInboxItems(
        { workspaceId: wsA, postIds: [] },
        owner,
      ),
    ).toEqual([]);
  });

  it("listInboxItems (jalur MCP) tetap memfilter satu posting dan kelompok tanpa posting", async () => {
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post1,
      receivedAt: at("2026-10-01T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post2,
      receivedAt: at("2026-10-02T00:00:00Z"),
    });
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: null,
      receivedAt: at("2026-10-03T00:00:00Z"),
    });

    const one = await repo.listInboxItems(
      { workspaceId: wsA, postId: post1 as never },
      owner,
    );
    expect(one.map((i) => i.postId)).toEqual([post1]);
    const none = await repo.listInboxItems(
      { workspaceId: wsA, postId: null },
      owner,
    );
    expect(none.map((i) => i.postId)).toEqual([null]);
    expect(await repo.listInboxItems({ workspaceId: wsA }, owner)).toHaveLength(
      3,
    );
  });

  it("RLS: user yang bukan member tidak melihat data workspace lain", async () => {
    await comment({
      workspace: wsA,
      account: igId,
      platform: ig,
      postId: post1,
      receivedAt: at("2026-10-01T00:00:00Z"),
    });
    const groups = await repo.listInboxPostGroups(
      { workspaceId: wsA },
      "numbered",
      first(),
      otherOwner,
    );
    expect(groups.items).toEqual([]);
    const items = await repo.listInboxItemsPage(
      { workspaceId: wsA },
      first(),
      otherOwner,
    );
    expect(items.items).toEqual([]);
    expect(
      await repo.countInboxItems({ workspaceId: wsA }, otherOwner),
    ).toEqual({ total: 0, unread: 0 });
  });
});
