# Pain Points

Dokumen ini mendokumentasikan hambatan dan masalah yang dihadapi pengguna dalam pengelolaan media sosial sehari-hari.

Pain points menjelaskan *apa yang menghambat*, bukan *fitur apa yang harus dibangun*.

---

# Overview

Pain points disusun dari Problem Statement Business Baseline, observasi kompetitor, pola komunitas pengguna tool sejenis, dan konteks kerja persona prioritas.

Tujuan dokumen ini adalah memprioritaskan masalah yang paling berdampak bagi Marketing Team sebagai primary segment, lalu menandai nuansa pada Startup dan Digital Agency.

---

# Purpose

* Mengidentifikasi hambatan utama buyer dan daily user.
* Menghubungkan pain points dengan impact bisnis/operasional.
* Menilai severity untuk prioritas produk.
* Menyediakan dasar evaluasi asumsi sebelum insight difinalisasi.

---

# Scope

## In Scope

* Pain points current-state (sebelum atau di luar produk ini).
* Severity dan frekuensi relatif.
* Siapa yang paling merasakan pain.
* Dampak terhadap goals pengguna.
* Mapping pain ke problem themes.

## Out of Scope

* Solusi UX/UI.
* Spesifikasi fitur.
* Ranking backlog teknis.
* Journey detail (lihat `user-journey.md`).
* JTBD formal (lihat `jobs-to-be-done.md`).

---

# Pain Point Framework

Setiap pain point dinilai dengan:

* **Severity:** High / Medium / Low
* **Frequency:** Daily / Weekly / Occasional
* **Primary sufferers:** Buyer / Daily User / Both
* **Linked goals:** referensi dari `user-goals.md`

---

# Core Pain Themes

Selaras dengan Problem Statement:

1. Fragmented Workflow
2. Inefficient Collaboration
3. Limited Visibility
4. Data-Driven Decision Challenges
5. Growing Operational Complexity

---

# Pain Points Inventory

## PP-01 — Context Switching Across Tools

**Theme:** Fragmented Workflow  
**Severity:** High  
**Frequency:** Daily  
**Sufferers:** Daily User (utama), Buyer (dampak produktivitas)

**Description**

Perencanaan ada di dokumen, aset di storage, scheduling di tool lain, analytics di native dashboard, balasan komentar di app masing-masing platform.

**Impact**

* Waktu hilang untuk perpindahan konteks.
* Risiko inkonsistensi versi konten.
* Kelelahan operasional meningkat.

**Linked Goals:** OG-02, BG-01

---

## PP-02 — Unclear Content Status

**Theme:** Limited Visibility / Inefficient Collaboration  
**Severity:** High  
**Frequency:** Daily  
**Sufferers:** Both

**Description**

Sulit mengetahui apakah konten masih draft, menunggu review, sudah dijadwalkan, gagal publish, atau sudah live — tanpa bertanya di chat.

**Impact**

* Meeting dan chase status berulang.
* Duplikasi kerja.
* Missed deadline.

**Linked Goals:** BG-03, EG-02, OG-01

---

## PP-03 — Collaboration Relies on Chat Threads

**Theme:** Inefficient Collaboration  
**Severity:** High  
**Frequency:** Daily  
**Sufferers:** Daily User, Buyer

**Description**

Brief, feedback, dan approval ringan tersebar di chat/email. Konteks mudah hilang dan sulit ditelusuri kembali.

**Impact**

* Revisi berulang.
* Knowledge tidak tersimpan di tempat kerja.
* Onboarding anggota baru lebih lambat.

**Linked Goals:** BG-02, OG-05, EG-03

---

## PP-04 — Scheduling Errors and Account Confusion

**Theme:** Growing Operational Complexity  
**Severity:** High  
**Frequency:** Weekly (risiko High)  
**Sufferers:** Daily User (utama), Agency Lead

**Description**

Salah pilih akun, salah waktu, atau salah aset semakin mungkin terjadi ketika volume akun meningkat.

**Impact**

* Risiko reputasi brand.
* Rework darurat.
* Kehilangan kepercayaan stakeholder/klien.

**Linked Goals:** OG-06, OG-01

---

## PP-05 — Empty or Fragile Content Queue

**Theme:** Fragmented Workflow  
**Severity:** Medium–High  
**Frequency:** Weekly  
**Sufferers:** Social Media Manager

**Description**

Antrean konten sering tidak terlihat utuh, sehingga kekosongan jadwal baru ketahuan terlambat.

**Impact**

* Posting sporadis.
* Kualitas menurun karena produksi dadakan.
* Cadence brand tidak konsisten.

**Linked Goals:** OG-03, OG-01

---

## PP-06 — Engagement Handling Is Scattered

**Theme:** Fragmented Workflow  
**Severity:** High  
**Frequency:** Daily  
**Sufferers:** Community Manager / Social Media Manager

**Description**

Dalam kondisi saat ini, komentar dan pesan harus dicek per platform native. Prioritas interaksi mudah terlewat. Solusi MVP mengurangi pain ini untuk komentar dan reply; Direct Message dan mention belum dikonsolidasikan (ADR-040).

**Impact**

* Response time lambat.
* Peluang engagement hilang.
* Persepsi brand menurun.

**Linked Goals:** OG-04

---

## PP-07 — Analytics Take Too Long to Assemble

**Theme:** Data-Driven Decision Challenges  
**Severity:** Medium–High  
**Frequency:** Weekly  
**Sufferers:** Buyer (utama), Social Media Manager

**Description**

Data performa tersebar. Membuat ringkasan mingguan membutuhkan export manual dan kompilasi.

**Impact**

* Keputusan lambat.
* Reporting melelahkan.
* Insight datang setelah momentum lewat.

**Linked Goals:** BG-04, EG-04

---

## PP-08 — Caption Production Is Slow

**Theme:** Operational Complexity  
**Severity:** Medium  
**Frequency:** Daily  
**Sufferers:** Content Creator, Startup Growth Lead

**Description**

Menulis banyak variasi caption dengan tone yang tepat memakan waktu, terutama saat volume konten naik.

**Impact**

* Bottleneck produksi.
* Ketergantungan pada satu penulis.
* Jadwal tertunda.

**Linked Goals:** OG-05

---

## PP-09 — Tool Adoption Fails When Complexity Is High

**Theme:** Growing Operational Complexity  
**Severity:** High (untuk buyer)  
**Frequency:** Occasional (tapi impact besar)  
**Sufferers:** Buyer

**Description**

Tim menolak atau setengah-menggunakan tool yang terasa rumit, sehingga investasi tidak berbuah.

**Impact**

* Shadow process kembali ke spreadsheet/chat.
* ROI tool tidak tercapai.
* Buyer kehilangan kepercayaan pada kategori produk.

**Linked Goals:** BG-05, EG-01

---

## PP-10 — Multi-Client Context Overload (Agency)

**Theme:** Growing Operational Complexity  
**Severity:** High (Agency)  
**Frequency:** Daily  
**Sufferers:** Agency Social Lead / Managers

**Description**

Beralih antar klien tanpa batasan konteks yang jelas meningkatkan risiko error dan kelelahan.

**Impact**

* Salah brand / salah aset.
* Delivery quality tidak konsisten.
* Oversight menjadi mahal.

**Linked Goals:** OG-06, BG-02, BG-03

---

# Severity Summary

| ID | Pain Point | Severity | MVP Relevance |
| -- | ---------- | -------- | ------------- |
| PP-01 | Context switching | High | Critical |
| PP-02 | Unclear content status | High | Critical |
| PP-03 | Chat-based collaboration | High | High |
| PP-04 | Scheduling/account errors | High | Critical |
| PP-05 | Fragile content queue | Medium–High | High |
| PP-06 | Scattered engagement | High | High |
| PP-07 | Slow analytics assembly | Medium–High | High (after publishing) |
| PP-08 | Slow caption production | Medium | Medium–High (AI assist) |
| PP-09 | Adoption friction | High | Critical for PMF |
| PP-10 | Multi-client overload | High (secondary) | Medium for MVP, higher later |

---

# Pain Points by Persona

| Persona | Top Pain Points |
| ------- | --------------- |
| Maya | PP-02, PP-07, PP-09, PP-03 |
| Raka | PP-01, PP-02, PP-04, PP-05, PP-06 |
| Sinta | PP-03, PP-08, PP-02 |
| Dimas | PP-01, PP-08, PP-09, PP-07 |
| Lara | PP-10, PP-04, PP-02, PP-07 |

---

# What This Implies (Without Designing Solutions)

Pain points mengarahkan fokus produk pada:

* Konsolidasi workflow publishing sebagai fondasi.
* Kejelasan status konten dan akun.
* Pengurangan risiko operasional.
* Comments Inbox dengan reply, periodic pull 30 menit, dan manual refresh yang cukup untuk triage harian.
* Analytics ringkas yang menghemat waktu buyer.
* AI yang mempercepat draft di dalam alur kerja.
* Kesederhanaan onboarding agar adopsi tim terjadi.

Implikasi keputusan produk difinalisasi pada `insights.md`.

---

# Assumptions Evaluated in This Document

| ID | Assumption | Observation | Status |
| -- | ---------- | ----------- | ------ |
| A-03 | Fragmented workflow adalah masalah utama | PP-01, PP-06 muncul berulang | Supported |
| A-04 | Kolaborasi adalah diferensiator | PP-02, PP-03 menunjukkan gap kolaborasi current-state | Supported |
| A-06 | Analytics/Engagement penting setelah publishing | PP-06 high; PP-07 high untuk buyer tetapi weekly | Supported |
| A-10 | Pengguna mau konsolidasi jika sederhana | PP-09 menunjukkan adopsi gagal saat kompleks | Supported (conditional) |

---

# Expected Output

Setelah dokumen ini selesai, project harus memiliki:

* Inventaris pain points yang terprioritaskan.
* Pemetaan pain ke theme Problem Statement.
* Kejelasan siapa yang paling merasakan setiap pain.
* Dasar untuk JTBD, journey, dan insight.

---

# Exit Criteria

Pain Points dianggap selesai apabila:

* Pain points utama telah terdokumentasi.
* Severity dan sufferers telah ditetapkan.
* Mapping ke goals tersedia.
* Tidak ada usulan solusi UX di dalam dokumen ini.
* Insights dapat disusun berdasarkan evidence pain points.

---

# Related Documents

* `README.md`
* `discovery-plan.md`
* `user-segments.md`
* `user-personas.md`
* `user-goals.md`
* `jobs-to-be-done.md`
* `user-journey.md`
* `insights.md`
* `../01-business/problem-statement.md`
* `../01-business/competitor-analysis.md`
* `../02-product/mvp-definition.md`
* `../../project-os/DECISIONS.md`
