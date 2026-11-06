"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { asConnectedAccountId, type SocialPlatform } from "@postific/shared";
import type {
  EngagementInboxItemRecord,
  InboxDateRange,
  InboxItemStatus,
} from "@/domains/engagement";

import {
  changeInboxItemStatusAction,
  listInboxAction,
  listInboxByPostAction,
  refreshInboxAction,
  replyToCommentAction,
  type InboxPostGroupDto,
  type ListInboxActionFilter,
} from "../actions";
import { NO_POST_KEY, applyStatusToGroup, groupKey } from "./engage-model";

export const ALL_FILTER_VALUE = "all";

/** Rentang bawaan (S-006, ADR-157); T-220 menjadikannya filter yang bisa diubah. */
export const DEFAULT_DATE_RANGE: InboxDateRange = "12m";

const STATUS_TOAST: Record<InboxItemStatus, string> = {
  unread: "Komentar dibuka kembali",
  replied: "Komentar ditandai Dibalas",
  resolved: "Komentar ditandai Selesai",
  dismissed: "Komentar diabaikan",
};

export interface UseEngageInboxArgs {
  initialGroups: InboxPostGroupDto[];
  initialTruncated: boolean;
  /** Muat awal daftar posting gagal: tampilkan state refresh gagal, bukan "kosong". */
  initialLoadFailed: boolean;
}

/**
 * State dan efek tampilan Engage per posting (T-219). Dipisah dari
 * `EngageInboxView` (T-219.1) tanpa mengubah pola sebelumnya: tanpa Supabase
 * Realtime (ADR-023), data diambil lewat Server Action saat filter berubah,
 * Refresh diklik, atau posting dipilih. Filter Akun/Platform/Status tetap
 * seperti sebelumnya (diganti T-220); struktur ini hanya menyediakan
 * `listInboxByPostAction` dengan masukan yang dibangun dari filter itu.
 */
export function useEngageInbox({
  initialGroups,
  initialTruncated,
  initialLoadFailed,
}: UseEngageInboxArgs) {
  const [groups, setGroups] = useState(initialGroups);
  const [truncated, setTruncated] = useState(initialTruncated);
  const [accountFilter, setAccountFilter] = useState(ALL_FILTER_VALUE);
  const [platformFilter, setPlatformFilter] = useState(ALL_FILTER_VALUE);
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER_VALUE);
  const [showEmptyPosts, setShowEmptyPosts] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(initialLoadFailed);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  // Push navigation layar sempit (T-111.5): "list" bawaan, "detail" setelah
  // memilih posting. Di `md:` ke atas tidak berpengaruh visual.
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  const [comments, setComments] = useState<{
    key: string;
    items: EngagementInboxItemRecord[];
  } | null>(null);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentsTick, setCommentsTick] = useState(0);

  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const justSentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accountId =
    accountFilter !== ALL_FILTER_VALUE
      ? asConnectedAccountId(accountFilter)
      : undefined;
  const platform =
    platformFilter !== ALL_FILTER_VALUE
      ? (platformFilter as SocialPlatform)
      : undefined;
  const status =
    statusFilter !== ALL_FILTER_VALUE
      ? (statusFilter as InboxItemStatus)
      : undefined;

  const fetchGroups = useCallback(async () => {
    const result = await listInboxByPostAction({
      ...(accountId && { connectedAccountId: accountId }),
      ...(platform && { platform }),
      ...(status && { status }),
      includeEmpty: showEmptyPosts,
      dateRange: DEFAULT_DATE_RANGE,
    });
    return result;
  }, [accountId, platform, status, showEmptyPosts]);

  // Lewati fetch pertama: `initialGroups` sudah state filter bawaan.
  const skipNextFetchRef = useRef(true);
  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    let cancelled = false;
    void (async () => {
      setIsLoadingList(true);
      const result = await fetchGroups();
      if (cancelled) return;
      if (result.error) {
        toast.error(result.error);
      } else {
        setGroups(result.data ?? []);
        setTruncated(result.truncated ?? false);
      }
      setIsLoadingList(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchGroups]);

  // Pilihan "efektif" dihitung saat render: bila posting terpilih hilang
  // (filter berubah), jatuh ke kelompok pertama.
  const effectiveKey = groups.some((g) => groupKey(g) === selectedKey)
    ? selectedKey
    : groups[0]
      ? groupKey(groups[0])
      : null;
  const selectedGroup =
    groups.find((g) => groupKey(g) === effectiveKey) ?? null;

  // Komentar posting terpilih: semua status (filter status hanya menyaring
  // tampilan, supaya ringkasan "x dibalas / y total" tetap atas semuanya).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!effectiveKey) {
        setComments(null);
        setIsLoadingComments(false);
        return;
      }
      setIsLoadingComments(true);
      const filter: ListInboxActionFilter = {
        postId: effectiveKey === NO_POST_KEY ? null : effectiveKey,
        dateRange: DEFAULT_DATE_RANGE,
        ...(accountId && { connectedAccountId: accountId }),
        ...(platform && { platform }),
      };
      const result = await listInboxAction(filter);
      if (cancelled) return;
      if (result.error) {
        toast.error(result.error);
        setComments({ key: effectiveKey, items: [] });
      } else {
        setComments({ key: effectiveKey, items: result.data ?? [] });
      }
      setIsLoadingComments(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveKey, accountId, platform, commentsTick]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const refreshResult = await refreshInboxAction();
    if (refreshResult.error) {
      setRefreshFailed(true);
      setIsRefreshing(false);
      return;
    }
    setRefreshFailed(false);

    const listResult = await fetchGroups();
    if (listResult.error) {
      toast.error(listResult.error);
    } else {
      setGroups(listResult.data ?? []);
      setTruncated(listResult.truncated ?? false);
      setCommentsTick((tick) => tick + 1);
    }
    setLastUpdatedAt(new Date());
    setIsRefreshing(false);

    const newCommentsCount = refreshResult.newCommentsCount ?? 0;
    toast(
      newCommentsCount > 0
        ? `${newCommentsCount} komentar baru`
        : "Tidak ada komentar baru",
    );
  }, [fetchGroups]);

  const patchStatus = useCallback(
    (
      comment: EngagementInboxItemRecord,
      from: InboxItemStatus,
      to: InboxItemStatus,
    ) => {
      setComments((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) =>
                item.id === comment.id ? { ...item, status: to } : item,
              ),
            }
          : prev,
      );
      const key = comment.postId ?? NO_POST_KEY;
      setGroups((prev) =>
        prev.map((group) =>
          groupKey(group) === key ? applyStatusToGroup(group, from, to) : group,
        ),
      );
    },
    [],
  );

  /** Resolve, Dismiss, atau Buka kembali: pembaruan optimistis, kembali bila server menolak. */
  const changeStatus = useCallback(
    async (comment: EngagementInboxItemRecord, to: InboxItemStatus) => {
      const from = comment.status;
      if (from === to) return;
      patchStatus(comment, from, to);
      if (
        replyTargetId === comment.id &&
        (to === "resolved" || to === "dismissed")
      ) {
        setReplyTargetId(null);
        setDraft("");
      }
      const result = await changeInboxItemStatusAction(comment.id, to);
      if (result.error) {
        patchStatus(comment, to, from);
        toast.error(result.error);
        return;
      }
      toast(STATUS_TOAST[to]);
    },
    [patchStatus, replyTargetId],
  );

  const replyTarget =
    comments?.items.find((item) => item.id === replyTargetId) ?? null;

  const startReply = useCallback((comment: EngagementInboxItemRecord) => {
    setReplyTargetId(comment.id);
    setDraft("");
    setJustSent(false);
  }, []);

  const cancelReply = useCallback(() => {
    setReplyTargetId(null);
    setDraft("");
  }, []);

  const selectGroup = useCallback((key: string) => {
    setSelectedKey(key);
    setMobileView("detail");
    setReplyTargetId(null);
    setDraft("");
  }, []);

  const sendReply = useCallback(async () => {
    if (!replyTarget || !draft.trim()) return;
    setIsSending(true);
    const result = await replyToCommentAction(replyTarget.id, draft);
    setIsSending(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    // Server menandai `replied` hanya dari `unread` (T-217.3); cerminkan itu.
    if (replyTarget.status === "unread") {
      patchStatus(replyTarget, "unread", "replied");
    }
    setReplyTargetId(null);
    setDraft("");
    setJustSent(true);
    if (justSentTimerRef.current) clearTimeout(justSentTimerRef.current);
    justSentTimerRef.current = setTimeout(() => setJustSent(false), 2500);
    toast("Balasan terkirim");
  }, [replyTarget, draft, patchStatus]);

  useEffect(
    () => () => {
      if (justSentTimerRef.current) clearTimeout(justSentTimerRef.current);
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setAccountFilter(ALL_FILTER_VALUE);
    setPlatformFilter(ALL_FILTER_VALUE);
    setStatusFilter(ALL_FILTER_VALUE);
  }, []);

  const hasActiveFilter =
    accountFilter !== ALL_FILTER_VALUE ||
    platformFilter !== ALL_FILTER_VALUE ||
    statusFilter !== ALL_FILTER_VALUE;

  return {
    groups,
    truncated,
    accountFilter,
    setAccountFilter,
    platformFilter,
    setPlatformFilter,
    statusFilter,
    setStatusFilter,
    showEmptyPosts,
    setShowEmptyPosts,
    hasActiveFilter,
    resetFilters,
    isLoadingList,
    isRefreshing,
    refreshFailed,
    lastUpdatedAt,
    handleRefresh,
    collapsed,
    setCollapsed,
    mobileView,
    setMobileView,
    effectiveKey,
    selectedGroup,
    selectGroup,
    comments: comments && comments.key === effectiveKey ? comments.items : null,
    isLoadingComments,
    replyTarget,
    startReply,
    cancelReply,
    draft,
    setDraft,
    isSending,
    justSent,
    sendReply,
    changeStatus,
    bannerDismissed,
    dismissBanner: () => setBannerDismissed(true),
  };
}
