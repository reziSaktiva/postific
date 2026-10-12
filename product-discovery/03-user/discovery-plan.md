# Discovery Plan

Dokumen ini menetapkan tujuan, pertanyaan, sumber referensi, metode, aturan validasi, dan batasan **User Discovery** untuk produk **Postific**.

Dokumen ini menjadi titik masuk sebelum segmentasi, persona, goals, pain points, Jobs To Be Done (JTBD), scenarios, journey, dan insights disusun.

---

# Overview

User Discovery pada project ini dilakukan melalui **desktop research** dan **product discovery**, bukan melalui interview, survei, atau usability testing.

Tujuan fase ini adalah memahami pengguna secara cukup dalam untuk mengevaluasi asumsi Business dan Product Baseline, serta menghasilkan insight yang dapat menjadi dasar UX Discovery dan Architecture Discovery.

Seluruh proses mengikuti vocabulary project:

```text
Assumption
    ↓
Discovery
    ↓
Observation
    ↓
Insight
    ↓
Decision
```

Setiap keputusan yang memengaruhi baseline harus dapat ditelusuri kembali ke observation yang mendukungnya.

---

# Purpose

* Menetapkan tujuan User Discovery yang terukur.
* Merumuskan discovery questions yang relevan dengan Business dan Product Baseline.
* Menentukan sumber referensi yang sah digunakan pada fase ini.
* Menentukan metode dan aturan validasi discovery.
* Membatasi ruang lingkup agar discovery tetap fokus dan dapat ditindaklanjuti.
* Menyediakan kerangka kerja yang konsisten untuk seluruh dokumen User Discovery.

---

# Scope

## In Scope

* Discovery objectives.
* Discovery questions.
* Assumption inventory yang akan dievaluasi.
* Desktop research dan product observation.
* Observation capture.
* Insight synthesis.
* Discovery evidence.
* Discovery confidence.
* Kriteria kualitas insight.
* Discovery risks.
* Decision readiness.

## Out of Scope

* Interview pengguna.
* Customer survey.
* Focus group.
* Usability testing.
* UX Design.
* UI Design.
* Wireframe.
* Prototype.
* User Flow solution.
* Information Architecture.
* Technical Architecture.
* Database Design.
* API Design.
* Implementation.
* Perubahan Target Market, Problem Statement, Product Scope, atau MVP tanpa melalui proses Decision.

---

# Discovery Objectives

User Discovery harus mampu menjawab pertanyaan berikut pada tingkat produk.

1. Siapa pengguna utama dan pengguna sekunder yang paling relevan dengan MVP?
2. Siapa yang membeli produk, dan siapa yang menggunakannya setiap hari?
3. Apa tujuan utama pengguna ketika mengelola media sosial sebagai tim?
4. Pain point mana yang paling sering muncul dan paling berdampak?
5. Jobs To Be Done apa yang harus didukung produk agar dianggap berguna?
6. Bagaimana current-state journey pengguna sebelum menggunakan produk ini?
7. Faktor apa yang memengaruhi adopsi atau penolakan terhadap tool Social Media Management?
8. Asumsi mana dari Business dan Product Baseline yang didukung, belum didukung, atau bertentangan?

---

# Discovery Questions

## Segment & Role

* Siapa yang paling merasakan fragmented workflow dalam pengelolaan media sosial?
* Bagaimana perbedaan kebutuhan Marketing Team, Startup, dan Digital Agency?
* Apa perbedaan keputusan buyer dengan kebutuhan daily user?

---

## Goals & Motivation

* Hasil kerja apa yang ingin dicapai pengguna setiap minggu?
* Motivasi apa yang mendorong adopsi tool Social Media Management?
* Apa yang membuat sebuah tool dianggap berguna oleh tim marketing?

---

## Pain Points

* Di mana perpindahan konteks paling sering terjadi?
* Bagian mana dari kolaborasi yang paling sering gagal tanpa tool terpusat?
* Mengapa analytics dan engagement sering menjadi bottleneck?

---

## Jobs To Be Done

* Pekerjaan fungsional apa yang harus selesai agar hari kerja pengguna dianggap sukses?
* Pekerjaan emosional apa yang muncul di balik pekerjaan operasional?
* Pekerjaan sosial apa yang ingin dicapai pengguna dalam tim atau organisasi?

---

## Tool Adoption

* Mengapa tim tetap menggunakan spreadsheet atau tool terpisah?
* Apa penyebab utama tim berpindah ke tool baru?
* Hambatan apa yang membuat onboarding gagal?
* Faktor apa yang membuat seluruh tim mau menggunakan platform yang sama?
* Alasan apa yang membuat pengguna berhenti menggunakan tool sebelumnya?

---

## Product Fit

* Modul MVP mana yang paling dekat dengan pekerjaan harian pengguna?
* Fitur mana yang penting bagi buyer tetapi jarang disentuh daily user?
* Di mana risiko overbuilding fitur paling tinggi berdasarkan perilaku pengguna?

---

# Assumption Inventory

Asumsi berikut diwariskan dari Business Baseline v1.0 dan Product Baseline v1.0, lalu akan dievaluasi sepanjang User Discovery.

| ID | Assumption | Source | Initial Status |
| --- | ---------- | ------ | -------------- |
| A-01 | Marketing Team adalah primary user yang paling cocok untuk MVP | ADR-006, Target Market | To Validate |
| A-02 | Buyer dan daily user sering berbeda orang | Target Market | To Validate |
| A-03 | Masalah utama adalah fragmented workflow lintas tool | Problem Statement | To Validate |
| A-04 | Kolaborasi tim adalah diferensiator penting | Competitor Analysis | To Validate |
| A-05 | Publishing adalah pekerjaan inti yang harus diselesaikan lebih dulu | MVP Definition | To Validate |
| A-06 | Analytics dan Engagement memperkuat retensi setelah Publishing berjalan | Feature Priority | To Validate |
| A-07 | AI Assistant berguna apabila terintegrasi ke workflow, bukan berdiri sendiri | Competitor Analysis | To Validate |
| A-08 | Individual Creator bukan fokus MVP | Target Market | To Validate |
| A-09 | Startup dan Digital Agency memiliki pola kerja mirip Marketing Team dengan konteks berbeda | Target Market | To Validate |
| A-10 | Pengguna bersedia mengonsolidasikan pekerjaan ke satu dashboard apabila onboarding sederhana | Product Vision | To Validate |

Status akhir setiap asumsi dicatat pada `insights.md`.

---

# Discovery Sources

## Product References

* Buffer.
* Postiz.
* Hootsuite.
* Later.
* Metricool.

---

## Market Signals

* Reddit.
* G2.
* Capterra.
* Product Hunt.
* Diskusi publik di X/Twitter.
* Community discussion mengenai Social Media Management.

---

## Public Knowledge

* Official documentation.
* Industry article.
* Public case study.
* Video walkthrough.
* Product review.
* Conference talk.
* Blog engineering atau product.

---

## Internal Baseline

* `../01-business/`
* `../02-product/`
* `../../project-manager/PROJECT_OVERVIEW.md`
* `../../project-manager/PROJECT_RULES.md`
* `../../project-manager/DECISIONS.md`

---

## Excluded Sources

Sumber berikut tidak digunakan pada fase ini.

* Interview.
* Customer survey.
* Focus group.
* Usability testing.
* AI-generated content tanpa sumber yang dapat diverifikasi.

---

# Discovery Method

## 1. Assumption Framing

Seluruh discovery dimulai dari asumsi yang telah tercatat.

Discovery tidak dimulai dari solusi maupun opini.

---

## 2. Desktop Discovery

Mengumpulkan evidence dari berbagai sumber publik dan product reference.

---

## 3. Observation Capture

Observation hanya berisi fakta atau pola yang berhasil diamati.

Observation tidak boleh berisi interpretasi maupun rekomendasi.

Contoh:

**Observation**

Marketing Team sering menggunakan Google Docs untuk perencanaan, Canva untuk desain, Buffer untuk publishing, dan aplikasi native untuk engagement.

**Evidence**

* Buffer Documentation.
* Reddit Discussion.
* Product Walkthrough.

**Confidence**

High

---

## 4. Insight Synthesis

Insight merupakan interpretasi dari satu atau lebih observation.

Insight harus menjelaskan:

* apa yang terjadi,
* mengapa hal tersebut penting,
* siapa yang terdampak,
* bagaimana dampaknya terhadap produk.

---

## 5. Decision Gate

Apabila insight memengaruhi Business Baseline, Product Baseline, atau Project Rules, perubahan harus melalui proses Decision dan dicatat pada `../../project-manager/DECISIONS.md` sebelum dokumen lain diperbarui.

---

# Evidence Rules

Observation dianggap valid apabila memenuhi salah satu kondisi berikut.

* Didukung minimal dua sumber independen.
* Berasal dari dokumentasi resmi produk.
* Berulang pada beberapa kompetitor.
* Berulang pada beberapa komunitas yang berbeda.

Observation yang hanya berasal dari satu opini tanpa validasi tambahan tidak boleh menjadi dasar perubahan keputusan.

---

# Confidence Level

Setiap observation sebaiknya memiliki tingkat keyakinan.

| Level | Description |
| ------ | ----------- |
| High | Didukung oleh banyak sumber yang konsisten. |
| Medium | Didukung beberapa sumber tetapi masih memiliki variasi. |
| Low | Bukti masih terbatas atau belum konsisten. |

Confidence digunakan untuk membantu prioritas, bukan sebagai keputusan akhir.

---

# Quality Criteria for Insights

Sebuah insight layak digunakan apabila:

* Berasal dari observation yang memiliki evidence.
* Relevan dengan Target Market.
* Relevan dengan Problem Statement.
* Membantu keputusan Product, UX, atau Architecture.
* Tidak mencampurkan solusi UX atau UI.
* Menjelaskan dampaknya terhadap buyer, daily user, atau keduanya.
* Dapat ditelusuri kembali ke observation yang mendukungnya.

---

# Discovery Risks

Beberapa risiko yang perlu diperhatikan selama User Discovery.

* Desktop research dapat bias terhadap produk populer.
* Community discussion sering didominasi pengalaman negatif.
* Kompetitor belum tentu memiliki target market yang sama.
* Artikel opini tidak selalu mewakili perilaku mayoritas pengguna.
* AI-generated summary tidak dianggap sebagai evidence.

---

# Traceability

Setiap hasil discovery sebaiknya memiliki hubungan yang dapat ditelusuri.

```text
Assumption
    ↓
Observation
    ↓
Insight
    ↓
Decision
```

Contoh identitas:

```text
A-001
↓

OBS-003

↓

INS-002

↓

ADR-007
```

Dengan pendekatan ini seluruh keputusan dapat diaudit kembali pada masa mendatang.

---

# Document Ownership Map

| Document | Responsibility |
| -------- | -------------- |
| `discovery-plan.md` | Tujuan, metode, aturan, sumber, dan governance User Discovery |
| `user-segments.md` | Segmentasi pengguna, buyer, daily user, dan prioritas |
| `user-personas.md` | Persona yang merepresentasikan kelompok pengguna |
| `user-goals.md` | Tujuan, motivasi, dan outcome pengguna |
| `pain-points.md` | Hambatan dan masalah pengguna |
| `jobs-to-be-done.md` | Functional, Emotional, dan Social Jobs |
| `user-scenarios.md` | Situasi penggunaan nyata |
| `user-journey.md` | Current-state journey tanpa solusi |
| `insights.md` | Observation, insight, validasi asumsi, dan implikasi keputusan |

Setiap dokumen memiliki tanggung jawab tunggal dan tidak mengulang isi dokumen lainnya.

---

# Expected Output

Setelah Discovery Plan digunakan, project harus memiliki:

* Discovery objectives yang jelas.
* Discovery questions yang dapat dijawab.
* Assumption inventory yang tervalidasi.
* Observation yang memiliki evidence.
* Insight yang dapat ditindaklanjuti.
* Decision yang dapat ditelusuri.
* Kerangka kerja User Discovery yang konsisten.

---

# Success Criteria

Fase User Discovery dianggap berhasil apabila:

* Seluruh discovery questions telah memiliki observation.
* Seluruh assumption telah dievaluasi.
* Seluruh insight memiliki evidence yang jelas.
* Seluruh insight dapat ditelusuri ke observation.
* Tidak ada keputusan produk yang dibuat tanpa insight.

---

# Exit Criteria

Discovery Plan dianggap selesai apabila:

* Discovery objectives telah ditetapkan.
* Discovery questions telah dirumuskan.
* Assumption inventory telah tersedia.
* Discovery method telah ditetapkan.
* Evidence rules telah disepakati.
* Confidence level telah didefinisikan.
* Discovery risks telah didokumentasikan.
* Batasan fase telah disepakati.
* Seluruh dokumen User Discovery menggunakan Discovery Plan sebagai acuan utama.

---

# Related Documents

* `README.md`
* `user-segments.md`
* `user-personas.md`
* `user-goals.md`
* `pain-points.md`
* `jobs-to-be-done.md`
* `user-scenarios.md`
* `user-journey.md`
* `insights.md`
* `../01-business/target-market.md`
* `../01-business/problem-statement.md`
* `../01-business/competitor-analysis.md`
* `../02-product/mvp-definition.md`
* `../02-product/feature-priority.md`
* `../../project-manager/PROJECT_OVERVIEW.md`
* `../../project-manager/PROJECT_RULES.md`
* `../../project-manager/DECISIONS.md`