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
 * Batas minimum EFEKTIF untuk seluruh post — kebalikan dari
 * `maxMediaCountForFormats` (yang pakai MINIMUM antar format yang sedang
 * dipilih): di sini pakai MAKSIMUM antar format, supaya format yang lebih
 * ketat (mis. Story butuh ≥1 media) tidak kalah oleh format yang lebih
 * longgar (Post butuh ≥0) dalam satu post gabungan yang sama (`mediaIds`
 * satu set untuk seluruh post, ADR-107). Array kosong (belum ada akun
 * dipilih sama sekali) → 0, supaya user tetap bisa mulai upload media
 * sebelum memilih akun tujuan (konsisten filosofi `maxMediaCountForFormats`).
 */
export function minMediaCountForFormats(formats: ContentFormat[]): number {
  if (formats.length === 0) {
    return 0;
  }
  return Math.max(
    ...formats.map((format) => MEDIA_COUNT_BOUNDS_BY_FORMAT[format].min),
  );
}

/**
 * Pesan constraint minimum media (KI-074) — `null` kalau `mediaCount` sudah
 * memenuhi batas minimum efektif untuk `formats` yang sedang dipilih. Pola
 * sama `pinterestBoardConstraintMessage` (`pinterest-board-constraints.ts`)
 * — satu implementasi dipakai bersama oleh client (gating tombol Publish
 * Now/Schedule + tampilan pesan, `Modal.tsx`) dan
 * `assertMediaCountMeetsMinimum` (server, throw).
 */
export function minMediaCountConstraintMessage(
  mediaCount: number,
  formats: ContentFormat[],
): string | null {
  const min = minMediaCountForFormats(formats);
  if (mediaCount < min) {
    return `Target ini butuh minimal ${min} media — Story/Reel/Pin tidak bisa dipublish tanpa media (jumlah media saat ini: ${mediaCount}).`;
  }
  return null;
}

/**
 * Throws `PublishingDomainError` kalau `mediaCount` kurang dari batas
 * minimum (KI-074) untuk `formats` yang sedang dipilih.
 */
export function assertMediaCountMeetsMinimum(
  mediaCount: number,
  formats: ContentFormat[],
): void {
  const message = minMediaCountConstraintMessage(mediaCount, formats);
  if (message) {
    throw new PublishingDomainError(message);
  }
}
