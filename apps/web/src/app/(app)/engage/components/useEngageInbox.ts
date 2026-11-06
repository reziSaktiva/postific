"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { asConnectedAccountId, type SocialPlatform } from "@postific/shared";
import type {
  EngagementInboxItemRecord,
  InboxDateRange,
  InboxItemStatus,
  InboxPostSort,
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
import {
  ALL_FILTER_VALUE,
  DEFAULT_DATE_RANGE,
  DEFAULT_SORT,
  type EngageView,
  type JustSent,
  NO_POST_KEY,
  applyStatusToGroup,
  groupKey,
} from "./engage-model";

const STATUS_TOAST: Record<InboxItemStatus, string> = {
  unread: "Komentar dibuka kembali",
  replied: "Komentar ditandai Dibalas",
  resolved: "Komentar ditandai Selesai",
  dismissed: "Komentar diabaikan",
};

export interface UseEngageInboxArgs {
  initialGroups: InboxPostGroupDto[];
  initialTruncated: boolean;
  /** Muat awal daftar posting gagal: tampilkan Alert gagal, bukan state "kosong". */
  initialLoadFailed: boolean;
}

/**
 * State dan efek Engage (T-219, T-220, T-224). Dipisah dari
 * `EngageInboxView` (T-219.1). Tanpa Supabase Realtime (ADR-023): data
 * diambil lewat Server Action saat filter berubah, tampilan List dibuka,
 * posting dipilih, atau Refresh diklik. Pengambilan daftar posting memakai
 * penjaga versi filter (`filterVersionRef`): hasil Refresh yang dimulai dengan
 * filter lama dibuang bila filter berubah selama Refresh berjalan.
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
  const [sort, setSort] = useState<InboxPostSort>(DEFAULT_SORT);
  const [dateRange, setDateRange] =
    useState<InboxDateRange>(DEFAULT_DATE_RANGE);
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

  // Tampilan List (T-224): daftar datar lintas posting, dimuat hanya saat
  // List dibuka (tidak ada query tambahan di render awal By post).
  const [view, setViewState] = useState<EngageView>("post");
  const [flat, setFlat] = useState<EngagementInboxItemRecord[] | null>(null);
  const [isLoadingFlat, setIsLoadingFlat] = useState(false);

  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [justSent, setJustSent] = useState<JustSent>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // Naik setiap filter yang memengaruhi daftar posting berubah: Refresh yang
  // dimulai dengan filter lama membuang hasilnya.
  const filterVersionRef = useRef(0);
  // Naik setiap daftar posting diganti hasil fetch: rollback hitungan kartu
  // dilewati bila daftar sudah diganti (hitungan server sudah masuk).
  const groupsEpochRef = useRef(0);
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
      sort,
      dateRange,
    });
    return result;
  }, [accountId, platform, status, showEmptyPosts, sort, dateRange]);

  // Lewati fetch pertama: `initialGroups` sudah state filter bawaan.
  const skipNextFetchRef = useRef(true);
  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    let cancelled = false;
    filterVersionRef.current += 1;
    void (async () => {
      setIsLoadingList(true);
      const result = await fetchGroups();
      if (cancelled) return;
      if (result.error) {
        toast.error(result.error);
      } else {
        groupsEpochRef.current += 1;
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
    // Tampilan List tidak memakai komentar per posting: lewati fetch. Kembali
    // ke By post menjalankan efek ini lagi (`view` ada di dependensi).
    if (view === "list") return;
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
        dateRange,
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
  }, [view, effectiveKey, accountId, platform, dateRange, commentsTick]);

  useEffect(() => {
    if (view !== "list") return;
    let cancelled = false;
    void (async () => {
      setIsLoadingFlat(true);
      const result = await listInboxAction({
        dateRange,
        ...(accountId && { connectedAccountId: accountId }),
        ...(platform && { platform }),
        ...(status && { status }),
      });
      if (cancelled) return;
      if (result.error) {
        toast.error(result.error);
        setFlat([]);
      } else {
        setFlat(result.data ?? []);
      }
      setIsLoadingFlat(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [view, accountId, platform, status, dateRange, commentsTick]);

  const handleRefresh = useCallback(async () => {
    const filterVersion = filterVersionRef.current;
    setIsRefreshing(true);
    const refreshResult = await refreshInboxAction();
    if (refreshResult.error) {
      setRefreshFailed(true);
      setIsRefreshing(false);
      return;
    }
    setRefreshFailed(false);

    const listResult = await fetchGroups();
    // Filter berubah selama Refresh berjalan (termasuk selama aksi refresh di
    // server): hasil ini dibuat dengan filter lama, jadi tidak boleh menimpa
    // daftar. Fetch milik filter baru sudah berjalan sendiri.
    // Stempel "Diperbarui" dan toast jumlah komentar hanya bila daftar benar-benar
    // diperbarui; gagal atau dibuang tidak boleh terlihat sebagai sukses.
    let listApplied = false;
    if (filterVersion === filterVersionRef.current) {
      if (listResult.error) {
        toast.error(listResult.error);
      } else {
        groupsEpochRef.current += 1;
        setGroups(listResult.data ?? []);
        setTruncated(listResult.truncated ?? false);
        setCommentsTick((tick) => tick + 1);
        listApplied = true;
      }
      setIsLoadingList(false);
    }
    setIsRefreshing(false);
    if (!listApplied) return;
    setLastUpdatedAt(new Date());

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
      { adjustGroup = true }: { adjustGroup?: boolean } = {},
    ) => {
      const apply = (item: EngagementInboxItemRecord) =>
        item.id === comment.id ? { ...item, status: to } : item;
      setComments((prev) =>
        prev ? { ...prev, items: prev.items.map(apply) } : prev,
      );
      setFlat((prev) => (prev ? prev.map(apply) : prev));
      if (!adjustGroup) return;
      const key = comment.postId ?? NO_POST_KEY;
      setGroups((prev) =>
        prev.map((group) =>
          groupKey(group) === key ? applyStatusToGroup(group, from, to) : group,
        ),
      );
    },
    [],
  );

  // Sinkron dengan state agar callback async (setelah `await`) membaca
  // target balasan terbaru, bukan nilai saat klik.
  const replyTargetIdRef = useRef<string | null>(null);
  useEffect(() => {
    replyTargetIdRef.current = replyTargetId;
  }, [replyTargetId]);

  /**
   * Resolve, Dismiss, atau Buka kembali: pembaruan optimistis. Bila server
   * menolak, status komentar dikembalikan; hitungan kartu hanya dikembalikan
   * bila daftar posting belum diganti fetch lain sejak patch (epoch sama),
   * karena fetch yang masuk sudah membawa hitungan server dan pembalikan
   * kedua akan menghitung ganda. Draf balasan baru dibuang setelah server sukses.
   */
  const changeStatus = useCallback(
    async (comment: EngagementInboxItemRecord, to: InboxItemStatus) => {
      const from = comment.status;
      if (from === to) return;
      const epochAtPatch = groupsEpochRef.current;
      patchStatus(comment, from, to);
      const result = await changeInboxItemStatusAction(comment.id, to);
      if (result.error) {
        patchStatus(comment, to, from, {
          adjustGroup: groupsEpochRef.current === epochAtPatch,
        });
        toast.error(result.error);
        return;
      }
      if (
        replyTargetIdRef.current === comment.id &&
        (to === "resolved" || to === "dismissed")
      ) {
        setReplyTargetId(null);
        setDraft("");
      }
      toast(STATUS_TOAST[to]);
    },
    [patchStatus],
  );

  const replyTarget =
    (view === "list"
      ? flat?.find((item) => item.id === replyTargetId)
      : comments?.items.find((item) => item.id === replyTargetId)) ?? null;

  const setView = useCallback((next: EngageView) => {
    setViewState(next);
    // Perubahan status di List tidak menyentuh daftar komentar per posting:
    // buang agar kembali ke By post tidak menampilkan data basi.
    setComments(null);
    setReplyTargetId(null);
    setDraft("");
  }, []);

  /** Dari baris konteks tampilan List: buka posting itu di By post (KSP-06-F09). */
  const openPostFromList = useCallback(
    (comment: EngagementInboxItemRecord) => {
      const key = comment.postId ?? NO_POST_KEY;
      // Posting di luar daftar (mis. lewat batas 100 posting): jangan membuka
      // posting lain lewat fallback pilihan efektif.
      if (!groups.some((group) => groupKey(group) === key)) return;
      setViewState("post");
      setSelectedKey(key);
      setMobileView("detail");
      setReplyTargetId(null);
      setDraft("");
    },
    [groups],
  );

  const startReply = useCallback((comment: EngagementInboxItemRecord) => {
    setReplyTargetId(comment.id);
    setDraft("");
    setJustSent(null);
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
    const marked = replyTarget.status === "unread";
    if (marked) {
      patchStatus(replyTarget, "unread", "replied");
    }
    setReplyTargetId(null);
    setDraft("");
    setJustSent(marked ? "marked" : "sent");
    if (justSentTimerRef.current) clearTimeout(justSentTimerRef.current);
    justSentTimerRef.current = setTimeout(() => setJustSent(null), 2500);
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
    setSort(DEFAULT_SORT);
    setDateRange(DEFAULT_DATE_RANGE);
  }, []);

  const hasActiveFilter =
    accountFilter !== ALL_FILTER_VALUE ||
    platformFilter !== ALL_FILTER_VALUE ||
    statusFilter !== ALL_FILTER_VALUE ||
    sort !== DEFAULT_SORT ||
    dateRange !== DEFAULT_DATE_RANGE;

  return {
    view,
    setView,
    openPostFromList,
    flat,
    isLoadingFlat,
    sort,
    setSort,
    dateRange,
    setDateRange,
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
