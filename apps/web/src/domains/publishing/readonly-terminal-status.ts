import type { PostId, UserId, WorkspaceId } from "@postific/shared";
import { ContentStatus } from "@postific/shared";
import { ConflictError } from "@/lib/utils/errors";
import type { IPublishingRepository } from "./repositories/publishing.repository";

/**
 * T-091.1 (ADR-059 poin 6, ADR-093 poin 1) — status terminal yang tidak
 * boleh disentuh aksi mutasi user (`updateDraft`, `deletePost`,
 * `schedule`, `publishNow`, `cancelSchedule`). Jalur sistem (retry,
 * webhook, `markPostPublished`/`markPostFailed`) tidak memakai helper ini.
 */
const READONLY_TERMINAL_STATUSES = new Set<ContentStatus>([
  ContentStatus.Published,
  ContentStatus.Failed,
  ContentStatus.Imported,
]);

export function isReadonlyTerminalStatus(status: ContentStatus): boolean {
  return READONLY_TERMINAL_STATUSES.has(status);
}

/**
 * T-297 — status yang boleh disimpan (status tidak berubah) dan dihapus lewat
 * Draft Editor/Drafts: `Draft` plus dua status koordinasi ringan `In Review`
 * dan `Ready to Schedule`. `Scheduled` harus di-Cancel Schedule dulu;
 * terminal (`Published`/`Failed`/`Imported`) read-only. Dipakai service
 * (guard) dan repository (safety net race condition).
 */
export const SAVE_AND_DELETE_STATUSES: readonly ContentStatus[] = [
  ContentStatus.Draft,
  ContentStatus.InReview,
  ContentStatus.ReadyToSchedule,
];

export function canSaveOrDeleteInStatus(status: ContentStatus): boolean {
  return SAVE_AND_DELETE_STATUSES.includes(status);
}

/**
 * T-296 — status asal yang boleh di-Schedule atau di-Publish Now. Sama dengan
 * `SAVE_AND_DELETE_STATUSES`, ditulis terpisah karena alasannya beda: status
 * koordinasi ringan tidak memblokir apa pun (UXP-06), jadi posting `In Review`
 * tetap bisa dijadwalkan atau dipublikasikan tanpa menunggu `Ready to
 * Schedule`. Dipakai use case (guard) dan repository (safety net race).
 */
export const SCHEDULE_AND_PUBLISH_SOURCE_STATUSES: readonly ContentStatus[] = [
  ContentStatus.Draft,
  ContentStatus.InReview,
  ContentStatus.ReadyToSchedule,
];

/** Pesan saat posting `Scheduled` diminta di-Schedule/Publish Now lagi. */
export const NOT_SCHEDULABLE_CONFLICT_MESSAGE =
  "Post ini sudah dijadwalkan. Batalkan jadwalnya dulu bila ingin menjadwalkan ulang atau mempublikasikan sekarang.";

/** Satu pesan untuk setiap aksi mutasi user terhadap post terminal. */
export const READONLY_TERMINAL_CONFLICT_MESSAGE =
  "Post berstatus Published, Failed, atau Imported bersifat read-only dan tidak bisa diubah, dihapus, dijadwalkan, atau dibatalkan.";

/**
 * Code review PR #163 — satu titik guard dipakai oleh
 * `CancelScheduleUseCase`, `PublishNowUseCase`, `SchedulePostsUseCase`, dan
 * `PublishingService.updateDraft`, menggantikan blok fetch+cek+throw yang
 * sebelumnya diduplikasi mentah 4x di keempat tempat itu — pola sentralisasi
 * yang sama dengan `assertActorCan*` di `./rbac.ts` (lihat doc comment di
 * sana), supaya perubahan aturan read-only tidak berisiko lupa diterapkan
 * di salah satu call site. Pakai `findPostStatusById` (bukan
 * `findDraftById`) supaya aman untuk post `Imported` sekalipun.
 */
export async function assertPostMutable(
  repository: Pick<IPublishingRepository, "findPostStatusById">,
  ids: { workspaceId: WorkspaceId; postId: PostId },
  userId: UserId,
): Promise<void> {
  const existing = await repository.findPostStatusById(ids, userId);
  if (existing && isReadonlyTerminalStatus(existing.status)) {
    throw new ConflictError(READONLY_TERMINAL_CONFLICT_MESSAGE);
  }
}

/**
 * T-296 — guard Schedule dan Publish Now: post terminal ditolak dengan pesan
 * read-only, post `Scheduled` dengan pesan jadwal; `Draft`, `In Review`, dan
 * `Ready to Schedule` lolos. Post yang tidak ditemukan dibiarkan lolos, sama
 * seperti `assertPostMutable`: filter repository yang menolaknya.
 */
export async function assertPostCanBeScheduledOrPublished(
  repository: Pick<IPublishingRepository, "findPostStatusById">,
  ids: { workspaceId: WorkspaceId; postId: PostId },
  userId: UserId,
): Promise<void> {
  const existing = await repository.findPostStatusById(ids, userId);
  if (!existing) {
    return;
  }
  if (isReadonlyTerminalStatus(existing.status)) {
    throw new ConflictError(READONLY_TERMINAL_CONFLICT_MESSAGE);
  }
  if (!SCHEDULE_AND_PUBLISH_SOURCE_STATUSES.includes(existing.status)) {
    throw new ConflictError(NOT_SCHEDULABLE_CONFLICT_MESSAGE);
  }
}
