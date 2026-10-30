import { oauthProvider } from "@better-auth/oauth-provider";
import { APIError } from "better-auth/api";
import { jwt } from "better-auth/plugins";
import { asUserId } from "@postific/shared";

import type { McpConsentService } from "@/domains/mcp-access";
import { getMcpAccessService } from "@/lib/mcp-access/get-mcp-access-service";
import { getMcpConsentService } from "@/lib/mcp-access/get-mcp-consent-service";
import { isMcpEnabled, mcpBaseUrl } from "@/lib/mcp/config";

import { mcpGrantPlugin, type McpGrantAccess } from "./mcp-grant-hook";

/**
 * Plugin OAuth untuk MCP (ADR-139). Layar pilih workspace dan consent
 * (`app/(auth)/select-workspace`, `app/(auth)/consent`, T-151) menulis
 * pilihan workspace lewat `McpConsentService` ke tabel
 * `mcp_workspace_choices` (per ID sesi, tahan multi-instance dan restart);
 * `postLogin` di bawah hanya membacanya. Grant tidak di store memori: plugin
 * grant permanen (`mcp-grant-hook.ts`, T-150.4) memanggil `McpAccessService`.
 * Nyala/mati dikendalikan `isMcpEnabled()` (`lib/mcp/config.ts`), flag yang
 * sama dengan route `/api/mcp`, jadi route dan OAuth tidak bisa menyala
 * terpisah. Nama file `mcp-spike` dipertahankan agar impor tidak berubah.
 */

export const MCP_SCOPES = ["mcp:read", "mcp:draft", "mcp:schedule"] as const;

/** Nama lama dipertahankan untuk halaman/route harness; isinya `isMcpEnabled()`. */
export function mcpSpikeEnabled(): boolean {
  return isMcpEnabled();
}

export { mcpBaseUrl, mcpResourceUrl } from "@/lib/mcp/config";

/** Bagian `McpConsentService` yang dibaca plugin OAuth. */
export type McpWorkspaceChoiceAccess = Pick<
  McpConsentService,
  "getActiveWorkspaceId" | "clearWorkspaceChoice"
>;

export type McpSpikePluginOptions = {
  baseUrl: string;
  /** Pabrik `McpAccessService` untuk plugin grant; produksi: `getMcpAccessService`. */
  getAccess: () => McpGrantAccess;
  /** Pabrik pembaca pilihan workspace; produksi: `getMcpConsentService`. */
  getChoices: () => McpWorkspaceChoiceAccess;
};

/**
 * Susunan plugin OAuth MCP, tanpa pemeriksaan flag supaya tes memakai
 * konfigurasi yang persis sama. `jwt()` wajib oleh `oauthProvider`; keduanya
 * diuji berdampingan dengan `dash`. Plugin grant menyalin consent menjadi
 * grant lewat `hooks.after`.
 */
export function createMcpSpikePlugins({
  baseUrl,
  getAccess,
  getChoices,
}: McpSpikePluginOptions) {
  const resourceUrl = `${baseUrl}/api/mcp`;

  async function activeWorkspaceId({
    user,
    session,
  }: {
    user: { id: string };
    session: { id: string };
  }): Promise<string | undefined> {
    return (
      (await getChoices().getActiveWorkspaceId(
        session.id,
        asUserId(user.id),
      )) ?? undefined
    );
  }

  async function consentReferenceId(info: {
    user: { id: string };
    session: { id: string };
  }): Promise<string> {
    const workspaceId = await activeWorkspaceId(info);
    if (!workspaceId) {
      // Gagal tegas: consent tanpa workspace menerbitkan token tanpa
      // `workspace_id` yang ditolak 403 tanpa penjelasan.
      throw new APIError("BAD_REQUEST", {
        message:
          "Pilihan workspace kedaluwarsa. Ulangi penyambungan dari klien AI.",
      });
    }
    return workspaceId;
  }

  return [
    jwt({ jwt: { issuer: baseUrl, audience: resourceUrl } }),
    oauthProvider({
      loginPage: "/login",
      consentPage: "/consent",
      scopes: ["openid", "offline_access", ...MCP_SCOPES],
      validAudiences: [resourceUrl],
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultScopes: ["mcp:read", "mcp:draft"],
      clientRegistrationAllowedScopes: ["mcp:schedule", "offline_access"],
      postLogin: {
        page: "/select-workspace",
        shouldRedirect: async (info) =>
          (await activeWorkspaceId(info)) === undefined,
        consentReferenceId,
      },
      customAccessTokenClaims: ({ referenceId }) => ({
        workspace_id: referenceId,
      }),
    }),
    mcpGrantPlugin({
      getAccess,
      consentReferenceId,
      onConsentGranted: ({ user, session }) =>
        getChoices().clearWorkspaceChoice(session.id, asUserId(user.id)),
    }),
  ];
}

/**
 * Plugin yang ditambahkan ke `auth.ts` hanya saat `isMcpEnabled()`.
 */
export function mcpSpikePlugins() {
  if (!isMcpEnabled()) {
    return [];
  }
  return createMcpSpikePlugins({
    baseUrl: mcpBaseUrl(),
    getAccess: getMcpAccessService,
    getChoices: getMcpConsentService,
  });
}
