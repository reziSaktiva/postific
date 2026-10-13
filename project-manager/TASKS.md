# TASKS — Backlog Berjenjang

Rencana pengerjaan project dari fondasi sampai Public Launch, dikelompokkan per **release** dan dipecah jadi **task → subtask**.

Dokumen ini adalah **indeks**. Detail task ada di `tasks/`.

---

## Cara pakai (AI — baca ini dulu)

1. Baca **indeks di halaman ini** untuk tahu release aktif dan ID task yang relevan.
2. Buka **hanya satu file** `tasks/vXX-*.md` yang memuat task itu. Jangan menyapu seluruh folder `tasks/`.
3. Buka dokumen yang disebut di field **Baca dulu** pada task tersebut — itu daftar bacaan minimal yang sudah dikurasi, jadi tidak perlu menebak atau menyisir `product-discovery/`.
4. **Kalau task ini scope implementasi kode:** cek field **Domain** terhadap pemetaan Domain → Subagent di [`.claude/agents/README.md`](../.claude/agents/README.md) sebelum eksekusi — evaluasi delegasi, termasuk kemungkinan menjalankan beberapa subagent paralel kalau ada task/subtask independen (ADR-063). Jangan default mengerjakan sendiri tanpa mengevaluasi ini.
5. Setelah task selesai: ubah status di file release **dan** perbarui hitungan di indeks ini.

Untuk mode percakapan aktif, Known Issues, dan Blockers → tetap ke [`PROJECT_STATE.md`](PROJECT_STATE.md).

**Peta release ↔ milestone.** Backlog memakai release `v0.x`, `PROJECT_STATE.md` memakai milestone `M0–M9`. Pemetaannya:

| Milestone                | Release yang membentuknya | Status milestone |
| ------------------------ | ------------------------- | ---------------- |
| **M8** — Development     | v0.1 · v0.2 · v0.3 · v0.4 · v0.5 · v0.6 · v0.7 | aktif sekarang |
| **M9** — Testing & Release | v1.0                    | belum mulai      |

Ini penting untuk aturan `PROJECT_RULES.md` "Hindari implementasi fitur di luar ruang lingkup milestone" dan `Active Conversation Mode` yang hanya mengizinkan "Feature Implementation (M8)": **seluruh v0.1–v0.6 berada di dalam M8**, jadi task di rilis manapun dari v0.1 sampai v0.6 tidak melanggar scope milestone aktif. Yang di luar M8 hanya v1.0 (M9). Urutan pengerjaan tetap diatur oleh indeks release + `Depends`, bukan oleh milestone.

---

## Legend status

| Simbol | Arti           | Keterangan                                                        |
| ------ | -------------- | ----------------------------------------------------------------- |
| ⏳      | Not Started    | Belum disentuh.                                                   |
| 🟡      | In Progress    | Sudah dimulai, sebagian subtask selesai.                          |
| ✅      | Done           | Selesai dan terverifikasi (lolos QA/review bila fitur berdampak). |
| 🚫      | Blocked        | Tidak bisa jalan karena dependency eksternal. Alasan wajib ditulis di field **Blocker**. |
| ⏸️      | Deferred       | Sengaja ditunda ke release lain. Alasan wajib ditulis.            |

---

## Aturan ID

* **Task:** `T-001` … `T-089`, nomor global berurutan. ID **tidak** memuat kode release, supaya task bisa berpindah antar release tanpa penomoran ulang dan tanpa membuat referensi lama jadi salah.
* **Subtask:** `T-021.4` — nomor task diikuti nomor urut subtask.
* ID **tidak pernah didaur ulang**. Task yang dibatalkan ditandai `⏸️ Deferred` beserta alasannya, bukan dihapus.
* Setiap release menyisakan beberapa nomor kosong di akhir sebagai ruang tumbuh (per 2026-09-28: **T-049** untuk v0.3 — T-046/T-047/T-048 sudah terpakai; T-057–T-059 untuk v0.4 (T-056 terpakai 2026-10-06, promosi KI-065), T-066–T-069 untuk v0.5, T-075–T-079 untuk v0.6 — v0.1/v0.2 sudah habis, lihat catatan kaki ¹).

---

## Indeks release

| Release                    | Fokus                                              | Rentang ID  | Task | Status              | File                                                 |
| -------------------------- | -------------------------------------------------- | ----------- | ---- | ------------------- | ---------------------------------------------------- |
| **v0.1** Foundation        | Setup, Auth, Workspace, Connect Account, Settings  | T-001–T-019, T-039¹, T-089¹, T-093¹, T-094¹, T-109¹, T-110¹ | 25   | 19 ✅ · 1 🚫 · 4 🟡 · 1 ⏸️ | [tasks/v01-foundation.md](tasks/v01-foundation.md)         |
| **v0.2** Publishing MVP    | Draft, Format, Schedule, Queue, Calendar, History  | T-020–T-038, T-090¹–T-092¹, T-104¹, T-106¹–T-108¹, T-111¹–T-112¹ | 28   | 25 ✅ · 2 🟡 · 1 ⏳ | [tasks/v02-publishing-mvp.md](tasks/v02-publishing-mvp.md) |
| **v0.3** Analytics MVP     | Dashboard, Metrics, Engagement Summary, Reports    | T-040–T-048 | 9    | 8 ✅ · 1 🟡          | [tasks/v03-analytics-mvp.md](tasks/v03-analytics-mvp.md)   |
| **v0.4** Engagement MVP    | Comment sync 30 menit, Inbox, Reply                | T-050–T-056 | 7    | 6 ✅ · 1 ⏳ (Could Have) | [tasks/v04-engagement-mvp.md](tasks/v04-engagement-mvp.md) |
| **v0.5** AI Assistant MVP  | Caption generation, improvement, rewrite           | T-060–T-065 | 6    | ⏳ 0 / 6             | [tasks/v05-ai-assistant-mvp.md](tasks/v05-ai-assistant-mvp.md) |
| **v0.6** Start Page MVP    | Public profile, Link management, Theme             | T-070–T-074 | 5    | ⏳ 0 / 5             | [tasks/v06-start-page-mvp.md](tasks/v06-start-page-mvp.md) |
| **v1.0** Public Launch     | Stabilitas, Performance, Security, Docs            | T-080–T-088 | 9    | ⏳ 0 / 9             | [tasks/v10-public-launch.md](tasks/v10-public-launch.md)   |
| **v0.7** Migrasi Astryx → shadcn/ui | Cross-cutting: ganti fondasi UI component system (ADR-097) | T-095–T-103, T-105¹ | 10   | 10 ✅               | [tasks/v07-astryx-shadcn-migration.md](tasks/v07-astryx-shadcn-migration.md) |

**Total:** 99 task · 68 selesai · 263 subtask terdefinisi (v0.1–v0.3, v0.7).

> Riwayat perubahan indeks (kapan & kenapa tiap hitungan/status berubah) dicatat lengkap di `COMPLETE_TASK.md` — ⚠️ jangan dibaca AI kecuali diperintah eksplisit King Rezi. Status per-task terkini: lihat tabel di atas + `tasks/vXX-*.md`.

¹ **T-039** ID-nya dipinjam dari rentang v0.2 (bukan urutan lanjutan v0.1) — nomor kosong v0.1 sudah habis, jadi diambil ID global berikutnya yang belum pernah dipakai. Lihat Catatan Rilis di `tasks/v01-foundation.md` dan `tasks/v02-publishing-mvp.md` untuk detailnya. **T-089** (Workspace Switcher, ADR-088) memakai pola serupa — ID global berikutnya yang belum pernah dipakai sama sekali (rentang v1.0 T-080–T-088 sudah habis terisi), ditempatkan di file v0.1 karena lahir sebagai amandemen ADR-076/T-039. Detail: Catatan Rilis `tasks/v01-foundation.md`. **T-090**/**T-091** (Import Posts + read-only enforcement, ADR-093) memakai pola yang sama lagi — nomor kosong v0.2 (T-020–T-038) sudah habis, jadi keduanya memakai ID global berikutnya yang belum pernah dipakai. **T-092** (Realtime Calendar/Queue/Drafts/History, ADR-094) memakai pola yang sama sekali lagi, ID global berikutnya setelah T-091. **T-093** (Accept Invite page) memakai pola yang sama untuk v0.1 — nomor kosong v0.1 sudah habis sejak T-039/T-089, jadi memakai ID global berikutnya setelah T-092, ditempatkan di `tasks/v01-foundation.md` karena domain `workspace`/invite. **T-094** (Baseline Rendering Strategy, Code Conventions, Spacing Scale + ESLint Enforcement, ADR-095) memakai pola yang sama sekali lagi — ID global berikutnya setelah T-093, ditempatkan di `tasks/v01-foundation.md` sibling T-001/T-002 karena domain `platform/tooling`. **T-104** (Konsistensi kriteria status Drafts, gap ditemukan saat T-092.5) memakai pola yang sama sekali lagi — nomor kosong v0.2 sudah habis, ID global berikutnya setelah T-103 (rentang v0.7), ditempatkan di `tasks/v02-publishing-mvp.md` karena domain `publishing`, terkait langsung T-092. **T-105** (Migrasi sidebar workspace/settings ke primitive `Sidebar` shadcn/ui, KI-066) memakai pola yang sama sekali lagi — nomor kosong v0.7 (T-095–T-103) sudah habis, ID global berikutnya setelah T-104, ditempatkan kembali di `tasks/v07-astryx-shadcn-migration.md` karena domain `UI`, lahir sebagai kelanjutan langsung T-102 (ADR-097). **T-106** (Hapus `FakeOutstandAdapter`, 2026-09-25) memakai ID global berikutnya setelah T-105, ditempatkan di `tasks/v02-publishing-mvp.md` karena domain `integration`. **T-107**/**T-108** (promosi Known Issues KI-049/KI-063/KI-044, audit aplikasi 2026-09-28) memakai ID global berikutnya setelah T-106, ditempatkan di `tasks/v02-publishing-mvp.md` karena domain `publishing`. **T-109**/**T-110** (promosi Known Issues KI-058/KI-053, audit aplikasi 2026-09-28) memakai ID global berikutnya setelah T-108, ditempatkan di `tasks/v01-foundation.md` karena domain `workspace`/`identity`. **T-111** (promosi KI-083, follow-up King Rezi 2026-10-06 atas hasil KI-082) memakai ID global berikutnya setelah T-110, ditempatkan di `tasks/v02-publishing-mvp.md` — domain utamanya `publishing` (History Detail, T-111.1/.2) meski 2 subtask lain (T-111.3/.4) domain `engagement` (Post asal Engage), karena kedua lokasi berasal dari gap yang sama (KI-082/KI-083). **T-112** (wiring `importPosts`/`fetchImportJobStatus` ke endpoint Outstand sungguhan, ditemukan King Rezi 2026-10-08 saat testing manual "Sync Now") memakai ID global berikutnya setelah T-111, ditempatkan di `tasks/v02-publishing-mvp.md` tepat setelah § T-090 karena merupakan kelanjutan langsung task itu — domain `integration` (pola sama T-025/T-106), bukan `publishing`, karena murni soal wiring HTTP client ke Outstand, bukan logic domain. Detail: Catatan Rilis di masing-masing file release.

Urutan release mengikuti [`release-roadmap.md`](../product-discovery/02-product/release-roadmap.md). Perubahan urutan atau ruang lingkup release wajib lewat ADR.

> ⚠️ **v0.1 dan v0.2 tidak sepenuhnya sekuensial.** Tiga task v0.1 (T-013, T-015, T-016) punya subtask yang bergantung pada task v0.2 (T-025, T-026, T-036 + domain publishing), jadi v0.1 tidak bisa ditutup sebelum v0.2 berjalan. T-012 sudah ✅ Done (2026-08-12), tidak lagi bagian dari daftar ini. Rinciannya di Catatan Rilis [`tasks/v01-foundation.md`](tasks/v01-foundation.md).

---

## Kedalaman perencanaan (rolling wave)

| Release       | Kedalaman                                                                    |
| ------------- | ---------------------------------------------------------------------------- |
| v0.1 – v0.3   | **Detail penuh** — task + subtask siap dikerjakan.                            |
| v0.4 – v1.0   | **Task-level saja** — ID dan cakupan sudah dikunci, subtask sengaja belum diisi. |

Subtask untuk v0.4 ke atas diisi saat release-nya mendekat. Alasannya: menyusunnya sekarang berarti menebak detail teknis tanpa desain atau ADR pendukung — hasilnya hampir pasti direvisi, dan backlog yang isinya banyak tebakan lebih berbahaya daripada backlog yang jujur mengatakan "belum dirinci".

---

## Fokus sekarang

**Ini satu-satunya daftar fokus.** `PROJECT_STATE.md` hanya menyalin ID-nya di Snapshot dan menunjuk ke sini — jangan menulis daftar fokus versi ketiga di manapun. Kalau daftar ini berubah, perbarui juga baris `Top Next Tasks` di Snapshot `PROJECT_STATE.md` (hanya ID + judul singkat).

**Fokus aktif:** **T-048** Wire JOB-04 Analytics Sync (🟡 In Progress, T-048.1–T-048.3 selesai di kode, T-048.4 verifikasi staging belum) — lihat `tasks/v03-analytics-mvp.md` § T-048. **T-037** Perkaya aturan coding di `context/ctx-development.md` tetap 🟡 In Progress (kontinu by design, prioritas rendah, tidak memblokir rilis) — lihat `tasks/v02-publishing-mvp.md` § T-037.

**Selesai baru-baru ini** (detail lengkap per task: `tasks/vXX-*.md`; riwayat penuh: `COMPLETE_TASK.md` — ⚠️ jangan dibaca AI kecuali diperintah eksplisit King Rezi): **T-112 ✅** Wiring `importPosts`/`fetchImportJobStatus` ke endpoint Outstand sungguhan, tuntas 5/5 subtask termasuk polling fix + verifikasi end-to-end (2026-10-09, ADR-123) · **T-090 ✅** Import Posts dari Social Account, status `Imported` read-only, tuntas 5/5 subtask (2026-10-08, ADR-093) · **T-111 ✅** Restrukturisasi layout preview media post asli, History Detail & Post asal Engage, tuntas 8/8 subtask (2026-10-07, promosi KI-083) · **T-056 ✅** Preview post asli (caption+thumbnail+link) di kotak "Post asal" Comments Inbox (2026-10-06, promosi KI-065, PR #143) · **T-107**/**T-108**/**T-109 ✅** Isi `publishedAt`/`failedAt`/`failureReason`, validasi Schedule waktu lewat, RBAC UI Creator Connected Accounts (2026-09-28, promosi KI-049/KI-063/KI-044/KI-058) · **T-106 ✅** Hapus FakeOutstandAdapter + sisa data Fake/mock (2026-09-25, ADR-119, T-106.5) · T-025 KI-072 Pinterest `board_id` selesai via ADR-118 (2026-09-25, status tetap ✅ Done) · T-025 hardening code-review PR #133 (2026-09-25) · T-025 Real OutstandAdapter, tuntas 7/7 subtask (2026-09-24, KI-070/KI-003 Resolved) · T-050, T-051, T-052, T-053, T-054 (v0.4 Engagement MVP, 2026-09-22) · T-044, T-045 (v0.3 Analytics MVP tuntas 8/8, 2026-09-21) · T-043 (2026-09-18) · T-027 (2026-09-17) · T-024 (2026-09-14).

---

## Keputusan terbuka

Task yang **menghasilkan ADR**, bukan sekadar mengikuti ADR. Semuanya menunggu keputusan King Rezi:

| Task      | Keputusan yang belum diambil                              | Menghambat                     |
| --------- | --------------------------------------------------------- | ------------------------------ |
| **T-005** | Transactional email provider (AS-D04)                     | Email verification; invite member T-007.7 (jalur "Kirim via Email") — T-007.1 "Copy Link" (ADR-080) tidak terhambat |
| **T-060** | Provider + model AI                                       | Seluruh v0.5                   |
| **T-070** | Strategi route publik tanpa auth (+ custom domain?)       | Seluruh v0.6                   |
| **T-081** | Framework E2E test                                        | Verifikasi golden path         |
| **T-086** | Tool observability / monitoring                           | Visibilitas kegagalan job      |
| —         | **Billing** belum muncul di release manapun               | Belum masuk backlog sama sekali |

---

## Aturan maintenance

* **Status task hidup di sini dan di `tasks/*.md`** — pengecualian resmi terhadap aturan "status hanya di `PROJECT_STATE.md`" (ADR-062). Yang tetap eksklusif milik `PROJECT_STATE.md`: phase, milestone (M0–M9), overall progress, Active Conversation Mode, Known Issues, dan Blockers.
* Hitungan di **Indeks release** dan **Total** adalah angka turunan. Saat status sebuah task berubah, perbarui file release **dan** baris indeksnya dalam perubahan yang sama — kalau tidak, angka di sini jadi bohong.
* **Jangan** menyalin detail task ke `PROJECT_STATE.md`. `PROJECT_STATE.md` hanya menyebut **ID + judul singkat** dan menunjuk ke sini.
* Task baru ditambahkan memakai nomor kosong di release yang bersangkutan. Kalau nomor kosongnya habis, ambil nomor berikutnya yang belum pernah dipakai secara global — jangan menggeser ID yang sudah ada.
* Menambah/memindahkan **release** atau mengubah ruang lingkupnya → wajib ADR (`release-roadmap.md` adalah baseline).
* Task yang selesai tetap tinggal di file release-nya sebagai jejak ringkas (satu paragraf, tanpa checklist subtask). Riwayat lengkap per sesi kerja tetap di `COMPLETE_TASK.md`.

---

## Related Documents

* [PROJECT_STATE.md](PROJECT_STATE.md) — phase, milestone, Known Issues, Blockers
* [PROJECT_RULES.md](PROJECT_RULES.md) — klasifikasi dokumen & governance
* [DECISIONS.md](DECISIONS.md) — indeks ADR
* [../product-discovery/02-product/release-roadmap.md](../product-discovery/02-product/release-roadmap.md) — baseline urutan release
* [../product-discovery/02-product/mvp-definition.md](../product-discovery/02-product/mvp-definition.md) — batas MVP
* [../product-discovery/02-product/feature-priority.md](../product-discovery/02-product/feature-priority.md) — MoSCoW per fitur
