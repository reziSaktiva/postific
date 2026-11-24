"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Add01Icon,
  Cancel01Icon,
  PencilEdit01Icon,
  SentIcon,
} from "@hugeicons/core-free-icons";

import {
  ContentStatus,
  PostCreatedVia,
  type ConnectedAccountId,
  type PostId,
} from "@postific/shared";
import type { QueueGroup, QueueSuggestionAccount } from "@/domains/publishing";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";
import { formatRelativeTime } from "@/lib/utils/format-relative-time";

import { SourceFilterEmpty } from "@/components/shared/SourceFilterEmpty";
import { McpSourceBadge } from "@/components/shared/McpSourceBadge";
import { SourceFilterSelect } from "@/components/shared/SourceFilterSelect";
import {
  matchesSourceFilter,
  resolveFilteredEmptyKind,
  SourceFilter,
  type SourceFilterValue,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ListAccounts,
  ListPostCard,
} from "../../components/views/ListPostCard";
import { usePostPreviewOpener } from "../../components/views/usePostPreviewOpener";

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

const ALL_ACCOUNTS_FILTER_VALUE = "all";

interface AccountFilterOption {
  value: string;
  label: string;
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
  const openPostPreview = usePostPreviewOpener();
  const [accountFilter, setAccountFilter] = useState<string>(
    ALL_ACCOUNTS_FILTER_VALUE,
  );

  const [sourceFilter, setSourceFilter] = useState<SourceFilterValue>(
    SourceFilter.All,
  );

  const accountOptions = useMemo<AccountFilterOption[]>(() => {
    const seen = new Map<ConnectedAccountId, AccountFilterOption>();
    for (const group of groups) {
      for (const item of group.items) {
        for (const target of item.targets) {
          if (!seen.has(target.connectedAccountId)) {
            seen.set(target.connectedAccountId, {
              value: target.connectedAccountId,
              label: target.accountHandle,
            });
          }
        }
      }
    }
    return Array.from(seen.values());
  }, [groups]);

  const filteredGroups = useMemo<QueueGroup[]>(() => {
    if (
      accountFilter === ALL_ACCOUNTS_FILTER_VALUE &&
      sourceFilter === SourceFilter.All
    ) {
      return groups;
    }
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            (accountFilter === ALL_ACCOUNTS_FILTER_VALUE ||
              item.targets.some(
                (target) => target.connectedAccountId === accountFilter,
              )) &&
            matchesSourceFilter(item, sourceFilter),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, accountFilter, sourceFilter]);

  const allItems = groups.flatMap((group) => group.items);
  const emptyKind = resolveFilteredEmptyKind({
    sourceFilter,
    otherFiltersAtDefault: accountFilter === ALL_ACCOUNTS_FILTER_VALUE,
    totalItems: allItems.length,
    hasMcpItems: allItems.some(
      (item) => item.createdVia === PostCreatedVia.Mcp,
    ),
  });

  function resetAllFilters() {
    setAccountFilter(ALL_ACCOUNTS_FILTER_VALUE);
    setSourceFilter(SourceFilter.All);
  }

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-101.2: layout-only, file sudah dimigrasi shadcn
    <div className="flex flex-col gap-4">
      {/* eslint-disable-next-line no-restricted-syntax -- T-101.2: layout-only */}
      <div className="flex flex-wrap justify-end gap-2">
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger size="sm" aria-label="Filter akun" className="w-44">
            <SelectValue placeholder="Semua akun" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ACCOUNTS_FILTER_VALUE}>
              Semua akun
            </SelectItem>
            {accountOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SourceFilterSelect
          value={sourceFilter}
          onValueChange={setSourceFilter}
        />
      </div>

      {filteredGroups.length === 0 ? (
        <Card>
          <CardContent>
            {emptyKind !== "base" ? (
              <SourceFilterEmpty kind={emptyKind} onShowAll={resetAllFilters} />
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
              onOpen={() => openPostPreview({ id: item.id, tab: "queue" })}
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
