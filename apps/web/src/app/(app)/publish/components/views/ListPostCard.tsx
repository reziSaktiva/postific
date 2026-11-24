"use client";

import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import type { PostId, SocialPlatform } from "@postific/shared";

import { PLATFORM_ICON } from "../../../components/platform-icons";
import { PostPreviewPopover } from "../preview/PostPreview";

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
 * `onOpen` makes the whole card clickable through one button (the caption,
 * stretched over the card); the footer never triggers it. `preview` makes
 * that button the trigger of the post preview popover (T-288, Queue and
 * History; ADR-165 decision 6). Drafts and Approvals use
 * `onOpen` to open the Draft Editor directly.
 */
export function ListPostCard({
  accounts,
  statusBadge,
  caption,
  meta,
  extra,
  footer,
  onOpen,
  preview,
}: {
  accounts?: ReactNode;
  statusBadge: ReactNode;
  caption: string;
  meta?: ReactNode;
  extra?: ReactNode;
  footer?: ReactNode;
  onOpen?: () => void;
  preview?: {
    postId: string;
    connectedAccountId?: string;
    onCancelSchedule?: (postId: PostId) => void;
  };
}) {
  // One real button opens the card: the caption, stretched over the whole
  // card with an overlay (`after:inset-0`). The footer actions are siblings of
  // that button, lifted above the overlay, never its descendants, so no
  // interactive control is nested in another. With a preview, the button is
  // the popover trigger.
  const captionText = (
    <Text variant="p" className="line-clamp-3 text-sm">
      {caption || "(Tanpa caption)"}
    </Text>
  );
  const openButton =
    preview || onOpen ? (
      <button
        type="button"
        onClick={onOpen}
        className="rounded-sm text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring data-[state=open]:after:ring-2 data-[state=open]:after:ring-ring"
      >
        {captionText}
      </button>
    ) : (
      captionText
    );
  const captionNode = preview ? (
    <PostPreviewPopover
      postId={preview.postId}
      connectedAccountId={preview.connectedAccountId}
      onCancelSchedule={preview.onCancelSchedule}
    >
      {openButton}
    </PostPreviewPopover>
  ) : (
    openButton
  );
  return (
    <Card
      size="sm"
      className={cn(
        "relative",
        (preview || onOpen) && "transition-colors hover:bg-muted/40",
      )}
    >
      <CardContent>
        {/* eslint-disable-next-line no-restricted-syntax -- T-289: layout-only */}
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line no-restricted-syntax -- T-289: layout-only */}
          <div className="flex items-start justify-between gap-2">
            {accounts ?? <span />}
            {statusBadge}
          </div>
          {captionNode}
          {extra}
          {meta ? (
            // eslint-disable-next-line no-restricted-syntax -- T-289: layout-only
            <div className="flex flex-wrap items-center gap-2">{meta}</div>
          ) : null}
          {footer ? (
            // eslint-disable-next-line no-restricted-syntax -- T-289: layout-only
            <div className="relative z-10 flex flex-wrap items-center justify-end gap-2">
              {footer}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
