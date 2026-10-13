// Route `/analyze` (T-043.2 + T-046.2 + T-047.1 + T-044 + T-045, KSP-07
// Analyze → Dashboard) — Server Component tipis: panggil Server Action
// `getPostPerformanceAction`, `getAccountOverviewAction`,
// `getAnalyzeSummaryAction` (T-047.1 — summary row 3 stat card),
// `getEngagementSummaryAction` (T-044 — card "Engagement Summary", kolom
// kanan `.dash-cols`), DAN `getComparativeReportAction` (T-045 — tab
// "Reports", Comparative Reports) dengan period default ("weekly", sama
// seperti Dashboard Home T-042.3) lalu delegasikan rendering + interaktivitas
// (selector rentang waktu, sort, switch tab Overview/Reports) ke
// `AnalyzeDashboard` (Client Component). Kelima action dipanggil paralel
// (`Promise.all`) — sama-sama scoped `workspaceId` + `period` yang sama,
// tidak saling depend; data untuk kedua tab di-fetch sekaligus supaya switch
// tab murni client-side tanpa re-fetch.
import { AnalyzeDashboard } from "./components/AnalyzeDashboard";
import {
  getAccountOverviewAction,
  getAnalyzeSummaryAction,
  getComparativeReportAction,
  getEngagementSummaryAction,
  getPostPerformanceAction,
} from "./analyze-actions";

import type { SnapshotPeriod } from "@/domains/analytics";

const INITIAL_PERIOD: SnapshotPeriod = "weekly";

export default async function Page() {
  // Satu `now` dibagikan ke kelima action (T-045/T-046/T-047 clock-sharing)
  // — tanpa ini masing-masing action resolve `new Date()` sendiri-sendiri
  // di server, dan post yang publish di antara panggilan bisa terhitung di
  // satu card tapi tidak di card lain pada load yang sama.
  const now = new Date();
  const [
    postPerformanceRows,
    accountOverviewRows,
    summary,
    engagementSummary,
    comparativeReport,
  ] = await Promise.all([
    getPostPerformanceAction(INITIAL_PERIOD, now),
    getAccountOverviewAction(INITIAL_PERIOD, now),
    getAnalyzeSummaryAction(INITIAL_PERIOD, now),
    getEngagementSummaryAction(INITIAL_PERIOD, now),
    getComparativeReportAction(INITIAL_PERIOD, now),
  ]);

  return (
    <AnalyzeDashboard
      initialPeriod={INITIAL_PERIOD}
      initialRows={postPerformanceRows}
      initialAccountOverviewRows={accountOverviewRows}
      initialSummary={summary}
      initialEngagementSummary={engagementSummary}
      initialComparativeReport={comparativeReport}
    />
  );
}
