"use client";

import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import type { SocialPlatform } from "@postific/shared";

import { PLATFORM_ICON } from "../../../components/platform-icons";

/** Platform glyph and handle of each account a post goes to. */
export function ListAccounts({
  targets,
}: {
  targets: { id: string; platform: SocialPlatform; accountHandle: string }[];
}) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- T-289: layout-only
    <div className="flex flex-wrap items-center gap-3">
      {targets.map((target) => {
        const Glyph = PLATFORM_ICON[target.platform].Icon;
        return (
          // eslint-disable-next-line no-restricted-syntax -- T-289: layout-only
          <div className="flex items-center gap-1" key={target.id}>
            <Glyph size={14} color={PLATFORM_ICON[target.platform].color} />
            <Text variant="small" as="span" className="font-medium">
              {target.accountHandle}
            </Text>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Card of a List tab (T-289): accounts and status on top, caption, optional
 * extra content (metrics, error), meta line and a footer of actions.
 * `onOpen` makes the whole card clickable; the footer never triggers it.
 */
export function ListPostCard({
  accounts,
  statusBadge,
  caption,
  meta,
  extra,
  footer,
  onOpen,
}: {
  accounts?: ReactNode;
  statusBadge: ReactNode;
  caption: string;
  meta?: ReactNode;
  extra?: ReactNode;
  footer?: ReactNode;
  onOpen?: () => void;
}) {
  return (
    <Card
      size="sm"
      className={cn(
        onOpen && "cursor-pointer transition-colors hover:bg-muted/40",
      )}
      {...(onOpen
        ? {
            role: "button",
            tabIndex: 0,
            onClick: onOpen,
            onKeyDown: (event) => {
              if (
                event.target === event.currentTarget &&
                (event.key === "Enter" || event.key === " ")
              ) {
                event.preventDefault();
                onOpen();
              }
            },
          }
        : {})}
    >
      <CardContent>
        {/* eslint-disable-next-line no-restricted-syntax -- T-289: layout-only */}
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line no-restricted-syntax -- T-289: layout-only */}
          <div className="flex items-start justify-between gap-2">
            {accounts ?? <span />}
            {statusBadge}
          </div>
          <Text variant="p" className="line-clamp-3 text-sm">
            {caption || "(Tanpa caption)"}
          </Text>
          {extra}
          {meta ? (
            // eslint-disable-next-line no-restricted-syntax -- T-289: layout-only
            <div className="flex flex-wrap items-center gap-2">{meta}</div>
          ) : null}
          {footer ? (
            // eslint-disable-next-line no-restricted-syntax -- T-289: layout-only
            <div
              className="flex flex-wrap items-center justify-end gap-2"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
