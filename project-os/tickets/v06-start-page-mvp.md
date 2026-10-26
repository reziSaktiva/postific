# v0.6 — Start Page MVP

> Bagian dari backlog berjenjang. Antrian: [`../AVAILABLE_TICKETS.md`](../AVAILABLE_TICKETS.md). Tiket selesai tetap di file ini. Deskripsi baru: ADR-131. Nama folder: ADR-132.

**Tujuan rilis:** Menyediakan halaman publik untuk kebutuhan bio link.
**Baseline rilis:** `product-discovery/02-product/release-roadmap.md` → v0.6

**Kedalaman dokumen ini:** task-level saja (rolling wave). **Subtask sengaja belum diisi** — akan dirinci saat rilis ini mendekat. ID task sudah dikunci sejak sekarang agar bisa dirujuk.

**Titik awal:** domain `start-page/` masih stub kosong. Model `StartPagePage` + `StartPageLink` **sudah ada** di schema. Route `/start-page` (halaman pengaturan, bukan halaman publik — lihat T-070/T-071 untuk itu) masih placeholder — saat ini masih di bawah dynamic segment lama `[slug]`, tapi baseline routing sudah pindah ke route group `(app)` (ADR-076); kalau **T-039** (migrasi kode, `tickets/v01-foundation.md`) belum selesai saat task rilis ini dikerjakan, bangun langsung di `(app)/start-page` — jangan menambah route baru di `[slug]/...` lama.

> ⚠️ **Karakter khusus rilis ini:** ini satu-satunya rilis yang menghasilkan **halaman publik tanpa autentikasi**. Seluruh arsitektur sekarang mengasumsikan setiap request melewati auth guard di `proxy.ts` dan berada di dalam workspace scope. Rilis ini melanggar asumsi itu, jadi butuh perhatian arsitektur lebih awal — lihat T-070.

---

### T-070 · Start Page domain skeleton + strategi route publik

`⏳ Not Started` (subtask T-070.1, ADR strategi routing, sudah ✅ lewat ADR-128; implementasi kode belum dimulai) · **Domain** start-page · **ADR** ADR-017, ADR-024, ADR-031, ADR-128 · **Depends** T-002 ✅
**Baca dulu:** `05-architecture/auth-architecture.md` · `apps/web/src/proxy.ts` · `05-architecture/database-strategy.md` · ADR-128

Service + repository, plus keputusan arsitektur: di mana route publik hidup, bagaimana ia melewati auth guard, bagaimana RLS diperlakukan untuk data yang memang publik, dan apakah pakai custom domain atau subpath. **Keputusan arsitektur sudah dikunci di ADR-128 (2026-10-16): subpath `/u/[slug]`, bukan custom domain** — subtask di bawah mengikuti keputusan itu.

**Subtask:**

- **T-070.1 — ADR strategi routing publik** · ✅ Done (ADR-128, 2026-10-16)
  Dokumentasikan keputusan subpath `/u/[slug]` vs custom domain.

- **T-070.2 — Repository interface publik**
  `StartPagePageRepository` / `StartPageLinkRepository`: query by `slug`
  yang hanya mengembalikan field aman untuk audiens anonim (tanpa data
  internal workspace).

- **T-070.3 — Application Service `GetPublicStartPageBySlug`**
  Use-case murni tanpa dependency session/workspace context — dipanggil
  dari route publik, bukan dari area yang dijaga Middleware.

- **T-070.4 — Bypass route `/u/[slug]` di `proxy.ts`**
  Tambah ke `BYPASS_PREFIXES` (pola sama `/invite/[token]`), bukan ke
  `PUBLIC_AUTH_PATHS` (supaya tidak redirect user yang sudah login ke `/`).
  Server Component halaman publik resolve data lewat T-070.3.

- **T-070.5 — RLS policy akses anon**
  Policy baca publik di `StartPagePage`/`StartPageLink` (hanya row
  berstatus "published"), tetap application-enforced sebagai primary check
  (AU-D06) — RLS sebagai defense-in-depth.

- **T-070.6 — Slug validation & reserved words**
  Format slug, cek uniqueness, dan daftar reserved path (`/u/login`,
  `/u/api`, dst.) supaya tidak bentrok dengan route lain.

- **T-070.7 — Test akses publik tanpa session**
  Verifikasi `/u/[slug]` bisa diakses tanpa cookie session sama sekali
  (curl langsung, bukan hanya browser login) — pola sama seperti bug
  webhook T-026 yang ditemukan lewat curl asli.

### T-071 · Public profile page

`⏳ Not Started` · **Domain** start-page · UI · **ADR** ADR-046, ADR-129 · **Depends** T-070
**Baca dulu:** `04-ux/key-screen-patterns.md` · `04-ux/information-architecture.md` · ADR-129 · artifact Postific `project/templates/start-page-option-b-card-stack.html` (LOCKED PATTERN)

**Must Have.** Halaman publik yang bisa dibagikan lewat media sosial. Perlu perhatian pada SEO/meta tag, caching, dan performa — ini satu-satunya halaman yang dilihat audiens, bukan pengguna produk.

**Layout sudah dikunci (ADR-129, 2026-10-16):** pola **Card Stack** — header
horizontal (avatar kiri, nama+bio kanan), tautan sebagai card (border +
shadow) dengan leading icon + chevron, badge "Powered by Postific" di
footer. Dipilih dari 4 opsi eksplorasi Claude Design (grup `Start Page
(Exploration, T-071)`); 3 opsi lain (Classic Centered, Hero Banner, Minimal
Dense) disimpan sebagai referensi, tidak dipakai. Mark UI Engineer **wajib**
membaca template terkunci ini lewat tool `Artifact` action `read` pada artifact
Postific (ADR-140) sebelum menulis kode (gate T-103.3) — jangan menebak struktur dari deskripsi ADR saja.

### T-072 · Link management

`⏳ Not Started` · **Domain** start-page · UI · **ADR** ADR-130 · **Depends** T-070
**Baca dulu:** `02-product/mvp-definition.md` · ADR-130 · artifact Postific `project/templates/start-page-editor.html` (LOCKED, App Prototype)

**Must Have.** CRUD daftar tautan + urutan tampil. Pertimbangkan konfirmasi hapus tautan (ADR-049).

**Layar sudah dikunci (ADR-130, 2026-10-16):** "Start Page → Page Editor"
(`templates/start-page-editor.html`) — Profil Halaman, **Link List sebagai
Table tanpa header** (bukan Item/ItemGroup atau card-per-item, dipilih King
Rezi setelah Neymar menahan diri tidak menebak, gate T-103.2), Preview yang
me-reuse struktur Opsi B Card Stack (ADR-129), dan Share (URL publik + toggle
Published/Unpublished). Sudah disambungkan ke nav "Start Page" di App
Prototype (7 template). Mark UI Engineer **wajib** membaca
layar ini lewat tool `Artifact` action `read` pada artifact Postific (ADR-140)
sebelum menulis kode (gate T-103.3).

### T-073 · Theme configuration

`⏳ Not Started` · **Domain** start-page · UI · **ADR** ADR-038, ADR-041 · **Depends** T-071
**Baca dulu:** `06-engineering/design-tokens.md`

Berstatus **Should Have** di `feature-priority.md`. Tentukan hubungannya dengan design tokens produk: apakah tema Start Page memakai token yang sama, atau punya set sendiri yang bebas diubah pengguna.

### T-074 · Basic analytics Start Page

`⏳ Not Started` · **Domain** start-page · analytics · **ADR** ADR-018 · **Depends** T-071, T-040
**Baca dulu:** `02-product/feature-priority.md`

Berstatus **Could Have** — hitungan kunjungan + klik per tautan. Ambil/kirim data lintas domain lewat public API, bukan query tabel domain lain langsung.

---

## Catatan Rilis

- T-075–T-079 sengaja dikosongkan sebagai ruang penambahan task v0.6.
- **Definition of Done rilis ini:** pengguna dapat membagikan halaman publik melalui media sosial.
- **Yang sengaja di luar rilis ini (`feature-priority.md`):** E-commerce Widgets (Won't Have).
