## Decision ADR-123

### Title

Wiring `RealOutstandAdapter.importPosts`/`fetchImportJobStatus` sungguhan —
breaking change signature `fetchImportJobStatus` (+`outstandAccountId`) +
pemetaan status `partial` real API → `"completed"` (T-112)

### Status

Accepted

### Date

2026-10-08

### Decision

T-112 menutup gap yang ditinggalkan T-090 (✅ Done tanpa wiring HTTP
sungguhan — `RealOutstandAdapter.importPosts`/`fetchImportJobStatus`
sengaja stub-throw, ADR-093/ADR-119). Dua keputusan non-trivial berikut
disetujui langsung oleh King Rezi lewat `AskUserQuestion` di sesi ini
(2026-10-08), SEBELUM kode ditulis:

1. **Breaking change signature kontrak publik
   `IOutstandAdapter.fetchImportJobStatus`** (`packages/shared/src/
   contracts/outstand-adapter.ts`) — dari `(importJobId: string)` menjadi
   `(outstandAccountId: string, importJobId: string)`. Verifikasi OpenAPI
   spec resmi Outstand (`https://api.outstand.so/v1/social-accounts/
   openapi.json`, diambil 2026-10-08) menunjukkan endpoint sungguhan
   `GET /v1/social-accounts/{outstandAccountId}/imports/{importJobId}`
   mensyaratkan account id DI PATH — signature lama (ditulis saat T-090,
   sebelum endpoint ini pernah diverifikasi) salah tebak bahwa
   `importJobId` saja cukup untuk mengidentifikasi job secara global.
   Call site terdampak: `ImportPostsTriggerUseCase.runImportSync`
   (`apps/web/src/domains/publishing/services/
   import-posts-trigger.use-case.ts`), sudah diupdate menyuplai
   `input.outstandAccountId`.

   **Gap kedua yang ditemukan di verifikasi yang sama:** response
   `GET /v1/social-accounts/{id}/imports/{importId}` ternyata TIDAK
   membawa data post sama sekali — hanya angka ringkasan
   `imported`/`skipped`/`failed`. Data post lengkap (`platformPostId`,
   `caption`, `publishedAt`, `platformPostUrl`, `mediaUrls`) harus diambil
   lewat panggilan HTTP KEDUA: `GET /v1/posts?social_account_id=...`
   (field `containers[]` + `socialAccounts[]`, diverifikasi TERPISAH
   terhadap `api.outstand.so/v1/posts/openapi.json` untuk endpoint LIST,
   bukan diekstrapolasi dari endpoint singular `GET /v1/posts/{id}` yang
   sudah dipakai `fetchPostOutcome`), lalu difilter manual: untuk tiap
   post, cari entri `socialAccounts[]` yang `id`-nya cocok
   `outstandAccountId` DAN `status === "published"` DAN `platformPostId`
   tidak null — post tanpa entri cocok di-skip.

2. **Pemetaan status `partial`.** Real API punya 5 status
   (`queued|running|completed|failed|partial`), kontrak
   `ImportJobStatus` hanya 3 (`pending|completed|failed`). Pemetaan
   final:
   - `queued`/`running` → `"pending"` (posts kosong, TIDAK memanggil
     `/v1/posts` — hemat network call untuk job yang belum selesai).
   - `completed` → `"completed"`.
   - `partial` → **JUGA `"completed"`** (bukan `"failed"`). Post yang
     berhasil diimport TETAP diambil dan masuk ke `posts[]` — tidak
     di-drop seluruhnya. Field `error` diisi pesan ringkasan post yang
     gagal, format: `"{failed} dari {imported+skipped+failed} post gagal
     diimport."`, supaya caller tahu ini sukses sebagian, bukan penuh.
   - `failed` → `"failed"` (posts kosong, `error` dari job atau pesan
     default).
   - Status real API yang tidak dikenali (selain 5 nilai di atas) →
     `OutstandIntegrationError` dilempar (pola "throw loud"
     ADR-059/ADR-119), bukan ditelan diam-diam sebagai sukses/gagal.

**Governance gap yang ikut ditutup ADR ini:** review Ridwan Architecture
Reviewer menemukan kode sudah menyebut "ADR-123" 7 kali di komentar/
docstring (`real-outstand-adapter.ts`, `outstand-adapter.ts`) sejak
diimplementasikan Elon Backend Engineer, tapi file ADR-nya sendiri belum
pernah dibuat — melanggar `AGENTS.md` rule 4 (baseline arsitektur tidak
boleh berubah tanpa ADR). File ini menutup gap tersebut.

### Reason

* Signature lama `(importJobId)` tidak bisa memetakan ke endpoint
  sungguhan sama sekali (bukan cuma kurang optimal) — account id memang
  wajib ada di path URL, tidak ada cara lain mengidentifikasi job tanpa
  itu di API Outstand. Breaking change pada kontrak publik dianggap wajar
  karena hanya satu call site internal (`ImportPostsTriggerUseCase`,
  domain `publishing`) yang memanggilnya — tidak ada konsumen eksternal.
* Endpoint singular `/imports/{id}` yang tidak membawa data post adalah
  pola yang sudah berkali-kali terjadi di integrasi Outstand lain
  (lihat ADR-113, ADR-115, ADR-116, ADR-118 — dokumentasi/asumsi awal
  tidak cocok dengan API sungguhan) — dua panggilan HTTP (status +
  LIST posts) dipilih daripada menebak field tambahan yang mungkin tidak
  ada, karena sudah diverifikasi langsung OpenAPI spec resmi untuk
  endpoint LIST secara terpisah.
* `partial` → `"completed"` (bukan `"failed"`) adalah keputusan PRODUK,
  bukan teknis murni — King Rezi memilih user tetap mendapat sebagian
  hasil import daripada tidak sama sekali, konsisten filosofi "tampilkan
  apa yang berhasil, jangan sembunyikan di balik kegagalan sebagian".
  `error` tetap diisi supaya informasi "ini tidak 100% sukses" tidak
  hilang dari caller/log, walau status akhirnya `"completed"`.
* `queued`/`running` sengaja TIDAK memicu panggilan `/v1/posts` tambahan
  — job yang belum selesai pasti belum punya post untuk diambil, jadi
  network call kedua hanya buang-buang biaya/latensi.
* Status tidak dikenali di-throw (bukan default ke salah satu dari 3
  status kontrak) mengikuti pola "throw loud" ADR-059/ADR-119 yang sudah
  berulang kali dipakai di adapter ini — asumsi diam-diam tentang shape
  API eksternal yang berubah adalah sumber bug paling sering ditemukan di
  integrasi Outstand sejauh ini.

### Alternatives Considered

* **`partial` dipetakan ke `"failed"`** (lebih konservatif, drop semua
  post yang sudah berhasil diimport di job itu). Tidak dipilih — King
  Rezi eksplisit memilih sebagian hasil lebih baik daripada tidak ada
  sama sekali; alternatif ini juga akan membuang kerja HTTP yang sudah
  terjadi di sisi Outstand (post yang sudah berhasil tetap "ada" di sana,
  hanya tidak pernah masuk ke DB kita).
* **Menjaga signature lama `(importJobId)` dan menebak `outstandAccountId`
  dari context lain** (mis. cache in-memory job→account). Ditolak —
  menambah state tersembunyi yang rawan drift/race, sementara menambah
  satu parameter eksplisit jauh lebih sederhana dan satu-satunya call
  site sudah punya nilai itu di tangan (`input.outstandAccountId`).
* **Pagination loop di `GET /v1/posts`** untuk job dengan `imported +
  skipped` besar. Ditolak untuk scope ini (YAGNI) — limit diset ke
  `imported + skipped` job ini (atau 100 kalau nol), konsisten semantik
  `limit` yang sama dipakai saat membuat job di `importPosts`. Bisa
  direvisit kalau terbukti ada job dengan volume post melebihi batas
  praktis satu page.

### References

* T-112 — `project-manager/tasks/v02-publishing-mvp.md` § T-112.
* ADR-093 — Import Posts dari Social Account (status `Imported`,
  read-only), desain awal yang diamandemen di sini.
* ADR-059, ADR-119 — pola "throw loud" + hapus Fake adapter di jalur
  produksi, keduanya tetap berlaku (double lokal tetap dipakai di tes).
* ADR-113, ADR-115, ADR-116, ADR-118 — presedan berulang "dokumentasi
  Outstand tidak cocok API sungguhan, wajib verifikasi OpenAPI spec
  resmi sebelum implementasi".
* `packages/shared/src/contracts/outstand-adapter.ts` —
  `IOutstandAdapter.fetchImportJobStatus` (signature baru),
  `ImportJobOutcome` (docstring pemetaan status).
* `apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts` —
  implementasi `importPosts`/`fetchImportJobStatus` sungguhan.
* `apps/web/src/domains/publishing/services/
  import-posts-trigger.use-case.ts` — call site yang diupdate.
