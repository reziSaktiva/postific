import { getServerEnv } from "@/lib/env";
import {
  createResendInviteEmailSender,
  type IInviteEmailSender,
} from "./resend-invite-email-sender";

/**
 * Factory `InviteEmailSender` (T-110, KI-053) — pola sama
 * `getOutstandAdapter()` (`lib/adapters/outstand/index.ts`, ADR-119):
 * `RESEND_API_KEY`/`RESEND_FROM_EMAIL` wajib (trim non-kosong), kosong →
 * throw jelas. TIDAK ADA fallback Fake di jalur produksi — test unit
 * service memakai double lokal di file tes (lihat
 * `workspace.service.test.ts`), bukan factory ini.
 */
export function getInviteEmailSender(): IInviteEmailSender {
  const { RESEND_API_KEY, RESEND_FROM_EMAIL } = getServerEnv();

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
