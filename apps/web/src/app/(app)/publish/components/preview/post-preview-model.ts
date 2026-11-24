import { ContentStatus } from "@postific/shared";
import type {
  HistoryDetailItem,
  HistoryItemTargetRecord,
} from "@/domains/publishing";

/**
 * Pure rules of the post preview (T-288, S-008): which account the popover
 * speaks about, which date it shows, and which action sits in its footer.
 * Kept apart from the React component so they are tested without a DOM.
 */

/**
 * The account of the clicked chip, else the first one. A post that lost the
 * clicked target (edited meanwhile) falls back to the first target; a post
 * with no target (a draft) has none.
 */
export function pickFocusTarget(
  item: Pick<HistoryDetailItem, "targets">,
  connectedAccountId?: string | null,
): HistoryItemTargetRecord | null {
  return (
    item.targets.find(
      (target) => target.connectedAccountId === connectedAccountId,
    ) ??
    item.targets[0] ??
    null
  );
}

export type PreviewDate =
  { kind: "published" | "failed" | "scheduled"; date: Date } | { kind: "none" };

/**
 * The date a post shows on the Publish page (preview header and Board card)
 * and how it is worded; "none" for a post without a date. A failed post
 * shows the time it was meant to go out (its schedule), as the expanded
 * dialog title does (T-111.1); a Publish Now failure, without a schedule,
 * shows when it failed. `failedAt` is optional: a Board card has none and
 * then falls back to the update time.
 */
export function previewDate(
  item: Pick<
    HistoryDetailItem,
    "status" | "publishedAt" | "scheduledAt" | "updatedAt"
  > & { failedAt?: Date | null },
): PreviewDate {
  switch (item.status) {
    case ContentStatus.Published:
    case ContentStatus.Imported:
      return { kind: "published", date: item.publishedAt ?? item.updatedAt };
    case ContentStatus.Failed:
      return {
        kind: "failed",
        date: item.scheduledAt ?? item.failedAt ?? item.updatedAt,
      };
    default:
      return item.scheduledAt
        ? { kind: "scheduled", date: item.scheduledAt }
        : { kind: "none" };
  }
}

export type PreviewFooterAction = "go-to-post" | "retry" | "edit";

/**
 * Footer action by status: published (and imported) posts link to the
 * network, failed posts retry, everything that can still change opens the
 * Draft Editor.
 */
export function previewFooterAction(
  status: ContentStatus,
): PreviewFooterAction {
  if (status === ContentStatus.Published || status === ContentStatus.Imported) {
    return "go-to-post";
  }
  if (status === ContentStatus.Failed) return "retry";
  return "edit";
}

/** Platforms the post actually went out on, for "Published via", without repeats. */
export function publishedViaPlatforms(
  item: Pick<HistoryDetailItem, "status" | "targets">,
): HistoryItemTargetRecord["platform"][] {
  const isOut =
    item.status === ContentStatus.Published ||
    item.status === ContentStatus.Imported;
  if (!isOut) return [];
  const live = item.targets.filter(
    (target) =>
      item.status === ContentStatus.Imported || target.status === "published",
  );
  return [...new Set(live.map((target) => target.platform))];
}
