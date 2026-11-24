import {
  asConnectedAccountId,
  asUserId,
  asWorkspaceId,
  SocialPlatform,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import type { AccountBestTimeSuggestions } from "@/domains/analytics";
import { GetBestTimeSuggestionsUseCase } from "./get-best-time-suggestions.use-case";

const WS = asWorkspaceId("ws");
const USER = asUserId("u");
const A = asConnectedAccountId("a");
const B = asConnectedAccountId("b");
const C = asConnectedAccountId("c");

const slot = {
  slotAt: new Date("2026-11-27T11:00:00Z"),
  weekday: 5,
  hour: 18,
  rank: 1,
  medianEngagementRate: 0.05,
  medianReach: 100,
  postCount: 4,
};
const suggestion = (id: typeof A): AccountBestTimeSuggestions => ({
  connectedAccountId: id,
  platform: SocialPlatform.Instagram,
  slots: [slot],
});
const account = (
  id: typeof A,
  status = "active",
  reconnectRequired = false,
) => ({
  id,
  platform: SocialPlatform.Instagram,
  handle: `@${id}`,
  status,
  reconnectRequired,
});

describe("GetBestTimeSuggestionsUseCase", () => {
  it("returns suggestions only for usable connected accounts, with handle", async () => {
    const useCase = new GetBestTimeSuggestionsUseCase(
      { execute: async () => [suggestion(A), suggestion(B), suggestion(C)] },
      {
        listConnectedAccounts: async () => [
          account(A),
          account(B, "disconnected"),
          account(C, "active", true),
        ],
      },
    );
    const result = await useCase.execute({
      workspaceId: WS,
      userId: USER,
      timezone: "Asia/Jakarta",
    });
    expect(result.map((r) => [r.connectedAccountId, r.handle])).toEqual([
      [A, "@a"],
    ]);
  });

  it("returns an empty list when no account has suggestions", async () => {
    const useCase = new GetBestTimeSuggestionsUseCase(
      { execute: async () => [] },
      { listConnectedAccounts: async () => [account(A)] },
    );
    expect(
      await useCase.execute({ workspaceId: WS, userId: USER, timezone: "UTC" }),
    ).toEqual([]);
  });

  it("passes the timezone and limit through to the analytics use case", async () => {
    let received: unknown;
    const useCase = new GetBestTimeSuggestionsUseCase(
      {
        execute: async (input) => {
          received = input;
          return [];
        },
      },
      { listConnectedAccounts: async () => [] },
    );
    await useCase.execute({
      workspaceId: WS,
      userId: USER,
      timezone: "Asia/Jakarta",
      limitPerAccount: 6,
    });
    expect(received).toMatchObject({
      timezone: "Asia/Jakarta",
      limitPerAccount: 6,
      actingUserId: USER,
    });
  });
});
