# v0.4 — Engagement MVP

> Bagian dari backlog berjenjang. Indeks + legend status: [`../TASKS.md`](../TASKS.md).

**Tujuan rilis:** Menyatukan interaksi media sosial dalam satu tempat.
**Baseline rilis:** `product-discovery/02-product/release-roadmap.md` → v0.4

**Kedalaman dokumen ini:** task-level saja (rolling wave). **Subtask sengaja belum diisi** — akan dirinci saat rilis ini mendekat, supaya tidak disusun mendahului desain/ADR pendukungnya. ID task sudah dikunci sejak sekarang agar bisa dirujuk.

**Titik awal:** domain `engagement/` masih stub kosong. Model `EngagementInboxItem` + `EngagementReply` **sudah ada** di schema. Route `/engage` masih placeholder — saat ini masih di bawah dynamic segment lama `[slug]`, tapi baseline routing sudah pindah ke route group `(app)` (ADR-076); kalau **T-039** (migrasi kode, `tasks/v01-foundation.md`) belum selesai saat task rilis ini dikerjakan, bangun langsung di `(app)/engage` — jangan menambah route baru di `[slug]/...` lama.

**Batas rilis (ADR-040):** Direct Message, mention, dan **webhook engagement** tidak termasuk MVP. Engagement memakai **periodic pull 30 menit + manual refresh**, bukan webhook.

---

### T-050 · Engagement domain skeleton

`✅ Done (2026-09-22)` · **Domain** engagement · **ADR** ADR-017, ADR-018, ADR-031, ADR-110 · **Depends** T-002 ✅ · **Terkait** KI-065

**Baca dulu:** `05-architecture/domain-model.md` · `05-architecture/application-layer.md`

Service + repository interface + implementasi Prisma, mengikuti konvensi `workspace`/`publishing`. Isi `types.ts` yang saat ini masih `export {}`.

**Implementasi:** sudah dibangun sejak commit `23f9923` (sebelum sesi ini), baru ditinjau formal sekarang atas permintaan King Rezi. `EngagementService` + `IEngagementRepository` (Prisma) mengikuti konvensi domain lain; kapabilitas `IOutstandAdapter.fetchComments`/`replyToComment` (Fake, instant-fidelity) baru dicatat **ADR-110** saat review — sebelumnya diimplementasikan benar tapi belum punya ADR sendiri (gap governance, sesuai preseden ADR-079/093/105/106/108).

**Known gap terkait (lihat KI-065):** `EngagementInboxItemRecord` hanya membawa `postId` mentah, tanpa snapshot caption/media post asli — ditemukan saat T-053.

**Review Ridwan Architecture Reviewer (3 putaran, lihat detail penuh di § T-051):** putaran 1 menemukan gap ADR (#3) untuk task ini, ditutup lewat ADR-110. Domain purity dikonfirmasi terjaga di seluruh putaran.

**QA Najwa QA Engineer:** tercakup dalam QA gabungan T-050–T-052 (lihat § T-051) — golden path Refresh/Mark as Done/Kirim Balasan PASS, regresi Connect/Disconnect/Reconnect PASS.

### T-051 · Comment sync job setiap 30 menit

`✅ Done (2026-09-22)` · **Domain** engagement · integration · **ADR** ADR-022, ADR-040, ADR-110, ADR-113 · **Depends** T-025, T-027, T-050 ✅ · **Terkait** KI-068 (Resolved 2026-09-24)

**Baca dulu:** `05-architecture/background-jobs.md` · `05-architecture/integration-layer.md`

Periodic pull komentar dari Outstand per connected account, tulis ke `EngagementInboxItem`. Wajib idempoten — pull ulang tidak boleh menggandakan komentar.

**Implementasi:** sudah dibangun sejak commit `23f9923` (sebelum sesi ini) — job `engagement.sync` (JOB-03) self-reschedule tiap 30 menit, upsert idempoten ke `EngagementInboxItem`. Ditinjau formal sesi ini atas permintaan King Rezi (Ridwan Architecture Reviewer, 3 putaran, diverifikasi independen bukan percaya laporan implementer):

1. **Putaran 1** — 3 temuan: (#1, serius) job JOB-03 tidak pernah ter-seed otomatis untuk `ConnectedAccount` baru (handler hanya self-reschedule setelah job pertama ada, tidak ada trigger awal — siklus 30 menit tidak pernah mulai sendiri, melanggar Definition of Done rilis ini); (#2, rule #5) `refreshInboxAction` (T-052) melakukan orkestrasi langsung di Server Action; (#3, governance) kapabilitas Fake `fetchComments`/`replyToComment` belum punya ADR.
2. **Fix (Elon Backend Engineer):** #1 — `WorkspaceService` dapat port opsional baru `EngagementSyncSeederPort` (parameter ke-5 constructor, tidak import domain `engagement`), dipanggil di `completeAccountConnection` (create + reconnect); implementasi konkret di composition root `apps/web/src/lib/workspace/outstand-workspace-service.ts`. #2 — dipindah lihat § T-052. #3 — **ADR-110 baru**.
3. **Putaran 2 (verifikasi #1/#2):** kedua fix dikonfirmasi benar, TAPI eskalasi **temuan baru**: `disconnectAccount` tidak pernah membatalkan chain self-reschedule JOB-03 — lookup SQL job handler tidak filter status, disconnect→reconnect berulang bikin chain paralel bertambah tak terbatas. Dengan Fake adapter dampak tersamar (idempoten via upsert), tapi begitu Real adapter (T-025) aktif berarti akun yang sudah diputuskan user tetap terus di-pull + terus memicu notifikasi (masalah privasi/kontrol).
4. **Fix (Elon):** guard status (bukan cancel job baru — `IJobScheduler` tidak punya mekanisme cancel) — migration baru `20260922110000_t051_filter_active_status_engagement_sync_lookup` menambah kolom `status` ke fungsi SQL `webhook_find_account_owner_by_outstand_account_id`; `findAccountOwnerByOutstandAccountId` return `null` kalau status bukan `active` (diperlakukan sama seperti "tidak ditemukan" — `EngagementSyncJobHandler` sudah punya jalur dead-letter yang throw SEBELUM self-reschedule, jadi chain berhenti otomatis). `markAccountReconnectRequired` (webhook T-026.5) tidak terdampak (SELECT sama, hanya kolom output ditambah).
5. **Putaran 3 (verifikasi final):** 0 temuan tersisa — migration hanya nambah kolom, call site lain tidak terdampak, urutan throw-sebelum-reschedule dikonfirmasi lewat kode+test, domain purity terjaga.

**QA Najwa QA Engineer:** golden path Refresh/Mark as Done/Kirim Balasan PASS (network request dicek langsung); regresi Connect/Disconnect/Reconnect (T-013/T-015) PASS meski file overlap. Seeding job otomatis tidak bisa diverifikasi browser end-to-end (tidak ada akses `JOB_SECRET`/DB) — diverifikasi lewat 2 unit test baru `workspace.service.test.ts` (seed saat create, seed saat reconnect), keduanya lolos. Test integration baru `workspace.repository.engagement-sync-lookup.test.ts` skip (tidak ada `DATABASE_URL` lokal) — expected.

**⚠️ Catatan governance penting:** migration `20260922110000_t051_filter_active_status_engagement_sync_lookup` **BELUM di-deploy** ke database manapun (perlu `bun run db:deploy` manual oleh King Rezi). Sampai itu dijalankan, fungsi SQL yang dipakai JOB-03 masih versi lama — job akan **gagal untuk SEMUA akun** (bukan cuma yang disconnect) sampai migration ter-apply. Lihat juga Blockers di `PROJECT_STATE.md`.

**Verifikasi akhir T-050+T-051+T-052:** `typecheck`/`lint`/`test` bersih, **453 pass/6 skip** (naik dari 448, +5 test baru).

**Update (2026-09-24, KI-068 Resolved via ADR-113):** kontrak
`IOutstandAdapter.fetchComments` yang dipakai job ini diredesain per-post
(bukan per-akun+cursor) sesuai API resmi Outstand — lihat detail lengkap di
`tasks/v02-publishing-mvp.md` § T-025 dan `decisions/ADR-113-redesain-fetchcomments-replytocomment-per-post-ki068.md`.
`SyncCommentsUseCase` diredesain loop per-post lewat port lokal
`PublishingPostsPort` (sumber daftar post dari DB kita sendiri, bukan
endpoint list-posts Outstand), lolos review Ridwan 0 temuan. Status task ini
tidak berubah (`✅ Done` sejak 2026-09-22) — ini adalah penyesuaian kontrak
adapter yang dikonsumsi, bukan reopen scope T-051.

### T-052 · Manual refresh

`✅ Done (2026-09-22)` · **Domain** engagement · **ADR** ADR-023, ADR-040 · **Depends** T-051 ✅

**Baca dulu:** `05-architecture/realtime-strategy.md`

Kontrol refresh manual supaya pengguna tidak perlu menunggu siklus 30 menit. Data engagement **tidak** memakai Supabase Realtime (ADR-023 membatasinya hanya untuk tabel `notifications`).

**Implementasi:** sudah dibangun sejak commit `ae0f49b` (sebelum sesi ini). Fix review putaran 1 (temuan #2, lihat § T-051): orkestrasi (loop akun, sync, akumulasi count) yang sebelumnya ada langsung di `refreshInboxAction` (pelanggaran rule #5) dipindah ke use-case baru `RefreshInboxUseCase.refreshAll` (`apps/web/src/domains/engagement/services/refresh-inbox.use-case.ts`, pola sama `SyncCommentsUseCase`) — `refreshInboxAction` sekarang murni composition root. Dikonfirmasi Ridwan Architecture Reviewer putaran 2 (0 temuan, konsisten pola `SyncCommentsUseCase`) dan putaran 3 (final, 0 temuan tersisa). QA Najwa QA Engineer: golden path tombol Refresh PASS.

### T-053 · Comments Inbox UI

`✅ Done (2026-09-22)` · **Domain** engagement · UI · **ADR** ADR-046 · **Depends** T-051 · **Terkait** KI-065
**Baca dulu:** `04-ux/key-screen-patterns.md` · `04-ux/information-architecture.md`

Inbox komentar sederhana lintas akun di `/engage`: daftar komentar, filter per akun, status sudah/belum dibalas.

**Implementasi (selesai, 2026-09-22):** rancangan sudah ada di Claude Design (`templates/engage-inbox.html`, KSP-06) tapi pola thread-list belum dikunci ("SYNCED"/"LOCKED PATTERN") — sesuai rule 17 AGENTS.md, King Rezi ditanya via `AskUserQuestion` sebelum implementasi kode UI dimulai. Jawaban: "sesuaikan dengan yang ada di Claude Design" — diimplementasikan mengikuti markup mockup apa adanya, dibangun dari komponen shadcn `Item`/`ItemGroup` (bukan `Table`, karena mockup satu blok teks per baris, bukan tabular).

Backend (Prabowo Feature Engineer): Server Action baru `listInboxAction`, `getInboxItemDetailAction`, `markAsDoneAction` di `apps/web/src/app/(app)/engage/actions.ts` — murni wiring ke `EngagementService` yang sudah ada sejak T-050, tidak ada logic domain baru.

UI (Mark UI Engineer): `apps/web/src/app/(app)/engage/page.tsx` diganti dari `ScaffoldPlaceholder` jadi Server Component; komponen baru `apps/web/src/app/(app)/engage/components/EngageInboxView.tsx` (Client Component) — layout dua panel (thread-list kiri 340px tetap + thread-detail kanan), filter 3 dropdown (Akun/Platform/Status) re-fetch server-side, tombol Mark as Done, reply box (tombol Kirim awalnya disabled, diaktifkan di T-054), empty state (`Empty` shadcn), tombol Refresh manual reuse `refreshInboxAction` (T-052).

**Known gap (bukan bug, lihat KI-065):** kotak "Post asal" di detail panel hanya menampilkan label generik ("Komentar ini terhubung ke post terjadwal/terpublish") tanpa judul/thumbnail post asli — `InboxItemDetail`/`EngagementInboxItemRecord` (T-050) tidak membawa join ke caption/media post sungguhan (`postId` hanya ID, tanpa snapshot), dan menambah join lintas domain `engagement → publishing` di luar scope UI-only task ini.

**Review Ridwan Architecture Reviewer:** 0 temuan — domain purity terjaga (`IOutstandAdapter` tetap interface abstrak), entry point tanpa business logic, cross-domain lewat public API `workspace`, RBAC sesuai baseline.

**QA Najwa QA Engineer:** PASS penuh — golden path (pilih thread, Mark as Done) bekerja, filter Akun/Platform/Status semua benar, regresi `/publish/drafts` dan `/analyze` normal, gate T-103.3 (struktur vs `templates/engage-inbox.html`) cocok — pola `Item`/`ItemGroup` sesuai keputusan terkunci di atas; gap "Post asal" dikonfirmasi expected (bukan bug, konsisten `FakeOutstandAdapter` tidak pernah mengisi snapshot post).

### T-054 · Reply comment dari dalam aplikasi

`✅ Done (2026-09-22)` · **Domain** engagement · integration · **ADR** ADR-019, ADR-040, ADR-113 · **Depends** T-025, T-053 ✅ · **Terkait** KI-068 (Resolved 2026-09-24)
**Baca dulu:** `05-architecture/integration-layer.md` · `02-product/roles-permissions.md`

Kirim balasan lewat `OutstandAdapter`, persist ke `EngagementReply`.

**Implementasi (selesai, 2026-09-22):** RBAC dicek ke baseline `roles-permissions.md` — Owner/Admin/Creator semua boleh reply (tidak ada role gating tambahan, cukup member aktif workspace), tidak perlu keputusan baru.

Domain (Elon Backend Engineer): `EngagementService.reply(input, userId)` baru — validasi content tidak boleh kosong (`ValidationError`), cari inbox item (`NotFoundError` guard), panggil `IOutstandAdapter.replyToComment(item.externalId, content)` (Fake adapter, instant-success, pola sama `schedulePost`/`publishNow`), lalu persist `EngagementReply` dengan `outstandReplyId` hasil adapter, status `"sent"`. **Constructor `EngagementService` berubah** — sekarang wajib menerima `IOutstandAdapter` sebagai parameter kedua (breaking change internal, seluruh call site sudah diupdate, dikonfirmasi konsisten oleh Ridwan Architecture Reviewer). `IEngagementRepository.createReply` diperluas menerima `outstandReplyId` (kolom `EngagementReply.outstandReplyId` sudah ada di schema sejak awal, tanpa migration baru).

Server Action baru `replyToCommentAction` di `actions.ts`. UI (Mark UI Engineer): tombol "Kirim" di `EngageInboxView.tsx` diaktifkan — disabled saat draft kosong/sedang mengirim, toast sukses/error, textarea dikosongkan setelah sukses. Unit test baru untuk `EngagementService.reply` (golden path + `ValidationError` + `NotFoundError`).

**Review Ridwan Architecture Reviewer:** 0 temuan — `IOutstandAdapter` tetap interface abstrak (bukan Prisma/Supabase konkret), entry point tanpa business logic, cross-domain lewat public API `workspace`, RBAC sesuai baseline, shared types tidak duplikat, seluruh call site `EngagementService` konsisten dengan constructor baru.

**QA Najwa QA Engineer:** PASS penuh — golden path (kirim reply dari thread yang dipilih) bekerja tanpa reload, regresi `/publish/drafts` dan `/analyze` normal, gate T-103.3 cocok.

**Bug regresi ditemukan & diperbaiki (2026-09-22, saat review T-050–T-052):** balasan komentar tidak pernah tampil lagi di detail panel setelah reload — `EngageInboxView.tsx` tidak merender `detail.replies` meski backend sudah benar. Diperbaiki Mark UI Engineer — replies sekarang dirender sebagai "Balasan tim" (kotak indent + background beda) setelah komentar asli, balasan baru langsung muncul tanpa reload. Diverifikasi ulang Najwa QA Engineer — PASS.

**Verifikasi akhir T-053 + T-054:** `bun run typecheck`/`bun run lint`/`bun run test` semua bersih, **448 pass/5 skip** (naik dari 426), tidak ada regresi.

**Update (2026-09-24, KI-068 Resolved via ADR-113):** kontrak
`IOutstandAdapter.replyToComment` yang dipakai `EngagementService.reply`
diredesain — sekarang menerima `outstandPostId` (wajib, di-resolve dari
`postId` internal, guard `ConflictError` untuk data lama yang belum
terhubung) + `parentOutstandCommentId` (opsional, threading). Detail
lengkap di `tasks/v02-publishing-mvp.md` § T-025 dan
`decisions/ADR-113-redesain-fetchcomments-replytocomment-per-post-ki068.md`.
Status task ini tidak berubah (`✅ Done` sejak 2026-09-22).

### T-055 · Inbox assignment

`⏳ Not Started` · **Domain** engagement · **ADR** — · **Depends** T-053
**Baca dulu:** `02-product/feature-priority.md`

Berstatus **Could Have** — hanya dikerjakan bila waktu memungkinkan. Tidak memblokir rilis.

### T-056 · Preview post asli di kotak "Post asal" Comments Inbox

`✅ Done` (2026-10-06) · **Domain** engagement · publishing · UI · **ADR** — · **Depends** T-053 ✅, T-050 ✅ · **Terkait** KI-065 (Promoted to T-056), KI-082

**Baca dulu:** `05-architecture/domain-model.md` · `04-ux/key-screen-patterns.md`

Isi kotak "Post asal" di detail panel `/engage` (`EngageInboxView.tsx`) yang saat ini hanya menampilkan label generik ("Komentar ini terhubung ke post terjadwal/terpublish") — known gap sejak T-053, lihat **KI-065**. Scope dikonfirmasi King Rezi (2026-10-06): kotak ini wajib menampilkan **caption** post asli, **thumbnail media** (kalau post itu punya media), DAN **link ke post asli** (`platformPostUrl`) yang bisa diklik.

**Catatan task-level (subtask dirinci saat rilis ini dikerjakan, rolling wave):**
- Extend `EngagementInboxItemRecord`/`InboxItemDetail` (domain `engagement`, T-050) dengan snapshot caption/media/`platformPostUrl` dari post asli — perlu join lintas domain `engagement → publishing` lewat public API module `publishing` (AGENTS.md #7), BUKAN import implementasi lintas folder langsung.
- Resolve URL media (kalau post bermedia) untuk thumbnail — cek pola resolve media Outstand yang sudah ada (`resolveOutstandPostMedia`/`PostMediaLookupPort`, domain `publishing`) sebelum membuat mekanisme baru.
- UI: render caption (truncate wajar), thumbnail (atau fallback kalau post tidak bermedia), dan link `platformPostUrl` yang bisa diklik (buka tab baru) — menggantikan label generik saat ini.
- **Wajib AGENTS.md rule 17** sebelum menulis kode UI: cek Claude Design (`templates/engage-inbox.html`, KSP-06) apakah struktur preview post asli (caption+thumbnail+link) sudah dikunci ("SYNCED"/"LOCKED PATTERN"). Kalau belum dikunci atau mockup belum menunjukkan pola ini → STOP, tanya King Rezi via `AskUserQuestion` sebelum implementasi (persis preseden T-053).

**Update (2026-10-06) — Claude Design sudah di-lock, implementasi belum dimulai:** `templates/engage-inbox.html` (KSP-06) sudah diupdate dan dikunci — gate AGENTS.md rule 17 untuk pola link sudah terpenuhi, implementer tidak perlu STOP/tanya lagi soal ini. Perubahan: kotak `.post-context` sekarang render caption asli (`.post-context-cap`, truncate 1 baris, di dalam `.post-context-body`) + link **"Go to post →"** yang reuse class `.popover-link` dari `components/popover.html` (Post Preview Popover) — bukan gaya ikon+"Lihat post asli" dari `publish-history-detail.html`. Keputusan dipilih eksplisit oleh King Rezi via `AskUserQuestion` (dua pola existing ini ambigu secara teknis per AGENTS.md rule 17). Fallback media: kalau post tidak bermedia, elemen `.thumb` di-omit sepenuhnya (bukan kotak kosong) dan kolom teks jadi full width — didokumentasikan sebagai komentar HTML "LOCKED PATTERN (T-056, 2026-10-06, King Rezi confirmed via AskUserQuestion)" tepat di atas blok `.post-context`. CSS pendukung (`.post-context-body`, `.post-context-cap`) ditambahkan di `styles.css` setelah rule `.thumb`. Detail lengkap: `project-manager/COMPLETE_TASK.md` entri 2026-10-06. Branch kerja `feature/t056-engage-post-asal-preview` sudah dibuat dari `origin/staging`, tapi belum ada commit kode apps/web — status task tetap `⏳ Not Started`.

**Update (2026-10-06) — Implementasi selesai, commit `e7395c7`, PR #143 ke `staging`:**
- Diimplementasikan Prabowo Feature Engineer: extend `EngagementInboxItemRecord`/`InboxItemDetail` dengan field `postSnapshot` (caption, thumbnail, `platformPostUrl`), join `engagement → publishing` lewat port lokal structural-typing (`PublishingPostSnapshotPort`, pola sama `PublishingPostReferencePort` yang sudah ada) — bukan import tipe konkret lintas domain. Thumbnail diresolve lewat `MediaService.listByIds` (bukan `resolveOutstandPostMedia` — itu untuk upload-prep ke Outstand, bukan preview media existing).
- Review arsitektur Ridwan: 0 pelanggaran hard rule. 1 temuan perilaku (bukan pelanggaran arsitektur) dikonfirmasi King Rezi via `AskUserQuestion`: kotak "Post asal" sengaja hilang total (bukan fallback label generik) kalau `postId` ada tapi `postSnapshot` gagal di-resolve (data tidak sinkron/post terhapus terpisah) — keputusan final, bukan bug.
- QA Najwa round 1: 2 bug ditemukan — (a) caption tidak truncate, box melebar keluar viewport; (b) thumbnail broken karena signed URL Supabase Storage (TTL 1 jam) di-cache permanen di `MediaItem.url`, tidak pernah di-generate ulang.
- Fix (a) oleh Mark UI Engineer: tambah `min-w-0` di `.thread-detail` DAN `.post-context` (dua lapis penyebab, bukan cuma satu).
- Fix (b) oleh Elon Backend Engineer, keputusan King Rezi (generate ulang signed URL saat request, dipilih dari 3 opsi): `IMediaStorageAdapter` ditambah method `getSignedUrl`, `MediaService` regenerate signed URL fresh di `getMediaItem`/`listMediaItems`/`listByIds` kalau storage adapter disuplai. Diterapkan di `getInboxItemDetailAction` (T-056) DAN `getDraftAction` (draft editor — titik rawan sama, media dibuka lama setelah upload). Jalur validasi-only (`resolveAndValidateMediaIds`, `scheduleDraftAction`, `publishNowAction`) sengaja tidak disuplai storage adapter (tidak perlu display URL, hindari network call sia-sia). Kolom `MediaItem.url` di skema TIDAK dihapus, tetap jadi fallback.
- QA Najwa round 2 (independen, setelah kedua fix): PASS semua — 620 test pass/6 skip, typecheck/lint bersih, tidak ada regresi (termasuk draft editor, filter Comments Inbox, Mark as Done, reply box).
- Gate T-103.3 (verifikasi struktur vs Claude Design): PASS, dicek langsung sesi utama via `DesignSync`.
- **Catatan untuk masa depan:** King Rezi sempat tanya soal thumbnail untuk post yang BUKAN dibuat lewat app kita (post hasil import) — investigasi menemukan fitur Import Posts (T-090/T-091, ADR-093) belum diimplementasikan sama sekali, jadi skenario ini belum relevan sekarang. Kalau T-090/T-091 dikerjakan nanti, perlu didesain ulang bagaimana post hasil import mendapat referensi media (saat ini `PublishingPost.mediaIds` cuma menunjuk `MediaItem` lokal hasil upload kita sendiri, tidak ada field untuk URL media platform asli).
- Status task: **✅ Done**. Terkait juga **KI-082** (media/thumbnail tidak tampil di beberapa preview post lain — History Detail, Calendar Popover — di luar scope T-056). **KI-082 Resolved (2026-10-06)**: History Detail sudah diimplementasikan (reuse pola resolve media T-056), lihat `COMPLETE_TASK.md`; Calendar Popover sengaja tidak diubah (keputusan King Rezi, placeholder sudah cukup).

---

## Catatan Rilis

* T-057–T-059 sengaja dikosongkan sebagai ruang penambahan task v0.4 (T-056 sudah terpakai, 2026-10-06 — promosi KI-065).
* **Definition of Done rilis ini:** pengguna dapat membaca dan membalas komentar tanpa berpindah platform, dengan data diperbarui setiap 30 menit atau lewat manual refresh.
* **Yang sengaja di luar rilis ini (ADR-040 + `feature-priority.md`):** Social Listening, Direct Messages, Mentions, Engagement Webhooks.
