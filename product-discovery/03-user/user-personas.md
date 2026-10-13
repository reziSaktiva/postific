# User Personas

Dokumen ini menyusun persona awal untuk produk **Postific** berdasarkan asumsi, observasi desktop research, dan insight yang relevan.

Persona digunakan untuk menjaga empati dan fokus keputusan produk. Persona bukan hasil riset akademis, dan bukan kontrak fitur.

---

# Overview

Persona merepresentasikan pola pengguna yang berulang pada segmen prioritas.

Setiap persona disusun agar dapat menjawab:

* Siapa orang ini dalam konteks kerja?
* Apa yang ingin dicapai?
* Apa yang menghambat?
* Apa yang membuat produk dianggap berhasil baginya?

Detail goals, pain points, dan JTBD yang lebih lengkap ada pada dokumen terpisah. Persona hanya membawa ringkasan yang cukup untuk pengambilan keputusan.

---

# Purpose

* Memberikan wajah konkret pada segmen pengguna.
* Membantu membedakan kebutuhan buyer dan daily user.
* Menjadi acuan diskusi Product dan UX tanpa spekulasi berlebihan.
* Mengevaluasi apakah MVP menyelesaikan pekerjaan orang yang tepat.

---

# Scope

## In Scope

* Persona primary dan secondary yang relevan MVP.
* Ringkasan context, goals, pains, dan success criteria per persona.
* Mapping persona ke segmen dan peran buyer/daily user.

## Out of Scope

* Segmentasi pasar (lihat `user-segments.md`).
* Inventaris lengkap goals/pain points/JTBD.
* Desain UI berdasarkan persona.
* User flow solution.
* Role-permission matrix teknis.

---

# Persona Principles

* Realistis, bukan karikatural.
* Berorientasi pekerjaan, bukan demografi kosmetik.
* Cukup untuk keputusan produk; tidak berlebihan detail fiksi.
* Konsisten dengan Marketing Team sebagai primary segment.
* Memisahkan motivasi buyer dari friction daily user.

---

# Primary Personas

## Persona 1 — Maya, Marketing Manager (Buyer + Occasional User)

### Profile

| Field | Detail |
| ----- | ------ |
| Role | Marketing Manager |
| Segment | Marketing Team |
| Type | Buyer (primary), light daily user |
| Team size | 6–12 orang |
| Context | Bertanggung jawab atas channel performance dan efisiensi operasional tim |

### Day-to-Day Context

Maya memastikan konten keluar tepat waktu, kualitas terjaga, dan tim tidak tenggelam di pekerjaan administratif. Ia jarang menulis setiap caption, tetapi sering memeriksa status kalender, performa, dan bottleneck proses.

### Goals

* Visibilitas status konten lintas anggota tim.
* Mengurangi tool switching yang memperlambat tim.
* Mendapat ringkasan performa yang cukup untuk keputusan mingguan.

### Friction

* Sulit melihat “apa yang sudah ready / scheduled / published” tanpa bertanya ke chat.
* Analytics tersebar di native dashboards.
* Onboarding tool baru gagal jika terasa rumit bagi tim.

### Success Criteria

Tim mengadopsi satu dashboard, cadence publishing stabil, dan Maya bisa review progress tanpa meeting berlebih.

### Product Relevance

Paling peduli pada Workspace, Calendar visibility, Analytics ringkas, dan kejelasan ownership pekerjaan.

---

## Persona 2 — Raka, Social Media Manager (Primary Daily User)

### Profile

| Field | Detail |
| ----- | ------ |
| Role | Social Media Manager |
| Segment | Marketing Team |
| Type | Daily user (primary) |
| Team size | Bekerja dengan creator, copywriter, dan community |
| Context | Owner operasional publishing dan koordinasi konten harian/mingguan |

### Day-to-Day Context

Raka menyusun jadwal, memastikan draft siap, menjadwalkan ke beberapa akun, memantau komentar penting melalui sinkronisasi berkala atau manual refresh, dan menjaga konsistensi kehadiran brand di channel.

### Goals

* Menyelesaikan siklus draft → review ringan → schedule → publish dengan cepat.
* Menjaga antrean konten tetap sehat.
* Membaca dan membalas komentar penting tanpa hilang di banyak native apps.

### Friction

* Draft ada di dokumen, aset di drive, jadwal di tool lain, balasan di app native.
* Status konten tidak jelas antar anggota.
* Gagal publish atau salah akun berisiko tinggi bagi reputasi.

### Success Criteria

Dalam satu sesi kerja, Raka dapat merencanakan dan menjadwalkan konten minggu berjalan serta menangani komentar prioritas melalui Comments Inbox tanpa pindah terlalu banyak tool.

### Product Relevance

Paling peduli pada Publishing (draft, schedule, queue, calendar), Engagement Comments Inbox, dan AI caption assistance yang cepat.

---

## Persona 3 — Sinta, Content Creator / Copywriter (Supporting Daily User)

### Profile

| Field | Detail |
| ----- | ------ |
| Role | Content Creator / Copywriter |
| Segment | Marketing Team |
| Type | Daily user (supporting) |
| Context | Fokus membuat draft caption dan variasi konten, bukan ownership channel penuh |

### Day-to-Day Context

Sinta menerima brief, menulis draft, menyesuaikan tone, dan menyerahkan ke Social Media Manager untuk penjadwalan. Ia sering butuh bantuan mempercepat iterasi caption.

### Goals

* Menyelesaikan draft berkualitas lebih cepat.
* Mendapat konteks brief dan aset yang jelas.
* Mengurangi revisi karena tone yang meleset.

### Friction

* Brief tersebar di chat.
* Membuat banyak variasi caption memakan waktu.
* Sulit tahu versi mana yang final untuk dijadwalkan.

### Success Criteria

Sinta dapat menghasilkan draft siap-jadwal dengan sedikit bolak-balik komunikasi.

### Product Relevance

Paling peduli pada Content Draft, AI Assistant (caption generation/improvement), dan kejelasan status draft.

---

# Secondary Personas

## Persona 4 — Dimas, Startup Growth Lead (Buyer + Heavy Daily User)

### Profile

| Field | Detail |
| ----- | ------ |
| Role | Head of Growth / Marketing Lead |
| Segment | Startup |
| Type | Buyer and daily user (sering overlap) |
| Team size | 1–4 orang |
| Context | Tim lean; satu orang sering mengerjakan strategi dan eksekusi |

### Day-to-Day Context

Dimas membutuhkan tool yang langsung dipakai. Ia tidak punya waktu untuk setup kompleks. Fokusnya adalah konsistensi posting dan belajar dari performa dasar.

### Goals

* Time-to-value cepat.
* Cadence publishing yang konsisten.
* Insight sederhana untuk iterasi konten.

### Friction

* Tool enterprise terlalu berat.
* Terlalu banyak fitur di awal justru menghambat adopsi.
* Konteks switching tetap terjadi karena resource terbatas.

### Success Criteria

Dalam hari pertama, Dimas bisa connect account, schedule posts, dan melihat hasil dasar.

### Product Relevance

Onboarding sederhana, Publishing inti, Analytics dasar, AI bantuan caption.

---

## Persona 5 — Lara, Agency Social Lead (Buyer Influence + Daily Oversight)

### Profile

| Field | Detail |
| ----- | ------ |
| Role | Social Media Lead / Account Ops |
| Segment | Digital Agency |
| Type | Influences buying; daily oversight across clients |
| Context | Mengelola beberapa klien dengan deadline ketat dan banyak akun |

### Day-to-Day Context

Lara memastikan setiap klien punya jadwal yang sehat, tim tidak tertukar konteks antar brand, dan status pekerjaan terlihat tanpa harus chase satu per satu.

### Goals

* Visibilitas multi-account yang rapi.
* Proses yang konsisten lintas klien.
* Mengurangi risiko salah publish ke brand lain.

### Friction

* Context switching antar klien tinggi.
* Tool yang tidak mendukung kejelasan workspace/akun memperbesar risiko error.
* Reporting ke klien memakan waktu jika data tersebar.

### Success Criteria

Lara dapat memantau status beberapa akun klien dan menjaga delivery tanpa menambah meeting operasional.

### Product Relevance

Workspace clarity, account connection hygiene, Publishing calendar, Analytics ringkas per akun.

---

# Persona Priority Map

| Priority | Persona | Segment | Primary Need |
| -------- | ------- | ------- | ------------ |
| P0 | Raka — Social Media Manager | Marketing Team | Reliable publishing + engagement workflow |
| P0 | Maya — Marketing Manager | Marketing Team | Visibility, adoption, team efficiency |
| P1 | Sinta — Content Creator | Marketing Team | Faster draft quality with AI assist |
| P1 | Dimas — Startup Growth Lead | Startup | Fast time-to-value |
| P1 | Lara — Agency Social Lead | Digital Agency | Multi-account visibility without complexity |

MVP harus “benar” untuk Raka dan Maya terlebih dahulu. Persona lain dipakai untuk mengecek apakah solusi tetap usable di konteks sekunder.

---

# Anti-Personas (MVP)

Persona berikut tidak menjadi acuan desain MVP:

* Solo influencer yang fokus pertumbuhan personal brand.
* Enterprise social ops dengan approval berlapis dan compliance ketat.
* Power user yang mencari social listening mendalam atau automation kompleks.

---

# Assumptions Evaluated in This Document

| ID | Assumption | Observation | Status |
| -- | ---------- | ----------- | ------ |
| A-01 | Marketing Team adalah primary | Persona P0 berada di Marketing Team | Supported |
| A-02 | Buyer ≠ daily user | Maya vs Raka/Sinta | Supported |
| A-05 | Publishing adalah pekerjaan inti | Semua persona prioritas bergantung pada publishing cadence | Supported |
| A-07 | AI berguna jika masuk workflow | Sinta dan Dimas mendapat nilai dari caption assistance in-flow | Supported (directional) |

---

# Expected Output

Setelah dokumen ini selesai, project harus memiliki:

* Persona yang realistis untuk primary dan secondary segments.
* Pemetaan buyer vs daily user pada tingkat individu.
* Prioritas persona untuk keputusan MVP.
* Dasar diskusi yang konsisten sebelum UX Discovery.

---

# Exit Criteria

User Personas dianggap selesai apabila:

* Minimal dua persona primary telah didefinisikan.
* Buyer dan daily user terwakili.
* Secondary personas telah dicakup secara proporsional.
* Anti-personas telah ditandai.
* Dokumen goals, pain points, dan scenarios dapat merujuk persona tanpa konflik.

---

# Related Documents

* `README.md`
* `discovery-plan.md`
* `user-segments.md`
* `user-goals.md`
* `pain-points.md`
* `jobs-to-be-done.md`
* `user-scenarios.md`
* `insights.md`
* `../01-business/target-market.md`
* `../02-product/mvp-definition.md`
* `../../project-manager/DECISIONS.md`
