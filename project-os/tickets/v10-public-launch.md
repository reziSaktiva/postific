# v1.0 — Public Launch

> Bagian dari backlog berjenjang. Antrian: [`../AVAILABLE_TICKETS.md`](../AVAILABLE_TICKETS.md). Tiket selesai tetap di file ini. Deskripsi baru: ADR-131. Nama folder: ADR-132.

**Tujuan rilis:** Meluncurkan produk kepada publik.
**Baseline rilis:** `product-discovery/02-product/release-roadmap.md` → v1.0

**Kedalaman dokumen ini:** task-level saja (rolling wave). **Subtask sengaja belum diisi** — akan dirinci saat rilis ini mendekat. ID task sudah dikunci sejak sekarang agar bisa dirujuk.

**Karakter rilis ini:** tidak menambah fitur baru. Isinya pengerasan (hardening) atas apa yang sudah dibangun v0.1–v0.6, sesuai `release-roadmap.md`: Stabilitas · Performance · Security · Documentation · Bug Fixing · UX Improvement.

---

## Stabilitas & Test Coverage

### T-080 · Test coverage repository + Server Actions

`⏳ Not Started` · **Domain** platform · **ADR** ADR-034 · **Depends** —
**Baca dulu:** `06-engineering/dx-tooling.md`

Saat ini test hanya menutup service domain (`publishing`, `workspace`, `slugify`, enums shared) dengan repository fake. **Belum ada** test untuk implementasi repository Prisma, Server Actions, maupun adapter Outstand. Catatan (diperbarui 2026-10-23): script `test` (`vitest run`) kini ada di root `package.json` dan ratusan test lulus (mis. 919 pada T-140), termasuk test repository Prisma dan adapter Outstand (mis. `import-job.repository.test.ts`, `real-outstand-adapter.test.ts`); yang masih belum ada: test Server Actions, test komponen React, dan E2E.

### T-081 · E2E test suite

`⏳ Not Started` · **Domain** platform · **ADR** ADR-034, ADR-149 (Playwright dengan Chrome ditetapkan 2026-10-28) · **Depends** T-172 ✅, T-173, T-174 (fondasi E2E) · T-018 ⏸️ Deferred sejak ADR-070, tidak lagi memblokir
**Baca dulu:** `06-engineering/dx-tooling.md` · `06-engineering/cicd-pipeline.md`

Framework E2E sudah ditetapkan: Playwright dengan Chrome (ADR-149, spec S-002); fondasinya dibangun di T-172 sampai T-176 (`tickets/v01-foundation.md`). Tiket ini tetap menjadi suite golden path MVP lintas fitur di atas fondasi itu: connect account → buat draft → schedule → lihat hasil. Belum ada test komponen React (tidak ada testing-library).

> Catatan historis: tiket ini dulu bergantung pada T-018 (hydration lewat tunnel). T-018 ⏸️ Deferred sejak ADR-070, jadi tidak lagi memblokir.

### T-082 · Bug bash & UX polish

`⏳ Not Started` · **Domain** semua · **ADR** — · **Depends** v0.1–v0.6 selesai
**Baca dulu:** `04-ux/ux-principles.md` · `03-user/user-scenarios.md`

Sapuan menyeluruh terhadap golden path tiap persona kanonikal (Raka, Maya, Sinta, Dimas, Lara) dan penyelesaian Known Issues yang tersisa.

---

## Performance

### T-083 · Performance pass

`⏳ Not Started` · **Domain** platform · **ADR** ADR-028 · **Depends** v0.1–v0.6 selesai
**Baca dulu:** `06-engineering/deployment-infrastructure.md`

Query N+1, indeks database, ukuran bundle, waktu render RSC, dan latensi lintas region (Railway + Supabase co-located di Singapore). Tetapkan target angka sebelum mulai mengoptimalkan.

---

## Security

### T-084 · Security review

`⏳ Not Started` · **Domain** platform · **ADR** ADR-024, ADR-020, ADR-033 · **Depends** T-017 (RLS)
**Baca dulu:** `05-architecture/auth-architecture.md` · `06-engineering/auth-strategy.md` · `06-engineering/environment-management.md`

Cakupan minimal: RLS aktif dan terbukti menolak akses lintas workspace, RBAC ditegakkan di application layer (bukan hanya disembunyikan di UI), rate limiting Better Auth, verifikasi HMAC webhook, penanganan secret, dan tidak ada token pihak ketiga tersimpan di DB internal (ADR-021).

### T-085 · Audit logs

`⏳ Not Started` · **Domain** platform · **ADR** — · **Depends** T-007, T-008
**Baca dulu:** `02-product/feature-modules.md` (Infrastructure Modules)

Tercatat sebagai Infrastructure Module di `feature-modules.md` tapi belum punya model di schema maupun ADR. Prioritaskan aksi destruktif/berdampak tinggi lebih dulu: Delete Workspace, Transfer Ownership, Remove Member, Disconnect Account.

### T-086 · Observability & monitoring

`⏳ Not Started` · **Domain** platform · **ADR** — **berpotensi butuh ADR baru** (tool belum ditetapkan) · **Depends** T-027
**Baca dulu:** `06-engineering/deployment-infrastructure.md` · `05-architecture/background-jobs.md`

Tercatat sebagai Infrastructure Module tapi tool-nya belum pernah diputuskan. Yang paling dibutuhkan: visibilitas kegagalan background job dan webhook — dua jalur yang gagal tanpa ada pengguna yang melihatnya.

---

## Documentation & Release

### T-087 · Dokumentasi untuk pengguna

`⏳ Not Started` · **Domain** — · **ADR** — · **Depends** v0.1–v0.6 selesai
**Baca dulu:** `01-business/product-vision.md` · `03-user/user-personas.md`

Dokumentasi yang dibaca **pengguna produk**, terpisah dari dokumentasi internal di `project-os/` dan `product-discovery/`. Tentukan lokasi dan bentuknya (belum pernah diputuskan).

### T-088 · Production readiness checklist

`⏳ Not Started` · **Domain** platform · **ADR** ADR-029, ADR-032, ADR-033 · **Depends** semua task di atas
**Baca dulu:** `06-engineering/cicd-pipeline.md` · `06-engineering/deployment-infrastructure.md` · `06-engineering/environment-management.md`

Verifikasi jalur staging → production: migrate-on-release, env var lengkap di kedua tier, rollback plan, backup DB, dan domain/DNS. Termasuk KI-028: environment Railway `production` dan project Supabase production belum ada.

- [ ] **T-088.1** (dari T-175.3, ditunda 2026-10-29) Jadikan check **E2E staging** required check untuk PR `staging` → `main` (Settings → Branches → rule `main`, di samping "Quality gates"). Workflow sudah terbukti jalan (T-175). **AI wajib mengingatkan King Rezi tentang ini saat v1.0 / MVP public launch dimulai.**

---

## Catatan Rilis

- Penomoran mulai T-080 (bukan T-070) supaya v0.6 punya ruang tumbuh.
- **Definition of Done rilis ini:** produk siap digunakan secara umum.
- **Yang sengaja di luar seluruh MVP (`mvp-definition.md` → Out of Scope):** White Label, Mobile Application, Browser Extension, Marketplace, Public API, Plugin System, Enterprise SSO, Advanced Workflow Automation, Multi Workspace Management. Endpoint mobile aktual `/api/v1` (ADR-043) juga di luar MVP dan dikerjakan setelah MVP web selesai — **tapi skema route + konfigurasi Bearer plugin-nya punya task sendiri yang sengaja dikerjakan lebih awal: T-019 di v0.1.**
- **Billing** (`feature-modules.md` → Supporting Modules) tidak muncul di rilis manapun di `release-roadmap.md` dan tidak ada di Must Have `mvp-definition.md`. Sengaja **tidak** dimasukkan ke backlog sampai ada keputusan eksplisit — jangan diasumsikan bagian v1.0.
