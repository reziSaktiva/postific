/**
 * Server env validation (EM-D05).
 * Fail-fast for required server vars; client may only read NEXT_PUBLIC_*.
 */

const REQUIRED_SERVER_VARS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
] as const;

export type ServerEnv = {
  DATABASE_URL: string;
  DIRECT_URL: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  BETTER_AUTH_API_KEY?: string;
  BETTER_AUTH_API_URL?: string;
  BETTER_AUTH_KV_URL?: string;
  /**
   * Wajib untuk setiap jalur yang memanggil `getOutstandAdapter()` (ADR-119).
   * Kosong atau whitespace membuat factory throw — tidak ada fallback Fake.
   * Sengaja tidak masuk `REQUIRED_SERVER_VARS`: halaman yang tidak menyentuh
   * Outstand tetap boleh boot; kegagalan baru muncul di jalur Outstand.
   */
  OUTSTAND_API_KEY?: string;
  OUTSTAND_WEBHOOK_SECRET?: string;
  /**
   * Optional (T-025.1) — base URL Outstand API. Kosong → default
   * `https://api.outstand.so` (diverifikasi terhadap OpenAPI spec resmi
   * Outstand, `https://api.outstand.so/v1/*openapi.json`, diambil
   * 2026-09-23 — TANPA suffix `/v1`, setiap path di adapter sudah
   * menyertakan `/v1/...` sendiri). Override ini tetap disediakan untuk
   * fleksibilitas (mis. staging/sandbox Outstand kalau ada).
   */
  OUTSTAND_API_BASE_URL?: string;
  /**
   * Optional — Outstand Organization ID, dibutuhkan `connectAccount()`
   * untuk membentuk redirect URL OAuth resmi
   * (`https://www.outstand.so/app/api/socials/{network}/{orgId}`). Sejak
   * ADR-112, mengisi ini SUDAH cukup untuk alur connect account
   * single-page selesai (`resolveConnectCallback` tidak butuh env
   * tambahan) — tidak berlaku untuk Facebook Pages multi-halaman (KI-070).
   */
  OUTSTAND_ORG_ID?: string;
  /** Optional (mengikuti pola OUTSTAND_WEBHOOK_SECRET) — reachable 401 check di route.ts butuh ini TIDAK throw duluan lewat assertServerEnv kalau belum di-set. */
  JOB_SECRET?: string;
  /**
   * Wajib untuk setiap jalur yang memanggil `getInviteEmailSender()` (T-110,
   * KI-053) — kosong/whitespace membuat factory throw, pola sama
   * `OUTSTAND_API_KEY` (ADR-119, tidak ada fallback Fake di produksi).
   * Sengaja tidak masuk `REQUIRED_SERVER_VARS`: scope Resend saat ini adalah
   * verifikasi email accept-invite (T-110) dan kirim undangan anggota
   * (T-007.7), bukan `requireEmailVerification` Better Auth secara global
   * (T-005) — halaman yang tidak menyentuh alur itu tetap boleh boot tanpa
   * env var ini.
   */
  RESEND_API_KEY?: string;
  /** Wajib bersamaan dengan RESEND_API_KEY — alamat pengirim email Resend. */
  RESEND_FROM_EMAIL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
};

function missingRequired(): string[] {
  return REQUIRED_SERVER_VARS.filter((key) => {
    const value = process.env[key];
    return value === undefined || value.trim() === "";
  });
}

/** Throws if required server env vars are missing (EM-D05). */
export function assertServerEnv(): void {
  if (process.env.SKIP_ENV_VALIDATION === "1") {
    return;
  }

  const missing = missingRequired();
  if (missing.length > 0) {
    throw new Error(
      `Missing required server environment variables: ${missing.join(", ")}. ` +
        `Copy apps/web/.env.example → apps/web/.env.local and fill values (EM-D04).`,
    );
  }
}

export function getServerEnv(): ServerEnv {
  assertServerEnv();

  return {
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    DIRECT_URL: process.env.DIRECT_URL ?? "",
    SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET ?? "",
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "",
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "",
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    BETTER_AUTH_API_KEY: process.env.BETTER_AUTH_API_KEY,
    BETTER_AUTH_API_URL: process.env.BETTER_AUTH_API_URL,
    BETTER_AUTH_KV_URL: process.env.BETTER_AUTH_KV_URL,
    OUTSTAND_API_KEY: process.env.OUTSTAND_API_KEY,
    OUTSTAND_WEBHOOK_SECRET: process.env.OUTSTAND_WEBHOOK_SECRET,
    OUTSTAND_API_BASE_URL: process.env.OUTSTAND_API_BASE_URL,
    OUTSTAND_ORG_ID: process.env.OUTSTAND_ORG_ID,
    JOB_SECRET: process.env.JOB_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

/** True for HTTPS staging/production; false for local HTTP (auth-strategy cookie Secure). */
export function secureCookiesEnabled(): boolean {
  return process.env.NODE_ENV === "production";
}

/** True when Google OAuth client credentials are configured (AS-D05). */
export function googleOAuthEnabled(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

/**
 * T-005.5 (AS-D04) — single source of truth untuk `emailAndPassword.
 * requireEmailVerification` di `lib/better-auth/auth.ts` DAN untuk redirect
 * kondisional `RegisterForm` ke `/verify-email`. Sengaja satu fungsi yang
 * dipakai di dua tempat supaya keduanya tidak pernah drift satu sama lain.
 *
 * `true` sejak 2026-10-14, setelah King Rezi menyetujui (via
 * `AskUserQuestion`) DUA mitigasi yang sebelumnya menahan flag ini (lihat
 * `tasks/v01-foundation.md` § T-005.5 untuk detail lengkap):
 *
 * 1. **Backfill akun existing** — migrasi
 *    `20261014160000_t005_5_bind_signup_proof_and_backfill_email_verified`
 *    mengisi `emailVerified = true` untuk baris yang sudah ada saat
 *    migrasi itu jalan. Akun yang mendaftar sesudahnya tetap wajib
 *    verifikasi.
 * 2. **Accept-invite skip** — `databaseHooks.user.create.before` di
 *    `lib/better-auth/auth.ts` menandai user hasil accept-invite (T-110)
 *    `emailVerified: true` SAAT DIBUAT, hanya kalau cookie
 *    `invite-email-proof` cocok dengan hash yang disimpan saat OTP
 *    dikonfirmasi. `AcceptInviteForm.tsx` memanggil `signIn.email()`
 *    segera setelah `signUp.email()` kalau response-nya tidak membawa
 *    `token`.
 */
export function requireEmailVerificationEnabled(): boolean {
  return true;
}
