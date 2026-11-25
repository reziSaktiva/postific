"use client";

import { useCallback, useRef } from "react";

import type { ContentStatus, SocialPlatform } from "@postific/shared";
import {
  compareApprovalItemsDesc,
  type CalendarPostItem,
  type PublishingPostRecord,
} from "@/domains/publishing";
import { usePublishingPostsRealtime } from "@/lib/hooks/use-publishing-posts-realtime";
import { useSyncedState } from "@/lib/hooks/use-synced-state";

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
 * Local copy of a Drafts or Approvals list kept in step with Realtime
 * (ADR-094): each INSERT/UPDATE fetches one post and upserts or removes it
 * by the statuses this tab shows (Drafts: Draft and Ready to Schedule;
 * Approvals: In Review). A post that moves from one tab to the other leaves
 * one list and enters the other. Out-of-order responses are dropped.
 */
export function useLiveDraftPosts(
  initial: DraftListItem[],
  statuses: ReadonlySet<ContentStatus>,
  workspaceId: string,
): DraftListItem[] {
  const [items, setItems] = useSyncedState(initial);
  const requestSeqRef = useRef<Map<string, number>>(new Map());

  const handleChange = useCallback(
    (event: { postId: CalendarPostItem["id"] }) => {
      const seq = (requestSeqRef.current.get(event.postId) ?? 0) + 1;
      requestSeqRef.current.set(event.postId, seq);

      void (async () => {
        const fetched = await getDraftPostAction(event.postId);
        if (requestSeqRef.current.get(event.postId) !== seq) {
          return;
        }
        const next = fetched ? toDraftListItem(fetched, statuses) : null;
        setItems((prev) => {
          const withoutStale = prev.filter((item) => item.id !== event.postId);
          return next
            ? [...withoutStale, next].sort(compareApprovalItemsDesc)
            : withoutStale;
        });
      })();
    },
    [setItems, statuses],
  );

  usePublishingPostsRealtime(workspaceId, {
    onInsert: handleChange,
    onUpdate: handleChange,
  });

  return items;
}
