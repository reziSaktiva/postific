"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Edit02Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { ContentStatus, MediaType } from "@postific/shared";
import type { MediaThumbnailDto } from "@/domains/media";
import {
  BOARD_COLUMN_LIMIT,
  type BoardColumn,
  type BoardColumnKey,
  type CalendarItemRecord,
} from "@/domains/publishing";
import { ChannelAvatarBadge } from "@/components/shared/ChannelAvatarBadge";
import { McpSourceBadge } from "@/components/shared/McpSourceBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";
import { getZonedFormatter } from "@/lib/time/zoned-formatter";

import { useDraftEditor } from "../../../components/draft-editor/Context";
import {
  CONTENT_STATUS_BADGE_VARIANT,
  CONTENT_STATUS_LABEL,
} from "../../../components/draft-editor/status-badge";
import { MediaThumbnail } from "../../../components/media-thumbnail";
import { PostPreviewPopover } from "../../components/preview/PostPreview";

const COLUMN_TITLE: Record<BoardColumnKey, string> = {
  draft: "Draft",
  approvals: "Approvals",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
};

const COLUMN_EMPTY: Record<BoardColumnKey, string> = {
  draft: "Belum ada draft.",
  approvals: "Tidak ada yang menunggu review.",
  scheduled: "Belum ada posting terjadwal.",
  published: "Belum ada posting yang terbit.",
  failed: "Tidak ada posting gagal.",
};

const dateFormatter = (timeZone: string) =>
  getZonedFormatter(
    "id-ID",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
    timeZone,
  );

const MAX_ACCOUNT_BADGES = 3;

function BoardCard({
  item,
  thumbnail,
}: {
  item: CalendarItemRecord;
  thumbnail?: MediaThumbnailDto;
}) {
  const timeZone = useUserTimeZone();
  const { openEditDraft } = useDraftEditor();
  const date = item.scheduledAt ?? item.publishedAt;
  const firstTarget = item.targets[0];
  const isEditable =
    item.status !== ContentStatus.Published &&
    item.status !== ContentStatus.Imported &&
    item.status !== ContentStatus.Failed;

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-290: Tailwind layout (ADR-097)
    <div className="group/card relative">
      <PostPreviewPopover
        postId={item.id}
        connectedAccountId={firstTarget?.connectedAccountId}
        side="bottom"
      >
        <button
          type="button"
          className="flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-ring"
        >
          {}
          <span className="flex items-center gap-2 pr-8 text-xs text-muted-foreground">
            <span className="truncate">
              {date ? dateFormatter(timeZone).format(date) : "No date"}
            </span>
          </span>
          {}
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge variant={CONTENT_STATUS_BADGE_VARIANT[item.status]}>
              {CONTENT_STATUS_LABEL[item.status]}
            </Badge>
            <McpSourceBadge
              createdVia={item.createdVia}
              clientName={item.createdViaClientName}
            />
          </span>
          {}
          <span className="flex items-start gap-2">
            <span className="line-clamp-3 min-w-0 flex-1 text-sm break-words whitespace-pre-wrap">
              {item.caption || "(Tanpa caption)"}
            </span>
            {thumbnail ? (
              <span className="size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                {thumbnail.type === MediaType.Video ? (
                  // A video is not loaded for a card: the player is in the preview.
                  <span className="flex size-full items-center justify-center text-xs text-muted-foreground">
                    Video
                  </span>
                ) : (
                  <MediaThumbnail
                    url={thumbnail.url}
                    type={thumbnail.type}
                    alt=""
                  />
                )}
              </span>
            ) : null}
          </span>
          {item.targets.length > 0 ? (
            <span className="flex items-center gap-1.5">
              {item.targets.slice(0, MAX_ACCOUNT_BADGES).map((target) => (
                <ChannelAvatarBadge
                  key={target.id}
                  handle={target.accountHandle}
                  platform={target.platform}
                />
              ))}
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {firstTarget?.accountHandle}
                {item.targets.length > 1 ? ` +${item.targets.length - 1}` : ""}
              </span>
            </span>
          ) : null}
        </button>
      </PostPreviewPopover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Aksi posting"
            className={cn(
              "absolute top-2 right-2 opacity-0 transition-opacity group-focus-within/card:opacity-100 group-hover/card:opacity-100 max-sm:opacity-100 pointer-coarse:opacity-100",
            )}
          >
            <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isEditable ? (
            <DropdownMenuItem onSelect={() => openEditDraft(item.id)}>
              <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
              Edit
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={() => {
              void navigator.clipboard
                .writeText(item.caption)
                .then(() => toast("Caption disalin"))
                .catch(() => toast.error("Caption tidak bisa disalin"));
            }}
          >
            Salin caption
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Publish Board (T-290, S-008, ADR-165): the columns Draft · Approvals ·
 * Scheduled · Published · Failed with their counts, side by side with
 * horizontal scroll. Grouping is by Status only; `Ready to Schedule` cards
 * sit in Draft and say so in their status badge. A click on a card opens
 * the post preview (T-288); the menu on a card opens the Draft Editor or
 * copies the caption.
 */
export function BoardScreen({
  columns,
  thumbnails,
}: {
  columns: BoardColumn<CalendarItemRecord>[];
  thumbnails: Record<string, MediaThumbnailDto>;
}) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- T-290: Tailwind layout (ADR-097)
    <div className="flex items-start gap-3 overflow-x-auto pb-2">
      {columns.map((column) => (
        <section
          key={column.key}
          aria-label={COLUMN_TITLE[column.key]}
          className="flex w-72 shrink-0 flex-col gap-2 rounded-2xl bg-muted/40 p-2"
        >
          {}
          <header className="flex items-center gap-2 p-1">
            <h2 className="text-sm font-semibold">
              {COLUMN_TITLE[column.key]}
            </h2>
            <Badge variant="secondary">
              {column.hasMore ? `${BOARD_COLUMN_LIMIT}+` : column.total}
            </Badge>
          </header>
          {column.items.length === 0 ? (
            <p className="px-1 py-4 text-center text-xs text-muted-foreground">
              {COLUMN_EMPTY[column.key]}
            </p>
          ) : (
            column.items.map((item) => (
              <BoardCard
                key={item.id}
                item={item}
                thumbnail={thumbnails[item.id]}
              />
            ))
          )}
        </section>
      ))}
    </div>
  );
}
