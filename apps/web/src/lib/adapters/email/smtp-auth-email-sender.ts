import type {
  AuthEmailInput,
  IAuthEmailSender,
} from "./resend-auth-email-sender";
import { escapeHtml } from "./html-escape";
import { createSmtpTransport, type SmtpConfig } from "./smtp-transport";

/**
 * Adapter SMTP untuk email transactional Better Auth (reset password,
 * verifikasi email) — SIBLING dari `createResendAuthEmailSender`
 * (`resend-auth-email-sender.ts`), BUKAN pengganti (T-137, KI-097, ADR-137,
 * amendemen terbatas ADR-126 khusus staging).
 *
 * Dipakai hanya saat `EMAIL_PROVIDER=smtp` (factory `getAuthEmailSender()`
 * di `index.ts`) — khusus staging, karena akun Resend terkunci mode testing
 * (domain pengirim belum terverifikasi) dan hanya bisa kirim ke
 * `rezi@insvire.com`, memblokir QA flow multi-akun. Production tetap Resend.
 *
 * Interface (`IAuthEmailSender`/`AuthEmailInput`) di-reuse APA ADANYA dari
 * modul Resend supaya kedua adapter bisa saling swap di factory tanpa duplikasi
 * tipe — bukan duplikasi logic pengiriman, hanya kontrak bentuknya yang sama
 * (shape-compatible sibling, pola sama disebut di tiket T-137).
 *
 * Sengaja TIDAK ADA fallback Fake di jalur produksi (ADR-119 berlaku analog):
 * `createSmtpAuthEmailSender` dipanggil hanya dengan host/port/user/password/
 * fromEmail yang sudah divalidasi wajib-diisi oleh factory — SMTP transport
 * yang gagal connect/auth akan throw dari `sendMail` sendiri (nodemailer),
 * bukan silent fallback.
 */

function renderPasswordResetEmailHtml(input: AuthEmailInput): string {
  const name = escapeHtml(input.name);
  const url = escapeHtml(input.url);

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <p>Halo ${name},</p>
      <p>Kami menerima permintaan untuk mengatur ulang password akun Anda.</p>
      <p>
        <a href="${url}">Atur ulang password</a>
      </p>
      <p>Tautan ini berlaku selama 1 jam.</p>
      <p>Kalau Anda tidak meminta ini, abaikan email ini — password Anda tidak akan berubah.</p>
    </div>
  `.trim();
}

function renderVerificationEmailHtml(input: AuthEmailInput): string {
  const name = escapeHtml(input.name);
  const url = escapeHtml(input.url);

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <p>Halo ${name},</p>
      <p>Klik tautan berikut untuk memverifikasi email dan mengaktifkan akun Anda:</p>
      <p>
        <a href="${url}">Verifikasi email saya</a>
      </p>
      <p>Tautan ini berlaku selama 1 jam.</p>
      <p>Kalau Anda tidak mendaftar di Postific, abaikan email ini.</p>
    </div>
  `.trim();
}

export function createSmtpAuthEmailSender(
  config: SmtpConfig,
): IAuthEmailSender {
  const transport = createSmtpTransport(config);

  return {
    async sendPasswordResetEmail(input) {
      try {
        await transport.sendMail({
          from: config.fromEmail,
          to: input.email,
          subject: "Reset password akun Anda",
          html: renderPasswordResetEmailHtml(input),
        });
      } catch (error) {
        throw new Error(
          `SMTP gagal mengirim email reset password: ${(error as Error).message}`,
        );
      }
    },
    async sendVerificationEmail(input) {
      try {
        await transport.sendMail({
          from: config.fromEmail,
          to: input.email,
          subject: "Verifikasi email Anda",
          html: renderVerificationEmailHtml(input),
        });
      } catch (error) {
        throw new Error(
          `SMTP gagal mengirim email verifikasi: ${(error as Error).message}`,
        );
      }
    },
  };
}
