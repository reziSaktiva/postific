import {
  asConnectedAccountId,
  asPostId,
  SocialPlatform,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import { buildInboxPostGroups, inboxDateRangeStart } from "./inbox-post-groups";
import type { InboxAggregateRow } from "./types";

const ACC_A = asConnectedAccountId("acc-a");
const ACC_B = asConnectedAccountId("acc-b");
const P1 = asPostId("post-1");
const P2 = asPostId("post-2");
const P3 = asPostId("post-3");

function row(overrides: Partial<InboxAggregateRow>): InboxAggregateRow {
  return {
    postId: P1,
    connectedAccountId: ACC_A,
    platform: SocialPlatform.Instagram,
    status: "unread",
    count: 1,
    latestReceivedAt: new Date("2026-10-01T00:00:00Z"),
    ...overrides,
  };
}

describe("buildInboxPostGroups", () => {
  it("menjumlahkan total, belum dibalas, dan ditangani per posting serta mengambil komentar terbaru", () => {
    const groups = buildInboxPostGroups(
      [
        row({
          status: "unread",
          count: 2,
          latestReceivedAt: new Date("2026-10-05T00:00:00Z"),
        }),
        row({ status: "replied", count: 1 }),
        row({ status: "resolved", count: 3 }),
        row({ status: "dismissed", count: 1 }),
      ],
      { sort: "unreplied_first" },
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      postId: P1,
      totalCount: 7,
      unrepliedCount: 2,
      handledCount: 5,
      latestReceivedAt: new Date("2026-10-05T00:00:00Z"),
    });
  });

  it("menjadikan komentar tanpa postId satu kelompok tersendiri", () => {
    const groups = buildInboxPostGroups(
      [
        row({ postId: null, count: 2 }),
        row({ postId: null, status: "resolved" }),
        row({}),
      ],
      { sort: "newest" },
    );

    const none = groups.filter((g) => g.postId === null);
    expect(none).toHaveLength(1);
    expect(none[0].totalCount).toBe(3);
    expect(groups).toHaveLength(2);
  });

  it("kelompok tanpa posting tidak ikut sort: selalu terakhir untuk ketiga sort", () => {
    const rows = [
      row({
        postId: null,
        count: 9,
        latestReceivedAt: new Date("2026-10-20T00:00:00Z"),
      }),
      row({
        postId: P1,
        count: 1,
        latestReceivedAt: new Date("2026-10-02T00:00:00Z"),
      }),
      row({
        postId: P2,
        count: 2,
        latestReceivedAt: new Date("2026-10-01T00:00:00Z"),
      }),
    ];
    for (const sort of ["unreplied_first", "newest", "oldest"] as const) {
      const groups = buildInboxPostGroups(rows, { sort });
      expect(groups.map((g) => g.postId).at(-1)).toBeNull();
      expect(groups).toHaveLength(3);
    }
  });

  it("belum dibalas dulu: urut jumlah belum dibalas, lalu komentar terbaru", () => {
    const groups = buildInboxPostGroups(
      [
        row({
          postId: P1,
          count: 1,
          latestReceivedAt: new Date("2026-10-09T00:00:00Z"),
        }),
        row({
          postId: P2,
          count: 3,
          latestReceivedAt: new Date("2026-10-01T00:00:00Z"),
        }),
        row({
          postId: P3,
          count: 1,
          latestReceivedAt: new Date("2026-10-08T00:00:00Z"),
        }),
      ],
      { sort: "unreplied_first" },
    );
    expect(groups.map((g) => g.postId)).toEqual([P2, P1, P3]);
  });

  it("sort terbaru dan terlama memakai waktu komentar terbaru kelompok", () => {
    const rows = [
      row({ postId: P1, latestReceivedAt: new Date("2026-10-02T00:00:00Z") }),
      row({ postId: P2, latestReceivedAt: new Date("2026-10-03T00:00:00Z") }),
      row({ postId: P3, latestReceivedAt: new Date("2026-10-01T00:00:00Z") }),
    ];
    expect(
      buildInboxPostGroups(rows, { sort: "newest" }).map((g) => g.postId),
    ).toEqual([P2, P1, P3]);
    expect(
      buildInboxPostGroups(rows, { sort: "oldest" }).map((g) => g.postId),
    ).toEqual([P3, P1, P2]);
  });

  it("filter status menyaring kelompok tetapi hitungan tetap atas semua komentar", () => {
    const groups = buildInboxPostGroups(
      [
        row({ postId: P1, status: "resolved", count: 2 }),
        row({ postId: P1, status: "unread", count: 1 }),
        row({ postId: P2, status: "resolved", count: 4 }),
      ],
      { sort: "newest", status: "unread" },
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      postId: P1,
      totalCount: 3,
      handledCount: 2,
    });
  });

  it("memakai akun utama yang stabil (id terkecil) dan mencatat semua akun kelompok", () => {
    const [group] = buildInboxPostGroups(
      [
        row({
          connectedAccountId: ACC_A,
          latestReceivedAt: new Date("2026-10-01T00:00:00Z"),
        }),
        row({
          connectedAccountId: ACC_B,
          platform: SocialPlatform.Facebook,
          latestReceivedAt: new Date("2026-10-02T00:00:00Z"),
        }),
      ],
      { sort: "newest" },
    );
    expect(group.connectedAccountId).toBe(ACC_A);
    expect(group.platform).toBe(SocialPlatform.Instagram);
    expect([...group.connectedAccountIds].sort()).toEqual([ACC_A, ACC_B]);
  });

  it("posting kosong yang sama dari beberapa akun hanya muncul sekali", () => {
    const groups = buildInboxPostGroups([], {
      sort: "newest",
      emptyPosts: [
        {
          postId: P2,
          connectedAccountId: ACC_A,
          platform: SocialPlatform.Instagram,
        },
        {
          postId: P2,
          connectedAccountId: ACC_B,
          platform: SocialPlatform.Facebook,
        },
      ],
    });
    expect(groups.map((g) => g.postId)).toEqual([P2]);
  });

  it("baris done lama dihitung sebagai resolved pada filter status", () => {
    const groups = buildInboxPostGroups(
      [row({ postId: P1, status: "done" as never })],
      { sort: "newest", status: "resolved" },
    );
    expect(groups.map((g) => g.postId)).toEqual([P1]);
    expect(groups[0].statuses).toEqual(["resolved"]);
  });

  it("posting tanpa komentar ikut di akhir hanya bila disuplai, tanpa menggandakan posting berkomentar", () => {
    const empty = {
      postId: P2,
      connectedAccountId: ACC_A,
      platform: SocialPlatform.Instagram,
    };
    const hidden = buildInboxPostGroups([row({ postId: P1 })], {
      sort: "newest",
    });
    expect(hidden.map((g) => g.postId)).toEqual([P1]);

    const shown = buildInboxPostGroups([row({ postId: P1 })], {
      sort: "newest",
      emptyPosts: [
        {
          postId: P1,
          connectedAccountId: ACC_A,
          platform: SocialPlatform.Instagram,
        },
        empty,
      ],
    });
    expect(shown.map((g) => g.postId)).toEqual([P1, P2]);
    expect(shown[1]).toMatchObject({
      totalCount: 0,
      unrepliedCount: 0,
      latestReceivedAt: null,
    });
  });
});

describe("inboxDateRangeStart", () => {
  const now = new Date("2026-11-06T12:00:00.000Z");

  it("7 dan 30 hari mundur dari now", () => {
    expect(inboxDateRangeStart("7d", now)).toEqual(
      new Date("2026-10-30T12:00:00.000Z"),
    );
    expect(inboxDateRangeStart("30d", now)).toEqual(
      new Date("2026-10-07T12:00:00.000Z"),
    );
  });

  it("6 dan 12 bulan mundur dengan tanggal dijepit ke akhir bulan target", () => {
    expect(inboxDateRangeStart("6m", now)).toEqual(
      new Date("2026-05-06T12:00:00.000Z"),
    );
    expect(inboxDateRangeStart("12m", now)).toEqual(
      new Date("2025-11-06T12:00:00.000Z"),
    );
    expect(
      inboxDateRangeStart("6m", new Date("2026-08-31T00:00:00.000Z")),
    ).toEqual(new Date("2026-02-28T00:00:00.000Z"));
  });
});
