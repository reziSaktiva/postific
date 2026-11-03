import { ContentFormat, SocialPlatform } from "@postific/shared";
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
function mediaTargetLabel(target: MediaTarget): string {
  const platform = PLATFORM_LABEL[target.platform] ?? target.platform;
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
 * oleh client (gating tombol + pesan, `Modal.tsx`) dan
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
