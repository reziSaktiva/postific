# Insights

Dokumen ini mengonsolidasikan observasi, pola, dan insight dari seluruh User Discovery.

Insight digunakan untuk mengevaluasi asumsi Business/Product Baseline dan mendukung keputusan produk berikutnya. Insight **tidak** otomatis mengubah baseline.

---

# Overview

User Discovery pada fase ini dilakukan melalui desktop research dan product discovery (Buffer, Postiz, kompetitor, dokumentasi, komunitas, artikel, video, dan pengalaman praktis).

Hasilnya dirangkum mengikuti vocabulary project:

```text
Assumption → Discovery → Observation → Insight → Decision
```

Keputusan yang mengubah Target Market, Problem Statement, Product Vision, Product Scope, MVP, atau Feature Priority harus masuk ke `../../project-os/DECISIONS.md`.

---

# Purpose

* Menyediakan satu sumber kebenaran untuk temuan User Discovery.
* Menilai status asumsi yang diinventarisasi pada Discovery Plan.
* Menjabarkan implikasi produk tanpa masuk ke desain UX/teknikal.
* Menyiapkan bahan untuk UX Discovery dan Architecture Discovery.

---

# Scope

## In Scope

* Key observations.
* Synthesized insights.
* Assumption review outcomes.
* Product implications (tingkat keputusan, bukan spesifikasi).
* Open questions untuk fase berikutnya.

## Out of Scope

* UX/UI solution.
* Wireframe dan prototype.
* Architecture, database, API.
* Perubahan baseline tanpa ADR.

---

# Key Observations

Observation adalah pola yang berulang dari sumber discovery, bukan opini produk.

| ID | Observation | Sources |
| -- | ----------- | ------- |
| O-01 | Tim marketing menyelesaikan satu siklus konten melalui banyak tool terpisah (docs, chat, scheduler, native apps, analytics). | Problem Statement, competitor landscape, community discussions |
| O-02 | Social Media Manager adalah pusat operasional harian; Manager/Buyer lebih sering butuh visibility dan ringkasan. | Target Market, persona synthesis |
| O-03 | Kegagalan adopsi tool sering terjadi ketika onboarding dan daily workflow terasa rumit. | Competitor weaknesses (complex suites), buyer evaluation scenarios |
| O-04 | Publishing reliability (schedule, queue, calendar, history) adalah fondasi nilai yang paling mudah dipahami pengguna. | Buffer/Postiz patterns, MVP definition alignment |
| O-05 | Engagement handling tetap tersebar di native apps pada banyak tim, sehingga response time tidak konsisten. | Problem Statement, scenario S-05 |
| O-06 | Analytics dibutuhkan rutin, tetapi sering dalam bentuk snapshot keputusan — bukan suite enterprise. | Buyer goals, weekly review scenario |
| O-07 | AI paling relevan ketika menempel pada pembuatan/perbaikan caption di dalam alur draft, bukan sebagai destinasi terpisah. | Competitor AI positioning, creator scenario |
| O-08 | Agency memiliki jobs inti yang sama, dengan risiko tambahan dari multi-client context switching. | Target Market secondary, scenario S-08 |
| O-09 | Startup sering menggabungkan buyer dan daily user dalam satu orang, sehingga time-to-value menjadi kritis. | Secondary segment characteristics |
| O-10 | Individual creator bukan pengguna yang paling selaras dengan value proposition kolaborasi tim pada MVP. | ADR-006, target-market out of scope |

---

# Insights

## I-01 — Primary Value Is Workflow Consolidation for Teams

**Based on:** O-01, O-02, O-04

Pengguna prioritas tidak mencari “lebih banyak fitur sosial”. Mereka mencari pengurangan context switching agar siklus draft → schedule → publish → respond → review lebih ringkas.

**Implication**

MVP harus memenangkan pekerjaan inti publishing lebih dulu, lalu mengikat engagement dan analytics sebagai kelanjutan siklus yang sama.

---

## I-02 — Buyer and Daily User Optimize for Different Success Signals

**Based on:** O-02, O-03, O-06

Buyer mengoptimalkan visibility, adopsi, dan efisiensi tim. Daily user mengoptimalkan kecepatan eksekusi dan pencegahan error.

**Implication**

Pesan produk dan prioritas capability harus melayani keduanya: reliability untuk daily user, clarity untuk buyer. Mengabaikan salah satu menurunkan peluang adopsi.

---

## I-03 — Simplicity Is a Product Requirement, Not a Styling Preference

**Based on:** O-03, O-09

Pada kategori yang sudah kompetitif, kompleksitas adalah churn risk. Startup dan Marketing Team lean akan menolak tool yang terasa “berat” meskipun fiturnya lengkap.

**Implication**

Keputusan scope MVP harus terus memakai filter simplicity. Could-have yang menambah cognitive load sebaiknya ditunda.

---

## I-04 — Publishing Trust Beats Feature Breadth

**Based on:** O-04, journey stages 3–5

Kepercayaan bahwa konten akan terbit ke akun yang benar pada waktu yang benar lebih penting daripada kelengkapan fitur sekunder di awal.

**Implication**

Quality bar Publishing (draft, schedule, queue, calendar, history, account clarity) adalah fondasi Product-Market Fit.

---

## I-05 — Engagement and Analytics Are Retention Layers

**Based on:** O-05, O-06

Setelah publishing berjalan, pengguna membutuhkan cara menangani interaksi prioritas dan melihat ringkasan performa. Tanpa keduanya, produk mudah kembali dianggap “sekadar scheduler”.

**Implication**

Urutan value: Publishing reliability → triage komentar → Analytics snapshot. Engagement MVP dibatasi pada Comments Inbox + reply dengan periodic pull 30 menit dan manual refresh; Direct Message, mention, serta webhook engagement tidak termasuk MVP (ADR-040).

---

## I-06 — AI Should Reduce Production Friction Inside the Draft Job

**Based on:** O-07

AI dianggap berguna ketika mempercepat caption generation/improvement pada saat pengguna sudah berada di konteks draft.

**Implication**

AI Assistant MVP sebaiknya tetap dekat dengan Publishing Draft. Hindari menempatkan AI sebagai modul yang terpisah dari pekerjaan utama.

---

## I-07 — Secondary Segments Share Core Jobs, Differ in Context Risk

**Based on:** O-08, O-09

Startup dan Agency tidak membutuhkan “produk berbeda” pada fase ini. Mereka membutuhkan jobs yang sama dengan tekanan konteks berbeda: speed untuk startup, multi-account safety untuk agency.

**Implication**

Jangan over-segment MVP. Bangun core untuk Marketing Team, pastikan usable pada secondary contexts.

---

## I-08 — Collaboration Pain Is Real, but Full Approval Workflow Is Not MVP-Critical

**Based on:** O-01, O-02, pain PP-02/PP-03, feature priority Won't Have

Tim membutuhkan kejelasan status dan handoff dasar. Namun approval workflow berlapis lebih dekat ke kebutuhan enterprise/agency advanced.

**Implication**

Dukung visibility status dan handoff ringan pada MVP. Advanced approval tetap di luar scope sesuai Product Baseline.

---

# Assumption Review

| ID | Assumption | Result | Evidence |
| -- | ---------- | ------ | -------- |
| A-01 | Marketing Team adalah primary user | **Supported** | I-01, I-07, O-02, O-10 |
| A-02 | Buyer dan daily user sering berbeda | **Supported** | I-02, journey swimlane |
| A-03 | Fragmented workflow adalah masalah utama | **Supported** | O-01, current-state journey |
| A-04 | Kolaborasi tim adalah diferensiator penting | **Supported (scoped)** | I-08 — penting sebagai visibility/handoff, bukan approval enterprise |
| A-05 | Publishing adalah pekerjaan inti | **Supported** | I-04, J-01–J-03 |
| A-06 | Analytics dan Engagement memperkuat retensi | **Supported** | I-05 |
| A-07 | AI berguna jika terintegrasi ke workflow | **Supported** | I-06 |
| A-08 | Individual creator bukan fokus MVP | **Supported** | O-10 |
| A-09 | Startup/Agency mirip dengan nuansa berbeda | **Supported** | I-07 |
| A-10 | Pengguna mau konsolidasi jika sederhana | **Supported (conditional)** | I-03 — bersyarat pada simplicity dan time-to-value |

Tidak ada asumsi baseline utama yang **Contradicted** pada fase desktop discovery ini.

---

# Product Implications

Implikasi berikut **mendukung** Business Baseline v1.0 dan Product Baseline v1.0. Tidak memerlukan perubahan ADR saat ini.

1. Pertahankan Marketing Team sebagai primary; Startup dan Agency sebagai secondary.
2. Pertahankan pemisahan buyer vs daily user dalam keputusan produk dan messaging.
3. Pertahankan Publishing sebagai fondasi MVP.
4. Pertahankan Engagement dan Analytics sebagai bagian siklus value, bukan ornament.
5. Pertahankan AI Assistant sebagai bantuan in-workflow pada caption/draft.
6. Pertahankan Start Page sebagai capability pendukung, bukan pusat journey mingguan.
7. Pertahankan advanced approval, social listening, white-label, dan enterprise complexity di luar MVP.
8. Jadikan simplicity dan account/publish trust sebagai non-negotiable quality bar.

---

# Implications for Next Phases

## For UX Discovery

* Rancang pengalaman di sekitar siklus mingguan daily user, dengan oversight mode untuk buyer.
* Prioritaskan kejelasan status konten dan account context.
* Hindari pola “feature cafeteria” yang menaikkan cognitive load.
* Tempatkan bantuan AI pada momen draft, bukan sebagai tujuan navigasi utama.

## For Architecture Discovery

* Domain Publishing, Workspace, Engagement, Analytics, dan AI Assistant tetap relevan sebagai bounded contexts produk.
* Reliability publish dan integrasi akun akan menjadi critical path teknis.
* Desain harus mendukung multi-account clarity sejak awal.

Catatan: detail arsitektur tidak dibahas di sini.

---

# Open Questions

Pertanyaan berikut belum ditutup oleh desktop discovery dan dapat dibawa ke fase berikutnya (tanpa memblokir baseline saat ini):

1. Seberapa jauh status handoff perlu divisualisasikan sebelum terasa seperti approval workflow?
2. Setelah MVP komentar/reply tervalidasi, apakah perluasan inbox ke Direct Message atau mention memberi nilai cukup untuk fase berikutnya?
3. Snapshot analytics mingguan mana yang paling sering dipakai buyer pada praktik nyata?
4. Pada agency lean, apakah pemisahan konteks brand cukup melalui account grouping sederhana?

Open questions ini **tidak** mengubah MVP sekarang; digunakan sebagai input riset/validasi berikutnya.

---

# Decision Gate

| Candidate Change | Needed now? | Action |
| ---------------- | ----------- | ------ |
| Ubah primary target market | No | Keep ADR-006 |
| Ubah MVP domains | No | Keep Product Baseline v1.0 |
| Naikkan approval workflow ke MVP | No | Remain Won't Have |
| Turunkan AI dari MVP | No | Keep as in-workflow Must Have |
| Perluas ke individual creator | No | Remain out of MVP focus |

**Conclusion:** User Discovery mendukung arah baseline saat ini. Tidak ada Decision ADR baru yang wajib dibuat pada titik ini.

---

# Expected Output

Setelah dokumen ini selesai, project harus memiliki:

* Insight utama yang terdokumentasi.
* Status asumsi yang jelas (supported / conditional / contradicted).
* Implikasi produk untuk fase berikutnya.
* Keputusan apakah baseline perlu diubah atau tidak.

---

# Exit Criteria

Insights dianggap selesai apabila:

* Observation utama telah dikonsolidasikan.
* Insight actionable telah dirumuskan.
* Assumption inventory telah ditinjau.
* Implikasi terhadap Product/UX/Architecture telah dicatat pada tingkat keputusan.
* Tidak ada perubahan baseline yang tertunda tanpa ADR.

---

# Related Documents

* `README.md`
* `discovery-plan.md`
* `user-segments.md`
* `user-personas.md`
* `user-goals.md`
* `pain-points.md`
* `jobs-to-be-done.md`
* `user-scenarios.md`
* `user-journey.md`
* `../01-business/problem-statement.md`
* `../01-business/target-market.md`
* `../01-business/competitor-analysis.md`
* `../02-product/mvp-definition.md`
* `../02-product/feature-priority.md`
* `../../project-os/PROJECT_OVERVIEW.md`
* `../../project-os/PROJECT_STATE.md`
* `../../project-os/DECISIONS.md`
