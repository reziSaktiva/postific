## Decision ADR-143

### Title

Counter Kunjungan dan Klik Anonim Start Page Lewat Fungsi `SECURITY DEFINER` dan Redirect Klik 302 (T-074; Memperluas ADR-142 ke Jalur Tulis)

### Status

Accepted

### Date

2026-10-28

### Decision

ADR-142 hanya mencakup jalur **baca** anonim. T-074 menambah jalur **tulis** anonim: dua counter sederhana di domain `start-page`, bukan domain `analytics` dan bukan tabel event. Keputusan King Rezi, 2026-10-28.

1. **Dua fungsi Postgres `SECURITY DEFINER`** (migrasi `apps/web/prisma/migrations/20261026133000_t074_start_page_analytics_functions`):
   - `public.start_page_record_view(p_slug text) RETURNS boolean`: `view_count + 1` bila halaman published.
   - `public.start_page_record_click_and_get_url(p_slug text, p_link_id uuid) RETURNS text`: atomik, hanya untuk tautan **aktif** milik halaman **published** dengan slug itu dan url berskema http(s); `click_count + 1`, mengembalikan url. Selain itu `NULL` tanpa efek.
   - `updated_at` sengaja tidak disentuh (counter bukan perubahan konten).
2. **Hak akses sama dengan ADR-142:** `REVOKE ALL` dari `PUBLIC`, `anon`, `authenticated`; `GRANT EXECUTE` hanya ke `app_runtime`. Tidak ada policy RLS baru, tidak ada tabel baru.
3. **Tanpa PII dan tanpa tabel event.** Hanya dua kolom counter yang sudah ada (`start_page_pages.view_count`, `start_page_links.click_count`). Tidak ada IP, user-agent, referrer, atau timestamp per kejadian yang disimpan.
4. **Klik lewat redirect 302** `/u/[slug]/go/[linkId]` (Route Handler). Href tautan di halaman publik menunjuk ke route ini, bukan langsung ke URL tujuan. Respons memakai `Cache-Control: no-store` dan `X-Robots-Tag: noindex, nofollow`. Aplikasi memvalidasi ulang URL dengan `new URL()` (http/https) sebelum redirect; fungsi SQL menyaring skema sebagai defense-in-depth.
5. **Filter bot dan HEAD:** user-agent yang cocok heuristik bot tidak dihitung (kunjungan maupun klik), dan `HEAD` ke route klik tidak dihitung. Ini heuristik, bukan jaminan.
6. **Tanpa dedup dan tanpa rate limit.** Satu request yang lolos filter = +1. Angka adalah indikasi kasar, bukan metrik andal.
7. **Tampil hanya di Page Editor** (lihat ADR-144), tidak di halaman publik.

### Reason

- Halaman publik dan route klik diakses tanpa session, jadi tidak ada `app.current_user_id` untuk RLS `workspace_isolation`. Fungsi `SECURITY DEFINER` dengan penulisan sempit mengikuti preseden ADR-142, ADR-099, dan migrasi t026/t048/t115, tanpa membuka tabel lewat PostgREST.
- Counter di kolom yang sudah ada menjaga scope Could Have (`feature-priority.md`) tetap kecil: tanpa tabel event, tanpa retensi data, tanpa PII, tanpa kebijakan privasi tambahan.
- Redirect server-side memungkinkan hitung klik tanpa JavaScript di halaman publik dan tanpa endpoint beacon.
- Update dan pengembalian url dalam satu statement mencegah klik terhitung untuk tautan yang tidak valid, dan menghindari dua round trip.

### Alternatives Considered

- **Tabel event per kunjungan/klik.** Ditolak: butuh retensi, privasi, dan agregasi; di luar scope MVP.
- **Domain `analytics` dan lintas domain lewat public API.** Ditolak: T-074 awalnya menyebut lintas domain, tetapi counter ini murni milik halaman publik dan tidak butuh data domain lain.
- **Beacon/`sendBeacon` dari klien.** Ditolak: butuh JavaScript di halaman publik, mudah dipalsukan, dan tidak lebih akurat.
- **Rate limit atau dedup per IP/cookie sekarang.** Ditunda: butuh menyimpan identifier (menyentuh PII) atau infrastruktur baru. Dicatat sebagai tiket lanjutan opsional (T-162).

### Consequences

- **Counter bisa digelembungkan** oleh siapa pun yang bisa memanggil URL publik (Ridwan F3, LOW). Angka bukan metrik andal.
- **Klik terhitung tapi bisa 404** bila tautan berubah antara hitung dan redirect (Ridwan F4, LOW).
- `HEAD` ke `/u/<slug>` menaikkan `view_count` karena Next.js 16 merender `HEAD` sebagai `GET` sehingga method tak bisa dicek (QA Najwa M1). Diperbaiki di T-162.1 (2026-10-28): view hanya dihitung bila `Sec-Fetch-Dest: document` dan `Sec-Fetch-Mode: navigate`, fail-closed. Batasan: Safari <16.4, http non-secure selain localhost, dan sebagian in-app browser tidak terhitung; header bisa dipalsukan, jadi ini heuristik. Rasio view terhadap klik dipantau setelah rilis (T-164.6).
- Fungsi memakai `SET search_path = public` tanpa `pg_temp`, konsisten dengan migrasi lain (Ridwan F8, LOW).
- **Belum terverifikasi:** migrasi belum di-apply di Supabase staging maupun asli; grant default `anon`/`authenticated` Supabase asli belum diuji; tidak ada tes integrasi DB di CI. QA lokal (Postgres 16, role stub, `app_runtime` non-BYPASSRLS) membuktikan fungsi dan hak akses. `Cache-Control` produksi belum diuji (`next build` belum dijalankan).
- Rate limit/dedup (T-162.4) butuh ADR baru. Perbaikan HEAD: T-162 di `tickets/v06-start-page-mvp.md`.

### Related

- ADR-142 (jalur baca anonim, diperluas oleh ADR ini), ADR-128 (subpath `/u/[slug]`), ADR-144 (keputusan UI dan produk v0.6), ADR-099 (preseden `SECURITY DEFINER`).
- Tiket: T-074 di `tickets/v06-start-page-mvp.md`.
