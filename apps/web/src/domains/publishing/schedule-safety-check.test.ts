import { ContentFormat, SocialPlatform } from "@postific/shared";
import { describe, expect, it } from "vitest";

import { PublishingDomainError } from "./errors";
import { PINTEREST_ONE_ACCOUNT_MESSAGE } from "./pinterest-board-constraints";
import { assertScheduleSafetyCheck } from "./schedule-safety-check";

const NOW = new Date("2026-11-02T03:00:00.000Z");
const LATER = new Date("2026-11-10T03:00:00.000Z");

const ok = {
  caption: "Halo",
  mediaCount: 1,
  scheduledAt: LATER,
  now: NOW,
  targets: [
    { platform: SocialPlatform.Instagram, contentFormat: ContentFormat.Post },
  ],
};

describe("assertScheduleSafetyCheck", () => {
  it("passes a plain post", () => {
    expect(() => assertScheduleSafetyCheck(ok)).not.toThrow();
  });

  it("rejects an Instagram Post without media (ADR-154)", () => {
    expect(() => assertScheduleSafetyCheck({ ...ok, mediaCount: 0 })).toThrow(
      /Instagram tidak bisa dipublish tanpa media/,
    );
  });

  it("accepts a Facebook Post without media (text-only is valid)", () => {
    expect(() =>
      assertScheduleSafetyCheck({
        ...ok,
        mediaCount: 0,
        targets: [
          {
            platform: SocialPlatform.Facebook,
            contentFormat: ContentFormat.Post,
          },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects a schedule more than 30 days ahead (Outstand limit, ADR-154)", () => {
    expect(() =>
      assertScheduleSafetyCheck({
        ...ok,
        scheduledAt: new Date(NOW.getTime() + 31 * 24 * 60 * 60 * 1000),
      }),
    ).toThrow(/Jadwal maksimal 30 hari/);
  });

  it("rejects an invalid date", () => {
    expect(() =>
      assertScheduleSafetyCheck({ ...ok, scheduledAt: new Date("nope") }),
    ).toThrow(PublishingDomainError);
  });

  it("rejects two Pinterest accounts with the one-account message, even with a board", () => {
    const pin = {
      platform: SocialPlatform.Pinterest,
      contentFormat: ContentFormat.Pin,
      platformOptions: { boardId: "b-1" },
    };
    expect(() =>
      assertScheduleSafetyCheck({
        ...ok,
        mediaCount: 1,
        targets: [pin, pin],
      }),
    ).toThrow(PINTEREST_ONE_ACCOUNT_MESSAGE);
  });

  it("accepts one Pinterest account when a board is present (UI path)", () => {
    expect(() =>
      assertScheduleSafetyCheck({
        ...ok,
        mediaCount: 1,
        targets: [
          {
            platform: SocialPlatform.Pinterest,
            contentFormat: ContentFormat.Pin,
            platformOptions: { boardId: "b-1" },
          },
        ],
      }),
    ).not.toThrow();
  });
});
