## Decision ADR-030

### Title

Auth Implementation — Better Auth Config + Supabase JWT Integration untuk Realtime

### Status

Accepted

### Date

2026-07-17

### Decision

Detail implementasi autentikasi (M6) yang menkonkretkan ADR-024:

- **Better Auth** menyimpan data auth di Supabase PostgreSQL yang sama (prefix `identity_`), diakses via Prisma adapter + `DATABASE_URL` (lihat ADR-031).
- **Database session** (token opaque di cookie) — bukan JWT stateless-only — agar sesi dapat direvokasi.
- **Dual-context RLS:** akses data server-side memakai Prisma + session variable `app.current_user_id` (DB-D05, ADR-031); jalur Supabase Realtime memakai **JWT Supabase-compatible** yang diterbitkan Better Auth (HS256, di-sign dengan `SUPABASE_JWT_SECRET`, `sub = userId`) agar `auth.uid()` valid.
- **OAuth client & redirect URI terpisah** per environment.
- Password reset & email verification bergantung pada transactional email provider yang **belum ditetapkan** (dependency terbuka).

Detail lengkap: `product-discovery/06-engineering/auth-strategy.md` (AS-D01 s/d AS-D05).

### Reason

- Menyediakan `auth.uid()` untuk RLS Realtime tanpa memindahkan seluruh auth ke Supabase Auth (yang bertentangan dengan ADR-024).
- Database session memungkinkan revokasi (logout, hapus device) — lebih aman dari JWT stateless.
- Menjaga service role key tetap di server; JWT client hanya untuk otorisasi channel Realtime.
- Kredensial OAuth terpisah per environment mencegah salah routing callback.

### Alternatives Considered

- Pindah ke Supabase Auth agar `auth.uid()` otomatis tersedia — bertentangan dengan ADR-024 (Better Auth).
- JWT stateless-only untuk session — tidak dapat direvokasi sebelum expiry.
- Polling manual untuk notifikasi alih-alih Realtime — menghapus manfaat real-time in-app notification (ADR-023).
- Menetapkan email provider sekarang — keputusan prematur di luar scope auth core.

---
