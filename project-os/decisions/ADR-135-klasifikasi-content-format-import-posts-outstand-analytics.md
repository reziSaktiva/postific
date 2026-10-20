## Decision ADR-135

### Title

Klasifikasi `ContentFormat` (Post/Reel/Story) Post Hasil Import via Outstand
Analytics — Perluasan `FetchPostMetricsResult`

### Status

Accepted

### Date

2026-10-20

### Decision

`IOutstandAdapter.fetchPostMetrics`/`FetchPostMetricsResult`
(`packages/shared/src/contracts/outstand-adapter.ts`) diperluas dengan TIGA
field opsional baru, dibaca dari entri **PERTAMA** `metrics_by_account[]`
pada response asli `GET /v1/posts/{id}/analytics` (bentuk ini dikonfirmasi
langsung lewat MCP resmi Outstand, 2026-10-20, terhadap post nyata akun test
— lihat `Reason` untuk payload lengkap):

```ts
export interface FetchPostMetricsResult {
  // ...field lama (impressions/reach/likes/comments/shares/clicks/engagementRate)
  // tidak berubah...
  mediaProductType?: "FEED" | "REELS" | "STORY";
  isReel?: boolean;
  storyExpired?: boolean;
}
```

**Sumber field per platform (dikonfirmasi lewat MCP `get_post_analytics`
terhadap post nyata):**

- **Instagram** — `metrics_by_account[0].metrics.media_product_type`
  (`"FEED" | "REELS" | "STORY"`), dikonfirmasi post `MAnO3`
  (`media_product_type: "FEED"`).
- **Facebook** — `metrics_by_account[0].metrics.platform_specific.video.is_reel`
  (`boolean`), dikonfirmasi post `LGyF6` (`is_reel: true`) — post ini
  tersimpan di DB kita dengan `contentFormat: 'post'` hardcode, padahal
  aslinya Reel (bukti nyata bug yang ditutup ADR ini, bukan hipotesis).
- **Story yang sudah expired (>24 jam)** — dikonfirmasi post Instagram
  Story `l21bW` (dipublish 2026-09-26, dicek 2026-10-20): response TETAP
  `success: true`, tapi entri akun itu punya `metrics: null` dan
  `metrics_error: { code: "metrics_expired", message: "Insights for media
... are no longer available - the story has likely expired" }`. Panggilan
  **tidak** melempar HTTP error — ini bentuk sukses-tapi-kosong, bukan
  exception yang perlu di-catch terpisah.

**Mapping ke `ContentFormat` internal (fungsi murni
`mapFetchPostMetricsToContentFormat`, dipakai
`ClassifyImportedPostTargetsUseCase`, T-132.4):**

| Platform                           | Sinyal                                  | Hasil mapping                                                                                                   |
| ---------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Instagram                          | `mediaProductType === "FEED"`           | `ContentFormat.Post`                                                                                            |
| Instagram                          | `mediaProductType === "REELS"`          | `ContentFormat.Reel`                                                                                            |
| Instagram                          | `mediaProductType === "STORY"`          | `ContentFormat.Story`                                                                                           |
| Instagram                          | `mediaProductType` kosong/tidak dikenal | **Fallback eksplisit** — tidak di-overwrite (lihat poin 4)                                                      |
| Facebook                           | `isReel === true`                       | `ContentFormat.Reel`                                                                                            |
| Facebook                           | `isReel === false`                      | `ContentFormat.Post` (Facebook belum punya sinyal Story resmi di endpoint ini)                                  |
| Facebook                           | `isReel` kosong (`undefined`)           | **Fallback eksplisit** — tidak di-overwrite                                                                     |
| Platform manapun                   | `storyExpired === true`                 | **Fallback eksplisit** — tidak di-overwrite (lihat poin 4)                                                      |
| Platform selain Instagram/Facebook | —                                       | **Fallback eksplisit** — belum ada sinyal resmi Outstand untuk platform ini di endpoint ini, tidak di-overwrite |

**Poin keputusan tambahan:**

1. **Entri PERTAMA `metrics_by_account[]` saja yang dibaca** — kontrak
   `FetchPostMetricsResult` TETAP flat (satu hasil per `outstandPostId`,
   bukan array per akun; revisi penuh bentuk kontrak tetap follow-up T-041,
   TIDAK diubah ADR ini). Ini cukup untuk SATU-SATUNYA caller field baru ini
   saat ini (`ClassifyImportedPostTargetsUseCase`, T-132.4), yang selalu
   memanggil `fetchPostMetrics` untuk post hasil Import — SATU native
   platform post = SATU akun = SATU entri `metrics_by_account`. Kalau
   `outstandPostId` ternyata post multi-akun (hasil `schedulePost`/
   `publishNow` lintas akun lewat app ini), method ini TIDAK membedakan per
   akun untuk 3 field baru ini — bukan bug diam-diam, dicatat di sini
   sebagai batas scope eksplisit.
2. **Best-effort, terpisah dari proses import utama** (pola sama T-114
   `BackfillOutstandPostIdsUseCase`) — `ClassifyImportedPostTargetsUseCase`
   dipanggil SETELAH `ImportPostsProcessUseCase.process` selesai pada
   `ImportPostsTriggerUseCase.runImportJob`, gagal di sini (satu post atau
   seluruh batch) TIDAK membatalkan post yang sudah berhasil diimpor.
   Kegagalan per-post (network error, Outstand down, dll — BUKAN
   `storyExpired`, yang bukan kegagalan) ditangkap per post, lanjut ke post
   berikutnya dalam batch yang sama.
3. **Diterapkan ke SEMUA post yang berhasil diimpor per sync** (N = limit
   trigger yang sedang jalan, T-131 — bukan dibatasi angka tetap).
4. **Fallback eksplisit = TIDAK MENULIS `contentFormat`** — baris
   `PublishingPostTarget` yang tidak dapat diklasifikasikan (sinyal kosong,
   platform tidak didukung, atau `storyExpired`) dibiarkan dengan nilai
   default yang sudah diisi `upsertImportedPosts` (ADR ini TIDAK membuat
   enum `ContentFormat` baru untuk "belum terklasifikasi" — `ContentFormat`
   tetap `Post`/`Reel`/`Story`/`Pin` seperti didesain ADR-039; default
   placeholder tetap `ContentFormat.Post`, didokumentasikan eksplisit di
   `upsert-imported-posts.ts` sebagai keterbatasan Outstand, BUKAN asumsi
   "semua post memang Post"). Sinkronisasi berikutnya untuk akun yang sama
   TIDAK otomatis mencoba ulang baris yang gagal diklasifikasikan — tidak
   ada mekanisme retry/mark-skipped terpisah untuk klasifikasi (beda dari
   T-114 backfill `outstandPostId`, yang punya `outstandIdBackfillSkippedAt`)
   karena sinyal `storyExpired`/`mediaProductType` kosong untuk SATU
   `outstandPostId` bersifat permanen (riwayat Outstand untuk id itu tidak
   berubah) — mencoba ulang tidak akan menghasilkan sinyal baru.

Keputusan ini mengamendemen catatan gap `FetchPostMetricsResult` di
`packages/shared/src/contracts/outstand-adapter.ts` (dicatat sejak redesain
2026-08-26, follow-up T-041) — HANYA untuk 3 field baru ini; bentuk
kontrak lain (flat vs per-akun penuh) tetap seperti didokumentasikan di
sana.

### Reason

- Endpoint import Outstand (`GET /v1/posts`, `GET /v1/posts/{id}`) tidak
  punya field jenis konten sama sekali — dipastikan lewat OpenAPI resmi DAN
  data nyata (post Story asli di akun test tidak punya field pembeda apa
  pun). Satu-satunya sinyal RESMI ada di `GET /v1/posts/{id}/analytics`.
- Heuristik URL/aspek-rasio media ditolak eksplisit oleh King Rezi (sesi
  `AskUserQuestion`, 2026-10-20) setelah riset sendiri ke dokumentasi
  Outstand — sinyal analytics resmi lebih dapat dipercaya walau tidak
  selalu tersedia (Story expired).
- Verifikasi langsung lewat MCP resmi `mcp.outstand.so`
  (`get_post_analytics`) terhadap 3 post nyata (`MAnO3` Instagram FEED,
  `LGyF6` Facebook Reel, `l21bW` Instagram Story expired) membuktikan bug
  nyata (post Facebook Reel tersimpan `contentFormat: 'post'` di DB kita)
  dan mengonfirmasi bentuk response `metrics_error.code: "metrics_expired"`
  untuk Story kadaluarsa — bukan tebakan, konsisten dengan budaya project
  ini (`real-outstand-adapter.ts` selalu menandai field yang "diverifikasi
  terhadap OpenAPI/MCP resmi" vs yang masih tebakan).
- Best-effort terpisah dari import utama mengikuti pola T-114 yang sudah
  terbukti aman di produksi — satu gagal tidak boleh membatalkan batch
  import yang sudah sukses.

### Alternatives Considered

- **Heuristik URL (`/stories/` di `platformPostUrl`) atau aspek rasio
  media** — ditolak eksplisit oleh King Rezi; tidak resmi, dan Outstand
  sendiri punya sinyal resmi yang lebih baik walau parsial.
- **Revisi penuh `FetchPostMetricsResult` jadi bentuk per-akun
  (`metrics_by_account[]` + `aggregated_metrics` apa adanya)** — ditolak
  untuk ADR ini (scope creep, bukan kebutuhan T-132); tetap follow-up T-041
  seperti sudah dicatat sebelumnya.
- **Tambah nilai enum `ContentFormat.Unclassified`** — ditolak; AGENTS.md/
  baseline domain (ADR-039) sudah mengunci `ContentFormat` ke
  `Post`/`Reel`/`Story`/`Pin`, dan menambah nilai baru untuk "belum tahu"
  akan bocor ke UI picker format publish biasa (yang tidak boleh punya
  opsi "belum terklasifikasi"). Fallback diam ke `Post` + komentar eksplisit
  dipilih sebagai gantinya.
- **Retry/mark-skipped untuk baris yang gagal diklasifikasikan (pola T-114
  `outstandIdBackfillSkippedAt`)** — ditolak untuk sekarang; sinyal
  `media_product_type`/`is_reel` untuk satu `outstandPostId` yang sudah
  diketahui kosong/expired tidak akan berubah di masa depan, beda dari gap
  `outstandPostId` T-114 yang bisa terisi belakangan dari riwayat Outstand
  yang lebih lengkap.
- **Classification dipanggil sinkron di tengah `upsertImportedPosts`
  (transaksi DB yang sama)** — ditolak; `fetchPostMetrics` adalah network
  call per post (bisa lambat/gagal), tidak boleh ikut transaksi DB import
  utama (konsisten pola T-114: network call Outstand SELALU di luar
  transaksi tulis).

---
