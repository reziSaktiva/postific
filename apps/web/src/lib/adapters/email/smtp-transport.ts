import nodemailer from "nodemailer";

/**
 * Factory shared untuk nodemailer transport (T-137, dipisah dari
 * `smtp-auth-email-sender.ts`/`smtp-invite-email-sender.ts` yang sebelumnya
 * masing-masing membuat transport sendiri dengan opsi identik).
 *
 * Security (code review PR #189, temuan #2): wajib `requireTLS: true` untuk
 * port non-465 (STARTTLS, mis. 587). Tanpa ini, nodemailer bisa diam-diam
 * fallback ke koneksi plaintext kalau STARTTLS gagal/di-strip jaringan —
 * kredensial SMTP dan isi email (kode verifikasi, link reset password/
 * undangan) terkirim tanpa enkripsi, tanpa error ke caller. Dengan
 * `requireTLS: true`, nodemailer throw kalau STARTTLS tidak bisa
 * dinegosiasikan, alih-alih silent fallback. Port 465 sudah implicit TLS
 * (`secure: true`) sejak koneksi dibuka, jadi `requireTLS` di-set `false` di
 * sana — STARTTLS memang tidak dipakai di jalur ini.
 */
export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string;
}

export function createSmtpTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.port !== 465,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });
}
