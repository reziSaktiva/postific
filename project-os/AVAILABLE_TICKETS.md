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

ID tiket global, tidak didaur ulang. Berikutnya: **T-125**. ID spec berikutnya: **S-001**.

---

## Sekarang

| ID    | Status | Judul                                                           | File                                  |
| ----- | ------ | --------------------------------------------------------------- | ------------------------------------- |
| T-037 | 🟡     | Perkaya aturan coding di `context/ctx-development.md`           | [v0.2](tickets/v02-publishing-mvp.md) |
| T-115 | 🟡     | Wiring cron harian Import Posts periodik                        | [v0.2](tickets/v02-publishing-mvp.md) |
| T-008 | 🟡     | Workspace Settings — General + Danger Zone. Termasuk KI-027     | [v0.1](tickets/v01-foundation.md)     |
| T-013 | 🟡     | Connect account. Sisa: T-013.4 BYOK X                           | [v0.1](tickets/v01-foundation.md)     |
| T-017 | 🟡     | RLS SQL policies. Sisa: adopsi `withCurrentUser`                | [v0.1](tickets/v01-foundation.md)     |
| T-119 | 🚫     | Isi env Google OAuth. KI-015. King Rezi yang mengisi rahasianya | [KI](tickets/known-issues.md)         |
| T-120 | 🚫     | Hapus dua workspace QA. KI-033. Tunggu konfirmasi King Rezi     | [KI](tickets/known-issues.md)         |
| T-122 | ⏳     | Buktikan E2E invite Copy Link, email A vs email B. KI-053       | [KI](tickets/known-issues.md)         |
| T-123 | 🚫     | Konfirmasi lebar sidebar. KI-089                                | [KI](tickets/known-issues.md)         |
| T-121 | 🚫     | Putuskan meta penulis di History. KI-050                        | [KI](tickets/known-issues.md)         |
| T-124 | 🟡     | Bug upstream Prisma adapter-pg (job konkuren). KI-091           | [KI](tickets/known-issues.md)         |

T-037 prioritas rendah dan tidak memblokir rilis. T-116 → T-117 → T-118 (token-agent) selesai 2026-10-16, lihat `tickets/v01-foundation.md`. T-124 🟡: retest lokal `?type=import` lulus setelah lock per `outstandPostId` pindah ke `$executeRaw` (kolom `void`). Belum hidup di staging.

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

| Tiket | Yang belum diputuskan              | Menghambat       |
| ----- | ---------------------------------- | ---------------- |
| T-060 | Provider dan model AI              | Seluruh v0.5     |
| T-081 | Framework E2E                      | Golden path v1.0 |
| T-086 | Tool observability                 | Visibilitas job  |
| T-121 | Apakah History menampilkan penulis | T-121            |
| T-123 | Lebar sidebar 18rem atau 260px     | T-123            |
| —     | Billing belum masuk rilis manapun  | Belum ada tiket  |

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
