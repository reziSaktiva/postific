# Information Architecture

Dokumen ini mendefinisikan **struktur navigasi, hierarki layar, dan pengelompokan fitur** pada produk **Postific**.

IA dirancang berdasarkan UX Principles yang telah ditetapkan — khususnya UXP-01 (satu siklus kerja), UXP-02 (dua mode kerja), dan UXP-03 (simplisitas sebagai quality bar). Setiap keputusan struktural di sini harus dapat ditelusuri ke prinsip tersebut.

---

# Overview

Information Architecture mendefinisikan dua hal utama:

1. **Struktur navigasi** — bagaimana pengguna bergerak antarbagian aplikasi.
2. **Hierarki layar** — apa yang ada di dalam setiap bagian.

IA tidak mendefinisikan layout visual, interaksi, atau kode. Dokumen ini adalah cetak biru struktural yang menjadi acuan untuk User Flows, Navigation Patterns, dan Key Screen Patterns.

---

# Prinsip IA

IA ini dibangun berdasarkan tiga prinsip utama.

## P-IA-01 — Navigasi Mencerminkan Siklus Kerja, Bukan Kategori Fitur

**Turunan dari:** UXP-01

Navigasi utama tidak disusun sebagai daftar modul (Publishing, Analytics, Engagement). Navigasi disusun sebagai tahapan siklus kerja yang berurutan dan natural:

```
Publish → Engage → Analyze
```

Pengguna harus merasa sedang mengikuti satu alur, bukan berpindah antar aplikasi terpisah.

---

## P-IA-02 — Dua Titik Masuk: Eksekusi dan Overview

**Turunan dari:** UXP-02

Raka butuh masuk langsung ke pekerjaan. Maya butuh melihat gambaran status dengan cepat.

IA menyediakan:

- **Home** — titik masuk dengan ringkasan status untuk kebutuhan visibility Maya.
- **Publish** — titik masuk langsung ke pekerjaan untuk kebutuhan eksekusi Raka.

Keduanya adalah entry point kelas pertama dalam navigasi.

---

## P-IA-03 — Kedalaman Dua Level, Tidak Lebih

**Turunan dari:** UXP-03

Navigasi maksimal dua level: **primary section → sub-screen**. Tidak ada nested navigation yang memaksa pengguna menggali tiga level ke bawah untuk mencapai fitur inti.

---

# Struktur Navigasi

## Primary Navigation

Primary navigation adalah navigasi utama yang selalu terlihat dan dapat diakses kapan saja.

| # | Label | Deskripsi |
| - | ----- | --------- |
| 1 | Home | Ringkasan status dan aktivitas terkini |
| 2 | Publish | Seluruh area kerja publishing konten |
| 3 | Engage | Inbox interaksi audiens |
| 4 | Analyze | Dashboard performa |
| 5 | Start Page | Manajemen halaman publik |

Urutan navigasi bukan alphabetical — urutan mencerminkan **alur nilai produk** dari I-05:
Publishing reliability → Engagement triage → Analytics snapshot.

---

## Secondary Navigation

Secondary navigation diakses melalui elemen tetap di luar primary nav — tidak menggunakan slot di primary nav.

| Label | Akses Via | Isi |
| ----- | --------- | --- |
| Settings | Avatar / user menu | Grup **Organization** (anggota tim, akun terhubung, izin, branding, billing) dan grup **Account** (workspace user + switch/create workspace, profil pengguna, notifikasi, preferensi — ADR-088). Begitu masuk, primary nav (sidebar workspace) **digantikan total** oleh sidebar khusus Settings di slot yang sama — bukan tampil berdampingan — dengan header back-navigation di atasnya (ADR-077) |
| Notifications | Icon notifikasi | Notifikasi in-app |

---

## Yang Tidak Ada di Navigasi

Berdasarkan UXP-05 dan UXP-03, beberapa elemen sengaja **tidak** menjadi item navigasi:

- **AI Assistant** — tidak muncul sebagai menu. AI hadir sebagai kontekstual action di dalam Draft Editor.
- **Media Library** — diakses dari dalam Draft Editor, bukan dari primary nav (Should Have, bukan titik masuk utama).
- **Approval Workflow** — tidak ada; digantikan oleh visibilitas status (UXP-06).

---

# Hierarki Layar

## 1. Home

Entry point yang memberi ringkasan status lintas domain.

```
Home
├── Today's Schedule          — konten yang terjadwal hari ini
├── Recent Activity           — aktivitas publikasi terbaru (sukses / gagal)
├── Engagement Snapshot       — jumlah komentar unread dari sinkronisasi terakhir
└── Analytics Snapshot        — highlight performa minggu ini
```

**Pengguna utama:** Maya (visibility mode).
**Pengguna sekunder:** Raka (orientasi awal sebelum masuk ke Publish).

Home tidak menggantikan layar kerja. Home adalah layar orientasi.

---

## 2. Publish

Area kerja utama harian. Ini adalah section terbesar dalam produk.

```
Publish
├── Calendar                  — tampilan jadwal konten per hari / minggu / bulan
│   └── Draft Item            — buka item dari calendar → masuk ke Draft Editor
├── Queue                     — antrean posting terjadwal, berurutan murni berdasarkan waktu publish (ADR-083; filter per akun tersedia sebagai kontrol terpisah, bukan struktur pengelompokan utama)
│   └── Draft Item            — buka item dari queue → masuk ke Draft Editor
├── Drafts                    — semua draft yang belum dijadwalkan
│   └── Draft Editor          — buat / edit konten
│       ├── Caption Editor    — area tulis caption, dengan AI inline
│       ├── Media Attachment  — lampirkan gambar / video
│       ├── Account Selector  — pilih akun tujuan
│       ├── Content Format    — Post / Reel / Story / Pin per akun (ADR-039)
│       ├── Schedule Picker   — tentukan waktu publish
│       ├── Publish Now       — publish langsung tanpa jadwal, semua role (Account Owner/Admin/Creator, ADR-047/ADR-074)
│       └── Status Indicator  — draft / in review / ready to schedule / scheduled / published / failed
└── History                   — riwayat konten yang telah dipublish
    └── Post Detail           — detail posting + performa dasar
```

**Pengguna utama:** Raka (eksekusi publishing harian).
**Catatan:** AI Caption Assistance berada di dalam Draft Editor — bukan layar terpisah. Content Format Selector mengikuti matriks platform (IG/FB: Post·Reel·Story; Pinterest: Pin; TikTok & lainnya: Post). Publish Now tersedia berdampingan dengan Schedule Picker untuk semua role — Account Owner, Admin, dan Creator (ADR-047, ADR-074, `roles-permissions.md`).

---

## 3. Engage

Area untuk menangani interaksi audiens yang masuk.

```
Engage
└── Inbox
    ├── Sync Status + Manual Refresh
    ├── Filter (by account, by platform, by status)
    ├── Comment Thread        — tampilkan komentar + konteks post
    │   └── Reply Action      — balas komentar
    └── Unread / Done status  — tandai interaksi sebagai selesai
```

**Pengguna utama:** Raka / Community Manager.
**Catatan:** Inbox mengambil komentar melalui periodic pull setiap 30 menit dan menyediakan manual refresh. Direct Message, mention, dan webhook engagement tidak termasuk MVP (ADR-040).

---

## 4. Analyze

Area review performa konten.

```
Analyze
└── Dashboard
    ├── Account Overview      — performa per akun sosial
    ├── Post Performance      — metrik per posting
    └── Engagement Summary    — ringkasan interaksi pada periode
```

**Pengguna utama:** Maya (review mingguan).
**Pengguna sekunder:** Raka (memahami performa konten yang dipublish).

---

## 5. Start Page

Area manajemen halaman publik (link-in-bio).

```
Start Page
├── Page Editor               — susun tampilan halaman publik
│   ├── Link List             — tambah / edit / hapus tautan
│   └── Theme Selector        — pilih tema tampilan (Should Have)
├── Preview                   — lihat tampilan halaman sebelum publish
└── Share                     — salin URL halaman publik
```

**Pengguna utama:** Raka / siapapun yang mengelola profil publik brand.

---

## 6. Settings

Diakses via avatar / user menu — bukan layar kerja harian. Terdiri dari dua grup: **Organization** (pengelolaan workspace, hanya untuk role yang berwenang) dan **Account** (preferensi personal pengguna, termasuk switch/create workspace — ADR-088). Begitu masuk, primary nav (sidebar workspace) digantikan total oleh satu sidebar khusus Settings di slot yang sama — pola Buffer, bukan dua sidebar berdampingan — dengan header back-navigation ("← Settings") di atasnya yang menaut balik ke halaman utama app (ADR-077).

```
Settings
├── Organization
│   ├── General                   — nama organisasi, timezone, brand settings
│   ├── Connected Accounts        — kelola akun media sosial yang terhubung
│   ├── Members                   — undang, kelola anggota tim
│   ├── Roles & Permissions       — atur hak akses per peran
│   └── Billing                   — langganan dan pembayaran
└── Account
    ├── Workspaces                — daftar workspace user, switch workspace aktif, buat workspace baru (ADR-088)
    ├── Profile                   — nama, foto, email
    ├── Notifications             — preferensi notifikasi email dan in-app
    └── Preferences               — pengaturan tampilan personal
```

---

# Pemetaan Fitur ke Layar

Tabel berikut memetakan fitur MVP (Must Have) ke layar spesifik dalam IA.

| Fitur (MVP Must Have) | Layar |
| --------------------- | ----- |
| Workspace Management | Settings → Organization → General |
| Workspace Switch & Create (ADR-088) | Settings → Account → Workspaces |
| Team Members | Settings → Organization → Members |
| Roles & Permissions | Settings → Organization → Roles & Permissions |
| Social Account Connection | Settings → Organization → Connected Accounts |
| Content Draft | Publish → Drafts → Draft Editor |
| Content Format Selection (ADR-039) | Publish → Draft Editor → Content Format per akun |
| Schedule Post | Publish → Draft Editor → Schedule Picker |
| Publish Now (ADR-047) | Publish → Draft Editor → Publish Now Action |
| Calendar View | Publish → Calendar |
| Queue Management | Publish → Queue |
| Publishing History | Publish → History |
| AI Caption Generation | Publish → Draft Editor → AI inline |
| AI Caption Improvement | Publish → Draft Editor → AI inline |
| Comments (view + reply) | Engage → Inbox → Comment Thread |
| Inbox | Engage → Inbox |
| Analytics Dashboard | Analyze → Dashboard |
| Basic Performance Metrics | Analyze → Dashboard → Post Performance |
| Engagement Summary | Analyze → Dashboard → Engagement Summary |
| Link Management | Start Page → Page Editor → Link List |
| Public Page | Start Page → Preview + Share |

---

# Entry Points per Persona

## Raka (Daily User — Eksekusi)

```
Login → Publish → Calendar / Queue / Drafts → Draft Editor → Schedule → Done
                                                           ↘ History (verifikasi)
       → Engage → Inbox → Reply
```

Raka tidak perlu melewati Home untuk memulai pekerjaan. Publish adalah entry point langsung.

---

## Maya (Buyer — Visibility)

```
Login → Home → ringkasan status
              ↘ Analyze → Dashboard → review mingguan
              ↘ Publish → Calendar → cek jadwal aktif
```

Maya tidak perlu masuk ke Draft Editor untuk mendapatkan informasi yang dibutuhkan.

---

# Decision Log

Keputusan struktural yang dibuat dalam dokumen ini.

| ID | Keputusan | Alasan | Prinsip |
| -- | --------- | ------ | ------- |
| IA-D01 | Navigasi utama: Home, Publish, Engage, Analyze, Start Page | Mencerminkan siklus nilai produk, bukan daftar fitur | UXP-01, UXP-07 |
| IA-D02 | AI tidak menjadi item navigasi | AI contextual, bukan destinasi. Tempatkan di Draft Editor | UXP-05 |
| IA-D03 | Home sebagai layar orientasi, bukan dashboard kerja | Melayani Maya tanpa mengganggu alur Raka | UXP-02 |
| IA-D04 | Calendar sebagai tampilan default di Publish | Calendar memberikan overview status konten yang terbaik | UXP-02, UXP-04 |
| IA-D05 | Settings (grup Organization + Account) di luar primary nav, diakses via avatar/user menu | Bukan akses harian — jangan memenuhi slot navigasi utama | UXP-03 |
| IA-D06 | Kedalaman navigasi maksimal dua level | Lebih dari dua level menambah cognitive load tanpa nilai | UXP-03 |
| IA-D07 | Media Library tidak di primary nav | Diakses dari Draft Editor (Should Have) — bukan entry point utama | UXP-03 |

---

# Expected Output

Setelah dokumen ini selesai, project harus memiliki:

* Struktur navigasi yang jelas dengan primary dan secondary nav terdefinisi.
* Hierarki layar lengkap untuk seluruh domain MVP.
* Pemetaan fitur MVP ke layar spesifik.
* Entry points per persona yang terdokumentasi.
* Decision log yang dapat ditelusuri ke UX Principles.

---

# Exit Criteria

Information Architecture dianggap selesai apabila:

* Primary navigation telah terdefinisi dan selaras dengan siklus kerja produk.
* Hierarki layar mencakup seluruh fitur Must Have MVP.
* Setiap keputusan struktural dapat ditelusuri ke UX Principles.
* Tidak ada fitur Must Have yang tidak memiliki layar dalam IA.
* Tidak ada navigasi yang bertentangan dengan Product Baseline v1.0.

---

# Related Documents

* `README.md`
* `ux-principles.md`
* `user-flows.md`
* `navigation-patterns.md`
* `key-screen-patterns.md`
* `../02-product/feature-modules.md`
* `../02-product/mvp-definition.md`
* `../02-product/feature-priority.md`
* `../03-user/user-personas.md`
* `../03-user/user-journey.md`
* `../03-user/insights.md`
* `../../project-manager/PROJECT_STATE.md`
* `../../project-manager/DECISIONS.md`
