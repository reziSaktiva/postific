import { ContentFormat, MediaType, SocialPlatform } from "@postific/shared";
import { PublishingDomainError } from "./errors";

/**
 * Matriks Content Format per platform (ADR-039), mirror server-side dari
 * `getSelectableFormats`/`getDefaultFormat` di client
 * (`apps/web/src/app/(app)/components/draft-editor/Modal.tsx`). Jaga kedua
 * tempat ini konsisten kalau matriks berubah — client menentukan pilihan
 * yang ditampilkan, sini menegakkan aturan yang sama di server sebelum
 * persist/panggil adapter.
 *
 * Platform yang tidak terdaftar di sini hanya mengizinkan `Post` (default
 * client untuk platform selain Instagram/Facebook/Pinterest).
 */
const FORMAT_MATRIX: Partial<Record<SocialPlatform, ContentFormat[]>> = {
  [SocialPlatform.Instagram]: [
    ContentFormat.Post,
    ContentFormat.Reel,
    ContentFormat.Story,
  ],
  [SocialPlatform.Facebook]: [
    ContentFormat.Post,
    ContentFormat.Reel,
    ContentFormat.Story,
  ],
  [SocialPlatform.Pinterest]: [ContentFormat.Pin],
};

function allowedFormatsFor(platform: SocialPlatform): ContentFormat[] {
  return FORMAT_MATRIX[platform] ?? [ContentFormat.Post];
}

/**
 * Format konten yang diizinkan untuk `platform` menurut matriks ADR-039 —
 * API publik baca (T-150, tool MCP `list_accounts`). Mengembalikan salinan,
 * jadi caller tidak bisa mengubah matriks.
 */
export function getAllowedContentFormats(
  platform: SocialPlatform,
): ContentFormat[] {
  return [...allowedFormatsFor(platform)];
}

/**
 * Throws `PublishingDomainError` kalau `format` tidak diizinkan untuk
 * `platform` menurut matriks ADR-039.
 */
export function assertContentFormatAllowed(
  platform: SocialPlatform,
  format: ContentFormat,
): void {
  const allowed = allowedFormatsFor(platform);
  if (!allowed.includes(format)) {
    throw new PublishingDomainError(
      `Content format "${format}" tidak diizinkan untuk platform "${platform}". ` +
        `Format yang diizinkan: ${allowed.join(", ")}.`,
    );
  }
}

/**
 * Batas minimum & maksimum jumlah media per `ContentFormat` (T-024.4,
 * ADR-107 — amandemen ADR-039; batas minimum ADR-121 — amandemen ADR-107,
 * KI-074) — satu config gabungan supaya kedua bound tiap format SELALU
 * dideklarasikan & di-review bersama (bukan dua `Record` paralel yang bisa
 * drift kalau format baru ditambahkan dan salah satu bound lupa diisi).
 * Batas native platform: IG/FB carousel (Post) maks 10 media, min 0 (boleh
 * caption-only); Reel/Story/Pin selalu single media DAN wajib punya media
 * (tidak ada mode text-only). Mirror client-side WAJIB dijaga sinkron:
 * `apps/web/src/app/(app)/components/draft-editor/Modal.tsx`.
 */
const MEDIA_COUNT_BOUNDS_BY_FORMAT: Record<
  ContentFormat,
  { min: number; max: number }
> = {
  [ContentFormat.Post]: { min: 0, max: 10 },
  [ContentFormat.Reel]: { min: 1, max: 1 },
  [ContentFormat.Story]: { min: 1, max: 1 },
  [ContentFormat.Pin]: { min: 1, max: 1 },
};

/** Batas maksimum media untuk SATU `ContentFormat` — lihat `MEDIA_COUNT_BOUNDS_BY_FORMAT`. */
export function maxMediaCountForFormat(format: ContentFormat): number {
  return MEDIA_COUNT_BOUNDS_BY_FORMAT[format].max;
}

/**
 * Post bisa attach ke beberapa akun target dengan format BERBEDA sekaligus
 * (mis. IG Reel + FB Story dalam 1 post) — karena media yang di-attach itu
 * SATU set untuk seluruh post (`mediaIds` di level `PublishingPost`, bukan
 * per-target), batas efektif untuk seluruh post adalah MINIMUM dari
 * max-count semua format yang sedang dipilih di antara akun target aktif
 * (ADR-107). Array kosong (belum ada akun dipilih sama sekali) → default
 * paling longgar (`Post`, 10), sesuai keputusan King Rezi — supaya user
 * bisa mulai upload media sebelum memilih akun tujuan.
 */
export function maxMediaCountForFormats(formats: ContentFormat[]): number {
  if (formats.length === 0) {
    return MEDIA_COUNT_BOUNDS_BY_FORMAT[ContentFormat.Post].max;
  }
  return Math.min(
    ...formats.map((format) => MEDIA_COUNT_BOUNDS_BY_FORMAT[format].max),
  );
}

/**
 * Throws `PublishingDomainError` kalau `mediaCount` melebihi batas efektif
 * (ADR-107) untuk `formats` yang sedang dipilih.
 */
export function assertMediaCountWithinLimit(
  mediaCount: number,
  formats: ContentFormat[],
): void {
  const max = maxMediaCountForFormats(formats);
  if (mediaCount > max) {
    throw new PublishingDomainError(
      `Jumlah media (${mediaCount}) melebihi batas maksimum ${max} untuk format yang sedang dipilih.`,
    );
  }
}

/** Batas minimum media untuk SATU `ContentFormat` — lihat `MEDIA_COUNT_BOUNDS_BY_FORMAT`. */
export function minMediaCountForFormat(format: ContentFormat): number {
  return MEDIA_COUNT_BOUNDS_BY_FORMAT[format].min;
}

/**
 * Target publish minimal yang dibutuhkan untuk menentukan batas media
 * (ADR-154): platform DAN format, karena aturan media Outstand berbeda per
 * platform (mis. Facebook Post boleh teks saja, Instagram Post tidak).
 */
export interface MediaTarget {
  platform: SocialPlatform;
  contentFormat: ContentFormat;
}

/**
 * ADR-154 (amandemen ADR-121): platform yang `Post`-nya wajib media. Dasar:
 * dokumen Outstand per jaringan (Instagram: setiap format berisi media;
 * TikTok/YouTube: keputusan King Rezi 2026-11-03). Facebook, LinkedIn,
 * Threads, dan X tidak ada di sini karena boleh teks saja.
 */
const POST_REQUIRES_MEDIA_PLATFORMS: ReadonlySet<SocialPlatform> = new Set([
  SocialPlatform.Instagram,
  SocialPlatform.TikTok,
  SocialPlatform.YouTube,
]);

/** Platform yang `Post`-nya wajib media (ADR-154), untuk teks tool MCP. */
export function platformsWhosePostRequiresMedia(): SocialPlatform[] {
  return [...POST_REQUIRES_MEDIA_PLATFORMS];
}

/**
 * `true` kalau target ini tidak boleh dipublish/dijadwalkan tanpa media.
 * Reel/Story/Pin selalu wajib (ADR-121, semua platform); `Post` hanya untuk
 * platform di `POST_REQUIRES_MEDIA_PLATFORMS` (ADR-154).
 */
export function targetRequiresMedia(target: MediaTarget): boolean {
  if (MEDIA_COUNT_BOUNDS_BY_FORMAT[target.contentFormat].min > 0) {
    return true;
  }
  return POST_REQUIRES_MEDIA_PLATFORMS.has(target.platform);
}

/**
 * Batas minimum EFEKTIF untuk seluruh post: 1 kalau ada SATU target saja
 * yang wajib media (`mediaIds` satu set untuk seluruh post, ADR-107/121),
 * selain itu 0. Array kosong (belum ada akun dipilih) → 0, supaya user bisa
 * mulai upload media sebelum memilih akun tujuan.
 */
export function minMediaCountForTargets(
  targets: ReadonlyArray<MediaTarget>,
): number {
  return targets.some(targetRequiresMedia) ? 1 : 0;
}

const PLATFORM_LABEL: Partial<Record<SocialPlatform, string>> = {
  [SocialPlatform.Instagram]: "Instagram",
  [SocialPlatform.Facebook]: "Facebook",
  [SocialPlatform.Twitter]: "X",
  [SocialPlatform.LinkedIn]: "LinkedIn",
  [SocialPlatform.TikTok]: "TikTok",
  [SocialPlatform.YouTube]: "YouTube",
  [SocialPlatform.Threads]: "Threads",
  [SocialPlatform.Pinterest]: "Pinterest",
};

/**
 * Nama target untuk pesan. Facebook menyebut formatnya karena hanya Reel
 * dan Story yang wajib media (Facebook Post tidak), platform lain cukup
 * namanya.
 */
/** Nama tampilan platform untuk pesan dan teks tool MCP. */
export function platformLabel(platform: SocialPlatform): string {
  return PLATFORM_LABEL[platform] ?? platform;
}

function mediaTargetLabel(target: MediaTarget): string {
  const platform = platformLabel(target.platform);
  if (target.platform === SocialPlatform.Facebook) {
    return `${platform} ${target.contentFormat === ContentFormat.Story ? "Story" : "Reel"}`;
  }
  return platform;
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) {
    return labels.join("");
  }
  return `${labels.slice(0, -1).join(", ")} dan ${labels[labels.length - 1]}`;
}

/**
 * Pesan constraint minimum media (KI-074, ADR-154) — `null` kalau
 * `mediaCount` sudah memenuhi batas minimum efektif untuk `targets`. Pola
 * sama `pinterestBoardConstraintMessage`: satu implementasi dipakai bersama
 * oleh client (gating tombol + pesan, `useDraftEditorForm.ts`) dan
 * `assertMediaCountMeetsMinimum` (server, throw). Pesan menyebut semua
 * target yang wajib media.
 */
export function minMediaCountConstraintMessage(
  mediaCount: number,
  targets: ReadonlyArray<MediaTarget>,
): string | null {
  const min = minMediaCountForTargets(targets);
  if (mediaCount >= min) {
    return null;
  }
  const labels = [
    ...new Set(targets.filter(targetRequiresMedia).map(mediaTargetLabel)),
  ];
  return `${joinLabels(labels)} tidak bisa dipublish tanpa media. Tambahkan minimal ${min} gambar atau video.`;
}

/**
 * Throws `PublishingDomainError` kalau `mediaCount` kurang dari batas
 * minimum (KI-074, ADR-154) untuk `targets` yang sedang dipilih.
 */
export function assertMediaCountMeetsMinimum(
  mediaCount: number,
  targets: ReadonlyArray<MediaTarget>,
): void {
  const message = minMediaCountConstraintMessage(mediaCount, targets);
  if (message) {
    throw new PublishingDomainError(message);
  }
}

/**
 * Pesan pelanggaran aturan Reel (ADR-155 addendum B.1, mengamandemen
 * ADR-154): Reel hanya sah dengan satu video. Satu teks untuk klien dan
 * server supaya tidak bisa berbeda.
 */
export const REEL_REQUIRES_VIDEO_MESSAGE =
  "Reel membutuhkan satu video. Ganti media dengan video, atau pilih format Post atau Story.";

/**
 * Platform yang format `Reel`-nya wajib satu video. Facebook: dokumen
 * Outstand eksplisit ("a Reel is exactly one video"). Instagram: dokumen
 * Outstand TIDAK eksplisit; aturan ini keputusan King Rezi (ADR-155 addendum
 * B.1) dan belum diuji di akun nyata (T-200.1). Dua jaringan memakai satu
 * aturan yang sama.
 */
const REEL_VIDEO_ONLY_PLATFORMS: ReadonlySet<SocialPlatform> = new Set([
  SocialPlatform.Instagram,
  SocialPlatform.Facebook,
]);

/** Bentuk media minimal untuk aturan Reel. `type` kosong dianggap bukan video. */
export interface ReelMediaItem {
  type?: MediaType;
}

/** `true` bila target ini berformat Reel di platform yang wajib satu video. */
export function isVideoOnlyReelTarget(target: MediaTarget): boolean {
  return (
    target.contentFormat === ContentFormat.Reel &&
    REEL_VIDEO_ONLY_PLATFORMS.has(target.platform)
  );
}

/**
 * Pesan aturan Reel (T-200) — `null` bila tidak ada target Reel, bila belum
 * ada media sama sekali, atau bila media tepat satu video. Satu implementasi
 * untuk klien (menonaktifkan opsi Reel di blok jaringan: kirim satu target
 * `{platform, contentFormat: Reel}`) dan `assertReelMediaRule` (server).
 *
 * Media kosong sengaja `null`: itu urusan batas minimum
 * (`minMediaCountConstraintMessage`, "tanpa media"), sehingga pengguna yang
 * memilih Reel sebelum mengunggah media tidak langsung ditolak. Gambar, GIF,
 * campuran media, dan lebih dari satu media melanggar.
 */
export function reelMediaConstraintMessage(
  targets: ReadonlyArray<MediaTarget>,
  media: ReadonlyArray<ReelMediaItem>,
): string | null {
  if (!targets.some(isVideoOnlyReelTarget) || media.length === 0) {
    return null;
  }
  const exactlyOneVideo =
    media.length === 1 && media[0]?.type === MediaType.Video;
  return exactlyOneVideo ? null : REEL_REQUIRES_VIDEO_MESSAGE;
}

/** Throws `PublishingDomainError` bila media melanggar aturan Reel (T-200). */
export function assertReelMediaRule(
  targets: ReadonlyArray<MediaTarget>,
  media: ReadonlyArray<ReelMediaItem>,
): void {
  const message = reelMediaConstraintMessage(targets, media);
  if (message) {
    throw new PublishingDomainError(message);
  }
}
