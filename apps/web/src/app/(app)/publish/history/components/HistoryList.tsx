"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import { ContentStatus } from "@postific/shared";
import {
  compareHistoryItemsDesc,
  groupHistoryItemsByDate,
  HISTORY_TERMINAL_STATUSES,
  type HistoryGroup,
  type HistoryItemRecord,
  type HistoryListItem,
} from "@/domains/publishing";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";
import { formatRelativeTime } from "@/lib/utils/format-relative-time";

import { getHistoryPostAction } from "../actions";
import {
  bumpClientNowMs,
  readClientNowMs,
  serverRelativeNowMs,
  subscribeRelativeNow,
} from "./relative-now";

import { SourceFilterEmpty } from "@/components/shared/SourceFilterEmpty";
import { McpSourceBadge } from "@/components/shared/McpSourceBadge";
import { resolveFilteredEmptyKind } from "@/components/shared/source-filter";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

import { PLATFORM_ICON } from "../../../components/platform-icons";
import {
  formatEngagementRate,
  formatMetricCount,
  MetricTile,
} from "../../../components/post-metric-tile";
import { ListDayGroups } from "../../components/views/ListDayGroups";
import { focusAccountId } from "../../components/views/ListFilter";
import { PublishTabFooter } from "../../components/views/PublishListStates";
import {
  usePublishTabList,
  type PublishTabPage,
} from "../../components/views/usePublishTabList";
import {
  ListAccounts,
  ListPostCard,
} from "../../components/views/ListPostCard";
import { RetryPostButton } from "./RetryPostButton";
import {
  historyListClockDate,
  historyListShowsPublishMeta,
} from "../history-list-row";
import {
  HISTORY_STATUS_BADGE_VARIANT,
  HISTORY_STATUS_LABEL,
} from "../history-status";

/**
 * Pesan error representatif satu `HistoryItemRecord` (T-034.2) — post bisa
 * punya lebih dari satu target gagal (partial failure — post-level
 * `status` hanya jadi `Failed` kalau SEMUA target gagal, lihat
 * `IPublishingRepository.markPostFailed`), jadi kartu List butuh SATU
 * pesan ringkas. Ambil target `failed` pertama yang punya `error`;
 * fallback ke pesan generik kalau tidak ada satu pun target yang membawa
 * pesan (mis. gagal sebelum sempat memanggil adapter).
 */
function getPrimaryErrorMessage(item: HistoryItemRecord): string {
  const failedTarget = item.targets.find(
    (target) => target.status === "failed" && target.error != null,
  );
  return failedTarget?.error ?? "Gagal dipublikasikan.";
}

const RELATIVE_NOW_TICK_MS = 30_000;

/**
 * Kriteria tampilan History (T-092.6, ADR-094 poin 5, 7): status
 * `Published` atau `Failed` — sama persis `HISTORY_TERMINAL_STATUSES`
 * (`PublishingService`), disalin ke `Set` di sini murni untuk lookup O(1)
 * saat granular patch (pola sama `DRAFT_VIEW_STATUSES` di `DraftsList`).
 */
const HISTORY_VIEW_STATUSES: ReadonlySet<ContentStatus> = new Set(
  HISTORY_TERMINAL_STATUSES,
);

export interface HistoryListProps {
  /**
   * First page of History from the server (S-009): items in business-time
   * order (`compareHistoryItemsDesc`), card thumbnails (S-008 design gap 2)
   * and the true total. Next pages load on scroll through
   * `GET /api/publish/list`; a post that arrives by Realtime shows its
   * thumbnail after the next load.
   */
  initialPage: PublishTabPage<HistoryListItem>;
  /** Workspace aktif — dipakai Realtime (`publishing_posts:{workspaceId}`), tidak untuk fetch data langsung (AGENTS.md #5). */
  workspaceId: string;
  /**
   * Stempel waktu render server (ISO), acuan `formatRelativeTime` (KI-052).
   * Server dan hydration memakai nilai yang sama supaya teks relatif tidak
   * bergeser di antara dua sisi.
   */
  renderedAt: string;
}

/**
 * List · History (T-034.2, T-289, S-009): finished posts grouped per day of
 * their business time (`groupHistoryItemsByDate` over every loaded item, so
 * a day split across two pages keeps one heading). Pages of 20 load as the
 * user scrolls (`usePublishTabList`); channel, status and source filters
 * come from the toolbar Filter popover and are applied by the server, so a
 * filter change starts again from the first page. Realtime (T-092.6,
 * ADR-094): each change fetches one post (`getHistoryPostAction`) and
 * upserts it when it is a History post that matches the filter, else
 * removes it.
 */
export function HistoryList({
  initialPage,
  workspaceId,
  renderedAt,
}: HistoryListProps) {
  const timeZone = useUserTimeZone();
  const relativeNowMs = useSyncExternalStore(
    subscribeRelativeNow,
    () => readClientNowMs(renderedAt),
    () => serverRelativeNowMs(renderedAt),
  );
  const relativeNow = new Date(relativeNowMs);

  useEffect(() => {
    const timer = window.setInterval(() => {
      bumpClientNowMs(renderedAt);
    }, RELATIVE_NOW_TICK_MS);
    return () => window.clearInterval(timer);
  }, [renderedAt]);

  const fetchLiveItem = useCallback(
    async (postId: string) => {
      const fetched = await getHistoryPostAction(postId);
      bumpClientNowMs(renderedAt);
      return fetched && HISTORY_VIEW_STATUSES.has(fetched.status)
        ? fetched
        : null;
    },
    [renderedAt],
  );

  const { list, filter, thumbnails, unfilteredTotal } =
    usePublishTabList<HistoryListItem>({
      tab: "history",
      initialPage,
      compare: compareHistoryItemsDesc,
      workspaceId,
      fetchLiveItem,
    });
  const { channelIds, statuses, source } = filter;

  const groups = useMemo<HistoryGroup<HistoryListItem>[]>(
    () => groupHistoryItemsByDate(list.items, timeZone),
    [list.items, timeZone],
  );

  // A filtered empty list: when nothing matches a Manual filter while the
  // tab has posts, every post of the tab came through MCP.
  const emptyKind = resolveFilteredEmptyKind({
    sourceFilter: source,
    otherFiltersAtDefault: statuses.length === 0 && channelIds.length === 0,
    totalItems: unfilteredTotal,
    hasMcpItems: unfilteredTotal > 0,
  });
  const showEmpty =
    list.items.length === 0 && !list.isRefreshing && list.status === "end";

  function resetAllFilters() {
    bumpClientNowMs(renderedAt);
    filter.reset();
  }

  return (
    // eslint-disable-next-line no-restricted-syntax -- layout-only, konsisten QueueList/DraftsList
    <div className="flex flex-col gap-4">
      {showEmpty ? (
        <Card>
          <CardContent>
            {emptyKind !== "base" ? (
              <SourceFilterEmpty kind={emptyKind} onShowAll={resetAllFilters} />
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Belum ada riwayat</EmptyTitle>
                  <EmptyDescription>
                    Post yang sudah selesai diproses (published maupun error)
                    akan muncul di sini, dikelompokkan per tanggal.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      ) : (
        <ListDayGroups
          groups={groups}
          getTime={historyListClockDate}
          renderCard={(item) => {
            // T-126: `Imported` counts as `Published` for the meta text. The
            // time on the left follows the same business-time key as the day
            // heading (`historyItemOccurredAt`, T-142).
            const showsPublishMeta = historyListShowsPublishMeta(item.status);
            const publishedAt = item.publishedAt ?? item.updatedAt;
            const summary = item.metricsSummary ?? null;
            const postUrl = item.targets.find(
              (target) =>
                target.status === "published" && target.platformPostUrl,
            )?.platformPostUrl;
            const failedTargetIds = item.targets
              .filter((target) => target.status === "failed")
              .map((target) => target.id);
            const publishedVia = item.targets
              .map((target) => target.platform)
              .filter(
                (platform, index, all) => all.indexOf(platform) === index,
              );

            return (
              <ListPostCard
                preview={{
                  postId: item.id,
                  connectedAccountId: focusAccountId(item.targets, channelIds),
                }}
                thumbnail={thumbnails[item.id]}
                accounts={<ListAccounts targets={item.targets} />}
                statusBadge={
                  <Badge variant={HISTORY_STATUS_BADGE_VARIANT[item.status]}>
                    {HISTORY_STATUS_LABEL[item.status]}
                  </Badge>
                }
                caption={item.caption}
                extra={
                  showsPublishMeta ? (
                    summary ? (
                      // eslint-disable-next-line no-restricted-syntax -- layout-only
                      <div className="flex flex-wrap gap-2">
                        <MetricTile
                          label="Views"
                          value={formatMetricCount(summary.impressions)}
                        />
                        <MetricTile
                          label="Reach"
                          value={formatMetricCount(summary.reach)}
                        />
                        <MetricTile
                          label="Replies"
                          value={formatMetricCount(summary.comments)}
                        />
                        <MetricTile
                          label="Eng. Rate"
                          value={formatEngagementRate(summary.engagementRate)}
                        />
                      </div>
                    ) : (
                      <Text variant="muted" as="span" className="text-xs">
                        Belum ada data
                      </Text>
                    )
                  ) : (
                    <Alert variant="destructive">
                      <AlertDescription>
                        {getPrimaryErrorMessage(item)}
                      </AlertDescription>
                    </Alert>
                  )
                }
                meta={
                  <>
                    <Text
                      variant="muted"
                      as="span"
                      suppressHydrationWarning
                      className="text-xs"
                    >
                      {showsPublishMeta
                        ? `Dipublikasikan ${formatRelativeTime(publishedAt, timeZone, relativeNow)}`
                        : "Gagal dipublikasikan"}
                    </Text>
                    <McpSourceBadge
                      createdVia={item.createdVia}
                      clientName={item.createdViaClientName}
                    />
                  </>
                }
                footer={
                  <>
                    {/* eslint-disable-next-line no-restricted-syntax -- layout-only */}
                    <div className="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                      {showsPublishMeta
                        ? item.status === ContentStatus.Imported
                          ? "Diimpor dari"
                          : "Dipublikasikan via"
                        : "Gagal ke"}
                      {publishedVia.map((platform) => {
                        const Glyph = PLATFORM_ICON[platform].Icon;
                        return (
                          <span
                            className="inline-flex items-center gap-1 font-medium text-foreground"
                            key={platform}
                          >
                            <Glyph
                              size={12}
                              color={PLATFORM_ICON[platform].color}
                            />
                            {PLATFORM_ICON[platform].label}
                          </span>
                        );
                      })}
                    </div>
                    {showsPublishMeta ? (
                      postUrl ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={postUrl} target="_blank" rel="noreferrer">
                            Buka posting
                          </a>
                        </Button>
                      ) : null
                    ) : (
                      <RetryPostButton
                        postId={item.id}
                        targetIds={failedTargetIds}
                      />
                    )}
                  </>
                }
              />
            );
          }}
        />
      )}
      {showEmpty ? null : <PublishTabFooter tab="history" list={list} />}
    </div>
  );
}
