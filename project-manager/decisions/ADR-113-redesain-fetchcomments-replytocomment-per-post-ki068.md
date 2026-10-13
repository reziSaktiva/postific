## Decision ADR-113

### Title

Redesain `IOutstandAdapter.fetchComments`/`replyToComment` — scope PER POST
(bukan per akun/cursor) — menutup KI-068, mengganti ADR-110 poin kontrak
`fetchComments`/`replyToComment`

### Status

Accepted — Amended by ADR-117 (2026-09-25)

### Date

2026-09-24

### Decision

KI-068 menemukan kontrak `IOutstandAdapter.fetchComments(outstandAccountId,
cursor?)`/`replyToComment(outstandCommentId, text)` (ADR-110) tidak cocok
dengan API resmi Outstand — root cause SAMA dengan KI-067/ADR-112: kontrak
disusun sebelum akses ke dokumentasi resmi. Setelah memeriksa OpenAPI spec
resmi (`https://api.outstand.so/v1/posts/openapi.json`, path
`/v1/posts/{id}/replies`, diambil 2026-09-24), ditemukan Outstand men-scope
comments/replies **PER POST** (`GET/POST /v1/posts/{postId}/replies`),
**TANPA pagination cursor sama sekali** — bukan per akun dengan cursor
seperti diasumsikan ADR-110.

King Rezi mengonfirmasi 3 keputusan sebelum implementasi dimulai (lihat
`PROJECT_STATE.md` § KI-068 untuk detail lengkap):

1. **Sumber daftar post untuk sync**: dari DB kita sendiri (query
   `PublishingPost`/`PublishingPostTarget` lewat public API barrel
   `@/domains/publishing`), **bukan** endpoint list-posts Outstand.
2. **`fetchComments` baru** — per-post, tanpa cursor:
   ```ts
   fetchComments(input: {
     outstandPostId: string;
     platform: SocialPlatform;
     accountUsername: string;
   }): Promise<FetchCommentsResult>; // FetchCommentsResult TANPA nextCursor
   ```
3. **`replyToComment` baru** — tambah `outstandPostId` (wajib) +
   `parentOutstandCommentId` (opsional, threading):
   ```ts
   replyToComment(input: {
     outstandPostId: string;
     content: string;
     parentOutstandCommentId?: string;
   }): Promise<ReplyToCommentResult>;
   ```

#### 1. Kontrak (`packages/shared/src/contracts/outstand-adapter.ts`)

* `InboxCommentData.outstandPostId` berubah dari `string | null` jadi
  **`string` wajib** — setiap komentar yang berhasil diambil PASTI berasal
  dari `outstandPostId` yang diminta caller (di-echo balik, bukan dari
  response Outstand — `NormalizedReply` tidak membawa post id).
* `InboxCommentData.outstandAccountId` **DIHAPUS** — field ini tidak bisa
  diisi bermakna oleh real adapter (parameter yang diterima sekarang
  `accountUsername`, bukan account ID; response Outstand juga tidak
  membawa account id). Caller (`SyncCommentsUseCase`) sudah tahu
  `connectedAccountId` dari konteks loop-nya sendiri — pola yang sama
  dengan alasan `expectedOutstandAccountIds` di `fetchPostOutcome`
  (ADR-108) disuplai caller, bukan ditebak adapter.
* `FetchCommentsResult.nextCursor` **DIHAPUS** (bukan disisakan `null`
  selalu) — API resmi tidak punya pagination untuk endpoint ini sama
  sekali.
* `ReplyToCommentResult` tidak berubah (`{ outstandReplyId }`).

#### 2. `FakeOutstandAdapter`

* `buildFakeComment` sekarang keyed by `outstandPostId` (bukan
  `outstandAccountId`) — `outstandCommentId` tetap stabil per
  `outstandPostId`+index (idempotency, T-051). `platform` diterima apa
  adanya dari input (bukan lagi derivasi deterministik dari id —
  `derivePlatform`/`SOCIAL_PLATFORMS` dihapus, sudah tidak relevan).
* `fetchComments`/`replyToComment` tetap instant always-success tanpa
  simulasi delay/gagal (ADR-059) — hanya bentuk parameter yang berubah.

#### 3. `RealOutstandAdapter` — implementasi HTTP asli (menutup gap ADR-110)

* `fetchComments`: `GET /v1/posts/{postId}/replies` — **diverifikasi
  terhadap OpenAPI spec resmi**: query `network` wajib (`toOutstandNetwork`,
  reuse mapping yang sama dengan `connectAccount`/`schedulePost`),
  `username` **selalu dikirim** (opsional di spec, tapi wajib di kontrak
  kita — menghindari 400 disambiguasi saat satu post publish ke >1 akun di
  network yang sama). Response `{ success, replies (deprecated), data:
  NormalizedReply[] }` — dibaca dari `data` (bentuk cross-network
  konsisten), bukan `replies` (per-network, deprecated). `NormalizedReply`:
  `{ id, author, text, created_at (nullable), like_count?,
  platform_specific?, replies? }` — dipetakan ke `InboxCommentData`
  (`outstandCommentId`←`id`, `authorHandle`←`author`, `content`←`text`,
  `receivedAt`←`created_at`, fallback `new Date()` kalau `null`).
  `include_replies` sengaja tidak dikirim (top-level only, comments-only
  MVP ADR-040). Entry tanpa `id` valid di-skip (defensif), bukan throw.
* `replyToComment`: `POST /v1/posts/{postId}/replies` body
  `{ content, parent_comment_id? }` — response `{ success, reply_id }`.
  Throw `OutstandIntegrationError` kalau `reply_id` tidak valid (pola sama
  `extractOutstandPostId`).
* **Gap yang TIDAK ditutup (dilaporkan, bukan diputuskan sendiri)**:
  endpoint reply resmi juga menerima `account_username`/`platform_post_id`
  opsional untuk disambiguasi multi-akun — kontrak `replyToComment`
  (dikonfirmasi King Rezi) sengaja tidak membawa field itu, jadi reply ke
  post yang publish ke >1 akun di network yang sama berisiko 400 di sisi
  Outstand kalau ambigu. Di luar scope ADR ini.
* Docstring gap lama (`GAP YANG MASIH TERBUKA` poin 2, ditulis sesi T-025
  2026-09-23) ditandai selesai; poin 3 (override platform-specific,
  KI-069) TETAP terbuka, tidak disentuh ADR ini.

#### 4. Redesain alur JOB-03 (`SyncCommentsUseCase`, T-051)

* **Port baru** `PublishingPostsPort.listSyncablePostsByConnectedAccount`
  — cross-domain `engagement` → `publishing` (arah yang sudah legal,
  `application-layer.md`), disuplai composition root (job route/
  `refreshInboxAction`) lewat `publishingRepository` (structural typing,
  pola sama `workspaceRepository` sebagai `WorkspaceOwnerLookupPort`).
* `IPublishingRepository` (`domains/publishing/repositories/publishing.repository.ts`)
  ditambah 2 method baru:
  - `listSyncablePostsByConnectedAccount(input, userId)` — daftar
    `{ postId, outstandPostId, platform }` untuk SATU `connectedAccountId`
    yang sudah punya `outstandPostId` (query `PublishingPostTarget` JOIN
    `PublishingPost`, filter `outstandPostId IS NOT NULL`+`deletedAt IS
    NULL`).
  - `findPostOutstandId(input, userId)` — resolve `outstandPostId` dari
    SATU `postId` internal (dipakai reply, lihat §5).
* `SyncCommentsPayload` — `outstandAccountId` diganti `accountUsername`
  (`WorkspaceConnectedAccount.handle`, wajib untuk `fetchComments`).
* `SyncCommentsUseCase.sync` — loop BERURUTAN per `syncablePosts` (bukan
  lagi satu call `fetchComments` dengan `cursor` loop), panggil
  `fetchComments({ outstandPostId, platform, accountUsername })` per post,
  upsert komentar hasilnya dengan `postId` (uuid internal) ikut diisi —
  menutup gap "`EngagementInboxItem.postId` ada di schema sejak T-050 tapi
  tidak pernah ditulis" (salah satu sub-poin KI-068).
* `IEngagementRepository.upsertInboxItem` — tambah field opsional
  `postId?: PostId`, diisi di `create` (bukan `update` — post yang sudah
  terhubung tidak berubah lagi).
* `EngagementSyncJobHandler`/`RefreshInboxUseCase` — `WorkspaceOwnerLookupPort`/
  `ConnectedAccountsPort` masing-masing diperluas dengan field `handle`,
  diteruskan sebagai `accountUsername` ke `SyncCommentsPayload`.
* **Migration baru** `20260924090000_ki068_add_handle_to_account_owner_lookup`
  — extend fungsi SQL SECURITY DEFINER
  `webhook_find_account_owner_by_outstand_account_id` (sudah di-extend
  sekali untuk kolom `status`, migration `20260922110000_...`) untuk juga
  mengembalikan `handle` — dipakai `EngagementSyncJobHandler` (job periodik
  tanpa Better Auth session) untuk resolve `accountUsername` tanpa lookup
  terpisah.

#### 5. Redesain alur Reply (`EngagementService.reply`, T-054)

* **Port baru** `PublishingPostReferencePort.findPostOutstandId` —
  cross-domain `engagement` → `publishing`, disuplai composition root
  lewat `publishingRepository` (constructor param ke-3 `EngagementService`,
  breaking change internal — seluruh call site sudah diupdate).
* Urutan baru: validasi `content` → `findInboxItemById` → **guard
  `item.postId` wajib terisi** (`ConflictError` kalau `null` — data lama
  sebelum redesain KI-068/T-051 yang belum pernah mengisi kolom ini) →
  resolve `outstandPostId` lewat `findPostOutstandId` (`ConflictError`
  kalau `null` — post belum pernah publish di Outstand) → panggil
  `IOutstandAdapter.replyToComment({ outstandPostId, content,
  parentOutstandCommentId: item.externalId })`.
* `parentOutstandCommentId: item.externalId` — balasan di-thread di BAWAH
  komentar yang sedang dibalas (bukan langsung ke post), konsisten dengan
  UX "membalas komentar tertentu" di Comments Inbox (T-053).

### Reason

* Kontrak lama (ADR-110) adalah desain best-effort yang eksplisit
  menyatakan dirinya bisa salah tanpa dokumentasi resmi (docstring
  `fetchComments`/`replyToComment` di real adapter, ditulis 2026-09-23:
  "SENGAJA throw eksplisit... butuh redesain") — begitu bentuk nyata
  terverifikasi (OpenAPI spec), rule AGENTS.md #4 mewajibkan ADR baru
  untuk mengubah baseline, bukan diam-diam menambal kode.
* Sumber daftar post dari DB sendiri (bukan endpoint list-posts Outstand)
  menghindari N+1 API call yang tidak perlu ke Outstand untuk data yang
  sudah kita miliki durable, dan konsisten dengan pola lain di kontrak ini
  (`fetchPostOutcome` dipanggil per `outstandPostId` yang caller sudah
  tahu, bukan discovery lewat listing eksternal).
* `outstandAccountId` dihapus dari `InboxCommentData` (bukan dipertahankan
  sebagai field yang selalu kosong/di-derive) — mengikuti prinsip yang
  sama dengan penghapusan `nextCursor` (King Rezi eksplisit: jangan
  sisakan field yang secara struktural tidak bisa diisi benar, itu
  future-proofing palsu yang menyesatkan pembaca kode).
* `accountUsername` selalu dikirim ke `fetchComments`/tidak ada
  `account_username` di `replyToComment` adalah keputusan scope eksplisit
  King Rezi (lihat §1/§3 poin 3) — dilaporkan sebagai gap yang mungkin
  perlu follow-up (reply ke post multi-akun ambigu), bukan diputuskan
  sendiri untuk memperluas kontrak.

### Alternatives Considered

* **Pertahankan `fetchComments` per-akun, tambah loop list-posts di dalam
  adapter (bukan use-case)**. Ditolak — melanggar batasan ACL (adapter
  murni translasi wire format, orkestrasi "post mana saja yang perlu
  di-sync" adalah domain logic milik `SyncCommentsUseCase`, bukan
  tanggung jawab `OutstandAdapter`).
* **Query daftar post dari endpoint `GET /v1/posts` (list-posts Outstand)
  alih-alih DB sendiri**. Ditolak eksplisit oleh King Rezi — DB sendiri
  sudah punya data ini (`PublishingPost.outstandPostId`), query eksternal
  tambahan hanya menambah latency/titik gagal tanpa manfaat.
* **Pertahankan `outstandAccountId` di `InboxCommentData`, isi dengan
  `null`/string kosong di real adapter**. Ditolak — sama masalahnya dengan
  `nextCursor` selalu `null`: field yang tidak pernah bisa diisi benar
  menyesatkan pembaca kode masa depan untuk mengira ada nilai bermakna.
* **`replyToComment` tetap membawa `outstandCommentId` SAJA (tanpa
  `outstandPostId`), real adapter melakukan lookup tambahan
  `outstandCommentId → outstandPostId`**. Ditolak — tidak ada endpoint
  Outstand untuk lookup semacam itu; `outstandPostId` sudah tersedia dari
  `EngagementInboxItem.postId` (setelah redesain §4), jadi tidak ada
  kebutuhan network call tambahan.

### References

* KI-068 (`PROJECT_STATE.md` § Known Issues) — temuan awal gap, root cause
  sama KI-067/ADR-112.
* ADR-110 — kontrak asli `fetchComments`/`replyToComment` (Fake) yang
  diamandemen ADR ini.
* ADR-108 — pola `expectedOutstandAccountIds` disuplai caller, dipakai
  sebagai preseden alasan `outstandAccountId` dihapus dari
  `InboxCommentData`.
* ADR-040 — kontrak resmi Outstand (comments-only MVP, tanpa DM/mention).
* `packages/shared/src/contracts/outstand-adapter.ts` — kontrak final
  `FetchCommentsResult`/`InboxCommentData`/`fetchComments`/`replyToComment`.
* `apps/web/src/lib/adapters/outstand/real-outstand-adapter.ts` —
  implementasi HTTP asli (§3).
* `apps/web/src/lib/adapters/outstand/fake-outstand-adapter.ts` — Fake
  redesain (§2).
* `apps/web/src/domains/engagement/services/sync-comments.use-case.ts`,
  `engagement-sync-job-handler.ts`, `refresh-inbox.use-case.ts` — redesain
  alur JOB-03 (§4).
* `apps/web/src/domains/engagement/services/engagement.service.ts` —
  redesain alur reply (§5).
* `apps/web/src/domains/publishing/repositories/publishing.repository.ts` —
  method baru `listSyncablePostsByConnectedAccount`/`findPostOutstandId`.
* `apps/web/prisma/migrations/20260924090000_ki068_add_handle_to_account_owner_lookup/` —
  migration kolom `handle` di lookup SQL.
* `tasks/v02-publishing-mvp.md` § T-025 (T-025.6), `tasks/v04-engagement-mvp.md`
  § T-051/T-054.
