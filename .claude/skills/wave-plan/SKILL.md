---
name: wave-plan
description: >-
  Menyiapkan gelombang kerja dari graf tiket: menghitung frontier (tiket tanpa
  blocker) dari field Depends, memisahkan tiket AFK dan HITL, memeriksa bentrok
  berkas, lalu berhenti di daftar bernomor untuk disetujui King Rezi. Hanya
  membaca dokumen; aman dan murah dipanggil kapan saja, termasuk untuk sekadar
  melihat gelombang yang tersedia. Eksekusinya memakai skill wave-work.
---

# Wave Plan

Langkah 1 alur gelombang (S-003 § Perilaku 2). Spec adalah unit perencanaan;
gelombang adalah frontier saat itu dan boleh lintas spec. Dasar: ADR-153, ADR-132.

## Batas

- **Hanya membaca dokumen.** Tidak membuat branch, worktree, commit, atau mengubah berkas.
- Berhenti di daftar bernomor yang disetujui King Rezi. Eksekusi dimulai oleh skill `wave-work`, hanya atas permintaan King Rezi.

## Langkah

1. **Kumpulkan kandidat:** buka `project-os/AVAILABLE_TICKETS.md` dan berhenti di situ untuk memilih ID. Baca bagian tiket dengan `offset` dan `limit` (atau `bun run docs:where` bila sudah tersedia, T-186), bukan seluruh berkas tiket.
2. **Hitung frontier:** field **Depends** dibaca sebagai blocking edge. Tiket tanpa blocker, atau yang blocker-nya sudah ✅ (atau Accepted untuk ADR), masuk frontier. Boleh lintas spec. Tiket 🚫 dan yang blocker-nya belum selesai ditandai dan tidak masuk jalur.
3. **Pisahkan AFK dan HITL** dari field **Mode** di tiket (bentuknya di `project-os/specs/README.md`). Tiket tanpa penanda diklasifikasi dari isinya: ada butir keputusan, izin migrasi, atau verifikasi manual King Rezi berarti HITL. Hanya tiket AFK yang boleh menjadi jalur; HITL ditandai dan tidak dijalankan agen.
4. **Periksa bentrok berkas** antar tiket AFK dari bagian "Baca dulu" dan butir tiket. Jalur paralel hanya untuk tiket yang tidak menyentuh berkas yang sama dan tidak saling bergantung; selain itu urutkan sekuensial dalam satu jalur.
5. **Irisan vertikal:** satu jalur menghasilkan hasil yang bisa dilihat dan dites, bukan lapisan teknis. Perubahan lebar memakai expand, migrate, contract.
6. **Ekonomi token:** batasi jalur serentak, tandai jalur mekanis yang boleh memakai model dan effort lebih rendah, dan cek kuota sebelum gelombang dimulai.

## Keluaran

Daftar bernomor untuk King Rezi, tiap baris memuat:

| Kolom | Isi |
| --- | --- |
| Judul | ID dan judul tiket |
| Blocker | tiket atau keputusan yang menahan, atau tidak ada |
| Hasil | apa yang ada saat selesai |
| Mode | AFK atau HITL |
| Jalur | jalur yang diusulkan; tiket HITL tidak dapat jalur |

Sertakan juga: urutan gerbang King Rezi (persetujuan ADR, izin migrasi, merge), pertanyaan granularitas yang perlu dijawab, dan perkiraan jumlah jalur serentak. Lalu **berhenti** dan tunggu persetujuan King Rezi.
