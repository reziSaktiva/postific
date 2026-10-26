# Product Discovery

Product Discovery adalah fase untuk memahami **apa yang akan dibangun, mengapa harus dibangun, dan bagaimana solusi tersebut memberikan nilai bagi pengguna**.

Pada fase ini **tidak ada implementasi kode**. Seluruh fokus diarahkan pada riset, perencanaan, dokumentasi, dan pengambilan keputusan agar proses pengembangan berjalan lebih cepat dan meminimalkan perubahan besar di kemudian hari.

---

# Objectives

Tujuan utama Product Discovery adalah:

* Memahami masalah yang ingin diselesaikan.
* Menentukan target pengguna.
* Mendefinisikan ruang lingkup produk (Product Scope).
* Menyusun prioritas fitur untuk MVP.
* Merancang pengalaman pengguna (UX).
* Menentukan arsitektur sistem yang sesuai.
* Mendokumentasikan seluruh keputusan teknis engineering sebelum implementasi.
* Menyediakan dokumentasi sebagai acuan implementasi.

---

# Workflow

Seluruh aktivitas Product Discovery mengikuti urutan berikut:

```text
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
```

Setiap tahap harus diselesaikan terlebih dahulu sebelum melanjutkan ke tahap berikutnya.

---

# Folder Structure

```text
product-discovery/
├── README.md
├── 01-business/
├── 02-product/
├── 03-user/
├── 04-ux/
├── 05-architecture/
└── 06-engineering/
```

Folder ringkasan operasional untuk tim designer (`design/`) sudah dihapus dan
**tidak akan dibuat ulang** — project ini tidak akan merekrut designer
eksternal, perannya digantikan permanen oleh King Rezi sendiri lewat artifact
desain Postific (ADR-140; sebelumnya ADR-045, ADR-057). Pointer artifact desain ada di
`../context/ctx-design.md`.

---

# Discovery Stages

## 01 — Business

Fokus pada tujuan bisnis dan arah produk.

Contoh pembahasan:

* Product Vision
* Problem Statement
* Business Goals
* Target Market
* Competitor Analysis
* Pricing Strategy
* Success Metrics

---

## 02 — Product

Fokus pada definisi produk.

Contoh pembahasan:

* Product Scope
* MVP Scope
* Feature List
* Feature Priority
* Functional Requirements
* Non-Functional Requirements
* Product Roadmap

---

## 03 — User

Fokus pada siapa yang menggunakan produk.

Contoh pembahasan:

* User Personas
* User Goals
* User Journey
* User Scenarios
* Pain Points
* Jobs To Be Done (JTBD)

---

## 04 — UX

Fokus pada pengalaman pengguna.

Contoh pembahasan:

* Information Architecture
* Navigation
* Dashboard Structure
* User Flow
* Wireframe Planning
* Design Principles

---

## 05 — Architecture

Fokus pada arsitektur sistem secara konseptual.

Contoh pembahasan:

* System Architecture
* Domain Design
* Bounded Context
* Module Structure
* Data Flow
* API Strategy (high-level)

---

## 06 — Engineering

Fokus pada keputusan teknis sebelum implementasi dimulai.

Contoh pembahasan:

* Monorepo & Workspace Setup
* Deployment Platform & Infrastructure
* Authentication Strategy
* ORM & Database Access Layer
* CI/CD Pipeline
* Environment Management
* Developer Experience (DX) Tooling
* Package & Dependency Strategy

---

# Documentation Rules

Selama fase Product Discovery:

* Setiap keputusan penting harus dicatat pada `../project-os/PROJECT_STATE.md` dan `../project-os/DECISIONS.md` sesuai kebutuhan.
* Hindari implementasi kode sebelum dokumentasi utama selesai.
* Semua perubahan harus melalui diskusi dan keputusan yang jelas.
* Dokumentasi menjadi sumber kebenaran (Source of Truth) sebelum implementasi dimulai.

---

# Exit Criteria

Fase Product Discovery dianggap selesai apabila:

* Business telah terdokumentasi dan ditetapkan sebagai Baseline v1.0.
* Product Scope telah disepakati dan ditetapkan sebagai Baseline v1.0.
* Target User telah didefinisikan dan ditetapkan sebagai Baseline v1.0.
* UX telah dirancang dan ditetapkan sebagai Baseline v1.0 (ADR-013).
* System Architecture telah ditetapkan sebagai Baseline v1.0 (ADR-025).
* Engineering Planning telah ditetapkan sebagai Baseline v1.0 (ADR-036).
* Seluruh keputusan penting telah dicatat di `DECISIONS.md`.
* Dokumentasi siap menjadi acuan implementasi.

---

# Next Phase

Setelah seluruh Exit Criteria terpenuhi, project akan memasuki fase berikutnya:

**M7 — Repository & Bootstrap**

Pada fase tersebut akan dilakukan:

* Inisialisasi repository berdasarkan keputusan Hybrid Monorepo (ADR-001).
* Setup workspace dan tooling berdasarkan output Engineering Planning.
* Konfigurasi environment development, staging, dan production.
* Persiapan CI/CD pipeline.
* Persiapan implementasi fitur (M8 — Development).

---

# Related Documents

* `../project-os/README.md`
* `../project-os/PROJECT_OVERVIEW.md`
* `../project-os/PROJECT_RULES.md`
* `../project-os/PROJECT_STATE.md`
* `../project-os/DECISIONS.md`
* `../project-os/CHANGELOG.md`
