import type {
  MemberRole,
  PostId,
  PostTargetId,
  WorkspaceId,
} from "@postific/shared";
import type { UserId } from "@postific/shared";
import { ConflictError, NotFoundError } from "@/lib/utils/errors";
import type { IOutstandAdapter } from "../adapters/outstand-adapter";
import { assertPinterestBoardConstraints } from "../pinterest-board-constraints";
import { assertActorCanPublishNow } from "../rbac";
import type {
  IPublishingRepository,
  PublishingPostTargetStatus,
} from "../repositories/publishing.repository";
import {
  resolveOutstandPostMedia,
  type PostMediaLookupPort,
} from "./resolve-outstand-post-media";

/** Hasil `RetryFailedTargetUseCase.execute` — dipakai Server Action untuk merefresh UI tanpa perlu full reload. */
export interface RetryFailedTargetResult {
  targetId: PostTargetId;
  status: PublishingPostTargetStatus;
  error: string | null;
  platformPostUrl: string | null;
}

/**
 * Retry manual untuk target publishing yang gagal (T-034.4, ADR-092).
 * Mengikuti pola use-case lain di domain ini (`PublishNowUseCase`,
 * `CancelScheduleUseCase`) — constructor mewajibkan `IOutstandAdapter`
 * secara tipe, RBAC dulu sebelum kerja lain. Satu-satunya call site saat
 * ini: `retryFailedTargetAction` di
 * `app/(app)/publish/history/[postId]/actions.ts`.
 *
 * **RBAC**: reuse `assertActorCanPublishNow` (Owner/Admin/Creator) — retry
 * adalah aksi publish langsung yang sama berisikonya dengan Publish Now
 * (tayang ke platform tanpa jeda koreksi), bukan level akses baru.
 *
 * **Keputusan scope (dikonfirmasi King Rezi, bukan asumsi)**: retry HANYA
 * me-recreate TARGET yang gagal (satu akun) — target lain di post yang
 * sama yang sudah `published` TIDAK disentuh/dihapus/di-recreate. Karena
 * itu use-case ini TIDAK memakai `PublishNowUseCase`/`repository.publishNow`
 * (yang me-replace SELURUH target post) — sebagai gantinya memanggil
 * `IOutstandAdapter.publishNow` langsung dengan array `targets` berisi 1
 * elemen, dan repository method granular per-target
 * (`getRetryTarget`/`resetTargetForRetry`/`setRetryOutstandPostId`/
 * `updateTargetOutcome`/`reconcilePostStatusAfterRetry`).
 *
 * **Pola ADR-092 (delete-lalu-create-ulang)**: Outstand tidak punya
 * endpoint retry resmi — dokumentasinya merekomendasikan hapus lalu buat
 * baru. Langkah "hapus" (`outstandAdapter.deletePost`) di sini best-effort
 * (try/catch, error di-log — bukan dilempar ke pemanggil), pola sama
 * persis dengan `cancelScheduledPost` di `CancelScheduleUseCase`.
 */
export class RetryFailedTargetUseCase {
  constructor(
    private readonly repository: IPublishingRepository,
    private readonly outstandAdapter: IOutstandAdapter,
    /** Opsional — resolve mediaIds → URL Outstand sebelum recreate. */
    private readonly mediaLookup?: PostMediaLookupPort,
  ) {}

  async execute(input: {
    workspaceId: WorkspaceId;
    postId: PostId;
    targetId: PostTargetId;
    /** RBAC — role actor yang sudah tervalidasi (sama aturan Publish Now). */
    actorRole: MemberRole;
    /** RLS (KI-026 follow-up) — acting user for `withCurrentUser`. */
    actingUserId: UserId;
  }): Promise<RetryFailedTargetResult> {
    assertActorCanPublishNow(input.actorRole);

    const target = await this.repository.getRetryTarget(
      {
        workspaceId: input.workspaceId,
        postId: input.postId,
        targetId: input.targetId,
      },
      input.actingUserId,
    );

    if (!target) {
      throw new NotFoundError("Target publishing tidak ditemukan di post ini.");
    }

    if (target.targetStatus !== "failed") {
      throw new ConflictError(
        "Retry hanya berlaku untuk target yang berstatus gagal.",
      );
    }

    assertPinterestBoardConstraints([
      {
        platform: target.platform,
        platformOptions: target.platformOptions,
      },
    ]);

    // Delete best-effort (ADR-092) — HANYA bila target ini satu-satunya
    // di post (tidak ada sibling published/scheduled/pending). Real
    // Outstand `DELETE .../remote` TIDAK scoped per akun: memanggilnya
    // dengan accountIds akan throw (lihat RealOutstandAdapter.deletePost)
    // ATAU (versi lama) wipe sibling yang sudah tayang. Skip aman lebih
    // baik daripada opaque 400 / wipe silent.
    if (target.postOutstandPostId && !target.hasSiblingLiveTargets) {
      try {
        // Tanpa accountIds = full remote delete (aman: sole target).
        await this.outstandAdapter.deletePost(target.postOutstandPostId);
      } catch (error) {
        console.error(
          `[RetryFailedTargetUseCase] postId=${input.postId} targetId=${input.targetId} outstandPostId=${target.postOutstandPostId} — deletePost gagal (best-effort, retry tetap dilanjutkan):`,
          error,
        );
      }
    } else if (target.postOutstandPostId && target.hasSiblingLiveTargets) {
      console.warn(
        `[RetryFailedTargetUseCase] postId=${input.postId} targetId=${input.targetId} — skip deletePost karena ada sibling target live (published/scheduled/pending); API Outstand tidak mendukung scoped delete.`,
      );
    }

    // Persist dulu (reset ke pending) sebelum network call recreate —
    // konsisten pola "persist dulu, network call sesudah" yang sudah
    // dipakai schedulePost/publishNow/cancelSchedule.
    await this.repository.resetTargetForRetry(
      { targetId: input.targetId },
      input.actingUserId,
    );

    let status: PublishingPostTargetStatus = "pending";
    let error: string | null = null;
    let platformPostUrl: string | null = null;

    let outstandPostId: string | null = null;

    try {
      const media = await resolveOutstandPostMedia({
        workspaceId: input.workspaceId,
        mediaIds: target.mediaIds,
        actingUserId: input.actingUserId,
        outstandAdapter: this.outstandAdapter,
        mediaLookup: this.mediaLookup,
      });

      const result = await this.outstandAdapter.publishNow({
        caption: target.caption,
        targets: [
          {
            outstandAccountId: target.outstandAccountId,
            platform: target.platform,
            contentFormat: target.contentFormat,
            platformOptions: target.platformOptions ?? undefined,
          },
        ],
        ...(media ? { media } : {}),
      });
      outstandPostId = result.outstandPostId;

      await this.repository.setRetryOutstandPostId(
        {
          targetId: input.targetId,
          retryOutstandPostId: result.outstandPostId,
        },
        input.actingUserId,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.repository.updateTargetOutcome(
        { postTargetId: input.targetId, status: "failed", error: message },
        input.actingUserId,
      );
      status = "failed";
      error = message;
    }

    if (outstandPostId) {
      try {
        // Retry dari halaman History selalu berarti aksi langsung — sama
        // seperti PublishNowUseCase, panggil fetchPostOutcome SEGERA supaya
        // UI mendapat outcome final tanpa menunggu polling/webhook (T-026)
        // belakangan. `expectedOutstandAccountIds` (T-027 bug fix,
        // root-cause) — retry ini SATU target, jadi cukup akun itu sendiri.
        const outcomes = await this.outstandAdapter.fetchPostOutcome(
          outstandPostId,
          [target.outstandAccountId],
        );
        const outcome = outcomes.find(
          (candidate) =>
            candidate.outstandAccountId === target.outstandAccountId,
        );

        // Outstand belum melaporkan outcome akun ini (mis. masih "pending")
        // — biarkan status `pending` dari `resetTargetForRetry` tidak
        // diubah, sama semantik dengan PublishNowUseCase.
        if (outcome && outcome.status !== "pending") {
          await this.repository.updateTargetOutcome(
            {
              postTargetId: input.targetId,
              status: outcome.status,
              platformPostId: outcome.platformPostId ?? undefined,
              platformPostUrl: outcome.platformPostUrl ?? undefined,
              error: outcome.error ?? undefined,
            },
            input.actingUserId,
          );
          status = outcome.status;
          error = outcome.error;
          platformPostUrl = outcome.platformPostUrl;
        }
      } catch (err) {
        // publishNow sudah sukses (post benar-benar dibuat di Outstand) —
        // kegagalan fetchPostOutcome di sini murni gagal MEMBACA outcome-nya,
        // bukan bukti publish itu sendiri gagal. Jangan tandai target
        // "failed" atas dasar ini — biarkan `pending` (webhook/polling T-026
        // akan melengkapinya belakangan), sama seperti kasus outcome belum
        // dilaporkan Outstand di atas.
        console.error(
          `[RetryFailedTargetUseCase] postId=${input.postId} targetId=${input.targetId} outstandPostId=${outstandPostId} — fetchPostOutcome gagal (publish sudah terkirim, status dibiarkan pending):`,
          err,
        );
      }
    }

    // Recompute status post: naik ke Published kalau tidak ada lagi target
    // `failed` (invariant HISTORY_TERMINAL_STATUSES, konsisten
    // PublishNowUseCase) — tetap Failed kalau retry gagal lagi ATAU
    // outcome-nya masih belum diketahui (`pending`), supaya post tidak naik
    // ke Published sebelum outcome target ini benar-benar terkonfirmasi.
    if (status !== "pending") {
      await this.repository.reconcilePostStatusAfterRetry(
        { workspaceId: input.workspaceId, postId: input.postId },
        input.actingUserId,
      );
    }

    return { targetId: input.targetId, status, error, platformPostUrl };
  }
}
