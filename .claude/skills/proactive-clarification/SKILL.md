---
name: proactive-clarification
description: >-
  Memandu AI untuk secara proaktif mengidentifikasi keputusan yang belum ditentukan
  sebelum mengeksekusi tugas apapun — dokumentasi, fitur, arsitektur, konfigurasi,
  atau interaksi lain. AI harus bertanya terlebih dahulu dengan pilihan-pilihan
  terbaik di kelasnya, bukan langsung berasumsi. Gunakan skill ini sebelum
  mengerjakan tugas apapun yang memiliki fork keputusan yang belum jelas.
---

# Proactive Clarification

Sebelum mengerjakan tugas apapun, AI harus mengidentifikasi apakah ada keputusan penting yang belum ditentukan — yang kalau diasumsikan bisa menghasilkan output yang salah arah. Jika ada, tanya dulu. Baru kerjakan.

---

## Prinsip Dasar

**Jangan berasumsi, tanya dulu** — berlaku untuk SEMUA jenis tugas:

- Membuat atau merevisi dokumentasi
- Membangun fitur atau komponen
- Memilih library, tool, atau service
- Merancang arsitektur atau flow
- Konfigurasi environment atau infrastruktur
- Keputusan desain UX/UI

**Pengecualian:** Jika keputusan sudah terdokumentasi di baseline project (ADR, `DECISIONS.md`, atau dokumen baseline yang relevan), gunakan keputusan tersebut — jangan tanya ulang.

---

## Kapan Harus Bertanya

Tanya sebelum eksekusi jika ada **fork keputusan** yang:

1. **Belum ada di baseline project** — tidak ada di `DECISIONS.md`, ADR, atau dokumen yang relevan
2. **Berdampak signifikan pada output** — pilihan yang berbeda menghasilkan dokumen / kode / struktur yang berbeda secara substansial
3. **Memiliki opsi-opsi valid yang setara** — tidak ada satu jawaban yang "jelas benar"

### Contoh Fork yang Harus Ditanyakan

| Konteks          | Contoh pertanyaan                                               |
| ---------------- | --------------------------------------------------------------- |
| Auth feature     | Provider mana? (Supabase Auth, Better Auth, NextAuth, Clerk)    |
| Database         | ORM mana? (Prisma, Drizzle, Kysely)                             |
| State management | Pendekatan apa? (Zustand, Jotai, React Query, Context API)      |
| Dokumentasi flow | Sudut pandang siapa yang jadi fokus utama? (persona tertentu)   |
| Deployment       | Target platform? (Vercel, Railway, Fly.io, self-hosted VPS)     |
| Testing          | Framework apa? (Vitest, Jest, Playwright, Cypress)              |
| UX pattern       | Paradigma navigasi yang dipakai? (tab bar, sidebar, breadcrumb) |

---

## Cara Bertanya

### 1. Identifikasi Fork-nya

Sebelum bertanya, tentukan:

- Apa yang belum jelas?
- Apa dampaknya terhadap output?
- Apa saja opsi terbaik yang relevan?

### 2. Sajikan Pilihan Terbaik

Berikan opsi yang **benar-benar terbaik di kelasnya** — bukan daftar semua yang ada. Kuasi: maks 4 pilihan yang paling relevan dan teruji. Sertakan konteks singkat mengapa masing-masing menarik.

**Format saat menggunakan tool `AskUserQuestion`:**
Gunakan `AskUserQuestion` untuk mengumpulkan jawaban secara terstruktur. Batas tool: 1 sampai 4 pertanyaan per panggilan dan 2 sampai 4 opsi per pertanyaan; opsi "Other" ditambahkan otomatis, jangan dibuat sendiri. Frontier yang lebih dari 4 fork dipecah menjadi beberapa panggilan berurutan, tetap diurutkan dari yang paling berdampak.

**Format saat bertanya secara conversational:**

```
Sebelum saya mulai, ada satu keputusan yang perlu kamu tentukan dulu:

**[Aspek yang perlu diputuskan]**

Pilihan terbaik:
- **[Opsi A]** — [mengapa menarik, kapan cocok]
- **[Opsi B]** — [mengapa menarik, kapan cocok]
- **[Opsi C]** — [mengapa menarik, kapan cocok]

Mana yang ingin kamu gunakan?
```

### 3. Pertanyaan per Ronde

Tanya per **ronde**, bukan satu per satu dan bukan semua sekaligus tanpa urutan:

- **Frontier keputusan** = semua fork yang sudah bisa dijawab sekarang, yaitu yang tidak bergantung pada jawaban fork lain. Satu ronde memuat seluruh frontier itu (batch dalam satu panggilan `AskUserQuestion` bila memakai tool), diurutkan dari yang paling berdampak.
- Fork yang bergantung pada jawaban ronde ini masuk ronde berikutnya; jangan ditanyakan sebelum waktunya.
- **Rekomendasi di depan:** tiap fork ditulis dengan opsi yang direkomendasikan lebih dulu, bertanda "(Recommended)" pada label bila memakai tool (atau "(rekomendasi)" bila bertanya di teks), beserta satu kalimat alasannya. King Rezi tinggal menyetujui atau menggantinya.
- **Cari fakta sendiri:** hal yang bisa dijawab dengan membaca baseline, kode, atau dokumen tidak ditanyakan; baca, lalu sebut temuannya sebagai dasar rekomendasi. Hanya keputusan (pilihan yang memang milik King Rezi) yang ditanyakan.
- **Selesai bila frontier kosong:** ulangi ronde sampai tidak ada fork yang tersisa, baik yang sedang terbuka maupun yang baru muncul dari jawaban sebelumnya.

---

## Kualitas Pilihan yang Disajikan

Pilihan yang disajikan harus:

- **Relevan** — sesuai konteks project (tech stack, fase, skala)
- **Terbaik di kelasnya** — bukan sekadar populer, tapi memang proven dan aktif digunakan
- **Dikurasi** — hanya tampilkan yang benar-benar bersaing; buang yang sudah outdated atau tidak relevan
- **Berisi konteks** — setiap opsi punya satu kalimat mengapa ia menarik atau kapan ia paling cocok

### Contoh Pilihan yang Baik (Auth)

```
- **Supabase Auth** — sudah terintegrasi jika pakai Supabase sebagai DB; zero config
- **Better Auth** — framework-agnostic, self-hostable, fitur enterprise lengkap
- **Clerk** — DX terbaik dengan UI komponen siap pakai; cocok jika auth bukan fokus engineering
- **NextAuth v5** — pilihan standar Next.js; fleksibel tapi butuh lebih banyak setup
```

### Contoh Pilihan yang Buruk (jangan lakukan ini)

```
- Supabase
- Firebase
- Auth0
- Okta
- Passport.js
- Custom JWT
- ...
```

Terlalu banyak, tidak ada konteks, tidak dikurasi.

---

## Setelah Mendapat Jawaban

1. Konfirmasi pilihan yang diambil dalam satu kalimat.
2. Jika pilihan berpengaruh pada dokumen atau keputusan project, tanyakan apakah perlu dicatat di `DECISIONS.md`.
3. Bila jawaban membuka fork baru, ajukan ronde berikutnya (lihat "Pertanyaan per Ronde").
4. Bila frontier sudah kosong, ringkas pemahaman bersama (keputusan yang diambil dan yang dipakai dari baseline) dalam beberapa baris, lalu **tunggu King Rezi mengonfirmasi**. Jangan bertindak sebelum konfirmasi itu.
5. Setelah dikonfirmasi, lanjutkan eksekusi tugas.

---

## Aturan Kritis

- Jangan skip pertanyaan meski merasa sudah tahu jawabannya — kecuali sudah ada di baseline.
- Jangan ajukan pertanyaan untuk hal-hal trivial yang tidak mempengaruhi output secara substansial.
- Jangan listing opsi yang sudah outdated, tidak relevan, atau tidak direkomendasikan untuk konteks ini.
- Jika user merespons dengan "terserah kamu" atau "kamu yang putuskan" — pilihkan opsi terbaik dengan alasannya, lalu konfirmasi sebelum jalan.
