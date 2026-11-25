"use client";

import type { ReactNode, RefObject } from "react";

import { AlertCircleIcon, Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import type { InfiniteListStatus } from "./infinite-list-state";
import { InfiniteListSentinel } from "./InfiniteListSentinel";

/*
 * The three list-end states of every infinite-scroll list, as confirmed in
 * `ScreenInfiniteScrollStates` (Postific artifact, 2026-11-25; ADR-166).
 * Copy is passed in by each section, in the language of its screen
 * (`key-screen-patterns.md`, Pattern: Long Lists).
 */

export interface InfiniteListLoadingProps {
  /** Skeleton rows shaped like this list's items (2 or 3). */
  count?: 2 | 3;
  /** Draws one skeleton row, built from `Skeleton`. */
  renderRow: (index: number) => ReactNode;
  /** Read by screen readers, e.g. "Memuat posting lainnya". */
  label: string;
  className?: string;
}

/** Loading the next page: skeleton rows under the items already shown. */
export function InfiniteListLoading({
  count = 3,
  renderRow,
  label,
  className,
}: InfiniteListLoadingProps) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- T-301: status region wrapping the skeleton rows
    <div
      role="status"
      aria-busy="true"
      data-slot="infinite-list-loading"
      className={cn("flex flex-col gap-2", className)}
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        // eslint-disable-next-line no-restricted-syntax -- T-301: hides each skeleton row from screen readers
        <div key={index} aria-hidden="true">
          {renderRow(index)}
        </div>
      ))}
    </div>
  );
}

export interface InfiniteListEndProps {
  /** E.g. "Sudah sampai posting terlama.". */
  text: string;
  className?: string;
}

/** End of the list: one short muted line. */
export function InfiniteListEnd({ text, className }: InfiniteListEndProps) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- T-301: centring wrapper for the end line
    <div
      data-slot="infinite-list-end"
      className={cn(
        "flex justify-center px-3 pt-4 pb-5 text-center",
        className,
      )}
    >
      <Text variant="muted">{text}</Text>
    </div>
  );
}

export interface InfiniteListErrorProps {
  /** E.g. "Gagal memuat posting lainnya". */
  title: string;
  /** E.g. "Periksa koneksi, lalu coba lagi.". */
  description: string;
  /** E.g. "Coba Lagi" (Notifications: "Retry"). */
  retryLabel: string;
  onRetry: () => void;
  className?: string;
}

/** A page failed: inline destructive Alert with Retry; loaded items stay. */
export function InfiniteListError({
  title,
  description,
  retryLabel,
  onRetry,
  className,
}: InfiniteListErrorProps) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- T-301: spacing wrapper around the error Alert
    <div data-slot="infinite-list-error" className={cn("pt-2 pb-4", className)}>
      <Alert variant="destructive">
        <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          <span>{description}</span>
          {/* eslint-disable-next-line no-restricted-syntax -- T-301: puts the Retry button on its own line */}
          <div className="mt-2.5 flex">
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              <HugeiconsIcon
                icon={Refresh01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              {retryLabel}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}

export interface InfiniteListFooterProps {
  /** The `useInfiniteList` result (or the parts of it used here). */
  list: {
    items: readonly unknown[];
    status: InfiniteListStatus;
    loadMore: () => void;
    retry: () => void;
  };
  loading: Omit<InfiniteListLoadingProps, "className"> & {
    className?: string;
  };
  endText: string;
  error: Omit<InfiniteListErrorProps, "onRetry" | "className">;
  /** The scrolling element, when it is not the page (Board column, panel). */
  rootRef?: RefObject<Element | null>;
  rootMargin?: string;
  /** Wrapper class, e.g. to line the states up with the item column. */
  className?: string;
  /** Extra class for the end line or the error Alert wrapper. */
  endClassName?: string;
  errorClassName?: string;
}

/**
 * Goes after the last item and shows the one thing that fits the list's
 * status: the sentinel (more to load), the loading rows, the end line, or
 * the error Alert. A list with no items at the end renders nothing here, so
 * its existing empty state stays the only message.
 */
export function InfiniteListFooter({
  list,
  loading,
  endText,
  error,
  rootRef,
  rootMargin,
  className,
  endClassName,
  errorClassName,
}: InfiniteListFooterProps) {
  let body: ReactNode;
  switch (list.status) {
    case "idle":
      body = (
        <InfiniteListSentinel
          onVisible={list.loadMore}
          rootRef={rootRef}
          rootMargin={rootMargin}
        />
      );
      break;
    case "loading":
      body = <InfiniteListLoading {...loading} />;
      break;
    case "end":
      if (list.items.length === 0) return null;
      body = <InfiniteListEnd text={endText} className={endClassName} />;
      break;
    case "error":
      body = (
        <InfiniteListError
          {...error}
          onRetry={list.retry}
          className={errorClassName}
        />
      );
      break;
  }
  return (
    // eslint-disable-next-line no-restricted-syntax -- T-301: footer wrapper carrying data-status
    <div
      data-slot="infinite-list-footer"
      data-status={list.status}
      className={className}
    >
      {body}
    </div>
  );
}
