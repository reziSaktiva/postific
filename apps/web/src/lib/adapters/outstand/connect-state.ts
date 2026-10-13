/**
 * Decode `state` OAuth loopback (T-013.1/T-013.2, T-015.3, ADR-105) — dipakai
 * Route Handler `/api/integrations/outstand/callback` dan Server Action
 * inisiasi (`initiateConnectAccountAction`/`initiateReconnectAccountAction`)
 * untuk membaca `redirectAccountId` (keputusan CREATE vs UPDATE
 * `ConnectedAccount`) dan `nonce` (CSRF-check, dicocokkan dengan cookie yang
 * diset saat inisiasi).
 *
 * **Keputusan desain (Prabowo, giliran T-015.3/T-013.1/2 — lihat ADR-105
 * poin 2 "Referensi"):** kontrak `ConnectCallbackInput`/`ConnectedAccountData`
 * (ADR-105, redesain ADR-112) di `packages/shared` SENGAJA tidak
 * mengubah keputusan ini — `ConnectedAccountData` tidak membawa
 * `redirectAccountId`.
 * ADR-105 poin 2 sendiri menyatakan `WorkspaceService` yang MEMUTUSKAN
 * create/update dari `redirectAccountId` yang "dibawa lewat state", TAPI
 * tidak berarti `WorkspaceService` (Application Service, domain layer) yang
 * MENDEKODE string opaque `state` itu sendiri — bentuk wire `state` adalah
 * detail implementasi adapter (ACL boundary, AGENTS.md #6: domain tidak
 * boleh bergantung pada detail HTTP/adapter Outstand). Decode karena itu
 * dilakukan di layer infra/entry point (modul ini, dipakai Route Handler +
 * Server Action) — hasilnya (`redirectAccountId`) baru diteruskan sebagai
 * parameter EKSPLISIT ke `WorkspaceService.initiateConnectAccount`/
 * `completeAccountConnection`, yang sendiri tidak mengimpor apa pun dari
 * `lib/adapters/outstand`.
 *
 * **Format `state` OAuth** — JSON base64url yang di-encode Real adapter
 * (`encodeState` di `real-outstand-adapter.ts`) dan di-decode di sini /
 * Route Handler callback. Modul ini menyediakan `parseBase64UrlJson` +
 * `decodeConnectAccountState` supaya bentuk wire `state` tetap di layer
 * infra (ACL boundary), bukan di domain.
 */
export interface DecodedConnectAccountState {
  redirectAccountId?: string;
  nonce: string;
}

/**
 * Parse mentah base64url→JSON (dipakai `decodeConnectAccountState` di bawah
 * dan Real adapter saat membaca `platform` dari `state` OAuth).
 */
export function parseBase64UrlJson(state: string): unknown {
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    throw new Error("OutstandAdapter connect state tidak valid/rusak.");
  }
}

export function decodeConnectAccountState(
  state: string,
): DecodedConnectAccountState {
  const parsed = parseBase64UrlJson(state);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { nonce?: unknown }).nonce !== "string"
  ) {
    throw new Error(
      "OutstandAdapter connect state tidak lengkap (loopback callback).",
    );
  }

  const { nonce, redirectAccountId } = parsed as {
    nonce: string;
    redirectAccountId?: unknown;
  };

  return {
    nonce,
    redirectAccountId:
      typeof redirectAccountId === "string" && redirectAccountId.length > 0
        ? redirectAccountId
        : undefined,
  };
}
