## Decision ADR-101

### Title

Members List Menampilkan Undangan Pending via Gabungan Data (Amandemen ADR-100) — Berlaku Kedua Metode Invite

### Status

Accepted

### Date

2026-09-07

### Decision

1. **Mengamandemen ADR-100.** ADR-100 sebelumnya menetapkan `MemberStatus.Pending`
   direservasi khusus metode **"Kirim via Email"** (T-007.7, blocked T-005),
   dengan rencana pre-create baris `workspace_members` asli berstatus
   `Pending` saat invite dikirim. King Rezi memperluas keputusan: **kedua
   metode invite** (Copy Link **dan** Kirim via Email) harus sama-sama
   membuat orang yang diundang langsung terlihat di `/settings/members`
   dengan status Pending, begitu invite dibuat — bukan cuma metode Email.
2. **Pendekatan teknis berubah** dari "pre-create baris `workspace_members`"
   menjadi **gabungan data presentasi (merge di layer aplikasi)** — dipilih
   setelah ditemukan `WorkspaceMember.userId` bersifat **`NOT NULL`**
   (`schema.prisma:125`), sehingga tidak mungkin insert baris
   `workspace_members` untuk orang yang belum punya `User` account (kasus
   umum di kedua metode invite). Ini justru alasan asli `WorkspaceInvitation`
   dibuat sebagai tabel terpisah (ADR-072) — keputusan ini menegaskan
   pemisahan itu, bukan membalikkannya.
3. **Desain final:** `/settings/members` menampilkan **gabungan dua sumber**:
   - `workspace_members` (existing) → baris status Active/Removed, seperti
     sekarang.
   - `WorkspaceInvitation` dengan `status = pending` dan belum `expiresAt`
     → baris **virtual** status **Pending**, identitas ditampilkan pakai
     `invitation.email` (belum ada `User`/nama sampai diterima). Berlaku
     untuk invitation yang dibuat lewat **metode manapun** (Copy Link
     maupun Kirim via Email) — sumbernya sama-sama tabel
     `WorkspaceInvitation`, sehingga otomatis berlaku untuk keduanya tanpa
     logic bercabang per metode.
   - Begitu invitation di-accept (`T-093`, pola existing tidak berubah),
     baris virtual ini otomatis hilang (invitation pindah status
     `accepted`) dan digantikan baris asli `workspace_members` dengan
     status Active.
4. **Tidak ada perubahan skema** `workspace_members` (kolom `userId` tetap
   `NOT NULL`, tidak ada migration) — murni perubahan cara baca data untuk
   ditampilkan di `WorkspaceService`/halaman Members. Tidak menyentuh RLS
   index `[userId, status]` yang dipakai `current_user_workspace_ids()`
   sama sekali.
5. **Aksi untuk baris virtual Pending:** hanya **"Cancel Invitation"**
   (mengubah `WorkspaceInvitation.status` jadi `revoked`, RBAC sama dengan
   `removeMember`/`inviteMember` — `assertActorCanManageMembers`). **Tidak**
   ada "Change Role" untuk baris virtual (belum ada member sungguhan untuk
   diubah rolenya) — beda dari mockup Claude Design (`settings-members.html`
   baris "Lara") yang menampilkan role select untuk baris Invited; perbedaan
   ini disengaja (mockup itu bagian dari **KI-047**, dokumentasi Claude
   Design belum disinkronkan ke baseline kode terkini) dan akan diselaraskan
   balik ke Claude Design menyusul.
6. **KI-046 tidak berubah** (tetap `Promoted to T-007.7`) untuk bagian
   "status Pending direservasi konsepnya" — tapi implementasi konkret yang
   dijelaskan di catatan T-007.7 (pre-create baris `workspace_members`)
   **digantikan** oleh pendekatan gabungan data di ADR ini. Task baru
   **T-007.8** ditambahkan untuk melacak implementasi fitur ini —
   **tidak** bergantung pada T-005 (tidak butuh email provider sama
   sekali, karena datanya berasal dari invitation yang sudah ada untuk
   Copy Link).

### Reason

- King Rezi ingin visibilitas: Admin/Owner perlu tahu siapa saja yang
  sudah diundang tapi belum bergabung, tanpa membedakan metode invite
  mana yang dipakai.
- Pendekatan pre-create baris `workspace_members` (rencana ADR-100)
  ternyata tidak bisa diterapkan ke Copy Link karena constraint skema
  (`userId NOT NULL`) — memaksa `userId` jadi nullable akan mengubah unique
  constraint dan index RLS yang dipakai di seluruh policy, risiko regresi
  luas untuk manfaat yang bisa dicapai lebih aman lewat gabungan data.

### Alternatives Considered

- **Ubah `userId` jadi nullable + insert baris `workspace_members` asli**
  (rencana awal ADR-100) — ditolak setelah dicek lebih lanjut: perlu
  migration, ubah `@@unique([workspaceId, userId])`, dan re-verifikasi
  `current_user_workspace_ids()` (dipakai di RLS seluruh tabel workspace-
  scoped) tidak salah include baris tanpa `userId`. Risiko regresi jauh
  lebih tinggi dibanding manfaatnya.
- **Cuma tampilkan Pending untuk metode Email, biarkan Copy Link tanpa
  visibilitas** (ADR-100 asli) — ditolak; King Rezi eksplisit minta
  berlaku untuk kedua metode.

---
