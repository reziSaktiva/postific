"use client";

import { useMemo } from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import { PencilEdit01Icon } from "@hugeicons/core-free-icons";

import {
  APPROVAL_LIST_STATUSES,
  groupApprovalItemsByDate,
} from "@/domains/publishing";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";
import { formatRelativeTime } from "@/lib/utils/format-relative-time";

import { McpSourceBadge } from "@/components/shared/McpSourceBadge";
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

import { useDraftEditor } from "../../../components/draft-editor/Context";
import {
  CONTENT_STATUS_BADGE_VARIANT,
  CONTENT_STATUS_LABEL,
} from "../../../components/draft-editor/status-badge";
import { ListDayGroups } from "../../components/views/ListDayGroups";
import { ListPostCard } from "../../components/views/ListPostCard";
import {
  useLiveDraftPosts,
  type DraftListItem,
} from "../../drafts/components/useLiveDraftPosts";

/**
 * List · Approvals (T-289, S-008): `In Review` content grouped by the day of
 * its last change, with the AI-client badge. A click opens the Draft Editor
 * directly (ADR-165 decision 6).
 *
 * OPEN: the Mark Ready (In Review -> Ready to Schedule) and Back to Draft
 * (In Review -> Draft) actions are not here. The brief says to call "the
 * existing status service", but no status transition exists in the code
 * (no service, use case or repository method writes `in_review`,
 * `ready_to_schedule` or a move back to `draft`); adding one is a decision
 * for King Rezi, so the cards only offer Edit for now.
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
  const live = useLiveDraftPosts(items, APPROVAL_LIST_STATUSES, workspaceId);
  const groups = useMemo(
    () => groupApprovalItemsByDate(live, timeZone),
    [live, timeZone],
  );

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Tidak ada yang menunggu ditinjau</EmptyTitle>
              <EmptyDescription>
                Konten berstatus In Review muncul di sini.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
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
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openEditDraft(item.id)}
            >
              <HugeiconsIcon icon={PencilEdit01Icon} />
              Edit
            </Button>
          }
        />
      )}
    />
  );
}
