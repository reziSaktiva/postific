# User Goals

Dokumen ini mendefinisikan tujuan, motivasi, dan hasil yang ingin dicapai pengguna produk **Postific**.

Goals menjelaskan *apa yang ingin dicapai*, bukan *bagaimana produk menyelesaikannya*.

---

# Overview

User Goals disusun dari segmen dan persona prioritas, lalu dipetakan ke outcome bisnis dan outcome operasional.

Pemahaman goals diperlukan agar MVP tidak hanya menambahkan fitur, tetapi menyelesaikan hasil kerja yang bermakna bagi buyer dan daily user.

---

# Purpose

* Menjelaskan tujuan pengguna secara terstruktur.
* Memisahkan goals buyer dan daily user.
* Menghubungkan motivasi pengguna dengan Problem Statement dan MVP domains.
* Menjadi acuan untuk JTBD, scenarios, dan evaluasi insight.

---

# Scope

## In Scope

* Goals per tipe pengguna (buyer vs daily user).
* Goals per persona prioritas.
* Motivasi di balik goals.
* Desired outcomes yang dapat diamati.
* Mapping goals ke domain produk (tingkat kebutuhan, bukan desain solusi).

## Out of Scope

* Pain points detail (lihat `pain-points.md`).
* JTBD formal (lihat `jobs-to-be-done.md`).
* Current journey (lihat `user-journey.md`).
* Solusi UX/UI atau arsitektur.

---

# Goal Levels

Goals dikelompokkan ke dalam tiga level:

1. **Business Goals** — hasil yang diinginkan organisasi/buyer.
2. **Operational Goals** — hasil kerja harian/mingguan daily user.
3. **Enabling Goals** — kondisi yang membuat operational goals lebih mudah tercapai.

---

# Business Goals (Buyer)

Buyer (Maya, Dimas, Lara) umumnya mengejar:

| Goal ID | Goal | Motivation | Desired Outcome |
| ------- | ---- | ---------- | --------------- |
| BG-01 | Meningkatkan efisiensi operasional tim | Biaya waktu terlalu tinggi untuk pekerjaan administratif | Lebih banyak waktu untuk strategi dan kualitas konten |
| BG-02 | Menstandarkan workflow media sosial | Proses tidak konsisten antar anggota | Cadence dan kualitas lebih dapat diprediksi |
| BG-03 | Meningkatkan visibilitas aktivitas | Sulit tahu status tanpa bertanya | Review progress tanpa meeting berlebih |
| BG-04 | Mengambil keputusan berbasis data | Data tersebar dan lambat dikompilasi | Keputusan mingguan lebih cepat dan cukup akurat |
| BG-05 | Memastikan adopsi tool oleh tim | Tool yang tidak dipakai = biaya sia-sia | Daily user menyelesaikan pekerjaan inti di satu tempat |

---

# Operational Goals (Daily User)

Daily user (Raka, Sinta, serta Dimas pada mode eksekusi) mengejar:

| Goal ID | Goal | Motivation | Desired Outcome |
| ------- | ---- | ---------- | --------------- |
| OG-01 | Menyelesaikan publishing tepat waktu | Konsistensi channel adalah KPI dasar | Konten terjadwal dan terbit sesuai rencana |
| OG-02 | Mengurangi context switching | Perpindahan tool memperlambat dan menimbulkan error | Satu alur kerja untuk draft–schedule–publish |
| OG-03 | Menjaga antrean konten tetap sehat | Kekosongan jadwal berisiko bagi brand | Calendar/queue terlihat jelas dan terisi |
| OG-04 | Menanggapi komentar penting dengan cepat | Engagement memengaruhi persepsi brand | Komentar prioritas dapat ditemukan dan dibalas melalui Comments Inbox |
| OG-05 | Mempercepat pembuatan draft berkualitas | Produksi caption memakan waktu | Draft siap-jadwal lebih cepat dengan sedikit revisi |
| OG-06 | Menghindari kesalahan operasional | Salah akun/salah jadwal berbiaya tinggi | Publish dengan kontrol dan kejelasan akun |

---

# Enabling Goals

Goals pendukung yang sering muncul lintas peran:

| Goal ID | Goal | Why It Matters |
| ------- | ---- | -------------- |
| EG-01 | Onboarding cepat untuk anggota baru | Adopsi gagal jika setup terasa berat |
| EG-02 | Kejelasan ownership konten | Mengurangi miskomunikasi dan duplikasi kerja |
| EG-03 | Akses aset dan konteks brief yang cukup | Draft berkualitas membutuhkan konteks |
| EG-04 | Ringkasan performa yang mudah dibaca | Analytics hanya berguna jika actionable |

---

# Goals by Persona

## Maya — Marketing Manager

* Primary: BG-01, BG-03, BG-04, BG-05
* Secondary: OG-01 (sebagai oversight)

## Raka — Social Media Manager

* Primary: OG-01, OG-02, OG-03, OG-04, OG-06
* Secondary: EG-02, EG-04

## Sinta — Content Creator / Copywriter

* Primary: OG-05, EG-03
* Secondary: OG-02

## Dimas — Startup Growth Lead

* Primary: BG-01, OG-01, OG-05, EG-01
* Secondary: BG-04

## Lara — Agency Social Lead

* Primary: BG-02, BG-03, OG-01, OG-06
* Secondary: BG-04, EG-02

---

# Goals to Product Domain Mapping

Mapping ini menyatakan *kebutuhan*, bukan spesifikasi fitur.

| Goal | Domain paling relevan |
| ---- | --------------------- |
| BG-01, BG-02, BG-05 | Workspace, Publishing |
| BG-03 | Workspace, Publishing Calendar, Analytics |
| BG-04, EG-04 | Analytics |
| OG-01, OG-03, OG-06 | Publishing |
| OG-02 | Publishing + Engagement (konsolidasi workflow) |
| OG-04 | Engagement |
| OG-05 | AI Assistant, Publishing Draft |
| EG-01 | Workspace, Authentication/Onboarding |
| EG-02 | Workspace, Publishing status |
| EG-03 | Publishing Draft, Media Library (Should Have) |

---

# Motivation Patterns

Dari desktop research dan pola kompetitor, motivasi pengguna cenderung mengelompok pada:

1. **Save time** — mengurangi pekerjaan administratif.
2. **Reduce risk** — mencegah miss schedule dan salah publish.
3. **Increase clarity** — status kerja dan performa lebih terlihat.
4. **Improve output quality** — konten lebih konsisten dan lebih cepat diiterasi.

Motivasi “punya banyak fitur” jarang menjadi goal sejati. Fitur hanyalah sarana.

---

# Non-Goals (User Perspective)

Pada fase MVP, pengguna prioritas **tidak** menjadikan hal berikut sebagai goal utama:

* Membangun social listening enterprise.
* Mengotomatisasi seluruh marketing stack.
* Mengelola CRM atau email campaign.
* Menjalankan white-label client portal.

Non-goals ini menjaga fokus discovery tetap pada Social Media Management.

---

# Assumptions Evaluated in This Document

| ID | Assumption | Observation | Status |
| -- | ---------- | ----------- | ------ |
| A-03 | Fragmented workflow adalah masalah inti | Goals OG-02 dan BG-01 muncul kuat lintas persona | Supported |
| A-04 | Kolaborasi penting | BG-02, BG-03, EG-02 muncul pada Marketing Team dan Agency | Supported |
| A-05 | Publishing adalah inti | OG-01 dan OG-03 adalah goals harian paling berulang | Supported |
| A-06 | Analytics/Engagement memperkuat retensi | BG-04 dan OG-04 penting, tetapi setelah publishing stabil | Supported (sequenced) |

---

# Expected Output

Setelah dokumen ini selesai, project harus memiliki:

* Daftar goals yang terstruktur untuk buyer dan daily user.
* Desired outcomes yang dapat diamati.
* Mapping goals ke domain produk pada tingkat kebutuhan.
* Dasar yang jelas untuk menyusun JTBD dan scenarios.

---

# Exit Criteria

User Goals dianggap selesai apabila:

* Business, operational, dan enabling goals telah terdokumentasi.
* Goals buyer dan daily user telah dipisahkan.
* Goals persona prioritas telah dipetakan.
* Mapping ke domain produk tersedia tanpa masuk ke solusi UX.
* Pain points dan JTBD dapat disusun tanpa tumpang tindih tanggung jawab.

---

# Related Documents

* `README.md`
* `discovery-plan.md`
* `user-segments.md`
* `user-personas.md`
* `pain-points.md`
* `jobs-to-be-done.md`
* `user-scenarios.md`
* `insights.md`
* `../01-business/problem-statement.md`
* `../01-business/target-market.md`
* `../02-product/product-scope.md`
* `../02-product/mvp-definition.md`
* `../../project-manager/DECISIONS.md`
