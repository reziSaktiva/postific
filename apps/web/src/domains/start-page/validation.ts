import { ValidationError } from "@/lib/utils/errors";
import { StartPageDomainError } from "./errors";
import {
  START_PAGE_BIO_MAX_LENGTH,
  START_PAGE_LINK_LABEL_MAX_LENGTH,
  START_PAGE_TITLE_MAX_LENGTH,
} from "./value-objects/limits";
import { sanitizeAvatarUrl, sanitizeLinkUrl } from "./value-objects/safe-url";
import { normalizeSlug, parseSlug } from "./value-objects/slug";
import { isStartPageTheme, type StartPageTheme } from "./value-objects/theme";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new ValidationError(`${field} harus berupa teks.`);
  }
  return value;
}

/** Slug: normalisasi (trim+lowercase) lalu `parseSlug`; error domain -> `ValidationError`. */
export function validateSlugInput(raw: unknown): string {
  const input = requireString(raw, "Slug");
  try {
    return parseSlug(normalizeSlug(input));
  } catch (error) {
    if (error instanceof StartPageDomainError) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
}

export function validateTitleInput(raw: unknown): string {
  const title = requireString(raw, "Judul").trim();
  if (title.length === 0) throw new ValidationError("Judul wajib diisi.");
  if (title.length > START_PAGE_TITLE_MAX_LENGTH) {
    throw new ValidationError(
      `Judul maksimal ${START_PAGE_TITLE_MAX_LENGTH} karakter.`,
    );
  }
  return title;
}

/** Bio opsional: kosong/null -> `null`. */
export function validateBioInput(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const bio = requireString(raw, "Bio").trim();
  if (bio.length === 0) return null;
  if (bio.length > START_PAGE_BIO_MAX_LENGTH) {
    throw new ValidationError(
      `Bio maksimal ${START_PAGE_BIO_MAX_LENGTH} karakter.`,
    );
  }
  return bio;
}

/**
 * Batas foto profil Start Page, sama dengan foto profil akun (T-016.2):
 * JPG/PNG, 2MB. Bucket `avatars` juga menolak di atas 2MB.
 */
export const START_PAGE_AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const START_PAGE_AVATAR_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

export const START_PAGE_AVATAR_ACCEPT = Object.keys(
  START_PAGE_AVATAR_MIME_TYPES,
).join(",");

/** Avatar opsional: kosong/null -> `null`; selain itu wajib URL https valid. */
export function validateAvatarUrlInput(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const value = requireString(raw, "URL avatar").trim();
  if (value.length === 0) return null;
  const url = sanitizeAvatarUrl(value);
  if (!url) {
    throw new ValidationError(
      "URL avatar harus berupa tautan https yang valid.",
    );
  }
  return url;
}

export function validateThemeInput(raw: unknown): StartPageTheme {
  if (!isStartPageTheme(raw)) {
    throw new ValidationError("Tema tidak dikenal.");
  }
  return raw;
}

export function validateLinkLabelInput(raw: unknown): string {
  const label = requireString(raw, "Label").trim();
  if (label.length === 0) throw new ValidationError("Label wajib diisi.");
  if (label.length > START_PAGE_LINK_LABEL_MAX_LENGTH) {
    throw new ValidationError(
      `Label maksimal ${START_PAGE_LINK_LABEL_MAX_LENGTH} karakter.`,
    );
  }
  return label;
}

/** URL tautan: wajib http/https valid; hasil dikembalikan dalam bentuk kanonik. */
export function validateLinkUrlInput(raw: unknown): string {
  const url = sanitizeLinkUrl(raw);
  if (!url) {
    throw new ValidationError(
      "URL tautan harus diawali http:// atau https:// dan valid.",
    );
  }
  return url;
}
