## Decision ADR-161

### Title

Tiket ✅ pada Done (code); butir yang butuh staging pindah ke tiket verifikasi gelombang, bukan menahan tiketnya (mengamandemen ADR-153)

### Status

**Accepted** (disetujui King Rezi di chat, 2026-11-12). Berlaku untuk tiket baru; tiket yang kini 🟡 dievaluasi lewat tiket tindak lanjut.

### Date

2026-11-11

### Context

Usulan King Rezi 2026-11-11: status 🟡 `Done (code), menunggu Verified (staging)` memaksa PR hanya untuk menandai tiket selesai, padahal banyak tiket bisa dibuktikan penuh di lokal. Pertanyaan yang seharusnya diajukan di awal: **apakah fitur ini bisa diuji lokal, atau harus di-deploy ke staging dulu?**

ADR-153 sudah menyatakan tiket boleh ✅ pada Done (code) dan butir yang hanya terbukti di staging menjadi butir verifikasi gelombang, bukan syarat Done. Dalam praktik, penulisan tiket tetap memakai status antara 🟡 `menunggu Verified (staging)` untuk hampir semua tiket gelombang, termasuk tiket yang tidak punya butir staging sama sekali (contoh: tiket S-004 gelombang 1, yang hanya dokumen). Akibatnya baris antrian tidak keluar, dan penutupannya butuh PR tambahan. Addendum ADR-153 (2026-11-06) sudah menghapus PR khusus status untuk Done (code), tetapi tidak menutup celah status antara ini.

Aturan 9 `AGENTS.md` (tidak ada commit langsung ke `staging` atau `main`) tidak diubah ADR ini. Setiap perubahan dokumen tetap lewat branch dan PR; yang dikurangi adalah PR yang hanya untuk menandai status.

### Decision

**1. Pertanyaan pembeda saat tiket dibuat atau saat Done (code) dinilai:** "Apakah tiket ini bisa dibuktikan lokal, atau ada butir yang hanya terbukti setelah deploy staging?" Jawabannya ditulis di tiket sebagai field **Verifikasi**: `lokal` atau `staging`.

**2. Tiket `lokal`:** ✅ saat Done (code) terpenuhi, ditulis di PR yang sama dengan pekerjaannya (addendum ADR-153). Tidak ada status 🟡 `menunggu Verified (staging)` dan tidak ada PR tambahan.

**3. Tiket `staging`:** ✅ saat Done (code) terpenuhi. Butir yang hanya terbukti di staging dipindah ke **tiket verifikasi gelombang** (pola T-189), bukan ditahan di tiket asal. Bagian "Belum terbukti" di tiket asal tetap wajib dan menunjuk tiket verifikasi itu, jadi ✅ tidak menyembunyikan klaim yang belum teruji (ADR-153 butir 2 tidak berubah).

**4. Status antara 🟡 `Done (code), menunggu Verified (staging)` dihapus** sebagai status tiket. Satu-satunya tiket yang tetap terbuka karena staging adalah tiket verifikasi gelombang itu sendiri.

**5. Verified (staging)** tetap satu kali per gelombang setelah satu deploy (ADR-153 butir 1). Hasilnya dicatat di tiket verifikasi gelombang dan ikut PR berikutnya yang menyentuh dokumen tiket, tanpa PR tersendiri (addendum ADR-153).

**6. Spec yang hanya mengubah dokumen** tidak punya butir staging; seluruh tiketnya bertipe `lokal`. Verifikasinya `docs:check` dan uji yang disebut tiket, dalam satu branch dan satu PR.

### Reason

- Status yang tidak mencerminkan pekerjaan yang tersisa membuat antrian berisik dan memaksa PR hanya untuk menutup tiket.
- Memindahkan butir staging ke tiket verifikasi gelombang menjaga ketertelusuran tanpa menahan tiket asal.
- Field **Verifikasi** menjawab pertanyaan lokal-atau-staging sekali, di awal, bukan setiap kali status dinilai.

### Alternatives Considered

- **Tetap seperti ADR-153 apa adanya.** Ditolak: celah status antara terus menimbulkan PR status dan baris antrian yang menggantung.
- **Status tidak disimpan di git (mis. alat pelacak eksternal).** Ditolak untuk sekarang: perubahan jauh lebih besar, memecah Source of Truth (`project-os/`), dan memerlukan ADR dan tiket sendiri.
- **Hapus tangga Verified (staging) sepenuhnya.** Ditolak: butir seperti RLS `app_runtime`, OAuth di balik proxy, dan klien MCP nyata memang hanya terbukti di staging.

### Consequences

- Bila Accepted, satu tiket tindak lanjut menerapkan perubahan ini: `project-os-navigator` (§ New Work), legenda `AVAILABLE_TICKETS.md`, bentuk tiket di `specs/README.md` (field **Verifikasi**), dan `wave-work` langkah 7 dan 8. Satu sumber, tanpa salinan (ADR-133).
- Tiket yang sudah 🟡 `menunggu Verified (staging)` dievaluasi satu per satu: tiket `lokal` menjadi ✅, tiket `staging` menunjuk tiket verifikasi gelombangnya.
- Tidak ada perubahan di `apps/` atau `packages/`; tidak ada migrasi. Aturan 9 `AGENTS.md` tidak berubah.
- Kata kunci "Belum terbukti" tidak berubah (S-004).
