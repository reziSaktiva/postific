# 03 — User

Dokumentasi pada folder ini berfokus pada **User Discovery** untuk produk **Postific**, mulai dari memahami siapa pengguna, bagaimana mereka bekerja, masalah yang mereka hadapi, hingga menghasilkan insight yang dapat digunakan sebagai dasar pengambilan keputusan produk.

Seluruh dokumentasi pada folder ini harus mengacu pada **Business Baseline** dan **Product Baseline** yang telah disepakati. Insight digunakan untuk mengevaluasi asumsi dan mendukung pengambilan keputusan produk, bukan mengubah baseline tanpa proses keputusan yang terdokumentasi.

---

# Tujuan

* Memahami pengguna utama dan pengguna sekunder secara mendalam.
* Mengidentifikasi tujuan, motivasi, perilaku, kebutuhan, serta pain points pengguna.
* Membedakan kebutuhan buyer dan daily user.
* Mendefinisikan Jobs To Be Done (JTBD) berdasarkan konteks kerja pengguna.
* Mengevaluasi asumsi yang berasal dari Business Discovery dan Product Discovery.
* Menghasilkan insight yang dapat digunakan sebagai dasar pada tahap UX Discovery dan Architecture Discovery.

---

# Scope

Folder ini hanya membahas **User Discovery**.

Topik yang termasuk dalam scope:

* Discovery objectives dan discovery questions.
* User segments.
* Buyer dan daily user.
* User personas.
* User goals.
* Pain points.
* Jobs To Be Done (JTBD).
* User scenarios.
* Current user journey.
* Assumptions.
* Observations.
* Insights.
* Referensi dari produk sejenis, komunitas, artikel, dokumentasi, video, dan pengalaman yang relevan.

Pendekatan pada fase ini berfokus pada **desktop research** dan **product discovery**. Interview pengguna, survei, usability testing, maupun validasi lapangan tidak termasuk dalam ruang lingkup fase ini.

Topik berikut **tidak dibahas** pada folder ini:

* UX Design
* UI Design
* Information Architecture
* User Flow Solution
* Wireframe
* Prototype
* Technical Architecture
* Database Design
* API Design
* Implementation

---

# Daftar Dokumen

* `discovery-plan.md` — tujuan, pertanyaan, sumber referensi, dan ruang lingkup discovery.
* `user-segments.md` — kelompok pengguna, buyer, daily user, dan prioritas pengguna.
* `user-personas.md` — persona awal berdasarkan asumsi, observasi, dan insight.
* `user-goals.md` — tujuan, motivasi, dan hasil yang ingin dicapai pengguna.
* `pain-points.md` — hambatan dan masalah yang dihadapi pengguna.
* `jobs-to-be-done.md` — pekerjaan fungsional, emosional, dan sosial yang ingin diselesaikan pengguna.
* `user-scenarios.md` — konteks penggunaan dalam situasi nyata.
* `user-journey.md` — current-state journey pengguna tanpa menawarkan solusi.
* `insights.md` — rangkuman observasi, pola, insight, dan implikasinya terhadap keputusan produk.

---

# Discovery Workflow

Seluruh proses User Discovery mengikuti alur berikut:

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

Insight tidak secara otomatis menjadi keputusan produk. Seluruh perubahan terhadap baseline harus melalui proses review dan dokumentasi.

---

# Cara Menggunakan

1. Mulai dari `discovery-plan.md` untuk menetapkan tujuan dan ruang lingkup discovery.
2. Kumpulkan referensi dari produk sejenis, komunitas, artikel, dokumentasi, video, dan sumber relevan lainnya.
3. Definisikan kelompok pengguna pada `user-segments.md`.
4. Susun persona awal pada `user-personas.md`.
5. Dokumentasikan user goals dan pain points.
6. Definisikan Jobs To Be Done (JTBD).
7. Gambarkan user scenarios.
8. Petakan current-state user journey.
9. Konsolidasikan seluruh insight pada `insights.md`.
10. Gunakan insight sebagai dasar diskusi sebelum mengambil keputusan produk.

---

# Expected Output

Setelah seluruh dokumen pada folder ini selesai, project harus memiliki:

* User Discovery yang terdokumentasi dengan baik.
* Segmentasi pengguna yang konsisten dengan Target Market.
* Pemisahan yang jelas antara buyer dan daily user.
* User Persona yang realistis.
* User Goals dan Pain Points yang tervalidasi melalui discovery.
* Jobs To Be Done (JTBD) yang jelas.
* Current User Journey yang terdokumentasi.
* Insight yang dapat digunakan sebagai dasar UX dan Architecture.
* Daftar asumsi yang didukung, belum didukung, atau bertentangan dengan hasil discovery.

---

# Exit Criteria

User Discovery dianggap selesai apabila:

* Discovery objectives telah ditetapkan.
* User segments telah didefinisikan.
* Buyer dan daily user telah dibedakan.
* User personas telah disusun.
* User goals, pain points, dan JTBD telah terdokumentasi.
* Current user journey telah selesai.
* Insight utama telah dirangkum.
* Seluruh asumsi penting telah ditinjau.
* Seluruh dokumen telah melalui User Discovery Review.

---

# Decision Rules

Insight yang mengarah pada perubahan terhadap:

* Target Market
* Problem Statement
* Product Vision
* Product Scope
* MVP
* Feature Priority

harus didokumentasikan pada:

* `../../project-manager/DECISIONS.md`

Perubahan progress User Discovery harus diperbarui pada:

* `../../project-manager/PROJECT_STATE.md`

---

# Related Documents

* `../README.md`
* `../01-business/README.md`
* `../01-business/product-vision.md`
* `../01-business/problem-statement.md`
* `../01-business/target-market.md`
* `../02-product/README.md`
* `../02-product/product-scope.md`
* `../02-product/mvp-definition.md`
* `../02-product/feature-modules.md`
* `../../project-manager/PROJECT_OVERVIEW.md`
* `../../project-manager/PROJECT_RULES.md`
* `../../project-manager/PROJECT_STATE.md`
* `../../project-manager/DECISIONS.md`
