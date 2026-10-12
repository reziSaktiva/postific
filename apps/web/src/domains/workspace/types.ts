/** Domain-specific types for workspace. */

import { MemberRole } from "@postific/shared";
import type {
  MemberId,
  MemberStatus,
  SocialPlatform,
  UserId,
} from "@postific/shared";
import type { WorkspaceInvitationRecord } from "./repositories/workspace.repository";

/**
 * Shape consumed by UI surfaces that render a quick-glance list of connected
 * accounts — currently the sidebar "Channels" section (T-012, ADR-058) and,
 * later, the Connected Accounts settings page (T-015). Kept in the workspace
 * domain's public API so both surfaces import one contract instead of
 * redefining it.
 *
 * `scheduledCount` is a real cross-domain count from `publishing` (T-012.2),
 * supplied via `WorkspaceService`'s `ScheduledCountsPort` — defaults to 0
 * when the port isn't provided to the constructor (back-compat call-sites).
 *
 * `avatarUrl` (menutup KI-076, ADR-120) — foto profil akun, `null` kalau
 * Outstand tidak punya/tidak mengembalikan foto untuk akun ini. Diisi
 * `WorkspaceService.listSidebarChannels` langsung dari
 * `ConnectedAccountRecord.avatarUrl` (kolom Prisma `avatar_url`) — lihat
 * `packages/shared/src/contracts/outstand-adapter.ts` untuk asal datanya
 * per platform (single-page vs Facebook Pages).
 */
export interface SidebarChannelAccount {
  id: string;
  platform: SocialPlatform;
  handle: string;
  status: string;
  reconnectRequired: boolean;
  scheduledCount: number;
  avatarUrl: string | null;
}

/**
 * Workspace member row joined with user name/email — dipakai UI daftar
 * anggota (T-007.4). `userId` tidak punya relasi FK Prisma ke `User`
 * (beda bounded context, lihat catatan di IWorkspaceRepository.findUsersByIds),
 * jadi join ini dilakukan manual di WorkspaceService.listMembersWithUser,
 * bukan lewat Prisma `include`.
 */
export interface WorkspaceMemberWithUser {
  id: MemberId;
  userId: UserId;
  name: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
}

/**
 * Detail undangan siap-render untuk halaman accept-invite (T-093.1,
 * ADR-080). `isExistingUser` menentukan form mana yang ditampilkan (Buat
 * Akun Baru vs Masuk) — hasil auto-detect `WorkspaceService.getInviteToAccept`,
 * bukan pilihan user.
 */
export interface WorkspaceInviteAcceptDetails {
  workspaceName: string;
  invitedByName: string;
  role: MemberRole;
  email: string;
  isExistingUser: boolean;
}

/**
 * Discriminated union hasil validasi token accept-invite (T-093.1) — 3 dari
 * 5 state UI Claude Design (`templates/accept-invite.html`) ditentukan di
 * sini; 2 sisanya ("Email Baru"/"Email Terdaftar", dibedakan lewat
 * `details.isExistingUser`) dan "Success" (hasil aksi submit, bukan hasil
 * validasi token) ditentukan di layer UI.
 */
export type WorkspaceInviteAcceptView =
  | { state: "valid"; details: WorkspaceInviteAcceptDetails }
  | { state: "expired" }
  | { state: "invalid" };

/**
 * Satu baris gabungan Members list (T-007.8, ADR-101) — union eksplisit,
 * BUKAN invitation dipaksa ke shape `WorkspaceMemberWithUser` dengan field
 * dipalsukan (`name`/`userId` dummy). `kind` adalah discriminant supaya UI
 * (`MembersTable.tsx`) bisa merender dua jenis baris dengan aman tanpa
 * runtime check ad-hoc per field. `member` — baris asli dari
 * `workspace_members` (status Active/Removed). `invitation` — baris virtual
 * dari `WorkspaceInvitation` (`status = pending`, belum expired) yang belum
 * punya `User`/nama sampai di-accept (T-093) — identitas ditampilkan pakai
 * `invitation.email`.
 *
 * PERHATIAN untuk T-007.7 (invite via Email, ADR-100, masih blocked T-005):
 * alur itu akan pre-create baris `workspace_members` ASLI berstatus
 * `MemberStatus.Pending` — yaitu `kind: "member"` dengan `member.status ===
 * Pending`, BUKAN `kind: "pending-invitation"`. Members list akan punya dua
 * representasi "pending" yang berbeda struktur & aksi (virtual row ini cuma
 * "Cancel Invitation"; member Pending asli bisa "Change Role"/"Remove") —
 * rencanakan reconciliation UI-nya saat T-007.7 diimplementasikan, jangan
 * asumsikan otomatis konsisten.
 */
export type MemberListRow =
  | { kind: "member"; member: WorkspaceMemberWithUser }
  | { kind: "pending-invitation"; invitation: WorkspaceInvitationRecord };

/**
 * Label tampilan role — satu sumber untuk semua UI (Settings → Members,
 * halaman accept-invite, dst.) supaya tidak divergen antar layar (code
 * review PR #95: sebelumnya `MembersTable.tsx` dan `AcceptInvitePageClient.tsx`
 * masing-masing punya salinan sendiri, sempat berbeda untuk Owner).
 */
export const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  [MemberRole.Owner]: "Owner",
  [MemberRole.Admin]: "Admin",
  [MemberRole.Creator]: "Creator",
};
