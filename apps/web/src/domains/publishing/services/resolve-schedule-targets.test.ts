import {
  asConnectedAccountId,
  asWorkspaceId,
  ContentFormat,
  SocialPlatform,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import type { ConnectedAccountRecord } from "@/domains/workspace";
import { ValidationError } from "@/lib/utils/errors";
import { resolveScheduleTargets } from "./resolve-schedule-targets";

const WORKSPACE_ID = asWorkspaceId("workspace-1");

function createConnectedAccount(
  overrides: Partial<ConnectedAccountRecord> = {},
): ConnectedAccountRecord {
  return {
    id: asConnectedAccountId("account-1"),
    workspaceId: WORKSPACE_ID,
    platform: SocialPlatform.Instagram,
    outstandAccountId: "outstand-account-1",
    handle: "@raka",
    status: "connected",
    reconnectRequired: false,
    connectedAt: new Date("2026-01-01T00:00:00Z"),
    lastImportedUntil: null,
    lastImportRequestedAt: null,
    ...overrides,
  };
}

describe("resolveScheduleTargets", () => {
  it("mencocokkan connectedAccountId tanpa peka huruf besar-kecil dan memakai id dari DB", () => {
    const account = createConnectedAccount({
      id: asConnectedAccountId("0a1b2c3d-0000-4000-8000-00000000000a"),
    });

    const [target] = resolveScheduleTargets(
      [account],
      [
        {
          connectedAccountId: account.id.toUpperCase(),
          contentFormat: ContentFormat.Post,
        },
      ],
    );

    expect(target?.connectedAccountId).toBe(account.id);
  });

  it("mencocokkan request dengan connected account dan menyertakan outstandAccountId", () => {
    const account = createConnectedAccount();

    const result = resolveScheduleTargets(
      [account],
      [
        {
          connectedAccountId: account.id,
          contentFormat: ContentFormat.Post,
          platformOptions: { caption: "halo" },
        },
      ],
    );

    expect(result).toEqual([
      {
        connectedAccountId: account.id,
        platform: account.platform,
        contentFormat: ContentFormat.Post,
        platformOptions: { caption: "halo" },
        outstandAccountId: account.outstandAccountId,
      },
    ]);
  });

  it("melempar ValidationError kalau connectedAccountId tidak ada di daftar akun workspace", () => {
    const account = createConnectedAccount();

    expect(() =>
      resolveScheduleTargets(
        [account],
        [
          {
            connectedAccountId: asConnectedAccountId("account-lain"),
            contentFormat: ContentFormat.Post,
          },
        ],
      ),
    ).toThrow(ValidationError);
  });

  it("melempar ValidationError kalau contentFormat bukan value ContentFormat yang valid", () => {
    const account = createConnectedAccount();

    expect(() =>
      resolveScheduleTargets(
        [account],
        [
          {
            connectedAccountId: account.id,
            contentFormat: "carousel",
          },
        ],
      ),
    ).toThrow(ValidationError);
  });

  it("melempar error kalau contentFormat valid tapi tidak diizinkan untuk platform akun tersebut", () => {
    const account = createConnectedAccount({
      platform: SocialPlatform.Pinterest,
    });

    expect(() =>
      resolveScheduleTargets(
        [account],
        [
          {
            connectedAccountId: account.id,
            contentFormat: ContentFormat.Reel,
          },
        ],
      ),
    ).toThrow();
  });
});
