# UX Principles

Dokumen ini menetapkan prinsip UX yang mengatur seluruh keputusan desain pada produk **Postific**.

Setiap prinsip diturunkan dari insight pengguna (I-01 hingga I-08) dan harus dapat ditelusuri ke User Discovery Baseline v1.0. Prinsip ini bukan aturan visual — melainkan panduan pengambilan keputusan UX yang berlaku dari Information Architecture hingga Key Screen Patterns.

---

# Overview

UX Principles berfungsi sebagai filter keputusan: ketika ada pilihan desain, prinsip ini membantu menentukan arah yang benar untuk pengguna prioritas (Raka dan Maya).

Prinsip berlaku di seluruh dokumen UX Planning dan tidak berubah tanpa alasan yang terdokumentasi.

---

# Cara Menggunakan

1. Ketika ada keputusan desain (struktur navigasi, penempatan fitur, urutan alur), periksa apakah keputusan itu selaras dengan prinsip di bawah.
2. Jika ada dua opsi yang sama-sama valid secara teknis, pilih yang lebih selaras dengan prinsip.
3. Jika prinsip perlu diubah, diskusikan dan dokumentasikan alasannya — jangan ubah tanpa jejak.

---

# UX Principles

## UXP-01 — Satu Siklus, Bukan Kumpulan Fitur

**Turunan dari:** I-01 (Workflow Consolidation), O-01, O-04

Produk ini tidak dirancang sebagai kumpulan fitur sosial yang berdiri sendiri. Produk dirancang sebagai satu siklus kerja: **Draft → Schedule → Publish → Engage → Review**.

Setiap keputusan arsitektur informasi, navigasi, dan flow harus memperkuat siklus ini — bukan memecahnya menjadi modul-modul terpisah yang mengharuskan pengguna berpindah konteks.

**Implikasi desain:**
- Navigasi utama mencerminkan tahapan siklus, bukan kategori fitur.
- Transisi antar tahap (dari draft ke schedule, dari publish ke inbox) harus terasa natural, bukan seperti berpindah aplikasi.
- Onboarding memperkenalkan siklus secara utuh, bukan satu fitur per satu.

---

## UXP-02 — Dua Mode Kerja: Eksekusi dan Visibilitas

**Turunan dari:** I-02 (Buyer vs Daily User), O-02, O-06

Raka membutuhkan kecepatan eksekusi. Maya membutuhkan visibilitas dan ringkasan. Produk harus melayani keduanya tanpa memaksa salah satu berkompromi.

Ini bukan berarti dua UI terpisah. Ini berarti desain harus **sadar konteks**: layar yang diakses Raka untuk bekerja harus tetap memberi Maya gambaran status yang cukup saat ia membuka aplikasi.

**Implikasi desain:**
- Layar publishing dan kalender harus memberi overview status konten yang bisa dibaca sekilas oleh buyer.
- Ringkasan analytics harus tersedia tanpa navigasi berlapis.
- Jangan sembunyikan status konten di balik drill-down yang dalam.

---

## UXP-03 — Simplisitas Adalah Quality Bar, Bukan Estetika

**Turunan dari:** I-03 (Simplicity as Requirement), O-03, O-09

Simplisitas bukan soal tampilan yang bersih. Simplisitas berarti pengguna tidak perlu berpikir keras untuk menyelesaikan pekerjaan intinya.

Setiap fitur atau layar yang menambah cognitive load tanpa nilai proporsional harus dipertanyakan — bukan di fase visual, tapi sejak perencanaan alur dan arsitektur informasi.

**Implikasi desain:**
- Jika sebuah fitur memerlukan penjelasan panjang untuk digunakan, itu sinyal masalah desain, bukan masalah dokumentasi.
- Could-have yang memperumit alur inti harus ditunda.
- Default state layar harus langsung menunjukkan pekerjaan yang paling relevan, bukan dashboard kosong.

---

## UXP-04 — Publishing Trust Adalah Fondasi

**Turunan dari:** I-04 (Publishing Trust Beats Feature Breadth), O-04, journey stages 3–5

Pengguna harus percaya bahwa konten akan terbit ke akun yang benar, pada waktu yang tepat, tanpa ambiguitas. Kepercayaan ini lebih penting dari kelengkapan fitur sekunder.

**Implikasi desain:**
- Konfirmasi akun dan jadwal harus jelas dan tidak bisa diabaikan sebelum publish.
- Status konten (draft / scheduled / published / failed) harus selalu terlihat.
- Error atau kegagalan publish harus ditampilkan dengan jelas dan memberikan jalur pemulihan yang obvious.
- Jangan membiarkan pengguna dalam keadaan "tidak tahu apakah ini sudah publish atau belum".
- Kebijakan Safety Check / Double Confirmation lintas produk (kapan sebuah aksi wajib dialog konfirmasi, berdasarkan reversibilitas dan blast radius) didokumentasikan sebagai pola lintas layar di `key-screen-patterns.md` (ADR-049) — merupakan penerapan langsung prinsip ini di luar konteks publish murni.

---

## UXP-05 — AI Menempel pada Pekerjaan, Bukan Berdiri Sendiri

**Turunan dari:** I-06 (AI in the Draft Job), O-07

AI dianggap berguna ketika hadir di momen yang tepat: saat pengguna sedang mengerjakan caption. AI kehilangan relevansinya jika ditempatkan sebagai modul terpisah yang harus dinavigasi secara sengaja.

**Implikasi desain:**
- AI caption assistance berada di dalam draft editor, bukan di halaman terpisah.
- Tidak ada "AI Hub" atau menu AI di navigasi utama.
- Trigger AI harus kontekstual (misalnya: "Improve this caption" muncul saat draft terbuka), bukan sebagai entry point yang harus dicari.

---

## UXP-06 — Status Jelas, Proses Ringan

**Turunan dari:** I-08 (Collaboration Visibility without Approval Overhead), O-01, O-02

Tim membutuhkan kejelasan: siapa yang mengerjakan apa, status konten ada di mana. Tetapi approval workflow berlapis bukan kebutuhan MVP — bahkan bisa menjadi hambatan adopsi.

Desain harus mendukung **visibilitas status** tanpa memaksakan **enforcement proses**.

**Implikasi desain:**
- Status konten (draft / in review / ready to schedule / scheduled / published / failed) dapat dilihat tanpa membuka item.
- Handoff ringan (misalnya: menandai draft sebagai "ready to schedule") cukup untuk koordinasi tim.
- Jangan implementasikan approval workflow berlapis — itu bukan MVP dan menambah complexity.
- Collaboration visibility harus terasa seperti transparansi, bukan birokrasi.
- Aturan transisi status per role didefinisikan di `../02-product/roles-permissions.md` — dokumen tersebut menjadi acuan kanonikal untuk siapa yang dapat memicu transisi status mana.

---

## UXP-07 — Nilai Bertambah Seiring Siklus, Bukan Langsung Semuanya

**Turunan dari:** I-05 (Engagement and Analytics as Retention Layers), I-01

Urutan nilai dalam produk ini: **Publishing reliability → Engagement triage → Analytics snapshot**.

Pengguna tidak perlu mengakses semuanya sejak hari pertama. Produk harus membiarkan pengguna menemukan lapisan nilai berikutnya secara natural setelah pekerjaan intinya terpenuhi — tanpa memaksa atau menyembunyikannya.

**Implikasi desain:**
- Onboarding fokus pada publishing; engagement dan analytics diperkenalkan sebagai kelanjutan siklus, bukan fitur yang harus disetup di awal.
- Navigasi harus membuat Comments Inbox dan analytics mudah diakses ketika pengguna siap, tapi tidak membebani alur publishing awal.
- Comments Inbox harus menunjukkan waktu sinkronisasi terakhir dan menyediakan Manual Refresh; jangan memberi kesan data engagement real-time karena MVP memakai periodic pull 30 menit (ADR-040).
- Jangan buat kesan bahwa produk "belum lengkap" jika pengguna hanya menggunakan publishing.

---

# Ringkasan Prinsip

| ID | Prinsip | Insight Asal |
| -- | ------- | ------------ |
| UXP-01 | Satu Siklus, Bukan Kumpulan Fitur | I-01 |
| UXP-02 | Dua Mode Kerja: Eksekusi dan Visibilitas | I-02 |
| UXP-03 | Simplisitas Adalah Quality Bar, Bukan Estetika | I-03 |
| UXP-04 | Publishing Trust Adalah Fondasi | I-04 |
| UXP-05 | AI Menempel pada Pekerjaan, Bukan Berdiri Sendiri | I-06 |
| UXP-06 | Status Jelas, Proses Ringan | I-08 |
| UXP-07 | Nilai Bertambah Seiring Siklus, Bukan Langsung Semuanya | I-05 |

---

# Cara Prinsip Ini Digunakan pada Dokumen Berikutnya

| Dokumen | Prinsip Paling Relevan |
| ------- | ---------------------- |
| `information-architecture.md` | UXP-01, UXP-02, UXP-03 |
| `user-flows.md` | UXP-01, UXP-04, UXP-05, UXP-06 |
| `navigation-patterns.md` | UXP-01, UXP-02, UXP-03, UXP-07 |
| `key-screen-patterns.md` | UXP-02, UXP-04, UXP-05, UXP-06 |

---

# Decision Rules

Jika prinsip UX perlu diubah karena keputusan produk baru:

1. Identifikasi prinsip mana yang terdampak.
2. Dokumentasikan alasan perubahan pada `../../project-manager/DECISIONS.md`.
3. Update dokumen UX yang merujuk prinsip tersebut.
4. Catat perubahan pada `../../project-manager/COMPLETE_TASK.md` (ADR-061).

---

# Expected Output

Setelah dokumen ini selesai, project harus memiliki:

* 7 UX Principles yang dapat ditelusuri ke insight pengguna.
* Implikasi desain yang konkret per prinsip.
* Panduan penerapan prinsip pada dokumen UX berikutnya.

---

# Exit Criteria

UX Principles dianggap selesai apabila:

* Setiap prinsip memiliki traceability ke insight User Discovery.
* Setiap prinsip memiliki implikasi desain yang actionable.
* Tidak ada prinsip yang bertentangan dengan Product Baseline v1.0.
* Dokumen ini dapat digunakan sebagai referensi pada Information Architecture, User Flows, Navigation Patterns, dan Key Screen Patterns.

---

# Related Documents

* `README.md`
* `information-architecture.md`
* `user-flows.md`
* `navigation-patterns.md`
* `key-screen-patterns.md`
* `../03-user/insights.md`
* `../03-user/user-personas.md`
* `../03-user/user-journey.md`
* `../02-product/mvp-definition.md`
* `../02-product/feature-priority.md`
* `../../project-manager/DECISIONS.md`
* `../../project-manager/PROJECT_STATE.md`
