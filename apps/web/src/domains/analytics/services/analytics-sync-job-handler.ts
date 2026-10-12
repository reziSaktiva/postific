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
 * harian datang dari Railway Cron terpisah yang men-enqueue job baru
 * (`EnqueueAnalyticsSyncUseCase`), bukan dari interval di dalam handler
 * (beda dari JOB-03 yang +30 menit).
 */
export const ANALYTICS_SYNC_JOB_TYPE = "analytics.sync";

const SNAPSHOT_PERIODS: SnapshotPeriod[] = ["weekly", "monthly"];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface AnalyticsSyncJobPayload {
  workspaceId: string;
  connectedAccountId: string;
  outstandAccountId: string;
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

function parsePayload(payload: unknown): AnalyticsSyncJobPayload {
  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as { workspaceId?: unknown }).workspaceId !== "string" ||
    typeof (payload as { connectedAccountId?: unknown }).connectedAccountId !==
      "string" ||
    typeof (payload as { outstandAccountId?: unknown }).outstandAccountId !==
      "string"
  ) {
    throw new Error(
      `Payload job "${ANALYTICS_SYNC_JOB_TYPE}" tidak valid — diharapkan ` +
        `{ workspaceId: string, connectedAccountId: string, outstandAccountId: string }, ` +
        `dapat: ${JSON.stringify(payload)}`,
    );
  }
  return payload as AnalyticsSyncJobPayload;
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

/**
 * Handler JOB-04 (T-048). Satu job = satu `ConnectedAccount` aktif.
 *
 * 1. `syncPostMetrics` untuk post published akun itu yang punya
 *    `outstandPostId` (daftar yang sama dengan JOB-03, dibatasi 50 terbaru).
 *    Upsert idempoten, jadi jalan harian ikut menyegarkan angka, bukan
 *    hanya mengisi baris yang belum ada.
 * 2. `syncWorkspaceSnapshot` untuk `weekly` dan `monthly` memakai SEMUA
 *    akun aktif di workspace yang sama — agregat Home tidak boleh jadi
 *    angka satu akun saja kalau workspace punya lebih dari satu akun.
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

    const workspaceId = asWorkspaceId(payload.workspaceId);
    const connectedAccountId = asConnectedAccountId(payload.connectedAccountId);
    const syncablePosts = await this.posts.listSyncablePostsByConnectedAccount(
      { workspaceId, connectedAccountId },
      owner.ownerUserId,
    );

    if (syncablePosts.length > 0) {
      await this.useCase.syncPostMetrics(
        syncablePosts.map((post) => ({
          postId: asPostId(post.postId),
          connectedAccountId,
          platform: post.platform,
          outstandPostId: post.outstandPostId,
        })),
        owner.ownerUserId,
      );
    }

    const activeAccounts =
      await this.accounts.listActiveConnectedAccountsForSync();
    const workspaceAccounts = activeAccounts.filter(
      (account) => account.workspaceId === payload.workspaceId,
    );
    const snapshotAccounts =
      workspaceAccounts.length > 0
        ? workspaceAccounts
        : [
            {
              workspaceId: payload.workspaceId,
              connectedAccountId: payload.connectedAccountId,
              outstandAccountId: payload.outstandAccountId,
            },
          ];

    const now = this.now();
    for (const period of SNAPSHOT_PERIODS) {
      const window = resolveAnalyticsSnapshotWindow(period, now);
      await this.useCase.syncWorkspaceSnapshot(
        {
          workspaceId,
          period,
          periodStart: window.periodStart,
          periodEnd: window.periodEnd,
          accounts: snapshotAccounts.map((account) => ({
            connectedAccountId: asConnectedAccountId(
              account.connectedAccountId,
            ),
            outstandAccountId: account.outstandAccountId,
          })),
        },
        owner.ownerUserId,
      );
    }
  }
}
