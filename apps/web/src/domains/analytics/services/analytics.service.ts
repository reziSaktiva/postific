import type { PostId, UserId, WorkspaceId } from "@postific/shared";
import type {
  IAnalyticsRepository,
  PostMetricsRecord,
  WorkspaceSnapshotRecord,
} from "../repositories/analytics.repository";
import type { DashboardSummary, SnapshotPeriod } from "../types";

/**
 * Port lokal untuk cross-domain `analytics` → `workspace` (T-042.2,
 * AGENTS.md #7) — implementation detail `AnalyticsService`, bukan kontrak
 * publik domain `analytics`. Sengaja TIDAK `export` supaya tidak ikut
 * ke-export ulang lewat barrel `index.ts` (`export *`) — pola identik dengan
 * `ScheduledCountsPort` di `WorkspaceService` (`domains/workspace/services/
 * workspace.service.ts`). Caller (composition root Server Action, dan fake
 * port di test) cukup passing object/instance yang bentuknya cocok secara
 * struktural — `WorkspaceService` konkret TIDAK boleh diimport ke file ini.
 */
interface ActiveAccountsPort {
  countActiveConnectedAccounts(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<number>;
}

export class AnalyticsService {
  constructor(
    private readonly repository: IAnalyticsRepository,
    private readonly activeAccounts?: ActiveAccountsPort,
  ) {}

  /** Metrik performa per post (T-043 UI konsumsi lewat ini). */
  async getPostMetrics(postId: PostId): Promise<PostMetricsRecord[]> {
    return this.repository.findMetricsByPost(postId);
  }

  /**
   * Batch varian `getPostMetrics` (T-033.1, Calendar view — popover metrik
   * post Published, KSP-02-F08). Dikonsumsi lintas domain oleh
   * `PublishingService` lewat port lokal (`PostMetricsPort`, pola sama
   * `ScheduledCountsPort`/`ActiveAccountsPort`) supaya Calendar tidak
   * query metrik satu post per satu (N+1). Skip query kalau tidak ada
   * post yang perlu dicari metriknya.
   */
  async getPostMetricsByPosts(
    postIds: PostId[],
  ): Promise<Map<PostId, PostMetricsRecord[]>> {
    if (postIds.length === 0) {
      return new Map();
    }

    const rows = await this.repository.findMetricsByPosts(postIds);
    const grouped = new Map<PostId, PostMetricsRecord[]>();
    for (const row of rows) {
      const existing = grouped.get(row.postId);
      if (existing) {
        existing.push(row);
      } else {
        grouped.set(row.postId, [row]);
      }
    }
    return grouped;
  }

  /**
   * Ringkasan analytics workspace untuk Dashboard (T-042.2). Null berarti
   * belum ada snapshot untuk `period` ini sama sekali — caller (Server
   * Component) merender empty state (T-042.4), bukan angka nol.
   */
  async getWorkspaceSnapshot(
    workspaceId: WorkspaceId,
    period: SnapshotPeriod,
  ): Promise<WorkspaceSnapshotRecord | null> {
    return this.repository.findLatestWorkspaceSnapshot(workspaceId, period);
  }

  /**
   * Ringkasan Dashboard Home (T-042.2, KSP-01-F04 Analytics Snapshot):
   * `totalPosts`, `totalEngagements`, `avgEngagementRate` dari snapshot
   * workspace + `activeAccounts` dari `workspace` (via `ActiveAccountsPort`).
   * Null berarti belum ada snapshot untuk `period` ini sama sekali — caller
   * merender empty state (T-042.4) tanpa memanggil `activeAccounts` sama
   * sekali (menghindari query akun yang tidak akan ditampilkan).
   */
  async getDashboardSummary(
    workspaceId: WorkspaceId,
    period: SnapshotPeriod,
    userId: UserId,
  ): Promise<DashboardSummary | null> {
    const snapshot = await this.repository.findLatestWorkspaceSnapshot(
      workspaceId,
      period,
    );
    if (!snapshot) {
      return null;
    }

    if (!this.activeAccounts) {
      throw new Error(
        "AnalyticsService.getDashboardSummary requires an ActiveAccountsPort — none was provided to the constructor.",
      );
    }

    const activeAccounts =
      await this.activeAccounts.countActiveConnectedAccounts(
        workspaceId,
        userId,
      );

    return {
      totalPosts: snapshot.totalPosts,
      totalEngagements: snapshot.totalEngagements,
      avgEngagementRate: snapshot.avgEngagementRate,
      activeAccounts,
    };
  }

  /**
   * `getPostPerformance` (T-043.1) DIPINDAHKAN ke `PublishingService`
   * (2026-09-18, Ridwan Architecture Reviewer — temuan kritis circular
   * dependency `analytics` <-> `publishing`). Domain `publishing` SUDAH
   * lebih dulu memanggil `analytics` lewat `PostMetricsPort` (T-033.1,
   * `listCalendarPosts`/`getHistoryById`) — port lokal `PublishingHistoryPort`
   * yang tadinya ada di sini membuat dependency dua arah, melanggar
   * `application-layer.md` ("tidak ada circular dependency antar Bounded
   * Context"). Lihat `PublishingService.getPostPerformance` untuk logic
   * (join metrik + caption/akun) yang sekarang hidup di domain `publishing`,
   * satu arah `publishing -> analytics` lewat `PostMetricsPort` yang sudah
   * ada (reuse `getPostMetricsByPosts`, method di bawah).
   */
}
