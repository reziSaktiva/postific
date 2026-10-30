import { notFound, redirect } from "next/navigation";
import { asUserId } from "@postific/shared";

import { MEMBER_ROLE_LABEL } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { getMcpConsentService } from "@/lib/mcp-access/get-mcp-consent-service";
import { isMcpEnabled } from "@/lib/mcp/config";

import { SelectWorkspaceForm } from "./components/SelectWorkspaceForm";

/**
 * T-151 — langkah 1 dari 2 persetujuan OAuth klien AI (KSP-09-F01, ADR-139):
 * pilih satu workspace. Rancangan: artifact Postific, kartu
 * `ScreenOauthConsent`. Plugin OAuth mengalihkan ke sini (`postLogin.page`)
 * dengan query bertanda tangan; halaman ini hanya membaca `client_id` untuk
 * menampilkan identitas klien.
 */
export default async function SelectWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string }>;
}) {
  if (!isMcpEnabled()) {
    notFound();
  }
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const { client_id: clientId } = await searchParams;
  const userId = asUserId(session.user.id);
  const consent = getMcpConsentService();

  const [client, workspaces, selectedId] = await Promise.all([
    consent.describeClient(clientId ?? ""),
    consent.listSelectableWorkspaces(userId),
    // Pilihan yang masih berlaku (mis. kembali dari langkah 2 lewat "Ubah")
    // menjadi pilihan awal.
    consent.getActiveWorkspaceId(session.session.id, userId),
  ]);

  return (
    <SelectWorkspaceForm
      email={session.user.email}
      client={client}
      workspaces={workspaces.map((workspace) => ({
        id: workspace.workspaceId,
        name: workspace.name,
        roleLabel: MEMBER_ROLE_LABEL[workspace.role],
        connectedAccountCount: workspace.connectedAccountCount,
      }))}
      initialSelectedId={selectedId}
    />
  );
}
