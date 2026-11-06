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
  InboxItemStatus,
} from "@/domains/engagement";
import type {
  EngagementInboxItem,
  EngagementReply,
} from "@/generated/prisma/client";
import { withCurrentUser } from "@/lib/prisma/with-current-user";

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

// Cap query/payload growth — inbox item terus terakumulasi (perubahan status
// tidak archive/delete), tanpa batas ini `listInboxItems`
// tumbuh tak terbatas seiring volume histori workspace.
const LIST_INBOX_ITEMS_LIMIT = 200;

export const engagementRepository: IEngagementRepository = {
  async listInboxItems(
    { workspaceId, connectedAccountId, platform, status },
    userId,
  ) {
    const items = await withCurrentUser(userId, (tx) =>
      tx.engagementInboxItem.findMany({
        where: {
          workspaceId,
          ...(connectedAccountId ? { connectedAccountId } : {}),
          ...(platform ? { platform } : {}),
          ...(status ? { status } : {}),
        },
        orderBy: { receivedAt: "desc" },
        take: LIST_INBOX_ITEMS_LIMIT,
      }),
    );

    return items.map(mapInboxItem);
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
