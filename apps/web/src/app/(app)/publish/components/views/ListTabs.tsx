import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import {
  APPROVAL_LIST_STATUSES,
  DRAFT_LIST_STATUSES,
  GetBestTimeSuggestionsUseCase,
  PublishingService,
} from "@/domains/publishing";
import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { getMcpClientNamePort } from "@/lib/mcp-access/get-mcp-client-name-port";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";

import {
  AnalyticsService,
  BestTimeSuggestionsUseCase,
} from "@/domains/analytics";
import { analyticsRepository } from "@/lib/repositories/analytics";

import { ApprovalsList } from "../../approvals/components/ApprovalsList";
import { DraftsList } from "../../drafts/components/DraftsList";
import { HistoryList } from "../../history/components/HistoryList";
import { FETCHED_SUGGESTIONS_PER_ACCOUNT } from "../../queue/components/queue-suggestions";
import { QueueScreen } from "../../queue/components/QueueScreen";

/**
 * List tabs of the Publish page (T-286): the Queue, Drafts and History
 * screens moved from their old routes as they are (T-289 redesigns them).
 * Composition only, each tab calls its Application Service (hard rule 3).
 */

async function getListContext() {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const publishingService = new PublishingService(
    publishingRepository,
    undefined,
    undefined,
    undefined,
    getMcpClientNamePort(),
  );
  return { workspaceId, userId: asUserId(session.user.id), publishingService };
}

export async function QueueTab({ timeZone }: { timeZone: string }) {
  const { workspaceId, userId, publishingService } = await getListContext();
  // Group date keys use the display time zone of the Publish page (T-147,
  // T-286); the Profile zone when none is picked.
  const groups = await publishingService.listQueue(
    workspaceId,
    userId,
    timeZone,
  );
  // Best-time suggestions only when nothing is scheduled (T-291); an empty
  // result is the normal empty state. Outstand is not called.
  const suggestions =
    groups.length === 0
      ? await new GetBestTimeSuggestionsUseCase(
          new BestTimeSuggestionsUseCase(analyticsRepository),
          new WorkspaceService(workspaceRepository),
        ).execute({
          workspaceId,
          userId,
          timezone: timeZone,
          limitPerAccount: FETCHED_SUGGESTIONS_PER_ACCOUNT,
        })
      : [];
  return (
    <QueueScreen
      groups={groups}
      workspaceId={workspaceId}
      suggestions={suggestions}
    />
  );
}

export async function DraftsTab() {
  const { workspaceId, userId, publishingService } = await getListContext();
  // `listDrafts` returns Draft, Ready to Schedule and In Review; the list
  // keeps what its tab shows and live-patches the rest (T-289).
  const drafts = await publishingService.listDrafts(workspaceId, userId);
  return (
    <DraftsList
      drafts={drafts.filter((post) => DRAFT_LIST_STATUSES.has(post.status))}
      workspaceId={workspaceId}
    />
  );
}

export async function ApprovalsTab() {
  const { workspaceId, userId, publishingService } = await getListContext();
  const drafts = await publishingService.listDrafts(workspaceId, userId);
  return (
    <ApprovalsList
      items={drafts.filter((post) => APPROVAL_LIST_STATUSES.has(post.status))}
      workspaceId={workspaceId}
    />
  );
}

export async function HistoryTab() {
  const { workspaceId, userId } = await getListContext();
  const workspaceService = new WorkspaceService(workspaceRepository);
  // History cards show stored metrics, so this tab needs the analytics port.
  const historyService = new PublishingService(
    publishingRepository,
    new AnalyticsService(analyticsRepository),
    undefined,
    undefined,
    getMcpClientNamePort(),
  );

  const [items, accounts] = await Promise.all([
    historyService.listHistoryWithMetrics(workspaceId, userId),
    workspaceService.listConnectedAccounts(workspaceId, userId),
  ]);

  // `renderedAt` (KI-052): one timestamp for `formatRelativeTime`, so server
  // and browser render the same "N menit lalu" text.
  const renderedAt = new Date().toISOString();

  return (
    <HistoryList
      items={items}
      accounts={accounts}
      workspaceId={workspaceId}
      renderedAt={renderedAt}
    />
  );
}

/**
 * Counts for the List tab labels (T-289). `page.tsx` (calendar lane) calls
 * this and hands the result to `PublishToolbar` as `counts`.
 */
export async function getPublishListTabCounts() {
  const { workspaceId, userId, publishingService } = await getListContext();
  return publishingService.getListTabCounts(workspaceId, userId);
}
