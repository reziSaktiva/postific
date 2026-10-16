# Project Manager

Folder ini merupakan **Project Operating System (Project OS)** untuk project **Postific**.

Folder ini didedikasikan untuk mendokumentasikan **cara kerja**: proses kolaborasi antara Developer dan AI Assistant, aturan project, status dan progress, keputusan penting, riwayat perubahan, serta log diskusi dan brainstorming.

Dokumentasi tentang **produk** yang dibangun (business, product, user, UX, architecture, engineering) **tidak** berada di folder ini, melainkan di `../product-discovery/`.

> **Source of Truth:**
>
> - `project-os/` — bagaimana project ini dikerjakan (proses, aturan, keputusan, status).
> - `../product-discovery/` — apa yang dibangun (pengetahuan produk).

---

# Purpose

Tujuan folder ini adalah untuk:

- Menjadi pusat dokumentasi proses kerja project.
- Mencatat seluruh keputusan penting beserta alasannya (ADR).
- Melacak status, milestone, dan progress project secara real-time.
- Menjaga riwayat perubahan (changelog) dan log percakapan penting antar sesi.
- Memudahkan kolaborasi antara Developer, AI Assistant, dan kontributor lain.
- Menjaga agar dokumentasi dan implementasi selalu sinkron.

---

# Scope

`project-os/` mencakup:

- Aturan dan prinsip kerja project.
- Ringkasan dan gambaran umum project.
- Status, milestone, dan progress terkini.
- Keputusan penting (ADR) beserta alasan dan alternatif yang dipertimbangkan.
- Riwayat perubahan dokumentasi maupun implementasi.
- Log diskusi dan bank ide dari sesi kerja bersama AI.

`project-os/` **tidak** mencakup:

- Dokumentasi detail business, product, user, UX, architecture, atau engineering — lihat `../product-discovery/README.md`.
- Implementasi kode.

Pengecualian: `ARCHITECTURE_OVERVIEW.md` adalah ringkasan visual high-level untuk orientasi dan blueprint Figma. Source of Truth arsitektur tetap di `../product-discovery/05-architecture/`.

---

# Folder Structure

```text
social-media-management/
├── project-os/          → cara kerja, keputusan, status (folder ini)
│   ├── README.md
│   ├── PROJECT_OVERVIEW.md
│   ├── ARCHITECTURE_OVERVIEW.md
│   ├── PROJECT_RULES.md
│   ├── PROJECT_STATE.md      → baca section "Snapshot" dulu untuk lookup cepat
│   ├── AVAILABLE_TICKETS.md    → antrian task yang belum selesai
│   ├── tickets/              → tiket per rilis, termasuk yang sudah selesai
│   ├── specs/                → spec untuk kerja multi-sesi
│   ├── DECISIONS.md          → indeks ringkas ADR (full text di decisions/)
│   ├── decisions/            → satu file per ADR (ADR-XXX-slug.md)
│   ├── DEVELOPER_WORKFLOW.md
│   ├── CONVERSATIONS.md
│   └── BRAINSTORM.md
└── product-discovery/        → pengetahuan produk (business s/d engineering)
    ├── README.md
    ├── 01-business/
    ├── 02-product/
    ├── 03-user/
    ├── 04-ux/
    ├── 05-architecture/
    └── 06-engineering/
```

---

# Core Documents

| File                       | Description                                                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROJECT_OVERVIEW.md`      | Ringkasan project secara keseluruhan.                                                                                                                     |
| `ARCHITECTURE_OVERVIEW.md` | High-level architecture untuk blueprint Figma (bukan SoT detail arsitektur).                                                                              |
| `PROJECT_RULES.md`         | Aturan dan prinsip kerja project.                                                                                                                         |
| `PROJECT_STATE.md`         | Phase, milestone, overall progress, Known Issues, dan Blockers. Section "Snapshot" di atas untuk lookup cepat tanpa baca penuh. Bukan tempat detail task. |
| `AVAILABLE_TICKETS.md`     | Antrian task yang belum selesai. Mencari kerja tersedia berhenti di sini (ADR-131).                                                                       |
| `tickets/`                 | Tiket per rilis, termasuk yang sudah selesai.                                                                                                             |
| `specs/`                   | Spec untuk kerja yang melewati lebih dari satu sesi. Bentuknya di `specs/README.md`.                                                                      |
| `DECISIONS.md`             | Indeks ringkas seluruh ADR (tabel + link); full text tiap ADR ada di `decisions/ADR-XXX-slug.md`.                                                         |
| `DEVELOPER_WORKFLOW.md`    | Alur kerja project & user flow inti sebagai diagram mermaid (visualisasi, bukan SoT).                                                                     |
| `CONVERSATIONS.md`         | Log percakapan penting antar sesi (diisi otomatis oleh AI).                                                                                               |
| `BRAINSTORM.md`            | Bank ide dari sesi brainstorming (diisi otomatis oleh AI).                                                                                                |

---

# Relasi dengan Product Discovery

```text
project-os/                 product-discovery/
─────────────────                ──────────────────
Bagaimana kita bekerja     ←→     Apa yang kita bangun
Proses, aturan, keputusan         Business, Product, User,
Status & progress                 UX, Architecture, Engineering
```

Setiap perubahan pada `product-discovery/` yang berdampak pada scope, arsitektur, atau arah project harus tercatat sebagai keputusan (ADR) di `DECISIONS.md`, dan progress-nya diperbarui pada `PROJECT_STATE.md`.

> Implementasi kode **selalu mengikuti dokumentasi**, bukan sebaliknya.

---

# Working Principles

- Documentation First
- Business First
- UX Driven
- Domain-Driven Design (DDD)
- Modular Monolith Architecture
- AI Friendly Development
- Maintainability over Complexity
- Scalability by Design

---

# Current Status

Untuk mengetahui status project terbaru, silakan lihat:

- `PROJECT_STATE.md`

Untuk melihat keputusan yang telah disepakati, lihat:

- `DECISIONS.md`

Untuk melihat dokumentasi produk, lihat:

- `../product-discovery/README.md`
