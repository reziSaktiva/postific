"use client";

import type { ReactNode } from "react";

import { Text } from "@/components/ui/text";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";

import { formatListDayHeading, formatListTime } from "./list-format";

/**
 * Posts of a List tab grouped by day, the time on the left of each card
 * (above it below `lg`, so on tablet and phone, T-292), as the Publish
 * design shows (T-289, S-008).
 * Presentational: groups, time and card come from the caller.
 */
export function ListDayGroups<T extends { id: string }>({
  groups,
  getTime,
  renderCard,
}: {
  groups: { date: string; items: T[] }[];
  getTime: (item: T) => Date;
  renderCard: (item: T) => ReactNode;
}) {
  const timeZone = useUserTimeZone();
  return (
    // eslint-disable-next-line no-restricted-syntax -- T-289: Tailwind layout composition (ADR-097)
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section className="flex flex-col gap-3" key={group.date}>
          <Text variant="h4" as="h3">
            {formatListDayHeading(group.date)}
          </Text>
          {group.items.map((item) => (
            // eslint-disable-next-line no-restricted-syntax -- T-289: layout-only
            <div
              className="flex flex-col gap-1 lg:flex-row lg:gap-4"
              key={item.id}
            >
              <Text
                variant="muted"
                as="span"
                suppressHydrationWarning
                className="shrink-0 text-xs lg:w-12 lg:pt-4"
              >
                {formatListTime(getTime(item), timeZone)}
              </Text>
              {/* eslint-disable-next-line no-restricted-syntax -- T-289: layout-only */}
              <div className="min-w-0 flex-1">{renderCard(item)}</div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
