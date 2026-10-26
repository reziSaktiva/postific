import { getServerEnv } from "@/lib/env";
import {
  createResendInviteEmailSender,
  type IInviteEmailSender,
} from "./resend-invite-email-sender";
import {
  createResendAuthEmailSender,
  type IAuthEmailSender,
} from "./resend-auth-email-sender";
import { createSmtpAuthEmailSender } from "./smtp-auth-email-sender";
import { createSmtpInviteEmailSender } from "./smtp-invite-email-sender";
import type { SmtpConfig } from "./smtp-transport";

/**
 * T-137 (KI-097, ADR-137) — baca `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/
 * `SMTP_PASSWORD`/`SMTP_FROM_EMAIL` dan validasi wajib-diisi (trim
 * non-kosong), pola sama Resend di atas. Throw jelas kalau ada yang kosong
 * — TIDAK ADA fallback Fake di jalur produksi (ADR-119 berlaku analog).
 * `context` masuk ke pesan error supaya jelas dipanggil dari
 * `getAuthEmailSender()` atau `getInviteEmailSender()`.
 */
function resolveSmtpConfig(context: string): SmtpConfig {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL } =
    getServerEnv();

  const host = SMTP_HOST?.trim();
  if (!host) {
    throw new Error(
      `SMTP_HOST wajib diisi saat EMAIL_PROVIDER=smtp (T-137, ${context}).`,
    );
  }

  const portRaw = SMTP_PORT?.trim();
  if (!portRaw) {
    throw new Error(
      `SMTP_PORT wajib diisi saat EMAIL_PROVIDER=smtp (T-137, ${context}).`,
    );
  }
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(
      `SMTP_PORT harus berupa angka port yang valid (T-137, ${context}). Nilai saat ini: "${portRaw}".`,
    );
  }

  const user = SMTP_USER?.trim();
  if (!user) {
    throw new Error(
      `SMTP_USER wajib diisi saat EMAIL_PROVIDER=smtp (T-137, ${context}).`,
    );
  }

  const password = SMTP_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      `SMTP_PASSWORD wajib diisi saat EMAIL_PROVIDER=smtp (T-137, ${context}).`,
    );
  }

  const fromEmail = SMTP_FROM_EMAIL?.trim();
  if (!fromEmail) {
    throw new Error(
      `SMTP_FROM_EMAIL wajib diisi saat EMAIL_PROVIDER=smtp (T-137, ${context}).`,
    );
  }

  return { host, port, user, password, fromEmail };
}

/**
 * Factory `InviteEmailSender` (T-110, KI-053) — pola sama
 * `getOutstandAdapter()` (`lib/adapters/outstand/index.ts`, ADR-119):
 * `RESEND_API_KEY`/`RESEND_FROM_EMAIL` wajib (trim non-kosong), kosong →
 * throw jelas. TIDAK ADA fallback Fake di jalur produksi — test unit
 * service memakai double lokal di file tes (lihat
 * `workspace.service.test.ts`), bukan factory ini.
 *
 * T-137 (KI-097, ADR-137) — `EMAIL_PROVIDER=smtp` (khusus staging) memilih
 * `createSmtpInviteEmailSender` sebagai sibling, bukan pengganti, adapter
 * Resend di bawah. Default/nilai lain (termasuk undefined) tetap Resend.
 */
export function getInviteEmailSender(): IInviteEmailSender {
  const { EMAIL_PROVIDER, RESEND_API_KEY, RESEND_FROM_EMAIL } = getServerEnv();

  if (EMAIL_PROVIDER?.trim() === "smtp") {
    return createSmtpInviteEmailSender(
      resolveSmtpConfig("getInviteEmailSender"),
    );
  }

  const apiKey = RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY wajib diisi. Tidak ada fallback Fake untuk pengiriman kode verifikasi accept-invite (T-110).",
    );
  }

  const fromEmail = RESEND_FROM_EMAIL?.trim();
  if (!fromEmail) {
    throw new Error(
      "RESEND_FROM_EMAIL wajib diisi untuk mengirim kode verifikasi accept-invite (T-110).",
    );
  }

  return createResendInviteEmailSender(apiKey, fromEmail);
}

/**
 * Factory `AuthEmailSender` (T-005.3, AS-D04, ADR-126) — pola sama
 * `getInviteEmailSender()`/`getOutstandAdapter()` (ADR-119): env wajib,
 * throw jelas kalau kosong, TIDAK ADA fallback Fake di jalur produksi.
 * Dipanggil hanya dari `lib/better-auth/auth.ts` (composition root Better
 * Auth) — bukan dari domain layer manapun.
 *
 * T-137 (KI-097, ADR-137) — `EMAIL_PROVIDER=smtp` (khusus staging) memilih
 * `createSmtpAuthEmailSender` sebagai sibling, bukan pengganti, adapter
 * Resend di bawah. Default/nilai lain (termasuk undefined) tetap Resend.
 */
export function getAuthEmailSender(): IAuthEmailSender {
  const { EMAIL_PROVIDER, RESEND_API_KEY, RESEND_FROM_EMAIL } = getServerEnv();

  if (EMAIL_PROVIDER?.trim() === "smtp") {
    return createSmtpAuthEmailSender(resolveSmtpConfig("getAuthEmailSender"));
  }

  const apiKey = RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY wajib diisi. Tidak ada fallback Fake untuk email reset password/verifikasi Better Auth (T-005.3).",
    );
  }

  const fromEmail = RESEND_FROM_EMAIL?.trim();
  if (!fromEmail) {
    throw new Error(
      "RESEND_FROM_EMAIL wajib diisi untuk mengirim email reset password/verifikasi Better Auth (T-005.3).",
    );
  }

  return createResendAuthEmailSender(apiKey, fromEmail);
}
