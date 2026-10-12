import type {
  IOutstandAdapter,
  InboxItemId,
  MediaId,
  PostId,
  ConnectedAccountId,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/utils/errors";
import type { IEngagementRepository } from "../repositories/engagement.repository";
import type {
  EngagementInboxItemRecord,
  EngagementReplyRecord,
  InboxItemFilter,
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

/**
 * Application Service untuk domain `engagement` (T-050). Scope awalnya
 * dibatasi ke 3 use-case baca/tulis dasar — sync (T-051) dan manual refresh
 * (T-052) punya use-case/handler sendiri di luar class ini. Reply (T-054)
 * SEKARANG ditambahkan di sini sebagai method `reply` — bukan use-case
 * terpisah seperti sync — karena scope-nya kecil (satu panggilan adapter +
 * satu persist) dan sepenuhnya milik lifecycle `EngagementInboxItem`/
 * `EngagementReply`, konsisten dengan `getInboxItemDetail`/`markAsDone` yang
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
   * Tandai satu inbox item sebagai sudah dibalas/selesai ("done"). Tidak
   * memanggil `OutstandAdapter` apa pun — murni perubahan status lokal.
   * `NotFoundError` kalau item tidak ditemukan atau bukan milik
   * `workspaceId` ini.
   */
  async markAsDone(
    input: { workspaceId: WorkspaceId; inboxItemId: InboxItemId },
    userId: UserId,
  ): Promise<EngagementInboxItemRecord> {
    const item = await this.repository.markInboxItemStatus(
      { ...input, status: "done" },
      userId,
    );
    if (!item) {
      throw new NotFoundError("Komentar tidak ditemukan.");
    }
    return item;
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
   * pola sama `getInboxItemDetail`/`markAsDone`) → resolve `outstandPostId`
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

    return this.repository.createReply(
      {
        inboxItemId: item.id,
        userId,
        content,
        outstandReplyId,
      },
      userId,
    );
  }
}
