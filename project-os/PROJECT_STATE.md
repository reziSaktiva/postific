# PROJECT STATE

## Snapshot

- **Phase / Milestone:** Phase 6 — Implementation · M8 — Development (Sprint 5) · Overall: M7 100%, M8 in progress
- **Active Mode:** Ready for Development — implementasi fitur produk sesuai Architecture & Engineering Baseline
- **Top Next Tasks:** **T-037 Perkaya aturan coding** (🟡 In Progress, prioritas rendah). **T-115 Wiring cron harian Import Posts periodik** (🟡 In Progress — sisa T-115.5: post native Facebook muncul di Postific). T-128/T-129 selesai 2026-10-19 (default view Home/Analyze jadi Bulanan; Imported posts ikut dihitung di Analyze). Revisi scope Import Posts dari King Rezi (2026-10-20): **T-131 selesai** — beda request body cron/connect/manual. **T-132 selesai (2026-10-20, ADR-135)** — klasifikasi jenis konten Story/Reel/Post hasil Import via Outstand Analytics. **Batch T-130/T-134/T-135/T-136 (KI-093/094/095/096) — implementasi tuntas 2026-10-21 (ADR-136), verifikasi E2E dengan akun real 2026-10-22:** investigasi ketidaksesuaian data Supabase vs Outstand yang melahirkan 4 tiket ini sudah diperbaiki di sisi kode — `totalPosts` Home pindah dari Outstand `posts_count` (tidak didukung untuk Facebook Page) ke status internal `PublishingPost`; disconnect akun sekarang trigger recompute snapshot segera (tanpa panggilan Outstand, opsi `DELETE` ditolak King Rezi karena merusak reaktivasi ADR-127); window "bulanan" pindah ke kalender bulan; label "Post terpublikasi" otomatis akurat ikut fix T-130. Granularitas totalPosts Home vs Analyze boleh beda (keputusan final King Rezi, bukan gap). Review Ridwan PASS, QA Najwa PASS (898 test); snapshot 13 workspace sudah dibackfill manual. Akun test real "Cook It Real Good" (4 channel) dipakai untuk verifikasi E2E: **T-134 dan T-135 ✅ Done** (2026-10-22); **T-130, T-136 ✅ Done** (2026-10-23, Home menampilkan 12 post Oktober sesuai DB). Bug **T-139 (KI-099)** — timeout transaksi saat insert batch import besar — diperbaiki dengan chunk per transaksi (50 post) dan terverifikasi (182 post Instagram, 18,6 detik) ✅ Done; bug baru **T-141 (KI-101)** — `GET /v1/posts` limit maks 100 membuat import >100 post gagal HTTP 400 — diperbaiki dengan pagination ✅ Done. **T-133 ✅ Done (2026-10-23):** script T-133.2/.3 dieksekusi atas konfirmasi King Rezi (Facebook 184, Instagram 182 post, terklasifikasi), diverifikasi di Home/Analyze/History; TikTok terbukti didukung Import, Pinterest tetap keterbatasan eksplisit (tanpa akun test). T-124 selesai 2026-10-19 (KI-091, error kolom `void` hilang di retest staging). T-116 → T-117 → T-118 (biaya token agent) selesai 2026-10-16 (ADR-133). **T-137 (KI-097, ADR-137) — selesai 2026-10-22**, env Railway staging diisi King Rezi dan verifikasi e2e PASS. **T-140 (KI-100) — selesai 2026-10-22**: bug produksi infinite redirect loop `/` ↔ `/login` saat session cookie stale/invalid (`proxy.ts`), ditemukan King Rezi saat `bun dev` lokal, diperbaiki sesi yang sama (cookie session stale dihapus sebelum redirect ke `/login`) + test regresi ditambahkan (919 passed, 0 fail). **T-142 (🔴 bug, 2026-10-23)** — History mengelompokkan/mengurutkan per `updatedAt` sehingga semua post (terutama Imported) menumpuk di hari import; keputusan King Rezi: pakai `publishedAt`; menunggu cek Claude Design + ADR sebelum kode. Antrian lengkap: [`AVAILABLE_TICKETS.md`](AVAILABLE_TICKETS.md).
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

| KI     | Status                                                                                                                                       | Tiket                                 |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| KI-015 | Sebagian Resolved — sisa: env Google OAuth belum diisi                                                                                       | [T-119](tickets/known-issues.md)      |
| KI-028 | Open — environment production belum ada                                                                                                      | [T-088](tickets/v10-public-launch.md) |
| KI-053 | Sisa: bukti E2E email A vs email B. Perbaikan kodenya di T-110 ✅                                                                            | [T-122](tickets/known-issues.md)      |
| KI-102 | Open — import periodik tidak mengejar riwayat akun baru (watermark null) dan hasil terpotong 100 post; post TikTok 7 Okt hilang (2026-10-23) | [T-143](tickets/known-issues.md)      |

KI yang tiketnya sudah selesai dikeluarkan dari daftar ini pada 2026-10-16 (ADR-132): KI-044 (T-108), KI-046 (T-007.7), KI-049 dan KI-063 (T-107), KI-058 (T-109), KI-086 (ADR-127), KI-088 (T-090), KI-090 (T-113). Pada 2026-10-19: KI-027 (T-008), KI-033 (T-120), KI-050 (T-121), KI-089 (T-123), KI-091 (T-124). Pada 2026-10-21: KI-098 (T-138, Resolved — fix escape HTML diimplementasikan + review + QA PASS). Pada 2026-10-22: KI-097 (T-137, Resolved — adapter SMTP staging selesai, env Railway staging diisi King Rezi & verifikasi e2e PASS); KI-094 (T-134, Resolved — verifikasi E2E disconnect→recompute PASS dengan akun real, YouTube `@cookitrealgood` sengaja dibiarkan disconnected); KI-095 (T-135, Resolved — verifikasi window kalender bulan PASS via query SQL dengan akun real).

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

- **T-017 ✅ Done — RLS SQL policies, adopsi `withCurrentUser` tuntas (2026-10-22)** — audit menyeluruh seluruh repository terhadap 16 tabel RLS-protected menemukan satu gap nyata: `analyticsRepository.findMetricsByPost` query langsung tanpa `withCurrentUser`. Fix: tambah parameter opsional `actingUserId` (interface, implementasi, `AnalyticsService.getPostMetrics`), backward-compatible. Repository lain terverifikasi lengkap tanpa gap. `tsc --noEmit` bersih, full suite 914 passed/6 skipped (6 kegagalan integration test Supabase pre-existing, tidak terkait). Detail: `tickets/v01-foundation.md` § T-017.
- **T-137 ✅ Done — adapter SMTP sementara email staging (2026-10-22, KI-097, ADR-137)** — `createSmtpAuthEmailSender`/`createSmtpInviteEmailSender` (nodemailer) sebagai sibling adapter Resend; factory `getAuthEmailSender()`/`getInviteEmailSender()` memilih provider lewat env `EMAIL_PROVIDER`. Review Ridwan bersih, QA Najwa PASS (17 test). King Rezi mengisi env Railway staging dan mengonfirmasi verifikasi e2e (undangan/kode accept-invite terkirim ke email selain `rezi@insvire.com`) PASS. Detail: `tickets/known-issues.md` § T-137.
- **T-134 ✅ Done — disconnect akun memicu recompute snapshot, verifikasi E2E PASS (2026-10-22, KI-094)** — diverifikasi dengan akun real "Cook It Real Good": disconnect YouTube `@cookitrealgood` otomatis meng-enqueue job `analytics.sync` (tanpa trigger manual), snapshot ter-upsert ulang dengan data segar setelah job diproses. Akun YouTube sengaja dibiarkan disconnected (keputusan operasional King Rezi, butuh OAuth Google ulang untuk reconnect). Detail: `tickets/known-issues.md` § T-134.
- **T-135 ✅ Done — window "bulanan" jadi kalender bulan, verifikasi PASS (2026-10-22, KI-095)** — diverifikasi via query SQL langsung ke `analytics_workspace_snapshots` dengan akun real: `period_start`/`period_end` persis kalender bulan (tanggal 1 s.d. hari ini), bukan lagi rolling 30 hari. Detail: `tickets/known-issues.md` § T-135.
- **T-140 ✅ Done — fix infinite redirect loop `/` ↔ `/login` session cookie stale (2026-10-22, KI-100)** — root cause: `proxy.ts` hanya mengecek keberadaan cookie session, bukan validitasnya, sehingga cookie stale (session sudah invalid di DB) tidak pernah dihapus dan memicu bounce `/` ↔ `/login` tanpa akhir. Fix: helper baru `getSessionCookieName()` (resolve nama cookie dari `auth.options`, bukan hardcode) dipakai untuk menghapus cookie session saat validasi penuh gagal, di `proxy.ts` dan `onboarding/resume/route.ts`. Test regresi baru ditambahkan, full suite 919 passed/0 fail. Detail: `tickets/known-issues.md` § T-140.
  Berikut 5 item terakhir yang diselesaikan. Tiket lengkapnya ada di `tickets/`. Riwayat sesi ada di git.

---

## Recent Decisions (Ringkasan)

5 ADR terakhir. Daftar lengkap (indeks + link ke tiap ADR): lihat `DECISIONS.md`.

- **ADR-136** — `totalPosts` Home pindah dari Outstand `posts_count` (tidak didukung untuk Facebook Page) ke status internal `PublishingPost`; window "bulanan" pindah dari rolling 30 hari ke kalender bulan; granularitas Home vs Analyze diterima berbeda; opsi Outstand `DELETE` saat disconnect ditolak (merusak reaktivasi ADR-127). Menutup substansi T-130/T-134/T-135/T-136 (KI-093/094/095/096) — verifikasi E2E browser masih tertunda.
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
