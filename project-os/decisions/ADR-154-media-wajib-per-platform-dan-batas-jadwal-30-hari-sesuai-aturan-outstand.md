## Decision ADR-154

### Title

Media Wajib per Platform dan Batas Jadwal 30 Hari, Mengikuti Aturan Outstand — Amandemen ADR-121 (KI-107, KI-105)

### Status

**Accepted — Amended by ADR-155 (2026-11-03)** (aturan Reel wajib video, addendum ADR-155 B.1) (keputusan King Rezi, 2026-11-03). Kode menunggu rancangan baru dikonfirmasi King Rezi di galeri Postific Design Review (`AGENTS.md` aturan 10).

### Date

2026-11-03

### Context

King Rezi menemukan dua bug saat menjadwalkan post di staging:

1. Instagram bisa dijadwalkan atau dipublish tanpa gambar. ADR-121 menetapkan batas minimum media **per `ContentFormat`**: `Post` bernilai 0 untuk semua platform. Itu benar untuk Facebook, tetapi Instagram tidak punya mode teks saja.
2. Penjadwalan gagal HTTP 400 dari Outstand (T-195, KI-105). Dokumen Outstand "Create a post" menyebut `scheduledAt` maksimal **30 hari** ke depan; lebih dari itu Outstand mengembalikan 400 dan tidak membuat post. Jadwal ketiga post yang gagal jatuh 1 sampai 3 bulan ke depan. Ini penyebab paling mungkin, belum terbukti karena body galat 400 belum pernah terbaca (T-195.1 belum ter-deploy).

Sumber aturan platform: dokumen Outstand per jaringan (`outstand.so/docs/configurations/<jaringan>`) dan `outstand.so/docs/create-a-post`. Untuk Instagram, dokumen Meta Content Publishing juga hanya menyediakan jalur publish dengan `image_url`, `video_url`, atau anak carousel.

### Decision

**1. Media wajib ditentukan per pasangan platform + format, bukan per format saja.** Minimum 1 media berlaku untuk:

| Platform  | Format yang wajib media | Dasar                                                                                             |
| --------- | ----------------------- | ------------------------------------------------------------------------------------------------- |
| Instagram | Post, Reel, Story       | Semua format Instagram di dokumen Outstand berisi media; Story: "Exactly one image or video"      |
| Facebook  | Reel, Story             | Reel "Requires one video"; Story "Requires one image or video". Facebook Post tetap boleh 0 media |
| Pinterest | Pin                     | "At least one image or video is required"                                                         |
| TikTok    | Post                    | Keputusan King Rezi: wajib. Dokumen hanya memuat spesifikasi video dan foto, tidak eksplisit      |
| YouTube   | Post                    | Keputusan King Rezi: wajib. Dokumen hanya memuat video, gambar hanya thumbnail                    |

LinkedIn, Threads, dan Twitter/X tetap boleh teks saja (dokumen tidak mensyaratkan media). Batas efektif untuk beberapa target dalam satu post tetap **MAKSIMUM** antar minimum target (ADR-121 poin 2). Batas maksimum (ADR-107) tidak berubah.

**2. Batas jadwal: `scheduledAt` paling jauh 30 hari dari sekarang.** Lebih dari itu ditolak di Postific sebelum memanggil Outstand. Berlaku untuk semua jalur penjadwalan yang ada (Draft Editor dan tool MCP `schedule_posts`; belum ada fitur reschedule). Pesan di server menyebut batas dalam UTC; Modal memakai zona pengguna. Deskripsi tool MCP menyebut kedua aturan ini; batas wajar 2 tahun di parser `scheduledAt` MCP dibiarkan sebagai pagar terpisah. Jadwal di masa lalu tetap ditolak (T-108).

**3. Ditegakkan di dua tempat yang wajib sinkron** (pola ADR-107, ADR-121): server (`content-format-matrix.ts` dan `schedule-time-constraints.ts`, dipanggil dari `scheduleDraftAction`/`publishNowAction` dan jalur MCP) dan client (`Modal.tsx`: Alert inline, tombol Publish Now/Schedule disabled, dan atribut `max` pada input tanggal bawaan browser sehingga hari di luar 30 hari tidak bisa dipilih di picker). Draft tetap boleh disimpan tanpa media dan dengan jadwal jauh (ADR-121 poin 3).

### Reason

Aturan platform adalah batas fisik; menolak lebih awal memberi umpan balik jelas alih-alih galat 400 dari Outstand atau post kosong. Meniru aturan Outstand adalah permintaan King Rezi (2026-11-03).

### Alternatives Considered

- **Menaikkan minimum `Post` menjadi 1 untuk semua platform.** Ditolak: Facebook, LinkedIn, Threads, dan X sah teks saja.
- **Hanya Instagram yang diwajibkan media.** Ditolak oleh King Rezi; TikTok dan YouTube ikut diwajibkan walau dokumen Outstand tidak eksplisit.
- **Menunggu pesan 400 dari T-195.1 sebelum memasang batas 30 hari.** Ditolak: batas 30 hari tertulis eksplisit di dokumen Outstand, dan validasi lebih awal tidak merugikan.

### Consequences

- Minimum media tidak lagi `Record<ContentFormat, ...>` saja; fungsi agregat menerima target `{platform, format}`. Pemanggil di `Modal.tsx`, action, dan MCP harus diubah bersama.
- Pemeriksaan hanya jumlah media. Jenis media (YouTube harus video, Vimeo video) belum ditegakkan; dicatat di T-197 sebagai batasan.
- Post `Scheduled` lama yang jadwalnya lebih dari 30 hari ke depan tidak dimigrasi di ADR ini; lihat T-198.

### References

- ADR-039, ADR-107, ADR-121 (diamandemen), ADR-132, ADR-149.
- KI-107 (T-197), KI-105 (T-195, T-198).
- Outstand: `outstand.so/docs/create-a-post` (batas `scheduledAt` 30 hari), `outstand.so/docs/configurations/instagram`, `.../pinterest`, `.../facebook`, `.../tiktok`, `.../youtube`.
