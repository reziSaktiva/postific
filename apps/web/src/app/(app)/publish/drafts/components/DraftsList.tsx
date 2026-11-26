"use client";

import { useMemo } from "react";

import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, PencilEdit01Icon } from "@hugeicons/core-free-icons";

import { ContentStatus } from "@postific/shared";
import {
  DRAFT_LIST_STATUSES,
  groupDraftItemsByDate,
} from "@/domains/publishing";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";
import { formatRelativeTime } from "@/lib/utils/format-relative-time";
import { useConfirmAction } from "@/lib/hooks/use-confirm-action";

import { SourceFilterEmpty } from "@/components/shared/SourceFilterEmpty";
import { McpSourceBadge } from "@/components/shared/McpSourceBadge";
import { resolveFilteredEmptyKind } from "@/components/shared/source-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Text } from "@/components/ui/text";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";

import { useDraftEditor } from "../../../components/draft-editor/Context";
import {
  CONTENT_STATUS_BADGE_VARIANT,
  CONTENT_STATUS_LABEL,
} from "../../../components/draft-editor/status-badge";
import { ListDayGroups } from "../../components/views/ListDayGroups";
import { PublishTabFooter } from "../../components/views/PublishListStates";
import type { PublishTabPage } from "../../components/views/usePublishTabList";
import { ListPostCard } from "../../components/views/ListPostCard";
import { deletePostAction } from "../actions";
import { useLiveDraftPosts, type DraftListItem } from "./useLiveDraftPosts";

/**
 * List · Drafts (T-289, S-008): `Draft` and `Ready to Schedule` content,
 * grouped by the day of the last edit with the time on the left. A click on
 * a card opens the Draft Editor directly (ADR-165 decision 6). Delete Post
 * (T-035, ADR-049 Tier 2) stays on `Draft` cards only; `Ready to Schedule`
 * cannot be deleted by the service. In Review content lives in Approvals.
 * Realtime patching is shared with Approvals (`useLiveDraftPosts`).
 */
export function DraftsList({
  initialPage,
  workspaceId,
}: {
  /** First page of Drafts from the server, with the true total (S-009). */
  initialPage: PublishTabPage<DraftListItem>;
  /** Subscribes `publishing_posts:{workspaceId}`; no data is fetched with it here. */
  workspaceId: string;
}) {
  const timeZone = useUserTimeZone();
  const { openEditDraft } = useDraftEditor();
  const { list, filter, unfilteredTotal } = useLiveDraftPosts(
    "drafts",
    initialPage,
    DRAFT_LIST_STATUSES,
    workspaceId,
  );
  // The card leaves at once, also past the first page and without Realtime
  // (T-308).
  const deleteConfirm = useConfirmAction<DraftListItem>(
    (draft) => deletePostAction(draft.id),
    (draft) => {
      list.remove(draft.id);
      toast("Draft berhasil dihapus");
    },
  );
  // Source comes from the List Filter popover in the toolbar (S-008 design
  // gap 4) and is applied by the server; Drafts carry no accounts, so there
  // is no channel filter here. Day groups cover every loaded draft, so a day
  // split across two pages keeps one heading.
  const sourceFilter = filter.source;
  const groups = useMemo(
    () => groupDraftItemsByDate(list.items, timeZone),
    [list.items, timeZone],
  );
  const emptyKind = resolveFilteredEmptyKind({
    sourceFilter,
    otherFiltersAtDefault: true,
    totalItems: unfilteredTotal,
    hasMcpItems: unfilteredTotal > 0,
  });
  const showEmpty =
    list.items.length === 0 && !list.isRefreshing && list.status === "end";

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-289: layout-only
    <div className="flex flex-col gap-4">
      {showEmpty ? (
        <Card>
          <CardContent>
            {emptyKind !== "base" ? (
              <SourceFilterEmpty kind={emptyKind} onShowAll={filter.reset} />
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Belum ada draft</EmptyTitle>
                  <EmptyDescription>
                    Draft yang belum terjadwal akan muncul di sini.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      ) : (
        <ListDayGroups
          groups={groups}
          getTime={(draft) => draft.updatedAt}
          renderCard={(draft) => (
            <ListPostCard
              onOpen={() => openEditDraft(draft.id)}
              statusBadge={
                <Badge variant={CONTENT_STATUS_BADGE_VARIANT[draft.status]}>
                  {CONTENT_STATUS_LABEL[draft.status]}
                </Badge>
              }
              caption={draft.caption}
              meta={
                <>
                  <Text variant="muted" as="span" className="text-xs">
                    Diedit {formatRelativeTime(draft.updatedAt, timeZone)}
                  </Text>
                  <McpSourceBadge
                    createdVia={draft.createdVia}
                    clientName={draft.createdViaClientName}
                  />
                </>
              }
              footer={
                <>
                  {draft.status === ContentStatus.Draft ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Hapus draft"
                      onClick={() => deleteConfirm.open(draft)}
                    >
                      <HugeiconsIcon icon={Delete02Icon} />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDraft(draft.id)}
                  >
                    <HugeiconsIcon icon={PencilEdit01Icon} />
                    Edit
                  </Button>
                </>
              }
            />
          )}
        />
      )}
      {showEmpty ? null : <PublishTabFooter tab="drafts" list={list} />}

      <ConfirmActionDialog
        isOpen={deleteConfirm.isOpen}
        onClose={deleteConfirm.close}
        title="Hapus draft ini?"
        description="Tindakan ini tidak bisa dibatalkan — draft akan hilang permanen dari daftar."
        confirmLabel="Hapus Draft"
        isLoading={deleteConfirm.isLoading}
        error={deleteConfirm.error}
        onConfirm={() => void deleteConfirm.confirm()}
        variant="destructive"
      />
    </div>
  );
}
