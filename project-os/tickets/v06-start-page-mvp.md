# v0.6 — Start Page MVP

> Bagian dari backlog berjenjang. Antrian: [`../AVAILABLE_TICKETS.md`](../AVAILABLE_TICKETS.md). Tiket selesai tetap di file ini. Deskripsi baru: ADR-131. Nama folder: ADR-132.

**Tujuan rilis:** Menyediakan halaman publik untuk kebutuhan bio link.
**Baseline rilis:** `product-discovery/02-product/release-roadmap.md` → v0.6

**Status rilis (2026-10-28):** T-070 sampai T-074 ✅ Done, kode dalam satu PR #200 (branch `feature/t-070-start-page-public-route`, belum di-merge). Review Ridwan PASS, QA Najwa PASS. **Belum terverifikasi di staging:** migrasi T-070, T-072, T-074 belum di-apply di Supabase; lihat T-164. Keputusan: ADR-141, ADR-142, ADR-143. Tiket lanjutan (T-159 sampai T-164) ada di bagian **Lanjutan** di bawah.

**Kedalaman dokumen ini:** T-070 sampai T-074 dicatat per hasil (retrospektif, bukan rencana). ID task dikunci agar bisa dirujuk.

**Titik awal (historis):** domain `start-page/` stub kosong; model `StartPagePage` + `StartPageLink` sudah ada di schema. Route `/start-page` dibangun langsung di `(app)/start-page` (ADR-076).

> ⚠️ **Karakter khusus rilis ini:** ini satu-satunya rilis yang menghasilkan **halaman publik tanpa autentikasi**. Seluruh arsitektur sekarang mengasumsikan setiap request melewati auth guard di `proxy.ts` dan berada di dalam workspace scope. Rilis ini melanggar asumsi itu, jadi butuh perhatian arsitektur lebih awal — lihat T-070.

---

### T-070 · Start Page domain skeleton + strategi route publik

`✅ Done` (2026-10-26; kode di PR #200, branch `feature/t-070-start-page-public-route`. Ridwan PASS, Najwa QA PASS) · **Domain** start-page · **ADR** ADR-017, ADR-024, ADR-031, ADR-128, ADR-141 · **Depends** T-002 ✅
**Baca dulu:** `05-architecture/auth-architecture.md` · `apps/web/src/proxy.ts` · `05-architecture/database-strategy.md` · ADR-128

Service + repository, plus keputusan arsitektur: di mana route publik hidup, bagaimana ia melewati auth guard, bagaimana RLS diperlakukan untuk data yang memang publik, dan apakah pakai custom domain atau subpath. **Keputusan arsitektur sudah dikunci di ADR-128 (2026-10-16): subpath `/u/[slug]`, bukan custom domain** — subtask di bawah mengikuti keputusan itu.

**Subtask:**

- **T-070.1 — ADR strategi routing publik** · ✅ Done (ADR-128, 2026-10-16)
  Dokumentasikan keputusan subpath `/u/[slug]` vs custom domain.

- **T-070.2 — Repository interface publik** · ✅ Done
  `StartPagePageRepository` / `StartPageLinkRepository`: query by `slug`
  yang hanya mengembalikan field aman untuk audiens anonim (tanpa data
  internal workspace).
  Deviasi: satu interface `IPublicStartPageRepository` (halaman + tautan lewat satu query), bukan dua.

- **T-070.3 — Application Service `GetPublicStartPageBySlug`** · ✅ Done
  Use-case murni tanpa dependency session/workspace context — dipanggil
  dari route publik, bukan dari area yang dijaga Middleware.

- **T-070.4 — Bypass route `/u/[slug]` di `proxy.ts`** · ✅ Done
  Tambah ke `BYPASS_PREFIXES` (pola sama `/invite/[token]`), bukan ke
  `PUBLIC_AUTH_PATHS` (supaya tidak redirect user yang sudah login ke `/`).
  Server Component halaman publik resolve data lewat T-070.3.

- **T-070.5 — RLS policy akses anon** · ✅ Done (dengan deviasi, ADR-141)
  Teks asli: policy baca publik di `StartPagePage`/`StartPageLink` (hanya row
  berstatus "published"), tetap application-enforced sebagai primary check
  (AU-D06) — RLS sebagai defense-in-depth.
  **Deviasi (ADR-141):** bukan policy anon, melainkan fungsi `SECURITY DEFINER`
  `public.start_page_get_public_by_slug(text)` (hanya kolom aman; REVOKE dari
  PUBLIC, `anon`, `authenticated`; GRANT EXECUTE hanya `app_runtime`; `ORDER BY position, id`). Policy anon
  membuka `workspace_id`/`view_count`/`click_count` lewat PostgREST (Ridwan F1 HIGH),
  policy `app_runtime` melemahkan isolasi tenant (F2).
  **Belum terverifikasi:** migrasi belum di-apply di Supabase staging/asli; SQL
  hanya diuji di Postgres 16 lokal dengan role stub; tipe kolom hasil `$queryRaw`
  di DB nyata belum dicek. Cek saat migrasi pertama kali di-apply di staging.
  Catatan LOW: F3 tes integrasi DB belum ada; F4 `REVOKE EXECUTE` dari
  `anon`/`authenticated` sudah diterapkan (keputusan King Rezi 2026-10-26); efeknya
  di Supabase asli baru terbukti saat apply di staging.

- **T-070.6 — Slug validation & reserved words** · ✅ Done
  Format slug, cek uniqueness, dan daftar reserved path (`/u/login`,
  `/u/api`, dst.) supaya tidak bentrok dengan route lain.
  Deviasi: cek uniqueness tidak dibuat (slug sudah `@unique`; jalur tulis slug
  masuk T-072). Yang dibuat: format + reserved words, panjang 3-40.

- **T-070.7 — Test akses publik tanpa session** · ✅ Done
  Verifikasi `/u/[slug]` bisa diakses tanpa cookie session sama sekali
  (curl langsung, bukan hanya browser login) — pola sama seperti bug
  webhook T-026 yang ditemukan lewat curl asli.
  Hasil QA: 59 tes terkait lolos; curl tanpa cookie ke `/u/*` tidak redirect ke
  `/login`, kontrol `/dashboard` 307; typecheck 0 error. Suite penuh: 5 tes + 6
  file gagal, sama persis dengan baseline `origin/staging` (DB tidak terjangkau).
  Route `/u/[slug]` saat itu markup placeholder; tampilan final dikerjakan di T-071.

### T-071 · Public profile page

`✅ Done` (2026-10-28; PR #200, belum di-merge. Ridwan PASS, Najwa QA PASS) · **Domain** start-page · UI · **ADR** ADR-046, ADR-129, ADR-142, ADR-143 · **Depends** T-070 ✅
**Baca dulu:** `04-ux/key-screen-patterns.md` · `04-ux/information-architecture.md` · ADR-129 · artifact Postific `project/templates/start-page-option-b-card-stack.html` (LOCKED PATTERN)

**Must Have.** Halaman publik yang bisa dibagikan lewat media sosial: pola **Card Stack** (ADR-129), header horizontal, tautan sebagai card, badge "Powered by Postific".

**Hasil:**

- Halaman `/u/[slug]` (`components/start-page/StartPageProfile.tsx`), render dinamis per request, tema lewat preset (T-073).
- Metadata, Open Graph, canonical, dan robots (halaman tidak ada atau draft menjadi 404 `noindex`).
- Header keamanan di `next.config.ts` (`X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Referrer-Policy`). **CSP penuh belum**: T-160.
- Prasyarat dari review T-070 terpenuhi: `link.url` dan `avatarUrl` divalidasi `new URL()` hanya http/https, `rel="noopener noreferrer nofollow ugc"` + `target="_blank"`, allowlist `theme`.
- Href tautan = `/u/[slug]/go/[linkId]` (redirect hitung klik, T-074).

**Deviasi dan keputusan (King Rezi):** `<a>` di dalam `Card` karena `card.tsx` tidak punya `asChild`. Ikon platform memakai `hugeicons` monokrom, menyimpang sadar dari ADR-058 poin 6 (ADR-143). **Belum terverifikasi:** `next build` belum dijalankan; `Cache-Control` produksi belum diuji; tidak ada tes browser di staging.

### T-072 · Link management

`✅ Done` (2026-10-28; PR #200, belum di-merge. Ridwan PASS setelah F1 HIGH diperbaiki, Najwa QA PASS) · **Domain** start-page · UI · **ADR** ADR-130, ADR-143 · **Depends** T-070 ✅
**Baca dulu:** `02-product/mvp-definition.md` · ADR-130 · artifact Postific `project/templates/start-page-editor.html` (LOCKED, App Prototype)

**Must Have.** CRUD daftar tautan + urutan tampil, di layar "Start Page → Page Editor" (ADR-130: Profil Halaman, Link List sebagai Table tanpa header, Preview, Share).

**Hasil:**

- Jalur tulis workspace-scoped: service, RBAC (Owner, Admin, Creator; ADR-074), validasi, Server Actions di `app/(app)/start-page/actions.ts`.
- Satu halaman per workspace: migrasi `20261026130000_t072_start_page_unique_workspace` (`UNIQUE(workspace_id)`).
- CRUD tautan (form = Dialog), hapus dengan dialog konfirmasi, reorder (drag dan keyboard), Publish/Unpublish, Share.
- Profil: tombol Simpan dengan draft staged, Preview mengikuti draft; foto profil = input URL https + pratinjau (upload ditunda: T-159).
- Slug: panjang 3-40, reserved words, normalisasi lowercase; `url` tautan hanya http/https, `avatarUrl` hanya https. Pesan error domain berbahasa Indonesia.

**Prasyarat apply migrasi UNIQUE di staging (Ridwan F6):** jalankan dulu `SELECT workspace_id, count(*) FROM start_page_pages GROUP BY 1 HAVING count(*) > 1`; bila ada baris, bereskan duplikat sebelum apply.

**Deviasi desain minor:** rancangan terkunci memakai upload avatar (implementasi: URL https); slug, tombol Simpan, dan state "Buat Halaman" belum punya rancangan terkunci di artifact. **Catatan minor QA (M4):** posisi tautan tidak dipadatkan setelah hapus (T-162). **Belum terverifikasi:** `P2025` hanya lewat mock; migrasi belum di-apply di staging. Keputusan: ADR-143.

### T-073 · Theme configuration

`✅ Done` (2026-10-28; PR #200, belum di-merge. Ridwan PASS, Najwa QA PASS) · **Domain** start-page · UI · **ADR** ADR-038, ADR-041, ADR-143 · **Depends** T-071 ✅
**Baca dulu:** `06-engineering/design-tokens.md`

Berstatus **Should Have** di `feature-priority.md`. Pertanyaan tiket (token yang sama atau set sendiri) dijawab: **preset terbatas turunan token produk**.

**Hasil:**

- Enum allowlist `default | dark | accent` (`START_PAGE_THEMES`); nilai lain jatuh ke `default`.
- Selector `ToggleGroup` di Page Editor; Preview ikut tema.
- `default` ikut tema aplikasi; `dark` memaksa scope dark; `accent` netral tanpa hue (inversi primary Stone). **Tanpa token baru.** Rancangan LOCKED di artifact Postific (King Rezi, 2026-10-26).
- Kontras diuji di `start-page-theme.test.ts`.

**Catatan:** token bersama `muted-foreground` mode light hanya 3,4 sampai 3,8:1 (di bawah AA 4,5:1), jadi teks sekunder di tema light belum memenuhi AA: T-163 (butuh keputusan token). `project/styles.css` artifact Postific masih memuat blok DRAFT lama (Aksen hijau) di atas blok netral sehingga galeri menampilkan Aksen hijau: T-161.

### T-074 · Basic analytics Start Page

`✅ Done` (2026-10-28; PR #200, belum di-merge. Ridwan PASS, Najwa QA PASS) · **Domain** start-page · **ADR** ADR-018, ADR-142, ADR-143 · **Depends** T-071 ✅, T-040
**Baca dulu:** `02-product/feature-priority.md`

Berstatus **Could Have** — hitungan kunjungan + klik per tautan. **Deviasi dari teks asli:** dikerjakan sebagai counter sederhana di domain `start-page` (bukan lintas domain `analytics`, tanpa tabel event, tanpa PII), karena counter hanya milik halaman publik (ADR-142).

**Hasil:**

- Migrasi `20261026133000_t074_start_page_analytics_functions`: fungsi `SECURITY DEFINER` `start_page_record_view` dan `start_page_record_click_and_get_url`; EXECUTE hanya `app_runtime`, REVOKE dari `PUBLIC`/`anon`/`authenticated`.
- Klik lewat route redirect 302 `/u/[slug]/go/[linkId]` (`Cache-Control: no-store`, `X-Robots-Tag: noindex`); bot dan `HEAD` pada route klik tidak dihitung (heuristik user-agent); tanpa dedup dan rate limit.
- Tampil hanya di Page Editor: kunjungan di page-head, klik per tautan di meta Link List. Format id-ID penuh di bawah 10.000, ringkas mulai 10.000; tanpa data tampil `0` + petunjuk.

**Catatan LOW (Ridwan):** F3 counter tanpa rate limit; F4 klik terhitung tapi bisa 404; F8 `search_path` tanpa `pg_temp` (konsisten dengan migrasi lain). **Catatan minor QA:** M1 `HEAD` ke `/u/<slug>` dengan UA browser menaikkan `view_count` (Next merender `HEAD` sebagai `GET`); M3 fungsi baca publik tidak menyaring skema url (aplikasi menyaring). Perbaikannya opsional: T-162. **Belum terverifikasi:** migrasi belum di-apply di Supabase; grant default `anon`/`authenticated` Supabase asli belum diuji; tidak ada tes integrasi DB di CI. QA lokal (Postgres 16, role stub, `app_runtime` non-BYPASSRLS) membuktikan RLS dan fungsi.

---

## Lanjutan (dari review dan QA T-070 sampai T-074)

Tiket di bawah lahir dari temuan review Ridwan, QA Najwa, dan Mark. Semuanya di file rilis ini, bukan `known-issues.md`: bukan Known Issue (tidak ada bug yang merusak MVP), melainkan lanjutan fitur dan hutang kecil rilis v0.6 (ADR-134 menyisihkan `known-issues.md` untuk tiket yang lahir sebagai pelacak KI). Kalau salah satunya kelak dinaikkan jadi KI, pindahkan ke `known-issues.md`.

### T-159 · Upload foto profil Start Page lewat Storage/Media

`⏳ Not Started` · **Domain** start-page, media · UI · **ADR** ADR-143, ADR-071 · **Depends** T-072 ✅
**Baca dulu:** `05-architecture/database-strategy.md` § Storage (bucket `avatars`) · ADR-071 · artifact Postific `project/templates/start-page-editor.html` (rancangan memakai upload)

Ganti input URL https dengan upload. Supabase JS client hanya untuk Storage (AGENTS.md aturan 6). Pertahankan validasi `avatarUrl` https di sisi render. Gate UI: baca artifact sebelum kode; bila pola upload yang dirancang belum cukup konkret, hentikan dan tanya King Rezi.

### T-160 · CSP penuh dengan nonce untuk `/u/*`

`⏳ Not Started` · **Domain** start-page · infra (`next.config.ts`, `proxy.ts`) · **ADR** ADR-143 · **Depends** T-071 ✅
**Baca dulu:** `06-engineering/rendering-strategy.md` § RS-D08

Saat ini hanya `frame-ancestors 'none'` + `X-Frame-Options` + `Referrer-Policy`. Tambah CSP penuh berbasis nonce per request untuk rute publik (nonce untuk inline script Next.js), tanpa merusak render dinamis. Uji dengan `next build` dan browser nyata.

### T-161 · Bersihkan blok DRAFT lama di `project/styles.css` artifact Postific

`⏳ Not Started` · **Domain** design (artifact desain) · **ADR** ADR-140, ADR-143 · **Depends** T-073 ✅
**Baca dulu:** `.claude/skills/claude-design-scope-discipline/SKILL.md` · `context/ctx-design.md`

Blok DRAFT lama (Aksen hijau dari trio success) masih ada di atas blok netral, sehingga galeri menampilkan Aksen hijau padahal rancangan LOCKED menyebut netral. Dikerjakan Neymar Product Designer, hanya menghapus blok lama, tanpa mengubah rancangan terkunci dan tanpa kontrol pembanding baru.

### T-162 · Perbaikan kecil counter dan data Start Page (opsional, prioritas rendah)

`⏳ Not Started` · **Domain** start-page · **ADR** ADR-142, ADR-143 · **Depends** T-074 ✅
**Baca dulu:** ADR-142 § Consequences

Pilih sebagian atau semua; masing-masing berdiri sendiri:

- [ ] **T-162.1** `HEAD` ke `/u/<slug>` tidak menghitung view (QA M1).
- [ ] **T-162.2** Padatkan `position` tautan setelah hapus (QA M4).
- [ ] **T-162.3** Fungsi baca publik `start_page_get_public_by_slug` menyaring skema url (QA M3); butuh migrasi baru.
- [ ] **T-162.4** Rate limit atau dedup counter (Ridwan F3). Menyimpan identifier menyentuh PII, jadi butuh ADR baru sebelum dikerjakan.

Tidak dikerjakan di sini: F4 (klik terhitung tapi bisa 404) dan F8 (`pg_temp`) diterima sebagai LOW.

### T-163 · Token `muted-foreground` mode light memenuhi kontras AA

`⏳ Not Started` · **Domain** design tokens, UI (seluruh produk) · **ADR** ADR-087, ADR-143 · **Depends** keputusan King Rezi
**Baca dulu:** `06-engineering/design-tokens.md` § Engineering Mapping (DT-D06)

`--muted-foreground` light (`#83838a`, dipetakan 1:1 dari Stone, ADR-087) hanya 3,4 sampai 3,8:1 di atas latar yang dipakai, di bawah AA 4,5:1. Efeknya seluruh produk, bukan hanya Start Page. **Butuh keputusan King Rezi** untuk nilai baru (menyimpang dari pemetaan Stone, kemungkinan perlu ADR). Urutan: Neymar mengusulkan nilai di artifact, King Rezi mengonfirmasi, update `design-tokens.md`, lalu Mark mengubah `globals.css`.

### T-164 · Verifikasi staging Start Page: apply migrasi dan uji publik end-to-end

`⏳ Not Started` · **Domain** start-page · infra · **ADR** ADR-141, ADR-142, ADR-143 · **Depends** PR #200 di-merge ke `staging`
**Baca dulu:** ADR-141 § Consequences · ADR-142 § Consequences · T-072 (prasyarat F6)

Tiket ini mencatat verifikasi yang belum dilakukan; tanpanya definisi selesai rilis ("pengguna dapat membagikan halaman publik") belum terbukti.

- [ ] **T-164.1** Jalankan query duplikat `start_page_pages` (T-072, F6), lalu apply tiga migrasi (T-070, T-072, T-074) di Supabase staging
- [ ] **T-164.2** Cek tipe kolom hasil `$queryRaw` dan grant `anon`/`authenticated` Supabase asli (harus tidak bisa memanggil ketiga fungsi)
- [ ] **T-164.3** `curl` tanpa cookie ke `/u/<slug>` dan `/u/<slug>/go/<linkId>` di staging: tidak redirect ke `/login`, redirect 302, `Cache-Control` sesuai
- [ ] **T-164.4** Uji `next build` dan jalur `P2025` (selama ini hanya mock)
- [ ] **T-164.5** Browser: buat halaman, tambah tautan, publish, buka sebagai anonim, klik tautan, cek counter di Page Editor

---

## Catatan Rilis

- T-075–T-079 sengaja dikosongkan sebagai ruang penambahan task v0.6. Lanjutan memakai ID global berikutnya (T-159 sampai T-164), bukan ID dalam rentang ini.
- **Definition of Done rilis ini:** pengguna dapat membagikan halaman publik melalui media sosial.
- **Yang sengaja di luar rilis ini (`feature-priority.md`):** E-commerce Widgets (Won't Have).
