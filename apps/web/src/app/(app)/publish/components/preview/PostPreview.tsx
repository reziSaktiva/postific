"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Analytics01Icon,
  ArrowExpand01Icon,
  Edit02Icon,
  LinkSquare01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";

import { ContentStatus } from "@postific/shared";
import type { PostId } from "@postific/shared";
import { ChannelAvatarBadge } from "@/components/shared/ChannelAvatarBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { getZonedFormatter } from "@/lib/time/zoned-formatter";

import { useDraftEditor } from "../../../components/draft-editor/Context";
import {
  CONTENT_STATUS_BADGE_VARIANT,
  CONTENT_STATUS_LABEL,
} from "../../../components/draft-editor/status-badge";
import { MediaThumbnail } from "../../../components/media-thumbnail";
import {
  formatEngagementRate,
  formatMetricCount,
  MetricTile,
} from "../../../components/post-metric-tile";
import {
  CONTENT_FORMAT_LABEL,
  chipTimeFormatter,
} from "../../calendar/components/calendar-grid-shared";
import { HistoryDetail } from "../../history/[postId]/components/HistoryDetail";
import { RetryTargetButton } from "../../history/[postId]/components/RetryTargetButton";
import { getPostPreviewAction, type PostPreviewData } from "./actions";
import {
  pickFocusTarget,
  previewDate,
  previewFooterAction,
} from "./post-preview-model";

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; data: PostPreviewData };

/**
 * Loads the preview data of a post when the component mounts. The popover
 * content and the dialog only mount while open, so every opening reads the
 * current status, metrics and media of the post.
 */
function usePostPreviewData(postId: string): LoadState {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    getPostPreviewAction(postId)
      .then((data) => {
        if (cancelled) return;
        setState(data ? { status: "ready", data } : { status: "missing" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);
  return state;
}

const headerDateFormatter = (timeZone: string) =>
  getZonedFormatter(
    "id-ID",
    { day: "numeric", month: "short", year: "numeric" },
    timeZone,
  );

/** Date and time of the preview; the time is the chips' HH:mm (24 h, ":"). */
const headerFormatter = (timeZone: string) => ({
  format: (date: Date) =>
    `${headerDateFormatter(timeZone).format(date)} ${chipTimeFormatter(timeZone).format(date)}`,
});

const HEADLINE_PREFIX = {
  published: "Dipublikasikan",
  failed: "Gagal",
  scheduled: "Dijadwalkan",
} as const;

function PopoverBody({
  data,
  connectedAccountId,
  onExpand,
  onClose,
  onCancelSchedule,
}: {
  data: PostPreviewData;
  connectedAccountId?: string;
  onExpand: () => void;
  onClose: () => void;
  onCancelSchedule?: (postId: PostId) => void;
}) {
  const timeZone = useUserTimeZone();
  const { openEditDraft } = useDraftEditor();
  const { item, thumbnail } = data;
  const target = pickFocusTarget(item, connectedAccountId);
  const when = previewDate(item);
  const action = previewFooterAction(item.status);
  const metric =
    item.metrics?.find(
      (candidate) =>
        candidate.connectedAccountId === target?.connectedAccountId,
    ) ?? null;
  const showMetrics = item.status === ContentStatus.Published;

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-288: Tailwind layout (ADR-097)
    <div className="flex flex-col">
      {/* eslint-disable-next-line no-restricted-syntax -- T-288 */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm">
        <b className="min-w-0 truncate">
          {when.kind === "none"
            ? "Tanpa tanggal"
            : `${HEADLINE_PREFIX[when.kind]} ${headerFormatter(timeZone).format(when.date)}`}
        </b>
        {target ? (
          <Badge variant="outline">
            {CONTENT_FORMAT_LABEL[target.contentFormat]}
          </Badge>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          aria-label="Perbesar"
          onClick={onExpand}
        >
          <HugeiconsIcon icon={ArrowExpand01Icon} strokeWidth={2} />
        </Button>
      </div>

      {/* eslint-disable-next-line no-restricted-syntax -- T-288 */}
      <div className="flex flex-col gap-3 p-3">
        {target ? (
          // eslint-disable-next-line no-restricted-syntax -- T-288
          <div className="flex items-center gap-2">
            <ChannelAvatarBadge
              handle={target.accountHandle}
              platform={target.platform}
            />
            <b className="min-w-0 flex-1 truncate text-sm">
              {target.accountHandle}
            </b>
            <Badge variant={CONTENT_STATUS_BADGE_VARIANT[item.status]}>
              {CONTENT_STATUS_LABEL[item.status]}
            </Badge>
          </div>
        ) : null}

        <p className="line-clamp-4 text-sm break-words whitespace-pre-wrap">
          {item.caption || "(Tanpa caption)"}
        </p>

        {thumbnail ? (
          // eslint-disable-next-line no-restricted-syntax -- T-288: media box, the video keeps its native controls
          <div className="max-h-80 overflow-hidden rounded-lg border border-border bg-muted">
            <MediaThumbnail
              url={thumbnail.url}
              type={thumbnail.type}
              alt="Media post"
              fit="natural"
              className="max-h-80 object-contain"
            />
          </div>
        ) : null}

        {item.status === ContentStatus.Failed ? (
          <Alert variant="destructive">
            <AlertTitle>Publish gagal</AlertTitle>
            <AlertDescription>
              {target?.error ?? "Gagal dipublikasikan."}
            </AlertDescription>
          </Alert>
        ) : null}
        {item.status === ContentStatus.Scheduled &&
        when.kind === "scheduled" ? (
          <p className="text-xs text-muted-foreground">
            Akan dipublikasikan otomatis{" "}
            {headerFormatter(timeZone).format(when.date)}.
          </p>
        ) : null}
      </div>

      {showMetrics ? (
        // eslint-disable-next-line no-restricted-syntax -- T-288
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          {metric ? (
            // eslint-disable-next-line no-restricted-syntax -- T-288
            <div className="flex flex-1 flex-wrap gap-2">
              <MetricTile
                label="Views"
                value={formatMetricCount(metric.impressions)}
              />
              <MetricTile
                label="Reach"
                value={formatMetricCount(metric.reach)}
              />
              <MetricTile
                label="Replies"
                value={formatMetricCount(metric.comments)}
              />
              <MetricTile
                label="Eng. Rate"
                value={formatEngagementRate(metric.engagementRate)}
              />
            </div>
          ) : (
            <span className="flex-1 text-xs text-muted-foreground">
              Belum ada data
            </span>
          )}
          <Button
            asChild
            variant="outline"
            size="icon-sm"
            aria-label="Lihat insight posting"
          >
            <Link href="/analyze" onClick={onClose}>
              <HugeiconsIcon icon={Analytics01Icon} strokeWidth={2} />
            </Link>
          </Button>
        </div>
      ) : null}

      {/* eslint-disable-next-line no-restricted-syntax -- T-288 */}
      <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
        {action === "go-to-post" ? (
          target?.platformPostUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={target.platformPostUrl} target="_blank" rel="noreferrer">
                <HugeiconsIcon icon={LinkSquare01Icon} strokeWidth={2} />
                Go to post
              </a>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <HugeiconsIcon icon={LinkSquare01Icon} strokeWidth={2} />
              Go to post
            </Button>
          )
        ) : null}
        {action === "retry" && target ? (
          <RetryTargetButton postId={item.id} targetId={target.id} />
        ) : null}
        {action === "edit" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onClose();
              openEditDraft(item.id);
            }}
          >
            <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
            Edit
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Aksi lainnya">
              <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
            {item.status === ContentStatus.Scheduled && onCancelSchedule ? (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  onClose();
                  onCancelSchedule(item.id);
                }}
              >
                Batalkan jadwal
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function LoadingBody({ missing }: { missing: boolean }) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- T-288: Tailwind layout (ADR-097)
    <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
      {missing ? (
        "Posting tidak ditemukan."
      ) : (
        <>
          <Spinner /> Memuat
        </>
      )}
    </div>
  );
}

function PopoverContentBody(props: {
  postId: string;
  connectedAccountId?: string;
  onExpand: () => void;
  onClose: () => void;
  onCancelSchedule?: (postId: PostId) => void;
}) {
  const state = usePostPreviewData(props.postId);
  if (state.status !== "ready") {
    return <LoadingBody missing={state.status === "missing"} />;
  }
  return (
    <PopoverBody
      data={state.data}
      connectedAccountId={props.connectedAccountId}
      onExpand={props.onExpand}
      onClose={props.onClose}
      onCancelSchedule={props.onCancelSchedule}
    />
  );
}

export interface PostPreviewPopoverProps {
  /** Post to preview; the data is fetched when the popover opens. */
  postId: string;
  /** Account of the clicked chip or card; without it the first account is shown. */
  connectedAccountId?: string;
  /** The trigger (a chip or a card), wrapped with `PopoverTrigger asChild`: one element that takes a click and focus. */
  children: ReactNode;
  /** Opens the Cancel Schedule confirmation of the page; without it the menu has no such item. */
  onCancelSchedule?: (postId: PostId) => void;
  align?: "start" | "center" | "end";
  /** Default: below the trigger on a phone, to the right otherwise. */
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Post preview popover (T-288, S-008, ADR-165), shared by Calendar chips,
 * Queue and History cards and Board cards: date and time, content format and
 * Expand; account and status; caption; media (a video plays inline with the
 * native player); metrics and an insights link for a published post; the
 * footer action by status (Go to post, Retry, Edit) and a more-actions menu.
 * Expand closes the popover and opens `PostPreviewDialog`.
 */
export function PostPreviewPopover({
  postId,
  connectedAccountId,
  children,
  onCancelSchedule,
  align = "start",
  side,
}: PostPreviewPopoverProps) {
  const isMobile = useIsMobile();
  const resolvedSide = side ?? (isMobile ? "bottom" : "right");
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent
          align={align}
          side={resolvedSide}
          collisionPadding={12}
          // eslint-disable-next-line tailwindcss/no-arbitrary-value -- T-288: design width 400 px, capped to the viewport
          className="w-100 max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden p-0"
          aria-label="Pratinjau posting"
        >
          <PopoverContentBody
            postId={postId}
            connectedAccountId={connectedAccountId}
            onExpand={() => {
              setIsOpen(false);
              setIsExpanded(true);
            }}
            onClose={() => setIsOpen(false)}
            onCancelSchedule={onCancelSchedule}
          />
        </PopoverContent>
      </Popover>
      {isExpanded ? (
        <PostPreviewDialog
          postId={postId}
          open
          onOpenChange={(open) => {
            if (!open) setIsExpanded(false);
          }}
        />
      ) : null}
    </>
  );
}

export interface PostPreviewDialogProps {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Expanded post preview (T-288, S-008): the History Detail dialog, for a post
 * in any status. It shows the caption, the media (a video plays inline), the
 * result of every account of the post and "Dipublikasikan via <network>".
 * Mounts its content only while `open`, so each opening reads fresh data.
 */
export function PostPreviewDialog({
  postId,
  open,
  onOpenChange,
}: PostPreviewDialogProps) {
  if (!open) return null;
  return (
    <PostPreviewDialogContent postId={postId} onOpenChange={onOpenChange} />
  );
}

function PostPreviewDialogContent({
  postId,
  onOpenChange,
}: {
  postId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const state = usePostPreviewData(postId);
  if (state.status === "ready") {
    return (
      <HistoryDetail
        item={state.data.item}
        thumbnail={state.data.thumbnail}
        open
        onOpenChange={onOpenChange}
      />
    );
  }
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="sr-only">Detail posting</DialogTitle>
        <DialogDescription className="sr-only">
          Pratinjau posting, hasil per akun, dan media.
        </DialogDescription>
        <LoadingBody missing={state.status === "missing"} />
      </DialogContent>
    </Dialog>
  );
}
