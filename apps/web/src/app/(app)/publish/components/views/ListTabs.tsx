import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import {
  EMPTY_PUBLISH_LIST_FILTER,
  GetBestTimeSuggestionsUseCase,
  PublishingService,
  type HistoryItemRecord,
  type HistoryListItem,
  type PublishListTab,
} from "@/domains/publishing";
import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { getMcpClientNamePort } from "@/lib/mcp-access/get-mcp-client-name-port";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";

import { BestTimeSuggestionsUseCase } from "@/domains/analytics";
import { analyticsRepository } from "@/lib/repositories/analytics";

import { ApprovalsList } from "../../approvals/components/ApprovalsList";
import { DraftsList } from "../../drafts/components/DraftsList";
import { HistoryList } from "../../history/components/HistoryList";
import { FETCHED_SUGGESTIONS_PER_ACCOUNT } from "../../queue/components/queue-suggestions";
import { QueueScreen } from "../../queue/components/QueueScreen";
import type { ListFilterAccount } from "./ListFilter";
import {
  countPublishListTab,
  getPublishRequestContext,
  loadPublishListPage,
  type PublishRequestContext,
} from "./publish-list-pages";
import type { PublishTabPage } from "./usePublishTabList";

/**
 * List tabs of the Publish page (T-286, T-289). Composition only: each tab
 * renders the first page of its list (S-009, `loadPublishListPage`, the
 * same composition the `GET /api/publish/list` Route Handler uses for the
 * next pages) and hands it to its client list (hard rule 3).
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
  const context = await requirePublishContext();
  const { publishingService } = await getListContext();
  // First page, and best-time suggestions only when nothing at all is
  // scheduled (T-291), plus the true total (S-009).
  const [{ page, suggestions }, total] = await Promise.all([
    publishingService.getQueuePageWithSuggestions(
      context.workspaceId,
      context.userId,
      timeZone,
      new GetBestTimeSuggestionsUseCase(
        new BestTimeSuggestionsUseCase(analyticsRepository),
        new WorkspaceService(workspaceRepository),
      ),
      FETCHED_SUGGESTIONS_PER_ACCOUNT,
    ),
    countPublishListTab(context, {
      tab: "queue",
      filter: EMPTY_PUBLISH_LIST_FILTER,
    }),
  ]);
  return (
    <QueueScreen
      initialPage={{ ...page, total }}
      workspaceId={context.workspaceId}
      suggestions={suggestions}
    />
  );
}

export async function DraftsTab() {
  const context = await requirePublishContext();
  const page = await firstPage(context, "drafts");
  return (
    <DraftsList
      initialPage={page as PublishTabPage<HistoryItemRecord>}
      workspaceId={context.workspaceId}
    />
  );
}

export async function ApprovalsTab() {
  const context = await requirePublishContext();
  const page = await firstPage(context, "approvals");
  return (
    <ApprovalsList
      initialPage={page as PublishTabPage<HistoryItemRecord>}
      workspaceId={context.workspaceId}
    />
  );
}

export async function HistoryTab() {
  const context = await requirePublishContext();
  // History cards show stored metrics and thumbnails (S-008 design gap 2).
  const page = await firstPage(context, "history");

  // `renderedAt` (KI-052): one timestamp for `formatRelativeTime`, so server
  // and browser render the same "N menit lalu" text.
  const renderedAt = new Date().toISOString();

  return (
    <HistoryList
      initialPage={page as PublishTabPage<HistoryListItem>}
      workspaceId={context.workspaceId}
      renderedAt={renderedAt}
    />
  );
}

/** Workspace and user of the page; redirects to login without a session. */
async function requirePublishContext(): Promise<PublishRequestContext> {
  const context = await getPublishRequestContext();
  if (!context) {
    redirect("/login");
  }
  return context;
}

/** First page of a tab (no filter), with its true total (S-009). */
function firstPage(context: PublishRequestContext, tab: PublishListTab) {
  return loadPublishListPage(context, {
    tab,
    filter: EMPTY_PUBLISH_LIST_FILTER,
    cursor: null,
  });
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
