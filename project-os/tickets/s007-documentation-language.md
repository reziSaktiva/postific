# S-007 · Documentation language (layer 3)

> Rumah tiket spec S-007 (ADR-164). Antrian yang belum selesai ada di [`../AVAILABLE_TICKETS.md`](../AVAILABLE_TICKETS.md). Spec: [`../specs/S-007.md`](../specs/S-007.md).

Keputusan King Rezi 2026-11-12. ADR-163 Accepted pada 2026-11-12 (T-263.2). Satu berkas utuh per tiket.

### T-263 · Record the decision to translate layer 3 and amend the language rule

`✅ Done (code) (2026-11-12, ADR-163 Accepted)` · **Mode** HITL · **Verifikasi** lokal · **Domain** project-os, agen (tanpa kode produk) · **ADR** ADR-133, ADR-160, ADR-162, ADR-163 · **Spec** S-007 · **Depends** —
**Baca dulu:** `project-os/specs/S-007.md` · `project-os/decisions/ADR-163-dokumen-lapisan-3-ke-bahasa-inggris-kata-kunci-ikut-berubah.md` · `AGENTS.md` aturan 2, 8, dan 14 · `project-os/PROJECT_RULES.md` § Append-Only

Gerbang S-007. Menulis ADR keputusan, mengubah teks aturan bahasa di satu tempat, dan membuat tiket lanjutan. Tiket lanjutan S-007 (skrip dan skill, percobaan `context/`, dokumen hidup, kata kunci di sejarah, penutup) tidak dimulai sebelum gerbang ini selesai. Hanya dokumen; tidak ada kode produk.

- [x] **T-263.1** `(2026-11-12)` Draf ADR-163 ditulis, status Proposed, memuat enam jawaban King Rezi atas pertanyaan S-007 dan pengecualian Append-Only yang sempit (hanya kata kunci di sejarah).
- [x] **T-263.2** `(2026-11-12)` King Rezi menerima ADR-163 di chat. Status menjadi Accepted hanya atas jawabannya.
- [x] **T-263.3** `(2026-11-12)` `AGENTS.md` aturan 8 diubah sesuai ADR-163 (teks aturan bahasa hanya di sana, ADR-133). Kalimat "Documents in `project-os/`, `product-discovery/`, and `context/` stay Bahasa Indonesia" diganti, dengan pengecualian untuk sejarah.
- [x] **T-263.4** `(2026-11-12)` `project-os/PROJECT_RULES.md` § Append-Only mendapat pengecualian eksplisit kedua: hanya kata kunci dokumen di tiket dan ADR lama yang boleh diganti, satu kali lewat tiket sendiri.
- [x] **T-263.5** `(2026-11-12; ctx-project sudah menunjuk aturan 8, tidak diubah)` Penunjuk "lapisan 3 tidak diterjemahkan" di `project-os/specs/S-004.md` dan `context/ctx-project.md` diperbarui menunjuk ADR-163, tanpa menyalin aturan.
- [x] **T-263.6** `(2026-11-12, T-264 sampai T-277)` Tiket lanjutan S-007 dibuat dari bagian Rencana tiket spec (nomor global berikutnya) dan S-007 diperbarui menunjuk tiket itu.
- [x] **T-263.7** `bun run docs:check` bersih.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** tidak ada

### T-264 · Fix the English equivalents of the document keywords

`⏳ Todo` · **Mode** HITL · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-263
**Baca dulu:** `project-os/specs/S-007.md` · `scripts/docs/check.ts` · `.claude/skills/project-os-navigator/SKILL.md` · `.claude/skills/wave-plan/SKILL.md` · `.claude/skills/wave-work/SKILL.md` · `.claude/skills/docs-consistency-audit/SKILL.md`

Gerbang kosakata (ADR-163 butir 3 dan 4). Daftar padanan kata kunci hidup di tiket ini, satu tempat (ADR-133). `PROJECT_RULES.md` § Append-Only menunjuk tiket ini untuk daftarnya.

- [ ] **T-264.1** Inventaris kata kunci Indonesia yang dicocokkan skrip dan skill (`Berikutnya`, `spec berikutnya`, `Belum terbukti`, `Baca dulu`, `Blocked by`, legenda status, nama kolom, daftar kata henti), ditulis di tiket ini dengan lokasinya.
- [ ] **T-264.2** Usulan padanan Inggris untuk tiap kata kunci, ditulis di tiket ini.
- [ ] **T-264.3** King Rezi menyetujui daftar padanan di chat (tanggal dan jawabannya dicatat di sini).

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-263

### T-265 · Make docs:check, docs:where, and four skills use the English keywords

`⏳ Todo` · **Mode** AFK · **Verifikasi** lokal · **Domain** platform, DX, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-264
**Baca dulu:** `project-os/specs/S-007.md` · tiket T-264 (daftar padanan) · `scripts/docs/check.ts` · `scripts/docs-where.ts` · empat skill: `project-os-navigator`, `wave-plan`, `wave-work`, `docs-consistency-audit`

Selama dokumen sejarah belum diganti (T-276), skrip mengenali kata kunci Indonesia dan Inggris sekaligus. Dukungan kata kunci lama dicabut di T-276. Kata kunci lama dan baru tidak boleh bercampur di dokumen hidup setelah tiket ini di-merge.

- [ ] **T-265.1** `scripts/docs/check.ts` dan `scripts/docs-where.ts` mengenali padanan Inggris (penghitung `Next:`-setara, kata henti, pesan) dan tetap mengenali kata kunci Indonesia selama masa peralihan.
- [ ] **T-265.2** Tes skrip (bila ada) diperbarui dan `bun run docs:check` bersih pada dokumen yang belum diganti dan pada satu dokumen uji berkata kunci Inggris.
- [ ] **T-265.3** Empat skill memakai kata kunci Inggris, dengan arti gerbang tidak berubah. Perbandingan penuh oleh agen independen (dokumen berbentuk aturan, keputusan 6 S-007).
- [ ] **T-265.4** Audit topik language tidak menemukan aturan yang bertentangan antara skill, skrip, dan `AGENTS.md` aturan 8.

**Belum terbukti:** belum ada dokumen berkata kunci Inggris di sejarah (T-276); peralihan dua bahasa diuji hanya lewat dokumen uji.

**Blocked by:** T-264

### T-266 · Translate context/ (pilot)

`⏳ Todo` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-263
**Baca dulu:** `project-os/specs/S-007.md` · `context/README.md` · `context/ctx-*.md`

Percobaan cakupan C (keputusan 2 S-007): sembilan berkas, 948 baris. Dokumen berbentuk aturan, jadi perbandingan penuh oleh agen independen (keputusan 6). Menunjuk dokumen lain tidak menyalin isinya (ADR-133).

- [ ] **T-266.1** `context/README.md` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh teks UI produk (copy Bahasa Indonesia) tidak berubah.
- [ ] **T-266.2** `context/ctx-architecture.md` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh teks UI produk (copy Bahasa Indonesia) tidak berubah.
- [ ] **T-266.3** `context/ctx-business.md` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh teks UI produk (copy Bahasa Indonesia) tidak berubah.
- [ ] **T-266.4** `context/ctx-design.md` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh teks UI produk (copy Bahasa Indonesia) tidak berubah.
- [ ] **T-266.5** `context/ctx-development.md` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh teks UI produk (copy Bahasa Indonesia) tidak berubah.
- [ ] **T-266.6** `context/ctx-domain.md` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh teks UI produk (copy Bahasa Indonesia) tidak berubah.
- [ ] **T-266.7** `context/ctx-implementation.md` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh teks UI produk (copy Bahasa Indonesia) tidak berubah.
- [ ] **T-266.8** `context/ctx-project.md` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh teks UI produk (copy Bahasa Indonesia) tidak berubah.
- [ ] **T-266.9** `context/ctx-technical-context.md` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh teks UI produk (copy Bahasa Indonesia) tidak berubah.
- [ ] **T-266.10** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [ ] **T-266.11** Perbandingan penuh dengan versi Indonesia di git oleh agen independen: tidak ada gerbang atau penunjuk yang hilang, bertambah, atau tertukar.
- [ ] **T-266.12** `bun run docs:check` bersih.

**Belum terbukti:** pemilihan konteks AI per domain dengan versi Inggris belum dicoba di sesi nyata.

**Blocked by:** T-263

### T-267 · Review the context/ pilot and decide the remaining scope questions

`⏳ Todo` · **Mode** HITL · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-266
**Baca dulu:** `project-os/specs/S-007.md` · hasil T-266

Gerbang sebelum cakupan B berlanjut. Hasil percobaan dilaporkan ke King Rezi, lalu pertanyaan cakupan yang belum dijawab diputuskan.

- [ ] **T-267.1** Laporan hasil T-266 untuk King Rezi: biaya token, temuan perbandingan, hal yang diubah selama percobaan.
- [ ] **T-267.2** King Rezi memutuskan apakah cakupan B dilanjutkan, dan dengan penyesuaian apa.
- [ ] **T-267.3** King Rezi memutuskan berkas yang belum disebut keputusan 2 S-007: indeks ADR `DECISIONS.md` (ringkasan memuat isi keputusan), `BRAINSTORM.md`, `QA_TEST_ACCOUNTS.md`, dan spec yang belum selesai (S-005, S-006).
- [ ] **T-267.4** Keputusan itu dicatat di S-007 dan tiket T-268 sampai T-277 disesuaikan.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-266

### T-268 · Translate product-discovery/01-business

`⏳ Todo` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-267
**Baca dulu:** `project-os/specs/S-007.md` · `product-discovery/01-business/` · hasil percobaan T-266

Folder `product-discovery/01-business/` (8 berkas, 1.190 baris). Satu berkas utuh, tidak setengah jadi setelah tiket selesai. Contoh teks UI produk (copy Bahasa Indonesia) bagian produk dan tidak berubah. Perbandingan: sampel. Berkas yang disentuh tidak dipakai tiket lain bersamaan (keputusan 5 S-007).

- [ ] **T-268.1** Setiap berkas di `product-discovery/01-business/` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh copy produk tidak berubah.
- [ ] **T-268.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [ ] **T-268.3** Perbandingan sampel dengan versi Indonesia di git oleh agen independen, hasilnya dicatat di sini.
- [ ] **T-268.4** `bun run docs:check` bersih.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-267

### T-269 · Translate product-discovery/02-product

`⏳ Todo` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-267
**Baca dulu:** `project-os/specs/S-007.md` · `product-discovery/02-product/` · hasil percobaan T-266

Folder `product-discovery/02-product/` (8 berkas, 1.648 baris). Satu berkas utuh, tidak setengah jadi setelah tiket selesai. Contoh teks UI produk (copy Bahasa Indonesia) bagian produk dan tidak berubah. Perbandingan: sampel. Berkas yang disentuh tidak dipakai tiket lain bersamaan (keputusan 5 S-007).

- [ ] **T-269.1** Setiap berkas di `product-discovery/02-product/` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh copy produk tidak berubah.
- [ ] **T-269.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [ ] **T-269.3** Perbandingan sampel dengan versi Indonesia di git oleh agen independen, hasilnya dicatat di sini.
- [ ] **T-269.4** `bun run docs:check` bersih.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-267

### T-270 · Translate product-discovery/03-user

`⏳ Todo` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-267
**Baca dulu:** `project-os/specs/S-007.md` · `product-discovery/03-user/` · hasil percobaan T-266

Folder `product-discovery/03-user/` (10 berkas, 3.169 baris). Satu berkas utuh, tidak setengah jadi setelah tiket selesai. Contoh teks UI produk (copy Bahasa Indonesia) bagian produk dan tidak berubah. Perbandingan: sampel. Berkas yang disentuh tidak dipakai tiket lain bersamaan (keputusan 5 S-007).

- [ ] **T-270.1** Setiap berkas di `product-discovery/03-user/` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh copy produk tidak berubah.
- [ ] **T-270.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [ ] **T-270.3** Perbandingan sampel dengan versi Indonesia di git oleh agen independen, hasilnya dicatat di sini.
- [ ] **T-270.4** `bun run docs:check` bersih.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-267

### T-271 · Translate product-discovery/04-ux

`⏳ Todo` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-267
**Baca dulu:** `project-os/specs/S-007.md` · `product-discovery/04-ux/` · hasil percobaan T-266

Folder `product-discovery/04-ux/` (6 berkas, 2.819 baris). Satu berkas utuh, tidak setengah jadi setelah tiket selesai. Contoh teks UI produk (copy Bahasa Indonesia) bagian produk dan tidak berubah. Perbandingan: penuh (pola layar dan aturan UX). Berkas yang disentuh tidak dipakai tiket lain bersamaan (keputusan 5 S-007).

- [ ] **T-271.1** Setiap berkas di `product-discovery/04-ux/` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh copy produk tidak berubah.
- [ ] **T-271.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [ ] **T-271.3** Perbandingan penuh (pola layar dan aturan UX) dengan versi Indonesia di git oleh agen independen, hasilnya dicatat di sini.
- [ ] **T-271.4** `bun run docs:check` bersih.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-267

### T-272 · Translate product-discovery/05-architecture

`⏳ Todo` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-267
**Baca dulu:** `project-os/specs/S-007.md` · `product-discovery/05-architecture/` · hasil percobaan T-266

Folder `product-discovery/05-architecture/` (8 berkas, 4.323 baris). Satu berkas utuh, tidak setengah jadi setelah tiket selesai. Contoh teks UI produk (copy Bahasa Indonesia) bagian produk dan tidak berubah. Perbandingan: penuh (aturan arsitektur). Berkas yang disentuh tidak dipakai tiket lain bersamaan (keputusan 5 S-007).

- [ ] **T-272.1** Setiap berkas di `product-discovery/05-architecture/` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh copy produk tidak berubah.
- [ ] **T-272.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [ ] **T-272.3** Perbandingan penuh (aturan arsitektur) dengan versi Indonesia di git oleh agen independen, hasilnya dicatat di sini.
- [ ] **T-272.4** `bun run docs:check` bersih.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-267

### T-273 · Translate product-discovery/06-engineering

`⏳ Todo` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-267
**Baca dulu:** `project-os/specs/S-007.md` · `product-discovery/06-engineering/` · hasil percobaan T-266

Folder `product-discovery/06-engineering/` (12 berkas, 3.581 baris). Satu berkas utuh, tidak setengah jadi setelah tiket selesai. Contoh teks UI produk (copy Bahasa Indonesia) bagian produk dan tidak berubah. Perbandingan: penuh (aturan engineering). Berkas yang disentuh tidak dipakai tiket lain bersamaan (keputusan 5 S-007).

- [ ] **T-273.1** Setiap berkas di `product-discovery/06-engineering/` utuh dalam bahasa Inggris. Arti, angka, ID, tautan, dan contoh copy produk tidak berubah.
- [ ] **T-273.2** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [ ] **T-273.3** Perbandingan penuh (aturan engineering) dengan versi Indonesia di git oleh agen independen, hasilnya dicatat di sini.
- [ ] **T-273.4** `bun run docs:check` bersih.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-267

### T-274 · Translate the project-os rules and overviews

`⏳ Todo` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-267, T-265
**Baca dulu:** `project-os/specs/S-007.md` · `project-os/PROJECT_RULES.md` · `project-os/ARCHITECTURE_OVERVIEW.md` · `project-os/PROJECT_OVERVIEW.md` · `project-os/DEVELOPER_WORKFLOW.md` · `project-os/README.md`

Aturan dan ringkasan di `project-os/` tingkat atas yang jarang diedit gelombang. Berkas yang diputuskan di T-267 (`DECISIONS.md`, `BRAINSTORM.md`, `QA_TEST_ACCOUNTS.md`) ikut tiket ini hanya bila jawabannya ya. `PROJECT_STATE.md` dan `AVAILABLE_TICKETS.md` ada di T-275, bukan di sini.

- [ ] **T-274.1** Lima berkas di atas utuh dalam bahasa Inggris dan memakai kata kunci Inggris (T-264, T-265). Pengecualian Append-Only di `PROJECT_RULES.md` dipertahankan maknanya dan menunjuk T-264.
- [ ] **T-274.2** Berkas tambahan dari keputusan T-267, bila ada, diterjemahkan utuh.
- [ ] **T-274.3** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [ ] **T-274.4** Perbandingan penuh oleh agen independen (dokumen berbentuk aturan).
- [ ] **T-274.5** `bun run docs:check` bersih.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-267, T-265

### T-275 · Translate AVAILABLE_TICKETS.md and PROJECT_STATE.md

`⏳ Todo` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-265, T-274
**Baca dulu:** `project-os/specs/S-007.md` · `project-os/AVAILABLE_TICKETS.md` · `project-os/PROJECT_STATE.md`

Dua berkas yang diedit hampir tiap gelombang. Satu tiket pendek, rebase tepat sebelum merge, di-merge segera, dan tidak ada tiket gelombang lain menyentuh dua berkas ini bersamaan (keputusan 5 S-007). Kata kunci memakai padanan T-264.

- [ ] **T-275.1** `AVAILABLE_TICKETS.md` utuh dalam bahasa Inggris, termasuk legenda status dan penghitung, dan `docs:check` mengenali penghitungnya.
- [ ] **T-275.2** `PROJECT_STATE.md` utuh dalam bahasa Inggris.
- [ ] **T-275.3** Audit topik language untuk berkas ini tidak menemukan aturan yang bertentangan.
- [ ] **T-275.4** `bun run docs:check` bersih.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-265, T-274

### T-276 · Replace the document keywords in the history files

`⏳ Todo` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-265, T-275
**Baca dulu:** `project-os/specs/S-007.md` · tiket T-264 (daftar padanan) · `project-os/PROJECT_RULES.md` § Append-Only (pengecualian kedua, ADR-163)

Penggantian kata kunci satu kali di tiket, ADR, spec, dan dokumen sejarah lain (keputusan 4 S-007; sekitar 170 berkas). Hanya kata kunci dokumen yang berubah. Isi keputusan, angka, ID, tautan, dan prosa tidak boleh berubah. Dukungan kata kunci Indonesia di skrip dicabut di akhir tiket ini.

- [ ] **T-276.1** Skrip sekali jalan mengganti hanya kata kunci dari daftar T-264 di `project-os/tickets/`, `project-os/decisions/`, `project-os/specs/`, dan berkas sejarah lain yang disebut T-267.
- [ ] **T-276.2** Diff diperiksa: hanya baris kata kunci yang berubah (pembanding otomatis terhadap git: nol perubahan di luar daftar).
- [ ] **T-276.3** Dukungan kata kunci Indonesia dicabut dari `scripts/docs/check.ts`, `scripts/docs-where.ts`, dan empat skill (T-265).
- [ ] **T-276.4** `bun run docs:check` bersih dan audit topik language tidak menemukan sisa kata kunci Indonesia di dokumen hidup.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-265, T-275

### T-277 · Close S-007: language audit across layer 3

`⏳ Todo` · **Mode** AFK · **Verifikasi** lokal · **Domain** project-os, agen · **ADR** ADR-133, ADR-163 · **Spec** S-007 · **Depends** T-268, T-269, T-270, T-271, T-272, T-273, T-274, T-275, T-276
**Baca dulu:** `project-os/specs/S-007.md` · `.claude/skills/docs-consistency-audit/SKILL.md`

Penutup S-007. Audit seluruh dokumen untuk bahasa, kata kunci, dan penunjuk yang rusak.

- [ ] **T-277.1** `docs-consistency-audit` dengan topik language tidak menemukan aturan yang bertentangan antar bahasa atau antar berkas.
- [ ] **T-277.2** Tidak ada dokumen hidup yang setengah diterjemahkan dan tidak ada kata kunci Indonesia tersisa di dokumen hidup.
- [ ] **T-277.3** `bun run docs:check` bersih; S-007 dan `PROJECT_STATE.md` memuat status akhir.

**Belum terbukti:** tidak ada butir runtime.

**Blocked by:** T-268 sampai T-276
