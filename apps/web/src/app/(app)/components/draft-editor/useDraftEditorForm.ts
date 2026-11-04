"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { toast } from "sonner";

import { ContentFormat, ContentStatus, SocialPlatform } from "@postific/shared";
import { pinterestBoardConstraintMessage } from "@/domains/publishing/pinterest-board-constraints";
import { scheduleTimeConstraintMessage } from "@/domains/publishing/schedule-time-constraints";
import { zonedLocalToUtc } from "@/domains/publishing/wib-time";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";

import { useConfirmAction } from "@/lib/hooks/use-confirm-action";
import { markTerminalNavigationPending } from "@/lib/navigation/pending-terminal-navigation";
import {
  isCaptionRequiredForFormats,
  maxMediaCountForFormats,
  minMediaCountConstraintMessage,
  mixedStoryCaptionConstraintMessage,
} from "@/domains/publishing";

import type { DraftMediaDto } from "./actions";
import {
  deleteMediaAction,
  getConnectedAccountsAction,
  getLastUsedAccountIdsAction,
  getDraftAction,
  listPinterestBoardsAction,
  publishNowAction,
  saveDraftAction,
  scheduleDraftAction,
  updateDraftAction,
  uploadMediaAction,
} from "./actions";
import { useDraftEditor } from "./Context";
import type {
  ConnectedAccount,
  FormNotice,
  LatestFormSnapshot,
  PendingAction,
  PinterestBoardState,
} from "./form-shared";
import { getDefaultFormat, isAccountDisconnected } from "./form-shared";
import { diffSelection } from "./account-selection";
import type { TerminalAction } from "./terminal-destination";
import {
  isAlreadyAtDestination,
  resolveTerminalDestination,
} from "./terminal-destination";
import { decideDraftSaveTargets } from "./draft-save-targets";
import { restoreDraftTargetSelection } from "./restore-draft-targets";

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
  // Media (T-024.4) — setiap file diupload segera saat dipilih/didrop
  // (`uploadMediaAction`, bukan disimpan sebagai `File` mentah di state),
  // supaya preview + validasi mime/ukuran terjadi langsung, bukan ditunda
  // sampai Save/Schedule. `mediaItems` adalah SATU set untuk seluruh post
  // (bukan per-akun/per-target, ADR-107) — "hapus" di grid preview (T-024.5)
  // menghapus PERMANEN (file Storage + record `MediaItem` DB, lewat dialog
  // konfirmasi Tier 2/ADR-049), bukan sekadar unlink dari state lokal.
  const [mediaItems, setMediaItems] = useState<DraftMediaDto[]>([]);
  const [uploadingMediaCount, setUploadingMediaCount] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);
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
  // Daftar board ASLI per akun Pinterest (bukan mock) — di-fetch saat akun
  // Pinterest dicentang di form akun tujuan (lihat `toggleAccount`), keyed by
  // `connectedAccountId` supaya beberapa akun Pinterest yang dicentang
  // bersamaan tidak saling menimpa status loading/error satu sama lain.
  const [pinterestBoardsByAccount, setPinterestBoardsByAccount] = useState<
    Record<string, PinterestBoardState>
  >({});
  // Respons fetch yang lebih lama tidak boleh menimpa hasil request yang
  // lebih baru (retry sukses, lalu error request sebelumnya datang belakangan).
  const pinterestBoardRequestSeq = useRef<Record<string, number>>({});
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
    // Pintasan opsional: gagal memuat tidak boleh mengganggu editor.
    getLastUsedAccountIdsAction()
      .then((ids) => {
        if (!cancelled) setLastUsedAccountIds(ids);
      })
      .catch(() => undefined);
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
      if (pinterestBoardRequestSeq.current[account.id]) {
        continue;
      }
      fetchPinterestBoards(account.id);
    }
  }, [accounts, isEdit, isLoadingAccounts, selectedAccountIds]);

  // Report the live snapshot on every render so the parent's Dialog
  // onOpenChange (Escape/backdrop/close-button) can decide what to persist
  // without needing this state lifted up.
  onLatestChange({ mode, caption, savedPostId });

  const selectedAccounts = useMemo(
    () => accounts.filter((account) => selectedAccountIds.includes(account.id)),
    [accounts, selectedAccountIds],
  );

  const pinterestConstraintMessage = pinterestBoardConstraintMessage(
    selectedAccounts.map((account) => ({
      platform: account.platform,
      platformOptions:
        account.platform === SocialPlatform.Pinterest
          ? { boardId: boardIdByAccount[account.id] }
          : undefined,
    })),
  );

  // KI-073: caption HANYA wajib kalau TIDAK ADA target Story sama sekali —
  // Story justru MENOLAK caption di Outstand (`buildPostRequestBody`,
  // `real-outstand-adapter.ts`: `contentForBody = hasStoryTarget ? "" :
  // input.caption`). Kombinasi Story + non-Story ber-caption ditolak
  // adapter secara TERPISAH (throw `client_error`) — ditangani di bawah
  // sebagai constraint sendiri (`mixedStoryCaptionMessage`), BUKAN dilipat
  // ke gate caption-required (versi sebelumnya salah: mewajibkan caption
  // untuk kombinasi campuran justru menjamin submit gagal di adapter,
  // padahal versi caption-kosong itu yang sebenarnya diterima).
  const activeFormatsForGate = getActiveFormats();
  const hasStoryTarget = activeFormatsForGate.some(
    (format) => format === ContentFormat.Story,
  );
  const hasNonStoryTarget = activeFormatsForGate.some(
    (format) => format !== ContentFormat.Story,
  );
  const isCaptionRequired = isCaptionRequiredForFormats(activeFormatsForGate);
  const mixedStoryCaptionMessage = mixedStoryCaptionConstraintMessage(
    caption,
    activeFormatsForGate,
  );

  // KI-074: Story/Reel/Pin secara native selalu berbasis media — tanpa
  // guard ini, target Story/Reel/Pin bisa "berhasil" terpublish tapi
  // tayang kosong (caption-nya sendiri juga sudah dikosongkan untuk
  // Story, KI-073 di atas). Mirror server: `assertMediaCountMeetsMinimum`
  // (`content-format-matrix.ts`).
  // ADR-154: minimum media ditentukan per platform + format (Instagram Post
  // wajib media, Facebook Post tidak), jadi target dikirim lengkap.
  const mediaMinimumMessage = minMediaCountConstraintMessage(
    mediaItems.length,
    selectedAccounts.map((account) => ({
      platform: account.platform,
      contentFormat:
        formatByAccount[account.id] ?? getDefaultFormat(account.platform),
    })),
  );

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

  const isReadyToSchedule =
    (!isCaptionRequired || caption.trim().length > 0) &&
    selectedAccounts.length > 0 &&
    Boolean(scheduleDate) &&
    Boolean(scheduleTime) &&
    pinterestConstraintMessage === null &&
    mediaMinimumMessage === null &&
    mixedStoryCaptionMessage === null &&
    scheduleTimeMessage === null;

  // Publish Now (KSP-05-F12) skips the Schedule Picker entirely — tanggal/
  // waktu tidak relevan sama sekali, beda dari `isReadyToSchedule`.
  const isReadyToPublishNow =
    (!isCaptionRequired || caption.trim().length > 0) &&
    selectedAccounts.length > 0 &&
    pinterestConstraintMessage === null &&
    mediaMinimumMessage === null &&
    mixedStoryCaptionMessage === null;

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

  function toggleAccount(account: ConnectedAccount, checked: boolean) {
    setSelectedAccountIds((prev) =>
      checked ? [...prev, account.id] : prev.filter((id) => id !== account.id),
    );
    setFormatByAccount((prev) => {
      if (checked && !prev[account.id]) {
        return { ...prev, [account.id]: getDefaultFormat(account.platform) };
      }
      return prev;
    });
    if (
      checked &&
      account.platform === SocialPlatform.Pinterest &&
      !isAccountDisconnected(account)
    ) {
      fetchPinterestBoards(account.id);
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
    for (const accountId of added) {
      const account = accounts.find((item) => item.id === accountId);
      if (!account) {
        continue;
      }
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
  }

  /** Fetch daftar board Pinterest asli (KI-072) — dipanggil saat akun
   * Pinterest dicentang di `toggleAccount`, dan sebagai retry manual dari
   * tombol "Coba lagi" pada state error. */
  function fetchPinterestBoards(connectedAccountId: string) {
    const requestSeq =
      (pinterestBoardRequestSeq.current[connectedAccountId] ?? 0) + 1;
    pinterestBoardRequestSeq.current[connectedAccountId] = requestSeq;
    setPinterestBoardsByAccount((prev) => ({
      ...prev,
      [connectedAccountId]: { status: "loading" },
    }));
    listPinterestBoardsAction(connectedAccountId)
      .then((boards) => {
        if (
          pinterestBoardRequestSeq.current[connectedAccountId] !== requestSeq
        ) {
          return;
        }
        setPinterestBoardsByAccount((prev) => ({
          ...prev,
          [connectedAccountId]: { status: "success", boards },
        }));
      })
      .catch((error) => {
        if (
          pinterestBoardRequestSeq.current[connectedAccountId] !== requestSeq
        ) {
          return;
        }
        setPinterestBoardsByAccount((prev) => ({
          ...prev,
          [connectedAccountId]: {
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Gagal memuat daftar board.",
          },
        }));
      });
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

  /**
   * Format yang sedang aktif dipilih di antara akun target yang dicentang
   * — dipakai untuk menghitung batas media efektif (ADR-107,
   * `maxMediaCountFor`) DAN dikirim ke Server Action (`activeFormats`)
   * supaya server bisa menegakkan batas yang sama (defense-in-depth, sama
   * pola guard lain di repo ini).
   */
  function getActiveFormats(): ContentFormat[] {
    return selectedAccounts.map(
      (account) =>
        formatByAccount[account.id] ?? getDefaultFormat(account.platform),
    );
  }

  const mediaIds = mediaItems.map((item) => item.id);
  const effectiveMaxMedia = maxMediaCountForFormats(getActiveFormats());
  const isMediaLimitReached =
    mediaItems.length + uploadingMediaCount >= effectiveMaxMedia;
  /**
   * KI-061 (ADR-107): kalau user upload media dulu lalu menambah akun
   * target dengan format lebih ketat, `effectiveMaxMedia` bisa turun di
   * bawah `mediaItems.length` yang sudah ada — tanpa indikator ini user
   * baru tahu ada masalah setelah klik Save/Schedule/Publish dan kena
   * error server (`assertMediaCountWithinLimit`). Server menolak berdasarkan
   * TOTAL count, bukan per-item (lihat `content-format-matrix.ts`).
   * Urutan grid = urutan `mediaIds` yang tersimpan (upload di-append,
   * dan `getDraftAction` mengembalikan urutan itu lagi meski
   * `listByIds` datang sebagai `createdAt desc`). Item index >=
   * `effectiveMaxMedia` adalah ekor array — media paling baru — yang
   * perlu dihapus dulu sampai total kembali di bawah batas.
   */
  const overLimitMediaCount = Math.max(
    0,
    mediaItems.length - effectiveMaxMedia,
  );

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const files = Array.from(fileList);
    const max = maxMediaCountForFormats(getActiveFormats());
    const availableSlots = Math.max(
      0,
      max - mediaItems.length - uploadingMediaCount,
    );

    if (availableSlots === 0) {
      setMediaError(
        `Batas maksimum ${max} media untuk format yang sedang dipilih sudah tercapai.`,
      );
      return;
    }

    const toUpload = files.slice(0, availableSlots);
    if (files.length > toUpload.length) {
      setMediaError(
        `Hanya ${toUpload.length} dari ${files.length} file diunggah — batas maksimum media untuk format ini adalah ${max}.`,
      );
    } else {
      setMediaError(null);
    }

    setUploadingMediaCount((count) => count + toUpload.length);
    await Promise.all(
      toUpload.map(async (file) => {
        try {
          const formData = new FormData();
          formData.append("file", file);
          const result = await uploadMediaAction(formData);
          if ("error" in result) {
            setMediaError(result.error);
          } else {
            setMediaItems((prev) => [...prev, result.media]);
          }
        } catch {
          setMediaError("Gagal mengunggah salah satu file. Coba lagi.");
        } finally {
          setUploadingMediaCount((count) => count - 1);
        }
      }),
    );
  }

  // T-024.5 (ADR-049 Tier 2): hapus media dari grid preview sekarang berarti
  // hapus PERMANEN (file Storage + record `MediaItem` DB), bukan lagi
  // unlink diam-diam — pola sama `deleteConfirm` di `DraftsList.tsx`
  // (`useConfirmAction` + `ConfirmActionDialog`). Karena `ConfirmActionDialog`
  // adalah `AlertDialog` modal (memblokir interaksi lain di belakangnya
  // selagi terbuka), tombol hapus item lain di grid otomatis tidak bisa
  // diklik selama satu proses berjalan — tidak perlu state disable
  // tambahan per-tile, konsisten pola `DraftsList`.
  const deleteMediaConfirm = useConfirmAction<DraftMediaDto>(
    (item) => deleteMediaAction(item.id),
    (item) => {
      setMediaItems((prev) => prev.filter((m) => m.id !== item.id));
      toast("Media berhasil dihapus");
    },
  );

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
      const activeFormats = getActiveFormats();
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
    pinterestConstraintMessage,
    mediaMinimumMessage,
    mixedStoryCaptionMessage,
    scheduleTimeMessage,
    showStoryCaptionWarning,
    isReadyToSchedule,
    isReadyToPublishNow,
    handleSaveDraft,
    handleConfirmSchedule,
    handleConfirmPublishNow,
  };
}
