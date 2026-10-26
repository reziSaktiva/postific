"use server";

import { asUserId, asWorkspaceId, MemberStatus } from "@postific/shared";

import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import {
  mcpSpikeEnabled,
  rememberWorkspaceChoice,
} from "@/lib/better-auth/mcp-spike";
import { workspaceRepository } from "@/lib/repositories/workspace";

// T-148 (spike MCP) — SEMENTARA, digantikan T-151.
export async function chooseWorkspaceAction(
  workspaceId: string,
): Promise<{ ok: boolean }> {
  const session = await getCachedSession();
  if (!mcpSpikeEnabled() || !session) {
    return { ok: false };
  }

  const membership = await new WorkspaceService(
    workspaceRepository,
  ).getMembership(asWorkspaceId(workspaceId), asUserId(session.user.id));
  if (!membership || membership.status !== MemberStatus.Active) {
    return { ok: false };
  }

  rememberWorkspaceChoice(session.session.id, workspaceId);
  return { ok: true };
}
