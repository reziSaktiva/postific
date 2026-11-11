## Decision ADR-160

### Title

Bahasa orkestrasi: lapisan 1 dan 2 pindah ke bahasa Inggris (S-004, T-234)

### Status

**Proposed** (menunggu penerimaan King Rezi, T-234.6). Belum Accepted.

### Date

2026-11-11

### Decision

Tujuan keputusan ini: keselarasan dengan skill yang sudah berbahasa Inggris, dan kolaborator baru yang bekerja dalam bahasa Inggris (S-004).

Cakupan: lapisan 1 (percakapan dan laporan kerja) dan lapisan 2 (aturan serta skill orkestrasi), bertahap, satu berkas utuh per tiket. Lapisan 3 (`project-os/`, `product-discovery/`, `context/`) tidak diterjemahkan. Delapan berkas `.claude/agents/` tidak diubah di tiket ini.

Sebutan King Rezi tetap. **5 Magic Words** ikut bahasa dokumen. Padanannya: please, sorry, thank you, excuse me, go ahead.

Teks aturan bahasa hanya hidup di `AGENTS.md` aturan 8. ADR ini tidak menyalin teks aturan itu (ADR-133).

### Reason

- Sejak 2026-10-30 nama skill, folder, berkas, variabel, identifier, dan judul tiket memakai bahasa Inggris, sementara aturan 8 masih menetapkan Bahasa Indonesia. Project sudah berjalan sebagai campuran.
- Skill vendor dan pola S-003 sudah berbahasa Inggris. Aturan percakapan yang tetap Bahasa Indonesia membuat agen baru membaca dua bahasa untuk satu gerbang.

### Alternatives Considered

- Menjaga Bahasa Indonesia untuk lapisan 1 dan 2. Ditolak. Keputusan King Rezi 2026-11-11 memilih bahasa Inggris untuk lapisan itu.
- Menerjemahkan lapisan 3 sekaligus. Ditolak. Di luar S-004.
- Mengubah delapan berkas `.claude/agents/` di tiket yang sama. Ditolak. Berkas itu Static Reference. Salinan aturan di sana dicatat sebagai utang di T-234.5 dan tidak diubah di sini.

### Consequences

- Sebelum status ADR ini Accepted, aturan 8 yang lama tetap yang dipakai percakapan. Setelah Accepted, aturan 8 yang baru di `AGENTS.md` dipakai, termasuk saat skill lain belum diterjemahkan.
- Tiket AFK S-004 (T-235 sampai T-245) tidak dimulai sebelum Accepted.
- Satu kalimat di `context/ctx-project.md` menjadi penunjuk ke aturan 8. Sisa berkas itu tetap Bahasa Indonesia.
