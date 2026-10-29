# PROJECT STATE

## Snapshot

- **Phase / Milestone:** Phase 6 — Implementation · M8 — Development (Sprint 5) · Overall: M7 100%, M8 in progress
- **Active Mode:** Ready for Development — implementasi fitur produk sesuai Architecture & Engineering Baseline
- **Top Next Tasks:** **Rilis v0.6 Start Page MVP (T-070 sampai T-074) sudah ter-merge ke `staging` (PR #200; ADR-142, ADR-143, ADR-144) dan terverifikasi di staging (T-164 ✅, 2026-10-28)**; T-159, T-163, T-170 ✅. **T-166 ✅ dan T-167 ✅ (2026-10-29, PR 217; migrasi T-167.4 diterapkan ke staging dan terverifikasi).** Sisa tiket v0.6 terbuka hanya **T-171** (🟡: T-171.2 cek Safari asli ✅ ditutup 2026-10-29 dengan hasil iPhone Safari iOS 18, lainnya tidak diuji; sisa T-171.1 rasio view/klik menunggu trafik produksi) di `AVAILABLE_TICKETS.md`; temuan baru dari verifikasi itu: **KI-104 / T-177** (kedipan terang mode gelap, penyebab belum diselidiki). **QA E2E Playwright (ADR-149, spec S-002, tiket di v0.1):** T-172 ✅ (2026-10-29, PR 209 sudah di-merge ke `staging`); T-176 ✅ (2026-10-29, PR 210); T-173 ✅ dan T-174 ✅ (2026-10-29, PR 211; akun test, workspace E2E Sandbox, tes Start Page 8/8 di staging dan local); T-175 ✅ (workflow E2E staging terbukti jalan, run 40820128077 pada PR uji 213 yang ditutup tanpa merge, ADR-150; required check di `main` ditunda ke MVP public launch, **T-088.1, ADR-151: AI wajib mengingatkan King Rezi saat fase v1.0 / MVP public launch dimulai**). **T-037 Perkaya aturan coding** (🟡 In Progress, prioritas rendah). **T-115 Wiring cron harian Import Posts periodik** (🟡 In Progress — sisa T-115.5: post native Facebook muncul di Postific). T-128/T-129 selesai 2026-10-19 (default view Home/Analyze jadi Bulanan; Imported posts ikut dihitung di Analyze). Revisi scope Import Posts dari King Rezi (2026-10-20): **T-131 selesai** — beda request body cron/connect/manual. **T-132 selesai (2026-10-20, ADR-135)** — klasifikasi jenis konten Story/Reel/Post hasil Import via Outstand Analytics. **Batch T-130/T-134/T-135/T-136 (KI-093/094/095/096) — implementasi tuntas 2026-10-21 (ADR-136), verifikasi E2E dengan akun real 2026-10-22:** investigasi ketidaksesuaian data Supabase vs Outstand yang melahirkan 4 tiket ini sudah diperbaiki di sisi kode — `totalPosts` Home pindah dari Outstand `posts_count` (tidak didukung untuk Facebook Page) ke status internal `PublishingPost`; disconnect akun sekarang trigger recompute snapshot segera (tanpa panggilan Outstand, opsi `DELETE` ditolak King Rezi karena merusak reaktivasi ADR-127); window "bulanan" pindah ke kalender bulan; label "Post terpublikasi" otomatis akurat ikut fix T-130. Granularitas totalPosts Home vs Analyze boleh beda (keputusan final King Rezi, bukan gap). Review Ridwan PASS, QA Najwa PASS (898 test); snapshot 13 workspace sudah dibackfill manual. Akun test real "Cook It Real Good" (4 channel) dipakai untuk verifikasi E2E: **T-134 dan T-135 ✅ Done** (2026-10-22); **T-130, T-136 ✅ Done** (2026-10-23, Home menampilkan 12 post Oktober sesuai DB). Bug **T-139 (KI-099)** — timeout transaksi saat insert batch import besar — diperbaiki dengan chunk per transaksi (50 post) dan terverifikasi (182 post Instagram, 18,6 detik) ✅ Done; bug baru **T-141 (KI-101)** — `GET /v1/posts` limit maks 100 membuat import >100 post gagal HTTP 400 — diperbaiki dengan pagination ✅ Done. **T-133 ✅ Done (2026-10-23):** script T-133.2/.3 dieksekusi atas konfirmasi King Rezi (Facebook 184, Instagram 182 post, terklasifikasi), diverifikasi di Home/Analyze/History; TikTok terbukti didukung Import, Pinterest tetap keterbatasan eksplisit (tanpa akun test). T-124 selesai 2026-10-19 (KI-091, error kolom `void` hilang di retest staging). T-116 → T-117 → T-118 (biaya token agent) selesai 2026-10-16 (ADR-133). **T-137 (KI-097, ADR-137) — selesai 2026-10-22**, env Railway staging diisi King Rezi dan verifikasi e2e PASS. **T-140 (KI-100) — selesai 2026-10-22**: bug produksi infinite redirect loop `/` ↔ `/login` saat session cookie stale/invalid (`proxy.ts`), ditemukan King Rezi saat `bun dev` lokal, diperbaiki sesi yang sama (cookie session stale dihapus sebelum redirect ke `/login`) + test regresi ditambahkan (919 passed, 0 fail). **T-142 selesai (2026-10-23, PR 193)** — History memakai `publishedAt`, terverifikasi di browser. Tiket dari review PR 193 **selesai 2026-10-23 (PR 194):** **T-144** (zona waktu tampilan WIB) dan **T-145** (`occurred_at` generated column di DB) ✅ Done; **T-122 ✅ Done (2026-10-23, atas pernyataan King Rezi setelah uji manual; KI-053 tertutup)**; **T-146** (input jadwal draft editor ditafsirkan WIB) ✅ Done 2026-10-23 (atas pernyataan King Rezi setelah verifikasi browser); **T-148** (spike MCP) ✅ Done 2026-10-26 dan ADR-139 Accepted atas keputusan King Rezi; **T-149** (skema dan domain `mcp-access`) ✅ Done 2026-10-26, dengan tiga hal belum terverifikasi di Postgres yang dibawa ke T-150; **T-150** (v0.5) 🟡 In Progress: T-150.1–.6 selesai (review Ridwan lolos, QA Najwa PASS, kode belum di-commit), sisa T-150.7–.9 (Railway, refresh token, pembersihan klien) sesi berikutnya. **T-147** (zona waktu per pengguna, ADR-146) ✅ Done 2026-10-28 (migrasi diterapkan ke DB dev, diverifikasi King Rezi di browser, kode belum di-commit); tindak lanjut **T-168** (MCP mengikuti zona pengguna) ⏳ di v0.5. Antrian lengkap: [`AVAILABLE_TICKETS.md`](AVAILABLE_TICKETS.md).
- **Blocker:** 1 penghalang aktif — KI-015 (Google OAuth). Migrasi T-051 dan sisa follow-up KI-025 sudah diverifikasi tertutup di staging (2026-10-13). Detail di section **Blockers**.
- **Pivot v0.5 (2026-10-23, ADR-138, ADR-139 Accepted 2026-10-26):** AI Assistant bawaan diganti MCP Server — AI milik pengguna bekerja di Postific lewat MCP. Tiket **T-148–T-157** di [`tickets/v05-mcp-server-mvp.md`](tickets/v05-mcp-server-mvp.md); T-060–T-065 dibatalkan. Spike T-148 ✅ dan T-149 ✅ (2026-10-26); T-150 🟡 In Progress (2026-10-28): endpoint, 8 tool baca, hook consent permanen, uji SQL staging, review, dan QA selesai; sisa T-150.7–.9 (verifikasi Railway, refresh token, pembersihan klien).
- **Antrian task:** [`AVAILABLE_TICKETS.md`](AVAILABLE_TICKETS.md). Tiket, termasuk yang selesai, ada di `tickets/`. Jangan cari detail task di file ini.
- **KI-073–080 Resolved (2026-09-26)** — 4 bug publish Instagram (caption wajib untuk Story, Story publish tanpa media, upload media >1MB gagal, avatar akun tidak tampil di sidebar) diperbaiki + diverifikasi live ke akun Instagram/Facebook real (ADR-120). 2 bug turunan ditemukan saat verifikasi (akun `disconnected` tidak bisa reconnect; callback OAuth silent-success untuk conflict genuine) diperbaiki via **ADR-122**. Plus **KI-080** (baru+langsung Resolved) — Railway staging build gagal (`next.config.ts` tidak bisa resolve import workspace `@social/shared`) diperbaiki di branch terpisah sebelum masuk ke fix KI-078/079.
- Detail phase/mode/issue ada di section di bawah. Tiket selesai ada di `tickets/`. Keputusan ada di `DECISIONS.md`.

---

## Metadata

| Field        | Value      |
| ------------ | ---------- |
| Version      | 1.1.8      |
| Status       | Active     |
| Last Updated | 2026-10-29 |

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
co-equal dengan artifact desain (ADR-140, menggantikan ADR-056) — tidak ada lagi gerbang "designer
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

| KI     | Status                                                                                                                                                                                    | Tiket                                 |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| KI-015 | Sebagian Resolved — sisa: env Google OAuth belum diisi                                                                                                                                    | [T-119](tickets/known-issues.md)      |
| KI-028 | Open — environment production belum ada                                                                                                                                                   | [T-088](tickets/v10-public-launch.md) |
| KI-103 | Open — project Claude Design lama belum dilepas dan isinya belum diverifikasi (tenggat 2026-12-14)                                                                                        | [T-158](tickets/known-issues.md)      |
| KI-104 | Open — halaman dilukis terang dulu lalu memudar ke gelap untuk pengunjung mode gelap tanpa cookie `theme`; penyebab terbukti dan perbaikan ada di branch (belum ter-deploy), sisa T-177.4 | [T-177](tickets/known-issues.md)      |

KI yang tiketnya sudah selesai dikeluarkan dari daftar ini pada 2026-10-16 (ADR-132): KI-044 (T-108), KI-046 (T-007.7), KI-049 dan KI-063 (T-107), KI-058 (T-109), KI-086 (ADR-127), KI-088 (T-090), KI-090 (T-113). Pada 2026-10-19: KI-027 (T-008), KI-033 (T-120), KI-050 (T-121), KI-089 (T-123), KI-091 (T-124). Pada 2026-10-21: KI-098 (T-138, Resolved — fix escape HTML diimplementasikan + review + QA PASS). Pada 2026-10-22: KI-097 (T-137, Resolved — adapter SMTP staging selesai, env Railway staging diisi King Rezi & verifikasi e2e PASS); KI-094 (T-134, Resolved — verifikasi E2E disconnect→recompute PASS dengan akun real, YouTube `@cookitrealgood` sengaja dibiarkan disconnected); KI-095 (T-135, Resolved — verifikasi window kalender bulan PASS via query SQL dengan akun real). Pada 2026-10-23 (tiket Done): KI-084 (T-123, ikut KI-089), KI-092 (T-127), KI-093 (T-130), KI-096 (T-136), KI-099 (T-139), KI-100 (T-140), KI-101 (T-141). Pada 2026-10-23: KI-102 (T-143, Resolved atas pernyataan King Rezi; bukti siklus cron 2026-10-24 belum terlihat di DB saat dicek, buka ulang bila hasilnya berbeda). Pada 2026-10-23: KI-053 (T-122, Resolved atas pernyataan King Rezi setelah uji manual email A vs email B; tidak ada bukti otomatis yang diverifikasi).

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

- **T-172 ✅ Done — Playwright (Chrome) terpasang di `apps/web` (2026-10-29, ADR-149, spec S-002; PR 209)** — smoke test 2/2 lulus di local dan staging; `typecheck`, `lint`, dan tes unit hijau. Detail di `tickets/v01-foundation.md`.
- **T-070 sampai T-074 ✅ Done — Start Page MVP, rilis v0.6 (2026-10-28, PR #200, ter-merge ke `staging`; ADR-142, ADR-143, ADR-144)** — halaman publik `/u/[slug]` (Card Stack, tema preset `default`/`dark`/`accent`), Page Editor (tautan, reorder, Publish, Share, Profil dengan Simpan), analytics dasar (kunjungan dan klik) hanya di editor. Baca publik dan counter lewat fungsi `SECURITY DEFINER`. Review Ridwan PASS, QA Najwa PASS. CSP nonce `/u/*` (T-160), pembersihan artifact (T-161), dan perbaikan kecil counter/data (T-162.1-.3) ✅. **T-159 ✅** (2026-10-28, PR #203, ter-merge): foto profil diunggah ke bucket `avatars`, bukan tempel URL. Empat migrasi sudah di-apply dan diverifikasi di staging (T-164 ✅); detail di `tickets/v06-start-page-mvp.md`.
- **T-149 ✅ Done — skema dan domain `mcp-access` (2026-10-26, ADR-141)** — tabel `mcp_grants` dan `mcp_audit_logs` (RLS policy `app_runtime`) dimigrasi ke staging, tabel dan domain AI lama dihapus, `McpAccessService`, repository Prisma, dan JOB-08 `mcp.audit.purge` selesai (review Ridwan lolos, QA Najwa PASS). SQL repository dan JOB-08 belum diuji di Postgres staging; dibawa ke T-150. PR 201 (review 2026-10-28): 6 temuan diperbaiki, 3 dilewati atas keputusan King Rezi (rinci di T-149.8).
- **T-144 dan T-145 ✅ Done — tampilan Publish WIB dan `occurred_at` untuk urutan History (2026-10-23, PR 194)** — History/Calendar/Queue memakai Asia/Jakarta tetap (helper `wib-time.ts`); kolom `occurred_at` generated column + indeks `(workspace_id, occurred_at DESC)` menggantikan sort di JS. Diverifikasi lewat DB dan dev server lokal (bukan deploy Railway).
- **T-143 ✅ Done — import periodik mengejar riwayat akun baru (2026-10-23, KI-102, PR 192)** — watermark `null` memakai lookback 1 tahun dan limit 1000, hasil job tersimpan di `payload.result`. Ditutup atas pernyataan King Rezi; bukti siklus cron 2026-10-24 belum terlihat di DB saat dicek.
  Berikut 5 item terakhir yang diselesaikan. Tiket lengkapnya ada di `tickets/`. Riwayat sesi ada di git.

---

## Recent Decisions (Ringkasan)

ADR terbaru. Daftar lengkap (indeks + link ke tiap ADR): lihat `DECISIONS.md`.

- **ADR-149** — Playwright (Chrome) jadi standar QA E2E per tiket/spec di local dan staging; gerbang CI terhadap staging setelah deploy, hijau jadi syarat PR `staging` → `main` (PR `feature/*` → `staging` tidak diblokir E2E di CI). Mengamandemen CI-D02/CI-D06, menambah CI-D07. Spec S-002.
- **ADR-144** — Keputusan produk dan UI Start Page v0.6: tema preset terbatas (`default | dark | accent`, tanpa token baru), Page Editor (Dialog, tombol Simpan draft, avatar URL https), RBAC Owner/Admin/Creator, `UNIQUE(workspace_id)`, ikon platform hugeicons (deviasi dari ADR-058 poin 6).
- **ADR-143** — Counter kunjungan dan klik anonim Start Page lewat fungsi `SECURITY DEFINER` dan redirect klik 302, tanpa tabel event dan tanpa PII; memperluas ADR-142 ke jalur tulis. Tanpa dedup/rate limit.
- **ADR-142** — Baca publik Start Page lewat fungsi `SECURITY DEFINER` `start_page_get_public_by_slug`, bukan RLS policy anon (menggantikan teks T-070.5); sudah di-apply di staging (T-164).
- **ADR-141** — RLS tabel BC-04 MCP Access (`mcp_grants`, `mcp_audit_logs`): satu policy `app_runtime` per tabel, pengecualian DB-D05; isolasi workspace dan pengguna di application layer.

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
