import type {
  IOutstandAdapter,
  InboxItemId,
  MediaId,
  PostId,
  ConnectedAccountId,
  SocialPlatform,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/utils/errors";
import type { IEngagementRepository } from "../repositories/engagement.repository";
import {
  INBOX_ITEM_STATUSES,
  canTransitionInboxStatus,
  inboxCountWindowStart,
} from "../inbox-status";
import {
  INBOX_DATE_RANGES,
  INBOX_POST_SORTS,
  buildInboxPostGroups,
  inboxDateRangeStart,
} from "../inbox-post-groups";
import type {
  EngagementInboxItemRecord,
  EngagementReplyRecord,
  InboxDateRange,
  InboxItemFilter,
  InboxItemStatus,
  InboxPostGroupSummary,
  InboxPostSort,
  InboxPublishedPostRef,
} from "../types";

/**
 * Port lokal cross-domain `engagement` → `publishing` (redesain
 * KI-068/ADR-113, sama alasan `PublishingPostsPort` di
 * `sync-comments.use-case.ts`) — `EngagementService.reply` butuh
 * `outstandPostId` (bukan hanya `outstandCommentId`) untuk memenuhi
 * kontrak `IOutstandAdapter.replyToComment` yang baru, karena endpoint
 * resmi Outstand WAJIB tahu `postId`. `engagement` TIDAK mengimpor
 * `PublishingRepository` konkret; composition root (`engage/actions.ts`)
 * menyuplai instance lewat constructor (structural typing, pola sama
 * `SyncCommentsUseCase`).
 */
interface PublishingPostReferencePort {
  findPostOutstandId(
    input: {
      workspaceId: WorkspaceId;
      postId: PostId;
      connectedAccountId?: ConnectedAccountId;
    },
    userId: UserId,
  ): Promise<string | null>;

  /**
   * T-056, KI-065 — snapshot caption/media/`platformPostUrl` post asli untuk
   * kotak "Post asal" di detail panel Comments Inbox. Digabung ke port yang
   * sama dengan `findPostOutstandId` (bukan port terpisah) karena keduanya
   * SELALU disuplai oleh instance `publishingRepository` yang sama di
   * composition root — port terpisah hanya menambah satu constructor
   * parameter berulang tanpa manfaat decoupling nyata (lihat review PR #143).
   */
  findPostSnapshotForEngagement(
    input: {
      workspaceId: WorkspaceId;
      postId: PostId;
      connectedAccountId: ConnectedAccountId;
    },
    userId: UserId,
  ): Promise<{
    caption: string;
    mediaIds: MediaId[];
    platformPostUrl: string | null;
  } | null>;

  /**
   * T-218.4 — posting terbit (sudah punya `outstandPostId`) satu akun, terbaru
   * dulu, dibatasi sisi repository. Sumber yang sama dengan JOB-03 (hanya
   * posting ini yang komentarnya ditarik), dipakai untuk menampilkan posting
   * tanpa komentar.
   */
  listSyncablePostsByConnectedAccount(
    input: { workspaceId: WorkspaceId; connectedAccountId: ConnectedAccountId },
    userId: UserId,
  ): Promise<
    { postId: PostId; outstandPostId: string; platform: SocialPlatform }[]
  >;
}

/**
 * Port lokal cross-domain `engagement` → `workspace` (KI-071) —
 * `EngagementService.reply` butuh `accountUsername` (= handle akun
 * terhubung) untuk disambiguasi `POST /v1/posts/{id}/replies` saat satu
 * post publish ke >1 akun di network yang sama. Hanya lookup per id
 * (bukan list seluruh akun). `engagement` TIDAK mengimpor
 * `WorkspaceService`/Prisma; composition root menyuplai repository/
 * service yang sudah punya `findConnectedAccountById` lewat structural
 * typing (pola sama `ConnectedAccountsPort` di `refresh-inbox.use-case.ts`).
 */
interface ConnectedAccountHandlePort {
  /** T-218.4 — daftar akun workspace untuk menelusuri posting tanpa komentar. */
  listConnectedAccounts(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<{ id: ConnectedAccountId; platform: SocialPlatform }[]>;

  findConnectedAccountById(
    workspaceId: WorkspaceId,
    connectedAccountId: ConnectedAccountId,
    userId: UserId,
  ): Promise<{ handle: string } | null>;
}

/**
 * Snapshot post asli (T-056, KI-065) — `null` kalau `item.postId` kosong
 * (komentar belum terhubung ke post manapun, data lama) ATAU post/target
 * terkait tidak ditemukan lagi di `publishing` (mis. sudah di-soft-delete).
 * `mediaIds` dibawa mentah — resolusi URL thumbnail (domain `media`) bukan
 * tanggung jawab `engagement`, dilakukan composition root.
 */
export interface InboxItemPostSnapshot {
  caption: string;
  mediaIds: MediaId[];
  platformPostUrl: string | null;
}

/**
 * Detail satu inbox item + balasannya (T-050) — dipakai composition root
 * route detail Comments Inbox (T-053, belum dibangun di task ini).
 *
 * **`postSnapshot` (T-056, KI-065)** — ditambahkan untuk mengisi kotak
 * "Post asal" yang sebelumnya hanya label generik (gap sejak T-053).
 */
export interface InboxItemDetail extends EngagementInboxItemRecord {
  replies: EngagementReplyRecord[];
  postSnapshot: InboxItemPostSnapshot | null;
}

/** Kelompok posting siap-render (T-218): ringkasan komentar + snapshot posting. */
export interface InboxPostGroup extends InboxPostGroupSummary {
  /** `null` untuk kelompok "Tanpa posting" atau posting yang sudah tidak ada. */
  postSnapshot: InboxItemPostSnapshot | null;
}

export interface ListInboxByPostInput {
  workspaceId: WorkspaceId;
  connectedAccountId?: ConnectedAccountId;
  platform?: SocialPlatform;
  /** Hanya kelompok yang punya minimal satu komentar berstatus ini; hitungan tetap atas semua komentar. */
  status?: InboxItemStatus;
  /** Bawaan `unreplied_first`. */
  sort?: InboxPostSort;
  /** Atas `receivedAt`; bawaan `12m` (S-006). */
  dateRange?: InboxDateRange;
  /** `true` menampilkan juga posting terbit tanpa komentar (T-218.4). */
  includeEmpty?: boolean;
}

/** Jumlah kelompok maksimum per panggilan dan konkurensi pengambilan snapshot. */
const POST_GROUP_LIMIT = 100;
const SNAPSHOT_CONCURRENCY = 10;

/**
 * Application Service untuk domain `engagement` (T-050). Scope awalnya
 * dibatasi ke 3 use-case baca/tulis dasar — sync (T-051) dan manual refresh
 * (T-052) punya use-case/handler sendiri di luar class ini. Reply (T-054)
 * SEKARANG ditambahkan di sini sebagai method `reply` — bukan use-case
 * terpisah seperti sync — karena scope-nya kecil (satu panggilan adapter +
 * satu persist) dan sepenuhnya milik lifecycle `EngagementInboxItem`/
 * `EngagementReply`, konsisten dengan `getInboxItemDetail`/`changeStatus` yang
 * sudah ada di sini.
 */
export class EngagementService {
  constructor(
    private readonly repository: IEngagementRepository,
    private readonly adapter: IOutstandAdapter,
    private readonly publishingPosts: PublishingPostReferencePort,
    private readonly connectedAccounts: ConnectedAccountHandlePort,
  ) {}

  /**
   * Inbox (T-053 nanti mengonsumsi lewat method ini) — daftar inbox item
   * milik workspace, difilter opsional per akun/platform/status. Murni
   * delegasi ke repository — tidak ada agregasi tambahan di T-050.
   */
  async listInbox(
    filter: InboxItemFilter,
    userId: UserId,
  ): Promise<EngagementInboxItemRecord[]> {
    return this.repository.listInboxItems(filter, userId);
  }

  /**
   * Daftar posting beserta ringkasan komentarnya (T-218, ADR-157, S-006) —
   * dasar tampilan "By post". Dikelompokkan per `postId` (komentar tanpa
   * `postId` menjadi satu kelompok `postId: null`), dengan hitungan total,
   * belum dibalas (`unread`), ditangani (sisanya), dan waktu komentar
   * terbaru. Posting tanpa komentar disembunyikan kecuali `includeEmpty`.
   * Snapshot posting diambil lewat port `publishing` (T-056); `mediaIds`
   * dibawa mentah, signed URL thumbnail diregenerasi composition root
   * (`MediaService.resolveThumbnails`), seperti `getInboxItemDetail`.
   */
  async listInboxByPost(
    input: ListInboxByPostInput,
    userId: UserId,
    now: Date = new Date(),
  ): Promise<InboxPostGroup[]> {
    const sort = input.sort ?? "unreplied_first";
    const dateRange = input.dateRange ?? "12m";
    if (!INBOX_POST_SORTS.includes(sort)) {
      throw new ValidationError("Urutan daftar posting tidak dikenal.");
    }
    if (!INBOX_DATE_RANGES.includes(dateRange)) {
      throw new ValidationError("Rentang tanggal tidak dikenal.");
    }
    if (input.status && !INBOX_ITEM_STATUSES.includes(input.status)) {
      throw new ValidationError("Status komentar tidak dikenal.");
    }

    const since = inboxDateRangeStart(dateRange, now);
    const { workspaceId, connectedAccountId, platform } = input;
    const scope = {
      workspaceId,
      ...(connectedAccountId ? { connectedAccountId } : {}),
      ...(platform ? { platform } : {}),
    };

    const [rows, emptyPosts] = await Promise.all([
      this.repository.aggregateInboxByPost(
        { ...scope, receivedSince: since },
        userId,
      ),
      input.includeEmpty && !input.status
        ? this.listPublishedPostRefs(scope, userId)
        : Promise.resolve([]),
    ]);

    const groups = buildInboxPostGroups(rows, {
      sort,
      status: input.status,
      emptyPosts,
    }).slice(0, POST_GROUP_LIMIT);

    const result: InboxPostGroup[] = [];
    for (let i = 0; i < groups.length; i += SNAPSHOT_CONCURRENCY) {
      const chunk = groups.slice(i, i + SNAPSHOT_CONCURRENCY);
      const snapshots = await Promise.all(
        chunk.map((group) =>
          group.postId
            ? this.publishingPosts.findPostSnapshotForEngagement(
                {
                  workspaceId,
                  postId: group.postId,
                  connectedAccountId: group.connectedAccountId,
                },
                userId,
              )
            : Promise.resolve(null),
        ),
      );
      chunk.forEach((group, index) =>
        result.push({ ...group, postSnapshot: snapshots[index] }),
      );
    }
    return result;
  }

  /**
   * Posting terbit per akun (sumber sama JOB-03: maksimum 50 terbaru per
   * akun) untuk `includeEmpty`. Filter akun/platform diterapkan di sini.
   */
  private async listPublishedPostRefs(
    scope: {
      workspaceId: WorkspaceId;
      connectedAccountId?: ConnectedAccountId;
      platform?: SocialPlatform;
    },
    userId: UserId,
  ): Promise<InboxPublishedPostRef[]> {
    const accounts = (
      await this.connectedAccounts.listConnectedAccounts(
        scope.workspaceId,
        userId,
      )
    ).filter(
      (account) =>
        (!scope.connectedAccountId ||
          account.id === scope.connectedAccountId) &&
        (!scope.platform || account.platform === scope.platform),
    );
    const perAccount = await Promise.all(
      accounts.map(async (account) =>
        (
          await this.publishingPosts.listSyncablePostsByConnectedAccount(
            {
              workspaceId: scope.workspaceId,
              connectedAccountId: account.id,
            },
            userId,
          )
        ).map((post) => ({
          postId: post.postId,
          connectedAccountId: account.id,
          platform: post.platform,
        })),
      ),
    );
    return perAccount.flat();
  }

  /**
   * Detail satu inbox item + seluruh balasannya. `NotFoundError` kalau
   * item tidak ditemukan atau bukan milik `workspaceId` ini — pola sama
   * `PublishingService.getDraftById`/`getHistoryById`.
   */
  async getInboxItemDetail(
    input: { workspaceId: WorkspaceId; inboxItemId: InboxItemId },
    userId: UserId,
  ): Promise<InboxItemDetail> {
    const item = await this.repository.findInboxItemById(input, userId);
    if (!item) {
      throw new NotFoundError("Komentar tidak ditemukan.");
    }

    const [replies, postSnapshot] = await Promise.all([
      this.repository.listRepliesByInboxItemId(item.id, userId),
      item.postId
        ? this.publishingPosts.findPostSnapshotForEngagement(
            {
              workspaceId: input.workspaceId,
              postId: item.postId,
              connectedAccountId: item.connectedAccountId,
            },
            userId,
          )
        : Promise.resolve(null),
    ]);

    return { ...item, replies, postSnapshot };
  }

  /**
   * Ubah status satu komentar (T-217; menggantikan `markAsDone`). Murni
   * perubahan status lokal, tidak memanggil Outstand. Transisi mengikuti
   * `canTransitionInboxStatus`; status yang sama idempoten (item
   * dikembalikan apa adanya). `NotFoundError` kalau item tidak ditemukan,
   * `ConflictError` kalau transisi tidak diizinkan.
   */
  async changeStatus(
    input: {
      workspaceId: WorkspaceId;
      inboxItemId: InboxItemId;
      status: InboxItemStatus;
    },
    userId: UserId,
  ): Promise<EngagementInboxItemRecord> {
    if (!INBOX_ITEM_STATUSES.includes(input.status)) {
      throw new ValidationError("Status komentar tidak dikenal.");
    }
    const current = await this.repository.findInboxItemById(
      { workspaceId: input.workspaceId, inboxItemId: input.inboxItemId },
      userId,
    );
    if (!current) {
      throw new NotFoundError("Komentar tidak ditemukan.");
    }
    if (current.status === input.status) {
      return current;
    }
    if (!canTransitionInboxStatus(current.status, input.status)) {
      throw new ConflictError(
        `Status komentar tidak bisa diubah dari "${current.status}" ke "${input.status}".`,
      );
    }

    const updated = await this.repository.markInboxItemStatus(
      { ...input, onlyFromStatus: current.status },
      userId,
    );
    if (!updated) {
      throw new NotFoundError("Komentar tidak ditemukan.");
    }
    // Balapan: `onlyFromStatus` tidak cocok (status berubah di antara baca dan
    // tulis) sehingga repository mengembalikan baris tanpa perubahan.
    if (updated.status !== input.status) {
      throw new ConflictError(
        "Status komentar baru saja berubah; muat ulang lalu coba lagi.",
      );
    }
    return updated;
  }

  /**
   * Jumlah komentar `unread` dalam 12 bulan terakhir (T-217.7) untuk badge
   * sidebar dan Engagement Snapshot di Home. `now` bisa disuplai agar
   * deterministik di tes.
   */
  async countUnread(
    workspaceId: WorkspaceId,
    userId: UserId,
    now: Date = new Date(),
  ): Promise<number> {
    return this.repository.countUnreadInboxItems(
      { workspaceId, since: inboxCountWindowStart(now) },
      userId,
    );
  }

  /**
   * Balas komentar dari dalam aplikasi (T-054, `integration-layer.md`
   * § "Reply via Outstand API", ADR-019/ADR-040, redesain KI-068/ADR-113).
   * RBAC: seluruh role (Account Owner/Admin/Creator) boleh membalas —
   * `roles-permissions.md` tidak membedakan akses "Kelola Engagement
   * Comments Inbox" per role, jadi tidak ada role gating tambahan di sini
   * selain member aktif workspace (sudah ditegakkan composition root lewat
   * `getWorkspaceContext`/session, pola sama Server Action lain).
   *
   * Urutan: validasi `content` (pola sama `IdentityService.updateProfile` —
   * trim lalu tolak string kosong/whitespace-only) → `findInboxItemById`
   * (guard `NotFoundError` kalau tidak ketemu/bukan milik `workspaceId` ini,
   * pola sama `getInboxItemDetail`/`changeStatus`) → resolve `outstandPostId`
   * lewat `item.postId` (uuid internal `PublishingPost`, `ConflictError`
   * kalau `null` — data lama sebelum redesain KI-068/T-051 yang belum
   * pernah mengisi kolom ini, ATAU post terkait belum pernah publish di
   * Outstand) → resolve `accountUsername` dari handle
   * `WorkspaceConnectedAccount` milik `item.connectedAccountId` (KI-071,
   * `ConflictError` terpisah kalau akun tidak ketemu vs handle kosong) →
   * `IOutstandAdapter.replyToComment({ outstandPostId, content,
   * accountUsername, parentOutstandCommentId: item.externalId })`
   * (Anti-Corruption Layer — domain ini tidak pernah tahu bentuk
   * request/response HTTP Outstand) → `createReply` dengan
   * `outstandReplyId` hasil adapter ikut dipersist (kolom
   * `EngagementReply.outstandReplyId`, ADR-040).
   *
   * **`parentOutstandCommentId: item.externalId`** — `item.externalId`
   * adalah `outstandCommentId` (komentar eksternal Outstand yang SEDANG
   * dibalas, field ini disebut `externalId` di `EngagementInboxItemRecord`
   * karena mengikuti nama kolom Prisma persis, bukan diganti nama supaya
   * konsisten leksikal dengan kontrak Outstand) — balasan di-thread di
   * BAWAH komentar itu (bukan langsung ke post), konsisten dengan UX
   * "membalas komentar tertentu" di Comments Inbox (T-053).
   */
  async reply(
    input: {
      workspaceId: WorkspaceId;
      inboxItemId: InboxItemId;
      content: string;
    },
    userId: UserId,
  ): Promise<EngagementReplyRecord> {
    const content = input.content.trim();
    if (!content) {
      throw new ValidationError("Balasan tidak boleh kosong.");
    }

    const item = await this.repository.findInboxItemById(
      { workspaceId: input.workspaceId, inboxItemId: input.inboxItemId },
      userId,
    );
    if (!item) {
      throw new NotFoundError("Komentar tidak ditemukan.");
    }

    if (!item.postId) {
      throw new ConflictError(
        "Komentar ini belum terhubung ke post manapun sehingga tidak bisa dibalas (data lama sebelum redesain sinkronisasi komentar).",
      );
    }

    const outstandPostId = await this.publishingPosts.findPostOutstandId(
      {
        workspaceId: input.workspaceId,
        postId: item.postId,
        connectedAccountId: item.connectedAccountId,
      },
      userId,
    );
    if (!outstandPostId) {
      throw new ConflictError(
        "Post terkait komentar ini tidak ditemukan atau belum pernah dipublikasikan di Outstand.",
      );
    }

    const connectedAccount =
      await this.connectedAccounts.findConnectedAccountById(
        input.workspaceId,
        item.connectedAccountId,
        userId,
      );
    if (!connectedAccount) {
      throw new ConflictError(
        "Komentar tidak bisa dibalas karena akun terhubung tidak ditemukan.",
      );
    }
    const accountUsername = connectedAccount.handle.trim();
    if (!accountUsername) {
      throw new ConflictError(
        "Komentar tidak bisa dibalas karena akun terhubung tidak punya username.",
      );
    }

    const { outstandReplyId } = await this.adapter.replyToComment({
      outstandPostId,
      content,
      accountUsername,
      parentOutstandCommentId: item.externalId,
    });

    const reply = await this.repository.createReply(
      {
        inboxItemId: item.id,
        userId,
        content,
        outstandReplyId,
      },
      userId,
    );

    // T-217.3: balasan terkirim menandai `replied` hanya dari `unread`;
    // `onlyFromStatus` menjaga agar `resolved`/`dismissed` tidak turun bila
    // status berubah di antara baca dan tulis. Kegagalan di sini tidak boleh
    // membuat balasan yang sudah terkirim tampak gagal (pengguna akan
    // mengirim ulang), jadi hanya dicatat ke log.
    if (item.status === "unread") {
      try {
        await this.repository.markInboxItemStatus(
          {
            workspaceId: input.workspaceId,
            inboxItemId: item.id,
            status: "replied",
            onlyFromStatus: "unread",
          },
          userId,
        );
      } catch (error) {
        console.error(
          `[EngagementService] reply terkirim tetapi penandaan "replied" gagal untuk inboxItemId=${item.id} (workspace ${input.workspaceId}):`,
          error,
        );
      }
    }

    return reply;
  }
}
