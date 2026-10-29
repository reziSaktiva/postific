# v0.6 — Start Page MVP

> Bagian dari backlog berjenjang. Antrian: [`../AVAILABLE_TICKETS.md`](../AVAILABLE_TICKETS.md). Tiket selesai tetap di file ini. Deskripsi baru: ADR-131. Nama folder: ADR-132.

**Tujuan rilis:** Menyediakan halaman publik untuk kebutuhan bio link.
**Baseline rilis:** `product-discovery/02-product/release-roadmap.md` → v0.6

**Status rilis (2026-10-28):** T-070 sampai T-074 ✅ Done, kode di PR #200 (ter-merge ke `staging`). T-159 ✅ Done (PR #203, ter-merge). Review Ridwan PASS, QA Najwa PASS untuk T-070–T-074. **Terverifikasi di staging** (T-164 ✅, 2026-10-28): keempat migrasi sudah ter-apply di Supabase. Keputusan: ADR-142, ADR-143, ADR-144. Tiket lanjutan yang masih terbuka: T-166, T-167, T-171 (T-162.4 butuh ADR).

**Kedalaman dokumen ini:** T-070 sampai T-074 dicatat per hasil (retrospektif, bukan rencana). ID task dikunci agar bisa dirujuk.

**Titik awal (historis):** domain `start-page/` stub kosong; model `StartPagePage` + `StartPageLink` sudah ada di schema. Route `/start-page` dibangun langsung di `(app)/start-page` (ADR-076).

> ⚠️ **Karakter khusus rilis ini:** ini satu-satunya rilis yang menghasilkan **halaman publik tanpa autentikasi**. Seluruh arsitektur sekarang mengasumsikan setiap request melewati auth guard di `proxy.ts` dan berada di dalam workspace scope. Rilis ini melanggar asumsi itu, jadi butuh perhatian arsitektur lebih awal — lihat T-070.

---

### T-070 · Start Page domain skeleton + strategi route publik

`✅ Done` (2026-10-26; kode di PR #200, branch `feature/t-070-start-page-public-route`. Ridwan PASS, Najwa QA PASS) · **Domain** start-page · **ADR** ADR-017, ADR-024, ADR-031, ADR-128, ADR-142 · **Depends** T-002 ✅
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

- **T-070.5 — RLS policy akses anon** · ✅ Done (dengan deviasi, ADR-142)
  Teks asli: policy baca publik di `StartPagePage`/`StartPageLink` (hanya row
  berstatus "published"), tetap application-enforced sebagai primary check
  (AU-D06) — RLS sebagai defense-in-depth.
  **Deviasi (ADR-142):** bukan policy anon, melainkan fungsi `SECURITY DEFINER`
  `public.start_page_get_public_by_slug(text)` (hanya kolom aman; REVOKE dari
  PUBLIC, `anon`, `authenticated`; GRANT EXECUTE hanya `app_runtime`; `ORDER BY position, id`). Policy anon
  membuka `workspace_id`/`view_count`/`click_count` lewat PostgREST (Ridwan F1 HIGH),
  policy `app_runtime` melemahkan isolasi tenant (F2).
  **Belum terverifikasi:** migrasi belum di-apply di Supabase staging/asli; SQL
  hanya diuji di Postgres 16 lokal dengan role stub; tipe kolom hasil `$queryRaw`
  di DB nyata belum dicek. Cek saat migrasi pertama kali di-apply di staging. _(Terjawab di T-164, 2026-10-28: migrasi ter-apply dan tipe hasil `$queryRaw` terbukti benar.)_
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

`✅ Done` (2026-10-28; PR #200, belum di-merge. Ridwan PASS, Najwa QA PASS) · **Domain** start-page · UI · **ADR** ADR-046, ADR-129, ADR-143, ADR-144 · **Depends** T-070 ✅
**Baca dulu:** `04-ux/key-screen-patterns.md` · `04-ux/information-architecture.md` · ADR-129 · artifact Postific `project/templates/start-page-option-b-card-stack.html` (LOCKED PATTERN)

**Must Have.** Halaman publik yang bisa dibagikan lewat media sosial: pola **Card Stack** (ADR-129), header horizontal, tautan sebagai card, badge "Powered by Postific".

**Hasil:**

- Halaman `/u/[slug]` (`components/start-page/StartPageProfile.tsx`), render dinamis per request, tema lewat preset (T-073).
- Metadata, Open Graph, canonical, dan robots (halaman tidak ada atau draft menjadi 404 `noindex`).
- Header keamanan di `next.config.ts` (`X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Referrer-Policy`). CSP nonce untuk `/u/*` kini ada di `proxy.ts` (T-160 ✅); header CSP statis dihapus dari `next.config.ts`.
- Prasyarat dari review T-070 terpenuhi: `link.url` dan `avatarUrl` divalidasi `new URL()` hanya http/https, `rel="noopener noreferrer nofollow ugc"` + `target="_blank"`, allowlist `theme`.
- Href tautan = `/u/[slug]/go/[linkId]` (redirect hitung klik, T-074).

**Deviasi dan keputusan (King Rezi):** `<a>` di dalam `Card` karena `card.tsx` tidak punya `asChild`. Ikon platform memakai `hugeicons` monokrom, menyimpang sadar dari ADR-058 poin 6 (ADR-144). **Belum terverifikasi:** `next build` belum dijalankan; `Cache-Control` produksi belum diuji; tidak ada tes browser di staging.

### T-072 · Link management

`✅ Done` (2026-10-28; PR #200, belum di-merge. Ridwan PASS setelah F1 HIGH diperbaiki, Najwa QA PASS) · **Domain** start-page · UI · **ADR** ADR-130, ADR-144 · **Depends** T-070 ✅
**Baca dulu:** `02-product/mvp-definition.md` · ADR-130 · artifact Postific `project/templates/start-page-editor.html` (LOCKED, App Prototype)

**Must Have.** CRUD daftar tautan + urutan tampil, di layar "Start Page → Page Editor" (ADR-130: Profil Halaman, Link List sebagai Table tanpa header, Preview, Share).

**Hasil:**

- Jalur tulis workspace-scoped: service, RBAC (Owner, Admin, Creator; ADR-074), validasi, Server Actions di `app/(app)/start-page/actions.ts`.
- Satu halaman per workspace: migrasi `20261026130000_t072_start_page_unique_workspace` (`UNIQUE(workspace_id)`).
- CRUD tautan (form = Dialog), hapus dengan dialog konfirmasi, reorder (drag dan keyboard), Publish/Unpublish, Share.
- Profil: tombol Simpan dengan draft staged, Preview mengikuti draft; foto profil = input URL https + pratinjau (upload ditunda: T-159).
- Slug: panjang 3-40, reserved words, normalisasi lowercase; `url` tautan hanya http/https, `avatarUrl` hanya https. Pesan error domain berbahasa Indonesia.

**Prasyarat apply migrasi UNIQUE di staging (Ridwan F6):** jalankan dulu `SELECT workspace_id, count(*) FROM start_page_pages GROUP BY 1 HAVING count(*) > 1`; bila ada baris, bereskan duplikat sebelum apply.

**Deviasi desain minor:** rancangan terkunci memakai upload avatar (implementasi: URL https); slug, tombol Simpan, dan state "Buat Halaman" belum punya rancangan terkunci di artifact. **Catatan minor QA (M4):** posisi tautan tidak dipadatkan setelah hapus (diperbaiki di T-162.2). **Belum terverifikasi:** `P2025` hanya lewat mock; migrasi belum di-apply di staging. Keputusan: ADR-144.

### T-073 · Theme configuration

`✅ Done` (2026-10-28; PR #200, belum di-merge. Ridwan PASS, Najwa QA PASS) · **Domain** start-page · UI · **ADR** ADR-038, ADR-041, ADR-144 · **Depends** T-071 ✅
**Baca dulu:** `06-engineering/design-tokens.md`

Berstatus **Should Have** di `feature-priority.md`. Pertanyaan tiket (token yang sama atau set sendiri) dijawab: **preset terbatas turunan token produk**.

**Hasil:**

- Enum allowlist `default | dark | accent` (`START_PAGE_THEMES`); nilai lain jatuh ke `default`.
- Selector `ToggleGroup` di Page Editor; Preview ikut tema.
- `default` ikut tema aplikasi; `dark` memaksa scope dark; `accent` netral tanpa hue (inversi primary Stone). **Tanpa token baru.** Rancangan LOCKED di artifact Postific (King Rezi, 2026-10-26).
- Kontras diuji di `start-page-theme.test.ts`.

**Catatan:** token bersama `muted-foreground` mode light hanya 3,4 sampai 3,8:1 (di bawah AA 4,5:1), jadi teks sekunder di tema light belum memenuhi AA: T-163 (butuh keputusan token). Blok DRAFT lama (Aksen hijau) di `project/styles.css` artifact sudah dihapus (T-161 ✅).

### T-074 · Basic analytics Start Page

`✅ Done` (2026-10-28; PR #200, belum di-merge. Ridwan PASS, Najwa QA PASS) · **Domain** start-page · **ADR** ADR-018, ADR-143, ADR-144 · **Depends** T-071 ✅, T-040
**Baca dulu:** `02-product/feature-priority.md`

Berstatus **Could Have** — hitungan kunjungan + klik per tautan. **Deviasi dari teks asli:** dikerjakan sebagai counter sederhana di domain `start-page` (bukan lintas domain `analytics`, tanpa tabel event, tanpa PII), karena counter hanya milik halaman publik (ADR-143).

**Hasil:**

- Migrasi `20261026133000_t074_start_page_analytics_functions`: fungsi `SECURITY DEFINER` `start_page_record_view` dan `start_page_record_click_and_get_url`; EXECUTE hanya `app_runtime`, REVOKE dari `PUBLIC`/`anon`/`authenticated`.
- Klik lewat route redirect 302 `/u/[slug]/go/[linkId]` (`Cache-Control: no-store`, `X-Robots-Tag: noindex`); bot dan `HEAD` pada route klik tidak dihitung (heuristik user-agent); tanpa dedup dan rate limit.
- Tampil hanya di Page Editor: kunjungan di page-head, klik per tautan di meta Link List. Format id-ID penuh di bawah 10.000, ringkas mulai 10.000; tanpa data tampil `0` + petunjuk.

**Catatan LOW (Ridwan):** F3 counter tanpa rate limit; F4 klik terhitung tapi bisa 404; F8 `search_path` tanpa `pg_temp` (konsisten dengan migrasi lain). **Catatan minor QA:** M1 (`HEAD` menaikkan `view_count`) dan M3 (fungsi baca publik tidak menyaring skema url) sudah diperbaiki di T-162.1 dan T-162.3. **Belum terverifikasi:** migrasi belum di-apply di Supabase; grant default `anon`/`authenticated` Supabase asli belum diuji; tidak ada tes integrasi DB di CI. QA lokal (Postgres 16, role stub, `app_runtime` non-BYPASSRLS) membuktikan RLS dan fungsi.

---

## Lanjutan (dari review dan QA T-070 sampai T-074)

Tiket di bawah lahir dari temuan review Ridwan, QA Najwa, dan Mark. Semuanya di file rilis ini, bukan `known-issues.md`: bukan Known Issue (tidak ada bug yang merusak MVP), melainkan lanjutan fitur dan hutang kecil rilis v0.6 (ADR-134 menyisihkan `known-issues.md` untuk tiket yang lahir sebagai pelacak KI). Kalau salah satunya kelak dinaikkan jadi KI, pindahkan ke `known-issues.md`.

### T-159 · Upload foto profil Start Page lewat Storage/Media

`✅ Done` (2026-10-28; branch `feature/t-159-start-page-avatar-upload`, belum di-merge) · **Domain** start-page, media · UI · **ADR** ADR-144, ADR-071, ADR-145 · **Depends** T-072 ✅
**Baca dulu:** `05-architecture/database-strategy.md` § Storage (bucket `avatars`) · ADR-071 · artifact Postific `project/templates/start-page-editor.html` (rancangan memakai upload)

Ganti input URL https dengan unggah file. Supabase JS client hanya untuk Storage. Validasi `avatarUrl` https di sisi render tetap ada.

**Keputusan King Rezi (2026-10-28):** kontrolnya sama dengan Settings → Akun — avatar + `Input type="file"`, bukan dropzone dan bukan klik-avatar. Artifact tidak bisa dibaca dari sesi ini, jadi pola dikunci lewat pertanyaan itu.

**Hasil:**

- Page Editor: label "Foto Profil", JPG/PNG maks 2MB, pratinjau, tombol "Hapus foto" (halaman kembali ke inisial). File baru tampil di Preview sebelum Simpan. Tersimpan bersama "Simpan Perubahan".
- Berkas masuk bucket publik `avatars` di folder `avatars/{workspace_id}/` (ADR-071) dengan nama unik per unggahan, `avatar-{uuid}.{ext}`, tanpa `upsert`. Berkas lama tidak tertimpa sebelum database tersimpan, jadi tidak perlu cache-bust. URL https hasil unggah disimpan di `avatarUrl`; berkas lain di folder dihapus sesudah simpan berhasil. Isi berkas dicocokkan dengan byte awal JPEG/PNG dan ukuran dicek sebelum dibaca ke memori.
- Domain tidak memanggil Supabase: port `IStartPageAvatarStorage`, implementasi di `lib/adapters/avatar-storage`. Kalau simpan database gagal sesudah unggah, berkas baru dihapus (best-effort).

**Belum:** unggah sungguhan ke Storage lewat browser (butuh sesi login). Belum di-merge dan belum di staging.

**Lanjutan T-159.1 · Perbaikan hasil `/code-review` PR #203** (2026-10-28; branch `fix/pr203-code-review-findings`; PR #203 sudah merged ke `staging`) · **ADR** ADR-145 (poin 2 dan 5 diperjelas)

- [x] Pembersihan berkas lama tidak lagi menghapus berkas yang baru dibuat: hanya berkas lebih tua dari 10 menit yang dihapus, supaya simpan serentak tidak saling menghapus unggahan
- [x] `deleteOtherAvatars` hanya menyentuh berkas berpola `avatar-<uuid>.(jpg|png)` (avatar workspace atau berkas lain di folder tidak ikut terhapus) dan membaca sampai 1000 entri
- [x] `ProfileCard`: berkas tidak valid atau dialog dibatalkan ikut mengosongkan draft; pesan error dibersihkan saat pilihan valid diterima
- [x] Storage tak terpasang menjadi `ExternalServiceError` (dilog di action) dan dicek paling awal
- [x] Aturan ukuran avatar satu sumber: `assertAvatarSizeWithinLimit` (domain) dipakai Server Action dan service
- [x] Adapter mengimpor port lewat barrel `@/domains/start-page`
- Dua sisanya dikerjakan di T-159.2 di bawah (cleanup Storage sinkron; duplikasi pola adapter)
- **Terverifikasi:** `tsc`, eslint, prettier bersih; vitest area start-page dan adapter avatar 194 lulus

**Lanjutan T-159.2 · Dua sisa code-review PR #203** (2026-10-28; branch `feature/t-159-2-avatar-cleanup-and-adapter`) · **ADR** ADR-145 (poin 5)

- [x] Cleanup berkas lama tidak lagi menahan respons simpan: `StartPageService` menerima `runAfterResponse` (default: jalankan langsung tanpa menunggu), Server Action memasok `after()` dari `next/server`. Pembersihan berjalan sesudah DB tersimpan, dan kegagalan tetap best-effort (dilog)
- [x] `updateProfile`: rollback berkas baru hanya membungkus tulis DB; penjadwalan cleanup di luar `try` supaya tidak ikut menghapus berkas baru
- [x] Pola adapter digabung: `lib/adapters/avatar-storage/avatars-bucket.ts` (`AVATARS_BUCKET`, `avatarsBucket()`, `uploadToAvatarsBucket`) dipakai adapter avatar user dan Start Page; perilaku tiap adapter tidak berubah (user: upsert + cache-bust + hapus senyap; Start Page: nama unik + hapus melempar)
- [x] Tes baru: cleanup dijadwalkan lewat `runAfterResponse` dan tidak ditunggu
- **Terverifikasi:** `tsc`, eslint, prettier bersih; vitest 1444 lulus. **Belum:** `after()` di server nyata dan unggah foto lewat browser

### T-160 · CSP penuh dengan nonce untuk `/u/*`

`✅ Done` (2026-10-28; PR #200, belum di-merge) · **Domain** start-page · infra (`proxy.ts`, `lib/security/public-csp.ts`) · **ADR** ADR-144 · **Depends** T-071 ✅
**Baca dulu:** `06-engineering/rendering-strategy.md` § RS-D08

- [x] CSP nonce per request untuk `/u/*` di `proxy.ts`: `script-src 'self' 'nonce-…' 'strict-dynamic'`, `style-src 'self' 'nonce-…'` (tanpa `unsafe-inline`), `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `img-src https:` (avatar https bebas).
- [x] `upgrade-insecure-requests` sengaja tidak dipasang: memecah `next start` di http localhost; TLS dijamin Railway.
- [x] Header CSP statis di `next.config.ts` dihapus; `X-Frame-Options` dan header lain tetap.
- [x] `Toaster` sonner dipindah dari `Providers` root ke `(app)/layout` lewat `AppToaster` (halaman auth, onboarding, dan publik tidak punya Toaster; semua pemakai `toast()` ada di `(app)`).

**Terverifikasi:** `next build` + `next start` + `curl` + Chromium: 0 pelanggaran di `/u/<slug valid>`. **Belum:** `next dev`, Railway/staging (T-164), Firefox/Safari, toast di halaman `(app)` nyata lewat session. _(Semuanya sudah dikerjakan di T-164.6, 2026-10-28; sisa Safari asli dan pemantauan rasio di T-171.)_
**Batasan (diterima King Rezi):** 404 bawaan Next di `/u/<slug tak ada>` menyuntik `<style>` tanpa nonce, 1 pelanggaran `style-src-elem` (kosmetik, tanpa risiko keamanan). Lanjutan: T-166.
**Temuan code-review dibantah (PR #200):** "script tema inline tidak ber-nonce" dibantah Najwa lewat uji empiris: bootstrap Next ber-nonce, elemen dibuat chunk ber-nonce lalu lolos `'strict-dynamic'`, 0 pelanggaran, class `dark` terpasang sebelum hydration. Batasan: browser tanpa `strict-dynamic` (Safari <15.4) hanya mendapat kilas tema light.

### T-161 · Bersihkan blok DRAFT lama di `project/styles.css` artifact Postific

`✅ Done` (2026-10-28) · **Domain** design (artifact desain) · **ADR** ADR-140, ADR-144 · **Depends** T-073 ✅
**Baca dulu:** `.claude/skills/claude-design-scope-discipline/SKILL.md` · `context/ctx-design.md`

Neymar menghapus blok DRAFT lama (75 baris, Aksen hijau/`accent-bronze`) dari `project/styles.css` artifact Postific (kini v18). Galeri tidak diubah (sudah bersih).
**Sisa kecil (untuk King Rezi/Neymar, belum diubah):** label "DRAFT T-073" di `s/start-page-theme-presets.html` galeri dan komentar header "STATUS: DRAFT" di blok CSS baru masih lama.

### T-162 · Perbaikan kecil counter dan data Start Page (opsional, prioritas rendah)

`✅ Done` (T-162.1 sampai .3, 2026-10-28; PR #200, belum di-merge; Ridwan tanpa Critical/High, Najwa QA lulus). **T-162.4 tidak dikerjakan** (butuh ADR) · **Domain** start-page · **ADR** ADR-143, ADR-144 · **Depends** T-074 ✅
**Baca dulu:** ADR-143 § Consequences

- [x] **T-162.1** `HEAD` tidak dihitung lewat Fetch Metadata (`Sec-Fetch-Dest: document` + `Sec-Fetch-Mode: navigate`, fail-closed; value object `document-navigation.ts`). Next 16 merender `HEAD` sebagai `GET` sehingga method tak bisa dicek. Batasan: Safari <16.4, http non-secure selain localhost, dan sebagian in-app browser tidak terhitung; header bisa dipalsukan (heuristik). Keputusan King Rezi: tetap fail-closed, rasio view terhadap klik dipantau setelah rilis (T-164.6).
- [x] **T-162.2** `deleteLink` memadatkan `position` dalam satu transaksi. Risiko race LOW diterima; diuji hanya lewat mock dan QA DB lokal.
- [x] **T-162.3** Migrasi `20261028120000_t162_3_start_page_public_read_http_only_urls`: fungsi baca publik menyaring url `^https?://`. Perlu di-apply di staging (T-164). _(Sudah ter-apply, 2026-10-28.)_
- [ ] **T-162.4** Rate limit atau dedup counter (Ridwan F3). Menyimpan identifier menyentuh PII, jadi butuh ADR baru sebelum dikerjakan. Tetap terbuka, tanpa tiket sendiri sampai ADR ada.

**Catatan LOW (Ridwan):** `search_path` tanpa `pg_temp` (konsisten dengan fungsi lain; perbaiki semua fungsi `start_page_*` di migrasi tersendiri nanti); belum ada tes integrasi DB untuk fungsi baru. **QA:** 6 file integrasi DB timeout sudah gagal di baseline (pooler Supabase tak terjangkau dari sandbox). F4 (klik terhitung tapi bisa 404) diterima sebagai LOW.

### T-163 · Token `muted-foreground` mode light memenuhi kontras AA

`✅ Done` (2026-10-28; nilai `#5c5c63`, ADR-147; `globals.css`, `design-tokens.md`, dan token `--muted-foreground` di artifact desain Postific (v21) sudah sama. `color-text-secondary` di `tokens.json` dan `archived/styles.css` artifact juga `#5c5c63`, artifact versi 22) · **Domain** design tokens, UI (seluruh produk) · **ADR** ADR-087, ADR-144 · **Depends** keputusan King Rezi
**Baca dulu:** `06-engineering/design-tokens.md` § Engineering Mapping (DT-D06)

`--muted-foreground` light (`#83838a`, dipetakan 1:1 dari Stone, ADR-087) hanya 3,4 sampai 3,8:1 di atas latar yang dipakai, di bawah AA 4,5:1. Efeknya seluruh produk, bukan hanya Start Page. **Hasil:** nilai baru `#5c5c63` (6,63:1 card, 5,99:1 background, 5,14:1 fill `--muted`), keputusan di ADR-147. `design-tokens.md` dan `globals.css` sudah diubah; Token `--muted-foreground` di artifact desain Postific (ADR-140) juga sudah diperbarui (Neymar, versi 21).

### T-164 · Verifikasi staging Start Page: apply migrasi dan uji publik end-to-end

`✅ Done` (2026-10-28; T-164.1 sampai .6 diverifikasi di staging. Dua sisa yang butuh Safari asli dan trafik nyata dipindah ke T-171) · **Domain** start-page · infra · **ADR** ADR-142, ADR-143, ADR-144 · **Depends** PR #200 ✅ (sudah di `staging`)
**Baca dulu:** ADR-142 § Consequences · ADR-143 § Consequences · T-072 (prasyarat F6)

Tiket ini mencatat verifikasi yang belum dilakukan; tanpanya definisi selesai rilis ("pengguna dapat membagikan halaman publik") belum terbukti.

- [x] **T-164.1** (2026-10-28) Query duplikat `start_page_pages` per `workspace_id`: 0 baris. Keempat migrasi (T-070, T-072, T-074, T-162.3) sudah tercatat selesai di `_prisma_migrations` project staging `ndcrkzqgqukqfmekgoze` (ADR-081) sejak 2026-10-28 04:18 UTC, jadi tidak ada yang perlu di-apply ulang. Tabel `start_page_pages` masih kosong (belum ada halaman uji di staging).
- [x] **T-164.2** (2026-10-28) Grant: ketiga fungsi `start_page_*` (`get_public_by_slug`, `record_view`, `record_click_and_get_url`) `SECURITY DEFINER`, `EXECUTE` untuk `anon`, `authenticated`, dan `public` semuanya `false` (`has_function_privilege`). Tipe hasil `$queryRaw` terbukti benar lewat halaman publik yang tampil dan counter yang naik di staging.
- [x] **T-164.3** (2026-10-28) `curl` tanpa cookie ke `https://web-staging-60d7.up.railway.app`: `/u/<slug>` 200 tanpa redirect ke `/login`, `Cache-Control: private, no-cache, no-store`, CSP bernonce; `/u/<slug>/go/<linkId>` 302 ke url tujuan dengan `Cache-Control: no-store`; `linkId` acak 404. **Temuan:** `curl` dengan UA bawaan tidak menaikkan counter (filter bot bekerja sesuai desain); dengan UA browser + `Sec-Fetch-Dest: document`/`Sec-Fetch-Mode: navigate`, `view_count` dan `click_count` naik 1.
- [x] **T-164.4** (2026-10-28) `next build` lolos (exit 0; `/u/[slug]` dan `/u/[slug]/go/[linkId]` terdaftar dinamis). Jalur `P2025` diuji ke DB staging lewat klien Prisma asli: `startPageLink.update` dan `startPagePage.update` pada id yang tidak ada melempar `PrismaClientKnownRequestError` berkode `P2025` (instanceof benar), sesuai asumsi `isRecordNotFound` di `start-page-write.repository.ts`. Tanpa efek tulis.
- [x] **T-164.5** (2026-10-28) Staging: halaman `cook-it-real-good` dibuat King Rezi, satu tautan uji ditambah dan dipublish lewat UI, dibuka anonim (`curl`) dan di browser, klik terhitung; Page Editor menampilkan 2 kunjungan dan "1 klik" pada tautan. Data uji ini sengaja dibiarkan di staging.
- [x] **T-164.6** (2026-10-28) CSP: staging (Railway) 0 pelanggaran di konsol Chromium pada `/u/<slug>` dan `/start-page`. **Firefox dan WebKit** (Playwright, engine Safari 27, sesi ini): `/u/<slug>` 0 pelanggaran CSP dan 0 error konsol; hanya `/u/<slug tak ada>` (404 bawaan Next) 1 pelanggaran `style-src-elem`, batasan yang sudah diterima (T-166). View dari kedua engine terhitung (`view_count` 3 → 5), jadi Fetch Metadata tidak memblokir Firefox/WebKit modern. `next dev` lokal (Chromium): `/u/<slug>` render benar, 17 pelanggaran `style-src` yang diduga berasal dari overlay dev Next (`nextjs-portal`), hanya di dev. Toast di halaman `(app)` tampil tanpa pelanggaran baru; temuan toast menutupi tombol diselesaikan di T-170. **Belum:** Safari asli dan Safari <16.4 / in-app browser (WebKit Playwright bukan Safari sungguhan), dan pemantauan rasio `view_count` terhadap `click_count` setelah rilis (butuh trafik nyata; saat ini data uji, belum bermakna). Kedua sisa itu dipindah ke T-171 (keputusan King Rezi, 2026-10-28), T-164 ditutup.

### T-171 · Pantau rasio view/klik Start Page dan cek Safari asli (lanjutan T-164.6)

`⏳ Not Started` (2026-10-29: persiapan selesai, yaitu runbook dan query di bawah; **eksekusi menunggu rilis dan perangkat Apple, langkah King Rezi**) · **Domain** start-page · infra · **ADR** ADR-143 · **Depends** rilis v0.6 ke produksi dengan trafik nyata
**Baca dulu:** T-162.1 · T-164.6

Dua sisa T-164.6 yang tidak bisa diverifikasi tanpa trafik nyata atau perangkat Apple:

- [ ] **T-171.1** Pantau rasio `view_count` terhadap `click_count` setelah rilis. Bila view jauh di bawah klik, filter Fetch Metadata (T-162.1) terlalu ketat dan perlu ditinjau (keputusan King Rezi tetap fail-closed).
- [ ] **T-171.2** Cek `/u/<slug>` di Safari asli (iOS dan macOS), termasuk Safari <16.4 dan in-app browser: tampilan, 0 pelanggaran CSP, dan view/klik terhitung. WebKit Playwright (sesi T-164.6) sudah lolos tetapi bukan Safari sungguhan.

#### Persiapan (2026-10-29)

Hanya dokumentasi. Tidak ada query yang dijalankan ke staging; query di bawah divalidasi di Postgres lokal sementara (PGlite) dengan data tiruan, termasuk di dalam `BEGIN READ ONLY`. Data di staging hanya data uji (beberapa kunjungan), jadi rasionya belum bermakna; jalankan query di produksi setelah ada trafik nyata.

##### T-171.1 · Metode hitung rasio view/klik

Counter bersifat kumulatif (tanpa deret waktu, dan tanpa dedup atau rate limit karena T-162.4 belum dikerjakan), jadi ada dua cara baca: **snapshot** (angka total sekarang) dan **delta** (selisih dua snapshot).

**Aturan baca.** Klik hampir selalu didahului view, karena pengunjung harus membuka `/u/<slug>` untuk melihat tautan. Jadi `klik > view` pada halaman yang cukup ramai berarti view kurang terhitung, yaitu filter Fetch Metadata (T-162.1) terlalu ketat. Rasio klik per view yang wajar untuk link-in-bio jauh di bawah 1.

| Kondisi (halaman dengan klik >= N)          | Arti                                                                               | Tindakan                                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `clicks_per_view` < 1                       | Normal                                                                             | Tidak ada                                                                                       |
| `clicks_per_view` > 1 pada beberapa halaman | View kurang terhitung (filter terlalu ketat) atau tautan `/go/` dibagikan langsung | Cek delta dan jenis perangkat pengunjung; tinjau T-162.1. Keputusan King Rezi tetap fail-closed |
| Banyak halaman dengan `total_clicks` = 0    | Belum ada klik, bukan masalah filter                                               | Tunggu trafik                                                                                   |

**Yang menunggu keputusan King Rezi:** nilai ambang `N` (jumlah klik minimum sebelum rasio dianggap bermakna). Query di bawah memakai **N = 30 sebagai usulan** (ubah di klausa `FILTER`).

**Batasan data:** menghapus tautan ikut menghapus hitungan kliknya (jadi `total_clicks` bisa turun); kunjungan pemilik halaman sendiri ikut terhitung; klik dari tautan `/go/` yang dibagikan langsung tanpa membuka halaman bisa membuat klik > view secara sah. Karena itu satu angka tidak cukup: bandingkan beberapa halaman dan beberapa snapshot sebelum menyimpulkan.

Query 1, per halaman (read-only, jalankan di `psql` atau `execute_sql` pada DB produksi dengan persetujuan King Rezi):

```sql
SELECT sp.slug,
       sp.view_count,
       COALESCE(SUM(l.click_count), 0)::bigint AS total_clicks,
       CASE WHEN COALESCE(SUM(l.click_count), 0) > 0
            THEN round(COALESCE(SUM(l.click_count), 0)::numeric / NULLIF(sp.view_count, 0), 2)
       END AS clicks_per_view
  FROM start_page_pages sp
  LEFT JOIN start_page_links l ON l.start_page_id = sp.id
 WHERE sp.is_published = true
 GROUP BY sp.id, sp.slug, sp.view_count
 ORDER BY total_clicks DESC;
```

Query 2, ringkasan semua halaman published:

```sql
SELECT count(*) AS halaman_published,
       SUM(v.view_count)::bigint AS total_views,
       SUM(v.total_clicks)::bigint AS total_clicks,
       round(SUM(v.total_clicks)::numeric / NULLIF(SUM(v.view_count), 0), 2) AS clicks_per_view,
       count(*) FILTER (WHERE v.total_clicks >= 30 AND v.total_clicks > v.view_count) AS halaman_dicurigai
  FROM (
    SELECT sp.id, sp.view_count,
           COALESCE((SELECT SUM(l.click_count) FROM start_page_links l WHERE l.start_page_id = sp.id), 0) AS total_clicks
      FROM start_page_pages sp
     WHERE sp.is_published = true
  ) v;
```

**Delta:** jalankan Query 1 pada dua waktu (mis. 7 hari berselang), catat hasilnya di tiket ini, lalu bandingkan `selisih view` dengan `selisih klik` per halaman. Tabel catatan:

| Tanggal | slug | view_count | total_clicks | clicks_per_view | Catatan |
| ------- | ---- | ---------- | ------------ | --------------- | ------- |
| -       | -    | -          | -            | -               | -       |

##### T-171.2 · Runbook cek Safari asli

**Prasyarat:** PR 217 sudah di-merge dan ter-deploy ke staging (agar 404 kustom T-166 ada); migrasi T-167.4 sudah diterapkan; ada halaman published untuk uji (staging: `cook-it-real-good`, data uji sengaja dibiarkan, T-164.5). Base URL staging: `https://web-staging-60d7.up.railway.app`.

**Matriks perangkat** (isi kolom hasil setelah diuji):

| Perangkat                                              | Yang diharapkan                                                                                                        | Hasil |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----- |
| Safari macOS (terbaru)                                 | Tampil benar, 0 pelanggaran CSP, view +1 per muat, klik +1                                                             | -     |
| Safari iOS (iPhone, terbaru)                           | Sama seperti macOS; cek juga mode gelap iOS                                                                            | -     |
| Safari < 16.4 (perangkat lama, mis. iOS 15/16.3)       | Tampil benar dan klik terhitung; **view +0 itu perilaku yang diterima** (tidak ada Fetch Metadata, T-162.1), bukan bug | -     |
| In-app browser (Instagram, Facebook, TikTok, WhatsApp) | Tampil benar dan klik terhitung; view bisa +0 (sebagian tidak mengirim Fetch Metadata). Catat per aplikasi             | -     |

**Langkah per perangkat:**

1. **Snapshot awal.** Catat `view_count` halaman dan `click_count` tautan uji (Page Editor di `/start-page` menampilkan kunjungan dan klik per tautan; atau Query 1 bila diizinkan).
2. **Buka `/u/<slug>`** di tab baru/privat. Cek tampilan: avatar, judul, bio, semua tautan aktif, footer "Powered by Postific", tidak ada scroll horizontal, tema sesuai preset. Ulangi dengan mode gelap perangkat.
3. **Konsol.** macOS: menu Develop > Show Web Inspector (aktifkan Develop di Settings > Advanced). iOS: sambungkan ke Mac, Safari macOS > Develop > nama perangkat > halaman. Harapan: 0 pesan `Refused to apply inline style` / `Refused to execute inline script` / `Content Security Policy`.
4. **View.** Muat ulang sekali lalu cek Page Editor: `view_count` naik 1 per muat (Safari < 16.4 dan sebagian in-app browser: tidak naik, itu diterima).
5. **Klik.** Ketuk satu tautan: berpindah ke tujuan lewat `/u/<slug>/go/<linkId>` (302), tombol Kembali kembali ke halaman tanpa loop, `click_count` tautan itu naik 1.
6. **404.** Buka `/u/<slug-yang-pasti-tidak-ada>`: layar 404 kustom (ikon pencarian, "Halaman tidak ditemukan"), tab Network menunjukkan status 404, konsol 0 pelanggaran CSP.
7. **Catat hasil** di matriks, lengkap dengan versi OS dan Safari.

##### Hasil uji staging, langkah 1 sampai 5 (diisi King Rezi, dicatat AI)

Uji dijalankan di staging (`https://web-staging-60d7.up.railway.app`) pada halaman published `cook-it-real-good`, **sebelum PR 217 di-merge**, jadi **langkah 6 (404 kustom) belum bisa diuji** dan tercatat di bawah sebagai tertunda. Isi satu baris per perangkat. Penanda: ✅ sesuai harapan, ❌ tidak sesuai (jelaskan di Catatan), `n/a` tidak diuji.

| Tanggal | Perangkat dan OS | Safari/aplikasi (versi) | 2 Tampilan (terang/gelap) | 3 Konsol: pelanggaran CSP | 4 View (awal → akhir) | 5 Klik (awal → akhir) | Catatan |
| ------- | ---------------- | ----------------------- | ------------------------- | ------------------------- | --------------------- | --------------------- | ------- |
| -       | -                | -                       | -                         | -                         | -                     | -                     | -       |

**Cara mengisi**

- **Tampilan:** ✅ bila avatar, judul, bio, semua tautan aktif, dan footer "Powered by Postific" tampil benar, tanpa scroll horizontal.
- **Konsol:** tulis jumlah pesan pelanggaran CSP (`Refused to apply inline style`, `Refused to execute inline script`, `Content Security Policy`); harapan 0. Bila tidak bisa membuka Web Inspector (mis. in-app browser), tulis `n/a`.
- **View:** `view_count` sebelum dan sesudah satu kali muat halaman (contoh `5 → 6`). Safari < 16.4 dan sebagian in-app browser memang boleh `+0` (T-162.1).
- **Klik:** `click_count` tautan yang diketuk, sebelum dan sesudah (contoh `2 → 3`). Cek juga tombol Kembali tidak memutar ulang (tanpa loop).
- **Sumber angka:** Page Editor di `/start-page` (kunjungan di kepala halaman, klik per tautan di Link List).

**Langkah 6 (404 kustom) sudah diuji otomatis, lihat bagian berikutnya.** Yang tertunda: uji di perangkat Apple (tabel di atas) dan T-171.1 sampai ada trafik produksi.

##### Hasil uji otomatis Playwright di staging (2026-10-29)

**Label: uji otomatis, bukan Safari asli.** Dijalankan lewat skrip sementara (sudah dihapus, tidak ada di repo) terhadap `https://web-staging-60d7.up.railway.app`, halaman `e2e-start-page` di workspace E2E Sandbox (akun test E2E), tanpa cookie (tamu) dan dengan UA bawaan tiap browser. Tautan uji dihapus di akhir tiap run; counter halaman itu naik beberapa angka. Run di atas dilakukan **sebelum** PR 217 ter-deploy, jadi 404 yang diuji saat itu masih 404 bawaan Next; 404 kustom diuji ulang di bagian berikutnya.

| Mesin (versi)                          | 200 + tautan tampil | CSP `/u/<slug>` (desktop / 375px gelap) | Scroll horizontal | Klik → tujuan                                                                | View (2 muat) | Klik | 404 |
| -------------------------------------- | ------------------- | --------------------------------------- | ----------------- | ---------------------------------------------------------------------------- | ------------- | ---- | --- |
| Chromium (Chrome 156)                  | ✅                  | 0 / 0                                   | tidak ada         | ✅ 302 dari `/go/` ke tujuan                                                 | +2            | +1   | 404 |
| Firefox 157                            | ✅                  | 0 / 0                                   | tidak ada         | ✅ 302                                                                       | +2            | +1   | 404 |
| WebKit 27.2 (Playwright, bukan Safari) | ✅                  | 0 / 0                                   | tidak ada         | ✅ berujung di tujuan; status 302 tidak teramati (batasan alat, lihat bawah) | +2            | +1   | 404 |

**Yang terbukti:** view dan klik terhitung di Chromium, Firefox, dan WebKit modern, jadi header Fetch Metadata (T-162.1) terkirim oleh ketiganya dan filter tidak terlalu ketat untuk mesin-mesin itu. Halaman tampil benar tanpa scroll horizontal pada desktop dan 375px. 0 pelanggaran CSP pada halaman publik.

**Batasan alat (jangan dibaca sebagai bug aplikasi):**

- Screenshot Playwright WebKit menyuntik `<style>` yang diblokir CSP (`style-src-elem`, `sample` kosong). Terbukti terpisah: tanpa screenshot 0 pelanggaran, dengan screenshot 1, hanya di WebKit; Chromium dan Firefox 0 dengan atau tanpa screenshot. Baca CSP sebelum screenshot.
- Playwright WebKit tidak memunculkan status `/go/` (302) maupun rantai redirect, baik di tab baru maupun tab yang sama. Redirect terbukti dari hasil akhirnya (tab mendarat di tujuan, klik terhitung), bukan dari status 302 itu sendiri.
- 404 bawaan Next masih menimbulkan pelanggaran CSP `style-src-elem` (1 sampai 2 entri per muat, cara hitung berbeda antar browser). Itu yang diperbaiki T-166 di PR 217; belum ada di staging.

**Temuan baru (perlu keputusan King Rezi): kedipan terang di mode gelap.** Pengunjung dengan OS mode gelap dan tanpa cookie `theme` (hampir semua pengunjung halaman publik) melihat halaman dilukis **terang dulu**, lalu kelas `dark` pada `<html>` baru ditambahkan, lalu kartu dan lencana (`transition-colors`) memudar dari putih ke gelap. Latar `body` berganti seketika, jadi sesaat ada kartu putih di atas latar gelap, dan teks putih "Postific" di lencana putih nyaris tak terbaca. Diukur per frame di tiga mesin:

| Mesin    | Kelas `dark` terpasang                                       | Pemudaran lencana putih → gelap |
| -------- | ------------------------------------------------------------ | ------------------------------- |
| Chromium | ±283 ms setelah load                                         | ±283 sampai 431 ms              |
| Firefox  | ±890 ms (jaringan staging lebih lambat)                      | ±890 sampai 1036 ms             |
| WebKit   | sudah gelap di sampel pertama (±217 ms), lencana masih putih | ±217 sampai 353 ms              |

Mode terang tidak terpengaruh (1 keadaan, tanpa perubahan). Ini bertentangan dengan catatan di `app/layout.tsx` ("tidak ada flash tema salah", ADR-055, amendemen T-039) untuk pengunjung tanpa cookie, karena skrip `theme-system-default` (`beforeInteractive`) tampaknya berjalan setelah lukisan pertama. Penyebab pastinya **belum diselidiki**; yang terukur hanya urutan dan waktunya. Kemungkinan sudah ada sejak sebelum PR 217 dan berlaku di seluruh aplikasi, bukan hanya halaman publik (belum diukur di halaman `(app)`). Dicatat sebagai **KI-104** dengan tiket **T-177** di `known-issues.md` (2026-10-29, atas keputusan King Rezi); belum diperbaiki. Cek di Safari asli (iOS gelap) tetap diperlukan: amati kedipan ini saat memuat `/u/<slug>`.

##### Hasil uji otomatis setelah PR 217 ter-deploy (2026-10-29)

**Label: uji otomatis, bukan Safari asli.** PR 217 sudah ter-merge ke `staging` (`0fe430b`), migrasi T-167.4 diterapkan ke DB staging, lalu diuji ulang dengan Playwright.

- **Migrasi:** `prisma migrate status` menunjukkan hanya `20261029100000_t167_4_start_page_url_userinfo` yang belum terpasang (63 ditemukan); setelah `db:deploy` tercatat selesai di `_prisma_migrations`. Dicek di DB: kedua fungsi (`start_page_record_click_and_get_url`, `start_page_get_public_by_slug`) memuat filter URL berkredensial, tetap `SECURITY DEFINER`, `anon` dan `authenticated` tanpa hak eksekusi, `app_runtime` tetap punya. `start_page_record_view` tidak berubah (sesuai rencana).
- **T-171.2 langkah 6, 404 kustom** (`/u/<slug tak ada>`): Chromium, Firefox, dan WebKit: status 404, 0 pelanggaran CSP, satu `h1` "Halaman tidak ditemukan" di dalam `main`, tanpa tautan, tombol, maupun atribut `style`, tanpa scroll horizontal di desktop dan 375px (mode gelap), judul dokumen sesuai. **Halaman draft** (`/u/e2e-start-page` saat di-unpublish): status 404 dan teks halaman **identik** dengan slug yang tidak ada, jadi status draft tidak bocor (dicek di Chromium; halaman dipulihkan ke published setelahnya).
- **Catatan run pertama:** Chromium sempat menerima 404 bawaan Next (h1 "404", 1 pelanggaran CSP) pada run pertama, sementara Firefox dan WebKit beberapa detik kemudian sudah kustom; 10 permintaan berikutnya dan run ulang Chromium semuanya kustom. Konsisten dengan deploy Railway yang masih bergulir, tetapi tidak dibuktikan langsung.
- **Suite E2E resmi di staging** (`bun run test:e2e`, Chrome): 8 dari 8 lolos (sesi, workspace E2E, smoke, buat halaman + tautan + publish, halaman publik + CSP + 302 + counter, bersihkan + toast mobile).
- **Uji sementara reorder dan pemadatan lewat UI** (tidak ada di suite E2E, skrip sudah dihapus): tiga tautan, dua reorder keyboard berturut-turut bertahan setelah muat ulang (B, C, A), 0 toast error dan 0 error konsol; hapus tautan tengah menyisakan urutan benar; reorder setelah pemadatan tetap diterima (tidak `Conflict`). Itu membuktikan `UPDATE ... unnest(uuid[], int[])` dan jumlah-baris-sama versi baru berjalan lewat Prisma terhadap Postgres sungguhan dan RLS. Kunci `FOR UPDATE` terhadap dua permintaan bersamaan masih tidak diuji. **Saran:** jadikan skenario reorder ini tes E2E permanen (butuh tiket; ADR-132).

**Kriteria lulus:** tampilan benar, 0 pelanggaran CSP, klik terhitung di semua perangkat; view terhitung di Safari >= 16.4. **Bila gagal:** temuan baru dicatat sebagai Known Issue di `known-issues.md` dengan tiketnya (ADR-134), bukan di tiket ini; jangan melonggarkan CSP atau filter Fetch Metadata tanpa ADR baru.

**Tidak bisa dikerjakan dari sesi AI:** mesin pengembangan hanya punya Command Line Tools (tanpa Xcode dan Simulator iOS) dan browser bawaan sesi berbasis Chromium, jadi Safari sungguhan hanya bisa diuji King Rezi. WebKit Playwright (T-164.6) sudah lolos tetapi bukan Safari sungguhan.

### T-166 · 404 publik kustom untuk `/u/[slug]` tanpa inline style

`✅ Done` (2026-10-29; rancangan dikonfirmasi King Rezi, kode di PR 217 `fix/start-page-mvp-completion`; terverifikasi di staging 2026-10-29: slug tak ada, halaman draft, Chromium/Firefox/WebKit; sisa: Safari asli) · **Domain** start-page · UI · **ADR** ADR-144 · **Depends** T-160 ✅, rancangan artifact ✅
**Baca dulu:** `06-engineering/rendering-strategy.md` § RS-D08 · `context/ctx-design.md`

404 bawaan Next di `/u/<slug tak ada>` menyuntik `<style>` tanpa nonce (1 pelanggaran `style-src-elem`, kosmetik). Buat `app/u/[slug]/not-found.tsx` tanpa inline style. **Gate UI (aturan #10):** butuh rancangan di artifact Postific dan konfirmasi King Rezi sebelum kode.

- [x] **T-166.1** (2026-10-29) Rancangan dibuat Neymar: layar `ScreenStartPageNotFound` di artifact Postific (versi 25; kartu `project/components/ScreenStartPageNotFound/preview.html`, template `project/templates/start-page-not-found.html`) dan entri "Start Page: 404 publik (T-166)" di galeri Postific Design Review (versi 7).
- [x] **T-166.2** (2026-10-29) **Dikonfirmasi King Rezi apa adanya:** struktur meniru `StartPageProfile` (`main` > `article`) dengan footer badge "Powered by Postific" seperti Opsi B; komponen `Empty` shadcn dengan ikon pencarian `Search01Icon`; judul "Halaman tidak ditemukan"; deskripsi "Alamat ini tidak mengarah ke halaman yang tersedia. Periksa kembali tautannya, atau hubungi orang yang membagikannya."; **tanpa tautan atau tombol ke beranda**; satu rancangan tanpa toggle. Copy sama untuk slug tidak ada dan halaman belum di-publish (status draft tidak boleh bocor). Catatan a11y: `EmptyTitle` merender `div`, jadi `not-found.tsx` perlu satu `h1` dan landmark `main`.
- [x] **T-166.3** (2026-10-29) Implementasi `app/u/[slug]/not-found.tsx` tanpa inline style (Mark UI Engineer), dipanggil lewat `notFound()` dari rute publik.
- [x] **T-166.4** (2026-10-29) Verifikasi di browser: 0 pelanggaran CSP `style-src-elem` pada `/u/<slug tak ada>`, tampilan 375px dan desktop, mode terang dan gelap, status HTTP tetap 404. **Hasil:** `not-found.tsx` dan `not-found.test.tsx` (4 tes) ditambah oleh Mark. Build produksi lokal (`next build` + `next start`): `/u/<slug tak ada>` 404 dengan 0 pelanggaran CSP dan tanpa tag `<style>`; `next dev` 18 pelanggaran `style-src` dari overlay dev Next (sama seperti T-164.6). Tampilan 375px dan desktop, terang dan gelap, dicek di dev. **Catatan:** heading memakai `role="heading" aria-level={1}` pada `EmptyTitle` (tidak ada tag `<h1>` karena `EmptyTitle` merender `div`). **Belum diverifikasi:** halaman draft dan slug published di browser, Firefox/WebKit/Safari, staging Railway. T-166 tetap 🟡 sampai T-166.5 (sinkron `04-ux/`) diputuskan.
- [x] **T-166.5** (2026-10-29) Sinkronisasi `product-discovery/04-ux/` untuk layar 404 publik (manual/on-request, ADR-140): `information-architecture.md` § 5 Start Page (paragraf "Halaman publik tidak tersedia"), baris pemetaan fitur, dan keputusan **IA-D12**. `key-screen-patterns.md` tidak diubah (KSP-D11: Start Page bukan layar kritis). Tidak ada nilai token yang berubah, jadi `design-tokens.md` tidak disentuh.

### T-167 · Hardening repository dan tes Start Page (lanjutan code-review PR #200, prioritas rendah)

`✅ Done` (2026-10-29; T-167.1 sampai .5 selesai di kode dan tes, branch `fix/t-167-start-page-hardening`; SQL mentah T-167.1/.3/.4 terbukti di Postgres asli (PGlite WASM, 18 pemeriksaan lolos, 2026-10-29), migrasi diterapkan ke DB staging 2026-10-29; E2E di staging lolos 8/8, plus uji sementara reorder dan pemadatan lewat UI terhadap DB sungguhan; yang belum teruji hanya kunci `FOR UPDATE` antar-transaksi bersamaan) · **Domain** start-page · **ADR** ADR-144 · **Depends** PR #200 di-merge
**Baca dulu:** `apps/web/src/lib/repositories/start-page/start-page-write.repository.ts` · T-162.2 · T-162.3

Lahir dari `/code-review` PR #200 (branch `feature/t-070-start-page-public-route`). Tidak ada Critical/High; semuanya hardening, tidak memblokir merge.

- [x] **T-167.1** (2026-10-29) `addLink` (`start-page-write.repository.ts`): `position` dari `MAX+1` dan batas 50 tautan dicek tanpa lock. Dua tambah bersamaan bisa menghasilkan posisi kembar atau 51 tautan sehingga reorder gagal. Perbaikan: hitung dan insert dalam satu transaksi dengan `SELECT ... FOR UPDATE` pada baris halaman; sekaligus kunci race `deleteLink`/`reorderLinks` (T-162.2 menerima race ini sebagai LOW). **Hasil:** helper `lockPage` (`SELECT ... FOR UPDATE` pada baris halaman) dipakai ketiganya dalam satu transaksi.
- [x] **T-167.2** (2026-10-29) `addLink` di service memuat seluruh halaman dan tautan lewat `findByWorkspace` hanya untuk hitung/cek. Ganti dengan count/exists di repository dalam transaksi yang sama (digabung T-167.1). **Hasil:** `addLink` repository menerima `maxLinks` dan mengembalikan `{status: "added" | "no_page" | "limit_reached"}`; service tidak lagi memanggil `findByWorkspace`.
- [x] **T-167.3** (2026-10-29) `reorderLinks` dan pemadatan `deleteLink` melakukan sampai 50 `UPDATE` berurutan. Jadikan satu query (`UPDATE ... FROM unnest/VALUES`). **Hasil:** `reorderLinks` memakai satu `UPDATE ... FROM unnest(uuid[], int[])`; pemadatan `deleteLink` satu `UPDATE ... row_number()` yang hanya menulis baris berubah.
- [x] **T-167.4** (2026-10-29) Klik dihitung di fungsi SQL `start_page_record_click_and_get_url` sebelum URL divalidasi ulang oleh `sanitizeLinkUrl`. URL seperti `https://user:pw@host/` lolos regex SQL tapi ditolak aplikasi, sehingga klik terhitung lalu 404. Hanya mungkin untuk baris manual/lama. Selaraskan validasi SQL dengan `sanitizeLinkUrl` atau terima (terkait F4 di T-162). **Hasil:** migrasi baru `20261029100000_t167_4_start_page_url_userinfo` menambah `!~* '^https?://[^/?#]*@'` di fungsi klik dan fungsi baca publik. **Belum diterapkan ke DB manapun** (staging/dev), ikuti alur migrasi ADR-081.
- [x] **T-167.5** (2026-10-29) Tes interaksi komponen (keyboard reorder `LinkListCard`, timer `ShareCard`): `StartPageEditor.test.tsx` hanya memakai `renderToStaticMarkup`. Butuh setup testing interaksi (mis. `@testing-library`) bila diinginkan. **Hasil:** `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, dan `jsdom` dipasang sebagai devDependencies root (keputusan King Rezi, 2026-10-29). Environment vitest tetap `node`; tes komponen memilih jsdom lewat docblock `// @vitest-environment jsdom`. Tes baru: `LinkListCard.test.tsx` (reorder keyboard, fokus kembali ke handle, pengumuman a11y, batas atas/bawah, revert saat gagal, drag-and-drop) dan `ShareCard.test.tsx` (timer "Disalin!" 2 detik, restart timer, bersih saat unmount, fallback origin, clipboard gagal, toggle publish). Diuji mutasi: menghapus cleanup timer dan menghapus `focus()` sama-sama membuat tes gagal.

### T-170 · Toast tidak menutupi tombol aksi di `/start-page`

`✅ Done` (2026-10-28; keputusan King Rezi: `top-center`) · **Domain** UI (`AppToaster`, seluruh area `(app)`) · **ADR** ADR-097 · **Depends** keputusan King Rezi (pola posisi toast)
**Baca dulu:** `apps/web/src/components/ui/sonner.tsx` · `apps/web/src/app/(app)/components/AppToaster.tsx` · artifact Postific `project/components/Toaster`

Lahir dari T-164.6 (QA `next dev`, 2026-10-28): toast sonner default (kanan-bawah) menutupi tombol Publish/Unpublish di kartu Share `/start-page` pada viewport 1290px. Toast juga tidak hilang selama kursor di atasnya (sonner berhenti menghitung saat hover), sehingga klik pertama mengenai toast, bukan tombol. Rancangan artifact hanya mengunci komponen Toaster, tidak posisinya. **Gate UI (aturan #10):** pola posisi/penanganan belum dikunci; ditanyakan ke King Rezi sebelum kode.

- [x] **T-170.1** Pola dipilih King Rezi: `top-center` (opsi lain: kanan-bawah + tutup saat klik, kanan-atas).
- [x] **T-170.2** `AppToaster` memakai `position="top-center"` (satu properti; `sonner.tsx` tetap generik). Diverifikasi di `next dev` + browser: toast "Halaman di-unpublish." di x 382–738, y 24–77, tombol Publish/Unpublish (y 1213) tidak tertutup dan bisa diklik langsung. `tsc` bersih. Tanpa tes unit baru (satu properti presentasi, tidak ada logika). Rancangan artifact tidak mengunci posisi. **Artifact diselaraskan** (Neymar, artifact Postific versi 24, 2026-10-29): `project/components/Toaster/preview.html` memakai `position="top-center"` dan README Toaster mencatat bahwa `AppToaster` memakai top-center; preview belum dirender, tetapi penerusan prop `position` di `bundle.js` sudah dicek (wrapper Toaster meneruskan `...props` ke sonner). **Uji layar lain (2026-10-29):** desktop 1120px, zona toast (y 24-77) tidak menutup kontrol di `/`, `/publish`, `/engage`, `/analyze`, `/settings`, `/start-page` (kontrol terdekat di y 88-100, aman untuk satu toast; tumpukan beberapa toast bisa sesaat menyentuhnya). **Mobile 375px:** toast di y 14-67 menutupi tombol "Buka menu" (y 8-44), diperbaiki dengan `mobileOffset={{ top: 64 }}` di `AppToaster`; terverifikasi ulang (toast y 64-118, tidak ada kontrol tertutup). README artifact belum menyebut `mobileOffset`.

### Perbaikan code-review PR #200 (sudah dikerjakan)

Tiga perbaikan dari `/code-review` PR #200 sudah dikerjakan di branch yang sama (2026-10-28), dicatat di sini tanpa ID baru karena merupakan penyempurnaan kode T-070 sampai T-074 dan T-162 yang masih dalam PR yang sama (ADR-132 terpenuhi lewat tiket-tiket itu):

- [x] Fokus keyboard `LinkListCard`: `focusAfterMove` tidak dibersihkan sehingga fokus bisa melompat; kini dibersihkan.
- [x] Komentar `deleteLink` di service diperbaiki agar sesuai perilaku (pemadatan `position` dalam satu transaksi, T-162.2).
- [x] Timer `ShareCard` diperbaiki.

Temuan lain dari review yang tidak diperbaiki di PR ini ada di T-167.

---

## Catatan Rilis

- T-075–T-079 sengaja dikosongkan sebagai ruang penambahan task v0.6. Lanjutan memakai ID global berikutnya (T-159 sampai T-167), bukan ID dalam rentang ini.
- **Definition of Done rilis ini:** pengguna dapat membagikan halaman publik melalui media sosial.
- **Yang sengaja di luar rilis ini (`feature-priority.md`):** E-commerce Widgets (Won't Have).
