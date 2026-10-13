import {
  NotificationType,
  type ConnectedAccountId,
  type IOutstandAdapter,
  type PostId,
  type SocialPlatform,
  type UserId,
  type WorkspaceId,
} from "@postific/shared";
import type { IEngagementRepository } from "../repositories/engagement.repository";

/**
 * Port lokal cross-domain `engagement` → `notification` (JOB-03 langkah 4,
 * `background-jobs.md`) — pola sama `NotificationPort` di
 * `OutstandWebhookProcessor` (`domains/publishing`). `engagement` TIDAK
 * mengimpor `NotificationService` konkret; composition root (job route)
 * menyuplai instance lewat constructor. Opsional — kalau tidak disuplai,
 * langkah notifikasi di-skip diam-diam (bukan throw), supaya use-case ini
 * tetap bisa jalan/di-test tanpa notification wiring lengkap.
 */
interface NotificationPort {
  notify(input: {
    workspaceId: WorkspaceId;
    userId: UserId;
    type: NotificationType;
    title: string;
    body: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }): Promise<unknown>;
}

/**
 * Port lokal cross-domain `engagement` → `workspace` (dependency arah ini
 * SUDAH legal — `application-layer.md` § "Peta Dependency Antar Domain":
 * "BC-05 Engagement ──→ BC-02 Workspace (filter per ConnectedAccount)").
 * Comments Inbox bisa diakses ketiga role (Owner/Admin/Creator,
 * `roles-permissions.md`) dan tidak ada "pemilik" tunggal seperti post —
 * notifikasi aggregate (langkah 4 JOB-03) karena itu di-fan-out ke SETIAP
 * member aktif workspace, bukan satu user (keputusan implementasi backend,
 * bukan ambiguitas UI/produk). `engagement` TIDAK mengimpor
 * `WorkspaceService` konkret — pola sama `ConnectedAccountsPort` di
 * `PublishingService`. Opsional — kalau tidak disuplai, notifikasi
 * di-skip (sama seperti `NotificationPort` tidak disuplai).
 */
interface WorkspaceMembersPort {
  listActiveMembers(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<{ userId: UserId }[]>;
}

/**
 * Port lokal cross-domain `engagement` → `publishing` (dependency arah ini
 * SUDAH legal — sama alasan `ConnectedAccountsPort` di
 * `RefreshInboxUseCase`/`WorkspaceMembersPort` di bawah: `engagement` tidak
 * mengimpor `PublishingRepository`/`PublishingService` konkret, composition
 * root (job route/`refreshInboxAction`) menyuplai instance lewat
 * constructor). Redesain KI-068/ADR-113 — root cause KI-068 adalah kontrak
 * `fetchComments` lama men-scope komentar PER AKUN dengan `cursor`,
 * sementara API resmi Outstand men-scope PER POST tanpa cursor. Daftar post
 * yang perlu di-sync sekarang diambil dari DB kita sendiri
 * (`PublishingPost`/`PublishingPostTarget`, BUKAN endpoint list-posts
 * Outstand — keputusan eksplisit King Rezi) lewat public API barrel
 * `@/domains/publishing` (`IPublishingRepository.listSyncablePostsByConnectedAccount`,
 * dipassing langsung structural-typing sama seperti `workspaceRepository`
 * dipakai sebagai `WorkspaceOwnerLookupPort`).
 */
interface PublishingPostsPort {
  listSyncablePostsByConnectedAccount(
    input: { workspaceId: WorkspaceId; connectedAccountId: ConnectedAccountId },
    userId: UserId,
  ): Promise<
    { postId: PostId; outstandPostId: string; platform: SocialPlatform }[]
  >;
}

export interface SyncCommentsPayload {
  workspaceId: WorkspaceId;
  connectedAccountId: ConnectedAccountId;
  /**
   * Redesain KI-068/ADR-113 — menggantikan `outstandAccountId` (tidak lagi
   * dibutuhkan langsung oleh `sync()`: `outstandPostId`/`platform` per post
   * sekarang datang dari `PublishingPostsPort`, bukan dari
   * `IOutstandAdapter.fetchComments` yang di-scope per akun seperti
   * sebelumnya). `accountUsername` = `WorkspaceConnectedAccount.handle` —
   * WAJIB dikirim ke `fetchComments` karena API resmi Outstand butuhnya
   * untuk disambiguasi saat satu post publish ke >1 akun di network yang
   * sama (lihat `outstand-adapter.ts`).
   */
  accountUsername: string;
}

export interface SyncCommentsResult {
  newCommentsCount: number;
}

/**
 * JOB-03 Engagement Sync (`background-jobs.md`, T-051, redesain
 * KI-068/ADR-113) — logic sync MURNI untuk SATU `ConnectedAccount`,
 * dipisahkan dari job scheduling/self-reschedule (itu tanggung jawab
 * `EngagementSyncJobHandler`, BUKAN use-case ini) supaya method `sync`
 * bisa di-reuse LANGSUNG oleh manual refresh (T-052, tidak
 * self-reschedule) tanpa duplikasi logic sync.
 *
 * **`userId` untuk `withCurrentUser`/RLS:** job periodik (dipanggil lewat
 * `EngagementSyncJobHandler`) tidak punya Better Auth session per-request —
 * `userId` yang dipakai diteruskan APA ADANYA oleh caller (`sync` menerima
 * `userId` sebagai parameter terpisah dari `payload`, BUKAN bagian dari
 * payload JOB-03 resmi di `background-jobs.md`) — keputusan "user/service
 * account mana yang dipakai" ada di composition root (job route), bukan di
 * use-case ini (lihat catatan `EngagementSyncJobHandler`).
 */
export class SyncCommentsUseCase {
  constructor(
    private readonly repository: IEngagementRepository,
    private readonly adapter: IOutstandAdapter,
    private readonly publishingPosts: PublishingPostsPort,
    private readonly notification?: NotificationPort,
    private readonly workspaceMembers?: WorkspaceMembersPort,
  ) {}

  async sync(
    payload: SyncCommentsPayload,
    userId: UserId,
  ): Promise<SyncCommentsResult> {
    const { workspaceId, connectedAccountId, accountUsername } = payload;

    // Redesain KI-068/ADR-113 — daftar post yang di-sync sekarang dari DB
    // kita sendiri (bukan lagi satu call `fetchComments` per akun dengan
    // `cursor`). Loop BERURUTAN per post (bukan `Promise.all` lintas post)
    // — sengaja, menghindari beban paralel tak perlu ke Outstand untuk job
    // periodik/manual refresh, konsisten pola `RefreshInboxUseCase`.
    const syncablePosts =
      await this.publishingPosts.listSyncablePostsByConnectedAccount(
        { workspaceId, connectedAccountId },
        userId,
      );

    let newCommentsCount = 0;
    const postErrors: { outstandPostId: string; message: string }[] = [];

    for (const post of syncablePosts) {
      // Isolasi per-post: satu fetchComments gagal (404/transient) jangan
      // menggagalkan sync seluruh akun — log + lanjut post berikutnya.
      let comments;
      try {
        const result = await this.adapter.fetchComments({
          outstandPostId: post.outstandPostId,
          platform: post.platform,
          accountUsername,
        });
        comments = result.comments;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[SyncCommentsUseCase] fetchComments gagal untuk outstandPostId=${post.outstandPostId} (akun ${connectedAccountId}) — lanjut post lain:`,
          error,
        );
        postErrors.push({ outstandPostId: post.outstandPostId, message });
        continue;
      }

      // Upsert per komentar dijalankan konkuren (bukan `await` berurutan
      // satu-satu) supaya round-trip DB tidak terserialisasi — tiap
      // panggilan tetap atomik/idempotent sendiri (unique constraint +
      // advisory lock per `connectedAccountId` di `upsertInboxItem`).
      const results = await Promise.all(
        comments.map((comment) =>
          this.repository.upsertInboxItem(
            {
              workspaceId,
              connectedAccountId,
              platform: comment.platform,
              type: "comment",
              externalId: comment.outstandCommentId,
              authorHandle: comment.authorHandle,
              content: comment.content,
              receivedAt: comment.receivedAt,
              // Redesain KI-068/ADR-113 — kolom `EngagementInboxItem.postId`
              // sudah ada di schema sejak awal (T-050) tapi TIDAK PERNAH
              // diisi jalur manapun sebelum ini (root cause salah satu
              // sub-poin KI-068): sekarang terisi dari `post.postId` yang
              // SAMA dengan `outstandPostId` yang barusan dipakai
              // `fetchComments` di atas — join balik lewat
              // `listSyncablePostsByConnectedAccount` (BUKAN tebakan/lookup
              // terpisah).
              postId: post.postId,
            },
            userId,
          ),
        ),
      );

      for (const { isNew } of results) {
        if (isNew) {
          newCommentsCount += 1;
        }
      }
    }

    if (postErrors.length > 0) {
      console.error(
        `[SyncCommentsUseCase] ${postErrors.length}/${syncablePosts.length} post gagal di-sync untuk connectedAccountId=${connectedAccountId}:`,
        postErrors,
      );
    }

    if (newCommentsCount > 0) {
      await this.notifyNewComments(workspaceId, newCommentsCount, userId);
    }

    return { newCommentsCount };
  }

  /**
   * Notifikasi aggregate SATU KALI (bukan per-komentar, JOB-03 langkah 4)
   * ke setiap member aktif workspace. Diam-diam skip (tidak throw) kalau
   * salah satu port opsional tidak disuplai — lihat catatan
   * `NotificationPort`/`WorkspaceMembersPort` di atas.
   */
  private async notifyNewComments(
    workspaceId: WorkspaceId,
    newCommentsCount: number,
    userId: UserId,
  ): Promise<void> {
    if (!this.notification || !this.workspaceMembers) {
      return;
    }

    const members = await this.workspaceMembers.listActiveMembers(
      workspaceId,
      userId,
    );

    await Promise.all(
      members.map((member) =>
        this.notification?.notify({
          workspaceId,
          userId: member.userId,
          type: NotificationType.EngagementNewComments,
          title: "Komentar baru masuk",
          body:
            newCommentsCount === 1
              ? "1 komentar baru menunggu balasan di Comments Inbox."
              : `${newCommentsCount} komentar baru menunggu balasan di Comments Inbox.`,
        }),
      ),
    );
  }
}
