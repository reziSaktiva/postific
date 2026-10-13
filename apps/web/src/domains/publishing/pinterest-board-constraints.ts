import { SocialPlatform } from "@postific/shared";
import { PublishingDomainError } from "./errors";

/**
 * Batasan create-post Outstand untuk Pinterest (KI-072, review PR #135).
 *
 * Body `POST /v1/posts` hanya punya satu key `pinterest` per post, bukan
 * per akun. `board_id` di key itu wajib, dan sebuah board hanya milik satu
 * akun Pinterest. Karena itu satu jadwal/publish:
 * - wajib punya `boardId` kalau ada target Pinterest, dan
 * - hanya boleh memuat satu akun Pinterest.
 *
 * Akun kedua harus dijadwalkan sebagai post terpisah. Mengirim dua akun
 * dalam satu call akan menempelkan `board_id` akun pertama ke akun lain
 * (first-match-wins) — itu yang ditolak di sini.
 */
export const PINTEREST_BOARD_REQUIRED_MESSAGE =
  "Pilih board Pinterest sebelum menjadwalkan atau mempublish. Board wajib — tanpa board, pin tidak bisa dikirim.";

export const PINTEREST_ONE_ACCOUNT_MESSAGE =
  "Satu jadwal atau publish hanya bisa memuat satu akun Pinterest. Outstand hanya menerima satu board per post, jadi akun Pinterest lain harus dijadwalkan terpisah.";

export function readPinterestBoardId(
  platformOptions?: Record<string, unknown> | null,
): string | undefined {
  const boardId = platformOptions?.boardId;
  if (typeof boardId !== "string") return undefined;
  const trimmed = boardId.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function pinterestBoardConstraintMessage(
  targets: ReadonlyArray<{
    platform: SocialPlatform;
    platformOptions?: Record<string, unknown> | null;
  }>,
): string | null {
  const pinterestTargets = targets.filter(
    (target) => target.platform === SocialPlatform.Pinterest,
  );
  if (pinterestTargets.length > 1) {
    return PINTEREST_ONE_ACCOUNT_MESSAGE;
  }
  if (
    pinterestTargets.length === 1 &&
    !readPinterestBoardId(pinterestTargets[0]?.platformOptions)
  ) {
    return PINTEREST_BOARD_REQUIRED_MESSAGE;
  }
  return null;
}

export function assertPinterestBoardConstraints(
  targets: ReadonlyArray<{
    platform: SocialPlatform;
    platformOptions?: Record<string, unknown> | null;
  }>,
): void {
  const message = pinterestBoardConstraintMessage(targets);
  if (message) {
    throw new PublishingDomainError(message);
  }
}
