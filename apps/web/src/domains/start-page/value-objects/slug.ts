import { InvalidSlugError, ReservedSlugError } from "../errors";

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;

/** Huruf kecil/angka dipisah hubung tunggal; tanpa hubung di awal/akhir/ganda. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Path yang tidak boleh jadi slug Start Page (T-070.6). Slug hidup di
 * `/u/[slug]` (ADR-128) sehingga tidak bentrok langsung dengan route
 * aplikasi, tapi daftar ini tetap menutup: (a) route aplikasi/auth/API
 * (supaya aman kalau routing berpindah ke root/custom domain nanti, dan
 * mencegah impersonasi halaman sistem), (b) nama yang menyesatkan.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // Auth & akun
  "login",
  "logout",
  "register",
  "signup",
  "signin",
  "forgot-password",
  "reset-password",
  "verify-email",
  "invite",
  "onboarding",
  "account",
  "profile",
  // Route aplikasi
  "dashboard",
  "publish",
  "analyze",
  "engage",
  "settings",
  "start-page",
  "workspace",
  "workspaces",
  "media",
  "notifications",
  // Teknis / infrastruktur
  "api",
  "u",
  "_next",
  "static",
  "assets",
  "public",
  "favicon",
  "robots",
  "sitemap",
  "well-known",
  "webhooks",
  "mcp",
  "health",
  "status",
  // Brand / otoritas
  "admin",
  "administrator",
  "root",
  "system",
  "support",
  "help",
  "security",
  "postific",
  "official",
  // Halaman umum
  "about",
  "pricing",
  "terms",
  "privacy",
  "contact",
  "blog",
  "docs",
  "null",
  "undefined",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/**
 * Value object slug Start Page. Hanya memvalidasi (tanpa uniqueness — itu
 * cek repository saat tulis, di luar scope T-070). Tidak mengubah isi:
 * normalisasi (`trim`/lowercase) tanggung jawab caller via `normalizeSlug`.
 */
export type StartPageSlug = string & { readonly _brand: "StartPageSlug" };

export function normalizeSlug(input: string): string {
  return input.trim().toLowerCase();
}

export function parseSlug(input: string): StartPageSlug {
  if (input.length < SLUG_MIN_LENGTH || input.length > SLUG_MAX_LENGTH) {
    throw new InvalidSlugError(
      `Slug must be ${SLUG_MIN_LENGTH}-${SLUG_MAX_LENGTH} characters`,
    );
  }
  if (!SLUG_PATTERN.test(input)) {
    throw new InvalidSlugError(
      "Slug may only contain lowercase letters, numbers, and single hyphens (not at the start or end)",
    );
  }
  if (isReservedSlug(input)) {
    throw new ReservedSlugError(input);
  }
  return input as StartPageSlug;
}
