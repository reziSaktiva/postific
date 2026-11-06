/* eslint-disable no-restricted-syntax -- T-219: dikomposisi Tailwind langsung di atas shadcn/ui (ADR-097); layout-only, mengikuti kartu Postific ScreenEngagePerPosting */
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  RepeatIcon,
  SentIcon,
} from "@hugeicons/core-free-icons";

import type {
  EngagementInboxItemRecord,
  InboxItemStatus,
} from "@/domains/engagement";
import { formatRelativeTime } from "@/lib/utils/format-relative-time";
import { getInitials } from "@/lib/utils/get-initials";
import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  NO_POST_REPLY_MESSAGE,
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  availableStatusActions,
} from "./engage-model";

function ActionButton({
  label,
  tooltip,
  disabled,
  onClick,
  icon,
}: {
  label: string;
  tooltip?: string;
  disabled?: boolean;
  onClick: () => void;
  icon: typeof SentIcon;
}) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <HugeiconsIcon icon={icon} strokeWidth={2} />
    </Button>
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Tombol nonaktif tidak memicu tooltip; dibungkus span yang bisa difokus. */}
        {disabled ? (
          <span className="inline-flex rounded-full" tabIndex={0}>
            {button}
          </span>
        ) : (
          button
        )}
      </TooltipTrigger>
      <TooltipContent>{disabled && tooltip ? tooltip : label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Satu komentar (T-219.3, KSP-06-F06). Aksi muncul saat hover atau fokus
 * (pil di pojok kanan atas) dan selalu tampil di layar sempit/perangkat
 * sentuh. Reply tersedia di semua status; pada kelompok "Tanpa posting"
 * nonaktif dengan tooltip (Outstand hanya membalas per posting, ADR-113)
 * sehingga posisi ikon tidak bergeser.
 */
export function CommentRow({
  comment,
  timeZone,
  canReply,
  onReply,
  onChangeStatus,
  context,
  inline,
}: {
  comment: EngagementInboxItemRecord;
  timeZone: string;
  canReply: boolean;
  onReply: () => void;
  onChangeStatus: (status: InboxItemStatus) => void;
  /** Baris konteks "Pada posting: …" (tampilan List). */
  context?: React.ReactNode;
  inline?: React.ReactNode;
}) {
  const actions = availableStatusActions(comment.status);
  const dismissed = comment.status === "dismissed";
  return (
    <div
      data-status={comment.status}
      className={cn(
        "group/comment relative flex gap-2.5 p-3 not-first:border-t not-first:border-border",
        comment.status === "unread" && "bg-muted/40",
      )}
    >
      <Avatar>
        <AvatarFallback className="text-xs">
          {getInitials(comment.authorHandle.replace("@", ""))}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-sm",
              comment.status === "unread" ? "font-bold" : "font-medium",
              dismissed && "text-muted-foreground",
            )}
          >
            {comment.authorHandle}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(comment.receivedAt, timeZone)}
          </span>
          <Badge
            variant={STATUS_BADGE_VARIANT[comment.status]}
            className="md:ml-auto"
          >
            {STATUS_LABEL[comment.status]}
          </Badge>
        </div>
        <p
          className={cn(
            "text-sm leading-snug wrap-anywhere",
            dismissed && "text-muted-foreground",
          )}
        >
          {comment.content}
        </p>
        {context}
        <div
          role="group"
          aria-label={`Aksi untuk komentar ${comment.authorHandle}`}
          className={cn(
            "mt-1 inline-flex gap-1 self-start",
            "md:absolute md:top-1.5 md:right-2 md:mt-0 md:gap-0.5 md:rounded-full md:border md:border-border md:bg-popover md:p-0.5 md:shadow-sm",
            "md:pointer-events-none md:opacity-0 md:transition-opacity md:group-focus-within/comment:pointer-events-auto md:group-focus-within/comment:opacity-100 md:group-hover/comment:pointer-events-auto md:group-hover/comment:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100",
          )}
        >
          <ActionButton
            label="Reply"
            icon={SentIcon}
            disabled={!canReply}
            tooltip={NO_POST_REPLY_MESSAGE}
            onClick={onReply}
          />
          {actions.resolve ? (
            <ActionButton
              label="Resolve"
              icon={CheckmarkCircle02Icon}
              onClick={() => onChangeStatus("resolved")}
            />
          ) : null}
          {actions.dismiss ? (
            <ActionButton
              label="Dismiss"
              icon={Cancel01Icon}
              onClick={() => onChangeStatus("dismissed")}
            />
          ) : null}
          {actions.reopen ? (
            <ActionButton
              label="Buka kembali"
              icon={RepeatIcon}
              onClick={() => onChangeStatus("unread")}
            />
          ) : null}
        </div>
        {inline}
      </div>
    </div>
  );
}
