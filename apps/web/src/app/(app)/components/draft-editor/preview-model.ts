import { ContentFormat, SocialPlatform } from "@postific/shared";

/**
 * Pemetaan data post (state form) ke model Pratinjau (S-005, T-203, ADR-155).
 * Fungsi murni: tanpa React, tanpa jaringan. Komponen Pratinjau hanya
 * merender model ini, jadi Pratinjau selalu mengikuti state form saat
 * mengetik atau mengganti media.
 */

export interface PreviewAccountInput {
  id: string;
  platform: SocialPlatform;
  handle: string;
}

export interface PreviewMediaInput {
  id: string;
  url: string | null;
  type: string;
  filename: string;
}

export interface CaptionSegment {
  text: string;
  isHashtag: boolean;
}

export interface PreviewMediaSummary {
  /** Media pertama (yang tampil di kartu); `null` bila belum ada media. */
  first: { url: string | null; isVideo: boolean; filename: string } | null;
  count: number;
  /** Penanda "1/N" bila lebih dari satu media; selain itu `null`. */
  counterLabel: string | null;
}

interface PreviewBase {
  accountId: string;
  platform: SocialPlatform;
  /** Nama yang tampil di kepala kartu (Instagram tanpa awalan "@"). */
  displayName: string;
  /** Huruf awal untuk fallback avatar. */
  initial: string;
  captionSegments: CaptionSegment[];
  hasCaption: boolean;
  media: PreviewMediaSummary;
}

export type PostPreviewModel =
  | (PreviewBase & { kind: "facebook-post" })
  | (PreviewBase & { kind: "instagram-post"; isCaptionLong: boolean })
  | (PreviewBase & {
      kind: "vertical";
      format: typeof ContentFormat.Reel | typeof ContentFormat.Story;
    })
  /** Platform/format yang Pratinjaunya dikerjakan tiket lain (T-204). */
  | {
      kind: "unavailable";
      accountId: string;
      platform: SocialPlatform;
      format: ContentFormat;
    };

/** Ambang caption Instagram sebelum "selengkapnya" (mengikuti rancangan). */
export const INSTAGRAM_CAPTION_PREVIEW_LIMIT = 125;

const HASHTAG_PATTERN = /(#[\p{L}\p{N}_]+)/u;

/** Memecah caption jadi segmen biasa dan hashtag, mempertahankan semua teks. */
export function splitCaption(caption: string): CaptionSegment[] {
  if (caption === "") {
    return [];
  }
  return caption
    .split(HASHTAG_PATTERN)
    .filter((text) => text !== "")
    .map((text) => ({
      text,
      isHashtag: text.startsWith("#") && text.length > 1,
    }));
}

export function summarizePreviewMedia(
  media: readonly PreviewMediaInput[],
): PreviewMediaSummary {
  const first = media[0];
  return {
    first: first
      ? {
          url: first.url,
          isVideo: first.type === "video",
          filename: first.filename,
        }
      : null,
    count: media.length,
    counterLabel: media.length > 1 ? `1/${media.length}` : null,
  };
}

/**
 * Akun Pratinjau yang aktif: pilihan pengguna bila masih terpilih, kalau
 * tidak akun terpilih pertama, kalau tidak ada akun `null` (keadaan kosong).
 */
export function resolveActivePreviewAccountId(
  selectedAccountIds: readonly string[],
  requestedAccountId: string | null,
): string | null {
  if (
    requestedAccountId !== null &&
    selectedAccountIds.includes(requestedAccountId)
  ) {
    return requestedAccountId;
  }
  return selectedAccountIds[0] ?? null;
}

export function buildPostPreview(input: {
  account: PreviewAccountInput;
  format: ContentFormat;
  caption: string;
  media: readonly PreviewMediaInput[];
}): PostPreviewModel {
  const { account, format, caption, media } = input;
  const isFacebookOrInstagram =
    account.platform === SocialPlatform.Facebook ||
    account.platform === SocialPlatform.Instagram;

  if (!isFacebookOrInstagram) {
    return {
      kind: "unavailable",
      accountId: account.id,
      platform: account.platform,
      format,
    };
  }

  const displayName =
    account.platform === SocialPlatform.Instagram
      ? account.handle.replace(/^@/, "")
      : account.handle;
  const base: PreviewBase = {
    accountId: account.id,
    platform: account.platform,
    displayName,
    initial: (displayName.trim().charAt(0) || "?").toUpperCase(),
    captionSegments: splitCaption(caption),
    hasCaption: caption.trim() !== "",
    media: summarizePreviewMedia(media),
  };

  if (format === ContentFormat.Reel || format === ContentFormat.Story) {
    return { ...base, kind: "vertical", format };
  }
  if (format === ContentFormat.Post) {
    return account.platform === SocialPlatform.Instagram
      ? {
          ...base,
          kind: "instagram-post",
          isCaptionLong: caption.length > INSTAGRAM_CAPTION_PREVIEW_LIMIT,
        }
      : { ...base, kind: "facebook-post" };
  }
  return {
    kind: "unavailable",
    accountId: account.id,
    platform: account.platform,
    format,
  };
}
