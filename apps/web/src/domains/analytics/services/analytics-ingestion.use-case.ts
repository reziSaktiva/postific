import type {
  ConnectedAccountId,
  IOutstandAdapter,
  OutstandMetricsPeriod,
  PostId,
  SocialPlatform,
  WorkspaceId,
} from "@postific/shared";
import type {
  IAnalyticsRepository,
  PostMetricsRecord,
  WorkspaceSnapshotRecord,
} from "../repositories/analytics.repository";
import type { SnapshotPeriod } from "../types";

/**
 * `SnapshotPeriod` domain (`weekly` | `monthly`) → `OutstandMetricsPeriod`
 * ACL (`last_7_days` | `last_30_days`, `packages/shared`). ACL tidak
 * mengenal bahasa domain internal (integration-layer.md), jadi mapping ini
 * hidup di Use Case (bukan di adapter maupun repository).
 */
const OUTSTAND_PERIOD_BY_SNAPSHOT_PERIOD: Record<
  SnapshotPeriod,
  OutstandMetricsPeriod
> = {
  weekly: "last_7_days",
  monthly: "last_30_days",
};

export interface SyncPostMetricsTargetInput {
  postId: PostId;
  connectedAccountId: ConnectedAccountId;
  platform: SocialPlatform;
  /**
   * `PublishingPost.outstandPostId` — external reference dari domain
   * `publishing` (redesain ACL 2026-08-26: dulu `PublishingPostTarget.outstandJobId`
   * per-target, sekarang post-level dan SAMA untuk semua target satu post,
   * karena Outstand hanya mengenal satu id per post, bukan satu job per
   * akun). Use Case ini TIDAK mengimpor domain `publishing`; caller (job
   * handler / Route Handler `/api/jobs/run`) wajib me-resolve nilai ini
   * lebih dulu lewat public API `publishing`, persis pola
   * `SchedulePostsUseCase` (ADR-059) yang mewajibkan caller me-resolve
   * `outstandAccountId` dari domain `workspace` sebelum memanggil `execute`.
   *
   * **Gap diketahui (dicatat, bukan diselesaikan di redesain ini)** —
   * `fetchPostMetrics` Outstand sebenarnya mengembalikan metrics PER-AKUN +
   * `aggregated_metrics` untuk SATU `outstandPostId`, jadi memanggilnya
   * sekali per target dengan id yang sama (seperti di bawah) tidak
   * memanfaatkan bentuk response asli — follow-up T-041 mengevaluasi
   * penyesuaian shape penuh (array per akun), bukan bagian ADR ini.
   */
  outstandPostId: string;
}

export interface SyncWorkspaceSnapshotAccountInput {
  connectedAccountId: ConnectedAccountId;
  /** `WorkspaceConnectedAccount.outstandAccountId` — lihat catatan di atas. */
  outstandAccountId: string;
}

/**
 * Use Case terpisah dari `AnalyticsService` (bukan method di dalamnya) —
 * pola yang sama dengan `SchedulePostsUseCase` (ADR-059 poin 5): constructor
 * MEWAJIBKAN `IOutstandAdapter` secara tipe untuk operasi yang butuh
 * dependency di luar `IAnalyticsRepository`, supaya constructor
 * `AnalyticsService` (read-only, T-040) tetap sederhana.
 *
 * Dipanggil oleh JOB-04 (`background-jobs.md`) — frekuensi sync HARIAN
 * (bukan 30 menit seperti Engagement JOB-03, T-041.3): metrik post/akun
 * tidak berubah secepat komentar, dan Outstand sendiri hanya
 * mengagregasikan data platform secara periodik, jadi polling lebih sering
 * dari harian tidak menambah nilai — hanya menambah beban API Outstand.
 * Penjadwalan cron sungguhan (Railway Cron) di luar scope T-041 — Use Case
 * ini disiapkan untuk dipanggil manual/dari test dulu.
 */
export class AnalyticsIngestionUseCase {
  constructor(
    private readonly repository: IAnalyticsRepository,
    private readonly outstandAdapter: IOutstandAdapter,
  ) {}

  /**
   * T-041.1/T-041.2 — fetch metrik per post target dari Outstand lalu
   * upsert ke `AnalyticsPostMetric`. Idempoten (T-041.5): upsert per
   * (postId, connectedAccountId), jadi memanggil ulang untuk target yang
   * sama tidak menggandakan baris.
   */
  async syncPostMetrics(
    targets: SyncPostMetricsTargetInput[],
  ): Promise<PostMetricsRecord[]> {
    const results: PostMetricsRecord[] = [];

    // Semua target satu post berbagi `outstandPostId` yang sama (lihat catatan
    // di `SyncPostMetricsTargetInput.outstandPostId`), jadi `fetchPostMetrics`
    // di-fetch SEKALI per `outstandPostId` unik — bukan sekali per target —
    // supaya post multi-akun tidak memanggil Outstand berkali-kali untuk hasil
    // yang identik. Nilai per target tetap identik (gap diketahui, T-041)
    // karena `FetchPostMetricsResult` belum dipecah per akun.
    const metricsByOutstandPostId = new Map<
      string,
      Awaited<ReturnType<typeof this.outstandAdapter.fetchPostMetrics>>
    >();

    for (const target of targets) {
      let metrics = metricsByOutstandPostId.get(target.outstandPostId);
      if (!metrics) {
        metrics = await this.outstandAdapter.fetchPostMetrics(
          target.outstandPostId,
        );
        metricsByOutstandPostId.set(target.outstandPostId, metrics);
      }

      const record = await this.repository.upsertPostMetrics({
        postId: target.postId,
        connectedAccountId: target.connectedAccountId,
        platform: target.platform,
        impressions: metrics.impressions,
        reach: metrics.reach,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        clicks: metrics.clicks,
        engagementRate: metrics.engagementRate,
        fetchedAt: new Date(),
      });

      results.push(record);
    }

    return results;
  }

  /**
   * T-041.1/T-041.4 — fetch metrik agregat per connected account dari
   * Outstand, jumlahkan lintas akun workspace, lalu upsert satu snapshot
   * `AnalyticsWorkspaceSnapshot`. Idempoten (T-041.5) lewat unique
   * constraint `[workspaceId, period, periodStart]` (T-040).
   *
   * `avgEngagementRate` dihitung ulang dari total gabungan (bukan
   * rata-rata dari rata-rata per akun) supaya akun dengan reach lebih besar
   * berkontribusi proporsional — menghindari bias "rata-rata dari
   * rata-rata" yang umum salah pada agregasi lintas entitas dengan bobot
   * berbeda.
   *
   * `topPostId` sengaja tidak dihitung di sini (di luar scope T-041 —
   * Outstand tidak menyediakan endpoint "top post" dan menentukannya butuh
   * query lintas `AnalyticsPostMetric` yang bisa jadi task terpisah);
   * caller boleh mengoper nilai yang sudah diketahui, default `null`.
   */
  async syncWorkspaceSnapshot(input: {
    workspaceId: WorkspaceId;
    period: SnapshotPeriod;
    periodStart: Date;
    periodEnd: Date;
    accounts: SyncWorkspaceSnapshotAccountInput[];
    topPostId?: PostId | null;
  }): Promise<WorkspaceSnapshotRecord> {
    const outstandPeriod = OUTSTAND_PERIOD_BY_SNAPSHOT_PERIOD[input.period];

    let totalPosts = 0;
    let totalReach = 0;
    let totalEngagements = 0;

    for (const account of input.accounts) {
      const metrics = await this.outstandAdapter.fetchWorkspaceMetrics(
        account.outstandAccountId,
        outstandPeriod,
      );

      totalPosts += metrics.totalPosts;
      totalReach += metrics.totalReach;
      totalEngagements += metrics.totalEngagements;
    }

    const avgEngagementRate =
      totalReach > 0 ? Number((totalEngagements / totalReach).toFixed(4)) : 0;

    return this.repository.upsertWorkspaceSnapshot({
      workspaceId: input.workspaceId,
      period: input.period,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      totalPosts,
      totalReach,
      totalEngagements,
      avgEngagementRate,
      topPostId: input.topPostId ?? null,
    });
  }
}
