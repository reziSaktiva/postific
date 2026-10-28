## Decision ADR-068

### Title

`react-icons` Diperluas Jadi Library Ikon Tunggal untuk Seluruh Icon — Bukan Hanya Logo Brand (Amandemen ADR-058 Poin 6)

### Status

Superseded by ADR-148 (2026-10-28)

### Date

2026-08-05

### Decision

ADR-058 poin 6 sebelumnya membatasi `react-icons` (fa6 set) khusus untuk logo
brand platform media sosial (`FaInstagram`, `FaFacebook`, `FaXTwitter`, dst.)
— dipilih karena `lucide-react` (opsi awal King Rezi) sengaja tidak
menyediakan logo bermerek dagang. Icon generik lain (grip/drag-handle, "+",
lonceng notifikasi, bulan/matahari toggle) tetap dipakaikan custom inline SVG
(pola `GripIcon`), bukan `react-icons`.

Saat menutup KI-008/KI-009/KI-012 (icon di sidebar Channels), King Rezi
diminta konfirmasi eksplisit lewat `AskUserQuestion` — termasuk konteks
riwayat konflik (lihat bagian "Riwayat yang perlu diketahui" di bawah) — dan
dua kali menegaskan keputusan: **`react-icons` diperluas jadi library ikon
TUNGGAL untuk SEMUA icon di project**, baik brand maupun generik, menggantikan
pola campuran (react-icons untuk brand + custom SVG untuk generik).

1. **Cakupan amandemen:** ADR-058 poin 6 diamandemen — `react-icons`
   (`react-icons/fa6`, dan set lain dari `react-icons` bila dibutuhkan) kini
   jadi satu-satunya sumber icon untuk seluruh UI produk, tidak lagi dibatasi
   logo brand. Poin 1–5, 7–10 ADR-058 (posisi, isi baris, no-shift/
   shift-on-hover, dsb.) tidak berubah.
2. **Icon generik yang sudah dimigrasi ke `react-icons` (implementasi
   pertama, T-012 out-of-scope items KI-008/009/012):**
   - Tombol quick-compose "+" (sidebar Channels) — dari `Text` char "+" ke
     `FaPlus` (`react-icons/fa6`), ukuran 10px (bukan 16px yang pernah
     dicoba dan gagal — lihat riwayat di bawah — dan bukan 8px token
     `2xs` yang salah/KI-009).
   - Drag-handle sidebar Channels — dari custom inline SVG `GripIcon` ke
     `RxDragHandleDots2` (`react-icons/rx`).
   - `WorkspaceSideNav`: CTA "+ New Post" → `FaPlus`; Notifikasi 🔔 →
     `FaBell`; toggle Dark/Light 🌙/☀️ → `FaMoon`/`FaSun` (perluasan scope
     atas instruksi eksplisit King Rezi "pastikan semua icon pakai
     react-icon", bukan cuma dark-mode).
3. **Custom inline SVG tidak dilarang total** — tetap boleh dipakai untuk
   kasus yang benar-benar tidak tersedia di `react-icons` manapun, tapi
   default/preferensi pertama sekarang `react-icons`, bukan sebaliknya.
4. **Menyimpang sengaja dari rekomendasi default dokumentasi Astryx**
   (`apps/web/.claude/CLAUDE.md`), yang merekomendasikan `heroicons`/
   `lucide-react`/custom SVG untuk icon non-brand. Astryx sendiri tidak
   melarang `react-icons` — ini pilihan konsistensi project, bukan
   pelanggaran kontrak Astryx.

### Riwayat yang perlu diketahui (transparansi, bukan disembunyikan)

Ditemukan di komentar `styles.css` Claude Design (sebelum ditulis ulang pada
sesi ini) dua catatan riwayat yang relevan dan berpotensi bertentangan dengan
keputusan ini:

- King Rezi **pernah mencoba** versi icon 16px untuk channel-add "+" dan
  menilainya _"looked worse, not better"_, lalu revert ke raw glyph "+"
  20×20px.
- Grip-handle **sengaja** dibuat custom inline SVG (bukan `react-icons`)
  supaya _"tidak perlu pull dependency baru untuk verifikasi 1 vector
  path"_.

Kedua catatan ini diangkat eksplisit ke King Rezi sebelum eksekusi (baik di
kode `apps/web` maupun sinkronisasi Claude Design). King Rezi tetap memilih
"ganti ke react-icons semua" setelah melihat konteks ini — jadi ADR ini
adalah **keputusan sadar yang menimpa keputusan lama**, bukan pengulangan
kesalahan tanpa sepengetahuan. Ukuran akhir dipilih 10px (token `xs`, bukan
16px yang dulu dinilai gagal), mengikuti koreksi ukuran yang sudah benar dari
KI-009.

### Reason

- Konsistensi visual dan maintenance: satu library icon lebih mudah dijaga
  konsisten (ukuran, stroke, alignment) daripada campuran custom SVG +
  react-icons yang punya karakteristik render berbeda.
- `react-icons` sudah jadi dependency runtime terkonfirmasi sejak T-012.3
  (ADR-058) untuk logo brand — memperluas cakupannya tidak menambah
  dependency baru, hanya memperluas pemakaian yang sudah ada.
- King Rezi menilai custom inline SVG per-icon (pola `GripIcon`) menambah
  beban verifikasi manual (path SVG, viewBox) untuk setiap icon baru,
  sementara `react-icons` sudah terverifikasi vendor dan lebih cepat
  dipakai ulang.

### Alternatives Considered

- **Pertahankan pola campuran ADR-058 poin 6 apa adanya** (react-icons
  hanya untuk brand, custom SVG untuk generik). Ditolak — King Rezi
  eksplisit ingin satu sumber icon untuk seluruh UI.
- **Migrasi ke `lucide-react` atau `heroicons` untuk icon generik**
  (mengikuti rekomendasi default Astryx), tetap pakai `react-icons` khusus
  brand. Ditolak — akan menambah dependency icon library kedua alih-alih
  menyederhanakan ke satu sumber.
- **Revert ke ukuran 16px yang pernah dicoba King Rezi sebelumnya untuk
  "+".** Ditolak — riwayat mencatat hasil itu "looked worse, not better";
  ukuran final memakai 10px (token `xs`) sesuai koreksi KI-009.

### Catatan implementasi

- Diimplementasikan Mark UI Engineer di `apps/web/src/app/[slug]/_sidebar-channels/channels-section.tsx`
  dan `apps/web/src/app/[slug]/workspace-side-nav.tsx`.
- Direview Ridwan Architecture Reviewer — bersih, tanpa pelanggaran
  arsitektur.
- Di-QA Najwa QA Engineer — seluruh interaksi fungsional (klik nyata)
  terverifikasi jalan; lint/typecheck/vitest (45 test) pass.
- Disinkronkan ke Claude Design (project "Social Media Management",
  `84aded99-...`) — 7 screen template + `AppPrototype.dc.html` diupdate agar
  representasi visual (inline SVG statis, identik dengan path `react-icons`
  yang dipakai di kode) dan logic deteksi klik (`toggleTheme()`/`route()`,
  sebelumnya cocok teks emoji, sekarang atribut `data-proto`/`aria-label`)
  tetap konsisten (duty ADR-056).

---
