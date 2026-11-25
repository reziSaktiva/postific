"use client";

/* eslint-disable no-restricted-syntax -- T-219: dikomposisi Tailwind langsung di atas shadcn/ui (ADR-097); layout-only, mengikuti kartu Postific ScreenEngagePerPosting */

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  Comment01Icon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons";

import type { ConnectedAccountRecord } from "@/domains/workspace";
import type {
  InboxItemStatus,
  InboxPostGroupCounts,
} from "@/domains/engagement";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";
import { cn } from "@/lib/utils";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Text } from "@/components/ui/text";

import type { InboxPostGroupDto } from "../engage-dto";
import { PostCommentsPanel } from "./PostCommentsPanel";
import { PostListPanel } from "./PostListPanel";
import { ALL_FILTER_VALUE } from "./engage-model";
import { CommentListView } from "./CommentListView";
import { EngageToolbar } from "./EngageToolbar";
import { EngageViewToggle } from "./EngageViewToggle";
import { useEngageInbox } from "./useEngageInbox";

/** Jam + singkatan zona pengguna dari Intl ("10.30 WIB", "05.30 GMT-4") — T-147. */
function formatUpdatedAtLabel(date: Date, timeZone: string): string {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  });
}

export interface EngageInboxViewProps {
  /** Halaman pertama daftar posting beserta ringkasan komentarnya (`loadPostGroupsPage`, filter bawaan). */
  initialGroups: InboxPostGroupDto[];
  /** Cursor halaman berikutnya (infinite scroll, ADR-166); `null` = daftar habis. */
  initialNextCursor: string | null;
  /** Hitungan sebenarnya daftar posting (count query); `null` bila muat awal gagal. */
  initialCounts: InboxPostGroupCounts | null;
  /** Muat awal gagal: tampilkan state refresh gagal. */
  initialLoadFailed: boolean;
  /** Akun terkoneksi workspace (opsi filter Akun dan nama akun kartu). */
  accounts: ConnectedAccountRecord[];
}

/**
 * Engage (T-219, T-220, T-224; ADR-157, KSP-06) sesuai kartu Postific
 * `ScreenEngagePerPosting` (T-216, dikonfirmasi King Rezi): toolbar (toggle
 * By post / List, Akun, Status, panel Filter & Sort), lalu tampilan By post
 * (daftar posting di kiri, komentar posting terpilih di kanan) atau List
 * (daftar datar). State dan efek ada di `useEngageInbox`; berkas ini hanya
 * menyusun tata letak dan state kosong/gagal.
 */
export function EngageInboxView({
  initialGroups,
  initialNextCursor,
  initialCounts,
  initialLoadFailed,
  accounts,
}: EngageInboxViewProps) {
  const timeZone = useUserTimeZone();
  const inbox = useEngageInbox({
    initialGroups,
    initialNextCursor,
    initialCounts,
    initialLoadFailed,
  });

  const isList = inbox.view === "list";
  // Layar detail penuh di layar sempit hanya berlaku di By post.
  const inDetail = !isList && inbox.mobileView === "detail";
  const statusValue =
    inbox.statusFilter === ALL_FILTER_VALUE
      ? "all"
      : (inbox.statusFilter as InboxItemStatus);
  // Daftar kosong hanya bila memuat selesai tanpa kegagalan: selama memuat atau
  // gagal memuat halaman pertama, footer daftar menampilkan skeleton atau Alert.
  const listEmpty =
    !inbox.flatList.isRefreshing &&
    inbox.flatList.status === "end" &&
    inbox.flat.length === 0;
  const isEmpty = isList
    ? listEmpty
    : inbox.groups.length === 0 &&
      !inbox.showEmptyPosts &&
      !inbox.groupsList.isRefreshing &&
      inbox.groupsList.status === "end";
  // Muat awal (atau Refresh) gagal tanpa data apa pun: hanya Alert gagal yang
  // tampil; "Belum ada interaksi" akan menyesatkan.
  const loadFailedEmpty =
    inbox.refreshFailed &&
    (isList ? inbox.flat.length === 0 : inbox.groups.length === 0);
  const statusFilterActive = inbox.statusFilter !== ALL_FILTER_VALUE;
  const updatedAt = formatUpdatedAtLabel(inbox.lastUpdatedAt, timeZone);

  return (
    <div className="flex h-full flex-col gap-3">
      <div
        className={cn(
          "flex items-center justify-between gap-4",
          inDetail && "max-md:hidden",
        )}
      >
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Engage
          </h1>
          <Text variant="muted">
            Diperbarui {updatedAt} · sinkronisasi tiap 30 menit
          </Text>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void inbox.handleRefresh()}
          disabled={inbox.isRefreshing}
          aria-busy={inbox.isRefreshing}
        >
          <HugeiconsIcon
            icon={Refresh01Icon}
            strokeWidth={2}
            className={cn(inbox.isRefreshing && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {inbox.refreshFailed ? (
        <Alert
          variant="destructive"
          className={cn(inDetail && "max-md:hidden")}
        >
          <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
          <AlertTitle>Komentar terbaru belum dapat diambil</AlertTitle>
          <AlertDescription>
            Data terakhir diperbarui {updatedAt} tetap ditampilkan.
          </AlertDescription>
          <AlertAction>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={inbox.isRefreshing}
              onClick={() => void inbox.handleRefresh()}
            >
              Coba Lagi
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      <EngageToolbar
        className={cn(inDetail && "max-md:hidden")}
        accounts={accounts}
        accountFilter={inbox.accountFilter}
        onAccountChange={inbox.setAccountFilter}
        statusFilter={inbox.statusFilter}
        onStatusChange={inbox.setStatusFilter}
        platformFilter={inbox.platformFilter}
        onPlatformChange={inbox.setPlatformFilter}
        sort={inbox.sort}
        onSortChange={inbox.setSort}
        dateRange={inbox.dateRange}
        onDateRangeChange={inbox.setDateRange}
        hasActiveFilter={inbox.hasActiveFilter}
        onReset={inbox.resetFilters}
        viewToggleSlot={
          <EngageViewToggle value={inbox.view} onChange={inbox.setView} />
        }
      />

      {loadFailedEmpty ? null : isEmpty ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-border bg-card p-4">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={Comment01Icon} strokeWidth={2} />
              </EmptyMedia>
              <EmptyTitle>
                {inbox.hasActiveFilter
                  ? "Tidak ada interaksi untuk filter ini"
                  : "Belum ada interaksi"}
              </EmptyTitle>
              <EmptyDescription>
                {inbox.hasActiveFilter
                  ? "Coba ubah atau reset filter untuk melihat komentar lain."
                  : "Mulai publish konten untuk melihat engagement."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {inbox.hasActiveFilter ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={inbox.resetFilters}
                >
                  Reset filters
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/publish">Buka Publish</Link>
                </Button>
              )}
              {!isList && !statusFilterActive ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => inbox.setShowEmptyPosts(true)}
                >
                  Tampilkan posting tanpa komentar
                </Button>
              ) : null}
            </EmptyContent>
          </Empty>
        </div>
      ) : isList ? (
        <CommentListView
          comments={inbox.flat}
          counts={inbox.flatCounts}
          list={inbox.flatList}
          postCaptions={inbox.postCaptions}
          sort={inbox.sort}
          dateRange={inbox.dateRange}
          timeZone={timeZone}
          replyTarget={inbox.replyTarget}
          draft={inbox.draft}
          isSending={inbox.isSending}
          justSent={inbox.justSent}
          onOpenPost={(comment) => void inbox.openPostFromList(comment)}
          onReply={inbox.startReply}
          onChangeStatus={(comment, status) =>
            void inbox.changeStatus(comment, status)
          }
          onDraftChange={inbox.setDraft}
          onCancelReply={inbox.cancelReply}
          onSend={() => void inbox.sendReply()}
        />
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
          <PostListPanel
            groups={inbox.groups}
            accounts={accounts}
            selectedKey={inbox.effectiveKey}
            collapsed={inbox.collapsed}
            showEmptyPosts={inbox.showEmptyPosts}
            showEmptyPostsDisabledReason={
              statusFilterActive
                ? "Tidak berlaku saat filter Status aktif: posting tanpa komentar tidak punya status."
                : undefined
            }
            totalUnread={inbox.totalUnread}
            hiddenOnMobile={inDetail}
            postCount={inbox.postCount}
            list={inbox.groupsList}
            onSelect={inbox.selectGroup}
            onCollapsedChange={inbox.setCollapsed}
            onShowEmptyPostsChange={inbox.setShowEmptyPosts}
          />
          {inbox.selectedGroup ? (
            <PostCommentsPanel
              group={inbox.selectedGroup}
              accounts={accounts}
              comments={inbox.comments}
              list={inbox.commentsList}
              statusFilter={statusValue}
              timeZone={timeZone}
              hiddenOnMobile={!inDetail}
              bannerDismissed={inbox.bannerDismissed}
              replyTarget={inbox.replyTarget}
              draft={inbox.draft}
              isSending={inbox.isSending}
              justSent={inbox.justSent}
              onBack={() => inbox.setMobileView("list")}
              onDismissBanner={inbox.dismissBanner}
              onReply={inbox.startReply}
              onChangeStatus={(comment, status) =>
                void inbox.changeStatus(comment, status)
              }
              onDraftChange={inbox.setDraft}
              onCancelReply={inbox.cancelReply}
              onSend={() => void inbox.sendReply()}
            />
          ) : inbox.groupsList.isRefreshing ? null : (
            <div className="hidden flex-1 items-center justify-center md:flex">
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Belum ada posting</EmptyTitle>
                  <EmptyDescription>
                    Tidak ada posting yang cocok dengan tampilan ini.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
