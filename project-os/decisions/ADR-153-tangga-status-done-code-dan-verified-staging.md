## Decision ADR-153

### Title

Tangga Status Tiket: Done (code) dan Verified (staging) Dipisah; Verifikasi Staging Menjadi Satu Kali per Gelombang

### Status

**Accepted** (disetujui King Rezi, 2026-11-02; T-181.2). Berlaku untuk tiket baru dan tiket yang dipindahkan lewat T-182.3.

### Date

2026-11-02

### Context

Gelombang A MCP v0.5 (PR 222 dan PR 227) membuat beberapa tiket menggantung 🟡 menunggu verifikasi staging, padahal kode, review, dan QA sudah beres. Kebiasaan "tutup hanya setelah terbukti di staging" berasal dari tiket MCP (T-150.7, T-178), bukan dari ADR-149. Definisi "tiket selesai" di ADR-149 (poin 2: golden path E2E dan suite regresi hijau) sudah berbasis `local`; jadi ADR ini tidak mengubah ADR-149, hanya memberi nama pada tahap kedua yang selama ini tersirat. Mengubah definisi selesai menyentuh aturan kerja, jadi butuh ADR (`AGENTS.md` aturan 2). Alasan lengkap dan alur gelombang ada di `specs/S-003.md`.

### Decision

**1. Dua tahap status.**

- **Done (code):** implementasi selesai; `/code-review` dan review arsitektur (Ridwan) tanpa temuan terbuka; QA (Najwa) lolos; `typecheck`, `lint`, dan tes hijau; E2E golden path hijau di lokal sesuai ADR-149. Tiket boleh ✅ pada tahap ini dan **tidak** menunggu merge atau deploy.
- **Verified (staging):** satu verifikasi per gelombang setelah satu deploy gelombang itu. Hal yang tidak bisa dibuktikan lokal (OAuth di balik proxy Railway, RLS role `app_runtime`, klien MCP nyata, multi-instance) menjadi butir verifikasi gelombang, bukan syarat Done.

**2. Bagian "Belum terbukti" tetap wajib** di tiket sampai butir verifikasinya lulus. ✅ tidak boleh dipakai untuk menyembunyikan klaim yang belum teruji.

**3. Mengamandemen konvensi tutup-setelah-staging** di tiket MCP (T-150.7, T-178): tiket baru mengikuti tangga ini; tiket yang sudah ✅ tidak dibuka ulang. Tiket yang kini 🟡 hanya karena menunggu staging dipindah ke tangga baru lewat T-182.3, dengan butir verifikasi gelombang yang eksplisit (T-189 untuk gelombang A).

**4. Koreksi catatan:** ADR-149 tidak mewajibkan bukti staging per tiket; gerbang staging ada di CI-D06/CI-D07 untuk promosi ke `main`, bukan untuk menutup tiket.

### Reason

- Kode yang sudah lolos review dan tes lokal tidak seharusnya tertahan oleh jadwal deploy; tiket yang menggantung menyembunyikan pekerjaan yang benar-benar tersisa.
- Satu verifikasi per gelombang cocok dengan satu PR integrasi dan satu build Railway (S-003), sehingga biaya verifikasi tidak dibayar per tiket.
- Menjaga bagian "Belum terbukti" mencegah ✅ menjadi klaim yang lebih besar dari bukti.

### Alternatives Considered

- **Tetap tutup hanya setelah staging.** Ditolak: tiket menggantung dan setiap tiket butuh verifikasi sendiri.
- **Tutup ✅ saat kode selesai tanpa tahap Verified.** Ditolak: butir yang hanya terbukti di staging (RLS, OAuth di balik proxy) akan hilang dari pelacakan.
- **Verifikasi staging per tiket.** Ditolak: satu gelombang memakai satu deploy; verifikasi per tiket mengulang pekerjaan yang sama.

### Consequences

- `project-os-navigator` (§ Pekerjaan Baru), `AVAILABLE_TICKETS.md` (legenda), dan bentuk tiket di `specs/README.md` memuat dua tahap ini (T-182); satu sumber, tanpa salinan (ADR-133).
- Tiket gelombang A MCP T-151, T-152, T-154, dan T-180 berpindah ke tangga baru; penutupan Verified lewat T-189. T-155, T-156, dan T-157 menyusul setelah tes E2E golden path-nya hijau di lokal.
- Tidak ada perubahan di `apps/` atau `packages/`; tidak ada migrasi.
- Bila ADR ini kelak diubah, T-182, T-183, dan T-190 disesuaikan.

### Addendum 2026-11-06: status ditulis di PR yang sama, tanpa PR khusus status

Usulan King Rezi 2026-11-06 (gelombang 2 S-006): menandai status setelah merge butuh PR tambahan yang tidak efektif. Tangga status di atas tidak berubah; yang berubah urutan kerjanya.

- **Done (code)** ditulis di tiket dan `AVAILABLE_TICKETS.md` di dalam PR integrasi, sebelum PR dibuka, sehingga status menjadi benar tepat saat merge ke `staging`. Tidak ada PR khusus untuk menandai Done (code).
- **Verified (staging)** dicatat di PR integrasi gelombang berikutnya (atau PR berikutnya yang menyentuh dokumen tiket), bukan PR tersendiri. Selama menunggu, tiket tetap `🟡 Done (code), menunggu Verified (staging)`.
- Pengecualian: bila tidak ada PR berikutnya dalam waktu dekat, boleh satu PR dokumen kecil untuk Verified (staging).
