"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { ContentStatus } from "@postific/shared";
import {
  groupHistoryItemsByDate,
  HISTORY_TERMINAL_STATUSES,
  type HistoryGroup,
  type HistoryItemRecord,
} from "@/domains/publishing";
import type { ConnectedAccountRecord } from "@/domains/workspace";
import { formatRelativeTime } from "@/lib/utils/format-relative-time";
import { formatUtcDateKeyHeading } from "@/lib/utils";
import { usePublishingPostsRealtime } from "@/lib/hooks/use-publishing-posts-realtime";
import { useSyncedState } from "@/lib/hooks/use-synced-state";

import { getHistoryPostAction } from "../actions";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Text } from "@/components/ui/text";

import { PLATFORM_ICON } from "../../../components/platform-icons";
import {
  HISTORY_STATUS_BADGE_VARIANT,
  HISTORY_STATUS_LABEL,
} from "../history-status";

const DATE_HEADING_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** Sama pola `QueueList`/`CalendarAgendaList` — parse UTC-safe dipusatkan di `formatUtcDateKeyHeading`. */
function formatGroupDateHeading(dateKey: string): string {
  return formatUtcDateKeyHeading(dateKey, DATE_HEADING_FORMATTER);
}

function formatItemTime(date: Date): string {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

const ALL_STATUS_FILTER_VALUE = "all";
const ALL_ACCOUNTS_FILTER_VALUE = "all";

const STATUS_OPTIONS = [
  { value: ALL_STATUS_FILTER_VALUE, label: "Semua Status" },
  { value: ContentStatus.Published, label: "Published" },
  { value: ContentStatus.Failed, label: "Error" },
];

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
   * Hasil `PublishingService.listHistory` (flat, sudah terurut `updatedAt`
   * descending oleh repository) — T-092.6: pengelompokan per tanggal
   * dipindah ke DALAM komponen ini (`groupHistoryItemsByDate` dipanggil di
   * bawah, atas hasil gabungan `items` + granular patch Realtime), bukan
   * lagi di composition root `page.tsx`.
   */
  items: HistoryItemRecord[];
  /** Daftar akun terkoneksi workspace (opsi filter Akun) — dari `WorkspaceService.listConnectedAccounts`, bukan derive dari `items` yang sudah terfilter, sama alasan `CalendarToolbar`. */
  accounts: ConnectedAccountRecord[];
  /** Workspace aktif — dipakai `usePublishingPostsRealtime` (T-092.6) untuk subscribe channel `publishing_posts:{workspaceId}`, bukan dipakai untuk fetch data apa pun langsung di komponen ini (AGENTS.md #5). */
  workspaceId: string;
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
 * dipertahankan `updatedAt` descending (sama `orderBy` `listHistory`),
 * lalu dikelompokkan ulang via `groupHistoryItemsByDate` sebelum difilter
 * Status/Akun.
 */
export function HistoryList({
  items,
  accounts,
  workspaceId,
}: HistoryListProps) {
  const [statusFilter, setStatusFilter] = useState<string>(
    ALL_STATUS_FILTER_VALUE,
  );
  const [accountFilter, setAccountFilter] = useState<string>(
    ALL_ACCOUNTS_FILTER_VALUE,
  );

  const [localItems, setLocalItems] = useSyncedState(items);
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

        setLocalItems((prev) => {
          const withoutStale = prev.filter((item) => item.id !== event.postId);

          if (!historyItem) {
            return withoutStale;
          }

          return [...withoutStale, historyItem].sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
          );
        });
      })();
    },
    [setLocalItems],
  );

  usePublishingPostsRealtime(workspaceId, {
    onInsert: handlePublishingPostChange,
    onUpdate: handlePublishingPostChange,
  });

  const groups = useMemo<HistoryGroup[]>(
    () => groupHistoryItemsByDate(localItems),
    [localItems],
  );

  const accountOptions = useMemo(
    () => [
      { value: ALL_ACCOUNTS_FILTER_VALUE, label: "Semua Akun" },
      ...accounts.map((account) => ({
        value: account.id as string,
        label: account.handle,
      })),
    ],
    [accounts],
  );

  const filteredGroups = useMemo<HistoryGroup[]>(() => {
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const matchesStatus =
            statusFilter === ALL_STATUS_FILTER_VALUE ||
            item.status === statusFilter;
          const matchesAccount =
            accountFilter === ALL_ACCOUNTS_FILTER_VALUE ||
            item.targets.some(
              (target) => target.connectedAccountId === accountFilter,
            );
          return matchesStatus && matchesAccount;
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, statusFilter, accountFilter]);

  return (
    // eslint-disable-next-line no-restricted-syntax -- layout-only, konsisten QueueList/DraftsList
    <div className="flex flex-col gap-4">
      {/* eslint-disable-next-line no-restricted-syntax -- layout-only */}
      <div className="flex flex-wrap justify-end gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" aria-label="Filter status" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger size="sm" aria-label="Filter akun" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accountOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredGroups.length === 0 ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Belum ada riwayat</EmptyTitle>
                <EmptyDescription>
                  Post yang sudah selesai diproses (published maupun error) akan
                  muncul di sini, dikelompokkan per tanggal.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        // eslint-disable-next-line no-restricted-syntax -- layout-only
        <div className="flex flex-col gap-6">
          {filteredGroups.map((group) => (
            // eslint-disable-next-line no-restricted-syntax -- layout-only
            <div className="flex flex-col gap-2" key={group.date}>
              <Text variant="h4" as="h3">
                {formatGroupDateHeading(group.date)}
              </Text>

              <ItemGroup className="gap-2">
                {group.items.map((item) => {
                  const isPublished = item.status === ContentStatus.Published;
                  const effectiveDate = item.publishedAt ?? item.updatedAt;

                  return (
                    <Item
                      key={item.id}
                      asChild
                      variant="outline"
                      size="sm"
                      className="cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-card p-4 transition-colors hover:border-foreground/40 hover:bg-card! sm:flex-nowrap"
                    >
                      <Link href={`/publish/history/${item.id}`}>
                        <Text
                          variant="muted"
                          as="span"
                          className="w-12 shrink-0 text-xs"
                        >
                          {formatItemTime(effectiveDate)}
                        </Text>

                        {/* eslint-disable-next-line no-restricted-syntax -- layout-only */}
                        <div className="flex shrink-0 flex-wrap items-center gap-3">
                          {item.targets.map((target) => {
                            const PlatformGlyph =
                              PLATFORM_ICON[target.platform].Icon;
                            return (
                              // eslint-disable-next-line no-restricted-syntax -- layout-only
                              <div
                                className="flex items-center gap-1"
                                key={target.id}
                              >
                                <PlatformGlyph
                                  size={12}
                                  color={PLATFORM_ICON[target.platform].color}
                                />
                                <Text variant="muted" as="span">
                                  {target.accountHandle}
                                </Text>
                              </div>
                            );
                          })}
                        </div>

                        <ItemContent className="order-last min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-auto">
                          <ItemTitle className="line-clamp-none block w-full min-w-0 font-normal whitespace-normal sm:truncate sm:whitespace-nowrap">
                            {item.caption || "(Tanpa caption)"}
                          </ItemTitle>
                          <Text
                            variant="muted"
                            as="span"
                            className={
                              isPublished
                                ? "truncate text-xs"
                                : "truncate text-xs text-destructive"
                            }
                          >
                            {isPublished
                              ? `Dipublikasikan ${formatRelativeTime(effectiveDate)}`
                              : getPrimaryErrorMessage(item)}
                          </Text>
                        </ItemContent>

                        <Badge
                          className="shrink-0"
                          variant={HISTORY_STATUS_BADGE_VARIANT[item.status]}
                        >
                          {HISTORY_STATUS_LABEL[item.status]}
                        </Badge>
                      </Link>
                    </Item>
                  );
                })}
              </ItemGroup>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
