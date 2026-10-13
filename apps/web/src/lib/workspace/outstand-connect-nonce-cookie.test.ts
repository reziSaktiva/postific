import { describe, expect, it } from "vitest";

import { readConnectStateFromRedirectUrl } from "./outstand-connect-nonce-cookie";

describe("readConnectStateFromRedirectUrl", () => {
  it("reads a top-level state query param", () => {
    expect(
      readConnectStateFromRedirectUrl(
        "/api/integrations/outstand/callback?state=abc",
      ),
    ).toBe("abc");
  });

  it("reads state nested inside redirect_uri on the real Outstand URL", () => {
    const redirectUri =
      "http://localhost:3000/api/integrations/outstand/callback?state=nested-state";
    const redirectUrl = `https://www.outstand.so/app/api/socials/instagram/org-1?redirect_uri=${encodeURIComponent(redirectUri)}`;

    expect(readConnectStateFromRedirectUrl(redirectUrl)).toBe("nested-state");
  });

  it("returns null when neither place has state", () => {
    expect(
      readConnectStateFromRedirectUrl(
        "https://www.outstand.so/app/api/socials/instagram/org-1",
      ),
    ).toBeNull();
  });
});
