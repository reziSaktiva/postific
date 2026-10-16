# ADR-080 · Invite Member Dua Metode — Email dan Copy Link (Amandemen ADR-072)

**Status:** Accepted
**Tanggal:** 2026-08-14

## Konteks

ADR-072 menetapkan tabel `workspace_invitations` terpisah untuk invite member yang menyasar orang belum punya akun, dan mencatat alur `inviteMember` end-to-end masih menunggu T-005 (transactional email provider) selesai. T-005 sendiri berstatus 🚫 Blocked — provider belum ditetapkan (kandidat: Resend, Postmark, AWS SES, SMTP Supabase), belum ada ADR pemilihan provider.

Akibatnya T-007.1 (`inviteMember`) tertahan total menunggu T-005, dan ini berdampak berantai ke T-008 (Danger Zone Transfer Ownership) — QA Najwa tidak bisa memverifikasi live alur RBAC non-Owner dan transfer 2-akun karena tidak ada cara membuat akun kedua di workspace yang sama tanpa invite member berfungsi.

King Rezi memutuskan invite member tidak perlu menunggu email provider — cukup lepas dependency-nya lewat metode alternatif yang tidak butuh pengiriman email otomatis.

## Keputusan

1. **Invite member mendukung dua metode**, bukan satu:
   - **Copy Link** — `inviteMember` generate invitation record (`workspace_invitations`, sudah ada dari ADR-072) + link undangan (`/invite/[token]`). Owner/Admin menyalin link ini secara manual dan membagikannya lewat channel apa pun di luar sistem (WhatsApp, Slack, dll). Metode ini **tidak bergantung pada T-005** untuk pembuatan link — tapi baru jadi alur invite-to-membership yang utuh setelah halaman `/invite/[token]` (accept-invite: validasi token, buat akun/login dengan email yang sama, insert `workspace_members`) dibangun, yang masih **future work terpisah** (belum ada nomor T-XXX). Sebelum halaman itu ada, link yang dihasilkan 404 kalau dibuka (ditemukan CodeRabbit, review PR #73 — dokumentasi implementasi sebelumnya sempat menyiratkan Copy Link "selesai/aktif" tanpa caveat ini).
   - **Kirim via Email** — sistem mengirim email berisi link undangan yang sama secara otomatis. Metode ini **tetap bergantung pada T-005** (provider email) dan baru bisa diaktifkan setelah T-005 selesai.
2. Kedua opsi hadir di UI dialog invite member sejak awal (bukan ditambahkan belakangan) — opsi "Kirim via Email" ditampilkan disabled/hidden dengan indikator "segera tersedia" sampai T-005 selesai; opsi "Copy Link" aktif dan menjadi default.
3. Backend: `inviteMember` tidak berubah kontraknya (tetap generate invitation + token); pengiriman email adalah langkah opsional terpisah setelah invitation dibuat, dipanggil hanya kalau metode "Kirim via Email" dipilih dan T-005 sudah aktif. Tidak ada percabangan logic RBAC/token/expiry antar dua metode — perbedaan hanya di langkah pengiriman.
4. **Dependency T-007 → T-005 diturunkan dari hard blocker menjadi soft dependency**: T-007.1 (pembuatan invitation + link, jalur Copy Link) bisa dan harus dikerjakan sekarang, T-005 hanya memblokir aktivasi opsi "Kirim via Email", bukan seluruh fitur invite member. Halaman accept-invite (penerima link benar-benar jadi member) tetap terpisah dari dependency T-005 ini — lihat poin 1.
5. **Desain UI dialog invite member sudah dibuat di Claude Design** (`templates/settings-members.html`, 2026-08-14) — dialog "Undang Anggota Baru" dengan Selector Role + 2 opsi metode (Copy Link default aktif, Kirim via Email disabled berbadge "Segera"). Table anggota + dialog Remove/Update Role yang sudah ada tidak diubah. Menunggu konfirmasi King Rezi sebelum implementasi kode dimulai (AGENTS.md aturan #17).
6. **Invite wajib diikat ke satu alamat email spesifik ("email-bound"), bukan link generik terbuka** — ditambahkan setelah King Rezi mengangkat risiko keamanan: link generik (siapa pun yang mendapatkan link bisa bergabung) terlalu berisiko dibanding password tambahan pada link (tidak menambah keamanan riil kalau link+password dikirim lewat channel sama, dan menambah friksi kalau dikirim terpisah). Keputusan: setiap invitation dibuat untuk **satu email tujuan** yang wajib diisi Owner/Admin saat membuat undangan (berlaku untuk kedua metode — Copy Link maupun Kirim via Email nanti), dan alur accept-invite **wajib memvalidasi** email akun yang login/signup sama persis dengan `invitation.email` sebelum token dianggap valid. Kolom `email` di `workspace_invitations` (ADR-072) sudah menampung ini — tidak ada perubahan skema.
7. **Bulk invite (undang banyak email sekaligus) ditolak untuk versi ini** — King Rezi memilih single-email dulu supaya scope T-007 tetap sesuai kesepakatan "desain minimal dulu". Boleh diusulkan lagi sebagai peningkatan terpisah nanti setelah T-005 (email provider) selesai, karena bulk invite paling bermanfaat lewat metode Kirim via Email (kirim N email otomatis), bukan Copy Link (tetap perlu disalin & dibagikan satu per satu).

## Dampak

- `project-os/tickets/v01-foundation.md`: T-007.1 dipecah — bagian "generate invitation + copy link" lepas dari dependency T-005; bagian "kirim email" tetap dependency T-005. Field **Depends** T-007 diubah dari hard "T-005 (invite butuh email)" menjadi soft dependency.
- T-008 QA gap (3 item tidak diverifikasi live) berpotensi tertutup begitu T-007.1 (jalur Copy Link) selesai, karena akun Admin kedua bisa dibuat manual lewat link undangan.
- Tidak ada perubahan skema database — `workspace_invitations` (ADR-072) sudah menampung kebutuhan kedua metode (kolom `token` sudah ada; metode pengiriman tidak perlu disimpan sebagai state permanen).

## Alternatif yang dipertimbangkan

- **Tunda T-007.1 sampai T-005 selesai** — ditolak, karena T-005 sendiri masih menunggu keputusan provider (belum ada ADR pemilihan) sehingga tidak ada linimasa pasti, dan ini terus memblokir T-008 QA.
- **Hanya bangun Copy Link, tanpa placeholder opsi email** — dipertimbangkan tapi King Rezi memilih menyediakan dua opsi sejak awal (opsi email disabled) supaya UI tidak perlu dirombak lagi saat T-005 selesai.
- **Password/passphrase tambahan pada link undangan** (bukan email-bound) — ditolak. Kalau password dikirim lewat channel yang sama dengan link, tidak menambah keamanan riil (siapa pun yang mencegat satu, biasanya dapat yang lain juga); kalau dikirim terpisah, menambah friksi manual tanpa jaminan lebih kuat. Email-bound dinilai lebih kuat karena link yang bocor/diteruskan otomatis tidak berguna bagi orang lain.
- **Bulk invite (multi-email) di versi ini** — ditolak untuk sekarang, ditunda sampai ada kebutuhan nyata (lihat poin 7 di atas).
