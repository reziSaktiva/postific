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

**Retest staging (2026-10-19):** service `web` staging menjalankan revisi `d7ef246`. Perbaikan lock ada di PR 180, yang sudah menjadi leluhur revisi itu: `36248f7` (`$executeRaw` untuk lock `outstandPostId`) dan `ae4770d` (`runPendingJobs` kembali paralel), lewat merge `f0e5393`. Pesan `d7ef246` sendiri milik T-121 dan T-008. `POST /api/jobs/run?type=import` mengklaim 2 job `import.sync` dan keduanya `outcome: done` pada percobaan pertama (`attempts: 0`, `last_error` kosong), jalan paralel (waktu mulai sama):

- `a3ae1107-882c-4f8f-b2bb-ecdeb85fc9c8` — akun `4a48b968-c6ef-4b97-a7a2-7c61bd68c089` / `eH82r` (Instagram)
- `cf39b675-7aa8-4ad4-b523-ef464eceef40` — akun `d17e38ce-fbae-434c-ab27-e417fca384ab` / `Kav29` (Facebook)

Watermark kedua akun ter-update ke `2026-10-19 07:49:04` UTC. Error `Failed to deserialize column of type 'void'` tidak muncul. Service `cron` tetap image lama (2026-10-12); perannya hanya memanggil endpoint di `web`, dan kode lock jalan di `web`.

### T-127 · Caption panjang bikin seluruh halaman scroll ke samping

| Field       | Value                               |
| ----------- | ----------------------------------- |
| **Status**  | ✅ Done (2026-10-19)                |
| **Domain**  | UI                                  |
| **Spec**    | tidak ada — muat satu sesi, bug CSS |
| **Docs**    | KI-092                              |
| **Depends** | —                                   |

**Ditemukan (KI-092, King Rezi, via code-review PR #183):** caption post di
kartu Publish → History yang berisi URL panjang tanpa spasi (mis.
`https://www.cookitrealgood.com/homemade-pumpkin-recipes/`) membuat
**seluruh halaman** (bukan cuma satu kartu) bisa di-scroll ke samping —
`document.body.scrollWidth` jauh melebihi `clientWidth` (diverifikasi
browser: 6352px vs 753px pada viewport tablet).

**Root cause:** `<div className="relative flex min-h-0 flex-1 flex-col">`
di `apps/web/src/app/(app)/layout.tsx` (kolom konten, sibling dari sidebar
di flex row `SidebarProvider`) sudah punya `min-h-0` untuk sumbu vertikal,
tapi **tidak punya `min-w-0`** untuk sumbu horizontal. Classic flexbox trap:
flex item tanpa `min-width:0` eksplisit defaultnya `min-width:auto`
(ukuran minimum = konten), jadi begitu ADA satu teks tak terputus yang
cukup panjang di dalam pohon flex yang dalam (caption → `ItemTitle`
`truncate` → `ItemContent` → `Item`/`<a>` → `ItemGroup` → ... → kolom
konten ini), ukuran minimumnya ikut menggelembung dan merambat ke ATAS
sampai ke kolom konten ini — yang karena tidak dibatasi `min-w-0`, ikut
melebar dan mendorong `<body>` jadi scroll horizontal. `truncate`
(`overflow:hidden`+`text-overflow:ellipsis`) di `ItemTitle` MEMANG sudah
benar dan tidak menjadi penyebab — `overflow:hidden` di situ sudah
menjadikan ukuran minimum `ItemTitle` sendiri 0, tapi itu tidak menolong
kalau ANCESTOR lain di jalur flex (di luar `apps/web/src/app/(app)/publish/history/`,
yakni di shared layout) tidak diberi `min-w-0` juga — satu link di rantai
flex yang kebobolan sudah cukup membuat semuanya melebar.

- [x] Tambah `min-w-0` ke kolom konten `(app)/layout.tsx` (satu class,
      simetris dengan `min-h-0` yang sudah ada).
- [x] Diverifikasi browser: `/publish/history` (yang melahirkan laporan ini),
      `/publish/calendar`, `/publish/drafts`, `/settings/profile` — di
      desktop (1957px), tablet (768px), dan mobile (375px) —
      `document.body.scrollWidth === document.documentElement.clientWidth`
      di semuanya, tidak ada elemen yang overflow (`getBoundingClientRect().width`
      dicek programatik, bukan cuma visual). Caption panjang sekarang
      terpotong dengan "…" di desktop/tablet (`sm:truncate`) dan wrap
      multi-baris di mobile (`whitespace-normal`), tanpa mendorong layout.
- [x] `tsc --noEmit`/`eslint .` (apps/web) bersih, `bun run vitest run` 835
      passed/7 skipped/0 failed — tidak ada regresi dari satu class CSS ini.

**Catatan teknik untuk kasus serupa di masa depan:** kalau ada laporan
"halaman bisa di-scroll ke samping" lagi, teknik diagnosis yang dipakai di
sini — jalankan di browser console: `document.body.scrollWidth` vs
`document.documentElement.clientWidth` (beda = ada overflow), lalu walk
`children` dari `document.body` rekursif cari elemen pertama yang
`getBoundingClientRect().width > viewportWidth` — ini akar masalahnya,
JANGAN hanya fix elemen yang "paling mencurigakan" (biasanya kartu/teks di
lokasi laporan) karena propagasi flexbox sering membuat akarnya ada di
layout bersama (shared layout/shell), bukan di komponen yang dilaporkan.
Fix idealnya tetap SATU `min-w-0` di titik akar (bukan menambal `truncate`/
`break-words` di tiap komponen anak satu-satu), karena masalahnya adalah
rantai flex yang gagal men-declare minimum-width:0, bukan teks yang tidak
di-wrap.

### T-130 · `totalPosts` Home tidak akurat untuk akun yang `posts_count`-nya `null` di Outstand

| Field       | Value                                                                |
| ----------- | -------------------------------------------------------------------- |
| **Status**  | ⏳ Open — King Rezi memutuskan dicatat dulu, belum diimplementasikan |
| **Domain**  | analytics                                                            |
| **Spec**    | tidak ada — single-issue, dampak kecil                               |
| **Docs**    | KI-093, T-129 (Analyze — sudah fixed di T-129.1)                     |
| **Depends** | —                                                                    |

**Ditemukan (KI-093, King Rezi, 2026-10-19):** setelah T-129.1 (Imported
posts ikut dihitung di Analyze), King Rezi bertanya kenapa post Imported
"Cook It Real Good" (15 post Facebook) tidak ikut menaikkan angka "Post
terpublikasi" di Home. Awalnya diduga exclude status sama seperti Analyze
sebelum T-129.1 — **ternyata root cause berbeda dan lebih sempit.**

**Investigasi (MCP `outstand`, live read-only, 2026-10-19):**

1. `AnalyticsService.getDashboardSummary` → `totalPosts` Home dibaca dari
   `AnalyticsWorkspaceSnapshot`, diisi `AnalyticsIngestionUseCase.syncWorkspaceSnapshot`
   dari `IOutstandAdapter.fetchWorkspaceMetrics` (`GET /v1/social-accounts/{id}/metrics`,
   field `data.posts_count`) — bukan dari query Prisma status internal sama
   sekali, beda mekanisme dari Analyze.
2. Tes live `get_account_metrics` akun "turanilkerl" (Instagram, `eH82r`):
   `posts_count: 3` — akurat, cocok angka Home.
3. Tes live `get_account_metrics` akun "Cook It Real Good" (Facebook Page,
   `Kav29`): `posts_count: null` — **field ini kosong untuk Facebook Page**,
   padahal `engagement.reach`/`engagement.likes` dkk di response yang SAMA
   tetap terisi valid (reach 4812, engagement 97). `toNumber(null)` di
   `real-outstand-adapter.ts:1255` menjadikannya 0, jadi 15 post Facebook
   akun ini tidak menambah `totalPosts` Home sama sekali.
4. King Rezi minta dicek dokumentasi `GET /v1/posts/{id}/analytics`
   (per-post analytics) — dikonfirmasi **tidak ada pembedaan sumber post**
   (Imported vs native) di endpoint itu. Dibuktikan live: `get_post_analytics`
   untuk post Imported `LGyF6` ("Watermelon Salad", Cook It Real Good)
   mengembalikan metrik lengkap (likes 2, comments 0, shares 1,
   impressions 383) — Outstand **bisa** kasih analytics detail per post
   Imported, tidak ada keterbatasan di situ.

**Kesimpulan:** bukan "Outstand tidak mendukung analytics Imported" dan
bukan exclude status seperti Analyze — gapnya spesifik di satu field
(`posts_count`) dari satu endpoint agregat level-akun
(`fetchWorkspaceMetrics`), untuk platform Facebook Page. Berlaku untuk
SEMUA post di akun itu (Imported maupun bukan), bukan cuma yang Imported.

**Opsi perbaikan (didiskusikan, belum dieksekusi):** hitung `totalPosts`
Home dari DB internal (status `Published`/`Failed`/`Imported`, reuse
`HISTORY_TERMINAL_STATUSES` — pola sama T-129.1) lewat port cross-domain
baru `analytics` → `publishing` (pola sama `ActiveAccountsPort`), alih-alih
`posts_count` Outstand yang terbukti tidak reliable untuk Facebook.
`totalReach`/`totalEngagements` Home tetap dari Outstand (field itu sudah
terbukti valid). King Rezi memilih menunda eksekusi — dicatat di sini
sebagai Known Issue terbuka, bukan dikerjakan di sesi ini.

- [ ] Tambah port `analytics` → `publishing` untuk hitung jumlah post
      terminal-status per workspace/periode (pola `ActiveAccountsPort`).
- [ ] `AnalyticsIngestionUseCase.syncWorkspaceSnapshot` pakai hasil port itu
      untuk `totalPosts`, bukan jumlah `metrics.totalPosts` per akun dari
      Outstand.
- [ ] Test unit untuk kasus `posts_count: null`/platform tanpa dukungan
      field itu.
- [ ] Verifikasi browser: Home menampilkan jumlah post yang cocok dengan
      Analyze untuk periode yang sama.

**Prioritas dinaikkan (King Rezi, 2026-10-21):** bagian dari batch investigasi
ketidaksesuaian data Supabase vs Outstand — dikerjakan bersamaan dengan
**T-134, T-135, T-136** (gap #1, #3, #4 baru dari investigasi yang sama).
Tiket ini juga jadi salah satu syarat pembuka blocker **T-133** (lihat
catatan blocking di `v02-publishing-mvp.md` § T-133).

### T-134 · Disconnect akun sosial tidak dipropagasi ke Outstand (KI-094)

| Field       | Value                                                                                                                                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**  | ⏳ Open — prioritas tinggi (batch investigasi King Rezi, 2026-10-21)                                                                                                                                                                                   |
| **Domain**  | workspace · integration                                                                                                                                                                                                                                |
| **ADR**     | **Perlu ADR baru** sebelum implementasi — menambah kontrak baru (`deleteSocialAccount`/`revoke`) di `IOutstandAdapter`, mengubah perilaku `WorkspaceService.disconnectAccount` yang sebelumnya sengaja (T-013, ADR-048/ADR-049) hanya update status DB |
| **Spec**    | tidak ada — single-issue, tapi perlu ADR dulu (lihat kolom ADR)                                                                                                                                                                                        |
| **Docs**    | T-013, ADR-048, ADR-049 (keputusan lama "disconnect = update status DB saja", konsekuensi ke akurasi metrics belum pernah dibahas di ADR manapun)                                                                                                      |
| **Terkait** | KI-093/T-130 (gap #2, sama-sama bikin metrics Home tidak akurat, root cause beda), T-133 (blocker)                                                                                                                                                     |
| **Depends** | —                                                                                                                                                                                                                                                      |

**Ditemukan (investigasi King Rezi, 2026-10-21):** saat user disconnect akun
sosial lewat UI kita, yang terjadi hanya `UPDATE status='disconnected'` di
tabel `WorkspaceConnectedAccount`
(`apps/web/src/lib/repositories/workspace/workspace.repository.ts:1034-1049`).
Tidak ada pemanggilan ke Outstand API sama sekali — `IOutstandAdapter`
(`packages/shared/src/contracts/outstand-adapter.ts:641`) tidak punya method
`deleteSocialAccount`/`revoke`, dan `RealOutstandAdapter` juga tidak
mengimplementasikannya.

**Alur lengkap:** UI `ConnectedAccountsList.tsx:426` → Server Action
`actions.ts:65` (`disconnectAccountAction`) → `WorkspaceService.disconnectAccount`
(`workspace.service.ts:1566` — docstring eksplisit bilang "TIDAK memanggil
OutstandAdapter") → repository port (`workspace.repository.ts:615-641`
domain) → implementasi Prisma di atas.

**Dampak:** akun yang sudah "diputus" di sisi kita tetap `connected` di
Outstand selamanya, post lamanya terus dihitung di metrics (`posts_count`,
engagement) tanpa batas waktu.

**Bukti nyata:** akun Instagram `turanilkerl` (connected sejak 2026-09-25,
kemungkinan sudah di-disconnect di app kita) masih berstatus `connected` di
Outstand dengan 3 post test QA lama (Sep 2026) yang terus dihitung di
dashboard Home kita — lihat T-134.4 untuk pembersihan data residunya.

- [ ] **T-134.1** Tulis ADR baru: keputusan menambah kontrak
      `deleteSocialAccount`/`revoke` (nama final diputuskan saat menulis ADR)
      di `IOutstandAdapter`, dan kapan dipanggil dalam alur
      `WorkspaceService.disconnectAccount` (sebelum/sesudah update status DB,
      perilaku kalau Outstand API gagal — jangan membuat DB dan Outstand makin
      tidak sinkron kalau call-nya gagal)
- [ ] **T-134.2** Implementasi method baru di `RealOutstandAdapter` (ADR-119 —
      tidak ada Fake di jalur produksi)
- [ ] **T-134.3** `WorkspaceService.disconnectAccount` memanggil method baru
      itu; update docstring yang sekarang eksplisit bilang "TIDAK memanggil
      OutstandAdapter"
- [ ] **T-134.4** Cleanup data residu: 3 post test QA ("[TEST QA Jokowi] Uji
      upload JPG - mohon abaikan", "teataewtet", "lalalala") di akun Instagram
      `turanilkerl` yang sudah disconnect dari app kita tapi masih live di
      Outstand/Instagram — verifikasi lewat method T-134.2 baru, pastikan
      akun ini ikut ter-disconnect benar di Outstand (gap #6 investigasi
      2026-10-21, konsekuensi langsung gap ini)
- [ ] **T-134.5** Test unit untuk jalur sukses dan gagal (Outstand API error
      saat disconnect — DB tidak boleh diam-diam out-of-sync lagi)
- [ ] **T-134.6** Verifikasi end-to-end browser + akun real: disconnect dari
      UI kita benar-benar membuat akun `disconnected` di Outstand, post lama
      akun itu berhenti dihitung di metrics Home/Analyze

### T-135 · Definisi periode "bulanan" Home/Analyze beda dari kalender Outstand (KI-095)

| Field       | Value                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------- |
| **Status**  | ⏳ Open — prioritas tinggi (batch investigasi King Rezi, 2026-10-21)                          |
| **Domain**  | analytics                                                                                     |
| **ADR**     | — (kemungkinan perlu keputusan produk soal definisi window, bukan arsitektur — lihat T-135.1) |
| **Spec**    | tidak ada — single-issue                                                                      |
| **Docs**    | T-128/T-129 (default view Bulanan Home/Analyze)                                               |
| **Terkait** | T-134, T-136, T-130 (batch investigasi sama, 2026-10-21), T-133 (blocker)                     |
| **Depends** | —                                                                                             |

**Ditemukan (investigasi King Rezi, 2026-10-21):** snapshot "monthly" kita
dihitung sebagai rolling 30 hari dari `now`
(`apps/web/src/domains/analytics/services/analytics-sync-job-handler.ts:148-155`,
fungsi `resolveAnalyticsSnapshotWindow`), **bukan** kalender bulan (tanggal 1
s.d. akhir bulan) seperti yang ditampilkan dashboard native Outstand.
Akibatnya angka "bulan ini" di kita tidak pernah bisa dibandingkan
apple-to-apple dengan Outstand dashboard — user melaporkan Outstand
menunjukkan 12 post bulan ini sedangkan Home kita menunjukkan 3; beda window
waktu ini salah satu kontributornya (bukan satu-satunya — lihat juga gap #1
T-134 dan gap #2 T-130).

- [ ] **T-135.1** King Rezi memutuskan (via `AskUserQuestion`): window
      "bulanan" tetap rolling 30 hari, atau pindah ke kalender bulan
      (tanggal 1 s.d. akhir bulan, sama seperti Outstand)
- [ ] **T-135.2** Implementasi sesuai keputusan T-135.1 di
      `resolveAnalyticsSnapshotWindow` (dan tempat lain yang reuse fungsi ini,
      cek pemanggil)
- [ ] **T-135.3** Test unit untuk window baru (termasuk edge case: hari
      pertama bulan, bulan dengan 28/29/30/31 hari kalau pindah ke kalender
      bulan)
- [ ] **T-135.4** Verifikasi browser: angka "bulan ini" Home/Analyze cocok
      dengan ekspektasi window yang dipilih

### T-136 · Ambiguitas semantik label "Post terpublikasi" Home (KI-096)

| Field       | Value                                                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**  | ⏳ Open — prioritas tinggi (batch investigasi King Rezi, 2026-10-21)                                                                                      |
| **Domain**  | analytics · UI                                                                                                                                            |
| **ADR**     | — (keputusan produk soal sumber metric, bukan arsitektur)                                                                                                 |
| **Spec**    | tidak ada — single-issue                                                                                                                                  |
| **Docs**    | T-130/KI-093 (root cause teknis field `posts_count` terkait erat)                                                                                         |
| **Terkait** | T-130, T-134, T-135 (batch investigasi sama, 2026-10-21), T-133 (blocker)                                                                                 |
| **Depends** | sebaiknya diputuskan bersamaan dengan T-130 — kalau T-130 pindah ke hitung dari DB internal, label ini otomatis jadi akurat untuk makna "status internal" |

**Ditemukan (investigasi King Rezi, 2026-10-21):** label di
`DashboardHome.tsx:155-162` menyiratkan status internal
(`PublishingPost.status === 'published'`), tapi nilai `summary.totalPosts`
sebenarnya diambil mentah dari `posts_count` Outstand
(`AnalyticsService.getDashboardSummary` → `analytics-ingestion.use-case.ts`
→ `real-outstand-adapter.ts` `fetchWorkspaceMetrics`), yang bisa termasuk
post yang tidak pernah lewat sistem kita (native post di platform, post dari
akun yang sudah disconnect — lihat T-134/gap #1).

**Perlu keputusan produk:** apakah metric ini dihitung dari status internal
`PublishingPost` (konsisten dengan opsi perbaikan T-130), atau tetap dari
Outstand tapi dengan label yang lebih jujur (mis. "Post di akun terhubung"
bukan "Post terpublikasi").

- [ ] **T-136.1** King Rezi memutuskan (via `AskUserQuestion`): ganti sumber
      data (ikut T-130) atau ganti label (tetap sumber Outstand, teks lebih
      jujur)
- [ ] **T-136.2** Implementasi sesuai keputusan T-136.1 di `DashboardHome.tsx`
      dan/atau `AnalyticsService.getDashboardSummary`
- [ ] **T-136.3** Verifikasi browser: label dan angka konsisten secara makna
      (tidak ada lagi "Post terpublikasi" yang sebenarnya termasuk post dari
      akun disconnected/native)
