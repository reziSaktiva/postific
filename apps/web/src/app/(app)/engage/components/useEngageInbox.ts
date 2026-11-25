"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import {
  asConnectedAccountId,
  asPageCursor,
  type CursorPage,
  type PageCursor,
  type SocialPlatform,
} from "@postific/shared";
import type {
  EngagementInboxItemRecord,
  InboxDateRange,
  InboxItemCounts,
  InboxItemStatus,
  InboxPostGroupCounts,
  InboxPostSort,
} from "@/domains/engagement";

import { useInfiniteList } from "../../components/infinite-list/useInfiniteList";
import {
  changeInboxItemStatusAction,
  refreshInboxAction,
  replyToCommentAction,
} from "../actions";
import {
  fetchCommentsPage,
  fetchPostGroupsPage,
  type CommentsRequest,
  type PostGroupsRequest,
} from "../engage-client";
import type { InboxPostGroupDto } from "../engage-dto";
import {
  ALL_FILTER_VALUE,
  DEFAULT_DATE_RANGE,
  DEFAULT_SORT,
  type EngageView,
  type JustSent,
  NO_POST_KEY,
  applyStatusToCounts,
  applyStatusToGroup,
  compareComments,
  compareGroups,
  groupKey,
} from "./engage-model";

const STATUS_TOAST: Record<InboxItemStatus, string> = {
  unread: "Komentar dibuka kembali",
  replied: "Komentar ditandai Dibalas",
  resolved: "Komentar ditandai Selesai",
  dismissed: "Komentar diabaikan",
};

const EMPTY_PAGE: CursorPage<never> = { items: [], nextCursor: null };

/** Kartu kosong untuk menghitung selisih satu perubahan status lewat `applyStatusToGroup`. */
const ZERO_GROUP = {
  unrepliedCount: 0,
  handledCount: 0,
  repliedCount: 0,
} as InboxPostGroupDto;

const NO_OVERRIDES: ReadonlyMap<string, InboxItemStatus> = new Map();

const commentKey = (item: EngagementInboxItemRecord) => item.id;

function toPage<T>(items: T[], nextCursor: string | null): CursorPage<T> {
  return {
    items,
    nextCursor: nextCursor === null ? null : asPageCursor(nextCursor),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Daftar tidak dapat dimuat.";
}

export interface UseEngageInboxArgs {
  /** Halaman pertama daftar posting (filter bawaan), dari server. */
  initialGroups: InboxPostGroupDto[];
  initialNextCursor: string | null;
  /** Hitungan sebenarnya daftar posting; `null` bila muat awal gagal. */
  initialCounts: InboxPostGroupCounts | null;
  /** Muat awal daftar posting gagal: tampilkan Alert gagal, bukan state "kosong". */
  initialLoadFailed: boolean;
}

/**
 * State dan efek Engage (T-219, T-220, T-224, T-303). Dipisah dari
 * `EngageInboxView` (T-219.1). Tanpa Supabase Realtime (ADR-023). Tiga daftar
 * berhalaman 20 per halaman (ADR-166), masing-masing satu `useInfiniteList`:
 * posting (By post), komentar posting terpilih, dan komentar semua posting
 * (List). Halaman berikutnya lewat Route Handler GET `/api/engage/*`; filter
 * berubah atau Refresh memanggil `refresh` hook (daftar dikosongkan seketika,
 * halaman pertama filter lama yang datang terlambat dibuang hook). Hitungan
 * (jumlah posting, belum dibalas, total komentar) dari count query di halaman
 * pertama, bukan panjang daftar termuat. Balasan dan perubahan status
 * mengubah komentar di tempat (`statusOverrides`), tanpa memindahkan baris.
 */
export function useEngageInbox({
  initialGroups,
  initialNextCursor,
  initialCounts,
  initialLoadFailed,
}: UseEngageInboxArgs) {
  const [accountFilter, setAccountFilter] = useState(ALL_FILTER_VALUE);
  const [platformFilter, setPlatformFilter] = useState(ALL_FILTER_VALUE);
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER_VALUE);
  const [sort, setSort] = useState<InboxPostSort>(DEFAULT_SORT);
  const [dateRange, setDateRange] =
    useState<InboxDateRange>(DEFAULT_DATE_RANGE);
  const [showEmptyPosts, setShowEmptyPosts] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(initialLoadFailed);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());
  // Naik setiap Refresh: memuat ulang komentar posting terpilih / tampilan List.
  const [refreshTick, setRefreshTick] = useState(0);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Kelompok yang dibuka dari tampilan List padahal belum ada di halaman
  // termuat; hanya berlaku untuk filter (`signature`) saat dibuka.
  const [pinned, setPinned] = useState<{
    signature: string;
    group: InboxPostGroupDto;
  } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  // Push navigation layar sempit (T-111.5): "list" bawaan, "detail" setelah
  // memilih posting. Di `md:` ke atas tidak berpengaruh visual.
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  // Tampilan List (T-224): daftar datar lintas posting, dimuat hanya saat
  // List dibuka (tidak ada query tambahan di render awal By post).
  const [view, setViewState] = useState<EngageView>("post");

  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [justSent, setJustSent] = useState<JustSent>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // Status yang diubah pengguna di sesi ini, ditumpuk di atas komentar termuat:
  // komentar tetap di tempatnya (tidak melompat ke bagian lain urutan) sampai
  // daftar dimuat ulang. Berlaku hanya untuk permintaan daftar (`signature`)
  // saat diubah, jadi daftar yang dimuat ulang otomatis tanpa tumpukan lama.
  const [overrides, setOverrides] = useState<{
    signature: string | null;
    map: ReadonlyMap<string, InboxItemStatus>;
  }>({ signature: null, map: NO_OVERRIDES });
  // Selisih hitungan kartu akibat perubahan status di sesi ini (optimistis),
  // ditumpuk di atas kartu termuat; dibuang saat hitungan server masuk.
  const [groupDeltas, setGroupDeltas] = useState<
    ReadonlyMap<string, { unread: number; replied: number }>
  >(() => new Map());
  // Naik setiap daftar posting diganti hasil fetch: rollback hitungan kartu
  // dilewati bila daftar sudah diganti (hitungan server sudah masuk).
  const groupsEpochRef = useRef(0);
  // Naik setiap filter yang memengaruhi daftar posting berubah: Refresh yang
  // dimulai dengan filter lama tidak boleh memuat ulang daftar dengan filter itu.
  const filterVersionRef = useRef(0);
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
  const statusValue: InboxItemStatus | "all" = status ?? "all";

  // ---- Daftar posting (By post) ----
  const [groupCounts, setGroupCounts] = useState(initialCounts);
  const groupsLoadSeqRef = useRef(0);

  const groupsRequest = useMemo<PostGroupsRequest>(
    () => ({
      ...(accountId && { connectedAccountId: accountId }),
      ...(platform && { platform }),
      ...(status && { status }),
      includeEmpty: showEmptyPosts,
      sort,
      dateRange,
    }),
    [accountId, platform, status, showEmptyPosts, sort, dateRange],
  );

  const groupsList = useInfiniteList<InboxPostGroupDto>({
    initialPage: toPage(initialGroups, initialNextCursor),
    loadPage: async (cursor: PageCursor) => {
      const page = await fetchPostGroupsPage(groupsRequest, cursor);
      return toPage(page.groups, page.nextCursor);
    },
    getKey: groupKey,
    compare: useMemo(() => compareGroups(sort), [sort]),
  });
  const refreshGroupsList = groupsList.refresh;

  /** Halaman pertama + hitungan; hitungan hanya dipakai bila ini muat terbaru. */
  const loadGroupsFirst = useCallback(async () => {
    groupsLoadSeqRef.current += 1;
    const seq = groupsLoadSeqRef.current;
    const page = await fetchPostGroupsPage(
      { ...groupsRequest, withCounts: true },
      null,
    );
    if (seq === groupsLoadSeqRef.current) {
      groupsEpochRef.current += 1;
      setGroupDeltas(new Map());
      setGroupCounts(page.counts);
    }
    return toPage(page.groups, page.nextCursor);
  }, [groupsRequest]);

  // Lewati muat pertama: `initialGroups` sudah state filter bawaan. Layout
  // effect: daftar lama sudah kosong sebelum browser menggambar filter baru.
  const skipNextGroupsLoadRef = useRef(true);
  useLayoutEffect(() => {
    if (skipNextGroupsLoadRef.current) {
      skipNextGroupsLoadRef.current = false;
      return;
    }
    filterVersionRef.current += 1;
    refreshGroupsList(loadGroupsFirst);
  }, [loadGroupsFirst, refreshGroupsList]);

  const groups = useMemo(
    () =>
      groupDeltas.size === 0
        ? groupsList.items
        : groupsList.items.map((group) => {
            const delta = groupDeltas.get(groupKey(group));
            return delta
              ? {
                  ...group,
                  unrepliedCount: group.unrepliedCount + delta.unread,
                  handledCount: group.handledCount - delta.unread,
                  repliedCount: group.repliedCount + delta.replied,
                }
              : group;
          }),
    [groupsList.items, groupDeltas],
  );

  // Pilihan "efektif" dihitung saat render: bila posting terpilih hilang
  // (filter berubah), jatuh ke kelompok pertama.
  const pinnedGroup =
    pinned && pinned.signature === JSON.stringify(groupsRequest)
      ? pinned.group
      : null;
  const pinnedKey = pinnedGroup ? groupKey(pinnedGroup) : null;
  const effectiveKey =
    groups.some((g) => groupKey(g) === selectedKey) ||
    (pinnedKey !== null && pinnedKey === selectedKey)
      ? selectedKey
      : groups[0]
        ? groupKey(groups[0])
        : null;
  const selectedGroup =
    groups.find((g) => groupKey(g) === effectiveKey) ??
    (pinnedGroup && pinnedKey === effectiveKey ? pinnedGroup : null);

  // ---- Komentar posting terpilih ----
  const commentsRequest = useMemo<CommentsRequest>(
    () => ({
      postId: effectiveKey ?? undefined,
      ...(accountId && { connectedAccountId: accountId }),
      ...(platform && { platform }),
      ...(status && { status }),
      sort,
      dateRange,
    }),
    [effectiveKey, accountId, platform, status, sort, dateRange],
  );
  const commentsList = useInfiniteList<EngagementInboxItemRecord>({
    initialPage: EMPTY_PAGE,
    loadPage: async (cursor: PageCursor) => {
      const page = await fetchCommentsPage(commentsRequest, cursor);
      return toPage(page.items, page.nextCursor);
    },
    getKey: commentKey,
    compare: useMemo(() => compareComments(sort), [sort]),
  });
  const refreshCommentsList = commentsList.refresh;
  const commentsSignature =
    view === "post" && effectiveKey
      ? JSON.stringify([commentsRequest, refreshTick])
      : null;
  useLayoutEffect(() => {
    if (commentsSignature === null) return;
    refreshCommentsList(async () => {
      const page = await fetchCommentsPage(commentsRequest, null);
      return toPage(page.items, page.nextCursor);
    });
    // `commentsRequest` sudah terwakili `commentsSignature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentsSignature, refreshCommentsList]);

  // ---- Tampilan List (semua komentar) ----
  // Hitungan List dari count query; berlaku hanya untuk permintaan (`signature`)
  // yang menghitungnya.
  const [flatCountsState, setFlatCountsState] = useState<{
    signature: string;
    counts: InboxItemCounts | null;
  } | null>(null);
  const [postCaptions, setPostCaptions] = useState<Record<string, string>>({});
  const flatLoadSeqRef = useRef(0);
  const flatRequest = useMemo<CommentsRequest>(
    () => ({
      ...(accountId && { connectedAccountId: accountId }),
      ...(platform && { platform }),
      ...(status && { status }),
      sort,
      dateRange,
      includePostCaptions: true,
    }),
    [accountId, platform, status, sort, dateRange],
  );
  const flatList = useInfiniteList<EngagementInboxItemRecord>({
    initialPage: EMPTY_PAGE,
    loadPage: async (cursor: PageCursor) => {
      const page = await fetchCommentsPage(flatRequest, cursor);
      setPostCaptions((prev) => ({ ...prev, ...page.postCaptions }));
      return toPage(page.items, page.nextCursor);
    },
    getKey: commentKey,
    compare: useMemo(() => compareComments(sort), [sort]),
  });
  const refreshFlatList = flatList.refresh;
  const flatSignature =
    view === "list" ? JSON.stringify([flatRequest, refreshTick]) : null;
  useLayoutEffect(() => {
    if (flatSignature === null) return;
    refreshFlatList(async () => {
      flatLoadSeqRef.current += 1;
      const seq = flatLoadSeqRef.current;
      const page = await fetchCommentsPage(
        { ...flatRequest, withCounts: true },
        null,
      );
      if (seq === flatLoadSeqRef.current) {
        setFlatCountsState({ signature: flatSignature, counts: page.counts });
        setPostCaptions((prev) => ({ ...prev, ...page.postCaptions }));
      }
      return toPage(page.items, page.nextCursor);
    });
    // `flatRequest` sudah terwakili `flatSignature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatSignature, refreshFlatList]);
  const flatCounts =
    flatCountsState && flatCountsState.signature === flatSignature
      ? flatCountsState.counts
      : null;

  const activeSignature = view === "post" ? commentsSignature : flatSignature;
  const statusOverrides =
    overrides.signature === activeSignature ? overrides.map : NO_OVERRIDES;

  // Komentar yang ditampilkan: status dari `statusOverrides` ditumpuk, lalu
  // disaring filter Status (komentar yang baru berpindah status keluar seketika).
  const applyOverrides = useCallback(
    (items: EngagementInboxItemRecord[]) => {
      const overridden =
        statusOverrides.size === 0
          ? items
          : items.map((item) => {
              const override = statusOverrides.get(item.id);
              return override ? { ...item, status: override } : item;
            });
      return statusValue === "all"
        ? overridden
        : overridden.filter((item) => item.status === statusValue);
    },
    [statusOverrides, statusValue],
  );
  const comments = useMemo(
    () => applyOverrides(commentsList.items),
    [applyOverrides, commentsList.items],
  );
  const flat = useMemo(
    () => applyOverrides(flatList.items),
    [applyOverrides, flatList.items],
  );

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
    // Filter berubah selama sinkronisasi di server: muat ulang milik filter
    // baru sudah berjalan sendiri; memuat dengan filter lama akan menimpanya.
    if (filterVersion !== filterVersionRef.current) {
      setIsRefreshing(false);
      return;
    }

    // Muat ulang dari halaman pertama: daftar posting di sini, komentar posting
    // terpilih dan tampilan List lewat `refreshTick`. `refresh` hook hanya
    // menerapkan muat terbaru, jadi balapan dengan perubahan filter aman.
    const started = loadGroupsFirst();
    const seq = groupsLoadSeqRef.current;
    refreshGroupsList(() => started);
    setPinned(null);
    setRefreshTick((tick) => tick + 1);

    // Stempel "Diperbarui" dan toast jumlah komentar hanya bila daftar benar-benar
    // diperbarui; gagal atau digantikan muat lain tidak boleh terlihat sebagai sukses.
    let listApplied = false;
    try {
      await started;
      listApplied = seq === groupsLoadSeqRef.current;
    } catch (error) {
      toast.error(errorMessage(error));
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
  }, [loadGroupsFirst, refreshGroupsList]);

  const patchStatus = useCallback(
    (
      comment: EngagementInboxItemRecord,
      from: InboxItemStatus,
      to: InboxItemStatus,
      { adjustGroup = true }: { adjustGroup?: boolean } = {},
    ) => {
      setOverrides((prev) => ({
        signature: activeSignature,
        map: new Map(
          prev.signature === activeSignature ? prev.map : NO_OVERRIDES,
        ).set(comment.id, to),
      }));
      // Hitungan List ikut berubah di tempat; di By post hitungan ada di kartu.
      setFlatCountsState((prev) =>
        prev && prev.counts
          ? {
              ...prev,
              counts: applyStatusToCounts(prev.counts, from, to, statusValue),
            }
          : prev,
      );
      if (!adjustGroup) return;
      const key = comment.postId ?? NO_POST_KEY;
      const probe = applyStatusToGroup(ZERO_GROUP, from, to);
      const delta = {
        unread: probe.unrepliedCount,
        replied: probe.repliedCount,
      };
      // Hanya kartu yang sudah termuat: kartu yang belum dimuat membawa
      // hitungan server yang sudah memuat perubahan ini.
      if (groups.some((group) => groupKey(group) === key)) {
        setGroupDeltas((prev) => {
          const current = prev.get(key) ?? { unread: 0, replied: 0 };
          return new Map(prev).set(key, {
            unread: current.unread + delta.unread,
            replied: current.replied + delta.replied,
          });
        });
      }
      setPinned((prev) =>
        prev && groupKey(prev.group) === key
          ? { ...prev, group: applyStatusToGroup(prev.group, from, to) }
          : prev,
      );
      setGroupCounts((prev) =>
        prev && (from === "unread") !== (to === "unread")
          ? {
              ...prev,
              unrepliedCount: prev.unrepliedCount + (to === "unread" ? 1 : -1),
            }
          : prev,
      );
    },
    [groups, statusValue, activeSignature],
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
    (view === "list" ? flat : comments).find(
      (item) => item.id === replyTargetId,
    ) ?? null;

  const setView = useCallback((next: EngageView) => {
    setViewState(next);
    // Pindah tampilan memuat ulang daftarnya dari halaman pertama (efek
    // `*Signature`), jadi tidak ada data basi dari tampilan sebelumnya.
    setReplyTargetId(null);
    setDraft("");
  }, []);

  /** Dari baris konteks tampilan List: buka posting itu di By post (KSP-06-F09). */
  const openPostFromList = useCallback(
    async (comment: EngagementInboxItemRecord) => {
      const key = comment.postId ?? NO_POST_KEY;
      // Posting yang belum ada di halaman termuat (daftar posting berhalaman,
      // T-303): ambil kelompoknya sendiri, jangan jatuh ke pilihan efektif lain.
      if (!groups.some((group) => groupKey(group) === key)) {
        try {
          const page = await fetchPostGroupsPage(
            { ...groupsRequest, includeEmpty: false, postId: key },
            null,
          );
          const group = page.groups[0];
          if (!group) {
            toast.error("Posting tidak ditemukan untuk filter ini.");
            return;
          }
          setPinned({ signature: JSON.stringify(groupsRequest), group });
        } catch (error) {
          toast.error(errorMessage(error));
          return;
        }
      }
      setViewState("post");
      setSelectedKey(key);
      setMobileView("detail");
      setReplyTargetId(null);
      setDraft("");
    },
    [groups, groupsRequest],
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

  const totalUnread =
    groupCounts?.unrepliedCount ??
    groups.reduce((sum, group) => sum + group.unrepliedCount, 0);

  return {
    view,
    setView,
    openPostFromList,
    flat,
    flatList,
    flatCounts,
    postCaptions,
    sort,
    setSort,
    dateRange,
    setDateRange,
    groups,
    groupsList,
    postCount: groupCounts?.postCount ?? null,
    totalUnread,
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
    comments,
    commentsList,
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
