## Decision ADR-126

### Title

Transactional email provider: **Resend** (T-005.1, menutup KI-001)

### Status

Accepted

### Date

2026-10-14

### Decision

King Rezi mengunci provider email transactional aplikasi ke **Resend**.

1. Resend adalah provider untuk email Better Auth ke depan: reset password
   dan verifikasi email registrasi (AS-D04).
2. Pakai integrasi yang sudah ada dari T-110: package `resend`, env
   `RESEND_API_KEY` dan `RESEND_FROM_EMAIL`. Jangan menambah provider kedua.
3. ADR ini hanya menutup **T-005.1** (pilih provider) dan **KI-001**
   (provider belum ditetapkan). Pengiriman email Better Auth yang nyata
   tetap di **T-005.2–T-005.5**: katalog env, `sendResetPassword` +
   `sendVerificationEmail`, halaman `verify-email`, dan
   `requireEmailVerification: true`.
4. T-110 (kode verifikasi accept-invite) dan T-007.7 (Kirim via Email)
   sudah memakai Resend. Keduanya tetap berdiri sendiri dan tidak menggantikan
   verifikasi email global Better Auth.

### Reason

- King Rezi memilih Resend secara eksplisit pada 2026-10-14.
- Resend sudah terpasang dan env-nya sudah diisi untuk undangan anggota
  (T-110, T-007.7). Satu provider untuk undangan dan email akun menghindari
  dua sistem kirim email.
- KI-001 menahan T-005 hanya pada keputusan provider. Setelah dikunci,
  sisa pekerjaan adalah implementasi, bukan pilihan vendor.

### Alternatives Considered

- Postmark, AWS SES, dan SMTP Supabase — kandidat asli AS-D04. Tidak
  dipilih karena Resend sudah hidup di jalur undangan.
- Menunda pilihan sampai T-005 diimplementasikan penuh — ditolak. King Rezi
  meminta provider dikunci sekarang, terpisah dari pengiriman email.
