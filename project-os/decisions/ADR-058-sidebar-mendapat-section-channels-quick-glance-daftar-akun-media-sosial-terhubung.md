## Decision ADR-058

### Title

Sidebar mendapat section "Channels" — quick-glance daftar akun media sosial terhubung

### Status

Accepted — Amended by ADR-068 (2026-08-05) dan ADR-148 (2026-10-28)

### Date

2026-07-31

### Decision

King Rezi meminta penambahan daftar akun media sosial terhubung ("Channels")
di sidebar, supaya status koneksi dan aksi cepat per akun terlihat tanpa
harus masuk ke Workspace Settings.

1. **Posisi:** section baru "Channels" ditambahkan di sidebar **antara 5
   navigation item (Home/Publish/Engage/Analyze/Start Page) dan zona bawah**
   (Notifications/Theme Toggle/User Avatar) — bukan sejajar sebagai nav item
   ke-6, supaya tidak melanggar P-IA-01 (navigasi berbasis alur kerja, bukan
   daftar fitur/entitas). List ini scrollable independen (max-height) supaya
   zona bawah tetap selalu terlihat tanpa scroll walau akun terhubung banyak
   (karakteristik sidebar yang sudah ada di `navigation-patterns.md`).
2. **Isi tiap baris channel:** logo brand platform (bukan teks nama
   platform) + nama akun/handle (`@kopiselasar` atau nama halaman seperti
   `Kopi Selasar`, mengikuti konvensi KSP-08) + status badge (Active/
   Disconnected, reuse Badge yang sama dengan KSP-08 — tidak ada warna
   status baru).
3. **State default:** menampilkan badge jumlah post **scheduled** (belum
   tayang) untuk akun tersebut.
4. **State hover:** badge count digantikan tombol quick-compose "+" (buka
   Draft Editor/KSP-05 kosong dengan akun ini otomatis ter-pre-select di
   Account Selector — entry point baru untuk KSP-05); drag handle juga
   muncul di kiri icon untuk reorder channel. Reorder ini **personal per
   user** (urutan tampilan sidebar tiap anggota tim bisa berbeda), bukan
   urutan shared workspace.
5. **No-shift hover (revisi eksplisit King Rezi):** baik drag handle maupun
   swap count↔tombol "+" **tidak boleh menggeser** icon/nama akun saat
   di-hover — ruang keduanya dicadangkan permanen di layout (opacity/
   visibility toggle, bukan `display:none`↔`flex`), bukan cuma soal visual
   melainkan syarat interaksi yang wajib dipenuhi.
6. **Sumber ikon:** `react-icons` (fa6 set: `FaInstagram`, `FaFacebook`,
   `FaXTwitter`) — dipilih setelah dikonfirmasi `lucide-react` (opsi awal
   King Rezi) **tidak menyediakan logo brand** media sosial (kebijakan
   Lucide: ikon generik saja, sengaja tanpa logo bermerek dagang). Path SVG
   diverifikasi nyata: `bun add react-icons@5` sementara di direktori
   scratchpad, ekstrak `viewBox`/`path` asli tiap ikon via Node, lalu
   dihapus segera — pola sama seperti swizzle-verifikasi-lalu-hapus yang
   sudah dipakai untuk Astryx (ADR-041/051), bukan dependency baru yang
   menempel permanen di project pada tahap Claude Design ini.
   **[Diamandemen ADR-068, 2026-08-05]** — cakupan `react-icons` diperluas
   jadi sumber icon TUNGGAL untuk seluruh UI (brand maupun generik),
   menggantikan pola campuran (react-icons untuk brand, custom SVG untuk
   generik). Lihat ADR-068 untuk detail dan riwayat konflik terkait.
7. **Bukan pengganti KSP-08:** Connect/Disconnect/Reconnect Account tetap
   eksklusif di `Workspace Settings → Connected Accounts` (IA-D05 tidak
   berubah). Klik channel berstatus Disconnected/Expired di sidebar
   deep-link ke KSP-08 — memperluas pola "Status Indicator → Settings" yang
   sudah ada di `navigation-patterns.md`, bukan pola baru.
8. Sudah diimplementasikan visual di Claude Design (7 layar KSP yang
   memakai sidebar + `components/navigation.html` sebagai swatch
   dokumentasi komponen) — implementasi kode `apps/web` **belum berjalan**.
9. **Addendum (revisi lanjutan, hari sama):** dua perbaikan ditemukan saat
   review King Rezi terhadap hasil pertama:
   - Status badge (Active/Disconnected) sempat melebar penuh (full-width)
     mengikuti default stretch flex-column, secara visual bertabrakan
     dengan area tombol "+" saat hover — diperbaiki dengan `align-self:
flex-start` supaya badge hanya sebesar konten teksnya, sama seperti
     pemakaian Badge di tempat lain (KSP-08, Home, dst).
   - Tombol "+" (quick-compose) diberi wiring nyata di App Prototype
     (`AppPrototype.dc.html`): klik membuka Draft Editor dengan akun
     channel tersebut otomatis ter-checklist di Account Selector (bukan
     cuma visual statis). Sengaja melewati (skip) pengecekan Resume
     Unfinished Post (KSP-05-F13) karena entry point ini berbeda konteks
     (terikat akun tertentu) dari CTA "+ New Post" polos yang dijaga
     dialog tersebut.
   - Ditemukan lagi setelah addendum di atas: hover pada tombol "+" itu
     sendiri (`.icon-btn:hover`) menumpuk overlay hover kedua tepat di atas
     overlay hover `.channel-row:hover`, membuat area tombol terlihat
     "menabrak"/berbenturan secara visual dengan highlight baris. Diperbaiki
     dengan `.channel-add:hover { background-image: none; }` — highlight
     baris saja yang tersisa, satu highlight bersih per baris.
   - Masih terlihat "menabrak" di screenshot review King Rezi berikutnya —
     diperbaiki dengan memperkecil slot count/tombol (`.channel-right`,
     `.channel-count`, `.channel-add`) dari 20×20px ke **16×16px**, lebih
     kecil dari size token IconButton terkecil Astryx sendiri
     (`--size-element-sm`, 28px), atas permintaan eksplisit King Rezi
     ("variant size paling kecil"). Glyph tombol juga diganti dari "＋"
     (fullwidth, dirancang untuk tombol besar "New Post") ke "+" biasa pada
     font-size 10px supaya proporsional di ukuran sekecil ini.

10. **Addendum (sesi terpisah, tanggal sama, 2026-07-31) — restyle avatar,
    override no-shift → shift-on-hover, catatan offset belum final:**
    setelah King Rezi menunjukkan screenshot aplikasi lain sebagai
    referensi, tiga perubahan lanjutan disepakati:
    - **Restyle leading element baris default:** logo platform polos (flat
      square icon, hasil poin 2 di atas) diganti **avatar bulat**
      (placeholder inisial, treatment sama seperti `.ws-avatar`) dengan
      **badge kecil logo brand platform** (`react-icons` fa6 —
      `FaInstagram`/`FaFacebook`/`FaXTwitter`, warna brand tidak berubah)
      di-overlay di pojok kanan-bawah avatar, mengikuti konvensi
      story-ring badge. Badge angka scheduled-posts di sisi kanan baris
      **tidak berubah**.
    - **Override eksplisit poin 5 ("No-shift hover") → "shift-on-hover"
      untuk drag handle:** King Rezi meminta pembalikan sebagian dari
      keputusan poin 5 — drag-handle sekarang muncul di **paling kiri
      baris, di luar ruang avatar** (bukan lagi di ruang cadangan
      permanen di dalam row), dan saat hover **seluruh isi baris
      (avatar+badge+nama) ikut bergeser ke kanan** (`margin-left`
      animasi) untuk memberi ruang drag-handle. Ini keputusan baru yang
      membalik status "wajib no-shift" khusus untuk drag-handle — alasan:
      permintaan eksplisit King Rezi setelah melihat pola shift-on-hover
      di aplikasi lain (screenshot referensi), bukan lagi dianggap masalah
      interaksi seperti alasan awal poin 5. **Swap count ↔ tombol
      quick-compose "+" di sisi kanan baris TIDAK berubah** — tetap
      no-shift/fixed-slot seperti poin 4-5 aslinya, tidak pernah bergeser.
    - **Micro-adjustment tombol "+" — belum final, dicatat sebagai known
      imperfection:** posisi tombol quick-compose (`.channel-add`)
      di-nudge `top: 1px; left: -1px` (menimpa `inset: 0` untuk sisi itu
      saja) untuk koreksi optik glyph "+" 10px dari addendum poin 9. King
      Rezi mengonfirmasi hasil ini masih **"kurang pas"**, tetapi memilih
      **tidak** minta iterasi lanjutan di Claude Design sekarang — akan
      disesuaikan sendiri saat implementasi kode nyata di `apps/web`.
      Offset ini bukan blocker dan bukan pixel-perfect final; jangan
      dianggap source of truth pasti saat implementasi kode dimulai.
    - Status pekerjaan tidak berubah: masih visual-only di Claude Design
      (7 layar KSP + `components/navigation.html` + App Prototype yang
      iframe ke template sama). **Implementasi kode `apps/web` tetap
      belum berjalan.**

### Reason

- King Rezi ingin visibilitas cepat status channel + jalan pintas compose
  per akun tanpa keluar dari layar kerja yang sedang dilihat (pola umum di
  tools sejenis — channel switcher di sidebar).
- Posisi antara nav item dan zona bawah dipilih (bukan sejajar nav item)
  supaya sidebar tetap merepresentasikan alur kerja (Publish→Engage→
  Analyze), bukan berubah jadi daftar entitas/fitur (P-IA-01).
- No-shift hover (poin 5) adalah revisi eksplisit setelah draf awal (drag
  handle pakai `display:none`) ternyata menggeser konten saat di-hover —
  bukan preferensi kosmetik, King Rezi menyatakan ini sebagai syarat
  wajib **pada saat itu**.
- Shift-on-hover (poin 10, addendum) adalah pembalikan eksplisit
  berikutnya dari syarat di atas, khusus untuk drag-handle — King Rezi
  membandingkan dengan referensi screenshot aplikasi lain dan memilih
  shift-on-hover sebagai pola akhir untuk elemen ini. Swap count↔"+"
  tidak ikut berubah karena tidak ada masalah interaksi yang sama di sana.

### Alternatives Considered

- **Icon strip ringkas tanpa nama akun** (rekomendasi awal AI, hanya ikon +
  dot status) — awalnya dipilih King Rezi, lalu direvisi: nama akun
  (`@kopiselasar`) tetap harus tampil, hanya nama platform (teks
  "Instagram"/"Facebook"/"X") yang dihilangkan karena sudah terwakili ikon.
- **Lucide sebagai sumber ikon** — ditolak setelah diverifikasi tidak
  punya logo brand; diganti `react-icons` (fa6) atas pilihan eksplisit King
  Rezi setelah opsi ini disampaikan.
- **Monogram warna (pola KSP-08 "IG"/"FB"/"X")** — sempat ditawarkan
  sebagai alternatif tanpa dependency ikon baru, tidak dipilih karena King
  Rezi ingin logo asli, bukan inisial teks.

### Catatan implementasi lanjutan (belum diputuskan, follow-up)

- Reorder personal per user butuh tabel preferensi baru (terpisah dari
  `WorkspaceConnectedAccount` yang shared per workspace) — skema belum
  didesain.
- Scheduled-posts count per channel butuh query lintas domain (Publishing
  → Connected Account) yang ringan karena dipanggil tiap render sidebar.
- ~~Kalau fitur ini lanjut ke kode `apps/web`, `react-icons` perlu
  dikonfirmasi ulang sebagai dependency asli project~~ — **selesai**:
  `react-icons` sudah jadi dependency runtime `apps/web` (`package.json`,
  `^5.7.0`), dipakai di `channels-section.tsx`, `workspace-side-nav.tsx`,
  dan `platform-icons.tsx`. Cakupannya kemudian diperluas jadi sumber icon
  TUNGGAL untuk seluruh UI (lihat ADR-068), bukan lagi sekadar ekstraksi
  SVG statis untuk Claude Design.

---
