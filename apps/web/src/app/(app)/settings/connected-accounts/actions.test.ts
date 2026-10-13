import { SocialPlatform } from "@postific/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "@/lib/utils/errors";

const {
  getSessionMock,
  redirectMock,
  cookiesSetMock,
  cookiesHasMock,
  cookiesGetMock,
  cookiesDeleteMock,
  initiateConnectAccountMock,
  listFacebookPendingPagesMock,
  confirmFacebookPagesConnectionMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  cookiesSetMock: vi.fn(),
  cookiesHasMock: vi.fn(() => true),
  cookiesGetMock: vi.fn(),
  cookiesDeleteMock: vi.fn(),
  initiateConnectAccountMock: vi.fn(),
  listFacebookPendingPagesMock: vi.fn(),
  confirmFacebookPagesConnectionMock: vi.fn(),
}));

vi.mock("@/lib/better-auth/auth", () => ({
  auth: { api: { getSession: getSessionMock } },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(
    async () =>
      new Headers({
        "x-workspace-id": "workspace-1",
        "x-workspace-role": "owner",
      }),
  ),
  cookies: vi.fn(async () => ({
    set: cookiesSetMock,
    get: cookiesGetMock,
    has: cookiesHasMock,
    delete: cookiesDeleteMock,
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/workspace/outstand-workspace-service", () => ({
  createWorkspaceServiceWithOutstandAdapter: () => ({
    initiateConnectAccount: initiateConnectAccountMock,
    listFacebookPendingPages: listFacebookPendingPagesMock,
    confirmFacebookPagesConnection: confirmFacebookPagesConnectionMock,
  }),
}));

vi.mock("@/lib/repositories/workspace", () => ({
  workspaceRepository: {},
}));

import {
  confirmFacebookPagesConnectionAction,
  initiateConnectAccountAction,
  initiateReconnectAccountAction,
  listFacebookPendingPagesAction,
} from "./actions";

const SESSION = { user: { id: "user-1" } };

function encodeState(nonce: string): string {
  return Buffer.from(JSON.stringify({ nonce }), "utf8").toString("base64url");
}

describe("initiateConnectAccountAction / initiateReconnectAccountAction — pengecualian Facebook (Bug #2)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getSessionMock.mockReset();
    redirectMock.mockClear();
    cookiesSetMock.mockClear();
    cookiesHasMock.mockReset();
    cookiesHasMock.mockReturnValue(true);
    cookiesGetMock.mockReset();
    cookiesDeleteMock.mockReset();
    initiateConnectAccountMock.mockReset();
    listFacebookPendingPagesMock.mockReset();
    confirmFacebookPagesConnectionMock.mockReset();
    getSessionMock.mockResolvedValue(SESSION);
  });

  it("initiateConnectAccountAction(Facebook) mengembalikan redirectUrl TANPA memanggil redirect() server-side", async () => {
    const redirectUrl =
      "/api/integrations/outstand/callback?session=fake-fb-session-1&state=abc";
    initiateConnectAccountMock.mockResolvedValue({ redirectUrl });

    const result = await initiateConnectAccountAction(SocialPlatform.Facebook);

    expect(result).toEqual({ redirectUrl });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("initiateConnectAccountAction(platform lain, mis. Instagram) TETAP memanggil redirect() server-side seperti semula", async () => {
    const redirectUrl =
      "https://www.outstand.so/app/api/socials/instagram/org-1";
    initiateConnectAccountMock.mockResolvedValue({ redirectUrl });

    await expect(
      initiateConnectAccountAction(SocialPlatform.Instagram),
    ).rejects.toThrow(`REDIRECT:${redirectUrl}`);

    expect(redirectMock).toHaveBeenCalledWith(redirectUrl);
  });

  it("initiateReconnectAccountAction(Facebook) mengembalikan redirectUrl TANPA memanggil redirect() server-side", async () => {
    const redirectUrl =
      "/api/integrations/outstand/callback?session=fake-fb-session-2&state=def";
    initiateConnectAccountMock.mockResolvedValue({ redirectUrl });

    const result = await initiateReconnectAccountAction(
      "connected-account-1",
      SocialPlatform.Facebook,
    );

    expect(result).toEqual({ redirectUrl });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("initiateReconnectAccountAction(platform lain) TETAP memanggil redirect() server-side seperti semula", async () => {
    const redirectUrl = "https://www.outstand.so/app/api/socials/x/org-1";
    initiateConnectAccountMock.mockResolvedValue({ redirectUrl });

    await expect(
      initiateReconnectAccountAction(
        "connected-account-1",
        SocialPlatform.Twitter,
      ),
    ).rejects.toThrow(`REDIRECT:${redirectUrl}`);

    expect(redirectMock).toHaveBeenCalledWith(redirectUrl);
  });
});

describe("listFacebookPendingPagesAction / confirmFacebookPagesConnectionAction — CSRF + session cookie", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    cookiesHasMock.mockReset();
    cookiesGetMock.mockReset();
    cookiesDeleteMock.mockReset();
    listFacebookPendingPagesMock.mockReset();
    confirmFacebookPagesConnectionMock.mockReset();
    getSessionMock.mockResolvedValue(SESSION);
  });

  it("listFacebookPendingPagesAction menolak kalau nonce cookie hilang (CSRF)", async () => {
    cookiesHasMock.mockReturnValue(false);
    const state = encodeState("nonce-csrf-1");

    const result = await listFacebookPendingPagesAction(state);

    expect(result.error).toMatch(/tidak valid|kedaluwarsa/i);
    expect(listFacebookPendingPagesMock).not.toHaveBeenCalled();
  });

  it("listFacebookPendingPagesAction menolak kalau session cookie hilang", async () => {
    cookiesHasMock.mockReturnValue(true);
    cookiesGetMock.mockReturnValue(undefined);
    const state = encodeState("nonce-csrf-2");

    const result = await listFacebookPendingPagesAction(state);

    expect(result.error).toMatch(/tidak valid|kedaluwarsa/i);
    expect(listFacebookPendingPagesMock).not.toHaveBeenCalled();
  });

  it("listFacebookPendingPagesAction membaca session dari cookie (bukan argumen client)", async () => {
    const nonce = "nonce-ok";
    const state = encodeState(nonce);
    cookiesHasMock.mockReturnValue(true);
    cookiesGetMock.mockImplementation((name: string) => {
      if (name === `outstandFacebookSession_${nonce}`) {
        return { value: "session-from-cookie" };
      }
      return undefined;
    });
    listFacebookPendingPagesMock.mockResolvedValue([
      { pageId: "p1", name: "Page 1" },
    ]);

    const result = await listFacebookPendingPagesAction(state);

    expect(result.pages).toEqual([{ pageId: "p1", name: "Page 1" }]);
    expect(listFacebookPendingPagesMock).toHaveBeenCalledWith(
      expect.objectContaining({ sessionToken: "session-from-cookie" }),
    );
  });

  it("confirmFacebookPagesConnectionAction menghapus nonce + session cookie lalu menolak tanpa CSRF", async () => {
    cookiesHasMock.mockReturnValue(false);
    cookiesGetMock.mockReturnValue(undefined);
    const nonce = "nonce-confirm-fail";
    const state = encodeState(nonce);

    const result = await confirmFacebookPagesConnectionAction(state, ["p1"]);

    expect(result.error).toMatch(/tidak valid|kedaluwarsa/i);
    expect(cookiesDeleteMock).toHaveBeenCalledWith(
      `outstand-connect-nonce-${nonce}`,
    );
    expect(cookiesDeleteMock).toHaveBeenCalledWith(
      `outstandFacebookSession_${nonce}`,
    );
    expect(confirmFacebookPagesConnectionMock).not.toHaveBeenCalled();
  });

  it("confirmFacebookPagesConnectionAction sukses memakai session cookie + hapus kedua cookie", async () => {
    const nonce = "nonce-confirm-ok";
    const state = encodeState(nonce);
    cookiesHasMock.mockReturnValue(true);
    cookiesGetMock.mockImplementation((name: string) => {
      if (name === `outstandFacebookSession_${nonce}`) {
        return { value: "session-confirm" };
      }
      return undefined;
    });
    confirmFacebookPagesConnectionMock.mockResolvedValue([
      {
        outstandAccountId: "acc-1",
        platform: SocialPlatform.Facebook,
        handle: "page1",
        status: "active",
      },
    ]);

    const result = await confirmFacebookPagesConnectionAction(state, ["p1"]);

    expect(result).toEqual({ connectedCount: 1 });
    expect(confirmFacebookPagesConnectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionToken: "session-confirm",
        selectedPageIds: ["p1"],
      }),
    );
    expect(cookiesDeleteMock).toHaveBeenCalledWith(
      `outstand-connect-nonce-${nonce}`,
    );
    expect(cookiesDeleteMock).toHaveBeenCalledWith(
      `outstandFacebookSession_${nonce}`,
    );
  });

  it("confirmFacebookPagesConnectionAction tidak menghapus cookie kalau finalize gagal", async () => {
    const nonce = "nonce-confirm-retry";
    const state = encodeState(nonce);
    cookiesHasMock.mockReturnValue(true);
    cookiesGetMock.mockImplementation((name: string) => {
      if (name === `outstandFacebookSession_${nonce}`) {
        return { value: "session-confirm" };
      }
      return undefined;
    });
    confirmFacebookPagesConnectionMock.mockRejectedValue(
      new ValidationError("Finalize gagal, coba lagi."),
    );

    const result = await confirmFacebookPagesConnectionAction(state, ["p1"]);

    expect(result.error).toBeTruthy();
    expect(cookiesDeleteMock).not.toHaveBeenCalled();
  });
});
