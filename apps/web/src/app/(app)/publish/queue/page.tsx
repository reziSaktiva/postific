import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { PublishingService } from "@/domains/publishing";
import { getCachedSession } from "@/lib/better-auth/session";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { publishingRepository } from "@/lib/repositories/publishing";

import { QueueScreen } from "./components/QueueScreen";

export default async function Page() {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const publishingService = new PublishingService(publishingRepository);
  const groups = await publishingService.listQueue(
    workspaceId,
    asUserId(session.user.id),
  );

  // QueueScreen (client) owns Cancel Schedule dialog state (T-030, T-032.4)
  // dan wires it into QueueList's onCancelSchedule prop. `workspaceId`
  // (T-092.4) dipakai QueueScreen untuk subscribe
  // `usePublishingPostsRealtime`, bukan untuk fetch data apa pun langsung
  // di komponen itu (AGENTS.md #5).
  return <QueueScreen groups={groups} workspaceId={workspaceId} />;
}
