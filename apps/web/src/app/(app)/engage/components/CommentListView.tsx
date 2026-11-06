/* eslint-disable no-restricted-syntax -- T-224: dikomposisi Tailwind langsung di atas shadcn/ui (ADR-097); layout-only, mengikuti kartu Postific ScreenEngagePerPosting */
import type {
  EngagementInboxItemRecord,
  InboxDateRange,
  InboxItemStatus,
  InboxPostSort,
} from "@/domains/engagement";
import { cn } from "@/lib/utils";

import { Spinner } from "@/components/ui/spinner";

import type { InboxPostGroupDto } from "../actions";
import {
  DATE_RANGE_OPTIONS,
  LIST_VIEW_FETCH_LIMIT,
  SORT_OPTIONS,
  filterByStatus,
  sortComments,
} from "./engage-model";
import { CommentRow } from "./CommentRow";
import { PlatformGlyph } from "./PlatformGlyph";
import { ReplyComposer } from "./ReplyComposer";

/**
 * Tampilan List (T-224.2, KSP-06-F09, rancangan T-216.5): daftar datar
 * komentar lintas posting dengan baris konteks "Pada posting: …" yang
 * membawa pengguna ke tampilan By post. Sort, filter, dan aksi status sama
 * dengan By post; komposer inline di bawah komentar yang dibalas (keputusan
 * King Rezi #4), nonaktif untuk komentar "Tanpa posting" (ADR-113).
 */
export function CommentListView({
  comments,
  isLoading,
  groups,
  statusFilter,
  sort,
  dateRange,
  timeZone,
  replyTarget,
  draft,
  isSending,
  justSent,
  onOpenPost,
  onReply,
  onChangeStatus,
  onDraftChange,
  onCancelReply,
  onSend,
}: {
  comments: EngagementInboxItemRecord[] | null;
  isLoading: boolean;
  groups: InboxPostGroupDto[];
  statusFilter: InboxItemStatus | "all";
  sort: InboxPostSort;
  dateRange: InboxDateRange;
  timeZone: string;
  replyTarget: EngagementInboxItemRecord | null;
  draft: string;
  isSending: boolean;
  justSent: boolean;
  onOpenPost: (comment: EngagementInboxItemRecord) => void;
  onReply: (comment: EngagementInboxItemRecord) => void;
  onChangeStatus: (
    comment: EngagementInboxItemRecord,
    status: InboxItemStatus,
  ) => void;
  onDraftChange: (value: string) => void;
  onCancelReply: () => void;
  onSend: () => void;
}) {
  const all = comments ?? [];
  const shown = sortComments(filterByStatus(all, statusFilter), sort);
  const unread = shown.filter((item) => item.status === "unread").length;
  const truncated = all.length >= LIST_VIEW_FETCH_LIMIT;
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label;
  const rangeLabel = DATE_RANGE_OPTIONS.find(
    (o) => o.value === dateRange,
  )?.label;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm md:px-3.5 md:py-2.5">
        <span>
          <b className="font-semibold">{unread} belum dibalas</b> /{" "}
          {shown.length} komentar
        </span>
        <span className="text-xs text-muted-foreground">
          Urut: {sortLabel} · {rangeLabel}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading || comments === null ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <div className="flex flex-col">
            {shown.map((comment) => {
              const group = groups.find((g) => g.postId === comment.postId);
              const caption = group?.postSnapshot?.caption;
              return (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  timeZone={timeZone}
                  canReply={comment.postId !== null}
                  onReply={() => onReply(comment)}
                  onChangeStatus={(status) => onChangeStatus(comment, status)}
                  context={
                    <button
                      type="button"
                      onClick={() => onOpenPost(comment)}
                      className={cn(
                        "inline-flex max-w-full items-center gap-1.5 self-start rounded text-left text-xs text-muted-foreground outline-none",
                        "hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      <PlatformGlyph platform={comment.platform} size={11} />
                      <span className="min-w-0 truncate">
                        {comment.postId === null
                          ? "Tanpa posting"
                          : `Pada posting: ${caption || "(Tanpa caption)"}`}
                      </span>
                    </button>
                  }
                  inline={
                    replyTarget?.id === comment.id ? (
                      <ReplyComposer
                        inline
                        target={replyTarget}
                        draft={draft}
                        blocked={false}
                        isSending={isSending}
                        justSent={justSent}
                        onDraftChange={onDraftChange}
                        onCancel={onCancelReply}
                        onSend={onSend}
                      />
                    ) : null
                  }
                />
              );
            })}
            {truncated ? (
              <p className="border-t border-border p-3 text-xs text-muted-foreground">
                Menampilkan {LIST_VIEW_FETCH_LIMIT} komentar terbaru. Persempit
                filter atau Date Range untuk melihat yang lain.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
