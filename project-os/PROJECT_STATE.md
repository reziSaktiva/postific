# PROJECT STATE

## Snapshot

- **Phase / Milestone:** Phase 6 — Implementation · M8 — Development (Sprint 5) · Overall: M7 100%, M8 in progress
- **Active Mode:** Ready for Development — implementasi fitur produk sesuai Architecture & Engineering Baseline
- **Top Next Tasks:** **T-037 Perkaya aturan coding** (🟡 In Progress). Berikutnya, berurutan: **T-116** Ganti nama AGENTS.md vendor, **T-117** Tipiskan AGENTS.md root, **T-118** Higiene sesi agent. Antrian lengkap: [`AVAILABLE_TICKETS.md`](AVAILABLE_TICKETS.md).
- **Blocker:** 1 penghalang aktif — KI-015 (Google OAuth). Migrasi T-051 dan sisa follow-up KI-025 sudah diverifikasi tertutup di staging (2026-10-13). Detail di section **Blockers**.
- **Antrian task:** [`AVAILABLE_TICKETS.md`](AVAILABLE_TICKETS.md). Tiket, termasuk yang selesai, ada di `tickets/`. Jangan cari detail task di file ini.
- **KI-073–080 Resolved (2026-09-26)** — 4 bug publish Instagram (caption wajib untuk Story, Story publish tanpa media, upload media >1MB gagal, avatar akun tidak tampil di sidebar) diperbaiki + diverifikasi live ke akun Instagram/Facebook real (ADR-120). 2 bug turunan ditemukan saat verifikasi (akun `disconnected` tidak bisa reconnect; callback OAuth silent-success untuk conflict genuine) diperbaiki via **ADR-122**. Plus **KI-080** (baru+langsung Resolved) — Railway staging build gagal (`next.config.ts` tidak bisa resolve import workspace `@social/shared`) diperbaiki di branch terpisah sebelum masuk ke fix KI-078/079.
- Detail phase/mode/issue ada di section di bawah. Tiket selesai ada di `tickets/`. Keputusan ada di `DECISIONS.md`.

---

## Metadata

| Field        | Value      |
| ------------ | ---------- |
| Version      | 1.1.2      |
| Status       | Active     |
| Last Updated | 2026-10-16 |

---

## Current Status

| Item              | Value                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Current Phase     | Phase 6 — Implementation                                                                        |
| Current Milestone | M8 — Development                                                                                |
| Current Sprint    | Sprint 5                                                                                        |
| Overall Progress  | M7 100% · M8 in progress                                                                        |
| Project Status    | M8 berjalan — Publishing MVP (Real OutstandAdapter wajib; Fake jalur produksi dihapus, ADR-119) |

---

## Current Focus

M7 Repository & Bootstrap **selesai**. M8 Development **berjalan**.

- **AI Context layer** (`context/`) sudah di-scaffold (opsi A) — indeks + aturan operasional agent; bukan duplikasi baseline.
- `AGENTS.md` di root sudah ada; skill resmi vendor yang relevan (Prisma,
  Better Auth, Vercel, Supabase) sudah terpasang di `.claude/skills/` —
  satu-satunya lokasi skill sejak ADR-064 (`.agents/skills/` dihapus).
- Project dikerjakan di **dua tool**: Claude Code (utama) dan Cursor. Paritas
  aset agent + dua pasang file kembar yang wajib dijaga sinkron (config MCP,
  proteksi baca secret) didokumentasikan di section "Kompatibilitas tool"
  pada `AGENTS.md` (ADR-064).
- Integrasi Outstand runtime asli (ADR-040) sudah hidup lewat Real
  OutstandAdapter (T-025 ✅, KI-003 Resolved); Fake jalur produksi dihapus
  (T-106 ✅, ADR-119 — `OUTSTAND_API_KEY` wajib). Migrasi UI
  Astryx→shadcn/ui (ADR-097, rilis v0.7) sudah tuntas 100% — tiketnya di
  `tickets/v07-astryx-shadcn-migration.md`, bukan di sini.
- **Antrian task** ada di [`AVAILABLE_TICKETS.md`](AVAILABLE_TICKETS.md). Tiket
  per rilis ada di `tickets/` (ADR-062, ADR-131).

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

| Milestone                   | Status         |
| --------------------------- | -------------- |
| M0 — Project Foundation     | ✅ Completed   |
| M1 — Discovery              | ✅ Completed   |
| M2 — Business Planning      | ✅ Completed   |
| M3 — Product Planning       | ✅ Completed   |
| M4 — UX Planning            | ✅ Completed   |
| M5 — System Architecture    | ✅ Completed   |
| M6 — Engineering Planning   | ✅ Completed   |
| M7 — Repository & Bootstrap | ✅ Completed   |
| M8 — Development            | 🟡 In Progress |
| M9 — Testing & Release      | ⏳ Pending     |

---

## In Progress

Task berstatus 🟡 **hanya** ada di [`AVAILABLE_TICKETS.md`](AVAILABLE_TICKETS.md)
dan section tiketnya di `tickets/vXX-*.md` (ADR-131) — tidak diduplikasi di sini.

Catatan non-task (bukan task, jadi memang layak di sini): template
`design-tokens.md` berstatus Draft / TBD; nilai final berkembang iteratif
co-equal dengan Claude Design (ADR-056) — tidak ada lagi gerbang "designer
masuk", project ini tidak akan merekrut designer eksternal (ADR-057,
amandemen ADR-038 & ADR-041).

---

## Next Tasks

Antrian task yang belum selesai ada di **[`AVAILABLE_TICKETS.md`](AVAILABLE_TICKETS.md)**.
Snapshot di atas sudah menyalin ID + judul singkatnya. **Jangan menulis ulang
daftar/detail task di sini** (ADR-062, ADR-131).

---

## Known Issues

> **ID `KI-XXX`** (ADR-066, ADR-067, ADR-131, ADR-132). ID tidak didaur ulang. Setiap KI yang masih terbuka punya tiket. Baris di sini hanya menunjuk tiket itu. KI keluar dari daftar ini saat tiket penutupnya selesai.

| KI     | Status                                                            | Tiket                                  |
| ------ | ----------------------------------------------------------------- | -------------------------------------- |
| KI-015 | Sebagian Resolved — sisa: env Google OAuth belum diisi            | [T-119](tickets/v01-foundation.md)     |
| KI-027 | Open — konfirmasi desain selector Admin                           | [T-008](tickets/v01-foundation.md)     |
| KI-028 | Open — environment production belum ada                           | [T-088](tickets/v10-public-launch.md)  |
| KI-033 | Open — dua workspace QA belum dihapus                             | [T-120](tickets/v01-foundation.md)     |
| KI-050 | Open — meta penulis di History belum diputuskan                   | [T-121](tickets/v02-publishing-mvp.md) |
| KI-053 | Sisa: bukti E2E email A vs email B. Perbaikan kodenya di T-110 ✅ | [T-122](tickets/v01-foundation.md)     |
| KI-089 | Open — lebar sidebar belum dikonfirmasi                           | [T-123](tickets/v01-foundation.md)     |

KI yang tiketnya sudah selesai dikeluarkan dari daftar ini pada 2026-10-16 (ADR-132): KI-044 (T-108), KI-046 (T-007.7), KI-049 dan KI-063 (T-107), KI-058 (T-109), KI-086 (ADR-127), KI-088 (T-090), KI-090 (T-113).

---

## Blockers

**Wajib dicek AI sebelum mengerjakan subtask apapun yang menyentuh area di
bawah.** Satu penghalang masih terbuka. Kalau eksekusi subtask di area ini
gagal, cek dulu apakah penghalang ini penyebabnya sebelum menyimpulkan ada
bug di kode.

| ID         | Blocker                                                                                                                         | Menghambat           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **KI-015** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` belum diisi. Tiket: T-119. `JOB_SECRET` sudah terisi di Railway staging (2026-08-14) | Google OAuth sign-in |

**Resolved 2026-10-13:** migrasi `20260922110000_t051_filter_active_status_engagement_sync_lookup` sudah ter-apply di database staging sejak 2026-09-22 (`_prisma_migrations.finished_at` terisi, tidak di-rollback). Fungsi `webhook_find_account_owner_by_outstand_account_id` mengembalikan kolom `status`. Catatan "belum di-deploy" di Blockers adalah drift dokumen. Tidak ada `db:deploy` baru di sesi ini.

**Resolved 2026-10-13:** sisa follow-up KI-025 (item 1 health-check cron + item 3 backfill). Service Railway `cron` staging membalas **200** tiap menit pada 2026-10-13. Job `engagement.sync` terakhir selesai 2026-10-13 07:08 UTC; dua baris `pending` adalah jadwal 30 menit berikutnya, bukan job macet. Lima target yang dulu stuck `pending` (`l21bW`, `MAnO3`, `FWnBp`, `XnD5d` → `published`; `3YuZC` → `failed`) sudah berstatus final sejak 2026-10-05. Tidak ada `PublishingPostTarget` berstatus `pending`. Item 2 (enqueue `resolve_outcome` di Publish Now) sudah selesai 2026-10-05. Tidak ada kode baru.

**Resolved 2026-09-07:** KI-048 (3 migration Prisma T-026 belum `prisma
migrate deploy` ke DB dev/live) — King Rezi menjalankan `bun run
db:deploy`, migration terverifikasi ter-apply (Najwa QA Engineer cross-check
via Supabase MCP), retest end-to-end nyata 5 skenario webhook semua PASS.
**T-026 dan T-036 keduanya ditutup `✅ Done`**, lihat tiket di `tickets/`.

**Resolved 2026-08-14:** KI-025 (Railway belum pernah dibuat) — staging
sudah live & terverifikasi, lihat tiket di `tickets/`. Sisa gap production
dicatat terpisah sebagai **KI-028** (tidak memblokir M8/T-027 staging).

**Resolved 2026-08-24:** KI-034 (QA Najwa belum retest golden path switch
workspace dengan dialog konfirmasi Tier 2 baru, T-089.6/ADR-089) — QA
formal Najwa selesai, lolos penuh (unit test + full suite 157 passed/3
skipped/0 gagal + golden path browser end-to-end, tidak ada bug baru),
lihat tiket di `tickets/`.

**Resolved 2026-08-31:** KI-038 (T-093.4 verifikasi RBAC end-to-end 2-akun
browser nyata belum dilakukan) — Najwa QA Engineer menuntaskan verifikasi
dengan 3 akun real (Owner/Admin/Creator) di satu workspace, seluruh skenario
RBAC PASS; 1 bug ditemukan (Creator bisa mengakses `/settings/members` yang
seharusnya "Tidak ada akses") dan sudah diperbaiki + diverifikasi ulang
(commit `6fdf272`), lihat tiket di `tickets/`.

Detail masing-masing ada di section **Known Issues** di atas — tabel ini
hanya pointer supaya blocker aktif langsung terlihat tanpa harus menyisir
seluruh daftar Known Issues.

---

## Completed (Ringkasan)

- **KI-086 ✅ Resolved — reconnect Facebook `disconnected`/`reconnect-required` tidak lagi dead flow (2026-10-15, ADR-127)** — `createConnectedAccounts` kini mereaktivasi row existing yang bukan `active` (lewat flow "Connect Account" → Facebook Pages Picker), bukan skip diam-diam. Claude Design dicek dulu (rule 17): pola Reconnect generik, tidak ada pengecualian Facebook di desain. Scope dikunci backend-only — `ReconnectButton` tetap disembunyikan untuk Facebook (adapter throw eksplisit untuk platform ini, bukan gap UI). Detail: `decisions/ADR-127-reaktivasi-connected-account-facebook-ki086.md`.
- **KI-088 ✅ Resolved — gap `actingUserId` jalur periodik Import Posts ditutup (2026-10-15)** — King Rezi memilih (lewat `AskUserQuestion`) reuse pola JOB-04/JOB-03 (`findAccountOwnerByOutstandAccountId`) alih-alih `Workspace.ownerId` langsung. `triggerPeriodicForAccounts` sekarang me-resolve `actingUserId` sendiri per akun, tanpa dependency baru di composition root. Detail: `tickets/v02-publishing-mvp.md` § T-090 addendum.
- **T-114 ✅ TUNTAS 5/5 subtask — backfill otomatis `outstandPostId` post Imported lama (2026-10-15)** — lanjutan langsung T-113: 36 dari 39 post Imported lama di akun test masih `outstandPostId: null` (T-113 cuma memperbaiki import baru ke depan). Mekanisme permanen ditambahkan — tiap Sync Now/periodik otomatis backfill kalau masih ada gap, reuse namespace lock T-113. 0 temuan review Ridwan. Diverifikasi end-to-end nyata: 39/39 ter-backfill setelah satu kali Sync Now. Detail: `tickets/v02-publishing-mvp.md` § T-114.
- **T-113 ✅ TUNTAS 4/4 subtask — comment post Imported ikut ter-sync ke Engage Inbox (2026-10-15)** — promosi **KI-090**. `outstandPostId` kini ditangkap+disimpan untuk post hasil Import Posts. 2 bug konkurensi/cross-post CONFIRMED ditemukan & diperbaiki lewat 3 ronde review Ridwan (unique index global, lalu race antar transaksi via `pg_advisory_xact_lock`). Diverifikasi end-to-end nyata: comment Reels Facebook berhasil masuk Comments Inbox. Detail: `tickets/v02-publishing-mvp.md` § T-113.
- **T-005 ✅ TUNTAS 5/5 — email verification flow (2026-10-14)** — Resend mengirim reset password dan verifikasi email. `/verify-email` hidup. `requireEmailVerification` aktif. Akun lama di-backfill lewat migrasi `20261014160000`. Accept-invite memakai cookie httpOnly `invite-email-proof` supaya sign-up tanpa OTP tidak ikut terverifikasi. Perbaikan review PR #168 juga mengembalikan pekerjaan staging (T-016.4, T-030.3, T-091) yang akan terhapus kalau branch di-merge apa adanya. Detail: `tickets/v01-foundation.md` § T-005.
  Berikut 5 item terakhir yang diselesaikan. Tiket lengkapnya ada di `tickets/`. Riwayat sesi ada di git.

---

## Recent Decisions (Ringkasan)

5 ADR terakhir. Daftar lengkap (indeks + link ke tiap ADR): lihat `DECISIONS.md`.

- **ADR-132** — Folder kerja menjadi `project-os/`. Rumah tiket menjadi `tickets/` dan `AVAILABLE_TICKETS.md`. Kode hanya berubah lewat tiket. Known Issue terbuka punya tiket. Urutan tulis dokumen: product-discovery → context → project-os.
- **ADR-131** — Antrian kerja pindah ke file tiket yang belum selesai. `COMPLETE_TASK.md` dihapus. Deskripsi kerja: docs → spec → tiket → implement.
- **ADR-130** — Layar Start Page editor dan pola Link List dikunci sebagai tabel tanpa header (T-072).
- **ADR-129** — Halaman publik Start Page memakai layout Card Stack (T-071).
- **ADR-128** — Halaman publik Start Page diakses lewat `/u/[slug]`, bukan custom domain (T-070).

---

## Related Documents

- AVAILABLE_TICKETS.md — antrian task yang belum selesai; tiket di `tickets/`
- PROJECT_OVERVIEW.md
- ARCHITECTURE_OVERVIEW.md
- PROJECT_RULES.md
- DECISIONS.md
- ../product-discovery/06-engineering/
- ../product-discovery/05-architecture/
- ../product-discovery/04-ux/
