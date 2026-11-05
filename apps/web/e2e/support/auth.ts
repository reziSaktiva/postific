import path from "node:path";

/** Sesi login tersimpan; folder `e2e/.auth/` di-gitignore. */
export const AUTH_FILE = path.join(__dirname, "..", ".auth", "user.json");

/**
 * Sesi kedua untuk akun Creator (T-214). Dipakai hanya oleh
 * `rbac-creator.e2e.ts`; sesi Owner di `AUTH_FILE` tidak berubah.
 */
export const CREATOR_AUTH_FILE = path.join(
  __dirname,
  "..",
  ".auth",
  "creator.json",
);

/** Kredensial Creator dari env; `null` bila salah satunya kosong (tes ter-skip). */
export function creatorCredentials(): {
  email: string;
  password: string;
} | null {
  const email = process.env.E2E_CREATOR_EMAIL;
  const password = process.env.E2E_CREATOR_PASSWORD;
  return email && password ? { email, password } : null;
}

/** Alasan kredensial Creator tidak dapat dipakai, atau `null` bila layak. */
export function creatorCredentialsProblem(): string | null {
  const creds = creatorCredentials();
  if (!creds) {
    return "E2E_CREATOR_EMAIL dan E2E_CREATOR_PASSWORD belum diisi (apps/web/.env.local atau GitHub Secrets)";
  }
  if (!creds.email.includes("@")) {
    return "E2E_CREATOR_EMAIL bukan alamat email valid (tanpa tanda @); perbaiki nilainya";
  }
  return null;
}
