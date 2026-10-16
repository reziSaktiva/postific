## Decision ADR-100

### Title

`MemberStatus.Pending` Direservasi untuk Metode Invite "Kirim via Email" (T-007.7)

### Status

Accepted — Amended by ADR-101 (2026-09-07)

### Date

2026-09-07

### Decision

1. `MemberStatus.Pending` (enum `@social/shared`) **bukan** dead code yang
   perlu dihapus — statusnya secara resmi **direservasi** untuk metode
   invite **"Kirim via Email"** (T-007.7, ADR-080), yang saat ini masih
   `blocked` menunggu **T-005** (email provider belum ditetapkan, KI-001).
2. Desain alur yang ditetapkan untuk T-007.7 begitu T-005 selesai:
   - Saat Admin/Owner memilih opsi "Kirim via Email" di dialog invite
     (`InviteMemberDialog.tsx`), `WorkspaceService.inviteMember` membuat
     baris `workspace_members` **langsung saat itu juga** dengan status
     `Pending` (bukan menunggu sampai user accept) — supaya invite yang
     terkirim via email langsung terlihat di `/settings/members` sebagai
     baris "Pending", bukan tersembunyi total sampai diterima.
   - Saat user membuka link di email dan menyelesaikan alur accept-invite
     (`/invite/[token]`, pola T-093), baris `workspace_members` yang sudah
     ada **diupdate** jadi `Active` (bukan insert baru) — role tetap
     diambil dari `WorkspaceInvitation` (T-093.3), tidak berubah.
   - Metode **"Copy Link"** (T-007.1, sudah jalan) **tidak berubah** —
     tetap tidak membuat baris `workspace_members` sampai user benar-benar
     accept (insert langsung `Active`, pola T-093.3 existing). Perbedaan
     dua metode ini disengaja: "Kirim via Email" tahu pasti target sudah
     menerima email undangan, sehingga masuk akal ditampilkan sebagai
     "menunggu respons"; "Copy Link" bisa dibagikan ke siapa saja sebelum
     benar-benar dibuka, jadi tidak ada dasar untuk pre-create membership.
3. Implementasi konkret (skema Prisma, RLS, `WorkspaceService` method,
   UI badge) **belum dikerjakan sekarang** — tetap menunggu T-005 selesai
   sesuai dependency yang sudah ada (ADR-080). ADR ini murni mengunci
   _desain_ status `Pending`, mencegah keputusan implisit/diam-diam saat
   T-007.7 akhirnya dikerjakan.
4. **KI-046** ("`MemberStatus.Pending` tidak pernah di-assign di flow
   produksi manapun") ditutup dengan status **Promoted to T-007.7** —
   bukan dihapus/dianggap selesai, karena implementasinya masih menunggu
   T-005.

### Reason

- Ditemukan Najwa QA Engineer (2026-09-04) saat QA badge "Pending" —
  status itu ada di enum dan UI tapi tidak bisa dipicu lewat alur user
  manapun, menimbulkan ambiguitas apakah ini gap yang perlu diperbaiki
  atau scope masa depan yang sengaja belum dibangun.
- King Rezi memilih opsi "disiapkan untuk metode Kirim via Email"
  (2026-09-07) — konsisten dengan rencana dua-metode invite yang sudah
  ditetapkan ADR-080, daripada menghapus status yang sebenarnya sudah
  punya tujuan produk yang jelas (hanya belum bisa diimplementasi karena
  T-005 blocked).

### Alternatives Considered

- **Hapus `MemberStatus.Pending` sebagai dead code** — ditolak; status ini
  punya tujuan produk yang jelas (indikator "undangan email terkirim,
  menunggu diterima"), menghapusnya sekarang berarti perlu ditambahkan
  lagi nanti saat T-007.7 dikerjakan.
- **Biarkan ambigu tanpa keputusan (status quo)** — ditolak; King Rezi
  memilih mengunci maksud desainnya sekarang lewat ADR supaya T-007.7
  nanti tidak perlu menebak ulang alasan status ini ada.

---
