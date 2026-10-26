## Decision ADR-137

### Title

Provider email transactional **staging** sementara pindah ke SMTP pribadi
(`rezi@insvire.com`), menunggu domain terverifikasi di Resend (T-137)

### Status

Accepted

### Date

2026-10-21

### Decision

**Khusus environment staging**, provider pengiriman email transactional
(reset password, verifikasi email Better Auth, kode verifikasi accept-invite,
undangan anggota workspace) sementara pindah dari Resend ke **SMTP langsung**
memakai mailbox `rezi@insvire.com`, sampai domain pengirim terverifikasi di
Resend.

1. **Production TIDAK terdampak** — tetap pakai Resend
   (`RESEND_API_KEY`/`RESEND_FROM_EMAIL`) sesuai ADR-126, tidak diubah.
2. Pemilihan provider dikontrol env var baru **`EMAIL_PROVIDER`**
   (`"resend"` default kalau kosong, `"smtp"` untuk mengaktifkan jalur SMTP).
   Di staging, Railway di-set `EMAIL_PROVIDER=smtp`. Production tidak diisi
   (fallback ke Resend).
3. Adapter SMTP baru (`nodemailer`) diimplementasikan sebagai _sibling_ dari
   `createResendAuthEmailSender`/`createResendInviteEmailSender` — bukan
   mengganti kode Resend yang ada — dan dipilih lewat factory
   `getAuthEmailSender()`/`getInviteEmailSender()` di
   `apps/web/src/lib/adapters/email/index.ts` berdasarkan `EMAIL_PROVIDER`.
   Resend tetap jadi satu-satunya implementasi yang hidup di production.
4. Env baru yang dibutuhkan (hanya untuk staging): `SMTP_HOST`, `SMTP_PORT`,
   `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`. King Rezi yang mengisi
   nilainya langsung di Railway (kredensial, agent tidak pernah memegang
   nilainya — pola sama T-119/KI-015).
5. **Sunset eksplisit**: keputusan ini dicabut (balik ke Resend penuh,
   `EMAIL_PROVIDER` dihapus dari staging) begitu domain pengirim Resend
   terverifikasi — dicatat sebagai syarat selesai T-137, bukan perubahan
   permanen.

### Reason

- Akun Resend yang dipakai belum punya domain terverifikasi —
  `RESEND_FROM_EMAIL` masih `onboarding@resend.dev` (domain sandbox milik
  Resend sendiri, tidak bisa diverifikasi sebagai domain sendiri). Resend
  mengunci akun ini ke mode testing: hanya boleh kirim ke email pendaftar
  akun (`rezi@insvire.com`), dikonfirmasi lewat log Railway staging
  (`web`, deployment `06a90913`): _"You can only send testing emails to
  your own email address (rezi@insvire.com)"_.
- King Rezi belum punya akses DNS ke domain manapun (termasuk
  `insvire.com`) untuk menambahkan record SPF/DKIM yang diminta Resend,
  dan belum mau membeli domain baru sekarang. Tanpa domain terverifikasi,
  flow yang butuh kirim ke email selain `rezi@insvire.com` (undangan
  member, accept-invite, reset password user lain) **tidak bisa ditest
  sama sekali** di staging — memblokir QA multi-akun.
- SMTP langsung dari mailbox pribadi tidak kena pembatasan "satu alamat
  saja" karena bukan lewat ESP (Resend) yang mengharuskan reputasi domain,
  melainkan relay dari server mail `insvire.com` sendiri yang sudah
  established. Cukup untuk kebutuhan **testing/staging sementara**.
- ADR-126 eksplisit menyatakan "Jangan menambah provider kedua" — ADR ini
  **sengaja mengamendemen poin itu secara terbatas (staging only,
  bersyarat sunset)**, bukan membatalkannya. King Rezi secara eksplisit
  meminta opsi ini (2026-10-21) setelah opsi lain (alias `+`, minta akses
  DNS pihak lain, beli domain) dipertimbangkan. Production tetap satu
  provider (Resend) sesuai ADR-126 asli.

### Alternatives Considered

- **Email alias `+` dari `rezi@insvire.com`** (mis. `rezi+test1@insvire.com`,
  tetap lewat Resend) — tidak dipilih; Resend kemungkinan membandingkan
  alamat penerima persis sama dengan email akun terdaftar (tidak ada
  konfirmasi resmi bahwa alias `+` diterima untuk alamat non-`resend.dev`),
  jadi tidak pasti berhasil tanpa dicoba, dan King Rezi memilih langsung ke
  opsi SMTP.
- **Minta admin DNS `insvire.com` menambahkan record SPF/DKIM** untuk
  subdomain (mis. `mail.insvire.com`) — tidak dipilih untuk sekarang; King
  Rezi tidak punya akses DNS dan tidak menyebut ada pihak lain yang bisa
  diminta saat ini.
- **Beli domain baru khusus pengirim email** — tidak dipilih untuk sekarang;
  King Rezi memilih opsi SMTP yang tidak perlu biaya/pembelian domain
  dulu.
- **Verifikasi domain Railway (`web-staging-60d7.up.railway.app`) ke
  Resend** — tidak memungkinkan secara teknis; DNS zone `up.railway.app`
  dikuasai Railway, bukan King Rezi, sehingga record SPF/DKIM tidak bisa
  ditambahkan di sana.
- **Ganti `RESEND_FROM_EMAIL` production juga ke SMTP** — ditolak secara
  implisit; scope eksplisit King Rezi adalah staging saja ("untuk
  sementara pada staging"), production tetap Resend sesuai ADR-126.

### Related

- ADR-126 — provider email transactional dikunci ke Resend. Diamendemen
  terbatas (staging only, bersyarat sunset) oleh ADR ini, tidak dibatalkan.
- T-137 (`tickets/known-issues.md`, KI-097) — implementasi adapter SMTP,
  wiring `EMAIL_PROVIDER`, dan syarat sunset kembali ke Resend penuh.

---
