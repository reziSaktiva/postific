import { NextResponse } from "next/server";

import { auth } from "@/lib/better-auth/auth";
import { getCachedSession } from "@/lib/better-auth/session";
import { mcpBaseUrl, mcpSpikeEnabled } from "@/lib/better-auth/mcp-spike";

// T-148 (spike MCP) — bukti untuk dua pertanyaan yang tersisa: apakah plugin
// `jwt` dan `dash` hidup bersamaan di `auth.ts` asli, dan apakah JWKS
// terjangkau lewat URL publik. Tidak memuat nilai rahasia.
export const dynamic = "force-dynamic";

export async function GET() {
  if (!mcpSpikeEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }
  // Butuh sesi login: respons membuka susunan plugin dan status dash.
  if (!(await getCachedSession())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const pluginIds = (auth.options.plugins ?? []).map((plugin) => plugin.id);
  const jwksUrl = `${mcpBaseUrl()}/api/auth/jwks`;

  let jwks: { status: number; keyCount: number | null } | { error: string };
  try {
    const response = await fetch(jwksUrl, { cache: "no-store" });
    const body = response.ok
      ? ((await response.json()) as { keys?: unknown[] })
      : null;
    jwks = { status: response.status, keyCount: body?.keys?.length ?? null };
  } catch (error) {
    jwks = { error: (error as Error).message };
  }

  return NextResponse.json({
    baseUrl: mcpBaseUrl(),
    pluginIds,
    dashEnabled: Boolean(process.env.BETTER_AUTH_API_KEY),
    jwtPluginPresent: pluginIds.includes("jwt"),
    oauthProviderPresent: pluginIds.includes("oauth-provider"),
    jwksUrl,
    jwks,
  });
}
