## Decision ADR-106

### Title

Fake `uploadMediaWorkingCopy` — 1 method gabungan (bukan split 2-method seperti ADR-105) untuk media upload working copy Outstand

### Status

Accepted

### Date

2026-09-14

### Decision

T-024.3 (`OutstandAdapter` media upload working copy, bagian dari T-024
Media upload di Draft Editor) membutuhkan kontrak ACL untuk alur ADR-040
poin 4: "Media publishing memakai Outstand Media API. Original media tetap
menjadi milik aplikasi di Supabase Storage. Saat diperlukan untuk
publishing, aplikasi meminta upload URL Outstand, melakukan PUT,
mengonfirmasi upload, lalu memakai URL working copy Outstand untuk
membuat/menjadwalkan post." `OUTSTAND_API_KEY`/`OUTSTAND_WEBHOOK_SECRET`
asli belum ada (T-025.5 Real OutstandAdapter Media API status
`⏳ Not Started`, terhenti kredensial) — mengikuti rule 19 AGENTS.md dan
precedent ADR-059/ADR-079/ADR-105, task ini dikerjakan sekarang lewat
`FakeOutstandAdapter`, bukan menunggu real adapter.

1. **Gap spesifikasi:** `integration-layer.md` (baris ~108-113, pseudo-code
   `OutstandAdapter`) mencantumkan 3 method terpisah:
   `requestMediaUpload(params) → OutstandUploadTarget`,
   `uploadMedia(uploadUrl, bytes, contentType) → void`,
   `confirmMediaUpload(uploadId) → OutstandMediaData` — mengikuti bentuk
   API vendor Outstand 1:1 (request URL → PUT → confirm). ADR ini **tidak**
   menyalin bentuk itu apa adanya ke `IOutstandAdapter`; keputusan eksplisit
   di bawah menjelaskan kenapa.

2. **SATU method gabungan** ditambahkan ke `IOutstandAdapter`
   (`packages/shared/src/contracts/outstand-adapter.ts`):

   ```ts
   uploadMediaWorkingCopy(
     input: UploadMediaWorkingCopyInput, // { fileBuffer: Buffer; mimeType: string }
   ): Promise<UploadMediaWorkingCopyResult>; // { outstandMediaId; outstandMediaUrl; expiresAt }
   ```

   Dipanggil SEBELUM `schedulePost`/`publishNow` untuk tiap media original
   yang disertakan pada sebuah post. `fileBuffer` adalah bytes yang sudah
   diambil caller dari Supabase Storage (lewat signed URL
   `MediaItem.url`/`storagePath`, T-024.2) — adapter tidak mengenal
   Supabase Storage sama sekali, konsisten dengan batasan ACL (rule 6
   AGENTS.md: domain/adapter tidak mengimpor Supabase client).

3. **Alasan 1 method, BUKAN split 2-3 method seperti `connectAccount`/
   `exchangeConnectCode` (ADR-105):** ADR-105 men-split OAuth connect
   menjadi 2 method karena ADA redirect browser sungguhan di antara kedua
   langkah — Route Handler callback (`/api/integrations/outstand/callback`)
   perlu benar-benar dipanggil ulang oleh browser dengan `code`/`state`
   yang dibawa lewat redirect, sehingga arsitektur callback (CSRF-check,
   keputusan create/update `ConnectedAccount`) bisa diuji end-to-end lewat
   Fake SEKARANG. Media upload working copy TIDAK punya karakteristik itu:
   ketiga langkah (request URL, PUT bytes, confirm) murni panggilan
   server-to-server dari `PublishingService`/use-case yang sama, berurutan,
   tanpa ada pihak eksternal (browser user) yang perlu "kembali" di
   tengah-tengah. Tidak ada nilai arsitektural yang didapat dari
   memisahkan langkahnya di level kontrak ACL — caller (`PublishingService`)
   tidak pernah butuh mengontrol `uploadUrl` mentah Outstand secara
   terpisah dari hasil akhirnya. Level abstraksi 1-method ini konsisten
   dengan `schedulePost`/`publishNow` (SATU call yang menyembunyikan detail
   HTTP multi-endpoint Outstand `create-a-post` dari domain internal) —
   ACL menyembunyikan mekanisme vendor, bukan menerjemahkannya 1:1.

4. **Fake instant always-success** (ADR-059): tidak ada network call/PUT
   sungguhan, `fileBuffer`/`mimeType` diterima apa adanya tanpa validasi
   ulang (validasi mime/size sudah terjadi di `UploadMediaUseCase`/
   `validation.ts`, T-024.2 — Fake tidak boleh mengulang validasi domain).
   `outstandMediaId` acak per panggilan (`crypto.randomUUID()`, bukan
   deterministik dari input) mengikuti pola `schedulePost`/`publishNow` —
   setiap upload working copy dianggap upload BARU, bukan sesuatu yang
   perlu direproduksi identik untuk input yang sama (beda dari
   `fetchPostMetrics`/`fetchWorkspaceMetrics` yang sengaja deterministik
   untuk idempotensi ingestion, T-041.5 — kasus ini tidak butuh itu).
   `expiresAt` mock 24 jam ke depan dari waktu panggilan — nilai arbitrer,
   Outstand asli yang menentukan TTL sesungguhnya.

5. **Scope ADR ini murni kontrak adapter + Fake**
   (`packages/shared/src/contracts/outstand-adapter.ts`,
   `apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts`) — method
   baru ini **TIDAK** di-wire ke `UploadMediaUseCase`, `MediaService`,
   `PublishingService`, atau UI mana pun di ADR ini. Persistensi hasil ke
   `MediaItem.outstandMediaId`/`outstandMediaUrl`/`outstandUploadedAt`/
   `outstandExpiresAt` (field sudah ada di schema sejak T-024.1) tetap
   pekerjaan use-case pemanggil di giliran berikutnya (T-024.4 dan/atau
   `PublishingService` saat schedule/publish memakai media), dikerjakan
   Prabowo Feature Engineer atau Elon di task terpisah. Real adapter
   (T-025.5) juga di luar scope — tetap menunggu `OUTSTAND_API_KEY`.

### Reason

* Rule 19 AGENTS.md: task yang terhambat kredensial Outstand tidak boleh
  mandek — Fake mengikuti pola ADR-059 yang sudah terbukti (auto-switch
  env, throw loud, instant fidelity) daripada menunggu kredensial asli.
* Level abstraksi ACL harus konsisten: `schedulePost`/`publishNow` sudah
  menetapkan preseden bahwa satu niat domain ("upload media siap dipakai
  publish") = satu method ACL, walau vendor Outstand membutuhkan beberapa
  HTTP call di baliknya. Menerjemahkan 3 endpoint vendor 1:1 ke 3 method
  interface akan membocorkan detail implementasi vendor ke domain internal
  — melanggar prinsip ACL yang sama yang membuat ADR redesain
  `schedulePost`/`publishNow` (2026-08-26) diputuskan.
* Split ADR-105 punya alasan SPESIFIK (redirect browser perlu diuji
  terpisah) yang tidak berlaku di sini — menyalin polanya secara membabi
  buta ke kasus yang berbeda karakteristiknya akan menambah kompleksitas
  interface tanpa manfaat nyata (rule "verifikasi penalaran, bukan asumsi
  pola sama" di instruksi task ini sendiri).

### Alternatives Considered

* **Split 2 method** (`requestMediaUploadUrl(input) → { uploadUrl,
  outstandMediaId, expiresAt }` + `confirmMediaUpload(input:
  { outstandMediaId }) → { outstandMediaUrl, expiresAt }`), mengikuti pola
  `connectAccount`/`exchangeConnectCode`. Ditolak — tidak ada redirect
  browser sungguhan di antara kedua langkah untuk diuji terpisah (beda
  fundamental dari OAuth), dan caller (`PublishingService`) tidak pernah
  butuh melakukan `PUT` bytes-nya sendiri di luar adapter — memisahkan
  langkah hanya menambah 1 round-trip API yang tidak dibutuhkan domain
  internal mana pun.
* **3 method 1:1 mengikuti pseudo-code `integration-layer.md`**
  (`requestMediaUpload`/`uploadMedia`/`confirmMediaUpload`). Ditolak lebih
  keras dari opsi split-2 — ini murni menyalin detail implementasi vendor
  (URL request lalu `PUT` bytes manual) ke kontrak ACL, sesuatu yang
  eksplisit dihindari oleh redesain `schedulePost`/`publishNow`
  (2026-08-26, lihat dokumentasi di `outstand-adapter.ts`).
* **Menunggu T-025.5 (real adapter) selesai dulu**, tidak membangun Fake
  sama sekali. Ditolak — melanggar rule 19 AGENTS.md; T-024 (Media upload
  di Draft Editor) tidak boleh mandek hanya karena kredensial Outstand asli
  belum ada, sama seperti precedent ADR-059/ADR-105.

### References

* `product-discovery/05-architecture/integration-layer.md` — pseudo-code
  `OutstandAdapter` (baris ~108-113: `requestMediaUpload`/`uploadMedia`/
  `confirmMediaUpload`), IL-D07 "Media Strategy" (baris ~465), "Alur
  Publishing" langkah 3 (baris ~248-252).
* ADR-040 — kontrak resmi Outstand, poin 4 (Media API).
* ADR-059 — pola Fake adapter (auto-switch, throw loud, instant fidelity).
* ADR-105 — precedent split 2-method `connectAccount`/`exchangeConnectCode`
  (alasan split TIDAK berlaku untuk kasus ini, lihat poin 3 Decision).
* `packages/shared/src/contracts/outstand-adapter.ts` — kontrak final
  `UploadMediaWorkingCopyInput`/`UploadMediaWorkingCopyResult`/
  `uploadMediaWorkingCopy`.
* `apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts` —
  implementasi Fake.
* `apps/web/src/domains/media/types.ts` — `MediaItemRecord` (field
  `outstandMediaId`/`outstandMediaUrl`/`outstandUploadedAt`/
  `outstandExpiresAt` sudah diantisipasi sejak T-024.1).
* `project-manager/tasks/v02-publishing-mvp.md` § T-024 (T-024.3).
