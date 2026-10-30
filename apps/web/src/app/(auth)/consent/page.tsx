import { notFound, redirect } from "next/navigation";
import { asUserId } from "@postific/shared";

import { MEMBER_ROLE_LABEL } from "@/domains/workspace";
import { getCachedSession } from "@/lib/better-auth/session";
import { getMcpConsentService } from "@/lib/mcp-access/get-mcp-consent-service";
import { isMcpEnabled } from "@/lib/mcp/config";

import {
  passthroughScopes,
  selectableConsentScopes,
} from "../_mcp-oauth/scope-copy";
import { ConsentForm } from "./components/ConsentForm";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Query OAuth bertanda tangan apa adanya, supaya "Ubah" kembali ke langkah 1 tanpa kehilangan konteks. */
function workspaceStepHref(params: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) {
        query.append(key, item);
      }
    }
  }
  const search = query.toString();
  return search ? `/select-workspace?${search}` : "/select-workspace";
}

/**
 * T-151 — langkah 2 dari 2 persetujuan OAuth klien AI (KSP-09-F02 sampai F04,
 * ADR-139): scope yang diizinkan untuk workspace terpilih. Rancangan: artifact
 * Postific, kartu `ScreenOauthConsent`. Pilihan workspace dibaca dari tabel
 * `mcp_workspace_choices`; bila sudah tidak berlaku (kedaluwarsa, atau
 * pengguna sudah bukan member), pengguna dikembalikan ke langkah 1.
 */
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!isMcpEnabled()) {
    notFound();
  }
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const changeWorkspaceHref = workspaceStepHref(params);
  const userId = asUserId(session.user.id);
  const consent = getMcpConsentService();

  const selected = await consent.getSelectedWorkspace(
    session.session.id,
    userId,
  );
  if (!selected) {
    redirect(changeWorkspaceHref);
  }

  const client = await consent.describeClient(
    firstValue(params.client_id) ?? "",
  );
  const requested = (firstValue(params.scope) ?? "").split(" ").filter(Boolean);

  return (
    <ConsentForm
      client={client}
      workspace={{
        id: selected.workspaceId,
        name: selected.name,
        roleLabel: MEMBER_ROLE_LABEL[selected.role],
      }}
      changeWorkspaceHref={changeWorkspaceHref}
      scopes={selectableConsentScopes(requested)}
      passthroughScopes={passthroughScopes(requested)}
    />
  );
}
