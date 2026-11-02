# Retro gelombang

Langkah terakhir `wave-work` (S-003 § Perilaku 2 poin 11). **Hanya saran:**
retro tidak mengedit aturan, skill, skrip, atau tiket. King Rezi memutuskan
mana yang dikerjakan, lalu menjadi tiket sendiri (ADR-132, ADR-133).

## Cara menyusun

1. Kumpulkan kejadian gelombang yang memakan waktu atau token, atau hampir salah: laporan sesi, hasil `typecheck`/CI, penolakan izin, pembacaan berulang.
2. Masukkan tiap kejadian ke satu kategori di bawah, tulis sebagai saran (apa yang diubah, di berkas mana, bukti kejadiannya).
3. **Urutkan menurut keparahan** dalam satu daftar: yang bisa memunculkan hasil salah atau tindakan tak sah lebih dulu, lalu yang membuang waktu atau token, lalu kenyamanan.
4. Saran yang sudah punya rumah (aturan atau skill yang ada) cukup menunjuk rumahnya; jangan menyalin isinya.

## Kategori

| Kategori                     | Pertanyaan pemandu                                                          |
| ---------------------------- | --------------------------------------------------------------------------- |
| Navigasi                     | Dokumen atau bagian mana yang dicari berulang atau salah dibaca?            |
| Pengecekan otomatis          | Kesalahan apa yang baru ketahuan terlambat dan bisa ditangkap skrip/hook?   |
| Ekonomi tool                 | Pembacaan, panggilan, atau model apa yang lebih mahal dari yang diperlukan? |
| Instruksi yang tidak berpengaruh | Instruksi mana yang dibaca tetapi tidak mengubah perilaku, atau bertabrakan? |
| Akses informasi              | Informasi apa yang tidak terjangkau agen (izin, jaringan, MCP) saat perlu?  |

## Format keluaran

```markdown
# Retro <nama gelombang> · <tanggal>

1. [<kategori>] <saran> · Bukti: <kejadian, path atau URL> · Keparahan: tinggi | sedang | rendah
2. ...
```

## Isi awal: pelajaran gelombang A

Sudah dikunci di `SKILL.md` § Pelajaran gelombang A; berikut bentuk sarannya
bila ingin dibawa ke gelombang berikutnya.

1. [Pengecekan otomatis] `typecheck` menangkap konflik semantik yang lolos dari git setelah jalur digabung. Saran: jalankan `typecheck` setelah tiap penggabungan, bukan hanya di akhir. Keparahan: tinggi.
2. [Akses informasi] Izin migrasi yang diteruskan lewat sesi lain ditolak. Saran: minta izin langsung ke King Rezi sebelum jalur mencapai langkah itu. Keparahan: tinggi.
3. [Navigasi] Laporan sesi terpotong lalu diringkas apa adanya. Saran: baca laporan penuh dan cek commit, CI, dan deploy di sumber sebelum meringkas (`SKILL.md` langkah 3). Keparahan: sedang.
4. [Pengecekan otomatis] Worktree baru tanpa `node_modules` membuat hook pre-commit tidak jalan. Saran: `bun install` dulu di tiap worktree; pertimbangkan pengingat di template brief. Keparahan: sedang.
5. [Ekonomi tool] Satu build dan satu deploy per gelombang menghemat Railway dan verifikasi. Saran: pertahankan satu PR integrasi dan satu Verified (staging) per gelombang. Keparahan: rendah.
