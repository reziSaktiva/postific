"use server";

import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import type { SnapshotPeriod } from "@/domains/analytics";
import { AnalyticsService } from "@/domains/analytics";
import type {
  AccountOverviewRow,
  AnalyzeSummary,
  ComparativeReport,
  EngagementSummary,
  PostPerformanceRow,
} from "@/domains/publishing";
import { PublishingService } from "@/domains/publishing";
import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { analyticsRepository } from "@/lib/repositories/analytics";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";

/**
 * Server Action untuk halaman `/analyze` — Post Performance (T-043.1,
 * KSP-07 Analyze → Dashboard). Dikonsumsi UI Table sortable T-043.2 (Mark
 * UI Engineer), yang tinggal memanggil ulang action ini dengan `period`
 * lain saat selector rentang waktu diganti — sama pola dengan
 * `getDashboardSummaryAction` (Dashboard Home, T-042.2).
 *
 * **Composition root dibalik (2026-09-18, refactor Temuan 1 Ridwan
 * Architecture Reviewer — circular dependency `analytics` <-> `publishing`):**
 * `getPostPerformance` sekarang hidup di `PublishingService`, dengan
 * `AnalyticsService` disuplai sebagai `PostMetricsPort` — pola identik
 * composition root History (`publish/history/[postId]/page.tsx`, T-043.3),
 * BUKAN lagi `AnalyticsService` dengan `PublishingService` sebagai
 * `PublishingHistoryPort` (arah lama yang menyebabkan circular dependency).
 * Orkestrasi tipis saja: resolve workspace context, wire service, lalu
 * delegasikan. Semua logic (join metrik + caption/akun, filter rentang
 * tanggal period, empty state, sorting) hidup di service, bukan di sini.
 *
 * `asOf` WAJIB (bukan opsional, review finding 2026-09-22 — T-045/T-046/
 * T-047 clock-sharing): kelima action di file ini dipanggil bersamaan
 * (`Promise.all`, `page.tsx`/`AnalyzeDashboard.tsx`) dan harus sepakat soal
 * "now" yang sama, supaya kartu yang refresh bareng tidak berbeda pendapat
 * soal post mana yang masuk periode "current". Membuatnya wajib di sini
 * (bukan cuma di `PublishingService`, yang tetap opsional untuk caller lain/
 * test) memberi sinyal compile-time kalau ada action baru di halaman ini
 * lupa menerima `asOf` dari composition root.
 */
export async function getPostPerformanceAction(
  period: SnapshotPeriod,
  asOf: Date,
): Promise<PostPerformanceRow[]> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const publishingService = new PublishingService(
    publishingRepository,
    new AnalyticsService(analyticsRepository),
  );

  return publishingService.getPostPerformance(
    workspaceId,
    period,
    asUserId(session.user.id),
    asOf,
  );
}

/**
 * Server Action untuk halaman `/analyze` — Account Overview (T-046.1,
 * KSP-07 Analyze → Dashboard). Dikonsumsi UI bar `Progress` T-046.2 (Mark
 * UI Engineer), pola pemanggilan ulang saat selector period diganti sama
 * dengan `getPostPerformanceAction` di atas.
 *
 * Composition root cross-domain ganda: `PublishingService` disuplai
 * `AnalyticsService` sebagai `PostMetricsPort` (`publishing -> analytics`,
 * pola sama `getPostPerformanceAction`) DAN `WorkspaceService` sebagai
 * `ConnectedAccountsPort` (`publishing -> workspace`, arah yang SUDAH legal
 * di `application-layer.md` — "verifikasi ConnectedAccount"). Orkestrasi
 * tipis saja: resolve workspace context, wire service, delegasikan. Semua
 * logic (agregasi per akun, kriteria "belum ada data" T-046) hidup di
 * `PublishingService.getAccountOverview`, bukan di sini.
 */
export async function getAccountOverviewAction(
  period: SnapshotPeriod,
  asOf: Date,
): Promise<AccountOverviewRow[]> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const publishingService = new PublishingService(
    publishingRepository,
    new AnalyticsService(analyticsRepository),
    new WorkspaceService(workspaceRepository),
  );

  return publishingService.getAccountOverview(
    workspaceId,
    period,
    asUserId(session.user.id),
    asOf,
  );
}

/**
 * Server Action untuk halaman `/analyze` — Summary row 3 stat card
 * (T-047.1, KSP-07 Analyze → Dashboard). Dikonsumsi UI `StatTile` T-047.2
 * (Mark UI Engineer), pola pemanggilan ulang saat selector period diganti
 * sama dengan `getPostPerformanceAction`/`getAccountOverviewAction` di atas.
 *
 * Composition root LEBIH SEDERHANA dari `getAccountOverviewAction` — tidak
 * ada `WorkspaceService`/`ConnectedAccountsPort` karena
 * `PublishingService.getAnalyzeSummary` tidak membutuhkannya (lihat catatan
 * `AnalyzeSummary`). `AnalyticsService` tetap disuplai sebagai
 * `PostMetricsPort` (`publishing -> analytics`, pola sama dua action di
 * atas) karena `getAnalyzeSummary` reuse `getPostPerformance`. Orkestrasi
 * tipis saja: resolve workspace context, wire service, delegasikan.
 */
export async function getAnalyzeSummaryAction(
  period: SnapshotPeriod,
  asOf: Date,
): Promise<AnalyzeSummary> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const publishingService = new PublishingService(
    publishingRepository,
    new AnalyticsService(analyticsRepository),
  );

  return publishingService.getAnalyzeSummary(
    workspaceId,
    period,
    asUserId(session.user.id),
    asOf,
  );
}

/**
 * Server Action untuk halaman `/analyze` — card "Engagement Summary"
 * (T-044). Dikonsumsi UI (Mark UI Engineer) dengan pola pemanggilan ulang
 * saat selector period diganti, sama dengan action lain di file ini.
 *
 * Scope T-044 dipersempit lewat `AskUserQuestion` ke King Rezi (lihat
 * catatan lengkap di `PublishingService`/`EngagementSummary`) — cuma
 * `totalComments`/`totalLikes` mengikuti markup locked Claude Design,
 * BUKAN versi kompleks (komentar masuk/dibalas/rasio respons dari domain
 * `engagement`) di task doc asli.
 *
 * Composition root SAMA PERSIS `getAnalyzeSummaryAction` di atas — tidak
 * ada `WorkspaceService`/`ConnectedAccountsPort`, `AnalyticsService` tetap
 * disuplai sebagai `PostMetricsPort` (`publishing -> analytics`) karena
 * `getEngagementSummary` reuse `getPostPerformance`. Orkestrasi tipis saja:
 * resolve workspace context, wire service, delegasikan.
 */
export async function getEngagementSummaryAction(
  period: SnapshotPeriod,
  asOf: Date,
): Promise<EngagementSummary> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const publishingService = new PublishingService(
    publishingRepository,
    new AnalyticsService(analyticsRepository),
  );

  return publishingService.getEngagementSummary(
    workspaceId,
    period,
    asUserId(session.user.id),
    asOf,
  );
}

/**
 * Server Action untuk halaman `/analyze` — tab "Reports" Comparative
 * Reports (T-045.1/T-045.2, KSP-07 Analyze → Dashboard). Dikonsumsi UI
 * (Mark UI Engineer) dengan pola pemanggilan ulang saat selector period
 * diganti, sama dengan action lain di file ini. T-045.3 (Export CSV)
 * sengaja TIDAK punya action di sini — generate CSV di client dari data
 * yang sudah di-fetch action ini, bukan endpoint export terpisah.
 *
 * Composition root SAMA PERSIS `getAccountOverviewAction` di atas —
 * `PublishingService` disuplai `AnalyticsService` sebagai `PostMetricsPort`
 * (`publishing -> analytics`) DAN `WorkspaceService` sebagai
 * `ConnectedAccountsPort` (`publishing -> workspace`), karena
 * `getComparativeReport` butuh keduanya (reuse `getPostPerformance` +
 * daftar akun lengkap workspace, lihat catatan `ComparativeReport`).
 * Orkestrasi tipis saja: resolve workspace context, wire service,
 * delegasikan. Semua logic (rentang periode sebelumnya, agregasi
 * current/previous, kriteria "belum ada data") hidup di
 * `PublishingService.getComparativeReport`, bukan di sini.
 */
export async function getComparativeReportAction(
  period: SnapshotPeriod,
  asOf: Date,
): Promise<ComparativeReport> {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const publishingService = new PublishingService(
    publishingRepository,
    new AnalyticsService(analyticsRepository),
    new WorkspaceService(workspaceRepository),
  );

  return publishingService.getComparativeReport(
    workspaceId,
    period,
    asUserId(session.user.id),
    asOf,
  );
}
