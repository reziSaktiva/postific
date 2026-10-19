# Tiket dari Known Issue

> Rumah tiket yang lahir sebagai pelacak Known Issue, bukan sebagai kerja rilis. ADR-134. Antrian yang belum selesai tetap di [`../AVAILABLE_TICKETS.md`](../AVAILABLE_TICKETS.md).

Tiket fitur yang kebetulan memuat atau menutup satu KI tetap di file rilisnya. Contoh yang sengaja tidak dipindah: T-008 (KI-027) di `v01-foundation.md`, T-088 (KI-028) di `v10-public-launch.md`.

---

### T-119 · Isi env Google OAuth

| Field       | Value                                                                |
| ----------- | -------------------------------------------------------------------- |
| **Status**  | 🚫 Blocked                                                           |
| **Domain**  | identity                                                             |
| **Spec**    | tidak ada — muat satu sesi setelah rahasia ada                       |
| **Docs**    | KI-015, `product-discovery/06-engineering/environment-management.md` |
| **Depends** | —                                                                    |

**What to build:** "Sign in with Google" aktif karena `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` terisi di environment yang dipakai. Kode OAuth sudah ada. Yang kurang adalah nilainya.

- [ ] King Rezi mengisi kedua env var. Agent tidak mengarang nilainya
- [ ] Sign in with Google tidak lagi jatuh ke placeholder

**Blocked by:** rahasia Google OAuth dari King Rezi

### T-120 · Hapus dua workspace sisa QA

| Field       | Value                      |
| ----------- | -------------------------- |
| **Status**  | 🚫 Blocked                 |
| **Domain**  | workspace                  |
| **Spec**    | tidak ada — muat satu sesi |
| **Docs**    | KI-033, T-089              |
| **Depends** | —                          |

**What to build:** Dua workspace uji tidak lagi ada di database: "Najwa QA Test Workspace" dan "QA Queue Test".

- [ ] King Rezi mengonfirmasi kedua nama itu boleh dihapus
- [ ] Keduanya terhapus, dan tidak ada workspace lain yang ikut terhapus

**Blocked by:** konfirmasi hapus dari King Rezi

### T-121 · Putuskan meta penulis di detail History

| Field       | Value                                        |
| ----------- | -------------------------------------------- |
| **Status**  | 🚫 Blocked                                   |
| **Domain**  | publishing · UI                              |
| **Spec**    | tidak ada — muat satu sesi setelah keputusan |
| **Docs**    | KI-050, T-034                                |
| **Depends** | T-034 ✅                                     |

**What to build:** Halaman detail History menampilkan penulis post, atau keputusan tertulis bahwa penulis memang tidak ditampilkan.

- [ ] King Rezi memilih: penulis ditampilkan, atau sengaja disembunyikan
- [ ] Kalau ditampilkan, detail History menunjukkan siapa yang membuat post
- [ ] Kalau disembunyikan, tiket ini ditutup tanpa perubahan kode

**Blocked by:** keputusan King Rezi

### T-122 · Buktikan invite Copy Link tidak bisa diambil email lain

| Field       | Value                      |
| ----------- | -------------------------- |
| **Status**  | ⏳ Not Started             |
| **Domain**  | workspace                  |
| **Spec**    | tidak ada — muat satu sesi |
| **Docs**    | KI-053, T-110, ADR-080     |
| **Depends** | T-110 ✅                   |

**What to build:** Ada bukti browser bahwa invite Copy Link untuk email A tidak bisa diselesaikan oleh email B sebagai orang lain.

- [ ] Email B tidak berhasil membuat akun atas nama undangan email A
- [ ] Bukti skenario itu tercatat di tiket ini secukupnya, tanpa cerita sesi panjang

**Blocked by:** tidak ada

### T-123 · Konfirmasi lebar sidebar

| Field       | Value                                            |
| ----------- | ------------------------------------------------ |
| **Status**  | 🚫 Blocked                                       |
| **Domain**  | platform · UI                                    |
| **Spec**    | tidak ada — muat satu sesi setelah angka dikunci |
| **Docs**    | KI-089, KI-084                                   |
| **Depends** | —                                                |

**What to build:** Lebar sidebar di kode sama dengan angka yang King Rezi kunci (kode sekarang `18rem`; acuan yang disebut sebelumnya 260px).

- [ ] King Rezi memilih angkanya
- [ ] Kalau angkanya beda dari kode, sidebar mengikuti angka itu setelah gerbang desain UI

**Blocked by:** pilihan lebar dari King Rezi

### T-124 · Bug upstream Prisma `@prisma/adapter-pg` merusak koneksi pool saat job background jalan konkuren

| Field       | Value                                                              |
| ----------- | ------------------------------------------------------------------ |
| **Status**  | 🚫 Blocked                                                         |
| **Domain**  | platform · jobs                                                    |
| **Spec**    | tidak ada — menunggu rilis upstream atau keputusan workaround lain |
| **Docs**    | KI-091                                                             |
| **Depends** | — (ditemukan saat verifikasi staging T-115.5)                      |

**What to build:** belum ada implementasi — tiket ini murni pelacak bug upstream
sampai King Rezi memutuskan workaround mana yang dipakai (lihat KI-091 untuk
detail lengkap root cause dan opsi).

Ditemukan 2026-10-19 saat verifikasi end-to-end staging T-115.5 (wiring cron
Import Posts periodik). `POST /api/jobs/run?type=import` memicu error
intermiten `Invalid prisma.$queryRaw() invocation: Failed to deserialize
column of type 'void'` pada sebagian job `import.sync` — job yang sama untuk
akun yang sama kadang sukses kadang gagal pada percobaan berurutan.

Root cause: bug terbuka upstream [`prisma/orm#30374`](https://github.com/prisma/orm/issues/30374)
di `@prisma/adapter-pg@7.8.0` (versi persis yang dipakai project ini) — kalau
ada error level-Postgres ASLI (bukan `throw` JS) terjadi di dalam interactive
transaction (`prisma.$transaction`, dipakai lewat `withCurrentUser()` di
`apps/web/src/lib/prisma/with-current-user.ts`), koneksi `pg.Client` yang
dipegang jadi rusak — query BERIKUTNYA di client yang sama (bisa milik job
lain yang berbeda) menerima payload query lain, muncul sebagai error
deserialize acak. PR perbaikannya ([`prisma/orm#29979`](https://github.com/prisma/orm/pull/29979))
juga masih belum di-merge per 2026-10-19.

**Kenapa baru muncul sekarang:** `runPendingJobs` (`apps/web/src/lib/jobs/job-runner.ts`)
menjalankan seluruh job yang diklaim lewat `Promise.all` — konkuren. T-115
menambah `import.sync` (pakai `withCurrentUser` lewat `updateImportWatermark`/
`getImportWatermark`) ke campuran job yang sudah ada (`analytics.sync`,
`engagement.sync`, dst.) — menaikkan peluang lebih dari satu interactive
transaction jalan bersamaan dalam satu batch cron, yang menjadi prasyarat bug
ini muncul. Ini BUKAN bug logic T-115 — T-115 sendiri sudah diverifikasi
benar (enqueue jalan, watermark ter-update saat sukses, guard concurrent
tetap menyala).

- [x] King Rezi memilih opsi naik/turun versi Prisma (2026-10-19). Tidak ada
      rilis yang memuat perbaikan, jadi dependency tidak diubah:
  - [`prisma/orm#30374`](https://github.com/prisma/orm/issues/30374) masih
    open.
  - [`prisma/orm#29979`](https://github.com/prisma/orm/pull/29979) masih
    open, belum merge. Empat commit-nya ada di depan tag `7.10.1`, bukan di
    dalam tag itu.
  - `@prisma/adapter-pg` stabil terbaru adalah `7.10.1` (project ini
    `7.8.0`). Tidak memuat perbaikan. Paket `prisma` di tag `latest` adalah
    prarilis `8.0.0-rc.23`, tetapi `@prisma/adapter-pg` tidak punya rilis 8
    yang memuat perbaikan itu.
- [ ] Opsi yang belum dipilih:
  - Serialize `runPendingJobs` — jalankan job satu per satu (bukan
    `Promise.all`) supaya tidak ada >1 interactive transaction konkuren di
    satu `pg.Pool`. Trade-off: batch job lebih lambat (batas request Railway
    30 detik, BG-D05).
  - Terima risiko untuk sementara — retry/backoff background job (maks 4
    attempts) kemungkinan besar akhirnya berhasil karena sifat bug-nya
    intermiten, tapi akun bisa dead-letter kalau 4x berturut-turut apes.
- [ ] Setelah opsi dipilih dan diimplementasikan: retest `?type=import` di
      staging untuk akun yang sebelumnya gagal (`4a48b968-c6ef-4b97-a7a2-7c61bd68c089`,
      `eH82r`), pastikan `lastImportedUntil` ter-update sukses.

**Blocked by:** tidak ada rilis Prisma yang memperbaiki KI-091. Opsi remediasi lain belum dipilih.
