import type { ContentFormat, SocialPlatform } from "@postific/shared";
import {
  assertMediaCountMeetsMinimum,
  assertMediaCountWithinLimit,
} from "./content-format-matrix";
import { PublishingDomainError } from "./errors";
import {
  PINTEREST_ONE_ACCOUNT_MESSAGE,
  pinterestBoardConstraintMessage,
} from "./pinterest-board-constraints";
import { assertScheduledAtNotInPast } from "./schedule-time-constraints";
import {
  captionRequiredConstraintMessage,
  MIXED_STORY_CAPTION_SCHEDULE_MESSAGE,
  mixedStoryCaptionConstraintMessage,
} from "./story-caption-constraints";

/**
 * Safety Check penjadwalan di server (T-153, ADR-138 poin 5, ADR-049).
 * Dialog Confirmation Summary (Schedule, Tier 2) hanya ada di UI, jadi entry
 * point non-UI menegakkan aturan yang membuat tombol Schedule di Draft Editor
 * aktif (`isReadyToSchedule` di `Modal.tsx`), sebelum ada yang ditulis:
 *
 * - waktu jadwal di masa depan (T-108);
 * - caption wajib kecuali ada target Story (KI-073);
 * - Story tidak digabung dengan target lain selama caption terisi (adapter
 *   Outstand menolak kombinasi ini);
 * - jumlah media sah untuk format yang dipilih (ADR-107, ADR-121);
 * - Pinterest: satu akun dan board wajib (KI-072). Entry point ini tidak
 *   membawa `platformOptions`, jadi board tidak pernah terisi dan target
 *   Pinterest selalu ditolak dengan pesan yang menunjuk ke aplikasi.
 *
 * Matriks `ContentFormat` per platform (ADR-039) ditegakkan saat target
 * di-resolve (`resolveScheduleTargets`), sebelum fungsi ini.
 *
 * Aturan caption/Story hidup di `story-caption-constraints.ts` dan dipakai
 * bersama `Modal.tsx` (T-192.1).
 */
export const PINTEREST_VIA_MCP_MESSAGE =
  "Akun Pinterest belum bisa dijadwalkan lewat MCP karena board Pinterest belum bisa dipilih di sini. Jadwalkan akun Pinterest di aplikasi Postific.";

export interface ScheduleSafetyCheckInput {
  caption: string;
  /** Jumlah media yang diminta; `0` bila tanpa media. */
  mediaCount: number;
  scheduledAt: Date;
  targets: ReadonlyArray<{
    platform: SocialPlatform;
    contentFormat: ContentFormat;
    platformOptions?: Record<string, unknown> | null;
  }>;
  now?: Date;
}

/** Melempar `PublishingDomainError` pada pelanggaran pertama; tanpa efek samping. */
export function assertScheduleSafetyCheck(
  input: ScheduleSafetyCheckInput,
): void {
  if (Number.isNaN(input.scheduledAt.getTime())) {
    throw new PublishingDomainError("Waktu jadwal tidak valid.");
  }
  assertScheduledAtNotInPast(input.scheduledAt, input.now);

  const formats = input.targets.map((target) => target.contentFormat);
  const captionMessage =
    captionRequiredConstraintMessage(input.caption, formats) ??
    mixedStoryCaptionConstraintMessage(
      input.caption,
      formats,
      MIXED_STORY_CAPTION_SCHEDULE_MESSAGE,
    );
  if (captionMessage !== null) {
    throw new PublishingDomainError(captionMessage);
  }

  assertMediaCountWithinLimit(input.mediaCount, formats);
  assertMediaCountMeetsMinimum(input.mediaCount, formats);

  const pinterest = pinterestBoardConstraintMessage(input.targets);
  if (pinterest === PINTEREST_ONE_ACCOUNT_MESSAGE) {
    throw new PublishingDomainError(pinterest);
  }
  if (pinterest !== null) {
    throw new PublishingDomainError(PINTEREST_VIA_MCP_MESSAGE);
  }
}
