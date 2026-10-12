# 05 — Architecture

Dokumentasi pada folder ini berfokus pada **System Architecture** untuk produk **Postific**, mencakup domain model, strategi database, application layer, integrasi eksternal, background jobs, dan keamanan sistem.

Seluruh dokumentasi pada folder ini harus mengacu pada **Business Baseline v1.0**, **Product Baseline v1.0**, **User Discovery Baseline v1.0**, dan **UX Planning Baseline v1.0** yang telah disepakati. System Architecture berfungsi menerjemahkan keputusan produk dan UX menjadi keputusan teknis yang dapat dijadikan acuan implementasi.

---

# Tujuan

* Mendefinisikan domain model dan bounded context berdasarkan Product Baseline.
* Menetapkan strategi database dan isolasi data antar workspace.
* Mendefinisikan bagaimana application layer berinteraksi dengan domain logic.
* Merancang arsitektur integrasi eksternal (Outstand API dan webhook).
* Menetapkan strategi background job dan scheduling konten.
* Mendefinisikan arsitektur keamanan dan autentikasi.
* Menghasilkan keputusan teknis yang siap dijadikan input Engineering Planning.

---

# Scope

Folder ini hanya membahas **System Architecture** — keputusan struktural sistem, bukan implementasi kode.

Topik yang termasuk dalam scope:

* Domain Model — bounded context, entitas utama, dan relasi antar domain.
* Database Strategy — pilihan database, multi-tenancy, dan isolasi data workspace.
* Application Layer — interaksi Next.js App Router dengan domain logic.
* Integration Layer — arsitektur Outstand API, webhook handling, dan connected accounts.
* Background Jobs — arsitektur scheduling, job queue, dan retry strategy.
* Real-time Strategy — pendekatan notifikasi dan sinkronisasi status.
* Auth Architecture — autentikasi, sesi, dan otorisasi berbasis role.

Topik berikut **tidak dibahas** pada folder ini:

* Implementasi kode
* ORM dan database access layer (dibahas di Engineering Planning)
* CI/CD dan deployment pipeline (dibahas di Engineering Planning)
* UI/UX Design

---

# Keputusan Pra-Architecture yang Telah Ditetapkan

Keputusan berikut sudah disepakati sebelum dokumentasi ini dimulai dan menjadi fondasi seluruh dokumen di folder ini:

| Topik | Keputusan |
| ----- | --------- |
| Framework | Next.js (ADR-003) |
| Runtime | Bun (ADR-002) |
| Repository | Hybrid Monorepo (ADR-001) |
| Architecture Pattern | Modular Monolith + DDD (ADR-004) |
| Social Media Integration | Outstand API; kontrak resmi dan batas MVP diamandemen ADR-040 |
| Database Platform | Supabase PostgreSQL Cloud |
| Multi-tenancy | Row-Level Security dengan `workspace_id` |
| Auth Library | Better Auth |
| Real-time Strategy | In-app notification + manual refresh |
| Storage | Supabase Storage |
| Deployment | Railway |
| Domain Boundary | Pragmatic Boundary — shared types via `packages/shared`, tidak boleh import implementasi lintas domain |

---

# Daftar Dokumen

* `domain-model.md` — bounded context, entitas utama, dan relasi antar domain.
* `database-strategy.md` — strategi database, multi-tenancy, dan workspace isolation.
* `application-layer.md` — interaksi Next.js App Router dengan domain logic dan service layer.
* `integration-layer.md` — arsitektur Outstand API, webhook handling, dan connected accounts.
* `background-jobs.md` — arsitektur scheduling konten, job queue, dan retry strategy.
* `realtime-strategy.md` — pendekatan notifikasi in-app dan sinkronisasi status konten.
* `auth-architecture.md` — autentikasi, manajemen sesi, dan otorisasi berbasis role (Better Auth).

---

# Architecture Planning Workflow

Seluruh proses Architecture Planning mengikuti alur berikut berdasarkan dependency antar dokumen:

```text
UX Planning Baseline
        ↓
Domain Model & Bounded Context
        ↓
Database Strategy
        ↓
Application Layer
        ↓
Integration Layer  ←→  Background Jobs
        ↓
Real-time Strategy
        ↓
Auth Architecture
        ↓
Engineering Planning Input
```

Keputusan architecture tidak otomatis mengubah Business, Product, atau UX Baseline. Perubahan pada scope MVP, domain produk, atau target market harus melalui ADR baru.

---

# Cara Menggunakan

1. Mulai dari `domain-model.md` untuk menetapkan bounded context dan entitas utama.
2. Definisikan strategi database pada `database-strategy.md`.
3. Rancang interaksi layer pada `application-layer.md`.
4. Dokumentasikan arsitektur integrasi eksternal pada `integration-layer.md`.
5. Definisikan arsitektur background jobs pada `background-jobs.md`.
6. Tetapkan strategi notifikasi pada `realtime-strategy.md`.
7. Dokumentasikan arsitektur auth pada `auth-architecture.md`.
8. Gunakan seluruh dokumen sebagai input Engineering Planning (M6).

---

# Input dari Fase Sebelumnya

## Dari Product Baseline v1.0

* 6 Core Module: Workspace, Publishing, Analytics, Engagement, AI Assistant, Start Page.
* 5 Supporting Module: Authentication, User Profile, Media Library, Notifications, Billing, Settings.
* Infrastructure Module: API Integrations, Webhooks, Audit Logs, File Storage, Background Jobs, Monitoring.
* MVP Must Have: Draft, Schedule, Queue, Calendar, Connected Accounts, Engagement Inbox, Analytics Snapshot, AI Caption.
* 3 Roles (direvisi ADR-074): Account Owner, Admin, Creator — dengan set status konten kanonikal.

## Amandemen Kontrak Outstand (ADR-040)

* Webhook MVP hanya `post.published`, `post.error`, dan `account.token_expired`; nama vendor diterjemahkan ACL ke status/notifikasi domain.
* Ingestion webhook: verify HMAC raw body → persist `outstand_webhook_events` idempoten → enqueue JOB-01 → ACK `2xx`; retry delivery vendor terpisah dari retry process internal.
* Engagement MVP hanya comments/replies melalui JOB-03 setiap 30 menit dan manual refresh; tanpa webhook comment/DM/mention.
* Original media tetap di Supabase Storage; publishing memakai working copy Outstand melalui request upload URL → PUT → confirm.
* Twitter/X tetap MVP dengan BYOK wajib yang dikonfigurasi Project Owner di dashboard Outstand; aplikasi tidak menyimpan X client secret.

## Dari UX Planning Baseline v1.0

* Navigasi utama: Home, Publish, Engage, Analyze, Start Page.
* 5 user flows inti: Create & Publish, Content Calendar, Queue Management, Engagement, Analytics.
* Key screen patterns untuk 8 layar utama siap dijadikan referensi domain entitas.
* Keputusan UX (KSP-D01 s/d KSP-D11, NP-D01 s/d NP-D09) menjadi constraint desain domain.

## Dari User Discovery Baseline v1.0

* Friction terbesar: context switching, status tidak terlihat lintas peran, risiko salah publish.
* Insight utama yang mempengaruhi architecture: I-01 (workflow consolidation), I-04 (publishing trust), I-06 (AI menempel pada draft job).

---

# Expected Output

Setelah seluruh dokumen pada folder ini selesai, project harus memiliki:

* Domain model yang terdefinisi dengan bounded context yang jelas.
* Strategi database dan multi-tenancy yang siap dijadikan schema awal.
* Arsitektur layer yang mendukung Modular Monolith + DDD.
* Desain integrasi Outstand API dan webhook yang terdokumentasi.
* Strategi background job yang realistis untuk MVP.
* Arsitektur auth berbasis role yang selaras dengan Roles & Permissions Baseline.
* Input yang cukup untuk memulai Engineering Planning (M6).

---

# Exit Criteria

System Architecture dianggap selesai apabila:

* Seluruh 7 dokumen pada folder ini telah selesai.
* Domain model mencerminkan seluruh modul dari Product Baseline.
* Tidak ada keputusan architecture yang bertentangan dengan Product atau UX Baseline.
* Seluruh keputusan architecture krusial telah didokumentasikan sebagai ADR di `DECISIONS.md`.
* Seluruh dokumen telah melalui Architecture Review.

---

# Decision Rules

Keputusan architecture yang berdampak pada:

* Arsitektur sistem
* Tech stack
* Domain model
* Repository strategy

harus didokumentasikan pada:

* `../../project-manager/DECISIONS.md`

Perubahan progress Architecture Planning harus diperbarui pada:

* `../../project-manager/PROJECT_STATE.md`

Untuk penyelarasan ADR-040, batas edit sesi dapat mengecualikan pembaruan living/append-only document; Decision Log masing-masing dokumen Architecture tetap harus menandai amandemen tersebut.

---

# Related Documents

* `../README.md`
* `../01-business/README.md`
* `../02-product/feature-modules.md`
* `../02-product/mvp-definition.md`
* `../02-product/roles-permissions.md`
* `../03-user/insights.md`
* `../04-ux/README.md`
* `../04-ux/information-architecture.md`
* `../04-ux/key-screen-patterns.md`
* `../06-engineering/README.md`
* `../../project-manager/PROJECT_OVERVIEW.md`
* `../../project-manager/PROJECT_RULES.md`
* `../../project-manager/PROJECT_STATE.md`
* `../../project-manager/DECISIONS.md`
