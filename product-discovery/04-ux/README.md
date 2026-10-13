# 04 — UX

Dokumentasi pada folder ini berfokus pada **UX Planning** untuk produk **Postific**, mencakup prinsip desain, arsitektur informasi, user flows (solution-state), pola navigasi, dan pola layar utama.

Seluruh dokumentasi pada folder ini harus mengacu pada **Business Baseline v1.0**, **Product Baseline v1.0**, dan **User Discovery Baseline v1.0** yang telah disepakati. UX Planning berfungsi menerjemahkan insight pengguna menjadi keputusan desain yang dapat dijadikan acuan implementasi, tanpa masuk ke detail visual atau kode.

---

# Tujuan

* Menetapkan prinsip UX yang selaras dengan insight pengguna dan keputusan produk.
* Mendefinisikan arsitektur informasi: struktur navigasi dan hierarki layar.
* Menyusun user flows (solution flows) berdasarkan current-state journey.
* Mendokumentasikan pola layar utama untuk keputusan pengembangan.
* Menjaga konsistensi keputusan UX dengan Business, Product, dan User Baseline.

---

# Scope

Folder ini hanya membahas **UX Planning**.

Topik yang termasuk dalam scope:

* UX Principles — prinsip desain yang menjadi panduan seluruh keputusan UX.
* Information Architecture — struktur navigasi, hierarki layar, dan pengelompokan konten.
* User Flows — alur solusi dari perspektif pengguna untuk setiap pekerjaan inti.
* Navigation Patterns — model navigasi utama dan pendukung.
* Key Screen Patterns — pola utama layar beserta komponen fungsi kritis.
* UX Decisions — keputusan desain yang memengaruhi arah arsitektur atau pengembangan.

Topik berikut **tidak dibahas** pada folder ini:

* Wireframe detail (high-fidelity)
* Prototype interaktif
* UI Design (visual design, color, typography, branding)
* Component library
* Technical Architecture
* Database Design
* API Design
* Implementation

---

# Daftar Dokumen

* `ux-principles.md` — prinsip desain yang mengatur seluruh keputusan UX.
* `information-architecture.md` — struktur navigasi, hierarki layar, dan pengelompokan fitur.
* `user-flows.md` — alur solusi untuk pekerjaan inti pengguna.
* `navigation-patterns.md` — model navigasi utama dan pola perpindahan layar.
* `key-screen-patterns.md` — pola fungsi kritis pada layar utama.

---

# UX Planning Workflow

Seluruh proses UX Planning mengikuti alur berikut:

```text
User Discovery Insights
        ↓
UX Principles
        ↓
Information Architecture
        ↓
User Flows
        ↓
Navigation Patterns
        ↓
Key Screen Patterns
        ↓
Architecture Discovery Input
```

Keputusan UX tidak otomatis mengubah Business atau Product Baseline. Perubahan pada Target Market, Problem Statement, Product Scope, atau MVP harus melalui proses review dan dokumentasi ADR.

---

# Cara Menggunakan

1. Mulai dari `ux-principles.md` untuk menetapkan panduan keputusan desain.
2. Definisikan struktur aplikasi pada `information-architecture.md`.
3. Susun user flows berdasarkan pekerjaan inti pengguna pada `user-flows.md`.
4. Dokumentasikan model navigasi pada `navigation-patterns.md`.
5. Petakan pola fungsi kritis pada `key-screen-patterns.md`.
6. Gunakan seluruh dokumen sebagai input Architecture Discovery.

---

# Input dari Fase Sebelumnya

UX Planning dibangun di atas fondasi berikut.

## Dari User Discovery Baseline v1.0

* **I-01** — Primary value adalah workflow consolidation; MVP harus memenangkan publishing lebih dulu.
* **I-02** — Buyer dan daily user mengoptimalkan sinyal sukses yang berbeda.
* **I-03** — Simplicity adalah product requirement, bukan preferensi styling.
* **I-04** — Publishing trust mengalahkan feature breadth.
* **I-05** — Engagement dan Analytics adalah retention layers.
* **I-06** — AI paling relevan ketika menempel pada draft job, bukan modul terpisah.
* **I-07** — Secondary segments berbagi core jobs dengan konteks berbeda.
* **I-08** — Collaboration visibility penting; full approval workflow bukan MVP.

## Dari Product Baseline v1.0

* Domain prioritas MVP: Publishing, Workspace, Engagement, Analytics, AI Assistant.
* Must Have: Draft, Schedule, Queue, Calendar, Connected Accounts, Engagement Comments Inbox + reply, Analytics Snapshot, AI Caption.
* Engagement MVP memakai periodic pull 30 menit + manual refresh; Direct Message, mention, dan webhook engagement tidak termasuk MVP (ADR-040).
* Fokus persona: Raka (P0 daily user), Maya (P0 buyer).

## Dari User Discovery Journey

* 8 stage current-state: Intake → Production → Scheduling → Verification → Publish → Engagement → Review → Tool Evaluation.
* Friction terbesar: context switching, status tidak terlihat lintas peran, risiko salah publish.
* Opportunity: reduce tool switches, status visibility, publish confidence, lightweight comment triage.

---

# Expected Output

Setelah seluruh dokumen pada folder ini selesai, project harus memiliki:

* UX Principles yang jelas dan dapat dijadikan panduan keputusan desain.
* Information Architecture yang mencerminkan domain produk dan kebutuhan pengguna.
* User Flows yang menggambarkan solusi untuk pekerjaan inti pengguna.
* Navigation model yang sederhana dan tidak menambah cognitive load.
* Key screen patterns yang siap dijadikan acuan architecture dan development.
* Input yang cukup untuk memulai Architecture Discovery (M5).

---

# Exit Criteria

UX Planning dianggap selesai apabila:

* UX Principles telah ditetapkan dan dapat ditelusuri ke insight pengguna.
* Information Architecture telah terdefinisi dengan hierarki layar yang jelas.
* User Flows untuk pekerjaan inti telah terdokumentasi.
* Navigation patterns telah dipilih dan didokumentasikan.
* Key screen patterns telah disusun.
* Tidak ada keputusan UX yang bertentangan dengan Product Baseline v1.0.
* Seluruh dokumen telah melalui UX Planning Review.

---

# Decision Rules

Keputusan UX yang berdampak pada:

* Scope MVP
* Domain produk
* Feature Priority
* Target Market

harus didokumentasikan pada:

* `../../project-manager/DECISIONS.md`

Perubahan progress UX Planning harus diperbarui pada:

* `../../project-manager/PROJECT_STATE.md`

---

# Related Documents

* `../../context/ctx-design.md` — pointer Claude Design project (folder `design/` dihapus, ADR-045)
* `../README.md`
* `../01-business/README.md`
* `../01-business/product-vision.md`
* `../01-business/problem-statement.md`
* `../01-business/target-market.md`
* `../02-product/README.md`
* `../02-product/product-scope.md`
* `../02-product/mvp-definition.md`
* `../02-product/feature-modules.md`
* `../02-product/feature-priority.md`
* `../03-user/README.md`
* `../03-user/user-personas.md`
* `../03-user/user-goals.md`
* `../03-user/user-journey.md`
* `../03-user/insights.md`
* `../../project-manager/PROJECT_OVERVIEW.md`
* `../../project-manager/PROJECT_RULES.md`
* `../../project-manager/PROJECT_STATE.md`
* `../../project-manager/DECISIONS.md`
