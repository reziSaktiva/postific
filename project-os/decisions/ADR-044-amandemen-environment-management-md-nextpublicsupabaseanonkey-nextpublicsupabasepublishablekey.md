## Decision ADR-044

### Title

Amandemen `environment-management.md` — `NEXT_PUBLIC_SUPABASE_ANON_KEY` →
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### Status

Accepted

### Date

2026-07-24

### Decision

Nama env var client-side Supabase diubah dari `NEXT_PUBLIC_SUPABASE_ANON_KEY`
menjadi `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` di seluruh dokumentasi dan
kode (`environment-management.md`, `apps/web/.env.example`,
`apps/web/src/lib/env.ts`, `apps/web/src/lib/supabase/client.ts`). Nilainya
tetap dipakai sebagai argumen kedua `createClient()` dari `@supabase/supabase-js`
(browser client Realtime/Storage saja, DO-D02) — tidak ada perubahan
behavior, hanya penyesuaian nama variable.

### Reason

- Supabase memperkenalkan sistem API key baru (`sb_publishable_...` /
  `sb_secret_...`) yang menggantikan istilah `anon` / `service_role` secara
  bertahap; project baru (dibuat setelah rollout ini) menampilkan
  "Publishable key" sebagai default di dashboard, bukan lagi "anon key".
- Project Supabase Cloud `social-media-local` (dibuat 2026-07-24, M8
  bootstrap) sudah memakai sistem baru ini, sehingga mengikuti nama var lama
  akan membingungkan saat isi `.env.local` — Project Owner tidak menemukan
  field "anon key" di dashboard.
- `service_role` key legacy tetap dipakai apa adanya (masih ada di tab
  "Legacy API Keys"); amandemen ini hanya menyentuh key publik client-side.

### Alternatives Considered

- Pertahankan nama `NEXT_PUBLIC_SUPABASE_ANON_KEY` dan minta Project Owner
  mengisi value dari "Legacy API Keys" tab — ditolak; legacy anon/service_role
  keys dijadwalkan Supabase untuk deprecated akhir 2026, tidak ideal
  membangun fondasi M8 di atas sistem yang akan dihapus.
- Dukung kedua nama var sekaligus (fallback) — ditolak; menambah percabangan
  yang tidak perlu untuk kasus yang bisa diselesaikan dengan rename
  langsung, bertentangan dengan prinsip "no backwards-compat shim" project
  ini.

---
