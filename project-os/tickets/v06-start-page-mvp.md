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

`⏳ Not Started` · **Domain** start-page · infra · **ADR** ADR-143 · **Depends** rilis v0.6 ke produksi dengan trafik nyata
**Baca dulu:** T-162.1 · T-164.6

Dua sisa T-164.6 yang tidak bisa diverifikasi tanpa trafik nyata atau perangkat Apple:

- [ ] **T-171.1** Pantau rasio `view_count` terhadap `click_count` setelah rilis. Bila view jauh di bawah klik, filter Fetch Metadata (T-162.1) terlalu ketat dan perlu ditinjau (keputusan King Rezi tetap fail-closed).
- [ ] **T-171.2** Cek `/u/<slug>` di Safari asli (iOS dan macOS), termasuk Safari <16.4 dan in-app browser: tampilan, 0 pelanggaran CSP, dan view/klik terhitung. WebKit Playwright (sesi T-164.6) sudah lolos tetapi bukan Safari sungguhan.

### T-166 · 404 publik kustom untuk `/u/[slug]` tanpa inline style

`⏳ Not Started` · **Domain** start-page · UI · **ADR** ADR-144 · **Depends** T-160 ✅, rancangan artifact
**Baca dulu:** `06-engineering/rendering-strategy.md` § RS-D08 · `context/ctx-design.md`

404 bawaan Next di `/u/<slug tak ada>` menyuntik `<style>` tanpa nonce (1 pelanggaran `style-src-elem`, kosmetik). Buat `app/u/[slug]/not-found.tsx` tanpa inline style. **Gate UI (aturan #10):** butuh rancangan di artifact Postific dan konfirmasi King Rezi sebelum kode.

### T-167 · Hardening repository dan tes Start Page (lanjutan code-review PR #200, prioritas rendah)

`⏳ Not Started` · **Domain** start-page · **ADR** ADR-144 · **Depends** PR #200 di-merge
**Baca dulu:** `apps/web/src/lib/repositories/start-page/start-page-write.repository.ts` · T-162.2 · T-162.3

Lahir dari `/code-review` PR #200 (branch `feature/t-070-start-page-public-route`). Tidak ada Critical/High; semuanya hardening, tidak memblokir merge.

- [ ] **T-167.1** `addLink` (`start-page-write.repository.ts`): `position` dari `MAX+1` dan batas 50 tautan dicek tanpa lock. Dua tambah bersamaan bisa menghasilkan posisi kembar atau 51 tautan sehingga reorder gagal. Perbaikan: hitung dan insert dalam satu transaksi dengan `SELECT ... FOR UPDATE` pada baris halaman; sekaligus kunci race `deleteLink`/`reorderLinks` (T-162.2 menerima race ini sebagai LOW).
- [ ] **T-167.2** `addLink` di service memuat seluruh halaman dan tautan lewat `findByWorkspace` hanya untuk hitung/cek. Ganti dengan count/exists di repository dalam transaksi yang sama (digabung T-167.1).
- [ ] **T-167.3** `reorderLinks` dan pemadatan `deleteLink` melakukan sampai 50 `UPDATE` berurutan. Jadikan satu query (`UPDATE ... FROM unnest/VALUES`).
- [ ] **T-167.4** Klik dihitung di fungsi SQL `start_page_record_click_and_get_url` sebelum URL divalidasi ulang oleh `sanitizeLinkUrl`. URL seperti `https://user:pw@host/` lolos regex SQL tapi ditolak aplikasi, sehingga klik terhitung lalu 404. Hanya mungkin untuk baris manual/lama. Selaraskan validasi SQL dengan `sanitizeLinkUrl` atau terima (terkait F4 di T-162).
- [ ] **T-167.5** Tes interaksi komponen (keyboard reorder `LinkListCard`, timer `ShareCard`): `StartPageEditor.test.tsx` hanya memakai `renderToStaticMarkup`. Butuh setup testing interaksi (mis. `@testing-library`) bila diinginkan.

### T-170 · Toast tidak menutupi tombol aksi di `/start-page`

`✅ Done` (2026-10-28; keputusan King Rezi: `top-center`) · **Domain** UI (`AppToaster`, seluruh area `(app)`) · **ADR** ADR-097 · **Depends** keputusan King Rezi (pola posisi toast)
**Baca dulu:** `apps/web/src/components/ui/sonner.tsx` · `apps/web/src/app/(app)/components/AppToaster.tsx` · artifact Postific `project/components/Toaster`

Lahir dari T-164.6 (QA `next dev`, 2026-10-28): toast sonner default (kanan-bawah) menutupi tombol Publish/Unpublish di kartu Share `/start-page` pada viewport 1290px. Toast juga tidak hilang selama kursor di atasnya (sonner berhenti menghitung saat hover), sehingga klik pertama mengenai toast, bukan tombol. Rancangan artifact hanya mengunci komponen Toaster, tidak posisinya. **Gate UI (aturan #10):** pola posisi/penanganan belum dikunci; ditanyakan ke King Rezi sebelum kode.

- [x] **T-170.1** Pola dipilih King Rezi: `top-center` (opsi lain: kanan-bawah + tutup saat klik, kanan-atas).
- [x] **T-170.2** `AppToaster` memakai `position="top-center"` (satu properti; `sonner.tsx` tetap generik). Diverifikasi di `next dev` + browser: toast "Halaman di-unpublish." di x 382–738, y 24–77, tombol Publish/Unpublish (y 1213) tidak tertutup dan bisa diklik langsung. `tsc` bersih. Tanpa tes unit baru (satu properti presentasi, tidak ada logika). Rancangan artifact tidak mengunci posisi. **Artifact diselaraskan** (Neymar, artifact Postific versi 24, 2026-10-29): `project/components/Toaster/preview.html` memakai `position="top-center"` dan README Toaster mencatat bahwa `AppToaster` memakai top-center; preview belum dirender dan penerusan prop `position` di `bundle.js` belum dicek. Posisi top-center baru diuji di `/start-page` desktop, belum di layar lain dan mobile.

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
