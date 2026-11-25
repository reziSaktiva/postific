"use client";

import { useEffect, useRef, type RefObject } from "react";

import { cn } from "@/lib/utils";

/** Starts the next page this far before the end of the list comes into view. */
export const INFINITE_LIST_ROOT_MARGIN = "0px 0px 400px 0px";

export interface InfiniteListSentinelProps {
  /** Called when the sentinel comes near view. */
  onVisible: () => void;
  /**
   * The element that scrolls (a Board column, the Notifications panel).
   * Leave it out when the page itself scrolls.
   */
  rootRef?: RefObject<Element | null>;
  rootMargin?: string;
  className?: string;
}

/**
 * An invisible line after the last item that asks for the next page as it
 * scrolls near view (ADR-166). An observer only reports changes, so when a
 * short page leaves the sentinel in view the caller mounts it again after
 * each load; `InfiniteListFooter` does this by showing the loading rows in
 * its place while a page loads.
 */
export function InfiniteListSentinel({
  onVisible,
  rootRef,
  rootMargin = INFINITE_LIST_ROOT_MARGIN,
  className,
}: InfiniteListSentinelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onVisibleRef = useRef(onVisible);
  useEffect(() => {
    onVisibleRef.current = onVisible;
  }, [onVisible]);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onVisibleRef.current();
        }
      },
      { root: rootRef?.current ?? null, rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [rootRef, rootMargin]);

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-301: invisible scroll marker, no shadcn equivalent
    <div
      ref={ref}
      aria-hidden="true"
      data-slot="infinite-list-sentinel"
      className={cn("h-px w-full", className)}
    />
  );
}
