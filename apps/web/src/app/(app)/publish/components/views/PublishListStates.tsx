"use client";

import type { RefObject } from "react";

import type { PublishListTab } from "@/domains/publishing";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { InfiniteListFooter } from "../../../components/infinite-list/InfiniteListStates";
import type { InfiniteListStatus } from "../../../components/infinite-list/infinite-list-state";

/*
 * List-end states of the Publish List tabs and Board columns (S-009), as
 * confirmed in `ScreenInfiniteScrollStates` (Postific artifact, 2026-11-25;
 * `key-screen-patterns.md`, Pattern: Long Lists). Skeleton rows are shaped
 * like the cards of each list and built from shadcn `Skeleton`.
 */

const TAB_END_TEXT: Record<PublishListTab, string> = {
  queue: "Tidak ada jadwal lagi.",
  drafts: "Tidak ada draf lagi.",
  approvals: "Tidak ada posting lagi untuk direview.",
  history: "Sudah sampai posting terlama.",
};

const ERROR_COPY = {
  title: "Gagal memuat posting lainnya",
  description: "Periksa koneksi, lalu coba lagi.",
  retryLabel: "Coba Lagi",
};

/** One List card in loading form: time on the left, then the card (History adds the metrics row). */
export function ListCardSkeleton({ withMetrics }: { withMetrics: boolean }) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- S-009: same row layout as ListDayGroups
    <div className="flex flex-col gap-1 lg:flex-row lg:gap-4">
      <Skeleton className="h-3.5 w-10 shrink-0 lg:mt-4" />
      <Card size="sm" className="min-w-0 flex-1">
        <CardContent>
          {/* eslint-disable-next-line no-restricted-syntax -- S-009: layout-only */}
          <div className="flex flex-col gap-3">
            {/* eslint-disable-next-line no-restricted-syntax -- S-009: layout-only */}
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line no-restricted-syntax -- S-009: layout-only */}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {/* eslint-disable-next-line no-restricted-syntax -- S-009: layout-only */}
                <div className="flex items-center gap-2">
                  <Skeleton className="size-7 rounded-full" />
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="ml-auto h-5 w-11 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              {withMetrics ? (
                <Skeleton className="size-24 shrink-0 rounded-lg max-sm:hidden" />
              ) : null}
            </div>
            {withMetrics ? (
              // eslint-disable-next-line no-restricted-syntax -- S-009: layout-only
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {[0, 1, 2, 3].map((index) => (
                  // eslint-disable-next-line no-restricted-syntax -- S-009: layout-only
                  <div key={index} className="flex flex-col gap-1">
                    <Skeleton className="h-2.5 w-14" />
                    <Skeleton className="h-3.5 w-9" />
                  </div>
                ))}
              </div>
            ) : null}
            {/* eslint-disable-next-line no-restricted-syntax -- S-009: layout-only */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="ml-auto h-8 w-28 rounded-full" />
              <Skeleton className="size-8 rounded-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** The list part of `useInfiniteList` the footers read. */
interface FooterList {
  items: readonly unknown[];
  status: InfiniteListStatus;
  loadMore: () => void;
  retry: () => void;
}

/** Footer of a List tab: sentinel, skeleton rows, end line or Retry Alert. */
export function PublishTabFooter({
  tab,
  list,
}: {
  tab: PublishListTab;
  list: FooterList;
}) {
  return (
    <InfiniteListFooter
      list={list}
      loading={{
        count: 3,
        label: "Memuat posting lainnya",
        renderRow: () => <ListCardSkeleton withMetrics={tab === "history"} />,
        className: "gap-6",
      }}
      endText={TAB_END_TEXT[tab]}
      error={ERROR_COPY}
      // End line and Alert line up with the cards, not the time column.
      endClassName="lg:ml-16"
      errorClassName="lg:ml-16"
    />
  );
}

/** One Board card in loading form. */
export function BoardCardSkeleton() {
  return (
    // eslint-disable-next-line no-restricted-syntax -- S-009: same box as a Board card
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <Skeleton className="h-3 w-24" />
      {/* eslint-disable-next-line no-restricted-syntax -- S-009: layout-only */}
      <div className="flex items-center gap-2">
        <Skeleton className="size-7 rounded-full" />
        <Skeleton className="h-3 w-28" />
      </div>
      {/* eslint-disable-next-line no-restricted-syntax -- S-009: layout-only */}
      <div className="flex items-start gap-2.5">
        {/* eslint-disable-next-line no-restricted-syntax -- S-009: layout-only */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-11/12" />
          <Skeleton className="h-2.5 w-3/5" />
        </div>
        <Skeleton className="size-14 shrink-0 rounded-lg" />
      </div>
    </div>
  );
}

/** Footer of one Board column; the column's card list is the scroll root. */
export function BoardColumnFooter({
  title,
  list,
  rootRef,
}: {
  title: string;
  list: FooterList;
  rootRef: RefObject<Element | null>;
}) {
  return (
    <InfiniteListFooter
      list={list}
      rootRef={rootRef}
      loading={{
        count: 2,
        label: `Memuat posting lainnya di kolom ${title}`,
        renderRow: () => <BoardCardSkeleton />,
      }}
      endText="Tidak ada posting lagi."
      error={ERROR_COPY}
      endClassName="pt-2 pb-3"
      errorClassName="pt-0 pb-1"
    />
  );
}
