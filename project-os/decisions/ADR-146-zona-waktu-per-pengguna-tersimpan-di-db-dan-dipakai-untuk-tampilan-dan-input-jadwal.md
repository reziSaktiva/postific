## Decision ADR-146

### Title

Zona Waktu per Pengguna Tersimpan di DB dan Dipakai untuk Tampilan dan Input Jadwal (T-147)

### Status

Accepted

### Date

2026-10-28

### Context

Sejak T-144, T-145, dan T-146 seluruh tampilan, pengelompokan tanggal, rentang Calendar, dan input jadwal Publish memakai satu konstanta WIB (`Asia/Jakarta`) di `apps/web/src/domains/publishing/wib-time.ts`. King Rezi ingin waktu mengikuti lokasi pengguna. Server tidak tahu zona browser, jadi zona harus tersimpan.

### Decision

1. Zona waktu disimpan **per pengguna** (bukan per workspace), sebagai nama IANA (mis. `Asia/Jakarta`) di kolom baru model `User` (`timeZone`, default `Asia/Jakarta`). Pengguna lama otomatis WIB lewat default migrasi.
2. Nilai awal dideteksi dari browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`) dan disimpan pada kesempatan pertama; pengguna dapat mengubahnya di Settings → Profile. Nilai dari klien divalidasi di server terhadap daftar zona IANA yang valid; nilai tidak valid ditolak.
3. Penyimpanan waktu di DB tetap UTC. Yang berubah hanya cara tanggal/jam dihitung, ditampilkan, dan ditafsirkan input jadwal (menggantikan penafsiran WIB tetap dari T-146).
4. Kolom kedua `User.timeZoneSource` (`pending` | `legacy` | `detected` | `manual`) menandai asal nilai agar deteksi browser berjalan sekali dan tidak menimpa pilihan manual. Baris lama diberi `legacy` (tetap WIB, tidak dideteksi diam-diam); pengguna baru `pending`. Penulisan deteksi atomik (`updateMany where timeZoneSource = 'pending'`). Nama IANA alias dari browser (mis. `Asia/Kolkata`) dipetakan ke nama kanonik runtime saat validasi.
5. `wib-time.ts` direfaktor menjadi helper yang menerima zona sebagai parameter. Konstanta WIB tetap sebagai zona default.
6. Dampak kolom `occurred_at` (T-145) dicek di T-147.5 sebelum migrasi; kolom itu generated dari kolom UTC, tidak terkait zona, sehingga tidak diubah (T-147.5). MCP (`lib/mcp`) sengaja tetap WIB; penyesuaiannya tindak lanjut terpisah.

### Reason

Zona per pengguna sesuai tujuan produk (tiap orang melihat waktu di lokasinya) dan tidak mengubah data tersimpan. Deteksi browser dengan opsi ubah manual mengurangi langkah setup tanpa menghilangkan kontrol pengguna.

### Alternatives Considered

- **Zona per workspace.** Ditolak: anggota di lokasi berbeda melihat waktu yang sama.
- **Hanya WIB, ubah manual.** Ditolak: semua pengguna non-WIB harus mengatur sendiri.
- **Zona dibaca dari browser setiap request tanpa disimpan.** Ditolak: server (RSC, cron, kelompok tanggal) tidak tahu zona browser.

### Impact / Baseline yang diamandemen

- Menggantikan konstanta WIB tetap T-144 dan penafsiran input WIB T-146 sebagai perilaku default; WIB tetap menjadi nilai default.
- Skema Prisma `User` mendapat kolom `timeZone`; `product-discovery/05-architecture/database-strategy.md` perlu diperbarui saat migrasi dibuat.
- UI setelan zona di Settings → Profile mengikuti rancangan artifact Postific (ADR-140).

---
