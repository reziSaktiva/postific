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
| **Status**  | ✅ Done                    |
| **Domain**  | workspace                  |
| **Spec**    | tidak ada — muat satu sesi |
| **Docs**    | KI-033, T-089              |
| **Depends** | —                          |

**What to build:** Dua workspace uji tidak lagi ada di database: "Najwa QA Test Workspace" dan "QA Queue Test".

- [x] King Rezi mengonfirmasi (via `AskUserQuestion`) kedua nama itu boleh dihapus
- [x] Keduanya terhapus — "Najwa QA Test Workspace" (`57f91193-17df-444b-b734-064b748d1d58`) dan "QA Queue Test" (`46b1941a-e991-43eb-88ba-6b198fda0d71`) — diverifikasi via query SQL (hasil kosong setelah `DELETE`), tidak ada workspace lain yang ikut terhapus

### T-121 · Putuskan meta penulis di detail History

| Field       | Value                                        |
| ----------- | -------------------------------------------- |
| **Status**  | ✅ Done                                      |
| **Domain**  | publishing · UI                              |
| **Spec**    | tidak ada — muat satu sesi setelah keputusan |
| **Docs**    | KI-050, T-034                                |
| **Depends** | T-034 ✅                                     |

**What to build:** Halaman detail History menampilkan penulis post, atau keputusan tertulis bahwa penulis memang tidak ditampilkan.

- [x] King Rezi memutuskan (via `AskUserQuestion`, dengan info effort dari investigasi): penulis **ditampilkan**
- [x] Detail History menunjukkan siapa yang membuat post — `authorId` ditambahkan ke `HistoryItemRecord`, `AuthorPort` baru di `PublishingService` disuplai lewat `IdentityService` (cross-domain yang benar, diperbaiki setelah review Ridwan Architecture Reviewer — sebelumnya disuplai `identityRepository` mentah), render "Dibuat oleh &lt;nama&gt;" di `HistoryDetail.tsx` dengan fallback "Diimpor dari platform" untuk post `authorId` null
- [x] n/a — opsi "disembunyikan" tidak dipilih

**Catatan QA (Najwa):** PASS — golden path Published & Failed terverifikasi browser nyata, regresi aman, 832 test pass / 7 skip / 0 fail. Fallback "Diimpor dari platform" belum ada bukti visual karena data test tidak punya post berstatus Imported — keterbatasan data, bukan bug.

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
| **Status**  | ✅ Done                                          |
| **Domain**  | platform · UI                                    |
| **Spec**    | tidak ada — muat satu sesi setelah angka dikunci |
| **Docs**    | KI-089, KI-084                                   |
| **Depends** | —                                                |

**What to build:** Lebar sidebar di kode sama dengan angka yang King Rezi kunci (kode sekarang `18rem`; acuan yang disebut sebelumnya 260px).

- [x] King Rezi memilih (via `AskUserQuestion`): lebar sidebar dikunci **`18rem`** — nilai ini sudah ada di kode, jadi tidak ada kode yang diubah
- [x] n/a — angka sama dengan kode, tidak ada perubahan yang perlu mengikuti

### T-124 · Import sync gagal mendeserialisasi kolom void pada advisory lock (KI-091)

| Field       | Value                                         |
| ----------- | --------------------------------------------- |
| **Status**  | ✅ Done                                       |
| **Domain**  | platform · jobs                               |
| **Spec**    | tidak ada — muat satu sesi                    |
| **Docs**    | KI-091                                        |
| **Depends** | — (ditemukan saat verifikasi staging T-115.5) |

**What to build:** `lockOutstandPostIds` memakai `$executeRaw` untuk `pg_advisory_xact_lock` (kolom `void`). Patch `@prisma/adapter-pg@7.8.0` tetap terpasang sebagai jaring pengaman untuk query yang bersamaan pada satu koneksi (`prisma/orm#29979`). `runPendingJobs` tetap paralel. Retest staging lulus 2026-10-19.

Ditemukan 2026-10-19 saat verifikasi end-to-end staging T-115.5 (wiring cron
Import Posts periodik). `POST /api/jobs/run?type=import` memicu error
intermiten `Invalid prisma.$queryRaw() invocation: Failed to deserialize
column of type 'void'` pada sebagian job `import.sync` — job yang sama untuk
akun yang sama kadang sukses kadang gagal pada percobaan berurutan.

Penyebab yang menutup retest lokal: `lockOutstandPostIds` memakai
`$queryRaw` pada `SELECT pg_advisory_xact_lock(...)`. Fungsi itu
mengembalikan `void`, dan `$queryRaw` gagal mendeserialisasi kolom itu.
Lock per `outstandPostId` sekarang memakai `$executeRaw`.

Batch `runPendingJobs` tetap paralel. Dua isu upstream di
`@prisma/adapter-pg@7.8.0` tetap terbuka dan dicatat terpisah:

- [`prisma/orm#30374`](https://github.com/prisma/orm/issues/30374) — setelah
  error Postgres di dalam interactive transaction, query berikutnya pada
  client yang sama bisa menerima payload query lain.
- [`prisma/orm#29979`](https://github.com/prisma/orm/pull/29979) — query
  bersamaan pada satu koneksi `pg`. Belum merge per 2026-10-19. Isinya
  dipasang sebagai patch lokal. Retest dengan patch itu saja tetap gagal;
  patch tetap ikut sebagai jaring pengaman.

**Kenapa baru muncul sekarang:** jalur import (T-115) mengunci
`outstandPostId` lewat `lockOutstandPostIds`. Query itu `SELECT
pg_advisory_xact_lock(...)` dan semula memakai `$queryRaw`. Fungsi Postgres
itu mengembalikan `void`, lalu Prisma gagal mendeserialisasi kolomnya.
Lock workspace untuk fungsi yang sama sudah memakai `$executeRaw`. Ini
BUKAN bug logic T-115 — enqueue, watermark, dan guard concurrent sudah
diverifikasi benar.

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
- [x] King Rezi memilih serialize `runPendingJobs` (2026-10-19). Dicabut
      hari yang sama setelah code review. `claimPending` mengisi `startedAt`
      seluruh batch sekaligus, dan BG-D04 mengklaim ulang job `running`
      yang usianya lewat 30 detik. Job yang masih mengantri di batch serial
      ikut terambil cron berikutnya dan bisa jalan dua kali.
      `runPendingJobs` kembali paralel (`Promise.all`). Tes unit memastikan
      job kedua sudah mulai sebelum job pertama selesai.
- [x] Retest `?type=import` dari cabang ini (2026-10-19, server lokal, env yang sama). Dua job `import.sync` diantrikan ulang lalu dijalankan. Keduanya `outcome: done`, status `done`, `last_error` kosong:
  - `07b435ac-a08a-4f13-ba2d-2ac6c5e7df66` — akun `4a48b968-c6ef-4b97-a7a2-7c61bd68c089` / `eH82r`
  - `633eacfd-e796-42e5-9020-455f5486162c` — akun `d17e38ce-fbae-434c-ab27-e417fca384ab` / `Kav29`

**Yang menutup error ini:** `lockOutstandPostIds` memakai `$queryRaw` pada `SELECT pg_advisory_xact_lock(...)`. Fungsi itu mengembalikan `void`, dan `$queryRaw` gagal mendeserialisasi kolom `void`. Lock workspace sudah memakai `$executeRaw` untuk fungsi yang sama. Lock per `outstandPostId` sekarang ikut `$executeRaw` (`outstand-post-id-locks.ts`). Tes unit upsert dan backfill tetap lulus (21).

Workaround sebelumnya tidak cukup, dan dicatat supaya tidak diulang:

- Job satu per satu: job pertama di batch sudah gagal dengan error yang sama. Antrian itu juga dicabut dari `runPendingJobs` karena menabrak reclaim 30 detik (BG-D04).
- Patch lokal `@prisma/adapter-pg@7.8.0` (isi `prisma/orm#29979`, query di satu koneksi diantrikan) terpasang dan ter-compile di server lokal. Retest dengan patch itu saja tetap `dead_lettered` untuk kedua job. Patch ikut commit ini sebagai jaring pengaman, bukan penyebab retest lulus.

**Retest staging (2026-10-19):** service `web` staging sudah menjalankan commit `d7ef246` (berisi perbaikan ini). `POST /api/jobs/run?type=import` mengklaim 2 job `import.sync` dan keduanya `outcome: done` pada percobaan pertama (`attempts: 0`, `last_error` kosong), jalan paralel (waktu mulai sama):

- `a3ae1107-882c-4f8f-b2bb-ecdeb85fc9c8` — akun `4a48b968-c6ef-4b97-a7a2-7c61bd68c089` / `eH82r` (Instagram)
- `cf39b675-7aa8-4ad4-b523-ef464eceef40` — akun `d17e38ce-fbae-434c-ab27-e417fca384ab` / `Kav29` (Facebook)

Watermark kedua akun ter-update ke `2026-10-19 07:49:04` UTC. Error `Failed to deserialize column of type 'void'` tidak muncul. Service `cron` tetap image lama (2026-10-12); perannya hanya memanggil endpoint di `web`, dan kode lock jalan di `web`.
