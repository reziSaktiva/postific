import {
  asConnectedAccountId,
  asPostId,
  asPostMetricsId,
  asWorkspaceId,
  asWorkspaceSnapshotId,
  type SocialPlatform,
} from "@postific/shared";
import type {
  IAnalyticsRepository,
  PostMetricsRecord,
  WorkspaceSnapshotRecord,
} from "@/domains/analytics";
import type {
  AnalyticsPostMetric,
  AnalyticsWorkspaceSnapshot,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";

function mapPostMetric(row: AnalyticsPostMetric): PostMetricsRecord {
  return {
    id: asPostMetricsId(row.id),
    postId: asPostId(row.postId),
    connectedAccountId: asConnectedAccountId(row.connectedAccountId),
    platform: row.platform as SocialPlatform,
    impressions: row.impressions,
    reach: row.reach,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    clicks: row.clicks,
    engagementRate: Number(row.engagementRate),
    fetchedAt: row.fetchedAt,
  };
}

function mapWorkspaceSnapshot(
  row: AnalyticsWorkspaceSnapshot,
): WorkspaceSnapshotRecord {
  return {
    id: asWorkspaceSnapshotId(row.id),
    workspaceId: asWorkspaceId(row.workspaceId),
    // Kolom DB adalah `String` bebas (lihat schema.prisma) — cast ke union
    // `SnapshotPeriod` domain aman karena satu-satunya writer (JOB-04,
    // T-041) wajib menulis salah satu dari dua nilai ini.
    period: row.period as WorkspaceSnapshotRecord["period"],
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    totalPosts: row.totalPosts,
    totalReach: Number(row.totalReach),
    totalEngagements: Number(row.totalEngagements),
    avgEngagementRate: Number(row.avgEngagementRate),
    topPostId: row.topPostId ? asPostId(row.topPostId) : null,
    createdAt: row.createdAt,
  };
}

export const analyticsRepository: IAnalyticsRepository = {
  async findMetricsByPost(postId) {
    const rows = await prisma.analyticsPostMetric.findMany({
      where: { postId },
      orderBy: { fetchedAt: "desc" },
    });

    return rows.map(mapPostMetric);
  },

  async findMetricsByPosts(postIds) {
    if (postIds.length === 0) {
      return [];
    }

    const rows = await prisma.analyticsPostMetric.findMany({
      where: { postId: { in: postIds } },
      orderBy: { fetchedAt: "desc" },
    });

    return rows.map(mapPostMetric);
  },

  async findLatestWorkspaceSnapshot(workspaceId, period) {
    const row = await prisma.analyticsWorkspaceSnapshot.findFirst({
      where: { workspaceId, period },
      orderBy: { periodStart: "desc" },
    });

    return row ? mapWorkspaceSnapshot(row) : null;
  },

  async upsertPostMetrics(input) {
    // Upsert lewat unique constraint `[postId, connectedAccountId]`
    // (migration 20260813023329, T-041) — ingestion ulang untuk post +
    // akun yang sama MENIMPA baris yang ada, bukan menyisipkan baris baru
    // (idempotensi, T-041.5).
    const row = await prisma.analyticsPostMetric.upsert({
      where: {
        postId_connectedAccountId: {
          postId: input.postId,
          connectedAccountId: input.connectedAccountId,
        },
      },
      create: {
        postId: input.postId,
        connectedAccountId: input.connectedAccountId,
        platform: input.platform,
        impressions: input.impressions,
        reach: input.reach,
        likes: input.likes,
        comments: input.comments,
        shares: input.shares,
        clicks: input.clicks,
        engagementRate: input.engagementRate,
        fetchedAt: input.fetchedAt,
      },
      update: {
        platform: input.platform,
        impressions: input.impressions,
        reach: input.reach,
        likes: input.likes,
        comments: input.comments,
        shares: input.shares,
        clicks: input.clicks,
        engagementRate: input.engagementRate,
        fetchedAt: input.fetchedAt,
      },
    });

    return mapPostMetric(row);
  },

  async upsertWorkspaceSnapshot(input) {
    // Upsert lewat unique constraint `[workspaceId, period, periodStart]`
    // (sudah ada sejak T-040) — ingestion ulang periode yang sama MENIMPA
    // snapshot yang ada, bukan menambah baris baru (idempotensi, T-041.5).
    const row = await prisma.analyticsWorkspaceSnapshot.upsert({
      where: {
        workspaceId_period_periodStart: {
          workspaceId: input.workspaceId,
          period: input.period,
          periodStart: input.periodStart,
        },
      },
      create: {
        workspaceId: input.workspaceId,
        period: input.period,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        totalPosts: input.totalPosts,
        totalReach: input.totalReach,
        totalEngagements: input.totalEngagements,
        avgEngagementRate: input.avgEngagementRate,
        topPostId: input.topPostId,
      },
      update: {
        periodEnd: input.periodEnd,
        totalPosts: input.totalPosts,
        totalReach: input.totalReach,
        totalEngagements: input.totalEngagements,
        avgEngagementRate: input.avgEngagementRate,
        topPostId: input.topPostId,
      },
    });

    return mapWorkspaceSnapshot(row);
  },
};
