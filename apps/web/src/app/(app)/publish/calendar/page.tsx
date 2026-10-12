import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { AnalyticsService } from "@/domains/analytics";
import {
  getMonthRange,
  getWeekRange,
  parseCalendarViewState,
  PublishingService,
} from "@/domains/publishing";
import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { analyticsRepository } from "@/lib/repositories/analytics";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";

import { CalendarScreen } from "./components/CalendarScreen";

type CalendarPageSearchParams = {
  view?: string | string[];
  date?: string | string[];
  status?: string | string[];
  accounts?: string | string[];
};

/**
 * `/publish/calendar` (T-033.2/.3/.4/.6, ADR-046 — route tunggal, tidak ada
 * `/publish/calendar/week` dst.). Entry point tipis: baca `searchParams`
 * mentah, delegasikan parsing & fallback ke `parseCalendarViewState`,
 * hitung rentang tanggal via `getWeekRange`/`getMonthRange`, lalu panggil
 * `PublishingService.listCalendarPosts` dengan `statuses`/
 * `connectedAccountIds` (T-033.6) — semua pure function/Application
 * Service domain `publishing`, tidak ada business logic di sini
 * (AGENTS.md #5). `PublishingService` diinstansiasi dengan
 * `AnalyticsService` sebagai `PostMetricsPort` (T-033.8, port lokal cross-
 * domain `publishing` → `analytics`, AGENTS.md #7) supaya `metrics` post
 * Published terisi untuk Popover.
 *
 * `WorkspaceService.listConnectedAccounts` (T-033.6) dipanggil di sini,
 * bukan di dalam domain `publishing` — cross-domain lewat public API
 * module lain (AGENTS.md #7), pola yang sama dengan `draft-editor/actions.ts`.
 * Daftar akun lengkap ini (bukan hasil derive dari `items` yang sudah
 * terfilter) supaya dropdown filter Channels tidak kehilangan opsi saat
 * filter status/akun aktif menyempitkan hasil.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<CalendarPageSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const { view, date, statuses, connectedAccountIds } =
    parseCalendarViewState(resolvedSearchParams);

  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const userId = asUserId(session.user.id);

  const { from, to } =
    view === "month" ? getMonthRange(date) : getWeekRange(date);

  const publishingService = new PublishingService(
    publishingRepository,
    new AnalyticsService(analyticsRepository),
  );
  const workspaceService = new WorkspaceService(workspaceRepository);

  const [items, accounts] = await Promise.all([
    publishingService.listCalendarPosts(
      { workspaceId, from, to, statuses, connectedAccountIds },
      userId,
    ),
    workspaceService.listConnectedAccounts(workspaceId, userId),
  ]);

  return (
    <CalendarScreen
      view={view}
      date={date}
      items={items}
      accounts={accounts}
      statuses={statuses}
      connectedAccountIds={connectedAccountIds}
      workspaceId={workspaceId}
    />
  );
}
