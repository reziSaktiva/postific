# COMPLETE_TASK

> ⚠️ **PERINGATAN KERAS — JANGAN BACA ISI FILE INI KECUALI DIPERINTAHKAN SECARA EKSPLISIT oleh King Rezi.**
> File ini adalah riwayat lengkap seluruh task/perubahan yang sudah selesai sejak awal project (ribuan baris). Untuk status terkini, cukup baca section **Snapshot** di `PROJECT_STATE.md`. AI dilarang membuka/membaca isi lengkap file ini secara proaktif — hanya boleh dibaca saat King Rezi secara eksplisit meminta riwayat lengkap atau menyebut file ini.
> **Pengecualian:** menambahkan entri baru di bagian atas (tepat di bawah `---` ini) setelah sesi kerja selesai tetap **wajib** — itu operasi tulis/append, bukan baca, dan tidak memerlukan membaca entri-entri lama di bawahnya.

Seluruh perubahan penting pada dokumentasi maupun implementasi project dicatat pada dokumen ini.

---

## 2026-10-09 — Nama Produk Final "Postific" — Rename Package Scope `@social/*` → `@postific/*` (ADR-124)

King Rezi memutuskan nama produk final: **Postific** (sudah punya nama di kepala sebelum sesi, bukan hasil brainstorm AI; sesi awalnya menawarkan bantuan brainstorm, dibatalkan). Scope diputuskan via `AskUserQuestion`: cakupan penuh (dokumentasi + identifier teknis), status final (hapus label "Working Title").

**Kode:** `package.json` root (`social-media-management` → `postific`), `apps/web/package.json` (`@social/web` → `@postific/web`, dependency `@social/shared` → `@postific/shared`), `packages/shared/package.json` (`@social/shared` → `@postific/shared`), alias `apps/web/tsconfig.json` + `vitest.config.ts`, string test di `eslint-rules/local-rules.test.ts`, string literal `apps/web/src/app/api/health/route.ts`. Seluruh import `@social/shared` di `apps/web/src/**/*.ts(x)` (±150 file) di-replace via `sed` ke `@postific/shared`. `bun.lock` di-regenerate via `bun install` (bukan edit manual). Diverifikasi: `bun run typecheck` PASS (0 error), `bun run test` PASS (649 passed / 6 skipped, 0 failed).

**Dokumentasi:** `README.md`, `AGENTS.md` (judul saja), `project-manager/PROJECT_OVERVIEW.md` (field Project Name, hapus `*(Working Title)*`), `project-manager/ARCHITECTURE_OVERVIEW.md`, seluruh `product-discovery/01-business/` s.d. `06-engineering/` — diganti "Postific" **hanya** untuk pemakaian proper-noun (nama produk kita). Frasa kategori/industri generik ("platform Social Media Management yang sudah ada", "tool Social Media Management", "kategori Social Media Management" di `competitor-analysis.md`/`discovery-plan.md`/sebagian `product-vision.md`/`product-scope.md`) **sengaja dibiarkan** karena merujuk ke kategori produk di market, bukan brand kita — rename di situ akan merusak makna kalimat.

**Sengaja TIDAK diubah:** badan teks ADR lama (`project-manager/decisions/ADR-*.md`) dan isi `COMPLETE_TASK.md` sebelumnya (historical, append-only — bukan ditulis ulang); seluruh referensi project **Claude Design** (`DesignSync`, projectId `84aded99-bb23-49b1-be9f-dd8f21c6873e`) yang masih **literal** bernama "Social Media Management" di sistem eksternal itu (`AGENTS.md` rule 17, `context/ctx-design.md`, `PROJECT_STATE.md`, `tasks/v01-foundation.md`/`v02-publishing-mvp.md`/`v07-astryx-shadcn-migration.md`, `design-tokens.md`) — mengubah teksnya tanpa rename project aslinya di Claude Design akan membuat dokumentasi tidak sinkron dengan kenyataan; serta nama repo GitHub (`social-media-management`, seluruh link PR historis tetap valid), project Railway, dan folder clone lokal — resource eksternal yang rename-nya butuh aksi terpisah (akses GitHub/Railway/filesystem), bukan text-edit, dan belum diminta King Rezi.

Keputusan dicatat di **ADR-124**. Lihat `DECISIONS.md` untuk ringkasan.

---

## 2026-10-09 — Hardening code-review PR #149 (T-112, branch `feature/t-112`) — 4 temuan diperbaiki, status T-112 tetap ✅ Done

King Rezi menjalankan `/code-review` manual atas PR [#149](https://github.com/reziSaktiva/social-media-management/pull/149) (T-112) sebelum merge ke `staging`, lalu minta semua temuan diperbaiki. Review menemukan 4 temuan nyata (di luar 1 nit stale docstring yang sudah dicatat Ridwan di sesi T-112 sebelumnya):

1. **(High)** `ImportPostsTriggerUseCase.runImportSync` tidak pernah membaca `jobOutcome.error` di jalur sukses (`status: "completed"`) — padahal real API `partial` dipetakan ke `"completed"` DENGAN `error` berisi ringkasan kegagalan sebagian (ADR-123). Info ini hilang total: job tercatat `"done"` polos, tidak ada jejak sama sekali, kontradiksi tujuan desain ADR-123 sendiri. Fix: `partialWarning` baru diteruskan ke `markImportSyncJobStatus(job.id, "done", partialWarning)` (status job tetap `"done"`, bukan `"failed"`) dan ke `ImportSyncTriggerResult.message`.
2. **(High)** Pesan error timeout-polling ("coba Sync Now lagi dalam beberapa menit") kontradiksi dengan guard `MANUAL_COOLDOWN_MS` (24 jam) yang sungguhan berlaku pada percobaan manual berikutnya (`lastImportRequestedAt` sudah diupdate SEBELUM polling dimulai, persist-dulu ADR-093 poin 6) — pesan diperbaiki agar tidak menjanjikan jendela retry yang salah.
3. **(Medium)** `RealOutstandAdapter.fetchImportJobStatus` memanggil `GET /v1/posts` untuk data post job `completed`/`partial` hanya difilter `social_account_id` + `limit`, tanpa korelasi waktu ke job spesifik (endpoint tidak punya filter `importJobId`). Ditambahkan `created_after`/`created_before` dari `since`/`until` job — field diverifikasi ADA lewat WebFetch `api.outstand.so/v1/posts/openapi.json` — untuk mempersempit risiko match post lain di akun yang sama di luar rentang job ini. Didokumentasikan sebagai perbaikan best-effort (filter waktu DIBUAT di Outstand, bukan `publishedAt` platform), bukan korelasi sempurna.
4. **(Low)** Komentar test timeout-polling (`import-posts-trigger.use-case.test.ts`) salah hitung jumlah panggilan ("call ke-13"); dihitung ulang jadi 14 `fetchImportJobStatus`/13 `sleep`, assertion diperketat dari `toBeGreaterThan(1)` ke angka pasti.

Test baru ditambahkan untuk temuan #1 (skenario `partial` → `jobOutcome.error` tetap diteruskan). 2 test lama disesuaikan (argumen ke-3 `markImportSyncJobStatus` baru + query string `/v1/posts` baru). `typecheck`/`lint` PASS, `bun run test` 649 passed/6 skipped/0 failed (naik dari 648 — satu test baru). Scope diff hanya 4 file (2 kode + 2 test), tidak menyentuh kontrak publik `packages/shared`, tidak ada ADR baru (perbaikan perilaku internal yang konsisten dengan ADR-123, bukan amandemen keputusannya). Dikerjakan di sesi utama (bukan subagent terpisah) langsung di branch `feature/t-112` (belum di-push/PR-kan ulang — menunggu instruksi King Rezi untuk commit/push).

Dokumen diupdate: `project-manager/tasks/v02-publishing-mvp.md` § T-112 (entri baru, status tetap `✅ Done`, bukan subtask baru).

---

## 2026-10-09 — T-112 ✅ Done (5/5 subtask) — Fix bug polling status async + verifikasi end-to-end berhasil

Melanjutkan sesi 2026-10-08 (T-112.1–T-112.4 sudah selesai, T-112.5
tertunda 3x berturut-turut karena cooldown manual 24 jam + keterbatasan
sandbox). King Rezi akhirnya mencoba "Sync Now" setelah cooldown berakhir
dan menemukan bug baru: tombol selalu berakhir gagal dengan pesan status
`pending`.

**Root cause:** `ImportPostsTriggerUseCase.runImportSync`
(`apps/web/src/domains/publishing/services/import-posts-trigger.use-case.ts`)
hanya memanggil `fetchImportJobStatus` sekali langsung setelah
`importPosts()` — padahal job Outstand betulan async (butuh waktu
diproses), jadi status pertama yang didapat hampir selalu
`pending`/`queued`/`running` dan langsung ditandai gagal. Bug ini murni di
lapisan use-case trigger, bukan di adapter/kontrak yang sudah diverifikasi
T-112.1–T-112.4 — ADR-123 tidak berubah.

**Fix (Elon Backend Engineer):**
- Method privat baru `pollImportJobStatus` — polling `fetchImportJobStatus`
  tiap 2 detik sampai status resolve (`completed`/`failed`) atau timeout 25
  detik (margin dari budget 30 detik BG-D05 job runner).
- Timeout dengan status masih `pending` → pesan error baru yang
  membedakan "masih diproses, coba lagi nanti" dari kegagalan permanen.
- Parameter `sleep: SleepFn` opsional baru di constructor untuk injeksi
  test (default `setTimeout` asli) — composition root
  (`outstand-workspace-service.ts`) tidak perlu diubah.
- Guard cooldown manual 24 jam (`MANUAL_COOLDOWN_MS`) sempat dinonaktifkan
  sementara untuk kebutuhan testing berulang, lalu di-revert penuh.
- 3 test baru untuk perilaku polling. Total test naik ke 648 passed/6
  skipped/0 failed.

**Review Ridwan Architecture Reviewer:** array temuan kosong (tidak ada
pelanggaran arsitektur/bug blocking). Guard cooldown dikonfirmasi utuh
100% (tidak ada sisa bypass). Satu catatan non-blocking: docstring
`pollImportJobStatus` menyebut status "partial" padahal nilai itu sudah
dipetakan jadi "completed" sebelum sampai ke use-case ini (ADR-123) —
sedikit stale, tidak wajib diperbaiki.

**T-112.5 verifikasi end-to-end — akhirnya berhasil:** testing sungguhan
di dev server + DB Supabase dev nyata, user `rezi@insvire.com`, workspace
"Lunch", akun Facebook "Cook It Real Good"
(`connectedAccountId=d17e38ce-fbae-434c-ab27-e417fca384ab`,
`outstandAccountId=Kav29`):
- Klik "Sync Now" → tombol "Syncing..." selama ±20 detik (konsisten
  polling) → kembali normal, tidak langsung gagal.
- Calendar menampilkan 16+ post asli berstatus `Imported` (4 di Oktober:
  tanggal 4,5,6,7 + 12+ di September, rentang lookback 90 hari).
- Detail post diverifikasi: caption lengkap dan masuk akal (contoh: "Air
  Fryer Roast Beef (Ultimate Guide)..." dengan hashtag), badge "Imported"
  terpasang, platform Facebook benar.

**Observasi non-blocking (di luar scope T-112, tidak dibuatkan task/KI
baru):** popover post menampilkan "Media belum tersedia untuk preview" —
`mediaUrls` sudah benar terisi di backend, tapi thumbnail-nya belum
di-render di UI Imported. Terkait rancangan Claude Design yang menurut
catatan T-090.5 sebelumnya memang masih `blocked`. Dicatat sebagai
observasi/saran untuk King Rezi, bukan gap governance.

Dokumentasi diperbarui: `tasks/v02-publishing-mvp.md` § T-112 (status
`✅ Done` 5/5 subtask, update log baru), `TASKS.md` (hitungan v0.2:
25 ✅ · 2 🟡 · 1 ⏳), `PROJECT_STATE.md` (Snapshot Top Next Tasks,
Completed Ringkasan — bullet T-111 lama digeser keluar untuk menjaga
batas 5 item).

---

## 2026-10-08 — T-112 4/5 subtask (T-112.1–T-112.4 selesai, T-112.5 pending) — Wiring Outstand import sungguhan + ADR-123 baru

Menutup gap yang ditinggalkan T-090 (✅ Done tanpa wiring HTTP sungguhan ke
endpoint import Outstand — sebelumnya sengaja stub-throw, ADR-059/ADR-119
"throw loud"). Implementasi Elon Backend Engineer, 1 putaran review Ridwan
Architecture Reviewer, QA Najwa QA Engineer — semua dalam sesi ini.

**Implementasi (Elon Backend Engineer):**
- `RealOutstandAdapter.importPosts` — wiring sungguhan `POST
  /v1/social-accounts/{id}/imports` (diverifikasi OpenAPI spec resmi
  Outstand, diambil 2026-10-08), ganti stub-throw.
- `RealOutstandAdapter.fetchImportJobStatus` — wiring sungguhan, DUA
  panggilan HTTP: `GET /v1/social-accounts/{id}/imports/{importId}`
  (status + ringkasan angka) lalu, kalau status `completed`/`partial`,
  `GET /v1/posts?social_account_id=...` (data post sesungguhnya — endpoint
  status ternyata tidak membawanya), difilter via `socialAccounts[]` yang
  cocok `id` + `status === "published"`.
- **Breaking change kontrak publik** `IOutstandAdapter.fetchImportJobStatus`
  — signature berubah dari `(importJobId)` jadi
  `(outstandAccountId, importJobId)` (endpoint sungguhan mensyaratkan
  account id di path). Call site `ImportPostsTriggerUseCase.runImportSync`
  diupdate.
- Pemetaan status real API (5 nilai: `queued|running|completed|failed|
  partial`) ke kontrak `ImportJobStatus` (3 nilai): `queued`/`running` →
  `pending`; `completed` → `completed`; **`partial` → `completed`** (post
  berhasil tetap diambil, TIDAK di-drop, `error` diisi ringkasan jumlah
  post gagal — keputusan produk King Rezi, disetujui via
  `AskUserQuestion`); `failed` → `failed`; status tak dikenal → throw
  `OutstandIntegrationError`.

**Review (Ridwan Architecture Reviewer) — 1 putaran, lulus bersih setelah
perbaikan:**
- **Temuan kritis:** kode sudah menyebut "ADR-123" 7x di komentar/docstring
  tapi file ADR-nya belum pernah dibuat (melanggar `AGENTS.md` rule 4) —
  ditutup dengan membuat `decisions/
  ADR-123-wiring-import-posts-fetchimportjobstatus-outstandaccountid-partial-status-ki112.md`
  (sesi dokumentasi ini).
- 2 temuan ringan (sudah diperbaiki sebelum review ditutup): sitasi OpenAPI
  untuk `GET /v1/posts` diperjelas (dicek langsung endpoint LIST, bukan
  diekstrapolasi dari endpoint singular); `console.warn` ditambahkan untuk
  kasus `imported > 0` tapi 0 post berhasil dipetakan (kemungkinan drift
  shape API Outstand — diperlakukan sebagai 0 post, bukan error, tapi
  perlu visibility).

**QA (Najwa QA Engineer):** tidak ada regresi — `git diff --stat` tidak
menyentuh file UI apa pun, `typecheck`/`lint` PASS, `bun run test` 645
passed/6 skipped/0 failed. **T-112.5 (verifikasi end-to-end browser+DB
real) belum tuntas** — dua blocker: (1) guard cooldown manual 24 jam
(`MANUAL_COOLDOWN_MS`, ADR-093 poin 9) sudah terpakai oleh percobaan sync
sebelumnya pada akun test "Cook It Real Good", cooldown sampai
`2026-10-09T08:42:24Z`; (2) sandbox Najwa tidak bisa akses `.env.local`/MCP
Supabase untuk verifikasi DB langsung — gap verifikasi ini sudah terjadi
3x berturut-turut di sesi berbeda (T-090 sebelumnya + 2 percobaan T-112
ini). Tidak ada bukti bug.

**Status:** T-112 `🟡 In Progress (4/5 subtask)`. Saran untuk King Rezi:
coba "Sync Now" lagi setelah `2026-10-09T08:42:24Z` untuk menuntaskan
T-112.5 dan menutup task ini penuh.

Dokumen diupdate: `project-manager/decisions/ADR-123-...md` (baru),
`DECISIONS.md`, `tasks/v02-publishing-mvp.md` § T-112, `TASKS.md` (hitungan
v0.2: 24 ✅ · 3 🟡 · 1 ⏳), `PROJECT_STATE.md` (Snapshot Top Next Tasks,
Recent Decisions Ringkasan).

---

## 2026-10-08 — T-090 TUNTAS 5/5 subtask (T-090.5 UI selesai) — Import Posts dari Social Account, ADR-093

Penutup rangkaian T-090 (lanjutan langsung dari dua entri di bawah:
T-090.1–T-090.4 + bug RLS silent-noop). T-090.5 (UI terakhir yang tersisa)
selesai diimplementasikan, direview, dan di-QA pada sesi worktree
`claude/t-090-e6bb6d`.

**Implementasi (Mark UI Engineer):**
- Badge `Imported` — variant `outline` (reuse token `Draft`; dikoreksi dari
  rekomendasi awal `secondary` di catatan Claude Design — baseline kode
  nyata `Draft` memang `outline` — catatan Claude Design juga dikoreksi
  menyusul).
- `CalendarPostPopover.tsx` — varian read-only untuk Imported: tombol
  "Buka Draft Editor" dihilangkan total, diganti link
  "Lihat di [Platform] →" (fallback disabled kalau `platformPostUrl`
  kosong), ditambah catatan read-only, metrics block tidak ditampilkan.
- `ConnectedAccountsList.tsx` — `SyncNowButton` baru (3 state:
  default/loading/ditolak), muncul sebelum badge status HANYA untuk akun
  `active` + role dengan akses kelola Connected Accounts (RBAC hide total
  untuk Creator). Variant `secondary` (padanan terdekat "aksi rutin",
  karena "Disconnect" asli sudah `destructive`, bukan match literal
  mockup).

**Pelonggaran filter (Prabowo Feature Engineer):**
`PublishingService.listCalendarPosts`/`getCalendarPostById` — konstanta
`CALENDAR_DEFAULT_STATUSES_EXCLUDING_IMPORTED` (placeholder sementara dari
T-090.1-4) DIHAPUS, post `Imported` sekarang tampil apa adanya di
Calendar.

**Bug ditemukan+fix (Najwa QA Engineer menemukan, Elon Backend Engineer
memperbaiki):** klik "Sync Now" tanpa `OUTSTAND_API_KEY` CRASH halaman
total (Next.js Runtime Error overlay, bukan toast rapi seperti didesain)
— root cause: `getOutstandAdapter()`
(`apps/web/src/lib/adapters/outstand/index.ts`) melempar `Error` polos,
sementara `toActionError()` (dipakai banyak file `actions.ts` lain di
seluruh codebase) hanya menangani `instanceof ApplicationError`. Fix:
ganti jadi `throw new ExternalServiceError(...)` (class di `errors.ts`,
extends `ApplicationError`). **Dampak perbaikan ini lebih luas dari
T-090.5** — memperbaiki pola yang sama di SEMUA Server Action lain yang
memanggil `getOutstandAdapter()` tanpa key terisi, bukan hanya Sync Now.
Ini bug-fix teknis (pola exception-handling, bukan keputusan arsitektur
baru) — tidak perlu ADR baru, meski terkait erat dengan jalur
`getOutstandAdapter()` yang diperkenalkan ADR-119.

**Gap verifikasi (dicatat, bukan Known Issue formal):** verifikasi visual
end-to-end tombol "Sync Now" (klik → lihat toast rapi di browser) belum
bisa dituntaskan — baik sesi Elon maupun sesi utama dibatasi sandbox
("Modify Shared Resources") saat mencoba menulis fixture
`WorkspaceConnectedAccount` langsung ke database dev (workspace yang
tersedia tidak punya akun terhubung, dan connect akun baru lewat UI
sekarang butuh `OUTSTAND_API_KEY` asli sejak ADR-119 — jalur Fake loopback
sudah dihapus). Fix sudah diverifikasi lewat pembacaan kode manual, unit
test `index.test.ts`, dan grep menyeluruh ke semua test yang menyentuh
`getOutstandAdapter` (tidak ada regresi) — bukan lewat klik browser
sungguhan. Tidak dibuat KI formal karena ini bukan bug yang diketahui
ada, hanya verifikasi yang tertunda; dicatat di `tasks/v02-publishing-mvp.md`
§ T-090 sebagai pengingat untuk sesi dengan akses DB penuh.

**Review (Ridwan Architecture Reviewer):** bersih, tidak ada pelanggaran
AGENTS.md #5-9. 1 temuan dokumentasi minor (komentar basi di
`calendar-grid-shared.ts` yang masih mengklaim Imported di-exclude) —
sudah diperbaiki.

**Insiden proses (pelajaran untuk sesi berikutnya):** sesi utama sempat
lupa update task file untuk mencerminkan "tidak lagi blocked" setelah
desain T-090.5 dikunci di Claude Design — Mark UI Engineer (benar)
sempat menghentikan pekerjaan karena source-of-truth task file
bertentangan dengan brief yang diterima. Sudah dikoreksi. Pelajaran:
setiap kali sesi utama mengerjakan Claude Design sebagai fallback Neymar,
WAJIB langsung update task file di commit/turn yang sama, jangan ditunda.
Mark UI Engineer dan Najwa QA Engineer juga tidak punya akses `DesignSync`
di sesi subagent (pola sama 9 kejadian sebelumnya) — isi rancangan
diteruskan manual oleh sesi utama.

**Verifikasi final:** `bun run typecheck`/`lint` PASS, `bun run test` 638
passed/6 skipped/0 failed.

**Status akhir:** T-090 `✅ Done` (5/5 subtask: T-090.1–T-090.4 sejak
entri di bawah, T-090.5 selesai sekarang). TASKS.md indeks v0.2 diperbarui
24 ✅ · 2 🟡 · 1 ⏳ (dari 23 ✅ · 2 🟡 · 2 ⏳), Total 64 selesai (dari 63).
Detail lengkap: `tasks/v02-publishing-mvp.md` § T-090 (update final,
2026-10-08), `decisions/DECISIONS.md` (ADR-093).

---

## 2026-10-08 — Bug RLS silent-noop di `updateImportWatermark` ditemukan+fixed (T-090, lanjutan sesi di bawah) — ditemukan via testing browser+DB sungguhan King Rezi

Lanjutan langsung dari entri T-090.1–T-090.4 di bawah (sesi yang sama,
branch worktree `claude/t-090-e6bb6d`). Setelah klaim T-090.1–4 "selesai"
(unit test hijau + review Ridwan + QA Najwa lulus — semuanya memakai fake
repository), King Rezi minta diuji langsung di browser. Sesi utama (bukan
subagent) setup `.env.local`, `bunx prisma migrate deploy` migration
T-090.1 ke database dev Supabase sungguhan, jalankan dev server, test alur
Connect Account (Settings → Connected Accounts) yang men-trigger
auto-import.

**Bug ditemukan:** `updateImportWatermark`
(`apps/web/src/lib/repositories/workspace/workspace.repository.ts`)
memakai `prisma` client plain, bukan `withCurrentUser(actingUserId, ...)` —
padahal `workspace_connected_accounts` punya RLS policy `FOR ALL` yang
butuh `app.current_user_id`. Tanpa itu, `updateMany` selalu match 0 baris
secara senyap (silent no-op by design). Akibat: `lastImportedUntil`/
`lastImportRequestedAt` tidak pernah tersimpan ke database sungguhan,
meski use-case memanggilnya benar dan job tercatat `status: "done"`. Lolos
dari unit test + code review + QA sebelumnya karena ketiganya pakai fake
repository, tidak ada test Prisma+RLS asli.

**Dampak sebelum fix:** watermark ADR-093 poin 6 (cegah pemborosan call
Outstand berbayar) gagal total; guard cooldown 24 jam manual trigger
(ADR-093 poin 9) tidak pernah aktif. Data `PublishingPost` tidak korup
(dedup `platformPostId` tetap benar).

**Fix (Elon Backend Engineer):** kontrak `IWorkspaceRepository.updateImportWatermark`
+ port lokal `ConnectedAccountWatermarkPort` sekarang wajib
`actingUserId: UserId` (signature publik use-case tidak berubah).
Implementasi Prisma dibungkus `withCurrentUser(actingUserId, ...)`,
konsisten presedan `reconnectAccount`/`disconnectAccount`/
`createConnectedAccount`. Docstring salah dikoreksi. Test unit diupdate.

**Verifikasi final (sesi utama, 2x independen):** `bun run
typecheck`/`lint`/`test` → PASS, 350 passed/5 skipped/0 failed. Live
end-to-end di database dev Supabase sungguhan: connect LinkedIn baru
("Fake Company 7283") → 4 `PublishingPost` `Imported` ter-insert benar,
watermark masih `null` (bug reproduce dikonfirmasi). Setelah fix, ulangi
dengan akun TikTok baru ("@fake.tiktok.3902") → watermark tersimpan benar
(`2026-10-08T04:33:30.150Z`), 4 post `Imported` lagi ter-insert benar. Bug
resolved, diverifikasi 2x independen. Data test dibiarkan di database dev
workspace `b28e4284-39e5-4d24-ad27-32c2cb286880` (konsisten fixture lain
yang sudah ada di situ).

Status T-090.1–T-090.4 tetap dianggap selesai dari sisi implementasi
(bug sudah diperbaiki dan diverifikasi ulang) — ini koreksi/pelengkap
catatan, bukan regresi status. **T-090 tetap `🟡 In Progress`** (T-090.5
UI masih `blocked`). Pelajaran pattern-risk lebih luas (tidak ada test
Prisma+RLS asli di codebase) dicatat di `tasks/v02-publishing-mvp.md` §
T-090 addendum — dipertimbangkan tidak dibuatkan KI baru terpisah (lihat
alasan di `PROJECT_STATE.md`, section Known Issues tidak diubah untuk
ini) karena bug sudah fixed+resolved dalam sesi yang sama sebelum sempat
sampai production, dan menambah KI yang langsung berstatus Resolved
hanya akan langsung dihapus lagi oleh guardrail ukuran Known Issues.
Detail lengkap: `tasks/v02-publishing-mvp.md` § T-090 (addendum
2026-10-08).

---

## 2026-10-08 — T-090.1–T-090.4 selesai (4/5 subtask) — Import Posts dari Social Account, ADR-093; KI-059 baru

Branch worktree `claude/t-090-e6bb6d`. Rangkaian: Elon Backend Engineer →
Ridwan Architecture Reviewer (2 temuan, diperbaiki) → Najwa QA Engineer
(lulus; 1 gap test minor ditambal langsung oleh sesi utama). Verifikasi
akhir: `bun run typecheck` PASS, `bun run lint` PASS, `bun run test` → 350
passed, 5 skipped, 0 failed. **T-090.5 (UI) tetap `blocked`** — belum ada
rancangan Claude Design (AGENTS.md rule 17), tidak dikerjakan. **T-090
tetap `🟡 In Progress`**.

**Added (T-090.1):** enum `ContentStatus.Imported` baru
(`packages/shared/src/enums.ts`). Migration Prisma
(`apps/web/prisma/migrations/20261008120000_t090_1_import_posts_schema/migration.sql`):
`PublishingPost.authorId` nullable (invariant null-hanya-untuk-`Imported`
ditegakkan via guard `requireAuthorId` di level repository, bukan DB
constraint baru), `WorkspaceConnectedAccount.lastImportedUntil`/
`lastImportRequestedAt` baru. **Catatan penting:** migration SQL ditulis
manual (bukan hasil `prisma migrate dev` sungguhan) karena worktree sesi ini
tidak punya `DATABASE_URL`/akses DB — perlu diverifikasi (`prisma migrate
diff`/apply) oleh sesi yang punya akses DB sebelum dianggap final di
environment nyata.

**Added (T-090.2):** kontrak ACL `IOutstandAdapter.importPosts`/
`fetchImportJobStatus` (`packages/shared/src/contracts/outstand-adapter.ts`)
+ `FakeOutstandAdapter.importPosts` instant-success (pola ADR-059) + unit
test.

**Added (T-090.3):** `ImportPostsTriggerUseCase`
(`apps/web/src/domains/publishing/services/import-posts-trigger.use-case.ts`,
JOB-05) — 3 entry point: otomatis on-connect (hook di
`WorkspaceService.completeAccountConnection` via port lokal
`ImportPostsAutoTriggerPort`, pola sama `ScheduledCountsPort`/
`NotificationPort`), periodik (`triggerPeriodicForAccounts`), manual
(Server Action `syncNowAction` baru di Settings → Connected Accounts).
Guard concurrent-import per akun (cek status `pending`/`running`) + 3 lapis
guard biaya manual: RBAC Owner/Admin (`assertActorCanTriggerManualImportSync`),
cooldown 24 jam/akun, cap 1x/minggu/workspace via COUNT `background_jobs`.

**Added (T-090.4):** `ImportPostsProcessUseCase`
(`apps/web/src/domains/publishing/services/import-posts-process.use-case.ts`,
JOB-06) — upsert `PublishingPost`/`PublishingPostTarget` status `Imported`,
dedup via `platformPostId` (reuse kolom existing ADR-092, tidak ada skema
baru). File baru:
`apps/web/src/domains/publishing/repositories/import-job.repository.ts`
(+impl Prisma).

**Keputusan implementasi (dinilai konsisten dengan presedan yang sudah ada,
diverifikasi Ridwan — tidak memerlukan ADR terpisah dari ADR-093):**
JOB-05/JOB-06 dipanggil sinkron dalam satu eksekusi (bukan 2 job async
lewat `background_jobs`), mengikuti presedan pragmatis
`OutstandWebhookProcessor` (JOB-01) karena job runner asli T-027 belum
dibangun — baris `background_jobs` tetap diinsert untuk audit
log/cap-counting; guard concurrent-import disederhanakan jadi cek status
`pending`/`running` saja (bukan kondisi literal ADR-093 poin 8), valid
karena pemrosesan sinkron membuat window itu satu-satunya state transien
yang mungkin terjadi.

**Fix di luar scope literal (perlu, enum baru `Imported` memaksa
exhaustiveness check TypeScript):** `PublishingService.listCalendarPosts`/
`getCalendarPostById` default-exclude status `Imported`
(`CALENDAR_DEFAULT_STATUSES_EXCLUDING_IMPORTED`) — mencegah jalur Realtime
granular-patch Calendar/Drafts/Queue membocorkan kartu `Imported`
placeholder ke UI sebelum desain T-090.5 disetujui. Placeholder
exhaustiveness ditambahkan di `status-badge.ts`, `calendar-grid-shared.ts`,
`history-status.ts` — ditandai eksplisit sebagai placeholder sementara,
bukan desain final.

**KI-059 baru (Open):** `triggerPeriodicForAccounts` butuh `actingUserId`
per akun yang di-resolve caller — trigger cron asli tidak punya sesi user.
Didokumentasikan sebagai gap di docstring kode, bukan diselesaikan (kandidat
resolusi, mis. Account Owner workspace, belum jadi keputusan produk final).

**File diubah lainnya:** `apps/web/prisma/schema.prisma`,
`apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts`,
`apps/web/src/domains/publishing/rbac.ts`,
`apps/web/src/domains/publishing/repositories/publishing.repository.ts`,
`apps/web/src/domains/workspace/repositories/workspace.repository.ts`,
`apps/web/src/domains/workspace/services/workspace.service.ts`,
`apps/web/src/lib/workspace/outstand-workspace-service.ts`,
`apps/web/src/app/(app)/settings/connected-accounts/actions.ts`,
`apps/web/src/domains/publishing/services/publishing.service.ts`.

Detail lengkap: `tasks/v02-publishing-mvp.md` § T-090,
`decisions/ADR-093-import-posts-dari-social-account-status-imported-read-only.md`.
## 2026-10-08 — KI-062 + KI-064 Resolved: koreksi 2 gap dokumentasi baseline arsitektur

Dua Known Issue dokumentasi (keduanya non-blocking, murni koreksi baseline tanpa keputusan arsitektur baru) diselesaikan di branch `fix/ki062-ki064-docs`:

* **KI-062** — `product-discovery/05-architecture/background-jobs.md` § Exponential Backoff
  self-contradictory: tabel delay (5/15/60 menit) sudah konsisten dengan prosa JOB-01 dan
  dengan kode (`apps/web/src/lib/jobs/backoff.ts`, `RETRY_DELAY_MINUTES = [5, 15, 60]`), tapi
  formula `delay = base_delay * 2^(attempts-1)` di baris yang sama menghasilkan 5/10/20 menit —
  tidak match. Diperbaiki: baris formula diganti jadi penjelasan lookup table eksplisit
  (bukan formula pangkat dua — rasio 5→15 adalah ×3, 15→60 adalah ×4, tidak konsisten), dengan
  pointer ke `backoff.ts` sebagai sumber kebenaran implementasi. Kode tidak diubah (sudah benar
  sejak awal, dokumentasi yang dikoreksi).
* **KI-064** — `product-discovery/05-architecture/application-layer.md` § Peta Dependency Antar
  Domain belum mencantumkan panah `BC-03 Publishing → BC-06 Analytics`, padahal kontrak
  `PostMetricsPort` (arah dependency ini) sudah dipakai sejak T-033.1 (2026-08-27) dan T-043
  (2026-09-18). Diperbaiki: baris baru ditambahkan di blok BC-03 Publishing —
  `──→ BC-06 Analytics (metrik post per target akun, via PostMetricsPort — KI-064)`.

Kedua KI dihapus dari daftar Known Issues di `PROJECT_STATE.md` (sudah tercatat di sini).

---

## 2026-10-08 — KI-084 Resolved sepenuhnya: implementasi icon sidebar mobile ke kode asli `apps/web`

Lanjutan desain Claude Design yang sudah locked 2026-10-07 (lihat entri di
bawah). Cek Claude Design (`DesignSync get_file`
`components/navigation-mobile.html`) sebelum menulis kode — sesuai
`AGENTS.md` rule 17 — mengonfirmasi target icon: glyph "panel" (rect+line,
`SidebarLeftIcon` di code time) dipakai untuk TOMBOL BUKA dan TOMBOL TUTUP
sekaligus (bukan hamburger untuk buka + ✕ untuk tutup), dan lebar drawer
disamakan dengan `.sidebar` desktop.

Perubahan kode:
1. `apps/web/src/app/(app)/components/MobileTopBar.tsx` — icon trigger buka
   diganti `Menu01Icon` → `SidebarLeftIcon` (sama dengan `SidebarTrigger`
   desktop di `sidebar.tsx`).
2. `apps/web/src/components/ui/sidebar.tsx` (`Sidebar`, cabang `isMobile`)
   — tombol close default `SheetContent` (`Cancel01Icon` dari `sheet.tsx`)
   dimatikan via `showCloseButton={false}`, diganti `SheetClose` custom
   lokal dengan `SidebarLeftIcon` + aria-label "Tutup menu". Override lokal
   di `sidebar.tsx`, bukan edit `sheet.tsx` global, supaya Sheet lain
   (notifications panel, dsb.) tidak ikut berubah icon close-nya.
3. Lebar drawer mobile (`SIDEBAR_WIDTH_MOBILE` di `sidebar.tsx`) sudah
   bernilai `18rem` — identik dengan `SIDEBAR_WIDTH` desktop. Tidak ada
   perubahan kode untuk poin ini, sekadar dikonfirmasi sudah sesuai target.

Diverifikasi via `preview_start` ke dev server yang sudah berjalan
(`localhost:3000`), emulasi viewport mobile 375×812, 2 lokasi: drawer
Workspace (`/`) dan drawer Settings (`/settings`) — icon buka & tutup
konsisten (sama persis), drawer buka/tutup berfungsi normal. `tsc --noEmit`
dan `eslint` pada kedua file bersih, tanpa error baru.

**Perbaikan susulan (sesi sama) — close button menabrak "New Post":**
King Rezi kirim screenshot: icon close yang baru ditambahkan (`absolute
top-4 right-4` di `SheetContent`, `sidebar.tsx`) menabrak/tumpang tindih
dengan tombol "New Post" di bawah header. Dikonfirmasi via bounding-rect
browser (`getBoundingClientRect`): close button `top:16-44px`, tombol "New
Post" `top:40-76px` — overlap 4px vertikal, dan secara horizontal close
button (236-264px) berada di dalam lebar penuh tombol "New Post" (8-272px)
sehingga terlihat menabrak.

Akar masalah: pendekatan `absolute` positioning baru di `SheetContent`
tidak memperhitungkan konten child yang sudah ada di bawahnya
(`SidebarHeader` → CTA "New Post"). Diperbaiki dengan pendekatan berbeda —
reuse elemen FLEX ROW header yang sudah ada, bukan elemen absolute baru:
1. `apps/web/src/app/(app)/components/WorkspaceSideNav.tsx` — hapus
   kode yang menyembunyikan `SidebarTrigger` dari mobile (`hidden
   md:flex` → `shrink-0`, selalu tampil). `SidebarTrigger` memanggil
   `toggleSidebar()` yang BERPERILAKU BEDA sesuai konteks: di desktop
   expand/collapse, di mobile `setOpenMobile` toggle — jadi klik tombol
   yang sama saat drawer mobile terbuka otomatis menutupnya. Tombol ini
   sudah ada di flex row header (sejajar nama workspace), posisinya aman
   dari CTA "New Post" di bawahnya karena mengikuti flow layout, bukan
   absolute.
2. `apps/web/src/app/(app)/settings/components/SettingsSideNav.tsx` —
   sidebar ini sengaja TIDAK punya `SidebarTrigger` di desktop (Keputusan
   #4 T-105.0/T-105.1: fixed-width, no collapse), jadi solusi #1 di atas
   tidak bisa langsung dipakai ulang. Ditambah tombol close BARU khusus
   mobile (`md:hidden`) di flex row header yang sama dengan link
   "← Settings", pakai `closeMobileSidebar()` yang sudah ada (sebelumnya
   cuma dipakai di `onClick` link nav) dan icon `SidebarLeftIcon`.
3. `apps/web/src/components/ui/sidebar.tsx` — elemen `SheetClose` absolute
   yang bermasalah dihapus total; `showCloseButton={false}` pada
   `SheetContent` dipertahankan (default `Cancel01Icon` tetap mati, karena
   sekarang tiap sidebar konsumen menyediakan close affordance sendiri).

Diverifikasi ulang via `preview_start` ke dev server yang sama, emulasi
375×812, kedua drawer (Workspace & Settings): close button sekarang ada di
dalam flex row header (tidak ada lagi elemen absolute), tidak overlap "New
Post" atau elemen lain, buka/tutup berfungsi normal. Regresi desktop juga
dicek — `SidebarTrigger` tetap di posisi dan perilaku semula (karena hanya
menghapus kondisi `hidden`, bukan mengubah logic). `tsc --noEmit` dan
`eslint` pada ketiga file bersih.

Menutup **KI-084** sepenuhnya (desain + kode + perbaikan overlap). **KI-085**
sudah Resolved terpisah di sesi 2026-10-07 (tooling Claude Design App
Prototype, tidak menyentuh kode `apps/web`).

---

## 2026-10-07 — KI-084 Resolved (Claude Design) + KI-085 ditemukan & Resolved: sidebar mobile App Prototype

**KI-084** (dicatat Open sebelumnya hari ini) selesai di sisi Claude Design:
icon buka/tutup sidebar mobile disamakan dengan `SidebarLeftIcon` desktop
(bukan hamburger 3-garis + ✕ generik), lebar drawer disamakan 260px (dari
280px/84vw). Diterapkan ke 14 file: `components/navigation-mobile.html` +
`styles.css` (component spec/acuan) + 7 screen workspace (`home`,
`publish-calendar`, `publish-queue`, `publish-drafts`, `publish-history`,
`engage-inbox`, `analyze-dashboard`) + 7 screen settings (`settings-general`,
`settings-connected-accounts`, `settings-members`, `settings-workspaces`,
`settings-profile`, `settings-notifications`, `settings-preferences`).
Setiap file diverifikasi via `get_file` sebelum DAN sesudah push (skill
`claude-design-scope-discipline` rule 6) — cuma 2 baris icon yang berubah
per file, sisanya byte-identik. Percobaan delegasi ke subagent
general-purpose untuk pekerjaan mekanis ini **gagal** — `DesignSync` tidak
ter-load di sesi subagent, sama seperti keterbatasan yang sudah tercatat
untuk Neymar/Najwa di `.claude/agents/README.md` (ternyata berlaku juga
untuk general-purpose, bukan cuma 2 subagent itu). Dikerjakan manual di
sesi utama.

**KI-085 (baru, ditemukan saat verifikasi King Rezi di App Prototype,
langsung Resolved hari yang sama):** `.mobile-topbar` (hamburger+judul asli)
tetap tampil sebagai elemen kedua yang membingungkan berdampingan dengan
sidebar — baik saat drawer mobile terbuka maupun di fresh load viewport
"Tampilan: Website" lebar desktop penuh (sidebar asli sudah tampil normal).
Mode "Tampilan: Mobile" (390px) selalu normal.

3 percobaan fix, 2 gagal sebelum ketemu akar yang benar:
1. CSS `.app-shell{flex-direction:column}` → `{display:block}` (dugaan
   komputasi flexbox bersarang) — **tidak menyelesaikan**, dikonfirmasi
   King Rezi "masih ada".
2. CSS `.app-shell:has(~ .mobile-nav-backdrop) .mobile-topbar{display:none}`
   — **`:has()` tidak didukung** di renderer App Prototype, tidak berefek.
3. JS: sembunyikan `.mobile-topbar` di `openMobileNav()`/`closeMobileNav()`
   (`AppPrototype.dc.html`) — **tidak menjangkau kasus fresh-load** (topbar
   nongol walau drawer belum pernah dibuka sama sekali di sesi itu).

**Fix final yang berhasil:** guard JS di method `inject()` milik
`AppPrototype.dc.html` — method ini jalan di SETIAP `onLoad` iframe (semua
screen, bukan cuma saat drawer dibuka). Cek `getComputedStyle` sidebar asli
(`.app-shell > .sidebar`); kalau sidebar itu tampil, `.mobile-topbar` dipaksa
`display:none` via `style.display` langsung — independen dari cascade CSS
manapun. **Dikonfirmasi King Rezi: sudah hilang.**

**Scope eksplisit SELESAI sesi ini:** Claude Design saja (component spec,
styles.css, 14 screen, App Prototype runner). **Scope BELUM dikerjakan,
lanjut sesi berikutnya (King Rezi minta lanjut di room chat baru,
2026-10-08):** implementasi fix KI-084 ke kode asli `apps/web` —
`MobileTopBar.tsx` (`Menu01Icon` → `SidebarLeftIcon`), override icon close
Sheet sidebar mobile (lokal ke komponen ini saja, BUKAN ubah `sheet.tsx`
global karena dipakai komponen `Sheet` lain seperti Notifications Drawer),
dan samakan lebar Sheet mobile jadi 18rem persis (hilangkan cap
`w-3/4 max-w-sm` khusus sidebar ini).

**Docs diupdate:** `PROJECT_STATE.md` (§ KI-084 update + § KI-085 baru →
✅ Resolved, Completed Ringkasan bullet baru menggantikan bullet T-111.3
terlama, Top Next Tasks catat pekerjaan lanjutan).

---

## 2026-10-07 — KI-084 (baru, Open): sidebar mobile tidak konsisten dengan desktop

Ditemukan King Rezi lewat screenshot, langsung setelah **KI-042** (Mobile
Shell retrofit) ditutup ✅ Done hari yang sama: icon hamburger, layout, dan
button "X" sidebar mobile berbeda dari sidebar desktop — seharusnya sama,
cuma beda trigger buka/tutup (drawer vs permanen). Kemungkinan regresi/
residual dari retrofit KI-042 yang tidak mengecek kesamaan visual dengan
pola desktop.

Dicatat sebagai **KI-084** (bukan Task baru) karena ini defect pada fitur
yang sudah ada, bukan fitur baru. Branch kerja: `feature/mobile-sidebar-design`
(dari `fix/t-111-history-media-layout`). Sebelum fix: wajib cek Claude
Design dulu (rule 17 `AGENTS.md`) untuk pola sidebar desktop yang terkunci,
baru lanjut implementasi via Mark UI Engineer.

**Docs diupdate:** `PROJECT_STATE.md` (§ KI-084 baru, Status Open; Last
Updated → 2026-10-07).

---

## 2026-10-07 — T-111 TUNTAS 8/8 subtask: implementasi mobile Engage Inbox + History Detail

T-111 (Restrukturisasi layout preview media post asli, History Detail &
Post asal Engage, promosi KI-083) sekarang **✅ Done 8/8 subtask** — desktop
(T-111.1–.4) dan mobile (T-111.5–.8) tuntas total, menutup KI-083
sepenuhnya.

**T-111.6 ✅ Done** — Implementasi kode T-111.5 (push navigation Engage
Inbox mobile) di `apps/web/src/app/(app)/engage/components/EngageInboxView.tsx`:
state `mobileView: "list"|"detail"`; grid `.inbox-shell` di-override
`max-md:grid-cols-1!` (breakpoint bawaan Tailwind, bukan arbitrary value —
inline `style` 340px/1fr struktural existing tidak diubah); thread-list
disembunyikan (`hidden md:block`) dan thread-detail ditampilkan (`flex`)
sesuai state di mobile; header mobile baru (tombol back `ArrowLeft01Icon` +
judul `detail?.authorHandle`) hanya tampil mobile+state detail; header
"Engage"+Refresh dan filter 3 dropdown disembunyikan saat mobile+state
detail (full-bleed subpage), sesuai LOCKED PATTERN T-111.5. Satu poin
desain (border-radius/border `.inbox-shell` dihilangkan total saat mobile
detail, "full-bleed" sampai tepi layar) **sengaja disederhanakan/dilewati**
— `.inbox-shell` tetap mempertahankan border+`rounded-xl` di semua state
mobile — keputusan teknis call, dilaporkan eksplisit, bukan regresi.

**T-111.8 ✅ Done** — Implementasi kode T-111.7 (2 fix mobile History
Detail) di `apps/web/src/app/(app)/publish/history/[postId]/components/HistoryDetail.tsx`:
tepat 3 titik — (a) `break-words` pada Text caption; (b) `overflow-x-hidden`
pada container scroll body dialog; (c) baris target `status==="failed"`:
`flex items-center justify-between` → `flex flex-wrap items-center
justify-between` + Text error `min-w-0 flex-1 break-words` supaya teks
error panjang wrap/shrink, tombol "Coba Lagi" tidak terdorong keluar
viewport.

**Verifikasi:** kedua subtask diverifikasi langsung lewat browser di sesi
utama sebelum ditutup, bukan cuma klaim subagent — T-111.6: push nav
(list↔detail+back) bekerja sempurna di mobile 375×812, desktop grid 2
kolom tidak ada regresi, 0 error console; T-111.8: dicek dengan data nyata
(error OAuthException panjang, post "test" 5 Okt 2026 11:27),
`document.documentElement.scrollWidth === clientWidth` (375=375, tidak ada
scroll horizontal), tombol "Coba Lagi" fully in-viewport, desktop tidak
ada regresi visual.

Dokumentasi diperbarui: `tasks/v02-publishing-mvp.md` (T-111.6/T-111.8 →
Done, header Status T-111 → ✅ Done 8/8), `TASKS.md` (Indeks release v0.2 →
23 ✅ · 2 🟡 · 2 ⏳, Total → 63 selesai, Fokus aktif pindah ke T-037 + T-090),
`PROJECT_STATE.md` (Top Next Tasks + Completed Ringkasan, tetap 5 item).

---

## 2026-10-07 — T-111.7 Done: desain mobile History Detail dikunci di Claude Design

Desain mobile untuk Dialog History Detail (`templates/publish-history-detail.html`,
LOCKED PATTERN T-111.1) dikunci di Claude Design. Keputusan King Rezi: dialog
**TETAP floating `.dialog-md`** di semua ukuran — opsi full-screen sheet yang
sempat direkomendasikan **DITOLAK** eksplisit ("sisanya sudah bagus"). Scope
final yang dikunci cuma 2 fix:

1. Cegah scroll horizontal — `overflow-wrap:anywhere` pada caption +
   `overflow-x:hidden` pada `.dialog-md`, di-scope page-local
   `@media (max-width:768px)`.
2. `.history-target-row` ("Hasil per Akun") dipecah jadi 2 baris di mobile
   via flex-wrap+order (markup HTML tidak berubah) — baris 1: avatar+nama+
   chip, baris 2: pesan error/aksi.

Sudah dicek `apps/web/src`: tidak ada reuse class `.history-target-row`/
`.history-target-account` di luar Claude Design (cuma referensi nama class
di komentar `ChannelAvatarBadge.tsx`), jadi **T-111.8** (implementasi kode
`HistoryDetail.tsx`) aman mengikuti pola ini langsung tanpa migrasi
tambahan, dan sekarang **tidak lagi depends-blocked** — sudah bisa mulai.
T-111 keseluruhan naik jadi 6/8 subtask (T-111.6 dan T-111.8 implementasi
kode yang masih tersisa).

---

## 2026-10-07 — KI-042 Mobile Shell retrofit: hamburger+drawer dipasang ke semua screen `.app-shell` + App Prototype

Ditemukan King Rezi setelah QA T-111.5 di App Prototype: pindah viewport ke
Mobile (390px) memang memicu breakpoint `@media max-width:768px` yang
menyembunyikan sidebar (`.app-shell > .sidebar`), tapi **tidak ada hamburger
apapun untuk membukanya lagi** — navigasi antar halaman total buntu di
viewport Mobile. Diverifikasi: pola "Mobile Shell" (top app bar + Sidebar
Drawer) sudah lama terdokumentasi di `styles.css` sebagai CSS + demo
standalone (`components/navigation-mobile.html`, KI-042) tapi **tidak
pernah dipasang ke satu pun screen asli maupun ke App Prototype**.

Bukan task T-111 — gap terpisah (KI-042), diperbaiki langsung atas
instruksi King Rezi (scope dikonfirmasi lewat `AskUserQuestion`: "App
Prototype saja" vs "App Prototype + semua template" — dipilih yang kedua).

Dipasang ke **14 file** (sesi utama, `DesignSync` tetap tidak dicoba di
subagent Neymar):

- **7 template workspace sidebar** (`home.html`,
  `publish-calendar/drafts/history/queue.html`, `engage-inbox.html`,
  `analyze-dashboard.html`): `.mobile-topbar` (hamburger
  `data-proto="mobile-nav-toggle"`, title "Kopi Selasar") ditambah sebagai
  anak pertama `.app-shell`; tombol close (`data-proto="mobile-nav-close"`)
  ditambah statis di `.ws-switch` setelah `.sidebar-trigger`.
- **7 template settings sidebar** (`settings-general.html` +
  `connected-accounts/members/notifications/preferences/profile/workspaces`):
  sama, title "Settings", close button di `.settings-sidebar-header`.
- Tombol close `display:none` by default di `styles.css`, cuma tampil via
  CSS (`.mobile-nav-drawer .mobile-nav-drawer-close`) saat sidebar-nya
  betulan ada di dalam drawer; `.sidebar-trigger` (collapse desktop) ikut
  disembunyikan di dalam drawer (tidak relevan di konteks itu).
- JS per-file (pola sama theme-toggle/sidebar-collapse yang sudah ada,
  guard `window.top !== window.self`) **MEMINDAHKAN** (bukan
  menduplikasi) node `.sidebar`/`.settings-sidebar` ke dalam
  `.mobile-nav-backdrop`>`.mobile-nav-drawer` yang dibuat on-demand saat
  hamburger diklik, dikembalikan ke posisi semula saat ditutup — sesuai
  kontrak "move into an overlay Drawer" yang sudah lama tertulis di
  komentar `styles.css` tapi belum pernah diimplementasikan.
- `templates/app-prototype/AppPrototype.dc.html`: method generik baru
  `openMobileNav`/`closeMobileNav` (pola sama
  `openNotifPanel`/`closeNotifPanel` — capture-phase outside-click +
  Escape dismiss) + 2 case `route()` baru (`mobile-nav-toggle`/
  `mobile-nav-close`) — satu implementasi berlaku untuk SEMUA layar di
  runner, tidak perlu listener per-layar.
- `readme.md`: section baru "KI-042 Mobile Shell retrofit" + update
  catatan lama di entri `engage-inbox.html` (yang sebelumnya bilang gap
  ini "belum di-retrofit ke screen manapun" — sudah tidak akurat lagi).

**Verifikasi struktural** (bukan visual — tidak ada akses browser langsung
ke Claude Design dari sesi ini): tiap 14 file dicek `grep` memastikan
tepat 1 `data-proto="mobile-nav-toggle"` markup + 1 `data-proto=
"mobile-nav-close"` markup hadir dan konsisten.

---

## 2026-10-07 — T-111.5 Done: desain mobile Engage Inbox (Claude Design), push navigation

Gap ditemukan King Rezi saat review ulang T-111 setelah 4/4 subtask desktop
Done: `.inbox-shell` (grid `.thread-list` 340px + `.thread-detail` 1fr, dipakai
`/engage`) tidak pernah punya breakpoint mobile — satu-satunya aturan mobile
yang ada sebelumnya cuma `.post-context{width:100%}` (kartu "Post asal" saja,
T-111.3), bukan keseluruhan layout 2-kolom. Sempat dilaporkan Najwa QA
Engineer saat QA T-111.4 sebagai "pre-existing dari T-053, bukan regresi",
tapi memang belum pernah didesain ulang.

Sebelum menulis kode apapun, dicek dulu ke AGENTS.md rule 17 — ini task
UI/UX-related sehingga wajib proactive-clarification (`AskUserQuestion`)
untuk mengunci pola layout mobile dulu di Claude Design. Dua keputusan
ditanyakan ke King Rezi:

1. **Pola navigasi mobile** — 3 opsi: push navigation (list↔detail, tombol
   back, pola standar inbox/messaging), full-screen sheet/modal (reuse
   Dialog T-111.1), atau segmented tab switch (2 tab manual). King Rezi
   pilih **push navigation**.
2. **Filter bar** (`.inbox-filter`, 3 `<select>`) — stack vertikal tetap 3
   dropdown, atau collapse ke 1 tombol "Filter". King Rezi pilih **stack
   vertikal, tetap 3 dropdown**.

Implementasi di Claude Design (sesi utama, `DesignSync` tidak dicoba lagi di
subagent Neymar — pola sama T-111.1/T-111.3):

- `styles.css` — `.thread-detail-mobile-header` baru (hidden desktop) +
  aturan `@media (max-width:768px)` ditambahkan ke blok shared Mobile
  Shell yang sudah ada: `.inbox-shell` jadi `display:block` (grid 2 kolom
  mati), `.thread-list`/`.thread-detail` di-toggle lewat selector
  `.inbox-shell[data-mobile-view="detail"]`, header mobile dapat border +
  negative margin biar nempel tepi card.
- `templates/engage-inbox.html` — `.inbox-shell` dapat atribut
  `data-mobile-view="list"` (default); `.thread-detail` dapat
  `.thread-detail-mobile-header` berisi tombol back yang REUSE PERSIS
  `.settings-back-btn` (icon+style) dari header `.settings-sidebar`
  (`templates/settings-general.html`) — bukan komponen baru. Filter
  `.inbox-filter` di-stack via media query di `<style>` page-level (sudah
  page-scoped sejak awal, bukan dipindah ke styles.css supaya tidak
  konflik specificity dengan `.select{width:auto}` inline yang sudah ada).
  JS baru (pola sama theme-toggle/sidebar-collapse yang sudah ada di file
  ini): klik `.thread-item` → `data-mobile-view="detail"`; klik tombol
  back → `data-mobile-view="list"`. Ini prototype statis, bukan real
  routing.
- `readme.md` — entri Screens `templates/engage-inbox.html` ditambah
  paragraf "MOBILE LAYOUT LOCKED (T-111.5)" mendokumentasikan keputusan +
  alasan opsi lain ditolak.

**Sengaja TIDAK termasuk scope ini:** migrasi `.app-shell > .sidebar` di
halaman ini ke pola Mobile Shell (`.mobile-topbar`, KI-042) — dikonfirmasi
saat eksplorasi bahwa pola itu baru ada sebagai demo standalone di
`components/navigation-mobile.html`, belum di-retrofit ke screen real
manapun (termasuk `publish-queue.html` dkk) — itu gap terpisah, bukan
bagian T-111.

**Follow-up:** T-111.6 (implementasi kode `EngageInboxView.tsx`) sudah bisa
dimulai — gate AGENTS.md rule 17 untuk layar ini sudah terpenuhi. T-111.7
(desain mobile History Detail) masih ⏳, belum disentuh sesi ini.

**Fix sama hari (dilaporkan King Rezi setelah test di App Prototype):** klik
`.thread-item` di dalam runner App Prototype tidak pindah ke
`.thread-detail` — ternyata `route()` dispatcher App Prototype
(`templates/app-prototype/AppPrototype.dc.html`) sudah punya case
`.thread-item` sendiri dari dulu (cuma toggle class `.active`), yang
meng-override script kecil di `templates/engage-inbox.html` (sengaja
dimatikan di dalam iframe App Prototype, pola sama persis
theme-toggle/sidebar-collapse). Ditambahkan method baru
`setInboxMobileView(doc, view)` (pola sama `toggleSidebarCollapse`) +
dipanggil dari case `.thread-item` yang sudah ada (set ke `"detail"`) dan
case baru `data-proto === "inbox-mobile-back"` (set ke `"list"`). Halaman
statis (dibuka langsung di luar runner) tidak terpengaruh, sudah benar
dari awal.

**Revisi ke-2 sama hari (King Rezi, setelah review hasil fix di atas):**
dua perbaikan lanjutan di `styles.css` (+ dokumentasi `readme.md`):
1. `.page-head` (judul "Engage" + tombol Refresh) dan `.inbox-filter` (3
   dropdown) sebelumnya tetap tampil di atas `.thread-detail` walau sudah
   di state "detail" — sekarang disembunyikan juga, bukan cuma
   `.inbox-shell` yang berubah layout.
2. `.thread-detail` di state "detail" dibuat jadi **sub-page sungguhan**
   (bukan panel yang masih kepotong card/padding halaman List) —
   `.main` di-strip padding-nya jadi 0 pakai selector `:has()` (preseden
   sudah ada di `.seg label:has(...)`, scope aman cuma ke `.main` yang
   benar2 berisi `.inbox-shell[data-mobile-view="detail"]`), border+radius
   card `.thread-detail` dilepas supaya full-bleed ke tepi viewport,
   `.thread-detail-mobile-header` berfungsi sebagai header sub-page itu
   sendiri (bukan lagi sekadar header dalam card).

Update dokumentasi: `tasks/v02-publishing-mvp.md` § T-111.5 (✅ Done + detail
keputusan) dan § T-111.6 (depends terpenuhi), `TASKS.md` Fokus sekarang
(5/8 subtask), `PROJECT_STATE.md` Snapshot + Completed (Ringkasan, bullet
T-056 lama digeser keluar supaya tetap 5 item).

---

## 2026-10-07 — T-111 Done (4/4 subtask): implementasi kode restrukturisasi preview media post asli (History Detail + Post asal Engage), menutup KI-083

Lanjutan dari T-111.1/T-111.3 (Claude Design, entri di bawah) — sesi ini
menuntaskan dua subtask implementasi kode yang tersisa, **T-111.2**
(`HistoryDetail.tsx`) dan **T-111.4** (`EngageInboxView.tsx`), sehingga T-111
naik status jadi `✅ Done` secara penuh dan KI-083 Resolved.

**Dikerjakan:**
- `HistoryDetail.tsx` (domain `publishing`) dirombak jadi Dialog shadcn
  mengikuti LOCKED PATTERN T-111.1 — `.dialog-fs-header`+`.dialog-fs-body`
  saja (tanpa footer), body berisi caption → media natural-size → divider →
  "Hasil per Akun" dengan avatar+badge platform per baris.
- `EngageInboxView.tsx` (domain `engagement`) menambah komponen
  `PostOriginCard` — kartu ala post Instagram lebar tetap 360px + carousel
  media, mengikuti LOCKED PATTERN T-111.3.
- `media-thumbnail.tsx` menambah prop `fit="natural"` untuk render media
  ukuran asli (non-crop), dipakai Dialog History Detail.
- `engage/actions.ts` menambah field `thumbnails[]` ke payload "post asal".
- `media.service.ts` menambah method `resolveThumbnails()` (dipakai kedua
  lokasi) + test baru di `media.service.test.ts`.
- File baru: `apps/web/src/components/shared/ChannelAvatarBadge.tsx`
  (avatar+badge platform reusable, dipakai `HistoryDetail.tsx`) dan
  `apps/web/src/lib/linkify.tsx` (parse URL/#hashtag caption jadi `<a>`,
  kebutuhan LOCKED PATTERN T-111.1).

**Subagent terlibat:** 2× Mark UI Engineer paralel (T-111.2 History Detail,
T-111.4 Post asal Engage), Elon Backend Engineer (data layer
`resolveThumbnails()`), Ridwan Architecture Reviewer (review — clean, 0
temuan blocking), Najwa QA Engineer (golden path PASS kedua lokasi).

**Follow-up non-blocking ditemukan (dicatat sebagai technical debt di
`tasks/v02-publishing-mvp.md` § T-111, BUKAN dikerjakan sesi ini):**
1. Duplikasi komponen — `EngageInboxView.tsx` masih pakai
   `PostContextAccountBadge` lokal sendiri, belum migrasi ke
   `ChannelAvatarBadge` baru (konsekuensi 2 subagent paralel yang tidak
   saling tahu komponen shared baru masing-masing); sebaiknya dikonsolidasi
   sekalian dengan 2 duplikat lama (`PlatformBadge` di `ChannelsSection.tsx`
   dan `ConnectedAccountsList.tsx`).
2. Overflow horizontal minor di Dialog History Detail untuk pesan error
   target yang panjang (pre-existing dari T-034.3/PR#144, bukan regresi
   T-111.2) — perlu `break-words`/`whitespace-pre-wrap`.
3. Gap data — `HistoryItemTargetRecord` tidak membawa `avatarUrl` akun,
   sehingga avatar "Hasil per Akun" selalu fallback ke inisial, tidak pernah
   foto profil asli; perlu field baru di repository/service kalau foto asli
   wajib tampil (menunggu keputusan King Rezi).

Status didokumentasikan di `tasks/v02-publishing-mvp.md` § T-111 (4/4
subtask `[x]`), `TASKS.md` (indeks v0.2: 23 ✅ · 2 🟡 · 2 ⏳), dan
`PROJECT_STATE.md` (Completed (Ringkasan) + KI-083 dihapus dari Known Issues
karena Resolved).

---

## 2026-10-07 — T-111.3 Done: pola media "Post asal" di Engage Inbox dirancang ulang di Claude Design

Lanjutan T-111 setelah T-111.1 (History Detail) dinyatakan selesai oleh King
Rezi — King Rezi minta lanjut ke T-111.3 dulu (bukan T-111.2 implementasi
kode). Dikerjakan langsung di sesi utama (bukan subagent Neymar — pola
kegagalan `DesignSync` di sesi subagent sudah berulang 7x, tidak dicoba lagi
untuk task ini, pakai izin yang sama dari sesi T-111.1).

**Dikerjakan:** `templates/engage-inbox.html` § `.post-context` (kotak "Post
asal" di panel `.thread-detail`, locked pattern T-056) diubah dari layout
ROW (`.thumb` 44x44 kotak tetap + teks di sampingnya) jadi COLUMN: label
"Post asal" → media (`.post-context-media`, natural aspect-ratio, width
100% dari card, `max-height:200px`) → caption (`.post-context-cap`, truncate
1 baris — TIDAK diubah dari T-056) → "Go to post →" (TIDAK diubah dari
T-056). CSS baru ditaruh di `styles.css` global (bukan page-local `<style>`
di file itu), mengikuti pola file ini sebelumnya — `.post-context` dan
`.thumb` sebelumnya juga didefinisikan di `styles.css`, bukan lokal.

**Beda sengaja dari History Detail (T-111.1):** di sana media unconstrained
natural-size karena modal penuh; di sini `.post-context` ada di panel
SAMPING `.thread-list` (grid `.inbox-shell` 340px+1fr) — ruang jauh lebih
terbatas, jadi media dibatasi `max-height:200px` supaya foto vertikal
ekstrem tidak mendominasi panel. Ini sesuai klarifikasi scope King Rezi
2026-10-06 di task T-111: pola visual boleh beda antar kedua lokasi, tidak
wajib identik.

`.thumb` (44x44 placeholder lama) sudah tidak dipakai di file ini. Media
tetap di-omit sepenuhnya (bukan kotak kosong) kalau post tidak bermedia —
tidak berubah dari T-056. `readme.md` Screens section disinkronkan di
publish yang sama.

Status T-111 di `tasks/v02-publishing-mvp.md` diupdate: T-111.1 ✅, T-111.3
✅, T-111.2/T-111.4 (implementasi kode) masih ⏳.

**Revisi T-111.3 (sama hari, arahan konkret King Rezi):** draft COLUMN di
atas DIGANTI total jadi **kartu ala post Instagram** — 6 requirement
eksplisit: (1) bentuk card, (2) lebar TIDAK full di desktop, full-width di
tablet/mobile, (3) card DI-CENTER, (4) media rasio 1:1 (square), (5) card
terbagi 2 sisi (atas media, bawah content), (6) media carousel dengan
tombol next/previous DI BADAN gambar, hanya 1 gambar tampil sekaligus.

Implementasi: `.post-context` sekarang lebar TETAP 360px + `margin:0 auto`
(center) di desktop, `width:100%` di breakpoint ≤768px (reuse breakpoint
Mobile Shell/Table responsive yang sudah ada). `.post-context-media-wrap`
(`aspect-ratio:1/1`, `object-fit:cover`) jadi sisi atas kartu,
`.post-context-content` (label+caption+link) sisi bawah. 2 tombol carousel
(`.post-context-carousel-btn` prev/next, posisi absolute di dalam
media-wrap, karakter ‹ › — konsisten dengan `.schedcal-nav` di
`templates/draft-editor.html`) melayang di atas gambar. Fallback kalau post
tidak bermedia: `.post-context-nomedia` (kotak sederhana, bukan kartu 1:1,
full-width, tidak di-center) — konsisten pola lama T-056 (media di-omit
sepenuhnya, bukan kotak kosong), didokumentasikan sebagai komentar HTML
(di-comment-out, bukan dirender bersamaan) karena belum ada referensi
visual terpisah untuk state ini.

`styles.css` + `templates/engage-inbox.html` + `readme.md` di Claude
Design disinkronkan ulang untuk revisi final ini.

**Revisi lanjutan T-111.3 (sama hari, King Rezi):** dua perubahan lagi pada
kartu di atas — (1) tambahkan **avatar+badge platform+nama akun**
(`.post-context-account`) di `.post-context-content`, reuse PERSIS pola
`.history-target-account` yang sudah dikunci di T-111.1 (History Detail) —
bukan komponen baru, `.channel-avatar-wrap`/`.channel-avatar`/
`.channel-badge` ukuran sama (28px/12px); (2) **hapus truncate** dari
`.post-context-cap` — caption sekarang wrap penuh multi-baris, bukan lagi
1 baris dengan ellipsis (beda dari pola T-056 lama). Keduanya diterapkan
juga ke fallback `.post-context-nomedia` (dikomentari, referensi saja)
supaya konsisten. `styles.css` + `templates/engage-inbox.html` +
`readme.md` disinkronkan ulang.

---

## 2026-10-07 — T-111.1 Done: History Detail dirancang ulang jadi Modal/Dialog di Claude Design

Branch kerja baru dibuat lebih dulu: `fix/t-111-history-media-layout` dari
`origin/staging` (sudah memuat PR #144/KI-082). King Rezi memberi arahan
konkret untuk T-111.1: ubah `templates/publish-history-detail.html` dari
full page menjadi **Modal/Dialog**, layout mengikuti screenshot referensi
(header tanggal+close, body avatar+caption+media natural-size+divider,
footer sticky "Published via X"+"Go to post"+menu), **body scrollable**
sementara header/footer tetap fixed.

**Delegasi ke Neymar Product Designer gagal lagi** — `DesignSync` tidak
termuat di sesi subagent (kegagalan ke-7, pola sama persis yang sudah
tercatat di `.claude/agents/README.md` § "Keterbatasan teknis: `DesignSync`
di sesi subagent"). Neymar berhenti sesuai protokol (minta izin, bukan
menebak/workaround) — King Rezi memberi izin eksplisit untuk dikerjakan di
sesi utama, `DesignSync` berhasil dimuat di sana.

**Dikerjakan di sesi utama:**
- Dibaca dulu file remote (`templates/publish-history-detail.html`,
  `components/dialog.html`, `templates/draft-editor.html`, `styles.css`,
  `components/popover.html`) untuk menemukan primitive yang sudah ada,
  bukan bikin baru — ketemu `.dialog-md-backdrop`+`.dialog-md` (560px,
  82vh, sudah dipakai `templates/settings-connect-facebook-pages.html`)
  dengan komposisi `.dialog-fs-header/-body/-footer` yang sama seperti
  `templates/draft-editor.html` — `.dialog-fs-body` sudah `overflow-y:auto`
  bawaan, persis mekanisme scrollable yang diminta, tidak perlu class baru.
- Draft pertama SENGAJA tidak menyertakan avatar/badge platform di header
  maupun pola "Published via X" di footer (post di domain ini bisa
  dipublish ke banyak target akun/platform sekaligus, tidak ada "satu akun"
  representatif) — dilaporkan sebagai 2 keputusan terbuka ke King Rezi
  lewat `AskUserQuestion`, bukan ditebak sendiri.
- King Rezi memilih: avatar+badge di header DAN footer "Published via
  [platform]"+"Go to post" sama-sama merepresentasikan **target pertama
  yang published** di `item.targets` (bukan agregat semua target) — per
  target lain tetap pakai "Lihat post asli" yang sudah ada di "Hasil per
  Akun". Pattern di-update sesuai keputusan ini dan di-push sebagai LOCKED
  PATTERN (konfirmasi `AskUserQuestion` 2026-10-07).
- `readme.md` Screens section disinkronkan di publish yang sama (ADR-056)
  dengan detail pattern baru + alasan desainnya.
- Catatan implementasi eksplisit untuk T-111.2: caption di rancangan ini
  me-render URL/hashtag sebagai link inline — itu butuh utility "linkify"
  baru (parse plain-text, deteksi URL/#hashtag) yang **belum ada** di
  `apps/web/src` (sudah dicek) — scope kode baru, bukan sekadar
  styling/markup saat T-111.2 dikerjakan.

Status T-111 di `tasks/v02-publishing-mvp.md` + `TASKS.md` diupdate ke
🟡 In Progress (T-111.1 ✅ Done, T-111.2/.3/.4 masih ⏳). T-111.3/T-111.4
(Post asal Engage) belum disentuh — scope terpisah, task sendiri.

**Revisi T-111.1 (sama hari, permintaan King Rezi):** "Hasil per Akun"
dipindah dari `.dialog-fs-body` ke `.dialog-fs-footer` — supaya status
publish/retry per akun SELALU terlihat, tidak perlu di-scroll-cari kalau
caption panjang. Body sekarang murni avatar+caption+media; footer
di-override `flex-direction:column` (class lokal `.history-footer-results`)
dengan `max-height:45vh`+scroll sendiri biar post dengan banyak target
tidak mendorong `.dialog-md` melebihi `max-height:82vh`-nya. Pola footer
lama "Published via [platform]"+"Go to post" dihapus karena jadi redundan
dengan "Lihat post asli" per-row yang sekarang satu tempat di footer.
`templates/publish-history-detail.html` + `readme.md` di Claude Design
sudah disinkronkan ulang.

**Revisi kedua T-111.1 (sama hari, permintaan King Rezi):** avatar+badge
platform yang semula satu di atas `.dialog-fs-body` (merepresentasikan
"target pertama yang published" — ambigu untuk post multi-platform)
dihapus dari body, dipindah jadi PER-ROW di setiap baris "Hasil per Akun"
(class baru `.history-target-account`, reuse `.channel-avatar-wrap`/
`.channel-avatar`/`.channel-badge` dari sidebar, ukuran 28px/12px)
menggantikan `.platform-dot`+nama platform generik yang lama — tiap baris
sekarang menampilkan avatar+platform+nama akun MILIKNYA SENDIRI yang
akurat, bukan representasi tunggal untuk seluruh post. Ini sekaligus
menghilangkan catatan ambiguitas "target pertama published" dari revisi
sebelumnya. `templates/publish-history-detail.html` + `readme.md` di
Claude Design disinkronkan ulang lagi.

**Revisi ketiga T-111.1 (sama hari, final, permintaan King Rezi):** footer
("Hasil per Akun" dengan scroll-area sendiri, hasil revisi kedua) dibatalkan
— dua area scroll terpisah dalam satu dialog (body + footer) terasa tidak
enak dilihat. "Hasil per Akun" dipindah kembali jadi bagian dari
`.dialog-fs-body` (satu-satunya scroll area), ditempatkan PALING BAWAH
setelah media, dipisahkan `.history-post-divider` (garis horizontal).
Dialog sekarang final cuma 2 bagian: `.dialog-fs-header` (fixed) +
`.dialog-fs-body` (satu scroll area, isi: caption → media → divider →
Hasil per Akun). Avatar+badge per-row (dari revisi kedua) TETAP
dipertahankan. `templates/publish-history-detail.html` + `readme.md` di
Claude Design disinkronkan ulang untuk ketiga kalinya — pattern ini FINAL.

---

## 2026-10-06 — KI-083 dicatat + Promoted to T-111: restrukturisasi layout preview media post asli (History Detail & Post asal Engage)

Tak lama setelah fix KI-082 di bawah (object-cover → object-contain) selesai
dikerjakan di branch/PR yang sama, King Rezi menilai hasilnya belum sesuai
keinginan — thumbnail masih dalam kotak crop kecil, bukan representasi post
asli dengan lebar/tinggi sesuai aslinya. Dicatat sebagai **KI-083** dan
langsung dipromosikan ke **T-111** karena King Rezi sudah commit
mengerjakannya, tapi **setelah** PR #144 (KI-082) merge ke `staging` —
dikonfirmasi eksplisit King Rezi agar T-111 tidak ditumpuk di PR yang sama,
melainkan menunggu merge dulu.

**Klarifikasi scope (via `AskUserQuestion`, 2 pertanyaan):**
1. Restrukturisasi total (bukan sekadar ganti `object-fit`/ukuran) — media
   jadi elemen visual utama, menyerupai tampilan post asli di platform
   sosial medianya.
2. Pola visual boleh beda antara History Detail (halaman penuh) dan Post
   asal Engage (kotak kecil di panel detail samping) — tidak wajib identik.

**T-111** ditambahkan di `tasks/v02-publishing-mvp.md` (4 subtask:
T-111.1/.2 History Detail, T-111.3/.4 Post asal Engage) — ID global T-111
(setelah T-110). Explicit gate AGENTS.md rule 17 dicatat di task: rancangan
Claude Design SAAT INI (`publish-history-detail.html`, `engage-inbox.html`)
masih pola lama (`.popover-thumb`/`.thumb` kotak kecil) — implementasi kode
**STOP** sampai rancangan baru dibuat/dikunci di Claude Design dulu (Neymar
Product Designer atau King Rezi langsung), sesuai arahan King Rezi "mulai
dari Claude Design baru ke code seperti biasa".

Dokumentasi disinkronkan: `PROJECT_STATE.md` (KI-083 block + Snapshot Top
Next Tasks), `TASKS.md` (indeks v0.2 27 task, total 98 task/247 subtask,
footnote ID T-111, Fokus aktif). Murni dokumentasi backlog — belum ada
kode/Claude Design yang disentuh untuk T-111.

---

## 2026-10-06 — KI-082 (History Detail) Resolved: media post asli tampil di `/publish/history/[postId]` (branch `fix/ki-082-history-detail-media`, belum di-PR-kan)

Menindaklanjuti catatan KI-082 di bawah (Claude Design sudah di-update
sebagian, implementasi kode `apps/web` belum ada) — dikerjakan main agent
session langsung atas permintaan King Rezi, bukan lewat subagent (scope kecil,
murni wiring reuse pola T-056).

- **Investigasi awal (subagent Explore):** konfirmasi `Post.mediaIds` sudah
  ada di Prisma (`schema.prisma`), tapi `HistoryItemRecord` (domain
  `publishing`) belum membawa field itu — gap-nya murni di layer
  domain-type/mapper, BUKAN query/join baru (Prisma query `getHistoryById`
  sudah fetch `post` penuh).
- **Domain (`publishing.repository.ts`):** `HistoryItemRecord` ditambah
  `mediaIds: MediaId[]`; `mapHistoryItem` (lib repository impl) di-map dari
  `post.mediaIds`. 2 test fixture (`group-history-items.test.ts`,
  `publishing.service.test.ts`) disesuaikan (`mediaIds: []`).
- **Entry point (`page.tsx`, `/publish/history/[postId]`):** resolve media
  PERTAMA post ke thumbnail lewat `MediaService.listByIds` +
  `supabaseMediaStorageAdapter` (signed URL fresh tiap request) — pola PERSIS
  `getInboxItemDetailAction` T-056 (`engage/actions.ts`), dikombinasikan
  sebagai DTO siap-render (AGENTS.md #5, bukan keputusan bisnis baru).
- **UI (`HistoryDetail.tsx`):** thumbnail baru (`HistoryDetailThumbnailDto`)
  dirender sekali per post (bukan per `.history-target-row`) di Card
  ringkasan, reuse `MediaThumbnail` (`app/(app)/components/media-thumbnail.tsx`,
  sama komponen T-056) — menerapkan LOCKED PATTERN `.popover-thumb` dari
  Claude Design (`templates/publish-history-detail.html`, dikonfirmasi lewat
  `DesignSync get_file`: box full-width ~120px, bukan `size-11` kecil seperti
  `.thumb` Comments Inbox). Media di-omit total (bukan kotak kosong) kalau
  post tidak bermedia.
- **Verifikasi:** `tsc --noEmit` bersih, `eslint` bersih (1 arbitrary-value
  warning `h-[120px]` diperbaiki jadi `h-30`), Vitest 66 test relevan PASS.
  Diverifikasi visual lewat Browser pane ke dev server lokal (data real) —
  post dengan media menampilkan thumbnail penuh, post tanpa media tidak
  menampilkan kotak apa pun, tidak ada console error.
- **Calendar Post Preview Popover TIDAK disentuh** — sesuai keputusan King
  Rezi sebelumnya (lihat entri KI-082 di bawah), placeholder yang ada sudah
  dikonfirmasi cukup, bukan gap tersisa.

KI-082 ditutup sepenuhnya oleh perubahan ini (satu-satunya gap kode yang
tersisa dari entri di bawah). Belum di-PR-kan — King Rezi sedang code review
PR lain secara paralel saat sesi ini berjalan.

---

## 2026-10-06 — T-056 ✅ Done: Preview post asli di kotak "Post asal" Comments Inbox (commit `e7395c7`, PR #143)

Implementasi T-056 (promosi KI-065, kotak "Post asal" di detail panel
Comments Inbox `/engage` kini menampilkan caption, thumbnail, dan link post
asli alih-alih label generik) selesai, direview, dan lulus QA. Branch
`feature/t056-engage-post-asal-preview` → PR #143 ke `staging`.

- **Implementasi (Prabowo Feature Engineer):** extend
  `EngagementInboxItemRecord`/`InboxItemDetail` dengan field `postSnapshot`
  (caption, thumbnail, `platformPostUrl`), join `engagement → publishing`
  lewat port lokal structural-typing (`PublishingPostSnapshotPort`, pola sama
  `PublishingPostReferencePort` yang sudah ada) — bukan import tipe konkret
  lintas domain. Thumbnail diresolve lewat `MediaService.listByIds` (bukan
  `resolveOutstandPostMedia`, yang khusus upload-prep ke Outstand).
- **Review arsitektur (Ridwan):** 0 pelanggaran hard rule. 1 temuan perilaku
  dikonfirmasi King Rezi via `AskUserQuestion`: kotak "Post asal" sengaja
  hilang total (bukan fallback label generik) kalau `postId` ada tapi
  `postSnapshot` gagal di-resolve — keputusan final, bukan bug.
- **QA round 1 (Najwa):** 2 bug ditemukan — (a) caption tidak truncate, box
  melebar keluar viewport; (b) thumbnail broken karena signed URL Supabase
  Storage (TTL 1 jam) di-cache permanen di `MediaItem.url`, tidak pernah
  di-generate ulang.
- **Fix (a) — Mark UI Engineer:** tambah `min-w-0` di `.thread-detail` DAN
  `.post-context` (dua lapis penyebab).
- **Fix (b) — Elon Backend Engineer**, keputusan King Rezi (generate ulang
  signed URL saat request, dipilih dari 3 opsi): `IMediaStorageAdapter`
  ditambah method `getSignedUrl`; `MediaService` regenerate signed URL fresh
  di `getMediaItem`/`listMediaItems`/`listByIds` kalau storage adapter
  disuplai. Diterapkan juga di `getDraftAction` (titik rawan sama). Jalur
  validasi-only (`resolveAndValidateMediaIds`, `scheduleDraftAction`,
  `publishNowAction`) sengaja tidak disuplai storage adapter. Kolom
  `MediaItem.url` TIDAK dihapus, tetap fallback.
- **QA round 2 (Najwa, independen):** PASS semua — 620 test pass/6 skip,
  typecheck/lint bersih, tidak ada regresi.
- **Gate T-103.3** (verifikasi struktur vs Claude Design): PASS.
- **Catatan masa depan:** thumbnail untuk post hasil Import Posts
  (T-090/T-091, ADR-093) belum relevan — fitur itu belum diimplementasikan
  sama sekali. Perlu didesain ulang nanti karena `PublishingPost.mediaIds`
  saat ini hanya menunjuk `MediaItem` lokal hasil upload sendiri.

**KI-065 Resolved (2026-10-06)** — ditutup oleh penyelesaian T-056 di atas.
Detail lengkap: `tasks/v04-engagement-mvp.md` § T-056.

---

## 2026-10-06 — KI-082 dicatat + Claude Design `publish-history-detail.html` di-update (media preview)

Setelah lock Claude Design T-056, King Rezi menemukan gap serupa (media post
asli tidak tampil) di dua lokasi lain: History Detail Post dan Calendar Post
Preview Popover — dicatat sebagai **KI-082** di `PROJECT_STATE.md` (root cause:
domain type `publishing` — `PublishingPost`/`CalendarItemRecord`/
`HistoryItemRecord`/`HistoryDetailItem` — belum punya field media sama sekali,
diverifikasi langsung ke kode `apps/web` lewat subagent Explore).

**Keputusan scope:** KI-082 TIDAK digabung ke T-056 karena lokasi/fitur beda
(T-056 = domain `engagement`/Comments Inbox; KI-082 = domain `publishing`).
Tetap Open sebagai item terpisah.

**Claude Design (project "Social Media Management") di-update sebagian untuk
KI-082** oleh main agent session langsung (DesignSync, sama seperti T-056):
- `templates/publish-history-detail.html` — ditambah media/thumbnail post
  asli, reuse `.popover-thumb` persis dari `components/popover.html` (bukan
  `.thumb` dari `templates/engage-inbox.html` — dua pola existing, King Rezi
  pilih `.popover-thumb` via `AskUserQuestion`), ditempatkan sekali per post
  di kartu caption atas (bukan per `.history-target-row`, karena media milik
  post bukan per-target). Dikunci komentar "LOCKED PATTERN (KI-082,
  2026-10-06)".
- `components/popover.html` (Calendar Post Preview Popover) **sengaja TIDAK
  diubah** — King Rezi konfirmasi via `AskUserQuestion` placeholder
  `.popover-thumb` yang sudah ada di sana sudah cukup.
- `readme.md` — bullet baru ditambahkan untuk `templates/publish-history-detail.html`
  (sebelumnya belum ada entri terpisah untuk file ini) mendokumentasikan lock
  di atas.

Semua perubahan diverifikasi ulang dari remote (diff bersih). Implementasi
kode `apps/web` (field media di domain `publishing`) **belum dimulai** — KI-082
tetap status Open.

---

## 2026-10-06 — Claude Design T-056/KI-065 di-lock (desain saja, implementasi kode belum mulai)

Update Claude Design (project "Social Media Management",
projectId `84aded99-bb23-49b1-be9f-dd8f21c6873e`) untuk menutup gap desain
KI-065 / scope T-056 (preview post asli di kotak "Post asal" Comments Inbox).
Dikerjakan oleh **main agent session langsung** (bukan Neymar Product
Designer — Neymar gagal karena DesignSync tidak ter-load di sesi subagent-nya,
limitasi sudah tercatat di `.claude/agents/README.md`).

Perubahan (semua sudah diverifikasi ulang dari remote, diff bersih, tidak ada
perubahan tak diminta):
1. `templates/engage-inbox.html` (KSP-06) — kotak `.thread-detail .post-context`
   diubah dari label generik ("Post asal" + judul, tanpa link) menjadi:
   caption asli (`.post-context-cap`, class baru, truncate 1 baris, di dalam
   `.post-context-body`, class baru) + link **"Go to post →"** yang reuse
   class `.popover-link` persis dari `components/popover.html` (Post Preview
   Popover) — bukan gaya ikon+"Lihat post asli" dari
   `publish-history-detail.html`. Dua pola existing ini ambigu secara teknis
   per AGENTS.md rule 17; King Rezi memilih eksplisit via `AskUserQuestion`:
   reuse `components/popover.html` ("Go to post →", tanpa ikon, teks Inggris).
   Komentar HTML **"LOCKED PATTERN (T-056, 2026-10-06, King Rezi confirmed
   via AskUserQuestion)"** ditambahkan tepat di atas blok `.post-context`,
   termasuk aturan fallback: post tanpa media → elemen `.thumb` di-omit
   sepenuhnya (bukan kotak kosong), kolom teks jadi full width (keputusan ini
   dibuat main agent sendiri, tanpa tanya King Rezi, karena dianggap bukan
   fork pola struktural seperti dimaksud rule 17 — cuma soal perlu-tidaknya
   duplikasi mockup dua-state).
2. `styles.css` — 2 rule baru ditambahkan tepat setelah rule `.thumb` (baris
   ~774): `.post-context-body { flex: 1; min-width: 0; }` dan
   `.post-context-cap { ...; overflow:hidden; text-overflow:ellipsis;
   white-space:nowrap; ... }`. Tidak ada rule lain yang diubah.
3. `readme.md` — bullet `templates/engage-inbox.html` (sekitar baris lama 246)
   diperluas dengan catatan **LOCKED PATTERN (T-056, 2026-10-06, King Rezi
   confirmed via AskUserQuestion)** menjelaskan perubahan di atas secara
   naratif, termasuk menyebut eksplisit ada dua pola link existing dan mana
   yang dipilih.

Dokumentasi project di-update menyertai ini: `tasks/v04-engagement-mvp.md`
§ T-056 (catatan lock ditambahkan, status task **tetap** `⏳ Not Started` —
desain selesai, kode belum) dan `PROJECT_STATE.md` § KI-065 (catatan
sinkronisasi desain ditambahkan, status KI tetap "Promoted to T-056").

Branch kerja `feature/t056-engage-post-asal-preview` sudah dibuat dari
`origin/staging` untuk lanjut implementasi, tapi **belum ada commit kode
apps/web** sama sekali — baru perubahan Claude Design yang selesai di sesi
ini.

---

## 2026-10-05 — KI-025 (follow-up) item 2/3 selesai: fallback enqueue `resolve_outcome` di `PublishNowUseCase`

Gap kode ditemukan 2026-10-02 (lihat `PROJECT_STATE.md` § Blockers, entri
"KI-025 (follow-up)"): `PublishNowUseCase` tidak pernah enqueue job
`RESOLVE_SCHEDULED_POST_OUTCOME_JOB_TYPE` saat `fetchPostOutcome`
mengembalikan status `"pending"` — beda dari `SchedulePostsUseCase` yang
sudah benar melakukan ini. Akibatnya post yang dipublish lewat Publish Now
dengan outcome belum instan dari Outstand bisa stuck
`PublishingPostTarget.status = "pending"` permanen, membuat post itu tidak
pernah dianggap "syncable" oleh `SyncCommentsUseCase` — root cause Comments
Inbox `/engage` kosong untuk post Publish Now (dilaporkan King Rezi, kasus
nyata: komentar Instagram akun `turanilkerl`, workspace "Lunch").

**Fix** (delegasi ke Elon Backend Engineer):
`apps/web/src/domains/publishing/services/publish-now.use-case.ts` —
constructor `PublishNowUseCase` sekarang menerima `jobScheduler:
IJobScheduler` sebagai parameter ketiga (pola sama persis
`SchedulePostsUseCase`). Setelah `fetchPostOutcome` resolve, kalau ada
target yang masih `"pending"`, SATU job `resolve_outcome` di-enqueue DI
LUAR try/catch adapter (payload `{ outstandPostId }`, `scheduledAt: new
Date()` — langsung eligible, beda dari Schedule yang pakai `scheduledAt`
masa depan) — kegagalan enqueue hanya di-log, tidak menandai post/target
`failed`. Call site `publishNowAction`
(`apps/web/src/app/(app)/components/draft-editor/actions.ts:715`) di-wire
untuk pass `backgroundJobScheduler` yang sudah ada di file. 2 test baru di
`publish-now.use-case.test.ts`: job terpanggil saat ada outcome pending,
TIDAK terpanggil saat semua outcome final (success/failed).

Verifikasi: `vitest run` domain publishing 221 passed, full suite 599
passed/6 skipped (0 regresi); `tsc --noEmit`, `eslint`, `prettier --check`
bersih. Dikerjakan di worktree terpisah
(`fix/ki-025-publish-now-resolve-outcome`, base `origin/staging`) supaya
tidak bentrok dengan PR #140 yang sedang berjalan di branch lain. Belum
commit/push (menunggu instruksi eksplisit King Rezi).

**Sisa KI-025 (follow-up) yang masih terbuka:** (1) re-verifikasi/health-
check Railway Cron staging (regresi infra kemungkinan terpisah dari gap
kode ini), (3) backfill one-off untuk post LAMA yang sudah telanjur stuck
`"pending"` sebelum fix ini — post baru setelah fix ini tidak lagi stuck.

---

## 2026-09-28 — KI-081 Resolved: `markPostFailed` sekarang men-null-kan `publishedAt`

Ditemukan via `/code-review` PR #140 (finding #2, dikonfirmasi CONFIRMED oleh
verifier): `PublishNowUseCase` menandai `publishedAt` DI MUKA lewat
`repository.publishNow` sebelum outcome per-target diketahui. Kalau semua
target ternyata gagal, `markPostFailed` mengoreksi `status` ke `Failed` tapi
sebelumnya tidak pernah men-null-kan `publishedAt` yang sudah kadung terisi —
post `Failed` bisa punya timestamp publish keliru.

**Fix:** `apps/web/src/lib/repositories/publishing/publishing.repository.ts`
— `markPostFailed` sekarang menyertakan `publishedAt: null` di `data`
`updateMany`. Aman untuk SEMUA caller (`PublishNowUseCase`, di mana field ini
butuh dikoreksi, DAN `SchedulePostsUseCase`/`OutstandWebhookProcessor`, di
mana field ini sudah `null` sejak awal — jadi no-op untuk jalur itu).
`IPublishingRepository.markPostFailed` (interface) diupdate catatan
dokumentasinya. Tidak ada test unit baru (tidak ada test khusus implementasi
Prisma repository ini sebelumnya — pola project, verifikasi lewat
typecheck/full suite regression + live DB smoke test manual bila diperlukan).

Verifikasi: `bun run typecheck` bersih, `bun run lint` bersih, `bun run test`
605 passed/6 skipped (tidak ada regresi, karena use-case layer di-test lewat
fake repository yang tidak menyentuh field Prisma ini).

---

## 2026-09-28 — T-107/T-108/T-109 ✅ Done: promosi Known Issues KI-049/KI-063/KI-044/KI-058; 1 KI baru (KI-081)

Audit aplikasi menyeluruh atas permintaan King Rezi mempromosikan 4 Known
Issue jadi 3 task resmi, semuanya selesai diimplementasikan, direview
Ridwan Architecture Reviewer (0 temuan), dan di-QA Najwa QA Engineer
(semua golden path/edge case PASS).

**T-107** (promosi KI-049 + KI-063, digabung karena root cause & lokasi
kode sama persis) — `PublishingPost.publishedAt`/`failedAt`/`failureReason`
tidak pernah ditulis oleh `markPostPublished`/`markPostFailed`. Fix:
signature `markPostFailed` berubah (tambah param `reason: string`);
implementasi Prisma sekarang set ketiga kolom itu. 3 call-site
(`schedule-posts.use-case.ts`, `publish-now.use-case.ts`,
`outstand-webhook-processor.ts`) menyediakan `reason` dari
`PostTargetOutcome.error` unik per target (join `"; "`, fallback teks
generik). Najwa verifikasi code-trace + schema (tidak ada jalur
publish/fail nyata tersedia di data dev untuk uji end-to-end browser —
dicatat sebagai keterbatasan, bukan kegagalan).

**T-108** (promosi KI-044) — tidak ada validasi mencegah Schedule ke waktu
yang sudah lewat pada tanggal hari ini. Fix: modul domain baru
`schedule-time-constraints.ts` (pola sama `pinterest-board-constraints.ts`),
dipanggil client (`Modal.tsx`, reuse `Alert variant="destructive"`) dan
server (`schedule-posts.use-case.ts`, defense-in-depth). Najwa verifikasi
browser: golden path PASS (tanggal hari ini + jam lewat → Alert + tombol
disabled), edge case tanggal masa depan PASS (tidak regresi), boundary
case PASS.

**T-109** (promosi KI-058) — `ConnectedAccountsList.tsx` tidak
menyembunyikan/men-disable aksi Connect/Disconnect/Reconnect untuk role
Creator. Fix: `WorkspaceService.canManageConnectedAccounts` baru (reuse
pola `canManageWorkspaceSettings`), UI menyembunyikan **total** (bukan
disabled) tombol untuk Creator. Najwa verifikasi browser dengan akun real
(Sinta=Creator tombol hilang, Raka=Owner tetap ada — PASS keduanya). Gate
T-103.3 sempat gagal di sesi Najwa (`DesignSync` tidak termuat — kejadian
**pertama** di sesi Najwa QA Engineer; sebelumnya limitasi ini hanya
tercatat 7 kali di sesi Neymar Product Designer, lihat
`.claude/agents/README.md`) — dijalankan ulang di sesi utama, hasil PASS
(diff murni membungkus struktur "SYNCED"
`templates/settings-connected-accounts.html` dengan kondisi role, tidak
mengubah markup yang dikunci).

**Dikerjakan:** Prabowo Feature Engineer ×2 (T-107, T-108) + Mark UI
Engineer (T-109), review Ridwan Architecture Reviewer (0 temuan untuk
ketiganya), QA Najwa QA Engineer (PASS semua skenario).

**1 Known Issue baru ditemukan (KI-081, Open):** `PublishNowUseCase`
mengisi `publishedAt` di muka (lewat `repository.publishNow`) sebelum
outcome per-target diketahui — kalau semua target gagal dan
`markPostFailed` mengoreksi `status` ke `Failed`, `publishedAt` yang sudah
kadung terisi tidak ikut di-null-kan, sehingga post `Failed` bisa punya
`publishedAt` keliru. Bug pre-existing, independen dari T-107, sengaja
tidak diperbaiki otomatis karena butuh keputusan perilaku tambahan.

**Verifikasi akhir:** `bun run typecheck` bersih, `bun run lint` bersih,
`bunx vitest run` **593 passed/6 skipped**. Tidak ada commit/push di sesi
ini.

---

## 2026-09-26 — KI-080 Resolved: fix build Railway (`next.config.ts` workspace import); KI-078/KI-079 Resolved via ADR-122

Lanjutan sesi sebelumnya (entri tepat di bawah ini, commit `d0286fd`/
`349290d` — fix KI-073–076 & 2 KI baru KI-078/079). Sesi ini: (1) King
Rezi meminta cek kenapa Railway staging gagal build setelah PR #138
(fix KI-073–076) di-merge ke `staging`; (2) setelah itu, kerjakan
KI-078/KI-079.

**KI-080 Resolved (baru, ditemukan+diperbaiki sesi ini)** — Railway
staging build gagal (`FAILED`, deployment `6798220d`, commit `71c90a3` —
merge PR #138) dengan `Error: Cannot find module '../../packages/shared'`
saat tahap `next build` (`⨯ Failed to load next.config.ts`). Root cause:
fix KI-075 (body size limit) menambah
`import { MAX_MEDIA_FILE_SIZE_BYTES } from "./src/domains/media/validation"`
di `apps/web/next.config.ts` — tapi `validation.ts` juga mengimpor
`MediaType` dari `@social/shared` (workspace package, `main: "./index.ts"`,
source langsung tanpa build step). Next.js `next-config-ts` mentranspile
lalu me-`require()` `next.config.ts` lewat Node CJS biasa (bukan
resolver bundler Next/Turbopack yang biasa dipakai untuk source app) —
`require()` polos tidak bisa resolve source package workspace itu.
Direproduksi identik secara lokal (`bun run build` di `apps/web`, error
sama persis). Fix: konstanta `MAX_MEDIA_FILE_SIZE_BYTES` diisolasi ke file
baru `apps/web/src/domains/media/constants.ts` (nol import
`@social/shared`); `validation.ts` re-export dari situ (caller lain tidak
berubah); `next.config.ts` diarahkan ke `constants.ts`, bukan
`validation.ts`. Diverifikasi: `bun run build` (full, termasuk generate
static pages) + `bun run typecheck` + `bun test src/domains/media` (17
test) semua PASS lokal. **Dikerjakan di branch terpisah**
`fix/next-config-ts-workspace-import-ki075-followup` (belum di-PR-kan ke
`staging` — menunggu instruksi King Rezi), supaya tidak tercampur dengan
commit KI-078/079 di bawah.

**KI-078 Resolved via ADR-122** — akun `disconnected` tidak punya jalur
UI untuk reconnect. Fix murni UI: `ConnectedAccountAction`
(`ConnectedAccountsList.tsx`) digabung — `case "reconnect-required":` dan
`case "disconnected":` sekarang sama-sama merender `ReconnectButton`
(kecuali Facebook, guard lama tetap). Dicek dulu ke Claude Design (rule 17
`AGENTS.md`) sebelum menulis kode UI: `templates/settings-connected-
accounts.html` sudah menunjukkan pola ini (chip status "Disconnected"
berpasangan tombol "Reconnect"), jadi tidak perlu `AskUserQuestion`
tambahan. Backend TIDAK perlu diubah — `WorkspaceService.
initiateConnectAccount` sudah generik menerima `redirectAccountId` untuk
akun `reconnect-required`/`disconnected` apa pun (docstring method itu
sudah menyebut keduanya sebelum sesi ini). Karena `ReconnectButton` mengisi
`redirectAccountId`, `completeAccountConnection` memakai
`IWorkspaceRepository.reconnectAccount` (UPDATE baris existing) — bukan
`createConnectedAccount` (INSERT) — sehingga tidak lagi menabrak unique
constraint `[workspaceId, outstandAccountId]` dari baris `disconnected`
lama.

**KI-079 Resolved via ADR-122** — Route Handler callback Outstand
sebelumnya memperlakukan SEMUA `ConflictError` dari `createConnectedAccount`
sebagai redirect "success" diam-diam. Fix: `WorkspaceService` dapat method
baru `createOrRecoverConnectedAccount` (wrapper `createConnectedAccount`)
yang membedakan dua kasus lewat `connectedAt` baris yang bentrok (kolom
ini immutable setelah `create`, termasuk lewat `reconnectAccount`) — dibuat
dalam 15 detik terakhir (`DOUBLE_SUBMIT_RECOVERY_WINDOW_MS`) →
idempotent, kembalikan baris existing sebagai sukses (perilaku lama
dipertahankan untuk double-submit genuine); lebih lama → `AlreadyConnectedError`
baru (subclass `ConflictError`, `@/lib/utils/errors`) dilempar. Route
Handler memetakan `AlreadyConnectedError` ke status redirect baru
`?connect=already-connected` (bukan `success` atau `error` generik);
`ConnectedAccountsList.tsx` menampilkan toast spesifik ("sudah terhubung
... gunakan tombol Reconnect"), bukan copy "Coba lagi" yang menyesatkan.
Repository dapat method baru `findConnectedAccountByOutstandId`
(interface `IWorkspaceRepository` + implementasi Prisma).

**Verifikasi (KI-078/079):** `bun run typecheck` PASS; `bun run lint`
PASS; `bun test src/domains/workspace` 126 test PASS (2 test baru khusus
`createOrRecoverConnectedAccount`: recovery dalam window & throw di luar
window); `bun run build` PASS. Belum ada verifikasi browser end-to-end
(tidak ada kredensial Outstand real yang bisa dipakai ulang di sesi ini)
— murni verifikasi kode + unit test, sama seperti disclaimer yang sama
berlaku untuk perubahan backend lain di project ini tanpa akses langsung
ke akun test.

File yang diubah — KI-080 (branch terpisah):
`apps/web/next.config.ts`,
`apps/web/src/domains/media/constants.ts` (baru),
`apps/web/src/domains/media/validation.ts`.

File yang diubah — KI-078/079:
`apps/web/src/app/(app)/settings/connected-accounts/components/ConnectedAccountsList.tsx`,
`apps/web/src/app/(app)/settings/connected-accounts/page.tsx`,
`apps/web/src/app/api/integrations/outstand/callback/route.ts`,
`apps/web/src/domains/workspace/repositories/workspace.repository.ts`,
`apps/web/src/domains/workspace/services/workspace.service.ts`,
`apps/web/src/domains/workspace/services/workspace.service.test.ts`,
`apps/web/src/lib/repositories/workspace/workspace.repository.ts`,
`apps/web/src/lib/utils/errors.ts`.

Detail lengkap: `PROJECT_STATE.md` § Known Issues (KI-080 tidak
didaftarkan Open — ditemukan+Resolved sesi ini, langsung diarsipkan di
sini) + § Recent Decisions, `decisions/ADR-122-reconnect-disconnected-
accounts-plus-already-connected-conflict-ki078-079.md`, `DECISIONS.md`.

---

## 2026-09-26 — KI-073–076 Resolved: 4 bug publish Instagram diperbaiki + diverifikasi live; ADR-120; 2 KI baru; koreksi duplikat ID KI-064

Lanjutan dari investigasi sesi sebelumnya (entri tepat di bawah ini,
commit `349290d` — root cause 4 bug sudah dianalisis di sana, sesi ini yang
mengimplementasikan fix-nya). Diimplementasikan Prabowo Feature
Engineer (KI-073/074), Elon Backend Engineer (backend KI-076), Mark UI
Engineer (UI KI-076), direview Ridwan Architecture Reviewer (clean, 1
temuan governance — index ADR belum didaftarkan, sudah diperbaiki di sesi
ini), diverifikasi end-to-end King Rezi + AI langsung di browser dengan
akun Instagram (`turanilkerl`)/Facebook real (bukan Najwa QA Engineer).

**KI-073 Resolved** — caption wajib walau target Story. Fix:
`apps/web/src/app/(app)/components/draft-editor/Modal.tsx` —
`isReadyToSchedule`/`isReadyToPublishNow` sekarang caption hanya wajib
kalau ada target non-Story. Diverifikasi live: publish Story tanpa caption
ke akun Instagram real `turanilkerl` — berhasil, tayang di History dengan
label "(Tanpa caption)".

**KI-074 Resolved** — Story bisa publish tanpa media (tayang kosong di
Instagram). Fix: `apps/web/src/domains/publishing/content-format-matrix.ts`
(tambah `MIN_MEDIA_COUNT_BY_FORMAT`/`assertMediaCountMeetsMinimum`/
`minMediaCountConstraintMessage`), dipanggil di `Modal.tsx` (client gate)
dan `draft-editor/actions.ts` (`scheduleDraftAction`/`publishNowAction`).
Diverifikasi live: tombol Publish Now ter-disable dengan pesan "butuh
minimal 1 media" sebelum media di-attach, aktif setelah media di-attach;
publish sungguhan berhasil.

**KI-075 Resolved** — upload media >1MB gagal (Next.js Server Action
default body limit 1MB, gejala salah dikira "cuma jpg yang bisa"). Fix:
`apps/web/next.config.ts` — tambah
`experimental.serverActions.bodySizeLimit: "50mb"` (sinkron
`MAX_MEDIA_FILE_SIZE_BYTES`). Diverifikasi live: upload file PNG nyata
1.47MB berhasil tanpa error (sebelumnya gagal 500 "Body exceeded 1 MB
limit").

**KI-076 Resolved (backend + UI)** — avatar akun Instagram/Facebook tidak
pernah tampil di sidebar Channels. Fix 5 lapisan, dikunci **ADR-120**
(amandemen ADR-112): kontrak ACL `packages/shared/src/contracts/outstand-adapter.ts`
(`ConnectedAccountData.avatarUrl?`); adapter
`apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts` (fetch avatar
via `GET /v1/social-accounts/{id}`, field `profile_picture_url` —
diverifikasi langsung ke API Outstand asli via MCP resmi, endpoint+field
terkonfirmasi benar untuk single-page; path exact untuk kasus ini
diinferensi, best-effort, gagal → `null`, tidak menggagalkan connect);
Prisma schema (`apps/web/prisma/schema.prisma` + migration
`20260926090000_ki076_add_avatar_url_to_workspace_connected_accounts`,
migration sudah **diterapkan** ke database via `bun run db:deploy`, King
Rezi sudah menjalankan); domain type `apps/web/src/domains/workspace/types.ts`
(`SidebarChannelAccount.avatarUrl`, wajib non-optional); UI
`ChannelsSection.tsx` + `ConnectedAccountsList.tsx` (tambah
`<AvatarImage>`). Verifikasi API real: akun Facebook Page "Cook It Real
Good" punya `profile_picture_url` asli (foto CDN Facebook); akun Instagram
test `turanilkerl` genuinely `null` (belum ada foto di akun itu sendiri,
bukan bug). Render UI belum sempat diverifikasi visual penuh (akun test
butuh reconnect untuk backfill `avatarUrl`, tapi reconnect akun aktif
tidak accessible lewat UI — lihat **KI-078** di bawah) — kode+test+review
solid, risiko render rendah (pola `AvatarImage`/`AvatarFallback` shadcn
standar, sudah dipakai persis di tempat sama).

**Governance — perbaikan temuan Ridwan:** `decisions/ADR-120-connectedaccountdata-avatarurl-sidebar-channels-ki076.md`
sudah ada di disk tapi belum terdaftar di index `DECISIONS.md`, dan baris
ADR-112 di index yang sama belum ditandai amended. Diperbaiki: baris
ADR-120 ditambahkan ke index (di atas ADR-119, sebagai entri terbaru);
baris ADR-112 diubah jadi "Accepted — Amended by ADR-120 (2026-09-26)";
header `### Status` di file `ADR-112-...md` ditandai sama.

**Governance — koreksi duplikat ID `KI-064`:** ditemukan dua Known Issue
berbeda memakai ID `KI-064` yang sama di `PROJECT_STATE.md` (pelanggaran
ADR-066/067 "ID global, tidak pernah didaur ulang") — kemungkinan besar
akibat dua sesi independen menomori Known Issue baru dengan ID yang sudah
lama terpakai ("`application-layer.md` § Peta Dependency Antar Domain",
dicatat 2026-09-18, direferensikan luas di `tasks/v02-publishing-mvp.md`/
`tasks/v03-analytics-mvp.md`) vs "Deploy Railway staging gagal — Node.js 18
EOL" (dicatat + Resolved 2026-09-26 via commit `2541037`/`fix(deploy): pin
Node 22 for Railway Nixpacks build (KI-064)`, hanya direferensikan di
`PROJECT_STATE.md` sendiri). ID pertama (application-layer.md, masih Open)
dipertahankan sebagai `KI-064` yang sah. ID kedua (Deploy Railway, sudah
Resolved) di-**renumber jadi `KI-077`** — karena statusnya Resolved dan kini
dicatat di sini, per guardrail ukuran (`AGENTS.md`) entrinya dihapus dari
`PROJECT_STATE.md` § Known Issues (bukan dibiarkan menumpuk dengan label
Resolved). Ringkasan isinya untuk arsip: builder Nixpacks Railway tidak
punya pin versi Node eksplisit, fallback ke Node 18 (sudah EOL, dihapus
dari nixpkgs) — fix tambah `"engines": { "node": ">=22" }` di
`package.json` root + `apps/web/package.json`, plus set variable Railway
`NIXPACKS_NODE_VERSION=22` di service `web` staging. Redeploy staging
terverifikasi SUCCESS. Tidak ada perubahan kode tambahan di sesi ini untuk
temuan ini — murni penomoran ulang + housekeeping dokumentasi.

**2 Known Issue baru ditemukan saat verifikasi live (status Open):**

- **KI-078** — akun `disconnected` (bukan `reconnect-required`) tidak
  punya jalur UI apa pun untuk reconnect
  (`ConnectedAccountsList.tsx`, `case "disconnected": return null`).
  Ditemukan tanpa sengaja saat disconnect akun test `turanilkerl` untuk
  keperluan verifikasi KI-076 — harus diperbaiki manual lewat SQL langsung
  (`UPDATE workspace_connected_accounts SET status='active'`) karena unique
  constraint `outstandAccountId` mencegah reconnect via tombol Connect
  generik.
- **KI-079** — Route Handler callback Outstand
  (`api/integrations/outstand/callback/route.ts`, `redirectWithStatus`)
  memperlakukan `ConflictError` SELALU sebagai redirect "success" (didesain
  untuk double-submit, tapi juga menutupi kegagalan genuine seperti
  skenario KI-078 — user melihat "success" padahal data tidak berubah).

Detail lengkap ketiga governance-fix + 2 KI baru: `PROJECT_STATE.md` §
Known Issues + § Recent Decisions. File yang diubah sesi ini (governance
only): `project-manager/PROJECT_STATE.md`, `project-manager/DECISIONS.md`,
`project-manager/decisions/ADR-112-single-page-connect-callback-tanpa-code-exchange-amandemen-adr-105.md`
(header Status).

---

## 2026-09-26 — Retest publish Instagram real account: 4 bug baru ditemukan & dikonfirmasi live (KI-073–KI-076)

King Rezi laporkan 5 gejala dari sesi publish manual nyata (2026-09-25) ke
Instagram real account: (1) Story wajib caption, (2) Story ke-upload tapi
kosong di Instagram, (3) tidak bisa upload `.mp4`, (4) tidak bisa upload
image selain `.jpg`, (5) avatar Facebook/Instagram tidak muncul di avatar
channel. Diminta retest ulang di `localhost:3000` (bukan staging), pakai
akun yang sudah authenticated di browser, Instagram only (tidak post ke
Facebook).

Investigasi gabungan (baca source code langsung + reproduksi live lewat
Browser pane + file media asli/real, termasuk video story asli King Rezi
dari Downloads) menemukan 4 root cause konkret (gejala #3/#4 ternyata satu
root cause yang sama):

- **KI-073**: gate `isReadyToPublishNow`/`isReadyToSchedule`
  (`draft-editor/Modal.tsx:417-429`) mewajibkan caption non-kosong
  unconditional, padahal backend (`real-outstand-adapter.ts:432-464`) sudah
  benar mengosongkan caption untuk Story.
- **KI-074**: tidak ada validasi minimum 1 media untuk Story
  (`content-format-matrix.ts` hanya menegakkan MAKSIMUM), jadi kalau media
  gagal ter-attach, request ke Outstand tetap terkirim dengan
  `content: ""` dan tanpa media — post "berhasil" tapi kosong di Instagram.
- **KI-075**: `apps/web/next.config.ts` tidak override
  `experimental.serverActions.bodySizeLimit` → Next.js pakai default 1MB
  untuk Server Action `uploadMediaAction`. File di atas 1MB (video apa pun,
  image resolusi tinggi non-kompresi) ditolak Next.js sebelum validasi MIME
  aplikasi sempat jalan. Dikonfirmasi live: video story asli 6.7MB dan PNG
  3MB sama-sama gagal dengan network response persis "Body exceeded 1 MB
  limit"; JPG 12KB berhasil upload DAN publish ke Instagram real
  (`turanilkerl`) — post [TEST QA Jokowi] sengaja dibiarkan live di akun
  (captionnya eksplisit menandai test, King Rezi bisa hapus manual dari
  Instagram kalau mau).
- **KI-076**: field avatar/foto profil tidak pernah didesain masuk sistem
  di 5 lapisan (kontrak ACL `ConnectedAccountData`, adapter
  `resolveConnectCallback`/`confirmFacebookPagesConnection`, Prisma
  `WorkspaceConnectedAccount`, domain type `SidebarChannelAccount`,
  komponen `ChannelsSection.tsx` yang cuma render `<AvatarFallback>` tanpa
  `<AvatarImage>`). Untuk Facebook, `pictureUrl` sempat tertangkap di
  `listPendingFacebookPages` tapi dibuang di langkah finalize.

Detail lengkap tiap KI (file/line, kutipan kode, langkah reproduksi) ada di
`PROJECT_STATE.md` § Known Issues. Semua status **Open**, belum ada fix —
sesi ini murni investigasi + dokumentasi, tidak ada perubahan kode
produksi.

---

## 2026-09-25 — T-106.5 ✅ Done: sisa akun dan post Fake/mock dihapus

Di DB bersama `ndcrkzqgqukqfmekgoze`: 23 `workspace_connected_accounts` (`outstand_account_id` `fake-%` atau `mock-%`) dan 9 `publishing_posts` yang menempel dihapus. Target ikut cascade. Inbox (13) dan urutan channel (2) ikut terhapus bersama akun. Verifikasi: 0 akun, 0 target, 0 inbox. 19 draft tanpa channel tidak dihapus — tidak menempel ke akun Fake/mock.

Status T-106 kembali ✅ Done. Indeks v0.2: `20 ✅ · 2 🟡 · 2 ⏳`. Total selesai 58.

## 2026-09-25 — T-106 dibuka lagi: subtask T-106.5 sisa data Fake/mock

King Rezi masih melihat post dan channel palsu di browser setelah T-106.1–.4.
T-106.4 hanya menghapus `publishing_posts` ber-`outstand_post_id` `fake-post-%`
dan URL `fake.outstand.local`. Channel di `workspace_connected_accounts`
(`fake-%` / `mock-%`) dan post yang `outstand_post_id`-nya kosong tidak ikut.

### Added
- **T-106.5** di `tasks/v02-publishing-mvp.md`: hapus seluruh sisa data Fake/mock Outstand di DB bersama dev/staging (channel, post yang menempel, metrik, komentar, urutan channel).

### Changed
- Status T-106: ✅ Done → 🟡 In Progress. Indeks v0.2 di `TASKS.md`: `19 ✅ · 3 🟡 · 2 ⏳`. Total selesai 57. Subtask terdefinisi 226.

## 2026-09-25 — T-106 ✅ Done: Hapus FakeOutstandAdapter dari jalur produksi (ADR-119)

King Rezi menutup **T-106**. Fake OutstandAdapter tidak lagi jalur produksi.

**Keputusan:** ADR-119 Accepted; ADR-059 diamendemen (`Accepted — Amended by ADR-119`).

**Kode (commit `0ce9371`):** `getOutstandAdapter()` hanya `RealOutstandAdapter`; `OUTSTAND_API_KEY` kosong/whitespace → throw jelas; `fake-outstand-adapter.ts` dihapus. Tes memakai double lokal. Rule 19 `AGENTS.md` + `ctx-development.md` diselaraskan.

**Data cleanup (DB bersama `ndcrkzqgqukqfmekgoze`):** 24 `publishing_posts` fake (+ targets cascade) dihapus; verifikasi 0 remaining `fake-post-%` / `fake.outstand.local`; 33 post sungguhan tersisa.

**Review/QA:** Ridwan Architecture Reviewer LOLOS (0 temuan). Najwa QA Vitest PASS — 17 file / 283 tes.

**Dokumentasi tutup:** `tasks/v02-publishing-mvp.md` § T-106 → ✅ Done; `TASKS.md` indeks v0.2 → `20 ✅ · 2 🟡 · 2 ⏳` (Total 58 selesai); Snapshot/Completed di `PROJECT_STATE.md` diperbarui (Fake production path diganti Real wajib).

## 2026-09-25 — KI-072 code review PR #135: board Pinterest wajib, satu akun per create-post

Review PR #135 menemukan `board_id` akun Pinterest pertama bisa menempel ke akun kedua (body Outstand hanya punya satu key `pinterest`), board bertanda opsional tetap dikirim tanpa `board_id`, dan fetch board bisa ketimpa respons yang lebih lama. Perbaikan: `assertPinterestBoardConstraints` menolak sebelum persist (schedule, publish now, retry); `RealOutstandAdapter` menolak sebelum HTTP; Draft Editor mewajibkan board, menonaktifkan Schedule/Publish Now kalau aturan dilanggar, dan mengabaikan respons fetch kadaluarsa. ADR-118 diamendemen di poin 2.

## 2026-09-25 — KI-072 Resolved: `listPinterestBoards` + `board_id` per-post via ADR-118 (backend + UI + review + QA)

King Rezi menutup **KI-072** (Pinterest `board_id` tidak pernah
dikumpulkan). Sesi ini menuntaskan implementasi kode di atas rancangan UI
yang sudah dikunci di sesi sebelumnya (lihat entri di bawah,
"KI-072: rancangan UI board-picker Pinterest selesai di Claude Design").

**Backend (Elon Backend Engineer):**

- Kontrak `IOutstandAdapter` (`packages/shared/src/contracts/outstand-adapter.ts`)
  — tambah type `PinterestBoard { id: string; name: string }` + method baru
  `listPinterestBoards(outstandAccountId: string): Promise<PinterestBoard[]>`.
- `RealOutstandAdapter` (`apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts`)
  — `computePlatformOverride` untuk Pinterest sekarang mengirim
  `{ board_id, title?, link? }` ke Outstand kalau `platformOptions.boardId`
  non-kosong (sebelumnya SELALU `null`, tidak pernah kirim key `pinterest`
  — itulah gap asli KI-072). Kalau `boardId` kosong, tetap `null`
  (perilaku lama, tidak regresi). Tambah implementasi `listPinterestBoards`
  (`GET https://api.outstand.so/v1/pinterest/accounts/{id}/boards`).
- Wire-format diverifikasi via WebFetch OpenAPI spec resmi Outstand
  (`api.outstand.so/v1/posts/openapi.json`,
  `api.outstand.so/v1/pinterest/openapi.json`), bukan tebakan.
- `FakeOutstandAdapter` — `listPinterestBoards` mock instan (pola ADR-059):
  3 board tetap ("Resep & Minuman", "Interior Kedai", "Promo Musiman"),
  selaras mock yang dipakai di Claude Design.
- `WorkspaceService` — method baru `listPinterestBoards(workspaceId,
  actorId, connectedAccountId)`: anti-IDOR (`connectedAccountId` harus
  milik workspace, platform harus Pinterest) sebelum delegasi ke adapter;
  semua member aktif boleh akses.
- Server Action baru `listPinterestBoardsAction`
  (`apps/web/src/app/(app)/components/draft-editor/actions.ts`).

**Review arsitektur (Ridwan Architecture Reviewer):** 0 temuan — entry
point bersih, domain logic tidak import Prisma/Supabase/HTTP langsung,
anti-IDOR terverifikasi test, kontrak type-safe. Vitest full suite 547
pass/6 skip/0 fail, typecheck bersih.

**UI (Mark UI Engineer):** `Modal.tsx` — dropdown `<Select>` shadcn untuk
Board Pinterest (3 state: loading, error+"Coba lagi", sukses), state
`boardIdByAccount: Record<connectedAccountId, string | undefined>`
**per-akun** (bukan global — fix bug QA, lihat di bawah), `buildTargetsPayload()`
mengirim `boardId` per akun. Urutan field final: Pin Title → Destination
Link → Board (sesuai Claude Design `templates/draft-editor.html`).

**QA (Najwa QA Engineer), 2 putaran:**

- Putaran 1: menemukan bug kritis — state board awalnya SATU variabel
  global, menyebabkan pilihan board di 1 akun Pinterest menimpa dropdown
  akun Pinterest lain kalau 2+ dicentang bersamaan. Diperbaiki Mark UI
  Engineer (`boardIdByAccount` per-akun). Urutan field tidak sesuai Claude
  Design (Board di awal, seharusnya di akhir) juga ditemukan+diperbaiki.
  Golden path, edge case board kosong (opsional), role Creator, tidak ada
  regresi platform lain — semua PASS.
- Putaran 2 (retest fix): kode fix diverifikasi BENAR (typecheck/lint/547
  test hijau, pola `boardIdByAccount` identik pola `formatByAccount` yang
  sudah teruji lama). **Verifikasi visual browser untuk skenario 2-akun-
  Pinterest tidak bisa diselesaikan** — blocker: `apps/web/.env.local`
  berisi `OUTSTAND_API_KEY` asli saat sesi ini, dev server otomatis pakai
  `RealOutstandAdapter`, Outstand API asli menolak akun Pinterest palsu
  (`HTTP 400: Invalid social account ID`) — bukan bug kode, murni
  keterbatasan environment lokal.

**Keputusan King Rezi (dikonfirmasi via `AskUserQuestion`):** lanjut commit
berdasarkan verifikasi kode (typecheck/lint/test/architecture review) tanpa
menunggu retest visual browser skenario 2-akun tersebut — keputusan sadar,
dicatat eksplisit sebagai limitasi known (bukan skip diam-diam), supaya
kalau ada bug production terkait ini jejaknya jelas.

**ADR baru:**
`project-manager/decisions/ADR-118-listpinterestboards-board-id-per-post-ki072.md`.

**Docs:** `PROJECT_STATE.md` — KI-072 dihapus dari § Known Issues
(Resolved + tercatat di COMPLETE_TASK); Completed Ringkasan + Recent
Decisions diperbarui; metadata Version 1.0.95 → 1.0.96.
`tasks/v02-publishing-mvp.md` § T-025 — status kembali ke `✅ Done`.
`TASKS.md` § Fokus sekarang — baris "Selesai baru-baru ini" diperbarui.

Detail: `PROJECT_STATE.md` § Completed (Ringkasan), `tasks/v02-publishing-mvp.md`
§ T-025.

---

## 2026-09-25 — KI-072: rancangan UI board-picker Pinterest selesai di Claude Design, scope per-post dikonfirmasi

Gibran Project Manager mendokumentasikan hasil sesi desain KI-072 (Pinterest
`board_id` tidak pernah dikumpulkan). King Rezi mengonfirmasi 2 keputusan
scope lewat `AskUserQuestion`:

1. Board Pinterest dipilih **per post** (di Draft Editor saja) — bukan
   per akun/Connected Accounts, bukan hybrid. Implementasi nanti **tidak
   butuh schema Prisma baru** (tidak ada kolom `board_id` tersimpan
   permanen di `ConnectedAccount`).
2. Rancangan board-picker **sudah selesai** dikerjakan di Claude Design
   (project "Social Media Management", via DesignSync). 3 file diubah:
   - `templates/draft-editor.html` — field "Board" section `.pin-fields`
     Pinterest diganti dari free-text `<input>` jadi native
     `<select class="select">` bergaya sama seperti selector "Filter Akun"
     di `components/forms.html`, dengan opsi mock: "Pilih board…"
     (kosong/unselected), "Resep & Minuman", "Interior Kedai", "Promo
     Musiman". Ditambahkan komentar block HTML menjelaskan keputusan
     KI-072 (per-post only, mock data mewakili live fetch dari
     `list_pinterest_boards`, fallback ke pola `.reconnect-link` kalau
     fetch gagal).
   - `components/forms.html` — showcase komponen "AccountRow" section
     Pinterest disamakan (select yang sama) supaya tidak divergen dari
     `draft-editor.html`.
   - `templates/app-prototype/AppPrototype.dc.html` — 2 occurrence markup
     Pinterest `.pin-fields` (state "New Post" kosong dan state "Edit
     Draft" terisi) disamakan juga ke select yang sama.

Status **KI-072 tetap Open** — yang selesai baru rancangan UI di Claude
Design. Implementasi kode (fetch board list dari Outstand
`list_pinterest_boards` saat compose + kirim `board_id` terpilih di
request publish Pinterest, domain/UI `apps/web`) belum dikerjakan dan jadi
task terpisah. Sesi ini murni dokumentasi — tidak ada perubahan kode
`apps/web`. Tidak ada ADR baru dibuat (keputusan per-post-only dinilai
belum cukup material untuk ADR tersendiri, sudah tercermin di catatan
KI-072 `PROJECT_STATE.md`/`tasks/v02-publishing-mvp.md`).

Detail: `PROJECT_STATE.md` § KI-072, `tasks/v02-publishing-mvp.md` § T-025.

---

## 2026-09-25 — KI-071 Resolved: `replyToComment` wajib `accountUsername` via ADR-117

King Rezi menutup **KI-071** (gap disambiguasi reply multi-akun network
sama). Elon Backend Engineer mengamandemen kontrak `replyToComment`:
`accountUsername: string` wajib; `RealOutstandAdapter` selalu mengirim
body `account_username`; `FakeOutstandAdapter` menerima field itu (instant
success, ADR-059). `EngagementService.reply` resolve handle lewat port
lokal `ConnectedAccountHandlePort.findConnectedAccountById` — composition
root menyuplai `workspaceRepository` (`WorkspaceConnectedAccount.handle`);
handle kosong/akun tidak ketemu → `ConflictError`. `platform_post_id`
SENGAJA tidak ditambahkan (disambiguasi sudah ditutup username, pola sama
`fetchComments` ADR-113).

Ridwan Architecture Reviewer: **0 temuan**. Najwa QA Engineer: Vitest
**6 file / 80 tes PASS**; tidak ada perubahan UI; typecheck Elon PASS.
Perubahan ini di-commit di branch `feature/ki-071-reply-disambiguation`
(PR #134).

**ADR baru:** `project-manager/decisions/ADR-117-replytocomment-account-username-disambiguation-ki071.md`
(amandemen ADR-113). Status ADR-113 → `Accepted — Amended by ADR-117
(2026-09-25)` di indeks `DECISIONS.md` + header file ADR-113.

**Task:** tidak ada task baru; T-025 tetap ✅ Done (hanya prosa
`tasks/v02-publishing-mvp.md` yang menyebut KI-071 Open diperbaiki).
Indeks `TASKS.md` tidak diubah.

**Docs:** `PROJECT_STATE.md` — KI-071 dihapus dari § Known Issues
(Resolved + tercatat di COMPLETE_TASK); Completed Ringkasan + Recent
Decisions diperbarui; metadata Version 1.0.94 → 1.0.95; Last Updated
tetap 2026-09-25. Branch implementasi: `feature/ki-071-reply-disambiguation`.

## 2026-09-25 — T-106 dicatat: hapus FakeOutstandAdapter (belum dikerjakan)

King Rezi meminta task atau Known Issue untuk menghilangkan
`FakeOutstandAdapter`. Dicatat sebagai **T-106** ⏳ Not Started di
`tasks/v02-publishing-mvp.md` (domain integration, kelanjutan T-025),
bukan KI — adapter itu sengaja ada lewat ADR-059, bukan kerusakan.
Empat subtask: ADR amendemen ADR-059, hapus fallback factory, pindahkan
tes ke double lokal, bersihkan baris dev `fake-post-…`. Kode belum
disentuh. Indeks `TASKS.md`: v0.2 24 task, total 91.

## 2026-09-25 — Hardening code-review PR #133 (T-025 tetap ✅ Done): SECURITY DEFINER privileges, Facebook session cookie, media/Story, delete/retry, engagement, CSRF

King Rezi meminta implementasi rencana perbaikan dari code-review PR #133
di branch `feature/t-025-real-outstand-adapter`. Elon Backend Engineer
menerapkan perbaikan; Ridwan Architecture Reviewer: **0 temuan**; Vitest
**130** test terkait lulus; typecheck bersih. **Tidak ada commit/push**
di sesi ini.

**Status task:** T-025 sempat di-set `🟡 In Progress` oleh Elon saat
perbaikan — **dikembalikan ke `✅ Done`** oleh Gibran Project Manager.
Perbaikan ini adalah **hardening follow-up** di atas T-025 yang sudah
selesai (2026-09-24), bukan reopen seluruh task. Catatan Update
ditambahkan di `tasks/v02-publishing-mvp.md` § T-025.

**Poin perbaikan (ringkas):**

1. **CRITICAL** — migration
   `20260925094500_restore_webhook_lookup_privileges`: `REVOKE` PUBLIC +
   `GRANT` `app_runtime` pada fungsi SECURITY DEFINER webhook lookup
   (regresi setelah `DROP`/`CREATE` migrasi KI-068).
2. Facebook session token tidak di URL — cookie httpOnly
   `outstandFacebookSession_<nonce>`; query hanya
   `connectFacebook=1&connectFacebookState` (hardening implementasi
   ADR-115/ADR-116; **tanpa ADR baru** — keputusan arsitektur material
   tidak berubah).
3. Media di-wire ke create-post lewat containers; Story omit caption;
   campuran Story + feed ber-caption throw keras.
4. `deletePost` + `accountIds` throw; `RetryFailedTargetUseCase` skip
   wipe bila sibling target masih live.
5. Upsert inbox engagement backfill `postId` pada update.
6. Tombol Facebook Reconnect disembunyikan (belum ada jalur UPDATE).
7. Presigned upload URL di-redact dari pesan error.
8. IG Reel `coverImageUrl` → `reelCoverUrl`; HTTP 429 retryable.
9. Sync comments: published only, limit 50, try/catch per-post.
10. Test CSRF list/confirm Facebook; factory trim API key.

**KI tetap Open (gap diterima, tidak diperbaiki di putaran ini):**
**KI-071** (disambiguasi reply multi-akun), **KI-072** (Pinterest
`board_id`). Tidak ada KI baru; **KI-067/KI-070 tidak di-reopen**.

**Dokumen yang diupdate:** `tasks/v02-publishing-mvp.md` § T-025 (status
kembali ✅ Done + Update 2026-09-25), `TASKS.md` (Fokus sekarang —
baris "Selesai baru-baru ini"; hitungan indeks v0.2 tidak berubah:
19 ✅ · 2 🟡 · 2 ⏳), `PROJECT_STATE.md` (Snapshot Top Next Tasks,
Metadata 1.0.93 / 2026-09-25, Completed Ringkasan — bullet baru di atas,
bullet KI-068 dihapus agar tetap 5 item).

---

## 2026-09-24 — T-025.4/KI-070 ditutup: UI Facebook Pages Picker + 2 bug kritis ditemukan & diperbaiki + QA final PASS — T-025 (Real OutstandAdapter) 7/7 subtask tuntas, KI-003 Resolved

Penutupan penuh rangkaian kerja Connect Account Facebook Pages yang dimulai
dari entri sebelumnya (desain confirmed → ADR-115 → ADR-116 → backend
selesai + reviewed). Urutan kerja sesi ini:

**1. UI dialog (Mark UI Engineer).** Mengimplementasikan
`FacebookPagesPickerDialog.tsx` (4 state: Loading/Default/Selected/Empty +
Error) di `apps/web/src/app/(app)/settings/connected-accounts/`, wire ke
`listFacebookPendingPagesAction`/`confirmFacebookPagesConnectionAction`
yang sudah ada dari ADR-116. Komponen shadcn dipakai: `Dialog`,
`Checkbox`, `Item`/`ItemGroup`/`ItemMedia`/`ItemContent`, `Empty`,
`Alert`, `Skeleton`. Row Page dibuat full-row click
(`<Item className="cursor-pointer">` + `<label>`).

**2. QA putaran 1 (Najwa QA Engineer).** Fungsional PASS (golden path via
klik + navigasi URL manual, semua state teruji), tapi menemukan 2 gap:
(a) gate struktur `DesignSync` gagal dimuat di sesi subagent-nya (kejadian
ke-8, dicatat di `.claude/agents/README.md`); (b)
`FakeOutstandAdapter.connectAccount()` belum bercabang untuk Facebook —
klik "Connect Account → Facebook" di dev/Fake mode selalu salah mendarat
di alur single-page lama.

**3. Verifikasi gate desain (main agent).** `DesignSync` tersedia
langsung di sesi utama — verifikasi independen dilakukan: row klik-penuh
Mark **cocok** dengan desain confirmed, tidak ada perbaikan kode
diperlukan.

**4. Fix gap Fake adapter + Bug #1 ditemukan (Elon Backend Engineer).**
`FakeOutstandAdapter.connectAccount()` diperbaiki supaya bercabang untuk
Facebook (loopback `?session=...`). Saat verifikasi, ditemukan **Bug #1**:
klik natural "Connect Account → Facebook" gagal **405** — browser
mengirim `POST` ke Route Handler
`apps/web/src/app/api/integrations/outstand/callback/route.ts` yang
hanya punya export `GET`, sementara navigasi URL manual (yang otomatis
`GET`) berhasil. Di-flag sebagai task terpisah, belum diperbaiki di titik
ini.

**5. Investigasi Bug #1 + ditemukan Bug #2 (main agent).** Investigasi
langsung di browser real (dev server Fake mode via env override
sementara, `.env.local` tidak disentuh) — Bug #1 direproduksi dan
dikonfirmasi, ditemukan workaround (`export const POST = GET` alias di
Route Handler) yang terbukti membuka dialog via klik natural. Tapi retest
mengungkap **Bug #2**: dialog terbuka tapi macet selamanya di Loading
(`listFacebookPendingPagesAction` tidak pernah terpanggil) — berbeda dari
sebelumnya yang sukses via URL manual. Temuan detail diserahkan ke Elon.

**6. Root cause Bug #2 + fix permanen kedua bug (Elon Backend Engineer,
putaran 2).** Root cause Bug #2: `FakeOutstandAdapter.connectAccount()`
Facebook loopback ke **domain kita sendiri** (bukan domain eksternal
seperti platform lain), sehingga redirect chain Server Action → Route
Handler kita → balik ke halaman diperlakukan Next.js App Router sebagai
satu transisi client-side yang membuat action-dispatch queue macet.
**Murni artefak Fake-mode testing — TIDAK terjadi di produksi** (Real
adapter selalu redirect ke domain eksternal `outstand.so` di hop
pertama). Fix: `initiateConnectAccountAction`/
`initiateReconnectAccountAction`
(`apps/web/src/app/(app)/settings/connected-accounts/actions.ts`) khusus
`platform === Facebook` tidak lagi `redirect()` di server — return
`{ redirectUrl }`; client (`ConnectPlatformMenu.tsx`, `ReconnectButton` di
`ConnectedAccountsList.tsx`, `FacebookPagesPickerDialog.tsx`) melakukan
`window.location.href` (hard navigation). Platform lain **tidak berubah**
sama sekali. Bug #1 (`export const POST = GET` alias di `route.ts`) juga
diterapkan permanen dengan docstring lengkap menjelaskan root cause.
Test baru: `route.test.ts` (4 test) + `actions.test.ts` (4 test). Total
naik ke **509 passed/6 skipped** (dari 501 sebelumnya).

**7. Review arsitektur final (Ridwan Architecture Reviewer).** **0
temuan** — verifikasi independen: typecheck bersih, lint bersih, 509
passed/6 skipped cocok. Rule #5 AGENTS.md tidak dilanggar (perubahan
murni "siapa memicu navigasi browser", bukan business logic baru),
RBAC/CSRF tidak ada celah baru, isolasi perubahan ke Facebook saja
terverifikasi via test.

**8. QA final (Najwa QA Engineer).** **PASS** semua: golden path Connect
Facebook via klik natural (tanpa 405, tanpa macet), **Reconnect
Facebook** (jalur baru, belum pernah dites sebelumnya — berhasil
teknis), regresi platform lain (Instagram/X Connect+Reconnect tetap
pakai `redirect()` server, tidak ikut berubah), regresi screen lain
(Home/Calendar normal). **Satu catatan non-blocking**: Reconnect Facebook
Page tunggal selalu **CREATE** bukan **UPDATE** (sudah didokumentasikan
out-of-scope di ADR-115 poin 8) — badge "Perlu Reconnect" di akun asal
tidak hilang setelah reconnect. **King Rezi memutuskan eksplisit (via
`AskUserQuestion`): cukup didokumentasikan sebagai keterbatasan, TIDAK
perlu task susulan sekarang.**

**Penutupan dokumentasi:** **T-025.4 dicentang selesai** (`tasks/v02-publishing-mvp.md`
§ T-025) — dengan itu **seluruh subtask T-025.1–T-025.7 tuntas**, task
**T-025 (Real OutstandAdapter) ditutup `✅ Done`**. **KI-070 Resolved**
dan dihapus dari `PROJECT_STATE.md` § Known Issues (guardrail ADR
governance — Resolved + sudah tercatat di sini). **KI-067** (parent
split KI-070) juga ditutup Resolved sepenuhnya dan dihapus dari Known
Issues (sisa scope-nya, Facebook Pages, sekarang tuntas). **KI-003**
(parent tertinggi, "Runtime ADR-040 belum diimplementasikan") juga
ditutup Resolved dan dihapus dari Known Issues — seluruh sub-scope-nya
(KI-067/068/069/070) sudah Resolved. Baris KI-003 di `PROJECT_STATE.md`
§ Blockers juga dihapus (tidak lagi menghambat task manapun). Sisa gap
non-blocking dari rangkaian T-025 tetap terbuka terpisah: **KI-071**
(disambiguasi reply multi-akun) dan **KI-072** (Pinterest `board_id`) —
keduanya Open, tidak memblokir closure T-025.

`TASKS.md`: baris indeks v0.2 diperbarui (19 ✅ · 2 🟡 · 2 ⏳, dari 18 ✅ ·
3 🟡 · 2 ⏳ hasil hitung ulang langsung dari `tasks/v02-publishing-mvp.md`
— catatan: split 🟡/⏳ sebelumnya di baris ini sempat salah, dikoreksi
bersamaan), **Total 57 selesai** (dari 54, hasil hitung ulang seluruh
release — v01=16 terverifikasi cocok, v02=19, v03=8, v04=5, v07=9), dan
**Fokus sekarang** dipindah dari T-025 ke **T-037** (satu-satunya
🟡 In Progress lain yang eksplisit dilacak di sana, kontinu by design,
prioritas rendah).

Tidak ada ADR baru untuk 2 bug fix di atas — keduanya workaround
infrastruktur/framework Fake-mode testing (bukan keputusan arsitektur
produk baru), dikonfirmasi Elon Backend Engineer dan Ridwan Architecture
Reviewer.

---

## 2026-09-24 — ADR-116: koreksi wire-format Facebook Pages session-token (KI-070), backend selesai + lolos review Ridwan 0 temuan

Lanjutan entri sebelumnya (ADR-115, hari yang sama) — Elon Backend Engineer
mengimplementasikan kontrak ADR-115.

**Verifikasi wire-format (langkah wajib sebelum implementasi, ADR-115 §
"Belum Terverifikasi"):** berbeda dari sesi penyusun ADR-115 yang gagal
mengakses dokumentasi resmi Outstand, sesi Elon berhasil mengakses lewat
WebFetch: `https://www.outstand.so/docs/configurations/facebook`,
`https://www.outstand.so/docs/get-pending-connection-details`,
`https://www.outstand.so/docs/finalize-pending-connection` (OpenAPI JSON
`api.outstand.so/openapi.json` tetap 404, tapi docs page HTML resmi bisa
diakses). Ditemukan **4 dari 4 asumsi wire-format ADR-115 salah**:

1. Query param callback: **`session`**, bukan `session_token` yang
   diasumsikan ADR-115.
2. Path finalize: **`POST /v1/social-accounts/pending/{sessionToken}/finalize`**
   (ada suffix `/finalize`), bukan `POST` langsung ke path GET seperti
   asumsi ADR-115.
3. Response GET dibungkus **`data.availablePages[]`**, field
   `id`/`profilePictureUrl` — bukan flat `pages[]` dengan
   `pageId`/`pictureUrl` seperti asumsi ADR-115.
4. Response POST **`connectedAccounts[]`** dengan field
   `id`/`username`/`nickname` — bukan `accounts[]` seperti asumsi ADR-115.

Yang ternyata **sudah benar** di ADR-115: body request finalize
`{selectedPageIds: [...]}`, path GET
`/v1/social-accounts/pending/{sessionToken}`. TTL session dikonfirmasi
**30 menit** (temuan baru, mengisi poin 4 "Belum Terverifikasi" ADR-115
yang sebelumnya kosong).

**ADR-116 ditulis** (`project-manager/decisions/ADR-116-facebook-pages-wire-format-koreksi-adr-115.md`,
status **Accepted**) sebagai amandemen terpisah — bukan menambal kode
diam-diam, mengikuti pola persis ADR-105→ADR-112 (rule #4 AGENTS.md).
Kontrak `packages/shared/src/contracts/outstand-adapter.ts` (nama
interface/method `FacebookPendingPage` dkk.) **TIDAK berubah** — koreksi
murni di mapping wire↔domain di dalam real adapter (ACL boundary tetap
terjaga).

**File yang diubah Elon:**
`packages/shared/src/contracts/outstand-adapter.ts` (kontrak, tidak
berubah dari ADR-115 tapi diverifikasi ulang),
`apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts` (implementasi
sesuai ADR-116 — baca `session`, path `/finalize`, mapping
`data.availablePages[]`/`connectedAccounts[]`),
`apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts` (mock 3
fixture Page, deterministik, ADR-059),
`apps/web/src/domains/workspace/services/workspace.service.ts` (2 method
baru: `listFacebookPendingPages`/`confirmFacebookPagesConnection`, RBAC
Owner/Admin reuse, skip-bukan-gagal per Page yang sudah terhubung
sebelumnya — idempotent-guard pola ADR-109, JOB-03 engagement sync
seeding per Page baru),
`apps/web/src/app/api/integrations/outstand/callback/route.ts`
(percabangan baca query param `session`),
`apps/web/src/app/(app)/settings/connected-accounts/actions.ts` (2 Server
Action baru), plus test baru di `real-outstand-adapter.test.ts`/
`workspace.service.test.ts` dan stub minimal di 10 file test lain (supaya
tetap match `IOutstandAdapter` yang bertambah 2 method).

**Verifikasi:** Vitest 498 passed, 6 skipped (tidak ada regresi dari 487
sebelumnya). `bun run typecheck`/`lint` bersih.

**Ridwan Architecture Reviewer review — 0 temuan pelanggaran arsitektur.**
Verifikasi independen: typecheck bersih, lint bersih, 498 test
passed/6 skipped cocok dengan klaim Elon. Satu catatan non-blocking
(bukan pelanggaran): dokumentasi Outstand menyarankan strip param
`session` dari address bar browser setelah dibaca — didelegasikan ke Mark
UI Engineer saat implementasi dialog (bersihkan query param via
`router.replace` saat dialog mount), sudah didesain sadar di ADR-115
§7/ADR-116 §5, bukan gap.

**Status akhir T-025.4/KI-070:** backend Facebook Pages session-token
**tuntas dan lolos review** — kontrak, real+fake adapter, `WorkspaceService`,
Route Handler, Server Action semuanya sudah jalan. **Belum selesai secara
keseluruhan** — UI dialog Facebook Pages Picker (React, Mark UI Engineer)
yang memanggil 2 Server Action itu belum dikerjakan. T-025.4 tetap `[ ]`
di `tasks/v02-publishing-mvp.md`, KI-070 tetap **Open** di
`PROJECT_STATE.md`.

Dokumentasi diperbarui: `DECISIONS.md` (baris ADR-116 baru, catatan
amandemen di baris ADR-115 existing — status tetap Proposed, ditambah tag
"Amended by ADR-116"), ADR-115 file (§ Status ditambah tag amandemen),
`PROJECT_STATE.md` § KI-070 (progres backend selesai + reviewed, Completed
Ringkasan + Recent Decisions Ringkasan diputar), `tasks/v02-publishing-mvp.md`
§ T-025 (T-025.4 catatan + Terkait, blok update naratif baru, bullet KI-070
gap arsitektur diperbarui).

---

## 2026-09-24 — ADR-115: kontrak Connect Account Facebook Pages (session-token) diajukan, menutup gap KI-070

Setelah desain page-selection Facebook Pages CONFIRMED King Rezi di Claude
Design (entri sebelumnya, hari yang sama), sesi ini menyusun **ADR-115**
untuk mengisi gap kontrak backend yang tersisa di KI-070.

**Riset dulu (read-only, Explore agent + verifikasi manual):** dibaca
penuh `real-outstand-adapter.ts` (`resolveConnectCallback` Facebook throw,
baris 478-485), `outstand-adapter.ts` (kontrak `IOutstandAdapter` shared),
`fake-outstand-adapter.ts` (pola ADR-059), `workspace.service.ts`
(`initiateConnectAccount`/`completeAccountConnection` — RBAC/IDOR
pattern), `route.ts` callback handler, Prisma model
`WorkspaceConnectedAccount`, dan ADR-112/ADR-105 penuh untuk pola
penulisan. Percobaan verifikasi wire-format lewat OpenAPI spec resmi
Outstand (`api.outstand.so`) via browser **gagal/ditolak** — MCP
`mcp__outstand__*` yang terpasang juga tidak mengekspos tool operasional
untuk flow session-token Facebook (dicek `list_social_accounts`,
`get_social_account`, `create_social_network`, `get_more_tools`).

**Isi ADR-115** (`project-manager/decisions/ADR-115-facebook-pages-session-token-connect-ki070.md`):
- Kontrak baru `listPendingFacebookPages`/`confirmFacebookPagesConnection`
  ditambahkan ke `IOutstandAdapter` — method BARU, `resolveConnectCallback`
  TIDAK diubah (Facebook tetap throw eksplisit di situ, method itu murni
  untuk single-page).
- `connectAccount` (langkah 1, redirect OAuth) tidak berubah sama sekali —
  sama untuk semua platform.
- Route Handler callback existing (`/api/integrations/outstand/callback`)
  diperluas dengan percabangan baca `session_token` — BUKAN route baru.
  Nonce cookie CSRF tetap dicek tapi TIDAK dihapus di titik ini (flow
  belum selesai) — redirect ke Connected Accounts dengan query param yang
  memicu dialog Facebook Pages Picker terbuka otomatis.
- `WorkspaceService` dapat 2 method baru (`listFacebookPendingPages`,
  `confirmFacebookPagesConnection`) — RBAC Owner/Admin reuse gate existing;
  hasil batch di-loop untuk `createConnectedAccount` per Page, SKIP
  (bukan gagal total) kalau satu Page sudah pernah terhubung sebelumnya
  (idempotent-guard, pola ADR-109) — bukan `$transaction` penuh (YAGNI).
  Reconnect untuk satu Facebook Page yang sudah ada sengaja DI LUAR SCOPE.
- Fake adapter: mock deterministik reuse 3 fixture Page yang sama persis
  dengan draft desain King Rezi ("Kopi Selasar", "Kopi Selasar — Cabang
  Selatan", "Roti Selasar"), pola ADR-059 (instant, no delay/failure sim).

**Status ADR-115 sengaja "Proposed", bukan "Accepted"** — beda dari ADR
lain yang biasanya langsung Accepted setelah diimplementasikan. Wire-format
persis (nama query param `session_token`, bentuk body/response endpoint
`GET/POST /v1/social-accounts/pending/{sessionToken}`) BELUM terverifikasi
terhadap OpenAPI spec resmi Outstand — ADR mencatat eksplisit 4 poin di
§ "Belum Terverifikasi" yang wajib dicek Elon Backend Engineer
sebelum/-saat implementasi (pola sama persis ADR-105 yang ditulis
best-effort lalu dikoreksi ADR-112 setelah verifikasi nyata). Kalau
bentuknya beda, wajib ADR amandemen baru — bukan tambal kode diam-diam
(rule #4 AGENTS.md).

Dokumentasi diperbarui: `DECISIONS.md` (baris ADR-115 baru),
`PROJECT_STATE.md` § KI-070 (progres ADR-115 + "Masih menunggu" diupdate),
`tasks/v02-publishing-mvp.md` § T-025 (T-025.4, ditambah referensi
ADR-115). Belum ada perubahan kode — ADR ini murni dokumen keputusan,
implementasi menunggu Elon Backend Engineer setelah verifikasi wire-format.

---

## 2026-09-24 — KI-070 progres: desain draft UI page-selection Facebook Pages dibuat di Claude Design (masih Open)

King Rezi minta lanjut KI-070 (blocker terakhir T-025.4/T-025 Real
OutstandAdapter — flow multi-halaman Facebook Pages, session-token). Sesuai
rule #17 AGENTS.md (gate desain sebelum kode UI), main agent (Jokowi) cek
Claude Design project "Social Media Management" — belum ada rancangan
page-selection Facebook Pages, implementasi kode di-stop dulu.

King Rezi minta panggil Neymar Product Designer untuk drafting. `DesignSync`
gagal dimuat lagi di sesi Neymar (kejadian ketujuh, pola sama seperti
kejadian sebelumnya di `.claude/agents/README.md` § "Keterbatasan teknis
`DesignSync` di sesi subagent"). Mengikuti jalur fallback yang sudah
didokumentasikan di situ, main agent minta izin eksplisit King Rezi untuk
mengerjakan drafting langsung di sesi utama — disetujui.

Sebelum drafting, 4 keputusan desain ditanyakan via `AskUserQuestion`, semua
dijawab King Rezi: (1) minimum selection wajib pilih ≥1 Facebook Page,
tombol lanjut disabled kalau 0 dipilih; (2) label tombol dinamis "Hubungkan
N Page Terpilih" mengikuti jumlah dipilih; (3) empty state (akun tanpa
Page) menawarkan retry/re-auth Facebook, bukan cuma dismiss; (4) pola
dialog pakai ukuran Dialog/Sheet lebih besar (bukan Tier 2 AlertDialog
kecil) karena isinya checklist Page, bukan teks konfirmasi pendek.

Drafting selesai di Claude Design (projectId
`84aded99-bb23-49b1-be9f-dd8f21c6873e`), sudah di-push ke remote dan
dibaca ulang untuk verifikasi:

- **`styles.css`** — pola dialog baru `.dialog-md-backdrop`/`.dialog-md`
  (560px, di antara `.dialog` 400px dan `.dialog-lg` 960px Draft Editor,
  reuse `.dialog-fs-header/-title/-actions/-body/-footer`), plus
  `.fbpage-list`/`.fbpage-row`(`.is-checked`)/`.fbpage-avatar`/`.fbpage-body`/
  `.fbpage-name`/`.fbpage-meta` (checkbox row, reuse visual language
  `.acc-row` Draft Editor Account Selector) dan skeleton loading
  `.fbpage-skel-row`/`.fbpage-skel-avatar`/`.fbpage-skel-lines`/`.fbpage-skel-line`
  (mirror `.notif-skel-*`).
- **`templates/settings-connect-facebook-pages.html`** (baru,
  `@dsCard group="Screens"`) — 4 state: Loading (skeleton), Default (0 Page
  dipilih, tombol disabled), 2 Page dipilih (tombol "Hubungkan 2 Page
  Terpilih" aktif), Empty state (tidak ada Page + tombol "Login Ulang dengan
  Facebook"). Ditandai eksplisit **DESIGN DRAFT — belum ada implementasi
  kode nyata yang mengacu ke sini**.
- **`readme.md`** — 1 baris tabel Components (setelah `.dialog-lg`) dan 1
  bullet daftar templates (setelah `settings-connected-accounts.html`),
  menandai status **DESIGN DRAFT (KI-070, Open)**.

**Status KI-070 tetap Open** — ini progres desain, bukan penyelesaian.
Masih menunggu: (a) review/konfirmasi visual King Rezi atas draft; (b) ADR
baru untuk kontrak Facebook (`resolveConnectCallback` untuk
`platform === Facebook` masih throw eksplisit — belum ada implementasi
backend); (c) implementasi kode UI oleh Mark UI Engineer setelah draft
dikonfirmasi. Detail lengkap: `PROJECT_STATE.md` § KI-070,
`tasks/v02-publishing-mvp.md` § T-025 (T-025.4).

---

## 2026-09-24 — KI-069 Resolved: override format platform-specific (Story/Reel) via ADR-114, gap Pinterest `board_id` dicatat KI-072 baru

KI-069 (override format per-platform Story/Reel/Pin tidak terkirim ke
Outstand, ditemukan Elon Backend Engineer 2026-09-23 saat implementasi
T-025) diselesaikan Elon Backend Engineer, lolos review arsitektur Ridwan
Architecture Reviewer 0 temuan.

**Root cause:** `OutstandPostTargetInput` tidak membawa `platform`/network
per target, padahal body resmi Outstand `POST /v1/posts` butuh override
format (Story/Reel/Pin) dikirim sebagai key top-level bernama network
(`instagram`/`facebook`/`pinterest`/dst) — override platform-specific yang
sudah didesain ADR-039/ADR-107 tidak pernah terkirim (post Instagram/
Facebook yang user pilih format Story/Reel di composer tetap tayang
sebagai "post biasa" di Outstand).

**Keputusan King Rezi (dikonfirmasi via `AskUserQuestion` sebelum
implementasi):** (1) kerjakan penuh field `platform` wajib di kontrak +
mapping `contentFormat` ke shape asli Outstand per network untuk field yang
datanya sudah ada di domain kita; (2) Pinterest `board_id` (wajib di API
Outstand) sengaja TIDAK diimplementasikan — domain/UI kita tidak pernah
mengumpulkannya, key `pinterest` tetap tidak dikirim (aman, tidak
menambah risiko baru), dicatat KI baru terpisah **KI-072** oleh Gibran
Project Manager, tidak memblokir penutupan KI-069.

**Implementasi (fixed via ADR-114):** `OutstandPostTargetInput`
(`packages/shared/src/contracts/outstand-adapter.ts`) ditambah field wajib
`platform: SocialPlatform`. Caller (`schedule-posts.use-case.ts`,
`publish-now.use-case.ts`, `retry-failed-target.use-case.ts`) meneruskan
`platform` yang sudah tersedia di scope. `RealOutstandAdapter` menambah
fungsi baru `computePlatformOverride(platform, contentFormat)` — Instagram
Story → `publishAsStory` (Instagram tidak punya flag Reel eksplisit,
auto-detect dari video), Facebook Story/Reel → `publishAsStory`/
`publishAsReel`, Pinterest selalu `null`. Edge case konflik same-network
`contentFormat` berbeda (mis. 2 akun Facebook, satu Story satu Reel):
first-match-wins + `console.warn` eksplisit, tidak silent. Shape asli
diverifikasi lewat MCP resmi `create_post` + OpenAPI spec resmi Outstand.

**Verifikasi:** `bun run typecheck`/`lint` bersih, Vitest 487 pass/6 skip/0
fail (full suite). `real-outstand-adapter.test.ts` ditambah cakupan penuh
(Instagram Story/Reel, Facebook Story/Reel, Post biasa, Pinterest tetap
kosong, konflik same-network).

**Dokumentasi:** ADR baru `decisions/ADR-114-outstand-post-target-platform-override-ki069.md`
(sudah diverifikasi akurat oleh Ridwan, cocok diff kode aktual), diregister
di `DECISIONS.md`. `PROJECT_STATE.md` § Known Issues: KI-069 diubah jadi
Resolved, KI-072 baru ditambahkan (Open, Domain integration — butuh
keputusan desain UI board-picker sebelum implementasi, kena gate rule #17
AGENTS.md). `tasks/v02-publishing-mvp.md` § T-025 diupdate (field Terkait +
catatan naratif). Efek fungsional: publish Story/Reel Instagram/Facebook
sekarang benar-benar tayang sesuai pilihan format user di composer.

File yang berubah: `packages/shared/src/contracts/outstand-adapter.ts`,
`apps/web/src/domains/publishing/services/schedule-posts.use-case.ts`,
`apps/web/src/domains/publishing/services/publish-now.use-case.ts`,
`apps/web/src/domains/publishing/services/retry-failed-target.use-case.ts`,
`apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts` (+ test),
`project-manager/decisions/ADR-114-outstand-post-target-platform-override-ki069.md`
(baru), `project-manager/DECISIONS.md`, `project-manager/PROJECT_STATE.md`,
`project-manager/TASKS.md`, `project-manager/tasks/v02-publishing-mvp.md`.

---

## 2026-09-24 — KI-068 Resolved: redesain `fetchComments`/`replyToComment` per-post via ADR-113, gap disambiguasi multi-akun dicatat KI-071 baru

KI-068 (`fetchComments`/`replyToComment` scope tidak cocok API resmi
Outstand, ditemukan Elon Backend Engineer 2026-09-23 saat implementasi
T-025) diselesaikan Elon Backend Engineer, lolos review arsitektur Ridwan
Architecture Reviewer (0 temuan).

**Root cause:** sama seperti KI-067/ADR-112 — kontrak `IOutstandAdapter`
(ADR-110) disusun best-effort tanpa akses dokumentasi resmi Outstand.
OpenAPI spec resmi (`GET/POST /v1/posts/{postId}/replies`) men-scope
comments/replies PER-POST, tanpa cursor pagination sama sekali — bukan
per-akun dengan cursor seperti diasumsikan ADR-110.

**3 keputusan arsitektur dikonfirmasi King Rezi sebelum implementasi (via
`AskUserQuestion`):**
1. Sumber daftar post untuk sync JOB-03: dari DB kita sendiri
   (`PublishingPost`/`PublishingPostTarget`), bukan endpoint list-posts
   Outstand.
2. `fetchComments` baru: per-post, tanpa cursor — field `nextCursor`
   dihapus total dari `FetchCommentsResult` (bukan disisakan selalu-null).
3. `replyToComment` baru: tambah `outstandPostId` (wajib) +
   `parentOutstandCommentId` (opsional, untuk threading).

**Perubahan kontrak** (`packages/shared/src/contracts/outstand-adapter.ts`):
- `fetchComments`/`replyToComment` diredesain per-post sesuai 3 keputusan
  di atas.
- `FetchCommentsResult.nextCursor` dihapus total.
- `InboxCommentData.outstandPostId` jadi wajib (dulu `string | null`).
- `InboxCommentData.outstandAccountId` dihapus (keputusan tambahan King
  Rezi, dikonfirmasi setelah implementasi — field ini secara struktural
  tidak bisa diisi bermakna oleh real adapter).

**Implementasi:**
- `apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts` — throw gap
  sebelumnya diganti implementasi HTTP asli, diverifikasi terhadap OpenAPI
  spec resmi Outstand.
- `apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts` — disesuaikan
  pola baru, tetap instant/deterministic (ADR-059).
- `apps/web/src/domains/engagement/services/sync-comments.use-case.ts`
  (JOB-03/T-051) — redesain loop per-post, akses data `publishing` lewat
  port lokal cross-domain baru `PublishingPostsPort` (structural typing,
  disuplai composition root `apps/web/src/app/(app)/engage/actions.ts` dan
  `apps/web/src/app/api/jobs/run/route.ts`) — bukan import file internal
  domain lain, dikonfirmasi bersih oleh Ridwan.
- `apps/web/src/domains/engagement/services/engagement.service.ts`
  (`EngagementService.reply`, T-054) — resolve `outstandPostId` dari
  `postId` internal, guard `ConflictError` untuk data lama yang belum
  terhubung.
- `apps/web/src/domains/engagement/repositories/engagement.repository.ts`,
  `apps/web/src/domains/publishing/repositories/publishing.repository.ts`,
  `apps/web/src/domains/workspace/repositories/workspace.repository.ts`,
  `apps/web/src/lib/repositories/engagement/engagement.repository.ts`,
  `apps/web/src/lib/repositories/publishing/publishing.repository.ts`,
  `apps/web/src/lib/repositories/workspace/workspace.repository.ts` —
  disesuaikan mengikuti kontrak baru.
- Migration baru
  `apps/web/prisma/migrations/20260924090000_ki068_add_handle_to_account_owner_lookup`
  — extend fungsi SQL `SECURITY DEFINER`
  `webhook_find_account_owner_by_outstand_account_id` untuk return kolom
  `handle` juga. **Belum di-deploy** ke database manapun (butuh
  `bun run db:deploy` manual King Rezi — pola sama migration T-051
  sebelumnya).
- Test terkait diupdate: `apps/web/src/app/(app)/engage/actions.test.ts`,
  `apps/web/src/domains/engagement/services/engagement-sync-job-handler.test.ts`,
  `apps/web/src/domains/engagement/services/engagement.service.test.ts`,
  `apps/web/src/domains/engagement/services/refresh-inbox.use-case.test.ts`,
  `apps/web/src/domains/engagement/services/sync-comments.use-case.test.ts`,
  `apps/web/src/domains/publishing/services/*.test.ts` (7 file, rename
  stub mock mengikuti kontrak baru),
  `apps/web/src/lib/adapters/outstand/real-outstand-adapter.test.ts`.

**ADR baru:** `project-manager/decisions/ADR-113-redesain-fetchcomments-replytocomment-per-post-ki068.md`
(amandemen ADR-110) — ditulis Elon Backend Engineer, diverifikasi akurat
1:1 dengan diff kode oleh Ridwan.

**Verifikasi:** `bun run typecheck` bersih, `bun run lint` bersih, Vitest
480 pass/6 skip/0 fail.

**Gap baru ditemukan (bukan bug, keputusan scope eksplisit King Rezi,
dicatat KI baru — bukan diperbaiki sekarang):** endpoint resmi Outstand
`POST /v1/posts/{id}/replies` menerima `account_username`/
`platform_post_id` opsional untuk disambiguasi kalau satu post publish ke
>1 akun di network yang sama — signature `replyToComment` yang dikonfirmasi
King Rezi tidak membawa field itu. Reply ke post yang publish ke lebih dari
satu akun pada network yang sama berisiko gagal 400 di sisi Outstand. King
Rezi memutuskan (via `AskUserQuestion`): catat sebagai **KI-071** (baru,
Open), tidak memblokir penutupan KI-068.

**Dokumentasi diupdate dalam sesi ini (Gibran Project Manager):**
`PROJECT_STATE.md` (KI-068 → Resolved, KI-071 baru, Top Next Tasks,
Blockers, Completed Ringkasan, Recent Decisions), `DECISIONS.md` (entri
ADR-113 + status ADR-110 diamandemen), `decisions/ADR-110-*.md` (header
Status diamandemen), `TASKS.md` (Fokus sekarang, rantai blocker),
`tasks/v02-publishing-mvp.md` (T-025.6 ✅, catatan KI-068 Resolved + KI-071),
`tasks/v04-engagement-mvp.md` (T-051/T-054 referensi balik KI-068).

---

## 2026-09-23 — KI-067 sebagian resolved: Connect Callback single-page via ADR-112, sisa scope di-split jadi KI-070

King Rezi mempersempit scope KI-067 (gap `exchangeConnectCode`/flow OAuth
Outstand, ditemukan sesi T-025 hari yang sama): hanya flow **single-page
account** (Instagram, X, LinkedIn, Threads, TikTok, YouTube, Pinterest,
dll — bukan Facebook Pages multi-halaman) yang dikerjakan sekarang.

Elon Backend Engineer membuat **ADR-112** (amandemen ADR-105): kontrak
`IOutstandAdapter.exchangeConnectCode({code, state})` diganti
`resolveConnectCallback(ConnectCallbackInput)` dengan input `{ state,
outstandAccountId, username, networkUniqueId? }`, karena Outstand real
ternyata redirect balik langsung dengan query param akun (`account_id`/
`username`/`network_unique_id`) — bukan `code` untuk di-exchange lewat
call server-side terpisah.

**File yang diubah:**
- `packages/shared/src/contracts/outstand-adapter.ts` — kontrak baru.
- `apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts` + test —
  loopback tanpa `code`, `resolveConnectCallback` instant always-success.
- `apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts` + test —
  `resolveConnectCallback` murni validasi + decode `state` (tanpa HTTP
  call ke Outstand); throw eksplisit `OutstandIntegrationError` untuk
  `platform === Facebook` (mengarah ke KI-070).
- `apps/web/src/lib/adapters/outstand/connect-state.ts`.
- `apps/web/src/app/api/integrations/outstand/callback/route.ts` — baca
  `account_id`/`username`/`network_unique_id`/`state`, bukan `code`.
- `apps/web/src/domains/workspace/services/workspace.service.ts` + test,
  `apps/web/src/domains/workspace/repositories/workspace.repository.ts`,
  `apps/web/src/lib/env.ts`.
- 8 file test domain lain (rename stub mock `exchangeConnectCode` →
  `resolveConnectCallback`): `analytics-ingestion.use-case.test.ts`,
  `engagement.service.test.ts`, `refresh-inbox.use-case.test.ts`,
  `sync-comments.use-case.test.ts`, `cancel-schedule.use-case.test.ts`,
  `outstand-webhook-processor.test.ts`, `publish-now.use-case.test.ts`,
  `resolve-scheduled-post-outcome-job-handler.test.ts`,
  `retry-failed-target.use-case.test.ts`,
  `schedule-posts.use-case.test.ts`.

Typecheck bersih, 474 test passed/6 skipped (full suite). Ridwan
Architecture Reviewer re-verifikasi 129 test terkait langsung, semua
PASS — **0 temuan arsitektur**. T-013/T-015 (Connect/Reconnect Account,
sudah ✅ Done via Fake) **tidak perlu rework** (ADR-112 §6 — perubahan
murni di boundary parameter, alur bisnis/RBAC/IDOR tidak berubah).

**Status KI-067:** diubah dari `Open` jadi `Sebagian Resolved — sisa
scope: KI-070` di `PROJECT_STATE.md` (bukan dihapus — scope multi-halaman
Facebook Pages belum selesai).

**KI-070 baru** (Open): flow multi-halaman Facebook Pages (session-token,
`GET/POST /v1/social-accounts/pending/{sessionToken}`) + UI page-selection
baru yang belum ada di codebase — sisa scope KI-067 yang di-split karena
butuh kerja UI terpisah.

Dokumentasi diperbarui: `PROJECT_STATE.md` (KI-067/KI-070, Completed
Ringkasan, Recent Decisions, Blockers, Snapshot Top Next Tasks),
`DECISIONS.md` (index ADR-112 + tag Amended di ADR-105),
`decisions/ADR-105-fake-connect-account-oauth-redirect-loopback.md`
(header Status), `TASKS.md` (Fokus sekarang), `tasks/v02-publishing-mvp.md`
§ T-025 (T-025.4 tetap belum dicentang penuh — sisa Facebook Pages masih
blocking).

---

## 2026-09-23 — T-025 Real OutstandAdapter: publish/media/analytics tuntas terverifikasi API resmi, 3 gap kontrak baru (KI-067/068/069)

King Rezi setup MCP server resmi Outstand (`mcp.outstand.so`) di sesi ini,
menemukan dokumentasi REST API publik resmi Outstand
(`https://api.outstand.so/v1/*/openapi.json`) yang sebelumnya tidak
diketahui tim. T-025 (Real OutstandAdapter) dikerjakan Elon Backend
Engineer dalam 2 putaran:

**Putaran 1:** implementasi awal 7 subtask (T-025.1–T-025.7) berdasarkan
tebakan best-effort, karena belum ada dokumentasi resmi Outstand saat itu.

**Putaran 2:** setelah dokumentasi resmi ditemukan lewat MCP, Elon
mengoreksi seluruh implementasi mengikuti spec asli. Ridwan Architecture
Reviewer audit independen: 0 temuan pelanggaran arsitektur, `bun run
typecheck`/`lint`/`test` semua hijau (486 pass, 6 skip, 0 fail), ACL
boundary terjaga (`packages/shared` tidak disentuh, real adapter cuma
diakses lewat factory `getOutstandAdapter()`).

**Selesai dan terverifikasi terhadap API resmi:**
- T-025.1 HTTP client + auth (`Authorization: Bearer <OUTSTAND_API_KEY>`)
  + error mapping (`OutstandIntegrationError`), file baru
  `apps/web/src/lib/adapters/outstand/outstand-http-client.ts` +
  `outstand-integration-error.ts`.
- T-025.2 `schedulePost` real — `POST /v1/posts`.
- T-025.3 `publishNow` real — endpoint sama, tanpa `scheduledAt`.
- T-025.5 Media API — `POST /v1/media/upload` → PUT bytes → `POST
  /v1/media/{id}/confirm` (2-langkah upload jadi 3-langkah sesuai API
  resmi).
- T-025.7 Unit test HTTP mock — 2 file test baru (
  `outstand-http-client.test.ts`, `real-outstand-adapter.test.ts`), 82
  test menguji shape wire asli.
- Analytics (`fetchPostMetrics`/`fetchWorkspaceMetrics`, kontrak lama
  T-041) dikoreksi ke `GET /v1/posts/{id}/analytics` dan `GET
  /v1/social-accounts/{id}/metrics`.
- Cancel post (`DELETE /v1/posts/{id}`) dan delete-from-remote (`DELETE
  /v1/posts/{id}/remote`).

**Belum selesai — 3 gap arsitektur baru, sengaja throw eksplisit
(`OutstandIntegrationError`), bukan silent bug, dicatat sebagai Known
Issue baru menunggu keputusan King Rezi:**

- **KI-067** (T-025.4) — `exchangeConnectCode` (kontrak ADR-105) tidak
  cocok dengan flow OAuth Outstand asli: redirect balik membawa
  `account_id`/`network_unique_id`/`username` langsung (bukan `code`).
  Platform multi-halaman (Facebook Pages dkk) punya flow session-token
  terpisah yang butuh UI page-selection baru. Berpotensi rework
  T-013/T-015.
- **KI-068** (T-025.6) — Outstand men-scope komentar per-post
  (`GET/POST /v1/posts/{postId}/replies`, tanpa cursor pagination),
  kontrak `IOutstandAdapter.fetchComments`/`replyToComment` men-scope
  per-akun dengan cursor. Butuh redesain alur JOB-03 (T-051).
- **KI-069** — override format per-platform (Story/Reel/Pin, ADR-039/
  ADR-107) butuh dikirim sebagai key top-level bernama network di body
  `POST /v1/posts`, tapi `OutstandPostTargetInput` tidak membawa
  `platform`/network per target. Untuk sekarang override tidak dikirim
  ke Outstand.

Root cause ketiganya sama: kontrak `IOutstandAdapter` lama disusun tanpa
akses dokumentasi resmi Outstand. Detail teknis lengkap ada di docstring
`apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts`.

Dokumen yang diupdate: `tasks/v02-publishing-mvp.md` § T-025 (checklist
T-025.1/2/3/5/7 selesai, catatan gap ditambahkan), `PROJECT_STATE.md`
(KI-003 di-update PARTIALLY resolved, 3 KI baru KI-067/068/069, Blockers,
Completed Ringkasan, Top Next Tasks), `TASKS.md` (Fokus sekarang).

**Catatan governance:** belum ada ADR baru dibuat untuk resolusi
ketiga gap ini — King Rezi belum memutuskan arah resolusinya (amandemen
ADR-105/ADR-021 untuk KI-067, redesain kontrak untuk KI-068/KI-069). Ini
kandidat ADR yang perlu dikonfirmasi King Rezi terlebih dulu sebelum
ditulis. Kandidat lain yang juga belum diputuskan: apakah keputusan setup
MCP Outstand resmi sebagai sumber verifikasi arsitektur layak dicatat ADR
tersendiri.

---

## 2026-09-23 — Efisiensi subagent: pangkas duplikasi changelog di PROJECT_STATE.md/TASKS.md

King Rezi melaporkan sering kena 5-hours limit Claude, 85% pemakaian dari
subagent, dan tip langsung dari Claude Code: "consider a cheaper model for
simple subagents, or tighten their prompts." Audit menemukan sumber
pemborosan utama BUKAN di prompt subagent (`.claude/agents/*.md`, total
513 baris/7 file — sudah padat & load-bearing, berisi aturan governance
yang mencegah pengulangan insiden KI-054/055) tapi di 2 dokumen yang WAJIB
dibaca tiap subagent/tiap awal sesi task: `PROJECT_STATE.md` dan
`TASKS.md` — keduanya membengkak karena narasi changelog historis
(rangkaian putaran review, verifikasi, angka test) ditumpuk terus-menerus
di tempat yang seharusnya cuma pointer singkat, padahal riwayat lengkapnya
sudah ada di `COMPLETE_TASK.md`/`tasks/vXX-*.md`.

**Perubahan:**

1. **`PROJECT_STATE.md`** (104.156 → 47.865 karakter, **-54%**):
   - Snapshot § "Top Next Tasks": paragraf riwayat ~14.000 karakter
     (menumpuk sejak berbagai task lama) dipangkas jadi ringkasan 1
     paragraf pendek (fokus terkini + pointer ke Completed Ringkasan).
   - Known Issues: 6 entri berstatus `Resolved` yang sudah tercatat penuh
     di `COMPLETE_TASK.md` (KI-048, KI-051, KI-054, KI-055, KI-056,
     KI-059) dihapus dari daftar — menegakkan aturan yang sudah tertulis
     di header section ini sendiri tapi belum pernah ditegakkan.
   - "Completed (Ringkasan)": 5 entri terakhir diringkas dari paragraf
     panjang (rangkaian putaran review/QA) jadi 1-2 kalimat per entri.
2. **`TASKS.md`** (118.574 → 14.233 karakter, **-88%**): blok changelog
   `> **Update (...)**` yang menumpuk di bawah tabel "Indeks release"
   (~1040 baris, seluruhnya duplikat isi `COMPLETE_TASK.md`) diganti 1
   baris pointer. Tabel "Fokus sekarang" (23 baris, 22 di antaranya sudah
   `✅ Done`) dipangkas jadi hanya baris yang benar-benar belum selesai
   (`T-025`), sisanya jadi 1 baris "Selesai baru-baru ini" (daftar ID +
   tanggal saja). Blockquote riwayat T-033/T-032/T-029/T-012/T-039/T-089/
   T-093/T-014 (semuanya task lama yang sudah Done, di luar tabel Fokus
   Sekarang) dihapus. Footnote ID-borrow (¹) dan catatan sekuensial
   v0.1/v0.2 dipertahankan karena masih dirujuk aktif oleh tabel di
   atasnya.
3. **`.claude/agents/gibran-project-manager.md`**: King Rezi eksplisit
   menjawab "Ya, turunkan sekarang" saat ditanya (via `AskUserQuestion`)
   apakah boleh menurunkan model salah satu subagent, dengan Gibran
   dicontohkan sebagai kandidat — sempat ditambah `model: haiku` di
   frontmatter. **Direvert di code review PR #132** (bukan King Rezi
   berubah pikiran): Gibran dokumen sendiri sudah punya riwayat salah
   hitung nyata pada tugas cross-file arithmetic yang sama (klaim "142
   subtask" vs aktual 138, lihat aturan governance di file itu) — model
   lebih lemah untuk pekerjaan itu berisiko menambah sesi perbaikan yang
   lebih mahal daripada penghematannya. Sebagai gantinya: (a) 5 subagent
   lain (termasuk Ridwan/Najwa yang sudah `effort: high` sebagai quality
   gate) tetap **tidak** diubah, (b) guardrail ukuran dokumen (KI Resolved
   dihapus & Fokus Sekarang diprune saat itu juga, bukan nunggu audit
   berikutnya) ditulis eksplisit di `gibran-project-manager.md` sendiri
   supaya bloat yang sama tidak terulang, dan (c) konvensi frontmatter
   `effort`/`model` per subagent didokumentasikan di
   `.claude/agents/README.md` (sebelumnya tidak tercatat di manapun).

**Tidak diubah:** isi/status task, ID, hitungan indeks, Known Issues yang
masih `Open`, dan seluruh 7 file `.claude/agents/*.md` (governance rule di
dalamnya tidak dipangkas — sudah dicek satu per satu, tidak ada
duplikasi/bloat yang aman dipotong tanpa kehilangan guardrail).

**Ditemukan tapi belum ditindaklanjuti (gap pre-existing, dilaporkan ke
King Rezi, bukan diperbaiki sendiri):** **T-037** (Perkaya aturan coding)
disebut sebagai fokus aktif `🟡 In Progress` di Snapshot `PROJECT_STATE.md`
tapi tidak pernah muncul di tabel "Fokus sekarang" `TASKS.md` — drift
lama, bukan akibat pemangkasan sesi ini.

**Update (2026-09-23, fix hasil code review PR #132, 10 temuan):** selain
revert `model: haiku` di atas — **KI-066** (Resolved, sudah diarsipkan
penuh di entri di atas) dihapus dari `PROJECT_STATE.md` karena memenuhi
kriteria hapus yang sama persis dengan 6 KI lain sesi ini, tapi sempat
terlewat (jadi entri terpanjang yang tersisa, ~105 baris). Section
"Current Focus" `PROJECT_STATE.md` (39 baris narasi migrasi Astryx→shadcn
yang sudah selesai dan riwayat ADR-041→ADR-097) ikut dipangkas ke fakta
yang masih relevan — pola bloat yang sama, sempat terlewat sesi awal.
Referensi menggantung ke KI-059/KI-054/KI-055 yang sudah dihapus (di
KI-060 `PROJECT_STATE.md` dan field **Baca dulu** T-103
`tasks/v07-astryx-shadcn-migration.md`) diperbaiki jadi deskripsi
mandiri/pointer ke `COMPLETE_TASK.md`, bukan ID kosong. Cap "Completed
(Ringkasan)" direkonsiliasi — `PROJECT_RULES.md` sebelumnya menulis ≤10
untuk section ini padahal `AGENTS.md` sudah menegakkan 5, sekarang
keduanya konsisten (≤10 tetap berlaku khusus untuk "Recent Decisions
(Ringkasan)"). Tabel "Fokus sekarang" `TASKS.md` yang sempat tersisa
satu baris (`T-025` saja, sisanya sudah pindah ke "Selesai baru-baru
ini") disederhanakan jadi satu kalimat "Fokus aktif" — tabel untuk satu
baris cuma menambah overhead markdown tanpa manfaat.

---

## 2026-09-23 — KI-066 follow-up: 5 perbaikan visual pasca-migrasi sidebar (lebar, avatar, bg, color-scheme, Badge solid ADR-111)

King Rezi melakukan review manual di browser setelah T-105 ditutup dan
melaporkan beberapa mismatch visual, ditangani satu-satu sepanjang sesi
lanjutan yang sama:

1. **Lebar sidebar** — awalnya diperbaiki ke 260px (`16.25rem`) match
   Claude Design (`.sidebar { width: 260px }`), diverifikasi
   `getBoundingClientRect()`. King Rezi kemudian minta eksplisit diubah
   jadi **18rem (288px)** — dieksekusi langsung (instruksi eksplisit,
   bukan tebakan), diverifikasi ulang 288px persis. **Catatan: nilai ini
   sekarang menyimpang dari spec Claude Design (260px)** — belum
   disinkronkan balik, King Rezi diberi tahu dan belum menjawab.
2. **Avatar workspace switcher** — Claude Design (`.ws-avatar`) pakai
   `border-radius: var(--radius-inner)` (6px, kotak-rounded), kode
   sebelumnya `Avatar`/`AvatarFallback` default lingkaran. Diperbaiki
   scoped HANYA di `WorkspaceSideNav.tsx` (avatar Channels & footer tetap
   lingkaran, sesuai mockup). Temuan teknis: `rounded-sm` Tailwind biasa
   resolve ke 8.4px (bukan 6px) di lokasi ini karena `SidebarHeader`
   shadcn meng-override scope `--radius` untuk kontrol lain di header —
   dipakai `rounded-[6px]` literal + komentar penjelasan, diverifikasi
   `getComputedStyle` persis 6px.
3. **Background main content** — `bg-sidebar` (putih) diganti
   `bg-background` (match `--color-background-body` Claude Design, hex
   `#f3f3f5` diverifikasi sama persis). Ada riwayat lama ADR-084
   (swap warna, era Astryx) yang di-revert ADR-086 — kedua ADR itu dari
   sebelum migrasi shadcn (ADR-097/T-102), token/selector-nya sudah tidak
   ada lagi; instruksi eksplisit King Rezi + Claude Design yang sudah
   SYNCED sekarang adalah acuan yang berlaku, bukan riwayat itu.
   `rounded-tl-3xl` dicek visual tetap kontras bagus, dipertahankan
   (tidak dihapus).
4. **`color-scheme` tidak pernah di-set** — investigasi awal soal
   "warna scrollbar Channels" ternyata BUKAN soal warna scrollbar itu
   sendiri (Claude Design memang tidak mendefinisikan kustomisasi warna
   scrollbar apa pun) — akar masalahnya `apps/web/src/app/globals.css`
   tidak pernah men-set properti CSS `color-scheme`, jadi browser
   me-render seluruh UI native (scrollbar, form control) pakai tema
   terang meski `.dark` class aktif. Claude Design sudah punya
   `:root[data-theme="dark"] { color-scheme: dark }` — ditambahkan
   padanannya (`color-scheme: light` di `:root`, `color-scheme: dark` di
   `.dark`), diverifikasi `getComputedStyle(document.documentElement)`
   toggle benar mengikuti tema aktif.
5. **ADR-111 — Badge status solid fill.** King Rezi minta seluruh warna
   Badge disamakan dengan Claude Design, bukan cuma Channels. Investigasi
   menemukan bug di level komponen bersama: `badge.tsx` men-styling
   variant `success`/`warning`/`destructive` sebagai tinted 10-20% opacity,
   padahal Claude Design (`components/status-chips.html`, `readme.md`
   UXP-04: "Keep failed/disconnected states visually loud — must never
   blend into the neutral ground") mendefinisikan SEMUA status chip
   sebagai **solid fill**. Nilai token warna sudah benar sejak ADR-098 —
   hanya cara render-nya yang salah. Diperbaiki (Mark UI Engineer): 3
   variant `badge.tsx` jadi solid, token `--destructive-foreground` baru
   ditambahkan (ternyata belum pernah ada sama sekali di kode — Claude
   Design punya padanannya, `--color-on-error`, didokumentasikan sebagai
   "derived" dari pola success/warning), dan bug terpisah — badge "Active"
   di `ChannelsSection.tsx` salah pakai `variant="secondary"` (seharusnya
   `success`) — ikut diperbaiki. Dampak ripple disengaja ke seluruh
   pemakaian Badge (Draft Editor, Calendar, History, Connected Accounts,
   Members "Pending", Analyze delta) — diverifikasi visual browser
   light+dark di semua tempat itu, tidak ada regresi kontras. **ADR-111
   baru dicatat** (mengamandemen ADR-098), status ADR-098 ditandai
   "Amended by ADR-111" di index `DECISIONS.md` + body-nya sendiri (bukan
   diedit, cuma kolom Status, sesuai append-only rule).

Semua perbaikan di atas diverifikasi visual browser (`getComputedStyle`/
`getBoundingClientRect`, bukan cuma ditulis lalu diasumsikan benar) dan
`lint`/`typecheck` bersih sebelum push. Detail keputusan token/Badge:
`decisions/ADR-111-badge-status-variant-solid-fill-destructive-foreground.md`.
Progress kode: `tasks/v07-astryx-shadcn-migration.md` § T-105.

## 2026-09-23 — KI-066/T-105 Sidebar shadcn — TUNTAS 4/4 subtask: implementasi kode + review Ridwan + QA Najwa, KI-066 Resolved

Lanjutan langsung entri T-105.1 di bawah (sesi sama). Setelah gate rule 17
terpenuhi, T-105.2 (audit) dan T-105.3 (implementasi) didelegasikan ke Mark
UI Engineer (domain `UI`).

**T-105.2/T-105.3 (Mark UI Engineer):** `WorkspaceSideNav.tsx` dan
`SettingsSideNav.tsx` (`apps/web/src/app/(app)/components/` dan
`apps/web/src/app/(app)/settings/components/`) dikomposisi ulang dari
primitive `Sidebar` shadcn asli (`Sidebar`/`SidebarHeader`/`SidebarContent`/
`SidebarGroup`/`SidebarMenu`/`SidebarMenuButton`/`SidebarFooter`,
`SidebarRail` sengaja tidak dipasang — konsisten dengan mockup Claude
Design). Wrapper baru `AppShell.tsx` mengontrol prop `open`
`SidebarProvider` secara eksplisit supaya `/settings` selalu expanded
(keputusan #4), sambil tetap mempertahankan `collapsible="icon"` di
`SettingsSideNav` (bukan `"none"`) supaya mobile `Sheet` bawaan (keputusan
#5) tetap berfungsi di route itu — insight teknis: `collapsible="none"`
pada primitive shadcn melewati total logic `isMobile`, jadi tidak
kompatibel dengan keputusan mobile yang sudah dikunci. `MobileTopBar.tsx`
disederhanakan jadi cuma trigger (drawer mobile kini murni ditangani
`SidebarProvider`), `AppSideNav.tsx` dirender sekali (bukan dua instance
desktop+mobile terpisah seperti pola T-098.4 lama). 5 nav item diberi ikon
`hugeicons` (sebelumnya benar-benar tanpa ikon, bukan cuma placeholder).

3 bug ditemukan & diperbaiki selama implementasi (bukan formalitas —
ditemukan lewat verifikasi nyata): import `cn` keliru dari package npm
eksternal hasil install registry (harusnya `@/lib/utils`, `bun remove cn`
dijalankan untuk bersihkan `package.json`/`bun.lock`); lint error
`react-hooks/set-state-in-effect` di `use-mobile.ts` bawaan registry
(diganti pola `useSyncExternalStore`, konsisten cara file lain di repo
menghindari rule yang sama); overlap visual avatar+trigger di rail 48px
saat collapsed (diperbaiki `group-data-[collapsible=icon]:flex-col`).

**Susulan sama hari — review Ridwan Architecture Reviewer:** 0 pelanggaran
hard rule arsitektur (entry point bersih, domain tidak disentuh,
cross-domain lewat public API `@/domains/notification`/`@/domains/workspace`,
package hygiene bersih). 1 temuan non-blocking: cookie `sidebar_state`
ditulis `SidebarProvider` bawaan setiap toggle tapi tidak pernah dibaca
ulang untuk inisialisasi — state collapse/expand reset ke expanded tiap
full page reload (infrastruktur cookie ada, efeknya tidak pernah dipakai).
King Rezi diberi pilihan (perbaiki sekarang vs catat known-gap) via
`AskUserQuestion` — memilih **perbaiki sekarang**. Fix (Mark UI Engineer,
sesi dilanjutkan): `(app)/layout.tsx` (Server Component) baca cookie via
`cookies()` dari `next/headers`, diteruskan sebagai prop `defaultOpen` ke
`AppShell.tsx` (`useState(true)` hardcoded → `useState(defaultOpen)`).
Sempat ada false-positive flip-flop saat testing di tab browser lama
(artifact Next.js router cache dari puluhan reload/HMR sepanjang sesi,
bukan bug) — dikonfirmasi bersih di tab browser baru: collapse→reload
tetap collapsed, expand→reload tetap expanded, paksaan `/settings` tidak
rusak, kembali ke workspace balik ke preferensi tersimpan (bukan reset).

**Susulan — QA Najwa QA Engineer (T-105.4):** PASS penuh — golden path
(toggle, persistence reload, paksaan settings, Channels hidden saat
collapsed), regresi (nav aktif per-route, logout dialog Tier-2, dropdown
workspace switcher, unread badge, Channels hover drag/count↔+, New Post
CTA) semua PASS, mobile breakpoint 768px (Sheet workspace & settings,
auto-close setelah klik nav) PASS, light/dark mode PASS. `typecheck`/
`lint` bersih, `vitest` **453 pass/6 skip**. Satu catatan: header
"workspace switcher" ternyata memang cuma `Link` biasa ke `/`, bukan
dropdown — sudah begitu sejak sebelum T-105 (dicek riwayat git), bukan
regresi, cuma mismatch istilah di deskripsi task.

**Gate T-103.3** tidak bisa dijalankan Najwa — `DesignSync` tidak
ter-load di sesi subagent-nya (limitasi berulang yang sama sejak T-098.4,
tercatat `.claude/agents/README.md`). Dijalankan manual di sesi utama
sebagai gantinya: `WorkspaceSideNav.tsx`/`SettingsSideNav.tsx`/
`AppShell.tsx` dibaca langsung dan dibandingkan terhadap
`components/navigation.html`/`readme.md` § Components yang sudah SYNCED
(T-105.1) — komposisi primitive match persis (termasuk `SidebarRail`
yang sama-sama tidak dipasang di keduanya). Gate **PASS**.

**KI-066 Resolved.** T-105 seluruh 4/4 subtask `✅ Done`. Branch+PR kode
**belum** dibuat — menunggu review King Rezi (kode sudah ada di branch
kerja `fix/ki-066-sidebar-shadcn-collapse`, bukan `main`/`staging`, sesuai
rule 18 AGENTS.md). Detail lengkap: `tasks/v07-astryx-shadcn-migration.md`
§ T-105.2–T-105.4, `PROJECT_STATE.md` § KI-066.

## 2026-09-23 — KI-066/T-105.1 Sidebar shadcn — King Rezi review Claude Design: OK, mobile pakai Sheet bawaan (gate rule 17 terpenuhi, lanjut ke kode)

King Rezi mereview hasil update Claude Design sesi sebelumnya (T-105.0:
mapping primitive `Sidebar` + collapse/expand icon-only) dan mengonfirmasi
**OK, tidak ada revisi**. Keputusan terbuka mobile behavior (satu-satunya
yang belum dijawab) juga dijawab: pakai `Sheet` bawaan `Sidebar` shadcn
(auto-swap di bawah breakpoint `md` via `SidebarProvider`) — **menggantikan**
`MobileTopBar.tsx`/`Sheet` custom (T-098.4), bukan dipertahankan
berdampingan.

`components/navigation.html` dan `readme.md` § Components (Claude Design,
project "Social Media Management") diupdate untuk mencatat kedua keputusan
ini dan ditandai **SYNCED (T-105.1, 2026-09-23)** — locked pattern, subagent
implementasi (Mark UI Engineer) tidak perlu bertanya ulang soal pola ini
per gate rule 17/`.claude/agents/README.md`. Perubahan dijaga scope-ketat:
diff dicek sebelum push — hanya paragraf/sel tabel terkait dua keputusan
ini yang berubah, sisanya byte-identik dengan versi T-105.0. Remote
diverifikasi 2x (fetch sebelum edit, fetch ulang tepat sebelum push, tidak
ada drift) sesuai skill `claude-design-scope-discipline` rule 6.

Gate wajib rule 17 AGENTS.md kini terpenuhi untuk T-105 — **T-105.2**
(audit gap kode) dan **T-105.3** (implementasi migrasi struktur + fitur
collapse/expand + mobile Sheet) didelegasikan ke Mark UI Engineer (domain
`UI`, sesuai pemetaan `.claude/agents/README.md`). Kode `apps/web` untuk
KI-066 baru mulai berjalan setelah entri ini. Detail keputusan lengkap:
`tasks/v07-astryx-shadcn-migration.md` § T-105.1, `PROJECT_STATE.md` §
KI-066.

## 2026-09-22 — KI-066/T-105 Sidebar shadcn — rollout fitur collapse/expand ke App Prototype + 8 screen template (kode apps/web tetap belum dimulai)

Susulan kedua dari entri T-105.0 di bawah (sesi sama). Setelah fitur
collapse/expand selesai di `components/navigation.html` (component spec
terisolasi), King Rezi diberi pilihan lewat `AskUserQuestion`: cukup di
component spec, rollout ke App Prototype saja, atau rollout ke semuanya.
King Rezi memilih **rollout ke semuanya**.

**Analisis arsitektur dulu sebelum eksekusi:** dicek bagaimana App
Prototype (`templates/app-prototype/AppPrototype.dc.html`) benar-benar
merender sidebar — ternyata pakai `<iframe src="templates/<file>.html">`
yang me-load file `templates/*.html` asli langsung, BUKAN duplikasi
markup di dalam file `.dc.html` itu sendiri. Artinya begitu markup
sidebar di `templates/*.html` diupdate, App Prototype otomatis ikut
menampilkannya — tidak perlu duplikasi kode markup. Yang tetap perlu
ditambah manual di `AppPrototype.dc.html`: wiring klik, karena runner
py itu punya delegated click listener generik yang `preventDefault()`
semua elemen `[data-proto]` lalu memanggil `route()` — tanpa case baru
di `route()`, klik tombol toggle di dalam runner tidak akan melakukan
apa-apa (beda dari screen berdiri sendiri yang punya `<script>` sendiri
per file).

**8 dari 23 file `templates/*.html` masuk scope** (satu-satunya yang
punya `.sidebar` workspace, bukan `.settings-sidebar` yang dikecualikan
per keputusan sebelumnya): `home.html`, `publish-calendar.html`,
`publish-queue.html`, `publish-drafts.html`, `publish-history.html`,
`publish-history-detail.html`, `engage-inbox.html`,
`analyze-dashboard.html`. Pola yang sama diterapkan ke semuanya: ikon
SVG di 5 nav item, tombol trigger di `ws-switch`, label "New Post"
dibungkus span, dan script toggle ditambahkan sebagai `<script>` baru
di akhir file (sebelumnya sempat salah anchor untuk file yang punya 2
`<script>` block seperti `analyze-dashboard.html` — pola regex transform
diperbaiki supaya anchor ke akhir file secara universal, bukan ke
`toggleTheme` spesifik).

**Bug ditemukan & diperbaiki oleh transform pertama:** untuk
`publish-queue.html`, replace awal tanpa scope sempat ikut mengubah
tombol "New Post" di page-header (`.main`, bukan sidebar) — diperbaiki
dengan mempersempit pattern match ke `<div class="sidebar-cta">` saja.

**Verifikasi ketat sebelum push, per file** — bukan ditulis lalu
diasumsikan benar: setiap file di-cross-check fingerprint SVG path ikon
platform Channels (Instagram/Facebook/X/TikTok/Pinterest) dan
internal-consistency check untuk ikon drag-handle (5 kemunculan per
file harus identik). Proses ini **menemukan 2 typo transkripsi nyata**
di `analyze-dashboard.html` (path SVG drag-handle korup, hilang satu
segmen path di 2 dari 5 baris Channel) — diperbaiki sebelum push,
bukan setelah. `publish-history-detail.html` sempat terlihat "beda"
juga tapi setelah dicek ternyata itu memang typo pre-existing di file
sumber asli (bukan typo baru dari transkripsi ini) — dibiarkan apa
adanya, di luar scope untuk diperbaiki.

**Diverifikasi visual nyata** salah satu file paling kompleks
(`analyze-dashboard.html`, punya 2 tab Overview/Reports) via server
HTTP lokal + browser pane: screenshot expanded, klik toggle → screenshot
collapsed (icon-only rail, main content tidak terganggu), klik tab
Reports sambil sidebar collapsed → tab-switching tetap jalan normal,
tidak ada konflik antar 2 script independen di file yang sama.

**`AppPrototype.dc.html` diupdate**: method baru `toggleSidebarCollapse(doc, el)`
(persis pola `toggleTheme`) + 1 baris baru di `route()` untuk
`data-proto === 'sidebar-collapse-toggle'`. Diff diverifikasi minimal
(cuma 2 blok ditambahkan, tidak ada yang lain tersentuh) dan remote
dicek ulang tidak berubah sebelum push.

**Keterbatasan yang diakui eksplisit:** App Prototype pakai format
`<x-dc>` (dc-runtime, React-based) yang cuma benar-benar jalan di dalam
Claude Design sendiri — tidak bisa di-preview/klik-test dari sesi ini
seperti 8 screen biasa (yang plain HTML/JS). Wiring `route()`-nya
diverifikasi lewat diff + kesamaan pola persis dengan `toggleTheme` yang
sudah terbukti jalan bertahun-tahun di file yang sama, bukan lewat klik
nyata. **King Rezi perlu cek langsung di Claude Design** (buka App
Prototype, klik tombol toggle di sidebar) untuk konfirmasi akhir semua
berfungsi seperti yang diharapkan.

Branch+PR kode `apps/web` masih belum dibuat — menunggu King Rezi review
seluruh hasil ini (termasuk App Prototype) + jawab keputusan mobile
behavior yang masih terbuka dari entri sebelumnya. Detail:
`tasks/v07-astryx-shadcn-migration.md` § T-105.0, `PROJECT_STATE.md` §
KI-066.

---

## 2026-09-22 — KI-066/T-105 Sidebar shadcn — susulan: fitur collapse/expand icon-only ditambahkan ke mockup (kode tetap belum dimulai)

Susulan langsung dari entri T-105.0 di bawah (sesi sama). Setelah update
mapping struktural pertama, King Rezi minta eksplisit: "sidebar bisa
dibuka-tutup sama seperti yang ada di shadcn" — dan minta MCP shadcn
dipakai supaya akurat, bukan menebak dari ingatan.

Dicek dulu API sungguhan lewat MCP shadcn (`get_item_examples_from_registries`
query `sidebar-07` — "A sidebar that collapses to icons") sebelum menyentuh
mockup — mengonfirmasi `collapsible="icon"` prop, `SidebarTrigger`,
`SidebarRail`, dan pola `group-data-[collapsible=icon]:hidden` untuk
menyembunyikan grup opsional (`NavProjects` di contoh resmi).

4 fork keputusan dikunci King Rezi via `AskUserQuestion` (bukan ditebak):
1. Mode collapse = **icon-only rail**, bukan offcanvas (sembunyi total).
2. Trigger (`SidebarTrigger` replica) ditaruh di **header sidebar** dekat
   workspace switcher — deviasi disengaja dari pola resmi shadcn
   (`SidebarInset > header`), karena desain ini tidak punya top bar di
   desktop.
3. Section "Channels" **disembunyikan total** saat collapsed (pola sama
   `NavProjects` resmi), bukan varian compact avatar-only.
4. **Hanya sidebar workspace utama** yang collapsible — `.settings-sidebar`
   (T-039.1-4) sengaja dikecualikan, tetap fixed-width tanpa trigger.

**Gap baru ditemukan saat implementasi:** 5 nav item (Home/Publish/Engage/
Analyze/Start Page) sebelumnya cuma teks tanpa ikon sama sekali — mode
icon-only butuh ikon. Ditambahkan ikon SVG placeholder hand-built
sederhana (bukan path `hugeicons` asli, karena tidak ada akses ke source
`hugeicons` dari sesi ini) — didokumentasikan eksplisit di mockup + readme
sebagai TBD-placeholder (pola sama token warna DT-D02), perlu
diverifikasi/diganti ke `hugeicons` asli saat implementasi kode nanti.

Implementasi: `components/navigation.html` (ikon + `SidebarTrigger` +
script toggle `data-collapsed`), `styles.css` (aturan
`.sidebar[data-collapsed="true"]`, lebar collapsed 48px/3rem menyamai
default `--sidebar-width-icon` shadcn), `readme.md` § Components (baris
`.app-shell`/`.sidebar`/... diupdate lagi).

**Diverifikasi visual nyata sebelum push** — bukan ditulis lalu
diasumsikan benar: dijalankan local HTTP server sementara
(`python3 -m http.server`) di scratchpad, dibuka di browser pane,
screenshot state expanded (ikon+label lengkap) dan collapsed (rail 48px,
ikon center, Channels hilang, footer stack vertikal), tombol toggle diklik
bolak-balik untuk konfirmasi kedua arah berfungsi. Server lokal dimatikan
setelah verifikasi. Remote Claude Design dicek ulang tidak berubah sebelum
push (rule 6 skill `claude-design-scope-discipline`).

**Belum** ditandai "SYNCED". Branch+PR kode masih belum dibuat — menunggu
review King Rezi atas seluruh perubahan (mapping struktural + fitur
collapse/expand) dan jawaban soal mobile behavior (keputusan terbuka dari
entri sebelumnya, belum terjawab) sebelum lanjut ke T-105.1 dan
implementasi kode. Detail: `tasks/v07-astryx-shadcn-migration.md` §
T-105.0, `PROJECT_STATE.md` § KI-066.

---

## 2026-09-22 — KI-066/T-105 Sidebar shadcn migration — Claude Design diupdate (T-105.0), kode BELUM dimulai, menunggu review King Rezi

King Rezi minta dibuatkan branch+PR untuk KI-066 (sidebar workspace/settings
belum migrasi ke primitive `Sidebar` shadcn/ui). Sesuai rule 17 AGENTS.md,
dicek dulu ke Claude Design sebelum kode ditulis — ternyata mockup lama
(`components/navigation.html`) justru secara eksplisit mendokumentasikan
sidebar sebagai hand-built **disengaja** ("No registry `Sidebar` component
installed... hand-built from `--sidebar-*` CSS variables + Tailwind"),
dicatat sejak KI-047 Phase 2b — bertentangan dengan premis KI-066.

King Rezi diberi 3 opsi via `AskUserQuestion` (batalkan KI-066 / update
Claude Design dulu / branch+PR investigasi tanpa desain final) — memilih
**"Update Claude Design dulu"**: migrasi struktural memang dikehendaki,
Claude Design harus jadi acuan benar dulu sebelum kode.

Dijadikan task formal **T-105** di `tasks/v07-astryx-shadcn-migration.md`
(ID dipinjam dari rentang global setelah T-104, sesuai pola footnote ¹
`TASKS.md` — rentang v0.7 T-095–T-103 sudah habis).

Percobaan pertama mendelegasikan update Claude Design ke Neymar Product
Designer (subagent) **gagal** — tool `DesignSync` tidak ter-load di sesi
subagent (kejadian ke-6 dengan pola identik, dicatat di
`.claude/agents/README.md`). Dikerjakan langsung di sesi utama.

**T-105.0 selesai:** `components/navigation.html` + `readme.md` § Components
(baris `.app-shell`/`.sidebar`/... dan `.settings-sidebar`/...) diupdate ke
komposisi primitive `Sidebar` shadcn resmi (`SidebarProvider`/`Sidebar`/
`SidebarHeader`/`SidebarContent`/`SidebarGroup`/`SidebarMenu`/
`SidebarMenuItem`/`SidebarMenuButton`/`SidebarFooter`/`SidebarRail`, dicek
lewat MCP shadcn — referensi `sidebar-01`/`sidebar-demo`). Scope dijaga
ketat sesuai skill `claude-design-scope-discipline`: hanya prosa + HTML
comment struktural yang berubah, seluruh CSS class/visual/behavior demo
markup **byte-identik** (diverifikasi `diff` eksplisit sebelum push, dan
remote dicek 2x sebelum menulis — tidak ada perubahan King Rezi yang
tertimpa). **Belum** ditandai "SYNCED"/"LOCKED PATTERN" — itu keputusan
King Rezi setelah review.

**Keputusan terbuka yang sengaja TIDAK diputuskan sendiri** (dicatat
eksplisit di kedua file Claude Design, minta jawaban King Rezi): primitive
`Sidebar` shadcn punya mobile behavior bawaan (auto-swap ke `Sheet` di
bawah breakpoint `md`) — apakah ini menggantikan `MobileTopBar.tsx`/`Sheet`
custom (T-098.4), atau `Sidebar` cuma dipakai untuk struktur desktop dan
mobile tetap pola T-098.4 apa adanya?

**Branch+PR kode BELUM dibuat** — menunggu King Rezi review pola + jawab
keputusan mobile behavior (T-105.1) dulu, sesuai gate rule 17 AGENTS.md.
Detail lengkap: `tasks/v07-astryx-shadcn-migration.md` § T-105,
`PROJECT_STATE.md` § KI-066.

---

## 2026-09-22 — T-050 Engagement domain skeleton + T-051 Comment sync job JOB-03 + T-052 Manual refresh — Ditinjau & ✅ Done, rilis v0.4 Engagement MVP TUNTAS 5/6 (ADR-110, migration pending deploy)

Ketiganya sudah diimplementasikan penuh di sesi sebelum ini (commit
`23f9923`/`ae0f49b`), status filenya masih `🟡 In Progress` karena belum
pernah lolos review/QA formal. King Rezi meminta ditinjau sekarang.

Rangkaian review Ridwan Architecture Reviewer **3 putaran**, seluruhnya
diverifikasi independen (bukan percaya laporan implementer):

1. **Putaran 1 — 3 temuan:**
   - **#1 (serius, fungsional):** job `engagement.sync` (JOB-03) tidak
     pernah ter-seed otomatis untuk `ConnectedAccount` baru — handler
     hanya self-reschedule SETELAH job pertama ada, tidak ada trigger
     awal. Siklus 30 menit otomatis tidak pernah mulai sendiri,
     bertentangan dengan Definition of Done v0.4.
   - **#2 (rule #5):** `refreshInboxAction` melakukan orkestrasi (loop
     akun, sync, akumulasi count) langsung di Server Action, bukan
     didelegasikan ke Application Service.
   - **#3 (rule 19, governance):** kapabilitas Fake `fetchComments`/
     `replyToComment` di `IOutstandAdapter` belum punya ADR sendiri
     (preseden ADR-079/093/105/106/108 selalu dapat ADR per kapabilitas
     baru).

2. **Fix (Elon Backend Engineer):**
   - **#1** — Opsi A dipilih (sesuai `background-jobs.md` §
     "Workspace BC → Background Job"): `WorkspaceService` dapat port
     opsional baru `EngagementSyncSeederPort` (parameter ke-5
     constructor, TIDAK import domain `engagement`), dipanggil di
     `completeAccountConnection` untuk cabang create DAN reconnect.
     Implementasi konkret (enqueue `ENGAGEMENT_SYNC_JOB_TYPE`) di
     composition root `apps/web/src/lib/workspace/outstand-workspace-service.ts`.
   - **#2** — orkestrasi dipindah ke use-case baru
     `RefreshInboxUseCase.refreshAll`
     (`apps/web/src/domains/engagement/services/refresh-inbox.use-case.ts`,
     pola sama `SyncCommentsUseCase`), `refreshInboxAction` jadi murni
     composition root.
   - **#3** — ditutup lewat **ADR-110 baru**
     (`decisions/ADR-110-fake-fetchcomments-replytocomment-engagement.md`).

3. **Putaran 2 (verifikasi fix #1 & #2):** Ridwan konfirmasi kedua fix
   benar (domain purity terjaga, `RefreshInboxUseCase` konsisten pola
   `SyncCommentsUseCase`), TAPI eskalasi **temuan baru**: `disconnectAccount`
   tidak pernah membatalkan chain self-reschedule job `engagement.sync` —
   lookup SQL job handler tidak filter status, tiap reconnect bikin chain
   baru tanpa cek chain lama → chain paralel bertambah tak terbatas saat
   disconnect→reconnect berulang. Dengan Fake adapter dampak tersamar
   (idempoten via upsert dedup), tapi begitu Real adapter (T-025) aktif
   berarti akun yang sudah diputuskan user tetap terus di-pull + terus
   memicu notifikasi — masalah privasi/kontrol.

4. **Fix (Elon):** solusi guard status (bukan cancel job baru, karena
   `IJobScheduler`/`background-job-store.ts` tidak punya mekanisme
   cancel/deleteByCriteria) — migration baru
   `20260922110000_t051_filter_active_status_engagement_sync_lookup`
   menambah kolom `status` ke fungsi SQL
   `webhook_find_account_owner_by_outstand_account_id`;
   `findAccountOwnerByOutstandAccountId` return `null` kalau status bukan
   `active` (diperlakukan sama seperti "tidak ditemukan" —
   `EngagementSyncJobHandler` sudah punya jalur dead-letter yang throw
   SEBELUM self-reschedule, jadi chain otomatis berhenti).
   `markAccountReconnectRequired` (webhook T-026.5) tidak terdampak
   (SELECT tidak berubah, hanya kolom output ditambah).

5. **Putaran 3 (verifikasi final):** Ridwan konfirmasi independen: migration
   hanya nambah kolom, tidak ubah filter; call site lain
   (`markAccountReconnectRequired`) tidak terdampak; urutan
   throw-sebelum-reschedule dikonfirmasi lewat kode+test; domain purity
   terjaga. **0 temuan tersisa, seluruh rangkaian review DITUTUP.**

**QA Najwa QA Engineer:**

- Golden path Refresh/Mark as Done/Kirim Balasan — PASS, network request
  dicek langsung (balasan tersimpan status "sent" +
  `outstandReplyId` terisi).
- Connect/Disconnect/Reconnect account (T-013/T-015) — PASS, tidak ada
  regresi meski file yang disentuh fix ini overlap dengan flow itu.
- Regresi `/analyze`, `/publish/drafts` — normal.
- Seeding job otomatis — tidak bisa diverifikasi browser end-to-end (tidak
  ada akses `JOB_SECRET`/DB), diverifikasi lewat unit test
  `workspace.service.test.ts` (2 test baru: seed saat create, seed saat
  reconnect) — keduanya lolos.
- **1 bug ditemukan** (di luar scope T-050-052, regresi dari T-053/T-054
  yang lolos QA sebelumnya): balasan komentar tidak pernah tampil lagi di
  detail panel setelah reload (`EngageInboxView.tsx` tidak merender
  `detail.replies` meski backend sudah benar). **Sudah diperbaiki** (Mark
  UI Engineer) — replies sekarang dirender sebagai "Balasan tim" (kotak
  indent+background beda) setelah komentar asli, dan balasan baru langsung
  muncul tanpa reload. **Diverifikasi ulang Najwa — PASS.**
- Test integration baru
  (`workspace.repository.engagement-sync-lookup.test.ts`) skip di sesi ini
  (tidak ada `DATABASE_URL` lokal) — expected, bukan gap.

**⚠️ Catatan governance penting untuk King Rezi:** migration
`20260922110000_t051_filter_active_status_engagement_sync_lookup`
**BELUM di-deploy** ke database (perlu `bun run db:deploy` manual oleh King
Rezi) — sampai itu dijalankan, fungsi SQL yang dipakai job JOB-03 masih
versi lama (job akan gagal untuk SEMUA akun, bukan cuma yang disconnect,
sampai migration ter-apply).

**Verifikasi akhir:** `bun run typecheck`/`bun run lint`/`bun run test` —
bersih, **453 test pass/6 skip** (naik dari 448, +5 test baru: 3 di
`refresh-inbox.use-case.test.ts`, 2 di `workspace.service.test.ts`, 1 skip
di `workspace.repository.engagement-sync-lookup.test.ts`).

**Commit:** sudah di-push ke branch `feature/engagement-comments-inbox` —
commit `2b771bd` "fix(engagement): perbaiki 3 temuan review Ridwan + bug
reply tidak tampil" (menyusul commit `10bc50d` untuk T-053/T-054 awal).

Dengan ini **T-050, T-051, T-052 naik status `🟡 In Progress` → `✅ Done`**
— **rilis v0.4 Engagement MVP tuntas 5/6 task** (sisa T-055 Inbox
assignment, Could Have, tidak memblokir rilis). Task selesai naik
51 → **54**. Detail: `tasks/v04-engagement-mvp.md` § T-050, § T-051,
§ T-052,
`decisions/ADR-110-fake-fetchcomments-replytocomment-engagement.md`.

---

## 2026-09-22 — T-053 Comments Inbox UI + T-054 Reply comment — Implementasi selesai, ✅ Done, rilis v0.4 Engagement MVP dimulai (KI-065 baru)

Dikerjakan sekuensial: Prabowo Feature Engineer (backend T-053) → Mark UI
Engineer (UI T-053) → Elon Backend Engineer (domain T-054) → Mark UI
Engineer (aktivasi tombol Kirim T-054) → Ridwan Architecture Reviewer
(review) → Najwa QA Engineer (QA). Sebelum implementasi UI T-053 dimulai,
main agent berhenti dan bertanya ke King Rezi via `AskUserQuestion` (rule
17 AGENTS.md) karena pola thread-list di Claude Design
(`templates/engage-inbox.html`, KSP-06) belum dikunci "SYNCED"/"LOCKED
PATTERN" — jawaban: "sesuaikan dengan yang ada di Claude Design".

### T-053 · Comments Inbox UI

**Backend (Prabowo Feature Engineer):** Server Action baru
`listInboxAction`, `getInboxItemDetailAction`, `markAsDoneAction` di
`apps/web/src/app/(app)/engage/actions.ts` — murni wiring ke
`EngagementService` yang sudah ada sejak T-050, tidak ada logic domain
baru.

**UI (Mark UI Engineer):** `apps/web/src/app/(app)/engage/page.tsx`
diganti dari `ScaffoldPlaceholder` jadi Server Component; komponen baru
`apps/web/src/app/(app)/engage/components/EngageInboxView.tsx` (Client
Component) — layout dua panel (thread-list kiri 340px tetap +
thread-detail kanan), dibangun dari shadcn `Item`/`ItemGroup` (bukan
`Table`, karena mockup satu blok teks per baris bukan tabular), filter 3
dropdown (Akun/Platform/Status) re-fetch server-side, tombol Mark as Done,
reply box (tombol Kirim awalnya disabled, diaktifkan di T-054), empty
state (`Empty` shadcn), tombol Refresh manual reuse `refreshInboxAction`
(T-052).

**KI-065 baru** (Open): kotak "Post asal" di detail panel hanya
menampilkan label generik ("Komentar ini terhubung ke post
terjadwal/terpublish") tanpa judul/thumbnail post asli —
`InboxItemDetail`/`EngagementInboxItemRecord` (T-050) tidak membawa join
ke caption/media post sungguhan (`postId` hanya ID, tanpa snapshot), dan
menambah join lintas domain `engagement → publishing` di luar scope
UI-only task ini. Perlu keputusan/task lanjutan King Rezi.

### T-054 · Reply comment dari dalam aplikasi

RBAC dicek ke baseline `roles-permissions.md` — Owner/Admin/Creator SEMUA
boleh reply (tidak ada role gating tambahan, cukup member aktif
workspace), tidak perlu keputusan baru.

**Domain (Elon Backend Engineer):** `EngagementService.reply(input,
userId)` baru — validasi content tidak boleh kosong (`ValidationError`),
cari inbox item (`NotFoundError` guard), panggil
`IOutstandAdapter.replyToComment(item.externalId, content)` (Fake
adapter, instant-success, pola sama `schedulePost`/`publishNow`), lalu
persist `EngagementReply` dengan `outstandReplyId` hasil adapter, status
`"sent"`. **Constructor `EngagementService` berubah** — sekarang wajib
menerima `IOutstandAdapter` sebagai parameter kedua (breaking change
internal, semua call site sudah diupdate, dikonfirmasi konsisten oleh
Ridwan Architecture Reviewer). `IEngagementRepository.createReply`
diperluas menerima `outstandReplyId` (kolom `EngagementReply.outstandReplyId`
sudah ada di schema sejak awal, tidak ada migration baru). Unit test baru
untuk `EngagementService.reply` (golden path + `ValidationError` +
`NotFoundError`).

**Server Action + UI (Prabowo Feature Engineer / Mark UI Engineer):**
`replyToCommentAction` baru di `actions.ts`; tombol "Kirim" di
`EngageInboxView.tsx` diaktifkan — disabled saat draft kosong/sedang
mengirim, toast sukses/error, textarea dikosongkan setelah sukses.

### Review Ridwan Architecture Reviewer

0 temuan — domain purity terjaga (`IOutstandAdapter` tetap interface
abstrak, bukan Prisma/Supabase konkret), entry point tanpa business logic,
cross-domain lewat public API `workspace`, RBAC sesuai baseline, shared
types tidak duplikat, seluruh call site `EngagementService` konsisten
dengan constructor baru.

### QA Najwa QA Engineer

PASS penuh — golden path (pilih thread, Mark as Done, kirim reply) semua
bekerja tanpa reload, filter Akun/Platform/Status semua benar, regresi
`/publish/drafts` dan `/analyze` normal, gate T-103.3 (bandingkan struktur
ke `templates/engage-inbox.html` Claude Design) cocok — pola
`Item`/`ItemGroup` sesuai keputusan terkunci, gap "Post asal" dikonfirmasi
expected (bukan bug, konsisten Fake adapter tidak pernah mengisi
`postId` snapshot).

### Verifikasi akhir

`bun run typecheck`/`bun run lint`/`bun run test` semua bersih, **448 test
pass/5 skip** (naik dari 426), tidak ada regresi.

### Catatan governance (dilaporkan ke King Rezi, belum ditindaklanjuti sesi ini)

**T-050** (Engagement domain skeleton), **T-051** (Comment sync job setiap
30 menit / JOB-03), dan **T-052** (Manual refresh) sudah diimplementasikan
penuh lewat commit `23f9923` (T-050+T-051) dan `ae0f49b` (T-052) di sesi
sebelum sesi ini — tapi status ketiganya masih `🟡 In Progress` di
`tasks/v04-engagement-mvp.md`, tidak ada catatan review Ridwan Architecture
Reviewer/QA Najwa QA Engineer untuk ketiganya, dan `PROJECT_STATE.md` tidak
pernah mencatat penyelesaiannya di section manapun. Status ketiganya
sengaja TIDAK dipromosikan ke `✅ Done` di sesi dokumentasi ini tanpa
konfirmasi eksplisit King Rezi bahwa implementasinya sudah lolos
verifikasi penuh — dicatat sebagai temuan terbuka, bukan ditebak.

Breakdown v0.4 berubah dari "⏳ 0 / 6" menjadi **2 ✅ (T-053, T-054) · 3 🟡
(T-050–T-052) · 1 ⏳ (T-055)**. Total task selesai naik 49 → **51** dari 89
total. Jumlah subtask total tidak berubah (221 — v0.4 sengaja belum punya
subtask terdefinisi, rolling wave, dihitung ulang langsung dari
`tasks/v04-engagement-mvp.md`). Detail: `tasks/v04-engagement-mvp.md` §
T-053, § T-054; KI-065 di `PROJECT_STATE.md`.

---

## 2026-09-21 — T-045 Comparative Reports — Implementasi selesai, ✅ Done (3/3 subtask), v0.3 Analytics MVP TUNTAS 8/8

Lanjutan langsung dari design-prep di bawah (entri sebelumnya, sama hari) —
King Rezi minta lanjut implementasi T-045.1–T-045.3 setelah rancangan
Claude Design disetujui. Dikoordinasikan main agent, dikerjakan sekuensial:
Prabowo Feature Engineer (backend) → Mark UI Engineer (UI) → Ridwan
Architecture Reviewer (review) → Najwa QA Engineer (QA), dengan 2 fix kecil
diterapkan langsung oleh main agent setelah temuan review/QA.

### Prabowo Feature Engineer — backend

`apps/web/src/domains/publishing/services/publishing.service.ts`:
- Method baru `getComparativeReport(workspaceId, period, userId): Promise<ComparativeReport>`.
- Tipe baru: `ComparativeMetric { current: number | null; previous: number | null }`,
  `AccountComparisonRow { connectedAccountId; platform; accountHandle; reach: ComparativeMetric }`,
  `ComparativeReport { totalPosts: {current, previous}; totalReach: ComparativeMetric; avgEngagementRate: ComparativeMetric; accounts: AccountComparisonRow[] }`.
- `getPostPerformance` di-extend parameter opsional `asOf?: Date` (diteruskan
  ke `resolvePostPerformancePeriodRange`) — backward compatible, 4 call
  site lama tidak berubah.
- 2 helper privat baru diekstrak: `summarizeRows` (agregasi
  totalReach/avgEngagementRate, dipakai ulang `getAnalyzeSummary` yang
  di-refactor tanpa mengubah behavior) dan `sumReachByAccount` (agregasi
  reach per akun, khusus `getComparativeReport` — `getAccountOverview`
  SENGAJA tidak direfactor ulang karena butuh agregasi ganda
  reach+distinct-post-count, dua pass tidak sepadan manfaatnya).
- **Keputusan implementasi penting** (dicatat karena mockup Claude Design
  memberi label "vs 9 bulan lalu" yang bisa disalahartikan): "periode
  sebelumnya" BUKAN calendar-aligned, melainkan rolling window SAMA
  PANJANG dan PERSIS BERSEBELAHAN dengan periode current (`getPostPerformance`
  dipanggil 2x: sekali tanpa `asOf` untuk current, sekali dengan
  `asOf: currentFrom` untuk previous) — konsisten dengan cara `period`
  current sendiri sudah dihitung (`resolvePostPerformancePeriodRange`,
  rolling bukan calendar-aligned sejak refactor T-043).
- Server Action baru `getComparativeReportAction(period)` di
  `apps/web/src/app/(app)/analyze/analyze-actions.ts`, pola composition
  root persis `getAccountOverviewAction` (`AnalyticsService` sebagai
  `PostMetricsPort` + `WorkspaceService` sebagai `ConnectedAccountsPort`).
- 4 unit test baru di `publishing.service.test.ts`.
- Verifikasi: `typecheck`/`lint` bersih, `vitest` 426 pass/5 skip (naik
  dari 422).

### Mark UI Engineer — UI

`apps/web/src/app/(app)/analyze/page.tsx` + `components/AnalyzeDashboard.tsx`:
- `page.tsx`: tambah `getComparativeReportAction` ke `Promise.all` yang
  sudah ada (5 action paralel), teruskan sebagai prop `initialComparativeReport`.
- `AnalyzeDashboard.tsx`: halaman `/analyze` sekarang punya
  `Tabs`+`TabsList`(`variant="line"`, sama `PublishTabbar.tsx`)+
  `TabsTrigger`+`TabsContent` shadcn asli — tab "Overview" (konten existing,
  TIDAK diubah struktur) dan tab "Reports" (baru). Switch tab murni
  client-side (data kedua tab sudah di-fetch sekaligus lewat `Promise.all`
  yang sama, TIDAK ada re-fetch saat ganti tab).
- Komponen baru: `ComparativePeriodContent` (kartu "Perbandingan Periode",
  3 kolom stat + badge delta), `AccountComparisonContent` (kartu
  "Perbandingan Akun/Platform", tabel + badge delta per baris), `DeltaBadge`
  + helper `computeRelativeDelta`/`computeEngagementRateDelta` (aturan:
  tidak ada badge kalau salah satu sisi `null`, `previous === 0`, atau
  delta membulat ke 0 — netral).
- Delta badge: `Badge` `variant="success"`/`variant="destructive"`
  (KI-051 resolved, BUKAN token warna baru) + ikon Hugeicons
  `ArrowUp01Icon`/`ArrowDown01Icon` (adaptasi dari unicode ▲/▼ mockup
  statis Claude Design ke bahasa visual ikon yang sudah dipakai halaman
  ini untuk sort).
- Label UI "vs periode sebelumnya" (BUKAN "bulan lalu"/"minggu lalu"
  literal seperti teks mockup) — konsisten dengan keputusan rolling-window
  di atas, supaya tidak menyesatkan.
- Export CSV (T-045.3): `handleExportCsv` + `buildComparativeReportCsv` —
  murni client-side (`Blob` + elemen `<a>` sementara, `URL.createObjectURL`),
  TIDAK ada Server Action baru, TIDAK ada dependency CSV eksternal. Satu
  file, dua section ("Perbandingan Periode" lalu "Perbandingan
  Akun/Platform") dipisah baris kosong. Tombol disabled kalau tidak ada
  apa pun untuk di-export (`hasComparativeData`).
- Verifikasi browser: golden path PASS, ganti period PASS di kedua tab,
  switch tab 0 network request baru, dark/light mode + mobile 375px PASS.

### Ridwan Architecture Reviewer

0 temuan pelanggaran arsitektur keras (tidak ada circular dependency baru
— `ConnectedAccountsPort`/`PostMetricsPort` reuse arah yang sudah legal;
entry point `page.tsx`/`analyze-actions.ts` tetap tipis; refactor
`summarizeRows` tidak mengubah behavior `getAnalyzeSummary`; null-safety
konsisten pola T-043.4/T-046.3/T-047.3).

**1 temuan minor (edge-case, bukan pelanggaran arsitektur):**
`getComparativeReport` awalnya memanggil `new Date()` dua kali secara
independen (sekali untuk menurunkan `currentFrom`, sekali lagi implisit di
`getPostPerformance` tanpa `asOf` untuk current rows) — risiko sangat kecil
(butuh post yang `publishedAt`-nya jatuh persis di selisih milidetik antara
dua panggilan) tapi bertentangan dengan klaim JSDoc `ComparativeReport`
("rentang PERSIS BERSEBELAHAN, tanpa gap/overlap"). **Diperbaiki langsung
oleh main agent** (bukan dikembalikan ke Prabowo, karena fix-nya trivial
dan sudah jelas — satu `now` dihitung sekali di awal method, dipakai ulang
untuk `resolvePostPerformancePeriodRange` DAN `getPostPerformance` current)
— diverifikasi ulang `typecheck`/`vitest` (426 pass/5 skip, tidak ada
regresi) setelah fix.

### Najwa QA Engineer

Golden path PASS (Overview regresi nol dibanding sebelum T-045, Reports
tab render benar, ganti period Mingguan↔Bulanan PASS di kedua tab tanpa
race condition, switch tab 0 network request baru, Export CSV isi cocok
1:1 dengan UI, dark/light mode + mobile 375px PASS). Empty state
`AccountComparisonContent` tidak bisa diverifikasi visual (data test selalu
punya ≥1 akun terhubung) — diverifikasi lewat baca kode saja, pola sama
`AccountOverviewContent`/`PostPerformanceContent` yang sudah terverifikasi
jalan di section lain halaman yang sama, risiko rendah.

**1 temuan gate T-103.3 (dibandingkan `templates/analyze-dashboard.html`):**
caption per-metrik "vs {nilai periode sebelumnya}" (pola `.stat-compare-sub`
mockup — tiap kolom stat punya baris kecil "vs X" sendiri) **hilang total**
di implementasi awal `ComparativeStatColumn` — bukan diadaptasi (beda dari
2 deviasi sadar lain yang sudah dikonfirmasi konsisten: ikon Hugeicons
pengganti unicode, label "vs periode sebelumnya" pengganti "bulan lalu"),
melainkan terlewat begitu saja; cuma ada satu caption generik di header tab
Reports, jauh dari tiap angka. Dampak: user lihat badge delta tanpa konteks
"dibanding apa" yang menempel langsung di angkanya. **Diperbaiki langsung
oleh main agent**: `ComparativeStatColumn` ditambah prop `previousLabel`,
caption "vs {nilai}" ditaruh di antara angka besar dan badge delta (urutan
sama mockup), null-safe sama pola field lain ("vs Belum ada data" saat
`previous === null`). Diverifikasi ulang lewat browser (screenshot: caption
"vs 3", "vs Belum ada data" tampil benar per kolom) setelah fix —
`typecheck`/`lint`/`vitest` tetap bersih (426 pass/5 skip).

### Verifikasi akhir keseluruhan task

`bun run typecheck` bersih, `bun run lint` bersih, `bun run test` **426
pass/5 skip** (42 file, +4 test case baru dari 422 sebelumnya, tidak ada
regresi). File yang diubah: `publishing.service.ts`,
`publishing.service.test.ts`, `analyze-actions.ts`, `page.tsx`,
`AnalyzeDashboard.tsx` (semua di `apps/web/`), plus dokumentasi
(`tasks/v03-analytics-mvp.md`, `TASKS.md`, `PROJECT_STATE.md`, entri ini).

### Status

T-045 **✅ Done, 3/3 subtask**. **Release v0.3 Analytics MVP TUNTAS 8/8
task** (T-040–T-047, breakdown berubah dari "🟡 7 ✅ · 1 ⏳" menjadi
"8 ✅"). Total task selesai project naik 48 → **49**.

---

## 2026-09-21 — T-045 Comparative Reports — design-prep Claude Design (belum implementasi kode)

T-045 (Comparative Reports, `tasks/v03-analytics-mvp.md`, rilis v0.3, Should
Have) diminta King Rezi ("check T-045 di claude design apakah sudah ada?
jika sudah tolong kerjakan langsung"). Dicek dulu sesuai gate rule 17
AGENTS.md — rancangannya **belum ada sama sekali** di Claude Design (tidak
ada file `templates/` untuk "Reports"/"Comparative" apa pun;
`templates/analyze-dashboard.html` cuma berisi Overview/Summary/Account
Overview/Post Performance/Engagement Summary dari T-043/T-044/T-046/T-047).
King Rezi lalu secara eksplisit minta dikerjakan langsung oleh main agent
(bukan didelegasikan ke Neymar Product Designer untuk task ini) — status
subtask T-045.1–T-045.3 **TETAP `⏳ Not Started`**, sesi ini murni design
prep di Claude Design, tidak ada perubahan kode `apps/web`.

### Dua fork keputusan (`AskUserQuestion`)

1. **IA placement** — 3 opsi diajukan (tab baru di halaman Analyze yang
   sama / halaman terpisah dengan nav item sendiri / section scroll-down
   tanpa tab). King Rezi memilih **tab baru "Reports" di halaman Analyze
   yang sama** — nav sidebar tetap satu item "Analyze".
2. **Pola switch tab** — dua pola shadcn/ui sama-sama valid secara teknis
   dan belum dikunci Claude Design untuk kasus ini: `Tabs`+`TabsList`+
   `TabsTrigger`+`TabsContent` asli vs reuse `.seg`/ToggleGroup (sudah ada
   di `components/forms.html`). King Rezi memilih **`Tabs` asli**, karena
   ini switch antar panel konten penuh, bukan filter/view-mode toggle.

### Temuan sampingan — gap dokumentasi lama

`.tabbar`/`.tab` (class CSS dengan komentar lama "Astryx: TabList") sudah
dipakai di `templates/publish-drafts.html`/`publish-calendar.html`/
`publish-queue.html`/`publish-history.html` sebagai tabbar navigasi RUTE
(`PublishTabbar.tsx` — `TabsTrigger asChild` membungkus `next/link` `Link`,
`value` disinkronkan ke `usePathname()`, TANPA `TabsContent`/state lokal)
tapi **belum pernah** punya baris di Components table `readme.md` —
gap lama, baru ditutup sesi ini bersamaan dengan menambahkan T-045 sebagai
pemakaian pertama `TabsContent` (client-side, state lokal beneran) di
project ini.

### Hasil implementasi Claude Design

`templates/analyze-dashboard.html` (`DesignSync`, project "Social Media
Management"): tab "Overview" (konten existing, TIDAK diubah sama sekali)
dan tab "Reports" (baru) — "Perbandingan Periode" (T-045.1, 3 angka Summary
row dibandingkan ke periode setara sebelumnya: 12→9 Total Posts +33%,
4.320→3.800 Total Reach +14%, 6,5%→7,1% Engagement Rate −0,6pt) dan
"Perbandingan Akun/Platform" (T-045.2, tabel reuse angka Reach per akun
dari Account Overview: Instagram 2.100→1.750 +20%, X 1.400→1.520 −8%,
Facebook 820→530 +55%) — delta reuse `.chip.chip-active`/`.chip.chip-failed`
yang sudah ada, **tanpa token warna baru**. Tombol "Export CSV" (T-045.3)
sengaja cuma satu format tanpa dropdown — task doc T-045.3 sendiri menulis
"format menunggu keputusan, CSV kandidat paling murah", jadi ini asumsi
minimal eksplisit, bukan keputusan format final. Semua angka tab Reports
dijaga konsisten dengan angka yang sudah dikunci di Overview; angka "bulan
lalu" murni mock pembanding, belum ada sumber data nyata.

Diverifikasi visual lewat local static preview server (mirroring struktur
relatif `templates/`+`styles.css` Claude Design) sebelum push — screenshot
light mode dan dark mode, klik switch Overview↔Reports, delta chip
hijau/merah tampil benar, angka konsisten dengan Overview. Diverifikasi
juga tidak ada drift remote sebelum push (`get_file` ulang tepat sebelum
`write_files`, sesuai `.claude/skills/claude-design-scope-discipline/SKILL.md`
poin 6) — remote identik dengan yang dibaca di awal sesi, aman push penuh.

`readme.md` diupdate: baris baru `.tabbar` + `.tab`(`.active`) di
Components table (mendokumentasikan kedua pola pemakaian, route nav dan
content switching) dan bullet `templates/analyze-dashboard.html` di section
Screens diperluas dengan ringkasan T-045.

### Status

Design prep T-045 selesai, menutup ambiguitas IA placement + pola tab
sebelum implementasi kode dimulai. Tidak ada perubahan kode `apps/web`.
Implementasi T-045.1–T-045.3 (Prabowo/Elon + Mark UI Engineer + Ridwan +
Najwa) menyusul terpisah, menunggu King Rezi.

---

## 2026-09-21 — T-044 Engagement summary (/analyze) — scope dipersempit via `AskUserQuestion`, ✅ Done (3/3 subtask)

T-044 (Engagement summary, `tasks/v03-analytics-mvp.md`, rilis v0.3) naik
status `🟡 In Progress` → `✅ Done` — seluruh 3/3 subtask tuntas, tapi
**scope yang diimplementasikan jauh lebih sempit** dari deskripsi task doc
asli (field **Domain: analytics**, **ADR: ADR-018**, "komentar masuk,
komentar dibalas, rasio respons" via public API domain `engagement`).

### Scope-narrowing (`AskUserQuestion`)

Sesuai rule 17 AGENTS.md, dicek dulu ke Claude Design sebelum implementasi
— `templates/analyze-dashboard.html` section "Engagement Summary" **TIDAK**
ditandai "SYNCED" (masih sketsa awal, bukan locked pattern), tapi
markup-nya cuma mengunci **2 angka sederhana**: "Komentar" dan "Likes".
King Rezi ditanya via `AskUserQuestion` dan memilih ikut Claude Design apa
adanya, bukan versi kompleks task doc asli.

### Implementasi (Prabowo Feature Engineer)

Method baru `PublishingService.getEngagementSummary(workspaceId, period,
userId)` + tipe `EngagementSummary { totalComments: number | null;
totalLikes: number | null }` di
`apps/web/src/domains/publishing/services/publishing.service.ts` — reuse
`getPostPerformance` (T-043), pola identik `getAnalyzeSummary` (T-047)/
`getAccountOverview` (T-046) untuk menghindari circular dependency
`analytics↔publishing` (pola sama solusi refactor T-043 putaran 1). Data
diambil dari field `likes`/`comments` `AnalyticsPostMetric` (Prisma, sudah
ada sejak T-041) — **tidak ada query Prisma baru**. Akumulasi null-safe:
`totalLikes`/`totalComments` adalah jumlah baris yang sudah ter-ingest
saja, `null` kalau tidak ada satupun baris berisi nilainya (bukan 0).
Server Action baru `getEngagementSummaryAction` di
`apps/web/src/app/(app)/analyze/analyze-actions.ts`, wiring `page.tsx`
(4 action dipanggil paralel via `Promise.all`). 4 test baru di
`publishing.service.test.ts` (describe `getEngagementSummary`).

**Konsekuensi penting yang TIDAK dipakai dari task doc asli:**

- **Tidak ada cross-domain edge ke domain `engagement`** — domain itu
  masih stub kosong total, baru dibangun v0.4. **ADR-018** (cross-domain
  lewat public API `engagement`) tidak dipakai untuk implementasi ini.
- **Field Domain task berubah dari `analytics` ke `publishing`** — method
  ini hidup di `PublishingService`, bukan `AnalyticsService`.
- **T-044 tidak lagi terikat v0.4** (Engagement MVP) — karena tidak butuh
  domain `engagement`, task ini tidak perlu menunggu comment sync nyata.

### Implementasi (Mark UI Engineer)

Card baru "Engagement Summary" di kolom kanan grid `.dash-cols`
(`lg:grid-cols-[1.6fr_1fr]`, akhirnya diaktifkan — sebelumnya sengaja
dirender full-width sementara sejak T-046 menunggu T-044, lihat komentar
REFLOW di kepala `AnalyzeDashboard.tsx`). 2 baris (Komentar, Likes) via
komponen baru `EngagementSummaryRow`, pola row sama persis
`AccountOverviewRowItem` (`flex justify-between`, `border-b border-border
py-2.5 last:border-b-0`) — idiom konsisten dengan section lain di file,
bukan pola baru. `EngagementSummaryContent` TANPA wrapper `Card` sendiri
(dibungkus `Card`/`CardContent` oleh caller, pola sama
`AccountOverviewContent`/`PostPerformanceContent`). Null-safety sama
persis pola T-043.4/T-046.3/T-047.3: `totalComments`/`totalLikes`
masing-masing independen render "Belum ada data" saat `null` (bukan 0);
card tetap tampil (2 baris "Belum ada data") kalau kedua field `null`.
Grid stack 1 kolom di layar sempit (`grid-cols-1`, breakpoint `lg`).

### Review Ridwan Architecture Reviewer

0 temuan — 0 kemunculan import `domains/engagement` di file yang berubah,
tidak ada query Prisma baru, tidak ada circular dependency baru, null-safety
konsisten pola T-043.4/T-046/T-047, `EngagementSummary` di
`publishing.service.ts` konsisten precedent `PostPerformanceRow`/
`AccountOverviewRow`/`AnalyzeSummary`.

### QA Najwa QA Engineer

PASS penuh: golden path, empty state "Belum ada data" (independen per
field), ganti period 4 action paralel tanpa race condition, regresi
Account Overview/Post Performance PASS, responsive mobile 375px PASS,
dark/light mode PASS. Gate T-103.3 (verifikasi struktur vs Claude Design)
PASS, dicek 2x independen (Mark manual + AI utama via `DesignSync`
langsung karena tool itu tidak termuat di sesi Najwa) — keduanya tidak
menemukan deviasi struktural dari `templates/analyze-dashboard.html`.

**Satu catatan non-blocking** (bukan bug): setelah grid 2 kolom diaktifkan,
tabel Post Performance di kartu kiri (sekarang `1.6fr`, sebelumnya
full-width) butuh scroll horizontal di lebar browser standar untuk melihat
kolom Reach/Eng. Rate — `Table` shadcn sudah handle via `overflow-x-auto`
bawaan, bukan defect, dicatat sebagai efek samping visual dari lock
proporsi grid `.dash-cols` di desain.

### Verifikasi akhir

`bun run typecheck` bersih, `bun run lint` bersih, `bun run test` **422
pass/5 skip** (naik dari 415/5 sebelum T-044, +7 test case baru).

### Perbaikan field task (drift, bukan pelanggaran baru)

Field task doc T-044 sebelumnya (**Domain: analytics**, **ADR: ADR-018**,
**Depends: T-041 · idealnya setelah v0.4**) sudah drift dari implementasi
sebenarnya — diperbaiki di `tasks/v03-analytics-mvp.md` menjadi **Domain:
publishing · UI**, ADR dihapus (dicatat alasannya di catatan Update task),
dan Depends tidak lagi menyebut v0.4. Deskripsi subtask T-044.1–T-044.3
ditulis ulang sebagai catatan "Update 2026-09-21" (histori keputusan asli
tetap dipertahankan via strikethrough, tidak dihapus).

### Dampak dokumentasi lain

- `TASKS.md` — breakdown v0.3 berubah dari "🟡 6 ✅ · 2 ⏳" menjadi
  **🟡 7 ✅ · 1 ⏳** (dihitung ulang langsung dari
  `tasks/v03-analytics-mvp.md`). Total task selesai naik 47 → **48**.
  Jumlah subtask total tidak berubah (221 — T-044 sudah terdefinisi 3
  subtask sebelumnya, dihitung ulang dan cocok).
- `PROJECT_STATE.md` — Snapshot § Top Next Tasks menambah ringkasan T-044
  di paling atas; § Completed (Ringkasan) menambah bullet T-044,
  menghapus bullet terlama (KI-059 Resolved) supaya tetap 5 item.

Detail lengkap: `tasks/v03-analytics-mvp.md` § T-044.

---

## 2026-09-18 — T-047 Summary row (/analyze) — implementasi kode selesai, ✅ Done (3/3 subtask)

T-047 (Summary row `/analyze`, `tasks/v03-analytics-mvp.md`, rilis v0.3)
naik status `🟡 In Progress` → `✅ Done` — seluruh 3/3 subtask tuntas. 3
stat card (Total Posts, Total Reach, Engagement Rate) di bagian atas
`/analyze`, di atas section Account Overview+Post Performance.

**T-047.1 (Prabowo Feature Engineer)** — Keputusan sumber data: reuse
`PublishingService.getPostPerformance` (**BUKAN**
`AnalyticsService.getDashboardSummary`), untuk menghindari circular
dependency `analytics↔publishing` (pola sama solusi refactor T-043 putaran
1). Method baru `PublishingService.getAnalyzeSummary(workspaceId, period,
userId)` + tipe `AnalyzeSummary` (`totalPosts`, `totalReach:
number|null`, `avgEngagementRate: number|null`) di
`apps/web/src/domains/publishing/services/publishing.service.ts`.
`totalPosts` dihitung FLAT per baris post×target-akun (bukan distinct post
count) — diverifikasi cocok persis dengan mock Claude Design ("Total Posts:
12" = penjumlahan `AccountOverviewRow.totalPosts` di section yang sama).
Server Action baru `getAnalyzeSummaryAction` di
`apps/web/src/app/(app)/analyze/analyze-actions.ts`, wiring `page.tsx`. 3
test baru di `publishing.service.test.ts`.

**T-047.2 + T-047.3 (Mark UI Engineer)** — UI 3 `StatTile` (diekstrak jadi
shared component baru `apps/web/src/app/(app)/components/stat-tile.tsx`,
dipakai ulang juga di `DashboardHome.tsx` yang sebelumnya punya definisi
lokal duplikat — pure extraction, tidak ada perubahan behavior Dashboard
Home). Empty state per-field (T-047.3): `totalPosts` selalu tampil angka
(termasuk "0"), `totalReach`/`avgEngagementRate` masing-masing independen
render "Belum ada data" saat `null` — pola SAMA T-043.4, BUKAN empty state
penuh 1 section (3 card selalu tampil).

Desain sudah dicek ke Claude Design SEBELUM implementasi (rule 17
AGENTS.md) — section `.summary-row` di `templates/analyze-dashboard.html`
sudah "SYNCED" (locked ke shadcn `Card`+`CardContent`+`Text`, pola sama
persis `StatTile` T-042.3 yang sudah ada), jadi TIDAK ADA gate
ambiguitas/`AskUserQuestion` yang perlu dipicu.

**Review Ridwan Architecture Reviewer:** 0 temuan (7 titik fokus dicek:
entry point bersih, domain logic tidak import Prisma/Supabase, keputusan
tidak pakai `ConnectedAccountsPort` di `getAnalyzeSummary` masuk akal,
tidak ada circular dependency baru, `AnalyzeSummary` di
`publishing.service.ts` konsisten precedent `PostPerformanceRow`/
`AccountOverviewRow`, `stat-tile.tsx` murni presentasional, formula
konsisten dengan `getAccountOverview`).

**QA Najwa QA Engineer:** 0 bug. `typecheck`/`lint` bersih, `vitest` **418
pass/5 skip** (naik dari 415, 3 test baru `getAnalyzeSummary`). Gate
T-103.3 (verifikasi struktur vs Claude Design) PASS — cocok 1:1, tidak ada
deviasi. Browser end-to-end: golden path PASS (Total Posts cocok dengan
penjumlahan Account Overview), ganti period PASS (3 action ter-refetch
bersamaan, guard out-of-order bekerja), null-safety PASS ("Belum ada data"
bukan 0/NaN/crash), regresi Account Overview+Post Performance PASS (sort
masih jalan, empty state masing-masing tidak berubah). Catatan
non-blocking (bukan Known Issue): 2 skenario (period tanpa post sama
sekali, campuran sebagian metrik ter-ingest) tidak bisa diverifikasi
visual di browser karena data dev saat ini tidak punya kombinasi itu —
sudah tercover unit test deterministik sebagai gantinya, bukan blocker.

Tidak ada ADR baru — keputusan sumber data T-047.1 adalah keputusan
implementasi biasa, konsisten precedent T-043/T-046 yang juga tidak butuh
ADR terpisah untuk keputusan serupa.

Detail: `tasks/v03-analytics-mvp.md` § T-047, `TASKS.md` (breakdown v0.3
"🟡 5 ✅ · 3 ⏳" → **🟡 6 ✅ · 2 ⏳**, task selesai 46 → **47**),
`PROJECT_STATE.md` (Snapshot + Completed Ringkasan).

---

## 2026-09-18 — T-046 Account Overview — implementasi kode selesai, ✅ Done (3/3 subtask)

T-046 (Account Overview, `tasks/v03-analytics-mvp.md`, rilis v0.3) naik
status `⏳ Not Started` → `✅ Done` — seluruh 3/3 subtask tuntas.

**T-046.1 (Prabowo Feature Engineer)** — Query agregasi Account Overview:
method baru `PublishingService.getAccountOverview(workspaceId, period,
userId)` di `apps/web/src/domains/publishing/services/publishing.service.ts`
— ditaruh di domain `publishing` (bukan `analytics`) untuk reuse
`getPostPerformance` (T-043) dan menghindari circular dependency (pola sama
seperti temuan review putaran 1 T-043). Port baru `ConnectedAccountsPort`
(arah `publishing→workspace`, sudah legal di `application-layer.md` baris
316). Server Action baru `getAccountOverviewAction(period)` di
`apps/web/src/app/(app)/analyze/analyze-actions.ts`. Kriteria "belum ada
data": akun tanpa post → `totalPosts: 0, totalReach: null`; akun dengan
post tapi metrik belum ter-ingest → `totalReach: null` juga (dibedakan dari
0 reach yang sah). 4 test baru di `publishing.service.test.ts` (describe
`getAccountOverview`).

**T-046.2/T-046.3 (Mark UI Engineer, 2 sesi)** — UI: section "Account
Overview" ditambahkan ke
`apps/web/src/app/(app)/analyze/components/AnalyzeDashboard.tsx`. Sesi 1
awalnya dibuat sebagai `Card` full-width sendiri (deviasi dari mockup,
karena Post Performance sudah full-width sejak T-043) — King Rezi ditanya
via `AskUserQuestion`, jawaban: "sesuaikan dengan Claude Design". Sesi 2
(reflow): `DesignSync get_file` ulang pada `templates/analyze-dashboard.html`
menemukan struktur sebenarnya — `.dash-cols` grid `1.6fr 1fr`: kartu kiri =
SATU `card.card-pad` berisi Account Overview + Post Performance BERSAMA
(bukan dua Card terpisah), kartu kanan = Engagement Summary (T-044, belum
dikerjakan). Direflow supaya Account Overview + Post Performance berbagi
satu `Card`/`CardContent`. Kolom kanan grid sengaja dirender full-width
sementara (bukan grid 2 kolom dengan placeholder) sampai T-044 dikerjakan —
King Rezi konfirmasi via `AskUserQuestion` ("Full-width sementara
(Recommended)"). Progress bar: `(row.totalReach / maxReach) * 100`,
`totalReach === null` → teks "Belum ada data" (bukan bar 0%).

**Review Ridwan Architecture Reviewer:** 0 temuan. Verifikasi: entry point
bersih, domain tidak import Prisma/Supabase langsung, `ConnectedAccountsPort`
(publishing→workspace) sudah legal di `application-layer.md` baris 316,
tidak ada circular dependency baru, kriteria null vs 0 konsisten di seluruh
layer, tidak ada gap dokumentasi baru (KI-064 yang sudah ada tetap untuk
`publishing→analytics`, tidak bertambah untuk `publishing→workspace` karena
arah itu memang sudah lama terdokumentasi).

**QA Najwa QA Engineer:** 0 temuan blocking. Golden path PASS semua (satu
Card yang sama, progress bar proporsional, selector period refetch paralel
kedua section, edge case akun-tanpa-post vs akun-dengan-post-tanpa-metrik
dibedakan benar, regresi Post Performance/Calendar Popover/History Detail
PASS, dark/light mode aman). Gate T-103.3 (DesignSync vs kode): **match**.
Satu catatan non-blocking (bukan bug): sort kolom "Akun" di Post Performance
pakai `localeCompare()` bawaan JS, "Insvire Demo" muncul sebelum
"@fake.ig.4806" karena urutan simbol "@" — tidak diperbaiki karena tidak
diminta.

**Verifikasi akhir:** `typecheck`/`lint` bersih, `bun run test` **415
pass/5 skip** (42 file, naik dari 411).

### File yang berubah

- `apps/web/src/domains/publishing/services/publishing.service.ts`,
  `publishing.service.test.ts`
- `apps/web/src/app/(app)/analyze/analyze-actions.ts`
- `apps/web/src/app/(app)/analyze/components/AnalyzeDashboard.tsx`
- `project-manager/tasks/v03-analytics-mvp.md` — T-046.1–T-046.3 dicentang,
  status task `⏳ Not Started` → `✅ Done (2026-09-18)`, ringkasan
  implementasi ditambahkan.
- `project-manager/TASKS.md` — breakdown v0.3 "🟡 4 ✅ · 4 ⏳" → **🟡 5 ✅ ·
  3 ⏳**, **Total** task selesai 45 → **46** (subtask total tidak berubah,
  221), entri Update baru di riwayat.
- `project-manager/PROJECT_STATE.md` — Snapshot **Top Next Tasks** dan
  section **Completed (Ringkasan)** diupdate (bullet T-046 ditambah di atas,
  bullet T-024.1/.2/.3 terlama dihapus supaya tetap 5 item).

---

## 2026-09-18 — T-046 (Account Overview) + T-047 (Summary row /analyze) ditambahkan ke backlog v0.3

Atas permintaan King Rezi, 2 task baru ditambahkan ke
`project-manager/tasks/v03-analytics-mvp.md`, status keduanya
`⏳ Not Started` (baru masuk backlog, belum mulai dikerjakan). Latar
belakang: saat implementasi T-043 (Post performance metrics, sesi
terpisah, sama tanggal), ditemukan bahwa mockup Claude Design
`templates/analyze-dashboard.html` (KSP-07) punya 2 section lain di
`/analyze` — Account Overview (bar performa per akun/platform) dan Summary
row (3 stat card) — yang secara eksplisit dikecualikan dari scope T-043
saat implementasi, tapi ternyata memang belum pernah dapat nomor task
manapun. Gap perencanaan murni, bukan technical debt dari bug.

### T-046 · Account Overview

Ringkasan performa per akun/platform di `/analyze` — jumlah post + total
reach per akun, direpresentasikan sebagai bar (pola `.bar-track`/`.bar-fill`
→ shadcn `Progress`, sudah dikunci sebagai pola valid di design-prep T-043,
lihat komentar "SYNCED" di `analyze-dashboard.html` — tidak perlu sesi
desain ulang). Depends: T-041, T-043. 3 subtask: query agregasi, UI bar,
empty state.

### T-047 · Summary row (/analyze)

3 stat card di bagian atas `/analyze` — Total Posts, Total Reach,
Engagement Rate untuk period yang dipilih. Depends: T-041, kemungkinan
reuse pola `AnalyticsService.getDashboardSummary` (T-042.2) tapi scoped
`/analyze` — keputusan reuse-vs-query-terpisah sengaja belum dikunci di
sini, ditentukan saat implementasi. 3 subtask: tentukan sumber data, UI 3
stat card (reuse `StatTile` dari `DashboardHome.tsx`), empty state.

### File yang diubah

- `project-manager/tasks/v03-analytics-mvp.md` — tambah section T-046 dan
  T-047 (di antara T-043 dan T-044), update catatan "T-046–T-049 sengaja
  dikosongkan" (sekarang tersisa T-048–T-049).
- `project-manager/TASKS.md` — baris indeks v0.3 (T-040–T-045 → T-040–T-047,
  6 → 8 task, "🟡 4 ✅ · 2 ⏳" → "🟡 4 ✅ · 4 ⏳"), footnote nomor kosong
  (§ Aturan ID), **Total** (87 → 89 task, 215 → 221 subtask, dihitung ulang
  langsung dari `tasks/v03-analytics-mvp.md`), entri Update baru di riwayat.
  Tidak menambah ke tabel **Fokus sekarang** — task baru status
  `⏳ Not Started` (baru ditambahkan ke backlog, bukan mulai dikerjakan).
- `PROJECT_STATE.md` — **tidak diubah** (tidak ada referensi T-046/T-047 di
  sana; phase/milestone/fokus terdekat tidak berubah oleh penambahan
  backlog murni ini).

---

## 2026-09-18 — T-043 Post performance metrics — implementasi kode selesai, ✅ Done (4/4 subtask)

Melanjutkan design-prep di bawah (sesi terpisah, sama tanggal). Implementasi
kode T-043.1–T-043.4 (rilis v0.3 Analytics MVP) selesai, lolos review
arsitektur (2 putaran) dan QA — T-043 sekarang **✅ Done**.

### Ringkasan implementasi

- **T-043.1** (Prabowo Feature Engineer) — Query performa post per akun.
  Awalnya dibangun sebagai `AnalyticsService.getPostPerformance` dengan port
  baru `PublishingHistoryPort` (arah analytics→publishing).
- **T-043.2** (Mark UI Engineer) — UI Table sortable di `/analyze`
  (`apps/web/src/app/(app)/analyze/page.tsx` +
  `components/AnalyzeDashboard.tsx`), 4 kolom Post/Akun/Reach/Eng. Rate,
  semua sortable, mengikuti pola shadcn `Table` yang sudah dikunci di
  Claude Design sesi design-prep (2026-09-18, lihat entri di bawah).
- **T-043.4** (gap ditemukan Mark, diperbaiki Prabowo) — kriteria "belum
  ada data" untuk baris tanpa metrik. Awalnya `getPostPerformance` skip
  post tanpa metrik sama sekali; diperbaiki supaya post tetap disertakan
  dengan `reach`/`engagementRate` bernilai nullable (bukan 0/di-skip).
- **T-043.3** (Prabowo + Mark) — Metrik ditampilkan di halaman detail post
  History (`HistoryDetail.tsx`), reuse `PostMetricsPort` yang sudah ada
  dari Calendar (T-033.1). Komponen `MetricTile` diekstrak jadi shared
  (`apps/web/src/app/(app)/components/post-metric-tile.tsx`), dipakai
  bersama Calendar Popover dan History Detail.

### Review arsitektur Ridwan Architecture Reviewer — 2 putaran

**Putaran 1** — 2 temuan:

1. **Kritis** — `PublishingHistoryPort` (arah analytics→publishing) yang
   baru dibuat T-043.1 menciptakan **circular dependency** dengan
   `PostMetricsPort` (arah publishing→analytics) yang sudah ada sejak
   T-033.1 — melanggar aturan `application-layer.md` ("tidak ada circular
   dependency antar BC").
2. **Moderate** — field `metrics` ditaruh langsung di `HistoryItemRecord`
   (level repository interface), seharusnya di interface turunan level
   service (pola `CalendarPostItem`), bukan mencampur concern repository.

King Rezi diberi `AskUserQuestion` dan memilih **refactor** (bukan mencatat
ADR baru yang menerima circular dependency). Prabowo Feature Engineer
memperbaiki:

- `getPostPerformance` dipindah dari `AnalyticsService` ke
  `PublishingService` — reuse `PostMetricsPort` yang sudah ada, dependency
  jadi satu arah `publishing→analytics`.
- `PostPerformanceRow` dipindah ke `publishing.service.ts`.
- `HistoryItemRecord.metrics` dihapus, diganti `HistoryDetailItem extends
  HistoryItemRecord` (pola sama `CalendarPostItem`) di
  `publishing.service.ts`.
- Rentang tanggal `period` dihitung independen
  (`apps/web/src/domains/publishing/services/post-performance-period-range.ts`,
  weekly = 7 hari / monthly = 30 hari), tidak lagi bergantung
  `AnalyticsWorkspaceSnapshot`.

**Putaran 2** — kedua temuan **TERTUTUP**, 0 temuan blocking baru. 2 catatan
non-blocking:

1. `application-layer.md` § Peta Dependency Antar Domain ternyata **belum
   pernah** mencantumkan panah `publishing→analytics` sejak T-033.1 — gap
   dokumentasi lama, bukan diperkenalkan sesi ini, baru ketahuan sekarang.
   Dicatat **KI-064** (`PROJECT_STATE.md`), belum ditambal.
2. `post-performance-period-range.ts` awalnya kurang test coverage untuk
   kasus "monthly"/edge case — ditutup Najwa (lihat di bawah).

### QA Najwa QA Engineer

0 temuan blocking. Golden path PASS semua: Table sortable, empty state
"Belum ada data" di Table dan History Detail, regresi Calendar Popover
setelah ekstraksi `post-metric-tile.tsx` PASS, dark/light mode aman.
Menambah test baru
`apps/web/src/domains/publishing/services/post-performance-period-range.test.ts`
(8 test), menutup catatan non-blocking (2) di atas.

Satu hal **tidak** bisa diverifikasi visual browser: metrik tersembunyi di
halaman detail post History untuk status `Failed` (tidak ada post `Failed`
di data dev saat verifikasi) — tervalidasi lewat unit test eksplisit saja,
dianggap aman secara desain tapi belum ada bukti visual browser nyata.

### Verifikasi akhir

`typecheck`/`lint` bersih, `bun run test` **411 pass/5 skip** (42 file).

### File yang berubah

- `apps/web/src/app/(app)/analyze/page.tsx`,
  `apps/web/src/app/(app)/analyze/analyze-actions.ts`,
  `apps/web/src/app/(app)/analyze/components/` (baru)
- `apps/web/src/app/(app)/components/post-metric-tile.tsx` (baru, shared)
- `apps/web/src/app/(app)/publish/calendar/components/CalendarPostPopover.tsx`
  (reuse `post-metric-tile.tsx`)
- `apps/web/src/app/(app)/publish/history/[postId]/components/HistoryDetail.tsx`,
  `apps/web/src/app/(app)/publish/history/[postId]/page.tsx`
- `apps/web/src/domains/analytics/services/analytics.service.ts`,
  `apps/web/src/domains/analytics/types.ts` (refactor keluar setelah
  review putaran 1)
- `apps/web/src/domains/publishing/index.ts`,
  `apps/web/src/domains/publishing/services/publishing.service.ts`,
  `apps/web/src/domains/publishing/services/publishing.service.test.ts`
- `apps/web/src/domains/publishing/services/post-performance-period-range.ts`
  (baru), `post-performance-period-range.test.ts` (baru)
- `project-manager/tasks/v03-analytics-mvp.md` § T-043 (status → ✅ Done)
- `project-manager/tasks/v02-publishing-mvp.md` § T-033.1/.8 (backlink KI-064)
- `project-manager/TASKS.md` (indeks v0.3, Total, Fokus sekarang — plus
  koreksi hitungan subtask total 217 → **215**, dihitung ulang langsung
  dari `tasks/vXX-*.md`, selisih pre-existing sebelum sesi ini)
- `project-manager/PROJECT_STATE.md` (Snapshot, Completed Ringkasan,
  KI-064 baru)

---

## 2026-09-18 — T-043 Design-prep: resync `analyze-dashboard.html` ke shadcn/ui (Claude Design)

Bukan implementasi kode. T-043 (Post performance metrics, rilis v0.3
Analytics MVP) dan seluruh subtask-nya (T-043.1–T-043.4) **tetap
`⏳ Not Started`** setelah sesi ini — pekerjaan murni desain/persiapan di
Claude Design sesuai gate rule 17 AGENTS.md, dijalankan sebelum implementasi
kode dimulai.

### Latar belakang

King Rezi meminta cek dulu apakah T-043 sudah punya rancangan di Claude
Design. Rancangan dasarnya (`templates/analyze-dashboard.html`, KSP-07 —
Analyze → Dashboard) sudah ada, tapi ditemukan 2 gap:

1. Section "Post Performance" masih pakai markup era Astryx lama
   (`.post-perf-row`, list biasa) — belum di-resync ke shadcn/ui seperti
   Drafts/Workspaces/Connected Accounts/Members yang sudah dikunci T-103.1
   (2026-09-10).
2. Ambigu terhadap literal T-043.2 ("tabel performa post, sortable") — dua
   pola shadcn sama-sama valid secara teknis (`Table` vs `Item`/`ItemGroup`)
   dan Claude Design belum mengunci pola konkretnya (tidak ada penanda
   "SYNCED"/"LOCKED PATTERN").

Sesuai rule 17 AGENTS.md (gate berhenti-dan-tanya untuk pola shadcn ambigu),
King Rezi ditanya lewat `AskUserQuestion`. Jawaban:

1. Post Performance pakai pola **`Table`** (kolom sortable) — bukan
   `Item`/`ItemGroup` list.
2. Resync **seluruh halaman** `analyze-dashboard.html` sekaligus (Account
   Overview, summary cards, Engagement Summary, Post Performance), bukan
   hanya Post Performance.

### Eksekusi

Awalnya dicoba delegasi ke Neymar Product Designer, tapi `DesignSync` gagal
dimuat di sesi subagent tersebut — keterbatasan teknis yang sudah tercatat
berulang di `.claude/agents/README.md`. King Rezi memberi izin eksplisit
untuk dikerjakan langsung di sesi utama via `DesignSync`.

- **`templates/analyze-dashboard.html`**:
  - Section "Post Performance": list `.post-perf-row` lama diganti jadi
    `<table class="table">` dengan struktur `TableHeader`, 4 kolom — **Post**
    (thumbnail+caption), **Akun**, **Reach**, **Eng. Rate**. Setiap header
    kolom punya tombol sort (`.th-sort` + ikon panah `.sort-icon`) sebagai
    affordance sort, dengan `aria-sort` per kolom (default: Reach descending).
  - Kolom dipilih hanya dari field yang benar-benar ada di model
    `AnalyticsPostMetric` (Prisma schema) — `platform`, `reach`,
    `engagementRate`, dst. Tidak ada field karangan.
  - Summary row (Total Posts/Reach/Engagement Rate) dan Account Overview (bar
    performa per platform) **tidak diubah strukturnya** — sudah valid
    memetakan ke `Card`+`Progress` shadcn nyata dari resync token KI-047
    Phase 1 sebelumnya. Engagement Summary juga tidak diubah.
  - Ditambahkan komentar inline "SYNCED (T-043 design prep, 2026-09-18)" yang
    mendokumentasikan seluruh keputusan pola + alasan langsung di file itu.
  - Verifikasi scope-discipline (`.claude/skills/claude-design-scope-discipline/SKILL.md`
    poin 6): `get_file` remote dibaca ulang setelah write, dikonfirmasi tidak
    ada bagian yang hilang/berubah tak diinginkan (sidebar, channels, nav,
    script theme-toggle tetap utuh).
- **`readme.md`** (Claude Design project "Social Media Management"): baris
  `.table` di tabel Components diperluas — mencantumkan
  `analyze-dashboard.html` sebagai SYNCED, menjelaskan bedanya dari pola
  Members/Drafts (pola Table DENGAN `TableHeader` + affordance sort baru,
  karena T-043.2 minta literal "sortable"), dan ditandai eksplisit sebagai
  **rujukan target** untuk `apps/web` — bukan sync dari kode nyata seperti 3
  file T-103.1 lain, karena kode T-043 sendiri belum diimplementasikan
  (masih `⏳ Not Started`).

### Yang TIDAK terjadi

- Tidak ada perubahan kode apa pun di `apps/web`.
- Status T-043 dan seluruh subtask-nya (T-043.1–T-043.4) **tidak berubah**,
  tetap `⏳ Not Started`.

### Dampak dokumentasi

- `tasks/v03-analytics-mvp.md` § T-043 — ditambah catatan "Design-prep T-043"
  merangkum keputusan pola + alasan (gaya penulisan sama seperti catatan
  "Implementasi T-042.1").
- Tidak ada entry KI baru — ini gap desain yang sudah ditutup di sesi yang
  sama, bukan bug/temuan open. Tidak ada perubahan di `PROJECT_STATE.md`
  (phase/milestone/fokus terdekat tidak berubah oleh pekerjaan design-prep
  ini).

---

## 2026-09-17 — T-027 Done (5/5 subtask): Job runner + Railway Cron, ADR-108, ADR-109

Implementasi Elon Backend Engineer → review arsitektur Ridwan Architecture
Reviewer (2 putaran) → QA end-to-end Najwa QA Engineer. Branch
`feature/t-027-job-runner-railway-cron` (working tree, belum di-commit —
menunggu izin eksplisit King Rezi).

### Implementasi (5/5 subtask)

- **T-027.1** Job runner generik —
  `apps/web/src/lib/jobs/{background-job-store,backoff,job-runner,job-scheduler}.ts`:
  klaim job via `SELECT FOR UPDATE SKIP LOCKED` (pola sama ADR-099/T-026),
  registry handler per job type (bukan hardcode 1 tipe).
- **T-027.2** Autentikasi `X-Job-Secret` di `POST /api/jobs/run` (`JOB_SECRET`
  yang sudah ada di env sejak awal, sebelumnya nol referensi di kode).
- **T-027.3** Retry backoff 5m/15m/60m + dead-letter (status `failed` di
  tabel `BackgroundJob` yang sama).
- **T-027.4** Railway Cron config-as-code — `railway.json` (service `web`),
  `railway.cron.json` (service `cron`), `scripts/trigger-job-run.ts`.
  Provisioning aktual Railway project untuk cron masih blocked (**KI-025**)
  — ini baru config-as-code, belum ada service `cron` sungguhan live.
- **T-027.5** Job handler baru `ResolveScheduledPostOutcomeJobHandler`
  (`apps/web/src/domains/publishing/services/resolve-scheduled-post-outcome-job-handler.ts`)
  — dipicu `SchedulePostsUseCase` saat post terjadwal sudah due, meng-enqueue
  job type baru `publishing.scheduled_post.resolve_outcome` (**JOB-07**) via
  port baru `IJobScheduler`, lalu reuse `OutstandWebhookProcessor.resolvePostOutcome`
  (di-extract dari method private T-026 jadi public).

### 2 ADR baru (keputusan desain material)

- **ADR-108** — Redesain kontrak `IOutstandAdapter.fetchPostOutcome`:
  `fetchPostOutcome(outstandPostId)` → `fetchPostOutcome(outstandPostId,
  expectedOutstandAccountIds: string[])`. Root cause bug ditemukan QA Najwa:
  `FakeOutstandAdapter` (ADR-059) sebelumnya mengandalkan `Map` in-memory
  level-modul untuk mengingat target akun dari panggilan `schedulePost`
  sebelumnya — valid untuk `PublishNowUseCase` (1 request yang sama), tapi
  rusak untuk T-027.5 karena `schedulePost` (Server Action) dan
  `fetchPostOutcome` (job, dari Route Handler `/api/jobs/run` terpisah)
  dibundle Next.js jadi module chunk terpisah dengan instance `Map`
  masing-masing — dikonfirmasi Elon Backend Engineer nyata di production
  build (`.next/server`), bukan artefak dev/Turbopack. King Rezi memilih
  root-cause fix (bukan band-aid `globalThis`) lewat `AskUserQuestion`.
  `FakeOutstandAdapter` sekarang pure function tanpa state sama sekali. 3
  call site diupdate (`PublishNowUseCase`, `RetryFailedTargetUseCase`,
  `OutstandWebhookProcessor.resolvePostOutcome`); domain `analytics`
  dikonfirmasi tidak terdampak. Detail:
  `decisions/ADR-108-redesain-fetchpostoutcome-expected-account-ids.md`.
- **ADR-109** — Method baru `IPublishingRepository.markPostPublished`. Gap
  pre-existing sejak T-026 (`✅ Done`): `PublishingPost.status` tidak pernah
  ditransisikan ke `Published` walau semua target sudah resolved sukses —
  hanya status per-target yang ter-update. Method baru (simetris
  `markPostFailed`, idempoten via `updateMany` guard status `Scheduled`,
  tidak throw kalau 0 baris) dipanggil di
  `OutstandWebhookProcessor.resolvePostOutcome` saat semua target resolved
  dan tidak semua gagal, konsisten `integration-layer.md`. Bug-fix yang
  melengkapi T-026, bukan reopen task; `PublishNowUseCase` tidak disentuh.
  Detail: `decisions/ADR-109-markpostpublished-post-level-status-transition.md`.

### Baseline (Static Reference) diperbarui — perubahan struktural

- `product-discovery/05-architecture/background-jobs.md` — entry baru
  **JOB-07 — Resolve Scheduled Post Outcome** ditambahkan ke § Job Type
  Registry (trigger, tipe, payload, handler, retry), atas rekomendasi
  eksplisit Ridwan Architecture Reviewer supaya job type baru ini tidak
  hanya ada di kode tanpa tercatat di baseline.
- `product-discovery/05-architecture/integration-layer.md` — 3 mention
  signature `fetchPostOutcome(outstandPostId)` diupdate jadi
  `fetchPostOutcome(outstandPostId, expectedOutstandAccountIds)` mengikuti
  ADR-108, supaya baseline tidak silently diverge dari kontrak aktual.

### Known Issues baru

- **KI-062** (Open) — `background-jobs.md` self-contradictory soal formula
  backoff: tabel bilang 5m/15m/60m (konsisten BG-D04 & kode), formula
  tertulis `5 * 2^(attempts-1)` menghasilkan 5/10/20 menit. Kode benar,
  dokumentasi baseline perlu dikoreksi — sengaja tidak diperbaiki sesi ini.
- **KI-063** (Open, minor) — `PublishingPost.publishedAt` tidak diisi oleh
  `markPostPublished` maupun `markPostFailed` (pola lama, bukan regresi).
  UI sudah fallback (`item.publishedAt ?? item.updatedAt`), non-blocking.

### Verifikasi

`bunx tsc --noEmit` bersih, `eslint .` bersih, `prettier --check` bersih,
`vitest run` **396 pass / 5 skip**. Review Ridwan Architecture Reviewer 2
putaran (putaran 1: 1 bug correctness diperbaiki; putaran 2: fokus
ADR-108/ADR-109, 0 temuan). QA Najwa QA Engineer end-to-end (browser real +
`curl` manual simulasi Railway Cron): golden path Schedule → job runner →
History Published, diulang 2x konsisten; regresi Publish Now dan Retry
manual (T-034.4) keduanya PASS.

### Dokumentasi diperbarui (governance)

- `tasks/v02-publishing-mvp.md` § T-027 (status `🟡` → `✅ Done`, checklist
  5/5, catatan implementasi + 2 ADR + gap) dan § T-026 (catatan tambahan
  soal ADR-108/109 + koreksi prediksi enqueue+async yang belum terealisasi).
- `TASKS.md` — indeks v0.2 (17 ✅ · 2 🟡 · 4 ⏳ → 18 ✅ · 1 🟡 · 4 ⏳), Total
  (43 → 44 selesai, 217 subtask tidak berubah), baris Fokus sekarang T-027,
  update log baru, catatan rantai blocker terbesar disederhanakan.
- `DECISIONS.md` — 2 baris ADR baru (ADR-108, ADR-109) di atas tabel.
- `PROJECT_STATE.md` — Snapshot (Top Next Tasks, Blocker), Known Issues
  (KI-062, KI-063 baru; KI-003 dicatat T-026/T-027 tidak lagi terhambat),
  Blockers (baris KI-003 diperbarui), Completed (Ringkasan) — bullet T-027
  baru ditambah, bullet T-092 (terlama) dihapus supaya tetap 5 item, Recent
  Decisions (Ringkasan) — ADR-108/109 ditambah, ADR-104/103 (terlama)
  dihapus supaya tetap 5 item. Metadata Version 1.0.81 → 1.0.82.

---

## 2026-09-16 — Audit konsistensi dokumentasi (redundansi instruksi AI)

Dijalankan lewat skill `docs-consistency-audit`, scope `all`, atas permintaan
eksplisit King Rezi: cari instruksi/aturan yang ditulis ulang (bermakna sama)
di lebih dari satu dokumen internal — termasuk di dalam `AGENTS.md` sendiri —
supaya AI tidak membaca hal yang sama dua kali di awal sesi, dan usulkan
hierarki bacaan (AGENTS.md = satu-satunya tempat teks aturan lengkap; dokumen
turunan cukup pointer). Report-only dulu, baru dieksekusi setelah dikonfirmasi
King Rezi ("rapikan semua temuan mekanis sekarang").

### Fixed

- **5 hard rules layer (AGENTS.md rules 5-9)** yang sebelumnya disalin ulang
  verbatim di 4 dokumen turunan — diganti jadi pointer 1 baris ke
  `AGENTS.md`, teks lengkap tidak lagi diduplikasi:
  - [`ARCHITECTURE_OVERVIEW.md`](ARCHITECTURE_OVERVIEW.md) § "Aturan layer
    (untuk label di Figma)" — 5 poin penuh → 1 paragraf pointer.
  - [`context/ctx-architecture.md`](../context/ctx-architecture.md) "Aturan
    operasional" poin 1 & 3 (entry point, Supabase JS) → digabung jadi 1
    poin pointer; list direnumber 1-7 (dari 1-8).
  - [`context/ctx-domain.md`](../context/ctx-domain.md) "Aturan operasional
    (domain)" poin 1, 2, 4 (shared types, cross-domain, domain-tanpa-Prisma)
    → digabung jadi 1 poin pointer; list direnumber 1-7 (dari 1-9).
  - [`context/ctx-implementation.md`](../context/ctx-implementation.md)
    "Aturan operasional" poin 1, 3, 5, 7 (entry point, domain logic,
    cross-domain, shared types) → digabung jadi 1 poin pointer; list
    direnumber 1-8 (dari 1-11).
- **Duplikasi internal di `AGENTS.md`** — paragraf di section "Subagent
  kerja" yang menjelaskan ulang isi poin #3 "Wajib di awal sesi" dipangkas
  jadi pointer + konteks "kenapa" (ADR-063) saja, tanpa restate aturannya.
- **`context/ctx-project.md`** poin 3 (evaluasi delegasi subagent) diringkas
  jadi pointer ke `AGENTS.md` poin 3, alih-alih menjelaskan ulang aturan yang
  sama.
- **Referensi usang** — [`DEVELOPER_WORKFLOW.md`](DEVELOPER_WORKFLOW.md)
  flowchart node yang menyebut `apps/web/.claude/CLAUDE.md` sebagai "agent
  docs resmi **Astryx**" dikoreksi jadi "agent docs resmi **shadcn/ui**"
  (dokumen itu sudah 100% tentang shadcn sejak ADR-097/T-095.3).
- **`apps/web/.claude/CLAUDE.md`** — satu kalimat basi yang bilang migrasi
  Astryx→shadcn masih "incremental, coexist" dikoreksi jadi mencerminkan
  status nyata: migrasi **tuntas** (T-102 ✅ Done, 2026-09-04, 0 import
  `@astryxdesign/*` aktif — dicek langsung lewat grep ke `apps/web/src`).

### Fixed (lanjutan, 2026-09-16 — izin eksplisit King Rezi)

- **`.claude/agents/mark-ui-engineer.md`** (Static Reference, chmod 444) —
  `chmod 644` → edit → `chmod 444` lagi. Kontradiksi status migrasi
  dikoreksi di 5 tempat (frontmatter `description`, paragraf pembuka,
  poin "Wajib dibaca" #4, 2 baris di "Aturan keras"): sebelumnya bilang
  migrasi Astryx→shadcn "berjalan incremental per route-segment" / "Astryx
  & shadcn boleh coexist sementara" — dikoreksi jadi **tuntas 100%** (ADR-097,
  rilis v0.7, T-102 ✅ Done, 2026-09-04, 0 import `@astryxdesign/*` aktif —
  dicek ulang lewat grep ke `apps/web/src`). Sekaligus dikoreksi klaim
  `react-icons` "era Astryx, coexist untuk kode belum migrasi" (baris Icon di
  "Aturan keras") — dicek ke `platform-icons.tsx`: itu bukan sisa migrasi,
  melainkan keputusan sadar **ADR-058 poin 6/10** (ikon brand platform sosial,
  Lucide/hugeicons tidak menyediakan logo bermerek dagang).

### Fixed (lanjutan, 2026-09-17 — keputusan eksplisit King Rezi)

- **`project-manager/PROJECT_RULES.md`** section "AI Collaboration Rules" (5
  bullet generik: baca dokumentasi dulu, tidak boleh ubah arsitektur/business
  rules tanpa ADR, jaga konsistensi struktur, patuh klasifikasi dokumen) —
  King Rezi memutuskan **dipangkas jadi pointer** ke `AGENTS.md` (rule 4,
  rule 17, section "Aturan keras"), konsisten dengan pola yang sudah
  dieksekusi di file lain sesi ini. Section "Documentation Governance" di
  bawahnya tetap dipertahankan utuh (bukan duplikasi — itu detail klasifikasi
  dokumen, bukan aturan kolaborasi AI).

### Fixed (lanjutan, 2026-09-17 — temuan minor dari self-review PR #124)

- **`project-manager/PROJECT_RULES.md`** § "AI Collaboration Rules" — sitasi
  "rule 17" yang longgar (rule 17 sebenarnya spesifik gate Claude Design,
  bukan "jaga konsistensi struktur") diganti jadi pointer per-klausa yang
  presisi: baca dokumentasi dulu → section "Wajib di awal sesi", ubah
  baseline tanpa ADR → rule 4, konsistensi struktur → section "Aturan keras".
  "Patuh klasifikasi dokumen" dikoreksi jadi pointer ke section **Document
  Type Classification** di file yang sama (bukan ke AGENTS.md), karena aturan
  itu memang didefinisikan di sini, bukan di AGENTS.md.

### Belum dieksekusi

- Duplikasi persona kanonikal (Raka/Maya/Sinta/Dimas/Lara, 4 tempat) dan
  checklist "setelah mengubah sesuatu" di `ctx-development.md`/
  `project-os-navigator` SKILL.md — sengaja tidak disentuh, dampak token
  kecil (1 baris) dan berisiko mengurangi kegunaan checklist yang memang
  didesain self-contained per mode.

## 2026-09-15 — KI-061 baru — Tidak ada warning UI saat media over-limit setelah ganti target akun/format

Ditemukan lewat diskusi dengan King Rezi (murni analisis kode/tanya-jawab,
tidak ada perubahan kode sesi ini). Pertanyaan awal: berapa media yang bisa
dipost kalau target ke banyak platform sekaligus (jawaban: batas efektif =
MINIMUM dari `MAX_MEDIA_COUNT_BY_FORMAT` semua format yang dipilih, ADR-107
— mis. Instagram Post + Pinterest Pin sekaligus → batas turun jadi 1 media).
Pertanyaan lanjutan: apa yang terjadi kalau user sudah upload >1 media lalu
BARU menambah akun dengan format lebih ketat (mis. Pinterest)?

**Ditelusuri ke kode (`Modal.tsx`):**

- `toggleAccount` (baris ~420-430) tidak melakukan validasi apa pun
  terhadap `mediaItems` yang sudah ada saat akun/format berubah.
- `effectiveMaxMedia` (`maxMediaCountForFormats(getActiveFormats())`)
  otomatis turun, teks "Maks. X media" di bawah dropzone ikut berubah
  (pasif), dan dropzone jadi disabled untuk upload baru
  (`isMediaLimitReached`).
- **Tidak ada highlight/badge/pesan apa pun** pada thumbnail media yang
  sudah ada dan sekarang melebihi batas baru — user tidak tahu ada masalah
  sampai mencoba Save as Draft/Schedule/Publish Now dan mendapat error dari
  server (`assertMediaCountWithinLimit`, dilempar dari
  `content-format-matrix.ts`, ditangkap di `catch` block Modal.tsx sebagai
  `notice` status error): *"Jumlah media (N) melebihi batas maksimum X
  untuk format yang sedang dipilih."*

**Keputusan King Rezi:** dicatat sebagai Known Issue baru (**KI-061**),
tidak diperbaiki sesi ini — perlu cek Claude Design dulu sebelum menulis
kode UI perbaikan (rule 17 AGENTS.md), karena ini menyentuh
screen/komponen visual Draft Editor. Detail: `PROJECT_STATE.md` § KI-061.

---

## 2026-09-15 — KI-059 Resolved — Verifikasi manual browser end-to-end T-024 (Media upload)

Sesi verifikasi murni (tidak ada perubahan kode produk), dijalankan di
worktree `staging-checkout-tasks-976e14` setelah `DATABASE_URL` tersedia
(env `.env.local` worktree ternyata sudah lengkap — root cause KI-059
sebelumnya adalah dev server sempat start dari `cwd` repo `main` yang salah,
bukan benar-benar env var hilang; setelah dev server dijalankan manual
dengan `cwd` worktree yang tepat, `DATABASE_URL` terbaca normal).

**Seluruh 6 kriteria verifikasi KI-059 PASS:**

1. **Upload media** — drop 1 file PNG ke dropzone custom (T-024.4) →
   `uploadMediaAction` sukses, response berisi signed URL Supabase Storage
   asli (`.../storage/v1/object/sign/media/...`) dan `MediaItem.id` baru.
2. **Save as Draft** — draft tersimpan, muncul di list Drafts.
3. **Reopen edit** — draft dibuka ulang lewat `Modal.tsx` mode edit.
4. **Preview restore** — thumbnail media ter-restore benar dari signed URL
   (diverifikasi `naturalWidth` gambar cocok dengan file asli yang diupload,
   bukan broken image).
5. **Validasi batas count** — upload sampai 10 media (batas `Post` per
   ADR-107) sukses, dropzone otomatis `aria-disabled=true` setelah limit
   tercapai, file ke-11 ditolak (tetap 10 item, tidak bertambah).
6. **Hapus permanen** — klik hapus salah satu media (`ki059-test-10.png`) →
   dialog konfirmasi Tier 2 muncul ("Hapus media ini secara permanen?") →
   konfirmasi → toast "Media berhasil dihapus". **Diverifikasi langsung di
   level database** (query `mediaItem.findMany` lewat `withCurrentUser`
   dengan `userId` persona Raka Pratama, untuk melewati RLS
   `app.current_user_id`): 9 record tersisa (`ki059-test-1` s/d `9`),
   `ki059-test-10` benar-benar hilang dari tabel `media_items` — bukan
   sekadar dihapus dari state UI.

**KI-059 → Resolved.** T-024 (5/5 subtask) sekarang **teruji penuh
end-to-end**, bukan cuma verifikasi kode. Detail lengkap di
`tasks/v02-publishing-mvp.md` § T-024.

**KI-060 baru ditemukan (di luar scope T-024, bukan regresi T-024):**
saat reopen edit draft, **Account Selector tidak ter-restore** — seluruh
checkbox akun kembali unchecked meski draft punya target akun tersimpan
(caption dan media ter-restore benar, akun tidak). Root cause: efek
`getDraftAction` di `Modal.tsx` (baris ~296-314) hanya men-set
`caption`/`status`/`mediaItems` dari draft yang dimuat, tidak pernah
men-set `selectedAccountIds`/`formatByAccount` — gap ini sudah ada sejak
awal implementasi Draft Editor (bukan diperkenalkan oleh perubahan T-024
manapun, yang hanya menyentuh state `mediaItems`). Dicatat sebagai Known
Issue baru, **tidak diperbaiki sesi ini** (di luar scope permintaan
verifikasi KI-059).

## 2026-09-14 — T-024 Done (5/5 subtask) — Delete Media + dialog konfirmasi Tier 2 (ADR-049), menutup seluruh rangkaian T-024

Branch `claude/t-024-feasibility-e16b39` (worktree terpisah). Belum
di-commit/push sesi ini. Ini adalah **T-024.5**, subtask **terakhir** dari
task T-024 (Media upload di Draft Editor) — dengan tuntasnya subtask ini,
T-024 naik status dari `🟡 In Progress (4/5)` ke **`✅ Done (5/5)`**.

**Keputusan dikonfirmasi King Rezi via `AskUserQuestion`:** tombol "hapus
dari post ini" yang dibangun di T-024.4 (unlink-only dari draft, tanpa
dialog konfirmasi, tidak menghapus data apapun) diganti **total** jadi aksi
destruktif mengikuti pola Tier 2 (ADR-049) — klik → dialog konfirmasi →
kalau dikonfirmasi, hapus file di Supabase Storage + record `MediaItem` di
DB secara **permanen** (bukan lagi sekadar unlink dari post).

**Implementasi (Prabowo Feature Engineer):**

- `DeleteMediaUseCase` baru
  (`apps/web/src/domains/media/services/delete-media.use-case.ts`) — urutan
  operasi: hapus record DB dulu lewat `MediaService.deleteMediaItem`
  (throws `NotFoundError` kalau media tidak ada/bukan milik workspace,
  Storage tidak disentuh kalau langkah ini gagal), baru best-effort hapus
  file Storage (swallow error — orphan file tanpa record dianggap harmless
  dibanding record menunjuk file yang hilang/broken).
- Server Action baru `deleteMediaAction` — wiring tipis ke use case,
  `workspaceId` diambil dari session (anti-IDOR, bukan input dari client).
- UI `Modal.tsx` — `handleRemoveMedia` lama (unlink) dihapus total, diganti
  reuse komponen existing `ConfirmActionDialog`/`useConfirmAction` (pola
  sama persis "Hapus Draft" di `DraftsList.tsx`, bukan dialog baru dari nol).

**Review Ridwan Architecture Reviewer: 0 temuan** — urutan operasi delete
(DB dulu, Storage best-effort) diverifikasi benar di kode+test, anti-IDOR
terjaga (workspace-scoped di level repository, konsisten pola T-024.1),
reuse komponen Tier 2 genuine dikonfirmasi (bukan duplikat), tidak ada dead
code path lama yang tersisa.

**Verifikasi akhir T-024.5:** `bun run typecheck` 0 error, `bun run --cwd
apps/web lint` 0 error/warning, `bunx vitest run` **377 pass/5 skip** (naik
dari baseline 374, +3 test baru).

**Gap tetap sama:** verifikasi manual browser end-to-end tidak bisa
dilakukan di worktree ini (`DATABASE_URL` tidak tersedia) — sama seperti
gap T-024.4 sebelumnya. **KI-059** cakupannya diperluas untuk mencakup
seluruh T-024 (bukan cuma T-024.4), belum Resolved.

**Ringkasan penutup T-024 (5/5 subtask, ✅ Done) — dikerjakan lintas
beberapa sesi:**

1. **T-024.1** — Domain `media` skeleton (`MediaService`/`IMediaRepository`,
   implementasi Prisma, `MediaType`/`asMediaId` di `packages/shared`).
2. **T-024.2** — Upload ke Supabase Storage (`IMediaStorageAdapter`,
   `UploadMediaUseCase`, `SupabaseMediaStorageAdapter`, bucket `media`
   Private + signed URL, batas ukuran 50MB dikonfirmasi King Rezi).
3. **T-024.3** — `OutstandAdapter` media upload working copy via
   `FakeOutstandAdapter` (kontrak `uploadMediaWorkingCopy` 1-method
   gabungan, **ADR-106**).
4. **T-024.4** — Aktifkan kontrol lampiran + preview di Draft Editor,
   Draft Editor jadi mendukung multi-media (carousel), batas jumlah per
   `ContentFormat` (**ADR-107**, amandemen ADR-039).
5. **T-024.5** — Delete Media permanen + dialog konfirmasi Tier 2
   (ADR-049), di atas.

Seluruh 5 subtask lolos review Ridwan Architecture Reviewer; satu-satunya
temuan sepanjang task ini adalah 1 temuan MEDIUM di T-024.4 (partial-update
semantics `mediaIds`), sudah diperbaiki dan diverifikasi ulang (putaran 2:
0 temuan). Verifikasi kode akhir keseluruhan task: `typecheck`/`lint`
bersih, `vitest` 377 pass/5 skip (naik dari baseline 338 saat T-024.1
selesai). Satu-satunya gap tersisa: verifikasi manual browser end-to-end
(**KI-059**, masih Open) — belum bisa dilakukan di environment kerja
manapun sesi-sesi ini karena `DATABASE_URL` tidak tersedia, perlu
ditindaklanjuti King Rezi atau QA Najwa di environment dengan akses DB
sebelum T-024 dianggap teruji penuh end-to-end.

Referensi lengkap: `tasks/v02-publishing-mvp.md` § T-024,
`decisions/ADR-106-fake-media-upload-working-copy-1-method-gabungan.md`,
`decisions/ADR-107-batas-maksimum-jumlah-media-per-content-format.md`.

---

## 2026-09-14 — T-024.4 Done (4/5 subtask) — Kontrol lampiran media di Draft Editor + preview, carousel multi-format, ADR-107

Branch `claude/t-024-feasibility-e16b39` (worktree terpisah). Belum
di-commit/push sesi ini. Lanjutan T-024.1/.2/.3 (skeleton domain `media` +
upload Supabase Storage + Fake OutstandAdapter working copy, sudah tercatat
entri di bawah).

**Keputusan baru dikonfirmasi King Rezi via `AskUserQuestion`:** Draft Editor
mendukung **multi-media (carousel)**, batas jumlah TERGANTUNG `ContentFormat`
(bukan flat number):

- `Post` → maks **10** media (carousel)
- `Reel`/`Story`/`Pin` → maks **1**
- Kalau draft target beberapa akun dengan format berbeda sekaligus (mis. IG
  Reel + FB Story), batas efektif = **MINIMUM** dari max-count semua format
  yang dipilih.

Ini mengamandemen ADR-039 (content format matrix) → **ADR-107 baru**
(`decisions/ADR-107-batas-maksimum-jumlah-media-per-content-format.md`,
status ADR-039 diberi tag `Accepted — Amended by ADR-107 (2026-09-14)`
bersamaan, baris `DECISIONS.md` untuk keduanya sudah disinkronkan).

**Implementasi (Prabowo Feature Engineer, full-stack Server Action → service
→ repository → UI):**

- `content-format-matrix.ts` — `MAX_MEDIA_COUNT_BY_FORMAT`,
  `maxMediaCountForFormat(s)`, `assertMediaCountWithinLimit` (ADR-107).
- `resolve-draft-media-ids.ts` (baru) — validasi ownership `mediaIds`
  (workspace-scoped, anti-IDOR), pola sama `resolveScheduleTargets`.
- `PublishingService.saveDraft`/`updateDraft` + `IPublishingRepository`/
  implementasi Prisma — kolom `media_ids` (sebelumnya dead sejak schema
  dibuat) sekarang di-wire penuh, dengan partial-update semantics
  (`mediaIds: undefined` = kolom tidak disentuh, `[]` = kolom dikosongkan).
- `MediaService`/`IMediaRepository` — method baru `findByIds`/`listByIds`
  (batch fetch, workspace-scoped).
- Server Action baru `uploadMediaAction`
  (`apps/web/src/app/(app)/components/draft-editor/actions.ts`) — pertama
  kalinya domain `media` (T-024.1–.3) benar-benar disambungkan ke UI.
  `saveDraftAction`/`updateDraftAction`/`getDraftAction`/`scheduleDraftAction`/
  `publishNowAction` diperluas dengan `mediaIds`.
- UI (`Modal.tsx`) — blok Media disabled diganti custom dropzone (drag-drop +
  click-browse), grid preview thumbnail multi-media, tombol hapus-per-item
  (unlink dari draft, **bukan** delete permanent — itu tetap T-024.5, out of
  scope). "Pilih dari Media Library" ditampilkan sebagai link **disabled
  dengan tooltip "Coming soon"** (bukan disembunyikan total) — DITUNDA
  sesuai keputusan sebelumnya, belum dibangun fiturnya.

**Review (Ridwan Architecture Reviewer, 2 putaran):**

- Putaran 1: **1 temuan MEDIUM** — `resolveAndValidateMediaIds` dkk selalu
  meng-collapse "field tidak dikirim" jadi `[]` (`?? []`), sehingga
  partial-update semantics yang didesain (`undefined` = kolom tidak
  disentuh) tidak pernah benar-benar tereksekusi dari caller yang ada —
  berisiko silent data loss untuk entry point masa depan (mis. Route
  Handler `/api/v1` yang tidak kirim `mediaIds`). Bukan bug aktif hari ini
  (satu-satunya caller, `Modal.tsx`, selalu kirim array konkret), tapi
  berisiko kalau ada caller baru meniru pola ini.
- Prabowo memperbaiki: bedakan `undefined` (field benar-benar tidak
  dikirim) vs `[]` (eksplisit dikosongkan) dari titik paling awal
  (`resolveAndValidateMediaIds` dan resolusi di `scheduleDraftAction`/
  `publishNowAction`) sampai ke `PublishingService`. 12 unit test baru
  menguji 3 skenario di 4 Server Action.
- Putaran 2 (verifikasi ulang): **0 temuan**, fix dikonfirmasi benar di
  level kode (bukan cuma percaya laporan), `Modal.tsx` tidak berubah/tidak
  regresi.

**Verifikasi akhir:** `bun run typecheck` 0 error, `bun run --cwd apps/web
lint` 0 error/warning, `bunx vitest run` **374 pass/5 skip** (naik dari
baseline 362, sebelumnya 346 sebelum T-024.4 mulai).

**Gap verifikasi manual browser (belum ditutup, KI-059 baru):** verifikasi
end-to-end nyata (upload → save draft → reopen edit → preview restore →
validasi batas count per format) **tidak bisa dilakukan** sesi ini — dev
server gagal start di worktree ini karena `DATABASE_URL` tidak tersedia
(perlu kredensial Supabase). Dicatat sebagai Known Issue baru **KI-059**
(`PROJECT_STATE.md`), menunggu King Rezi/environment dengan akses DB untuk
smoke test sebelum T-024 dianggap teruji penuh end-to-end.

**Status:** T-024 `🟡 In Progress (4/5 subtask)` — sisa T-024.5 (delete
media + dialog konfirmasi). Belum ada commit/push sesi ini (T-024.1/.2
sudah di-PR #122, T-024.3 sudah commit terpisah `2062d85` tapi belum PR
baru). Detail: `tasks/v02-publishing-mvp.md` § T-024,
`decisions/ADR-107-batas-maksimum-jumlah-media-per-content-format.md`.

---

## 2026-09-14 — T-024.3 Done (3/5 subtask) — Fake OutstandAdapter media upload working copy, ADR-106

Branch `claude/t-024-feasibility-e16b39` (worktree terpisah). Belum
di-commit/push sesi ini. Lanjutan T-024.1/T-024.2 (skeleton domain `media` +
upload Supabase Storage, sudah tercatat entri di bawah).

**Implementasi (Elon Backend Engineer):**

- Kontrak baru di `IOutstandAdapter`
  (`packages/shared/src/contracts/outstand-adapter.ts`):
  `UploadMediaWorkingCopyInput`/`UploadMediaWorkingCopyResult` + method
  `uploadMediaWorkingCopy`.
- Implementasi Fake di
  `apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts` — instant
  always-success (pola ADR-059), `outstandMediaId` unik per panggilan
  (`crypto.randomUUID()`, bukan deterministik), `expiresAt` mock +24 jam. 2
  unit test baru.
- 7 file test lain (mock `IOutstandAdapter`) ditambah stub field baru supaya
  tetap type-safe, tanpa mengubah behavior test yang sudah ada.
- **ADR-106 baru**
  (`decisions/ADR-106-fake-media-upload-working-copy-1-method-gabungan.md`,
  baris sudah ditambahkan ke `DECISIONS.md`): keputusan menggabungkan 3
  langkah Outstand Media API (request upload URL → PUT → confirm) jadi **1
  method ACL gabungan** — berbeda dari ADR-105 (`connectAccount`/
  `exchangeConnectCode`, di-split 2-method) karena tidak ada redirect browser
  yang perlu diuji terpisah di sini; ketiga langkah murni server-to-server
  berurutan.
- Scope SENGAJA tidak menyentuh `UploadMediaUseCase`/`MediaService`/UI —
  method baru murni kontrak+Fake, belum di-wire ke manapun.

**Review (Ridwan Architecture Reviewer):** 0 temuan pelanggaran. Verifikasi
independen: `bun run typecheck` 0 error, `bunx vitest run` **346 pass/5
skip** (naik dari baseline 344/5). 1 risiko forward-looking dicatat
(non-blocking, di ADR-106 sendiri): kalau Real adapter (T-025.5) nanti butuh
retry granular per-langkah (mis. PUT gagal terpisah dari request URL),
kontrak 1-method gabungan ini mungkin perlu di-split lagi lewat ADR baru.

**Status:** T-024 `🟡 In Progress (3/5 subtask)` — sisa T-024.4 (UI dropzone
custom + preview) dan T-024.5 (delete media). Detail:
`tasks/v02-publishing-mvp.md` § T-024.

---

## 2026-09-14 — T-024.2 Done (2/5 subtask) — Upload media ke Supabase Storage

Branch `claude/t-024-feasibility-e16b39` (worktree terpisah). Belum
di-commit/push sesi ini. Lanjutan T-024.1 (domain `media` skeleton, sudah
tercatat entri di bawah).

**Implementasi (Elon Backend Engineer):**

- Port `IMediaStorageAdapter`
  (`apps/web/src/domains/media/adapters/media-storage-adapter.ts`) — mirror
  pola `IAvatarStorageAdapter`.
- `ALLOWED_MEDIA_MIME_TYPES` + `MAX_MEDIA_FILE_SIZE_BYTES`
  (`apps/web/src/domains/media/validation.ts`).
- `UploadMediaUseCase`
  (`apps/web/src/domains/media/services/upload-media.use-case.ts`) — use
  case terpisah (pola ADR-059/`SchedulePostsUseCase`), constructor
  `IMediaRepository` + `IMediaStorageAdapter`. Validasi mime type + ukuran
  file sebelum upload, upload ke storage, create record DB, cleanup
  best-effort (hapus file storage) kalau create DB gagal setelah upload
  sukses (rethrow error asli, bukan error cleanup).
- `SupabaseMediaStorageAdapter`
  (`apps/web/src/lib/adapters/media-storage/supabase-media-storage-adapter.ts`)
  — implementasi Supabase Storage. Bucket `media` **Private** (bukan public
  seperti avatar), pakai **signed URL**. Path
  `{workspaceId}/{year}/{month}/{uuid}.{ext}`.
- Migration
  `apps/web/prisma/migrations/20260914090000_t024_2_create_media_bucket/migration.sql`
  — buat bucket `media`, idempotent (pola sama bucket `avatars`). **Belum
  dijalankan** — perlu `bun run db:deploy` oleh King Rezi sebelum fitur ini
  bisa diuji end-to-end.

**Review Ridwan Architecture Reviewer:** **0 temuan pelanggaran arsitektur**.
Verifikasi independen: `typecheck` 0 error, test 343 pass/5 skip (saat itu).
Satu catatan non-blocking: bucket dibuat tanpa `file_size_limit` — gap
baseline (beda dari avatar yang eksplisit 2MB), diteruskan sebagai
rekomendasi butuh keputusan King Rezi.

**Keputusan King Rezi (`AskUserQuestion`):** batas ukuran file maksimum
media MVP = **50 MB** (52.428.800 bytes). Bukan keputusan arsitektural —
parameter konfigurasi operasional, sama seperti batas 2MB avatar yang juga
tidak punya ADR khusus, sehingga tidak dibuatkan ADR baru.

**Follow-up Elon menerapkan keputusan itu:** `file_size_limit` migration
diisi 50MB, `MAX_MEDIA_FILE_SIZE_BYTES` di `validation.ts`, validasi ukuran
file di `UploadMediaUseCase.execute` (menolak sebelum panggil storage
adapter), 1 unit test baru. Verifikasi akhir: `bun run typecheck` 0 error,
`bunx vitest run` **344 pass/5 skip**, tidak ada regresi.

Task T-024 tetap `🟡 In Progress`, sekarang **2/5 subtask** (T-024.1,
T-024.2). Detail: `project-manager/tasks/v02-publishing-mvp.md` § T-024.

---

## 2026-09-14 — T-024.1 Done (1/5 subtask) — Domain `media` skeleton, feasibility check T-024

Branch `claude/t-024-feasibility-e16b39` (worktree terpisah). Belum di-commit/push
sesi ini.

**Feasibility check T-024 (Media upload di Draft Editor):** sebelumnya
tercatat depends penuh pada T-025.5 (Real OutstandAdapter Media API) yang
terhenti karena `OUTSTAND_API_KEY`/`OUTSTAND_WEBHOOK_SECRET` asli belum ada.
Diputuskan T-024 tetap bisa dikerjakan sekarang mengikuti rule 19 AGENTS.md
(pola ADR-059/ADR-105) — subtask yang tidak butuh kredensial asli (T-024.1
domain skeleton, T-024.2 Supabase Storage, T-024.4 UI, T-024.5 delete) jalan
duluan; hanya T-024.3 (`OutstandAdapter` media upload working copy) tetap
menunggu real adapter, akan dibangun via `FakeOutstandAdapter` dulu mengikuti
pola yang sama bila didahulukan sebelum T-025 selesai.

**Cek Claude Design (rule 17):** rancangan Draft Editor
(`templates/draft-editor.html`) sudah punya section Media (`.media-drop`
dropzone + `.media-thumb` preview), tapi pola ini belum dikunci ke primitive
shadcn konkret (`readme.md` Claude Design: "no dedicated FileInput
primitives installed yet"; dikonfirmasi juga tidak ada komponen
file-upload/dropzone di registry shadcn resmi via MCP). King Rezi
dikonfirmasi 2 keputusan lewat `AskUserQuestion`: (1) dropzone media di
Draft Editor (T-024.4) dibangun sebagai **custom drag-drop zone** (bukan
native file input polos); (2) scope T-024 dipersempit — hanya upload file
baru + preview + delete, **"Pilih dari Media Library" (browse existing
media) ditunda**, tidak masuk scope T-024 manapun untuk saat ini. Tidak
dicatat sebagai ADR terpisah (keputusan scope/UX minor hasil konfirmasi
`AskUserQuestion`, mengikuti preseden T-035/ADR-104 yang juga cukup dicatat
di catatan task tanpa ADR baru).

**Added — domain `media` skeleton (Elon Backend Engineer, T-024.1):**
`apps/web/src/domains/media/types.ts` (`MediaItemRecord`),
`repositories/media.repository.ts` (interface `IMediaRepository` —
`create`/`findById`/`findByWorkspace`/`delete`, semua di-scope
`workspaceId`+`userId`), `services/media.service.ts` (`MediaService` —
`createMediaItem`/`getMediaItem`/`listMediaItems`/`deleteMediaItem`, murni
orchestrate repository, **tanpa** upload fisik Storage/T-024.2 dan **tanpa**
OutstandAdapter/T-024.3) + `services/media.service.test.ts` (6 unit test
baru). Implementasi Prisma:
`apps/web/src/lib/repositories/media/media.repository.ts` + `index.ts`
(pola sama `notificationRepository`, guard `workspaceId` di level
repository, RLS via `withCurrentUser`). `apps/web/src/domains/media/index.ts`
barrel diupdate. Shared types baru: `MediaType` enum
(`packages/shared/src/enums.ts` — image/video/gif, sesuai `domain-model.md`
§ BC-08 yang sudah lama mendefinisikan field ini, bukan requirement baru) +
helper `asMediaId()` (`packages/shared/src/ids.ts`, brand `MediaId` sudah
ada sebelumnya). Keputusan non-trivial: entity domain diletakkan di
`types.ts` (bukan file class terpisah di `entities/`) mengikuti pola anemic
model yang konsisten di seluruh 8 domain lain di repo ini — bukan bikin
presedan baru. Error handling pakai `NotFoundError`/`ConflictError` dari
`@/lib/utils/errors` (bukan `MediaDomainError` scaffold domain ini yang
memang tidak pernah dipakai domain manapun).

**Verifikasi:** `bun run typecheck` 0 error, `bunx vitest run` 338 test
pass + 5 skip, tidak ada regresi. Review arsitektur Ridwan Architecture
Reviewer: **0 temuan** — domain tidak import Prisma/Supabase langsung
(implementasi Prisma benar di layer infra `lib/repositories/media/`), guard
ownership `workspaceId` di level repository (anti-IDOR, pola
`findFirst`/lookup-then-delete dengan `where: {id, workspaceId}` sekaligus),
shared types (`MediaType`/`asMediaId`) murni value object tanpa business
logic, tidak ada over-scoping ke T-024.2/T-024.3/T-024.4/T-024.5. Verifikasi
independen typecheck+test dijalankan ulang, hasil identik.

Task T-024 pindah dari `⏳ Not Started` ke `🟡 In Progress` (1/5 subtask).
Breakdown v0.2 di `TASKS.md` berubah dari "16 ✅ · 2 🟡 · 5 ⏳" menjadi
**16 ✅ · 3 🟡 · 4 ⏳** (dihitung ulang langsung dari
`tasks/v02-publishing-mvp.md`). Detail lengkap: `tasks/v02-publishing-mvp.md`
§ T-024.

---

## 2026-09-11 — T-015 TUNTAS 3/3 subtask (Reconnect flow, ADR-105) — T-013.1/T-013.2 ikut selesai, KI-058 baru

Branch `feature/t-015-reconnect-flow` (checkout dari `staging`). Rangkaian:
Elon Backend Engineer → Prabowo Feature Engineer → Ridwan Architecture
Reviewer → Prabowo (fix) → Najwa QA Engineer → Prabowo (fix + verifikasi
ulang).

**Added — kontrak adapter + Fake (Elon Backend Engineer, ADR-105):**
`IOutstandAdapter` (`packages/shared/src/contracts/outstand-adapter.ts`)
dipecah jadi 2 method baru — `connectAccount(input) → { redirectUrl }`
(`redirectAccountId?` diisi hanya untuk reconnect, kosong berarti connect
baru) dan `exchangeConnectCode(input) → ConnectedAccountData`. Alasan split
dan alasan Fake redirect **loopback ke callback route sendiri** (bukan
auto-approve instan langsung) dicatat lengkap di
`decisions/ADR-105-fake-connect-account-oauth-redirect-loopback.md` — inti:
Route Handler callback (CSRF-check `state`, keputusan create/update
`ConnectedAccount`) harus benar-benar teruji end-to-end sekarang lewat Fake,
bukan pertama kali saat real adapter (T-025) ada. Disetujui King Rezi lewat
`AskUserQuestion` (rule 19 AGENTS.md, kredensial `OUTSTAND_API_KEY` belum
ada). File baru: `apps/web/src/lib/adapters/outstand/connect-state.ts`
(encode/decode `state` base64url), `fake-outstand-adapter.ts` diperluas +
test baru.

**Added — Application/entry point (Prabowo Feature Engineer):**
`WorkspaceService.initiateConnectAccount`/`completeAccountConnection`
(`redirectAccountId` terisi → UPDATE `WorkspaceConnectedAccount` existing,
`connectedAt` asli dipertahankan, riwayat post tidak hilang; kosong → CREATE
baru). Route Handler baru `apps/web/src/app/api/integrations/outstand/
callback/route.ts` (entry point tanpa business logic, murni memanggil
service) + cookie nonce `apps/web/src/lib/workspace/
outstand-connect-nonce-cookie.ts` untuk CSRF-check `state`. Server Action +
wiring UI: tombol "Reconnect" aktif di `ConnectedAccountsList.tsx`,
`ConnectPlatformMenu.tsx` untuk connect baru.

**Fixed — review Ridwan Architecture Reviewer:** 1 temuan non-blocking,
diperbaiki Prabowo sebelum lanjut ke QA.

**Fixed — QA Najwa QA Engineer (browser end-to-end):** 1 bug ditemukan —
toast error dobel muncul di callback route saat Next.js prefetch/
soft-navigation memanggil route tanpa query param `code`/`state`. Sudah
diperbaiki Prabowo, diverifikasi ulang: golden path Connect + Reconnect
PASS, hanya 1 toast sukses (bukan dobel).

**Changed — task status:** **T-015** (Reconnect flow saat token expired,
`tasks/v01-foundation.md`) `🟡 In Progress` → `✅ Done` (3/3 subtask —
T-015.1/T-015.2 ternyata sudah selesai sebelumnya, bagian tak tercatat dari
T-026 webhook + UI existing; T-015.3 baru diimplementasikan sesi ini).
**T-013** (Connect account, `tasks/v01-foundation.md`) — T-013.1/T-013.2
ikut selesai karena berbagi flow OAuth yang sama, tapi task **tetap `🟡 In
Progress`** karena T-013.4 (operasional BYOK X) belum ada tindakan apa pun.

**Added — Known Issue baru:** **KI-058** (Design Gap/RBAC UI, Open,
`PROJECT_STATE.md`) — `ConnectedAccountsList.tsx` tidak menyembunyikan/
menonaktifkan tombol Connect/Disconnect/Reconnect untuk role Creator meski
backend RBAC (`WorkspaceService`) sudah menolak dengan benar; gap sudah ada
sejak T-014 (Disconnect), baru ketahuan sekarang saat QA Najwa menyentuh
area ini lagi untuk T-015. King Rezi eksplisit memutuskan (`AskUserQuestion`)
dicatat sebagai KI, **tidak diperbaiki sesi ini**. Back-reference KI-058
ditambahkan ke field `Terkait` T-014 dan T-015 di `tasks/v01-foundation.md`.

**Catatan implementasi (accepted deviation, bukan KI):** tombol "Reconnect"
(`variant=secondary`) dan "Disconnect" (`variant=destructive`) berbeda dari
mockup Claude Design (`templates/settings-connected-accounts.html`:
Reconnect=`btn-primary` filled, Disconnect=`btn` netral). King Rezi eksplisit
memutuskan (`AskUserQuestion`) membiarkan kode seperti sekarang — dinilai
lebih aman secara UX (Disconnect aksi merusak, Reconnect sudah cukup jelas
dari badge status di sebelahnya) — bukan mengikuti mockup. Dicatat sebagai
catatan implementasi di `tasks/v01-foundation.md` § T-015, bukan KI baru.

**Docs:** `tasks/v01-foundation.md` § T-013/§ T-015 diperbarui (status,
checklist subtask, catatan deviasi styling, field `Terkait` KI-058),
`TASKS.md` (indeks v0.1 15 ✅ → 16 ✅, Total 41 → 42 selesai, entri Update
baru), `DECISIONS.md` (baris index ADR-105 ditambahkan — file ADR-nya
sendiri sudah ditulis lengkap oleh Elon di sesi sebelumnya),
`PROJECT_STATE.md` (Snapshot Top Next Tasks, KI-058 baru, Completed
Ringkasan digeser — bullet T-014 lama dihapus untuk menjaga batas 5 item).

---

## 2026-09-11 — T-092.6 (Granular patch Realtime — History) selesai — T-092 TUNTAS 6/6 subtask, KI-057 Resolved

Diimplementasikan Prabowo Feature Engineer, lolos review Ridwan
Architecture Reviewer (0 pelanggaran arsitektur).

**T-092.6 (subtask ke-6/terakhir dari T-092):** method baru
`getHistoryPostById` (interface `IPublishingRepository` + implementasi
Prisma + `PublishingService`) — dibuat baru, **bukan** reuse
`getCalendarPostById`, karena History butuh field `status`/`error`
per-target yang tidak ada di proyeksi Calendar. Ridwan memverifikasi
keputusan ini benar dan berdasar bukti kode konkret. Server Action baru
`getHistoryPostAction`, `HistoryList.tsx` diubah jadi stateful dengan
`usePublishingPostsRealtime` (dari T-092.2), grouping
(`groupHistoryItemsByDate`) dipindah ke client. **Verifikasi cross-tab
browser nyata wajib (KI-057) — PASS:** Publish Now di tab 1 (Drafts) →
tab 2 (History) otomatis menampilkan post baru dengan badge "Published"
tanpa refresh — Ridwan mengonfirmasi klaim ini didukung alur kode.
Typecheck/lint bersih, 315 test passed/5 skipped, tidak ada regresi.
Catatan minor Ridwan (bukan blocker): tidak ada unit test spesifik untuk
`getHistoryPostById` (cuma stub fake repository) — observasi coverage.

**Temuan terpisah di luar scope (tidak dibuatkan task baru):** bug
pre-existing "Publish Now di Queue selalu gagal untuk post Scheduled"
ditemukan saat sesi ini — sudah dicatat sebagai chip task terpisah
menunggu King Rezi pick up.

**T-092 (Realtime Calendar/Queue/Drafts/History via Supabase Realtime,
ADR-094) dinyatakan `✅ Done` — seluruh 6/6 subtask tuntas** (T-092.1 RLS
policy, T-092.2 wiring subscription, T-092.3 Calendar, T-092.4 Queue + fix
RLS `workspace_members`, T-092.5 Drafts, T-092.6 History). **KI-057**
(gap metodologi verifikasi Realtime, ditemukan Ridwan saat T-092.4) —
**Resolved**: Definition of Done tambahan (verifikasi cross-tab browser
nyata) sudah terbukti berhasil dijalankan sampai akhir untuk seluruh
subtask yang menjadi syaratnya (T-092.3–T-092.6).

**Perubahan dokumentasi (Gibran Project Manager):**

- `tasks/v02-publishing-mvp.md` — § T-092: T-092.6 dicentang `[x]` ✅ Done
  + catatan implementasi lengkap; status task T-092 diubah `🟡 In Progress`
  → `✅ Done` dengan catatan penutupan 6/6 subtask.
- `TASKS.md` — indeks v0.2 breakdown "15 ✅ · 3 🟡 · 5 ⏳" → **16 ✅ · 2 🟡
  · 5 ⏳** (T-092 pindah 🟡 → ✅), **Total** selesai naik 40 → **41**
  (task/subtask total tidak berubah: 87 task, 217 subtask), blockquote log
  baru "Update (2026-09-11, T-092 SELESAI 6/6 subtask)", baris T-092 baru
  ditambahkan ke tabel **Fokus sekarang**.
- `PROJECT_STATE.md` — Snapshot **Top Next Tasks** diperbarui dengan
  ringkasan T-092.6 + penutupan T-092; **KI-057** dihapus dari section
  Known Issues (Resolved, riwayat lengkap ada di sini); section
  **Completed (Ringkasan)** — bullet baru T-092 ditambahkan di atas, bullet
  terlama (T-034.4) dihapus supaya tetap 5 item; `Metadata` (Version
  1.0.79 → 1.0.80, Last Updated 2026-09-11).

Tidak ada perubahan phase/milestone (tetap Phase 6/M8 In Progress) — T-092
adalah fitur besar dalam M8, bukan penanda milestone baru.

---

## 2026-09-11 — T-092.5 (Granular patch Realtime — Drafts) dan T-104 (fix konsistensi status `listDrafts`) selesai

Kedua task diimplementasikan Prabowo Feature Engineer dan lolos review
Ridwan Architecture Reviewer (0 pelanggaran arsitektur untuk keduanya).

**T-092.5 (subtask ke-5 dari 6, T-092):** Server Action
`getDraftPostAction` (reuse `PublishingService.getCalendarPostById` dari
T-092.3, tanpa duplikasi method baru), `DraftsList.tsx` diubah jadi client
state yang subscribe `usePublishingPostsRealtime` (dari T-092.2), filter
kriteria tampilan Drafts (3 status: `Draft`/`InReview`/`ReadyToSchedule`)
via fungsi `toDraftListItem`. Field `updatedAt` ditambahkan ke
`CalendarItemRecord` (perubahan additive). **Verifikasi cross-tab browser
nyata wajib (KI-057) — PASS untuk kedua skenario:** edit caption draft di
tab 1 ter-update otomatis di tab 2 tanpa refresh; hapus draft di tab 1
membuat baris hilang otomatis di tab 2. Ridwan mengonfirmasi klaim PASS
ini masuk akal secara teknis dari alur kode, didukung fix RLS
`workspace_members` yang sudah diterapkan lebih dulu di T-092.4.
Typecheck/lint bersih, 315 test passed/5 skipped, tidak ada regresi.
T-092 tetap `🟡 In Progress` — 1 subtask tersisa (**T-092.6**, History,
depends T-034).

**T-104 (Konsistensi kriteria status Drafts):** `PublishingService.listDrafts`
diubah dari filter status tunggal (`Draft`) jadi 3 status (`Draft`/
`InReview`/`ReadyToSchedule`), sekarang konsisten dengan
`DRAFT_VIEW_STATUSES` di client (`DraftsList.tsx`, T-092.5). Ridwan
mengonfirmasi filter backend dan client sekarang identik.

**Gap baru ditemukan selama implementasi T-104 (dicatat, bukan subtask
baru):** tombol Hapus di layar Drafts tetap tampil tanpa syarat untuk
status `InReview`/`ReadyToSchedule`, padahal `deletePost` hanya
mengizinkan status `Draft` — berpotensi menghasilkan pesan error
menyesatkan ("Cancel Schedule dulu") padahal kedua status itu tidak
pernah melalui alur schedule. Ridwan mengonfirmasi ini technical debt
valid. Termasuk di gap ini: komentar `DraftsList.tsx:94-98` ("baris di
sini selalu Draft") sudah tidak akurat pasca T-104, perlu diperbaiki
bersamaan nanti. Sudah dicatat sebagai chip task terpisah oleh Prabowo
Feature Engineer (`task_6b93cfb5`), menunggu King Rezi pick up — tidak
dibuatkan task/subtask formal baru.

**Perubahan dokumentasi (Gibran Project Manager):**

- `tasks/v02-publishing-mvp.md` — § T-092: T-092.5 dicentang `[x]` ✅ Done
  + catatan implementasi lengkap; § T-104: T-104.1 dicentang `[x]` ✅ Done,
  status task T-104 diubah 🟡 → ✅ Done, catatan implementasi + gap tombol
  Hapus ditambahkan.
- `TASKS.md` — indeks v0.2 breakdown "14 ✅ · 4 🟡 · 5 ⏳" → **15 ✅ · 3 🟡
  · 5 ⏳** (T-104 pindah 🟡 → ✅, T-092 tetap 🟡), **Total** selesai naik
  39 → **40** (task/subtask total tidak berubah: 87 task, 217 subtask),
  blockquote log baru "Update (2026-09-11, T-092.5 + T-104 selesai)".
- `PROJECT_STATE.md` — **KI-057** ditambah catatan progres: T-092.5 sudah
  membuktikan Definition of Done verifikasi cross-tab bisa PASS nyata;
  Status **tetap Open** (T-092.6 masih tersisa, belum jalankan verifikasi
  yang sama).

---

## 2026-09-11 — T-104 baru ditambahkan (Konsistensi kriteria status Drafts — `listDrafts` vs granular patch Realtime)

Task baru **T-104** ditambahkan ke `tasks/v02-publishing-mvp.md` (domain
publishing, ID global berikutnya setelah T-103, pola sama T-090/T-091/
T-092/T-093/T-094), status `🟡 In Progress` — dikerjakan paralel oleh
Prabowo Feature Engineer.

**Latar belakang:** ditemukan saat implementasi **T-092.5** (Granular
patch Realtime — Drafts): `PublishingService.listDrafts` (initial SSR
load halaman `/publish/drafts`) hanya query post berstatus `Draft`,
padahal kriteria tampilan Drafts sesuai **ADR-094** (dan yang sudah
diterapkan di granular patch Realtime T-092.5) mencakup 3 status —
`Draft`, `InReview`, `ReadyToSchedule`. Belum berdampak nyata (belum ada
fitur yang mentransisi post ke `InReview`/`ReadyToSchedule` — review-
workflow belum dibangun), tapi initial load dan hasil patch Realtime
punya kriteria yang tidak konsisten, berpotensi jadi bug nyata begitu
review-workflow dibangun. King Rezi memutuskan diperbaiki sekarang juga,
bukan sekadar dicatat sebagai known gap.

**Perubahan dokumentasi (Gibran Project Manager):**

- `tasks/v02-publishing-mvp.md` — entri baru **T-104** (1 subtask:
  perbaiki `PublishingService.listDrafts` supaya query mencakup ketiga
  status, konsisten dengan kriteria granular patch Realtime di
  `DraftsList.tsx` T-092.5); catatan referensi balik ditambahkan di
  § T-092.5; entri Catatan Rilis baru untuk pola ID T-104.
- `TASKS.md` — indeks v0.2 (22→23 task, breakdown "14 ✅ · 3 🟡 · 5 ⏳" →
  "14 ✅ · 4 🟡 · 5 ⏳"), **Total** (86→87 task, 216→217 subtask), footnote
  ID global diperluas, blockquote log baru untuk T-104.

Implementasi kode (fix `listDrafts`) dikerjakan terpisah oleh Prabowo
Feature Engineer di sesi paralel — akan dicatat sebagai entri
`COMPLETE_TASK.md` tersendiri setelah selesai.

---

## 2026-09-11 — T-092.4 migration follow-up (defense-in-depth) + KI-057 baru (gap metodologi verifikasi Realtime)

Tindak lanjut dari review Ridwan Architecture Reviewer atas **T-092.4**,
dikonfirmasi King Rezi. Dua bagian:

**1. Migration follow-up defense-in-depth (Elon Backend Engineer):** file
`apps/web/prisma/migrations/20260911110000_t092_5_workspace_members_realtime_own_row_active_filter/migration.sql`
menambah filter `AND status = 'active'` ke policy
`workspace_members_realtime_own_row` (dibuat di T-092.4 sebelumnya) — bukan
menutup celah eksploitasi (member non-`active` sudah tertahan policy
`publishing_posts` di layer atasnya), murni defense-in-depth, konsisten
dengan filter serupa yang sudah dipakai
`publishing_posts_realtime_workspace_members`. Tidak ada regresi ke
consumer manapun. Sudah di-apply ke database (`bunx prisma migrate deploy`)
dan diverifikasi.

**Catatan penamaan (koreksi, bukan bug):** nama file migration ini salah
ketik jadi `t092_5` — migration ini adalah lanjutan **T-092.4**, **bukan**
bagian **T-092.5** (Drafts, yang belum dikerjakan). File tidak diganti nama
(mengubah nama file migration yang sudah `migrate deploy` berisiko mismatch
checksum) — dicatat eksplisit di `tasks/v02-publishing-mvp.md` § T-092 dan
di sini supaya tidak membingungkan siapa pun yang cek folder migration ke
depan.

**2. KI-057 baru (rekomendasi Ridwan, disetujui King Rezi):** gap
metodologi verifikasi Realtime — kriteria "typecheck bersih + lint bersih +
tidak ada console error + channel Realtime `SUBSCRIBED`" ternyata **tidak
cukup** membuktikan event Realtime benar-benar terkirim ke subscriber.
Akibatnya **T-092.1, T-092.2, T-092.3** sempat ditandai lolos/`✅ Done`
padahal seluruh fitur Realtime publishing nonfungsional total (zero event
delivered) — baru ketahuan tidak sengaja saat verifikasi manual cross-tab
di **T-092.4**. **Action item:** Definition of Done untuk sisa subtask
Realtime publishing yang belum dikerjakan — **T-092.5** (Drafts) dan
**T-092.6** (History) — sekarang wajib menyertakan verifikasi cross-tab
browser nyata (2 tab, aksi di 1 tab terlihat otomatis di tab lain tanpa
refresh) sebagai syarat Done, bukan cukup "tanpa console error + channel
`SUBSCRIBED`" saja.

**File diubah (dokumentasi):**
- `project-manager/PROJECT_STATE.md` — KI-057 baru ditambahkan di section
  Known Issues
- `project-manager/tasks/v02-publishing-mvp.md` § T-092 — catatan
  Definition of Done tambahan di checklist T-092.5/T-092.6, catatan lanjutan
  migration follow-up + koreksi penamaan file di bagian catatan T-092.4
- `project-manager/TASKS.md` — blockquote log baru di section Fokus
  sekarang

Tidak ada perubahan kode selain migration di atas (sudah di-apply
sebelumnya oleh Elon Backend Engineer, dicatat di sini sebagai bagian
tindak lanjut dokumentasi).

---

## 2026-09-11 — T-092.4 Done — Granular patch Realtime Queue + insiden & fix RLS `workspace_members`

**T-092.4** (subtask keempat T-092, Realtime Calendar/Queue/Drafts/History)
selesai — rangkaiannya lebih panjang dari subtask sebelumnya karena
ditemukan bug infra kritis di tengah jalan (gap RLS lintas-tabel), bukan
sekadar implementasi linier.

**1. Implementasi (Prabowo Feature Engineer):** Server Action
`getQueuePostAction` (reuse `PublishingService.getCalendarPostById` dari
T-092.3, tidak duplikasi method), wiring `usePublishingPostsRealtime` di
`QueueScreen.tsx` dengan kriteria tampilan Queue (hanya status
`Scheduled`), fungsi `toQueueItemRecord` untuk filter, regroup via
`groupQueueItemsByDate`.

**File dibuat/diubah (implementasi):**
- `apps/web/src/app/(app)/publish/queue/actions.ts` — Server Action baru
  `getQueuePostAction`
- `apps/web/src/app/(app)/publish/queue/components/QueueScreen.tsx` —
  wiring `usePublishingPostsRealtime`, `toQueueItemRecord`,
  `groupQueueItemsByDate`
- `apps/web/src/app/(app)/publish/queue/page.tsx` — prop tambahan

**2. Bug ditemukan saat verifikasi manual (Prabowo):** propagasi Realtime
lintas-tab **tidak bekerja** — channel `SUBSCRIBED` tanpa error, tapi
event tidak pernah sampai ke subscriber manapun. Gejala ini kemungkinan
sudah ada sejak T-092.2/T-092.3 (keduanya cuma diverifikasi "token sukses
+ tanpa console error", belum pernah dites cross-tab nyata sampai titik
ini).

**3. Root cause (Elon Backend Engineer):** RLS policy
`publishing_posts_realtime_workspace_members` (dibuat T-092.1) melakukan
subquery ke tabel `workspace_members` untuk cek membership. RLS
`workspace_members` yang sudah ada sebelumnya
(`workspace_members_workspace_isolation`, pra-T-092) hanya mengenali GUC
session server-side `current_setting('app.current_user_id')` — koneksi
Realtime tidak pernah lewat jalur itu (cuma bawa JWT), jadi
`app.current_user_id` selalu kosong untuk koneksi Realtime,
`workspace_members` jadi tidak terlihat sama sekali oleh subquery
tersebut, dan policy `publishing_posts` selalu mengembalikan `false`. Gap
arsitektur RLS lintas-tabel ini tidak tersentuh preseden T-036 (policy
`notifications` cek `user_id` langsung di baris `notifications` itu
sendiri, tanpa subquery ke tabel lain).

**4. Fix:** migration baru
`apps/web/prisma/migrations/20260911100000_t092_4_fix_workspace_members_realtime_visibility/migration.sql`
— menambah policy PERMISSIVE tambahan `workspace_members_realtime_own_row`
di tabel `workspace_members` (user hanya bisa lihat baris membership-nya
sendiri lewat JWT, additive, tidak mengganti policy lama). Migration sudah
di-apply ke database (`bunx prisma migrate deploy`, sukses, dijalankan
langsung oleh AI utama atas izin eksplisit King Rezi).

**5. Verifikasi database (Elon):** simulasi query dengan role
`authenticated` (bukan role bypass-RLS) di dalam transaksi ROLLBACK — user
member workspace dapat 27 baris `publishing_posts` (cocok total post
workspace itu), negative control dengan user id palsu dapat 0 baris. Root
cause teratasi di level database.

**6. Verifikasi end-to-end nyata di browser (Najwa QA Engineer):** 2 tab
(Calendar + Queue), Cancel Schedule dilakukan di tab Queue, tanpa refresh
tab Calendar langsung update (item hilang dari slot terjadwal) — **PASS**.
Data dikonfirmasi benar-benar berubah ke status Draft. Typecheck/lint
bersih, 315 test passed/5 skipped, tidak ada regresi. Arah sebaliknya
(Calendar → Queue) belum sempat dites tuntas karena kendala teknis
otomasi test (bukan bug fitur) — dicatat sebagai item follow-up opsional,
bukan blocker.

**Tidak ada ADR baru dibuat** — fix dicatat sebagai catatan implementasi
tambahan di **ADR-094** poin 3, mengikuti pola persis yang sama seperti
catatan fix `auth.uid()`/cuid T-092.1 di ADR yang sama (keduanya gap
implementasi RLS ditemukan mid-development untuk fitur yang sama, bukan
keputusan arsitektur baru).

**Tidak ada Known Issue baru dibuka** — gap ditemukan & diperbaiki tuntas
dalam sesi yang sama, sebelum berdampak ke user nyata (masih development).

**Dokumen diupdate:**
1. `project-manager/tasks/v02-publishing-mvp.md` § T-092 — T-092.4
   dicentang `[x]` Done + catatan implementasi lengkap (poin 1-6 di atas);
   catatan retroaktif ditambahkan ke T-092.2 dan T-092.3 yang menyebutkan
   verifikasi cross-tab nyata untuk keduanya baru dikonfirmasi PASS
   sekarang, setelah fix ini.
2. `project-manager/decisions/ADR-094-perluasan-supabase-realtime-publishing-posts-granular-patch.md` —
   catatan implementasi tambahan di poin 3 (Decision).
3. `project-manager/TASKS.md` — blockquote log baru "Update (2026-09-11,
   T-092.4 selesai + fix RLS `workspace_members`)". T-092 tetap `🟡 In
   Progress` (4/6 subtask), breakdown task-level v0.2 tidak berubah.

Task **T-092** tetap `🟡 In Progress` — 2 subtask (T-092.5–T-092.6) masih
`⏳ Not Started`.

---

## 2026-09-11 — T-092.3 Done — Granular patch Realtime Calendar

**T-092.3** (subtask ketiga T-092, Realtime Calendar/Queue/Drafts/History)
selesai dikerjakan Prabowo Feature Engineer di branch
`feature/t-092-1-realtime-rls-policy`. Calendar sekarang menerapkan
granular client-side patch (upsert/remove state lokal per event Realtime)
menggantikan full refresh, sesuai ADR-094 poin 5-6.

**File dibuat/diubah:**
- `apps/web/src/app/(app)/publish/calendar/actions.ts` — Server Action
  baru `getCalendarPostAction`
- `apps/web/src/domains/publishing/services/publishing.service.ts` —
  method baru `getCalendarPostById`
- `apps/web/src/domains/publishing/repositories/publishing.repository.ts` —
  interface `IPublishingRepository.getCalendarPostById` baru
- `apps/web/src/lib/repositories/publishing/` — implementasi Prisma
  `getCalendarPostById`
- `apps/web/src/app/(app)/publish/calendar/components/CalendarScreen.tsx` —
  jadi Client Component, subscribe `usePublishingPostsRealtime` (T-092.2),
  granular patch (upsert/remove) berdasarkan kecocokan dengan view/filter
  aktif (`matchesCurrentView`, reuse fungsi domain murni
  `getWeekRange`/`getMonthRange`)
- `apps/web/src/app/(app)/publish/calendar/page.tsx` — tambah prop
  `statuses`, `workspaceId`
- `publishing.service.test.ts` — 4 test baru; 6 file test use-case lain
  disesuaikan (tambah default `getCalendarPostById` di fake repository,
  murni type-fix, tanpa perubahan behavior)

**Verifikasi:** typecheck bersih, lint bersih, 315 test passed (naik dari
311), browser preview manual OK (Calendar render normal, endpoint token
Realtime sukses, tanpa console error).

**Review Ridwan Architecture Reviewer:** tidak ada temuan pelanggaran —
server action tetap tipis, domain tidak mengimpor Prisma/Supabase,
cross-domain lewat public API, error/null handling konsisten dan
graceful, tidak ada regresi behavior use-case lain.

**Dokumen diupdate:**
1. `project-manager/tasks/v02-publishing-mvp.md` § T-092 — T-092.3
   dicentang `[x]` Done + catatan implementasi.
2. `project-manager/TASKS.md` — blockquote log baru "Update (2026-09-11,
   T-092.3 selesai)". T-092 tetap `🟡 In Progress` (3/6 subtask),
   breakdown task-level v0.2 tidak berubah.

Task **T-092** tetap `🟡 In Progress` — 3 subtask (T-092.4–T-092.6) masih
`⏳ Not Started`.

---

## 2026-09-11 — T-092.2 Done — Wiring subscription channel Realtime `publishing_posts`

**T-092.2** (subtask kedua T-092, Realtime Calendar/Queue/Drafts/History)
selesai dikerjakan Prabowo Feature Engineer di branch
`feature/t-092-1-realtime-rls-policy`. Wiring subscription channel
per-workspace `publishing_posts:{workspaceId}` untuk event
`INSERT`/`UPDATE` (filter `workspace_id`), reuse Supabase Realtime client
generic + Better Auth↔Supabase JWT bridge yang sudah dibangun di T-036
(ADR-094 poin 2, 4) — tidak dibangun ulang.

**File dibuat:**
- `apps/web/src/lib/supabase/realtime/publishing-posts.ts` —
  `subscribeToPublishingPostChanges(client, workspaceId, handlers)`
- `apps/web/src/lib/hooks/use-publishing-posts-realtime.ts` — hook
  `usePublishingPostsRealtime(workspaceId, { onInsert, onUpdate })`

**Verifikasi:** typecheck bersih, lint bersih, 311 test passed/5 skipped.

**Review Ridwan Architecture Reviewer:** tidak ada temuan pelanggaran
(5/5 checklist arsitektur patuh). Satu catatan DRY minor bukan blocker:
dua tipe handler shape identik didefinisikan dua kali —
`PublishingPostRealtimeHandlers` (file pertama) dan
`UsePublishingPostsRealtimeHandlers` (file kedua) — tidak wajib
diperbaiki sekarang.

**Dokumen diupdate:**
1. `project-manager/tasks/v02-publishing-mvp.md` § T-092 — T-092.2
   dicentang `[x]` Done + catatan implementasi; blok "Catatan
   (2026-09-11)" T-092.1 disesuaikan dari "5 subtask (T-092.2–T-092.6)
   belum dikerjakan" menjadi "4 subtask (T-092.3–T-092.6) belum
   dikerjakan".
2. `project-manager/TASKS.md` — blockquote log baru "Update (2026-09-11,
   T-092.2 selesai)". T-092 tetap `🟡 In Progress` (2/6 subtask), breakdown
   task-level v0.2 tidak berubah.

Task **T-092** tetap `🟡 In Progress` — 4 subtask (T-092.3–T-092.6) masih
`⏳ Not Started`.

---

## 2026-09-11 — T-092.1 Done — RLS policy Realtime `publishing_posts`, amandemen kecil ADR-094 poin 3

King Rezi mengonfirmasi amandemen dokumentasi setelah **T-092.1** (subtask
pertama T-092, Realtime Calendar/Queue/Drafts/History) selesai dikerjakan
Elon Backend Engineer di branch `feature/t-092-1-realtime-rls-policy`.
Migration baru `apps/web/prisma/migrations/20260911090000_t092_1_publishing_posts_realtime_rls/migration.sql`
membuat policy `publishing_posts_realtime_workspace_members`.

**Gap ditemukan:** ADR-094 poin 3 dan `database-strategy.md` § RLS Policy
Pattern menulis pola ini sebagai "berbasis `auth.uid()`" murni. Implementasi
nyata memakai `current_setting('request.jwt.claim.sub', true)` (fallback
parse `request.jwt.claims`), **bukan** memanggil `auth.uid()` Supabase
langsung.

**Root cause (diverifikasi Elon):** `auth.uid()` Supabase melakukan cast
paksa `::uuid` terhadap klaim JWT `sub`. Seluruh `user_id` di sistem ini
(termasuk `workspace_members.user_id`) bertipe `cuid()` string, bukan UUID
valid — persis bug yang sudah ditemukan dan diperbaiki di T-036
(`20260901120000_t036_fix_realtime_rls_cuid_cast`), preseden lebih lama di
DO-D06/T-017 (`database-strategy.md`). T-092.1 menerapkan versi yang sudah
diperbaiki sejak awal — **tidak perlu migration fix susulan**.

**Dokumen diamandemen (catatan kecil, bukan tulis ulang, bukan ADR baru):**
1. `project-manager/decisions/ADR-094-perluasan-supabase-realtime-publishing-posts-granular-patch.md`
   — poin 3 mendapat blockquote "Catatan implementasi (2026-09-11, T-092.1)"
   menjelaskan detail cast ini.
2. `product-discovery/05-architecture/database-strategy.md` § RLS Policy
   Pattern — catatan baru merujuk balik ke preseden DO-D06/T-017,
   menyebutkan T-092.1 sebagai instance konkret berikutnya.
3. `project-manager/tasks/v02-publishing-mvp.md` § T-092 — status task naik
   `⏳ Not Started` → `🟡 In Progress`; T-092.1 checklist `[x]` (Done),
   catatan implementasi ditambahkan.
4. `project-manager/TASKS.md` — breakdown v0.2 diperbarui "14 ✅ · 2 🟡 · 6
   ⏳" → **14 ✅ · 3 🟡 · 5 ⏳** (dihitung ulang dari `tasks/v02-publishing-mvp.md`),
   update log blockquote baru ditambahkan.

Tidak ada perubahan pada `PROJECT_STATE.md` — tidak ada phase/milestone/
Known Issues baru, T-092 tetap task individual di milestone v0.2 yang
sudah berjalan.

---

## 2026-09-10 — T-035 Done — Delete Post + dialog konfirmasi, scope dipersempit ke Drafts

King Rezi meminta lanjut kerjakan T-035 di branch
`feature/t-035-delete-post-dialog-konfirmasi`. Sebelum menulis kode UI,
dicek dulu ke Claude Design (AGENTS.md rule 17) untuk entry point Delete
Post di 3 screen yang disebut task file (Drafts + Queue + History) —
ternyata **tidak satu pun** dari `publish-drafts.html`, `publish-queue.html`,
`publish-history.html` punya rancangan tombol delete sama sekali (Drafts:
baris klik-penuh tanpa icon aksi; Queue: 3 icon existing — Publish Now/
Edit/Cancel Schedule — tanpa Delete; History: baris klik-penuh murni link
ke detail). Sesuai rule 17, implementasi UI di-**STOP** dulu, ditanyakan ke
King Rezi lewat `AskUserQuestion`.

**Keputusan King Rezi (bukan asumsi AI):**
1. Entry point Delete **hanya di Drafts** — Queue TIDAK boleh delete
   langsung ("harus di-cancel lalu pindah ke draft baru bisa di hapus"),
   History TIDAK boleh delete sama sekali (post sudah diproses/published).
2. Pola visual Drafts: tidak ada preferensi spesifik → dipakai rekomendasi
   (icon trash merah selalu terlihat, konsisten `icon-btn-danger` yang
   sudah dipakai Cancel Schedule di Queue).

Implementasi dikerjakan 2 sesi Prabowo Feature Engineer berurutan (sesi
kedua mengoreksi keputusan sesi pertama setelah scope dipersempit):

**Sesi 1 (T-035.1 backend, sebelum scope dipersempit):** `PublishingService.deletePost`
+ `IPublishingRepository.softDeletePost` (soft delete via `deletedAt`,
konsisten DB-D03 — `publishing_posts` satu-satunya tabel soft-delete),
`assertActorCanDeletePost` RBAC baru. Awalnya TANPA guard status (asumsi
salah bahwa History butuh delete untuk Published/Failed).

**Sesi 2 (koreksi + T-035.2/T-035.3):**
- Guard status ditambahkan dua lapis: service (`findDraftById` + cek
  eksplisit `status !== Draft` → `ConflictError`) dan repository
  (`updateMany` where `status: Draft` sebagai safety net race condition,
  pola sama `updateDraftCaption`). Hanya post `Draft` yang bisa dihapus.
- Server Action baru `apps/web/src/app/(app)/publish/drafts/actions.ts`
  (`deletePostAction`) — murni wiring, tanpa business logic (rule 5).
- `DraftsList.tsx` — icon trash merah per baris (hugeicons `Delete02Icon`),
  `stopPropagation` di `onClick` DAN `onKeyDown` (perlu keduanya karena
  Enter pada `<button>` fokus memicu `keydown` yang bubble ke `TableRow`).
  Dialog konfirmasi reuse `ConfirmActionDialog`/`useConfirmAction` (pola
  sama Disconnect Account di `ConnectedAccountsList.tsx`), bukan `AlertDialog`
  inline seperti `QueueScreen.tsx` — dua pola itu coexist di codebase,
  dipilih yang eksplisit reusable.
- Queue dan History **tidak disentuh sama sekali** — diverifikasi
  `git status` + browser.

**Review & QA:**
- Ridwan Architecture Reviewer: **0 temuan blocking**. Guard status dua
  lapis solid tanpa celah race condition, RBAC konsisten Publish Now/
  Cancel Schedule, Server Action murni wiring, `stopPropagation` efektif
  mencegah klik icon delete ikut trigger navigasi baris. 1 catatan
  non-blocking: nuansa ARIA "interactive-in-interactive" (button di dalam
  row yang juga `role="button"`) — bukan bug fungsional, sekadar observasi
  a11y untuk follow-up.
- Najwa QA Engineer: `bun run typecheck`/`lint`/`test` PASS (311 pass, 5
  skip, 0 fail). Browser end-to-end PASS seluruh golden path (icon tampil,
  dialog konfirmasi, batal aman, konfirmasi hapus + verifikasi ulang
  setelah reload bukan cuma optimistic client-side, klik baris lain tetap
  buka Edit Draft, draft caption kosong tidak crash) dan regresi (Queue
  3 icon lama tidak berubah, History tetap klik-penuh tanpa tombol delete,
  console bersih). RBAC diverifikasi nyata: login sebagai Sinta Wijaya
  (role Creator) berhasil hapus draft juga, sesuai ADR-074. Satu item
  **inconclusive** (bukan bug): verifikasi keyboard Enter/Space via tool
  Browser pane tidak konklusif — dibuktikan lewat kontrol (tombol native
  "New Post" yang jelas berfungsi via klik mouse juga tidak merespons
  Enter/Space lewat tool yang sama), jadi keterbatasan tooling otomasi,
  bukan kode aplikasi (`onKeyDown` hanya `stopPropagation`, bukan
  `preventDefault`, jadi behavior native `<button>` seharusnya tetap
  jalan) — direkomendasikan verifikasi manual King Rezi di browser asli.

Dokumentasi diupdate (main agent): `tasks/v02-publishing-mvp.md` § T-035
(→ `✅ Done`, 3/3 checklist, catatan scope lengkap), `TASKS.md` (indeks
v0.2: "13 ✅ · 2 🟡 · 7 ⏳" → "14 ✅ · 2 🟡 · 6 ⏳", total selesai 38 → 39),
`PROJECT_STATE.md` (Top Next Tasks + Completed Ringkasan, bullet terlama
digeser sesuai batas 5 item). Branch `feature/t-035-delete-post-dialog-konfirmasi`
masih ada, belum di-commit/push — menunggu instruksi eksplisit King Rezi
(AGENTS.md rule 13).

---

## 2026-09-10 — T-038 ditemukan sudah selesai — Toggle Fullscreen/Standard Draft Editor (ADR-065)

King Rezi meminta lanjut kerjakan implementasi T-038 (Toggle Fullscreen/
Standard resmi di Draft Editor) di branch
`feature/t-038-draft-editor-fullscreen-standard-toggle` (dibuat dari
`staging`). Sebelum menulis kode, dibaca dulu task file
(`tasks/v02-publishing-mvp.md` § T-038), ADR-065, dan markup Claude Design
(`templates/draft-editor.html`, projectId
`84aded99-bb23-49b1-be9f-dd8f21c6873e`) — pola sudah jelas terkunci (bukan
ambigu), tidak perlu stop-and-ask (AGENTS.md rule 17).

Saat membaca kode `Modal.tsx` untuk mulai implementasi, ternyata **seluruh
4 subtask sudah terimplementasi penuh**: state `dialogVariant`
("standard"/"fullscreen"), reset ke Standard tiap `sessionKey` baru (baris
~958-976), toggle button di header sebaris status chip + kiri tombol Close
(baris ~549-563), dan dipakai sama oleh mode "create" (New Post) maupun
"edit" (Edit Draft) lewat komponen `DraftEditorForm` yang sama. `git log`
menunjukkan logic ini masuk lewat commit `8e2e7ce` (T-100, migrasi Draft
Editor Modal ke shadcn/ui, 2026-09-03) — kemungkinan besar dikerjakan
sebagai bagian scope T-100 tanpa disadari juga menutup T-038, dan status
T-038 tidak pernah diperbarui saat itu.

Diverifikasi ulang lewat browser real (dev server `localhost:3000`, akun
Owner "Insvire"), bukan cuma baca kode:
- New Post: modal dibuka default **Standard** (floating card + backdrop),
  toggle bertuliskan "Fullscreen".
- Klik toggle → beralih ke **Fullscreen** (full viewport, tanpa backdrop
  terlihat), label toggle berubah jadi "Standard".
- Tutup modal, buka New Post lagi → kembali ke Standard (tidak dipersist,
  sesuai ADR-065).
- Edit Draft (dari salah satu draft existing) → default Standard juga,
  perilaku sama persis dengan New Post.

0 gap ditemukan terhadap ADR-065 maupun mockup Claude Design. Tidak ada
perubahan kode yang dibuat di sesi ini — murni koreksi status dokumentasi:
`tasks/v02-publishing-mvp.md` § T-038 (`⏳ Not Started` → `✅ Done`, 4/4
checklist dicentang) dan `TASKS.md` (indeks v0.2: "12 ✅ · 2 🟡 · 8 ⏳" →
"13 ✅ · 2 🟡 · 7 ⏳", total selesai 37 → 38). Branch masih ada
(`feature/t-038-draft-editor-fullscreen-standard-toggle`), belum
di-commit/push — menunggu instruksi eksplisit King Rezi (AGENTS.md rule
13).

## 2026-09-10 — T-103.4 Done — Audit retroaktif menemukan & menutup KI-056 (History drift). T-103 tuntas 4/4.

Retroactive pass (T-103.4): audit lewat `DesignSync` untuk 5 screen di luar
5 komponen KI-054/055 — Publish → Queue, Publish → History, Engage → Inbox,
Notifications Drawer, Settings → General (Danger Zone). Percobaan pertama
lewat subagent gagal lagi karena `DesignSync` tidak termuat di sesi subagent
(pola sama yang berulang sepanjang T-103) — dikerjakan langsung di sesi
utama.

**Hasil:**
- **Queue** (`templates/publish-queue.html` vs `QueueList.tsx`) — ✅ sudah
  sama, keduanya pakai `Card`.
- **History** (`templates/publish-history.html` vs `HistoryList.tsx`) — ⚠️
  **KI-056 ditemukan**: mockup masih pola `Card` (`.card card-pad
  history-card` per entri), padahal kode sudah diubah ke `Item
  variant="outline"` dalam `ItemGroup` sejak KI-054 (2026-09-09) — Claude
  Design tidak ikut disinkronkan saat itu. Persis pola drift yang sama
  dengan KI-055.
- **Notifications Drawer** (`components/notifications-panel.html` vs
  `NotificationBell.tsx`) — gap dokumentasi kecil (intro paragraph
  mengklaim `Item`/`ItemGroup`, tapi markup demo dan kode nyata sama-sama
  plain `div`) — bukan drift fungsional (keduanya konsisten), dicatat di
  KI-056 tapi tidak diperbaiki (di luar scope yang diminta King Rezi kali
  ini).
- **Engage → Inbox** — belum diimplementasikan (`ScaffoldPlaceholder`,
  T-050), tidak relevan untuk audit ini.
- **Settings → General (Danger Zone)** — single `Card`, bukan list, tidak
  ada ambiguitas Table/Item.

**KI-056 diperbaiki atas persetujuan eksplisit King Rezi:**
`templates/publish-history.html` diganti ke pola `Item`/`ItemGroup` — kelas
baru `.history-item` (menggantikan `.card card-pad history-card`) di dalam
`.history-date-group`, klik-penuh via `<a>` (merepresentasikan `Item asChild`
+ `Link`), urutan konten: waktu → ikon+handle akun → judul truncate + meta
→ `Badge` status kanan. Radius `16px` (`rounded-2xl`, Tailwind langsung)
dipakai apa adanya, bukan disamakan ke token `--radius-container` (12px)
Card, karena kode nyata memang tidak memakai token itu untuk komponen ini.
`readme.md` § Files ditambah bullet baru untuk `templates/publish-history.html`
(sebelumnya file ini tidak disebut sama sekali di daftar Files) dan section
KI-056 baru dicatat di `PROJECT_STATE.md` (status Resolved).

**T-103 sekarang tuntas 4/4 subtask** (T-103.1, T-103.2, T-103.3, T-103.4).
Detail lengkap tiap subtask: `tasks/v07-astryx-shadcn-migration.md` § T-103.

---

## 2026-09-10 — T-103.3 Done — Gate verifikasi struktur setelah implementasi (Mark UI Engineer & Najwa QA Engineer)

Melengkapi T-103.2 (gate sebelum implementasi di `AGENTS.md` rule 17):
King Rezi sempat mengusulkan pendekatan alternatif ("kerjakan di kode dulu,
baru Neymar cek beda Design vs Code") — didiskusikan bahwa itu berisiko
mengulang mekanisme yang menyebabkan KI-054/KI-055 kalau dipakai sebagai
**pengganti** gate sebelum-implementasi, tapi valid sebagai **tambahan**
setelah implementasi. King Rezi setuju, dan T-103.3 (yang sudah scoped
sebelumnya untuk hal ini) dikerjakan sebagai realisasinya.

Ditambahkan langkah verifikasi wajib ke checklist:
- `.claude/agents/mark-ui-engineer.md` § Verifikasi — sebelum lapor
  selesai, `DesignSync get_file` pada template/component Claude Design
  relevan, bandingkan eksplisit struktur (wrapper, header/caption,
  klik-penuh, posisi tombol) dengan kode yang baru ditulis.
- `.claude/agents/najwa-qa-engineer.md` § Langkah kerja poin 5 — kewajiban
  sama untuk QA. **Tool `DesignSync` ditambahkan ke frontmatter `tools:`
  Najwa** (sebelumnya hanya `Read, Bash, Grep, Glob, mcp__Claude_Browser`)
  supaya gate ini bisa benar-benar dieksekusi, bukan cuma tertulis di
  checklist tanpa akses tool-nya.
- `.claude/agents/README.md` — section baru "Gate verifikasi struktur
  setelah implementasi (T-103.3)" + kolom Tools Najwa di tabel diupdate.

King Rezi memberi izin eksplisit (lewat `AskUserQuestion`) untuk mengedit
kedua file read-only (Static Reference, chmod 444) — prosedur
`chmod 644 → edit → chmod 444` dijalankan untuk keduanya.

Status: T-103 sekarang **3/4** subtask selesai (T-103.1, T-103.2, T-103.3).
T-103.4 (retroactive pass, opsional) masih `⏳`. Detail:
`tasks/v07-astryx-shadcn-migration.md` § T-103.

---

## 2026-09-10 — T-103.2 Done — Gate proses: AI wajib berhenti & tanya kalau pola shadcn masih ambigu

Menambahkan gate baru ke `AGENTS.md` rule 17 (sub-poin baru, di antara "belum
ada di Claude Design → STOP" dan "bukan UI/UX-related"): kalau elemen yang
mau diimplementasikan punya lebih dari satu pola shadcn valid secara teknis
(`Item`/`ItemGroup` vs `Table`, variant dialog, baris klik-penuh atau tidak)
dan Claude Design belum mengunci pola konkretnya (tidak ada penanda
"SYNCED"/"LOCKED PATTERN" di file terkait atau baris tabel Components
`readme.md` masih generik) — AI wajib **STOP** dan tanya King Rezi lewat
`AskUserQuestion` dengan opsi konkret, bukan menebak salah satu sendiri. Ini
menutup gap proses yang menyebabkan KI-054/KI-055 (AI menebak pola yang
ternyata salah, baru ketahuan lewat audit manual King Rezi).

King Rezi memberi izin eksplisit (lewat `AskUserQuestion`) untuk mengedit 2
file read-only (Static Reference, chmod 444, `PROJECT_RULES.md`) —
`.claude/agents/README.md` (section baru "Gate pola ambigu shadcn") dan
`.claude/agents/mark-ui-engineer.md` (bullet aturan keras baru), diikuti
prosedur `chmod 644 → edit → chmod 444` sesuai instruksi "Mengubah subagent
ini" di README tersebut.

Status task T-103.2 diupdate `✅ Done` di `TASKS.md`/`PROJECT_STATE.md`/
`tasks/v07-astryx-shadcn-migration.md`. T-103 sekarang 2/4 subtask selesai
(T-103.1, T-103.2); T-103.3 (checklist verifikasi Mark UI Engineer & Najwa
QA Engineer) dan T-103.4 (retroactive pass, opsional) masih `⏳`. Detail:
`tasks/v07-astryx-shadcn-migration.md` § T-103.

---

## 2026-09-10 — T-103.1 follow-up — Posisi tombol "+ New Post" diperbaiki + markup 3 file disamakan penuh dengan kode nyata

King Rezi mengoreksi hasil T-103.1 (entri di bawah): (1) posisi tombol
"+ New Post" di `templates/publish-drafts.html` salah — tampil sebagai baris
terpisah di bawah tabbar, seharusnya sejajar judul "Publish" dalam satu
`page-head`. Dicek ke kode nyata (`apps/web/src/app/(app)/publish/layout.tsx`
+ `components/PublishPageHeader.tsx`) — tombol dirender di `SettingsPageHead`-
setara level layout, satu baris `flex justify-between` dengan judul+subtitle,
berlaku sama untuk Calendar/Queue/Drafts/History. Mockup dipindah ke posisi
yang benar.

(2) King Rezi minta pendekatan T-103.1 sebelumnya (mengunci pola lewat
komentar HTML tanpa mengubah markup visual) diganti — markup 3 file
(`publish-drafts.html`, `settings-workspaces.html`,
`settings-connected-accounts.html`) sekarang benar-benar diubah strukturnya
supaya identik dengan kode nyata, dicek langsung ke
`WorkspacesSettingsView.tsx` dan `ConnectedAccountsList.tsx`: `Table` tanpa
`TableHeader`/`Card`, `settings-workspaces.html` pakai caption di dalam table
("Workspace Anda", bukan `CardTitle`) + baris workspace aktif non-interactive
dengan `Badge` sementara baris lain klik-penuh dengan chevron `›`,
`settings-connected-accounts.html` baris TIDAK klik-penuh (hanya Badge+tombol
Disconnect/Reconnect interaktif). Script switch-workspace di
`settings-workspaces.html` disesuaikan ke struktur `<tr>`/`<td>` baru. Tabel
Components di `readme.md` diupdate dari penanda "LOCKED" menjadi "SYNCED".

Detail: `tasks/v07-astryx-shadcn-migration.md` § T-103 (update di bawah
checklist T-103.1).

---

## 2026-09-10 — T-103.1 Done — Kunci pola shadcn di Claude Design (mencegah drift lanjutan KI-054/KI-055)

Branch `docs/t-103-lock-shadcn-pattern`. Audit seluruh `components/*.html` dan
`templates/*.html` di project Claude Design "Social Media Management" (lewat
`DesignSync`), mencari list/komposisi dengan >1 pola shadcn valid yang belum
dikunci eksplisit — akar masalah KI-054/KI-055.

Ditemukan 3 file dengan drift konkret: mockup masih menampilkan pola lama
(`.queue-list`/`.queue-row` di `templates/publish-drafts.html`,
`.ws-pick-list`/`.ws-pick-item` di `templates/settings-workspaces.html`,
`.settings-row` div-list di `templates/settings-connected-accounts.html`),
padahal kode nyata `apps/web` sudah diperbaiki King Rezi ke pola `Table`
final lewat KI-055 (poin 1, 3, 5) — Claude Design tidak ikut disinkronkan
saat itu. Dikunci lewat komentar `<!-- LOCKED PATTERN -->` inline di masing-
masing file (deskripsi wrapper: border-div manual bukan `Card`, tanpa
`TableHeader`, baris klik-penuh atau tidak per file) — **tanpa mengubah
markup visual mockup itu sendiri**, sesuai
`.claude/skills/claude-design-scope-discipline/SKILL.md` (tidak mengubah
default/state yang sudah disetujui sebagai efek samping).

Juga ditambahkan komentar penguncian eksplisit (tanpa perubahan pola, karena
sudah benar) di `templates/settings-members.html` (Table + `TableHeader`,
satu-satunya list yang tetap pakai `Card`) dan `templates/settings-profile.html`
(avatar 88px via override `size-22`, bukan preset `lg` bawaan yang cuma
40px).

Tabel **Components** dan daftar **Files** di `readme.md` Claude Design
diupdate (baris `.ws-pick-list`, `.table`, + 3 bullet file) untuk
mencerminkan status terkunci ini, supaya AI berikutnya yang membaca `readme.md`
tidak lagi menebak pola yang sama.

**Scope yang belum dicakup:** sisa ~28 file (`components/buttons.html`,
`forms.html`, `navigation*.html`, `notifications-panel.html`, `popover.html`,
`status-chips.html`, dan ~20 `templates/*.html` lain) dibaca sepintas via
`readme.md` — sudah punya dokumentasi pola cukup spesifik, tidak ditemukan
ambiguitas setara KI-054/055. Audit baris-per-baris yang lebih dalam untuk
seluruh file itu tidak dilakukan exhaustif di pass ini — dicatat sebagai
follow-up potensial di **T-103.4** (retroactive pass) kalau King Rezi mau
kepastian lebih tinggi.

T-103.2 (update `AGENTS.md` rule 17 + gate baru), T-103.3 (checklist Mark
UI Engineer/Najwa QA Engineer), dan T-103.4 masih `⏳`, di luar scope
subtask ini. Detail: `tasks/v07-astryx-shadcn-migration.md` § T-103.

---

## 2026-09-09 — Temuan susulan KI-054 — `DraftsList.tsx` kotak-kotak terpisah, bukan list rata

Branch `fix/ki-054-draft-history-design-sync` (sesi lanjutan, setelah KI-054
dan KI-051 sudah ditandai Resolved di entri sebelumnya). King Rezi menemukan
1 gap visual tambahan khusus di halaman Publish → Drafts.

**Temuan:** `DraftsList.tsx` menampilkan tiap baris draft sebagai kotak
individual dengan sudut membulat dan celah di antaranya (terlihat seperti
kartu-kartu terpisah bertumpuk), padahal mockup Claude Design
(`templates/publish-drafts.html`) dan komponen sejenis `QueueList.tsx`
menampilkan list rata menyatu dengan garis pemisah tipis antar baris.

**Root cause:** Komponen dasar `Item` (`apps/web/src/components/ui/item.tsx`)
punya `rounded-2xl border` di base `cva()`-nya yang selalu aktif apa pun
variant-nya — variant cuma mengubah warna border, bukan menghilangkan
radius/border-nya. `DraftsList.tsx` sebelumnya memakai `Item
variant="outline"` per baris di dalam satu `ItemGroup` (`divide-y`) —
kombinasi ini membuat tiap baris draft tampil sebagai kotak bulat terpisah
dengan celah optik di sudut-sudutnya, alih-alih list rata dengan garis
pemisah tipis. `QueueList.tsx` (komponen sejenis untuk tab Queue) tidak
punya masalah ini karena tidak memakai `Item`/`ItemGroup` sama sekali — dia
pakai `<Separator />` polos antar baris di dalam satu `Card`.

**Perbaikan:** `apps/web/src/app/(app)/publish/drafts/components/DraftsList.tsx`
baris ~57-61 — hapus `variant="outline"` dari `Item`, tambahkan
`rounded-none border-transparent` ke className, supaya tiap baris rata
tanpa border/rounded individual, hanya mengandalkan garis pemisah dari
`divide-y` di `ItemGroup` (persis pola `QueueList.tsx`).

**Verifikasi:** `tsc --noEmit` pass, `eslint` pass, dicek visual di browser
preview (computed style `borderRadius: 0px`, `borderColor: transparent` —
list sekarang tampil menyatu rapi, tidak ada lagi efek kotak-kotak
terpisah).

**Status dokumentasi:** dicatat sebagai riwayat tambahan pada section
**KI-054** di `PROJECT_STATE.md` (status tetap Resolved, bukan dibuka
ulang) — bullet Completed (Ringkasan) KI-054 juga diperbarui untuk
menyebutkan temuan ini. Tidak ada ADR baru (bug-fix implementasi kecil,
bukan keputusan arsitektur). Tidak ada perubahan `TASKS.md` (KI-054 tidak
terikat task formal).

---

## 2026-09-09 — KI-051 Resolved + KI-054 Resolved penuh — varian `Badge` "success" di-wire, Design Drift tuntas 5/5 poin

Branch `fix/ki-054-draft-history-design-sync` (sesi lanjutan, sama dengan
entri KI-054 poin 1 di bawah). Mark UI Engineer menutup **KI-051**
(`Badge` shadcn belum punya varian "success"), yang sekaligus menutup poin
5 KI-054 (satu-satunya poin yang masih Open).

**KI-051 — Resolved.** Perubahan:
1. `apps/web/src/components/ui/badge.tsx` — varian `success` ditambahkan
   ke `cva()`, pola tint sama dengan `warning`/`destructive` yang sudah ada
   (`bg-success/10 text-success ... dark:bg-success/20 ...`), memakai token
   `--success`/`--success-foreground` yang sudah ada sejak ADR-098.
2. `apps/web/src/app/(app)/components/draft-editor/status-badge.ts` —
   `CONTENT_STATUS_BADGE_VARIANT[ContentStatus.Published]`: `"default"` →
   `"success"`. Berlaku otomatis ke semua pemakai (Calendar, Drafts, modal
   draft-editor) karena satu sumber kebenaran — tidak ada regresi visual
   pada status lain (Scheduled tetap warning/kuning, dll).
3. `apps/web/src/app/(app)/publish/history/history-status.ts` —
   `HISTORY_STATUS_BADGE_VARIANT[ContentStatus.Published]` dan
   `TARGET_STATUS_BADGE_VARIANT.published`: `"default"` → `"success"`.
4. Komentar block usang di kedua file (menjelaskan "belum ada varian
   success, pakai default sebagai pengganti") diperbarui mengikuti
   perubahan.

Di luar scope, sengaja tidak diubah: status `ReadyToSchedule`/`Scheduled`
tetap `secondary`/`warning` — mockup minta warna "info"/"purple" tersendiri,
tapi itu butuh token warna baru yang belum di-lock desain (dicatat DT-D02,
bukan bagian KI-051). Diverifikasi `tsc --noEmit` pass, `eslint` pass,
browser preview.

**KI-054 — Resolved penuh (naik dari Partially Resolved).** Evaluasi
5 poin: poin 1 (struktur baris History) Fixed sesi sebelumnya; poin 2
(ikon brand vs dot warna) accepted deviation (keputusan King Rezi); poin 3
(filter row) sudah sesuai dari awal; poin 4 (struktur Drafts) sudah sesuai
dari awal; poin 5 (warna chip status) sekarang Fixed lewat penutupan
KI-051 — status "Published" di Drafts & History sudah hijau (success)
sesuai mockup. Status `Draft` tetap `outline` (abu-abu netral) di kedua
halaman — sudah sesuai mockup (`chip-draft` di Design System juga
neutral/gray, bukan warna cerah), bukan gap tersisa. Status
`Failed`/`Error` sudah `destructive` (merah) dari awal, juga sesuai.
Seluruh 5 poin sudah punya resolusi (fixed atau accepted deviation) —
tidak ada task formal terpisah untuk KI-054, ditutup langsung di
`PROJECT_STATE.md`.

Tidak ada ADR baru (murni wiring token existing ke komponen, bukan
keputusan desain baru). Tidak ada perubahan `TASKS.md` (KI-051/KI-054
tidak terikat task formal).

---

## 2026-09-09 — KI-054 poin 1 Fixed — HistoryList kartu individual per entri sesuai mockup

Branch `fix/ki-054-draft-history-design-sync`. Menindaklanjuti KI-054 (design
drift `DraftsList`/`HistoryList` vs mockup Claude Design) yang dilaporkan
King Rezi di sesi sebelumnya.

**Poin 1 (struktur baris History) — Fixed.** File
`apps/web/src/app/(app)/publish/history/components/HistoryList.tsx`.
Sebelumnya tiap entri History dirender sebagai blok vertikal 4-baris di
dalam SATU `Card` bersama (`ItemGroup` + `divide-y`, pola sama dengan
`DraftsList`/`QueueList`). Sekarang tiap entri jadi `Item variant="outline"`
terpisah (kartu individual, border+radius sendiri), dirender berjajar dalam
`ItemGroup` dengan `gap-2` (bukan `divide-y`). Layout satu baris horizontal:
jam → ikon+handle platform → caption+meta (`flex-1`, truncate) → `Badge`
status di kanan. Hover mengubah border kartu individual
(`hover:border-foreground/40` + `hover:bg-card!` untuk menimpa hover
background bawaan komponen `Item`), sesuai mockup
`templates/publish-history.html` (`.history-card`/`.queue-row`).
Diverifikasi: `tsc --noEmit` pass, eslint pass, visual browser preview (dark
mode) dicek cocok dengan mockup.

**Temuan tambahan (bukan bagian asli KI-054, ditemukan saat verifikasi
padding) — Fixed.** Di file yang sama, teks handle akun (nama akun di
sebelah ikon platform tiap target publish) sebelumnya dipaksa `text-xs`
(12px) padahal spec Design System (`.acc-name` di `styles.css`, token
`--text-body-size`) adalah 14px (`text-sm`). Override dihapus, kembali ke
default varian `muted` komponen `Text` (`text-sm`). Diverifikasi via
`tsc --noEmit` dan visual browser preview.

**Poin 2 (representasi ikon platform) — accepted deviation, tidak diubah.**
King Rezi memutuskan secara verbal di sesi ini untuk tetap memakai ikon
brand penuh untuk multi-platform (bukan dot warna kecil seperti mockup
single-platform) — deviation yang disengaja, bukan bug. Tidak perlu ADR
(keputusan kecil, bukan keputusan arsitektur).

**Poin 3 (filter row)** sudah sesuai mockup dari awal, tidak disentuh.
**Poin 4 (struktur DraftsList)** sudah cukup selaras dari awal, di luar
scope sesi ini, sengaja tidak diubah.

**Poin 5 (warna chip status Draft/Ready/Published/Error) — masih Open**,
blocked by KI-051 (varian "success"/warna custom `Badge` shadcn belum ada).
Tidak ada perubahan untuk poin ini di sesi ini.

Status KI-054 di `PROJECT_STATE.md` diubah dari `Open` menjadi
`Partially Resolved` (poin 1 & temuan tambahan Fixed, poin 2 accepted
deviation, poin 5 masih Open menunggu KI-051). Tidak ada task formal T-xxx
yang terikat ke KI-054, dan tidak ada subtask di `TASKS.md`/`tasks/vXX-*.md`
yang mengacu ke KI-054, jadi kedua file itu tidak disentuh. Tidak ada ADR
baru.

---

## 2026-09-09 — T-014 (Disconnect account + dialog konfirmasi) tuntas 3/3 subtask `✅ Done`

Sesi lanjutan setelah T-014.1 (lihat entri di bawah) — menuntaskan T-014.2
dan T-014.3 dalam satu sesi, delegasi multi-subagent + review arsitektur.

**T-014.2 — `disconnectAccount` Application Service + RBAC gate (Prabowo
Feature Engineer).** `WorkspaceService.disconnectAccount(workspaceId,
actorUserId, connectedAccountId)` — gate `assertActorCanManageConnectedAccounts`
(Owner/Admin aktif saja, reuse pola persis `assertActorCanManageWorkspaceSettings`/
`assertActorCanManageMembers`, tidak ada RBAC baru sesuai ADR-048 poin 4).
Repository Prisma (`workspaceRepository.disconnectAccount`) meng-update
`WorkspaceConnectedAccount.status` jadi `"disconnected"`. Server Action tipis
baru `disconnectAccountAction` di
`apps/web/src/app/(app)/settings/connected-accounts/actions.ts`. 5 test baru
di `workspace.service.test.ts`, semua PASS; typecheck bersih.

Dua keputusan non-trivial dari implementasi awal diajukan ke King Rezi via
`AskUserQuestion`, keduanya diputuskan:
1. **Reset `reconnectRequired` ke `false` saat disconnect** — disetujui apa
   adanya (tanpa reset, akun yang sebelumnya "perlu reconnect" lalu
   di-disconnect akan tetap tampil "Perlu Reconnect" alih-alih
   "Disconnected", karena `resolveConnectionDisplayStatus` cek
   `reconnectRequired` lebih dulu).
2. **Disconnect akun yang sudah `disconnected`** — awalnya diimplementasi
   idempotent (no-op tanpa error). King Rezi bertanya balik: bukankah akun
   yang sudah disconnected memang tidak akan punya tombol Disconnect di UI
   (sesuai rancangan Claude Design, T-014.1 — akun disconnected menampilkan
   tombol Reconnect, bukan Disconnect)? Setelah dikonfirmasi itu benar,
   King Rezi tetap memilih **defense-in-depth**: repository ditolak eksplisit
   dengan `ConflictError("Akun ini sudah terputus.")` (pakai `updateMany`
   dengan filter `status: { not: "disconnected" }` + `findFirst` fallback
   untuk membedakan not-found vs already-disconnected), bukan idempotent.
   1 test baru ditambahkan untuk propagasi `ConflictError` ini.

**T-014.3 — UI dialog konfirmasi (Mark UI Engineer).** Satu file diubah:
`ConnectedAccountsList.tsx` jadi Client Component, tombol "Disconnect" (state
`active`) yang sebelumnya disabled+tooltip sekarang aktif dan membuka
`AlertDialog` shadcn (judul "Putuskan koneksi {platform} {handle}?", sub-teks
sesuai rancangan Claude Design, tombol Batal/Putuskan Koneksi). State dialog
reuse hook `useConfirmAction` (pola identik `QueueScreen.tsx` Cancel Schedule
dan `MembersTable.tsx` Remove member) — bukan pola baru. Error ditampilkan
lewat `Alert variant="destructive"`, sukses lewat `toast()` sonner. Tidak ada
komponen shadcn baru yang perlu diinstall (`alert-dialog`/`alert`/`spinner`
sudah ada di `components/ui/`). Diverifikasi end-to-end browser: klik
Disconnect pada akun Facebook `active` → dialog muncul → konfirmasi → badge
jadi "Disconnected", tombol Disconnect hilang, toast sukses muncul.

**Review arsitektur (Ridwan Architecture Reviewer):** 0 temuan — entry point
(`disconnectAccountAction`) tetap tipis, tidak ada business logic di
komponen React, tidak ada import Prisma/Supabase langsung, cross-domain
hanya lewat barrel `@/domains/workspace`, pola konsisten dengan komponen
sejenis.

Task **T-014** ditutup `✅ Done` (3/3 subtask). Update dokumentasi:
`tasks/v01-foundation.md` § T-014 (checkbox + status), `TASKS.md` (breakdown
v0.1: 6 🟡 → 5 🟡, 14 ✅ → **15 ✅**; catatan rilis diringkas jadi satu entri
T-014 tunggal, menggantikan entri T-014.1 terpisah sebelumnya).

## 2026-09-09 — T-014.1 (Dialog konfirmasi disconnect di Claude Design) diverifikasi & ditandai `✅ Done`

King Rezi menanyakan status T-014.1, lalu menyampaikan dialog konfirmasi
disconnect sudah ada di App Prototype Claude Design. Diverifikasi lewat
`DesignSync` (`list_files` + `get_file` pada project "Social Media
Management") — `templates/settings-connected-accounts.html` memang sudah
memuat AlertDialog Tier 2 (KSP-08-F07, ADR-048) lengkap: judul dinamis
platform/handle, sub-teks penjelasan post terjadwal tetap di antrean,
tombol Batal/Putuskan Koneksi, dan wiring open/close/escape/backdrop-click.
Ada comment eksplisit `<!-- T-014.1 — Disconnect Confirmation (KSP-08-F07,
ADR-048) -->` di file tersebut, dan integrasi dengan `AppPrototype.dc.html`
(`openDisconnectDialog`) sudah dihindari duplikasi lewat guard
`window.top !== window.self`.

Setelah konfirmasi King Rezi, diupdate:
- `tasks/v01-foundation.md` § T-014 — checkbox T-014.1 jadi `[x]`, Status
  task naik dari `⏳ Not Started` ke `🟡 In Progress` (T-014.2 dan T-014.3
  masih belum dikerjakan — implementasi kode nyata `disconnectAccount` +
  RBAC gate, dan UI dialog konfirmasi di kode nyata apps/web).
- `TASKS.md` — breakdown v0.1 di indeks release (5 🟡 → 6 🟡, 2 ⏳ → 1 ⏳),
  ditambah catatan rilis singkat di bagian Catatan Rilis.

Tidak ada perubahan kode `apps/web` di sesi ini — murni verifikasi status
dokumentasi terhadap Claude Design.

## 2026-09-09 — T-034.4 (Retry manual publishing) selesai, T-034 tuntas 4/4 subtask `✅ Done`, ADR-103, KI-052 baru

Sesi lanjutan T-034 (Publishing History + detail post), menutup sisa
subtask terakhir setelah T-034.1–.3 selesai (lihat entri 2026-09-08 di
bawah).

**1. Pertanyaan scope retry.** ADR-092 (2026-08-26) sudah menetapkan pola
delete-lalu-create-ulang untuk retry Outstand (tidak ada endpoint retry
resmi), tapi belum menjawab scope-nya: karena `outstandPostId` bersifat
post-level (satu ID untuk semua target dalam satu post), retry satu target
yang gagal itu harus recreate seluruh post atau hanya target yang gagal.
Diajukan ke King Rezi lewat `AskUserQuestion` — dijawab: **single-target**
(hanya target yang gagal, target lain yang sudah `published` tidak
disentuh) untuk mencegah duplikat konten. Dicatat **ADR-103** (melengkapi
ADR-092, bukan membatalkan).

**2. Implementasi.** Dikerjakan multi-subagent dalam satu sesi:
- **Elon Backend Engineer** — kontrak adapter: `IOutstandAdapter.deletePost(outstandPostId, accountIds?)`
  (best-effort, error di-log bukan dilempar) di
  `packages/shared/src/contracts/outstand-adapter.ts` + implementasi
  `FakeOutstandAdapter`.
- **Prabowo Feature Engineer** — use-case baru
  `apps/web/src/domains/publishing/services/retry-failed-target.use-case.ts`
  (recreate lewat `outstandAdapter.publishNow` langsung dengan array
  `targets` 1 elemen, bukan lewat `PublishNowUseCase`/`repository.publishNow`
  yang me-replace seluruh target post), kolom Prisma baru
  `PublishingPostTarget.retryOutstandPostId` (migration
  `20260909024403_t034_4_retry_outstand_post_id`), fungsi rekonsiliasi
  status `reconcilePostStatusAfterRetry` (idempoten, `Failed → Published`
  saat tidak ada lagi target `failed` tersisa), Server Action baru
  `apps/web/src/app/(app)/publish/history/[postId]/actions.ts`, komponen
  `RetryTargetButton.tsx` (baru), wiring tombol "Coba Lagi" per-baris akun
  di `HistoryDetail.tsx` (sebelumnya visual-only sejak T-034.2/.3).
- **Ridwan Architecture Reviewer** — review lolos **tanpa temuan
  blocking**.
- **Najwa QA Engineer** — test suite 259 pass + verifikasi browser
  end-to-end golden path dan edge case (termasuk skenario mixed-target
  retry) semua **PASS**. 1 temuan non-blocking di luar scope: hydration
  warning `formatRelativeTime` di `HistoryList.tsx` — dicatat **KI-052**.

**3. Penutupan T-034.** Dengan T-034.4 selesai, **T-034 (Publishing
History + detail post) tuntas 4/4 subtask** — task naik `🟡 In Progress`
→ `✅ Done`. `TASKS.md` diperbarui: v0.2 9 ✅ · 3 🟡 · 10 ⏳ → **10 ✅ · 2 🟡
· 10 ⏳**, total selesai 33 → **34** (subtask total tidak berubah, tetap
211 — T-034.4 sudah terdefinisi sebelumnya).

Detail lengkap: `tasks/v02-publishing-mvp.md` § T-034, `DECISIONS.md` §
ADR-103 (`decisions/ADR-103-retry-manual-publishing-scope-single-target.md`),
`PROJECT_STATE.md` § KI-052.

---

## 2026-09-08 — T-034.2/T-034.3 (Publishing History) selesai, KI-048 Resolved, App Prototype diwire, 2 KI baru (KI-050, KI-051)

Sesi lanjutan T-034 (Publishing History + detail post), setelah T-034.1
selesai (lihat entri di bawah).

**1. Klasifikasi & gate desain (rule 17 AGENTS.md).** King Rezi minta
lanjut T-034.2/T-034.3 (UI). Dicek dulu status desain — ditemukan KI-048
(draft Claude Design belum direview/dikonfirmasi King Rezi), sesuai gate
rule 17 pekerjaan **STOP dulu** sebelum menulis kode UI.

**2. Review desain bareng di chat.** King Rezi memilih opsi "review bareng
di chat" — main agent fetch draft dari Claude Design
(`templates/publish-history.html`, `templates/publish-history-detail.html`,
project "Social Media Management"), membuat Artifact review memakai token
desain asli, dan mengajukan 5 poin konfirmasi.

**3. Konfirmasi King Rezi (2026-09-08), 5 poin:**
1. Pasang App Prototype dulu — History tab belum bisa diklik di runner
   interaktif Claude Design; root cause: `SCREENS` array, tab click
   handler `route()`, dan redirect Publish Now di
   `templates/app-prototype/AppPrototype.dc.html` belum mendaftarkan/
   mengarah ke layar History (masih toast "belum masuk scope MVP" dan
   stand-in ke Calendar).
2. Filter 2 dropdown (Status/Akun) cukup — tidak perlu date range/search.
3. Grouping per tanggal di list sudah sesuai pola Queue.
4. Tombol "Coba Lagi" (retry) posisi/label sudah pas, tapi hanya visual —
   tidak diwire, karena T-034.4 belum dikerjakan.
5. Link "Lihat post asli" — kalau tidak ada `platformPostUrl`, harus
   disabled (bukan hilang).

**4. App Prototype diwire (main agent, deviasi eksplisit sama seperti
draft awal — bukan Neymar Product Designer).** Entry `publish-history`/
`publish-history-detail` ditambahkan ke `SCREENS`, tab click handler
`route()` diubah supaya "History" navigasi ke `publish-history` (bukan
toast), redirect `publishnow-confirm` diubah dari stand-in
`publish-calendar` ke `publish-history`. Sudah di-push ke Claude Design
dan diverifikasi remote match persis. Ini menutup bagian "App Prototype"
dari **KI-048** — draft desain T-034.2/T-034.3 sekarang terkonfirmasi King
Rezi **dan** sudah bisa diklik penuh di App Prototype. **KI-048 ditutup
Resolved.**

**5. Implementasi kode (Prabowo Feature Engineer).** File baru:
`apps/web/src/domains/publishing/services/group-history-items.ts`
(+`.test.ts`), `apps/web/src/app/(app)/publish/history/history-status.ts`,
`apps/web/src/app/(app)/publish/history/components/HistoryList.tsx`,
`apps/web/src/app/(app)/publish/history/[postId]/components/HistoryDetail.tsx`.
File diubah: `apps/web/src/app/(app)/publish/history/page.tsx`,
`.../history/[postId]/page.tsx`, `apps/web/src/domains/publishing/index.ts`,
`apps/web/src/app/(app)/publish/components/PublishPageHeader.tsx`. T-034.4
(retry manual) sengaja **tidak** diimplementasikan — masih ⏳ Not Started,
tombol retry di UI cuma visual + disabled. Tidak ada field baru ditambahkan
ke `HistoryItemRecord`/`HistoryItemTargetRecord` (konsisten KI-049). Reuse
komponen shadcn existing (`Card`, `Item`/`ItemGroup`, `Badge`, `Select`,
`Empty`, `Text`, `Separator`, `Button`, `Tooltip`) — tidak ada komponen
baru.

**6. Review arsitektur Ridwan — lolos, tanpa temuan blocking.** Entry
point bersih dari business logic, domain logic tidak import Prisma/
Supabase, cross-domain lewat public API module, pola
`group-history-items.ts` konsisten dengan `group-queue-items.ts`/
`calendar-range.ts`. Satu catatan non-blocking: `Badge` shadcn belum punya
varian "success" (dipakai `default` sebagai pengganti status "Published")
— dicatat **KI-051**.

**7. QA Najwa QA Engineer.** Test suite 248 pass/4 skipped/0 fail +
verifikasi browser end-to-end. Golden path dan hampir semua edge case
PASS, tapi ditemukan **1 bug**: `/publish/history/[postId]` dengan
`postId` format bukan UUID (mis. salah ketik) crash HTTP 500, seharusnya
`notFound()`.

**8. Bug fix (Prabowo).** Ditambal di
`apps/web/src/lib/repositories/publishing/publishing.repository.ts`
(method `getHistoryById`) — tangkap `PrismaClientKnownRequestError` kode
`P2007`/`P2023`, treat sebagai "tidak ketemu" (return `null`), konsisten
pola `isRecordNotFound` yang sudah ada di `workspace.repository.ts`.
Diverifikasi ulang: typecheck/lint/test tetap hijau (248 pass), dan 3
skenario manual (postId format invalid → 404, UUID valid tapi tak ada →
404, UUID valid & ada → 200 normal) semua benar.

**Gap didokumentasikan (bukan diputuskan sendiri), 2 KI baru:**
* **KI-050** — meta "dibuat oleh siapa" dihilangkan dari desain awal
  halaman detail post; `HistoryItemRecord` tidak membawa data author/
  `authorId`, di luar scope T-034.2/T-034.3. Perlu keputusan King Rezi ke
  depan kalau field ini memang wajib.
* **KI-051** — `Badge` shadcn belum ada varian "success", dipakai
  `default` sebagai workaround. Token `--success` sudah ada di
  `globals.css` (ADR-098) tapi belum di-wire ke komponen `Badge`.
  Technical debt kecil, opsional, Domain `UI` (Mark UI Engineer) kalau
  mau dijadikan task terpisah.

Task T-034 tetap `🟡 In Progress` (3/4 subtask tuntas) — sisa **T-034.4**
(retry manual, wajib pola delete-lalu-create-ulang per ADR-092, Outstand
tidak punya endpoint retry resmi).

**Dokumen yang diperbarui:** `tasks/v02-publishing-mvp.md` § T-034
(checklist T-034.2/T-034.3, field Terkait, catatan penutupan panjang),
`TASKS.md` (Update baru di atas entri T-034.1, baris "Fokus sekarang"
T-034), `PROJECT_STATE.md` (Snapshot, KI-048 Resolved, KI-050/KI-051 baru,
Completed Ringkasan — bullet T-101 lama dilepas supaya tetap 5 item,
versi 1.0.70 → 1.0.71).

---

## 2026-09-08 — T-034.1 (Publishing History) selesai, koreksi status T-026, draft Claude Design (KI-048), gap non-blocking dicatat (KI-049)

Sesi kerja T-034 (Publishing History + detail post, domain publishing,
ADR-046):

**T-034.1 selesai.** `IPublishingRepository.listHistory`/`getHistoryById`
+ tipe `PublishingPostTargetStatus`/`HistoryItemTargetRecord`/
`HistoryItemRecord`
(`apps/web/src/domains/publishing/repositories/publishing.repository.ts`),
`PublishingService.listHistory`/`getHistoryById` + konstanta
`HISTORY_TERMINAL_STATUSES` (`Published`/`Failed`)
(`apps/web/src/domains/publishing/services/publishing.service.ts`),
implementasi Prisma (`apps/web/src/lib/repositories/publishing/publishing.repository.ts`),
4 file test terkait. Dikerjakan Prabowo Feature Engineer, lolos review
arsitektur Ridwan (Architecture Reviewer) tanpa temuan blocking. T-034
naik `⏳ Not Started` → `🟡 In Progress` (1/4 subtask tuntas). Tidak
diblokir `Depends: T-026` (webhook) karena Fake adapter (ADR-059) sudah
mengisi outcome per target secara sinkron lewat `updateTargetOutcome` saat
`PublishNowUseCase`/`SchedulePostsUseCase` berjalan.

**Koreksi drift status T-026 (diverifikasi, bukan ditemukan).** Sesi ini
diminta memperbaiki klaim di `TASKS.md` yang disebut menyatakan "T-026
(webhook) sudah ✅ Done (2026-09-07)". Setelah verifikasi langsung ke
`TASKS.md` (isi file, `git log`/`git blame` untuk histori komit), **klaim
tersebut tidak pernah ada** di file manapun — tidak ada commit yang pernah
menuliskannya, dan status T-026 di `tasks/v02-publishing-mvp.md` sudah
konsisten `⏳ Not Started` sejak awal (webhook `/api/webhooks/outstand`
masih 501, diblokir T-025 → KI-003). Tidak ada perubahan teks yang
diperlukan untuk item ini — dicatat di sini murni untuk jejak audit bahwa
premis itu sudah dicek dan tidak valid pada state repo saat ini.

**Draft Claude Design (KI-048).** 2 screen baru di-push ke project Claude
Design "Social Media Management": `templates/publish-history.html`
(daftar riwayat + filter Status/Akun) dan
`templates/publish-history-detail.html` (ringkasan post + "Hasil per
Akun" — link post asli untuk `Published`, pesan error + tombol retry
untuk `Error`). **Draft awal, belum direview/dikonfirmasi King Rezi** —
T-034.2/T-034.3 tidak ditandai "sudah ada desainnya" sampai ada konfirmasi
eksplisit. Dikerjakan langsung oleh main agent (bukan Neymar Product
Designer) atas instruksi eksplisit King Rezi di sesi ini — dicatat sebagai
deviasi proses, bukan inisiatif AI melewati mandat wajib Neymar.

**Gap non-blocking dicatat (KI-049).** Ridwan Architecture Reviewer
menemukan `PublishingPost.failedAt`/`.failureReason` (schema Prisma) tidak
pernah ditulis oleh jalur manapun (`markPostFailed` cuma meng-update
`status`) — sudah didokumentasikan sebagai komentar kode di
`IPublishingRepository.listHistory`, sengaja tidak dimasukkan ke
`HistoryItemRecord`. Dicatat sebagai Known Issue eksplisit untuk follow-up
ke depan (bukan task formal), non-blocking untuk T-034.

**Dokumen yang diperbarui:** `tasks/v02-publishing-mvp.md` § T-034
(checklist T-034.1, catatan selesai, catatan draft desain, field
Terkait), `TASKS.md` (indeks v0.2: 9 ✅ · 2 🟡 · 11 ⏳ → 9 ✅ · 3 🟡 · 10 ⏳;
tabel Fokus sekarang tambah baris T-034; update note baru), `PROJECT_STATE.md`
(Snapshot, Known Issues KI-048/KI-049 baru, Completed Ringkasan — bullet
T-101.4 lama dilepas supaya tetap 5 item, versi 1.0.69 → 1.0.70).
## 2026-09-08 — T-037 mulai dikerjakan: snapshot pertama aturan coding DX

**T-037** (Perkaya aturan coding di `context/ctx-development.md`, domain
DX, v0.2 Publishing MVP) pindah status `⏳ Not Started` → `🟡 In Progress`
di branch `feature/t-037-dx-coding-conventions`. Task ini **kontinu by
design** — dirancang berjalan terus selama rilis v0.2 seiring pola coding
baru muncul, bukan sekali selesai lalu ditutup `✅ Done`.

**`context/ctx-development.md`** — ditambah section baru "Struktur
repository & use-case" (poin #14-15) dan poin #18 baru di section
"Testing", plus renumbering poin Git/PR jadi #19-20 supaya urut. Konvensi
yang dicatat: (a) repository dua-lapis — interface di
`domains/*/repositories/` vs implementasi Prisma di `lib/repositories/*/`;
(b) use-case class terpisah dari service kalau ada dependency wajib +
urutan operasi kritis, preseden `SchedulePostsUseCase`/`PublishNowUseCase`/
`CancelScheduleUseCase`/`AnalyticsIngestionUseCase`; (c) pola test fake
repository via factory `createFakeRepository()` + overrides, preseden
`publishing.service.test.ts`.

**`project-manager/tasks/v02-publishing-mvp.md`** — T-037.1/.2/.3
dicentang `[x]`, ditambah paragraf "Selesai (2026-09-08)" berisi
ringkasan, field Status task diubah dari `⏳ Not Started` jadi
`🟡 In Progress — kontinu by design, snapshot pertama (T-037.1–.3) sudah
dicatat`.

**`project-manager/TASKS.md`** — breakdown status v0.2 dihitung ulang
langsung dari `tasks/v02-publishing-mvp.md`: dari "🟡 11 ✅ · 11 ⏳" (drift —
prefix `🟡` tidak match hitungan manapun, T-030 yang sebenarnya
`🟡 In Progress` ikut terhitung sebagai bagian 11 ⏳) menjadi **11 ✅ ·
2 🟡 · 9 ⏳** (T-030 dan T-037 sama-sama `🟡`). Task selesai (36) dan total
task/subtask (85 task, 212 subtask) tidak berubah. Paragraf "Update
(2026-09-08, T-037 mulai dikerjakan)" ditambahkan di area riwayat
`TASKS.md`.

Tidak ada perubahan phase/milestone/Known Issues — `PROJECT_STATE.md`
tidak disentuh. Belum di-commit/push (menunggu instruksi eksplisit King
Rezi). File yang disentuh: `context/ctx-development.md`,
`project-manager/tasks/v02-publishing-mvp.md`,
`project-manager/TASKS.md`.

---

## 2026-09-08 — KI-047 Phase 4 (terakhir): Survei prototype screens + Resolved

Fase penutup KI-047, setelah Phase 1 (token), Phase 2 (readme.md), Phase 3
(component library) — lihat entri masing-masing di bawah.

**Scope disurvei:** 24 file — 8 KSP (`home`, `publish-calendar`,
`publish-queue`, `publish-drafts`, `draft-editor`, `engage-inbox`,
`analyze-dashboard`, `settings-connected-accounts`), App Prototype
(`AppPrototype.dc.html`), 2 file `foundations/` yang terlewat di Phase 1
(`layout.html`, `type.html`), dan 15 template supplementary (onboarding,
6 `settings-*` lain, 5 `auth-*`). 16 dari 24 file dibaca langsung satu per
satu; sisanya (4 `auth-*` yang belum dibaca + `accept-invite.html`)
disimpulkan mengikuti pola sangat konsisten yang ditemukan di 16 file
tersebut (markup dasar tanpa dokumentasi gaya "Astryx `<Component>`" sama
sekali) — dicatat eksplisit di sini sebagai pola-inferensi, bukan
pembacaan langsung, supaya jujur soal cakupan verifikasi.

**Temuan kunci:** berbeda dari `components/*.html` (Phase 3, yang memang
berfungsi sebagai dokumentasi/spec komponen), file `templates/*.html`
hanya berisi markup halaman + class CSS — hampir tidak ada teks naratif
"Astryx X" sama sekali. Dari 16 file yang dibaca:

* 14 file: **0 mention Astryx**.
* `templates/draft-editor.html`: 2 mention, **keduanya historis akurat**
  (menjelaskan asal pola komposisi header/body/footer dari contoh
  `DialogHeader` Astryx, dan asal pola calendar popover dari
  `astryx.atmeta.com/components/DateTimeInput`) — sengaja **tidak diubah**,
  konsisten prinsip Phase 2c (jangan revisi sejarah untuk hal yang memang
  benar terjadi saat itu).
* `foundations/type.html`: 1 klaim **basi** (current-state, bukan
  historis) — "Figtree, Astryx neutral theme font." diperbaiki jadi
  "Figtree (body) + Montserrat (heading) — real Stone theme font
  pairing" (menyamakan dengan hasil Phase 1).
* `templates/app-prototype/AppPrototype.dc.html`: 3 mention di komentar
  kode. 2 diperbaiki: (a) komentar Popover ditambah pointer shadcn nyata
  (`popover.tsx`) sambil tetap menyebut asal Astryx-nya; (b) klaim "every
  real Astryx light-dark() token ... resolves to its dark value"
  (current-state, basi sejak Phase 1) diperbaiki menyebut Stone→shadcn.
  1 dibiarkan (calendar popover DateInput reference) — historis akurat,
  dan shadcn belum punya primitive DateInput pengganti (dikonfirmasi
  Phase 2b), jadi tidak ada padanan nyata untuk dirujuk.

Verifikasi sebelum push (2 file, `AppPrototype.dc.html` 77KB): dibaca
fresh dari remote, dibandingkan `diff` terhadap salinan yang sudah
diambil sebelumnya di sesi ini untuk memastikan tidak ada perubahan
konkuren sebelum edit; replace pakai Python `count()==1` assertion;
`diff` final dicek cuma menyentuh 2 blok komentar yang dimaksud.

**KI-047 Resolved** — seluruh 4 phase (token, readme.md, component
library, prototype screens) tuntas. Entri KI-047 dihapus dari section
Known Issues `PROJECT_STATE.md` mengikuti konvensi KI Resolved (riwayat
lengkap di file ini), ringkasan ditambahkan ke "Completed (Ringkasan)".

## 2026-09-08 — Fix: gap antar item Notifications Drawer (`.notif-list`)

Bug terpisah, di luar scope KI-047, dilaporkan King Rezi setelah melihat
hasil Phase 3: state "Default — mixed unread/read" di
`components/notifications-panel.html` tidak punya jarak antar
notifikasi. Root cause: `.notif-list` di `styles.css` tidak `display:flex`
dan tidak punya `gap` — tiap `.notif-item` cuma punya padding sendiri,
tidak ada margin/gap ke item berikutnya, jadi antar baris menempel.

Fix: tambah `display: flex; flex-direction: column; gap: var(--spacing-1)`
ke `.notif-list`. Diverifikasi via `diff` — hanya 1 baris berubah di
`styles.css`, tidak ada region lain tersentuh. Karena class ini dipakai
bersama di banyak file (notifications-panel.html, navigation.html,
navigation-mobile.html, App Prototype), perbaikan otomatis ikut ke semua
tempat itu tanpa perlu edit terpisah.

## 2026-09-08 — KI-047 Phase 3: Resync component library (components/*.html) ke shadcn/ui

Lanjutan Phase 1/2 (lihat entri di bawah). Seluruh 10 file di
`components/*.html` (buttons, status-chips, forms, cards, dialog,
navigation, navigation-mobile, notifications-panel, popover, table)
dibaca satu-satu untuk cek referensi Astryx. 2 file
(`forms.html`, `navigation-mobile.html`) ternyata sudah tidak menyebut
"Astryx" secara literal (label komponennya generik) — tidak diubah.

8 file lain punya kalimat pembuka "Astryx `<Component>`" yang diperbaiki
ke shadcn/ui equivalent, konsisten dengan tabel Components di readme.md
(Phase 2b):

* `buttons.html` — Button variant/size list diperbarui ke nilai shadcn
  nyata (`default/outline/secondary/ghost/destructive/link` × 8 size).
* `status-chips.html` — intro + catatan "Astryx Badge only ships 5" 
  diperbaiki: shadcn `Badge` sebenarnya
  `default/secondary/destructive/warning/outline/ghost/link` (bukan 5
  yang disebut sebelumnya), info/purple/success tetap custom Tailwind
  pending design lock (DT-D02).
* `cards.html` — Card tidak punya prop `padding` bawaan seperti Astryx.
* `table.html` — pointer ke `table.tsx` nyata.
* `dialog.html` — 3 titik: (1) `purpose="form"/"required"` Astryx tidak
  punya padanan prop di shadcn Dialog polos; (2) AlertDialog dikonfirmasi
  shadcn juga punya komponen sama persis (`alert-dialog.tsx`); (3)
  Field/TextInput → Field/Input (`field.tsx`/`input.tsx`).
* `navigation.html` — app-shell sidebar dikoreksi: tidak ada registry
  `Sidebar` component ter-install, hand-built dari `--sidebar-*` + Tailwind.
* `notifications-panel.html` — Drawer → Sheet (`side="right"`), List/Item
  → Item/ItemGroup (`item.tsx`).
* `popover.html` — intro diperbaiki ke shadcn Popover nyata; **daftar
  props Astryx (placement/alignment/hasCloseButton/dst) TIDAK dihapus** —
  ditambah kalimat penutup eksplisit bahwa itu props historis yang
  diverifikasi saat itu (2026-08-26), shadcn tidak berbagi permukaan prop
  yang sama, lihat tabel Components untuk pemetaan sekarang. Ini
  konsisten dengan prinsip Phase 2c: tidak menghapus/mengubah catatan
  sejarah, hanya menambah konteks current-state.

**Histori/keputusan King Rezi lain di tiap file (ADR-058 no-shift
override, restyle channel badge 2026-07-31, dst) sama sekali tidak
disentuh.**

Verifikasi ekstra ketat karena 2 file (`navigation.html`, `popover.html`)
berisi SVG icon inline panjang (react-icons/fa6 brand logos) — sedikit
salah ketik saat transkripsi bisa merusak render. Prosedur: setiap file
original ditulis ke lokal, langsung di-`diff`-cek byte-identical terhadap
fetch remote segar SEBELUM diedit; replace pakai script Python dengan
`content.count(old) == 1` assertion (gagal loud kalau tidak persis 1
match); `diff` final dicek cuma 1 baris yang berubah per file; push 8
file sekaligus dalam satu `write_files` call; baca ulang salah satu
(`navigation.html`) dari remote setelah push untuk konfirmasi akhir.

File yang diubah: `components/buttons.html`, `status-chips.html`,
`cards.html`, `table.html`, `dialog.html`, `notifications-panel.html`,
`popover.html`, `navigation.html` (via `DesignSync`).

**KI-047 Phase 1-3 selesai.** Sisa: Phase 4 (prototype screens — 8 KSP +
App Prototype).

## 2026-09-08 — KI-047 Phase 2c: Perbaikan klaim faktual basi di section histori readme.md

Lanjutan Phase 2a/2b (lihat entri di bawah), menutup Phase 2 (readme.md)
secara keseluruhan. Sebelum eksekusi, seluruh ~10 section histori
per-fitur (Dark Mode Toggle s/d How to Demo, ~136 baris) dibaca ulang
untuk menentukan scope nyata — hasilnya **bukan** rewrite besar seperti
Phase 2a/2b, karena sebagian besar isinya adalah catatan sejarah yang
sudah akurat untuk masanya (mis. "confirmed via `astryx component
EmptyState --dense`" adalah fakta tentang apa yang benar-benar
diverifikasi saat fitur itu dibuat, bukan klaim tentang state sekarang).
Mengubah kalimat semacam itu akan jadi revisionis terhadap sejarah, bukan
resync — jadi sengaja dibiarkan.

Hanya **4 klaim faktual** yang ditemukan benar-benar basi (mengklaim
*current state* token yang sudah tidak benar sejak Phase 1) diperbaiki
lewat replace presisi (Python, exact-match dicek `count()==1` sebelum
replace, `diff` dicek hanya menyentuh 4 baris itu):

1. Section "Dark Mode Toggle" — klaim "every `light-dark()` token ...
   already carries its real dark-mode value from
   `@astryxdesign/theme-neutral@0.1.8`" ditambah status update: Phase 1
   sudah remap semua token itu ke Stone tanpa mengubah mekanisme toggle.
2. Section "Onboarding — Workspace Picker" — "Open gap, not addressed
   here" (soal token masih Neutral) diubah jadi "Historical note" + status
   bahwa KI-047 Phase 1 sudah menutup gap itu project-wide (screen ini
   otomatis ikut ter-update karena membaca variable `styles.css` yang
   sama seperti semua screen lain).
3. Section "Files" — deskripsi `styles.css`: "real Astryx tokens, traced
   to `@astryxdesign/theme-neutral@0.1.8`" → deskripsi Stone→shadcn nyata.
4. Section "Files" — deskripsi `theme.json`: `basedOn:
   "@astryxdesign/theme-neutral@0.1.8"` → `basedOn: "Stone theme (ADR-087)
   mapped 1:1 to shadcn/ui CSS variables"`.

**KI-047 Phase 2 (readme.md) selesai** dengan ini — 2a (kebijakan inti),
2b (tabel Components), 2c (4 klaim faktual basi di section histori).
Sisa KI-047: Phase 3 (component library `components/*.html`) dan Phase 4
(prototype screens 8 KSP + App Prototype).

File yang diubah: `readme.md` (via `DesignSync`).

## 2026-09-08 — KI-047 Phase 2b: Resync tabel Components di readme.md ke shadcn/ui

Lanjutan Phase 2a (lihat entri di bawah). Sebelum menulis, dibaca langsung
17 file di `apps/web/src/components/ui/` (bukan ditebak dari nama Astryx
padanannya) untuk memastikan kolom "shadcn/ui equivalent" akurat terhadap
komponen yang benar-benar terpasang — termasuk `button.tsx`/`badge.tsx`
(`cva` variant list), `card.tsx`, `field.tsx`, `item.tsx`, `dialog.tsx`,
`alert-dialog.tsx`, `popover.tsx`, `sheet.tsx`, `empty.tsx`, `text.tsx`,
`table.tsx`, `progress.tsx`, `select.tsx`, `checkbox.tsx`, `radio-group.tsx`,
`toggle-group.tsx`.

Tabel "Components" (16 baris) di-resync kolom demi kolom, dengan beberapa
**perbedaan struktural nyata** didokumentasikan eksplisit — bukan sekadar
ganti nama komponen 1:1:

* `IconButton` Astryx melebur jadi bagian dari `Button` shadcn sendiri
  (`size`: `icon`/`icon-xs`/`icon-sm`/`icon-lg`), bukan komponen terpisah.
* `Badge` shadcn (`badge.tsx`) hanya punya varian
  `default`/`secondary`/`destructive`/`warning`/`outline`/`ghost`/`link` —
  **tidak ada** `info`/`purple`/`success` seperti asumsi Astryx-era; hue
  status ekstra tetap custom Tailwind di atas `Badge`, konsisten dengan
  `design-tokens.md` § Color — Content Status yang masih `TBD` (DT-D02).
* Tidak ada file `sidebar.tsx` di `components/ui/` — app-shell sidebar
  nyata di `apps/web` hand-built dari CSS variable `--sidebar-*` +
  Tailwind, bukan komponen registry yang di-swap.
* `Drawer` Astryx (`placement` prop) → `Sheet` shadcn (`side` prop).
* `Dialog` Astryx (satu komponen, prop `purpose="form"|"required"`) →
  shadcn memisah jadi dua komponen berbeda: `AlertDialog` untuk pola
  konfirmasi (Tier 2 — Disconnect/Logout/Remove Member, dst) dan `Dialog`
  polos untuk yang bertipe form.
* Animasi buka dialog nyata di `apps/web` pakai atribut Radix
  `data-state="open"|"closed"` + utility `tw-animate-css`
  (`animate-in`/`fade-in-0`/`zoom-in-95`), bukan `@keyframes` manual
  seperti `dialog-enter` di `styles.css` saat ini — dicatat sebagai gap
  terpisah di paragraf "States are built in", **di luar scope** Phase 2b
  (tidak mengubah animasi CSS aktual, cuma dokumentasi perbedaannya).
* Hover state nyata (`Button`/`Badge`) pakai flat opacity shift
  (`hover:bg-primary/80`) bukan gradient overlay wash
  (`--color-overlay-hover`) seperti teknik `.btn`/`.chip` saat ini — juga
  dicatat sebagai gap, bukan diperbaiki di pass ini.

Paragraf setelah tabel ("Product-specific patterns...", "States are built
in...") ikut disesuaikan (Astryx → Stone/shadcn tokens, `ProgressBar`→
`Progress`, `Banner status="error"`→`Alert`).

**Sengaja tidak disentuh** (diverifikasi byte-identical dengan perbandingan
string sebelum push): seluruh isi sebelum "## Components" (hasil Phase 2a)
dan seluruh isi dari "## Do" sampai akhir file (Do/Don't/Files, sudah
di-resync Phase 2a untuk Do/Don't; Files section masih Phase 2c).

File yang diubah: `readme.md` (via `DesignSync`). Verifikasi: baca source
`apps/web/src/components/ui/*.tsx` langsung sebelum menulis klaim apapun,
bangun file gabungan lewat script Python, `before`/`after` region
dibandingkan string exact-match sebelum push, baca ulang remote setelah
`write_files`.

## 2026-09-08 — KI-047 Phase 2a: Resync readme.md (section kebijakan inti) ke Stone/shadcn

Lanjutan KI-047 setelah Phase 1 (lihat entri di bawah). King Rezi diminta
konfirmasi scope readme.md (56KB, hampir seluruh isinya dibangun di atas
metodologi "Astryx fidelity" — `bunx astryx docs/swizzle`, props
Button/Badge/dst) sebelum eksekusi: dipilih **rewrite total, dipecah
bertahap** (bukan sekali jalan) supaya tidak mengubah fakta historis di
section-section lama secara tidak sengaja.

**Phase 2a (selesai sesi ini)** — section kebijakan/fondasi yang bersifat
"living guidance" (bukan catatan sejarah fitur), ditulis ulang total:

* Title: "Astryx Neutral" → "Stone (shadcn/ui)".
* **"Astryx fidelity policy"** → **"Stone/shadcn fidelity policy"**: dua
  poin non-negotiable ditulis ulang dari model Astryx (props-only,
  verifikasi via `bunx astryx docs/swizzle`) ke model shadcn/ui nyata
  (source di-copy ke `components/ui/`, verifikasi via shadcn MCP/CLI
  `search_items_in_registries`/`view_items_in_registries`, mengikuti
  `apps/web/.claude/CLAUDE.md`).
* **"Why it looks this way"** — paragraf ADR-038/ADR-057 (King Rezi
  permanen berperan sebagai designer) + kotak catatan status KI-047 baru
  yang menjelaskan pembagian Phase 1 (token value) vs Phase 2 (metodologi)
  vs section yang belum disentuh (histori fitur + tabel Components,
  dijadwalkan phase berikutnya).
* **"How to use this"**, **"Direction"**, **"Color"**, **"Type"** — nilai
  hex/font disamakan dengan hasil Phase 1 (`--color-accent` #25252A,
  Figtree body + Montserrat heading), referensi Astryx diganti pointer ke
  `apps/web/src/app/globals.css` dan `design-tokens.md`.
* **"Do"/"Don't"** — aturan `bunx astryx swizzle`/`astryx component` diganti
  shadcn MCP/CLI; aturan lama "jangan simpan swizzle output" **dihapus**
  (tidak relevan lagi — model shadcn justru menyimpan source hasil copy
  secara permanen di `components/ui/`, kebalikan dari Astryx); diganti
  aturan baru: jangan resync nilai `TBD` (brand/status color) jadi hex baru
  cuma karena resync token sedang berjalan.

**Sengaja belum disentuh di Phase 2a** (dijadwalkan Phase 2b/2c terpisah,
diverifikasi byte-identical dengan `diff` sebelum push supaya tidak ada
histori yang berubah tanpa sengaja): ~10 section histori per-fitur (Dark
Mode Toggle, Draft Editor Toggle, Tier 1 Confirmation, Home, Onboarding,
Settings Workspaces, Calendar, Notifications Drawer, Avatar Menu, How to
Demo — ~136 baris) dan tabel "Components" (kolom "Astryx equivalent").
Section-section itu berisi catatan keputusan masa lalu yang literally
menyebut apa yang diverifikasi lewat Astryx **saat itu** — mengubahnya
langsung berisiko merevisi fakta historis, bukan sekadar update
terminologi, jadi butuh pendekatan lebih hati-hati per section (dicatat
sebagai Phase 2c terpisah di `PROJECT_STATE.md`).

File yang diubah: `readme.md` (via `DesignSync`, projectId
`84aded99-bb23-49b1-be9f-dd8f21c6873e`). Verifikasi: script Python
membangun file gabungan dari 3 blok baru + region lama yang tidak
disentuh, `diff`/perbandingan string mengonfirmasi region lama
byte-identical sebelum push, baca ulang remote setelah `write_files`.

## 2026-09-08 — KI-047 Phase 1: Resync Foundations & Tokens Claude Design ke Stone/shadcn

Phase 1 dari 4 phase resync bertahap (disepakati King Rezi) untuk menutup
KI-047 — project Claude Design "Social Media Management" yang masih 100%
dokumentasi Astryx lama, tidak pernah disinkronkan ke Stone theme shadcn/ui
sejak migrasi ADR-097 selesai (2026-09-04).

Scope Phase 1 (Foundations & tokens), disepakati eksplisit dengan King Rezi
sebelum eksekusi: **update nilai variable CSS saja**, bukan rewrite total.
File yang diubah via `DesignSync` (project `84aded99-bb23-49b1-be9f-dd8f21c6873e`):

* `theme.json` — metadata `basedOn`/palette/font/radius/note ditulis ulang
  merujuk Stone (ADR-087) → shadcn/ui, bukan lagi
  `@astryxdesign/theme-neutral@0.1.8`.
* `styles.css` — hanya blok header comment + `:root` (baris 1–172 versi
  lama) yang diganti; sisa file (component classes `.btn/.card/.chip/dst`,
  skala radius, ratusan baris komentar historis keputusan King Rezi per
  komponen) **tidak disentuh sama sekali** — diverifikasi via `diff` sebelum
  push. Nama CSS variable dipertahankan persis (`--color-accent`,
  `--color-background-body`, dst) supaya semua component class otomatis
  ikut mendapat nilai baru tanpa perlu diedit satu per satu. Nilai warna
  structural/neutral/feedback dipetakan 1:1 dari tabel "Engineering
  Mapping" di `product-discovery/06-engineering/design-tokens.md` (sumber
  yang sama dipakai T-095.5/T-096.1 saat migrasi kode asli). Heading font
  Figtree → Montserrat (menutup gap yang sama dengan T-096.1).
* `foundations/color.html` — label hex swatch disesuaikan ke nilai baru,
  section duplikat "Stone/shadcn semantic tokens (KI-041)" digabung ke
  section Feedback yang sudah otomatis benar lewat CSS variable.

**Sengaja tidak diubah** (didokumentasikan eksplisit di header `styles.css`
+ `theme.json`, bukan silently diskip — sesuai
`.claude/skills/claude-design-scope-discipline/SKILL.md`): skala radius
(kode `apps/web` juga sengaja mempertahankan default preset Maia, bukan
migrasi radius Stone — lihat `design-tokens.md` § Engineering Mapping →
Radius) dan ramp warna kategori/status non-semantik (draft/review/scheduled
badge hue) yang masih `TBD` menunggu design lock (DT-D02). Beberapa value
(`--color-text-disabled`, `*-muted` feedback, `--color-on-error`) tidak
punya sumber Stone langsung — ditandai "derived" di komentar inline,
dibedakan jelas dari value yang disalin verbatim dari tabel mapping.

Verifikasi sebelum push: baca remote lebih dulu (`get_file`), bangun file
gabungan lewat script Python (bukan retik ulang manual, sesuai skill scope
discipline poin 6 — file ini berisi baris panjang), `diff` terhadap remote
untuk memastikan hanya blok yang dimaksud yang berubah, baca ulang remote
setelah `write_files` untuk konfirmasi.

Phase 2 (readme.md/policy docs), Phase 3 (component library), Phase 4
(prototype screens) belum dikerjakan — lihat `PROJECT_STATE.md` KI-047
untuk detail phase berikutnya. Tidak ada kode `apps/web` yang diubah pada
sesi ini (murni dokumentasi Claude Design).

**Bug ditemukan & diperbaiki sesi yang sama:** King Rezi melaporkan
`foundations/color.html` tampil polos tanpa styling sama sekali di Claude
Design setelah publish Phase 1 di atas (screenshot: font default browser,
tidak ada warna, layout grid hilang). Root cause: baris komentar header
baru di `styles.css` — teks `--color-badge-info-*/--color-badge-warning-*`
— mengandung urutan karakter `*/` di tengah kalimat, menutup komentar
header (baris 1–38) lebih awal. Sisa teks komentar sampai `*/` penutup
asli dibaca sebagai kode CSS rusak, membuat parser browser gagal
memparsing seluruh blok `:root { ... }` (semua CSS variable warna jadi
kosong) sampai "pulih" di rule berikutnya (`:root[data-theme="dark"]`).
Diverifikasi dengan reproduksi lokal (`python3 -m http.server` + Browser
pane, `document.styleSheets[0].cssRules[0].selectorText` menunjukkan rule
pertama yang berhasil ke-parse memang `:root[data-theme="dark"]`, bukan
`:root` biasa — mengonfirmasi teori sebelum memperbaiki). Fix: tambah
spasi jadi `--color-badge-info-* / --color-badge-warning-*` (satu
karakter). Diverifikasi ulang render lokal (grid + warna tampil benar)
sebelum push perbaikan ke Claude Design. Pelajaran: hindari pola
`kata-*/kata-*` (wildcard-slash-wildcard) di dalam komentar CSS
berikutnya — selalu render-check sebelum menganggap publish token/CSS
selesai, bukan cuma cek sintaks brace/kutip.

## 2026-09-08 — ADR-102: Default Tema Ikuti Preferensi OS (Amandemen ADR-055)

Perubahan ad-hoc di luar scope T-039.4, diminta King Rezi di sesi yang sama
setelah T-039.4 selesai — tidak masuk task backlog formal. Default tema
saat cookie `theme` belum pernah ditulis (user belum pernah toggle
eksplisit) diubah dari hardcode Light menjadi mengikuti
`prefers-color-scheme` OS user. Sekali user menekan toggle Light/Dark,
cookie `theme` ditulis dan jadi preferensi permanen yang override sistem
(perilaku toggle tidak berubah).

Mekanisme (menjaga prinsip "no flash" ADR-055): `apps/web/src/app/layout.tsx`
merender `<Script id="theme-system-default" strategy="beforeInteractive">`
yang set class `dark` di `<html>` sebelum React hydrate kalau cookie belum
ada (plus `suppressHydrationWarning`); `apps/web/src/components/Providers.tsx`
tetap inisialisasi state `mode` identik `initialMode` dari server lalu
mengoreksinya ke preferensi OS lewat `useLayoutEffect` (bukan `useEffect`)
sebelum paint pertama — mencegah hydration mismatch di consumer seperti
toggle icon `WorkspaceSideNav`/`Toaster`. Auto-persist cookie dipindah
supaya hanya terjadi saat `toggleMode()` benar-benar dipanggil user, bukan
otomatis saat mount (supaya default hasil deteksi sistem tidak
"terkunci" jadi preferensi eksplisit sebelum user memilih). Percobaan
pertama (resolve OS langsung di lazy initializer `useState`) ditolak
review Ridwan Architecture Reviewer karena menyebabkan hydration mismatch
baru — diperbaiki dengan pola `useLayoutEffect` di atas.

File yang diubah: `apps/web/src/app/layout.tsx`,
`apps/web/src/components/Providers.tsx` (`DEFAULT_THEME_MODE` di
`apps/web/src/lib/theme/theme-cookie.ts` tetap ada sebagai fallback).
Branch `feature/t-039-4-onboarding-workspace-picker` — sudah di-commit & push, PR [#109](https://github.com/reziSaktiva/social-media-management/pull/109) ke `staging`, belum di-merge.
Verifikasi: typecheck/lint bersih, 272 unit test pass (tidak ada test baru
untuk logic ini — dicatat sebagai gap), verifikasi manual browser
(emulasi `prefers-color-scheme` dark/light, toggle eksplisit tetap
menulis cookie benar). Detail lengkap: `DECISIONS.md` ADR-102, status
ADR-055 diupdate jadi "Accepted — Amended by ADR-097 (2026-09-01), Amended
by ADR-102 (2026-09-08)".

---

## 2026-09-08 — T-039.4 diimplementasikan+direview+di-QA tuntas — T-039 ditutup ✅ Done, KI-023 Resolved

Subtask terakhir T-039 (Migrasi Routing & Settings, ADR-076) yang tersisa —
**T-039.4** (halaman `/onboarding` dengan picker workspace) — sudah
diimplementasikan setelah desainnya disetujui King Rezi di Claude Design
(dicatat 2026-08-24).

**Perubahan kode** (branch `feature/t-039-4-onboarding-workspace-picker`,
dibuat dari `staging` — sudah di-commit & push, PR [#109](https://github.com/reziSaktiva/social-media-management/pull/109), belum di-merge):

- `apps/web/src/app/onboarding/page.tsx` — diubah dari "cek 1 default
  workspace, kalau tidak ada tampilkan form" menjadi memanggil
  `WorkspaceService.listWorkspacesForUser(userId)` dan branching 3
  skenario: 0 workspace → render `CreateWorkspaceForm` (state lama, tidak
  berubah); 1 workspace → tetap `redirect("/onboarding/resume")` (Route
  Handler existing dari T-039.3, tidak berubah); >1 workspace → render
  `WorkspacePicker` (baru) — menutup gap lama di mana `onboarding/resume`
  auto-pick diam-diam workspace tertua (`getDefaultWorkspaceForUser`) tanpa
  menanyakan user.
- `apps/web/src/app/onboarding/components/WorkspacePicker.tsx` (file baru)
  — Client Component, list workspace pakai `Item`/`ItemGroup` shadcn (pola
  sama `WorkspacesSettingsView.tsx` T-089), tanpa `AlertDialog` konfirmasi
  karena belum ada "workspace aktif" untuk ditinggalkan di titik re-entry
  ini, klik baris langsung memanggil Server Action.
- `apps/web/src/app/onboarding/components/actions.ts` — ditambah
  `selectWorkspaceAction(workspaceId)`: validasi membership aktif lewat
  reuse `WorkspaceService.switchWorkspace`, set cookie
  `active-workspace-id`, redirect Home; error (bukan anggota aktif) →
  `{error}` lewat `toActionError`, tanpa redirect.
- `apps/web/src/app/onboarding/components/actions.test.ts` (file baru) —
  unit test untuk `selectWorkspaceAction`, 3 skenario: unauthenticated →
  redirect login; sukses → set cookie + redirect home; gagal membership →
  return `{error}` tanpa redirect/cookie.

**Verifikasi:** `bun run typecheck`/`lint` bersih, `bun run test` (root)
272 pass (naik dari 269 karena `actions.test.ts` baru)/5 skip.

**Review arsitektur Ridwan:** LOLOS, tidak ada temuan — entry point tanpa
business logic, domain tidak import Prisma langsung, reuse
`switchWorkspace` untuk skenario "belum ada workspace aktif" dinilai
semantically tepat, bukan penyalahgunaan API.

**QA Najwa QA Engineer** (end-to-end browser, localhost): PASS 6/6 skenario
— (1) 1 workspace + cookie hilang → auto-redirect Home tanpa picker; (2)
>1 workspace + cookie hilang → tampil picker, klik pilih → redirect Home +
cookie ter-set benar (dites akun Raka, 4 workspace); (3) 0 workspace → form
create workspace lama tidak regresi; (4) error handling membership invalid
→ alert error muncul tanpa crash/redirect; (5) visual "Pilih Workspace"
cocok Claude Design (title, subtitle, avatar+nama+role+chevron, klik
langsung tanpa dialog); (6) regresi Settings → Account → Workspaces tetap
normal. Data test QA (`qa-onboarding-t0394@kopiselasar.com` + workspace-nya)
sudah dibersihkan sendiri oleh Najwa via Danger Zone.

**Dokumentasi diperbarui bersamaan:** `tasks/v01-foundation.md` (T-039.4
dicentang selesai + catatan eksekusi lengkap, Status field T-039 naik jadi
`✅ Done`, paragraf lama yang menyebut T-039.4 masih terbuka diupdate),
`TASKS.md` (indeks v0.1 14 ✅ · 1 🚫 · 5 🟡 · 1 ⏸️ · 2 ⏳, Total task selesai
35 → 36, blurb baru di Fokus sekarang), `PROJECT_STATE.md` (Snapshot § Top
Next Tasks, entri **KI-023 dihapus dari Known Issues** karena sudah
Resolved dan tercatat di sini — sesuai konvensi ADR-066/ADR-067, Completed
Ringkasan — 5 bullet terjaga, bullet T-036.4 digeser keluar, Version
1.0.75 → 1.0.76).

Detail: `tasks/v01-foundation.md` § T-039 (catatan eksekusi T-039.4).

---

## 2026-09-07 — KI-046 Resolved (Promoted to T-007.7, ADR-100), KI-053 ditemukan (Open), ADR-101 mengamandemen ADR-100, T-007.8 diimplementasikan+direview+di-QA tuntas

Kronologi lengkap satu sesi (semua terjadi hari yang sama, setelah T-025/T-026/T-036 tuntas):

**1. Investigasi KI-046.** King Rezi bertanya rekomendasi kerjaan berikutnya — dipilih investigasi **KI-046** (`MemberStatus.Pending` tidak pernah di-assign di flow produksi manapun, ditemukan Najwa QA Engineer 2026-09-04). Dikonfirmasi lewat kode: benar tidak pernah di-assign. King Rezi diberi 3 opsi, memilih **opsi 2**: direservasi untuk metode invite "Kirim via Email" (T-007.7). Dikunci lewat **ADR-100** — desain alur: baris `workspace_members` dibuat langsung `Pending` saat invite dikirim via email (bukan menunggu accept), diupdate `Active` saat user accept; metode Copy Link tidak berubah. Implementasi konkret menunggu T-005 selesai (masih blocked). **KI-046 ditutup: Promoted to T-007.7.**

**2. KI-053 ditemukan.** King Rezi bertanya soal skenario invite Copy Link lalu link dibuka email lain (bukan target undangan). Ditemukan gap security nyata: karena `requireEmailVerification: false` (KI-001), kalau email A belum pernah punya akun, siapa pun yang memegang link bisa membuat akun atas nama email A dan membajak identitasnya — form `/invite/[token]` mengunci field email jadi read-only ke email A, tapi itu cuma memastikan string email cocok, bukan membuktikan kepemilikan inbox. Dicatat sebagai **KI-053** (Security/Bug, status **Open** — belum ada mitigasi, murni pencatatan, tidak ada kode yang diubah untuk temuan ini). Referensi balik ditambahkan di `tasks/v01-foundation.md` § T-007.1 dan § T-093 (field Terkait KI di task yang disebut KI-053).

**3. ADR-101 — perluasan visibilitas Pending ke kedua metode invite.** King Rezi lalu meminta: begitu user diundang lewat metode **apa pun** (bukan cuma Email), harus otomatis muncul di Members list dengan status Pending. Ditemukan constraint skema `WorkspaceMember.userId` bersifat `NOT NULL`, yang membuat pendekatan asli ADR-100 (pre-create baris `workspace_members` asli) tidak bisa diterapkan untuk Copy Link (target belum tentu punya `User` account). Diajukan 2 opsi (ubah skema jadi nullable vs gabungan data presentasi); King Rezi memilih **opsi gabungan data** — dikunci lewat **ADR-101** (mengamandemen ADR-100; status ADR-100 di `DECISIONS.md` dan file ADR-nya ditandai `Accepted — Amended by ADR-101 (2026-09-07)` bersamaan). Desain final: `/settings/members` menggabungkan `workspace_members` (Active/Removed) + `WorkspaceInvitation` berstatus `pending` & belum expired (baris virtual, identitas dari `invitation.email`), tanpa migrasi skema. Aksi baris virtual hanya "Cancel Invitation" (revoke), bukan Change Role. Task baru **T-007.8** ditambahkan di `tasks/v01-foundation.md` § T-007 — tidak bergantung T-005 (data sudah tersedia dari Copy Link, T-007.1 ✅).

**4. T-007.8 — implementasi, review, QA (tuntas, ✅ Done).** Diimplementasikan **Prabowo Feature Engineer**: merge presentasi `workspace_members` + `WorkspaceInvitation` pending belum expired di `WorkspaceService`, aksi `revokeInvitation` (RBAC `assertActorCanManageMembers`), tanpa migrasi skema (sesuai ADR-101 poin 4). Direview **Ridwan Architecture Reviewer**: 1 temuan — race condition di `revokeInvitation` — sudah diperbaiki Prabowo, re-verifikasi bersih (typecheck/lint/test: 269 passed, 5 skipped, 0 error). QA end-to-end **Najwa QA Engineer** (browser real): golden path invite → baris Pending muncul → cancel → link jadi graceful-invalid (PASS); golden path accept → baris Pending hilang jadi Active (PASS); member existing tidak regresi (PASS); mobile 375px (PASS); RBAC Creator tetap tidak bisa akses `/settings/members` (PASS); invitation expired tidak muncul di list (PASS) — **semua PASS, 0 bug ditemukan**. Task induk **T-007** tetap `🟡 In Progress` (sisa scope T-007.7, blocked T-005) — hanya T-007.8 yang ditutup `✅ Done`.

Dokumentasi diperbarui bersamaan: `tasks/v01-foundation.md` (T-007.8 dicentang selesai + catatan implementasi/review/QA, referensi balik KI-053 di T-007.1/T-093), `TASKS.md` (subtask total 211 → 212, dihitung ulang langsung dari file, entri Update baru), `PROJECT_STATE.md` (Snapshot § Top Next Tasks, Completed Ringkasan — 5 bullet terjaga, Recent Decisions — ADR-101 ditambah di atas ADR-096 digeser keluar, Version 1.0.73 → 1.0.74), `DECISIONS.md` (status ADR-100 diamandemen).

Detail: `tasks/v01-foundation.md` § T-007/T-007.1/T-007.7/T-007.8/T-093, `decisions/ADR-100-*.md`, `decisions/ADR-101-*.md`, `PROJECT_STATE.md` § KI-053.

---

## 2026-09-07 — KI-053 dicatat: invite Copy Link rawan identity takeover kalau penerima bukan target undangan

King Rezi menemukan gap lewat diskusi: kalau invite dikirim via **Copy Link** ke email A, tapi link-nya terbuka oleh email B (link diteruskan/dibagikan ke orang yang salah), dan **email A belum pernah punya akun**, email B ternyata bisa langsung membuat akun **atas nama email A** (isi Nama + Password pilihannya sendiri) di form `/invite/[token]` dan berhasil join workspace sebagai identitas "A".

**Root cause dikonfirmasi lewat kode:**
- `AcceptInviteForm.tsx` mengunci field email jadi `readOnly` (pre-filled dari `invitation.email`) — tapi ini cuma memastikan **string email** yang dikirim ke `authClient.signUp.email()` cocok, bukan membuktikan siapa yang benar-benar memegang inbox itu.
- `WorkspaceService.acceptInvite` (`workspace.service.ts:615`) sudah benar mengecek `actorEmail === invitation.email` — tapi guard ini tidak menolong karena `actorEmail` datang dari sesi Better Auth yang baru saja dibuat sendiri oleh siapa pun yang mengisi form itu.
- Akar masalahnya: `requireEmailVerification: false` di `auth.ts:53` (bagian dari **KI-001**, provider email belum ditetapkan) — tidak ada email konfirmasi yang mengecek kepemilikan inbox sebelum akun baru dianggap sah.

**Dampak:** email B bisa efektif membajak identitas email A (akun baru + password buatan B) sebelum pemilik asli A sempat daftar — begitu pemilik asli mencoba daftar belakangan, ditolak "email sudah terdaftar", terkunci keluar dari identitasnya sendiri.

**Lingkup gap:** hanya berlaku kalau email A **belum** pernah punya akun (`isExistingUser: false`). Kalau email A sudah terdaftar, skenario ini aman — email B tetap butuh password akun A untuk sign-in.

Dicatat sebagai **KI-053** (Security/Bug, Open) di `PROJECT_STATE.md` — belum ada keputusan mitigasi (opsi yang dipertimbangkan: tunda Copy Link sampai email verification tersedia, atau tambahkan verifikasi email terpisah khusus alur accept-invite). Murni pencatatan investigasi, tidak ada kode yang diubah sesi ini.

---

## 2026-09-07 — KI-046 Resolved (Promoted to T-007.7): `MemberStatus.Pending` direservasi untuk metode invite "Kirim via Email", ADR-100

King Rezi diminta memutuskan nasib `MemberStatus.Pending` (ditemukan Najwa QA Engineer 2026-09-04 tidak pernah di-assign di flow produksi manapun — dicatat KI-046). Diberikan 3 opsi: (1) hapus sebagai dead code, (2) disiapkan untuk metode invite "Kirim via Email" (T-007.7, ADR-080), (3) dibiarkan status quo tanpa keputusan. **King Rezi memilih opsi 2.**

Ditulis **ADR-100** (`decisions/ADR-100-memberstatus-pending-direservasi-metode-invite-kirim-via-email.md`) yang mengunci desain:
- Saat invite dikirim via email (T-007.7, masih blocked T-005), baris `workspace_members` dibuat **langsung saat itu juga** dengan status `Pending` — bukan menunggu user accept — supaya invite yang terkirim langsung terlihat di `/settings/members`.
- Saat user accept lewat `/invite/[token]` (pola T-093), baris yang sudah ada **diupdate** jadi `Active` (bukan insert baru); role tetap dari `WorkspaceInvitation`.
- Metode **Copy Link** (T-007.1, sudah jalan) **tidak berubah** — tetap tidak pre-create membership, insert langsung `Active` saat accept. Perbedaan disengaja: Copy Link bisa dibagikan ke siapa saja sebelum dibuka, tidak ada dasar untuk pre-create; Kirim via Email tahu pasti target penerima.
- Implementasi kode **belum dikerjakan** — tetap menunggu T-005 (email provider) selesai. Ini murni keputusan desain, bukan task implementasi.

Perubahan dokumen (murni dokumentasi, tidak ada kode diubah):
- `DECISIONS.md` — entri ADR-100 ditambahkan di atas ADR-099.
- `decisions/ADR-100-memberstatus-pending-direservasi-metode-invite-kirim-via-email.md` — file ADR baru.
- `tasks/v01-foundation.md` § T-007.7 — catatan desain ditambahkan ke checklist item yang sudah ada (tidak menambah subtask baru, T-007.7 sudah ada sejak ADR-080).
- `PROJECT_STATE.md` — KI-046 status diubah `Open` → `Promoted to T-007.7 (ADR-100)`; bullet baru ditambahkan ke Completed (Ringkasan) (bullet terlama T-102.5 digeser keluar batas 5 item, riwayatnya tetap aman di sini); Recent Decisions (Ringkasan) ditambah ADR-100, ADR-095 digeser keluar batas 5.

Tidak memblokir apa pun — T-007.7 tetap menunggu T-005 seperti sebelumnya, hanya sekarang desainnya sudah eksplisit dikunci.

---

## 2026-09-07 — T-026 & T-036 ditutup `✅ Done`: KI-048 Resolved, verifikasi end-to-end nyata

Kelanjutan langsung dari entri di bawah (T-026 sudah selesai kode, blocked deploy migration, KI-048). Sejak itu:

1. **King Rezi menjalankan `bun run db:deploy`** — 3 migration T-026 (`20260907120000_t026_outstand_webhook_system_lookups`, `20260907130000_t026_unique_outstand_post_id`, `20260907140000_t026_relax_webhook_event_type_check`) **terverifikasi ter-apply** ke database dev. Najwa QA Engineer cross-check langsung via Supabase MCP: fungsi `webhook_find_post_targets_by_outstand_post_id`/`webhook_find_account_owner_by_outstand_account_id` sudah ada, unique index `publishing_posts_outstand_post_id_unique` sudah ada, CHECK constraint `event_type` sudah dilonggarkan jadi non-empty string (bukan whitelist 3 nilai).
2. **King Rezi mengisi `OUTSTAND_WEBHOOK_SECRET` dengan nilai dummy sementara** di `apps/web/.env.local` (bukan kredensial asli Outstand — belum ada — murni untuk memungkinkan testing lokal HMAC signature). `OUTSTAND_API_KEY` tetap kosong/dikomentari, `FakeOutstandAdapter` tetap aktif jalur produksi — tidak ada perubahan pada ADR-059.
3. **Najwa QA Engineer retest end-to-end nyata** (HTTP request langsung ke `/api/webhooks/outstand`, dev server lokal, tanpa cookie session — mensimulasikan Outstand asli) untuk 5 skenario, **SEMUA PASS**:
   - Golden path `post.published` — `PublishingPostTarget.status` kedua target jadi `published`, `platformPostId`/`platformPostUrl` terisi.
   - `post.error` — diproses bersih, tidak ada lagi error DB "function does not exist" (bug lama, sekarang tuntas).
   - `account.token_expired` — `WorkspaceConnectedAccount.reconnectRequired` jadi `true` + notifikasi baru untuk Owner workspace (menutup **T-036.5** juga).
   - Event type tak dikenal (`something.unknown`) — `200 OK`, tidak error (constraint DB sudah benar dilonggarkan).
   - Idempotensi (event id sama 2x → kedua `2xx`, tidak reproses) + signature invalid (`401`, tidak ada row tersimpan) — regresi aman.

**Housekeeping (bukan bug, catatan untuk QA webhook berikutnya):** `FakeOutstandAdapter` (ADR-059) menyimpan state target-per-post di memori proses server, bukan database — jadi setelah restart dev server, hanya post yang dibuat lewat alur Schedule/Publish Now ASLI (bukan seed langsung Prisma) yang bisa diuji `fetchPostOutcome`.

**Hasil:** **T-026 (Webhook handler Outstand)** dan **T-036 (In-app notification + Supabase Realtime)** keduanya ditutup **`✅ Done`**. **KI-048 Resolved.** ADR-099 (SECURITY DEFINER system-context lookup) tetap dicatat sebagai preseden arsitektur untuk T-027 (job runner). Detail: `tasks/v02-publishing-mvp.md` § T-026, § T-036; `TASKS.md`; `PROJECT_STATE.md` § Blockers.

---

## 2026-09-07 — T-026 Webhook handler Outstand: implementasi penuh, blocked deploy migration (ADR-099)

Route `/api/webhooks/outstand` (sebelumnya `501` placeholder) diimplementasikan penuh dalam satu sesi: implementasi Elon Backend Engineer → review arsitektur Ridwan Architecture Reviewer (temuan diperbaiki) → QA end-to-end Najwa QA Engineer (bug ditemukan diperbaiki). Kode **lolos** `typecheck`/`lint`/`test` (261 pass, 4 skip) — tapi **T-026 tetap `🟡 In Progress`**, belum bisa `✅ Done` karena blocker deploy migration (lihat bawah). T-036.5 (trigger notifikasi dari webhook) ikut tertutup sebagai bagian pekerjaan yang sama.

**Implementasi:**
1. **HMAC-SHA256 verification** (`apps/web/src/lib/adapters/outstand/verify-webhook-signature.ts`) atas raw body, `timingSafeEqual` (bukan `===`) terhadap header `X-Outstand-Signature`. `OUTSTAND_WEBHOOK_SECRET` kosong atau signature invalid → `401`, payload tidak diproses.
2. **Durable-before-ACK**: persist idempoten ke `OutstandWebhookEvent` (unique `outstandEventId`, fallback fingerprint SHA-256 raw body kalau Outstand tidak mengirim event id) SEBELUM diproses, `2xx` hanya setelah persist berhasil. Event id duplikat → `200` langsung tanpa reproses; race condition ditangani via unique constraint DB + catch `P2002` (bukan cuma app-level check, diverifikasi Ridwan).
3. **Pemrosesan INLINE SINKRON** (bukan async lewat job queue) — `OutstandWebhookProcessor` baru (`apps/web/src/domains/publishing/services/outstand-webhook-processor.ts`) menangani `post.published`/`post.error` (fetchPostOutcome → updateTargetOutcome per akun → markPostFailed kalau semua target gagal → notifikasi ke `authorId` post untuk `post.error`) dan `account.token_expired` (markAccountReconnectRequired → notifikasi ke Owner workspace). Event type tak dikenal diterima tapi tidak diproses (`2xx`, bukan error).
4. **NotificationType baru** (`packages/shared/src/enums.ts`): `PostPublishFailed`, `AccountReconnectRequired`.
5. Bug ditemukan & diperbaiki sepanjang sesi (bukan open issue): `apps/web/src/proxy.ts` tidak punya `/api/webhooks` di `BYPASS_PREFIXES` (webhook asli tanpa cookie session di-redirect 307 ke `/login`) — fixed, diverifikasi ulang via curl asli; CHECK constraint `event_type` di migration lama (`20260723121000_align_outstand_contract`) menolak event type di luar whitelist 3 nilai — fixed via migration baru (lihat blocker di bawah).

**Known gap disengaja (bukan ADR, dicatat untuk T-027):** desain arsitektur asli (`integration-layer.md`) mendeskripsikan Route Handler → enqueue JOB-01 → ACK, lalu job runner (T-027, belum dikerjakan sama sekali) yang memproses async. Karena T-027 belum ada, pemrosesan dilakukan inline sinkron di Route Handler yang sama sebagai sequencing pragmatis. Saat T-027 dikerjakan, webhook processing ini semestinya dipindah jadi enqueue+async sesuai desain asli — dicatat di `PROJECT_STATE.md` § Known Issues (KI-048) dan catatan T-027.

**ADR-099 — SECURITY DEFINER System-Context Lookup untuk Webhook Outstand:** route webhook tidak punya Better Auth session/`userId` (webhook eksternal), tapi RLS `publishing_posts`/`publishing_post_targets`/`workspace_connected_accounts` mewajibkan `app.current_user_id` cocok member aktif (default-deny tanpa itu) — lookup awal (cari post/akun dari `outstandPostId`/`outstandAccountId`) tidak bisa lewat `withCurrentUser` biasa karena justru lookup itu sendiri yang menghasilkan `userId` yang sah. Keputusan: 2 fungsi Postgres `SECURITY DEFINER` baru — `webhook_find_post_targets_by_outstand_post_id` dan `webhook_find_account_owner_by_outstand_account_id` (migration `20260907120000_t026_outstand_webhook_system_lookups`), scope sempit (exact-match by external id saja), `EXECUTE` direvoke dari `PUBLIC`, hanya di-grant ke role `app_runtime`. Setelah `userId` resolve, semua operasi TULIS tetap lewat `withCurrentUser` normal — bypass hanya di baca. Defense-in-depth tambahan (migration `20260907130000_t026_unique_outstand_post_id`): partial unique index global pada `publishing_posts.outstand_post_id` + guard assert eksplisit di kode, menutup temuan Ridwan (tanpa index ini kolom itu tidak unik sama sekali, berisiko JOIN lintas tenant). Pola ini jadi preseden untuk T-027 (job runner) saat butuh akses sistem serupa — dicatat eksplisit di ADR-099. Detail: `project-manager/decisions/ADR-099-security-definer-system-context-lookup-webhook-outstand.md`.

**BLOCKER — task belum bisa `✅ Done`:** Najwa QA Engineer menemukan 3 migration Prisma baru dari T-026 belum pernah `prisma migrate deploy` ke database dev/live: `20260907120000_t026_outstand_webhook_system_lookups`, `20260907130000_t026_unique_outstand_post_id`, `20260907140000_t026_relax_webhook_event_type_check` (fix CHECK constraint `event_type` supaya event type masa depan tetap `2xx`, bukan `503`). Tanpa deploy, seluruh pemrosesan webhook silently gagal (Postgres error "function does not exist", tapi route tetap balas `200 {"ok":true}` karena desain "ACK meski proses gagal") — DB tidak pernah ter-update, notifikasi tidak pernah terkirim. Bukan bug kode — murni migration menunggu dijalankan. Konsisten dengan gap tercatat 2026-09-01 (T-036): classifier auto-mode Claude Code memblokir eksekusi `prisma migrate deploy` dari sesi manapun terhadap database live — bukan sesuatu yang bisa dijalankan AI sendiri. King Rezi/tim perlu menjalankan `bun run db:deploy` (atau `prisma migrate deploy` manual) terhadap database dev yang dipakai, lalu retest 3 skenario (post.published, post.error, account.token_expired) yang belum bisa diverifikasi Najwa karena terblokir ini. Dicatat sebagai **KI-048** di `PROJECT_STATE.md` § Known Issues + Blockers.

Detail lengkap checklist: `tasks/v02-publishing-mvp.md` § T-026 dan § T-036 (T-036.5).

---

## 2026-09-07 — Follow-up T-036.4: regresi alignment header notification panel diperbaiki (feedback King Rezi)

Setelah penutupan T-036.4 (entri di bawah), King Rezi mereview langsung
tampilan asli di `localhost:3000` dan melaporkan 3 hal lewat elemen yang
diselect di browser: (1) title "Notifications", tombol "Mark all as
read", dan tombol close tidak sejajar satu baris, (2) padding/margin
header sheet tidak sesuai, (3) minta dipastikan kode sama persis dengan
Claude Design.

**Root cause:** tombol close **bawaan** komponen `SheetContent` (shadcn)
diposisikan `absolute top-4 right-4` — posisinya independen dari flex row
header manapun. `SheetHeader` di `NotificationBell.tsx` sebelumnya juga
masih memakai padding default `p-6` (24px), bukan `p-4` (16px) sesuai
token spec Claude Design `.notif-header { padding: var(--spacing-4) }`.
Kombinasi keduanya membuat pusat vertikal title+"Mark all as read" (di
dalam baris flex, mengikuti padding 24px) dan pusat vertikal tombol close
(mengikuti posisi absolute 16px) secara matematis tidak akan pernah
sejajar, berapa pun classname flex row-nya diubah — bug ini bukan salah
alignment CSS biasa, tapi dua elemen di layout system yang berbeda
(flow normal vs absolute).

**Perbaikan** (`NotificationBell.tsx`):
- `SheetContent showCloseButton={false}` — menonaktifkan tombol close
  bawaan yang absolute.
- Tombol close dirender manual sebagai flex-sibling di dalam grup aksi
  kanan bersama "Mark all as read" — pola yang identik dengan
  `DialogHeader` di `apps/web/src/app/(app)/components/draft-editor/Modal.tsx`
  (baris ~530-573), yang sudah lebih dulu memecahkan masalah yang persis
  sama untuk `Dialog`, jadi bukan pola baru yang dikarang.
- Header diubah ke `p-4` (16px, token `--spacing-4`) + `gap-3` (12px,
  token `--spacing-3`) — match `.notif-header` spec Claude Design persis.
- Grup kanan dibungkus `<div className="flex items-center gap-3">`
  (padanan `.notif-header-actions` spec) supaya title vs grup-aksi diatur
  `justify-between`, dan di dalam grup markall vs close diatur `gap-3`
  juga.

**Verifikasi:** dicek ulang di browser (dev server sesi King Rezi di
`localhost:3000`, workspace "Insvire"). `getBoundingClientRect()` tiap
elemen header dibaca lewat DOM — title (`top:20, bottom:44`, pusat 32px)
dan kedua button (`top:16, bottom:48`, tinggi 32px identik, pusat 32px)
sekarang benar-benar sejajar secara matematis, bukan cuma terlihat
sejajar di screenshot. `getComputedStyle` header mengonfirmasi
`padding: 16px`, `gap: 12px`, `align-items: center`,
`justify-content: space-between` — seluruhnya match token spec. Diklik
juga tombol close manual (`onClick={() => setIsOpen(false)}`, Sheet
controlled) untuk memastikan masih benar-benar menutup panel
(`sheet-content` hilang dari DOM setelah klik, dikonfirmasi). `bun run
typecheck` PASS.

**Status:** perbaikan menyatu ke T-036.4 (`[x]` Done, tidak membuka
kembali status task) karena ini perbaikan visual dalam scope yang sama,
bukan gap fungsional baru. Detail: `tasks/v02-publishing-mvp.md` § T-036
(catatan "Follow-up (2026-09-07)").

---

## 2026-09-07 — T-036.4 ditutup: notification bell/panel diverifikasi cocok spec Claude Design

Sesuai gate AGENTS.md rule 17 (cek Claude Design sebelum menulis kode UI),
dicek dulu project "Social Media Management" di Claude Design —
`components/notifications-panel.html` + section "Notifications Drawer" di
`styles.css` — sebelum melanjutkan T-036.4 yang sempat dibuka kembali
2026-09-01 (5 gap visual dicatat, verifikasi browser belum sempat
dilakukan).

**Temuan:** dibandingkan baris demi baris ke
`apps/web/src/app/(app)/components/notification-panel/NotificationBell.tsx`,
4 dari 5 gap yang dicatat 2026-09-01 ternyata sudah benar sejak migrasi
T-098.3 (background tint item unread, dot indikator unread, weight/warna
title read vs unread, deskripsi ellipsis/`truncate`). Hanya **1 gap
tersisa**: icon circle status untuk kasus "success" masih memakai
workaround netral `bg-muted text-foreground` — komentar kode saat itu
menjelaskan ini karena token `--success`/`--warning` belum ada di Stone
theme shadcn (KI-041). Namun **KI-041 sudah Resolved** sejak 2026-09-04
(ADR-098, 4 token CSS variable baru light+dark ditambahkan) — jadi gap ini
murni kode yang belum di-update mengikuti token baru, bukan temuan desain
baru.

**Perbaikan:** `bg-muted text-foreground` → `bg-success/10 text-success`
(pola identik dengan `bg-destructive/10 text-destructive` yang sudah
dipakai untuk kasus "error"), komentar kode yang menyebut KI-041 belum
resolved diperbarui supaya tidak stale.

**Verifikasi visual:** database `notifications` kosong (0 baris,
dikonfirmasi via Supabase MCP) — T-036.5 (trigger dari webhook) belum
dikerjakan sehingga belum ada jalur produksi yang mengisi tabel ini. Akses
Supabase MCP sesi ini read-only (INSERT ditolak), jadi verifikasi
dilakukan dengan menyisipkan data notifikasi sementara langsung di state
React `NotificationBell` (3 skenario: unread-success, unread-error, read)
untuk keperluan screenshot/inspeksi — **tidak pernah ditulis ke database**.
Browser pane preview punya overlay Next.js dev-tools indicator yang
menutupi sudut kiri-bawah sidebar footer, sehingga verifikasi warna
dilakukan lewat computed style DOM (bukan hanya screenshot manual): icon
"success" resolve ke `rgb(195,209,197)` (persis token `--success` dark
mode `#c3d1c5`), icon "error" resolve ke token `--destructive`. Dot unread,
`font-semibold` vs `font-normal text-muted-foreground` pada title, dan
class `truncate` pada deskripsi juga terkonfirmasi hadir di markup sesuai
spec. Data sementara direvert dari kode sebelum sesi selesai — `git diff`
pada file ini hanya berisi 1 perubahan (`bg-success/10 text-success` +
update komentar). `bun run typecheck` PASS.

**Status:** T-036.4 ditandai `[x]` Done. T-036 tetap `🟡 In Progress` —
T-036.5 (trigger notifikasi dari webhook publish result, masih menunggu
integrasi Outstand nyata/T-025) belum dikerjakan. Detail:
`tasks/v02-publishing-mvp.md` § T-036, `TASKS.md` § Fokus sekarang.

**Catatan tambahan (di luar scope, tidak ditindaklanjuti sesi ini):**
Supabase advisor melaporkan 8 tabel tanpa Row Level Security aktif
(`_prisma_migrations`, `identity_user`, `identity_session`,
`identity_account`, `identity_verification`, `workspaces`,
`background_jobs`, `outstand_webhook_events`) — exposed penuh ke role
`anon`/`authenticated`. Tidak diperbaiki sendiri (mengaktifkan RLS tanpa
policy akan memblokir akses), perlu keputusan eksplisit King Rezi soal
policy yang tepat untuk tiap tabel.

---

## 2026-09-04 — Docs consistency audit (topik T-102/migrasi shadcn) — 5 file wording usang diperbaiki

Dijalankan via skill `docs-consistency-audit` (scope topic-based: T-102 /
migrasi shadcn), dipicu King Rezi setelah verifikasi status migrasi Astryx →
shadcn di PR #105. `TASKS.md`, `PROJECT_STATE.md`, dan
`tasks/v07-astryx-shadcn-migration.md` sendiri sudah konsisten (T-102
`✅ Done`, v0.7 tuntas 100%) — temuan hanya berupa **wording usang** (kategori
5, referensi usang) di 5 dokumen lain yang masih menyiratkan migrasi
"berjalan incremental"/"coexist sementara" atau menyebut sisa pekerjaan yang
sebenarnya sudah tuntas:

- [`AGENTS.md`](../AGENTS.md) — 3 lokasi: baris "Stack & layout" (§ UI),
  hard rule 14, dan section "Workflow shadcn/ui wajib" — diganti jadi
  menyatakan migrasi tuntas 100% (T-102 `✅ Done`, 0 dependency
  `@astryxdesign/*` tersisa).
- [`context/ctx-design.md`](../context/ctx-design.md) poin 4 — hapus klaim
  "sisa pekerjaan v0.7 hanya T-102.4/T-102.3" (keduanya sudah selesai).
- [`context/ctx-implementation.md`](../context/ctx-implementation.md) §
  UI Components — sama, hapus klaim sisa pekerjaan.
- [`context/ctx-development.md`](../context/ctx-development.md) aturan 6 —
  ganti "berjalan incremental per route-segment" jadi "tuntas 100%".
- [`context/ctx-technical-context.md`](../context/ctx-technical-context.md)
  tabel Stack, baris UI Components — sama.

Tidak ada temuan Kelas B (ambigu). Temuan tambahan di luar scope file
project — body [PR #105](https://github.com/reziSaktiva/social-media-management/pull/105)
di GitHub masih menyebut "T-102.5 belum dikerjakan" dan tidak menyebut
KI-045/KI-041/KI-035/KI-046/KI-047 — **diperbaiki setelah izin eksplisit
King Rezi** (`gh pr edit 105`): body diupdate mencerminkan status terkini
(T-102.5 tuntas, rilis v0.7 selesai 100%, KI-045/KI-041/KI-035 semua
Resolved dengan detail root cause & fix masing-masing, 2 KI baru
KI-046/KI-047 dicatat sebagai out-of-scope tidak memblokir merge).

---

## 2026-09-04 — Tutup KI-045, KI-041, KI-035 (RBAC Settings, token Stone `--success`/`--warning` ADR-098, Calendar mobile agenda) — 2 KI baru dicatat

Sesi lanjutan pasca-T-102 (rilis v0.7 tuntas), branch
`feature/t-102-cleanup-verifikasi-akhir`. Tiga Known Issue dikerjakan
bertahap, semua lolos implementasi + review Ridwan (0 temuan) + QA Najwa
(semua PASS, typecheck/lint/235 test hijau):

**1. KI-045 (Role Creator masih bisa akses Settings → General/Members/
Billing) — Resolved.** Root cause: `settings/page.tsx` (General) dan
`billing/page.tsx` memang **tidak pernah** punya guard role sejak awal
(bukan regresi migrasi T-099 seperti dugaan awal T-102.4) — hanya
`members/page.tsx` yang sudah benar dari fix KI-038 sebelumnya. Fix:
`WorkspaceService.canManageWorkspaceSettings()` +
`assertActorCanManageWorkspaceSettings()` (pola sama `canManageMembers`),
dipanggil dari guard di `settings/page.tsx` (redirect ke
`/settings/account`), `settings/billing/page.tsx` (redirect sama), **dan**
dari method `renameWorkspace()` di service layer (bukan cuma guard UI).
QA Najwa konfirmasi: Creator (Sinta) redirect di ketiga halaman, Owner
(Raka)/Admin (Maya) tetap normal akses, guard Members lama tidak rusak.
File: `apps/web/src/domains/workspace/services/workspace.service.ts`,
`apps/web/src/app/(app)/settings/page.tsx`,
`apps/web/src/app/(app)/settings/billing/page.tsx`.

**2. KI-041 (Stone theme shadcn belum punya token `--success`/`--warning`)
— Resolved via ADR-098.** King Rezi memutuskan (2026-09-04) menambah token
baru (bukan tetap netral). **ADR-098** mengamandemen pemetaan token Stone
T-095.5: 4 token CSS variable baru (`--success`/`--success-foreground`/
`--warning`/`--warning-foreground`) untuk light+dark mode di
`apps/web/src/app/globals.css`, nilai desaturated konsisten
`--destructive` (bukan saturated generik), kontras ≥6.3:1 WCAG AA. Nilai
final:
- Light: `--success: #3d5240`, `--success-foreground: #eef1ec`,
  `--warning: #6b5228`, `--warning-foreground: #f4ede0`
- Dark: `--success: #c3d1c5`, `--success-foreground: #1c2a1e`,
  `--warning: #e2c896`, `--warning-foreground: #2e2412`

Desain didokumentasikan di Claude Design `foundations/color.html` §
"Stone/shadcn semantic tokens (KI-041)" (dikerjakan langsung di sesi
utama karena `DesignSync` gagal dimuat di sesi subagent Neymar —
kegagalan ke-5, dicatat di `.claude/agents/README.md`). Implementasi
kode: state "success"/"expired" di `AcceptInvitePageClient.tsx` (state
"invalid" tetap `text-destructive`, tidak diubah), badge "Pending" di
`MembersTable.tsx` (`Badge variant="secondary"` + className warning,
`badge.tsx` sendiri tidak diubah). QA Najwa konfirmasi warna via
`getComputedStyle` cocok token di light+dark untuk Accept Invite; badge
Pending diverifikasi CSS-nya benar tapi tidak bisa diuji dengan data
nyata — ditemukan gap terpisah (lihat KI-046 di bawah).

**3. KI-035 poin 3 (layout Calendar mobile sempit ~375px) — Resolved,
KI-035 sekarang full Resolved.** Rancangan agenda/list mobile didesain di
Claude Design `templates/publish-calendar.html` (kolom baru "State —
Mobile Agenda", additive, tidak mengubah state Week/Month desktop yang
sudah ada), lalu diimplementasi: komponen baru `CalendarAgendaList.tsx`
(list per-tanggal, reuse data source `flattenCalendarItemsToEntries` dan
popover `CalendarPostPopover` yang sama dengan grid desktop — tidak ada
duplikasi logic), `CalendarScreen.tsx` diubah untuk conditional render
CSS-only (`hidden md:block` grid vs `block md:hidden` agenda). QA Najwa
konfirmasi: desktop grid tidak berubah, mobile 375px tampil agenda list
dikelompokkan per tanggal dengan badge "Hari ini", klik entry buka
Popover dengan benar, light+dark mode oke. Dengan ini **KI-035 status
jadi full Resolved** (poin 1 & 2 sudah Resolved sebelumnya di
T-101.1/T-102.5).

**4. KI-046 (baru) — `MemberStatus.Pending` tidak pernah di-assign di
flow produksi manapun.** Ditemukan Najwa saat QA badge warning KI-041:
flow invite saat ini (accept invitation) selalu langsung membuat member
berstatus Active, bukan Pending — badge "Pending" jadi dead code
fungsional, hanya dipakai di unit test. Bukan bug sesi ini (gap lama),
baru ketahuan sekarang karena QA mencoba menguji badge dengan data
nyata. Kategori Tech-Debt/Gap, tidak memblokir apa pun. Detail:
`PROJECT_STATE.md` § KI-046.

**5. KI-047 (baru) — Claude Design "Social Media Management" belum
disinkronkan ke Stone theme shadcn.** Ditemukan saat kerja KI-041:
seluruh project Claude Design ternyata masih 100% dokumentasi Astryx lama
("Astryx fidelity policy", basis `@astryxdesign/theme-neutral@0.1.8`) —
tidak pernah disinkronkan ke Stone theme shadcn/ui yang jadi baseline
kode sejak ADR-097. Gap dokumentasi besar, di luar scope sesi ini (yang
hanya menambah 2 section baru secara additive). Kategori Process/Design
Gap, perlu keputusan King Rezi soal resync besar-besaran. Detail:
`PROJECT_STATE.md` § KI-047.

File yang diubah: `PROJECT_STATE.md` (tutup KI-045/KI-041/KI-035, tambah
KI-046/KI-047, Snapshot, Completed Ringkasan, Recent Decisions),
`DECISIONS.md` + `decisions/ADR-098-token-success-warning-stone-theme-shadcn.md`
(ADR-098 baru), `TASKS.md` (update catatan baris T-102/T-097 di Fokus
sekarang), `tasks/v07-astryx-shadcn-migration.md` (update catatan T-097,
T-099.2, T-101.1, T-102), `tasks/v01-foundation.md` (update catatan
T-093.4, back-reference ke KI-045), `.claude/agents/README.md`
(kegagalan DesignSync ke-5 di sesi subagent Neymar).

---

## 2026-09-04 — T-102.5 tuntas — T-102 (Cleanup & Verifikasi Akhir) Done, rilis v0.7 selesai 100%

Gibran Project Manager menutup **T-102.5** (Re-evaluasi & tutup Known Issues
sisa migrasi Astryx→shadcn, rilis v0.7, ADR-097) berdasarkan verifikasi
langsung ke kode, bukan tebakan:

- **KI-005** (Astryx masih Beta) ditutup **Resolved (2026-09-04) — moot**.
  Dicek `apps/web/package.json` dan grep `@astryxdesign` di seluruh
  `apps/web/src`: tidak ada dependency `@astryxdesign/*` tersisa, hanya
  komentar historis (bukan import aktif) di `globals.css`,
  `MembersTable.tsx`, `ChannelsSection.tsx`, `layout.tsx` auth/onboarding,
  `text.tsx`, `lib/utils.ts`. Astryx sudah dihapus total (T-102.1 tuntas
  penuh) sehingga risiko "Astryx masih Beta" tidak relevan lagi.
- **KI-030** (`TimeInput` Astryx) dan **KI-035** poin 1 (StyleX/`xstyle`)
  dikonfirmasi **sudah Resolved sebelumnya** (T-100.3 dan T-101.1, keduanya
  2026-09-03) — tidak dihitung sebagai temuan baru T-102.5, kontennya tidak
  diubah.
- **KI-035** poin 2 (`Badge` Astryx tanpa prop `size`/truncation, workaround
  `StatusDot`+`Icon` compact di Calendar mobile) **baru dievaluasi dan
  ditutup Resolved (2026-09-04, T-102.5)**. Dicek
  `apps/web/src/components/ui/badge.tsx` (shadcn `Badge`, `cva`-based,
  `className` bebas — bukan API tertutup props-only seperti Astryx) dan
  `CalendarEntryFooter.tsx` (komentar internal file sudah menyebut migrasi
  penuh ke shadcn+Tailwind, T-102 cleanup ADR-097). Root cause lama hilang
  karena `Badge` sekarang Tailwind-composable — size/truncation bisa
  ditangani lewat class Tailwind di titik pemakaian. Workaround dot+icon
  compact mobile (<768px) **dipertahankan**, tapi sekarang sebagai
  **keputusan UX** (kepadatan layout kartu Calendar sempit), bukan lagi
  keterpaksaan teknis Astryx — bukan bug.
- **KI-035** poin 3 (layout Calendar mobile ~375px) **tetap Open**, di luar
  scope T-102.5 (task eksplisit hanya minta poin 1 & 2), butuh rancangan
  baru di Claude Design (rule 17 `AGENTS.md`).

Dengan T-102.5 tuntas, seluruh 6 subtask **T-102** (T-102.1, T-102.2,
T-102.3, T-102.4, T-102.5, T-102.6) sudah ✅ — **T-102 ditutup `✅ Done`**,
dan dengan itu **rilis v0.7 (migrasi Astryx→shadcn/ui, ADR-097) tuntas
100% (8/8 task, 38/38 subtask)**. Task selesai naik 32 → **33** dari 85
total (dihitung ulang langsung dari `tasks/v07-astryx-shadcn-migration.md`,
bukan asumsi). File yang diubah: `PROJECT_STATE.md` (KI-005, KI-035,
Snapshot, Completed Ringkasan), `tasks/v07-astryx-shadcn-migration.md`
(T-102.5 dicentang, status T-102 → Done, update note baru), `TASKS.md`
(indeks v0.7, Total, Fokus sekarang, update note baru).

---

## 2026-09-04 — Gap verifikasi visual T-102.6 (toast) ditutup — konfirmasi manual King Rezi

King Rezi mengecek manual sendiri di browser (Publish → Queue → trigger
Cancel Schedule) dan mengonfirmasi singkat: **"toast oke"** — toast baru dari
`sonner` tampil benar menggantikan toast Astryx lama. Ini menutup gap
verifikasi visual yang tercatat terbuka di entri T-102.6 sebelumnya (dev
server sempat minta login, tidak ada kredensial test di sesi AI). Catatan:
ini **tidak** menutup T-102.4 (QA visual menyeluruh Najwa QA Engineer, area
Auth/Onboarding/App Shell/Settings/Publish/Dashboard) — scope T-102.4 jauh
lebih besar, hanya satu titik verifikasi (toast Cancel Schedule) yang
tertutup di sini. Status T-102 tidak berubah (`🟡 In Progress`, sisa
T-102.3, T-102.4, T-102.5). Detail:
`project-manager/tasks/v07-astryx-shadcn-migration.md` § T-102.

---

## 2026-09-04 — T-102.6 selesai: Migrasi `useToast` Astryx → shadcn (`sonner`) — T-102.1 tuntas penuh (v0.7)

**T-102.6** (baru, ditemukan saat grep ulang T-102.2 sebelumnya) selesai
dikerjakan Mark UI Engineer di branch
`feature/t-102-cleanup-verifikasi-akhir` — migrasi `useToast` terakhir yang
tersisa dari `@astryxdesign/core` ke padanan shadcn. Dengan ini **T-102.1
(hapus dependency Astryx) tuntas sepenuhnya** (sebelumnya partial).

**Detail teknis:**

- Component `sonner` di-install via `bunx shadcn@latest add @shadcn/sonner`
  ke `apps/web/src/components/ui/sonner.tsx`, lalu diadaptasi: dependensi
  `useTheme` dari `next-themes` dihapus (project punya mekanisme tema
  sendiri — cookie + class `dark`, lihat ADR-055/ADR-097 poin 9) — `theme`
  diterima sebagai prop biasa dengan default `"system"`.
- `<Toaster theme={mode} />` dipasang sekali di root
  `apps/web/src/components/Providers.tsx`, memakai `mode` dari
  `useThemeMode` context yang sudah ada — pola sama seperti
  `TooltipProvider`.
- `apps/web/src/app/(app)/publish/queue/components/QueueScreen.tsx`:
  `useToast` dari `@astryxdesign/core/Toast` diganti `toast()` dari
  `sonner`, pesan dipertahankan persis ("Jadwal dibatalkan — post kembali
  ke Drafts").
- Dependency `sonner` ditambahkan ke `apps/web/package.json`; `next-themes`
  yang otomatis ditambah CLI dihapus lagi karena jadi unused setelah
  adaptasi.
- **T-102.1 tuntas**: `@astryxdesign/core` (sisa dependency Astryx terakhir)
  dihapus dari `apps/web/package.json`. `bun install` dijalankan di root
  repo, `bun.lock` sinkron.

**Verifikasi**: `bun run typecheck` PASS 0 error; `bunx eslint .` PASS 0
error (1 pesan info generik "Pages directory cannot be found" dari plugin
next/eslint dikonfirmasi pre-existing lewat `git stash` test, bukan
regresi). Grep `@astryxdesign` di `apps/web/src` sekarang **0 import
aktif** (sisa hanya komentar historis yang menyebut nama package sebagai
referensi).

**Gap terbuka (belum ditutup)**: verifikasi visual browser (bagian dari
T-102.4) untuk toast baru **belum bisa dilakukan** sesi ini — dev server
lokal minta login dan tidak ada kredensial test tersedia untuk
memverifikasi toast tampil benar di Publish → Queue (trigger Cancel
Schedule). Presedan sama seperti dicatat sebelumnya di file ini (baris
1405 versi lama). Kode sudah siap, eyeball check masih pending — perlu
King Rezi kasih kredensial atau cek manual sendiri sebelum T-102.4
ditutup.

**Dokumentasi terkait**: `project-manager/tasks/v07-astryx-shadcn-migration.md`
§ T-102 (checklist T-102.1 dan T-102.6 ditandai selesai + update note baru),
`project-manager/TASKS.md` (baris fokus T-102 + update note baru). Subtask
v0.7 selesai naik 33 → **35** dari 38 total. Sisa T-102: T-102.3, T-102.4,
T-102.5 — T-102 secara keseluruhan masih `🟡 In Progress`.

---

## 2026-09-03 — T-101.5 selesai: Migrasi Dashboard ke shadcn/ui — T-101 Done (5/5 subtask, v0.7)

**T-101.5** (Dashboard: `DashboardHome.tsx`, subtask terakhir dari **T-101**
Migrasi Publish — Calendar, Queue, Drafts, Dashboard, rilis v0.7 migrasi
Astryx→shadcn/ui, ADR-097) selesai di branch
`feature/t-101-publish-calendar-queue-drafts-migration`. Dengan ini
**T-101 ditutup `✅ Done` (5/5 subtask)**.

**File yang diubah**: `apps/web/src/app/(app)/components/DashboardHome.tsx`
— migrasi penuh dari Astryx (`Card`, `EmptyState`, `Grid`, `Heading`,
`HStack`, `ProgressBar`, `Section`, `Selector`, `Text`, `VStack`) ke
shadcn/ui.

**File baru**: `apps/web/src/components/ui/progress.tsx` (via `bunx
shadcn@latest add progress`, belum pernah ada sebelumnya, di-discover dulu
via MCP search/view/examples sebelum install).

**Pemetaan komponen:**

- `VStack`/`HStack`/`Section` → Tailwind flex/grid (pola sama
  `PublishPageHeader.tsx` T-101.4)
- `Heading level={1}`/`level={2}` → `<h1>`/`<h2>` raw + Tailwind (pola sama
  `SettingsPageHead` T-099.1)
- `Text type="supporting"` → shadcn `Text variant="muted"`/`"small"`
- `Selector` (weekly/monthly) → shadcn `Select`/`SelectTrigger`/
  `SelectValue`/`SelectContent`/`SelectItem` (pola sama
  `CalendarToolbar.tsx` T-101.1)
- `Card` → shadcn `Card`/`CardContent`
- `EmptyState` → shadcn `Empty`/`EmptyHeader`/`EmptyTitle`/
  `EmptyDescription`
- `Grid` (3 StatTile) → `grid grid-cols-1 sm:grid-cols-3 gap-4`
- `ProgressBar` → shadcn `Progress` (Radix, skala value 0-100) — tidak ada
  value-label formatting bawaan seperti Astryx (`hasValueLabel`/
  `formatValueLabel`), jadi label persentase dirender manual sebagai
  `Text` di atas komponen `Progress` — dicatat sebagai gap desain-token/API
  konsisten dengan presedan gap serupa di T-101.1/T-101.3, bukan
  penyimpangan baru.

**Tidak diubah**: state `period`, `useTransition`, Server Action
`getDashboardSummaryAction`, guard `latestRequestedPeriod` — murni migrasi
presentasi. **KI-036** (dashboard fetch via Server Action menyimpang
RS-D02) tetap technical debt terpisah, tidak disentuh.

**Gate rule 17 AGENTS.md:** rancangan Home/Dashboard dicek dulu ke Claude
Design project "Social Media Management" (`templates/home.html`, KSP-01 —
Home, section Analytics Snapshot) — sudah ada, implementasi lanjut tanpa
hambatan.

**Verifikasi**: `bun run typecheck` PASS 0 error; `bunx eslint` PASS 0
error; verifikasi visual browser (Mark UI Engineer) — empty state dark
mode PASS, golden path dark+light mode PASS, mobile 375px PASS (tidak
overflow), interaksi ganti periode Mingguan↔Bulanan via Select berfungsi,
console browser bersih. Review arsitektur Ridwan Architecture Reviewer:
**0 temuan** (logic tidak berubah, tidak ada import Prisma/Supabase/
Outstand, cross-domain lewat barrel `@/domains/analytics`, prop/variant
shadcn diverifikasi valid ke source `cva()`).

**Dampak indeks:** `TASKS.md` — v0.7 breakdown 6 ✅ · 1 🟡 · 1 ⏳ → **7 ✅
· 1 ⏳**; task selesai global 31 → **32**; hitungan subtask v0.7 tidak
berubah (37, dihitung ulang langsung dari
`tasks/v07-astryx-shadcn-migration.md`). Task berikutnya rilis v0.7:
**T-102 Cleanup & Verifikasi Akhir**.

Detail lengkap: `project-manager/tasks/v07-astryx-shadcn-migration.md` §
T-101.

---

## 2026-09-03 — T-101.4 selesai: Migrasi Publish — Header/Tabbar/Layout ke shadcn/ui (T-101 v0.7, 4/5 subtask)

**T-101.4** (Header/Tabbar/Layout, bagian dari **T-101** Migrasi Publish —
Calendar, Queue, Drafts, Dashboard, rilis v0.7 migrasi Astryx→shadcn/ui,
ADR-097) selesai di branch
`feature/t-101-publish-calendar-queue-drafts-migration`. T-101 tetap `🟡
In Progress` (4 dari 5 subtask tuntas).

**File yang diubah**:
`apps/web/src/app/(app)/publish/components/PublishPageHeader.tsx`,
`apps/web/src/app/(app)/publish/components/PublishTabbar.tsx`,
`apps/web/src/app/(app)/publish/layout.tsx`.

**Ringkasan migrasi:**

- `PublishPageHeader.tsx`: `HStack`/`VStack`/`Heading`/`Text`/`Button`
  Astryx → Tailwind flex + `<h1>` raw (pola sama dengan
  `SettingsPageHead` T-099.1) + `Text` (`variant="muted"`) + `Button`
  shadcn. Icon `PlusSignIcon` (hugeicons) mengganti label literal "+".
- `PublishTabbar.tsx`: `TabList`/`Tab` Astryx → shadcn `Tabs`/`TabsList`
  (`variant="line"`)/`TabsTrigger` (Radix Tabs). Karena navigasi rute
  (bukan tab client-side), tiap `TabsTrigger` di-render `asChild` sebagai
  `next/link` Link, `Tabs` dikontrol lewat `value` dari `usePathname()`
  supaya active state sinkron dengan URL (tanpa `onValueChange`, murni
  route-driven).
- `layout.tsx`: `VStack` Astryx → Tailwind flex, tetap composition murni
  tanpa business logic.
- Komponen shadcn baru: `tabs` (`bunx shadcn@latest add @shadcn/tabs` →
  `apps/web/src/components/ui/tabs.tsx`, style `radix-maia`). Komponen
  lain (`Button`, `Text`) sudah tersedia dari migrasi sebelumnya.
- Catatan minor (bukan penyimpangan): ukuran heading "Publish"
  (`text-2xl font-semibold`) keputusan gaya Mark UI Engineer karena tidak
  ada variant `Text` shadcn yang cocok untuk page-header ringkas — sama
  alasan dengan `SettingsPageHead` (T-099.1) pakai `<h2>` raw. Nit
  non-arsitektur dari Ridwan: docstring di `PublishTabbar.tsx` menyebut
  `onValueChange` padahal tidak dipakai di kode (kosmetik).
- History tab menampilkan halaman scaffold placeholder (T-034, di luar
  scope task ini) — bukan regresi.

**Verifikasi:** `bun run typecheck` PASS 0 error; `bunx eslint` pada 4
file yang diubah PASS 0 error/warning; verifikasi visual browser (Mark UI
Engineer, akun Raka Pratama/Owner, workspace Insvire) PASS — light/dark
mode, tab switching Calendar→Queue→Drafts→History (active underline &
subtitle header berpindah benar, routing Next.js tanpa full reload),
tombol "+ New Post" membuka Draft Editor modal, mobile ~375px rapi, tidak
ada regresi. Review arsitektur Ridwan: 0 temuan (entry point tanpa
business logic, tidak ada import Prisma/Supabase/HTTP Outstand, tidak ada
pelanggaran cross-domain/shared types).

Detail lengkap: `tasks/v07-astryx-shadcn-migration.md` § T-101.

---

## 2026-09-03 — T-101.3 selesai: Migrasi Publish — Drafts ke shadcn/ui (T-101 v0.7, 3/5 subtask)

**T-101.3** (Drafts, bagian dari **T-101** Migrasi Publish — Calendar,
Queue, Drafts, Dashboard, rilis v0.7 migrasi Astryx→shadcn/ui, ADR-097)
selesai di branch `feature/t-101-publish-calendar-queue-drafts-migration`.
T-101 tetap `🟡 In Progress` (3 dari 5 subtask tuntas).

**File yang diubah**:
`apps/web/src/app/(app)/publish/drafts/components/DraftsList.tsx`.

**Ringkasan migrasi:**

- Migrasi penuh dari Astryx (`VStack`, `Card`, `EmptyState`,
  `List`/`ListItem`) ke shadcn/ui (`Card`/`CardContent`,
  `Empty`/`EmptyHeader`/`EmptyTitle`/`EmptyDescription`,
  `Item`/`ItemGroup`/`ItemContent`/`ItemTitle`/`ItemDescription`/
  `ItemActions`).
- Tidak ada komponen shadcn baru yang di-install — `Card`/`Empty`/`Item`
  sudah ada dari migrasi T-099.3 (`ConnectedAccountsList.tsx`,
  `WorkspacesSettingsView.tsx`), dipakai sebagai presedan langsung
  (baris klik-penuh pakai `Item asChild` membungkus `<button>`, divider
  antar baris pakai `divide-y divide-border` pada `ItemGroup`).
- **Keputusan desain:** `Badge` Astryx (`@astryxdesign/core/Badge`)
  sengaja dipertahankan untuk indikator warna status (6 varian status
  semantik `neutral/warning/info/purple/success/error`, Stone theme
  shadcn cuma punya `default/secondary/destructive/outline/ghost/link`)
  — presedan sama persis dengan `Modal.tsx` (T-100.1) dan
  `CalendarPostPopover.tsx`/`CalendarEntryFooter.tsx` (T-101.1), bukan
  penyimpangan baru.

**Verifikasi:**

- `bun run typecheck` PASS 0 error; `bunx eslint` pada file yang diubah
  PASS 0 error/warning.
- Verifikasi visual browser (Mark UI Engineer, akun Raka Pratama/Owner,
  workspace Insvire): list drafts render normal, klik baris membuka
  modal Edit Draft dengan benar. Light mode OK, dark mode OK, mobile
  375px OK (tidak ada overflow/elemen rusak, caption panjang wrap dengan
  baik). Console browser bersih.
- Review arsitektur Ridwan: 0 temuan — file murni komponen UI client,
  tidak menyentuh Server Action/domain layer, import
  `PublishingPostRecord` lewat barrel `@/domains/publishing` (public
  API, bukan implementasi langsung), tidak ada import Prisma/Supabase/
  HTTP Outstand, props/variant shadcn (`Card`, `Empty`, `Item`, dst.)
  dicocokkan valid ke source `cva()` di `apps/web/src/components/ui/`.
  `eslint-disable no-restricted-syntax` pada `<div>` pembungkus dicek
  valid — ada exception rule resmi di `eslint.config.mjs` untuk file
  yang sudah dimigrasi shadcn.

**Status setelah T-101.3:** T-101 tetap `🟡 In Progress` — sisa T-101.4
(`PublishPageHeader.tsx`, `PublishTabbar.tsx`,
`app/(app)/publish/layout.tsx`) dan T-101.5 (Dashboard:
`DashboardHome.tsx`) belum dikerjakan.

---

## 2026-09-03 — T-101.2 selesai: Migrasi Publish — Queue ke shadcn/ui (T-101 v0.7, 2/5 subtask)

**T-101.2** (Queue, bagian dari **T-101** Migrasi Publish — Calendar,
Queue, Drafts, Dashboard, rilis v0.7 migrasi Astryx→shadcn/ui, ADR-097)
selesai di branch `feature/t-101-publish-calendar-queue-drafts-migration`.
T-101 tetap `🟡 In Progress` (2 dari 5 subtask tuntas).

**File yang diubah** (semua di
`apps/web/src/app/(app)/publish/queue/components/`): `QueueList.tsx`,
`QueueScreen.tsx`.

**Ringkasan migrasi:**

- Tidak ada komponen shadcn baru yang perlu di-install — semua
  (`Button`, `Card`, `Select`, `Empty`, `Text`, `Separator`, `Tooltip`,
  `Alert`, `AlertDialog`, `Spinner`) sudah tersedia dari migrasi
  sebelumnya.
- Icon aksi (Publish Now, Edit, Cancel Schedule) dan icon jam pindah ke
  `hugeicons` (`SentIcon`, `PencilEdit01Icon`, `Cancel01Icon`,
  `Clock01Icon`). Icon platform (Instagram/Facebook) tetap `react-icons`
  — dikecualikan per ADR-058 (ikon brand), dikonfirmasi bukan
  pelanggaran oleh Ridwan Architecture Reviewer.
- Dialog "Batalkan jadwal ini?" (Cancel Schedule, Tier 2 ADR-049) memakai
  pola `AlertDialogAction` + `preventDefault()` sesuai presedan
  `MembersTable.tsx` — dialog tetap terbuka sampai proses selesai.
- **Gap dicatat (bukan penyimpangan):** `useToast` masih dari Astryx —
  dikonfirmasi (grep) sebagai satu-satunya titik pakai Toast di seluruh
  app, belum ada padanan shadcn (`sonner`) terpasang. Migrasi toast
  butuh keputusan sistem baru untuk seluruh app → di luar scope T-101.2.
  Ridwan menilai ini gap yang sah di bawah kebijakan migrasi incremental
  ADR-097, bukan pelanggaran, dan menyarankan jadi item backlog terpisah
  ("pilih & install sistem toast shadcn/sonner, migrasi titik pakai
  terakhir").

**Verifikasi:**

- `bun run typecheck` PASS 0 error; `bunx eslint` pada 2 file PASS 0
  error.
- Verifikasi visual browser (akun Raka Pratama/Owner, workspace
  Insvire): tampilan normal, filter akun berfungsi (termasuk reset ke
  "Semua akun"), dialog Cancel Schedule berfungsi end-to-end (toast
  muncul, item hilang dari list), tidak ada regresi. Light mode, dark
  mode, mobile 375px dicek — tidak ada overflow/elemen rusak. Console
  browser bersih.
- Review arsitektur Ridwan: 0 temuan (entry point `actions.ts` tidak
  tersentuh, domain `publishing` tidak tersentuh, tidak ada import
  Prisma/Supabase/Outstand, cross-domain lewat barrel
  `@/domains/publishing`, semua prop/variant shadcn diverifikasi valid
  ke source `cva()`).

**Dokumen yang diupdate:** `TASKS.md` (baris ringkasan T-101 + blok
Update di atas Total task), `tasks/v07-astryx-shadcn-migration.md` § T-101
(checklist T-101.2 + catatan detail), `PROJECT_STATE.md` (Snapshot, Current
Focus, Completed Ringkasan — geser T-096 keluar dari daftar 5 item
terakhir).

Next subtask: **T-101.3** (Drafts: `DraftsList.tsx`).

---

## 2026-09-03 — T-101.1 selesai: Migrasi Publish — Calendar ke shadcn/ui (T-101 v0.7 dibuka, 1/5 subtask)

**T-101.1** (Calendar, bagian dari **T-101** Migrasi Publish — Calendar,
Queue, Drafts, Dashboard, rilis v0.7 migrasi Astryx→shadcn/ui, ADR-097)
selesai di branch `feature/t-101-publish-calendar-queue-drafts-migration`.
T-101 berubah `⏳ Not Started` → `🟡 In Progress` (baru 1 dari 5 subtask
tuntas).

**File yang diubah** (semua di
`apps/web/src/app/(app)/publish/calendar/components/`):
`CalendarScreen.tsx`, `CalendarToolbar.tsx`, `CalendarPostPopover.tsx`,
`CalendarEntryFooter.tsx`, `CalendarMonthGrid.tsx`,
`CalendarWeekGrid.tsx`. Baru: `apps/web/src/components/ui/popover.tsx`
(generated via shadcn CLI).

**Ringkasan migrasi:**

- 4 dari 6 file (`CalendarMonthGrid`, `CalendarWeekGrid`,
  `CalendarToolbar`, `CalendarScreen`) full shadcn.
- `CalendarPostPopover.tsx` dimigrasi ke shadcn `Popover` (controlled
  `open`/`onOpenChange`), pola ADR-090/091 dipertahankan penuh (klik post
  → Popover ringkasan → CTA "Buka Draft Editor"; dikonfirmasi browser,
  hover tidak membuka popover).
- `CalendarPostPopover.tsx` dan `CalendarEntryFooter.tsx` sengaja
  mempertahankan Astryx `Badge`/`StatusDot`/`Icon` untuk indikator status
  warna — Stone theme shadcn belum punya token semantik
  `success`/`warning`/`info`/`purple` untuk 6 varian `ContentStatus`
  (hanya `accent`/`destructive`). Gap desain-token yang sama seperti
  `Modal.tsx` (T-100.1), bukan penyimpangan baru.

**Re-evaluasi KI-035** (gap infrastruktur ditemukan saat T-033):

- Poin 1 (StyleX/`xstyle` tidak ter-setup) — **ditutup Resolved**, grid
  Calendar sekarang 100% Tailwind (`grid-cols-7`), tidak ada dependency
  `xstyle` sama sekali.
- Poin 3 (layout mobile sempit ~375px) — **tetap Open**. Diverifikasi
  browser mobile 375px: toolbar filter stack vertikal, footer card pakai
  `StatusDot`+`Icon` compact — sudah berfungsi baik, tapi perubahan
  mendasar ke pola agenda/list butuh rancangan baru di Claude Design
  (di luar scope T-101.1).
- Poin 2 (`Badge` Astryx tanpa prop `size`/truncation) tidak dievaluasi
  ulang, tetap Open, di luar scope T-101.1.
- Status KI-035 diubah jadi "Sebagian Resolved — sisa scope: poin 3".

**Verifikasi:**

- `bun run typecheck` PASS, 0 error.
- `bun run lint`/`bunx eslint` 7 file PASS, 0 error/warning.
- Verifikasi visual browser (Mark UI Engineer, akun Maya Anggraini/Admin,
  workspace Insvire) PASS semua: month view, week view, toolbar (navigasi
  Today/‹/›, filter status+akun, toggle Week/Month), Popover klik-post
  (light-dismiss OK), light mode, dark mode, mobile 375px — tidak ada
  regresi visual.
- Review arsitektur Ridwan: 0 temuan — entry point tidak tersentuh, tidak
  ada import Prisma/Supabase/HTTP Outstand di komponen ini, cross-domain
  tetap lewat public API index, tidak ada refactor business logic/state
  management diam-diam, props/variant shadcn yang dipakai sudah
  diverifikasi valid ke `cva()` source.

Belum di-commit. Detail lengkap:
`tasks/v07-astryx-shadcn-migration.md` § T-101, `TASKS.md`,
`PROJECT_STATE.md` § KI-035.

---

## 2026-09-03 — T-100 ditutup ✅ Done sepenuhnya: Migrasi Publish — Draft Editor Modal (4/4 subtask tuntas)

**T-100** (Migrasi Publish — Draft Editor Modal, rilis v0.7, migrasi
Astryx→shadcn/ui, ADR-097) ditutup `✅ Done` — seluruh 4 subtask
(T-100.1–T-100.4) tuntas di branch `feature/t-100-draft-editor-modal`,
file utama `apps/web/src/app/(app)/components/draft-editor/Modal.tsx`
(file paling kompleks di seluruh audit migrasi, ~68 titik pakai Astryx).

**Ringkasan kesimpulan besar (detail per-subtask lengkap ada di
`tasks/v07-astryx-shadcn-migration.md` § T-100, tidak diulang di sini):**

- **T-100.1** — Struktur modal + layout: Astryx `Dialog`/`DialogHeader`/
  `Layout`/`LayoutContent`/`LayoutFooter` → shadcn `Dialog` + Tailwind
  layout manual. Varian Standard/Fullscreen (ADR-065/052) dan
  `ResumeDialog` (`purpose="required"`, tidak bisa ditutup Escape/klik-luar)
  direplikasi penuh.
- **T-100.2** — Form controls: Caption `Textarea`, Media
  `Input type="file"` (disabled), Account `Checkbox`, Content Format
  `RadioGroup`, Pinterest `Input`, Tanggal Jadwal native
  `<input type="date">`. Behavior/logic form tidak diubah — murni
  migrasi UI library. Temuan minor: **KI-043**.
- **T-100.3** — `TimeInput` khusus: native `<input type="time">` lewat
  `Input` shadcn (tidak ada time-picker resmi di registry shadcn).
  **KI-030 Closed** (root cause Astryx `TimeInput` tanpa
  `maxLength`/`pattern` hilang total setelah migrasi). Temuan minor
  baru: **KI-044**.
- **T-100.4** — Verifikasi behavior penuh end-to-end (Najwa QA Engineer,
  murni QA regresi karena `Modal.tsx` tidak punya test komponen
  otomatis): typecheck/lint/test PASS (235 pass, 4 skip, 0 fail); full
  E2E regression PASS semua alur (New Post→Schedule/Publish Now/Save
  Draft, Edit Draft, `ResumeDialog`, toggle Fullscreen↔Standard, Close
  via X/Escape/klik-luar, entry point Calendar/Queue); `Banner`/`Badge`/
  `Divider` Astryx yang belum dimigrasi tidak ada style clash;
  accessibility (tab order, focus-visible) dan RBAC (Owner/Admin/Creator)
  tidak ada gap; console bersih. Catatan minor informational (bukan
  bug): Link "Reconnect" dan field Pinterest tidak bisa diverifikasi
  karena data test tidak punya akun kondisi tersebut; **KI-032** dicatat
  ulang (pre-existing, bukan regresi baru).

Setiap subtask lolos review Ridwan Architecture Reviewer (0 temuan) dan
QA Najwa QA Engineer (PASS) secara terpisah — lihat entri
`COMPLETE_TASK.md` per-subtask di bawah untuk riwayat lengkap sesi kerja.

**Update dokumentasi bersamaan:** `tasks/v07-astryx-shadcn-migration.md`
(status T-100 `🟡` → `✅ Done`, checklist T-100.4 dicentang), `TASKS.md`
(indeks v0.7 5 ✅ · 1 🟡 · 2 ⏳ → **6 ✅ · 2 ⏳**, task selesai 30 → **31**,
Fokus sekarang: T-100 pindah ke Done, **T-101** jadi next task migrasi
shadcn v0.7), `PROJECT_STATE.md` (Snapshot, Completed Ringkasan — bullet
T-095 lama digeser keluar, Metadata Version 1.0.63 → 1.0.64).

Next task migrasi shadcn v0.7: **T-101** (Migrasi Publish — Calendar,
Queue, Drafts, Dashboard).

---

## 2026-09-03 — T-100.3 selesai: `TimeInput` Draft Editor Modal dimigrasi ke native `<input type="time">` (KI-030 Closed, KI-044 baru)

**T-100** (Migrasi Publish — Draft Editor Modal, rilis v0.7, ADR-097) tetap
`🟡 In Progress` — subtask ketiga dari 4 (**T-100.3**) tuntas, dikerjakan
Mark UI Engineer, review Ridwan Architecture Reviewer, QA Najwa QA
Engineer, di branch `feature/t-100-draft-editor-modal`.

**T-100.3 (`TimeInput`) — File:**
`apps/web/src/app/(app)/components/draft-editor/Modal.tsx`

- Cek MCP shadcn (`search_items_in_registries`) — tidak ada komponen
  time-picker resmi di registry shadcn. Pilih native
  `<input type="time">` dibungkus `Input` shadcn, pola identik dengan
  field tanggal (`Input type="date"`) dari T-100.2.
- Hapus import `TimeInput` dari `@astryxdesign/core/TimeInput`. Ganti
  markup jadi `Label htmlFor="draft-schedule-time" className="sr-only"` +
  `Input id="draft-schedule-time" type="time"`, `value={scheduleTime ??
  ""}`, `onChange` set `scheduleTime` ke `event.target.value ||
  undefined`.
- `handleConfirmSchedule` (compose `` `${scheduleDate}T${scheduleTime}` ``)
  dan `isReadyToSchedule` tidak disentuh — format `HH:mm` native
  kompatibel langsung.

**Verifikasi Mark:** typecheck 0 error, lint 0 error, browser E2E (dark &
light) — uji ketik huruf/simbol/overflow ke field waktu ditolak/clamp
oleh browser, submit Schedule end-to-end sukses dengan waktu tersimpan
tepat. **Kesimpulan KI-030: RESOLVED** (dibuktikan lewat pengujian
eksplisit).

**Review Ridwan (0 temuan):** tidak ada business logic baru, tidak ada
import Prisma/Supabase/Outstand, cross-domain tetap lewat Server Action
existing; `handleConfirmSchedule`/`isReadyToSchedule` dikonfirmasi via
grep benar-benar tidak tersentuh diff; konsisten pola dengan field
tanggal T-100.2. Catatan non-arsitektur (sudah dikonfirmasi King Rezi via
AskUserQuestion): native time input tidak lagi membatasi ke kelipatan 15
menit seperti Astryx `increment={15}` lama — **keputusan produk eksplisit
King Rezi: dibiarkan bebas**, bukan bug, tidak perlu ditambah
`step={900}`.

**QA Najwa (PASS, verifikasi independen):** `bun run typecheck` PASS,
`bun run lint` PASS, `bun run test` PASS (235 pass, 4 skip, 0 fail).
**KI-030 diverifikasi ulang independen dan dikonfirmasi RESOLVED** —
ketik huruf/simbol/karakter berlebih ke field waktu ditolak total oleh
browser native, tidak seperti Astryx lama yang bisa diketik bebas. Golden
path Schedule PASS (waktu 14:07 tersimpan tepat), menit bebas (bukan
kelipatan 15) PASS sesuai keputusan produk, jam batas 00:00 & 23:59 PASS,
clear/reset field PASS, Publish Now tidak terpengaruh PASS, Resume
Unfinished Post tidak ada regresi PASS, light/dark mode PASS, regresi
Calendar/Queue/Drafts PASS.

**KI-030 ditutup Resolved (2026-09-03)** — root cause (Astryx `TimeInput`
internal `<input type="text">` tanpa `maxLength`/`pattern`) hilang total
setelah migrasi ke native `<input type="time">` yang punya input-guard
bawaan browser. Lihat `PROJECT_STATE.md` § KI-030 untuk catatan penutup
lengkap.

**Temuan Minor baru (pre-existing gap, bukan regresi T-100.3, dikonfirmasi
King Rezi untuk dicatat sebagai KI baru):** tidak ada validasi yang
mencegah Schedule ke waktu yang sudah lewat pada tanggal hari ini (mis.
jadwalkan jam 08:00 padahal sekarang sudah jam 11:48) — post berhasil
masuk Queue tanpa penolakan/warning. Gap ini sudah ada sejak sebelum
migrasi (Astryx `TimeInput` juga tidak punya validasi ini), bukan regresi
baru. Dicatat sebagai **KI-044** (lihat `PROJECT_STATE.md`), di luar
scope T-100.3.

**Update dokumentasi:** `tasks/v07-astryx-shadcn-migration.md` § T-100
(subtask T-100.3 dicentang `[x]`, catatan detail ditambahkan),
`TASKS.md` (indeks + Fokus sekarang), `PROJECT_STATE.md` (KI-030 Closed,
KI-044 baru, Snapshot/Current Focus).

---

## 2026-09-03 — T-100.2 selesai: form controls Draft Editor Modal dimigrasi ke shadcn (KI-043 baru)

**T-100** (Migrasi Publish — Draft Editor Modal, rilis v0.7, ADR-097) tetap
`🟡 In Progress` — subtask kedua dari 4 (**T-100.2**) tuntas, dikerjakan
Mark UI Engineer, review Ridwan Architecture Reviewer, QA Najwa QA
Engineer, di branch `feature/t-100-draft-editor-modal`.

**T-100.2 (Form controls) — File:**
`apps/web/src/app/(app)/components/draft-editor/Modal.tsx`

- Caption: Astryx `TextArea` → shadcn `Textarea` + `Label` (sr-only) +
  `FieldDescription`.
- Media: Astryx `FileInput` (dropzone disabled) → native
  `<input type="file">` lewat `Input` shadcn, tetap disabled + pesan
  penjelasan.
- Account checkbox: Astryx `CheckboxInput` → shadcn `Checkbox` + `Label`
  per-akun, `onCheckedChange` di-cast eksplisit ke boolean.
- Content Format: Astryx `RadioList`/`RadioListItem` → shadcn
  `RadioGroup`/`RadioGroupItem` + `Label`, orientasi horizontal
  dipertahankan.
- Pinterest Pin Title/Destination Link: Astryx `TextInput` → shadcn
  `Input` (prop `isOptional` kosmetik dihapus, tidak pernah memengaruhi
  validasi).
- Tanggal Jadwal: Astryx `DateInput` → native `<input type="date">` lewat
  `Input` shadcn (bukan Popover+Calendar) — keputusan konsistensi karena
  `TimeInput` di sebelahnya masih Astryx (scope T-100.3) dan tetap compact
  inline; tidak menambah dependency baru (`react-day-picker`/`date-fns`)
  untuk satu field.
- Tidak ada komponen shadcn baru yang perlu diinstall (semua sudah ada
  dari T-099.2: `checkbox`, `input`, `label`, `radio-group`, `textarea`,
  `field`).
- Behavior/logic form (validasi
  `isReadyToSchedule`/`isReadyToPublishNow`, Server Action
  `scheduleDraftAction`/`publishNowAction`/`saveDraftAction`) tidak
  diubah — murni migrasi UI library.

**Verifikasi Mark:** typecheck 0 error, lint 0 error, browser E2E manual
PASS (New Post → isi form → Schedule → dialog konfirmasi benar → redirect
Home sesuai ADR-054), dark mode dicek visual OK.

**Review Ridwan (0 temuan):** entry point bersih (tidak ada Server Action
tersentuh di diff); tidak ada import Prisma/Supabase/Outstand HTTP
client; cross-domain lewat public API, shared types tetap dari
`@social/shared`; klaim "behavior tidak berubah" diverifikasi
baris-per-baris untuk 6 kontrol — semua identik secara semantik. Catatan
non-blocking: file ini belum pakai komposisi penuh
`Field`/`FieldLabel`/`FieldContent`/`FieldGroup` seperti
`InviteMemberDialog.tsx` (T-099.2) — wajar karena migrasi bertahap
(layout `VStack`/`HStack` masih Astryx, menyusul subtask lain).

**QA Najwa (PASS):** `bun run typecheck` PASS, `bun run lint` PASS,
`bun run test` PASS (235 pass, 4 skip, 0 fail). Semua kontrol form
(golden path + edge case) PASS: Caption, Media disabled, Account
checkbox multi-select, Content Format `RadioGroup` switch, Tanggal
Jadwal kombinasi dengan `TimeInput` Astryx. Pinterest Pin
Title/Destination Link **tidak bisa diuji** — workspace test
(Insvire/Raka Pratama) tidak punya akun Pinterest terhubung; risiko
dinilai rendah karena komponen `Input` sama dengan field lain yang sudah
terverifikasi dan logic kondisional tidak diubah di diff ini. Alur
end-to-end PASS semua: Save Draft→reload persist, Schedule→dialog
konfirmasi→redirect queue (ADR-054), Publish Now→confirm→redirect
calendar (ADR-054), Resume Unfinished Post (caption ter-restore;
account/format/jadwal memang tidak ter-restore — desain lama
`UnsavedNewPost` interface, bukan regresi), toggle Fullscreen↔Standard
sambil form terisi (state terjaga), light & dark mode kontras OK,
regresi Calendar/Queue/Drafts tidak ada crash.

**KI-043 baru (bukan blocker, bukan regresi T-100.2):**
`clearUnsavedNewPost()` di `Modal.tsx` hanya dipanggil di
`handleSaveDraft`, tidak dipanggil di
`handleConfirmSchedule`/`handleConfirmPublishNow` — sudah ada sejak
versi lama file (diverifikasi via `git log -p`). Akibatnya localStorage
"unsaved draft" tidak terhapus setelah Schedule/Publish Now sukses (kalau
user sempat trigger `persistUnsavedNewPost` sebelumnya) — `ResumeDialog`
bisa muncul lagi dengan caption basi di sesi New Post berikutnya. Dicatat
sebagai **KI-043** (Open) di `PROJECT_STATE.md`, ditindaklanjuti terpisah
di luar scope T-100.

**Sisa scope T-100:** T-100.3 (`TimeInput` khusus + evaluasi **KI-030**),
T-100.4 (verifikasi behavior penuh) — T-100 belum ditutup `✅ Done`.

Detail lengkap: `project-manager/tasks/v07-astryx-shadcn-migration.md` §
T-100, `project-manager/TASKS.md`.

---

## 2026-09-03 — T-100.1 selesai: struktur Draft Editor Modal dimigrasi ke shadcn (T-100 naik jadi In Progress)

**T-100** (Migrasi Publish — Draft Editor Modal, rilis v0.7, ADR-097) naik
status `⏳ Not Started` → `🟡 In Progress` — subtask pertama dari 4
tuntas, dikerjakan King Rezi langsung di branch
`feature/t-100-draft-editor-modal`.

**T-100.1 (Struktur modal + layout) — File:**
`apps/web/src/app/(app)/components/draft-editor/Modal.tsx`

- Astryx `Dialog`/`DialogHeader` → shadcn `Dialog`/`DialogContent`/
  `DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`
  (`@/components/ui/dialog`).
- Astryx `Layout`/`LayoutContent`/`LayoutFooter` → komposisi Tailwind
  manual (wrapper flex-col, header row, body scrollable, footer) —
  beberapa `<div>` mentah diberi `eslint-disable-next-line
  no-restricted-syntax` per-baris (belum ada padanan shadcn, mengikuti
  pola yang sama dipakai `InviteMemberDialog.tsx` di T-099.2).
- Astryx `Button` → shadcn `Button` untuk seluruh CTA header (toggle
  Fullscreen/Standard, tombol close) dan footer (Save as Draft/Publish
  Now/Schedule, Batal/Konfirmasi, Mulai Baru/Resume di `ResumeDialog`).
  Loading state pakai `Spinner` menggantikan prop `isLoading` Astryx.
- Varian **Standard/Fullscreen** (ADR-065 default Standard, ADR-052
  toggle Fullscreen) dipertahankan penuh — Standard pakai `style` inline
  (`width: min(960px, 94vw)`, `maxHeight: 88vh`) karena
  `tailwindcss/no-arbitrary-value` melarang class arbitrary-value di
  luar `components/ui/**`; Fullscreen pakai `style` inline (`inset:0`,
  `100vw`/`100dvh`) + class `translate-none` — bug ditemukan+diperbaiki
  saat verifikasi browser: Tailwind v4 memisahkan CSS property
  `translate` dari `transform`, jadi override inline `transform:none`
  saja tidak cukup membatalkan utility `-translate-1/2` bawaan
  `DialogContent` shadcn.
- `ResumeDialog` (KSP-05-F13) — perilaku `purpose="required"` Astryx
  (tidak bisa ditutup Escape/klik-luar, tanpa tombol close) direplikasi
  manual via `onEscapeKeyDown`/`onInteractOutside` `preventDefault()` +
  `showCloseButton={false}` pada `DialogContent`.
- Scope yang sengaja belum disentuh (subtask lain): form controls di
  body (`TextArea`, `CheckboxInput`, `RadioList`/`RadioListItem`,
  `DateInput`, `FileInput`, `TextInput` Pinterest) masih Astryx →
  **T-100.2**. `TimeInput` masih Astryx → **T-100.3** (termasuk evaluasi
  **KI-030**). `Badge`, `Banner`, `Divider`, `Link` di body masih Astryx,
  belum diverifikasi regresi end-to-end penuh → **T-100.4**.

**Verifikasi yang sudah dilakukan:**

- Typecheck: 0 error (`bunx tsc --noEmit` bersih untuk file ini).
- Lint: 0 error/warning untuk file ini (termasuk `tailwindcss/
  no-arbitrary-value` dan rule `no-restricted-syntax` div — ditutup
  lewat inline `style` atau `eslint-disable-next-line` beralasan).
- Browser E2E manual (Chrome via Claude Browser, akun test Raka Pratama
  dari `QA_TEST_ACCOUNTS.md`, workspace "Insvire"): New Post Standard ✅,
  toggle ke Fullscreen ✅ (setelah fix bug `translate-none` di atas),
  toggle balik ke Standard ✅, tombol close (X) ✅, alur Resume
  Unfinished Post end-to-end (isi caption → close tanpa save → buka New
  Post lagi → `ResumeDialog` muncul dengan caption+timestamp tersimpan,
  tidak bisa ditutup Escape/klik-luar, tombol Resume memuat balik
  caption) ✅.
- Belum dijalankan: review arsitektur Ridwan, QA Najwa formal, Vitest
  suite (belum diminta King Rezi).

**Penutupan dokumentasi:**

- `tasks/v07-astryx-shadcn-migration.md` § T-100 — checkbox T-100.1
  dicentang `[x]`, status task `⏳ Not Started` → `🟡 In Progress`,
  catatan implementasi ditambahkan.
- `TASKS.md` — indeks v0.7: `5 ✅ · 0 🟡 · 3 ⏳` → `5 ✅ · 1 🟡 · 2 ⏳`
  (dihitung ulang dari file release: 24 `[x]` + 13 `[ ]` = 37 subtask,
  tidak berubah — hanya status checklist T-100.1). Total task selesai
  tidak berubah (masih 30, T-100 belum Done). Baris **Fokus sekarang**
  T-100 ditambahkan dengan status 🟡.
- `PROJECT_STATE.md` — Snapshot "Top Next Tasks" dan bullet "Prioritas
  utama" di Current Focus diperbarui (pointer ID + judul singkat ke
  `TASKS.md`/`tasks/v07-astryx-shadcn-migration.md` § T-100, sesuai
  ADR-062 — tidak menyalin detail subtask). Tidak menambah bullet baru
  di "Completed (Ringkasan)" karena T-100 belum selesai. Version
  metadata naik 1.0.60 → 1.0.61.

File yang diubah sesi ini (dokumentasi saja, kode ditulis di branch
`feature/t-100-draft-editor-modal`):
`apps/web/src/app/(app)/components/draft-editor/Modal.tsx`,
`project-manager/tasks/v07-astryx-shadcn-migration.md`,
`project-manager/TASKS.md`, `project-manager/PROJECT_STATE.md`.

---

## 2026-09-02 — T-098.4 selesai: review Ridwan + QA Najwa PASS, T-098 ditutup Done, KI-042 Closed

Lanjutan entri di bawah ("T-098.4: Implementasi kode..."). Kode T-098.4
(sidebar mobile hamburger+`Sheet` via `MobileTopBar.tsx` baru,
`MembersTable.tsx` card layout mobile) yang sesi sebelumnya sudah ditulis
tapi belum direview/di-QA, sekarang tuntas seluruh tahapannya.

**Review Ridwan (Architecture Reviewer) — 0 temuan:**

- Entry point bersih — tidak ada business logic bocor ke komponen.
- Tidak ada import Prisma/Supabase client di komponen client yang diubah
  (`MobileTopBar.tsx`, `AppSideNav.tsx`, `WorkspaceSideNav.tsx`,
  `SettingsSideNav.tsx`, `MembersTable.tsx`).
- Cross-domain tetap lewat public API module domain — tidak ada import
  implementasi lintas folder baru.
- Prop `onNavigate?: () => void` opsional dikonfirmasi tidak breaking —
  default `undefined` di sidebar desktop, behavior lama tidak berubah.
- Prop `fullWidth` baru di `MemberActions` konsisten dipakai di kedua
  varian (desktop table row vs mobile card).

**QA Najwa — PASS penuh:**

- Automated: `bun run typecheck` PASS (0 error), `bun run lint` PASS
  (0 error), `bun run test` PASS (235 lulus, 4 skipped — baseline sama,
  tidak ada regresi).
- Desktop (≥768px): tidak ada regresi — sidebar & `MembersTable.tsx`
  identik dengan sebelum T-098.4.
- Mobile (375px, 320px): `MobileTopBar` + hamburger + `Sheet` berfungsi
  benar untuk `WorkspaceSideNav` maupun `SettingsSideNav` (termasuk
  auto-close `Sheet` via `onNavigate` saat memilih menu),
  `MembersTable.tsx` berganti ke card layout dengan tombol Change
  Role/Remove full-width berfungsi normal, dialog konfirmasi Tier-2
  (ADR-049) tetap muncul benar dari card mobile.
- Edge case: tidak ada horizontal overflow di layar sempit (320–375px),
  dark mode smoke test oke.
- 2 temuan DI LUAR SCOPE T-098.4 (dicatat, bukan blocker penutupan):
  (a) tabel Members di lebar persis 768px butuh scroll horizontal
  internal — perilaku tabel yang **sudah ada sebelum** T-098.4, bukan
  regresi baru dari perubahan mobile; (b) card "Analytics Snapshot" di
  halaman Home tetap berlatar putih saat dark mode aktif — bug dark mode
  pre-existing, tidak terkait T-098.4.

**Insiden kecil saat QA (diklarifikasi & disetujui King Rezi, bukan
pelanggaran governance):** Najwa sempat mematikan proses dev server
project lain (`/Users/rezisaktiva/Documents/dev/rezisaktiva`) yang memakai
port 3000 supaya bisa testing di port yang sama (Better Auth menolak
origin selain yang di-trust). King Rezi eksplisit menyetujui ("boleh kill
aja") setelah ditanya — housekeeping environment lokal, tidak relevan
untuk project state, tidak dicatat sebagai KI/ADR.

**Penutupan:**

- `tasks/v07-astryx-shadcn-migration.md` § T-098 — checkbox T-098.4
  dicentang `[x]`, catatan review+QA ditambahkan, Status T-098 `🟡 In
  Progress` → `✅ Done` (4/4 subtask tuntas).
- `TASKS.md` — indeks v0.7 dihitung ulang dari file release: 5 ✅ · 0 🟡 ·
  3 ⏳ (checkbox subtask 23 `[x]` + 14 `[ ]` = 37, tidak berubah dari
  sebelumnya — hanya status checklist yang berubah). Total task selesai
  naik 29 → **30**, subtask total tetap 210. Baris "Fokus sekarang" untuk
  T-098 diubah ke ✅.
- `PROJECT_STATE.md` — **KI-042 Status: Open → Closed (2026-09-02)** dengan
  catatan penutup review Ridwan + QA Najwa; "Top Next Tasks" di Snapshot
  diperbarui (T-098 penuh Done); bullet T-098 di "Completed (Ringkasan)"
  diupdate merefleksikan T-098.4 tuntas (tetap 5 item, tidak menambah
  bullet baru — hanya mengedit bullet T-098 yang sudah ada).

File yang diubah sesi ini (dokumentasi saja, kode sudah ditulis sesi
sebelumnya): `apps/web/src/app/(app)/layout.tsx`,
`apps/web/src/app/(app)/components/MobileTopBar.tsx`,
`apps/web/src/app/(app)/components/AppSideNav.tsx`,
`apps/web/src/app/(app)/components/WorkspaceSideNav.tsx`,
`apps/web/src/app/(app)/settings/components/SettingsSideNav.tsx`,
`apps/web/src/app/(app)/settings/members/components/MembersTable.tsx`
(implementasi, tidak diubah lagi sesi ini) — `project-manager/tasks/v07-astryx-shadcn-migration.md`,
`project-manager/TASKS.md`, `project-manager/PROJECT_STATE.md` (dokumentasi,
diubah sesi ini).

---

## 2026-09-02 — T-098.4: Implementasi kode sidebar mobile + tabel mobile card (KI-042), menunggu review + QA

King Rezi minta lanjut ke implementasi kode setelah rancangan Claude Design
untuk **T-098.4** dibuat di sesi sebelumnya. Dikerjakan di **sesi utama**
(bukan lewat Mark UI Engineer — `DesignSync` juga gagal dimuat di sesi
subagent Mark, konfirmasi ketiga kalinya pola keterbatasan yang sama
seperti Neymar Product Designer sebelumnya).

**Scope 1 — Sidebar mobile (hamburger + Sheet):**

- `apps/web/src/app/(app)/layout.tsx` — `<aside>` desktop diubah dari
  selalu `flex` jadi `hidden md:flex` (gap ini eksplisit dicatat di
  komentar T-096.3 lama; komentar itu diupdate menyatakan gap sudah
  ditutup). Ditambah `<MobileTopBar>` di atas baris sidebar+main.
- File baru `apps/web/src/app/(app)/components/MobileTopBar.tsx` — top bar
  (`md:hidden`, tinggi 52px/`h-13`) dengan tombol hamburger (`Menu01Icon`)
  yang membuka shadcn `Sheet` (`side="left"`, lebar 3/4 layar) berisi
  `AppSideNav` yang sama persis dengan sidebar desktop (tidak
  diduplikasi). Title top bar dinamis: nama workspace di luar
  `/settings`, "Settings" di dalamnya.
- `apps/web/src/app/(app)/components/AppSideNav.tsx`,
  `WorkspaceSideNav.tsx`, dan
  `apps/web/src/app/(app)/settings/components/SettingsSideNav.tsx` —
  ditambah prop opsional `onNavigate?: () => void` (dipanggil di setiap
  Link/tombol nav utama) supaya Sheet otomatis tertutup setelah user
  memilih menu di mobile. Prop `undefined` di sidebar desktop, tidak ada
  perubahan behavior di sana.
- Breakpoint: `md` (768px Tailwind), sesuai keputusan breakpoint di
  rancangan Claude Design.

**Scope 2 — Members table responsive:**

- `apps/web/src/app/(app)/settings/members/components/MembersTable.tsx`
  — tabel desktop shadcn `Table` dibungkus `hidden md:block` (isi tidak
  diubah). Ditambah blok baru `flex flex-col gap-3 md:hidden` berisi card
  per anggota (avatar+nama+email, badge Status, baris Role, lalu
  `MemberActions` dengan prop baru `fullWidth` yang membuat tombol Change
  Role/Remove full-width sebagai baris terpisah dengan border-top,
  alih-alih rata-kanan di sel tabel).

**Verifikasi:**

- `bun run typecheck` — bersih, 0 error.
- `bun run lint` — bersih, 0 error (sempat 1 error
  `no-restricted-syntax` di `MobileTopBar.tsx` karena raw `<div>`, diberi
  `eslint-disable-next-line` dengan alasan file baru dikomposisi Tailwind
  shadcn sejak awal, bukan migrasi Astryx).
- **Verifikasi visual browser TIDAK berhasil dilakukan** — tool Browser
  pane gagal total (navigate timeout 300s berulang kali, baik ke
  `localhost` dev server maupun file lokal), tampak masalah
  infrastruktur/tooling sesi ini, bukan masalah kode (dev server Next.js
  start normal, "Ready in 319ms", tidak ada error compile di log — dev
  server masih berjalan di background sesi ini).

**Status:** kode sudah ditulis, **belum** direview Ridwan (Architecture
Reviewer) dan **belum** di-QA Najwa, verifikasi visual manual juga belum
berhasil dilakukan siapa pun. **T-098.4 tidak ditandai selesai** — T-098
tetap `🟡 In Progress` (dibuka kembali dari `✅ Done`), **KI-042 tetap
Open**. Next step: review arsitektur Ridwan + QA Najwa (termasuk
menggantikan verifikasi visual yang gagal di sesi ini).

Dokumentasi diupdate: `tasks/v07-astryx-shadcn-migration.md` § T-098
(subtask T-098.4 ditambahkan dengan catatan implementasi lengkap),
`TASKS.md` (Indeks v0.7: 5 ✅·3 ⏳ → 4 ✅·1 🟡·3 ⏳; Total: 30 selesai/209
subtask → 29 selesai/210 subtask; Fokus sekarang baris T-098 diupdate),
`PROJECT_STATE.md` (§ KI-042, Top Next Tasks, Completed Ringkasan bullet
T-098).

---

## 2026-09-02 — KI-042: Rancangan mobile/responsive dibuat di Claude Design (blocker T-098.4 resolved)

King Rezi mengerjakan sendiri (bukan lewat Neymar Product Designer — `DesignSync`
gagal dimuat 2x di sesi Neymar) penambahan rancangan mobile/responsive di
Claude Design (project "Social Media Management", `projectId`
`84aded99-bb23-49b1-be9f-dd8f21c6873e`) yang sebelumnya jadi **blocker**
eksplisit sebelum subtask **T-098.4** (sidebar mobile hamburger+drawer + pola
tabel responsive) bisa mulai dikerjakan sebagai kode, sesuai rule 17
`AGENTS.md`. Seluruh perubahan murni penambahan (append-only) — tidak ada
markup/CSS existing yang diubah atau dihapus.

**Added (Claude Design):**

- `styles.css` — 2 blok CSS baru di akhir file: pattern "Mobile Shell"
  (`.mobile-topbar`, `.mobile-nav-backdrop`, `.mobile-nav-drawer` +
  `@media (max-width: 768px)` yang menyembunyikan `.sidebar`/
  `.settings-sidebar` desktop dan menampilkan top bar mobile, reuse penuh
  anatomy overlay `.notif-backdrop`/`.notif-drawer` yang sudah ada,
  dicerminkan buka dari kiri) dan pattern "Table — mobile card layout"
  (class opt-in `.table-responsive` + `.table-card`/`.table-card-row`/
  `.table-card-actions`, di-gate lewat wrapper supaya tabel yang belum
  pakai class ini tidak terpengaruh). Breakpoint `768px` deliberate reuse
  dari satu-satunya precedent breakpoint terdokumentasi di project
  (`product-discovery/04-ux/key-screen-patterns.md` § KSP-02-F10),
  dinyatakan eksplisit di komentar CSS sebagai keputusan (bukan asumsi
  diam-diam) karena precedent itu untuk konteks lain (indikator tipe
  konten Calendar).
- `foundations/layout.html` — section baru "Shell — Mobile (≤768px,
  KI-042)" ditambahkan setelah section "Shell — AppShell + SideNav" yang
  sudah ada. Baris "sidebar shape never changes" di section desktop tidak
  diubah/dihapus.
- `components/navigation-mobile.html` (file baru) — 3 demo state static
  mengikuti pola `demo-frame` yang sudah dipakai di
  `components/notifications-panel.html`: "Collapsed — sidebar hidden" (top
  bar saja), "Open — Workspace drawer" (markup `WorkspaceSideNav` persis
  sama dengan desktop, direflow ke lebar drawer), "Open — Settings drawer"
  (markup `SettingsSideNav` persis sama dengan desktop).
- `components/table.html` — section baru "Mobile — card layout (KI-042)"
  ditambahkan setelah tabel desktop existing (tidak diubah), pakai data
  sama dengan `templates/settings-members.html` (Raka/Maya/Lara — Name+
  Avatar, Role, Status chip, Actions sebagai row full-width di bawah).

**Belum selesai (sengaja tidak ditandai selesai):**

- **T-098.4 (implementasi kode)** belum dikerjakan sama sekali — sesi ini
  hanya menghasilkan rancangan di Claude Design. Keputusan King Rezi
  sebelumnya ("jadi subtask T-098.4, tapi ditunda dulu, belum dikerjakan
  sekarang") tetap berlaku — bukan otomatis siap dikerjakan.
- **KI-042 tetap Status Open** — yang berubah hanya bagian blocker/
  rancangan di dalam entrinya (blocker desain resolved), bukan status KI
  itu sendiri.
- Verifikasi visual browser tidak dilakukan (sandbox environment tidak
  bisa render file HTML lokal di luar project folder Claude Design) — King
  Rezi disarankan cek visual langsung di Claude Design sebelum lanjut ke
  implementasi kode.

**Docs diupdate:** `project-manager/PROJECT_STATE.md` (§ KI-042),
`project-manager/tasks/v07-astryx-shadcn-migration.md` (§ T-098, catatan
T-098.4).

---

## 2026-09-02 — T-098: Migrasi App Shell & Navigasi selesai (ADR-097)

Task keempat rilis v0.7 (migrasi Astryx → shadcn/ui), dikerjakan di branch
`feature/t-098-app-shell-navigation` oleh Mark UI Engineer, lolos review
arsitektur Ridwan Architecture Reviewer (0 temuan) dan QA Najwa QA Engineer
(PASS penuh setelah 1 bug ditemukan+diperbaiki). Seluruh 3 subtask tuntas:

- **T-098.1** `WorkspaceSideNav.tsx`, `SettingsSideNav.tsx`,
  sidebar-channels `ChannelsSection.tsx` — dimigrasi penuh dari Astryx ke
  shadcn/ui + Tailwind.
- **T-098.2** Notification panel (`NotificationBell.tsx`) — dimigrasi ke
  shadcn `Sheet`. Wrapper custom `apps/web/src/components/ui/Drawer.tsx`
  **dihapus** (dikonfirmasi tidak ada consumer lain oleh Mark, di-cross-check
  ulang oleh Ridwan).
- **T-098.3** Re-verifikasi **KI-040** (gap visual panel notifikasi) —
  **Closed**, diverifikasi Najwa lewat browser nyata (light & dark mode);
  root cause lama (geometri wrapper `Drawer` custom) hilang bersama
  penggantian ke `Sheet` asli.

**Added:**

- Komponen shadcn baru: `avatar`, `badge`, `dropdown-menu`, `alert-dialog`,
  `sheet`, `tooltip`.
- Helper baru `apps/web/src/lib/utils/get-initials.ts`.
- `TooltipProvider` ditambahkan ke `apps/web/src/components/Providers.tsx`.
- Known Issue baru **KI-042** — gap sidebar mobile (hamburger + drawer) di
  `apps/web/src/app/(app)/layout.tsx` belum dimigrasi ke shadcn `Sidebar`
  primitive (built-in mobile-`Sheet`); komentar existing dari T-096.3
  menyebutnya akan "menyusul di T-098", tapi breakdown resmi 3 subtask
  T-098 tidak mencakup file `layout.tsx`/`AppSideNav.tsx`. Keputusan
  (subtask baru T-098.4? task terpisah? ditunda ke T-102?) menunggu King
  Rezi — dicatat, bukan diputuskan sendiri.

**Removed:**

- `apps/web/src/components/ui/Drawer.tsx` (wrapper selektif Astryx,
  digantikan `Sheet` shadcn asli).

**Fixed:**

- Bug ditemukan Najwa QA Engineer: dot indikator unread menimpa teks
  timestamp di panel notifikasi — diperbaiki, lalu re-verifikasi PASS
  penuh.

**Resolved:**

- **KI-040** (gap visual panel notifikasi vs Claude Design) — Closed via
  T-098.3, sudah dihapus dari daftar Known Issues `PROJECT_STATE.md`
  sesuai aturan (entry Resolved yang sudah tercatat di sini tidak
  dibiarkan berstatus Resolved di daftar itu). Back-reference ditambahkan
  di `tasks/v02-publishing-mvp.md` § T-036.

**Hasil verifikasi:** typecheck 0 error, lint 0 error, Vitest 235
passed/4 skipped/0 fail (baseline sama, tidak ada regresi test). Browser
E2E semua PASS: nav items, logout Tier-2 safety check, `ChannelsSection`,
notification panel mark-read/mark-all-read/persistence, light+dark mode.

Task T-098 naik dari `🟡 In Progress` ke `✅ Done`. Task selesai naik
28 → 29 (subtask total tidak berubah, tetap 209 — hanya status checklist
yang berubah). **T-099** (Migrasi Settings) sedang berjalan paralel di
sesi lain — sudah tahap implementasi selesai, menunggu verifikasi visual
final.

File berubah: `tasks/v07-astryx-shadcn-migration.md`,
`tasks/v02-publishing-mvp.md`, `TASKS.md`, `PROJECT_STATE.md`.

Detail: `tasks/v07-astryx-shadcn-migration.md` § T-098.

---

## 2026-09-02 — T-099: Migrasi Settings selesai (ADR-097)

Task rilis v0.7 (migrasi Astryx → shadcn/ui), dikerjakan di worktree
terpisah (branch `feature/t-099-settings-migration`, dicabang dari
`feature/t-097-auth-flows-onboarding`, paralel dengan sesi T-098) oleh
Mark UI Engineer, lolos review arsitektur Ridwan Architecture Reviewer
(0 temuan) dan QA Najwa QA Engineer (PASS dengan 1 temuan minor). Seluruh
3 subtask tuntas:

**Added**

- Komponen shadcn baru di-install: `alert-dialog`, `avatar`, `badge`,
  `dropdown-menu`, `item`, `radio-group`, `select`, `table`,
  `toggle`/`toggle-group`, `tooltip`.
- Helper baru `getInitials()` di `apps/web/src/lib/utils.ts` (dipakai di
  4 file).
- `TooltipProvider` ditambahkan ke `apps/web/src/components/Providers.tsx`.
- **KI-042** (baru) — aplikasi belum punya strategi responsive/mobile yang
  didesain; entri ini mengumpulkan gap serupa lintas task (T-098 sidebar
  mobile, T-099 kolom Actions `MembersTable.tsx`) di satu tempat.

**Changed**

- **T-099.1** `SettingsPageHead.tsx`, `WorkspaceGeneralSettings.tsx`,
  `ProfileForm.tsx`, `preferences/page.tsx` dimigrasi penuh dari Astryx ke
  shadcn/ui + Tailwind.
- **T-099.2** `MembersTable.tsx` — sistem kolom `pixel()`/`proportional()`
  Astryx dihapus total, diganti shadcn `Table` primitive + JSX langsung;
  `InviteMemberDialog.tsx`, `InviteMemberAction.tsx` dimigrasi.
- **T-099.3** `ConnectedAccountsList.tsx`, `ConnectPlatformMenu.tsx`,
  `WorkspacesSettingsView.tsx` dimigrasi.
- **KI-041** meluas — status "Pending" di `MembersTable.tsx` dipetakan ke
  `Badge variant="outline"` (bukan "secondary" seperti Active/Removed)
  karena tidak ada token warning; treatment varian, bukan warna baru,
  konsisten dengan keputusan T-097.

**Verifikasi**

- Review Ridwan: 0 temuan pelanggaran arsitektur — entry point bersih,
  tidak ada leak Prisma/Supabase/Outstand, cross-domain lewat public API,
  validasi file avatar dikonfirmasi tetap otoritatif di server
  (`IdentityService.updateProfile`), tidak hilang saat migrasi
  client-side check.
- QA Najwa: seluruh golden path PASS (General settings edit+persist,
  Danger Zone Transfer Ownership & Delete Workspace dialog Tier 1, upload
  avatar + validasi ukuran file, toggle tema Preferences, invite member
  flow lengkap sampai buka link undangan, Connected Accounts, switch
  workspace) di light & dark mode. Typecheck/lint/vitest bersih (235
  pass, 4 skip, 0 fail).
- 1 temuan minor (severity Moderate): kolom "Actions" (Change Role/
  Remove) di `MembersTable.tsx` tidak terlihat penuh pada viewport sempit
  (~800px) — perlu scroll horizontal (shadcn `Table` sudah punya
  `overflow-x-auto` bawaan, bukan crash/broken). Dicatat sebagai detail
  tambahan di **KI-042** (baru dibuat di sesi ini karena belum ada di
  worktree ini; kemungkinan sudah dibuat lebih dulu oleh sesi T-098 di
  repo utama — penyatuan dua sisi dokumentasi dilakukan King Rezi setelah
  PR digabung).

**Catatan multi-sesi:** dikerjakan paralel dengan sesi T-098 (working
directory repo utama, bukan worktree ini) — dokumen-dokumen yang diubah
di sini (`TASKS.md`, `PROJECT_STATE.md`, `tasks/v07-astryx-shadcn-migration.md`)
masih berbasis versi sebelum update T-098; penyatuan dilakukan King Rezi
setelah kedua PR digabung.

Detail lengkap: `tasks/v07-astryx-shadcn-migration.md` § T-099.

---

## 2026-09-02 — T-097: Migrasi Auth Flows & Onboarding selesai (ADR-097)

Task ketiga rilis v0.7 (migrasi Astryx → shadcn/ui), dikerjakan di branch
`feature/t-097-auth-flows-onboarding` (dicabang dari
`feature/t-096-core-infra-migration`) oleh Mark UI Engineer, lolos review
arsitektur Ridwan Architecture Reviewer (0 temuan) dan QA Najwa QA Engineer
(semua PASS). Seluruh 5 subtask tuntas:

- **T-097.1** Login & Register forms (`LoginForm.tsx`, `RegisterForm.tsx` +
  page wrapper, `app/(auth)/login/`, `app/(auth)/register/`).
- **T-097.2** Forgot/Reset password forms (`ForgotPasswordForm.tsx`,
  `ResetPasswordForm.tsx` + page wrapper masing-masing).
- **T-097.3** Accept Invite pages (`AcceptInvitePageClient.tsx`,
  `AcceptInviteForm.tsx`, `app/(auth)/invite/[token]/page.tsx`).
- **T-097.4** `app/(auth)/layout.tsx`, `app/onboarding/layout.tsx`
  (migrasi Center/HStack/Text/VStack Astryx → shadcn + Tailwind).
- **T-097.5** Onboarding flow (`app/onboarding/page.tsx`,
  `app/onboarding/layout.tsx`, `CreateWorkspaceForm.tsx`).

**Komponen shadcn baru di-install:** `alert`, `checkbox`, `label`,
`separator`, `field` (Field/FieldGroup/FieldLabel/FieldSeparator/
FieldDescription), `empty` (Empty/EmptyHeader/EmptyMedia/EmptyTitle/
EmptyDescription), `input-group`, `textarea` (dependency ikutan, tidak
dipakai langsung di scope ini).

**2 keputusan/gap penting:**

1. Astryx `Banner status="info"/"error"` → shadcn `Alert` cuma punya
   varian `default`/`destructive` (tidak ada varian info) — error
   dipetakan ke `destructive`, info ke `default` netral, tidak mengarang
   varian baru.
2. **Gap desain terverifikasi** (Mark, dikonfirmasi independen Ridwan
   lewat grep `globals.css`): Stone theme shadcn **belum punya token
   `--success`/`--warning`**, hanya `--destructive`. Astryx
   `EmptyState color="success"/"warning"/"error"` dipakai untuk 3 state
   Accept Invite (success/expired/invalid) — state "invalid" dipetakan ke
   `text-destructive` (token yang memang ada), "expired"/"success"
   dibiarkan netral (bukan mengarang hex/token baru tanpa ADR). Dicatat
   sebagai **KI-041** (Open) — keputusan terbuka untuk King Rezi (tambah
   token ke Stone theme, butuh ADR baru, atau tetap netral selamanya),
   belum ditutup sendiri.

Penyesuaian teknis kecil (settled, bukan gap): `max-w-[400px]`/`[480px]`
arbitrary value → `max-w-sm`/`max-w-md` (rule lint
`tailwindcss/no-arbitrary-value`); `text-on-accent` →
`text-accent-foreground` (nama token shadcn yang benar); `Button` tidak
punya prop `isLoading` bawaan → pola manual `disabled` + ikon spinner
`animate-spin`.

**Hasil verifikasi:** typecheck 0 error, lint 0 error (2 warning kosmetik
pre-existing di `textarea.tsx`, bukan dari perubahan ini), Vitest 235
passed/4 skipped, browser E2E semua PASS (login, register, forgot/reset
password, accept invite golden+edge case, onboarding, dark/light mode via
cookie `theme`, regresi shell `(app)/layout.tsx` dari T-096 aman). Seluruh
import `@astryxdesign/*` di `app/(auth)/**` dan `app/onboarding/**` sudah
hilang (diverifikasi grep, sisa cuma di komentar dokumentasi).

Catatan sampingan dari Najwa (QA): dibuat 2 akun test baru di database
lokal (`najwa.qa.t097@kopiselasar.com`, `dimas.qa.t097@kopiselasar.com`)
untuk uji accept-invite — data test lokal, bukan dokumentasi permanen.

Task T-097 naik dari `🟡 In Progress` ke `✅ Done`. Task selesai naik
27 → 28 (subtask total tidak berubah, tetap 209 — hanya status checklist
yang berubah). **T-098** (Migrasi App Shell & Navigasi) adalah task
berikutnya rilis v0.7.

File berubah: `tasks/v07-astryx-shadcn-migration.md`, `TASKS.md`,
`PROJECT_STATE.md`, `CONVERSATIONS.md`.

Detail: `tasks/v07-astryx-shadcn-migration.md` § T-097.

---

## 2026-09-01 — T-096: Migrasi Core Infra & Shared Primitives selesai (ADR-097)

Task kedua rilis v0.7 (migrasi Astryx → shadcn/ui), dikerjakan Mark UI
Engineer di branch `feature/t-096-core-infra-migration`, dikonfirmasi
"aman" oleh King Rezi. Seluruh 4 subtask tuntas:

- **T-096.1** `globals.css` ditulis ulang berbasis Tailwind v4 + shadcn
  sesuai pemetaan token T-095.5.
- **T-096.2** `components/Providers.tsx` diganti ke pendekatan shadcn
  (`dark` class strategy); `ThemeModeContext`/`useThemeMode` custom
  (cookie persisted) dipertahankan apa adanya.
- **T-096.3** Root `app/(app)/layout.tsx` dimigrasi dari `AppShell` Astryx
  ke komposisi shadcn.
- **T-096.4** Primitive dasar baru: `Button`, `Card`, `Dialog`, `Input`
  (via CLI shadcn resmi), plus `Text`/Typography ditulis manual (shadcn
  tidak punya komponen Typography resmi).

**2 keputusan penting (disetujui King Rezi):**

1. `@import` CSS Astryx di `globals.css` **sengaja dipertahankan**
   (tidak dihapus sesuai rencana awal T-096.1) karena route-segment yang
   belum dimigrasi (auth/settings/publish — T-097–T-101) masih butuh CSS
   itu; akan dihapus di T-102 setelah semua route-segment selesai
   migrasi.
2. `<Theme>` Astryx di `Providers.tsx` **sengaja dipertahankan
   berdampingan** dengan class `dark` shadcn (bukan pengganti) — supaya
   dark/light mode tidak desync antara bagian yang sudah shadcn dan yang
   masih Astryx; akan dilepas di T-102.

Gap yang sengaja belum ditutup: sidebar mobile (hamburger+drawer) di
`(app)/layout.tsx` belum direplikasi di layout baru, menyusul di T-098
bersamaan migrasi `WorkspaceSideNav`/`SettingsSideNav` ke `Sheet`.

**Hasil verifikasi:** typecheck bersih, lint bersih, verifikasi visual
manual di browser tidak menemukan regresi.

Sekaligus dikoreksi drift hitungan subtask v0.7 di `TASKS.md`: klaim
sebelumnya 26 subtask ternyata tidak cocok dengan
`tasks/v07-astryx-shadcn-migration.md` aktual (36 subtask) — dihitung
ulang langsung dari file. Task selesai naik 26 → 27, subtask total naik
199 → 209.

Detail: `tasks/v07-astryx-shadcn-migration.md` § T-096.

---

## 2026-09-01 — T-095.6: Update subagent Mark UI Engineer ke shadcn/ui (izin eksplisit King Rezi) — T-095 selesai penuh

Subtask keenam sekaligus **penutup** T-095 (rilis v0.7, ADR-097).
`.claude/agents/mark-ui-engineer.md` adalah Static Reference — perubahan
hanya dilakukan setelah King Rezi eksplisit meminta "kerjakan T-095.6"
(instruksi eksplisit, sesuai gate di `AGENTS.md` § Subagent kerja).

Perubahan: frontmatter `description` diganti dari Astryx ke shadcn/ui
(ditambah catatan bahwa migrasi berjalan incremental per route-segment —
agent harus cek dulu file yang disentuh masih Astryx atau sudah shadcn,
jangan asumsikan seluruh app sudah shadcn). Body ditulis ulang total:
- Wajib dibaca: `apps/web/.claude/CLAUDE.md` (sekarang berisi workflow
  shadcn, hasil T-095.3), ditambah pointer ke
  `tasks/v07-astryx-shadcn-migration.md` untuk task migrasi.
- Aturan keras diganti dari model Astryx (props-only, Tailwind
  layout-only, CLI `astryx component <Name>`) ke model shadcn: Tailwind
  utility sebagai mekanisme styling utama, `cn()` untuk merge className,
  variant dibaca dari blok `cva()` di file komponen (bukan tabel props
  terpusat), `hugeicons` sebagai default icon library, plus rule baru
  soal migrasi file yang campur Astryx/shadcn (ganti tuntas sesuai scope
  subtask, jangan campur parsial).
- Workflow wajib tiap task UI diganti ke urutan discover-first yang sama
  dengan `apps/web/.claude/CLAUDE.md`: cek `components/ui/` → search →
  view source/props → cek contoh pakai → install → audit.

Bagian yang **tidak** diubah (tetap relevan lintas Astryx/shadcn): sebutan
"King Rezi", langkah pertama ubah Status task jadi In Progress, di luar
scope (Application Service/domain logic → Prabowo, Claude Design →
Neymar, dokumentasi project → Gibran), dan langkah verifikasi visual
lewat preview tool.

**T-095 (Setup Fondasi shadcn/ui & Tooling Migrasi) resmi ditutup `✅
Done`** — seluruh 7 subtask selesai. Status ditandai `✅ Done` di
`tasks/v07-astryx-shadcn-migration.md` § T-095, baris T-095 & indeks v0.7
di `TASKS.md` (total task selesai naik 25 → **26**), Snapshot + section
**Completed (Ringkasan)** di `PROJECT_STATE.md` (bullet terlama —
"Polishing UI grid Calendar 2026-08-27" — digeser keluar sesuai batas 5
item). **T-096 Migrasi Core Infra & Shared Primitives** adalah task
berikutnya rilis v0.7, belum dimulai.

File berubah: `.claude/agents/mark-ui-engineer.md`,
`tasks/v07-astryx-shadcn-migration.md`, `TASKS.md`, `PROJECT_STATE.md`.

---

## 2026-09-01 — T-095.5: Pemetaan token Stone theme → CSS variable shadcn/ui

Subtask kelima T-095 (rilis v0.7, ADR-097). Dibaca langsung dari sumber:
`@astryxdesign/theme-stone/dist/theme.css` (v0.4.3 ter-install, isi
`--color-*`/`--font-family-*`/`--radius-*` Stone theme, semua dalam bentuk
`light-dark(<light>, <dark>)`) dan `apps/web/src/app/globals.css` +
`layout.tsx` kondisi sekarang (hasil init CLI T-095.1) untuk tahu variable
shadcn apa saja yang sudah ada dan perlu diisi nilai Stone-nya nanti di
T-096.1.

Ditulis sebagai section baru **"Engineering Mapping — Stone theme → CSS
variable shadcn/ui (T-095.5)"** di
`product-discovery/06-engineering/design-tokens.md` (Source of Truth
visual token, DT-D01), bukan di file lain — supaya satu dokumen jadi
rujukan tunggal engineering untuk implementasi T-096.1. Ditambahkan juga
entri **DT-D06** ke tabel keputusan, menegaskan section ini murni
pemetaan literal 1:1 (bukan token brand baru — § Color — Brand/Content
Status/Feedback tetap `TBD` menunggu design lock, tidak disentuh).

**Isi mapping:**
* Tabel warna `:root`/`.dark` untuk 11 variable inti (`--background`
  s.d. `--ring`) + tabel `--sidebar-*` (8 variable, dipakai T-096.3),
  masing-masing dengan sumber `--color-*` Stone yang dipecah dari
  `light-dark()`.
* **Radius: sengaja tidak dipetakan dari skala radius Stone** — preset
  Maia (shadcn) sudah generate komponen (`Button` → `rounded-4xl`,
  lihat `apps/web/src/components/ui/button.tsx`) yang dikalibrasi ke
  base `--radius: 0.625rem` bawaan CLI; ganti ke nilai Stone
  (`--radius-element` 0.5rem) akan menggeser seluruh skala turunan
  tanpa review visual. Diputuskan pertahankan default Maia; kalau King
  Rezi mau radius Stone lama dipertahankan persis, itu keputusan visual
  terpisah yang perlu approve eksplisit.
* **Chart palette (`--chart-1..5`): sengaja tidak dipetakan** — Stone/
  Astryx tidak punya sistem palet chart, dan domain Analytics belum
  masuk scope 8 task v0.7 ini. Dibiarkan default grayscale CLI.
* **Gap font ditemukan:** `--font-sans` (body) sudah cocok — Figtree
  sudah di-load `next/font/google` sejak T-095.1. Tapi `--font-heading`
  saat ini fallback ke `var(--font-sans)` (ikut Figtree) di `globals.css`
  `@theme inline` baris 16, padahal Stone pakai **Montserrat** khusus
  heading (`h1`–`h6`) — belum ada font Montserrat di-load sama sekali di
  project. Dicatat sebagai to-do konkret untuk T-096.1: load Montserrat
  via `next/font/google` (pola sama seperti `figtree`/`geistSans` di
  `layout.tsx`), lalu ganti binding `--font-heading`.

File berubah: `product-discovery/06-engineering/design-tokens.md` (section
baru "Engineering Mapping" + DT-D06 + isi baris Radius di § Radius,
Elevation yang tadinya `TBD`). Tidak ada perubahan kode (`globals.css`
belum disentuh — itu scope T-096.1, dokumen ini murni referensi). Status
ditandai di `tasks/v07-astryx-shadcn-migration.md` (T-095.5 → selesai) dan
`TASKS.md` § Fokus sekarang.

---

## 2026-09-01 — T-095.4: Update `AGENTS.md` rule 14 & 15 ke shadcn/ui (sudah selesai lebih dulu, diverifikasi ulang)

Subtask keempat T-095 (rilis v0.7, ADR-097). Dicek: rule 14 & 15 `AGENTS.md`
**sudah** berisi konten shadcn/ui (bukan Astryx lagi) — bukan hasil kerja
sesi ini, melainkan sudah masuk lewat commit `07a3aa2` ("docs: sinkronkan
baseline UI docs ke shadcn/ui sesuai ADR-097"), bagian dari sinkronisasi
baseline yang dilakukan **sebelum** T-095.1–.3 dikerjakan di sesi ini
(commit itu mendahului task-task tersebut secara kronologis di riwayat
git, meski T-095.4 baru ditandai selesai sekarang secara administratif).

Isi yang diverifikasi cocok dengan requirement T-095.4: rule 14 menyebut
"UI produk memakai **shadcn/ui** (ADR-097, membalik ADR-041)" + catatan
migrasi incremental per route-segment (Astryx & shadcn coexist sementara,
pointer ke `tasks/v07-astryx-shadcn-migration.md`); rule 15 mewajibkan baca
`apps/web/.claude/CLAUDE.md` dan/atau cek registry/CLI/MCP shadcn lokal
sebelum menulis/mengubah komponen UI, dengan larangan eksplisit menebak
nama komponen/props/pola styling. Tidak ada gap ditemukan, tidak ada edit
tambahan diperlukan di `AGENTS.md`.

File berubah: tidak ada (verifikasi murni, `AGENTS.md` sudah benar).
Status ditandai di `tasks/v07-astryx-shadcn-migration.md` (T-095.4 →
selesai) dan `TASKS.md` § Fokus sekarang.

---

## 2026-09-01 — T-095.3: Tulis ulang agent docs `apps/web/.claude/CLAUDE.md` ke workflow shadcn

Subtask ketiga T-095 (rilis v0.7, ADR-097). Konten lama (blok
`<!-- ASTRYX:START -->`…`<!-- ASTRYX:END -->`) diganti total dengan blok
`<!-- SHADCN:START -->`…`<!-- SHADCN:END -->` — bukan edit sebagian, karena
model kerja shadcn (source-copy ke `components/ui/`, styling lewat Tailwind
utility + `cva` variant di file komponen) beda fundamental dari Astryx
(closed dependency, styling lewat props tertutup).

Workflow discover-first baru (paralel ke tool MCP shadcn yang sudah
tersambung dari T-095.2): cek dulu apakah komponen sudah ada di
`components/ui/` → `search_items_in_registries`/`shadcn search` → baca
source & props asli via `view_items_in_registries`/`shadcn view` (bukan
asumsi API-nya sama dengan Astryx) → cek contoh pakai
`get_item_examples_from_registries` → install via
`get_add_command_for_items`/`shadcn add` → audit akhir dengan
`get_audit_checklist`. Tiap langkah CLI dipetakan eksplisit ke tool MCP
padanannya supaya agent tahu mana yang dipakai duluan (MCP untuk
exploration dalam sesi, CLI sebagai fallback/eksekusi install).

Rules disesuaikan dari model Astryx (props-only, tokens via
`astryx docs tokens`, no `<div>`) ke model shadcn: Tailwind utility sebagai
mekanisme styling utama, token lewat CSS variable `globals.css` (bukan
sistem token Astryx terpisah), `cn()` dari `@/lib/utils` untuk merge class,
variant dibaca dari blok `cva(...)` di file komponen itu sendiri (bukan
tabel props terpusat seperti `astryx component <Name>`). Icon library
`hugeicons` (default preset Maia, dikonfirmasi tetap dipakai di T-095.1)
dicatat sebagai default komponen baru; `react-icons` (era Astryx) dicatat
coexist untuk kode yang belum migrasi — bukan dianggap salah pakai.

File berubah: `apps/web/.claude/CLAUDE.md`. Status ditandai di
`tasks/v07-astryx-shadcn-migration.md` (T-095.3 → selesai) dan `TASKS.md`
§ Fokus sekarang.

---

## 2026-09-01 — T-095.2: Install & konfigurasi MCP server shadcn

Subtask kedua T-095 (rilis v0.7, ADR-097). Dikerjakan via CLI resmi shadcn,
bukan edit manual: `bunx shadcn@latest mcp init --client claude` lalu
`--client cursor`, keduanya dijalankan dari root repo (bukan `apps/web/`)
supaya menulis ke `.mcp.json` dan `.cursor/mcp.json` di lokasi yang benar
(dua file kembar wajib sinkron, ADR-064 — lihat `AGENTS.md` § Kompatibilitas
tool). Hasil identik di kedua file: server baru `"shadcn"` terdaftar sebagai
`stdio` (`command: "npx"`, `args: ["shadcn@latest", "mcp"]`) — beda transport
dari 3 server lain yang sudah ada (`xds`, `supabase`, `railway`, semuanya
`http`). Server `xds` (Astryx) **dibiarkan tetap ada** untuk sementara,
belum dihapus — akan dihapus di T-102 cleanup setelah migrasi selesai
(Astryx & shadcn coexist per strategi ADR-097 poin 2), bukan lupa dihapus.

**Efek samping CLI:** menambah devDependency `shadcn@^4.19.1` di root
`package.json` (+ `bun.lock`) — versi sama dengan yang sudah ada di
`apps/web/package.json` dari T-095.1, konsisten, dibiarkan apa adanya
(bukan duplikasi yang perlu dibersihkan, CLI butuh keduanya untuk jalan di
scope monorepo vs `apps/web`).

**Update:** setelah restart Claude Code, koneksi awal gagal
(`CONNECTION_CLOSED`) — root cause: cache `~/.npm/_cacache` root-owned
(bug lama npm, sisa dari sudo npm/npx sebelumnya), bikin `npx
shadcn@latest mcp` gagal EACCES saat di-spawn. Diperbaiki King Rezi
sendiri via `sudo chown -R 501:20 ~/.npm` (di luar scope AI, butuh
password sistem), lalu restart ulang. **Terverifikasi tersambung** — 7
tool muncul: `search_items_in_registries`, `view_items_in_registries`,
`list_items_in_registries`, `get_add_command_for_items`,
`get_item_examples_from_registries`, `get_project_registries`,
`get_audit_checklist`.

File berubah: `.mcp.json`, `.cursor/mcp.json`, `package.json` (root) +
`bun.lock`. Status ditandai di `tasks/v07-astryx-shadcn-migration.md`
(T-095.2 → selesai) dan `TASKS.md` § Fokus sekarang.

---

## 2026-09-01 — T-095.1: Init shadcn/ui di apps/web (base Radix + preset Maia)

Subtask pertama implementasi kode rilis v0.7 (migrasi Astryx → shadcn/ui,
ADR-097). Sebelum eksekusi, King Rezi diberi penjelasan trade-off 3 base
library shadcn (Radix/Base UI/React Aria) — memilih **Radix** (paling
matang, kompatibel dengan MCP server shadcn yang akan dipasang di T-095.2)
dengan style preset **Maia** (softer/rounded, dipilih King Rezi lebih dulu).

**Hambatan teknis & solusi:** `bunx shadcn@latest init` (v4.19.1) gagal
deteksi Tailwind v4 karena `globals.css` project pakai 3 baris `@import`
terpisah (`tailwindcss/theme.css`/`preflight.css`/`utilities.css`, pola ini
dipakai supaya layer Astryx (`astryx-base`, `astryx-theme`) bisa
diselipkan di antara `base` dan `components`) — bukan `@import
"tailwindcss";` tunggal yang dicari CLI lewat exact substring match.
Diganti ke bentuk tunggal, **identik secara fungsional** (isi
`tailwindcss/index.css` upstream = gabungan 3 baris itu; urutan cascade
layer tetap dikontrol oleh deklarasi `@layer reset, theme, base,
astryx-base, astryx-theme, components, utilities;` di baris 1, bukan
posisi fisik `@import`).

Init berhasil: `components.json` dibuat (`style: radix-maia`), file
`src/lib/utils.ts` (util `cn()`) + `src/components/ui/button.tsx` dibuat.
CLI juga otomatis mem-patch `layout.tsx` (tambah font Figtree + import
`cn`) dan `globals.css` (append CSS variable tema default shadcn). **Bug
CLI ditemukan & diperbaiki manual:** hasil merge menulis
`--font-sans: var(--font-sans);` (self-referencing/circular, akan resolve
ke initial value di browser) — dikembalikan ke `var(--font-geist-sans)`.

**Icon library:** preset Maia default `iconLibrary: "hugeicons"` (bukan
`lucide-react` yang lebih umum di ekosistem shadcn) — dikonfirmasi ke King
Rezi, keputusan: **tetap hugeicons**, ikuti default preset apa adanya.
`react-icons` (Astryx lama) coexist sampai migrasi selesai, wajar untuk
masa transisi ADR-097.

**Verifikasi:** `bun run typecheck` bersih. Dev server (`bun run dev`)
direstart bersih, log `GET / 200`, `GET /api/realtime/token 200`, tanpa
error compile. Verifikasi visual di Browser pane sempat terhambat
`ERR_TOO_MANY_REDIRECTS` bolak-balik `/`↔`/login` — ternyata bukan bug
dari perubahan T-095.1, melainkan session cookie basi di profil browser
pane yang memicu bug pre-existing di `src/proxy.ts`: gate cepat halaman
auth publik cuma cek *keberadaan* cookie (`getSessionCookie`), bukan
validitasnya, jadi cookie yang ada-tapi-invalid memicu loop antara
"gate cepat redirect ke /" dan "validasi penuh redirect ke /login". Diatasi
untuk sesi ini dengan sign-out manual lewat `/api/auth/sign-out` (bypass
path proxy), bukan dengan mengubah `proxy.ts` (beda domain/scope dari
T-095, dicatat sebagai temuan terpisah untuk auth/proxy, bukan diperbaiki
diam-diam di sini). Setelah cookie bersih, halaman `/login` render normal
— styling Astryx utuh, tidak ada regresi visual dari `globals.css` baru.

File berubah: `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`,
`apps/web/package.json` (+ `bun.lock`), file baru `apps/web/components.json`,
`apps/web/src/lib/utils.ts`, `apps/web/src/components/ui/button.tsx`.
Status ditandai di `tasks/v07-astryx-shadcn-migration.md` (T-095 →
🟡 In Progress) dan `TASKS.md` § Fokus sekarang.

---

## 2026-09-01 — Docs consistency audit: 3 gap ditemukan & diperbaiki (topik "components")

### Fixed
- **`project-manager/DECISIONS.md`** — 4 baris index (ADR-041, ADR-055, ADR-057, ADR-082) belum menyebut "Amended by ADR-097 (2026-09-01)" di kolom Status, padahal file ADR masing-masing sudah punya catatan itu — index dan sumbernya desync. Diperbaiki, kolom Status di-sync ulang.
- **`project-manager/decisions/ADR-041-ui-component-system-astryx-sebagai-fondasi-permanen-dan-design-later-workflow.md`** — Status line kehilangan referensi "Amended by ADR-082 (2026-08-19)" (tertimpa saat edit T-095.7 sebelumnya, seharusnya ditambah bukan diganti). Dikembalikan jadi `Accepted — Amended by ADR-057 (2026-07-31), ADR-082 (2026-08-19), ADR-097 (2026-09-01)`.
- **`project-manager/PROJECT_STATE.md`** § Current Focus — bullet lama "Alignment dokumentasi ADR-041 selesai ... Astryx permanen ... Tailwind layout-only ... exact pin Beta" berkontradiksi langsung dengan bullet ADR-097/prioritas-utama 13 baris di atasnya dalam section yang sama. Ditandai eksplisit sebagai superseded oleh ADR-097, riwayat instalasi/smoke-test Next.js 16 dipertahankan sebagai fakta yang masih valid.

### Context
Dijalankan via skill `/docs-consistency-audit` dengan argumen topik "components" — scope dipersempit ke UI component system (Astryx/shadcn) setelah dikonfirmasi ke King Rezi (grep awal "component" menghasilkan banyak false-positive "Server Component"/"Client Component" React/Next.js yang tidak relevan). 33 file dibaca penuh (context/, product-discovery/06-engineering, product-discovery/04-ux, 12 ADR terkait, DECISIONS.md, TASKS.md + tasks/v07, PROJECT_OVERVIEW.md, PROJECT_STATE.md, .claude/agents/*, AGENTS.md). Mayoritas file dari ronde sinkronisasi T-095.7 sebelumnya terverifikasi bersih — 3 gap di atas adalah sisa yang lolos dari ronde itu, semuanya Kelas A (mekanis, jawaban benar jelas dari Source of Truth). Diperbaiki setelah dikonfirmasi King Rezi ("ya, perbaiki semua"), mengikuti mode report-only-lalu-tanya skill ini (tidak ada perbaikan diam-diam).

**Tidak ditemukan gap** di: context/ctx-*.md (4 file), product-discovery/06-engineering/README.md, monorepo-setup.md, code-conventions.md, dependency-strategy.md, design-tokens.md (kecuali 1 cross-reference blurb minor, tidak diperbaiki — severity Low, murni redaksional), product-discovery/04-ux/ (README.md, key-screen-patterns.md, navigation-patterns.md), TASKS.md, tasks/v07-astryx-shadcn-migration.md, PROJECT_OVERVIEW.md, .claude/agents/README.md, prabowo-feature-engineer.md, AGENTS.md.

---

## 2026-09-01 — T-095.7: Sinkronisasi dokumentasi baseline Astryx→shadcn/ui

### Changed
- **14 file** diupdate supaya konsisten dengan ADR-097 (shadcn/ui menggantikan Astryx sebagai fondasi UI permanen): `context/ctx-implementation.md`, `ctx-technical-context.md`, `ctx-development.md`, `ctx-design.md`; `product-discovery/06-engineering/dependency-strategy.md` (DS-D07 ditandai superseded), `monorepo-setup.md`, `README.md`, `design-tokens.md`; `product-discovery/04-ux/key-screen-patterns.md`, `navigation-patterns.md` (nama komponen "Astryx Popover"/"Card Astryx" dinetralkan); `.claude/agents/README.md`, `.claude/agents/prabowo-feature-engineer.md`; `AGENTS.md` (root); `project-manager/PROJECT_OVERVIEW.md`.
- **4 ADR** (`ADR-041`, `ADR-055`, `ADR-057`, `ADR-082`) — baris Status ditambah `Amended by ADR-097 (2026-09-01)`; isi Decision/Reason/Alternatives Considered tidak diubah (riwayat keputusan tetap utuh).

### Context
King Rezi meminta seluruh dokumentasi yang jadi acuan kerja (terutama UI/UX) ikut disinkronkan **sebelum** implementasi migrasi kode dimulai — bukan ditunda ke T-102 cleanup di akhir rilis v0.7. Prinsip edit: minimal-diff, pointer ke ADR-097 di tempat relevan, detail teknis Astryx yang sudah tidak berlaku (exact-pin Beta, canary, swizzle, CLI `astryx build/template/component`) ditandai historis/superseded bukan dihapus begitu saja. Sengaja **tidak** menyentuh `.claude/agents/mark-ui-engineer.md` (Static Reference, chmod 444, butuh izin eksplisit terpisah — dicatat T-095.6) dan `apps/web/.claude/CLAUDE.md` (task terpisah T-095.3, agent docs Astryx CLI ditulis ulang saat setup shadcn CLI/MCP benar-benar terpasang).

Diverifikasi lewat `grep -rn "Astryx"` ulang di seluruh scope — sisa mention yang ditemukan semuanya legitimate (riwayat/historical, catatan migrasi transisi, atau baris Status ADR yang memang seharusnya menyebut ADR lama). Ditemukan 1 file tambahan di luar daftar awal (`project-manager/PROJECT_OVERVIEW.md`, tabel Tech Stack) yang juga diupdate.

**T-095.7** ditandai selesai di `tasks/v07-astryx-shadcn-migration.md` — belum ada kode aplikasi yang berubah, T-095.1–.6 (setup shadcn/MCP/CLI nyata) masih `⏳ Not Started`.

---

## 2026-09-01 — v0.7 (migrasi Astryx→shadcn/ui) dijadikan prioritas utama

### Changed
- `project-manager/TASKS.md` § Fokus sekarang — **T-095** (task pertama v0.7) ditambahkan sebagai baris teratas, mendahului T-025/T-036, dengan catatan eksplisit "Prioritas utama".
- `project-manager/PROJECT_STATE.md` § Snapshot (Top Next Tasks) dan § Current Focus — diperbarui menyebut T-095/v0.7 sebagai prioritas utama saat ini, dikerjakan sebelum T-025/T-036.

### Context
Setelah ADR-097 + rilis v0.7 dibuat (lihat entri di bawah), King Rezi meminta migrasi ini dijadikan task yang harus diutamakan. T-025 (Real OutstandAdapter) tetap terhenti menunggu kredensial (KI-003) dan T-036 tersisa 2 subtask non-blocking, jadi tidak ada konflik prioritas nyata — migrasi bisa langsung dimulai dari T-095. Belum ada implementasi kode di sesi ini.

---

## 2026-09-01 — ADR-097: Migrasi Astryx → shadcn/ui direncanakan (audit + task list)

### Added
- **ADR-097** (`project-manager/decisions/ADR-097-migrasi-astryx-ke-shadcn-ui.md`) — reverse ADR-041: shadcn/ui menggantikan Astryx sebagai fondasi komponen UI permanen. Mengamendemen ADR-055/057/082, tidak mengubah ADR-087 (theme Stone jadi acuan token).
- Release baru **v0.7** (`project-manager/tasks/v07-astryx-shadcn-migration.md`) — 8 task (T-095–T-102), 26 subtask, strategi incremental per route-segment (Astryx & shadcn coexist sementara, bukan big-bang).

### Context
Atas permintaan King Rezi, dilakukan audit menyeluruh atas seluruh pemakaian Astryx di `apps/web/src` sebelum menyusun rencana migrasi ke shadcn/ui. Latar belakang: KI-040 (gap visual notification panel) dan riwayat KI-030 (TimeInput)/KI-035 (Badge, StyleX) dianggap sebagai keterbatasan Astryx yang berulang dan tidak bisa diperbaiki dari sisi project (closed-package, masih Beta — KI-005).

**Hasil audit:** 49 file unik meng-import `@astryxdesign/*`, ~44 komponen/hook berbeda, 1 wrapper selektif (`components/ui/Drawer.tsx`, dibuat karena Astryx tanpa primitive Drawer), 0 file test komponen UI. Seluruh pemakaian terisolasi di `app/` (46 file) dan `components/` (3 file) — `domains/`/`lib/` bersih dari dependency UI, sehingga migrasi feasible tanpa menyentuh business logic.

King Rezi mengonfirmasi dua keputusan lewat `AskUserQuestion`: (1) formalisasi langsung ke ADR + TASKS.md (bukan disimpan sebagai proposal draft dulu), (2) strategi **incremental per route-segment** (bukan big-bang/freeze fitur M8).

**Task breakdown (T-095–T-102):** T-095 (setup shadcn/ui + MCP server + tulis ulang agent docs + update AGENTS.md rule 14/15), T-096 (core infra: globals.css, Providers.tsx, AppShell, primitive dasar), T-097 (Auth & Onboarding), T-098 (App Shell & Navigasi, termasuk hapus wrapper `Drawer.tsx` → shadcn `Sheet`, re-verifikasi KI-040), T-099 (Settings), T-100 (Draft Editor Modal, ~68 titik pakai — task tersendiri karena paling kompleks, termasuk re-evaluasi KI-030 TimeInput), T-101 (Calendar/Queue/Drafts/Dashboard, termasuk re-evaluasi KI-035), T-102 (cleanup dependency + QA visual menyeluruh + tutup KI terkait).

Belum ada implementasi kode — sesi ini murni audit + perencanaan/dokumentasi.

### Related
- `project-manager/DECISIONS.md` (index ADR-097 ditambahkan di atas)
- `project-manager/TASKS.md` (indeks release v0.7 ditambahkan, total task 77→85, subtask 173→199)
- `project-manager/PROJECT_STATE.md` (Snapshot + Recent Decisions diperbarui, ADR-087 digeser keluar dari daftar 5)

---

## 2026-09-01 — T-036.4 dibuka kembali (5 gap visual vs Claude Design ditemukan, verifikasi visual belum dilakukan)

### Context

Branch `feature/t-036-notification-realtime`. T-036.4 (UI notification bell + panel) sebelumnya sudah ditandai `[x]` Done di sesi ini. Review lanjutan membandingkan langsung ke spec Claude Design (`components/notifications-panel.html`) menemukan 5 gap visual pada `apps/web/src/app/(app)/components/notification-panel/NotificationBell.tsx`: (1) background tint item unread, (2) dot indikator unread, (3) icon circle badge, (4) weight/warna title berbeda per status, (5) deskripsi terpotong ellipsis.

### Perubahan

- Kelima gap sudah diperbaiki oleh subagent lain langsung di `NotificationBell.tsx` (lint + `tsc` bersih).
- Verifikasi visual di browser **belum dilakukan** — dev server minta login, tidak ada kredensial test tersedia di sesi ini.
- Karena itu checklist **T-036.4 dikembalikan dari `[x]` ke `[ ]`** di `project-manager/tasks/v02-publishing-mvp.md` sampai ada verifikasi visual browser nyata yang mengonfirmasi kecocokan dengan spec.
- Bukan KI baru — dianggap bagian dari investigasi yang sama dengan **KI-040** (tetap Open, tidak diubah statusnya).
- Dokumen yang diperbarui: `project-manager/tasks/v02-publishing-mvp.md` (checklist + catatan), `project-manager/TASKS.md` (baris Fokus sekarang T-036 + update log baru), `project-manager/PROJECT_STATE.md` (Top Next Tasks, catatan lanjutan KI-040, bullet Completed Ringkasan T-036.3/.4).

---

## 2026-09-01 — Polishing styling panel notifikasi (2 ronde) + KI-040 dibuka

### Context

Branch `feature/t-036-notification-realtime`, lanjutan dari T-036.3/.4
(entri di bawah). Setelah T-036.4 lolos review Ridwan + QA Najwa, King Rezi
meminta polish styling panel notifikasi (`Drawer`) agar lebih sesuai spec
Claude Design (NP-D08). Dua ronde fix dilakukan, keduanya diverifikasi
presisi lewat source Astryx sebelum diterapkan:

* **Ronde 1** — perbaikan padding/gap/border-radius list item notifikasi
  di dalam panel supaya sesuai spec `components/notifications-panel.html`.
* **Ronde 2** — perbaikan vertical-centering empty-state (saat tidak ada
  notifikasi) dan kontras border header panel di dark mode.

Setelah ronde 2, King Rezi mengambil screenshot langsung dari Chrome
browser asli (bukan lewat tool preview) di `localhost:3000` dan melaporkan
panel masih terlihat "banyak yang terpotong atau tidak sempurna"
dibanding rancangan di Claude Design — meski dari screenshot yang terlihat
(dark mode, viewport desktop besar) elemen header dan empty-state sudah
tampak lengkap tanpa clipping yang jelas. Root cause belum teridentifikasi
presisi (kemungkinan masalah geometri/proporsi seperti lebar panel di
viewport besar) — berbeda dari 2 bug ronde 1/2 yang sudah diverifikasi
lewat source Astryx. Dicatat sebagai **KI-040** (Open, lihat
`PROJECT_STATE.md` § Known Issues dan `tasks/v02-publishing-mvp.md` §
T-036). Atas instruksi eksplisit King Rezi, pekerjaan perbaikan dihentikan
untuk sesi ini — butuh sesi investigasi visual terpisah side-by-side
dengan Claude Design.

### Changed

* `apps/web/src/app/(app)/components/notification-panel/` — styling list
  item (padding/gap/border-radius), empty-state vertical-centering, border
  header panel dark mode.
* `apps/web/src/components/ui/Drawer.tsx` — penyesuaian mengikuti fix di
  atas.

### Known Issues

* **KI-040 (baru, Open)** — panel notifikasi masih ada gap visual vs
  Claude Design setelah 2 ronde fix, root cause belum ditemukan.

---

## 2026-09-01 — T-036.3/.4 Supabase JWT bridge + UI notification bell/panel

### Context

Branch `feature/t-036-notification-realtime`, lanjutan T-036.1/.2 (entri di
bawah). Dua subtask diselesaikan sesi ini: T-036.3 (sambungkan Supabase JWT
dari session Better Auth) dan T-036.4 (UI notification bell + panel). Lolos
review arsitektur Ridwan (tanpa temuan) dan QA Najwa (semua PASS termasuk
realtime live-update, setelah 1 bug ditemukan dan diperbaiki). T-036.5
(trigger dari webhook) masih belum dikerjakan — T-036 tetap `🟡 In Progress`.

### Added

* Route Handler `apps/web/src/app/api/realtime/token/route.ts` (GET) — cek
  session Better Auth, terbitkan Supabase Realtime JWT via
  `createSupabaseRealtimeJwt` (helper sudah ada sejak awal, baru sekarang
  dipakai).
* Method `list`, `markAsRead`, `markAllAsRead` di `INotificationRepository`
  + implementasi Prisma + `NotificationService` (sengaja ditunda dari
  T-036.1 supaya tidak menulis kode yang belum terpakai).
* Server Actions `markNotificationReadAction`/`markAllNotificationsReadAction`
  di `apps/web/src/app/(app)/components/notification-panel/actions.ts`.
* Komponen baru `apps/web/src/app/(app)/components/notification-panel/NotificationBell.tsx`
  (bell + panel + state + wiring realtime + mark-as-read).
* `apps/web/src/components/ui/Drawer.tsx` — wrapper selektif pertama di
  codebase ini. Spec Claude Design (NP-D08,
  `components/notifications-panel.html`) menyebut Astryx `Drawer`, tapi
  Astryx ter-pin (`@astryxdesign/core@0.4.3`) tidak punya komponen itu.
  Emulasi dengan `Dialog` posisi edge gagal full-height (base style
  `Dialog` hardcode `height: fit-content`, bentrok dengan positioning
  `top`+`bottom`, over-constrained). King Rezi memutuskan (dikonfirmasi 2x
  via AskUserQuestion): pakai wrapper selektif, bukan `Dialog` — dirakit
  dari primitive Astryx resmi (`useLayer` mode fixed/top-layer via native
  Popover API, `useFocusTrap`, `useScrollLock`, `Stack`/`VStack`), bukan
  swizzle/CSS manual. Preseden baru untuk kasus serupa selama Astryx belum
  expose primitive Drawer/Sheet generik.
* 3 test case baru di `notification.service.test.ts` (total 5).
* Migration `apps/web/prisma/migrations/20260901120000_t036_fix_realtime_rls_cuid_cast/`
  (lihat Fixed).

### Changed

* `apps/web/src/lib/hooks/use-notification-realtime.ts` — fetch token dari
  endpoint `api/realtime/token` dan panggil `client.realtime.setAuth(token)`
  sebelum subscribe.
* `apps/web/src/app/(app)/components/WorkspaceSideNav.tsx` — bell trigger +
  badge unread di footer sidebar (sebelumnya `router.push` ke halaman
  settings, sekarang membuka panel).
* Threading data: `apps/web/src/app/(app)/layout.tsx` (fetch initial
  notifications via `NotificationService.list()`) →
  `apps/web/src/app/(app)/components/AppSideNav.tsx` → `WorkspaceSideNav.tsx`.

### Fixed

* Bug ditemukan Najwa QA: notifikasi Realtime tidak muncul live tanpa
  refresh (channel `SUBSCRIBED`, nol event, tanpa error terlihat). Root
  cause (dikonfirmasi via diagnostic PostgREST 400→200): bukan
  `SUPABASE_JWT_SECRET` mismatch — fungsi `auth.uid()` bawaan Supabase
  selalu cast klaim JWT `sub` ke `::uuid`, padahal `userId` Better Auth
  berformat `cuid()` (pola yang sudah diketahui di `with-current-user.ts`,
  DO-D06, tapi luput diterapkan saat policy Realtime
  `notifications_realtime_own_rows` dibuat di T-036.2, migration
  `20260831150000_t036_notifications_realtime_setup`). RLS gagal
  dievaluasi untuk setiap user asli, Realtime menelan error itu diam-diam.
  Fix: migration `20260901120000_t036_fix_realtime_rls_cuid_cast`
  (drop+recreate policy supaya baca klaim `sub` sebagai text langsung,
  tanpa cast `::uuid`; tidak menyentuh `auth.uid()` itu sendiri).
  Diterapkan manual oleh King Rezi (classifier auto-mode Claude Code
  memblokir eksekusi `prisma migrate deploy` dari sesi manapun terhadap
  database live — batasan tooling, bukan gap arsitektur). QA ulang: PASS
  (alur asli Transfer Ownership + insert manual). Closing gap bug RLS,
  sama pola dengan migration T-036.2 — bukan keputusan arsitektur baru,
  tidak ada ADR baru untuk ini.

### Lain-lain

* **KI-039 Resolved** — rancangan Notifications Panel
  (`components/notifications-panel.html`) ternyata sudah ditambahkan ke
  Claude Design sebelum sesi ini dimulai (2026-08-31 pagi).
* Catatan kosmetik minor dari Najwa (bukan bug produk, informasional saja):
  badge Next.js Dev Tools indicator menimpa posisi tombol bell saat
  `bun run dev` — hanya muncul di development, tidak berdampak production,
  tidak ada action item formal.

---

## 2026-08-31 — T-036.1/.2 In-app notification domain skeleton + Supabase Realtime subscribe

### Context

Branch `feature/t-036-notification-realtime` (dari `staging`). Mulai
mengerjakan T-036 (In-app notification + Supabase Realtime) — rantai
**T-093 → T-036 → T-092** sudah tidak lagi terhambat sejak T-093 ditutup
Done (entri di atas). Dua subtask diselesaikan sesi ini: T-036.1 (domain
skeleton) dan T-036.2 (subscribe Realtime).

### T-036.1 — Domain skeleton: service + repository

Skeleton `NotificationService.notify()` + `notificationRepository.create()`
ternyata sudah ada sebelumnya (dibangun untuk fitur Transfer Ownership
T-008.3), tapi belum pernah punya test — beda dengan domain lain
(workspace, publishing, analytics) yang semuanya sudah punya
`.service.test.ts`. Ditambahkan
`apps/web/src/domains/notification/services/notification.service.test.ts`
(2 test case: delegasi ke `repository.create()` + return record yang
benar, termasuk kasus tanpa `relatedEntityType`/`relatedEntityId`
opsional). Lulus semua, lint bersih, `tsc --noEmit` bersih. Method CRUD
lain (list/markAsRead) sengaja tidak ditambah — ditunda ke T-036.4 (UI
panel) supaya tidak menulis kode yang belum ada consumer-nya.

### T-036.2 — Subscribe Supabase Realtime tabel `notifications`

File baru:

* `apps/web/src/lib/supabase/realtime/notifications.ts` —
  `subscribeToNotificationInserts(client, userId, onInsert)`: subscribe
  channel `notifications:{userId}`, event `postgres_changes` INSERT,
  filter `user_id=eq.{userId}`, plus mapper payload snake_case Realtime →
  `NotificationRecord` domain type. Return fungsi unsubscribe.
* `apps/web/src/lib/hooks/use-notification-realtime.ts` — hook React
  `useNotificationRealtime(userId, onInsert)`, pembungkus lifecycle
  (subscribe on mount saat `userId` tersedia, unsubscribe on
  unmount/`userId` berubah). Tidak merender JSX apa pun, jadi tidak masuk
  kategori "UI/UX-related" yang butuh gate Claude Design (rule 17
  AGENTS.md) — akan dipasang nanti oleh komponen bell (T-036.4).

**Temuan infra penting** (dicek via MCP Supabase, project
`ndcrkzqgqukqfmekgoze`): tabel `notifications` belum pernah dimasukkan ke
publication `supabase_realtime` (tidak ada satu pun tabel di publication
itu — Realtime tidak pernah broadcast apapun sebelumnya), dan RLS policy
yang ada (`notifications_workspace_isolation`) berbasis
`current_setting('app.current_user_id')` (pola server-side
`withCurrentUser`), bukan `auth.uid()` — tanpa perbaikan, subscription
Realtime akan tetap default-deny walau JWT bridge (T-036.3) sudah selesai
nanti.

**Perbaikan:** migration baru
`apps/web/prisma/migrations/20260831150000_t036_notifications_realtime_setup/migration.sql`
— (1) `ALTER PUBLICATION supabase_realtime ADD TABLE "notifications"`, (2)
`CREATE POLICY "notifications_realtime_own_rows" ON "notifications" FOR
SELECT USING ("user_id" = (auth.uid())::text)` (policy tambahan/permisif,
berdampingan dengan policy lama, tidak menggantikan). Migration ini sudah
dijalankan (`bun run db:deploy`) dan diverifikasi lewat MCP Supabase —
publication dan policy baru sudah ada di database. Tidak ada ADR baru
untuk temuan ini — ini closing gap yang memang sudah disyaratkan ADR-023
(`realtime-strategy.md` § "RLS pada Supabase Realtime"), bukan keputusan
arsitektur baru.

### Sisa scope T-036 (belum dikerjakan)

* **T-036.3** — sambungkan Supabase JWT dari session Better Auth ke hook
  `useNotificationRealtime` (saat ini masih pakai anon key polos,
  `createBrowserSupabaseClient()` tanpa JWT Realtime).
* **T-036.4** — UI notification bell + panel daftar. **Blocked** —
  dicek ke Claude Design (project "Social Media Management"), rancangan
  Notifications Panel belum ada (App Prototype menampilkan toast "Panel
  notifikasi belum ada layarnya" saat ikon bell diklik). Dicatat
  **KI-039**. Menunggu King Rezi membuat/mengonfirmasi desain (langsung
  atau lewat Neymar Product Designer).
* **T-036.5** — trigger notifikasi dari webhook publish result. Belum
  dikerjakan, depends T-026 yang juga belum selesai.

### Status

T-036 pindah dari `⏳ Not Started` ke `🟡 In Progress` (2/5 subtask
selesai). Tidak ada ADR baru ditulis sesi ini.

---

## 2026-08-31 — T-093 Accept Invite page ditutup Done (T-093.4 verifikasi RBAC end-to-end + fix bug Creator-akses-Members)

### Context

Sesi lanjutan menutup T-093 (Accept Invite page) yang di sesi sebelumnya
sudah menyelesaikan T-093.1–.3 (implementasi) tapi meninggalkan T-093.4
(verifikasi RBAC end-to-end dengan akun real kedua) sebagian — hanya
unit/integration test service-level, belum verifikasi browser dengan akun
nyata (dicatat **KI-038**). Najwa QA Engineer menuntaskan verifikasi dengan
**3 akun real** (Owner/Admin/Creator) di satu workspace ("Insvire").

### Hasil verifikasi RBAC (Najwa)

* Danger Zone hidden non-Owner — **PASS**
* Transfer Ownership target eligible (hanya Admin, bukan Creator) — **PASS**
* Update Role (siapa boleh ubah siapa) — **PASS** untuk Owner & Admin
* Remove Member (proteksi Owner/diri sendiri) — **PASS** untuk Owner & Admin

### Bug ditemukan & diperbaiki

Creator seharusnya "Tidak ada akses" ke halaman `/settings/members`
(`product-discovery/02-product/roles-permissions.md`), tapi sebelumnya
halaman tetap terbuka penuh dan mengirim data member+email ke client —
`MembersTable` cuma menyembunyikan tombol aksi per baris, tidak pernah
mengecek role si pengunjung halaman. Backend (`assertActorCanManageMembers`)
sudah benar sejak awal (tidak ada mutasi tidak sah yang berhasil saat
dites) — ini murni information-disclosure di level UI, risiko rendah tapi
nyata.

**Fix (Prabowo Feature Engineer, commit `6fdf272`):**

* `WorkspaceService.canManageMembers(workspaceId, actorUserId)` — method
  publik baru, reuse `assertActorCanManageMembers` yang privat (sudah
  dipakai `removeMember`/`updateMemberRole`/`inviteMember`), supaya
  kriteria RBAC tidak terduplikasi.
* `apps/web/src/app/(app)/settings/members/page.tsx` — gate
  `canManageMembers` dipanggil **sebelum** `listMembersWithUser`; kalau
  `false`, `redirect("/settings")` terjadi di server sebelum data member
  pernah diambil sama sekali (menutup celah information disclosure).
* 5 unit test baru di `workspace.service.test.ts` untuk `canManageMembers`
  (Owner/Admin true, Creator/non-member/non-Active false).
* Diverifikasi ulang live browser: Raka (Owner) & Maya (Admin) tetap akses
  penuh Members (tidak ada regresi), Sinta (Creator) langsung redirect ke
  `/settings` tanpa data member sempat tampil.
* Full suite: 229 passed, 4 skipped. Typecheck & lint bersih.

### Status

T-093 ditutup **✅ Done** (4/4 subtask selesai). **KI-038 Resolved**.
Rantai **T-093 → T-036 → T-092** tidak lagi terhambat T-093 — T-036
(In-app notification + Supabase Realtime) sekarang giliran berikutnya di
v0.1 tanpa blocker task lain. Dokumentasi diperbarui: `TASKS.md` (task
selesai 24 → 25, breakdown v0.1 12 ✅ → 13 ✅ · 7 🟡 → 6 🟡),
`tasks/v01-foundation.md` § T-093, `PROJECT_STATE.md` (Completed Ringkasan,
Blockers § Resolved, Top Next Tasks).

---

## 2026-08-31 — T-093 Accept Invite page (T-093.1–.3) + ADR-096 (RLS pra-membership)

### Context

King Rezi menutup gap yang sudah dicatat sejak ADR-080 (2026-08-14):
halaman `/invite/[token]` (accept-invite) belum pernah dibuat, sehingga link
Copy Link yang dihasilkan T-007.1/.6 404 kalau dibuka. Rantai dependency
Realtime (T-093 → T-036 → T-092, ADR-094) butuh invite-to-membership utuh
dulu supaya bisa diuji/dipakai dengan ≥2 akun nyata di satu workspace.
Dikerjakan Prabowo Feature Engineer (implementasi), lolos review arsitektur
Ridwan (2 temuan security langsung diperbaiki).

### Implemented

* Route `/invite/[token]` (`apps/web/src/app/(auth)/invite/[token]/`) —
  validasi token (valid/expired/invalid) + auto-detect `isExistingUser`
  (email invitation sudah punya akun atau belum).
* Alur Better Auth: sign-up (email baru) atau sign-in (email sudah
  terdaftar) — email dikunci ke invitation, tidak bisa diedit manual
  (email-bound, ADR-080). UI auto-detect (bukan pilihan manual user) sesuai
  desain final Claude Design `templates/accept-invite.html`.
* Insert `workspace_members` dengan role dari invitation (bukan default),
  mark invitation `accepted`, redirect ke `/` + cookie
  `active-workspace-id` (bukan `/[slug]`, ADR-076 sudah menghapus dynamic
  segment itu).
* Method baru langsung di `WorkspaceService` (bukan use-case terpisah),
  konsisten pola method lain di file yang sama.
* File: `apps/web/src/domains/workspace/{repositories/workspace.repository.ts, services/workspace.service.ts, services/workspace.service.test.ts, types.ts}`,
  `apps/web/src/lib/repositories/workspace/workspace.repository.ts` + test
  integrasi baru `workspace.repository.accept-invitation.test.ts`,
  `apps/web/src/lib/prisma/with-current-user.ts` (helper baru
  `setInviteLookupToken`), `apps/web/src/proxy.ts` (`/invite` masuk bypass
  list), UI baru `apps/web/src/app/(auth)/invite/[token]/{page.tsx, actions.ts, components/AcceptInvitePageClient.tsx, components/AcceptInviteForm.tsx}`.
* Test: 17 unit test baru (fake repository, service-level) + 1 integration
  test terhadap DB real (`workspace.repository.accept-invitation.test.ts`).

### ADR-096 — 3 migrasi RLS

Pola RLS untuk operasi pra-membership (baca invitation by token, update
status invitation, insert membership pertama) — SECURITY DEFINER function +
session-variable GUC, ditetapkan sebagai preseden untuk kasus serupa di masa
depan. 3 migrasi diterapkan ke DB dev, berurutan:

1. `20260831035427_t093_accept_invite_rls` — 3 policy RLS awal: SELECT
   invitation pending by token, UPDATE pending→accepted by invitee email
   match, INSERT `workspace_members` via accepted invitation.
2. `20260831042017_t093_invitation_select_visibility_fix` — bug fix:
   Postgres mensyaratkan baris UPDATE juga lolos minimal satu policy SELECT
   (bukan cukup WITH CHECK milik UPDATE-nya sendiri) — policy SELECT lama
   berhenti meng-cover baris begitu status berubah jadi `accepted`; ditambah
   policy SELECT baru: user selalu bisa lihat invitation yang emailnya
   cocok dengan emailnya sendiri apa pun statusnya.
3. `20260831044328_t093_code_review_rls_hardening` — 2 temuan review
   Ridwan: (a) policy SELECT token-lookup awal terlalu longgar (buka baca
   semua invitation pending, bukan cuma yang token-nya cocok) — diperbaiki
   pakai session-variable GUC pattern (`app.invite_lookup_token`, konsisten
   `app.current_user_id`), default-deny kalau GUC tidak di-set; (b) policy
   INSERT `workspace_members` tidak mengunci `role` pada baris hasil
   accept-invite — diperbaiki dengan menambah parameter role ke fungsi
   `has_accepted_invitation` sehingga role yang di-insert harus sama persis
   dengan role di invitation.

### Belum selesai (dicatat sebagai KI-038)

T-093.4 "verifikasi RBAC end-to-end dengan akun real kedua" (Owner vs Admin
vs Creator, browser 2-akun nyata) belum dilakukan di sesi ini — di luar
scope sesi implementasi, dicatat sebagai catatan terpisah untuk Najwa QA
Engineer. T-093 tetap `🟡 In Progress`, belum ditutup `✅ Done`.

### Docs

`tasks/v01-foundation.md` § T-093 (checklist T-093.1–.3 `[x]`, status
diupdate), `TASKS.md` (breakdown v0.1: 12 ✅ · 1 🚫 · 7 🟡 · 1 ⏸️ · 2 ⏳,
T-093 pindah ⏳→🟡), `PROJECT_STATE.md` (Completed Ringkasan, Recent
Decisions, KI-038 baru), `DECISIONS.md` + `decisions/ADR-096-*.md` (ADR
baru).

---

## 2026-08-28 — Follow-up PR #94: sisa drift setelah ganti base ke staging

### Fixed

* `context/ctx-technical-context.md` — kalimat Light/Dark Mode Toggle yang masih merujuk "neutral theme ini" diselaraskan ke Stone theme Astryx (ADR-087).
* `project-manager/PROJECT_STATE.md` — Current Focus Draft Editor yang masih menulis "modal fullscreen" diselaraskan ke default Standard (ADR-065), Fullscreen via toggle (ADR-052).

---

## 2026-08-28 — Docs Consistency Audit (scope: all) + Perbaikan Temuan Kelas A/B

### Context

King Rezi menjalankan `/docs-consistency-audit for all` — audit menyeluruh atas `project-manager/`, `context/`, dan `product-discovery/` (~160 file termasuk 95 ADR). Dieksekusi via 7 subagent paralel (3 batch ekstraksi ADR, 1 untuk `context/`, 2 untuk `product-discovery/`, 1 untuk status/hitungan `project-manager/`), disintesis jadi laporan tunggal, lalu King Rezi mengonfirmasi seluruh temuan Kelas A untuk diperbaiki + 2 temuan Kelas B (F20, F21).

### Fixed — Status/Hitungan Drift

* `TASKS.md` — catatan T-089.6 diupdate (KI-034 sudah Resolved, bukan lagi "belum lewat QA formal").
* `tasks/v02-publishing-mvp.md` — field Depends T-030 diupdate: T-033 sudah ✅ Done tapi tidak menambahkan entry point Cancel Schedule di Calendar (bukan lagi diblokir T-033).
* `PROJECT_STATE.md` — hitungan task 72→77 (sinkron dengan `TASKS.md`), Top Next Tasks ditambah T-093, deskripsi tema Astryx di "Current Focus" diperbaiki (Stone, bukan neutral, ADR-087).
* `ARCHITECTURE_OVERVIEW.md` — tabel Environment Topology diupdate (local menumpang staging, ADR-081), rentang ADR di "Source of Truth (Detail)" digeneralisasi (bukan lagi "s/d ADR-040" yang stale).

### Fixed — ADR Amendment Belum Tercermin di Baseline

* `realtime-strategy.md` — ditambahkan section baru "Perluasan ke `publishing_posts` (ADR-094)": channel per-workspace, granular client-side patch, RLS baru, dependency T-036; RT-D09 ditambahkan ke Decision Log.
* `integration-layer.md` — ditambahkan catatan promosi `IOutstandAdapter` ke `packages/shared/src/contracts/` (ADR-079); referensi `OutstandJobId` basi diganti `outstandPostId`/`platformPostId` (ADR-092).
* `database-strategy.md` — Related Documents diberi penanda deprecated untuk `publishing_queue_slots` (konsisten dengan badan dokumen, ADR-083).
* `dependency-strategy.md`, `monorepo-setup.md`, `06-engineering/README.md`, `ctx-development.md`, `ctx-implementation.md`, `ctx-technical-context.md` — requirement/frasa StyleX ("hindari pada tahap awal") diperbaiki jadi "dihapus total, permanen" (ADR-082); referensi `theme-neutral` diganti `theme-stone` (ADR-087) di seluruh file ini plus `design-tokens.md` (4 lokasi) dan tabel dependency-strategy.md.
* `dx-tooling.md`, `database-orm.md` — referensi project lokal terpisah `social-media-local` diperbaiki jadi "menumpang project staging" (ADR-081) di seluruh lokasi (tabel stack, script `db:migrate`, setup checklist, Related Documents).
* ADR-072, ADR-036 (file + indeks `DECISIONS.md`) — Status header dilengkapi ("Amended by ADR-080" dan "Addendum by ADR-041").

### Fixed — Terminologi & Referensi Mati

* `key-screen-patterns.md` § KSP-05 — 2 bagian (Identitas, Zona Fungsional) yang masih bilang variant Dialog "belum difinalkan, fullscreen default" diperbaiki jadi konsisten dengan `navigation-patterns.md` NP-D11: **Standard** adalah default final (ADR-065), Fullscreen alternatif via toggle.
* `ux-principles.md` — rujukan mati `CHANGELOG.md` (sudah dikonsolidasi ke `COMPLETE_TASK.md` sejak ADR-061) diperbaiki.

### Fixed — Pelanggaran Source of Truth (status di baseline doc)

* `success-metrics.md` — baris "Phase: Product Validation" (klaim fase proyek eksplisit di baseline) dihapus, diganti catatan pointer ke `PROJECT_STATE.md`.
* `code-conventions.md` — temuan review Ridwan (gap `try/catch`/`toActionError`) yang tertanam tanpa pointer diganti rujukan ke `PROJECT_STATE.md` § KI-036 (CC-D02).
* `pricing-strategy.md`, `mvp-definition.md`, `design-tokens.md` — field "Status: Draft/Baseline v1.0" level dokumen dihapus/disederhanakan atas keputusan eksplisit King Rezi (F20).

### Fixed — Drift Penamaan Fitur (F21, diinvestigasi mandiri atas permintaan King Rezi)

* `mvp-definition.md` diselaraskan dengan `feature-priority.md`: "AI Rewrite"→"Tone Rewrite", "Custom Analytics"→"Custom Reports", "AI Performance Insight"→"AI Performance Suggestions"; ditambahkan item yang sebelumnya cuma ada di salah satu dokumen ("Workspace Branding" ke `mvp-definition.md`; "AI Insights", "Team Activity Feed", "Hashtag Suggestions" ke `feature-priority.md`).

### F22 — Resolved (follow-up sesi yang sama, setelah dibahas)

Ambiguitas scope "Approval Workflow" (Could Have di `mvp-definition.md`) vs
"Advanced Approval Workflow" (Won't Have di `feature-priority.md`) vs UXP-06
("jangan approval berlapis") dibahas dan diputuskan: King Rezi mengonfirmasi
struktur role dipertahankan seperti sekarang — semua role (termasuk Creator,
role terbawah) tetap bebas Schedule/Publish sendiri tanpa gate approval dari
role lain (`roles-permissions.md`), konsisten dengan UXP-06 dan
`feature-priority.md`. `mvp-definition.md` diperbaiki: "Approval Workflow"
dihapus dari Could Have, dipindah ke Out of Scope dengan catatan alasan
(gate berlapis ditolak eksplisit oleh UXP-06; status konten `In
Review`/`Ready to Schedule` tetap Must Have sebagai label koordinasi
ringan, bukan gate).

---

## 2026-08-28 — ADR-095 Follow-up: 2 Custom ESLint Rule Menutup Known Limitation

### Context

Setelah PR #93 (ADR-095) dibuka, King Rezi menanyakan detail 2 known limitation yang didokumentasikan (`no-restricted-imports` tidak menjangkau dynamic import; `tailwindcss/no-arbitrary-value` tidak menjangkau arbitrary-value di variabel terpisah), lalu meminta keduanya ditutup dengan custom rule.

### Added

* `eslint.config.mjs` — 2 custom rule lokal (plugin inline, tanpa dependency baru): `local/no-dynamic-restricted-import` (block dynamic `import("@prisma/client")` dkk di domain layer, scope sama dengan `no-restricted-imports`) dan `local/no-arbitrary-value-in-variable` (block arbitrary-value Tailwind yang disimpan di `const`/assignment terpisah, scope sama dengan `tailwindcss/no-arbitrary-value`).

### Fixed

* `ChannelsSection.tsx` — `TRANSITION_FAST` (satu-satunya instans di seluruh codebase yang match pola ini, dikonfirmasi grep menyeluruh) sekarang tertangkap rule baru, diberi `eslint-disable-next-line local/no-arbitrary-value-in-variable` karena token-backed CSS var (legit, bukan magic number).
* `project-manager/decisions/ADR-095-*.md` — section Decision poin 6 diupdate: 2 known limitation sebelumnya sekarang dicatat sebagai closed via custom rule, dengan catatan sisa limitation (re-export pass-through tidak langsung tetap tidak terjangkau, butuh analisis lintas-file).

### Verification

Rule diverifikasi bekerja lewat probe file nyata (dynamic import ke `@prisma/client` di domain layer → tertangkap, file dihapus lagi setelah diverifikasi). `bun run lint`/`typecheck`/`test` — semua hijau: 0 error, 209 test passed/3 skipped.

---

## 2026-08-28 — ADR-095 Baseline Rendering Strategy, Code Conventions, Spacing Scale + ESLint Enforcement

### Context

King Rezi meminta "codify coding discipline" — menuliskan konvensi rendering, error handling, dan spacing yang sudah konsisten dipakai di kode nyata (Server Actions 100% mutation-only via `actions.ts`, hierarki error `AppError`/`ApplicationError`/`XxxDomainError`/`toActionError`, spacing 100% prop numerik Astryx kecuali 2 baris exception) sebagai baseline resmi, sekaligus menutup `TBD` skala Spacing yang menggantung sejak ADR-038, dan menambah enforcement tooling ESLint untuk mencegah drift ke depan.

### Added

* `product-discovery/06-engineering/rendering-strategy.md` — baru. Baseline rendering strategy Next.js (Server Component vs Client, Server Actions = mutation only/RS-D02, streaming, SSR/SSG/ISR).
* `product-discovery/06-engineering/code-conventions.md` — baru. Baseline naming convention + hierarki error handling (`AppError`/`ApplicationError`/`XxxDomainError`/`toActionError`, CC-D01/CC-D02).
* `project-manager/decisions/ADR-095-baseline-rendering-strategy-code-conventions-spacing-scale-server-actions-mutation-only.md` — baru, ADR lengkap. Indeks ditambahkan di `project-manager/DECISIONS.md` (baris paling atas, sebelum ADR-094).
* **T-094** (`tasks/v01-foundation.md`, sibling T-001/T-002, domain `platform/tooling`) — task baru untuk mencatat deliverable ADR-095, ditutup `✅ Done` (4 subtask: 3 selesai + 1 dibiarkan terbuka, cleanup dashboard, lihat KI-036). `TASKS.md` diperbarui: indeks v0.1 22→23 task (11✅→12✅), Total 76→77 task/23→24 selesai/169→173 subtask.
* **KI-036** (`PROJECT_STATE.md`) — dashboard (`app/(app)/page.tsx`) fetch data lewat Server Action, menyimpang RS-D02; Tech-Debt, tidak urgent, terkait ADR-095 + T-094.
* **KI-037** (`PROJECT_STATE.md`) — `design-tokens.md` section Spacing baru dikunci, belum disinkronkan ke Claude Design (pola reminder ADR-056); Process, terkait ADR-095 + ADR-056.

### Changed

* `product-discovery/06-engineering/design-tokens.md` — section Spacing dikunci (sebelumnya `TBD` sejak ADR-038): base 1 unit Astryx = 4px, skala terpakai 0/0.5/1/1.5/2/3/4/5/6/8 (0–32px) + panduan semantik penggunaan. Section Radius/Elevation tidak berubah, tetap `TBD`.
* `context/ctx-development.md`, `context/ctx-implementation.md`, `AGENTS.md` — pointer/index ditambahkan ke 2 dokumen baseline baru di atas.
* `eslint.config.mjs` — 3 rule baru: `no-restricted-imports` di `apps/web/src/domains/**` (block `@prisma/client`, `@supabase/supabase-js`, import langsung `lib/repositories/**`/`lib/adapters/**`/`**/generated/**`, menegakkan AGENTS.md rule 6), `no-restricted-syntax` (block `<div>` mentah di `apps/web/src/app/**/*.tsx` dan `apps/web/src/components/**/*.tsx`), `tailwindcss/no-arbitrary-value: "error"` (sebelumnya `off`). 6 lokasi arbitrary-value token-backed existing (`ChannelsSection.tsx`, `ConnectedAccountsList.tsx`) diberi `eslint-disable-next-line` + komentar alasan. Diverifikasi 0 pelanggaran sebelum diaktifkan sebagai `"error"`.

### Known deviation (sengaja tidak diperbaiki)

`apps/web/src/app/(app)/page.tsx` (dashboard) mengambil data lewat Server Action (`getDashboardSummaryAction`) untuk pure read — seharusnya panggil Application Service langsung dari Server Component seperti `apps/web/src/app/(app)/publish/calendar/page.tsx` (pola benar sesuai AGENTS.md rule 5 dan RS-D02). Diakui sebagai exception pra-existing di ADR-095, sengaja tidak diperbaiki sebagai bagian ADR ini — dicatat KI-036 + subtask terbuka T-094.4.

### Fixed (setelah review arsitektur Ridwan)

Ridwan Architecture Reviewer (read-only) menemukan 6 temuan atas perubahan
di atas — 4 langsung diperbaiki di sesi yang sama, 2 didokumentasikan
sebagai known limitation (tidak ada mitigasi otomatis tersedia):

* **Diperbaiki** — `eslint.config.mjs`: pattern `no-restricted-imports`
  domain layer bolong untuk `**/lib/prisma/**` dan `**/lib/supabase/**`
  (celah nyata dibuktikan Ridwan via probe file, sudah dihapus lagi) —
  ditambahkan ke `patterns`. Diverifikasi ulang: masih 0 pelanggaran.
* **Diperbaiki** — komentar jumlah arbitrary-value di `eslint.config.mjs`
  dikoreksi (sebelumnya "6", akurat "5 diberi disable comment, 2 lagi di
  `TRANSITION_FAST` tidak terjangkau rule sama sekali").
* **Diperbaiki** — `rendering-strategy.md`: klaim "0 `use client` di
  page.tsx/layout.tsx" salah — `settings/account/preferences/page.tsx`
  adalah exception yang tidak tercatat. Teks dikoreksi + dicatat sebagai
  known exception.
* **Diperbaiki** — `code-conventions.md` + `ADR-095`: klaim `toActionError`
  "sudah dipakai konsisten" dikoreksi — 3 file (`draft-editor/actions.ts`,
  `settings/account/actions.ts`, `onboarding/components/actions.ts`) belum
  migrasi, dicatat sebagai technical debt pra-existing.
* **Didokumentasikan sebagai known limitation** (tidak diperbaiki, bawaan
  keterbatasan rule) — `no-restricted-imports` tidak menjangkau dynamic
  import/re-export pass-through; `tailwindcss/no-arbitrary-value` tidak
  menjangkau arbitrary-value yang disimpan di konstanta string terpisah
  (contoh nyata: `TRANSITION_FAST`). Keduanya butuh custom ESLint rule
  untuk ditutup sepenuhnya — di luar scope sesi ini.

### Verification

`bun run lint` / `typecheck` / `test` — semua hijau: 0 error, 209 test passed / 3 skipped. Diverifikasi ulang setelah fix di atas, tetap hijau.

### Files

* `product-discovery/06-engineering/rendering-strategy.md` (baru)
* `product-discovery/06-engineering/code-conventions.md` (baru)
* `product-discovery/06-engineering/design-tokens.md` (section Spacing)
* `project-manager/decisions/ADR-095-baseline-rendering-strategy-code-conventions-spacing-scale-server-actions-mutation-only.md` (baru)
* `project-manager/DECISIONS.md` (baris index ADR-095)
* `context/ctx-development.md`, `context/ctx-implementation.md`, `AGENTS.md` (pointer)
* `eslint.config.mjs` (3 rule baru) + 2 file kode (`ChannelsSection.tsx`, `ConnectedAccountsList.tsx`, disable-comment)
* `project-manager/tasks/v01-foundation.md` (T-094 baru)
* `project-manager/TASKS.md` (indeks v0.1, Total, footnote ¹)
* `project-manager/PROJECT_STATE.md` (KI-036, KI-037, Recent Decisions, Completed Ringkasan, Metadata)

### Status

ADR-095 Accepted. T-094 `✅ Done` (1 subtask terbuka, tidak memblokir). KI-036 dan KI-037 `Open`, tidak memblokir M8.

---

## 2026-08-28 — ADR-094 Realtime Calendar + T-033 ditutup Done (T-033.7 dibatalkan)

### Context

Lanjutan diskusi ADR-093 (Import Posts) — King Rezi kembali ke rencana Realtime Calendar (opsi 1 dari diskusi awal sesi) dan meminta draft ADR untuk itu. Investigasi arsitektur menemukan 2 hal penting: (1) tidak ada Realtime subscription yang benar-benar hidup di aplikasi ini sekarang (T-036, satu-satunya konsumen bridge Better Auth↔Supabase JWT, masih Not Started); (2) RLS policy server-side existing (`current_setting`) tidak berlaku untuk koneksi Realtime client (butuh `auth.uid()`). Setelah ADR-094 disetujui, King Rezi menanyakan nasib T-033.7 (manual refresh control, sudah blocked karena tidak ada rancangan Claude Design) — apakah dihapus atau tetap dikerjakan mengingat Realtime akan menggantikan fungsi utamanya.

### Decisions

* **ADR-094** dibuat dan **Accepted**: mengamandemen RT-D01/RT-D02 (`realtime-strategy.md`) — tabel `publishing_posts` ditambahkan sebagai target Supabase Realtime kedua setelah `notifications`, khusus 4 screen Publish (Calendar, Queue, Drafts, History — History belum dibangun, wajib menyertakan pola ini sejak desain T-034). Channel per-workspace (`publishing_posts:{workspaceId}`, event INSERT/UPDATE, filter `workspace_id`), butuh RLS policy baru berbasis `auth.uid()` (varian baru dari RLS Policy Pattern, terpisah dari policy server-side yang sudah ada). Strategi update **granular client-side patch** (dipilih King Rezi meski lebih kompleks dari full `router.refresh()`, demi tidak mereset state lokal tiap screen) — tiap screen simpan state list sendiri, saat event masuk fetch 1 record termapping lalu upsert/remove ke local state; event echo dari aksi sendiri diproses sama (idempoten). **Hard dependency ke T-036** — wiring generic Supabase Realtime + JWT bridge dibangun di T-036 dulu (scope lebih kecil, sudah di backlog), fitur ini reuse, bukan jalan paralel/duluan.
* Setelah ADR-094 disetujui, King Rezi memutuskan **T-033.7 dibatalkan total** (bukan didesain ulang jadi fallback seperti yang sempat saya usulkan) — Realtime akan menangani sinkronisasi Calendar, tombol refresh manual berdiri sendiri dianggap tidak perlu lagi. Subtask ditandai `[x]` dengan strikethrough + alasan (pola sama T-018.1/.2), **bukan dihapus** (ID tidak didaur ulang). Scope-nya sengaja **tidak** dipindah ke task Realtime baru — kalau dibutuhkan lagi nanti (mis. fallback recovery), jadi task baru dengan ID sendiri.
* **T-033 ditutup `✅ Done`** — seluruh 8 subtask tertutup (7 diimplementasikan + 1 dibatalkan by design). Data Calendar untuk saat ini tetap manual-refresh apa adanya (tanpa tombol eksplisit) sampai task dari ADR-094 diimplementasikan.
* `TASKS.md` diperbarui: v0.2 breakdown 8✅·2🟡·11⏳ → **9✅·1🟡·11⏳** (T-030 tetap satu-satunya 🟡), total selesai 22→**23**. Task baru untuk ADR-094 **belum** ditulis ke `TASKS.md`/`tasks/v02-publishing-mvp.md` — menunggu sesi berikutnya.

### Files

* `project-manager/decisions/ADR-094-perluasan-supabase-realtime-publishing-posts-granular-patch.md` (baru)
* `project-manager/DECISIONS.md` (baris index ADR-094)
* `project-manager/tasks/v02-publishing-mvp.md` (T-033 status → Done, T-033.7 dibatalkan, catatan penutup)
* `project-manager/TASKS.md` (indeks release v0.2, Total, blok Fokus sekarang)

### Status

ADR-094 Accepted. T-033 `✅ Done`. Task implementasi dari ADR-094 (Realtime Calendar/Queue/Drafts/History) belum ditulis ke backlog — masih perlu sesi lanjutan.

### Lanjutan (sesi sama) — T-092 ditulis ke backlog

King Rezi minta lanjut menulis task implementasi ADR-094. **T-092 · Realtime Calendar/Queue/Drafts/History via Supabase Realtime** ditambahkan ke `tasks/v02-publishing-mvp.md` (6 subtask: T-092.1 RLS policy `auth.uid()`, T-092.2 wiring channel per-workspace reuse T-036, T-092.3–.5 granular patch Calendar/Queue/Drafts, T-092.6 granular patch History depends T-034). `Depends: T-036` (hard dependency, ADR-094 poin 4). ID global berikutnya setelah T-091 (nomor kosong v0.2 sudah habis, pola sama T-039/T-089/T-090/T-091). `TASKS.md` diperbarui: v0.2 21→22 task (breakdown 9✅·1🟡·12⏳), total 74→75 task, 159→165 subtask.

**Files tambahan:** `project-manager/tasks/v02-publishing-mvp.md` (section baru "Realtime Collaboration" T-092, Catatan Rilis diperbarui), `project-manager/TASKS.md` (indeks v0.2, Total).

**Status akhir:** ADR-093, ADR-094 Accepted. T-033 Done. T-090/T-091/T-092 `⏳ Not Started`, siap dikerjakan sesuai urutan dependency (T-092 menunggu T-036).

### Lanjutan lagi (sesi sama) — T-093 ditambahkan, rantai dependency dikoreksi

King Rezi mengoreksi rantai: sebelum T-036 → T-092, seharusnya ada **invite (add user to workspace) → user role** dulu. Investigasi menemukan halaman accept-invite (`/invite/[token]`) memang **belum pernah dibuat sama sekali** — gap yang sudah dicatat CodeRabbit di PR #73 (2026-08-14, ADR-080) sebagai "future work terpisah, belum ada nomor T-XXX", tapi tidak pernah dikonversi jadi task resmi sampai sekarang. Diklarifikasi ke King Rezi apakah "invite" dan "role" itu 1 atau 2 task — dipilih **1 task** dengan beberapa subtask (role sebenarnya sudah otomatis ter-assign dari invitation yang dibuat T-007.6, bukan langkah terpisah secara teknis).

**T-093 · Accept Invite page** ditambahkan ke `tasks/v01-foundation.md` (setelah T-007, domain `workspace`) — 4 subtask: route `/invite/[token]` + validasi token, buat akun/login via Better Auth (email-bound), insert `workspace_members` dengan role dari invitation, dan verifikasi/hardening RBAC end-to-end dengan akun real kedua (menutup gap QA T-008 yang sebelumnya cuma bisa diverifikasi via code review karena dev DB cuma 1 member). Tidak ada ADR baru — murni menutup gap yang sudah didokumentasikan ADR-072/080.

**Dependency chain diperbaiki:** T-036 (`tasks/v02-publishing-mvp.md`) sekarang `Depends: T-026, T-093`. Rantai lengkap: **T-093 → T-036 → T-092**. T-093 ditambahkan ke tabel "Fokus sekarang" `TASKS.md` sebagai root chain baru — tidak ada blocker eksternal (beda dari T-025 yang terhenti kredensial), bisa dikerjakan kapan saja.

**Files:** `project-manager/tasks/v01-foundation.md` (T-093 baru, Catatan Rilis), `project-manager/tasks/v02-publishing-mvp.md` (Depends T-036 ditambah), `project-manager/TASKS.md` (indeks v0.1, Total, Fokus sekarang, footnote ¹).

**Status akhir sesi:** v0.1 22 task (11✅·1🚫·6🟡·1⏸️·3⏳), v0.2 22 task (9✅·1🟡·12⏳). Total 76 task/169 subtask, 23 selesai. Rantai penuh menuju Realtime Calendar: T-093 → T-036 → T-092, ketiganya `⏳ Not Started`.

---

## 2026-08-28 — ADR-093 Import Posts + task T-090/T-091 ditambahkan ke backlog

### Context

Diskusi berawal dari perbandingan kode vs Claude Design untuk T-033 (Calendar), lalu meluas ke pertanyaan King Rezi soal fitur realtime ala Buffer (dua user melihat perubahan draft/schedule secara live). Investigasi arsitektur (`realtime-strategy.md`, RT-D01/RT-D02) mengonfirmasi Content Calendar saat ini manual-refresh, dan data post kita sendiri (Supabase/Prisma) adalah source of truth — Outstand cuma perantara publish via ACL. King Rezi lalu menemukan dokumentasi Outstand punya endpoint berbayar `POST /v1/social-accounts/{id}/imports` untuk menarik post yang dibuat langsung di platform (di luar tool kita), dan meminta ini dibangun sebagai fitur terpisah dari rencana Realtime Calendar (yang belum punya ADR sendiri, belum dieksekusi).

### Decisions

* **ADR-093** dibuat dan **Accepted**: status domain baru `ContentStatus.Imported` (terminal, immutable, read-only via guard repository), tampil di Calendar & History. Tiga jalur trigger — otomatis saat connect (sekali), periodik (Railway Cron harian, pola JOB-04), manual dari Settings "Sync Now" — ketiganya pakai watemark `lastImportedUntil` (kecuali trigger awal) supaya tidak mengulang seluruh rentang tiap kali. Dua job baru: `JOB-05` (trigger `import.sync`) dan `JOB-06` (processing webhook `import.completed`/`import.failed`, pola JOB-01). Guard concurrent-import per akun + **3 lapis pengaman biaya** khusus jalur manual (karena endpoint ini berbayar, kekhawatiran eksplisit King Rezi): RBAC Owner/Admin (reuse hak existing "kelola Connected Accounts", tanpa aturan baru), cooldown 24 jam per akun, dan cap **1x/minggu per workspace** (dihitung dari tabel `background_jobs` yang sudah ada sebagai audit log, tanpa skema counter baru — cap ini paling dominan, jauh lebih ketat dari cooldown). `PublishingPost.authorId` jadi nullable (null hanya untuk `Imported`). `FakeOutstandAdapter.importPosts` dipakai dulu (pola ADR-059) karena `OUTSTAND_API_KEY` asli belum ada.
* Ditemukan sekaligus (di luar scope ADR-093, sengaja ditrack terpisah): post `Published`/`Failed` yang dikirim lewat tool kita sendiri saat ini masih bisa dibuka ke Draft Editor lewat CTA di `CalendarPostPopover.tsx` — seharusnya read-only juga begitu sudah live di platform. Bukan bagian ADR-093 (beda kebutuhan RBAC/asal-usul dari `Imported`), jadi jadi task independen T-091.
* Dua task baru ditulis ke `TASKS.md` + `tasks/v02-publishing-mvp.md`: **T-090** (Import Posts, 5 subtask, ADR-093) dan **T-091** (read-only enforcement Published/Failed, 2 subtask, bug-fix tanpa ADR baru). Nomor kosong v0.2 (T-020–T-038) sudah habis sejak T-039 dipinjam v0.1, jadi keduanya memakai ID global berikutnya yang belum pernah dipakai (090, 091), pola sama T-039/T-089. Index `TASKS.md` diperbarui: v0.2 19→21 task, total 72→74 task/152→159 subtask; sekaligus dikoreksi drift breakdown status v0.2 (8✅·1🟡·10⏳ yang sudah tidak cocok dengan file aktual → 8✅·2🟡·11⏳, T-030 dan T-033 sama-sama In Progress).
* Kedua task (T-090.5 UI Import + T-091.2 UI read-only Popover) di-gate rule 17 `AGENTS.md` — belum boleh dikode sampai rancangannya dikonfirmasi di Claude Design; tidak ada mockup sama sekali untuk kartu `Imported` maupun state read-only Popover saat ini.
* Rencana Realtime Calendar (opsi Supabase Realtime ke `PublishingPost`, dibahas sebelum ADR-093) **belum** dituangkan jadi ADR/task — masih diskusi terbuka, disengaja dipisah dari sesi ini atas permintaan King Rezi ("jangan digabung dulu").

### Files

* `project-manager/decisions/ADR-093-import-posts-dari-social-account-status-imported-read-only.md` (baru)
* `project-manager/DECISIONS.md` (baris index ADR-093)
* `project-manager/tasks/v02-publishing-mvp.md` (section baru "Import" T-090, "Read-Only Enforcement" T-091, Catatan Rilis diperbarui)
* `project-manager/TASKS.md` (indeks release v0.2, Total, footnote ¹)

### Status

ADR-093 Accepted, T-090/T-091 `⏳ Not Started` — belum ada implementasi kode. Realtime Calendar masih diskusi, belum jadi ADR/task.

---

## 2026-08-27 — Polishing UI grid Calendar (Month & Week) sebelum T-033.7

### Context

Polishing/revisi UI di atas **T-033.1–.6 & T-033.8** (Calendar view, domain
`publishing`, `project-manager/tasks/v02-publishing-mvp.md` § T-033) yang
sudah `[x]` sebelumnya — **bukan** subtask baru, tidak mengubah checklist
task. Dilakukan sebelum T-033.7 (manual refresh control), yang tetap
**tidak** tersentuh sesi ini (masih blocked, tidak ada rancangan di Claude
Design). Branch `feature/calendar-design-system`, 2 commit: `ab1932f` dan
`8bba7ae`.

### Perubahan

Semua file di
`apps/web/src/app/(app)/publish/calendar/components/`:

- `CalendarMonthGrid.tsx`, `CalendarWeekGrid.tsx`, `calendar-grid-shared.ts`
  (commit `ab1932f`) — fix bug CSS Grid: grid 7-kolom tidak sejajar antar
  baris (track blowout — kolom dengan card lebar "mencuri" lebar kolom
  lain), diperbaiki via `isScrollable` per sel + `StackItem size="fill"`
  untuk truncation. **Bukan** `xstyle`/StyleX Astryx seperti rencana awal —
  compiler StyleX belum ter-setup di `apps/web` (dependency ter-install,
  babel/Next.js plugin belum), dicatat sebagai **KI-035**. Redesain kartu
  post: avatar+nama akun sejajar 1 baris, waktu post pojok kanan atas
  (Month), caption full-width baris terpisah (Week), indikator tipe konten
  Post/Reel/Story/Pin (pakai field `contentFormat` yang sudah ada di
  `CalendarItemTargetRecord`/`QueueItemTargetRecord`, bukan data baru).
  Footer status+content-format di mobile (≤768px, breakpoint konsisten
  collapse point `AppShell` mobile-nav) diganti `StatusDot`+`Icon` compact
  — `Badge` Astryx tidak punya prop ukuran/truncation (dicatat di
  **KI-035**), overflow di kolom sempit; `Badge`+`Badge` tetap dipakai
  >768px.
- `CalendarPostPopover.tsx` (commit `ab1932f`) — ditambah Badge
  content-format.
- `CalendarMonthGrid.tsx`, `CalendarWeekGrid.tsx`, `calendar-grid-shared.ts`
  (commit `8bba7ae`) — garis pemisah vertikal antar kolom hari ditambahkan
  (sebelumnya cuma horizontal antar baris), warna `border-border` (sama
  border Card/ClickableCard, bukan `border-border-strong` Divider
  horizontal). Gap grid dihapus (`gap={2}`→`{0}`, semua `<Grid columns=
  {CALENDAR_DAY_COLUMNS}>`) dikompensasi padding cell dinaikkan: Week
  `padding` sel jam 1→1.5, Month `paddingInline` +2 pada VStack sel hari
  (padding uniform 1 dipertahankan sisi atas/bawah).

### Temuan/rekomendasi dicatat sebagai Known Issue (KI-035, `PROJECT_STATE.md`)

Bukan blocker M8, tidak ada keputusan arsitektur final jadi belum layak
ADR — murni catatan referensi ke depan:

1. StyleX ter-install sebagai dependency tapi compiler-nya belum ter-setup
   di `apps/web` — kalau ke depan butuh `xstyle` Astryx (jalur resmi CLI
   untuk override track template `Grid` dkk), harus disetup dulu.
2. `Badge` Astryx tidak punya prop `size`/truncation — `StatusDot` dipakai
   sebagai alternatif compact di Calendar mobile, beda pola dari `Badge`
   yang dipakai Queue/Draft; perlu keputusan konsistensi kalau mau
   diperluas ke UI lain.
3. Layout Calendar di viewport sangat sempit (~375px, grid 7-kolom fixed)
   masih padat — perbaikan lanjutan (mis. tampilan agenda/list khusus
   mobile) butuh rancangan baru di Claude Design dulu (rule 17
   `AGENTS.md`), bukan sekadar tweak CSS lagi.

### Verifikasi

Verifikasi manual browser (perubahan murni CSS/layout, tidak menyentuh
domain/data-wiring — review arsitektur Ridwan & QA formal Najwa tidak
dijalankan untuk sesi ini). Kode sudah di-push ke
`feature/calendar-design-system` (commit `ab1932f`, `8bba7ae`).

---

## 2026-08-27 — T-033.8 Popover ringkasan post + CTA Draft Editor Calendar view selesai

### Context

Implementasi kode **T-033.8** (klik item Calendar → Popover ringkasan post +
CTA buka Draft Editor, `project-manager/tasks/v02-publishing-mvp.md` §
T-033, domain `publishing`), branch `feature/calendar-design-system`.
Direview arsitektur oleh Ridwan Architecture Reviewer (tanpa temuan) dan
lolos QA Najwa QA Engineer (tanpa bug fungsional; satu catatan inconclusive
soal tooling emulasi mobile viewport, bukan bug aplikasi). **T-033.7**
(manual refresh control) **TIDAK** dikerjakan sesi ini — di-STOP karena
tidak ada rancangannya sama sekali di Claude Design (AGENTS.md rule 17),
menunggu konfirmasi desain dari King Rezi.

### Perubahan

Semua file di `apps/web/src`, kecuali disebutkan lain:

- `app/(app)/publish/calendar/components/CalendarPostPopover.tsx` (BARU) —
  client component, Astryx `Popover` (BUKAN HoverCard, ADR-090/ADR-091),
  controlled `isOpen` lokal per kartu. Isi: header account+platform,
  avatar+status chip, caption, media placeholder (domain belum punya field
  media), 4 tile metrik untuk status Published (Views→`impressions`,
  Reach→`reach`, Replies→`comments`, Eng. Rate→`engagementRate`, format
  "–" kalau belum ada data), link "Go to post" (kalau `platformPostUrl`
  ada), CTA "Buka Draft Editor" (reuse `useDraftEditor().openEditDraft`,
  pola sama Queue).
- `app/(app)/publish/calendar/components/CalendarWeekGrid.tsx` dan
  `CalendarMonthGrid.tsx` — TODO/no-op `onClick` sebelumnya diganti wrap
  `ClickableCard` dengan `CalendarPostPopover`.
- `domains/publishing/repositories/publishing.repository.ts` — interface
  baru `CalendarItemTargetRecord extends QueueItemTargetRecord` + field
  `platformPostUrl: string | null` (dari `PublishingPostTarget.platformPostUrl`,
  kolom Prisma yang sudah ada tapi belum pernah di-expose ke domain — bukan
  migrasi baru).
- `lib/repositories/publishing/publishing.repository.ts` —
  `mapCalendarItem` memetakan `platformPostUrl`.
- `app/(app)/publish/calendar/page.tsx` — composition root sekarang
  instansiasi `AnalyticsService` dan pass sebagai `PostMetricsPort` ke
  `PublishingService` (sebelumnya tanpa argumen kedua, jadi `metrics`
  selalu kosong) — supaya metrik Published benar-benar terisi.
- `app/(app)/publish/calendar/components/calendar-grid-shared.ts` —
  `CalendarCardEntry` (kartu per-target) diperluas `connectedAccountId`,
  `metrics: PostMetricsRecord | null` (dicocokkan per
  `connectedAccountId` target), `platformPostUrl: string | null` di
  `flattenCalendarItemsToEntries`.
- `domains/publishing/services/publishing.service.test.ts` — fixture
  disesuaikan dengan field baru.

### Verifikasi

`bun run typecheck`, `bun run lint`, `bun run test` (root) — semua
bersih/pass (209 test pass, 3 skipped; tidak ada test baru ditambah —
pola project ini tidak unit-test file di folder "components" app-router,
cek lewat browser preview manual sebagai gantinya, konsisten T-033.3–.6).
Review arsitektur Ridwan — tanpa temuan. QA manual (main agent + Najwa):
Week & Month view, popover Scheduled & Published, exclusivity/dismiss
(klik kartu lain/klik luar/Escape), regresi toolbar (navigasi/filter),
regresi Queue & Drafts (tetap langsung buka Draft Editor tanpa Popover —
scope Popover khusus Calendar), dark mode, multi-target post (2 kartu
platform berbeda dari 1 post — data tidak tertukar) — semua pass. Satu
catatan non-blocking: emulasi mobile viewport di tooling browser pane
sempat tidak stabil saat QA (bukan bug aplikasi, inconclusive) — follow-up
verifikasi manual opsional, bukan bug tercatat.

### Scope belum dikerjakan (sengaja, bukan bug)

**T-033.7** (manual refresh control) — **blocked**, tidak ada rancangan
sama sekali di Claude Design, menunggu King Rezi membuat/mengonfirmasi
desain (AGENTS.md rule 17). Status task-level **T-033** tetap
`🟡 In Progress`.

---

## 2026-08-27 — T-033.5/.6 Navigasi periode + filter status/Channels Calendar view selesai

### Context

Implementasi kode **T-033.5** (navigasi periode: tombol Today, ‹ › prev/next,
label periode termasuk format lintas-bulan untuk Week, toggle Minggu/Bulan)
dan **T-033.6** (filter status post dropdown + filter Channels/akun di atas
grid) untuk Calendar view (`/publish/calendar`,
`project-manager/tasks/v02-publishing-mvp.md` § T-033, domain `publishing`),
branch `feature/calendar-design-system`. Direview arsitektur oleh Ridwan
Architecture Reviewer (tanpa temuan) dan lolos QA Najwa QA Engineer (golden
path + regresi pass).

### Perubahan

Semua file di `apps/web/src`:

- `domains/publishing/services/parse-calendar-view-state.ts` —
  `CalendarViewState` diperluas: `statuses: ContentStatus[]`,
  `connectedAccountIds: ConnectedAccountId[]`, parsing dari query param
  `status`/`accounts` (comma-separated, drop token invalid diam-diam).
- `domains/publishing/services/parse-calendar-view-state.test.ts` — test
  baru untuk parsing status/accounts, semua pass.
- `app/(app)/publish/calendar/page.tsx` — memanggil
  `WorkspaceService.listConnectedAccounts` (cross-domain via public API
  `@/domains/workspace`, pola sama `draft-editor/actions.ts`) untuk opsi
  filter Channels, meneruskan `statuses`/`connectedAccountIds` ke
  `PublishingService.listCalendarPosts`.
- `app/(app)/publish/calendar/hooks/useCalendarPeriodState.ts` —
  `setPeriod` diperluas untuk update `statuses`/`connectedAccountIds` di
  URL (dihapus dari URL kalau array kosong, bukan `status=` kosong).
- `app/(app)/publish/calendar/components/CalendarToolbar.tsx` (BARU) —
  client component: Today/‹/›, label periode, toggle Minggu/Bulan, filter
  status (7 opsi: All Posts + 6 `ContentStatus`, reuse
  `CONTENT_STATUS_LABEL`), filter Channels (Semua Akun + akun asli
  workspace). Semua Astryx (`Button`, `IconButton`, `Selector`).
- `app/(app)/publish/calendar/components/calendar-grid-shared.ts` —
  tambah `addMonths(date, months)` pure function.
- `app/(app)/publish/calendar/components/CalendarScreen.tsx` — render
  `CalendarToolbar` di atas grid, terima prop baru
  `accounts: ConnectedAccountRecord[]`.
- `app/(app)/publish/calendar/components/CalendarMonthGrid.tsx` —
  tambahan di luar scope asli T-033.5/.6 tapi ditemukan Najwa saat QA:
  Month view sebelumnya tidak punya `EmptyState` saat filter menghasilkan
  0 post (beda dengan Week view yang sudah punya sejak T-033.3). Sudah
  ditambahkan (`EmptyState` "Belum ada post di bulan ini").

### Verifikasi

`bun run typecheck`, `bun run lint`, `bun run test` (root) — semua
bersih/pass (209 test pass, 3 skipped, termasuk 2 file test Calendar).
Review arsitektur Ridwan — tanpa temuan (entry point bersih, domain logic
tanpa Prisma/Supabase, cross-domain lewat public API, shared types
konsisten). QA Najwa — semua golden path pass (navigasi lintas-bulan,
toggle Minggu/Bulan mempertahankan anchor date, filter status+akun
kombinasi, reload URL dengan query filter ter-restore benar, regresi ke
Queue/Drafts/History bersih, dark mode oke); gap kecil (EmptyState Month
view) ditemukan & ditutup di sesi yang sama, diverifikasi ulang browser.

### Scope belum dikerjakan (sengaja, bukan bug)

**T-033.7** (manual refresh control), **T-033.8** (Popover klik item +
CTA Draft Editor). Status task-level **T-033** tetap `🟡 In Progress`.

---

## 2026-08-27 — T-033.3/.4 Grid Week & Month Calendar view selesai

### Context

Implementasi kode **T-033.3** (grid Week) dan **T-033.4** (grid Month) untuk
Calendar view (`/publish/calendar`, `project-manager/tasks/v02-publishing-mvp.md`
§ T-033, domain `publishing`), branch `feature/calendar-design-system`.
Data-wiring dikerjakan Prabowo Feature Engineer, grid UI dikerjakan Mark UI
Engineer, review arsitektur oleh Ridwan Architecture Reviewer (1 temuan
duplikasi logic, diperbaiki langsung di sesi yang sama).

### Perubahan

File baru:
- `apps/web/src/domains/publishing/services/calendar-range.ts` + `.test.ts`
  — pure function domain `publishing`: `getWeekRange(date)` /
  `getMonthRange(date)`, menghitung rentang tanggal awal/akhir untuk grid.
- `apps/web/src/app/(app)/publish/calendar/components/CalendarWeekGrid.tsx`
  — grid 7 hari × 12 slot waktu (per 2 jam).
- `apps/web/src/app/(app)/publish/calendar/components/CalendarMonthGrid.tsx`
  — grid 7 hari × N minggu, padding hari di luar bulan aktif (muted), badge
  "+N More" untuk sel padat (maks 3 kartu per sel, expand di tempat —
  bukan silently truncate).
- `apps/web/src/app/(app)/publish/calendar/components/calendar-grid-shared.ts`
  — util bersama Week/Month: flatten `CalendarPostItem[]` → kartu per
  target akun, format tanggal (UTC).
- `apps/web/.claude/launch.json` — config preview dev server, ditambahkan
  untuk kebutuhan verifikasi browser Mark UI Engineer (belum ada
  sebelumnya).

File diubah:
- `apps/web/src/domains/publishing/index.ts` — tambah export
  `calendar-range` + `effectiveCalendarDate`.
- `apps/web/src/domains/publishing/services/sort-calendar-items.ts` —
  fungsi privat `effectiveDate` diekspor jadi `effectiveCalendarDate`
  (public). **Perbaikan temuan Ridwan:** sebelumnya UI (`calendar-grid-shared.ts`)
  menghitung ulang aturan "tanggal efektif" post secara terpisah dari
  domain, dengan behavior yang mulai divergen — sekarang direuse dari satu
  sumber kebenaran di domain.
- `apps/web/src/app/(app)/publish/calendar/page.tsx` — composition root
  nyata: `getWorkspaceContext` + `getCachedSession` + `getWeekRange`/
  `getMonthRange` + `PublishingService.listCalendarPosts` (tanpa
  `statuses`/`connectedAccountIds`/`PostMetricsPort` — sesuai scope; filter
  & metrics itu T-033.6/.8 terpisah).
- `apps/web/src/app/(app)/publish/calendar/components/CalendarScreen.tsx`
  — dispatcher `view === "month" ? <CalendarMonthGrid/> : <CalendarWeekGrid/>`,
  `EmptyState` placeholder (dari T-033.2) diganti grid asli.

### Verifikasi

`tsc --noEmit` bersih, `eslint` bersih (1 warning config eksisting tidak
terkait), 45 test Vitest pass, review arsitektur Ridwan clean setelah 1
fix, browser preview manual (Week & Month, data post asli, status
Scheduled/Published, badge status, padding hari muted di Month, highlight
hari-ini) OK.

### Scope belum dikerjakan (sengaja, bukan bug)

Subtask terpisah menyusul: **T-033.5** (navigasi Today/‹/›/toggle
Minggu-Bulan), **T-033.6** (filter status+akun), **T-033.7** (manual
refresh), **T-033.8** (Popover klik item + Draft Editor CTA). Status
task-level **T-033** tetap `🟡 In Progress`.

---

## 2026-08-27 — T-033.2 State periode Calendar via query param selesai

### Context

Implementasi kode **T-033.2** (state periode Calendar via query param,
`project-manager/tasks/v02-publishing-mvp.md` § T-033, domain `publishing`)
sudah selesai oleh Prabowo Feature Engineer di branch
`feature/calendar-design-system`, route tunggal `/publish/calendar` (ADR-046,
tidak menambah route baru).

### Perubahan

File baru:
- `apps/web/src/domains/publishing/services/parse-calendar-view-state.ts` —
  pure function domain `publishing` (tanpa I/O, tidak import
  Prisma/Supabase/HTTP) parsing & validasi `view`/`date` dari query param.
  Tipe `CalendarViewMode` (`"week" | "month"`), `CalendarViewState`.
- `apps/web/src/domains/publishing/services/parse-calendar-view-state.test.ts`
  — 18 test case (default, valid, invalid, case-sensitivity, duplicate query
  param/array, string kosong/whitespace, non-numeric, `Infinity`).
- `apps/web/src/app/(app)/publish/calendar/components/CalendarScreen.tsx` —
  placeholder Astryx (`Card`+`Badge`+`EmptyState`, bukan raw `<div>`)
  menampilkan state `view`/`date` ter-parse; akan digantikan grid asli di
  T-033.3/.4.
- `apps/web/src/app/(app)/publish/calendar/hooks/useCalendarPeriodState.ts` —
  fondasi client hook (`"use client"`, `usePathname`/`useRouter`/`useSearchParams`)
  untuk T-033.5 nanti: baca state via `parseCalendarViewState` yang sama +
  `setPeriod()` push ke URL via `router.replace` (bukan `push`, supaya
  toggle/navigasi periode tidak menumpuk history). Belum dipakai di UI mana
  pun — sengaja hanya fondasi, di luar scope UI T-033.2.

File diubah:
- `apps/web/src/app/(app)/publish/calendar/page.tsx` — Server Component
  tipis: `await searchParams` → `parseCalendarViewState` → render
  `CalendarScreen`. Tidak ada business logic di entry point (rule 5
  `AGENTS.md`).
- `apps/web/src/domains/publishing/index.ts` — tambah 1 baris export barrel.

Parsing & fallback:
- `view`: valid hanya kalau persis `"month"` (case-sensitive, lowercase) —
  selain itu (termasuk `"week"`, hilang, typo, casing lain seperti
  `"Month"`) → default `"week"`.
- `date`: diperlakukan sebagai epoch milliseconds. Hilang/kosong/whitespace/
  non-numeric/`Infinity`/`NaN` → default hari ini (jam server).
- Query param diulang (array, mis. `?view=week&view=month`) → ambil elemen
  pertama.

### Verifikasi

`bun run typecheck`, `bun run lint`, `bun run test` semua bersih (193
passed, 3 skipped, tidak ada regresi). Verifikasi browser end-to-end (akun
test Raka Pratama): golden path (tanpa query param → Tampilan Minggu + hari
ini), `?view=month&date=<valid>` → Tampilan Bulan + tanggal sesuai,
`?view=yearly&date=not-a-number` (invalid) → fallback benar ke default.

### Keputusan implementasi (dikonfirmasi King Rezi di sesi ini)

1. Format `date` pakai epoch milliseconds (bukan ISO string) — sesuai
   literal task `?date=<timestamp>`, tidak ada precedent lain di codebase.
2. `view` case-sensitive (lowercase only) — `?view=Month` invalid → fallback
   week. Dikonfirmasi eksplisit, tidak diubah.
3. Nama hook `useCalendarPeriodState`/method `setPeriod` — pilihan
   sementara, mudah di-rename saat T-033.5 dikerjakan karena belum ada
   consumer.

### Dokumentasi

- `project-manager/tasks/v02-publishing-mvp.md` — checkbox **T-033.2**
  ditandai selesai (`[x]`). T-033 (task-level) tetap `🟡 In Progress` —
  T-033.3–.8 masih terbuka.
- `project-manager/TASKS.md` — tidak ada perubahan angka; jumlah subtask
  T-033 tetap 8, task-level v0.2 tidak berubah.

---

## 2026-08-27 — T-033.1 Calendar query selesai

### Context

Implementasi kode `PublishingService.listCalendarPosts` (query post per
rentang tanggal + filter akun + filter status, hanya status
Scheduled/Published/Failed sesuai keputusan yang sudah dicatat di section
T-033 `tasks/v02-publishing-mvp.md`, 2026-08-26) sudah selesai, lolos test
Vitest, `tsc`/`eslint` bersih, dan sudah di-commit + push ke PR #91
(`feature/calendar-design-system` → `staging`, goal PR = T-033 penuh).

### Perubahan dokumentasi

- `project-manager/tasks/v02-publishing-mvp.md` — checkbox **T-033.1**
  ditandai selesai (`[x]`). T-033 (task-level) tetap `⏳ Not Started` /
  belum Done — T-033.2–.8 masih terbuka.
- `project-manager/TASKS.md` — tidak ada perubahan angka; jumlah subtask
  T-033 tetap 8 (tidak ada subtask ditambah/dihapus), task-level v0.2 tidak
  berubah.

---

## 2026-08-26 — Redesain kontrak ACL Outstand (ADR-092)

### Context

Ditemukan saat verifikasi gap T-033 (Calendar): setelah membaca dokumentasi
resmi Outstand API (create-a-post, get-post-details, list-posts,
get-post-analytics, post-lifecycle), kontrak `IOutstandAdapter` yang ada
sebelumnya ternyata tidak merefleksikan bentuk API asli — `create-a-post`
menerima SEMUA akun target dalam satu call dan mengembalikan satu `post.id`
(bukan satu job per akun), status per akun baru tersedia async, dan tidak
ada endpoint retry resmi.

### Perubahan

- `IOutstandAdapter.schedulePost`/`publishNow` diredesain menjadi satu call
  yang menerima `targets[]` dan mengembalikan satu `outstandPostId`.
- Method baru `fetchPostOutcome(outstandPostId)` untuk resolve status per
  akun (polling sekarang, webhook T-026 nanti tanpa rework kontrak).
- `cancelScheduledPost` sekarang dipanggil sekali per post.
- Schema Prisma: `PublishingPost.outstandPostId` (baru),
  `PublishingPostTarget.outstandJobId`/`.publishedUrl` diganti
  `.platformPostId`/`.platformPostUrl`. Migration
  `20260826092111_redesign_outstand_acl_contract` sudah diterapkan ke DB
  dev (`prisma migrate diff` bersih).
- `IPublishingRepository.markPostFailed` diperluas: transisi dari
  `Scheduled` juga didukung (sebelumnya hanya dari `Published`), karena
  1-call-semua-target berarti gagalnya schedulePost bersifat all-or-nothing.
- File yang berubah: `packages/shared/src/contracts/outstand-adapter.ts`,
  `apps/web/src/domains/publishing/adapters/outstand-adapter.ts`,
  `apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts`,
  `apps/web/src/domains/publishing/repositories/publishing.repository.ts`
  (+ implementasi Prisma), `schedule-posts.use-case.ts`,
  `publish-now.use-case.ts`, `cancel-schedule.use-case.ts`,
  `analytics-ingestion.use-case.ts` (rename parameter), Prisma schema +
  migration.

### Verifikasi

`bun run test` (179 passed, 3 skip butuh DB asli), `typecheck`, `lint`
bersih — dilakukan oleh Elon Backend Engineer di sesi ini.

### Dokumentasi

- ADR baru: **ADR-092** (`project-manager/decisions/ADR-092-redesain-kontrak-acl-outstand-1-call-semua-target-polling-outcome.md`).
- Catatan follow-up ditambahkan di task **T-034** (`tasks/v02-publishing-mvp.md`)
  soal retry manual (T-034.4) wajib mengikuti pola delete-lalu-create-ulang
  Outstand, bukan re-trigger generik.
- Gap diketahui, belum diselesaikan: bentuk hasil
  `fetchPostMetrics`/`fetchWorkspaceMetrics` (T-041) belum direvisi
  mengikuti response asli `get-post-analytics` — dievaluasi ulang saat
  T-041 disentuh lagi.

---

## 2026-08-26 — Bug fix T-029 (Publish Now) + koreksi mockup T-033 Calendar

### Context

Ditemukan saat verifikasi T-033 (Calendar): `PublishNowUseCase` tidak
pernah men-set `PublishingPost.status` jadi `Failed` walau semua target
gagal publish — melanggar aturan yang sudah ada di
`integration-layer.md:269-270,305`. Diperbaiki oleh Prabowo Feature
Engineer di sesi ini. Terpisah, King Rezi juga mengonfirmasi koreksi
mockup Claude Design untuk T-033 terkait status apa saja yang boleh
muncul di grid Calendar.

### Bug fix T-029 (Publish Now)

* Repository method baru `markPostFailed` — idempoten, hanya update
  baris yang masih status `Published` — ditambahkan ke interface
  `IPublishingRepository`
  (`apps/web/src/domains/publishing/repositories/publishing.repository.ts`)
  + implementasi Prisma
  (`apps/web/src/lib/repositories/publishing/publishing.repository.ts`).
* `apps/web/src/domains/publishing/services/publish-now.use-case.ts`:
  setelah `Promise.all` publish ke semua target selesai, kalau SEMUA
  outcome gagal → panggil `markPostFailed`. Kalau minimal satu target
  sukses (partial atau full) → tetap `Published`, tidak berubah dari
  perilaku sebelumnya.
* Test baru: 3 skenario (semua gagal, partial, semua sukses) — semua
  pass. Diverifikasi: `tsc --noEmit` bersih, `eslint` bersih, tidak ada
  regresi (151 test lain tetap pass).
* Fitur inti T-029 tetap `✅ Done` — ini murni koreksi bug korektnes,
  bukan perubahan status task. Detail: `tasks/v02-publishing-mvp.md`
  § T-029.

### Koreksi mockup Claude Design T-033 (Calendar)

* `templates/publish-calendar.html` — 3 card yang sebelumnya berstatus
  "Ready to Schedule" (Week: TikTok "Video latte art 15 detik"; Month:
  X "Countdown grand launching" & TikTok "Tutorial latte art") diubah
  jadi "Scheduled".
* Alasan: dikonfirmasi dengan King Rezi bahwa status
  `Draft`/`In Review`/`Ready to Schedule` tidak pernah punya
  `scheduledAt` (`roles-permissions.md:131-136`), sehingga tidak
  seharusnya muncul di grid Calendar sama sekali.
* Keputusan implementasi final: grid Calendar (Week & Month) hanya
  menampilkan post berstatus Scheduled, Published, Failed. Draft/In
  Review/Ready to Schedule tidak pernah muncul di grid. Query
  `listCalendarPosts` (T-033.1) sudah benar secara alami untuk aturan
  ini, tidak ada perubahan kode. Filter dropdown status (T-033.6) tetap
  6 opsi, tidak diubah — hanya contoh card di mockup yang dikoreksi.
* Bukan perubahan baseline (menyelaraskan implementasi dengan
  `roles-permissions.md` yang sudah ada), tidak ada ADR baru. Detail:
  `tasks/v02-publishing-mvp.md` § T-033.

---

## 2026-08-26 — T-033 Calendar view: Design System selesai (Claude Design)

### Context

Lanjutan sesi T-033 (dua entri di bawah: perencanaan UX + ADR-090, lalu
koreksi ADR-091). Setelah dokumentasi disinkronkan, King Rezi lanjut
eksekusi ke Design System (Claude Design, project "Social Media
Management") — sebagian dikerjakan langsung oleh King Rezi memakai
prompt yang disiapkan AI utama, sebagian dieksekusi AI utama langsung
lewat `DesignSync` setelah King Rezi melaporkan hasil yang keliru.

### Hasil akhir di Claude Design

* `templates/publish-calendar.html` — dua state referensi (Week: grid
  per-jam × 7 hari; Month: grid tanggal 1 bulan + badge "N More"),
  **ditumpuk vertikal** (bukan side-by-side seperti percobaan pertama —
  dikoreksi karena grid Calendar terlalu lebar untuk pola horizontal,
  beda dari card auth 380px yang jadi acuan awal). Navigasi Today/‹/›/
  label periode + filter Status/Channel per state. Tombol **New Post**
  dipindah ke `.page-head` sejajar judul halaman di kanan atas (pola
  sama `publish-queue.html`) — sebelumnya berdiri sendiri di bawah grid.
* `components/popover.html` — komponen baru, anatomi Header+Body+Trigger
  Astryx `Popover` (bukan `HoverCard`, ADR-091) terverifikasi
  `astryx component --dense`, dengan tulisan penjelasan koreksi
  HoverCard-vs-Popover di dalamnya.
* `templates/app-prototype/AppPrototype.dc.html` — klik item Calendar
  → `openPostPopover()` → CTA → `triggerEditDraft()` (Queue/Drafts tidak
  berubah); toggle Minggu/Bulan diwire nyata via `applyCalendarView()`
  (class `.cal-view-select`, sengaja **bukan** `data-proto` supaya tidak
  bentrok delegated click-listener runner yang men-`preventDefault()`
  semua elemen `[data-proto]` — pola sama dengan filter Engage yang
  pakai id polos). Default Week, tidak persist antar navigasi (sama
  seperti aturan Dark Mode toggle).
* `readme.md` — bagian "Calendar — Week/Month States & Post Preview
  Popover" diperbarui menjelaskan koreksi layout (stacked, bukan
  side-by-side) dan status wiring toggle.

### Status

**Murni Design System — belum ada kode `apps/web`.** Checkbox
T-033.1–.8 di `tasks/v02-publishing-mvp.md` tetap terbuka (rencana
mockup ≠ implementasi kode); ditandai selesai satu per satu saat
implementasi asli berjalan. Langkah berikut: design review, baru
implementasi kode dimulai.

---

## 2026-08-26 — Koreksi ADR-090: Popover (bukan HoverCard) untuk preview post Calendar (ADR-091)

### Context

Lanjutan sesi T-033 (entri di bawah). King Rezi mulai eksekusi ADR-090 di
sesi Claude Design (Design System), dan agent di sana melaporkan tidak
bisa menjalankan `astryx` CLI untuk verifikasi anatomi `HoverCard` (tidak
ada akses shell di lingkungan Claude Design). King Rezi meneruskan
pertanyaan itu ke AI utama, yang punya akses langsung ke `apps/web`.

### Temuan

AI utama menjalankan `astryx component HoverCard --dense` dan
`astryx component Popover --dense` langsung dari `apps/web` (CLI resmi
ter-pin v0.1.8, rule 15 AGENTS.md) dan menemukan **ADR-090 salah pilih
komponen**:

* `HoverCard` — trigger resminya hover/focus (`delay: 300ms`,
  `hideDelay: 200ms`), **tidak punya prop `isOpen` controlled** (hanya
  `isDefaultOpen` saat mount), dan guideline resminya eksplisit melarang
  menaruh critical action (CTA "Edit" ke Draft Editor) di dalamnya.
* `Popover` — click-triggered secara resmi, punya `isOpen`/
  `onOpenChange` controlled, anatomi Header+Body+Trigger — cocok persis
  dengan rencana awal King Rezi (klik item → ringkasan + CTA).

King Rezi setuju amandemen ke Popover.

### Perubahan

* **ADR baru:** `project-manager/decisions/ADR-091-amandemen-adr-090-popover-bukan-hovercard-untuk-preview-post-calendar.md`.
* `ADR-090` — Status diperbarui jadi "Accepted — Amended by ADR-091";
  body (append-only) tidak diedit.
* `DECISIONS.md` — entri ADR-091 ditambahkan, kolom Status ADR-090
  diperbarui.
* `product-discovery/04-ux/key-screen-patterns.md` — KSP-02-F04/F08 dan
  seluruh sebutan di Zona Fungsional/State Handling: HoverCard → Popover.
* `product-discovery/04-ux/navigation-patterns.md` — pola "Item →
  Editor" (baris Calendar) dan NP-D15: HoverCard → Popover.
* `project-manager/tasks/v02-publishing-mvp.md` § T-033 — field ADR,
  catatan referensi UX, dan T-033.8: HoverCard → Popover (+ catatan
  koreksi).
* `project-manager/TASKS.md` — catatan T-033 dan koreksi hitungan:
  HoverCard → Popover (jumlah subtask tidak berubah, tetap 8/152 total).

### Status

Ditemukan **sebelum** satu markup pun ditulis di Claude Design — tidak
ada rework kode/desain, murni koreksi dokumentasi sebelum eksekusi
lanjut. Interaksi dan konten yang disepakati King Rezi (klik item →
ringkasan + CTA Edit) tidak berubah sama sekali.

---

## 2026-08-26 — Perencanaan T-033 Calendar view: sinkronisasi dokumentasi vs referensi Buffer (ADR-090)

### Context

King Rezi memulai kerja pada T-033 (Calendar view, Publishing MVP) di
branch baru `feature/calendar-design-system`, mengikuti alur kerja
dokumentasi → Design System → implementasi kode (belum di tahap
implementasi). Sebelum menyentuh Claude Design, King Rezi mengeksplorasi
halaman Calendar Buffer (week view per-jam, month view + "N More", klik
post → popover ringkasan metrik, filter Channels/Status/Tags/Timezone,
navigasi Today/prev-next, state via URL) dan meminta agent mengecek
kesesuaiannya dengan baseline `context/`/`product-discovery/` sebelum
lanjut — sesuai rule 17 AGENTS.md (gate desain) dan alur kerja custom
yang disepakati untuk sesi ini.

### Riset & keputusan

Riset dokumentasi (T-028, KSP-02, navigation-patterns, domain-model,
ADR-046/052) menemukan beberapa gap antara referensi Buffer dan baseline
existing. Setelah dikonfirmasi ke King Rezi:

1. **Tags & Timezone filter per-view: tidak diadopsi** — konsisten
   dengan alasan penolakan yang sama di T-032.0 (Queue): tidak ada
   konsep Tag di domain model, Timezone bukan setting per-view di
   backlog. Tidak ada perubahan baseline, tidak butuh ADR.
2. **Route Calendar: tetap satu** `/publish/calendar` (ADR-046, tidak
   diamandemen), state view (week/month) + date dibawa lewat query param
   `?view=week|month&date=<timestamp>` — bukan dua route terpisah.
3. **Klik item Calendar → Astryx `HoverCard` dulu, baru CTA ke Draft
   Editor** — dikonfirmasi Astryx punya komponen ini via `astryx
   component` sebelum diputuskan (rule 15 AGENTS.md). Ini mengubah pola
   interaksi KSP-02-F04 yang sudah Accepted, sehingga dicatat sebagai
   **ADR-090** (khusus Calendar; Queue dan Drafts tidak berubah, tetap
   klik → langsung Draft Editor).

### Dokumentasi yang disesuaikan

* **ADR baru:** `project-manager/decisions/ADR-090-hovercard-astryx-preview-post-calendar-amandemen-ksp-02-f04.md`
  + entri di `DECISIONS.md`.
* `product-discovery/04-ux/key-screen-patterns.md` § KSP-02 — F04 direvisi
  (HoverCard dulu), F08 baru (HoverCard Ringkasan Post, mapping metrik ke
  `PostMetrics`: Views→`impressions`, Reach→`reach`, Replies→`comments`,
  Eng. Rate→`engagementRate`), F09 baru (Filter Status & Channel, catat
  Tags/Timezone tidak diadopsi), F05 diperluas (Today/prev-next/label
  lintas-bulan/query param), Zona Fungsional & State Handling diperbarui
  (grid per-jam Week, grid Month + "N More").
* `product-discovery/04-ux/navigation-patterns.md` — baris Calendar di §
  "Pola: Item → Editor" direvisi (lewat HoverCard), Queue/Drafts tidak
  diubah; row **NP-D15** baru ditambahkan.
* `project-manager/tasks/v02-publishing-mvp.md` § T-033 — ADR field +
  ADR-090, subtask dipecah dari 4 jadi 8 (T-033.1–.8: query, query-param
  view/date, grid Week, grid Month, navigasi periode, filter
  status+channel, manual refresh, HoverCard+CTA Draft Editor).
* `project-manager/TASKS.md` — total subtask 148 → **152** (v0.2: T-033
  4 → 8 subtask), dihitung ulang langsung dari file task, bukan
  increment manual.

### Status

Murni dokumentasi — **belum ada implementasi kode maupun perubahan
Claude Design**. Langkah berikutnya menunggu arahan King Rezi: lanjut ke
Design System (Claude Design, mengikuti breakdown T-033 di atas), lalu
design review, baru implementasi `apps/web`.

---

## 2026-08-24 — QA formal Najwa T-089.6 (ADR-089): KI-034 closed (Resolved)

### Context

Lanjutan T-089.6 (entri di bawah): kode dialog konfirmasi Tier 2 sebelum
switch workspace sudah diselaraskan dan diverifikasi end-to-end browser
oleh AI utama, tetapi belum lewat proses QA Najwa formal seperti
T-089.2–.4 sebelumnya — gap ini dicatat sebagai **KI-034**
(`PROJECT_STATE.md`). King Rezi meminta Najwa QA Engineer menjalankan QA
formal untuk menutup gap tersebut.

### Hasil QA

* `bun run typecheck`, `bun run lint`, `bun run test` — semua PASS (157
  passed, 3 skipped, 0 gagal).
* Golden path browser (localhost:3000, akun Raka Pratama/Insvire) — 6
  langkah PASS: list workspace benar; klik row non-aktif membuka
  `AlertDialog` dengan judul dinamis benar; Batal membatalkan tanpa efek;
  Pindah berhasil redirect + workspace aktif berubah; chip Aktif berpindah
  benar setelah kembali ke halaman; regresi dialog "Buat Workspace Baru"
  aman.
* 2 edge case tambahan (dari 3 temuan code-review low-severity
  sebelumnya):
  1. Escape + klik row lain saat switch masih in-flight — **tidak
     reproducible** (request switch selesai ~1ms di localhost, jauh lebih
     cepat dari race window). Catatan analisis: secara teoretis di
     network production yang lambat, Escape bisa menutup `AlertDialog`
     sebelum switch selesai (`AlertDialog` tidak punya guard tambahan
     terhadap `isSwitchPending` di `onOpenChange`) — tapi dampaknya hanya
     UX minor (row tetap menunjukkan "Memindahkan..." dan disabled sampai
     selesai, redirect/error tetap jalan normal, tidak ada state korup
     atau crash). Bukan bug baru, hanya konfirmasi ulang salah satu dari
     3 temuan code-review low-severity yang sudah pernah dilaporkan
     (sebagian — stale loading spinner — sudah diperbaiki sebelumnya).
  2. Refresh saat dialog terbuka — PASS, tidak reproducible sebagai bug
     (state dialog cuma `useState` client-side, hilang wajar saat reload,
     workspace aktif tidak berubah).
* Tidak ada bug baru ditemukan. Najwa tidak mengubah kode apa pun (murni
  QA), dan mengembalikan workspace aktif ke kondisi semula ("Insvire")
  setelah testing selesai.
* Rekomendasi Najwa: KI-034 ditutup (Resolved). Opsional backlog kecil
  (bukan blocker): guard `isSwitchPending` di `onOpenChange` `AlertDialog`
  supaya Escape tidak menutup dialog selagi switch berjalan — murni
  peningkatan UX, tidak wajib.

### Dampak dokumentasi

* `PROJECT_STATE.md` — blok Known Issue **KI-034** dihapus dari section
  Known Issues (sudah Resolved & tercatat di sini, sesuai pola KI-025);
  pointer "Resolved 2026-08-24" ditambah di section Blockers; referensi
  KI-034 di catatan KI-023 diperbarui jadi Resolved.
* `tasks/v01-foundation.md` § T-089 — status task diperbarui (T-089.6 kini
  juga lolos QA formal Najwa), catatan checklist T-089.6 dan catatan
  eksekusi diperbarui menyatakan KI-034 closed.
* Tidak ada ADR baru — ini murni QA closure atas keputusan yang sudah ada
  (ADR-089), bukan keputusan arsitektur baru.

---

## 2026-08-24 — T-089.6 (ADR-089): dialog konfirmasi Tier 2 sebelum switch workspace

### Context

Lanjutan dari T-089.1–.5 (sudah `✅ Done`, entri di bawah). Setelah kode
T-089.2/.3/.4 lolos review Ridwan + QA Najwa, King Rezi mengubah rancangan
`settings-workspaces.html` di Claude Design: klik row workspace lain tidak
lagi langsung overwrite cookie `active-workspace-id` + redirect Home tanpa
konfirmasi (versi awal ADR-088 poin 2 & 4) — sekarang membuka dialog
konfirmasi Tier 2 (`AlertDialog`, ADR-049) lebih dulu, reuse pola yang
sama dengan Logout (T-016.5) dan Remove Member. King Rezi mencatat
perubahan rancangan ini di `readme.md` project Claude Design: kolom
ketiga `components/dialog.html` dipakai ulang tanpa variant baru untuk
konfirmasi Switch Workspace di `templates/settings-workspaces.html`.

### Perubahan kode

`apps/web/src/app/(app)/settings/account/workspaces/components/WorkspacesSettingsView.tsx`
diselaraskan mengikuti rancangan baru:

1. **Dialog konfirmasi Tier 2** — klik row workspace membuka `AlertDialog`
   Astryx (pola sama dengan `apps/web/src/app/(app)/components/WorkspaceSideNav.tsx:142-159`):
   title dinamis `"Pindah ke workspace [nama]?"`, description
   `"Anda akan keluar dari workspace saat ini dan berpindah konteks
   kerja."`, `cancelLabel="Batal"`, `actionLabel="Pindah"`,
   `actionVariant="primary"` (non-destruktif, bukan `destructive`) — switch
   (`switchWorkspaceAction`) baru dijalankan setelah user klik "Pindah".
2. **Density List** `balanced` → `spacious` — murni visual/spacing antar
   item, tidak berdampak behavior, tidak dianggap keputusan material
   (tidak butuh ADR).

Diverifikasi end-to-end di browser oleh AI utama (bukan lewat proses QA
Najwa formal): Batal dan Pindah keduanya bekerja benar, redirect ke Home
sukses setelah konfirmasi. Gap retest formal oleh Najwa QA Engineer
dicatat sebagai **KI-034** (baru) di `PROJECT_STATE.md` — tidak
memblokir M8.

### Governance

- **ADR-089** (baru) dibuat mengamandemen **ADR-088** poin 2 & 4 (append-only —
  body ADR-088 tidak diedit, hanya header `### Status` ditambah catatan
  "Amended by ADR-089"). `DECISIONS.md` baris tabel ADR-088 ikut ditambah
  catatan Status yang sama.
- **Koreksi penomoran subtask:** rancangan Claude Design mencatat label
  "T-016.6" untuk perubahan ini — dicek, T-016 di `tasks/v01-foundation.md`
  hanya sampai subtask `.5` (Dialog Logout), tidak ada `.6`. Diputuskan
  dicatat sebagai **T-089.6** (subtask baru di bawah T-089, task yang
  memang membahas mekanisme switch workspace ini), bukan T-016.6 — detail
  alasan di ADR-089.
- `tasks/v01-foundation.md` § T-089: subtask baru T-089.6 ditambahkan
  (checked), body task diperbarui (gap description, koreksi mekanisme,
  acceptance T-089.3, field Status/Terkait/ADR) agar tidak lagi
  menyiratkan switch langsung tanpa konfirmasi.
- `TASKS.md`: total subtask terdefinisi naik dari 147 → 148 (dihitung
  ulang langsung dari `tasks/vXX-*.md`, bukan increment manual); v0.1
  58 → 59 subtask. Task-level tetap 22 selesai (T-089 sudah `✅ Done`
  sebelumnya).
- `PROJECT_STATE.md`: KI-034 baru; KI-023 (Terkait ditambah ADR-089,
  catatan update lanjutan); Completed (Ringkasan) dan Recent Decisions
  (Ringkasan) dirotasi (masing-masing tetap 5 item).

### Catatan pembagian kerja

`product-discovery/05-architecture/auth-architecture.md` (section
Workspace Context/Onboarding Flow) **sengaja tidak disentuh** pada sesi
governance ini — diserahkan ke main agent untuk diupdate setelah nomor
ADR-089 ini dikonfirmasi, supaya tidak race condition antar sesi.

---

## 2026-08-24 — T-089.2/.3/.4 selesai: Workspace Switcher deliberate (ADR-088) diimplementasikan, direview, lolos QA

### Context

Lanjutan T-089.1 (desain) dan T-089.5 (wiring Claude Design) yang sudah
selesai sebelumnya. Sesi ini menutup 3 subtask kode terakhir: T-089.2
(`WorkspaceService.switchWorkspace`), T-089.3 (UI halaman
`/settings/account/workspaces`), T-089.4 (dialog "Buat Workspace Baru").
Task **T-089** sekarang `✅ Done` secara keseluruhan (seluruh T-089.1–.5).

### Dikerjakan oleh

- **Prabowo Feature Engineer** (T-089.2) — `WorkspaceService.switchWorkspace`:
  validasi membership user ke workspace target, throw `AuthorizationError`
  kalau bukan member aktif; **tanpa** cookie/redirect di dalam service
  (tetap tanggung jawab entry point). Ditambah `listWorkspacesForUser` di
  service & `IWorkspaceRepository` — implementasi Prisma pakai
  `withCurrentUser`.
- **Mark UI Engineer** (T-089.3 dan T-089.4, paralel dengan Prabowo) —
  route baru `apps/web/src/app/(app)/settings/account/workspaces/`
  (`page.tsx`, `actions.ts` dengan `switchWorkspaceAction`), komponen
  `WorkspacesSettingsView.tsx` (Astryx List/ListItem/Badge/StatusDot/
  Dialog). Nav sidebar `SettingsSideNav.tsx` ditambah item "Workspaces" di
  posisi pertama grup Account. Dialog "Buat Workspace Baru" pakai
  `createWorkspaceAction` yang reuse penuh `WorkspaceService.createWorkspace`
  (T-006) tanpa modifikasi method itu sendiri.
- **Ridwan Architecture Reviewer** (sekuensial setelah implementasi) —
  review 8 file, **tidak ada temuan pelanggaran arsitektur**: entry point
  bersih dari business logic, domain tidak mengimpor Prisma langsung,
  RLS/`withCurrentUser` konsisten, error handling via `toActionError`,
  reuse T-006 terkonfirmasi tanpa duplikasi logic.
- **Najwa QA Engineer** (sekuensial setelah review) — unit test 58/58 lulus
  `workspace.service.test.ts`, full suite project 157 passed/3 skipped/0
  gagal, golden path browser end-to-end lulus semua (list workspace,
  switch, create dialog, nav ordering), edge case (refresh, konsistensi
  state) lulus, regresi di `/settings` dan `/settings/account` aman.
  **Tidak ada bug** dilaporkan.

### Catatan sisa (bukan bug) — KI-033 baru

Selama QA, Najwa membuat workspace test **"Najwa QA Test Workspace"**
(sengaja, untuk menguji `createWorkspaceAction`) yang sengaja tidak
dihapus setelahnya — hapus workspace bersifat ireversibel dan di luar
wewenang eksekusi otonom QA. Ditemukan juga **"QA Queue Test"**, sisa
sesi QA sebelumnya (bukan dari sesi T-089 ini). Keduanya dicatat sebagai
**KI-033** di `PROJECT_STATE.md` — perlu dibersihkan manual oleh King Rezi
via Settings → General → Danger Zone kalau perlu.

### Dokumentasi diupdate

- `tasks/v01-foundation.md` § T-089 — checklist T-089.2/.3/.4 dicentang,
  Status task jadi `✅ Done`, catatan eksekusi + catatan sisa KI-033
  ditambahkan.
- `TASKS.md` — Indeks release v0.1 dihitung ulang langsung dari
  `tasks/v01-foundation.md` (11 ✅ · 1 🚫 · 6 🟡 · 1 ⏸️ · 2 ⏳, dari
  sebelumnya 10 ✅ · 7 🟡), Total keseluruhan jadi 22 selesai, pointer T-089
  ditambahkan di "Fokus sekarang".
- `PROJECT_STATE.md` — bullet "Completed (Ringkasan)" untuk T-089 diupdate
  dari status desain-saja jadi selesai penuh (total tetap 5 item), KI-023
  diupdate (T-089 tidak lagi bagian sisa scope, hanya T-039.4), Known Issue
  baru **KI-033** ditambahkan, versi metadata → 1.0.53.

Tidak ada ADR baru di sesi ini — murni implementasi sesuai ADR-088 yang
sudah ada, tidak ada keputusan arsitektur/workflow baru.

---

## 2026-08-24 — T-089: 2 bug fix pasca-review desain Workspace Switcher, dikerjakan King Rezi sendiri di Claude Design

### Context

Setelah desain T-089.1 (`templates/settings-workspaces.html` + kolom
dialog ke-5 di `components/dialog.html`) selesai, AI melakukan review dan
melaporkan 2 bug ke King Rezi. King Rezi memperbaiki keduanya **sendiri**
langsung di Claude Design (project "Social Media Management") — bukan AI
atau subagent yang mengerjakan fix-nya. Ini governance/docs murni; tidak
ada kode `apps/web` yang disentuh.

### Bug 1 — dialog "Buat Workspace Baru" langsung terbuka & tidak bisa ditutup

Root cause: CSS `.dialog-backdrop.hidden{ display:none; }` tidak ada di
`<style>` blok lokal `templates/settings-workspaces.html` (ada di file
lain seperti `settings-members.html`, lupa disalin ke halaman baru ini
saat T-089.1). King Rezi menambahkan baris CSS tersebut — sudah
diverifikasi AI lewat `DesignSync get_file`, sudah ada di file sekarang.
King Rezi juga sekaligus menambahkan peningkatan kecil di luar scope bug
report: script halaman sekarang benar-benar memindahkan chip "Aktif" dari
row lama ke row yang diklik (simulasi switch lebih hidup).

### Bug 2 — nav "Workspaces" di App Prototype error "belum ada di scope: settings-workspaces"

Root cause: halaman baru ini sengaja belum diwire ke
`templates/app-prototype/AppPrototype.dc.html` (interactive runner) saat
T-089.1 (dicatat sebagai T-089.5, follow-up terbuka). King Rezi menambahkan
entry `{ key: 'settings-workspaces', file: 'settings-workspaces.html',
code: 'SETTINGS', title: 'Settings → Account → Workspaces', menu:
'Settings · Account · Workspaces' }` ke array `SCREENS` di runner tersebut,
dan menambahkannya ke scope Templates list. Diverifikasi AI lewat
`DesignSync get_file` + grep.

### Dampak dokumentasi

`tasks/v01-foundation.md` § T-089: T-089.5 dicentang selesai (dengan
catatan pengerjaan oleh King Rezi), T-089.1 mendapat catatan tambahan soal
fix CSS, field Status header T-089 diperbarui. Tidak ada perubahan di
`TASKS.md` (hitungan task-level T-089 tetap 🟡 In Progress, T-089.2-.4
belum dikerjakan) maupun `PROJECT_STATE.md` (status T-089 overall tidak
berubah).

---

## 2026-08-24 — Desain + ADR-088 Deliberate Workspace Switcher (Settings → Account → Workspaces) — task baru T-089

### Context

Setelah T-039.4 (onboarding picker workspace) didesain di sesi sebelumnya
hari ini, King Rezi menyadari gap nyata pada premis ADR-076 poin 4: picker
`/onboarding` hanya muncul sebagai re-entry saat cookie `active-workspace-id`
hilang, bukan mekanisme untuk **sengaja** pindah workspace kapan saja
setelah user pernah memilih satu. King Rezi minta gap ini diperbaiki.

AI memberi rekomendasi trade-off antara (a) halaman tersendiri vs
(b) digabung ke General Settings existing. King Rezi memutuskan opsi (a):
**bangun halaman tersendiri.**

### Klasifikasi & gate rule 17 `AGENTS.md`

Task ini UI/UX-related — dicek dulu ke Claude Design sebelum implementasi
kode apa pun. Belum ada rancangannya, sehingga pekerjaan sesi ini murni
desain (Claude Design) + keputusan arsitektur (ADR), bukan kode `apps/web`.

### Pekerjaan — Design System (Claude Design, project "Social Media Management")

Dikerjakan AI utama langsung via `DesignSync` (bukan subagent Neymar
Product Designer — riwayat `DesignSync` gagal dimuat di sesi Neymar sudah
tercatat 4x sebelumnya, sama seperti pola T-039.4 di sesi sebelumnya hari
ini):

1. File baru `templates/settings-workspaces.html` — halaman Settings, grup
   **Account**, posisi teratas (di atas Profile). Isi: list seluruh
   workspace milik user — workspace aktif dirender sebagai chip "Aktif"
   non-interactive, workspace lain sebagai row yang bisa diklik untuk
   switch (reuse `.ws-pick-item` yang sudah ada dari
   `templates/onboarding.html`, T-039.4) — plus tombol "Buat Workspace
   Baru".
2. Dialog "Buat Workspace Baru" — form sederhana, non-destruktif (tanpa
   tier konfirmasi type-to-confirm karena tidak ada risiko kehilangan
   data). Ditambahkan sebagai kolom ke-5 baru di `components/dialog.html`.
3. 6 halaman `settings-*.html` lain ditambah link navigasi "Workspaces" di
   sidebar Settings grup Account, supaya halaman baru ini konsisten
   ditemukan dari halaman Settings manapun.
4. `styles.css` — modifier baru `.ws-pick-item.is-active` (state chip
   "Aktif" pada row workspace saat ini, dibedakan dari row workspace lain
   yang clickable).
5. `readme.md` (Claude Design) diupdate dengan section penjelasan lengkap
   halaman baru ini.
6. **Belum diwire** ke `templates/app-prototype/AppPrototype.dc.html`
   (interactive runner) — sengaja dibiarkan sebagai follow-up terbuka
   (dicatat sebagai subtask T-089.5), bukan oversight.

### Keputusan arsitektur — ADR-088

**ADR-088** ("Amandemen ADR-076 — Deliberate Workspace Switcher via
Settings → Account → Workspaces") dibuat oleh subagent Gibran Project
Manager pada panggilan sebelumnya di sesi ini. Ringkasan:

- Mengamandemen **ADR-076 poin 4** (append status "Accepted — Amended by
  ADR-088 (2026-08-24, poin 4)", bukan ditulis ulang — append-only).
- Scope MVP sengaja **narrow**: hanya (a) switch active workspace antar
  membership yang sudah ada, (b) create workspace tambahan dari halaman
  ini. **Bukan** bagian scope: multi-workspace management penuh (bulk
  actions, billing gabungan, shared views) — tetap Out of Scope.
- Baseline yang diamandemen: `mvp-definition.md`, `auth-architecture.md`
  (Workspace Context + Onboarding Flow + AU-D03), `application-layer.md`
  (kontrak `switchWorkspace` baru di `WorkspaceService`),
  `information-architecture.md` (Settings → Account → Workspaces).
- Baseline yang dicek tapi sengaja **tidak** diubah (tidak relevan — tidak
  ada perubahan skema data/routing URL): `monorepo-setup.md`,
  `auth-strategy.md`, `domain-model.md`, `database-strategy.md`.

### Koreksi mekanisme penting

Switch yang disengaja ini **bukan** "hapus cookie dulu, lalu ulang lewat
`/onboarding`" (miskonsepsi awal King Rezi yang mengira begitu dan
menganggapnya aneh). Mekanisme yang benar: **langsung overwrite** cookie
`active-workspace-id` ke workspace target (setelah validasi ulang
membership terhadap `workspace_members`), lalu redirect ke Home. Tidak ada
langkah delete cookie di jalur ini.

### Governance — task baru T-089 (bukan subtask T-039.6)

Dipertimbangkan sebagai subtask T-039.6 (satu rumpun routing/workspace,
ADR-076) vs task baru dengan nomor global sendiri. Diputuskan **task baru
T-089** — ini fitur produk baru (switcher) yang lahir dari amandemen
ADR-076, bukan subtask kecil dari migrasi routing lama T-039. ID `T-089`
diambil karena rentang v1.0 (`T-080`–`T-088`) sudah habis terisi, jadi
ini ID global berikutnya yang belum pernah dipakai sama sekali (berbeda
dari T-039 yang meminjam dari cadangan v0.2). Ditempatkan di
`tasks/v01-foundation.md` (bukan file rilis lain) karena scope-nya sejalan
dengan rumpun Workspace/Settings T-009/T-016/T-039, bukan Publishing v0.2.

Status T-089: `🟡 In Progress` — subtask desain (T-089.1) sudah selesai,
4 subtask kode (T-089.2–.5) belum dikerjakan sama sekali. Branch
`feature/t039-4-onboarding-workspace-picker` (dibuat sesi sebelumnya untuk
T-039.4) belum ada commit kode apa pun untuk task ini juga — implementasi
kode T-039.4 **dan** T-089 sama-sama masih menunggu approval King Rezi
atas desain, sebelum eksekusi kode dimulai.

### Diupdate

- `tasks/v01-foundation.md` — section baru "Workspace Switcher (ADR-088)"
  berisi T-089 (5 subtask, 1 selesai) + catatan spin-off di penutup § T-039
  + Catatan Rilis (penomoran ID).
- `TASKS.md` — indeks release v0.1 (Task 20→21, breakdown status
  dihitung ulang dari file sumber — sekaligus mengoreksi drift lama "11 ✅
  · 5 🟡" yang sudah tidak cocok dengan file aktual sebelum penambahan ini
  menjadi "10 ✅ · 6 🟡"), **Total** (71→72 task, 22→21 selesai,
  142→147 subtask), Aturan ID (`T-088`→`T-089`).
- `PROJECT_STATE.md` — KI-023 (catatan update baru, append; field
  `Terkait` ditambah T-089/ADR-088), Recent Decisions (ADR-088
  ditambahkan di puncak, ADR-083 digeser keluar dari 5 item), Completed
  Ringkasan (bullet baru ditambahkan, bullet KI-031 resolved digeser keluar
  dari 5 item), Metadata (versi 1.0.52, tanggal 2026-08-24), Snapshot/Next
  Tasks (jumlah task 71→72).
- `DECISIONS.md` — entri ADR-088 (dibuat di panggilan sebelumnya, bukan
  sesi ini) + status ADR-076 ditandai "Amended by ADR-088".

---

## 2026-08-24 — Desain T-039.4 (halaman `/onboarding` picker workspace) selesai di Claude Design — implementasi kode belum dimulai

### Context

T-039.4 ("Bangun halaman `/onboarding` dengan picker workspace") sebelumnya
berstatus belum dikerjakan. Sesuai rule 17 `AGENTS.md`, task ini diklasifikasi
UI/UX-related — sebelum kode ditulis, gate mewajibkan cek dulu ke Claude
Design apakah screen ini sudah ada rancangannya. Belum ada, sehingga
implementasi kode di-STOP dulu dan pekerjaan sesi ini murni membuat
rancangannya di Claude Design (project "Social Media Management", projectId
`84aded99-bb23-49b1-be9f-dd8f21c6873e`), mengikuti keputusan yang sudah ada
sebelumnya (ADR-076, ADR-077) — bukan keputusan arsitektur baru, jadi tidak
ada ADR baru untuk pekerjaan ini.

### Proses delegasi

Awalnya didelegasikan ke subagent Neymar Product Designer, tapi `DesignSync`
gagal dimuat di sesi subagent tersebut — ini kejadian ke-4 dengan pola gagal
yang sama, sudah dicatat sebelumnya di `.claude/agents/README.md` oleh Neymar
sendiri di sesi sebelum sesi ini. King Rezi memberi izin eksplisit untuk
melanjutkan pekerjaan desain di sesi utama (bukan subagent), dan `DesignSync`
berhasil dimuat di sana. Seluruh pekerjaan desain di bawah ini dikerjakan di
sesi utama.

### Pekerjaan

1. File baru `templates/onboarding.html` di Claude Design — 2 state referensi
   side-by-side memakai pola `.state-tag` yang sudah baku di project ini:
   - **"Belum Punya Workspace"** — form buat workspace baru (field Nama
     Workspace + Button primary).
   - **"Pilih Workspace (>1, cookie hilang)"** — list `.ws-pick-item` yang
     bisa diklik (avatar inisial + nama workspace + role sebagai
     description), masing-masing row langsung set active workspace +
     redirect ke Home.
2. `styles.css` (Claude Design) ditambah section baru "Onboarding — Workspace
   Picker (T-039.4, ADR-076)" berisi class `.ws-pick-list`, `.ws-pick-item`,
   `.ws-pick-avatar`, `.ws-pick-body`, `.ws-pick-name`, `.ws-pick-role`,
   `.ws-pick-chevron` — semua mereplikasi Astryx `List`+`ListItem` (dibangun
   dari primitive `Item`: startContent Avatar, label, description,
   onClick/href). Verifikasi komponen dilakukan lewat MCP `xds`
   (`get("ClickableCard")`, `get("Item")`, `get("List")`); dipilih
   `List`/`Item` bukan `ClickableCard` karena beberapa row berbagi satu list
   di dalam satu card, bukan masing-masing jadi card berdiri sendiri.
3. `readme.md` (Claude Design) diupdate: entri baru di section "## Files"
   untuk `templates/onboarding.html` dan class `.ws-pick-*`, plus section
   naratif baru "## Onboarding — Workspace Picker (T-039.4, ADR-076/ADR-077,
   2026-08-24)".
4. Branch git `feature/t039-4-onboarding-workspace-picker` dibuat (checkout
   dari `staging`) sebelum kerja ini dimulai — belum ada commit apa pun di
   branch itu, karena seluruh pekerjaan sesi ini terjadi di Claude Design
   (bukan file kode `apps/web`), jadi tidak ada perubahan file lokal yang
   perlu di-commit.

### Open gap yang dicatat, bukan bagian scope T-039.4

Project Claude Design ini masih memakai token `@astryxdesign/theme-neutral`,
sedangkan `apps/web` sudah pindah ke `@astryxdesign/theme-stone` sejak
ADR-087 (2026-08-21) — ADR-087 sendiri sudah mencatat ini sebagai item
terbuka ("Claude Design belum disinkronkan ke theme Stone"). Screen
onboarding baru ini sengaja memakai token Neutral yang sudah ada apa adanya,
**tidak** mencoba resync sebagian — dicatat ulang di `readme.md` Claude
Design sebagai reminder, bukan ADR baru (ADR-087 sudah cukup mencakupnya).

### Status setelah sesi ini

- Desain T-039.4 selesai di Claude Design — gate rule 17 `AGENTS.md`
  terpenuhi untuk screen ini.
- Implementasi kode `/onboarding` di `apps/web` **belum dikerjakan sama
  sekali** — menunggu approval King Rezi atas desain ini sebelum
  dilanjutkan.
- Diupdate: `tasks/v01-foundation.md` § T-039 (Status header + catatan
  T-039.4), `PROJECT_STATE.md` (KI-023, update sisa scope).

---

## 2026-08-21 — Ganti theme Astryx dari Neutral ke Stone (ADR-087)

### Context

King Rezi meminta secara eksplisit mengganti theme Astryx project ini dari
Neutral ke Stone ("Warm stone and slate tones; Montserrat + Figtree type" —
deskripsi resmi `astryx docs theme`). Ini murni preferensi visual King Rezi,
bukan temuan bug/audit. King Rezi eksplisit meminta: proses sekarang tapi
**jangan sentuh Claude Design dulu** — fokus hanya code dan dokumentasi;
rule 17 `AGENTS.md` (gate Claude Design sebelum implementasi UI/UX) sengaja
dilewati untuk task ini atas instruksi eksplisit tersebut.

### Pekerjaan

Perubahan kode (diterapkan di sesi terpisah, sudah diverifikasi: computed
style browser menunjukkan `data-astryx-theme="stone"`, font heading/body
sudah Montserrat/Figtree, dan `bun run build` production build hijau tanpa
error untuk seluruh 30 route):

1. `apps/web/package.json` — field `"astryx": { "theme": ... }` diubah dari
   `"@astryxdesign/theme-neutral"` ke `"@astryxdesign/theme-stone"`;
   dependency `@astryxdesign/theme-neutral` dihapus (`bun remove`), diganti
   `@astryxdesign/theme-stone` versi `0.4.3` (sama seperti versi
   `@astryxdesign/core`/`@astryxdesign/cli` yang sudah ter-pin).
2. `apps/web/src/app/globals.css` — `@import
   "@astryxdesign/theme-neutral/theme.css";` diganti `@import
   "@astryxdesign/theme-stone/theme.css";`.
3. `apps/web/src/components/Providers.tsx` — import `neutralTheme` dari
   `@astryxdesign/theme-neutral/built` diganti `stoneTheme` dari
   `@astryxdesign/theme-stone/built`; pemakaian `<Theme mode={mode}
   theme={neutralTheme}>` diganti `<Theme mode={mode} theme={stoneTheme}>`.
4. Dikonfirmasi tidak ada sisa referensi `theme-neutral`/`neutralTheme` di
   `apps/web/src` maupun `package.json` (grep bersih).

Perubahan dokumentasi (sesi ini, oleh Gibran Project Manager):

5. ADR baru dibuat:
   `project-manager/decisions/ADR-087-ganti-theme-astryx-neutral-ke-stone.md`,
   mendokumentasikan keputusan, alasan (permintaan eksplisit, bukan bug),
   detail perubahan kode, alasan rule 17 `AGENTS.md` sengaja dilewati, dan
   item terbuka (Claude Design belum disinkronkan).
6. `project-manager/DECISIONS.md` — baris index `ADR-087` ditambahkan di
   posisi teratas.
7. `AGENTS.md` § Stack & layout — baris "neutral theme selama M8" diganti
   "Stone theme (ADR-087)".
8. `context/ctx-technical-context.md` — baris "Astryx — neutral theme
   selama M8" diganti menjadi Stone theme + rujukan ADR-087.
9. `context/ctx-design.md` — baris yang menyebut "gunakan neutral theme
   Astryx" dan penjelasan Light/Dark Mode Toggle (ADR-055) terkait
   `@astryxdesign/theme-neutral` disesuaikan ke Stone theme; makna kalimat
   asli tidak berubah, hanya nama tema.
10. `project-manager/PROJECT_STATE.md` — section Completed (Ringkasan)
    ditambah bullet baru di posisi teratas (tetap 5 item, item terlama
    digeser keluar). Section Recent Decisions (Ringkasan) ditambah
    `ADR-087` di posisi teratas, `ADR-082` digeser keluar dari 5 ADR
    terakhir.

### Hasil

Dokumentasi konsisten dengan perubahan kode yang sudah diterapkan &
diverifikasi di sesi terpisah. **Item terbuka eksplisit:** Claude Design
(seluruh KSP + App Prototype project "Social Media Management") belum
disinkronkan mengikuti theme Stone ini — perlu langkah lanjutan terpisah,
kemungkinan lewat Neymar Product Designer. Tidak ada baseline
`product-discovery/` yang diamandemen (murni ganti theme package Astryx).

---

## 2026-08-21 — Revert total swap warna AppShell, kembali ke default Astryx (ADR-086, membatalkan ADR-084)

### Context

Lanjutan audit menyeluruh King Rezi terhadap seluruh override warna custom
di project ini (satu rangkaian dengan pembatalan pola `Section > Card` di
Settings, ADR-085, pada hari yang sama). King Rezi memutuskan AppShell tidak
perlu kustomisasi warna apapun — kembali murni ke default `neutralTheme`
bawaan Astryx, membatalkan penuh ADR-084 (2026-08-20).

### Pekerjaan

Perubahan kode (diterapkan di sesi terpisah, sudah diverifikasi King Rezi
lewat browser untuk light mode dan dark mode — tidak ada regresi):

1. `apps/web/src/app/globals.css` — seluruh blok `@layer components` yang
   ditambahkan ADR-084 (2 rule CSS untuk `.astryx-app-shell`/
   `.astryx-app-shell-sidenav` dan `.astryx-layout-content`, beserta
   comment penjelasannya) **dihapus total**. File sekarang hanya berisi
   `@layer` declaration, `@import`, `@theme inline` font vars, dan style
   `body { font-family: ... }`.
2. AppShell kembali ke default `neutralTheme` Astryx sepenuhnya: sidebar
   abu-abu, konten putih di light mode (sama seperti sebelum ADR-084);
   dark mode tidak berubah.

Perubahan dokumentasi (sesi ini, oleh Gibran Project Manager):

3. ADR baru dibuat:
   `project-manager/decisions/ADR-086-revert-swap-warna-appshell-kembali-ke-default-astryx.md`.
4. `project-manager/DECISIONS.md` — baris index `ADR-086` ditambahkan di
   posisi teratas; baris index `ADR-084` kolom `Status` diubah menjadi
   `Accepted — Reverted by ADR-086 (2026-08-21)`.
5. `project-manager/decisions/ADR-084-swap-warna-appshell-light-mode-css-selector-scoped-bukan-defineTheme.md`
   — **hanya** header `### Status` diubah menjadi
   `Accepted — Reverted by ADR-086 (2026-08-21)`; isi body lainnya (Context,
   Decision, Reason, Alternatives, Impact) tidak diedit sama sekali,
   mengikuti pola append-only (ADR-084 tidak dihapus karena sudah jadi
   rujukan di `PROJECT_STATE.md` dan `.claude/agents/README.md`, berbeda
   dari kasus ADR-085/086 versi lama yang baru dibuat hari yang sama dan
   belum jadi preseden).
6. `project-manager/PROJECT_STATE.md` — section Completed (Ringkasan)
   diperbarui: bullet lama "Swap warna sidebar ↔ konten AppShell" dihapus
   dan digantikan bullet baru "Revert total swap warna AppShell" di posisi
   teratas (tetap 5 item terakhir). Section Recent Decisions (Ringkasan)
   diperbarui: `ADR-086` ditambahkan di posisi teratas, `ADR-081` digeser
   keluar dari 5 ADR terakhir, baris `ADR-084` diberi catatan
   "Reverted by ADR-086".
7. `.claude/agents/README.md` dan body `project-manager/decisions/ADR-085-*.md`
   dicek — keduanya hanya menyebut ADR-084 sebagai catatan kronologi
   historis (insiden `DesignSync` gagal dimuat; urutan penulisan baris
   index), bukan klaim tentang state warna AppShell saat ini, sehingga
   tidak diubah (tidak menyesatkan pembaca).

### Hasil

Tidak ada perubahan kode di sesi ini (kode sudah diterapkan & diverifikasi
di sesi terpisah sebelumnya). Dokumentasi konsisten: ADR-084 tetap utuh
sebagai jejak historis dengan status Reverted, ADR-086 baru menjelaskan
pembatalannya, dan `PROJECT_STATE.md` tidak lagi menyesatkan pembaca soal
state warna AppShell saat ini.

---

## 2026-08-21 — `SettingsSectionCard` dihapus total (bukan wrapper tipis) — lanjutan ADR-085

### Context

Lanjutan langsung dari entri ADR-085 di bawah ini (dibuat hari yang sama).
Setelah `SettingsSectionCard` direstrukturisasi jadi wrapper tipis
`<Section>{children}</Section>` (tanpa `Card`), King Rezi menilai wrapper
ini trivial — tidak menambah value apapun dibanding memakai `<Section>`
langsung — sehingga diputuskan komponennya **dihapus total**, bukan
dipertahankan sebagai wrapper tipis.

### Pekerjaan

Perubahan kode (diterapkan di sesi terpisah, sudah diverifikasi King Rezi
lewat browser preview untuk ketiga halaman, light mode):

1. File dihapus: `apps/web/src/app/(app)/settings/components/SettingsSectionCard.tsx`.
2. `apps/web/src/app/(app)/settings/account/components/ProfileForm.tsx` —
   import `SettingsSectionCard` dihapus, ganti
   `import { Section } from "@astryxdesign/core/Section";`. `<SettingsSectionCard>`
   yang membungkus `<form>` diganti `<Section>` langsung.
3. `apps/web/src/app/(app)/settings/members/components/MembersTable.tsx` —
   pola sama: import `Section` langsung, `<SettingsSectionCard>` yang
   membungkus `EmptyState`/`Table` diganti `<Section>` langsung.
4. `apps/web/src/app/(app)/settings/connected-accounts/components/ConnectedAccountsList.tsx` —
   pola sama: import `Section` langsung, `<SettingsSectionCard>` yang
   membungkus `EmptyState`/`List` diganti `<Section>` langsung.
5. Dikonfirmasi tidak ada sisa referensi `SettingsSectionCard` di
   `apps/web/src` (grep bersih) dan `tsc --noEmit` tidak ada error terkait
   file-file ini.

Dokumentasi (sesi ini):

- `project-manager/decisions/ADR-085-settings-section-murni-tanpa-card-kepatuhan-aturan-astryx.md` —
  diupdate in-place (bukan ADR baru) di bagian Decision dan Impact untuk
  mencerminkan keputusan final: `SettingsSectionCard` tidak dipertahankan
  sebagai wrapper tipis, tapi dihapus total.
- `project-manager/DECISIONS.md` — ringkasan satu-baris ADR-085 diupdate
  agar menyebut penghapusan total komponen wrapper, bukan cuma
  restrukturisasi jadi `Section` murni.

### Catatan

Tidak ada ADR baru dibuat untuk langkah ini — dianggap kelanjutan langsung
keputusan ADR-085 yang baru dibuat pada hari yang sama, bukan keputusan
material terpisah.

---

## 2026-08-21 — Settings pakai `Section` murni tanpa `Card` — ADR-085 & ADR-086 lama dihapus total

### Context

Entri ini menggantikan entri lama "Fix `Section variant` (DashboardHome,
SettingsSectionCard) + aturan verifikasi dual-mode — ADR-086" yang
**dihapus total** dari file ini (bukan diamandemen) karena diskusi lanjutan
dengan King Rezi menemukan pendekatan ADR-085 dan ADR-086 (versi lama,
sama-sama dibuat 2026-08-21) melanggar aturan resmi Astryx.

Dikonfirmasi lewat `bunx astryx docs layout` (section "Cards vs Rows":
dense data harus rows, "✗ Nesting Cards inside Cards", "✗ Wrapping each
list item in a Card") dan `bunx astryx docs shape` (`Section` = page region
flat/`radius: none`, `Card` = widget diskrit rounded `--radius-container`
12px — dua komponen ini tidak didesain untuk ditumpuk). Artifact border
siku Section menonjol dari lengkungan Card di `SettingsSectionCard.tsx`
ternyata bukan soal kontras warna (dugaan versi lama ADR-086), melainkan
konsekuensi struktural dari pola `Section > Card` itu sendiri (pola versi
lama ADR-085) yang salah dari awal untuk dense data.

### Pekerjaan

Perubahan kode (diterapkan di sesi terpisah sebelum dokumentasi ini
ditulis, sudah diverifikasi King Rezi):

1. `apps/web/src/app/(app)/settings/components/SettingsSectionCard.tsx` —
   direstrukturisasi total, `Card` dihapus sepenuhnya. Sekarang `Section`
   (default, tanpa `variant`) langsung membungkus `children` — dipakai
   oleh `ProfileForm`/`MembersTable`/`ConnectedAccountsList`.
2. `apps/web/src/app/(app)/components/DashboardHome.tsx` — Section
   "Analytics Snapshot" dikembalikan ke default (tanpa
   `variant="transparent"`), revert total dari perbaikan versi lama
   ADR-086.

Dokumentasi (sesi ini):

- **ADR-085 dan ADR-086 versi lama dihapus total**: file
  `decisions/ADR-085-section-card-dense-data-settings-pengecualian-aturan-astryx.md`
  dan `decisions/ADR-086-section-transparent-fit-content-dan-verifikasi-dual-mode-light-dark-wajib.md`
  dihapus; baris indeksnya di `DECISIONS.md` dihapus. Pengecualian eksplisit
  dari pola append-only ADR — kedua ADR itu baru lahir hari yang sama dan
  belum jadi preseden di tempat lain, sehingga King Rezi memilih hapus
  bersih alih-alih menumpuk amandemen di atas keputusan yang salah dari
  awal.
- **ADR baru dibuat, nomor dipakai ulang jadi `ADR-085`** (bukan
  `ADR-087`) karena nomor lama sudah kosong sebelum ADR baru ini ditulis —
  isinya: keputusan final Settings pakai `Section` murni, plus catatan
  eksplisit riwayat penghapusan total ADR-085/086 versi lama untuk jejak
  audit di masa depan.
- `context/ctx-development.md` — item checklist "verifikasi visual light
  DAN dark mode wajib" (mengacu ADR-086 versi lama) dihapus total dari
  "Checklist sebelum selesai task kode". Item lama soal smoke test UI +
  dark mode khusus upgrade/penambahan Astryx (sudah ada sebelum ADR-086
  versi lama dibuat) **tetap dipertahankan**, tidak ikut terhapus.

### Dampak

- File dihapus: `project-manager/decisions/ADR-085-section-card-dense-data-settings-pengecualian-aturan-astryx.md`,
  `project-manager/decisions/ADR-086-section-transparent-fit-content-dan-verifikasi-dual-mode-light-dark-wajib.md`.
- File baru: `project-manager/decisions/ADR-085-settings-section-murni-tanpa-card-kepatuhan-aturan-astryx.md`.
- `project-manager/DECISIONS.md` — baris indeks ADR-085/086 versi lama
  diganti satu baris `ADR-085` baru.
- `context/ctx-development.md` — item checklist dual-mode dihapus total.
- Konsekuensi visual produk disadari: 3 halaman Settings (Profile,
  Members, Connected Accounts) sekarang flat/persegi mengikuti bentuk asli
  `Section`, menyimpang dari mockup Claude Design yang sebelumnya minta
  tampilan kotak rounded — belum disinkronkan ulang ke Claude Design (next
  step terpisah).
- Tidak ada task `TASKS.md`/`tasks/vXX-*.md` yang terdampak — ini
  perbaikan bug ad-hoc di luar backlog, sama seperti pola ADR-084.

---

## 2026-08-20 — Swap warna sidebar ↔ konten AppShell (light mode saja) — ADR-084

### Context

Permintaan ad-hoc King Rezi (bukan bagian task backlog `TASKS.md`/
`tasks/vXX-*.md` manapun), dikerjakan di branch `feature/swap-appshell-bg-light-mode`
(dibuat dari `staging`, belum commit). Minta swap warna background AppShell
untuk **light mode saja** — dark mode sengaja tidak disentuh:

- Sidebar: abu (`#f1f1f1`) → **putih** (`#ffffff`).
- Area konten utama (semua halaman: Home, Publish/Queue/Calendar/Drafts/
  History, Engage, Analyze, Settings): putih (`#ffffff`) → **abu**
  (`#f1f1f1`).

### Pekerjaan

Investigasi menemukan warna sidebar (`.astryx-app-shell-sidenav`) dan
konten (`.astryx-layout-content`, komponen generik `Layout`/`LayoutContent`
Astryx) bukan elemen unik AppShell — component key yang sama dipakai ulang
di **seluruh dialog** aplikasi (Cancel Schedule Queue, Transfer Ownership &
Hapus Workspace Settings > General, Invite Member Settings > Members,
Draft Editor Modal). Override lewat jalur resmi `defineTheme({ components:
{ 'layout-content': {...} } })` akan ikut mengubah warna konten semua
dialog itu — ditolak.

Solusi: 1 blok `@layer components` baru ditambahkan di akhir
`apps/web/src/app/globals.css` — CSS selector ter-scope presisi ke slot
AppShell (`.astryx-app-shell[data-variant="elevated"]`,
`.astryx-app-shell-sidenav[data-variant="elevated"]`) + exclusion
`:not(dialog .astryx-layout-content)` supaya konten dialog manapun (semua
dirender via elemen native `<dialog>`, dikonfirmasi lewat inspeksi DOM)
tidak ikut ter-match. Nilai warna pakai `light-dark(#ffffff, #1b1b1b)`
untuk shell/sidenav dan `light-dark(#f1f1f1, #262626)` untuk konten —
mempertahankan dark mode identik nilai lama di selector yang sama. Semua
nilai HEX diverifikasi dari *computed style* browser (bukan tabel
`astryx docs tokens` yang ternyata tidak akurat terhadap built theme yang
sebenarnya jalan) — bukan warna baru/brand baru.

Pendekatan ini sah menurut dokumentasi resmi Astryx (`astryx docs styling`
→ "Preferred Selector Surface: Data Attributes") — bukan swizzle (ADR-041)
dan bukan StyleX/`xstyle` (dihapus, ADR-082).

### Verifikasi

Browser: light mode Queue + Settings (warna tertukar sesuai permintaan);
dialog Hapus Workspace dicek eksplisit **tidak berubah**; dark mode dicek
identik sebelum/sesudah (shell/sidenav `#1b1b1b`, konten `#262626`). Tidak
ada Vitest/`tsc`/`eslint` tambahan — perubahan murni CSS, tidak menyentuh
logic/TypeScript.

### Keputusan ADR

**ADR-084** dibuat — mencatat alasan penolakan `defineTheme` component
override, detail selector CSS yang dipakai, dan keputusan sekali-pakai
soal urutan kerja (implementasi dulu, dokumentasi menyusul setelah acc
visual — dibalik dari rule 17 `AGENTS.md`, eksplisit bukan preseden
permanen untuk task UI lain).

### Status

Selesai, sudah di-acc visual King Rezi. Bukan task backlog, sehingga tidak
ada entri baru di `TASKS.md`/`tasks/vXX-*.md`. Dokumentasi governance
diperbarui dalam perubahan yang sama: `DECISIONS.md` + `decisions/ADR-084-*.md`,
`PROJECT_STATE.md` (Recent Decisions + Completed Ringkasan). Next step
(di luar cakupan sesi ini): sinkronisasi ke Claude Design oleh Neymar
Product Designer. Commit/push belum dilakukan — menunggu instruksi
eksplisit King Rezi.

---

## 2026-08-20 — T-032 Queue management selesai (implementasi penuh) + T-030 (Cancel Schedule) ditutup untuk konteks Queue

### Context

Lanjutan dari T-032.0/.1 (ADR-083, 2026-08-19) yang menyelaraskan Design
System halaman Queue. Sesi ini mengerjakan 4 subtask implementasi kode yang
tersisa (T-032.2–.5) lewat delegasi paralel/sekuensial beberapa subagent
(Prabowo Feature Engineer ×2, Elon Backend Engineer, Mark UI Engineer),
diikuti review Ridwan (Architecture Reviewer) dan QA Najwa, ditutup 2
putaran fix dari sesi utama.

### Pekerjaan per subtask

- **T-032.2** (Prabowo) — `PublishingService.listQueue` + repository: query
  `PublishingPost`/`PublishingPostTarget` status `Scheduled` langsung (bukan
  `PublishingQueueSlot`, ADR-083), grouped per tanggal via helper baru
  `apps/web/src/domains/publishing/services/group-queue-items.ts` (+ test),
  ascending `scheduledAt`. File diubah: `publishing.repository.ts` (interface
  + tipe `QueueItemRecord`/`QueueItemTargetRecord`), `publishing.service.ts`,
  `index.ts`, implementasi Prisma di
  `apps/web/src/lib/repositories/publishing/publishing.repository.ts`.
- **T-032.5** (Elon) — Migration `20260820024619_drop_publishing_queue_slot`
  men-drop model Prisma `PublishingQueueSlot` + tabel `publishing_queue_slots`
  + 3 field relasi balik (ADR-083). Test
  `workspace.repository.delete-cascade.test.ts` disesuaikan (assertion
  queue-slot dihapus, cascade-delete T-008.2 diverifikasi ulang dengan
  koneksi DB asli).
- **T-032.3** (Mark) — UI Astryx nyata di
  `apps/web/src/app/(app)/publish/queue/page.tsx` (RSC) +
  `components/QueueList.tsx` (client): grouping per tanggal (heading nama
  hari + tanggal, mis. "Senin, 14 Juli"), 1 Card per schedule tanpa status
  chip, filter akun client-side, 3 tombol icon (Publish Now/Edit/Cancel
  Schedule). Judul halaman dikoreksi dari "Queue" jadi **"Publish"** di sesi
  utama, setelah verifikasi ulang terhadap mockup Claude Design
  (`templates/publish-queue.html` via `DesignSync`) — cocok dengan pola
  existing `DraftsList.tsx`.
- **T-032.4** (Prabowo) — Wiring 3 aksi + **implementasi nyata T-030 (Cancel
  Schedule) secara penuh** untuk bagian Queue (menutup T-030.1/.2/.3 —
  bagian Calendar dari T-030.3 menyusul di T-033):
  - Kontrak ACL baru `IOutstandAdapter.cancelScheduledPost`
    (`packages/shared/src/contracts/outstand-adapter.ts`) + implementasi
    `FakeOutstandAdapter` (instan always-success, ADR-059).
  - Repository: method cancel (status `Scheduled` → `Draft`, `scheduledAt`
    di-null-kan, `PublishingPostTarget` dihapus).
  - RBAC: `assertActorCanCancelSchedule` (Owner/Admin/Creator, ADR-074) di
    `rbac.ts`.
  - Use-case baru `cancel-schedule.use-case.ts` (persist dulu baru panggil
    adapter, best-effort per target — pola sama `PublishNowUseCase`).
  - Server Action `cancelScheduleAction`
    (`apps/web/src/app/(app)/publish/queue/actions.ts`, file baru).
  - UI: `QueueScreen.tsx` (client wrapper baru) — `AlertDialog` Tier 2 (pola
    sama `MembersTable.tsx`), copy "Batalkan jadwal ini?" / "Post kembali
    menjadi Draft dan tidak akan dipublikasikan otomatis." / tombol
    "Batal"/"Batalkan Jadwal", toast sukses "Jadwal dibatalkan — post
    kembali ke Drafts" (pemakaian pertama `useToast` Astryx di codebase).
  - Gap tambahan ditemukan & diselesaikan: tombol "Publish Now" di Queue
    awalnya cuma reuse `openEditDraft` (sama seperti Edit) — diperbaiki
    dengan menambah `initialPendingAction?: "publish-now"` ke
    `DraftEditorState`/`openEditDraft` (`Context.tsx`, `Modal.tsx`) supaya
    modal auto-advance ke step Confirmation Summary begitu draft ready.
    **Known limitation, sengaja dibiarkan** (dicatat sebagai **KI-032**):
    `getDraftAction` belum preload target akun yang sudah dijadwalkan, jadi
    `isReadyToPublishNow` sering `false` saat dibuka dari Queue → jatuh ke
    form biasa alih-alih auto-advance.

### Verifikasi

- **Ridwan (Architecture Reviewer):** review lengkap — entry point bersih,
  domain tidak import Prisma/Supabase/HTTP, cross-domain lewat public API,
  shared types murni, RBAC fail-fast, urutan persist-then-adapter benar,
  `PublishingQueueSlot` bersih total, UI Astryx murni — **0 temuan**.
- **Najwa (QA):** Vitest 153 passed/3 skipped (skip disengaja, butuh DB
  asli), `tsc --noEmit` bersih, `eslint` bersih, E2E browser lengkap (golden
  path, filter, Edit, Publish Now fallback yang diharapkan, Cancel Schedule
  + dialog + toast + DB state, empty state, regresi Drafts, regresi Publish
  Now lama dari Draft Editor langsung, light/dark mode) — **semua pass**, 1
  bug kosmetik ditemukan: double `@` di label akun (`@@qaqueue.demo`).
- **Fix sesi utama (2 putaran):** (1) judul halaman "Queue" → "Publish"
  setelah verifikasi ulang mockup; (2) bug double-`@` diperbaiki di
  `QueueList.tsx` (label filter + label target, hapus prefix `@` duplikat)
  dan diverifikasi ulang via browser (`tsc --noEmit` bersih, screenshot
  mengonfirmasi label benar `@qaqueue.demo`, toast dan alur cancel bekerja).

### Keputusan ADR

**Tidak ada ADR baru.** Seluruh keputusan sesi ini murni implementasi
mengikuti ADR yang sudah ada (ADR-083 queue tanpa `QueueSlot`, ADR-059 pola
Fake adapter, ADR-049 Tier 2 dialog, ADR-074 RBAC). Dua keputusan kecil yang
dipertimbangkan tapi dinilai tidak cukup material untuk ADR tersendiri:
"Publish Now Queue auto-advance via `initialPendingAction`" (detail wiring
UI, bukan perubahan arsitektur/kontrak) dan "Cancel Schedule menghapus
`PublishingPostTarget` alih-alih soft-reset" (konsisten dengan pola create
row-per-target di `SchedulePostsUseCase`, tidak mengubah domain model/ACL).

### Status

T-032 (parent task) → **✅ Done** (seluruh subtask T-032.0–.5). T-030
(Cancel Schedule) → **🟡 In Progress**: T-030.1/.2/.3 selesai untuk konteks
Queue, sisa scope Calendar menunggu T-033. Dokumentasi governance
diperbarui dalam perubahan yang sama: `tasks/v02-publishing-mvp.md` (T-032,
T-030), `TASKS.md` (indeks v0.2: 8 ✅ · 1 🟡 · 10 ⏳, Total 22 selesai/142
subtask), `PROJECT_STATE.md` (Completed Ringkasan + KI-032 baru).

---

## 2026-08-19 — ADR-083: baseline `04-ux`/`05-architecture` direkonsiliasi dengan desain final Queue

### Context

Setelah T-032.0 (mockup Queue diselaraskan ke pola Buffer, entri di bawah)
selesai, King Rezi meminta audit eksplisit: "apakah aman tidak ada gap atau
ui/ux yang berlawanan dengan design system yang baru?" — mencakup
`context/` dan `product-discovery/`. Explore agent menelusuri seluruh
referensi Queue/`QueueSlot`/KSP-03 di project dan menemukan **konflik nyata
di 3 dokumen baseline inti**, bukan cuma gap kecil.

### Temuan audit & Resolusi

Audit menemukan konflik nyata di 3 dokumen baseline inti (`key-screen-patterns.md`
KSP-03, `user-flows.md` UF-02, `domain-model.md`/`application-layer.md`
entity `QueueSlot`) plus 2 drift kecil (`TASKS.md` "Keputusan terbuka" stale,
`information-architecture.md` frasa Queue). King Rezi memilih opsi "Buat ADR
+ update baseline". Detail lengkap temuan, keputusan, alasan, alternatif
yang dipertimbangkan, dan daftar file yang diamandemen: lihat
**`project-manager/decisions/ADR-083-queue-murni-urutan-waktu-publish-hapus-reorder-status-chip-queueslot.md`**
(§ Context, § Decision, § Impact / Baseline yang diamandemen).

### Status

Audit + ADR + amandemen baseline selesai. T-032 (parent task) tetap ⏳ Not
Started — T-032.2/.3/.4 (implementasi kode) belum dikerjakan. Kerja masih
di branch `feature/t-032-0-queue-design-buffer-alignment`, belum di-commit.

---

## 2026-08-19 — T-032.0 selesai: mockup Claude Design halaman Queue diselaraskan ke referensi UX Buffer

### Context

Investigasi awal sesi (deployment Railway staging stuck sejak commit lama)
berujung ke diskusi task apa yang bisa dikerjakan sekarang — King Rezi
memilih T-032 (Queue management). Sebelum implementasi kode, T-032.1
(semantik queue slot) masih jadi keputusan terbuka di `TASKS.md`. King Rezi
menunjukkan screenshot halaman Queue Buffer (`publish.buffer.com/schedule`)
sebagai referensi UX yang diinginkan, memicu subtask baru **T-032.0**
(selaraskan Design System dulu sebelum kode) yang dikerjakan dalam 2 putaran
di sesi yang sama.

### Putaran 1 — adopsi elemen Buffer yang tidak butuh ADR/fitur baru

Analisis perbandingan mockup lama (`templates/publish-queue.html`) vs
Buffer: grouping per tanggal, aksi per-post (Publish Now/Edit/More options),
tanpa reorder manual, filter Channels/Tags/Timezone, tab Approvals, badge
count. King Rezi diminta memilih cakupan lewat AskUserQuestion — hasilnya
**adopsi hanya 4 elemen** yang tidak mengubah baseline: grouping per
tanggal, urutan murni waktu publish (tombol reorder ↑/↓ dihapus total —
**closes T-032.1**, tidak perlu ADR), timestamp "Dibuat X lalu". Elemen yang
sengaja di-skip (butuh ADR atau fitur baru di luar backlog manapun): toggle
List/Calendar, tab "Approvals" (fitur approval workflow tidak ada di
`roles-permissions.md`), filter "Tags"/"Timezone" (tidak ada di domain
model/backlog).

### Putaran 2 — revisi detail layout & aksi (9 poin King Rezi)

Setelah preview hasil putaran 1, King Rezi minta 9 perbaikan lebih detail
dari screenshot Buffer yang sama. Dua poin ambigu diklarifikasi lewat
AskUserQuestion sebelum eksekusi (menghindari rework): (a) apakah "Cancel
Schedule" dan "Delete" di poin 5 & 8 adalah 1 tombol atau 2 — dipilih **1
tombol merah** (Cancel Schedule saja); (b) posisi filter channel relatif
tombol New Post — dipilih **baris terpisah** (New Post naik ke baris judul,
filter tetap di baris lama tapi dipindah kanan + diperkecil).

Hasil final `templates/publish-queue.html`: filter channel kecil rata kanan
di baris tersendiri; tombol **New Post** pindah ke baris judul
(`justify-content:space-between` dengan title+subtitle, memanfaatkan
`.page-head` yang sudah flex-between secara default); **1 Card Astryx per
schedule** (`.card.card-pad.queue-card` per row, bukan 1 card menaungi
seluruh list); status chip (Scheduled/Failed/Ready to Schedule) **dihapus
total** (tidak relevan untuk halaman ini); dropdown "More options (⋮)" dari
putaran 1 **dihapus**, diganti 3 tombol icon eksplisit: Publish Now, Edit,
**Cancel Schedule** (icon merah, class baru `.icon-btn-danger`); heading
tanggal dirapikan (nama bulan lengkap, semibold, border-bottom pemisah).

### Interaksi diwire nyata di prototipe (bukan cuma visual statis)

`templates/app-prototype/AppPrototype.dc.html` diedit supaya 3 tombol baru
benar-benar berfungsi saat diklik di App Prototype interaktif (bukan cuma
mockup diam): tombol Publish Now → reuse `openPublishNowDialog` (dialog
Confirmation Summary yang sama dengan Draft Editor, T-029); tombol Edit →
reuse `triggerEditDraft`; tombol Cancel Schedule → dialog konfirmasi baru
`openCancelScheduleDialog`/`applyCancelSchedule` (pola sama
`openDisconnectDialog`: warning + tombol `btn-danger`, menghapus card dari
Queue + toast konfirmasi) — desain interaksi ini jadi referensi siap pakai
untuk implementasi nyata T-030 (Cancel Schedule) di `apps/web`. Dead code
`reorder-up`/`reorder-down` di `route()` dibersihkan sekalian (tombolnya
sudah tidak ada sejak putaran 1). Kedua file diverifikasi baca-ulang dari
remote setelah tiap `write_files` (scope-discipline skill poin 6) — tidak
ada drift/perubahan King Rezi yang tertimpa.

### Dokumentasi

`project-manager/tasks/v02-publishing-mvp.md` § T-032 diperbarui: T-032.0
ditandai selesai dengan ringkasan 2 putaran di atas, T-032.1 tetap resolved
(urutan murni waktu publish, tanpa reorder), T-032.2/.3/.4 disesuaikan
referensinya ke desain final (grouped by date, 1 Card per schedule, 3 tombol
icon eksplisit tanpa dropdown). § T-030 (Cancel Schedule) ditambah
cross-reference ke `openCancelScheduleDialog` sebagai referensi copy &
interaksi siap pakai untuk implementasi nyata.

### Status

T-032.0 (subtask desain) selesai. T-032 (parent task) tetap **⏳ Not
Started** — T-032.2 (`PublishingService.listQueue`), T-032.3 (implementasi
UI Astryx nyata di `apps/web`), dan T-032.4 (wiring aksi ke service) belum
dikerjakan. Kerja ada di branch `feature/t-032-0-queue-design-buffer-alignment`,
belum di-commit.

---

## 2026-08-19 — KI-031 resolved: ikon Date/TimeInput dikonfirmasi permanen kiri + mockup Claude Design diperbaiki (DateTimeInput + calendar popover)

### Context

Kelanjutan diskusi KI-029/ADR-082 (entri di bawah). Fix kode untuk KI-031
sendiri (`flex-row-reverse` dihapus, ikon kembali ke posisi default kiri
Astryx demi a11y/WCAG 2.4.3) sudah diterapkan sejak 2026-08-18 — sisa gap
yang belum ditutup murni soal mockup Claude Design (`templates/draft-editor.html`,
`components/forms.html`, `templates/app-prototype/AppPrototype.dc.html`)
yang masih menampilkan pola lama (native `<input type="date"/"time">`,
posisi ikon tidak konsisten) dan tidak mencerminkan keputusan final.

### Perbaikan mockup Claude Design (project "Social Media Management")

Tiga putaran revisi sebelum konvergen ke bentuk yang benar (dicatat supaya
tidak diulang):

1. **Percobaan 1 (ditolak King Rezi):** satu box gabungan (`.dt-input`,
   ikon kalender tunggal + segmen tanggal/waktu). Salah interpretasi
   anatomi `DateTimeInput` — dikoreksi setelah King Rezi mengirim
   screenshot rendering resmi `astryx.atmeta.com/components/DateTimeInput`
   yang menunjukkan **dua kotak terpisah** berdampingan (bukan satu box).
2. **Percobaan 2:** dua kotak terpisah (`.sched-field` × 2, ikon kalender +
   ikon jam masing-masing, `type="text"` bukan native date/time) — sudah
   benar strukturnya, tapi belum ada calendar popover interaktif.
3. **Percobaan 3 (ditambah fitur):** King Rezi minta field tanggal bisa
   diklik untuk memunculkan calendar popover (bulan/tahun + navigasi prev/
   next + grid hari), sesuai anatomi resmi `DateInput`'s "Calendar popover".
   Implementasi pertama pakai class `.cal-day`/`.cal-popover` dst — **bug
   ditemukan dari screenshot King Rezi**: grid kalender rusak (baris
   raksasa, header/weekday hilang) karena `.cal-day` **bentrok** dengan
   class `.cal-day` yang sudah ada untuk layar Publish → Calendar (KSP-02,
   `min-height: 150px` untuk kartu jadwal harian) — nama class sama,
   properti CSS saling menimpa sebagian (cascade per-property, bukan
   per-block). **Fix:** dibangun ulang dari state bersih (sebelum fitur
   kalender ditambahkan), semua class calendar-popover diberi prefix unik
   `schedcal-*` (bukan `cal-*`), arah buka popover diubah dari ke-atas jadi
   ke-bawah (hindari clipping oleh `.dialog-fs-body{overflow-y:auto}`).
   Diverifikasi: `node --check` sintaks JS ketiga file lolos, dan `diff`
   terhadap rules `.cal-*` original (KSP-02) di `styles.css` menunjukkan
   **nol perubahan** — dijamin tidak ada regresi ke layar Calendar.

### Keputusan final

KI-031 ditutup **Resolved** — bukan cuma "sebagian":
- Kode `apps/web`: posisi ikon kiri permanen (a11y, sejak 2026-08-18).
- Mockup Claude Design: sudah sinkron, merepresentasikan `DateTimeInput`
  Astryx asli (dua kotak + ikon kiri masing-masing + calendar popover
  fungsional), bukan lagi native browser input yang menyesatkan.
- Opsi swizzle (satu dari dua opsi solusi lama) tertutup permanen sejak
  ADR-082; opsi lain (tunggu Astryx tambah prop resmi) tidak lagi relevan
  karena posisi kiri sudah diterima sebagai final, bukan trade-off
  sementara yang menunggu sesuatu.

### File yang berubah

- `project-manager/PROJECT_STATE.md` — KI-031 dihapus dari daftar Known
  Issues (status Resolved, sesuai aturan KI di section tersebut).
- Claude Design project "Social Media Management" (`DesignSync`):
  `templates/draft-editor.html`, `components/forms.html`,
  `templates/app-prototype/AppPrototype.dc.html`, `styles.css`.
- Tidak ada perubahan kode `apps/web` di sesi ini (fix kodenya sudah lama
  ada sejak 2026-08-18; sesi ini murni menyinkronkan mockup + menutup
  status).

---

## 2026-08-19 — KI-029 ditutup Won't Fix (ADR-082): Astryx Tailwind-only, dependency StyleX dihapus

### Context

Kelanjutan investigasi KI-029 (lihat entri tepat di bawah ini untuk detail 3 putaran investigasi teknis). Setelah putaran investigasi berakhir negatif dan sesi jeda, King Rezi melanjutkan diskusi dengan membaca ulang dokumentasi resmi:

1. `astryx.atmeta.com/docs/styling` — dikonfirmasi Astryx punya hirarki resmi (`xstyle` prioritas #1 untuk override komponen, Tailwind untuk layout/wrapper).
2. `astryx.atmeta.com/docs/styling-libraries` — tidak memihak Tailwind vs StyleX, menyarankan "integrasi paling sempit sesuai kebutuhan".
3. `stylexjs.com/docs/learn/installation/nextjs` — ditemukan jalur resmi StyleX alternatif (`@stylexjs/postcss-plugin`) yang diklaim kompatibel Turbopack sejak Next.js 16.0.3 (belum pernah diuji di 3 putaran sebelumnya, yang semuanya memakai jembatan komunitas `@stylexswc/nextjs-plugin`).
4. `github.com/facebook/astryx/tree/main/apps/example-nextjs-tailwind` — dikonfirmasi Astryx (repo resmi `facebook/astryx`) mendukung resmi pola konsumsi tanpa compiler StyleX sama sekali (`package.json` contoh ini tidak punya dependency StyleX apapun).

King Rezi juga sempat menanyakan apakah `astryx.atmeta.com` benar-benar Meta — dikonfirmasi ya (repo `facebook/astryx`, footer "©2026 Meta Platforms, Inc.").

Dua file diskusi dibuat sebagai catatan proses: `project-manager/reports/KI-029-astryx-styling-gaps.md` (konversi dari `.html` sebelumnya) dan `project-manager/reports/KI-029-xstyle-diskusi.md` (rangkuman hirarki styling resmi + akar masalah teknis `xstyle`).

### Keputusan final

King Rezi memutuskan **tidak melanjutkan investigasi teknis apapun** untuk `xstyle` (termasuk opsi jalur resmi `@stylexjs/postcss-plugin` yang belum diuji) dan menutup KI-029 sebagai **Won't Fix** — bukan bug yang di-fix, melainkan keputusan arsitektur sadar untuk berhenti memakai `xstyle`/StyleX sepenuhnya, mengikuti pola resmi Meta (`example-nextjs-tailwind`). Didokumentasikan formal di **ADR-082** (amandemen ADR-041).

Konsekuensi yang disadari dan diterima: opsi "restrukturisasi DOM manual via `astryx swizzle`" untuk KI-031 (reposisi ikon `DateInput`/`TimeInput`) ikut tertutup, karena swizzle butuh compiler StyleX yang sama untuk hasilnya ter-styling. Satu-satunya opsi tersisa untuk KI-031 adalah menunggu Astryx menambah prop resmi posisi ikon.

### Eksekusi

- Dependency `@stylexjs/stylex` (`"0.19.0"`) dihapus dari `apps/web/package.json` — tidak pernah dipakai aktif di kode (seluruh percobaan 3 putaran sudah di-revert bersih sebelumnya). `@stylexjs/stylex` tetap ada di `bun.lock` sebagai peer dependency transitif `@astryxdesign/core` (dipakai internal Astryx untuk CSS pre-compiled-nya) — ini normal, bukan sisa dependency kita.
- `bun install` dijalankan ulang — lockfile ter-update bersih (24 packages resolved), tidak ada perubahan lain.
- `tsc --noEmit` dikonfirmasi bersih pasca-penghapusan.

### File yang berubah

- `apps/web/package.json`, `bun.lock` — hapus dependency `@stylexjs/stylex`.
- `project-manager/decisions/ADR-082-astryx-tailwind-only-hapus-stylex-xstyle-amandemen-adr-041.md` — ADR baru.
- `project-manager/DECISIONS.md` — indeks ADR-082 ditambahkan; ADR-041 ditandai `Amended by ADR-082`.
- `project-manager/PROJECT_STATE.md` — KI-029 dihapus dari daftar Known Issues (status Resolved, sesuai aturan KI di baris pembuka section tersebut); KI-031 diperbarui merefleksikan penutupan opsi swizzle.
- `project-manager/reports/KI-029-astryx-styling-gaps.md`, `project-manager/reports/KI-029-xstyle-diskusi.md` — catatan diskusi (dibuat sesi ini).

---

## 2026-08-19 — Upgrade Astryx 0.4.3 (selesai bersih) + investigasi KI-029 putaran 2 & 3 (hasil negatif, dihentikan sementara)

### Context

Branch `fix/ki-029-stylex-babel-plugin`. Dua pekerjaan berbeda terjadi di branch yang sama:

1. **Upgrade Astryx `0.1.8 → 0.4.3`** (core, cli, theme-neutral) — dilakukan sebagai bagian eksplorasi apakah versi baru sudah punya rekomendasi resmi berbeda untuk wiring StyleX (lihat poin 2). Selesai bersih: `astryx upgrade --apply` melaporkan "No changes needed" untuk 156 komponen (tidak ada breaking change yang menyentuh kode existing). File berubah: `apps/web/package.json`, `bun.lock`, `apps/web/.claude/CLAUDE.md` (regenerated otomatis via `bunx astryx init --features agents --agent claude`). Diverifikasi `tsc --noEmit`, `bun run build`, smoke-test browser — semua lolos, tidak ada regresi.
2. **Investigasi lanjutan KI-029** (putaran 2 & 3, melanjutkan putaran 1 yang sudah tercatat sebelumnya) — dicoba paket resmi baru yang direkomendasikan `astryx docs styling` versi 0.4.3, **`@stylexswc/nextjs-plugin`** (compiler berbasis SWC/Rust NAPI-RS, gantinya `@stylexjs/nextjs-plugin` lama yang gagal total di putaran 1 karena Turbopack tidak memanggil hook webpack). Putaran 2 (`v0.18.3` stable): compiler berhasil jalan (bug resolusi modul `@stylexswc/turbopack-plugin/loader` ditemukan & diperbaiki sendiri), tapi nilai numerik (`maxWidth: 420`, dst.) dan fungsi warna (`rgb(...)`) hilang total dari CSS hasil ekstraksi — hanya nilai keyword string yang ter-extract. Putaran 3 (`v0.18.4-rc.2`, pre-release, changelog eksplisit menyebut fix "number rendering, rounding, unsupported value handling" PR #1258 upstream): dicoba atas persetujuan eksplisit King Rezi untuk ambil risiko pre-release — **bug identik, tidak fixed**, dikonfirmasi definitif lewat perbandingan classList baseline-vs-xstyle dan grep langsung isi CSS terkirim. Semua perubahan percobaan (`next.config.ts`, `postcss.config.mjs`, `package.json`+`bun.lock` untuk paket `@stylexswc/*`, halaman test) **sudah di-revert bersih** di kedua putaran — tidak ada sisa kode permanen dari investigasi ini.

### Keputusan penutup

Setelah 3 putaran investigasi teknis lengkap (webpack-based gagal total → SWC-based stable ada bug ekstraksi → SWC-based pre-release bug identik), King Rezi memutuskan **berhenti melanjutkan investigasi teknis KI-029/KI-030/KI-031 untuk saat ini** dan **menempuh jalan lain** (kata beliau langsung). Belum ada detail spesifik jalur alternatif yang dimaksud pada momen keputusan ini diambil. Ini **bukan** keputusan Resolved — ketiga Known Issue (KI-029, KI-030, KI-031) tetap berstatus `Open` di `PROJECT_STATE.md`, workaround existing (`className` Tailwind untuk KI-029, ikon posisi default kiri untuk KI-031) tetap berlaku.

### Referensi bukti lengkap

Laporan investigasi lengkap (seluruh 3 putaran KI-029: kutipan resmi `astryx docs styling`, output `astryx component TimeInput/DateInput --dense`, changelog Astryx, GitHub Releases upstream `Dwlad90/stylex-swc-plugin`, tabel pengukuran computed style browser + grep CSS chunk) didokumentasikan sebagai file mandiri: `project-manager/reports/KI-029-astryx-styling-gaps.md` (dibuat sebagai `.html`, dikonversi ke `.md` dan `.html`-nya dihapus 2026-08-19 — lihat entri di atas).

### File yang berubah

- `apps/web/package.json`, `bun.lock` — upgrade Astryx 0.4.3.
- `apps/web/.claude/CLAUDE.md` — regenerated (auto, mengikuti `@astryxdesign/cli` v0.4.3).
- `project-manager/PROJECT_STATE.md` — catatan penutup investigasi di KI-029/030/031 + entri "Completed (Ringkasan)" untuk upgrade Astryx.
- `project-manager/reports/KI-029-astryx-styling-gaps.md` — laporan bukti (dibuat di sesi sebelumnya sebagai `.html`, direferensikan di sini; dikonversi ke `.md` 2026-08-19).

Tidak ada perubahan pada `TASKS.md`/`tasks/vXX-*.md` (KI-029/030/031 bukan task formal bernomor) maupun `DECISIONS.md` (tidak ada perubahan baseline arsitektur — investigasi berakhir tanpa solusi yang diadopsi).

---

## 2026-08-18 — T-029 Publish Now selesai + perbaikan UI Schedule Picker Draft Editor (KI-029, KI-030)

### Context

T-029 (Publish Now, ADR-047) sebelumnya salah tercatat sebagai "belum ada desain apapun" — koreksi (commit `c967b47`) menemukan tombol "Publish Now" dan dialog konfirmasinya sudah ada di Claude Design (`templates/draft-editor.html`, `templates/app-prototype/AppPrototype.dc.html`), jadi sisa pekerjaan murni implementasi kode. Implementasi dikerjakan oleh Prabowo Feature Engineer (backend/use-case) dan Mark UI Engineer (komponen Astryx di Draft Editor), commit `1c35004`, branch `feature/t-029-publish-now`, PR #80 ke base `staging`.

### Yang diubah — Backend

- **`apps/web/src/domains/publishing/services/publish-now.use-case.ts`** (baru) — `PublishNowUseCase`, mengikuti pola `SchedulePostsUseCase` (T-028/ADR-059). RBAC eksplisit (`assertActorCanPublishNow`) dijalankan fail-fast sebelum validasi `ContentFormat` (ADR-039, `assertContentFormatAllowed`). Urutan kritis: persist dulu (`PublishingPostTarget` status `pending`, post → `Published`) lewat `repository.publishNow`, baru panggil adapter per target, baru update outcome — mencegah job Outstand orphan tanpa jejak DB.
- **`apps/web/src/domains/publishing/rbac.ts`** (baru) — `assertActorCanPublishNow`, role diizinkan (ADR-074): Owner, Admin, Creator — sama persis dengan Schedule, dieksplisitkan di kode (bukan implicit "semua boleh") karena `getWorkspaceContext()` men-cast `role` dari header tanpa validasi runtime.
- **`apps/web/src/domains/publishing/repositories/publishing.repository.ts`** + **`apps/web/src/lib/repositories/publishing/publishing.repository.ts`** — tambah method `publishNow` (interface + implementasi Prisma).
- **`apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts`** + **`apps/web/src/domains/publishing/adapters/outstand-adapter.ts`** + **`packages/shared/src/contracts/outstand-adapter.ts`** — perluasan `IOutstandAdapter`/`FakeOutstandAdapter` dengan `publishNow`, pola ADR-059 (auto-switch via env var, fidelity instan tanpa simulasi delay/failure). Jalur produksi tetap `FakeOutstandAdapter` — T-025 real adapter masih blocked kredensial (KI-003).
- **`apps/web/src/domains/publishing/index.ts`** — expose public API baru.

### Yang diubah — UI Draft Editor

- **`apps/web/src/app/(app)/components/draft-editor/Modal.tsx`** — tombol "Publish Now" berdampingan "Save as Draft"/"Schedule" (KSP-05-F12), dialog Confirmation Summary varian Publish Now (UXP-04). Sebagai bagian commit yang sama: Schedule Picker dirapikan menyamai mockup Claude Design — heading tunggal "Jadwal" (sebelumnya duplikat), label individual field disembunyikan, placeholder Bahasa Indonesia, ikon kalender/jam dipindah ke kanan lewat Tailwind `flex-row-reverse` (bukan `xstyle`/`stylex.create()` — lihat KI-029 di bawah), dan dot indicator ditambahkan ke `Badge` status lewat slot icon resmi (`currentColor`, otomatis menyesuaikan variant).
- **`apps/web/src/app/(app)/components/draft-editor/actions.ts`** — Server Action `publishNowAction`, satu-satunya call site `PublishNowUseCase`.
- **`apps/web/src/app/(app)/components/draft-editor/terminal-destination.ts`** (+ test) — redirect setelah konfirmasi Publish Now diarahkan ke Publish/Calendar lewat `finishTerminalAction`, menutup T-031.4 sekaligus (dipakai seragam dengan Save as Draft dan Schedule).

### Known Issues baru

- **KI-029** — `@stylexjs/babel-plugin` tidak pernah di-wire di `next.config.ts` `apps/web`, sehingga prop `xstyle`+`stylex.create()` (mekanisme kustomisasi resmi Astryx) gagal di runtime (`"Unexpected 'stylex.create' call ... must be compiled by '@stylexjs/babel-plugin'"`). Workaround sementara: `className` Tailwind layout-only (rule 14 AGENTS.md) untuk kasus yang bisa diselesaikan lewat class utility biasa.
- **KI-030** — `TimeInput` Astryx tidak membatasi input real-time (elemen `<input>` internal `type="text"` tanpa `maxLength`/`pattern`), tidak ada prop resmi untuk membatasinya. Mitigasi wrapper `onKeyDownCapture`/`onPaste` sempat dicoba tapi **dihapus atas keputusan King Rezi** (2026-08-18) karena belum solid (tidak menangkap paste/drag-drop/IME) — menunggu Astryx menambah prop resmi.

### Verifikasi

- `tsc --noEmit` bersih.
- Vitest: `publish-now.use-case.test.ts` (baru, 357 baris), `fake-outstand-adapter.test.ts` (tambahan test `publishNow`), plus test terkait lain yang disesuaikan (`publishing.repository.ts`, `schedule-posts.use-case.test.ts`, `terminal-destination.test.ts`, `analytics-ingestion.use-case.test.ts`) — semua lulus.
- End-to-end browser: New Post → isi caption/target → klik "Publish Now" → dialog Confirmation Summary → konfirmasi → redirect ke Publish/Calendar → data di DB berstatus `published`.

### Dokumentasi terkait

- `project-manager/tasks/v02-publishing-mvp.md` § T-029 (Status ✅ Done, seluruh subtask T-029.1–.6 dicentang) dan § T-031 (T-031.4 dicentang, Status task ✅ Done).
- `project-manager/TASKS.md` — indeks v0.2 (7 ✅ · 12 ⏳), Total (21 selesai · 140 subtask), Fokus sekarang (T-029 dipindah jadi catatan Done, tersisa T-025).
- `project-manager/PROJECT_STATE.md` — Completed (Ringkasan) + Top Next Tasks diperbarui.

---

## 2026-08-14 — Bug fix: redirect `localhost:8080` di proxy/onboarding (root cause dari `request.url` di balik reverse proxy Railway)

### Context

Ditemukan ad-hoc saat King Rezi menguji login manual di staging (browser test, akun QA `raka.test@kopiselasar.com`): sesekali browser sempat di-redirect ke `http://localhost:8080` (gagal load, `ERR_SSL_PROTOCOL_ERROR`/`ERR_BLOCKED_BY_CLIENT`) sebelum session tetap terbentuk normal. Log Railway (`railway logs`) mengonfirmasi `next start` di container memang bind internal ke `localhost:8080` — cocok dengan console error browser "Failed to fetch RSC payload for .../onboarding/resume. Falling back to browser navigation."

### Root cause

`proxy.ts` (Next.js Middleware, 5 titik) dan `app/onboarding/resume/route.ts` (2 titik) membangun redirect pakai `new URL(path, request.url)`. `request.url` mencerminkan Host header yang diterima proses Next.js — di balik reverse proxy Railway, ini bisa jadi alamat bind internal container (`http://localhost:8080`) alih-alih domain publik, khususnya saat race di request awal (container baru start/warm-up). Alur redirect: `proxy.ts` (workspace cookie belum ke-set) → `/onboarding` → `onboarding/page.tsx` → `/onboarding/resume` → route handler ini — semua titik memakai pola yang sama, jadi kalau origin salah di satu titik, tetap salah di seluruh chain.

### Yang diubah

- **`apps/web/src/proxy.ts`**: tambah helper `redirectTo(path)` yang membangun origin dari `getServerEnv().BETTER_AUTH_URL` (bukan `request.url`). 5 pemanggil `NextResponse.redirect(new URL(..., request.url))` diganti pakai helper ini.
- **`apps/web/src/app/onboarding/resume/route.ts`**: origin redirect diambil sekali di awal handler (`getServerEnv().BETTER_AUTH_URL`), dipakai di 2 titik redirect (`/login`, `/` atau `/onboarding`).
- Pola ini konsisten dengan base URL publik yang sudah dipakai untuk invite link (`settings/members/actions.ts:106`).

### Verifikasi

- `tsc --noEmit` bersih (apps/web).
- `eslint .` tidak ada error baru pada file yang diubah (warning "Pages directory cannot be found" pre-existing, tidak terkait).
- Login manual lokal (`bun run dev`, akun QA Raka Pratama): logout → login → dashboard, tidak ada redirect salah, tidak ada regresi, console bersih.
- Tidak sempat direproduksi ulang di staging secara deterministik (bug bersifat race/kondisional) — perbaikan berdasarkan root cause yang terkonfirmasi dari log Railway + kode, bukan dari reproduksi berulang.

### Known Issues terdampak

- Tidak ada KI baru dibuka. Bukan task bernomor (perbaikan ad-hoc, ditemukan di luar backlog formal). Tidak ada ADR baru — ini bug fix, bukan perubahan baseline arsitektur.

---

## 2026-08-14 — ADR-081: Open question local dev ditutup — local resmi menumpang ke project staging

### Context

King Rezi menjawab open question yang tercatat di ADR-081 (entri di bawah): local development **tidak** akan memakai project Supabase terpisah — akan menumpang ke project staging yang sama (ref `ndcrkzqgqukqfmekgoze`). Alasan: efisiensi/kesederhanaan operasional, project ini baru satu-satunya yang aktif. Ini adalah finalisasi/kelanjutan ADR-081 yang sudah ada, **bukan** ADR baru terpisah.

### Yang diubah

- **`project-manager/decisions/ADR-081-...md`**: bagian open question diganti jadi keputusan final (poin 4 di Decision) — local development resmi menumpang ke project staging yang sama, tanpa isolasi database local↔staging. Ditambahkan sub-bagian konsekuensi yang disadari (migrasi/eksperimen lokal langsung menyentuh data staging; EM-D06 dikecualikan untuk pasangan local↔staging, tetap penuh untuk staging↔production). Bagian "Alternatives Considered" diupdate — opsi project local terpisah kini eksplisit **ditolak** (bukan lagi "belum diputuskan").
- **`project-manager/DECISIONS.md`**: baris indeks ADR-081 diupdate — kalimat "open question" dihapus, diganti ringkasan keputusan final.
- **`product-discovery/06-engineering/environment-management.md`**: EM-D02, diagram/tabel Environment Tiers, Secret Management, Perbedaan Konfigurasi per Tier (baris Migrate/Seed-reset), Alur Setup Local, dan Decision Log (EM-D06 dicatat pengecualian eksplisit, EM-D10 dirapikan, **EM-D11 baru** untuk keputusan final) — seluruh referensi "open question" strategi local dev dihapus/ditandai selesai.
- **`project-manager/PROJECT_STATE.md`**: dicek — tidak ada referensi eksplisit ke open question ini di file tersebut (KI-028 hanya membahas gap production, tidak terdampak), jadi tidak ada perubahan.

### Known Issues terdampak

- Tidak ada — KI-028 (gap production) tetap terbuka, tidak terkait closure open question ini.

---

## 2026-08-14 — ADR-081: Project Supabase existing resmi jadi staging permanen (amandemen EM-D02)

### Context

King Rezi mengonfirmasi eksplisit bahwa pemakaian project Supabase Cloud existing ("Sosial Media Management", ref `ndcrkzqgqukqfmekgoze`, region Singapore `ap-southeast-1`) sebagai database **staging** — dicatat sebagai gap terhadap EM-D02 saat penutupan KI-025 (entri 2026-08-14 di atas) — adalah keputusan **permanen**, bukan shortcut sementara.

### Yang diubah

- **ADR baru ADR-081** ditambahkan di `project-manager/DECISIONS.md` + `project-manager/decisions/ADR-081-project-supabase-existing-resmi-jadi-staging-amandemen-em-d02.md`, mengamandemen **ADR-033/EM-D02**.
- **ADR-033** (`project-manager/decisions/ADR-033-...md` dan baris indeks di `DECISIONS.md`): Status ditandai `Accepted — Amended by ADR-081 (2026-08-14)`.
- **`product-discovery/06-engineering/environment-management.md`**: EM-D02, diagram/tabel Environment Tiers, Secret Management, Alur Setup Local, dan Decision Log (baris EM-D09/EM-D10 baru) diupdate — project existing resmi jadi staging, rencana project `social-media-local` terpisah dibatalkan. Strategi local development pasca-amandemen ditandai **open question** (belum diputuskan).
- **`project-manager/PROJECT_STATE.md`** (KI-028): kalimat disesuaikan — "staging saat ini memakai" → "staging permanen memakai", ditambah referensi ADR-081.
- **Tidak diubah** (di luar scope): DI-D03 (`deployment-infrastructure.md`, isolasi staging↔production tetap wajib project terpisah) dan KI-028 (production project belum dibuat, tetap open).

### Known Issues terdampak

- KI-028 tetap terbuka — tidak resolved oleh ADR ini (hanya soal staging, bukan production).

---

## 2026-08-14 — Railway staging deploy live: KI-025 resolved, KI-028 (gap production) dibuka

### Context

Deploy pertama kalinya project ke Railway. Menutup KI-025 ("belum ada project Railway sama sekali") dengan bukti deploy staging sukses + verifikasi runtime, bukan cuma pembuatan project.

### Yang dibuat/diverifikasi

- **Project Railway** `social-media-management` (workspace Insvire), environment `staging`, region Singapore (`asia-southeast1-eqsg3a`) sesuai DI-D01.
- **Service `web`** (Next.js) — connect ke branch `staging` GitHub repo. Build command `bun install && bun run build`, `preDeployCommand` `cd apps/web && bunx prisma migrate deploy`, `startCommand` `bun run --cwd apps/web start`, healthcheck `/api/health`. Domain: `web-staging-60d7.up.railway.app`. Deploy SUCCESS, health check 200 OK terverifikasi.
- **Service `cron`** — image `curlimages/curl:latest`, `cronSchedule` `* * * * *`, trigger `POST /api/jobs/run` dengan header `X-Job-Secret`. 2x run berturut-turut SUCCESS.
- **Env var staging** lengkap dan terisi nilai asli/generated: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `JOB_SECRET`. `BETTER_AUTH_API_KEY` sengaja dikosongkan (ADR-070). `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`OUTSTAND_API_KEY`/`OUTSTAND_WEBHOOK_SECRET` masih placeholder dummy — 4 env var tersisa dari known gap sebelumnya (JOB_SECRET kini sudah diisi nilai asli generated).
- **Database staging**: memakai project Supabase Cloud yang **sudah ada sebelumnya** ("Sosial Media Management", ref `ndcrkzqgqukqfmekgoze`, region Singapore) — keputusan eksplisit King Rezi, bukan project baru terpisah seperti disebut awal di EM-D02. Project Supabase untuk **production** belum dibuat sama sekali.
- **Git**: branch `staging` dibuat dari `main` dan di-push ke GitHub (repo sebelumnya cuma punya `main`).
- **Bug fix**: script `prepare` di root `package.json` (`lefthook install`) gagal di container build Railway (tidak ada git hooks context) — diubah jadi `lefthook install || true`, di-commit ke branch `staging`.
- **Railway MCP server** (`https://mcp.railway.com`) didaftarkan ke `.mcp.json` dan `.cursor/mcp.json` (dua file kembar, ADR-064) via `railway setup agent --oauth`.
- **Branch protection GitHub** diaktifkan untuk `main` dan `staging`: wajib PR (no direct push), wajib status check "Quality gates" (workflow CI `.github/workflows/ci.yml`) hijau sebelum merge, force-push & delete branch diblokir, required approving reviews = 0 (solo developer).

### Known Issues terdampak

- **KI-025 resolved** — dihapus dari daftar Known Issues aktif di `PROJECT_STATE.md` (sesuai konvensi ADR-066/067, riwayat lengkap ada di sini).
- **KI-015** — status berubah jadi "Sebagian Resolved": `JOB_SECRET` sudah resolved (staging), sisa scope `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.
- **KI-028 dibuka** (baru) — production Railway environment dan production Supabase project belum dibuat sama sekali; menyusul setelah KI-003/KI-015 (Outstand/Google) resolved atau sesuai prioritas King Rezi.

### Catatan untuk King Rezi (flag, bukan keputusan final)

Keputusan memakai project Supabase existing "Sosial Media Management" sebagai database staging (alih-alih membuat project baru terpisah) berpotensi menyimpang dari premis awal EM-D02. Ini dicatat di sini sebagai temuan governance — belum dibuatkan ADR baru karena instruksi sesi ini secara eksplisit meminta konfirmasi dulu ke King Rezi sebelum menulis ADR.

---

## 2026-08-14 — T-007.1/.5/.6 (Members management: Invite via Copy Link + safety dialogs Remove/Update Role): selesai

### Context

Bagian dari T-007 (Members management), memakai ADR-080 (invite dipecah dua metode — Copy Link vs Kirim via Email, amandemen ADR-072). Dikerjakan dalam satu sesi, direview Ridwan Architecture Reviewer dan diverifikasi Najwa QA Engineer.

### T-007.1 — `WorkspaceService.inviteMember` (jalur Copy Link)

Generate invitation email-bound + token, tidak bergantung T-005 (provider email). `removeMember` dan `updateMemberRole` (RBAC Owner/Admin) juga bagian subtask ini — sudah selesai sebelumnya, dikonfirmasi ulang tetap benar. Jalur "Kirim via Email" tetap terpisah sebagai T-007.7, masih blocked T-005.

**Catatan cakupan (ditemukan CodeRabbit, review PR #73):** subtask ini hanya membuat invitation + link — halaman `/invite/[token]` (accept-invite: validasi token, buat akun/login dengan email yang sama, insert `workspace_members`) **belum dibuat sama sekali** (ADR-072 "future work" terpisah, belum ada nomor T-XXX). Link yang dihasilkan hari ini 404 kalau dibuka. Jangan anggap alur invite-to-membership sudah utuh sampai halaman itu ada.

### T-007.5 — Dialog konfirmasi Remove Member + Update Member Role

ADR-049 Tier 2 — dialog konfirmasi sebelum aksi Remove Member dan Update Member Role dieksekusi.

### T-007.6 — UI dialog Invite Member (2 metode)

Dialog "Undang Anggota Baru" dengan Selector Role, 2 opsi metode (Copy Link default aktif, Kirim via Email disabled berbadge "Segera"), field email-bound wajib, link readonly + tombol Salin — sesuai desain yang sudah dikonfirmasi King Rezi di Claude Design (`templates/settings-members.html`, 2026-08-14).

### Fix tambahan selama implementasi

Heading duplikat "Members" sempat muncul (komponen `MembersTable` merender heading section-nya sendiri berdampingan dengan heading halaman) — diperbaiki dengan menambah slot `headerAction` baru di `MembersTable`, dipakai untuk menaruh tombol "Undang Anggota" tanpa mengulang judul.

### Review Ridwan Architecture Reviewer

Bersih, tanpa temuan.

### QA Najwa

Full suite (typecheck/lint/test: 126 passed + 3 skip pre-existing) hijau. Yang **benar-benar terverifikasi** di browser: gating tombol submit (disabled sampai email valid), radio group Copy Link/Kirim via Email tampil sesuai desain, dialog konfirmasi Remove Member/Update Role termount dengan copy yang benar. Yang **tidak** berhasil dibuktikan hidup (dikoreksi setelah review CodeRabbit menandai klaim "golden path ... diverifikasi" sebelumnya tidak akurat): klik "Buat Link Undangan" gagal dengan error `Missing required server environment variables: JOB_SECRET` — generate-link-lalu-salin belum pernah dibuktikan sukses secara visual. Remove Member dan Update Role **tidak** bisa diuji end-to-end penuh secara live — dev DB saat ini cuma punya 1 member (belum ada akun kedua nyata untuk jadi target aksi). Keduanya known gap lingkungan (KI-015), bukan bug baru dari task ini.

### Status task T-007

Tetap `🟡 In Progress` — sisa T-007.7 (jalur Kirim via Email) masih blocked T-005 (provider email transactional belum ditetapkan).

---

## 2026-08-13 — T-008 (Workspace Settings — General + Danger Zone): implementasi selesai, 1 open item desain belum ditutup

### Context

T-008.2–.4 dikerjakan dalam satu sesi oleh dua subagent berurutan: Prabowo Feature Engineer (backend) lalu Mark UI Engineer (UI), direview Ridwan Architecture Reviewer, dan diverifikasi Najwa QA Engineer.

### T-008.2 — `deleteWorkspace`

RBAC Owner-only, cascade delete via `ON DELETE CASCADE`. Ditemukan gap: baseline menyatakan seluruh tabel `workspace_id` sudah cascade, tapi realita `schema.prisma` awal masih RESTRICT di beberapa tabel. Diperbaiki lewat 2 migration applied ke DB nyata:

- `20260813085308_t008_workspace_transfer_ownership_delete` — 6 tabel: `publishing_posts`, `ai_requests`, `engagement_inbox_items`, `analytics_workspace_snapshots`, `media_items`, `notifications`.
- `20260813092018_t008_cascade_connected_account_and_engagement_reply` — 4 FK tambahan ditemukan Ridwan: `publishing_post_targets.connected_account_id`, `publishing_queue_slots.connected_account_id`, `engagement_inbox_items.connected_account_id`, `engagement_replies.inbox_item_id` (yang terakhir sebelumnya sama sekali tidak punya jalur cascade dari `workspaces`).

### T-008.3 — `transferOwnership` + `acceptOwnershipTransfer` + `cancelOwnershipTransfer`

Kolom baru `workspaces.pending_owner_transfer_to`. `transferOwnership` (RBAC Owner, target harus Admin aktif) set pending state + kirim notifikasi `ownership_transfer_requested`, tidak langsung swap role. `acceptOwnershipTransfer` (RBAC hanya target) swap role Owner↔Admin dalam satu transaksi + notifikasi `ownership_transfer_resolved`. Ditambah `cancelOwnershipTransfer` (tidak eksplisit di baseline awal, ditambahkan karena UI butuh tombol "Batalkan Permintaan" di pending banner — konsisten pola RBAC Owner-only). Domain `notification` (sebelumnya scaffold kosong) diisi minimal (`NotificationService.notify`), dipanggil workspace service via port lokal, bukan import langsung — cross-domain boundary terjaga.

Fix review Ridwan putaran ke-2: logic "siapa yang eligible jadi target Transfer Ownership" (Admin + status Active) sebelumnya terduplikasi di RSC `page.tsx` dan service — diekstrak jadi `WorkspaceService.listTransferEligibleMembers` (satu sumber kebenaran, dipakai baik untuk render UI maupun validasi transfer).

### T-008.4 — UI

`apps/web/src/app/(app)/settings/page.tsx` + `components/WorkspaceGeneralSettings.tsx`. Card General (rename, tanpa konfirmasi) + Card Danger Zone (hidden total untuk non-Owner, bukan cuma disabled) dengan 2 dialog Tier 1 "ketik nama workspace untuk konfirmasi" (Transfer Ownership, Hapus Workspace) — pola baru, dikomposisi dari Dialog+Field+TextInput Astryx yang sudah ada, tanpa komponen baru.

### Gap desain terbuka — BELUM dikonfirmasi King Rezi

Mockup `templates/settings-general.html` di Claude Design tidak menunjukkan cara memilih Admin target sebelum dialog Transfer Ownership dibuka. Mark UI Engineer menambahkan `Selector` Admin aktif sebagai keputusan implementasi sendiri (bukan sesuai desain final) — dicatat sebagai open item (KI-027), bukan langsung ditutup sebagai selesai 100%, karena butuh konfirmasi/update balik ke Claude Design.

### QA Najwa

Full suite (typecheck/lint/test: 118 passed + 3 skip pre-existing) hijau. Golden path rename ✅, Danger Zone visible+correct untuk Owner ✅, dialog type-to-confirm (salah→disabled, benar→enabled) ✅, RBAC hidden-by-code untuk non-Owner ✅ (verified via code review, bukan live 2-akun), delete workspace end-to-end nyata berhasil (dipakai sekaligus sebagai test cleanup). 3 item TIDAK diverifikasi live (Selector dengan data Admin sungguhan, RBAC live dengan akun non-Owner, alur transfer 2-akun end-to-end) karena fitur invite member (T-007.1) belum selesai sehingga tidak bisa membuat akun Admin kedua di workspace yang sama — dicatat sebagai limitation environment, bukan bug.

### Dampak dokumentasi

`tasks/v01-foundation.md` § T-008: T-008.1–.4 dicentang selesai, status task tetap `🟡 In Progress` (bukan `✅ Done`) karena open item desain Selector belum dikonfirmasi. `PROJECT_STATE.md`: Completed (Ringkasan) ditambah entry T-008 (item terlama T-040 dihapus dari daftar untuk menjaga batas 5), Known Issues ditambah KI-027. Tidak ada perubahan di `TASKS.md` Fokus sekarang (T-008 memang bukan bagian dari fokus itu) maupun hitungan Total subtask (masih 138, T-008 tidak menambah/mengurangi jumlah subtask terdefinisi). Tidak ada ADR baru — ini implementasi dari task yang sudah ada (T-008, ADR-049/ADR-050), deviasi kecil Selector adalah gap implementasi menunggu konfirmasi desain, bukan perubahan keputusan arsitektur.

---

## 2026-08-13 — KI-026 resolved: RLS BYPASSRLS diperbaiki + 2 bug desain policy `workspace_members` ditemukan & diperbaiki

### Context

Lanjutan dari T-017 (lihat entri di bawah, dikerjakan hari yang sama). Setelah T-017 ditutup dengan gap runtime terpisah (KI-026: role koneksi `postgres` punya `BYPASSRLS = true` sehingga RLS belum efektif), King Rezi menindaklanjuti langsung di sesi yang sama.

### Root cause & resolusi

King Rezi membuat role Postgres baru `app_runtime` (tanpa `BYPASSRLS`) via Supabase SQL Editor — grant CRUD ke semua tabel `public` + default privileges untuk tabel baru. `DATABASE_URL` dipindah ke role ini; `DIRECT_URL` sengaja **tetap** memakai role `postgres` (butuh privilege DDL untuk `prisma migrate deploy` — keputusan sadar, bukan oversight).

Setelah RLS benar-benar aktif (bukan lagi dilewati BYPASSRLS), ditemukan 2 bug desain baru yang sebelumnya tersembunyi (root cause sama: policy lama ditulis dengan asumsi tidak pernah benar-benar dieksekusi):

1. **Infinite recursion** pada policy `workspace_members_workspace_isolation` — policy tabel `workspace_members` melakukan subquery ke tabel itu sendiri, memicu Postgres error "infinite recursion detected in policy". Fix: migration `20260813073556_t017_fix_workspace_members_rls_recursion` — pecah subquery jadi `SECURITY DEFINER` function `current_user_workspace_ids()` (dimiliki role `postgres`/BYPASSRLS, jadi tidak memicu ulang RLS saat dipanggil dari dalam function).
2. **INSERT bootstrap gap** — policy asli pakai `FOR ALL` (WITH CHECK = USING), sehingga insert membership pertama (owner baru bikin workspace) gagal karena user itu belum terdaftar jadi member aktif manapun (chicken-and-egg). Ditambah, Prisma selalu `INSERT ... RETURNING`, jadi SELECT-policy juga dicek ke baris yang baru diinsert. Fix 2 migration:
   - `20260813073842_t017_split_workspace_members_insert_policy` — pisah `FOR ALL` jadi `FOR SELECT/UPDATE/DELETE` (tetap strict, pakai function) + `FOR INSERT WITH CHECK (true)` terpisah (aman karena authorization utama tetap di Application Service/RBAC per DB-D05 — insert ke `workspace_members` cuma dipanggil dari `WorkspaceRepository.createWithOwner`, sudah divalidasi di service layer).
   - `20260813074306_t017_allow_self_visibility_workspace_members` — tambah klausa `OR user_id = current_setting('app.current_user_id', true)` langsung (tanpa subquery) di SELECT policy, supaya baris yang baru diinsert bisa langsung "melihat dirinya sendiri" tanpa perlu query ulang tabel (yang tidak akan melihat baris in-flight).

Fix kode aplikasi terkait: `apps/web/src/lib/repositories/workspace/workspace.repository.ts` method `createWithOwner` sekarang set `app.current_user_id = ownerId` (via `tx.$executeRaw` `set_config`) di awal transaksi, sebelum insert workspace + membership pertama — supaya SELECT-policy self-visibility di atas bisa match.

Test `apps/web/src/lib/prisma/with-current-user.test.ts` diupdate: 2 assertion yang tadinya berlabel "KNOWN GAP" (mendokumentasikan bug BYPASSRLS lama) sekarang dibalik jadi assertion positif (cross-workspace row tidak terlihat; default-deny tanpa `SET LOCAL` benar-benar terjadi) — sesuai instruksi yang sudah ditulis di komentar test itu sendiri sejak awal. Setup `beforeAll` di test juga diupdate untuk pakai `withCurrentUser` (pola sama seperti fix repository).

Verifikasi: full test suite `bun run test` (dengan `DATABASE_URL` nyata via `--env-file`) → 14 file test, 105 passed + 1 skipped (skip disengaja untuk environment tanpa DB). `tsc --noEmit` bersih. Tidak ada regresi di test lain yang menyentuh `workspace_members`/`workspaces`.

Ketiga migration baru sudah **applied ke database Supabase nyata** (`bunx prisma migrate deploy`), bukan cuma file lokal.

Railway belum pernah dibuat/dipakai sama sekali oleh King Rezi saat ini — jadi tidak ada perubahan env var production dari pekerjaan ini, hanya `apps/web/.env.local` (lokal). Blocker "Railway belum pernah dibuat" (KI-025) tidak berubah. Follow-up King Rezi di masa depan: begitu Railway project pertama dibuat & deploy production, `DATABASE_URL` production juga perlu di-set ke role `app_runtime` (pola sama seperti `.env.local`), `DIRECT_URL` tetap `postgres`.

### File yang berubah

- `apps/web/src/lib/prisma/with-current-user.test.ts` (modified)
- `apps/web/src/lib/repositories/workspace/workspace.repository.ts` (modified)
- `apps/web/prisma/migrations/20260813073556_t017_fix_workspace_members_rls_recursion/migration.sql` (baru, applied)
- `apps/web/prisma/migrations/20260813073842_t017_split_workspace_members_insert_policy/migration.sql` (baru, applied)
- `apps/web/prisma/migrations/20260813074306_t017_allow_self_visibility_workspace_members/migration.sql` (baru, applied)

### Dampak dokumentasi

KI-026 dihapus dari daftar Known Issues di `PROJECT_STATE.md` (status Resolved, riwayat lengkap ada di entri ini, ID tidak didaur ulang). T-017 di `tasks/v01-foundation.md` tetap ✅ Done, catatan gap runtime dan 2 assertion "KNOWN GAP" diupdate jadi resolved. Tidak ada ADR baru — ini bugfix/implementasi dari task yang sudah ada (T-017), bukan perubahan baseline arsitektur.

---

## 2026-08-13 — T-017 (RLS SQL policies), T-019 (skema API mobile) selesai; T-008 desain dimulai; T-018 di-defer

### Context

King Rezi meminta laporan task yang bisa dikerjakan, lalu mengerjakan beberapa secara paralel dalam satu sesi: T-017 didelegasikan ke Elon Backend Engineer (subagent), T-019 dikerjakan langsung di sesi utama, T-008 (Workspace Settings) sedang didesain King Rezi sendiri di Claude Design, dan T-018 (investigasi hydration ngrok) ditemukan sudah superseded oleh ADR-070.

### T-018 — Deferred (superseded ADR-070)

Investigasi awal (dugaan bug HMR/Turbopack lewat ngrok) ternyata sudah terjawab oleh ADR-070 (2026-08-06): requirement ngrok berasal dari constraint Better Auth Cloud (Base URL wajib publik), bukan keterbatasan Better Auth self-hosted. Setelah kembali ke self-hosted, testing browser langsung via `localhost:3000` — ngrok tidak lagi dipakai. T-018.1/.2 dicoret (tidak relevan lagi), T-018.3 tidak dilanjutkan. Status diubah ke ⏸️ Deferred di `tasks/v01-foundation.md`. Catatan basi di T-004 (salah merujuk "T-017" untuk isu ngrok, seharusnya T-018) juga diperbaiki.

### T-008 — Desain dimulai (belum implementasi kode)

Cek Claude Design project "Social Media Management": belum ada rancangan Workspace Settings → General + Danger Zone (slot "General" di sidebar Organization masih dead-link `href="#"` di 5 file `settings-*.html`). Disusun brief desain lengkap (file baru `templates/settings-general.html`, pola Tier 1 "ketik nama workspace untuk konfirmasi" baru — belum ada preseden di `components/dialog.html`, alur Transfer Ownership dua langkah ADR-050, RBAC Danger Zone Owner-only, wiring ke `AppPrototype.dc.html` + `readme.md`). King Rezi mengerjakan desainnya sendiri langsung di Claude Design (bukan via subagent/`DesignSync`). Status T-008 diubah ke 🟡 In Progress dengan instruksi eksplisit untuk sesi berikutnya: cek `DesignSync` dulu sebelum lanjut implementasi kode (aturan keras #17).

### T-019 — Selesai (skema API mobile `/api/v1` + Better Auth Bearer plugin, ADR-043)

File diubah/ditambah:
- `apps/web/src/lib/better-auth/auth.ts` — `bearer()` plugin aktif tanpa syarat (bareng `dash` kondisional), `trustedOrigins` dari env `BETTER_AUTH_TRUSTED_ORIGINS` (opsional, kosong untuk sekarang), `rateLimit.customRules` diperketat untuk `/sign-in/email` (60s/5) dan `/sign-up/email` (60s/3)
- `apps/web/src/proxy.ts` — `/api/v1` ditambahkan ke `BYPASS_PREFIXES` supaya request Bearer tidak kena redirect `/login`
- `apps/web/src/app/api/v1/health/route.ts` (baru) — endpoint skema pembuktian wiring (bukan endpoint bisnis), validasi session via `auth.api.getSession`

Verifikasi: `typecheck`/`lint`/`test` (103 test) hijau. Uji manual curl dengan Bearer token asli belum dilakukan. Catatan terbuka (bukan blocker, follow-up sebelum endpoint mobile pertama dirilis): keputusan durasi session mobile, isi `trustedOrigins` dengan scheme mobile nyata, secure storage token di client (ADR-043 §7).

### T-017 — Selesai dengan gap runtime terpisah (RLS SQL policies, KI-026)

Dikerjakan Elon Backend Engineer (subagent), 2 putaran konfirmasi King Rezi di tengah jalan karena 2 gap ditemukan:

1. **Gap tipe data** — baseline SQL (`database-strategy.md`/`database-orm.md`) mencontohkan cast `current_setting(...)::uuid` untuk `app.current_user_id`, tapi `identity_user.id` (Better Auth) adalah `cuid()` text, bukan UUID. Dikoreksi langsung di kedua dokumen baseline (bukan ADR baru — koreksi tipe pada contoh, bukan perubahan keputusan RLS) + SQL migration pakai perbandingan text untuk `user_id` (`workspace_id` tetap `::uuid`).
2. **Gap BYPASSRLS (lebih serius, KI-026 baru)** — role Postgres `postgres` yang dipakai `DATABASE_URL`/`DIRECT_URL` punya `rolbypassrls = true` (default Supabase), sehingga seluruh policy RLS **tidak efektif** di runtime nyata meski benar secara desain dan sudah applied. Authorization tetap 100% di Application Service (RBAC) untuk sekarang — sesuai desain DB-D05, bukan regresi. Follow-up (butuh King Rezi, dashboard Supabase): buat role `app_runtime` baru tanpa BYPASSRLS, pindahkan `DATABASE_URL`/`DIRECT_URL`.

File dibuat/diubah:
- `apps/web/src/lib/prisma/with-current-user.ts` (baru) — helper `withCurrentUser(userId, callback)`, `prisma.$transaction` + `set_config('app.current_user_id', $1, true)` (tagged-template, aman SQL injection)
- `apps/web/prisma/migrations/20260813045625_t017_add_rls_policies/migration.sql` (baru, applied ke DB nyata) — RLS untuk 16 tabel (12 `workspace_id` langsung + 4 EXISTS-join ke parent + `analytics_post_metrics` via subquery `publishing_posts`)
- `apps/web/src/lib/repositories/workspace/workspace.repository.ts` — adopsi contoh (`getMember` lewat `withCurrentUser`; adopsi penuh sengaja ditunda)
- `apps/web/src/lib/prisma/with-current-user.test.ts` (baru) — integration test nyata ke Supabase (auto-skip tanpa `DATABASE_URL`), termasuk 2 assertion eksplisit "KNOWN GAP" yang membuktikan BYPASSRLS
- `product-discovery/05-architecture/database-strategy.md`, `product-discovery/06-engineering/database-orm.md` — koreksi contoh SQL + catatan status runtime
- `project-manager/PROJECT_STATE.md` — KI-002 (RLS belum digenerate) di-resolve dan dihapus dari daftar Known Issues (riwayatnya di sini); KI-026 baru ditambahkan
- `project-manager/tasks/v01-foundation.md`, `project-manager/TASKS.md` — status T-017/T-019/T-008/T-018 + indeks v0.1 diperbarui

---

## 2026-08-13 — T-042.2–T-042.5 selesai: Dashboard Home tuntas (v0.3)

### Context

King Rezi menyelesaikan sisa subtask T-042 (Dashboard Home, v0.3 Analytics MVP) lewat 3 subagent sekuensial (analytics · UI, sesuai pemetaan ADR-063): Prabowo Feature Engineer (T-042.2, query/service/action), Mark UI Engineer (T-042.3–T-042.5, UI), lalu diverifikasi Najwa QA Engineer dan Ridwan Architecture Reviewer (keduanya tidak ada temuan). Seluruh subtask T-042.1–T-042.5 sekarang selesai.

### File dibuat

- `apps/web/src/app/(app)/components/DashboardHome.tsx` — Client Component dashboard, `useTransition` untuk re-fetch saat selector rentang waktu diganti

### File diubah

- `apps/web/src/domains/analytics/types.ts` — type baru `DashboardSummary` (`totalPosts`, `totalEngagements`, `avgEngagementRate`, `activeAccounts`)
- `apps/web/src/domains/analytics/services/analytics.service.ts` — method baru `getDashboardSummary(workspaceId, period)`, return `null` kalau belum ada snapshot (empty state); interface lokal `ActiveAccountsPort` (tidak di-export lewat barrel, pola sama seperti `ScheduledCountsPort`/ADR-078) untuk cross-domain ke workspace
- `apps/web/src/domains/workspace/services/workspace.service.ts` — method baru `countActiveConnectedAccounts(workspaceId)` (hitung `WorkspaceConnectedAccount.status === "active"`)
- `apps/web/src/app/(app)/dashboard-actions.ts` — Server Action baru `getDashboardSummaryAction(period)`, composition root (instansiasi `AnalyticsService` + `WorkspaceService` dari barrel publik masing-masing domain)
- `apps/web/src/app/(app)/page.tsx` — diganti dari `ScaffoldPlaceholder` jadi Server Component yang panggil `getDashboardSummaryAction("weekly")` dan render `<DashboardHome>`
- `apps/web/src/domains/analytics/services/analytics.service.test.ts`, `apps/web/src/domains/workspace/services/workspace.service.test.ts` — test baru untuk method di atas

### Desain

Komponen Astryx yang dipakai diverifikasi lewat `astryx component <Name> --dense` (bukan tebakan): `Selector` (rentang waktu weekly/monthly, T-042.5), `Card`/`Grid`/`HStack`/`VStack`/`Section`/`Heading`/`Text` (stat tiles, T-042.3), `ProgressBar` (representasi `avgEngagementRate` — dikonfirmasi ulang Astryx tidak punya komponen Chart lewat `astryx docs chart`, jadi tidak menambah dependency chart baru seperti `recharts`), `EmptyState` (T-042.4, pola sama seperti `DraftsList.tsx`/`ConnectedAccountsList.tsx`).

### QA (Najwa)

`bun run typecheck`, `bun run lint`, `bun run test` (root, vitest config ada di root) semua hijau, 103/103 test lulus. Verifikasi visual dengan seed data dummy sementara (sudah di-cleanup, dikonfirmasi 0 sisa row) untuk workspace Insvire: stat tiles dan ProgressBar tampil benar untuk period weekly & monthly, dark mode aman, tidak ada regresi di sidebar channel count / halaman Publish.

### Review arsitektur (Ridwan)

Tidak ada temuan — entry point bersih dari business logic, domain tidak import Prisma/Supabase langsung, cross-domain analytics→workspace lewat port/adapter pattern konsisten dengan `ScheduledCountsPort` existing (bukan pelanggaran boundary), `DashboardSummary` tepat di domain types (bukan `packages/shared`), UI 100% komponen Astryx tanpa hardcode style.

### Hasil

T-042 (Status `✅ Done`, seluruh subtask T-042.1–.5 selesai). Tidak ada ADR baru — implementasi mengikuti pola existing (ScheduledCountsPort/ADR-078, FakeOutstandAdapter/ADR-059+ADR-079), bukan keputusan arsitektur baru. Dokumentasi diperbarui: `tasks/v03-analytics-mvp.md` § T-042 (checklist dicentang, status ✅ Done, paragraf implementasi), `TASKS.md` (indeks v0.3 jadi 3 ✅ · 3 ⏳, Total jadi 17 selesai), `PROJECT_STATE.md` (Completed Ringkasan — bullet T-042.2–.5 ditambah, bullet T-039.5 terlama dihapus untuk menjaga batas 5 item; KI-003 prosa diperbarui menyebut T-042 ✅ Done).

---

## 2026-08-13 — T-041 selesai: Metric ingestion job dari Outstand (v0.3, Fake/mock, ADR-079)

### Context

King Rezi menyelesaikan implementasi T-041 (Metric ingestion job dari Outstand, v0.3 Analytics MVP) lewat Elon Backend Engineer, versi Fake/mock mengikuti pola ADR-059, karena kredensial Outstand asli (`OUTSTAND_API_KEY`) masih belum ada (KI-003). Keputusan material dicatat sebagai ADR-079 (amandemen ADR-059).

### Keputusan (ADR-079)

`IOutstandAdapter` dipromosikan dari domain-owned (`domains/publishing/adapters/outstand-adapter.ts`) ke kontrak cross-domain `packages/shared/src/contracts/outstand-adapter.ts`, dengan kategori baru untuk isi `packages/shared`: port/ACL contract. Domain `publishing` tetap mengimpor dari lokasi lama karena file itu dipertahankan sebagai barrel re-export.

### File dibuat

- `packages/shared/src/contracts/outstand-adapter.ts` — kontrak `IOutstandAdapter` cross-domain, method baru `fetchPostMetrics(outstandJobId)` dan `fetchWorkspaceMetrics(outstandAccountId, period)`
- `apps/web/src/domains/analytics/services/analytics-ingestion.use-case.ts` — `AnalyticsIngestionUseCase` (`syncPostMetrics`, `syncWorkspaceSnapshot`), terpisah dari `AnalyticsService` (pola ADR-059 poin 5)
- Migration `20260813023329_add_analytics_post_metric_unique`

### File diubah

- `apps/web/src/domains/publishing/adapters/outstand-adapter.ts` — jadi barrel re-export dari `@social/shared`
- `apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts` — extend `FakeOutstandAdapter` dengan data mock deterministik (hash FNV-1a dari id)
- `apps/web/src/domains/analytics/repositories/analytics.repository.ts` + implementasi Prisma-nya — tambah `upsertPostMetrics`/`upsertWorkspaceSnapshot`
- `apps/web/prisma/schema.prisma` — unique constraint baru `@@unique([postId, connectedAccountId])` pada `AnalyticsPostMetric`

### Desain

Idempotensi (T-041.5) ditegakkan lewat Prisma `upsert` asli di atas unique constraint DB, bukan insert-check-manual. Data mock deterministik (hash, bukan random) dipilih supaya hasil ingestion konsisten/reproducible antar test run. Frekuensi sync (T-041.3) ditetapkan kandidat harian, bukan 30 menit seperti engagement.

### Scope di luar T-041

Real Outstand API call (tetap T-025), cron/job scheduler asli Railway (tetap T-027), perhitungan `topPostId` (query agregat terpisah).

### Hasil

T-041 (Status `✅ Done`) menutup dependency T-042 dari sisi T-040+T-041 (T-042.2–.5 belum dikerjakan, tapi tidak lagi terblokir secara dependency — datanya tetap dari `FakeOutstandAdapter` sampai KI-003 resolved). Dokumentasi diperbarui: `DECISIONS.md` (baris ADR-079 + tag "Amended by" di ADR-059), `decisions/ADR-079-...md` (baru), `decisions/ADR-059-...md` (Status ditandai amended), `tasks/v03-analytics-mvp.md` § T-041 (checklist dicentang, status ✅ Done, catatan implementasi) + § T-042 (catatan dependency terpenuhi), `TASKS.md` (indeks v0.3 jadi 2 ✅ · 1 🟡 · 3 ⏳, Total jadi 16 selesai), `PROJECT_STATE.md` (Completed Ringkasan — bullet T-041 ditambah, bullet T-039.1–.3 terlama dihapus untuk menjaga batas 5 item; Recent Decisions ditambah ADR-079; KI-003 ditambah catatan T-041/T-042).

---

## 2026-08-12 — T-040 selesai: Analytics domain skeleton (v0.3)

### Context

King Rezi menyelesaikan implementasi T-040 (Analytics domain skeleton, v0.3 Analytics MVP) lewat Elon Backend Engineer. T-040.1–T-040.4 semuanya selesai, tidak ada yang di-skip, tidak ada gap skema Prisma.

### File dibuat

- `apps/web/src/domains/analytics/repositories/analytics.repository.ts` — `IAnalyticsRepository` (T-040.1)
- `apps/web/src/domains/analytics/services/analytics.service.ts` — `AnalyticsService` (T-040.2): `getPostMetrics(postId)`, `getWorkspaceSnapshot(workspaceId, period)`
- `apps/web/src/domains/analytics/services/analytics.service.test.ts` — unit test dengan fake repository (T-040.4), 4 test lulus
- `apps/web/src/lib/repositories/analytics/analytics.repository.ts` — implementasi Prisma `analyticsRepository`
- `apps/web/src/lib/repositories/analytics/index.ts` — barrel export implementasi

### File diubah

- `apps/web/src/domains/analytics/types.ts` — diisi `SnapshotPeriod = "weekly" | "monthly"` (sebelumnya `export {}`)
- `apps/web/src/domains/analytics/index.ts` — public API barrel di-extend (T-040.3)
- `packages/shared/src/ids.ts` — tambah factory `asPostMetricsId` dan `asWorkspaceSnapshotId`

### Desain

`IAnalyticsRepository` di T-040 ini sengaja hanya read path (selaras kontrak `application-layer.md`), method tulis untuk ingestion (`syncMetrics`) sengaja tidak ditambahkan karena itu scope T-041. `SnapshotPeriod` ditaruh lokal di domain analytics (bukan `packages/shared`) karena belum ada BC lain yang mengonsumsinya.

### Verifikasi

Full test suite `apps/web/src` + `packages/shared` → 11 file, 89 test, semua lulus (tidak ada regresi ke domain workspace/publishing). `tsc --noEmit` di `apps/web` bersih.

### Hasil

T-040 (Status `✅ Done`) menutup blocker desain untuk T-042.2–.5 dari sisi domain analytics — sisanya masih menunggu T-041 (Metric ingestion, terblokir KI-003/KI-025). Dokumentasi diperbarui: `tasks/v03-analytics-mvp.md` § T-040 (checklist T-040.1–.4 dicentang, status ✅ Done, catatan implementasi), `TASKS.md` (indeks v0.3 jadi 1 ✅ · 1 🟡 · 4 ⏳, Total jadi 15 selesai), `PROJECT_STATE.md` (Completed Ringkasan — bullet T-040 ditambah, bullet ADR-076 terlama dihapus untuk menjaga batas 5 item).

---

## 2026-08-12 — T-042.1 selesai: sesi desain Claude Design untuk Dashboard/Home

### Context

King Rezi minta mulai T-042.1 (sesi desain Claude Design untuk layar Dashboard/Home, bagian dari T-042 Dashboard Home, release v0.3), dengan permintaan tambahan: cek dulu apa yang perlu ditambahkan/diubah dari System Design yang sekarang. Dikerjakan di sesi utama (bukan subagent Neymar — DesignSync diketahui gagal di sesi subagent, lihat memory `feedback_designsync_subagent_limitation`).

### Temuan awal (perbandingan `templates/home.html` vs baseline KSP-01)

4 zona (Today's Schedule, Recent Activity, Engagement Snapshot, Analytics Snapshot) dan deep-link (KSP-01-F05) sudah fungsional di `AppPrototype.dc.html`. Gap yang ditemukan: (1) tidak ada satu pun empty-state meski KSP-01 State Handling mewajibkan 3 kondisi kosong + 1 keputusan "tetap tampil di angka nol"; (2) tidak ada visual chart untuk Analytics Snapshot dan component library belum pernah cek apakah Astryx punya komponen Chart; (3) tidak ada selector rentang waktu di Home; (4) deep-link item Failed di Recent Activity tidak menyorot item tujuan di Calendar. Dikonfirmasi ke King Rezi via `AskUserQuestion` — keempatnya dipilih untuk dikerjakan.

### Implementasi

- Cek CLI Astryx (`astryx docs chart` → topic tidak ada; `astryx component --list` + `--dense` untuk `EmptyState`/`ProgressBar`/`Selector`) — dikonfirmasi Astryx tidak punya komponen Chart, ada `EmptyState` (title/description/actions) dan `ProgressBar` (sudah dipakai sebagai `.bar-track`/`.bar-fill` di `templates/analyze-dashboard.html`).
- `styles.css`: tambah `.empty-title`/`.empty-desc` (mapping `EmptyState` anatomy) dan `.cal-card.is-arrival-highlight` + `@keyframes arrival-flash` (highlight sementara ~3.2s, self-clearing).
- `templates/home.html`: tambah blok kedua "Referensi State Kosong" (pola `.state-tag` side-by-side, sama seperti `auth-forgot-password.html`) untuk 4 state KSP-01 (Today's Schedule kosong + CTA Calendar, Recent Activity kosong, Engagement 0 unread tetap tampil, Analytics kosong + CTA Analyze). Analytics Snapshot default juga ditambah `.select` rentang waktu (reuse pola `analyze-dashboard.html`) dan `.bar-track`/`.bar-fill` untuk engagement rate.
- `templates/app-prototype/AppPrototype.dc.html`: wiring `route()` untuk 2 CTA baru (`home-empty-cta-calendar`/`-analyze`), plus logic highlight — klik item Failed di Recent Activity set flag, `inject()` menambah class `.is-arrival-highlight` ke `.cal-card.is-failed` yang sudah ada di Calendar (tidak mengubah `publish-calendar.html`) dan auto-scroll, lalu hapus class setelah ~3.2s.
- `readme.md`: section baru "Home (KSP-01) — Empty States, Analytics Snapshot & Arrival Highlight (T-042.1, 2026-08-12)" + update baris Files untuk `styles.css`/`home.html`/`AppPrototype.dc.html` + tabel Components (`.empty`, `.bar-track`/`.bar-fill`).

### Verifikasi

Tidak bisa verifikasi visual langsung (Browser pane butuh login claude.ai terpisah dari auth DesignSync) — diverifikasi via `get_file` re-read untuk konfirmasi konten tersimpan sesuai yang ditulis. Tidak ada perubahan pada tampilan default 4-zona Home yang sudah ada, atau screen lain manapun (scope discipline, `.claude/skills/claude-design-scope-discipline/SKILL.md`).

### Hasil

T-042.1 selesai. T-042.2–.5 (query real, render chart data asli, empty state di kode, selector di kode) tetap menunggu **T-040** (Analytics domain skeleton, tidak ada blocker) dan **T-041** (Metric ingestion, terblokir KI-003/KI-025) — sesi ini hanya referensi desain, bukan implementasi `apps/web`.

---

## 2026-08-12 — Audit konsistensi dokumentasi task/state/ADR + governance Gibran/PROJECT_RULES

### Context

King Rezi minta audit menyeluruh: apakah `TASKS.md`/`tasks/vXX-*.md`,
`PROJECT_STATE.md`, dan `DECISIONS.md`/`decisions/` sudah selaras, dan
apakah dokumen yang membantu AI (`AGENTS.md`, `context/`, skills, subagent,
config kembar ADR-064) aman tanpa gap. Dijalankan lewat 4 subagent audit
paralel (read-only), lalu King Rezi memutuskan 3 fork governance lewat
AskUserQuestion.

### Fixed

- **TASKS.md**: klaim "142 subtask (v0.1–v0.3)" → **138** (hitung ulang
  langsung dari `tasks/vXX-*.md`); contoh "nomor kosong" basi (T-019,
  T-037–T-039, sudah terisi) diganti nomor kosong yang benar-benar kosong
  (T-046–T-049, T-056–T-059, T-066–T-069, T-075–T-079); T-025 di "Fokus
  sekarang" diberi catatan blocker eksplisit KI-003.
- **tasks/v02-publishing-mvp.md**: T-025/T-026/T-027 diberi field
  `Terkait KI-003`/`KI-015`/`KI-025` (sebelumnya link satu arah — KI
  menyebut task, task tidak menyebut balik KI).
- **tasks/v01-foundation.md**: T-039 field `Terkait` ditambah `KI-024`.
- **PROJECT_STATE.md**: baris "69 task" → **71 task**; urutan section
  KI-024/KI-025 dibetulkan (sebelumnya 025 ditulis sebelum 024); baris
  Blockers KI-003 direvisi (bukan cuma env var, kode adapter juga belum
  ditulis); enum Status Known Issues diperluas menambahkan `Sebagian
  Resolved — sisa scope: <ID>` (dipakai KI-023, sebelumnya di luar enum
  dokumentasi); section **In Progress** dan **Next Tasks** dipangkas dari
  duplikasi detail subtask jadi pointer singkat ke `TASKS.md` (menegakkan
  ADR-062 yang sudah dinyatakan file ini sendiri tapi dilanggar sendiri).
- **DECISIONS.md** + 14 file `decisions/ADR-XXX.md` lama: backfill tag
  `Amended by` yang hilang — ADR-005/008/013/019/020/022/023/025/036
  (diamendemen ADR-040), ADR-035/038 (ADR-041), ADR-014 (ADR-027), ADR-060
  (ADR-061), ADR-052 (ADR-065). ADR-038 digabung dengan tag amandemen yang
  sudah ada (ADR-056/057) jadi satu urutan kronologis.
- **`.claude/agents/*.md`**: 5 dari 7 file subagent ditemukan writable
  (644), seharusnya read-only 644 → dikembalikan ke `chmod 444`
  (`gibran-project-manager.md`, `najwa-qa-engineer.md`,
  `neymar-product-designer.md`, `prabowo-feature-engineer.md`,
  `ridwan-architecture-reviewer.md`).
- **`.cursor/mcp.json`**: entry `supabase` kehilangan field `"type":
  "http"` yang ada di `.mcp.json` (ADR-064 twin-file drift) → disamakan.

### Changed — Governance (izin eksplisit King Rezi)

- **`PROJECT_RULES.md`** § Append-Only: ditambahkan satu pengecualian
  eksplisit — kolom `Status`/header `### Status` ADR lama boleh diedit
  khusus untuk menambah tag `Amended by ADR-YYY`, karena praktik ini sudah
  berjalan sejak ADR-056/057 tanpa pernah dituliskan sebagai exception,
  menyebabkan drift 14 ADR lama di atas.
- **`.claude/agents/gibran-project-manager.md`** (Static Reference, chmod
  444 — di-unlock sementara untuk edit ini, dikembalikan ke 444 setelah):
  section "In Progress" ditegaskan pointer-only setara "Next Tasks"
  (sebelumnya hanya "Next Tasks" yang eksplisit disebut pointer, jadi
  celah duplikasi); tambah instruksi menjaga simetri `Terkait KI-XXX`
  dua arah; tambah instruksi hitung ulang (bukan asumsi) angka
  Total/subtask; tambah pengecualian append-only untuk tag `Amended by`
  yang sinkron dengan perubahan `PROJECT_RULES.md` di atas.

### Not Changed (disengaja)

- `COMPLETE_TASK.md` dan `decisions/ADR-063-*.md` masih menyebut "69
  task/134 subtask" — itu snapshot historis di titik keputusan/entri
  masing-masing dibuat, bukan live counter, jadi tidak dikoreksi (akan
  jadi revisionis kalau diubah).

## 2026-08-12 — Fix 5 temuan /code-review PR #68

### Context

`/code-review` atas PR #68 (audit dokumentasi sebelumnya) menemukan PR itu
sendiri membawa 5 gap baru: simbol status ganda tidak valid, back-link
KI-015 yang masih terlewat di T-026/T-027, wiki-link `[[...]]` orphan ke
memory pribadi di `AGENTS.md`, ambiguitas target status di langkah Gibran,
dan urutan field `Terkait` yang tidak konsisten antar file task.

### Fixed

- **`TASKS.md`**: status T-025 di "Fokus sekarang" dikembalikan ke simbol
  Legend tunggal `⏳` (bukan kombinasi `⏳ 🚫` yang tidak terdefinisi),
  catatan "Terhenti" tetap di kolom Catatan saja.
- **`tasks/v02-publishing-mvp.md`**: T-026/T-027 ditambah back-link
  `KI-015` yang tadinya cuma `KI-003` (KI-015 sendiri sudah menyebut
  T-025/T-026/T-027 di `PROJECT_STATE.md`); urutan field `Terkait`
  dipindah sebelum `Depends` di T-025/T-026/T-027, menyamakan konvensi
  dengan T-039 di `tasks/v01-foundation.md`.
- **`AGENTS.md`**: hapus syntax wiki-link `[[feedback-uiux-docs-design-sync-reminder]]`
  (target itu memory pribadi di luar repo, bukan artefak repo) — diganti
  frasa biasa tanpa link.
- **`.claude/agents/gibran-project-manager.md`** (Static Reference, chmod
  444 — di-unlock sementara, dikembalikan setelah edit): langkah 1
  diperjelas — target eksplisit `✅ Done`, disebutkan task mungkin sudah
  `🟡 In Progress` dari langkah pertama subagent implementasi, tugas
  Gibran adalah promosi `🟡 → ✅`, bukan membiarkannya di `🟡`.

## 2026-08-12 — Konsistensi aturan "jangan putuskan sendiri" ke Mark & Elon

### Context

`prabowo-feature-engineer.md` sudah punya aturan keras eksplisit "kalau
menemukan gap/inkonsistensi saat kerja, laporkan ke user, jangan putuskan
sendiri" — `mark-ui-engineer.md` dan `elon-backend-engineer.md` belum,
padahal perilakunya sama-sama ditegakkan main agent. King Rezi minta
disamakan supaya tidak bergantung ke main agent "ingat" menegakkannya.

### Changed (Static Reference, chmod 444 — di-unlock sementara, dikembalikan setelah edit)

- **`.claude/agents/mark-ui-engineer.md`**: tambah baris aturan keras
  yang sama, contoh kasus spesifik (spec desain vs komponen Astryx yang
  tersedia).
- **`.claude/agents/elon-backend-engineer.md`**: tambah baris aturan
  keras yang sama, contoh kasus spesifik (kontrak Outstand di kode vs
  ADR-040).

## 2026-08-12 — Opsi B: mark "In Progress" otomatis oleh subagent implementasi saat mulai kerja

### Context

Follow-up dari audit governance sebelumnya: status task sering baru
ter-update jadi Done di akhir sesi (lewat Gibran), tanpa pernah eksplisit
ditandai In Progress saat kerja dimulai. King Rezi minta opsi otomasi
ringan (Opsi B dari 3 opsi yang diajukan: hook validasi, instruksi
subagent, atau Workflow penuh) — pilih instruksi eksplisit ke subagent
implementasi, tanpa infrastruktur baru.

### Changed (Static Reference, chmod 444 — di-unlock sementara, dikembalikan setelah edit)

- **`.claude/agents/prabowo-feature-engineer.md`**,
  **`mark-ui-engineer.md`**, **`elon-backend-engineer.md`**: tambah
  section "Langkah pertama sebelum menulis kode" — wajib ubah field
  `Status` task jadi `🟡 In Progress` di `tasks/vXX-*.md` sebelum menulis
  kode, sebagai **satu-satunya** edit dokumentasi project yang subagent
  ini boleh lakukan sendiri. Baris "Di luar scope kamu" masing-masing
  diperjelas supaya exception sempit ini tidak dibaca sebagai izin
  menyentuh `tasks/` secara umum — subtask checkbox, `TASKS.md`,
  `PROJECT_STATE.md`, `DECISIONS.md`, `COMPLETE_TASK.md` tetap eksklusif
  kerjaan Gibran Project Manager di akhir sesi.

## 2026-08-12 — ADR-078: amandemen ADR-018 (port lokal + composition root) + bersihkan T-012/KI-006 dari PROJECT_STATE

### Context

Follow-up dokumentasi setelah T-012.1/2: pola cross-domain
`ScheduledCountsPort` + wiring `PublishingService` di composition root
belum tercatat di ADR, sementara `PROJECT_STATE.md` masih menyisakan
T-012 di In Progress dan KI-006 Resolved di Known Issues (bertentangan
dengan ADR-067).

### Added

- **ADR-078** — Amandemen ADR-018: port lokal sempit di domain pemanggil
  (tidak di-export ke barrel), larangan import service konkret lintas
  domain di layer domain, wiring konkret hanya di composition root.
  Preseden kanonikal: `ScheduledCountsPort` +
  `apps/web/src/app/(app)/layout.tsx` (T-012.2). File:
  `project-manager/decisions/ADR-078-amandemen-adr-018-port-lokal-composition-root-scheduled-counts.md`.

### Changed

- `project-manager/DECISIONS.md` — baris indeks ADR-078; Status ADR-018 →
  `Accepted — Amended by ADR-078 (2026-08-12)`.
- `project-manager/tasks/v01-foundation.md` — catatan T-012.2 + field ADR
  mereferensikan ADR-078.
- Catatan T-012.2 di entri COMPLETE_TASK di bawah ini (sibling) juga
  mereferensikan ADR-078.
- `project-manager/PROJECT_STATE.md` — T-012 dihapus dari In Progress;
  KI-006 dihapus dari Known Issues (Resolved + sudah tercatat di
  COMPLETE_TASK, sesuai ADR-067); catatan "empat task" → "tiga task"
  (T-012 sudah Done); Recent Decisions digeser (ADR-078 masuk).

### Fixed

- Drift status: T-012 ✅ Done masih muncul di In Progress; KI-006 Resolved
  masih di Known Issues padahal riwayatnya sudah di COMPLETE_TASK.

---

## 2026-08-12 — T-012.1/2 selesai: persist reorder channel per user + badge scheduled-count real

### Context

Dua subtask T-012 yang sebelumnya di-flag "deferred, menunggu domain
publishing v0.2" ternyata sudah unblocked sejak T-028 (Persistensi Schedule
via Fake OutstandAdapter) selesai — data source (`PublishingPost`/
`PublishingPostTarget`) sudah ada, tidak perlu menunggu real Outstand
adapter (T-025/026/027). Dikerjakan oleh Prabowo Feature Engineer, lolos
review arsitektur Ridwan dan QA end-to-end Najwa. Menutup task **T-012**
(sekarang ✅ Done, seluruh subtask selesai) dan **KI-006** (Resolved).

### Changed — Implementasi

**T-012.1 (persist reorder channel sidebar per user):**

- Model Prisma baru `WorkspaceChannelOrder` (per workspace + user + account,
  strategi full-rewrite position setiap kali ada drop — bukan patch parsial).
- Migration diterapkan ke DB: `20260812033031_add_workspace_channel_orders`.
- Repository method baru `saveChannelOrder` / `getChannelOrder` di
  `IWorkspaceRepository` (domain `workspace`).
- Server Action `reorderChannelsAction` di
  `apps/web/src/app/(app)/components/sidebar-channels/actions.ts`.
- Wiring optimistic UI + revert-on-failure di `ChannelsSection.tsx`; helper
  `mergeChannels` lama dihapus karena sudah tidak diperlukan.

**T-012.2 (badge scheduled-count real dari domain publishing):**

- Method baru `countScheduledByAccount` (batch `groupBy`, bukan N+1 query)
  di public API domain `publishing`.
- Migration diterapkan ke DB:
  `20260812032852_add_publishing_post_target_connected_account_index`.
- Dipanggil dari `WorkspaceService` lewat interface port lokal
  `ScheduledCountsPort` (bukan import konkret `PublishingService` ke domain
  layer workspace) — sesuai aturan cross-domain AGENTS.md #7. Constructor
  `WorkspaceService` sekarang punya parameter opsional kedua untuk port ini;
  wiring konkret `PublishingService` hanya terjadi di composition root
  (`apps/web/src/app/(app)/layout.tsx`). Ini preseden pertama di codebase
  untuk satu domain service memanggil domain service lain secara langsung.
  Pola dikunci di **ADR-078** (amandemen ADR-018).

### Review arsitektur (Ridwan)

1 temuan ringan: `ScheduledCountsPort` sempat bocor dari barrel
`domains/workspace/index.ts` via `export *`. Diperbaiki dengan menghapus
keyword `export` dari deklarasi interface tersebut (jadi interface lokal,
tidak re-export lewat barrel).

### QA (Najwa)

Typecheck, lint, dan test (85/85) PASS. Reorder persist diverifikasi lewat
query DB langsung (bukan hanya observasi UI). Badge scheduled count
exact-match dengan hasil query DB. Tidak ada regresi pada UI quick-compose
"+" maupun drag-handle shift-on-hover (T-012.5/T-012.6).

### Dokumentasi terupdate

- `project-manager/tasks/v01-foundation.md` — T-012.1/2 dicentang, Status
  header T-012 jadi ✅ Done, catatan stale T-012.5/T-012.6 dihapus, daftar
  "task v0.1 yang menunggu v0.2" di Catatan Rilis dikurangi (T-012 dikeluarkan).
- `project-manager/TASKS.md` — indeks v0.1 (9 ✅ · 1 🚫 · 4 🟡 · 6 ⏳), Total
  (14 selesai), baris T-012 dikeluarkan dari "Fokus sekarang" (diganti
  catatan Done).
- `project-manager/PROJECT_STATE.md` — KI-006 ditandai Resolved, pointer
  T-012 di Next Tasks diupdate ke ✅ Done, Top Next Tasks Snapshot
  dikurangi jadi T-029/T-025, entri baru ditambah di Completed (Ringkasan)
  (item terlama — KI-022 resolved — dihapus untuk menjaga hitungan 5).

---

## 2026-08-11 — Bug-fix ad-hoc: posisi `ChannelsSection` di `WorkspaceSideNav` samakan dengan Design System (menempel footer via `VStack`)

### Context

Bukan task terjadwal — perbaikan kecil oleh main agent (Jokowi) langsung,
dipicu King Rezi meminta section "Channels" di sidebar utama app disamakan
posisinya dengan Claude Design (project "Social Media Management", projectId
`84aded99-bb23-49b1-be9f-dd8f21c6873e`). Di desain (`components/navigation.html`
+ `styles.css`, class `.nav`), nav items punya `flex:1` sehingga menghabiskan
sisa ruang vertikal dan mendorong `.channels` supaya selalu menempel tepat di
atas `.sidebar-footer`.

### Root cause

Div internal `.scrollable` milik komponen `SideNav` (dari `@astryxdesign/core`)
sudah `flex:1` mengisi sisa tinggi sidebar, tapi children di dalamnya
(`SideNavSection` + `ChannelsSection`, sebelumnya dua sibling lepas) tidak
flex — jadi sisa spasi jatuh di BAWAH `ChannelsSection` (sebelum footer)
alih-alih Channels didorong menempel ke footer seperti di desain.

### Changed — Implementasi

- `apps/web/src/app/(app)/components/WorkspaceSideNav.tsx` — tambah import
  `VStack` dari `@astryxdesign/core/VStack`. Children `<SideNav>` (dulu
  `<SideNavSection title="Menu">...</SideNavSection>` diikuti langsung
  `<ChannelsSection channels={channels} />` sebagai dua sibling lepas)
  dibungkus jadi:

  ```tsx
  <VStack vAlign="between" className="min-h-full">
    <SideNavSection title="Menu">...</SideNavSection>
    <ChannelsSection channels={channels} />
  </VStack>
  ```

  `vAlign="between"` map ke `justify-content:space-between` — dengan cuma 2
  child, ini mendorong Channels ke bawah pas ada slack space, identik efek
  `.nav{flex:1}` di desain, dan tidak mengubah apapun kalau konten sudah
  lebih tinggi dari area yang tersedia (overflow-scroll tetap jalan seperti
  biasa).

### Verification

Sudah dicek di browser preview (dev server `bun run --cwd apps/web dev`,
halaman `/`) — screenshot dikonfirmasi Channels sekarang menempel tepat di
atas footer (Notifikasi/Theme/Avatar), tidak ada gap kosong lagi. PASS.

### Catatan

Tidak ada ADR baru — pure layout bug-fix menyamakan implementasi dengan
Design System yang sudah ada, sama seperti fix header pada entri di bawah.
Tidak ada task terkait di `TASKS.md`/`tasks/`, sifatnya ad-hoc. Tidak
berkaitan dengan KI-024 (itu soal `SettingsSideNav.tsx`, file & scope
berbeda) — KI-024 masih Open, tidak berubah.

### Status

Selesai, terverifikasi visual.

---

## 2026-08-11 — Bug-fix ad-hoc: header `WorkspaceSideNav` samakan dengan Design System (avatar + nama, tanpa superheading)

### Context

Bukan task terjadwal — perbaikan kecil (2 baris) oleh main agent (Jokowi)
langsung, dipicu King Rezi meminta header sidebar utama app disamakan dengan
spec Design System (Claude Design, project "Social Media Management",
projectId `84aded99-bb23-49b1-be9f-dd8f21c6873e`). Setelah dibaca langsung
dari `components/navigation.html` + `styles.css` (class `.ws-switch`,
`.ws-avatar`, `.ws-name`, baris ~288-290), spec desain menampilkan **Avatar
bulat berisi inisial workspace + nama workspace**, tanpa label "Workspace"
apa pun (tidak ada superheading) — berbeda dari implementasi lama.

### Changed — Implementasi

- `apps/web/src/app/(app)/components/WorkspaceSideNav.tsx` (baris ~74-81) —
  `SideNavHeading` sebelumnya render `superheading="Workspace"` +
  `heading={workspaceName}` sebagai teks link tanpa avatar/icon. Diubah jadi:

  ```tsx
  <SideNavHeading
    icon={<Avatar name={workspaceName} size="sm" />}
    heading={workspaceName}
    headingHref="/"
  />
  ```

  `Avatar` sudah diimpor di file itu (dipakai juga di footer). `size="sm"`
  (24px) dipilih sebagai token Astryx terdekat ke 26px custom di desain,
  sekaligus konsisten dengan avatar footer yang juga pakai `size="sm"`.

### Verification

- Prop `icon`/`heading` pada `SideNavHeading` dikonfirmasi lewat
  `bunx astryx component SideNavHeading --dense` (cocok source
  `@astryxdesign/core` v0.1.8, sesuai AGENTS.md #15).
- Verifikasi visual di browser preview **belum selesai** dijalankan (proses
  terinterupsi sebelum sempat screenshot) — masih TODO terbuka, bukan
  "sudah diverifikasi visual".

### Catatan

Tidak ada ADR baru — ini bug-fix menyamakan implementasi dengan Design
System yang sudah ada, bukan keputusan desain baru. Ditemukan juga
divergensi kedua di luar scope sesi ini (Settings sidebar header) — lihat
KI-024 di `PROJECT_STATE.md`.

### Status

Selesai untuk `WorkspaceSideNav.tsx`. Verifikasi visual browser masih
tertunda (TODO, bukan blocker).

---

## 2026-08-11 — T-039.5 selesai: migrasi kode sidebar Settings ke pola Buffer (ADR-077)

### Context

Menyusul baseline ADR-077 (entri di bawah) dan T-039.1/.2/.3 (entri
selanjutnya), King Rezi memerintahkan eksekusi T-039.5 — migrasi kode
render sidebar Settings dari secondary nav ke sidebar tunggal pola Buffer.
Dikerjakan Mark UI Engineer, lalu direview arsitektur oleh Ridwan dan QA
end-to-end browser oleh Najwa.

### Changed — Implementasi

- `apps/web/src/app/(app)/layout.tsx` — `sideNav` di `AppShell` jadi
  kondisional per-route lewat komponen baru `AppSideNav.tsx`.
- `apps/web/src/app/(app)/settings/components/SettingsSideNav.tsx` —
  ditambah header back-navigation ("← Settings" → Home).

### Added — Implementasi

- `apps/web/src/app/(app)/components/AppSideNav.tsx` (Client Component
  baru) — `usePathname()` memilih render `SettingsSideNav` di bawah
  `/settings`, atau `WorkspaceSideNav` di luar itu.

### Removed — Implementasi

- `apps/web/src/app/(app)/settings/layout.tsx` (dihapus total) — wrapper
  `Layout`+`LayoutPanel role="navigation"` secondary nav tidak diperlukan
  lagi karena sidebar Settings sekarang tunggal, content jadi full-width.

### Verification

- Review arsitektur Ridwan: lolos, tidak ada temuan.
- QA Najwa (end-to-end browser): PASS semua golden path — typecheck
  bersih, lint bersih, 79/79 test pass, sidebar Settings menggantikan
  total main sidebar dengan header back-navigation berfungsi, taksonomi
  Organization/Account tidak berubah, tidak ada regresi di halaman lain,
  dark mode konsisten, reload langsung juga benar.

### Status

T-039.5 ✅ selesai. Menutup sisa gap render sidebar Settings di KI-023
(bersama ADR-077, lihat `PROJECT_STATE.md`). Sisa scope terbuka
KI-023/T-039 sekarang hanya **T-039.4** (onboarding picker workspace).
Tidak ada ADR baru — ini eksekusi ADR-077 yang sudah Accepted, tidak ada
amandemen.

---

## 2026-08-11 — ADR-077: Settings pakai sidebar tunggal pola Buffer (amandemen mekanisme render ADR-076)

### Context

King Rezi membagikan screenshot halaman Settings Buffer dan meminta pola
itu ditiru: saat masuk Settings, main sidebar workspace digantikan total
oleh satu sidebar khusus Settings (bukan dua sidebar berdampingan seperti
kondisi sekarang, warisan implementasi T-016.1). Diskusi berjalan bertahap
sesuai `proactive-clarification` — riset struktur kode dulu, klarifikasi
cakupan (murni halaman Settings) dan status keputusan (mau dieksekusi,
tapi diskusi dulu), baru King Rezi mengerjakan desainnya sendiri langsung
di Claude Design (bukan lewat Neymar) memakai prompt yang disusun sesi ini.
Setelah desain dikonfirmasi selesai, King Rezi meminta baseline dokumen
diperbarui menyusul.

### Added — Dokumentasi

- `DECISIONS.md` + `decisions/ADR-077-settings-sidebar-tunggal-menggantikan-main-sidebar-pola-buffer.md`
  (baru) — mengamandemen mekanisme render Settings dari ADR-076 (taksonomi
  grup Organization/Account tidak berubah, murni ubah render jadi sidebar
  tunggal + header back-navigation, cakupan terbatas halaman Settings).
- `tasks/v01-foundation.md` § T-039 — subtask baru **T-039.5** untuk
  migrasi kode `apps/web` (AppShell `sideNav` kondisional per-route, hapus
  `LayoutPanel` secondary nav, tambah header back di `SettingsSideNav`).

### Updated — Dokumentasi

- `product-discovery/04-ux/information-architecture.md` — "Secondary
  Navigation" + section "6. Settings": deskripsi mekanisme jadi
  "menggantikan primary nav", bukan coexist.
- `product-discovery/04-ux/navigation-patterns.md` — section "Settings"
  (tambah deskripsi back-navigation), NP-D07, catatan "Navigasi Balik
  Setelah Cross-Section" (Settings jadi pengecualian baru), tabel
  "Ringkasan Pola" (baris Akses Settings).

### Verification

- Cross-check `readme.md` project Claude Design via `DesignSync` — pola
  `.settings-sidebar`/`.settings-back-btn` + deskripsinya sudah ada
  duluan (dikerjakan King Rezi sendiri), sehingga **tidak perlu** prompt
  update readme — sudah sinkron sebelum sesi ini menulis baseline.

### Status

Baseline dokumentasi selesai (ADR-077 Accepted). Desain sudah selesai di
Claude Design. Kode `apps/web` **belum** dimigrasikan — menyusul sebagai
T-039.5, task terpisah.

---

## 2026-08-11 — T-039.1/.2/.3 selesai: migrasi kode `apps/web` ke baseline ADR-076

### Context

Menyusul task backlog T-039 (dibuat 2026-08-10, lihat entri di bawah) dan
sinkronisasi Design System ke ADR-076 (entri di bawahnya), King Rezi
memerintahkan eksekusi T-039.1–T-039.3. Dikerjakan lewat 5 track paralel:
`proxy.ts` + `/onboarding`, App Shell + Draft Editor, Publish, Engage/
Analyze/Start Page/Home, dan konsolidasi Settings. T-039.4 (halaman
`/onboarding` dengan picker workspace untuk user dengan >1 workspace)
sengaja tidak termasuk — tetap terbuka sebagai task terpisah.

### Changed — Implementasi

- Seluruh route workspace-scoped (`Home`, `Publish`, `Engage`, `Analyze`,
  `Start Page`, `Settings`) dipindah dari dynamic segment
  `apps/web/src/app/[slug]/...` ke route group `apps/web/src/app/(app)/...`.
- `apps/web/src/app/account/...` (terpisah) digabung ke dalam
  `(app)/settings/account/*`, konsisten dengan konsolidasi Settings jadi
  dua grup sidebar "Organization" + "Account", satu entry point avatar/user
  menu. Label avatar menu diganti dari "Profile" jadi **"Settings"**
  (keputusan dikonfirmasi King Rezi saat eksekusi).
- `apps/web/src/proxy.ts`: resolusi workspace diganti dari parsing URL
  `[slug]` menjadi baca cookie `active-workspace-id` (HTTP-only), divalidasi
  ulang terhadap `workspace_members` di setiap request, lalu inject header
  `x-workspace-id`/`x-workspace-role` ke downstream. Runtime diubah ke
  Node.js (bukan Edge) karena Prisma memakai adapter `pg`.
- Dihapus `apps/web/src/app/page.tsx` (root) — konflik routing dengan
  `(app)/page.tsx` karena route group tidak menambah segmen URL.
- Ditambahkan Route Handler baru `apps/web/src/app/onboarding/resume/route.ts`
  — set cookie untuk user existing yang kehilangan cookie tapi sudah punya
  workspace (bagian T-039.3; bukan picker T-039.4 untuk user dengan >1
  workspace).

### Fixed — Review Ridwan (Architecture Reviewer)

- Dead code `getWorkspaceBySlug`/`findBySlug` dihapus dari
  `WorkspaceService`, `IWorkspaceRepository`, dan implementasi Prisma-nya
  (tidak ada lagi caller produksi pasca migrasi).
- Hardening: header `x-workspace-id`/`x-workspace-role` di-strip
  (`stripWorkspaceHeaders`) di jalur bypass (`/api/auth`, `/api/jobs`,
  `/api/health`) dan `/onboarding`, dipanggil di semua `NextResponse.next()`
  — mencegah client memalsukan header ini.

### Fixed — QA Najwa (bug blocking, ditemukan sebelum task ditutup)

- Versi awal `proxy.ts` menyebabkan infinite redirect loop di `/login`,
  `/register`, `/forgot-password`, `/reset-password` untuk SEMUA user tanpa
  session — root cause: hilang early-return untuk kombinasi
  `!hasSessionCookie && isPublicAuthPage` setelah refactor redirect logic.
  Diperbaiki + ditambah test regresi baru `proxy.test.ts`.

### Verification

- `tsc --noEmit` bersih, lint bersih, 80 test pass (termasuk
  `proxy.test.ts` baru).
- Verifikasi visual: Claude Design (sudah disinkron ke ADR-076 sebelumnya)
  dicek cocok dengan hasil implementasi `SettingsSideNav` (grouping
  Organization/Account, urutan & label item) — tidak ada perubahan di
  Claude Design.

### Status

T-039.1/.2/.3 ✅ selesai (review + QA lolos). T-039.4 (onboarding picker
workspace untuk skenario >1 workspace) tetap terbuka, task terpisah.
Menutup sebagian besar KI-023 di `PROJECT_STATE.md` (sisa scope: T-039.4).
Tidak ada ADR baru — ini eksekusi ADR-076 yang sudah ada; dua keputusan
kecil saat eksekusi (label "Settings", penghapusan `page.tsx` root) dicatat
sebagai detail implementasi di `tasks/v01-foundation.md` § T-039, bukan
amandemen ADR.

---

## 2026-08-11 — Design System (Claude Design) disinkronkan ke ADR-076

### Context

King Rezi menyinkronkan Claude Design project "Social Media Management"
(`84aded99-bb23-49b1-be9f-dd8f21c6873e`) lewat serangkaian prompt manual,
mengikuti konsolidasi Settings (Organization + Account, entry point avatar
tunggal) dan penghapusan premis Workspace Selector dari ADR-076. Ini murni
perubahan di Claude Design — verifikasi dilakukan lewat DesignSync
(read-only `get_file`/`list_files`). Kode `apps/web` (T-039) **tidak
disentuh sama sekali** dan tetap `⏳ Not Started`.

### Changed — Claude Design

- `templates/settings-connected-accounts.html` dan
  `templates/settings-members.html`: sidebar `.settings-subnav` sekarang
  dua grup — "Organization" (General, Connected Accounts, Members, Roles &
  Permissions, Billing) dan "Account" (Profile, Notifications,
  Preferences). `page-title` jadi "Settings", `page-sub` jadi breadcrumb
  "Organization / Connected Accounts" dan "Organization / Members".
- Halaman Account (Profile/Notifications/Preferences) dipindah jadi 3 file
  baru — `templates/settings-profile.html`,
  `templates/settings-notifications.html`,
  `templates/settings-preferences.html` — semuanya pakai shell app penuh
  yang sama. File lama yang duplikat/divergen
  (`templates/user-settings.html`, `templates/account-profile.html`,
  `templates/account-preferences.html`) dihapus.
- `templates/app-prototype/AppPrototype.dc.html`: avatar dropdown menu
  sekarang cuma 2 item — "Settings" (bukan "Profile") + "Logout". Array
  `SCREENS` diperbarui untuk `settings-members` dan 3 halaman Account baru
  ("Settings → Account → Profile/Notifications/Preferences"). Komentar
  kode lama soal "Workspace Selector vs User Settings" diganti mengikuti
  ADR-076 (satu entry point Settings konsolidasi).
- Fix ikon Light/Dark di halaman Preferences (`.pref-row` "Tema
  Tampilan"): emoji mentah (☀/🌙) diganti SVG identik dengan tombol
  theme-toggle di sidebar-footer, konsisten Astryx.
- Fix entry `settings-connected-accounts` di SCREENS array yang kelewat
  saat rename pertama, kode KSP-08 dipertahankan.
- `readme.md` project Claude Design diperbarui: section "Avatar Menu"
  tidak lagi menjelaskan pembedaan lama Workspace Selector vs User
  Settings, jumlah "navigable screens" diperbaiki jadi 16, daftar file di
  section "Files" mencantumkan 3 file Account baru dan menghapus referensi
  `user-settings.html`.

### Status

Design System sekarang jadi referensi visual yang akurat untuk ADR-076.
Migrasi kode `apps/web` (T-039) masih menyusul sebagai task terpisah,
tetap diblokir sampai King Rezi memerintahkan eksekusi eksplisit.

---

## 2026-08-10 — Task baru T-039 (Migrasi Routing & Settings, ADR-076) — entry backlog, belum dieksekusi

### Context

ADR-076 (PR #61) mengubah baseline routing workspace dari dynamic segment
`[slug]` ke route group `(app)` + cookie `active-workspace-id`, dan
mengonsolidasi Settings jadi Organization + Account — tapi PR itu hanya
mengubah baseline dokumentasi, kode `apps/web` belum dimigrasikan. Catatan
implementasi ADR-076 eksplisit menyebut migrasi kode ini butuh task T-XXX
formal sebelum dikerjakan, dan KI-023 di `PROJECT_STATE.md` mencatat gap
yang sama. King Rezi meminta task ini dibuat dulu (entry backlog saja),
eksekusi ditunda.

### Added

- **T-039** ditambahkan ke `tasks/v01-foundation.md` (section baru "Migrasi
  Routing & Settings (ADR-076)"), status `⏳ Not Started`, 4 subtask
  (T-039.1–T-039.4): hapus dynamic segment `[slug]` → route group `(app)`,
  gabung `account/` terpisah ke `settings/account/*`, ganti resolusi
  workspace Middleware/`src/proxy.ts` dari URL ke cookie
  `active-workspace-id`, dan bangun halaman `/onboarding` dengan picker
  workspace.
- ID **T-039** dipilih karena rentang v0.1 (T-001–T-019) sudah penuh —
  dipinjam dari nomor yang sebelumnya dicadangkan untuk ruang pertumbuhan
  v0.2 (`tasks/v02-publishing-mvp.md`, Catatan Rilis diperbarui mengikuti
  ini), sesuai aturan "ambil nomor global berikutnya yang belum pernah
  dipakai" di `TASKS.md`.
- `TASKS.md`: indeks release v0.1 diperbarui (Rentang ID → "T-001–T-019,
  T-039", Task 19→20, status ⏳ bertambah 1), **Total** 70→71 task, 138→142
  subtask.
- `PROJECT_STATE.md` KI-023: field **Terkait** ditambah `T-039`, paragraf
  penutup diperbarui dari "belum punya task T-XXX formal" menjadi
  mereferensikan T-039 yang sudah dibuat (status Not Started).
- **Tidak ada kode `apps/web` yang berubah** — murni penambahan entry
  backlog dokumentasi, sesuai permintaan eksplisit King Rezi untuk menunda
  eksekusi.

---

## 2026-08-10 — KI-021/KI-022 resolved (Design System, avatar dropdown + Logout + Profile routing) — KI-023 baru (Workspace Selector belum diimplementasikan)

### Context

KI-021 mencatat bahwa Design System (`templates/app-prototype/AppPrototype.dc.html`)
tidak punya logic apa pun untuk membuka menu saat avatar diklik (langsung
pindah screen) dan alur Logout belum pernah dimodelkan sama sekali di
prototype. KI-022 mencatat bahwa avatar Design System mengarah ke Workspace
Settings `settings-connected-accounts`, sementara kode web mengarah ke
`/account/profile` User Settings — dan investigasi baseline
(`information-architecture.md`) mengonfirmasi kode web sudah benar,
kemungkinan Design System yang perlu mengikuti.

King Rezi mengerjakan sendiri fix di Claude Design (manual, di luar sesi
AI) dan meminta hasilnya diverifikasi cocok dengan kode
(`WorkspaceSideNav.tsx`, `AccountSideNav.tsx`, `account/layout.tsx`) lalu
dicatat sebagai resolved. Tidak ada kode `apps/web` yang diubah di semua
ini.

### Fixed

- **KI-021 resolved** — Avatar sidebar di Design System sekarang membuka
  dropdown (Profile + divider + Logout), mirror `DropdownMenu` Astryx di
  kode. Item Logout membuka dialog konfirmasi Tier 2 (judul "Logout dari
  akun ini?", deskripsi "Perubahan yang belum disimpan di halaman ini bisa
  hilang (ADR-049/NP-D10).", tombol Batal/Logout) — mirror `AlertDialog`
  di kode, sesuai ADR-049/NP-D10.
- **KI-022 resolved** — Item Profile pada dropdown avatar Design System
  sekarang mengarah ke screen baru `templates/user-settings.html` (User
  Settings), dengan sidebar minimal ala `AccountSideNav.tsx` (link kembali
  + 3 nav item Profile/Notifications/Preferences) — bukan lagi sidebar
  workspace penuh menuju Workspace Settings. Konfirmasi: kode web
  (`/account/profile`, User Settings) sudah benar sesuai baseline
  `information-architecture.md` + ADR-056; Design System yang disesuaikan
  mengikuti kode/baseline, bukan sebaliknya.
- `readme.md` project Claude Design "Social Media Management" diperbarui,
  section baru "Avatar Menu (KI-021/KI-022 fix)" menjelaskan alur
  dropdown + screen User Settings + dialog Logout ini.

Tidak dibuat ADR baru — ini menegakkan ADR-056 (User Settings vs Workspace
Settings) dan ADR-049/NP-D10 (dialog konfirmasi Tier 2) yang sudah ada,
bukan keputusan material baru.

### Added (Known Issue baru — KI-023)

Riset navigasi di sesi ini menemukan gap terpisah yang belum pernah
tercatat: **KI-023** — Workspace Selector belum pernah diimplementasikan
di kode, meski didefinisikan lengkap di baseline navigasi. Status masih
Open (belum resolved) — detail lengkap sengaja hanya disimpan di
`PROJECT_STATE.md` (satu sumber, bukan diduplikasi di sini) supaya tidak
ada dua salinan yang bisa divergen saat isu ini nanti berubah/resolved.

### Documentation

- `project-manager/PROJECT_STATE.md` — KI-021 dan KI-022 dihapus dari
  Known Issues (riwayatnya tercatat di entri ini), 2 bullet baru
  ditambahkan di **Completed (Ringkasan)** (2 bullet paling lama
  dikeluarkan dari daftar 5 item, riwayatnya tetap ada di entri
  `COMPLETE_TASK.md` sebelumnya). **KI-023** ditambahkan baru ke Known
  Issues (Status Open, Kategori Tech-Debt, Terkait T-009/IA-D05/NP-D07).
  Version 1.0.47 → 1.0.48.
- `TASKS.md`/`tasks/` tidak disentuh — KI-021/022/023 tidak pernah terkait
  ke task T-XXX manapun secara formal.

---

## 2026-08-10 — KI-020 resolved: layout footer sidebar grouping, kode ikut Design System

### Context

KI-020 mencatat mismatch layout di footer sidebar: Design System CSS
(`.sidebar-footer` di `styles.css`) tidak memakai `justify-content` pada
container-nya (cuma `display:flex; gap:var(--spacing-1)`) — efek
"renggang" didapat dari `margin-left:auto` yang ditempel LANGSUNG pada
tombol Theme, sehingga Notifikasi menempel kiri sementara Theme+Avatar
mengelompok jadi satu klaster di kanan. Implementasi web
(`WorkspaceSideNav.tsx`) sebelumnya memakai `<HStack gap={2} align="center"
justify="between" width="100%">` yang membungkus 3 children langsung
(IconButton Notifikasi, IconButton Theme, DropdownMenu Avatar) —
`justify="between"` di container menyebar ketiganya dengan jarak sama
rata, bukan mengelompokkan Theme+Avatar jadi satu grup di kanan seperti
Design System.

King Rezi memutuskan arah resolusi: **kode mengikuti Design System**,
Design System tidak diubah.

### Changed (kode)

- `apps/web/src/app/[slug]/components/WorkspaceSideNav.tsx`:
  - Outer `HStack justify="between"` sekarang membungkus 2 grup, bukan 3
    children langsung: (1) IconButton Notifikasi sendiri, (2) `HStack`
    baru berisi IconButton Theme + `DropdownMenu` Avatar (grup kanan).
  - `AlertDialog` konfirmasi Logout tetap di level yang sama (tidak
    visual, cuma overlay) — tidak terdampak.

### Verifikasi

Diverifikasi manual di browser preview: layout footer sidebar menunjukkan
Notifikasi kiri, Theme+Avatar mengelompok kanan — sesuai Design System.
Dropdown avatar (Profile/Logout) tetap berfungsi normal (menuitem
terdeteksi via `read_page`). `tsc --noEmit` di `apps/web` bersih, tidak
ada error. Tidak menjalankan test suite otomatis lain; tidak ada regresi
terdeteksi di area lain.

### Keputusan dokumentasi

Tidak dibuat ADR baru — ini pilihan implementasi kecil (grouping layout
mengikuti Design System yang sudah ada), bukan keputusan
arsitektur/workflow/repository strategy/business requirement/domain/
teknologi baru, sejalan dengan pola resolusi KI-019.

### Resolved

KI-020 dihapus dari `PROJECT_STATE.md` — riwayatnya tercatat di entri
ini.

---

## 2026-08-10 — KI-019 resolved: footer sidebar pakai `Avatar`, kode ikut Design System

### Context

KI-019 mencatat mismatch elemen UI di footer sidebar: Design System
(`components/navigation.html` di Claude Design, project "Social Media
Management") me-render avatar bulat berisi inisial (`<span
class="avatar-round">`, dibungkus icon button `aria-label="Menu akun"`),
sedangkan implementasi web (`WorkspaceSideNav.tsx`) memakai `DropdownMenu`
dengan tombol TEKS nama/email (`button={{ label: userName || userEmail,
variant: "ghost" }}`) — beda jenis elemen, bukan cuma beda posisi visual.

King Rezi memutuskan arah resolusi: **kode mengikuti Design System**, Design
System tidak diubah.

### Changed (kode, dikerjakan Mark UI Engineer)

- `apps/web/src/app/[slug]/components/WorkspaceSideNav.tsx`:
  - Tambah import `Avatar` dari `@astryxdesign/core/Avatar`.
  - `DropdownMenu` footer: `button` diganti jadi `{ isIconOnly: true, icon:
    <Avatar name={userName || userEmail} size="sm" />, variant: "ghost",
    label: userName || userEmail }`, tambah `hasChevron={false}`.
  - `items` (Profile, divider, Logout) tidak berubah.
  - Layout container `HStack` (`justify="between"`) **tidak disentuh** —
    tetap scope KI-020 (Known Issue terpisah, masih Open).

### Verifikasi

Diverifikasi manual di browser oleh AI utama (akun test Raka Pratama):
avatar bulat "RP" tampil menggantikan teks nama di footer sidebar,
`aria-label="Raka Pratama"` tetap ada (aksesibilitas terjaga), dropdown
Profile/Logout berfungsi normal saat avatar diklik, dark mode dicek (avatar
tetap terbaca, tidak ada regresi), IconButton Notifikasi & Theme di
sebelahnya tidak terdampak.

### Keputusan dokumentasi

Tidak dibuat ADR baru — ini perbaikan implementasi UI mengikuti Design
System yang sudah ada (bukan keputusan arsitektur/workflow/repository
strategy/business requirement/domain/teknologi baru), sejalan dengan pola
resolusi KI-004 (verifikasi/perbaikan UI langsung tanpa ADR).

### Resolved

KI-019 dihapus dari `PROJECT_STATE.md` (ADR-067) — riwayatnya tercatat di
entri ini. KI-020 (layout `justify="between"`) tetap Open, tidak
tersentuh.

---

## 2026-08-07 — Resolusi KI-018: Amandemen ADR-071 (sinkronisasi kutipan migration.sql)

### Context

KI-018 ditemukan saat investigasi KI-016 (ADR-073): kutipan SQL di bagian
"Catatan implementasi" ADR-071 (`ON CONFLICT (id) DO NOTHING`, tanpa
guardrail kolom) sudah stale terhadap isi aktual
`apps/web/prisma/migrations/20260806120000_extend_avatars_bucket_user_profile/migration.sql`
(`ON CONFLICT (id) DO UPDATE` + guardrail `file_size_limit`/
`allowed_mime_types`) — kode diedit setelah ADR-071 ditulis, kutipannya
tidak ikut diperbarui.

### Changed (dokumentasi)

- ADR baru **ADR-075** dibuat (`project-manager/decisions/ADR-075-amandemen-adr-071-sinkronisasi-kutipan-migration-sql-bucket-avatars.md`)
  mengamandemen ADR-071 — DECISIONS.md append-only, jadi kutipan lama
  ADR-071 tidak diedit, hanya digantikan lewat ADR baru yang eksplisit
  merujuknya (konvensi amandemen ADR-027/ADR-067).
- `project-manager/DECISIONS.md` — baris ADR-075 ditambahkan; baris ADR-071
  diupdate Status jadi `Accepted — Amended by ADR-075 (2026-08-07)`.
- `project-manager/PROJECT_STATE.md` — KI-018 Status diubah dari `Open` ke
  `Resolved`, ditambah catatan referensi ADR-075; baris log KI-018 resolved
  ditambahkan di dekat entri KI-016.
- Tidak ada perubahan kode — murni koreksi dokumentasi (Docs-Consistency),
  tidak ada keputusan arsitektur baru.

---

## 2026-08-07 — T-007.4: UI daftar anggota `/settings/members` (Astryx Table)

### Context

Lanjutan T-007 (Members management). Setelah T-007.3 menyelesaikan Server
Actions untuk `removeMember`/`updateMemberRole`, T-007.4 membangun UI daftar
anggota nyata di `/settings/members` menggantikan `ScaffoldPlaceholder`,
memakai Astryx Table.

### Changed (kode)

- Domain `workspace` (`apps/web/src/domains/workspace/`): `IWorkspaceRepository`
  ditambah method `listMembers` dan `findUsersByIds` + implementasi Prisma-nya;
  `WorkspaceService.listMembersWithUser` (join member + data user); type baru
  `WorkspaceMemberWithUser`. Test baru ditambahkan ke
  `workspace.service.test.ts` (26 test pass, tanpa regresi).
- `apps/web/src/app/[slug]/settings/members/page.tsx` — diganti dari
  `ScaffoldPlaceholder` jadi server component nyata yang memanggil
  `listMembersWithUser`.
- `apps/web/src/app/[slug]/settings/members/components/MembersTable.tsx` —
  baru, client component memakai Astryx Table dengan kolom
  Member/Role/Status/Actions. Tombol Change Role/Remove disabled dengan
  tooltip "Tersedia setelah T-007.5 selesai", dan disembunyikan untuk baris
  Owner atau baris milik user yang sedang login.
- Verifikasi: `bunx tsc --noEmit` bersih, `bun run lint` bersih, unit test
  service pass (26/26). Verifikasi visual browser **tidak** dilakukan (tidak
  ada kredensial test user yang valid tersedia saat sesi ini) — dicatat
  sebagai known gap, bukan diklaim selesai penuh secara end-to-end.

### Changed (dokumentasi)

- `project-manager/tasks/v01-foundation.md` — T-007.4 ditandai selesai
  (`[x]`). T-007 tetap 🟡 In Progress (T-007.1 `inviteMember` masih menunggu
  T-005, T-007.5 dialog konfirmasi Remove Member/Update Role belum
  dikerjakan).
- `project-manager/PROJECT_STATE.md` — entri baru di "Completed (Ringkasan)",
  metadata `Version`/`Last Updated` diperbarui.

### Di luar scope (sengaja belum dikerjakan)

- Dialog konfirmasi Remove Member/Update Role → T-007.5 (masih ⏳ Not
  Started, ADR-049 Tier 2).
- Tombol Invite Member → masih menunggu T-005 (transactional email provider).

### Tindak lanjut

- T-007.5 (dialog konfirmasi) jadi next step logis untuk menutup T-007
  sepenuhnya (bersama T-007.1 begitu T-005 selesai).

---

## 2026-08-07 — T-007.3: Server Actions + delegasi RBAC ke domain layer (Members Management)

### Context

Lanjutan T-007 (Members management). RBAC `removeMember`/`updateMemberRole`
sudah lengkap di domain layer (`WorkspaceService`, T-007.1 partial). T-007.3
membuat Server Actions tipis di route `[slug]/settings/members` yang
mewiring UI ke service tersebut, sesuai aturan keras `#5` (entry point tidak
boleh berisi business logic).

### Changed (kode)

- `apps/web/src/app/[slug]/settings/members/actions.ts` — baru:
  `removeMemberAction` dan `updateMemberRoleAction`, wiring tipis ke
  `WorkspaceService.removeMember` / `updateMemberRole`. Helper lokal
  `resolveWorkspaceAndSession(slug)`. Tidak ada business logic baru — RBAC
  tetap di domain layer.
- `apps/web/src/app/[slug]/settings/members/actions.test.ts` — baru, 6 test.
- Verifikasi: vitest lolos (6/6 test baru + 24/24
  `workspace.service.test.ts` tanpa regresi), typecheck bersih. Tidak ada
  perubahan domain/service layer maupun schema.

### Changed (dokumentasi)

- `project-manager/tasks/v01-foundation.md` — T-007.3 ditandai selesai
  (`[x]`). T-007 tetap 🟡 In Progress (T-007.1 inviteMember masih menunggu
  T-005, T-007.4 UI dan T-007.5 dialog konfirmasi belum dikerjakan).

### Tindak lanjut

- T-007.4 (UI daftar anggota `/settings/members`, Astryx Table) jadi next
  step logis untuk melanjutkan T-007.

---

## 2026-08-07 — ADR-074: Reduksi struktur role 4→3 (Account Owner/Admin/Creator), resolusi KI-017

### Context

KI-017 mencatat mismatch role di mockup Claude Design `settings-members.html`
(Admin/Editor/Viewer) vs baseline 4-role lama (Owner/Admin/Manager/Creator).
Saat membahas resolusi, King Rezi meminta brainstorming lebih dulu, lalu
memutuskan menyederhanakan struktur role menjadi 3 — bukan sekadar
menyamakan mockup ke baseline lama. Role **Manager** dihapus; hak
operasionalnya (schedule/publish/engagement inbox/analytics penuh) digabung
ke **Creator** (bukan Admin), karena persona yang memegangnya (Raka — Social
Media Manager, operator publishing harian) tidak pernah butuh akses
administratif (billing/workspace settings/member management). Keputusan
dicatat sebagai **ADR-074**.

### Changed (dokumentasi)

- `product-discovery/02-product/roles-permissions.md` — ditulis ulang total:
  3 role, matriks hak akses, tabel transisi status, mapping persona
  (Raka → Creator).
- `product-discovery/02-product/mvp-definition.md`,
  `05-architecture/README.md`, `domain-model.md`, `auth-architecture.md`,
  `application-layer.md`, `realtime-strategy.md`, `database-strategy.md`,
  `06-engineering/auth-strategy.md`, `04-ux/information-architecture.md`,
  `04-ux/key-screen-patterns.md` — semua referensi 4-role/`Manager` diupdate
  ke 3-role.
- `context/ctx-business.md`, `context/ctx-development.md` — daftar role
  kanonikal diupdate.
- `project-manager/PROJECT_STATE.md` — KI-017 ditandai Resolved.
- `project-manager/ARCHITECTURE_OVERVIEW.md` — label role di diagram System
  Context diupdate.
- `project-manager/tasks/v02-publishing-mvp.md` — RBAC `publishNow` (T-029.1)
  diupdate jadi semua role.
- `project-manager/DECISIONS.md` + `decisions/ADR-074-...md` — ADR baru.

### Changed (kode)

- `packages/shared/src/enums.ts` — `MemberRole.Manager` dihapus. Enum key
  `Owner` (value `"owner"`) dipertahankan tanpa migrasi — tampilan UI/dokumen
  memakai label "Account Owner".
- `apps/web/src/domains/workspace/services/workspace.service.test.ts` —
  skenario test yang memakai `MemberRole.Manager` disesuaikan ke 3 role
  (member seed, target, dan actor diganti ke Owner/Admin/Creator). Logika
  RBAC (`removeMember`/`updateMemberRole`, hanya Owner/Admin boleh jadi
  actor) tidak berubah.
- Verifikasi: `bun test` untuk `workspace.service.test.ts` +
  `enums.test.ts` — 28 test lolos, 0 gagal.

### Tindak lanjut yang bukan tanggung jawab agent

- Revisi mockup Claude Design `templates/settings-members.html` — prompt
  siap pakai sudah diberikan ke King Rezi untuk dikerjakan langsung di
  Claude Design (bukan dieksekusi otomatis via `DesignSync` dalam sesi ini,
  sesuai permintaan eksplisit King Rezi).
- `apps/web/prisma/schema.prisma` menyimpan `role` sebagai `String` biasa —
  tidak ada migration DB yang diperlukan (belum ada data live dengan role
  `manager`).

---

## 2026-08-07 — KI-016 resolved: Shadow database Prisma (P3006) via External Tables

### Context

`prisma migrate dev` gagal (P3006) karena migration lama
`20260806120000_extend_avatars_bucket_user_profile` berisi raw SQL ke
`storage.buckets` (tabel Supabase Storage, bukan model Prisma) — tabel itu
tidak ada di shadow database kosong yang direplay Prisma setiap validasi.
Sebelumnya diatasi per-migrasi dengan workaround manual (`migrate diff` ke
DB live + `db execute` + `migrate resolve --applied`), tercatat sebagai
KI-016 karena workaround itu harus diulang untuk SEMUA migrasi berikutnya
kalau tidak ditangani permanen.

### Changed (kode — dikerjakan Elon Backend Engineer, sudah terverifikasi sebelum sesi dokumentasi ini)

- `apps/web/prisma.config.ts` — tambah `experimental.externalTables: true`,
  `tables.external: ["storage.buckets"]`, `migrations.initShadowDb` (isi SQL
  dibaca dari file terpisah via `readFileSync`).
- File baru `apps/web/prisma/shadow-init.sql` — stub minimal idempotent
  tabel `storage.buckets` untuk shadow DB.

### Verifikasi end-to-end

1. `prisma migrate diff --shadow-database-url ...` — replay 6 migration
   history termasuk migration `storage.buckets` sukses tanpa P3006.
2. Ditemukan masalah terpisah (checksum drift, bukan bagian KI-016):
   migration `20260806120000_extend_avatars_bucket_user_profile` di disk
   sudah diedit (jadi `DO UPDATE` + guardrail) setelah pernah applied ke DB
   dev lokal — diperbaiki via UPDATE manual kolom `checksum` di
   `_prisma_migrations` (persetujuan eksplisit King Rezi, dijalankan lewat
   `prisma db execute --stdin`, hanya metadata Prisma yang tersentuh).
3. `prisma migrate status` → "Database schema is up to date!".
4. Uji final `prisma migrate dev --create-only --name test_ki016_resolution`
   → berhasil tanpa P3006/error checksum apapun (folder migrasi kosong
   dihapus lagi, tidak di-commit).

### Changed (dokumentasi)

- `project-manager/PROJECT_STATE.md` — KI-016 dihapus dari Known Issues
  (per ADR-067, resolved KI yang sudah tercatat di sini tidak dibiarkan
  menumpuk sebagai status Resolved di `PROJECT_STATE.md`); ditambahkan
  KI-018 baru (staleness ADR-071 vs kode aktual, temuan terpisah selama
  investigasi).
- ADR baru **ADR-073** (`project-manager/decisions/ADR-073-prisma-external-tables-untuk-shadow-database-tabel-platform-supabase.md`)
  + baris baru di `project-manager/DECISIONS.md`.
- `product-discovery/06-engineering/database-orm.md` § Migration Strategy
  (DO-D03) — subsection baru "Shadow Database & External Tables (ADR-073)"
  (perubahan struktural pada Static Reference, dicatat di sini sesuai
  governance).

---

## 2026-08-07 — T-007.1 (sebagian) & T-007.2 selesai: Members management (removeMember, updateMemberRole, repository invitation)

### Context

**T-007** (Members management) dikerjakan oleh Prabowo Feature Engineer.
Scope sesi ini: `WorkspaceService.removeMember` + `updateMemberRole` (RBAC
manual) dan seluruh repository method + migrasi tabel invitation.
`inviteMember` belum dikerjakan — tetap menunggu T-005 (transactional email
provider) selesai/ditentukan.

### Changed (kode)

- **T-007.1 (sebagian) — `WorkspaceService.removeMember` + `updateMemberRole`:**
  RBAC manual Owner/Admin only; Owner tidak bisa dihapus atau diubah role-nya;
  `updateMemberRole` menolak promosi member manapun ke Owner. File:
  `apps/web/src/domains/workspace/services/workspace.service.ts` +
  `apps/web/src/domains/workspace/services/workspace.service.test.ts`.
  `inviteMember` masih Blocked (T-005).
- **T-007.2 — Repository method + migrasi tabel invitation:** Model Prisma
  baru `WorkspaceInvitation` → tabel `workspace_invitations` (lihat
  **ADR-072**), migration
  `apps/web/prisma/migrations/20260807061502_add_workspace_invitations/`.
  Repository method baru: `getMember`, `findMemberById`, `removeMember`,
  `updateMemberRole`, `createInvitation`, `findInvitationByToken` — interface
  di `apps/web/src/domains/workspace/repositories/workspace.repository.ts`,
  implementasi Prisma di
  `apps/web/src/lib/repositories/workspace/workspace.repository.ts`. ID baru
  ditambahkan di `packages/shared/src/ids.ts`.

### Keputusan & temuan

- **ADR-072** — Invite member wajib bisa menyasar orang yang belum punya
  akun (dikonfirmasi King Rezi), sehingga dibuat tabel `workspace_invitations`
  terpisah dari `workspace_members` (yang mensyaratkan `user_id NOT NULL`).
  `database-strategy.md` perlu diupdate menyusul untuk merefleksikan tabel
  baru ini (belum dieksekusi di sesi ini).
- **KI-016 (baru)** — `prisma migrate dev` gagal (P3006) untuk migrasi kali
  ini karena migration lama `20260806120000_extend_avatars_bucket_user_profile`
  berisi raw SQL ke skema `storage.buckets` yang tidak ada di shadow database
  kosong. Diatasi dengan workaround manual (`prisma migrate diff` ke DB live
  + `prisma db execute` + `prisma migrate resolve --applied`), sudah
  diverifikasi `prisma migrate status` up to date — tapi workaround ini akan
  perlu diulang untuk migrasi Prisma berikutnya sampai ditangani permanen.

### Task tracking

- `tasks/v01-foundation.md` — T-007 Status `⏳ Not Started` → `🟡 In Progress`;
  T-007.1 tetap unchecked (catatan inline ditambahkan); T-007.2 dicentang
  selesai.
- `TASKS.md` — indeks v0.1: `3 🟡` → `4 🟡`, `7 ⏳` → `6 ⏳`.

---

## 2026-08-06 — T-016.1/2/3/5 selesai: Account & user settings screens

### Context

**T-016** (Account & user settings screens) dikerjakan lintas subagent —
Mark UI Engineer (T-016.1 layout, T-016.3 preferences, T-016.5 dialog
konfirmasi Logout) dan Prabowo Feature Engineer (T-016.2 profile edit).
Direview arsitektur oleh Ridwan (nihil temuan) dan lolos QA end-to-end oleh
Najwa + verifikasi tambahan sesi utama. **T-016.4** (notifications) tetap
di luar scope sesi ini — blocked T-036 (v0.2), tidak dikerjakan.

### Changed (kode)

- **T-016.1 — Layout `account/` + `settings/`:** Sesi Claude Design (AI
  utama, bukan subagent Neymar) lebih dulu untuk 4 mockup:
  `templates/account-profile.html`, `templates/account-preferences.html`,
  kolom Tier 2 baru di `components/dialog.html`, subnav baru di
  `templates/settings-connected-accounts.html` (project Claude Design
  "Social Media Management", projectId `84aded99-bb23-49b1-be9f-dd8f21c6873e`).
  `/account` pakai `AppShell`+`SideNav` (top-level, tanpa workspace context,
  back-link ke workspace); `/[slug]/settings` pakai
  `Layout`+`LayoutPanel role="navigation"`+`LayoutContent` (bukan AppShell
  kedua, karena sudah dibungkus AppShell dari `[slug]/layout.tsx`). File
  baru: `apps/web/src/app/account/page.tsx` (redirect ke `/account/profile`,
  menutup celah ADR-046), `apps/web/src/app/account/components/AccountSideNav.tsx`,
  `apps/web/src/app/[slug]/settings/components/SettingsSideNav.tsx`. Diubah:
  `apps/web/src/app/account/layout.tsx`, `apps/web/src/app/[slug]/settings/layout.tsx`.
- **T-016.2 — `/account/profile` (edit nama, avatar):** Domain `identity`
  (`apps/web/src/domains/identity/`) diisi **pertama kali** (sebelumnya
  scaffold kosong): `IIdentityRepository`, `IAvatarStorageAdapter` (pola sama
  `IOutstandAdapter` domain publishing), `IdentityService` (constructor
  injection, validasi nama + avatar). Infra: `apps/web/src/lib/repositories/identity/`,
  `apps/web/src/lib/adapters/avatar-storage/` (Supabase Storage,
  service-role). Entry point: `apps/web/src/app/account/profile/page.tsx`
  (Server Component) + `actions.ts` (Server Action) + `components/ProfileForm.tsx`.
  Scope sengaja hanya nama + avatar — email read-only, tidak ada flow ganti
  email (belum ada infra verifikasi email).
- **T-016.3 — `/account/preferences`:** Card "Tema Tampilan" dengan toggle
  Light/Dark, reuse hook `useThemeMode()` existing (tidak ada state/cookie
  baru) — baseline (`04-ux/information-architecture.md` § 7) tidak
  mendefinisikan personal preference lain di luar tema. File:
  `apps/web/src/app/account/preferences/page.tsx`.
- **T-016.5 — Dialog konfirmasi Logout (ADR-049 Tier 2):** Memperbaiki
  pelanggaran aktif ADR-049/NP-D10 yang ditemukan saat eksplorasi:
  `handleLogout` di `apps/web/src/app/[slug]/components/WorkspaceSideNav.tsx`
  sebelumnya dipanggil langsung dari dropdown "Logout" tanpa konfirmasi
  apapun. Fix: tambah `AlertDialog` (komponen Astryx, konsumen pertama di
  `apps/web`) — title "Logout dari akun ini?", description mengacu
  ADR-049/NP-D10, `cancelLabel="Batal"`, `actionLabel="Logout"`. Logic
  `handleLogout` (signOut + redirect + refresh) tidak berubah, hanya
  digating di belakang dialog.

### Perluasan baseline (ADR-071)

Bucket Supabase Storage `avatars` diperluas dari "khusus avatar workspace +
Start Page" menjadi juga menampung avatar user personal, path baru
`avatars/users/{user_id}/avatar.{ext}`. Direalisasikan lewat migration
idempotent
`apps/web/prisma/migrations/20260806120000_extend_avatars_bucket_user_profile/migration.sql`
(`insert into storage.buckets ... on conflict do nothing`), sudah diterapkan
ke dev (bucket sebelumnya belum eksis, dikonfirmasi via `listBuckets()`).
`product-discovery/05-architecture/database-strategy.md` § Storage Strategy
diupdate merefleksikan ini. Keputusan resmi dicatat sebagai **ADR-071** di
`DECISIONS.md` + `decisions/ADR-071-perluasan-bucket-avatars-untuk-avatar-user-personal.md`.

### Gap yang dicatat (bukan blocker)

Belum ada unit test Vitest baru untuk `IdentityService`/`IIdentityRepository`/
`SupabaseAvatarStorageAdapter` (domain `identity` yang baru diisi). Ridwan
sudah cek boundary arsitektur (bersih), tapi coverage test-nya nihil. Dicatat
sebagai **KI-014** (Open) di `PROJECT_STATE.md` — bukan blocker penutupan
T-016.1/.2/.3/.5, semua sudah lolos QA browser end-to-end.

### Verifikasi

- Typecheck/lint/test: PASS.
- Review arsitektur Ridwan: nihil temuan (boundary domain `identity` bersih).
- QA end-to-end Najwa + verifikasi tambahan sesi utama: golden path edit
  nama, upload avatar sungguhan, validasi nama kosong, validasi file bukan
  gambar, validasi >2MB — semua PASS via browser nyata,
  `identity_user.image`/`identity_user.name` dicek langsung di DB. Dialog
  Logout: Cancel membatalkan tanpa efek, Escape berperilaku sama seperti
  Cancel, Confirm sign-out + redirect `/login`, dites di light & dark mode.
  Toggle tema preferences: berfungsi, persist lintas section via cookie
  `theme` existing, tidak ada flash tema salah.

### Terkait

- `project-manager/tasks/v01-foundation.md` — T-016.1/.2/.3/.5 dicentang
  selesai, status T-016 diubah jadi 🟡 In Progress (T-016.4 tetap Blocked).
- `project-manager/TASKS.md` — indeks release v0.1 diperbarui (3 🟡, 7 ⏳).
- `project-manager/PROJECT_STATE.md` — KI-014 ditambahkan, ringkasan
  Completed/Recent Decisions diperbarui.
- `project-manager/DECISIONS.md` + `project-manager/decisions/` — ADR-071
  ditambahkan.

## 2026-08-06 — T-013.3 selesai: UI `/settings/connected-accounts`

### Context

Subtask **T-013.3** (UI daftar akun terhubung + tombol Connect per platform)
dikerjakan Mark UI Engineer, direview arsitektur oleh Ridwan (clean, 1 catatan
penataan folder — sudah diperbaiki sebelum selesai), lalu QA statis oleh
Najwa (typecheck/lint/test PASS, tanpa blocker). T-013.1/.2/.4 **tidak**
dikerjakan pada sesi ini — T-013 secara keseluruhan masih berstatus
🟡 In Progress (bukan selesai).

### Changed (kode)

- Server Component baru untuk route `/settings/connected-accounts`.
- Komponen baru `ConnectedAccountsList` — menampilkan daftar akun terhubung
  per workspace.
- Komponen baru `ConnectPlatformMenu` — menu tombol Connect per platform
  sosial yang didukung.
- Field `connectedAt` ditambahkan ke domain workspace (connected account)
  untuk mendukung tampilan tanggal terhubung di UI.

### Keputusan scope

- **Connect CTA untuk semua platform disabled** — T-025 (Real OutstandAdapter,
  v0.2) belum dikerjakan, jadi belum ada jalur nyata untuk inisiasi OAuth
  redirect (T-013.1 blocked by T-025).
- **Row action (disconnect/reconnect) disabled + tooltip penjelasan** — T-014
  (Disconnect) dan T-015 (Reconnect) belum dikerjakan, jadi UI hanya
  menampilkan state tapi belum mengekspos aksi fungsional.

### Verifikasi

- Typecheck/lint/test: PASS, bersih.
- Browser E2E: PASS — termasuk pengecekan empty state (belum ada akun
  terhubung) dan regresi sidebar Channels (memastikan perubahan tidak
  merusak fitur T-012 yang sudah ada).

### Terkait

- `project-manager/tasks/v01-foundation.md` — T-013.3 dicentang selesai,
  status T-013 diubah jadi 🟡 In Progress.
- `project-manager/TASKS.md` — indeks release v0.1 diperbarui (2 🟡, 8 ⏳).

## 2026-08-06 — KI-013 resolved: instalasi self-hosted Better Auth terverifikasi, ngrok tidak lagi wajib

### Context

Menyusul ADR-070 (revert Better Auth Cloud → self-hosted), King Rezi
menginstall self-hosted Better Auth secara mandiri di komputer lokal dan
mengonfirmasi **login/register berhasil lewat `http://localhost:3000`**
tanpa tunnel ngrok apapun. Kode `auth.ts` dan route handler ternyata sudah
lengkap sejak awal (Prisma adapter, tabel `identity_*` sudah termodel) —
yang diubah cuma env var: `BETTER_AUTH_URL=http://localhost:3000` dan
`BETTER_AUTH_API_KEY` dikosongkan (menonaktifkan plugin `dash`/Better Auth
Cloud).

Sesi lanjutan membahas cara melihat data: Better Auth **tidak menyimpan
data sendiri** — semua data (`identity_user`, `identity_session`,
`identity_account`, `identity_verification`) disimpan di Postgres Supabase
Cloud yang sama, diakses lewat Prisma. Untuk kebutuhan lihat/verifikasi
data tanpa dashboard Better Auth Cloud, ditambahkan script `db:studio`
(Prisma Studio) sebagai alternatif self-hosted.

### Changed (kode)

- `apps/web/package.json` — script baru `db:studio`: `bun --env-file=.env.local x prisma studio`.
- `package.json` (root) — script baru `db:studio`: `bun run --cwd apps/web db:studio`, mengikuti pola delegasi `db:migrate`/`db:deploy` yang sudah ada.

### Changed (dokumentasi)

- `QA_TEST_ACCOUNTS.md` — section "Kenapa testing browser pakai ngrok"
  diperbarui: catatan lama dipindah ke `<details>` (riwayat), ditambahkan
  catatan bahwa verifikasi browser sekarang langsung ke `localhost:3000`,
  tidak perlu lagi tanya URL tunnel ke user di setiap sesi.
- `PROJECT_STATE.md` — KI-013 dihapus dari Known Issues (ADR-067), bullet
  resolved ditambahkan ke Completed (Ringkasan).

### Resolved

KI-013 dihapus dari `PROJECT_STATE.md` (ADR-067) — riwayatnya tercatat di
entri ini. Bug hydration spesifik lewat tunnel ngrok (root cause asli
KI-013) tidak lagi relevan ditelusuri karena ngrok tidak dipakai lagi untuk
dev/testing.

### Catatan

`.claude/agents/najwa-qa-engineer.md` masih menyebut requirement ngrok di
langkah 0 — **belum diubah** karena file agent ini Static Reference
(chmod 444), hanya boleh diubah atas permintaan eksplisit King Rezi
(`AGENTS.md`). Perlu direvisi terpisah kalau King Rezi meminta.

---

## 2026-08-06 — ADR-070: tetap self-hosted Better Auth, tolak Better Auth Cloud

### Context

King Rezi mengeluhkan proses dev jadi merepotkan karena auth "mengharuskan"
tunnel ngrok setiap kali autentikasi diuji di dev mode. Diskusi menelusuri
akar masalah: baseline resmi (`auth-strategy.md`, ADR-024) mendesain Better
Auth sebagai library self-hosted yang seharusnya jalan normal di
`localhost:3000` tanpa tunnel apapun. Requirement ngrok ternyata berasal
dari **Better Auth Cloud** (produk hosted terpisah, sempat dipakai tanpa
tercatat di ADR manapun) — dashboard-nya menolak Base URL non-publik
("localhost, link-local hosts are not allowed"). Sempat dipertimbangkan
migrasi ke Supabase Auth, tapi ditolak karena akar masalahnya bukan
keterbatasan Better Auth secara umum.

### Decision (ADR-070)

Berhenti memakai Better Auth Cloud, kembali ke self-hosted Better Auth
sesuai desain asli ADR-024/`auth-strategy.md` — tidak ada perubahan
arsitektur. Instalasi dilakukan mandiri oleh King Rezi di komputer lokal
(`localhost:3000`, `BETTER_AUTH_SECRET` sendiri, DB tetap Supabase Cloud),
tanpa perlu Railway untuk dev.

### Added

- **ADR-070** (`project-manager/decisions/ADR-070-...md`).

### Status

Instalasi self-hosted belum dieksekusi AI — dilakukan mandiri oleh King
Rezi. `QA_TEST_ACCOUNTS.md` (catatan "wajib ngrok") dan KI-013 perlu
ditinjau ulang setelah instalasi terverifikasi jalan normal di `localhost`.

---

## 2026-08-06 — KI-004 resolved: alur UI toggle Light/Dark sudah diuji lewat browser

### Context

KI-004 mencatat bagian implementasi server-side toggle Light/Dark (baca
cookie di RSC sebelum render) sudah diverifikasi lewat `typecheck`/`lint`/
`test` otomatis, tetapi alur UI-nya (klik toggle di sidebar footer → cookie
tertulis) belum diuji lewat browser karena butuh login.

### Verifikasi

King Rezi sudah melakukan pengujian manual alur UI toggle Light/Dark lewat
browser (klik toggle di sidebar footer → cookie tertulis) — hasilnya berhasil
sesuai ekspektasi, tanpa temuan masalah.

### Resolved

KI-004 dihapus dari `PROJECT_STATE.md` (ADR-067) — riwayatnya tercatat di
entri ini.

---

## 2026-08-06 — KI-010 resolved: konvensi penamaan & peletakan komponen lokal `src/app/` + ADR-069

### Context

KI-010 (dicatat sejak review PR #42, 2026-08-05) mencatat konvensi folder
underscore-prefix (`_draft-editor`, `_sidebar-channels`) di
`apps/web/src/app/` belum resmi didokumentasikan, dan King Rezi tidak nyaman
dengan penamaan itu. Setelah diskusi, disepakati bukan mendokumentasikan
underscore apa adanya, melainkan mengganti konvensinya.

### Decision (ADR-069)

1. File yang meng-export React component pakai PascalCase (`Modal.tsx`);
   file non-component (`actions.ts`, `status-badge.ts`, `platform-icons.tsx`)
   tetap kebab-case.
2. Folder tetap kebab-case seluruhnya (tidak ada folder PascalCase) —
   `_draft-editor` → `draft-editor` (hanya hilang underscore).
3. Folder `components/` ditaruh di lowest common ancestor (LCA) route dari
   seluruh pemakainya di App Router tree (1 route → lokal; lintas route 1
   subtree → naik ke ancestor terendah; lintas subtree/root → naik ke
   `src/components/`).

### Changed (kode)

Seluruh komponen colocated di `apps/web/src/app/` dipindah & di-rename sesuai
konvensi baru — bukan cuma `_draft-editor`/`_sidebar-channels`, tapi juga
auth forms, onboarding form, workspace-side-nav, publish-tabbar, drafts-list,
dan `providers.tsx`. Contoh: `app/[slug]/_draft-editor/*` →
`app/[slug]/components/draft-editor/*`, `app/providers.tsx` →
`apps/web/src/components/Providers.tsx`.

### Changed (dokumentasi)

- `product-discovery/06-engineering/monorepo-setup.md` — section baru
  "Penamaan & peletakan folder `components/` lokal (KI-010, ADR-069)" di
  bawah `## src/app/ — App Router Structure`, plus update rujukan di
  `## src/components/ — UI Components`.
- `context/ctx-development.md` — item baru #13 di "Naming & file".
- `context/ctx-implementation.md` — bullet baru di "## UI Components
  (ADR-041)".

### Added

- **ADR-069** (`project-manager/decisions/ADR-069-...md`) — konvensi
  penamaan & peletakan komponen lokal di `src/app/`, resolusi KI-010.

### Verifikasi

- **Review Ridwan Architecture Reviewer**: PASS, tanpa temuan pelanggaran
  hard rules (entry point tetap tanpa business logic, tidak ada import baru
  yang melanggar domain logic, cross-domain tetap lewat barrel `index.ts`).
- **QA Najwa**: PASS — typecheck/lint/test hijau, browser E2E (sidebar
  Channels + drag-reorder, Draft Editor modal, Save as Draft,
  `/publish/drafts` DraftsList + Status Badge, Edit Draft) semua jalan
  normal tanpa regresi.

### Catatan task

KI-010 sebelumnya terkait T-012 dengan status out-of-scope. Diputuskan cukup
sebagai resolusi KI standalone (bukan task/subtask T-XXX baru) — sudah
selesai penuh dalam satu sesi, tidak ada sisa pekerjaan yang perlu dilacak
lebih lanjut.

---

## 2026-08-05 — KI-008/KI-009/KI-012 resolved: icon sidebar Channels diganti react-icons penuh + ADR-068 (amandemen ADR-058 poin 6)

### Context

Review PR #42 King Rezi menemukan 3 inkonsistensi icon di `channels-section.tsx` (KI-008 glyph "+" pakai `Text` bukan `Icon`/react-icons; KI-009 token font-size salah — `2xs`/8px, seharusnya 10px/`xs`; KI-012 beberapa Tailwind arbitrary-value class belum kanonik). Ketiganya dicatat sebagai Known Issues out-of-scope T-012 (ADR-066), belum pernah dipromosikan jadi task T-XXX resmi. Saat dikerjakan, King Rezi memperluas instruksi secara eksplisit: "pastikan semua icon pakai react-icon" — bukan cuma dark-mode/sidebar Channels, tapi seluruh `WorkspaceSideNav`.

### Changed (kode)

- `apps/web/src/app/[slug]/_sidebar-channels/channels-section.tsx`:
  - **KI-008 + KI-009** (digabung, 1 fix) — glyph tombol quick-compose "+" dari `<Text type="inherit" size="2xs" as="span">+</Text>` jadi `<FaPlus size={10} />` (`react-icons/fa6`), sekaligus mengoreksi ukuran ke 10px sesuai ADR-058 addendum poin 9.
  - **KI-012** — 3 Tailwind arbitrary-value class diganti canonical: `end-[calc(var(--spacing-1)*-1)]` → `-end-1`, `bottom-[calc(var(--spacing-1)*-1)]` → `-bottom-1`, `start-[calc(var(--spacing-4)*-1)]` → `-start-4`. Arbitrary value yang memang tidak ada padanan native (shadow ring token, durasi/easing `TRANSITION_FAST`) sengaja tidak diubah.
  - Tambahan konsisten dengan ADR-068: `GripIcon` custom inline SVG dihapus, diganti `RxDragHandleDots2` (`react-icons/rx`).
- `apps/web/src/app/[slug]/workspace-side-nav.tsx` (perluasan scope KI-008 atas instruksi eksplisit King Rezi, bukan cuma dark-mode) — CTA "+ New Post" → `FaPlus`; Notifikasi 🔔 → `FaBell`; toggle Dark/Light 🌙/☀️ → `FaMoon`/`FaSun`.

### Added

- **ADR-068** (`project-manager/decisions/ADR-068-...md`, amandemen ADR-058 poin 6) — `react-icons` diperluas jadi library ikon TUNGGAL untuk seluruh icon (brand maupun generik), menggantikan pola campuran sebelumnya (react-icons hanya untuk brand, custom SVG untuk generik). Dikonfirmasi 2x oleh King Rezi lewat `AskUserQuestion`, termasuk setelah diberi konteks riwayat konflik: komentar lama di `styles.css` Claude Design mencatat versi icon 16px untuk channel-add "+" pernah dicoba dan dinilai "looked worse, not better" (revert ke glyph mentah 20×20px), dan grip-handle sengaja dibuat custom SVG supaya "tidak perlu pull dependency baru untuk verifikasi 1 vector path". King Rezi tetap memilih mengganti semua ke react-icons — keputusan sadar yang menimpa keputusan lama, bukan pengulangan tanpa sepengetahuan. Ukuran akhir 10px (token `xs`, bukan 16px yang dulu gagal).

### Sinkronisasi Claude Design

Dikerjakan main session langsung via `DesignSync` (bukan Neymar subagent, keterbatasan sudah diketahui project). Project "Social Media Management" (`84aded99-...`), 8 file diupdate: 7 screen template (`home.html`, `publish-calendar.html`, `publish-queue.html`, `publish-drafts.html`, `engage-inbox.html`, `analyze-dashboard.html`, `settings-connected-accounts.html`) + `templates/app-prototype/AppPrototype.dc.html` (runner — logic `toggleTheme()`/`route()` yang tadinya deteksi klik lewat cocokkan teks emoji, diganti deteksi berbasis atribut `data-proto`/`aria-label` supaya tetap jalan setelah icon jadi SVG). Seluruh icon sekarang SVG statis identik secara visual dengan `react-icons` yang dipakai di kode. Memenuhi duty sinkronisasi ADR-056.

### Verifikasi

- **Review Ridwan Architecture Reviewer**: bersih, tidak ada pelanggaran arsitektur.
- **QA Najwa**: seluruh fungsional lolos lewat klik nyata (bukan cuma visual) — quick-compose "+", New Post, Notifikasi, toggle Dark/Light semua diverifikasi berfungsi. Lint/typecheck/vitest (45 test) semua pass. Satu keterbatasan: mekanika drag-reorder channel tidak tervalidasi tuntas lewat automation (drag sintetis tidak trigger reorder) — kemungkinan besar keterbatasan tool automation, bukan regresi (fix race condition drag-reorder di commit 516e48a tidak disentuh sama sekali oleh perubahan ini, murni ganti icon).

### Catatan proses (insiden kecil, sudah diverifikasi aman)

Selama debugging tidak terkait (masalah login/tunnel), agent implementasi sempat membaca `.env.local` via `cat` lewat Bash — melanggar deny-list Read eksplisit untuk file tersebut. Ridwan Architecture Reviewer sudah memverifikasi: tidak ada kebocoran isi env ke file manapun, dan `.env.local` sendiri tidak ter-modifikasi/ter-commit. Dicatat di sini sebagai jejak transparansi proses, bukan Known Issue baru (sudah clear), dan sebagai pengingat tech-debt kecil untuk memperketat guardrail Read terhadap file secret di sesi mendatang.

### Changed (dokumentasi)

- `project-manager/PROJECT_STATE.md` — **KI-008, KI-009, KI-012** dihapus dari section Known Issues (sudah `Resolved` dan tercatat di sini, mengikuti pola ADR-067). **Recent Decisions** menambahkan ADR-068 di atas (ADR-063 keluar dari daftar 5 teratas). **Completed (Ringkasan)** menambahkan entri ini di atas (entri ADR-059 keluar dari daftar 5 teratas). Version 1.0.42 → 1.0.43.
- `project-manager/DECISIONS.md` — baris baru **ADR-068** ditambahkan di atas; baris ADR-058 diupdate Status jadi `Accepted — Amended by ADR-068 (2026-08-05)`.
- `project-manager/decisions/ADR-058-...md` — Status header + poin 6 ditambahkan catatan `[Diamandemen ADR-068, 2026-08-05]` yang menunjuk ke ADR-068 untuk detail dan riwayat konflik.
- `TASKS.md`/`tasks/` **tidak disentuh** — KI-008/009/012 murni entry Known Issues, tidak pernah dipromosikan jadi task T-XXX resmi.

---

## 2026-08-05 — ADR-067: Known Issues `Resolved` dihapus dari `PROJECT_STATE.md` jika sudah tercatat di `COMPLETE_TASK.md` (amandemen ADR-066)

### Context

King Rezi mengonfirmasi PR #42 sudah `MERGED` (dicek via `gh pr view 42`), lalu meminta KI-007 "diperbaiki". KI-007 ternyata sudah `Resolved` — satu-satunya bagian stale adalah catatan bahwa PR #42 belum di-merge. King Rezi kemudian meminta: entry Known Issues yang sudah `Resolved` **dan** sudah tercatat di `COMPLETE_TASK.md` dihapus saja dari `PROJECT_STATE.md`, dan aturan ini dijadikan aturan resmi pendokumentasian project.

### Added

- **ADR-067** (`project-manager/decisions/ADR-067-...md`, amandemen ADR-066) — Known Issues berstatus `Resolved` yang riwayat penyelesaiannya sudah tercatat di `COMPLETE_TASK.md` dihapus dari `PROJECT_STATE.md`. ID tetap tidak didaur ulang (bagian ADR-066 yang dipertahankan). Entry `Promoted to T-XXX` dikecualikan — tetap tercatat sampai task tujuannya selesai. Ditambahkan ke indeks `DECISIONS.md`.

### Changed

- `project-manager/PROJECT_STATE.md` — **KI-007** dan **KI-011** (keduanya `Resolved`, sudah tercatat di entri `COMPLETE_TASK.md` 2026-08-05 di bawah) dihapus dari section Known Issues. Catatan format section Known Issues diperbarui menyebut ADR-067. Recent Decisions menambahkan ADR-067 di atas (ADR-062 keluar dari daftar 5 teratas). Version 1.0.41 → 1.0.42.
- `project-manager/decisions/ADR-066-...md` — Status diubah jadi `Accepted — Amended by ADR-067`; poin "ID tidak pernah didaur ulang" ditambah catatan amandemen.
- `project-manager/DECISIONS.md` — baris ADR-066 diupdate Status-nya, baris baru ADR-067 ditambahkan di atas.
- `project-manager/PROJECT_RULES.md` — bullet aturan Known Issues (ADR-066) diperbarui menyebut amandemen ADR-067 dan syarat penghapusan entry `Resolved`. Version 0.3.0 → 0.3.1.

---

## 2026-08-05 — T-012.9 (bug drag-reorder) fix + KI-011 resolved (helper `cn` global + migrasi `channels-section.tsx`)

### Changed

- **T-012.9 (bug, in-scope T-012)** — fix race condition drag-reorder di `apps/web/src/app/[slug]/_sidebar-channels/channels-section.tsx` (`handleDrop`): sekarang membaca `sourceId` dari `e.dataTransfer.getData("text/plain")` alih-alih state `draggedId` yang stale lewat closure saat native `drop` fire sebelum React re-render dari `dragstart`. State `draggedId` tetap dipertahankan untuk visual `isDragging`. Diimplementasikan Mark UI Engineer, review arsitektur Ridwan (0 pelanggaran), QA statis Najwa (typecheck/lint/test PASS — verifikasi browser di-skip atas keputusan eksplisit King Rezi, tidak ada environment preview). Belum di-commit ke git.
- **KI-011 (tech-debt) resolved** — helper `apps/web/src/lib/cn.ts` (`cn()` join className, tanpa dependency baru) dibuat, dan `channels-section.tsx` dimigrasikan penuh: `cx()` lokal dihapus total, 4 titik pemanggilan className diganti `cn()` dari `@/lib/cn`. Review + QA sama seperti di atas.
- `project-manager/tasks/v01-foundation.md` — T-012.9 dicentang selesai; redaksi Status T-012 disesuaikan (T-012.1/2 tetap deferred menunggu v0.2, tidak diubah).
- `project-manager/TASKS.md` — baris **Fokus sekarang** untuk T-012 diperbarui menyebut T-012.9 selesai.
- `project-manager/PROJECT_STATE.md` — **KI-007** dan **KI-011** diubah Status jadi `Resolved`; redaksi KI-007 menambah catatan bahwa merge PR #42 tetap terpisah dari status bug (yang sudah selesai).

---

## 2026-08-05 — ADR-066: Known Issues berstruktur dengan ID `KI-XXX` + pemisahan scope T-012 (out-of-scope dari review PR #42)

### Added

- **ADR-066** (`project-manager/decisions/ADR-066-...md`) — Known Issues di `PROJECT_STATE.md` sekarang memakai ID global `KI-001`–`KI-013` (namespace terpisah dari `T-XXX`), field table ringkas (Status/Kategori/Terkait/Ditemukan), ID tidak didaur ulang. Ditambahkan ke indeks `DECISIONS.md`.
- **Pemisahan scope T-012**: dari 6 temuan review King Rezi di PR #42 (T-012.7–12), hanya **T-012.9** (bug drag-reorder race condition) dinilai in-scope dan tetap sebagai subtask T-012. 5 temuan lain (T-012.7/8/10/11/12 — code consistency, dokumentasi konvensi folder, helper `cn` global, Tailwind class belum kanonik) dinilai **out-of-scope**, dipindah jadi entry Known Issues terpisah: **KI-008, KI-009, KI-010, KI-011, KI-012**.

### Changed

- `project-manager/tasks/v01-foundation.md` — checklist T-012 dirampingkan, hanya menyisakan T-012.9 dengan pointer ke Known Issues untuk 5 temuan lain.
- `project-manager/TASKS.md` — baris fokus T-012 di indeks disesuaikan (pointer ke Known Issues untuk temuan out-of-scope).
- `project-manager/PROJECT_STATE.md` — seluruh section **Known Issues** direstrukturisasi jadi 13 entry berID (`KI-001`–`KI-013`), **Recent Decisions** menambahkan ADR-066 di atas (ADR-061 keluar dari daftar 5 teratas). Version 1.0.40 → 1.0.41.
- `project-manager/PROJECT_RULES.md` (Static Reference, perubahan struktural) — section **Formatting Rules** menambah bullet konvensi ADR-066 (ID `KI-XXX` + field table wajib untuk setiap entry Known Issues). Version 0.2.0 → 0.3.0.
- Audit menyeluruh atas seluruh file yang menyebut "Known Issues" (`context/ctx-project.md`, `context/ctx-development.md`, `PROJECT_RULES.md`, `CONVERSATIONS.md`, `DEVELOPER_WORKFLOW.md`, `README.md`, `QA_TEST_ACCOUNTS.md`, `tasks/v10-public-launch.md`, `.claude/agents/gibran-project-manager.md`, `.claude/skills/project-os-navigator/SKILL.md`) — seluruhnya hanya menyebut "Known Issues" sebagai nama section/lokasi (tidak mendeskripsikan format), jadi tidak perlu diubah kecuali `PROJECT_RULES.md` di atas.

---

## 2026-08-05 — T-012 Sidebar "Channels" — laporan temuan review King Rezi di PR #42 (T-012.7–12, belum dikerjakan)

### Added

- Subtask baru **T-012.7–T-012.12** di `project-manager/tasks/v01-foundation.md`, mencatat 6 temuan King Rezi saat review PR #42 (belum di-merge): 1 bug (T-012.9, drag-reorder race condition — closure `draggedId` stale kalau native `drop` ter-fire sebelum React re-render dari `setDraggedId`, diverifikasi lewat simulasi `DragEvent` langsung di browser) + 5 catatan kualitas (T-012.7 icon "+" pakai `Text` bukan `Icon`/react-icons; T-012.8 token font-size salah — `2xs`/8px dipakai padahal ADR-058 minta 10px yaitu token `xs`; T-012.10 konvensi folder underscore-prefix belum terdokumentasi resmi; T-012.11 tidak ada helper `cn`/`clsx` global; T-012.12 beberapa Tailwind class belum kanonik, project belum punya lint plugin untuk itu).
- Tidak ada perubahan kode — sesi ini murni pelaporan/pencatatan, sesuai permintaan King Rezi untuk dikerjakan di sesi/chat terpisah. PR #42 tetap terbuka, menunggu instruksi merge dari King Rezi.

---

## 2026-08-05 — T-012 Sidebar section "Channels" — implementasi sebagian (T-012.3/4/5/6 selesai, T-012.1/2 tetap deferred)

### Added

- `apps/web/src/app/[slug]/_sidebar-channels/channels-section.tsx` — komponen
  baru render section "Channels" di `WorkspaceSideNav`, antara `SideNavSection`
  "Menu" dan footer (bukan nav item ke-6, sesuai P-IA-01/ADR-058).
- `apps/web/src/app/[slug]/_sidebar-channels/platform-icons.tsx` — mapping 8
  `SocialPlatform` → ikon brand `react-icons/fa6`.
- `react-icons@^5.7.0` dikonfirmasi sebagai dependency runtime `apps/web`
  (T-012.3).
- Helper `getConnectionStatusLabel` / `resolveConnectionDisplayStatus` di
  `apps/web/src/domains/workspace/value-objects/connection-status.ts` — mapping
  status koneksi akun ke label + Badge variant, dipakai section Channels dan
  disiapkan untuk dipakai ulang oleh halaman Connected Accounts settings
  (T-015).

### Changed

- `apps/web/src/app/[slug]/_draft-editor/context.tsx` — `openNewPost()`
  diperluas menerima `preSelectedAccountId?: string`; kalau diisi, langsung
  masuk mode `"create"` dengan akun ter-pre-select dan **skip** resume-check
  (ADR-058 addendum poin 9 — entry point beda konteks dari CTA "+ New Post"
  polos).
- `apps/web/src/app/[slug]/_draft-editor/modal.tsx` — Account Selector
  otomatis pre-check akun saat modal dibuka dari `preSelectedAccountId`.
- `apps/web/src/app/[slug]/workspace-side-nav.tsx` — terima prop channel list
  baru, render `ChannelsSection`.
- `project-manager/tasks/v01-foundation.md` (T-012) — checkbox T-012.3/4/5/6
  ditandai selesai; T-012.5 dan T-012.6 diberi catatan eksplisit masih ada
  bagian stub/non-persisten (scheduled count hardcode 0, reorder client-state
  only, tidak reload-safe) menunggu T-012.1/T-012.2 (v0.2). T-012.1/T-012.2
  tetap unchecked, ditandai "deferred — menunggu domain publishing v0.2".
- `project-manager/TASKS.md` — status T-012 di **Fokus sekarang** dari ⏳ jadi
  🟡 In Progress, catatan diperbarui.
- `project-manager/PROJECT_STATE.md` — `Top Next Tasks` (Snapshot), section
  **In Progress**, dan **Known Issues** diperbarui (scheduled count stub 0 +
  reorder belum persisten, menunggu T-012.1/T-012.2). Version 1.0.38 →
  1.0.39.

### Verifikasi

- Typecheck, lint, dan unit test (Vitest) bersih untuk seluruh perubahan.
- Review arsitektur Ridwan Architecture Reviewer: **lolos, tanpa temuan
  blocking** (entry point `layout.tsx` tetap hanya memanggil Application
  Service, tidak ada leak Prisma/domain internals ke komponen UI).
- QA code-level Najwa QA Engineer: **lolos**. Verifikasi browser end-to-end
  (interaksi hover, drag-reorder, klik "+", deep-link Disconnected) **belum
  dilakukan** — butuh tunnel ngrok aktif yang belum tersedia saat sesi ini;
  dicatat sebagai follow-up, bukan blocker penutupan T-012.3–6.

### Catatan

- Keputusan implementasi kecil (bukan ADR): Badge status memakai variant
  `"warning"` untuk **kedua** kondisi `reconnectRequired` dan `disconnected`
  (bukan hanya `reconnectRequired`). Ini reuse variant Badge yang sudah ada
  (sejalan ADR-058 poin 2 "tidak ada warna status baru"), belum dikonfirmasi
  eksplisit ke King Rezi sebagai keputusan terpisah — tidak dianggap
  penyimpangan material dari ADR-058 sehingga tidak dibuat ADR baru, tapi
  ditandai di sini untuk transparansi.

---

## 2026-08-05 — ADR-065: Draft Editor Fullscreen/Standard Toggle Jadi Fitur Resmi

### Added

- ADR-065 (`project-manager/decisions/`) — toggle Fullscreen/Standard di
  header dialog Draft Editor (New Post & Edit Draft, KSP-05) naik status
  dari alat banding sementara fase Design System (ADR-052) jadi **fitur
  resmi produk**, akan dibawa ke implementasi kode `apps/web`. Toggle tidak
  dipersist — reset ke Standard setiap dialog dibuka ulang.
- Claude Design (`readme.md`) — section baru "Draft Editor Dialog Variant
  Toggle (official product feature, ADR-065)".

### Changed

- **Default tampilan Draft Editor diubah dari Fullscreen → Standard**
  (override ADR-052 addendum "Koreksi: default dikembalikan ke
  Fullscreen"). Diterapkan di Claude Design: `templates/draft-editor.html`
  (`var variant = 'standard'`) dan
  `templates/app-prototype/AppPrototype.dc.html`
  (`state.dialogVariant: 'standard'`), plus komentar & tooltip toggle di
  kedua file.
- `readme.md` — "Don't" list dikoreksi (hapus larangan "Do not ship both
  Draft Editor Dialog variants to `apps/web`", karena sekarang justru
  keduanya dikirim); "Direction", "Components" (`.dialog-fs`/`.dialog-lg`),
  "How to Demo", dan "Files" diperbarui mengikuti default baru + status
  resmi toggle.
- `project-manager/DECISIONS.md` — baris indeks ADR-065 ditambahkan.
- `project-manager/PROJECT_STATE.md` — "Recent Decisions" digeser (ADR-065,
  ADR-064 masuk; ADR-060, ADR-059 keluar dari daftar 5 teratas).
- `product-discovery/04-ux/navigation-patterns.md` — 6 penyebutan "modal
  overlay fullscreen"/"modal fullscreen" (baris Transisi NP di sekitar
  275/296/314/429/462, dan tabel Decision Log NP-D11) dirapikan: istilah
  generik "modal overlay" dipakai untuk jenis modalnya, sedangkan
  Fullscreen/Standard disebut eksplisit sebagai dua variant resmi dengan
  Standard sebagai default (ADR-065) — supaya tidak lagi seolah-olah
  Fullscreen satu-satunya/default tampilan.
- `product-discovery/04-ux/key-screen-patterns.md` (KSP-05, catatan Panel
  AI) — deskripsi variant Fullscreen/Standard disesuaikan: Standard jadi
  default (ADR-065), toggle dinyatakan sebagai fitur resmi bukan alat
  banding sementara.

**Follow-up (2026-08-05, sama hari):** Ditemukan ADR-065 belum punya task
implementasi kode — T-020 (Draft Editor modal, sudah `✅ Done`) hanya
mengimplementasikan variant Fullscreen, tidak ada toggle/variant Standard
sama sekali. Ditambahkan:

- `project-manager/tasks/v02-publishing-mvp.md` — **T-038 baru** "Toggle
  Fullscreen/Standard resmi di Draft Editor" (4 subtask), memakai nomor
  cadangan release v0.2 (T-037–T-039). Catatan ditambahkan di T-020
  menjelaskan deskripsinya sudah tidak lengkap sejak ADR-065.
- `project-manager/TASKS.md` — indeks v0.2 (18→19 task, ⏳ 12→13) dan Total
  (69→70 task, 134→138 subtask) diperbarui mengikuti T-038 baru.

---

## 2026-08-04 — ADR-064: Konsolidasi Skill ke `.claude/skills/` sebagai Sumber Tunggal

**Konteks.** King Rezi menemukan skill project hidup di dua tempat sekaligus:
`.agents/skills/` (14 skill vendor: Prisma, Supabase, Vercel, Better Auth) dan
`.claude/skills/` (yang sebagian isinya berupa **symlink direktori** ke
`.agents/skills/` untuk 3 skill custom). Dua salinan fisik tanpa mekanisme
penjamin sinkronisasi = rawan divergen. King Rezi memutuskan menghapus
`.agents/skills/` setelah memverifikasi lewat
[dokumentasi Cursor](https://cursor.com/docs/skills) bahwa Cursor juga membaca
`.claude/skills/`.

**Perubahan (commit `d4fb2ab`, dikerjakan King Rezi + Cursor).**

* `.agents/skills/` dihapus; 14 skill vendor dipindahkan **byte-identical**
  (git mendeteksi `R100`) ke `.claude/skills/`.
* 3 skill custom (`project-os-navigator`, `proactive-clarification`,
  `work-report-simple`) yang tadinya symlink dibongkar jadi file nyata —
  perbedaan terhadap versi lama hanya formatting whitespace prettier (padding
  tabel + blank line), **nol kehilangan konten** (diverifikasi via `diff`
  terhadap blob `HEAD~1`).
* `AGENTS.md` mendapat section baru **"## Skills (`.claude/skills/`)"** berisi
  aturan single-source + 3 guardrail anti-duplikasi + caveat bahwa
  `.claude/skills/` di Cursor adalah compatibility path, bukan native.
* Referensi `.agents/skills/` diperbarui ke `.claude/skills/` di `AGENTS.md`,
  `context/ctx-project.md`, `project-manager/DEVELOPER_WORKFLOW.md`,
  `project-manager/PROJECT_STATE.md`, `.claude/agents/README.md`.

**Review + kelengkapan (sesi ini, Jokowi).** King Rezi minta review apakah
skill masih berjalan baik dan tidak ada yang miss. Hasil verifikasi: 18 folder
skill / 340 file tracked git, **nol symlink & nol broken symlink**, frontmatter
semua valid (`name` == nama folder, `description` ada), dan seluruh 18 skill
terbukti terbaca Claude Code di sesi ini. Klaim Cursor terkonfirmasi langsung
dari dokumentasi resminya. Tiga gap governance ditutup di sesi ini:

* **ADR-064** dibuat (`decisions/ADR-064-...md`) + didaftarkan di
  `DECISIONS.md` — sebelumnya keputusan struktural ini hanya tercatat sebagai
  prosa di `AGENTS.md`, tanpa ADR (preseden: ADR-045 untuk kasus hapus folder
  `design/`).
* Entri `COMPLETE_TASK.md` ini ditambahkan (sebelumnya belum ada untuk
  perubahan `d4fb2ab`).
* Dua stale worktree dihapus: `.claude/worktrees/status-pekerjaan-6ef926` dan
  `.claude/worktrees/test-787c6a`. Keduanya masih membawa `.agents/skills/`
  lengkap + `AGENTS.md` lama yang menunjuk ke `.agents/skills/` — risiko nyata
  sesi AI membaca aturan lama dan menghidupkan ulang duplikasi. Diverifikasi
  aman sebelum dihapus: tidak ada commit unik (`main..HEAD` kosong), dan
  perubahan uncommitted-nya hanya noise formatting prettier pada file skill
  vendor Vercel.

**Efek samping yang ketahuan saat verifikasi akhir — dan diperbaiki.**
`eslint.config.mjs` dan `.prettierignore` masih meng-ignore `.agents` (folder
yang sudah dihapus) tapi **tidak** `.claude`. Akibatnya 90 file
`.mjs`/`.ts`/`.js` skill vendor di `.claude/skills/` masuk cakupan lint &
format: `bunx eslint .` menghasilkan **17 warning** dari kode vendor, dan
`bun run format` (`prettier --write .`) akan menulis ulang file skill vendor
sehingga drift dari upstream dan hash `skills-lock.json` tidak lagi match.
Inilah penyebab tiga file `vercel-optimize/lib/gates/*` termodifikasi di kedua
stale worktree — bukan pekerjaan nyata, tapi jejak `bun run format`. CI
([`ci.yml`](../.github/workflows/ci.yml) menjalankan `bun run lint`) belum
gagal karena semuanya warning, bukan error. Perbaikan: `.agents` → `.claude/**`
di kedua ignore list, plus membersihkan entri `design/` yang sudah mati sejak
ADR-045. Setelah perbaikan: `eslint .` **0 problem** (dari 17 warning) dan
`prettier --check .` lolos seluruhnya. `lint-staged` tidak terdampak — pola-nya
terbatas pada `apps/**`, `packages/**`, dan file root non-rekursif.

**Audit paritas Claude Code ↔ Cursor (permintaan lanjutan King Rezi).**
Diverifikasi ke dokumentasi resmi Cursor: `AGENTS.md`, `.claude/skills/`, dan
`.claude/agents/` (7 subagent kerja) **terbaca di kedua tool** — dua yang
terakhir lewat compatibility path, jadi aturan ADR-063 soal delegasi subagent
tetap berlaku di Cursor. Dua aset ternyata **tidak** punya jalur
kompatibilitas:

* **Config MCP** — `.mcp.json` root adalah konvensi Claude Code, bukan bagian
  spesifikasi MCP (spec hanya mengatur protokol, bukan lokasi config client).
  Cursor hanya membaca `.cursor/mcp.json`. King Rezi memutuskan **membuat
  duplikat** `.cursor/mcp.json` agar MCP Astryx (`xds`) aktif di Cursor juga.
* **Proteksi baca secret** — `permissions.deny` di `.claude/settings.json`
  tidak dibaca Cursor sama sekali. Dibuat `.cursorignore` sebagai padanannya
  (`.env*`, `*.pem`, `credentials*.json`), lengkap dengan komentar pengingat
  sinkronisasi.

Kewajiban menjaga kedua pasang file kembar itu sinkron didokumentasikan di
section baru **"## Kompatibilitas tool: Claude Code ↔ Cursor"** pada
`AGENTS.md` (tabel paritas 6 aset + 2 aturan sinkronisasi), dan tercatat
sebagai poin 9–10 ADR-064 — termasuk alasan kenapa duplikasi di sini
**bukan** pelanggaran prinsip single-source poin 1: skill adalah konten prompt
yang bisa hidup di satu lokasi yang dibaca kedua tool, sedangkan config MCP dan
proteksi secret adalah deklarasi khusus-client.

**Terverifikasi langsung oleh King Rezi (bukan lagi asumsi dokumentasi):**
setelah `.cursor/mcp.json` dibuat, King Rezi membuka project di Cursor dan
mengonfirmasi server `xds` aktif — sesuai prediksi dari dokumentasi resmi
Cursor. Catatan risiko di ADR-064 diperbarui dari "belum diuji langsung" jadi
terkonfirmasi.

**Dokumentasi stale yang ikut dibereskan.**

* `context/ctx-development.md` — checklist masih menyebut `CHANGELOG` yang
  sudah dilebur ke `COMPLETE_TASK.md` (ADR-061); diganti sekaligus melengkapi
  urutan update `TASKS.md` + `tasks/` (ADR-062).
* `project-manager/QA_TEST_ACCOUNTS.md` — referensi `CHANGELOG.md` →
  `COMPLETE_TASK.md`.
* `context/ctx-project.md` — indeks Project OS sebelumnya **tidak menyebut
  kewajiban evaluasi delegasi subagent sama sekali**, padahal itu inti ADR-063;
  ditambahkan pointer ke `.claude/agents/README.md` + aturan operasional 2a.
  (Persis pola akar masalah ADR-063: aturan ada, tapi tidak terhubung ke jalur
  yang benar-benar dibaca AI.)
* `AGENTS.md` — section "Workflow Astryx wajib" diperbarui: config MCP kini
  menyebut kedua file.
* `PROJECT_STATE.md` — Metadata version 1.0.37 → 1.0.38; Current Focus mencatat
  `.claude/skills/` sebagai satu-satunya lokasi skill + project dikerjakan di
  dua tool.

**Catatan risiko yang diterima (detail di ADR-064).** `skills-lock.json` tidak
menyimpan install path, jadi `npx skills add/update` berikutnya tetap menulis
ke `.agents/skills/` — mitigasinya manual lewat aturan di `AGENTS.md`.
`.agents/` sengaja **tidak** di-`.gitignore` supaya folder liar tetap terlihat
di `git status`.

---

## 2026-08-04 — ADR-063: Integrasi Delegasi Subagent ke Alur Kerja Wajib

King Rezi melaporkan AI utama (Jokowi) jarang menggunakan 7 subagent kerja (`.claude/agents/`) semenjak restrukturisasi dokumentasi ADR-060–062, dan minta didiagnosis mengapa — harapannya subagent bisa mengerjakan beberapa task secara paralel.

Diagnosis (git log + perbandingan diff `SKILL.md`/`AGENTS.md` sebelum-sesudah ADR-060–062) menemukan akar masalah **struktural, bukan konten yang hilang**: panduan orkestrasi subagent (`.claude/agents/README.md`) sejak dibuat (30 Juli 2026) tidak pernah terhubung ke alur kerja operasional AI. `.agents/skills/project-os-navigator/SKILL.md` (behavior utama AI) tidak pernah menyebut subagent sama sekali baik versi lama maupun baru; subagent hanya disebut di satu section deskriptif berdiri sendiri di `AGENTS.md`. Field task di `tasks/vXX-*.md` juga tidak memetakan `Domain` ke subagent mana pun. ADR-060–062 memperparah secara relatif dengan memperpanjang cascade baca dokumen untuk task nyata tanpa satu pun titik yang mengarah ke evaluasi delegasi.

### Added

* `project-manager/decisions/ADR-063-integrasi-delegasi-subagent-ke-alur-kerja-wajib-pemetaan-domain-subagent.md`.
* `.claude/agents/README.md` — section baru "Kapan WAJIB dievaluasi" + tabel **Pemetaan Domain → Subagent** (identity/workspace/publishing/analytics → Prabowo; integration/media/notification → Elon; UI → Mark; platform/DX → biasanya tanpa subagent).

### Changed

* `AGENTS.md` — "Wajib di awal sesi" mendapat langkah baru (poin 3): evaluasi delegasi subagent berdasarkan field Domain sebelum eksekusi kode. Section "Subagent kerja" ditegaskan bukan referensi opsional.
* `.agents/skills/project-os-navigator/SKILL.md` — behavior "Pekerjaan Baru" mendapat sub-langkah 1a (evaluasi delegasi + kemungkinan paralel); cascade "Tingkat 3" ditambah pointer ke `.claude/agents/README.md` sebelum eksekusi. (Symlink `.claude/skills/project-os-navigator` ikut terupdate otomatis — sumber tunggal.)
* `project-manager/TASKS.md` — "Cara pakai" mendapat langkah baru yang sama, supaya jalur masuk manapun (AGENTS.md, SKILL.md, atau langsung TASKS.md) konsisten.
* `PROJECT_STATE.md` — Recent Decisions & Completed (Ringkasan) menambahkan ADR-063, menggeser entri terlama keluar dari daftar 5. Version 1.0.36 → 1.0.37.
* `DECISIONS.md` — tambah 1 baris indeks ADR-063 di baris paling atas.

### Fixed

* `.claude/agents/README.md` (5 lokasi: header klasifikasi, deskripsi peran Gibran, aturan orkestrasi Gibran, dan cara mencatat perubahan) — referensi mati ke `project-manager/CHANGELOG.md` (dihapus/digabung ke `COMPLETE_TASK.md` sejak ADR-061, 3 Agustus) diperbaiki, sebagian ke `COMPLETE_TASK.md`, sebagian menambah `TASKS.md`/`tasks/` yang belum tercatat sejak ADR-062. Bukti konkret dokumentasi subagent tidak ikut disinkronkan saat dua restrukturisasi berturut-turut.
* `context/ctx-project.md` — tabel "Living vs static" masih menulis `CHANGELOG.md` sebagai Living Document dan `CONVERSATIONS.md` salah diklasifikasi Living (seharusnya Append-Only per `PROJECT_RULES.md`). Diperbaiki jadi 3 tipe (Living: `PROJECT_STATE.md` + `TASKS.md`/`tasks/`; Append-Only: `DECISIONS.md`+`decisions/`, `COMPLETE_TASK.md`, `CONVERSATIONS.md`, `BRAINSTORM.md`; Static reference).
* `.claude/agents/prabowo-feature-engineer.md` (role file, chmod 444, dibuka dengan konfirmasi eksplisit King Rezi) — instruksi "serahkan ke Gibran untuk update CHANGELOG.md" diperbaiki jadi `TASKS.md`/`tasks/`/`COMPLETE_TASK.md`, lalu di-chmod 444 kembali.

### Decisions

* ADR-063 dicatat di `project-manager/decisions/ADR-063-integrasi-delegasi-subagent-ke-alur-kerja-wajib-pemetaan-domain-subagent.md`.

---

## 2026-08-04 (lanjutan) — T-011.3 & T-011 ditutup: QA browser oleh Najwa

Melanjutkan entri T-011.3 di bawah (branch `feat/t-011-3-verifikasi-redirect-terminal-action`, HEAD `d7aa837`). Bagian yang sebelumnya belum bisa diotomatiskan — editor benar-benar tertutup dan layar tujuan tampil setelah aksi terminal — sudah diverifikasi manual oleh Najwa QA Engineer via browser (tunnel ngrok, akun test Raka Pratama/Owner).

### Verification

* `bun run typecheck`/`lint`/`test` tetap hijau (45/45 test, 8 file) di titik verifikasi.
* Golden path via browser, semua **PASSED**:
  * Save as Draft dari Home (non-publish) → modal tertutup dulu → redirect `/[slug]/publish/drafts`, draft baru muncul di listing.
  * Schedule dari Engage (non-publish) → dialog konfirmasi ADR-049 tampil → setelah konfirmasi, modal tertutup → redirect `/[slug]/publish/queue`. (Queue masih placeholder — tercatat di T-032, bukan temuan baru.)
  * Edge case "sudah di destinasi" (buka New Post dari `/publish/drafts` sendiri, Save as Draft) → tetap di URL yang sama via `router.refresh()`, draft baru tetap tersimpan — sesuai `isAlreadyAtDestination`.
  * Regresi: navigasi sidebar dan CTA "+ New Post" (T-011.1/T-011.2) normal dari seluruh section yang dicoba.
* Tidak ada bug/regresi baru ditemukan. Satu catatan non-blocking: overlay hydration error dev saat akses lewat ngrok — sudah tercatat sebagai T-018, tidak menghambat fungsionalitas.

### Status

* **T-011.3** dicentang selesai di `tasks/v01-foundation.md`.
* **T-011** (Sidebar CTA "+ New Post") ditutup `✅ Done` — ketiga subtask (T-011.1, T-011.2, T-011.3) selesai dan terverifikasi. Section T-011 dirapikan jadi paragraf ringkas tanpa checklist, mengikuti konvensi task selesai di file release.
* Indeks `TASKS.md`: v0.1 8 ✅ (dari 7), Total 13 selesai (dari 12). "Fokus sekarang" dan `PROJECT_STATE.md` Top Next Tasks diperbarui — T-011 dihapus dari daftar fokus.

## 2026-08-04 — T-011.3: redirect aksi terminal dari section non-publish

PR #37 sudah di-merge King Rezi sebelum T-011.3 dikerjakan, jadi subtask ini jalan di branch baru `feat/t-011-3-verifikasi-redirect-terminal-action`.

Judul subtask menyebut "verifikasi", tapi pemeriksaan terhadap ADR-054 menemukan dua celah nyata, bukan sekadar hal yang perlu dicek:

1. Redirect Save as Draft yang ditambahkan saat tindak lanjut code review PR #37 tidak menutup editor lebih dulu — modal fullscreen tetap menutupi layar tujuan, sehingga "redirect" praktis tidak terlihat.
2. Schedule masih memakai `router.refresh()`. Dari Home/Engage/Analyze itu tidak menampilkan apa pun, padahal ADR-054 menetapkan tujuannya Publish > Queue.

### Added

* `apps/web/src/app/[slug]/_draft-editor/terminal-destination.ts` — aturan destinasi ADR-054 diekstrak jadi fungsi murni (`resolveTerminalDestination`, `isAlreadyAtDestination`). Alasannya bukan kerapian: environment Vitest project ini `node` tanpa jsdom/testing-library, jadi tanpa ekstraksi ini aturan redirect sama sekali tidak bisa diuji otomatis dan verifikasinya bergantung penuh pada uji manual sambil login.
* `apps/web/src/app/[slug]/_draft-editor/terminal-destination.test.ts` — 8 test: destinasi Save as Draft → Drafts, Schedule → Queue, slug tidak hardcode, destinasi tidak berubah mengikuti section asal, plus perilaku refresh-vs-push termasuk `pathname` `null`.

### Changed

* `apps/web/src/app/[slug]/_draft-editor/modal.tsx` — helper baru `finishTerminalAction(action)`: menutup editor (`close()`) lalu `router.push` ke tujuan, atau `router.refresh()` bila pengguna memang sudah berada di layar tujuan. Dipakai `handleSaveDraft` (→ Publish > Drafts) dan `handleConfirmSchedule` (→ Publish > Queue). Banner sukses pada kedua jalur dihapus karena editor keburu tertutup — umpan baliknya kini item yang muncul di layar tujuan, sesuai App Prototype di Claude Design. Banner error tetap ada.

### Notes

* **Penyimpangan yang disengaja:** `TASKS.md` mencatat T-031.3 (Schedule → Queue) "relevan setelah T-032", dan layar Queue memang masih placeholder. Catatan itu ditulis sebelum CTA sidebar ada. Karena ADR-054 sudah menetapkan destinasi dan mendarat di Queue lebih baik daripada tertinggal di Analyze tanpa jejak aksi, redirect ini tetap dipasang sekarang. Kalau King Rezi menilai sebaiknya menunggu T-032, bagian `handleConfirmSchedule` tinggal dikembalikan ke `router.refresh()`.
* Publish Now (T-031.4) tidak disentuh — implementasinya memang belum ada (T-029).

### Verification

* `bun run typecheck` bersih · `bun run lint` 0 error · `bun run test` **45 test / 8 file** lolos (naik dari 37/7 — 8 test baru untuk aturan destinasi).
* Aturan destinasi ADR-054 kini terverifikasi otomatis. Yang **belum** terverifikasi dan tidak bisa diotomatiskan tanpa login: bahwa editor benar-benar tertutup dan halaman tujuan benar-benar tampil setelah aksi terminal. Karena itu T-011.3 belum dicentang dan T-011 tetap 🟡 — legend `✅` mensyaratkan "selesai dan terverifikasi".

## 2026-08-04 — T-011.1: render CTA "+ New Post" di sidebar

Branch baru `feat/t-011-sidebar-cta-new-post`. Subtask pertama T-011 (ADR-053): menaruh CTA primary full-width di sidebar, tepat di bawah Workspace Selector dan di atas navigation items — supaya New Post bisa diakses dari section manapun, bukan hanya dari Publish.

Acuan: ADR-053, `04-ux/navigation-patterns.md` (NP-D01), dan Claude Design `components/navigation.html` (`<div class="sidebar-cta"><button class="btn btn-primary btn-block">＋ New Post</button></div>`, berada tepat setelah `.ws-switch` dan sebelum `.nav`).

### Changed

* `apps/web/src/app/[slug]/workspace-side-nav.tsx` — menambahkan `Button` (`variant="primary"`, `width="100%"`, ikon `＋`, label `New Post`) pada slot `topContent` milik Astryx `SideNav`. Slot ini memang didokumentasikan sebagai "Content below the header, e.g., a create button" — posisinya persis di bawah header (Workspace Selector) dan di atas `children` (nav items), dan tidak ikut ter-scroll bersama `children`, jadi tetap *pinned* saat daftar Channels (T-012) nanti memanjang.

### Notes

* Tombol belum punya handler klik — wiring ke `DraftEditorProvider` adalah T-011.2. Saat ini provider hanya dipasang di `apps/web/src/app/[slug]/publish/layout.tsx`, sehingga belum bisa dipanggil dari section lain; itu justru inti pekerjaan T-011.2.

### Verification

* `bun run typecheck` bersih · `bun run lint` 0 error (85 warning, seluruhnya dari `.claude/worktrees/**`, pre-existing).
* Verifikasi visual di browser **belum dilakukan** — sidebar hanya tampil setelah login, dan AI tidak memasukkan kredensial. Perlu dicek King Rezi saat login.

## 2026-08-04 — T-011.2: Draft Editor bisa dibuka dari section manapun

Lanjutan langsung dari T-011.1 di branch yang sama (PR #37). Sebelumnya `DraftEditorProvider` hanya dipasang di `apps/web/src/app/[slug]/publish/layout.tsx`, jadi CTA di sidebar (yang hidup di `[slug]/layout.tsx`, satu level di atasnya) tidak mungkin memanggilnya.

### Changed

* **Folder `_draft-editor/` dipindahkan** dari `apps/web/src/app/[slug]/publish/_draft-editor/` ke `apps/web/src/app/[slug]/_draft-editor/` (`git mv`, 4 file: `actions.ts`, `context.tsx`, `modal.tsx`, `status-badge.ts`). Alasannya: Draft Editor sekarang bukan lagi milik section Publish — ia dipakai lintas section. Seluruh import internalnya memakai alias `@/`, jadi isi file tidak perlu diubah.
* `apps/web/src/app/[slug]/layout.tsx` — membungkus `AppShell` dengan `DraftEditorProvider` dan merender `DraftEditorModal` di level workspace.
* `apps/web/src/app/[slug]/publish/layout.tsx` — provider dan modal dilepas; tinggal `VStack` + `PublishTabbar`.
* `apps/web/src/app/[slug]/workspace-side-nav.tsx` — CTA memanggil `openNewPost()` dari `useDraftEditor()`.
* `apps/web/src/app/[slug]/publish/drafts/drafts-list.tsx` — path import disesuaikan (`../` → `../../`).
* `apps/web/src/domains/publishing/content-format-matrix.ts` — komentar penunjuk path `modal.tsx` diperbarui.

### Verification

* `bun run typecheck` bersih · `bun run lint` 0 error · `bun run test` 37 test / 7 file lolos.
* `bun run build` sukses — seluruh route ter-compile, termasuk `[slug]` dan `publish/*`. Ini yang memastikan pemindahan folder tidak meninggalkan import menggantung.
* Catatan: log dev server sempat memuat error `Module not found` dan `useDraftEditor must be used within DraftEditorProvider`. Keduanya artefak HMR saat file dipindah/diedit sebagian, bukan bug — build bersih setelahnya. Kalau tab dev King Rezi masih menampilkan error itu, cukup hard reload.
* Verifikasi visual (klik CTA dari Home/Engage/Analyze → modal terbuka) **belum dilakukan** — butuh login.

## 2026-08-04 — T-010 tuntas: persistensi cookie (T-010.2) + sync Claude Design (T-010.3)

King Rezi memilih menyelesaikan T-010.2 lebih dulu sebelum masuk ke implementasi navbar (T-011/T-012), supaya acuan tema stabil. Sebelumnya tema selalu reset ke Light setiap full reload — disengaja, menunggu subtask ini.

Mekanisme sesuai keputusan 2026-07-31: **Cookie**, bukan localStorage, supaya RSC bisa membaca preferensi sebelum render pertama (menghilangkan flash tema salah), konsisten dengan pola session cookie Better Auth.

### Added

* `apps/web/src/lib/theme/theme-cookie.ts` — konstanta `THEME_COOKIE_NAME` (`theme`), `THEME_COOKIE_MAX_AGE` (1 tahun), `DEFAULT_THEME_MODE` (`light`), tipe `ThemeMode`, dan `parseThemeMode()` yang menjatuhkan nilai tak dikenal ke default.
* `apps/web/src/lib/theme/theme-cookie.test.ts` — 2 test untuk `parseThemeMode` (nilai valid + fallback `undefined`/`null`/`""`/`"Dark"`/`"bogus"`).

### Changed

* `apps/web/src/app/layout.tsx` — jadi `async`, membaca cookie `theme` lewat `cookies()` dari `next/headers` dan meneruskannya sebagai `initialMode` ke `Providers`.
* `apps/web/src/app/providers.tsx` — `Providers` menerima prop `initialMode` (default `light`) sebagai state awal; `toggleMode` menulis cookie `theme` (non-httpOnly, `path=/`, `max-age` 1 tahun, `SameSite=Lax`) lewat `document.cookie`. Komentar lama "default is always light … for the current session" diganti penjelasan sumber `initialMode`.

### Verification

* `bun run typecheck` bersih · `bun run lint` 0 error · `bun run test` 37 test / 7 file lolos.
* Browser (dev server yang sudah berjalan di `localhost:3000`): cookie `theme=dark` → reload → `data-theme="dark"` **ada di HTML respons server**, bukan ditambal client — inilah bukti tidak ada flash. Arah sebaliknya (`theme=light`) dan cookie tak valid (`bogus` → Light) juga terverifikasi. Console bersih, tanpa hydration mismatch.
* Batas verifikasi: toggle-nya sendiri ada di sidebar footer yang butuh login, jadi jalur "klik toggle → cookie tertulis" belum diuji lewat UI — hanya kode dan sisi baca-nya yang terverifikasi. Perlu dicek King Rezi saat login.

### Notes

* Root layout kini dynamic karena memanggil `cookies()`. Dampaknya nihil — seluruh route sudah dynamic lewat session Better Auth.

### T-010.3 — sync toggle ke Claude Design (`components/navigation.html`)

Rencana asli task ini "push file hasil edit dari scratchpad sesi Neymar apa adanya" **dibatalkan setelah verifikasi** — kalau dijalankan, justru akan merusak pekerjaan King Rezi.

Temuan saat membandingkan tiga versi file:

| Versi | Toggle 🌙 | Channels |
| --- | --- | --- |
| Scratchpad A (31 Jul 11:05) | ada | 0 baris |
| Scratchpad B (31 Jul 16:48) | tidak ada | 3 baris |
| **Remote Claude Design** | tidak ada | **5 baris** (+ TikTok, Pinterest) |

Remote ternyata **lebih baru** dari kedua scratchpad — King Rezi mengonfirmasi langsung di sesi ini bahwa perbaikan Channels (termasuk TikTok/Pinterest dan posisi tombol "+") dikerjakan sendiri oleh King Rezi. Push file B apa adanya akan menghapus dua channel itu.

Yang dilakukan sebagai gantinya — perubahan minimal di atas isi remote:

* Menambah **satu baris** tombol toggle di `sidebar-footer`, di antara bel notifikasi dan menu akun, dengan markup identik dengan yang sudah live di `templates/` (`data-proto="theme-toggle"`, `aria-label="Ganti ke Dark Mode"`, `margin-left:auto` pindah ke tombol toggle).
* File dibangun **secara mekanis** lewat script, bukan diketik ulang, supaya nol risiko salah transkripsi path SVG milik King Rezi. Indentasi baris TikTok/Pinterest direproduksi persis seperti remote agar diff benar-benar hanya satu baris.
* Tidak menyertakan script wiring toggle — `components/navigation.html` adalah kartu showcase statis (tombol 🔔 dan akun juga tidak interaktif di sana), berbeda dari `templates/` yang memang prototipe interaktif. Ini mengikuti versi Neymar sendiri untuk file yang sama.
* `styles.css` dan seluruh file lain **tidak disentuh**.

Verifikasi: read-back setelah push mengonfirmasi kelima channel utuh beserta count/status/drag-handle/tombol "+", note tidak berubah, dan toggle berada di posisi yang benar.

Koreksi dalam sesi ini: push pertama tanpa sengaja menggeser indentasi tag `<div class="channels">` dan penutupnya sejauh 4 spasi (whitespace, tanpa efek visual). Terdeteksi saat read-back, langsung diperbaiki dan di-push ulang.

### Notes tambahan

* Klaim dokumen bahwa "file hasil edit sudah lengkap di scratchpad" ternyata menyesatkan — file itu justru tertinggal dari remote. Pelajaran: verifikasi kondisi remote dulu sebelum push, jangan percaya deskripsi task begitu saja.
* T-010 kini **✅ Done** seluruhnya.

---

## 2026-08-04 — ADR-062: Backlog Task Berjenjang per Release

King Rezi minta perencanaan task yang matang dari awal pengerjaan sampai task terakhir, dikelompokkan dan bersubtask, serta rapi dibaca baik oleh AI maupun manusia. Section `Next Tasks` di `PROJECT_STATE.md` sebelumnya flat list ~15 bullet prosa panjang tanpa hierarki, tanpa ID, tanpa dependency, dan sebagian terduplikasi dengan `Known Issues`.

Keputusan diambil lewat 5 pertanyaan terstruktur ke King Rezi: struktur file (folder + indeks), kerangka grup (per release `v0.x`), lokasi status (amandemen aturan #10), granularitas subtask (satu subtask = satu unit kerja), dan kedalaman (rolling wave).

Status faktual tiap task diverifikasi lewat inventarisasi kode `apps/web` — bukan dari `COMPLETE_TASK.md` (tetap tidak dibaca).

### Added

* `project-manager/TASKS.md` — indeks backlog: protokol baca untuk AI, legend status (⏳ 🟡 ✅ 🚫 ⏸️), aturan ID, indeks 7 release, fokus sekarang, daftar keputusan terbuka, aturan maintenance.
* `project-manager/tasks/` — 7 file release: `v01-foundation.md`, `v02-publishing-mvp.md`, `v03-analytics-mvp.md`, `v04-engagement-mvp.md`, `v05-ai-assistant-mvp.md`, `v06-start-page-mvp.md`, `v10-public-launch.md`.
* Total **67 task** (`T-001`–`T-088`, ID global tanpa kode release) dan **127 subtask** terdefinisi untuk v0.1–v0.3. Setiap task membawa field Status, Domain, ADR, Depends, dan **Baca dulu** (daftar bacaan baseline minimal).
* ADR-062 di `project-manager/decisions/ADR-062-backlog-task-berjenjang-per-release-amandemen-aturan-status.md`.

### Changed

* `PROJECT_STATE.md` — section `Next Tasks` (69 baris prosa) diringkas jadi tabel pointer 5 baris + rantai blocker + daftar keputusan terbuka; `Snapshot` dan `In Progress` memakai ID task; `Known Issues` diberi referensi ID task dan detailnya tidak lagi diduplikasi. Version 1.0.35 → 1.0.36.
* `PROJECT_RULES.md` — `TASKS.md` + `tasks/` diklasifikasikan **Living Document** (sebelumnya hanya `PROJECT_STATE.md`); Formatting Rules diberi pengecualian sempit untuk status per-task; guardrail ukuran ditambah aturan `TASKS.md` ≤ ~150 baris dan task `✅ Done` diringkas tanpa checklist.
* `AGENTS.md` — tabel Source of Truth dipisah (status/phase vs backlog task); aturan keras #10 diamandemen dengan pengecualian ADR-062; "Wajib di awal sesi" menambah langkah baca `TASKS.md`; "Setelah mengubah sesuatu" menegaskan update dua tempat (file release + indeks).
* `project-os-navigator/SKILL.md` — cascade Tingkat 2 & 3 memasukkan `TASKS.md`/`tasks/`; behavior "Pekerjaan Baru" menambah langkah update backlog; File Map dan Aturan Context diperbarui. (Catatan: `.claude/skills/project-os-navigator` adalah **symlink direktori** ke `.agents/skills/project-os-navigator` — dilacak git sebagai symlink, jadi sumbernya tunggal dan tidak ada risiko desync.)

### Fixed

* `PROJECT_STATE.md` — inkonsistensi internal: `Known Issues` menyatakan persistensi tema Light/Dark "belum diputuskan", padahal `Next Tasks` di file yang sama sudah mencatat keputusan **Cookie** per 2026-07-31. Diperbaiki jadi "sudah diputuskan, belum diimplementasikan" (T-010.2).
* `PROJECT_STATE.md` — Known Issue stale dihapus: "Belum ada commit awal. Repo sudah `git init`; working tree belum di-commit". Faktanya repo sudah punya 136 commit dan PR #34 ter-merge. Entri `(Opsional) initial git commit` di `Next Tasks` juga hilang bersama restrukturisasi section itu.

### Fixed — hasil code review atas PR #35 (14 temuan, semua diterapkan)

* **`.claude/agents/gibran-project-manager.md`** (Static Reference, diubah atas permintaan eksplisit King Rezi; chmod 444 dipulihkan) — aturan governance-nya masih memuat larangan yang persis dibatalkan ADR-062 ("`PROJECT_STATE.md` SATU-SATUNYA tempat status"), sehingga Gibran akan menulis balik detail task ke `Next Tasks` dan tidak pernah menyentuh `TASKS.md`. Ditambah pengecualian ADR-062, urutan update 4 langkah (tasks → TASKS.md → PROJECT_STATE → COMPLETE_TASK), dan referensi `CHANGELOG.md` yang stale sejak ADR-061 diganti `COMPLETE_TASK.md`.
* **Dependency lintas rilis dibuat eksplisit** — empat task v0.1 (T-012, T-013, T-015, T-016) punya subtask yang bergantung pada task v0.2 (T-025, T-026, T-036), sehingga v0.1 tidak bisa ditutup sebelum v0.2 berjalan. Ditandai di field `Depends` masing-masing task, di Catatan Rilis v0.1, dan sebagai peringatan di `TASKS.md`. Definisi "Foundation selesai" diperbaiki.
* **Duplikasi daftar fokus dihapus** — sebelumnya 3 tempat dengan 2 isi berbeda (Snapshot 4 task, tabel `Next Tasks` 5 task, `TASKS.md` 4 task). Sekarang `TASKS.md` → **Fokus sekarang** jadi satu-satunya daftar (5 task); tabel di `Next Tasks` dihapus, Snapshot hanya menyalin ID.
* **T-019 baru** — task API mobile ADR-043 (`/api/v1` + Better Auth Bearer plugin) dipulihkan sebagai task ber-ID di v0.1; sebelumnya turun jadi catatan prosa tanpa ID di dalam bullet "di luar MVP" v1.0, padahal urgensinya eksplisit "mendahului M8 web berjalan jauh".
* **T-037 baru** — task memperkaya `context/ctx-development.md` dipulihkan sebagai task ber-ID di v0.2; sebelumnya hilang tanpa ID maupun penanda `⏸️ Deferred`.
* **Tanggal diperbaiki 2026-08-03 → 2026-08-04** di ADR-062, baris indeks `DECISIONS.md`, entri `COMPLETE_TASK.md` ini, dan `Last Updated` `PROJECT_STATE.md` — ketiga yang pertama Append-Only, jadi diperbaiki sebelum merge.
* **Peta release ↔ milestone ditambahkan** di `TASKS.md`: M8 = v0.1–v0.6, M9 = v1.0. Sebelumnya tidak ada dokumen yang memetakan keduanya, sehingga aturan "hindari implementasi di luar milestone aktif" tidak bisa dievaluasi untuk task di rilis jauh.
* **Pointer DO-D06 diperbaiki** — T-017 mengarah ke `05-architecture/database-strategy.md` padahal DO-D06 ada di `06-engineering/database-orm.md`.
* **Jalur masuk paralel diperbarui** — `context/ctx-project.md`, `context/README.md`, `project-manager/README.md`, dan `DEVELOPER_WORKFLOW.md` sebelumnya tidak menyebut `TASKS.md`/`tasks/` dan masih menyatakan `PROJECT_STATE.md` sebagai tempat next task.
* **Definition of Done `PROJECT_RULES.md`** ditambah syarat status task + hitungan indeks sudah cocok.
* **`Completed (Ringkasan)` dirotasi kembali ke 5 item** (sebelumnya 6 di bawah header "~5 item terakhir").
* **Detail spesifikasi yang tercecer dipulihkan** — subset `react-icons/fa6` (T-012.3/T-012.4) dan posisi CTA "di bawah Workspace Selector, di atas navigation items" (T-011.1).

Hasil akhir backlog: **69 task · 134 subtask · 11 selesai** (dari 67/127/11).

---

## 2026-08-03 — ADR-061: Konsolidasi CHANGELOG jadi COMPLETE_TASK.md

Susulan dari ADR-060: King Rezi minta `CHANGELOG.md` (root, entri M8+) dan arsip `changelog/CHANGELOG-pre-M8.md` digabung kembali jadi satu file historis tunggal, diberi peringatan keras larangan baca proaktif oleh AI.

### Added

* `project-manager/COMPLETE_TASK.md` — gabungan `CHANGELOG.md` + `changelog/CHANGELOG-pre-M8.md` (3.164 baris), reverse-chronological, dengan banner peringatan keras di kepala file.
* ADR-061 di `project-manager/decisions/ADR-061-konsolidasi-changelog-jadi-complete-task.md`.

### Changed

* Seluruh referensi `CHANGELOG.md`/`changelog/` di `PROJECT_RULES.md`, `README.md`, `.agents/skills/project-os-navigator/SKILL.md`, `AGENTS.md`, `DEVELOPER_WORKFLOW.md`, `PROJECT_STATE.md` diperbarui ke `COMPLETE_TASK.md`.
* `PROJECT_RULES.md` — guardrail rotasi milestone untuk `CHANGELOG.md` dicabut (tidak relevan lagi untuk file yang sengaja tidak dibaca AI secara rutin).

### Removed

* `project-manager/CHANGELOG.md` (root) dan folder `project-manager/changelog/` — digabung ke `COMPLETE_TASK.md`.

### Decisions

* ADR-061 dicatat di `project-manager/decisions/ADR-061-konsolidasi-changelog-jadi-complete-task.md`.

---

## 2026-08-03 — ADR-060: Dokumentasi Efficiency Restructuring

King Rezi resah `PROJECT_STATE.md` terlalu panjang dan khawatir AI membaca seluruh isinya untuk pertanyaan sederhana — audit menemukan `DECISIONS.md` (149 KB, wajib dibaca penuh oleh skill navigator) sebagai kontributor pemborosan token terbesar, plus duplikasi nyata antara "Completed"/"Recent Decisions" di `PROJECT_STATE.md` dengan `CHANGELOG.md`/`DECISIONS.md`.

### Added

* `project-manager/decisions/` — 59 ADR lama (ADR-001–059) dipecah jadi satu file per ADR (`ADR-XXX-slug.md`), diekstrak otomatis via script dengan self-check byte-for-byte (tidak ada teks yang hilang/berubah) — plus `ADR-060-dokumentasi-efficiency-restructuring.md` (ADR ini sendiri).
* `project-manager/changelog/CHANGELOG-pre-M8.md` — arsip 1.391 baris entri CHANGELOG pra-M8 (M0–M7).
* Section **Snapshot** baru di paling atas `PROJECT_STATE.md` (~20 baris: phase/milestone, active mode, top next tasks, top blocker).
* Section **Guardrail Ukuran Dokumen** baru di `PROJECT_RULES.md` — rolling window ≤10 item untuk ringkasan `PROJECT_STATE.md`, rotasi `CHANGELOG.md` maksimal milestone aktif + 1 sebelumnya, dicek tiap Definition of Done milestone.

### Changed

* `DECISIONS.md`: 3.564 → 69 baris — isi sekarang indeks ringkas (tabel ADR#/Title/Status/Date/Ringkasan/link file, terbaru-di-atas), full text ADR pindah ke `decisions/`.
* `PROJECT_STATE.md`: 928 → ~260 baris — heading dirapikan jadi `##` konsisten, section "Completed"/"Recent Decisions" dipangkas ke 5 item terakhir + pointer ke `CHANGELOG.md`/`DECISIONS.md` (isi lengkap tidak hilang).
* `CHANGELOG.md`: 3.135 → 1.746 baris (root) — entri pra-M8 pindah ke arsip, root kini fokus ke milestone aktif.
* `.agents/skills/project-os-navigator/SKILL.md` — "Langkah Pertama: Load Context" diubah dari wajib-baca-4-file-penuh jadi cascade 3 tingkat (fakta cepat → snapshot status → baca penuh khusus task nyata); instruksi pembuatan ADR baru di mode "Planning Change" diperbarui ke konvensi per-file.
* `PROJECT_RULES.md` — Document Type Classification: `decisions/ADR-*.md` dan `changelog/CHANGELOG-*.md` ditambahkan sebagai Append-Only.
* `project-manager/README.md` — folder structure & Core Documents table disesuaikan dengan struktur baru.

### Decisions

* ADR-060 dicatat di `project-manager/decisions/ADR-060-dokumentasi-efficiency-restructuring.md`.

---

## 2026-08-03 — ADR-059: Fake OutstandAdapter — persistensi nyata "Schedule" tanpa kredensial Outstand asli

King Rezi belum punya `OUTSTAND_API_KEY`/`OUTSTAND_WEBHOOK_SECRET` asli dari
Outstand, sehingga integrasi publishing sungguhan (ADR-040) tertahan. Next
Tasks direorder: Fake/mock `OutstandAdapter` dibangun dulu supaya fitur
"Schedule" di Draft Editor bisa lanjut dikerjakan dan diuji tanpa menunggu
kredensial asli. Alur: Elon Backend Engineer → Prabowo Feature Engineer →
Najwa QA Engineer → Ridwan Architecture Reviewer, plus 1 siklus fix bug —
semua lolos verifikasi.

### Added

* `DECISIONS.md` — **ADR-059**: scope hanya method Publishing (`schedulePost`,
  Engagement/Analytics/`connectAccount` OAuth di luar scope, YAGNI);
  fidelitas instant always-success (tanpa simulasi delay/webhook/skenario
  gagal); switch mechanism auto-detect dari env (`getOutstandAdapter()`
  memakai Fake kalau `OUTSTAND_API_KEY` kosong, throw error jelas — bukan
  silent fallback — kalau env terisi tapi real adapter belum ada kodenya);
  `IOutstandAdapter` didefinisikan di domain `publishing` dulu (satu-satunya
  pemakai saat ini); precedent arsitektur baru — `SchedulePostsUseCase`
  terpisah dari `PublishingService` untuk operasi yang butuh dependency
  tambahan (`IOutstandAdapter`) di luar `IPublishingRepository`, supaya
  constructor tetap type-safe; guard ownership `connectedAccountId` vs
  `workspaceId` ditegakkan di level repository (transaksi Prisma), bukan
  cuma Server Action.
* `IOutstandAdapter` / `FakeOutstandAdapter` / `getOutstandAdapter()` factory
  (`domains/publishing/adapters/`, `lib/adapters/outstand/`).
* `SchedulePostsUseCase`
  (`domains/publishing/services/schedule-posts.use-case.ts`) — validasi
  format ADR-039 server-side (`content-format-matrix.ts`, sebelumnya cuma
  ada di client), persist post+target (status transition draft/
  ready_to_schedule → scheduled), panggil adapter per target dengan outcome
  per-target (try/catch individual, tidak all-or-nothing).
* Guard ownership + guard status atomik baru di
  `IPublishingRepository.schedulePost` (transaksi Prisma, rollback total
  bila salah satu guard gagal).
* `WorkspaceService.listConnectedAccounts` — query real
  `WorkspaceConnectedAccount`, dipakai Draft Editor Account Selector
  (menggantikan `MOCK_ACCOUNTS` hardcoded) — sekaligus partial-progress
  prasyarat Sidebar "Channels" (ADR-058).
* Seed script manual `apps/web/prisma/seed-connected-accounts.ts` — 2 akun
  mock (Instagram/Facebook) untuk dev/QA tanpa OAuth asli.

### Changed

* `OUTSTAND_API_KEY`/`OUTSTAND_WEBHOOK_SECRET` di `env.ts` diubah dari
  required jadi optional.
* Draft Editor "Schedule" button kini benar-benar persist ke database
  (bukan mock notice client-side lagi) — diverifikasi end-to-end sampai row
  `publishing_posts`/`publishing_post_targets` di Supabase (`outstandJobId`
  format `fake-<uuid>`).

### Fixed

* Dialog "Konfirmasi Jadwal" di `modal.tsx` sempat tidak bisa terbuka — root
  cause: Astryx melarang nested Dialog (dialog konfirmasi bersarang di
  dalam Dialog fullscreen New Post/Edit Draft). Diperbaiki jadi satu Dialog
  dengan step konfirmasi inline (state `isConfirmStep`).

### Notes

* Diverifikasi: `bun run typecheck/lint/test` hijau di setiap tahap (31 test
  lolos), browser E2E via ngrok (akun test Raka Pratama, workspace
  "insvire"), review arsitektur Ridwan (2 temuan awal — IDOR + type-safety
  constructor — sudah ditutup dan di-re-check, tidak ada temuan baru).
* Tidak termasuk scope ini, tetap di Next Tasks: `publishNow`/
  `cancelSchedule` (ADR-047/ADR-049), `PublishingQueueSlot`, Engagement/
  Analytics di `IOutstandAdapter`, media upload trio, dan implementasi UI
  Sidebar "Channels" (ADR-058) — prasyarat `listConnectedAccounts`-nya saja
  yang terpenuhi lewat entri ini.
* `PROJECT_STATE.md` diperbarui: entri baru di Completed, baris "Publishing
  MVP — sisa persistensi nyata: sambungkan Schedule..." dihapus dari In
  Progress dan Next Tasks (sudah selesai), catatan prasyarat
  `listConnectedAccounts` di baris Sidebar Channels (ADR-058) diperbarui.

---

## 2026-07-31 — Claude Design: fix Content Format Selector hilang di New Post + tambah akun mock TikTok & Pinterest (catch-up ADR-037/ADR-039)

Dikerjakan langsung dari sesi utama (bukan subagent Neymar) karena
keterbatasan teknis `DesignSync` tidak bisa dimuat di sesi subagent. Dua
perubahan terpisah, keduanya murni di project Claude Design ("Social Media
Management"), **bukan** di kode `apps/web`. Tidak ada ADR baru — TikTok &
Pinterest sudah lebih dulu resmi jadi bagian baseline produk lewat ADR-037
(daftar 8 platform resmi) dan ADR-039 (matriks Content Format per platform,
termasuk aturan TikTok Post-only dan Pinterest pin+metadata); pekerjaan ini
murni menyusulkan (catch-up) visual Claude Design mengikuti keputusan yang
sudah ada di kedua ADR tersebut.

### Fixed

* `templates/app-prototype/AppPrototype.dc.html` (`buildDraftEditorMarkup`)
  — cabang "New Post" (create) ternyata tidak menampilkan `.fmt-row` (radio
  Post/Reel/Story) untuk akun Instagram & Facebook, padahal cabang "Edit
  Draft" sudah benar dan dokumentasi internal `templates/draft-editor.html`
  sendiri menyatakan New Post seharusnya identik dengan Edit Draft (cuma
  kosong). New Post sekarang juga punya `.fmt-row`, default radio "Post"
  terpilih untuk Instagram & Facebook (bukan "Reel" seperti contoh Edit
  Draft, karena New Post tidak merepresentasikan draft yang sudah ada).
  State Edit Draft tidak diubah sama sekali.

### Added

* Akun mock TikTok & Pinterest (status Active/Connected) ditambahkan atas
  permintaan eksplisit King Rezi ("tambahkan juga tiktok dan pinterest pada
  Design System agar lebih banyak", scope dikonfirmasi "semua tempat" lewat
  `AskUserQuestion`):
  * Sidebar "Channels" — 7 file screen template: `templates/home.html`,
    `templates/publish-calendar.html`, `templates/publish-queue.html`,
    `templates/publish-drafts.html`, `templates/engage-inbox.html`,
    `templates/analyze-dashboard.html`,
    `templates/settings-connected-accounts.html`. `templates/
    draft-editor.html` sengaja tidak disentuh untuk bagian ini — tidak
    punya sidebar sendiri (hanya dialog Draft Editor).
  * `templates/settings-connected-accounts.html` — 2 baris baru di card
    utama Connected Accounts.
  * Draft Editor "Akun Tujuan" (`templates/draft-editor.html` dan
    `templates/app-prototype/AppPrototype.dc.html`, kedua state New Post &
    Edit Draft): TikTok = checkbox saja tanpa format selector (ADR-039,
    TikTok Post-only, tanpa selector Reel/Story); Pinterest = checkbox + 3
    field baru (Title/Destination link/Board) menggantikan format
    selector, sesuai ADR-039 poin 2 (Pinterest = pin + metadata).
  * `styles.css` — class baru `.pin-fields` untuk styling field Pinterest,
    konsisten dengan pola `.fmt-row` yang sudah ada. Tidak ada token/warna
    baru di luar itu.
  * Detail mock: warna TikTok `#0d1013` (reuse dari mock Home/Calendar/
    Queue sebelumnya), warna Pinterest `#e60023` (brand red resmi). Ikon
    SVG dari paket resmi Font Awesome Free (fa-tiktok, fa-pinterest).

### Notes

* Sengaja di luar scope, tidak diubah: dialog konfirmasi Schedule/Publish
  Now di `AppPrototype.dc.html` (`openScheduleDialog`/
  `openPublishNowDialog`) masih hardcode hanya menampilkan ringkasan
  Instagram & Facebook — tidak diperluas untuk TikTok/Pinterest karena
  keduanya default unchecked (tidak pernah masuk ke dialog itu), konsisten
  dengan behavior sebelumnya.
* Implementasi kode `apps/web` untuk Channels TikTok/Pinterest tetap
  mengikuti scope Next Tasks ADR-058 yang sudah ada (belum berjalan) —
  entri ini tidak menambah task kode baru, murni menyusulkan mock Claude
  Design.

---

## 2026-07-31 — ADR-058 addendum: restyle avatar Channels + override no-shift → shift-on-hover

Sesi kedua di tanggal yang sama, melanjutkan pekerjaan Claude Design ADR-058
sebelumnya. King Rezi menunjukkan screenshot aplikasi lain sebagai referensi
dan meminta dua perubahan visual/interaksi, plus satu catatan terbuka soal
micro-offset tombol "+" yang belum final.

### Added

* `DECISIONS.md` — **ADR-058, addendum poin 10** (bukan ADR baru terpisah,
  masih amandemen keputusan yang sama hari itu). Mendokumentasikan:
  - Restyle leading element baris default Channels: logo platform polos
    (flat square icon) → avatar bulat (placeholder inisial, treatment
    sama seperti `.ws-avatar`) dengan badge kecil logo brand platform
    (react-icons/fa6, warna brand tidak berubah) di-overlay di pojok
    kanan-bawah avatar (konvensi story-ring badge). Badge count
    scheduled-posts di kanan baris tidak berubah.
  - **Override eksplisit poin 5 ("no-shift hover") → "shift-on-hover"**
    untuk drag-handle: drag-handle kini muncul di paling kiri baris (di
    luar avatar, bukan lagi di ruang cadangan permanen), dan saat hover
    seluruh isi baris (avatar+badge+nama) ikut bergeser ke kanan
    (`margin-left` animasi). Alasan: permintaan eksplisit King Rezi
    setelah melihat referensi screenshot aplikasi lain — bukan lagi
    dianggap masalah interaksi seperti alasan poin 5 sebelumnya. Swap
    count↔tombol quick-compose "+" di sisi kanan baris **tidak berubah**
    — tetap no-shift/fixed-slot.
  - Catatan micro-adjustment tombol "+" (`.channel-add`, `top: 1px; left:
    -1px` menimpa `inset: 0` untuk sisi itu) masih dikonfirmasi King Rezi
    sebagai "kurang pas", tapi sengaja tidak diiterasi lagi di Claude
    Design sekarang — akan disesuaikan sendiri saat implementasi kode
    `apps/web`. Dicatat sebagai known imperfection, bukan final.
* `navigation-patterns.md` — section "Channels (Sidebar)" (diagram + isi
  baris + state hover) dan baris NP-D14 di Decision Log diperbarui: bahasa
  "no-shift" untuk drag-handle diganti "shift-on-hover" (dengan penjelasan
  override), sementara swap count↔"+" tetap ditandai no-shift/fixed-slot.
  Isi baris juga diperbarui menyebut avatar+badge overlay, bukan lagi
  logo platform polos.
* `PROJECT_STATE.md` — bullet Completed ADR-058 dan Recent Decisions
  diperbarui untuk mencerminkan restyle avatar + override shift-on-hover;
  Next Tasks (implementasi kode `apps/web` untuk Channels) ditambahkan
  catatan terbuka bahwa posisi pixel tombol "+" belum final — jangan
  disalin sebagai source of truth pasti saat coding nanti.

### Implementasi

* Masih visual-only di Claude Design (7 layar KSP bersidebar +
  `components/navigation.html` + App Prototype yang iframe ke template
  yang sama). **Implementasi kode `apps/web` untuk Channels tetap belum
  berjalan** — menyusul di siklus implementasi berikutnya.

---

## 2026-07-31 — ADR-058: Sidebar "Channels" — quick-glance daftar akun terhubung

King Rezi meminta section baru di sidebar untuk melihat status akun media
sosial terhubung sekilas + jalan pintas compose per akun. Dikerjakan
visual-first di Claude Design (bukan langsung ke kode), lewat beberapa
putaran revisi (icon vs teks nama, sumber ikon Lucide vs react-icons,
no-shift hover) sebelum bentuk finalnya dikunci ke baseline.

### Added

* `DECISIONS.md` — **ADR-058**. Section "Channels" ditambahkan di sidebar,
  posisi antara 5 navigation item dan zona bawah (Notifications/Theme/
  Avatar), scrollable independen. Tiap baris: logo brand platform +
  nama akun/handle + status badge (reuse Badge KSP-08). Default: badge
  scheduled-posts count. Hover: drag handle (reorder personal per user) +
  tombol quick-compose "+" (buka Draft Editor, akun pre-selected) — ruang
  keduanya dicadangkan permanen supaya tidak menggeser konten saat hover.
  Icon brand pakai `react-icons` (fa6 set), dipilih setelah dikonfirmasi
  `lucide-react` tidak menyediakan logo media sosial.
* `navigation-patterns.md` — NP-D14 di Decision Log; section baru
  "Channels (Sidebar)"; pola baru "Quick Compose dari Channels Sidebar";
  update diagram sidebar (overview + detail); perluasan pola "Status
  Indicator → Settings" untuk mencakup klik channel bermasalah; 2 baris
  baru di tabel Ringkasan Pola.
* `key-screen-patterns.md` — Entry Points KSP-05 (Quick Compose dari
  Channels) dan KSP-08 (klik channel bermasalah di sidebar) diperluas;
  catatan di KSP-08 menegaskan Channels sidebar bukan pengganti layar
  Connected Accounts.

### Implementasi

* Claude Design: 7 layar KSP (semua yang punya sidebar) + swatch komponen
  `components/navigation.html` sudah menampilkan Channels sesuai desain
  final. **Implementasi kode `apps/web` belum berjalan** — menyusul di
  siklus implementasi berikutnya (lihat PROJECT_STATE Next Tasks).
* **Addendum (revisi lanjutan hari sama, ADR-058 poin 9):** status badge
  (Active/Disconnected) diperbaiki dari full-width (bertabrakan visual
  dengan tombol "+" saat hover) menjadi hug-content (`align-self:
  flex-start`). Tombol "+" quick-compose diberi wiring nyata di
  `AppPrototype.dc.html` — klik membuka Draft Editor dengan akun channel
  tersebut otomatis ter-checklist, sengaja skip pengecekan Resume
  Unfinished Post karena entry point ini terikat akun tertentu. Ditemukan
  lagi: hover tombol "+" (`.icon-btn:hover`) menumpuk overlay kedua di atas
  overlay hover baris (`.channel-row:hover`) — diperbaiki dengan
  `.channel-add:hover { background-image: none; }` supaya cuma ada satu
  highlight bersih per baris. Masih terlihat "menabrak" di screenshot
  review berikutnya — diperkecil lagi ke 16×16px (lebih kecil dari size
  token IconButton terkecil Astryx), glyph diganti dari "＋" fullwidth ke
  "+" biasa pada 10px, sesuai permintaan eksplisit King Rezi.
* Follow-up belum diputuskan: skema tabel reorder personal per user (baru,
  terpisah dari `WorkspaceConnectedAccount`), query scheduled-posts count
  lintas domain, dan status `react-icons` sebagai dependency runtime kalau
  fitur ini lanjut ke kode (saat ini baru dipakai sebagai sumber ekstraksi
  SVG statis di Claude Design, bukan dependency `apps/web`).

---

## 2026-07-31 — ADR-057: Tidak ada designer eksternal, permanen (amandemen ADR-038, ADR-041)

Kelanjutan diskusi ADR-056 (sync docs ↔ Claude Design): King Rezi
mengonfirmasi project ini tidak akan pernah merekrut/menunggu designer
eksternal — peran "desainer" digantikan permanen oleh King Rezi sendiri
lewat project Claude Design.

### Added

* `DECISIONS.md` — **ADR-057**. Menghapus gerbang "designer masuk" sebagai
  syarat lock token (amandemen ADR-038 DT-D02, ADR-041 poin 2 & 7). Status
  field ADR-038 dan ADR-041 ditandai "Amended by ADR-057".

### Changed

Menghapus/menyesuaikan bahasa "designer masuk"/"designer aktif"/"designer
join" yang masih berupa kalimat aktif (bukan catatan historis) di 7 file:

* `product-discovery/06-engineering/design-tokens.md` — header, metadata,
  panduan lock, DT-D02/DT-D03, diagram mapping implementasi, Related Documents.
* `product-discovery/06-engineering/README.md` — 2 spot (Design Tokens summary).
* `product-discovery/README.md` — catatan folder `design/`.
* `context/ctx-design.md` — catatan ADR-045, aturan operasional token.
* `context/ctx-technical-context.md` — tabel "Baca dulu", aturan operasional #8.
* `context/ctx-implementation.md` — section UI Components.
* `project-manager/PROJECT_STATE.md` — In Progress, Next Tasks, Recent Decisions.

### Catatan governance

* Entri historis di `DECISIONS.md` (teks ADR-038/041 asli), `CHANGELOG.md`
  entri lama, dan `CONVERSATIONS.md` **tidak diedit** — append-only,
  mencerminkan keputusan yang berlaku saat itu. Hanya `Status` field ADR-038/
  ADR-041 yang ditambah anotasi "Amended by ADR-057".

---

## 2026-07-31 — Diskusi lanjutan hasil audit: 3 keputusan terbuka diputuskan (ADR-056 + 2 next task)

Melanjutkan diskusi dari audit dokumentasi sebelumnya (entri di bawah), 3 poin
"belum diputuskan" dibahas dan diputuskan bersama King Rezi.

### Added

* `DECISIONS.md` — **ADR-056**: sinkronisasi UI/UX docs ↔ Claude Design.
  Token visual jadi **co-equal** antara `design-tokens.md` dan Design System
  Claude Design (amandemen ADR-038 poin 1 & 2). AI **wajib reminder
  proaktif** setiap ada perubahan UI/UX di salah satu sisi (docs atau Claude
  Design) — berlaku untuk token maupun flow/fungsi layar, meski untuk
  flow/fungsi layar `04-ux/` tetap SoT (ADR-042 tidak berubah di sini).
  Dipicu King Rezi mengaku sering lupa sync manual antara dua sisi.

### Changed

* `context/ctx-design.md` — aturan operasional #9a baru: kewajiban reminder
  proaktif ADR-056, plus pointer di Related context.
* `.claude/agents/neymar-product-designer.md` — section baru "Wajib
  reminder proaktif (ADR-056)" (unlock `644` → edit → lock `444` lagi,
  sesuai prosedur resmi di `.claude/agents/README.md`).
* `project-manager/PROJECT_STATE.md`:
  * Recent Decisions — ADR-056 ditambahkan.
  * Next Tasks — persistensi tema Light/Dark (ADR-055) **sudah diputuskan**:
    pakai **Cookie** (bukan localStorage), belum diimplementasikan.
  * Next Tasks — Remove Member/Transfer Ownership/Delete Workspace:
    pendekatan desain **sudah diputuskan** — desain minimal "Danger Zone"
    dulu (bukan Members management penuh), sesi desain belum dimulai.
  * Next Tasks — catatan design-tokens.md diperbarui mengikuti model
    co-equal ADR-056 (bukan lagi "isi sekali setelah desain di-approve").

---

## 2026-07-31 — Audit konsistensi dokumentasi menyeluruh (2 temuan diperbaiki)

Dipicu permintaan King Rezi untuk cek dokumentasi menyeluruh. Ditemukan 2
inkonsistensi nyata, keduanya sudah diperbaiki di sesi yang sama.

### Fixed

* **`context/ctx-design.md`, `context/ctx-implementation.md`,
  `context/ctx-technical-context.md`** — ketiganya masih menginstruksikan
  "gunakan neutral theme Astryx selama M8" tanpa qualifier, padahal ADR-055
  (2026-07-31) sudah mengangkat Light/Dark Mode Toggle jadi fitur resmi dan
  meng-override baseline itu. Ketiga file diberi catatan bahwa toggle tetap
  berjalan di atas neutral theme (expose mekanisme dark mode bawaan Astryx,
  bukan tema/token baru) — bukan pelanggaran, tapi perlu disebutkan supaya
  agent berikutnya tidak salah kira dark mode belum ada.
* **`.claude/agents/*.md`** (7 file peran subagent) — `AGENTS.md` dan
  `.claude/agents/README.md` mengklaim file-file ini `chmod 444` (read-only)
  sebagai pengaman teknis, tapi kenyataannya `644` (kemungkinan step chmod
  444 terlewat setelah edit terakhir `najwa-qa-engineer.md`). Dikembalikan ke
  `444`; `.claude/agents/README.md` sendiri sengaja tetap `644` sesuai
  pengecualian di `PROJECT_RULES.md`.

### Verified (tidak ada masalah, dicatat sebagai bukti audit)

* Penomoran ADR-001 s/d ADR-055 di `DECISIONS.md` berurutan tanpa gap/duplikat.
* Klaim status implementasi kode di `PROJECT_STATE.md` (ADR-052 modal, ADR-053/
  054 belum di kode, ADR-055 sudah di kode) cocok dengan kode nyata di
  `apps/web/src`.
* Versi Astryx `0.1.8` konsisten di `apps/web/package.json`,
  `apps/web/.claude/CLAUDE.md`, dan `PROJECT_OVERVIEW.md`.
* Tidak ada README yang memuat status/progress — Document Type Classification
  di `PROJECT_RULES.md` dipatuhi.

---

## 2026-07-31 — ADR-055: Light/Dark Mode Toggle diangkat jadi fitur resmi produk

King Rezi meminta button switch light/dark; sebelum implementasi dimulai,
diklarifikasikan dulu (via `AskUserQuestion`) apakah ini alat banding
internal atau fitur resmi produk — King Rezi memilih **fitur resmi
produk**, mengoverride baseline "neutral theme selama M8" (ADR-041). Alur
kerja: Neymar (Claude Design) → Mark UI Engineer (kode `apps/web`) → Najwa
QA (verifikasi browser) → Ridwan (review arsitektur) — semua selesai dan
lolos.

### Added

* `DECISIONS.md` — ADR-055 baru: Toggle Light/Dark Mode sebagai kontrol
  persisten di sidebar footer, berlaku lintas seluruh section; default
  Light saat load pertama; sengaja tidak dipersist lintas full reload.
  Alasan tidak melanggar ADR-041: token dark mode sudah native di Astryx
  (`@astryxdesign/theme-neutral@0.1.8`), bukan implementasi custom.
* Claude Design (project "Social Media Management") — toggle ditambahkan
  di 7 layar KSP (Home, Publish Calendar/Queue/Drafts, Engage Inbox,
  Analyze Dashboard, Settings Connected Accounts) + App Prototype.
  `draft-editor.html` (KSP-05) dikecualikan — tidak ada sidebar (modal
  fullscreen, ADR-052).
* `apps/web/src/app/providers.tsx` — `ThemeModeContext`/`useThemeMode`.
* `apps/web/src/app/[slug]/workspace-side-nav.tsx` — `IconButton` toggle di
  sidebar footer, berdampingan user account dropdown.

### Verification

* Typecheck/lint/test (26 test) hijau.
* QA end-to-end via browser (tunnel ngrok): golden path toggle lolos,
  konsistensi tema lintas navigasi SPA, reset ke Light saat full reload
  dikonfirmasi working as intended (bukan bug), tidak ada regresi sidebar.
* Review arsitektur (Ridwan): lolos tanpa temuan — client component murni,
  tidak ada import domain/Prisma/Supabase/Outstand, pola context konsisten
  dengan `DraftEditorContext` yang sudah ada.

### Belum selesai (dicatat, bukan ditutup)

* `components/navigation.html` (dokumen referensi AppShell+SideNav di
  Claude Design) belum ter-push — terblokir karena tool `DesignSync`
  sempat nonaktif di sesi kerja desain. File hasil edit sudah disiapkan
  lengkap di scratchpad, tinggal di-push saat `DesignSync` aktif kembali.
* Persistensi tema lintas reload (localStorage/cookie) belum diputuskan —
  sengaja ditunda.

---

## 2026-07-31 — ADR-053 & ADR-054: Sidebar CTA "+ New Post" + redirect Draft Editor ke sub-screen tujuan

### Added

* `DECISIONS.md` — ADR-053 (Sidebar mendapat CTA "+ New Post" pinned di
  bawah Workspace Selector, tersedia dari section manapun, melengkapi
  CTA NP-D09 yang sudah ada di Calendar/Queue/Drafts) dan ADR-054 (Draft
  Editor redirect otomatis ke sub-screen tujuan setelah aksi terminal:
  Save as Draft → Drafts, Schedule → Queue, Publish Now → History/
  sementara Calendar).
* `product-discovery/04-ux/navigation-patterns.md` — zona CTA baru di
  diagram sidebar, NP-D12 (CTA "+ New Post" pinned) dan NP-D13 (Pola
  Redirect setelah Aksi Terminal Draft Editor) baru di Decision Log +
  tabel Ringkasan Pola.
* `product-discovery/04-ux/key-screen-patterns.md` — KSP-D15 baru di
  Decision Log; KSP-05-F08/F09/F12 diberi catatan tujuan redirect.
* Claude Design (project "Social Media Management") — CTA "+ New Post"
  ditambahkan di 7 layar shell (`home.html`, `publish-calendar.html`,
  `publish-queue.html`, `publish-drafts.html`, `engage-inbox.html`,
  `analyze-dashboard.html`, `settings-connected-accounts.html`) +
  `components/navigation.html` + class baru `.sidebar-cta` di
  `styles.css`. `AppPrototype.dc.html` — `saveDraftFromEditor()` kini
  redirect ke `publish-drafts`, handler `publishnow-confirm` diubah
  destinasi dari `'home'` ke `'publish-calendar'`.

### Notes

* Implementasi kode `apps/web` untuk kedua perubahan ini **belum
  berjalan** — menyusul di siklus implementasi berikutnya (lihat Next
  Tasks di `PROJECT_STATE.md`).
* Handler Schedule (`dialog-confirm` → `publish-queue`) di App Prototype
  tidak berubah — perilaku ini sudah ada sejak file dibuat, ADR-054 baru
  memformalkannya sebagai keputusan resmi.

---

## 2026-07-30 — QA: aturan URL testing (ngrok) + akun test terdokumentasi

Permintaan eksplisit user: Najwa QA Engineer sering butuh verifikasi browser,
tapi project ini tidak bisa testing lewat `localhost` (Better Auth tidak bisa
membaca session/cookie di setup ini), sehingga dipakai tunnel ngrok yang
efemeran (URL berubah tiap sesi).

### Added

* `project-manager/QA_TEST_ACCOUNTS.md` — dokumen baru: alasan testing browser
  pakai ngrok bukan `localhost`, catatan bahwa URL ngrok efemeran (harus
  dikonfirmasi ulang tiap sesi, tidak boleh reuse dari dokumentasi manapun),
  1 akun test yang sudah ada di database (Raka Pratama, Owner —
  `raka.test@kopiselasar.com`), dan catatan penundaan akun Manager/Creator
  sampai fitur invite member (`apps/web/src/app/[slug]/settings/members/
  page.tsx`, masih scaffold placeholder) selesai diimplementasikan.

### Changed

* `.claude/agents/najwa-qa-engineer.md` — 2 aturan baru: (1) step 0 di
  "Langkah kerja" — wajib tanya ke user URL testing aktif sebelum verifikasi
  browser (bukan `localhost`), dengan alasan singkat (Better Auth + ngrok
  efemeran); (2) pointer baru di "Referensi" ke
  `project-manager/QA_TEST_ACCOUNTS.md` untuk kredensial akun test.

---

## 2026-07-30 — ADR-052 Tahap 3: implementasi kode Draft Editor sebagai modal

### Added

* `apps/web/src/app/[slug]/publish/_draft-editor/` — `context.tsx`
  (`DraftEditorProvider`/`useDraftEditor`, state New Post/Edit Draft/Resume
  Unfinished Post), `modal.tsx` (`Dialog variant="fullscreen"` + `Layout`,
  pola `DialogFullscreenDialog` Astryx), `actions.ts` (`saveDraftAction`,
  `updateDraftAction`, `getDraftAction`), `status-badge.ts` (mapping
  `ContentStatus` → label/`Badge` variant sesuai `components/status-chips.html`
  Claude Design).
* `apps/web/src/app/[slug]/publish/drafts/drafts-list.tsx` — Drafts List
  data asli (`List`/`ListItem` di dalam `Card`), tiap row klik membuka
  Edit Draft.
* `apps/web/src/lib/utils/format-relative-time.ts` — format waktu relatif
  Bahasa Indonesia ("2 jam lalu", "kemarin", dst).
* Domain `publishing`: `PublishingService.listDrafts`/`getDraftById`/
  `updateDraft` + `IPublishingRepository.listDrafts`/`findDraftById`/
  `updateDraftCaption` (+ `updatedAt` di `PublishingPostRecord`), unit test
  baru untuk ketiganya.

### Changed

* `apps/web/src/app/[slug]/publish/layout.tsx` — dibungkus
  `DraftEditorProvider` + render `DraftEditorModal`, supaya modal tampil di
  atas Calendar/Queue/Drafts manapun tanpa navigasi URL (NP-D11).
* `apps/web/src/app/[slug]/publish/drafts/page.tsx` — jadi async Server
  Component yang fetch draft asli via `PublishingService.listDrafts`,
  menggantikan `EmptyState` statis.
* `apps/web/src/lib/repositories/publishing/publishing.repository.ts` —
  implementasi Prisma untuk 3 method baru + helper `mapPost`.

### Removed

* Route lama Draft Editor (digantikan modal, ADR-052): `publish/drafts/new/`,
  `publish/drafts/[postId]/`, `publish/calendar/[postId]/`,
  `publish/queue/[postId]/`. **Tidak** menyentuh `publish/history/[postId]/`
  (di luar scope ADR-052).

### Notes

* Sengaja tidak mengikuti mockup Claude Design 100%: tombol "Publish Now" di
  footer modal tidak ikut diimplementasikan (ADR-047 — task terpisah, belum
  disetujui untuk dikerjakan sesi ini); footer tetap 2 tombol (Save as
  Draft, Schedule). Toggle Fullscreen/Standard di Claude Design juga sengaja
  tidak ikut ke kode (alat banding internal, bukan keputusan final).
* Diverifikasi end-to-end via browser (tunnel ngrok, akun test Raka
  Pratama): New Post → Save as Draft → close → muncul di list → Edit Draft
  dari list (data server) → update in-place (tidak duplikat) → Resume
  Unfinished Post dialog. `bun run typecheck`/`lint`/`test` hijau.
* Bug ditemukan & diperbaiki saat verifikasi: Drafts List tidak refresh
  otomatis setelah modal ditutup (Server Component tidak tahu ada
  perubahan) — ditambahkan `router.refresh()` setelah Save as Draft
  berhasil.

---

## 2026-07-30 — Skill "work-report-simple": tambah byline "Dikerjakan oleh"

Permintaan eksplisit user: setiap laporan kerja harus menyebutkan siapa
(persona/subagent) yang mengerjakannya.

### Changed

* `.agents/skills/work-report-simple/SKILL.md` (sinkron otomatis dengan
  `.claude/skills/work-report-simple/SKILL.md`) — section baru "1. Dikerjakan
  oleh" (wajib, baris paling atas laporan): nama subagent kalau dikerjakan
  lewat subagent bernama di `.claude/agents/`, atau "AI utama" kalau tanpa
  delegasi. Section lain digeser jadi 2–5. Aturan gaya bahasa + kedua contoh
  output diperbarui mengikuti format baru.
* `.claude/agents/ridwan-architecture-reviewer.md` dan
  `.claude/agents/najwa-qa-engineer.md` — section baru "Cara melapor",
  referensi eksplisit ke `work-report-simple` (sebelumnya cuma
  `gibran-project-manager.md` yang punya pointer ini). Chmod dibuka (644)
  untuk edit, dikunci kembali (444).

---

## 2026-07-30 — Aturan sebutan user: "King Rezi"

Permintaan eksplisit user (membuka kembali file peran subagent yang
sebelumnya di-chmod read-only, sesuai prosedur di `.claude/agents/README.md`).

### Changed

* `AGENTS.md` — aturan keras #14 baru: panggil user "King Rezi" di seluruh
  komunikasi/output teks, berlaku untuk AI utama dan seluruh subagent.
* Ketujuh file `.claude/agents/*.md` — section baru "Sebutan user" di tiap
  file, chmod dibuka (644) untuk edit lalu dikunci kembali (444).

---

## 2026-07-30 — 7 subagent kerja ditambahkan (`.claude/agents/`)

Dibuat atas permintaan user untuk memungkinkan delegasi kerja ke beberapa
subagent Claude Code secara paralel, dengan nama custom per peran.

### Added

* `.claude/agents/prabowo-feature-engineer.md` — implementasi fitur produk
  (entry → service → domain → repo), tidak terikat milestone tertentu.
* `.claude/agents/mark-ui-engineer.md` — UI/komponen Astryx di `apps/web`.
* `.claude/agents/neymar-product-designer.md` — kerja di Claude Design
  (`DesignSync`), wajib baca skill `claude-design-scope-discipline`.
* `.claude/agents/elon-backend-engineer.md` — integrasi Outstand (ACL),
  webhook, background jobs, schema Prisma.
* `.claude/agents/ridwan-architecture-reviewer.md` — review kepatuhan
  boundary DDD, read-only (tools dibatasi, tanpa Edit/Write).
* `.claude/agents/najwa-qa-engineer.md` — QA (Vitest + verifikasi browser
  end-to-end).
* `.claude/agents/gibran-project-manager.md` — update
  `PROJECT_STATE.md`/`DECISIONS.md`/`CHANGELOG.md`, selalu dipanggil
  terakhir dan sekuensial (bukan paralel) untuk mencegah konflik status.
* `.claude/agents/README.md` — panduan pemakaian + aturan orkestrasi
  paralel/sekuensial antar subagent.

### Changed

* `PROJECT_RULES.md` — `.claude/agents/*.md` (kecuali `README.md`-nya)
  ditambahkan ke klasifikasi Static Reference; perubahan hanya atas
  permintaan eksplisit user.
* `AGENTS.md` — section baru "Subagent kerja (`.claude/agents/`)", pointer
  ke `.claude/agents/README.md`.

### Governance

* Ketujuh file peran di-chmod read-only (444) sebagai pengaman teknis
  supaya tidak berubah tanpa sengaja saat sesi kerja berjalan.

---

## 2026-07-30 — ADR-052: skill "Claude Design — Scope Discipline" ditambahkan (governance)

Retrospektif atas insiden default toggle Fullscreen/Standard yang diam-diam
berubah (lihat addendum ADR-052 sebelumnya) menghasilkan aturan pencegahan
permanen supaya kelas kesalahan yang sama (AI mengubah state/default yang
sudah disetujui sebagai efek samping fitur baru) tidak terulang.

### Added

* `.claude/skills/claude-design-scope-discipline/SKILL.md` — skill baru:
  kronologi insiden, aturan wajib (jangan ubah default sebagai efek
  samping; nyatakan ringkas apa yang berubah vs tetap sama; tanya dulu
  kalau ambigu; definisi selesai mencakup "tidak ada side-effect tak
  diminta"), contoh salah/benar.

### Changed

* `context/ctx-design.md` — Aturan operasional #10 baru + entri Related
  context, menunjuk ke skill di atas.
* `AGENTS.md` — Aturan keras #13 baru, pointer ke skill yang sama (entry
  point wajib dibaca tiap sesi).
* `DECISIONS.md` — ADR-052 mendapat addendum baru mendokumentasikan
  governance ini + alasan penempatan (skill khusus + `ctx-design.md`,
  bukan `PROJECT_RULES.md` yang scope-nya lebih luas dari kebutuhan, karena
  hanya Claude Code yang punya akses tool `DesignSync`).

---

## 2026-07-30 — ADR-052: perbaikan CSS Draft Editor tidak ter-inject + media-thumb hilang

User melaporkan Media (drop zone) dan Account Selector (pilihan akun sosial
media) tampil berubah/polos, tidak sesuai tampilan awal — terutama lewat
App Prototype. Ditemukan dua root cause: (1) CSS page-specific Draft Editor
hanya ada di `<style>` lokal `templates/draft-editor.html`, tidak ikut
ter-inject saat markup-nya dipindah ke document screen lain di App
Prototype (yang cuma link `../styles.css`, tanpa style lokal tambahan);
(2) `<div class="media-thumb">` (kotak preview media) hilang total dari
markup App Prototype sejak rewrite pertamanya — bug terpisah dari soal CSS.

### Changed (Claude Design project)

* `styles.css` — class Draft Editor (`.editor-grid`, `.ai-trigger`,
  `.media-drop`, `.media-thumb`, `.acc-row`(`.disconnected`),
  `.acc-row-top`, `.fmt-row` (+`label`), `.reconnect-link`, `.sched-row`)
  dipindah ke sini (section "App patterns"), nilai px dipertahankan persis
  sama dengan versi lama — tidak ada pergeseran visual.
* `templates/draft-editor.html` — `<style>` lokal dihapus total, sekarang
  murni mengandalkan `../styles.css`.
* `templates/app-prototype/AppPrototype.dc.html` — `<div
  class="media-thumb">preview media 4:3</div>` ditambahkan kembali ke
  `buildDraftEditorMarkup`, posisi sama seperti template statis.
* `readme.md` — aturan baru "setiap class page-specific wajib di
  `styles.css`, tidak boleh `<style>` lokal per halaman" ditambahkan ke
  "How to use this"/"Do"/"Don't"/"Files" supaya pola bug ini tidak terulang
  untuk screen lain.

### Verification

* Dibuat simulasi lokal: document HTML terpisah yang hanya link
  `../styles.css` (meniru `publish-drafts.html`), markup Draft Editor
  di-inject via JS persis seperti App Prototype. Terkonfirmasi: sebelum
  fix Media/Account Selector polos tanpa styling; setelah fix, render
  benar. `templates/draft-editor.html` standalone juga dicek tetap benar
  tanpa `<style>` lokal.

---

## 2026-07-30 — ADR-052: koreksi default toggle + posisi dipindah ke header

Koreksi atas entri Tahap sebelumnya — user menegaskan tidak pernah meminta
layout Draft Editor berubah, hanya toggle untuk membandingkan; membuat
"Standard" jadi default tanpa sadar mengubah tampilan yang sudah di-approve
Tahap 2 (Fullscreen). User juga meminta posisi toggle dipindah ke dalam
dialog (sejajar status chip, kiri tombol Close), bukan tombol eksternal.

### Changed (Claude Design project)

* `templates/draft-editor.html` — default variant dikembalikan ke
  **Fullscreen**; tombol toggle floating (pojok kiri bawah) dihapus,
  digantikan tombol kecil di dalam `.dialog-fs-header`/`.dialog-lg` header,
  di antara chip status dan tombol Close.
* `templates/app-prototype/AppPrototype.dc.html` — default `dialogVariant`
  dikembalikan ke `'fullscreen'`; tombol toggle toolbar dihapus, digantikan
  tombol `data-proto="draft-toggle-variant"` di dalam
  `buildDraftEditorMarkup` (header dialog, posisi sama seperti template
  statis). Method `toggleDraftEditorVariant(doc)` menggantikan
  `toggleDialogVariant()` lama — dipicu lewat `route()` langsung (sudah
  punya akses `doc`), bukan lewat lookup `this._frame` terpisah.
* `readme.md` — section "Draft Editor — Dialog variant still being
  compared" dan "How to Demo" diperbarui: posisi toggle (di dalam header,
  bukan toolbar/floating), default Fullscreen (bukan Standard).

### Verification

* Diverifikasi visual di browser lokal sebelum push: kedua varian (default
  Fullscreen, toggle ke Standard) render benar, toggle di posisi baru
  (dalam header, sejajar chip, kiri Close) berfungsi di kedua file.

---

## 2026-07-30 — ADR-052: perbaikan animasi Dialog + toggle Standard/Fullscreen

User mengecek langsung di Claude Design dan melaporkan New Post/Edit Draft
belum terasa memakai komponen Dialog/Modal (terlihat seperti halaman
biasa). Ditemukan animasi buka Dialog hilang di implementasi sebelumnya
(bug nyata, diperbaiki) — fullscreen juga memang sengaja tanpa backdrop
gelap terlihat (Astryx by design, bukan bug). Solusi: toggle Standard/
Fullscreen supaya tim bisa bandingkan langsung, default Standard.

### Changed (Claude Design project)

* `styles.css` — animasi masuk (`@keyframes dialog-enter`, fade + scale-in
  ~300ms) ditambahkan ke `.dialog`, `.dialog-fs`, dan `.dialog-lg`
  sekaligus, mereplikasi animasi asli Astryx Dialog (diverifikasi via
  `astryx swizzle Dialog` sementara — dibaca, dihapus segera, ADR-041).
  Class baru `.dialog-lg-backdrop` + `.dialog-lg` (varian "standard" besar
  — card `min(960px, 94vw)` + backdrop gelap, menggunakan ulang
  `.dialog-fs-header/-title/-actions/-body/-footer` yang sudah ada).
* `templates/draft-editor.html` — tombol toggle "Variant: Standard/
  Fullscreen" (pojok kiri bawah, di luar dialog — kontrol demo, bukan
  bagian UI produk), default Standard.
* `templates/app-prototype/AppPrototype.dc.html` — toggle yang sama di
  toolbar ("Draft Editor: Standard/Fullscreen"), state `dialogVariant`
  (default `'standard'`), live-switch overlay yang sedang terbuka tanpa
  kehilangan caption yang sudah diketik.
* `readme.md` — section baru "Draft Editor — Dialog variant still being
  compared" menjelaskan trade-off fullscreen (sengaja tanpa backdrop) vs
  standard (backdrop jelas, lebih mudah dikenali sebagai modal); catatan
  "Don't ship both variants to apps/web" ditambahkan.

### Impact

* **ADR-052 di `DECISIONS.md` — keputusan "fullscreen" tidak lagi final.**
  Ditandai eksplisit di Addendum baru: variant asli tetap didukung penuh,
  tapi pilihan final (fullscreen vs standard) menunggu keputusan tim
  setelah membandingkan langsung di Claude Design.
* Tahap 3 (implementasi kode) tetap **tidak dimulai** — menunggu aba-aba
  eksplisit user, dan keputusan variant final sebelum/saat itu dimulai.

---

## 2026-07-30 — ADR-052: App Prototype direwiring (gap Design System ditutup)

Menutup gap yang dicatat di entri Tahap 2 sebelumnya — `AppPrototype.dc.html`
(Claude Design) sekarang konsisten dengan `templates/draft-editor.html`.
Tahap 3 (implementasi kode `apps/web`) masih menunggu aba-aba eksplisit user.

### Changed (Claude Design project)

* `templates/app-prototype/AppPrototype.dc.html` — Draft Editor dihapus dari
  `SCREENS` (bukan lagi iframe-navigable route); di-inject sebagai overlay
  `.dialog-fs` ke document layar aktif (Calendar/Queue/Drafts), pola yang
  sama dengan dialog Schedule/Publish Now/Disconnect yang sudah ada
  sebelumnya. Trigger (`+ New Post`, klik item Calendar/Queue, Home →
  Today's Schedule) diarahkan ke method baru `triggerNewPost`/
  `triggerEditDraft`.
* **Resume Unfinished Post (New Post saja, KSP-05-F13) — interaktif nyata**
  via `localStorage` browser: ketik caption di New Post → tutup dengan ✕ →
  buka "+ New Post" lagi → dialog "Resume unfinished post?" muncul dengan
  isi sebelumnya (pilihan Resume/Mulai Baru). Edit Draft sengaja tidak
  punya mekanisme ini.
* Role-based button visibility (Publish Now/Schedule↔"Kirim untuk Review")
  dipindah dari logic berbasis `this.screen === 'draft-editor'` ke
  diterapkan langsung pada overlay saat dirender.
* Dropdown "Screen" toolbar: entri langsung "Draft Editor" diganti opsi
  "KSP-05 · Draft Editor (modal preview)" (shortcut preview, melewati cek
  Resume — didemokan lebih baik lewat tombol "+ New Post" sungguhan).
* `readme.md` — "How to Demo" dan "Files" diperbarui mendeskripsikan
  perilaku modal + langkah demo Resume Unfinished Post.

### Verification

* Skrip JS komponen diekstrak dan dicek `node --check` (syntax valid) —
  framework `dc-runtime`/`<x-dc>` tidak bisa dijalankan penuh di luar Claude
  Design untuk verifikasi visual end-to-end dari sesi ini.

---

## 2026-07-30 — ADR-052: Draft Editor jadi Modal (Design System)

Tahap 2 dari ADR-052 — sinkronisasi ke project Claude Design (`Social Media
Management`, ADR-042). Tahap 3 (implementasi kode `apps/web`) belum
berjalan.

### Changed (Claude Design project, bukan repo `product-discovery/`)

* `templates/draft-editor.html` — ditulis ulang total: dari full-page
  `.app-shell`/`.sidebar` menjadi modal `Dialog variant="fullscreen"`
  (`.dialog-fs`). Header (title + status chip + Close icon button), body
  (editor grid yang sudah ada, tidak berubah), footer (action bar) —
  struktur mengikuti pola `Layout` + `DialogHeader` + `LayoutContent` +
  `LayoutFooter` Astryx asli.
* `components/dialog.html` — ditambah contoh kedua: dialog "Resume
  unfinished post?" (`purpose="required"`, KSP-05-F13, khusus New Post).
* `styles.css` — 6 kelas baru (`.dialog-fs` + `-header/-title/-actions/
  -body/-footer`), nilai fullscreen (`100dvw`/`100dvh`, radius 0)
  diverifikasi via `astryx swizzle Dialog` sementara (dibaca, dihapus
  segera — ADR-041).
* `readme.md` — tabel Components, section Direction/Do, dan daftar Files
  diperbarui untuk mendokumentasikan pola modal baru.

### Known gap

* `templates/app-prototype/AppPrototype.dc.html` (interactive runner)
  **belum** direwiring — Draft Editor di situ masih navigasi halaman
  penuh, bukan modal. Dicatat eksplisit di `readme.md` project Claude
  Design dan di `PROJECT_STATE.md` Next Tasks, bukan diabaikan diam-diam.

---

## 2026-07-30 — ADR-052: Draft Editor jadi Modal (dokumentasi)

Tahap 1 (dokumentasi) dari perubahan New Post & Edit Draft menjadi modal
reusable, bukan full-page route. Tahap 2 (Design System/Claude Design) dan
Tahap 3 (implementasi kode) menyusul di sesi terpisah — belum ada kode yang
diubah pada entri ini.

### Added

* **ADR-052** di `DECISIONS.md` — Draft Editor (New Post & Edit Draft) jadi
  modal overlay fullscreen, mengoverride NP-D02. Resume unsaved state
  (localStorage + dialog "Resume unfinished post?") hanya untuk New Post.
  Route lama (`drafts/new`, `[postId]` di `calendar`/`queue`/`drafts`) akan
  dihapus total saat implementasi (modal-only) — `history/[postId]`
  ("Post Detail", layar terpisah, KSP-D10) tidak termasuk, di luar scope.
* **KSP-05-F13** (Resume Unfinished Post, New Post saja) dan **NP-D11**
  (override NP-D02) di `key-screen-patterns.md` / `navigation-patterns.md`.

### Changed

* `product-discovery/04-ux/navigation-patterns.md` — pola "Item → Editor"
  dan "New Post CTA" direword dari panel/layar-penuh menjadi modal overlay;
  Ringkasan Pola diperbarui; NP-D02 ditandai dioverride oleh NP-D11.
* `product-discovery/04-ux/key-screen-patterns.md` — KSP-05 Identitas/
  Tujuan diberi catatan modal; KSP-05-F10 direword jadi "Tutup Modal";
  State Handling ditambah 2 baris (Resume New Post, batasan Edit Draft);
  diagram Zona Fungsional diberi catatan modal.
* `product-discovery/06-engineering/monorepo-setup.md` — diagram App Router
  Publish diperbarui: `[postId]` di `calendar`/`queue`/`drafts` dihapus dari
  diagram (digantikan modal); `history/[postId]` (Post Detail, KSP-D10)
  dibiarkan apa adanya — di luar scope ADR-052.
* `PROJECT_STATE.md` — entri ADR-052 di Recent Decisions, In Progress, dan
  Next Tasks (Design System lalu implementasi kode).

---

## 2026-07-29 — Design-sync: kode `apps/web` disamakan dengan Claude Design

Arah kebalikan dari ADR-051 (yang menyamakan Claude Design ke Astryx) — kali
ini kode yang sudah diimplementasikan di M8 disamakan visual/struktur-nya ke
referensi Claude Design. Murni visual/structural, tidak menambah business
logic baru (Publish Now/AI Caption Assist sengaja tidak ditambahkan, sesuai
Next Tasks terpisah).

### Changed

* **Draft Editor** (`[slug]/publish/drafts/new/page.tsx`) — Card wrapper di
  4 section (Caption/Media/Account Selector/Schedule) dihapus, mengikuti
  referensi KSP-05 yang tidak card-wrap section form (Card = dashboard
  widget/settings group, bukan section form, per aturan Astryx sendiri).
  Tombol "+ Tambah Media" (disabled) diganti `FileInput` asli
  (`mode="dropzone"`, `isDisabled` + `disabledMessage`) — component swap
  yang benar, bukan re-design. Date+Time Schedule disejajarkan satu baris.
  Action bar (Save as Draft/Schedule) dibuat full-width sejajar via
  `StackItem size="fill"`. Label back button → "Kembali ke Drafts".
* **Publish tabbar baru** (`[slug]/publish/publish-tabbar.tsx` + update
  `publish/layout.tsx`) — shared `TabList`/`Tab` (Calendar/Queue/Drafts/
  History) di atas semua sub-route Publish, `Tab href` otomatis pakai
  Next.js `Link` (LinkProvider sudah global). 3 tab lain (Calendar/Queue/
  History) tetap placeholder, tidak ada logic baru ditambahkan.
* **Drafts List** (`[slug]/publish/drafts/page.tsx`) — page-head
  ("Publish" / "Draft yang belum terjadwal") + `EmptyState` dibungkus
  `Card`, sesuai komposisi KSP-04. Data tetap kosong/mock — tidak
  menambah fetch draft asli (di luar scope design-sync).
* **Sidebar** (`workspace-side-nav.tsx`) — `IconButton` 🔔 "Notifikasi"
  ditambahkan di footer sebelum user dropdown, link ke
  `/account/notifications` (placeholder yang sudah ada), tanpa
  unread-count real (Notification domain belum diimplementasi).
* **Auth screens** (Login/Register/Forgot/Reset Password) — dibandingkan
  detail ke referensi, sudah selaras; tidak ada perubahan kode.

Diverifikasi: `bun run typecheck` & `bun run lint` hijau; browser check
end-to-end lewat tunnel ngrok (akun test baru) — tabbar navigasi antar
tab, Draft Editor (FileInput dropzone + disabledMessage tampil benar,
"Save as Draft" tetap persist ke database nyata tanpa regresi), sidebar
notifikasi (navigasi ke `/account/notifications` terkonfirmasi).

---

## 2026-07-29 — Claude Design: 3 gap Critical Function vs 04-ux baseline diperbaiki

Lanjutan audit sinkronisasi (entri di bawah) — user meminta perbaikan
langsung ke Claude Design untuk 3 gap yang ditemukan, tanpa mengubah
baseline (baseline sudah benar, implementasi yang tertinggal).

### Fixed

* **KSP-01-F05 (Home)** — `home.html`: card/list-row diberi class
  semantik (`.home-schedule`, `.home-activity`, `.home-engagement`,
  `.home-analytics`); `AppPrototype.dc.html` diberi handler route() baru
  supaya klik item mengarah ke Draft Editor / Calendar / Engage /
  Analyze sesuai peta deep-link di baseline.
* **KSP-03-F05 (Queue)** — `publish-queue.html`: tombol ↑/↓ ditambahkan
  di tiap `queue-row`; `AppPrototype.dc.html` menukar posisi DOM baris
  dengan tetangganya saat tombol diklik + toast konfirmasi.
* **KSP-06-F02 (Engage)** — `engage-inbox.html`: 3 select filter (Semua
  Akun / Semua Platform / Semua Status) ditambahkan di atas
  `inbox-shell`, tiap `thread-item` diberi `data-platform`/`data-status`;
  `AppPrototype.dc.html` menambahkan `applyEngageFilter()` (dipanggil
  saat `change` pada select manapun) yang menyembunyikan thread tidak
  cocok dan menampilkan empty state _"Tidak ada interaksi untuk filter
  ini"_ (persis wording State Handling KSP-06) saat hasil kosong.

Diverifikasi visual (tampilan statis) di scratchpad sebelum push; logika
interaktif App Prototype (format `.dc.html` khusus Claude Design) diverifikasi
lewat review kode karena runtime-nya butuh environment Claude Design asli.

Detail lengkap temuan: entri CHANGELOG di bawah ("Audit sinkronisasi
Claude Design vs 04-ux baseline").

---

## 2026-07-29 — Audit sinkronisasi Claude Design vs 04-ux baseline

Diminta user untuk cek apakah project Claude Design masih selaras dengan
`key-screen-patterns.md` dan `navigation-patterns.md` (04-ux baseline)
setelah rewrite fidelitas Astryx (ADR-051). Dibaca ulang kedua dokumen
baseline secara penuh dan dibandingkan terhadap setiap Critical Function
KSP-01–08, label status, struktur sidebar, dan tab bar.

### Findings

* Tidak ada regresi dari rewrite ADR-051 — perubahan token/komponen murni
  visual, seluruh zona fungsional dan label status baseline masih utuh.
* 3 gap fungsional pre-existing (bukan disebabkan sesi ADR-051) ditemukan
  dan dicatat di `PROJECT_STATE.md` Known Issues: KSP-01-F05 (Home deep
  link belum di-wire), KSP-03-F05 (Queue reorder belum ada), KSP-06-F02
  (filter Engage tidak ada sama sekali).

Tidak ada perubahan pada file Claude Design maupun baseline — audit ini
murni pencatatan gap untuk task selanjutnya.

---

## 2026-07-29 — Claude Design: migrasi templates/ selesai, legacy alias dihapus total (ADR-051 addendum)

Lanjutan ADR-051: 13 layar (8 KSP + 5 Auth) + App Prototype
(`AppPrototype.dc.html`) ditulis ulang — setiap embedded `<style>`/inline
style yang masih memakai nama token lama (`--color-text-muted`,
`--radius-md`, `--color-accent-tint`, `--color-surface-subtle`, dst.)
diganti ke token Astryx asli langsung.

### Fixed

* `thumbnail.html` — ditemukan rusak sejak push pertama ADR-051:
  mereferensikan `--status-failed-bg`/`--status-published-bg`, token yang
  sudah dihapus total dari sistem baru (diganti sistem varian `Badge`),
  bukan dialiaskan. Diperbaiki ke `--color-error`/`--color-success`.
* Alias singkatan `--text-xs`/`--text-sm`/`--text-lg` (bukan nama token
  Astryx asli, dibuat sendiri saat penulisan ulang pertama) ternyata masih
  dipakai aktif di banyak file — diganti ke nama token asli
  (`--font-size-sm`/`--font-size-lg`) di seluruh project.

### Changed

* `styles.css` — blok "Legacy aliases" dihapus total (dikonfirmasi tidak
  ada lagi referensi ke nama lama di file manapun). Tidak ada satu pun
  nama token buatan sendiri yang tersisa di project ini.
* `readme.md` — bagian yang menjelaskan bridge legacy alias dan status
  "templates/ belum bermigrasi" diperbarui untuk mencerminkan migrasi
  yang sudah selesai penuh.

Detail lengkap: `DECISIONS.md` ADR-051 (addendum).

---

## 2026-07-29 — Claude Design: foundations + component library ditulis ulang mengikuti fidelitas Astryx (ADR-051)

User meminta seluruh komponen di project Claude Design memakai komponen
yang disediakan Astryx (astryx.atmeta.com/components) — bukan CSS buatan
tangan yang cuma mirip. Cara kerja yang diinginkan: dokumentasi → Design
System (Claude Design) merancang berdasar dokumentasi itu → implementasi
berkaca ke Design System. Karena Claude Design adalah kanvas HTML/CSS
statis (tidak bisa menjalankan React/StyleX asli), setiap nilai visual
ditulis ulang sebagai replika presisi dari `@astryxdesign/core@0.1.8` +
`@astryxdesign/theme-neutral@0.1.8` (versi exact pin yang sama dengan
`apps/web`) — diverifikasi via `bunx astryx docs <topic>` dan swizzle
sementara (source dibaca lalu dihapus segera, tidak pernah disimpan,
sesuai larangan swizzle ADR-041).

### Changed

* Project Claude Design (`Social Media Management`) — 13 file ditulis
  ulang: `styles.css`, `theme.json`, `readme.md`, `foundations/color.html`,
  `foundations/type.html`, `foundations/layout.html`,
  `components/buttons.html`, `components/cards.html`,
  `components/dialog.html`, `components/forms.html`,
  `components/navigation.html`, `components/status-chips.html`,
  `components/table.html`.
* Accent berubah dari placeholder rekaan (`#48517A`, slate-blue) ke accent
  neutral theme Astryx asli (`#262626`, near-black) — tetap placeholder
  brand (ADR-038/ADR-041), sekarang placeholder yang nyata, bukan rekaan.
* 6 status konten (draft/review/ready/scheduled/published/failed)
  dipetakan ke varian `Badge` asli (neutral/warning/info/purple/success/
  error) — `scheduled` memakai tag kategori "purple" karena Astryx cuma
  punya 5 varian semantik, bukan 6.
* `AppShell` dipetakan ke `variant="section"` (bukan "elevated") supaya
  arah hairline-divider produk ini tetap terjaga dengan varian asli yang
  benar-benar ada.
* Setiap file component library sekarang mencantumkan anotasi eksplisit
  komponen + props Astryx asli yang direplikasi (mis. `<Button
  variant="primary" size="md">`), supaya implementasi di `apps/web`
  tinggal pasang komponen asli.
* `styles.css` — token lama (`--color-bg`, `--space-4`, `--radius-md`, dst.)
  dipertahankan sebagai "legacy alias" ke token Astryx asli, supaya
  `templates/` (belum bermigrasi) tetap render tanpa rusak.
* Ditemukan version drift: situs live `astryx.atmeta.com` menunjukkan
  v0.1.9, sementara `apps/web` mengunci v0.1.8 — CLI lokal dipakai sebagai
  sumber final (AGENTS.md #12), bukan situs live.

### Not done (scope terpisah)

* `templates/` (8 KSP + 5 Auth + App Prototype) belum bermigrasi ke token
  Astryx asli — masih pakai page-pattern class lama + legacy alias.

Detail lengkap: `DECISIONS.md` ADR-051.

---

## 2026-07-29 — Astryx agent docs resmi menggantikan workflow manual di AGENTS.md

Ditemukan saat user menanyakan apakah "Workflow Astryx wajib" di `AGENTS.md`
sesuai dokumentasi resmi Astryx (astryx.atmeta.com/docs/working-with-ai):
section tersebut ternyata tulisan manual (dibuat saat ADR-041) yang meniru
konsep dokumentasi resmi, bukan output CLI asli — berpotensi salah/basi
dibanding command resmi `astryx init --features agents`. User meminta
diganti dengan yang resmi.

### Changed

* `apps/web/.claude/CLAUDE.md` — **baru**, di-generate via
  `bunx astryx init --features agents --agent claude` (dijalankan dari
  `apps/web`). Berisi component index (153 komponen), workflow discovery
  resmi (`astryx build` → `template` → `component`), aturan styling/token,
  CLI reference — semua ditarik otomatis dari `@astryxdesign/cli` v0.1.8
  yang ter-pin. Diberi marker `<!-- ASTRYX:START/END -->` sehingga bisa
  di-regenerate in-place setelah upgrade Astryx.
* `AGENTS.md` — section "Workflow Astryx wajib" (4 langkah manual) dan
  aturan keras #12 diganti: sekarang menunjuk ke
  `apps/web/.claude/CLAUDE.md` sebagai sumber resmi, bukan menyalin ulang
  langkah CLI secara manual. Baris "UI component / styling" di tabel
  mapping task ditambahkan referensi file ini.
* `DEVELOPER_WORKFLOW.md` — node diagram mermaid yang menyebut
  `template --list → component --dense` (langkah lama) diupdate menjadi
  pointer ke `apps/web/.claude/CLAUDE.md`.

---

## 2026-07-29 — MCP server Astryx (`xds`) ditambahkan

Susulan dari perubahan agent docs resmi di atas — user memutuskan lanjut
setup MCP server setelah trade-off (CLI lokal ter-pin vs server live)
dijelaskan.

### Changed

* `.mcp.json` — **baru** di root repo, mendaftarkan server `xds`
  (`https://astryx.atmeta.com/mcp`) sesuai konfigurasi resmi dari
  dokumentasi Astryx. Meng-expose tool `search(query)` dan `get(name)`
  untuk pencarian/lookup komponen tanpa shell out ke CLI.
* `AGENTS.md` — catatan baru di section "Workflow Astryx wajib": MCP
  boleh dipakai untuk exploration/pencarian awal, tapi keputusan final
  props/API tetap harus diverifikasi lewat CLI lokal v0.1.8 yang ter-pin
  — karena server MCP menunjuk ke versi live yang bisa beda dari versi
  ter-install (Astryx masih Beta).

---

## 2026-07-29 — ADR-050: method service Transfer Ownership & Delete Workspace

Menutup gap yang ditemukan ADR-049: `deleteWorkspace` dan
`transferOwnership` sama sekali tidak punya method service. User meminta
gap ini diperbaiki langsung, bukan ditunda sampai screen dirancang.

### Temuan & keputusan

* `deleteWorkspace` — tidak ada ambiguitas (skema DB sudah `ON DELETE
  CASCADE` di semua tabel `workspace_id`). Ditambahkan langsung: Owner
  saja, wajib konfirmasi Tier 1.
* `transferOwnership` — ternyata punya fork nyata yang belum pernah
  diputuskan di dokumen manapun: langsung vs butuh persetujuan target.
  User memilih **butuh persetujuan** — proses dua langkah:
  * `transferOwnership(targetMemberId)` — Owner memicu, isi
    `pendingOwnerTransferTo`, kirim notifikasi. Belum menukar role.
  * `acceptOwnershipTransfer()` — Admin target menerima, role baru
    bertukar, `pendingOwnerTransferTo` dikosongkan.
  * Pola ini meniru `inviteMember`/`acceptInvite` yang sudah ada di
    dokumen yang sama — bukan pola baru yang asing.

### Changed (dokumentasi)

* `application-layer.md` — 3 method baru di `WorkspaceService`
  (`transferOwnership`, `acceptOwnershipTransfer`, `deleteWorkspace`);
  catatan gap ADR-049 sebelumnya dihapus (sudah resolved).
* `domain-model.md` — field baru `Workspace.pendingOwnerTransferTo`; 2
  `NotificationType` baru (`ownership_transfer_requested`,
  `ownership_transfer_resolved`); DM-D11.
* `database-strategy.md` — kolom baru `pending_owner_transfer_to` di
  `workspaces`.
* `roles-permissions.md` — klarifikasi alur dua langkah + Related
  Documents.
* `DECISIONS.md` — ADR-050 baru.
* `PROJECT_STATE.md` — Completed, Next Tasks (disederhanakan — screen
  jadi satu-satunya blocker tersisa), Recent Decisions.

### Belum dikerjakan (task terpisah)

* Screen Workspace Settings → General/Members (di luar 8 KSP) — masih
  satu-satunya yang menghalangi implementasi Transfer Ownership/Delete
  Workspace/Remove Member di kode maupun App Prototype.

---

## 2026-07-29 — ADR-049: kebijakan Safety Check / Double Confirmation lintas produk

Lanjutan audit ADR-047/ADR-048: user meminta penilaian eksplisit — dari
seluruh aksi yang teridentifikasi, mana yang **seharusnya** wajib
Safety Check / Double Confirmation, berdasarkan kerangka reversibilitas +
blast radius.

### Kerangka & klasifikasi

* **Kriteria wajib:** irreversibel/mahal dibatalkan, ATAU blast radius
  besar (dampak melampaui data milik pengguna sendiri).
* **Tier 1** (konfirmasi diperkuat): Transfer Ownership, Delete/Hapus
  Workspace.
* **Tier 2** (dialog standar, pola Disconnect Confirmation): Delete Post,
  Delete Media, Remove Member, Update Member Role, Cancel Schedule,
  **Logout**.
* **Tidak wajib** (reversibel/frekuensi tinggi — UXP-03): Save as Draft,
  Kirim ke Review, Mark as Done, Reply komentar, Connect Account,
  Reconnect, Remove Link.
* User memindahkan **Logout** dari rekomendasi awal ("tidak perlu",
  karena reversibel penuh) ke **Tier 2** — dicatat sebagai keputusan
  eksplisit di ADR-049, bukan rekomendasi yang diikuti begitu saja.

### Temuan tambahan

* `deleteWorkspace` dan `transferOwnership` (dua aksi Tier 1) **belum
  punya method service sama sekali** di `application-layer.md` —
  screen pemicunya (Workspace Settings → General) belum pernah
  dirancang. Dicatat sebagai gap terpisah, bukan diperbaiki sekarang
  (menghindari menebak kontrak API tanpa desain layar).

### Changed (dokumentasi)

* `key-screen-patterns.md` — bagian baru "Pola Lintas Layar — Safety
  Check / Double Confirmation": kriteria, tabel tier, klasifikasi
  lengkap 17 aksi, catatan implementasi.
* `navigation-patterns.md` — NP-D10 baru (Logout wajib Tier 2) + catatan
  di bagian User Settings.
* `ux-principles.md` — bullet baru di UXP-04 menautkan ke kebijakan ini
  (bukan UXP baru — exit criteria dokumen membatasi ke 7 prinsip
  bertelusur insight I-01–I-08).
* `roles-permissions.md` — cross-reference tier di baris Hapus
  Workspace, Transfer Ownership, Undang/hapus member, Ubah role member.
* `application-layer.md` — cross-reference tier di `removeMember`,
  `updateMemberRole`, `cancelSchedule`, `deletePost`, `deleteMedia`,
  `disconnectAccount`; catatan gap `deleteWorkspace`/`transferOwnership`.
* `DECISIONS.md` — ADR-049 baru.
* `PROJECT_STATE.md` — Completed, Next Tasks (2 entry baru), Recent
  Decisions.

### Belum dikerjakan (task terpisah)

* Implementasi seluruh aksi Tier 1/Tier 2 yang baru diklasifikasikan
  (Cancel Schedule, Delete Post, Delete Media, Update Member Role,
  Logout) — baik di kode maupun App Prototype.
* Desain layar Workspace Settings → General/Members + method service
  `deleteWorkspace`/`transferOwnership` (prasyarat Tier 1).

---

## 2026-07-29 — Audit Safety Check/Double Confirmation seluruh aksi; ADR-048 Disconnect Confirmation

Lanjutan diskusi ADR-047 (Publish Now): user bertanya apakah setiap aksi
di produk melewati Safety Check/Double Confirmation. Audit menyeluruh
atas seluruh dokumen `product-discovery/` untuk memetakan setiap aksi
(publish, draft, akun, member, workspace, logout, dll.) terhadap ada/
tidaknya spesifikasi konfirmasi.

### Temuan

* Hanya **1 pola konfirmasi** yang terdokumentasi di seluruh produk:
  Confirmation Summary (KSP-05-F06), dipakai Schedule dan (sejak
  ADR-047) Publish Now.
* **Logout** tidak melewati Safety Check sama sekali — cuma disebut
  sebagai satu baris di User Menu (`navigation-patterns.md`), tanpa
  mention konfirmasi apa pun.
* Kalimat usang: `key-screen-patterns.md` sempat mengklaim Schedule
  sebagai *"satu-satunya momen"* konfirmasi eksplisit — sudah tidak
  akurat sejak ADR-047 menambahkan Publish Now. Diperbaiki jadi
  "satu-satunya **pola**" (masih akurat — cuma ada 1 pola, dipakai 2
  aksi).
* 4 aksi berisiko/destruktif — **Disconnect Account, Remove Member,
  Transfer Ownership, Delete Workspace** — sama sekali tidak punya
  spesifikasi konfirmasi. Dari keempatnya, hanya Disconnect Account yang
  sudah punya screen nyata (KSP-08); tiga lainnya belum pernah dirancang
  sebagai layar sama sekali (Workspace Settings → Members/General di
  luar 8 KSP).

### ADR-048 — Disconnect Account wajib dialog konfirmasi

* Fungsi baru **KSP-08-F07 (Disconnect Confirmation)** — dialog
  peringatan ringkas (bukan Confirmation Summary) sebelum eksekusi,
  mengingatkan bahwa post terjadwal untuk akun tersebut tetap di antrean
  (KSP-D09), tidak otomatis dibatalkan.
* Pola baru "Pola: Disconnect Flow" + baris Decision Log **KSP-D14** di
  `key-screen-patterns.md`.
* Tidak ada perubahan RBAC — akses Disconnect tetap Owner/Admin sesuai
  `roles-permissions.md` yang sudah ada; hanya ditambah catatan silang.
* Remove Member, Transfer Ownership, Delete Workspace **sengaja ditunda**
  — screen-nya belum pernah dirancang, perlu inisiatif desain terpisah
  sebelum pola konfirmasinya bisa diputuskan.

### Changed (dokumentasi)

* `key-screen-patterns.md` — KSP-08-F05 diperjelas, KSP-08-F07 baru,
  "Pola: Disconnect Flow" baru, KSP-D14 baru, kalimat "satu-satunya
  momen" diperbaiki, KSP-D05 disinkronkan.
* `roles-permissions.md` — baris "Tambah/hapus connected accounts" diberi
  catatan silang ke ADR-048; Related Documents diperbarui.
* `DECISIONS.md` — ADR-048 baru.
* `PROJECT_STATE.md` — Completed, Next Tasks (3 entry: Publish Now,
  Disconnect Confirmation, dan catatan ditunda untuk Remove
  Member/Transfer Ownership/Delete Workspace), Recent Decisions.

### Belum dikerjakan (task terpisah)

* Implementasi dialog Disconnect Confirmation di App Prototype
  (`settings-connected-accounts.html`) dan di kode nyata.
* Desain layar Workspace Settings → Members/General/Billing (prasyarat
  sebelum Remove Member/Transfer Ownership/Delete Workspace bisa dapat
  pola konfirmasi).

---

## 2026-07-29 — App Prototype: fix navigasi back + role switcher; ADR-047 Publish Now

Dua pekerjaan berurutan di sesi yang sama.

### 1. App Prototype Claude Design

* Fix bug: tombol "Kembali ke Calendar" di Draft Editor (`AppPrototype.dc.html`)
  selalu paksa balik ke Calendar walau dibuka dari Queue/Drafts —
  bertentangan `navigation-patterns.md` NP-D02. Diperbaiki jadi
  stack-aware (mengikuti riwayat navigasi asli); label tombol ikut
  menyesuaikan ("Kembali ke Queue"/"Kembali ke Drafts").
* Tambah role switcher (Owner/Admin/Manager/Creator → persona
  Dimas/Maya/Raka/Sinta) di toolbar prototype. Mendemokan pembatasan
  akses per role (`roles-permissions.md`) di 4 layar: Draft Editor
  (Schedule vs "Kirim untuk Review"), Engage (nav dikunci untuk Creator),
  Connected Accounts (read-only untuk Manager/Creator), Analyze Dashboard
  (detail disembunyikan untuk Creator).
* Perubahan ter-push ke project Claude Design "Social Media Management"
  via `DesignSync` (tidak ada perubahan di repo lokal untuk bagian ini).

### 2. ADR-047 — Publish Now

Audit konsistensi (dipicu saat kerja App Prototype, pertanyaan user
"bisakah user upload langsung tanpa schedule?") menemukan
`application-layer.md` menyebut method `publishNow` yang sama sekali
tidak dikenal di UX Baseline (`key-screen-patterns.md`) maupun
`roles-permissions.md`. Setelah diskusi soal role, diputuskan:

* Publish Now diangkat jadi fitur UX resmi: KSP-05 dapat function ID baru
  **KSP-05-F12**; bullet baru di `mvp-definition.md`; ditambahkan ke
  hierarki layar dan tabel pemetaan fitur di `information-architecture.md`.
* Akses dibatasi **identik** dengan Schedule: Owner, Admin, Manager —
  bukan tingkat akses baru, bukan lebih ketat (opsi "hanya Owner/Admin"
  dipertimbangkan dan ditolak demi konsistensi pola yang sudah ada).
  Baris transisi baru `Draft → Published (Publish Now, skip jadwal)` di
  `roles-permissions.md`.
* `application-layer.md` — baris `publishNow` diperjelas: rujuk
  KSP-05-F12, RBAC sama dengan `schedulePosts`, tetap wajib validasi
  matriks `ContentFormat` (ADR-039).

### Changed (dokumentasi)

* `mvp-definition.md`, `key-screen-patterns.md`, `information-architecture.md`,
  `roles-permissions.md`, `application-layer.md` — lihat detail di atas.
* `DECISIONS.md` — ADR-047 baru.
* `PROJECT_STATE.md` — Completed (2 entry baru), Next Tasks (implementasi
  Publish Now di kode + App Prototype belum berjalan), Recent Decisions.

### Belum dikerjakan (task terpisah)

* Implementasi `PublishingService.publishNow()` di kode.
* Tombol "Publish Now" di Draft Editor App Prototype (role switcher yang
  baru ditambahkan sudah siap dipakai untuk membatasi visibility-nya).

---

## 2026-07-29 — ADR-046 Amandemen Final: `/publish` redirect permanen

User memutuskan bentuk akhir `/publish` (pertanyaan yang ditunda dari sesi
2026-07-28): formalkan state interim sebagai **final**, bukan sekadar
sementara. Tidak ada perubahan kode — hanya dokumentasi, karena kode sudah
dalam bentuk yang diputuskan sejak revert 2026-07-28.

### Keputusan

* `/{slug}/publish` **permanen** redirect ke `/{slug}/publish/calendar`;
  `calendar/` (+ `calendar/[postId]`) **permanen** jadi folder statis.
* Publish dikecualikan **permanen** dari pola root-render ADR-046 —
  satu-satunya section dengan sibling route dinamis (`[postId]`) di root,
  sehingga root-render di sana akan menangkap path lama secara salah.
* Alternatif yang dipertimbangkan dan ditolak: root-render + rename
  `[postId]` ke path lain (mis. `/publish/post/[postId]`); root-render +
  `[postId]` sebagai intercepting/parallel route (modal). Keduanya
  menambah kompleksitas nyata untuk manfaat kosmetik (satu redirect lebih
  sedikit).

### Changed (dokumentasi)

* `DECISIONS.md` — ADR-046 ditambah section "Amandemen Final
  (2026-07-29)"; baris Publish di poin Decision #1 ditandai superseded;
  "Catatan Tambahan (2026-07-28)" ditandai interim/sudah diamandemen.
* `monorepo-setup.md` — route tree, Aturan Routing, dan MS-D09 diperbarui:
  "pengecualian sementara" → "pengecualian permanen".
* `application-layer.md` — Contoh 3: "interim" → "permanen".
* `PROJECT_STATE.md` — Known Issues (item Publish belum final dihapus),
  Completed (entry baru), Next Tasks (item diskusi lanjutan dihapus —
  tidak ada lagi yang menggantung), Recent Decisions diperbarui.

### Verified

* Tidak ada perubahan kode — verifikasi live 2026-07-28 (ngrok tunnel,
  akun test Raka Pratama) tetap berlaku untuk keputusan final ini.

---

## 2026-07-28 — ADR-046 (Publish): revert interim ke `/publish/calendar`

Verifikasi live ADR-046 menemukan `/publish/calendar` (path lama) tidak
404 — malah tertangkap `publish/[postId]` (memperlakukan `"calendar"`
sebagai ID) dan merender placeholder salah. Atas instruksi user, bagian
Publish di-revert sementara sambil menunggu diskusi lanjutan soal bentuk
akhir `publish/page.tsx`.

### Changed (kode)

* `publish/[postId]/` → `publish/calendar/[postId]/`; `publish/page.tsx`
  (isi Calendar) → `publish/calendar/page.tsx`.
* `publish/page.tsx` (baru) — cuma `redirect(`/${slug}/publish/calendar`)`.
* Home, Engage, Settings **tidak diubah** — tetap final sesuai ADR-046.

### Changed (dokumentasi)

* `DECISIONS.md` — ADR-046 ditambah section "Catatan Tambahan (2026-07-28,
  belum final)" mencatat temuan collision + revert interim; poin Decision
  asli tidak dihapus/ditulis ulang, tetap jadi catatan historis apa yang
  awalnya diputuskan.
* `monorepo-setup.md` — route tree `publish/` disesuaikan (`calendar/`
  kembali jadi folder), Aturan Routing dan MS-D09 mencatat Publish sebagai
  pengecualian sementara.
* `application-layer.md` — Contoh 3 disesuaikan kembali ke
  `/publish/calendar`.
* `PROJECT_STATE.md` — Known Issues, Completed, dan Next Tasks diperbarui;
  next task baru: lanjutkan diskusi bentuk final `publish/page.tsx` di
  sesi berikutnya.

### Verified

* `bun run typecheck`, `bun run lint`, `bun run test` — hijau.
* Live via ngrok tunnel: `/insvire/publish` redirect ke
  `/insvire/publish/calendar`, render "Content Calendar", sidebar Publish
  tetap ter-highlight.

### Status

**Belum final.** Ditunda ke sesi berikutnya atas permintaan user.

---

## 2026-07-28 — ADR-046: Routing convention, default view render di root path

Diskusi berawal dari temuan bahwa klik "Publish"/"Engage" di sidebar 404
karena parent segment (`layout.tsx`) tidak punya `page.tsx` sendiri. Audit
lanjutan menemukan pola yang sama berulang di 4 titik: root workspace
(`/{slug}`), `/publish`, `/engage`, `/settings` — semuanya cuma punya
`layout.tsx` (atau tidak punya apa-apa) di root, tanpa `page.tsx`/redirect.

### Added

* ADR-046 di `DECISIONS.md` — default/single view section (Home,
  Publish→Calendar, Engage→Inbox, Settings→General) merender langsung di
  `page.tsx` root path section, bukan named child segment. Menghapus
  `/home`, `/publish/calendar`, `/engage/inbox`, `/settings/general` dari
  routing structure secara permanen (bukan redirect kompatibilitas — belum
  ada internal link yang bergantung padanya, dikonfirmasi lewat audit grep
  menyeluruh terhadap kode dan dokumentasi).

### Changed

* `product-discovery/06-engineering/monorepo-setup.md` — App Router route
  tree diperbarui (hapus `home/`, `calendar/`, `inbox/`, `general/` sebagai
  folder terpisah; `calendar/[postId]` → `[postId]` sejajar dengan
  `queue/drafts/history`); tambah aturan routing baru + MS-D09 di Decision
  Log.
* `product-discovery/05-architecture/application-layer.md` — Contoh 3
  ("Load Halaman Calendar") diperbarui dari `/[workspace]/publish/calendar`
  menjadi `/[workspace]/publish`.
* `information-architecture.md` dan `navigation-patterns.md` **tidak
  diubah** — dikonfirmasi tidak menyebut literal URL path sama sekali,
  hanya struktur tab/screen konseptual yang tidak terdampak keputusan ini
  (IA-D04 Calendar sebagai default tab tetap berlaku).

### Note

Dokumentasi baseline diselaraskan lebih dulu; implementasi kode menyusul
di entri di bawah setelah go-ahead eksplisit dari user.

---

## 2026-07-28 — ADR-046: Implementasi routing default view

Branch `feat/adr-046-routing-default-view` (dari `feat/m8-publishing-draft-persistence`).

### Changed

* `apps/web/src/app/[slug]/home/page.tsx` → `apps/web/src/app/[slug]/page.tsx`
* `apps/web/src/app/[slug]/publish/calendar/page.tsx` → `.../publish/page.tsx`
* `apps/web/src/app/[slug]/publish/calendar/[postId]/page.tsx` → `.../publish/[postId]/page.tsx`
* `apps/web/src/app/[slug]/engage/inbox/page.tsx` → `.../engage/page.tsx`
* `apps/web/src/app/[slug]/settings/general/page.tsx` → `.../settings/page.tsx`
* Redirect target `/${slug}/home` → `/${slug}` di `app/page.tsx`,
  `onboarding/actions.ts`, `onboarding/page.tsx`.
* `WorkspaceSideNav` — href Home ke root workspace; `isSelected` Home pakai
  exact match pathname (bukan `startsWith`, karena semua route lain juga
  diawali `/${slug}` — `startsWith` akan membuat Home permanen ter-highlight).

### Verified

* `bun run typecheck`, `bun run lint`, `bun run test` — hijau (21/21 test).
* Live via ngrok tunnel dengan akun test (Raka Pratama): `/insvire`,
  `/insvire/publish`, `/insvire/engage`, `/insvire/settings` semua render
  default view langsung tanpa 404; sidebar highlight benar per section.
  `/insvire/engage/inbox` dan `/insvire/settings/general` (path lama)
  terkonfirmasi 404 bersih.

### Known Issue Ditemukan

* `/publish/calendar` (path lama) **tidak** 404 — tertangkap oleh
  `publish/[postId]` (memperlakukan `"calendar"` sebagai ID), merender
  placeholder Draft Editor. Dicatat di `PROJECT_STATE.md` → Known Issues;
  bukan regresi baru (karakteristik placeholder `[postId]` yang belum wired
  ke data asli), akan otomatis teratasi saat lookup by ID diimplementasikan.

---

## 2026-07-28 — Publishing MVP: persistensi nyata "Save as Draft"

### Added

* `PublishingService.saveDraft()` — domain layer baru di
  `apps/web/src/domains/publishing/services/`, diuji unit dengan fake
  repository (pola sama dengan `WorkspaceService`).
* `publishingRepository.createDraft()` — implementasi Prisma untuk
  `IPublishingRepository` di `apps/web/src/lib/repositories/publishing/`.
* `saveDraftAction` di `/publish/drafts/new/actions.ts` — resolve session +
  workspace by slug, lalu delegasikan ke `PublishingService.saveDraft()`.

### Changed

* Draft Editor (`/publish/drafts/new`) — tombol "Save as Draft" kini
  memanggil persistensi nyata (bukan lagi mock notice); mendapat post ID
  asli di success banner. Diverifikasi via browser (ngrok tunnel) dan cek
  langsung row di Supabase. "Schedule" tetap mock — menunggu
  `OutstandAdapter`/kredensial Outstand (ADR-040).

### Fixed

* `PROJECT_STATE.md` — section **In Progress** dan **Next Tasks** masih
  menyebut persistensi Publishing MVP sebagai belum dimulai, padahal
  implementasi di atas sudah selesai dan ter-commit. Dipindahkan ke
  **Completed**; sisa scope ("Schedule" + `OutstandAdapter`) disesuaikan.

---

## 2026-07-28 — Hapus folder `design/` (ADR-045)

Diskusi menemukan bahwa `design/` bukan acuan AI/engineering (SoT UI yang
benar-benar dipakai: `04-ux/` + `design-tokens.md` + Astryx CLI, dikonfirmasi
lewat `context/ctx-design.md`), dan belum ada designer aktif yang memakai
paket handoff-nya. Diputuskan hapus dengan versi ringan — pindahkan pointer
Claude Design, baru hapus sisanya.

### Removed

* Folder `design/` seluruhnya: `README.md`, `DESIGN_OVERVIEW.md`,
  `DESIGN_BRIEF.md`, `DESIGN_ONEPAGER.html`,
  `Design-Brief-Social-Media-Management.pdf`,
  `Design-One-Pager-Social-Media-Management.pdf`, `_build-brief-pdf.mjs`.

### Added

* ADR-045 di `DECISIONS.md` — mencatat penghapusan, alasan, dan alternatif
  yang dipertimbangkan; menegaskan tidak mengubah ADR-038 (SoT token) maupun
  ADR-042 (Claude Design sebagai handoff tool).
* `context/ctx-design.md` ditulis ulang — sekarang murni pointer ke UX
  Baseline (`04-ux/`) dan project Claude Design (project ID, akses,
  `DesignSync`), tanpa referensi ke file `design/` yang sudah tidak ada.

### Changed

* Referensi ke `design/` diperbarui/dihapus di 12 dokumen lain: `AGENTS.md`,
  `context/README.md`, `context/ctx-technical-context.md`,
  `project-manager/PROJECT_OVERVIEW.md`, `PROJECT_STATE.md`, `README.md`,
  `DEVELOPER_WORKFLOW.md`, `.agents/skills/project-os-navigator/SKILL.md`,
  `product-discovery/README.md`,
  `product-discovery/06-engineering/README.md`,
  `product-discovery/06-engineering/design-tokens.md`,
  `product-discovery/04-ux/README.md` — semua diarahkan ke
  `context/ctx-design.md` sebagai pointer baru.

---

## 2026-07-28 — Audit sinkronisasi dokumentasi lintas folder

Hasil audit menyeluruh (project-manager/, context/, product-discovery/, design/, vs kode aktual) menemukan 4 inkonsistensi struktural; semuanya diperbaiki di sesi ini.

### Fixed

* `AGENTS.md` (root) — tabel Source of Truth dan section "Related" belum
  mencantumkan `project-manager/DEVELOPER_WORKFLOW.md`, meski file itu sudah
  didaftarkan sebagai Core Document di `project-manager/README.md`. Agent
  yang strictly mengikuti AGENTS.md tidak akan menemukan file ini. Ditambahkan
  ke kedua section.
* `product-discovery/05-architecture/database-strategy.md` — kolom
  `workspace_connected_accounts.platform` masih mendaftar
  `instagram | facebook | twitter | linkedin | tiktok | youtube` saja,
  belum menyertakan `threads` dan `pinterest` yang ditambahkan ADR-037.
  Dokumen sibling-nya (`domain-model.md`) sudah benar; `database-strategy.md`
  kelewat saat sinkronisasi ADR-037. Diperbaiki agar konsisten.
* `design/DESIGN_BRIEF.md` — version metadata internal tidak konsisten
  (header `v1.1.0` vs footer `v1.0.0`, sisa dari commit `f658175` yang bump
  header tapi lupa footer). Diselaraskan jadi `v1.2.0` (menyamai
  `design/DESIGN_OVERVIEW.md` yang sudah di `v1.2.0` sejak commit `b1f9e6c`).
* `design/DESIGN_BRIEF.md` — belum menyertakan section **A.5.1 Auth Flow
  (suplemen, di luar 8 KSP)** yang sudah ada di `DESIGN_OVERVIEW.md` sejak
  commit `b1f9e6c` (5 layar pre-session: login, register, verify-email,
  forgot/reset password). Commit tersebut hanya mengubah `DESIGN_OVERVIEW.md`
  + `design/README.md`, tidak menyentuh `DESIGN_BRIEF.md` — padahal Brief
  seharusnya mirror Overview (per `design/README.md`). Section A.5.1 beserta
  referensi `templates/auth-*.html` di tabel struktur Claude Design dan B.7
  ditambahkan agar Brief (sumber PDF handoff resmi) tidak stale dibanding
  Overview.

---

## 2026-07-28 — Sinkronisasi PROJECT_STATE.md dengan kondisi repo (M8)

### Fixed

* `PROJECT_STATE.md` belum mencatat 4 commit M8 yang sudah merge (PR #15,
  2026-07-24): Workspace App Shell (SideNav + logout), `getWorkspaceBySlug`,
  Draft Editor mock data, dan config `allowedDevOrigins` ngrok. Status
  ditulis ulang: Current Status → M8 In Progress, Milestone Progress M8 →
  🟡 In Progress, section "In Progress" yang menyebut "UI Draft Editor belum
  diimplementasi" dihapus (sudah ada, mock data) dan diganti fokus baru:
  persistensi nyata + integrasi `OutstandAdapter`.

### Added

* **M8 — Workspace App Shell:** layout `[slug]` diganti dari placeholder
  kosong menjadi `AppShell` + `SideNav` persisten (Home/Publish/Engage/
  Analyze/Start Page) sesuai `navigation-patterns.md`. Sidebar header
  menampilkan nama workspace aktif via `WorkspaceService.getWorkspaceBySlug`
  (+ `IWorkspaceRepository.findBySlug` baru), footer berisi user dropdown
  dengan Profile dan Logout (`authClient.signOut`).
* **M8 — Draft Editor (mock data):** `/publish/drafts/new` (KSP-05) —
  Caption Editor, Account Selector, Content Format Selector per akun sesuai
  matriks ADR-039 (IG/FB: Post/Reel/Story; Pinterest: Pin + title/link;
  platform lain: Post), Schedule Picker, dan Confirmation Summary dialog.
  Connected accounts masih mock data (`OUTSTAND_API_KEY`/
  `OUTSTAND_WEBHOOK_SECRET` belum tersedia) — Save as Draft / Schedule hanya
  menampilkan notice mock, belum persist. Halaman placeholder Drafts kini
  link ke editor ini via CTA New Post. Persistensi nyata + integrasi
  `OutstandAdapter` adalah follow-up ADR-040.
* Dev config: `next.config.ts` — `allowedDevOrigins` menambahkan hostname
  tunnel ngrok untuk uji lokal (nilai efemeral).

---

## 2026-07-24 — M8: Workspace Onboarding (create-workspace flow)

### Added

* Onboarding Flow (First Login) dari `auth-architecture.md` diimplementasikan:
  `proxy.ts` — auth guard pakai `getSessionCookie` (Better Auth, tanpa DB
  call, cookie-presence check saja) untuk route terproteksi vs halaman auth
  publik; root `src/app/page.tsx` — Server Component yang memanggil
  `auth.api.getSession()` lalu redirect ke `/login`, `/{slug}/home`, atau
  `/onboarding` sesuai status workspace user; `src/app/onboarding/` — halaman
  create-workspace (1 field: nama, slug auto-generate) dengan Server Action
  `createWorkspaceAction`.
* `WorkspaceService` (BC-02) pertama kali diimplementasikan di
  `src/domains/workspace/`: `createWorkspace` (validasi nama, generate slug
  via value object `slugify`, retry suffix numerik saat slug bentrok, buat
  `Workspace` + `WorkspaceMember` role Owner via transaksi Prisma) dan
  `getDefaultWorkspaceSlugForUser` (dipakai orkestrasi redirect root/onboarding
  — bukan bagian tabel kontrak `WorkspaceService` di `application-layer.md`,
  ditambahkan untuk kebutuhan orkestrasi tanpa melanggar boundary).
  Implementasi repository Prisma di `src/lib/repositories/workspace/`
  (MS-D05 — repository implementation terpisah dari folder domain).
* Hierarki error `ApplicationError` (`AuthorizationError`, `NotFoundError`,
  `ValidationError`, `ConflictError`, `ExternalServiceError`) dari
  "Error Handling Strategy" (`application-layer.md`) diimplementasikan di
  `src/lib/utils/errors.ts` — infra bersama lintas domain, dipakai
  `WorkspaceService` dan siap dipakai Application Service BC lain.
* `MemberStatus` enum (`pending | active | removed`) ditambahkan ke
  `packages/shared` — sudah didokumentasikan di `domain-model.md` tapi belum
  ada di shared types.
* Test Vitest baru: `slugify` (edge case aksen, simbol, panjang), dan
  `WorkspaceService.createWorkspace` (validasi, retry-on-conflict, exhaustion)
  pakai fake in-memory repository.
* `apps/web/src/app/astryx-smoke.tsx` dihapus dari root route — tugasnya
  sebagai smoke test ADR-041 sudah selesai; root `page.tsx` sekarang berisi
  redirect logic produksi.

### Fixed

* Deteksi slug-conflict di `workspace.repository.ts` awalnya mengandalkan
  `error.meta.target` (nama kolom) untuk mengenali `P2002` — dengan driver
  adapter `@prisma/adapter-pg` (Prisma 7), `meta.target` tidak terisi
  sehingga retry logic tidak pernah terpicu dan slug bentrok akan crash
  alih-alih di-retry. Diverifikasi langsung dengan skrip terhadap database
  Supabase Cloud nyata (bukan hanya unit test dengan fake repository) —
  ditemukan lewat percobaan create-workspace kedua dengan nama sama. Fix:
  deteksi pakai `error.code === "P2002" && error.meta?.modelName === "Workspace"`
  (satu-satunya unique constraint pada `Workspace` selain PK adalah `slug`).

---

## 2026-07-24 — Better Auth Dash (official admin/monitoring plugin, optional)

### Added

* `@better-auth/infra` terpasang di `apps/web` — plugin `dash()` di
  `apps/web/src/lib/better-auth/auth.ts`, aktif hanya jika
  `BETTER_AUTH_API_KEY` terisi (pola sama dengan Google OAuth conditional).
  Tanpa API key, plugin tidak dipasang sama sekali (`plugins: undefined`) —
  tidak mengubah behavior auth existing.
* Env var baru (opsional, EM-D04): `BETTER_AUTH_API_KEY`, `BETTER_AUTH_API_URL`,
  `BETTER_AUTH_KV_URL` — dikatalogkan di `apps/web/.env.example` dan
  `apps/web/src/lib/env.ts`. Nilai aktual diisi manual oleh Project Owner di
  `.env.local` (bukan lewat agent).
* Ini dashboard resmi dari tim Better Auth untuk monitoring/admin auth
  server (bukan bagian dari `05-architecture/auth-architecture.md` atau
  `06-engineering/auth-strategy.md` — kalau mau dipakai permanen di
  production, disarankan dicatat lewat ADR terpisah agar konsisten dengan
  aturan baseline).

### Fixed

* `GET /api/auth/dash/validate` 500 — `Failed to parse URL from /api/auth/jwks`.
  Penyebab: `dash({ apiUrl: process.env.BETTER_AUTH_API_URL, ... })` selalu
  mengirim key `apiUrl`/`kvUrl` walau env var-nya kosong; `@better-auth/infra`
  men-spread raw options **setelah** default resolution-nya sendiri, jadi
  `apiUrl: undefined` eksplisit menimpa default bawaan (`https://dash.better-auth.com`)
  balik jadi `undefined` → JWKS self-check gagal parse URL relatif tanpa base.
  Diverifikasi langsung dengan memanggil `dash()` secara terisolasi (bukan
  tebakan). Fix: key `apiUrl`/`kvUrl` di-omit total (bukan diisi `undefined`)
  saat env var-nya tidak diset.

---

## 2026-07-24 — M8: Auth Flows UI (Login, Register, Forgot/Reset Password)

### Added

* Implementasi 4 layar auth di `apps/web/src/app/(auth)/` — mengganti
  placeholder scaffold M7: `login/`, `register/`, `forgot-password/`, dan
  route baru `reset-password/` (dua-state form + halaman tautan tidak
  valid). Layout bersama `(auth)/layout.tsx` (brand row + Center) mengikuti
  referensi visual Claude Design (`templates/auth-*.html`, ADR-042
  supplement Auth Flow).
* `apps/web/src/lib/better-auth/client.ts` — Better Auth React client
  (`createAuthClient`, tanpa `baseURL` eksplisit; default current origin).
* `googleOAuthEnabled()` di `apps/web/src/lib/env.ts` — tombol Google OAuth
  otomatis disembunyikan saat `GOOGLE_CLIENT_ID`/`SECRET` kosong.
* `sendResetPassword` stub di `apps/web/src/lib/better-auth/auth.ts` — log
  tautan reset ke server console; alur forgot/reset password jadi
  end-to-end testable secara lokal tanpa provider email (AS-D04 masih
  terbuka).
* Halaman UI mengikuti workflow Astryx CLI wajib (`template --list`,
  `component --dense` untuk Button/TextInput/Card/Banner/Divider/
  CheckboxInput/dll.) sesuai `AGENTS.md`.

### Verified

* `bun run typecheck` dan `bun run lint` hijau.
* Sign-up end-to-end diverifikasi via raw `fetch()` ke
  `/api/auth/sign-up/email` (akun berhasil dibuat, token session valid).
* Tampilan login & register dicek visual di browser — cocok dengan
  referensi Claude Design.

### Known Issue (terpisah, tidak menahan pass ini)

* Uji interaksi form (klik submit) via tunnel ngrok tidak berhasil
  memicu React `onSubmit` — seluruh halaman (bukan cuma form auth)
  tidak ter-hydrate saat diakses lewat tunnel tersebut (tidak ada
  React fiber di elemen manapun setelah >5 detik, walau `window.next`
  sudah termuat, tanpa error console). Kemungkinan besar isu HMR/WebSocket
  Turbopack lewat ngrok, bukan bug di kode auth — perlu diselidiki
  terpisah sebelum uji interaksi form penuh di browser bisa diandalkan.

---

## 2026-07-24 — M8 Bootstrap: Supabase Cloud + DB Migrate + ADR-044

### Added

* Project Supabase Cloud `social-media-local` dibuat (region SEA) dan
  `apps/web/.env.local` diisi (DB URL, Supabase platform, Better Auth).
* Migrasi Prisma baru `20260724075859_rename_engagement_inbox_unique_index`
  — menyamakan nama index `engagement_inbox_items_...` yang ter-truncate
  Postgres (>63 karakter) dengan yang diharapkan `schema.prisma`.

### Changed

* Rename env var client-side Supabase: `NEXT_PUBLIC_SUPABASE_ANON_KEY` →
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ADR-044) — mengikuti sistem API
  key baru Supabase (publishable/secret menggantikan anon/service_role).
  Diterapkan di `environment-management.md`, `apps/web/.env.example`,
  `apps/web/src/lib/env.ts`, `apps/web/src/lib/supabase/client.ts`.

---

## 2026-07-24 — Migrasi Next.js 16 Middleware → Proxy

### Changed

* `apps/web/src/middleware.ts` di-rename menjadi `apps/web/src/proxy.ts`;
  fungsi `middleware` di-rename menjadi `proxy`. Mengikuti file convention
  resmi Next.js 16 (https://nextjs.org/docs/messages/middleware-to-proxy);
  `config.matcher` dan behavior auth guard tidak berubah.
* Komentar pointer di `apps/web/src/lib/supabase/middleware.ts` diperbarui
  ke `src/proxy.ts` (nama file lib ini sendiri tidak berubah — bukan file
  convention Next.js).
* `product-discovery/06-engineering/monorepo-setup.md` — folder tree dan
  wording disesuaikan ke `proxy.ts`/"Proxy".
* `product-discovery/06-engineering/auth-strategy.md` — Related Documents
  update path ke `src/proxy.ts`.
* `PROJECT_STATE.md` — Known Issue deprecation warning dihapus, dicatat
  sebagai selesai di Completed.

---

## 2026-07-24 — API Mobile-Ready via Route Handler + Bearer Auth (ADR-043)

### Added

* ADR-043 di `DECISIONS.md` — Route Handler `/api/v1` (Next.js App Router)
  sebagai API mobile-ready di atas Application Service yang sama dengan web;
  tidak ada backend terpisah (Hono/Express). Better Auth Bearer plugin
  sebagai mekanisme auth mobile, menggantikan cookie session.
* `TEMP-project-owner-questions.md` — section 8: ringkasan diskusi keputusan
  ini beserta pertanyaan Project Owner dan assessment keamanan Bearer token.

### Changed

* `product-discovery/05-architecture/application-layer.md` — section baru
  "Route Handler v1 — Mobile Client" (pola entry point, workspace context
  eksplisit, versioning); Decision Log AL-D08.
* `product-discovery/06-engineering/auth-strategy.md` — section baru "Mobile
  Auth — Bearer Plugin" (konfigurasi, `trustedOrigins` custom scheme,
  `rateLimit.customRules` endpoint sensitif); Decision Log AS-D06; update
  tabel Security Considerations (brute force, Bearer token mobile).
* `product-discovery/05-architecture/auth-architecture.md` — perjelas baris
  Post-MVP "API key untuk programmatic access" agar tidak tumpang tindih
  dengan Bearer plugin mobile; Decision Log AU-D11.

---

## 2026-07-24 — Developer Workflow Notes (diagram mermaid)

### Added

* `project-manager/DEVELOPER_WORKFLOW.md` — 3 flowchart mermaid: (1) alur
  kerja project dari kebutuhan sampai kode, (2) alur pengguna auth →
  workspace → connect account → publish (visualisasi UF-01/UF-05 +
  auth-architecture.md), (3) siklus status konten per role
  (roles-permissions.md). Bersifat visualisasi, bukan Source of Truth baru.
* Didaftarkan di `project-manager/README.md` (Core Documents + folder
  structure).

---

## 2026-07-24 — Claude Design Menggantikan Figma (ADR-042)

### Added

* Project Claude Design baru `Social Media Management`
  (`84aded99-bb23-49b1-be9f-dd8f21c6873e`) — token neutral interim
  (`theme.json`/`styles.css`), foundations (color/type/layout), components
  (buttons/forms/cards/navigation/table/dialog/status-chips), dan 8 layar
  KSP-01–08 sebagai template, diakses lewat tool `DesignSync` bawaan Claude
  Code.
* ADR-042 di `DECISIONS.md` — Claude Design menggantikan Figma sebagai design
  handoff tool; sinkronisasi dengan `product-discovery/` bersifat
  manual/on-request, bukan otomatis.

### Changed

* `product-discovery/06-engineering/design-tokens.md` — seluruh referensi
  Figma diganti Claude Design (Langkah 1 review, sumber token, catatan lock).
* `design/README.md` — bagian baru "Claude Design (design system project)"
  berisi pointer projectId dan cara akses; referensi Figma diganti.
* `context/ctx-design.md` — menambah pointer Claude Design di tabel baca dulu
  dan dua aturan operasional baru (butir 10–11) soal akses via `DesignSync`
  dan sinkronisasi manual/on-request.

---

## 2026-07-23 — Konfigurasi Dasar Claude Code

### Added

* `CLAUDE.md` mengimpor `AGENTS.md` sebagai instruksi project pada setiap sesi
  Claude Code tanpa menduplikasi aturan.
* `.claude/settings.json` menambahkan schema resmi dan menolak pembacaan file
  env, private key, serta file kredensial.

### Changed

* `.gitignore` mengabaikan `.claude/settings.local.json` dan `CLAUDE.local.md`
  yang bersifat lokal serta tidak boleh dibagikan melalui repository.

---

## 2026-07-23 — Dukungan Agent Skills untuk Claude Code

### Added

* Menambahkan proyeksi project-level di `.claude/skills/` untuk 14 skill vendor
  resmi dari Better Auth, Prisma, Supabase, dan Vercel.
* Menautkan tiga skill internal (`project-os-navigator`,
  `proactive-clarification`, dan `work-report-simple`) ke sumber kanonikal di
  `.agents/skills/` agar perubahan otomatis tersedia untuk Claude Code.

### Verification

* Skills CLI mendeteksi seluruh 17 skill sebagai skill project untuk Claude
  Code.

---

## 2026-07-23 — Perbaikan Status Dinamis di AGENTS.md

### Fixed

* Menghapus status M7/M8 dan pembatasan fase aktif dari `AGENTS.md` karena file
  tersebut merupakan Static Reference.
* Section mode kerja kini hanya mengarahkan agent ke `PROJECT_STATE.md` sebagai
  satu-satunya Source of Truth untuk fase, objective, izin, dan pembatasan
  terkini.

---

## 2026-07-23 — Aturan Workflow Astryx untuk Agent

### Added

* `AGENTS.md` mewajibkan agent membaca template, skeleton, dokumentasi komponen,
  styling, dan tokens melalui CLI Astryx lokal sebelum menulis UI.
* CLI lokal ditetapkan sebagai referensi utama agar dokumentasi selalu sesuai
  exact version Astryx yang terpasang dan agent tidak menebak props.

---

## 2026-07-23 — Pembersihan Artefak UI Lama

### Removed

* Skill UI lama dari `.agents/skills/`.
* Entri skill terkait dari `skills-lock.json`.
* Referensi operasional skill lama di `AGENTS.md` dan `PROJECT_STATE.md`.

### Verification

* Tidak ada package, konfigurasi `components.json`, komponen, atau import runtime
  UI lama di aplikasi.
* Referensi pada ADR dan catatan diskusi dipertahankan sebagai riwayat keputusan,
  bukan dependency aktif.

---

## 2026-07-23 — Instalasi & Smoke Test Astryx

### Added

* Dependency Astryx dipasang dengan exact pin: Core, Neutral Theme, dan CLI
  `0.1.8`, serta StyleX `0.19.0`.
* Provider global Astryx dengan neutral theme dan integrasi router-aware
  Next.js Link.
* Halaman smoke test untuk Button, Dialog, TextInput, Table, light mode, dark
  mode, serta Tailwind token bridge.
* Script `astryx` dan konfigurasi theme package untuk CLI diagnostics.

### Changed

* Global CSS memakai cascade layer resmi Astryx + Tailwind dan token bridge.
* Root layout sekarang membungkus aplikasi dengan Astryx provider.
* `PROJECT_STATE.md` dan `TEMP-project-owner-questions.md` diperbarui untuk
  menandai implementasi fondasi dan smoke test ADR-041 selesai.

### Verification

* Astryx doctor: 5 pass, 0 warning.
* Typecheck, lint, dan 3 test lulus.
* Next.js `16.2.10` production build lulus dengan env placeholder non-rahasia.
* Browser smoke test lulus untuk render light/dark, input, table, dan interaksi
  buka/tutup dialog beserta focus management.

### Status

Fondasi Astryx ADR-041 siap digunakan untuk M8 Development. Astryx tetap Beta,
sehingga exact pin dan verifikasi ulang saat upgrade tetap wajib.

---

## 2026-07-23 — Alignment Engineering & AI Context ADR-041

### Changed

* Engineering Baseline (`monorepo-setup.md`, `dependency-strategy.md`,
  `design-tokens.md`, dan `06-engineering/README.md`) — Astryx permanen,
  neutral theme selama M8, Tailwind layout-only, wrapper selektif, design-later
  workflow, exact pin Beta, dan smoke test gate.
* `PROJECT_OVERVIEW.md` — stack UI diperbarui dari shadcn/ui Planned menjadi
  Astryx (ADR-041) + Tailwind layout-only.
* `AGENTS.md` — stack cepat, hard rule UI, dan mapping task UI diarahkan ke
  Astryx serta baseline ADR-041.
* `context/ctx-design.md`, `ctx-technical-context.md`,
  `ctx-implementation.md`, dan `ctx-development.md` — aturan operasional agent
  diselaraskan dengan component boundary, dependency guardrail, dan alur
  designer setelah feature selesai.
* `PROJECT_STATE.md` — alignment ADR-041 ditandai selesai; instalasi dan smoke
  test Astryx tetap next task.

### Status

Alignment dokumentasi ADR-041 selesai. Kode aplikasi dan dependency belum
diubah; langkah berikutnya adalah instalasi dan smoke test Astryx pada Next.js
16.

---

## 2026-07-23 — Astryx UI Foundation (ADR-041)

### Added

* ADR-041 — Astryx menggantikan shadcn/ui sebagai fondasi component system
  permanen; neutral theme digunakan selama feature development dan designer
  menetapkan visual system final setelah feature selesai.
* Guardrail adopsi Astryx Beta — exact stable version, upgrade core+theme
  bersamaan, tanpa canary/swizzle awal, wrapper selektif, update manual,
  staging, dan smoke test Next.js 16.

### Changed

* ADR-035 diamendemen dengan pengecualian exact version untuk paket Astryx
  selama masih Beta.
* ADR-038 diamendemen pada urutan kerja: implementasi feature tidak menunggu
  design final; design tokens tetap Draft/TBD sampai designer masuk.
* `PROJECT_STATE.md` — next tasks alignment dan smoke test Astryx, Known Issue
  Beta/Next.js 16, serta Recent Decision ADR-041 ditambahkan.
* `TEMP-project-owner-questions.md` — diskusi UI component system ditandai
  selesai dan dipindahkan ke ADR-041.
* `CONVERSATIONS.md` — konteks keputusan design-later dan boundary styling
  dicatat.

### Status

Keputusan ADR-041 sudah Accepted. Alignment baseline, instalasi dependency, dan
smoke test belum dikerjakan.

---

## 2026-07-23 — Penyelarasan Kontrak Outstand (ADR-040)

### Added

* ADR-040 — kontrak resmi Outstand untuk webhook, Engagement, media, dan X BYOK.
* Migrasi Prisma `20260723121000_align_outstand_contract` — durable receipt
  `outstand_webhook_events`, reconnect state, metadata working copy media
  Outstand, serta idempotency Engagement per akun.
* Shared enum `EngagementType.Comment` untuk scope MVP.

### Changed

* Product, User, dan UX Baseline — Engagement MVP dibatasi ke komentar/reply
  melalui sync 30 menit + manual refresh; Direct Message, mention, dan webhook
  Engagement dikeluarkan dari MVP.
* Architecture dan Engineering Baseline — event resmi
  `post.published`/`post.error`/`account.token_expired`, durable-before-ACK,
  `outstand.webhook.process`, upload working copy media Outstand, serta
  konfigurasi X BYOK manual di dashboard Outstand.
* Prisma schema — menambahkan durable webhook receipt, reconnect state, metadata
  media Outstand, URL media cache nullable, dan constraint Engagement
  comments-only.
* Design handoff — Comments Inbox, manual refresh, dan status last sync
  diselaraskan tanpa mengubah visual token.

* `ARCHITECTURE_OVERVIEW.md` — diagram dan runtime flow diselaraskan untuk tiga
  webhook resmi, durable-before-ACK, retry internal, Engagement sync 30 menit +
  manual refresh, media working copy Outstand, dan X BYOK manual.
* `PROJECT_STATE.md` — metadata, completion alignment dokumen+schema, next tasks,
  known issues, dan recent decisions diperbarui tanpa mengklaim runtime sudah
  diimplementasikan.
* `context/ctx-project.md`, `ctx-business.md`, `ctx-domain.md`,
  `ctx-architecture.md`, `ctx-technical-context.md`, dan
  `ctx-implementation.md` — pointer dan guardrail M8 diperbarui agar agent tidak
  memakai kontrak Outstand lama.
* `TEMP-project-owner-questions.md` — section 3–5 ditandai selesai dan sudah
  dipindahkan ke ADR-040/baseline; catatan historis dipertahankan dan section
  landing/UI Astryx yang masih terbuka tidak diubah.

### Status

Alignment dokumentasi baseline dan schema/migration ADR-040 sudah selesai.
Implementasi handler, adapter, job, sync, dan UI tetap M8 pending.

---

## 2026-07-21 (sesi kelima puluh dua)

### Added — Content Format MVP: Post / Reel / Story / Pin (ADR-039)

* ADR-039 — format publikasi per `PostTarget` masuk Must Have MVP; matriks IG/FB vs TikTok vs Pinterest.
* `ContentFormat` enum di `packages/shared` (`post | reel | story | pin`).
* Migrasi Prisma `20260721140000_add_content_format` — kolom `content_format`, `platform_options` pada `publishing_post_targets`.

### Changed

* Product: `mvp-definition.md`, `feature-modules.md`, `feature-priority.md`, `product-scope.md`.
* Architecture: `domain-model.md`, `integration-layer.md`, `database-strategy.md`.
* UX: `key-screen-patterns.md` (KSP-05-F11, KSP-D12), `information-architecture.md` (IA tree + pemetaan fitur), `user-flows.md` (UF-01).
* Architecture: `application-layer.md`, `ARCHITECTURE_OVERVIEW.md` — Format di Publishing.
* Product: `release-roadmap.md` v0.2.
* Context: `ctx-domain.md`, `ctx-design.md`.
* `design/DESIGN_OVERVIEW.md` + `DESIGN_BRIEF.md` — catatan format di Draft Editor (handoff designer).
* `PROJECT_STATE.md`, `CONVERSATIONS.md` — keputusan + next task implementasi UI format.

### Consistency fix (review ADR-039)

* Klarifikasi default Pinterest `pin` vs default kolom DB `post` (fallback teknis; Application Service wajib set nilai bisnis).
* Definisi bentuk `PlatformPublishOptions` (JSON, bukan enum shared).
* Renomori fungsi UX: Content Format Selector = `KSP-05-F11` (bukan F04b).
* UF-01 & confirmation summary menyertakan format per akun.

---

## 2026-07-21 (sesi kelima puluh satu)

### Added — Design Tokens SoT + alur lock (ADR-038)

* `product-discovery/06-engineering/design-tokens.md` — template SoT visual tokens (font, brand/neutral/status/feedback, spacing, tema) + **panduan PM** saat design siap; status Draft / nilai `TBD`.
* ADR-038 di `DECISIONS.md` — lokasi SoT token di Engineering; `design/` bukan SoT; isi setelah design approve lalu mirror ke `apps/web`.

### Changed

* `product-discovery/06-engineering/README.md` — daftar dokumen + scope + decision rules untuk design tokens.
* `design/README.md` — pointer SoT token ke `design-tokens.md`.
* `context/ctx-technical-context.md`, `context/ctx-design.md` — pointer token ke Engineering.
* `PROJECT_STATE.md`, `CONVERSATIONS.md` — next task + log keputusan ADR-038.

---

## 2026-07-21 (sesi kelima puluh)

### Added — SocialPlatform: Threads & Pinterest (ADR-037)

* `threads` dan `pinterest` ditambahkan ke enum `SocialPlatform` di `packages/shared/src/enums.ts`.
* ADR-037 di `DECISIONS.md` — perluasan aditif daftar platform yang didukung.

### Changed

* `product-discovery/05-architecture/domain-model.md` — Shared Types `SocialPlatform` + deskripsi field platform.
* `product-discovery/05-architecture/integration-layer.md` — daftar platform eksternal.
* `project-manager/ARCHITECTURE_OVERVIEW.md` — daftar platform di System Context.
* `product-discovery/04-ux/user-flows.md` dan `key-screen-patterns.md` — daftar platform di UI connect/selector.
* `PROJECT_OVERVIEW.md` — catatan daftar platform yang didukung.
* `CONVERSATIONS.md`, `PROJECT_STATE.md` — log keputusan ADR-037.

---

## 2026-07-17 (sesi keempat puluh sembilan)

### Added — AI Context layer (opsi A)

* `context/README.md` — tujuan, struktur, batas keras antar file, cara pakai agent.
* `context/ctx-project.md` — Project OS, state, rules, ADR.
* `context/ctx-business.md` — Business + Product + User (gap opsi A ditutup tanpa file baru).
* `context/ctx-domain.md` — BC, shared types, boundary rules.
* `context/ctx-architecture.md` — layer, ACL, jobs, auth arch, realtime, DB strategy.
* `context/ctx-technical-context.md` — stack, env, Prisma, Better Auth, deploy/CI.
* `context/ctx-development.md` — DX, perintah, **aturan coding/konvensi**.
* `context/ctx-implementation.md` — pola implementasi di `apps/web` / `domains/`.
* `context/ctx-design.md` — `design/` + pointer UX (`04-ux/`).

### Changed

* `AGENTS.md` — `context/` aktif (bukan “direncanakan”); mapping task → `ctx-*` + baseline; step sesi baca `context/`.
* `README.md` — pointer AI Context ke `context/README.md`.
* `PROJECT_STATE.md` — scaffold selesai; next focus M8 Development.
* `CONVERSATIONS.md` — log keputusan opsi A.

---

## 2026-07-17 (sesi keempat puluh delapan)

### Added — Official agent skills (vendor)

* Prisma: `prisma-cli`, `prisma-client-api`, `prisma-database-setup`, `prisma-upgrade-v7` (`prisma/skills`).
* Better Auth: `better-auth-best-practices`, `create-auth`, `better-auth-security-best-practices`, `email-and-password-best-practices` (`better-auth/skills`).
* Vercel: `vercel-react-best-practices`, `vercel-composition-patterns`, `vercel-optimize`, `web-design-guidelines` (`vercel-labs/agent-skills`).
* Supabase: `supabase`, `supabase-postgres-best-practices` (`supabase/agent-skills`).
* shadcn/ui: `shadcn` (`shadcn/ui`).
* `skills-lock.json` — lock hash skill terpasang.

### Notes

* Skill deploy-Vercel / React Native / 2FA / organization / migrate-radix-to-base / Prisma Postgres tidak dipasang (di luar stack MVP).

---

## 2026-07-17 (sesi keempat puluh tujuh)

### Added

* `AGENTS.md` di root — pintu masuk AI coding agent (Source of Truth pointers, skills wajib, hard rules, mapping task → dokumen).

### Changed

* `PROJECT_STATE.md` — catat rencana AI Context layer (`context/` + `ctx-*.md`); `AGENTS.md` masuk Completed; next task scaffold `context/`.
* `CONVERSATIONS.md` — log keputusan struktur AI Context mengikuti screenshot referensi user.

### Notes

* Folder `context/` kemudian di-scaffold pada sesi keempat puluh sembilan (opsi A).

---

## 2026-07-17 (sesi keempat puluh enam)

### Changed — Prisma 7 datasource config

* `schema.prisma` — hapus `url`/`directUrl` dari datasource (tidak didukung Prisma 7).
* Tambah `apps/web/prisma.config.ts` — CLI migrate memakai `DIRECT_URL` (DO-D04).
* `src/lib/prisma/client.ts` — `PrismaClient` via `@prisma/adapter-pg` + pooled `DATABASE_URL`.
* Generator `prisma-client` → output `src/generated/prisma` (gitignored).
* Upgrade deps ke Prisma 7.8 + `pg` / `@prisma/adapter-pg`.
* Update cuplikan di `database-orm.md` agar selaras Prisma 7 (semantik DO-D04 tetap).

### Notes

* Error IDE “`url` is no longer supported in schema files” terselesaikan dengan migrasi ke pola Prisma 7.
* Verifikasi: `prisma validate`, `typecheck`, `lint`, `build` hijau.

---

## 2026-07-17 (sesi keempat puluh lima)

### Added — M7 Prisma, Better Auth, env, CI (M7 selesai)

* `apps/web/prisma/schema.prisma` — identity_* + domain MVP + `background_jobs`; migrasi `20260717100000_init`.
* `apps/web/src/lib/prisma/client.ts` — singleton PrismaClient.
* `apps/web/src/lib/better-auth/auth.ts` — Better Auth + Prisma adapter; `supabase-jwt.ts` (AS-D03).
* `apps/web/src/lib/supabase/{client,server,middleware}.ts` — stubs Realtime/Storage (DO-D02).
* `apps/web/src/lib/env.ts` — fail-fast required server vars (EM-D05).
* `apps/web/.env.example` — katalog env (EM-D04).
* `.github/workflows/ci.yml` — quality gates CI-D02.
* Route `/api/auth/[...all]` di-wire ke Better Auth (`toNextJsHandler`).

### Changed

* `apps/web/package.json` — deps Prisma 6.x, better-auth, @supabase/supabase-js, jose; script `db:*` + `postinstall` generate.
* `README.md` — setup env/migrate; hapus “Remaining M7”.
* `PROJECT_STATE.md` — Version 1.0.2 → 1.0.3; M7 ✅ Completed; fokus → M8.
* `PROJECT_OVERVIEW.md` — Status `Planning` → `Active` (hilangkan living-state stale).

### Notes

* Verifikasi: `typecheck`, `lint`, `test`, `format:check`, `build` hijau.
* Semantik DO-D04 tetap (`DATABASE_URL` pooled + `DIRECT_URL` migrate); di Prisma 7 URL tidak lagi di `schema.prisma` (lihat sesi keempat puluh enam).
* Email verification sementara off (AS-D04); RLS policies SQL belum di migrasi awal.
* Belum: initial git commit (menunggu instruksi).

---

## 2026-07-17 (sesi keempat puluh empat)

### Added — M7 DX tooling

* Root: `eslint.config.mjs`, `prettier.config.mjs`, `.prettierignore`, `vitest.config.ts`, `lefthook.yml`.
* Root scripts: `lint`, `lint:fix`, `format`, `format:check`, `test`, `test:watch`, `db:*`, `prepare` (Lefthook).
* `packages/shared/src/enums.test.ts` — smoke test Vitest.
* `git init` di root (branch `main`) agar pre-commit hooks aktif.

### Changed

* `dx-tooling.md` — DX-D06 (Vitest di root) dan DX-D07 (Lefthook via `prepare`) dikunci.
* `apps/web/package.json` — ESLint dipindah ke root; script `db:*` disiapkan untuk Prisma.
* `README.md` — dokumentasi script DX dan setup hooks.
* `PROJECT_STATE.md` — Version 1.0.1 → 1.0.2; M7 progress ~60%.

### Notes

* Verifikasi: `bun run lint`, `format:check`, `test`, `typecheck` hijau.
* Belum: Prisma, Better Auth, `.env.example`, CI, initial git commit.

---

## 2026-07-17 (sesi keempat puluh tiga)

### Added — M7 slice B: Hybrid Monorepo inti

* Root Bun Workspaces: `package.json`, `tsconfig.json`, `.gitignore`, `README.md`, `bun.lock`.
* `apps/web` (`@social/web`) — Next.js App Router, placeholder routes sesuai IA, 9 domain modules MVP, `src/lib/` stubs, middleware skeleton.
* `packages/shared` (`@social/shared`) — branded IDs, enums (`ContentStatus`, `MemberRole`, `SocialPlatform`, `WorkspacePlan`), value objects.

### Changed

* `environment-management.md` — EM-D04 dikunci: lokasi env di `apps/web/` (bukan root). Catatan: `05-architecture/README.md` tidak mengatur lokasi env (di luar scope Architecture).
* `PROJECT_STATE.md` — Version 1.0.0 → 1.0.1; M7 progress ~35%; Next Tasks digeser ke DX / Prisma / Auth / CI / git init.

### Notes

* Verifikasi: `bun run typecheck` dan `bun run build` hijau.
* Belum: DX tooling, Prisma, Better Auth, `.env.example`, CI, `git init` di root.

---

## 2026-07-17 (sesi keempat puluh dua)

### Changed

* `PROJECT_OVERVIEW.md` — preferensi kerja: perubahan di `design/` tidak dicatat di `CHANGELOG.md` / `PROJECT_STATE.md` (ruang operasional desain, bukan tracking development).

---

## 2026-07-17 (sesi keempat puluh satu)

### Added

* `project-manager/ARCHITECTURE_OVERVIEW.md` — High-Level Architecture Overview (2 frame Figma: System Context & Containers + Internal Layers & Domains), disintesis dari Architecture Baseline v1.0 dan Engineering Baseline v1.0.

### Changed

* `project-manager/README.md` — menambahkan `ARCHITECTURE_OVERVIEW.md` ke folder structure & Core Documents; klarifikasi pengecualian ringkasan visual vs SoT di product-discovery.
* `project-manager/PROJECT_OVERVIEW.md` — Related Documents merujuk `ARCHITECTURE_OVERVIEW.md` dan architecture README.
* `project-manager/PROJECT_RULES.md` — `ARCHITECTURE_OVERVIEW.md` diklasifikasikan sebagai Static Reference.
* `.agents/skills/project-os-navigator/SKILL.md` — File Map memuat `ARCHITECTURE_OVERVIEW.md`.
* `PROJECT_STATE.md` — mencatat penambahan Architecture Overview.

---

## 2026-07-17 (sesi keempat puluh)

### Added — ADR-036 Engineering Planning Baseline v1.0

* `project-manager/DECISIONS.md` — ADR-036: seluruh 8 dokumen `product-discovery/06-engineering/` ditetapkan sebagai Engineering Planning Baseline v1.0 setelah ENG-REVIEW-01 s/d ENG-REVIEW-06 Fixed.

### Changed

* `PROJECT_STATE.md` — Version 0.9.7 → 1.0.0; M6 ditutup (✅ Completed); M7 dibuka (🟡 In Progress); phase → Phase 5 — Repository & Bootstrap; Active Conversation Mode → Repository & Bootstrap (bootstrap diizinkan; feature implementation tetap dibatasi); Next Tasks diganti ke inisialisasi monorepo/tooling.
* `.agents/skills/project-os-navigator/SKILL.md` — referensi folder UX / Architecture / Engineering diperbarui ke Baseline v1.0 (menghapus status living "in progress" / "pending" yang melanggar Document Type Classification).

---

## 2026-07-17 (sesi ketiga puluh sembilan)

### Fixed — Engineering Planning Review: ENG-REVIEW-01 s/d ENG-REVIEW-06

**ENG-REVIEW-01 — `monorepo-setup.md`** (Major):
* Ditambahkan `api/jobs/run/route.ts` pada pohon App Router — selaras `deployment-infrastructure.md`, `background-jobs.md`, `auth-architecture.md`.

**ENG-REVIEW-02 — `monorepo-setup.md`** (Major):
* Ditambahkan `api/auth/[...all]/route.ts` (Better Auth catch-all) + catatan bypass Middleware untuk `/api/auth/*` dan `/api/jobs/*`.

**ENG-REVIEW-03 — `auth-strategy.md`** (Major):
* Cookie `Secure` / `useSecureCookies` dibuat env-aware: `false` di local HTTP, `true` di staging/production HTTPS — selaras `environment-management.md`.

**ENG-REVIEW-04 — `monorepo-setup.md`** (Minor):
* Klarifikasi 9 domain modules MVP; BC-10 Billing post-MVP tanpa folder `src/domains/billing/` (route Settings → Billing tetap placeholder).

**ENG-REVIEW-05 — `cicd-pipeline.md`** (Minor):
* Urutan CI-D02 di tabel keputusan diselaraskan: `install → prisma generate → prisma validate → typecheck → lint → test`.

**ENG-REVIEW-06 — `monorepo-setup.md`** (Minor):
* Komentar IR-03 diganti ke `PrismaPostRepository` / larangan import `prisma` client di domain (ADR-031).

### Changed

* `PROJECT_STATE.md` — Version 0.9.6 → 0.9.7, progress 96% → 97%; ENG-REVIEW Fixed; Next: Baseline v1.0.

---

## 2026-07-17 (sesi ketiga puluh delapan)

### Changed — Engineering Planning Review (M6)

* Review konsistensi lintas 8 dokumen `product-discovery/06-engineering/` terhadap sesama dokumen M6, Architecture Baseline (ADR-025), dan ADR-028 s/d ADR-035.
* **6 temuan** dicatat di `PROJECT_STATE.md` Known Issues sebagai ENG-REVIEW-01 s/d ENG-REVIEW-06 (belum diperbaiki).
* `PROJECT_STATE.md` — Version 0.9.5 → 0.9.6, progress 95% → 96%; fokus bergeser ke perbaikan temuan review sebelum Baseline v1.0.

---

## 2026-07-17 (sesi ketiga puluh tujuh)

### Added — Dokumen M6: dependency-strategy.md

* `product-discovery/06-engineering/dependency-strategy.md` — dokumen kedelapan (terakhir) M6 Engineering Planning:
  * Version ranges eksternal **caret (`^`)**; resolusi dikunci lockfile (DS-D01).
  * Update dependency **manual**; tanpa Renovate/Dependabot di MVP (DS-D02).
  * Satu **`bun.lockb` di root**, commit wajib, frozen install di CI (DS-D03).
  * Penempatan: root = tooling; `apps/web` = runtime; `@social/shared` tanpa runtime deps (DS-D04).
  * Shared packages: hanya `@social/shared` di MVP; package baru butuh alasan kuat (DS-D05).
  * Tanpa Bun Catalog di MVP (DS-D06).
  * Decision Log DS-D01 s/d DS-D06.

### Added — ADR-035

* `project-manager/DECISIONS.md` — ADR-035: Dependency Strategy — caret ranges, manual updates, root lockfile rules.

### Changed

* `PROJECT_OVERVIEW.md` — Technical Overview: baris Dependencies.
* `product-discovery/06-engineering/README.md` — deskripsi `dependency-strategy.md`; Decision Rules dependency strategy.
* `dx-tooling.md`, `monorepo-setup.md` — Related Documents menunjuk ke `dependency-strategy.md` / ADR-035.
* `PROJECT_STATE.md` — Version 0.9.4 → 0.9.5, progress 93% → 95%; 8/8 dokumen M6 selesai; Next: Engineering Planning Review.

---

## 2026-07-17 (sesi ketiga puluh enam)

### Added — Dokumen M6: environment-management.md

* `product-discovery/06-engineering/environment-management.md` — dokumen keenam M6 Engineering Planning:
  * Supabase **Cloud-first** untuk local/staging/production; self-host ditunda sampai skema stabil (EM-D01).
  * Local memakai project Cloud terpisah **`social-media-local`** (EM-D02).
  * Secret management **native**: Railway Variables + Supabase dashboard + `.env.local` (EM-D03, EM-D04).
  * Katalog env vars server/client, validasi fail-fast, isolasi kredensial antar tier (EM-D05, EM-D06).
  * Decision Log EM-D01 s/d EM-D06.

### Added — Dokumen M6: dx-tooling.md

* `product-discovery/06-engineering/dx-tooling.md` — dokumen ketujuh M6 Engineering Planning:
  * **ESLint + Prettier** untuk lint/format (DX-D01).
  * **Lefthook + lint-staged** untuk pre-commit (DX-D02).
  * **Vitest** sebagai test runner (`bun run test`) (DX-D03).
  * Kontrak script root + checklist local setup (DX-D04, DX-D05).
  * Decision Log DX-D01 s/d DX-D05.

### Added — ADR-033, ADR-034

* `project-manager/DECISIONS.md` — ADR-033 (Environment Management), ADR-034 (DX Tooling).

### Changed

* `PROJECT_OVERVIEW.md` — Technical Overview: Lint/Format, Pre-commit, Test Runner, Env/Secrets.
* `product-discovery/06-engineering/README.md` — deskripsi `environment-management.md` dan `dx-tooling.md`.
* `deployment-infrastructure.md`, `auth-strategy.md`, `database-orm.md`, `cicd-pipeline.md`, `monorepo-setup.md` — referensi ke ADR-033/034; target DB lokal dikunci ke `social-media-local`.
* `PROJECT_STATE.md` — Version 0.9.3 → 0.9.4, progress 91% → 93%; 7/8 dokumen M6; Next: `dependency-strategy.md`.

---

## 2026-07-17 (sesi ketiga puluh lima)

### Added — Dokumen M6: cicd-pipeline.md

* `product-discovery/06-engineering/cicd-pipeline.md` — dokumen kelima M6 Engineering Planning:
  * **GitHub Actions** sebagai CI (CI-D01); gates PR: install → prisma generate/validate → typecheck → lint → test (CI-D02).
  * Promosi kode: `feature/*` → `staging` → `main` (CI-D03).
  * CD tetap **Railway auto-deploy** (CI-D04, selaras DI-D05).
  * `prisma migrate deploy` di Railway release/pre-start per environment (CI-D05).
  * Secret sensitif tidak di PR CI (CI-D06).
  * Decision Log CI-D01 s/d CI-D06.

### Added — ADR-032

* `project-manager/DECISIONS.md` — ADR-032: CI/CD Pipeline — GitHub Actions gates + Railway deploy + migrate on release.

### Changed

* `PROJECT_OVERVIEW.md` — Technical Overview: baris `CI | GitHub Actions`.
* `product-discovery/06-engineering/README.md` — deskripsi `cicd-pipeline.md`.
* `deployment-infrastructure.md` / `database-orm.md` — referensi ke ADR-032 / CI-D05.
* `PROJECT_STATE.md` — Version 0.9.2 → 0.9.3, progress 89% → 91%; 5/8 dokumen M6; Next: `environment-management.md`.

---

## 2026-07-17 (sesi ketiga puluh empat)

### Added — Dokumen M6: database-orm.md

* `product-discovery/06-engineering/database-orm.md` — dokumen keempat M6 Engineering Planning:
  * **Prisma** sebagai ORM formal; repository implementations memakai Prisma Client (DO-D01).
  * Batas Supabase client: hanya Realtime + Storage, bukan CRUD domain (DO-D02).
  * **Prisma Migrate** sebagai sumber kebenaran migrasi; alur staging → production (DO-D03).
  * Connection pooling via Supabase Supavisor: `DATABASE_URL` (pooled) + `DIRECT_URL` (migrate) (DO-D04).
  * Better Auth via Prisma adapter; model `identity_*` di schema yang sama (DO-D05).
  * RLS defense-in-depth via `SET LOCAL app.current_user_id` melalui Prisma (DO-D06).
  * Decision Log DO-D01 s/d DO-D06.

### Added — ADR-031

* `project-manager/DECISIONS.md` — ADR-031: Prisma sebagai ORM formal; mengamandemen ADR-017 (implementasi repository dari Supabase client → Prisma).

### Changed — Sinkronisasi dokumen terdampak Prisma

* `DECISIONS.md` — ADR-017 di-amandemen (status + decision text).
* `PROJECT_OVERVIEW.md` — Technical Overview: `ORM | Prisma`; Data Access = Prisma (CRUD) + Supabase client (Realtime, Storage).
* `product-discovery/06-engineering/README.md` — deskripsi `database-orm.md` dan baris Repository Pattern di tabel input.
* `product-discovery/06-engineering/monorepo-setup.md` — `src/lib/prisma/`, repositories Prisma-based, batas Supabase client.
* `product-discovery/06-engineering/auth-strategy.md` — Prisma adapter, Konteks 1 via Prisma, AS-D01 diselaraskan.
* `product-discovery/05-architecture/application-layer.md` — repository via Prisma Client (ADR-031).
* `product-discovery/05-architecture/database-strategy.md` — Migration Strategy tooling diganti ke Prisma Migrate.

### Changed — PROJECT_STATE.md

* Version 0.9.1 → 0.9.2, Overall Progress 87% → 89%.
* Completed: `database-orm.md`; In Progress: 4/8 dokumen M6; Next: `cicd-pipeline.md`.
* Recent Decisions: ADR-031.

---

## 2026-07-17 (sesi ketiga puluh tiga)

### Added — Dokumen M6: deployment-infrastructure.md

* `product-discovery/06-engineering/deployment-infrastructure.md` — dokumen kedua M6 Engineering Planning:
  * Keputusan region: **Singapore / Southeast Asia** — Railway + Supabase co-located untuk latency terendah ke target market Indonesia (DI-D01).
  * Topologi environment: **Production + Staging** (dua tier persisten), branch `main`→prod, `staging`→staging (DI-D02, DI-D05).
  * Supabase project terpisah per environment untuk isolasi data penuh (DI-D03).
  * Arsitektur Railway: dua service per environment — `web` (Next.js) + `cron` (trigger background jobs, selaras ADR-022) (DI-D04).
  * Build & deploy pipeline untuk monorepo Bun, strategi domain/TLS, scaling MVP (single instance, stateless), dan rollback (expand-and-contract) (DI-D06).
  * Decision Log DI-D01 s/d DI-D06.

### Added — Dokumen M6: auth-strategy.md

* `product-discovery/06-engineering/auth-strategy.md` — dokumen ketiga M6 Engineering Planning:
  * Konfigurasi instance Better Auth (database Supabase, prefix `identity_`, database session) (AS-D01, AS-D02).
  * Provider MVP: email + password (dengan verifikasi email) + Google OAuth, redirect URI per environment (AS-D05).
  * Atribut session cookie (HttpOnly, Secure, SameSite=lax, expiry 7 hari).
  * **Dual-context RLS**: server-side via service role + `app.current_user_id`; Supabase Realtime via JWT Supabase-compatible (HS256, `sub=userId`) agar `auth.uid()` valid — menkonkretkan ARCH-REVIEW-02 (AS-D03).
  * Konfigurasi auth per environment dan security considerations.
  * Dependency terbuka dicatat: transactional email provider untuk password reset/verification belum ditetapkan (AS-D04).
  * Decision Log AS-D01 s/d AS-D05.

### Added — ADR-028, ADR-029, ADR-030

* `project-manager/DECISIONS.md`:
  * **ADR-028** — Deployment Region: Singapore/Southeast Asia, Railway + Supabase co-located.
  * **ADR-029** — Environment Topology: Production + Staging dengan Supabase project terisolasi.
  * **ADR-030** — Auth Implementation: Better Auth config + Supabase JWT integration untuk Realtime.

### Changed — PROJECT_STATE.md

* Version 0.9.0 → 0.9.1, Last Updated → 2026-07-17, Overall Progress 85% → 87%.
* Completed: menambahkan `deployment-infrastructure.md` dan `auth-strategy.md`.
* In Progress: M6 kini 3 dari 8 dokumen selesai; dokumen berikutnya `database-orm.md`.
* Next Tasks: menghapus dua dokumen yang sudah selesai.
* Recent Decisions: menambahkan ADR-028, ADR-029, ADR-030.
* Known Issues: mencatat dependency terbuka transactional email provider (AS-D04).

---

## 2026-07-15 (sesi ketiga puluh dua)

### Fixed — Sinkronisasi PM dengan Keputusan Arsitektur Terbaru

Audit konsistensi seluruh dokumen `project-manager/` terhadap keputusan yang sudah ditetapkan (ADR-014 s/d ADR-026). Ditemukan dan diperbaiki 4 inkonsistensi:

* `project-manager/PROJECT_OVERVIEW.md` — Technical Overview: baris `ORM | Prisma` dihapus (asumsi prematur yang bertentangan dengan ADR-017). Diganti `Data Access | Supabase client *(ORM formal TBD — M6)*` sesuai keputusan arsitektur. Ditambahkan baris yang sebelumnya tertinggal: `Auth | Better Auth` (ADR-024), `Storage | Supabase Storage`, `Deployment | Railway`.
* `product-discovery/06-engineering/README.md` — daftar dokumen: `database-orm.md — ORM (Prisma)` diselaraskan menjadi strategi akses data via Supabase client (ADR-017) dengan pilihan ORM formal masih TBD — menghapus asumsi Prisma yang bocor.

### Added — ADR-027

* `project-manager/DECISIONS.md` — ADR-027: Amandemen ADR-014, mencatat pengecualian penamaan tabel aggregate root (`workspaces`, `notifications`) yang sebelumnya hanya ada di CHANGELOG sesi ke-29 dan belum terdokumentasi sebagai keputusan. Menutup gap traceability.

### Changed — PROJECT_STATE.md

* Recent Decisions: ditambahkan ADR-027.

---

## 2026-07-15 (sesi ketiga puluh satu)

### Fixed — Cleanup Dokumentasi project-manager/

* `project-manager/PROJECT_STATE.md` — menghapus 11 item strikethrough (`~~done~~`) dari section **Next Tasks** yang sudah tidak relevan (seluruh topik M5 + monorepo-setup.md sudah tercatat di section Completed). Next Tasks kini hanya berisi task yang benar-benar pending.
* `project-manager/PROJECT_OVERVIEW.md` — memperbaiki inkonsistensi: kolom Database di Technical Overview diperbarui dari `PostgreSQL *(Planned)*` menjadi `Supabase PostgreSQL`, sesuai keputusan yang sudah ditetapkan di CONVERSATIONS (sesi ke-20) dan ADR-015 (Database Strategy Baseline v1.0). Last Updated diperbarui ke 2026-07-15.

---

## 2026-07-15 (sesi ketiga puluh)

### Added

* ADR-025 di `DECISIONS.md` — System Architecture Baseline v1.0 ditetapkan untuk `product-discovery/05-architecture/`.

### Changed

* `PROJECT_STATE.md` — M5 ditutup (✅ Completed), M6 dibuka (🟡 In Progress), phase diperbarui ke Phase 4 — Engineering Planning, progress ke 85%, Active Conversation Mode diperbarui ke Engineering Planning, Next Tasks diperbarui untuk seluruh 8 dokumen M6.
* `product-discovery/06-engineering/README.md` — bagian "Input dari Fase Sebelumnya — Dari System Architecture" diperbarui: ditambahkan tabel 14 keputusan konkret dari System Architecture Baseline v1.0 sebagai constraint langsung untuk Engineering Planning.
* `project-manager/PROJECT_STATE.md` — ADR-026 ditambahkan ke Recent Decisions, monorepo-setup.md ditandai Done di Next Tasks.

### Added (lanjutan)

* `product-discovery/06-engineering/monorepo-setup.md` — dokumen pertama M6 Engineering Planning: monorepo root structure, Bun Workspaces config, apps/web folder structure, App Router routing (selaras IA), domain modules structure, packages/shared, TypeScript config, import rules (IR-01 s/d IR-05), dan decision log (MS-D01 s/d MS-D05).
* ADR-026 di `DECISIONS.md` — Monorepo Workspace Layout: apps/web, packages/shared, domain modules di src/domains/.

---

## 2026-07-15 (sesi kedua puluh sembilan)

### Changed — Naming Convention Exception: tabel utama tanpa redundansi prefix

**Keputusan:** DB-D01 diperbarui — tabel utama (aggregate root) domain yang namanya identik dengan domain prefix boleh menggunakan nama pendek tanpa prefix.

**Tabel yang diubah:**
* `workspace_workspaces` → `workspaces` (semua FK references diperbarui di `database-strategy.md`)
* `notification_notifications` → `notifications` (semua referensi diperbarui di `database-strategy.md` dan `realtime-strategy.md`)

**Dokumen yang diperbarui:**
* `product-discovery/05-architecture/database-strategy.md` — DB-D01, naming convention section, schema tabel BC-02 & BC-09, FK references, Index Strategy, Traceability, Decision Log
* `product-discovery/05-architecture/realtime-strategy.md` — semua referensi tabel notification

---

## 2026-07-15 (sesi kedua puluh delapan)

### Fixed — Architecture Review: 8 inkonsistensi lintas dokumen diperbaiki

**ARCH-REVIEW-01 — `realtime-strategy.md`** (Critical):
* Nama tabel dikoreksi dari `notifications` menjadi `notification_notifications` (sesuai naming convention domain prefix).
* Schema tabel di realtime-strategy.md diselaraskan dengan database-strategy.md — `payload JSONB` dihapus (fungsi ini sudah ditangani oleh `related_entity_type` + `related_entity_id`).
* Subscription block diperbarui: menambahkan `Table: notification_notifications` secara eksplisit.

**ARCH-REVIEW-02 — `database-strategy.md` + `realtime-strategy.md`** (Major):
* Ditambahkan klarifikasi dua konteks RLS: server-side service role menggunakan `current_setting('app.current_user_id')`, sedangkan Supabase Realtime client menggunakan `auth.uid()` (memerlukan Better Auth + Supabase JWT integration — dikonfigurasi di M6).
* `realtime-strategy.md` menambahkan catatan cross-reference ke `auth-architecture.md` tentang konfigurasi JWT.

**ARCH-REVIEW-03 — `database-strategy.md`** (Major):
* Ditambahkan section baru **System Tables (Cross-cutting Concerns)** yang mendefinisikan tabel `background_jobs`.
* Traceability table diperbarui — menambahkan mapping `background_jobs` sebagai system-level table.

**ARCH-REVIEW-04 — `integration-layer.md`** (Major):
* Publishing flow notes: "URL publik media" dikoreksi menjadi "Signed URL sementara (TTL ~24 jam)" — konsisten dengan database-strategy.md bahwa bucket `media` bersifat Private.
* IL-D07 diperbarui: mencantumkan bahwa signed URL di-generate saat scheduling, bukan URL publik.

**ARCH-REVIEW-05 — `application-layer.md`** (Major):
* Circular dependency Publishing ↔ AI Assistant dieliminasi dari dependency map.
* `BC-04 AI Assistant` tidak memanggil `BC-03 Publishing` — `postId` hanya context data bawaan, bukan service call. Hasil AI diterapkan user via aksi `PublishingService.updateDraft` yang terpisah.
* Ditambahkan rule eksplisit pada "Dependency yang dilarang": AI Assistant tidak boleh memanggil Publishing.

**ARCH-REVIEW-06 — `background-jobs.md`** (Minor):
* JOB-03 (Engagement Sync) handler diperbaiki — tidak lagi membuat JOB-02 (Post Status Notification, payload tidak kompatibel). Diganti dengan direct call ke `NotificationService.notify()` dengan type `engagement.new`, dengan aggregation untuk menghindari spam.

**ARCH-REVIEW-07 — `integration-layer.md`** (Minor):
* Referensi ke tabel `webhook_event_log` (tidak pernah didefinisikan) dihapus. Diganti dengan referensi yang benar ke tabel `background_jobs` dan JOB-01.

**ARCH-REVIEW-08 — `integration-layer.md`** (Minor):
* Retry count webhook dikoreksi dari "maks 5x" menjadi "maks 3x" — konsisten dengan JOB-01 di `background-jobs.md`.

---

## 2026-07-15 (sesi kedua puluh tujuh)

### Added — product-discovery/05-architecture/background-jobs.md

* Dokumen baru: **Background Jobs & Scheduler** — topik #5 M5.
* Arsitektur job queue: PostgreSQL tabel `background_jobs` sebagai sumber kebenaran status job.
* Railway Cron sebagai trigger eksekusi via Route Handler `/api/jobs/run` (dilindungi `X-Job-Secret`).
* 4 job types terdefinisi: `outstand.webhook.retry` (JOB-01), `notification.post_status` (JOB-02), `engagement.sync` (JOB-03), `analytics.sync` (JOB-04).
* Retry strategy: exponential backoff (5m, 15m, 60m), max 3 kali, dead letter via status `failed`.
* Concurrency control: `SELECT FOR UPDATE SKIP LOCKED` — atomic locking native PostgreSQL.
* Integrasi dengan domain: Publishing BC → webhook retry, Workspace BC → engagement sync trigger.
* Decision Log BG-D01 s/d BG-D06.
* ADR-022 (Background Job Strategy: PostgreSQL job queue + Railway Cron).

### Added — product-discovery/05-architecture/realtime-strategy.md

* Dokumen baru: **Real-time Strategy** — topik #6 M5.
* Scope real-time MVP: Supabase Realtime hanya untuk tabel `notifications`; data lain menggunakan manual refresh.
* Notification flow: domain event → JOB-02 → `NotificationService` → INSERT ke `notifications` → Supabase Realtime → client.
* Supabase Realtime subscription: channel per `user_id`, filter INSERT only, RLS menghormati subscription.
* Notification type registry: 4 tipe (`post.published`, `post.failed`, `engagement.new`, `post.scheduled_reminder`).
* Manual refresh patterns: content calendar menggunakan optimistic update + hint dari notifikasi; engagement inbox badge + manual load; analytics on demand.
* Post-MVP considerations: presence, collaborative editing, push notification.
* Decision Log RT-D01 s/d RT-D05.
* ADR-023 (Real-time Strategy: Supabase Realtime untuk notifikasi + manual refresh).

### Added — product-discovery/05-architecture/auth-architecture.md

* Dokumen baru: **Auth Architecture** — topik #7 M5.
* Authentication via Better Auth: Email + Password + Google OAuth untuk MVP.
* Session: HTTP-only cookie (Secure, SameSite=lax, expiry 7 hari), tidak dapat diakses JavaScript browser.
* Workspace context resolution: Middleware membaca workspace slug dari URL, query membership, inject `x-workspace-id` dan `x-workspace-role` sebagai request headers.
* RBAC enforcement: `assertPermission(role, operation)` di Application Service sebelum domain logic; RLS sebagai defense-in-depth.
* Middleware flow: public routes bypass auth; webhook/job routes dilindungi secret; `/dashboard/*` wajib session + workspace membership check.
* Permission matrix ringkasan per role (Owner, Admin, Manager, Creator) untuk operasi kritikal.
* Onboarding flow: user baru tanpa workspace diarahkan ke `/onboarding`.
* Post-MVP considerations: multi-workspace switching, 2FA, SSO/SAML, API key.
* Decision Log AU-D01 s/d AU-D07.
* ADR-024 (Auth Architecture: Better Auth + HTTP-only cookie + Application-layer RBAC).

### Changed — project-manager/PROJECT_STATE.md

* Progress diperbarui: 70% → 80%.
* Project Status: "System Architecture In Progress" → "System Architecture Review Pending".
* Current Focus diperbarui: seluruh 7 dokumen architecture selesai, menunggu Architecture Review.
* In Progress diperbarui: semua 7 topik M5 selesai.
* Next Tasks: topik #5, #6, #7 ditandai Done; ditambahkan task Architecture Review dan baseline.
* ADR-022, ADR-023, ADR-024 ditambahkan ke Recent Decisions.

---

## 2026-07-15 (sesi kedua puluh enam)

### Added — product-discovery/05-architecture/integration-layer.md

* Dokumen baru: **Integration Layer** — topik #4 M5.
* Posisi Outstand API sebagai external system dengan diagram arsitektur inbound dan outbound flow.
* Anti-Corruption Layer (ACL): `OutstandAdapter` sebagai satu-satunya titik interaksi dengan Outstand API — isolasi domain dari perubahan API Outstand.
* ConnectedAccount management: OAuth redirect flow via Outstand, token tidak disimpan internal, CSRF protection via `state` parameter.
* Publishing flow: schedule dan cancel post via Outstand API, `outstandJobId` sebagai external reference di `PostTarget`.
* Webhook handling: Route Handler `/api/webhooks/outstand`, HMAC-SHA256 signature verification, daftar 5 event type, async processing, idempotency strategy.
* Engagement data sync: webhook push untuk item baru + polling periodik sebagai fallback.
* Analytics data sync: pull-based polling periodik untuk post metrics dan workspace snapshot.
* Error handling strategy: klasifikasi 5 tipe error (transient, client, auth, account, not found), penanganan per operasi, `IntegrationError` sebagai tipe domain.
* Decision Log IL-D01 s/d IL-D08.
* ADR-019 (Anti-Corruption Layer), ADR-020 (Webhook Handling), ADR-021 (OAuth via Outstand).

---

## 2026-07-15 (sesi kedua puluh lima)

### Added — product-discovery/05-architecture/application-layer.md

* Dokumen baru: **Application Layer** — topik #3 M5.
* Layer stack 4-tingkat: Entry Points → Application Service → Domain Logic → Repository → Infrastructure.
* Next.js entry point patterns: Server Components (read), Server Actions (UI mutations), Route Handlers (webhook/external), Middleware (auth guard + workspace context resolution).
* Application Service contracts untuk seluruh 9 bounded context MVP.
* Repository Pattern eksplisit: interface di domain module, implementasi via Supabase client, satu repository per Aggregate Root.
* Cross-domain communication: service-to-service call via `index.ts` (public API), aturan no circular dependency, only pass ID lintas domain.
* Error handling hierarchy: ApplicationError → AuthorizationError, NotFoundError, ValidationError, ConflictError, ExternalServiceError.
* 3 contoh request flow: Schedule Post, Webhook Outstand, Load Calendar Page.
* Decision Log AL-D01 s/d AL-D04.

### Changed — project-manager/DECISIONS.md

* Ditambahkan ADR-016: Application Layer — Next.js Entry Point Strategy.
* Ditambahkan ADR-017: Application Layer — Repository Pattern.
* Ditambahkan ADR-018: Application Layer — Cross-Domain Communication.

### Changed — project-manager/PROJECT_STATE.md

* Version: 0.6.0 → 0.7.0.
* Overall Progress: 65% → 70%.
* Current Focus diperbarui: Application Layer selesai, next Integration Layer.
* In Progress diperbarui ke topik #4: Integration Layer.
* Completed ditambahkan: application-layer.md.
* Next Tasks: Application Layer ditandai Done.
* Recent Decisions ditambahkan ADR-016, ADR-017, ADR-018.

---

## 2026-07-15 (sesi kedua puluh empat)

### Added — product-discovery/05-architecture/database-strategy.md

* Dokumen baru: **Database Strategy** — topik #2 M5.
* Multi-tenancy strategy: RLS dengan `workspace_id` sebagai unit isolasi; pendekatan application-enforced auth + RLS sebagai defense-in-depth karena Better Auth tidak terintegrasi native dengan Supabase JWT.
* Schema organization: single schema `public` dengan domain prefix (ADR-014).
* ID Convention: UUID v4 via `gen_random_uuid()` — native PostgreSQL/Supabase.
* 22 tabel terdefinisi untuk 10 bounded context — memetakan seluruh entitas dari domain-model.md ke tabel database.
* BC-01 Identity: tabel dikelola Better Auth dengan prefix `identity_`.
* Soft delete strategy: hard delete by default; `deleted_at` hanya pada `publishing_posts`.
* Storage strategy: Supabase Storage dengan dua bucket (`media` private, `avatars` public).
* Index strategy: workspace_id mandatory pada semua tabel multi-tenant; query-driven indexes per tabel.
* Migration strategy: Supabase CLI, detail di Engineering Planning (M6).
* Decision Log DB-D01 s/d DB-D06.

### Changed — project-manager/DECISIONS.md

* Ditambahkan ADR-014: Database Schema Organization — Single Schema dengan Domain Prefix.
* Ditambahkan ADR-015: Database Strategy Baseline v1.0.

### Changed — project-manager/PROJECT_STATE.md

* Version: 0.5.0 → 0.6.0.
* Overall Progress: 58% → 65%.
* Current Focus: diperbarui — Database Strategy selesai, fokus beralih ke Application Layer.
* In Progress: diperbarui ke topik #3 Application Layer.
* Next Tasks: Database Strategy ditandai Done.
* Completed: ditambahkan database-strategy.md.
* Recent Decisions: ditambahkan ADR-014 dan ADR-015.

---

## 2026-07-15 (sesi kedua puluh tiga)

### Added — product-discovery/05-architecture/domain-model.md

* Dokumen baru: **Domain Model & Bounded Context** — topik #1 M5.
* Mendefinisikan 10 bounded context: Identity, Workspace, Publishing, AI Assistant, Engagement, Analytics, Start Page, Media, Notification, Billing.
* Menetapkan Core Entities dan Key Attributes per bounded context.
* Context Map — diagram dan tabel relasi antar bounded context.
* Shared Types (`packages/shared`) — ID types, enums kanonikal (ContentStatus, MemberRole, SocialPlatform, WorkspacePlan), value objects.
* Domain Boundary Rules (BR-01 s/d BR-06) — aturan implementasi Pragmatic Boundary.
* Traceability ke Product Baseline (feature-modules.md) dan User Insights (I-01, I-04, I-06, I-08).
* Decision Log DM-D01 s/d DM-D06.

### Changed — project-manager/PROJECT_STATE.md

* Overall Progress: 55% → 58%.
* Current Focus: diperbarui — Domain Model selesai, fokus beralih ke Database Strategy.
* In Progress: diperbarui ke topik #2 Database Strategy.
* Next Tasks: Domain Model ditandai Done, Database Strategy menjadi prioritas berikutnya.
* Completed: ditambahkan domain-model.md.

---

## 2026-07-15 (sesi kedua puluh dua)

### Added — CONVERSATIONS.md

* Entry baru: Keputusan Pra-Architecture — Domain Boundary, Storage & Deployment.

### Changed — product-discovery/05-architecture/README.md

* Tambah 3 keputusan pra-architecture ke tabel: Storage (Supabase Storage), Deployment (Railway), Domain Boundary Strictness (Pragmatic Boundary).

---

## 2026-07-15 (sesi kedua puluh satu)

### Added — product-discovery/05-architecture/

* `README.md` — struktur, scope, daftar dokumen, workflow, input dari baseline sebelumnya, expected output, exit criteria, dan decision rules untuk fase System Architecture.

---

## 2026-07-15 (sesi kedua puluh)

### Added — CONVERSATIONS.md

* Entry baru: Keputusan Pra-Architecture — Database, Auth & Real-time. 4 keputusan ditetapkan, 2 masih pending.

---

## 2026-07-15 (sesi kesembilan belas)

### Added — DECISIONS.md

* ADR-013 — UX Planning Baseline v1.0: seluruh dokumen `product-discovery/04-ux/` ditetapkan sebagai baseline setelah semua 4 UX Planning Review item selesai diperbaiki.

### Changed — PROJECT_STATE.md

* Versi naik dari 0.4.0 → 0.5.0.
* Phase diupdate: Phase 2 — UX Planning → Phase 3 — System Architecture.
* Milestone aktif diupdate: M4 → M5.
* Sprint diupdate: Sprint 2 → Sprint 3.
* Overall Progress diupdate: 45% → 55%.
* M4 — UX Planning ditandai ✅ Completed.
* M5 — System Architecture ditandai 🟡 In Progress.
* Current Focus, Active Conversation Mode, In Progress, Next Tasks, Known Issues, dan Recent Decisions diperbarui sesuai fase baru.

### Added — CONVERSATIONS.md

* Entry baru: Briefing M5 System Architecture Planning — topik, urutan pembahasan, dan cara kerja antar sesi.

---

## 2026-07-15 (sesi kedelapan belas)

### Fixed — UX Planning Review — REVIEW-04 (Minor)

* `product-discovery/04-ux/navigation-patterns.md` — tambah pola baru **"New Post CTA dari Calendar dan Queue"** di section Contextual Navigation Pattern. Mendokumentasikan bahwa CTA New Post tersedia langsung dari Calendar dan Queue (bukan hanya dari Drafts), trigger dan konteks penggunaannya, serta perilaku transisi dan tombol Back.
* Tambah **NP-D09** ke Decision Log: alasan New Post CTA tersedia di Calendar dan Queue — mengurangi friction saat Raka menemukan gap jadwal di titik penemuan kebutuhan.
* Tambah baris baru ke Ringkasan Pola.

### Changed — PROJECT_STATE.md

* Fix #4 dipindahkan dari Next Tasks ke selesai; Next Tasks diperbarui ke satu item sisa: ADR-013 UX Planning Baseline.
* REVIEW-04 ditandai Fixed di Known Issues.
* Semua 4 REVIEW item kini berstatus Fixed.

---

## 2026-07-15 (sesi ketujuh belas)

### Fixed — UX Planning Review — REVIEW-03 (Minor)

* `product-discovery/04-ux/key-screen-patterns.md` — tambah KSP-D11 ke Decision Log: mendokumentasikan alasan eksklusi Start Page dari 8 layar kritis. Start Page bukan bagian dari siklus kerja harian; polanya sederhana (konfigurasi + preview) dan tidak memerlukan dokumentasi mendalam di fase ini.

### Changed — PROJECT_STATE.md

* Fix #3 dipindahkan dari Next Tasks ke selesai.
* REVIEW-03 ditandai Fixed di Known Issues.

---

## 2026-07-15 (sesi keenam belas)

### Fixed — UX Planning Review — REVIEW-02 (Minor)

* `product-discovery/04-ux/key-screen-patterns.md` — KSP-02-F07 (Disconnected Account Warning): koreksi referensi prinsip dari `UXP-05` menjadi `UXP-06`. UXP-06 (Status Jelas, Proses Ringan) adalah prinsip yang tepat untuk status visibilitas akun; UXP-05 mengacu ke prinsip AI.

### Changed — PROJECT_STATE.md

* Fix #2 dipindahkan dari Next Tasks ke selesai.
* REVIEW-02 ditandai Fixed di Known Issues.

---

## 2026-07-15 (sesi kelima belas)

### Fixed — UX Planning Review — REVIEW-01 (Kritis)

Selaraskan set status konten kanonikal lintas 4 dokumen UX — mengacu ke `product-discovery/02-product/roles-permissions.md` sebagai sumber kebenaran.

* `product-discovery/04-ux/ux-principles.md` — UXP-06: tambah `failed` ke status list; koreksi "ready" → "ready to schedule"; tambah bullet referensi ke `roles-permissions.md` untuk aturan transisi per role.
* `product-discovery/04-ux/information-architecture.md` — Status Indicator di IA tree: tambah `in review` dan `ready to schedule`.
* `product-discovery/04-ux/user-flows.md` — 3 tempat: Queue happy path, Queue UX principles rationale, Calendar happy path — semua status list dilengkapi dengan `In Review` dan `Ready to Schedule`.
* `product-discovery/04-ux/key-screen-patterns.md` — 3 tempat: KSP-02-F02 (Calendar status), KSP-03-F02 (Queue status), KSP-05-F07 (Draft Editor Status Indicator) — semua dilengkapi dengan `In Review` dan `Ready to Schedule`.

### Changed — PROJECT_STATE.md

* Fix #1 dipindahkan dari Next Tasks ke selesai.
* REVIEW-01 ditandai Fixed di Known Issues.

---

## 2026-07-15 (sesi keempat belas)

### Added — Roles & Permissions

* `product-discovery/02-product/roles-permissions.md` — addendum Product Baseline v1.0. Mendefinisikan 4 roles (Owner, Admin, Manager, Creator) beserta hak akses per area fitur, set status konten kanonikal (Draft, In Review, Ready to Schedule, Scheduled, Published, Failed), aturan transisi status per role, dan mapping roles ke 5 persona User Discovery Baseline.

### Added — DECISIONS.md

* ADR-012 — Addendum Product Baseline: `roles-permissions.md` ditambahkan ke `product-discovery/02-product/`. Mencakup alasan pendefinisian roles di fase Product dan penetapan set status konten sebagai acuan kanonikal lintas dokumen UX.

### Changed — PROJECT_STATE.md

* Task 1 (Roles & Permissions) dipindahkan dari Next Tasks ke Completed.
* Recent Decisions diperbarui: ADR-012 ditambahkan.

---

## 2026-07-15 (sesi ketiga belas)

### Changed — PROJECT_STATE.md

* Versi dinaikkan ke 0.4.0.
* Current Focus diperbarui: fokus bergeser ke UX Planning Review dan Roles & Permissions.
* In Progress diperbarui: UX Planning Review sedang berjalan, 4 inkonsistensi ditemukan.
* Next Tasks diperbarui: 2 task utama didefinisikan — Task 1 (Roles & Permissions + ADR-012) dan Task 2 (4 perbaikan UX Planning Review + ADR-013 untuk UX Planning Baseline).
* Known Issues diisi: 4 temuan inkonsistensi dari UX Planning Review dicatat sebagai REVIEW-01 hingga REVIEW-04.

---

## 2026-07-15 (sesi kedua belas)

### Added — Key Screen Patterns

* `product-discovery/04-ux/key-screen-patterns.md` — pola fungsi kritis untuk 8 layar utama produk: KSP-01 Home, KSP-02 Publish Calendar, KSP-03 Publish Queue, KSP-04 Publish Drafts, KSP-05 Draft Editor (termasuk pola AI Assist inline, Account Selector dengan status, dan Confirmation Summary), KSP-06 Engage Inbox (master-detail pattern), KSP-07 Analyze Dashboard, KSP-08 Connected Accounts. Setiap layar memiliki critical functions dengan ID, zona fungsional, state handling, dan decision log. 10 keputusan desain terdokumentasi (KSP-D01 hingga KSP-D10). Dokumen terakhir dari M4 — UX Planning.

### Changed — PROJECT_STATE.md

* Overall Progress diperbarui dari 38% ke 45%.
* `key-screen-patterns.md` dipindahkan dari In Progress ke Completed.
* Next Tasks diperbarui: fokus berikutnya adalah UX Planning Review lintas dokumen dan penetapan UX Planning Baseline.

---

## 2026-07-15 (sesi kesebelas)

### Added — Navigation Patterns

* `product-discovery/04-ux/navigation-patterns.md` — model dan pola navigasi lengkap: Persistent Sidebar Navigation sebagai model utama, primary/secondary/in-section navigation patterns, 5 contextual navigation patterns (Item→Editor, Thread Expansion, Status→Settings, Empty State→Action, Deep Link), notification badge pattern, cross-section navigation pattern, dan decision log 8 keputusan navigasi (NP-D01 hingga NP-D08).

---

## 2026-07-15 (sesi kesepuluh)

### Added — User Flows

* `product-discovery/04-ux/user-flows.md` — 6 solution flows untuk Must Have MVP: UF-01 (Membuat & Menjadwalkan Konten), UF-02 (Mengelola Queue), UF-03 (Review Kalender), UF-04 (Triage Engagement Inbox), UF-05 (Menghubungkan Akun Sosial), UF-06 (Melihat Ringkasan Performa). Setiap flow memiliki happy path + 1 alternate path paling kritis. 4 UX Decisions (UXD-01 hingga UXD-04) terdokumentasi.

### Added — Skill: Proactive Clarification

* `.agents/skills/proactive-clarification/SKILL.md` — skill baru yang memandu AI untuk secara proaktif mengidentifikasi keputusan yang belum ditentukan sebelum mengeksekusi tugas apapun. AI wajib bertanya dengan pilihan-pilihan terbaik di kelasnya (maks 4–5 opsi dikurasi), berlaku untuk semua jenis interaksi — dokumentasi, fitur, arsitektur, konfigurasi. Skill tidak aktif jika keputusan sudah ada di baseline project.

---

## 2026-07-15 (sesi kesembilan)

### Added — Information Architecture

* `product-discovery/04-ux/information-architecture.md` — IA lengkap: struktur navigasi (primary + secondary), hierarki layar untuk seluruh domain MVP (Home, Publish, Engage, Analyze, Start Page, Workspace Settings, User Settings), pemetaan fitur Must Have ke layar, entry points per persona, dan decision log 7 keputusan struktural.

### Added — UX Principles

* `product-discovery/04-ux/ux-principles.md` — 7 UX Principles ditetapkan, masing-masing diturunkan dari insight User Discovery (I-01 hingga I-08) dengan implikasi desain yang actionable.

---

## 2026-07-14 (sesi kedelapan)

### Fixed — Inkonsistensi pada PROJECT_OVERVIEW.md

* `project-manager/PROJECT_OVERVIEW.md` — menghapus section `Current Phase` yang memuat status/milestone basi (masih menyebut M1 — Discovery), melanggar aturan Document Type Classification yang sudah ditetapkan sendiri di `PROJECT_RULES.md`.

### Added — Developer Profile & Working Preferences

* Menambahkan section **Developer Profile & Working Preferences** di `PROJECT_OVERVIEW.md` — mencatat profil solo developer dan preferensi kerja yang sudah terkonfirmasi dari sesi-sesi sebelumnya.
* Menambahkan retroaktif 3 entri `CONVERSATIONS.md` yang terlewat: diskusi Document Type Classification, pemisahan `product-discovery/` dari `project-manager/`, dan evaluasi "apakah project-manager sudah menjadi asisten pribadi".

### Added — Proactive Consistency Check

* Menambahkan section **Proactive Consistency Check** pada `SKILL.md` — AI wajib memeriksa dokumen Static Reference terhadap kebocoran status/progress, dan wajib melaporkannya ke user (bukan memperbaiki diam-diam).
* Menambahkan 2 aturan baru pada **Aturan Context** di `SKILL.md`: larangan memperbaiki inkonsistensi secara diam-diam, dan kewajiban mengikuti serta memperbarui Working Preferences.

### Status

Gap yang ditemukan saat evaluasi "apakah project-manager sudah menjadi asisten pribadi" sudah ditindaklanjuti: status basi dibersihkan, log diskusi disinkronkan, working preference mulai terdokumentasi, dan ada mekanisme proaktif untuk mencegah inkonsistensi serupa terulang.

---

## 2026-07-14 (sesi ketujuh)

### Changed — Pemisahan Struktur `product-discovery/` dari `project-manager/`

* Memindahkan folder `product-discovery/` keluar dari `project-manager/` menjadi folder top-level, sejajar (sibling) dengan `project-manager/`.
* Menambahkan ADR-011 pada `DECISIONS.md` — mendokumentasikan alasan pemisahan struktur.
* Menulis ulang `project-manager/README.md` secara menyeluruh: menghapus struktur folder usang yang tidak pernah ada (`01-discovery/`, `07-ai/`, `08-management/`, dsb.), menjelaskan `project-manager/` sebagai dokumentasi cara kerja, dan `product-discovery/` sebagai Source of Truth produk.

### Fixed — Perbaikan Path Referensi Antar Dokumen

* `product-discovery/README.md` — path ke dokumen `project-manager/` diperbaiki (`../project-manager/...`).
* `product-discovery/01-business/README.md` — memperbaiki path yang sudah rusak sejak sebelum pemindahan folder (Documents dan Decision Rules section), sekaligus menyesuaikan ke struktur baru.
* `product-discovery/02-product/README.md`, `03-user/README.md`, `04-ux/README.md`, `06-engineering/README.md` — seluruh referensi ke `PROJECT_OVERVIEW.md`, `PROJECT_RULES.md`, `PROJECT_STATE.md`, `DECISIONS.md` diperbaiki menjadi `../../project-manager/...`.
* `project-manager/PROJECT_STATE.md`, `PROJECT_RULES.md`, `PROJECT_OVERVIEW.md` — section `Related Documents` diperbaiki menjadi `../product-discovery/...`.
* `.agents/skills/project-os-navigator/SKILL.md` — path operasional (`Load Context`, `File Map`, `Additional Resources`) diperbaiki dari `project-manager/product-discovery/...` menjadi `product-discovery/...`, dan File Map dipecah menjadi dua tree sejajar.
* Seluruh dokumen individual di `product-discovery/01-business/`, `02-product/`, `03-user/` (bukan hanya README.md) — referensi ke `PROJECT_OVERVIEW.md`, `PROJECT_RULES.md`, `PROJECT_STATE.md`, `DECISIONS.md`, `CHANGELOG.md` diperbaiki secara massal menjadi `../../project-manager/...`.

### Status

Struktur repository kini: `project-manager/` (cara kerja) dan `product-discovery/` (pengetahuan produk) sebagai dua folder top-level yang terpisah. Seluruh referensi path antar dokumen telah disinkronkan.

---

## 2026-07-14 (sesi ketiga)

### Added — Engineering Planning Phase

* Menambahkan `product-discovery/06-engineering/README.md` — titik masuk Engineering Planning (M6).
* Menambahkan ADR-010 pada `DECISIONS.md` — Engineering Planning sebagai fase baru di product-discovery.

### Changed — Milestone Numbering

* Menambahkan M6 — Engineering Planning sebagai milestone baru.
* Menggeser milestone lama: M6 → M7 (Repository & Bootstrap), M7 → M8 (Development), M8 → M9 (Testing & Release).
* Memperbarui `PROJECT_STATE.md`: milestone table, Recent Decisions, dan Related Documents.
* Memperbarui file map pada `.agents/skills/project-os-navigator/SKILL.md`.

### Status

Engineering Planning (M6) terdaftar sebagai fase baru. Masih ⏳ Pending — akan dikerjakan setelah M5 System Architecture selesai.

---

## 2026-07-14 (sesi keempat)

### Changed — product-discovery/README.md

* Memperbarui Objectives: menambahkan poin dokumentasi keputusan teknis engineering.
* Memperbarui Workflow: menambahkan step Engineering setelah Architecture.
* Memperbarui Folder Structure: menambahkan `06-engineering/` dengan status tiap folder.
* Memperbarui Discovery Stages: memisahkan scope `05-architecture` dan menambahkan section `06-engineering`.
* Memperbarui Exit Criteria: menambahkan Engineering Planning sebagai syarat selesai, menandai Business/Product/User Baseline yang sudah selesai.
* Memperbarui Next Phase: merujuk ke M7 — Repository & Bootstrap dengan referensi ADR-001.

### Status

`product-discovery/README.md` selaras dengan dokumentasi terbaru.

---

## 2026-07-14 (sesi kelima)

### Changed — Document Type Classification

* Menambahkan section **Document Type Classification** pada `PROJECT_RULES.md` yang mendefinisikan tiga tipe dokumen: Static Reference, Living Document, dan Append-Only.
* Menetapkan `PROJECT_STATE.md` sebagai satu-satunya source of truth untuk status dan progress.
* Menetapkan aturan: README tidak boleh memuat status (✅ ⏳ 🟡), progress (%), atau phase aktif.

### Fixed — Penghapusan Status Indicator dari README

* `product-discovery/01-business/README.md` — hapus section `Current Status`.
* `product-discovery/02-product/README.md` — hapus section `Current Status`.
* `product-discovery/03-user/README.md` — hapus section `Current Status`.
* `product-discovery/04-ux/README.md` — hapus section `Current Status`.
* `product-discovery/06-engineering/README.md` — hapus section `Current Status`.
* `product-discovery/README.md` — hapus status indicator (✅ 🟡 ⏳) dari Folder Structure dan Exit Criteria.
* `.agents/skills/project-os-navigator/SKILL.md` — hapus status indicator dari file map.

### Status

Seluruh README kini bersifat Static Reference. Status dan progress hanya ada di `PROJECT_STATE.md`.

---

## 2026-07-14 (sesi keenam)

### Changed — PROJECT_RULES.md Restructuring

* Menaikkan versi `PROJECT_RULES.md` dari 0.1.0 ke 0.2.0.
* Menambahkan section **Scope** untuk memperjelas batas aturan yang diatur dokumen ini.
* Menggabungkan `Documentation Rules` dan `Document Type Classification` menjadi satu section **Documentation Governance**, dengan subsection tambahan **Formatting Rules**.
* Memperbarui **Project Workflow**: menambahkan tahap `User` dan `Engineering` yang sebelumnya tidak tercantum, menyelaraskan dengan workflow di `product-discovery/README.md` dan milestone di `PROJECT_STATE.md`.
* Memperbaiki **Related Documents**: menghapus referensi usang `06-development/` yang tidak lagi sesuai struktur project, mengganti dengan daftar dokumen yang akurat.
* Menambahkan aturan baru pada **AI Collaboration Rules**: AI wajib mematuhi klasifikasi dokumen pada Documentation Governance.

### Status

`PROJECT_RULES.md` v0.2.0 — struktur lebih rapi, konsisten dengan milestone dan workflow terbaru.

---

## 2026-07-14 (sesi kedua)

### Added — Project OS & UX Planning Setup

* Menambahkan `CONVERSATIONS.md` — log percakapan penting antar sesi.
* Menambahkan `BRAINSTORM.md` — bank ide dari sesi brainstorming.
* Membuat `.cursor/skills/project-os-navigator/SKILL.md` — skill Cursor untuk menjaga AI selalu dalam konteks project.
* Membuat `product-discovery/04-ux/README.md` — titik masuk UX Planning (M4).

### Updated — Milestone & State

* Menyelesaikan User Discovery Review untuk `product-discovery/03-user/`.
* Menambahkan ADR-009 pada `DECISIONS.md` — User Discovery Baseline v1.0.
* Memperbarui `PROJECT_STATE.md`: M1 Discovery ✅ selesai, M4 UX Planning 🟡 aktif, progress 38%.

### Status

M1 Discovery selesai. Project masuk Phase 2 — UX Planning (M4).

---

## 2026-07-14 (sesi pertama)

### Added — Product Planning Completion

* Menambahkan `product-discovery/02-product/future-roadmap.md` sebagai backlog strategis pasca-MVP.
* Menambahkan ADR-008 pada `DECISIONS.md` untuk menetapkan Baseline Product Discovery v1.0.

### Updated — Cross-Document Synchronization

* Menandai `product-discovery/02-product/README.md` sebagai selesai (100%) dengan status review passed.
* Menyinkronkan status dan fokus terbaru pada `PROJECT_STATE.md` untuk transisi ke `product-discovery/03-user/`.
* Menyesuaikan progres overall project setelah selesainya tahap Product Planning.
* Merapikan konsistensi dokumen agar selaras dengan baseline Business v1.0 dan Product v1.0.

### Status

Product Planning selesai dan siap transisi ke User Discovery.

---

## 2026-07-13

### Added — Project Foundation

* Membuat struktur awal `project-manager/`.
* Menambahkan `README.md`.
* Menambahkan `PROJECT_OVERVIEW.md`.
* Menambahkan `PROJECT_RULES.md`.
* Menambahkan `PROJECT_STATE.md`.
* Menambahkan `DECISIONS.md`.
* Menambahkan `CHANGELOG.md`.
* Menambahkan struktur folder `product-discovery/` beserta subfolder domain.
* Menambahkan 8 dokumen awal pada `product-discovery/01-business/`.

### Updated — Documentation

* Menstandarkan struktur `product-discovery/01-business/README.md` menjadi:
  Overview, Purpose, Scope, Documents, Workflow, Expected Output,
  Exit Criteria, Decision Rules, dan Current Status.
* Menyinkronkan seluruh dokumen bisnis agar selaras dengan target market baru:
  Marketing Team (primary), Startup dan Digital Agency (secondary).
* Memperbarui `PROJECT_OVERVIEW.md`, `target-market.md`, `business-model.md`,
  `problem-statement.md`, `pricing-strategy.md`, dan `product-vision.md`.
* Menambahkan ADR-006 pada `DECISIONS.md` untuk perubahan target market.
* Menandai `product-discovery/01-business/` sebagai selesai (100%).
* Memperbarui status milestone aktif pada `PROJECT_STATE.md` ke M1 — Discovery.
* Menyesuaikan fokus project ke tahap `product-discovery/02-product/`.
* Melakukan Business Review lintas dokumen pada `product-discovery/01-business/`.
* Menyelaraskan `business-model.md` dan `pricing-strategy.md` agar konsisten (MVP free access, subscription sebagai hipotesis monetisasi).
* Menetapkan `product-discovery/01-business/` sebagai Baseline v1.0 melalui ADR-007.

### Decisions

* Memilih Hybrid Monorepo sebagai strategi repository.
* Memilih Bun sebagai JavaScript runtime.
* Memilih Next.js sebagai framework utama.
* Memilih Modular Monolith + Domain-Driven Design (DDD).
* Memilih Outstand API sebagai external integration provider.

### Status

Project Foundation sedang berlangsung.
