import { ContentStatus } from "@postific/shared";

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
