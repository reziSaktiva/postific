## Decision ADR-107

### Title

Batas Maksimum Jumlah Media per `ContentFormat` (Carousel) — Amandemen ADR-039

### Status

Accepted — Amends ADR-039 — Amended by ADR-121 (2026-09-26)

### Date

2026-09-14

### Decision

T-024.4 (aktifkan kontrol lampiran media di Draft Editor + preview)
memperkenalkan kemampuan attach **lebih dari satu** file media ke satu post
(carousel) — sebelumnya matriks ADR-039 hanya mengatur `ContentFormat` mana
yang boleh dipilih per platform, tanpa pernah mengatur **jumlah** media yang
boleh dilampirkan per format. King Rezi mengonfirmasi aturan berikut di sesi
ini:

1. **Batas maksimum media per `ContentFormat`** (mengikuti batas native
   platform IG/FB — pengetahuan umum platform, bukan hasil riset khusus,
   didokumentasikan di sini sebagai keputusan produk resmi):

   | `ContentFormat` | Maks media | Alasan                                    |
   | ---------------- | ---------- | ------------------------------------------ |
   | `Post`            | 10         | Carousel Instagram/Facebook maks 10 media   |
   | `Reel`            | 1          | Reel selalu single video                    |
   | `Story`           | 1          | Story selalu single media                   |
   | `Pin`             | 1          | Pinterest Pin selalu single media/video      |

2. **Media bersifat SATU set untuk seluruh post, bukan per-target.**
   `PublishingPost.mediaIds` (kolom `media_ids`, sudah ada di schema sejak
   awal tapi belum pernah tersentuh kode manapun sebelum T-024.4) hidup di
   level `PublishingPost`, bukan `PublishingPostTarget` — karena itu Post
   yang sama bisa di-attach ke **beberapa akun target dengan `ContentFormat`
   berbeda sekaligus** (mis. target IG dengan format `Reel` + target FB
   dengan format `Story` dalam satu post yang sama). Batas efektif untuk
   seluruh post dalam kasus itu adalah **MINIMUM** dari batas semua format
   yang sedang dipilih di antara akun target aktif — bukan maksimum, dan
   bukan rata-rata — supaya tidak ada satu target pun yang menerima jumlah
   media melebihi batas native platformnya.

3. **Default saat belum ada akun dipilih sama sekali: paling longgar (10,
   sama dengan `Post`)** — supaya user bisa mulai upload media sebelum
   memutuskan akun tujuan, konsisten dengan alur Draft Editor yang tidak
   mewajibkan akun dipilih lebih dulu sebelum menulis caption/attach media.

4. **Ditegakkan di DUA tempat yang WAJIB dijaga sinkron** (pola sama
   matriks `ContentFormat` per platform ADR-039):
   - Server: `MAX_MEDIA_COUNT_BY_FORMAT` + `maxMediaCountForFormats`/
     `assertMediaCountWithinLimit` di
     `apps/web/src/domains/publishing/content-format-matrix.ts`. Ditegakkan
     di `saveDraftAction`/`updateDraftAction`/`scheduleDraftAction`/
     `publishNowAction` (`apps/web/src/app/(app)/components/draft-editor/actions.ts`)
     — dipanggil TERHADAP `ContentFormat` target yang sudah divalidasi
     (`resolveScheduleTargets` untuk schedule/publish; `activeFormats`
     yang dikirim client untuk save/update draft biasa), bukan dari input
     mentah yang belum tervalidasi.
   - Client (mirror): `MAX_MEDIA_COUNT_BY_FORMAT`/`maxMediaCountFor` di
     `apps/web/src/app/(app)/components/draft-editor/Modal.tsx` — dipakai
     untuk disable dropzone dan menampilkan pesan begitu batas efektif
     tercapai, sebelum request upload dikirim ke server sama sekali.

### Reason

* Batas ini adalah batas **fisik platform** (Outstand/Meta/Pinterest API
  akan menolak carousel >10 atau Reel/Story/Pin dengan >1 media) — menolak
  di level aplikasi lebih awal (saat attach, bukan saat publish gagal di
  Outstand) memberi umpan balik yang jauh lebih cepat dan jelas ke user.
* Karena `mediaIds` bersifat post-level (bukan per-target), constraint
  "MINIMUM dari semua format yang dipilih" adalah satu-satunya pilihan yang
  aman — kalau dipakai MAKSIMUM atau rata-rata, kombinasi (mis. IG Reel +
  FB Story) bisa membawa media count yang valid untuk salah satu target
  tapi melebihi batas native target yang lain, menyebabkan publish gagal
  parsial di production.
* Pola "server + client mirror, WAJIB sinkron" sudah dipakai dan terbukti
  untuk matriks `ContentFormat` per platform (ADR-039) — mengikuti pola
  yang sama untuk batas jumlah media, bukan menciptakan mekanisme baru.

### Alternatives Considered

* **Batas seragam untuk semua format** (mis. selalu 10, atau selalu 1).
  Ditolak — tidak mencerminkan batas native platform yang sesungguhnya
  berbeda per format (Reel/Story/Pin native single-media, Post/carousel
  native multi-media), akan menyebabkan publish gagal di Outstand untuk
  format single-media kalau user attach >1 media.
* **Batas per-target (bukan MINIMUM gabungan)** — validasi jumlah media
  hanya terhadap SATU target yang dipilih (mis. target pertama). Ditolak —
  `mediaIds` bukan per-target, jadi validasi sepihak seperti ini bisa lolos
  kasus dua target berbeda format yang salah satu bakal menerima media
  melebihi batasnya sendiri saat publish.
* **Tidak mengunci default saat belum ada akun dipilih** (mis. larang
  upload media sama sekali sebelum akun dipilih). Ditolak oleh King Rezi —
  memaksa urutan pengisian form yang tidak perlu; default paling longgar
  (10) cukup aman karena validasi ulang tetap terjadi begitu akun/format
  benar-benar dipilih (baik di client saat toggle akun, maupun di server
  saat save/schedule/publish).

### References

* ADR-039 — matriks `ContentFormat` per platform (diamandemen ADR ini,
  menambah dimensi baru: jumlah media, bukan mengubah format apa yang
  diizinkan).
* `project-manager/tasks/v02-publishing-mvp.md` § T-024 (T-024.4).
* `apps/web/src/domains/publishing/content-format-matrix.ts` —
  `MAX_MEDIA_COUNT_BY_FORMAT`, `maxMediaCountForFormat`,
  `maxMediaCountForFormats`, `assertMediaCountWithinLimit`.
* `apps/web/src/app/(app)/components/draft-editor/Modal.tsx` — mirror
  client `MAX_MEDIA_COUNT_BY_FORMAT`/`maxMediaCountFor`.
* `apps/web/prisma/schema.prisma` — `PublishingPost.mediaIds` (kolom
  `media_ids`, `String[] @default([]) @db.Uuid`, sudah ada sejak awal,
  baru diaktifkan T-024.4).
