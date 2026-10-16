## Decision ADR-103

### Title

Retry Manual Publishing — Scope Single-Target (bukan Whole-Post)

### Status

Accepted

### Date

2026-09-09

### Context

ADR-092 (2026-08-26) sudah menetapkan bahwa Outstand tidak punya endpoint
retry resmi — dokumentasi resminya merekomendasikan pola delete-post-lalu-
create-post-baru (`delete-a-post-from-social-networks` lalu `create-a-post`),
bukan re-trigger job yang sama. ADR-092 mencatat ini sebagai catatan
tambahan untuk **T-034.4** (Aksi retry manual untuk target yang gagal),
tapi tidak menyelesaikan satu pertanyaan scope yang krusial: karena
`outstandPostId` bersifat **post-level** (satu ID dipakai untuk SEMUA
target/akun dalam satu post, hasil dari redesain kontrak 1-call-semua-target
di ADR-092), retry untuk SATU target yang gagal itu harus me-recreate
**seluruh post** (termasuk target lain yang sudah `published`, berisiko
re-publish/duplikat konten di akun yang sudah sukses tayang) atau
me-recreate **hanya target yang gagal** saja.

Pertanyaan ini baru muncul konkret saat implementasi T-034.4 dimulai sesi
ini (2026-09-09), dan sengaja tidak diasumsikan oleh AI — diajukan langsung
ke King Rezi lewat `AskUserQuestion` sesuai `.claude/skills/proactive-clarification/SKILL.md`.

### Decision

1. Retry manual **hanya me-recreate target yang gagal (satu akun per aksi
   retry)** — target lain di post yang sama yang berstatus `published`
   tidak disentuh, tidak dihapus, dan tidak di-recreate sama sekali.
2. Target yang di-retry mendapat kolom Prisma baru
   `PublishingPostTarget.retryOutstandPostId` (nullable) — `outstandPostId`
   hasil recreate milik target itu sendiri, terpisah dari
   `PublishingPost.outstandPostId` level-post (yang tetap merepresentasikan
   `outstandPostId` dari create original untuk seluruh target awal).
3. `IOutstandAdapter` mendapat method baru `deletePost(outstandPostId,
accountIds?)` — best-effort (error di-log, tidak dilempar ke caller),
   dipanggil dengan `accountIds` berisi **hanya** akun yang sedang di-retry
   (bukan seluruh akun di `outstandPostId` lama).
4. Recreate memakai `outstandAdapter.publishNow` **langsung** (bukan lewat
   `PublishNowUseCase`/`repository.publishNow` yang men-_replace_ SELURUH
   target sebuah post) dengan array `targets` berisi **hanya 1 elemen**
   (akun yang di-retry).
5. Status post (`Failed → Published`) direkonsiliasi ulang setelah retry
   berdasarkan ada/tidaknya target berstatus `failed` yang tersisa di post
   itu — fungsi `reconcilePostStatusAfterRetry`, idempoten (aman dipanggil
   berulang tanpa efek samping salah).

### Reason

- Opsi whole-post-recreate (delete + create ulang seluruh post) ditolak
  karena berisiko me-re-publish ulang konten yang sudah sukses tayang di
  akun lain pada post yang sama — duplikat konten di platform sosial nyata,
  UX buruk, dan berpotensi melanggar kebijakan platform (post ganda).
- Opsi single-target sesuai desain UI Claude Design yang sudah dikonfirmasi
  sebelumnya (KI-048) — tombol "Coba Lagi" muncul **per-baris akun** di
  "Hasil per Akun" pada halaman detail post, bukan sebagai aksi per-post.
  Scope single-target ini konsisten dengan desain yang sudah ada.
- King Rezi memutuskan langsung memilih opsi ini di tempat saat ditanya
  lewat `AskUserQuestion`, tanpa perlu riset API Outstand lebih lanjut.

### Alternatives Considered

- **Delete + recreate seluruh post** (semua target, termasuk yang sudah
  `published`) — ditolak karena risiko duplikat konten di atas.
- **Riset API Outstand lebih dalam dulu sebelum memutuskan scope** — tidak
  dipilih; King Rezi langsung memutuskan opsi single-target di sesi yang
  sama tanpa perlu riset tambahan.

### Impact / Baseline yang diamandemen

- Melengkapi (bukan membatalkan) **ADR-092** — ADR-092 menetapkan pola
  delete-lalu-create-ulang secara umum untuk retry Outstand; ADR-103
  mengunci **scope**-nya jadi single-target saat pola itu diterapkan ke
  T-034.4.
- `product-discovery/06-engineering/integration-layer.md` — ditambah
  catatan retry single-target (mengamandemen catatan retry dari ADR-092).
- File kode: `packages/shared/src/contracts/outstand-adapter.ts` (method
  baru `deletePost`), `apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts`,
  `apps/web/src/domains/publishing/services/retry-failed-target.use-case.ts`
  (baru), `apps/web/src/domains/publishing/repositories/publishing.repository.ts`
  - implementasi Prisma, Prisma schema (`PublishingPostTarget.retryOutstandPostId`)
  - migration `20260909024403_t034_4_retry_outstand_post_id`,
    `apps/web/src/app/(app)/publish/history/[postId]/actions.ts` (baru),
    `apps/web/src/app/(app)/publish/history/[postId]/components/RetryTargetButton.tsx`
    (baru), `HistoryDetail.tsx` (diubah untuk wiring tombol retry).
- **T-034.4**: implementasi mengikuti keputusan ini penuh — lolos review
  arsitektur Ridwan Architecture Reviewer (tanpa temuan blocking) dan QA
  Najwa QA Engineer (259 test pass, verifikasi browser end-to-end golden
  path + edge case semua PASS). Dengan ini **T-034 (Publishing History +
  detail post) tuntas 4/4 subtask, `✅ Done`**.

---
