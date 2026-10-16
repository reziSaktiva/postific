## Decision ADR-050

### Title

Transfer Ownership & Delete Workspace — Method Service dan Alur Transfer

### Status

Accepted

### Date

2026-07-29

### Context

ADR-049 menemukan `deleteWorkspace` dan `transferOwnership` — dua aksi
Tier 1 — sama sekali tidak punya method service di `application-layer.md`,
dan sengaja tidak ditambahkan saat itu karena screen pemicunya (Workspace
Settings → General) belum dirancang. User meminta gap ini diperbaiki.
Menelusuri lebih lanjut, `deleteWorkspace` ternyata tidak punya ambiguitas
berarti (skema DB sudah `ON DELETE CASCADE` di setiap tabel `workspace_id`
— perilaku cascade sudah implisit jelas). Tapi `transferOwnership` punya
satu fork nyata yang belum pernah diputuskan di dokumen manapun:
`roles-permissions.md` hanya menyebut _"Ownership bisa ditransfer ke
Admin lain"_ tanpa menjelaskan apakah prosesnya langsung (Owner memilih,
selesai) atau butuh persetujuan Admin target.

### Decision

1. **Transfer Ownership adalah proses dua langkah** (bukan swap
   langsung):
   - `transferOwnership(targetMemberId)` — Owner memicu, RBAC Owner
     saja, target harus Admin aktif. Mengisi `Workspace.
pendingOwnerTransferTo`, mengirim notifikasi
     `ownership_transfer_requested` ke target. **Tidak** langsung
     menukar role.
   - `acceptOwnershipTransfer()` — Admin target menerima. RBAC: hanya
     user yang cocok dengan `pendingOwnerTransferTo`. Role Owner lama
     dan Admin target bertukar dalam satu transaksi;
     `pendingOwnerTransferTo` dikosongkan; notifikasi
     `ownership_transfer_resolved` ke Owner lama.
   - Kedua method wajib konfirmasi **Tier 1** (ADR-049) sebelum
     dipicu/diterima — pola "ketik nama workspace untuk konfirmasi".
2. **`deleteWorkspace`** ditambahkan sebagai method sederhana: Owner
   saja, wajib konfirmasi Tier 1, cascade mengikuti constraint DB yang
   sudah ada — tidak ada logika tambahan yang perlu didesain.
3. Model data: `Workspace.pendingOwnerTransferTo: UserId?`
   (`domain-model.md` DM-D11) + kolom `pending_owner_transfer_to`
   (`database-strategy.md`) + dua `NotificationType` baru
   (`ownership_transfer_requested`, `ownership_transfer_resolved`,
   `domain-model.md`).

### Reason

- Transfer kepemilikan berarti memindahkan tanggung jawab penuh
  (termasuk billing) ke orang lain — memaksakannya secara sepihak tanpa
  persetujuan berisiko membebani Admin yang belum siap/tidak setuju.
  Pola ini konsisten dengan `inviteMember` + `acceptInvite` yang sudah
  ada di dokumen yang sama (undang dulu, baru aktif setelah diterima) —
  bukan pola baru yang asing bagi arsitektur ini.
- `deleteWorkspace` tidak butuh keputusan tambahan karena kontraknya
  sudah sepenuhnya implisit dari skema DB (`DB-D03`, `ON DELETE CASCADE`)
  — menambahkan method-nya sekarang tidak berarti menebak apa pun.

### Alternatives Considered

- **Transfer langsung tanpa persetujuan** (Owner pilih Admin, konfirmasi
  Tier 1, role langsung bertukar) — sempat direkomendasikan sebagai opsi
  paling sederhana (konsisten dengan Update Member Role yang juga
  langsung), **ditolak oleh user** demi keamanan tambahan: Admin target
  harus punya kesempatan menolak sebelum menanggung kepemilikan penuh.
- **Tunda dulu sampai screen Workspace Settings dirancang** (keputusan
  ADR-049 sebelumnya) — dibatalkan atas permintaan user; method service
  bisa didefinisikan di level arsitektur tanpa menunggu UI, mengikuti
  pola method lain di `WorkspaceService` yang juga tidak semuanya
  punya KSP screen (mis. `inviteMember`, `removeMember`).

### Impact

- `application-layer.md` — 3 method baru di `WorkspaceService`.
- `domain-model.md` — field baru `pendingOwnerTransferTo`, 2
  `NotificationType` baru, DM-D11.
- `database-strategy.md` — kolom baru `pending_owner_transfer_to`.
- `roles-permissions.md` — klarifikasi alur dua langkah.
- **UI/screen Workspace Settings → General masih belum dirancang** —
  method service ini siap dipakai begitu screen-nya ada; ADR ini
  menyelesaikan kontrak arsitektur, bukan implementasi UI.
