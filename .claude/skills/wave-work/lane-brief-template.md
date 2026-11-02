# Lane brief

Satu brief per jalur. Isi dengan penunjuk (path atau URL), bukan salinan dokumen (ADR-133).

## Tujuan

Satu kalimat: hasil yang harus ada saat jalur selesai.

## Lingkup

- Tiket: `T-xxx` (`project-os/tickets/...`), butir yang dikerjakan.
- Spec dan ADR yang berlaku: `specs/S-NNN.md`, `ADR-xxx`.
- Berkas yang boleh diubah, dan berkas yang tidak boleh disentuh jalur lain.

## Batasan

- Branch dan worktree jalur dipotong dari branch integrasi `<nama>`.
- Jangan merge. Jangan menerapkan migrasi. Jangan commit atau push kecuali diminta King Rezi.
- Pertanyaan yang milik King Rezi dikembalikan, tidak dijawab sendiri.
- Di worktree baru jalankan `bun install` dulu; hook pre-commit tidak dilewati.

## Definisi selesai

- [ ] Acceptance tiket terpenuhi (sumbu Spec).
- [ ] Sesuai aturan repo dan arsitektur (sumbu Standards).
- [ ] `typecheck`, `lint`, dan tes hijau; E2E golden path bila tiket mengubah perilaku produk (ADR-149).
- [ ] Bagian "Belum terbukti" di tiket diperbarui dengan jujur.

## Daftar periksa tes (anti-pola)

Tolak tes yang:

- **Terikat implementasi:** gagal saat refactor tanpa perubahan perilaku (mengintip fungsi privat, urutan panggilan, atau struktur internal).
- **Tautologis:** membuktikan sesuatu yang selalu benar (menegaskan nilai yang baru saja diatur, atau mock yang mengembalikan jawabannya sendiri).

Tes yang baik menembus batas publik (use case, repository, route) dan gagal bila perilaku berubah.

## Laporan jalur

Tulis hasil sebagai penunjuk: commit, tes yang dijalankan, temuan terbuka. Jangan melaporkan "sudah di-push" tanpa nama commit.
