## Decision ADR-096

### Title

RLS untuk Operasi Pra-Membership — Pola SECURITY DEFINER + Session-Variable GUC (Accept Invite)

### Status

Accepted

### Date

2026-08-31

### Context

T-093 (Accept Invite page, `/invite/[token]`) membutuhkan tiga operasi database
yang terjadi **sebelum** user punya baris `workspace_members` di workspace
tujuan — situasi yang belum pernah ditangani RLS existing:

1. Baca satu baris `workspace_invitations` by token (untuk validasi token +
   auto-detect `isExistingUser`) — dilakukan **sebelum** login/sign-up, kadang
   bahkan sebelum user attempt punya sesi apapun.
2. Update baris invitation itu dari `pending` → `accepted` — dilakukan oleh
   invitee, bukan oleh Owner/Admin yang membuatnya.
3. Insert baris baru `workspace_members` (role dari invitation) — juga
   dilakukan oleh invitee, yang secara definisi **belum** jadi member di
   workspace itu saat insert terjadi (chicken-and-egg: butuh membership untuk
   lolos RLS `workspace_members`, tapi insert itu sendiri yang menciptakan
   membership pertama).

Pola RLS existing di codebase ini (`ctx-architecture.md`, `database-strategy.md`)
mengasumsikan aktor **sudah** jadi anggota workspace (`current_user_id` GUC +
subquery ke `workspace_members`) — tidak ada pola untuk operasi pra-membership.

Implementasi awal (migrasi `20260831035427_t093_accept_invite_rls`) menulis 3
policy RLS baru langsung memakai kombinasi email/token dari klaim JWT/kolom
tabel. Dua bug ditemukan dan diperbaiki berurutan dalam sesi yang sama:

- **Migrasi ke-2** (`20260831042017_t093_invitation_select_visibility_fix`):
  Postgres mensyaratkan baris yang di-`UPDATE` juga lolos **minimal satu**
  policy `SELECT` yang berlaku (bukan cukup lolos `WITH CHECK` milik policy
  `UPDATE`-nya sendiri) — policy `SELECT` awal (token-lookup, hanya
  meng-cover status `pending`) berhenti meng-cover baris begitu `UPDATE`
  mengubah status jadi `accepted`, sehingga hasil `UPDATE` tidak
  ter-return/tervalidasi dengan benar. Diperbaiki dengan menambah policy
  `SELECT` kedua: user selalu boleh melihat invitation yang emailnya cocok
  dengan emailnya sendiri, apa pun status invitation-nya.
- **Migrasi ke-3** (`20260831044328_t093_code_review_rls_hardening`), hasil
  review arsitektur Ridwan, 2 temuan:
  1. Policy `SELECT` token-lookup awal terlalu longgar — ia membuka baca ke
     **seluruh** baris `pending` (bukan cuma baris yang token-nya cocok),
     karena predicate token comparison ditulis dengan cara yang tidak
     benar-benar membatasi row set di level RLS.
  2. Policy `INSERT` pada `workspace_members` tidak mengunci `role` pada
     baris yang di-insert via jalur accept-invite — user secara teori bisa
     insert dirinya dengan role apa pun, bukan role yang sudah ditetapkan
     invitation.

### Decision

1. **Session-variable GUC untuk token lookup** — pola `app.current_user_id`
   yang sudah ada diperluas dengan GUC baru `app.invite_lookup_token`. Sebelum
   query token-lookup dijalankan, aplikasi (`with-current-user.ts`, helper
   `setInviteLookupToken`) men-set GUC ini dalam scope transaksi Prisma.
   Policy `SELECT` token-lookup sekarang membandingkan `token` baris terhadap
   nilai GUC (bukan menerima seluruh baris `pending`), dan **default-deny**
   kalau GUC tidak di-set (tidak ada token di scope, tidak ada baris yang
   lolos) — satu baris per token yang benar-benar diminta, tidak pernah bulk.
2. **Dual SELECT policy untuk siklus hidup invitation** — satu policy khusus
   token-lookup pra-auth (di atas), satu policy tambahan "user boleh lihat
   invitation yang emailnya cocok dengan emailnya sendiri" (paska-auth, dipakai
   supaya hasil `UPDATE status → accepted` tetap visible sesuai constraint
   Postgres UPDATE+SELECT). Keduanya independen, tidak saling menggantikan.
3. **Role-locked INSERT via SECURITY DEFINER function** — fungsi
   `has_accepted_invitation` diberi parameter tambahan `role`, dipakai sebagai
   predicate policy `INSERT workspace_members`: baris yang di-insert **wajib**
   memiliki `role` yang sama persis dengan `role` pada invitation yang sudah
   `accepted` milik email tersebut. Tidak ada jalur untuk insert dengan role
   yang berbeda dari invitation.
4. Pola ini (SECURITY DEFINER function + session-variable GUC untuk operasi
   pra-membership) ditetapkan sebagai **preseden** untuk kasus serupa di masa
   depan (mis. public magic-link lain, self-service akses yang belum punya
   row keanggotaan) — bukan solusi sekali pakai khusus invite.

### Reason

- GUC + default-deny lebih aman daripada predicate token-comparison naif di
  WHERE clause policy — RLS Postgres mengevaluasi policy per-baris terhadap
  seluruh tabel kalau predicate tidak benar-benar menyempitkan row set
  (celah yang jadi temuan review Ridwan #1); men-set token lewat GUC
  transaksi memastikan hanya satu baris yang bisa cocok, dan tanpa GUC
  ter-set tidak ada baris yang lolos sama sekali.
- Constraint Postgres "UPDATE butuh policy SELECT yang meng-cover baris
  hasil update" bukan sesuatu yang bisa dihindari lewat desain
  aplikasi — harus ditangani di level policy, sehingga policy SELECT kedua
  (by-email, semua status) diperlukan sebagai pelengkap, bukan duplikasi.
- Mengunci `role` di level RLS (bukan hanya di service layer) menutup celah
  privilege escalation kalau ada jalur lain yang memanggil insert
  `workspace_members` tanpa lewat `WorkspaceService` — defense in depth,
  konsisten dengan filosofi RLS existing di codebase ini (RLS sebagai lapisan
  terakhir, bukan satu-satunya).
- Mendokumentasikan pola ini sebagai preseden mencegah tiap fitur
  pra-membership baru menemukan ulang solusi yang sama dari nol (dan
  berpotensi mengulang 2 bug yang sama).

### Alternatives Considered

- Membiarkan token-lookup dan role-assignment sepenuhnya di service layer
  (Prisma query tanpa RLS tambahan, mengandalkan `SECURITY DEFINER`
  murni tanpa RLS sama sekali) — ditolak; melanggar filosofi
  `database-strategy.md` bahwa RLS adalah lapisan pertahanan wajib untuk
  tabel yang bisa diakses lintas-user, bukan opsional.
- Bulk-allow SELECT semua invitation `pending` (implementasi awal
  migrasi ke-1) — ditolak setelah review Ridwan; membuka baca metadata
  invitation workspace lain (email, role, workspace target) ke siapa pun
  yang query tanpa mengetahui token, murni karena predicate tidak
  benar-benar menyaring row.
- Validasi role hanya di `WorkspaceService.acceptInvitation` (application
  layer saja, tanpa RLS) — ditolak; tidak ada defense-in-depth kalau ada
  jalur lain (mis. script migrasi data, akses langsung) yang menulis ke
  `workspace_members` tanpa lewat service ini.

### Impact / Baseline yang diamandemen

- `apps/web/prisma/migrations/20260831035427_t093_accept_invite_rls/`,
  `20260831042017_t093_invitation_select_visibility_fix/`,
  `20260831044328_t093_code_review_rls_hardening/` — 3 migrasi baru, sudah
  diterapkan ke DB dev.
- `apps/web/src/lib/prisma/with-current-user.ts` — helper baru
  `setInviteLookupToken` (GUC `app.invite_lookup_token`).
- `database-strategy.md` — tidak diamandemen isinya di ADR ini; pola baru
  ini dicatat sebagai referensi implementasi di `tickets/v01-foundation.md`
  § T-093, bukan duplikasi ke baseline (evaluasi promosi ke baseline
  formal bisa menyusul kalau pola ini dipakai ulang di fitur lain).
- `tickets/v01-foundation.md` § T-093 — referensi ADR-096 ditambahkan.

---
