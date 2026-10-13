/**
 * Status redirect `?connect=` dari Route Handler callback Outstand
 * (`/api/integrations/outstand/callback`) ke halaman Connected Accounts.
 * Satu-satunya sumber untuk union ini (code review PR #139) — sebelumnya
 * ditulis ulang terpisah di `route.ts` (`redirectWithStatus`), `page.tsx`
 * (rantai `===`), dan `ConnectedAccountsList.tsx` (prop `connectResult`),
 * jadi menambah status baru butuh 3 edit manual yang bisa lupa disinkronkan.
 */
export const CONNECT_RESULTS = [
  "success",
  "error",
  "already-connected",
] as const;

export type ConnectResult = (typeof CONNECT_RESULTS)[number];

export function asConnectResult(
  value: string | undefined,
): ConnectResult | null {
  return CONNECT_RESULTS.includes(value as ConnectResult)
    ? (value as ConnectResult)
    : null;
}
