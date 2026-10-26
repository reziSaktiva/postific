## Decision ADR-131

### Title

Antrian kerja pindah ke `AVAILABLE_TICKETS.md`, `COMPLETE_TASK.md` dihapus, deskripsi task memakai empat lapis docs → spec → tiket → implement (amandemen ADR-061, ADR-062, ADR-067)

### Status

Accepted — Amended by ADR-132 (2026-10-16), ADR-134 (2026-10-19)

### Date

2026-10-16

### Decision

King Rezi mengubah cara Project OS menyimpan kerja:

1. `project-os/TASKS.md` diganti nama menjadi `project-os/AVAILABLE_TICKETS.md`. Isinya hanya task yang belum selesai (⏳, 🟡, 🚫) plus keputusan yang masih menunggu. Task ✅ dan ⏸️ tidak masuk file ini.
2. `project-os/COMPLETE_TASK.md` dihapus dari pohon kerja. Tidak ada pengganti berupa arsip markdown. Jejak sesi adalah commit git. Tiket yang sudah selesai tetap bisa dibaca di `project-os/tickets/vXX-*.md`.
3. Deskripsi sebuah pekerjaan tidak lagi ditulis sebagai catatan implementasi di dalam tiket. Empat lapisnya:

| Lapis     | Rumah                                          | Isi                                                        | Kapan                                              |
| --------- | ---------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| Docs      | `product-discovery/`, `context/`, `decisions/` | Bahasa domain, baseline, ADR yang sudah ada                | Sebelum spec. Jangan disalin ulang ke tiket        |
| Spec      | `project-os/specs/S-NNN.md`                    | Perilaku yang disepakati, jahitan tes, modul yang disentuh | Hanya jika pekerjaan melewati lebih dari satu sesi |
| Tiket     | `tickets/vXX-*.md`                             | What to build, acceptance, blocked by, tautan spec         | Selalu. Tetap di file ini setelah ✅               |
| Implement | kode dan tes                                   | Perubahan yang menutup tiket                               | Saat membangun. Tidak menambah novel ke tiket      |

Pekerjaan yang muat satu sesi tidak punya spec. Tiketnya langsung menunjuk docs yang berlaku.

Mencari task yang tersedia berhenti di `AVAILABLE_TICKETS.md`. File `tickets/vXX-*.md` dibuka setelah ID-nya dipilih, dan hanya section tiket itu.

Known Issue `Resolved` dikeluarkan dari `PROJECT_STATE.md` begitu tiket atau commit yang menutupnya ada. Catatan di `COMPLETE_TASK.md` tidak lagi menjadi syarat.

ADR-061, ADR-062, dan ADR-067 tetap berlaku untuk bagian yang tidak disebut di sini. Sebutan `TASKS.md` dan `COMPLETE_TASK.md` di badan ADR lama adalah sejarah, bukan instruksi yang masih hidup.

### Reason

- File rilis (terutama v0.2, 217 KB) ikut terbuka saat agent mencari task tersedia, karena indeks dan novel tiket ada dalam jalur baca yang sama.
- `COMPLETE_TASK.md` mencapai 1 MB. Larangan "jangan dibaca" tidak membuatnya berguna untuk manusia, dan satu pencarian di folder tetap bisa menyeret isinya.
- Git sudah menyimpan riwayat sesi. Menulis ulang riwayat itu ke markdown membuat tiga salinan satu pekerjaan.
- Memisahkan spec (tahan lama) dari tiket (pendek, tetap terlihat setelah selesai) mengikuti alur docs → spec → tiket → implement, tanpa membuat pelacak isu kedua di luar `tickets/`.

### Alternatives Considered

- Menyusutkan task selesai jadi satu baris dan memindahkan cerita ke git saja — ditolak King Rezi. Task selesai harus tetap terbaca di `tickets/vXX-*.md`.
- Memecah satu file per tiket — ditolak untuk saat ini. Pandangan per rilis tetap di `tickets/vXX-*.md`.
- Mengarsipkan `COMPLETE_TASK.md` ke folder lain dan tetap melarang agent membacanya — ditolak. King Rezi minta file itu dihapus total dari pohon kerja.
