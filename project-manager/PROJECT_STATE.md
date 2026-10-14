# PROJECT STATE

## Snapshot

* **Phase / Milestone:** Phase 6 — Implementation · M8 — Development (Sprint 5) · Overall: M7 100%, M8 in progress
* **Active Mode:** Ready for Development — implementasi fitur produk sesuai Architecture & Engineering Baseline
* **Top Next Tasks:** **T-037 Perkaya aturan coding** (🟡 In Progress; snapshot kedua 2026-10-13). Salinan ID dari **Fokus sekarang** di [`TASKS.md`](TASKS.md).
* **Blocker:** 1 penghalang aktif — KI-015 (Google OAuth). Migrasi T-051 dan sisa follow-up KI-025 sudah diverifikasi tertutup di staging (2026-10-13). Detail di section **Blockers**.
* **Backlog task lengkap:** [`TASKS.md`](TASKS.md) — 99 task per release (v0.1 → v1.0, + v0.7 migrasi Astryx→shadcn/ui, ADR-097), detail di `tasks/`. Jangan cari detail task di file ini.
* **KI-073–080 Resolved (2026-09-26)** — 4 bug publish Instagram (caption wajib untuk Story, Story publish tanpa media, upload media >1MB gagal, avatar akun tidak tampil di sidebar) diperbaiki + diverifikasi live ke akun Instagram/Facebook real (ADR-120). 2 bug turunan ditemukan saat verifikasi (akun `disconnected` tidak bisa reconnect; callback OAuth silent-success untuk conflict genuine) diperbaiki via **ADR-122**. Plus **KI-080** (baru+langsung Resolved) — Railway staging build gagal (`next.config.ts` tidak bisa resolve import workspace `@social/shared`) diperbaiki di branch terpisah sebelum masuk ke fix KI-078/079.
* Detail phase/mode/issue ada di section di bawah. Riwayat completed/ADR lengkap: lihat `COMPLETE_TASK.md` (⚠️ jangan dibaca AI kecuali diperintah)/`DECISIONS.md`.

---

## Metadata

| Field        | Value      |
| ------------ | ---------- |
| Version      | 1.1.2      |
| Status       | Active     |
| Last Updated | 2026-10-14 |

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

Daftar lengkap 99 task (v0.1 → v1.0) beserta subtask, dependency, rantai
blocker, catatan urutan rilis, dan keputusan terbuka yang menunggu King
Rezi — semuanya **hanya** di **[`TASKS.md`](TASKS.md)** (section **Fokus
sekarang** + **Keputusan terbuka**). Snapshot di atas sudah menyalin ID +
judul singkatnya. **Jangan menulis ulang daftar/detail task di sini**
(ADR-062) — daftar ketiga akan langsung desync.

---

## Known Issues

> **ID `KI-XXX`** (ADR-066, amandemen ADR-067) — global, tidak pernah didaur ulang. `Status`: `Open` / `Resolved` / `Sebagian Resolved — sisa scope: <ID>` / `Promoted to T-XXX`. `Sebagian Resolved` dipakai kalau sebagian besar gap sudah ditutup tapi ada 1 subtask/scope kecil yang eksplisit belum — sebutkan sisa scope-nya di string status. Terpisah dari namespace task (`T-XXX`) karena belum tentu jadi task formal. **Entry `Resolved` yang sudah tercatat di `COMPLETE_TASK.md` dihapus dari daftar ini** (bukan dibiarkan dengan status `Resolved`) — riwayatnya tetap ada di `COMPLETE_TASK.md`, ID-nya tidak didaur ulang untuk entry baru.

### KI-015 · Env var `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` belum diisi

| Field | Value |
|-------|-------|
| Status | Sebagian Resolved — sisa scope: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` |
| Kategori | Dependency |
| Terkait | T-025, T-026 |

Sama seperti `OUTSTAND_API_KEY` (KI-003, Resolved 2026-09-24 — lihat `COMPLETE_TASK.md`):

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — kode Google OAuth di `auth.ts` sudah siap (`socialProviders.google` terdaftar kondisional lewat `env.ts`), tapi tanpa env ini "Sign in with Google" tidak aktif. Masih placeholder dummy.
- `JOB_SECRET` — **resolved 2026-08-14**: sudah diisi nilai asli generated di Railway staging (env var), dan job runner (T-027, `POST /api/jobs/run` via Railway Cron `X-Job-Secret`) sudah terverifikasi end-to-end 2x run berturut-turut SUCCESS di staging. Local `.env.local` masih boleh memakai nilai dummy untuk dev.

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
dead code — direservasi untuk metode invite **"Kirim via Email"** (T-007.7).
Desain alurnya sudah dikunci di ADR-100: baris
`workspace_members` dibuat langsung `Pending` saat invite dikirim via
email, lalu diupdate jadi `Active` saat user accept. Dipindah jadi bagian
scope resmi **T-007.7**, bukan lagi Known Issue berdiri sendiri.

**Update (2026-10-12):** **T-007.7 sudah ✅ Done** (lihat
`tasks/v01-foundation.md` § T-007) — diimplementasikan via Resend (adapter
yang sama dikunci T-110), **tanpa menunggu T-005** seperti dugaan awal di
atas. Provider untuk seluruh app dikunci ke Resend di **ADR-126**
(2026-10-14, KI-001 Resolved). T-005 tetap 🟡 In Progress: katalog env
selesai di T-005.2; sisa T-005.3–.5 (kirim email Better Auth) belum dikerjakan.

### KI-053 · Invite via Copy Link — email tidak diverifikasi kepemilikan inbox, rawan identity takeover

| Field | Value |
|-------|-------|
| Status | Promoted to T-110 (2026-09-28) — **T-110 ✅ Done (2026-10-06, commit `bad28cb`)**, implementasi selesai & ter-commit di `staging`; drift dokumentasi (checklist/status belum diupdate) ditemukan & ditutup 2026-10-12, lihat `tasks/v01-foundation.md` § T-110. Satu gap terbuka: verifikasi E2E browser (email A vs email B beda orang) belum tercatat buktinya |
| Kategori | Security / Bug |
| Terkait | T-007.1, T-093, T-110, KI-001, ADR-080, ADR-096 |

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
([auth.ts:53](../apps/web/src/lib/better-auth/auth.ts:53); provider kini
Resend lewat **ADR-126**, tapi `requireEmailVerification` tetap mati sampai
T-005.5) — Better Auth tidak pernah
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

### KI-088 · `triggerPeriodicForAccounts` (Import Posts periodik) butuh `actingUserId` yang belum ada sumbernya

| Field | Value |
|-------|-------|
| Status | Open |
| Kategori | Tech-Debt / Gap Produk |
| Terkait | T-090 (T-090.3) |

Nomor ini **KI-088**. KI-059 sudah dipakai untuk verifikasi upload media T-024 (Resolved 2026-09-15) dan tidak didaur ulang.

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

### KI-089 · Lebar sidebar kode (`18rem`) belum dikonfirmasi terhadap acuan 260px

| Field | Value |
|-------|-------|
| Status | Open |
| Kategori | UI — belum dikonfirmasi |
| Terkait | KI-084 (Resolved 2026-10-08, konsistensi sidebar mobile/desktop) |

Pertanyaan ini sempat tertulis di dalam KI-084. KI-084 sudah Resolved dan
dikeluarkan dari daftar hidup, jadi pertanyaannya ikut hilang. Nomor KI-084
tidak didaur ulang.

Di kode, `SIDEBAR_WIDTH` dan `SIDEBAR_WIDTH_MOBILE` di
`apps/web/src/components/ui/sidebar.tsx` sama-sama `18rem` (288px). Catatan
lama menyebut acuan Claude Design 260px. Belum dikonfirmasi apakah 260px itu
hanya nilai mockup statis, atau lebar yang seharusnya dipakai di aplikasi
(desktop dan mobile, bukan regresi khusus mobile). Menunggu konfirmasi King
Rezi sebelum dianggap bukan masalah. Tidak memblokir pekerjaan lain.

---

## Blockers

**Wajib dicek AI sebelum mengerjakan subtask apapun yang menyentuh area di
bawah.** Satu penghalang masih terbuka. Kalau eksekusi subtask di area ini
gagal, cek dulu apakah penghalang ini penyebabnya sebelum menyimpulkan ada
bug di kode.

| ID         | Blocker                                                        | Menghambat                          |
| ---------- | --------------------------------------------------------------- | ------------------------------------ |
| **KI-015** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` belum diisi (JOB_SECRET sudah resolved 2026-08-14 di Railway staging) | Google OAuth sign-in |

**Resolved 2026-10-13:** migrasi `20260922110000_t051_filter_active_status_engagement_sync_lookup` sudah ter-apply di database staging sejak 2026-09-22 (`_prisma_migrations.finished_at` terisi, tidak di-rollback). Fungsi `webhook_find_account_owner_by_outstand_account_id` mengembalikan kolom `status`. Catatan "belum di-deploy" di Blockers adalah drift dokumen. Tidak ada `db:deploy` baru di sesi ini.

**Resolved 2026-10-13:** sisa follow-up KI-025 (item 1 health-check cron + item 3 backfill). Service Railway `cron` staging membalas **200** tiap menit pada 2026-10-13. Job `engagement.sync` terakhir selesai 2026-10-13 07:08 UTC; dua baris `pending` adalah jadwal 30 menit berikutnya, bukan job macet. Lima target yang dulu stuck `pending` (`l21bW`, `MAnO3`, `FWnBp`, `XnD5d` → `published`; `3YuZC` → `failed`) sudah berstatus final sejak 2026-10-05. Tidak ada `PublishingPostTarget` berstatus `pending`. Item 2 (enqueue `resolve_outcome` di Publish Now) sudah selesai 2026-10-05. Tidak ada kode baru.

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

* **T-005.1–.2 + KI-001 (2026-10-14)** — provider email transactional dikunci ke Resend (ADR-126). KI-001 dikeluarkan dari daftar hidup. Katalog `RESEND_API_KEY` / `RESEND_FROM_EMAIL` masuk tabel server (T-005.2). T-005 tetap In Progress; sisa T-005.3–.5 belum dikerjakan. Detail: `decisions/ADR-126-transactional-email-provider-resend-t005.md`, `COMPLETE_TASK.md`.
* **T-016 ✅ TUNTAS 5/5 subtask — Account & user settings screens, T-016.4 `/account/notifications` (2026-10-14)** — subtask terakhir (preferensi notifikasi: Balasan & Mention, Jadwal Publish, Laporan Analytics) diimplementasikan di domain `identity`, lolos review Ridwan (nihil temuan) dan QA end-to-end Najwa. Migration baru `identity_user` sudah dijalankan King Rezi & diverifikasi via Supabase MCP. PR #164 ke `staging` sudah di-merge. Detail: `tasks/v01-foundation.md` § T-016, `COMPLETE_TASK.md`.
* **T-030 ✅ TUNTAS 3/3 subtask — Cancel Schedule + dialog konfirmasi (2026-10-13)** — entry point "Batalkan Jadwal" ditambahkan di popover Calendar (`CalendarPostPopover.tsx`), melengkapi bagian Queue yang sudah selesai sejak T-032.4. 100% reuse use-case/RBAC yang sama, tanpa business logic baru. Detail: `tasks/v02-publishing-mvp.md` § T-030, `COMPLETE_TASK.md`.
* **Blocker staging ditutup (2026-10-13)** — migrasi T-051 sudah ter-apply sejak 2026-09-22, cron staging membalas 200 tiap menit, dan lima target Publish Now yang stuck `pending` sudah final sejak 2026-10-05. Penghalang aktif tinggal **KI-015**. Detail: `COMPLETE_TASK.md`.
* **KI-087 ✅ Resolved (2026-10-13)** — service Railway `cron-analytics` (jadwal `0 0 * * *`, trigger `?type=analytics`) kembali membalas **200**. Akar masalah: image `curlimages/curl` menjalankan perintah tanpa shell, jadi `$JOB_SECRET` terkirim literal. Service dikembalikan ke image `alpine:3.20` + `sh -c` (pola yang sama dengan service `cron` yang sudah jalan). Nilai `JOB_SECRET` ketiga service memang sudah sama — dugaan mismatch secret tidak terbukti. Detail: `COMPLETE_TASK.md`.
Berikut ~5 item terakhir yang diselesaikan. Riwayat lengkap (sejak M0): lihat `COMPLETE_TASK.md` — ⚠️ jangan dibaca AI kecuali diperintah eksplisit King Rezi.

---

## Recent Decisions (Ringkasan)

5 ADR terakhir. Daftar lengkap (indeks + link ke tiap ADR): lihat `DECISIONS.md`.

* **ADR-126** — Provider email transactional dikunci ke Resend (T-005.1). Menutup KI-001. Katalog env selesai di T-005.2. Reset password dan verifikasi email Better Auth masih T-005.3–.5. Detail: `decisions/ADR-126-transactional-email-provider-resend-t005.md`.
* **ADR-125** — Save Draft menyimpan akun tujuan (akun, format, opsi Pinterest) dan Draft Editor mengisi Account Selector dari data itu saat dibuka lagi. Menutup KI-060 dan KI-032. Tanggal/jam jadwal tidak ikut. Detail: `decisions/ADR-125-simpan-akun-tujuan-draft-ki060.md`.
* **ADR-124** — Nama produk final "Postific"; package scope `@social/*` menjadi `@postific/*`. Detail: `decisions/ADR-124-nama-produk-postific-rename-package-scope-social-ke-postific.md`.
* **ADR-123** — Wiring `RealOutstandAdapter.importPosts`/`fetchImportJobStatus` sungguhan (T-112): signature `fetchImportJobStatus` berubah jadi `(outstandAccountId, importJobId)` (endpoint sungguhan mensyaratkan account id di path, diverifikasi OpenAPI spec resmi); data post diambil tambahan lewat `GET /v1/posts?social_account_id=...` karena endpoint status tidak membawanya; status real API `partial` dipetakan ke `"completed"` (post berhasil tetap diambil, `error` diisi ringkasan gagal) — keputusan produk King Rezi. Detail: `decisions/ADR-123-wiring-import-posts-fetchimportjobstatus-outstandaccountid-partial-status-ki112.md`.
* **ADR-122** — Reconnect untuk akun `disconnected` + disambiguasi `AlreadyConnectedError` vs double-submit (menutup KI-078/KI-079): `ConnectedAccountAction` digabung ke `ReconnectButton` untuk status `disconnected` (bukan hanya `reconnect-required`); `WorkspaceService.createOrRecoverConnectedAccount` membedakan double-submit genuine (jendela 15 detik pada `connectedAt`) dari percobaan connect ke akun yang sudah terhubung dari flow terpisah (`AlreadyConnectedError` baru). Detail: `decisions/ADR-122-reconnect-disconnected-accounts-plus-already-connected-conflict-ki078-079.md`.

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
