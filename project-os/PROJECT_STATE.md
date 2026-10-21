# PROJECT STATE

## Snapshot

- **Phase / Milestone:** Phase 6 — Implementation · M8 — Development (Sprint 5) · Overall: M7 100%, M8 in progress
- **Active Mode:** Ready for Development — implementasi fitur produk sesuai Architecture & Engineering Baseline
- **Top Next Tasks:** **T-037 Perkaya aturan coding** (🟡 In Progress, prioritas rendah). **T-115 Wiring cron harian Import Posts periodik** (🟡 In Progress — sisa T-115.5: post native Facebook muncul di Postific). T-128/T-129 selesai 2026-10-19 (default view Home/Analyze jadi Bulanan; Imported posts ikut dihitung di Analyze). Revisi scope Import Posts dari King Rezi (2026-10-20): **T-131 selesai** — beda request body cron/connect/manual. **T-132 selesai (2026-10-20, ADR-135)** — klasifikasi jenis konten Story/Reel/Post hasil Import via Outstand Analytics. **Fokus terdekat sekarang (2026-10-21, prioritas tinggi King Rezi):** investigasi ketidaksesuaian data Supabase vs Outstand melahirkan 4 tiket — **T-130 (KI-093)**, **T-134 (KI-094)** disconnect akun sosial tidak dipropagasi ke Outstand, **T-135 (KI-095)** definisi periode "bulanan" beda dari kalender Outstand, **T-136 (KI-096)** ambiguitas label "Post terpublikasi" Home — dikerjakan sebagai satu batch. **T-133 sekarang 🚫 di-block King Rezi** sampai keempat tiket itu tuntas (sebelumnya tertahan menunggu konfirmasi eksekusi script; T-133.1 tetap tidak bisa diverifikasi tanpa akun test TikTok/Pinterest). T-124 selesai 2026-10-19 (KI-091, error kolom `void` hilang di retest staging). T-116 → T-117 → T-118 (biaya token agent) selesai 2026-10-16 (ADR-133). Antrian lengkap: [`AVAILABLE_TICKETS.md`](AVAILABLE_TICKETS.md).
- **Blocker:** 1 penghalang aktif — KI-015 (Google OAuth). Migrasi T-051 dan sisa follow-up KI-025 sudah diverifikasi tertutup di staging (2026-10-13). Detail di section **Blockers**.
- **Antrian task:** [`AVAILABLE_TICKETS.md`](AVAILABLE_TICKETS.md). Tiket, termasuk yang selesai, ada di `tickets/`. Jangan cari detail task di file ini.
- **KI-073–080 Resolved (2026-09-26)** — 4 bug publish Instagram (caption wajib untuk Story, Story publish tanpa media, upload media >1MB gagal, avatar akun tidak tampil di sidebar) diperbaiki + diverifikasi live ke akun Instagram/Facebook real (ADR-120). 2 bug turunan ditemukan saat verifikasi (akun `disconnected` tidak bisa reconnect; callback OAuth silent-success untuk conflict genuine) diperbaiki via **ADR-122**. Plus **KI-080** (baru+langsung Resolved) — Railway staging build gagal (`next.config.ts` tidak bisa resolve import workspace `@social/shared`) diperbaiki di branch terpisah sebelum masuk ke fix KI-078/079.
- Detail phase/mode/issue ada di section di bawah. Tiket selesai ada di `tickets/`. Keputusan ada di `DECISIONS.md`.

---

## Metadata

| Field        | Value      |
| ------------ | ---------- |
| Version      | 1.1.3      |
| Status       | Active     |
| Last Updated | 2026-10-21 |

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

| KI     | Status                                                                                        | Tiket                                 |
| ------ | --------------------------------------------------------------------------------------------- | ------------------------------------- |
| KI-015 | Sebagian Resolved — sisa: env Google OAuth belum diisi                                        | [T-119](tickets/known-issues.md)      |
| KI-028 | Open — environment production belum ada                                                       | [T-088](tickets/v10-public-launch.md) |
| KI-053 | Sisa: bukti E2E email A vs email B. Perbaikan kodenya di T-110 ✅                             | [T-122](tickets/known-issues.md)      |
| KI-093 | Open, prioritas tinggi — `totalPosts` Home tidak akurat (akun `posts_count` null di Outstand) | [T-130](tickets/known-issues.md)      |
| KI-094 | Open, prioritas tinggi — disconnect akun sosial tidak dipropagasi ke Outstand                 | [T-134](tickets/known-issues.md)      |
| KI-095 | Open, prioritas tinggi — definisi periode "bulanan" beda dari kalender Outstand               | [T-135](tickets/known-issues.md)      |
| KI-096 | Open, prioritas tinggi — ambiguitas label "Post terpublikasi" Home                            | [T-136](tickets/known-issues.md)      |

KI yang tiketnya sudah selesai dikeluarkan dari daftar ini pada 2026-10-16 (ADR-132): KI-044 (T-108), KI-046 (T-007.7), KI-049 dan KI-063 (T-107), KI-058 (T-109), KI-086 (ADR-127), KI-088 (T-090), KI-090 (T-113). Pada 2026-10-19: KI-027 (T-008), KI-033 (T-120), KI-050 (T-121), KI-089 (T-123), KI-091 (T-124).

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

- **T-116 → T-117 → T-118 ✅ Done — biaya token `AGENTS.md` dipangkas (2026-10-16, ADR-133)** — tiga berkas panduan vendor Vercel di `.claude/skills/` (±134 KB total) berganti nama `AGENTS.md` → `REFERENCE.md` supaya tidak ikut termuat penuh di setiap giliran Cursor. `AGENTS.md` root ditipiskan (304 baris/20.4 KB → 138 baris/8.9 KB — esai dipindah jadi penunjuk ke `project-os-navigator/SKILL.md` dan `context/ctx-technical-context.md`). Navigator mendapat aturan baru: perubahan sepele dikerjakan agen utama tanpa evaluasi Domain → Subagent, dan satu task per percakapan. Detail: `tickets/v01-foundation.md` § Konteks agent.
- **KI-086 ✅ Resolved — reconnect Facebook `disconnected`/`reconnect-required` tidak lagi dead flow (2026-10-15, ADR-127)** — `createConnectedAccounts` kini mereaktivasi row existing yang bukan `active` (lewat flow "Connect Account" → Facebook Pages Picker), bukan skip diam-diam. Claude Design dicek dulu (rule 17): pola Reconnect generik, tidak ada pengecualian Facebook di desain. Scope dikunci backend-only — `ReconnectButton` tetap disembunyikan untuk Facebook (adapter throw eksplisit untuk platform ini, bukan gap UI). Detail: `decisions/ADR-127-reaktivasi-connected-account-facebook-ki086.md`.
- **KI-088 ✅ Resolved — gap `actingUserId` jalur periodik Import Posts ditutup (2026-10-15)** — King Rezi memilih (lewat `AskUserQuestion`) reuse pola JOB-04/JOB-03 (`findAccountOwnerByOutstandAccountId`) alih-alih `Workspace.ownerId` langsung. `triggerPeriodicForAccounts` sekarang me-resolve `actingUserId` sendiri per akun, tanpa dependency baru di composition root. Detail: `tickets/v02-publishing-mvp.md` § T-090 addendum.
- **T-131 ✅ Done (5/5 subtask) — beda request body Import Posts per trigger (2026-10-20)** — `triggerAuto`/`triggerManual` lookback jadi 1 tahun & limit 1000, cron harian pakai `since` pengaman anti-gap (watermark vs 24 jam, ambil yang lebih tua), limit cron tetap 100. Review Ridwan bersih, QA Najwa PASS (846 test). Verifikasi model biaya Outstand per-call vs per-post masih follow-up terbuka sebelum deploy production. Detail: `tickets/v02-publishing-mvp.md` § T-131.
- **T-132 ✅ Done — klasifikasi `ContentFormat` hasil Import via Outstand Analytics (2026-10-20, ADR-135)** — `FetchPostMetricsResult` diperluas 3 field opsional (`mediaProductType`/`isReel`/`storyExpired`) dari Outstand Analytics; `ClassifyImportedPostTargetsUseCase` best-effort terpisah dari import utama (pola T-114), tidak perlu komponen UI baru (Calendar popover existing sudah generik). Review Ridwan PASS, QA Najwa PASS (unit test independen hijau semua) — verifikasi visual popover Reel/Story belum bisa dibuktikan (belum ada data, gap expected bukan bug). Detail: `tickets/v02-publishing-mvp.md` § T-132.
  Berikut 5 item terakhir yang diselesaikan. Tiket lengkapnya ada di `tickets/`. Riwayat sesi ada di git.

---

## Recent Decisions (Ringkasan)

5 ADR terakhir. Daftar lengkap (indeks + link ke tiap ADR): lihat `DECISIONS.md`.

- **ADR-135** — `FetchPostMetricsResult` diperluas 3 field opsional (`mediaProductType`/`isReel`/`storyExpired`) dari Outstand Analytics untuk klasifikasi `ContentFormat` (Post/Reel/Story) post hasil Import, menutup T-132.
- **ADR-134** — Tiket yang lahir dari Known Issue pindah ke `tickets/known-issues.md`. Tiket rilis tetap di `tickets/vXX-*.md`.
- **ADR-133** — `AGENTS.md` root jadi pintu tipis. Esai yang sudah punya rumah di `context/`, `.claude/agents/README.md`, `project-os-navigator/SKILL.md`, dan `apps/web/.claude/CLAUDE.md` jadi penunjuk satu baris.
- **ADR-132** — Folder kerja menjadi `project-os/`. Rumah tiket menjadi `tickets/` dan `AVAILABLE_TICKETS.md`. Kode hanya berubah lewat tiket. Known Issue terbuka punya tiket. Urutan tulis dokumen: product-discovery → context → project-os.
- **ADR-131** — Antrian kerja pindah ke file tiket yang belum selesai. `COMPLETE_TASK.md` dihapus. Deskripsi kerja: docs → spec → tiket → implement.

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
