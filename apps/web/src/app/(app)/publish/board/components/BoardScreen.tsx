"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import { Edit02Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { ContentStatus, MediaType } from "@postific/shared";
import type { CursorPage, PageCursor, PostId } from "@postific/shared";
import type { MediaThumbnailDto } from "@/domains/media";
import {
  buildBoardColumnPageSearch,
  compareBoardCards,
  type BoardColumn,
  type BoardColumnKey,
  type CalendarItemRecord,
} from "@/domains/publishing";
import { ChannelAvatarBadge } from "@/components/shared/ChannelAvatarBadge";
import { McpSourceBadge } from "@/components/shared/McpSourceBadge";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useConfirmAction } from "@/lib/hooks/use-confirm-action";
import { cn } from "@/lib/utils";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";

import { useDraftEditor } from "../../../components/draft-editor/Context";
import {
  CONTENT_STATUS_BADGE_VARIANT,
  CONTENT_STATUS_LABEL,
} from "../../../components/draft-editor/status-badge";
import { MediaThumbnail } from "../../../components/media-thumbnail";
import { formatPublishDateTime } from "../../components/date-time-format";
import { PostPreviewPopover } from "../../components/preview/PostPreview";
import { previewDate } from "../../components/preview/post-preview-model";
import { cancelScheduleAction } from "../../queue/actions";
import { useInfiniteList } from "../../../components/infinite-list/useInfiniteList";
import { BoardColumnFooter } from "../../components/views/PublishListStates";
import { fetchPublishJson } from "../../components/views/publish-page-fetch";

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

const MAX_ACCOUNT_BADGES = 3;

function BoardCard({
  item,
  thumbnail,
  onCancelSchedule,
}: {
  item: CalendarItemRecord;
  thumbnail?: MediaThumbnailDto;
  onCancelSchedule: (postId: PostId) => void;
}) {
  const timeZone = useUserTimeZone();
  const { openEditDraft } = useDraftEditor();
  // Same date as the preview header of this post (one rule, previewDate).
  const when = previewDate(item);
  const firstTarget = item.targets[0];
  const isEditable =
    item.status !== ContentStatus.Published &&
    item.status !== ContentStatus.Imported &&
    item.status !== ContentStatus.Failed;

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-290: Tailwind layout (ADR-097)
    <div className="group/card relative" data-testid="board-card">
      <PostPreviewPopover
        postId={item.id}
        connectedAccountId={firstTarget?.connectedAccountId}
        side="bottom"
        onCancelSchedule={onCancelSchedule}
      >
        <button
          type="button"
          className="flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-ring"
        >
          {}
          <span className="flex items-center gap-2 pr-8 text-xs text-muted-foreground">
            <span className="truncate">
              {when.kind === "none"
                ? "No date"
                : formatPublishDateTime(when.date, timeZone)}
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

const getCardKey = (item: CalendarItemRecord) => item.id;

/**
 * One Board column (S-009): its first 20 cards come from the server, the
 * next 20 load as this column is scrolled, independent of the other
 * columns, through `GET /api/publish/board`. The number in the header is
 * the column's true total (count query). When the server renders the Board
 * again (a mutation revalidated `/publish`), the column starts again from
 * the new first page.
 */
function BoardColumnSection({
  column,
  thumbnails: initialThumbnails,
  onCancelSchedule,
}: {
  column: BoardColumn<CalendarItemRecord>;
  thumbnails: Record<string, MediaThumbnailDto>;
  onCancelSchedule: (postId: PostId) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Thumbnails of pages loaded in the browser, under the server's own.
  const [loadedThumbnails, setThumbnails] = useState<
    Record<string, MediaThumbnailDto>
  >({});
  const thumbnails = useMemo(
    () => ({ ...loadedThumbnails, ...initialThumbnails }),
    [loadedThumbnails, initialThumbnails],
  );
  const loadPage = useCallback(
    async (cursor: PageCursor): Promise<CursorPage<CalendarItemRecord>> => {
      const page = await fetchPublishJson<
        CursorPage<CalendarItemRecord> & {
          thumbnails?: Record<string, MediaThumbnailDto>;
        }
      >(
        `/api/publish/board${buildBoardColumnPageSearch({ column: column.key, cursor })}`,
      );
      if (page.thumbnails) {
        setThumbnails((prev) => ({ ...prev, ...page.thumbnails }));
      }
      return { items: page.items, nextCursor: page.nextCursor };
    },
    [column.key],
  );
  const list = useInfiniteList<CalendarItemRecord>({
    initialPage: column.page,
    loadPage,
    getKey: getCardKey,
    compare: compareBoardCards(column.key),
  });

  // A new server render: start again from its first page.
  const { reset } = list;
  const seenPageRef = useRef(column.page);
  useEffect(() => {
    if (seenPageRef.current === column.page) return;
    seenPageRef.current = column.page;
    reset(column.page);
  }, [column.page, reset]);

  const title = COLUMN_TITLE[column.key];
  return (
    <section
      aria-label={title}
      data-testid={`board-column-${column.key}`}
      // A column takes the full Board height and its cards scroll inside
      // it; the Board itself fills the space left in the viewport, so the
      // page never scrolls on Board (T-292 re-check).
      className="flex min-h-0 w-11/12 shrink-0 snap-center flex-col gap-2 rounded-2xl bg-muted/40 p-2 sm:w-5/12 lg:w-72"
    >
      <header className="flex shrink-0 items-center gap-2 p-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Badge variant="secondary" data-testid="board-column-count">
          {column.total}
        </Badge>
      </header>
      {list.items.length === 0 && list.status === "end" ? (
        <p className="px-1 py-4 text-center text-xs text-muted-foreground">
          {COLUMN_EMPTY[column.key]}
        </p>
      ) : (
        // Contain only vertical overscroll (T-300): `overflow-y-auto` also
        // makes this list a horizontal scroll container, and a plain
        // `overscroll-contain` then swallowed sideways swipes that start
        // on a column with cards, so the Board got stuck on phones.
        // eslint-disable-next-line no-restricted-syntax -- T-290: Tailwind layout (ADR-097)
        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain"
        >
          {list.items.map((item) => (
            <BoardCard
              key={item.id}
              item={item}
              thumbnail={thumbnails[item.id]}
              onCancelSchedule={onCancelSchedule}
            />
          ))}
          <BoardColumnFooter title={title} list={list} rootRef={scrollRef} />
        </div>
      )}
    </section>
  );
}

/**
 * Publish Board (T-290, S-008, ADR-165): the columns Draft · Approvals ·
 * Scheduled · Published · Failed with their counts, side by side with
 * horizontal scroll. Grouping is by Status only; `Ready to Schedule` cards
 * sit in Draft and say so in their status badge. A click on a card opens
 * the post preview (T-288); the menu on a card opens the Draft Editor or
 * copies the caption. A Scheduled card's preview offers Cancel schedule
 * with the same confirm dialog as Calendar and Queue; the action
 * revalidates `/publish`, so the Board re-renders with the post in Draft.
 *
 * Tablet and phone (T-292): below `lg` a column takes 5/12 of the width, so
 * about two columns show; below `sm` one column fills the screen and the
 * row snaps column by column. Card menus are always visible below `sm` and
 * on touch.
 */
export function BoardScreen({
  columns,
  thumbnails,
}: {
  columns: BoardColumn<CalendarItemRecord>[];
  thumbnails: Record<string, MediaThumbnailDto>;
}) {
  const cancelConfirm = useConfirmAction<PostId>(cancelScheduleAction, () =>
    toast("Jadwal dibatalkan — post kembali ke Drafts"),
  );

  return (
    <>
      {cancelConfirm.error ? (
        <Alert variant="destructive" className="shrink-0">
          <AlertTitle>{cancelConfirm.error}</AlertTitle>
        </Alert>
      ) : null}
      {/* The row keeps horizontal overscroll (T-300): a swipe past Draft or
          Failed must not reach the page, where it can trigger the browser's
          swipe-back navigation. */}
      {/* eslint-disable-next-line no-restricted-syntax -- T-290: Tailwind layout (ADR-097) */}
      <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-2 sm:snap-none">
        {columns.map((column) => (
          <BoardColumnSection
            key={column.key}
            column={column}
            thumbnails={thumbnails}
            onCancelSchedule={(postId) => cancelConfirm.open(postId)}
          />
        ))}
      </div>

      <AlertDialog
        open={cancelConfirm.isOpen}
        onOpenChange={(open) => {
          if (!open) cancelConfirm.close();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan jadwal ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Post kembali menjadi Draft dan tidak akan dipublikasikan otomatis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelConfirm.isLoading}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelConfirm.isLoading}
              onClick={(e) => {
                e.preventDefault();
                void cancelConfirm.confirm();
              }}
            >
              {cancelConfirm.isLoading ? <Spinner /> : null}
              Batalkan Jadwal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
