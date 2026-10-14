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
