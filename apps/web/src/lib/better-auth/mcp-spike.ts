import { oauthProvider } from "@better-auth/oauth-provider";
import { APIError } from "better-auth/api";
import { jwt } from "better-auth/plugins";

import {
  getSpikeGrantStore,
  type SpikeGrantStore,
} from "@/lib/mcp-spike/grant-store";

import { mcpSpikeGrantPlugin } from "./mcp-spike-grant-hook";

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
// bukan cookie). Di memori: cukup untuk satu proses spike. Dengan lebih dari satu
// instance, `/oauth2/continue` yang jatuh di instance lain tidak melihat pilihan
// dan mengalihkan ulang ke /select-workspace. T-151 memindahkannya ke tabel.
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

export type McpSpikePluginOptions = {
  baseUrl: string;
  grantStore: SpikeGrantStore;
};

/**
 * Susunan plugin spike, tanpa pemeriksaan flag supaya tes (T-149.2) bisa
 * memakai konfigurasi yang persis sama dengan harness. `jwt()` wajib oleh
 * `oauthProvider`; keduanya diuji berdampingan dengan `dash`. Plugin grant
 * (T-149.2) menyalin consent menjadi grant lewat `hooks.after`.
 */
export function createMcpSpikePlugins({
  baseUrl,
  grantStore,
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
    mcpSpikeGrantPlugin({
      store: grantStore,
      toolScopes: MCP_SCOPES,
      consentReferenceId,
    }),
  ];
}

/**
 * Plugin yang ditambahkan ke `auth.ts` hanya saat spike aktif.
 */
export function mcpSpikePlugins() {
  if (!mcpSpikeEnabled()) {
    return [];
  }
  return createMcpSpikePlugins({
    baseUrl: mcpBaseUrl(),
    grantStore: getSpikeGrantStore(),
  });
}
