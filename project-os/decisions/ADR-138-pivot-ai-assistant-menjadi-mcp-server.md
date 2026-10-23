## Decision ADR-138

### Title

Pivot "AI Assistant" Bawaan Menjadi MCP Server: Postific Mengekspos Aksi
Produk ke AI Milik Pengguna

### Status

Accepted

### Date

2026-10-23

### Decision

Rilis **v0.5** berubah dari "AI Assistant MVP" menjadi **"MCP Server MVP"**.
Postific **tidak membangun AI sendiri** (tanpa provider AI, tanpa biaya
token di sisi Postific). Postific menjadi **MCP server** sehingga AI milik
pengguna (Claude, ChatGPT, Cursor, dan klien MCP lain) dapat bekerja di
dalam aplikasi atas nama pengguna itu.

Keputusan ini diambil King Rezi lewat diskusi 2026-10-23.

**1. AI bawaan dicabut.** Kemampuan "Caption Generation", "Caption
Improvement", dan "Tone Rewrite" tidak lagi menjadi fitur Postific. Caption
ditulis oleh AI klien lalu disimpan lewat tool draft. Konsekuensinya:
`generateCaption`, `getAIRequestHistory`, repository `AIRequest`, domain
`ai-assistant/`, dan model `AiRequest`/`AiResult` tidak dipakai lagi dan
dihapus lewat tiket (lihat `tickets/v05-mcp-server-mvp.md`). BC-04 di
`domain-model.md` berubah dari "AI Assistant" menjadi "MCP Access".

**2. Scope izin MVP.** Pengguna memilih scope saat menyambungkan klien AI.

| Scope      | Isi                                                                    | Status MVP |
| ---------- | ---------------------------------------------------------------------- | ---------- |
| `read`     | akun, media, draft, antrean, history, analytics, komentar (hanya baca) | MVP        |
| `draft`    | buat dan edit draft, unggah media dari URL                             | MVP        |
| `schedule` | jadwalkan post                                                         | MVP        |
| `publish`  | Publish Now                                                            | Ditunda    |
| `reply`    | balas komentar                                                         | Ditunda    |

Default saat menyambungkan: `read` + `draft`. `schedule` harus dicentang
sengaja. **Dikecualikan dari MVP:** semua aksi destruktif dan administratif
(hapus draft/post/media, batalkan jadwal, kelola member dan role, disconnect
akun, hapus workspace). Pembatalan jadwal tetap dilakukan manusia di aplikasi.

Token MCP bertindak sebagai pengguna yang menyambungkannya, terikat **satu
workspace per koneksi**, dan role pengguna tetap berlaku (ADR-074). Keanggotaan
dan role divalidasi ulang di setiap panggilan.

**3. Daftar tool MVP (12 tool).**

| Scope      | Tool                                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `read`     | `get_workspace`, `list_accounts`, `list_media`, `list_drafts`, `list_scheduled_posts`, `list_published_posts`, `get_analytics`, `list_comments` |
| `draft`    | `create_draft`, `update_draft`, `upload_media`                                                                                                  |
| `schedule` | `schedule_posts`                                                                                                                                |

Setiap tool hanya membungkus Application Service yang sudah ada. Tidak ada
business logic di entry point MCP (`AGENTS.md` aturan 3). Sinkronisasi
komentar dan metrik tidak diekspos karena sudah berjalan lewat cron.

**4. Batas.**

- **Baca:** 20 item per halaman, dengan cursor.
- **Tulis, per konten:** target maksimum sama dengan jumlah akun terhubung di
  workspace (seperti Draft Editor, satu `Post` dengan banyak `PostTarget`).
- **Tulis, per panggilan `schedule_posts`:** maksimum 10 konten (asumsi kerja,
  konstanta konfigurasi, boleh diubah King Rezi).
- `create_draft` dan `upload_media`: satu per panggilan.

**5. Keamanan.**

- `upload_media` menerima URL dan server mengunduhnya sendiri, sehingga
  wajib: hanya `https`, alamat tujuan diperiksa setelah DNS resolve dan ditolak
  bila IP privat/loopback/link-local (anti-SSRF), redirect diperiksa ulang di
  tiap lompatan, batas ukuran dan waktu unduh, tipe file divalidasi dari isi
  (magic bytes). Penyimpanan memakai alur `uploadMedia` yang ada.
- Isi komentar yang dikembalikan `list_comments` ditandai sebagai **data
  tidak tepercaya**, bukan instruksi (risiko prompt injection).
- Safety Check dan validasi matriks `ContentFormat` per target (ADR-039)
  tetap dijalankan di server saat `schedule_posts`.

**6. Audit trail.** Tabel audit baru mencatat satu baris per panggilan tool
(workspace, pengguna, klien, tool, scope, ringkasan input yang disamarkan,
status, durasi, target hasil). Post yang dibuat lewat MCP membawa penanda
sumber (`createdVia = mcp` beserta klien). Retensi log 90 hari, dibersihkan
lewat cron yang sudah ada. UI: badge "dibuat lewat MCP" dan filter di History
dan Draft, yang butuh rancangan di Claude Design lebih dulu.

**7. Rate limit per workspace, berbasis Postgres** (tanpa Redis): 60
panggilan per menit, 30 aksi tulis per jam, 50 konten terjadwal per hari.
Angka disimpan sebagai konfigurasi.

**Di luar ADR ini:** hosting, transport, OAuth, dan pengikatan token ke
workspace diputuskan di **ADR-139** (Proposed, menunggu spike T-148).

### Reason

- Pengguna sudah punya AI pilihan sendiri. Membangun AI bawaan berarti
  menanggung biaya token, pemilihan provider, dan UI AI di Draft Editor,
  padahal nilai utamanya ada pada kemampuan AI bekerja langsung di dalam
  produk.
- Semua kemampuan yang dibutuhkan sudah ada sebagai Application Service
  (draft, jadwal, analytics, engagement). MCP tinggal menjadi entry point
  baru, sejalan dengan arsitektur modular monolith yang ada.
- Menunda `publish` dan `reply` serta mengecualikan aksi destruktif membuat
  tidak ada aksi yang langsung tampil publik tanpa jeda. Jadwal masih bisa
  dibatalkan manusia sebelum tayang. Antrian persetujuan manusia juga tidak
  diperlukan di MVP.
- Satu workspace per koneksi dan validasi ulang keanggotaan di tiap panggilan
  membatasi dampak token yang bocor atau member yang sudah dikeluarkan.

### Alternatives Considered

- **Mempertahankan AI Assistant bawaan.** Ditolak: biaya token dan provider
  harus ditanggung, dan pengguna tetap tidak bisa memakai AI pilihannya
  untuk bekerja di dalam aplikasi.
- **Membangun keduanya di v0.5.** Ditolak King Rezi: scope terlalu lebar.
- **Hanya read-only.** Ditolak King Rezi: ingin kemampuan penuh, dibatasi
  lewat scope dan penundaan aksi berisiko tinggi.
- **`publish` dan `reply` ikut MVP dengan antrian persetujuan atau eksekusi
  langsung.** Ditolak King Rezi: `reply` ditunda, `publish` ikut ditunda.
- **Satu koneksi untuk semua workspace pengguna.** Ditolak: cakupan izin
  terlalu lebar.
- **Batch tulis dibatasi satu konten per panggilan.** Ditolak King Rezi:
  batch boleh banyak konten (angka 10 per panggilan adalah asumsi kerja).

### Related

- Menggantikan keputusan produk "AI Assistant" di `mvp-definition.md`,
  `feature-priority.md`, `feature-modules.md`, `release-roadmap.md`, dan
  BC-04 di `domain-model.md`. Tidak mengamendemen ADR-017/018/019/031 yang
  bersifat umum (modular monolith, cross-domain, repository, Prisma).
- Bergantung pada: ADR-039 (`ContentFormat`), ADR-049 (Safety Check),
  ADR-074 (3 role), ADR-040 (batas engagement MVP).
- Dilanjutkan oleh ADR-139 (hosting dan auth MCP).
- Tiket: `tickets/v05-mcp-server-mvp.md` (T-060–T-065 digantikan, T-148
  dan seterusnya).
