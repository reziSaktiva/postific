import type {
  IInviteEmailSender,
  InviteVerificationEmailInput,
  MemberInvitationEmailInput,
} from "./resend-invite-email-sender";
import { escapeHtml } from "./html-escape";
import { createSmtpTransport, type SmtpConfig } from "./smtp-transport";

/**
 * Adapter SMTP untuk kode verifikasi accept-invite dan undangan anggota
 * workspace — SIBLING dari `createResendInviteEmailSender`
 * (`resend-invite-email-sender.ts`), BUKAN pengganti (T-137, KI-097,
 * ADR-137, amendemen terbatas ADR-126 khusus staging).
 *
 * Interface (`IInviteEmailSender`/`InviteVerificationEmailInput`/
 * `MemberInvitationEmailInput`) di-reuse APA ADANYA dari modul Resend supaya
 * kedua adapter bisa saling swap di factory tanpa duplikasi tipe.
 *
 * Sengaja TIDAK ADA fallback Fake di jalur produksi (ADR-119 berlaku
 * analog) — lihat catatan yang sama di `smtp-auth-email-sender.ts`.
 */

function renderVerificationEmailHtml(
  input: InviteVerificationEmailInput,
): string {
  const workspaceName = escapeHtml(input.workspaceName);
  const code = escapeHtml(input.code);

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <p>Halo,</p>
      <p>
        Gunakan kode berikut untuk memverifikasi email Anda dan bergabung ke
        workspace <strong>${workspaceName}</strong>:
      </p>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 0.3em; text-align: center;">
        ${code}
      </p>
      <p>Kode ini berlaku selama 10 menit. Jangan bagikan kode ini ke siapa pun.</p>
      <p>Kalau Anda tidak meminta ini, abaikan email ini.</p>
    </div>
  `.trim();
}

function renderMemberInvitationHtml(input: MemberInvitationEmailInput): string {
  const workspaceName = escapeHtml(input.workspaceName);
  const invitedByName = escapeHtml(input.invitedByName);
  const roleLabel = escapeHtml(input.roleLabel);
  const inviteLink = escapeHtml(input.inviteLink);

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <p>Halo,</p>
      <p>
        <strong>${invitedByName}</strong> mengundang Anda bergabung ke workspace
        <strong>${workspaceName}</strong> sebagai <strong>${roleLabel}</strong>.
      </p>
      <p>
        <a href="${inviteLink}">Buka undangan</a>
      </p>
      <p>Undangan ini berlaku selama 7 hari dan hanya bisa dipakai oleh email ini.</p>
      <p>Kalau Anda tidak mengharapkan undangan ini, abaikan email ini.</p>
    </div>
  `.trim();
}

export function createSmtpInviteEmailSender(
  config: SmtpConfig,
): IInviteEmailSender {
  const transport = createSmtpTransport(config);

  return {
    async sendInviteVerificationCode(input) {
      try {
        await transport.sendMail({
          from: config.fromEmail,
          to: input.email,
          subject: `Kode verifikasi bergabung ke ${input.workspaceName}`,
          html: renderVerificationEmailHtml(input),
        });
      } catch (error) {
        throw new Error(
          `SMTP gagal mengirim kode verifikasi accept-invite: ${(error as Error).message}`,
        );
      }
    },
    async sendMemberInvitation(input) {
      try {
        await transport.sendMail({
          from: config.fromEmail,
          to: input.email,
          subject: `Undangan bergabung ke ${input.workspaceName}`,
          html: renderMemberInvitationHtml(input),
        });
      } catch (error) {
        throw new Error(
          `SMTP gagal mengirim undangan anggota: ${(error as Error).message}`,
        );
      }
    },
  };
}
