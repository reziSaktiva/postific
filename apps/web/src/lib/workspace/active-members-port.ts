import { MemberStatus, type UserId, type WorkspaceId } from "@postific/shared";
import { workspaceRepository } from "@/lib/repositories/workspace";

/**
 * Composition-root helper — `WorkspaceMembersPort` (`domains/engagement`)
 * dipakai dua tempat (`/api/jobs/run/route.ts` untuk cron JOB-03,
 * `engage/actions.ts` untuk refresh manual T-052) dengan implementasi yang
 * sebelumnya diduplikasi verbatim di kedua tempat. Diekstrak ke sini supaya
 * definisi "member aktif" untuk notifikasi aggregate engagement tetap satu
 * sumber kebenaran.
 */
export function createActiveWorkspaceMembersPort() {
  return {
    async listActiveMembers(workspaceId: WorkspaceId, userId: UserId) {
      const members = await workspaceRepository.listMembers(
        workspaceId,
        userId,
      );
      return members
        .filter((member) => member.status === MemberStatus.Active)
        .map((member) => ({ userId: member.userId }));
    },
  };
}
