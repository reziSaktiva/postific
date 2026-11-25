import {
  asUserId,
  type CursorPage,
  type PageCursor,
  type UserId,
  type WorkspaceId,
} from "@postific/shared";

import { AnalyticsService } from "@/domains/analytics";
import { MediaService, type MediaThumbnailDto } from "@/domains/media";
import {
  PublishingService,
  type BoardColumnKey,
  type CalendarItemRecord,
  type HistoryItemRecord,
  type HistoryListItem,
  type PublishListFilter,
  type PublishListTab,
  type QueueItemRecord,
} from "@/domains/publishing";
import { supabaseMediaStorageAdapter } from "@/lib/adapters/media-storage/supabase-media-storage-adapter";
import { getCachedSession } from "@/lib/better-auth/session";
import { getMcpClientNamePort } from "@/lib/mcp-access/get-mcp-client-name-port";
import { analyticsRepository } from "@/lib/repositories/analytics";
import { mediaRepository } from "@/lib/repositories/media";
import { publishingRepository } from "@/lib/repositories/publishing";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";

import { resolvePostThumbnails } from "../preview/post-thumbnails";

/**
 * Pages of the Publish List tabs and Board columns (S-009, ADR-166), one
 * composition for both entry points: the RSC renders the first page with
 * it and the GET Route Handlers (`/api/publish/list`, `/api/publish/board`)
 * answer every next page with it, so both sides return the same shape.
 * Composition only: services are wired here and called; no rules live here
 * (hard rule 3).
 */

export interface PublishRequestContext {
  workspaceId: WorkspaceId;
  userId: UserId;
}

/** Workspace and user of the request; `null` without a session (no redirect). */
export async function getPublishRequestContext(): Promise<PublishRequestContext | null> {
  const session = await getCachedSession();
  if (!session) return null;
  const { workspaceId } = await getWorkspaceContext();
  return { workspaceId, userId: asUserId(session.user.id) };
}

function publishingService(): PublishingService {
  return new PublishingService(
    publishingRepository,
    new AnalyticsService(analyticsRepository),
    undefined,
    undefined,
    getMcpClientNamePort(),
  );
}

function mediaService(): MediaService {
  return new MediaService(mediaRepository, supabaseMediaStorageAdapter);
}

/** One page plus the card thumbnails of its items (History, Board). */
export interface PublishPage<T> extends CursorPage<T> {
  thumbnails: Record<string, MediaThumbnailDto>;
}

/** Item of each List tab page. */
export interface PublishListItemByTab {
  queue: QueueItemRecord;
  drafts: HistoryItemRecord;
  approvals: HistoryItemRecord;
  history: HistoryListItem;
}

export type PublishListPage = PublishPage<
  PublishListItemByTab[PublishListTab]
> & {
  /** True total of the tab under the filter; sent with a first page only. */
  total?: number;
};

async function withThumbnails<T extends CalendarItemRecord | HistoryItemRecord>(
  page: CursorPage<T>,
  context: PublishRequestContext,
): Promise<PublishPage<T>> {
  return {
    ...page,
    thumbnails: await resolvePostThumbnails(
      page.items,
      context.workspaceId,
      context.userId,
      mediaService(),
    ),
  };
}

/** One page of a List tab under `filter`; the first page also carries the tab total. */
export async function loadPublishListPage(
  context: PublishRequestContext,
  input: {
    tab: PublishListTab;
    filter: PublishListFilter;
    cursor: PageCursor | null;
  },
): Promise<PublishListPage> {
  const service = publishingService();
  const request = {
    workspaceId: context.workspaceId,
    filter: input.filter,
    cursor: input.cursor,
  };
  const total =
    input.cursor === null
      ? countPublishListTab(context, input)
      : Promise.resolve(undefined);

  let page: PublishPage<PublishListItemByTab[PublishListTab]>;
  switch (input.tab) {
    case "queue":
      page = {
        ...(await service.listQueuePage(request, context.userId)),
        thumbnails: {},
      };
      break;
    case "drafts":
      page = {
        ...(await service.listDraftsPage(request, context.userId)),
        thumbnails: {},
      };
      break;
    case "approvals":
      page = {
        ...(await service.listApprovalsPage(request, context.userId)),
        thumbnails: {},
      };
      break;
    case "history":
      // History cards show a thumbnail (S-008 design gap 2).
      page = await withThumbnails(
        await service.listHistoryPage(request, context.userId),
        context,
      );
      break;
  }
  const count = await total;
  return count === undefined ? page : { ...page, total: count };
}

/** True total of a List tab under `filter` (count query). */
export function countPublishListTab(
  context: PublishRequestContext,
  input: { tab: PublishListTab; filter: PublishListFilter },
): Promise<number> {
  return publishingService().countPublishTab(
    { workspaceId: context.workspaceId, ...input },
    context.userId,
  );
}

/** Next page of one Board column, with card thumbnails. */
export async function loadBoardColumnPage(
  context: PublishRequestContext,
  input: { column: BoardColumnKey; cursor: PageCursor },
): Promise<PublishPage<CalendarItemRecord>> {
  return withThumbnails(
    await publishingService().listBoardColumnPage(
      { workspaceId: context.workspaceId, ...input },
      context.userId,
    ),
    context,
  );
}

/** First page and true total of every Board column, with card thumbnails. */
export async function loadBoardColumns(context: PublishRequestContext) {
  const columns = await publishingService().listBoardColumns(
    context.workspaceId,
    context.userId,
  );
  const thumbnails = await resolvePostThumbnails(
    columns.flatMap((column) => column.page.items),
    context.workspaceId,
    context.userId,
    mediaService(),
  );
  return { columns, thumbnails };
}
