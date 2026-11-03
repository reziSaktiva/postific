## Decision ADR-155

### Title

Redesain Draft Editor Mengikuti Pola Modal Create Post Buffer, Tahap 1: Tata Letak dan Perilaku dengan Kapabilitas yang Sudah Ada (Amandemen KSP-D02 dan Tata Letak ADR-052)

### Status

**Accepted** (keputusan King Rezi, 2026-11-03). Rancangan dikonfirmasi King Rezi 2026-11-03; kode boleh dikerjakan lewat tiket (T-199 sampai T-207, spec S-005). Addendum konfirmasi ada di bagian paling bawah file ini; Reel wajib video mengamandemen ADR-154.

### Date

2026-11-03

### Context

King Rezi meminta UI/UX Draft Editor (KSP-05) diubah mengikuti modal Create Post di `publish.buffer.com`. Cara kerja modal itu diamati langsung di akun uji King Rezi pada 2026-11-03 dengan REA (struktur dan pohon aksesibilitas) dan skrip CDP lokal (klik per nama aksesibilitas). Tidak ada aksi Schedule, Save Draft, atau Share yang dijalankan. Bukti (screenshot dan catatan) disimpan di luar repo; yang dipakai di sini hanya temuan perilaku.

Temuan yang relevan:

1. **Tata letak.** Dialog besar dengan dua zona: kiri berisi baris channel dan editor, kanan berisi panel Preview yang bergantian dengan Templates dan AI Assistant. Footer berisi "Create Another", Save Draft, dropdown jadwal, dan tombol aksi utama.
2. **Pemilihan channel di atas editor.** Tombol "+ Channels" membuka popover dengan pencarian, "Select all", daftar centang (avatar, badge platform, nama), dan "Connect a Channel". Ada pintasan "Last used" dan "All". Setelah dipilih, baris menciut menjadi chip avatar dan tombol "+ Add channel".
3. **Preview per platform langsung** di panel kanan, diperbarui saat mengetik. Validasi dan preview dihitung di klien (tidak ada request jaringan saat memilih channel atau mengetik).
4. **Blok per jaringan berbentuk akordeon** (satu blok terbuka, lainnya menciut jadi baris ringkas): radio format Post/Reel/Story (Reel nonaktif jika media bukan video), banner validasi kuning inline, dan field khusus platform (Pinterest: Title, Destination Link, Pinning To; TikTok: Title dan mode Automatic / Notify Me; Instagram: opsi lanjutan).
5. **Jadwal di footer**: "Next Available" atau "Set Date and Time" (kalender dan jam dengan zona waktu akun).
6. Buffer menjadwalkan tanpa langkah konfirmasi tambahan.

Kendala backend (diperiksa 2026-11-03):

- Caption dan media Postific bersifat per post (`PublishingPost.caption`, `mediaIds`). Outstand mendukung override caption per jaringan lewat field `content` di blok platform, tetapi **tidak mendukung media per jaringan** (media, first comment, dan thread tetap bersama).
- Nama field Outstand untuk First Comment, mode dan judul TikTok, serta opsi lanjutan Instagram belum terkonfirmasi di dokumen.

### Decision

**1. Pola, bukan salinan.** Draft Editor didesain ulang mengikuti **pola tata letak dan perilaku** modal Create Post Buffer, dibangun dari komponen shadcn/ui dan token Stone Postific (ADR-097). Kode, CSS, ikon, aset, ilustrasi, dan teks Buffer tidak disalin. Rancangan lebih dulu dibuat di artifact Postific dan dikonfirmasi King Rezi sebelum kode ditulis.

**2. Cakupan Tahap 1: tata letak dan perilaku dengan kapabilitas yang sudah ada.** Yang masuk:

- Baris channel di atas editor: popover Channels (pencarian, Select all, daftar centang dengan status koneksi, tautan Connect a Channel), pintasan "Last used" dan "All", chip avatar setelah dipilih, tombol "+ Add channel". Akun Disconnected tetap tampil dengan peringatan (KSP-D04).
- Editor dan media di kiri, satu caption dan satu set media bersama untuk semua jaringan.
- Panel kanan Preview live per platform (poin 5).
- Blok pengaturan per jaringan berbentuk akordeon untuk format (Post/Reel/Story sesuai ADR-039, opsi nonaktif mengikuti aturan media ADR-107, 121, 154) dan field khusus platform yang sudah didukung (board, judul, dan link Pinterest).
- Banner validasi inline di blok jaringan menggantikan Alert tersebar di atas form, dengan aturan yang sama (ADR-121, 154, ADR-107, KSP-D12).
- Footer: Save Draft, kontrol jadwal, dan Schedule / Publish Now sesuai RBAC (ADR-047, ADR-074).

**3. Confirmation Summary dipertahankan.** Schedule dan Publish Now tetap melewati ringkasan konfirmasi (KSP-05-F06, KSP-D05, ADR-047, UXP-04). Buffer tidak punya langkah ini; Postific sengaja berbeda.

**4. Header hanya berisi judul, toggle Preview, Fullscreen/Standard (ADR-065), dan Close.** Tags, Templates, dan AI Assistant milik Buffer tidak ditampilkan. AI bawaan sudah dicabut (ADR-138); Tags dan Templates belum punya model data.

**5. Preview meniru tampilan asli platform secara terperinci** untuk Facebook, Instagram, TikTok, dan Pinterest; platform lain memakai kartu generik. Syaratnya: komponen dirakit sendiri dari komponen dan token Postific, tidak menyalin aset atau markup Buffer, dan logo atau badge platform dipakai sesuai pedoman merek platform masing-masing. Ini opsi termahal dari tiga yang ditawarkan; biaya dan risiko merek dicatat di Consequences.

**6. Yang tidak berubah.** ADR-039 (format per target), ADR-047 (Publish Now), ADR-052 (modal, resume New Post, tanpa deep link), ADR-054 (redirect setelah aksi terminal), ADR-065 (toggle Fullscreen/Standard), ADR-107, ADR-121, ADR-154 (aturan media dan jadwal 30 hari), ADR-125 (simpan akun tujuan draft), dan KSP-05-F10 sampai F13.

**7. Di luar Tahap 1.** Dicatat sebagai kandidat tiket terpisah setelah rancangan Tahap 1 selesai:

- Caption per jaringan (Outstand mendukung; butuh kolom per target, migrasi, dan perubahan adapter).
- Media per jaringan (Outstand tidak mendukung; tidak bisa tanpa memecah satu post jadi beberapa panggilan).
- First Comment, mode dan judul TikTok, opsi lanjutan Instagram (Collaborators, Tag Products, Music, Stickers, AI disclosure): nama field Outstand belum terkonfirmasi.
- Tags, Templates, dan "Next Available" (butuh konsep slot antrean).

### Reason

- Buffer adalah acuan yang King Rezi pilih untuk pengalaman membuat post. Meniru **pola** memberi kemiripan yang diminta tanpa menyalin materi yang dilindungi.
- Tahap 1 hanya memakai kapabilitas yang sudah ada, sehingga tidak ada migrasi database atau perubahan adapter Outstand yang menahan redesain.
- Batas Outstand membuat paritas penuh (media per jaringan) tidak mungkin; lebih baik ditulis jelas sebagai di luar scope daripada diam-diam gagal.
- Confirmation Summary melindungi aksi publish yang tidak bisa ditarik (UXP-04). Buffer mengambil keputusan berbeda; Postific tidak wajib mengikutinya.

### Alternatives Considered

- **Tahap 1 plus caption per jaringan.** Ditolak untuk sekarang: butuh migrasi dan perubahan adapter, dan bisa menjadi tahap berikutnya.
- **Paritas penuh termasuk media per jaringan.** Ditolak: tidak didukung Outstand.
- **Menghapus Confirmation Summary seperti Buffer**, atau mempertahankannya hanya untuk Publish Now. Ditolak King Rezi; Summary tetap untuk keduanya.
- **Menampilkan Tags, Templates, AI Assistant sebagai ikon nonaktif ("Segera hadir").** Ditolak: memajang fitur yang belum ada.
- **Preview satu kartu generik atau kartu per platform sederhana.** Ditolak King Rezi demi kemiripan dengan tampilan asli platform.

### Consequences

- KSP-05 (tata letak dan zona fungsional), KSP-D02 (dua zona kiri/kanan), dan NP-D11 diperbarui **setelah** rancangan dikonfirmasi di galeri, bukan sebelumnya; urutannya docs, spec, tiket, implementasi (ADR-131) dan aturan 10 `AGENTS.md` tetap berlaku.
- `Modal.tsx` (sekitar 1.770 baris, satu komponen berisi seluruh state form) perlu dipecah. `actions.ts` dan domain publishing sebisa mungkin tidak berubah karena Tahap 1 tidak menambah kapabilitas.
- Komponen preview per platform adalah pekerjaan UI baru yang besar (Facebook, Instagram, TikTok, Pinterest) dan harus punya tes tampilan. Penggunaan logo dan badge platform perlu dicek terhadap pedoman merek masing-masing sebelum rilis.
- Tes E2E Playwright (ADR-149) untuk alur Draft Editor harus diperbarui bersama redesain.
- Verifikasi tetap lewat tangga Done (code) dan Verified (staging) (ADR-153).

### Pertanyaan yang Masih Terbuka (diputuskan di tahap rancangan)

- "Create Another": ikut Tahap 1 atau tidak.
- Kontrol jadwal tanpa "Next Available": bentuk dropdown dan label jadwal.
- Perilaku layar sempit (modal penuh, panel Preview jadi tab atau lembar bawah).
- Posisi format Post/Reel/Story dan field Pinterest di blok jaringan ketika hanya satu akun dipilih.
- Perilaku resume draft dibandingkan dialog Buffer (kemunculannya tidak konsisten pada pengamatan otomatis, perlu diperiksa manual).

### References

- ADR-039, ADR-047, ADR-052, ADR-054, ADR-065, ADR-074, ADR-097, ADR-107, ADR-121, ADR-125, ADR-131, ADR-132, ADR-138, ADR-149, ADR-153, ADR-154.
- `product-discovery/04-ux/key-screen-patterns.md` (KSP-05, KSP-D02, KSP-D04, KSP-D05, KSP-D12), `navigation-patterns.md` (NP-D11).
- Outstand: `outstand.so/docs/create-a-post` (override caption per jaringan, media bersama, `scheduledAt` maksimal 30 hari).

## Addendum 2026-11-03: konfirmasi rancangan

King Rezi mengonfirmasi rancangan Draft Editor di galeri Postific Design Review (entri "Draft Editor: redesain pola Buffer (ADR-155)", kartu `ScreenDraftEditorRedesain` di artifact Postific, ADR-140) pada 2026-11-03, beserta semua usulan Neymar dan keputusan di bawah. Decision 1 sampai 7 di atas tidak berubah; addendum ini menutup "Pertanyaan yang Masih Terbuka" dan menambah satu aturan.

### A. Rancangan galeri dikonfirmasi seluruhnya; jawaban lima pertanyaan terbuka

1. **"Create Another" tidak ikut Tahap 1.** Bentrok dengan redirect setelah aksi terminal (ADR-054).
2. **Kontrol jadwal.** Tombol "Atur jadwal" di footer membuka popover berisi kalender (hari lampau dan hari di atas 30 hari dinonaktifkan), input jam, label WIB, dan penjelasan batas. Setelah diisi, tombol menampilkan jadwalnya, mis. "Rab, 4 Nov · 10:00 WIB". Tanpa "Next Available".
3. **Layar sempit.** Modal penuh dengan tab "Editor | Pratinjau" di bawah header, footer ditumpuk, toggle Fullscreen dan toggle Pratinjau di header disembunyikan.
4. **Satu akun terpilih.** Blok jaringan selalu terbuka tanpa akordeon; pemilih format dan field Pinterest ada di dalam blok.
5. **Resume draft.** Tetap dialog modal seperti KSP-05-F13, dengan teks deskripsi dirapikan (tanpa bocoran ID KSP atau ADR di UI). Kode hanya menyimpan caption, jadi akun dan media tidak kembali saat Resume; itu tidak diubah di Tahap 1.

### B. Lima keputusan detail

1. **Aturan baru: Reel wajib media video (mengamandemen ADR-154).** Reel (Facebook dan Instagram) hanya tersedia dan wajib berisi video. Bila media berupa gambar, opsi Reel dinonaktifkan dengan pesan "Reel membutuhkan satu video. Ganti media dengan video, atau pilih format Post atau Story." ADR-154 dulu mencatat batasan jenis media sebagai belum ditegakkan; aturan ini menutup celah itu untuk Reel. Penegakan di server dan klien dikerjakan di tiket (T-200), termasuk cek dokumen Outstand per jaringan sebelum ditegakkan. Aturan jenis media untuk platform lain (mis. YouTube harus video) tidak diputuskan di sini.
2. **Akun Disconnected.** Tetap boleh dicentang, dengan peringatan dan aksi Reconnect. Schedule dan Publish Now **tidak diblokir** karenanya, mengikuti kode sekarang. Ini dicatat sebagai tafsir persetujuan King Rezi atas rancangan; bisa dibuka lagi bila King Rezi ingin memblokir.
3. **Lebar kartu Standard naik dari 960 ke 1120px.** Default tetap Standard; toggle Fullscreen/Standard tidak dipersist; ADR-065 tidak berubah selain lebar ini.
4. **Letak pesan validasi.** Pesan validasi jadwal tampil di footer dekat kontrol jadwal, bukan di blok jaringan. Validasi per jaringan (media, board, Reel) ada di dalam blok jaringan. Validasi lintas jaringan (Story dengan caption campur, lebih dari satu akun Pinterest) tampil di atas editor.
5. **Confirmation Summary dan Pratinjau.** Saat Confirmation Summary tampil, panel Pratinjau tetap terlihat. Kode lama mengganti seluruh body modal; itu berubah.

### C. Implikasi implementasi

- Komponen shadcn `calendar` dan `accordion` belum terpasang di `apps/web/src/components/ui/`; keduanya ditambah lewat workflow CLI/MCP shadcn (`apps/web/.claude/CLAUDE.md`), bukan ditulis manual.
- Toolbar editor hanya berisi "Lampirkan media". Emoji dan hashtag tidak punya kapabilitas di Postific, jadi tidak ditampilkan.
- Logo dan badge platform dicek terhadap pedoman merek masing-masing platform sebelum rilis (Decision 5).

### D. Dokumen baseline dan status kode

Dokumen baseline `product-discovery/04-ux/` (KSP-05, KSP-D02, NP-D11, dan yang terkait) diperbarui di sesi yang sama oleh sesi utama sesuai rancangan terkonfirmasi (urutan: product-discovery, lalu project-os). Gerbang "Consequences" poin pertama sudah terpenuhi; kode boleh dikerjakan lewat tiket T-199 sampai T-207 (`tickets/v02-publishing-mvp.md`) dengan spec S-005 (`specs/S-005.md`).

### E. Klarifikasi dari review konsistensi dokumen (2026-11-03)

1. **Label zona waktu.** "WIB" di A.2 adalah contoh pada rancangan. Label di popover jadwal mengikuti zona waktu pengguna (ADR-146, default WIB), sama seperti penafsiran input jadwal.
2. **Letak banner validasi.** B.4 menyempurnakan Decision 2: validasi per jaringan ada di blok jaringan, validasi lintas jaringan di atas editor, dan validasi jadwal di footer. Decision 2 dibaca bersama B.4.

### Referensi addendum

ADR-054, ADR-065, ADR-107, ADR-121, ADR-140, ADR-149, ADR-153, ADR-154, `specs/S-005.md`, `tickets/v02-publishing-mvp.md` (T-199 sampai T-207).
