## Decision ADR-163

### Title

Dokumen lapisan 3 pindah ke bahasa Inggris, kata kunci dokumen ikut berubah, dan pengecualian Append-Only untuk penggantian kata kunci (mengamandemen ADR-160)

### Status

**Accepted** (disetujui King Rezi di chat, 2026-11-12, T-263.2). Tiket lanjutan S-007 boleh dimulai.

### Date

2026-11-12

### Context

ADR-160 memindahkan lapisan 1 dan 2 ke bahasa Inggris dan menetapkan lapisan 3 (`project-os/`, `product-discovery/`, `context/`) tidak diterjemahkan. ADR-162 menyusul untuk delapan berkas agen. S-004 selesai tanpa menyentuh lapisan 3.

Tujuan S-004 (keselarasan dengan skill berbahasa Inggris dan kolaborator baru yang bekerja dalam bahasa Inggris) masih berlaku: agen dan kolaborator kini membaca instruksi dalam bahasa Inggris, tetapi baseline, ADR, tiket, dan spec yang mereka rujuk masih Bahasa Indonesia. Spec S-007 (draf 2026-11-12) mengukur lapisan itu (sekitar 255 berkas, 46.000 baris) dan mencatat keterkaitannya: skrip `docs:check` dan `docs:where` mencocokkan kata kunci Indonesia, empat skill memakai kata kunci dokumen, ADR bersifat Append-Only, dan gelombang S-005 serta S-006 masih menyunting berkas tiket.

King Rezi menjawab enam pertanyaan S-007 pada 2026-11-12. Jawabannya dicatat di S-007 bagian Keputusan dan diringkas di bawah.

### Decision

1. **Lapisan 3 diterjemahkan ke bahasa Inggris**, bertahap, satu berkas utuh per tiket atau satu tiket per folder kecil.
2. **Cakupan C lalu B.** Percobaan di `context/`, lalu dokumen hidup: `product-discovery/` dan aturan serta ringkasan di `project-os/` tingkat atas (kecuali `CONVERSATIONS.md`). ADR, tiket, spec yang sudah selesai, dan `CONVERSATIONS.md` tetap Bahasa Indonesia sebagai catatan sejarah. Spec dan tiket baru ditulis dalam bahasa Inggris sejak ADR ini Accepted.
3. **Kata kunci dokumen dan status ikut diterjemahkan** ("Berikutnya", "Belum terbukti", "Baca dulu", legenda status, nama kolom). Padanannya ditetapkan di tiket skrip dan disetujui King Rezi. `docs:check`, `docs:where`, dan skill `project-os-navigator`, `wave-plan`, `wave-work`, serta `docs-consistency-audit` berubah sebelum atau bersama terjemahan `AVAILABLE_TICKETS.md`.
4. **Pengecualian Append-Only yang sempit:** pada tiket dan ADR lama, hanya kata kunci dokumen (butir 3) yang boleh diganti. Isi keputusan, angka, ID, tautan, dan prosa tidak berubah. Penggantian dilakukan satu kali lewat tiket sendiri, diperiksa dengan `docs:check`, dan dicatat di `PROJECT_RULES.md` § Append-Only sebagai pengecualian eksplisit kedua.
5. **Waktu:** mulai sekarang, tanpa menunggu gelombang S-005 dan S-006. Berkas yang sering diedit (`AVAILABLE_TICKETS.md`, `PROJECT_STATE.md`, berkas tiket) diterjemahkan dalam tiket pendek yang di-merge segera, dan tidak ada dua tiket menyentuh berkas yang sama bersamaan.
6. **Verifikasi:** `docs:check` dan audit topik language setelah tiap tiket. Perbandingan penuh oleh agen independen untuk dokumen berbentuk aturan (`context/`, arsitektur, alur kerja, aturan `project-os/`), dan perbandingan sampel untuk berkas deskriptif panjang seperti `product-discovery/03-user`.
7. Teks aturan bahasa hanya hidup di `AGENTS.md` aturan 8. ADR ini tidak menyalinnya (ADR-133). Aturan 8 diubah di T-263 setelah ADR ini Accepted.

### Reason

- Melanjutkan tujuan ADR-160: satu bahasa untuk seluruh dokumen yang dibaca agen dan kolaborator baru.
- Menerjemahkan dokumen hidup lebih dulu memberi manfaat terbesar. Sejarah (ADR, tiket lama) jarang dibaca dan paling berisiko diubah.
- Mengganti kata kunci di sejarah menjaga satu kosakata untuk skrip dan skill, tanpa memaksa alat mengenali dua bahasa.

### Alternatives Considered

- Membiarkan lapisan 3 Bahasa Indonesia (ADR-160). Ditolak King Rezi (2026-11-12): mulai menerjemahkan.
- Menerjemahkan semuanya termasuk ADR dan tiket lama. Tidak dipilih: prosa sejarah tetap Bahasa Indonesia.
- Hanya `context/` lalu berhenti. Tidak dipilih: dipakai sebagai percobaan, bukan titik akhir.
- Mempertahankan kata kunci Indonesia atau membuat alat mengenali kedua bahasa. Tidak dipilih King Rezi: kata kunci diganti, termasuk di sejarah.
- Menunggu gelombang S-005 dan S-006 selesai. Tidak dipilih King Rezi: mulai sekarang, dengan risiko konflik yang dikelola seperti butir 5.

### Consequences

- Kalimat "Lapisan 3 tidak diterjemahkan" di ADR-160 berlaku untuk S-004 saja. Penunjuknya diperbarui di T-263.
- `AGENTS.md` aturan 8 berubah (T-263.3). Teks "dokumen di `project-os/`, `product-discovery/`, dan `context/` tetap Bahasa Indonesia" diganti sesuai ADR ini, dengan pengecualian sejarah (butir 2).
- `PROJECT_RULES.md` § Append-Only mendapat pengecualian kedua (butir 4).
- Skrip `docs:check` dan `docs:where` serta empat skill berubah. Kata kunci lama dan baru tidak boleh bercampur di dokumen hidup setelah tiket skrip di-merge.
- Risiko konflik merge dengan gelombang yang berjalan. Penanganannya di butir 5 dan S-007 bagian Keputusan.
- Biaya token besar untuk terjemahan dan perbandingan. Tiap gelombang terjemahan memeriksa kuota lebih dulu (`wave-plan` langkah 6).
