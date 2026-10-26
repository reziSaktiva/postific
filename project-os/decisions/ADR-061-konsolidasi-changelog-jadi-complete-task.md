## Decision ADR-061

### Title

Konsolidasi CHANGELOG jadi COMPLETE_TASK.md tunggal + larangan baca proaktif (Amandemen ADR-060)

### Status

Accepted — Amended by ADR-131 (2026-10-16)

### Date

2026-08-03

### Decision

Membatalkan sebagian pendekatan rotasi CHANGELOG di ADR-060 (yang memecah `CHANGELOG.md` jadi root file M8+ dan arsip `changelog/CHANGELOG-pre-M8.md`). Sebagai gantinya:

- `CHANGELOG.md` (root) + `project-os/changelog/CHANGELOG-pre-M8.md` digabung kembali jadi **satu file tunggal**: `project-os/COMPLETE_TASK.md`, urutan reverse-chronological seperti semula (M8+ di atas, pra-M8 di bawah), tanpa kehilangan isi.
- File `changelog/CHANGELOG-pre-M8.md` dan folder `changelog/` dihapus.
- `COMPLETE_TASK.md` diberi peringatan keras di kepala file: **AI dilarang membaca isi lengkapnya secara proaktif**, hanya boleh dibaca saat King Rezi memerintahkan eksplisit. Menambahkan entri baru di bagian atas setelah sesi kerja tetap wajib (operasi tulis, bukan baca) — tidak memerlukan membaca entri lama.
- Guardrail ukuran khusus `CHANGELOG.md` dari ADR-060 (rotasi per milestone) dicabut untuk file ini — `COMPLETE_TASK.md` sengaja dibiarkan tumbuh tanpa rotasi karena memang tidak pernah dibaca penuh oleh AI secara rutin.
- Seluruh referensi `CHANGELOG.md`/`changelog/` di `PROJECT_RULES.md`, `README.md`, `SKILL.md`, `AGENTS.md`, `DEVELOPER_WORKFLOW.md`, `PROJECT_STATE.md` diperbarui ke `COMPLETE_TASK.md`.

### Reason

- King Rezi menilai dua file (`CHANGELOG.md` + arsip) tidak perlu — cukup satu file riwayat lengkap, asal AI memang tidak membacanya kecuali diminta.
- Larangan baca eksplisit lebih efektif daripada rotasi ukuran untuk file yang isinya murni historis dan tidak pernah jadi bagian alur kerja rutin (append-only, tulis-tanpa-baca).
- Mengurangi jumlah file yang perlu dikelola/diingat strukturnya, tanpa mengorbankan efisiensi token — karena akar masalahnya (AI membaca ribuan baris historis) sudah ditangani lewat larangan baca, bukan lewat ukuran file.

### Alternatives Considered

- Tetap mempertahankan rotasi 2-file dari ADR-060 — ditolak, King Rezi eksplisit meminta satu file saja.
- Menghapus riwayat lama sepenuhnya — tidak dipertimbangkan; riwayat tetap harus utuh untuk audit/referensi historis, hanya cara aksesnya yang dibatasi.
