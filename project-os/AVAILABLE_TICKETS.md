# AVAILABLE_TICKETS

Antrian tiket yang belum selesai. ADR-131, ADR-132.

Mencari kerja tersedia berhenti di file ini. Tiket ✅ dan ⏸️ ada di `tickets/vXX-*.md`. Tiket yang lahir dari Known Issue ada di `tickets/known-issues.md` (ADR-134). Buka file itu hanya setelah ID-nya dipilih, dan hanya section tiket itu.

Perubahan kode di `apps/` dan `packages/` wajib punya tiket di sini, di file rilis, atau di `tickets/known-issues.md`. Deskripsi: docs → spec → tiket → implement. Bentuknya di [`specs/README.md`](specs/README.md).

---

## Cara pakai

1. Pilih satu ID dari tabel di bawah.
2. Buka **satu** file yang disebut kolom File, lompat ke heading tiket itu. Tiket rilis ada di `tickets/vXX-*.md`. Tiket yang lahir dari Known Issue ada di `tickets/known-issues.md` (ADR-134). Ikuti field **Docs** / **Baca dulu**. Jangan menyapu folder `tickets/`.
3. Kalau pekerjaannya melewati beberapa sesi dan belum ada spec, tulis `specs/S-NNN.md` dulu. Spec pertama adalah **S-001**.
4. Selesai: status ✅ di file tiketnya, barisnya dihapus dari tabel ini. Jangan menambah catatan sesi.

Phase dan blocker ada di [`PROJECT_STATE.md`](PROJECT_STATE.md). Known Issue yang masih terbuka punya baris di tabel KI file itu, dan tiketnya ada di sini.

| Simbol | Arti                                              |
| ------ | ------------------------------------------------- |
| ⏳     | Belum dimulai                                     |
| 🟡     | Sedang dikerjakan                                 |
| 🚫     | Terhenti, menunggu King Rezi atau dependency luar |

ID tiket global, tidak didaur ulang. Berikutnya: **T-142**. ID spec berikutnya: **S-001**.

---

## Sekarang

| ID    | Status | Judul                                                                                                                                                                          | File                                  |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| T-037 | 🟡     | Perkaya aturan coding di `context/ctx-development.md`                                                                                                                          | [v0.2](tickets/v02-publishing-mvp.md) |
| T-115 | 🟡     | Wiring cron harian Import Posts. Sisa: post native Facebook                                                                                                                    | [v0.2](tickets/v02-publishing-mvp.md) |
| T-013 | 🟡     | Connect account. Sisa: T-013.4 BYOK X                                                                                                                                          | [v0.1](tickets/v01-foundation.md)     |
| T-119 | 🚫     | Isi env Google OAuth. KI-015. King Rezi yang mengisi rahasianya                                                                                                                | [KI](tickets/known-issues.md)         |
| T-122 | ⏳     | Buktikan E2E invite Copy Link, email A vs email B. KI-053                                                                                                                      | [KI](tickets/known-issues.md)         |
| T-133 | 🟡     | Backfill retroaktif Import Posts lama — T-133.2/.3 dieksekusi 2026-10-23 (Facebook 184, Instagram 182 post). Sisa T-133.4 cek visual browser; Pinterest keterbatasan eksplisit | [v0.2](tickets/v02-publishing-mvp.md) |

T-037 prioritas rendah dan tidak memblokir rilis. T-115 masih 🟡: job import dan watermark sudah terbukti di staging; sisa T-115.5 adalah post native Facebook yang muncul di Postific. T-124 selesai 2026-10-19 (error kolom void, KI-091). T-116 → T-117 → T-118 (token-agent) selesai 2026-10-16, lihat `tickets/v01-foundation.md`. T-131 dan T-132 selesai 2026-10-20 (revisi scope Import Posts dari King Rezi; T-132 klasifikasi `ContentFormat` via Outstand Analytics, ADR-135). **T-130, T-134, T-135, T-136 (🔴 prioritas tinggi)** lahir dari satu investigasi ketidaksesuaian data Supabase vs Outstand yang sama — implementasinya tuntas 2026-10-21 (review Ridwan PASS, QA Najwa PASS, ADR-136). Akun test real "Cook It Real Good" tersedia 2026-10-22: **T-134 dan T-135 ✅ Done**. 2026-10-23: **T-130, T-136, T-139 ✅ Done** (Home menampilkan 12 post Oktober sesuai DB; import Instagram 182 post tersimpan lewat chunk per transaksi) dan bug baru **T-141 ✅ Done** (pagination `GET /v1/posts`, limit maks 100). Blocker T-133 terbuka: statusnya **Sebagian siap**, eksekusi script `--execute` menunggu konfirmasi eksplisit King Rezi. TikTok terbukti didukung Import (100 post real); Pinterest tetap tanpa akun test. **T-140 ✅ Done** (2026-10-22, KI-100) — bug produksi infinite redirect loop `/` ↔ `/login` saat session cookie stale/invalid di `proxy.ts`, ditemukan King Rezi saat `bun dev` lokal, diperbaiki sesi yang sama (hapus cookie session stale sebelum redirect, lihat `tickets/known-issues.md`).

---

## Belum masuk antrian dekat

Masih ⏳, dikerjakan saat rilisnya aktif. Detail di file masing-masing.

| Rilis | ID                                      | File                                   |
| ----- | --------------------------------------- | -------------------------------------- |
| v0.4  | T-055 Inbox assignment                  | [v04](tickets/v04-engagement-mvp.md)   |
| v0.5  | T-060 – T-065                           | [v05](tickets/v05-ai-assistant-mvp.md) |
| v0.6  | T-070 – T-074                           | [v06](tickets/v06-start-page-mvp.md)   |
| v1.0  | T-080 – T-088, termasuk KI-028 di T-088 | [v10](tickets/v10-public-launch.md)    |

v0.3 dan v0.7 tidak punya tiket terbuka.

---

## Keputusan yang masih menunggu

| Tiket | Yang belum diputuskan             | Menghambat       |
| ----- | --------------------------------- | ---------------- |
| T-060 | Provider dan model AI             | Seluruh v0.5     |
| T-081 | Framework E2E                     | Golden path v1.0 |
| T-086 | Tool observability                | Visibilitas job  |
| —     | Billing belum masuk rilis manapun | Belum ada tiket  |

---

## Di mana tiket selesai

| Rilis | File                                                                             |
| ----- | -------------------------------------------------------------------------------- |
| v0.1  | [tickets/v01-foundation.md](tickets/v01-foundation.md)                           |
| v0.2  | [tickets/v02-publishing-mvp.md](tickets/v02-publishing-mvp.md)                   |
| v0.3  | [tickets/v03-analytics-mvp.md](tickets/v03-analytics-mvp.md)                     |
| v0.4  | [tickets/v04-engagement-mvp.md](tickets/v04-engagement-mvp.md)                   |
| v0.5  | [tickets/v05-ai-assistant-mvp.md](tickets/v05-ai-assistant-mvp.md)               |
| v0.6  | [tickets/v06-start-page-mvp.md](tickets/v06-start-page-mvp.md)                   |
| v0.7  | [tickets/v07-astryx-shadcn-migration.md](tickets/v07-astryx-shadcn-migration.md) |
| v1.0  | [tickets/v10-public-launch.md](tickets/v10-public-launch.md)                     |
| KI    | [tickets/known-issues.md](tickets/known-issues.md)                               |

T-018 (⏸️) ada di v0.1. Bukan antrian. Tiket yang lahir dari Known Issue ada di file KI, bukan di file rilis (ADR-134).
