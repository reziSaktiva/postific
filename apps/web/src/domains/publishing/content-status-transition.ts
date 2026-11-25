import { ContentStatus } from "@postific/shared";

/**
 * Coordination status transitions a member triggers by hand (T-289, S-008,
 * `roles-permissions.md` § Status Transition Rules by Role): Draft -> In
 * Review, In Review -> Draft, In Review -> Ready to Schedule. They are
 * lightweight (UXP-06): all three roles may trigger them, nothing waits for
 * approval, and In Review can be skipped by scheduling from Draft.
 *
 * Each target status has exactly one allowed source, so a caller names
 * only the target. Any other source (including `imported`, which is
 * terminal) is rejected.
 */
export const CONTENT_STATUS_TRANSITION_SOURCE = {
  [ContentStatus.InReview]: ContentStatus.Draft,
  [ContentStatus.Draft]: ContentStatus.InReview,
  [ContentStatus.ReadyToSchedule]: ContentStatus.InReview,
} as const satisfies Partial<Record<ContentStatus, ContentStatus>>;

export type ContentStatusTransitionTarget =
  keyof typeof CONTENT_STATUS_TRANSITION_SOURCE;

export function isContentStatusTransitionTarget(
  status: ContentStatus,
): status is ContentStatusTransitionTarget {
  return Object.hasOwn(CONTENT_STATUS_TRANSITION_SOURCE, status);
}

export function isAllowedContentStatusTransition(
  from: ContentStatus,
  to: ContentStatus,
): boolean {
  return (
    isContentStatusTransitionTarget(to) &&
    CONTENT_STATUS_TRANSITION_SOURCE[to] === from
  );
}
