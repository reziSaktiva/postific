import { ContentStatus, SocialPlatform } from "@postific/shared";
import { describe, expect, it } from "vitest";

import {
  pickFocusTarget,
  previewDate,
  previewFooterAction,
  publishedViaPlatforms,
} from "./post-preview-model";

const target = (
  connectedAccountId: string,
  platform: SocialPlatform,
  status: "pending" | "scheduled" | "published" | "failed" = "published",
) => ({ connectedAccountId, platform, status }) as never;

describe("pickFocusTarget", () => {
  const targets = [
    target("a", SocialPlatform.Instagram),
    target("b", SocialPlatform.Facebook),
  ];

  it("picks the account of the clicked chip", () => {
    expect(pickFocusTarget({ targets }, "b")).toMatchObject({
      connectedAccountId: "b",
    });
  });

  it("falls back to the first account when the clicked one is gone or not given", () => {
    expect(pickFocusTarget({ targets }, "zzz")).toMatchObject({
      connectedAccountId: "a",
    });
    expect(pickFocusTarget({ targets })).toMatchObject({
      connectedAccountId: "a",
    });
  });

  it("returns null for a post without accounts", () => {
    expect(pickFocusTarget({ targets: [] }, "a")).toBeNull();
  });
});

describe("previewDate", () => {
  const base = {
    publishedAt: null,
    failedAt: null,
    scheduledAt: null,
    updatedAt: new Date("2026-11-01T00:00:00Z"),
  };

  it("uses the publish time for a published or imported post", () => {
    const publishedAt = new Date("2026-11-20T03:00:00Z");
    expect(
      previewDate({ ...base, status: ContentStatus.Published, publishedAt }),
    ).toEqual({ kind: "published", date: publishedAt });
    expect(
      previewDate({ ...base, status: ContentStatus.Imported, publishedAt }),
    ).toEqual({ kind: "published", date: publishedAt });
  });

  it("falls back to the update time when a published post has no publish time", () => {
    expect(previewDate({ ...base, status: ContentStatus.Published })).toEqual({
      kind: "published",
      date: base.updatedAt,
    });
  });

  it("uses the schedule, then the failure time, for a failed post", () => {
    const failedAt = new Date("2026-11-03T00:00:00Z");
    const scheduledAt = new Date("2026-12-12T06:00:00Z");
    expect(
      previewDate({
        ...base,
        status: ContentStatus.Failed,
        failedAt,
        scheduledAt,
      }),
    ).toEqual({ kind: "failed", date: scheduledAt });
    expect(
      previewDate({ ...base, status: ContentStatus.Failed, failedAt }),
    ).toEqual({ kind: "failed", date: failedAt });
  });

  it("gives a Board card (no failure time) the same date as its preview", () => {
    const scheduledAt = new Date("2026-12-12T06:00:00Z");
    const failedAt = new Date("2026-11-03T00:00:00Z");
    const card = { ...base, status: ContentStatus.Failed, scheduledAt };
    expect(previewDate(card)).toEqual(previewDate({ ...card, failedAt }));
    expect(previewDate(card)).toEqual({ kind: "failed", date: scheduledAt });
  });

  it("falls back to the update time for a failed post with no schedule or failure time", () => {
    expect(previewDate({ ...base, status: ContentStatus.Failed })).toEqual({
      kind: "failed",
      date: base.updatedAt,
    });
  });

  it("uses the schedule for a scheduled post and says none for a draft", () => {
    const scheduledAt = new Date("2026-12-01T00:00:00Z");
    expect(
      previewDate({ ...base, status: ContentStatus.Scheduled, scheduledAt }),
    ).toEqual({ kind: "scheduled", date: scheduledAt });
    expect(previewDate({ ...base, status: ContentStatus.Draft })).toEqual({
      kind: "none",
    });
  });
});

describe("previewFooterAction", () => {
  it.each([
    [ContentStatus.Published, "go-to-post"],
    [ContentStatus.Imported, "go-to-post"],
    [ContentStatus.Failed, "retry"],
    [ContentStatus.Scheduled, "edit"],
    [ContentStatus.Draft, "edit"],
    [ContentStatus.InReview, "edit"],
    [ContentStatus.ReadyToSchedule, "edit"],
  ])("%s has the %s action", (status, action) => {
    expect(previewFooterAction(status)).toBe(action);
  });
});

describe("publishedViaPlatforms", () => {
  it("lists each network the post went out on once, skipping failed accounts", () => {
    expect(
      publishedViaPlatforms({
        status: ContentStatus.Published,
        targets: [
          target("a", SocialPlatform.Instagram),
          target("b", SocialPlatform.Instagram),
          target("c", SocialPlatform.Facebook, "failed"),
        ],
      }),
    ).toEqual([SocialPlatform.Instagram]);
  });

  it("is empty for a post that is not out", () => {
    expect(
      publishedViaPlatforms({
        status: ContentStatus.Scheduled,
        targets: [target("a", SocialPlatform.Instagram, "scheduled")],
      }),
    ).toEqual([]);
  });
});
