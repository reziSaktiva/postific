import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client (auth-strategy.md).
 * No baseURL — defaults to the current origin, same app as the server instance.
 *
 * `oauthProviderClient()` (T-148, spike MCP): dipakai halaman `/select-workspace`
 * dan `/consent`. Tanpa query OAuth bertanda tangan di URL ia tidak melakukan
 * apa pun, jadi login dan alur lain tidak berubah.
 */
export const authClient = createAuthClient({
  plugins: [oauthProviderClient()],
});
