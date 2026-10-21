/**
 * Escape karakter HTML (`&`, `<`, `>`, `"`) sebelum ditempel ke template
 * email. Dipakai oleh seluruh adapter email (Resend & SMTP, T-137/T-138) —
 * sebelumnya ter-copy-paste identik di 4 file (`resend-auth-email-sender.ts`,
 * `resend-invite-email-sender.ts`, `smtp-auth-email-sender.ts`,
 * `smtp-invite-email-sender.ts`), yang justru menyebabkan bug KI-098/T-138
 * (satu salinan sempat lupa di-pakai di satu fungsi). Diekstrak ke satu
 * modul shared supaya perubahan logic escaping cukup di satu tempat.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
