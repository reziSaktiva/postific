import { ContentFormat, MediaType, SocialPlatform } from "@postific/shared";

import {
  minMediaCountConstraintMessage,
  reelMediaConstraintMessage,
} from "@/domains/publishing/content-format-matrix";
import {
  PINTEREST_ONE_ACCOUNT_MESSAGE,
  pinterestBoardConstraintMessage,
} from "@/domains/publishing/pinterest-board-constraints";
import { mixedStoryCaptionConstraintMessage } from "@/domains/publishing/story-caption-constraints";

/**
 * Validasi Draft Editor yang dikelompokkan menurut LETAKNYA di layar (T-202.5,
 * ADR-155): pelanggaran per jaringan tampil di blok jaringan itu, pelanggaran
 * lintas jaringan tampil di atas editor. Fungsi murni tanpa React; seluruh
 * aturan dan teks pesan berasal dari domain publishing (ADR-107, ADR-121,
 * ADR-154, T-200), tidak ada aturan baru di sini.
 */

/** Satu akun terpilih beserta format dan board-nya. */
export interface NetworkTarget {
  accountId: string;
  platform: SocialPlatform;
  contentFormat: ContentFormat;
  /** Hanya bermakna untuk Pinterest. */
  boardId?: string;
}

/** Bentuk media minimal yang dibutuhkan aturan Reel; `type` mengikuti `MediaType`. */
export interface NetworkMedia {
  type?: string;
}

export type NetworkIssueCode =
  "media-required" | "reel-requires-video" | "pinterest-board-required";

export interface NetworkIssue {
  code: NetworkIssueCode;
  message: string;
}

export type CrossNetworkIssueCode =
  "pinterest-one-account" | "mixed-story-caption";

export interface CrossNetworkIssue {
  code: CrossNetworkIssueCode;
  message: string;
}

export interface NetworkValidation {
  /** Pelanggaran per akun (kunci = accountId); akun tanpa pelanggaran berisi array kosong. */
  byAccount: Record<string, NetworkIssue[]>;
  cross: CrossNetworkIssue[];
  /** `true` bila ada pelanggaran di blok mana pun atau lintas jaringan. */
  hasBlockingIssues: boolean;
}

function toReelMedia(media: ReadonlyArray<NetworkMedia>) {
  return media.map((item) => ({ type: item.type as MediaType | undefined }));
}

/** Pelanggaran yang tampil di dalam blok SATU jaringan, urutan: media, Reel, board. */
export function validateNetworkBlock(
  target: NetworkTarget,
  media: ReadonlyArray<NetworkMedia>,
): NetworkIssue[] {
  const mediaTarget = {
    platform: target.platform,
    contentFormat: target.contentFormat,
  };
  const issues: NetworkIssue[] = [];

  const mediaRequired = minMediaCountConstraintMessage(media.length, [
    mediaTarget,
  ]);
  if (mediaRequired) {
    issues.push({ code: "media-required", message: mediaRequired });
  }

  const reel = reelMediaConstraintMessage([mediaTarget], toReelMedia(media));
  if (reel) {
    issues.push({ code: "reel-requires-video", message: reel });
  }

  if (target.platform === SocialPlatform.Pinterest) {
    const board = pinterestBoardConstraintMessage([
      {
        platform: target.platform,
        platformOptions: { boardId: target.boardId },
      },
    ]);
    if (board) {
      issues.push({ code: "pinterest-board-required", message: board });
    }
  }

  return issues;
}

/** Pelanggaran lintas jaringan yang tampil di atas editor. */
export function validateCrossNetwork(
  targets: ReadonlyArray<NetworkTarget>,
  caption: string,
): CrossNetworkIssue[] {
  const issues: CrossNetworkIssue[] = [];

  const pinterest = pinterestBoardConstraintMessage(
    targets.map((target) => ({
      platform: target.platform,
      platformOptions: { boardId: target.boardId },
    })),
  );
  if (pinterest === PINTEREST_ONE_ACCOUNT_MESSAGE) {
    issues.push({ code: "pinterest-one-account", message: pinterest });
  }

  const mixedStory = mixedStoryCaptionConstraintMessage(
    caption,
    targets.map((target) => target.contentFormat),
  );
  if (mixedStory) {
    issues.push({ code: "mixed-story-caption", message: mixedStory });
  }

  return issues;
}

export function validateNetworks(
  targets: ReadonlyArray<NetworkTarget>,
  caption: string,
  media: ReadonlyArray<NetworkMedia>,
): NetworkValidation {
  const byAccount: Record<string, NetworkIssue[]> = {};
  for (const target of targets) {
    byAccount[target.accountId] = validateNetworkBlock(target, media);
  }
  const cross = validateCrossNetwork(targets, caption);
  const hasBlockingIssues =
    cross.length > 0 ||
    Object.values(byAccount).some((issues) => issues.length > 0);
  return { byAccount, cross, hasBlockingIssues };
}

/**
 * Sebab opsi format nonaktif (T-213.6): tampilan memetakan kode ke teks,
 * tidak menurunkan sebab dari media sendiri.
 * - `reel-non-video-media`: ada media yang bukan video (gambar, GIF, campuran).
 * - `reel-multiple-videos`: semua media video, tetapi lebih dari satu.
 */
export type FormatDisabledReasonCode =
  "reel-non-video-media" | "reel-multiple-videos";

export interface FormatOptionState {
  disabled: boolean;
  /** Alasan opsi nonaktif (teks T-200); `null` bila opsi sah. */
  reason: string | null;
  /** Kode sebab; `null` bila opsi sah. */
  reasonCode: FormatDisabledReasonCode | null;
}

/**
 * Apakah opsi format tersedia di blok jaringan ini (T-202.3). Saat ini hanya
 * Reel yang bisa tidak sah: nonaktif bila sudah ada media dan media itu bukan
 * tepat satu video (aturan T-200, pesannya dari domain). Tanpa media, semua
 * opsi sah supaya pengguna boleh memilih Reel sebelum mengunggah.
 */
export function getFormatOptionState(
  platform: SocialPlatform,
  format: ContentFormat,
  media: ReadonlyArray<NetworkMedia>,
): FormatOptionState {
  const reason = reelMediaConstraintMessage(
    [{ platform, contentFormat: format }],
    toReelMedia(media),
  );
  if (reason === null) {
    return { disabled: false, reason: null, reasonCode: null };
  }
  const reasonCode: FormatDisabledReasonCode = media.some(
    (item) => item.type !== MediaType.Video,
  )
    ? "reel-non-video-media"
    : "reel-multiple-videos";
  return { disabled: true, reason, reasonCode };
}
