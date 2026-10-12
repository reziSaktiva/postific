import type { ConnectedAccountId, UserId, WorkspaceId } from "@postific/shared";
import type { SyncCommentsUseCase } from "./sync-comments.use-case";

/**
 * Port lokal cross-domain `engagement` → `workspace` (dependency arah ini
 * SUDAH legal — `application-layer.md` § "Peta Dependency Antar Domain":
 * "BC-05 Engagement ──→ BC-02 Workspace (filter per ConnectedAccount)"),
 * pola sama `ConnectedAccountsPort` di `PublishingService`
 * (`domains/publishing/services/publishing.service.ts`). Hanya butuh field
 * yang benar-benar dipakai (`id`, `outstandAccountId`, `status`) — bukan
 * seluruh `ConnectedAccountRecord` — jadi `WorkspaceService` (yang
 * mengembalikan superset field ini dari `listConnectedAccounts`) valid
 * dipassing langsung ke sini lewat structural typing, tanpa wrapper baru.
 * `engagement` TIDAK mengimpor `WorkspaceService` konkret; composition root
 * (Server Action `refreshInboxAction`) menyuplai instance lewat constructor.
 */
interface ConnectedAccountsPort {
  listConnectedAccounts(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<
    {
      id: ConnectedAccountId;
      outstandAccountId: string;
      handle: string;
      status: string;
    }[]
  >;
}

export interface RefreshInboxResult {
  newCommentsCount: number;
}

/**
 * Manual refresh Comments Inbox (T-052, `background-jobs.md` § JOB-03).
 * Orkestrasi "ambil `ConnectedAccount` AKTIF workspace, sync SETIAP akun
 * secara berurutan lewat `SyncCommentsUseCase.sync` yang sama dipakai
 * `EngagementSyncJobHandler`, akumulasi total `newCommentsCount`"
 * DIPINDAHKAN ke sini dari `refreshInboxAction`
 * (Temuan #2 review Ridwan Architecture Reviewer: Server Action tidak
 * boleh berisi business logic/orkestrasi, AGENTS.md #5 — sebelumnya loop
 * dan akumulasi count dilakukan langsung di dalam Server Action).
 *
 * Behavior TIDAK berubah dari implementasi lama di `actions.ts` — ini
 * refactor struktural murni (pindah logic ke Application Service layer),
 * bukan perubahan UX: masih sync berurutan (bukan paralel, sengaja
 * menghindari beban paralel tak perlu ke Outstand untuk operasi yang
 * dipicu manual/jarang), masih TIDAK self-reschedule/enqueue job baru
 * (beda dari `EngagementSyncJobHandler`, konsisten catatan
 * `SyncCommentsUseCase`).
 */
export class RefreshInboxUseCase {
  constructor(
    private readonly syncCommentsUseCase: SyncCommentsUseCase,
    private readonly connectedAccounts: ConnectedAccountsPort,
  ) {}

  async refreshAll(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<RefreshInboxResult> {
    const accounts = await this.connectedAccounts.listConnectedAccounts(
      workspaceId,
      userId,
    );
    const activeAccounts = accounts.filter(
      (account) => account.status === "active",
    );

    let newCommentsCount = 0;
    for (const account of activeAccounts) {
      const result = await this.syncCommentsUseCase.sync(
        {
          workspaceId,
          connectedAccountId: account.id,
          accountUsername: account.handle,
        },
        userId,
      );
      newCommentsCount += result.newCommentsCount;
    }

    return { newCommentsCount };
  }
}
