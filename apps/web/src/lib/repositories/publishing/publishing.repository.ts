import {
  asConnectedAccountId,
  asMediaId,
  asPostId,
  asPostTargetId,
  asUserId,
  asWorkspaceId,
  type ConnectedAccountId,
  ContentFormat,
  ContentStatus,
  type SocialPlatform,
} from "@postific/shared";
import {
  HISTORY_TERMINAL_STATUSES,
  type CalendarItemRecord,
  type CalendarItemTargetRecord,
  type HistoryItemRecord,
  type HistoryItemTargetRecord,
  type IPublishingRepository,
  type PublishingCancelScheduleRecord,
  type PublishingPostRecord,
  type PublishingPostTargetStatus,
  type PublishingScheduleRecord,
  type QueueItemRecord,
  type RetryTargetRecord,
  type WebhookPostLookupRecord,
} from "@/domains/publishing";
import {
  Prisma,
  type PublishingPost,
  type PublishingPostTarget,
  type WorkspaceConnectedAccount,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import {
  setCurrentUserId,
  withCurrentUser,
} from "@/lib/prisma/with-current-user";

/**
 * Sentinel internal — dilempar di dalam `$transaction` supaya semua
 * mutasi (termasuk `updateMany` status Draft/ReadyToSchedule → Scheduled
 * yang sudah terjadi) ikut di-rollback saat guard ownership gagal.
 * Return `null` biasa (tanpa throw) TIDAK cukup: Prisma tetap commit
 * transaksi kalau callback selesai normal, jadi post bisa "setengah"
 * ter-Scheduled tanpa target yang valid. Tidak diexport — murni detail
 * implementasi repository ini.
 */
class ScheduleOwnershipGuardFailed extends Error {}

/**
 * Guard bug T-034.2/T-034.3 (laporan QA Najwa, 2026-09-08): kolom `id`
 * bertipe `uuid` di Postgres — `postId` dari URL segment `[postId]` yang
 * bukan format UUID valid (mis. "not-a-valid-uuid") membuat Postgres
 * menolak query dengan "invalid input syntax for type uuid" sebelum
 * sempat mengevaluasi kondisi `WHERE`, jadi Prisma melempar
 * `PrismaClientKnownRequestError` (bukan return `null` seperti kasus
 * "tidak ketemu" biasa). Konsisten pola `isRecordNotFound` di
 * `workspace.repository.ts`: treat sebagai "tidak ketemu" di sini
 * (repository), bukan dibiarkan bocor sebagai Prisma error mentah ke
 * `PublishingService` (AGENTS.md #6) — caller (`getHistoryById`) tetap
 * cukup menangani `null` seperti kasus not-found lainnya.
 */
function isInvalidIdFormat(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2007" || error.code === "P2023")
  );
}

/**
 * `PublishingPost.authorId` jadi nullable sejak ADR-093 (T-090.1) —
 * `null` HANYA valid untuk status `Imported`. `mapPost` di bawah ini
 * HANYA pernah dipanggil dengan baris dari query yang TIDAK PERNAH
 * mengembalikan status `Imported` (`createDraft`, `schedulePost`,
 * `publishNow`, `cancelSchedule`, `softDeletePost`, dan query draft
 * lain yang dideklarasikan `IPublishingRepository` — semuanya mengubah
 * atau membaca post pada jalur Draft→Schedule/Publish, tidak pernah
 * Imported). Throw loud (pola ADR-059 poin 6) kalau asumsi itu ternyata
 * salah, bukan diam-diam meloloskan `UserId` kosong ke pemanggil.
 */
function requireAuthorId(authorId: string | null, context: string) {
  if (!authorId) {
    throw new Error(
      `${context}: authorId null — tidak didukung di jalur ini (hanya post ` +
        `berstatus Imported yang boleh authorId null, ADR-093).`,
    );
  }
  return asUserId(authorId);
}

function mapPost(post: PublishingPost): PublishingPostRecord {
  return {
    id: asPostId(post.id),
    workspaceId: asWorkspaceId(post.workspaceId),
    authorId: requireAuthorId(post.authorId, "mapPost"),
    caption: post.caption,
    status: post.status as ContentStatus,
    mediaIds: post.mediaIds.map((id) => asMediaId(id)),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

type QueuePostWithTargets = PublishingPost & {
  targets: (PublishingPostTarget & {
    connectedAccount: WorkspaceConnectedAccount;
  })[];
};

function mapQueueItem(post: QueuePostWithTargets): QueueItemRecord {
  return {
    id: asPostId(post.id),
    caption: post.caption,
    // Non-null: query di bawah menyaring status Scheduled, yang hanya
    // ditetapkan bersamaan dengan `scheduledAt` (lihat `schedulePost`).
    scheduledAt: post.scheduledAt as Date,
    createdAt: post.createdAt,
    targets: post.targets.map((target) => ({
      id: asPostTargetId(target.id),
      connectedAccountId: asConnectedAccountId(target.connectedAccountId),
      platform: target.platform as SocialPlatform,
      contentFormat: target.contentFormat as ContentFormat,
      accountHandle: target.connectedAccount.handle,
    })),
  };
}

function mapCalendarItem(post: QueuePostWithTargets): CalendarItemRecord {
  return {
    id: asPostId(post.id),
    caption: post.caption,
    status: post.status as ContentStatus,
    scheduledAt: post.scheduledAt,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    targets: post.targets.map((target): CalendarItemTargetRecord => ({
      id: asPostTargetId(target.id),
      connectedAccountId: asConnectedAccountId(target.connectedAccountId),
      platform: target.platform as SocialPlatform,
      contentFormat: target.contentFormat as ContentFormat,
      accountHandle: target.connectedAccount.handle,
      platformPostUrl: target.platformPostUrl,
    })),
  };
}

function mapHistoryItem(post: QueuePostWithTargets): HistoryItemRecord {
  return {
    id: asPostId(post.id),
    caption: post.caption,
    status: post.status as ContentStatus,
    scheduledAt: post.scheduledAt,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    mediaIds: post.mediaIds.map((id) => asMediaId(id)),
    targets: post.targets.map((target): HistoryItemTargetRecord => ({
      id: asPostTargetId(target.id),
      connectedAccountId: asConnectedAccountId(target.connectedAccountId),
      platform: target.platform as SocialPlatform,
      contentFormat: target.contentFormat as ContentFormat,
      accountHandle: target.connectedAccount.handle,
      status: target.status as PublishingPostTargetStatus,
      platformPostUrl: target.platformPostUrl,
      error: target.error,
    })),
  };
}

export const publishingRepository: IPublishingRepository = {
  async createDraft({ workspaceId, authorId, caption, mediaIds }) {
    const post = await withCurrentUser(authorId, (tx) =>
      tx.publishingPost.create({
        data: {
          workspaceId,
          authorId,
          caption,
          ...(mediaIds !== undefined ? { mediaIds } : {}),
        },
      }),
    );

    return mapPost(post);
  },

  async listDrafts({ workspaceId }, userId) {
    // Kriteria tampilan Drafts (T-104, koreksi gap T-092.5/ADR-094 poin 5):
    // Draft, InReview, DAN ReadyToSchedule — bukan hanya Draft. Harus
    // konsisten dengan `DRAFT_VIEW_STATUSES` (client-side filter granular
    // patch Realtime) di
    // `apps/web/src/app/(app)/publish/drafts/components/DraftsList.tsx`
    // (`toDraftListItem`) — sebelum fix ini, initial SSR load (method ini)
    // hanya mengembalikan status Draft sementara patch Realtime granular
    // sudah menerima 3 status, jadi post InReview/ReadyToSchedule baru
    // muncul di Drafts SETELAH ada event Realtime, tidak muncul di initial
    // load.
    const posts = await withCurrentUser(userId, (tx) =>
      tx.publishingPost.findMany({
        where: {
          workspaceId,
          status: {
            in: [
              ContentStatus.Draft,
              ContentStatus.InReview,
              ContentStatus.ReadyToSchedule,
            ],
          },
          deletedAt: null,
        },
        orderBy: { updatedAt: "desc" },
      }),
    );

    return posts.map(mapPost);
  },

  async findDraftById({ workspaceId, postId }, userId) {
    const post = await withCurrentUser(userId, (tx) =>
      tx.publishingPost.findFirst({
        where: {
          id: postId,
          workspaceId,
          deletedAt: null,
        },
      }),
    );

    return post ? mapPost(post) : null;
  },

  async updateDraftCaption({ workspaceId, postId, caption, mediaIds }, userId) {
    const post = await withCurrentUser(userId, async (tx) => {
      const { count } = await tx.publishingPost.updateMany({
        where: {
          id: postId,
          workspaceId,
          status: ContentStatus.Draft,
          deletedAt: null,
        },
        data: {
          caption,
          // `undefined` (bukan dipass sama sekali) = kolom `mediaIds` TIDAK
          // disentuh (mempertahankan nilai lama) — beda dari `[]` yang
          // secara eksplisit mengosongkan lampiran media post ini. Lihat
          // catatan di `IPublishingRepository.updateDraftCaption`.
          ...(mediaIds !== undefined ? { mediaIds } : {}),
        },
      });

      if (count === 0) {
        return null;
      }

      return tx.publishingPost.findUniqueOrThrow({
        where: { id: postId },
      });
    });

    return post ? mapPost(post) : null;
  },

  async schedulePost({ workspaceId, postId, scheduledAt, targets }, userId) {
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        // `setCurrentUserId` (bukan `withCurrentUser`) karena method ini
        // sudah punya transaksi sendiri (guard ownership anti-IDOR di
        // bawah wajib atomik dengan updateMany status) — `withCurrentUser`
        // akan membuka transaksi kedua yang terpisah, memecah atomicity.
        await setCurrentUserId(tx, userId);

        const { count } = await tx.publishingPost.updateMany({
          where: {
            id: postId,
            workspaceId,
            status: {
              in: [ContentStatus.Draft, ContentStatus.ReadyToSchedule],
            },
            deletedAt: null,
          },
          data: { status: ContentStatus.Scheduled, scheduledAt },
        });

        if (count === 0) {
          return null;
        }

        // Guard ownership (anti-IDOR) — `connectedAccountId` datang dari
        // caller (Server Action, dan nanti Route Handler /api/v1 AL-D08)
        // dan WAJIB diverifikasi milik `workspaceId` yang sama di sini,
        // bukan hanya di layer atas (`actions.ts`), supaya caller lain
        // tidak bisa menjadwalkan post ke akun media sosial milik
        // workspace lain (cross-tenant IDOR) kalau lupa mereplikasi guard
        // itu.
        const uniqueConnectedAccountIds = Array.from(
          new Set(targets.map((target) => target.connectedAccountId)),
        );
        const ownedAccountCount = await tx.workspaceConnectedAccount.count({
          where: {
            id: { in: uniqueConnectedAccountIds },
            workspaceId,
          },
        });
        if (ownedAccountCount !== uniqueConnectedAccountIds.length) {
          // Setidaknya satu connectedAccountId bukan milik workspace ini —
          // batalkan seluruh transaksi (termasuk updateMany status di atas)
          // lewat throw, bukan return null, supaya tidak commit.
          throw new ScheduleOwnershipGuardFailed();
        }

        await tx.publishingPostTarget.deleteMany({ where: { postId } });

        await tx.publishingPostTarget.createMany({
          data: targets.map((target) => ({
            postId,
            connectedAccountId: target.connectedAccountId,
            platform: target.platform,
            contentFormat: target.contentFormat,
            platformOptions: (target.platformOptions ?? undefined) as
              Prisma.InputJsonValue | undefined,
            status: "pending",
          })),
        });

        const post = await tx.publishingPost.findUniqueOrThrow({
          where: { id: postId },
        });
        const createdTargets = await tx.publishingPostTarget.findMany({
          where: { postId },
          select: { id: true, connectedAccountId: true },
        });

        return { post, createdTargets };
      });
    } catch (error) {
      if (error instanceof ScheduleOwnershipGuardFailed) {
        return null;
      }
      throw error;
    }

    if (!result) {
      return null;
    }

    const record: PublishingScheduleRecord = {
      ...mapPost(result.post),
      targets: result.createdTargets.map((target) => ({
        id: asPostTargetId(target.id),
        connectedAccountId: asConnectedAccountId(target.connectedAccountId),
      })),
    };

    return record;
  },

  async updateTargetOutcome(
    { postTargetId, platformPostId, status, platformPostUrl, error },
    userId,
  ) {
    await withCurrentUser(userId, (tx) =>
      tx.publishingPostTarget.update({
        where: { id: postTargetId },
        data: { platformPostId, status, platformPostUrl, error },
      }),
    );
  },

  async setOutstandPostId({ workspaceId, postId, outstandPostId }, userId) {
    await withCurrentUser(userId, (tx) =>
      tx.publishingPost.updateMany({
        where: { id: postId, workspaceId },
        data: { outstandPostId },
      }),
    );
  },

  async publishNow({ workspaceId, postId, targets }, userId) {
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        // Sama alasan dengan `schedulePost` — guard ownership anti-IDOR di
        // bawah wajib atomik dengan updateMany status, jadi tidak bisa
        // memakai `withCurrentUser` (transaksi terpisah).
        await setCurrentUserId(tx, userId);

        const { count } = await tx.publishingPost.updateMany({
          where: {
            id: postId,
            workspaceId,
            status: {
              in: [ContentStatus.Draft, ContentStatus.ReadyToSchedule],
            },
            deletedAt: null,
          },
          data: { status: ContentStatus.Published, publishedAt: new Date() },
        });

        if (count === 0) {
          return null;
        }

        const uniqueConnectedAccountIds = Array.from(
          new Set(targets.map((target) => target.connectedAccountId)),
        );
        const ownedAccountCount = await tx.workspaceConnectedAccount.count({
          where: {
            id: { in: uniqueConnectedAccountIds },
            workspaceId,
          },
        });
        if (ownedAccountCount !== uniqueConnectedAccountIds.length) {
          throw new ScheduleOwnershipGuardFailed();
        }

        await tx.publishingPostTarget.deleteMany({ where: { postId } });

        await tx.publishingPostTarget.createMany({
          data: targets.map((target) => ({
            postId,
            connectedAccountId: target.connectedAccountId,
            platform: target.platform,
            contentFormat: target.contentFormat,
            platformOptions: (target.platformOptions ?? undefined) as
              Prisma.InputJsonValue | undefined,
            status: "pending",
          })),
        });

        const post = await tx.publishingPost.findUniqueOrThrow({
          where: { id: postId },
        });
        const createdTargets = await tx.publishingPostTarget.findMany({
          where: { postId },
          select: { id: true, connectedAccountId: true },
        });

        return { post, createdTargets };
      });
    } catch (error) {
      if (error instanceof ScheduleOwnershipGuardFailed) {
        return null;
      }
      throw error;
    }

    if (!result) {
      return null;
    }

    const record: PublishingScheduleRecord = {
      ...mapPost(result.post),
      targets: result.createdTargets.map((target) => ({
        id: asPostTargetId(target.id),
        connectedAccountId: asConnectedAccountId(target.connectedAccountId),
      })),
    };

    return record;
  },

  async countScheduledByAccount({ workspaceId, connectedAccountIds }, userId) {
    const rows = await withCurrentUser(userId, (tx) =>
      tx.publishingPostTarget.groupBy({
        by: ["connectedAccountId"],
        where: {
          connectedAccountId: { in: connectedAccountIds },
          post: {
            workspaceId,
            status: ContentStatus.Scheduled,
            deletedAt: null,
          },
        },
        _count: { _all: true },
      }),
    );

    return new Map(
      rows.map((row) => [
        asConnectedAccountId(row.connectedAccountId),
        row._count._all,
      ]),
    ) as Map<ConnectedAccountId, number>;
  },

  async cancelSchedule({ workspaceId, postId }, userId) {
    const result = await withCurrentUser(userId, async (tx) => {
      // Guard dulu — kalau post bukan Scheduled di workspace ini (double
      // klik, UI basi, salah workspace), keluar lebih awal tanpa membuang
      // query findMany di bawah untuk data yang tidak akan dipakai.
      const { count } = await tx.publishingPost.updateMany({
        where: {
          id: postId,
          workspaceId,
          status: ContentStatus.Scheduled,
          deletedAt: null,
        },
        data: { status: ContentStatus.Draft, scheduledAt: null },
      });

      if (count === 0) {
        return null;
      }

      // Status/error target diambil untuk log diagnostik target yang sempat
      // gagal, SEBELUM dihapus. `post.outstandPostId` (dibaca di bawah lewat
      // `findUniqueOrThrow`, sengaja TIDAK di-null-kan oleh `updateMany` di
      // atas) dibutuhkan use-case pemanggil untuk membatalkan SATU post yang
      // sama di sisi Outstand setelah transaksi ini commit (adapter call
      // tidak boleh terjadi di dalam transaksi, sama alasan dengan
      // schedulePost/publishNow) — nilai lama ini otomatis tergantikan kalau
      // post dijadwalkan ulang (`setOutstandPostId` dipanggil lagi), jadi
      // tidak masalah dibiarkan di kolom sampai itu terjadi.
      const existingTargets = await tx.publishingPostTarget.findMany({
        where: { postId },
        select: {
          platform: true,
          status: true,
          error: true,
        },
      });

      // Post kembali ke Draft tidak punya target persisten — sama seperti
      // Draft yang belum pernah dijadwalkan (schedulePost selalu
      // deleteMany + recreate saat (re)schedule). Target yang sempat
      // tercatat `failed` (partial-publish sebelum dibatalkan) kehilangan
      // baris diagnostiknya di sini — log dulu supaya tidak hilang tanpa
      // jejak sama sekali (tidak ada audit trail lain untuk kasus ini).
      const failedTargets = existingTargets.filter(
        (target) => target.status === "failed",
      );
      if (failedTargets.length > 0) {
        console.warn(
          `[cancelSchedule] postId=${postId} membatalkan ${failedTargets.length} target yang sudah berstatus "failed" sebelum sempat dibatalkan — riwayat error akan terhapus:`,
          failedTargets.map((target) => ({
            platform: target.platform,
            error: target.error,
          })),
        );
      }

      await tx.publishingPostTarget.deleteMany({ where: { postId } });

      const post = await tx.publishingPost.findUniqueOrThrow({
        where: { id: postId },
      });

      return { post, existingTargets };
    });

    if (!result) {
      return null;
    }

    const record: PublishingCancelScheduleRecord = {
      ...mapPost(result.post),
      outstandPostId: result.post.outstandPostId,
    };

    return record;
  },

  async markPostFailed({ workspaceId, postId, reason }, userId) {
    // T-027 bug fix — SENGAJA TIDAK throw kalau 0 baris ter-update, sama
    // seperti `markPostPublished` di bawah: `resolvePostOutcome` bisa sah
    // dipanggil lebih dari sekali untuk `outstandPostId` yang sama (job
    // polling T-027 dan webhook T-026 bisa sama-sama menyimpulkan "semua
    // target gagal" untuk post yang sama), dan panggilan kedua yang
    // menemukan post SUDAH `Failed` harus diam-diam no-op, bukan throw.
    //
    // T-107 (koreksi KI-049/KI-063) — `failedAt`/`failureReason` sekarang
    // benar-benar ditulis (sebelumnya hanya `status`). Lihat catatan
    // panjang di `IPublishingRepository.markPostFailed` untuk kontrak
    // `reason` per caller.
    //
    // KI-081 (code-review PR #140, finding #2) — `publishedAt: null`
    // ditambahkan di sini supaya status `Failed` tidak pernah menyisakan
    // timestamp publish yang keliru. Sumber inkonsistensi: `PublishNowUseCase`
    // menandai `publishedAt` DI MUKA lewat `publishNow` (di bawah) sebelum
    // outcome per-target diketahui — kalau SEMUA target ternyata gagal,
    // method ini mengoreksi `status` ke `Failed`, tapi `publishedAt` yang
    // sudah kadung terisi tidak pernah di-null-kan. Aman di-null-kan tanpa
    // syarat untuk SEMUA caller (termasuk `SchedulePostsUseCase`, yang
    // tidak pernah mengisi `publishedAt` sejak awal — kolomnya sudah `null`,
    // jadi `updateMany` ini no-op untuk jalur itu).
    await withCurrentUser(userId, (tx) =>
      tx.publishingPost.updateMany({
        where: {
          id: postId,
          workspaceId,
          // Redesain ACL 2026-08-26: sekarang juga dipanggil dari
          // SchedulePostsUseCase (satu call schedulePost gagal total →
          // semua target pasti gagal), bukan hanya PublishNowUseCase.
          status: { in: [ContentStatus.Published, ContentStatus.Scheduled] },
          deletedAt: null,
        },
        data: {
          status: ContentStatus.Failed,
          failedAt: new Date(),
          failureReason: reason,
          publishedAt: null,
        },
      }),
    );
  },

  async markPostPublished({ workspaceId, postId }, userId) {
    // T-027 bug fix — SENGAJA TIDAK throw kalau count === 0 (beda dari
    // `markPostFailed` di atas): lihat catatan panjang di
    // `IPublishingRepository.markPostPublished` — `resolvePostOutcome`
    // yang memanggil ini bisa sah dipanggil lebih dari sekali untuk
    // `outstandPostId` yang sama (dua webhook event Outstand berbeda,
    // bukan duplikat receipt), dan panggilan kedua yang menemukan post
    // SUDAH `Published` harus diam-diam no-op.
    //
    // T-107 (koreksi KI-049) — `publishedAt` sekarang benar-benar ditulis
    // (sebelumnya hanya `status`), konsisten dengan `publishNow` di bawah
    // yang sudah mengisi field ini sejak awal.
    await withCurrentUser(userId, (tx) =>
      tx.publishingPost.updateMany({
        where: {
          id: postId,
          workspaceId,
          status: ContentStatus.Scheduled,
          deletedAt: null,
        },
        data: { status: ContentStatus.Published, publishedAt: new Date() },
      }),
    );
  },

  async listQueue({ workspaceId }, userId) {
    const posts = await withCurrentUser(userId, (tx) =>
      tx.publishingPost.findMany({
        where: {
          workspaceId,
          status: ContentStatus.Scheduled,
          deletedAt: null,
        },
        orderBy: { scheduledAt: "asc" },
        include: {
          targets: {
            include: { connectedAccount: true },
          },
        },
      }),
    );

    return posts.map(mapQueueItem);
  },

  async listCalendarPosts(
    { workspaceId, from, to, connectedAccountIds, statuses },
    userId,
  ) {
    const posts = await withCurrentUser(userId, (tx) =>
      tx.publishingPost.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          ...(statuses && statuses.length > 0
            ? { status: { in: statuses } }
            : {}),
          ...(connectedAccountIds && connectedAccountIds.length > 0
            ? {
                targets: {
                  some: { connectedAccountId: { in: connectedAccountIds } },
                },
              }
            : {}),
          // Rentang generik (T-033.1) — post yang JADWALNYA ATAU HASIL
          // PUBLISHNYA jatuh di [from, to]. Draft/InReview/ReadyToSchedule
          // tidak punya scheduledAt maupun publishedAt terisi di runtime
          // manapun saat ini, jadi otomatis tidak lolos filter ini — lihat
          // catatan gap di `CalendarItemRecord`.
          OR: [
            { scheduledAt: { gte: from, lte: to } },
            { publishedAt: { gte: from, lte: to } },
          ],
        },
        include: {
          targets: {
            include: { connectedAccount: true },
          },
        },
      }),
    );

    return posts.map(mapCalendarItem);
  },

  async getCalendarPostById({ workspaceId, postId }, userId) {
    let post;
    try {
      post = await withCurrentUser(userId, (tx) =>
        tx.publishingPost.findFirst({
          where: {
            id: postId,
            workspaceId,
            deletedAt: null,
          },
          include: {
            targets: {
              include: { connectedAccount: true },
            },
          },
        }),
      );
    } catch (error) {
      if (isInvalidIdFormat(error)) {
        return null;
      }
      throw error;
    }

    return post ? mapCalendarItem(post) : null;
  },

  async listHistory(
    { workspaceId, statuses, connectedAccountIds, publishedAtRange },
    userId,
  ) {
    // `statuses` sudah di-clamp ke HISTORY_TERMINAL_STATUSES oleh
    // `PublishingService.listHistory` — repository ini murni proyeksi,
    // tidak menegakkan invariant sendiri (konsisten `listCalendarPosts`).
    const effectiveStatuses =
      statuses && statuses.length > 0 ? statuses : HISTORY_TERMINAL_STATUSES;
    const posts = await withCurrentUser(userId, (tx) =>
      tx.publishingPost.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          status: { in: [...effectiveStatuses] },
          ...(connectedAccountIds && connectedAccountIds.length > 0
            ? {
                targets: {
                  some: { connectedAccountId: { in: connectedAccountIds } },
                },
              }
            : {}),
          // Half-open `[from, to)` — konsisten dengan filter JS di
          // `PublishingService.getPostPerformance` (review finding
          // 2026-09-22): `lt`, BUKAN `lte`, supaya dua rentang bersebelahan
          // (current/previous di `getComparativeReport`) tidak overlap di
          // titik sambungnya.
          ...(publishedAtRange
            ? {
                publishedAt: {
                  gte: publishedAtRange.from,
                  lt: publishedAtRange.to,
                },
              }
            : {}),
        },
        // Proksi "waktu selesai" — lihat catatan gap `failedAt` di
        // `IPublishingRepository.listHistory`.
        orderBy: { updatedAt: "desc" },
        include: {
          targets: {
            include: { connectedAccount: true },
          },
        },
      }),
    );

    return posts.map(mapHistoryItem);
  },

  async getHistoryById({ workspaceId, postId }, userId) {
    let post;
    try {
      post = await withCurrentUser(userId, (tx) =>
        tx.publishingPost.findFirst({
          where: {
            id: postId,
            workspaceId,
            deletedAt: null,
            // Invariant "history = post selesai" ditegakkan langsung di
            // sini (beda dari `listHistory`, tidak ada input `statuses`
            // untuk method single-item ini).
            status: { in: [...HISTORY_TERMINAL_STATUSES] },
          },
          include: {
            targets: {
              include: { connectedAccount: true },
            },
          },
        }),
      );
    } catch (error) {
      if (isInvalidIdFormat(error)) {
        return null;
      }
      throw error;
    }

    return post ? mapHistoryItem(post) : null;
  },

  async getHistoryPostById({ workspaceId, postId }, userId) {
    let post;
    try {
      post = await withCurrentUser(userId, (tx) =>
        tx.publishingPost.findFirst({
          where: {
            id: postId,
            workspaceId,
            deletedAt: null,
            // Sengaja TIDAK menyaring `status` di sini (beda dari
            // `getHistoryById`) — lihat catatan
            // `IPublishingRepository.getHistoryPostById`.
          },
          include: {
            targets: {
              include: { connectedAccount: true },
            },
          },
        }),
      );
    } catch (error) {
      if (isInvalidIdFormat(error)) {
        return null;
      }
      throw error;
    }

    return post ? mapHistoryItem(post) : null;
  },

  async getRetryTarget({ workspaceId, postId, targetId }, userId) {
    const target = await withCurrentUser(userId, async (tx) => {
      const found = await tx.publishingPostTarget.findFirst({
        where: {
          id: targetId,
          postId,
          post: { workspaceId, deletedAt: null },
        },
        include: { post: true, connectedAccount: true },
      });
      if (!found) {
        return null;
      }

      // Sibling live = published/scheduled/pending selain target ini —
      // dipakai RetryFailedTargetUseCase untuk SKIP deletePost (API
      // Outstand /remote tidak scoped per akun).
      const siblingLiveCount = await tx.publishingPostTarget.count({
        where: {
          postId,
          id: { not: targetId },
          status: { in: ["published", "scheduled", "pending"] },
        },
      });

      return { found, hasSiblingLiveTargets: siblingLiveCount > 0 };
    });

    if (!target) {
      return null;
    }

    const { found, hasSiblingLiveTargets } = target;

    const record: RetryTargetRecord = {
      postId: asPostId(found.post.id),
      workspaceId: asWorkspaceId(found.post.workspaceId),
      postOutstandPostId: found.post.outstandPostId,
      caption: found.post.caption,
      mediaIds: found.post.mediaIds.map((id) => asMediaId(id)),
      targetId: asPostTargetId(found.id),
      targetStatus: found.status as PublishingPostTargetStatus,
      connectedAccountId: asConnectedAccountId(found.connectedAccountId),
      outstandAccountId: found.connectedAccount.outstandAccountId,
      platform: found.platform as SocialPlatform,
      contentFormat: found.contentFormat as ContentFormat,
      platformOptions: found.platformOptions as Record<string, unknown> | null,
      hasSiblingLiveTargets,
    };

    return record;
  },

  async resetTargetForRetry({ targetId }, userId) {
    await withCurrentUser(userId, (tx) =>
      tx.publishingPostTarget.update({
        where: { id: targetId },
        data: {
          status: "pending",
          platformPostId: null,
          platformPostUrl: null,
          error: null,
          retryOutstandPostId: null,
        },
      }),
    );
  },

  async setRetryOutstandPostId({ targetId, retryOutstandPostId }, userId) {
    await withCurrentUser(userId, (tx) =>
      tx.publishingPostTarget.update({
        where: { id: targetId },
        data: { retryOutstandPostId },
      }),
    );
  },

  async reconcilePostStatusAfterRetry({ workspaceId, postId }, userId) {
    await withCurrentUser(userId, async (tx) => {
      // Idempoten by design: kalau masih ada target `failed` (retry gagal
      // lagi, atau target lain di post ini yang belum di-retry), post
      // TETAP `Failed` — tidak ada updateMany yang dieksekusi.
      const remainingFailedCount = await tx.publishingPostTarget.count({
        where: { postId, status: "failed" },
      });

      if (remainingFailedCount > 0) {
        return;
      }

      await tx.publishingPost.updateMany({
        where: {
          id: postId,
          workspaceId,
          status: ContentStatus.Failed,
          deletedAt: null,
        },
        data: { status: ContentStatus.Published },
      });
    });
  },

  async findPostTargetsByOutstandPostId(outstandPostId) {
    // System-context read (T-026, webhook Outstand) — bypasses per-tenant
    // RLS via a narrow SECURITY DEFINER SQL function (migration
    // `20260907120000_t026_outstand_webhook_system_lookups`), NOT
    // `withCurrentUser`, karena tidak ada acting `userId` sebelum lookup ini
    // resolve. Lihat catatan panjang di interface method ini dan di
    // migration itu sendiri untuk alasan lengkap — ini keputusan yang
    // dilaporkan ke King Rezi, bukan diputuskan diam-diam.
    const rows = await prisma.$queryRaw<WebhookPostTargetLookupRow[]>`
      SELECT * FROM "public"."webhook_find_post_targets_by_outstand_post_id"(${outstandPostId})
    `;

    if (rows.length === 0) {
      return null;
    }

    const [first] = rows;

    // Guard defensif (code review Ridwan Architecture Reviewer, T-026 —
    // defense-in-depth lapis kedua di samping partial unique index pada
    // `publishing_posts.outstand_post_id`, migration
    // `20260907130000_t026_unique_outstand_post_id`): fungsi SQL di atas
    // JOIN lintas `publishing_post_targets`, jadi kalau constraint unique
    // itu ternyata tidak menjamin apa yang diasumsikan (mis. dijalankan di
    // DB yang belum ter-migrate), baris yang di-return bisa berasal dari
    // post/workspace BERBEDA — memakai baris pertama untuk
    // `postId`/`workspaceId` tapi tetap memasukkan SEMUA baris sebagai
    // `targets` akan menulis outcome publish ke post/tenant yang salah.
    // Throw loud di sini (pola ADR-059), bukan diam-diam memakai baris
    // pertama dan mencampur target lintas tenant.
    const mismatched = rows.filter(
      (row) =>
        row.post_id !== first.post_id ||
        row.workspace_id !== first.workspace_id,
    );
    if (mismatched.length > 0) {
      throw new Error(
        `findPostTargetsByOutstandPostId: data integrity violation — ` +
          `outstand_post_id="${outstandPostId}" resolved to rows across ` +
          `multiple posts/workspaces (expected exactly one post per ` +
          `outstand_post_id, enforced by partial unique index ` +
          `publishing_posts_outstand_post_id_unique). post_id/workspace_id ` +
          `values found: ${JSON.stringify([
            ...new Set(rows.map((row) => `${row.post_id}/${row.workspace_id}`)),
          ])}`,
      );
    }

    const record: WebhookPostLookupRecord = {
      postId: asPostId(first.post_id),
      workspaceId: asWorkspaceId(first.workspace_id),
      // Code review PR #148 — `author_id` nullable sejak ADR-093 (T-090.1,
      // status `Imported`); reuse guard `requireAuthorId` (bukan `asUserId`
      // telanjang) supaya lookup ini throw loud kalau pernah menerima baris
      // Imported, bukan diam-diam meloloskan `UserId` palsu ke webhook
      // processor.
      authorId: requireAuthorId(
        first.author_id,
        "findPostTargetsByOutstandPostId",
      ),
      targets: rows.map((row) => ({
        postTargetId: asPostTargetId(row.post_target_id),
        connectedAccountId: asConnectedAccountId(row.connected_account_id),
        outstandAccountId: row.outstand_account_id,
      })),
    };

    return record;
  },

  async softDeletePost({ workspaceId, postId }, userId) {
    const post = await withCurrentUser(userId, async (tx) => {
      // Guard ganda (koreksi 2026-09-10, lihat `IPublishingRepository.softDeletePost`):
      // hanya post Draft yang belum di-soft-delete yang bisa jadi target —
      // entry point Delete Post hanya ada di Drafts, post Scheduled harus
      // di-Cancel Schedule dulu. `status: Draft` di sini murni safety net
      // race condition; guard utama (pesan error informatif) sudah
      // dilakukan `PublishingService.deletePost` lebih dulu.
      const { count } = await tx.publishingPost.updateMany({
        where: {
          id: postId,
          workspaceId,
          status: ContentStatus.Draft,
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });

      if (count === 0) {
        return null;
      }

      return tx.publishingPost.findUniqueOrThrow({ where: { id: postId } });
    });

    return post ? mapPost(post) : null;
  },

  /**
   * Engagement Sync (JOB-03, T-051, redesain KI-068/ADR-113) — query lewat
   * `publishingPostTarget` (bukan `publishingPost`) karena filter utamanya
   * (`connectedAccountId`) ada di level target, bukan post. `outstandPostId`
   * (post-level) dan `deletedAt` (soft-delete) difilter lewat relasi
   * `post`. Lihat `IPublishingRepository.listSyncablePostsByConnectedAccount`.
   */
  async listSyncablePostsByConnectedAccount(
    { workspaceId, connectedAccountId },
    userId,
  ) {
    // Engagement sync: hanya target yang sudah published (komentar hanya
    // relevan setelah tayang). Bound 50 terbaru supaya JOB-03 tidak
    // men-pull seluruh history akun.
    const SYNCABLE_POST_LIMIT = 50;

    const targets = await withCurrentUser(userId, (tx) =>
      tx.publishingPostTarget.findMany({
        where: {
          connectedAccountId,
          status: "published",
          post: {
            workspaceId,
            deletedAt: null,
            outstandPostId: { not: null },
          },
        },
        select: {
          postId: true,
          platform: true,
          retryOutstandPostId: true,
          post: {
            select: {
              outstandPostId: true,
              publishedAt: true,
              createdAt: true,
            },
          },
        },
        orderBy: [
          { post: { publishedAt: "desc" } },
          { post: { createdAt: "desc" } },
        ],
        take: SYNCABLE_POST_LIMIT,
      }),
    );

    return targets.flatMap((target) => {
      const outstandPostId =
        target.retryOutstandPostId ?? target.post.outstandPostId;
      if (!outstandPostId) return [];
      return [
        {
          postId: asPostId(target.postId),
          outstandPostId,
          platform: target.platform as SocialPlatform,
        },
      ];
    });
  },

  /**
   * Reply Engagement (T-054, redesain KI-068/ADR-113) — lihat
   * `IPublishingRepository.findPostOutstandId`.
   */
  async findPostOutstandId(
    { workspaceId, postId, connectedAccountId },
    userId,
  ) {
    return withCurrentUser(userId, async (tx) => {
      if (connectedAccountId) {
        const target = await tx.publishingPostTarget.findFirst({
          where: {
            postId,
            connectedAccountId,
            post: { workspaceId, deletedAt: null },
          },
          select: {
            retryOutstandPostId: true,
            post: { select: { outstandPostId: true } },
          },
        });
        if (!target) return null;
        return target.retryOutstandPostId ?? target.post.outstandPostId;
      }

      const post = await tx.publishingPost.findFirst({
        where: { id: postId, workspaceId, deletedAt: null },
        select: { outstandPostId: true },
      });

      return post?.outstandPostId ?? null;
    });
  },

  /**
   * Preview post asli (T-056, KI-065) — lihat
   * `IPublishingRepository.findPostSnapshotForEngagement`.
   */
  async findPostSnapshotForEngagement(
    { workspaceId, postId, connectedAccountId },
    userId,
  ) {
    const target = await withCurrentUser(userId, (tx) =>
      tx.publishingPostTarget.findFirst({
        where: {
          postId,
          connectedAccountId,
          post: { workspaceId, deletedAt: null },
        },
        select: {
          platformPostUrl: true,
          post: { select: { caption: true, mediaIds: true } },
        },
      }),
    );
    if (!target) return null;

    return {
      postId,
      caption: target.post.caption,
      mediaIds: target.post.mediaIds.map((id) => asMediaId(id)),
      platformPostUrl: target.platformPostUrl,
    };
  },

  /**
   * Import Posts dari Social Account (T-090.4, ADR-093 poin 3-4, 7) — lihat
   * docstring lengkap di `IPublishingRepository.upsertImportedPosts`.
   */
  async upsertImportedPosts({ workspaceId, posts }, actingUserId) {
    if (posts.length === 0) {
      return { insertedCount: 0, skippedDuplicateCount: 0 };
    }

    return withCurrentUser(actingUserId, async (tx) => {
      // Dedup (ADR-093 poin 4) — satu query batch untuk SELURUH
      // `platformPostId` di input, bukan satu query per post (N+1).
      // `connectedAccountId` ikut disaring karena `platformPostId` hanya
      // unik PER AKUN (dua akun berbeda bisa kebetulan punya
      // `platformPostId` yang sama secara string, walau jarang — defensif,
      // sama semangat dedup existing di ADR-092).
      const connectedAccountIds = [
        ...new Set(posts.map((post) => post.connectedAccountId)),
      ];
      const platformPostIds = [
        ...new Set(posts.map((post) => post.platformPostId)),
      ];

      const existing = await tx.publishingPostTarget.findMany({
        where: {
          connectedAccountId: { in: connectedAccountIds },
          platformPostId: { in: platformPostIds },
        },
        select: { connectedAccountId: true, platformPostId: true },
      });
      const existingKeys = new Set(
        existing.map(
          (row) => `${row.connectedAccountId}:${row.platformPostId}`,
        ),
      );

      let insertedCount = 0;
      let skippedDuplicateCount = 0;

      for (const post of posts) {
        const key = `${post.connectedAccountId}:${post.platformPostId}`;
        if (existingKeys.has(key)) {
          skippedDuplicateCount++;
          continue;
        }

        await tx.publishingPost.create({
          data: {
            workspaceId,
            // ADR-093 poin 3 — authorId null HANYA untuk status Imported.
            authorId: null,
            status: ContentStatus.Imported,
            caption: post.caption,
            publishedAt: post.publishedAt,
            targets: {
              create: [
                {
                  connectedAccountId: post.connectedAccountId,
                  platform: post.platform,
                  contentFormat: ContentFormat.Post,
                  platformPostId: post.platformPostId,
                  platformPostUrl: post.platformPostUrl,
                  // Target hasil import sudah live di platform sejak
                  // sebelum tool ini tahu soal post ini — "published" (bukan
                  // "pending") adalah outcome yang benar, bukan hasil
                  // percobaan publish kita sendiri.
                  status: "published",
                  // Media eksternal (`ImportedPostData.mediaUrls`) belum
                  // punya kolom DB khusus (T-090 scope) — disimpan di sini
                  // supaya tidak hilang untuk UI Imported nanti (T-090.5).
                  platformOptions:
                    post.mediaUrls.length > 0
                      ? { mediaUrls: post.mediaUrls }
                      : undefined,
                },
              ],
            },
          },
        });

        // Supaya post lain dalam BATCH YANG SAMA dengan `platformPostId`
        // kebetulan identik (seharusnya tidak terjadi — Outstand tidak
        // pernah mengembalikan duplikat dalam satu `fetchImportJobStatus`
        // — tapi defensif) tidak ikut ter-insert dobel.
        existingKeys.add(key);
        insertedCount++;
      }

      return { insertedCount, skippedDuplicateCount };
    });
  },
};

/** Row shape returned by the raw SQL call above — snake_case, mirrors the SQL function's RETURNS TABLE. */
interface WebhookPostTargetLookupRow {
  post_id: string;
  workspace_id: string;
  author_id: string;
  post_target_id: string;
  connected_account_id: string;
  outstand_account_id: string;
}
