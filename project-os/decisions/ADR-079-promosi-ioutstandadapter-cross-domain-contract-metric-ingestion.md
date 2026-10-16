## Decision ADR-079

### Title

Promosi `IOutstandAdapter` jadi Cross-Domain Shared Contract + Fake Metric Ingestion (T-041) — Amandemen ADR-059

### Status

Accepted

### Date

2026-08-13

### Decision

King Rezi menyelesaikan T-041 (Metric ingestion job dari Outstand, v0.3 Analytics
MVP) memakai pola Fake/mock yang sama seperti ADR-059, karena kredensial
Outstand asli (`OUTSTAND_API_KEY`) masih belum ada (KI-003). Domain `analytics`
sekarang benar-benar butuh method fetch metrik dari adapter yang sama dipakai
domain `publishing` — memicu keputusan yang sudah diantisipasi ADR-059 poin 4.

1. **Promosi lokasi kontrak:** `IOutstandAdapter` dipindah dari domain-owned
   (`apps/web/src/domains/publishing/adapters/outstand-adapter.ts`) ke lokasi
   cross-domain netral `packages/shared/src/contracts/outstand-adapter.ts`,
   diekspor lewat `@social/shared`. `domains/publishing/adapters/outstand-adapter.ts`
   **dipertahankan sebagai barrel re-export** (bukan dihapus) supaya import
   existing di domain publishing tidak perlu diubah.
2. **Perluasan kategori isi `packages/shared`:** sebelumnya hanya ID branded/
   enum/value object (aturan keras AGENTS.md #8). Sekarang eksplisit
   ditambahkan satu kategori baru: **port/ACL contract** — interface murni
   tanpa implementasi/business logic (mis. `IOutstandAdapter`) yang dipakai
   lebih dari satu domain. Kategori ini tidak menggantikan aturan #6/#9
   (domain logic tetap tidak boleh mengimpor Prisma/Supabase/HTTP client
   Outstand langsung) — hanya bentuk kontraknya yang sekarang boleh tinggal
   di `packages/shared` kalau dipakai lintas domain.
3. **Method baru di kontrak:** `fetchPostMetrics(outstandJobId)` dan
   `fetchWorkspaceMetrics(outstandAccountId, period: "last_7_days" | "last_30_days")`
   — signature diambil persis dari `05-architecture/integration-layer.md` dan
   `05-architecture/background-jobs.md` (baseline resmi), bukan istilah baru
   yang dikarang saat implementasi.
4. **Implementasi Fake:** `FakeOutstandAdapter` (`apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts`)
   diperluas mengimplementasikan kedua method dengan data mock
   **deterministik** (hash FNV-1a dari id, bukan `Math.random()`) — supaya
   hasil ingestion konsisten dan reproducible antar test run. Fidelitas tetap
   mengikuti ADR-059: instant always-success, tanpa simulasi delay/gagal.
5. **Pola arsitektur:** `AnalyticsIngestionUseCase` (method `syncPostMetrics`,
   `syncWorkspaceSnapshot`) dibuat terpisah dari `AnalyticsService` (CRUD/read
   biasa) — mengikuti pola Use Case terpisah dari ADR-059 poin 5 (constructor
   type-safe untuk dependency tambahan `IOutstandAdapter`), persis seperti
   `SchedulePostsUseCase` di domain publishing.
6. **Idempotensi lewat Prisma `upsert` asli:** `IAnalyticsRepository`
   di-extend dengan `upsertPostMetrics`/`upsertWorkspaceSnapshot`, diimplementasikan
   sebagai Prisma `upsert` (bukan insert-check-manual) di atas unique
   constraint baru `@@unique([postId, connectedAccountId])` pada model
   `AnalyticsPostMetric` — migration `20260813023329_add_analytics_post_metric_unique`
   sudah dijalankan ke DB dev Supabase.
7. **Scope eksplisit di luar T-041 ini:** real Outstand API call (tetap scope
   T-025), cron/job scheduler asli via Railway (tetap scope T-027), dan
   perhitungan `topPostId` (perlu query agregat terpisah, bukan bagian dari
   5 subtask T-041).

### File yang terdampak

- `packages/shared/src/contracts/outstand-adapter.ts` (baru)
- `apps/web/src/domains/analytics/services/analytics-ingestion.use-case.ts` (baru)
- `apps/web/src/domains/publishing/adapters/outstand-adapter.ts` (jadi re-export)
- `apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts` (extend)
- `apps/web/src/domains/analytics/repositories/analytics.repository.ts` + implementasi Prisma-nya (extend, method write baru)
- `apps/web/prisma/schema.prisma` (unique constraint baru) + migration `20260813023329_add_analytics_post_metric_unique`

### Reason

- Menunggu kredensial Outstand asli akan memblokir seluruh pengerjaan T-041
  dan turunannya (T-042 Dashboard Home), padahal domain logic dan persistensi
  Prisma bisa dikerjakan dan diuji penuh tanpa network call sungguhan — sama
  seperti alasan ADR-059 untuk publishing.
- Instruksi task eksplisit meminta `publishing` dan `analytics` sama-sama
  consume dari satu lokasi kontrak yang sama, dan cross-domain harus lewat
  lokasi netral, bukan import internal domain lain (AGENTS.md #7).
- Data mock deterministik (hash id) dipilih di atas random — supaya test dan
  hasil ingestion konsisten/reproducible, bukan berubah-ubah tiap run,
  memudahkan verifikasi idempotensi (T-041.5).
- `AnalyticsIngestionUseCase` terpisah dari `AnalyticsService` menjaga
  type-safety constructor untuk operasi CRUD/read biasa — konsisten dengan
  precedent ADR-059 poin 5.

### Alternatives Considered

- **Interface segregation per-domain** (tiap domain punya port `IOutstandAdapter`
  sendiri, lebih murni Hexagonal/ISP) — ditolak karena instruksi task
  eksplisit meminta `publishing` dan `analytics` sama-sama consume dari satu
  lokasi yang sama, dan duplikasi kontrak untuk API eksternal yang sama
  berisiko divergensi (mis. dua definisi `fetchPostMetrics` yang perlahan
  berbeda bentuk).
- **Menunggu kredensial Outstand asli sebelum lanjut T-041** — ditolak,
  sama seperti alasan ADR-059: akan memblokir progress yang sepenuhnya bisa
  dikerjakan tanpa network call sungguhan.
- **Data mock random per call** — ditolak karena membuat test/ingestion tidak
  reproducible; hash deterministik dari id dipilih supaya hasil konsisten
  antar run.
- **Insert-check-manual untuk idempotensi** (query dulu, lalu insert/update
  manual) — ditolak, Prisma `upsert` asli di atas unique constraint DB lebih
  aman terhadap race condition dan lebih sedikit kode.
