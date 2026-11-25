/* eslint-disable no-restricted-syntax -- T-219: dikomposisi Tailwind langsung di atas shadcn/ui (ADR-097); layout-only, mengikuti kartu Postific ScreenEngagePerPosting */
import { useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Comment01Icon, SidebarLeftIcon } from "@hugeicons/core-free-icons";

import type { ConnectedAccountRecord } from "@/domains/workspace";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { InfiniteListFooter } from "../../components/infinite-list/InfiniteListStates";
import type { InboxPostGroupDto } from "../engage-dto";
import { groupKey } from "./engage-model";
import { postsFooter } from "./EngageSkeletons";
import { PostCard } from "./PostCard";
import type { InfiniteListFooterProps } from "../../components/infinite-list/InfiniteListStates";

/**
 * Panel kiri tampilan By post (T-219.1, KSP-06-F01): kartu posting,
 * kelompok "Tanpa posting" di dasar daftar, toggle posting tanpa komentar,
 * dan bisa dilipat menjadi rel sempit (desktop). Di layar sempit panel ini
 * adalah layar daftar penuh (push navigation, `mobileView`).
 */
export function PostListPanel({
  groups,
  accounts,
  selectedKey,
  collapsed,
  showEmptyPosts,
  showEmptyPostsDisabledReason,
  totalUnread,
  hiddenOnMobile,
  postCount,
  list,
  onSelect,
  onCollapsedChange,
  onShowEmptyPostsChange,
}: {
  groups: InboxPostGroupDto[];
  accounts: ConnectedAccountRecord[];
  selectedKey: string | null;
  collapsed: boolean;
  showEmptyPosts: boolean;
  /** Bila terisi, toggle nonaktif dan alasan ini tampil di tooltip. */
  showEmptyPostsDisabledReason?: string;
  /** Komentar belum dibalas sebenarnya (count query), bukan dari kartu termuat. */
  totalUnread: number;
  hiddenOnMobile: boolean;
  /** Jumlah posting sebenarnya (count query); `null` selama belum tiba. */
  postCount: number | null;
  list: InfiniteListFooterProps["list"];
  onSelect: (key: string) => void;
  onCollapsedChange: (collapsed: boolean) => void;
  onShowEmptyPostsChange: (show: boolean) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const footer = postsFooter();
  const posts = groups.filter((group) => group.postId !== null);
  const noPost = groups.find((group) => group.postId === null);

  if (collapsed) {
    return (
      <div
        className={cn(
          "hidden w-12 shrink-0 flex-col items-center gap-2.5 border-r border-border py-2.5 md:flex",
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Tampilkan daftar posting"
              onClick={() => onCollapsedChange(false)}
            >
              <HugeiconsIcon icon={SidebarLeftIcon} strokeWidth={2} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Tampilkan daftar posting</TooltipContent>
        </Tooltip>
        {totalUnread > 0 ? (
          <Badge aria-label={`${totalUnread} belum dibalas`}>
            {totalUnread}
          </Badge>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-col border-border md:w-80 md:shrink-0 md:border-r",
        hiddenOnMobile && "hidden md:flex",
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-1.5 border-b border-border px-3 py-2.5 text-sm font-semibold">
        <span>
          Posting{" "}
          <span className="font-normal text-muted-foreground">
            {postCount === null ? null : `(${postCount})`}
          </span>
        </span>
        <span className="flex gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Toggle nonaktif tidak memicu tooltip; dibungkus span yang bisa difokus. */}
              <span className="inline-flex rounded-full" tabIndex={0}>
                <Toggle
                  size="sm"
                  pressed={showEmptyPosts}
                  disabled={Boolean(showEmptyPostsDisabledReason)}
                  onPressedChange={onShowEmptyPostsChange}
                  aria-label="Tampilkan semua posting, termasuk yang belum punya komentar"
                >
                  <HugeiconsIcon icon={Comment01Icon} strokeWidth={2} />
                </Toggle>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {showEmptyPostsDisabledReason ??
                "Tampilkan semua posting, termasuk tanpa komentar"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="max-md:hidden"
                aria-label="Lipat daftar posting"
                onClick={() => onCollapsedChange(true)}
              >
                <HugeiconsIcon icon={SidebarLeftIcon} strokeWidth={2} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Lipat daftar posting</TooltipContent>
          </Tooltip>
        </span>
      </div>
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5"
      >
        {posts.map((group) => (
          <PostCard
            key={groupKey(group)}
            group={group}
            accounts={accounts}
            selected={groupKey(group) === selectedKey}
            onSelect={() => onSelect(groupKey(group))}
          />
        ))}
        {noPost ? (
          <>
            <div className="px-0.5 pt-1 text-xs tracking-wide text-muted-foreground uppercase">
              Tanpa posting
            </div>
            <PostCard
              group={noPost}
              accounts={accounts}
              selected={groupKey(noPost) === selectedKey}
              onSelect={() => onSelect(groupKey(noPost))}
            />
          </>
        ) : null}
        <InfiniteListFooter
          list={list}
          rootRef={scrollRef}
          className="shrink-0"
          {...footer}
        />
      </div>
    </div>
  );
}
