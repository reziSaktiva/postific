import { ContentStatus } from "@postific/shared";
import { describe, expect, it } from "vitest";

import {
  groupApprovalItemsByDate,
  groupDraftItemsByDate,
  type ApprovalListItem,
} from "./group-approval-items";

const WIB = "Asia/Jakarta";

function item(
  id: string,
  status: ContentStatus,
  updatedAt: string,
): ApprovalListItem {
  return { id, status, updatedAt: new Date(updatedAt) };
}

describe("groupApprovalItemsByDate", () => {
  it("returns no group when nothing is In Review", () => {
    expect(
      groupApprovalItemsByDate(
        [item("a", ContentStatus.Draft, "2026-07-14T03:00:00Z")],
        WIB,
      ),
    ).toEqual([]);
  });

  it("keeps only In Review items and groups them by day, newest day and time first", () => {
    const early = item("a", ContentStatus.InReview, "2026-07-14T01:00:00Z");
    const late = item("b", ContentStatus.InReview, "2026-07-14T08:00:00Z");
    const nextDay = item("c", ContentStatus.InReview, "2026-07-15T02:00:00Z");
    const other = item(
      "d",
      ContentStatus.ReadyToSchedule,
      "2026-07-15T03:00:00Z",
    );

    expect(
      groupApprovalItemsByDate([early, other, nextDay, late], WIB),
    ).toEqual([
      { date: "2026-07-15", items: [nextDay] },
      { date: "2026-07-14", items: [late, early] },
    ]);
  });

  it("puts the day boundary in the display time zone, not in UTC", () => {
    // 2026-07-14 18:00 UTC is already 15 July 01:00 in Jakarta.
    const crossing = item("a", ContentStatus.InReview, "2026-07-14T18:00:00Z");

    expect(groupApprovalItemsByDate([crossing], WIB)[0]?.date).toBe(
      "2026-07-15",
    );
    expect(groupApprovalItemsByDate([crossing], "UTC")[0]?.date).toBe(
      "2026-07-14",
    );
  });

  it("orders items of the same instant by id so the order is stable", () => {
    const a = item("a", ContentStatus.InReview, "2026-07-14T03:00:00Z");
    const b = item("b", ContentStatus.InReview, "2026-07-14T03:00:00Z");

    expect(groupApprovalItemsByDate([a, b], WIB)[0]?.items).toEqual([b, a]);
  });
});

describe("groupDraftItemsByDate", () => {
  it("keeps Draft and Ready to Schedule and leaves In Review to Approvals", () => {
    const draft = item("a", ContentStatus.Draft, "2026-07-14T03:00:00Z");
    const ready = item(
      "b",
      ContentStatus.ReadyToSchedule,
      "2026-07-14T04:00:00Z",
    );
    const review = item("c", ContentStatus.InReview, "2026-07-14T05:00:00Z");

    expect(groupDraftItemsByDate([draft, review, ready], WIB)).toEqual([
      { date: "2026-07-14", items: [ready, draft] },
    ]);
  });
});
