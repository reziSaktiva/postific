# Jobs To Be Done

Dokumen ini mendefinisikan **Jobs To Be Done (JTBD)** pengguna produk **Postific**.

JTBD menjelaskan pekerjaan yang ingin diselesaikan pengguna dalam konteks tertentu, termasuk dimensi fungsional, emosional, dan sosial.

---

# Overview

JTBD pada fase ini disusun dari desktop research dan sintesis goals/pain points, bukan dari interview formal.

Fokusnya adalah pekerjaan yang berulang pada Marketing Team, dengan penyesuaian konteks untuk Startup dan Digital Agency.

JTBD digunakan untuk menguji apakah MVP menyelesaikan “pekerjaan yang dihire”, bukan sekadar menyediakan daftar fitur.

---

# Purpose

* Menyatakan pekerjaan inti yang harus diselesaikan produk.
* Memisahkan functional, emotional, dan social jobs.
* Menghubungkan jobs dengan persona dan pain points.
* Memberi kriteria evaluasi untuk Product Fit sebelum UX Design.

---

# Scope

## In Scope

* Core jobs untuk buyer dan daily user.
* Job stories dalam format situasi → motivasi → outcome.
* Functional / emotional / social dimensions.
* Prioritas jobs terhadap MVP.

## Out of Scope

* Desain solution flow.
* Breakdown fitur teknis.
* Wireframe atau prototype.
* Backlog engineering.

---

# JTBD Format

Setiap job ditulis sebagai:

> When **[situation]**, I want to **[motivation/action]**, so I can **[desired outcome]**.

Dilengkapi dengan:

* Job type (Functional / Emotional / Social)
* Primary actor
* Related pain points
* MVP relevance

---

# Core Jobs — Daily User

## J-01 — Plan and Schedule Content Reliably

**Job Story**

When saya mengelola beberapa akun dalam satu minggu, I want to menyusun dan menjadwalkan konten dari satu tempat, so I can menjaga cadence tanpa bolak-balik tool.

* **Type:** Functional
* **Actor:** Raka (Social Media Manager), Dimas
* **Pain Points:** PP-01, PP-05, PP-04
* **MVP Relevance:** Must — Publishing core

---

## J-02 — Keep the Content Pipeline Visible

**Job Story**

When saya bertanggung jawab atas kalender konten, I want melihat status draft hingga published dengan jelas, so I can mencegah kekosongan jadwal dan deadline yang terlewat.

* **Type:** Functional
* **Actor:** Raka, Maya (oversight)
* **Pain Points:** PP-02, PP-05
* **MVP Relevance:** Must — Calendar / Queue / Status clarity

---

## J-03 — Publish Without Operational Mistakes

**Job Story**

When volume akun dan aset meningkat, I want memastikan konten dijadwalkan ke akun yang benar pada waktu yang benar, so I can menghindari kesalahan yang merusak brand.

* **Type:** Functional + Emotional (anxiety reduction)
* **Actor:** Raka, Lara
* **Pain Points:** PP-04, PP-10
* **MVP Relevance:** Must — Account clarity in Publishing

---

## J-04 — Respond to Important Audience Interactions

**Job Story**

When komentar masuk dari beberapa platform, I want membaca dan membalas komentar prioritas dari satu inbox, so I can merespons cepat tanpa melewatkan interaksi penting.

* **Type:** Functional
* **Actor:** Raka / Community Manager
* **Pain Points:** PP-06, PP-01
* **MVP Relevance:** Must — Comments Inbox + reply; periodic pull 30 menit dan manual refresh (ADR-040)

---

## J-05 — Produce Caption Drafts Faster

**Job Story**

When saya harus membuat banyak caption dengan tone yang tepat, I want bantuan untuk draft dan perbaikan cepat, so I can menyelesaikan produksi konten tanpa bottleneck penulisan.

* **Type:** Functional
* **Actor:** Sinta, Dimas
* **Pain Points:** PP-08
* **MVP Relevance:** Must — AI Assistant (in-workflow)

---

## J-06 — Hand Off Work Without Losing Context

**Job Story**

When draft berpindah dari creator ke social media manager, I want konteks brief dan status tetap terbawa, so I can mengurangi revisi dan miskomunikasi.

* **Type:** Functional
* **Actor:** Sinta → Raka
* **Pain Points:** PP-03, PP-02
* **MVP Relevance:** High — Draft status & collaboration basics

---

# Core Jobs — Buyer

## J-07 — See Team Progress Without Chasing

**Job Story**

When saya mengelola tim marketing, I want melihat progres aktivitas media sosial tanpa bertanya satu per satu, so I can fokus pada keputusan, bukan koordinasi manual.

* **Type:** Functional + Social (managerial credibility)
* **Actor:** Maya, Lara
* **Pain Points:** PP-02, PP-03
* **MVP Relevance:** Must — Visibility via Workspace/Publishing/Analytics

---

## J-08 — Get a Weekly Performance Snapshot

**Job Story**

When saatnya review mingguan, I want ringkasan performa yang cukup jelas, so I can mengambil keputusan iterasi konten tanpa kompilasi manual yang lama.

* **Type:** Functional
* **Actor:** Maya, Dimas, Lara
* **Pain Points:** PP-07
* **MVP Relevance:** Must — Analytics basics

---

## J-09 — Adopt a Tool the Team Will Actually Use

**Job Story**

When saya memilih platform baru, I want onboarding yang sederhana bagi seluruh anggota, so I can memastikan investasi tool benar-benar dipakai sehari-hari.

* **Type:** Functional + Emotional (risk reduction)
* **Actor:** Maya, Dimas, Agency Owner
* **Pain Points:** PP-09
* **MVP Relevance:** Critical — Simplicity as product constraint

---

## J-10 — Standardize Social Operations

**Job Story**

When tim bertumbuh atau menangani banyak brand, I want proses kerja yang konsisten, so I can menjaga kualitas delivery tanpa menambah chaos operasional.

* **Type:** Functional + Social
* **Actor:** Maya, Lara
* **Pain Points:** PP-03, PP-10, PP-02
* **MVP Relevance:** High — Workspace + clear publishing process

---

# Emotional Jobs

| ID | Emotional Job | Why It Matters |
| -- | -------------- | -------------- |
| E-01 | Merasa terkendali terhadap jadwal konten | Mengurangi anxiety miss-post |
| E-02 | Merasa aman dari kesalahan publish | Risiko reputasi tinggi |
| E-03 | Merasa kompeten di depan stakeholder/klien | Buyer butuh credibility |
| E-04 | Merasa tidak kewalahan oleh tool switching | Fatigue adalah churn risk |

Emotional jobs tidak berdiri sendiri; mereka menyertai J-01 s/d J-10.

---

# Social Jobs

| ID | Social Job | Context |
| -- | ---------- | ------- |
| S-01 | Terlihat rapi dan andal sebagai pengelola channel | Daily user ke manager |
| S-02 | Menunjukkan bahwa tim bekerja terukur | Buyer ke leadership |
| S-03 | Menjaga kepercayaan klien terhadap delivery | Agency |

---

# Job Priority for MVP

| Priority | Jobs | Rationale |
| -------- | ---- | --------- |
| P0 | J-01, J-02, J-03, J-09 | Tanpa ini, produk gagal pada pekerjaan inti dan adopsi |
| P0 | J-04, J-08 | Melengkapi siklus value setelah publishing |
| P1 | J-05, J-06, J-07, J-10 | Memperkuat kecepatan, kolaborasi, dan standarisasi |
| Later | Jobs enterprise (approval berlapis, social listening, white-label) | Di luar MVP |

---

# Jobs vs Product Domains

| Job | Domain utama |
| --- | ------------ |
| J-01, J-02, J-03 | Publishing |
| J-04 | Engagement |
| J-05 | AI Assistant + Publishing |
| J-06, J-07, J-10 | Workspace + Publishing |
| J-08 | Analytics |
| J-09 | Cross-domain simplicity (esp. Workspace onboarding) |

---

# Competing Jobs / Alternatives

Saat ini jobs di atas “dihire” oleh kombinasi:

* Native social apps
* Scheduling tools
* Spreadsheet / docs
* Chat tools
* Analytics dashboards terpisah
* Manual copy-paste workflow

Produk berhasil jika pengguna memindahkan jobs P0 dari kombinasi tersebut ke satu dashboard, tanpa menambah friction baru.

---

# Assumptions Evaluated in This Document

| ID | Assumption | Observation | Status |
| -- | ---------- | ----------- | ------ |
| A-05 | Publishing adalah pekerjaan inti | J-01–J-03 adalah P0 | Supported |
| A-06 | Analytics & Engagement memperkuat value | J-04 dan J-08 masuk P0 setelah publishing | Supported |
| A-07 | AI berguna in-workflow | J-05 relevan bila menempel pada draft | Supported |
| A-04 | Kolaborasi penting | J-06, J-07, J-10 muncul kuat pada tim | Supported |

---

# Expected Output

Setelah dokumen ini selesai, project harus memiliki:

* JTBD yang jelas untuk buyer dan daily user.
* Prioritas jobs untuk MVP.
* Mapping jobs ke domain produk.
* Dasar evaluasi Product Fit berbasis pekerjaan, bukan daftar fitur.

---

# Exit Criteria

Jobs To Be Done dianggap selesai apabila:

* Core jobs daily user dan buyer telah terdokumentasi.
* Dimensi emotional dan social telah dicakup.
* Prioritas MVP untuk jobs telah ditetapkan.
* Mapping ke pain points dan domains tersedia.
* Scenarios dan journey dapat disusun berdasarkan jobs ini.

---

# Related Documents

* `README.md`
* `discovery-plan.md`
* `user-segments.md`
* `user-personas.md`
* `user-goals.md`
* `pain-points.md`
* `user-scenarios.md`
* `user-journey.md`
* `insights.md`
* `../01-business/problem-statement.md`
* `../02-product/mvp-definition.md`
* `../02-product/feature-modules.md`
* `../../project-manager/DECISIONS.md`
