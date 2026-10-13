/**
 * Kontrak Anti-Corruption Layer (ACL) untuk Outstand — promosi dari
 * `apps/web/src/domains/publishing/adapters/outstand-adapter.ts` (ADR-059)
 * ke `packages/shared` karena lebih dari satu domain (Publishing, Analytics)
 * membutuhkan kontrak yang sama sekarang (lihat ADR baru pasca ADR-078,
 * dicatat oleh Gibran Project Manager).
 *
 * Ini murni tipe/interface — tanpa implementasi maupun business logic —
 * konsisten dengan batasan `packages/shared` (ID, enum, value object).
 * Implementasi konkret (Fake maupun real HTTP client nanti) tetap hidup di
 * luar package ini, di `apps/web/src/lib/adapters/outstand/`.
 *
 * **Redesain (ADR baru, 2026-08-26)** — kontrak `schedulePost`/`publishNow`
 * di bawah ini MENGGANTI bentuk lama (1 call per target, `publishedUrl`
 * instan). Setelah membaca dokumentasi resmi Outstand (`create-a-post`),
 * ditemukan mismatch: Outstand menerima SEMUA target/akun dalam SATU call
 * (`accounts: array<string>`) dan mengembalikan SATU `post.id` — bukan satu
 * job per akun, dan response create-post TIDAK mengonfirmasi hasil publish
 * per akun secara sinkron (bahkan untuk publish langsung tanpa jadwal).
 * Status/outcome per akun baru tersedia belakangan lewat `get-post-details`
 * (`fetchPostOutcome`, lihat di bawah) atau webhook (T-026). Method yang
 * tersedia mengikuti daftar resmi di
 * `product-discovery/05-architecture/integration-layer.md` (bagian
 * "OutstandAdapter"), tapi hanya method yang SUDAH dibutuhkan kode nyata
 * yang dideklarasikan di sini (YAGNI, sama seperti keputusan ADR-059).
 *
 * **`fetchComments`/`replyToComment` (T-051/T-054, Engagement MVP)** —
 * ditambahkan saat domain `engagement` mulai diimplementasikan. Nama dan
 * signature persis mengikuti narasi resmi di `integration-layer.md`
 * ("OutstandAdapter", JOB-03 Engagement Sync):
 * `fetchComments(outstandAccountId, cursor?)` dan
 * `replyToComment(outstandCommentId, text)`.
 *
 * **`connectAccount`/`exchangeConnectCode` (ADR-105, 2026-09-11)** —
 * ditambahkan untuk T-015.3 (Reconnect flow) yang ternyata membutuhkan
 * alur redirect OAuth yang sama dengan T-013.1/T-013.2 (Connect Account,
 * belum diimplementasikan sama sekali sebelumnya). `integration-layer.md`
 * menyebut "Request OAuth URL" sebagai langkah narasi terpisah tapi tidak
 * mendefinisikan method-nya eksplisit di tabel kontrak — ADR-105
 * mendesain split 2-method ini (bukan menebak liar) dan menjadi kontrak
 * resmi untuk keduanya.
 *
 * **`resolveConnectCallback` menggantikan `exchangeConnectCode` (ADR-112,
 * 2026-09-23, amandemen ADR-105, SCOPE: single-page account saja)** —
 * setelah verifikasi lewat MCP resmi `mcp.outstand.so` + OpenAPI spec
 * (sesi T-025, 2026-09-23), ditemukan Outstand TIDAK punya endpoint
 * "exchange code" untuk platform single-page (Instagram, X, LinkedIn,
 * Threads, TikTok, YouTube, Pinterest, dst — BUKAN Facebook Pages
 * multi-halaman, lihat KI-070). Setelah OAuth selesai, Outstand redirect
 * balik ke `redirect_uri` KITA dengan `account_id`/`network_unique_id`/
 * `username` LANGSUNG di query param — data akun sudah lengkap tanpa
 * network call tambahan. `ExchangeConnectCodeInput`/`exchangeConnectCode`
 * DIHAPUS (bukan dipertahankan sebagai alias) — nama barunya
 * (`ConnectCallbackInput`/`resolveConnectCallback`) sengaja tidak
 * menyiratkan "exchange"/network call, karena real adapter untuk kasus
 * ini murni validasi/normalisasi. Flow Facebook Pages (session-token +
 * page-selection) di luar scope ADR-112, dicatat KI-070 terpisah.
 *
 * **`uploadMediaWorkingCopy` (ADR-106, 2026-09-14)** — ditambahkan untuk
 * T-024.3 (media upload working copy Draft Editor). BEDA dari
 * `connectAccount`/`exchangeConnectCode`: ketiga langkah narasi Outstand
 * Media API (request upload URL → PUT bytes → confirm) murni
 * server-to-server tanpa redirect browser, jadi digabung menjadi SATU
 * method alih-alih split 2 method — lihat ADR-106 untuk perbandingan
 * eksplisit dengan alasan split ADR-105.
 *
 * **`OutstandPostTargetInput.platform` ditambahkan (ADR-114, 2026-09-24,
 * resolusi KI-069)** — real adapter butuh tahu network (`instagram`/
 * `facebook`/`pinterest`/dst) tiap target untuk membentuk key top-level
 * override format platform-specific (Story/Reel, ADR-039/ADR-107) yang
 * dibutuhkan body `POST /v1/posts` Outstand. Field lain di interface ini
 * sudah wajib (bukan opsional) — `platform` konsisten dengan pola itu,
 * bukan ditambahkan sebagai opsional/best-effort.
 *
 * **`listPinterestBoards` ditambahkan (menutup KI-072, sisa scope ADR-114) —
 * dicatat sebagai ADR baru terpisah oleh Gibran Project Manager (nomor
 * berikutnya setelah ADR-117).** ADR-114 sengaja tidak mengimplementasikan
 * `board_id` Pinterest karena domain/UI belum pernah mengumpulkannya — King
 * Rezi mengonfirmasi board dipilih **per post** di Draft Editor (bukan
 * per-akun, TIDAK ada migrasi Prisma baru) lewat `platformOptions.boardId`
 * yang sudah generik di `OutstandPostTargetInput` di atas. Method baru ini
 * dipakai UI (Mark UI Engineer) untuk menampilkan dropdown board ASLI dari
 * akun Pinterest yang terhubung, bukan text input bebas. Wire-format
 * `GET /v1/pinterest/accounts/{id}/boards` diverifikasi via OpenAPI spec
 * resmi Outstand (`api.outstand.so/v1/pinterest/openapi.json`) — respons
 * `{ success, data: [{ id, name, description?, pin_count, privacy,
 * owner: { username }, created_at }], count }`. `PinterestBoard` di sini
 * SENGAJA hanya membawa `id`/`name` (YAGNI, sama seperti keputusan
 * `FacebookPendingPage` hanya mengambil field yang benar-benar dibutuhkan
 * UI) — dropdown board hanya butuh label+value, field lain (deskripsi,
 * privacy, jumlah pin) tidak punya konsumen konkret sekarang.
 */
import type { ContentFormat, SocialPlatform } from "../enums";

/**
 * Satu target akun dalam SATU call `schedulePost`/`publishNow`. Outstand
 * `create-a-post` menerima array `accounts` dan menghasilkan SATU post-level
 * id untuk seluruh target — `contentFormat`/`platformOptions` tetap per
 * target karena bisa berbeda per akun (ADR-039, Content Format per akun
 * tujuan, mis. Reel di Instagram + Post biasa di Facebook dalam satu aksi
 * publish yang sama).
 *
 * `platform` (ADR-114, resolusi KI-069) — network tujuan target ini,
 * dibutuhkan real adapter untuk membentuk key top-level override
 * platform-specific (`instagram`/`facebook`/dst) di body `POST /v1/posts`.
 * Caller SUDAH tahu nilai ini dari `SchedulePostsTargetInput.platform`/
 * `RetryTargetRecord.platform` — adapter tidak menebak dari
 * `outstandAccountId`.
 */
export interface OutstandPostTargetInput {
  outstandAccountId: string;
  platform: SocialPlatform;
  contentFormat: ContentFormat;
  platformOptions?: Record<string, unknown>;
}

/**
 * Satu item media untuk `schedulePost`/`publishNow` — dipetakan ke
 * `containers[].media[]` di body `POST /v1/posts` Outstand (`url` +
 * `filename`). Caller (use-case publishing) menyuplai URL working copy
 * Outstand (`uploadMediaWorkingCopy`) atau HTTPS publik yang sudah
 * memenuhi syarat Outstand — adapter tidak mengunduh file sendiri.
 */
export interface OutstandPostMediaInput {
  url: string;
  filename: string;
}

export interface ScheduleOutstandPostInput {
  targets: OutstandPostTargetInput[];
  caption: string;
  scheduledAt: Date;
  /** Opsional — kalau ada, body memakai `containers` (bukan top-level `content` saja). */
  media?: OutstandPostMediaInput[];
}

export interface ScheduleOutstandPostResult {
  /** Satu id post-level dari Outstand, mencakup SEMUA target dalam `targets`. */
  outstandPostId: string;
}

/**
 * Publish Now (T-029, ADR-047) — sama dengan `ScheduleOutstandPostInput`
 * tanpa `scheduledAt`, karena aksi ini tayang langsung tanpa jeda jadwal.
 * Ini murni beda niat domain (dan RBAC-nya, ADR-074) — bukan endpoint
 * Outstand yang berbeda. Di Outstand asli, `create-a-post` dengan
 * `scheduledAt` kosong = publish langsung; ACL (implementasi konkret di
 * `apps/web/src/lib/adapters/outstand/`) yang menyembunyikan detail ini,
 * domain internal tetap memanggil dua method terpisah supaya tipe input
 * tetap ketat sesuai niat (`PublishNowOutstandPostInput` sengaja tidak
 * punya field `scheduledAt` untuk dilupakan) dan Cancel Schedule hanya
 * relevan untuk hasil `schedulePost`, bukan `publishNow`.
 */
export interface PublishNowOutstandPostInput {
  targets: OutstandPostTargetInput[];
  caption: string;
  /** Opsional — sama semantik `ScheduleOutstandPostInput.media`. */
  media?: OutstandPostMediaInput[];
}

export interface PublishNowOutstandPostResult {
  /** Satu id post-level dari Outstand, mencakup SEMUA target dalam `targets`. */
  outstandPostId: string;
}

/**
 * Status satu target (akun) di dalam satu Outstand post — dikenal belakangan
 * (async), baik lewat polling `fetchPostOutcome` maupun webhook (T-026).
 * `pending` berarti Outstand belum menyelesaikan publish ke akun ini.
 */
export type OutstandPostTargetStatus = "pending" | "published" | "failed";

/**
 * Outcome satu target (akun) di dalam satu Outstand post — dipetakan dari
 * `socialAccounts[]` pada response `get-post-details`/`list-posts` Outstand.
 * `platformPostId` adalah ID post di platform aslinya (mis. ID media
 * Instagram) — BEDA dari `outstandPostId` (ID post di sisi Outstand).
 */
export interface PostTargetOutcome {
  outstandAccountId: string;
  status: OutstandPostTargetStatus;
  error: string | null;
  platformPostId: string | null;
  platformPostUrl: string | null;
  publishedAt: Date | null;
}

/**
 * Period yang dikenali Outstand untuk `fetchWorkspaceMetrics`
 * (`background-jobs.md` JOB-04 payload) — vocabulary eksternal Outstand,
 * SENGAJA dibedakan dari `SnapshotPeriod` domain internal analytics
 * (`weekly` | `monthly`, lihat `apps/web/src/domains/analytics/types.ts`).
 * `AnalyticsIngestionUseCase` (domain analytics) yang memetakan salah satu
 * ke yang lain — ACL tidak boleh bocor ke bahasa domain begitu saja,
 * sebaliknya juga tidak.
 */
export type OutstandMetricsPeriod = "last_7_days" | "last_30_days";

/**
 * Connect Account (T-013.1/T-013.2 Connect Account, T-015.3 Reconnect,
 * ADR-105) — input untuk meminta OAuth URL. `integration-layer.md`
 * ("Alur Connect Account", langkah 1-2) menyebut "Request OAuth URL"
 * sebagai langkah terpisah dari "exchange code" tapi tidak mendefinisikan
 * method-nya secara eksplisit di tabel kontrak — ADR-105 menutup gap ini
 * dengan split 2-method, mengikuti pola yang sudah ada di kontrak ini
 * (`schedulePost`/`publishNow` = inisiasi, `fetchPostOutcome` = resolve
 * belakangan).
 *
 * `redirectAccountId` diisi HANYA untuk reconnect akun existing (T-015.3,
 * akun `expired`/`disconnected` yang diulang OAuth-nya) — kosong berarti
 * connect akun baru (T-013). Field ini murni diteruskan lewat `state` ke
 * callback supaya `WorkspaceService` tahu harus UPDATE
 * `ConnectedAccount` yang sudah ada, bukan CREATE baru — adapter sendiri
 * tidak membuat keputusan domain itu.
 */
export interface ConnectAccountInput {
  workspaceId: string;
  platform: SocialPlatform;
  redirectAccountId?: string;
}

export interface ConnectAccountResult {
  /**
   * URL tujuan redirect browser user. Pada Fake adapter (ADR-059/ADR-105),
   * URL ini loopback ke callback route KITA SENDIRI
   * (`/api/integrations/outstand/callback`) alih-alih domain eksternal
   * Outstand — lihat ADR-105 untuk alasan (arsitektur Route Handler
   * callback tetap teruji sebelum real adapter T-025 masuk).
   */
  redirectUrl: string;
}

/**
 * Resolve Connect Callback (T-013.1/T-013.2, T-015.3, ADR-105, redesain
 * ADR-112 — SCOPE: single-page account saja, lihat KI-070 untuk Facebook
 * Pages) — dipanggil Route Handler `/api/integrations/outstand/callback`
 * (Prabowo Feature Engineer, di luar scope method ini) setelah Outstand
 * (atau Fake, loopback) mengarahkan balik. Field-field ini dipetakan
 * LANGSUNG dari query param yang dikirim Outstand — `outstandAccountId`
 * dari `account_id`, `username` dari `username`, `networkUniqueId` dari
 * `network_unique_id` (opsional — belum ada kebutuhan konkret yang
 * membaca nilainya, disimpan untuk validasi/defensif masa depan, bukan
 * dipakai memetakan `ConnectedAccountData` sekarang). `state` sama persis
 * dengan ADR-105 (dibentuk `connectAccount`, membawa `platform`+`nonce`+
 * `redirectAccountId?`).
 */
export interface ConnectCallbackInput {
  state: string;
  outstandAccountId: string;
  username: string;
  networkUniqueId?: string;
}

/**
 * Hasil resolve connect callback — dipetakan langsung ke field
 * `ConnectedAccount` yang disimpan `WorkspaceService` (`integration-layer.md`,
 * "Data yang disimpan pada ConnectedAccount"). `status` selalu `"active"`
 * di sini — value lain (`expired`/`disconnected`) hanya muncul belakangan
 * lewat webhook/aksi disconnect, bukan hasil connect yang baru saja
 * berhasil. `platform` diambil dari `state` (bukan dari Outstand — lihat
 * ADR-112), bukan dari `ConnectCallbackInput` secara langsung.
 *
 * **`avatarUrl` (menutup KI-076, ADR-120)** — foto profil akun yang baru
 * terhubung, `null` kalau Outstand tidak punya/tidak mengembalikan foto
 * untuk akun ini. **Field opsional di level TypeScript** (`avatarUrl?:`,
 * bukan `avatarUrl:`) supaya penambahan field ini tidak memaksa update
 * mekanis di puluhan mock `IOutstandAdapter` di domain LAIN
 * (engagement/analytics/publishing) yang tidak peduli avatar sama sekali —
 * blast radius yang tidak sepadan untuk field non-kritikal. **Kedua
 * implementasi nyata (`resolveConnectCallback`,
 * `confirmFacebookPagesConnection`) di `real-outstand-adapter.ts` TETAP
 * WAJIB mengisinya secara eksplisit** (`null` atau URL nyata) — opsional di
 * sini murni untuk kompatibilitas mock lama, bukan izin mengabaikannya di
 * implementasi baru. Untuk single-page account
 * (`resolveConnectCallback`), diisi dari network call TAMBAHAN
 * `GET /v1/social-accounts/{id}` (field wire `profile_picture_url`,
 * diverifikasi langsung lewat MCP resmi `mcp.outstand.so`, ADR-120). Untuk
 * Facebook Pages (`confirmFacebookPagesConnection`), method itu SENDIRI
 * tidak bisa mengisi field ini (response `finalize` tidak membawa foto —
 * lihat docstring `ConfirmFacebookPagesResult`) — `WorkspaceService` yang
 * menggabungkannya kembali dari `FacebookPendingPage.pictureUrl` (hasil
 * `listPendingFacebookPages` yang sudah lebih dulu dipanggil), BUKAN
 * adapter.
 */
export interface ConnectedAccountData {
  outstandAccountId: string;
  platform: SocialPlatform;
  handle: string;
  status: "active";
  avatarUrl?: string | null;
}

/**
 * Media upload working copy (T-024.3, ADR-040 poin 4, ADR-106) — dipanggil
 * SEBELUM `schedulePost`/`publishNow` untuk setiap media original (Supabase
 * Storage, T-024.2) yang akan disertakan pada sebuah post. Original media
 * TETAP menjadi milik aplikasi di bucket private Supabase Storage
 * (`integration-layer.md` IL-D07) — method ini murni membungkus 3 langkah
 * narasi Outstand Media API (request upload URL → `PUT` bytes → confirm
 * upload) menjadi SATU panggilan ACL, karena ketiga langkah itu murni
 * server-to-server (tidak ada redirect browser yang perlu diuji terpisah
 * seperti `connectAccount`/`exchangeConnectCode`, ADR-105) — lihat ADR-106
 * untuk perbandingan eksplisit split-2-method vs gabungan ini.
 *
 * `fileBuffer` adalah bytes media original yang sudah diambil caller dari
 * Supabase Storage (mis. lewat signed URL `MediaItem.url`) — adapter tidak
 * mengenal Supabase sama sekali, konsisten dengan batasan ACL.
 */
export interface UploadMediaWorkingCopyInput {
  fileBuffer: Buffer;
  mimeType: string;
}

/**
 * Hasil dipetakan langsung ke field `MediaItem.outstandMediaId`/
 * `outstandMediaUrl`/`outstandExpiresAt` (skema sudah mengantisipasi field
 * ini sejak T-024.1) — persistensinya sendiri di luar scope method ini
 * (tanggung jawab use-case pemanggil, T-024.4/T-025.5).
 */
export interface UploadMediaWorkingCopyResult {
  outstandMediaId: string;
  outstandMediaUrl: string;
  expiresAt: Date;
}

/**
 * Facebook Pages — session-token connect flow (T-025.4, ADR-115, menutup
 * KI-070; wire-format dikoreksi ADR-116) — Facebook (dan provider
 * multi-halaman lain di sisi Outstand) tidak bisa memakai
 * `resolveConnectCallback` (single-page saja, ADR-112): satu login bisa
 * mengelola banyak Page, jadi Outstand redirect balik dengan
 * `sessionToken` (BUKAN `account_id`/`username` langsung), dipakai untuk
 * `GET /v1/social-accounts/pending/{sessionToken}` (daftar Page yang bisa
 * dipilih) lalu `POST /v1/social-accounts/pending/{sessionToken}/finalize`
 * (konfirmasi Page yang dipilih user, boleh lebih dari satu sekaligus).
 *
 * `pageId` dipetakan dari field wire `id` (real adapter, ADR-116) —
 * **opaque, dipakai balik sebagai anggota `selectedPageIds` di confirm,
 * bukan `outstandAccountId`** (Outstand bisa mengembalikan id berbeda di
 * response confirm, sama seperti pola "jangan asumsikan" ADR-039/114 soal
 * `board_id` Pinterest).
 */
export interface FacebookPendingPage {
  pageId: string;
  name: string;
  pictureUrl?: string;
  category?: string;
}

export interface ListPendingFacebookPagesInput {
  sessionToken: string;
}

export interface ListPendingFacebookPagesResult {
  pages: FacebookPendingPage[];
}

export interface ConfirmFacebookPagesInput {
  sessionToken: string;
  /** Minimum 1 elemen — divalidasi UI (tombol disabled) DAN adapter/WorkspaceService (defense-in-depth, jangan cuma percaya client). */
  selectedPageIds: string[];
}

export interface ConfirmFacebookPagesResult {
  /**
   * Satu entri per Page yang berhasil dikonfirmasi Outstand — `platform`
   * SELALU `SocialPlatform.Facebook` untuk tiap entri. **`avatarUrl` SELALU
   * `null` di sini** (menutup KI-076, ADR-120) — response
   * `POST .../finalize` tidak membawa foto profil sama sekali (beda dari
   * response `GET .../pending/{sessionToken}` yang membawa
   * `profilePictureUrl`, lihat `FacebookPendingPage.pictureUrl`). Adapter
   * TIDAK menggabungkannya sendiri (dua response beda call, adapter tidak
   * boleh menyimpan state lintas panggilan) — `WorkspaceService` yang
   * bertanggung jawab join balik `pictureUrl` dari hasil
   * `listPendingFacebookPages` sebelumnya, per `pageId`/`outstandAccountId`.
   */
  accounts: ConnectedAccountData[];
}

/**
 * Pinterest board (menutup KI-072, sisa scope ADR-114) — satu entri dari
 * `GET /v1/pinterest/accounts/{id}/boards` Outstand, dipakai UI Draft Editor
 * untuk dropdown board per post (`FacebookPendingPage.pageId` adalah
 * preseden penamaan serupa — `id` di sini SENGAJA opaque, dikirim balik
 * apa adanya sebagai `platformOptions.boardId` saat publish, bukan
 * diasumsikan angka/format tertentu).
 */
export interface PinterestBoard {
  id: string;
  name: string;
}

/**
 * NOTE (2026-08-26, dicatat sebagai gap diketahui, bukan diimplementasikan
 * penuh di sini — di luar scope redesain ini, lihat draft ADR): dokumentasi
 * resmi Outstand `get-post-analytics` sebenarnya mengembalikan metrics
 * PER-AKUN sekaligus `aggregated_metrics` di root untuk SATU `outstandPostId`
 * — bentuk yang lebih kaya daripada satu `FetchPostMetricsResult` flat di
 * bawah. Kontrak ini TIDAK diubah sekarang (scope redesain ini murni publish
 * flow); parameter berganti nama dari `outstandJobId` (dulu per-target, ID
 * yang sekarang sudah tidak ada) menjadi `outstandPostId` (post-level, sesuai
 * model baru) supaya tetap kompilasi dan konsisten penamaan, tapi caller
 * (`AnalyticsIngestionUseCase.syncPostMetrics`) masih memanggil sekali per
 * target dengan `outstandPostId` yang sama untuk semua target satu post —
 * revisi penuh (array per-akun + aggregate) didokumentasikan sebagai
 * follow-up T-041, bukan bagian ADR ini.
 */
export interface FetchPostMetricsResult {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number | null;
  engagementRate: number;
}

export interface FetchWorkspaceMetricsResult {
  totalPosts: number;
  totalReach: number;
  totalEngagements: number;
  avgEngagementRate: number;
}

/**
 * Satu komentar external Outstand (Engagement MVP, T-051, redesain KI-068
 * ADR-113) — dipetakan ke `EngagementInboxItem` oleh `EngagementService`
 * saat upsert (external comment ID = `outstandCommentId`, dedup key
 * bersama `connectedAccountId` yang diketahui CALLER dari konteks loop
 * sync — lihat `SyncCommentsUseCase` — bukan dari field di sini).
 *
 * **`outstandPostId` sekarang WAJIB (bukan lagi `string | null`)** — API
 * resmi Outstand men-scope replies PER POST
 * (`GET /v1/posts/{postId}/replies`), jadi setiap komentar yang berhasil
 * diambil PASTI berasal dari `outstandPostId` yang diminta caller (di-echo
 * balik ke sini, BUKAN dari field response Outstand — `NormalizedReply`
 * tidak membawa post id). Gap lama ("Outstand bisa mengembalikan komentar
 * dari post yang tidak terlacak") sudah tidak relevan dengan model
 * per-post ini.
 *
 * **`outstandAccountId` DIHAPUS (redesain KI-068)** — field lama ini tidak
 * pernah bisa diisi bermakna oleh real adapter: `fetchComments` sekarang
 * menerima `accountUsername` (bukan account ID) sebagai parameter, dan
 * response `NormalizedReply` Outstand tidak membawa account id sama
 * sekali (hanya `author`, nama/handle penulis KOMENTAR, bukan akun kita
 * yang menerimanya). Caller (`SyncCommentsUseCase`) sudah tahu
 * `connectedAccountId` dari konteks loop-nya sendiri (data durable), jadi
 * tidak butuh field ini di-echo balik oleh adapter — pola yang sama
 * dengan alasan `expectedOutstandAccountIds` di `fetchPostOutcome` disuplai
 * caller, bukan ditebak adapter.
 */
export interface InboxCommentData {
  outstandCommentId: string;
  platform: SocialPlatform;
  authorHandle: string;
  content: string;
  outstandPostId: string;
  receivedAt: Date;
}

/**
 * Hasil `fetchComments` (redesain KI-068/ADR-113) — **`nextCursor` DIHAPUS**
 * (bukan disisakan `null` selalu, itu sudah keputusan eksplisit King Rezi,
 * bukan future-proofing): endpoint resmi Outstand
 * (`GET /v1/posts/{postId}/replies`) TIDAK punya pagination cursor sama
 * sekali. JOB-03 (`background-jobs.md`) sekarang memanggil `fetchComments`
 * SEKALI per post (bukan berulang sampai cursor habis).
 */
export interface FetchCommentsResult {
  comments: InboxCommentData[];
}

/**
 * Hasil `replyToComment` — dipetakan ke `EngagementReply.outstandReplyId`
 * (T-054). Tidak berubah oleh redesain KI-068 — tetap `reply_id` platform
 * hasil `POST /v1/posts/{postId}/replies`.
 */
export interface ReplyToCommentResult {
  outstandReplyId: string;
}

/**
 * Import Posts dari Social Account (T-090, ADR-093 poin 5) — mapping ke
 * `POST /v1/social-accounts/{id}/imports`. Endpoint ini BERBAYAR dan async:
 * enqueue job di sisi Outstand, hasil diketahui belakangan lewat
 * `fetchImportJobStatus` (polling, sekarang) atau webhook
 * `import.completed`/`import.failed` (real adapter T-025 nanti, belum
 * diimplementasikan). Tidak didukung untuk X/Twitter (ADR-093 Context) —
 * caller (Use Case) yang bertanggung jawab tidak memanggil ini untuk akun
 * platform itu, kontrak ini sendiri tidak menolaknya (ACL tidak tahu
 * platform tujuan, hanya `outstandAccountId`).
 */
export interface ImportPostsInput {
  /** Default (trigger awal/on-connect, ADR-093 poin 5): 90 hari ke belakang. Trigger periodik/manual memakai watermark `lastImportedUntil`. */
  since?: Date;
  until?: Date;
  /** Default (trigger awal): 100. */
  limit?: number;
}

/** Hasil `importPosts` — murni id job untuk di-tracking, BUKAN hasil import itu sendiri (resolve belakangan lewat `fetchImportJobStatus`). */
export interface ImportJobHandle {
  importJobId: string;
}

export type ImportJobStatus = "pending" | "completed" | "failed";

/**
 * Satu post yang berhasil ditarik dari akun sosial (dibuat LANGSUNG di
 * platform, bukan lewat tool kita) — dipetakan ke `PublishingPost`/
 * `PublishingPostTarget` berstatus `Imported` oleh
 * `ImportPostsProcessUseCase` (domain `publishing`). `platformPostId`
 * dipakai sebagai kunci dedup terhadap `PublishingPostTarget.platformPostId`
 * yang sudah ada dari ADR-092 (ADR-093 poin 4) — SATU post per akun (import
 * selalu per `outstandAccountId`, beda dari `schedulePost`/`publishNow`
 * yang bisa multi-akun dalam satu post).
 */
export interface ImportedPostData {
  platformPostId: string;
  caption: string;
  publishedAt: Date;
  platformPostUrl: string | null;
  /**
   * URL media eksternal dari platform asal (BUKAN Supabase Storage/media
   * internal — post ini tidak punya `mediaIds` internal sama sekali).
   * Belum ada kolom DB khusus untuk ini (T-090 scope: skema hanya
   * menambah `authorId` nullable + watermark akun, lihat ADR-093) —
   * `ImportPostsProcessUseCase` menyimpannya sementara di
   * `PublishingPostTarget.platformOptions` (kolom JSON yang sudah ada)
   * supaya tidak hilang untuk UI Imported nanti (T-090.5, masih blocked),
   * bukan keputusan skema baru.
   */
  mediaUrls: string[];
}

/**
 * Hasil `fetchImportJobStatus` — resolve belakangan (polling SEKARANG,
 * webhook `import.completed`/`import.failed` di real adapter T-025 nanti)
 * untuk SATU `importJobId` dari `importPosts`. `posts` hanya terisi
 * (non-empty) kalau `status: "completed"`.
 *
 * **Pemetaan status enum real API → kontrak (ADR-123, T-112):** real
 * Outstand API punya 5 status (`queued|running|completed|failed|partial`),
 * kontrak ini tetap 3 (`pending|completed|failed`) — `queued`/`running` →
 * `"pending"`, `failed` → `"failed"`, dan **`partial` DIPETAKAN KE
 * `"completed"`** (keputusan eksplisit King Rezi, bukan tebakan adapter):
 * post yang berhasil diimport tetap diambil (tidak di-drop), `error` diisi
 * ringkasan kegagalan sebagian (mis. "`{failed}` dari `{imported+skipped+
 * failed}` post gagal diimport") supaya caller tahu ini bukan sukses penuh
 * walau `status: "completed"`.
 */
export interface ImportJobOutcome {
  status: ImportJobStatus;
  posts: ImportedPostData[];
  error: string | null;
}

/**
 * Anti-Corruption Layer contract untuk Outstand (integration-layer.md,
 * ADR-040, redesain ADR baru 2026-08-26). Domain internal (Publishing,
 * Analytics, dst.) hanya mengenal interface ini — implementasi konkret
 * (real HTTP client maupun Fake) hidup di luar domain
 * (`apps/web/src/lib/adapters/outstand/`), dipilih lewat factory
 * `getOutstandAdapter`.
 */
export interface IOutstandAdapter {
  /**
   * Connect Account (T-013.1/T-013.2, T-015.3 Reconnect, ADR-105) —
   * langkah 1 dari alur 2-tahap OAuth (`integration-layer.md`, "Alur
   * Connect Account"): minta URL redirect OAuth. Dipanggil
   * `WorkspaceService` saat user klik "Connect Account" (T-013) atau
   * "Reconnect" (T-015.3, dengan `redirectAccountId` diisi). Tidak
   * membuat/mengubah `ConnectedAccount` apa pun — itu terjadi belakangan
   * di `resolveConnectCallback` setelah callback (ADR-112).
   */
  connectAccount(input: ConnectAccountInput): Promise<ConnectAccountResult>;

  /**
   * Connect Account (T-013.1/T-013.2, T-015.3 Reconnect, ADR-105, redesain
   * ADR-112) — langkah 2 dari alur 2-tahap OAuth. **SCOPE: single-page
   * account saja** (Instagram, X, LinkedIn, Threads, TikTok, YouTube,
   * Pinterest, dst — bukan Facebook Pages multi-halaman, lihat KI-070).
   * BUKAN "exchange" — Outstand sudah mengirim data akun (`account_id`/
   * `username`/`network_unique_id`) langsung lewat query param callback,
   * jadi method ini murni validasi/normalisasi jadi `ConnectedAccountData`
   * (real adapter TIDAK melakukan network call untuk ini). Dipanggil
   * Route Handler `/api/integrations/outstand/callback` (di luar scope
   * kontrak ini). `WorkspaceService` yang memutuskan CREATE (connect baru)
   * vs UPDATE (reconnect) `ConnectedAccount` berdasarkan `redirectAccountId`
   * yang dibawa lewat `state` — bukan tanggung jawab adapter.
   */
  resolveConnectCallback(
    input: ConnectCallbackInput,
  ): Promise<ConnectedAccountData>;

  /**
   * Facebook Pages — langkah 3 (T-025.4, ADR-115, wire-format dikoreksi
   * ADR-116): daftar Page yang tersedia untuk dipilih dari sebuah
   * `sessionToken` (didapat Route Handler callback dari redirect Outstand,
   * lihat docstring `FacebookPendingPage`). Murni pass-through + mapping
   * response — tidak ada RBAC/business logic di adapter (ACL boundary,
   * AGENTS.md #6), itu tanggung jawab `WorkspaceService.listFacebookPendingPages`.
   */
  listPendingFacebookPages(
    input: ListPendingFacebookPagesInput,
  ): Promise<ListPendingFacebookPagesResult>;

  /**
   * Facebook Pages — langkah 4 (T-025.4, ADR-115, wire-format dikoreksi
   * ADR-116): konfirmasi Page yang dipilih user (SATU panggilan untuk
   * SEMUA `selectedPageIds`, bukan N panggilan — bentuk endpoint Outstand
   * sendiri, `POST .../finalize` menerima array). `WorkspaceService.
   * confirmFacebookPagesConnection` yang bertanggung jawab persist
   * `ConnectedAccount` per Page hasil method ini (skip-on-conflict,
   * idempotent-guard ADR-109) — adapter ini tidak menyentuh database sama
   * sekali.
   */
  confirmFacebookPagesConnection(
    input: ConfirmFacebookPagesInput,
  ): Promise<ConfirmFacebookPagesResult>;

  /**
   * Pinterest boards (menutup KI-072, sisa scope ADR-114) — daftar board
   * ASLI milik akun Pinterest yang sudah terhubung (`outstandAccountId`),
   * dipakai UI Draft Editor untuk dropdown board per post SEBELUM publish
   * (bukan text input bebas). Murni pass-through + mapping response — tidak
   * ada RBAC/business logic di adapter (ACL boundary, AGENTS.md #6), itu
   * tanggung jawab `WorkspaceService.listPinterestBoards` (anti-IDOR:
   * validasi `outstandAccountId` benar-benar milik workspace/akun yang
   * diminta, SEBELUM dipanggil ke sini).
   */
  listPinterestBoards(outstandAccountId: string): Promise<PinterestBoard[]>;

  /**
   * Media upload working copy (T-024.3, ADR-040 poin 4, ADR-106) — minta
   * Outstand meng-host working copy satu media original, dipanggil sebelum
   * `schedulePost`/`publishNow` untuk post yang menyertakan media.
   * `PublishingService` yang bertanggung jawab mengambil `fileBuffer` dari
   * Supabase Storage dan mengisi `PostTarget`/caption dengan
   * `outstandMediaUrl` hasil method ini — adapter tidak menyimpan apa pun,
   * hanya membentuk working copy sekali panggil.
   */
  uploadMediaWorkingCopy(
    input: UploadMediaWorkingCopyInput,
  ): Promise<UploadMediaWorkingCopyResult>;

  /**
   * Publishing (ADR-059, redesain 2026-08-26) — SATU call untuk SEMUA
   * target/akun tujuan post ini, sesuai kontrak resmi Outstand
   * `create-a-post` (`accounts: array<string>`, satu `post.id` untuk semua
   * target). Tidak mengembalikan outcome per akun — itu tanggung jawab
   * `fetchPostOutcome` (polling) atau webhook `post.published`/`post.error`
   * (T-026).
   */
  schedulePost(
    input: ScheduleOutstandPostInput,
  ): Promise<ScheduleOutstandPostResult>;

  /**
   * Publishing (T-029, ADR-047, redesain 2026-08-26) — publish langsung
   * tanpa jadwal ("Publish Now"), SATU call untuk semua target sama seperti
   * `schedulePost`. Fake adapter (ADR-059) tetap always-success instan,
   * tapi sekarang hanya mengembalikan `outstandPostId` — caller yang
   * membutuhkan outcome per akun instan (mis. `publishedUrl` untuk UI)
   * memanggil `fetchPostOutcome(outstandPostId)` segera setelah ini,
   * bukan menerimanya langsung dari hasil `publishNow`.
   */
  publishNow(
    input: PublishNowOutstandPostInput,
  ): Promise<PublishNowOutstandPostResult>;

  /**
   * Publishing (redesain 2026-08-26, menggantikan model lama tanpa method
   * ini) — resolve status per akun BELAKANGAN untuk satu `outstandPostId`.
   * Dipetakan dari `socialAccounts[]` pada response `get-post-details`
   * Outstand. Dipakai untuk polling SEKARANG (webhook T-026 belum ada) dan
   * tetap relevan setelah webhook ada (webhook bisa memicu pembacaan ini
   * alih-alih membawa payload lengkap, sesuai IL-D11 di
   * `integration-layer.md`). Nama method ini sudah dipakai di
   * `integration-layer.md` (bagian "OutstandAdapter", sebelum redesain) —
   * dipertahankan sengaja supaya T-026 (webhook, belum dikerjakan) tidak
   * perlu rework nama method saat diimplementasikan nanti.
   *
   * **`expectedOutstandAccountIds` (bug fix T-027, root-cause — dikonfirmasi
   * King Rezi via `AskUserQuestion` setelah temuan QA Najwa):** parameter
   * WAJIB berisi daftar `outstandAccountId` yang caller harapkan punya
   * outcome untuk `outstandPostId` ini. Ditambahkan karena implementasi
   * SEBELUMNYA membiarkan `FakeOutstandAdapter` "mengingat" set akun per
   * `outstandPostId` lewat `Map` in-memory level-modul yang diisi saat
   * `schedulePost`/`publishNow` dipanggil — ini SALAH untuk T-027 (job
   * runner Railway Cron): `schedulePost()` dipanggil dari Server Action,
   * `fetchPostOutcome()` dipanggil BELAKANGAN (bisa berjam-jam/berhari-hari)
   * dari Route Handler TERPISAH (`/api/jobs/run`) — dibuktikan lewat
   * inspeksi `.next/server` build production (Turbopack) bahwa Next.js
   * membundle Route Handler dan Server Action/RSC page sebagai CHUNK
   * TERPISAH yang masing-masing mendapat SALINAN modul `FakeOutstandAdapter`
   * sendiri (module-level state TIDAK dijamin sama), dan bahkan seandainya
   * dijamin sama (mis. `globalThis` caching), memori proses tidak survive
   * restart Railway (auto-deploy tiap push, DI-D05) di antara waktu
   * schedule dan waktu due post yang bisa berjeda lama.
   *
   * Real Outstand API TIDAK butuh parameter ini secara fungsional (server
   * mereka sudah tahu account list persis dari `create-a-post` yang
   * disimpan di sisi mereka, durable) — real adapter (T-025, belum ada)
   * boleh mengabaikannya atau memakainya untuk validasi/filter defensif.
   * Untuk Fake (ADR-059), parameter ini membuat method jadi PURE FUNCTION
   * dari `(outstandPostId, expectedOutstandAccountIds)` — tidak butuh
   * state/memori lintas panggilan sama sekali.
   */
  fetchPostOutcome(
    outstandPostId: string,
    expectedOutstandAccountIds: string[],
  ): Promise<PostTargetOutcome[]>;

  /**
   * Publishing (T-030, ADR-049 Tier 2, redesain 2026-08-26) — batalkan
   * SELURUH post yang sudah dijadwalkan di Outstand ("Cancel Schedule").
   * `outstandPostId` adalah external reference post-level dari
   * `PublishingPost.outstandPostId` (BUKAN per-target lagi — Outstand tidak
   * punya konsep "job per akun" untuk dibatalkan satu-satu; membatalkan
   * post berarti membatalkan seluruh target sekaligus). Tidak mengembalikan
   * apa pun (`void`): repository sudah menjadi source of truth begitu post
   * kembali ke status Draft, panggilan ini murni membersihkan sisi
   * Outstand supaya job yang dibatalkan tidak tetap tayang di sana.
   */
  cancelScheduledPost(outstandPostId: string): Promise<void>;

  /**
   * Retry manual (T-034.4, ADR-092) — Outstand tidak punya endpoint retry
   * resmi; rekomendasi dokumentasi resminya adalah hapus post yang gagal
   * (`delete-a-post-from-social-networks`) lalu buat post baru
   * (`create-a-post`), bukan re-trigger job yang sama. Method ini memetakan
   * langkah "hapus" itu.
   *
   * **Keputusan scope (dikonfirmasi King Rezi, bukan asumsi):** retry hanya
   * me-recreate TARGET yang gagal (satu akun), BUKAN seluruh post — target
   * lain di post yang sama yang sudah `published` tidak disentuh. Karena
   * itu, `accountIds` opsional membatasi penghapusan ke akun tertentu saja
   * di dalam `outstandPostId`; kosongkan untuk menghapus seluruh post
   * (dipakai jalur lain di luar retry, kalau ada). Recreate target yang
   * gagal memakai `publishNow`/`schedulePost` yang sudah ada (dipanggil
   * dengan array `targets` berisi 1 target) — TIDAK ada method create baru
   * di kontrak ini untuk itu.
   *
   * Best-effort di level use-case (pola sama seperti `cancelScheduledPost`:
   * kegagalan panggilan ini di real adapter nanti cukup di-log oleh
   * pemanggil, bukan dilempar ke user) — tapi di level adapter, method ini
   * tetap boleh throw error seperti method lain kalau real adapter (T-025)
   * gagal memanggil Outstand; pemanggil (use-case publishing) yang
   * menentukan bagaimana error itu ditangani.
   */
  deletePost(outstandPostId: string, accountIds?: string[]): Promise<void>;

  /**
   * Analytics (T-041) — metrik satu post yang sudah dipublikasikan.
   * `outstandPostId` adalah external reference post-level dari
   * `PublishingPost.outstandPostId` (redesain 2026-08-26 — dulu per-target
   * `outstandJobId` yang sudah tidak ada di model baru). Lihat catatan gap
   * di `FetchPostMetricsResult` — bentuk hasil belum direvisi mengikuti
   * `aggregated_metrics`/per-akun Outstand, follow-up T-041.
   */
  fetchPostMetrics(outstandPostId: string): Promise<FetchPostMetricsResult>;

  /**
   * Analytics (T-041) — metrik agregat satu connected account untuk
   * `period` tertentu. `outstandAccountId` adalah external reference dari
   * `WorkspaceConnectedAccount`.
   */
  fetchWorkspaceMetrics(
    outstandAccountId: string,
    period: OutstandMetricsPeriod,
  ): Promise<FetchWorkspaceMetricsResult>;

  /**
   * Engagement Sync (JOB-03, T-051, redesain KI-068/ADR-113) — ambil
   * komentar untuk SATU post (`outstandPostId`), BUKAN lagi satu
   * `ConnectedAccount`. API resmi Outstand men-scope replies per post
   * (`GET /v1/posts/{postId}/replies`, query `network` WAJIB, `username`
   * opsional — tapi kita selalu mengirimnya untuk menghindari 400
   * disambiguasi saat satu post publish ke >1 akun di network yang sama)
   * dan TIDAK punya pagination cursor sama sekali — karena itu tidak ada
   * lagi parameter `cursor`/`nextCursor`.
   *
   * `SyncCommentsUseCase` (JOB-03) sekarang memanggil ini SEKALI PER POST
   * (bukan sekali per akun) — daftar post yang di-sync diambil dari
   * `PublishingPost`/`PublishingPostTarget` milik `connectedAccountId` ini
   * (query domain `publishing` sendiri lewat public API barrel, BUKAN
   * endpoint list-posts Outstand — keputusan eksplisit King Rezi/KI-068).
   * `platform`/`accountUsername` diteruskan dari data durable yang sudah
   * diketahui caller (pola sama `expectedOutstandAccountIds` di
   * `fetchPostOutcome` — adapter tidak menebak, caller menyuplai).
   */
  fetchComments(input: {
    outstandPostId: string;
    platform: SocialPlatform;
    accountUsername: string;
  }): Promise<FetchCommentsResult>;

  /**
   * Reply dari dalam aplikasi (T-054, redesain KI-068/ADR-113, KI-071) —
   * dipanggil `EngagementService` setelah RBAC check lolos. Endpoint resmi
   * Outstand `POST /v1/posts/{postId}/replies` WAJIB tahu `postId` —
   * `outstandPostId` karena itu sekarang wajib di kontrak ini (sebelumnya
   * method ini hanya membawa `outstandCommentId`, yang TIDAK cukup untuk
   * memanggil endpoint resmi sama sekali, root cause KI-068). `content`
   * adalah isi balasan. `parentOutstandCommentId` opsional — kalau diisi,
   * balasan di-thread di bawah komentar itu (`parent_comment_id`, didukung
   * Facebook/Instagram/LinkedIn/Threads); kalau kosong, balasan langsung
   * ke post (`EngagementService.reply` mengisinya dengan `outstandCommentId`
   * komentar yang sedang dibalas — lihat catatan di sana).
   *
   * **`accountUsername` WAJIB** (KI-071, pola sama `fetchComments`) —
   * spec Outstand menandai `account_username` opsional, tapi kita SELALU
   * mengirimnya untuk menghindari 400 disambiguasi saat satu post publish
   * ke >1 akun di network yang sama. Caller menyuplai handle akun
   * (`WorkspaceConnectedAccount.handle`) dari data durable — adapter
   * tidak menebak.
   */
  replyToComment(input: {
    outstandPostId: string;
    content: string;
    accountUsername: string;
    parentOutstandCommentId?: string;
  }): Promise<ReplyToCommentResult>;

  /**
   * Import Posts dari Social Account (T-090, ADR-093 poin 5) — mapping 1:1
   * ke `POST /v1/social-accounts/{id}/imports`. Tidak mengembalikan hasil
   * import sinkron (sama pola `schedulePost`/`publishNow` — enqueue dulu,
   * resolve belakangan lewat `fetchImportJobStatus`).
   */
  importPosts(
    outstandAccountId: string,
    input: ImportPostsInput,
  ): Promise<ImportJobHandle>;

  /**
   * Import Posts dari Social Account (T-090, ADR-093 poin 5; signature
   * diamandemen T-112/ADR-123) — resolve status job import BELAKANGAN
   * (polling SEKARANG; webhook `import.completed`/`import.failed` di real
   * adapter T-025 nanti, pasangan `fetchPostOutcome` tapi untuk import,
   * bukan publish).
   *
   * **`outstandAccountId` ditambahkan (ADR-123)** — endpoint sungguhan
   * `GET /v1/social-accounts/{id}/imports/{importId}` (diverifikasi
   * terhadap OpenAPI spec resmi Outstand, T-112) mensyaratkan account id
   * DI PATH, bukan hanya `importJobId` — signature awal (T-090, sebelum
   * endpoint ini pernah diverifikasi) salah tebak bahwa `importJobId` saja
   * cukup untuk mengidentifikasi job secara global. Semua caller
   * (`ImportPostsTriggerUseCase`) WAJIB menyuplai `outstandAccountId` yang
   * sama dengan yang dipakai di `importPosts` untuk job ini.
   */
  fetchImportJobStatus(
    outstandAccountId: string,
    importJobId: string,
  ): Promise<ImportJobOutcome>;
}
