"use client";

import { useMemo, useState, useTransition } from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowTurnBackwardIcon,
  Edit02Icon,
  MoreHorizontalIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { PostCreatedVia } from "@postific/shared";
import {
  APPROVAL_LIST_STATUSES,
  groupApprovalItemsByDate,
} from "@/domains/publishing";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";
import { formatRelativeTime } from "@/lib/utils/format-relative-time";

import { McpSourceBadge } from "@/components/shared/McpSourceBadge";
import { SourceFilterEmpty } from "@/components/shared/SourceFilterEmpty";
import { resolveFilteredEmptyKind } from "@/components/shared/source-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Text } from "@/components/ui/text";

import { useDraftEditor } from "../../../components/draft-editor/Context";
import {
  CONTENT_STATUS_BADGE_VARIANT,
  CONTENT_STATUS_LABEL,
} from "../../../components/draft-editor/status-badge";
import { ListDayGroups } from "../../components/views/ListDayGroups";
import {
  matchesListFilter,
  useListFilter,
} from "../../components/views/ListFilter";
import {
  ListAccounts,
  ListPostCard,
} from "../../components/views/ListPostCard";
import { backToDraftAction, markReadyToScheduleAction } from "../actions";
import {
  useLiveDraftPosts,
  type DraftListItem,
} from "../../drafts/components/useLiveDraftPosts";

/**
 * List · Approvals (T-289, S-008): `In Review` content grouped by the day of
 * its last change, with the AI-client badge. A click opens the Draft Editor
 * directly (ADR-165 decision 6). Card actions as `ScreenPublishRedesain`:
 * Back to Draft (In Review -> Draft), Mark Ready (In Review -> Ready to
 * Schedule) and a more-actions menu; both go through
 * `ChangeContentStatusUseCase`. Nothing waits for approval: any role can
 * also schedule from Draft.
 */
export function ApprovalsList({
  items,
  workspaceId,
}: {
  items: DraftListItem[];
  workspaceId: string;
}) {
  const timeZone = useUserTimeZone();
  const { openEditDraft } = useDraftEditor();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const live = useLiveDraftPosts(items, APPROVAL_LIST_STATUSES, workspaceId);
  // Channels and source come from the List Filter popover in the toolbar
  // (S-008 design gap 4).
  const filter = useListFilter();
  const { channelIds, source } = filter;
  const groups = useMemo(
    () =>
      groupApprovalItemsByDate(
        live.filter((item) =>
          matchesListFilter(item, { channelIds, source, statuses: [] }),
        ),
        timeZone,
      ),
    [live, timeZone, channelIds, source],
  );
  const emptyKind = resolveFilteredEmptyKind({
    sourceFilter: source,
    otherFiltersAtDefault: channelIds.length === 0,
    totalItems: live.length,
    hasMcpItems: live.some((item) => item.createdVia === PostCreatedVia.Mcp),
  });

  function changeStatus(
    postId: string,
    action: (postId: string) => Promise<{ error?: string }>,
    successMessage: string,
  ) {
    setPendingId(postId);
    startTransition(async () => {
      const result = await action(postId);
      setPendingId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast(successMessage);
    });
  }

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent>
          {emptyKind !== "base" ? (
            <SourceFilterEmpty kind={emptyKind} onShowAll={filter.reset} />
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Tidak ada yang menunggu ditinjau</EmptyTitle>
                <EmptyDescription>
                  Konten berstatus In Review muncul di sini.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <ListDayGroups
      groups={groups}
      getTime={(item) => item.updatedAt}
      renderCard={(item) => (
        <ListPostCard
          onOpen={() => openEditDraft(item.id)}
          accounts={
            item.targets && item.targets.length > 0 ? (
              <ListAccounts targets={item.targets} />
            ) : undefined
          }
          statusBadge={
            <Badge variant={CONTENT_STATUS_BADGE_VARIANT[item.status]}>
              {CONTENT_STATUS_LABEL[item.status]}
            </Badge>
          }
          caption={item.caption}
          meta={
            <>
              <Text variant="muted" as="span" className="text-xs">
                Diajukan {formatRelativeTime(item.updatedAt, timeZone)}
              </Text>
              <McpSourceBadge
                createdVia={item.createdVia}
                clientName={item.createdViaClientName}
              />
            </>
          }
          footer={
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pendingId === item.id}
                onClick={() =>
                  changeStatus(
                    item.id,
                    backToDraftAction,
                    "Dikembalikan ke Draft",
                  )
                }
              >
                <HugeiconsIcon icon={ArrowTurnBackwardIcon} />
                Kembalikan ke Draft
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pendingId === item.id}
                onClick={() =>
                  changeStatus(
                    item.id,
                    markReadyToScheduleAction,
                    "Ditandai Ready to Schedule",
                  )
                }
              >
                <HugeiconsIcon icon={Tick02Icon} />
                Tandai Ready
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label="Aksi lain"
                  >
                    <HugeiconsIcon icon={MoreHorizontalIcon} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => openEditDraft(item.id)}>
                    <HugeiconsIcon icon={Edit02Icon} />
                    Edit
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />
      )}
    />
  );
}
