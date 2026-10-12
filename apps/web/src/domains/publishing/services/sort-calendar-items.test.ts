import { asPostId, ContentStatus } from "@postific/shared";
import { describe, expect, it } from "vitest";
import type { CalendarItemRecord } from "../repositories/publishing.repository";
import { sortCalendarItemsByEffectiveDate } from "./sort-calendar-items";

function createCalendarItem(
  overrides: Partial<CalendarItemRecord> = {},
): CalendarItemRecord {
  return {
    id: asPostId("post-1"),
    caption: "Hello",
    status: ContentStatus.Scheduled,
    scheduledAt: new Date("2026-07-14T10:00:00Z"),
    publishedAt: null,
    createdAt: new Date("2026-07-13T00:00:00Z"),
    updatedAt: new Date("2026-07-13T00:00:00Z"),
    targets: [],
    ...overrides,
  };
}

describe("sortCalendarItemsByEffectiveDate", () => {
  it("returns an empty array untouched", () => {
    expect(sortCalendarItemsByEffectiveDate([])).toEqual([]);
  });

  it("mengurutkan ascending berdasar scheduledAt", () => {
    const later = createCalendarItem({
      id: asPostId("post-later"),
      scheduledAt: new Date("2026-07-15T09:00:00Z"),
    });
    const earlier = createCalendarItem({
      id: asPostId("post-earlier"),
      scheduledAt: new Date("2026-07-14T09:00:00Z"),
    });

    expect(sortCalendarItemsByEffectiveDate([later, earlier])).toEqual([
      earlier,
      later,
    ]);
  });

  it("fallback ke publishedAt untuk post Published tanpa scheduledAt (Publish Now)", () => {
    const publishedViaPublishNow = createCalendarItem({
      id: asPostId("post-published"),
      status: ContentStatus.Published,
      scheduledAt: null,
      publishedAt: new Date("2026-07-14T12:00:00Z"),
    });
    const scheduled = createCalendarItem({
      id: asPostId("post-scheduled"),
      scheduledAt: new Date("2026-07-14T15:00:00Z"),
    });

    expect(
      sortCalendarItemsByEffectiveDate([scheduled, publishedViaPublishNow]),
    ).toEqual([publishedViaPublishNow, scheduled]);
  });

  it("fallback ke createdAt kalau scheduledAt dan publishedAt keduanya null", () => {
    const noDate = createCalendarItem({
      id: asPostId("post-no-date"),
      status: ContentStatus.Draft,
      scheduledAt: null,
      publishedAt: null,
      createdAt: new Date("2026-07-10T00:00:00Z"),
    });
    const scheduled = createCalendarItem({
      id: asPostId("post-scheduled"),
      scheduledAt: new Date("2026-07-14T15:00:00Z"),
    });

    expect(sortCalendarItemsByEffectiveDate([scheduled, noDate])).toEqual([
      noDate,
      scheduled,
    ]);
  });

  it("tidak memutasi array input", () => {
    const items = [
      createCalendarItem({
        id: asPostId("post-2"),
        scheduledAt: new Date("2026-07-15T00:00:00Z"),
      }),
      createCalendarItem({
        id: asPostId("post-1"),
        scheduledAt: new Date("2026-07-14T00:00:00Z"),
      }),
    ];
    const original = [...items];

    sortCalendarItemsByEffectiveDate(items);

    expect(items).toEqual(original);
  });
});
