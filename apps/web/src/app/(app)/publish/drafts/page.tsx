import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { PublishingService } from "@/domains/publishing";
import { getCachedSession } from "@/lib/better-auth/session";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { publishingRepository } from "@/lib/repositories/publishing";

import { DraftsList } from "./components/DraftsList";

export default async function Page() {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const publishingService = new PublishingService(publishingRepository);
  const drafts = await publishingService.listDrafts(
    workspaceId,
    asUserId(session.user.id),
  );

  // `DraftsList` (client) subscribe `usePublishingPostsRealtime` (T-092.5,
  // ADR-094 poin 5, 6) — `workspaceId` dipakai untuk subscribe channel
  // `publishing_posts:{workspaceId}`, bukan untuk fetch data apa pun
  // langsung di komponen itu (AGENTS.md #5).
  return <DraftsList drafts={drafts} workspaceId={workspaceId} />;
}
