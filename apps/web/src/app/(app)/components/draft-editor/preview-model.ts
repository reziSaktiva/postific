import {
  ContentFormat,
  SocialPlatform,
  type PinterestBoard,
} from "@postific/shared";

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
  /** TikTok: selalu kartu vertikal 9:16 dengan rel aksi (T-204.1). */
  | (PreviewBase & { kind: "tiktok" })
  /** Pinterest: pin 2:3 dengan judul, link, dan board dari blok jaringan (T-204.2). */
  | (PreviewBase & {
      kind: "pinterest-pin";
      /** Judul pin (sudah di-trim); string kosong bila belum diisi. */
      pinTitle: string;
      /** Host dari link tujuan; `null` bila kosong atau bukan URL http(s) valid. */
      linkHost: string | null;
      /** Nama board terpilih; `null` bila belum dipilih atau daftar board belum termuat. */
      boardName: string | null;
    })
  /** Kartu umum untuk platform tanpa Pratinjau khusus (T-204.3). */
  | (PreviewBase & { kind: "generic" });

/** Data blok jaringan Pinterest untuk akun yang sedang dipratinjau (T-204.2). */
export interface PinterestPreviewInput {
  title: string;
  link: string;
  boardId: string | undefined;
  boards: readonly PinterestBoard[];
}

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

/** Host dari link pin bila berupa URL http(s) valid; selain itu `null`. */
export function extractLinkHost(link: string): string | null {
  const trimmed = link.trim();
  if (trimmed === "") {
    return null;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.host
      : null;
  } catch {
    return null;
  }
}

export function buildPostPreview(input: {
  account: PreviewAccountInput;
  format: ContentFormat;
  caption: string;
  media: readonly PreviewMediaInput[];
  /** Hanya dipakai untuk akun Pinterest; tanpa ini pin tampil tanpa judul/link/board. */
  pinterest?: PinterestPreviewInput;
}): PostPreviewModel {
  const { account, format, caption, media, pinterest } = input;

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

  if (account.platform === SocialPlatform.TikTok) {
    return { ...base, kind: "tiktok" };
  }
  if (account.platform === SocialPlatform.Pinterest) {
    const boardName =
      pinterest?.boardId !== undefined
        ? (pinterest.boards.find((board) => board.id === pinterest.boardId)
            ?.name ?? null)
        : null;
    return {
      ...base,
      kind: "pinterest-pin",
      pinTitle: pinterest?.title.trim() ?? "",
      linkHost: pinterest ? extractLinkHost(pinterest.link) : null,
      boardName,
    };
  }
  if (
    account.platform !== SocialPlatform.Facebook &&
    account.platform !== SocialPlatform.Instagram
  ) {
    return { ...base, kind: "generic" };
  }

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
  return { ...base, kind: "generic" };
}
