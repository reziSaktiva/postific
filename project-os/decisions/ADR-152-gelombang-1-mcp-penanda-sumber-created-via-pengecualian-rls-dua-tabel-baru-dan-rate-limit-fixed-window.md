## Decision ADR-152

### Title

Gelombang 1 MCP: Penanda Sumber `created_via` pada `publishing_posts`, Pengecualian RLS ADR-141 untuk Dua Tabel Baru, dan Rate Limit Fixed Window dengan Error di Hasil Tool

### Status

**Proposed — menunggu persetujuan King Rezi.** Belum berlaku sampai King Rezi menyetujui; sebelum itu migrasi dan kode T-151, T-152, T-154 berstatus usulan terhadap baseline. Bila disetujui, ubah status menjadi `Accepted` (di file ini dan di tabel `DECISIONS.md`).

### Date

2026-10-30

### Context

Gelombang 1 v0.5 (T-151, T-152, T-154) menambah tiga migrasi dan keputusan yang menyentuh baseline (`database-strategy.md` BC-03/BC-04, ADR-141), jadi butuh ADR (`AGENTS.md` aturan 2). Kode dan migrasi sudah ditulis di branch `feature/mcp-v05-gelombang-1`, tetapi **belum diterapkan ke DB mana pun**; ADR ini dibuka lebih dulu supaya keputusannya bisa ditolak atau diubah sebelum `db:deploy` ke staging.

### Decision

**1. Penanda sumber di `publishing_posts` (T-152).**

- Kolom `created_via TEXT NOT NULL DEFAULT 'app'` (nilai `app | mcp`) dan `created_via_client_id TEXT NULL` (`clientId` OAuth klien AI; tanpa FK).
- CHECK `publishing_posts_created_via_check` menjaga pasangan: `app` wajib tanpa client id, `mcp` wajib dengan client id.
- Nilainya `app`, bukan `manual` (mengikuti `database-strategy.md` BC-04 dan ADR-138 poin 6).
- `update_draft` lewat MCP **tidak** mengubah penanda sumber. Draft buatan manusia (`app`) yang diedit AI tetap berlabel `app`; jejak penyuntingan AI hanya ada di `mcp_audit_logs` (retensi 90 hari). **Perlu konfirmasi King Rezi** bahwa ini sesuai maksud ADR-138 poin 6 (saran review Ridwan #6).
- Tidak ada indeks pada `created_via`. T-157 (badge dan filter sumber) kemungkinan butuh `(workspace_id, created_via)`; diputuskan di T-157 atau T-180 saat ada ukuran datanya.

**2. Pengecualian RLS ADR-141 diperluas ke dua tabel BC-04 baru (T-151, T-154).**

`mcp_rate_limit_windows` dan `mcp_workspace_choices` memakai pola ADR-141 yang sama dengan `mcp_grants` dan `mcp_audit_logs`: `ENABLE ROW LEVEL SECURITY` dan satu policy `FOR ALL TO "app_runtime" USING (true) WITH CHECK (true)` (dijaga `IF EXISTS` pada `pg_roles`) dalam **satu migrasi**; `anon` dan `authenticated` default-deny; isolasi hanya di application layer. Alasannya sama dengan ADR-141: pemanggil memakai token OAuth atau hook consent tanpa `app.current_user_id`, dan jalur sistem (pembersihan JOB-08) tidak punya pengguna. ADR-141 hanya menyebut dua tabel pertama, jadi cakupannya diperluas lewat ADR ini (temuan review Ridwan).

**3. Rate limit per workspace (T-154): fixed window, error di hasil tool.**

- Fixed window 60 detik (panggilan), 1 jam (aksi tulis), dan 1 hari (konten terjadwal), semuanya kelipatan epoch UTC. Kuota harian reset 00:00 UTC (07:00 WIB). Konsekuensi yang diterima: dua jendela bersebelahan bisa memuat sampai 2x batas.
- Penghitung atomik satu statement `INSERT ... ON CONFLICT DO UPDATE ... WHERE count + n <= limit`; penolakan tidak menaikkan penghitung. Fail-closed bila penghitung gagal.
- Batas bawaan 60 calls/menit, 30 write_actions/jam, 50 scheduled_contents/hari (angka dikonfirmasi King Rezi 2026-10-26, lihat T-154), dapat diubah lewat env tanpa ubah kode.
- Penolakan dikembalikan sebagai error MCP `rate_limited` di hasil tool (JSON dengan `retryAfterSeconds`, `quota`, `limit`), **bukan** header HTTP `Retry-After`, karena transport Streamable HTTP membalas HTTP 200 dengan JSON-RPC. **Perlu konfirmasi King Rezi.**

### Reason

- Badge dan filter sumber (T-157) butuh sumber yang bisa di-query langsung dari `publishing_posts`; audit log dipurge 90 hari dan join ke sana tidak bisa dipakai untuk riwayat lama.
- Pola ADR-141 sudah disetujui untuk kondisi yang identik, dan RLS tetap menutup akses `anon`/`authenticated`; memakai pola berbeda untuk dua tabel baru tanpa alasan akan menambah kerja dan risiko.
- Fixed window dengan upsert atomik sederhana, murah di Postgres (tanpa Redis; ADR-138 poin 7), dan mudah diuji; presisi sliding window tidak sebanding untuk batas yang tujuannya mencegah penyalahgunaan, bukan billing.

### Alternatives Considered

- **Penanda sumber: enum Postgres.** Ditolak: menambah nilai berarti migrasi `ALTER TYPE`; `TEXT` + CHECK cukup untuk dua nilai.
- **Penanda sumber: FK ke tabel klien plugin OAuth.** Ditolak: tabel plugin tidak diubah bentuknya dan klien bisa dihapus (ADR-139); client id disalin sebagai teks.
- **Penanda sumber: hanya audit.** Ditolak: audit dipurge 90 hari dan bukan sumber query untuk daftar.
- **Rate limit sliding window / token bucket.** Ditolak untuk MVP: butuh banyak baris atau perhitungan di aplikasi; fixed window cukup.
- **`Retry-After` di header HTTP.** Ditolak: respons HTTP selalu 200 untuk JSON-RPC; AI klien membaca hasil tool, bukan header.
- **Isolasi per workspace lewat policy RLS untuk dua tabel baru.** Ditolak dengan alasan yang sama seperti ADR-141.

### Consequences

- Safety net DB-D05 tidak berlaku untuk `mcp_rate_limit_windows` dan `mcp_workspace_choices`; tes unit isolasi di repository tetap wajib.
- Kode error MCP bertambah: `conflict` dan `rate_limited`; `invalid_input` juga dipakai untuk `ValidationError` dan `PublishingDomainError` (dicatat di `application-layer.md`).
- JOB-08 kini membersihkan tiga hal: audit, jendela rate limit kedaluwarsa, dan pilihan workspace kedaluwarsa.
- Bila ADR ini ditolak atau diubah, tiga migrasi (`20261030100000_t152_publishing_posts_created_via`, `20261030110000_t154_mcp_rate_limit_windows`, `20261030120000_t151_mcp_workspace_choices`) harus disesuaikan **sebelum** diterapkan ke staging.

### Related

- Mengamandemen cakupan ADR-141 (menambah dua tabel; ADR-141 tidak diubah isinya, hanya tag status). Lanjutan ADR-138 (poin 6 penanda sumber, poin 7 rate limit) dan ADR-139.
- Dokumen: `product-discovery/05-architecture/database-strategy.md` § BC-04, `application-layer.md` § McpAccessService.
- Tiket: T-151, T-152, T-154, T-157, T-180 (`tickets/v05-mcp-server-mvp.md`).
