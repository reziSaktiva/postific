import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { PublishingService } from "@/domains/publishing";
import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { getMcpClientNamePort } from "@/lib/mcp-access/get-mcp-client-name-port";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";

import { DraftsList } from "../../drafts/components/DraftsList";
import { HistoryList } from "../../history/components/HistoryList";
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
  return <QueueScreen groups={groups} workspaceId={workspaceId} />;
}

export async function DraftsTab() {
  const { workspaceId, userId, publishingService } = await getListContext();
  const drafts = await publishingService.listDrafts(workspaceId, userId);
  return <DraftsList drafts={drafts} workspaceId={workspaceId} />;
}

export async function HistoryTab() {
  const { workspaceId, userId, publishingService } = await getListContext();
  const workspaceService = new WorkspaceService(workspaceRepository);

  const [items, accounts] = await Promise.all([
    publishingService.listHistory({ workspaceId }, userId),
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
