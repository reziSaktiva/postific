## Decision ADR-162

### Title

Delapan berkas `.claude/agents/` ikut bahasa Inggris sebagai bagian lapisan 2 (mengamandemen ADR-160)

### Status

**Accepted** (disetujui King Rezi di chat, 2026-11-12, T-254.2). Dua usulan bawaan di keputusan butir 4 ikut diterima. Tiket T-255 sampai T-262 boleh dimulai.

### Date

2026-11-12

### Context

ADR-160 memindahkan lapisan 1 (percakapan dan laporan kerja) dan lapisan 2 (aturan dan skill orkestrasi) ke bahasa Inggris. Delapan berkas `.claude/agents/` (README dan tujuh berkas peran) sengaja tidak ikut: berkas itu Static Reference dan hanya berubah atas permintaan eksplisit King Rezi (`AGENTS.md`). ADR-160 menolak mengubahnya di T-234 dan mencatat salinan aturan di sana sebagai utang.

Utang itu sudah lunas di T-246.3 (2026-11-11): tujuh berkas peran menunjuk `AGENTS.md` aturan 1 dan 8 alih-alih menyalin kalimatnya. Yang tersisa hanya prosa berkas agen yang masih Bahasa Indonesia, sementara `AGENTS.md` dan semua skill orkestrasi sudah berbahasa Inggris. Agen yang membaca satu gerbang kini harus membaca dua bahasa.

King Rezi meminta tiket untuk menerjemahkan berkas itu (2026-11-12) dan memutuskan bahwa `description` di frontmatter ikut diterjemahkan (T-254.3a).

### Decision

1. Delapan berkas `.claude/agents/` (`README.md` dan tujuh berkas peran) ikut lapisan 2 dan diterjemahkan ke bahasa Inggris, satu berkas utuh per tiket (T-255 sampai T-262).
2. Aturan Static Reference tidak berubah: berkas agen hanya berubah atas permintaan eksplisit King Rezi. ADR ini mencatat permintaan itu untuk terjemahan saja.
3. `name` di frontmatter dan nama berkas tidak berubah. `description` ikut diterjemahkan, dengan kata kunci pemicu pemilihan subagen tetap terbaca di versi Inggris.
4. Usulan bawaan untuk dua butir T-254.3 yang belum dijawab King Rezi: tautan artifact, ID dan judul tiket, serta penunjuk ke `AGENTS.md` tidak berubah (T-254.3c); kata kunci seperti "Done by" mengikuti pilihan T-246.3 (T-254.3b).
5. Lapisan 3 (`project-os/`, `product-discovery/`, `context/`) tetap tidak diterjemahkan. Keputusan itu di ADR-160 dan tidak diubah di sini.
6. Teks aturan bahasa tetap hanya hidup di `AGENTS.md` aturan 8. ADR ini tidak menyalinnya (ADR-133).

### Reason

- Keselarasan: satu bahasa untuk seluruh instruksi orkestrasi, sesuai tujuan ADR-160.
- Utang salinan aturan sudah lunas (T-246.3), jadi menerjemahkan prosa tidak menambah risiko aturan ganda.
- Satu berkas utuh per tiket menjaga aturan "tidak setengah diterjemahkan" dari S-004.

### Alternatives Considered

- Membiarkan berkas agen berbahasa Indonesia. Ditolak King Rezi (2026-11-12, meminta tiket terjemahan).
- Menerjemahkan isi berkas tetapi membiarkan `description` Indonesia. Ditolak King Rezi (2026-11-12): `description` ikut.
- Menerjemahkan lapisan 3 sekaligus. Di luar ADR ini; butuh spec dan ADR sendiri.

### Consequences

- Kalimat "Delapan berkas `.claude/agents/` tidak diubah di tiket ini" di ADR-160 berlaku untuk T-234 saja. Pembaruan penunjuknya ada di T-254.4.
- Pemilihan subagen oleh agen bergantung pada `description`. Sesi uji tiap berkas (butir .3) memeriksa bahwa subagen yang sama tetap terpilih untuk tugas yang sama.
- Berkas agen di branch lain yang masih berbahasa Indonesia bisa konflik saat merge. T-255 sampai T-262 dikerjakan setelah ADR ini Accepted dan tidak paralel dengan perubahan lain pada berkas yang sama.
