import type {
  ConnectedAccountId,
  PostId,
  PostMetricsId,
  SocialPlatform,
  WorkspaceId,
  WorkspaceSnapshotId,
} from "@postific/shared";
import type { SnapshotPeriod } from "../types";

export interface PostMetricsRecord {
  id: PostMetricsId;
  postId: PostId;
  connectedAccountId: ConnectedAccountId;
  platform: SocialPlatform;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number | null;
  engagementRate: number;
  fetchedAt: Date;
}

export interface WorkspaceSnapshotRecord {
  id: WorkspaceSnapshotId;
  workspaceId: WorkspaceId;
  period: SnapshotPeriod;
  periodStart: Date;
  periodEnd: Date;
  totalPosts: number;
  totalReach: number;
  totalEngagements: number;
  avgEngagementRate: number;
  topPostId: PostId | null;
  createdAt: Date;
}

/** Input upsert satu baris metrik post (T-041.2/T-041.5). */
export interface UpsertPostMetricInput {
  postId: PostId;
  connectedAccountId: ConnectedAccountId;
  platform: SocialPlatform;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number | null;
  engagementRate: number;
  fetchedAt: Date;
}

/** Input upsert satu snapshot agregat workspace (T-041.4/T-041.5). */
export interface UpsertWorkspaceSnapshotInput {
  workspaceId: WorkspaceId;
  period: SnapshotPeriod;
  periodStart: Date;
  periodEnd: Date;
  totalPosts: number;
  totalReach: number;
  totalEngagements: number;
  avgEngagementRate: number;
  topPostId: PostId | null;
}

/**
 * Repository interface — implementation (Prisma) lives in
 * src/lib/repositories/analytics.
 *
 * T-040 (skeleton) hanya menyediakan read path yang dipakai kontrak
 * `AnalyticsService` di `application-layer.md` (`getPostMetrics`,
 * `getWorkspaceSnapshot`). T-041 menambah write path untuk ingestion
 * (`upsertPostMetrics`, `upsertWorkspaceSnapshot`, JOB-04) — keduanya WAJIB
 * upsert (bukan insert biasa) supaya ingestion ulang periode/post yang sama
 * tidak menggandakan angka (idempotensi, T-041.5).
 */
export interface IAnalyticsRepository {
  /** Semua metrik (satu baris per target/platform) untuk satu post. */
  findMetricsByPost(postId: PostId): Promise<PostMetricsRecord[]>;

  /**
   * Batch varian `findMetricsByPost` untuk beberapa post sekaligus
   * (T-033.1, Calendar view — popover metrik post Published, KSP-02-F08).
   * Dipakai lewat `getPostMetricsByPosts` supaya caller lintas domain
   * (`PublishingService`, via port lokal) tidak N+1 query satu post per
   * item Calendar. Returns flat array (bukan grouped) — pengelompokan per
   * `postId` jadi tanggung jawab `AnalyticsService.getPostMetricsByPosts`.
   */
  findMetricsByPosts(postIds: PostId[]): Promise<PostMetricsRecord[]>;

  /**
   * Snapshot workspace terbaru untuk `period` tertentu (`periodStart`
   * paling akhir). Null kalau belum ada snapshot untuk period tsb —
   * dipakai Application Service untuk membedakan "belum ada data metrik
   * sama sekali" (empty state, T-042.4) dari data kosong secara sah.
   */
  findLatestWorkspaceSnapshot(
    workspaceId: WorkspaceId,
    period: SnapshotPeriod,
  ): Promise<WorkspaceSnapshotRecord | null>;

  /**
   * Upsert satu baris metrik post per (postId, connectedAccountId) —
   * dipanggil `AnalyticsIngestionUseCase` (T-041.2) per target post yang
   * di-fetch dari `IOutstandAdapter.fetchPostMetrics`. Idempoten: panggilan
   * berulang dengan input yang sama menghasilkan baris yang identik (bukan
   * baris baru).
   */
  upsertPostMetrics(input: UpsertPostMetricInput): Promise<PostMetricsRecord>;

  /**
   * Upsert satu snapshot agregat workspace per (workspaceId, period,
   * periodStart) — dipanggil `AnalyticsIngestionUseCase` (T-041.4).
   * Idempoten lewat unique constraint `[workspaceId, period, periodStart]`
   * yang sudah ada sejak T-040 (schema.prisma).
   */
  upsertWorkspaceSnapshot(
    input: UpsertWorkspaceSnapshotInput,
  ): Promise<WorkspaceSnapshotRecord>;
}
