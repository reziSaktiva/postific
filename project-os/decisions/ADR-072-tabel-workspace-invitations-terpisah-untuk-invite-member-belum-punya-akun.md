## Decision ADR-072

### Title

Tabel `workspace_invitations` Terpisah — Invite Member Harus Menyasar Orang yang Belum Punya Akun (T-007.1/.2)

### Status

Accepted — Amended by ADR-080 (2026-08-14)

### Date

2026-08-07

### Context

Saat mengerjakan T-007 (Members management), model awal yang diasumsikan
untuk `inviteMember` adalah menambahkan baris langsung ke `workspace_members`
via lookup email ke user yang sudah terdaftar (`user_id NOT NULL`).

King Rezi mengonfirmasi langsung bahwa invite member **wajib bisa menyasar
orang yang belum punya akun sama sekali** — bukan cuma existing user. Model
`workspace_members` tidak cukup untuk kasus ini karena kolom `user_id`
mensyaratkan `NOT NULL` (baris member hanya valid setelah ada akun yang
terhubung ke workspace).

`database-strategy.md` sebelumnya cuma mendefinisikan `workspace_members`
tanpa tabel invitation terpisah — ini gap yang baru ditutup lewat ADR ini.

### Decision

1. Ditambahkan model Prisma baru `WorkspaceInvitation` → tabel
   `workspace_invitations`, terpisah dari `workspace_members`.
2. Kolom inti: `email`, `role`, `token` (unique), `status`, `invitedByUserId`,
   `expiresAt` — invitation dikirim ke alamat email, bukan ke `user_id`,
   sehingga tidak mensyaratkan penerima sudah punya akun.
3. Alur penuh (`inviteMember` yang membuat baris ini + mengirim email berisi
   `token`, dan proses accept yang mengonversi invitation jadi baris
   `workspace_members`) **belum diimplementasikan** — masih menunggu T-005
   (transactional email provider) selesai. ADR ini mencakup keputusan skema
   - repository method (`createInvitation`, `findInvitationByToken`), bukan
     alur invite end-to-end.

### Reason

- `workspace_members.user_id NOT NULL` by design (baris member = keanggotaan
  aktif yang sudah terverifikasi ke akun) — mencampur invitation ke tabel
  yang sama berarti melonggarkan constraint itu untuk semua konsumen lain.
- Tabel terpisah dengan `token` unik + `expiresAt` adalah pola standar untuk
  invitation berbasis email yang bisa kedaluwarsa/dibatalkan tanpa
  menyentuh baris membership yang sudah ada.

### Alternatives Considered

- **Kolom nullable di `workspace_members`** (`user_id` nullable + kolom
  invite tambahan). Ditolak — melonggarkan constraint inti tabel membership
  untuk seluruh konsumen lain, dan mencampur dua siklus hidup (invitation
  yang expire/dibatalkan vs membership aktif) di satu tabel.

### Impact / Baseline yang diamandemen

- `product-discovery/05-architecture/database-strategy.md` — sebelumnya
  hanya mendefinisikan `workspace_members`, belum menyebut tabel invitation
  terpisah. Baseline ini perlu diupdate menyusul (belum dieksekusi di sesi
  ini) untuk merefleksikan `workspace_invitations`. Ini perubahan struktural
  pada Static Reference — wajib dicatat juga di `COMPLETE_TASK.md`.

### Catatan implementasi

- Migration: `apps/web/prisma/migrations/20260807061502_add_workspace_invitations/`.
- ID baru ditambahkan di `packages/shared/src/ids.ts`.
- Repository method: `apps/web/src/domains/workspace/repositories/workspace.repository.ts`
  dan implementasi Prisma-nya di
  `apps/web/src/lib/repositories/workspace/workspace.repository.ts`
  (`createInvitation`, `findInvitationByToken`, plus `getMember`,
  `findMemberById`, `removeMember`, `updateMemberRole`).
- `WorkspaceService.removeMember` + `updateMemberRole` sudah lengkap dengan
  RBAC manual (Owner/Admin only; Owner tidak bisa dihapus/diubah rolenya;
  `updateMemberRole` menolak promosi ke Owner) — lihat T-007.1 di
  `tickets/v01-foundation.md`. `inviteMember` sendiri masih Blocked oleh T-005.

---
