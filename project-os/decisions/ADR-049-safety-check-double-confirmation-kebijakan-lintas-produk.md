## Decision ADR-049

### Title

Safety Check / Double Confirmation — Kebijakan Lintas Produk

### Status

Accepted

### Date

2026-07-29

### Context

Setelah ADR-047 (Publish Now) dan ADR-048 (Disconnect Account), user
meminta audit menyeluruh: dari seluruh aksi yang ada di baseline
(publish, draft, akun, member, workspace, logout), mana saja yang
**seharusnya** wajib melalui Safety Check / Double Confirmation —
bukan cuma yang kebetulan sudah punya, tapi berdasarkan penilaian risiko
yang konsisten. Sebelum ini, ada 1 pola konfirmasi (Confirmation Summary)
dipakai untuk 2 aksi (Schedule, Publish Now) + 1 pola baru (Disconnect
Confirmation) — tanpa kerangka eksplisit yang bisa dipakai menilai
belasan aksi lain.

### Decision

1. **Kriteria wajib konfirmasi** ditetapkan sebagai kerangka resmi:
   - **Irreversibel/mahal dibatalkan** — tidak ada jalur "undo" yang wajar.
   - **Blast radius besar** — dampak melampaui data milik pengguna sendiri
     (tim, workspace, atau komitmen publik).
2. **Dua tingkatan (tier)**:
   - **Tier 1** (konfirmasi diperkuat, mis. ketik nama untuk konfirmasi):
     Transfer Ownership, Delete/Hapus Workspace.
   - **Tier 2** (dialog standar, pola sama dengan Disconnect Confirmation):
     Delete Post, Delete Media, Remove Member, Update Member Role, Cancel
     Schedule, **Logout**.
   - **Tidak wajib**: Save as Draft, Kirim ke Review, Mark as Done, Reply
     komentar, Connect Account, Reconnect, Remove Link (Start Page).
3. Diklasifikasikan dan didokumentasikan sebagai pola lintas layar baru
   di `key-screen-patterns.md` (bukan UXP baru — lihat Alternatives),
   dengan cross-reference di `navigation-patterns.md` (NP-D10, Logout),
   `roles-permissions.md`, dan `application-layer.md`.

### Reason

- Kerangka reversibilitas + blast radius konsisten dengan cara Publish
  Now (ADR-047) dan Disconnect Account (ADR-048) sudah dinilai
  sebelumnya — bukan kriteria baru yang asing, melainkan generalisasi
  dari pola yang sudah dipakai dua kali.
- Tanpa kerangka eksplisit, keputusan "aksi X butuh konfirmasi atau
  tidak" akan diputuskan ad-hoc per kasus (seperti yang terjadi pada
  Publish Now dan Disconnect Account) — menciptakan risiko inkonsistensi
  di layar-layar yang belum dirancang.
- UXP-03 (Simplisitas) secara eksplisit jadi penyeimbang: aksi
  reversibel/frekuensi tinggi (Reply komentar, Save as Draft) sengaja
  **tidak** diberi konfirmasi tambahan — mencegah kerangka ini
  disalahgunakan untuk menambah friksi di semua tempat.

### Alternatives Considered

- **Logout tidak perlu konfirmasi** (rekomendasi awal — reversibel penuh,
  aksi paling sering dipakai di seluruh app, tanpa risiko kehilangan
  data) — **ditolak oleh user**: Logout dipindah ke Tier 2. Alasan
  eksplisit user tidak dicatat secara rinci; kemungkinan besar melindungi
  dari interupsi pekerjaan yang belum tersimpan saat logout tidak
  sengaja diklik.
- **Tambahkan sebagai UXP-08 baru** (bukan pola lintas layar di
  `key-screen-patterns.md`) — ditolak; `ux-principles.md` secara
  eksplisit membatasi diri ke 7 prinsip yang masing-masing tertelusur ke
  insight User Discovery (I-01–I-08) sebagai Exit Criteria — Safety Check
  adalah penerapan kebijakan, bukan insight pengguna baru. Sebagai
  gantinya ditambahkan sebagai bullet implikasi desain di bawah UXP-04.
- **Bangun langsung method service `deleteWorkspace`/`transferOwnership`
  di `application-layer.md`** — ditolak untuk sesi ini; kedua method ini
  belum ada sama sekali dan screen pemicunya (Workspace Settings →
  General) belum dirancang — menambahkannya sekarang berarti menebak
  kontrak API tanpa desain layar, di luar scope audit dokumentasi.

### Impact

- `key-screen-patterns.md` — bagian baru "Pola Lintas Layar — Safety
  Check / Double Confirmation" (kriteria, tier, klasifikasi lengkap 17
  aksi, catatan implementasi).
- `navigation-patterns.md` — NP-D10 baru (Logout wajib Tier 2).
- `roles-permissions.md`, `application-layer.md` — cross-reference tier
  ditambahkan ke baris yang relevan (Hapus Workspace, Transfer Ownership,
  Remove Member, Update Role, Cancel Schedule, Delete Post, Delete
  Media).
- `application-layer.md` mencatat eksplisit bahwa `deleteWorkspace` dan
  `transferOwnership` **belum punya method service** — gap arsitektur
  terpisah dari ADR ini, ditunda sampai screen Workspace Settings →
  General dirancang.
- **Implementasi belum berjalan** di kode maupun App Prototype untuk
  seluruh aksi Tier 1/Tier 2 yang baru diklasifikasikan di sini (kecuali
  Schedule, Publish Now, Disconnect Account yang sudah ada sebelumnya).

---
