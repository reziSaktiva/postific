# v0.2 — Publishing MVP

> Bagian dari backlog berjenjang. Antrian: [`../AVAILABLE_TICKETS.md`](../AVAILABLE_TICKETS.md). Tiket selesai tetap di file ini. Deskripsi baru: ADR-131. Nama folder: ADR-132.
>
> **Catatan historis (2026-10-23):** tiket Done di file ini mencatat kondisi saat dikerjakan. Sebutan "Fake adapter" sebagai jalur kerja sudah usang: Fake dihapus dari jalur produksi oleh ADR-119 (`OUTSTAND_API_KEY` wajib). Sebutan "Astryx" sudah digantikan shadcn/ui (ADR-097, T-102).

**Tujuan rilis:** Memungkinkan pengguna membuat dan menjadwalkan konten.
**Baseline rilis:** `product-discovery/02-product/release-roadmap.md` → v0.2

**Rantai blocker rilis ini (catatan historis saat rilis dibuka; Real OutstandAdapter T-025 ✅ Done dan Fake jalur produksi dihapus ADR-119):** Real OutstandAdapter (T-025) belum ada → schedule hanya jalan lewat Fake · Connect account (T-013) belum ada → connected account harus di-seed · **job runner (T-027) sudah ✅ Done (2026-09-17)** — transisi status post terjadwal sekarang otomatis lewat job baru `publishing.scheduled_post.resolve_outcome` (JOB-07) begitu due, melengkapi webhook T-026 (✅ Done 2026-09-07) yang menangani transisi status pasca-publish/error/token-expired lewat inbound webhook Outstand. Provisioning Railway Cron project sungguhan masih blocked (KI-025) — job runner baru config-as-code (`railway.json`/`railway.cron.json`), belum ada service `cron` sungguhan live. Sisa rantai blocker rilis ini (per 2026-10-23): hanya T-013.4 (operasional BYOK X); T-025 sudah ✅ Done.

---

## Content Draft

### T-020 · Draft Editor sebagai modal reusable

`✅ Done` · **ADR** ADR-052 (override NP-D02)

Modal overlay fullscreen (`Dialog variant="fullscreen"`) menggantikan full-page route: caption, account selector, format per akun, Pinterest title/link, schedule date/time, confirm step in-dialog, ResumeDialog untuk draft belum tersimpan. Kode: `apps/web/src/app/[slug]/_draft-editor/modal.tsx`.

**Catatan (2026-08-05):** deskripsi di atas hanya mencakup variant Fullscreen — sejak ADR-065, Fullscreen bukan lagi satu-satunya tampilan. Toggle resmi Fullscreen/Standard (default Standard) **belum diimplementasikan** di kode ini; lihat T-038.

### T-021 · Persistensi "Save as Draft" / "Edit Draft"

`✅ Done` · **ADR** ADR-016, ADR-017, ADR-031

`PublishingService.saveDraft` / `getDraftById` / `updateDraft` + repository Prisma + Server Actions. Kode: `apps/web/src/domains/publishing/services/publishing.service.ts`.

### T-022 · Drafts List dari data asli

`✅ Done`

`listDrafts` + `drafts-list.tsx` membaca DB nyata, bukan mock.

### T-023 · Content Format per akun tujuan

`✅ Done` · **ADR** ADR-037, ADR-039

Matriks format per platform (IG/FB: Post/Reel/Story · TikTok: video feed tanpa selector · Pinterest: Pin + title/board/link · lainnya: default `post`). Kode: `apps/web/src/domains/publishing/content-format-matrix.ts`.

### T-024 · Media upload di Draft Editor

| Field         | Value                                                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done (5/5 subtask)                                                                                                                                                                                                                                               |
| **Domain**    | media · publishing                                                                                                                                                                                                                                                  |
| **ADR**       | ADR-040 (media upload working copy) · ADR-107 (batas maksimum jumlah media per `ContentFormat`, T-024.4)                                                                                                                                                            |
| **Depends**   | T-025 (Media API adapter) — **di-bypass sebagian** lewat pola Fake (rule 19 AGENTS.md, lihat catatan di bawah)                                                                                                                                                      |
| **Terkait**   | KI-059 Resolved (verifikasi manual browser T-024.4 & T-024.5, 2026-09-15) · KI-060 Resolved (ADR-125, 2026-10-12, di luar scope T-024 literal) · KI-061 Resolved (2026-10-13, tidak ada warning UI saat media over-limit setelah ganti target akun/format, ADR-107) |
| **Baca dulu** | `05-architecture/integration-layer.md` · `06-engineering/environment-management.md`                                                                                                                                                                                 |

Kontrol lampiran media di Draft Editor sudah ada tapi **disabled** dengan keterangan "Lampiran media akan tersedia setelah OutstandAdapter Media API siap".

**Feasibility check (2026-09-14):** T-024 sebelumnya tercatat depends penuh
pada T-025.5 (Real OutstandAdapter Media API) yang terhenti karena
`OUTSTAND_API_KEY`/`OUTSTAND_WEBHOOK_SECRET` asli belum ada. Diputuskan T-024
**tetap bisa dikerjakan sekarang** mengikuti rule 19 AGENTS.md (pola
ADR-059/ADR-105) — subtask yang tidak butuh kredensial asli (T-024.1 domain
skeleton, T-024.2 Supabase Storage, T-024.4 UI, T-024.5 delete) jalan duluan;
hanya T-024.3 (`OutstandAdapter` media upload working copy) yang tetap
menunggu real adapter, dan akan dibangun via `FakeOutstandAdapter` dulu
mengikuti pola yang sama saat waktunya tiba — bukan ADR baru, murni
penerapan pola yang sudah ada.

Sebelum implementasi, dicek ke Claude Design (rule 17) — rancangan Draft
Editor (`templates/draft-editor.html`) sudah punya section Media
(`.media-drop` dropzone + `.media-thumb` preview), tapi pola ini **belum
dikunci** ke primitive shadcn konkret (readme.md Claude Design: "no
dedicated FileInput primitives installed yet"; dikonfirmasi juga tidak ada
komponen file-upload/dropzone di registry shadcn resmi via MCP). King Rezi
dikonfirmasi 2 keputusan lewat `AskUserQuestion`:

1. Dropzone media di Draft Editor (T-024.4) akan dibangun sebagai **custom
   drag-drop zone** (bukan native file input polos).
2. Scope T-024 dipersempit: hanya **upload file baru + preview + delete**.
   **"Pilih dari Media Library" (browse existing media) ditunda**, tidak
   masuk scope T-024 manapun untuk saat ini.

**T-024.1 selesai (2026-09-14, Elon Backend Engineer):** skeleton domain
`media` — `apps/web/src/domains/media/types.ts` (`MediaItemRecord`),
`repositories/media.repository.ts` (interface `IMediaRepository`,
`create`/`findById`/`findByWorkspace`/`delete`, di-scope `workspaceId`+
`userId`), `services/media.service.ts` (`MediaService`, murni orchestrate
repository — **tanpa** upload fisik Storage/T-024.2 dan **tanpa**
OutstandAdapter/T-024.3) + 6 unit test baru. Implementasi Prisma di
`apps/web/src/lib/repositories/media/media.repository.ts` (pola sama
`notificationRepository`, guard `workspaceId` di level repository, RLS via
`withCurrentUser`). Shared types baru: `MediaType` enum
(`packages/shared/src/enums.ts`, sesuai `domain-model.md` § BC-08 yang sudah
lama mendefinisikan field ini) + helper `asMediaId()`
(`packages/shared/src/ids.ts`). Entity domain sengaja diletakkan di
`types.ts` (bukan file class terpisah di `entities/`) mengikuti pola anemic
model yang konsisten di seluruh 8 domain lain di repo ini. Error handling
pakai `NotFoundError`/`ConflictError` dari `@/lib/utils/errors` (bukan
`MediaDomainError` scaffold domain ini yang memang tidak pernah dipakai
domain manapun). Verifikasi: `bun run typecheck` 0 error, `bunx vitest run`
338 pass/5 skip, tanpa regresi. Review arsitektur Ridwan Architecture
Reviewer: **0 temuan** — domain tidak import Prisma/Supabase langsung, guard
ownership `workspaceId` di level repository (anti-IDOR), shared types murni
value object, tidak ada over-scoping ke T-024.2/T-024.3/T-024.4/T-024.5.

**T-024.2 selesai (2026-09-14, Elon Backend Engineer):** upload ke Supabase
Storage — port `IMediaStorageAdapter`
(`apps/web/src/domains/media/adapters/media-storage-adapter.ts`, mirror pola
`IAvatarStorageAdapter`), `ALLOWED_MEDIA_MIME_TYPES`/`MAX_MEDIA_FILE_SIZE_BYTES`
(`apps/web/src/domains/media/validation.ts`), `UploadMediaUseCase`
(`apps/web/src/domains/media/services/upload-media.use-case.ts`) sebagai use
case terpisah (pola ADR-059/`SchedulePostsUseCase`, constructor
`IMediaRepository` + `IMediaStorageAdapter`) — validasi mime type + ukuran
file sebelum upload, upload ke storage, create record DB, cleanup best-effort
(hapus file storage) kalau create DB gagal setelah upload sukses (rethrow
error asli, bukan error cleanup). Implementasi Supabase:
`SupabaseMediaStorageAdapter`
(`apps/web/src/lib/adapters/media-storage/supabase-media-storage-adapter.ts`)
— bucket `media` **Private** (beda dari `avatars` yang public), pakai
**signed URL**, path `{workspaceId}/{year}/{month}/{uuid}.{ext}`. Migration
`apps/web/prisma/migrations/20260914090000_t024_2_create_media_bucket/migration.sql`
membuat bucket `media` (idempotent, pola sama bucket `avatars`) — **sudah
dibuat tapi belum dijalankan**, perlu `bun run db:deploy` oleh King Rezi
sebelum fitur ini bisa diuji end-to-end. Review Ridwan Architecture Reviewer:
**0 temuan pelanggaran arsitektur** (verifikasi independen: `typecheck` 0
error, 343 test pass/5 skip saat itu); satu catatan non-blocking: bucket
awalnya dibuat tanpa `file_size_limit` (gap baseline dibanding `avatars` yang
eksplisit 2MB), diteruskan sebagai rekomendasi butuh keputusan King Rezi.
King Rezi dikonfirmasi via `AskUserQuestion`: **batas ukuran file maksimum
media MVP = 50 MB (52.428.800 bytes)** — bukan keputusan arsitektural,
murni parameter konfigurasi operasional (sama seperti batas 2MB avatar yang
juga tidak punya ADR khusus), sehingga cukup dicatat di sini, tanpa ADR baru.
Elon menerapkan keputusan itu sebagai follow-up: `file_size_limit` migration
diisi 50MB, `MAX_MEDIA_FILE_SIZE_BYTES` di `validation.ts`, validasi ukuran
file di `UploadMediaUseCase.execute` (menolak sebelum panggil storage
adapter), 1 unit test baru. Verifikasi akhir: `bun run typecheck` 0 error,
`bunx vitest run` **344 pass/5 skip**, tidak ada regresi.

**T-024.3 selesai (2026-09-14, Elon Backend Engineer):** `OutstandAdapter`
media upload working copy via `FakeOutstandAdapter` — kontrak
`UploadMediaWorkingCopyInput`/`UploadMediaWorkingCopyResult` + method
`uploadMediaWorkingCopy` ditambahkan ke `IOutstandAdapter`
(`packages/shared/src/contracts/outstand-adapter.ts`). Implementasi Fake di
`apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts` — instant
always-success (pola ADR-059), `outstandMediaId` unik per panggilan
(`crypto.randomUUID()`), `expiresAt` mock +24 jam, 2 unit test baru. 7 file
test lain (mock `IOutstandAdapter`) ditambah stub field baru supaya tetap
type-safe, tanpa mengubah behavior test yang sudah ada. **ADR-106 baru**
dibuat: keputusan menggabungkan 3 langkah Outstand Media API (request upload
URL → PUT → confirm) jadi **1 method ACL gabungan** (bukan split 2-method
seperti `connectAccount`/`exchangeConnectCode` di ADR-105) — karena tidak
ada redirect browser yang perlu diuji terpisah di sini, murni server-to-server
berurutan. Detail lengkap:
[`decisions/ADR-106-fake-media-upload-working-copy-1-method-gabungan.md`](../decisions/ADR-106-fake-media-upload-working-copy-1-method-gabungan.md).
Scope SENGAJA tidak menyentuh `UploadMediaUseCase`/`MediaService`/UI —
method baru murni kontrak+Fake, belum di-wire ke manapun. Review Ridwan
Architecture Reviewer: **0 temuan pelanggaran** (verifikasi independen
`typecheck` 0 error, **346 test pass/5 skip**, naik dari baseline 344/5).
Ridwan mencatat 1 risiko forward-looking (non-blocking, dicatat di ADR-106
sendiri): kalau Real adapter (T-025.5) nanti butuh retry granular per-langkah
(mis. PUT gagal terpisah dari request URL), kontrak 1-method gabungan ini
mungkin perlu di-split lagi lewat ADR baru.

**T-024.4 selesai (2026-09-14, Prabowo Feature Engineer):** kontrol lampiran
media di Draft Editor diaktifkan penuh + preview — full-stack (Server
Action → service → repository → UI). Sebelum implementasi, King Rezi
mengonfirmasi 2 keputusan baru lewat `AskUserQuestion`: (1) Draft Editor
mendukung **multi-media (carousel)**, batas jumlah TERGANTUNG
`ContentFormat` (`Post` maks 10, `Reel`/`Story`/`Pin` maks 1; kalau draft
menargetkan beberapa akun dengan format berbeda sekaligus, batas efektif =
**MINIMUM** dari batas semua format yang dipilih) — mengamandemen ADR-039 →
**ADR-107 baru**
([`decisions/ADR-107-batas-maksimum-jumlah-media-per-content-format.md`](../decisions/ADR-107-batas-maksimum-jumlah-media-per-content-format.md)).
(2) "Pilih dari Media Library" (browse existing) tetap ditunda sesuai
keputusan sebelumnya — ditampilkan sebagai link **disabled dengan tooltip
"Coming soon"**, bukan disembunyikan total. Implementasi:
`content-format-matrix.ts` (`MAX_MEDIA_COUNT_BY_FORMAT`,
`maxMediaCountForFormat(s)`, `assertMediaCountWithinLimit`, ADR-107);
`resolve-draft-media-ids.ts` baru (validasi ownership `mediaIds`,
workspace-scoped, anti-IDOR, pola sama `resolveScheduleTargets`);
`PublishingService.saveDraft`/`updateDraft` + `IPublishingRepository` +
implementasi Prisma — kolom `media_ids` (dead sejak schema dibuat) di-wire
penuh dengan partial-update semantics (`mediaIds: undefined` = kolom tidak
disentuh, `[]` = kolom dikosongkan); `MediaService`/`IMediaRepository`
method baru `findByIds`/`listByIds` (batch fetch, workspace-scoped); Server
Action baru `uploadMediaAction`
(`apps/web/src/app/(app)/components/draft-editor/actions.ts`) — pertama
kalinya domain `media` (T-024.1–.3) benar-benar disambungkan ke UI;
`saveDraftAction`/`updateDraftAction`/`getDraftAction`/`scheduleDraftAction`/
`publishNowAction` diperluas dengan `mediaIds`. UI (`Modal.tsx`): blok Media
disabled diganti custom dropzone (drag-drop + click-browse), grid preview
thumbnail multi-media, tombol hapus-per-item (unlink dari draft, **bukan**
delete permanent — itu tetap T-024.5), enforce batas count di client
(mirror server, ADR-107). Review Ridwan Architecture Reviewer (2 putaran):
putaran 1 — **1 temuan MEDIUM**: `resolveAndValidateMediaIds` dkk selalu
meng-collapse "field tidak dikirim" jadi `[]` (`?? []`), sehingga partial-
update semantics (`undefined` = kolom tidak disentuh) tidak pernah benar-
benar tereksekusi dari caller yang ada — bukan bug aktif hari ini (satu-
satunya caller, `Modal.tsx`, selalu kirim array konkret), tapi berisiko
silent data loss untuk entry point masa depan (mis. Route Handler `/api/v1`
yang tidak kirim `mediaIds`). Diperbaiki: bedakan `undefined` vs `[]` dari
titik paling awal (`resolveAndValidateMediaIds`, resolusi di
`scheduleDraftAction`/`publishNowAction`) sampai ke `PublishingService`, 12
unit test baru menguji 3 skenario di 4 Server Action. Putaran 2 (verifikasi
ulang): **0 temuan**, fix dikonfirmasi benar di level kode, `Modal.tsx`
tidak berubah/tidak regresi. Verifikasi akhir: `typecheck` 0 error, `lint`
0 error/warning, `vitest` **374 pass/5 skip** (naik dari baseline 362,
346 sebelum T-024.4 mulai).

**Gap verifikasi (KI-059, Resolved 2026-09-15):** verifikasi manual browser
end-to-end (upload → save draft → reopen edit → preview restore → validasi
batas count per format) sempat tercatat belum bisa dilakukan karena
`DATABASE_URL` tidak terbaca di worktree — root cause ternyata dev server
sempat start dari `cwd` repo `main` yang salah, bukan env var yang
benar-benar hilang. Setelah dijalankan dengan `cwd` worktree yang benar,
seluruh kriteria PASS (detail: `COMPLETE_TASK.md` 2026-09-15). T-024.4
sekarang teruji penuh end-to-end, bukan hanya verifikasi kode.

**T-024.5 selesai (2026-09-14, Prabowo Feature Engineer):** Delete Media +
dialog konfirmasi Tier 2 (ADR-049) — subtask **terakhir** T-024, menutup
task ini **5/5**. King Rezi mengonfirmasi lewat `AskUserQuestion`: tombol
"hapus dari post ini" yang dibangun T-024.4 (unlink-only dari draft, tanpa
dialog, tidak menghapus data) diganti **total** jadi aksi destruktif — klik
→ dialog konfirmasi Tier 2 → kalau dikonfirmasi, hapus file Storage + record
`MediaItem` DB secara **permanen**. Implementasi: `DeleteMediaUseCase` baru
(`apps/web/src/domains/media/services/delete-media.use-case.ts`) — urutan
operasi hapus record DB dulu (`MediaService.deleteMediaItem`, throws
`NotFoundError` kalau tidak ada/bukan milik workspace, Storage tidak
disentuh kalau ini gagal), baru best-effort hapus file Storage (swallow
error — orphan file di Storage tanpa record dianggap harmless dibanding
record menunjuk file hilang yang broken/user-visible); Server Action baru
`deleteMediaAction` — wiring tipis ke use case, `workspaceId` dari session
(anti-IDOR, bukan input client); UI `Modal.tsx` — `handleRemoveMedia` lama
(unlink) dihapus total, diganti wiring **reuse komponen existing**
`ConfirmActionDialog`/`useConfirmAction` (pola sama persis "Hapus Draft" di
`DraftsList.tsx`, bukan dialog baru dari nol). Review Ridwan Architecture
Reviewer: **0 temuan** — urutan operasi delete (DB dulu, Storage
best-effort) diverifikasi benar di kode+test, anti-IDOR terjaga
(workspace-scoped di level repository, konsisten pola T-024.1), reuse
komponen Tier 2 genuine dikonfirmasi (bukan duplikat), tidak ada dead code
path lama yang tersisa. Verifikasi akhir: `bun run typecheck` 0 error,
`bun run --cwd apps/web lint` 0 error/warning, `bunx vitest run` **377
pass/5 skip** (naik dari baseline 374, +3 test baru). Gap verifikasi manual
browser yang sempat berlaku sama untuk T-024.5 sudah ditutup — lihat
**KI-059 Resolved** di atas (cakupannya meliputi seluruh T-024, bukan cuma
T-024.4).

**Penutup T-024 (5/5 subtask, ✅ Done):** seluruh rangkaian ini dikerjakan
lintas beberapa sesi — T-024.1 (domain `media` skeleton), T-024.2 (upload
Supabase Storage), T-024.3 (`OutstandAdapter` media upload working copy via
`FakeOutstandAdapter`, ADR-106), T-024.4 (aktifkan lampiran + preview di
Draft Editor, ADR-107), dan T-024.5 (Delete Media Tier 2, di atas). Semua
5 subtask lolos review Ridwan Architecture Reviewer; satu-satunya temuan
sepanjang task ini adalah **1 temuan MEDIUM di T-024.4** (partial-update
semantics `mediaIds`), sudah diperbaiki dan diverifikasi ulang (putaran 2:
0 temuan). Verifikasi kode akhir keseluruhan: `typecheck`/`lint` bersih,
`vitest` 377 pass/5 skip. Verifikasi manual browser end-to-end
(**KI-059**) sudah **Resolved** (2026-09-15) — seluruh 6 kriteria PASS,
T-024 sekarang teruji penuh end-to-end, bukan hanya verifikasi kode.
Satu temuan baru di luar scope selama verifikasi ini: **KI-060** (Account
Selector tidak ter-restore saat reopen edit draft, bukan regresi T-024,
sudah **Resolved** via ADR-125, 2026-10-12).

**Update (2026-10-13) — KI-061 Resolved** (branch
`fix/close-ki-batch-014-024-036`, belum di-commit; bukan subtask formal
baru, tetap tercatat di luar 5/5 T-024.x literal): rancangan dibuat di
Claude Design (`templates/draft-editor.html` + `styles.css`, additive) di
sesi utama, lalu diimplementasikan Mark UI Engineer di `Modal.tsx` —
`overLimitMediaCount`, badge warning dekat teks "Maks. X media",
border+background warning + `Badge variant="warning"` di pojok kiri-atas
tiap thumbnail over-limit (index >= `effectiveMaxMedia`, konsisten dengan
`assertMediaCountWithinLimit` di server). Diverifikasi: typecheck+lint 0
error, browser testing real upload+delete di light & dark mode, tanpa
regresi. Detail: `COMPLETE_TASK.md`.

- [x] **T-024.1** Domain `media` skeleton (service + repository, model `MediaItem` sudah ada di schema)
- [x] **T-024.2** Upload ke Supabase Storage (Supabase JS client **hanya** untuk Storage/Realtime — CRUD tetap Prisma)
- [x] **T-024.3** `OutstandAdapter` media upload working copy (ADR-040) — via `FakeOutstandAdapter` (ADR-106), belum di-wire ke `UploadMediaUseCase`/UI
- [x] **T-024.4** Aktifkan kontrol lampiran di Draft Editor + preview — dropzone **custom** (bukan native file input), sesuai keputusan `AskUserQuestion` di atas
- [x] **T-024.5** Delete Media + dialog konfirmasi (ADR-049 Tier 2) — scope: upload file baru + preview + delete saja; "Pilih dari Media Library" (browse existing) ditunda

### T-038 · Toggle Fullscreen/Standard resmi di Draft Editor

| Field         | Value                                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**    | ✅ Done                                                                                                                                                                              |
| **Domain**    | publishing (UI)                                                                                                                                                                      |
| **ADR**       | ADR-065 (amandemen ADR-052)                                                                                                                                                          |
| **Depends**   | T-020 (modal Draft Editor sudah ada — Done)                                                                                                                                          |
| **Baca dulu** | `decisions/ADR-065-draft-editor-toggle-fullscreen-standard-jadi-fitur-resmi-default-standard.md` · `04-ux/key-screen-patterns.md` (KSP-05) · `04-ux/navigation-patterns.md` (NP-D11) |

**Ditemukan sudah selesai (2026-09-10):** seluruh 4/4 subtask ternyata sudah
terimplementasi penuh sebagai bagian tak tercatat dari **T-100** (migrasi
Draft Editor Modal ke shadcn/ui, selesai 2026-09-03) — status task ini
sempat tidak diperbarui saat itu. Diverifikasi ulang lewat browser real
(New Post & Edit Draft, branch `feature/t-038-draft-editor-fullscreen-standard-toggle`):
default Standard, toggle di header (label berganti sesuai variant aktif),
klik → Fullscreen (full viewport tanpa backdrop terlihat), reset ke
Standard tiap sesi baru dibuka, berlaku sama untuk New Post & Edit Draft.
Kode: `apps/web/src/app/(app)/components/draft-editor/Modal.tsx` (state
`dialogVariant` baris ~958-976, toggle di header baris ~549-563). Tidak ada
gap terhadap mockup Claude Design (`templates/draft-editor.html`) atau
ADR-065. Tidak ada perubahan kode di sesi ini — murni koreksi status.

- [x] **T-038.1** Tambah variant Standard (`Dialog` non-fullscreen, floating card + backdrop) berdampingan dengan variant Fullscreen yang sudah ada
- [x] **T-038.2** Toggle di header modal (sebaris status chip, kiri tombol Close) untuk berpindah Fullscreen ↔ Standard
- [x] **T-038.3** Default state Standard setiap modal dibuka — tidak dipersist (localStorage/preference) sesuai ADR-065
- [x] **T-038.4** Berlaku untuk New Post dan Edit Draft, keduanya

---

## Outstand Runtime (ADR-040)

### T-025 · Real OutstandAdapter (HTTP client)

| Field         | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done — KI-072 (Pinterest `board_id`) selesai diimplementasikan via ADR-118 (2026-09-25), 7/7 subtask tetap selesai                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Domain**    | integration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **ADR**       | ADR-005, ADR-019, ADR-040, ADR-059                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Terkait**   | KI-003, KI-015, KI-067 (sebagian resolved via ADR-112, sisa scope KI-070 Resolved), KI-068 (Resolved via ADR-113), KI-069 (Resolved via ADR-114), KI-070 (Resolved 2026-09-24 — flow multi-halaman Facebook Pages via ADR-115/ADR-116, UI Mark UI Engineer, 2 bug fix Elon Backend Engineer), KI-071 (Resolved via ADR-117, 2026-09-25), KI-072 (Resolved via ADR-118, 2026-09-25 — `listPinterestBoards` + `board_id` opsional per-post), ADR-112, ADR-113, ADR-114, ADR-115, ADR-116, ADR-117, ADR-118 (`PROJECT_STATE.md` § Known Issues) |
| **Depends**   | T-028 ✅ (port + factory sudah ada) · kredensial Outstand asli                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Baca dulu** | `05-architecture/integration-layer.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

Port `IOutstandAdapter` dan factory `getOutstandAdapter()` sudah ada. Factory **sengaja throw** jika `OUTSTAND_API_KEY` terisi tapi kode real adapter belum ada — bukan silent fallback ke Fake.

- [x] **T-025.1** HTTP client + auth header + error mapping ke domain error (Anti-Corruption Layer)
- [x] **T-025.2** `schedulePost` real (menggantikan Fake pada jalur produksi)
- [x] **T-025.3** `publishNow` real (dipakai T-029)
- [x] **T-025.4** `connectAccount` redirect flow (dipakai T-013) — flow **single-page** (Instagram/X/LinkedIn/Threads/TikTok/YouTube/Pinterest dkk) sudah selesai lewat **ADR-112** (`resolveConnectCallback` menggantikan `exchangeConnectCode`). Flow **multi-halaman Facebook Pages** (session-token, **KI-070, Resolved 2026-09-24**): desain UI **CONFIRMED King Rezi** (`templates/settings-connect-facebook-pages.html`), kontrak backend **ADR-115** (Proposed) dikoreksi wire-format-nya via **ADR-116** (Accepted), backend diimplementasikan penuh dan lolos review Ridwan Architecture Reviewer (0 temuan), lalu **UI dialog `FacebookPagesPickerDialog.tsx` diimplementasikan Mark UI Engineer** (4 state Loading/Default/Selected/Empty + Error, shadcn `Dialog`/`Checkbox`/`Item`/`ItemGroup`/`Empty`/`Alert`/`Skeleton`, row Page full-row click sesuai gate desain terverifikasi). **2 bug kritis ditemukan + diperbaiki Elon Backend Engineer** saat verifikasi end-to-end klik natural (detail lengkap di catatan "Update (2026-09-24, penutupan KI-070)" di bawah), lolos review Ridwan putaran final (0 temuan) dan **QA final Najwa PASS** (Connect + Reconnect Facebook via klik natural, regresi platform lain aman). Subtask ditutup selesai
- [x] **T-025.5** Media API (dipakai T-024)
- [x] **T-025.6** Engagement fetch/reply (dipakai v0.4) — redesain per-post via **ADR-113**, KI-068 Resolved (2026-09-24)
- [x] **T-025.7** Unit test adapter dengan HTTP mock — belum ada test adapter sama sekali

> Kredensial `OUTSTAND_API_KEY` / `OUTSTAND_WEBHOOK_SECRET` asli belum dimiliki King Rezi. Fake adapter (T-028) sengaja dibuat supaya rilis ini tidak berhenti menunggu.

**Catatan (2026-09-23, 2 putaran Elon Backend Engineer):** Putaran 1
implementasi best-effort tanpa dokumentasi resmi Outstand. King Rezi lalu
setup MCP resmi Outstand (`mcp.outstand.so`), dari situ ditemukan dokumentasi
REST API publik resmi (`https://api.outstand.so/v1/*/openapi.json`) — Elon
mengoreksi seluruh implementasi berdasarkan spec resmi di putaran 2. Ridwan
Architecture Reviewer audit independen: 0 temuan pelanggaran arsitektur,
`bun run typecheck`/`lint`/`test` hijau (486 pass, 6 skip, 0 fail), ACL
boundary terjaga.

Selesai dan terverifikasi terhadap API resmi: HTTP client + auth + error
mapping (T-025.1), `schedulePost`/`publishNow` real via `POST /v1/posts`
(T-025.2/T-025.3), Media API 3-langkah upload→PUT→confirm (T-025.5), unit
test HTTP mock 82 test (T-025.7), plus analytics (`fetchPostMetrics`/
`fetchWorkspaceMetrics`, kontrak T-041) yang dikoreksi ke
`GET /v1/posts/{id}/analytics` dan `GET /v1/social-accounts/{id}/metrics`,
dan cancel/delete post (`DELETE /v1/posts/{id}`,
`DELETE /v1/posts/{id}/remote`).

**Update (2026-09-23, Elon Backend Engineer, lolos review Ridwan 0 temuan):**
**KI-067 sebagian resolved** — flow **single-page** (Instagram/X/LinkedIn/
Threads/TikTok/YouTube/Pinterest dkk) sudah diimplementasikan penuh lewat
**ADR-112**: kontrak `exchangeConnectCode({code, state})` diganti
`resolveConnectCallback(ConnectCallbackInput)` (`state`, `outstandAccountId`,
`username`, `networkUniqueId?`) karena Outstand ternyata redirect balik
langsung dengan query param akun, bukan `code` untuk di-exchange. Perubahan:
`packages/shared/src/contracts/outstand-adapter.ts`,
`fake-outstand-adapter.ts`/`real-outstand-adapter.ts` (+test),
`connect-state.ts`, Route Handler
`apps/web/src/app/api/integrations/outstand/callback/route.ts`,
`workspace.service.ts`/`workspace.repository.ts` (+test), `env.ts`, dan 8
file test domain lain (rename stub mock). Typecheck bersih, 474 test
passed/6 skipped (full suite), Ridwan re-verifikasi 129 test terkait
langsung — 0 temuan arsitektur. T-013/T-015 **tidak perlu rework** (ADR-112
§6 — perubahan murni di boundary parameter, bukan alur bisnis).

**Update (2026-09-24, Elon Backend Engineer, lolos review Ridwan 0 temuan):**
**KI-068 Resolved** — kontrak `fetchComments`/`replyToComment` diredesain
per-post sesuai API resmi Outstand lewat **ADR-113** (amandemen ADR-110):
`fetchComments` sekarang menerima `outstandPostId`/`platform`/
`accountUsername` (tanpa cursor, `FetchCommentsResult.nextCursor` dihapus
total); `replyToComment` menerima `outstandPostId` (wajib) +
`parentOutstandCommentId` (opsional, threading). `SyncCommentsUseCase`
(T-051, JOB-03) diredesain loop per-post lewat port lokal
`PublishingPostsPort` (cross-domain via composition root, bukan import file
internal domain lain — dikonfirmasi bersih oleh Ridwan). Real adapter
diimplementasikan penuh (menggantikan throw gap sebelumnya), Fake adapter
disesuaikan (tetap instant/deterministic, ADR-059). Typecheck bersih, lint
bersih, Vitest 480 pass/6 skip/0 fail. Migration baru
`20260924090000_ki068_add_handle_to_account_owner_lookup` **belum
di-deploy** (`bun run db:deploy` pending King Rezi, lihat `PROJECT_STATE.md`
§ Blockers). Gap baru ditemukan (bukan bug, keputusan scope King Rezi):
endpoint reply Outstand menerima `account_username`/`platform_post_id`
opsional untuk disambiguasi post yang publish ke >1 akun di network sama —
signature `replyToComment` yang dikonfirmasi tidak membawa field itu,
dicatat **KI-071** (baru, tidak memblokir penutupan KI-068). **Update (2026-09-25):** KI-071 Resolved via **ADR-117** (`replyToComment` wajib `accountUsername`).

**Update (2026-09-24, Elon Backend Engineer, lolos review Ridwan 0
temuan):** **KI-069 Resolved** — `OutstandPostTargetInput` ditambah field
wajib `platform: SocialPlatform` lewat **ADR-114**, diteruskan dari data
yang sudah ada di scope caller (`schedule-posts.use-case.ts`,
`publish-now.use-case.ts`, `retry-failed-target.use-case.ts`).
`RealOutstandAdapter` menambah fungsi baru `computePlatformOverride`
(memetakan `contentFormat` ke shape asli Outstand per network — Instagram
Story → `publishAsStory`, Facebook Story/Reel → `publishAsStory`/
`publishAsReel`, edge case konflik same-network `contentFormat` berbeda
ditangani first-match-wins + `console.warn`). Typecheck/lint bersih, Vitest
487 pass/6 skip/0 fail (full suite). **Pinterest `board_id` sengaja belum
diimplementasikan** (domain/UI tidak pernah mengumpulkannya) — key
`pinterest` tetap tidak dikirim ke Outstand, dicatat **KI-072** (baru).
**Update (2026-09-25):** rancangan UI board-picker sudah selesai di Claude
Design (scope per-post, tidak butuh schema Prisma baru) — lihat catatan
lengkap di bawah dan di `PROJECT_STATE.md` § KI-072. Implementasi kode
masih pending.

**Update (2026-09-24, Elon Backend Engineer, lolos review Ridwan 0
temuan):** **Backend Facebook Pages (KI-070) selesai diimplementasikan** —
kontrak ADR-115 diverifikasi wire-formatnya lewat WebFetch dokumentasi
resmi Outstand, ditemukan 4 dari 4 asumsi ADR-115 salah (query param
callback `session` bukan `session_token`; path finalize
`POST /v1/social-accounts/pending/{sessionToken}/finalize`, ada suffix
`/finalize`; response GET dibungkus `data.availablePages[]` field
`id`/`profilePictureUrl`; response POST `connectedAccounts[]` field
`id`/`username`/`nickname`) — dicatat sebagai amandemen **ADR-116**
(Accepted). Kontrak `packages/shared` tidak berubah, koreksi murni mapping
wire↔domain di `real-outstand-adapter.ts`. Perubahan: kontrak
`outstand-adapter.ts`, `real-outstand-adapter.ts`, `fake-outstand-adapter.ts`
(3 fixture Page), `workspace.service.ts` (2 method baru:
`listFacebookPendingPages`/`confirmFacebookPagesConnection`, RBAC reuse,
skip-bukan-gagal per Page, JOB-03 seeding), Route Handler callback
(percabangan baca `session`), 2 Server Action baru di
`connected-accounts/actions.ts`, plus test baru + stub minimal di 10 file
test lain. Typecheck/lint bersih, Vitest 498 pass/6 skip/0 fail. Ridwan
Architecture Reviewer: **0 temuan** (satu catatan non-blocking — strip
query param `session` dari address bar, didelegasikan ke Mark UI Engineer
saat implementasi dialog). **Update lanjutan di bawah** — UI dialog
Facebook Pages Picker (Mark UI Engineer) sudah dikerjakan setelahnya,
subtask T-025.4 ditutup selesai.

**Update (2026-09-24, penutupan KI-070) — UI dialog + 2 bug fix + QA final
PASS, KI-070 Resolved:** Mark UI Engineer mengimplementasikan
`FacebookPagesPickerDialog.tsx` (4 state Loading/Default/Selected/Empty +
Error) di `apps/web/src/app/(app)/settings/connected-accounts/`, wire ke
`listFacebookPendingPagesAction`/`confirmFacebookPagesConnectionAction`
yang sudah ada, row Page full-row click sesuai gate desain (diverifikasi
langsung terhadap Claude Design, cocok). QA Najwa putaran 1 menemukan
`FakeOutstandAdapter.connectAccount()` belum bercabang untuk Facebook
(diperbaiki Elon) — lalu ditemukan **Bug #1**: klik natural "Connect
Account → Facebook" gagal 405 (browser POST ke Route Handler
`GET`-only di `apps/web/src/app/api/integrations/outstand/callback/route.ts`,
padahal navigasi URL manual berhasil) — fix permanen: alias
`export const POST = GET`. Retest mengungkap **Bug #2**: dialog terbuka
tapi macet selamanya di Loading (`listFacebookPendingPagesAction` tidak
pernah terpanggil) — root cause: `FakeOutstandAdapter` Facebook loopback
ke domain kita sendiri (bukan domain eksternal seperti platform lain),
sehingga redirect chain Server Action → Route Handler → balik ke halaman
diperlakukan Next.js App Router sebagai satu transisi client-side yang
membuat action-dispatch queue macet — **murni artefak Fake-mode testing,
tidak terjadi di produksi** (Real adapter selalu redirect ke domain
eksternal `outstand.so` di hop pertama). Fix: `initiateConnectAccountAction`/
`initiateReconnectAccountAction`
(`connected-accounts/actions.ts`) khusus `platform === Facebook` tidak lagi
`redirect()` di server — return `{ redirectUrl }`, client
(`ConnectPlatformMenu.tsx`, `ReconnectButton` di
`ConnectedAccountsList.tsx`, `FacebookPagesPickerDialog.tsx`) melakukan
`window.location.href` (hard navigation); platform lain tidak berubah.
Test baru `route.test.ts` (4 test) + `actions.test.ts` (4 test), total
naik ke **509 passed/6 skipped**. Ridwan Architecture Reviewer putaran
final: **0 temuan** (rule #5 AGENTS.md tidak dilanggar — perubahan murni
"siapa memicu navigasi browser", bukan business logic baru). **Najwa QA
final: PASS** — Connect Facebook via klik natural, **Reconnect Facebook**
(jalur baru, berhasil teknis), regresi platform lain (Instagram/X) dan
screen lain aman. **Catatan non-blocking (keputusan eksplisit King
Rezi):** Reconnect Facebook Page tunggal selalu **CREATE**, bukan
**UPDATE** (sudah di luar scope sejak ADR-115 poin 8) — badge "Perlu
Reconnect" di akun asal tidak hilang setelah reconnect. Didokumentasikan
sebagai keterbatasan, **tidak** ada task susulan yang dibuat untuk ini
sekarang.

**Update (2026-09-25, Elon Backend Engineer, hardening code-review PR #133
— T-025 tetap `✅ Done`, bukan reopen):** King Rezi meminta implementasi
rencana perbaikan dari code-review PR #133. Elon Backend Engineer
menerapkan perbaikan; Ridwan Architecture Reviewer: **0 temuan**; Vitest
**130** test terkait lulus; typecheck bersih. Tidak ada commit/push di
sesi ini. Perbaikan (follow-up hardening di atas T-025 yang sudah
selesai, bukan membuka ulang seluruh task):

1. **CRITICAL** — migration
   `20260925094500_restore_webhook_lookup_privileges`: `REVOKE` dari
   `PUBLIC` + `GRANT` ke `app_runtime` pada fungsi SECURITY DEFINER
   webhook lookup (regresi setelah `DROP`/`CREATE` di migrasi KI-068).
2. Facebook session token tidak lagi di URL halaman — cookie httpOnly
   `outstandFacebookSession_<nonce>`; query hanya
   `connectFacebook=1&connectFacebookState` (hardening implementasi
   ADR-115/ADR-116, tanpa ADR baru).
3. Media di-wire ke create-post lewat containers; Story tanpa caption;
   campuran Story + feed ber-caption throw keras.
4. `deletePost` dengan `accountIds` throw; `RetryFailedTargetUseCase`
   skip wipe bila sibling target masih live.
5. Upsert inbox engagement backfill `postId` pada update.
6. Tombol Facebook Reconnect disembunyikan (belum ada jalur UPDATE).
7. Presigned upload URL di-redact dari pesan error.
8. IG Reel `coverImageUrl` → `reelCoverUrl`; HTTP 429 retryable.
9. Sync comments: hanya published, limit 50, try/catch per-post.
10. Test CSRF untuk aksi list/confirm Facebook; factory trim API key.

**KI-071** sudah **Resolved via ADR-117 (2026-09-25)** — lihat catatan
update KI-068 / T-025.6 di atas. **KI-072** tetap **Open** (gap yang
diterima King Rezi, bukan bug yang diperbaiki di putaran hardening PR #133).

**Update (2026-09-25, Gibran Project Manager) — KI-072 rancangan UI
selesai, implementasi kode masih pending:** King Rezi mengonfirmasi 2
keputusan scope lewat `AskUserQuestion` — (1) board Pinterest dipilih
**per post** (di Draft Editor saja), bukan per akun/Connected Accounts,
bukan hybrid, sehingga implementasi nanti **tidak butuh schema Prisma
baru**; (2) rancangan board-picker sudah selesai di Claude Design (project
"Social Media Management"): field "Board" Pinterest di
`templates/draft-editor.html` diganti dari free-text `<input>` jadi native
`<select class="select">` bergaya sama seperti "Filter Akun" di
`components/forms.html` (opsi mock: "Pilih board…"/"Resep &
Minuman"/"Interior Kedai"/"Promo Musiman"), disamakan juga di showcase
`components/forms.html` dan 2 occurrence markup `.pin-fields` di
`templates/app-prototype/AppPrototype.dc.html`. Status KI-072 **tetap
Open** — yang selesai baru rancangan UI; implementasi kode (fetch board
list dari Outstand `list_pinterest_boards` saat compose + kirim `board_id`
terpilih di request publish Pinterest, domain/UI `apps/web`) masih task
terpisah yang belum dikerjakan.

**Update (2026-09-25, Elon Backend Engineer + Mark UI Engineer, lolos
review Ridwan 0 temuan) — KI-072 Resolved via ADR-118:** kontrak
`IOutstandAdapter` ditambah `listPinterestBoards(outstandAccountId):
Promise<PinterestBoard[]>` (type `PinterestBoard{id,name}`).
`RealOutstandAdapter.computePlatformOverride` sekarang mengirim
`{board_id, title?, link?}` ke Outstand kalau `platformOptions.boardId`
terisi (kosong tetap `null`, tidak regresi); wire-format diverifikasi via
WebFetch OpenAPI resmi Outstand (`api.outstand.so/v1/posts/openapi.json`,
`api.outstand.so/v1/pinterest/openapi.json`) — endpoint list board
`GET /v1/pinterest/accounts/{id}/boards`. `FakeOutstandAdapter` mock 3
board tetap (ADR-059), selaras Claude Design. `WorkspaceService
.listPinterestBoards` anti-IDOR (validasi `connectedAccountId` milik
workspace + platform Pinterest) sebelum delegasi adapter, semua member
aktif boleh akses. Server Action baru `listPinterestBoardsAction`. UI
`Modal.tsx`: dropdown `<Select>` shadcn 3 state (loading/error+retry/sukses),
state `boardIdByAccount` **per-akun** (bukan global — fix dari bug QA
putaran 1: satu state global membuat pilihan board 1 akun menimpa akun
Pinterest lain saat 2+ dicentang bersamaan), urutan field final Pin Title →
Destination Link → Board sesuai Claude Design. Typecheck/lint bersih,
Vitest 547 pass/6 skip/0 fail, Ridwan Architecture Reviewer 0 temuan.
**Catatan non-blocking (dikonfirmasi King Rezi via `AskUserQuestion`):**
retest visual browser skenario 2+ akun Pinterest dipilih bersamaan (pilih
board berbeda per akun) belum sempat dilakukan — blocker environment lokal
(`.env.local` berisi `OUTSTAND_API_KEY` asli saat sesi QA, dev server
otomatis pakai `RealOutstandAdapter` yang menolak akun Pinterest palsu
`HTTP 400`), bukan bug kode. King Rezi mengonfirmasi lanjut berdasarkan
verifikasi kode (typecheck/lint/test/architecture review) tanpa menunggu
retest tersebut. Detail lengkap: `decisions/ADR-118-listpinterestboards-board-id-per-post-ki072.md`.

Detail teknis lengkap ada di docstring
`apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts`.

### T-026 · Webhook handler Outstand

| Field         | Value                                                                |
| ------------- | -------------------------------------------------------------------- |
| **Status**    | ✅ Done                                                              |
| **Domain**    | integration                                                          |
| **ADR**       | ADR-020, ADR-040, ADR-099, ADR-108, ADR-109                          |
| **Terkait**   | KI-003 (via T-025), KI-015, KI-063 (baru, `publishedAt` tidak diisi) |
| **Depends**   | T-025                                                                |
| **Baca dulu** | `05-architecture/integration-layer.md`                               |

`/api/webhooks/outstand` masih return 501. Model `OutstandWebhookEvent` sudah ada di schema, `OUTSTAND_WEBHOOK_SECRET` sudah didefinisikan di `src/lib/env.ts` tapi belum dipakai.

**Catatan tambahan (2026-09-17, T-027):** 2 gap pre-existing task ini
diperbaiki sebagai bagian implementasi T-027 (bukan reopen status task ini)
— `resolvePostOutcome` di-extract dari method private jadi public supaya
dipakai bersama job baru T-027.5 (**ADR-108**: kontrak `fetchPostOutcome`
diredesain menambah `expectedOutstandAccountIds`; **ADR-109**: method baru
`markPostPublished` melengkapi transisi status level-post yang sebelumnya
hilang). Prediksi di catatan 2026-09-07 di bawah ("saat T-027 dikerjakan,
webhook processing ini semestinya dipindah ke enqueue+async") **belum
terealisasi** — pemrosesan webhook `/api/webhooks/outstand` tetap inline
sinkron; T-027 hanya menambah job type terpisah (**JOB-07**) untuk resolve
outcome post terjadwal, bukan mengubah cara webhook ini diproses. Migrasi
webhook ke enqueue+async tetap technical debt terbuka, belum ada task
formal untuk itu.

- [x] **T-026.1** Verifikasi HMAC-SHA256 signature sebelum setiap pemrosesan
- [x] **T-026.2** Durable-before-ACK — persist event dulu, baru ACK, baru proses
- [x] **T-026.3** Handler `post.published` → update `PublishingPostTarget` outcome
- [x] **T-026.4** Handler `post.error` → outcome gagal + trigger notifikasi (T-036)
- [x] **T-026.5** Handler `account.token_expired` → tandai akun perlu reconnect (T-015)
- [x] **T-026.6** Idempotensi: event duplikat tidak boleh menggandakan efek

**Selesai kode (2026-09-07):** seluruh 6 checklist di atas diimplementasikan penuh (Elon Backend Engineer → review Ridwan → QA Najwa, siklus fix di tiap tahap), lolos `typecheck`/`lint`/`test` (261 pass, 4 skip). Pemrosesan **inline sinkron** di Route Handler (bukan enqueue+async sesuai desain asli `integration-layer.md`) karena T-027 (job runner) belum dikerjakan sama sekali — saat T-027 dikerjakan, webhook processing ini semestinya dipindah ke enqueue+async. Keputusan arsitektur baru (2 fungsi Postgres `SECURITY DEFINER` untuk lookup system-context tanpa `userId`) dicatat sebagai **ADR-099**. Ini juga menutup **T-036.5**.

**Ditutup `✅ Done` (2026-09-07):** 3 migration baru (`20260907120000_t026_outstand_webhook_system_lookups`, `20260907130000_t026_unique_outstand_post_id`, `20260907140000_t026_relax_webhook_event_type_check`) sudah dijalankan King Rezi (`bun run db:deploy`) dan **terverifikasi ter-apply** ke DB dev (Najwa QA Engineer cross-check langsung via Supabase MCP: fungsi `webhook_find_post_targets_by_outstand_post_id`/`webhook_find_account_owner_by_outstand_account_id` ada, unique index `publishing_posts_outstand_post_id_unique` ada, CHECK constraint `event_type` sudah dilonggarkan). Retest end-to-end nyata (HTTP request langsung ke `/api/webhooks/outstand`, dev server lokal, tanpa cookie session, mensimulasikan Outstand asli — `OUTSTAND_WEBHOOK_SECRET` diisi dummy sementara di `.env.local` khusus untuk memungkinkan verifikasi HMAC, `OUTSTAND_API_KEY` tetap kosong/Fake adapter tetap aktif, tidak ada perubahan ADR-059) untuk 5 skenario, **SEMUA PASS**: golden path `post.published` (kedua `PublishingPostTarget` jadi `published`, `platformPostId`/`platformPostUrl` terisi), `post.error` (diproses bersih, bug lama "function does not exist" tuntas), `account.token_expired` (`reconnectRequired` jadi `true` + notifikasi Owner, menutup **T-036.5**), event type tak dikenal (`200 OK`, tidak error), idempotensi + signature invalid (regresi aman). **KI-048 Resolved.** Detail lengkap: `COMPLETE_TASK.md` (2026-09-07).

### T-027 · Job runner + Railway Cron

| Field         | Value                                                                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done (5/5 subtask)                                                                                                                                                                                                                                                     |
| **Domain**    | platform                                                                                                                                                                                                                                                                  |
| **ADR**       | ADR-022, ADR-028, ADR-032, ADR-040, ADR-108, ADR-109                                                                                                                                                                                                                      |
| **Terkait**   | KI-003 (via T-025), KI-015, KI-025 (Railway belum pernah dibuat — job runner ini baru config-as-code, provisioning aktual masih blocked), KI-062 (baru, formula backoff `background-jobs.md` self-contradictory), KI-063 (baru, `PublishingPost.publishedAt` tidak diisi) |
| **Depends**   | T-025                                                                                                                                                                                                                                                                     |
| **Baca dulu** | `05-architecture/background-jobs.md` · `06-engineering/deployment-infrastructure.md`                                                                                                                                                                                      |

**Selesai (2026-09-17, Elon Backend Engineer → Ridwan Architecture Reviewer 2 putaran → Najwa QA Engineer):** seluruh 5/5 subtask tuntas.

- **T-027.1** Job runner generik — `apps/web/src/lib/jobs/{background-job-store,backoff,job-runner,job-scheduler}.ts`: klaim job via `SELECT FOR UPDATE SKIP LOCKED` (pola sama ADR-099/T-026), registry handler per job type (bukan hardcode 1 tipe) sehingga job type baru bisa ditambah tanpa mengubah runner.
- **T-027.2** Autentikasi `X-Job-Secret` di `POST /api/jobs/run` — memakai `JOB_SECRET` yang sudah ada di env sejak awal tapi sebelumnya nol referensi di kode.
- **T-027.3** Retry backoff 5m/15m/60m + dead-letter (status `failed` di tabel `BackgroundJob` yang sama, bukan tabel terpisah).
- **T-027.4** Railway Cron config-as-code — `railway.json` (service `web`), `railway.cron.json` (service `cron`), `scripts/trigger-job-run.ts`. **Provisioning aktual Railway project untuk cron masih blocked (KI-025)** — ini baru config-as-code di repo, belum ada service `cron` sungguhan berjalan; env `JOB_RUNNER_URL`/`JOB_SECRET` di service tersebut masih perlu di-set manual di dashboard Railway setelah project dibuat.
- **T-027.5** Job handler `ResolveScheduledPostOutcomeJobHandler` (`apps/web/src/domains/publishing/services/resolve-scheduled-post-outcome-job-handler.ts`) — dipicu saat post terjadwal (`SchedulePostsUseCase`) sudah due, meng-enqueue job type baru `publishing.scheduled_post.resolve_outcome` (**JOB-07**, sudah ditambahkan ke `background-jobs.md` § Job Type Registry) lewat port baru `IJobScheduler` (payload `{ outstandPostId }`), lalu reuse `OutstandWebhookProcessor.resolvePostOutcome` (di-extract dari method private T-026 jadi public, sekarang dipakai bersama webhook DAN job) untuk resolve outcome per target.

**2 keputusan desain material selama implementasi, dicatat sebagai ADR baru:**

1. **ADR-108** — Redesain kontrak `IOutstandAdapter.fetchPostOutcome` dari `fetchPostOutcome(outstandPostId)` menjadi `fetchPostOutcome(outstandPostId, expectedOutstandAccountIds: string[])`. Ditemukan Najwa QA Engineer: post terjadwal tidak pernah selesai resolve outcome-nya karena `FakeOutstandAdapter` (ADR-059) sebelumnya mengandalkan `Map` in-memory level-modul untuk "mengingat" target akun dari panggilan `schedulePost`/`publishNow` sebelumnya — valid untuk `PublishNowUseCase` (kedua panggilan dalam 1 request yang sama), tapi RUSAK untuk T-027.5 karena `schedulePost` dipanggil dari Server Action sedangkan `fetchPostOutcome` (lewat job) dipanggil belakangan dari Route Handler `/api/jobs/run` TERPISAH — Next.js membundle keduanya jadi module chunk terpisah dengan instance `Map` sendiri-sendiri, dikonfirmasi Elon Backend Engineer nyata di production build (`.next/server`), bukan cuma artefak dev/Turbopack. King Rezi memilih root-cause fix (ubah kontrak, bukan band-aid `globalThis`) lewat `AskUserQuestion`. `FakeOutstandAdapter` sekarang pure function tanpa state sama sekali (`Map`/`rememberTargets`/`MAX_REMEMBERED_POSTS` dihapus total, `deletePost` jadi no-op murni). 3 call site diupdate (`PublishNowUseCase`, `RetryFailedTargetUseCase`, `OutstandWebhookProcessor.resolvePostOutcome`); domain `analytics` dikonfirmasi tidak terdampak. Detail: `decisions/ADR-108-redesain-fetchpostoutcome-expected-account-ids.md`.
2. **ADR-109** — Method baru `IPublishingRepository.markPostPublished`. Gap pre-existing sejak T-026 (✅ Done) baru kentara sekarang: `PublishingPost.status` tidak pernah ditransisikan ke `Published` walau semua target sudah resolved sukses (hanya `PublishingPostTarget.status` yang ter-update) — post stuck selamanya di `Scheduled` secara post-level. Fix: `markPostPublished` (simetris `markPostFailed`, idempoten via `updateMany` guard status `Scheduled`, tidak throw kalau 0 baris) dipanggil di `OutstandWebhookProcessor.resolvePostOutcome` persis saat semua target sudah resolved (tidak ada `pending` lagi) DAN tidak semua `failed` — konsisten aturan baseline `integration-layer.md` ("post.error hanya kalau SEMUA target gagal; tetap Published kalau minimal satu sukses"). Ini bug-fix yang melengkapi T-026 (bukan reopen status T-026, cukup catatan tambahan ini). `PublishNowUseCase` tidak disentuh (sudah punya jalur `Published` sendiri di muka). Detail: `decisions/ADR-109-markpostpublished-post-level-status-transition.md`.

**Gap ditemukan, sengaja tidak diperbaiki sekarang (dicatat sebagai Known Issue baru):**

- **KI-062** — `background-jobs.md` self-contradictory soal formula backoff: tabel bilang 5m/15m/60m, formula tertulis di dokumen yang sama (`5 * 2^(attempts-1)`) menghasilkan 5/10/20 menit. Implementasi kode memakai angka tabel (5/15/60), benar secara fungsional — dokumentasi baseline yang perlu dikoreksi, bukan kode.
- **KI-063** — kolom `PublishingPost.publishedAt` tidak diisi oleh `markPostPublished` maupun `markPostFailed` (pola lama, bukan regresi baru dari T-027). UI sudah punya fallback (`item.publishedAt ?? item.updatedAt`) jadi tidak berdampak visual, tapi data historis `publishedAt` kosong.
- **KI-025 tetap terbuka** — Railway project belum pernah dibuat, jadi `railway.json`/`railway.cron.json` baru config-as-code, belum ada service `cron` sungguhan.

**Verifikasi akhir:** `bunx tsc --noEmit` bersih, `eslint .` bersih, `prettier --check` bersih, `vitest run` **396 pass / 5 skip**. Review arsitektur Ridwan Architecture Reviewer (2 putaran — putaran 1: 1 temuan bug correctness, sudah diperbaiki; putaran 2: fokus 2 perubahan besar tambahan ADR-108/ADR-109, 0 temuan; juga merekomendasikan JOB-07 ditambahkan ke `background-jobs.md`, sudah ditindaklanjuti). QA end-to-end Najwa QA Engineer (browser real + `curl` manual simulasi Railway Cron): golden path Schedule → job runner → History Published, diulang 2x konsisten; regresi Publish Now dan Retry manual (T-034.4) keduanya PASS.

- [x] **T-027.1** Job runner: klaim job dari `BackgroundJob` (locking aman untuk eksekusi paralel)
- [x] **T-027.2** Autentikasi endpoint via `JOB_SECRET` (sudah ada di env, belum dipakai)
- [x] **T-027.3** Retry internal dengan backoff + dead-letter state
- [x] **T-027.4** Konfigurasi Railway Cron (service cron terpisah dari web) — config-as-code selesai, provisioning aktual masih blocked KI-025
- [x] **T-027.5** Job handler: publish scheduled post saat waktunya tiba

---

## Schedule & Publish

### T-028 · Persistensi "Schedule" via Fake OutstandAdapter

`✅ Done` · **ADR** ADR-059

`SchedulePostsUseCase` + `resolveScheduleTargets` + validasi format (`assertContentFormatAllowed`) + `WorkspaceService.listConnectedAccounts` (query real). Lolos QA + review arsitektur Ridwan tanpa temuan. Kode: `apps/web/src/domains/publishing/services/schedule-posts.use-case.ts`.

### T-029 · Publish Now

| Field         | Value                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done                                                                                                          |
| **Domain**    | publishing                                                                                                       |
| **ADR**       | ADR-047, ADR-039, ADR-049, ADR-059, ADR-074                                                                      |
| **Depends**   | T-025 (untuk jalur nyata — sementara tetap via `FakeOutstandAdapter`)                                            |
| **Baca dulu** | `04-ux/key-screen-patterns.md` (KSP-05-F12) · `04-ux/user-flows.md` (UXP-04) · `02-product/roles-permissions.md` |

**Update 2026-08-18 — koreksi:** belum ada di kode (`grep publishNow` nol hasil di `src/`), tapi desainnya **sudah ada** di Claude Design (project "Social Media Management") — catatan lama di sini ("belum ada... maupun di App Prototype") salah dan sudah usang:

- Tombol "Publish Now" sudah ada di `templates/draft-editor.html`, berdampingan dengan "Save as Draft" dan "Schedule".
- Dialog Confirmation Summary varian Publish Now ("Konfirmasi & Publish") sudah wired interaktif di `templates/app-prototype/AppPrototype.dc.html` (`openPublishNowDialog`, `data-proto="draft-publishnow"`/`publishnow-confirm`), termasuk role switcher untuk visibility per role dan redirect ke Calendar/History setelah konfirmasi.
- Component pattern dialog-nya juga didokumentasikan di `components/dialog.html` (purpose=`form`, disebut eksplisit dipakai bersama Schedule).

Jadi T-029.4/.5/.6 di bawah **desainnya sudah tersedia** — sisa pekerjaan murni implementasi kode (Server Action + service + wiring ke komponen Astryx nyata), bukan menunggu desain baru.

- [x] **T-029.1** `PublishingService.publishNow()` — RBAC semua role (Owner/Admin/Creator, ADR-074)
- [x] **T-029.2** Validasi `ContentFormat` (ADR-039) sebelum panggil adapter
- [x] **T-029.3** Server Action + panggil `OutstandAdapter.publishNow`
- [x] **T-029.4** Tombol "Publish Now" di Draft Editor berdampingan dengan Schedule (KSP-05-F12) — desain sudah ada, tinggal implementasi komponen Astryx nyata
- [x] **T-029.5** Dialog Confirmation Summary varian Publish Now (UXP-04) — desain sudah ada di App Prototype, tinggal implementasi komponen Astryx nyata
- [x] **T-029.6** ~~Tambahkan tombolnya di App Prototype Claude Design~~ — sudah ada di App Prototype, task ini selesai dari sisi desain

**Selesai (2026-08-18):** `PublishNowUseCase` (`apps/web/src/domains/publishing/services/publish-now.use-case.ts`) mengikuti pola `SchedulePostsUseCase` (T-028/ADR-059) — RBAC eksplisit lewat `assertActorCanPublishNow` (`apps/web/src/domains/publishing/rbac.ts`, ADR-074: Owner/Admin/Creator) dijalankan fail-fast sebelum validasi `ContentFormat` (ADR-039), lalu persist dulu (`PublishingPostTarget` status `pending`, post → `Published`) sebelum panggil adapter per target — supaya tidak ada job Outstand yang orphan tanpa jejak DB. Server Action `publishNowAction` di `apps/web/src/app/(app)/components/draft-editor/actions.ts` memanggil use-case ini lewat `OutstandAdapter.publishNow`, yang jalur produksinya masih `FakeOutstandAdapter` (pola ADR-059, T-025 real adapter belum ada — KI-003). UI Draft Editor (`apps/web/src/app/(app)/components/draft-editor/Modal.tsx`) menambahkan tombol "Publish Now" berdampingan Schedule + dialog Confirmation Summary varian Publish Now, dan redirect ke Publish/Calendar setelah konfirmasi (menutup T-031.4). Sebagai bagian commit yang sama, Schedule Picker Draft Editor dirapikan menyamai mockup (heading tunggal "Jadwal", placeholder Bahasa Indonesia, ikon kalender/jam dipindah ke kanan via Tailwind `flex-row-reverse`) dan dot indicator ditambahkan ke Badge status — dua temuan dari pekerjaan ini dicatat sebagai **KI-029** (xstyle Astryx belum bisa dipakai) dan **KI-030** (TimeInput Astryx tidak membatasi input real-time) di `PROJECT_STATE.md`. Diverifikasi: `tsc --noEmit` bersih, Vitest suite terkait lulus (`publish-now.use-case.test.ts`, `fake-outstand-adapter.test.ts`, dst), end-to-end browser (New Post → Publish Now → Confirmation Summary → redirect → data DB `published`).

**Bug fix korektnes (2026-08-26, ditemukan saat verifikasi T-033):** `PublishNowUseCase` tidak pernah men-set `PublishingPost.status` jadi `Failed` walau SEMUA target gagal publish — melanggar aturan `integration-layer.md:269-270,305` ("post.error" hanya kalau semua target gagal; post tetap `Published` kalau minimal satu target sukses/partial success). Diperbaiki oleh Prabowo Feature Engineer: method baru `markPostFailed` di `IPublishingRepository` (idempoten, hanya update baris yang masih status `Published`) — interface `apps/web/src/domains/publishing/repositories/publishing.repository.ts`, implementasi Prisma `apps/web/src/lib/repositories/publishing/publishing.repository.ts`; `apps/web/src/domains/publishing/services/publish-now.use-case.ts` memanggil `markPostFailed` setelah `Promise.all` publish ke semua target selesai kalau seluruh outcome gagal, tanpa mengubah perilaku partial/full success. 3 skenario test baru (semua gagal, partial, semua sukses) — semua pass; `tsc`/`eslint` bersih, tidak ada regresi (151 test lain tetap pass). Fitur inti T-029 tetap dianggap selesai — ini murni koreksi bug, bukan perubahan status task.

**Terkait KI-081 (`PROJECT_STATE.md`, Open, ditemukan 2026-09-28 saat T-107):** `publishedAt` diisi di muka lewat `repository.publishNow` sebelum outcome per-target diketahui — kalau `markPostFailed` di atas mengoreksi `status` ke `Failed`, `publishedAt` yang sudah kadung terisi tidak ikut di-null-kan, sehingga post `Failed` bisa punya `publishedAt` keliru. Belum diperbaiki, di luar scope T-029 maupun T-107.

### T-030 · Cancel Schedule + dialog konfirmasi

| Field         | Value                                                                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done — bagian Queue selesai via T-032.4 (2026-08-20); bagian Calendar selesai via T-030.3 (2026-10-13)                                                              |
| **Domain**    | publishing                                                                                                                                                             |
| **ADR**       | ADR-049 (Tier 2)                                                                                                                                                       |
| **Depends**   | T-028 ✅, T-032 ✅ (aksi dipicu dari Queue — selesai), T-033 ✅ (Calendar view selesai 2026-08-28, tapi tidak menambahkan entry point Cancel Schedule — lihat catatan) |
| **Baca dulu** | `04-ux/key-screen-patterns.md`                                                                                                                                         |

**Catatan (2026-08-20):** T-030.1/.2/.3 sudah diimplementasikan penuh sebagai bagian **T-032.4** (lihat catatan di sana) — bukan pekerjaan terpisah. Ditutup untuk konteks Queue; ketiga checkbox di bawah ditandai selesai untuk bagian itu. Reuse `cancelScheduleAction`/`AlertDialog` yang sama untuk Calendar, bukan re-implementasi.

**Catatan (2026-08-28):** T-033 (Calendar view) sudah `✅ Done`, tapi scope-nya berhenti di Popover ringkasan + CTA "Buka Draft Editor" (T-033.8) — **tidak** menambahkan entry point Cancel Schedule langsung di Calendar. Bagian Calendar task ini tetap `🟡 In Progress`, tidak lagi diblokir oleh T-033 yang belum selesai, melainkan menunggu implementasi entry point-nya sendiri (belum ada task terpisah untuk ini).

**Selesai (2026-10-13):** Entry point Cancel Schedule ditambahkan di popover Calendar (`CalendarPostPopover.tsx`) — tombol "Batalkan Jadwal" (variant destructive) khusus post berstatus Scheduled, di bawah tombol "Buka Draft Editor" yang sudah ada. 100% reuse `CancelScheduleUseCase`/RBAC yang sama dengan Queue (T-032.4), tanpa business logic baru. File yang diubah: `apps/web/src/app/(app)/publish/calendar/actions.ts` (Server Action baru `cancelScheduleAction`), `components/CalendarScreen.tsx` (state dialog `useConfirmAction` + `AlertDialog`, pola identik `QueueScreen.tsx`), `components/CalendarWeekGrid.tsx`, `components/CalendarMonthGrid.tsx`, `components/CalendarAgendaList.tsx` (thread prop `onCancelSchedule`), `components/CalendarPostPopover.tsx` (tombol baru). Desain tombol kedua ini dikonfirmasi langsung oleh King Rezi di chat (gap rule 17 `AGENTS.md` ditemukan saat QA — ditutup belakangan secara paralel oleh Neymar Product Designer yang menyinkronkan `components/popover.html` sebagai LOCKED PATTERN, terpisah dari task ini). Dikerjakan Mark UI Engineer, direview Ridwan Architecture Reviewer (0 temuan), di-QA Najwa QA Engineer (golden path Week/Month/Mobile Agenda PASS, negative case PASS, dialog konfirmasi + loading state PASS, dark/light mode PASS, 726 test lulus/0 failed, `tsc`/`eslint` bersih). Branch `feature/t-030-3-calendar-cancel-schedule`, commit `afabafb`. **T-030 kini `✅ Done` penuh** (Queue + Calendar). Housekeeping kecil: 1 post test "Test Cancel Schedule T-030.3" masih nyangkut sebagai Draft di DB dev (dibuat Mark, direuse Najwa) — belum dihapus (di luar wewenang eksekusi otonom AI).

- [x] **T-030.1** `PublishingService.cancelSchedule` + batalkan di Outstand (T-025) — diimplementasikan via `cancel-schedule.use-case.ts` + `IOutstandAdapter.cancelScheduledPost` (Fake, ADR-059) di T-032.4
- [x] **T-030.2** Dialog konfirmasi Tier 2 — referensi copy & interaksi sudah ada di prototipe Claude Design (`openCancelScheduleDialog`/`applyCancelSchedule`, `templates/app-prototype/AppPrototype.dc.html`, dibuat via T-032.0 2026-08-19): warning "Post kembali menjadi Draft dan tidak akan dipublikasikan otomatis" + tombol `btn-danger` "Batalkan Jadwal" — diimplementasikan nyata sebagai `AlertDialog` Astryx di T-032.4
- [x] **T-030.3** Aksi tersedia dari Queue (tombol icon merah `.icon-btn-danger` per row, desain final T-032.0) + Calendar — **Queue selesai** (T-032.4, 2026-08-20); **Calendar selesai** (2026-10-13, popover `CalendarPostPopover.tsx`)

### T-031 · Redirect otomatis ke sub-screen tujuan setelah aksi terminal

| Field         | Value                          |
| ------------- | ------------------------------ |
| **Status**    | ✅ Done                        |
| **Domain**    | UI                             |
| **ADR**       | ADR-054                        |
| **Depends**   | T-029 ✅, T-032, T-034         |
| **Baca dulu** | `04-ux/navigation-patterns.md` |

Bukan task besar berdiri sendiri — cukup diselaraskan saat task tujuannya dikerjakan.

- [x] **T-031.1** Save as Draft → Drafts (sudah sejalan dengan alur existing)
- [x] **T-031.2** Pastikan tetap konsisten begitu CTA sidebar (T-011) aktif dari section manapun — `finishTerminalAction` di `_draft-editor/modal.tsx` menutup editor lalu mengarahkan ke tujuan, dipakai seragam oleh Save as Draft dan Schedule
- [x] **T-031.3** Schedule → Queue — dikerjakan lebih awal dari catatan "relevan setelah T-032": begitu CTA sidebar aktif, Schedule dari Home/Analyze meninggalkan pengguna tanpa jejak aksi, jadi destinasi ADR-054 dipakai walau layar Queue sendiri masih placeholder
- [x] **T-031.4** Publish Now → History/Calendar — ditutup bersamaan T-029 (2026-08-18), `finishTerminalAction` dipakai seragam untuk redirect setelah konfirmasi Publish Now

---

## Queue · Calendar · History

Ketiga screen ini masih placeholder "Scaffold — implementasi fitur di M8".

### T-032 · Queue management

| Field         | Value                                                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done                                                                                                                                         |
| **Domain**    | publishing                                                                                                                                      |
| **ADR**       | ADR-046, ADR-083                                                                                                                                |
| **Depends**   | T-028 ✅                                                                                                                                        |
| **Terkait**   | KI-032 (Publish Now dari Queue belum auto-advance — `getDraftAction` belum preload target akun terjadwal)                                       |
| **Baca dulu** | `04-ux/key-screen-patterns.md` (KSP-03, amandemen ADR-083) · `05-architecture/domain-model.md` (entity `QueueSlot` sudah dihapus dari baseline) |

Model Prisma `PublishingQueueSlot` sudah ada di schema **tanpa service apapun** — **jangan dipakai** untuk implementasi T-032.2 (ADR-083 menganggapnya deprecated, Queue dihitung langsung dari `PublishingPost`/`PublishingPostTarget`).

- [x] **T-032.0** Selaraskan Design System halaman Queue (`templates/publish-queue.html`, Claude Design) dengan referensi UX Buffer — **Done 2026-08-19**, dikerjakan 2 putaran di sesi yang sama:

  **Putaran 1 — adopsi elemen Buffer yang tidak butuh ADR/fitur baru** (King Rezi menunjukkan screenshot `publish.buffer.com/schedule`): grouping post per tanggal, urutan murni ascending waktu publish (tombol reorder ↑/↓ dihapus total — closes T-032.1), tampilkan "Dibuat X menit/jam lalu" per post. **Sengaja tidak diadopsi** (di luar scope, butuh ADR atau fitur baru yang tidak ada di backlog manapun): toggle List/Calendar menggantikan tab (ADR IA), tab "Approvals" + badge count (fitur approval workflow tidak ada di `roles-permissions.md`), filter "Tags" (tidak ada konsep tag di domain model), filter "Timezone" (tidak ada setting ini di backlog), badge count "Sent 2K".

  **Putaran 2 — revisi detail layout & aksi** (King Rezi review ulang, 9 poin, dieksekusi setelah 2 klarifikasi AskUserQuestion): filter channel dipindah ke baris terpisah di bawah tabbar, rata kanan, dipersempit (`max-width:180px`); tombol **New Post** pindah ke baris judul (`justify-content:space-between` dengan title+subtitle, memanfaatkan `.page-head` yang sudah flex-between); **1 card Astryx per schedule** (bukan 1 card menaungi seluruh list — tiap `.queue-row` sekarang dibungkus `.card.card-pad.queue-card` sendiri); status chip (Scheduled/Failed/Ready to Schedule) **dihapus total** (tidak relevan untuk halaman ini — confirmed by King Rezi); dropdown "More options (⋮)" dari putaran 1 **dihapus**, diganti **3 tombol icon eksplisit**: Publish Now, Edit, **Cancel Schedule** (icon merah, class `.icon-btn-danger`, 1 tombol saja — bukan Cancel Schedule + Delete terpisah, confirmed via AskUserQuestion); heading tanggal dirapikan (nama bulan lengkap "14 Juli" bukan "14 Jul", semibold, border-bottom pemisah).

  **Interaksi diwire nyata di prototipe** (`templates/app-prototype/AppPrototype.dc.html`, bukan cuma visual statis): tombol Publish Now → reuse `openPublishNowDialog` (dialog Confirmation Summary yang sama dengan Draft Editor, T-029); tombol Edit → reuse `triggerEditDraft` (buka modal Edit Draft yang sudah ada); tombol Cancel Schedule → dialog konfirmasi baru `openCancelScheduleDialog`/`applyCancelSchedule` (pola sama `openDisconnectDialog`: warning + tombol `btn-danger`, menghapus card dari Queue + toast "Jadwal dibatalkan — post kembali ke Drafts" — desain interaksi untuk T-030). Dead code `reorder-up`/`reorder-down` di `route()` sekalian dibersihkan (tombolnya sudah tidak ada sejak putaran 1). Kedua file diverifikasi baca-ulang dari remote setelah tiap `write_files` (scope-discipline skill poin 6) — tidak ada drift/perubahan King Rezi yang tertimpa.

- [x] **T-032.1** ~~Putuskan semantik queue slot~~ — **Resolved 2026-08-19**: queue murni urutan waktu publish (ascending), tanpa reorder manual, mengikuti referensi UX Buffer (lihat T-032.0). Tidak perlu ADR (bukan perubahan baseline, cuma keputusan implementasi UI yang sebelumnya terbuka)
- [x] **T-032.2** `PublishingService.listQueue` + repository — query `PublishingPost`/`PublishingPostTarget` status `Scheduled` langsung, grouped by tanggal, urutan murni `scheduledAt` ascending. **Jangan pakai model Prisma `PublishingQueueSlot`** (ADR-083: dianggap deprecated)
- [x] **T-032.3** UI daftar antrean per akun/waktu — implementasi Astryx nyata dari mockup final T-032.0 (`apps/web`): grouping per tanggal, 1 Card per schedule, tanpa status chip
- [x] **T-032.4** Aksi per item: **Publish Now, Edit, Cancel Schedule** — 3 tombol icon eksplisit langsung di row (bukan dropdown More options, desain final T-032.0). Cancel Schedule = implementasi nyata T-030 di `apps/web`, copy dialog konfirmasi mengikuti referensi prototipe `openCancelScheduleDialog`. **Reorder dihapus dari scope** (lihat T-032.0/.1)
- [x] **T-032.5** Migration drop model Prisma `PublishingQueueSlot` + tabel `publishing_queue_slots` (ADR-083) — **cek dulu** `apps/web/src/lib/repositories/workspace/workspace.repository.delete-cascade.test.ts` (baris 81, 129, masih memakai `tx.publishingQueueSlot`/`prisma.publishingQueueSlot` untuk test cascade-delete T-008.2), sesuaikan/hapus assertion itu dulu sebelum migration dijalankan. Bukan bagian T-032.2 — subtask sendiri supaya tidak keliru dianggap selesai begitu `listQueue` jalan

**Selesai (2026-08-20):** Empat subtask sisa ditutup dalam satu sesi. **T-032.2** (Prabowo): `PublishingService.listQueue` + repository query langsung ke `PublishingPost`/`PublishingPostTarget` status `Scheduled` (bukan `PublishingQueueSlot`), grouped per tanggal via helper baru `group-queue-items.ts` (+ test), ascending `scheduledAt`. **T-032.5** (Elon): migration `20260820024619_drop_publishing_queue_slot` men-drop model `PublishingQueueSlot` + tabel `publishing_queue_slots` + 3 field relasi balik (ADR-083); `workspace.repository.delete-cascade.test.ts` disesuaikan dan cascade-delete T-008.2 diverifikasi ulang dengan koneksi DB asli. **T-032.3** (Mark): UI nyata `apps/web/src/app/(app)/publish/queue/page.tsx` + `components/QueueList.tsx` — grouping per tanggal (heading nama hari + tanggal), 1 Card per schedule tanpa status chip, filter akun client-side; judul halaman dikoreksi jadi "Publish" (bukan "Queue") setelah verifikasi ulang ke mockup Claude Design. **T-032.4** (Prabowo): wiring 3 aksi + implementasi nyata **T-030** (Cancel Schedule) untuk bagian Queue — kontrak ACL baru `IOutstandAdapter.cancelScheduledPost` + `FakeOutstandAdapter` (ADR-059), RBAC `assertActorCanCancelSchedule` (ADR-074), use-case `cancel-schedule.use-case.ts` (persist dulu baru panggil adapter, pola sama `PublishNowUseCase`), Server Action `cancelScheduleAction`, UI `QueueScreen.tsx` (`AlertDialog` Tier 2 + `useToast` — pemakaian pertama toast Astryx di codebase). Publish Now dari Queue diperbaiki agar auto-advance ke Confirmation Summary (`initialPendingAction?: "publish-now"` di `DraftEditorState`/`openEditDraft`) — **known limitation** yang sengaja dibiarkan: `getDraftAction` belum preload target akun terjadwal, jadi kadang jatuh ke form biasa alih-alih auto-advance (**KI-032**, `PROJECT_STATE.md`). Diverifikasi: Ridwan (Architecture Reviewer) 0 temuan; Najwa (QA) Vitest 153 passed/3 skipped (butuh DB asli), `tsc --noEmit` bersih, `eslint` bersih, E2E browser lengkap — 1 bug kosmetik (double `@` di label akun filter/target) ditemukan dan diperbaiki di sesi yang sama, diverifikasi ulang via browser. Detail lengkap: `COMPLETE_TASK.md`.

### T-033 · Calendar view

| Field         | Value                                                                                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done                                                                                                                                                                                                   |
| **Domain**    | publishing                                                                                                                                                                                                |
| **ADR**       | ADR-023 (manual refresh, bukan realtime — **amandemen ADR-094** untuk Calendar), ADR-046, **ADR-090** (Popover klik item, khusus Calendar; komponen dikoreksi **ADR-091** dari HoverCard menjadi Popover) |
| **Depends**   | T-028 ✅                                                                                                                                                                                                  |
| **Baca dulu** | `04-ux/key-screen-patterns.md` (KSP-02, direvisi per ADR-090) · `04-ux/navigation-patterns.md` (NP-D15) · `05-architecture/realtime-strategy.md`                                                          |

Data kalender **tidak** realtime — pakai manual refresh (ADR-023 membatasi Realtime hanya untuk tabel `notifications`).

**Referensi UX (2026-08-26):** breakdown di bawah disusun setelah sesi eksplorasi Calendar Buffer (King Rezi) di branch `feature/calendar-design-system`. Keputusan dari sesi itu: (a) **Tags & Timezone filter per-view tidak diadopsi** — alasan sama seperti T-032.0 (tidak ada konsep Tag di domain model, Timezone bukan setting per-view di backlog); (b) **satu route** `/publish/calendar` dengan state `?view=week|month&date=<timestamp>` di query param — tidak override ADR-046; (c) klik item Calendar buka **Popover** (Astryx) dulu sebelum Draft Editor — **ADR-090**, khusus Calendar, Queue/Drafts tidak berubah. **Koreksi (ADR-091, sesi sama):** komponen semula ditulis "HoverCard", diperbaiki jadi **Popover** setelah verifikasi `astryx component --dense` — HoverCard trigger-nya hover/focus (bukan klik) dan tidak boleh berisi critical action (CTA Edit) per guideline resminya.

**Design System selesai (2026-08-26):** Claude Design (project "Social Media Management") sudah mengimplementasikan seluruh rancangan di atas — `templates/publish-calendar.html` (grid Week per-jam + grid Month dengan "N More", ditumpuk vertikal sesuai konvensi state referensi project — bukan side-by-side, dikoreksi setelah percobaan pertama), `components/popover.html` (Popover baru, anatomi Header+Body+Trigger terverifikasi CLI), navigasi Today/‹/›/label + filter Status/Channel per state, dan tombol New Post dipindah sejajar judul halaman (pola sama `publish-queue.html`). Toggle Minggu/Bulan diwire interaktif di `templates/app-prototype/AppPrototype.dc.html` (`applyCalendarView()`, class `.cal-view-select` — sengaja bukan `data-proto` supaya tidak bentrok delegated click-listener runner), default Week, tidak persist antar navigasi. **Ini murni Design System (mockup statis + prototype interaktif) — belum ada satu baris kode `apps/web` yang ditulis.** Checkbox T-033.1–.8 di bawah tetap terbuka; masing-masing baru ditandai selesai saat implementasi kode aslinya (bukan mockup-nya) selesai.

**Design Review selesai (2026-08-26).** King Rezi sudah review langsung di Claude Design; revisi yang muncul selama review (layout stacked, koreksi Popover, posisi tombol New Post) sudah diterapkan pada sesi yang sama — tidak ada revisi tersisa. **Implementasi kode (T-033.1–.8) akan dikerjakan di sesi/room chat terpisah** dari sesi perencanaan+Design System ini (branch `feature/calendar-design-system` tetap jadi basis). Sesi implementasi wajib baca dulu section "Design System selesai" di atas + file Claude Design yang disebut (`templates/publish-calendar.html`, `components/popover.html`, `templates/app-prototype/AppPrototype.dc.html`) sebagai acuan visual sebelum mulai — bukan menebak ulang layout dari nol.

**Keputusan implementasi — status yang muncul di grid Calendar (2026-08-26):** dikonfirmasi dengan King Rezi bahwa status `Draft`/`In Review`/`Ready to Schedule` TIDAK PERNAH punya `scheduledAt` (belum ada waktu tayang, sesuai `roles-permissions.md:131-136`), sehingga tidak seharusnya muncul di grid Calendar sama sekali. Grid Week & Month HANYA menampilkan post berstatus **Scheduled, Published, Failed** — bukan perubahan baseline, murni menyelaraskan implementasi dengan definisi yang sudah ada, jadi tidak perlu ADR baru. Mockup `templates/publish-calendar.html` di Claude Design dikoreksi (3 card yang sebelumnya "Ready to Schedule" diubah jadi "Scheduled" agar konsisten dengan aturan ini). Query `listCalendarPosts` (T-033.1) yang memfilter berdasarkan `scheduledAt`/`publishedAt` secara alami sudah benar untuk aturan ini — tidak ada perubahan kode tambahan diperlukan. Filter dropdown status di halaman Calendar (T-033.6) tetap menampilkan 6 opsi seperti rencana semula, tidak diubah — koreksi ini hanya berlaku ke contoh card di mockup dan ke perilaku grid.

- [x] **T-033.1** Query post per rentang tanggal + filter akun (`PublishingService`, query `PublishingPost`/`PublishingPostTarget`)
- [x] **T-033.2** State periode via query param (`?view=week|month&date=<timestamp>`) pada route tunggal `/publish/calendar` — tidak menambah route baru (konsisten ADR-046)
- [x] **T-033.3** Komponen grid Week view — hari × slot jam (cek dulu komponen `Calendar` Astryx sebelum bikin custom, `astryx component Calendar --dense`)
- [x] **T-033.4** Komponen grid Month view — hari × tanggal 1 bulan penuh, badge "N More" untuk sel padat (tidak silently truncate)
- [x] **T-033.5** Navigasi periode: tombol Today, ‹ › (prev/next), label periode (termasuk format lintas-bulan untuk Week), toggle Minggu/Bulan
- [x] **T-033.6** Filter status post (dropdown) + filter Channels (akun) di atas grid
- [x] **T-033.7** ~~Manual refresh control~~ — **Dibatalkan (2026-08-28)**: sempat blocked (tidak ada rancangan di Claude Design), lalu ditutup total (bukan cuma ditunda) setelah ADR-094 (Realtime Calendar) direncanakan — King Rezi memutuskan tidak perlu tombol refresh manual berdiri sendiri; sinkronisasi Calendar akan ditangani granular patch via Supabase Realtime (ADR-094) begitu itu diimplementasikan. Scope-nya (tombol + trigger refetch) sengaja **tidak** dipindah/digabung ke task Realtime baru — kalau nanti ternyata dibutuhkan lagi (mis. fallback recovery saat koneksi Realtime putus), itu jadi task baru terpisah dengan ID sendiri, bukan dihidupkan lagi di T-033.7 (ID tidak didaur ulang)
- [x] **T-033.8** Klik item → Popover (Astryx `Popover`, ADR-090/ADR-091): ringkasan post + metrik untuk post Published (mapping ke `PostMetrics`: Views→`impressions`, Reach→`reach`, Replies→`comments`, Eng. Rate→`engagementRate`) + CTA buka Draft Editor (modal, ADR-052)

**T-033 dinyatakan selesai (2026-08-28):** dengan T-033.7 dibatalkan (bukan diimplementasikan), seluruh subtask T-033.1–.8 tertutup (7 diimplementasikan + 1 dibatalkan by design) — task ini ditutup `✅ Done`. Data Calendar untuk saat ini **tetap manual-refresh** (tidak ada tombol refresh eksplisit maupun realtime) sampai task baru dari ADR-094 diimplementasikan.

**Selesai T-033.3/.4 (2026-08-27, branch `feature/calendar-design-system`):** grid Week (`CalendarWeekGrid.tsx`, 7 hari × 12 slot 2 jam) dan grid Month (`CalendarMonthGrid.tsx`, 7 hari × N minggu, padding hari muted, badge "+N More" maks 3 kartu/sel) diimplementasikan nyata di `apps/web/src/app/(app)/publish/calendar/components/`, didukung fungsi domain baru `getWeekRange`/`getMonthRange` (`apps/web/src/domains/publishing/services/calendar-range.ts` + test) dan util bersama `calendar-grid-shared.ts` (flatten `CalendarPostItem[]` → kartu per target). `page.tsx` jadi composition root nyata (`getWorkspaceContext` + `getCachedSession` + `getWeekRange`/`getMonthRange` + `PublishingService.listCalendarPosts`), `CalendarScreen.tsx` dispatch `view === "month" ? CalendarMonthGrid : CalendarWeekGrid` menggantikan `EmptyState` placeholder. Review arsitektur Ridwan menemukan 1 duplikasi logic (UI menghitung ulang aturan "tanggal efektif" terpisah dari domain) — diperbaiki di sesi yang sama: fungsi privat `effectiveDate` di `sort-calendar-items.ts` diekspor jadi `effectiveCalendarDate` (public), direuse oleh `calendar-grid-shared.ts`. Diverifikasi: `tsc --noEmit` + `eslint` bersih, 45 test Vitest pass, browser preview manual (data post asli, status Scheduled/Published, badge status, highlight hari-ini). Scope sengaja belum termasuk (subtask terpisah, bukan bug): T-033.5 (navigasi), T-033.6 (filter), T-033.7 (manual refresh), T-033.8 (Popover klik item).

**Selesai T-033.5/.6 (2026-08-27, branch `feature/calendar-design-system`):** navigasi periode + filter di atas grid diimplementasikan nyata. **T-033.5**: `CalendarToolbar.tsx` (baru, client component) — tombol Today/‹/›, label periode (format lintas-bulan untuk Week), toggle Minggu/Bulan, semua Astryx (`Button`, `IconButton`); util `addMonths(date, months)` ditambah ke `calendar-grid-shared.ts` untuk navigasi Month. **T-033.6**: filter status (dropdown 7 opsi: All Posts + 6 `ContentStatus`, reuse `CONTENT_STATUS_LABEL`) dan filter Channels (akun asli workspace via `WorkspaceService.listConnectedAccounts`, cross-domain lewat public API `@/domains/workspace`) — filter dieksekusi **server-side** lewat query Prisma (bukan client-side), state via URL query param `?status=&accounts=` (comma-separated), konsisten dengan pola `?view=&date=` dari T-033.2. `CalendarViewState` (`parse-calendar-view-state.ts`) diperluas: field `statuses: ContentStatus[]`, `connectedAccountIds: ConnectedAccountId[]`, drop token invalid diam-diam saat parsing (+ test baru, semua pass). `useCalendarPeriodState.ts` `setPeriod` diperluas untuk update `statuses`/`connectedAccountIds` di URL (dihapus dari URL kalau array kosong). `page.tsx` meneruskan `statuses`/`connectedAccountIds` ke `PublishingService.listCalendarPosts`; `CalendarScreen.tsx` render `CalendarToolbar` di atas grid, terima prop baru `accounts: ConnectedAccountRecord[]`. Review arsitektur Ridwan — tanpa temuan (entry point bersih, domain logic tanpa Prisma/Supabase, cross-domain lewat public API, shared types konsisten). QA Najwa — semua golden path pass (navigasi lintas-bulan, toggle Minggu/Bulan mempertahankan anchor date, filter status+akun kombinasi, reload URL dengan query filter ter-restore benar, regresi ke Queue/Drafts/History bersih, dark mode oke); satu gap kecil ditemukan & ditutup di sesi yang sama: Month view (`CalendarMonthGrid.tsx`) belum punya `EmptyState` saat filter menghasilkan 0 post (beda dari Week view yang sudah punya sejak T-033.3) — sudah ditambahkan (`EmptyState` "Belum ada post di bulan ini"). Diverifikasi: `bun run typecheck`/`lint`/`test` (root) bersih, 209 test pass/3 skipped. Sisa terbuka: T-033.7 (manual refresh), T-033.8 (Popover klik item).

**Selesai T-033.8 (2026-08-27, branch `feature/calendar-design-system`):** klik kartu post di grid Week/Month sekarang membuka Popover ringkasan (`CalendarPostPopover.tsx`, baru, client component) — Astryx `Popover` (bukan HoverCard, ADR-090/ADR-091), controlled `isOpen` lokal per kartu, exclusive (kartu lain/klik luar/Escape menutup). Isi: header account+platform, avatar+status chip, caption, media placeholder (domain belum punya field media), 4 tile metrik untuk status Published (Views→`impressions`, Reach→`reach`, Replies→`comments`, Eng. Rate→`engagementRate`, format "–" kalau belum ada data), link "Go to post" (kalau `platformPostUrl` ada), CTA "Buka Draft Editor" (reuse `useDraftEditor().openEditDraft`, pola sama Queue). `CalendarWeekGrid.tsx`/`CalendarMonthGrid.tsx` — TODO/no-op onClick sebelumnya diganti wrap `ClickableCard` dengan `CalendarPostPopover`. Data-wiring: interface baru `CalendarItemTargetRecord extends QueueItemTargetRecord` + field `platformPostUrl: string | null` di `publishing.repository.ts` (dari kolom Prisma `PublishingPostTarget.platformPostUrl` yang sudah ada tapi belum pernah di-expose ke domain — bukan migrasi baru), dipetakan di implementasi Prisma (`mapCalendarItem`). `page.tsx` composition root sekarang instansiasi `AnalyticsService` dan pass sebagai `PostMetricsPort` ke `PublishingService` (sebelumnya tanpa argumen kedua, jadi `metrics` selalu kosong) — supaya metrik Published benar-benar terisi. `calendar-grid-shared.ts` — `CalendarCardEntry` diperluas `connectedAccountId`, `metrics: PostMetricsRecord | null` (dicocokkan per `connectedAccountId` target), `platformPostUrl: string | null`. Review arsitektur Ridwan — tanpa temuan. QA Najwa — tanpa bug fungsional (satu catatan inconclusive soal emulasi mobile viewport di tooling browser pane, bukan bug aplikasi); QA manual gabungan (main agent + Najwa) mencakup Week & Month view, popover Scheduled & Published, exclusivity/dismiss, regresi toolbar, regresi Queue & Drafts (tetap langsung buka Draft Editor tanpa Popover — scope Popover khusus Calendar), dark mode, multi-target post (data tidak tertukar antar kartu). Diverifikasi: `bun run typecheck`/`lint`/`test` (root) bersih, 209 test pass/3 skipped (tidak ada test baru — pola project ini tidak unit-test file di folder "components" app-router, verifikasi lewat browser preview manual, konsisten T-033.3–.6). Sisa terbuka: **T-033.7** (manual refresh) — **blocked**, tidak ada rancangan sama sekali di Claude Design, menunggu King Rezi.

**Catatan (2026-09-18, ditemukan review T-043):** kontrak `PostMetricsPort` (arah dependency `publishing→analytics`) yang diperkenalkan di sini ternyata tidak pernah dicantumkan di `application-layer.md` § Peta Dependency Antar Domain — gap dokumentasi lama, baru ketahuan saat review arsitektur T-043 (`tickets/v03-analytics-mvp.md`). Dicatat **KI-064** (`PROJECT_STATE.md`), belum ditambal.

**Polishing UI selesai (2026-08-27, branch `feature/calendar-design-system`, di atas T-033.1–.6/.8 yang sudah `[x]` — bukan subtask baru, tidak mengubah checklist di atas):**

- **Fix grid responsiveness (commit `ab1932f`):** grid 7-kolom Month & Week tidak sejajar antar baris (CSS Grid track blowout — kolom dengan card lebar "mencuri" lebar kolom lain) diperbaiki via `isScrollable` per sel + `StackItem size="fill"` untuk truncation. **Bukan** `xstyle`/StyleX Astryx seperti rencana awal — compiler StyleX belum ter-setup di `apps/web` (lihat catatan gap di bawah).
- **Redesain kartu post:** avatar+nama akun sejajar 1 baris, waktu post pojok kanan atas (Month), caption full-width baris terpisah (Week), indikator tipe konten Post/Reel/Story/Pin (pakai field `contentFormat` yang sudah ada di `CalendarItemTargetRecord`/`QueueItemTargetRecord`, bukan data baru). Footer status+content-format di mobile (≤768px, breakpoint konsisten collapse point `AppShell` mobile-nav) diganti `StatusDot`+`Icon` compact — `Badge` Astryx tidak punya prop ukuran, overflow di kolom sempit. `CalendarPostPopover.tsx` ditambah Badge content-format.
- **Pemisah vertikal grid + padding (commit `8bba7ae`):** garis vertikal antar kolom hari ditambahkan (sebelumnya cuma horizontal antar baris), warna `border-border` (sama dengan border Card/ClickableCard, bukan `border-border-strong` Divider horizontal — biar terasa halus). Gap grid dihapus (`gap={2}`→`{0}`, spacing murni dari padding internal cell) dikompensasi padding cell dinaikkan (Week `padding` 1→1.5, Month `paddingInline` +2) supaya konten tidak nempel garis.
- Review arsitektur & QA sesi ini: verifikasi manual browser (Ridwan/Najwa tidak dijalankan formal untuk sesi polishing murni CSS/layout ini — tidak ada perubahan domain/data-wiring).
- **Gap infrastruktur ditemukan, dicatat untuk referensi ke depan (lihat KI-035 di `PROJECT_STATE.md`):** (1) StyleX ter-install sebagai dependency tapi compiler-nya belum ter-setup di `apps/web`; (2) `Badge` Astryx tidak punya prop `size`/truncation; (3) layout Calendar di viewport sangat sempit (~375px) masih padat — kalau butuh tampilan mobile yang lebih nyaman, perlu rancangan alternatif (agenda/list) di Claude Design dulu (rule 17 `AGENTS.md`), bukan sekadar tweak CSS.
- Sisa terbuka tidak berubah: **T-033.7** (manual refresh) — masih blocked, tidak tersentuh sesi ini.

### T-034 · Publishing History + detail post

| Field         | Value                                                                                                                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done                                                                                                                                                                                                                                                                                                                   |
| **Domain**    | publishing                                                                                                                                                                                                                                                                                                                |
| **ADR**       | ADR-046, ADR-092, ADR-103                                                                                                                                                                                                                                                                                                 |
| **Depends**   | T-026 ✅ (status akhir datang dari webhook — sudah Done 2026-09-07, tidak lagi memblokir)                                                                                                                                                                                                                                 |
| **Terkait**   | KI-048 (Resolved 2026-09-08 — App Prototype diwire + desain dikonfirmasi King Rezi), KI-049 (gap `failedAt`/`failureReason`), KI-050 (gap meta author di halaman detail post), KI-051 (Badge shadcn belum ada varian success), KI-052 (Resolved 2026-10-12 — hydration warning `formatRelativeTime` di `HistoryList.tsx`) |
| **Baca dulu** | `04-ux/key-screen-patterns.md`                                                                                                                                                                                                                                                                                            |

Route `/publish/history` dan `/publish/history/[postId]` sudah ada sebagai placeholder.

- [x] **T-034.1** Query riwayat + status per target (published / error)
- [x] **T-034.2** UI daftar riwayat + filter
- [x] **T-034.3** Halaman detail post: hasil per akun, pesan error, link ke post asli
- [x] **T-034.4** Aksi retry manual untuk target yang gagal

**Catatan (ADR-092, 2026-08-26):** Outstand API tidak punya endpoint retry
resmi — dokumentasi resminya merekomendasikan hapus post yang gagal
(`delete-a-post-from-social-networks`) lalu buat post baru (`create-a-post`),
bukan re-trigger job yang sama. T-034.4 wajib mengikuti pola
delete-lalu-create-ulang ini saat dikerjakan.

**Selesai T-034.1 (2026-09-08):** `IPublishingRepository.listHistory`/`getHistoryById`

- tipe `PublishingPostTargetStatus`/`HistoryItemTargetRecord`/`HistoryItemRecord`
  (`apps/web/src/domains/publishing/repositories/publishing.repository.ts`),
  `PublishingService.listHistory`/`getHistoryById` + konstanta
  `HISTORY_TERMINAL_STATUSES` (`Published`/`Failed`, invariant "History = post
  selesai" di-clamp di service) (`apps/web/src/domains/publishing/services/publishing.service.ts`),
  implementasi Prisma (`apps/web/src/lib/repositories/publishing/publishing.repository.ts`),
  4 file test terkait. Dikerjakan Prabowo Feature Engineer, lolos review
  arsitektur Ridwan (Architecture Reviewer) tanpa temuan blocking. **Tidak
  diblokir T-026** walau field `Depends` menyebutnya — Fake adapter (ADR-059)
  sudah mengisi outcome per target secara sinkron lewat `updateTargetOutcome`
  saat `PublishNowUseCase`/`SchedulePostsUseCase` berjalan, jadi status
  `published`/`failed` untuk data yang lahir dari jalur Fake sudah tersedia
  tanpa menunggu webhook nyata; `Depends: T-026` tetap relevan khusus untuk
  status _real_ pasca-integrasi Outstand asli (T-025), bukan blocker untuk
  query/listing itu sendiri. T-034.2/T-034.3 menunggu review desain (lihat
  KI-048), T-034.4 belum dikerjakan — task tetap `🟡 In Progress`.

**Gap non-blocking ditemukan Ridwan (2026-09-08), dicatat KI-049:** kolom
`PublishingPost.failedAt`/`.failureReason` di schema Prisma tidak pernah
ditulis oleh jalur manapun (`markPostFailed` cuma meng-update `status`) —
sudah didokumentasikan sebagai gap di komentar kode
`IPublishingRepository.listHistory`, dan sengaja tidak dimasukkan ke
`HistoryItemRecord` supaya tidak menyesatkan UI dengan field yang selalu
`null`. Lihat `PROJECT_STATE.md` § KI-049 untuk follow-up ke depan.

**Draft Claude Design (2026-09-08), lihat KI-048:** 2 screen baru sudah
di-push ke project Claude Design "Social Media Management" —
`templates/publish-history.html` (daftar riwayat + filter Status/Akun,
untuk T-034.2) dan `templates/publish-history-detail.html` (ringkasan
post + "Hasil per Akun": link post asli untuk `Published`, pesan error +
tombol retry untuk `Error`, untuk T-034.3/T-034.4). **Draft awal, belum
direview/dikonfirmasi King Rezi** — jangan anggap T-034.2/T-034.3 sudah
"ada desainnya" untuk keperluan gate rule 17 `AGENTS.md` sampai
dikonfirmasi eksplisit. Dikerjakan langsung oleh main agent (bukan
didelegasikan ke Neymar Product Designer) atas instruksi eksplisit King
Rezi di sesi ini — deviasi dari mandat wajib Neymar di
`.claude/agents/neymar-product-designer.md`, bukan inisiatif AI.

**Selesai T-034.2/T-034.3 (2026-09-08) — KI-048 Resolved.** Draft Claude
Design di atas direview bareng King Rezi di chat (Artifact review dari
`templates/publish-history.html`/`templates/publish-history-detail.html`
memakai token desain asli). King Rezi mengonfirmasi 5 poin: (1) App
Prototype wajib dipasang dulu — ditemukan saat itu juga bahwa tab History
belum terdaftar di runner interaktif (`SCREENS`, tab handler, redirect
Publish Now di `templates/app-prototype/AppPrototype.dc.html` masih toast
"belum masuk scope MVP" + stand-in ke Calendar); (2) filter cukup 2
dropdown (Status/Akun), tanpa date range/search; (3) grouping per tanggal
di list sudah sesuai pola Queue; (4) tombol "Coba Lagi" (retry) posisi/
label sudah final tapi murni visual — belum diwire karena T-034.4 belum
dikerjakan; (5) link "Lihat post asli" disabled (bukan hilang) kalau
`platformPostUrl` kosong. Main agent (bukan Neymar — deviasi eksplisit
yang sama seperti draft awal) langsung menutup gap App Prototype: entry
`publish-history`/`publish-history-detail` ditambahkan ke `SCREENS`, tab
click handler `route()` diarahkan ke `publish-history` (bukan toast lagi),
redirect `publishnow-confirm` diarahkan ke `publish-history` (bukan
stand-in `publish-calendar`) — sudah di-push ke Claude Design dan
diverifikasi remote match persis. **KI-048 Resolved** — draft sudah
terkonfirmasi King Rezi dan App Prototype sudah bisa diklik penuh.

Implementasi kode dikerjakan Prabowo Feature Engineer: file baru
`apps/web/src/domains/publishing/services/group-history-items.ts`
(+`.test.ts`), `apps/web/src/app/(app)/publish/history/history-status.ts`,
`apps/web/src/app/(app)/publish/history/components/HistoryList.tsx`,
`apps/web/src/app/(app)/publish/history/[postId]/components/HistoryDetail.tsx`;
file diubah `apps/web/src/app/(app)/publish/history/page.tsx`,
`.../history/[postId]/page.tsx`, `apps/web/src/domains/publishing/index.ts`,
`apps/web/src/app/(app)/publish/components/PublishPageHeader.tsx`. T-034.4
(retry manual) sengaja tidak diimplementasikan — tombol retry di UI murni
visual + disabled. Tidak ada field baru ditambahkan ke
`HistoryItemRecord`/`HistoryItemTargetRecord` (konsisten KI-049). Reuse
komponen shadcn existing (`Card`, `Item`/`ItemGroup`, `Badge`, `Select`,
`Empty`, `Text`, `Separator`, `Button`, `Tooltip`) — tidak ada komponen
baru. Review arsitektur Ridwan **lolos tanpa temuan blocking** — satu
catatan non-blocking: `Badge` shadcn belum punya varian "success" (dipakai
`default` sebagai pengganti untuk status "Published"), dicatat **KI-051**.

QA Najwa QA Engineer: test suite 248 pass/4 skipped/0 fail + verifikasi
browser end-to-end, golden path dan hampir semua edge case PASS. 1 bug
ditemukan: `/publish/history/[postId]` dengan `postId` format bukan UUID
crash HTTP 500 (seharusnya `notFound()`). Diperbaiki Prabowo di
`apps/web/src/lib/repositories/publishing/publishing.repository.ts`
(method `getHistoryById`) — tangkap `PrismaClientKnownRequestError` kode
`P2007`/`P2023`, treat sebagai "tidak ketemu" (return `null`), pola sama
`isRecordNotFound` di `workspace.repository.ts`. Diverifikasi ulang:
typecheck/lint/test tetap hijau (248 pass), 3 skenario manual (postId
invalid → 404, UUID valid tak ada → 404, UUID valid & ada → 200) semua
benar.

**Gap didokumentasikan (bukan diputuskan sendiri):** meta "dibuat oleh
siapa" di halaman detail post sengaja dihilangkan dari desain awal —
`HistoryItemRecord` tidak membawa data `authorId`, di luar scope T-034.2/
.3 untuk menambahkannya — dicatat **KI-050**, menunggu keputusan King
Rezi apakah field ini wajib.

**Selesai T-034.4 (2026-09-09) — T-034 tuntas 4/4 subtask, `✅ Done`.**
Sebelum implementasi, muncul pertanyaan scope yang belum dijawab ADR-092
(delete-lalu-create-ulang, tapi `outstandPostId` bersifat post-level untuk
SEMUA target) — diajukan ke King Rezi lewat `AskUserQuestion`, dijawab:
retry **hanya me-recreate target yang gagal (single-target)**, target lain
yang sudah `published` di post yang sama tidak disentuh. Keputusan ini
dicatat **ADR-103** (melengkapi ADR-092, tidak membatalkannya).

Elon Backend Engineer menulis kontrak adapter: `IOutstandAdapter.deletePost(outstandPostId,
accountIds?)` (best-effort) di `packages/shared/src/contracts/outstand-adapter.ts`

- implementasi `FakeOutstandAdapter`. Prabowo Feature Engineer mengerjakan
  use-case baru `retry-failed-target.use-case.ts` (recreate lewat
  `outstandAdapter.publishNow` langsung dengan 1 target, bukan lewat
  `PublishNowUseCase`/`repository.publishNow` yang me-replace seluruh target
  post), kolom Prisma baru `PublishingPostTarget.retryOutstandPostId`
  (migration `20260909024403_t034_4_retry_outstand_post_id`), fungsi
  rekonsiliasi status post `reconcilePostStatusAfterRetry` (idempoten,
  `Failed → Published` kalau tidak ada lagi target `failed` tersisa), Server
  Action baru `apps/web/src/app/(app)/publish/history/[postId]/actions.ts`,
  komponen `RetryTargetButton.tsx` (baru), wiring di `HistoryDetail.tsx`
  (tombol "Coba Lagi" per-baris akun, sebelumnya visual-only sejak
  T-034.2/.3).

Review arsitektur Ridwan Architecture Reviewer **lolos tanpa temuan
blocking**. QA Najwa QA Engineer: 259 test pass + verifikasi browser
end-to-end golden path dan edge case (termasuk skenario mixed-target
retry) semua **PASS**. 1 temuan non-blocking, di luar scope T-034.4:
hydration warning pada `formatRelativeTime` di `HistoryList.tsx`
(kemungkinan mismatch SSR/client saat format waktu relatif) — dicatat
**KI-052** di `PROJECT_STATE.md`.

### T-035 · Delete Post + dialog konfirmasi

| Field         | Value                          |
| ------------- | ------------------------------ |
| **Status**    | ✅ Done (2026-09-10)           |
| **Domain**    | publishing                     |
| **ADR**       | ADR-049 (Tier 2)               |
| **Depends**   | T-022 ✅                       |
| **Baca dulu** | `04-ux/key-screen-patterns.md` |

**Scope T-035.3 dipersempit eksplisit oleh King Rezi (2026-09-10, lewat
`AskUserQuestion`)** — bukan asumsi AI: entry point Delete Post **hanya di
Drafts**. Queue dan History sengaja TIDAK diberi tombol delete: post
`Scheduled` di Queue harus di-**Cancel Schedule** dulu (balik ke status
`Draft`) baru bisa dihapus dari Drafts; post `Published`/`Failed` di
History tidak boleh dihapus sama sekali. Selaras dengan pengecekan Claude
Design sebelum implementasi (rule 17, AGENTS.md) — `publish-drafts.html`,
`publish-queue.html`, `publish-history.html` ternyata tidak satu pun
punya rancangan tombol delete, jadi King Rezi menentukan langsung
scope + polanya di chat (bukan lewat draft Claude Design), dicatat sebagai
deviasi eksplisit sama seperti pola KI-048.

Implementasi (Prabowo Feature Engineer, 2 sesi): `PublishingService.deletePost`
soft-delete (`deletedAt`) dengan guard status dua lapis (service:
`findDraftById` + cek eksplisit; repository: `updateMany` where
`status: Draft` sebagai safety net race condition) — **hanya post
berstatus `Draft` yang bisa dihapus**, status lain ditolak `ConflictError`.
RBAC `assertActorCanDeletePost` (Owner/Admin/Creator, konsisten
Publish Now/Cancel Schedule). Server Action `deletePostAction`
(`apps/web/src/app/(app)/publish/drafts/actions.ts`) murni wiring, tanpa
business logic (rule 5). UI: icon trash merah per baris `DraftsList.tsx`

- `ConfirmActionDialog`/`useConfirmAction` (reuse pola Disconnect Account,
  Tier 2), `stopPropagation` di `onClick` dan `onKeyDown` supaya tidak ikut
  membuka Edit Draft.

Lolos review arsitektur Ridwan (0 temuan blocking — guard status dua
lapis solid, RBAC konsisten, tidak ada business logic bocor ke Server
Action; 1 catatan non-blocking soal nuansa ARIA "interactive-in-interactive"
tombol di dalam row, bukan bug fungsional). QA Najwa: 311 test pass/5
skip, browser end-to-end PASS seluruh golden path + regresi (Queue/History
dipastikan tidak berubah, RBAC Creator diverifikasi bisa hapus, draft
caption kosong tidak crash). Satu item **inconclusive** (bukan bug) —
verifikasi keyboard Enter/Space via tool Browser pane tidak konklusif
karena keterbatasan tooling otomasi itu sendiri (dibuktikan lewat kontrol:
tombol native "New Post" yang jelas berfungsi via klik mouse juga tidak
merespons Enter/Space lewat tool yang sama) — kode `onKeyDown` hanya
`stopPropagation` (bukan `preventDefault`), jadi behavior native
`<button>` seharusnya tetap jalan; direkomendasikan verifikasi manual
King Rezi di browser asli kalau ingin memastikan 100%.

- [x] **T-035.1** `PublishingService.deletePost` + aturan: post yang sudah published tidak dihapus dari platform (diperluas: hanya status `Draft` yang bisa dihapus sama sekali, lihat catatan scope di atas)
- [x] **T-035.2** Dialog konfirmasi Tier 2
- [x] **T-035.3** Aksi tersedia dari Drafts — scope dipersempit dari draft awal ("Drafts + Queue + History") oleh keputusan eksplisit King Rezi (lihat catatan di atas)

---

## Notification

### T-036 · In-app notification + Supabase Realtime

| Field         | Value                                                                                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done                                                                                                                                                                                                                                                 |
| **Domain**    | notification                                                                                                                                                                                                                                            |
| **ADR**       | ADR-023, ADR-030 (Supabase JWT)                                                                                                                                                                                                                         |
| **Depends**   | T-026 ✅ (sumber event notifikasi) · T-093 ✅ (accept-invite — butuh ≥2 akun nyata di satu workspace untuk verifikasi notifikasi antar-user, rantai ditetapkan 2026-08-28 saat merencanakan ADR-094; T-093 sudah Done 2026-08-31, tidak lagi memblokir) |
| **Baca dulu** | `05-architecture/realtime-strategy.md` · `apps/web/src/lib/better-auth/supabase-jwt.ts`                                                                                                                                                                 |

`Basic Notifications` berstatus **Should Have** di `mvp-definition.md` — ditempatkan di rilis ini karena hasil publish (`post.published` / `post.error`) tidak berguna tanpa cara memberi tahu pengguna. Domain `notification/` masih stub kosong; model `Notification` sudah ada di schema.

- [x] **T-036.1** Domain skeleton: service + repository
- [x] **T-036.2** Subscribe Supabase Realtime pada tabel `notifications`, event `INSERT`, filter per `user_id` — **hanya** tabel ini (ADR-023)
- [x] **T-036.3** Sambungkan Supabase JWT dari session Better Auth (helper sudah ada, belum dipakai di route manapun)
- [x] **T-036.4** UI notification bell di sidebar footer + panel daftar — rancangan sudah ada di Claude Design (**KI-039 Resolved**); ditutup 2026-09-07, lihat catatan di bawah
- [x] **T-036.5** Trigger notifikasi dari webhook publish result — diimplementasikan sebagai bagian **T-026** (`OutstandWebhookProcessor`, 2026-09-07): `post.error` → notifikasi ke `authorId` post, `account.token_expired` → notifikasi ke Owner workspace

**Catatan (2026-09-07) — T-036 ditutup `✅ Done`:** kode T-036.5 sudah lengkap dan lolos `typecheck`/`lint`/`test` di sesi yang sama dengan T-026. Blocker sebelumnya (3 migration T-026 belum di-deploy, **KI-048**) sudah resolved — King Rezi menjalankan `bun run db:deploy`, migration terverifikasi ter-apply, dan Najwa QA Engineer retest end-to-end nyata skenario `account.token_expired` (HTTP request langsung ke `/api/webhooks/outstand`): `WorkspaceConnectedAccount.reconnectRequired` jadi `true` **dan** notifikasi baru untuk Owner workspace, PASS. Dengan ini seluruh 5/5 subtask T-036 terverifikasi tuntas — task ditutup `✅ Done`. Detail retest lengkap: `tickets/v02-publishing-mvp.md` § T-026, `COMPLETE_TASK.md` (2026-09-07).

**Catatan (2026-08-31):** T-036.1 — skeleton `NotificationService.notify()` +
`notificationRepository.create()` ternyata sudah ada sebelumnya (dibangun
untuk Transfer Ownership T-008.3) tapi belum pernah punya test; ditambahkan
`notification.service.test.ts` (2 test case). Method CRUD lain
(list/markAsRead) sengaja ditunda ke T-036.4 supaya tidak menulis kode yang
belum terpakai. T-036.2 — file baru
`apps/web/src/lib/supabase/realtime/notifications.ts`
(`subscribeToNotificationInserts`) dan
`apps/web/src/lib/hooks/use-notification-realtime.ts`
(`useNotificationRealtime`, tanpa JSX). Ditemukan gap infra saat pengerjaan:
tabel `notifications` belum pernah masuk publication `supabase_realtime`
(Realtime tidak pernah broadcast apapun sebelumnya), dan RLS yang ada
berbasis `current_setting('app.current_user_id')`, bukan `auth.uid()` —
ditutup lewat migration
`20260831150000_t036_notifications_realtime_setup` (tambah tabel ke
publication + policy permisif baru `notifications_realtime_own_rows`
berbasis `auth.uid()`), sudah dijalankan (`db:deploy`) dan diverifikasi via
MCP Supabase. Ini closing gap yang memang sudah disyaratkan ADR-023, bukan
keputusan arsitektur baru — tidak ada ADR baru untuk ini.

**Catatan (2026-09-01):** T-036.3 — Route Handler baru
`apps/web/src/app/api/realtime/token/route.ts` (GET) mengecek session
Better Auth lalu menerbitkan Supabase Realtime JWT lewat
`createSupabaseRealtimeJwt` (helper sudah ada sejak awal, baru sekarang
dipakai). `useNotificationRealtime` diubah untuk fetch token dari endpoint
itu dan memanggil `client.realtime.setAuth(token)` sebelum subscribe.
Sekaligus dituntaskan method yang sengaja ditunda dari T-036.1: `list`,
`markAsRead`, `markAllAsRead` di `INotificationRepository` + implementasi
Prisma + `NotificationService`, plus Server Actions
`markNotificationReadAction`/`markAllNotificationsReadAction` di
`apps/web/src/app/(app)/components/notification-panel/actions.ts`. 3 test
case baru di `notification.service.test.ts` (total 5).

T-036.4 — bell trigger + badge unread di footer sidebar
(`WorkspaceSideNav.tsx`, sebelumnya `router.push` ke halaman settings,
sekarang membuka panel), komponen baru
`apps/web/src/app/(app)/components/notification-panel/NotificationBell.tsx`
(bell + panel + state + wiring realtime + mark-as-read). Threading data:
`layout.tsx` (fetch initial notifications via `NotificationService.list()`)
→ `AppSideNav.tsx` → `WorkspaceSideNav.tsx`. **KI-039 Resolved** — rancangan
Notifications Panel ternyata sudah ditambahkan ke Claude Design
(`components/notifications-panel.html`) sebelum sesi ini dimulai.

Temuan desain: spec Claude Design (NP-D08) menyebut Astryx `Drawer`, tapi
Astryx ter-pin (`@astryxdesign/core@0.4.3`) tidak punya komponen `Drawer`.
Emulasi dengan `Dialog` posisi edge gagal full-height (base style `Dialog`
hardcode `height: fit-content`, bentrok dengan positioning `top`+`bottom`).
King Rezi memutuskan (dikonfirmasi 2x) pakai wrapper selektif, bukan
`Dialog` — hasilnya `apps/web/src/components/ui/Drawer.tsx`, wrapper
selektif pertama di codebase ini, dirakit dari primitive Astryx resmi
(`useLayer` mode fixed/top-layer via native Popover API, `useFocusTrap`,
`useScrollLock`, `Stack`/`VStack`) — bukan swizzle/CSS manual. Preseden
untuk kasus serupa selanjutnya selama Astryx belum expose primitive
Drawer/Sheet generik.

**Bug ditemukan QA Najwa + fix:** notifikasi Realtime tidak muncul live
tanpa refresh (channel `SUBSCRIBED`, nol event, tanpa error terlihat). Root
cause (dikonfirmasi via diagnostic PostgREST 400→200): bukan
`SUPABASE_JWT_SECRET` mismatch, melainkan `auth.uid()` bawaan Supabase
selalu cast klaim JWT `sub` ke `::uuid`, padahal `userId` Better Auth
berformat `cuid()` — pola yang sudah diketahui di `with-current-user.ts`
(DO-D06) tapi luput diterapkan saat policy
`notifications_realtime_own_rows` dibuat di T-036.2. RLS gagal dievaluasi
untuk setiap user asli, Realtime menelan error itu diam-diam. Fix: migration
baru `20260901120000_t036_fix_realtime_rls_cuid_cast` (drop+recreate policy
supaya baca klaim `sub` sebagai text langsung, tanpa cast `::uuid`; tidak
menyentuh `auth.uid()` itu sendiri), diterapkan manual oleh King Rezi
(classifier auto-mode Claude Code memblokir eksekusi `prisma migrate
deploy` dari sesi manapun terhadap database live — batasan tooling, bukan
gap arsitektur). QA ulang: PASS (alur Transfer Ownership + insert manual).
Ini closing gap bug RLS, sama pola dengan migration T-036.2 — bukan
keputusan arsitektur baru, tidak ada ADR baru untuk ini.

Lolos review arsitektur Ridwan (tanpa temuan) dan QA Najwa (semua PASS
termasuk realtime live-update, setelah bug di atas ditemukan dan
diperbaiki). T-036 tetap `🟡 In Progress` — T-036.5 (trigger dari webhook)
belum dikerjakan.

**Catatan (2026-09-01) — KI-040:** setelah 2 ronde perbaikan styling panel
(ronde 1: padding/gap/border-radius list item; ronde 2: empty-state
vertical-centering + kontras border header dark mode), King Rezi melaporkan
lewat screenshot Chrome browser asli bahwa panel masih terlihat "banyak
yang terpotong atau tidak sempurna" dibanding Claude Design — root cause
belum teridentifikasi presisi (beda dari 2 bug sebelumnya yang sudah
diverifikasi lewat source Astryx). Dicatat sebagai **KI-040** (Open), butuh
sesi investigasi visual terpisah; dihentikan sementara atas instruksi
eksplisit King Rezi. Tidak mengubah status T-036.4 (`[x]`, tetap selesai
secara fungsional/lolos QA) — ini murni polish visual belum tuntas 100%.

**Catatan (2026-09-01) — T-036.4 dibuka kembali:** review lanjutan
membandingkan langsung ke spec Claude Design (`components/notifications-panel.html`)
menemukan 5 gap visual konkret pada `NotificationBell.tsx` yang sebelumnya
luput: (1) background tint untuk item unread, (2) dot indikator unread,
(3) icon circle badge, (4) weight/warna title yang harus berbeda per status
(read vs unread), dan (5) deskripsi yang harus terpotong dengan ellipsis.
Kelima gap ini sudah diperbaiki oleh subagent lain langsung di
`apps/web/src/app/(app)/components/notification-panel/NotificationBell.tsx`
(lint + `tsc` bersih), **tapi verifikasi visual di browser belum sempat
dilakukan** — dev server minta login dan tidak ada kredensial test yang
tersedia di sesi ini. Karena subtask ini menyangkut styling UI yang harus
match spec Claude Design, dan verifikasi visual belum terbukti, checklist
T-036.4 dikembalikan ke `[ ]` (dari `[x]`) sampai ada sesi berikutnya yang
memverifikasi tampilan asli di browser cocok dengan spec. Tidak menambah KI
baru — ini bagian dari root cause investigation yang sama dengan KI-040
(masih **Open**), bukan temuan independen baru.

**Catatan (2026-09-02) — KI-040 Closed:** ditutup lewat **T-098.3**
(`tickets/v07-astryx-shadcn-migration.md` § T-098, migrasi `NotificationBell.tsx`
dari wrapper custom `Drawer.tsx` ke shadcn `Sheet` asli). Diverifikasi Najwa
QA Engineer lewat browser nyata (light & dark mode) — root cause lama
(geometri/proporsi wrapper `Drawer` custom) hilang bersama penggantian ke
`Sheet`. Entry KI-040 sudah dihapus dari `PROJECT_STATE.md` § Known Issues
sesuai aturan (Resolved yang sudah tercatat `COMPLETE_TASK.md` tidak
dibiarkan dengan status Resolved di daftar itu).

**Penutupan (2026-09-07) — T-036.4 Done:** dicek dulu ke Claude Design
(project "Social Media Management", `components/notifications-panel.html`

- `styles.css` § "Notifications Drawer") sesuai gate AGENTS.md rule 17,
  lalu dibandingkan baris demi baris ke `NotificationBell.tsx`. 4 dari 5 gap
  yang dicatat 2026-09-01 sudah benar sejak sesi T-098.3 (bg tint unread,
  dot indikator, weight/warna title read vs unread, deskripsi truncate
  ellipsis) — hanya 1 gap tersisa yang ditemukan: **icon circle status**
  masih dipetakan ke workaround netral `bg-muted text-foreground` untuk
  kasus "success", padahal **KI-041 sudah Resolved** (ADR-098, 2026-09-04)
  menambah token asli `--success`/`--warning` ke Stone theme shadcn — gap
  ini murni kode yang belum di-update mengikuti token baru itu, bukan temuan
  desain baru. Diperbaiki: `bg-muted text-foreground` → `bg-success/10
text-success` (pola identik `bg-destructive/10 text-destructive` yang
  sudah ada untuk "error"), komentar kode yang menyebut KI-041 belum
  resolved juga diperbarui.

Verifikasi visual: dev server sesi ini sudah berjalan dengan sesi login
nyata (workspace "Insvire", akun Maya Anggraini) — tabel `notifications`
kosong (0 baris di seluruh database, dicek via Supabase MCP), jadi
item unread/read tidak bisa dipicu dari data nyata tanpa T-036.5 (trigger
webhook, belum dikerjakan). Diverifikasi dengan menyisipkan data
sementara langsung di state React (bukan menulis ke database — akses
Supabase MCP sesi ini read-only) untuk 3 skenario (unread-success,
unread-error, read), dibaca lewat DOM computed style (bukan hanya
screenshot, karena overlay Next.js dev-tools indicator menutupi sudut
kiri-bawah sidebar footer di Browser pane preview): warna icon success
resolve ke `rgb(195,209,197)` (persis token `--success` dark mode
`#c3d1c5`) dan error ke token `--destructive` — sesuai spec. Dot unread,
`font-semibold` vs `font-normal text-muted-foreground` pada title, dan
`truncate` pada deskripsi juga dikonfirmasi hadir di markup. Data
sementara ini **tidak disimpan** — hanya di state komponen sesi browser,
direvert dari kode sebelum sesi selesai (`git diff` bersih). `bun run
typecheck` PASS. T-036.5 (trigger webhook) tetap task terpisah, belum
dikerjakan — T-036 tetap `🟡 In Progress`.

**Follow-up (2026-09-07) — regresi alignment header ditemukan King Rezi
langsung di browser:** setelah penutupan di atas, King Rezi mereview
tampilan asli di localhost:3000 dan melaporkan 3 hal: (1) title
"Notifications", "Mark all as read", dan tombol close tidak sejajar, (2)
padding/margin header tidak sesuai spec, (3) minta dipastikan ulang kode
sama persis dengan Claude Design. Root cause: tombol close **bawaan**
`SheetContent` (shadcn) diposisikan `absolute top-4 right-4` — independen
dari baris flex header manapun — sedangkan `SheetHeader` sebelumnya masih
memakai padding default `p-6` (24px, bukan `p-4`/16px sesuai spec
`.notif-header { padding: var(--spacing-4) }`). Kombinasi keduanya
membuat title+"Mark all as read" (flex row, pusat vertikal mengikuti
padding 24px) dan tombol close (pusat vertikal mengikuti posisi absolute
16px) tidak pernah sejajar secara matematis, berapa pun classname
di-tweak di baris flex-nya saja.

**Perbaikan:** `SheetContent showCloseButton={false}` (menonaktifkan
tombol close bawaan yang absolute), tombol close dirender manual sebagai
flex-sibling di dalam grup aksi kanan bersama "Mark all as read" — pola
identik dengan `DialogHeader` di `draft-editor/Modal.tsx` (baris ~530-573)
yang sudah lebih dulu memecahkan masalah yang sama untuk `Dialog`. Header
diubah ke `p-4` (16px, token `--spacing-4`) + `gap-3` (12px, token
`--spacing-3`) — match persis `.notif-header` spec Claude Design. Grup
kanan (`.notif-header-actions` spec) dibungkus `<div className="flex
items-center gap-3">` supaya title vs grup-aksi diatur `justify-between`,
dan di dalam grup, markall vs close diatur `gap-3` juga (sesuai
`.notif-header-actions { gap: var(--spacing-3) }`).

**Verifikasi:** dicek lewat `getBoundingClientRect()` tiap elemen header —
kedua button (`top: 16, bottom: 48`, height 32px identik) dan title
(`top: 20, bottom: 44`, center di 32px — persis sama dengan center kedua
button) sekarang benar-benar sejajar secara matematis, bukan cuma terlihat
sejajar. `getComputedStyle` header: `padding: 16px`, `gap: 12px`,
`alignItems: center`, `justifyContent: space-between` — match spec.
Diverifikasi juga klik tombol close manual (`setIsOpen(false)`, sheet
controlled) benar-benar menutup panel (`sheet-content` hilang dari DOM).
`bun run typecheck` PASS.

---

## Developer Experience

### T-037 · Perkaya aturan coding di `context/ctx-development.md`

| Field         | Value                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------- |
| **Status**    | 🟡 In Progress — kontinu by design, snapshot kedua (T-037.4–.6) sudah dicatat 2026-10-13 |
| **Domain**    | DX                                                                                       |
| **ADR**       | ADR-034                                                                                  |
| **Depends**   | —                                                                                        |
| **Baca dulu** | `06-engineering/dx-tooling.md` · `context/ctx-development.md`                            |

Berjalan **kontinu** selama rilis ini, bukan sekali selesai: setiap kali konvensi baru muncul dari praktik nyata (bukan teori), catat ke `ctx-development.md` supaya lapisan konteks yang dibaca setiap agent tidak menjadi basi. Prioritas rendah — tidak memblokir rilis.

- [x] **T-037.1** Catat konvensi struktur repository: interface di `src/domains/*/repositories/`, implementasi Prisma di `src/lib/repositories/*/` — sudah konsisten di `workspace` + `publishing`, tapi belum tertulis sebagai aturan sehingga domain baru bisa menyimpang
- [x] **T-037.2** Catat konvensi penempatan use-case terpisah dari service (preseden: `schedule-posts.use-case.ts`)
- [x] **T-037.3** Catat konvensi test: service diuji dengan repository fake (preseden yang sudah ada di `publishing`/`workspace`)
- [x] **T-037.4** Catat konvensi error yang sampai ke user sebagai `{ error }`: subclass `ApplicationError` + `toActionError()` hanya di Server Action yang mengembalikan `{ error }`; action `void` / `redirect` / `null` tidak diubah kontraknya (preseden `getOutstandAdapter()`, T-090.5; kontra-preseden `markNotificationReadAction`, `getCalendarPostAction`)
- [x] **T-037.5** Catat konvensi query Prisma baca dan tulis pada tabel ber-RLS: `withCurrentUser` / `setCurrentUserId`, query di dalam callback memakai client `tx`; tanpa GUC, `findMany` kosong dan `updateMany`/`deleteMany` 0 baris secara senyap (preseden `updateImportWatermark`, `getMember`)
- [x] **T-037.6** Catat konvensi penamaan port/interface baru tanpa awalan `I`; `IXxxRepository` dan adapter historis bukan pola untuk port baru (CC-D04)

**Selesai (2026-09-08):** ketiga subtask dicatat di `context/ctx-development.md` (section struktur repository & use-case, plus pola fake repository di section Testing), dengan preseden nyata yang diverifikasi di kode: repository dua-lapis (`domains/publishing/repositories/` ↔ `lib/repositories/publishing/`), use-case terpisah (`SchedulePostsUseCase`, `PublishNowUseCase`, `CancelScheduleUseCase`, `AnalyticsIngestionUseCase`), dan pola `createFakeRepository()` di `publishing.service.test.ts`. Pada tanggal itu butir-butir itu bernomor #14–#18. Sejak snapshot kedua, testing ada di aturan #15–#17; nomor #18 adalah aturan error. Task tetap berjalan kontinu (prioritas rendah, tidak memblokir rilis) — subtask ini ditutup sebagai snapshot pertama, bukan penutupan total scope task.

**Snapshot kedua (2026-10-13):** T-037.4–.6 dicatat sebagai aturan #18–#20 di `context/ctx-development.md` (section "Dari praktik yang sudah terbukti di kode"), plus dua butir checklist sebelum task kode selesai. Aturan git bergeser jadi #21–#22. Preseden diverifikasi di kode: `toActionError` / `ExternalServiceError` di `lib/utils/errors.ts` dan `getOutstandAdapter()`; `withCurrentUser` di `lib/prisma/with-current-user.ts` (dipakai repository publishing, workspace, analytics, media, notification, engagement); port baru tanpa awalan `I` (`PostMediaLookupPort`, `EnqueueAnalyticsSyncAccountsPort`). Detail panjang tetap di `code-conventions.md` (CC-D01, CC-D02, CC-D04) — file konteks hanya menyimpan aturan operasional. Task tetap `🟡 In Progress`.

**Koreksi review (2026-10-13):** aturan #18 dibatasi ke Server Action yang mengembalikan `{ error }` — `markNotificationReadAction` (`void` + `redirect`) dan `getCalendarPostAction` (`null`) tidak dipaksa lewat `toActionError()`. Aturan #19 mencakup baca dan tulis, dan query di dalam callback wajib memakai client `tx`. Catatan 2026-09-08 tidak lagi menyebut nomor #18 sebagai butir Testing.

---

## Import

### T-090 · Import Posts dari Social Account (status `Imported`, read-only)

| Field         | Value                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**    | ✅ Done (5/5 subtask, 2026-10-08)                                                                                                                                                                                        |
| **Domain**    | publishing                                                                                                                                                                                                               |
| **ADR**       | ADR-093                                                                                                                                                                                                                  |
| **Depends**   | T-013.1–.3 ✅ (Connect Account — trigger otomatis; sisa T-013.4 operasional) · T-025 (real adapter, Fake dulu pola ADR-059) · T-034 (History, untuk tampilan lengkap — bagian Calendar bisa jalan duluan tanpa menunggu) |
| **Baca dulu** | `05-architecture/integration-layer.md` · `05-architecture/background-jobs.md` · `05-architecture/domain-model.md` · `decisions/ADR-093-import-posts-dari-social-account-status-imported-read-only.md`                    |

Outstand punya endpoint berbayar `POST /v1/social-accounts/{id}/imports` untuk menarik post yang dibuat langsung di platform sosial (bukan lewat tool kita) — ditemukan saat diskusi Realtime Calendar (2026-08-28), dikerjakan sebagai fitur terpisah (ADR-093). Tiga jalur trigger (otomatis saat connect, periodik cron harian, manual dari Settings) dengan pengaman biaya berlapis karena endpoint ini berbayar — lihat ADR-093 untuk detail lengkap tiap keputusan.

- [x] **T-090.1** Shared enum `ContentStatus.Imported` (`packages/shared`) + migration: `PublishingPost.authorId` nullable, `WorkspaceConnectedAccount.lastImportedUntil`/`lastImportRequestedAt` baru (ADR-093 poin 1, 3, 6)
- [x] **T-090.2** Kontrak ACL `IOutstandAdapter.importPosts`/`fetchImportJobStatus` + `FakeOutstandAdapter.importPosts` (pola instant-success ADR-059, ADR-093 poin 5, 10)
- [x] **T-090.3** `JOB-05 — Import Posts Trigger`: 3 entry point (otomatis on-connect, periodik Railway Cron harian, manual Server Action dari Settings) + guard concurrent-import per akun + 3 lapis pengaman biaya jalur manual (RBAC Owner/Admin, cooldown 24 jam/akun, cap 1x/minggu/workspace via `background_jobs`) (ADR-093 poin 7, 8, 9)
- [x] **T-090.4** `JOB-06 — Import Posts Webhook Processing`: upsert `PublishingPost`/`PublishingPostTarget` status `Imported`, dedup via `platformPostId`, update watermark `lastImportedUntil` (ADR-093 poin 4, 7)
- [x] **T-090.5** UI: kartu `Imported` di Calendar + tombol "Sync Now" di Settings → Connected Accounts + state loading/hasil job — selesai (ADR-093 poin 2, 11)

**Catatan (2026-10-08) — T-090.1–T-090.4 selesai (Elon Backend Engineer, review Ridwan Architecture Reviewer, QA Najwa QA Engineer):** `bun run typecheck`/`lint` PASS, `bun run test` 350 passed/5 skipped/0 failed. **T-090 tetap `🟡 In Progress`** — T-090.5 (UI) saat catatan ini ditulis masih `blocked`.

**Update (2026-10-08, lanjutan) — T-090.5 tidak lagi blocked, rancangan sudah dikunci di Claude Design:** King Rezi minta rekomendasi desain → sesi utama memberi rekomendasi berbasis pola UI existing (badge/popover/connected-accounts) → King Rezi setuju delegasikan ke Neymar Product Designer → `DesignSync` gagal dimuat di sesi Neymar (kejadian ke-9, pola sama yang sudah tercatat di `.claude/agents/README.md`) → King Rezi beri izin eksplisit sesi utama mengerjakan langsung di Claude Design (pola sama 8 kejadian sebelumnya) → `DesignSync` berhasil dimuat di sesi utama, rancangan dibuat & dikunci di project "Social Media Management":

- `components/status-chips.html` — badge Imported, variant neutral/gray (reuse token Draft, BUKAN hue baru), sejalan dengan shadcn `Badge variant="secondary"` di kode.
- `components/popover.html` — kolom ke-3 "Imported (read-only, T-090)": CTA "Buka Draft Editor" dihilangkan total (bukan disabled), diganti "Lihat di [Platform] →" (link `platformPostUrl`) + baris teks read-only note; metrics block sengaja tidak ditampilkan default.
- `templates/settings-connected-accounts.html` — tombol "Sync Now" (ikon refresh) sebelum badge status, variant sama seperti "Disconnect" (bukan primary); blok referensi 3 state (Default/Loading/Ditolak) di bawah tabel.
- `styles.css` — `.chip-imported`, `.popover-readonly-note`, `.icon-spin` ditambahkan, semua ditandai komentar "LOCKED PATTERN (T-090.5, ADR-093, 2026-10-08, King Rezi confirmed)".

Delegasi implementasi ke Mark UI Engineer sempat berhenti sekali karena catatan task file ini belum ter-update (masih bilang "blocked") padahal rancangan sudah ada — dikoreksi lewat update ini. Mark UI Engineer tidak punya akses `DesignSync` di sesi subagent (keterbatasan yang sama, lihat `.claude/agents/README.md`), jadi isi file rancangan diteruskan manual oleh sesi utama sebagai konteks terverifikasi.

File baru: `apps/web/prisma/migrations/20261008120000_t090_1_import_posts_schema/migration.sql`, `apps/web/src/domains/publishing/repositories/import-job.repository.ts` (+impl Prisma), `apps/web/src/domains/publishing/services/import-posts-process.use-case.ts` (+test), `apps/web/src/domains/publishing/services/import-posts-trigger.use-case.ts` (+test).

Keputusan implementasi non-trivial (dinilai konsisten dengan presedan yang sudah ada, bukan penyimpangan baru — diverifikasi Ridwan, tidak memerlukan ADR terpisah dari ADR-093):

1. **Migration SQL ditulis manual, belum diverifikasi lewat `prisma migrate dev`/`diff` sungguhan** — worktree sesi ini tidak punya akses `DATABASE_URL`. **Wajib diverifikasi** (apply/diff) oleh sesi berikutnya yang punya akses DB sebelum dianggap final di environment nyata.
2. JOB-05 dan JOB-06 dipanggil **sinkron** dalam satu eksekusi (bukan 2 job async terpisah lewat `background_jobs`) — mengikuti presedan pragmatis yang sudah ada di `OutstandWebhookProcessor` (JOB-01), karena job runner asli `/api/jobs/run` (T-027) belum dibangun. Baris `background_jobs` tetap diinsert untuk audit log/cap-counting sesuai ADR-093 poin 7–9.
3. Cross-domain `workspace` → `publishing` memakai pola Port lokal (`ImportPostsAutoTriggerPort`), konsisten dengan presedan existing `ScheduledCountsPort`/`NotificationPort` — bukan import lintas modul langsung.
4. Guard concurrent-import disederhanakan jadi cek status `pending`/`running` saja (bukan kondisi literal ADR-093 poin 8) — valid karena pemrosesan sinkron membuat window itu satu-satunya state transien yang mungkin terjadi.
5. **Gap diketahui, didokumentasikan bukan diselesaikan** (lihat **KI-088**): `triggerPeriodicForAccounts` (trigger cron periodik) butuh `actingUserId` per akun yang di-resolve caller — trigger cron asli tidak punya sesi user. Didokumentasikan sebagai gap di docstring kode, kandidat resolusi (mis. Account Owner workspace) belum final, menunggu keputusan produk. KI-059 tidak dipakai di sini: nomor itu sudah milik verifikasi upload media T-024 (Resolved 2026-09-15).
6. Defensive fix di luar scope literal T-090.1–4, diperlukan karena enum baru `Imported` memaksa exhaustiveness check TypeScript: `PublishingService.listCalendarPosts`/`getCalendarPostById` default-exclude status `Imported` dari query (`CALENDAR_DEFAULT_STATUSES_EXCLUDING_IMPORTED`) — mencegah jalur Realtime granular-patch Calendar/Drafts/Queue membocorkan kartu `Imported` placeholder ke UI sebelum desain T-090.5 disetujui. Placeholder exhaustiveness ditambahkan di `status-badge.ts`, `calendar-grid-shared.ts`, `history-status.ts`, ditandai eksplisit sebagai placeholder sementara, bukan desain final.

**Addendum (2026-10-08) — bug nyata ditemukan baru setelah klaim "selesai" di atas, lewat testing browser+DB sungguhan King Rezi:** setelah catatan penutupan T-090.1–4 ditulis, King Rezi minta diuji langsung di browser (bukan subagent). Sesi utama setup `.env.local` worktree, `bunx prisma migrate deploy` migration T-090.1 ke database dev Supabase sungguhan, jalankan dev server, lalu test alur Connect Account (Settings → Connected Accounts) yang men-trigger auto-import (JOB-05 → JOB-06).

**Bug ditemukan:** `updateImportWatermark` di `apps/web/src/lib/repositories/workspace/workspace.repository.ts` memakai `prisma` client plain, bukan dibungkus `withCurrentUser(actingUserId, ...)` — padahal tabel `workspace_connected_accounts` punya RLS policy `FOR ALL` yang butuh `app.current_user_id` ter-set. Tanpa context itu, `updateMany` selalu match 0 baris secara **senyap** (silent no-op by design — justru menyembunyikan kegagalan RLS, bukan throw error). Akibatnya `lastImportedUntil`/`lastImportRequestedAt` tidak pernah tersimpan ke database sungguhan meski use-case memanggilnya dengan benar dan job tercatat `status: "done"`. Bug ini **lolos dari unit test + review Ridwan + QA Najwa sebelumnya** karena ketiganya memakai fake repository, bukan Prisma+RLS asli — tidak ada test yang memverifikasi RLS context sungguhan.

**Dampak (sebelum fix):** (1) tujuan watermark ADR-093 poin 6 (mencegah pemborosan call Outstand berbayar) gagal total — tiap sync selalu pakai `since` 90 hari lagi; (2) guard cooldown 24 jam manual trigger (ADR-093 poin 9, salah satu dari 3 lapis pengaman biaya) tidak pernah aktif karena bergantung `lastImportRequestedAt` yang selalu `null`. Data `PublishingPost` sendiri **tidak korup** — dedup via `platformPostId` tetap benar, 4 post `Imported` berhasil ter-insert dengan benar di test reproduce ini.

**Fix (Elon Backend Engineer):** kontrak `IWorkspaceRepository.updateImportWatermark` + port lokal `ConnectedAccountWatermarkPort` (`import-posts-trigger.use-case.ts`) sekarang wajib `actingUserId: UserId` (field ini sudah ada di semua input use-case, tidak perlu ubah signature publik `triggerAuto`/`triggerPeriodicForAccounts`/`triggerManual`). Implementasi Prisma membungkus `updateMany` dengan `withCurrentUser(actingUserId, ...)`, konsisten dengan presedan `reconnectAccount`/`disconnectAccount`/`createConnectedAccount` di file yang sama. Docstring lama yang salah klaim "aman tanpa RLS context" dikoreksi. Test unit diupdate untuk assert `actingUserId` diteruskan dengan benar.

**Verifikasi final (sesi utama, 2x independen):** `bun run typecheck`/`lint`/`test` → PASS, 350 passed/5 skipped/0 failed. Live end-to-end di database dev Supabase sungguhan: connect akun LinkedIn baru ("Fake Company 7283") → 4 `PublishingPost` `Imported` ter-insert benar, TAPI watermark masih `null` (bug reproduce dikonfirmasi). Setelah fix, ulangi test independen dengan akun TikTok baru ("@fake.tiktok.3902") → watermark (`lastImportedUntil`/`lastImportRequestedAt`) kali ini tersimpan benar (`2026-10-08T04:33:30.150Z`), 4 post `Imported` lagi ter-insert benar. Bug resolved, diverifikasi 2x secara independen (bukan cuma laporan Elon sendiri). Data test (`Fake Company 7283`/LinkedIn, `@fake.tiktok.3902`/TikTok, beserta `PublishingPost` `Imported`-nya) sengaja dibiarkan di database dev workspace `b28e4284-39e5-4d24-ad27-32c2cb286880` — konsisten gaya fixture lain yang sudah ada di situ (`turanilkerl`, `Cook It Real Good`).

**Pelajaran/pattern risk lebih luas (dicatat di sini, bukan KI terpisah — lihat pertimbangan di `PROJECT_STATE.md`):** unit test dengan fake repository tidak cukup untuk menjamin korektnes RLS context — hanya test Prisma+RLS asli (jarang dijalankan, cuma segelintir file integration-style di codebase) yang bisa menangkap kelas bug ini. T-090 jadi bukti konkret pertama gap ini bermaterialisasi jadi bug nyata, bukan sekadar risiko teoretis. Status T-090.1–T-090.4 tetap dianggap selesai dari sisi implementasi (bug sudah diperbaiki dan diverifikasi ulang) — ini koreksi/pelengkap catatan, bukan regresi status.

**Update (2026-10-08, final) — T-090.5 selesai, T-090 ditutup penuh 5/5 subtask (`✅ Done`):**

**Implementasi (Mark UI Engineer):**

- Badge `Imported` — variant `outline` (reuse token Draft; **dikoreksi dari rekomendasi awal `secondary`** di catatan Claude Design di atas, karena baseline kode nyata `Draft` memang `outline` — catatan di Claude Design juga sudah dikoreksi menyusul).
- `CalendarPostPopover.tsx` — varian read-only untuk Imported: tombol "Buka Draft Editor" dihilangkan total, diganti link "Lihat di [Platform] →" (fallback disabled kalau `platformPostUrl` kosong), ditambah catatan read-only, metrics block tidak ditampilkan.
- `ConnectedAccountsList.tsx` — `SyncNowButton` baru (3 state: default/loading/ditolak), muncul sebelum badge status HANYA untuk akun `active` + role dengan akses kelola Connected Accounts (RBAC hide total untuk Creator, bukan disabled). Variant `secondary` (padanan terdekat "aksi rutin", karena "Disconnect" asli di kode sudah `destructive`, bukan match literal mockup).

**Pelonggaran filter (Prabowo Feature Engineer):** `PublishingService.listCalendarPosts`/`getCalendarPostById` — konstanta `CALENDAR_DEFAULT_STATUSES_EXCLUDING_IMPORTED` (lihat poin 6 di atas) DIHAPUS, post `Imported` sekarang tampil apa adanya di Calendar.

**Bug ditemukan & diperbaiki (Najwa QA Engineer menemukan, Elon Backend Engineer memperbaiki):** klik "Sync Now" tanpa `OUTSTAND_API_KEY` ternyata CRASH halaman total (Next.js Runtime Error overlay, bukan toast rapi seperti didesain) — root cause: `getOutstandAdapter()` (`apps/web/src/lib/adapters/outstand/index.ts`) melempar `Error` polos, sementara helper `toActionError()` (dipakai banyak file `actions.ts` lain di seluruh codebase) hanya menangani `instanceof ApplicationError`. Fix: ganti jadi `throw new ExternalServiceError(...)` (class di `errors.ts`, extends `ApplicationError`). **Dampak perbaikan ini lebih luas dari T-090.5** — memperbaiki pola yang sama di semua Server Action lain yang memanggil `getOutstandAdapter()` tanpa key terisi, tidak hanya Sync Now.

**Gap verifikasi (belum tuntas, bukan bug diketahui):** verifikasi visual end-to-end "Sync Now" (klik tombol → lihat toast rapi di browser) belum bisa dituntaskan — baik sesi Elon maupun sesi utama dibatasi sandbox ("Modify Shared Resources") saat mencoba menulis fixture `WorkspaceConnectedAccount` langsung ke database dev untuk test (workspace yang tersedia tidak punya akun terhubung, dan connect akun baru lewat UI sekarang butuh `OUTSTAND_API_KEY` asli sejak ADR-119 — jalur Fake loopback sudah dihapus). Fix sudah diverifikasi lewat: (a) pembacaan kode manual (jalur `toActionError` straightforward, `ExternalServiceError extends ApplicationError` tetap `instanceof Error`), (b) unit test `index.test.ts` yang mengonfirmasi `getOutstandAdapter()` tetap throw dengan message yang sama, (c) grep menyeluruh ke semua test yang menyentuh `getOutstandAdapter`, tidak ada regresi. Disarankan King Rezi atau sesi dengan akses DB penuh melakukan verifikasi visual manual kapan pun sempat — **tidak dibuat Known Issue formal** (bukan bug yang diketahui ada, hanya verifikasi yang tertunda); dicatat di sini sebagai pengingat saja.

**Review (Ridwan Architecture Reviewer):** bersih, tidak ada pelanggaran AGENTS.md #5-9. 1 temuan dokumentasi minor (komentar basi di `calendar-grid-shared.ts` yang masih mengklaim Imported di-exclude) — sudah diperbaiki.

**Insiden proses (pelajaran, dicatat untuk sesi berikutnya):** sesi utama sempat lupa update task file ini untuk mencerminkan "tidak lagi blocked" setelah desain T-090.5 dikunci di Claude Design — menyebabkan Mark UI Engineer (benar) sempat menghentikan pekerjaan karena source-of-truth task file bertentangan dengan brief yang diterima. Sudah dikoreksi. **Pelajaran:** setiap kali sesi utama mengerjakan Claude Design sebagai fallback Neymar, WAJIB langsung update task file di commit/turn yang sama, jangan ditunda. Mark UI Engineer dan Najwa QA Engineer juga tidak punya akses `DesignSync` di sesi subagent (konsisten pola sebelumnya) — isi rancangan diteruskan manual oleh sesi utama.

**Verifikasi final:** `bun run typecheck`/`lint` PASS, `bun run test` 638 passed/6 skipped/0 failed.

**T-090 sekarang `✅ Done` (5/5 subtask).**

**Addendum (2026-10-15) — KI-088 resolved (gap `actingUserId` jalur periodik ditutup, Elon Backend Engineer):** King Rezi diminta memilih lewat `AskUserQuestion` antara dua kandidat resolusi (konsisten `.claude/skills/proactive-clarification/SKILL.md`, karena KI-088 eksplisit mencatat "belum final, menunggu keputusan produk"): (a) reuse pola JOB-04 `AnalyticsSyncJobHandler`/JOB-03 `EngagementSyncJobHandler` — resolve `actingUserId` lewat Owner workspace dari akun itu sendiri (`findAccountOwnerByOutstandAccountId`), sudah teruji produksi di dua job lain; (b) `Workspace.ownerId` langsung (kandidat lama yang disebut di docstring sebelumnya, belum ada precedent implementasi). **King Rezi memilih opsi (a).**

Implementasi: `ConnectedAccountWatermarkPort` (`import-posts-trigger.use-case.ts`) ditambah method `findAccountOwnerByOutstandAccountId` (structural-typing cocok dengan `IWorkspaceRepository` yang sudah ada — composition root `createImportPostsTriggerUseCase` TIDAK perlu dependency baru, `workspaceRepository` yang sudah dipakai untuk `connectedAccounts` sudah mengimplementasikan method ini juga). `TriggerPeriodicAccountInput.actingUserId` **dihapus** — `triggerPeriodicForAccounts` sekarang me-resolve-nya sendiri per akun (lookup gagal/akun tidak aktif ditangani sama seperti kegagalan lain di batch, tidak menghentikan akun lain — konsisten semangat per-akun independen yang sudah ada). Docstring gap di `TriggerPeriodicAccountInput`, `IWorkspaceRepository.updateImportWatermark`, dan `IPublishingRepository.upsertImportedPosts` dikoreksi (tidak lagi menyebut gap terbuka).

**Review Ridwan Architecture Reviewer — 0 pelanggaran arsitektur, 1 temuan test-coverage (ditutup):** structural-typing port (field tambahan `handle` di `IWorkspaceRepository` tidak dideklarasikan di port lokal) diverifikasi aman (width subtyping, bukan object literal — excess property check tidak berlaku), dikonfirmasi `tsc --noEmit` bersih. Tidak ada caller produksi lain yang masih mengirim `actingUserId` ke `TriggerPeriodicAccountInput` (grep menyeluruh, cron belum diwiring). Satu gap ditemukan: test baru belum menutup branch sanity-check "owner ditemukan tapi `workspaceId`/`connectedAccountId` tidak cocok" — padahal precedent yang direplikasi (`analytics-sync-job-handler.test.ts`, `engagement-sync-job-handler.test.ts`) punya test eksplisit untuk ini. Ditutup: 1 test tambahan untuk branch mismatch tersebut.

Test unit final: 3 kasus baru (resolve lewat owner lookup; owner lookup kosong → failed terisolasi per akun; owner lookup mismatch workspace/connectedAccountId → failed terisolasi) + 1 kasus existing disesuaikan (tidak lagi menyuplai `actingUserId` di input). `bun run typecheck` PASS, test file ini 20/20 passed, domain `publishing` penuh 272/272 passed (sebelum test tambahan terakhir; +1 setelahnya).

**Catatan:** cron wiring asli (`triggerPeriodicForAccounts` belum dipanggil produksi oleh Railway Cron manapun) tetap di luar scope — sama seperti sebelumnya, tidak berubah oleh KI-088. KI-088 murni soal SUMBER `actingUserId`, bukan wiring cron-nya.

### T-112 · Wiring `IOutstandAdapter.importPosts`/`fetchImportJobStatus` ke endpoint Outstand sungguhan

| Field         | Value                                                                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done (5/5 subtask, 2026-10-09)                                                                                                                                                                                                           |
| **Domain**    | integration                                                                                                                                                                                                                                 |
| **ADR**       | ADR-093, ADR-119 (pola stub-throw "throw loud" alih-alih Fake di produksi), ADR-123 (wiring sungguhan — breaking change signature `fetchImportJobStatus` + pemetaan status `partial`)                                                       |
| **Terkait**   | T-090 ✅ (seluruh plumbing aplikasi — DB, job trigger, UI — sudah selesai dan terverifikasi; task ini HANYA menyisakan panggilan HTTP sungguhannya)                                                                                         |
| **Depends**   | `OUTSTAND_API_KEY` (sudah tersedia) · verifikasi wire-format `POST /v1/social-accounts/{id}/imports` terhadap OpenAPI spec resmi Outstand (belum pernah dilakukan — beda dari endpoint lain di `RealOutstandAdapter` yang sudah)            |
| **Baca dulu** | `05-architecture/integration-layer.md` · `decisions/ADR-093-import-posts-dari-social-account-status-imported-read-only.md` · `apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts` (docstring `importPosts`/`fetchImportJobStatus`) |

Ditemukan King Rezi (2026-10-08) saat testing manual "Sync Now" lewat browser+DB
Supabase dev sungguhan (akun Facebook "Cook It Real Good") — awalnya dikira
bug ("kenapa belum terhubung padahal `OUTSTAND_API_KEY` sudah ada dan Connect
Account sudah terbukti jalan ke platform sungguhan?"), ternyata memang
**gap yang belum pernah dibuatkan task-nya**. T-090 ditutup `✅ Done` tanpa
menyertakan wiring HTTP sungguhan untuk endpoint import — `RealOutstandAdapter
.importPosts`/`.fetchImportJobStatus` (`apps/web/src/lib/adapters/outstand/
real-outstand-adapter.ts`) sengaja ditulis **stub-throw** (`OutstandIntegrationError`,
bukan diam-diam mengembalikan data kosong/palsu — pola "throw loud" ADR-059)
karena wire-format `POST /v1/social-accounts/{id}/imports` belum pernah
diverifikasi terhadap OpenAPI spec resmi Outstand — persis pola yang sudah
berkali-kali terjadi di endpoint lain sebelum diperbaiki (lihat ADR-113
komentar/reply, ADR-115/ADR-116 Facebook, ADR-118 Pinterest `board_id`):
dokumentasi Outstand beberapa kali ternyata tidak cocok dengan API
sungguhannya, jadi tim sengaja menahan implementasi sampai diverifikasi
langsung, bukan menebak dari dokumentasi saja.

**Dampak saat ini:** setiap klik "Sync Now" (manual, maupun trigger
otomatis on-connect/periodik) **selalu** berakhir `status: "failed"` dengan
pesan stub-throw yang eksplisit — fitur Import Posts tidak bisa benar-benar
menarik data post dari platform sosial sampai task ini selesai. Cap mingguan
manual (code review PR #148) sudah tidak lagi menghitung percobaan yang
gagal karena ini, jadi minimal tidak mengunci jatah sinkronisasi — tapi
fiturnya sendiri tetap tidak berfungsi.

- [x] **T-112.1** Verifikasi wire-format `POST /v1/social-accounts/{id}/imports` (request/response shape, auth, error codes) langsung terhadap OpenAPI spec resmi Outstand — jangan asumsikan dari deskripsi fitur di ADR-093
- [x] **T-112.2** Implementasi `RealOutstandAdapter.importPosts` sungguhan (ganti stub-throw) sesuai hasil verifikasi T-112.1
- [x] **T-112.3** Verifikasi wire-format `GET` status import job (dipakai `fetchImportJobStatus`) — kemungkinan polling atau webhook, cek OpenAPI spec apakah ada event webhook terpisah untuk ini (konsisten pola `OutstandWebhookProcessor` kalau ada)
- [x] **T-112.4** Implementasi `RealOutstandAdapter.fetchImportJobStatus` sungguhan (ganti stub-throw) sesuai hasil verifikasi T-112.3
- [x] **T-112.5** Verifikasi end-to-end di browser + DB dev Supabase sungguhan (pola sama verifikasi T-090 addendum di atas) — "Sync Now" benar-benar menarik post nyata dari akun yang terhubung

**Update (2026-10-08) — T-112.1–T-112.4 selesai, T-112.5 belum (4/5
subtask):** Elon Backend Engineer mengimplementasikan wiring sungguhan
(`importPosts` + `fetchImportJobStatus`), dua panggilan HTTP diverifikasi
terhadap OpenAPI spec resmi Outstand (`POST /v1/social-accounts/{id}/
imports` dan `GET /v1/social-accounts/{id}/imports/{importId}` +
`GET /v1/posts` tambahan untuk data post). 1 putaran review Ridwan
Architecture Reviewer: menemukan **governance gap kritis** — kode sudah
menyebut "ADR-123" 7x di komentar/docstring tapi file ADR-nya belum pernah
dibuat (sudah dibuat, lihat `decisions/
ADR-123-wiring-import-posts-fetchimportjobstatus-outstandaccountid-partial-status-ki112.md`),
plus 2 temuan ringan yang sudah diperbaiki: sitasi OpenAPI untuk
`GET /v1/posts` LIST diperjelas (dicek langsung untuk endpoint LIST, bukan
diekstrapolasi dari endpoint singular), dan `console.warn` ditambahkan
untuk kasus silent-fail (`imported > 0` tapi tidak ada post yang berhasil
dipetakan dari `GET /v1/posts` — kemungkinan drift shape API, diperlakukan
sebagai 0 post, bukan error, tapi tidak boleh didiamkan tanpa jejak). QA
Najwa: tidak ada regresi (`git diff --stat` tidak menyentuh file UI apa
pun), `bun run test` 645 passed/6 skipped/0 failed. **T-112.5 belum
tuntas** — guard cooldown manual 24 jam (`MANUAL_COOLDOWN_MS`, ADR-093
poin 9) sudah terpakai oleh percobaan sync sebelumnya pada akun test
"Cook It Real Good" (cooldown sampai `2026-10-09T08:42:24Z`), dan sandbox
Najwa tidak bisa akses `.env.local`/MCP Supabase untuk verifikasi DB
langsung — gap verifikasi ini sudah terjadi 3x berturut-turut di sesi
berbeda (T-090 sebelumnya + 2 percobaan T-112 ini). Tidak ada bukti bug.
Saran untuk King Rezi: coba "Sync Now" lagi setelah cooldown berakhir
(`2026-10-09T08:42:24Z`) untuk menuntaskan T-112.5.

**Update (2026-10-09) — T-112.5 tuntas, T-112 `✅ Done` (5/5 subtask):**
King Rezi menemukan bug baru saat testing manual setelah cooldown berakhir —
"Sync Now" selalu berakhir gagal dengan status `pending`. Root cause: di
`ImportPostsTriggerUseCase.runImportSync` (`apps/web/src/domains/publishing/
services/import-posts-trigger.use-case.ts`), `fetchImportJobStatus` cuma
dipanggil **sekali** langsung setelah `importPosts()`, padahal job Outstand
betulan async (butuh waktu diproses) — status pertama yang didapat hampir
selalu `pending`/`queued`/`running`, langsung ditandai gagal. Bug ini murni
di lapisan use-case trigger, **bukan** di adapter/kontrak yang sudah
diverifikasi T-112.1–T-112.4 (tidak mengubah ADR-123).

Perbaikan Elon Backend Engineer (review Ridwan: array temuan kosong, tidak
ada pelanggaran arsitektur/bug blocking):

- Method privat baru `pollImportJobStatus` — polling `fetchImportJobStatus`
  tiap 2 detik sampai status resolve (`completed`/`failed`) atau timeout 25
  detik (margin dari budget 30 detik BG-D05 job runner).
- Timeout masih `pending` → pesan error baru yang membedakan "masih
  diproses, coba lagi nanti" dari kegagalan permanen.
- Parameter `sleep: SleepFn` opsional baru di constructor untuk injeksi
  test (default `setTimeout` asli) — composition root
  (`outstand-workspace-service.ts`) tidak perlu diubah.
- Guard cooldown 24 jam (`MANUAL_COOLDOWN_MS`) sempat dinonaktifkan
  sementara untuk kebutuhan testing berulang, lalu di-revert penuh —
  dikonfirmasi utuh 100% oleh Ridwan.
- 3 test baru untuk perilaku polling. Total test naik ke 648 passed/6
  skipped/0 failed.

Verifikasi end-to-end akhirnya berhasil di dev server + DB Supabase dev
nyata, user `rezi@insvire.com`, workspace "Lunch", akun Facebook "Cook It
Real Good" (`connectedAccountId=d17e38ce-fbae-434c-ab27-e417fca384ab`,
`outstandAccountId=Kav29`): klik "Sync Now" → tombol "Syncing..." selama
±20 detik (konsisten polling) → kembali normal, tidak langsung gagal.
Calendar menampilkan **16+ post asli** berstatus `Imported` (4 di Oktober +
12+ di September, rentang lookback 90 hari). Detail post diverifikasi:
caption lengkap dan masuk akal, badge "Imported" terpasang, platform
Facebook benar.

Satu observasi non-blocking (di luar scope T-112, tidak dibuatkan task/KI
baru): popover post menampilkan "Media belum tersedia untuk preview" —
`mediaUrls` sudah benar terisi di backend, tapi thumbnail-nya belum
di-render di UI Imported — terkait rancangan Claude Design yang menurut
catatan T-090.5 sebelumnya memang masih `blocked`. Disebutkan di sini
sebagai saran untuk King Rezi, bukan gap governance.

Review Ridwan juga mencatat satu catatan non-blocking terpisah: docstring
`pollImportJobStatus` menyebut status "partial" padahal nilai itu sudah
dipetakan jadi "completed" sebelum sampai ke use-case ini (ADR-123) — sedikit
stale tapi tidak memengaruhi kebenaran kode, tidak wajib diperbaiki.

**Update (2026-10-09) — hardening code-review PR #149 (branch `feature/t-112`
sebelum merge), status T-112 tetap `✅ Done`, bukan subtask baru:**
`/code-review` menemukan 3 temuan nyata (di luar 1 nit stale docstring yang
sudah dicatat di atas) yang tidak masuk putaran review Ridwan sebelumnya:

1. **(High)** `jobOutcome.error` untuk status real API `partial` (sudah
   dipetakan jadi `"completed"`, ADR-123) tidak pernah dibaca di
   `runImportSync` — job tercatat `"done"` polos, info "sebagian post gagal"
   hilang total (padahal tujuan desain ADR-123 eksplisit menyimpannya).
   Fix: `partialWarning` baru diteruskan ke `markImportSyncJobStatus(job.id,
"done", partialWarning)` (status job tetap `"done"`, bukan `"failed"` —
   post yang berhasil tetap berhasil) dan ke `ImportSyncTriggerResult.message`.
2. **(High)** Pesan error timeout-polling ("coba Sync Now lagi dalam
   beberapa menit") kontradiksi dengan guard `MANUAL_COOLDOWN_MS` (24 jam)
   yang sungguhan berlaku pada percobaan manual berikutnya (`lastImportRequestedAt`
   sudah diupdate SEBELUM polling dimulai) — pesan diperbaiki supaya tidak
   menjanjikan jendela retry yang salah.
3. **(Medium)** `GET /v1/posts` untuk mengambil data post job yang
   `completed`/`partial` sebelumnya HANYA difilter `social_account_id` +
   `limit` (tidak ada korelasi waktu ke job tertentu). Ditambahkan
   `created_after`/`created_before` dari `since`/`until` job (field
   diverifikasi ADA di `api.outstand.so/v1/posts/openapi.json`) untuk
   mempersempit risiko match post lain di akun yang sama di luar rentang
   job ini — didokumentasikan sebagai perbaikan best-effort, bukan filter
   sempurna (endpoint tidak punya filter `importJobId`).
4. **(Low)** Komentar test timeout-polling salah hitung jumlah panggilan
   (`"call ke-13"`); dihitung ulang (14 `fetchImportJobStatus`, 13 `sleep`)
   dan assertion diperketat dari `toBeGreaterThan(1)` ke angka pasti.

Test baru untuk temuan #1 (`partial` → `jobOutcome.error` tetap diteruskan ke
`markImportSyncJobStatus`/`result.message`). Test lama disesuaikan untuk
argumen ke-3 baru + query string `/v1/posts` baru. `typecheck`/`lint` PASS,
`bun run test` 649 passed/6 skipped/0 failed (naik dari 648). Scope diff
hanya 4 file kode (2 use-case + 1 test tiap-tiap): tidak menyentuh kontrak
publik (`packages/shared`), tidak ada ADR baru (perbaikan perilaku internal,
konsisten semangat ADR-123, bukan amandemen keputusannya).

### T-113 · Simpan `outstandPostId` untuk post hasil Import supaya comment-nya ikut ter-sync ke Engage Inbox

| Field         | Value                                                                                                                                                                                                                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done (4/4 subtask, 2026-10-15)                                                                                                                                                                                                                                                                                             |
| **Domain**    | integration                                                                                                                                                                                                                                                                                                                   |
| **ADR**       | — (bug fix, melengkapi desain yang sudah ada di ADR-093/ADR-113/ADR-123, bukan mengubah baseline)                                                                                                                                                                                                                             |
| **Terkait**   | KI-090, T-090, T-051 (`SyncCommentsUseCase`), T-112                                                                                                                                                                                                                                                                           |
| **Depends**   | — (seluruh plumbing Import Posts & comment sync sudah selesai; ini murni mengisi satu field yang hilang)                                                                                                                                                                                                                      |
| **Baca dulu** | `apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts` (`fetchImportJobStatus`, docstring `GET /v1/posts`) · `apps/web/src/lib/repositories/publishing/publishing.repository.ts` (`upsertImportedPosts`, `listSyncablePostsByConnectedAccount`) · `apps/web/src/domains/engagement/services/sync-comments.use-case.ts` |

Promosi dari **KI-090** (ditemukan King Rezi 2026-10-15). Comment pada post
hasil **Import Posts** (status `Imported`, T-090) tidak pernah masuk ke
Comments Inbox karena `PublishingPost.outstandPostId` tidak pernah diisi
untuk post Imported — sementara `listSyncablePostsByConnectedAccount`
(dipakai `SyncCommentsUseCase`, redesign per-post ADR-113) mensyaratkan
kolom itu `not: null`.

Dikonfirmasi **bukan** keterbatasan Outstand — dites langsung via MCP
Outstand: `GET /v1/posts/{id}/replies` berhasil untuk id internal Outstand
biasa, dan respons `GET /v1/posts` yang sama dipakai
`fetchImportJobStatus` saat import **sudah membawa `id` internal Outstand
itu juga** untuk setiap post yang di-discover (lihat docstring adapter
`real-outstand-adapter.ts` ~baris 1490–1500) — field ini saat ini hanya
tidak pernah dibaca/disimpan.

- [x] **T-113.1** Di `RealOutstandAdapter.fetchImportJobStatus`, tangkap
      `rawPost.id` (id internal Outstand) dari setiap item respons
      `GET /v1/posts` dan teruskan lewat `ImportedPostData` (field baru,
      mis. `outstandPostId`) — tanpa mengubah kontrak `platformPostId` yang
      sudah ada
- [x] **T-113.2** Di `upsertImportedPosts`
      (`publishing.repository.ts`), simpan nilai itu ke
      `PublishingPost.outstandPostId` saat membuat/update row post Imported
- [x] **T-113.3** Verifikasi end-to-end: jalankan Import Posts ke akun test
      nyata yang punya post dengan comment asli, pastikan job
      `SyncCommentsUseCase` berikutnya menarik comment-nya masuk ke
      `EngagementInboxItem`/Comments Inbox
- [x] **T-113.4** Cek regresi: post yang dibuat lewat flow publish biasa
      (bukan Import) tetap tidak terpengaruh — `outstandPostId` untuk jalur
      itu sudah diisi di tempat lain (`schedulePost`/`publishNow`), task ini
      tidak boleh menimpa/mengubah perilaku itu

**Implementasi (Elon Backend Engineer):** `rawPost.id` ditangkap di
`fetchImportJobStatus` dan diteruskan lewat `ImportedPostData.outstandPostId`
(`packages/shared/src/contracts/outstand-adapter.ts`) sampai tersimpan di
`PublishingPost.outstandPostId` lewat `upsertImportedPosts`. Kontrak
`platformPostId` tidak berubah. File baru
`apps/web/src/lib/repositories/publishing/upsert-imported-posts.ts` (logic
diekstrak dari `publishing.repository.ts`, pola sama `replace-draft-targets.ts`
supaya testable tanpa DB).

**Review Ridwan Architecture Reviewer (3 ronde) — 2 bug CONFIRMED ditemukan
dan diperbaiki sebelum merge, bukan sekadar lolos di percobaan pertama:**

1. **Ronde 1:** `upsertImportedPosts` membuat `PublishingPost` baru per akun
   tanpa cek `outstandPostId` yang sudah dipakai row lain — kalau satu post
   Outstand yang sama di-cross-post ke 2+ akun dalam satu workspace, insert
   kedua menabrak partial unique index global
   `publishing_posts_outstand_post_id_unique` (migration
   `20260907130000_t026_unique_outstand_post_id`), membatalkan SELURUH
   import akun itu (satu transaksi). **Fix:** guard SELECT-dulu-baru-INSERT
   — kalau `outstandPostId` sudah ada di workspace, attach
   `PublishingPostTarget` baru ke `PublishingPost` existing alih-alih buat
   baris baru.
2. **Ronde 2:** guard ronde 1 tidak atomik antar transaksi konkuren (mis. 2x
   klik "Sync Now" untuk 2 akun berbeda hampir bersamaan) — kedua transaksi
   bisa sama-sama lolos SELECT sebelum salah satu commit. **Fix:**
   `pg_advisory_xact_lock` di-scope `workspaceId` sebagai statement pertama
   `upsertImportedPostsTx`, meniru pola yang sudah ada di
   `engagement.repository.ts` (`upsertInboxItem`).
3. **Ronde 3:** bersih, tidak ada temuan baru — pola lock diverifikasi
   konsisten dengan preseden, tidak ada SQL injection (`$executeRaw`
   tagged-template), tidak menambah serialisasi baru di jalur cron
   (`triggerPeriodicForAccounts` sudah sekuensial). 7 test (4 + 3) dijalankan
   ulang sendiri oleh Ridwan, bukan percaya klaim — semua valid.

**Follow-up code review PR #169 (2026-10-15):** empat temuan diperbaiki di
branch yang sama, tanpa migrasi baru.

1. Webhook `post.published` / `post.error` untuk post Imported (`authorId`
   null) sekarang dikembalikan sebagai tidak ketemu (`skipped_no_match`),
   bukan error yang menandai receipt gagal.
2. Import ulang mengisi `outstandPostId` yang masih null. Id yang sudah
   terisi tidak ditimpa.
3. Kalau `outstandPostId` sudah dimiliki workspace lain, post tetap diimpor
   dengan `outstandPostId` null supaya batch tidak batal. Kepemilikan global
   dibaca lewat fungsi SECURITY DEFINER yang sudah ada (ADR-099), setelah
   advisory lock per id.
4. Akun yang sudah punya target pada post yang sama tidak dapat target
   kedua. Kalau `platformPostId` target itu masih null, nilainya diisi.

`bun run typecheck` bersih. `bun run test` 780 passed / 6 skipped
(naik dari 773; tes baru di `upsert-imported-posts.test.ts` dan
`find-post-targets-by-outstand-post-id.test.ts`).

`bun run typecheck`/`lint` bersih, `bun run test` 773 passed/6 skipped (naik
dari 766 baseline, 7 test baru untuk guard cross-post + lock).

**Verifikasi end-to-end (2026-10-15, dev server + DB Supabase dev + MCP
Outstand nyata, workspace "Lunch", akun Facebook "Cook It Real Good"):**
King Rezi menambahkan 1 comment real ("nicee recipee, i like it") ke sebuah
Reels yang di-post native di Facebook 12 Oktober 2026 (di luar jalur
aplikasi). Sync Now dijalankan lewat UI — post Reels itu masuk sebagai
`PublishingPost` baru status `Imported` dengan `outstandPostId` **terisi**
(`XlLwW`, sebelumnya field ini akan selalu `null`). Tombol "Refresh" di
Comments Inbox (`/engage`, `RefreshInboxUseCase` → `SyncCommentsUseCase`)
di-klik — comment-nya langsung muncul di `engagement_inbox_items`
(`external_id: "1742108387921088_1512756440658689"`, konten "nicee recipee,
i like it") dan tampil di UI Comments Inbox di bawah thread "Hash Brown in
Air Fryer". Rantai penuh Import → `outstandPostId` → `SyncCommentsUseCase` →
Comments Inbox terbukti bekerja di lingkungan nyata, bukan cuma unit test
mocked.

**Catatan non-blocking di luar scope T-113** (ditemukan saat verifikasi,
tidak diperbaiki di sesi ini): job Import Posts untuk akun Instagram sempat
gagal dengan error "Tidak ada job handler terdaftar untuk type
\"import.sync\"" — tidak berdampak ke hasil tes (akun itu memang tidak punya
konten native baru untuk di-import), kemungkinan isu runner job generik di
lingkungan dev, perlu diselidiki terpisah kalau relevan ke depan.

### T-114 · Backfill otomatis `outstandPostId` untuk post Imported lama saat Sync Now/periodik berjalan

| Field         | Value                                                                                                                                                                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done (5/5 subtask, 2026-10-15)                                                                                                                                                                                                                                                       |
| **Domain**    | integration                                                                                                                                                                                                                                                                             |
| **ADR**       | — (perluasan T-113, bukan perubahan baseline)                                                                                                                                                                                                                                           |
| **Terkait**   | T-113, KI-090, T-090, T-051                                                                                                                                                                                                                                                             |
| **Depends**   | T-113 ✅                                                                                                                                                                                                                                                                                |
| **Baca dulu** | `apps/web/src/domains/publishing/services/import-posts-trigger.use-case.ts` (`runImportSync`) · `apps/web/src/lib/repositories/publishing/upsert-imported-posts.ts` · `apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts` (`fetchImportJobStatus`, docstring `GET /v1/posts`) |

T-113 (2026-10-15) hanya memperbaiki `outstandPostId` untuk post Imported
**baru ke depan** — post Imported yang sudah ada SEBELUM fix itu tetap
`outstandPostId: null` selamanya, karena sync berikutnya hanya mengambil
rentang `since: lastImportedUntil` (watermark) sampai sekarang, tidak pernah
mengulang rentang lama. Dikonfirmasi lewat DB dev: dari 39 `PublishingPost`
status `Imported` di akun Facebook "Cook It Real Good", **36 masih
`outstandPostId: null`** — comment pada 36 post itu tidak akan pernah masuk
Comments Inbox tanpa backfill.

King Rezi memutuskan ini jadi **mekanisme permanen** (bukan script one-off):
setiap kali sync (manual atau periodik) berjalan untuk sebuah akun, kalau
akun itu masih punya `PublishingPost` status `Imported` dengan
`outstandPostId: null`, sync itu otomatis melakukan satu kali backfill
tambahan untuk menutup gap-nya — dengan cara menanyakan ulang
`GET /v1/posts` ke Outstand untuk seluruh riwayat akun itu (bukan cuma
window `since`/`until` biasa), mencocokkan hasilnya ke
`PublishingPostTarget.platformPostId` yang sudah ada, lalu mengisi
`PublishingPost.outstandPostId` yang masih kosong. Setelah satu kali
berhasil, tidak ada lagi baris yang kosong untuk akun itu — cek
existence-nya murah (satu query), jadi sync-sync berikutnya tidak kena
biaya API tambahan lagi.

- [x] **T-114.1** Tambah method baru (adapter dan/atau repository) untuk
      backfill: query existence `PublishingPost` status `Imported` +
      `outstandPostId IS NULL` untuk sebuah `connectedAccountId` (cheap
      check, dipanggil SETIAP sync) — kalau kosong, skip seluruhnya tanpa
      panggilan Outstand tambahan
- [x] **T-114.2** Kalau ada baris yang perlu backfill: panggil ulang
      `GET /v1/posts` (verifikasi dulu ke OpenAPI spec resmi Outstand apakah
      bisa query TANPA filter tanggal untuk seluruh riwayat akun, atau perlu
      `created_after` sangat lama — jangan asumsikan dari ADR-123, cek
      langsung) dengan pagination penuh (`limit`/`offset`) sampai semua post
      akun itu ter-cover, bangun map `platformPostId → rawPost.id`
- [x] **T-114.3** Cocokkan map itu ke baris `PublishingPost` yang
      `outstandPostId IS NULL` (lewat `PublishingPostTarget.platformPostId` + `connectedAccountId`), `UPDATE` kolom `outstandPostId` untuk baris
      yang cocok — pakai guard `pg_advisory_xact_lock` scoped `workspaceId`
      yang sama dengan T-113 kalau backfill ini jalan di transaksi terpisah
      dari import biasa (hindari race yang sama seperti ronde 2 review
      T-113)
- [x] **T-114.4** Wire ke `runImportSync` (`import-posts-trigger.use-case.ts`)
      — dipanggil SATU kali definisi, dipakai otomatis oleh `triggerManual`
      maupun `triggerPeriodicForAccounts` (keduanya sudah lewat
      `runImportSync` yang sama), bukan logic terpisah per jalur
- [x] **T-114.5** Verifikasi end-to-end di akun test nyata ("Cook It Real
      Good", 36 post Imported lama dengan `outstandPostId: null`): jalankan
      Sync Now sekali, pastikan ke-36 baris itu ter-backfill, lalu Refresh
      Comments Inbox dan pastikan comment pada post-post lama itu (kalau
      ada) ikut masuk

**Implementasi (Elon Backend Engineer):** method baru `fetchAllPostIdMappings`
di `IOutstandAdapter`/`RealOutstandAdapter` (paging penuh `GET /v1/posts`
tanpa filter tanggal — diverifikasi langsung ke OpenAPI spec resmi Outstand,
`created_after`/`created_before` TIDAK wajib). Logic inti
`backfillImportedPostOutstandIdsTx` di file baru
`apps/web/src/lib/repositories/publishing/backfill-outstand-post-ids.ts`
(pola sama `upsert-imported-posts.ts` T-113, testable tanpa DB). Guard
concurrency reuse **namespace lock identik** dengan `upsertImportedPostsTx`
(`pg_advisory_xact_lock(hashtext(workspaceId))`) supaya backfill (transaksi
terpisah) tidak race dengan Import biasa untuk workspace yang sama — plus
lapis kedua `WHERE outstandPostId: null` di tiap `UPDATE`. Dipanggil lewat
`BackfillOutstandPostIdsUseCase.backfillIfNeeded` dari `runImportSync`
(`attemptBackfill`, satu definisi dipakai otomatis oleh `triggerAuto`/
`triggerManual`/`triggerPeriodicForAccounts`) — **best-effort**: dibungkus
try/catch sendiri, gagal hanya `console.warn`, tidak pernah menimpa
`outcome`/`message` hasil sync utama, dan tetap jalan independen dari
sukses/gagalnya job import utama.

**Review Ridwan Architecture Reviewer — 0 temuan.** Diverifikasi independen
(bukan percaya klaim Elon): OpenAPI spec Outstand di-`curl` langsung
(`created_after`/`created_before` memang tidak `required`), key lock
dibandingkan baris-per-baris dengan T-113 (identik persis), wiring
best-effort dikonfirmasi lewat test eksplisit (adapter throw → sync utama
tetap `"triggered"`; backfill tetap jalan walau job import utama gagal).
Satu catatan **non-blocking**: constructor `backfillUseCase` opsional —
kalau composition root lain di masa depan lupa menyuplainya, backfill gagal
diam-diam tanpa warning (saat ini composition root satu-satunya,
`outstand-workspace-service.ts`, sudah benar menyuplainya). `bun run
typecheck`/`lint` bersih, `bun run test` 789 passed/6 skipped (naik dari
773 baseline T-113, 16 test baru).

**Verifikasi end-to-end (2026-10-15, dev server + DB Supabase dev nyata,
akun Facebook "Cook It Real Good"):** sebelum Sync Now, 36 dari 39
`PublishingPost` status `Imported` masih `outstandPostId: null`. Satu kali
klik "Sync Now" → **39/39 terisi** (`still_null: 0`). Refresh Comments Inbox
dijalankan — jumlah `engagement_inbox_items` tetap 1 (comment Reels dari
verifikasi T-113), **bukan bug**: dikonfirmasi langsung lewat MCP Outstand
bahwa 36 post lama itu memang tidak punya comment sungguhan di real life
(recipe page tanpa engagement). Mekanisme backfill + sync terbukti
menjangkau seluruh post, data-nya saja yang kosong.

---

### T-115 · Wiring cron harian Import Posts Trigger periodik (`triggerPeriodicForAccounts`) ke job runner produksi

| Field         | Value                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | 🟡 In Progress (4/5, sisa T-115.5)                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Domain**    | integration                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **ADR**       | — (menuntaskan desain yang SUDAH Accepted di ADR-093 poin 7, bukan keputusan baru)                                                                                                                                                                                                                                                                                                                                                       |
| **Terkait**   | T-090, T-048 (pola fan-out JOB-04 dijadikan referensi langsung), T-112, KI-088                                                                                                                                                                                                                                                                                                                                                           |
| **Depends**   | T-090 ✅, T-112 ✅ (plumbing Import Posts manual/auto sudah lengkap & terverifikasi; task ini murni menyambung jalur periodik yang sejak awal memang didesain tapi belum pernah di-wire)                                                                                                                                                                                                                                                 |
| **Baca dulu** | `apps/web/src/domains/publishing/services/import-posts-trigger.use-case.ts` (`triggerPeriodicForAccounts`, `runImportSync`) · `apps/web/src/domains/analytics/services/enqueue-analytics-sync.ts` (pola fan-out `executeIfDue` yang akan di-reuse) · `apps/web/src/app/api/jobs/run/route.ts` (composition root tempat handler didaftarkan) · `decisions/ADR-093-import-posts-dari-social-account-status-imported-read-only.md` (poin 7) |

Ditemukan King Rezi (2026-10-16) lewat diskusi "apakah post native Facebook
otomatis masuk Postific?" — jawaban **pada tanggal itu** adalah tidak.
Investigasi kode mengonfirmasi **gap yang sudah tercatat sejak T-090.3**:
ADR-093 poin 7 mendesain jalur periodik (Railway Cron harian) sebagai salah
satu dari 3 trigger Import Posts.
`ImportPostsTriggerUseCase.triggerPeriodicForAccounts` sudah
diimplementasikan penuh dan lolos unit test (T-090.3). Pada 2026-10-16 method
itu belum terdaftar di composition root job runner.
`apps/web/src/app/api/jobs/run/route.ts` saat itu hanya mendaftarkan 3
handler: `RESOLVE_SCHEDULED_POST_OUTCOME_JOB_TYPE`, `ENGAGEMENT_SYNC_JOB_TYPE`,
`ANALYTICS_SYNC_JOB_TYPE`. Catatan `PROJECT_STATE.md`/KI-088 pada periode yang
sama berbunyi _"Cron wiring asli tetap di luar scope (tidak berubah)"_.
Dampak pada 2026-10-16: satu-satunya cara post native masuk Postific adalah
klik manual "Sync Now" (dibatasi cooldown 24 jam/akun + cap 1x/minggu/workspace,
ADR-093 poin 9).

Paragraf di atas adalah keadaan **sebelum wiring**. T-115.1–T-115.4 kemudian
mendaftarkan handler `import.sync` ke route itu. Sisa yang masih terbuka ada
di T-115.5.

**Keputusan King Rezi (2026-10-16, lewat `AskQuestion`):** pilih opsi
paling rendah risiko — selesaikan wiring **harian** sesuai desain ADR-093
poin 7 apa adanya (bukan menaikkan frekuensi), reuse pola fan-out JOB-04
(`EnqueueAnalyticsSyncUseCase.executeIfDue()`) yang sudah terbukti jalan di
production. **Tidak perlu ADR baru** — ini murni menuntaskan keputusan yang
sudah Accepted, bukan mengubah desain. Opsi menaikkan frekuensi (per
beberapa jam) atau bypass Outstand lewat Meta Webhooks langsung
(ditolak untuk MVP — melanggar ADR-040, kompleksitas App Review Meta tidak
sepadan) dibahas di `CONVERSATIONS.md` entri 2026-10-16 tapi tidak dipilih.

- [x] **T-115.1** Buat `EnqueueImportSyncUseCase` (pola sama
      `EnqueueAnalyticsSyncUseCase`, `enqueue-analytics-sync.ts`) —
      `executeIfDue()` fan-out satu job `import.sync` per
      `WorkspaceConnectedAccount` berstatus `active` yang belum dapat job
      sejak awal hari UTC (reuse semantik `hasAccountJob`/`createdSince`,
      cukup port baru tipis, jangan duplikasi logic `startOfUtcDay`)
- [x] **T-115.2** Buat job type baru `IMPORT_SYNC_JOB_TYPE` (`import.sync`) + handler (pola sama `EngagementSyncJobHandler`/
      `AnalyticsSyncJobHandler`) yang memanggil
      `ImportPostsTriggerUseCase.runImportSync`/jalur periodik dengan
      `actingUserId` di-resolve per akun lewat `resolveVerifiedAccountOwner`
      (pola KI-088 yang sudah dipakai `triggerPeriodicForAccounts`) —
      **pastikan tidak menduplikasi** logic yang sudah ada di
      `triggerPeriodicForAccounts`, method itu kemungkinan besar bisa
      dipanggil langsung per akun dari handler baru ini alih-alih ditulis
      ulang
- [x] **T-115.3** Daftarkan `EnqueueImportSyncUseCase.executeIfDue()` +
      handler `import.sync` baru ke composition root
      `apps/web/src/app/api/jobs/run/route.ts` (pola identik blok
      `enqueueAnalyticsSync`/`ANALYTICS_SYNC_JOB_TYPE` yang sudah ada,
      termasuk opsi `?type=import` untuk trigger manual paksa ala
      `?type=analytics` — berguna untuk verifikasi staging)
- [x] **T-115.4** Cek regresi guard biaya existing (ADR-093 poin 9) — cap
      mingguan workspace dihitung dari `payload.trigger = "manual"` di
      `background_jobs`; pastikan job `trigger: "periodic"` baru ini TIDAK
      ikut kena guard yang ditujukan khusus jalur manual, dan sebaliknya
      guard concurrent-import per akun (ADR-093 poin 8, berlaku untuk semua
      sumber trigger) tetap menyala untuk jalur periodik ini juga
- [ ] **T-115.5** Verifikasi end-to-end nyata di staging: pastikan job
      harian benar-benar jalan tanpa aksi manual apa pun (pakai
      `?type=import` sekali untuk mempercepat verifikasi), `lastImportedUntil`/
      `lastImportRequestedAt` akun ter-update otomatis, dan post native baru
      yang ditambahkan langsung di Facebook muncul di Postific dalam
      waktu ≤24 jam tanpa klik "Sync Now"

**Catatan (2026-10-19) — T-115.5 belum lulus; job dan watermark sudah
terbukti:** percobaan pertama di staging gagal intermiten karena KI-091.
Perbaikan lock kemudian hidup di service `web` lewat PR 180 (`36248f7` lock
`$executeRaw`, `ae4770d` `runPendingJobs` kembali paralel, merge `f0e5393`).
Revisi yang berjalan di staging saat retest adalah `d7ef246`. Commit itu
memuat perbaikan lewat riwayatnya; pesannya sendiri milik T-121 dan T-008.
`?type=import` sekali mengklaim 2 job dan keduanya `done` pada percobaan
pertama. Watermark Facebook `Kav29` dan Instagram `eH82r` ter-update ke
`2026-10-19 07:49:04` UTC. Bukti job ada di T-124.

Sisa kriteria: satu post yang dibuat langsung di Facebook muncul di Postific
setelah job import, beserta ID post-nya. Watermark yang maju tetap terjadi
pada import yang selesai tanpa post baru. `?type=import` memanggil
`execute()` — jalur paksa yang tiket ini izinkan untuk mempercepat bukti
bahwa job jalan. Cron menit memanggil `executeIfDue()`.

---

## Read-Only Enforcement

### T-091 · Post `Published`/`Failed` jadi read-only (tidak bisa dibuka ke Draft Editor)

| Field         | Value                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done — T-091.1 selesai (2026-10-13), T-091.2 selesai (2026-10-13)                                                         |
| **Domain**    | publishing                                                                                                                   |
| **ADR**       | — (bug-fix, tidak mengubah baseline — ditemukan bersamaan sesi ADR-093 tapi sengaja ditrack terpisah, lihat ADR-093 Context) |
| **Depends**   | T-033.8 ✅ (Popover, tempat celah ini ditemukan)                                                                             |
| **Baca dulu** | `apps/web/src/app/(app)/publish/calendar/components/CalendarPostPopover.tsx`                                                 |

Ditemukan saat diskusi ADR-093 (2026-08-28): post berstatus `Published`/`Failed` — dikirim lewat tool kita sendiri, **bukan** hasil import — saat ini masih bisa dibuka ke Draft Editor lewat CTA "Buka Draft Editor" di Popover Calendar (`CalendarPostPopover.tsx:174-182`, tidak ada pengecualian status). Post yang sudah live di platform sosial seharusnya tidak bisa diedit lagi dari sini.

- [x] **T-091.1** Guard read-only di level repository/service — tolak aksi mutasi (`updateDraft`, `deletePost`, `cancelSchedule`, `scheduleUpdate`, dst.) untuk post berstatus `Published`/`Failed`, pola defense-in-depth sama ADR-059 poin 6 — **selesai 2026-10-13**
- [x] **T-091.2** UI: sembunyikan/nonaktifkan CTA "Buka Draft Editor" di `CalendarPostPopover.tsx` untuk status `Published`/`Failed` — **selesai 2026-10-13**, desain "Opsi B: Lihat Detail" dikunci King Rezi di Claude Design (`components/popover.html`)

**Catatan (2026-10-13) — T-091.1 selesai (Prabowo Feature Engineer, branch `feature/t-091-1-readonly-guard`):** guard di service/use-case menolak mutasi user (`updateDraft`, `deletePost`, `schedule`, `publishNow`, `cancelSchedule`) untuk status `Published`, `Failed`, dan `Imported` dengan `ConflictError` sebelum write. Helper: `apps/web/src/domains/publishing/readonly-terminal-status.ts`. Filter `where.status` di repository Prisma tetap sebagai jaring pengaman (ADR-059 poin 6, ADR-093 poin 1). Jalur sistem (retry Failed, webhook, mark published/failed) sengaja tidak di-guard. Review Ridwan Architecture Reviewer: 0 temuan blocking (catatan non-blocking: balapan status antara baca dan tulis bisa jatuh ke pesan NotFound/konflik generik; hanya `deletePost` yang mengecek ulang). QA Najwa QA Engineer: tes guard 127 lulus; `bun run test` 747 passed / 6 skipped / 0 failed; typecheck apps/web bersih. Browser tidak dijalankan karena tidak ada perubahan UI.

**Catatan (2026-10-13) — T-091.2 selesai, T-091 ditutup penuh (2/2 subtask):** desain dikunci King Rezi di Claude Design (`components/popover.html`) — dipilih **"Opsi B: Lihat Detail"** dari 3 opsi yang diajukan; dua kartu baru ditambahkan ke mockup, "Published (read-only, T-091)" dan "Failed (read-only, T-091)", masing-masing dengan komentar LOCKED PATTERN (T-091.2, 2026-10-13). Implementasi Mark UI Engineer di `CalendarPostPopover.tsx`: tombol "Buka Draft Editor" dihilangkan total (bukan disabled) untuk status `Published`/`Failed`, diganti kondisi baru `isTerminalReadonly` yang merender catatan teks (beda per status) + tombol secondary "Lihat Detail →" menuju halaman History Detail yang sudah ada (`/publish/history/[postId]`); metrics block + link "Go to post →" untuk Published tetap dipertahankan apa adanya; status `Imported` (T-090.5) dan default (Draft/Scheduled/dst.) tidak diubah sama sekali. Review Ridwan Architecture Reviewer: **0 temuan** — dikonfirmasi aman sengaja TIDAK reuse `isReadonlyTerminalStatus` dari domain `publishing` (barrel-nya membawa server-only exports, tidak aman diimpor ke komponen client); kondisi lokal `isTerminalReadonly` didefinisikan sendiri, pola sama `isPublished`/`isImported` yang sudah ada. QA Najwa QA Engineer: **PASS** — `typecheck`/`lint`/`test` bersih (747 passed, 6 skipped); golden path Published PASS penuh (verifikasi visual end-to-end dengan data riil, termasuk klik "Lihat Detail →" berhasil navigasi ke History Detail dengan data cocok); golden path Failed PASS via code review (struktur kode identik Published, hanya teks catatan beda via ternary) — **limitasi data pre-existing**: satu-satunya post berstatus Failed di DB dev tidak punya `scheduled_at`/`published_at` terisi sehingga tidak pernah muncul di Calendar (gap data lama, bukan bug T-091.2); regresi status lain aman (Imported dites live PASS, Scheduled/Draft dikonfirmasi lewat code review — cabang `else` sama sekali tidak tersentuh diff ini). **Temuan sampingan QA (bukan bug T-091.2):** tombol "Batalkan Jadwal" belum ada di popover Calendar untuk status Scheduled meski sudah ada di mockup `components/popover.html` (kartu "Scheduled" LOCKED PATTERN T-030.3) — ini murni gap **T-030.3** yang sudah ada sebelumnya dan sudah terdokumentasi jelas di § T-030/T-030.3 (bagian Calendar belum punya entry point Cancel Schedule), tidak perlu ADR/task baru.

---

## Realtime Collaboration

### T-092 · Realtime Calendar/Queue/Drafts/History via Supabase Realtime

| Field         | Value                                                                                                                                                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done                                                                                                                                                                                                                            |
| **Domain**    | publishing                                                                                                                                                                                                                         |
| **ADR**       | ADR-094 (amandemen RT-D01/RT-D02)                                                                                                                                                                                                  |
| **Depends**   | **T-036** (hard dependency — wiring generic Supabase Realtime + Better Auth↔Supabase JWT bridge dibangun di sana dulu, task ini reuse) · T-034 (khusus T-092.6, History belum dibangun)                                            |
| **Baca dulu** | `05-architecture/realtime-strategy.md` · `05-architecture/database-strategy.md` (RLS Policy Pattern) · `05-architecture/auth-architecture.md` · `decisions/ADR-094-perluasan-supabase-realtime-publishing-posts-granular-patch.md` |

Lahir dari diskusi King Rezi soal kolaborasi tim ala Buffer (user A ubah draft/schedule, user B lihat langsung tanpa refresh manual) — dirancang terpisah dari fitur Import Posts (T-090/T-091, ADR-093). Channel per-workspace (`publishing_posts:{workspaceId}`, event `INSERT`/`UPDATE`, filter `workspace_id`), strategi update **granular client-side patch** (bukan full `router.refresh()`) — lihat ADR-094 untuk detail lengkap tiap keputusan.

- [x] **T-092.1** ✅ Done — RLS policy baru `publishing_posts_realtime_workspace_members` (migration Prisma) — terpisah dari policy server-side `current_setting` yang sudah ada (ADR-094 poin 3)
- [x] **T-092.2** ✅ Done — Wiring subscription channel per-workspace (`publishing_posts:{workspaceId}`, `INSERT`/`UPDATE`, filter `workspace_id`) — reuse Supabase Realtime client generic + JWT bridge dari T-036, jangan dibangun ulang (ADR-094 poin 2, 4)
- [x] **T-092.3** ✅ Done — Granular patch — Calendar: client state list per screen, fetch 1 record termapping saat event masuk, upsert/remove ke local state, subscription lifecycle per-mount screen (ADR-094 poin 5, 6)
- [x] **T-092.4** ✅ Done — Granular patch — Queue (pola sama T-092.3, kriteria tampilan Queue: cuma status `Scheduled`)
- [x] **T-092.5** ✅ Done — Granular patch — Drafts (pola sama T-092.3, kriteria tampilan Drafts: `Draft`/`InReview`/`ReadyToSchedule`) — **Definition of Done wajib menyertakan verifikasi cross-tab browser nyata (2 tab, tanpa refresh manual) — lihat KI-057**, kriteria lama (typecheck/lint bersih + tanpa console error + channel `SUBSCRIBED`) tidak lagi cukup untuk menutup subtask ini. **Catatan (2026-09-11):** saat implementasi ditemukan `PublishingService.listDrafts` (initial SSR load) hanya query status `Draft`, tidak konsisten dengan kriteria 3 status di atas — gap ini ditrack terpisah sebagai **T-104**, dikerjakan paralel (sudah selesai, lihat § T-104 di bawah).
- [x] **T-092.6** ✅ Done — Granular patch — History (pola sama T-092.3) — **depends T-034**, wajib disertakan sejak desain awal History, bukan ditambah belakangan (ADR-094 poin 7) — **Definition of Done wajib menyertakan verifikasi cross-tab browser nyata (2 tab, tanpa refresh manual) — lihat KI-057**, kriteria lama (typecheck/lint bersih + tanpa console error + channel `SUBSCRIBED`) tidak lagi cukup untuk menutup subtask ini

**Catatan (2026-09-11) — T-092.1 selesai:** migration
`apps/web/prisma/migrations/20260911090000_t092_1_publishing_posts_realtime_rls/migration.sql`
membuat policy `publishing_posts_realtime_workspace_members` (Elon Backend
Engineer). Implementasi memakai `current_setting('request.jwt.claim.sub',
true)` (dengan fallback parse `request.jwt.claims`), **bukan** `auth.uid()`
Supabase langsung — `auth.uid()` cast paksa `::uuid` terhadap klaim `sub`,
sementara `user_id` di sistem ini bertipe `cuid()` string (persis bug yang
sudah diperbaiki di T-036.2, lihat catatan di atas). T-092.1 menerapkan
versi yang sudah diperbaiki sejak awal, tidak perlu migration fix susulan.
Detail: ADR-094 poin 3 (catatan implementasi 2026-09-11),
`database-strategy.md` § RLS Policy Pattern. T-092 tetap `🟡 In Progress` —
4 subtask (T-092.3–T-092.6) belum dikerjakan.

**Catatan (2026-09-11) — T-092.2 selesai:** Prabowo Feature Engineer
membuat `apps/web/src/lib/supabase/realtime/publishing-posts.ts`
(`subscribeToPublishingPostChanges(client, workspaceId, handlers)`) dan
`apps/web/src/lib/hooks/use-publishing-posts-realtime.ts` (hook
`usePublishingPostsRealtime(workspaceId, { onInsert, onUpdate })`) —
wiring subscription channel per-workspace `publishing_posts:{workspaceId}`
untuk event `INSERT`/`UPDATE`, reuse Supabase Realtime client generic +
JWT bridge dari T-036 (tidak dibangun ulang). Verifikasi: typecheck
bersih, lint bersih, 311 test passed/5 skipped. Review arsitektur oleh
Ridwan Architecture Reviewer: **tidak ada temuan pelanggaran** (5/5
checklist arsitektur patuh) — hanya 1 catatan DRY minor (dua tipe handler
shape identik didefinisikan dua kali: `PublishingPostRealtimeHandlers` di
file pertama dan `UsePublishingPostsRealtimeHandlers` di file kedua),
bukan blocker, tidak wajib diperbaiki sekarang. T-092 tetap `🟡 In
Progress` — 4 subtask (T-092.3–T-092.6) belum dikerjakan.

**Catatan retroaktif (2026-09-11, ditulis saat T-092.4 selesai):**
verifikasi "typecheck bersih, lint bersih, tidak ada console error" di atas
**bukan** verifikasi propagasi Realtime cross-tab nyata (2 tab browser
berbeda) — waktu itu belum pernah dites end-to-end sampai T-092.4. Wiring
subscription di sini ternyata terpengaruh bug RLS `workspace_members` yang
baru ditemukan & diperbaiki di T-092.4 (lihat catatan T-092.4 di bawah) —
channel `SUBSCRIBED` tanpa error, tapi event tidak pernah sampai ke
subscriber manapun. Fix-nya di level RLS database, bukan di kode wiring
T-092.2 ini, jadi tidak ada perubahan file di sini.

**Catatan (2026-09-11) — T-092.3 selesai:** Prabowo Feature Engineer
menambahkan Server Action `getCalendarPostAction`
(`apps/web/src/app/(app)/publish/calendar/actions.ts`),
`PublishingService.getCalendarPostById` baru (domain/services) +
`IPublishingRepository.getCalendarPostById` beserta implementasi Prisma-nya
(`apps/web/src/lib/repositories/publishing/`). `CalendarScreen.tsx` jadi
Client Component: subscribe `usePublishingPostsRealtime` (dari T-092.2),
lalu melakukan granular patch (upsert/remove) ke state lokal berdasarkan
kecocokan dengan view/filter aktif (`matchesCurrentView`, reuse fungsi
domain murni `getWeekRange`/`getMonthRange`). `page.tsx` menambah prop
`statuses`/`workspaceId`. Test baru di `publishing.service.test.ts` (4
test) + 6 file test use-case lain disesuaikan (tambah default
`getCalendarPostById` di fake repository, murni type-fix, tanpa perubahan
behavior). Diverifikasi: typecheck bersih, lint bersih, 315 test passed
(naik dari 311), browser preview manual (Calendar render normal, endpoint
token Realtime sukses, tanpa console error). Review arsitektur Ridwan
Architecture Reviewer: **tidak ada temuan pelanggaran** (server action
tetap tipis, domain tidak mengimpor Prisma/Supabase, cross-domain lewat
public API, error/null handling konsisten dan graceful, tidak ada regresi
behavior use-case lain). T-092 tetap `🟡 In Progress` — 3 subtask
(T-092.4–T-092.6) belum dikerjakan.

**Catatan retroaktif (2026-09-11, ditulis saat T-092.4 selesai):** sama
seperti T-092.2 di atas — "browser preview manual" di sini juga belum
mencakup pengujian cross-tab nyata (2 tab berbeda, tanpa refresh). Calendar
(bagian ini) terkena bug RLS `workspace_members` yang sama seperti Queue
(lihat catatan T-092.4 di bawah); propagasi Realtime untuk Calendar baru
**dikonfirmasi PASS** setelah fix RLS diterapkan — belum ada bug tersisa di
kode granular patch Calendar sendiri, murni terhalang gap infra di
database yang baru ketahuan belakangan.

**Catatan (2026-09-11) — T-092.4 selesai (Queue) + insiden & fix RLS
`workspace_members`:** rangkaian ini lebih panjang dari subtask lain
karena ditemukan bug infra kritis di tengah jalan, bukan sekadar
implementasi linier.

1. **Implementasi (Prabowo Feature Engineer):** Server Action
   `getQueuePostAction` (`apps/web/src/app/(app)/publish/queue/actions.ts`,
   reuse `PublishingService.getCalendarPostById` dari T-092.3 — **tidak**
   duplikasi method baru), wiring `usePublishingPostsRealtime` di
   `QueueScreen.tsx` (`apps/web/src/app/(app)/publish/queue/components/QueueScreen.tsx`)
   dengan kriteria tampilan Queue (hanya status `Scheduled`) via fungsi
   `toQueueItemRecord`, regroup lewat `groupQueueItemsByDate`. `page.tsx`
   disesuaikan untuk prop tambahan.
2. **Bug ditemukan saat verifikasi manual cross-tab (Prabowo):**
   propagasi Realtime lintas-tab **tidak bekerja** — channel `SUBSCRIBED`
   tanpa error di console, tapi event tidak pernah sampai ke subscriber
   manapun. Gejala ini kemungkinan sudah ada sejak T-092.2/T-092.3 (lihat
   catatan retroaktif masing-masing di atas) — keduanya cuma pernah
   diverifikasi "token sukses + tanpa console error", belum pernah dites
   cross-tab nyata sampai titik ini.
3. **Root cause (Elon Backend Engineer):** RLS policy
   `publishing_posts_realtime_workspace_members` (dibuat T-092.1) melakukan
   subquery ke tabel `workspace_members` untuk cek membership. Tapi RLS
   `workspace_members` yang sudah ada sebelumnya
   (`workspace_members_workspace_isolation`, dari sebelum T-092) hanya
   mengenali GUC session server-side `current_setting('app.current_user_id')`
   — koneksi Realtime tidak pernah lewat jalur itu (cuma bawa JWT), jadi
   `app.current_user_id` selalu kosong untuk koneksi Realtime,
   `workspace_members` jadi tidak terlihat sama sekali oleh subquery
   tersebut, dan policy `publishing_posts` selalu mengembalikan `false`.
   Ini gap arsitektur RLS lintas-tabel yang tidak tersentuh preseden T-036
   (policy `notifications` cek `user_id` langsung di baris `notifications`
   itu sendiri, tanpa subquery ke tabel lain).
4. **Fix:** migration baru
   `apps/web/prisma/migrations/20260911100000_t092_4_fix_workspace_members_realtime_visibility/migration.sql`
   — menambah policy PERMISSIVE tambahan `workspace_members_realtime_own_row`
   di tabel `workspace_members` (user hanya bisa lihat baris membership-nya
   sendiri lewat JWT, **additive**, tidak mengganti/menghapus policy lama).
   Sudah di-apply ke database (`bunx prisma migrate deploy`, sukses,
   dijalankan langsung oleh AI utama atas izin eksplisit King Rezi).
   Detail keputusan dicatat sebagai catatan implementasi tambahan di
   **ADR-094** poin 3 (bukan ADR baru — pola sama persis dengan catatan
   fix `auth.uid()`/cuid T-092.1 di ADR yang sama).
5. **Verifikasi database (Elon):** simulasi query dengan role `authenticated`
   (bukan role bypass-RLS) di dalam transaksi ROLLBACK — user member
   workspace dapat 27 baris `publishing_posts` (cocok total post workspace
   itu), negative control dengan user id palsu dapat 0 baris. Root cause
   teratasi di level database.
6. **Verifikasi end-to-end nyata di browser (Najwa QA Engineer):** 2 tab
   (Calendar + Queue), Cancel Schedule dilakukan di tab Queue, tanpa
   refresh tab Calendar langsung update (item hilang dari slot terjadwal)
   — **PASS**, data dikonfirmasi benar-benar berubah ke status `Draft`.
   Typecheck/lint bersih, 315 test passed/5 skipped, tidak ada regresi.
   Arah sebaliknya (Calendar → Queue) belum sempat dites tuntas karena
   kendala teknis otomasi test (bukan bug fitur) — dicatat sebagai item
   follow-up opsional, bukan blocker.

T-092 tetap `🟡 In Progress` — 2 subtask (T-092.5–T-092.6) belum
dikerjakan.

**Catatan lanjutan (2026-09-11) — migration follow-up defense-in-depth
(masih bagian T-092.4, BUKAN T-092.5):** Elon Backend Engineer menambahkan
migration
`apps/web/prisma/migrations/20260911110000_t092_5_workspace_members_realtime_own_row_active_filter/migration.sql`
— menambah filter `AND status = 'active'` ke policy
`workspace_members_realtime_own_row` (dibuat poin 4 di atas), mengikuti pola
filter serupa yang sudah dipakai konsumer lain
(`publishing_posts_realtime_workspace_members`). Sifatnya defense-in-depth
(tidak ada gap yang bisa dieksploitasi sebelumnya — member non-`active`
tetap tidak lolos policy `publishing_posts` di layer atasnya), tidak ada
regresi. Sudah di-apply ke database (`bunx prisma migrate deploy`) dan
diverifikasi.

**Catatan penamaan (koreksi, jangan bingung dengan T-092.5):** nama file
migration di atas salah ketik jadi `t092_5` — migration ini adalah
**follow-up dari T-092.4** (Queue + fix RLS `workspace_members`), **bukan**
bagian dari **T-092.5** (Drafts, yang belum dikerjakan sama sekali). Nama
file sengaja tidak diganti (mengubah nama file migration yang sudah
`prisma migrate deploy` berisiko mismatch checksum) — dicatat di sini
sebagai penanda eksplisit untuk siapa pun yang cek folder migration ke depan
supaya tidak salah asumsi ada kaitan dengan Drafts.

**Gap metodologi verifikasi Realtime (KI-057, direkomendasikan Ridwan
Architecture Reviewer, disetujui King Rezi):** rangkaian insiden T-092.1–
T-092.4 di atas mengungkap bahwa kriteria "typecheck bersih + lint bersih +
tanpa console error + channel `SUBSCRIBED`" **tidak cukup** membuktikan
event Realtime benar-benar terkirim ke subscriber — lihat **KI-057** di
`PROJECT_STATE.md` § Known Issues untuk kronologi lengkap. **T-092.5** dan
**T-092.6** di atas sudah diberi catatan Definition of Done tambahan
(verifikasi cross-tab browser nyata wajib) sebagai tindak lanjut langsung
dari KI-057.

**Catatan (2026-09-11) — T-092.5 selesai (Drafts):** Prabowo Feature
Engineer menambahkan Server Action `getDraftPostAction` (reuse
`PublishingService.getCalendarPostById` dari T-092.3, **tidak** duplikasi
method baru), `DraftsList.tsx` diubah jadi client state yang subscribe
`usePublishingPostsRealtime` (dari T-092.2), filter kriteria tampilan
Drafts (3 status: `Draft`/`InReview`/`ReadyToSchedule`) via fungsi
`toDraftListItem`. Field `updatedAt` ditambahkan ke `CalendarItemRecord`
(perubahan additive, tidak mengubah kontrak existing). **Verifikasi
cross-tab browser nyata wajib (KI-057) — PASS untuk kedua skenario:**
edit caption draft di tab 1 → tab 2 ter-update otomatis tanpa refresh;
hapus draft di tab 1 → baris hilang otomatis di tab 2. Review Ridwan
Architecture Reviewer: **tidak ada temuan pelanggaran arsitektur**
(domain tetap tidak mengimpor Prisma/Supabase, server action tipis,
cross-domain lewat public API) — Ridwan mengonfirmasi klaim PASS di atas
masuk akal secara teknis dari membaca alur kode, didukung fix RLS
`workspace_members` yang sudah diterapkan lebih dulu di T-092.4.
Typecheck/lint bersih, 315 test passed/5 skipped, tidak ada regresi.
T-092 tetap `🟡 In Progress` — 1 subtask tersisa (**T-092.6**, History,
depends T-034).

**Catatan (2026-09-11) — T-092.6 selesai (History) — T-092 TUNTAS 6/6
subtask:** Prabowo Feature Engineer menambahkan method baru
`getHistoryPostById` (interface `IPublishingRepository` + implementasi
Prisma + `PublishingService`) — **dibuat baru, bukan reuse
`getCalendarPostById`**, karena History butuh field `status`/`error`
per-target yang tidak ada di proyeksi Calendar. Server Action
`getHistoryPostAction`, `HistoryList.tsx` diubah jadi stateful dengan
`usePublishingPostsRealtime` (dari T-092.2), grouping
(`groupHistoryItemsByDate`) dipindah ke client. **Verifikasi cross-tab
browser nyata wajib (KI-057) — PASS:** Publish Now di tab 1 (Drafts) → tab
2 (History) otomatis menampilkan post baru dengan badge "Published" tanpa
refresh. Review Ridwan Architecture Reviewer: **0 pelanggaran
arsitektur** — keputusan membuat method baru (bukan reuse) diverifikasi
benar dan berdasar bukti kode konkret; klaim verifikasi cross-tab
dikonfirmasi masuk akal secara teknis dari alur kode. Typecheck/lint
bersih, 315 test passed/5 skipped, tidak ada regresi. Catatan minor
Ridwan (bukan blocker): tidak ada unit test spesifik untuk
`getHistoryPostById` (cuma stub fake repository) — observasi coverage,
bukan gap fungsional.

**Temuan terpisah di luar scope T-092.6 (tidak dibuatkan task baru):**
bug pre-existing "Publish Now di Queue selalu gagal untuk post Scheduled"
ditemukan saat sesi ini — sudah dicatat sebagai chip task terpisah
menunggu King Rezi pick up, bukan bagian T-092/ADR-094.

**T-092 dinyatakan `✅ Done` (2026-09-11) — seluruh 6/6 subtask tuntas**
(T-092.1 RLS policy, T-092.2 wiring subscription, T-092.3 Calendar,
T-092.4 Queue + fix RLS `workspace_members`, T-092.5 Drafts, T-092.6
History). Definition of Done tambahan dari **KI-057** (verifikasi
cross-tab browser nyata) sudah terpenuhi untuk seluruh subtask yang
menjadi syaratnya (T-092.3–T-092.6) — **KI-057 Resolved**, lihat
`PROJECT_STATE.md`.

### T-104 · Konsistensi kriteria status Drafts — `listDrafts` vs granular patch Realtime

| Field         | Value                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done                                                                                                                      |
| **Domain**    | publishing                                                                                                                   |
| **ADR**       | ADR-094 (kriteria tampilan Drafts)                                                                                           |
| **Terkait**   | T-092.5 (granular patch Realtime — Drafts, tempat gap ini ditemukan)                                                         |
| **Depends**   | —                                                                                                                            |
| **Baca dulu** | `decisions/ADR-094-perluasan-supabase-realtime-publishing-posts-granular-patch.md` · `tickets/v02-publishing-mvp.md` § T-092 |

Ditemukan saat implementasi **T-092.5** (granular patch Realtime — Drafts)
oleh Prabowo Feature Engineer: `PublishingService.listDrafts` (dipakai
untuk initial SSR load halaman `/publish/drafts`) hanya query post
berstatus `Draft`. Padahal kriteria tampilan Drafts sesuai **ADR-094**
(dan yang sudah diterapkan di granular patch Realtime T-092.5) mencakup
**3 status**: `Draft`, `InReview`, `ReadyToSchedule`.

Saat ini tidak berdampak nyata karena belum ada fitur yang mentransisi
post ke status `InReview`/`ReadyToSchedule` (review-workflow belum
dibangun) — tapi initial load dan hasil patch Realtime punya kriteria
yang tidak konsisten, berpotensi jadi bug nyata begitu review-workflow
dibangun. King Rezi memutuskan diperbaiki sekarang juga, bukan sekadar
dicatat sebagai known gap.

- [x] **T-104.1** ✅ Done — Perbaiki `PublishingService.listDrafts` supaya query mencakup ketiga status (`Draft`/`InReview`/`ReadyToSchedule`), pastikan konsisten dengan kriteria granular patch Realtime yang sudah ada di `DraftsList.tsx` (T-092.5)

**Catatan (2026-09-11) — T-104 selesai:** Prabowo Feature Engineer
mengubah `PublishingService.listDrafts` dari filter status tunggal
(`Draft`) jadi 3 status (`Draft`/`InReview`/`ReadyToSchedule`), sekarang
konsisten dengan `DRAFT_VIEW_STATUSES` di client (`DraftsList.tsx`,
T-092.5). Review Ridwan Architecture Reviewer: **tidak ada temuan
pelanggaran** — Ridwan mengonfirmasi filter backend dan client sekarang
identik (bukan cuma mirip).

**Gap baru ditemukan selama implementasi (bukan subtask baru, dicatat di
sini):** tombol Hapus di layar Drafts tetap muncul tanpa syarat untuk
status `InReview`/`ReadyToSchedule`, padahal `deletePost` hanya
mengizinkan status `Draft` — berpotensi menghasilkan pesan error
menyesatkan ("Cancel Schedule dulu"), padahal kedua status itu tidak
pernah melalui alur schedule. Ridwan mengonfirmasi ini technical debt
valid, bukan false alarm. Termasuk di gap ini: komentar di
`DraftsList.tsx:94-98` yang menyatakan "baris di sini selalu Draft" sudah
tidak akurat pasca perubahan T-104 ini, perlu diperbaiki bersamaan nanti.
Sudah dicatat sebagai chip task terpisah oleh Prabowo Feature Engineer
(`task_6b93cfb5`) — menunggu King Rezi memilihnya sendiri, tidak dibuatkan
task/subtask formal baru di sini.

### T-106 · Hapus `FakeOutstandAdapter` dari jalur produksi

| Field         | Value                                                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**    | ✅ Done (2026-09-25) — T-106.5 menutup sisa data Fake/mock                                                                                                                                                                                       |
| **Domain**    | integration                                                                                                                                                                                                                                      |
| **ADR**       | ADR-119 (amandemen ADR-059)                                                                                                                                                                                                                      |
| **Terkait**   | T-025 ✅ (real adapter sudah ada) · T-028 (factory + Fake awal)                                                                                                                                                                                  |
| **Depends**   | T-025 ✅ · `OUTSTAND_API_KEY` terisi di setiap proses yang menjalankan app (lokal, Railway staging, cron)                                                                                                                                        |
| **Baca dulu** | `decisions/ADR-119-hapus-fake-outstand-adapter-wajib-api-key.md` · `decisions/ADR-059-fake-outstandadapter-persistensi-nyata-schedule-tanpa-kredensial-outstand-asli.md` · `apps/web/src/lib/adapters/outstand/index.ts` · `AGENTS.md` aturan 19 |

King Rezi meminta (2026-09-25) `FakeOutstandAdapter` dihilangkan dari jalur
produksi. Sebelumnya `getOutstandAdapter()` fallback ke Fake saat
`OUTSTAND_API_KEY` kosong (ADR-059); Real adapter (T-025) berdiri di
sampingnya tanpa menggantikannya.

**Implementasi (2026-09-25, commit `0ce9371`):** ADR-119 Accepted + ADR-059
diamendemen. Factory `getOutstandAdapter()` hanya mengembalikan
`RealOutstandAdapter`; key kosong/whitespace → throw jelas (sebut nama env
var). File `fake-outstand-adapter.ts` dihapus dari jalur produksi. Tes unit
memakai double lokal di file tes (bukan singleton Fake). Rule 19 `AGENTS.md`

- `ctx-development.md` diselaraskan. Data cleanup di DB bersama
  (`ndcrkzqgqukqfmekgoze`): 24 `publishing_posts` ber-`outstand_post_id`
  `fake-post-%` (+ targets cascade) dihapus; verifikasi 0 remaining
  `fake-post-%` / `fake.outstand.local`. Sisa yang tidak kena filter itu
  (channel + post tanpa id `fake-post-`) dilacak di **T-106.5**. Ridwan
  Architecture Reviewer: LOLOS, 0 temuan. Najwa QA: Vitest PASS — 17 file /
  283 tes.

* [x] **T-106.1** ✅ Done — ADR-119: jalur produksi wajib `OUTSTAND_API_KEY`; key kosong throw jelas, bukan fallback ke Fake. Amendemen ADR-059.
* [x] **T-106.2** ✅ Done — Hapus `fake-outstand-adapter.ts` dari factory `getOutstandAdapter()` dan dari jalur produksi.
* [x] **T-106.3** ✅ Done — Double lokal di tes tetap; aturan 19 `AGENTS.md` + `ctx-development.md` diselaraskan (jangan Fake di jalur produksi).
* [x] **T-106.4** ✅ Done — Bersihkan 24 baris dev `fake-post-…` (+ targets cascade) di DB bersama; verifikasi 0 remaining `fake-post-%` / `fake.outstand.local`.
* [x] **T-106.5** ✅ Done — Hapus 23 `workspace_connected_accounts` (`fake-%` / `mock-%`) dan 9 `publishing_posts` yang menempel (target cascade). Inbox 13 dan urutan channel 2 ikut terhapus lewat cascade. Verifikasi: 0 akun, 0 target, 0 inbox. 19 draft tanpa channel tidak masuk cakupan (tidak menempel ke akun Fake/mock).

---

## Post Outcome & Schedule Fixes

### T-107 · Isi `PublishingPost.publishedAt`/`failedAt`/`failureReason` di jalur mark outcome

| Field         | Value                                                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done (2026-09-28)                                                                                                                                                                           |
| **Domain**    | publishing                                                                                                                                                                                     |
| **ADR**       | —                                                                                                                                                                                              |
| **Depends**   | T-027 ✅, T-029 ✅, T-034 ✅                                                                                                                                                                   |
| **Baca dulu** | `05-architecture/domain-model.md` · `apps/web/src/domains/publishing/repositories/publishing.repository.ts` (`markPostPublished`/`markPostFailed`)                                             |
| **Ditemukan** | KI-049 (2026-09-08, Ridwan Architecture Reviewer, review T-034.1) + KI-063 (2026-09-17, Najwa QA Engineer, verifikasi T-027) — digabung satu task karena root cause & lokasi kode sama persis. |

**Gap:** kolom `publishedAt`/`failedAt`/`failureReason` ada di schema Prisma `PublishingPost` tapi tidak pernah ditulis — `markPostPublished` hanya meng-update `status`, begitu juga `markPostFailed`. UI History punya fallback (`item.publishedAt ?? item.updatedAt`) jadi tidak berdampak visual sekarang, tapi data historis kosong permanen untuk seluruh post yang sudah tayang/gagal. Pesan error final per akun tetap ada lewat `HistoryItemTargetRecord.error` (KI-049 catat ini sebagai sumber data yang benar untuk sekarang) — task ini tidak mengubah itu, hanya mengisi field level-post yang selama ini kosong.

**Implementasi (selesai, 2026-09-28):** signature `markPostFailed` berubah
(tambah param `reason: string`); implementasi Prisma sekarang set
`publishedAt`/`failedAt`/`failureReason`. 3 call-site
(`schedule-posts.use-case.ts`, `publish-now.use-case.ts`,
`outstand-webhook-processor.ts`) menyediakan `reason` dari
`PostTargetOutcome.error` unik per target (join `"; "`, fallback teks
generik). Ridwan Architecture Reviewer: **0 temuan**. Najwa QA Engineer:
verifikasi code-trace + schema (tidak ada jalur publish/fail nyata
tersedia di data dev untuk uji end-to-end browser — dicatat sebagai
keterbatasan, bukan kegagalan). Full suite **593 passed/6 skipped**.

**Gap baru ditemukan (di luar scope, tidak diperbaiki di sini):**
**KI-081** (`PROJECT_STATE.md`) — `PublishNowUseCase` (T-029) bisa
membuat post `Failed` dengan `publishedAt` terisi keliru, karena
`publishedAt` diisi di muka sebelum outcome per-target diketahui dan tidak
di-null-kan saat `markPostFailed` mengoreksi `status`. Bug pre-existing,
independen dari T-107.

- [x] **T-107.1** `markPostPublished` mengisi `publishedAt` (bukan hanya `status`)
- [x] **T-107.2** `markPostFailed` mengisi `failedAt` + `failureReason` (bukan hanya `status`)
- [x] **T-107.3** Verifikasi UI History (`HistoryList`/`HistoryDetail`) tidak regresi — fallback `item.publishedAt ?? item.updatedAt` yang sudah ada harus tetap benar setelah field asli terisi

### T-108 · Validasi Schedule tidak boleh ke waktu yang sudah lewat pada tanggal hari ini

| Field         | Value                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done (2026-09-28)                                                                                                |
| **Domain**    | publishing · UI                                                                                                     |
| **ADR**       | —                                                                                                                   |
| **Depends**   | T-100 ✅ (Draft Editor `Modal.tsx` saat ini)                                                                        |
| **Baca dulu** | `apps/web/src/app/(app)/components/draft-editor/Modal.tsx` (step Schedule)                                          |
| **Ditemukan** | KI-044 (2026-09-03, Najwa QA Engineer, verifikasi T-100.3) — sudah ada sejak sebelum migrasi shadcn, bukan regresi. |

**Gap:** tidak ada validasi yang mencegah user men-Schedule post ke waktu yang sudah lewat pada tanggal hari ini (mis. jadwalkan jam 08:00 padahal sekarang sudah jam 11:48) — post berhasil masuk Queue tanpa penolakan/warning apa pun.

**Implementasi (selesai, 2026-09-28):** modul domain baru
`schedule-time-constraints.ts` (pola sama
`pinterest-board-constraints.ts`), dipanggil dari client (`Modal.tsx`,
reuse `Alert variant="destructive"`) dan server
(`schedule-posts.use-case.ts`, defense-in-depth). Najwa QA Engineer
verifikasi browser: golden path PASS (tanggal hari ini + jam lewat →
`Alert` muncul + tombol submit disabled), edge case tanggal masa depan
PASS (tidak regresi), boundary case PASS.

- [x] **T-108.1** Validasi client: disable submit/tampilkan warning kalau tanggal = hari ini dan jam yang dipilih sudah lewat waktu saat ini
- [x] **T-108.2** Validasi server (defense in depth) di use-case/Server Action Schedule terkait — jangan hanya andalkan client
- [x] **T-108.3** Pesan error jelas ke user (bukan silent reject/masuk Queue diam-diam)

### T-111 · Restrukturisasi layout preview media post asli (History Detail & Post asal Engage)

| Field         | Value                                                                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done (8/8 subtask, 2026-10-07) — restrukturisasi layout preview media (desktop + mobile, History Detail & Post asal Engage) tuntas total, menutup KI-083 sepenuhnya |
| **Domain**    | publishing · engagement · UI                                                                                                                                           |
| **ADR**       | —                                                                                                                                                                      |
| **Depends**   | T-034.3 ✅, T-056 ✅, KI-082 Resolved (PR #144, wajib merge ke `staging` dulu sebelum T-111 dimulai — konfirmasi King Rezi)                                            |
| **Baca dulu** | `04-ux/key-screen-patterns.md` · Claude Design project "Social Media Management" (`templates/publish-history-detail.html`, `templates/engage-inbox.html`)              |
| **Ditemukan** | KI-083 (2026-10-06, King Rezi, setelah review hasil KI-082) — Promoted to T-111.                                                                                       |

**Gap:** fix KI-082 (lihat di atas) menambahkan thumbnail media di kedua lokasi, tapi dalam kotak crop kecil berukuran tetap (`h-30 w-full object-contain` di History Detail; `size-11 object-contain` di Post asal Engage). King Rezi menilai ini belum merepresentasikan post asli dengan baik — media perlu tampil dengan **lebar dan tinggi sesuai ukuran aslinya**, menyerupai tampilan post di platform sosial medianya, bukan dipaksa masuk ke kotak kecil.

**Klarifikasi scope (King Rezi, via `AskUserQuestion`, 2026-10-06):**

1. **Restrukturisasi total**, bukan sekadar ubah `object-fit`/ukuran di struktur yang sama — media jadi elemen visual utama (gambar besar, caption+link di bawahnya), pola layout baru.
2. **Pola visual boleh beda** antara kedua lokasi — History Detail (halaman penuh, lebih leluasa) dan Post asal Engage (kotak kecil di panel detail samping `/engage`, ruang terbatas) didesain sesuai konteks masing-masing, tidak wajib identik.

**Wajib AGENTS.md rule 17** sebelum menulis kode UI: kedua lokasi ini sudah punya rancangan di Claude Design (`publish-history-detail.html`, `engage-inbox.html`), tapi rancangan **saat ini merepresentasikan pola LAMA** (kotak kecil `.popover-thumb`/`.thumb`) — pola baru (restrukturisasi total) **belum ada** di Claude Design. Per rule 17: implementasi kode **STOP** sampai rancangan baru dibuat/dikunci di Claude Design (Neymar Product Designer, atau King Rezi langsung) untuk kedua subtask di bawah.

**Urutan eksekusi (konfirmasi King Rezi, 2026-10-06):** PR #144 (KI-082) wajib merge ke `staging` dulu — T-111 TIDAK dikerjakan di atas branch/PR yang sama, baru dimulai setelah merge.

- [x] **T-111.1** ✅ Done (2026-10-07, 3 revisi sama hari — final) — Claude Design: rancang ulang `templates/publish-history-detail.html` jadi **Modal/Dialog** (bukan hanya ubah ukuran media di struktur lama) — dikerjakan di sesi utama (bukan Neymar subagent, `DesignSync` gagal dimuat lagi di sesi subagent, pola sama § "Keterbatasan teknis" `.claude/agents/README.md`, izin eksplisit King Rezi 2026-10-06). Primitive FINAL: `.dialog-md-backdrop`+`.dialog-md` dengan **`.dialog-fs-header`+`.dialog-fs-body` SAJA — TIDAK PAKAI `.dialog-fs-footer`** (2 iterasi sempat pakai footer — "Published via X"/"Go to post", lalu list "Hasil per Akun" dengan scroll sendiri — keduanya dibatalkan: dua area scroll terpisah dalam satu dialog tidak enak dilihat, King Rezi). `.dialog-fs-body` (satu-satunya scroll area) berisi berurutan: caption → media natural-size → `.history-post-divider` → "Hasil per Akun" (paling bawah). Tiap baris "Hasil per Akun" punya **avatar+badge platform miliknya sendiri** (class `.history-target-account`, reuse `.channel-avatar-wrap`/`.channel-avatar`/`.channel-badge` dari sidebar, 28px/12px) menggantikan `.platform-dot`+nama platform generik — akurat per-target (draft paling awal sempat taruh 1 avatar representatif "target pertama published" di atas body — ambigu, sudah dibuang). LOCKED PATTERN, lihat komentar HTML di file + readme.md Screens section untuk riwayat lengkap 3 iterasi. **Catatan implementasi T-111.2:** caption perlu utility "linkify" baru (parse URL/#hashtag jadi `<a>`), belum ada di `apps/web/src` — scope kode baru, bukan sekadar styling.
- [x] **T-111.2** ✅ Done (2026-10-07) — Implementasi kode T-111.1 (`apps/web`, domain `publishing`, `HistoryDetail.tsx`)
- [x] **T-111.3** ✅ Done (2026-10-07, 2 revisi — final: kartu Instagram-style + avatar per-row + caption tanpa truncate) — Claude Design: rancang ulang `templates/engage-inbox.html` § `.post-context` — dikerjakan di sesi utama (sama seperti T-111.1, `DesignSync` tidak dicoba lagi di subagent Neymar). Draft pertama (COLUMN sederhana) diganti jadi **kartu ala post Instagram**: lebar TETAP 360px, DI-CENTER (`margin:0 auto`) di desktop, melebar penuh (`width:100%`) hanya ≤768px. Terbagi 2 sisi: atas `.post-context-media-wrap` (media RASIO 1:1, `object-fit:cover`) + 2 tombol carousel (`.post-context-carousel-btn` prev/next, ‹ › konsisten `.schedcal-nav`) melayang di atas badan gambar — HANYA 1 gambar tampil sekaligus (index ditangani T-111.4); bawah `.post-context-content`: label "Post asal" → **avatar+badge platform+nama akun** (`.post-context-account`, reuse PERSIS `.history-target-account` dari T-111.1 — `.channel-avatar-wrap`/`.channel-avatar`/`.channel-badge`, 28px/12px) → **caption TIDAK truncate lagi** (`.post-context-cap`, beda dari T-056 lama yang truncate 1 baris — sekarang wrap multi-baris penuh) → "Go to post →" (TIDAK berubah dari T-056). **Sengaja beda** dari History Detail (modal penuh, media unconstrained, bukan square/carousel) sesuai klarifikasi scope King Rezi 2026-10-06. Fallback no-media: `.post-context-nomedia` (bukan kartu 1:1, full-width, tidak di-center, tetap pakai avatar+caption-no-truncate yang sama), konsisten T-056 (media di-omit sepenuhnya). LOCKED PATTERN, lihat komentar HTML di file + readme.md Screens section.
- [x] **T-111.4** ✅ Done (2026-10-07) — Implementasi kode T-111.3 (`apps/web`, domain `engagement`, `EngageInboxView.tsx`)

**Implementasi (selesai, 2026-10-07):** `HistoryDetail.tsx` dirombak jadi Dialog
shadcn (LOCKED PATTERN T-111.1 — `.dialog-fs-header`+`.dialog-fs-body` saja,
tanpa footer); `media-thumbnail.tsx` menambah prop `fit="natural"` untuk
media ukuran asli (non-crop); `engage/actions.ts` menambah field
`thumbnails[]` ke payload post asal; `media.service.ts` menambah method
`resolveThumbnails()` (dipakai kedua lokasi, sekaligus ditambah test baru di
`media.service.test.ts`); 2 file baru —
`apps/web/src/components/shared/ChannelAvatarBadge.tsx` (avatar+badge
platform reusable, dipakai `HistoryDetail.tsx`) dan `apps/web/src/lib/linkify.tsx`
(utility parse URL/#hashtag di caption jadi `<a>`, dibutuhkan T-111.1 LOCKED
PATTERN). `EngageInboxView.tsx` menambah `PostOriginCard` — kartu
Instagram-style 360px + carousel media, LOCKED PATTERN T-111.3. Dikerjakan 2
subagent Mark UI Engineer paralel (T-111.2 History Detail, T-111.4 Post asal
Engage) + Elon Backend Engineer untuk data layer `resolveThumbnails()`.
Review Ridwan Architecture Reviewer: clean, 0 temuan blocking. QA Najwa:
golden path PASS kedua lokasi.

**Follow-up non-blocking ditemukan (dicatat, belum dikerjakan — bukan bagian
scope T-111 yang disetujui King Rezi):**

1. Duplikasi komponen: `EngageInboxView.tsx` masih pakai
   `PostContextAccountBadge` lokal sendiri, belum migrasi ke
   `ChannelAvatarBadge` baru yang diekstrak T-111.2 (konsekuensi 2 subagent
   paralel tanpa saling tahu komponen shared yang baru dibuat). Sebaiknya
   dikonsolidasi sekalian dengan 2 duplikat lama lain yang sudah ada
   (`PlatformBadge` di `ChannelsSection.tsx` dan `ConnectedAccountsList.tsx`).
2. Overflow horizontal minor di Dialog History Detail untuk pesan error
   target yang panjang (pre-existing dari T-034.3/PR#144, bukan regresi
   T-111.2) — perlu `break-words`/`whitespace-pre-wrap` di elemen pesan
   error.
3. Gap data: `HistoryItemTargetRecord` tidak membawa `avatarUrl` akun,
   sehingga avatar "Hasil per Akun" di History Detail selalu fallback ke
   inisial, tidak pernah foto profil asli — perlu field baru di
   repository/service kalau foto asli wajib tampil (keputusan King Rezi,
   bukan default assumption).

- [x] **T-111.5** ✅ Done (2026-10-07) — Desain mobile Engage Inbox (Claude Design)
  - **Domain:** UI
  - **Baca dulu:** `templates/engage-inbox.html` (Claude Design, versi desktop-only saat ini) · `04-ux/key-screen-patterns.md`
  - **Gap (ditemukan King Rezi, 2026-10-07, review ulang T-111 setelah 4/4 subtask desktop Done):** T-111 sebelumnya ditandai selesai 100%, tapi desain mobile untuk restrukturisasi media preview belum pernah ditentukan/dikunci. Verifikasi langsung ke CSS asli Claude Design (`styles.css`): `.inbox-shell` (grid `.thread-list` 340px + `.thread-detail` 1fr, dipakai halaman `/engage`) **tidak punya breakpoint mobile sama sekali** — satu-satunya aturan mobile yang ada di `@media (max-width:768px)` cuma `.post-context{width:100%; margin-left:0; margin-right:0}` (kartu "Post asal" doang, bukan keseluruhan layout 2-kolom thread-list+thread-detail). Di layar sempit, grid 2 kolom itu berisiko overflow horizontal — sempat dilaporkan Najwa QA Engineer saat QA T-111.4 sebagai "pre-existing dari T-053, bukan regresi T-111.4", tapi memang belum pernah didesain ulang untuk mobile. Belum ada pola "master-detail mobile" (mis. thread-list jadi full-screen dulu, push ke detail saat item dipilih, lalu tombol back — atau pola lain) yang didesain di Claude Design untuk Engage Inbox — ini keputusan desain baru, bukan sekadar resize CSS.
  - **Wajib AGENTS.md rule 17:** ini task UI/UX-related — implementasi kode (T-111.6) tidak boleh dimulai sebelum desain mobile ini dikunci di Claude Design (Neymar Product Designer atau King Rezi langsung), sama persis gate yang berlaku untuk T-111.1/T-111.3 sebelumnya.
  - **Keputusan (King Rezi, 2026-10-07, via `AskUserQuestion` — proactive-clarification sebelum menulis kode apapun):** **push navigation** — di ≤768px `.inbox-shell` berhenti jadi grid 2 kolom, satu panel (`.thread-list` atau `.thread-detail`) ditampilkan full-width sekaligus lewat state `data-mobile-view` ("list" default, "detail" setelah tap satu `.thread-item`), dengan tombol back (reuse PERSIS `.settings-back-btn` dari header `.settings-sidebar`) untuk kembali. Opsi lain yang DITOLAK: full-screen sheet/modal (reuse Dialog T-111.1), dan segmented tab switch (2 tab manual, tanpa auto-switch). Filter bar `.inbox-filter` (3 `<select>`) **tetap 3 dropdown**, cuma di-stack vertikal full-width — opsi "collapse ke 1 tombol Filter" DITOLAK. Dikerjakan langsung di `templates/engage-inbox.html` + `styles.css` + `readme.md` (sesi utama, pola sama T-111.1/T-111.3 — `DesignSync` tidak dicoba lagi di subagent Neymar). **SENGAJA TIDAK termasuk scope:** migrasi `.app-shell > .sidebar` halaman ini ke pola Mobile Shell (`.mobile-topbar`, KI-042) — dikonfirmasi saat eksplorasi bahwa pola itu baru ada sebagai demo standalone di `components/navigation-mobile.html`, belum di-retrofit ke screen real manapun (termasuk `publish-queue.html` dkk) — gap terpisah, bukan bagian T-111. LOCKED PATTERN, detail lengkap di komentar `styles.css` (cari "T-111.5") + entri Screens `readme.md`.

- [x] **T-111.6** ✅ Done (2026-10-07) — Implementasi kode T-111.5 (apps/web, domain engagement · UI)
  - **Depends:** T-111.5 ✅ Done.
  - **Implementasi:** `EngageInboxView.tsx` (`apps/web/src/app/(app)/engage/components/`) — state `mobileView: "list"|"detail"`; grid `.inbox-shell` di-override `max-md:grid-cols-1!` (breakpoint bawaan Tailwind, bukan arbitrary value — inline `style` 340px/1fr struktural existing tidak diubah); thread-list disembunyikan (`hidden md:block`) dan thread-detail ditampilkan (`flex`) sesuai state di mobile; header mobile baru (tombol back `ArrowLeft01Icon` + judul `detail?.authorHandle`) HANYA tampil mobile+state detail; header "Engage"+Refresh dan filter 3 dropdown disembunyikan saat mobile+state detail (full-bleed subpage), sesuai LOCKED PATTERN T-111.5.
  - **Penyederhanaan dilaporkan (bukan regresi):** 1 poin desain T-111.5 (border-radius/border `.inbox-shell` dihilangkan total saat mobile detail, "full-bleed" sampai tepi layar) SENGAJA dilewati — `.inbox-shell` tetap mempertahankan border+`rounded-xl` di semua state mobile, tidak di-override jadi borderless/square. Keputusan teknis call, dilaporkan eksplisit.
  - **Verifikasi (sesi utama, browser):** push navigation (list↔detail+back) bekerja sempurna di mobile 375×812, desktop grid 2 kolom tidak ada regresi, 0 error console.

- [x] **T-111.7** ✅ Done (2026-10-07) — Desain mobile History Detail (Claude Design)
  - **Domain:** UI
  - **Baca dulu:** `templates/publish-history-detail.html` (Claude Design, Dialog LOCKED PATTERN T-111.1)
  - **Gap (ditemukan King Rezi, 2026-10-07, review ulang T-111 setelah 4/4 subtask desktop Done):** Dialog (`.dialog-md{width:min(560px,92vw); max-height:82vh}`) secara angka computed-responsive (pakai `vw`) tapi belum pernah divalidasi VISUAL di viewport mobile sungguhan — apakah padding/layout tetap enak dilihat di layar kecil, apakah perlu jadi full-screen sheet alih-alih dialog mengambang, dst. Ini keputusan desain, bukan cuma resize CSS.
  - **Keputusan (King Rezi, 2026-10-07):** Dialog **TETAP floating `.dialog-md`** di semua ukuran — opsi full-screen sheet yang sempat direkomendasikan DITOLAK ("sisanya sudah bagus"). Scope final yang dikunci cuma 2 fix: (a) cegah scroll horizontal — `overflow-wrap:anywhere` pada caption + `overflow-x:hidden` pada `.dialog-md`, di-scope page-local `@media (max-width:768px)`; (b) `.history-target-row` ("Hasil per Akun") dipecah jadi 2 baris di mobile via flex-wrap+order (markup HTML tidak berubah) — baris 1: avatar+nama+chip, baris 2: pesan error/aksi. Sudah dicek `apps/web/src`: tidak ada reuse class `.history-target-row`/`.history-target-account` di luar Claude Design (cuma referensi nama class di komentar `ChannelAvatarBadge.tsx`), jadi T-111.8 aman mengikuti pola ini langsung tanpa migrasi tambahan. LOCKED PATTERN di `templates/publish-history-detail.html`.

- [x] **T-111.8** ✅ Done (2026-10-07) — Implementasi kode T-111.7 (apps/web, domain publishing · UI)
  - **Depends:** T-111.7 ✅ Done.
  - **Implementasi:** `HistoryDetail.tsx` (`apps/web/src/app/(app)/publish/history/[postId]/components/`) — tepat 3 titik: (a) `break-words` pada Text caption; (b) `overflow-x-hidden` pada container scroll body dialog; (c) baris target `status==="failed"`: `flex items-center justify-between` → `flex flex-wrap items-center justify-between` + Text error `min-w-0 flex-1 break-words` supaya teks error panjang wrap/shrink, tombol "Coba Lagi" tidak terdorong keluar viewport.
  - **Verifikasi (sesi utama, data nyata — error OAuthException panjang, post "test" 5 Okt 2026 11:27):** `document.documentElement.scrollWidth === clientWidth` (375=375, tidak ada scroll horizontal), tombol "Coba Lagi" fully in-viewport, desktop tidak ada regresi visual.

---

### T-125 · Default view Calendar jadi Monthly/Bulan

| Field         | Value                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done (2026-10-19)                                                                                             |
| **Domain**    | publishing · UI                                                                                                  |
| **ADR**       | — (ubah default, bukan baseline — kedua view `week`/`month` sudah didesain & diimplementasikan penuh sejak T-33) |
| **Terkait**   | T-033 (Calendar view)                                                                                            |
| **Depends**   | T-033 ✅                                                                                                         |
| **Baca dulu** | `apps/web/src/domains/publishing/services/parse-calendar-view-state.ts`                                          |

Diminta King Rezi (2026-10-19): saat buka `/publish/calendar` tanpa query
param `?view=`, tampilan default yang muncul sekarang `week` (ADR-046,
dikonfirmasi di Claude Design `templates/publish-calendar.html` — "default
Week"). King Rezi ingin default-nya `month`. Bukan perubahan desain baru —
toggle Minggu/Bulan dan kedua grid-nya sudah ada & terkonfirmasi di Claude
Design sejak T-033; task ini murni mengubah nilai default state URL,
termasuk kategori perubahan sepele (satu konstanta + penyesuaian fallback
logic), tidak melalui evaluasi delegasi subagent (ADR-063).

- [x] **T-125.1** `DEFAULT_CALENDAR_VIEW` di `parse-calendar-view-state.ts` → `"month"`, `parseViewMode` disesuaikan jadi eksplisit menerima literal `"week"`/`"month"` (sebelumnya fallback implisit via default — kalau default langsung diganti `"month"` tanpa ini, `?view=week` eksplisit akan ikut jatuh ke `"month"`), test terkait diupdate (22/22 pass). Diverifikasi browser: buka `/publish/calendar` tanpa query param → "Bulan" terpilih + grid Month tampil; toggle ke "Minggu" (`?view=week`) tetap berfungsi normal. `tsc --noEmit` bersih.

### T-126 · Imported posts tampil di Publish → History

| Field         | Value                                                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**    | ✅ Done (2026-10-19)                                                                                                                                                                                                                             |
| **Domain**    | publishing · UI                                                                                                                                                                                                                                  |
| **ADR**       | ADR-093 (status `Imported`, "tampil di Calendar & History" — bagian History belum pernah dieksekusi)                                                                                                                                             |
| **Terkait**   | T-090 (Imported — Calendar sudah ditampilkan, T-090 poin 6; History sengaja tetap dikecualikan), T-034 (History)                                                                                                                                 |
| **Depends**   | T-090 ✅                                                                                                                                                                                                                                         |
| **Baca dulu** | `apps/web/src/domains/publishing/services/publishing.service.ts` (`HISTORY_TERMINAL_STATUSES`, `listHistory`) · `apps/web/src/app/(app)/publish/history/history-status.ts` · Claude Design project "Postific" (`templates/publish-history.html`) |

Diminta King Rezi (2026-10-19): post berstatus `Imported` (post native yang
ditarik dari Outstand, lihat ADR-093) ingin ikut muncul di halaman History.

**Root cause:** `HISTORY_TERMINAL_STATUSES = [Published, Failed]` di
`publishing.service.ts` secara sengaja mengecualikan `Imported` (T-090 poin 6) — `HISTORY_STATUS_LABEL`/`HISTORY_STATUS_BADGE_VARIANT` di
`history-status.ts` sudah punya entry `Imported` tapi ditandai eksplisit
**"placeholder SEMENTARA, bukan keputusan desain final"**, murni untuk
memenuhi exhaustiveness check TypeScript.

**STOP — AGENTS.md rule 10:** dicek ke Claude Design project "Postific",
`templates/publish-history.html` **belum** merancang state `Imported` sama
sekali (filter status cuma "Semua Status/Published/Error", tidak ada chip
`Imported`). Badge `Imported` (`outline`, label "Imported") sudah LOCKED
untuk Calendar/Popover (T-090.5), tapi apakah pola yang sama di-reuse apa
adanya untuk History, atau History butuh treatment lain (mis. masuk filter
dropdown status, grouping tanggal pakai field apa karena `Imported` tidak
selalu punya `publishedAt`), belum dikunci King Rezi — perlu
`AskUserQuestion` dulu sebelum kode/Claude Design disentuh.

- [x] **T-126.1** Kunci rancangan di Claude Design — King Rezi dikonfirmasi via `AskUserQuestion` (2026-10-19): reuse badge `outline`/"Imported" yang sudah LOCKED di Calendar (T-090.5) apa adanya, TANPA entri baru di dropdown filter status History. `templates/publish-history.html` disinkronkan (contoh baris Imported ditambah di kelompok "Selasa, 15 Juli", ditandai LOCKED PATTERN).
- [x] **T-126.2** Implementasi: `HISTORY_TERMINAL_STATUSES` (`publishing.service.ts`) += `ContentStatus.Imported`. Dropdown filter status (`STATUS_OPTIONS`, `HistoryList.tsx`) **tidak diubah** sesuai keputusan T-126.1.

**Bug ditemukan & diperbaiki sekalian (ditemukan saat verifikasi browser, bukan scope terpisah):** sebelum fix ini, menambahkan `Imported` ke `HISTORY_TERMINAL_STATUSES` SAJA akan membuat `HistoryList.tsx` (variabel `isPublished = item.status === ContentStatus.Published`) dan `HistoryDetail.tsx` (`formatWhenLabel`) salah menganggap post Imported sebagai "gagal" — list akan menampilkan teks merah "Gagal dipublikasikan." dan detail menampilkan judul "Percobaan publish ...". Kedua tempat diperbaiki agar `ContentStatus.Imported` diperlakukan sama seperti `Published` (sama-sama terminal-sukses, punya `publishedAt` asli dari platform) — bukan percobaan publish dari tool ini. `history-status.ts` dan docstring `IPublishingRepository.getHistoryById`/`listHistory` diupdate agar tidak lagi menyebut entry `Imported` sebagai "placeholder sementara". Metrics tile tetap tidak tampil untuk Imported (otomatis, `item.metrics` selalu `null` untuk status non-Published — konsisten keputusan Calendar T-090.5 "metrics block sengaja tidak ditampilkan").

**Verifikasi:** `bun run vitest run` (root) — 832 passed/7 skipped, 0 failed (termasuk 2 test `listHistory` yang diupdate ke default `[Published, Failed, Imported]`). `tsc --noEmit`/`eslint .` (apps/web) bersih. Browser preview manual (data nyata, akun "Cook It Real Good"): `/publish/history` — badge "Imported" tampil benar di tiap item, teks meta "Dipublikasikan X lalu" (bukan error/merah); detail dialog — judul "Dipublikasikan 18 Oktober 2026 pukul 17.59" + badge "Imported", "Hasil per Akun" menampilkan link "Lihat post asli", tanpa metrics tile.

**Koreksi review PR 183 (2026-10-19):** saat itu `getPostPerformance` mengirim status `[Published, Failed]` eksplisit, jadi post `Imported` tetap di History dan tidak ikut angka Analyze. **Dibalik di T-129.1 (2026-10-19, lihat section T-129 di bawah)** — `getPostPerformance` sekarang reuse `HISTORY_TERMINAL_STATUSES`, jadi Imported SEKARANG ikut dihitung di Analyze juga. Jam di kiri kartu History memakai `updatedAt` (sama dengan judul tanggal kelompok). Teks "Dipublikasikan …" tetap memakai `publishedAt`.

---

### T-128 · Default view Home & Analyze jadi Monthly/Bulan

| Field         | Value                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done (2026-10-19)                                                                                                          |
| **Domain**    | analytics · UI                                                                                                                |
| **ADR**       | — (ubah default, bukan baseline — kedua period `weekly`/`monthly` sudah didesain & diimplementasikan penuh sejak T-042/T-043) |
| **Terkait**   | T-125 (pola sama untuk Calendar), T-042.3–T-042.5 (Dashboard Home), T-043–T-047 (Analyze)                                     |
| **Depends**   | T-042 ✅, T-043 ✅                                                                                                            |
| **Baca dulu** | `apps/web/src/app/(app)/page.tsx`, `apps/web/src/app/(app)/analyze/page.tsx`                                                  |

Diminta King Rezi (2026-10-19): saat buka halaman Home (`/`) dan Analyze
(`/analyze`), selector rentang waktu default yang muncul sekarang `weekly`
("Mingguan"). King Rezi ingin default-nya `monthly` ("Bulanan"). Bukan
perubahan desain baru — selector Mingguan/Bulanan dan kedua tampilan datanya
sudah ada & terkonfirmasi di Claude Design sejak T-042/T-043; task ini murni
mengubah nilai default state (dua konstanta, tidak saling bergantung), sama
kategorinya seperti T-125, tidak melalui evaluasi delegasi subagent (ADR-063).

- [x] **T-128.1** `DEFAULT_PERIOD` di `apps/web/src/app/(app)/page.tsx` (Home) → `"monthly"`.
- [x] **T-128.2** `INITIAL_PERIOD` di `apps/web/src/app/(app)/analyze/page.tsx` (Analyze) → `"monthly"`.

**Verifikasi:** `tsc --noEmit` (apps/web) bersih. Browser preview manual — `/` dan `/analyze` dibuka tanpa interaksi apa pun: selector menampilkan "Bulanan" terpilih dan data yang tampil sudah rentang bulan berjalan; ganti ke "Mingguan" via selector tetap berfungsi normal di kedua halaman.

---

### T-129 · Imported posts ikut dihitung di Analyze

| Field         | Value                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**    | ✅ Done (2026-10-19) — scope Analyze (T-129.1) saja. Follow-up Home dipindah jadi KI-093/T-130 (`known-issues.md`), lihat catatan di bawah |
| **Domain**    | publishing · analytics                                                                                                                     |
| **ADR**       | — (membalik keputusan sesi T-126/koreksi PR 183, bukan baseline arsitektur)                                                                |
| **Terkait**   | T-126 (History menampilkan Imported — sumber keputusan sebelumnya yang dibalik di sini), T-090/ADR-093 (status `Imported`)                 |
| **Depends**   | T-126 ✅                                                                                                                                   |
| **Baca dulu** | `apps/web/src/domains/publishing/services/publishing.service.ts` (`HISTORY_TERMINAL_STATUSES`, `getPostPerformance`)                       |

King Rezi bertanya (2026-10-19) kenapa post `Imported` tidak muncul di Home
dan Analyze. Investigasi menemukan dua akar masalah berbeda:

1. **Analyze** — disengaja. `getPostPerformance` (dipakai bersama oleh
   `getAccountOverview`, `getAnalyzeSummary`, `getEngagementSummary`,
   `getComparativeReport`) mengunci `statuses: [Published, Failed]` sejak
   koreksi review PR 183 (T-126) supaya Imported tidak ikut angka performa.
2. **Home** — beda mekanisme, BUKAN filter status internal. `totalPosts`
   dkk. di `AnalyticsService.getDashboardSummary` dibaca dari
   `AnalyticsWorkspaceSnapshot` yang disinkronkan dari metrik Outstand
   (`fetchWorkspaceMetrics` → `posts_count`, lihat
   `analytics-ingestion.use-case.ts` + `real-outstand-adapter.ts`) —
   mengubahnya butuh ganti param/endpoint Outstand atau beralih ke agregat
   Prisma internal, bukan sekadar ubah array status.

Dikonfirmasi King Rezi via `AskUserQuestion` (2026-10-19): Analyze → ya,
masukkan Imported sekarang. Home → perlu investigasi lanjut dulu (scope
lebih besar), **belum dikerjakan di sini**.

- [x] **T-129.1** `getPostPerformance` (`publishing.service.ts`) — `statuses` diganti dari `[Published, Failed]` eksplisit jadi reuse `HISTORY_TERMINAL_STATUSES` (`[Published, Failed, Imported]`), konsisten dengan default History. Komentar di `HISTORY_TERMINAL_STATUSES` dan di atas pemanggilan `listHistory` diupdate (tidak lagi bilang Analyze sengaja exclude Imported). Test `publishing.service.test.ts` ("tidak menghitung Imported" → "ikut menghitung Imported") diupdate.

**Verifikasi T-129.1:** `bun run vitest run` (root) — 835 passed/7 skipped, 0 failed. `tsc --noEmit` (apps/web) bersih. Browser preview manual (data nyata, akun "Cook It Real Good" dengan 15 post Imported) — `/analyze`: Total Posts naik dari 4 → 19, Account Overview menampilkan "15 posts" untuk Cook It Real Good, Post Performance menampilkan baris-baris post Imported-nya.

**Follow-up Home (2026-10-19, sesi lanjutan):** investigasi lanjut (MCP
`outstand`, live) menemukan root cause Home **beda** dari Analyze — bukan
soal exclude status, tapi field `posts_count` yang `null` dari Outstand
untuk akun Facebook Page (lihat detail lengkap di **KI-093/T-130**,
`known-issues.md`). King Rezi memilih menunda eksekusinya — dicatat sebagai
Known Issue terbuka, bukan subtask di tiket ini.

---

### T-131 · Bedakan request body Import Posts per trigger (cron harian / connect akun / manual Settings)

| Field         | Value                                                                                                                                                                                                                                                                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done (5/5 subtask)                                                                                                                                                                                                                                                                                                                                                       |
| **Domain**    | publishing                                                                                                                                                                                                                                                                                                                                                                  |
| **ADR**       | — (parameter tuning atas desain existing ADR-093 poin 5/7/9, bukan keputusan arsitektur baru)                                                                                                                                                                                                                                                                               |
| **Terkait**   | T-090, T-112, T-115 (tiga entry point `ImportPostsTriggerUseCase` yang parameternya diubah di sini), T-132, T-133                                                                                                                                                                                                                                                           |
| **Depends**   | T-115.1–.4 ✅ (sisa T-115.5 tidak memblokir; cron sudah wired ke job runner produksi; tiket ini murni mengubah nilai `since`/`until`/`limit` masing-masing trigger, bukan wiring baru)                                                                                                                                                                                      |
| **Baca dulu** | `apps/web/src/domains/publishing/services/import-posts-trigger.use-case.ts` (`triggerAuto`, `triggerPeriodicForAccounts`, `executeQueuedPeriodicImport`, `triggerManual`, `periodicImportSince`, `defaultSince`, `DEFAULT_IMPORT_LOOKBACK_DAYS`, `DEFAULT_IMPORT_LIMIT`) · `decisions/ADR-093-import-posts-dari-social-account-status-imported-read-only.md` (poin 5, 7, 9) |

**Konteks (diskusi King Rezi, 2026-10-20):** ketiga entry point Import Posts
(`triggerAuto` on-connect, cron harian T-115, `triggerManual` tombol "Sync
Now" Settings) sekarang memanggil `runImportSync` yang sama persis — body ke
Outstand (`since`/`until`/`limit`) identik di ketiganya, bedanya cuma cara
`since` dihitung. King Rezi ingin ketiganya benar-benar berbeda kebijakan,
dikonfirmasi lewat `AskUserQuestion`:

| Trigger                | `since` baru                                                                                                                                                                                 | `until` | `limit` baru    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------- |
| Cron harian            | **Mana yang lebih jauh ke belakang** antara watermark terakhir dan 24 jam lalu (pengaman anti-gap — kalau cron sempat gagal/terlewat, tetap mengejar dari watermark, bukan terpotong 24 jam) | now     | 100 (tetap)     |
| Saat connect akun      | 1 tahun lalu (dari 90 hari)                                                                                                                                                                  | now     | 1000 (dari 100) |
| Manual tombol Settings | watermark terakhir (tetap) — default 1 tahun kalau akun belum pernah sync (ikut baris di atas, bukan 90 hari lagi)                                                                           | now     | 1000 (dari 100) |

**Catatan biaya (perlu diverifikasi saat implementasi):** endpoint
`POST /v1/social-accounts/{id}/imports` ditandai "BERBAYAR" di ADR-093,
tapi model biayanya (per-call vs per-post-yang-diimpor) belum pernah
dikonfirmasi ke Outstand. Menaikkan `limit` dari 100 → 1000 bisa menaikkan
biaya kalau modelnya per-post — cek dulu sebelum deploy ke production.
Status implementasi (2026-10-20): verifikasi model biaya ini BELUM
dilakukan — follow-up terbuka, jangan deploy ke production sebelum
dikonfirmasi ke Outstand.

- [x] **T-131.1** `triggerAuto` (on-connect) — ubah `defaultSince`/lookback jadi 1 tahun (dari `DEFAULT_IMPORT_LOOKBACK_DAYS = 90`), limit jadi 1000 (dari `DEFAULT_IMPORT_LIMIT = 100`). Pertimbangkan apakah kedua konstanta ini perlu dipecah per-trigger (bukan lagi satu konstanta modul dipakai ketiganya)
- [x] **T-131.2** `triggerManual` — `since` tetap `input.lastImportedUntil` kalau ada; default saat kosong ikut 1 tahun (bukan 90 hari) biar konsisten dengan T-131.1. Limit jadi 1000
- [x] **T-131.3** Cron harian (`periodicImportSince`, dipakai `triggerPeriodicForAccounts` dan `executeQueuedPeriodicImport`) — ubah jadi `since = min(lastImportedUntil ?? (now - 24 jam), now - 24 jam)` (ambil yang lebih tua/lebih jauh ke belakang). Limit tetap 100
- [x] **T-131.4** Unit test tiap trigger untuk nilai baru, termasuk skenario gap cron eksplisit: watermark lebih tua dari 24 jam (mis. cron sempat gagal 3 hari) → `since` harus ikut watermark, BUKAN terpotong jadi 24 jam
- [x] **T-131.5** Regresi guard biaya existing (ADR-093 poin 8 concurrent-import per akun, poin 9 cooldown 24 jam + cap mingguan manual) — pastikan kenaikan `limit` tidak mengubah semantik guard yang sudah ada, dan guard manual tetap mengacu `payload.trigger = "manual"` seperti sebelumnya

---

### T-132 · Klasifikasi jenis konten (Story/Reel/Feed) hasil Import Posts via Outstand Analytics

| Field         | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**    | ✅ Selesai (2026-10-20)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Domain**    | publishing · integration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **ADR**       | **ADR-135** (Accepted) — perluasan kontrak ACL `IOutstandAdapter.fetchPostMetrics`/`FetchPostMetricsResult` (AGENTS.md #2, perubahan shape kontrak publik domain)                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Terkait**   | T-090, T-041 (gap `FetchPostMetricsResult` sudah tercatat sejak redesain 2026-08-26, follow-up ini belum pernah dikerjakan), T-131, T-133                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Depends**   | — (independen dari T-131 — bisa paralel; T-133 butuh tiket ini selesai dulu)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Baca dulu** | `packages/shared/src/contracts/outstand-adapter.ts` (`FetchPostMetricsResult`, baris 393-416 — baca komentar gap-nya dulu) · `packages/shared/src/enums.ts` (`ContentFormat` — `Post`/`Reel`/`Story`/`Pin` SUDAH ada, tidak perlu enum baru) · `apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts` (`fetchPostMetrics`) · `apps/web/src/lib/repositories/publishing/upsert-imported-posts.ts` (`targetCreateFields`, baris 327-338 — hardcode `contentFormat: ContentFormat.Post`) · `apps/web/src/domains/publishing/services/backfill-outstand-post-ids.use-case.ts` (pola best-effort T-114 yang direuse di sini) |

**Konteks (investigasi 2026-10-20, dikonfirmasi King Rezi):** endpoint
import Outstand (`GET /v1/posts`, `GET /v1/posts/{id}`) **tidak punya field
jenis konten sama sekali** — dipastikan lewat OpenAPI resmi DAN data nyata
(post Story asli di akun test tidak punya field pembeda apa pun). Satu-nya
sinyal RESMI (bukan tebakan) ada di `GET /v1/posts/{id}/analytics`
(`fetchPostMetrics`):

- Instagram: `media_product_type` (`FEED`/`REELS`/`STORY`), dikonfirmasi di `MAnO3` (`FEED`)
- Facebook: `platform_specific.video.is_reel`, dikonfirmasi di `LGyF6` — post yang di DB kita ter-label `contentFormat: 'post'` ternyata `is_reel: true` (BUKTI NYATA bug hardcode, bukan hipotesis)
- Story yang sudah kadaluarsa (>24 jam): analytics gagal (`metrics_expired`/`story_expired`) — jenis kontennya TIDAK BISA diketahui lagi lewat jalur ini, harus fallback

Kontrak `FetchPostMetricsResult` SAAT INI flat (`impressions`, `reach`,
`likes`, `comments`, `shares`, `clicks`, `engagementRate`) — field di atas
**dibuang** oleh adapter sebelum sampai ke domain manapun (gap yang sudah
didokumentasikan sebagai follow-up T-041 sejak redesain 2026-08-26, baru
dikerjakan di tiket ini).

**Keputusan King Rezi (`AskUserQuestion`, 2026-10-20):** pakai sinyal
analytics ini (bukan heuristik URL/aspek-rasio — eksplisit ditolak King
Rezi setelah riset sendiri ke dokumentasi Outstand), jalan sebagai langkah
best-effort TERPISAH dari proses import utama (pola sama T-114 backfill —
gagal di sini tidak membatalkan import yang sudah sukses), diterapkan ke
SEMUA post yang berhasil diimpor per sync (N = limit trigger yang sedang
jalan dari T-131, BUKAN dibatasi angka tetap seperti usulan awal 20).

- [x] **T-132.1** Tulis ADR baru: perluasan `FetchPostMetricsResult` per-akun dengan field opsional `mediaProductType?: "FEED" | "REELS" | "STORY"` (Instagram), `isReel?: boolean` (Facebook), `storyExpired?: boolean` — definisikan juga aturan mapping ke `ContentFormat` internal (`Post`/`Reel`/`Story`) dan fallback eksplisit kalau semua field ini kosong/tidak relevan untuk platform tersebut
- [x] **T-132.2** Update `RealOutstandAdapter.fetchPostMetrics` supaya meneruskan field baru dari response asli Outstand (sekarang dibuang saat mapping ke shape flat)
- [x] **T-132.3** Update double/fake test kalau masih dipakai di unit test (ADR-119 — bukan jalur produksi, cuma test)
- [x] **T-132.4** Use-case klasifikasi baru (pola best-effort sama `BackfillOutstandPostIdsUseCase`/T-114) — dipanggil setelah `ImportPostsProcessUseCase.process`, iterasi SEMUA post yang baru diimpor di batch itu, panggil `fetchPostMetrics` per post, update `PublishingPostTarget.contentFormat` sesuai mapping T-132.1, biarkan default (fallback) kalau sinyal tidak tersedia
- [x] **T-132.5** Ganti hardcode `contentFormat: ContentFormat.Post` di `upsert-imported-posts.ts:331` jadi default eksplisit "belum terklasifikasi" dengan komentar yang menjelaskan keterbatasan Outstand (bukan diam-diam berasumsi "semua post biasa") — nilai akhir akan di-overwrite T-132.4 kalau sinyal tersedia
- [x] **T-132.6** Unit test: mapping `media_product_type`/`is_reel` → `ContentFormat`, kasus Story expired (fallback), kasus platform tanpa sinyal analytics (fallback)
- [x] **T-132.7** Verifikasi tampilan popover Calendar "Imported" (T-090.5, LOCKED PATTERN) untuk `ContentFormat.Reel`/`.Story` hasil klasifikasi baru — enum & label UI-nya kemungkinan SUDAH ada (dipakai alur publish biasa), jadi cek dulu apakah ini genuinely perlu sentuhan komponen baru atau cukup data yang sekarang benar; kalau butuh KOMPONEN/VARIAN baru, **wajib cek Claude Design dulu** (AGENTS.md #10) sebelum ubah kode

**Catatan T-132.7 (2026-10-20):** TIDAK perlu komponen/varian UI baru — komponen
Calendar "Imported" popover existing sudah generik untuk seluruh `ContentFormat`
(Post/Reel/Story/Pin), data yang sekarang benar sudah cukup.

**Status QA (2026-10-20):** Review Ridwan Architecture Reviewer PASS (tidak ada
pelanggaran). QA Najwa PASS (unit test independen hijau semua); verifikasi
visual popover Reel/Story belum bisa dibuktikan karena belum ada data nyata
berlabel Reel/Story di workspace test — gap data yang memang expected, bukan
bug.

---

### T-133 · Backfill retroaktif Import Posts lama + verifikasi dukungan resmi Import per platform

| Field         | Value                                                                                                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done — T-133.2/.3 dieksekusi dan T-133.4 diverifikasi browser (2026-10-23); Pinterest keterbatasan eksplisit (T-133.1)                                                                                                        |
| **Domain**    | publishing · integration                                                                                                                                                                                                         |
| **ADR**       | —                                                                                                                                                                                                                                |
| **Terkait**   | T-131, T-132, T-114 (pola backfill existing direuse untuk migrasi satu-kali), T-130/T-134/T-135/T-136 (blocker, lihat catatan di bawah)                                                                                          |
| **Depends**   | T-131 ✅ (selesai), T-132 ✅ (selesai)                                                                                                                                                                                           |
| **Baca dulu** | `apps/web/src/domains/publishing/services/backfill-outstand-post-ids.use-case.ts` (T-114, pola migrasi satu-kali yang direuse) · `apps/web/src/domains/publishing/services/import-posts-trigger.use-case.ts` · hasil T-131/T-132 |

**Konteks:** dua gap yang perlu dibereskan untuk akun yang SUDAH terhubung
sebelum T-131/T-132 ada:

1. 43 post `Imported` existing (akun test "Cook It Real Good") masih
   `contentFormat: 'post'` hardcoded — perlu diklasifikasi ulang pakai
   T-132.4 secara retroaktif.
2. Lookback akun existing sudah "maju" mengikuti watermark masing-masing
   (sebagian jauh lebih baru dari 1 tahun lalu) — perluasan default ke 1
   tahun di T-131.1 TIDAK otomatis membuat akun lama "mundur" menangkap
   konten lama yang pernah terlewat; perlu trigger ulang eksplisit dengan
   `since` diperluas.

Selain itu, King Rezi minta semua platform masuk scope, dengan prioritas:
**Instagram → Facebook → TikTok → Pinterest**, sisanya menyusul. Investigasi
2026-10-20 ke `outstand.so/docs/configurations/{platform}` menemukan **Import
belum terbukti didokumentasikan resmi di luar Instagram/Facebook** —
LinkedIn eksplisit menolak untuk personal profile ("importing posts from a
personal profile is not supported and will fail"), TikTok/YouTube/Pinterest
tidak menyebut import sama sekali di dokumentasi publik mereka. Jangan
asumsikan endpoint generic `POST /v1/social-accounts/{id}/imports` otomatis
jalan untuk semua network — perlu dibuktikan satu-satu.

- [~] **T-133.1** Verifikasi langsung ke Outstand (uji coba `importPosts` ke akun test TikTok dan Pinterest yang representatif, atau konfirmasi resmi dari support Outstand kalau tidak ada akun test) — apakah endpoint Import benar-benar berfungsi untuk kedua platform ini. Kalau gagal/tidak didukung, catat sebagai keterbatasan eksplisit (bukan diasumsikan jalan)
- [x] **T-133.2** Migrasi satu-kali: re-trigger import untuk `WorkspaceConnectedAccount` existing (Instagram, Facebook dulu) dengan `since` diperluas ke 1 tahun lalu — dijalankan sebagai script/job satu-off, BUKAN bagian job rutin, dedup existing (`upsertImportedPostsTx`) sudah aman dipakai ulang
- [x] **T-133.3** Jalankan T-132.4 (use-case klasifikasi) secara retroaktif untuk 43 post Imported existing + post baru hasil T-133.2
- [x] **T-133.4** Verifikasi end-to-end browser + DB nyata (pola sama addendum T-090/T-112) minimal untuk Instagram + Facebook; lanjut TikTok/Pinterest kalau T-133.1 konfirmasi didukung
- [x] **T-133.5** Update `PROJECT_STATE.md`/`AVAILABLE_TICKETS.md` setelah selesai (status final tiket ini saja, bukan detail task — ADR-062). Terpenuhi: T-133 ✅ Done (2026-10-23) tercatat di keduanya

**Catatan status (2026-10-20):** T-133.1 tidak bisa diverifikasi — tidak ada
akun test TikTok/Pinterest di workspace ini, dicatat sebagai keterbatasan
eksplisit. T-133.2 & T-133.3: script migrasi satu-off sudah ditulis
(`apps/web/scripts/t133-retrigger-import-extended-lookback.ts`,
`apps/web/scripts/t133-backfill-classify-imported-content-format.ts`, default
dry-run, perlu flag `--execute`), BELUM dieksekusi — menunggu konfirmasi
eksplisit King Rezi karena memanggil Outstand API nyata + menulis data
production/staging. T-133.4 & T-133.5 belum bisa dikerjakan (tergantung
eksekusi di atas).

**Update T-133.1 (2026-10-23):** TikTok **terbukti didukung** — akun real
`cookitrealgood` (TikTok) menyelesaikan job `import.sync` (`done`) dan
menyimpan 100 post `Imported` (terbit 2026-03-14 s/d 2026-05-30), dicek
langsung di DB. Pinterest sengaja diabaikan (King Rezi tidak bisa login ke
akun Pinterest), tetap keterbatasan eksplisit.

**Update blocker (2026-10-23):** T-130, T-134, T-135, T-136 dan T-139
(hambatan tambahan, import batch besar) semuanya ✅ Done; bug tambahan
T-141 (pagination `GET /v1/posts`) juga ✅ Done. Blocker terbuka. Status
tiket ini sekarang **Sebagian siap** — T-133.2/.3 (script `--execute`)
menunggu konfirmasi eksplisit King Rezi, belum dijalankan.

**Eksekusi (King Rezi konfirmasi di chat, 2026-10-23):**
`t133-retrigger-import-extended-lookback.ts --execute` dijalankan dua kali.
Run 1: Instagram 0 baru / 182 duplikat / 179 terklasifikasi (3 timeout
analytics Outstand), Facebook gagal "timeout polling" 120 detik (Outstand
lambat). Run 2: **Facebook imported=184 (classified=103)**, Instagram
skippedDuplicate=182 classified=182. Hasil DB: Facebook 81 post + 103 reel,
Instagram 80 post + 102 reel (rentang 2025-10-22 s/d 2026-10-22), TikTok 100
post. T-133.3: script klasifikasi terpisah 0 kandidat (sudah tercakup
langkah klasifikasi T-133.2; 43 post lama akun lama sudah hilang saat
pembersihan data T-134). Snapshot Home `monthly totalPosts=25` (diverifikasi
via script refresh, bukan dilihat di browser).

**T-133.4 diverifikasi browser (2026-10-23, localhost:3000, akun real):**
Home "Post terpublikasi" = 25 (post distinct, cocok snapshot); Analyze
Bulanan Total Posts = 29 (Facebook 15 + Instagram 14, granularitas
post x akun, beda dari Home sesuai keputusan ADR-136) dengan daftar Post
Performance berisi post Facebook dan Instagram; History menampilkan post
`Imported` Facebook dan Instagram. Catatan pengamatan (di luar scope, belum
diselidiki): di History semua baris tampil dengan jam 10.12 di bawah grup
"Jumat, 23 Oktober" walau tertulis dipublikasikan lebih lama — kemungkinan
pengelompokan memakai waktu import, bukan `publishedAt`.

**Blocking eksplisit (King Rezi, 2026-10-21):** jangan eksekusi T-133.2
(re-trigger import dengan `since` diperluas) sebelum 4 tiket berikut tuntas —
keempatnya lahir dari investigasi ketidaksesuaian data Supabase vs Outstand di
sesi yang sama, dan langsung mempengaruhi akurasi data yang mau di-backfill
di sini (percuma backfill retroaktif kalau akun yang sudah disconnect masih
ikut ketarik, atau window "bulanan" yang dipakai untuk verifikasi hasilnya
sendiri belum didefinisikan ulang):

- **T-130** (`known-issues.md`, KI-093) — `totalPosts` Home tidak akurat
  untuk akun `posts_count` null di Outstand (Facebook Page)
- **T-134** (`known-issues.md`, KI-094) — disconnect akun sosial tidak
  dipropagasi ke Outstand; termasuk cleanup data residu akun `turanilkerl`
- **T-135** (`known-issues.md`, KI-095) — definisi periode "bulanan"
  Home/Analyze beda dari kalender Outstand
- **T-136** (`known-issues.md`, KI-096) — ambiguitas semantik label "Post
  terpublikasi" Home

Begitu keempatnya ✅ Done, status tiket ini kembali ke 🚫 Sebagian siap
(menunggu konfirmasi eksekusi script seperti sebelumnya), bukan otomatis
jalan.

**Update (Gibran Project Manager, 2026-10-21):** implementasi, test otomatis,
review Ridwan, dan QA Najwa untuk keempat tiket (T-130/T-134/T-135/T-136)
sudah PASS — lihat `tickets/known-issues.md` § masing-masing. Blocker ini
**tetap** berlaku apa adanya karena keempatnya masih berstatus 🚫 (belum ✅
Done penuh), satu-satunya sisa pekerjaan di tiap tiket adalah verifikasi
E2E browser yang terhambat ketiadaan akun test Outstand baru (workspace King
Rezi kosong). Begitu akun test tersedia dan verifikasi browser lolos,
keempat tiket ditutup ✅ Done dan blocker ini terbuka tanpa perlu investigasi
ulang — tidak ada pekerjaan kode tersisa untuk membuka blocker ini.

### T-142 · Bug 🔴: History mengelompokkan, mengurutkan, dan menjam kartu memakai `updatedAt` (kolom audit), bukan `publishedAt`

| Field         | Value                                                                                                                                                                                                                                                                                                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done (PR 193) — keputusan produk T-142.1 (2026-10-23); T-142.2/T-142.3 digugurkan; verifikasi browser oleh King Rezi 2026-10-23                                                                                                                                                                                                                                                |
| **Domain**    | publishing · UI                                                                                                                                                                                                                                                                                                                                                                   |
| **ADR**       | tidak perlu (T-142.3 gugur): hanya mengganti kolom kunci, bukan baseline arsitektur                                                                                                                                                                                                                                                                                               |
| **Terkait**   | ADR-093 (Imported tampil di History), T-034 (History), T-133 (backfill 1 tahun yang memunculkan bug), T-143 / KI-102 (import periodik, menambah baris Imported ber-`updatedAt` baru)                                                                                                                                                                                              |
| **Depends**   | —                                                                                                                                                                                                                                                                                                                                                                                 |
| **Baca dulu** | `apps/web/src/domains/publishing/services/group-history-items.ts` · `apps/web/src/app/(app)/publish/history/history-list-row.ts` · `apps/web/src/app/(app)/publish/history/HistoryList.tsx` · `listHistory` di `apps/web/src/lib/repositories/publishing/publishing.repository.ts` (`orderBy updatedAt desc` di sekitar baris 828; baris ~251 adalah `listDrafts`, bukan History) |

**Bug (dilaporkan King Rezi 2026-10-23, setelah verifikasi):** di Publish
-> History semua post tercatat di grup tanggal hari ini, padahal seharusnya
sesuai `publishedAt`. Sebelumnya dicatat sebagai usulan non-bug; King Rezi
memutuskan memakai `publishedAt` (T-142.1), jadi ini sekarang bug.

**Diagnosis (diverifikasi di kode):**

- `groupHistoryItemsByDate` (`group-history-items.ts:50`) mengunci grup dengan
  `toCalendarDateKey(item.updatedAt)`; `historyListClockDate`
  (`history-list-row.ts`) memakai `updatedAt` yang sama; `listHistory`
  memakai `orderBy: { updatedAt: "desc" }`.
- Desain awal sengaja memakai `updatedAt` agar urutan grup selaras dengan
  `orderBy`, dengan asumsi `updatedAt` ~ waktu selesai. Asumsi patah untuk post
  `Imported`: `updatedAt` = waktu import (satu batch, jam sama), `publishedAt` =
  waktu terbit asli. Setelah backfill T-133 (366 post) dan import
  periodik/cron, semua menumpuk di grup hari import, sementara teks kartu
  menulis "Dipublikasikan <publishedAt>" sehingga tanggal grup, jam, dan teks
  saling bertentangan.
- Risiko tambahan: `updatedAt` berubah tiap baris di-update (klasifikasi
  ContentFormat T-132, backfill, re-import), jadi post lama bisa "pindah" ke
  hari ini kapan pun.
- Akar masalah: kunci grup, urutan, dan jam memakai kolom audit (`updatedAt`)
  alih-alih waktu bisnis (`publishedAt`). Published/Failed hanya tampak aman
  karena `publishedAt` ~ `updatedAt` saat baris dibuat.

**Perbaikan:** kunci grup, `orderBy`, dan jam kartu = `publishedAt ?? updatedAt`
(Failed: `failedAt ?? updatedAt`). Realtime patch di `HistoryList.tsx` ikut
konsisten (sort lokal sama dengan `orderBy` server).

- [x] **T-142.1** Keputusan produk King Rezi (2026-10-23): History memakai
      `publishedAt` (bukan `updatedAt`) untuk pengelompokan, urutan, dan jam
- [x] **T-142.2** ~~Cek Claude Design~~ **Gugur** (King Rezi, 2026-10-23):
      tampilan History tidak berubah (tata letak, komponen, kelompok tanggal
      sama); yang salah hanya kolom kunci, jadi ini perbaikan data, bukan
      keputusan visual (aturan 10 tidak terpicu)
- [x] **T-142.3** ~~ADR baru~~ **Gugur** (King Rezi, 2026-10-23): mengganti
      kolom kunci urutan bukan perubahan baseline; keputusan dicatat di tiket
- [x] **T-142.4** Implementasi: `group-history-items.ts`, `history-list-row.ts`,
      `listHistory` (satu lokasi: sort JS memakai `compareHistoryItemsDesc`; baris ~251 itu `listDrafts`, tidak diubah), dan Realtime patch di
      `HistoryList.tsx` (`publishedAt ?? updatedAt`, Failed `failedAt ?? updatedAt`)
- [x] **T-142.5** Test unit pengelompokan lintas tanggal (Imported lintas
      tanggal, campuran Imported/Published/Failed, `publishedAt` null) dan
      verifikasi browser History. Diverifikasi King Rezi di browser
      2026-10-23: kartu Imported di grup tanggal terbitnya, jam cocok, urutan benar

### T-144 · Zona waktu tampilan Publish → History/Calendar/Queue memakai Asia/Jakarta (WIB tetap), bukan UTC

| Field         | Value                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done (2026-10-23, PR 194) — keputusan King Rezi 2026-10-23 (via AskUserQuestion)                                                                                                                                                                                                                                                                                                                         |
| **Domain**    | publishing · UI                                                                                                                                                                                                                                                                                                                                                                                             |
| **ADR**       | tidak ada ADR existing yang menetapkan UTC untuk tampilan Publish (grep `DECISIONS.md` dan `decisions/`: satu-satunya "UTC" eksplisit ada di ADR-136, window bulanan Home/Analytics, di luar scope tiket ini). Komentar kode yang menyebut konvensi UTC hanya konvensi kode. Belum ada timezone per workspace. Bila nanti timezone per workspace dibuat, itu butuh ADR baru; ADR-136 tidak diubah tiket ini |
| **Terkait**   | T-142 (PR 193, asal temuan), ADR-136 (window bulanan UTC, tidak disentuh)                                                                                                                                                                                                                                                                                                                                   |
| **Depends**   | T-142                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Baca dulu** | `apps/web/src/domains/publishing/services/group-history-items.ts` · `group-queue-items.ts` · `calendar-range.ts` · `apps/web/src/app/(app)/publish/history/HistoryList.tsx` · `QueueList.tsx` · `CalendarToolbar.tsx` · `CalendarAgendaList.tsx`                                                                                                                                                            |

**Asal:** code review PR 193 (T-142) temuan #1.

**Masalah:** kunci grup tanggal (`toCalendarDateKey` memakai `toISOString`
di `group-history-items.ts` dan `group-queue-items.ts`), `calendar-range.ts`,
dan formatter `timeZone: "UTC"` di `HistoryList.tsx`, `QueueList.tsx`,
`CalendarToolbar.tsx`, `CalendarAgendaList.tsx` memakai UTC. Post terbit
2026-09-02 00:59 WIB (= 2026-09-01T17:59Z) tampil di grup 1 September jam
17:59.

**Keputusan (King Rezi, 2026-10-23):** pakai `Asia/Jakarta` tetap di ketiga
layar (History, Calendar, Queue). Belum ada timezone per workspace.

**Claude Design:** tidak dicek, tampilan dan tata letak tidak berubah, hanya
zona waktu data (aturan 10 tidak terpicu).

- [x] **T-144.1** Helper tanggal zona WIB bersama (satu tempat) untuk kunci tanggal, awal/akhir hari, dan formatter
- [x] **T-144.2** History memakai helper (grup, jam kartu, Realtime patch)
- [x] **T-144.3** Queue memakai helper
- [x] **T-144.4** Calendar: range, group, dan formatter
- [x] **T-144.5** Test unit batas hari WIB (mis. 2026-09-01T17:59Z masuk 2 September 00:59)
- [x] **T-144.6** Verifikasi browser (2026-10-23, dijalankan AI atas permintaan King Rezi di dev server lokal pada branch `staging` pasca merge PR 194, bukan di deploy Railway). History dan Calendar cocok dengan `published_at` di DB dalam WIB, termasuk batas hari (16 Okt 21:00 UTC tampil 17 Okt 04.00; 4 Okt 21:00 UTC tampil Senin 5 Okt 04:00). Queue kosong (tidak ada post terjadwal), jadi grup tanggal Queue belum teruji dengan data nyata; tidak ada error console

**Hasil review Ridwan (2026-10-23):** temuan 1 diperbaiki (`formatRelativeTime`
kini memakai `timeZone` WIB); `MS_PER_DAY` duplikat dan komentar UTC usang
dirapikan.

**Keterbatasan (diketahui, belum diputuskan):**

- Input jadwal di Draft Editor masih memakai zona waktu browser, sedangkan
  tampilan Publish sudah WIB. Ditindaklanjuti di **T-146**.
- Ada dua definisi "bulan": Calendar memakai WIB (tiket ini), Home/Analyze
  memakai UTC (ADR-136). Belum diformalkan lewat ADR. Usulan Ridwan, keputusan
  ada di King Rezi.

### T-145 · `occurredAt` tersimpan untuk pengurutan History di database

| Field         | Value                                                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done (2026-10-23, PR 194) — migrasi terterap di DB dan urutan History terverifikasi; dua catatan review tersisa di bawah                        |
| **Domain**    | publishing · database                                                                                                                              |
| **ADR**       | cek saat T-145.1: perubahan skema/baseline data bisa butuh ADR baru; catat keputusannya di tiket                                                   |
| **Terkait**   | T-142 (PR 193, asal temuan), T-144                                                                                                                 |
| **Depends**   | T-142 (PR 193) merged                                                                                                                              |
| **Baca dulu** | `listHistory` di `apps/web/src/lib/repositories/publishing/publishing.repository.ts` · `compareHistoryItemsDesc` · `apps/web/prisma/schema.prisma` |

**Asal:** code review PR 193 temuan #4.

**Masalah:** `listHistory` kini sort di JS (`compareHistoryItemsDesc`)
karena Prisma `orderBy` tidak bisa COALESCE lintas kolom, sehingga
pagination tidak mungkin.

**Usulan:** kolom/ekspresi `occurredAt` di DB (Failed: `failedAt ??
updatedAt`, selain itu `publishedAt ?? updatedAt`) lewat generated column atau
kolom biasa + backfill, plus index `(workspace_id, occurred_at desc)`
sehingga `orderBy` DB dan pagination mungkin.

**Keputusan T-145.1 (2026-10-23):** generated column `GENERATED ALWAYS AS
(CASE WHEN status = 'failed' THEN COALESCE(failed_at, updated_at) ELSE
COALESCE(published_at, updated_at) END) STORED`, raw SQL di migrasi
`20261023120000_t145_publishing_posts_occurred_at`. Alasan: (1) nilai selalu
konsisten dengan status/timestamp (retry Failed -> Published, import, update
`updated_at` otomatis menghitung ulang) tanpa trigger atau jalur tulis baru di
aplikasi; (2) tanpa backfill terpisah (kolom terisi saat ADD COLUMN);
(3) ekspresi CASE/COALESCE atas `timestamptz` bersifat IMMUTABLE sehingga sah;
(4) RLS tidak terpengaruh (kebijakan `publishing_posts_workspace_isolation`
per-baris); (5) shadow DB hanya replay DDL biasa. Di `schema.prisma` kolom
dideklarasikan `occurredAt DateTime @default(dbgenerated())` (read-only,
tidak ikut `data` create/update); risiko: `prisma migrate dev` perlu dicek
tidak menghasilkan drift palsu untuk kolom generated ini (belum diuji, tidak
ada Postgres lokal). Kolom biasa + backfill ditolak: butuh trigger atau tiap
jalur tulis mengisi sendiri, rawan drift.
Tie-breaker `orderBy`: `occurredAt desc, updatedAt desc, id desc` (uuid
Postgres berurut bytewise = urutan leksikografis string hex huruf kecil di
JS). Komparator JS `compareHistoryItemsDesc` tetap dipakai sort lokal
Realtime; beda presisi hanya mikrodetik (DB) vs milidetik (JS).
**ADR:** perubahan skema data tambahan (kolom turunan, bukan perubahan
baseline/kontrak) — keputusan apakah butuh ADR ada di King Rezi; ADR tidak
dibuat oleh sesi ini.
**Risiko operasional:** `ADD COLUMN ... GENERATED STORED` menulis ulang seluruh
tabel `publishing_posts` dengan ACCESS EXCLUSIVE lock selama rewrite; tabel
kecil (satu baris per post), terapkan di luar jam sibuk.

- [x] **T-145.1** Desain: generated column vs kolom biasa; migrasi Prisma 7 + shadow DB; cek kebutuhan ADR (keputusan di atas; shadow DB belum dijalankan, tidak ada Postgres lokal)
- [x] **T-145.2** Migrasi + backfill (terterap 2026-10-23 06:50 UTC, tanpa rollback; kolom `occurred_at` `GENERATED ALWAYS` sesuai ekspresi desain, indeks `(workspace_id, occurred_at DESC)` ada; 484 post, 0 null, 0 beda dari `published_at`; backfill tidak perlu karena generated column. Belum ada post `failed` di data, cabang failed belum teruji dengan data nyata)
- [x] **T-145.3** `listHistory` `orderBy occurredAt desc` dengan tie-breaker `updatedAt desc, id desc`; sort JS di repository dihapus (komparator tetap untuk Realtime)
- [x] **T-145.4** Test (`list-history.test.ts` memeriksa orderBy dan tidak re-sort; `bun run test` hijau)
- [x] **T-145.5** Verifikasi staging (2026-10-23: urutan 8 post teratas di halaman History sama dengan `ORDER BY occurred_at DESC, updated_at DESC, id DESC` di DB; dicek lewat dev server lokal ke DB yang sama, bukan deploy Railway)

**Catatan review (2026-10-23), masih terbuka setelah Done:**

- SQL migrasi sudah terterap di Postgres DB (lihat T-145.2); belum diuji lewat shadow DB.
- Belum dijalankan (PR 194 sudah merge, belum ada pengujian shadow DB): jalankan `prisma migrate diff --from-migrations ...
--to-schema-datamodel` dengan shadow DB. Hasilnya harus kosong; ini menguji
  drift akibat `@default(dbgenerated())` pada kolom generated.
- Paritas ekspresi SQL `occurred_at` terhadap `historyItemOccurredAt` (JS)
  perlu komentar silang di kedua tempat atau test integrasi.

### T-146 · Input jadwal draft editor memakai zona waktu browser, tampilan Publish sudah WIB

| Field         | Value                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**    | ✅ Done 2026-10-23 (atas pernyataan King Rezi setelah verifikasi browser)                                                                |
| **Domain**    | publishing · UI                                                                                                                          |
| **ADR**       | tidak ada; bila King Rezi memutuskan zona per workspace, butuh ADR baru                                                                  |
| **Terkait**   | T-144 (asal temuan, review Ridwan temuan 2), ADR-136 (tidak disentuh)                                                                    |
| **Depends**   | T-144                                                                                                                                    |
| **Baca dulu** | `apps/web/src/app/(app)/components/draft-editor/Modal.tsx` · `schedule-time-constraints` · `apps/web/src/domains/publishing/wib-time.ts` |

**Asal:** review Ridwan T-144 temuan 2.

**Lokasi:** `apps/web/src/app/(app)/components/draft-editor/Modal.tsx`
(sekitar baris 501 dan 825-827: `new Date(`${scheduleDate}T${scheduleTime}`).toISOString()`
dibaca sebagai waktu lokal browser), `schedule-time-constraints`, dan pesan
validasi di Modal.

**Masalah:** pengguna di browser UTC+8 mengetik 09:00, tersimpan 01:00Z,
Queue/Calendar/History (WIB) menampilkan 08:00. Pengguna WIB tidak terdampak.

**Usulan:** input jadwal ditafsirkan sebagai WIB. Tambah
`wibLocalToUtc(date, time)` di `wib-time.ts`; validasi "waktu di masa depan"
dan constraint memakai WIB; label zona "WIB" di picker.

**Claude Design:** UI-related (aturan 10), flow picker terlihat user. Cek
Claude Design sebelum kode, atau minta konfirmasi King Rezi bahwa hanya
penafsiran waktu yang berubah, bukan tampilan.

- [x] **T-146.1** Konfirmasi King Rezi lewat AskUserQuestion: hanya penafsiran waktu yang berubah, tanpa label "WIB" baru dan tanpa perubahan Claude Design
- [x] **T-146.2** Helper `wibLocalToUtc` di `apps/web/src/domains/publishing/wib-time.ts`, dipakai di `draft-editor/Modal.tsx` untuk validasi masa depan dan `scheduledAt`; `schedule-time-constraints.ts` tidak berubah karena memakai instan `Date`
- [x] **T-146.3** 4 test baru di `wib-time.test.ts` (351 test domain publishing lulus, eslint dan tsc bersih)
- [x] **T-146.4** Verifikasi browser (oleh King Rezi) — OK 2026-10-23, atas pernyataan King Rezi

### T-147 · Zona waktu per pengguna (tampilan dan input mengikuti lokasi pengguna)

| Field         | Value                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| **Status**    | ⏳ Belum dimulai                                                                                               |
| **Domain**    | publishing · UI · DB                                                                                           |
| **ADR**       | butuh ADR baru (zona per pengguna vs per workspace belum diputuskan); belum dibuat                             |
| **Terkait**   | T-144, T-145, T-146                                                                                            |
| **Depends**   | T-146                                                                                                          |
| **Baca dulu** | `apps/web/src/domains/publishing/wib-time.ts` · `draft-editor/Modal.tsx` · kolom `occurred_at` (migrasi T-145) |

**Latar:** King Rezi ingin waktu mengikuti lokasi pengguna. Saat ini WIB tetap: T-144 (konstanta di `wib-time.ts`, dipakai server untuk kelompok tanggal History/Queue dan rentang Calendar), T-145 (kolom `occurred_at` di DB), T-146 (input jadwal ditafsirkan WIB).

**Catatan:**

- Butuh ADR baru: zona per pengguna atau per workspace belum diputuskan. Jangan tulis ADR sebelum King Rezi memutuskan.
- Setelan zona harus tersimpan (DB), karena server tidak tahu zona browser.
- UI setelan zona UI/UX-related: cek Claude Design dulu sebelum kode (aturan 10).

- [ ] **T-147.1** Keputusan King Rezi (pengguna vs workspace) + ADR
- [ ] **T-147.2** Desain: cek/buat rancangan UI setelan zona di Claude Design
- [ ] **T-147.3** Model/setelan zona tersimpan (Prisma + migrasi)
- [ ] **T-147.4** Refactor `wib-time` menjadi zona dinamis (tampilan, input, kelompok tanggal, rentang Calendar)
- [ ] **T-147.5** Cek dampak `occurred_at` (kolom generated terkait zona atau tidak)
- [ ] **T-147.6** Test
- [ ] **T-147.7** Verifikasi King Rezi

---

## Dari Known Issue

Tiket yang lahir sebagai pelacak Known Issue ada di [`known-issues.md`](known-issues.md) (ADR-134); daftar lengkapnya hanya di file itu, tidak disalin ke sini.

---

## Catatan Rilis

- Ruang kosong v0.2 sebelumnya mencakup T-039, tapi nomor itu sudah dipakai untuk **T-039** (Migrasi Routing & Settings, ADR-076) di `tickets/v01-foundation.md`, bukan task v0.2 — lihat Catatan Rilis file tersebut. Tidak ada lagi ruang kosong tersisa untuk task v0.2 baru; task v0.2 berikutnya memakai nomor global berikutnya yang belum pernah dipakai (cek nomor berikutnya di `AVAILABLE_TICKETS.md`).
- **T-090** dan **T-091** (ditambah 2026-08-28, sesi diskusi ADR-093) memakai pola yang sama seperti footnote di atas — nomor kosong v0.2 (T-020–T-038) sudah habis, jadi keduanya memakai nomor global berikutnya yang belum pernah dipakai (090, 091), sama seperti presedan **T-039**/**T-089** di `tickets/v01-foundation.md`. Ditempatkan di file ini (bukan file release lain) karena keduanya domain `publishing`, lahir dari diskusi Calendar/T-033.
- **T-092** (ditambah 2026-08-28, sesi diskusi ADR-094) memakai pola nomor global yang sama lagi — berikutnya setelah T-091.
- **T-104** (ditambah 2026-09-11, gap ditemukan saat implementasi T-092.5) memakai ID global berikutnya yang belum pernah dipakai (terakhir T-103, di `tickets/v07-astryx-shadcn-migration.md`) — ditempatkan di file ini karena domain `publishing`, terkait langsung T-092.
- **T-106** (ditambah 2026-09-25, permintaan King Rezi setelah T-025) memakai ID global berikutnya setelah T-105 — ditempatkan di file ini karena domain `integration`, kelanjutan T-025/ADR-059.
- **T-107**/**T-108** (ditambah 2026-09-28, promosi dari Known Issues KI-049/KI-063/KI-044 setelah audit aplikasi menyeluruh atas permintaan King Rezi) memakai ID global berikutnya setelah T-106 — ditempatkan di file ini karena domain `publishing`.
- **T-111** (ditambah 2026-10-06, promosi KI-083, follow-up King Rezi atas hasil KI-082) memakai ID global berikutnya setelah T-110 (`tickets/v01-foundation.md`) — ditempatkan di file ini karena subtask utamanya (T-111.1/.2, History Detail) domain `publishing`, meski T-111.3/.4 domain `engagement` (Post asal Engage, lokasi kedua gap yang sama).
- **Definition of Done rilis ini** (dari `release-roadmap.md`): pengguna dapat mengelola proses publikasi dari awal hingga selesai — draft → format per akun → schedule/publish → lihat queue/calendar → lihat hasil di history.
