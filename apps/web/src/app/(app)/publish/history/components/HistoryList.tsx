"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

import { ContentStatus, PostCreatedVia } from "@postific/shared";
import {
  compareHistoryItemsDesc,
  groupHistoryItemsByDate,
  HISTORY_TERMINAL_STATUSES,
  type HistoryGroup,
  type HistoryItemRecord,
  type HistoryListItem,
} from "@/domains/publishing";
import type { MediaThumbnailDto } from "@/domains/media";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";
import { formatRelativeTime } from "@/lib/utils/format-relative-time";
import { usePublishingPostsRealtime } from "@/lib/hooks/use-publishing-posts-realtime";
import { useSyncedState } from "@/lib/hooks/use-synced-state";

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
import {
  focusAccountId,
  matchesListFilter,
  useListFilter,
} from "../../components/views/ListFilter";
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
   * Hasil `PublishingService.listHistory` (flat, sudah terurut waktu bisnis
   * descending (`compareHistoryItemsDesc`) oleh repository) — T-092.6: pengelompokan per tanggal
   * dipindah ke DALAM komponen ini (`groupHistoryItemsByDate` dipanggil di
   * bawah, atas hasil gabungan `items` + granular patch Realtime), bukan
   * lagi di composition root `page.tsx`.
   */
  items: HistoryListItem[];
  /** Card thumbnails by post id (S-008 design gap 2); a post without media has none. Posts that arrive by Realtime show theirs after the next load. */
  thumbnails?: Record<string, MediaThumbnailDto>;
  /** Workspace aktif — dipakai `usePublishingPostsRealtime` (T-092.6) untuk subscribe channel `publishing_posts:{workspaceId}`, bukan dipakai untuk fetch data apa pun langsung di komponen ini (AGENTS.md #5). */
  workspaceId: string;
  /**
   * Stempel waktu render server (ISO), acuan `formatRelativeTime` (KI-052).
   * Server dan hydration memakai nilai yang sama supaya teks relatif tidak
   * bergeser di antara dua sisi.
   */
  renderedAt: string;
}

/**
 * Daftar riwayat (T-034.2, KSP-D10) — dikelompokkan per tanggal
 * (`groupHistoryItemsByDate`, domain `publishing`), filter Status
 * (Semua/Published/Error) dan Akun (Semua/per akun) dilakukan client-side
 * (sama pola `QueueList` T-032.3 — dataset kecil, tidak perlu re-fetch
 * server per filter seperti Calendar). Tiap card bisa diklik penuh menuju
 * `/publish/history/[postId]` (T-034.3) via `Item asChild` + `Link`, sama
 * pola `DraftsList`.
 *
 * **T-092.6 (ADR-094 poin 5, 6, 7) — client state + granular Realtime
 * patch:** `items` (prop dari `page.tsx`) disalin ke `useState` lokal (pola
 * sama `DraftsList`/`QueueScreen`) — disinkronkan ulang SAAT RENDER setiap
 * kali prop `items` berubah, bukan `useEffect` + `setState` supaya tidak
 * ada render tambahan/cascading.
 *
 * `usePublishingPostsRealtime(workspaceId, {...})` subscribe selama
 * komponen ini mount (lifecycle per-mount, ADR-094 poin 6). Event
 * `INSERT`/`UPDATE` memicu fetch SATU record via `getHistoryPostAction`
 * (Server Action → `PublishingService.getHistoryPostById`, method baru —
 * bukan refetch seluruh History) lalu di-upsert/remove ke state lokal
 * berdasar kriteria tampilan History (`HISTORY_VIEW_STATUSES` —
 * `Published`/`Failed`; status lain, termasuk `null` hasil post tidak
 * ditemukan/soft-deleted, berarti item dihapus dari local state) — echo
 * dari aksi milik user sendiri diproses sama seperti event orang lain,
 * tanpa deteksi/skip apa pun (idempoten by design, ADR-094 poin 5). Urutan
 * dipertahankan waktu bisnis descending (`compareHistoryItemsDesc`, sama dengan `listHistory`),
 * lalu dikelompokkan ulang via `groupHistoryItemsByDate` sebelum difilter
 * Status/Akun.
 */
export function HistoryList({
  items,
  thumbnails = {},
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
  // Status, channels and source come from the List Filter popover in the
  // toolbar (S-008 design gap 4).
  const filter = useListFilter();
  const { channelIds, statuses, source } = filter;

  const [localItems, setLocalItems] = useSyncedState<HistoryListItem[]>(items);
  const requestSeqRef = useRef<Map<string, number>>(new Map());

  const handlePublishingPostChange = useCallback(
    (event: { postId: HistoryItemRecord["id"] }) => {
      const seq = (requestSeqRef.current.get(event.postId) ?? 0) + 1;
      requestSeqRef.current.set(event.postId, seq);

      void (async () => {
        const fetched = await getHistoryPostAction(event.postId);

        // Buang hasil kalau sudah disusul event lain untuk postId yang sama
        // (out-of-order response) — jangan biarkan fetch yang lebih lama
        // menimpa state yang sudah diperbarui oleh event yang lebih baru.
        if (requestSeqRef.current.get(event.postId) !== seq) {
          return;
        }

        const historyItem =
          fetched && HISTORY_VIEW_STATUSES.has(fetched.status) ? fetched : null;

        bumpClientNowMs(renderedAt);
        setLocalItems((prev) => {
          const withoutStale = prev.filter((item) => item.id !== event.postId);

          if (!historyItem) {
            return withoutStale;
          }

          return [...withoutStale, historyItem].sort(compareHistoryItemsDesc);
        });
      })();
    },
    [renderedAt, setLocalItems],
  );

  usePublishingPostsRealtime(workspaceId, {
    onInsert: handlePublishingPostChange,
    onUpdate: handlePublishingPostChange,
  });

  const groups = useMemo<HistoryGroup<HistoryListItem>[]>(
    () => groupHistoryItemsByDate(localItems, timeZone),
    [localItems, timeZone],
  );

  const filteredGroups = useMemo<HistoryGroup<HistoryListItem>[]>(() => {
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          matchesListFilter(item, { channelIds, statuses, source }),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, channelIds, statuses, source]);

  const emptyKind = resolveFilteredEmptyKind({
    sourceFilter: source,
    otherFiltersAtDefault: statuses.length === 0 && channelIds.length === 0,
    totalItems: localItems.length,
    hasMcpItems: localItems.some(
      (item) => item.createdVia === PostCreatedVia.Mcp,
    ),
  });

  function resetAllFilters() {
    bumpClientNowMs(renderedAt);
    filter.reset();
  }

  return (
    // eslint-disable-next-line no-restricted-syntax -- layout-only, konsisten QueueList/DraftsList
    <div className="flex flex-col gap-4">
      {filteredGroups.length === 0 ? (
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
          groups={filteredGroups}
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
    </div>
  );
}
