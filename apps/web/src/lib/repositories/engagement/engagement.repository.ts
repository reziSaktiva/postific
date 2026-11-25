import {
  asConnectedAccountId,
  asInboxItemId,
  asPostId,
  asReplyId,
  asUserId,
  asWorkspaceId,
  type SocialPlatform,
} from "@postific/shared";
import type {
  IEngagementRepository,
  EngagementInboxItemRecord,
  EngagementReplyRecord,
  InboxItemFilter,
  InboxItemStatus,
  InboxPostGroupFilter,
  InboxPostGroupSummary,
  InboxPostSort,
} from "@/domains/engagement";
import {
  Prisma,
  type EngagementInboxItem,
  type EngagementReply,
} from "@/generated/prisma/client";
import { withCurrentUser } from "@/lib/prisma/with-current-user";

import {
  decodeGroupsCursor,
  decodeItemsCursor,
  encodeGroupsCursor,
  encodeItemsCursor,
  type ItemsCursorPosition,
} from "./inbox-cursor";

function mapInboxItem(item: EngagementInboxItem): EngagementInboxItemRecord {
  return {
    id: asInboxItemId(item.id),
    workspaceId: asWorkspaceId(item.workspaceId),
    connectedAccountId: asConnectedAccountId(item.connectedAccountId),
    platform: item.platform as SocialPlatform,
    type: item.type,
    externalId: item.externalId,
    authorHandle: item.authorHandle,
    content: item.content,
    status: item.status as InboxItemStatus,
    postId: item.postId ? asPostId(item.postId) : null,
    receivedAt: item.receivedAt,
    readAt: item.readAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function mapReply(reply: EngagementReply): EngagementReplyRecord {
  return {
    id: asReplyId(reply.id),
    inboxItemId: asInboxItemId(reply.inboxItemId),
    userId: asUserId(reply.userId),
    content: reply.content,
    outstandReplyId: reply.outstandReplyId,
    status: reply.status,
    sentAt: reply.sentAt,
    createdAt: reply.createdAt,
    updatedAt: reply.updatedAt,
  };
}

// Cap `listInboxItems` — HANYA jalur MCP (`list_comments`, ADR-166 keputusan 8:
// tool baca MCP tetap seperti semula). Engage memakai `listInboxItemsPage`
// (cursor, T-303) tanpa batas jumlah.
const LIST_INBOX_ITEMS_LIMIT = 200;
const LIST_INBOX_ITEMS_BY_POST_LIMIT = 1000;

/** Satu bagian pembacaan komentar: `where` tambahan dan arah urutan `receivedAt`. */
interface ItemSegment {
  where: Prisma.EngagementInboxItemWhereInput;
  order: "asc" | "desc";
}

/**
 * Bagian pembacaan untuk satu sort. `unreplied_first` = `unread` dulu lalu
 * sisanya (dua bagian, masing-masing terbaru dulu); Prisma tidak bisa
 * mengurutkan atas ekspresi, jadi dua kueri berurutan menggantikan `ORDER BY
 * status = 'unread'`. Filter status membuat daftar satu bagian.
 */
function itemSegments(
  sort: InboxPostSort,
  status: InboxItemStatus | undefined,
): ItemSegment[] {
  const order = sort === "oldest" ? "asc" : "desc";
  if (status) return [{ where: { status }, order }];
  if (sort === "unreplied_first") {
    return [
      { where: { status: "unread" }, order },
      { where: { status: { not: "unread" } }, order },
    ];
  }
  return [{ where: {}, order }];
}

function itemsFingerprint(
  filter: InboxItemFilter,
  sort: InboxPostSort,
): string {
  // `receivedSince` sengaja tidak ikut: batas rentang bergeser tiap permintaan.
  return JSON.stringify([
    sort,
    filter.connectedAccountId ?? null,
    filter.platform ?? null,
    filter.status ?? null,
    filter.postId === undefined ? "any" : filter.postId,
  ]);
}

function itemsBaseWhere({
  workspaceId,
  connectedAccountId,
  platform,
  status,
  postId,
  receivedSince,
}: InboxItemFilter): Prisma.EngagementInboxItemWhereInput {
  return {
    workspaceId,
    ...(connectedAccountId ? { connectedAccountId } : {}),
    ...(platform ? { platform } : {}),
    ...(status ? { status } : {}),
    ...(postId !== undefined ? { postId } : {}),
    ...(receivedSince ? { receivedAt: { gte: receivedSince } } : {}),
  };
}

/** Baris setelah `after` pada urutan (`receivedAt`, `id`) searah `order`. */
function afterPosition(
  order: "asc" | "desc",
  after: { receivedAt: Date; id: string },
): Prisma.EngagementInboxItemWhereInput {
  const cmp = order === "asc" ? "gt" : "lt";
  return {
    OR: [
      { receivedAt: { [cmp]: after.receivedAt } },
      { receivedAt: after.receivedAt, id: { [cmp]: after.id } },
    ],
  };
}

// Kelompok posting: dihitung di database (`GROUP BY post_id`). `status` `done`
// (nama lama `resolved`, sebelum migrasi T-217.4) dihitung sebagai `resolved`.
const STATUS_ALIASED = Prisma.sql`CASE WHEN "status" = 'done' THEN 'resolved' ELSE "status" END`;

interface GroupRow {
  post_key: string | null;
  total_count: number;
  unreplied_count: number;
  replied_count: number;
  latest_received_at: Date;
  oldest_received_at: Date;
  account_ids: string[];
  primary_account_id: string;
  primary_platform: string;
  statuses: string[];
}

function groupsWhere(
  filter: InboxPostGroupFilter,
  postScope: "numbered" | "none" | "all",
): Prisma.Sql {
  const conditions = [Prisma.sql`"workspace_id" = ${filter.workspaceId}::uuid`];
  if (postScope === "numbered")
    conditions.push(Prisma.sql`"post_id" IS NOT NULL`);
  if (postScope === "none") conditions.push(Prisma.sql`"post_id" IS NULL`);
  if (filter.postId)
    conditions.push(Prisma.sql`"post_id" = ${filter.postId}::uuid`);
  if (filter.connectedAccountId) {
    conditions.push(
      Prisma.sql`"connected_account_id" = ${filter.connectedAccountId}::uuid`,
    );
  }
  if (filter.platform)
    conditions.push(Prisma.sql`"platform" = ${filter.platform}`);
  if (filter.receivedSince) {
    conditions.push(
      Prisma.sql`"received_at" >= ${filter.receivedSince}::timestamptz`,
    );
  }
  return Prisma.join(conditions, " AND ");
}

/** Hanya kelompok yang punya minimal satu komentar berstatus ini (hitungan tetap atas semua). */
function groupsHaving(status: InboxItemStatus | undefined): Prisma.Sql {
  return status
    ? Prisma.sql`HAVING bool_or(${STATUS_ALIASED} = ${status})`
    : Prisma.empty;
}

function groupsFingerprint(
  filter: InboxPostGroupFilter,
  sort: InboxPostSort,
  scope: "numbered" | "none",
): string {
  return JSON.stringify([
    sort,
    scope,
    filter.connectedAccountId ?? null,
    filter.platform ?? null,
    filter.status ?? null,
    filter.postId ?? null,
  ]);
}

function mapGroup(row: GroupRow): InboxPostGroupSummary {
  const handled = row.total_count - row.unreplied_count;
  return {
    postId: row.post_key ? asPostId(row.post_key) : null,
    connectedAccountId: asConnectedAccountId(row.primary_account_id),
    platform: row.primary_platform as SocialPlatform,
    connectedAccountIds: row.account_ids.map(asConnectedAccountId),
    totalCount: row.total_count,
    unrepliedCount: row.unreplied_count,
    handledCount: handled,
    repliedCount: row.replied_count,
    latestReceivedAt: row.latest_received_at,
    oldestReceivedAt: row.oldest_received_at,
    statuses: row.statuses as InboxItemStatus[],
  };
}

export const engagementRepository: IEngagementRepository = {
  async listInboxItems(
    {
      workspaceId,
      connectedAccountId,
      platform,
      status,
      postId,
      receivedSince,
    },
    userId,
  ) {
    const items = await withCurrentUser(userId, (tx) =>
      tx.engagementInboxItem.findMany({
        where: {
          workspaceId,
          ...(connectedAccountId ? { connectedAccountId } : {}),
          ...(platform ? { platform } : {}),
          ...(status ? { status } : {}),
          ...(postId !== undefined ? { postId } : {}),
          ...(receivedSince ? { receivedAt: { gte: receivedSince } } : {}),
        },
        orderBy: { receivedAt: "desc" },
        take:
          postId !== undefined
            ? LIST_INBOX_ITEMS_BY_POST_LIMIT
            : LIST_INBOX_ITEMS_LIMIT,
      }),
    );

    return items.map(mapInboxItem);
  },

  async listInboxItemsPage(filter, { sort, cursor, limit }, userId) {
    const fingerprint = itemsFingerprint(filter, sort);
    const segments = itemSegments(sort, filter.status);
    const start = decodeItemsCursor(cursor, fingerprint, segments.length);
    const base = itemsBaseWhere(filter);

    return withCurrentUser(userId, async (tx) => {
      const items: EngagementInboxItem[] = [];
      let next: ItemsCursorPosition | null = null;
      for (let g = start.segment; g < segments.length && !next; g += 1) {
        const { where, order } = segments[g];
        const room = limit - items.length;
        const rows = await tx.engagementInboxItem.findMany({
          where: {
            AND: [
              base,
              where,
              ...(g === start.segment && start.after
                ? [afterPosition(order, start.after)]
                : []),
            ],
          },
          orderBy: [{ receivedAt: order }, { id: order }],
          // Satu baris lebih tahu apakah masih ada isi; jika `room` 0 (halaman
          // tepat penuh), satu baris itu menentukan bagian berikutnya kosong atau tidak.
          take: room + 1,
        });
        if (rows.length > room) {
          const kept = rows.slice(0, room);
          items.push(...kept);
          const last = kept[kept.length - 1];
          next = last
            ? {
                segment: g,
                after: { receivedAt: last.receivedAt, id: last.id },
              }
            : { segment: g, after: g === start.segment ? start.after : null };
        } else {
          items.push(...rows);
        }
      }
      return {
        items: items.map(mapInboxItem),
        nextCursor: next ? encodeItemsCursor(fingerprint, next) : null,
      };
    });
  },

  async countInboxItems(filter, userId) {
    const base = itemsBaseWhere(filter);
    const [total, unread] = await withCurrentUser(userId, (tx) =>
      Promise.all([
        tx.engagementInboxItem.count({ where: base }),
        tx.engagementInboxItem.count({
          where: { AND: [base, { status: "unread" }] },
        }),
      ]),
    );
    return { total, unread };
  },

  async listInboxPostGroups(filter, scope, { sort, cursor, limit }, userId) {
    const fingerprint = groupsFingerprint(filter, sort, scope);
    const position = cursor
      ? decodeGroupsCursor(cursor, fingerprint, sort === "unreplied_first")
      : null;

    // Urutan: kunci urut lalu id posting naik (tie-breaker stabil); pagar
    // posisi mengikuti urutan yang sama, tanpa offset.
    let keyset = Prisma.empty;
    let orderBy: Prisma.Sql;
    if (sort === "unreplied_first") {
      orderBy = Prisma.sql`ORDER BY g."unreplied_count" DESC, g."latest_received_at" DESC, g."post_id" ASC`;
      if (position) {
        keyset = Prisma.sql`WHERE (g."unreplied_count" < ${position.unreplied}
          OR (g."unreplied_count" = ${position.unreplied}
            AND (g."latest_received_at" < ${position.latestReceivedAt}::timestamptz
              OR (g."latest_received_at" = ${position.latestReceivedAt}::timestamptz
                AND g."post_id" > ${position.postId}::uuid))))`;
      }
    } else {
      const ascending = sort === "oldest";
      orderBy = ascending
        ? Prisma.sql`ORDER BY g."latest_received_at" ASC, g."post_id" ASC`
        : Prisma.sql`ORDER BY g."latest_received_at" DESC, g."post_id" ASC`;
      if (position) {
        const beyond = ascending
          ? Prisma.sql`g."latest_received_at" > ${position.latestReceivedAt}::timestamptz`
          : Prisma.sql`g."latest_received_at" < ${position.latestReceivedAt}::timestamptz`;
        keyset = Prisma.sql`WHERE (${beyond}
          OR (g."latest_received_at" = ${position.latestReceivedAt}::timestamptz
            AND g."post_id" > ${position.postId}::uuid))`;
      }
    }

    const rows = await withCurrentUser(
      userId,
      (tx) =>
        tx.$queryRaw<GroupRow[]>`
        WITH g AS (
          SELECT
            "post_id",
            (count(*))::int AS "total_count",
            (count(*) FILTER (WHERE "status" = 'unread'))::int AS "unreplied_count",
            (count(*) FILTER (WHERE "status" = 'replied'))::int AS "replied_count",
            max("received_at") AS "latest_received_at",
            min("received_at") AS "oldest_received_at",
            array_agg(DISTINCT "connected_account_id"::text) AS "account_ids",
            (array_agg("connected_account_id"::text ORDER BY "connected_account_id"))[1] AS "primary_account_id",
            (array_agg("platform" ORDER BY "connected_account_id"))[1] AS "primary_platform",
            array_agg(DISTINCT ${STATUS_ALIASED}) AS "statuses"
          FROM "engagement_inbox_items"
          WHERE ${groupsWhere(filter, scope)}
          GROUP BY "post_id"
          ${groupsHaving(filter.status)}
        )
        SELECT g."post_id"::text AS "post_key", g."total_count", g."unreplied_count",
               g."replied_count", g."latest_received_at", g."oldest_received_at",
               g."account_ids", g."primary_account_id", g."primary_platform", g."statuses"
        FROM g
        ${keyset}
        ${orderBy}
        LIMIT ${limit + 1}`,
    );

    const kept = rows.slice(0, limit);
    const last = kept[kept.length - 1];
    const nextCursor =
      rows.length > limit && last?.post_key
        ? encodeGroupsCursor(fingerprint, {
            unreplied: sort === "unreplied_first" ? last.unreplied_count : null,
            latestReceivedAt: last.latest_received_at,
            postId: last.post_key,
          })
        : null;
    return { items: kept.map(mapGroup), nextCursor };
  },

  async countInboxPostGroups(filter, userId) {
    const rows = await withCurrentUser(
      userId,
      (tx) =>
        tx.$queryRaw<{ post_count: number; unreplied_count: number }[]>`
        WITH g AS (
          SELECT
            "post_id",
            (count(*) FILTER (WHERE "status" = 'unread'))::int AS "unreplied_count"
          FROM "engagement_inbox_items"
          WHERE ${groupsWhere(filter, "all")}
          GROUP BY "post_id"
          ${groupsHaving(filter.status)}
        )
        SELECT (count(*) FILTER (WHERE g."post_id" IS NOT NULL))::int AS "post_count",
               (coalesce(sum(g."unreplied_count"), 0))::int AS "unreplied_count"
        FROM g`,
    );
    return {
      postCount: rows[0]?.post_count ?? 0,
      unrepliedCount: rows[0]?.unreplied_count ?? 0,
    };
  },

  async findPostIdsWithInboxItems(
    { workspaceId, postIds, connectedAccountId, platform, receivedSince },
    userId,
  ) {
    if (postIds.length === 0) return [];
    const rows = await withCurrentUser(userId, (tx) =>
      tx.engagementInboxItem.findMany({
        where: {
          workspaceId,
          postId: { in: postIds },
          ...(connectedAccountId ? { connectedAccountId } : {}),
          ...(platform ? { platform } : {}),
          ...(receivedSince ? { receivedAt: { gte: receivedSince } } : {}),
        },
        select: { postId: true },
        distinct: ["postId"],
      }),
    );
    return rows.flatMap((row) => (row.postId ? [asPostId(row.postId)] : []));
  },

  async findInboxItemById({ workspaceId, inboxItemId }, userId) {
    const item = await withCurrentUser(userId, (tx) =>
      tx.engagementInboxItem.findFirst({
        where: { id: inboxItemId, workspaceId },
      }),
    );

    return item ? mapInboxItem(item) : null;
  },

  async upsertInboxItem(
    {
      workspaceId,
      connectedAccountId,
      platform,
      type,
      externalId,
      authorHandle,
      content,
      receivedAt,
      postId,
    },
    userId,
  ) {
    return withCurrentUser(userId, async (tx) => {
      // Advisory lock per `connectedAccountId` (dilepas otomatis saat
      // transaksi commit/rollback) — mencegah dua `sync()` yang berjalan
      // bersamaan untuk akun yang sama (mis. refresh manual vs cron JOB-03)
      // sama-sama melihat `findUnique` di bawah sebagai "belum ada" untuk
      // komentar yang sama, yang akan menggandakan `isNew`/notifikasi
      // agregat. `findUnique` sendiri sudah atomik terhadap `upsert` di
      // bawah (satu transaksi yang sama); lock ini menyerialkan ANTAR
      // transaksi/invocation `upsertInboxItem`, bukan dalam satu transaksi.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${connectedAccountId})::bigint)`;

      // `findUnique` DULU (dalam transaksi yang sama dengan `upsert` di
      // bawah) supaya "apakah baris ini baru dibuat" atomik, bukan
      // diasumsikan dari `createdAt === updatedAt` (rapuh terhadap clock
      // skew/rounding) — dibutuhkan T-051 untuk menghitung
      // `newCommentsCount` (notifikasi aggregate JOB-03).
      const existing = await tx.engagementInboxItem.findUnique({
        where: {
          workspaceId_connectedAccountId_externalId: {
            workspaceId,
            connectedAccountId,
            externalId,
          },
        },
        select: { id: true },
      });

      const item = await tx.engagementInboxItem.upsert({
        where: {
          workspaceId_connectedAccountId_externalId: {
            workspaceId,
            connectedAccountId,
            externalId,
          },
        },
        create: {
          workspaceId,
          connectedAccountId,
          platform,
          type,
          externalId,
          authorHandle,
          content,
          receivedAt,
          ...(postId ? { postId } : {}),
        },
        update: {
          authorHandle,
          content,
          // Backfill `postId` kalau baris lama sempat terbuat tanpa join
          // (sebelum KI-068 wiring) — aman overwrite hanya saat caller
          // menyuplai nilai (null/undefined tidak menimpa yang sudah ada).
          ...(postId ? { postId } : {}),
        },
      });

      return { item: mapInboxItem(item), isNew: existing === null };
    });
  },

  async markInboxItemStatus(
    { workspaceId, inboxItemId, status, onlyFromStatus },
    userId,
  ) {
    const item = await withCurrentUser(userId, async (tx) => {
      await tx.engagementInboxItem.updateMany({
        where: {
          id: inboxItemId,
          workspaceId,
          ...(onlyFromStatus ? { status: onlyFromStatus } : {}),
        },
        data: { status },
      });

      // `readAt` = kapan status pertama kali keluar dari `unread`; hanya
      // diisi bila masih kosong supaya tidak tertimpa tindakan berikutnya.
      if (status !== "unread") {
        await tx.engagementInboxItem.updateMany({
          where: { id: inboxItemId, workspaceId, readAt: null, status },
          data: { readAt: new Date() },
        });
      }

      // Tidak cocok `onlyFromStatus` / sudah berstatus sama: kembalikan baris
      // apa adanya (idempoten); `null` hanya bila memang tidak ditemukan.
      return tx.engagementInboxItem.findFirst({
        where: { id: inboxItemId, workspaceId },
      });
    });

    return item ? mapInboxItem(item) : null;
  },

  async countUnreadInboxItems({ workspaceId, since }, userId) {
    return withCurrentUser(userId, (tx) =>
      tx.engagementInboxItem.count({
        where: { workspaceId, status: "unread", receivedAt: { gte: since } },
      }),
    );
  },

  async createReply(
    { inboxItemId, userId: authorId, content, outstandReplyId },
    userId,
  ) {
    const reply = await withCurrentUser(userId, (tx) =>
      tx.engagementReply.create({
        data: {
          inboxItemId,
          userId: authorId,
          content,
          outstandReplyId,
          // Method ini hanya dipanggil `EngagementService.reply` (T-054)
          // SETELAH `IOutstandAdapter.replyToComment` sukses — status
          // default schema "pending" tidak pernah relevan di jalur ini.
          status: "sent",
        },
      }),
    );

    return mapReply(reply);
  },

  async listRepliesByInboxItemId(inboxItemId, userId) {
    const replies = await withCurrentUser(userId, (tx) =>
      tx.engagementReply.findMany({
        where: { inboxItemId },
        orderBy: { sentAt: "asc" },
      }),
    );

    return replies.map(mapReply);
  },
};
