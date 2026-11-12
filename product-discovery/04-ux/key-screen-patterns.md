# Key Screen Patterns

Dokumen ini mendefinisikan **pola fungsi kritis pada layar utama** produk **Postific**.

Key Screen Patterns dibangun di atas Information Architecture, User Flows, dan Navigation Patterns yang sudah ditetapkan. Dokumen ini tidak mendefinisikan layout visual, wireframe, atau kode — melainkan menjelaskan **fungsi apa yang wajib ada**, **bagaimana zona fungsional disusun**, **state apa yang harus ditangani**, dan **pola perilaku apa yang berlaku** pada setiap layar kritis.

---

# Overview

Dokumen ini mencakup 8 layar kritis yang menjadi inti interaksi pengguna:

| ID | Layar | Pengguna Utama |
| -- | ----- | -------------- |
| KSP-01 | Home | Maya |
| KSP-02 | Publish — Calendar | Raka + Maya |
| KSP-03 | Publish — Queue | Raka |
| KSP-04 | Publish — Drafts | Raka |
| KSP-05 | Publish — Draft Editor | Raka |
| KSP-06 | Engage — Inbox | Raka |
| KSP-07 | Analyze — Dashboard | Maya + Raka |
| KSP-08 | Settings — Organization — Connected Accounts | Raka / Maya |

Layar yang tidak tercantum (History, Start Page, Settings → Account) bukan layar kritis harian — polanya lebih sederhana dan tidak memerlukan dokumentasi mendalam di fase ini.

**Tambahan v0.5 (MCP, ADR-138, ADR-139):** dua layar baru (KSP-09 Persetujuan OAuth, KSP-10 Settings → Account → Klien AI) dan satu pola lintas layar (Badge dan Filter Sumber MCP) dicatat di bagian *Layar dan Pola MCP* setelah KSP-08. Daftar 8 layar kritis di atas tidak berubah.

---

# Cara Membaca Dokumen Ini

Setiap layar memiliki struktur:

* **Identitas** — path layar, pengguna utama, entry points, dan UX Principles yang relevan.
* **Tujuan** — apa yang harus berhasil dilakukan pengguna setelah menggunakan layar ini.
* **Critical Functions** — fungsi yang wajib ada; diidentifikasi dengan ID unik.
* **Zona Fungsional** — pengelompokan logis area dalam layar (bukan layout visual).
* **State Handling** — kondisi layar yang harus ditangani: default, loading, empty, error.
* **Decision Log per Layar** — keputusan desain yang spesifik untuk layar ini.

---

# Key Screen Patterns

---

## KSP-01 — Home

### Identitas

| Field | Value |
| ----- | ----- |
| Path IA | `Home` |
| Pengguna Utama | Maya (visibility mode) |
| Pengguna Sekunder | Raka (orientasi awal) |
| Entry Points | Login → Home; Sidebar → Home |
| UX Principles | UXP-02, UXP-03, UXP-07 |

### Tujuan

Home adalah layar orientasi — Maya dapat memindai status publishing, engagement, dan performa dalam satu layar tanpa perlu masuk ke section kerja. Raka dapat melihat kondisi harian sebelum masuk ke Publish.

Home **bukan** layar kerja. Tidak ada aksi berat yang diselesaikan dari sini.

---

### Critical Functions

| ID | Fungsi | Deskripsi | Prinsip |
| -- | ------ | --------- | ------- |
| KSP-01-F01 | Today's Schedule | Daftar konten yang terjadwal untuk hari ini, per akun, dengan status | UXP-02, UXP-04 |
| KSP-01-F02 | Recent Activity | Riwayat aksi terbaru: post berhasil dipublish, post gagal, akun disconnected | UXP-04, UXP-06 |
| KSP-01-F03 | Engagement Snapshot | Jumlah komentar unread (12 bulan terakhir, sama dengan Date Range bawaan Engage, ADR-157) dari sinkronisasi terakhir — mendorong Raka ke Engage | UXP-07 |
| KSP-01-F04 | Analytics Snapshot | Highlight performa minggu ini: total posts, total reach, engagement rate | UXP-02, UXP-07 |
| KSP-01-F05 | Deep Link ke Section | Setiap item/snapshot dapat diklik dan membawa pengguna ke layar yang relevan | UXP-01 |

---

### Zona Fungsional

Home dibagi menjadi empat zona yang disusun secara vertikal:

```
┌──────────────────────────────────────────────┐
│  TODAY'S SCHEDULE                            │
│  konten terjadwal hari ini per akun + status │
├──────────────────────────────────────────────┤
│  RECENT ACTIVITY                             │
│  aksi terbaru: publish success / failed      │
├──────────────────────────────────────────────┤
│  ENGAGEMENT SNAPSHOT    │  ANALYTICS SNAPSHOT│
│  komentar unread        │  total posts, reach│
└──────────────────────────────────────────────┘
```

**Urutan zona:** Today's Schedule ditaruh di atas karena paling time-sensitive. Analytics Snapshot di bawah — ia adalah "retention layer" yang dilihat setelah kebutuhan operasional terpenuhi (UXP-07).

---

### State Handling

| State | Tampilan |
| ----- | -------- |
| Default (ada data) | Semua zona terisi dengan data aktual |
| Tidak ada jadwal hari ini | Today's Schedule: _"Tidak ada jadwal untuk hari ini"_ + CTA ke Publish → Calendar |
| Tidak ada aktivitas terbaru | Recent Activity: kosong tersembunyi atau pesan singkat |
| Inbox kosong | Engagement Snapshot: _"0 komentar unread"_ — tetap tampil, tidak disembunyikan |
| Belum ada data analytics | Analytics Snapshot: _"Belum ada data"_ + CTA ke Analyze |
| Ada post gagal hari ini | Recent Activity menampilkan item Failed dengan visual highlight yang membedakannya |

---

### Pola: Deep Link dari Home

Setiap elemen di Home yang dapat diklik membawa pengguna ke layar spesifik:

```
Today's Schedule → item di-klik → Publish → Calendar → Draft Editor (item)
Recent Activity  → item Failed  → Publish → Calendar (item Failed tersorot)
Engagement Snapshot → klik      → Engage → Inbox
Analytics Snapshot  → klik      → Analyze → Dashboard
```

Pengguna tidak menyelesaikan pekerjaan di Home — mereka diarahkan ke layar kerja yang tepat.

---

---

## KSP-02 — Publish — Calendar

### Identitas

| Field | Value |
| ----- | ----- |
| Path IA | `Publish → Calendar` |
| Pengguna Utama | Raka (verifikasi jadwal, edit cepat) |
| Pengguna Sekunder | Maya (visibility jadwal tanpa interaksi) |
| Entry Points | Sidebar → Publish (default tab); Home → Today's Schedule |
| UX Principles | UXP-02, UXP-03, UXP-04, UXP-06 |

### Tujuan

Calendar adalah **tampilan default** saat pengguna masuk ke Publish. Layar ini memberi gambaran visual jadwal konten pada periode berjalan dan menjadi titik pertemuan antara kebutuhan eksekusi Raka dan kebutuhan visibility Maya.

---

### Critical Functions

| ID | Fungsi | Deskripsi | Prinsip |
| -- | ------ | --------- | ------- |
| KSP-02-F01 | Weekly View Default | Calendar menampilkan semua konten terjadwal dalam rentang minggu berjalan | UXP-02, UXP-03 |
| KSP-02-F02 | Status Visual per Item | **Diperbarui (polishing UI, 2026-08-27) — hanya 3 dari 6 status yang bisa tampil di grid**: Scheduled, Published, Failed. Item Draft/In Review/Ready to Schedule tidak pernah muncul di Calendar karena belum punya `scheduledAt`/`publishedAt` untuk diplot ke sel tanggal/jam (konsisten sejak T-033.1) — jadi tidak "menampilkan status" ke-6 itu, tapi memang tidak pernah punya baris untuk ditampilkan. Filter dropdown status (KSP-02-F09) tetap menampilkan 6 opsi penuh untuk konsistensi dengan Queue, meski memilih Draft/In Review/Ready to Schedule selalu menghasilkan grid kosong. Representasi visual: `Badge` di layar >768px, `StatusDot` (titik warna, tanpa label teks — detail lewat tap→Popover KSP-02-F08) di layar ≤768px karena `Badge` tidak punya kontrol ukuran dan overflow di kolom sempit | UXP-04, UXP-06 |
| KSP-02-F03 | Identitas Akun per Item | Setiap item menampilkan identitas akun tujuan (platform + nama akun) | UXP-04 |
| KSP-02-F10 | Indikator Tipe Konten | **Baru (polishing UI, 2026-08-27).** Setiap item menampilkan indikator tipe konten — Post/Reel/Story/Pin — dari field `contentFormat` yang sudah ada di domain model (`CalendarItemTargetRecord`, bukan field baru). Representasi: `Badge` di layar >768px, icon compact di layar ≤768px (sama pola breakpoint dengan KSP-02-F02) | UXP-04 |
| KSP-02-F04 | Klik Item → Popover → Draft Editor | ~~Klik item langsung membuka Draft Editor~~ — **Diamandemen ADR-090, komponen dikoreksi ADR-091**: klik item membuka `Popover` (KSP-02-F08) dulu; CTA di dalam Popover yang membuka Draft Editor. Berlaku khusus Calendar — Queue dan Drafts tetap klik → langsung Draft Editor (tidak berubah) | UXP-01 |
| KSP-02-F05 | Ganti Periode | Pengguna berpindah ke minggu/bulan lain lewat tombol Today, navigasi ‹ › (prev/next), dan toggle tampilan Minggu/Bulan. Label periode menyesuaikan (mis. "14–20 Jul" untuk minggu dalam 1 bulan, "28 Jul – 3 Ags" kalau minggu melintasi 2 bulan; "Agustus 2026" untuk tampilan bulan). State periode (`view=week\|month`, `date=<timestamp>`) dibawa lewat query param pada route tunggal `/publish/calendar` (tidak menambah route baru, konsisten ADR-046) | UXP-03 |
| KSP-02-F06 | Status Failed yang Mencolok | Item dengan status Failed ditampilkan dengan visual yang berbeda dan tidak bisa diabaikan | UXP-04 |
| KSP-02-F07 | Disconnected Account Warning | Jika akun dalam item berstatus Disconnected, indikator warning tampil di item tersebut | UXP-04, UXP-06 |
| KSP-02-F08 | Popover Ringkasan Post | **Baru (ADR-090, komponen dikoreksi ADR-091: Popover, bukan HoverCard — trigger klik, punya `isOpen` controlled, CTA aman di dalamnya).** Klik item Calendar membuka `Popover` (anatomi: Header + Body + Trigger) berisi: avatar + nama akun, platform, potongan caption, thumbnail media (kalau ada), status chip (reuse KSP-02-F02). Untuk post yang sudah Published, tambah section metrik (Views→`impressions`, Reach→`reach`, Replies→`comments`, Eng. Rate→`engagementRate` — field `PostMetrics` yang sudah ada, tanpa field baru) + tautan "Go to post". CTA di dalam Popover membuka Draft Editor (modal, ADR-052) untuk item tersebut | UXP-01, UXP-04 |
| KSP-02-F09 | Filter Status & Channel | Dropdown filter status post ("All Posts" / per status) dan filter akun (Channels) di atas grid. Filter Tags dan Timezone per-view dari referensi Buffer **tidak diadopsi** (tidak ada konsep Tag di domain model; Timezone bukan setting per-view di backlog — konsisten keputusan T-032.0 untuk Queue) | UXP-03 |

---

### Zona Fungsional

```
┌──────────────────────────────────────────────────────────┐
│  [Tab: Calendar] [Queue] [Drafts] [History]               │
├──────────────────────────────────────────────────────────┤
│  [Today] [‹ ›] Agustus 2026        [Channels▾][Status▾] [Minggu/Bulan▾] │
├────────┬──────┬──────┬──────┬──────┬──────┬──────────────┤
│  Sen   │ Sel  │ Rab  │ Kam  │ Jum  │ Sab  │ Ming         │
│        │      │      │      │      │      │              │
│ [item] │      │[item]│      │[item]│      │              │
│        │      │[item]│      │      │      │              │
├────────┴──────┴──────┴──────┴──────┴──────┴──────────────┤
│  [+ New Post]                                             │
└──────────────────────────────────────────────────────────┘
  Week view: grid per hari × jam (baris waktu, mis. 12 AM/2 AM/.../10 PM).
  Month view: grid per hari × tanggal penuh 1 bulan; sel dengan >3 item
  memakai badge "N More" (expand, tidak overflow diam-diam); tanggal hari
  ini ditandai badge bulat (bukan garis bawah seperti di Week view).
```

**Zona tab bar:** Tab Calendar, Queue, Drafts, History selalu terlihat di bagian atas.

**Zona period control:** Tombol Today, navigasi ‹ › (prev/next), label periode, filter Channels + Status, toggle Minggu/Bulan. Default: minggu berjalan (KSP-02-F01), state di query param (KSP-02-F05).

**Zona grid:** Week view = grid hari × slot jam. Month view = grid hari × tanggal bulan penuh dengan "N More" untuk sel padat. Setiap item menampilkan thumbnail akun dan status (KSP-02-F02); indikator tipe konten (KSP-02-F10). **Potongan caption hanya di Week view** — Month view (polishing UI, 2026-08-27) sengaja tidak menampilkan caption karena 1 sel bisa berisi banyak item sekaligus, ruangnya diprioritaskan untuk avatar+nama+waktu+status. Klik item membuka Popover (KSP-02-F08). Grid juga punya garis pemisah vertikal antar kolom hari (warna senada border Card, lebih halus dari garis horizontal antar baris/slot) — polishing UI, 2026-08-27.

**Zona New Post:** CTA tetap tersedia untuk langsung membuat konten baru.

---

### State Handling

| State | Tampilan |
| ----- | -------- |
| Ada konten terjadwal | Grid terisi dengan item sesuai slot waktu (Week) atau tanggal (Month) |
| Tidak ada konten minggu/bulan ini | **Diperbarui (polishing UI, 2026-08-27)** — grid, header hari, dan label tanggal/jam **tetap tampil penuh seperti biasa**, TIDAK diganti pesan/placeholder apa pun. Sel yang tidak punya item cukup menampilkan nomor tanggal/label jam kosong (perilaku ini sudah berlaku juga untuk sel individual yang kosong, sekarang berlaku sama saat SELURUH periode kosong) — membalik keputusan T-033.6 sebelumnya yang sempat menambah `EmptyState` di sini |
| Item Failed | Item ditampilkan dengan visual berbeda (warna atau ikon khusus) — tidak disembunyikan |
| Akun Disconnected | Indikator warning pada item yang terdampak + tautan ke Settings |
| Item loading | Skeleton per item saat data sedang dimuat |
| Sel Month view >3 item | Tampilkan maksimal item sesuai desain final + badge "N More" untuk expand — tidak boleh silently truncate tanpa indikator |
| Klik item | Popover terbuka (KSP-02-F08); metrik hanya tampil untuk post Published |

---

---

## KSP-03 — Publish — Queue

### Identitas

| Field | Value |
| ----- | ----- |
| Path IA | `Publish → Queue` |
| Pengguna Utama | Raka |
| Entry Points | Tab Queue dalam Publish |
| UX Principles | UXP-01, UXP-04, UXP-05, UXP-06 |

### Tujuan

Queue menampilkan konten yang **sudah terjadwal** (status `Scheduled`), dikelompokkan per tanggal lalu per jam, murni berurutan berdasarkan waktu publish — Raka memindai coverage jadwal ke depan dan mengidentifikasi gap dengan cepat. Item yang gagal publish (`Failed`) tidak lagi ditampilkan di sini — begitu percobaan publish selesai, item pindah ke **History** (KSP di luar 8 layar kritis, T-034), yang tetap menampilkan status heterogen per item.

**Amandemen 2026-08-19 (ADR-083):** cakupan layar ini dipersempit sengaja dari desain awal — Queue kini murni "antrean linear berdasarkan waktu publish" (status seragam Scheduled), bukan daftar campuran berbagai status dengan kemampuan atur-urutan manual. Perubahan ini diambil setelah King Rezi meminta penyelarasan dengan pola Buffer (`publish.buffer.com/schedule`).

---

### Critical Functions

| ID | Fungsi | Deskripsi | Prinsip |
| -- | ------ | --------- | ------- |
| KSP-03-F01 | Daftar Konten Terurut | Semua post terjadwal ditampilkan berurutan berdasarkan waktu publish, dikelompokkan per tanggal lalu per jam | UXP-01 |
| KSP-03-F02 | ~~Status per Item~~ — **Dioverride oleh F07 (ADR-083, 2026-08-19)**. Alasan asli: satu layar campuran status (Scheduled/Failed/Draft/dst.) butuh badge supaya tiap item terbedakan. Diputuskan cakupan Queue dipersempit jadi hanya `Scheduled` (seragam) — badge jadi tidak perlu. `Failed` pindah ke History (T-034), `Draft`/`Ready to Schedule` tetap di Drafts (T-022, sudah menampilkan status heterogen di sana) | UXP-04, UXP-06 (dipenuhi lewat cakupan homogen + aksi eksplisit F07, bukan badge status) |
| KSP-03-F03 | Filter per Akun | Pengguna dapat memfilter tampilan untuk satu akun tertentu — kontrol kecil, rata kanan, baris terpisah dari judul halaman | UXP-03 |
| KSP-03-F04 | Klik Item → Draft Editor | Klik card membuka Draft Editor (mode Edit) untuk item tersebut | UXP-01 |
| KSP-03-F05 | ~~Reorder Item~~ — **Dioverride oleh F01 (ADR-083, 2026-08-19)**, tanpa ID pengganti baru. Alasan asli: urutan dianggap perlu bisa disusun manual, independen dari waktu. Diputuskan urutan murni `scheduledAt` ascending (F01) sudah cukup; memindahkan jadwal berarti mengedit `scheduledAt` lewat Draft Editor (F04), bukan menyusun ulang urutan tampilan | — |
| KSP-03-F06 | New Post dari Queue | CTA New Post tersedia langsung dari Queue — sejajar judul halaman (`justify-between` dengan title/subtitle), bukan di baris filter | UXP-01 |
| KSP-03-F07 | Aksi eksplisit per item (ADR-083) | 3 tombol icon per card: **Publish Now** (reuse KSP-05-F12), **Edit** (buka Draft Editor, sama dengan F04), **Cancel Schedule** (icon merah, dialog konfirmasi Tier 2 — T-030, ADR-049) — menggantikan kombinasi badge status + klik generik | UXP-01, UXP-04 |
| KSP-03-F08 | Filter Sumber dan Badge MCP | Filter sumber (Semua / Dibuat manual / Lewat MCP, bawaan Semua) di samping filter akun; item yang dibuat lewat MCP menampilkan badge nama klien AI di baris meta. Detail: *Pola: Badge dan Filter Sumber MCP* | UXP-04, UXP-05, UXP-06 |

---

### Zona Fungsional

```
┌──────────────────────────────────────────────────┐
│  Publish                              [+ New Post]│
│  Antrean linear berdasarkan waktu publish          │
├──────────────────────────────────────────────────┤
│  [Tab: Calendar] [Queue] [Drafts] [History]       │
├──────────────────────────────────────────────────┤
│                                [Semua Akun ▼]     │
├──────────────────────────────────────────────────┤
│  Senin, 14 Juli                                    │
│  ┌────────────────────────────────────────────┐  │
│  │ 10:00 · Instagram   Caption preview...       │  │
│  │                        [Publish][Edit][✕]    │  │
│  └────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────┤
│  Selasa, 15 Juli                                   │
│  ┌────────────────────────────────────────────┐  │
│  │ 09:00 · Facebook    Caption preview...       │  │
│  │                        [Publish][Edit][✕]    │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

**Zona judul:** Title + subtitle "Antrean linear berdasarkan waktu publish" di kiri, New Post di kanan (`justify-between`).

**Zona filter:** Baris terpisah di bawah tab, filter akun kecil rata kanan (disusul filter sumber MCP, F08) — bukan menyatu dengan CTA New Post.

**Zona list:** Dikelompokkan per tanggal (heading), lalu per jam di dalamnya. Setiap item = 1 `Card` sendiri (bukan satu card menaungi seluruh list), berisi waktu, platform + nama akun, potongan caption, dan 3 tombol aksi (F07). Tidak ada badge status.

---

### State Handling

| State | Tampilan |
| ----- | -------- |
| Ada konten terjadwal | Card per item, dikelompokkan per tanggal |
| Queue kosong | _"Tidak ada konten terjadwal"_ + CTA New Post |
| Filter aktif — tidak ada item | _"Tidak ada konten untuk akun ini"_ |
| Filter sumber "Lewat MCP" — tidak ada item | _"Belum ada konten dari klien AI"_ + tombol Tampilkan Semua |

Item `Failed` **tidak muncul** di state manapun pada layar ini (amandemen ADR-083) — lihat History (T-034) untuk state kegagalan publish.

---

---

## KSP-04 — Publish — Drafts

### Identitas

| Field | Value |
| ----- | ----- |
| Path IA | `Publish → Drafts` |
| Pengguna Utama | Raka |
| Entry Points | Tab Drafts dalam Publish; Empty state di Queue/Calendar (CTA New Post) |
| UX Principles | UXP-01, UXP-03, UXP-05, UXP-06 |

### Tujuan

Drafts adalah tempat Raka menyimpan dan mengakses konten yang belum terjadwal — baik yang baru dibuat maupun yang sengaja ditarik kembali dari Queue.

---

### Critical Functions

| ID | Fungsi | Deskripsi | Prinsip |
| -- | ------ | --------- | ------- |
| KSP-04-F01 | Daftar Draft | Semua draft yang belum terjadwal, berurutan berdasarkan waktu terakhir diedit | UXP-06 |
| KSP-04-F02 | Status per Item | Status setiap item: Draft, In Review, Ready to Schedule | UXP-06 |
| KSP-04-F03 | Klik Item → Draft Editor | Klik item membuka Draft Editor untuk melanjutkan pengerjaan | UXP-01 |
| KSP-04-F04 | New Post | CTA untuk membuat draft baru, langsung membuka Draft Editor kosong | UXP-01 |
| KSP-04-F05 | Filter / Sort | Pengguna dapat memfilter atau mengurutkan draft (opsional untuk MVP) | UXP-03 |
| KSP-04-F06 | Filter Sumber dan Badge MCP | Filter sumber (Semua / Dibuat manual / Lewat MCP, bawaan Semua) di atas daftar — kontrol filter pertama di layar ini; draft yang dibuat lewat MCP menampilkan badge nama klien AI di baris meta. Detail: *Pola: Badge dan Filter Sumber MCP* | UXP-04, UXP-05, UXP-06 |

---

### Zona Fungsional

```
┌──────────────────────────────────────────────────┐
│  [Tab: Calendar] [Queue] [Drafts] [History]       │
├──────────────────────────────────────────────────┤
│                                    [+ New Post]  │
├──────────────────────────────────────────────────┤
│  Caption preview...                      Draft   │
│  Diedit 2 jam lalu                           [>] │
├──────────────────────────────────────────────────┤
│  Caption preview...              Ready to Schedule│
│  Diedit kemarin                              [>] │
├──────────────────────────────────────────────────┤
│  Caption preview...                      Draft   │
│  Diedit 3 hari lalu                          [>] │
└──────────────────────────────────────────────────┘
```

**Zona CTA:** New Post di atas — akses paling cepat untuk membuat konten baru.

**Zona list:** Setiap item menampilkan potongan caption, waktu terakhir diedit, dan status.

---

### State Handling

| State | Tampilan |
| ----- | -------- |
| Ada draft | Daftar item berurutan waktu edit |
| Tidak ada draft | _"Belum ada draft"_ + CTA New Post |
| Filter sumber "Lewat MCP" — tidak ada item | _"Belum ada konten dari klien AI"_ + tombol Tampilkan Semua |

---

---

## KSP-05 — Publish — Draft Editor

### Identitas

| Field | Value |
| ----- | ----- |
| Path IA | `Publish → Drafts → Draft Editor` (dibuka sebagai modal, bukan route terpisah — ADR-052). Variant Dialog final sejak ADR-065 (Standard default, Fullscreen via toggle) — lihat Catatan di bawah |
| Pengguna Utama | Raka |
| Entry Points | New Post; Klik item dari Calendar / Queue / Drafts; Quick Compose dari Channels sidebar (akun otomatis pre-selected, NP-D14) |
| UX Principles | UXP-01, UXP-03, UXP-04, UXP-06 |

### Tujuan

Draft Editor adalah **layar kerja terpenting** dalam produk. Raka menulis, melengkapi, dan menjadwalkan konten dari layar ini. Semua kebutuhan untuk menyelesaikan satu konten tersedia di sini tanpa berpindah layar.

**Catatan (ADR-052):** Draft Editor sekarang dibuka sebagai modal di atas sub-screen Publish manapun yang aktif — bukan panel/layar penuh dengan route sendiri (mengoverride NP-D02, lihat NP-D11 di `navigation-patterns.md`). Berlaku untuk New Post dan Edit Draft.

**Variant Dialog — final sejak ADR-065.** Toggle di header modal (sejajar status chip, sebelah kiri tombol Close) tetap ada sebagai fitur resmi produk, dengan default berikut:
- **`standard` (default, ADR-065):** card besar mengambang dengan backdrop gelap — layar di belakang (termasuk sidebar) tetap terlihat, redup.
- **`fullscreen` (alternatif via toggle):** menutupi seluruh viewport — sidebar navigasi & Calendar/Queue/Drafts tertutup total selama modal terbuka. Tidak punya backdrop gelap terlihat (tidak ada apa-apa di belakang untuk digelapkan).

Tidak dipersist antar sesi (session-only), sama seperti pola Light/Dark Mode Toggle (ADR-055).

**Redesain Tahap 1 — final sejak ADR-155 (rancangan dikonfirmasi King Rezi, 2026-11-03):** tata letak mengikuti pola modal Create Post Buffer (pola dan perilaku, bukan salinan), dibangun dari komponen shadcn/ui dan token Postific. Baris channel pindah ke atas editor, Pratinjau live per platform ada di zona kanan, pengaturan per jaringan berbentuk blok akordeon, dan jadwal serta aksi ada di footer. Lebar kartu `standard` naik dari 960px ke 1120px. Satu caption dan satu set media dipakai bersama semua jaringan (caption dan media per jaringan di luar Tahap 1). Rancangan visual: galeri Postific Design Review, entri "Draft Editor: redesain pola Buffer (ADR-155)".

---

### Critical Functions

| ID | Fungsi | Deskripsi | Prinsip |
| -- | ------ | --------- | ------- |
| KSP-05-F01 | Caption Editor | Area tulis utama untuk caption konten — menjadi fokus saat layar terbuka | UXP-01, UXP-03 |
| KSP-05-F02 | ~~AI Caption Assist~~ — **Dicabut ADR-138**. AI bawaan Postific dicabut; AI pengguna membuat draft lewat MCP, bukan lewat trigger di Caption Editor. ID tidak dipakai ulang | — |
| KSP-05-F03 | Media Attachment | Lampirkan gambar atau video dari perangkat lokal atau Media Library | UXP-01 |
| KSP-05-F04 | Account Selector | Baris channel di atas editor (ADR-155): tombol Channels membuka popover (pencarian, Pilih semua, daftar centang dengan avatar, badge platform, dan status koneksi, tautan Hubungkan akun), plus pintasan Terakhir dipakai dan Semua. Setelah dipilih, baris menciut jadi chip avatar (aksi hapus per chip) dan tombol Tambah akun. Akun Disconnected tetap tampil dengan peringatan dan aksi Reconnect, dan tidak diblokir di UI | UXP-04 |
| KSP-05-F05 | Schedule Picker | Tombol "Atur jadwal" di footer membuka popover: kalender (hari lampau dan hari lebih dari 30 hari ke depan dinonaktifkan, ADR-154), input jam, dan label zona waktu pengguna (default WIB, ADR-146); setelah diisi tombol menampilkan jadwal terpilih. Tidak ada "Next Available" di Tahap 1 (ADR-155) | UXP-04 |
| KSP-05-F06 | Confirmation Summary | Ringkasan: preview caption, akun tujuan, **format per akun**, waktu — ditampilkan sebelum Schedule dieksekusi. Panel Pratinjau tetap terlihat saat ringkasan tampil (ADR-155) | UXP-04 |
| KSP-05-F07 | Status Indicator | Status draft saat ini: Draft, In Review, Ready to Schedule, Scheduled, Published, Failed — selalu terlihat | UXP-06 |
| KSP-05-F08 | Save as Draft | Simpan progres tanpa menjadwalkan. Setelah tersimpan, modal ditutup dan pengguna diarahkan ke **Publish → Drafts** — terlepas dari section mana modal dibuka (ADR-054) | UXP-01 |
| KSP-05-F09 | Schedule Action | Eksekusi penjadwalan setelah pengguna konfirmasi (Confirmation Summary, KSP-05-F06). Setelah berhasil, modal ditutup dan pengguna diarahkan ke **Publish → Queue** — terlepas dari section mana modal dibuka (ADR-054) | UXP-04 |
| KSP-05-F10 | Tutup Modal | Tombol Close di header modal menutup Draft Editor, kembali ke sub-screen asal (Calendar / Queue / Drafts) tanpa navigasi URL. Untuk **New Post**, state form yang belum disimpan tetap ada via localStorage (lihat KSP-05-F13). Untuk **Edit Draft**, tidak ada mekanisme resume — perubahan yang belum disimpan hilang saat modal ditutup (ADR-052) | UXP-03 |
| KSP-05-F11 | Content Format Selector | Pilih format publikasi **per akun terpilih** sesuai platform (ADR-039) di dalam blok pengaturan jaringan: IG/FB → Post / Reel / Story; Pinterest → Pin (+ field pin); TikTok & lainnya → Post (tanpa radio Reel/Story). Opsi yang tidak valid untuk media dinonaktifkan: Reel nonaktif bila media bukan video (ADR-155, mengamandemen ADR-154) | UXP-01, UXP-03 |
| KSP-05-F12 | Publish Now Action | Eksekusi publish langsung tanpa jadwal (skip Schedule Picker) — tersedia berdampingan dengan Schedule Action di action bar, untuk semua role: Account Owner, Admin, Creator (ADR-047, ADR-074). Setelah berhasil, modal ditutup dan pengguna diarahkan ke **Publish → History** — karena History belum jadi layar terdokumentasi (KSP-D10), tujuan sementara adalah **Publish → Calendar** sampai layar itu dibangun (ADR-054) | UXP-04, UXP-06 |
| KSP-05-F13 | Resume Unfinished Post (New Post saja) | Saat modal **New Post** dibuka dan ditemukan state belum-tersimpan di localStorage dari sesi sebelumnya, tampilkan dialog konfirmasi "Resume unfinished post?" dengan dua pilihan: **Resume** (lanjutkan isi form dari state tersimpan) atau **Mulai Baru** (buang state lama, form kosong). **Tidak berlaku untuk Edit Draft** — draft existing selalu dibuka dengan data dari server, tanpa cek localStorage (ADR-052) | UXP-03, UXP-04 |
| KSP-05-F14 | Pratinjau Live | Panel kanan menampilkan pratinjau per platform yang diperbarui saat mengetik dan saat memilih akun atau blok: Facebook, Instagram, TikTok, dan Pinterest meniru tampilan platform (dirakit dari komponen dan token Postific, ADR-155), platform lain memakai kartu generik. Pil "Simpan" pada kartu pin Pinterest memakai warna primer netral, bukan merah merek Pinterest (T-209.4, 2026-11-12). Dengan lebih dari satu akun terpilih, pemilih Pratinjau per akun berupa dropdown (shadcn `Select`, ADR-156) dengan ikon platform dan handle di tiap opsi, bukan tab; judul panel menampilkan platform dan format akun aktif. Toggle Pratinjau di header menampilkan atau menyembunyikan panel; ada keadaan kosong saat belum ada akun terpilih; dengan akun tanpa isi, kartu tampil dengan placeholder caption | UXP-04 |
| KSP-05-F15 | Blok Pengaturan per Jaringan | Setiap akun terpilih punya blok berbentuk akordeon (satu blok terbuka, lainnya menciut jadi baris ringkas berisi ikon platform, potongan caption, dan thumbnail media). Isi blok: format (F11), field khusus platform yang sudah didukung (Pinterest: board, judul, link), dan banner validasi (F16). Saat hanya satu akun terpilih, blok selalu terbuka tanpa akordeon. Caption dan media tetap satu dan bersama untuk semua jaringan | UXP-01, UXP-03 |
| KSP-05-F16 | Validasi Inline | Banner validasi tampil di dekat sumber masalahnya: validasi per jaringan (media wajib, board Pinterest, Reel butuh video) di dalam blok jaringan; validasi lintas jaringan (Story + caption campur, lebih dari satu akun Pinterest) di atas editor; validasi jadwal (di luar batas 30 hari) di footer dekat kontrol jadwal. Schedule dan Publish Now nonaktif sampai valid (ADR-107, ADR-121, ADR-154, ADR-155). Semua banner Draft Editor memakai ikon peringatan di kiri teks: semua pelanggaran validasi memblokir Schedule dan Publish Now; warna adalah pilihan rancangan, bukan penanda memblokir: Reel bukan video, board Pinterest belum dipilih, pesan lintas jaringan, pesan batas jadwal di footer, galat hasil aksi, dan galat di Confirmation Summary berwarna destructive; "tanpa media" (tetap memblokir) dan akun terputus berwarna peringatan (kuning), rancangan T-250 (dikonfirmasi King Rezi 2026-11-12) | UXP-04 |

---

### Zona Fungsional

Draft Editor dibagi menjadi dua zona utama, kiri (Channel + Editor + Blok Jaringan) dan kanan (Pratinjau), dengan footer aksi di bawahnya (ADR-155):

Layout di bawah ini dirender di dalam modal (ADR-052, default `variant="standard"` selebar 1120px sejak ADR-065 dan ADR-155, alternatif `variant="fullscreen"` via toggle — lihat Catatan di Identitas) — bukan halaman route sendiri. Header modal menampilkan judul, status chip, toggle Pratinjau, toggle variant, dan tombol Close, bukan "← Kembali".

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Draft Editor  [Status ▼]         [Pratinjau]  [⤢ Fullscreen]  [✕ Close] │
├───────────────────────────────────────────┬─────────────────────────────┤
│  BARIS CHANNEL                            │  PRATINJAU                  │
│  [+ Channels] [Terakhir dipakai] [Semua]  │  (live per platform)        │
│  setelah dipilih: (IG) (FB) [+ Tambah]    │                             │
│                                           │  Facebook                   │
│  EDITOR                                   │  ┌───────────────────────┐  │
│  [Tulis caption di sini...]               │  │ avatar  nama          │  │
│  [thumbnail media] [+ dropzone]           │  │ caption               │  │
│                                           │  │ media                 │  │
│  BLOK PER JARINGAN (akordeon)             │  └───────────────────────┘  │
│  ▼ Instagram   ○ Post ○ Reel ○ Story      │  Instagram                  │
│    ⚠ Banner validasi                      │  ┌───────────────────────┐  │
│  ▶ Facebook    "caption…"  [thumb]        │  │ ...                   │  │
│  ▶ Pinterest   board / judul / link       │  └───────────────────────┘  │
├───────────────────────────────────────────┴─────────────────────────────┤
│  [Save as Draft]            [Atur jadwal ▼]  [Publish Now]  [Schedule]  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Zona kiri — Baris Channel:** Di atas editor. Tombol Channels membuka popover pemilihan akun dengan status koneksi; pintasan Terakhir dipakai dan Semua mempercepat pemilihan; akun terpilih tampil sebagai chip avatar (F04).

**Zona kiri — Caption Editor:** Area utama yang menjadi fokus saat layar terbuka. Satu caption bersama untuk semua jaringan. Besar, bisa expand.

**Zona kiri — Media Attachment:** Di bawah Caption Editor. Thumbnail media yang dilampirkan dan dropzone yang tetap tersedia untuk menambah media. Syarat media menyesuaikan format terpilih per jaringan (mis. Story/Reel butuh media vertikal, Reel butuh video). Media dipakai bersama semua jaringan.

**Zona kiri — Blok Pengaturan per Jaringan:** Di bawah media. Satu blok per akun terpilih berbentuk akordeon (F15): format Post / Reel / Story (F11), field Pinterest (board, judul, link), dan banner validasi (F16). Akun Meta (IG/FB) punya selector Post / Reel / Story; Pinterest menampilkan field Pin; TikTok & platform lain tanpa radio Reel/Story. Akun Disconnected menampilkan warning.

**Zona kanan — Pratinjau:** Panel pratinjau live per platform (F14). Memilih blok atau chip akun mengganti pratinjau ke platform itu.

**Footer — Aksi:** Save as Draft (aksi sekunder), kontrol jadwal "Atur jadwal" (F05), Publish Now, dan Schedule. Schedule adalah aksi primer; Save as Draft adalah aksi sekunder.

**Layar sempit (di bawah 640px):** Modal memenuhi layar dengan tab "Editor | Pratinjau" di bawah header, footer ditumpuk, dan toggle Fullscreen/Standard serta Pratinjau di header disembunyikan (ADR-155).

---

Catatan (ADR-052/ADR-065): pengguna bisa berpindah antara dua variant lewat toggle resmi di header modal (fitur produk, bukan lagi alat banding sementara). Pada variant `standard` (**default sejak ADR-065**), sidebar dan layar di belakang tetap terlihat, redup di balik backdrop. Pada variant `fullscreen` (alternatif, dipilih lewat toggle), sidebar navigasi **tertutup total** selama modal terbuka (trade-off yang disadari, lihat NP-D11) — berbeda dari versi sebelumnya di mana sidebar tetap terlihat. Pilihan toggle tidak dipersist — reset ke Standard setiap modal dibuka ulang. Lebar kartu `standard` adalah 1120px (ADR-155).

---

### Pola: Account Selector dengan Status

```
Account Selector menampilkan semua akun terhubung:

  ✅ Instagram @brandname      (Active)
  ✅ X @brandname              (Active)
  ⚠️  LinkedIn @brandname      (Disconnected) → [Reconnect]
  ✅ Facebook @brandname       (Active)
```

Akun Disconnected tetap ditampilkan — tidak disembunyikan. Pengguna melihat masalah di titik kritis (saat memilih akun), bukan setelah dijadwalkan. (UXP-04)

Klik tautan **Reconnect** membawa pengguna ke KSP-08.

Pada tata letak ADR-155 daftar ini tampil di popover Channels (daftar centang dengan status koneksi). Akun Disconnected tetap bisa dicentang dengan peringatan dan aksi Reconnect, dan Schedule/Publish Now tidak diblokir di UI (mengikuti perilaku saat ini).

---

### Pola: Confirmation Summary sebelum Schedule / Publish Now

Sebelum tombol Schedule **atau Publish Now** (KSP-05-F12, ADR-047) dieksekusi, pengguna melihat ringkasan konfirmasi:

```
Konfirmasi Jadwal:
  Caption: "Selamat pagi! Hari ini kami..."
  Akun:
    · Instagram @brandname — Reel
    · Facebook @brandname — Post
    · X @brandname — Post
  Waktu: Senin, 14 Jul 2025 — 10:00 WIB
  
  [Batal]   [Konfirmasi & Jadwalkan]
```

Untuk Publish Now, baris "Waktu" berubah jadi "Sekarang" dan tombol menjadi "Konfirmasi & Publish" — struktur ringkasan tetap sama, hanya menegaskan bahwa aksi ini tayang langsung tanpa jeda koreksi seperti `cancelSchedule` pada Schedule.

Confirmation Summary ini adalah pola konfirmasi **paling lengkap** yang didokumentasikan di produk — dipakai khusus untuk dua aksi yang mempublikasikan konten: Schedule dan Publish Now (UXP-04). Disconnect Account punya pola konfirmasi sendiri yang lebih ringkas (KSP-08-F07, ADR-048) karena bukan aksi publish. Aksi lain (Save as Draft, Remove Member, Transfer Ownership, Delete Workspace, dll.) masih belum memiliki spesifikasi konfirmasi apa pun. Format per akun wajib terlihat agar tidak salah jadwalkan Story/Reel. Pada tata letak ADR-155 panel Pratinjau tetap terlihat saat ringkasan tampil.

---

### State Handling

| State | Tampilan |
| ----- | -------- |
| Draft baru (kosong) | Caption Editor terfokus; Account Selector belum dipilih; Content Format belum relevan sampai akun dipilih; Schedule Picker kosong |
| Draft ada konten | Caption terisi, media terlampir (jika ada), akun + format per akun, dan waktu terisi |
| Unsaved New Post ditemukan di localStorage saat modal dibuka | Sebelum form dirender, tampilkan dialog "Resume unfinished post?" (KSP-05-F13) — Resume mengisi form dari state tersimpan, Mulai Baru menghapus state dan membuka form kosong. Khusus New Post, tidak berlaku untuk Edit Draft (ADR-052) |
| Edit Draft dibuka | Form terisi dari data server tanpa cek localStorage. Account Selector (akun, format, dan opsi Pinterest yang tersimpan) ikut terisi (KI-060, ADR-125). Schedule Picker tetap kosong — tanggal/jam belum dipersist saat Save Draft |
| Format tidak valid untuk platform | Selector menolak opsi; Schedule diblok sampai format/media/`platformOptions` valid (ADR-039) |
| Status Scheduled | Status Indicator menampilkan "Scheduled"; aksi berubah: Edit Schedule / Unschedule |
| Status Published | Status Indicator menampilkan "Published"; layar read-only dengan opsi lihat di platform |
| Status Failed | Status Indicator menampilkan "Failed" + pesan alasan; aksi: Retry atau Edit |
| Akun Disconnected | Warning (kuning, ikon peringatan) pada Account Selector dan di blok jaringan + aksi Reconnect |
| Validasi gagal (media wajib, board Pinterest, Reel bukan video, jadwal di luar 30 hari) | Banner inline di dekat sumbernya (blok jaringan, atas editor, atau footer, lihat F16); Schedule dan Publish Now nonaktif sampai valid (ADR-155) |
| Satu akun terpilih | Blok jaringan selalu terbuka tanpa akordeon (ADR-155) |
| Layar sempit (di bawah 640px) | Modal penuh dengan tab Editor / Pratinjau di bawah header; footer ditumpuk; toggle Fullscreen/Standard dan Pratinjau di header disembunyikan (ADR-155) |

---

---

## KSP-06 — Engage — Inbox

> **Diamandemen ADR-157 (2026-11-05, T-221):** unit utama Engage adalah posting (bukan item inbox), status komentar menjadi `unread` / `replied` / `resolved` / `dismissed`, filter dibagi menjadi filter utama di header dan panel Filter & Sort, dan ada pilihan tampilan By post / List. Rancangan visual: kartu `ScreenEngagePerPosting` di artifact Postific dan entri "Engage: per posting" di galeri Postific Design Review (T-216, dikonfirmasi King Rezi 2026-11-05). Tab Mentions dan DM ditunda (T-223, ADR-040).

### Identitas

| Field | Value |
| ----- | ----- |
| Path IA | `Engage → Inbox` |
| Pengguna Utama | Raka |
| Entry Points | Sidebar → Engage; Notification badge; Deep link dari Home |
| UX Principles | UXP-01, UXP-03, UXP-06 |

### Tujuan

Inbox adalah pusat triage komentar — Raka membaca dan membalas komentar dari semua akun dalam satu tempat, tanpa harus membuka native app per platform. Komentar dikelompokkan per posting karena triage alaminya mengikuti posting yang memicu komentar. Data diperbarui melalui periodic pull setiap 30 menit atau manual refresh.

---

### Critical Functions

| ID | Fungsi | Deskripsi | Prinsip |
| -- | ------ | --------- | ------- |
| KSP-06-F01 | Daftar Posting | Daftar posting yang punya komentar. Kartu memuat ikon platform, nama akun, cuplikan caption, thumbnail bila ada, badge jumlah komentar belum dibalas, dan progress bar rasio komentar yang sudah ditangani. Komentar tanpa `postId` masuk satu kelompok "Tanpa posting" di dasar daftar. Posting tanpa komentar disembunyikan; satu toggle menampilkannya | UXP-06 |
| KSP-06-F02 | Filter dan Sort | Filter utama di header: Akun dan Status (dropdown single-select bercentang: Semua, Belum dibalas, Dibalas, Selesai, Diabaikan). Satu tombol ikon membuka panel Filter & Sort: Platform, Sort By (belum dibalas dulu = bawaan, terbaru, terlama), Date Range (7 hari, 30 hari, 6 bulan, 12 bulan = bawaan), dan Reset filters (mengembalikan semua filter ke bawaan) | UXP-03 |
| KSP-06-F03 | Komentar Posting Terpilih | Pilih posting membuka komentarnya di panel kanan — tidak membuka layar baru. Panel memuat kartu pratinjau posting (konteks post asal), ringkasan "x dibalas / y total komentar" (x = status Dibalas saja) dengan teks kecil "n dari y ditangani", dan daftar komentar | UXP-03 |
| KSP-06-F04 | Konteks Post Asal | Kartu pratinjau posting (platform, akun, tanggal, media, caption terpotong) di atas daftar komentar | UXP-01 |
| KSP-06-F05 | Reply Action | Membalas komentar dari Inbox. Komposer docked di bawah panel kanan pada tampilan By post; inline di bawah komentar pada tampilan List. Balasan yang terkirim menandai komentar `Dibalas` bila sebelumnya `Belum dibalas` | UXP-01 |
| KSP-06-F06 | Status Komentar | Aksi per komentar (muncul saat hover; selalu tampil di layar sempit): Resolve (→ `Selesai`), Dismiss (→ `Diabaikan`), dan Buka kembali (→ `Belum dibalas`) untuk komentar `Selesai` atau `Diabaikan`. Reply tersedia di semua status, kecuali untuk kelompok "Tanpa posting": Outstand hanya membalas per posting (ADR-113), jadi komposer nonaktif dengan pesan jelas; Resolve dan Dismiss tetap tersedia di kelompok itu. Aksi ini reversibel dan low-stakes | UXP-06 |
| KSP-06-F07 | Sync Status | Menampilkan waktu sinkronisasi terakhir dan state sinkronisasi | UXP-03, UXP-06 |
| KSP-06-F08 | Manual Refresh | Mengambil komentar terbaru tanpa menunggu periodic pull 30 menit berikutnya | UXP-03 |
| KSP-06-F09 | Pilihan Tampilan | Toggle By post (bawaan) / List di header. List menampilkan komentar sebagai daftar datar lintas posting dengan baris konteks "Pada posting: …" yang membawa pengguna ke tampilan By post; sort, filter, dan aksi status sama dengan By post. Isi tampilan List adalah usulan rancangan (mode List Buffer belum teramati) | UXP-03 |

### Status Komentar

| Status | Arti | Masuk dari | Keluar ke |
| ------ | ---- | ---------- | --------- |
| `unread` (Belum dibalas) | Komentar baru dari sinkronisasi, belum ditangani | Sinkronisasi; Buka kembali dari `resolved` / `dismissed` | `replied`, `resolved`, `dismissed` |
| `replied` (Dibalas) | Balasan berhasil terkirim dari Inbox | `unread`, otomatis saat balasan terkirim | `resolved`, `dismissed` |
| `resolved` (Selesai) | Sudah ditangani | `unread`, `replied` | `unread` (Buka kembali) |
| `dismissed` (Diabaikan) | Tidak perlu ditindaklanjuti | `unread`, `replied` | `unread` (Buka kembali) |

Balasan terkirim tidak menurunkan `resolved` atau `dismissed`. Baris lama berstatus `done` dimigrasi menjadi `resolved` (T-217.4). Badge sidebar dan Engagement Snapshot di Home tetap menghitung `unread` saja.

---

### Zona Fungsional

Inbox pada tampilan By post memakai pola **dua panel**: daftar posting di kiri (bisa dilipat), komentar posting terpilih di kanan.

```
┌────────────────────────────────────────────────────────────────────┐
│  Engage   Diperbarui 10:30 [Refresh]      [By post | List]         │
│  [Semua Akun ▼] [Semua Status ▼]                    [⚙ Filter&Sort]│
├──────────────────────────┬─────────────────────────────────────────┤
│  DAFTAR POSTING     [⊟]  │  KARTU PRATINJAU POSTING                │
│                          │  9 dibalas / 21 total komentar          │
│  [▣] @akun — caption…  6 │                                         │
│      Instagram  ▬▬▬▬░░   │  @user1: Komentar…          [Belum dibalas]
│                          │      [Reply] [Resolve] [Dismiss]  (hover)│
│  [▣] Fan page — …      1 │  @user2: Komentar…              [Dibalas]│
│                          │                                         │
│  Tanpa posting         2 │  [Balas…]  (komposer docked)            │
└──────────────────────────┴─────────────────────────────────────────┘
```

**Zona header:** Zona sinkronisasi, toggle By post / List, filter utama (Akun, Status), dan tombol Filter & Sort.

**Zona Daftar Posting:** Setiap kartu menampilkan platform, akun, cuplikan caption, thumbnail, badge belum dibalas, dan progress bar ditangani. Posting dengan komentar belum dibalas tampil lebih dulu (sort bawaan); kelompok "Tanpa posting" tetap di dasar dan tidak ikut sort.

**Zona Komentar:** Muncul saat posting dipilih. Menampilkan konteks post asal, daftar komentar dengan badge status, aksi hover, dan area balas. Banner informasi yang bisa ditutup boleh tampil di atas panel ini (teks persis ditentukan rancangan).

**Layar sempit (375px):** daftar posting dan komentar dipisah (push navigation: daftar → komentar dengan tombol kembali), aksi status selalu tampil.

---

### State Handling

| State | Tampilan |
| ----- | -------- |
| Ada komentar belum dibalas | Daftar posting terisi; posting dengan komentar belum dibalas di atas, badge menunjukkan jumlahnya |
| Semua komentar sudah ditangani | Kartu posting menampilkan penanda selesai alih-alih badge; filter `Belum dibalas` menghasilkan daftar kosong |
| Inbox kosong (tidak ada interaksi) | _"Belum ada interaksi"_ + pesan _"Mulai publish konten untuk melihat engagement"_ + CTA Buka Publish |
| Filter aktif — tidak ada hasil | _"Tidak ada interaksi untuk filter ini"_ + aksi Reset filters |
| Posting terpilih | Komentar tampil di panel kanan; daftar posting tetap terlihat (atau terlipat) |
| Panel daftar terlipat | Panel kanan memakai lebar penuh; tombol lipat membukanya kembali |
| Kelompok "Tanpa posting" dipilih | Komentar tanpa `postId` tampil tanpa kartu pratinjau posting; komposer balasan nonaktif dengan pesan bahwa komentar ini tidak terkait posting sehingga tidak dapat dibalas dari Postific; Resolve dan Dismiss tetap tersedia |
| Manual refresh berjalan | Tombol Refresh loading; data yang sudah ada tetap terlihat |
| Refresh gagal | Pesan ringkas _"Komentar terbaru belum dapat diambil"_ + aksi Coba Lagi; data sinkronisasi terakhir tetap terlihat |
| Balasan terkirim | Baris status di komposer: _"Balasan terkirim. Komentar ditandai Dibalas."_; badge dan hitungan diperbarui |

---

### Pola: Notification Badge → Inbox

Badge pada Engage di sidebar:

```
Badge muncul → Raka menyelesaikan pekerjaan saat ini (tidak interrupt)
             → Raka klik Engage di sidebar
             → Inbox terbuka dengan posting yang punya komentar belum dibalas di atas
             → Raka tangani satu per satu → Reply / Resolve / Dismiss
             → Badge hilang saat tidak ada lagi komentar belum dibalas
```

Badge tidak memaksa Raka interrupt alur yang sedang berjalan. Badge menghitung komentar `unread` saja (`replied`, `resolved`, `dismissed` tidak dihitung) yang diterima dalam 12 bulan terakhir, sama dengan Date Range bawaan daftar posting (keputusan King Rezi 2026-11-06), dan diperbarui setelah periodic pull atau manual refresh selesai; ia bukan indikator webhook real-time. Badge adalah sinyal, bukan perintah. (UXP-01, UXP-03)

**Batas MVP:** KSP-06 hanya menampilkan komentar dan reply. Tidak ada tab atau state untuk Direct Message, mention (termasuk story mention Instagram, T-223), maupun webhook engagement (ADR-040). Tampilan List adalah usulan rancangan yang belum punya padanan teramati di Buffer.

---

---

## KSP-07 — Analyze — Dashboard

### Identitas

| Field | Value |
| ----- | ----- |
| Path IA | `Analyze → Dashboard` |
| Pengguna Utama | Maya (review mingguan) |
| Pengguna Sekunder | Raka (memahami performa konten) |
| Entry Points | Sidebar → Analyze; Home → Analytics Snapshot |
| UX Principles | UXP-02, UXP-03, UXP-07 |

### Tujuan

Dashboard memberi Maya gambaran performa konten yang cukup untuk keputusan mingguan — tanpa navigasi berlapis dan tanpa ekspor manual. Angka harus dapat dibaca sekilas.

---

### Critical Functions

| ID | Fungsi | Deskripsi | Prinsip |
| -- | ------ | --------- | ------- |
| KSP-07-F01 | Summary Row | Highlight metrik utama periode aktif: total posts, total reach, total engagement | UXP-02, UXP-03 |
| KSP-07-F02 | Account Overview | Performa per akun sosial terhubung — memudahkan perbandingan antar akun | UXP-02 |
| KSP-07-F03 | Post Performance | Daftar post dengan metrik individual: reach, engagement, klik | UXP-02 |
| KSP-07-F04 | Engagement Summary | Total interaksi (komentar, likes) pada periode yang dipilih | UXP-02 |
| KSP-07-F05 | Period Filter | Filter per rentang waktu: minggu ini, bulan ini | UXP-03 |
| KSP-07-F06 | Account Filter | Filter tampilan untuk satu akun tertentu | UXP-03 |

---

### Zona Fungsional

```
┌────────────────────────────────────────────────────────┐
│  Filter: [Minggu Ini ▼]  [Semua Akun ▼]               │
├────────────────────────────────────────────────────────┤
│  SUMMARY ROW                                           │
│  12 Posts    4,320 Reach    6.5% Engagement            │
├────────────────────────────────────────────────────────┤
│  ACCOUNT OVERVIEW                                      │
│  Instagram @brand: 5 posts, 2,100 reach                │
│  X @brand: 4 posts, 1,400 reach                        │
│  LinkedIn @brand: 3 posts, 820 reach                   │
├────────────────────────────────────────────────────────┤
│  POST PERFORMANCE                        ENGAGEMENT    │
│  [Post 1] caption...  1,200 reach        SUMMARY       │
│  [Post 2] caption...    900 reach        48 komentar   │
│  [Post 3] caption...    750 reach        128 likes     │
│  ...                                                   │
└────────────────────────────────────────────────────────┘
```

**Summary Row:** Angka agregat di atas — Maya membaca ini pertama. Dibuat besar dan jelas.

**Account Overview:** Breakdown per akun. Maya melihat akun mana yang paling berkinerja.

**Post Performance:** Daftar post individual dengan metrik. Dapat diurutkan berdasarkan reach atau engagement.

**Engagement Summary:** Ringkasan total interaksi — melengkapi Post Performance.

---

### State Handling

| State | Tampilan |
| ----- | -------- |
| Ada data | Dashboard terisi penuh dengan angka aktual |
| Belum ada data (workspace baru) | Empty state: _"Belum ada data analytics."_ + CTA Connect Account + CTA Create First Post |
| Filter menghasilkan data kosong | _"Tidak ada data untuk filter ini"_ — tidak ada angka kosong atau grafik tanpa data |
| Akun baru belum ada data | Account Overview: akun tampil tanpa angka, dengan pesan _"Belum ada data untuk akun ini"_ |

---

### Pola: Empty State Analytics

```
Analyze → Dashboard (belum ada data)
  ↓
Tampilkan:
  "Belum ada data analytics."
  "Hubungkan akun sosial untuk mulai melacak performa konten."

  [Connect Account]    →  Settings → Organization → Connected Accounts
  [Create First Post]  →  Publish → Drafts → New Post
```

Tidak ada angka nol atau grafik kosong yang ditampilkan — lebih baik empty state yang komunikatif daripada data yang misleading. (UXD-03)

---

---

## KSP-08 — Settings — Organization — Connected Accounts

### Identitas

| Field | Value |
| ----- | ----- |
| Path IA | `Settings → Organization → Connected Accounts` |
| Pengguna Utama | Raka atau Maya (siapa yang memiliki akses Settings) |
| Entry Points | User Avatar → user menu → Settings → Organization; Error indicator / Reconnect link dari Calendar, Queue, Account Selector; klik channel berstatus Disconnected/Expired di Channels sidebar (NP-D14) |
| UX Principles | UXP-03, UXP-04 |

### Tujuan

Layar ini adalah satu-satunya tempat pengguna mengelola koneksi akun media sosial — menambah akun baru, memeriksa status koneksi yang ada, dan menangani akun yang terputus.

**Catatan (NP-D14):** daftar "Channels" di sidebar menampilkan quick-glance status + jalan pintas compose per akun dari section manapun, tapi **bukan pengganti** layar ini — Connect/Disconnect/Reconnect tetap eksklusif di sini.

---

### Critical Functions

| ID | Fungsi | Deskripsi | Prinsip |
| -- | ------ | --------- | ------- |
| KSP-08-F01 | Daftar Akun Terhubung | Semua akun yang sudah terhubung ditampilkan dengan status koneksinya | UXP-04, UXP-06 |
| KSP-08-F02 | Status Koneksi per Akun | Status tiap akun: Active, Disconnected, Expired | UXP-04 |
| KSP-08-F03 | Connect Account | CTA untuk menambah akun baru — memulai alur pemilihan platform dan OAuth | UXP-04 |
| KSP-08-F04 | Reconnect | Tombol Reconnect pada akun berstatus Disconnected — memulai ulang alur OAuth untuk akun tersebut | UXP-04 |
| KSP-08-F05 | Disconnect / Remove | Pengguna dapat melepas koneksi akun yang tidak diperlukan — wajib melalui Disconnect Confirmation (KSP-08-F07, ADR-048) sebelum eksekusi | UXP-03, UXP-04 |
| KSP-08-F06 | Platform Selector | Daftar platform yang tersedia saat menambah akun baru | UXP-03 |
| KSP-08-F07 | Disconnect Confirmation | Dialog konfirmasi sebelum akun benar-benar diputus — menampilkan peringatan bahwa post terjadwal untuk akun ini tetap di antrean (KSP-D09), bukan otomatis dibatalkan (ADR-048) | UXP-04 |

---

### Zona Fungsional

```
┌────────────────────────────────────────────────────────┐
│  Connected Accounts                    [+ Connect Account] │
├────────────────────────────────────────────────────────┤
│  Instagram                                    Active ✅ │
│  @brandname · Terhubung sejak 2 Jan          [Disconnect]│
├────────────────────────────────────────────────────────┤
│  X (Twitter)                            Disconnected ⚠️ │
│  @brandname · Token kadaluarsa          [Reconnect]     │
├────────────────────────────────────────────────────────┤
│  LinkedIn                                     Active ✅ │
│  Company Page · Terhubung sejak 10 Mar        [Disconnect]│
└────────────────────────────────────────────────────────┘
```

**Zona daftar akun:** Setiap akun menampilkan platform, username/nama halaman, status koneksi, dan tanggal dihubungkan. Aksi tersedia sesuai status.

**Zona CTA Connect:** Di atas daftar — tersedia kapanpun, tidak perlu scroll.

---

### Pola: Connect Account Flow

```
[+ Connect Account]
    ↓
Tampilkan daftar platform: Instagram, Facebook, X, LinkedIn, TikTok, YouTube, Threads, Pinterest.
    ↓
Pengguna memilih platform
    ↓
Buka OAuth flow platform (dibuka di tab/popup baru atau redirect)
    ↓
Pengguna login ke akun platform + berikan izin
    ↓
Kembali ke Connected Accounts
    ↓
Akun baru muncul dengan status Active
```

Langkah antara klik "Connect" dan halaman OAuth platform harus seminimal mungkin — tidak ada form tambahan yang tidak diperlukan. (UXP-03)

---

### Pola: Disconnect Flow (ADR-048)

```
[Disconnect] diklik
    ↓
Dialog Disconnect Confirmation:

  Putuskan koneksi Instagram @brandname?

  Post yang sudah terjadwal untuk akun ini akan tetap di antrean —
  tidak otomatis dibatalkan. Post baru tidak bisa dijadwalkan ke akun
  ini sampai disambungkan kembali.

  [Batal]   [Putuskan Koneksi]
    ↓
Klik "Putuskan Koneksi" → akun berubah status Disconnected
```

Disconnect hanya tersedia untuk role Owner/Admin (`roles-permissions.md`
— "Tambah/hapus connected accounts"). Dialog ini **tidak** memakai pola
Confirmation Summary (KSP-05-F06) — cukup peringatan singkat + dua
tombol, karena aksi ini bukan mempublikasikan konten dan tidak
memerlukan ringkasan multi-field.

---

### Pola: Reconnect Flow

```
Akun berstatus Disconnected
    ↓
[Reconnect] diklik
    ↓
OAuth flow diulang untuk akun tersebut
    ↓
Setelah berhasil → status kembali Active
    ↓
Post yang sudah terjadwal untuk akun ini tetap di antrean
```

Post terjadwal **tidak otomatis dibatalkan** ketika akun disconnect. Mereka tetap di Queue dan akan terkirim setelah akun kembali Active. (UF-05 Alternate Path)

---

### State Handling

| State | Tampilan |
| ----- | -------- |
| Ada akun aktif | Daftar akun dengan status Active |
| Ada akun disconnect | Akun Disconnected ditampilkan dengan visual berbeda + tombol Reconnect |
| Tidak ada akun sama sekali | Empty state: _"Belum ada akun terhubung"_ + CTA Connect Account yang menonjol |
| OAuth sedang berjalan | Indikator loading pada akun yang sedang dalam proses connect |
| OAuth gagal | Pesan error + opsi untuk mencoba ulang |

---

---

# Layar dan Pola MCP (ADR-138, ADR-139)

Ditambahkan 2026-10-23 setelah rancangan di artifact desain Postific dibuat (ADR-140). Rancangan visual ada di artifact Postific: `project/components/ScreenOauthConsent/preview.html` (KSP-09), `project/components/ScreenSettingsAiClients/preview.html` (KSP-10), `project/components/McpSourceBadge/preview.html` (pola badge dan filter). Tidak termasuk 8 layar kritis harian; pengguna menyentuhnya sesekali.

---

## KSP-09 — Persetujuan OAuth Klien AI

### Identitas

| Field | Value |
| ----- | ----- |
| Path IA | Di luar app shell (tanpa sidebar), halaman berdiri sendiri: Pilih Workspace → Persetujuan Scope |
| Pengguna Utama | Raka atau Maya |
| Entry Points | Redirect dari klien AI setelah pengguna login ke Postific (alur OAuth ADR-139) |
| UX Principles | UXP-03, UXP-04, UXP-05 |

### Tujuan

Pengguna memutuskan dengan sadar klien AI mana yang boleh bekerja di satu workspace, dengan izin apa. Satu persetujuan menghasilkan satu grant: pengguna + klien + workspace + scope.

---

### Critical Functions

| ID | Fungsi | Deskripsi | Prinsip |
| -- | ------ | --------- | ------- |
| KSP-09-F01 | Langkah 1 — Pilih Workspace | Daftar radio satu pilihan, hanya workspace tempat pengguna menjadi anggota aktif; menampilkan role dan jumlah akun terhubung. Tombol Lanjut dan Batal | UXP-03 |
| KSP-09-F02 | Langkah 2 — Persetujuan Scope | Workspace terpilih tampil di atas (dengan tautan Ubah), lalu daftar scope dan tombol Izinkan dan Tolak | UXP-04 |
| KSP-09-F03 | Identitas Klien | Nama klien dan host asalnya selalu tampil, dengan catatan bahwa klien mendaftar sendiri dan namanya diberikan klien itu sendiri (dynamic client registration) | UXP-04 |
| KSP-09-F04 | Scope dan Dampaknya | `read` dan `draft` tercentang bawaan; `schedule` kosong, diberi penanda "Berdampak", harus dicentang sengaja. Tiap scope disertai penjelasan dampak. `publish` dan `reply` tidak ditampilkan (ditunda, ADR-138) | UXP-04 |
| KSP-09-F05 | ~~Scope Dibatasi Role~~ — **Tidak berlaku di MVP** | ~~Scope yang tidak boleh dipakai oleh role pengguna di workspace terpilih tampil nonaktif beserta alasannya~~ Pada MVP tidak ada pembatasan scope berdasarkan role: semua role (Account Owner, Admin, Creator) setara untuk `read`, `draft`, dan `schedule`, selaras hak Schedule di `roles-permissions.md`. Semua scope selalu tampil aktif; satu-satunya pembatas adalah pilihan pengguna di F04 | UXP-04 |

---

### State Handling

| State | Tampilan |
| ----- | -------- |
| Langkah 1 normal | Daftar workspace, satu terpilih, Lanjut aktif |
| Pengguna tanpa workspace | Empty state: belum menjadi anggota workspace mana pun + CTA Buat Workspace; Lanjut nonaktif |
| Langkah 1 memuat | Skeleton kartu |
| Langkah 2 normal | Identitas klien, workspace terpilih, daftar scope, Tolak dan Izinkan |
| ~~Scope dibatasi role~~ | ~~Scope terkait nonaktif dengan alasan (F05)~~ — **Tidak berlaku di MVP**: tidak ada pembatasan scope berdasarkan role |
| Klien tanpa nama atau host tidak lazim (mis. localhost) | Peringatan keras; Tolak menjadi tombol utama dan Izinkan berlabel "Saya paham, izinkan" |
| Error simpan | Banner error, tidak ada akses diberikan, tombol Coba Lagi; pilihan workspace dan scope tetap |
| Menyimpan | Semua kontrol terkunci, tombol Izinkan menampilkan spinner "Menyimpan…" |

---

## KSP-10 — Settings — Account — Klien AI

### Identitas

| Field | Value |
| ----- | ----- |
| Path IA | `Settings → Account → Klien AI` |
| Pengguna Utama | Raka atau Maya |
| Entry Points | User Avatar → user menu → Settings → Account → Klien AI |
| UX Principles | UXP-03, UXP-04, UXP-05 |

### Tujuan

Pengguna melihat klien AI mana yang tersambung atas nama dirinya dan dapat mencabut aksesnya kapan saja. Pencabutan berlaku seketika: setiap panggilan MCP memeriksa grant di database (hasil spike T-148).

---

### Critical Functions

| ID | Fungsi | Deskripsi | Prinsip |
| -- | ------ | --------- | ------- |
| KSP-10-F01 | Daftar Koneksi Milik Sendiri | Satu baris per grant (klien + workspace): nama klien, workspace, scope sebagai chip, tanggal tersambung, terakhir dipakai (atau "Belum pernah dipakai"). Tanpa kolom pemilik; Owner/Admin tidak melihat koneksi anggota lain (IA-D09) | UXP-03, UXP-06 |
| KSP-10-F02 | Cabut | Tombol Cabut per baris membuka dialog konfirmasi Tier 2 (AlertDialog, ADR-049) yang menyebut klien dan workspace, bahwa klien langsung tidak bisa lagi mengakses data, dan bahwa draft atau post yang sudah dibuat atau dijadwalkan tetap ada | UXP-04 |
| KSP-10-F03 | Cara Menyambungkan | Tidak ada tombol Connect di layar ini; koneksi dimulai dari klien AI. Empty state menjelaskan langkahnya dan menampilkan URL MCP dengan tombol Salin | UXP-03 |

---

### Pola: Cabut Akses

```
[Cabut] diklik
    ↓
Dialog Tier 2:

  Cabut akses <klien>?

  <Klien> tidak bisa lagi membaca atau mengubah data workspace <workspace>.
  Draft dan post yang sudah dibuat atau dijadwalkan lewat klien ini tetap ada.
  Anda bisa menyambungkan lagi kapan saja.

  [Batal]   [Cabut Akses]
    ↓
Grant ditandai dicabut; baris hilang dari daftar
```

---

### State Handling

| State | Tampilan |
| ----- | -------- |
| Ada koneksi | Daftar baris dalam wadah `rounded-xl border` (pola KSP-08, tanpa header kolom) |
| Tidak ada koneksi | Empty state: langkah menyambungkan + URL MCP dengan tombol Salin |

---

## Pola: Badge dan Filter Sumber MCP

Berlaku untuk **History, Drafts, dan Queue** (KSP-03, KSP-04, dan daftar History). **Calendar tidak diberi badge.**

* **Badge:** komponen kecil bergaya outline (bukan fill, agar tidak bersaing dengan chip status) berisi ikon dan nama klien AI, ditaruh di **baris meta** di bawah judul sehingga kolom status dan aksi di kanan tidak bergeser. Nama dipotong dengan ellipsis; bila klien sudah dicabut atau dihapus, badge tetap tampil dengan nama terakhir yang tersimpan. Item yang dibuat manual tidak menampilkan badge dan tampil persis seperti sebelumnya.
* **Filter sumber:** pilihan satu dari tiga — Semua / Dibuat manual / Lewat MCP — memakai kontrol `select` yang sama dengan filter yang sudah ada. **Bawaan selalu Semua.** Di History ditambahkan sebagai select ketiga di samping Status dan Akun; di Queue di samping filter Akun; di Drafts menjadi kontrol filter pertama di atas daftar.
* **Tidak mengubah tampilan default:** tanpa filter aktif, setiap layar tampil seperti sebelum fitur ini ada, selain badge pada item MCP (`.claude/skills/claude-design-scope-discipline/SKILL.md`).
* **State kosong filter:** "Belum ada konten dari klien AI" + tombol Tampilkan Semua.

---

# Pola Lintas Layar — Safety Check / Double Confirmation (ADR-049)

Kebijakan ini berlaku di seluruh produk, tidak terikat ke satu KSP tertentu. Disusun dari audit menyeluruh (2026-07-29) atas setiap aksi yang ada di baseline — dipicu diskusi Publish Now (ADR-047) dan Disconnect Account (ADR-048) — untuk menentukan aksi mana yang wajib melalui dialog konfirmasi sebelum eksekusi.

## Kriteria

Sebuah aksi **wajib** melalui Safety Check / Double Confirmation jika memenuhi salah satu:

1. **Irreversibel atau mahal untuk dibatalkan** — tidak ada jalur "undo" yang wajar bagi pengguna.
2. **Blast radius besar** — dampaknya melampaui data milik pengguna sendiri (memengaruhi tim, workspace, atau konten yang sudah dijanjikan ke publik).

Aksi yang reversibel, low-stakes, atau berfrekuensi tinggi (bagian dari alur kerja inti harian) **sengaja tidak** diberi konfirmasi tambahan — menambahkannya akan jadi friksi yang melanggar UXP-03 (Simplisitas Adalah Quality Bar).

## Tingkatan (Tier)

| Tier | Pola UI | Kapan dipakai |
| --- | --- | --- |
| **Tier 1** | Konfirmasi diperkuat (mis. ketik nama/kata kunci workspace untuk konfirmasi) | Aksi katastropik: menghancurkan seluruh workspace atau menyerahkan kendali penuh, tidak ada jalan kembali sepihak |
| **Tier 2** | Dialog konfirmasi standar (peringatan singkat + tombol Batal/Konfirmasi) — pola sama seperti Disconnect Confirmation (KSP-08-F07, ADR-048) | Aksi merusak/mahal dibatalkan, tapi dampaknya tidak sebesar Tier 1 |
| **Tidak wajib** | Tanpa dialog tambahan | Reversibel, low-stakes, atau frekuensi tinggi — konfirmasi jadi friksi tanpa manfaat |

## Klasifikasi Lengkap

| Aksi | Tier | Alasan |
| --- | --- | --- |
| Transfer Ownership | Tier 1 | Menyerahkan kendali penuh workspace; Owner lama tidak bisa membatalkan sepihak |
| Delete/Hapus Workspace | Tier 1 | Menghancurkan seluruh data workspace sekaligus — paling katastropik di produk |
| Schedule | Tier 2 (sudah ada) | Confirmation Summary — KSP-05-F06/F09 |
| Publish Now | Tier 2 (sudah ada) | Confirmation Summary varian — KSP-05-F12 (ADR-047) |
| Disconnect Account | Tier 2 (sudah ada) | Disconnect Confirmation — KSP-08-F07 (ADR-048) |
| Delete Post | Tier 2 | Terasa permanen bagi pengguna meski soft delete di DB (`database-strategy.md` DB-D03) |
| Delete Media | Tier 2 | Hard delete beneran (tanpa `deleted_at`); media bisa dipakai ulang lintas draft |
| Remove Member | Tier 2 | Mengeluarkan rekan kerja dari workspace; perlu diundang ulang jika keliru |
| Update Member Role | Tier 2 | Terutama saat menurunkan akses — berdampak langsung ke apa yang bisa dikerjakan orang lain |
| Cancel Schedule | Tier 2 | Argumen simetri dengan Schedule (UXP-04) — membatalkan komitmen publish yang sudah dikonfirmasi sebelumnya |
| **Logout** | **Tier 2** | Keputusan produk (2026-07-29): melindungi dari interupsi pekerjaan yang belum tersimpan, walau aksi ini sendiri reversibel (beda dari rekomendasi awal — lihat Alternatives di ADR-049) |
| Save as Draft | Tidak wajib | Reversibel, low-stakes |
| Kirim ke Review (Creator) | Tidak wajib | Reversibel — bisa kembali ke Draft |
| Resolve / Dismiss komentar (Engage) | Tidak wajib | Reversibel (Buka kembali), low-stakes (ADR-157) |
| Reply/Kirim komentar (Engage) | Tidak wajib | Frekuensi tinggi — bagian dari alur kerja inti harian (UXP-03) |
| Connect Account | Tidak wajib | Sudah ada consent OAuth dari provider |
| Reconnect | Tidak wajib | Sudah ada consent OAuth dari provider |
| Remove Link (Start Page) | Tier 2 | Hitungan klik tautan ikut hilang dan tidak bisa dipulihkan; dialog "Hapus link?" (ADR-049, ADR-144) |

## Catatan Implementasi

* Schedule, Publish Now, dan Disconnect Account sudah punya screen resmi dan sudah diimplementasikan sebagai KSP function ID tersendiri.
* Delete Post, Delete Media, dan Cancel Schedule punya screen tempat bernaung (Draft Editor/Media Library) tapi entry point UI untuk aksi spesifik ini **belum dirancang** — klasifikasi tier di atas berlaku begitu entry point-nya dibuat, bukan keputusan yang menunggu lagi.
* Remove Member, Update Member Role, Transfer Ownership, dan Delete Workspace **belum punya screen sama sekali** (Settings → Organization → Members/General di luar 8 KSP) — klasifikasi tier di atas jadi acuan wajib begitu screen tersebut dirancang.
* Logout sudah punya entry point (User Menu dropdown, `navigation-patterns.md`) — implementasi dialog konfirmasinya adalah task terpisah.

---

# Decision Log

Keputusan desain yang dibuat dalam dokumen ini.

| ID | Keputusan | Alasan | Prinsip |
| -- | --------- | ------ | ------- |
| KSP-D01 | Home adalah layar orientasi, bukan dashboard kerja — tidak ada aksi berat yang diselesaikan di sini | Home melayani kebutuhan visibility Maya tanpa memaksa Raka melewatinya (IA-D03) | UXP-02, UXP-03 |
| KSP-D02 | ~~Draft Editor memiliki dua zona: kiri (Caption + Media) dan kanan (Account, Schedule, Actions)~~ — **Diamandemen ADR-155**: dua zona kiri (Baris Channel + Caption + Media + Blok per Jaringan) dan kanan (Pratinjau live), dengan footer aksi (Save as Draft, Atur jadwal, Publish Now, Schedule); pemilih Pratinjau per akun berupa `Select`, bukan tab (ADR-156) | Pemisahan ini memungkinkan Raka fokus menulis di kiri sambil konfigurasi publish di kanan — alur linear dari kiri ke kanan | UXP-01, UXP-03 |
| KSP-D03 | ~~AI Assist tampil sebagai trigger di dalam Caption Editor, bukan panel terpisah yang dibuka secara sengaja~~ — **Dicabut ADR-138**. AI bawaan dicabut; tidak ada trigger AI di Caption Editor | ~~AI paling berguna saat muncul tepat di momen penulisan, bukan sebagai destinasi navigasi (UXP-05, I-06)~~ | UXP-05 |
| KSP-D04 | Account Selector menampilkan akun Disconnected — tidak disembunyikan | Pengguna harus melihat masalah di titik keputusan, bukan setelah post gagal | UXP-04 |
| KSP-D05 | Confirmation summary muncul sebelum tombol Schedule **atau Publish Now** dieksekusi (ADR-047) | Membangun kepercayaan bahwa konten akan terbit ke akun dan waktu yang benar (UXP-04) | UXP-04 |
| KSP-D06 | Engage Inbox mengelompokkan komentar per posting dalam dua panel (daftar posting di kiri, komentar posting terpilih di kanan), dengan toggle By post / List (diamandemen ADR-157) | Triage komentar mengikuti posting yang memicunya; volume tinggi, pengguna perlu berpindah antar posting tanpa full-page navigation (NP-D03) | UXP-03 |
| KSP-D07 | Analytics Dashboard menampilkan Summary Row sebagai zona teratas | Maya membaca angka agregat pertama — bukan tabel detail yang mengharuskan scanning panjang | UXP-02, UXP-03 |
| KSP-D08 | Empty state Analytics menampilkan dua CTA, bukan angka nol atau grafik kosong | Angka nol atau grafik tanpa data misleading dan tidak membantu; CTA mengarahkan ke aksi yang bermakna (UXD-03) | UXP-03 |
| KSP-D09 | Post terjadwal tidak dibatalkan otomatis saat akun disconnect | Pembatalan otomatis lebih merusak daripada membiarkan post dalam antrean dan menunggu reconnect | UXP-04 |
| KSP-D10 | Publish History tidak masuk daftar 8 layar kritis | History adalah layar review passif — polanya sederhana (daftar + detail) dan tidak memerlukan dokumentasi mendalam di fase ini | UXP-03 |
| KSP-D11 | Start Page tidak masuk daftar 8 layar kritis | Start Page bukan bagian dari siklus kerja harian (UXP-01: Draft → Schedule → Publish → Engage → Review). Start Page adalah fitur konfigurasi yang diakses sesekali — bukan setiap sesi kerja. Polanya sederhana: form pengaturan + preview publik. Tidak ada pola koordinasi tim atau alur multi-langkah yang perlu didokumentasikan mendalam di fase ini. Isi layar Page Editor (Dialog tautan, tombol Simpan, selector tema, analytics dasar) dirinci di `information-architecture.md` § Start Page (ADR-144). | UXP-01, UXP-03 |
| KSP-D12 | Content Format Selector per akun di Draft Editor (bukan satu toggle global) | Format bergantung platform (IG/FB vs TikTok vs Pinterest); multi-account posting membutuhkan format independen per `PostTarget` (ADR-039) | UXP-01, UXP-03 |
| KSP-D13 | Engage Inbox hanya memuat komentar/reply dan menampilkan last sync + Manual Refresh | Kontrak resmi Outstand mendukung comment pull/reply, bukan unified DM/mention atau webhook engagement; periodic pull 30 menit perlu ekspektasi freshness yang terlihat (ADR-040) | UXP-03, UXP-06 |
| KSP-D14 | Disconnect Account wajib melalui dialog konfirmasi ringkas (bukan Confirmation Summary KSP-05-F06), bukan eksekusi langsung (ADR-048) | Ditemukan saat audit dokumentasi bahwa Disconnect tidak punya spesifikasi konfirmasi sama sekali padahal berdampak (post terjadwal tetap jalan tanpa akun aktif); level konfirmasi cukup peringatan + dua tombol karena bukan aksi publish konten | UXP-04 |
| KSP-D15 | Setelah Save as Draft / Schedule / Publish Now, modal ditutup dan pengguna diarahkan ke sub-screen **tujuan** (Drafts / Queue / History-sementara-Calendar) — bukan kembali ke sub-screen asal seperti tombol Close (KSP-05-F10) (ADR-054) | Sidebar kini punya CTA New Post yang bisa dibuka dari section manapun (ADR-053) — pengguna perlu langsung melihat hasil aksinya di section Publish yang relevan, bukan tertinggal di section asal yang sudah tidak berkaitan dengan konten yang baru dibuat | UXP-04 |
| KSP-D16 | Layar persetujuan OAuth dua langkah (pilih workspace, lalu scope), bukan satu layar (KSP-09, ADR-139) | Hasil spike T-148: workspace harus ditetapkan sebelum consent; dua langkah mengikuti dua halaman backend dan membuat pilihan workspace terlihat di langkah scope | UXP-04 |
| KSP-D17 | ~~Scope yang tidak diizinkan role tampil nonaktif beserta alasan, bukan disembunyikan (KSP-09-F05)~~ — **Tidak berlaku di MVP**: tidak ada batas role pada scope MCP; semua role boleh `read`/`draft`/`schedule` | ~~Pengguna perlu tahu mengapa `schedule` tidak bisa dipilih; penolakan server tetap berlaku sebagai lapisan kedua~~ | UXP-04 |
| KSP-D18 | Nama dan host klien selalu ditampilkan di layar persetujuan, dengan catatan nama diberikan klien sendiri (KSP-09-F03) | Semua klien mendaftar sendiri tanpa verifikasi (dynamic client registration); pengguna harus bisa menilai asal klien | UXP-04 |
| KSP-D19 | Klien AI dikelola di Settings → Account, hanya koneksi milik sendiri, dan pencabutan lewat dialog Tier 2 (KSP-10) | Grant bersifat personal; pencabutan memutus akses seketika sehingga perlu konfirmasi (ADR-049) | UXP-03, UXP-04 |
| KSP-D20 | Badge dan filter sumber MCP di History, Drafts, Queue; filter bawaan Semua; Calendar tidak diberi badge | Memberi jejak hasil kerja AI tanpa mengubah tampilan default yang sudah disetujui (ADR-052 scope discipline) | UXP-04, UXP-05, UXP-06 |
| KSP-D21 | Pemilihan akun ada di baris channel di atas editor (popover, chip, Terakhir dipakai, Semua), bukan daftar akun di zona kanan (ADR-155) | Memilih tujuan sebelum menulis membuat Pratinjau dan aturan format langsung relevan, mengikuti pola Create Post Buffer yang dipilih King Rezi | UXP-01, UXP-04 |
| KSP-D22 | Pratinjau live per platform dan validasi inline di dekat sumbernya (blok jaringan, atas editor, footer) menggantikan Alert tersebar (ADR-155) | Pengguna melihat hasil dan masalah di titik keputusan, bukan setelah menekan Schedule; selaras KSP-D04 | UXP-04 |
| KSP-D23 | Jadwal lewat popover "Atur jadwal" di footer tanpa "Next Available"; "Create Another" tidak ikut Tahap 1 (bentrok dengan redirect KSP-D15) (ADR-155) | Postific belum punya konsep slot antrean; Create Another akan membuat modal tetap terbuka dan melawan ADR-054 | UXP-01, UXP-04 |

---

# Ringkasan Pola per Layar

| Layar | Pola Utama | State Kritis |
| ----- | ---------- | ------------ |
| KSP-01 Home | 4 zona informatif + deep link | Failed post di Recent Activity |
| KSP-02 Calendar | Grid per hari × waktu + klik → Editor | Item Failed, Disconnected warning |
| KSP-03 Queue | Daftar linear berurutan (grouped by tanggal) + 1 card per item + filter | Queue kosong, filter tidak ada hasil (Item Failed pindah ke History) |
| KSP-04 Drafts | Daftar draft + CTA New Post | Drafts kosong |
| KSP-05 Draft Editor | Dua zona (Baris Channel + Editor + Blok per Jaringan / Pratinjau) + footer aksi + Confirmation Summary | Akun Disconnected, Status Failed |
| KSP-06 Inbox | Dua panel per posting (By post / List) + filter utama + panel Filter & Sort + sync status + Manual Refresh | Badge setelah sync, refresh gagal, Inbox kosong, filter tanpa hasil |
| KSP-07 Dashboard | Summary Row + Account Overview + Post Performance | Empty state (belum ada data) |
| KSP-08 Connected Accounts | Daftar akun + status + aksi kontekstual | Disconnected → Reconnect |
| KSP-09 Persetujuan OAuth | Dua langkah (workspace, scope) di luar app shell | Tanpa workspace, klien tanpa nama, error, menyimpan |
| KSP-10 Klien AI | Daftar grant milik sendiri + Cabut (Tier 2) | Tidak ada koneksi (langkah + URL MCP) |

---

# Traceability ke UX Principles

| Prinsip | Layar yang Menerapkan |
| ------- | --------------------- |
| UXP-01 — Satu Siklus | KSP-02, KSP-03, KSP-04, KSP-05, KSP-06 |
| UXP-02 — Dua Mode Kerja | KSP-01, KSP-02, KSP-07 |
| UXP-03 — Simplisitas Quality Bar | KSP-01, KSP-03, KSP-04, KSP-05, KSP-06, KSP-07, KSP-08 |
| UXP-04 — Publishing Trust | KSP-02, KSP-03, KSP-05, KSP-08, KSP-09, KSP-10 |
| UXP-05 — AI Menempel pada Pekerjaan | KSP-03, KSP-04, KSP-09, KSP-10 |
| UXP-06 — Status Jelas, Proses Ringan | KSP-02, KSP-03, KSP-04, KSP-05, KSP-06, KSP-08 |
| UXP-07 — Nilai Bertambah Seiring Siklus | KSP-01, KSP-07 |

---

# Expected Output

Setelah dokumen ini selesai, project harus memiliki:

* Pola fungsi kritis untuk 8 layar utama produk.
* Fungsi wajib per layar yang terdokumentasi dengan ID.
* Zona fungsional per layar yang dapat dijadikan acuan arsitektur dan development.
* State handling yang terdokumentasi untuk kondisi kritis.
* Decision log yang dapat ditelusuri ke UX Principles.
* Input yang siap untuk Architecture Discovery (M5).

---

# Exit Criteria

Key Screen Patterns dianggap selesai apabila:

* Seluruh layar kritis (8 layar) telah terdokumentasi.
* Setiap layar memiliki Critical Functions yang teridentifikasi dengan ID.
* Setiap layar memiliki zona fungsional yang terdefinisi.
* State kritis (empty, error, disconnected) terdokumentasi untuk setiap layar.
* Setiap keputusan desain dapat ditelusuri ke UX Principles.
* Tidak ada keputusan yang bertentangan dengan Product Baseline v1.0 atau Navigation Patterns.

---

# Related Documents

* `README.md`
* `ux-principles.md`
* `information-architecture.md`
* `user-flows.md`
* `navigation-patterns.md`
* `../02-product/feature-modules.md`
* `../02-product/mvp-definition.md`
* `../02-product/feature-priority.md`
* `../03-user/user-personas.md`
* `../03-user/user-journey.md`
* `../03-user/insights.md`
* `../../project-os/PROJECT_STATE.md`
* `../../project-os/DECISIONS.md`
