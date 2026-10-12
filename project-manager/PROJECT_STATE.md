# PROJECT STATE

## Snapshot

* **Phase / Milestone:** Phase 6 — Implementation · M8 — Development (Sprint 5) · Overall: M7 100%, M8 in progress
* **Active Mode:** Ready for Development — implementasi fitur produk sesuai Architecture & Engineering Baseline
* **Top Next Tasks:** **T-112 ✅ Done (5/5 subtask, 2026-10-09)** — wiring `IOutstandAdapter.importPosts`/`fetchImportJobStatus` ke endpoint Outstand sungguhan (ADR-123), termasuk fix bug polling status async yang ditemukan saat verifikasi end-to-end — lihat `tasks/v02-publishing-mvp.md` § T-112. **T-090 ✅ Done (5/5 subtask, 2026-10-08)** — Import Posts dari Social Account (status `Imported`, read-only), ADR-093, tuntas penuh termasuk UI (T-090.5) + bug fix `getOutstandAdapter`/`toActionError`. **T-111 ✅ Done (8/8 subtask, 2026-10-07)** — restrukturisasi layout preview media post asli di History Detail & Post asal Engage, menutup KI-082/KI-083 sepenuhnya. **KI-084 ✅ Resolved (2026-10-08)** dan **KI-085 ✅ Resolved (2026-10-07)** — lihat **Completed (Ringkasan)** di bawah. Fokus aktif selanjutnya: **T-037 Perkaya aturan coding** (kontinu by design, 🟡 In Progress) — salinan ID dari **Fokus sekarang** di [`TASKS.md`](TASKS.md), satu-satunya daftar fokus. Rilis terakhir tuntas: **v0.4 Engagement MVP 6/7 task** (2026-10-06, sisa T-055 Could Have tidak blocking) dan **v0.3 Analytics MVP 8/8 task** (2026-09-21). Riwayat detail per task: lihat **Completed (Ringkasan)** di bawah / `COMPLETE_TASK.md`.
* **Blocker:** 1 blocker aktif (env var Google OAuth belum diisi, KI-015) — lihat section **Blockers** di bawah. Blocker Outstand (KI-003, `OUTSTAND_API_KEY` + Real OutstandAdapter) sudah **Resolved (2026-09-24)**. Railway staging sudah live & terverifikasi (2026-08-14); JOB_SECRET juga sudah diisi di Railway staging. Tidak memblokir M8.
* **Backlog task lengkap:** [`TASKS.md`](TASKS.md) — 91 task per release (v0.1 → v1.0, + v0.7 migrasi Astryx→shadcn/ui, ADR-097), detail di `tasks/`. Jangan cari detail task di file ini.
* **KI-073–080 Resolved (2026-09-26)** — 4 bug publish Instagram (caption wajib untuk Story, Story publish tanpa media, upload media >1MB gagal, avatar akun tidak tampil di sidebar) diperbaiki + diverifikasi live ke akun Instagram/Facebook real (ADR-120). 2 bug turunan ditemukan saat verifikasi (akun `disconnected` tidak bisa reconnect; callback OAuth silent-success untuk conflict genuine) diperbaiki via **ADR-122**. Plus **KI-080** (baru+langsung Resolved) — Railway staging build gagal (`next.config.ts` tidak bisa resolve import workspace `@social/shared`) diperbaiki di branch terpisah sebelum masuk ke fix KI-078/079.
* Detail phase/mode/issue ada di section di bawah. Riwayat completed/ADR lengkap: lihat `COMPLETE_TASK.md` (⚠️ jangan dibaca AI kecuali diperintah)/`DECISIONS.md`.

---

## Metadata

| Field        | Value      |
| ------------ | ---------- |
| Version      | 1.1.1      |
| Status       | Active     |
| Last Updated | 2026-10-09 |

---

## Current Status

| Item              | Value                            |
| ----------------- | -------------------------------- |
| Current Phase     | Phase 6 — Implementation      |
| Current Milestone | M8 — Development               |
| Current Sprint    | Sprint 5                         |
| Overall Progress  | M7 100% · M8 in progress         |
| Project Status    | M8 berjalan — Publishing MVP (Real OutstandAdapter wajib; Fake jalur produksi dihapus, ADR-119) |

---

## Current Focus

M7 Repository & Bootstrap **selesai**. M8 Development **berjalan**.

* **AI Context layer** (`context/`) sudah di-scaffold (opsi A) — indeks + aturan operasional agent; bukan duplikasi baseline.
* `AGENTS.md` di root sudah ada; skill resmi vendor yang relevan (Prisma,
  Better Auth, Vercel, Supabase) sudah terpasang di `.claude/skills/` —
  satu-satunya lokasi skill sejak ADR-064 (`.agents/skills/` dihapus).
* Project dikerjakan di **dua tool**: Claude Code (utama) dan Cursor. Paritas
  aset agent + dua pasang file kembar yang wajib dijaga sinkron (config MCP,
  proteksi baca secret) didokumentasikan di section "Kompatibilitas tool"
  pada `AGENTS.md` (ADR-064).
* Integrasi Outstand runtime asli (ADR-040) sudah hidup lewat Real
  OutstandAdapter (T-025 ✅, KI-003 Resolved); Fake jalur produksi dihapus
  (T-106 ✅, ADR-119 — `OUTSTAND_API_KEY` wajib). Migrasi UI
  Astryx→shadcn/ui (ADR-097, rilis v0.7) sudah tuntas 100% — riwayat lengkap
  di `COMPLETE_TASK.md`, bukan di sini.
* **Perencanaan task** kini berjenjang per release di [`TASKS.md`](TASKS.md) +
  `tasks/` (ADR-062).

---

## Active Conversation Mode

Current Mode: Ready for Development

Current Phase: Phase 6 / M8 Development berjalan

Current Objective:
- Memulai implementasi fitur produk sesuai Architecture & Engineering Baseline
- Memakai `context/` + `AGENTS.md` sebagai pintu masuk agent saat coding

Allowed Actions:
- Discussion
- Brainstorm
- Documentation
- Feature Implementation (M8)
- Penyempurnaan AI Context (`context/`, `AGENTS.md`) bila perlu

Restricted Actions:
- Perubahan Architecture / Engineering Baseline tanpa ADR
- Wireframe Detail (kecuali dibutuhkan untuk implementasi layar)

---

## Milestone Progress

| Milestone                    | Status         |
| ---------------------------- | -------------- |
| M0 — Project Foundation      | ✅ Completed    |
| M1 — Discovery               | ✅ Completed    |
| M2 — Business Planning       | ✅ Completed    |
| M3 — Product Planning        | ✅ Completed    |
| M4 — UX Planning             | ✅ Completed    |
| M5 — System Architecture     | ✅ Completed    |
| M6 — Engineering Planning    | ✅ Completed    |
| M7 — Repository & Bootstrap  | ✅ Completed    |
| M8 — Development             | 🟡 In Progress  |
| M9 — Testing & Release       | ⏳ Pending      |

---

## In Progress

Task berstatus 🟡 dan subtask detail **hanya** ada di [`TASKS.md`](TASKS.md) +
`tasks/vXX-*.md` (ADR-062) — tidak diduplikasi di sini supaya tidak desync.

Catatan non-task (bukan task, jadi memang layak di sini): template
`design-tokens.md` berstatus Draft / TBD; nilai final berkembang iteratif
co-equal dengan Claude Design (ADR-056) — tidak ada lagi gerbang "designer
masuk", project ini tidak akan merekrut designer eksternal (ADR-057,
amandemen ADR-038 & ADR-041).

---

## Next Tasks

Daftar lengkap 72 task (v0.1 → v1.0) beserta subtask, dependency, rantai
blocker, catatan urutan rilis, dan keputusan terbuka yang menunggu King
Rezi — semuanya **hanya** di **[`TASKS.md`](TASKS.md)** (section **Fokus
sekarang** + **Keputusan terbuka**). Snapshot di atas sudah menyalin ID +
judul singkatnya. **Jangan menulis ulang daftar/detail task di sini**
(ADR-062) — daftar ketiga akan langsung desync.

---

## Known Issues

> **ID `KI-XXX`** (ADR-066, amandemen ADR-067) — global, tidak pernah didaur ulang. `Status`: `Open` / `Resolved` / `Sebagian Resolved — sisa scope: <ID>` / `Promoted to T-XXX`. `Sebagian Resolved` dipakai kalau sebagian besar gap sudah ditutup tapi ada 1 subtask/scope kecil yang eksplisit belum — sebutkan sisa scope-nya di string status. Terpisah dari namespace task (`T-XXX`) karena belum tentu jadi task formal. **Entry `Resolved` yang sudah tercatat di `COMPLETE_TASK.md` dihapus dari daftar ini** (bukan dibiarkan dengan status `Resolved`) — riwayatnya tetap ada di `COMPLETE_TASK.md`, ID-nya tidak didaur ulang untuk entry baru.

### KI-001 · Transactional Email Provider belum ditetapkan

| Field | Value |
|-------|-------|
| Status | Open |
| Kategori | Dependency |
| Terkait | T-005 |

Password reset & email verification (Better Auth) membutuhkan email provider yang belum ditetapkan (kandidat: Resend, Postmark, AWS SES, SMTP Supabase). Dicatat di `auth-strategy.md` (AS-D04). `requireEmailVerification` dinonaktifkan sementara di skeleton. Tidak memblokir M8 awal.

### KI-014 · Domain `identity` belum punya unit test

| Field | Value |
|-------|-------|
| Status | Open |
| Kategori | Tech-Debt |
| Terkait | T-016 |

`IdentityService`, `IIdentityRepository`, dan `SupabaseAvatarStorageAdapter` (domain `identity`, diisi pertama kali lewat T-016.2) belum punya unit test Vitest. Review arsitektur Ridwan sudah memverifikasi boundary domain bersih (tidak ada pelanggaran), tetapi coverage test-nya nihil. Tidak memblokir penutupan T-016.1/.2/.3/.5 — keempatnya sudah lolos QA browser end-to-end.

### KI-015 · Env var `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` belum diisi

| Field | Value |
|-------|-------|
| Status | Sebagian Resolved — sisa scope: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` |
| Kategori | Dependency |
| Terkait | T-025, T-026 |

Sama seperti `OUTSTAND_API_KEY` (KI-003, Resolved 2026-09-24 — lihat `COMPLETE_TASK.md`):

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — kode Google OAuth di `auth.ts` sudah siap (`socialProviders.google` terdaftar kondisional lewat `env.ts`), tapi tanpa env ini "Sign in with Google" tidak aktif. Masih placeholder dummy.
- `JOB_SECRET` — **resolved 2026-08-14**: sudah diisi nilai asli generated di Railway staging (env var), dan job runner (T-027, `POST /api/jobs/run` via Railway Cron `X-Job-Secret`) sudah terverifikasi end-to-end 2x run berturut-turut SUCCESS di staging. Local `.env.local` masih boleh memakai nilai dummy untuk dev.

### KI-024 · Header sidebar Settings belum sesuai spec Design System (back-button vs judul)

| Field | Value |
|-------|-------|
| Status | Open |
| Kategori | Tech-Debt |
| Terkait | T-039.5, ADR-077 |

Ditemukan 2026-08-11 saat memperbaiki header `WorkspaceSideNav.tsx` agar
sesuai Design System (lihat `COMPLETE_TASK.md`). `SettingsSideNav.tsx`
(dibuat via T-039.5/ADR-077) merender `SideNavHeading` dengan back-icon +
judul "Settings" sebagai **satu link utuh**, sedangkan spec desain
(`.settings-sidebar-header` di `styles.css` Claude Design, baris ~316-319)
memisahkan back-button (kotak ikon 28px, klik-able sendiri) dari judul
"Settings" (teks statis, font `--text-body-size`, lebih kecil dari default
`SideNavHeading` yang pakai `--text-large-size`). Belum diperbaiki — dicatat
sebagai temuan untuk follow-up King Rezi, belum dibuatkan task formal.

### KI-027 · Selector target Admin di dialog Transfer Ownership (T-008) belum dikonfirmasi ke desain

| Field | Value |
|-------|-------|
| Status | Open |
| Kategori | Process |
| Terkait | T-008 |

Mockup `templates/settings-general.html` di Claude Design tidak menunjukkan cara memilih Admin target sebelum dialog Transfer Ownership dibuka. Mark UI Engineer menambahkan komponen `Selector` Admin aktif sebagai keputusan implementasi sendiri (bukan sesuai desain final yang disetujui King Rezi) supaya alur tetap bisa dipakai. Perlu konfirmasi/update balik ke Claude Design dari King Rezi — T-008 sengaja belum ditutup `✅ Done` sampai ini selesai (lihat `tasks/v01-foundation.md` § T-008).

### KI-028 · Production Railway environment & Supabase project belum dibuat

| Field | Value |
|-------|-------|
| Status | Open |
| Kategori | Dependency |
| Terkait | T-027, seluruh CI/CD deploy step (ADR-028, ADR-029, ADR-032) |

Ditemukan saat menutup KI-025 (2026-08-14): staging environment (Railway +
Supabase) sudah live & terverifikasi, tapi **production** belum ada sama
sekali — belum ada project/environment Railway `production`, dan belum
ada project Supabase terpisah untuk production (staging permanen memakai
project Supabase existing "Sosial Media Management",
ref `ndcrkzqgqukqfmekgoze` — dikonfirmasi permanen via ADR-081, amandemen
EM-D02; lihat catatan di `COMPLETE_TASK.md` 2026-08-14). Baseline
`deployment-infrastructure.md`, `environment-topology`
(ADR-029), region Singapore (ADR-028), dan CI/CD pipeline (ADR-032) untuk
jalur production masih rencana, belum ada realisasi. Tidak memblokir M8,
tapi wajib dituntaskan sebelum rilis production.

### KI-032 · Publish Now dari Queue belum auto-advance ke Confirmation Summary

| Field | Value |
|-------|-------|
| Status | Open |
| Kategori | Tech-Debt |
| Terkait | T-032 (§ T-032.4, `tasks/v02-publishing-mvp.md`) |

Ditemukan 2026-08-20 saat wiring tombol "Publish Now" di Queue (T-032.4): tombol ini reuse modal Draft Editor via `openEditDraft` dengan `initialPendingAction: "publish-now"` supaya modal auto-advance ke step Confirmation Summary begitu draft ready — tapi `getDraftAction` **belum preload target akun** yang sudah dijadwalkan, sehingga `isReadyToPublishNow` sering `false` saat dibuka dari Queue. Efeknya: modal jatuh ke form biasa (bukan langsung ke Confirmation Summary) — bukan bug fungsional (Publish Now tetap bisa dilakukan lewat form), murni gap UX auto-advance. Sengaja dibiarkan (di luar scope T-032.4) — perlu subtask terpisah nanti (preload target akun untuk Edit Draft) kalau UX ini mau disempurnakan. Tidak memblokir M8.

### KI-033 · 2 workspace test tersisa dari QA T-089 belum dibersihkan

| Field | Value |
|-------|-------|
| Status | Open |
| Kategori | Data Hygiene |
| Terkait | T-089 (`tasks/v01-foundation.md` § T-089) |

Ditemukan saat QA Najwa untuk T-089.2–.4 (2026-08-24): 2 workspace test
tersisa di database — **"Najwa QA Test Workspace"** (sengaja dibuat untuk
menguji `createWorkspaceAction`) dan **"QA Queue Test"** (sisa sesi QA
sebelumnya, bukan dari sesi T-089). Bukan bug — keduanya sengaja tidak
dihapus oleh Najwa karena hapus workspace bersifat ireversibel dan di luar
wewenang eksekusi otonom QA. Perlu dibersihkan manual oleh King Rezi via
Settings → General → Danger Zone kalau perlu. Tidak memblokir M8.

### KI-036 · Dashboard (`app/(app)/page.tsx`) fetch data lewat Server Action, menyimpang RS-D02

| Field | Value |
|-------|-------|
| Status | Open |
| Kategori | Tech-Debt |
| Terkait | ADR-095, T-094 |

Ditemukan saat penulisan `rendering-strategy.md` (ADR-095, 2026-08-28): `app/(app)/page.tsx` (dashboard) mengambil data lewat Server Action (`getDashboardSummaryAction`) untuk pure read — seharusnya memanggil Application Service langsung dari Server Component (composition root), seperti pola yang sudah benar di `app/(app)/publish/calendar/page.tsx` (sesuai AGENTS.md rule 5 dan RS-D02 di `rendering-strategy.md`). ADR-095 secara eksplisit **tidak** memperbaiki ini sebagai bagian ADR — dicatat sebagai exception pra-existing, cleanup terpisah di **T-094.4** (`tasks/v01-foundation.md`). Tidak urgent, tidak memblokir M8.

**Update (2026-08-28) — 2 exception tambahan ditemukan review arsitektur Ridwan** (sesi yang sama, setelah ADR-095/T-094 dicatat, belum masuk subtask formal manapun — technical debt yang perlu di-follow-up terpisah dari T-094.4 di atas):
1. **RS-D03** — `app/(app)/settings/account/preferences/page.tsx` punya `"use client"` di baris pertama, membuat seluruh page jadi Client Component (seharusnya Server Component dengan `"use client"` hanya di leaf yang butuh interactivity).
2. **CC-D02** — `draft-editor/actions.ts` (6 fungsi) tidak punya `try/catch`/`toActionError()` sama sekali; `settings/account/actions.ts` dan `onboarding/components/actions.ts` masih pakai pola `instanceof` manual sendiri, bukan `toActionError()`.

### KI-037 · `design-tokens.md` section Spacing (ADR-095) belum disinkronkan ke Claude Design

| Field | Value |
|-------|-------|
| Status | Open |
| Kategori | Process |
| Terkait | ADR-095, ADR-056 |

Section Spacing di `design-tokens.md` baru dikunci (base 1 unit = 4px, skala 0/0.5/1/1.5/2/3/4/5/6/8 = 0–32px, menggantikan `TBD` sejak ADR-038) lewat ADR-095. Mengikuti pola reminder ADR-056 (dokumen ini co-equal dengan Claude Design, perubahan salah satu wajib disinkronkan ke yang lain), sinkronisasi ke Claude Design belum dilakukan di sesi ADR-095 — perlu langkah lanjutan terpisah. Tidak memblokir M8.

### KI-043 · `clearUnsavedNewPost()` tidak dipanggil di jalur Schedule/Publish Now

| Field | Value |
|-------|-------|
| Status | Open |
| Kategori | Bug |
| Terkait | T-100 |

Ditemukan QA Najwa QA Engineer saat verifikasi T-100.2 (2026-09-03,
`apps/web/src/app/(app)/components/draft-editor/Modal.tsx`) — bukan
regresi T-100.2, sudah ada sejak versi lama file (diverifikasi via
`git log -p`), dan bukan blocker penutupan T-100.2.

`clearUnsavedNewPost()` hanya dipanggil di `handleSaveDraft`, tidak
dipanggil di `handleConfirmSchedule`/`handleConfirmPublishNow`. Akibatnya
localStorage "unsaved draft" tidak terhapus setelah Schedule/Publish Now
sukses (kalau user sempat trigger `persistUnsavedNewPost` sebelumnya) —
`ResumeDialog` bisa muncul lagi dengan caption basi di sesi New Post
berikutnya. Perlu ditindaklanjuti terpisah, di luar scope T-100 (dijadwal
kapan pun oleh King Rezi, tidak memblokir T-100.3/T-100.4).

### KI-044 · Tidak ada validasi mencegah Schedule ke waktu yang sudah lewat pada tanggal hari ini

| Field | Value |
|-------|-------|
| Status | Promoted to T-108 (2026-09-28) |
| Kategori | Bug |
| Terkait | T-100 |

Ditemukan QA Najwa QA Engineer saat verifikasi T-100.3 (2026-09-03,
`apps/web/src/app/(app)/components/draft-editor/Modal.tsx`) — bukan
regresi T-100.3, sudah ada sejak sebelum migrasi (Astryx `TimeInput` lama
juga tidak punya validasi ini), dan bukan blocker penutupan T-100.3.

Tidak ada validasi yang mencegah user men-Schedule post ke waktu yang
sudah lewat pada tanggal hari ini (mis. jadwalkan jam 08:00 padahal
sekarang sudah jam 11:48) — post berhasil masuk Queue tanpa
penolakan/warning apa pun. Perlu ditindaklanjuti terpisah, di luar scope
T-100 (dijadwal kapan pun oleh King Rezi, tidak memblokir T-100.4).

### KI-046 · `MemberStatus.Pending` tidak pernah di-assign di flow produksi manapun

| Field | Value |
|-------|-------|
| Status | Promoted to T-007.7 (2026-09-07, ADR-100) |
| Kategori | Tech-Debt / Gap |
| Terkait | T-007.7, ADR-080, ADR-100 |

Ditemukan Najwa QA Engineer saat QA badge "Pending" `MembersTable.tsx`
(bagian penutupan KI-041, ADR-098, 2026-09-04): `MemberStatus.Pending` (di
Prisma schema / `@social/shared`) ternyata tidak pernah di-assign di kode
produksi manapun — flow invite saat ini (accept invitation) selalu langsung
membuat member berstatus **Active**. Akibatnya badge "Pending" adalah dead
code secara fungsional — tidak bisa dicapai lewat alur user manapun saat
ini, hanya dipakai di unit test.

**Resolved (2026-09-07, ADR-100):** King Rezi memutuskan status ini bukan
dead code — direservasi untuk metode invite **"Kirim via Email"** (T-007.7,
masih blocked T-005). Desain alurnya sudah dikunci di ADR-100: baris
`workspace_members` dibuat langsung `Pending` saat invite dikirim via
email, lalu diupdate jadi `Active` saat user accept. Implementasi konkret
menunggu T-005 selesai — dipindah jadi bagian scope resmi **T-007.7**,
bukan lagi Known Issue berdiri sendiri.

### KI-053 · Invite via Copy Link — email tidak diverifikasi kepemilikan inbox, rawan identity takeover

| Field | Value |
|-------|-------|
| Status | Promoted to T-110 (2026-09-28) |
| Kategori | Security / Bug |
| Terkait | T-007.1, T-093, KI-001, ADR-080, ADR-096 |

Ditemukan King Rezi saat diskusi (2026-09-07): kalau invite lewat **Copy
Link** ditujukan ke email A tapi link-nya (sengaja atau tidak) terbuka oleh
email B, dan **email A belum pernah punya akun** (`isExistingUser: false`),
email B bisa langsung mengisi Nama + Password **pilihannya sendiri** di
form `/invite/[token]` ([AcceptInviteForm.tsx](../apps/web/src/app/(auth)/invite/[token]/components/AcceptInviteForm.tsx))
dan submit — form memang mengunci field email jadi read-only ke email A
(`AcceptInviteForm.tsx:127-128`), tapi ini cuma memastikan **string email**
yang dikirim ke `authClient.signUp.email()` sama dengan email A, **bukan**
membuktikan email B benar-benar memegang inbox email A.

Root cause: `requireEmailVerification: false` di Better Auth
([auth.ts:53](../apps/web/src/lib/better-auth/auth.ts:53), bagian dari
**KI-001** — provider email belum ditetapkan) — Better Auth tidak pernah
mengirim email konfirmasi untuk verifikasi kepemilikan inbox saat sign-up.
Guard `actorEmail === invitation.email` di
`WorkspaceService.acceptInvite` ([workspace.service.ts:615](../apps/web/src/domains/workspace/services/workspace.service.ts:615))
sudah benar secara logic (mencegah user lain yang sudah login pakai akun
berbeda ikut menerima invite ini), tapi tidak bisa mencegah skenario ini
karena sign-up baru sama sekali belum pernah diverifikasi oleh siapa pun.

**Dampak:** email B efektif membajak identitas "email A" — akun baru
dengan email A dan password buatan B berhasil dibuat, B langsung jadi
member workspace atas nama A. Kalau pemilik asli email A kemudian mencoba
daftar, Better Auth akan menolak ("email sudah terdaftar") — pemilik asli
terkunci keluar dari identitasnya sendiri.

**Catatan lingkup:** kalau email A **sudah punya akun** (`isExistingUser:
true`), skenario ini **aman** — email B harus tahu password akun A untuk
bisa sign-in, jadi tidak bisa dieksploitasi tanpa itu. Gap ini spesifik ke
kasus akun baru (belum pernah daftar).

Belum ada keputusan mitigasi (opsi yang mungkin: tunda Copy Link sampai
T-005/email verification selesai, atau tambahkan verifikasi email terpisah
khusus alur accept-invite). Tidak memblokir M8 saat ini, tapi risiko
keamanan nyata untuk Copy Link yang sudah dipakai di production.

### KI-049 · `PublishingPost.failedAt`/`.failureReason` tidak pernah ditulis oleh jalur manapun

| Field | Value |
|-------|-------|
| Status | Promoted to T-107 (2026-09-28) |
| Kategori | Tech-Debt |
| Terkait | T-034, T-029 |

Ditemukan Ridwan Architecture Reviewer saat review T-034.1 (2026-09-08):
kolom `failedAt`/`failureReason` di model Prisma `PublishingPost` ada di
schema tapi tidak pernah ditulis oleh jalur manapun — `markPostFailed`
(dipakai `PublishNowUseCase`, lihat T-029) hanya meng-update kolom
`status`. Gap ini sudah didokumentasikan sebagai komentar kode di
`IPublishingRepository.listHistory` (`apps/web/src/domains/publishing/repositories/publishing.repository.ts`)
dan sengaja **tidak** dimasukkan ke `HistoryItemRecord` supaya tidak
menyesatkan UI History (T-034.2/T-034.3) dengan field yang selalu `null`
— pesan error final per akun tetap tersedia lewat
`HistoryItemTargetRecord.error` (diisi `updateTargetOutcome`, sumber data
yang benar-benar terisi). Non-blocking untuk T-034; direkomendasikan Ridwan
sebagai catatan follow-up eksplisit ke depan (belum ada task formal),
bukan urgent. Tidak memblokir M8.

### KI-050 · Meta "dibuat oleh siapa" dihilangkan dari halaman detail post History

| Field | Value |
|-------|-------|
| Status | Open |
| Kategori | Design Gap / Gap |
| Terkait | T-034 |

Ditemukan saat implementasi T-034.3 (2026-09-08, halaman detail
`/publish/history/[postId]`): meta "dibuat oleh siapa" sengaja dihilangkan
dari desain awal Claude Design — `HistoryItemRecord` tidak membawa data
author/`authorId`, dan menambah field itu di luar scope T-034.2/T-034.3.
Perlu keputusan King Rezi ke depan apakah field ini memang wajib
ditampilkan (kalau ya, jadi task/gap terpisah, mirip pola KI-049 —
kemungkinan butuh field baru di schema/domain). Tidak memblokir M8.

### KI-052 · Hydration warning `formatRelativeTime` di `HistoryList.tsx`

| Field | Value |
|-------|-------|
| Status | Open |
| Kategori | Tech-Debt / UI |
| Terkait | T-034 |

Ditemukan Najwa QA Engineer saat verifikasi browser T-034.4 (2026-09-09,
retry manual publishing): muncul hydration warning React terkait
`formatRelativeTime` di `apps/web/src/app/(app)/publish/history/components/HistoryList.tsx`
— kemungkinan mismatch hasil format waktu relatif antara render SSR dan
client (nilai waktu relatif bisa berbeda tipis tergantung kapan masing-masing
sisi dieksekusi). Non-blocking, di luar scope T-034.4 (fitur retry sendiri
berfungsi penuh, PASS semua skenario) — dicatat sebagai follow-up teknis,
belum ada task formal. Tidak memblokir M8.

### KI-058 · `ConnectedAccountsList.tsx` tidak menyembunyikan aksi Connect/Disconnect/Reconnect untuk role Creator

| Field | Value |
|-------|-------|
| Status | Promoted to T-109 (2026-09-28) |
| Kategori | Design Gap / RBAC UI |
| Terkait | T-014, T-015 |

Ditemukan Najwa QA Engineer saat verifikasi end-to-end T-015 (2026-09-11):
UI Connected Accounts settings (`ConnectedAccountsList.tsx`) tidak
menyembunyikan/menonaktifkan tombol Connect/Disconnect/Reconnect untuk role
**Creator** — RBAC di server sudah solid (`WorkspaceService` menolak dengan
benar, tidak ada mutasi tidak sah yang berhasil), tapi gap-nya murni di
UI/UX: Creator baru tahu aksinya ditolak setelah klik dan mendapat toast
error, bukan tombol yang hilang/disabled dari awal seperti pola RBAC UI di
halaman lain (Members, General Settings).

Gap ini sudah ada sejak **T-014** (Disconnect account), bukan regresi baru
dari sesi T-015 — baru ketahuan sekarang karena QA menyentuh area ini lagi
saat verifikasi Reconnect. King Rezi eksplisit memutuskan (`AskUserQuestion`)
ini dicatat sebagai Known Issue baru, **tidak diperbaiki di sesi T-015**.

### KI-059 · `triggerPeriodicForAccounts` (Import Posts periodik) butuh `actingUserId` yang belum ada sumbernya

| Field | Value |
|-------|-------|
| Status | Open |
| Kategori | Tech-Debt / Gap Produk |
| Terkait | T-090 (T-090.3) |

Ditemukan Elon Backend Engineer saat implementasi T-090.3 (2026-10-08,
`JOB-05 — Import Posts Trigger`): entry point periodik
(`ImportPostsTriggerUseCase.triggerPeriodicForAccounts`, dipanggil Railway
Cron harian) butuh `actingUserId` per akun untuk RBAC/audit trail, tapi
trigger cron tidak punya sesi user untuk di-resolve — berbeda dari entry
point otomatis (on-connect, actor = user yang connect) dan manual (actor =
user yang klik "Sync Now"). Didokumentasikan sebagai gap di docstring kode,
**bukan** diselesaikan — kandidat resolusi (mis. Account Owner workspace)
belum jadi keputusan produk final, menunggu King Rezi. Tidak memblokir
T-090.1–T-090.4 (sudah selesai); jalur periodik butuh keputusan ini sebelum
dipakai di environment nyata.

### KI-060 · Account Selector tidak ter-restore saat reopen edit draft

| Field | Value |
|-------|-------|
| Status | Open |
| Kategori | Bug — Draft Editor |
| Terkait | Draft Editor (`Modal.tsx`), ditemukan saat verifikasi manual browser T-024 (media upload) |

Ditemukan saat verifikasi manual end-to-end T-024 (2026-09-15, murni sesi
verifikasi, bukan implementasi — riwayat lengkap verifikasi ini dulu
tercatat sebagai KI-059, sudah Resolved dan diarsipkan di
`COMPLETE_TASK.md`): saat draft dibuka ulang untuk diedit,
**seluruh checkbox Account Selector kembali unchecked** meski draft
tersebut punya target akun tersimpan — caption dan media ter-restore
dengan benar, akun tidak. Root cause: efek `getDraftAction` di `Modal.tsx`
(baris ~296-314) hanya men-set `caption`/`status`/`mediaItems` dari draft
yang dimuat, tidak pernah men-set `selectedAccountIds`/`formatByAccount`.

Gap ini **bukan regresi T-024** — T-024 hanya menyentuh state `mediaItems`,
tidak menyentuh logic restore Account Selector, dan gap ini kemungkinan
sudah ada sejak awal implementasi Draft Editor. Dicatat sebagai Known Issue
baru, belum diperbaiki (di luar scope permintaan verifikasi T-024 di atas).

### KI-061 · Tidak ada warning UI saat media over-limit setelah ganti target akun/format

| Field | Value |
|-------|-------|
| Status | Open |
| Kategori | UX Gap — Draft Editor (ADR-107) |
| Terkait | Draft Editor (`Modal.tsx`), batas media per `ContentFormat` (ADR-107) |

Ditemukan lewat diskusi King Rezi (2026-09-15, murni analisis kode, bukan
implementasi): kalau user upload media dulu (mis. 5 gambar untuk format
`Post`, batas 10 — aman), lalu menambah akun target dengan format yang
lebih ketat (mis. Pinterest/`Pin`, batas 1 media), batas efektif otomatis
turun jadi 1 (`maxMediaCountForFormats`, ADR-107) — tapi **tidak ada
indikasi visual apa pun** bahwa 5 media yang sudah ada sekarang melebihi
batas dan harus dihapus. Yang terjadi hanya: teks "Maks. X media" di bawah
dropzone berubah angka (pasif), dan dropzone di-disable untuk upload baru
— tidak ada highlight/badge/pesan pada thumbnail yang sudah kelebihan.
User baru tahu ada masalah setelah klik Save as Draft/Schedule/Publish Now
dan mendapat error dari server (`assertMediaCountWithinLimit`, ADR-107):
*"Jumlah media (5) melebihi batas maksimum 1 untuk format yang sedang
dipilih."*

Root cause: tidak ada efek/watcher di `Modal.tsx` yang membandingkan
`mediaItems.length` terhadap `effectiveMaxMedia` setiap kali
`selectedAccountIds`/`formatByAccount` berubah (`toggleAccount`, baris
~420-430) — validasi hanya jalan di titik upload (`handleFilesSelected`)
dan di server saat submit. Dicatat sebagai Known Issue baru, belum
diperbaiki (perlu cek Claude Design dulu sebelum implementasi UI apa pun,
rule 17 AGENTS.md).

### KI-063 · `PublishingPost.publishedAt` tidak pernah diisi oleh `markPostPublished`/`markPostFailed`

| Field | Value |
|-------|-------|
| Status | Promoted to T-107 (2026-09-28) |
| Kategori | Tech-Debt |
| Terkait | T-027, ADR-109, KI-049 (gap serupa di `failedAt`/`failureReason`) |

Ditemukan Najwa QA Engineer saat verifikasi T-027 (2026-09-17): kolom
`PublishingPost.publishedAt` ada di schema tapi tidak pernah ditulis oleh
`markPostPublished` (ADR-109, baru) maupun `markPostFailed` (pola lama,
sudah ada sejak sebelum T-027, bukan regresi baru). UI sudah punya fallback
(`item.publishedAt ?? item.updatedAt`) sehingga tidak berdampak visual,
tapi data historis `publishedAt` di DB tetap kosong untuk seluruh post yang
sudah tayang. Non-blocking, gap serupa pola **KI-049**
(`failedAt`/`failureReason` juga tidak pernah ditulis). Tidak memblokir M8.

### KI-086 · Reconnect akun Facebook `disconnected`/`reconnect-required` adalah dead flow — tidak ada jalur apa pun yang mengaktifkannya kembali

| Field | Value |
|-------|-------|
| Status | Open |
| Kategori | Bug — Connected Accounts / Facebook Pages |
| Terkait | ADR-115 poin 8 (Facebook Pages multi-select), ADR-122 (Reconnect `disconnected` untuk platform non-Facebook, menutup KI-078/KI-079) |

Ditemukan King Rezi (2026-10-08) saat menanyakan cara reconnect akun
Facebook yang sudah disconnected — dikonfirmasi lewat pembacaan kode
langsung (bukan asumsi) bahwa ini **genuinely dead flow**, bukan cuma UI
yang kurang nyaman:

1. **UI** — `ConnectedAccountAction` di `ConnectedAccountsList.tsx`
   (~baris 253-257) sengaja menyembunyikan tombol "Reconnect" total untuk
   `account.platform === SocialPlatform.Facebook` pada status
   `reconnect-required`/`disconnected`, dengan komentar eksplisit
   "Facebook Pages reconnect multi-page belum punya UPDATE path — sembunyikan
   tombol supaya tidak silent 0-page 'sukses' toast".
2. **Backend** — bahkan kalau user coba lewat jalur "Connect Account" biasa
   (pilih ulang Page yang sama), `WorkspaceRepository.createConnectedAccounts`
   (jamak, khusus Facebook, `workspace.repository.ts` ~baris 933-962)
   mencocokkan row existing HANYA berdasarkan `outstandAccountId` — tidak
   mengecek `status`/`reconnectRequired` sama sekali:
   ```
   const existing = await tx.workspaceConnectedAccount.findMany({
     where: { workspaceId, outstandAccountId: { in: [...] } },
     select: { outstandAccountId: true },   // status tidak dicek
   });
   ...
   if (existingIds.has(account.outstandAccountId)) continue; // skip diam-diam, status APAPUN
   ```
   Row yang `disconnected` diperlakukan identik dengan row yang sudah
   `active` — di-skip diam-diam, tanpa error, tanpa update. Tidak seperti
   `reconnectAccount` (tunggal, dipakai platform lain via ADR-122) yang
   memang didesain UPDATE row existing (reset `status`/`reconnectRequired`,
   pertahankan `connectedAt`), tidak ada padanan path reaktivasi untuk
   Facebook sama sekali.

**Kenapa belum diperbaiki sekarang:** ini bukan sekadar bug biasa — ADR-115
poin 8 eksplisit menyatakan "Reconnect Facebook Page tunggal DI LUAR SCOPE"
sebagai keputusan arsitektur yang disengaja. Memperbaikinya berarti
membalik keputusan ADR yang sudah ada (AGENTS.md rule 4: butuh ADR baru,
bukan patch diam-diam) dan kemungkinan juga menyentuh UI (menampilkan lagi
tombol Reconnect untuk Facebook, rule 17 AGENTS.md: perlu cek Claude Design
dulu). King Rezi diberi pilihan (perbaiki sekarang + ADR baru / backend saja
dulu / tunda sebagai Known Issue) dan memilih **tunda** — dicatat di sini
supaya tidak hilang, belum ada task/ADR yang dibuka untuk ini.

**Rencana perbaikan (kalau nanti dikerjakan, dicatat supaya tidak perlu
investigasi ulang):** di `createConnectedAccounts`, select juga `id` dan
`status` pada lookup existing; kalau `outstandAccountId` cocok tapi
`status !== "active"`, jalankan logika reaktivasi (set `status: "active"`,
`reconnectRequired: false`, refresh `outstandAccountId`/`handle`/`avatarUrl`)
pada row itu alih-alih `continue`-skip — hanya row yang SUDAH `active` yang
tetap di-skip. `WorkspaceService.confirmFacebookPagesConnection` sendiri
tidak perlu berubah (sudah delegasi penuh ke `createConnectedAccounts`).

---

### KI-084 · Sidebar mobile tidak konsisten dengan sidebar desktop ✅ Resolved (2026-10-08)

| Field | Value |
|-------|-------|
| Status | ✅ Resolved — diimplementasikan ke kode asli & diverifikasi di browser preview mobile (375px) |
| Kategori | UI Bug / Regresi |
| Terkait | KI-042 (Mobile Shell retrofit, ✅ Done 2026-10-07), KI-085 |

Ditemukan King Rezi (2026-10-07) setelah **KI-042** ditutup: hasil retrofit
hamburger+drawer di mobile tidak disamakan secara visual dengan sidebar
desktop. 3 gap konkret dari screenshot King Rezi:
1. Icon hamburger (buka sidebar) di mobile berbeda dari icon toggle
   buka/tutup sidebar di desktop — seharusnya sama.
2. Layout sidebar (struktur/spacing/komponen) berbeda antara mobile dan
   desktop — seharusnya identik, cuma beda trigger (drawer vs permanen).
3. Button "X" (tutup sidebar) di mobile berbeda dari desktop — seharusnya
   sama.

Sebelum fix: wajib cek Claude Design (project "Social Media Management")
apakah pola sidebar desktop sudah terkunci di sana sebagai acuan, sesuai
`AGENTS.md` rule 17 — baru lanjut implementasi (domain UI component →
Mark UI Engineer, ADR-063).

**Update (2026-10-07):** Icon buka/tutup sidebar mobile sudah disamakan
dengan desktop di 14 file Claude Design (component spec `navigation-mobile.html`
+ `styles.css` + 7 screen workspace + 7 screen settings), diverifikasi via
`get_file` setelah tiap push. Lihat **KI-085** untuk bug layout terpisah yang
ditemukan King Rezi saat verifikasi di App Prototype.

**Update (2026-10-08) — implementasi ke kode asli `apps/web`:**
1. [`MobileTopBar.tsx`](../apps/web/src/app/(app)/components/MobileTopBar.tsx) —
   icon trigger buka diganti dari `Menu01Icon` ke `SidebarLeftIcon`, sama
   persis dengan `SidebarTrigger` desktop di `sidebar.tsx`.
2. [`sidebar.tsx`](../apps/web/src/components/ui/sidebar.tsx) (`Sidebar`,
   cabang `isMobile`) — default close button `SheetContent`
   (`Cancel01Icon` dari `sheet.tsx` global) dimatikan via
   `showCloseButton={false}`; tiap sidebar konsumen menyediakan close
   affordance-nya sendiri di dalam header row (lihat poin 3).
3. Lebar drawer mobile (`SIDEBAR_WIDTH_MOBILE`) sudah `18rem` (288px),
   identik dengan `SIDEBAR_WIDTH` desktop di kode — konsisten secara
   internal (mobile = desktop). **Catatan:** ini BUKAN `260px` yang
   disebut sebagai nilai lock Claude Design di bullet riwayat 2026-10-07
   di atas — belum direkonsiliasi apakah `260px` itu cuma nilai CSS
   mockup statis Claude Design (bukan representasi literal lebar target
   `apps/web`) atau target asli yang belum terpenuhi di kode (berlaku
   juga untuk desktop, bukan regresi PR ini). Follow-up: konfirmasi ke
   King Rezi sebelum menutup gap ini sebagai non-issue.

**Perbaikan (2026-10-08, sesi sama) — close button menabrak "New Post":**
Percobaan pertama taruh close button sebagai elemen `absolute` baru di
`SheetContent` (`sidebar.tsx`) — King Rezi laporkan icon-nya tumpang
tindih dengan tombol "New Post" di bawah header (keduanya di area
y≈40-44px, terverifikasi via bounding-rect browser). Diperbaiki dengan
pendekatan berbeda — reuse elemen yang SUDAH ada di flex row header,
bukan absolute positioning baru:
- [`WorkspaceSideNav.tsx`](../apps/web/src/app/(app)/components/WorkspaceSideNav.tsx) —
  `SidebarTrigger` yang sudah ada di header (dulu `hidden md:flex`,
  hanya tampil desktop) sekarang SELALU ditampilkan (`shrink-0` saja).
  `toggleSidebar()` di baliknya sudah otomatis menutup drawer mobile
  (`setOpenMobile` toggle) — jadi tombol buka desktop & tombol tutup
  mobile adalah elemen yang SAMA PERSIS, tanpa kode baru.
- [`SettingsSideNav.tsx`](../apps/web/src/app/(app)/settings/components/SettingsSideNav.tsx) —
  sidebar ini sengaja tanpa `SidebarTrigger` di desktop (Keputusan #4,
  fixed-width/no-collapse), jadi ditambah tombol close baru khusus
  mobile (`md:hidden`) di header row yang sama dengan link "Settings",
  icon `SidebarLeftIcon` + `closeMobileSidebar()` yang sudah ada.

Diverifikasi ulang via browser preview emulasi mobile (375×812) di `/`
(Workspace drawer) dan `/settings` (Settings drawer): close button kini di
dalam alur flex header (bukan absolute), tidak overlap elemen apa pun,
drawer terbuka & tertutup normal; regresi desktop dicek juga (trigger
tetap di posisi semula). Menutup KI-084 sepenuhnya.

---

### KI-085 · App Prototype: layout sidebar mobile rusak saat viewport "Website" ✅ Resolved (2026-10-07)

| Field | Value |
|-------|-------|
| Status | ✅ Resolved — dikonfirmasi King Rezi di Claude Design |
| Kategori | UI Bug / Tooling (Claude Design App Prototype) |
| Terkait | KI-084, KI-042 |

Ditemukan King Rezi (screenshot) di App Prototype dengan viewport
**"Tampilan: Website"**: `.mobile-topbar` (hamburger+judul "Kopi Selasar")
tampil sebagai elemen kedua yang tidak seharusnya ada, berdampingan dengan
sidebar asli — baik saat drawer mobile terbuka (resize manual) **maupun**
di fresh load pada lebar desktop penuh (sidebar asli sudah tampil normal,
tapi topbar ikut nongol juga). Mode **"Tampilan: Mobile" (390px) selalu
normal** — bug spesifik di jalur "Website".

**Proses penyelesaian (3 percobaan, 2 gagal sebelum ketemu akar yang benar):**
1. ~~CSS `.app-shell{flex-direction:column}` → `display:block`~~ — dugaan
   soal komputasi flexbox bersarang, tidak menyelesaikan masalah (dites
   King Rezi: "masih ada").
2. ~~CSS `.app-shell:has(~ .mobile-nav-backdrop) .mobile-topbar{display:none}`~~
   — `:has()` tidak didukung di renderer App Prototype, tidak berefek.
3. ~~JS: sembunyikan `.mobile-topbar` di `openMobileNav()`/`closeMobileNav()`~~
   — tidak menjangkau kasus fresh-load (topbar nongol tanpa drawer pernah
   dibuka sama sekali, dikonfirmasi King Rezi).

**Fix final yang berhasil (`AppPrototype.dc.html`, method `inject()` —
dipanggil di SETIAP `onLoad` iframe, bukan cuma saat drawer dibuka):**
guard JS yang mengecek `getComputedStyle` sidebar asli (`.app-shell >
.sidebar`) di setiap load — kalau sidebar itu tampil (`display !== 'none'`),
`.mobile-topbar` dipaksa `display:none` lewat `style.display`, independen
dari cascade CSS manapun. **Dikonfirmasi King Rezi: sudah hilang.**

Pelajaran untuk sesi berikutnya: ketergantungan ke CSS murni (termasuk
`:has()`) tidak reliable di renderer App Prototype — pola yang terbukti
jalan adalah guard JS langsung di `inject()` yang jalan di setiap screen
load.

---

## Blockers

**Wajib dicek AI sebelum mengerjakan subtask apapun yang menyentuh area di
bawah.** Keduanya adalah dependency eksternal yang belum tersedia di
lingkungan lokal/CI — bukan bug kode. Kalau eksekusi subtask di area ini
gagal/crash, cek dulu apakah salah satu blocker ini penyebabnya sebelum
menyimpulkan ada bug dan mulai "memperbaiki" kode yang sebenarnya sudah
benar.

| ID         | Blocker                                                        | Menghambat                          |
| ---------- | --------------------------------------------------------------- | ------------------------------------ |
| **KI-015** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` belum diisi (JOB_SECRET sudah resolved 2026-08-14 di Railway staging) | Google OAuth sign-in |
| **—**      | Migration `20260922110000_t051_filter_active_status_engagement_sync_lookup` **belum di-deploy** (`bun run db:deploy` pending King Rezi) — bukan kredensial eksternal, murni menunggu eksekusi manual King Rezi | T-051 job `engagement.sync` (JOB-03) — sampai migration ter-apply, fungsi SQL yang dipakai job ini masih versi lama dan job **gagal untuk SEMUA akun** (bukan cuma akun yang disconnect) |
| **KI-025 (follow-up)** | Ditemukan 2026-10-02 saat King Rezi menguji Comments Inbox manual (komentar di post Instagram akun `turanilkerl`, workspace "Lunch" tidak pernah muncul di `/engage`): tabel `background_jobs` berisi job `engagement.sync` DAN `publishing.scheduled_post.resolve_outcome` yang macet — `attempts: 0`, `started_at: null` selama berminggu-minggu, walau Railway Cron staging pernah diverifikasi 2x run sukses saat penutupan KI-025 (2026-08-14). Perlu re-verifikasi apakah service `cron` staging masih sehat (JOB_SECRET masih cocok, service masih jalan, dll) — kemungkinan regresi infra setelah verifikasi awal, bukan berarti KI-025 asli (pembuatan project Railway) keliru ditutup. **Gap kode terpisah ditemukan di jalur yang sama:** `PublishNowUseCase` (`apps/web/src/domains/publishing/services/publish-now.use-case.ts`) tidak pernah enqueue job `RESOLVE_SCHEDULED_POST_OUTCOME_JOB_TYPE` saat `fetchPostOutcome` mengembalikan status `"pending"` — beda dari `SchedulePostsUseCase` yang sudah benar melakukan ini (`schedule-posts.use-case.ts:225`). Constructor `PublishNowUseCase` bahkan belum menerima `jobScheduler` sama sekali. Akibatnya: post yang dipublish lewat Publish Now dan outcome-nya belum instan dari Outstand bisa stuck `PublishingPostTarget.status = "pending"` permanen, membuat post itu tidak pernah dianggap "syncable" oleh `SyncCommentsUseCase` — komentarnya ada di Outstand (dikonfirmasi langsung lewat Outstand API) tapi tidak pernah ter-pull ke app. Rencana: digabung jadi satu scope PR follow-up (bukan dipisah) — (1) re-verifikasi/health-check Railway Cron staging, (2) ~~tambah fallback enqueue `resolve_outcome` job di `PublishNowUseCase` pola sama `SchedulePostsUseCase`~~ **✅ selesai 2026-10-05** (lihat `COMPLETE_TASK.md`), (3) backfill one-off untuk post yang sudah telanjur stuck `"pending"` saat ini. **Sisa terbuka: item (1) health-check Railway Cron staging dan item (3) backfill** — belum dikerjakan. | Comments Inbox (`/engage`) tidak menerima komentar baru untuk post yang dipublish lewat Publish Now; `PublishingPostTarget.status`/`platformPostUrl` bisa stuck `"pending"` permanen untuk post tersebut (post BARU setelah fix ini tidak lagi stuck — post LAMA yang sudah telanjur stuck masih butuh backfill item 3) |

**Resolved 2026-09-07:** KI-048 (3 migration Prisma T-026 belum `prisma
migrate deploy` ke DB dev/live) — King Rezi menjalankan `bun run
db:deploy`, migration terverifikasi ter-apply (Najwa QA Engineer cross-check
via Supabase MCP), retest end-to-end nyata 5 skenario webhook semua PASS.
**T-026 dan T-036 keduanya ditutup `✅ Done`**, lihat `COMPLETE_TASK.md`.

**Resolved 2026-08-14:** KI-025 (Railway belum pernah dibuat) — staging
sudah live & terverifikasi, lihat `COMPLETE_TASK.md`. Sisa gap production
dicatat terpisah sebagai **KI-028** (tidak memblokir M8/T-027 staging).

**Resolved 2026-08-24:** KI-034 (QA Najwa belum retest golden path switch
workspace dengan dialog konfirmasi Tier 2 baru, T-089.6/ADR-089) — QA
formal Najwa selesai, lolos penuh (unit test + full suite 157 passed/3
skipped/0 gagal + golden path browser end-to-end, tidak ada bug baru),
lihat `COMPLETE_TASK.md`.

**Resolved 2026-08-31:** KI-038 (T-093.4 verifikasi RBAC end-to-end 2-akun
browser nyata belum dilakukan) — Najwa QA Engineer menuntaskan verifikasi
dengan 3 akun real (Owner/Admin/Creator) di satu workspace, seluruh skenario
RBAC PASS; 1 bug ditemukan (Creator bisa mengakses `/settings/members` yang
seharusnya "Tidak ada akses") dan sudah diperbaiki + diverifikasi ulang
(commit `6fdf272`), lihat `COMPLETE_TASK.md`.

Detail masing-masing ada di section **Known Issues** di atas — tabel ini
hanya pointer supaya blocker aktif langsung terlihat tanpa harus menyisir
seluruh daftar Known Issues.

---

## Completed (Ringkasan)

* **Nama Produk Final "Postific" ✅ Done, ADR-124 (2026-10-09)** — King Rezi menetapkan nama produk final "Postific" (bukan lagi "Social Media Management (Working Title)"). Scope penuh: kode (package scope `@social/*` → `@postific/*` di `package.json` × 3 + ±150 import di `apps/web/src` + alias tsconfig/vitest/eslint, `bun.lock` regenerate, `typecheck`+`test` 649 pass) dan dokumentasi baseline (`README.md`, `AGENTS.md` judul, `PROJECT_OVERVIEW.md`, `ARCHITECTURE_OVERVIEW.md`, seluruh `product-discovery/**`) — hanya untuk pemakaian proper-noun, frasa kategori generik dibiarkan. Sengaja TIDAK diubah: badan ADR lama/`COMPLETE_TASK.md` (historical), referensi project Claude Design (masih literal "Social Media Management" di sistem eksternal), nama repo GitHub/Railway/folder lokal (resource eksternal, butuh aksi terpisah). Detail: `COMPLETE_TASK.md`.
* **T-112 ✅ TUNTAS 5/5 subtask — Wiring `importPosts`/`fetchImportJobStatus` Outstand sungguhan, ADR-123 (2026-10-09)** — T-112.1–T-112.4 (verifikasi wire-format OpenAPI + implementasi `RealOutstandAdapter`) sudah selesai sesi sebelumnya. T-112.5 (verifikasi end-to-end) sempat tertunda 3 sesi karena cooldown manual 24 jam + keterbatasan sandbox, lalu King Rezi menemukan bug baru saat akhirnya mencoba: "Sync Now" selalu gagal status `pending` karena `ImportPostsTriggerUseCase.runImportSync` hanya cek status sekali padahal job Outstand async. Elon Backend Engineer menambahkan `pollImportJobStatus` (polling 2 detik, timeout 25 detik, param `sleep` injeksi test) — review Ridwan bersih, 648 passed/6 skipped/0 failed. Verifikasi E2E akhirnya berhasil: akun Facebook "Cook It Real Good" menarik 16+ post asli berstatus `Imported` (caption+badge benar). Observasi non-blocking: thumbnail media di popover Imported belum render (`mediaUrls` sudah benar di backend) — terkait rancangan Claude Design yang masih `blocked`, bukan bug T-112. Detail lengkap: `tasks/v02-publishing-mvp.md` § T-112.
* **T-090 ✅ TUNTAS 5/5 subtask — Import Posts dari Social Account, ADR-093 (2026-10-08)** — Elon Backend Engineer (T-090.1–.4: enum `ContentStatus.Imported` + migration, kontrak ACL `IOutstandAdapter.importPosts`, `JOB-05`/`JOB-06` trigger+webhook) dan Mark UI Engineer (T-090.5: badge `Imported` variant `outline`, `CalendarPostPopover` read-only — link "Lihat di [Platform] →" menggantikan "Buka Draft Editor", `SyncNowButton` baru di Connected Accounts dengan RBAC hide-total untuk Creator; filter exclude `Imported` di Calendar dihapus). QA Najwa menemukan bug crash: `getOutstandAdapter()` tanpa `OUTSTAND_API_KEY` melempar `Error` polos (tidak tertangkap `toActionError`) — diperbaiki Elon jadi `ExternalServiceError` (dampak lintas-fitur, memperbaiki semua Server Action lain yang memanggil adapter ini). Review Ridwan: bersih. `typecheck`/`lint`/`test` PASS (638 passed/6 skipped/0 failed). **Gap diketahui:** verifikasi visual end-to-end tombol "Sync Now" di browser belum dituntaskan (butuh akses DB untuk fixture akun terhubung, ADR-119 menghapus jalur Fake connect) — bukan bug diketahui, hanya verifikasi tertunda, lihat `tasks/v02-publishing-mvp.md` § T-090. Detail lengkap: `decisions/DECISIONS.md` (ADR-093).
* **KI-062 + KI-064 ✅ Resolved (2026-10-08)** — koreksi 2 gap dokumentasi baseline arsitektur, non-blocking M8: **KI-062** baris formula backoff self-contradictory di `background-jobs.md` (menghasilkan 5/10/20 menit, tidak match tabel 5/15/60 yang sudah konsisten dengan kode `backoff.ts`) diganti penjelasan lookup table eksplisit; **KI-064** panah dependency `BC-03 Publishing → BC-06 Analytics` (via `PostMetricsPort`) yang hilang ditambahkan ke diagram § Peta Dependency Antar Domain `application-layer.md`. Kode tidak diubah di kedua gap — murni koreksi dokumentasi.
* **KI-084 ✅ Resolved (2026-10-08)** — implementasi fix icon sidebar mobile ke kode asli `apps/web` (lanjutan desain Claude Design 2026-10-07): `MobileTopBar.tsx` icon trigger diganti `Menu01Icon` → `SidebarLeftIcon`. Percobaan pertama (close button `absolute` baru di `sidebar.tsx`) ternyata menabrak tombol "New Post" — King Rezi laporkan dari screenshot — diperbaiki dengan reuse elemen header row yang sudah ada: `WorkspaceSideNav.tsx` menampilkan `SidebarTrigger`-nya (dulu desktop-only) di mobile juga sebagai close button; `SettingsSideNav.tsx` (tanpa `SidebarTrigger` by design) dapat tombol close baru `md:hidden` di header row. Lebar drawer (`SIDEBAR_WIDTH_MOBILE`) sudah `18rem`, konsisten dengan desktop di kode — **belum direkonsiliasi** dengan angka `260px` di bullet sebelah (lihat catatan follow-up di section KI-084 di atas). Diverifikasi via browser preview mobile (375px) di Workspace drawer & Settings drawer, termasuk cek regresi desktop.
Berikut ~5 item terakhir yang diselesaikan. Riwayat lengkap (sejak M0): lihat `COMPLETE_TASK.md` — ⚠️ jangan dibaca AI kecuali diperintah eksplisit King Rezi.

---

## Recent Decisions (Ringkasan)

5 ADR terakhir. Daftar lengkap (indeks + link ke tiap ADR): lihat `DECISIONS.md`.

* **ADR-123** — Wiring `RealOutstandAdapter.importPosts`/`fetchImportJobStatus` sungguhan (T-112): signature `fetchImportJobStatus` berubah jadi `(outstandAccountId, importJobId)` (endpoint sungguhan mensyaratkan account id di path, diverifikasi OpenAPI spec resmi); data post diambil tambahan lewat `GET /v1/posts?social_account_id=...` karena endpoint status tidak membawanya; status real API `partial` dipetakan ke `"completed"` (post berhasil tetap diambil, `error` diisi ringkasan gagal) — keputusan produk King Rezi. Detail: `decisions/ADR-123-wiring-import-posts-fetchimportjobstatus-outstandaccountid-partial-status-ki112.md`.
* **ADR-122** — Reconnect untuk akun `disconnected` + disambiguasi `AlreadyConnectedError` vs double-submit (menutup KI-078/KI-079): `ConnectedAccountAction` digabung ke `ReconnectButton` untuk status `disconnected` (bukan hanya `reconnect-required`); `WorkspaceService.createOrRecoverConnectedAccount` membedakan double-submit genuine (jendela 15 detik pada `connectedAt`) dari percobaan connect ke akun yang sudah terhubung dari flow terpisah (`AlreadyConnectedError` baru). Detail: `decisions/ADR-122-reconnect-disconnected-accounts-plus-already-connected-conflict-ki078-079.md`.
* **ADR-121** — Batas Minimum Jumlah Media per `ContentFormat` (Amandemen ADR-107/ADR-039, menutup KI-074): `MIN_MEDIA_COUNT_BY_FORMAT` baru (`Post` 0, `Reel`/`Story`/`Pin` masing-masing 1); batas efektif untuk beberapa target format = MAKSIMUM dari batas minimum semua format dipilih (kebalikan ADR-107 poin 2); ditegakkan hanya di `scheduleDraftAction`/`publishNowAction`, bukan draft. Detail: `decisions/ADR-121-batas-minimum-jumlah-media-per-content-format-ki074.md`.
* **ADR-120** — `avatarUrl` di `ConnectedAccountData`/`ConnectedAccountRecord`/`SidebarChannelAccount` + network call tambahan `resolveConnectCallback` (amandemen ADR-112, menutup backend KI-076): kontrak ACL `avatarUrl?` opsional; `resolveConnectCallback` sekarang panggil `GET /v1/social-accounts/{id}` best-effort untuk foto profil; Facebook Pages join balik `pictureUrl` dari `listPendingFacebookPages`; kolom Prisma baru `avatar_url`; `SidebarChannelAccount.avatarUrl` wajib sebagai kontrak akhir ke UI. Detail: `decisions/ADR-120-connectedaccountdata-avatarurl-sidebar-channels-ki076.md`.
* **ADR-119** — Hapus `FakeOutstandAdapter` dari jalur produksi — `OUTSTAND_API_KEY` wajib (amandemen ADR-059): `getOutstandAdapter()` hanya Real; key kosong throw jelas; kelas Fake produksi dihapus; double lokal di tes tetap; Rule 19 `AGENTS.md` diganti. Menutup T-106. Detail: `decisions/ADR-119-hapus-fake-outstand-adapter-wajib-api-key.md`.

---

## Related Documents

* TASKS.md — backlog task berjenjang (indeks) + `tasks/` per release
* PROJECT_OVERVIEW.md
* ARCHITECTURE_OVERVIEW.md
* PROJECT_RULES.md
* DECISIONS.md
* ../product-discovery/06-engineering/
* ../product-discovery/05-architecture/
* ../product-discovery/04-ux/
