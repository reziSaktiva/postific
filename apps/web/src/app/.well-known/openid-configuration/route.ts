import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";

import { auth } from "@/lib/better-auth/auth";

// T-148 (spike MCP) — beberapa klien MCP mencoba OIDC discovery lebih dulu.
export const dynamic = "force-dynamic";
export const GET = oauthProviderOpenIdConfigMetadata(auth);
