# User Scenarios

Dokumen ini menggambarkan konteks penggunaan nyata bagi pengguna produk **Postific**.

Scenario menjelaskan *situasi* di mana jobs muncul, tanpa menawarkan solusi UX atau desain antarmuka.

---

# Overview

User Scenarios menjembatani persona, goals, pain points, dan JTBD ke dalam situasi kerja yang konkret.

Setiap scenario merepresentasikan kondisi yang berulang pada Marketing Team, Startup, atau Digital Agency sebelum atau di luar produk ini (current-state oriented).

---

# Purpose

* Membuat konteks penggunaan menjadi konkret dan dapat dibahas.
* Menunjukkan kapan jobs dipicu dalam kerja nyata.
* Menyediakan bahan untuk current-state journey.
* Membantu mengevaluasi apakah MVP mencakup situasi kritis.

---

# Scope

## In Scope

* Scenario current-state yang relevan MVP.
* Trigger, actors, context, constraints, dan desired outcome.
* Mapping ke persona, jobs, dan pain points.

## Out of Scope

* Ideal future-state flow (solusi).
* Wireframe, prototype, UI copy.
* Edge-case teknis sistem.
* Scenario enterprise yang di luar MVP.

---

# Scenario Structure

Setiap scenario memuat:

* Context
* Trigger
* Actors
* Current behavior
* Friction
* Desired outcome (dari sudut pengguna)
* Related jobs / pain points

---

# Scenario Set

## S-01 — Weekly Content Planning

**Segment:** Marketing Team  
**Persona:** Raka (+ Sinta, Maya oversight)

**Context**

Tim harus menyiapkan konten untuk minggu depan di beberapa akun.

**Trigger**

Awal minggu atau akhir minggu sebelumnya; calendar terlihat tipis.

**Current Behavior**

* Brief disusun di dokumen atau chat.
* Caption ditulis terpisah.
* Aset dikumpulkan dari drive.
* Jadwal akhirnya dimasukkan ke scheduling tool atau native scheduler.

**Friction**

* Versi caption tidak jelas.
* Status “siap jadwal” ambigu.
* Koordinasi memakan banyak chase.

**Desired Outcome**

Seluruh slot penting terisi dengan konten siap publish sebelum minggu berjalan.

**Related:** J-01, J-02, J-06 | PP-01, PP-02, PP-03, PP-05

---

## S-02 — Same-Day Schedule Adjustment

**Segment:** Marketing Team / Startup  
**Persona:** Raka atau Dimas

**Context**

Ada perubahan prioritas bisnis (promo mendadak, isu timing, atau konten harus digeser).

**Trigger**

Request dari manager/founder di siang hari.

**Current Behavior**

* Mencari post yang sudah dijadwalkan di tool.
* Mengedit waktu/akun secara manual.
* Memastikan tidak ada bentrok dengan slot lain.

**Friction**

* Sulit melihat antrean utuh.
* Risiko double-post atau slot kosong.
* Perubahan tidak terlihat oleh anggota lain.

**Desired Outcome**

Jadwal tersesuaikan cepat tanpa menimbulkan kesalahan publish.

**Related:** J-01, J-03 | PP-02, PP-04, PP-05

---

## S-03 — Multi-Account Publishing Morning

**Segment:** Marketing Team / Agency  
**Persona:** Raka / Lara’s team

**Context**

Beberapa akun perlu dipublish atau dicek pada pagi hari kerja.

**Trigger**

Jam operasional dimulai; beberapa post berstatus scheduled/publishing.

**Current Behavior**

* Mengecek status di scheduling tool.
* Membuka native apps untuk verifikasi.
* Menangani kegagalan publish secara reaktif.

**Friction**

* Kegagalan baru diketahui terlambat.
* Verifikasi lintas platform memakan waktu.
* Akun yang mirip nama meningkatkan risiko salah cek.

**Desired Outcome**

Status publikasi jelas dan masalah tertangani sebelum dampak membesar.

**Related:** J-02, J-03 | PP-04, PP-02

---

## S-04 — Caption Production Sprint

**Segment:** Marketing Team / Startup  
**Persona:** Sinta / Dimas

**Context**

Banyak konten membutuhkan caption dengan tone berbeda dalam waktu singkat.

**Trigger**

Batch konten masuk; deadline scheduling mendekat.

**Current Behavior**

* Menulis dari nol di docs.
* Minta feedback via chat.
* Iterasi tone berulang kali.

**Friction**

* Produksi lambat.
* Revisi tersebar.
* Final version sulit dilacak.

**Desired Outcome**

Draft siap-jadwal selesai lebih cepat dengan sedikit bolak-balik.

**Related:** J-05, J-06 | PP-08, PP-03

---

## S-05 — Midday Engagement Triage

**Segment:** Marketing Team  
**Persona:** Raka / Community Manager

**Context**

Dalam kondisi saat ini, komentar dan pesan masuk sepanjang hari dari beberapa platform. Solusi MVP mengonsolidasikan komentar saja; Direct Message dan mention tetap ditangani di native app (ADR-040).

**Trigger**

Waktu triage terjadwal, manual refresh, atau notifikasi internal setelah sinkronisasi komentar.

**Current Behavior**

* Membuka tiap native app.
* Mencari komentar penting secara manual.
* Membalas komentar satu per satu.

**Friction**

* Interaksi prioritas mudah terlewat.
* Context switching tinggi.
* Tidak ada antrean prioritas terpusat.

**Desired Outcome**

Komentar penting tertangani dalam SLA internal tim melalui Comments Inbox yang diperbarui setiap 30 menit atau saat manual refresh.

**Related:** J-04 | PP-06, PP-01

---

## S-06 — Weekly Performance Review

**Segment:** Marketing Team / Startup / Agency  
**Persona:** Maya / Dimas / Lara

**Context**

Review mingguan untuk menilai apa yang perlu diulang atau diubah.

**Trigger**

Meeting mingguan atau permintaan laporan singkat.

**Current Behavior**

* Export/metric diambil dari beberapa dashboard.
* Data digabung di spreadsheet.
* Insight disusun manual.

**Friction**

* Waktu kompilasi panjang.
* Insight terlambat.
* Diskusi lebih banyak soal data mentah daripada keputusan.

**Desired Outcome**

Snapshot performa cukup untuk keputusan iterasi dalam waktu singkat.

**Related:** J-08, J-07 | PP-07

---

## S-07 — New Team Member Onboarding to Tools

**Segment:** Marketing Team / Agency  
**Persona:** Maya (buyer), Raka (buddy)

**Context**

Anggota baru harus ikut workflow publishing.

**Trigger**

Join date anggota baru.

**Current Behavior**

* Diundang ke beberapa tools.
* Diajari proses via chat/call.
* Sering masih bertanya “ini final belum?” selama minggu pertama.

**Friction**

* Terlalu banyak tool = onboarding mahal.
* Proses tidak standar.
* Risiko error lebih tinggi di awal.

**Desired Outcome**

Anggota baru bisa berkontribusi pada draft/schedule dengan cepat dan aman.

**Related:** J-09, J-10, J-06 | PP-09, PP-03

---

## S-08 — Agency Multi-Client Deadline Day

**Segment:** Digital Agency  
**Persona:** Lara

**Context**

Beberapa klien memiliki deadline konten di hari yang sama.

**Trigger**

Hari delivery padat.

**Current Behavior**

* Beralih antar folder, chat, dan tool per klien.
* Mengecek status tiap akun secara terpisah.
* Melakukan quality check manual agar tidak tertukar brand.

**Friction**

* Context overload.
* Risiko salah aset/akun.
* Oversight menjadi bottleneck.

**Desired Outcome**

Seluruh delivery selesai tepat waktu dengan risiko salah brand seminimal mungkin.

**Related:** J-03, J-07, J-10 | PP-10, PP-04, PP-02

---

## S-09 — Tool Evaluation by Buyer

**Segment:** Marketing Team / Startup  
**Persona:** Maya / Dimas

**Context**

Buyer mengevaluasi apakah tool baru layak diadopsi tim.

**Trigger**

Pain operasional meningkat atau kontrak tool lama akan berakhir.

**Current Behavior**

* Membandingkan fitur kompetitor.
* Trial singkat.
* Bertanya ke daily user apakah terasa praktis.

**Friction**

* Fitur banyak tidak menjamin adopsi.
* Daily user menolak tool yang lambat/rumit.
* Buyer khawatir ROI.

**Desired Outcome**

Memilih tool yang dipakai rutin oleh tim dan mengurangi context switching.

**Related:** J-09 | PP-09, PP-01

---

# Scenario Priority for MVP Validation

| Priority | Scenario | Why |
| -------- | -------- | --- |
| P0 | S-01, S-03, S-05, S-06 | Mewakili siklus inti publish–engage–review |
| P0 | S-09 | Menentukan apakah adopsi mungkin terjadi |
| P1 | S-02, S-04, S-07 | Frekuensi tinggi, memperkuat value |
| P1 | S-08 | Penting untuk secondary segment Agency |

Jika produk tidak membantu pada scenario P0, Product-Market Fit berisiko rendah meskipun fitur terlihat lengkap.

---

# Assumptions Evaluated in This Document

| ID | Assumption | Observation | Status |
| -- | ---------- | ----------- | ------ |
| A-01 | Marketing Team primary | Mayoritas scenario P0 berpusat pada Marketing Team | Supported |
| A-05 | Publishing inti | S-01/S-02/S-03 mendominasi ritme kerja | Supported |
| A-09 | Startup/Agency mirip dengan nuansa berbeda | S-04/S-08 menunjukkan konteks khusus tanpa mengubah jobs inti | Supported |
| A-10 | Konsolidasi diterima bila sederhana | S-07 dan S-09 menegaskan adopsi sebagai gate | Supported |

---

# Expected Output

Setelah dokumen ini selesai, project harus memiliki:

* Kumpulan scenario penggunaan yang konkret.
* Mapping scenario ke jobs dan pain points.
* Prioritas scenario untuk validasi MVP.
* Bahan yang cukup untuk menyusun current-state journey.

---

# Exit Criteria

User Scenarios dianggap selesai apabila:

* Scenario P0 telah terdokumentasi.
* Setiap scenario memiliki actors, friction, dan desired outcome.
* Mapping ke JTBD dan pain points tersedia.
* Tidak ada solution design di dalam dokumen.
* User Journey dapat disusun dari scenario ini.

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
* `../01-business/problem-statement.md`
* `../02-product/mvp-definition.md`
* `../../project-manager/DECISIONS.md`
