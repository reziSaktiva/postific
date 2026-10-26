import { dash } from "@better-auth/infra";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins/bearer";
import { cookies } from "next/headers";

import { WorkspaceService } from "@/domains/workspace";
import { getAuthEmailSender } from "@/lib/adapters/email";
import {
  requireEmailVerificationEnabled,
  secureCookiesEnabled,
} from "@/lib/env";
import { prisma } from "@/lib/prisma/client";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { INVITE_EMAIL_PROOF_COOKIE } from "@/lib/workspace/invite-email-proof-cookie";

import { mcpSpikePlugins } from "./mcp-spike";

/**
 * Better Auth instance (auth-strategy.md, ADR-030).
 * Identity tables: identity_* via Prisma @@map (DO-D05, DB-D04).
 * Password reset + email verification: Resend (ADR-126, T-005.3) —
 * `getAuthEmailSender()` (ADR-119 pattern: wajib env, throw loud, tanpa
 * fallback Fake). `requireEmailVerification` sudah `true` (T-005.5,
 * 2026-10-14) — lihat doc comment `requireEmailVerificationEnabled()` di
 * `lib/env.ts` untuk 2 mitigasi yang mengawalinya (backfill akun existing +
 * accept-invite skip via `databaseHooks` di bawah).
 */

const secure = secureCookiesEnabled();

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

// Better Auth Dash (official hosted admin/monitoring dashboard) — off unless configured.
const betterAuthApiKey = process.env.BETTER_AUTH_API_KEY;

// ADR-043 — mobile (Expo custom scheme, dst.) didaftarkan eksplisit di sini
// begitu keputusan mobile app benar-benar dimulai; kosong untuk sekarang
// (`baseURL` sudah trusted otomatis oleh Better Auth untuk web).
const trustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  ...(trustedOrigins && trustedOrigins.length > 0 ? { trustedOrigins } : {}),

  // ADR-043 §7 — /api/v1 memperluas attack surface yang sebelumnya lebih
  // tersembunyi di balik Server Actions; sign-in/sign-up diperketat dari
  // default umum Better Auth (3 req/10s) ke jendela yang lebih jelas.
  rateLimit: {
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
    },
  },

  emailAndPassword: {
    enabled: true,
    // T-005.5 — lihat requireEmailVerificationEnabled() di lib/env.ts
    // (single source of truth, `true` sejak 2026-10-14 setelah 2 mitigasi
    // disetujui King Rezi: backfill akun existing + accept-invite skip).
    requireEmailVerification: requireEmailVerificationEnabled(),
    // T-005.3 (AS-D04, ADR-126) — Resend, lewat getAuthEmailSender()
    // (ADR-119: wajib RESEND_API_KEY/RESEND_FROM_EMAIL, tanpa fallback Fake
    // di produksi).
    sendResetPassword: async ({ user, url }) => {
      await getAuthEmailSender().sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        url,
      });
    },
  },

  // T-005.3 (AS-D04, ADR-126) — wajib ada supaya requireEmailVerification
  // (T-005.5) bisa benar-benar mengirim email saat di-flip. `sendOnSignUp`
  // sengaja TIDAK di-set eksplisit — default Better Auth mengikuti
  // `emailAndPassword.requireEmailVerification` (lihat node_modules
  // @better-auth/core/types/init-options.d.mts), jadi satu sumber
  // kebenaran yang sama dengan requireEmailVerificationEnabled() di atas.
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      // T-005.5 — Better Auth memanggil callback ini TANPA PEDULI
      // `user.emailVerified` (lihat sign-up.mjs: kondisi kirim hanya cek
      // config statis `emailVerification.sendOnSignUp`/
      // `requireEmailVerification`, bukan field user). User accept-invite
      // (T-110) sudah ditandai `emailVerified: true` SAAT DIBUAT oleh hook
      // `databaseHooks.user.create.before` di bawah — tanpa guard ini
      // mereka tetap dapat email "verifikasi" yang membingungkan padahal
      // sudah terverifikasi lewat OTP.
      if (user.emailVerified) {
        return;
      }
      await getAuthEmailSender().sendVerificationEmail({
        email: user.email,
        name: user.name,
        url,
      });
    },
    // Auto-login user begitu link verifikasi diklik (Better Auth membuat
    // session baru kalau belum ada) — menghindari user diminta login manual
    // lagi setelah klik tautan dari email.
    autoSignInAfterVerification: true,
  },

  // T-005.5 — "accept-invite skip" (mitigasi #2 disetujui King Rezi via
  // AskUserQuestion, 2026-10-14). User yang baru dibuat lewat
  // `signUp.email()` SEGERA SETELAH `WorkspaceService.
  // confirmInviteEmailVerification` sukses (kode OTP T-110 benar) — lihat
  // `AcceptInviteForm.tsx`: confirm kode dulu, baru `signUp.email()` — tidak
  // boleh kena gate verifikasi native Better Auth kedua kalinya. Sinyal
  // yang dipakai BUKAN flag dari body request. Cookie httpOnly
  // `invite-email-proof` hanya diset setelah OTP benar, dan hash-nya harus
  // cocok dengan baris invitation. Lihat
  // `WorkspaceService.consumeVerifiedPendingInvitationForEmail` dan migrasi
  // `20261014160000_t005_5_bind_signup_proof_and_backfill_email_verified`.
  //
  // Consume menandai `betterAuthEmailVerifiedConsumedAt` (bukan
  // `emailVerifiedAt`, yang tetap dibaca `acceptInvite`) dan hanya cocok
  // kalau cookie `invite-email-proof` berisi rahasia yang diterbitkan
  // `confirmAcceptInviteVerificationAction`. Email yang kebetulan sama
  // tidak cukup. Rahasia itu single-use, umur 5 menit, dan OTP baru
  // menerbitkan rahasia baru kalau sign-up gagal sesudah consume.
  //
  // Hook ini tidak membuat session. `requireEmailVerification` membuat
  // `signUp.email()` mengembalikan `token: null`. `AcceptInviteForm`
  // lalu memanggil `signIn.email()`.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const proof = (await cookies()).get(INVITE_EMAIL_PROOF_COOKIE)?.value;
          if (!proof) {
            return;
          }

          const consumedVerifiedInvite = await new WorkspaceService(
            workspaceRepository,
          ).consumeVerifiedPendingInvitationForEmail(user.email, proof);

          if (consumedVerifiedInvite) {
            return { data: { ...user, emailVerified: true } };
          }
        },
      },
    },
  },

  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : undefined,

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh if < 1 day remaining
  },

  // apiUrl/kvUrl keys are omitted entirely (not passed as `undefined`) when
  // unset — @better-auth/infra's option merge lets an explicit `undefined`
  // key override its own built-in defaults, which breaks the JWKS self-check.
  //
  // bearer() (ADR-043 §4) converts an `Authorization: Bearer <token>` header
  // into a session — same session table as web cookie auth, no second auth
  // system. Always on: mobile client doesn't exist yet, but the endpoint
  // schema (`/api/v1`) needs it wired now (T-019) so web's Server Actions
  // never need a breaking retrofit later.
  plugins: [
    bearer(),
    // T-148 (spike MCP) — kosong kecuali MCP_SPIKE_ENABLED=true.
    ...mcpSpikePlugins(),
    ...(betterAuthApiKey
      ? [
          dash({
            apiKey: betterAuthApiKey,
            ...(process.env.BETTER_AUTH_API_URL
              ? { apiUrl: process.env.BETTER_AUTH_API_URL }
              : {}),
            ...(process.env.BETTER_AUTH_KV_URL
              ? { kvUrl: process.env.BETTER_AUTH_KV_URL }
              : {}),
          }),
        ]
      : []),
  ],

  advanced: {
    cookiePrefix: "better-auth",
    useSecureCookies: secure,
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure,
    },
  },
});

export type Session = typeof auth.$Infer.Session;
