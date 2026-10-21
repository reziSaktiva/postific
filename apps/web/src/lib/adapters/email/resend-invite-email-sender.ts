import { Resend } from "resend";
import { escapeHtml } from "./html-escape";

/**
 * Adapter konkret Resend untuk kode verifikasi accept-invite (T-110,
 * KI-053) — implementasi domain-agnostic dari `InviteEmailSenderPort`
 * lokal di `WorkspaceService` (AGENTS.md #6: domain logic tidak boleh
 * mengimpor HTTP client langsung; adapter ini HANYA boleh diimpor dari
 * composition root, lihat `index.ts` di folder ini dan
 * `apps/web/src/lib/workspace/invite-email-workspace-service.ts`).
 *
 * Sengaja adapter BARU dari nol (bukan reuse/extend `IOutstandAdapter`) —
 * domain terpisah, provider terpisah (Resend, bukan Outstand), pola factory
 * yang di-reuse hanya kemiripan STRUKTURAL (`getOutstandAdapter()`: wajib
 * API key, tidak ada fallback Fake di produksi, ADR-119), bukan tipe/kode
 * yang sama.
 */
export interface InviteVerificationEmailInput {
  email: string;
  code: string;
  workspaceName: string;
}

export interface MemberInvitationEmailInput {
  email: string;
  inviteLink: string;
  workspaceName: string;
  roleLabel: string;
  invitedByName: string;
}

export interface IInviteEmailSender {
  sendInviteVerificationCode(
    input: InviteVerificationEmailInput,
  ): Promise<void>;
  sendMemberInvitation(input: MemberInvitationEmailInput): Promise<void>;
}

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

export function createResendInviteEmailSender(
  apiKey: string,
  fromEmail: string,
): IInviteEmailSender {
  const client = new Resend(apiKey);

  return {
    async sendInviteVerificationCode(input) {
      const { error } = await client.emails.send({
        from: fromEmail,
        to: input.email,
        subject: `Kode verifikasi bergabung ke ${input.workspaceName}`,
        html: renderVerificationEmailHtml(input),
      });

      if (error) {
        throw new Error(
          `Resend gagal mengirim kode verifikasi accept-invite: ${error.message}`,
        );
      }
    },
    async sendMemberInvitation(input) {
      const { error } = await client.emails.send({
        from: fromEmail,
        to: input.email,
        subject: `Undangan bergabung ke ${input.workspaceName}`,
        html: renderMemberInvitationHtml(input),
      });

      if (error) {
        throw new Error(
          `Resend gagal mengirim undangan anggota: ${error.message}`,
        );
      }
    },
  };
}
