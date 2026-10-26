import { oauthProvider } from "@better-auth/oauth-provider";
import { jwt } from "better-auth/plugins";

/**
 * T-148 (spike MCP, ADR-139) — SEMENTARA. Dipakai untuk membuktikan alur OAuth
 * klien MCP nyata ke HTTPS dan interaksi plugin `jwt` dengan `dash`. Mati
 * kecuali `MCP_SPIKE_ENABLED=true`, jadi deploy tanpa env itu tidak berubah.
 * T-149/T-150/T-151 menggantikan file ini; jangan dikembangkan di sini.
 */

export const MCP_SCOPES = ["mcp:read", "mcp:draft", "mcp:schedule"] as const;

const WORKSPACE_CHOICE_TTL_MS = 10 * 60 * 1000;

type WorkspaceChoice = { workspaceId: string; at: number };

// Pilihan workspace per ID sesi (consentReferenceId hanya menerima session,
// bukan cookie). Di memori: cukup untuk satu proses spike, bukan untuk
// multi-instance. T-149 memindahkannya ke tabel.
const globalForChoices = globalThis as unknown as {
  __mcpSpikeWorkspaceChoices?: Map<string, WorkspaceChoice>;
};
const workspaceChoices = (globalForChoices.__mcpSpikeWorkspaceChoices ??=
  new Map());

export function mcpSpikeEnabled(): boolean {
  return process.env.MCP_SPIKE_ENABLED === "true";
}

export function mcpBaseUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "").replace(/\/+$/, "");
}

export function mcpResourceUrl(): string {
  return `${mcpBaseUrl()}/api/mcp`;
}

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

/**
 * Plugin yang ditambahkan ke `auth.ts` hanya saat spike aktif. `jwt()` wajib
 * oleh `oauthProvider`; keduanya diuji berdampingan dengan `dash`.
 */
export function mcpSpikePlugins() {
  if (!mcpSpikeEnabled()) {
    return [];
  }

  const base = mcpBaseUrl();

  return [
    jwt({ jwt: { issuer: base, audience: mcpResourceUrl() } }),
    oauthProvider({
      loginPage: "/login",
      consentPage: "/consent",
      scopes: ["openid", "offline_access", ...MCP_SCOPES],
      validAudiences: [mcpResourceUrl()],
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultScopes: ["mcp:read", "mcp:draft"],
      clientRegistrationAllowedScopes: ["mcp:schedule", "offline_access"],
      postLogin: {
        page: "/select-workspace",
        shouldRedirect: ({ session }) =>
          currentWorkspaceChoice(session.id) === undefined,
        consentReferenceId: ({ session }) => currentWorkspaceChoice(session.id),
      },
      customAccessTokenClaims: ({ referenceId }) => ({
        workspace_id: referenceId,
      }),
    }),
  ];
}
