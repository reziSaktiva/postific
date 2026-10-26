## Decision ADR-141

### Title

Baca Publik Start Page Lewat Fungsi `SECURITY DEFINER`, Bukan RLS Policy Anon (Mengubah Teks T-070.5)

### Status

Accepted

### Date

2026-10-26

### Decision

Teks T-070.5 menyebut "RLS policy akses anon" di `StartPagePage` dan `StartPageLink`. Implementasi memilih jalur lain: fungsi Postgres `public.start_page_get_public_by_slug(text)` dengan `SECURITY DEFINER`.

1. Fungsi hanya mengembalikan kolom yang aman untuk audiens anonim (tanpa `workspace_id`, `view_count`, `click_count`) dan hanya untuk halaman berstatus published. Urutan tautan `ORDER BY position, id`.
2. `REVOKE ALL ... FROM PUBLIC`, `anon`, dan `authenticated` (grant default Supabase, temuan F4; dipilih King Rezi 2026-10-26); `GRANT EXECUTE` hanya ke `app_runtime`. Tidak ada policy baru untuk `anon` maupun `app_runtime` di tabel Start Page.
3. Application Service memanggilnya lewat satu repository `IPublicStartPageRepository` (halaman dan tautan dalam satu query), bukan dua interface terpisah seperti di teks T-070.2.
4. Migrasi: `apps/web/prisma/migrations/20261026120000_t070_start_page_public_read_function`.
5. Cek uniqueness slug tidak dibuat di T-070.6 karena `slug` sudah `@unique`; jalur tulis slug masuk T-072. T-070.6 hanya format dan reserved words (panjang 3-40).

### Reason

- Policy `anon` membuka kebocoran kolom internal (`workspace_id`, `view_count`, `click_count`) lewat PostgREST (temuan Ridwan F1, HIGH). RLS tidak bisa membatasi kolom.
- Policy baca untuk `app_runtime` melemahkan isolasi tenant yang selama ini bergantung pada `workspace_id` (temuan F2).
- Fungsi `SECURITY DEFINER` dengan kolom terbatas mengikuti preseden t026, t048, t115. Primary check tetap di aplikasi (AU-D06).

### Alternatives Considered

- **RLS policy `anon` (teks T-070.5 asli).** Ditolak karena F1.
- **Policy untuk `app_runtime` pada tabel langsung.** Ditolak karena F2.
- **View dengan kolom terbatas.** Tidak dipilih; fungsi lebih konsisten dengan preseden dan grant eksplisit.

### Consequences

- **Belum terverifikasi:** migrasi belum di-apply di Supabase staging maupun asli; SQL hanya diuji di Postgres 16 lokal dengan role stub. Tipe kolom hasil `$queryRaw` di DB nyata belum dicek. Cek saat migrasi pertama kali di-apply di staging.
- F4 (REVOKE dari `anon`/`authenticated`) sudah diterapkan di migrasi; efeknya pada grant default Supabase asli baru terbukti saat apply di staging.
- Tes integrasi DB (LOW, F3) belum ada.

### Related

- ADR-128 (subpath `/u/[slug]`), ADR-129, ADR-130; preseden migrasi t026, t048, t115.
- Tiket: T-070 di `tickets/v06-start-page-mvp.md`.
