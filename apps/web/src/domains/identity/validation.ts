/**
 * Shared profile/avatar validation constants — single source for both
 * client (ProfileForm) and server (IdentityService) so the two limits
 * can't drift apart (code-review finding, T-016.2).
 */
export const MAX_NAME_LENGTH = 100;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB, sesuai mockup account-profile.html

/** MIME type → file extension, dipakai untuk validasi format + naming path storage. */
export const ALLOWED_AVATAR_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

export const ALLOWED_AVATAR_ACCEPT = Object.keys(
  ALLOWED_AVATAR_MIME_TYPES,
).join(",");
