/* eslint-disable no-restricted-syntax -- T-219: dikomposisi Tailwind langsung di atas shadcn/ui (ADR-097); layout-only, mengikuti kartu Postific ScreenEngagePerPosting */
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  Cancel01Icon,
  Comment01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";

import type {
  EngagementInboxItemRecord,
  InboxItemStatus,
  InboxPostSort,
} from "@/domains/engagement";
import type { ConnectedAccountRecord } from "@/domains/workspace";
import { cn } from "@/lib/utils";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import type { InboxPostGroupDto } from "../actions";
import {
  filterByStatus,
  hasStaleComments,
  sortComments,
  summarizeComments,
  type JustSent,
} from "./engage-model";
import { accountLabel } from "./PostCard";
import { CommentRow } from "./CommentRow";
import { PostPreviewCard } from "./PostPreviewCard";
import { ReplyComposer } from "./ReplyComposer";

/**
 * Panel kanan tampilan By post (T-219.2, KSP-06-F03/F04/F05/F06): kartu
 * pratinjau posting, ringkasan "x dibalas / y total", daftar komentar, dan
 * komposer docked. `comments` = SEMUA komentar kelompok (rentang tanggal
 * bawaan); filter status hanya menyaring daftar, ringkasan tetap atas semuanya.
 */
export function PostCommentsPanel({
  group,
  accounts,
  comments,
  isLoading,
  statusFilter,
  sort,
  timeZone,
  hiddenOnMobile,
  bannerDismissed,
  replyTarget,
  draft,
  isSending,
  justSent,
  onBack,
  onDismissBanner,
  onReply,
  onChangeStatus,
  onDraftChange,
  onCancelReply,
  onSend,
}: {
  group: InboxPostGroupDto;
  accounts: ConnectedAccountRecord[];
  comments: EngagementInboxItemRecord[] | null;
  isLoading: boolean;
  statusFilter: InboxItemStatus | "all";
  sort: InboxPostSort;
  timeZone: string;
  hiddenOnMobile: boolean;
  bannerDismissed: boolean;
  replyTarget: EngagementInboxItemRecord | null;
  draft: string;
  isSending: boolean;
  justSent: JustSent;
  onBack: () => void;
  onDismissBanner: () => void;
  onReply: (comment: EngagementInboxItemRecord) => void;
  onChangeStatus: (
    comment: EngagementInboxItemRecord,
    status: InboxItemStatus,
  ) => void;
  onDraftChange: (value: string) => void;
  onCancelReply: () => void;
  onSend: () => void;
}) {
  const isNoPost = group.postId === null;
  const all = comments ?? [];
  const summary = summarizeComments(all);
  const shown = sortComments(filterByStatus(all, statusFilter), sort);
  const showBanner = !bannerDismissed && hasStaleComments(all);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col",
        hiddenOnMobile && "hidden md:flex",
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2 font-semibold md:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Kembali ke daftar posting"
          onClick={onBack}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
        </Button>
        <span className="min-w-0 truncate">
          {isNoPost ? "Tanpa posting" : accountLabel(group, accounts)}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:px-4 md:py-3.5">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
          {showBanner ? (
            <Alert>
              <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
              <AlertTitle>Fokuskan Engage pada percakapan terbaru</AlertTitle>
              <AlertDescription>
                Beberapa komentar sudah lebih dari sebulan. Menandainya Selesai
                atau Diabaikan menjaga antrean tetap ringkas.
              </AlertDescription>
              <AlertAction>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Tutup informasi"
                  onClick={onDismissBanner}
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                </Button>
              </AlertAction>
            </Alert>
          ) : null}

          {isNoPost ? (
            <Alert>
              <HugeiconsIcon icon={Comment01Icon} strokeWidth={2} />
              <AlertTitle>Komentar tanpa posting</AlertTitle>
              <AlertDescription>
                Komentar ini tidak terhubung ke posting yang tersimpan di
                Postific, misalnya posting dibuat di luar Postific atau belum
                tersinkron. Outstand hanya membalas per posting, jadi komentar
                ini tidak dapat dibalas dari Postific. Resolve, Dismiss, dan
                Buka kembali tetap tersedia.
              </AlertDescription>
            </Alert>
          ) : (
            <PostPreviewCard group={group} accounts={accounts} />
          )}

          {isLoading || comments === null ? (
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <b className="font-semibold">{summary.replied} dibalas</b> /{" "}
                  {summary.total} total komentar
                </span>
                <span className="text-xs text-muted-foreground">
                  {summary.unread} belum dibalas · {summary.handled} dari{" "}
                  {summary.total} ditangani
                </span>
              </div>
              {shown.length > 0 ? (
                <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
                  {shown.map((comment) => (
                    <CommentRow
                      key={comment.id}
                      comment={comment}
                      timeZone={timeZone}
                      canReply={!isNoPost}
                      onReply={() => onReply(comment)}
                      onChangeStatus={(status) =>
                        onChangeStatus(comment, status)
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Posting ini belum punya komentar
                  {statusFilter !== "all" ? " untuk filter ini" : ""}.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <ReplyComposer
        target={replyTarget}
        draft={draft}
        blocked={isNoPost}
        isSending={isSending}
        justSent={justSent}
        onDraftChange={onDraftChange}
        onCancel={onCancelReply}
        onSend={onSend}
      />
    </div>
  );
}
