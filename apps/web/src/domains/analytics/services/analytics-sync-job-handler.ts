import {
  asConnectedAccountId,
  asPostId,
  asWorkspaceId,
  type ConnectedAccountId,
  type PostId,
  type SocialPlatform,
  type UserId,
  type WorkspaceId,
} from "@postific/shared";
import type { SnapshotPeriod } from "../types";
import type { AnalyticsIngestionUseCase } from "./analytics-ingestion.use-case";

/**
 * Job type registry (T-048) — `background-jobs.md` § JOB-04 sudah
 * mendaftarkan tipe `analytics.sync`. Tidak self-reschedule: frekuensi
 * harian datang dari fan-out sekali per hari UTC
 * (`EnqueueAnalyticsSyncUseCase`), bukan dari interval di dalam handler
 * (beda dari JOB-03 yang +30 menit).
 *
 * Dua bentuk payload, satu tipe:
 * - akun — `syncPostMetrics` untuk satu `ConnectedAccount`
 * - workspace — `syncWorkspaceSnapshot` sekali per workspace (mingguan +
 *   bulanan). Dipisah supaya job akun yang jalan paralel tidak menulis
 *   baris snapshot yang sama.
 */
export const ANALYTICS_SYNC_JOB_TYPE = "analytics.sync";

export const ANALYTICS_SYNC_SCOPE_WORKSPACE = "workspace";

const SNAPSHOT_PERIODS: SnapshotPeriod[] = ["weekly", "monthly"];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface AnalyticsSyncJobPayload {
  workspaceId: string;
  connectedAccountId: string;
  outstandAccountId: string;
}

export interface AnalyticsSyncWorkspaceJobPayload {
  scope: typeof ANALYTICS_SYNC_SCOPE_WORKSPACE;
  workspaceId: string;
  workspaceSnapshotId: string;
}

export interface AnalyticsSyncAccount {
  workspaceId: string;
  connectedAccountId: string;
  outstandAccountId: string;
}

export interface AnalyticsSyncPost {
  postId: PostId;
  outstandPostId: string;
  platform: SocialPlatform;
}

/**
 * Lookup Owner workspace untuk acting user RLS — bentuk yang sama dengan
 * `IWorkspaceRepository.findAccountOwnerByOutstandAccountId`. `null` kalau
 * akun tidak aktif / perlu reconnect.
 */
export interface AnalyticsSyncOwnerLookupPort {
  findAccountOwnerByOutstandAccountId(outstandAccountId: string): Promise<{
    workspaceId: string;
    connectedAccountId: string;
    ownerUserId: UserId;
  } | null>;
}

/** Post published yang sudah punya `outstandPostId` untuk satu akun. */
export interface AnalyticsSyncPostsPort {
  listSyncablePostsByConnectedAccount(
    input: {
      workspaceId: WorkspaceId;
      connectedAccountId: ConnectedAccountId;
    },
    userId: UserId,
  ): Promise<AnalyticsSyncPost[]>;
}

/** Seluruh `ConnectedAccount` aktif (SECURITY DEFINER, tanpa sesi). */
export interface AnalyticsSyncAccountsPort {
  listActiveConnectedAccountsForSync(): Promise<AnalyticsSyncAccount[]>;
}

type ParsedAnalyticsSyncPayload =
  | ({ scope: "account" } & AnalyticsSyncJobPayload)
  | AnalyticsSyncWorkspaceJobPayload;

function invalidPayload(payload: unknown): Error {
  return new Error(
    `Payload job "${ANALYTICS_SYNC_JOB_TYPE}" tidak valid — diharapkan job akun ` +
      `{ workspaceId, connectedAccountId, outstandAccountId } atau job snapshot ` +
      `{ scope: "${ANALYTICS_SYNC_SCOPE_WORKSPACE}", workspaceId }, dapat: ${JSON.stringify(payload)}`,
  );
}

function parsePayload(payload: unknown): ParsedAnalyticsSyncPayload {
  if (typeof payload !== "object" || payload === null) {
    throw invalidPayload(payload);
  }

  const record = payload as {
    scope?: unknown;
    workspaceId?: unknown;
    connectedAccountId?: unknown;
    outstandAccountId?: unknown;
    workspaceSnapshotId?: unknown;
  };

  if (record.scope === ANALYTICS_SYNC_SCOPE_WORKSPACE) {
    if (typeof record.workspaceId !== "string") {
      throw invalidPayload(payload);
    }
    return {
      scope: ANALYTICS_SYNC_SCOPE_WORKSPACE,
      workspaceId: record.workspaceId,
      workspaceSnapshotId:
        typeof record.workspaceSnapshotId === "string"
          ? record.workspaceSnapshotId
          : record.workspaceId,
    };
  }

  if (
    typeof record.workspaceId !== "string" ||
    typeof record.connectedAccountId !== "string" ||
    typeof record.outstandAccountId !== "string"
  ) {
    throw invalidPayload(payload);
  }

  return {
    scope: "account",
    workspaceId: record.workspaceId,
    connectedAccountId: record.connectedAccountId,
    outstandAccountId: record.outstandAccountId,
  };
}

/**
 * `periodStart` di-bucket ke tengah malam UTC supaya dua jalan di hari
 * yang sama menimpa baris unique `[workspaceId, period, periodStart]`
 * (T-041.5), bukan menambah snapshot baru tiap milidetik.
 */
export function resolveAnalyticsSnapshotWindow(
  period: SnapshotPeriod,
  now: Date,
): { periodStart: Date; periodEnd: Date } {
  const days = period === "weekly" ? 7 : 30;
  const periodEnd = now;
  const periodStart = new Date(now.getTime() - days * MS_PER_DAY);
  periodStart.setUTCHours(0, 0, 0, 0);
  return { periodStart, periodEnd };
}

export function analyticsWorkspaceSnapshotPayload(
  workspaceId: string,
): AnalyticsSyncWorkspaceJobPayload {
  return {
    scope: ANALYTICS_SYNC_SCOPE_WORKSPACE,
    workspaceId,
    workspaceSnapshotId: workspaceId,
  };
}

/**
 * Handler JOB-04 (T-048).
 *
 * Job akun hanya menyegarkan metrik post akun itu (paling banyak 50 post
 * terbaru, daftar yang sama dengan JOB-03). Upsert idempoten, jadi jalan
 * harian ikut memperbarui angka.
 *
 * Job workspace menulis snapshot `weekly` dan `monthly` sekali, memakai
 * semua akun aktif workspace itu. Home tidak boleh menyimpan angka satu
 * akun saja, dan job akun yang paralel tidak boleh berebut baris yang sama.
 */
export class AnalyticsSyncJobHandler {
  constructor(
    private readonly useCase: AnalyticsIngestionUseCase,
    private readonly ownerLookup: AnalyticsSyncOwnerLookupPort,
    private readonly posts: AnalyticsSyncPostsPort,
    private readonly accounts: AnalyticsSyncAccountsPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async handle(rawPayload: unknown): Promise<void> {
    const payload = parsePayload(rawPayload);
    if (payload.scope === ANALYTICS_SYNC_SCOPE_WORKSPACE) {
      await this.syncWorkspace(payload.workspaceId);
      return;
    }
    await this.syncAccount(payload);
  }

  private async syncAccount(payload: AnalyticsSyncJobPayload): Promise<void> {
    const owner = await this.ownerLookup.findAccountOwnerByOutstandAccountId(
      payload.outstandAccountId,
    );
    if (!owner) {
      throw new Error(
        `AnalyticsSyncJobHandler: outstandAccountId=${payload.outstandAccountId} ` +
          `tidak ditemukan atau tidak aktif.`,
      );
    }
    if (
      owner.workspaceId !== payload.workspaceId ||
      owner.connectedAccountId !== payload.connectedAccountId
    ) {
      throw new Error(
        `AnalyticsSyncJobHandler: payload (workspaceId=${payload.workspaceId}, ` +
          `connectedAccountId=${payload.connectedAccountId}) tidak cocok dengan hasil lookup ` +
          `(workspaceId=${owner.workspaceId}, connectedAccountId=${owner.connectedAccountId}) ` +
          `untuk outstandAccountId=${payload.outstandAccountId}.`,
      );
    }

    const syncablePosts = await this.posts.listSyncablePostsByConnectedAccount(
      {
        workspaceId: asWorkspaceId(payload.workspaceId),
        connectedAccountId: asConnectedAccountId(payload.connectedAccountId),
      },
      owner.ownerUserId,
    );

    if (syncablePosts.length === 0) {
      return;
    }

    await this.useCase.syncPostMetrics(
      syncablePosts.map((post) => ({
        postId: asPostId(post.postId),
        connectedAccountId: asConnectedAccountId(payload.connectedAccountId),
        platform: post.platform,
        outstandPostId: post.outstandPostId,
      })),
      owner.ownerUserId,
    );
  }

  private async syncWorkspace(workspaceId: string): Promise<void> {
    const activeAccounts =
      await this.accounts.listActiveConnectedAccountsForSync();
    const workspaceAccounts = activeAccounts.filter(
      (account) => account.workspaceId === workspaceId,
    );
    if (workspaceAccounts.length === 0) {
      throw new Error(
        `AnalyticsSyncJobHandler: workspaceId=${workspaceId} tidak punya akun aktif untuk snapshot.`,
      );
    }

    let actingUserId: UserId | null = null;
    for (const account of workspaceAccounts) {
      const owner = await this.ownerLookup.findAccountOwnerByOutstandAccountId(
        account.outstandAccountId,
      );
      if (owner?.workspaceId === workspaceId) {
        actingUserId = owner.ownerUserId;
        break;
      }
    }
    if (!actingUserId) {
      throw new Error(
        `AnalyticsSyncJobHandler: owner workspaceId=${workspaceId} tidak ditemukan atau tidak aktif.`,
      );
    }

    const snapshotAccounts = workspaceAccounts.map((account) => ({
      connectedAccountId: asConnectedAccountId(account.connectedAccountId),
      outstandAccountId: account.outstandAccountId,
    }));
    const now = this.now();
    const brandedWorkspaceId = asWorkspaceId(workspaceId);

    await Promise.all(
      SNAPSHOT_PERIODS.map(async (period) => {
        const window = resolveAnalyticsSnapshotWindow(period, now);
        await this.useCase.syncWorkspaceSnapshot(
          {
            workspaceId: brandedWorkspaceId,
            period,
            periodStart: window.periodStart,
            periodEnd: window.periodEnd,
            accounts: snapshotAccounts,
          },
          actingUserId,
        );
      }),
    );
  }
}
