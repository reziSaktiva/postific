import type {
  ConnectedAccountId,
  ContentFormat,
  MediaId,
  PostId,
  PostTargetId,
  SocialPlatform,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import type { ContentStatus } from "@postific/shared";

export interface PublishingPostRecord {
  id: PostId;
  workspaceId: WorkspaceId;
  authorId: UserId;
  caption: string;
  status: ContentStatus;
  /**
   * Media (T-024.4) yang di-attach ke post ini — SATU set untuk seluruh
   * post (bukan per-target/per-akun, ADR-107). Opsional di level tipe
   * (bukan `MediaId[]` wajib) supaya banyak fake repository di test
   * lain (schedule/publish/cancel/retry use-case, tidak menyentuh media
   * sama sekali) tidak wajib ikut diubah — `undefined` diperlakukan sama
   * dengan array kosong oleh seluruh caller (`getDraftAction`,
   * `resolveDraftMediaIds`, dst.).
   */
  mediaIds?: MediaId[];
  createdAt: Date;
  updatedAt: Date;
}

/** Input satu target saat menjadwalkan post — dipetakan ke `PublishingPostTarget`. */
export interface SchedulePostTargetInput {
  connectedAccountId: ConnectedAccountId;
  platform: SocialPlatform;
  contentFormat: ContentFormat;
  platformOptions?: Record<string, unknown>;
}

/** Target yang baru dibuat oleh `schedulePost` — id dibutuhkan untuk `updateTargetOutcome` per target. */
export interface ScheduledPostTargetRecord {
  id: PostTargetId;
  connectedAccountId: ConnectedAccountId;
}

export interface PublishingScheduleRecord extends PublishingPostRecord {
  targets: ScheduledPostTargetRecord[];
}

/**
 * Satu target dalam hasil `findPostTargetsByOutstandPostId` (T-026, webhook
 * Outstand) — `outstandAccountId` disertakan supaya caller (`WebhookProcessor`)
 * bisa mencocokkan `PostTargetOutcome.outstandAccountId` (dari
 * `IOutstandAdapter.fetchPostOutcome`) ke `postTargetId` internal tanpa
 * query terpisah per akun.
 */
export interface WebhookPostTargetLookupRecord {
  postTargetId: PostTargetId;
  connectedAccountId: ConnectedAccountId;
  outstandAccountId: string;
}

/**
 * Hasil `findPostTargetsByOutstandPostId` (T-026) — post-level info +
 * seluruh target milik post itu. `authorId` dipakai `WebhookProcessor`
 * sebagai `actingUserId` untuk memanggil `updateTargetOutcome`/
 * `markPostFailed` SETELAH lookup ini (kedua method itu tetap dibungkus
 * `withCurrentUser`, TIDAK bypass RLS sendiri) — lihat catatan lengkap di
 * migration `20260907120000_t026_outstand_webhook_system_lookups` untuk
 * kenapa method INI (baca) perlu bypass RLS: webhook route tidak punya
 * Better Auth session/`userId` untuk di-set sebelum tahu post/workspace mana
 * yang dimaksud (chicken-and-egg — RLS default-deny tanpa
 * `app.current_user_id` yang valid).
 */
export interface WebhookPostLookupRecord {
  postId: PostId;
  workspaceId: WorkspaceId;
  authorId: UserId;
  targets: WebhookPostTargetLookupRecord[];
}

/**
 * Satu target (akun + platform) milik queue item (T-032.2, KSP-03).
 * `accountHandle` dipetakan dari `WorkspaceConnectedAccount.handle` supaya
 * UI Queue (T-032.3) tidak perlu query terpisah per akun.
 */
export interface QueueItemTargetRecord {
  id: PostTargetId;
  connectedAccountId: ConnectedAccountId;
  platform: SocialPlatform;
  contentFormat: ContentFormat;
  accountHandle: string;
}

/**
 * Satu `PublishingPost` berstatus Scheduled untuk Queue (T-032.2, KSP-03,
 * ADR-083). `targets` bisa lebih dari satu kalau post yang sama
 * dijadwalkan ke beberapa akun sekaligus — tetap 1 `QueueItemRecord` per
 * post ("1 card per schedule", T-032.0), bukan 1 record per target.
 * `createdAt` dipakai UI untuk label "Dibuat X lalu" (T-032.0 putaran 1).
 */
export interface QueueItemRecord {
  id: PostId;
  caption: string;
  scheduledAt: Date;
  createdAt: Date;
  targets: QueueItemTargetRecord[];
}

/**
 * Hasil `cancelSchedule` — post yang sudah kembali ke status Draft, plus
 * `outstandPostId` post-level yang barusan dibaca (SEBELUM dihapus) supaya
 * use-case (`CancelScheduleUseCase`) bisa memanggil
 * `IOutstandAdapter.cancelScheduledPost` SEKALI SETELAH DB sudah commit —
 * sama pola dengan `schedulePost`/`publishNow` (persist dulu, network call
 * sesudah). Redesain 2026-08-26: dulu satu `outstandJobId` per target
 * (`CancelledPostTargetRecord[]`) — sekarang satu `outstandPostId` untuk
 * SELURUH post, konsisten dengan model baru "1 call Outstand mencakup semua
 * target". `null` kalau post belum pernah dapat `outstandPostId` (mis. race
 * jarang: baru saja dijadwalkan, adapter belum sempat mengembalikan id) —
 * use-case cukup skip pemanggilan adapter.
 */
export interface PublishingCancelScheduleRecord extends PublishingPostRecord {
  outstandPostId: string | null;
}

/**
 * Satu `PublishingPost` untuk Calendar (T-033.1, KSP-02) — beda dari
 * `QueueItemRecord` (khusus status Scheduled), Calendar mencakup semua
 * status yang tampil di mockup (KSP-02-F02): Draft, In Review, Ready to
 * Schedule, Scheduled, Published, Failed. `scheduledAt`/`publishedAt`
 * dibawa mentah (bukan di-collapse ke satu field "tanggal tampil") supaya
 * caller (`PublishingService.listCalendarPosts`) yang memutuskan urutan
 * dan penempatan grid — lihat catatan gap di bawah.
 *
 * **Gap diketahui (dilaporkan ke King Rezi, bukan keputusan sepihak):**
 * post berstatus Draft/InReview/ReadyToSchedule saat ini TIDAK punya
 * `scheduledAt` maupun `publishedAt` terisi di runtime manapun (keduanya
 * hanya diisi oleh `schedulePost`/`publishNow`) — jadi query rentang
 * tanggal generik di bawah ini otomatis tidak akan mengembalikan post
 * berstatus itu sama sekali walau tidak ada filter status eksplisit.
 * Placement 3 status itu di grid Calendar (kalau memang harus muncul di
 * grid, bukan di luar grid seperti daftar Drafts terpisah) adalah
 * keputusan produk yang belum ada di baseline — perlu ADR/klarifikasi
 * sebelum T-033.3/.4 (UI grid) diimplementasikan.
 */
/**
 * Target Calendar (T-033.8) — `QueueItemTargetRecord` + `platformPostUrl`
 * (`PublishingPostTarget.platformPostUrl`, schema.prisma:264) untuk tautan
 * "Go to post" di Popover (KSP-02-F08). Field baru di sini saja, bukan di
 * `QueueItemTargetRecord` — Queue tidak butuh URL post asli.
 */
export interface CalendarItemTargetRecord extends QueueItemTargetRecord {
  platformPostUrl: string | null;
}

export interface CalendarItemRecord {
  id: PostId;
  caption: string;
  status: ContentStatus;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  /**
   * T-092.5 (ADR-094 poin 5, 6): ditambahkan supaya `getCalendarPostById`
   * bisa direuse untuk granular patch Realtime Drafts — `DraftsList`
   * menampilkan label "Diedit X lalu" (`PublishingPostRecord.updatedAt`,
   * sama seperti sebelum Realtime dipasang), yang sebelum ini tidak
   * tersedia di proyeksi Calendar/Queue (keduanya tidak butuh field ini).
   * Additive-only — tidak mengubah bentuk data yang dipakai Calendar/Queue.
   */
  updatedAt: Date;
  targets: CalendarItemTargetRecord[];
}

/**
 * Status outcome satu `PublishingPostTarget` (T-034.1) — union yang sama
 * dengan parameter `updateTargetOutcome` di bawah, ditambah nilai awal
 * `"pending"` (baris baru dibuat oleh `schedulePost`/`publishNow`, belum
 * pernah di-update outcome-nya). Ditaruh di sini (bukan `packages/shared`)
 * karena belum ada BC lain yang mengonsumsinya — konsisten alasan
 * `SnapshotPeriod` di domain analytics (T-040).
 */
export type PublishingPostTargetStatus =
  "pending" | "scheduled" | "published" | "failed";

/**
 * Satu target (akun + platform) untuk History (T-034.1) — `QueueItemTargetRecord`
 * + outcome final per akun: `status`/`error` (diisi `updateTargetOutcome`,
 * dipanggil sinkron oleh `PublishNowUseCase`/`SchedulePostsUseCase` untuk
 * hasil yang sudah diketahui saat itu juga, dan nantinya oleh handler
 * webhook T-026 untuk hasil async) + `platformPostUrl` (sama field yang
 * dipakai `CalendarItemTargetRecord`, untuk link "ke post asli" di UI
 * detail T-034.3).
 */
export interface HistoryItemTargetRecord extends QueueItemTargetRecord {
  status: PublishingPostTargetStatus;
  platformPostUrl: string | null;
  error: string | null;
}

/**
 * Satu `PublishingPost` untuk History (T-034.1, KSP-D10) — beda dari
 * `CalendarItemRecord` (mencakup semua status), History HANYA mencakup
 * post yang percobaan publish-nya sudah SELESAI: `Published` atau
 * `Failed` — begitu percobaan publish selesai, item pindah dari
 * Queue/Calendar ke History (KSP-03, catatan T-033). `targets` membawa
 * outcome final per akun untuk UI daftar (T-034.2) dan detail (T-034.3).
 *
 * `updatedAt` disertakan (beda dari `CalendarItemRecord`/`QueueItemRecord`)
 * karena dipakai sebagai proksi "waktu selesai" untuk pengurutan — lihat
 * catatan gap `failedAt`/`failureReason` di `IPublishingRepository.listHistory`.
 */
export interface HistoryItemRecord {
  id: PostId;
  caption: string;
  status: ContentStatus;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Media post asli (KI-082) — satu set per post (ADR-107, sama `PublishingPostRecord.mediaIds`), dipakai untuk resolve thumbnail "Hasil per Akun" di History Detail (`HistoryDetail.tsx`). */
  mediaIds: MediaId[];
  targets: HistoryItemTargetRecord[];
}

/**
 * Satu target + data post induk yang dibutuhkan untuk validasi & recreate
 * retry manual (T-034.4, ADR-092). `postOutstandPostId` adalah
 * `PublishingPost.outstandPostId` post-level (dari create ORIGINAL yang
 * mencakup semua target awal, termasuk target yang gagal ini) — dipakai
 * use-case untuk memutuskan apakah `outstandAdapter.deletePost` perlu
 * dipanggil (skip kalau `null`, tidak ada apa pun untuk dihapus di sisi
 * Outstand). `outstandAccountId` dari `WorkspaceConnectedAccount` (bukan
 * `connectedAccountId` Prisma) — dibutuhkan untuk memanggil
 * `outstandAdapter.deletePost`/`publishNow`.
 */
export interface RetryTargetRecord {
  postId: PostId;
  workspaceId: WorkspaceId;
  postOutstandPostId: string | null;
  caption: string;
  /** Media post-level (satu set untuk seluruh post, ADR-107) — dipakai recreate. */
  mediaIds: MediaId[];
  targetId: PostTargetId;
  targetStatus: PublishingPostTargetStatus;
  connectedAccountId: ConnectedAccountId;
  outstandAccountId: string;
  platform: SocialPlatform;
  contentFormat: ContentFormat;
  platformOptions: Record<string, unknown> | null;
  /**
   * True kalau post punya target SAUDARA berstatus published/scheduled/
   * pending — Real `deletePost` dengan accountIds akan wipe SEMUA remote
   * (API tidak scoped). Retry harus SKIP `deletePost` bila true.
   */
  hasSiblingLiveTargets: boolean;
}

/**
 * Satu post hasil import (T-090, ADR-093 poin 3-4) untuk
 * `upsertImportedPosts` — input mentah dari `ImportedPostData` (ACL
 * Outstand) + `platform`/`contentFormat` yang sudah di-resolve caller
 * (`ImportPostsProcessUseCase`) dari `WorkspaceConnectedAccount`, karena
 * repository TIDAK boleh tahu tentang `IOutstandAdapter` (AGENTS.md #6) —
 * konsisten pola `SchedulePostTargetInput` (caller me-resolve
 * `outstandAccountId` dari domain lain, bukan repository).
 */
export interface ImportedPostTargetInput {
  connectedAccountId: ConnectedAccountId;
  platform: SocialPlatform;
  platformPostId: string;
  platformPostUrl: string | null;
  caption: string;
  publishedAt: Date;
  /** Media eksternal — disimpan di `PublishingPostTarget.platformOptions` (lihat catatan `ImportedPostData.mediaUrls`), bukan kolom baru. */
  mediaUrls: string[];
}

/** Hasil `upsertImportedPosts` — ringkas, bukan daftar record lengkap (tidak ada UI yang membutuhkannya sekarang, T-090.5 masih blocked). */
export interface UpsertImportedPostsResult {
  insertedCount: number;
  skippedDuplicateCount: number;
}

/** Repository interface — implementation (Prisma) lives in src/lib/repositories/publishing. */
export interface IPublishingRepository {
  createDraft(input: {
    workspaceId: WorkspaceId;
    authorId: UserId;
    caption: string;
    /** T-024.4 — `undefined` sama dengan tidak melampirkan media sama sekali (kolom DB default `[]`). */
    mediaIds?: MediaId[];
  }): Promise<PublishingPostRecord>;

  /**
   * Drafts (T-092.5/ADR-094 poin 5, koreksi gap T-104) — mencakup 3
   * status: `Draft`, `InReview`, `ReadyToSchedule` (bukan hanya `Draft`).
   * Harus konsisten dengan `DRAFT_VIEW_STATUSES` (client-side filter
   * granular patch Realtime) di
   * `apps/web/src/app/(app)/publish/drafts/components/DraftsList.tsx`
   * (`toDraftListItem`) — keduanya menentukan kriteria tampilan Drafts yang
   * sama, hanya beda titik penerapan (initial SSR load vs. patch Realtime
   * granular per event).
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  listDrafts(
    input: { workspaceId: WorkspaceId },
    userId: UserId,
  ): Promise<PublishingPostRecord[]>;

  /**
   * PERHATIAN: nama method ini menyiratkan hasilnya selalu berstatus
   * `Draft`, TAPI query-nya TIDAK memfilter `status` sama sekali — post
   * dengan status apa pun (`Draft`/`Scheduled`/`Published`/dst.) yang
   * belum di-soft-delete tetap dikembalikan. Ditemukan saat code review
   * `deletePost` (T-035): method ini sengaja dipakai di sana untuk
   * fetch-lalu-cek-status sendiri (butuh post apa pun statusnya untuk
   * bisa membedakan `NotFoundError` vs `ConflictError`) — jangan reuse
   * method ini untuk kebutuhan lain yang mengasumsikan hasilnya sudah
   * pasti `Draft` tanpa memvalidasi `.status` sendiri.
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  findDraftById(
    input: { workspaceId: WorkspaceId; postId: PostId },
    userId: UserId,
  ): Promise<PublishingPostRecord | null>;

  /**
   * Returns null when no matching draft exists in this workspace. `userId`
   * (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  updateDraftCaption(
    input: {
      workspaceId: WorkspaceId;
      postId: PostId;
      caption: string;
      /**
       * T-024.4 — partial update semantics: `undefined` berarti kolom
       * `mediaIds` TIDAK disentuh sama sekali (mempertahankan nilai yang
       * sudah dipersist sebelumnya, mis. dari `saveDraftAction` sebelum
       * `scheduleDraftAction`/`publishNowAction` dipanggil) — beda dari
       * array kosong `[]` yang secara eksplisit mengosongkan lampiran
       * media post ini.
       */
      mediaIds?: MediaId[];
    },
    userId: UserId,
  ): Promise<PublishingPostRecord | null>;

  /**
   * Guard ganda, keduanya wajib dalam satu transaksi atomik sebelum
   * replace `PublishingPostTarget` (delete+insert status `pending`):
   * 1. Status — post harus Draft/ReadyToSchedule (→ Scheduled).
   * 2. Ownership (anti-IDOR) — setiap `connectedAccountId` di `targets`
   *    harus terverifikasi milik `workspaceId` yang sama (implementasi
   *    Prisma: `workspaceConnectedAccount.count` di dalam transaksi).
   *    Guard ini WAJIB di layer repository — berlaku untuk semua caller,
   *    termasuk entry point yang belum ada (mis. Route Handler /api/v1
   *    AL-D08) yang mungkin tidak mereplikasi validasi di
   *    `components/draft-editor/actions.ts`.
   *
   * Returns `null` kalau salah satu guard gagal (post tidak ditemukan
   * dalam status yang valid, ATAU salah satu akun bukan milik workspace
   * ini) — tidak ada insert apa pun yang commit. Caller (`PublishingService`
   * / use-case) memperlakukan kedua kegagalan ini secara sama (error
   * generik `ConflictError`), tanpa perlu membedakan jenis guard yang gagal.
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   * Caller (`SchedulePostsUseCase.execute`) MUST NOT wrap the subsequent
   * `outstandAdapter.schedulePost()` network call in the same transaction
   * this opens — see `updateTargetOutcome` below.
   */
  schedulePost(
    input: {
      workspaceId: WorkspaceId;
      postId: PostId;
      scheduledAt: Date;
      targets: SchedulePostTargetInput[];
    },
    userId: UserId,
  ): Promise<PublishingScheduleRecord | null>;

  /**
   * Update satu `PublishingPostTarget` by id dengan outcome dari
   * OutstandAdapter. Redesain 2026-08-26: `platformPostId`/`platformPostUrl`
   * menggantikan `outstandJobId`/`publishedUrl` lama — keduanya sekarang
   * berasal dari `IOutstandAdapter.fetchPostOutcome` (per akun, dibaca
   * belakangan), BUKAN dari hasil sinkron `schedulePost`/`publishNow` (yang
   * sekarang hanya mengembalikan `outstandPostId` post-level, dipersist
   * lewat `setOutstandPostId` di bawah). `platformPostId` opsional karena
   * target yang gagal (`status: "failed"`) belum tentu punya id platform.
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`;
   * called once per target AFTER the post-level
   * `outstandAdapter.schedulePost()` / `publishNow()` (dan, untuk Publish
   * Now, `fetchPostOutcome()`) network call sudah resolve/reject — never
   * inside the same transaction as the network call (connection pool
   * exhaustion risk).
   */
  updateTargetOutcome(
    input: {
      postTargetId: PostTargetId;
      platformPostId?: string;
      status: "scheduled" | "published" | "failed";
      platformPostUrl?: string;
      error?: string;
    },
    userId: UserId,
  ): Promise<void>;

  /**
   * Persist `outstandPostId` post-level (redesain 2026-08-26) — dipanggil
   * SETELAH `outstandAdapter.schedulePost()`/`publishNow()` resolve dengan
   * SATU id yang mencakup semua target, sebelum (untuk Publish Now)
   * `fetchPostOutcome` dipanggil dan sebelum `updateTargetOutcome` per
   * target. Terpisah dari `updateTargetOutcome` karena field ini post-level,
   * bukan per-target. `userId` (RLS, KI-026 follow-up) — acting user for
   * `withCurrentUser`; sama seperti `updateTargetOutcome`, tidak dipanggil
   * di dalam transaksi yang sama dengan network call.
   */
  setOutstandPostId(
    input: { workspaceId: WorkspaceId; postId: PostId; outstandPostId: string },
    userId: UserId,
  ): Promise<void>;

  /**
   * Publish Now (T-029, ADR-047) — sama pola guard dengan `schedulePost`
   * (status Draft/ReadyToSchedule → Published, ownership anti-IDOR wajib
   * dalam transaksi atomik yang sama), bedanya tidak ada `scheduledAt` dan
   * post langsung ditandai `publishedAt` alih-alih `scheduledAt`. Returns
   * `null` kalau salah satu guard gagal — caller memperlakukan sama seperti
   * `schedulePost` (`ConflictError` generik).
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   * Caller (`PublishNowUseCase.execute`) MUST NOT wrap the subsequent
   * `outstandAdapter.publishNow()` network call in the same transaction
   * this opens — sama alasan seperti `schedulePost`/`updateTargetOutcome`.
   */
  publishNow(
    input: {
      workspaceId: WorkspaceId;
      postId: PostId;
      targets: SchedulePostTargetInput[];
    },
    userId: UserId,
  ): Promise<PublishingScheduleRecord | null>;

  /**
   * Batch count of scheduled `PublishingPostTarget` rows per
   * `connectedAccountId` — dipakai sidebar Channels (T-012.2) untuk badge
   * jumlah post terjadwal per akun. Batch via `groupBy` (bukan per-akun)
   * supaya `listSidebarChannels` tidak N+1 saat menghitung semua akun
   * sekaligus. Hanya menghitung post dengan status `Scheduled` dan
   * `deletedAt: null` (pola soft-delete konsisten dengan `listDrafts`).
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  countScheduledByAccount(
    input: {
      workspaceId: WorkspaceId;
      connectedAccountIds: ConnectedAccountId[];
    },
    userId: UserId,
  ): Promise<Map<ConnectedAccountId, number>>;

  /**
   * Queue (T-032.2, KSP-03, ADR-083) — semua `PublishingPost` berstatus
   * Scheduled milik workspace, diurutkan `scheduledAt` ascending. TIDAK
   * memakai model Prisma `PublishingQueueSlot` (deprecated, ADR-083) —
   * query langsung ke `PublishingPost` + `PublishingPostTarget` +
   * `WorkspaceConnectedAccount`. Grouping per tanggal dilakukan di
   * `PublishingService.listQueue` (`groupQueueItemsByDate`, pure
   * function) — bukan di query ini, supaya repository tetap murni
   * proyeksi data terurut, tidak membawa keputusan tampilan.
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  listQueue(
    input: { workspaceId: WorkspaceId },
    userId: UserId,
  ): Promise<QueueItemRecord[]>;

  /**
   * Calendar (T-033.1, KSP-02) — post apa pun (lihat catatan gap status di
   * `CalendarItemRecord`) di mana `scheduledAt` ATAU `publishedAt` jatuh
   * dalam rentang `[from, to]` (inklusif). Rentang generik — pemanggil
   * (Week 7 hari, Month 1 bulan + hari muted, T-033.2/.3/.4) yang
   * menentukan `from`/`to`, bukan method ini. `statuses` opsional — kalau
   * tidak diisi, SEMUA status ikut (beda dari `listQueue` yang selalu
   * hardcode `Scheduled`). `connectedAccountIds` opsional — filter post
   * yang punya minimal satu target ke salah satu akun itu.
   *
   * Urutan hasil TIDAK dijamin di sini (lihat implementasi Prisma — tidak
   * ada satu kolom tanggal tunggal yang valid untuk semua status buat
   * `orderBy`) — pengurutan final ("effective date" = `scheduledAt` ??
   * `publishedAt`) dilakukan pure function di
   * `PublishingService.listCalendarPosts` (`sortCalendarItemsByEffectiveDate`),
   * sama pola dengan `groupQueueItemsByDate`.
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  listCalendarPosts(
    input: {
      workspaceId: WorkspaceId;
      from: Date;
      to: Date;
      connectedAccountIds?: ConnectedAccountId[];
      statuses?: ContentStatus[];
    },
    userId: UserId,
  ): Promise<CalendarItemRecord[]>;

  /**
   * Granular patch Realtime Calendar (T-092.3, ADR-094 poin 5) — fetch SATU
   * `PublishingPost` termapping (bentuk sama `listCalendarPosts`) untuk
   * `postId` yang datang dari event Supabase Realtime
   * (`subscribeToPublishingPostChanges`). Tidak menerima `from`/`to` — event
   * granular tidak tahu rentang tanggal yang sedang dilihat screen; kriteria
   * "apakah post ini masih cocok tampil di view saat ini" (rentang tanggal,
   * filter status/akun) diterapkan CLIENT-SIDE oleh pemanggil
   * (`CalendarScreen`), bukan di sini — method ini murni proyeksi data 1
   * baris, sama pola dengan `getHistoryById`.
   *
   * Returns `null` kalau post tidak ditemukan di `workspaceId` ini atau
   * sudah di-soft-delete (`deletedAt` terisi) — caller
   * (`PublishingService.getCalendarPostById`) memperlakukan `null` sebagai
   * sinyal "remove dari local state", BUKAN error (event Realtime granular
   * sengaja tidak dibedakan echo/race, ADR-094 poin 5).
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  getCalendarPostById(
    input: { workspaceId: WorkspaceId; postId: PostId },
    userId: UserId,
  ): Promise<CalendarItemRecord | null>;

  /**
   * History (T-034.1, KSP-D10) — post berstatus `Published`/`Failed`
   * (percobaan publish sudah selesai, KSP-03) milik workspace, diurutkan
   * `updatedAt` descending (paling baru berubah status duluan — proksi
   * "waktu selesai" dipertahankan APA ADANYA meski `PublishingPost.failedAt`
   * sekarang diisi T-107 — lihat catatan update di bawah kenapa sorting
   * TIDAK ikut diubah ke `failedAt`/`publishedAt`).
   *
   * `statuses` — caller (`PublishingService.listHistory`) WAJIB sudah
   * mempersempitnya ke subset `HISTORY_TERMINAL_STATUSES` sebelum
   * memanggil method ini (invariant "History = post selesai" ditegakkan
   * di service, bukan di sini) — repository ini murni proyeksi data
   * terfilter, sama pola dengan `listCalendarPosts`/`listQueue`.
   * `connectedAccountIds` opsional, sama pola dengan `listCalendarPosts`.
   *
   * **Update T-107 (koreksi KI-049/KI-063):** `PublishingPost.failedAt`/
   * `.failureReason` SEKARANG diisi oleh `markPostFailed` (sebelumnya
   * tidak pernah ditulis sama sekali) — tapi TETAP SENGAJA tidak
   * dimasukkan ke `HistoryItemRecord` di sini (keputusan review Ridwan
   * Architecture Reviewer dipertahankan, bukan di-superscede diam-diam):
   * `updatedAt` tetap dipakai sebagai proksi "waktu selesai" untuk
   * `orderBy` supaya scope T-107 murni bug-fix data layer, tidak
   * mengubah kontrak `HistoryItemRecord`/sorting History (itu perubahan
   * terpisah yang perlu keputusan produk sendiri kalau memang diinginkan
   * nanti). Pesan error final per akun tetap tersedia lewat
   * `HistoryItemTargetRecord.error` (diisi `updateTargetOutcome`) — TIDAK
   * berubah oleh T-107.
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  listHistory(
    input: {
      workspaceId: WorkspaceId;
      statuses?: ContentStatus[];
      connectedAccountIds?: ConnectedAccountId[];
      // Opsional — filter `publishedAt` di level query (T-045/T-046/T-047,
      // dipakai `PublishingService.getPostPerformance`) supaya caller yang
      // cuma butuh satu `period` tidak perlu fetch seluruh riwayat
      // workspace lalu filter di JS. Caller lain (mis. `/publish/history`)
      // tetap boleh mengabaikannya untuk dapat riwayat penuh.
      publishedAtRange?: { from: Date; to: Date };
    },
    userId: UserId,
  ): Promise<HistoryItemRecord[]>;

  /**
   * Detail satu History item (T-034.1) — mendukung route
   * `/publish/history/[postId]` (UI-nya T-034.3), supaya composition
   * root halaman detail tidak perlu query seluruh riwayat workspace
   * hanya untuk menampilkan satu post. Returns `null` kalau post tidak
   * ditemukan, bukan milik `workspaceId` ini, ATAU statusnya BUKAN
   * `Published`/`Failed` (post yang belum selesai publish bukan
   * "history" — invariant sama dengan `listHistory`, ditegakkan langsung
   * di implementasi Prisma karena tidak ada input `statuses` yang bisa
   * dipersempit di sini). Juga returns `null` (bukan throw) kalau
   * `postId` bukan format UUID valid — implementasi Prisma menangkap
   * `PrismaClientKnownRequestError` (P2007/P2023, "invalid input syntax
   * for type uuid") dan memperlakukannya sama seperti "tidak ketemu",
   * supaya route `[postId]` yang menerima ID mentah dari URL tetap jatuh
   * ke `notFound()`, bukan 500 (bug T-034.2/T-034.3, QA Najwa 2026-09-08).
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  getHistoryById(
    input: { workspaceId: WorkspaceId; postId: PostId },
    userId: UserId,
  ): Promise<HistoryItemRecord | null>;

  /**
   * Granular patch Realtime History (T-092.6, ADR-094 poin 5, 7) — fetch
   * SATU `PublishingPost` termapping ke bentuk `HistoryItemRecord` (targets
   * membawa `status`/`error` per akun, dibutuhkan `HistoryList` untuk
   * `getPrimaryErrorMessage`) untuk `postId` dari event Supabase Realtime.
   *
   * **Beda sengaja dari `getHistoryById`:** method itu menyaring status di
   * level query (`status: { in: HISTORY_TERMINAL_STATUSES }`, cocok untuk
   * route detail `[postId]` yang memang HARUS 404 kalau post belum/tidak
   * pernah masuk History) — method ini TIDAK menyaring status di query,
   * supaya event granular untuk post yang statusnya BARU SAJA berubah
   * (mis. `Scheduled` → `Failed`, atau sebaliknya post pindah lagi ke
   * status lain) tetap mengembalikan record dengan status terkini apa
   * adanya. Kriteria tampilan History (`HISTORY_TERMINAL_STATUSES`) tetap
   * ditegakkan CLIENT-SIDE oleh pemanggil (`HistoryList`, sama pola
   * `DraftsList`/`toDraftListItem`) — bukan di sini, supaya perubahan
   * status yang membuat post TIDAK LAGI cocok tampil di History (jarang
   * terjadi tapi mungkin, mis. hasil test/manual DB fix) bisa dideteksi
   * sebagai "remove dari local state", bukan salah dianggap "tidak
   * ditemukan".
   *
   * Returns `null` kalau post tidak ditemukan di `workspaceId` ini, sudah
   * di-soft-delete, atau `postId` bukan format UUID valid (sama guard
   * `isInvalidIdFormat` dengan `getHistoryById`) — caller
   * (`PublishingService.getHistoryPostById`) memperlakukan ini sebagai
   * sinyal "remove dari local state", BUKAN error (sama semangat
   * `getCalendarPostById`).
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  getHistoryPostById(
    input: { workspaceId: WorkspaceId; postId: PostId },
    userId: UserId,
  ): Promise<HistoryItemRecord | null>;

  /**
   * Cancel Schedule (T-030.1, ADR-049 Tier 2) — kebalikan dari
   * `schedulePost`: post kembali ke status Draft (`scheduledAt` di-null-kan)
   * dan seluruh `PublishingPostTarget` milik post itu dihapus (post Draft
   * tidak punya target persisten, sama seperti Draft yang belum pernah
   * dijadwalkan — lihat `schedulePost`, yang selalu `deleteMany` + recreate
   * target saat (re)schedule).
   *
   * Guard: hanya post berstatus `Scheduled` yang bisa dibatalkan. Returns
   * `null` kalau post tidak ditemukan, bukan milik `workspaceId` ini, atau
   * statusnya bukan `Scheduled` — caller memperlakukan sama seperti
   * `schedulePost`/`publishNow` (`ConflictError` generik).
   *
   * Tidak ada guard ownership akun (anti-IDOR) di sini seperti
   * `schedulePost` — method ini hanya MENGHAPUS target existing, tidak
   * memperkenalkan `connectedAccountId` baru dari input caller.
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   * Caller (`CancelScheduleUseCase.execute`) MUST NOT wrap the subsequent
   * `outstandAdapter.cancelScheduledPost()` network call in the same
   * transaction this opens — sama alasan seperti `schedulePost`/
   * `updateTargetOutcome`.
   */
  cancelSchedule(
    input: { workspaceId: WorkspaceId; postId: PostId },
    userId: UserId,
  ): Promise<PublishingCancelScheduleRecord | null>;

  /**
   * Bug fix (2026-08-26, ditemukan saat T-033 Calendar) — dipanggil oleh
   * `PublishNowUseCase.execute` SETELAH `Promise.all` target selesai, kalau
   * SEMUA target gagal publish. Sebelum fix ini, `publishNow` sudah
   * menandai post `Published` sebelum tahu hasil per target, dan tidak ada
   * langkah yang mengoreksinya kalau semua target ternyata gagal — post
   * tetap tercatat `Published` di DB meski tidak ada satu pun target yang
   * sukses. Semantik ini konsisten dengan `post.error` webhook Outstand
   * (`product-discovery/05-architecture/integration-layer.md:269-270`):
   * "Semua target gagal setelah retry" → status domain `failed`.
   *
   * **Diperluas (redesain ACL 2026-08-26)** — sekarang juga dipanggil oleh
   * `SchedulePostsUseCase.execute` saat SATU call
   * `outstandAdapter.schedulePost` (yang sekarang mencakup semua target)
   * gagal total: karena hanya ada satu call untuk semua target, gagalnya
   * call itu berarti SEMUA target pasti gagal (all-or-nothing, beda dari
   * model lama yang per-target dan bisa partial). Where-clause karena itu
   * menerima status awal `Published` ATAU `Scheduled` — bukan hanya
   * `Published`.
   *
   * Idempoten by design (`updateMany` hanya menyentuh baris yang masih di
   * salah satu status awal itu) — aman dipanggil lebih dari sekali kalau
   * use-case di-retry. Tidak menyentuh `PublishingPostTarget` — outcome per
   * target sudah ditulis oleh `updateTargetOutcome` sebelum method ini
   * dipanggil.
   *
   * **TIDAK throw kalau 0 baris ter-update** (bug fix T-027 — sama seperti
   * `markPostPublished` di bawah): `resolvePostOutcome` (dipakai BERSAMA
   * webhook T-026 dan job polling T-027) bisa sah dipanggil lebih dari
   * sekali untuk `outstandPostId` yang sama, dan panggilan kedua yang
   * menemukan post SUDAH `Failed` harus diam-diam no-op, bukan dianggap
   * kegagalan internal.
   *
   * **`reason` (T-107, koreksi KI-049/KI-063)** — mengisi `failedAt`
   * (`new Date()`) dan `failureReason` (string ini apa adanya), yang
   * sebelumnya TIDAK PERNAH ditulis oleh method ini (hanya `status`).
   * Caller wajib menyediakan ringkasan penyebab kegagalan level-post —
   * pola tiap caller: pesan exception adapter (network/HTTP gagal total),
   * atau gabungan `PostTargetOutcome.error` unik dari seluruh target yang
   * diketahui gagal (dipisah `"; "`), dengan fallback teks generik kalau
   * tidak ada satu pun pesan error spesifik tersedia. Ini TIDAK
   * menggantikan `HistoryItemTargetRecord.error` (tetap sumber kebenaran
   * pesan error FINAL PER AKUN) — field level-post ini murni ringkasan
   * post secara keseluruhan.
   *
   * **KI-081 (code-review PR #140, Resolved)** — implementasi sekarang
   * JUGA men-null-kan `publishedAt`, supaya post `Failed` tidak pernah
   * menyisakan timestamp publish keliru dari `publishNow` yang menandai
   * `publishedAt` di muka sebelum outcome diketahui (lihat
   * `IPublishingRepository.publishNow`).
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  markPostFailed(
    input: { workspaceId: WorkspaceId; postId: PostId; reason: string },
    userId: UserId,
  ): Promise<void>;

  /**
   * T-027 bug fix (gap ditemukan Elon Backend Engineer saat verifikasi
   * end-to-end T-027, dikonfirmasi King Rezi: scoped bug-fix, boleh
   * langsung dieksekusi) — kebalikan `markPostFailed` untuk sisi SUKSES.
   * Dipanggil `OutstandWebhookProcessor.resolvePostOutcome` (dipakai
   * BERSAMA oleh webhook T-026 dan job polling T-027) pada titik yang SAMA
   * PERSIS dengan keputusan "semua target sudah resolved, tidak ada yang
   * `pending` lagi" — kalau TIDAK semua target diketahui gagal (berarti
   * minimal satu sukses/partial success), post naik dari `Scheduled` ke
   * `Published`.
   *
   * **Kenapa method ini baru ditambahkan sekarang:** semantik
   * "post.error hanya kalau SEMUA target gagal; post tetap Published kalau
   * minimal satu target sukses/partial success" SUDAH eksplisit di baseline
   * (`integration-layer.md:269-270,305`) sejak T-026 — tapi implementasinya
   * SELAMA INI hanya menjalankan SISI GAGAL (`markPostFailed`). Tidak ada
   * kode yang menjalankan sisi SUKSES untuk jalur Schedule (`schedulePost`
   * menandai `Scheduled` di muka, BUKAN `Published` — beda dari
   * `publishNow`/`PublishNowUseCase` yang menandai `Published` di muka).
   * Akibatnya post yang outcome target-nya SUDAH benar (published, via
   * webhook ATAU job T-027) tidak pernah terlihat pindah ke History/
   * Calendar sebagai selesai — targetnya benar, level POST-nya tidak
   * pernah diupdate. Baru ketahuan saat QA end-to-end T-027 (query DB
   * langsung membuktikan `PublishingPostTarget.status = "published"` tapi
   * `PublishingPost.status` tetap `"scheduled"` selamanya).
   *
   * **TIDAK dipakai `PublishNowUseCase`** (dan tidak boleh disentuh untuk
   * itu) — use-case itu sudah menandai `Published` DI MUKA lewat
   * `repository.publishNow` SEBELUM outcome diketahui, dan tidak pernah
   * memanggil `resolvePostOutcome` sama sekali; koreksinya kalau semua
   * target gagal tetap lewat `markPostFailed` seperti sebelumnya, tidak
   * berubah.
   *
   * **Sama seperti `markPostFailed`: method ini TIDAK throw kalau 0
   * baris ter-update** (implementasi Prisma harus no-op diam-diam, bukan
   * error) — `resolvePostOutcome` bisa dipanggil lebih dari sekali untuk
   * `outstandPostId` yang sama secara sah (mis. dua webhook event Outstand
   * BERBEDA — bukan duplikat receipt — untuk akun berbeda pada post yang
   * sama, yang keduanya bisa saja masing-masing melihat "semua target
   * sudah resolved" begitu `fetchPostOutcome` sudah mengembalikan status
   * penuh). Panggilan kedua yang menemukan post SUDAH `Published` harus
   * diam-diam no-op, bukan dianggap kegagalan internal.
   *
   * Idempoten (`updateMany` hanya menyentuh baris yang masih `Scheduled`).
   *
   * **T-107 (koreksi KI-049)** — sekarang juga mengisi `publishedAt`
   * (`new Date()`), yang sebelumnya TIDAK PERNAH ditulis oleh method ini
   * (hanya `status`) — beda dari `publishNow` (`IPublishingRepository`
   * di bawah) yang SUDAH mengisi `publishedAt` sejak awal karena menandai
   * `Published` di muka, sebelum outcome diketahui.
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  markPostPublished(
    input: { workspaceId: WorkspaceId; postId: PostId },
    userId: UserId,
  ): Promise<void>;

  /**
   * Retry manual (T-034.4, ADR-092) — ambil satu `PublishingPostTarget` +
   * data post induk yang dibutuhkan `RetryFailedTargetUseCase` untuk
   * validasi (post ditemukan, target milik post & workspace ini) dan
   * recreate (`caption`, `outstandAccountId`, `contentFormat`,
   * `platformOptions`, `postOutstandPostId` untuk delete best-effort).
   * Returns `null` kalau post tidak ditemukan di `workspaceId` ini, ATAU
   * target tidak ditemukan/bukan milik `postId` ini — use-case
   * memperlakukan `null` sebagai `NotFoundError` generik, tidak
   * membedakan penyebab (pola sama seperti guard gabungan
   * `schedulePost`/`publishNow`). Validasi `targetStatus === "failed"`
   * SENGAJA tidak ditegakkan di sini (repository murni proyeksi data) —
   * itu domain rule yang ditegakkan use-case, supaya pesan error yang
   * dilempar bisa spesifik ("retry hanya untuk target gagal") alih-alih
   * disamakan dengan not-found generik.
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  getRetryTarget(
    input: { workspaceId: WorkspaceId; postId: PostId; targetId: PostTargetId },
    userId: UserId,
  ): Promise<RetryTargetRecord | null>;

  /**
   * Retry manual (T-034.4) — reset SATU target sebelum recreate: status
   * kembali ke `pending`, outcome percobaan gagal sebelumnya
   * (`platformPostId`/`platformPostUrl`/`error`) dibersihkan supaya tidak
   * ada jejak kegagalan lama nyangkut kalau retry ini sukses. Murni state
   * DB lokal (tidak ada network call) — dipanggil SEBELUM
   * `outstandAdapter.deletePost`/`publishNow` di use-case, konsisten pola
   * "persist dulu, network call sesudah" yang sudah dipakai
   * `schedulePost`/`publishNow`/`cancelSchedule`.
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  resetTargetForRetry(
    input: { targetId: PostTargetId },
    userId: UserId,
  ): Promise<void>;

  /**
   * Retry manual (T-034.4) — persist `PublishingPostTarget.retryOutstandPostId`
   * (kolom baru, migration `20260909024403_t034_4_retry_outstand_post_id`)
   * SETELAH `outstandAdapter.publishNow` resolve dengan SATU id post-level
   * BARU khusus target ini — BEDA dari `PublishingPost.outstandPostId`
   * (tetap merepresentasikan create original untuk semua target awal,
   * tidak disentuh retry single-target). Dipakai sebagai argumen
   * `fetchPostOutcome` berikutnya untuk target yang di-retry ini.
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  setRetryOutstandPostId(
    input: { targetId: PostTargetId; retryOutstandPostId: string },
    userId: UserId,
  ): Promise<void>;

  /**
   * Retry manual (T-034.4) — recompute status `PublishingPost` level-post
   * SETELAH outcome retry satu target diketahui: kalau TIDAK ADA lagi
   * target berstatus `failed` di post ini, post naik dari `Failed` ke
   * `Published` (invariant `HISTORY_TERMINAL_STATUSES`, konsisten semantik
   * `markPostFailed`/`PublishNowUseCase` — "post = published kalau minimal
   * 1 target sukses"). Kalau retry masih gagal lagi (minimal satu target
   * `failed` tersisa), post TETAP `Failed` — tidak diubah. Idempoten
   * (`updateMany` hanya menyentuh baris yang masih `Failed`), aman
   * dipanggil berkali-kali.
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  reconcilePostStatusAfterRetry(
    input: { workspaceId: WorkspaceId; postId: PostId },
    userId: UserId,
  ): Promise<void>;

  /**
   * Webhook Outstand (T-026.3/.4) — lookup post + seluruh target-nya by
   * `outstandPostId` post-level (dari payload webhook `post.published`/
   * `post.error`). Returns `null` kalau tidak ada `PublishingPost` dengan
   * `outstandPostId` itu (mis. event untuk post yang sudah di-soft-delete,
   * atau id yang tidak dikenal).
   *
   * **TIDAK menerima `userId`** — beda dari method lain di interface ini.
   * Webhook route (`/api/webhooks/outstand`) tidak punya Better Auth
   * session, jadi tidak ada acting user yang bisa di-set untuk
   * `withCurrentUser` SEBELUM lookup ini selesai (chicken-and-egg: baru
   * lewat method ini kita tahu `authorId`-nya). Implementasi Prisma
   * (`src/lib/repositories/publishing/publishing.repository.ts`) memakai
   * SECURITY DEFINER SQL function (migration
   * `20260907120000_t026_outstand_webhook_system_lookups`) untuk membaca
   * lintas-RLS secara sempit, hanya untuk lookup exact-match by external id
   * ini — BUKAN bypass umum. `WebhookProcessor` (pemanggil) memakai
   * `authorId` hasil method ini sebagai `actingUserId` untuk
   * `updateTargetOutcome`/`markPostFailed` setelahnya (kedua method itu
   * tetap RLS-safe seperti biasa, tidak ikut bypass).
   */
  findPostTargetsByOutstandPostId(
    outstandPostId: string,
  ): Promise<WebhookPostLookupRecord | null>;

  /**
   * Delete Post (T-035.1, ADR-049 Tier 2, DB-D03) — soft delete: hanya
   * men-set `deletedAt`, TIDAK PERNAH memanggil API Outstand apa pun untuk
   * menghapus post dari platform sosial. Berbeda dari `cancelSchedule`,
   * method ini TIDAK punya use-case class terpisah karena tidak ada
   * dependency adapter eksternal sama sekali untuk T-035.1 — tidak ada
   * urutan "persist dulu → panggil adapter" yang perlu dijaga.
   *
   * **Guard status (koreksi 2026-09-10, sesi lanjutan T-035.2/.3):** entry
   * point Delete Post HANYA ada di Drafts — TIDAK di Queue, TIDAK di
   * History (koreksi atas asumsi awal T-035.1 yang mengira ketiganya
   * berlaku, dikonfirmasi King Rezi via `AskUserQuestion`). Post
   * `Scheduled` tidak bisa dihapus langsung — harus di-Cancel Schedule dulu
   * (T-030, kembali ke `Draft`) baru bisa dihapus dari Drafts. Karena itu
   * query di bawah memfilter `status: ContentStatus.Draft` — `updateMany`
   * hanya menyentuh baris yang statusnya masih Draft, sama pola dengan
   * `updateDraftCaption`. Ini adalah lapis kedua guard (defense-in-depth) —
   * `PublishingService.deletePost` sudah melakukan pengecekan status yang
   * sama lebih dulu (fetch via `findDraftById`) supaya pesan error
   * informatif; filter di sini murni safety net race condition (mis. status
   * berubah tepat di antara fetch dan delete).
   *
   * Returns `null` kalau post tidak ditemukan di `workspaceId` ini, sudah
   * soft-deleted sebelumnya (`deletedAt` sudah terisi), ATAU statusnya
   * bukan `Draft` — caller (`PublishingService.deletePost`) sudah
   * membedakan kasus ini lebih awal lewat fetch eksplisit, jadi null di
   * sini praktis hanya kena di jalur race condition.
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  softDeletePost(
    input: { workspaceId: WorkspaceId; postId: PostId },
    userId: UserId,
  ): Promise<PublishingPostRecord | null>;

  /**
   * Engagement Sync (JOB-03, T-051, redesain KI-068/ADR-113) — daftar post
   * yang sudah punya `outstandPostId` (pernah publish/dijadwalkan lewat
   * Outstand) untuk SATU `connectedAccountId`, dipakai
   * `SyncCommentsUseCase` untuk tahu `outstandPostId`+`platform` mana saja
   * yang perlu di-`IOutstandAdapter.fetchComments` — API resmi Outstand
   * men-scope replies PER POST, bukan per akun (root cause KI-068, lihat
   * `ctx-architecture.md`/`PROJECT_STATE.md`), jadi sumber daftar post yang
   * di-sync adalah DB kita sendiri (`PublishingPost`/`PublishingPostTarget`),
   * BUKAN endpoint list-posts Outstand (keputusan eksplisit King Rezi).
   *
   * Post yang belum pernah publish (`outstandPostId` masih `null`) TIDAK
   * ikut — tidak ada apa pun di Outstand untuk di-fetch. Soft-deleted post
   * (`deletedAt` terisi) juga tidak ikut, pola sama `listDrafts`/`listQueue`.
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  listSyncablePostsByConnectedAccount(
    input: {
      workspaceId: WorkspaceId;
      connectedAccountId: ConnectedAccountId;
    },
    userId: UserId,
  ): Promise<SyncablePostRecord[]>;

  /**
   * Reply Engagement (T-054, redesain KI-068/ADR-113) — resolve
   * `outstandPostId` post-level untuk SATU `postId` internal, dipakai
   * `EngagementService.reply` untuk membentuk
   * `IOutstandAdapter.replyToComment` (endpoint resmi Outstand WAJIB tahu
   * `postId`, bukan cuma `outstandCommentId` — root cause KI-068). Returns
   * `null` kalau post tidak ditemukan di `workspaceId` ini, sudah
   * di-soft-delete, ATAU belum pernah publish (`outstandPostId` masih
   * `null`) — caller memperlakukan ketiganya sama (tidak bisa reply).
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  findPostOutstandId(
    input: {
      workspaceId: WorkspaceId;
      postId: PostId;
      /** Kalau diisi, utamakan `retryOutstandPostId` target akun ini. */
      connectedAccountId?: ConnectedAccountId;
    },
    userId: UserId,
  ): Promise<string | null>;

  /**
   * Preview post asli (T-056, KI-065) — snapshot caption/media/
   * `platformPostUrl` untuk kotak "Post asal" di detail panel Comments
   * Inbox (`engagement.EngagementService.getInboxItemDetail`). Query lewat
   * `publishingPostTarget` (bukan `publishingPost`) karena `platformPostUrl`
   * per-target (satu post bisa publish ke lebih dari satu akun, tiap akun
   * punya URL post sendiri) — pola sama `findPostOutstandId`/
   * `listSyncablePostsByConnectedAccount`. `connectedAccountId` WAJIB di
   * sini (beda dari `findPostOutstandId` yang opsional) karena inbox item
   * SELALU terikat ke satu `connectedAccountId` tertentu (tidak ada jalur
   * "post-level saja" yang relevan untuk preview ini).
   *
   * Returns `null` kalau post/target tidak ditemukan, bukan milik
   * `workspaceId` ini, atau sudah di-soft-delete — caller (`engagement`)
   * memperlakukan ini sebagai "tidak ada snapshot untuk ditampilkan" (fallback
   * ke label generik lama), BUKAN error.
   *
   * `userId` (RLS, KI-026 follow-up) — acting user for `withCurrentUser`.
   */
  findPostSnapshotForEngagement(
    input: {
      workspaceId: WorkspaceId;
      postId: PostId;
      connectedAccountId: ConnectedAccountId;
    },
    userId: UserId,
  ): Promise<PostSnapshotForEngagementRecord | null>;

  /**
   * Import Posts dari Social Account (T-090.4, ADR-093 poin 3-4, 7) —
   * dipanggil `ImportPostsProcessUseCase` SETELAH
   * `IOutstandAdapter.fetchImportJobStatus` resolve `status: "completed"`.
   * Satu `PublishingPost` BARU (status `Imported`, `authorId: null`) +
   * SATU `PublishingPostTarget` dibuat per post dalam `input.posts` — beda
   * dari `schedulePost`/`publishNow` (satu post bisa banyak target),
   * import SELALU per akun tunggal (satu `importPosts` call = satu
   * `outstandAccountId`).
   *
   * Dedup (ADR-093 poin 4): sebelum insert, cek existing
   * `PublishingPostTarget` dengan `connectedAccountId` + `platformPostId`
   * yang sama (reuse kolom `platformPostId` dari ADR-092, BUKAN kolom
   * baru) — kalau sudah ada, skip (bukan duplikat, bukan error). Idempoten:
   * memanggil ulang dengan batch yang sama (mis. retry setelah network
   * error parsial) aman, tidak pernah menggandakan baris.
   *
   * **Acting user untuk RLS (bukan `authorId` post — itu tetap `null`):**
   * `actingUserId` HANYA dipakai untuk `withCurrentUser` (RLS di-scope ke
   * MEMBERSHIP WORKSPACE, bukan `authorId` — lihat kebijakan
   * `publishing_posts_workspace_isolation`, migration T-017), jadi boleh
   * berupa user mana pun yang aktif di `workspaceId` ini. Caller (auto:
   * user yang connect akun; manual: user yang klik Sync Now; periodik:
   * BELUM ada acting user alami karena dipicu cron tanpa sesi — lihat
   * catatan gap di `ImportPostsTriggerUseCase.triggerPeriodicForAccounts`)
   * yang menentukan nilainya.
   */
  upsertImportedPosts(
    input: {
      workspaceId: WorkspaceId;
      posts: ImportedPostTargetInput[];
    },
    actingUserId: UserId,
  ): Promise<UpsertImportedPostsResult>;
}

/**
 * Hasil `findPostSnapshotForEngagement` (T-056, KI-065) — proyeksi minimal
 * untuk kotak "Post asal" Comments Inbox. `mediaIds` dibawa mentah (bukan
 * `MediaItemRecord[]` ter-resolve) — resolusi URL media (domain `media`,
 * BC-08) bukan tanggung jawab domain `publishing`, dilakukan composition
 * root (`engage/actions.ts`) lewat `MediaService.listByIds`, pola sama
 * `getDraftAction` (draft-editor).
 */
export interface PostSnapshotForEngagementRecord {
  postId: PostId;
  caption: string;
  mediaIds: MediaId[];
  platformPostUrl: string | null;
}

/**
 * Satu post yang punya `outstandPostId` untuk SATU `connectedAccountId`
 * (Engagement Sync, JOB-03, T-051, redesain KI-068/ADR-113) — hasil
 * `listSyncablePostsByConnectedAccount`. `platform` diambil dari
 * `PublishingPostTarget.platform` (per-target, bukan per-post) karena satu
 * post bisa punya target di platform berbeda-beda; baris ini SATU target
 * spesifik untuk `connectedAccountId` yang diminta.
 */
export interface SyncablePostRecord {
  postId: PostId;
  outstandPostId: string;
  platform: SocialPlatform;
}
