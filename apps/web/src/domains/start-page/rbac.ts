import { MemberRole } from "@postific/shared";
import { AuthorizationError } from "@/lib/utils/errors";

/**
 * RBAC Start Page (T-072). `roles-permissions.md` TIDAK punya baris
 * eksplisit untuk Start Page. Asumsi sementara (menunggu konfirmasi King
 * Rezi): sama dengan aksi konten — Account Owner, Admin, dan Creator boleh
 * melihat dan menyunting. Satu tempat untuk diubah bila keputusannya
 * dibatasi ke Owner/Admin (ganti ke `OWNER_OR_ADMIN_ROLES` dari
 * `@postific/shared`). Assertion tetap eksplisit karena `role` dari header
 * request di-cast tanpa validasi runtime.
 */
const ROLES_ALLOWED_TO_MANAGE_START_PAGE: ReadonlySet<MemberRole> = new Set([
  MemberRole.Owner,
  MemberRole.Admin,
  MemberRole.Creator,
]);

export function assertActorCanManageStartPage(actorRole: MemberRole): void {
  if (!ROLES_ALLOWED_TO_MANAGE_START_PAGE.has(actorRole)) {
    throw new AuthorizationError(
      "Anda tidak memiliki izin untuk mengelola Start Page.",
    );
  }
}
