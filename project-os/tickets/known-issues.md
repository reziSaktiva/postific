# Tiket dari Known Issue

> Rumah tiket yang lahir sebagai pelacak Known Issue, bukan sebagai kerja rilis. ADR-134. Antrian yang belum selesai tetap di [`../AVAILABLE_TICKETS.md`](../AVAILABLE_TICKETS.md).

Tiket fitur yang kebetulan memuat atau menutup satu KI tetap di file rilisnya. Contoh yang sengaja tidak dipindah: T-008 (KI-027) di `v01-foundation.md`, T-088 (KI-028) di `v10-public-launch.md`.

---

### T-137 · Adapter SMTP sementara untuk email staging (KI-097, ADR-137)

| Field       | Value                                                                                |
| ----------- | ------------------------------------------------------------------------------------ |
| **Status**  | ✅ Done                                                                              |
| **Domain**  | notification                                                                         |
| **Spec**    | tidak ada — muat satu sesi                                                           |
| **Docs**    | KI-097, ADR-137, ADR-126                                                             |
| **Depends** | — (sunset: dicabut begitu domain Resend terverifikasi, lihat T-119 sebagai pola env) |

**What to build:** Khusus environment staging, email transactional (reset
password, verifikasi email Better Auth, kode verifikasi accept-invite,
undangan anggota workspace) dikirim lewat SMTP langsung (`rezi@insvire.com`)
alih-alih Resend, karena akun Resend terkunci mode testing (domain pengirim
`onboarding@resend.dev` tidak bisa diverifikasi — bukan domain sendiri) dan
hanya bisa kirim ke `rezi@insvire.com`, memblokir QA flow multi-akun. Scope
**hanya staging** — production tetap Resend (ADR-126 tidak diamendemen untuk
production).

- [x] Adapter baru `createSmtpAuthEmailSender`/`createSmtpInviteEmailSender`
      (`nodemailer`) sebagai sibling dari adapter Resend yang sudah ada —
      bukan mengganti/menghapus kode Resend
- [x] Factory `getAuthEmailSender()`/`getInviteEmailSender()`
      (`apps/web/src/lib/adapters/email/index.ts`) memilih adapter
      berdasarkan env `EMAIL_PROVIDER` (`"smtp"` → SMTP, default/`"resend"`
      → Resend seperti sekarang)
- [x] Env baru didokumentasikan: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
      `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` — King Rezi yang mengisi nilainya
      langsung di Railway staging (agent tidak pernah memegang kredensial,
      pola sama T-119)
- [x] `EMAIL_PROVIDER=smtp` di-set di Railway staging oleh King Rezi;
      production tidak diisi (tetap fallback Resend)
- [x] Diverifikasi: undangan member/kode accept-invite terkirim ke email
      selain `rezi@insvire.com` di staging
- [ ] **Syarat selesai/sunset**: setelah domain pengirim Resend
      terverifikasi, `EMAIL_PROVIDER` dihapus dari staging (balik ke Resend
      penuh) — dicatat sebagai follow-up, bukan bagian wajib tiket ini

**Progress:** Implementasi + review (Ridwan, tidak ada pelanggaran arsitektur)

- QA (Najwa, PASS — 17 test, typecheck & lint bersih) selesai di branch
  `feature/t137-smtp-staging-email`. King Rezi mengonfirmasi (2026-10-22)
  env `EMAIL_PROVIDER=smtp`/`SMTP_*` sudah diisi di Railway staging dan
  verifikasi e2e (undangan/kode accept-invite terkirim ke email selain
  `rezi@insvire.com` di staging) sudah PASS — tiket ditutup **✅ Done**.
  Syarat sunset (hapus `EMAIL_PROVIDER` dari staging setelah domain pengirim
  Resend terverifikasi) dicatat sebagai follow-up terpisah, bukan bagian
  wajib tiket ini.

### T-138 · Escape HTML hilang di email kode verifikasi accept-invite (KI-098)

| Field       | Value                      |
| ----------- | -------------------------- |
| **Status**  | ✅ Done                    |
| **Domain**  | notification               |
| **Spec**    | tidak ada — muat satu sesi |
| **Docs**    | KI-098                     |
| **Depends** | —                          |

**What to build:** Ditemukan Najwa (QA Engineer) saat QA T-137, sebagai bug
pre-existing — bukan bagian T-137. Di
`apps/web/src/lib/adapters/email/resend-invite-email-sender.ts`, fungsi
`renderVerificationEmailHtml()` (baris ~47-64) menempel `input.workspaceName`
dan `input.code` langsung ke template HTML tanpa melalui `escapeHtml()` —
berbeda dengan `renderMemberInvitationHtml()` di file yang sama (baris
~66-86) yang sudah benar membungkus semua input (`workspaceName`,
`invitedByName`, `roleLabel`, `inviteLink`) dengan `escapeHtml()`. Risiko:
kalau `workspaceName` (input user bebas saat membuat workspace) mengandung
karakter HTML (`<`, `>`, `"`, `&`), karakter itu diinterpretasikan sebagai
markup oleh email client penerima saat email kode verifikasi accept-invite
dikirim — berpotensi HTML injection di body email. `code` sendiri risikonya
lebih kecil (digenerate sistem), tapi tetap tidak konsisten dengan pola
escape di fungsi sebelahnya. Bug ini ikut ter-duplikasi secara identik ke
adapter SMTP baru (`apps/web/src/lib/adapters/email/smtp-invite-email-sender.ts`,
fungsi sejenis) karena T-137 memang didesain untuk mengkopi behavior Resend
1:1 — jadi kedua adapter (Resend & SMTP) punya bug yang sama, perbaikannya
harus di keduanya sekaligus.

Fix yang diusulkan: tambahkan `escapeHtml(input.workspaceName)` dan
`escapeHtml(input.code)` di `renderVerificationEmailHtml()` pada kedua file,
mengikuti pola yang sudah ada di `renderMemberInvitationHtml()`.

- [x] Escape `workspaceName` dan `code` di `renderVerificationEmailHtml()`,
      `resend-invite-email-sender.ts`
- [x] Escape yang sama di fungsi sejenis,
      `smtp-invite-email-sender.ts`
- [x] Tambah/update test yang memverifikasi escaping di kode verifikasi,
      sejenis test escape yang sudah ada untuk `renderMemberInvitationHtml`

**Hasil:** Fix diimplementasikan Elon (Backend Engineer) di kedua adapter,
mengikuti pola `escapeHtml()` yang sudah ada di `renderMemberInvitationHtml()`.
Direview Ridwan (Architecture Reviewer) — tidak ada pelanggaran arsitektur.
QA Najwa (QA Engineer) — PASS, 19 test lulus di folder email (termasuk test
escaping baru yang memverifikasi payload berbahaya `<script>`, `&`, `"` benar-benar
ter-escape di output), typecheck & lint bersih, tidak ada regresi. Perubahan ada
di branch `feature/t137-smtp-staging-email`, akan masuk PR #189.

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

| Field       | Value                                                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**  | 🚫 Implementasi selesai (root cause fixed, review + QA PASS) — blocked verifikasi browser E2E, butuh akun test Outstand baru (2026-10-21) |
| **Domain**  | analytics                                                                                                                                 |
| **Spec**    | tidak ada — single-issue, dampak kecil                                                                                                    |
| **Docs**    | KI-093, T-129 (Analyze — sudah fixed di T-129.1)                                                                                          |
| **Depends** | —                                                                                                                                         |

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

- [x] Tambah port `analytics` → `publishing` untuk hitung jumlah post
      terminal-status per workspace/periode (pola `ActiveAccountsPort`).
- [x] `AnalyticsIngestionUseCase.syncWorkspaceSnapshot` pakai hasil port itu
      untuk `totalPosts`, bukan jumlah `metrics.totalPosts` per akun dari
      Outstand.
- [x] Test unit untuk kasus `posts_count: null`/platform tanpa dukungan
      field itu.
- [x] Keputusan produk granularitas Home vs Analyze (King Rezi, 2026-10-21):
      boleh BEDA — Home menghitung jumlah post (distinct `PublishingPost`),
      Analyze menghitung post × akun-target (`getAnalyzeSummary.totalPosts`)
      — TIDAK perlu dipaksa sama. **Ditutup sebagai keputusan final
      "accepted as different"**, bukan lagi item terbuka — lihat catatan
      granularitas di "Implementasi" di bawah untuk detail teknis.
- [ ] Verifikasi browser dengan data real (angka Home akurat, tidak error,
      sesuai definisi sumber data baru) — **tertunda**, butuh akun test
      Outstand baru (workspace King Rezi kosong sejak pembersihan data T-134,
      2026-10-21). Bukan item yang menunggu keputusan produk lagi — murni
      menunggu lingkungan test tersedia.

**Prioritas dinaikkan (King Rezi, 2026-10-21):** bagian dari batch investigasi
ketidaksesuaian data Supabase vs Outstand — dikerjakan bersamaan dengan
**T-134, T-135, T-136** (gap #1, #3, #4 baru dari investigasi yang sama).
Tiket ini juga jadi salah satu syarat pembuka blocker **T-133** (lihat
catatan blocking di `v02-publishing-mvp.md` § T-133).

**Implementasi (Prabowo Feature Engineer, 2026-10-21):**

- Port baru `TerminalPostsCountPort` (interface lokal, structural typing —
  pola sama `ActiveAccountsPort`) didefinisikan di
  `apps/web/src/domains/analytics/services/analytics-ingestion.use-case.ts`,
  method `countTerminalPosts({ workspaceId, since, until }, userId): Promise<number>`.
  Jadi constructor param WAJIB ke-3 `AnalyticsIngestionUseCase` (bukan
  optional) — `syncPostMetrics` tidak memakainya, tapi satu Use Case satu
  constructor, pola sama `IOutstandAdapter`.
- Implementasi: method baru `IPublishingRepository.countTerminalPosts`
  (`apps/web/src/domains/publishing/repositories/publishing.repository.ts`)
  - implementasi Prisma di
    `apps/web/src/lib/repositories/publishing/publishing.repository.ts`
    (`tx.publishingPost.count`, `withCurrentUser`). `where` clause diekstrak
    jadi fungsi murni `countTerminalPostsWhere`
    (`apps/web/src/lib/repositories/publishing/count-terminal-posts.ts`, pola
    sama `manualImportSyncCapWhere`) supaya bisa dites tanpa DB nyata — filter
    `status: { in: HISTORY_TERMINAL_STATUSES }`, `publishedAt` half-open
    `[since, until)`, konsisten `listHistory`/`getPostPerformance`.
- `syncWorkspaceSnapshot` (`analytics-ingestion.use-case.ts`) sekarang
  memanggil port ini untuk `totalPosts`, bukan menjumlahkan
  `metrics.totalPosts` dari `fetchWorkspaceMetrics` Outstand sama sekali.
  `totalReach`/`totalEngagements` TIDAK diubah, tetap dari Outstand.
  Di-wire di composition root `apps/web/src/app/api/jobs/run/route.ts`
  (`publishingRepository` dipassing langsung sebagai port — structural
  typing, sama pola `publishingRepository` dipakai sebagai
  `AnalyticsSyncPostsPort` di handler yang sama).
- **Catatan granularitas (dicatat, bukan diputuskan sendiri):** port ini
  menghitung baris `PublishingPost` (distinct post) sesuai teks checklist
  tiket ini ("jumlah post"), BUKAN baris post × target seperti
  `PublishingService.getAnalyzeSummary.totalPosts` (Analyze menghitung
  target berstatus `published` per post). Untuk post single-platform kedua
  angka akan sama; untuk post yang dipublish ke >1 akun di periode yang
  sama, angka Home (jumlah post) akan LEBIH KECIL dari angka Analyze
  (jumlah post × akun). Checklist item terakhir (verifikasi browser Home
  vs Analyze) belum dieksekusi — kalau King Rezi menginginkan Home dan
  Analyze match PERSIS di semua skenario (bukan cuma kasus single-platform),
  ini butuh keputusan produk tambahan (ganti granularitas port, atau
  terima bedanya sebagai definisi "post" vs "slot publish" yang memang
  beda). Post `Failed` (yang `publishedAt`-nya di-null-kan, KI-081)
  otomatis tidak pernah masuk rentang periode manapun — efektif hanya
  `Published`+`Imported` yang terhitung, SAMA perilaku yang sudah ada di
  `getPostPerformance`, bukan regresi baru.
- Test: `apps/web/src/domains/analytics/services/analytics-ingestion.use-case.test.ts`
  (3 test baru/diperbarui — kasus akun `posts_count: 0`/null ala Facebook
  Page tapi `totalReach`/`totalEngagements` tetap valid, kasus normal
  dengan `totalPosts` dari port beda dari jumlah Outstand untuk membuktikan
  independensi, dan kasus workspace tanpa post sama sekali → `totalPosts: 0`)
  - `apps/web/src/lib/repositories/publishing/count-terminal-posts.test.ts`
    (bentuk `where` Prisma). Fake `IPublishingRepository` di 7 test file lain
    (`publishing.service.test.ts`, `publish-now`/`cancel-schedule`/
    `retry-failed-target`/`schedule-posts.use-case.test.ts`,
    `outstand-webhook-processor.test.ts`,
    `resolve-scheduled-post-outcome-job-handler.test.ts`) diperbarui pakai
    stub baru `noopTerminalPostsRepositoryStub`
    (`apps/web/src/lib/testing/outstand-post-id-backfill-stubs.ts`, pola sama
    `noopBackfillRepositoryStubs`/`noopClassifyRepositoryStub`) supaya
    compile tetap lulus. **Hasil test: 898 passed, 7 skipped, 0 gagal**
    (full suite `bunx vitest run`); `tsc --noEmit` bersih; `eslint .` bersih
    (exit 0).

**Keputusan final (King Rezi, 2026-10-21):** eksekusi opsi "DB internal" di
atas. Dicek dulu dokumentasi resmi Outstand `GET /v1/social-accounts/{id}/metrics`
(raw HTML halaman docs, bukan ringkasan) — baris penjelasan per-platform
eksplisit menyebut `posts_count` untuk Pinterest ("includes both created and
saved pins") dan BlueSky ("posts count - current snapshot only"), tapi baris
Facebook hanya menyebut "page followers/fans, engagement (impressions, reach,
post_engagements)" — **`posts_count` tidak disebut sama sekali untuk
Facebook**. Contoh JSON di docs yang menunjukkan `posts_count: 150` memakai
`"network": "tiktok"`, bukan Facebook. Kesimpulan: null untuk Facebook Page
bukan bug kebetulan, field itu memang tidak didukung/didokumentasikan
Outstand untuk platform ini — tidak ada alasan menunggu konfirmasi Outstand
sebelum eksekusi fix di sisi kita.

**QA (Najwa QA Engineer, 2026-10-21):** test suite ulang —
`bunx vitest run` dari root: **898 passed, 7 skipped, 0 fail**. `bun run
typecheck` (`apps/web`): bersih. `bun run lint` (`apps/web`): exit 0 (hanya
warning non-fatal "Pages directory cannot be found", tidak terkait
perubahan ini). `DashboardHome.tsx:157` dicek langsung — label "Post
terpublikasi" memang tidak berubah, hanya `value={summary.totalPosts}` yang
sumbernya sudah diganti di backend — klaim T-136.2 "tanpa perubahan kode
UI" terkonfirmasi akurat. T-130.292 (verifikasi browser Home vs Analyze)
dan T-136.3 **tetap belum bisa dieksekusi** — Outstand workspace King Rezi
kosong (0 akun, 0 post) di sesi ini, jadi tidak ada data post real untuk
dibandingkan; browser testing yang bisa dilakukan (Home render dengan 0
post, tanpa error) PASS — lihat § T-134 untuk detail checklist browser.

**Keputusan produk granularitas Home vs Analyze (King Rezi, via
`AskUserQuestion`, 2026-10-21):** beda granularitas yang dicatat di
"Implementasi" (Home = jumlah post distinct, Analyze = jumlah post × akun
target) **diterima sebagai definisi yang memang berbeda** — bukan bug, bukan
item yang menunggu keputusan produk lagi. Home dan Analyze **tidak** perlu
menampilkan angka yang identik persis untuk periode yang sama; keduanya sudah
benar untuk makna masing-masing ("jumlah post" vs "jumlah slot publish").
Satu-satunya sisa pekerjaan adalah verifikasi browser dengan data nyata
(lihat checklist di atas), bukan penyesuaian granularitas lebih lanjut.
Didokumentasikan sebagai ADR-136 (bersama keputusan window kalender bulan
T-135 dan sumber `totalPosts` DB internal).

**Status final (Gibran Project Manager, 2026-10-21):** implementasi, test
otomatis, review Ridwan, dan QA Najwa semua PASS. Tiket ini **belum** ✅ Done
penuh — satu item tersisa (verifikasi browser dengan data real) murni
terhambat ketiadaan akun test Outstand baru, bukan bug/pekerjaan kode yang
belum selesai. Status diset 🚫 (menunggu dependency eksternal), bukan ✅,
sampai verifikasi itu bisa dilakukan.

**Progress sesi verifikasi E2E 2026-10-22 (King Rezi + AI, akun real "Cook It
Real Good", read-only — tidak ada posting ke channel real):** akun test
Outstand baru akhirnya tersedia (4 channel real: Facebook, TikTok, Instagram,
YouTube, dihubungkan 21-22 Oktober 2026), tapi item terakhir tiket ini
**masih belum bisa ditutup penuh**:

- Dikonfirmasi live (`get_account_metrics`) `posts_count` Outstand untuk
  akun Facebook "Cook It Real Good" (`NgJwa`) tetap `null` — root cause
  T-130 masih valid/reproducible persis dengan akun real, bukan cuma
  fixture lama.
- Dikonfirmasi tabel `publishing_posts` tetap 0 baris di seluruh database,
  dan Home menampilkan "Post terpublikasi: 0" — konsisten dengan sumber
  data baru (DB internal), tapi ini belum bukti kuat karena belum ada kasus
  nonzero riil untuk dibandingkan (kebetulan sama dengan behavior lama yang
  juga akan menampilkan 0 untuk Facebook yang `posts_count`-nya null).
- Untuk dapat kasus nonzero, dicoba import akun Instagram real
  `cookitrealgood` (account id `M4oPC`, 1503 post) via "Sync Now" lalu
  manual job trigger `/api/jobs/run?type=import` berkali-kali — TAPI
  Outstand butuh waktu sangat lama memproses import akun besar ini (retry
  berkali-kali dengan pesan "Import masih diproses di Outstand setelah
  menunggu 25 detik", backoff makin panjang sampai ~1 jam di attempt
  ke-3/4), BELUM selesai sampai sesi berakhir.
- Saat proses TikTok (`vs7ig`, akun besar juga) sempat lolos ke tahap
  insert DB, ditemukan bug baru yang menggagalkan insert-nya — lihat
  **T-139/KI-099** (Prisma interactive transaction timeout saat import
  batch besar). Bug ini ikut menghambat penutupan item verifikasi browser
  tiket ini untuk kasus akun bervolume besar.
- Status tetap 🚫, BELUM Done — perlu akun test dengan volume post lebih
  kecil (agar import selesai dalam waktu wajar) ATAU T-139 diperbaiki dulu,
  supaya kasus nonzero bisa benar-benar diverifikasi di browser.

### T-134 · Snapshot analytics tidak di-recompute saat disconnect (KI-094)

| Field       | Value                                                                                                                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**  | ✅ Done (2026-10-22) — verifikasi E2E browser (T-134.4) PASS dengan akun real, lihat catatan verifikasi di bawah                                                                                                            |
| **Domain**  | workspace · analytics                                                                                                                                                                                                       |
| **ADR**     | **Tidak perlu ADR baru** (direvisi) — tidak ada kontrak Outstand baru, tidak mengubah perilaku `WorkspaceService.disconnectAccount` yang sengaja tidak memanggil Outstand (T-013, ADR-048/ADR-049 tetap berlaku apa adanya) |
| **Spec**    | tidak ada — single-issue                                                                                                                                                                                                    |
| **Docs**    | T-013, ADR-048, ADR-049 (tetap valid, tidak disentuh revisi ini), T-048 (`analytics_list_active_connected_accounts`)                                                                                                        |
| **Terkait** | KI-093/T-130 (gap #2, sama-sama bikin metrics Home tidak akurat, root cause beda), T-133 (blocker)                                                                                                                          |
| **Depends** | —                                                                                                                                                                                                                           |

**Keputusan revisi scope (King Rezi, 2026-10-21):** investigasi lanjutan di
sesi ini membuktikan judul dan root-cause awal tiket ini **keliru**. Dicek
lewat OpenAPI spec resmi Outstand (`https://api.outstand.so/v1/social-accounts/openapi.json`,
live-fetched): satu-satunya endpoint untuk "memutus" akun adalah
`DELETE /v1/social-accounts/{id}`, dan sifatnya **irreversible** — "Cannot be
undone... revokes access entirely... to reconnect, you will need to complete
the full OAuth flow again." Ini **konflik langsung** dengan flow reaktivasi
ADR-127 (`createConnectedAccounts` di
[workspace.repository.ts:1136](../../apps/web/src/lib/repositories/workspace/workspace.repository.ts:1136))
yang menghidupkan kembali row `disconnected`/`reconnect-required` TANPA OAuth
ulang, dengan asumsi `outstandAccountId` lama masih valid di Outstand.

Lebih jauh, dicek via subagent read-only ke kode nyata: job sync harian
(`AnalyticsSyncJobHandler` → `listActiveConnectedAccountsForSync` → SQL
function `analytics_list_active_connected_accounts()`, migration T-048)
**sudah** memfilter `status = 'active' AND reconnect_required = false`
sebelum memanggil `fetchWorkspaceMetrics` — begitu akun di-disconnect di app
kita, job itu **tidak pernah lagi** memanggil Outstand untuk akun itu. Jadi
dugaan awal ("Outstand terus-menerus dihitung karena belum di-disconnect di
sisi Outstand") **salah**. Penyebab sebenarnya: `AnalyticsWorkspaceSnapshot`
adalah cache yang ditulis SAAT akun masih `active`; begitu disconnect, baris
cache lama itu tidak langsung di-recompute, sehingga angka Home/Analyze
"nyangkut" sampai siklus sync berikutnya menimpanya.

**Scope baru, jauh lebih kecil:** `WorkspaceService.disconnectAccount`
memicu recompute `AnalyticsWorkspaceSnapshot` untuk workspace terkait segera
setelah update status DB (reuse `AnalyticsIngestionUseCase.syncWorkspaceSnapshot`
yang sudah ada, bukan tunggu cron harian) — **tidak ada** panggilan Outstand
API, **tidak ada** kontrak baru di `IOutstandAdapter`, **tidak ada** ADR baru.
Opsi "panggil `DELETE` Outstand di tombol Disconnect" ditolak eksplisit oleh
King Rezi karena merusak reaktivasi ADR-127 dan tidak dibutuhkan untuk
memperbaiki gejala yang dilaporkan.

**Pembersihan data terkait (sudah dieksekusi manual, bukan oleh kode T-134):**
King Rezi menghapus 2 akun sosial tersisa langsung lewat dashboard Outstand,
lalu AI menghapus 49 post record yang jadi orphan (`DELETE /v1/posts/{id}`
via tool `delete_post`, org-wide, tidak menyentuh konten live di platform)
pada 2026-10-21 — menutup kebutuhan T-134.4 versi lama (cleanup 3 post test
QA akun `turanilkerl`) secara langsung, bukan lewat kode.

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

**Dampak (direvisi):** angka Home/Analyze sempat menampilkan data akun yang
sudah disconnect sampai siklus recompute berikutnya jalan — bukan "Outstand
menghitung selamanya" seperti dugaan awal. Data residu 49 post (termasuk 3
post test QA `turanilkerl`) sudah dibersihkan manual di luar kode (lihat
Keputusan revisi scope di atas) — bukan lagi bukti bug yang masih terbuka.

- [x] **T-134.1** Tambah entry point public di domain `analytics` (kalau
      belum ada) untuk trigger recompute `AnalyticsWorkspaceSnapshot` satu
      workspace sesuai periode aktif, reuse `AnalyticsIngestionUseCase.syncWorkspaceSnapshot`
      yang sudah dipakai job cron — jangan duplikasi logic
- [x] **T-134.2** `WorkspaceService.disconnectAccount` memanggil entry point
      itu setelah `UPDATE status='disconnected'` sukses; tidak mengubah
      docstring "TIDAK memanggil OutstandAdapter" (masih akurat — ini
      memanggil domain `analytics` internal, bukan Outstand)
- [x] **T-134.3** Test unit: disconnect satu akun memicu recompute snapshot
      workspace itu, dan `totalPosts`/metrics lain tidak lagi menghitung
      kontribusi akun yang baru disconnect pada response berikutnya

**Temuan #1 review Ridwan Architecture Reviewer (2026-10-21) — sudah
diperbaiki:** `disconnectAccountAction` sempat memanggil
`createWorkspaceServiceWithOutstandAdapter()` DI LUAR try/catch — factory itu
throw `ExternalServiceError` (ADR-119) kalau `OUTSTAND_API_KEY` kosong/
invalid, membuat disconnect bisa crash dengan exception tidak tertangani
persis saat Outstand bermasalah — kontradiksi langsung dengan tujuan tiket
ini. Diperbaiki dengan factory baru `createWorkspaceServiceForDisconnect()`
di `apps/web/src/lib/workspace/outstand-workspace-service.ts` yang TIDAK
memanggil `getOutstandAdapter()` sama sekali (hanya menyuplai
`AnalyticsRecomputePort`), dipakai `disconnectAccountAction` di dalam
try/catch. Diverifikasi ulang: `tsc --noEmit` bersih, `eslint` bersih,
`bunx vitest run` tetap 898 passed/0 gagal.

- [x] **T-134.4** Verifikasi end-to-end browser — **terverifikasi
      2026-10-22** (akun real "Cook It Real Good"): disconnect dari UI kita
      langsung membuat angka Home/Analyze update tanpa menunggu cron harian.
      Lihat catatan verifikasi lengkap di bawah.

**Catatan implementasi (2026-10-21, sesi T-130/T-134/T-135/T-136):**

- **Entry point baru** — `EnqueueAnalyticsSyncUseCase.enqueueWorkspaceSnapshot(workspaceId)`
  (`apps/web/src/domains/analytics/services/enqueue-analytics-sync.ts`) —
  reuse `EnqueueAnalyticsSyncJobsPort` yang sudah ada (bukan memanggil
  `syncWorkspaceSnapshot` langsung secara sinkron dari `disconnectAccount`),
  konsisten dengan pola `onAccountConnected` yang sudah meng-enqueue job
  JOB-04 lewat infrastruktur yang sama. Logic enqueue-nya diekstrak ke
  private helper `scheduleWorkspaceSnapshotIfNeeded` supaya tidak duplikasi
  dengan `enqueueForAccounts`.
- **Hook baru** — `AnalyticsRecomputePort.onAccountDisconnected(workspaceId)`
  di `WorkspaceService` (`apps/web/src/domains/workspace/services/workspace.service.ts`,
  pola sama `EngagementSyncSeederPort`/`ImportPostsAutoTriggerPort`), opsional
  di constructor (parameter ke-9). `disconnectAccount` memanggilnya
  SETELAH `repository.disconnectAccount` sukses, dibungkus try/catch
  best-effort (`console.error` kalau gagal, TIDAK melempar ulang) — gagal
  enqueue job background tidak membatalkan disconnect yang sudah commit ke DB.
  Diwire di composition root `createWorkspaceServiceWithOutstandAdapter()`
  (`apps/web/src/lib/workspace/outstand-workspace-service.ts`). Server Action
  `disconnectAccountAction` (`apps/web/src/app/(app)/settings/connected-accounts/actions.ts`)
  diubah dari `new WorkspaceService(workspaceRepository)` polos jadi
  `createWorkspaceServiceWithOutstandAdapter()` supaya port ini benar-benar
  tersambung (file ini sudah mewajibkan `OUTSTAND_API_KEY` untuk action lain
  di halaman yang sama, jadi tidak menambah dependency env var baru).
- **Gap kritis 0-akun (ditemukan saat implementasi, di luar checklist awal
  tiket, sudah diperbaiki)** — `AnalyticsSyncJobHandler.syncWorkspace`
  sebelumnya **throw** kalau tidak ada akun aktif tersisa di workspace,
  sehingga job recompute yang di-enqueue saat disconnect akun TERAKHIR akan
  selalu gagal dan snapshot lama tidak pernah ter-reset ke nol — membuat
  tujuan T-134 gagal tercapai justru untuk kasus paling umum. Diperbaiki:
  `syncWorkspace` sekarang tetap upsert snapshot NOL untuk kasus ini
  (`accounts: []` ke `AnalyticsIngestionUseCase.syncWorkspaceSnapshot`,
  totals otomatis nol tanpa panggilan Outstand sama sekali karena
  `mapWithConcurrency` atas array kosong). Acting user RLS untuk kasus ini
  diresolve lewat method baru `IWorkspaceRepository.findWorkspaceOwnerUserId`
  (baca `Workspace.ownerId` langsung, tabel ini bukan RLS-protected) sebagai
  fallback KHUSUS saat 0 akun aktif — behavior lama (throw) untuk kasus lain
  (race/anomali data saat akun masih ada tapi owner tidak ketemu) TIDAK
  berubah.
- **File yang diubah:** `apps/web/src/domains/analytics/services/enqueue-analytics-sync.ts`,
  `apps/web/src/domains/analytics/services/analytics-sync-job-handler.ts`,
  `apps/web/src/domains/workspace/services/workspace.service.ts`,
  `apps/web/src/domains/workspace/repositories/workspace.repository.ts`
  (port `findWorkspaceOwnerUserId`), `apps/web/src/lib/repositories/workspace/workspace.repository.ts`
  (implementasi Prisma), `apps/web/src/lib/workspace/outstand-workspace-service.ts`
  (wiring), `apps/web/src/app/(app)/settings/connected-accounts/actions.ts`
  (switch composition root).
- **Test:** 7 test baru (2 di `enqueue-analytics-sync.test.ts`, 2 di
  `analytics-sync-job-handler.test.ts` untuk gap 0-akun, 3 di
  `workspace.service.test.ts` untuk hook disconnect) — seluruhnya PASS.
  Full suite repo (`bunx vitest run`): **898 passed, 7 skipped, 0 fail**.
  `tsc --noEmit` bersih, `eslint` bersih untuk seluruh file yang diubah.

**QA (Najwa QA Engineer, 2026-10-21):** verifikasi independen Temuan #1
Ridwan — dibaca langsung `apps/web/src/app/(app)/settings/connected-accounts/actions.ts`
(`disconnectAccountAction`) dan `apps/web/src/lib/workspace/outstand-workspace-service.ts`
(`createWorkspaceServiceForDisconnect`): dikonfirmasi factory baru dipanggil
DI DALAM try/catch (baris 86), dan factory itu sendiri **tidak** memanggil
`getOutstandAdapter()` sama sekali (hanya `workspaceRepository` +
`AnalyticsRecomputePort` via `EnqueueAnalyticsSyncUseCase`) — fix Temuan #1
valid. RBAC `assertActorCanManageConnectedAccounts` (Owner/Admin only) di
`WorkspaceService.disconnectAccount` tidak tersentuh perubahan ini — tidak
ada regresi RBAC. Best-effort `analyticsRecompute?.onAccountDisconnected`
dibungkus try/catch dengan `console.error`, tidak melempar ulang — sesuai
klaim "tidak membatalkan disconnect".

Test suite ulang (root, `bunx vitest run`): 898 passed, 7 skipped, 0 fail.
`tsc --noEmit` dan `eslint .` (`apps/web`) bersih.

**Verifikasi browser (checklist yang BISA dilakukan — Outstand workspace
kosong, 0 akun):**

- [x] Login akun test (Raka Pratama, Owner, `raka.test@kopiselasar.com`)
      via `localhost:3000` langsung (ADR-070) — session/cookie terbaca
      normal, tidak perlu ngrok.
- [x] Halaman Home (`/`) render tanpa error console/network dengan data
      kosong — "Post terpublikasi" 0, "Total engagement" 0, "Akun aktif" 0,
      "Rata-rata engagement rate" 0.0%.
- [x] Halaman Settings → Connected Accounts render state kosong ("Belum ada
      akun terhubung") tanpa crash, tombol "Connect Account" membuka dropdown
      8 platform tanpa error — regresi fungsi Connect (file yang sama,
      masih pakai `createWorkspaceServiceWithOutstandAdapter()`) PASS untuk
      sejauh yang bisa diuji tanpa OAuth real.
- [ ] **TIDAK BISA dilakukan:** klik tombol Disconnect sungguhan (tidak ada
      akun terhubung untuk didisconnect), jadi end-to-end trigger recompute
      snapshot (T-134.4) tetap **TERTUNDA** seperti sudah dicatat — bukan
      kegagalan QA, murni keterbatasan lingkungan (workspace Outstand
      King Rezi kosong di sesi ini).
- [ ] Tidak mencoba klik salah satu platform di dropdown Connect Account
      sampai redirect OAuth real (di luar scope aman untuk dicoba otomatis
      oleh QA — butuh kredensial platform sungguhan).

**Status final (Gibran Project Manager, 2026-10-21):** scope revisi (recompute
snapshot, tanpa panggilan Outstand) sudah diimplementasikan penuh, temuan
review Ridwan sudah diperbaiki, QA Najwa PASS untuk semua yang bisa diuji
tanpa akun terhubung. Tiket ini **belum** ✅ Done penuh — T-134.4 (klik
Disconnect sungguhan lalu verifikasi recompute) butuh minimal satu akun
terhubung di workspace test, yang saat ini kosong. Status diset 🚫, bukan ✅,
sampai ada akun test baru.

**Verifikasi E2E T-134.4 (King Rezi + AI, 2026-10-22, akun real "Cook It
Real Good", read-only):** akun YouTube `@cookitrealgood`
(connectedAccountId `2bc44ed1-3cf5-4866-b677-ceb19cb1d944`) di-disconnect
sungguhan dari UI Settings → Connected Accounts jam 08:01 UTC. Dikonfirmasi
via query `background_jobs`: row baru
`id=ba3221e6-e9f2-4e89-81b7-071fbc20ff98`, `type='analytics.sync'`,
`payload.scope='workspace'`, `created_at='2026-10-22 08:01:35.545+00'` —
muncul OTOMATIS tepat saat disconnect (tanpa trigger manual), konsisten
dengan hook `onAccountDisconnected` → `EnqueueAnalyticsSyncUseCase.enqueueWorkspaceSnapshot`.
Setelah job itu diproses (manual trigger `/api/jobs/run?type=analytics`
karena di local tidak ada cron Railway yang jalan otomatis — bukan bagian
dari behavior yang diuji, murni cara menjalankan job yang sudah
ter-enqueue), snapshot `analytics_workspace_snapshots` row
`e2372e6a-4703-4c2e-b38d-704b9a7cf542` ter-upsert ulang dengan data segar
(total_reach 9505→9508, akun aktif Home 4→3) — bukti recompute benar-benar
jalan, bukan cuma status disconnect berubah. T-134.4 dicentang PASS.

**Catatan operasional penting:** akun YouTube `@cookitrealgood` **sengaja
dibiarkan disconnected** setelah testing ini (keputusan eksplisit King Rezi:
"Biarkan disconnected dulu") karena reconnect butuh OAuth Google sungguhan
yang tidak dilanjutkan sesi ini — bukan residual bug, murni keputusan
operasional. Siapapun yang membuka tiket/workspace ini nanti perlu tahu
YouTube `@cookitrealgood` statusnya disconnected di workspace test sampai
direconnect manual.

**Status final (update 2026-10-22):** seluruh checklist T-134 selesai dan
terverifikasi end-to-end dengan akun real. Tiket ditutup **✅ Done**.

### T-135 · Definisi periode "bulanan" Home/Analyze beda dari kalender Outstand (KI-095)

| Field       | Value                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| **Status**  | ✅ Done (2026-10-22) — verifikasi browser (T-135.4) PASS, lihat catatan verifikasi dengan akun real di bawah |
| **Domain**  | analytics                                                                                                    |
| **ADR**     | — (kemungkinan perlu keputusan produk soal definisi window, bukan arsitektur — lihat T-135.1)                |
| **Spec**    | tidak ada — single-issue                                                                                     |
| **Docs**    | T-128/T-129 (default view Bulanan Home/Analyze)                                                              |
| **Terkait** | T-134, T-136, T-130 (batch investigasi sama, 2026-10-21), T-133 (blocker)                                    |
| **Depends** | —                                                                                                            |

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

- [x] **T-135.1** King Rezi memutuskan (via `AskUserQuestion`, 2026-10-21):
      pindah ke **kalender bulan** (tanggal 1 s.d. akhir bulan, sama seperti
      Outstand) — bukan rolling 30 hari
- [x] **T-135.2** Implementasi sesuai keputusan T-135.1 di
      `resolveAnalyticsSnapshotWindow` (dan tempat lain yang reuse fungsi ini,
      cek pemanggil)
- [x] **T-135.3** Test unit untuk window baru (termasuk edge case: hari
      pertama bulan, bulan dengan 28/29/30/31 hari kalau pindah ke kalender
      bulan)
- [x] **T-135.4** Verifikasi browser: angka "bulan ini" Home/Analyze cocok
      dengan ekspektasi window yang dipilih — **terverifikasi 2026-10-22**
      via query SQL langsung, lihat catatan verifikasi di bawah

**Catatan implementasi (Prabowo, 2026-10-21):**

- File yang diubah:
  `apps/web/src/domains/analytics/services/analytics-sync-job-handler.ts`
  (cabang `monthly` di `resolveAnalyticsSnapshotWindow`, baris ~147-171) dan
  `apps/web/src/domains/analytics/services/analytics-sync-job-handler.test.ts`
  (test case baru untuk window `monthly`).
- Behavior baru: `monthly` sekarang kalender bulan — `periodStart` = tanggal
  1 bulan berjalan jam 00:00:00 UTC, `periodEnd` tetap `now` (saat job
  jalan), **bukan** dimajukan ke akhir bulan kalau bulan belum selesai.
  `weekly` tidak diubah, tetap rolling 7 hari.
- Grep ulang `resolveAnalyticsSnapshotWindow` di seluruh `apps/web/src`
  mengonfirmasi hanya satu pemanggil (`syncWorkspace`,
  `analytics-sync-job-handler.ts:279`) — investigasi sebelumnya akurat,
  tidak ada pemanggil lain yang kebobolan.
  - Test: `bunx vitest run analytics-sync-job-handler.test.ts` → 13 passed
    (6 test baru untuk `monthly`: kalender bulan umum, hari pertama bulan,
    31/30/28/29 hari). `bun run typecheck` dan `eslint` pada kedua file
    bersih.
  - T-135.4 (verifikasi browser angka "bulan ini" Home/Analyze) belum
    dilakukan di sesi ini — snapshot baru baru berlaku untuk job sync
    berikutnya (snapshot lama di DB masih pakai window rolling 30 hari
    sampai job `analytics.sync` jalan ulang); perlu keputusan apakah
    snapshot lama perlu di-backfill/invalidasi atau cukup menunggu cron
    berikutnya menimpa baris `[workspaceId, period, periodStart]` yang baru.

**QA (Najwa QA Engineer, 2026-10-21):** dibaca langsung
`resolveAnalyticsSnapshotWindow` (`analytics-sync-job-handler.ts`) —
konfirmasi cabang `monthly` memakai `Date.UTC(now.getUTCFullYear(),
now.getUTCMonth(), 1, 0, 0, 0, 0)` untuk `periodStart` dan `periodEnd = now`
apa adanya (tidak dimajukan ke akhir bulan), sesuai klaim implementasi.
Test suite ulang: 898 passed, 7 skipped, 0 fail (termasuk
`analytics-sync-job-handler.test.ts`). T-135.4 (verifikasi browser angka
"bulan ini") **tetap belum bisa dieksekusi** — sama alasan T-130/T-136,
workspace Outstand kosong, dan snapshot lama di DB production/dev belum
tentu sudah di-overwrite job cron berikutnya (di luar scope backfill QA).

**Backfill operasional (dieksekusi manual oleh coordinator, 2026-10-21,
bukan oleh kode T-135):** pertanyaan terbuka di catatan implementasi di atas
("apakah snapshot lama perlu di-backfill/invalidasi") sudah dijawab King
Rezi — **backfill segera**, bukan menunggu siklus cron alami. Snapshot
`AnalyticsWorkspaceSnapshot` untuk seluruh 13 workspace sudah dijalankan
ulang manual dan per 2026-10-21 sudah memakai formula window baru (kalender
bulan). Lihat juga § T-134 untuk pembersihan data residu yang dieksekusi di
sesi yang sama.

**Status final (Gibran Project Manager, 2026-10-21):** perubahan window
kalender bulan sudah diimplementasikan, diuji (6 test baru), direview
(Ridwan PASS), dan diverifikasi kode (Najwa PASS), plus backfill operasional
13 workspace sudah dieksekusi — jadi snapshot production tidak lagi
"menunggu" formula lama. Tiket ini **belum** ✅ Done penuh — T-135.4
(verifikasi browser angka "bulan ini" dengan data post nyata) tetap
tertunda karena workspace test Outstand kosong. Status diset 🚫, bukan ✅,
sampai ada akun test baru.

**Verifikasi T-135.4 (King Rezi + AI, 2026-10-22, akun real "Cook It Real
Good"):** diverifikasi via query SQL langsung ke
`analytics_workspace_snapshots` (Supabase project yang sama dipakai staging
& local): row `id=e2372e6a-4703-4c2e-b38d-704b9a7cf542`, `period='monthly'`,
`period_start='2026-10-01'`, `period_end='2026-10-22'` — persis kalender
bulan (tanggal 1 s.d. hari ini), BUKAN rolling 30 hari (row lama sejenis
punya `period_start='2026-09-21'`/`'2026-09-22'`, pola "now minus 30 hari").
Dikonfirmasi dengan data real (bukan fixture/test). T-135.4 dicentang PASS.

**Status final (update 2026-10-22):** seluruh checklist T-135 selesai dan
terverifikasi dengan data real. Tiket ditutup **✅ Done**.

### T-136 · Ambiguitas semantik label "Post terpublikasi" Home (KI-096)

| Field       | Value                                                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**  | 🚫 Implementasi selesai (ikut T-130, review + QA PASS) — blocked verifikasi browser (T-136.3), butuh akun test Outstand baru                              |
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

- [x] **T-136.1** King Rezi memutuskan (via `AskUserQuestion`, 2026-10-21):
      ganti sumber data, ikut T-130 (DB internal) — bukan ganti label teks
      saja
- [x] **T-136.2** Implementasi sesuai keputusan T-136.1 di `DashboardHome.tsx`
      dan/atau `AnalyticsService.getDashboardSummary`
- [ ] **T-136.3** Verifikasi browser: label dan angka konsisten secara makna
      (tidak ada lagi "Post terpublikasi" yang sebenarnya termasuk post dari
      akun disconnected/native) — **belum dilakukan**, sama alasan dengan
      T-130 (butuh workspace dengan data nyata)

**Catatan implementasi (Prabowo Feature Engineer, 2026-10-21):**

T-136.2 selesai TANPA perubahan kode UI — implementasi T-130 (lihat § T-130
"Implementasi") sudah cukup: `summary.totalPosts` yang dikonsumsi
`DashboardHome.tsx:157-158` (`StatTile label="Post terpublikasi"`) sekarang
mengalir dari `TerminalPostsCountPort.countTerminalPosts` (status internal
`PublishingPost`: `Published`/`Failed`/`Imported`, dan efektif
`Published`+`Imported` saja karena `publishedAt` post `Failed` di-null-kan —
lihat catatan granularitas di § T-130), BUKAN lagi dari `posts_count`
Outstand. Jadi label "Post terpublikasi" sekarang akurat secara makna: tidak
lagi bisa kebawa post native/akun disconnected dari Outstand (itu gap T-134
yang terpisah dan sudah tidak relevan untuk `totalPosts` karena sumbernya
sudah bukan Outstand sama sekali). Tidak ada file `DashboardHome.tsx` atau
`AnalyticsService.getDashboardSummary` yang perlu diubah — keduanya sudah
generik (`summary.totalPosts` apa adanya), gap-nya murni di sumber data
`syncWorkspaceSnapshot` yang sudah diperbaiki di T-130. T-136.3 (verifikasi
browser) belum dieksekusi, sama seperti T-130 — dicatat sebagai follow-up,
bukan diasumsikan selesai.

**QA (Najwa QA Engineer, 2026-10-21):** verifikasi independen klaim "T-136.2
selesai TANPA perubahan kode UI" — dibaca langsung
`apps/web/src/app/(app)/components/DashboardHome.tsx` baris 157-158:
`label="Post terpublikasi"` dan `value={summary.totalPosts.toLocaleString("id-ID")}`
memang tidak berubah (tidak ada file `.tsx` yang terdiff di working tree
untuk keempat tiket ini — `git status` dikonfirmasi tidak ada perubahan
`.tsx`/`components/ui`). Karena tidak ada kode UI baru yang
diimplementasikan, langkah wajib DesignSync (AGENTS.md rule 10/T-103.3)
tidak applicable untuk QA sesi ini. T-136.3 (verifikasi browser label vs
angka) **tetap belum bisa dieksekusi** — sama keterbatasan lingkungan
(workspace Outstand kosong) seperti T-130/T-135.

**Rekomendasi status akhir (keempat tiket):** implementasi, test otomatis,
dan review kode PASS — siap lanjut ke tahap dokumentasi final Gibran Project
Manager. Checklist "Verifikasi browser dengan data real" (T-130 item
terakhir, T-134.4, T-135.4, T-136.3) tetap dicatat **terbuka/tertunda**
karena limitasi lingkungan (Outstand workspace kosong), bukan kegagalan QA
— perlu di-follow-up setelah ada akun test baru di-reconnect.

**Status final (Gibran Project Manager, 2026-10-21):** T-136.2 terbukti
sengaja tidak menyentuh kode UI (hanya mewarisi fix sumber data T-130),
diverifikasi independen QA. Tiket ini **belum** ✅ Done penuh — T-136.3
tertunda karena alasan eksternal yang sama dengan T-130/T-134/T-135. Status
diset 🚫, bukan ✅.

**Progress sesi verifikasi E2E 2026-10-22 (King Rezi + AI, akun real "Cook It
Real Good"):** T-136.3 terikat erat dengan T-130 (label "Post terpublikasi"
mengikuti sumber data `totalPosts` yang sama) — progress dan blocker-nya
identik, lihat catatan lengkap di § T-130 "Progress sesi verifikasi E2E
2026-10-22". Ringkas: Home menampilkan "Post terpublikasi: 0" konsisten
dengan sumber data DB internal untuk kasus Facebook `posts_count: null`,
tapi kasus nonzero riil belum berhasil diverifikasi karena import akun
besar (Instagram 1503 post) belum selesai diproses Outstand, dan ditemukan
bug baru **T-139/KI-099** yang menggagalkan insert DB untuk batch import
besar. Status tetap 🚫, BELUM Done.

**Keputusan dokumentasi batch (Gibran Project Manager, 2026-10-21):**

- Keempat tiket (T-130, T-134, T-135, T-136) substansinya (root-cause fix,
  implementasi, test otomatis, review Ridwan, QA Najwa) **tuntas** — status
  di masing-masing diset 🚫 (bukan ✅ Done, bukan 🟡), karena satu-satunya
  sisa pekerjaan di tiap tiket adalah verifikasi E2E browser yang terhambat
  faktor eksternal (tidak ada akun test Outstand di workspace King Rezi),
  bukan bug atau pekerjaan kode yang belum selesai.
- **Blocker T-133 TETAP tertutup (tidak dibuka)** — syarat yang tertulis
  eksplisit di `v02-publishing-mvp.md` § T-133 ("Begitu keempatnya ✅ Done,
  status tiket ini kembali ke 🚫 Sebagian siap") belum terpenuhi secara
  literal karena keempat tiket ini belum berstatus ✅ Done (masih 🚫,
  menunggu akun test). Begitu akun test Outstand baru tersedia dan
  T-130.292/T-134.4/T-135.4/T-136.3 lolos verifikasi browser, keempat tiket
  ini bisa langsung ditutup ✅ Done dan blocker T-133 dibuka tanpa perlu
  investigasi ulang — tidak ada pekerjaan kode tersisa.
- Keputusan definisi produk dari King Rezi yang mengubah metric/window
  user-facing (sumber `totalPosts` Home pindah ke status internal
  `PublishingPost`, window "bulanan" pindah ke kalender bulan, granularitas
  Home vs Analyze diterima berbeda) dicatat sebagai **ADR-136** —
  lihat `DECISIONS.md` dan `decisions/ADR-136-redefinisi-totalpost-window-bulanan-home-analytics.md`.
  Opsi "panggil Outstand DELETE saat disconnect" yang ditolak King Rezi
  (lihat § T-134 "Keputusan revisi scope") TIDAK memerlukan ADR terpisah —
  tidak ada kontrak baru dibuat, dan ADR-048/ADR-049 (disconnect tidak
  memanggil Outstand) tetap berlaku apa adanya, tidak diamendemen.

**Update status batch (Gibran Project Manager, 2026-10-22):** akun test
Outstand real ("Cook It Real Good", 4 channel) akhirnya tersedia dan dipakai
untuk sesi verifikasi E2E hari ini. Hasilnya **2 dari 4 tiket** berhasil
ditutup penuh: **T-134 ✅ Done**, **T-135 ✅ Done** (lihat catatan verifikasi
masing-masing di atas). **T-130 dan T-136 TETAP 🚫**, belum Done — root
cause `posts_count: null` untuk Facebook terkonfirmasi ulang dengan akun
real, tapi kasus nonzero riil (dibutuhkan untuk verifikasi browser yang
meyakinkan) belum bisa diperoleh karena Outstand sangat lambat memproses
import akun besar, dan ditemukan bug baru **T-139/KI-099** (Prisma
interactive transaction timeout saat insert batch import besar) yang ikut
menghambat. Blocker **T-133** karenanya TETAP tertutup — syarat "keempat
tiket ✅ Done" baru terpenuhi separuh, lihat `AVAILABLE_TICKETS.md` § T-133
untuk status terbaru.

### T-139 · Prisma interactive transaction timeout saat import post batch besar (KI-099)

| Field       | Value                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| **Status**  | 🟡 Implementasi + test selesai (2026-10-23), sisa T-139.4 verifikasi akun real bervolume besar                   |
| **Domain**  | publishing                                                                                                       |
| **Spec**    | tidak ada — single-issue                                                                                         |
| **Docs**    | tidak ada                                                                                                        |
| **Terkait** | T-133 (blocker backfill), T-115 (job import periodik), ditemukan saat sesi QA T-130/T-134/T-135/T-136 2026-10-22 |
| **Depends** | —                                                                                                                |

**Ditemukan (King Rezi + AI, 2026-10-22, sesi verifikasi E2E T-130/T-134/
T-135/T-136, akun real "Cook It Real Good"):** proses `import.sync` untuk
akun TikTok real dengan volume post besar (akun `vs7ig`, connectedAccountId
`c0624627-84a2-4a9c-b4e5-b90e7c098202`), saat akhirnya Outstand selesai
memproses import dan use-case kita mencoba menulis hasilnya ke DB.

**Error persis:**

```
Invalid tx.publishingPost.create() invocation ... Transaction API error: A
query cannot be executed on an expired transaction. The timeout for this
transaction was 5000 ms, however 5381 ms passed since the start of the
transaction. Consider increasing the interactive transaction timeout or
doing less work in the transaction.
```

Terjadi di fungsi `createImportedPost`
(`apps/web/src/lib/repositories/publishing/upsert-imported-posts.ts`, baris
~367 — pemanggil `tx.publishingPost.create()`), dipanggil dalam satu
interactive transaction Prisma per-batch upsert import lewat
`upsertImportedPostsTx` (fungsi yang sama, dipanggil dari
`IPublishingRepository.upsertImportedPosts` → implementasi Prisma
`apps/web/src/lib/repositories/publishing/publishing.repository.ts:1245-1252`,
`withCurrentUser(actingUserId, (tx) => upsertImportedPostsTx(tx, workspaceId, posts))`).

**Dampak:** import akan GAGAL (job balik ke status pending/retry lalu
akhirnya failed permanen setelah `max_attempts`) untuk akun dengan jumlah
post besar yang butuh waktu insert >5 detik per transaksi — relevan
langsung untuk **T-133.2** (re-trigger import 1 tahun ke belakang untuk akun
existing, berpotensi banyak post) dan untuk akun real manapun yang baru
connect dengan riwayat panjang (mis. Instagram 1503 post yang dipakai sesi
ini, yang juga belum selesai diimport sampai akhir sesi — kemungkinan akan
kena bug yang sama begitu Outstand selesai memprosesnya).

**Perbaikan yang perlu dicek (BUKAN diputuskan/dieksekusi sesi ini, hanya
dicatat sebagai arah):**

- Naikkan opsi `timeout` interactive transaction Prisma di pemanggilan
  `upsertImportedPosts`/`upsertImportedPostsTx` (default Prisma 5000ms
  terlalu pendek untuk batch besar).
- ATAU pecah batch import jadi beberapa transaksi lebih kecil alih-alih satu
  transaksi besar untuk seluruh batch.

- [x] **T-139.1** Arah perbaikan diputuskan King Rezi (2026-10-23): pecah
      batch (chunk per transaksi). All-or-nothing per batch hilang, jadi
      per chunk — aman karena `upsertImportedPostsTx` idempoten (dedup
      `connectedAccountId`+`platformPostId` dan `outstandPostId`) dan
      watermark baru dimajukan setelah `process()` sukses penuh
      (`import-posts-trigger.use-case.ts`), jadi retry hanya menghitung
      ulang chunk yang sudah commit sebagai duplikat
- [x] **T-139.2** Implementasi: `upsertImportedPostsInChunks` +
      `UPSERT_IMPORTED_POSTS_CHUNK_SIZE` (50) di
      `lib/repositories/publishing/upsert-imported-posts.ts`;
      `PublishingRepository.upsertImportedPosts` menjalankan satu
      `withCurrentUser` per chunk dengan `timeout` 15 detik
      (`UPSERT_IMPORTED_POSTS_TX_TIMEOUT_MS`, pengaman, bukan pengganti
      chunking). `withCurrentUser` menerima opsi `{ timeout }` opsional
- [x] **T-139.3** Test: `upsert-imported-posts.test.ts` — batch kosong, ukuran
      chunk, default size, error menghentikan chunk berikutnya, batch 230
      post lewat 5 transaksi dengan jumlah query per transaksi dibatasi,
      import ulang idempoten, dedup lintas chunk, dan chunk gagal
      (chunk sebelumnya commit, retry menyelesaikan sisa). Suite penuh 925
      passed, typecheck dan lint bersih. Keterbatasan: DB simulasi, durasi
      nyata terhadap Postgres hanya terbukti di T-139.4
- [ ] **T-139.4** Verifikasi dengan akun real bervolume besar (Instagram
      `cookitrealgood` 1503 post atau TikTok `vs7ig` yang memicu bug ini
      masih tersedia sebagai akun test) — **belum dilakukan**

**Catatan:** tiket ini dibuat terpisah dari T-130/T-134/T-135/T-136 karena
scope-nya infrastruktur import secara umum (job `import.sync`), bukan
spesifik ke empat tiket analytics batch itu — tapi ditemukan dan dicatat di
sesi QA yang sama (2026-10-22).

### T-140 · Infinite redirect loop `/` ↔ `/login` saat session cookie stale/invalid (KI-100)

| Field       | Value                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**  | ✅ Done — fix diimplementasikan, test regresi ditambahkan (919 passed, 0 fail), King Rezi konfirmasi `localhost:3000` bisa dibuka lagi |
| **Domain**  | workspace · auth (`proxy.ts`)                                                                                                          |
| **Spec**    | tidak ada — single-issue                                                                                                               |
| **Docs**    | tidak ada                                                                                                                              |
| **Terkait** | ADR-076 (proxy.ts, migrasi `[slug]` → `(app)`), ditemukan King Rezi 2026-10-22                                                         |
| **Depends** | —                                                                                                                                      |

**Ditemukan (King Rezi, 2026-10-22):** `bun dev` lokal + buka
`http://localhost:3000/` di browser biasa (bukan Browser pane sesi ini) →
`ERR_TOO_MANY_REDIRECTS` ("localhost redirected you too many times").
Dikonfirmasi lewat tab Network DevTools: redirect 307 bolak-balik murni
antara `/` dan `/login`, berulang puluhan kali sampai Chrome menyerah.

**Root cause:** `apps/web/src/proxy.ts` — gate murah
`hasSessionCookie = Boolean(getSessionCookie(request))` (baris ~124) hanya
mengecek **keberadaan** cookie, bukan validitasnya. Alur yang terjadi:

1. `/` → `hasSessionCookie` true, bukan `isPublicAuthPage` → lanjut ke
   validasi penuh `auth.api.getSession()` (baris ~152) → `null` (cookie ada
   tapi SESSION-nya sudah tidak valid lagi — mis. baris `identity_session`
   kedaluwarsa/dihapus/dirotasi) → `redirectTo("/login")`.
2. `/login` → `hasSessionCookie` masih true (cookie fisik belum dihapus) DAN
   `isPublicAuthPage` true → `redirectTo("/")` (baris ~130-132).
3. Kembali ke `/` → sama persis seperti langkah 1 (cookie masih di browser,
   session masih invalid) → loop tanpa akhir.

Komentar kode di baris ~134-144 proxy.ts sendiri sudah mendokumentasikan gap
serupa untuk kombinasi `!hasSessionCookie && isPublicAuthPage` (sudah
ditutup) — tapi TIDAK menutup kombinasi "cookie ada tapi session di DB sudah
invalid", yang ternyata adalah skenario yang benar-benar terjadi di sesi ini
(kemungkinan dipicu oleh pembersihan data/testing berat sepanjang sesi
2026-10-21/22 yang menyentuh banyak baris DB, meski belum dikonfirmasi
baris `identity_session` spesifik mana yang invalid).

- [x] **T-140.1** Saat `auth.api.getSession()` di proxy.ts mengembalikan
      `null` untuk cookie yang ADA (bukan kombinasi lain yang sudah
      ditangani), hapus cookie session Better Auth di response redirect ke
      `/login` — pakai nama cookie yang di-resolve dari `getCookies(auth.options).sessionToken.name`
      (`better-auth/cookies`), BUKAN hardcode string, supaya tidak drift
      kalau `cookiePrefix`/`useSecureCookies` berubah nanti. Diimplementasikan
      lewat helper baru `apps/web/src/lib/better-auth/session-cookie-name.ts`
      (`getSessionCookieName()`) + fungsi `redirectToLoginClearingStaleSession()`
      di `proxy.ts`, dipakai di cabang `if (!session)` setelah validasi penuh
- [x] **T-140.2** Terapkan perbaikan serupa di
      `apps/web/src/app/onboarding/resume/route.ts` (cabang `!session`) untuk
      defense-in-depth — route ini bisa diakses langsung (dibypass proxy
      untuk prefix `/onboarding`) dengan cookie session stale yang sama.
      Diimplementasikan (hapus cookie sebelum redirect ke `/login`)
- [x] **T-140.3** Test: skenario cookie session ada tapi invalid
      (`auth.api.getSession` resolve `null`) tidak menghasilkan redirect
      balik ke halaman yang sama. Ditambahkan test baru di
      `apps/web/src/proxy.test.ts` ("clears the stale session cookie when
      redirecting to /login") — assert `response.cookies.get(...)` untuk
      nama cookie session kembali dengan `value: ""` dan `expires` di masa
      lalu, membuktikan cookie benar-benar dihapus (bukan cuma redirect
      tujuannya benar seperti test lama yang sudah ada sebelumnya). Full
      suite: **919 passed, 7 skipped, 0 fail** (naik dari 898 baseline
      sebelum T-140 + 1 test baru ini); `tsc --noEmit` dan `eslint .`
      (`apps/web`) bersih
- [x] **T-140.4** Verifikasi browser langsung oleh King Rezi di environment
      yang melaporkan bug ini (local `bun dev`) — dikonfirmasi King Rezi
      2026-10-22: `localhost:3000` bisa dibuka lagi setelah fix (hot-reload
      otomatis Next.js dev server). Catatan: ini konfirmasi akses normal
      kembali, BUKAN reproduksi ulang skenario cookie-stale-spesifik untuk
      membuktikan loop benar-benar tidak muncul lagi pada kasus itu persis
      (lihat gap T-140.3 di atas)

**Catatan:** ini BUG PRODUKSI (bukan limitasi test data seperti T-130/T-139)
— siapa pun yang punya session cookie stale (expired naturally, logout dari
tab lain, DB session dibersihkan manual) akan mengalami ini, bukan hanya di
local dev. Prioritas tinggi karena mengunci akses ke seluruh aplikasi tanpa
cara recover selain hapus cookie manual.
