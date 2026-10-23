# MVP Definition

Dokumen ini mendefinisikan ruang lingkup **Minimum Viable Product (MVP)** untuk produk **Postific**.

MVP merupakan versi pertama produk yang memiliki nilai nyata bagi pengguna serta mampu memvalidasi asumsi bisnis dan produk.

Dokumen ini menjadi acuan utama dalam menentukan prioritas pengembangan sebelum produk memasuki tahap rilis.

---

# Overview

Tujuan MVP bukan menghadirkan seluruh fitur yang direncanakan, melainkan menyediakan kemampuan inti yang memungkinkan target pengguna menyelesaikan pekerjaan utamanya secara efektif.

Setiap fitur yang masuk ke dalam MVP harus memiliki kontribusi langsung terhadap validasi Product-Market Fit.

---

# MVP Goals

MVP harus mampu membuktikan bahwa:

* Produk menyelesaikan masalah utama pengguna.
* Workflow yang dirancang dapat digunakan dalam pekerjaan nyata.
* Target pengguna memperoleh nilai dari penggunaan produk.
* Pengguna bersedia menggunakan produk secara berulang.

---

# Must Have

Kemampuan berikut wajib tersedia pada MVP.

## Workspace

* Membuat Workspace.
* Mengelola anggota tim.
* Menghubungkan akun media sosial ke Workspace.

---

## Publishing

* Membuat draft konten.
* Memilih **tipe/format konten per akun tujuan** sesuai kemampuan platform & Outstand (ADR-039):
  * Instagram & Facebook: **Post / Reel / Story**
  * TikTok: posting video/feed (tanpa selector Reel/Story di UI)
  * Pinterest: **Pin** (judul, destination link, board)
  * Platform lain yang didukung: format `post` sebagai default
* Menjadwalkan posting.
* Mempublikasikan konten secara langsung tanpa penjadwalan (**Publish Now**) —
  dibatasi ke role yang sama dengan Schedule: Account Owner, Admin, Creator
  (semua role bisa, sejak reduksi struktur role di ADR-074), lihat
  `roles-permissions.md` (ADR-047).
* Melihat kalender publikasi.
* Mengelola antrean (queue) posting.
* Melihat riwayat publikasi.

---

## Analytics

* Dashboard performa dasar.
* Statistik posting.
* Ringkasan engagement.

---

## Engagement

* Melihat komentar dari akun yang terhubung.
* Membalas komentar dari dalam aplikasi.
* Inbox komentar sederhana.
* Sinkronisasi komentar berkala setiap 30 menit.
* Manual refresh untuk mengambil komentar terbaru saat dibutuhkan.

Direct Message, mention, dan webhook engagement tidak termasuk MVP (ADR-040).

---

## MCP Server

Postific tidak membangun AI sendiri. AI milik pengguna bekerja di dalam
aplikasi lewat MCP (ADR-138).

* Menyambungkan klien AI lewat OAuth, terikat satu workspace per koneksi.
* Scope izin: `read`, `draft`, `schedule`. Default: `read` + `draft`.
* Membaca akun, media, draft, antrean, history, analytics, dan komentar.
* Membuat dan mengedit draft, mengunggah media dari URL.
* Menjadwalkan post (batch beberapa konten per panggilan).
* Mencabut koneksi klien AI dari Settings.
* Audit panggilan, penanda "dibuat lewat MCP", dan rate limit per workspace.

Tidak termasuk MVP: Publish Now lewat MCP, balas komentar lewat MCP, dan
aksi destruktif/administratif (hapus, batalkan jadwal, kelola member,
disconnect akun).

---

## Start Page

* Membuat halaman publik.
* Mengelola daftar tautan.
* Membagikan URL halaman.

---

# Should Have

Fitur yang memberikan nilai tambahan namun bukan syarat utama MVP.

* Media Library.
* Brand Assets.
* Content Templates.
* Saved Captions.
* Tone Rewrite (dikerjakan AI klien lewat MCP, bukan fitur Postific).
* Basic Notifications.
* Workspace Branding.

---

# Could Have

Fitur yang dapat dikembangkan apabila waktu dan sumber daya memungkinkan.

* AI Content Calendar (dikerjakan AI klien lewat MCP, bukan fitur Postific).
* Team Activity Feed.
* Custom Reports.
* AI Insights.
* AI Performance Suggestions (dikerjakan AI klien lewat MCP, bukan fitur Postific).
* Hashtag Suggestions.

---

# Out of Scope

Fitur berikut tidak menjadi bagian dari MVP.

* White Label.
* Mobile Application.
* Browser Extension.
* Marketplace.
* Public API.
* Plugin System.
* Enterprise SSO.
* Advanced Workflow Automation.
* Approval Workflow (gate berlapis yang mengunci Schedule/Publish sampai
  role lain approve) — ditolak eksplisit oleh UXP-06 (`04-ux/ux-principles.md`)
  dan dikonfirmasi King Rezi (audit dokumentasi, 2026-08-28): semua role
  (termasuk Creator) tetap bebas publish sendiri, lihat
  `roles-permissions.md`. Status konten (`In Review`/`Ready to Schedule`)
  tetap ada sebagai label koordinasi ringan — bukan gate — dan itu tetap
  masuk Must Have.
* Social Listening.
* Direct Message dan mention di Engagement Inbox.
* Webhook engagement.
* Multi Workspace Management — **sebagian masuk MVP per ADR-088**: switch
  active workspace di antara membership yang sudah dimiliki user, dan
  create workspace tambahan, keduanya lewat Settings → Account →
  Workspaces. Sisanya (cross-workspace bulk actions, billing gabungan,
  shared views lintas workspace, dan sejenisnya) tetap Out of Scope.

---

# MVP Success Criteria

MVP dianggap berhasil apabila pengguna mampu:

* Menghubungkan akun media sosial.
* Membuat konten.
* Menjadwalkan publikasi.
* Melakukan publikasi.
* Melihat hasil publikasi.
* Mengelola aktivitas media sosial tanpa bergantung pada banyak aplikasi lain.

---

# Decision Rules

Sebuah fitur hanya dapat masuk ke dalam MVP apabila:

* Mendukung tujuan utama produk.
* Menyelesaikan masalah utama pengguna.
* Dibutuhkan oleh target market utama.
* Tidak menambah kompleksitas yang tidak diperlukan.
* Membantu memvalidasi Product-Market Fit.

Apabila sebuah fitur tidak memenuhi kriteria tersebut, maka fitur harus dipertimbangkan untuk dimasukkan ke fase berikutnya.

---

# Related Documents

* `README.md`
* `product-scope.md`
* `feature-modules.md`
* `feature-priority.md`
* `release-roadmap.md`
* `../01-business/product-vision.md`
* `../01-business/problem-statement.md`
* `../../project-os/PROJECT_OVERVIEW.md`
* `../../project-os/DECISIONS.md`
