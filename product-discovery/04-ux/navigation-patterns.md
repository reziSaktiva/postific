# Navigation Patterns

Dokumen ini mendefinisikan **model navigasi dan pola perpindahan layar** pada produk **Postific**.

Navigation Patterns dibangun di atas Information Architecture yang sudah ditetapkan. Dokumen ini tidak mendefinisikan layout visual atau komponen UI — melainkan menjelaskan logika bagaimana pengguna bergerak antar bagian, bagaimana konteks dipertahankan, dan kapan perpindahan layar terjadi.

---

# Overview

Navigation Patterns mendefinisikan tiga hal utama:

1. **Model navigasi** — pola struktural yang digunakan (sidebar persisten, sub-nav, dll.).
2. **Pola perpindahan layar** — bagaimana transisi terjadi antara satu layar ke layar lain.
3. **Pola navigasi kontekstual** — navigasi yang muncul dalam respons terhadap aksi pengguna.

Dokumen ini menjadi acuan untuk Key Screen Patterns dan Architecture Discovery.

---

# Prinsip Navigation Patterns

Navigation Patterns di produk ini dibangun berdasarkan tiga prinsip IA yang sudah ditetapkan.

## NP-P01 — Navigasi Selalu Dapat Diakses

**Turunan dari:** UXP-01, P-IA-01

Primary navigation selalu terlihat dan dapat diakses dari posisi manapun dalam aplikasi. Pengguna tidak pernah "terjebak" dalam sebuah layar tanpa jalur kembali ke bagian lain.

---

## NP-P02 — Perpindahan Konteks Harus Eksplisit

**Turunan dari:** UXP-04, UXP-03

Ketika pengguna akan berpindah dari satu section ke section lain (misalnya dari Draft Editor ke Settings), perpindahan tersebut harus terasa sebagai keputusan sadar — bukan sebagai konsekuensi tidak terduga dari aksi lain.

Konteks pekerjaan yang sedang dikerjakan tidak boleh hilang secara tiba-tiba karena navigasi yang tidak disengaja.

---

## NP-P03 — Kedalaman Dua Level, Tidak Lebih

**Turunan dari:** P-IA-03, UXP-03

Navigasi maksimal dua level: **primary section → sub-screen**. Tidak ada nested navigation yang memaksa pengguna menggali lebih dari dua level untuk mencapai fitur inti.

---

# Model Navigasi Utama

Produk menggunakan model **Persistent Sidebar Navigation** untuk web.

```
┌─────────────────────────────────────────────────────┐
│  [Sidebar]          │  [Main Content Area]           │
│  [+ New Post]       │                                │
│  • Home             │  Konten layar aktif            │
│  • Publish          │  berubah sesuai                │
│  • Engage  [badge]  │  navigasi yang dipilih         │
│  • Analyze          │                                │
│  • Start Page       │                                │
├─────────────────────┤                                │
│  Channels           │                                │
│  (quick-glance)      │                                │
├─────────────────────┤                                │
│  Notifications      │                                │
│  User Avatar        │                                │
└─────────────────────────────────────────────────────┘
```

**Karakteristik model ini:**

- Sidebar selalu terlihat — pengguna tidak perlu kembali ke halaman awal untuk berpindah section.
- Main Content Area menampilkan konten layar aktif — berganti sesuai item yang dipilih di sidebar.
- Tidak ada full-page reload saat berpindah section (navigasi client-side).
- Sidebar tidak menyembunyikan dirinya sendiri secara otomatis; pengguna yang mengontrol apakah sidebar di-collapse atau tidak (Should Have untuk pengalaman yang lebih lebar).

---

# Primary Navigation Pattern

## Struktur Sidebar

Primary navigation terdiri dari empat zona vertikal:

```
┌──────────────────────┐
│  [+ New Post]        │  ← CTA, pinned di puncak sidebar
├──────────────────────┤
│  Home                │
│  Publish             │  ← navigation items
│  Engage   [badge]    │
│  Analyze             │
│  Start Page          │
├──────────────────────┤
│  📷 @kopiselasar  8  │  ← Channels, quick-glance
│  📘 Kopi Selasar  3  │     (scrollable independen)
│  🐦 @kopiselasar  0  │
├──────────────────────┤
│  Notifications       │  ← utilitas
│  User Avatar         │  ← selalu di bawah
└──────────────────────┘
```

**Zona CTA:** Tombol "+ New Post" (primary, full-width) — pinned di puncak sidebar, di atas navigation items. Tersedia dari section manapun (Home, Publish, Engage, Analyze, Settings), bukan hanya saat pengguna sedang berada di Publish (NP-D12). Melengkapi, bukan menggantikan, CTA New Post yang sudah ada langsung di layar Calendar/Queue/Drafts (NP-D09) — keduanya membuka Draft Editor yang sama.

**Zona tengah:** 5 navigation items — Home, Publish, Engage, Analyze, Start Page. Urutan mencerminkan alur nilai produk (UXP-07): Publishing reliability → Engagement triage → Analytics snapshot.

**Zona Channels:** Daftar akun media sosial terhubung (quick-glance), di bawah navigation items dan di atas zona utilitas (NP-D14). Lihat bagian "Channels (Sidebar)" di bawah untuk detail lengkap.

**Zona bawah:** Notifications icon dan User Avatar — akses ke secondary navigation. Selalu tersedia tanpa scrolling — Channels di atasnya scroll independen supaya zona ini tidak pernah terdorong keluar layar walau akun terhubung banyak.

---

## Active State dan Visual Feedback

- Item navigasi aktif ditandai secara visual (highlight / indicator) — pengguna selalu tahu posisi mereka.
- **Engage** memiliki notification badge yang menampilkan jumlah interaksi unread — terlihat dari section manapun (mendukung UF-04 Alternate Path).
- Tidak ada loading state yang memblokir sidebar — sidebar tetap interaktif saat konten dimuat.

---

## Channels (Sidebar)

Daftar akun media sosial yang terhubung, ditampilkan sebagai quick-glance list — bukan pengganti `Settings → Organization → Connected Accounts` (KSP-08), yang tetap satu-satunya tempat Connect/Disconnect/Reconnect (IA-D05 tidak berubah).

```
Default (tidak di-hover):
  (●IG) @kopiselasar          8     ← avatar bulat + badge logo brand overlay; 8 = scheduled posts count
                             Active

Hover:
  ⠿  (●IG) @kopiselasar   [+]       ← drag handle muncul di kiri (di luar avatar); seluruh isi baris bergeser ke kanan
                             Active
```

**Isi tiap baris:** avatar bulat (placeholder inisial, treatment sama seperti `.ws-avatar`) dengan badge kecil logo brand platform (`react-icons` fa6, warna brand tidak berubah) di-overlay di pojok kanan-bawah avatar (konvensi story-ring badge) — bukan lagi logo platform polos (flat square icon) — + nama akun/handle (`@kopiselasar` atau nama halaman seperti `Kopi Selasar`, mengikuti konvensi KSP-08) + status badge (Active/Disconnected — Badge yang sama dengan KSP-08, tidak ada warna status baru).

**State default:** badge angka menampilkan jumlah post **scheduled** (belum tayang) untuk akun tersebut.

**State hover:** badge count digantikan tombol quick-compose "+" (membuka Draft Editor/KSP-05 kosong dengan akun ini otomatis ter-pre-select di Account Selector); drag handle muncul di paling kiri baris (di luar avatar) untuk reorder. Reorder ini **personal per user** — urutan tampilan bisa berbeda antar anggota tim, bukan urutan shared workspace.

**Shift-on-hover untuk drag handle (revisi ADR-058, addendum):** drag handle muncul di luar ruang avatar, sehingga saat hover **seluruh isi baris (avatar+badge+nama) ikut bergeser ke kanan** (`margin-left` animasi) untuk memberi ruang — ini menggantikan keputusan awal "no-shift" (ruang dicadangkan permanen). Perubahan atas permintaan eksplisit King Rezi setelah melihat referensi screenshot aplikasi lain.

**Swap count ↔ tombol "+" tetap no-shift:** berbeda dari drag handle di atas, slot count/tombol "+" di sisi kanan baris tetap **fixed-slot** — tidak pernah menggeser konten, hanya isinya yang berganti (count → "+") saat hover. Ini tidak berubah dari keputusan awal.

**Klik channel berstatus Disconnected/Expired:** deep-link ke `Settings → Organization → Connected Accounts` — memperluas pola "Status Indicator → Settings" (lihat Contextual Navigation Pattern di bawah), bukan pola baru.

**Scroll independen:** list ini scroll sendiri (tidak ikut men-scroll seluruh sidebar) supaya zona bawah (Notifications/User Avatar) tetap selalu terlihat walau akun terhubung banyak.

Lihat NP-D14 di Decision Log untuk keputusan lengkap (ADR-058, termasuk addendum shift-on-hover).

---

# Secondary Navigation Pattern

Secondary navigation diakses melalui elemen di zona bawah sidebar — tidak menggunakan slot primary nav.

## Notifications

```
Notifications icon → Notifications Panel (overlay / drawer)
├── Daftar notifikasi in-app berurutan waktu
├── Mark as read
└── Link ke item terkait (post, akun, dll.)
```

Notifications Panel muncul sebagai overlay atau drawer — tidak menggantikan Main Content Area. Pengguna dapat menutupnya dan kembali ke pekerjaan yang sedang dikerjakan.

---

## Settings

```
User Avatar → User Menu (dropdown)
├── Settings → Organization  (General, Connected Accounts, Members, Roles & Permissions, Billing)
├── Settings → Account       (Profile, Notifications, Preferences)
└── Logout
```

User Menu muncul sebagai dropdown kecil — satu-satunya titik masuk ke halaman Settings (grup Organization dan Account), dilakukan dari sini. Ini bukan layar kerja harian sehingga tidak memerlukan slot di primary nav.

**Layout setelah masuk (pola Buffer, ADR-077):** begitu masuk Settings, sidebar persistent (workspace switcher, nav items, Channels) **digantikan total** oleh satu sidebar khusus Settings di slot yang sama — bukan tampil berdampingan sebagai secondary nav. Sidebar khusus ini punya header back-navigation ("← Settings") di atas dua grup Organization/Account, menaut balik ke Home. Taksonomi grup tidak berubah.

**Logout wajib melalui dialog konfirmasi (Tier 2)** — lihat kebijakan Safety Check / Double Confirmation di `key-screen-patterns.md` (ADR-049).

---

# In-Section Navigation Pattern

Beberapa section memiliki sub-navigasi di dalam Main Content Area untuk memindahkan pengguna antar sub-screen.

## Publish — Tab Navigation

Publish adalah section terbesar dengan empat sub-screen:

```
Publish
├── [Calendar]  [Queue]  [Drafts]  [History]  ← tab bar di atas main content
│
└── Main Content Area menampilkan konten sub-screen aktif
```

**Pola:** Horizontal tab bar tepat di bawah header section. Tab yang aktif terlihat jelas. Pergantian tab tidak me-reset state (filter, scroll position) antar tab kecuali diperlukan.

**Default tab:** Calendar — sesuai IA-D04. Raka masuk ke Publish dan langsung melihat overview jadwal minggu berjalan.

---

## Engage — Single Screen

Engage hanya memiliki satu layar: Inbox. Tidak ada tab navigation di dalam Engage.

```
Engage
└── Inbox  ← langsung tampil tanpa sub-navigasi tambahan
```

---

## Analyze — Single Screen

Analyze hanya memiliki satu layar: Dashboard. Tidak ada tab navigation; navigasi internal menggunakan filter inline (per akun, per periode).

```
Analyze
└── Dashboard  ← langsung tampil; filter diakses inline di dalam dashboard
```

---

## Start Page — Single Screen

Start Page tidak memiliki sub-navigasi; Page Editor, Preview, dan Share adalah elemen dalam satu layar yang sama.

---

# Contextual Navigation Pattern

Contextual navigation terjadi ketika pengguna mengklik elemen dalam layar yang membawa mereka ke layar lain dengan konteks yang dibawa.

## Pola: Item → Editor

Terjadi di Publish. Klik satu item membuka Draft Editor untuk item tersebut.

```
Publish → Calendar  → [klik item]  → Popover (ringkasan) → [CTA Edit] → Draft Editor (item X)
Publish → Queue     → [klik item]  → Draft Editor (item X)
Publish → Drafts    → [klik item]  → Draft Editor (item X)
Publish → Drafts    → [New Post]   → Draft Editor (item baru)
```

**Khusus Calendar (ADR-090):** klik item tidak langsung membuka Draft
Editor — membuka `Popover` (ringkasan post + metrik untuk yang
sudah Published) dulu; Draft Editor dibuka lewat CTA di dalam Popover.
Queue dan Drafts **tidak berubah** — tetap klik → langsung Draft Editor.

**Transisi:** Draft Editor ditampilkan sebagai **modal overlay** di atas Publish — bukan lagi panel/layar penuh terpisah dalam section Publish (ADR-052, mengoverride NP-D02 versi awal). Tampilan default modal adalah variant **Standard** (floating card + backdrop redup di atas Calendar/Queue/Drafts, ADR-065); pengguna bisa beralih ke variant **Fullscreen** (menutupi sepenuhnya termasuk sidebar) lewat toggle resmi di header modal — lihat NP-D11.

**Kembali:** Tombol "Close" di header modal menutup modal dan mengembalikan tampilan ke sub-screen asal (Calendar / Queue / Drafts) tanpa navigasi URL — bukan lagi "Back" ke route terpisah, karena Draft Editor tidak lagi punya route sendiri.

---

## Pola: New Post CTA dari Calendar dan Queue

Terjadi ketika pengguna sedang melihat Calendar atau Queue dan ingin langsung membuat konten baru tanpa berpindah ke tab Drafts terlebih dahulu.

```
Publish → Calendar  → [New Post]  → Draft Editor (item baru)
Publish → Queue     → [New Post]  → Draft Editor (item baru)
```

**Trigger:** CTA "New Post" tersedia langsung di layar Calendar dan Queue — bukan hanya di Drafts.

**Konteks penggunaan:**
- Raka melihat Calendar dan menemukan gap jadwal di hari tertentu → klik New Post langsung dari Calendar untuk mengisi gap tersebut.
- Raka memindai Queue dan ingin menambah konten ke antrean tanpa berganti tab.

**Transisi:** Identik dengan New Post dari Drafts — Draft Editor (modal overlay, default variant Standard, ADR-065) kosong terbuka di atas sub-screen manapun yang sedang aktif. Sub-screen asal (Calendar, Queue, atau Drafts) tetap sama begitu modal ditutup — tidak ada navigasi URL yang perlu di-track.

**Kembali:** Tombol "Close" di header modal menutup Draft Editor; tampilan kembali ke Calendar atau Queue (sesuai sub-screen asal) tanpa perpindahan route.

---

## Pola: Quick Compose dari Channels Sidebar

Terjadi ketika pengguna meng-hover satu channel di daftar "Channels" sidebar (NP-D14) dan ingin langsung membuat konten untuk akun tersebut tanpa membuka Account Selector secara manual.

```
[Section manapun] → Sidebar → Channels → hover channel → [+]  → Draft Editor (item baru, akun ini pre-selected)
```

**Trigger:** Tombol "+" muncul saat channel di-hover (menggantikan badge count), tersedia dari section manapun karena Channels selalu terlihat di sidebar.

**Perbedaan dengan CTA "+ New Post" (NP-D09/NP-D12):** CTA sidebar/Calendar/Queue membuka Draft Editor kosong tanpa akun terpilih — Quick Compose dari Channels membuka Draft Editor dengan **Account Selector sudah otomatis memilih channel yang di-klik**, mempercepat alur "saya mau posting ke Instagram sekarang" tanpa langkah pilih akun manual.

**Transisi:** Draft Editor (modal overlay, default variant Standard — ADR-052/ADR-065) terbuka di atas sub-screen manapun yang sedang aktif — sama seperti New Post dari sidebar (NP-D12).

**Kembali:** Tombol "Close" mengembalikan tampilan ke section/sub-screen asal tanpa navigasi URL.

---

## Pola: Redirect setelah Aksi Terminal Draft Editor

Terjadi ketika pengguna menyelesaikan salah satu dari tiga aksi terminal di Draft Editor (Save as Draft, Schedule, Publish Now). Sidebar CTA "+ New Post" (NP-D12) membuat Draft Editor kini bisa dibuka dari section manapun — Home, Engage, Analyze, Settings — bukan hanya dari dalam Publish. Ketiga aksi ini **tidak** mengikuti pola "Kembali ke sub-screen asal" milik tombol Close (KSP-05-F10) — masing-masing mengarahkan pengguna ke sub-screen **tujuan**, tempat konten yang baru saja diproses sekarang berada:

```
[Section manapun] → Draft Editor → [Save as Draft]  → Publish → Drafts
[Section manapun] → Draft Editor → [Schedule]        → Publish → Queue
[Section manapun] → Draft Editor → [Publish Now]     → Publish → History
                                                          (sementara: Calendar,
                                                           sampai History dibangun — KSP-D10)
```

**Alasan:** Pengguna harus langsung melihat hasil aksinya di tempat yang relevan — bukan tertinggal di section asal (misalnya Home atau Analyze) yang sudah tidak berkaitan dengan konten yang baru dibuat. Ini melengkapi UXP-04 (Publishing Trust): kepercayaan datang dari melihat langsung bahwa aksi berhasil dan tahu ke mana harus mengecek statusnya.

**Hubungan dengan NP-D05:** NP-D05 ("tidak ada redirect otomatis setelah cross-section navigation") berlaku untuk kasus tautan status error → Settings, bukan untuk aksi terminal form yang menghasilkan/mengubah konten. Pola ini didefinisikan terpisah (NP-D13) dan tidak mengubah NP-D05.

---

## Pola: Thread Expansion

Terjadi di Engage. Klik satu thread komentar membuka detail thread di dalam Inbox — tidak membuka layar baru.

```
Engage → Inbox → [klik thread]  → Thread detail muncul di panel kanan / inline
                                   (sidebar tetap terlihat, Inbox tetap terlihat di kiri)
```

**Alasan:** Volume triage komentar dapat tinggi — pengguna perlu berpindah cepat antar thread tanpa full-page navigation setiap kali.

---

## Pola: Status Indicator → Settings

Terjadi ketika pengguna menemukan status masalah di layar kerja dan perlu ke Settings untuk memperbaikinya.

```
Calendar / Queue / Account Selector / Sidebar Channels → status "Disconnected" atau "Failed"
    → [klik indikator / pesan error / channel row]
    → Settings → Organization → Connected Accounts
```

**Transisi:** Navigasi langsung ke Settings — bukan sidebar manual. Pesan error menyertakan tautan aksi ("Reconnect") yang langsung membawa pengguna ke halaman yang tepat.

**Kembali:** Setelah reconnect selesai, pengguna dapat kembali ke Calendar/Queue secara manual melalui sidebar — tidak ada redirect otomatis karena state Calendar mungkin sudah berubah.

---

## Pola: Empty State → Onboarding Action

Terjadi di layar yang belum memiliki data.

```
Analyze → Dashboard (kosong)
    → "Connect Account" → Settings → Organization → Connected Accounts (UF-05)
    → "Create First Post" → Publish → Drafts → New Post (UF-01)

Engage → Inbox (kosong)
    → "Start publishing to see engagement" → Publish → Drafts

Publish → History (kosong)
    → "You haven't published anything yet" → Publish → Drafts → New Post
```

**Pola yang konsisten:** Setiap empty state menyertakan satu atau dua tautan aksi — tidak ada dead end. Pengguna selalu tahu langkah berikutnya (UXD-03).

---

# Notification Badge Pattern

Notification badge pada item Engage di sidebar menginformasikan pengguna bahwa periodic pull 30 menit atau manual refresh menemukan komentar unread — tanpa mengganggu alur pekerjaan yang sedang berjalan.

```
Badge behavior:
├── Muncul: setelah sinkronisasi menemukan komentar unread baru di Inbox
├── Angka: menampilkan jumlah unread (cap di angka 99+)
├── Hilang: ketika semua item di Inbox ditandai Done atau dibuka
└── Tetap terlihat dari section manapun (sidebar persisten)
```

Badge bukan indikator webhook atau real-time. Inbox menyediakan waktu sinkronisasi terakhir dan tombol Manual Refresh agar pengguna dapat meminta data terbaru tanpa menunggu siklus berikutnya (ADR-040).

**Prinsip:** Badge hanya ada pada Engage — sesuai dengan fokus produk pada siklus kerja. Tidak ada badge pada Analytics atau Publish karena kedua section tersebut bukan "inbox" yang menuntut respons segera.

---

# Cross-Section Navigation Pattern

Beberapa user flow melibatkan perpindahan antar section yang dipicu oleh tautan atau aksi — bukan navigasi sidebar manual.

## Deep Link ke Sub-Screen

Beberapa aksi membawa pengguna langsung ke sub-screen tertentu, melewati default tab.

```
Home → Analytics Snapshot → [klik]  → Analyze → Dashboard
Home → Today's Schedule   → [klik item]  → Publish → Calendar → Draft Editor (item)
Empty State Analytics     → [Create First Post]  → Publish → Drafts → Draft Editor (baru)
```

**Prinsip:** Deep link hanya digunakan untuk aksi yang bermakna — bukan sebagai navigasi pengganti sidebar. Pengguna harus masih bisa mencapai tujuan yang sama melalui sidebar secara manual.

---

## Navigasi Balik Setelah Cross-Section

Ketika pengguna tiba di section baru melalui cross-section navigation (misalnya dari Calendar error → Settings), tidak ada tombol "back" otomatis yang mengembalikan ke posisi sebelumnya.

**Alasan:** Terlalu kompleks untuk ditangani di level navigasi tanpa history stack yang jelas. Pengguna menggunakan sidebar untuk navigasi kembali.

**Pengecualian:** Draft Editor (modal overlay, ADR-052/ADR-065) selalu memiliki tombol Close yang mengembalikan tampilan ke sub-screen asal di dalam section Publish — karena modal dibuka di atas sub-screen yang sama, bukan drill-down lintas route. **Settings** juga jadi pengecualian sejak ADR-077: karena sidebar persistent digantikan total oleh sidebar khusus Settings (bukan drill-down biasa di dalam Main Content Area), sidebar itu sendiri punya tombol back permanen ("← Settings") menuju Home — bukan history-based back ke posisi sebelumnya, cuma satu tujuan tetap.

---

# Decision Log

Keputusan navigasi yang dibuat dalam dokumen ini.

| ID | Keputusan | Alasan | Prinsip |
| -- | --------- | ------ | ------- |
| NP-D01 | Model navigasi: Persistent Sidebar | Web app; sidebar memberikan akses cepat antar section tanpa kehilangan konteks | UXP-01, NP-P01 |
| NP-D02 | ~~Draft Editor ditampilkan sebagai panel/layar penuh dalam Publish, bukan modal overlay~~ — **Dioverride oleh NP-D11 (ADR-052)** | Alasan asli: modal menutupi Calendar/Queue, pengguna kehilangan konteks jadwal saat mengedit. Trade-off ini kemudian disadari & diterima demi kecepatan alur kerja — lihat NP-D11 | NP-P02, UXP-04 |
| NP-D03 | Thread Inbox: inline expansion, bukan layar baru | Volume triage tinggi; pengguna perlu berpindah thread dengan cepat tanpa full-page nav | UXP-03, NP-P03 |
| NP-D04 | Notification badge hanya pada Engage | Hanya Engage yang memerlukan respons segera; badge di semua section menambah noise | UXP-03, UXP-07 |
| NP-D05 | Tidak ada redirect otomatis setelah cross-section navigation | State layar asal mungkin sudah berubah; redirect otomatis menciptakan kebingungan | NP-P02 |
| NP-D06 | Publish default ke tab Calendar | Calendar memberi overview jadwal terbaik untuk Raka dan Maya (IA-D04) | UXP-02, P-IA-02 |
| NP-D07 | User Avatar (user menu) sebagai satu-satunya entry point ke Settings (grup Organization + Account). Sejak ADR-077, begitu masuk, sidebar persistent digantikan total oleh sidebar khusus Settings (pola Buffer) dengan header back-navigation — bukan tampil berdampingan sebagai secondary nav | Settings bukan akses harian; tidak perlu slot di primary nav (IA-D05); satu titik masuk lebih sederhana daripada dua entry point terpisah; sidebar tunggal dengan back button lebih ringkas dibanding dua sidebar berdampingan (ADR-077) | UXP-03 |
| NP-D08 | Notifications Panel sebagai overlay, bukan pengganti Main Content Area | Pengguna harus bisa menutup panel dan kembali ke pekerjaan tanpa kehilangan state | NP-P02 |
| NP-D09 | New Post CTA tersedia langsung dari Calendar dan Queue, bukan hanya dari Drafts. Sejak NP-D12, CTA yang sama juga tersedia di Sidebar — keduanya melengkapi, bukan saling menggantikan | Raka sering menemukan gap jadwal saat melihat Calendar atau Queue — memaksanya berpindah ke tab Drafts dulu menambah friction yang tidak perlu. CTA langsung di titik penemuan kebutuhan selaras dengan alur siklus kerja (UXP-01) | UXP-01, UXP-03 |
| NP-D10 | Logout wajib melalui dialog konfirmasi (Tier 2) | Melindungi dari interupsi pekerjaan yang belum tersimpan, walau aksi Logout sendiri reversibel — bagian dari kebijakan Safety Check/Double Confirmation lintas produk (ADR-049, `key-screen-patterns.md`) | UXP-04 |
| NP-D11 | Draft Editor (New Post & Edit Draft) jadi **modal overlay**, mengoverride NP-D02. Dua variant tampilan resmi — **Standard** (default, ADR-065: floating card + backdrop redup, konteks Calendar/Queue tetap terlihat) dan **Fullscreen** (menutupi seluruh viewport termasuk sidebar) — dipilih lewat toggle resmi di header modal, tidak dipersist antar sesi | Ingin New Post/Edit Draft terasa lebih cepat/ringan tanpa pindah halaman, konsisten pola tools lain — trade-off kehilangan konteks visual Calendar/Queue (alasan asli NP-D02) diterima sadar demi kecepatan alur kerja saat variant Fullscreen dipilih; default Standard (ADR-065) menjaga konteks tetap terlihat tanpa memaksa trade-off itu di awal. Route lama dihapus total (modal-only, tanpa deep-link URL). Resume unsaved state (localStorage) hanya untuk New Post, tidak untuk Edit Draft (ADR-052) | NP-P02, UXP-04 |
| NP-D12 | Sidebar mendapat CTA "+ New Post" pinned di puncak sidebar (di atas nav items), tersedia dari section manapun | Sebelumnya CTA New Post hanya ada di layar Calendar/Queue/Drafts (NP-D09) — pengguna di Home/Engage/Analyze harus pindah section dulu ke Publish untuk membuat post baru. Pola umum di tools sejenis (CTA utama di puncak sidebar) menghilangkan langkah ekstra ini (ADR-053) | UXP-01, NP-P01 |
| NP-D13 | Setelah aksi terminal Draft Editor (Save as Draft / Schedule / Publish Now), pengguna diarahkan ke sub-screen **tujuan** (Drafts / Queue / History-sementara-Calendar) — bukan kembali ke sub-screen asal seperti tombol Close | Sidebar CTA (NP-D12) membuat Draft Editor bisa dibuka dari section manapun; pengguna perlu langsung melihat hasil aksinya di section Publish yang relevan, bukan tertinggal di section asal yang sudah tidak berkaitan dengan konten yang baru diproses (ADR-054). Tidak mengubah NP-D05 (kasus berbeda: link status error → Settings) | UXP-04 |
| NP-D14 | Sidebar mendapat section "Channels" — quick-glance daftar akun terhubung (avatar bulat + badge logo brand overlay + nama akun + status), antara navigation items dan zona bawah, scroll independen. Default: scheduled-posts count. Hover: drag handle muncul di kiri baris (reorder personal per user, **shift-on-hover** — seluruh isi baris ikut bergeser, addendum ADR-058 mengoverride keputusan awal "no-shift") + tombol quick-compose "+" (buka Draft Editor, akun pre-selected — **tetap no-shift/fixed-slot**, tidak berubah). Klik channel bermasalah → Settings (perluasan pola existing) | King Rezi ingin visibilitas status channel + jalan pintas compose per akun tanpa keluar dari layar kerja; posisi di luar 5 nav item menjaga sidebar tetap berbasis alur kerja, bukan daftar entitas (P-IA-01); shift-on-hover drag handle dipilih ulang mengikuti referensi screenshot aplikasi lain atas permintaan eksplisit King Rezi (ADR-058) | UXP-01, UXP-04, NP-P01 |
| NP-D15 | Klik item di Calendar membuka `Popover` (ringkasan post + metrik untuk yang sudah Published) dulu, bukan langsung Draft Editor — CTA di dalam Popover yang membuka Draft Editor. Khusus Calendar; Queue dan Drafts tidak berubah | King Rezi ingin pola Buffer: verifikasi cepat isi/metrik post tanpa membuka editor penuh setiap klik. Dibatasi ke Calendar saja mengikuti scope permintaan, tidak diperluas ke Queue/Drafts sebagai efek samping (ADR-090, komponen dikoreksi ADR-091) | UXP-01, UXP-04 |

---

# Ringkasan Pola

| Konteks | Pola | Transisi |
| ------- | ---- | -------- |
| Berpindah section (Home, Publish, dll.) | Klik sidebar item | Ganti konten Main Content Area |
| Berpindah sub-screen dalam Publish | Klik tab (Calendar / Queue / Drafts / History) | Ganti konten dalam section Publish |
| Buka item dari Calendar / Queue / Drafts | Klik item | Buka Draft Editor sebagai modal overlay, default variant Standard (ADR-052/NP-D11/ADR-065) |
| Buat post baru dari Calendar atau Queue | Klik CTA "New Post" | Buka Draft Editor (modal) kosong; Close menutup modal kembali ke sub-screen asal tanpa navigasi URL |
| Buat post baru dari section manapun | Klik CTA "+ New Post" di Sidebar | Buka Draft Editor (modal) kosong, sama seperti CTA di Calendar/Queue/Drafts (NP-D12) |
| Selesaikan aksi terminal di Draft Editor | Klik Save as Draft / Schedule / Publish Now | Modal tertutup, redirect ke Publish → Drafts / Queue / History-sementara-Calendar (NP-D13) |
| Buka thread dari Inbox | Klik thread | Expand inline panel kanan dalam Inbox |
| Akses Settings | Klik User Avatar → dropdown | Navigasi ke Settings (Organization / Account); sidebar persistent digantikan sidebar khusus Settings + tombol back (ADR-077) |
| Buka Notifications | Klik Notifications icon | Buka Notifications Panel (overlay) |
| Error status → Settings | Klik indikator error / tautan aksi | Navigasi ke Settings → Organization → Connected Accounts |
| Channel bermasalah di sidebar Channels → klik | Klik channel row (Disconnected/Expired) | Navigasi ke Settings → Organization → Connected Accounts |
| Channel di sidebar Channels → hover lalu klik "+" | Klik tombol quick-compose | Buka Draft Editor (modal) kosong, akun ini otomatis ter-pre-select |
| Empty state → aksi pertama | Klik CTA di empty state | Navigasi ke section / sub-screen terkait |

---

# Expected Output

Setelah dokumen ini selesai, project harus memiliki:

* Model navigasi utama yang terdefinisi (Persistent Sidebar Navigation).
* Pola primary, secondary, dan in-section navigation yang konsisten.
* Pola contextual navigation untuk semua drill-down kritis (Item → Editor, Thread, Error → Settings).
* Notification badge behavior yang jelas.
* Cross-section navigation yang terdokumentasi.
* Decision log yang dapat ditelusuri ke UX Principles dan IA Decisions.

---

# Exit Criteria

Navigation Patterns dianggap selesai apabila:

* Model navigasi utama telah terdefinisi dan selaras dengan IA.
* Setiap pola perpindahan layar kritis sudah terdokumentasi.
* Tidak ada navigasi yang memerlukan lebih dari dua level.
* Setiap keputusan navigasi dapat ditelusuri ke UX Principles.
* Tidak ada user flow (UF-01 hingga UF-06) yang membutuhkan pola navigasi yang belum terdokumentasi di sini.

---

# Related Documents

* `README.md`
* `ux-principles.md`
* `information-architecture.md`
* `user-flows.md`
* `key-screen-patterns.md`
* `../02-product/feature-modules.md`
* `../02-product/mvp-definition.md`
* `../03-user/user-personas.md`
* `../03-user/user-journey.md`
* `../03-user/insights.md`
* `../../project-manager/PROJECT_STATE.md`
* `../../project-manager/DECISIONS.md`
