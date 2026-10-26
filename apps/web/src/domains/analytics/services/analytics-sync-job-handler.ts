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

  /**
   * T-134 (KI-094) gap kritis — fallback resolve acting user untuk
   * workspace yang SUDAH TIDAK PUNYA akun aktif sama sekali (disconnect
   * akun terakhir). `findAccountOwnerByOutstandAccountId` di atas sengaja
   * return `null` untuk akun yang statusnya bukan `active` (lihat
   * implementasi Prisma), jadi loop `syncWorkspace` tidak bisa menemukan
   * acting user lewat akun begitu `workspaceAccounts` kosong — tanpa
   * fallback ini, `syncWorkspace` tidak pernah bisa menulis snapshot nol
   * untuk workspace yang baru kehilangan akun terakhirnya, membuat tujuan
   * T-134 (recompute snapshot segera saat disconnect) gagal tercapai justru
   * untuk kasus paling umum (disconnect satu-satunya akun). Dibaca langsung
   * dari `Workspace.ownerId` — kolom itu TIDAK RLS-protected (migration
   * `20260813045625_t017_add_rls_policies`, § "Tables intentionally WITHOUT
   * workspace-isolation RLS"), jadi aman dipanggil tanpa sesi, sama
   * alasannya dengan `findAccountOwnerByOutstandAccountId`/
   * `markAccountReconnectRequired`. Returns `null` kalau workspace itu
   * sendiri tidak ditemukan (anomali — payload job tidak valid).
   */
  findWorkspaceOwnerUserId(workspaceId: string): Promise<UserId | null>;
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
 *
 * `weekly` tetap rolling 7 hari dari `now`. `monthly` memakai kalender
 * bulan (tanggal 1 jam 00:00:00 UTC bulan berjalan s.d. `now`) sejak
 * T-135.2 — sebelumnya rolling 30 hari, yang tidak bisa dibandingkan
 * apple-to-apple dengan dashboard native Outstand (KI-095). `periodEnd`
 * sengaja tetap `now`, bukan akhir bulan: kalau bulan belum selesai,
 * window berakhir di saat job jalan, bukan dimajukan ke tanggal yang
 * belum terjadi.
 */
export function resolveAnalyticsSnapshotWindow(
  period: SnapshotPeriod,
  now: Date,
): { periodStart: Date; periodEnd: Date } {
  const periodEnd = now;

  if (period === "monthly") {
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    );
    return { periodStart, periodEnd };
  }

  const periodStart = new Date(now.getTime() - 7 * MS_PER_DAY);
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

    // T-134 (KI-094) gap kritis — `workspaceAccounts` kosong BUKAN selalu
    // anomali: disconnect akun TERAKHIR di satu workspace membuat
    // `listActiveConnectedAccountsForSync` tidak lagi mengembalikan akun
    // apa pun untuk workspace ini (by design — fungsi itu memang hanya
    // mengembalikan akun `active`). Snapshot HARUS tetap di-upsert NOL di
    // bawah (bukan throw/skip diam-diam), supaya Home/Analyze tidak terus
    // menampilkan angka akun yang baru di-disconnect sampai siklus fan-out
    // harian berikutnya. Loop di atas tidak bisa menemukan acting user lewat
    // akun (tidak ada akun aktif tersisa untuk di-lookup), jadi fallback ke
    // `Workspace.ownerId` lewat `findWorkspaceOwnerUserId` — HANYA untuk
    // kasus 0-akun ini; kalau `workspaceAccounts` TIDAK kosong tapi loop di
    // atas tetap gagal menemukan owner (race/anomali data), behavior lama
    // (throw di bawah) tetap berlaku apa adanya.
    if (!actingUserId && workspaceAccounts.length === 0) {
      actingUserId =
        await this.ownerLookup.findWorkspaceOwnerUserId(workspaceId);
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
