/* eslint-disable no-restricted-syntax -- T-224: dikomposisi Tailwind langsung di atas shadcn/ui (ADR-097); layout-only, mengikuti kartu Postific ScreenEngagePerPosting */
import { useRef } from "react";

import type {
  EngagementInboxItemRecord,
  InboxDateRange,
  InboxItemCounts,
  InboxItemStatus,
  InboxPostSort,
} from "@/domains/engagement";

import { Button } from "@/components/ui/button";

import {
  InfiniteListFooter,
  type InfiniteListFooterProps,
} from "../../components/infinite-list/InfiniteListStates";
import {
  DATE_RANGE_OPTIONS,
  SORT_OPTIONS,
  type JustSent,
} from "./engage-model";
import { CommentRow } from "./CommentRow";
import { commentsFooter } from "./EngageSkeletons";
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
  counts,
  list,
  postCaptions,
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
  /** Komentar yang ditampilkan (halaman termuat, sudah sesuai filter Status). */
  comments: EngagementInboxItemRecord[];
  /** Hitungan sebenarnya (count query); `null` selama belum tiba. */
  counts: InboxItemCounts | null;
  list: InfiniteListFooterProps["list"];
  /** `postId` -> caption posting asal, dari halaman yang sudah dimuat. */
  postCaptions: Record<string, string>;
  sort: InboxPostSort;
  dateRange: InboxDateRange;
  timeZone: string;
  replyTarget: EngagementInboxItemRecord | null;
  draft: string;
  isSending: boolean;
  justSent: JustSent;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const footer = commentsFooter(true);
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label;
  const rangeLabel = DATE_RANGE_OPTIONS.find(
    (o) => o.value === dateRange,
  )?.label;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm md:px-3.5 md:py-2.5">
        {counts ? (
          <span>
            <b className="font-semibold">{counts.unread} belum dibalas</b> /{" "}
            {counts.total} komentar
          </span>
        ) : (
          <span className="text-muted-foreground">Memuat komentar</span>
        )}
        <span className="text-xs text-muted-foreground">
          Urut: {sortLabel} · {rangeLabel}
        </span>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col">
          {comments.map((comment) => {
            const caption = comment.postId
              ? postCaptions[comment.postId]
              : undefined;
            return (
              <CommentRow
                key={comment.id}
                comment={comment}
                timeZone={timeZone}
                canReply={comment.postId !== null}
                onReply={() => onReply(comment)}
                onChangeStatus={(status) => onChangeStatus(comment, status)}
                context={
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    onClick={() => onOpenPost(comment)}
                    className="h-auto max-w-full justify-start gap-1.5 p-0 text-xs font-normal text-muted-foreground hover:text-foreground"
                  >
                    <PlatformGlyph platform={comment.platform} size={11} />
                    <span className="min-w-0 truncate">
                      {comment.postId === null
                        ? "Tanpa posting"
                        : `Pada posting: ${caption || "(Tanpa caption)"}`}
                    </span>
                  </Button>
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
          <InfiniteListFooter
            list={list}
            rootRef={scrollRef}
            className="border-t border-border px-3"
            {...footer}
          />
        </div>
      </div>
    </div>
  );
}
