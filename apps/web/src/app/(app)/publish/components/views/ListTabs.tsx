import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import {
  GetBestTimeSuggestionsUseCase,
  PublishingService,
} from "@/domains/publishing";
import { MediaService } from "@/domains/media";
import { WorkspaceService } from "@/domains/workspace";
import { supabaseMediaStorageAdapter } from "@/lib/adapters/media-storage/supabase-media-storage-adapter";
import { getCachedSession } from "@/lib/better-auth/session";
import { getMcpClientNamePort } from "@/lib/mcp-access/get-mcp-client-name-port";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { mediaRepository } from "@/lib/repositories/media";
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
import { resolvePostThumbnails } from "../preview/post-thumbnails";
import type { ListFilterAccount } from "./ListFilter";

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
  const { groups, suggestions } =
    await publishingService.getQueueWithSuggestions(
      workspaceId,
      userId,
      timeZone,
      new GetBestTimeSuggestionsUseCase(
        new BestTimeSuggestionsUseCase(analyticsRepository),
        new WorkspaceService(workspaceRepository),
      ),
      FETCHED_SUGGESTIONS_PER_ACCOUNT,
    );
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
  const drafts = await publishingService.listDraftsTab(workspaceId, userId);
  return <DraftsList drafts={drafts} workspaceId={workspaceId} />;
}

export async function ApprovalsTab() {
  const { workspaceId, userId, publishingService } = await getListContext();
  const approvals = await publishingService.listApprovals(workspaceId, userId);
  // Account row of each card (S-008 design gap 3): the repository returns
  // the In Review posts with their targets in one query.
  const items = approvals.map((post) => ({
    id: post.id,
    caption: post.caption,
    status: post.status,
    updatedAt: post.updatedAt,
    createdVia: post.createdVia,
    createdViaClientName: post.createdViaClientName,
    targets: post.targets.map((target) => ({
      id: target.id,
      connectedAccountId: target.connectedAccountId,
      platform: target.platform,
      accountHandle: target.accountHandle,
    })),
  }));
  return <ApprovalsList items={items} workspaceId={workspaceId} />;
}

export async function HistoryTab() {
  const { workspaceId, userId } = await getListContext();
  // History cards show stored metrics, so this tab needs the analytics port.
  const historyService = new PublishingService(
    publishingRepository,
    new AnalyticsService(analyticsRepository),
    undefined,
    undefined,
    getMcpClientNamePort(),
  );

  const items = await historyService.listHistoryWithMetrics(
    workspaceId,
    userId,
  );
  // Card thumbnails (S-008 design gap 2): one batched lookup, first media of
  // a post or the stored thumbnail of an imported post (ADR-158).
  const thumbnails = await resolvePostThumbnails(
    items,
    workspaceId,
    userId,
    new MediaService(mediaRepository, supabaseMediaStorageAdapter),
  );

  // `renderedAt` (KI-052): one timestamp for `formatRelativeTime`, so server
  // and browser render the same "N menit lalu" text.
  const renderedAt = new Date().toISOString();

  return (
    <HistoryList
      items={items}
      thumbnails={thumbnails}
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

/** Channels of the List Filter popover: the workspace's connected accounts. */
export async function getPublishListFilterAccounts(): Promise<
  ListFilterAccount[]
> {
  const { workspaceId, userId } = await getListContext();
  const accounts = await new WorkspaceService(
    workspaceRepository,
  ).listConnectedAccounts(workspaceId, userId);
  return accounts.map((account) => ({
    id: account.id,
    handle: account.handle,
    platform: account.platform,
  }));
}
