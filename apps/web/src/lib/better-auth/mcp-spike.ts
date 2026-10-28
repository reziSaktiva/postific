import { oauthProvider } from "@better-auth/oauth-provider";
import { APIError } from "better-auth/api";
import { jwt } from "better-auth/plugins";

import { getMcpAccessService } from "@/lib/mcp-access/get-mcp-access-service";
import { isMcpEnabled, mcpBaseUrl } from "@/lib/mcp/config";

import { mcpGrantPlugin, type McpGrantAccess } from "./mcp-grant-hook";

/**
 * Plugin OAuth untuk MCP (ADR-139). Layar consent dan pilihan workspace di
 * file ini masih bentuk harness T-148 (pilihan workspace di memori) dan
 * digantikan T-151; jangan dikembangkan di sini. Grant tidak lagi di store
 * memori: plugin grant permanen (`mcp-grant-hook.ts`, T-150.4) memanggil
 * `McpAccessService`. Nyala/mati dikendalikan `isMcpEnabled()`
 * (`lib/mcp/config.ts`), flag yang sama dengan route `/api/mcp`, jadi route
 * dan OAuth tidak bisa menyala terpisah.
 */

export const MCP_SCOPES = ["mcp:read", "mcp:draft", "mcp:schedule"] as const;

const WORKSPACE_CHOICE_TTL_MS = 10 * 60 * 1000;

type WorkspaceChoice = { workspaceId: string; at: number };

// Pilihan workspace per ID sesi (consentReferenceId hanya menerima session,
// bukan cookie). Di memori: cukup untuk satu proses spike. Dengan lebih dari satu
// instance, `/oauth2/continue` yang jatuh di instance lain tidak melihat pilihan
// dan mengalihkan ulang ke /select-workspace. T-151 memindahkannya ke tabel.
const globalForChoices = globalThis as unknown as {
  __mcpSpikeWorkspaceChoices?: Map<string, WorkspaceChoice>;
};
const workspaceChoices = (globalForChoices.__mcpSpikeWorkspaceChoices ??=
  new Map());

/** Nama lama dipertahankan untuk halaman/route harness; isinya `isMcpEnabled()`. */
export function mcpSpikeEnabled(): boolean {
  return isMcpEnabled();
}

export { mcpBaseUrl, mcpResourceUrl } from "@/lib/mcp/config";

export function rememberWorkspaceChoice(
  sessionId: string,
  workspaceId: string,
): void {
  workspaceChoices.set(sessionId, { workspaceId, at: Date.now() });
}

function currentWorkspaceChoice(sessionId: string): string | undefined {
  const choice = workspaceChoices.get(sessionId);
  if (!choice || Date.now() - choice.at > WORKSPACE_CHOICE_TTL_MS) {
    return undefined;
  }
  return choice.workspaceId;
}

export type McpSpikePluginOptions = {
  baseUrl: string;
  /** Pabrik `McpAccessService` untuk plugin grant; produksi: `getMcpAccessService`. */
  getAccess: () => McpGrantAccess;
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
}: McpSpikePluginOptions) {
  const resourceUrl = `${baseUrl}/api/mcp`;

  function consentReferenceId({
    session,
  }: {
    session: { id: string };
  }): string {
    const workspaceId = currentWorkspaceChoice(session.id);
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
        shouldRedirect: ({ session }) =>
          currentWorkspaceChoice(session.id) === undefined,
        consentReferenceId,
      },
      customAccessTokenClaims: ({ referenceId }) => ({
        workspace_id: referenceId,
      }),
    }),
    mcpGrantPlugin({ getAccess, consentReferenceId }),
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
  });
}
