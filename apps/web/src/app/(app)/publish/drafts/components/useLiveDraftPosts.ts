"use client";

import { useCallback } from "react";

import type { ContentStatus, SocialPlatform } from "@postific/shared";
import {
  compareApprovalItemsDesc,
  type CalendarPostItem,
  type PublishingPostRecord,
} from "@/domains/publishing";

import {
  usePublishTabList,
  type PublishTabPage,
} from "../../components/views/usePublishTabList";
import { getDraftPostAction } from "../actions";

/** Account a Drafts or Approvals post goes to (Approvals account row). */
export interface DraftListTarget {
  id: string;
  connectedAccountId: string;
  platform: SocialPlatform;
  accountHandle: string;
}

/**
 * Fields of a Drafts or Approvals card (sub-shape of `PublishingPostRecord`).
 * `targets` is filled for Approvals (account row, S-008 design gap 3) and by
 * the Realtime patch; the Drafts list data has none.
 */
export type DraftListItem = Pick<
  PublishingPostRecord,
  | "id"
  | "caption"
  | "status"
  | "updatedAt"
  | "createdVia"
  | "createdViaClientName"
> & { targets?: DraftListTarget[] };

function toDraftListItem(
  item: CalendarPostItem,
  statuses: ReadonlySet<ContentStatus>,
): DraftListItem | null {
  if (!statuses.has(item.status)) {
    return null;
  }
  return {
    id: item.id,
    caption: item.caption,
    status: item.status,
    updatedAt: item.updatedAt,
    createdVia: item.createdVia,
    createdViaClientName: item.createdViaClientName,
    targets: item.targets.map((target) => ({
      id: target.id,
      connectedAccountId: target.connectedAccountId,
      platform: target.platform,
      accountHandle: target.accountHandle,
    })),
  };
}

/**
 * Drafts or Approvals as an infinite-scroll list (S-009) kept in step with
 * Realtime (ADR-094): each INSERT/UPDATE fetches one post and upserts or
 * removes it by the statuses this tab shows (Drafts: Draft and Ready to
 * Schedule; Approvals: In Review) and by the List Filter. A post that moves
 * from one tab to the other leaves one list and enters the other.
 * Out-of-order responses are dropped. Order: last change first, id as
 * tie-breaker (`compareApprovalItemsDesc`, the order of the page query).
 */
export function useLiveDraftPosts(
  tab: "drafts" | "approvals",
  initialPage: PublishTabPage<DraftListItem>,
  statuses: ReadonlySet<ContentStatus>,
  workspaceId: string,
) {
  const fetchLiveItem = useCallback(
    async (postId: string) => {
      const fetched = await getDraftPostAction(postId);
      return fetched ? toDraftListItem(fetched, statuses) : null;
    },
    [statuses],
  );
  return usePublishTabList<DraftListItem>({
    tab,
    initialPage,
    compare: compareApprovalItemsDesc,
    workspaceId,
    fetchLiveItem,
  });
}
