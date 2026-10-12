# User Segments

Dokumen ini mendefinisikan kelompok pengguna produk **Postific**, membedakan buyer dan daily user, serta menetapkan prioritas segmen untuk MVP.

Segmentasi ini harus konsisten dengan Business Baseline v1.0 dan menjadi dasar bagi Persona, User Goals, Pain Points, JTBD, UX Discovery, dan Architecture Discovery.

---

# Overview

User Segments menjelaskan **siapa** yang menjadi target produk, bukan **bagaimana** mereka menggunakan fitur.

Pada project ini, unit analisis utama adalah **Organization**, sedangkan pengguna (User) merupakan anggota dari organisasi tersebut.

Karena itu, segmentasi dilakukan berdasarkan karakteristik organisasi terlebih dahulu, kemudian diikuti dengan identifikasi buyer dan daily user.

Produk ini berfokus pada organisasi yang mengelola media sosial secara kolaboratif.

Segmen Individual Creator, Influencer, maupun Personal Brand tidak menjadi fokus MVP.

---

# Purpose

* Menerjemahkan Target Market menjadi segmen pengguna yang actionable.
* Menentukan Ideal Customer Profile (ICP).
* Memisahkan buyer dan daily user secara eksplisit.
* Menentukan prioritas segmen untuk MVP.
* Memberikan dasar yang konsisten bagi Persona, Goals, JTBD, UX, dan Architecture.

---

# Scope

## In Scope

* Primary dan secondary user segments.
* Ideal Customer Profile.
* Buyer vs Daily User.
* Karakteristik organisasi.
* Prioritas segmen.
* Non-priority segment.

## Out of Scope

* Persona individu.
* Goals.
* Pain Points.
* JTBD.
* User Journey.
* UX Solution.
* Permission System.
* Technical Architecture.

---

# Segmentation Principles

Segmentasi dilakukan berdasarkan kombinasi beberapa dimensi berikut.

* Jenis organisasi.
* Cara tim berkolaborasi.
* Intensitas publishing.
* Jumlah akun media sosial.
* Kompleksitas workflow.
* Perbedaan buyer dan daily user.

Segmentasi **tidak** dilakukan berdasarkan ukuran perusahaan semata.

---

# Ideal Customer Profile (ICP)

Organisasi yang paling sesuai dengan MVP memiliki karakteristik berikut.

* Mengelola lebih dari satu akun media sosial.
* Memiliki lebih dari satu anggota yang terlibat dalam workflow.
* Mempublikasikan konten secara rutin.
* Sudah mengalami context switching antar tool.
* Membutuhkan visibilitas pekerjaan lintas anggota.
* Mulai membutuhkan standardisasi workflow.

Semakin banyak karakteristik di atas terpenuhi, semakin tinggi product fit terhadap MVP.

---

# Primary Segment

## Marketing Team

**Priority:** P0

Marketing Team merupakan segmen utama untuk MVP.

Segmen ini terdiri dari organisasi yang memiliki tim internal untuk mengelola media sosial satu atau beberapa brand.

### Organization Characteristics

* Tim berukuran sekitar 3–20 orang.
* Memiliki pembagian tanggung jawab yang jelas.
* Mengelola lebih dari satu channel media sosial.
* Memiliki publishing cadence yang konsisten.
* Menggunakan analytics untuk evaluasi.

### Why Primary

* Memiliki kebutuhan kolaborasi paling tinggi.
* Mengalami fragmented workflow paling sering.
* Nilai produk paling mudah dibuktikan.
* Selaras dengan Product Vision dan Business Baseline.

### Typical Buyer

* Marketing Manager
* Head of Marketing
* Founder (organisasi kecil)

### Typical Daily Users

* Social Media Manager
* Social Media Specialist
* Content Creator
* Copywriter
* Community Manager

---

# Secondary Segments

## Startup

**Priority:** P1

Startup dengan tim marketing internal yang mulai berkembang.

### Organization Characteristics

* Tim kecil.
* Banyak anggota memiliki peran ganda.
* Fokus pada kecepatan eksekusi.
* Membutuhkan onboarding yang sederhana.
* Workflow mulai berkembang tetapi belum kompleks.

### Buyer

* Founder
* Marketing Lead
* Growth Lead

### Daily Users

* Marketing Generalist
* Social Media Owner
* Content Creator

### Product Fit

Cocok apabila startup telah memiliki ritme publishing yang konsisten.

---

## Digital Agency

**Priority:** P1

Agency yang mengelola media sosial beberapa klien sekaligus.

### Organization Characteristics

* Multi-client.
* Multi-brand.
* Deadline tinggi.
* Workflow berulang.
* Membutuhkan visibilitas lintas klien.

### Buyer

* Agency Owner
* Operations Lead
* Account Director

### Daily Users

* Social Media Manager
* Community Manager
* Content Creator
* Account Coordinator

### Product Fit

Cocok untuk agency kecil hingga menengah yang membutuhkan dashboard terpusat tanpa kompleksitas enterprise.

---

# Buyer vs Daily User

Buyer dan Daily User memiliki kebutuhan yang berbeda.

| Dimension | Buyer | Daily User |
| ---------- | ------ | ---------- |
| Success | Tim lebih produktif | Pekerjaan selesai lebih cepat |
| Concern | ROI, biaya, adopsi tim | Kecepatan workflow |
| Value | Efisiensi organisasi | Efisiensi operasional |
| Evaluates | Workspace, Reporting, Analytics | Publishing, Calendar, Engagement |
| Risk | Produk terlalu kompleks | Produk memperlambat pekerjaan |

Produk harus mampu memenangkan kedua perspektif.

Buyer membeli produk.

Daily User menentukan retensi.

---

# Segment Priority

| Segment | Priority | Decision |
| ------- | -------- | -------- |
| Marketing Team | P0 | Seluruh MVP dioptimalkan untuk segmen ini |
| Startup | P1 | Didukung tanpa mengorbankan Marketing Team |
| Digital Agency | P1 | Didukung selama tidak menambah kompleksitas enterprise |
| Individual Creator | P3 | Tidak menjadi dasar keputusan MVP |
| Enterprise | Future | Dievaluasi setelah Product-Market Fit |

---

# Segment Decision Criteria

Segmen layak menjadi target MVP apabila memenuhi sebagian besar kondisi berikut.

* Workflow dilakukan oleh lebih dari satu orang.
* Publishing dilakukan secara rutin.
* Mengelola lebih dari satu akun media sosial.
* Memiliki kebutuhan koordinasi.
* Mengalami context switching antar tool.
* Membutuhkan dashboard terpusat.

Apabila sebagian besar kondisi tidak terpenuhi, segmen tersebut tidak menjadi prioritas MVP.

---

# Anti-ICP

Segmen berikut bukan target MVP.

* Individual Creator.
* Influencer.
* Personal Brand.
* Hobbyist.
* Freelance Social Media Manager yang bekerja sendiri.
* Enterprise dengan compliance kompleks.
* Agency yang membutuhkan white-label.
* Organisasi yang belum memiliki workflow media sosial yang rutin.

Keputusan produk tidak boleh dioptimalkan untuk segmen di atas.

---

# Expansion Opportunity

Setelah Product-Market Fit tercapai pada Primary Segment, peluang ekspansi dapat mencakup:

* Individual Creator.
* Enterprise.
* White-label Agency.
* Multi-brand Enterprise Organization.
* Franchise Organization.

Dokumen ini tidak membahas kebutuhan segmen tersebut secara detail.

---

# Assumptions Validated

| ID | Assumption | Observation | Status |
| --- | ---------- | ----------- | ------ |
| A-01 | Marketing Team adalah primary user | Paling sesuai dengan ICP | Supported |
| A-02 | Buyer dan Daily User berbeda | Terlihat pada Marketing Team dan Agency | Supported |
| A-08 | Individual Creator bukan fokus MVP | Tidak sesuai value proposition kolaborasi | Supported |
| A-09 | Startup dan Agency memiliki pola kerja mirip Marketing Team | Workflow serupa dengan konteks berbeda | Supported (with nuance) |

---

# Expected Output

Setelah dokumen ini selesai, project memiliki:

* Definisi segmentasi yang konsisten.
* Ideal Customer Profile.
* Buyer dan Daily User yang jelas.
* Prioritas segmen untuk MVP.
* Dasar bagi Persona, Goals, JTBD, UX, dan Architecture.

---

# Exit Criteria

Dokumen dianggap selesai apabila:

* Primary dan Secondary Segment telah ditetapkan.
* Ideal Customer Profile telah didefinisikan.
* Buyer dan Daily User telah dipisahkan.
* Prioritas segmen telah disepakati.
* Anti-ICP telah didefinisikan.
* Persona dapat dibuat tanpa ambigu.

---

# Related Documents

* `README.md`
* `discovery-plan.md`
* `user-personas.md`
* `user-goals.md`
* `pain-points.md`
* `jobs-to-be-done.md`
* `user-journey.md`
* `insights.md`
* `../01-business/target-market.md`
* `../01-business/problem-statement.md`
* `../02-product/mvp-definition.md`
* `../../project-manager/DECISIONS.md`