import type { MemberRole, WorkspaceId } from "@postific/shared";
import { asWorkspaceId } from "@postific/shared";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  WORKSPACE_ID_HEADER,
  WORKSPACE_ROLE_HEADER,
} from "./workspace-context-headers";

export interface WorkspaceContext {
  workspaceId: WorkspaceId;
  role: MemberRole;
}

/**
 * Helper util pengganti pola lama `resolveWorkspaceAndSession(slug)` yang
 * dulu didefinisikan lokal per-route (ADR-076 menghapus dynamic segment
 * `[slug]`). Membaca workspace context yang sudah di-resolve dan
 * di-inject `proxy.ts` sebagai header request (`x-workspace-id` /
 * `x-workspace-role`) — bukan resolve ulang dari slug/cookie di sini.
 *
 * Redirect ke `/onboarding` bila header tidak ada (mis. diakses langsung
 * tanpa melalui proxy, atau cookie workspace aktif belum/tidak ter-set).
 */
export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const h = await headers();
  const workspaceId = h.get(WORKSPACE_ID_HEADER);
  const role = h.get(WORKSPACE_ROLE_HEADER);

  if (!workspaceId || !role) {
    redirect("/onboarding");
  }

  return { workspaceId: asWorkspaceId(workspaceId), role: role as MemberRole };
}
