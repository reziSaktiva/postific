# User Journey

Dokumen ini memetakan **current-state user journey** pengelolaan media sosial bagi pengguna prioritas.

Journey ini menggambarkan kondisi kerja saat ini — sebelum atau di luar produk — tanpa menawarkan solusi UX, wireframe, atau flow desain.

---

# Overview

Current-state journey disusun untuk Marketing Team sebagai primary segment, dengan catatan variasi untuk Startup dan Digital Agency.

Tujuan journey bukan merancang pengalaman ideal, melainkan menunjukkan di mana friction muncul di sepanjang siklus kerja nyata.

---

# Purpose

* Memvisualisasikan alur kerja current-state dari perencanaan hingga evaluasi.
* Menandai pain points pada tahap spesifik journey.
* Menunjukkan perbedaan pengalaman buyer dan daily user.
* Memberi dasar observasi untuk insight produk.

---

# Scope

## In Scope

* Current-state journey Marketing Team.
* Tahapan, actions, tools yang biasa dipakai, emotions, dan friction.
* Touchpoint lintas tool.
* Variasi singkat untuk Startup dan Agency.
* Opportunity areas (bukan solution design).

## Out of Scope

* Future-state journey.
* User flow solution.
* Information architecture.
* UI/UX design.
* Technical sequence diagram.

---

# Journey Lens

Journey utama mengikuti sudut pandang:

* **Primary actor:** Raka (Social Media Manager)
* **Supporting actors:** Sinta (Creator), Maya (Manager/Buyer)
* **Timebox:** satu siklus mingguan yang tipikal

---

# Current-State Journey Map

## Stage 1 — Intake & Briefing

**Goal of stage:** Memahami apa yang perlu dipublish.

| Aspect | Detail |
| ------ | ------ |
| Actions | Menerima brief kampanye/konten dari manager atau dokumen perencanaan |
| Common tools | Chat, docs, email, meeting notes |
| Actors | Maya → Raka → Sinta |
| Emotion | Netral hingga sedikit overloaded bila brief tidak lengkap |
| Friction | Brief tersebar; konteks aset tidak lengkap; ownership tidak jelas |
| Related | S-01, PP-03, J-06 |

**Opportunity area:** Menyatukan konteks brief dengan status pekerjaan konten.

---

## Stage 2 — Content Production

**Goal of stage:** Menghasilkan draft caption dan aset siap pakai.

| Aspect | Detail |
| ------ | ------ |
| Actions | Menulis caption, menyiapkan visual/video, iterasi tone |
| Common tools | Docs, design tools, drive/storage, chat untuk feedback |
| Actors | Sinta (utama), Raka (review ringan) |
| Emotion | Fokus, tetapi mudah frustration saat revisi berulang |
| Friction | Versi final tidak jelas; produksi caption lambat; feedback hilang di thread |
| Related | S-04, PP-08, PP-03, J-05, J-06 |

**Opportunity area:** Mempercepat draft dan menjaga versi/status tetap terlihat.

---

## Stage 3 — Scheduling & Queue Setup

**Goal of stage:** Memasukkan konten ke jadwal lintas akun.

| Aspect | Detail |
| ------ | ------ |
| Actions | Memilih akun, menentukan waktu, mengisi scheduler/queue, cek bentrok |
| Common tools | Scheduling tool, spreadsheet calendar, native schedulers |
| Actors | Raka |
| Emotion | Hati-hati; anxiety terhadap salah akun/waktu |
| Friction | Context switching dari docs ke scheduler; status tidak sinkron ke tim; risiko PP-04 |
| Related | S-01, S-02, PP-01, PP-04, PP-05, J-01, J-03 |

**Opportunity area:** Menyederhanakan path draft → schedule dengan kejelasan akun.

---

## Stage 4 — Pre-Publish Verification

**Goal of stage:** Memastikan yang terjadwal benar-benar siap.

| Aspect | Detail |
| ------ | ------ |
| Actions | Mengecek preview, aset, caption final, waktu lokal, akun tujuan |
| Common tools | Scheduler + native apps |
| Actors | Raka, kadang Maya |
| Emotion | Tegang menjelang slot penting |
| Friction | Verifikasi ganda memakan waktu; anggota lain tidak melihat status yang sama |
| Related | S-03, PP-02, J-02, J-03 |

**Opportunity area:** Visibilitas status “ready / scheduled / at risk”.

---

## Stage 5 — Publish & Monitor

**Goal of stage:** Memastikan konten berhasil live.

| Aspect | Detail |
| ------ | ------ |
| Actions | Memantau eksekusi schedule, menangani gagal publish, konfirmasi live |
| Common tools | Scheduler notifications, native apps |
| Actors | Raka |
| Emotion | Relief jika sukses; stress jika gagal |
| Friction | Kegagalan sering baru ketahuan belakangan; recovery manual |
| Related | S-03, PP-04, J-02, J-03 |

**Opportunity area:** Kejelasan hasil publish dan kegagalan secara dini.

---

## Stage 6 — Engagement Handling

**Goal of stage:** Menanggapi interaksi audiens yang penting.

| Aspect | Detail |
| ------ | ------ |
| Actions | Cek komentar dan pesan di native app, prioritaskan, balas, escalate bila perlu |
| Common tools | Native Instagram/Facebook/X/LinkedIn apps, kadang inbox tool terpisah |
| Actors | Raka / Community Manager |
| Emotion | Terpecah perhatian; FOMO terhadap komentar penting |
| Friction | Inbox tersebar; prioritas tidak terpusat; response time tidak konsisten |
| Related | S-05, PP-06, PP-01, J-04 |

**Opportunity area:** Untuk MVP, konsolidasikan komentar dan reply melalui periodic pull 30 menit + manual refresh. Direct Message, mention, dan webhook engagement tetap di luar scope (ADR-040).

---

## Stage 7 — Performance Review

**Goal of stage:** Memahami apa yang bekerja dan apa yang perlu diubah.

| Aspect | Detail |
| ------ | ------ |
| Actions | Mengambil metrik, menyusun ringkasan, diskusi keputusan konten berikutnya |
| Common tools | Native insights, exports, spreadsheet, slide/docs laporan |
| Actors | Maya (utama), Raka mendukung, Lara pada konteks agency |
| Emotion | Lelah administratif; ingin cepat ke keputusan |
| Friction | Kompilasi lambat; insight terlambat; meeting habis untuk data gathering |
| Related | S-06, PP-07, J-07, J-08 |

**Opportunity area:** Snapshot performa yang cukup untuk keputusan mingguan.

---

## Stage 8 — Process Retrospective & Tool Friction

**Goal of stage:** Menilai apakah cara kerja tim masih sustainable.

| Aspect | Detail |
| ------ | ------ |
| Actions | Buyer mengevaluasi overload tool, onboarding anggota baru, biaya proses |
| Common tools | Seluruh stack yang dipakai tim |
| Actors | Maya / Dimas / Agency Owner |
| Emotion | Skeptis terhadap tool baru; khawatir adopsi gagal |
| Friction | Stack terlalu banyak; training mahal; daily user resisten pada kompleksitas |
| Related | S-07, S-09, PP-09, J-09, J-10 |

**Opportunity area:** Menurunkan biaya adopsi dan jumlah context switches.

---

# Journey Swimlane Summary

```text
Maya (Buyer)     : Brief → Oversight status → Weekly review → Tool evaluation
Raka (Daily)     : Intake → Schedule → Verify → Publish monitor → Engagement triage → Support reporting
Sinta (Creator)  : Produce drafts → Revise → Hand off
Tools (current)  : Chat/Docs → Design/Drive → Scheduler → Native apps → Analytics exports
```

Pola yang paling terlihat: **pekerjaan satu siklus tersebar di banyak sistem**.

---

# Emotion Curve (Current-State)

| Stage | Emotion signal |
| ----- | -------------- |
| Intake | Ambiguity |
| Production | Effortful focus |
| Scheduling | Caution / anxiety |
| Verification | Tension |
| Publish | Relief or stress |
| Engagement | Fragmented attention |
| Review | Admin fatigue |
| Tool evaluation | Adoption skepticism |

Journey yang berhasil di masa depan harus menurunkan anxiety pada scheduling/publish dan admin fatigue pada review — tanpa menambah kompleksitas di onboarding.

---

# Segment Variations

## Startup Variation

* Lebih sedikit handoff; buyer sering = daily user.
* Stage production dan scheduling sering dilakukan orang yang sama.
* Sensitivitas tinggi terhadap time-to-value dan kesederhanaan.

## Agency Variation

* Stage yang sama berulang per klien.
* Friction terbesar pada context switching antar brand (PP-10).
* Verification dan account clarity lebih kritis.

---

# Opportunity Areas (Non-Solution)

Dari current-state journey, peluang produk yang paling jelas:

1. Mengurangi jumlah sistem yang dibutuhkan untuk menyelesaikan satu siklus konten.
2. Membuat status konten terlihat lintas peran.
3. Menurunkan risiko salah publish.
4. Menyediakan engagement triage yang cukup untuk pekerjaan harian.
5. Menyediakan analytics snapshot untuk keputusan mingguan.
6. Menjaga onboarding tetap ringan agar adopsi tim terjadi.

Peluang ini akan dikonsolidasikan sebagai insight pada `insights.md`.

---

# Assumptions Evaluated in This Document

| ID | Assumption | Observation | Status |
| -- | ---------- | ----------- | ------ |
| A-03 | Fragmented workflow adalah inti masalah | Journey melewati banyak tools di setiap stage | Supported |
| A-05 | Publishing adalah inti | Stage 3–5 adalah pusat ritme mingguan | Supported |
| A-06 | Engagement & Analytics memperkuat siklus | Stage 6–7 terjadi rutin setelah publish | Supported |
| A-02 | Buyer ≠ daily user | Swimlane Maya vs Raka/Sinta berbeda jelas | Supported |

---

# Expected Output

Setelah dokumen ini selesai, project harus memiliki:

* Current-state journey yang terdokumentasi.
* Friction per stage yang jelas.
* Perbedaan peran buyer dan daily user pada journey.
* Opportunity areas yang siap disintesiskan menjadi insight.

---

# Exit Criteria

User Journey dianggap selesai apabila:

* Siklus mingguan current-state telah dipetakan end-to-end.
* Setiap stage memiliki actions, tools, friction, dan related references.
* Variasi Startup dan Agency telah dicatat.
* Tidak ada future-state solution design pada dokumen ini.
* Insights dapat disusun berdasarkan observasi journey.

---

# Related Documents

* `README.md`
* `discovery-plan.md`
* `user-personas.md`
* `user-goals.md`
* `pain-points.md`
* `jobs-to-be-done.md`
* `user-scenarios.md`
* `insights.md`
* `../01-business/problem-statement.md`
* `../02-product/mvp-definition.md`
* `../../project-os/DECISIONS.md`
