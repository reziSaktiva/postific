# v0.4 — Engagement MVP

> Bagian dari backlog berjenjang. Antrian: [`../AVAILABLE_TICKETS.md`](../AVAILABLE_TICKETS.md). Tiket selesai tetap di file ini. Deskripsi baru: ADR-131. Nama folder: ADR-132.
>
> **Catatan historis (2026-10-23):** tiket Done di file ini mencatat kondisi saat dikerjakan. Sebutan "Fake adapter" sebagai jalur kerja sudah usang: Fake dihapus dari jalur produksi oleh ADR-119 (`OUTSTAND_API_KEY` wajib). Sebutan "Astryx" sudah digantikan shadcn/ui (ADR-097, T-102).

**Tujuan rilis:** Menyatukan interaksi media sosial dalam satu tempat.
**Baseline rilis:** `product-discovery/02-product/release-roadmap.md` → v0.4

**Kedalaman dokumen ini:** semula task-level saja (rolling wave); tiket rilis awal (T-050 sampai T-056) sudah Done dan tiket Engage per posting (T-216 sampai T-224) berisi subtask rinci. ID task dikunci agar bisa dirujuk.

**Titik awal (historis, saat rilis v0.4 mulai; domain `engagement/`, route `/engage`, dan UI Inbox kini sudah ada):** domain `engagement/` masih stub kosong. Model `EngagementInboxItem` + `EngagementReply` **sudah ada** di schema. Route `/engage` masih placeholder — saat ini masih di bawah dynamic segment lama `[slug]`, tapi baseline routing sudah pindah ke route group `(app)` (ADR-076); kalau **T-039** (migrasi kode, `tickets/v01-foundation.md`) belum selesai saat task rilis ini dikerjakan, bangun langsung di `(app)/engage` — jangan menambah route baru di `[slug]/...` lama.

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

**Update (2026-10-13):** migration `20260922110000_t051_filter_active_status_engagement_sync_lookup` sudah ter-apply di database staging sejak 2026-09-22. Fungsi lookup mengembalikan kolom `status`. Catatan lama yang menulis migrasi ini belum di-deploy adalah drift dokumen, dan penghalang itu dikeluarkan dari `PROJECT_STATE.md`.

**Verifikasi akhir T-050+T-051+T-052:** `typecheck`/`lint`/`test` bersih, **453 pass/6 skip** (naik dari 448, +5 test baru).

**Update (2026-09-24, KI-068 Resolved via ADR-113):** kontrak
`IOutstandAdapter.fetchComments` yang dipakai job ini diredesain per-post
(bukan per-akun+cursor) sesuai API resmi Outstand — lihat detail lengkap di
`tickets/v02-publishing-mvp.md` § T-025 dan `decisions/ADR-113-redesain-fetchcomments-replytocomment-per-post-ki068.md`.
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
lengkap di `tickets/v02-publishing-mvp.md` § T-025 dan
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

**Update (2026-10-06) — Claude Design sudah di-lock, implementasi belum dimulai:** `templates/engage-inbox.html` (KSP-06) sudah diupdate dan dikunci — gate AGENTS.md rule 17 untuk pola link sudah terpenuhi, implementer tidak perlu STOP/tanya lagi soal ini. Perubahan: kotak `.post-context` sekarang render caption asli (`.post-context-cap`, truncate 1 baris, di dalam `.post-context-body`) + link **"Go to post →"** yang reuse class `.popover-link` dari `components/popover.html` (Post Preview Popover) — bukan gaya ikon+"Lihat post asli" dari `publish-history-detail.html`. Keputusan dipilih eksplisit oleh King Rezi via `AskUserQuestion` (dua pola existing ini ambigu secara teknis per AGENTS.md rule 17). Fallback media: kalau post tidak bermedia, elemen `.thumb` di-omit sepenuhnya (bukan kotak kosong) dan kolom teks jadi full width — didokumentasikan sebagai komentar HTML "LOCKED PATTERN (T-056, 2026-10-06, King Rezi confirmed via AskUserQuestion)" tepat di atas blok `.post-context`. CSS pendukung (`.post-context-body`, `.post-context-cap`) ditambahkan di `styles.css` setelah rule `.thumb`. Detail lengkap: riwayat git (berkas `COMPLETE_TASK.md` sudah dihapus) entri 2026-10-06. Branch kerja `feature/t056-engage-post-asal-preview` sudah dibuat dari `origin/staging`, tapi belum ada commit kode apps/web — status task tetap `⏳ Not Started`.

**Update (2026-10-06) — Implementasi selesai, commit `e7395c7`, PR #143 ke `staging`:**

- Diimplementasikan Prabowo Feature Engineer: extend `EngagementInboxItemRecord`/`InboxItemDetail` dengan field `postSnapshot` (caption, thumbnail, `platformPostUrl`), join `engagement → publishing` lewat port lokal structural-typing (`PublishingPostSnapshotPort`, pola sama `PublishingPostReferencePort` yang sudah ada) — bukan import tipe konkret lintas domain. Thumbnail diresolve lewat `MediaService.listByIds` (bukan `resolveOutstandPostMedia` — itu untuk upload-prep ke Outstand, bukan preview media existing).
- Review arsitektur Ridwan: 0 pelanggaran hard rule. 1 temuan perilaku (bukan pelanggaran arsitektur) dikonfirmasi King Rezi via `AskUserQuestion`: kotak "Post asal" sengaja hilang total (bukan fallback label generik) kalau `postId` ada tapi `postSnapshot` gagal di-resolve (data tidak sinkron/post terhapus terpisah) — keputusan final, bukan bug.
- QA Najwa round 1: 2 bug ditemukan — (a) caption tidak truncate, box melebar keluar viewport; (b) thumbnail broken karena signed URL Supabase Storage (TTL 1 jam) di-cache permanen di `MediaItem.url`, tidak pernah di-generate ulang.
- Fix (a) oleh Mark UI Engineer: tambah `min-w-0` di `.thread-detail` DAN `.post-context` (dua lapis penyebab, bukan cuma satu).
- Fix (b) oleh Elon Backend Engineer, keputusan King Rezi (generate ulang signed URL saat request, dipilih dari 3 opsi): `IMediaStorageAdapter` ditambah method `getSignedUrl`, `MediaService` regenerate signed URL fresh di `getMediaItem`/`listMediaItems`/`listByIds` kalau storage adapter disuplai. Diterapkan di `getInboxItemDetailAction` (T-056) DAN `getDraftAction` (draft editor — titik rawan sama, media dibuka lama setelah upload). Jalur validasi-only (`resolveAndValidateMediaIds`, `scheduleDraftAction`, `publishNowAction`) sengaja tidak disuplai storage adapter (tidak perlu display URL, hindari network call sia-sia). Kolom `MediaItem.url` di skema TIDAK dihapus, tetap jadi fallback.
- QA Najwa round 2 (independen, setelah kedua fix): PASS semua — 620 test pass/6 skip, typecheck/lint bersih, tidak ada regresi (termasuk draft editor, filter Comments Inbox, Mark as Done, reply box).
- Gate T-103.3 (verifikasi struktur vs Claude Design): PASS, dicek langsung sesi utama via `DesignSync`.
- **Catatan untuk masa depan:** King Rezi sempat tanya soal thumbnail untuk post yang BUKAN dibuat lewat app kita (post hasil import) — investigasi menemukan fitur Import Posts (T-090/T-091, ADR-093) belum diimplementasikan sama sekali, jadi skenario ini belum relevan sekarang. Kalau T-090/T-091 dikerjakan nanti, perlu didesain ulang bagaimana post hasil import mendapat referensi media (saat ini `PublishingPost.mediaIds` cuma menunjuk `MediaItem` lokal hasil upload kita sendiri, tidak ada field untuk URL media platform asli).
- Status task: **✅ Done**. Terkait juga **KI-082** (media/thumbnail tidak tampil di beberapa preview post lain — History Detail, Calendar Popover — di luar scope T-056). **KI-082 Resolved (2026-10-06)**: History Detail sudah diimplementasikan (reuse pola resolve media T-056), lihat riwayat git (`COMPLETE_TASK.md` sudah dihapus); Calendar Popover sengaja tidak diubah (keputusan King Rezi, placeholder sudah cukup).

---

## Engage per posting mengikuti pola Buffer (spec S-006, ADR-157)

Gelombang tiket T-216 sampai T-222 dan T-224, plus T-223 Deferred. ADR-157 **Accepted** 2026-11-05 (jawaban Q1 sampai Q5 King Rezi tercatat di ADR). Sumber: pengamatan REA pada `publish.buffer.com/community` (2026-11-05) dan keputusan arah King Rezi 2026-11-05. Rincian perilaku ada di [`specs/S-006.md`](../specs/S-006.md). ID rilis v0.4 sebelumnya (T-050 sampai T-056) tidak berubah.

### T-216 · Engage by post: design in the Postific artifact and gallery confirmation

| Field       | Value                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Status**  | ✅ Done (2026-11-05, rancangan dikonfirmasi King Rezi di galeri)                                                              |
| **Mode**    | HITL (konfirmasi galeri adalah milik King Rezi)                                                                               |
| **Domain**  | engagement · UI/UX (UI/UX-related)                                                                                            |
| **Spec**    | S-006                                                                                                                         |
| **Docs**    | ADR-157, ADR-140, ADR-097, KSP-06, KSP-D06, `context/ctx-design.md`, `.claude/skills/claude-design-scope-discipline/SKILL.md` |
| **Depends** | — (ADR-157 Accepted 2026-11-05)                                                                                               |

**Gate rancangan (`AGENTS.md` aturan 10), riwayat:** saat tiket ini dibuat belum ada rancangan Engage per posting di artifact Postific, jadi tiket UI (T-219, T-220, T-224) tidak boleh mulai sebelum T-216 dikonfirmasi King Rezi. Gate sudah terpenuhi (T-216 ✅, 2026-11-05).

**What to build:** kartu layar Engage per posting di artifact Postific, dikerjakan Neymar (wajib baca `claude-design-scope-discipline` dulu; jangan mengubah default atau state lain, jangan menambah kontrol pembanding tanpa izin).

- [x] **T-216.1** Brief pola Buffer (14 pola, padanan shadcn, selisih prioritas) diserahkan ke Neymar. Padanan shadcn pada brief masih dugaan; Mark memverifikasi lewat MCP shadcn sebelum implementasi.
- [x] **T-216.2** Kartu layar: daftar posting (kartu dengan badge dan progress), panel komentar, kartu pratinjau posting, dan ringkasan "x dibalas / y total".
- [x] **T-216.3** Filter utama (Akun, Status) dan panel Filter & Sort dengan Reset; tempat filter Platform diputuskan di sini (spec S-006).
- [x] **T-216.4** Aksi hover per komentar (Resolve, Dismiss, Reply, buka kembali), semua status, dan state kosong, filter tanpa hasil, refresh berjalan, refresh gagal, kelompok "tanpa posting".
- [x] **T-216.5** Tampilan List (toggle By post / List, Q5): isi, urutan, dan filter di tampilan List; mode List Buffer belum teramati, jadi rancangannya diputuskan di sini, bukan ditiru.
- [x] **T-216.6** Varian terang, gelap, 375px, dan panel daftar terlipat.
- [x] **T-216.7** Konfirmasi King Rezi di galeri. Pola ambigu (lebih dari satu pola shadcn valid) ditanyakan lewat `AskUserQuestion`, tidak ditebak.

**Hasil rancangan (2026-11-05, Neymar):** draf terbit. Artifact Postific v38 (kartu `ScreenEngagePerPosting`, 19 skenario, prototipe interaktif) dan galeri Postific Design Review v15 (entri "Engage: per posting (T-216, ADR-157)", tag draft, menu Workspace). "Engage: Inbox" lama tidak diubah. Diamati di browser pane pada salinan lokal identik dengan hasil publish (bukan halaman live): terisi, status dan hover, panel Filter & Sort, dropdown Status, refresh gagal, filter tanpa hasil, List, 375px daftar, detail, dan gelap. **Hanya dibuat, belum diamati:** Tanpa posting, terlipat, kosong, refresh berjalan, gelap desktop, tinggi layar telepon sungguhan, kontras WCAG; dua ikon (sliders, list) digambar manual, Mark memakai ikon asli.

**Keputusan King Rezi atas pertanyaan ambigu (2026-11-05, `AskUserQuestion`, semua sesuai default gambar Neymar, tanpa perubahan rancangan):**

| #   | Pertanyaan                 | Jawaban                                                                                                    |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Panel Filter & Sort        | `Popover` (tetap `Popover` di 375px)                                                                       |
| 2   | Dropdown Akun dan Status   | `Select`                                                                                                   |
| 3   | Filter Platform            | Di panel Filter & Sort                                                                                     |
| 4   | Komposer balasan (By post) | Docked di bawah panel kanan; inline di tampilan List                                                       |
| 5   | Kartu posting              | Kustom dari `Card`, `Badge`, `Progress`; Mark memverifikasi lewat MCP shadcn sebelum implementasi          |
| 6   | Cakupan Reset filters      | Semua filter (Akun, Status, Platform, Sort, Date Range)                                                    |
| 7   | Arti "x dibalas / y total" | x = status Dibalas saja; progress bar memakai rasio ditangani; teks kecil "n dari y ditangani" ditambahkan |

**Tindak lanjut rancangan (2026-11-06, audit docs-consistency B1 dan B8):** tag "draft" entri galeri diubah menjadi terkonfirmasi dan komposer pada kelompok "Tanpa posting" dirancang nonaktif dengan pesan, lewat Neymar tanpa menyentuh layar atau kartu lain. **Hasil (2026-11-06, Neymar):** Postific v40 dan galeri v16 terbit. Tag entri galeri menjadi `dikonfirmasi` (5 Nov 2026) seperti entri Draft Editor redesain; checklist entri disesuaikan (butir tampilan List kini "ikut dikonfirmasi bersama rancangan ini", sesuai konfirmasi King Rezi atas seluruh rancangan). Kelompok "Tanpa posting": Textarea dan Kirim nonaktif dengan pesan usulan "Komentar ini tidak terkait posting, jadi tidak dapat dibalas dari Postific."; Alert di atas daftar diganti ("Outstand hanya membalas per posting … Resolve, Dismiss, dan Buka kembali tetap tersedia."); aksi hover Reply nonaktif dengan Tooltip (bukan disembunyikan, posisi ikon tidak bergeser); berlaku di panel kelompok, tampilan List, dan 375px. Skenario 6 diberi `force` pada dua komentar supaya ikon aksi terlihat saat review (hanya di skenario itu). Diamati pada salinan lokal identik dengan hasil publish: skenario 6 terang, List, skenario 12 tidak berubah, 375px detail kelompok, tag galeri; berkas yang dibaca balik dari kedua artifact berhash sama. **Belum diamati:** tampilan live claude.ai, mode gelap kelompok "Tanpa posting" dan List 375px, Tooltip dengan hover nyata (hanya lewat DOM). Teks pesan dan Alert adalah usulan teks. Temuan di luar lingkup, tidak diubah: subtitle kartu ScreenDraftEditorRedesain bertanggal 3 Nov sedangkan tag galerinya 5 Nov; pil aksi yang dipaksa tampil menutupi sebagian badge status di layar lebar (perilaku lama).

**Keputusan Neymar yang belum dikonfirmasi eksplisit (diperiksa saat konfirmasi galeri):** tampilan List adalah usulan (mode List Buffer belum teramati); Date Range bawaan 12 bulan; Sort bawaan "Belum dibalas dulu"; "Tanpa posting" di dasar daftar dan tidak ikut sort; posting tanpa komentar disembunyikan dan ditampilkan lewat toggle ikon.

**Belum terbukti:** komposer balasan, aksi hover, mode List, dan layar sempit Buffer belum teramati; rancangan memutuskannya sendiri, bukan meniru.

**Blocked by:** tidak ada. **Konfirmasi King Rezi (2026-11-05, di chat):** rancangan Engage per posting dikonfirmasi, termasuk keputusan Neymar yang belum dibahas satu per satu (tampilan List usulan, Date Range 12 bulan, Sort bawaan "Belum dibalas dulu", "Tanpa posting" di dasar daftar, posting tanpa komentar disembunyikan). Bagian yang hanya dibuat dan belum teramati (lihat Hasil rancangan) diperiksa lagi di implementasi T-219, T-220, T-224 dan QA T-222. Tag "draft" pada entri galeri belum diubah (lihat catatan sesi: perubahan artifact lewat Neymar).

---

### T-217 · Engage: status `replied` / `resolved` / `dismissed`

| Field       | Value                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Status**  | 🟡 Done (code) 2026-11-06, menunggu Verified (staging)                                                                  |
| **Mode**    | AFK (migrasi data `done` butuh izin King Rezi sebelum diterapkan ke DB bersama)                                         |
| **Domain**  | engagement · backend                                                                                                    |
| **Spec**    | S-006                                                                                                                   |
| **Docs**    | ADR-157, ADR-040, `domains/engagement/types.ts`, `lib/repositories/engagement`, `schema.prisma` (`EngagementInboxItem`) |
| **Depends** | — (ADR-157 Accepted 2026-11-05)                                                                                         |

**What to build:** `InboxItemStatus` dari `"unread" | "done"` menjadi `unread | replied | resolved | dismissed`, dengan transisi yang jelas, tanpa kolom atau tabel baru (kolom `status` adalah `TEXT` tanpa constraint).

- [x] **T-217.1** Inventarisasi semua pemakai status `done` dan `unread` (service, repository, `EngageInboxView`, badge sidebar, Engagement Snapshot di Home, dan tool MCP `list_comments` yang memakai filter `status` `"unread"|"done"`, `application-layer.md`) sebelum mengubah apa pun. Hasilnya dicatat di tiket ini.
- [x] **T-217.2** Tipe dan aturan transisi di domain `engagement` (mis. `unread` → `replied` / `resolved` / `dismissed`; `resolved` dan `dismissed` → `unread`), sesuai jawaban Q2 dan Q3 (`replied` otomatis saat balasan terkirim, status reversibel). Nama method `markAsDone` ditinjau.
- [x] **T-217.3** `EngagementService.reply` menandai `replied` saat balasan berhasil terkirim bila status `unread`; tidak menurunkan status lain.
- [x] **T-217.4** (migrasi `apps/web/prisma/migrations/20261106100000_t217_engagement_done_to_resolved/migration.sql` sudah terpasang di DB bersama, terlihat lewat `prisma migrate status` 2026-11-06) Migrasi data baris `done` menjadi `resolved` (jawaban Q1, 2026-11-05). Migrasi ditulis, ditinjau, dan diterapkan ke DB bersama hanya atas izin King Rezi.
- [x] **T-217.5** Server Action di `engage/actions.ts` hanya memanggil service (aturan keras no. 3). Domain tidak mengimpor Prisma (aturan keras no. 4).
- [x] **T-217.6** Tes unit (double lokal di berkas tes), `typecheck`, `lint`, tes hijau.
- [x] **T-217.7** Hitungan badge sidebar dan Engagement Snapshot di Home dibatasi 12 bulan terakhir (keputusan King Rezi 2026-11-06, audit docs-consistency B2), sama dengan Date Range bawaan daftar posting; tes menegaskan komentar `unread` lebih tua dari 12 bulan tidak dihitung.
- [x] **T-217.8** Tool MCP `list_comments`: filter `status` menerima `unread`, `replied`, `resolved`, `dismissed`, dan `done` tetap diterima sebagai alias `resolved` (keputusan King Rezi 2026-11-06, B3). Tes kontrak diperbarui; amandemen ADR MCP dicatat bila kontraknya dianggap berubah.

**Hasil inventaris T-217.1 (2026-11-06):** pemakai status `unread`/`done`: `domains/engagement/types.ts` (`InboxItemStatus`), repository (`markInboxItemStatus`, `listInboxItems`), `EngagementService.markAsDone` (diganti `changeStatus`), `engage/actions.ts` (`markAsDoneAction`, `listInboxAction`), `EngageInboxView` (opsi filter, titik belum dibaca, tombol Mark as Done), tool MCP `list_comments` (`COMMENT_STATUSES`), dan tes terkait. **Badge sidebar dan Engagement Snapshot di Home TIDAK memakai hitungan komentar saat ini:** `initialUnreadCount` di sidebar adalah hitungan notifikasi, dan Home hanya menampilkan Analytics Snapshot. Maka T-217.7 diselesaikan di lapisan data: `EngagementService.countUnread` (jendela 12 bulan, `inboxCountWindowStart`) dan `countUnreadInboxItems` di repository, dengan tes; penyambungan ke badge dan Snapshot menunggu konsumennya dibangun (bukan T-217).

**Perubahan:** `markAsDone` diganti `changeStatus` (transisi di `domains/engagement/inbox-status.ts`; transisi ilegal `ConflictError`; status sama idempoten); `reply` menandai `replied` dari `unread` saja; `readAt` kini terisi saat pertama keluar dari `unread`; `done` di MCP menjadi alias `resolved` (enum skema tetap memuat `done`). `markAsDoneAction` dipertahankan (kini `resolved`) agar `EngageInboxView` tetap jalan sampai T-219.

**Pengecualian E2E golden path (ADR-149, 2026-11-06, atas persetujuan merge King Rezi):** perubahan belum punya tampilan baru (UI "By post" ada di T-219 sampai T-224), jadi E2E golden path Engage digabung ke T-222. Suite E2E lokal yang ada hijau tanpa regresi (51 lulus; satu kegagalan CSP `next-devtools` di `next dev` sudah diperbaiki di `theme.e2e.ts`).

**Belum terbukti:** migrasi data belum dijalankan ke DB mana pun; query `countUnreadInboxItems` belum dicoba terhadap Postgres sungguhan (tes memakai repository in-memory sesuai kontrak); perilaku badge dan Home setelah status baru belum ada konsumennya (T-222). Kontrak MCP `list_comments` berubah (enum bertambah, `done` alias); amandemen ADR MCP/`application-layer.md` belum ditulis (di luar scope sesi ini). Transisi `resolved`↔`dismissed` langsung dan `replied`→`unread` ditolak mengikuti butir tiket secara harfiah; perlu konfirmasi King Rezi bila tidak diinginkan.

**Blocked by:** tidak ada (ADR-157 Accepted 2026-11-05).

---

### T-218 · Engage: query inbox per posting

| Field       | Value                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| **Status**  | 🟡 Done (code) 2026-11-06, menunggu Verified (staging)                                                  |
| **Mode**    | AFK                                                                                                     |
| **Domain**  | engagement · backend                                                                                    |
| **Spec**    | S-006                                                                                                   |
| **Docs**    | ADR-157, ADR-046, `lib/repositories/engagement`, `domains/engagement/services`, `context/ctx-domain.md` |
| **Depends** | T-217                                                                                                   |

**What to build:** query yang mengembalikan posting beserta ringkasan komentarnya, bukan hanya daftar item datar.

- [x] **T-218.1** Repository mengelompokkan item per `postId`: jumlah komentar total, jumlah belum dibalas, jumlah ditangani (untuk progress bar), waktu komentar terbaru. Item tanpa `postId` menjadi satu kelompok "tanpa posting".
- [x] **T-218.2** Sort: belum dibalas dulu (bawaan), terbaru, terlama. Rentang tanggal (7 hari, 30 hari, 6 bulan, 12 bulan) atas `receivedAt`. Filter akun, platform, dan status tetap berfungsi.
- [x] **T-218.3** Snapshot posting (caption, thumbnail, platform, akun) memakai jalur yang sudah ada (`PublishingPostSnapshotPort`, T-056), tanpa import lintas domain (aturan keras no. 5). Thumbnail memakai signed URL yang diregenerasi.
- [x] **T-218.4** Posting tanpa komentar disembunyikan secara bawaan; parameter menampilkan semuanya.
- [x] **T-218.5** Tes unit dan integrasi DB (4 tes integrasi lulus di Postgres staging 2026-11-06, tanpa data sisa; `EXPLAIN (ANALYZE)` belum); indeks DB diperiksa (kandidat: `workspace_id`, `post_id`, `status`, `received_at`) sebelum menambah migrasi.
- [x] **T-218.6** `typecheck`, `lint`, tes hijau.
- [x] **T-218.7** Jelaskan dan putuskan cara JOB-03 menarik komentar per akun memakai endpoint Outstand per posting (`GET /v1/posts/{id}/replies`): iterasi posting terbit per akun dan batas posting yang ditarik; tulis hasilnya di `integration-layer.md` dan `background-jobs.md` (keputusan King Rezi 2026-11-06, B7).
- [x] **T-218.8** Putuskan indeks untuk query per posting (kandidat `post_id` dan `received_at`) dan tulis di `database-strategy.md` bersama migrasinya bila perlu (B7).

**Hasil (2026-11-06, jalur T-218):** `EngagementService.listInboxByPost` + `IEngagementRepository.aggregateInboxByPost` (GROUP BY di DB) + fungsi murni `buildInboxPostGroups`/`inboxDateRangeStart` (`domains/engagement/inbox-post-groups.ts`); filter `postId` (termasuk `null` = tanpa posting) dan `receivedSince` pada `listInboxItems` untuk komentar posting terpilih; Server Action `listInboxByPostAction` meregenerasi signed URL thumbnail. Migrasi indeks `20261106120000_t218_engagement_inbox_post_index` ditulis, belum diterapkan.

**Keputusan agen untuk ditinjau King Rezi:**

- T-218.7: JOB-03 dipertahankan menelusuri posting terbit per akun (maksimum 50 terbaru, berurutan, kegagalan per posting dilewati); ditulis di `integration-layer.md` dan `background-jobs.md`. Tidak ada perubahan kode JOB-03.
- T-218.8: satu indeks `(workspace_id, post_id, received_at DESC)`; tanpa `(workspace_id, received_at)`; ditulis di `database-strategy.md`.
- Kelompok = per `postId`. Posting multi-akun menjadi satu kelompok dengan `connectedAccountId`/`platform` dari komentar terbaru (plus `connectedAccountIds`); snapshot diambil untuk akun itu.
- Kelompok "Tanpa posting" tidak ikut sort dan selalu di dasar daftar (KSP-06-F01/F02), setelah posting berkomentar dan posting kosong. Urutan akhir: posting berkomentar (sesuai sort), posting kosong (`includeEmpty`), "Tanpa posting".
- Batas 100 posting bernomor per panggilan: pemotongan hanya atas posting bernomor (posting kosong terbuang lebih dulu), "Tanpa posting" tidak pernah dibuang, dan hasil membawa `truncated: true` bila ada yang dibuang (`listInboxByPost` mengembalikan `{ groups, truncated }`).
- Semantik rentang tanggal vs `includeEmpty`: semua hitungan hanya atas komentar dalam rentang (dan filter akun/platform); posting "kosong" berarti tanpa komentar dalam rentang, bukan tanpa komentar sama sekali. `includeEmpty` diabaikan saat filter status aktif. Posting kosong selalu di bawah posting berkomentar untuk sort newest/oldest/unreplied_first.
- `listInboxByPostAction` memvalidasi input runtime (`connectedAccountId` harus UUID, `platform` harus platform dikenal) menjadi `ValidationError`.
- "Belum dibalas" = `unread`; "ditangani" = `replied` + `resolved` + `dismissed`.
- Filter status memilih kelompok yang punya minimal satu komentar berstatus itu, tetapi hitungan kelompok tetap atas semua komentar (dalam akun/platform/rentang). Rentang bawaan 12 bulan (S-006).
- `includeEmpty` memakai sumber posting JOB-03 (maksimum 50 per akun, tanpa filter tanggal terbit); tidak berlaku bersama filter status. Maksimum 100 kelompok per panggilan.

**Catatan teknis dan keputusan tertunda:**

- `groupBy` repository memakai `take: 5000` hanya sebagai pagar; bila terlewati, kelompok terpotong diam-diam (belum ada penanda).
- `CREATE INDEX` migrasi T-218.8 tanpa `CONCURRENTLY` sehingga mengunci tulis tabel selama pembuatan; pertimbangkan jendela terapan atau varian CONCURRENTLY di luar transaksi migrasi saat diterapkan.
- Indeks `(workspace_id)` lama kini redundan terhadap indeks baru; tiket terpisah untuk menghapusnya, setelah diukur.
- Batas 50 posting per akun pada JOB-03 (T-218.7) berdampak produk: komentar baru di posting yang lebih lama tidak ikut ditarik. Butuh konfirmasi King Rezi, kemungkinan amandemen ADR-157, sebelum dianggap final.

**Pengecualian E2E golden path (ADR-149, 2026-11-06, atas persetujuan merge King Rezi):** perubahan belum punya tampilan baru (UI "By post" ada di T-219 sampai T-224), jadi E2E golden path Engage digabung ke T-222. Suite E2E lokal yang ada hijau tanpa regresi (51 lulus; satu kegagalan CSP `next-devtools` di `next dev` sudah diperbaiki di `theme.e2e.ts`).

**Belum terbukti:** (0) T-218.5 belum dicentang: tes integrasi DB `aggregate-inbox-by-post.integration.test.ts` ditulis tetapi belum dijalankan (belum terverifikasi); isolasi workspace/RLS di Postgres dan manfaat indeks belum terbukti; (1) performa query pada volume besar (ratusan komentar per posting) belum diukur: tes integrasi DB `aggregate-inbox-by-post.integration.test.ts` ditulis tetapi opt-in (`ENGAGEMENT_DB_TEST=1` + `DATABASE_URL`) dan belum dijalankan di lingkungan ini; belum ada `EXPLAIN (ANALYZE)`; (2) migrasi indeks belum diterapkan ke DB manapun; (3) snapshot posting diambil per kelompok (maks 10 konkuren, maks 100 kelompok), belum ada query batch; (4) tes repository unit memakai tabel in-memory, bukan SQL sungguhan; (5) `listInboxByPostAction` belum dipanggil UI (T-219).

**Bukti DB (2026-11-06):** migrasi `20261106120000_t218_engagement_inbox_post_index` diterapkan King Rezi ke DB bersama; `aggregate-inbox-by-post.integration.test.ts` dijalankan (`ENGAGEMENT_DB_TEST=1`), 4 tes lulus (agregasi, filter, `listInboxItems` per posting, RLS antar-workspace). Fixture diperbaiki memakai `withCurrentUser` karena RLS. Manfaat indeks belum terukur (`EXPLAIN (ANALYZE)`; data staging kecil); butir (0), (2), dan bukti RLS pada daftar "Belum terbukti" di bawah sudah terpenuhi.

**Tindak lanjut review PR 264 (2026-11-06):** diperbaiki: posting kosong multi-akun satu kali, NULL `postId` lebih dulu pada pagar 5000, batas daftar per posting 1000 (pagination di T-219), akun utama kartu stabil (id terkecil), `done` dihitung `resolved` di filter status, validasi input pindah ke service. Belum dikerjakan: snapshot posting batch (satu query, butuh port baru di `publishing`), `includeEmpty` mengikuti rentang tanggal dan lebih dari 50 posting per akun, serta bukti isolasi RLS lewat tes integrasi DB (dijalankan setelah migrasi diterapkan).

**Blocked by:** T-217.

---

### T-219 · Engage UI: post list, selected post comments, and per-comment status actions

| Field       | Value                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| **Status**  | ⏳ Not Started                                                                                            |
| **Mode**    | AFK setelah T-216 dikonfirmasi                                                                            |
| **Domain**  | engagement · UI (UI/UX-related)                                                                           |
| **Spec**    | S-006                                                                                                     |
| **Docs**    | ADR-157, ADR-097, ADR-140, KSP-06, KSP-D06, `apps/web/.claude/CLAUDE.md`, artifact Postific (kartu T-216) |
| **Depends** | T-216, T-217, T-218                                                                                       |

**Gate rancangan:** rancangan T-216 sudah dikonfirmasi King Rezi. Bila sebuah butir ambigu, **STOP** dan tanya lewat `AskUserQuestion`; jangan menebak.

**What to build:** tata letak dua panel Engage per posting dan aksi status per komentar, sesuai rancangan. Komponen shadcn diverifikasi dulu lewat MCP shadcn (workflow discover-first); jangan menebak nama komponen atau props.

- [ ] **T-219.1** Panel daftar posting (kartu dengan badge, progress, kelompok "tanpa posting", panel bisa dilipat) menggantikan daftar item datar di `EngageInboxView.tsx`. Berkas besar (800 baris) dipecah menjadi komponen modul tanpa mengubah perilaku, seperti T-199.
- [ ] **T-219.2** Panel komentar: kartu pratinjau posting, ringkasan "x dibalas / y total", daftar komentar, area balas yang sudah ada (T-054) dipertahankan. Untuk kelompok "Tanpa posting" komposer nonaktif dengan pesan jelas (Outstand hanya membalas per posting, ADR-113; keputusan King Rezi 2026-11-06, B1); Resolve dan Dismiss tetap tersedia.
- [ ] **T-219.3** Aksi hover per komentar: Resolve, Dismiss, buka kembali; Reply membuka area balas. Optimistic update dan error ditangani; Server Action hanya memanggil service.
- [ ] **T-219.4** State: kosong, filter tanpa hasil, refresh berjalan dan gagal, selaras KSP-06 yang diperbarui. Zona sinkronisasi (KSP-06-F07, F08) dipertahankan.
- [ ] **T-219.5** Perilaku yang sudah ada tidak regresi: filter akun/platform/status, reply, post asal (T-056), badge sidebar, manual refresh. Terang, gelap, 375px diamati di browser.
- [ ] **T-219.6** Tes komponen dan unit; `typecheck`, `lint`, tes hijau.

**Belum terbukti:** perilaku di layar sempit (375px) dan keyboard/fokus aksi hover; dicek di T-219.5 dan T-222.

**Blocked by:** T-216 (konfirmasi rancangan), T-217, T-218.

---

### T-220 · Engage UI: primary filters and the Filter & Sort panel

| Field       | Value                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| **Status**  | ⏳ Not Started                                                                                       |
| **Mode**    | AFK setelah T-216 dikonfirmasi                                                                       |
| **Domain**  | engagement · UI (UI/UX-related)                                                                      |
| **Spec**    | S-006                                                                                                |
| **Docs**    | ADR-157, ADR-097, ADR-140, KSP-06-F02, `apps/web/.claude/CLAUDE.md`, artifact Postific (kartu T-216) |
| **Depends** | T-216, T-218, T-219                                                                                  |

**What to build:** filter utama di header (Akun, Status) dan satu panel sekunder (Sort By, Date Range, Reset filters), menggantikan tiga `Select` sejajar. Menyentuh berkas yang sama dengan T-219 (`EngageInboxView` dan turunannya): kerjakan setelah T-219.1 memecah berkas, bukan paralel.

- [ ] **T-220.1** Dropdown Akun/Channels dan Status (single-select bercentang) di header.
- [ ] **T-220.2** Panel Filter & Sort (komponen ditentukan rancangan, diverifikasi lewat MCP shadcn): Sort By, Date Range, Reset filters. Filter Platform berada di panel ini (keputusan King Rezi 2026-11-05 atas rancangan T-216).
- [ ] **T-220.3** Filter memicu query T-218 server-side seperti pola sekarang (`listInboxAction`); tanpa request ganda saat render awal.
- [ ] **T-220.4** Tes komponen; terang, gelap, 375px diamati; `typecheck`, `lint`, tes hijau.

**Blocked by:** T-219 (berkas bersama; T-216 dan T-218 sudah/segera terpenuhi).

---

### T-221 · Align UX and architecture baseline with the confirmed Engage by-post design

| Field       | Value                                                                                                                                                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**  | ✅ Done (2026-11-06, dokumentasi)                                                                                                                                                                                                               |
| **Mode**    | AFK (dokumentasi)                                                                                                                                                                                                                               |
| **Domain**  | dokumentasi · UX · arsitektur                                                                                                                                                                                                                   |
| **Spec**    | S-006                                                                                                                                                                                                                                           |
| **Docs**    | ADR-157, `product-discovery/04-ux/` (`key-screen-patterns.md`, `user-flows.md`, `navigation-patterns.md`, `information-architecture.md`), `product-discovery/05-architecture/domain-model.md`, `context/ctx-design.md`, `context/ctx-domain.md` |
| **Depends** | T-216                                                                                                                                                                                                                                           |

**What to build:** selaraskan semua dokumen baseline yang masih menggambarkan Engage lama (master-detail per item inbox, status `Unread` / `Done`, satu layar tanpa pilihan tampilan) dengan rancangan yang dikonfirmasi dan ADR-157: unit per posting, status `unread` / `replied` / `resolved` / `dismissed`, panel Filter & Sort, toggle By post / List. Batas MVP tetap menyebut Mentions dan DM di luar (ADR-040). Urutan tulis: `product-discovery/` dulu, lalu `context/` hanya bila penunjuknya berubah (`AGENTS.md` aturan 14). Jangan menyalin paragraf yang sama ke banyak berkas; rujuk KSP-06 sebagai rumah rinciannya.

**Hasil audit (2026-11-06, grep atas `product-discovery/` dan `context/`):**

| Dokumen                                                | Yang usang                                                                                                                                                                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `04-ux/key-screen-patterns.md` (KSP-06, D06)           | Master-detail per item, tiga filter, status Unread/Done, "Mark as Done", Critical Functions F01 sampai F08, State Handling                                                                                       |
| `04-ux/user-flows.md` (UF-04, baris 214-259)           | Filter `Unread / Done`, tandai `Done`, antrean urut waktu masuk; alur badge ke Inbox                                                                                                                             |
| `04-ux/navigation-patterns.md` (214, 327-331)          | "Engage hanya satu layar: Inbox, tanpa tab"; pola master-detail inline. Toggle By post / List bukan navigasi tab; kalimatnya perlu disesuaikan                                                                   |
| `04-ux/information-architecture.md` (152-167, 254-255) | Struktur Engage dan peta "Comments (view + reply)"; Engagement Snapshot (baris 111) tetap menghitung `unread` (Q4), cukup dicek                                                                                  |
| `05-architecture/domain-model.md` (363)                | `InboxItemStatus` ditulis `unread \| read \| replied \| archived`; **sudah menyimpang dari kode** (`unread \| done`) sebelum ADR-157. Jadikan `unread \| replied \| resolved \| dismissed` dan sebut transisinya |
| `context/ctx-domain.md`, `context/ctx-design.md`       | Hanya diubah bila penunjuknya berubah; kemungkinan tidak perlu                                                                                                                                                   |

- [x] **T-221.1** KSP-06 dan KSP-D06 diperbarui (Critical Functions, Zona Fungsional, State Handling, Pola Notification Badge); tag amandemen ADR-157 ditambahkan.
- [x] **T-221.2** ADR-157 `Proposed` → `Accepted` (2026-11-05, setelah Q1 sampai Q5 dijawab King Rezi); indeks `DECISIONS.md` ikut.
- [x] **T-221.3** `user-flows.md` UF-04 (dan tabel ringkasnya) disesuaikan: pilih posting, status baru, Resolve / Dismiss / buka kembali, panel Filter & Sort.
- [x] **T-221.4** `navigation-patterns.md` dan `information-architecture.md` disesuaikan: Engage tetap satu layar tanpa tab navigasi, dengan pilihan tampilan By post / List di dalamnya; peta konten diperbarui.
- [x] **T-221.5** `domain-model.md` BC Engagement: `InboxItemStatus` dan aturan transisi diselaraskan dengan ADR-157 (koreksi drift lama ikut).
- [x] **T-221.6** Tinjau `context/ctx-domain.md` dan `context/ctx-design.md`; ubah hanya bila penunjuknya berubah.
- [x] **T-221.7** `bun run docs:check` hijau.

**Hasil (2026-11-06):** KSP-06 ditulis ulang (Critical Functions F01 sampai F09, tabel status dan transisi, zona, state, pola badge) dan KSP-D06 serta baris konfirmasi "Resolve / Dismiss" diselaraskan; UF-04 (langkah, alternate path, UXP-03), `navigation-patterns.md` (badge, Engage satu layar dengan pilihan tampilan, pola ekspansi), `information-architecture.md` (struktur Engage, peta konten), dan `domain-model.md` (`InboxItemStatus`, transisi, query per posting; drift lama `unread | read | replied | archived` terkoreksi) diperbarui. `ctx-domain.md` dan `ctx-design.md` ditinjau dan tidak diubah: penunjuknya tidak berubah. Baris Engagement Snapshot di IA dan KSP-01-F03 tetap benar (menghitung `unread`, Q4).

**Audit lanjutan (2026-11-06, `docs-consistency-audit` topik engage, scope inti sekitar 33 berkas):** 10 temuan kelas A diperbaiki di sesi yang sama: `database-strategy.md` (status, `read_at`), `application-layer.md` (tabel `EngagementService`, catatan kontrak MCP `list_comments`), `integration-layer.md` (nama atribut), `navigation-patterns.md` (NP-D03 dan istilah thread), `key-screen-patterns.md` (ringkasan KSP-06), `roles-permissions.md` (aksi Resolve/Dismiss), S-006, T-216 sampai T-222, antrean, dan `PROJECT_STATE.md`. Temuan kelas B (B1 sampai B10) menunggu keputusan King Rezi dan belum diubah.

**Belum terbukti:** apakah ada dokumen lain yang menyebut model lama dengan istilah berbeda; audit memakai grep istilah (`Mark as Done`, `Unread / Done`, `KSP-06`, `Comments Inbox`, `InboxItem`), bukan pembacaan semua berkas.

**Blocked by:** T-216.

---

### T-222 · Engage by post: QA and verification

| Field       | Value                                                                  |
| ----------- | ---------------------------------------------------------------------- |
| **Status**  | ⏳ Not Started                                                         |
| **Mode**    | AFK untuk E2E, review, dan QA; HITL untuk Verified (staging)           |
| **Domain**  | engagement · QA                                                        |
| **Spec**    | S-006                                                                  |
| **Docs**    | ADR-149, ADR-153, ADR-157, `apps/web/e2e/`, `.claude/agents/README.md` |
| **Depends** | T-219, T-220, T-224                                                    |

**What to build:** bukti bahwa Engage per posting bekerja dan tidak merusak yang sudah ada.

- [ ] **T-222.1** E2E Playwright golden path (ADR-149): buka Engage, pilih posting, balas komentar, Resolve, Dismiss, buka kembali, filter status, Sort, Date Range, Reset, dan pindah By post / List. Hijau tiga run di `local`. Konvensi `e2e-data.ts` (workspace E2E Sandbox) diikuti; tes tidak memublikasikan di workspace produksi.
- [ ] **T-222.2** Regresi: filter akun/platform, reply (T-054), post asal (T-056), badge sidebar, Engagement Snapshot Home, manual refresh.
- [ ] **T-222.3** Review arsitektur Ridwan dan QA Najwa tanpa temuan terbuka; `/code-review`; `typecheck`, `lint`, tes hijau.
- [ ] **T-222.4** Done (code). Verified (staging) satu kali per gelombang (ADR-153) untuk hal yang tidak bisa dibuktikan lokal; bagian "Belum terbukti" tiket T-217 sampai T-220 dan T-224 tetap wajib sampai butirnya lulus.

**Blocked by:** T-219, T-220, T-224.

---

### T-224 · Engage UI: List view (By post / List toggle)

| Field       | Value                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| **Status**  | ⏳ Not Started                                                                                                 |
| **Mode**    | AFK setelah T-216 dikonfirmasi                                                                                 |
| **Domain**  | engagement · UI (UI/UX-related)                                                                                |
| **Spec**    | S-006                                                                                                          |
| **Docs**    | ADR-157 (Q5), ADR-097, ADR-140, KSP-06, KSP-D06, `apps/web/.claude/CLAUDE.md`, artifact Postific (kartu T-216) |
| **Depends** | T-216, T-218, T-219                                                                                            |

**Gate rancangan:** mode List Buffer belum teramati (hanya tombolnya), jadi isi tampilan List sepenuhnya diputuskan di rancangan T-216.5 dan dikonfirmasi King Rezi. Bila ambigu, **STOP** dan tanya lewat `AskUserQuestion`; jangan menebak.

**What to build:** toggle By post / List di header (komponen diverifikasi lewat MCP shadcn) dan tampilan List sesuai rancangan. Menyentuh berkas yang sama dengan T-219 dan T-220: kerjakan setelah T-219, bukan paralel.

- [ ] **T-224.1** Toggle By post / List di header; By post tetap bawaan. Pilihan tampilan boleh diingat per pengguna hanya bila rancangan menyebutnya.
- [ ] **T-224.2** Tampilan List sesuai rancangan T-216.5, memakai query T-218 (tanpa query baru kecuali rancangan menuntutnya).
- [ ] **T-224.3** Filter utama dan panel Filter & Sort (T-220) berlaku konsisten di kedua tampilan; aksi status per komentar (T-219.3) juga tersedia di List.
- [ ] **T-224.4** Tes komponen; terang, gelap, 375px diamati; `typecheck`, `lint`, tes hijau.

**Belum terbukti:** perilaku List dengan volume komentar besar (paginasi atau pengguliran); dicek di T-224.4 dan T-222.

**Blocked by:** T-216, T-218, T-219.

---

### T-223 · Engage Mentions tab (Instagram story mentions)

| Field       | Value                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| **Status**  | ⏸️ Deferred (keputusan King Rezi 2026-11-05)                                                                         |
| **Mode**    | HITL                                                                                                                 |
| **Domain**  | engagement · integrasi Outstand                                                                                      |
| **Spec**    | tidak ada — ditunda                                                                                                  |
| **Docs**    | ADR-157, ADR-040, `outstand.so/docs` (Webhooks; Conversations: Message Lifecycle, bagian Story replies and mentions) |
| **Depends** | ADR baru yang mengubah ADR-040                                                                                       |

**Alasan ditunda:** Outstand tidak punya endpoint atau event mention di feed dan tidak punya tag. Satu-satunya jalur adalah story mention dan story reply Instagram lewat Conversations API (`message.received` dengan objek `story`, `type` `reply` atau `mention`). Itu DM, di luar MVP (ADR-040). Kendala: URL story kedaluwarsa 24 jam dan medianya tidak boleh disimpan; mention hanya dari akun publik atau privat yang mengikuti; hanya Instagram; syarat izin dan tipe akun tidak tertulis di docs.

**Bila dibuka kembali:** perlu ADR yang mengubah ADR-040, tabel atau tipe data baru, penanganan media yang kedaluwarsa, dan rancangan sendiri. Labelnya lebih jujur sebagai pesan atau story Instagram, bukan Mentions penuh seperti Buffer.

---

## Catatan Rilis

- T-216 sampai T-223 (Engage per posting, spec S-006, ADR-157) ditambahkan 2026-11-05 setelah rilis v0.4 selesai; ADR-040 tetap berlaku (Mentions dan DM di luar).
- T-057–T-059 sengaja dikosongkan sebagai ruang penambahan task v0.4 (T-056 sudah terpakai, 2026-10-06 — promosi KI-065).
- **Definition of Done rilis ini:** pengguna dapat membaca dan membalas komentar tanpa berpindah platform, dengan data diperbarui setiap 30 menit atau lewat manual refresh.
- **Yang sengaja di luar rilis ini (ADR-040 + `feature-priority.md`):** Social Listening, Direct Messages, Mentions, Engagement Webhooks.
