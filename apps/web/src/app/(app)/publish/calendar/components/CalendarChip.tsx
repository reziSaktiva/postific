"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons";

import { ContentStatus, MediaType, type PostId } from "@postific/shared";
import type { MediaThumbnailDto } from "@/domains/media";

import { cn } from "@/lib/utils";

import { CONTENT_STATUS_LABEL } from "../../../components/draft-editor/status-badge";
import { PLATFORM_ICON } from "../../../components/platform-icons";
import { PostPreviewPopover } from "../../components/preview/PostPreview";
import type { CalendarCardEntry } from "./calendar-grid-shared";

const STATUS_ICON = {
  [ContentStatus.Scheduled]: Clock01Icon,
  [ContentStatus.Published]: CheckmarkCircle02Icon,
  [ContentStatus.Imported]: CheckmarkCircle02Icon,
  [ContentStatus.Failed]: AlertCircleIcon,
} as const;

const STATUS_COLOR: Partial<Record<ContentStatus, string>> = {
  [ContentStatus.Published]: "text-success",
  [ContentStatus.Imported]: "text-success",
  [ContentStatus.Failed]: "text-destructive",
};

/** Small thumbnail of a chip: the image, or a tile with the play mark for a video (no video is loaded for a chip). */
function ChipThumbnail({ thumbnail }: { thumbnail: MediaThumbnailDto }) {
  return (
    <span
      aria-hidden="true"
      className="relative hidden size-5.5 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted xl:inline-flex"
    >
      {thumbnail.type === MediaType.Video ? (
        <HugeiconsIcon icon={PlayIcon} className="size-3" strokeWidth={2} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
        <img
          src={thumbnail.url}
          alt=""
          className="size-full object-cover"
          loading="lazy"
        />
      )}
    </span>
  );
}

export interface CalendarChipProps {
  entry: CalendarCardEntry;
  thumbnail?: MediaThumbnailDto;
  /** Platform icon only (narrow cells); time and status stay in the label. */
  iconOnly?: boolean;
  /** Show the caption after the time (day list of "+N lainnya"). */
  showCaption?: boolean;
  onCancelSchedule?: (postId: PostId) => void;
}

/**
 * One post chip of the Calendar (T-287, S-008, design `ScreenPublishRedesain`):
 * platform icon, time, status icon and a thumbnail with a play mark for a
 * video. One chip per post target. A click opens the post preview
 * (`PostPreviewPopover`, T-288).
 * Dashed border for a post that is not scheduled yet. The thumbnail hides
 * below 1280 px so chips do not overflow around 1024 px.
 */
export function CalendarChip({
  entry,
  thumbnail,
  iconOnly = false,
  showCaption = false,
  onCancelSchedule,
}: CalendarChipProps) {
  const platform = PLATFORM_ICON[entry.platform];
  const PlatformGlyph = platform.Icon;
  const statusIcon = STATUS_ICON[entry.status as keyof typeof STATUS_ICON];
  const label = `${platform.label}, ${entry.accountHandle}, ${entry.timeLabel}, ${CONTENT_STATUS_LABEL[entry.status]}${
    entry.caption ? `, ${entry.caption}` : ""
  }`;

  return (
    <PostPreviewPopover
      postId={entry.postId}
      connectedAccountId={entry.connectedAccountId}
      onCancelSchedule={onCancelSchedule}
    >
      <button
        type="button"
        aria-label={label}
        title={label}
        className={cn(
          "flex min-h-8 w-full min-w-0 items-center gap-1.5 rounded-lg border border-border bg-card py-1 pr-1 pl-1.5 text-left text-xs tabular-nums transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-ring",
          iconOnly && "size-8 min-h-8 w-8 justify-center p-0",
        )}
      >
        <PlatformGlyph size={14} color={platform.color} />
        {iconOnly ? null : (
          <>
            <span className="font-semibold whitespace-nowrap">
              {entry.timeLabel}
            </span>
            {showCaption ? (
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {entry.caption || "(Tanpa caption)"}
              </span>
            ) : (
              <span className="flex-1" />
            )}
            {statusIcon ? (
              <HugeiconsIcon
                icon={statusIcon}
                className={cn(
                  "size-3.5 shrink-0 text-muted-foreground",
                  STATUS_COLOR[entry.status],
                )}
                strokeWidth={2}
              />
            ) : null}
            {thumbnail ? <ChipThumbnail thumbnail={thumbnail} /> : null}
          </>
        )}
      </button>
    </PostPreviewPopover>
  );
}
