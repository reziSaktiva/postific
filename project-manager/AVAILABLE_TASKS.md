# AVAILABLE_TASKS

Antrian kerja yang belum selesai. ADR-131.

Mencari task tersedia berhenti di file ini. Task ✅ dan ⏸️ ada di `tasks/vXX-*.md` — buka file itu hanya setelah ID-nya dipilih, dan hanya section tiket itu.

Deskripsi: docs → spec → tiket → implement. Bentuknya di [`specs/README.md`](specs/README.md).

---

## Cara pakai

1. Pilih satu ID dari tabel di bawah.
2. Buka **satu** file rilis, lompat ke heading tiket itu. Ikuti field **Docs** / **Baca dulu**. Jangan menyapu folder `tasks/`.
3. Kalau pekerjaannya melewati beberapa sesi dan belum ada spec, tulis `specs/S-NNN.md` dulu. Spec pertama adalah **S-001**.
4. Selesai: status ✅ di file rilis, barisnya dihapus dari tabel ini. Jangan menambah catatan sesi.

Phase, Known Issues, dan blocker ada di [`PROJECT_STATE.md`](PROJECT_STATE.md).

| Simbol | Arti |
| --- | --- |
| ⏳ | Belum dimulai |
| 🟡 | Sedang dikerjakan |
| 🚫 | Terhenti dependency luar |

ID task global, tidak didaur ulang. Berikutnya: **T-119**. ID spec berikutnya: **S-001**.

---

## Sekarang

| ID | Status | Judul | File |
| --- | --- | --- | --- |
| T-037 | 🟡 | Perkaya aturan coding di `context/ctx-development.md` | [v0.2](tasks/v02-publishing-mvp.md) |
| T-116 | ⏳ | Ganti nama `AGENTS.md` vendor supaya tidak ikut setiap giliran | [v0.1](tasks/v01-foundation.md) |
| T-117 | ⏳ | Tipiskan `AGENTS.md` root. ADR dulu. Depends T-116 | [v0.1](tasks/v01-foundation.md) |
| T-118 | ⏳ | Higiene sesi agent. Depends T-117 | [v0.1](tasks/v01-foundation.md) |
| T-115 | ⏳ | Wiring cron harian Import Posts periodik | [v0.2](tasks/v02-publishing-mvp.md) |
| T-008 | 🟡 | Workspace Settings — General + Danger Zone. Menunggu satu item desain | [v0.1](tasks/v01-foundation.md) |
| T-013 | 🟡 | Connect account. Sisa: T-013.4 BYOK X | [v0.1](tasks/v01-foundation.md) |
| T-017 | 🟡 | RLS SQL policies. Sisa: adopsi `withCurrentUser` | [v0.1](tasks/v01-foundation.md) |

T-037 prioritas rendah dan tidak memblokir rilis. Urutan token-agent: T-116 → T-117 → T-118.

---

## Belum masuk antrian dekat

Masih ⏳, dikerjakan saat rilisnya aktif. Detail di file masing-masing.

| Rilis | ID | File |
| --- | --- | --- |
| v0.4 | T-055 Inbox assignment | [v04](tasks/v04-engagement-mvp.md) |
| v0.5 | T-060 – T-065 | [v05](tasks/v05-ai-assistant-mvp.md) |
| v0.6 | T-070 – T-074 | [v06](tasks/v06-start-page-mvp.md) |
| v1.0 | T-080 – T-088 | [v10](tasks/v10-public-launch.md) |

v0.3 dan v0.7 tidak punya task terbuka.

---

## Keputusan yang masih menunggu

| Task | Yang belum diputuskan | Menghambat |
| --- | --- | --- |
| T-117 | Belahan isi `AGENTS.md` root | T-117.2 dan T-118 |
| T-060 | Provider dan model AI | Seluruh v0.5 |
| T-081 | Framework E2E | Golden path v1.0 |
| T-086 | Tool observability | Visibilitas job |
| — | Billing belum masuk rilis manapun | Belum ada tiket |

---

## Di mana task selesai

| Rilis | File |
| --- | --- |
| v0.1 | [tasks/v01-foundation.md](tasks/v01-foundation.md) |
| v0.2 | [tasks/v02-publishing-mvp.md](tasks/v02-publishing-mvp.md) |
| v0.3 | [tasks/v03-analytics-mvp.md](tasks/v03-analytics-mvp.md) |
| v0.4 | [tasks/v04-engagement-mvp.md](tasks/v04-engagement-mvp.md) |
| v0.5 | [tasks/v05-ai-assistant-mvp.md](tasks/v05-ai-assistant-mvp.md) |
| v0.6 | [tasks/v06-start-page-mvp.md](tasks/v06-start-page-mvp.md) |
| v0.7 | [tasks/v07-astryx-shadcn-migration.md](tasks/v07-astryx-shadcn-migration.md) |
| v1.0 | [tasks/v10-public-launch.md](tasks/v10-public-launch.md) |

T-018 (⏸️) ada di v0.1. Bukan antrian.
