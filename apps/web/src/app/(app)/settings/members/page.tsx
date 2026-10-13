import { asUserId } from "@postific/shared";
import { redirect } from "next/navigation";

import { WorkspaceService } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";

import { InviteMemberAction } from "./components/InviteMemberAction";
import { MembersTable } from "./components/MembersTable";

// ADR-076 (T-039.1-3): workspaceId dari getWorkspaceContext() (header
// proxy.ts), bukan resolve ulang dari `slug`. getCachedSession() masih
// dipanggil di sini (bukan cuma di layout) karena `currentUserId`-nya
// dibutuhkan langsung oleh MembersTable, sama seperti pola
// saveDraftAction di (app)/components/draft-editor/actions.ts.
//
// RBAC (roles-permissions.md): Creator "Tidak ada akses" ke Members sama
// sekali — bukan cuma tombol aksi disembunyikan (beda dari Danger Zone di
// Settings General, yang section-nya disembunyikan tapi halamannya sendiri
// tetap bisa diakses semua role). Gate dicek di sini, SEBELUM
// listMembersWithUser dipanggil, supaya data member (termasuk email
// seluruh anggota) tidak pernah dikirim ke Creator sama sekali — bug
// KI-038 sebelumnya cuma menyembunyikan tombol di client setelah data
// sudah terkirim (information disclosure). Redirect ke "/settings"
// (General) karena halaman itu bisa diakses semua role — tidak ada
// preseden redirect khusus untuk halaman restricted lain di app ini.
export default async function Page() {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const workspaceService = new WorkspaceService(workspaceRepository);
  const actorUserId = asUserId(session.user.id);

  const canAccessMembers = await workspaceService.canManageMembers(
    workspaceId,
    actorUserId,
  );
  if (!canAccessMembers) {
    redirect("/settings");
  }

  // T-007.8 (ADR-101): gabungan member asli + undangan pending, bukan cuma
  // listMembersWithUser — supaya baris virtual "Pending" ikut tampil.
  const rows = await workspaceService.listMembersAndPendingInvitations(
    workspaceId,
    actorUserId,
  );

  return (
    <MembersTable
      rows={rows}
      currentUserId={session.user.id}
      headerAction={<InviteMemberAction />}
    />
  );
}
