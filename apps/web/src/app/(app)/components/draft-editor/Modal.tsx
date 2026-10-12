"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import NextLink from "next/link";

import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import type { PinterestBoard } from "@postific/shared";
import { ContentFormat, ContentStatus, SocialPlatform } from "@postific/shared";
import { pinterestBoardConstraintMessage } from "@/domains/publishing/pinterest-board-constraints";
import { scheduleTimeConstraintMessage } from "@/domains/publishing/schedule-time-constraints";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/format-relative-time";
import { useConfirmAction } from "@/lib/hooks/use-confirm-action";
import { MediaThumbnail } from "../media-thumbnail";
import {
  maxMediaCountForFormats,
  minMediaCountConstraintMessage,
} from "@/domains/publishing";

import type { ConnectedAccountDto, DraftMediaDto } from "./actions";
import {
  deleteMediaAction,
  getConnectedAccountsAction,
  getDraftAction,
  listPinterestBoardsAction,
  publishNowAction,
  saveDraftAction,
  scheduleDraftAction,
  updateDraftAction,
  uploadMediaAction,
} from "./actions";
import type { UnsavedNewPost } from "./Context";
import { useDraftEditor } from "./Context";
import {
  CONTENT_STATUS_BADGE_VARIANT,
  CONTENT_STATUS_LABEL,
} from "./status-badge";
import type { TerminalAction } from "./terminal-destination";
import {
  isAlreadyAtDestination,
  resolveTerminalDestination,
} from "./terminal-destination";

/** Akun terhubung dari `WorkspaceConnectedAccount` (ADR-059) — bukan lagi mock. */
type ConnectedAccount = ConnectedAccountDto;

function isAccountDisconnected(account: ConnectedAccount): boolean {
  return account.status !== "active";
}

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  [SocialPlatform.Instagram]: "Instagram",
  [SocialPlatform.Facebook]: "Facebook",
  [SocialPlatform.Twitter]: "X (Twitter)",
  [SocialPlatform.LinkedIn]: "LinkedIn",
  [SocialPlatform.TikTok]: "TikTok",
  [SocialPlatform.YouTube]: "YouTube",
  [SocialPlatform.Threads]: "Threads",
  [SocialPlatform.Pinterest]: "Pinterest",
};

const FORMAT_LABEL: Record<ContentFormat, string> = {
  [ContentFormat.Post]: "Post",
  [ContentFormat.Reel]: "Reel",
  [ContentFormat.Story]: "Story",
  [ContentFormat.Pin]: "Pin",
};

/** Matriks Content Format per platform — ADR-039. */
function getSelectableFormats(
  platform: SocialPlatform,
): ContentFormat[] | null {
  if (
    platform === SocialPlatform.Instagram ||
    platform === SocialPlatform.Facebook
  ) {
    return [ContentFormat.Post, ContentFormat.Reel, ContentFormat.Story];
  }
  return null;
}

function getDefaultFormat(platform: SocialPlatform): ContentFormat {
  return platform === SocialPlatform.Pinterest
    ? ContentFormat.Pin
    : ContentFormat.Post;
}

/**
 * Padanan Astryx CheckboxInput/RadioListItem (T-100.2) — shadcn tidak punya
 * primitive gabungan control+label, jadi dipusatkan di sini sekali daripada
 * diulang per pemakaian (Checkbox akun & RadioGroupItem Content Format).
 */
function LabeledControl({
  htmlFor,
  control,
  children,
}: {
  htmlFor: string;
  control: ReactNode;
  children: ReactNode;
}) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- T-100.2: padanan Astryx CheckboxInput/RadioListItem, murni komposisi Tailwind Checkbox|RadioGroupItem + Label shadcn, tidak punya primitive gabungan.
    <div className="flex items-center gap-2">
      {control}
      <Label htmlFor={htmlFor}>{children}</Label>
    </div>
  );
}

function ResumeDialog({
  isOpen,
  unsaved,
  onDiscard,
  onResume,
}: {
  isOpen: boolean;
  unsaved: UnsavedNewPost | null;
  onDiscard: () => void;
  onResume: () => void;
}) {
  const preview = unsaved
    ? unsaved.caption.length > 60
      ? `${unsaved.caption.slice(0, 60)}…`
      : unsaved.caption
    : "";

  return (
    <Dialog open={isOpen} onOpenChange={() => undefined}>
      <DialogContent
        role="alertdialog"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Resume unfinished post?</DialogTitle>
          <DialogDescription>
            Ada draft New Post yang belum disimpan dari sesi sebelumnya
            (KSP-05-F13, ADR-052). Hanya berlaku untuk New Post — Edit Draft
            tidak punya dialog ini.
          </DialogDescription>
        </DialogHeader>
        {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack/HStack, murni komposisi Tailwind flex, tidak ada primitive shadcn setara. */}
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex. */}
          <div className="flex flex-col gap-1">
            <Text variant="muted">Caption</Text>
            <Text>{preview || "(kosong)"}</Text>
          </div>
          {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex. */}
          <div className="flex flex-col gap-1">
            <Text variant="muted">Terakhir diedit</Text>
            <Text>
              {unsaved ? formatRelativeTime(new Date(unsaved.savedAt)) : "-"}
            </Text>
          </div>
          {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx HStack, murni Tailwind flex. */}
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={onDiscard}>
              Mulai Baru
            </Button>
            <Button onClick={onResume}>Resume</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface LatestFormSnapshot {
  mode: "create" | "edit";
  caption: string;
  savedPostId: string | undefined;
}

/**
 * Owns all editor form state for one New Post / Edit Draft session. Mounted
 * fresh (via `key` on the caller) whenever a new session starts, so state
 * resets naturally on mount instead of being imperatively reset in an effect.
 */
function DraftEditorForm({
  mode,
  postId,
  prefillCaption,
  preSelectedAccountId,
  initialPendingAction,
  onOpenChange,
  onLatestChange,
  dialogVariant,
  onToggleDialogVariant,
}: {
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
  onOpenChange: (open: boolean) => void;
  onLatestChange: (snapshot: LatestFormSnapshot) => void;
  dialogVariant: "standard" | "fullscreen";
  onToggleDialogVariant: () => void;
}) {
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
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);
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
    Record<
      string,
      | { status: "loading" }
      | { status: "success"; boards: PinterestBoard[] }
      | { status: "error"; message: string }
    >
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
  const [pendingAction, setPendingAction] = useState<
    "schedule" | "publish-now" | null
  >(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isPublishingNow, setIsPublishingNow] = useState(false);
  const [notice, setNotice] = useState<{
    status: "success" | "info" | "error";
    title: string;
  } | null>(null);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

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
  const isCaptionRequired = !hasStoryTarget;
  const mixedStoryCaptionMessage =
    hasStoryTarget && hasNonStoryTarget && caption.trim().length > 0
      ? "Story tidak bisa digabung dengan target lain selama caption terisi — kosongkan caption atau publish Story secara terpisah dari target lainnya."
      : null;

  // KI-074: Story/Reel/Pin secara native selalu berbasis media — tanpa
  // guard ini, target Story/Reel/Pin bisa "berhasil" terpublish tapi
  // tayang kosong (caption-nya sendiri juga sudah dikosongkan untuk
  // Story, KI-073 di atas). Mirror server: `assertMediaCountMeetsMinimum`
  // (`content-format-matrix.ts`).
  const mediaMinimumMessage = minMediaCountConstraintMessage(
    mediaItems.length,
    activeFormatsForGate,
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
          new Date(`${scheduleDate}T${scheduleTime}`),
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
  // belum ready (mis. akun target belum valid — Edit Draft saat ini tidak
  // preload akun yang sebelumnya dijadwalkan, KI-032), pengecekan ini
  // sengaja TIDAK memaksa — dibiarkan fallback ke form biasa. Supaya
  // fallback ini tidak terasa seperti klik "Publish Now" tidak berefek sama
  // sekali, tampilkan notice info yang menjelaskan kenapa (bukan gagal diam
  // tanpa sinyal apapun) sambil user memilih ulang akun secara manual.
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
          "Publish Now belum bisa langsung dikonfirmasi — pilih ulang akun tujuan untuk melanjutkan (akun yang sebelumnya dijadwalkan belum otomatis dimuat).",
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
    setIsSavingDraft(true);
    try {
      const activeFormats = getActiveFormats();
      if (savedPostId) {
        await updateDraftAction(savedPostId, {
          caption,
          mediaIds,
          activeFormats,
        });
      } else {
        const result = await saveDraftAction({
          caption,
          mediaIds,
          activeFormats,
        });
        setSavedPostId(result.postId);
      }
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
      const scheduledAt = new Date(
        `${scheduleDate}T${scheduleTime}`,
      ).toISOString();

      const result = await scheduleDraftAction({
        postId: savedPostId,
        caption,
        scheduledAt,
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

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-100.1: struktur Layout Astryx sudah diganti shadcn Dialog (ADR-097); wrapper flex-column header/body/footer ini tidak punya padanan primitive shadcn, murni komposisi Tailwind.
    <div className="flex h-full min-h-0 flex-col">
      <DialogHeader className="flex-row items-start justify-between gap-3 border-b border-border px-6 py-4">
        <DialogTitle className="text-lg">
          {pendingAction === "schedule"
            ? "Konfirmasi Jadwal"
            : pendingAction === "publish-now"
              ? "Konfirmasi Publish"
              : isEdit
                ? "Edit Draft"
                : "New Post"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {pendingAction === "schedule"
            ? "Tinjau jadwal sebelum konfirmasi."
            : pendingAction === "publish-now"
              ? "Tinjau detail sebelum konfirmasi publish."
              : isEdit
                ? "Edit caption, akun, dan jadwal draft ini."
                : "Tulis caption, pilih akun, dan atur jadwal post baru."}
        </DialogDescription>
        {/* eslint-disable-next-line no-restricted-syntax -- T-100.1: baris aksi header (status chip + toggle Fullscreen/Standard ADR-065 + tombol close) tidak punya padanan primitive shadcn, murni Tailwind. */}
        <div className="flex items-center gap-2">
          {pendingAction ? null : (
            <>
              <Badge variant={CONTENT_STATUS_BADGE_VARIANT[status]}>
                <span
                  aria-hidden="true"
                  className="inline-block size-1.5 rounded-full bg-current"
                />
                {CONTENT_STATUS_LABEL[status]}
              </Badge>
              <Button variant="ghost" size="sm" onClick={onToggleDialogVariant}>
                {dialogVariant === "fullscreen" ? "Standard" : "Fullscreen"}
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </DialogHeader>
      {/* eslint-disable-next-line no-restricted-syntax -- T-100.1: area body scrollable Dialog (dulu Astryx LayoutContent) tidak punya padanan primitive shadcn, murni Tailwind. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {pendingAction ? (
          // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex.
          <div className="flex flex-col gap-3">
            {notice?.status === "error" ? (
              <Alert variant="destructive">
                <AlertTitle>{notice.title}</AlertTitle>
              </Alert>
            ) : null}
            <Text>Caption: {caption || "(kosong)"}</Text>
            {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex. */}
            <div className="flex flex-col gap-1">
              <Text variant="muted">Akun:</Text>
              {selectedAccounts.map((account) => (
                <Text key={account.id}>
                  · {PLATFORM_LABEL[account.platform]} {account.handle} —{" "}
                  {
                    FORMAT_LABEL[
                      formatByAccount[account.id] ??
                        getDefaultFormat(account.platform)
                    ]
                  }
                </Text>
              ))}
            </div>
            {pendingAction === "publish-now" ? (
              <Text>Waktu: Sekarang</Text>
            ) : (
              <Text>
                Waktu: {scheduleDate ?? "-"} {scheduleTime ?? ""}
              </Text>
            )}
          </div>
        ) : (
          // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex.
          <div className="flex flex-col gap-4">
            {pinterestConstraintMessage ? (
              <Alert variant="destructive">
                <AlertTitle>{pinterestConstraintMessage}</AlertTitle>
              </Alert>
            ) : null}
            {mediaMinimumMessage ? (
              <Alert variant="destructive">
                <AlertTitle>{mediaMinimumMessage}</AlertTitle>
              </Alert>
            ) : null}
            {mixedStoryCaptionMessage ? (
              <Alert variant="destructive">
                <AlertTitle>{mixedStoryCaptionMessage}</AlertTitle>
              </Alert>
            ) : null}
            {scheduleTimeMessage ? (
              <Alert variant="destructive">
                <AlertTitle>{scheduleTimeMessage}</AlertTitle>
              </Alert>
            ) : null}
            {notice ? (
              <Alert
                variant={notice.status === "error" ? "destructive" : "default"}
              >
                <AlertTitle>{notice.title}</AlertTitle>
              </Alert>
            ) : null}

            {isLoadingDraft ? (
              <Text variant="muted">Memuat draft…</Text>
            ) : (
              // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx HStack, murni Tailwind flex.
              <div className="flex flex-wrap items-start gap-6">
                {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex. */}
                <div className="flex w-full max-w-125 flex-col gap-5">
                  {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex. */}
                  <div className="flex flex-col gap-3">
                    <Text variant="h4" as="h3">
                      Caption
                    </Text>
                    <Label htmlFor="draft-caption" className="sr-only">
                      Caption
                    </Label>
                    <Textarea
                      id="draft-caption"
                      value={caption}
                      onChange={(event) => setCaption(event.target.value)}
                      placeholder="Tulis caption di sini..."
                    />
                    <FieldDescription>
                      AI Caption Assist belum termasuk revisi ini.
                    </FieldDescription>
                    {hasStoryTarget &&
                    !hasNonStoryTarget &&
                    caption.trim().length > 0 ? (
                      <FieldDescription>
                        Story menolak caption — teks di atas TIDAK akan ikut
                        terpublish ke Instagram/Facebook.
                      </FieldDescription>
                    ) : null}
                  </div>

                  {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex. */}
                  <div className="flex flex-col gap-3">
                    <Text variant="h4" as="h3">
                      Media
                    </Text>
                    <Label htmlFor="draft-media" className="sr-only">
                      Media
                    </Label>
                    <input
                      ref={mediaFileInputRef}
                      id="draft-media"
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
                      className="hidden"
                      disabled={isMediaLimitReached}
                      onChange={(event) => {
                        void handleFilesSelected(event.target.files);
                        event.target.value = "";
                      }}
                    />
                    {/* eslint-disable-next-line no-restricted-syntax -- T-024.4: custom drag-drop zone (dikonfirmasi King Rezi via AskUserQuestion, bukan native file input polos) — tidak ada primitive shadcn setara, murni Tailwind. */}
                    <div
                      role="button"
                      tabIndex={isMediaLimitReached ? -1 : 0}
                      aria-disabled={isMediaLimitReached}
                      onClick={() => {
                        if (!isMediaLimitReached) {
                          mediaFileInputRef.current?.click();
                        }
                      }}
                      onKeyDown={(event) => {
                        if (
                          !isMediaLimitReached &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault();
                          mediaFileInputRef.current?.click();
                        }
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (!isMediaLimitReached) setIsDraggingMedia(true);
                      }}
                      onDragLeave={() => setIsDraggingMedia(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setIsDraggingMedia(false);
                        if (!isMediaLimitReached) {
                          void handleFilesSelected(event.dataTransfer.files);
                        }
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input p-6 text-center transition-colors",
                        isMediaLimitReached
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer hover:border-primary",
                        isDraggingMedia && "border-primary bg-accent",
                      )}
                    >
                      <Text>Tarik file ke sini atau klik untuk memilih</Text>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            aria-disabled="true"
                            className="cursor-not-allowed text-sm text-muted-foreground underline underline-offset-4"
                            onClick={(event) => event.stopPropagation()}
                          >
                            atau pilih dari Media Library
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Coming soon</TooltipContent>
                      </Tooltip>
                    </div>

                    {mediaError ? (
                      <Text variant="muted" className="text-destructive">
                        {mediaError}
                      </Text>
                    ) : (
                      <FieldDescription>
                        Maks. {effectiveMaxMedia} media untuk format yang sedang
                        dipilih (ADR-107) — 50MB per file.
                      </FieldDescription>
                    )}

                    {mediaItems.length > 0 || uploadingMediaCount > 0 ? (
                      // eslint-disable-next-line no-restricted-syntax -- T-024.4: grid preview thumbnail media (multi-media/carousel) — tidak ada primitive shadcn setara, murni Tailwind grid.
                      <div className="grid grid-cols-3 gap-2">
                        {mediaItems.map((item) => (
                          // eslint-disable-next-line no-restricted-syntax -- T-024.4: tile thumbnail grid preview media (multi-media/carousel) — tidak ada primitive shadcn setara, murni Tailwind.
                          <div
                            key={item.id}
                            className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
                          >
                            <MediaThumbnail
                              url={item.url}
                              type={item.type}
                              alt={item.filename}
                            />
                            <button
                              type="button"
                              aria-label={`Hapus ${item.filename} secara permanen`}
                              onClick={() => deleteMediaConfirm.open(item)}
                              disabled={deleteMediaConfirm.isLoading}
                              className="absolute top-1 right-1 rounded-full bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <HugeiconsIcon
                                icon={Delete02Icon}
                                strokeWidth={2}
                                size={16}
                              />
                            </button>
                          </div>
                        ))}
                        {Array.from({ length: uploadingMediaCount }).map(
                          (_, index) => (
                            // eslint-disable-next-line no-restricted-syntax -- T-024.4: placeholder loading tile tanpa identitas stabil (belum ada id sampai upload selesai); murni Tailwind, tidak ada primitive shadcn setara.
                            <div
                              key={`uploading-${index}`}
                              className="flex aspect-square items-center justify-center rounded-md border border-dashed border-input bg-muted"
                            >
                              <Spinner />
                            </div>
                          ),
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex. */}
                <div className="flex w-full max-w-85 flex-col gap-4">
                  {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex. */}
                  <div className="flex flex-col gap-3">
                    <Text variant="h4" as="h3">
                      Account Selector
                    </Text>
                    {isLoadingAccounts ? (
                      <Text variant="muted">Memuat akun terhubung…</Text>
                    ) : accounts.length === 0 ? (
                      <Text variant="muted">
                        Belum ada akun terhubung untuk workspace ini.
                      </Text>
                    ) : (
                      accounts.map((account) => {
                        const isChecked = selectedAccountIds.includes(
                          account.id,
                        );
                        const formats = getSelectableFormats(account.platform);
                        const currentFormat = formatByAccount[account.id];
                        const isDisconnected = isAccountDisconnected(account);

                        const checkboxId = `draft-account-${account.id}`;

                        return (
                          // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex.
                          <div key={account.id} className="flex flex-col gap-2">
                            {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx HStack, murni Tailwind flex. */}
                            <div className="flex items-center justify-between">
                              <LabeledControl
                                htmlFor={checkboxId}
                                control={
                                  <Checkbox
                                    id={checkboxId}
                                    checked={isChecked}
                                    onCheckedChange={(checked) =>
                                      toggleAccount(account, checked === true)
                                    }
                                  />
                                }
                              >
                                {PLATFORM_LABEL[account.platform]}{" "}
                                {account.handle}
                              </LabeledControl>
                              {isDisconnected ? (
                                <Badge variant="warning">Disconnected</Badge>
                              ) : null}
                            </div>

                            {isDisconnected ? (
                              <Text variant="muted">
                                Akun ini terputus —{" "}
                                <NextLink
                                  href="/settings/connected-accounts"
                                  className="text-primary underline underline-offset-4 hover:no-underline"
                                >
                                  Reconnect
                                </NextLink>
                                .
                              </Text>
                            ) : null}

                            {isChecked && formats ? (
                              <RadioGroup
                                aria-label="Content Format"
                                className="flex flex-row flex-wrap gap-4"
                                value={
                                  currentFormat ??
                                  getDefaultFormat(account.platform)
                                }
                                onValueChange={(value) =>
                                  setFormatByAccount((prev) => ({
                                    ...prev,
                                    [account.id]: value as ContentFormat,
                                  }))
                                }
                              >
                                {formats.map((format) => {
                                  const radioId = `${checkboxId}-format-${format}`;
                                  return (
                                    <LabeledControl
                                      key={format}
                                      htmlFor={radioId}
                                      control={
                                        <RadioGroupItem
                                          value={format}
                                          id={radioId}
                                        />
                                      }
                                    >
                                      {FORMAT_LABEL[format]}
                                    </LabeledControl>
                                  );
                                })}
                              </RadioGroup>
                            ) : null}

                            {isChecked &&
                            account.platform === SocialPlatform.Pinterest ? (
                              // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex.
                              <div className="flex flex-col gap-2">
                                <Text variant="muted">Format: Pin</Text>
                                <Label htmlFor={`${checkboxId}-pin-title`}>
                                  Pin Title{" "}
                                  <span className="text-muted-foreground">
                                    (opsional)
                                  </span>
                                </Label>
                                <Input
                                  id={`${checkboxId}-pin-title`}
                                  value={pinTitle}
                                  onChange={(event) =>
                                    setPinTitle(event.target.value)
                                  }
                                />
                                <Label htmlFor={`${checkboxId}-pin-link`}>
                                  Destination Link{" "}
                                  <span className="text-muted-foreground">
                                    (opsional)
                                  </span>
                                </Label>
                                <Input
                                  id={`${checkboxId}-pin-link`}
                                  value={pinLink}
                                  onChange={(event) =>
                                    setPinLink(event.target.value)
                                  }
                                />
                                <Label htmlFor={`${checkboxId}-board`}>
                                  Board
                                </Label>
                                <FieldDescription>
                                  Wajib. Pin tidak terkirim tanpa board.
                                </FieldDescription>
                                {(() => {
                                  const boardState =
                                    pinterestBoardsByAccount[account.id];
                                  if (!boardState) {
                                    return (
                                      <Select disabled value="">
                                        <SelectTrigger
                                          id={`${checkboxId}-board`}
                                          className="w-full"
                                        >
                                          <SelectValue placeholder="Pilih board…" />
                                        </SelectTrigger>
                                        <SelectContent />
                                      </Select>
                                    );
                                  }
                                  if (boardState.status === "loading") {
                                    return (
                                      <Select disabled value="">
                                        <SelectTrigger
                                          id={`${checkboxId}-board`}
                                          className="w-full"
                                        >
                                          <SelectValue placeholder="Memuat board..." />
                                        </SelectTrigger>
                                        <SelectContent />
                                      </Select>
                                    );
                                  }
                                  if (boardState.status === "error") {
                                    return (
                                      // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx HStack, murni Tailwind flex.
                                      <div className="flex items-center gap-2">
                                        <Text
                                          variant="muted"
                                          className="text-destructive"
                                        >
                                          {boardState.message}
                                        </Text>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            fetchPinterestBoards(account.id)
                                          }
                                        >
                                          Coba lagi
                                        </Button>
                                      </div>
                                    );
                                  }
                                  return (
                                    <>
                                      {boardState.boards.length === 0 ? (
                                        <FieldDescription>
                                          Akun ini belum punya board, jadi pin
                                          belum bisa dijadwalkan.
                                        </FieldDescription>
                                      ) : null}
                                      <Select
                                        value={
                                          boardIdByAccount[account.id] ?? ""
                                        }
                                        onValueChange={(value) =>
                                          setBoardIdByAccount((prev) => ({
                                            ...prev,
                                            [account.id]: value || undefined,
                                          }))
                                        }
                                      >
                                        <SelectTrigger
                                          id={`${checkboxId}-board`}
                                          className="w-full"
                                        >
                                          <SelectValue placeholder="Pilih board…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {boardState.boards.map((board) => (
                                            <SelectItem
                                              key={board.id}
                                              value={board.id}
                                            >
                                              {board.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </>
                                  );
                                })()}
                              </div>
                            ) : null}

                            {isChecked &&
                            !formats &&
                            account.platform !== SocialPlatform.Pinterest ? (
                              <Text variant="muted">Format: Post</Text>
                            ) : null}

                            <Separator />
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex. */}
                  <div className="flex flex-col gap-3">
                    <Text variant="h4" as="h3">
                      Jadwal
                    </Text>
                    {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx HStack, murni Tailwind flex. */}
                    <div className="flex items-center gap-2">
                      <Label htmlFor="draft-schedule-date" className="sr-only">
                        Tanggal
                      </Label>
                      <Input
                        id="draft-schedule-date"
                        type="date"
                        className="w-auto"
                        value={scheduleDate ?? ""}
                        onChange={(event) =>
                          setScheduleDate(event.target.value || undefined)
                        }
                      />
                      <Label htmlFor="draft-schedule-time" className="sr-only">
                        Waktu
                      </Label>
                      <Input
                        id="draft-schedule-time"
                        type="time"
                        className="w-auto"
                        value={scheduleTime ?? ""}
                        onChange={(event) =>
                          setScheduleTime(event.target.value || undefined)
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {isLoadingDraft ? null : pendingAction === "schedule" ? (
        <DialogFooter className="border-t border-border px-6 py-4">
          <Button
            variant="secondary"
            onClick={() => setPendingAction(null)}
            disabled={isScheduling}
          >
            Batal
          </Button>
          <Button onClick={handleConfirmSchedule} disabled={isScheduling}>
            {isScheduling ? <Spinner /> : null}
            Konfirmasi & Jadwalkan
          </Button>
        </DialogFooter>
      ) : pendingAction === "publish-now" ? (
        <DialogFooter className="border-t border-border px-6 py-4">
          <Button
            variant="secondary"
            onClick={() => setPendingAction(null)}
            disabled={isPublishingNow}
          >
            Batal
          </Button>
          <Button onClick={handleConfirmPublishNow} disabled={isPublishingNow}>
            {isPublishingNow ? <Spinner /> : null}
            Konfirmasi & Publish
          </Button>
        </DialogFooter>
      ) : (
        <DialogFooter className="flex-row border-t border-border px-6 py-4 [&>*]:flex-1">
          <Button
            variant="secondary"
            onClick={handleSaveDraft}
            disabled={isSavingDraft}
          >
            {isSavingDraft ? <Spinner /> : null}
            Save as Draft
          </Button>
          <Button
            variant="secondary"
            disabled={!isReadyToPublishNow}
            onClick={() => setPendingAction("publish-now")}
          >
            Publish Now
          </Button>
          <Button
            disabled={!isReadyToSchedule}
            onClick={() => setPendingAction("schedule")}
          >
            Schedule
          </Button>
        </DialogFooter>
      )}

      <ConfirmActionDialog
        isOpen={deleteMediaConfirm.isOpen}
        onClose={deleteMediaConfirm.close}
        title="Hapus media ini secara permanen?"
        description="Tindakan ini tidak bisa dibatalkan — file akan hilang permanen dari Storage dan tidak lagi bisa dipakai di post manapun."
        confirmLabel="Hapus Media"
        isLoading={deleteMediaConfirm.isLoading}
        error={deleteMediaConfirm.error}
        onConfirm={() => void deleteMediaConfirm.confirm()}
        variant="destructive"
      />
    </div>
  );
}

// Standard variant's floating card + backdrop margins waste too much of a
// small phone's screen (ADR-065 only decided the desktop default; it never
// addressed small viewports). Below this breakpoint the Dialog always
// renders Fullscreen regardless of the user's toggle choice, restoring the
// edge-to-edge editing surface mobile needs.
const MOBILE_VIEWPORT_QUERY = "(max-width: 640px)";

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(MOBILE_VIEWPORT_QUERY).matches,
  );
  useEffect(() => {
    const query = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

export function DraftEditorModal() {
  const {
    state,
    resume,
    discardAndStartNew,
    close,
    persistUnsavedNewPost,
    clearUnsavedNewPost,
  } = useDraftEditor();

  const isEditorOpen = state.mode === "create" || state.mode === "edit";
  const sessionKey =
    state.mode === "edit"
      ? `edit:${state.postId}`
      : state.mode === "create"
        ? "create"
        : "none";

  // Remembers the last resume-check payload, and the currently-mounted
  // form's live caption/savedPostId — both adjusted during render (not in
  // an effect) purely so exit animations / close handling have data to work
  // with after `state` has already moved on.
  const [resumeData, setResumeData] = useState<UnsavedNewPost | null>(null);
  if (state.mode === "resume-check" && state.unsaved !== resumeData) {
    setResumeData(state.unsaved);
  }

  // Fullscreen/Standard toggle (ADR-065): official, user-switchable, never
  // persisted — reset to the default (Standard) every time a new session
  // starts. `DraftEditorForm` itself remounts per session via `key=
  // {sessionKey}`, but this state has to live here because it drives the
  // wrapping `Dialog`'s own `variant`/`width`, so it's reset the same way
  // `resumeData` above is: adjusted during render when `sessionKey` changes,
  // not in an effect.
  const [dialogVariant, setDialogVariant] = useState<"standard" | "fullscreen">(
    "standard",
  );
  const [prevSessionKey, setPrevSessionKey] = useState(sessionKey);
  if (prevSessionKey !== sessionKey) {
    setPrevSessionKey(sessionKey);
    if (dialogVariant !== "standard") {
      setDialogVariant("standard");
    }
  }
  function toggleDialogVariant() {
    setDialogVariant((current) =>
      current === "standard" ? "fullscreen" : "standard",
    );
  }
  const isMobileViewport = useIsMobileViewport();
  const effectiveDialogVariant = isMobileViewport
    ? "fullscreen"
    : dialogVariant;

  const latestFormRef = useRef<LatestFormSnapshot>({
    mode: "create",
    caption: "",
    savedPostId: undefined,
  });

  function handleOpenChange(open: boolean) {
    if (open) {
      return;
    }
    const { mode, caption, savedPostId } = latestFormRef.current;
    if (mode === "create") {
      const trimmed = caption.trim();
      if (trimmed && !savedPostId) {
        persistUnsavedNewPost(trimmed);
      } else {
        clearUnsavedNewPost();
      }
    }
    close();
  }

  return (
    <>
      <ResumeDialog
        isOpen={state.mode === "resume-check"}
        unsaved={resumeData}
        onDiscard={discardAndStartNew}
        onResume={resume}
      />

      <Dialog
        open={isEditorOpen}
        onOpenChange={(open) => handleOpenChange(open)}
      >
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            effectiveDialogVariant === "fullscreen" &&
              "top-0 left-0 h-dvh max-h-none w-screen max-w-none translate-none rounded-none",
          )}
          style={
            effectiveDialogVariant === "fullscreen"
              ? undefined
              : {
                  width: "min(960px, 94vw)",
                  maxWidth: "min(960px, 94vw)",
                  maxHeight: "88vh",
                }
          }
        >
          {isEditorOpen ? (
            <DraftEditorForm
              key={sessionKey}
              mode={state.mode === "edit" ? "edit" : "create"}
              postId={state.mode === "edit" ? state.postId : undefined}
              prefillCaption={
                state.mode === "create" ? state.prefillCaption : undefined
              }
              preSelectedAccountId={
                state.mode === "create" ? state.preSelectedAccountId : undefined
              }
              initialPendingAction={
                state.mode === "edit" ? state.initialPendingAction : undefined
              }
              onOpenChange={handleOpenChange}
              dialogVariant={dialogVariant}
              onToggleDialogVariant={toggleDialogVariant}
              onLatestChange={(snapshot) => {
                latestFormRef.current = snapshot;
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
