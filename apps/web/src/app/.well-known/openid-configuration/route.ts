import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";

import { auth } from "@/lib/better-auth/auth";
import { mcpSpikeEnabled } from "@/lib/better-auth/mcp-spike";

// T-148 (spike MCP) — beberapa klien MCP mencoba OIDC discovery lebih dulu.
export const dynamic = "force-dynamic";
const metadata = oauthProviderOpenIdConfigMetadata(auth);

// Tanpa plugin `oauth-provider` (flag mati) handler plugin memanggil fungsi yang
// tidak ada dan menjawab 500; jawab 404 seperti route spike lain.
export function GET(request: Request) {
  if (!mcpSpikeEnabled()) {
    return new Response("Not found", { status: 404 });
  }
  return metadata(request);
}
