import { Resend } from "resend";

/**
 * Adapter konkret Resend untuk email transactional **Better Auth sendiri**
 * (T-005.3, AS-D04, ADR-126) — reset password dan verifikasi email
 * registrasi. Dipanggil LANGSUNG dari composition root `lib/better-auth/
 * auth.ts` (callback `sendResetPassword`/`emailVerification.
 * sendVerificationEmail` milik Better Auth), BUKAN dari domain layer manapun
 * — `auth.ts` sendiri adalah infra/composition root, bukan domain logic,
 * jadi ini tidak melanggar AGENTS.md #6 (domain tidak boleh impor HTTP
 * client) walau pola factory-nya (wajib API key, tanpa fallback Fake di
 * produksi) mengikuti ADR-119 yang sama dengan `getOutstandAdapter()`/
 * `getInviteEmailSender()`.
 *
 * Sengaja adapter BARU/sibling, bukan menambah method ke
 * `IInviteEmailSender` (`resend-invite-email-sender.ts`) — interface itu
 * adalah port lokal `WorkspaceService` (dipakai untuk 2 concern domain
 * workspace: kode OTP accept-invite T-110, dan undangan anggota T-007.7),
 * sedangkan reset-password/verifikasi-email di sini adalah callback
 * langsung milik library Better Auth yang tidak pernah melewati domain
 * manapun. Menyatukan keduanya ke satu interface generik akan mengaburkan
 * dua composition root yang berbeda demi kemiripan dangkal ("sama-sama
 * kirim email lewat Resend") — provider/klien Resend yang dipakai tetap
 * satu akun yang sama (`RESEND_API_KEY`/`RESEND_FROM_EMAIL`), hanya
 * interface-nya dipisah mengikuti konsumennya masing-masing.
 */
export interface AuthEmailInput {
  email: string;
  name: string;
  url: string;
}

export interface IAuthEmailSender {
  sendPasswordResetEmail(input: AuthEmailInput): Promise<void>;
  sendVerificationEmail(input: AuthEmailInput): Promise<void>;
}

/** Copy Bahasa Indonesia, konsisten dengan seluruh UI/komunikasi produk (AGENTS.md rule 12). */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

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

export function createResendAuthEmailSender(
  apiKey: string,
  fromEmail: string,
): IAuthEmailSender {
  const client = new Resend(apiKey);

  return {
    async sendPasswordResetEmail(input) {
      const { error } = await client.emails.send({
        from: fromEmail,
        to: input.email,
        subject: "Reset password akun Anda",
        html: renderPasswordResetEmailHtml(input),
      });

      if (error) {
        throw new Error(
          `Resend gagal mengirim email reset password: ${error.message}`,
        );
      }
    },
    async sendVerificationEmail(input) {
      const { error } = await client.emails.send({
        from: fromEmail,
        to: input.email,
        subject: "Verifikasi email Anda",
        html: renderVerificationEmailHtml(input),
      });

      if (error) {
        throw new Error(
          `Resend gagal mengirim email verifikasi: ${error.message}`,
        );
      }
    },
  };
}
