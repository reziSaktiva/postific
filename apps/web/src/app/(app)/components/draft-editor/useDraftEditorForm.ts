"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { ContentFormat, ContentStatus, SocialPlatform } from "@postific/shared";
import { scheduleTimeConstraintMessage } from "@/domains/publishing/schedule-time-constraints";
import { zonedLocalToUtc } from "@/domains/publishing/wib-time";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";

import { markTerminalNavigationPending } from "@/lib/navigation/pending-terminal-navigation";
import { isCaptionRequiredForFormats } from "@/domains/publishing";

import {
  getConnectedAccountsAction,
  getLastUsedAccountIdsAction,
  getDraftAction,
  publishNowAction,
  saveDraftAction,
  scheduleDraftAction,
  updateDraftAction,
} from "./actions";
import { useDraftEditor } from "./Context";
import type {
  ConnectedAccount,
  FormNotice,
  LatestFormSnapshot,
  PendingAction,
} from "./form-shared";
import { getDefaultFormat, isAccountDisconnected } from "./form-shared";
import { diffSelection } from "./account-selection";
import { getActionReadiness } from "./action-readiness";
import type { TerminalAction } from "./terminal-destination";
import {
  isAlreadyAtDestination,
  resolveTerminalDestination,
} from "./terminal-destination";
import { decideDraftSaveTargets } from "./draft-save-targets";
import { restoreDraftTargetSelection } from "./restore-draft-targets";
import { resolveActiveAccountId } from "./network-blocks-state";
import { validateNetworks } from "./network-validation";
import { useDraftMedia } from "./useDraftMedia";
import { usePinterestBoards } from "./usePinterestBoards";

export interface DraftEditorFormParams {
  mode: "create" | "edit";
  postId?: string;
  prefillCaption?: string;
  /**
   * Set only when the editor was opened from an entry point scoped to a
   * specific connected account (sidebar Channels "+" — T-012, ADR-058
   * addendum poin 9). The Account Selector below pre-checks this account as
   * soon as `getConnectedAccountsAction` resolves.
   */
  preSelectedAccountId?: string;
  /**
   * Publish Now dari Queue (T-032.4) — lihat effect di bawah yang
   * memanfaatkan nilai ini begitu data selesai dimuat.
   */
  initialPendingAction?: "publish-now";
  onLatestChange: (snapshot: LatestFormSnapshot) => void;
}

/**
 * Owns all editor form state for one New Post / Edit Draft session: state,
 * efek pemuatan, nilai turunan (validasi), dan aksi (save/schedule/publish)
 * dipusatkan di sini; komponen modul (`DraftEditorForm` dan anak-anaknya)
 * hanya merender. `DraftEditorForm` di-mount ulang (via `key` di
 * `DraftEditorModal`) setiap sesi baru dimulai, jadi state ter-reset secara
 * natural saat mount alih-alih di-reset imperatif lewat effect.
 */
export function useDraftEditorForm({
  mode,
  postId,
  prefillCaption,
  preSelectedAccountId,
  initialPendingAction,
  onLatestChange,
}: DraftEditorFormParams) {
  const timeZone = useUserTimeZone();
  const { close, clearUnsavedNewPost } = useDraftEditor();
  const router = useRouter();
  const pathname = usePathname();

  const isEdit = mode === "edit";

  const [caption, setCaption] = useState(prefillCaption ?? "");
  const [status, setStatus] = useState<ContentStatus>(ContentStatus.Draft);
  const [savedPostId, setSavedPostId] = useState<string | undefined>(postId);
  const [isLoadingDraft, setIsLoadingDraft] = useState(isEdit);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(
    preSelectedAccountId ? [preSelectedAccountId] : [],
  );
  const [formatByAccount, setFormatByAccount] = useState<
    Record<string, ContentFormat>
  >({});
  const [pinTitle, setPinTitle] = useState("");
  const [pinLink, setPinLink] = useState("");
  // Board Pinterest (KI-072) dipilih PER POST tapi PER AKUN (bug fix QA
  // 2026-09-25) — keyed by `connectedAccountId`, sama pola dengan
  // `formatByAccount`/`pinterestBoardsByAccount`, supaya board yang dipilih
  // di satu akun Pinterest tidak ikut menimpa akun Pinterest lain yang
  // dicentang bersamaan dalam post yang sama. Opsional: `undefined` = belum
  // dipilih, backend (`computePlatformOverride`) sudah aman menangani ini
  // (tidak mengirim override sama sekali).
  const [boardIdByAccount, setBoardIdByAccount] = useState<
    Record<string, string | undefined>
  >({});
  const [scheduleDate, setScheduleDate] = useState<string | undefined>();
  const [scheduleTime, setScheduleTime] = useState<string | undefined>();
  // A step *within* this same Dialog (regardless of variant) — NOT a
  // second nested Dialog. Astryx's own component docs explicitly disallow
  // nesting Dialogs ("restructure the flow into steps within a single
  // dialog instead"); a previous version of this file did nest a confirm
  // Dialog inside this one, which QA found silently never opened in real
  // usage.
  //
  // `null` = form step. Confirmation Summary (UXP-04) is shared between
  // Schedule and Publish Now (KSP-05-F12, ADR-047) — only the "Waktu" row
  // and the confirm button label differ between the two variants.
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isPublishingNow, setIsPublishingNow] = useState(false);
  const [notice, setNotice] = useState<FormNotice | null>(null);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  // T-201.2 — sumber pintasan "Terakhir dipakai"; dimuat sekali bersama akun.
  const [lastUsedAccountIds, setLastUsedAccountIds] = useState<string[]>([]);

  const selectedAccounts = useMemo(
    () => accounts.filter((account) => selectedAccountIds.includes(account.id)),
    [accounts, selectedAccountIds],
  );
  /**
   * Format yang sedang aktif dipilih di antara akun target yang dicentang
   * — dipakai untuk menghitung batas media efektif (ADR-107) DAN dikirim ke
   * Server Action (`activeFormats`) supaya server bisa menegakkan batas yang
   * sama (defense-in-depth, sama pola guard lain di repo ini).
   */
  const activeFormats = selectedAccounts.map(
    (account) =>
      formatByAccount[account.id] ?? getDefaultFormat(account.platform),
  );

  const {
    mediaItems,
    setMediaItems,
    uploadingMediaCount,
    mediaError,
    effectiveMaxMedia,
    isMediaLimitReached,
    overLimitMediaCount,
    handleFilesSelected,
    deleteMediaConfirm,
  } = useDraftMedia(activeFormats);
  const { pinterestBoardsByAccount, fetchPinterestBoards, hasRequestedBoards } =
    usePinterestBoards();
  // Blok jaringan yang terbuka di akordeon (T-202.2). Hanya id; nilai
  // efektifnya diturunkan di bawah supaya selalu menunjuk akun terpilih.
  const [openAccountId, setOpenAccountId] = useState<string | undefined>();

  useEffect(() => {
    if (!isEdit) {
      return;
    }
    let cancelled = false;
    getDraftAction(postId as string)
      .then((draft) => {
        if (cancelled) return;
        setCaption(draft.caption);
        setStatus(draft.status as ContentStatus);
        setMediaItems(draft.media);
        const restored = restoreDraftTargetSelection(draft.targets);
        setSelectedAccountIds(restored.selectedAccountIds);
        setFormatByAccount(restored.formatByAccount);
        setBoardIdByAccount(restored.boardIdByAccount);
        setPinTitle(restored.pinTitle);
        setPinLink(restored.pinLink);
      })
      .catch(() => {
        if (!cancelled) close();
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDraft(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch-once-per-mount by design (component remounts via `key` per session)
  }, []);

  // Load connected accounts for the Account Selector — runs for both
  // "create" and "edit" mode (unlike the draft-loading effect above, which
  // is edit-only), since a brand-new post still needs real accounts to pick.
  useEffect(() => {
    let cancelled = false;
    // Pintasan opsional: gagal memuat tidak boleh mengganggu editor. Mode edit
    // sudah punya akun tersimpan dan tidak menampilkan pintasan, jadi tidak
    // perlu query (review Ridwan 2026-11-04). Quick Compose (akun sudah
    // terpilih lewat `preSelectedAccountId`) juga tidak menampilkan pintasan.
    // Sisa risiko: query ini belum punya indeks (workspaceId, createdAt),
    // sengaja tidak ditambah di sini (keputusan King Rezi).
    if (!isEdit && !preSelectedAccountId) {
      getLastUsedAccountIdsAction()
        .then((ids) => {
          if (!cancelled) setLastUsedAccountIds(ids);
        })
        .catch(() => undefined);
    }
    getConnectedAccountsAction()
      .then((result) => {
        if (cancelled) return;
        setAccounts(result);
        // Pre-selected account (Channels "+", T-012) is only known by id
        // before this resolves — `selectedAccountIds` already has it, but
        // it still needs a default Content Format the same way
        // `toggleAccount` would set one on manual check.
        if (preSelectedAccountId) {
          const preSelected = result.find(
            (account) => account.id === preSelectedAccountId,
          );
          if (preSelected) {
            setFormatByAccount((prev) =>
              prev[preSelected.id]
                ? prev
                : {
                    ...prev,
                    [preSelected.id]: getDefaultFormat(preSelected.platform),
                  },
            );
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotice({
            status: "error",
            title: "Gagal memuat daftar akun terhubung. Coba muat ulang.",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAccounts(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch-once-per-mount by design (component remounts via `key` per session)
  }, []);

  // Board Pinterest untuk akun yang ter-restore (KI-060). Centang manual
  // sudah memanggil fetch yang sama lewat `toggleAccount`.
  useEffect(() => {
    if (!isEdit || isLoadingAccounts) {
      return;
    }
    for (const account of accounts) {
      if (!selectedAccountIds.includes(account.id)) {
        continue;
      }
      if (account.platform !== SocialPlatform.Pinterest) {
        continue;
      }
      if (isAccountDisconnected(account)) {
        continue;
      }
      if (hasRequestedBoards(account.id)) {
        continue;
      }
      fetchPinterestBoards(account.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch/hasRequested dibuat ulang tiap render tetapi hanya membaca ref dan setter stabil; effect hanya perlu jalan saat akun/pilihan berubah (KI-060).
  }, [accounts, isEdit, isLoadingAccounts, selectedAccountIds]);

  // Report the live snapshot on every render so the parent's Dialog
  // onOpenChange (Escape/backdrop/close-button) can decide what to persist
  // without needing this state lifted up.
  onLatestChange({ mode, caption, savedPostId });

  // KI-073: caption HANYA wajib kalau TIDAK ADA target Story sama sekali —
  // Story justru MENOLAK caption di Outstand (`buildPostRequestBody`,
  // `real-outstand-adapter.ts`: `contentForBody = hasStoryTarget ? "" :
  // input.caption`). Kombinasi Story + non-Story ber-caption ditolak
  // adapter secara TERPISAH (throw `client_error`) — ditangani sebagai
  // constraint sendiri (`validateNetworks`, T-202.5), BUKAN dilipat
  // ke gate caption-required (versi sebelumnya salah: mewajibkan caption
  // untuk kombinasi campuran justru menjamin submit gagal di adapter,
  // padahal versi caption-kosong itu yang sebenarnya diterima).
  const activeFormatsForGate = activeFormats;
  const hasStoryTarget = activeFormatsForGate.some(
    (format) => format === ContentFormat.Story,
  );
  const hasNonStoryTarget = activeFormatsForGate.some(
    (format) => format !== ContentFormat.Story,
  );
  const isCaptionRequired = isCaptionRequiredForFormats(activeFormatsForGate);

  // T-108 (KI-044): tidak ada validasi yang mencegah user men-Schedule post
  // ke waktu yang sudah lewat (mis. jadwalkan jam 08:00 padahal sekarang
  // sudah jam 11:48, atau tanggal yang sudah lewat sama sekali — date input
  // di bawah tidak punya batas `min`). Dievaluasi HANYA kalau tanggal DAN
  // jam sudah dipilih keduanya (draft yang belum lengkap sudah tertahan
  // lewat `Boolean(scheduleDate) && Boolean(scheduleTime)` di bawah, jangan
  // tampilkan pesan ini sebelum itu). Dihitung ulang setiap render (sama
  // seperti `pinterestConstraintMessage`/`mediaMinimumMessage` di atas) jadi
  // otomatis re-evaluate begitu waktu berjalan lewat titik yang dipilih user.
  const scheduleTimeMessage =
    scheduleDate && scheduleTime
      ? scheduleTimeConstraintMessage(
          zonedLocalToUtc(scheduleDate, scheduleTime, timeZone),
          new Date(),
          timeZone,
        )
      : null;

  // T-202.5: pelanggaran per jaringan (tampil di blok) dan lintas jaringan
  // (tampil di atas editor) dikelompokkan oleh `validateNetworks`: sumber
  // tunggal untuk aturan board Pinterest, minimum media (KI-074, ADR-154),
  // caption campur Story (KI-073), dan Reel (T-200).
  const networkValidation = validateNetworks(
    selectedAccounts.map((account) => ({
      accountId: account.id,
      platform: account.platform,
      contentFormat:
        formatByAccount[account.id] ?? getDefaultFormat(account.platform),
      boardId: boardIdByAccount[account.id],
    })),
    caption,
    mediaItems,
  );

  const { isReadyToSchedule, isReadyToPublishNow } = getActionReadiness({
    isCaptionRequired,
    caption,
    selectedAccountCount: selectedAccounts.length,
    scheduleDate,
    scheduleTime,
    hasBlockingNetworkIssues: networkValidation.hasBlockingIssues,
    scheduleTimeMessage,
  });

  // Publish Now dari Queue (T-032.4) — lompat otomatis ke step konfirmasi
  // begitu draft (caption/status) DAN daftar akun terhubung selesai dimuat,
  // supaya `isReadyToPublishNow` di atas sudah final saat pengecekan ini
  // berjalan. Diadaptasi selama render (bukan di dalam `useEffect`) —
  // pola yang sama dengan penyesuaian `resumeData`/`dialogVariant` di
  // `DraftEditorModal` di bawah, supaya tidak memicu render effect
  // tambahan (`react-hooks/set-state-in-effect`) untuk state turunan
  // sederhana seperti ini. `hasCheckedAutoAdvance` memastikan ini hanya
  // dievaluasi sekali per sesi (component ini remount penuh per sesi lewat
  // `key={sessionKey}` di `DraftEditorModal`), jadi tidak memaksa balik ke
  // step konfirmasi kalau user sengaja kembali ke form setelah itu. Kalau
  // belum ready (caption, media, atau akun yang sudah tidak terhubung),
  // pengecekan ini sengaja TIDAK memaksa — dibiarkan fallback ke form
  // biasa, dengan notice yang menjelaskan kenapa.
  const [hasCheckedAutoAdvance, setHasCheckedAutoAdvance] = useState(false);
  if (
    !hasCheckedAutoAdvance &&
    isEdit &&
    initialPendingAction === "publish-now" &&
    !isLoadingDraft &&
    !isLoadingAccounts
  ) {
    setHasCheckedAutoAdvance(true);
    if (isReadyToPublishNow) {
      setPendingAction("publish-now");
    } else {
      setNotice({
        status: "info",
        title:
          "Publish Now belum bisa langsung dikonfirmasi — lengkapi bagian yang masih kurang, lalu lanjutkan dari form.",
      });
    }
  }

  /**
   * Efek samping bersama saat sebuah akun ditambahkan ke pilihan: format
   * default dan board Pinterest. Dipakai `toggleAccount` dan
   * `setAccountSelection`. Melepas akun sengaja tidak membersihkan state
   * format/board akun itu (perilaku lama `toggleAccount`).
   */
  function applyAccountAddedEffects(account: ConnectedAccount) {
    setFormatByAccount((prev) =>
      prev[account.id]
        ? prev
        : { ...prev, [account.id]: getDefaultFormat(account.platform) },
    );
    if (
      account.platform === SocialPlatform.Pinterest &&
      !isAccountDisconnected(account)
    ) {
      fetchPinterestBoards(account.id);
    }
  }

  function toggleAccount(account: ConnectedAccount, checked: boolean) {
    setSelectedAccountIds((prev) =>
      checked ? [...prev, account.id] : prev.filter((id) => id !== account.id),
    );
    if (checked) {
      // Blok jaringan akun yang baru dicentang terbuka (T-202.2).
      setOpenAccountId(account.id);
      applyAccountAddedEffects(account);
    }
  }

  /**
   * Ganti seluruh pilihan akun sekaligus (popover "Pilih semua", pintasan
   * "Terakhir dipakai" dan "Semua", T-201). Akun yang baru masuk mendapat
   * efek samping yang sama dengan `toggleAccount` (format default, board
   * Pinterest); semuanya di klien kecuali pengambilan board Pinterest yang
   * memang sudah ada sebelumnya.
   */
  function setAccountSelection(nextAccountIds: string[]) {
    const { added } = diffSelection(selectedAccountIds, nextAccountIds);
    setSelectedAccountIds(nextAccountIds);
    if (added[0]) {
      setOpenAccountId(added[0]);
    }
    for (const accountId of added) {
      const account = accounts.find((item) => item.id === accountId);
      if (account) {
        applyAccountAddedEffects(account);
      }
    }
  }

  function changeFormat(accountId: string, format: ContentFormat) {
    setFormatByAccount((prev) => ({ ...prev, [accountId]: format }));
  }

  function changeBoard(accountId: string, boardId: string | undefined) {
    setBoardIdByAccount((prev) => ({ ...prev, [accountId]: boardId }));
  }

  /**
   * Aksi terminal (ADR-054, NP-D13): tutup editor lalu antar pengguna ke
   * sub-screen tujuan konten — bukan kembali ke section asal seperti tombol
   * Close. Sejak CTA sidebar aktif (ADR-053) asalnya bisa Home/Engage/Analyze,
   * yang tidak menampilkan hasil aksi sama sekali.
   */
  function finishTerminalAction(action: TerminalAction) {
    const destination = resolveTerminalDestination(action);
    close();
    if (isAlreadyAtDestination(pathname, destination)) {
      router.refresh();
    } else {
      // T-208: event Realtime layar asal tidak boleh memanggil server action
      // selagi navigasi ini berjalan.
      markTerminalNavigationPending();
      router.push(destination);
    }
  }

  const mediaIds = mediaItems.map((item) => item.id);

  async function handleSaveDraft() {
    const decision = decideDraftSaveTargets({
      accountsLoaded: !isLoadingAccounts,
      selectedAccountIds,
      builtTargets: buildTargetsPayload().map((target) => ({
        connectedAccountId: target.connectedAccountId,
        contentFormat: target.contentFormat,
        platformOptions: target.platformOptions,
      })),
    });
    if (decision.action === "wait") {
      return;
    }
    const targets =
      decision.action === "replace" ? decision.targets : undefined;

    setIsSavingDraft(true);
    try {
      let nextPostId = savedPostId;
      if (savedPostId) {
        const result = await updateDraftAction(savedPostId, {
          caption,
          mediaIds,
          activeFormats,
          ...(targets !== undefined ? { targets } : {}),
        });
        if ("error" in result) {
          setNotice({ status: "error", title: result.error });
          return;
        }
      } else {
        const result = await saveDraftAction({
          caption,
          mediaIds,
          activeFormats,
          ...(targets !== undefined ? { targets } : {}),
        });
        if ("error" in result) {
          setNotice({ status: "error", title: result.error });
          return;
        }
        nextPostId = result.postId;
        setSavedPostId(result.postId);
      }
      // Snapshot ikut diperbarui sekarang (lihat KI-043 di Schedule /
      // Publish Now) supaya tutup dialog tidak menyimpan ulang caption.
      onLatestChange({ mode, caption, savedPostId: nextPostId });
      if (mode === "create") {
        clearUnsavedNewPost();
      }
      setStatus(ContentStatus.Draft);
      // Save as Draft → Publish > Drafts (ADR-054, T-031.1). Draft yang muncul
      // di daftar itulah umpan baliknya, menggantikan banner sukses yang tidak
      // akan sempat terbaca karena editor ditutup.
      finishTerminalAction("save-draft");
    } catch (error) {
      setNotice({
        status: "error",
        title:
          error instanceof Error
            ? error.message
            : "Gagal menyimpan draft. Coba lagi.",
      });
    } finally {
      setIsSavingDraft(false);
    }
  }

  /**
   * Dipakai bersama oleh Schedule dan Publish Now — dulu masing-masing
   * handler menulis ulang `selectedAccounts.map(...)` sendiri-sendiri
   * (termasuk cabang `platformOptions` khusus Pinterest), berisiko
   * divergen diam-diam kalau salah satu diubah tapi yang lain terlewat.
   */
  function buildTargetsPayload() {
    return selectedAccounts.map((account) => ({
      connectedAccountId: account.id,
      contentFormat:
        formatByAccount[account.id] ?? getDefaultFormat(account.platform),
      platformOptions:
        account.platform === SocialPlatform.Pinterest
          ? { pinTitle, pinLink, boardId: boardIdByAccount[account.id] }
          : undefined,
    }));
  }

  async function handleConfirmSchedule() {
    setIsScheduling(true);
    try {
      // T-147 (ADR-146, menggantikan WIB tetap T-146): input jadwal
      // ditafsirkan di zona waktu pengguna, bukan zona browser.
      const scheduledAt = zonedLocalToUtc(
        scheduleDate ?? "",
        scheduleTime ?? "",
        timeZone,
      ).toISOString();

      const result = await scheduleDraftAction({
        postId: savedPostId,
        caption,
        scheduledAt,
        timeZone,
        targets: buildTargetsPayload(),
        mediaIds,
      });

      if ("error" in result) {
        setNotice({ status: "error", title: result.error });
        return;
      }

      setSavedPostId(result.postId);
      setStatus(ContentStatus.Scheduled);
      setPendingAction(null);
      // KI-043: sama seperti Save Draft — hapus caption sementara di
      // localStorage supaya Resume Dialog tidak menampilkan caption basi.
      // Snapshot ikut diperbarui sekarang karena `setSavedPostId` baru
      // terbaca parent di render berikutnya; tanpa ini, tutup dialog bisa
      // menyimpan ulang caption yang baru saja dihapus.
      onLatestChange({ mode, caption, savedPostId: result.postId });
      if (mode === "create") {
        clearUnsavedNewPost();
      }
      // Schedule → Publish > Queue (ADR-054). Queue sendiri masih placeholder
      // sampai T-032; tujuannya tetap dipakai karena ADR-054 sudah menetapkan
      // destinasi ini, dan mendarat di Queue lebih masuk akal daripada
      // tertinggal di Analyze/Home tanpa jejak aksi.
      finishTerminalAction("schedule");
    } catch (error) {
      setNotice({
        status: "error",
        title:
          error instanceof Error
            ? error.message
            : "Gagal menjadwalkan post. Coba lagi.",
      });
    } finally {
      setIsScheduling(false);
    }
  }

  async function handleConfirmPublishNow() {
    setIsPublishingNow(true);
    try {
      const result = await publishNowAction({
        postId: savedPostId,
        caption,
        targets: buildTargetsPayload(),
        mediaIds,
      });

      if ("error" in result) {
        setNotice({ status: "error", title: result.error });
        return;
      }

      setSavedPostId(result.postId);
      setStatus(ContentStatus.Published);
      setPendingAction(null);
      // KI-043: sama seperti Save Draft — hapus caption sementara di
      // localStorage supaya Resume Dialog tidak menampilkan caption basi.
      // Snapshot ikut diperbarui sekarang karena `setSavedPostId` baru
      // terbaca parent di render berikutnya; tanpa ini, tutup dialog bisa
      // menyimpan ulang caption yang baru saja dihapus.
      onLatestChange({ mode, caption, savedPostId: result.postId });
      if (mode === "create") {
        clearUnsavedNewPost();
      }
      // Publish Now → Publish > Calendar (T-029, ADR-054) — History belum
      // jadi layar terdokumentasi, Calendar dipakai sementara sampai T-034.
      finishTerminalAction("publish-now");
    } catch (error) {
      setNotice({
        status: "error",
        title:
          error instanceof Error
            ? error.message
            : "Gagal mempublikasikan post. Coba lagi.",
      });
    } finally {
      setIsPublishingNow(false);
    }
  }
  // Blok yang terbuka di akordeon (T-202.2): pilihan terakhir bila masih
  // terpilih, selain itu blok paling atas. Diturunkan dari urutan PILIHAN
  // (urutan blok dirender), bukan urutan daftar workspace.
  const activeAccountId = resolveActiveAccountId(
    selectedAccountIds.filter((id) =>
      selectedAccounts.some((account) => account.id === id),
    ),
    openAccountId,
  );
  const showStoryCaptionWarning =
    hasStoryTarget && !hasNonStoryTarget && caption.trim().length > 0;

  return {
    isEdit,
    caption,
    setCaption,
    status,
    isLoadingDraft,
    accounts,
    isLoadingAccounts,
    lastUsedAccountIds,
    selectedAccounts,
    selectedAccountIds,
    formatByAccount,
    changeFormat,
    toggleAccount,
    setAccountSelection,
    pinTitle,
    setPinTitle,
    pinLink,
    setPinLink,
    boardIdByAccount,
    changeBoard,
    pinterestBoardsByAccount,
    fetchPinterestBoards,
    mediaItems,
    uploadingMediaCount,
    mediaError,
    effectiveMaxMedia,
    isMediaLimitReached,
    overLimitMediaCount,
    handleFilesSelected,
    deleteMediaConfirm,
    scheduleDate,
    setScheduleDate,
    scheduleTime,
    setScheduleTime,
    pendingAction,
    setPendingAction,
    notice,
    isSavingDraft,
    isScheduling,
    isPublishingNow,
    networkValidation,
    activeAccountId,
    setActiveAccountId: setOpenAccountId,
    scheduleTimeMessage,
    showStoryCaptionWarning,
    isReadyToSchedule,
    isReadyToPublishNow,
    handleSaveDraft,
    handleConfirmSchedule,
    handleConfirmPublishNow,
  };
}
