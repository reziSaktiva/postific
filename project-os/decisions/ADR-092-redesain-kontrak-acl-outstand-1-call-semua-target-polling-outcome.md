## Decision ADR-092

### Title

Redesain Kontrak ACL Outstand — 1-Call-Semua-Target + Polling Outcome

### Status

Accepted

### Date

2026-08-26

### Context

Setelah membaca dokumentasi resmi Outstand API (create-a-post,
get-post-details, list-posts, get-post-analytics, dan post-lifecycle),
ditemukan mismatch dengan kontrak ACL `IOutstandAdapter` yang ada sebelumnya
(dan dengan model publish di `integration-layer.md` sebelum amandemen ini):

1. `create-a-post` menerima SEMUA akun target dalam SATU call
   (`accounts: array<string>`) dan menghasilkan SATU `post.id` — bukan satu
   job per akun seperti yang diasumsikan kode lama (`schedulePost`/
   `publishNow` dipanggil per target dengan `Promise.all`).
2. Response `create-a-post` TIDAK mengonfirmasi hasil publish per akun
   secara sinkron — bahkan untuk publish langsung tanpa jadwal. Status per
   akun (`status`, `error`, `platformPostId`, `platformPostUrl`,
   `publishedAt`) baru tersedia lewat `get-post-details`/`list-posts`
   (async) atau webhook.
3. Dokumentasi `post-lifecycle` mengonfirmasi status per-akun resmi:
   `'pending' | 'published' | 'failed'`, partial success didukung resmi
   ("A post can partially succeed — some accounts may publish while others
   fail"), webhook `post.published` terpicu kalau minimal 1 akun sukses,
   `post.error` kalau SEMUA akun gagal.
4. `repost-a-post-to-social-networks` bukan retry — itu reshare post yang
   sudah published. **Tidak ada endpoint retry resmi** — dokumentasi
   Outstand sendiri merekomendasikan: kalau publish gagal karena transient
   error, hapus post yang gagal (`delete-a-post-from-social-networks`) lalu
   buat post baru (`create-a-post`) — bukan retry job yang sama. **Relevan
   untuk T-034.4** (Aksi retry manual untuk target yang gagal) — retry
   manual nanti harus mengikuti pola delete+recreate ini, bukan re-trigger
   generik.

### Decision

1. `IOutstandAdapter.schedulePost`/`publishNow` diredesain menjadi SATU call
   yang menerima `targets: OutstandPostTargetInput[]` (semua akun tujuan
   sekaligus) dan mengembalikan SATU `outstandPostId` — bukan lagi
   `publishedUrl` instan per akun.
2. Method baru `fetchPostOutcome(outstandPostId): Promise<PostTargetOutcome[]>`
   ditambahkan untuk resolve status per akun BELAKANGAN (polling sekarang,
   webhook T-026 nanti tanpa rework kontrak).
3. `schedulePost` dan `publishNow` TETAP dua method domain terpisah (bukan
   digabung jadi satu, walau di Outstand asli itu endpoint yang sama
   dibedakan `scheduledAt` opsional) — beda RBAC (Publish Now lebih
   berisiko, tanpa jeda koreksi), beda kebutuhan outcome instan (Publish Now
   memanggil `fetchPostOutcome` segera setelah publish; Schedule menunggu
   T-026/T-027 nanti), dan beda relevansi Cancel Schedule (hanya untuk hasil
   `schedulePost`). Kesamaan endpoint HTTP Outstand disembunyikan di
   implementasi ACL (real adapter, T-025), bukan bocor ke domain — ini
   justru fungsi ACL yang sebenarnya.
4. `cancelScheduledPost(outstandPostId)` sekarang dipanggil SEKALI per post
   (bukan per target) — konsisten dengan model 1-post-banyak-target.
5. Schema Prisma:
   - `PublishingPost` mendapat kolom `outstandPostId` (post-level, dari
     `schedulePost`/`publishNow`).
   - `PublishingPostTarget.outstandJobId` dan `.publishedUrl` DIHAPUS,
     diganti `.platformPostId`/`.platformPostUrl` (ID/URL platform asli per
     akun, diisi async dari `fetchPostOutcome`/webhook nanti). Default
     status kolom `pending` (bukan lagi berasumsi sinkron).
   - Migration `20260826092111_redesign_outstand_acl_contract` men-drop
     kolom lama tanpa migrasi data — seluruh isi kolom itu di semua
     environment adalah placeholder `FakeOutstandAdapter` (ADR-059), belum
     ada integrasi Outstand nyata di manapun (T-025 belum dikerjakan).
   - Sudah di-apply ke DB dev, `prisma migrate diff` "No difference
     detected".
6. `IPublishingRepository.markPostFailed` diperluas: sebelumnya hanya
   transisi dari status `Published` (bug fix awal sesi ini, terkait T-029),
   sekarang juga dari `Scheduled` — karena dengan 1-call-semua-target,
   gagalnya SATU call schedulePost berarti SEMUA target gagal bersamaan
   (all-or-nothing), bukan cuma skenario Publish Now.

### Reason

- Kontrak ACL harus merefleksikan bentuk API asli Outstand (1 call, 1
  `post.id`, banyak akun) supaya real adapter (T-025) bisa dipasang nanti
  tanpa rework kontrak — ADR-059 mensyaratkan Fake dan real adapter setara
  fidelitasnya terhadap kontrak yang sama.
- Status per akun resmi bersifat async (bukan sinkron) — memisahkan
  `fetchPostOutcome` dari `schedulePost`/`publishNow` menghindari asumsi
  palsu bahwa hasil publish selalu langsung diketahui.
- Retry resmi Outstand adalah delete+recreate, bukan re-trigger job yang
  sama — dicatat di sini supaya T-034.4 tidak mendesain ulang alur retry
  yang bertentangan dengan API asli saat dikerjakan nanti.

### Alternatives Considered

- **Tetap satu call per akun (`Promise.all` di use-case)** — ditolak;
  tidak merefleksikan bentuk API asli Outstand, akan menghasilkan banyak
  `post.id` untuk satu post logis (kontradiksi dengan model post-lifecycle
  resmi).
- **Gabung `schedulePost` dan `publishNow` jadi satu method dengan
  parameter `scheduledAt` opsional** — ditolak; RBAC dan kebutuhan outcome
  instan berbeda cukup signifikan untuk dipisah di level domain, walau
  endpoint HTTP-nya sama.
- **Tunda redesain kontrak sampai T-025 (real adapter)** — ditolak; lebih
  murah memperbaiki kontrak sekarang (masih fase Fake adapter, tanpa
  integrasi nyata yang bergantung padanya) daripada rework saat T-025/T-026
  sudah berjalan.

### Impact / Baseline yang diamandemen

- `product-discovery/06-engineering/integration-layer.md` — model publish
  per-akun-sinkron diamandemen menjadi 1-call-semua-target + outcome async
  (polling `fetchPostOutcome` sekarang, webhook T-026 nanti).
- File kode yang berubah (implementasi + verifikasi sudah selesai sesi
  ini): `packages/shared/src/contracts/outstand-adapter.ts`,
  `apps/web/src/domains/publishing/adapters/outstand-adapter.ts`,
  `apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts`,
  `apps/web/src/domains/publishing/repositories/publishing.repository.ts`
  (+ implementasi Prisma), `schedule-posts.use-case.ts`,
  `publish-now.use-case.ts`, `cancel-schedule.use-case.ts`,
  `analytics-ingestion.use-case.ts` (rename parameter saja), Prisma schema +
  migration `20260826092111_redesign_outstand_acl_contract`. Seluruh test
  terkait diperbarui — `bun run test` (179 passed, 3 skip butuh DB asli),
  `typecheck`, `lint` bersih.
- **T-025** (real HTTP adapter): kontrak sudah 1-call-semua-target sejak
  awal — tidak perlu rework kontrak saat kredensial Outstand asli tersedia.
- **T-026** (webhook handler): `fetchPostOutcome` sudah siap dipakai
  (handler webhook bisa memanggilnya dengan `outstandPostId` dari payload
  webhook `post.published`/`post.error`) — tidak ada perubahan kontrak yang
  dibutuhkan saat T-026 dikerjakan.
- **T-027** (kalau ada job runner/polling nanti): bisa langsung memakai
  `fetchPostOutcome` untuk resolve status post yang scheduled-nya sudah
  lewat waktu tayang.
- **T-034.4** (retry manual): harus mengikuti pola resmi Outstand
  delete-post-lalu-create-post-baru (bukan retry job yang sama) — dicatat
  sebagai catatan tambahan di task T-034 (`v02-publishing-mvp.md`).
- **Analytics (T-041), gap diketahui, TIDAK diselesaikan di ADR ini:**
  `fetchPostMetrics`/`fetchWorkspaceMetrics` sekarang menerima
  `outstandPostId` (rename dari `outstandJobId` lama), tapi bentuk hasilnya
  BELUM direvisi mengikuti response asli Outstand `get-post-analytics`
  (per-akun `metrics` + `aggregated_metrics` di root). Perlu dievaluasi
  ulang saat T-041 disentuh lagi — follow-up, bukan blocker redesain ini.

---
