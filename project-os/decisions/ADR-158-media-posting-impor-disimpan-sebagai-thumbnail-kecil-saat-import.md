## Decision ADR-158

### Title

Media Posting Impor Disimpan Saat Import dalam Bentuk Thumbnail Kecil (Opsi C), Bukan Hotlink URL CDN Platform

### Status

**Accepted** (keputusan King Rezi, 2026-11-06; hasil investigasi T-228). Rincian teknis dan batas hak platform diverifikasi di T-229 sebelum implementasi (T-230).

### Date

2026-11-06

### Context

Posting hasil Import Posts (ADR-093) tidak menyimpan media: `publishing_posts.media_ids` kosong, dan hanya URL CDN platform yang disimpan di `publishing_post_targets.platform_options.mediaUrls` (`fetchImportJobStatus` meneruskan `containers[].media[].url` dari Outstand apa adanya). Investigasi T-228 (2026-11-06, workspace Cook It Real Good, 492 posting impor):

- URL itu bertanda tangan dan berumur pendek: seluruh 118 URL TikTok kedaluwarsa 2026-10-23, seluruh 182 URL Instagram kedaluwarsa paling lambat 2026-10-26, dan sekitar 188 dari 192 URL Facebook sudah lewat. Uji `HEAD`: URL Facebook yang tanda tangannya masih berlaku memberi 200 `image/jpeg` dengan maupun tanpa Referer (bukan masalah hotlink); URL TikTok dan Instagram yang kedaluwarsa memberi 403.
- Outstand tidak menyediakan URL permanen: `GET /v1/posts/{id}` untuk posting `source: "imported"` mengembalikan URL CDN yang sama, tanpa pemrosesan (`processing: null`). Penyimpanan media Outstand (`media.outstand.so`, berlaku 60 hari) hanya berisi file yang diunggah lewat Postific, bukan media posting impor.
- Jenis media: TikTok menyimpan cover (webp), sekitar 70% media Instagram adalah `.mp4` (Reel), Facebook umumnya `.jpg`.
- Mencoba import ulang lewat Sync Now ditolak cooldown 24 jam per akun (ADR-093 butir 9) karena import periodik harian baru berjalan; jadi belum terbukti apakah import ulang memberi URL segar. Bukti tidak langsung (Outstand mengembalikan URL yang sama persis dengan yang tersimpan) menunjukkan Outstand menyimpan URL dari saat import pertamanya.

### Decision

1. **Media posting impor disimpan di sisi kita saat Import (opsi C):** hanya salinan kecil untuk tampilan thumbnail, bukan berkas asli penuh.
   - Gambar (Facebook, Instagram foto, cover TikTok): unduh dan simpan sebagai gambar thumbnail ukuran kecil.
   - Video (Reel Instagram dan sejenisnya): simpan satu frame poster, bukan `.mp4` penuh. Bila poster tidak bisa diambil, posting tetap tampil dengan ikon (perilaku T-227).
2. Penyimpanan memakai Supabase Storage lewat domain `media` (pola `storagePath` dan signed URL yang sudah ada, ADR-040), dengan batas ukuran dan jumlah per posting; unduhan berjalan di dalam alur Import, dengan kegagalan satu media tidak menggagalkan import posting.
3. **Posting lama tidak dipulihkan:** URL yang sudah kedaluwarsa tidak bisa diunduh. Pemulihan hanya mungkin bila sumber memberi URL segar (diuji di T-229); sampai itu, posting lama tetap memakai fallback T-227 (gambar bila URL masih hidup, selain itu ikon).
4. Fallback T-227 tetap dipertahankan sebagai lapisan kedua.
5. Salinan hanya untuk ditampilkan di workspace pemilik akun; tidak dipublikasikan ulang.
6. **Risiko hak platform diterima (King Rezi, 2026-11-06):** penyimpanan thumbnail dianggap aman karena Buffer (produk sejenis) juga menyimpan media posting. Ini pengamatan King Rezi, bukan telaah ketentuan resmi Meta atau TikTok; T-229.5 mencatat dasar itu dan hanya menandai bila ada ketentuan resmi yang bertentangan.

### Reason

- URL CDN berumur beberapa hari sampai dua minggu, sedangkan posting impor adalah riwayat yang dilihat berbulan-bulan kemudian: hotlink tidak akan pernah bertahan.
- Outstand tidak menawarkan alternatif permanen, jadi satu-satunya penyimpanan yang tahan lama adalah milik kita.
- Thumbnail kecil dan poster video menekan ukuran, biaya Storage, dan eksposur hak dibanding menyimpan media penuh.

### Alternatives Considered

- **A. Tetap hotlink.** Ditolak: thumbnail mati dalam hitungan hari, mayoritas kartu jadi ikon.
- **B. Unduh dan simpan media penuh (termasuk mp4).** Ditolak King Rezi: ukuran dan biaya Storage, serta eksposur hak platform lebih besar untuk manfaat yang hanya thumbnail.
- **Menyimpan nol media dan menampilkan ikon saja.** Ditolak: kehilangan konteks visual yang diminta King Rezi di Engage.

### Consequences

- Import Posts menambah langkah unduh-dan-simpan: ada biaya jaringan dan waktu per posting, dan risiko timeout pada job (batas 25 detik per run, BG-D05; Instagram dan TikTok sudah sering melewatinya) harus ditangani di T-229 dan T-230.
- Perlu keputusan skema: memakai `media_ids` pada posting impor (agar `resolveThumbnails` bekerja apa adanya) atau field terpisah; diputuskan di T-229.
- Posting impor yang sudah ada (492 di Cook It Real Good) kehilangan thumbnail secara permanen kecuali T-229 menemukan jalur URL segar.
- Dampak ke ADR-093 (Import read-only): posting tetap read-only; hanya medianya ikut disimpan.
- Belum terbukti: kemampuan mengambil poster dari mp4 Instagram di Railway (frame pertama tanpa mengunduh berkas penuh), ketentuan resmi platform soal menyimpan salinan (risiko diterima King Rezi, butir 6), dan apakah import ulang memberi URL segar.

### Addendum 2026-11-06: hasil spike T-229

- **Skema (keputusan King Rezi):** kolom baru `thumbnail_storage_path` dan `thumbnail_kind` di `publishing_post_targets`, bukan `media_items`/`media_ids` (menghindari thumbnail muncul di Media Library dan MCP `list_media`). File di bucket `media` dengan awalan path sendiri; URL ditandatangani saat dibaca.
- **Eksekusi:** tahap terpisah lewat job `import.media` per batch kecil, bukan sinkron di dalam job Import (import pertama bisa 1000 posting, melewati batas 25 dan 30 detik).
- **Terukur (mp4 uji, bukan Instagram):** poster `ffmpeg` 0,66 detik dengan sekitar 3% berkas ditarik; webp `sharp` 640 px sekitar 28 KB.
- **Posting lama:** tidak dipulihkan; import ulang tidak bisa diuji karena cooldown 24 jam selalu diperbarui import periodik.
