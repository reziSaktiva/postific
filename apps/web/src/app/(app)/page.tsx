import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { AnalyticsService } from "@/domains/analytics";
import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { analyticsRepository } from "@/lib/repositories/analytics";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";

import { DashboardHome } from "./components/DashboardHome";

import type { SnapshotPeriod } from "@/domains/analytics";

const DEFAULT_PERIOD: SnapshotPeriod = "weekly";

/**
 * Dashboard Home (`/`, T-042.2, KSP-01-F04) — composition root tipis: pure
 * read, jadi panggil `AnalyticsService.getDashboardSummary` langsung dari
 * Server Component (RS-D02, `rendering-strategy.md`), bukan lewat Server
 * Action `getDashboardSummaryAction` (exception pra-existing, KI-036,
 * T-094.4). Pola sama dengan `publish/calendar/page.tsx`. Server Action
 * `getDashboardSummaryAction` tetap dipakai di `DashboardHome` untuk
 * re-fetch client-side saat selector period (T-042.5) berubah — itu bukan
 * initial render dari Server Component, jadi tidak termasuk exception ini.
 */
export default async function Page() {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const analyticsService = new AnalyticsService(
    analyticsRepository,
    new WorkspaceService(workspaceRepository),
  );

  const summary = await analyticsService.getDashboardSummary(
    workspaceId,
    DEFAULT_PERIOD,
    asUserId(session.user.id),
  );

  return (
    <DashboardHome initialPeriod={DEFAULT_PERIOD} initialSummary={summary} />
  );
}
