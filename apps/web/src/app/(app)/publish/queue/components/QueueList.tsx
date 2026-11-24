"use client";

import { useMemo } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Add01Icon,
  Cancel01Icon,
  PencilEdit01Icon,
  SentIcon,
} from "@hugeicons/core-free-icons";

import { ContentStatus, PostCreatedVia, type PostId } from "@postific/shared";
import type { QueueGroup, QueueSuggestionAccount } from "@/domains/publishing";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";
import { formatRelativeTime } from "@/lib/utils/format-relative-time";

import { SourceFilterEmpty } from "@/components/shared/SourceFilterEmpty";
import { McpSourceBadge } from "@/components/shared/McpSourceBadge";
import {
  resolveFilteredEmptyKind,
  SourceFilter,
} from "@/components/shared/source-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Text } from "@/components/ui/text";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { QueueSuggestions } from "./QueueSuggestions";
import { useDraftEditor } from "../../../components/draft-editor/Context";
import {
  CONTENT_STATUS_BADGE_VARIANT,
  CONTENT_STATUS_LABEL,
} from "../../../components/draft-editor/status-badge";
import { ListDayGroups } from "../../components/views/ListDayGroups";
import {
  focusAccountId,
  matchesListFilter,
  useListFilter,
} from "../../components/views/ListFilter";
import {
  ListAccounts,
  ListPostCard,
} from "../../components/views/ListPostCard";

/**
 * Tombol aksi item Queue (Publish Now/Edit/Cancel Schedule) — dipusatkan
 * di sini (T-101.2 review) supaya 3 blok `Tooltip`+`Button` yang identik
 * strukturnya (beda ikon/label/variant/handler saja) tidak diduplikasi.
 */
function QueueItemActionButton({
  icon,
  label,
  variant,
  onClick,
}: {
  icon: IconSvgElement;
  label: string;
  variant: "ghost" | "destructive";
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size="icon-sm"
          aria-label={label}
          onClick={onClick}
        >
          <HugeiconsIcon icon={icon} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export interface QueueListProps {
  groups: QueueGroup[];
  /**
   * Cancel Schedule (T-030, T-032.4) — dipass dari `QueueScreen.tsx`, yang
   * memiliki state dialog konfirmasi Tier 2 (AlertDialog) + memanggil
   * `cancelScheduleAction`. Opsional (bukan wajib) supaya `QueueList` tetap
   * bisa dipakai standalone (mis. di test) tanpa wrapper dialog.
   */
  onCancelSchedule?: (postId: PostId) => void;
  /**
   * Best-time suggestions per account (T-291), shown only while the Queue has
   * no scheduled post at all. Empty or absent = the normal empty state.
   */
  suggestions?: QueueSuggestionAccount[];
}

/**
 * T-101.2: migrasi ke shadcn — Astryx `Selector`/`Card`/`Divider`/
 * `EmptyState`/`Heading`/`IconButton`/`Icon`/`Text`/`HStack`/`VStack`
 * diganti komponen shadcn (`Select`, `Card`, `Separator`, `Empty`, `Text`,
 * `Button` variant `ghost`/`destructive` size `icon-sm` dibungkus
 * `Tooltip`) + Tailwind `flex`/`grid` layout-only. Ikon aksi
 * (Publish Now/Edit/Cancel Schedule) & jam pindah dari `react-icons` ke
 * `hugeicons` (preset Maia) — `PLATFORM_ICON` (ikon brand) SENGAJA tetap
 * `react-icons`, dikecualikan ADR-058 (sama seperti `CalendarToolbar.tsx`
 * T-101.1).
 */
export function QueueList({
  groups,
  onCancelSchedule,
  suggestions = [],
}: QueueListProps) {
  const timeZone = useUserTimeZone();
  const { openEditDraft, openNewPost } = useDraftEditor();
  // Channels and source come from the List Filter popover in the toolbar
  // (S-008 design gap 4).
  const filter = useListFilter();
  const { channelIds, source } = filter;

  const filteredGroups = useMemo<QueueGroup[]>(() => {
    if (channelIds.length === 0 && source === SourceFilter.All) {
      return groups;
    }
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          matchesListFilter(item, { channelIds, source, statuses: [] }),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, channelIds, source]);

  const allItems = groups.flatMap((group) => group.items);
  const emptyKind = resolveFilteredEmptyKind({
    sourceFilter: source,
    otherFiltersAtDefault: channelIds.length === 0,
    totalItems: allItems.length,
    hasMcpItems: allItems.some(
      (item) => item.createdVia === PostCreatedVia.Mcp,
    ),
  });

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-101.2: layout-only, file sudah dimigrasi shadcn
    <div className="flex flex-col gap-4">
      {filteredGroups.length === 0 ? (
        <Card>
          <CardContent>
            {emptyKind !== "base" ? (
              <SourceFilterEmpty kind={emptyKind} onShowAll={filter.reset} />
            ) : allItems.length === 0 && suggestions.length > 0 ? (
              <QueueSuggestions suggestions={suggestions} />
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Belum ada jadwal</EmptyTitle>
                  <EmptyDescription>
                    Post yang dijadwalkan akan muncul di sini, dikelompokkan per
                    tanggal.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button type="button" onClick={() => openNewPost()}>
                    <HugeiconsIcon icon={Add01Icon} />
                    New Post
                  </Button>
                </EmptyContent>
              </Empty>
            )}
          </CardContent>
        </Card>
      ) : (
        <ListDayGroups
          groups={filteredGroups}
          getTime={(item) => item.scheduledAt}
          renderCard={(item) => (
            <ListPostCard
              preview={{
                postId: item.id,
                connectedAccountId: focusAccountId(item.targets, channelIds),
                onCancelSchedule,
              }}
              accounts={<ListAccounts targets={item.targets} />}
              statusBadge={
                <Badge
                  variant={
                    CONTENT_STATUS_BADGE_VARIANT[ContentStatus.Scheduled]
                  }
                >
                  {CONTENT_STATUS_LABEL[ContentStatus.Scheduled]}
                </Badge>
              }
              caption={item.caption}
              meta={
                <>
                  <Text variant="muted" as="span" className="text-xs">
                    Dibuat {formatRelativeTime(item.createdAt, timeZone)}
                  </Text>
                  <McpSourceBadge
                    createdVia={item.createdVia}
                    clientName={item.createdViaClientName}
                  />
                </>
              }
              footer={
                <>
                  <QueueItemActionButton
                    icon={SentIcon}
                    label="Publish Now"
                    variant="ghost"
                    onClick={() => openEditDraft(item.id, "publish-now")}
                  />
                  <QueueItemActionButton
                    icon={PencilEdit01Icon}
                    label="Edit"
                    variant="ghost"
                    onClick={() => openEditDraft(item.id)}
                  />
                  <QueueItemActionButton
                    icon={Cancel01Icon}
                    label="Cancel Schedule"
                    variant="destructive"
                    onClick={() => onCancelSchedule?.(item.id)}
                  />
                </>
              }
            />
          )}
        />
      )}
    </div>
  );
}
