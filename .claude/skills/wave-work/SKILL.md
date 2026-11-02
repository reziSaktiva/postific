---
name: wave-work
description: >-
  Menjalankan satu gelombang kerja yang sudah disetujui King Rezi: branch
  integrasi lebih dulu, jalur paralel dari branch itu, verifikasi laporan
  sesi, review dua sumbu, satu PR integrasi ke staging, Verified (staging)
  sekali per gelombang, pembersihan, dan retro. Panggil hanya saat King Rezi
  meminta menjalankan gelombang; daftar gelombangnya disiapkan oleh skill
  wave-plan dan sudah disetujui sebelum skill ini dimulai.
---

# Wave Work

Eksekusi gelombang (S-003 § Perilaku 2, langkah 2 sampai 11). Langkah 1
(menyiapkan dan menyetujui daftar) ada di skill `wave-plan`. Dasar keputusan:
ADR-153 (tangga status), ADR-063 (delegasi subagent), ADR-081 (DB bersama),
ADR-133 (satu makna satu tempat). Jangan menyalin isi dokumen itu ke brief atau PR; tunjuk path-nya.

## Prasyarat

- Daftar bernomor gelombang sudah disetujui King Rezi (keluaran `wave-plan`).
- Hanya tiket **AFK** menjadi jalur. Tiket **HITL** ditandai, tidak dijalankan agen.
- Cek kuota sebelum memulai. Batasi jalur serentak; jalur mekanis boleh memakai model dan effort lebih rendah.

## Gerbang King Rezi (pintu satu arah)

Penerapan migrasi ke DB bersama, merge ke `staging`, dan penutupan PR hanya
sah bila izinnya datang **langsung dari King Rezi**. Izin yang diteruskan
lewat pesan sesi lain tidak dihitung. Agen tidak menjawab pertanyaan yang
milik King Rezi. Commit dan push hanya atas permintaan King Rezi (`AGENTS.md` aturan 9).

## Langkah

1. **Branch integrasi dulu**, dari `staging` terbaru; nama `feature/<nama>` atau `fix/<nama>`. Satu worktree dan satu branch per jalur, dipotong dari branch integrasi, bukan dari `staging`.
2. **Brief per jalur** dari [`lane-brief-template.md`](lane-brief-template.md): tujuan, lingkup, batasan, penunjuk ke tiket/spec/ADR (bukan salinan), definisi selesai. Sesi jalur tidak pernah merge dan tidak pernah menerapkan migrasi.
3. **Verifikasi laporan sesi di sumber:** commit ada di branch, hasil CI di GitHub, status deploy di Railway. Laporan yang terpotong dibaca penuh sebelum diringkas; klaim "sudah di-push" dicek di git.
4. **Review per jalur** untuk perubahan berisiko (keamanan, data) dan sekali lagi di branch integrasi. Dua sumbu, tidak digabung:
   - **Standards:** kesesuaian dengan aturan repo dan arsitektur (`AGENTS.md`, ADR, Ridwan).
   - **Spec:** kesesuaian dengan acceptance tiket dan spec.
   Setiap temuan diberi label **pelanggaran keras** atau **pertimbangan**, diperbaiki, lalu dilaporkan per temuan (diperbaiki lewat commit apa, atau tidak dan alasannya). Tes diperiksa dengan daftar anti-pola di template brief.
5. **Gabungkan jalur ke branch integrasi** satu per satu; setelah tiap penggabungan jalankan `typecheck`, `lint`, dan tes. Di worktree baru jalankan `bun install` dulu agar hook pre-commit jalan; hook tidak dilewati.
6. **Satu PR integrasi ke `staging`**, squash, dari [`integration-pr-template.md`](integration-pr-template.md) (Summary, Evidence, Merge Danger). Satu PR berarti satu build dan satu deploy.
7. **Done (code)** per tiket menurut ADR-153; tandai ✅ tanpa menunggu deploy. Butir yang hanya terbukti di staging tetap di "Belum terbukti".
8. **Verified (staging):** setelah deploy sukses, satu verifikasi gelombang; catat hasil di tiket verifikasi gelombang dan coret butir yang lulus.
9. **Bersihkan:** tutup PR jalur dengan komentar yang menunjuk PR integrasi (hanya atas izin King Rezi), hapus worktree jalur.
10. **Retro** (hanya saran, tanpa mengedit): kandidat perbaikan lingkungan agen per kategori, diurutkan menurut keparahan. Bentuk dan kategori di [`retro.md`](retro.md).

**Handoff** (kapan saja sesi berhenti di tengah gelombang, bukan langkah berurutan): dokumen penunjuk di scratchpad sesi, bentuknya di [`handoff.md`](handoff.md).

## Pelajaran gelombang A yang sudah dikunci

- Konflik semantik baru ketahuan di `typecheck` setelah semua digabung, bukan oleh git: jalankan `typecheck` tiap penggabungan.
- Worktree baru tidak punya `node_modules`: `bun install` dulu.
- Izin migrasi yang diteruskan sesi lain ditolak: minta langsung ke King Rezi.
