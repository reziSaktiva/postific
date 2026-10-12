import { WorkspaceService } from "@/domains/workspace";
import { getInviteEmailSender } from "@/lib/adapters/email";
import { getServerEnv } from "@/lib/env";
import { workspaceRepository } from "@/lib/repositories/workspace";

/**
 * Composition-root helper (T-110, KI-053) — dipakai
 * `requestAcceptInviteVerificationAction` (`app/(auth)/invite/[token]/actions.ts`)
 * dan `inviteMemberAction` saat metode Kirim via Email (T-007.7). Pola sama
 * `createWorkspaceServiceWithOutstandAdapter` (`outstand-workspace-service.ts`)
 * — satu factory supaya wiring tidak diam-diam divergen kalau berubah.
 */
export function createWorkspaceServiceWithInviteEmailSender(): WorkspaceService {
  return new WorkspaceService(
    workspaceRepository,
    undefined,
    undefined,
    undefined,
    undefined,
    getInviteEmailSender(),
    undefined,
    getServerEnv().BETTER_AUTH_URL,
  );
}
