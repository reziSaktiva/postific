import { secureCookiesEnabled } from "@/lib/env";

/**
 * T-005.5 — rahasia sekali pakai yang membuktikan browser ini baru saja
 * mengonfirmasi OTP accept-invite. Diset oleh
 * `confirmAcceptInviteVerificationAction`, dibaca hook Better Auth saat
 * `signUp.email()`. HttpOnly supaya skrip halaman tidak bisa membacanya
 * dan memanggil `/api/auth/sign-up/email` dari mesin lain.
 *
 * Umur 5 menit harus sama dengan `interval '5 minutes'` di policy RLS
 * `workspace_invitations_public_email_verified_consume` dan dengan
 * `5 * 60 * 1000` di `consumeVerifiedPendingInvitationForEmail`.
 */
export const INVITE_EMAIL_PROOF_COOKIE = "invite-email-proof";

export const INVITE_EMAIL_PROOF_MAX_AGE_SECONDS = 5 * 60;

export function inviteEmailProofCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookiesEnabled(),
    path: "/",
    maxAge: INVITE_EMAIL_PROOF_MAX_AGE_SECONDS,
  };
}
