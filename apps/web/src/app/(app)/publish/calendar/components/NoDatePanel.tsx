"use client";

import type { ContentStatus } from "@postific/shared";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";
import { formatRelativeTime } from "@/lib/utils/format-relative-time";

import { useDraftEditor } from "../../../components/draft-editor/Context";
import {
  CONTENT_STATUS_BADGE_VARIANT,
  CONTENT_STATUS_LABEL,
} from "../../../components/draft-editor/status-badge";

/** A post without a date: Draft, In Review or Ready to Schedule. */
export interface UndatedPostItem {
  id: string;
  caption: string;
  status: ContentStatus;
  updatedAt: Date;
}

/**
 * "No date" side panel of the Calendar (T-287, S-008): posts that have no
 * date yet and so cannot sit on the grid. A click opens the post in the
 * Draft Editor, where it can get a date.
 */
export function NoDatePanel({
  open,
  onOpenChange,
  posts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posts: UndatedPostItem[];
}) {
  const timeZone = useUserTimeZone();
  const { openEditDraft } = useDraftEditor();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Tanpa tanggal</SheetTitle>
          <SheetDescription>
            Posting yang belum punya tanggal. Buka untuk menjadwalkannya.
          </SheetDescription>
        </SheetHeader>
        {/* eslint-disable-next-line no-restricted-syntax -- T-287: Tailwind layout (ADR-097) */}
        <div className="flex flex-col gap-2 overflow-y-auto px-4 pb-4">
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Semua posting sudah punya tanggal.
            </p>
          ) : (
            posts.map((post) => (
              <button
                key={post.id}
                type="button"
                className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  onOpenChange(false);
                  openEditDraft(post.id);
                }}
              >
                <span className="line-clamp-2 text-sm">
                  {post.caption || "(Tanpa caption)"}
                </span>
                {}
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={CONTENT_STATUS_BADGE_VARIANT[post.status]}>
                    {CONTENT_STATUS_LABEL[post.status]}
                  </Badge>
                  Diedit {formatRelativeTime(post.updatedAt, timeZone)}
                </span>
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
