# Product Scope

Dokumen ini mendefinisikan ruang lingkup produk **Postific** pada tingkat domain.

Tujuan utama dokumen ini adalah memastikan seluruh pengembangan produk memiliki batasan yang jelas sebelum memasuki tahap perancangan fitur, UX, dan arsitektur.

---

# Overview

Produk ini dirancang sebagai platform Social Media Management yang membantu Marketing Team, Startup, dan Digital Agency mengelola aktivitas media sosial secara terintegrasi.

Scope produk berfokus pada aktivitas yang berhubungan langsung dengan perencanaan, kolaborasi, publikasi, analisis, dan pengelolaan media sosial.

---

# Product Principles

Seluruh ruang lingkup produk mengikuti prinsip berikut:

* Simplicity First.
* Team Collaboration First.
* AI-Native Workflow (AI pengguna bekerja di dalam produk lewat MCP, ADR-138).
* Modern User Experience.
* Scalable Architecture.
* Modular Product Design.

---

# Core Product Domains

## Workspace

Mengelola organisasi yang menggunakan platform.

Mencakup:

* Workspace
* Members
* Roles
* Permissions
* Brand / Organization Settings

---

## Publishing

Mengelola seluruh proses publikasi konten.

Mencakup:

* Content Draft
* Content Format per akun (Post / Reel / Story / Pin — ADR-039)
* Schedule
* Queue
* Calendar
* Publishing History

---

## Analytics

Mengelola data performa media sosial.

Mencakup:

* Dashboard
* Reports
* Engagement Metrics
* Performance Insights

---

## Engagement

Mengelola komentar audiens dan reply dari satu inbox.

Mencakup:

* Comments
* Comment Replies
* Inbox
* Periodic Pull setiap 30 menit
* Manual Refresh

Direct Message, mention, dan webhook engagement berada di luar scope MVP (ADR-040).

---

## MCP Server

Memungkinkan pengguna bekerja di Postific melalui AI pilihannya sendiri
(Claude, ChatGPT, Cursor, dan klien MCP lain). Postific tidak membangun AI
sendiri (ADR-138).

Mencakup:

* Akses baca (akun, media, draft, antrean, history, analytics, komentar)
* Pembuatan dan pengeditan draft, unggah media dari URL
* Penjadwalan post
* Otorisasi OAuth per workspace dan per scope
* Audit akses dan batas pemakaian

Publish Now dan balas komentar lewat MCP ditunda. Aksi destruktif dan
administratif tidak diekspos.

---

## Start Page

Menyediakan halaman publik untuk mengelola kumpulan tautan.

Mencakup:

* Public Profile
* Link Management
* Theme Configuration
* Analytics

---

# Supporting Domains

Selain domain utama, produk juga membutuhkan domain pendukung.

* Authentication
* User Profile
* Notifications
* Media Library
* Settings
* Billing
* API Integrations
* Audit Log

Domain ini mendukung operasional platform tetapi bukan nilai utama produk.

---

# Product Boundaries

Produk berfokus pada aktivitas Social Media Management.

Produk tidak bertujuan menjadi:

* Social Media Platform.
* CRM.
* Email Marketing Platform.
* Marketplace.
* Marketing Automation Platform.
* Customer Support Platform.

Batasan ini membantu menjaga fokus pengembangan produk.

---

# Out of Scope (MVP)

Fitur berikut tidak menjadi prioritas pada fase MVP:

* White Label.
* Marketplace Integrations.
* Browser Extension.
* Mobile Application.
* Public API.
* Plugin Ecosystem.
* Enterprise Workflow yang kompleks.
* Direct Message, mention, dan webhook engagement.

Topik tersebut akan dievaluasi pada fase pengembangan berikutnya.

---

# Success Criteria

Product Scope dianggap selesai apabila:

* Domain utama produk telah didefinisikan.
* Domain pendukung telah diidentifikasi.
* Batasan produk telah disepakati.
* Ruang lingkup MVP memiliki dasar yang jelas untuk didefinisikan pada dokumen berikutnya.

---

# Related Documents

* `README.md`
* `mvp-definition.md`
* `feature-modules.md`
* `../01-business/product-vision.md`
* `../01-business/problem-statement.md`
* `../01-business/target-market.md`
* `../../project-os/PROJECT_OVERVIEW.md`
* `../../project-os/DECISIONS.md`