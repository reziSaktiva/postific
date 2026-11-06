## Decision ADR-157

### Title

Engage Mengikuti Pola Community Buffer: Unit Utama Per Posting, Status `replied` / `resolved` / `dismissed`, dan Panel Filter & Sort (Mengamandemen KSP-06 dan KSP-D06; Mentions Ditunda)

### Status

**Accepted** (keputusan King Rezi, 2026-11-05, lewat `AskUserQuestion`; jawaban Q1 sampai Q5 dicatat di bagian "Jawaban King Rezi"). Mengamandemen KSP-06 dan KSP-D06 setelah rancangan dikonfirmasi di galeri Postific Design Review (urutan yang sama dengan ADR-155). Tidak mengubah ADR-040.

### Date

2026-11-05

### Context

King Rezi meminta halaman Engage punya komponen dan metode UX yang serupa (tidak 100% mirip) dengan halaman `/community` Buffer. Pengamatan REA pada `publish.buffer.com/community` (2026-11-05, akun Team Plan; tangkapan layar, pohon aksesibilitas, nama atribut DOM; tanpa membaca kode sumber) menemukan: tata letak tiga lapis (sidebar aplikasi, daftar posting, komentar posting terpilih), toggle By post / List, tab Comments / Mentions dengan hitungan, kartu posting dengan badge jumlah komentar dan progress bar, dropdown status single-select (All, Unanswered, Replied, Resolved), satu panel Filter & Sort (Sort By, Date Range, Reset filters), aksi Resolve dan Dismiss per komentar, dan banner info yang bisa ditutup.

Engage hari ini mengikuti KSP-06 dan KSP-D06: master-detail per item inbox (daftar thread di kiri, detail di kanan), tiga `Select` filter (Akun, Platform, Status), dan dua status (`unread` | `done`, `InboxItemStatus`). Kolom `status` adalah `TEXT` tanpa constraint di database (`migrations/20260717100000_init`), `postId` pada `EngagementInboxItem` nullable, dan alur balasan (`EngagementService.reply`) belum mengubah status item.

Cek docs Outstand (`outstand.so/docs`, 2026-11-05): komentar didukung (`GET`/`POST /v1/posts/{id}/replies`, webhook `comment.received`); tidak ada endpoint atau event mention di feed dan tidak ada tag; satu-satunya jalur mention adalah story mention Instagram lewat Conversations API (`message.received` dengan `story.type`), URL story kedaluwarsa 24 jam dan medianya tidak boleh disimpan. Itu DM, di luar scope MVP (ADR-040).

### Decision

1. **Unit utama Engage adalah posting.** Daftar posting di panel tengah, komentar posting terpilih di panel kanan. Komentar tanpa `postId` masuk satu kelompok sendiri. Pola Buffer ditiru (tata letak dan perilaku), bukan kode, aset, atau teksnya; dibangun dari shadcn/ui (ADR-097) dan token Postific.
2. **Status komentar diperluas** menjadi `unread`, `replied`, `resolved`, `dismissed` (menggantikan `unread` | `done`). Tanpa kolom baru; nilai tambahan pada kolom `status` yang sudah ada.
3. **Filter dibagi dua:** filter utama di header (Akun/Channels dan Status) dan satu panel sekunder berisi Sort By (belum dibalas dulu, terbaru, terlama), Date Range (7 hari, 30 hari, 6 bulan, 12 bulan), dan Reset filters.
4. **Mentions ditunda** dari ADR ini dan dari spec S-006. Tidak ada tab Mentions di rancangan. Membuka kembali butuh ADR yang mengubah ADR-040.
5. **Toggle By post / List ikut di Tahap 1** (Q5). By post adalah tampilan bawaan; List adalah tampilan alternatif daftar komentar. Isi tampilan List ditentukan rancangan T-216 (mode List Buffer belum teramati, hanya tombolnya).
6. **Rancangan dulu, lalu kode.** Tidak ada kode UI sebelum rancangan di artifact Postific dikonfirmasi King Rezi di galeri (`AGENTS.md` aturan keras no. 10).

### Jawaban King Rezi (2026-11-05)

| #   | Pertanyaan                                          | Jawaban                                                                                                                                 |
| --- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Nasib baris lama berstatus `done`                   | Migrasi data `done` menjadi `resolved`, tanpa kolom baru. Diterapkan ke DB bersama hanya atas izin King Rezi (T-217.4).                 |
| Q2  | Kapan `replied` diisi                               | Otomatis saat balasan berhasil terkirim (`EngagementService.reply`) bila status `unread`; tidak menurunkan `resolved` atau `dismissed`. |
| Q3  | Boleh pindah dari `resolved` / `dismissed` kembali? | Ya, reversibel: buka kembali menjadi `unread`.                                                                                          |
| Q4  | Badge sidebar dan Engagement Snapshot di Home       | Tetap menghitung `unread` saja; tidak berubah.                                                                                          |
| Q5  | Toggle By post / List                               | **Ikut di Tahap 1** (bukan usulan agen: agen mengusulkan List ditunda). Menambah tiket T-224.                                           |

### Reason

- Triage komentar secara alami berkelompok per posting; Buffer memakainya dan pengguna Postific (Raka) sudah akrab dengan pola Buffer dari Draft Editor (ADR-155).
- Status yang memisahkan "sudah dibalas", "selesai", dan "diabaikan" mengurangi pencampuran antara komentar yang perlu tindakan dan yang tidak; `done` tunggal tidak membedakannya.
- Kolom `status` berupa `TEXT` tanpa constraint dan `postId` sudah ada, sehingga perubahan data kecil (tanpa kolom atau tabel baru).
- Mentions penuh tidak bisa dibangun dengan API Outstand yang terdokumentasi; yang tersedia hanya DM story Instagram, dan itu melanggar batas MVP (ADR-040).

### Alternatives Considered

- **Tetap daftar item inbox, hanya filter dan status:** tidak dipilih; tidak menjawab permintaan pola Buffer.
- **Hanya By post, List ditunda:** usulan agen untuk menjaga lingkup kecil; tidak dipilih (Q5), King Rezi memilih keduanya ikut.
- **Mentions sebagai kerangka UI tanpa data:** tidak dipilih; menampilkan tab kosong tanpa jalur data yang jujur.
- **Mentions penuh (story mention Instagram lewat Conversations):** ditunda; butuh ADR yang mengubah ADR-040, tabel/tipe baru, dan penanganan media yang kedaluwarsa 24 jam.

### Consequences

- Perubahan kode di `apps/` dan `packages/` lewat tiket T-216 sampai T-222 dan T-224 (spec S-006). Tidak ada kode di sesi yang menulis ADR ini.
- KSP-06 dan KSP-D06 diselaraskan di tiket T-221 setelah rancangan dikonfirmasi, bukan sekarang.
- `InboxItemStatus` di `apps/web/src/domains/engagement/types.ts` dan konsumen status di Engage, badge sidebar, dan Home diperiksa di T-217.
- Tab Mentions tercatat sebagai T-223 (⏸️ Deferred).

### Addendum 2026-11-06: keputusan King Rezi atas audit docs-consistency (topik engage)

Keputusan tambahan, semuanya mengikuti rekomendasi agen; tidak mengubah keputusan di atas.

- **Balasan di kelompok "Tanpa posting":** komposer nonaktif dengan pesan jelas karena Outstand hanya membalas per posting (ADR-113); Resolve dan Dismiss tetap tersedia.
- **Badge dan Snapshot:** menghitung `unread` dalam 12 bulan terakhir, sama dengan Date Range bawaan daftar posting (menyempurnakan Q4).
- **Tool MCP `list_comments`:** filter `status` menerima empat status baru; `done` tetap diterima sebagai alias `resolved`.
- **`read_at`:** dipertahankan, tidak dipakai, tanpa migrasi.
- **Prioritas produk:** status komentar dan pengelompokan per posting adalah Should Have (peningkatan setelah MVP).
- **Webhook `comment.received`:** tersedia di vendor tetapi tidak dipakai MVP; ADR-040 tidak diedit, catatan ada di `integration-layer.md`.
- **Pull per akun vs endpoint per posting, dan indeks DB:** diputuskan di T-218 (T-218.7, T-218.8).
- Tindak lanjut tiket: T-217.7, T-217.8, T-218.7, T-218.8, dan catatan di T-219.2.
