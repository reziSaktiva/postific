import type { MemberRole, PostId, UserId, WorkspaceId } from "@postific/shared";
import { ConflictError } from "@/lib/utils/errors";
import type { IOutstandAdapter } from "../adapters/outstand-adapter";
import { assertActorCanCancelSchedule } from "../rbac";
import type {
  IPublishingRepository,
  PublishingPostRecord,
} from "../repositories/publishing.repository";

/**
 * Use-case terpisah dari `PublishingService`, mengikuti pola
 * `PublishNowUseCase`/`SchedulePostsUseCase` (T-028/T-029, ADR-059) —
 * constructor mewajibkan `IOutstandAdapter` secara tipe supaya lupa pass
 * adapter di call site baru langsung ketahuan TypeScript. Satu-satunya
 * call site saat ini: `cancelScheduleAction` di
 * `app/(app)/publish/queue/actions.ts`.
 *
 * Cancel Schedule (T-030, ADR-049 Tier 2) — kebalikan dari Schedule/Publish
 * Now: RBAC dulu (sama role: Owner/Admin/Creator, tidak ada validasi format
 * karena tidak ada target baru yang diperkenalkan), lalu persist dulu
 * (`repository.cancelSchedule` — post → Draft, target dihapus) baru
 * panggil adapter per target untuk membatalkan job di sisi Outstand. Urutan
 * ini konsisten dengan `PublishNowUseCase`/`SchedulePostsUseCase`: DB commit
 * dulu supaya tidak ada state yang berubah tanpa jejak, adapter call
 * sesudahnya murni membersihkan sisi eksternal.
 *
 * Beda dari `SchedulePostsUseCase`/`PublishNowUseCase`: kegagalan
 * `cancelScheduledPost` tidak ditulis balik ke `PublishingPostTarget`
 * (baris itu sudah dihapus oleh `repository.cancelSchedule`) — best-effort,
 * gagal membatalkan tidak menggagalkan keseluruhan aksi (post di DB sudah
 * pasti Draft), tapi TETAP di-log via `console.error` (bukan ditelan diam-diam)
 * supaya kegagalan reconcile ke Outstand tidak hilang tanpa jejak sama
 * sekali.
 *
 * **Redesain 2026-08-26** — `cancelScheduledPost` sekarang dipanggil SEKALI
 * dengan `outstandPostId` post-level (bukan per target lagi, konsisten
 * dengan `schedulePost`/`publishNow` yang juga 1-call-semua-target).
 */
export class CancelScheduleUseCase {
  constructor(
    private readonly repository: IPublishingRepository,
    private readonly outstandAdapter: IOutstandAdapter,
  ) {}

  async execute(input: {
    workspaceId: WorkspaceId;
    postId: PostId;
    /** RBAC (T-030.1, ADR-049 Tier 2) — role actor yang sudah tervalidasi. */
    actorRole: MemberRole;
    /** RLS (KI-026 follow-up) — acting user for `withCurrentUser`. */
    actingUserId: UserId;
  }): Promise<PublishingPostRecord> {
    assertActorCanCancelSchedule(input.actorRole);

    const record = await this.repository.cancelSchedule(
      { workspaceId: input.workspaceId, postId: input.postId },
      input.actingUserId,
    );

    if (!record) {
      throw new ConflictError(
        "Jadwal tidak bisa dibatalkan — post tidak ditemukan atau statusnya bukan Scheduled.",
      );
    }

    // Redesain 2026-08-26 — SATU call untuk seluruh post (bukan per target),
    // konsisten dengan model baru "1 call Outstand mencakup semua target".
    // `outstandPostId` bisa `null` (race jarang: baru saja dijadwalkan,
    // adapter belum sempat mengembalikan id) — skip pemanggilan adapter
    // untuk kasus itu, post di DB tetap sudah Draft.
    if (record.outstandPostId !== null) {
      try {
        await this.outstandAdapter.cancelScheduledPost(record.outstandPostId);
      } catch (error) {
        // Best-effort by design — tidak ada baris PublishingPostTarget lagi
        // untuk dicatat outcome-nya (sudah dihapus oleh
        // repository.cancelSchedule), dan post di DB sudah pasti Draft
        // terlepas dari hasil ini. Tapi kegagalan tetap WAJIB di-log (bukan
        // ditelan sepenuhnya) — kalau tidak, post yang gagal dibatalkan di
        // sisi Outstand bisa tetap tayang tanpa jejak error di mana pun.
        console.error(
          `[CancelScheduleUseCase] postId=${input.postId} outstandPostId=${record.outstandPostId} — cancelScheduledPost gagal (post tetap Draft di DB, tapi post terkait mungkin masih aktif di Outstand):`,
          error,
        );
      }
    }

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      authorId: record.authorId,
      caption: record.caption,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
