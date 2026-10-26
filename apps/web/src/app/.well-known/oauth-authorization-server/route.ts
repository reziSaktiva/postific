import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";

import { auth } from "@/lib/better-auth/auth";

// T-148 (spike MCP) — discovery RFC 8414. Better Auth ada di basePath
// /api/auth sehingga metadata harus dipasang manual di root.
export const dynamic = "force-dynamic";
export const GET = oauthProviderAuthServerMetadata(auth);
