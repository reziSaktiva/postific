# PROJECT RULES

## Metadata

| Field        | Value      |
| ------------ | ---------- |
| Version      | 0.3.1      |
| Status       | Active     |
| Last Updated | 2026-08-05 |

---

# Purpose

Dokumen ini berisi aturan, prinsip, dan standar yang harus diikuti selama proses perencanaan dan pengembangan project.

Seluruh anggota project (Developer, AI Assistant, Designer, dan kontributor lainnya) harus mengacu pada dokumen ini sebelum melakukan perubahan pada project, baik pada dokumentasi maupun implementasi kode.

---

# Scope

Dokumen ini mengatur:

* Prinsip dasar pengembangan project.
* Klasifikasi dan tata kelola dokumen.
* Aturan development dan arsitektur.
* Aturan kolaborasi dengan AI Assistant.
* Aturan pencatatan keputusan.
* Alur kerja (workflow) project secara keseluruhan.

Dokumen ini **tidak** mengatur:

* Status, progress, atau fase aktif project — lihat `PROJECT_STATE.md`.
* Detail keputusan teknis atau bisnis — lihat `DECISIONS.md`.
* Detail scope tiap fase discovery — lihat `README.md` pada masing-masing folder `../product-discovery/`.

---

# Core Principles

Project ini dikembangkan berdasarkan prinsip berikut:

* Documentation First
* Business First
* User-Centered Design
* Domain-Driven Design (DDD)
* Modular Monolith Architecture
* AI Friendly Development
* Simplicity over Premature Optimization
* Maintainability over Complexity
* Scalability by Design

---

# Documentation Governance

## Documentation Rules

* Semua keputusan penting harus didokumentasikan.
* Dokumentasi selalu menjadi acuan utama sebelum implementasi.
* Dokumentasi harus diperbarui jika terdapat perubahan pada requirement, arsitektur, atau workflow.
* Hindari dokumentasi yang duplikat atau saling bertentangan.

## Document Type Classification

Setiap dokumen dalam project memiliki tipe yang menentukan kapan dan bagaimana dokumen tersebut boleh diubah.

**Static Reference**

Dokumen yang mendeskripsikan struktur, tujuan, scope, dan aturan. Tidak boleh berisi informasi yang berubah-ubah (status, progress, fase aktif).

Hanya boleh diubah jika terjadi perubahan **struktural** — scope baru, dokumen baru, atau aturan baru — dan perubahan tersebut wajib dicatat di `COMPLETE_TASK.md`.

Termasuk:

* Semua `README.md`
* `PROJECT_OVERVIEW.md`
* `ARCHITECTURE_OVERVIEW.md`
* `PROJECT_RULES.md`
* Skill/navigator file (`SKILL.md`)
* Dokumen baseline yang sudah ditetapkan pada setiap fase `product-discovery/`
* Definisi subagent (`.claude/agents/*.md`, kecuali `.claude/agents/README.md`
  yang tetap README biasa) — perubahan hanya atas permintaan eksplisit user,
  bukan inisiatif AI (lihat `.claude/agents/README.md`)

**Living Document**

Dokumen yang secara aktif diperbarui setiap sesi — satu-satunya tipe dokumen yang boleh mencatat status dan progress.

Termasuk:

* `PROJECT_STATE.md` — source of truth untuk **phase, milestone (M0–M9), overall progress, Active Conversation Mode, Known Issues, dan Blockers**.
* `TASKS.md` + `tasks/vXX-*.md` — source of truth untuk **status per-task dan per-subtask** (ADR-062). Backlog berjenjang release → task → subtask.

Pembagiannya tegas: status *fase project* milik `PROJECT_STATE.md`, status *task* milik `TASKS.md`/`tasks/`. `PROJECT_STATE.md` hanya menyebut ID + judul singkat task dan menunjuk ke `TASKS.md` — detail task tidak diduplikasi.

**Append-Only**

Dokumen yang hanya bertambah. Entri lama tidak boleh diedit atau dihapus.

**Satu pengecualian eksplisit (ditemukan sebagai gap 2026-08-12, praktik ini sudah berjalan sejak ADR-056/057 sebelum dituliskan di sini):** kolom `Status` pada baris ADR lama di `DECISIONS.md` DAN header `### Status` di file `decisions/ADR-XXX.md` yang bersangkutan **boleh** diedit — tapi **hanya** untuk menambah/melengkapi tag `Accepted — Amended by ADR-YYY (tanggal)` ketika ADR baru mengamandemennya. Ini murni metadata cross-reference dua arah, bukan mengubah keputusan/isi ADR lama. Isi Decision/Reason/Alternatives Considered ADR lama tetap **tidak boleh diubah**. Kalau ADR baru menyatakan "mengamendemen ADR-XXX" di badan teksnya, baris ADR-XXX di `DECISIONS.md` dan header Status di file `decisions/ADR-XXX-*.md` **wajib** diperbarui pada saat yang sama (jangan tunda) — celah ini yang menyebabkan 14 ADR lama (ADR-005 dst.) sempat tidak ter-tag sampai diaudit dan dibackfill.

Termasuk:

* `DECISIONS.md` — **indeks ringkas** ADR (tabel ADR#/Title/Status/Date/Ringkasan/link file), satu baris baru per ADR baru. Bukan lagi tempat full-text ADR (lihat `decisions/`).
* `decisions/ADR-*.md` — satu file per ADR, isi lengkap (Title/Status/Date/Decision/Reason/Alternatives Considered). Entri lama tidak boleh diedit/dihapus (kecuali tag `Amended by` di header Status, lihat pengecualian di atas), sama seperti induknya.
* `COMPLETE_TASK.md` — riwayat lengkap seluruh task/perubahan sejak awal project, satu entri baru per sesi kerja (append di bagian atas). **Tidak boleh dibaca AI kecuali diperintahkan eksplisit oleh King Rezi** — lihat peringatan di kepala file. Menambah entri baru tetap wajib (operasi tulis, bukan baca).
* `CONVERSATIONS.md` — setiap sesi dicatat sebagai entri baru.
* `BRAINSTORM.md` — setiap ide baru dicatat sebagai entri baru.

## Formatting Rules

* README **tidak boleh** memuat status (✅ ⏳ 🟡), progress (%), atau fase aktif.
* Status folder, milestone, dan fase hanya boleh ditampilkan pada `PROJECT_STATE.md`.
* **Pengecualian tunggal (ADR-062):** status per-task dan per-subtask ditampilkan pada `TASKS.md` + `tasks/vXX-*.md`. Pengecualian ini **tidak** meluas ke phase, milestone, atau overall progress — ketiganya tetap eksklusif milik `PROJECT_STATE.md`, dan tetap terlarang di README maupun dokumen Static Reference lain.
* **Known Issues (ADR-066, amandemen ADR-067):** setiap entry di section `Known Issues` (`PROJECT_STATE.md`) wajib memakai ID global `KI-XXX` (namespace terpisah dari task `T-XXX`) + field table ringkas (`Status`, `Kategori`, `Terkait`, `Ditemukan` bila diketahui). ID tidak pernah didaur ulang. Entry berstatus `Promoted to T-XXX` tetap tercatat sampai task tujuannya selesai. **Entry berstatus `Resolved` dihapus dari `PROJECT_STATE.md` begitu riwayat penyelesaiannya sudah tercatat di `COMPLETE_TASK.md`** — jangan dibiarkan menumpuk dengan status `Resolved` di kedua tempat sekaligus.
* Setiap perubahan struktural pada dokumen Static Reference wajib dicatat pada `COMPLETE_TASK.md`.

## Guardrail Ukuran Dokumen (Living/Append-Only)

Supaya `PROJECT_STATE.md` tidak kembali membengkak, dicek sebagai bagian **Definition of Done** setiap milestone selesai:

* `PROJECT_STATE.md` section "Completed (Ringkasan)" dijaga **≤ 5 item** (rolling window item terbaru — aturan mengikat, lihat `AGENTS.md` § "Setelah mengubah sesuatu"); "Recent Decisions (Ringkasan)" dijaga ≤ ~10 item. Item yang tergeser keluar tetap utuh di `COMPLETE_TASK.md`/`DECISIONS.md` — tidak hilang, hanya tidak lagi tampil inline.
* `COMPLETE_TASK.md` sengaja **tidak** dirotasi/diarsipkan (satu file historis penuh, by design — lihat ADR-061) karena AI memang dilarang membacanya kecuali diperintah; ukurannya boleh terus tumbuh tanpa jadi beban token.
* `TASKS.md` dijaga tetap ringkas (indeks saja, target ≤ ~150 baris). Detail task **wajib** tinggal di `tasks/vXX-*.md`, dan AI hanya membuka file release yang sedang dikerjakan — bukan seluruh folder `tasks/` (ADR-062).
* Task berstatus `✅ Done` di `tasks/*.md` diringkas jadi satu paragraf jejak tanpa checklist subtask, supaya file release tidak tumbuh oleh pekerjaan yang sudah selesai. Riwayat lengkap per sesi tetap di `COMPLETE_TASK.md`.

---

# Development Rules

* Implementasi harus mengikuti dokumentasi yang telah disepakati.
* Jangan mengubah requirement tanpa pembaruan dokumentasi terkait.
* Setiap fitur dikembangkan berdasarkan milestone yang sedang aktif.
* Hindari implementasi fitur di luar ruang lingkup milestone.

---

# Architecture Rules

* Menggunakan Hybrid Monorepo.
* Menggunakan satu aplikasi utama (`apps/web`) pada fase awal.
* Menggunakan arsitektur Modular Monolith.
* Menggunakan Domain-Driven Design sebagai dasar pembagian domain.
* Setiap domain harus memiliki batas tanggung jawab (boundary) yang jelas.
* Shared package hanya digunakan untuk kebutuhan lintas domain atau lintas aplikasi.

---

# AI Collaboration Rules

Teks lengkap aturan kolaborasi dengan AI ada di **`../AGENTS.md`**: baca
dokumentasi dulu → section "Wajib di awal sesi"; tidak boleh ubah
arsitektur/business rules tanpa ADR → rule 4; jaga konsistensi struktur →
seluruh section "Aturan keras". Tidak disalin ulang di sini supaya tidak
drift saat salah satu diupdate. Aturan "patuh klasifikasi dokumen" tidak
perlu pointer keluar — itu section **Document Type Classification** di
bawah, di dokumen ini sendiri.

---

# Decision Rules

Perubahan berikut harus dicatat pada `DECISIONS.md`:

* Perubahan arsitektur
* Perubahan workflow
* Perubahan repository strategy
* Perubahan business requirement
* Penambahan domain atau fase baru
* Perubahan teknologi utama
* Keputusan penting lainnya yang memengaruhi arah project

---

# Project Workflow

```text
Idea
    ↓
Discovery
    ↓
Business
    ↓
Product
    ↓
User
    ↓
UX
    ↓
Architecture
    ↓
Engineering
    ↓
Repository & Bootstrap
    ↓
Implementation
    ↓
Testing
    ↓
Release
```

Status dan progress tiap tahap workflow ini mengacu pada milestone yang tercatat di `PROJECT_STATE.md`.

---

# Definition of Done

Sebuah milestone dianggap selesai apabila:

* Tujuan milestone telah tercapai.
* Dokumentasi telah diperbarui.
* Keputusan penting telah dicatat pada `DECISIONS.md`.
* Tidak terdapat blocker yang belum diselesaikan.
* `PROJECT_STATE.md` telah diperbarui.
* Status task di `TASKS.md` **dan** `tasks/vXX-*.md` telah diperbarui, dan hitungan di **Indeks release** + **Total** cocok dengan isi file release (ADR-062). Milestone tidak boleh dinyatakan selesai kalau backlog masih basi.
* Guardrail ukuran dokumen (lihat **Documentation Governance**) sudah dicek — rotasi ringkasan `PROJECT_STATE.md` kalau perlu.

---

# Related Documents

* `README.md`
* `PROJECT_OVERVIEW.md`
* `ARCHITECTURE_OVERVIEW.md`
* `PROJECT_STATE.md`
* `DECISIONS.md`
* `COMPLETE_TASK.md`
* `../product-discovery/README.md`
