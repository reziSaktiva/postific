"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons";

import { SocialPlatform } from "@postific/shared";
import type { ConnectedAccountRecord } from "@/domains/workspace";
import type {
  EngagementInboxItemRecord,
  InboxItemStatus,
} from "@/domains/engagement";
import { formatRelativeTime } from "@/lib/utils/format-relative-time";
import { cn } from "@/lib/utils";

import { ChannelAvatarBadge } from "@/components/shared/ChannelAvatarBadge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";

import { MediaThumbnail } from "../../components/media-thumbnail";
import { PLATFORM_ICON } from "../../components/platform-icons";
import {
  getInboxItemDetailAction,
  listInboxAction,
  markAsDoneAction,
  refreshInboxAction,
  replyToCommentAction,
  type InboxItemDetailDto,
  type ListInboxActionFilter,
} from "../actions";

const ALL_ACCOUNTS_FILTER_VALUE = "all";
const ALL_PLATFORMS_FILTER_VALUE = "all";
const ALL_STATUS_FILTER_VALUE = "all";

/** `.inbox-shell` (Claude Design `templates/engage-inbox.html`) — grid dua
 * kolom tetap (thread-list 340px + thread-detail sisanya). Dimensi
 * struktural ini bukan design token (tidak ada padanan spacing scale untuk
 * lebar panel list), jadi diterapkan lewat inline `style` (pola sama
 * `POPOVER_WIDTH` di `CalendarPostPopover.tsx`) — Tailwind arbitrary-value
 * (`grid-cols-[340px_1fr]`) akan kena `tailwindcss/no-arbitrary-value`
 * (ADR-095) di file luar `components/ui/**`. */
const THREAD_LIST_WIDTH_PX = 340;

/**
 * Kartu "Post asal" ala Instagram (T-111.4, implementasi LOCKED PATTERN
 * T-111.3 Claude Design `templates/engage-inbox.html` § `.post-context`).
 * Komponen terpisah (bukan inline di body utama) supaya state carousel
 * lokal (`mediaIndex`) otomatis ter-reset tiap ganti komentar yang dipilih
 * lewat `key={detail.id}` di call-site — tidak butuh `useEffect` manual.
 *
 * Struktur: atas `.post-context-media-wrap` (media rasio 1:1 `object-fit:
 * cover` + 2 tombol carousel melayang, HANYA kalau `thumbnails.length > 1`)
 * — bawah `.post-context-content` (label "Post asal" → avatar+badge+nama
 * akun → caption TANPA truncate, wrap multi-baris → "Go to post →", tidak
 * berubah dari T-056). Lebar kartu **1/3 dari `.thread-detail` di desktop,
 * RATA KIRI** (`.post-context` CSS asli: `width: 33.333%; align-self:
 * flex-start`) HANYA kalau ada media (`thumbnails.length > 0`) — koreksi
 * 2026-10-07: ringkasan task T-111.3/.4 sempat menulis "360px FIXED,
 * DI-CENTER" tapi CSS literal `styles.css` Claude Design berkata lain (CSS
 * asli menang atas ringkasan task, lihat KI-083 follow-up). Full-width hanya
 * di breakpoint ≤768px (default className tanpa prefix = mobile-first
 * `w-full`, `md:w-1/3` menimpa di ≥768px — breakpoint Tailwind `md` pas
 * dengan `max-width:768px` CSS asli). Fallback `.post-context-nomedia`
 * (media di-omit sepenuhnya, konsisten T-056) sengaja full-width, tidak
 * di-batasi 1/3, sama seperti sebelum T-111.
 */
function PostOriginCard({
  postSnapshot,
  account,
  platform,
  fallbackHandle,
}: {
  postSnapshot: NonNullable<InboxItemDetailDto["postSnapshot"]>;
  account: ConnectedAccountRecord | undefined;
  platform: SocialPlatform;
  fallbackHandle: string;
}) {
  const [mediaIndex, setMediaIndex] = useState(0);
  const { thumbnails, caption, platformPostUrl } = postSnapshot;
  const hasMedia = thumbnails.length > 0;
  const activeThumbnail = hasMedia
    ? (thumbnails[mediaIndex] ?? thumbnails[0])
    : null;
  const accountLabel = account?.handle ?? fallbackHandle;

  const goPrev = () =>
    setMediaIndex(
      (index) => (index - 1 + thumbnails.length) % thumbnails.length,
    );
  const goNext = () =>
    setMediaIndex((index) => (index + 1) % thumbnails.length);

  const accountRow = (
    // eslint-disable-next-line no-restricted-syntax -- T-111.4: `.post-context-account`, layout-only
    <div className="flex items-center gap-2">
      <ChannelAvatarBadge
        avatarUrl={account?.avatarUrl}
        handle={accountLabel}
        platform={platform}
      />
      <Text as="span" variant="small">
        {accountLabel}
      </Text>
    </div>
  );

  const captionAndLink = (
    <>
      <Text as="p" className="text-sm font-semibold whitespace-pre-line">
        {caption || "(Tanpa caption)"}
      </Text>
      {platformPostUrl ? (
        <a href={platformPostUrl} target="_blank" rel="noopener">
          <Text variant="muted" as="span" className="text-xs text-primary">
            Go to post →
          </Text>
        </a>
      ) : null}
    </>
  );

  if (!hasMedia) {
    return (
      // eslint-disable-next-line no-restricted-syntax -- T-111.4: `.post-context-nomedia`, full-width/tidak di-center (konsisten T-056, media di-omit sepenuhnya)
      <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-muted p-3">
        <Text variant="muted" as="span" className="text-xs">
          Post asal
        </Text>
        {accountRow}
        {captionAndLink}
      </div>
    );
  }

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-111.4 (koreksi 2026-10-07): `.post-context`, kartu ala Instagram, lebar 1/3 RATA KIRI di desktop (CSS asli `width:33.333%; align-self:flex-start` — bukan 360px di-center seperti ringkasan task lama), full-width di breakpoint ≤768px
    <div className="w-full self-start overflow-hidden rounded-lg border border-border md:w-1/3">
      {/* eslint-disable-next-line no-restricted-syntax -- T-111.4: `.post-context-media-wrap`, rasio 1:1 */}
      <div className="relative aspect-square bg-muted-foreground/20">
        {activeThumbnail ? (
          <MediaThumbnail
            key={mediaIndex}
            url={activeThumbnail.url}
            type={activeThumbnail.type}
            alt="Media post asal"
            fit="cover"
            className="absolute inset-0"
          />
        ) : null}
        {thumbnails.length > 1 ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              aria-label="Media sebelumnya"
              onClick={goPrev}
              className="absolute top-1/2 left-2 -translate-y-1/2"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              aria-label="Media berikutnya"
              onClick={goNext}
              className="absolute top-1/2 right-2 -translate-y-1/2"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
            </Button>
          </>
        ) : null}
      </div>
      {/* eslint-disable-next-line no-restricted-syntax -- T-111.4: `.post-context-content`, layout-only */}
      <div className="flex min-w-0 flex-col gap-2 p-3">
        <Text variant="muted" as="span" className="text-xs">
          Post asal
        </Text>
        {accountRow}
        {captionAndLink}
      </div>
    </div>
  );
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: ALL_STATUS_FILTER_VALUE, label: "Semua Status" },
  { value: "unread", label: "Unread" },
  { value: "done", label: "Done" },
];

function formatUpdatedAtLabel(date: Date): string {
  return `${date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })} WIB`;
}

export interface EngageInboxViewProps {
  /** Hasil `EngagementService.listInbox` tanpa filter (state default) — T-053. */
  initialItems: EngagementInboxItemRecord[];
  /** Daftar akun terkoneksi workspace (opsi filter Akun) — dari `WorkspaceService.listConnectedAccounts`, bukan derive dari `initialItems`, pola sama `CalendarToolbar`/`HistoryList`. */
  accounts: ConnectedAccountRecord[];
}

/**
 * Comments Inbox (T-053, KSP-06) — acuan visual `templates/engage-inbox.html`
 * (Claude Design). Struktur mengikuti keputusan King Rezi via
 * `AskUserQuestion` (T-103.2 gate): baris thread dibangun dari `Item`/
 * `ItemGroup` shadcn (bukan `Table`) — mockup-nya satu blok teks per baris
 * (nama pengirim bold + cuplikan komentar dalam satu teks, meta line
 * platform/waktu/status), bukan tabular.
 *
 * **Filter (Akun/Platform/Status)** re-fetch server-side lewat
 * `listInboxAction` setiap kali salah satu filter berubah (bukan filter
 * client-side seperti `HistoryList`/`QueueList`) — mengikuti instruksi
 * task T-053 secara eksplisit, memanfaatkan filtering yang sudah jadi
 * tanggung jawab repository (T-050) alih-alih mendownload seluruh inbox
 * lalu memfilter di client.
 *
 * **Tidak ada Supabase Realtime** (ADR-023) — state `items` dikelola penuh
 * di client lewat 3 sumber: (1) `initialItems` dari `page.tsx` saat mount,
 * (2) re-fetch `listInboxAction` saat filter berubah/tombol Refresh
 * diklik, (3) patch lokal hasil `markAsDoneAction` (server sudah
 * `revalidatePath` sendiri, tapi itu hanya memengaruhi re-render Server
 * Component berikutnya — state list di client ini dipatch langsung dari
 * `data` yang dikembalikan action, pola sama `ConnectedAccountsList`).
 *
 * **Kotak "Post asal" (T-056, KI-065, resolved 2026-10-06; restrukturisasi
 * T-111.3/T-111.4, 2026-10-07):** awalnya hanya label generik ("Komentar
 * ini terhubung ke post terjadwal/terpublish") karena `InboxItemDetail`
 * (T-050) tidak membawa snapshot caption/media post asli; lalu T-056
 * menambah thumbnail tunggal dalam kotak kecil tetap (`size-11
 * object-contain`). King Rezi menilai itu belum merepresentasikan post asli
 * dengan baik (KI-083) — direstrukturisasi total (T-111.3, LOCKED PATTERN
 * Claude Design `templates/engage-inbox.html` § `.post-context`) jadi kartu
 * ala post Instagram: media rasio 1:1 + carousel (`PostOriginCard` di
 * bawah, pakai `InboxDetailPostSnapshotDto.thumbnails`, array SEMUA media —
 * beda dari `thumbnail` tunggal T-056 yang dipertahankan untuk
 * backward-compat tempat lain), avatar+badge+nama akun
 * (`PostContextAccountBadge`, lookup `accounts` prop by
 * `detail.connectedAccountId`), dan caption TANPA truncate lagi (beda dari
 * T-056 yang truncate 1 baris). Link **"Go to post →"** (`platformPostUrl`)
 * TIDAK berubah dari T-056. Sengaja beda dari History Detail (T-111.1/.2,
 * modal penuh, media unconstrained) sesuai klarifikasi scope King Rezi
 * 2026-10-06 — lihat `tasks/v02-publishing-mvp.md` § T-111.
 */
export function EngageInboxView({
  initialItems,
  accounts,
}: EngageInboxViewProps) {
  const [items, setItems] = useState(initialItems);
  const [accountFilter, setAccountFilter] = useState(ALL_ACCOUNTS_FILTER_VALUE);
  const [platformFilter, setPlatformFilter] = useState(
    ALL_PLATFORMS_FILTER_VALUE,
  );
  const [statusFilter, setStatusFilter] = useState(ALL_STATUS_FILTER_VALUE);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Push navigation mobile (≤768px, T-111.5 LOCKED PATTERN) — "list" default,
  // "detail" setelah tap satu thread. Di `md:` ke atas state ini tidak
  // berpengaruh visual (kedua panel selalu tampil lewat class `md:flex`/
  // `md:block` yang menimpa `hidden`), jadi `setMobileView` aman dipanggil
  // selalu di handler klik thread, tidak perlu cek viewport dulu.
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [detail, setDetail] = useState<InboxItemDetailDto | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const detailRequestSeqRef = useRef(0);

  const buildFilter = useCallback((): ListInboxActionFilter => {
    const filter: ListInboxActionFilter = {};
    if (accountFilter !== ALL_ACCOUNTS_FILTER_VALUE) {
      filter.connectedAccountId = accountFilter;
    }
    if (platformFilter !== ALL_PLATFORMS_FILTER_VALUE) {
      filter.platform = platformFilter;
    }
    if (statusFilter !== ALL_STATUS_FILTER_VALUE) {
      filter.status = statusFilter as InboxItemStatus;
    }
    return filter;
  }, [accountFilter, platformFilter, statusFilter]);

  // Skip fetch pertama — `initialItems` dari `page.tsx` sudah merepresentasikan
  // state filter default ("Semua Akun"/"Semua Platform"/"Semua Status").
  const skipNextFilterFetchRef = useRef(true);

  useEffect(() => {
    if (skipNextFilterFetchRef.current) {
      skipNextFilterFetchRef.current = false;
      return;
    }

    let cancelled = false;
    setIsLoadingList(true);

    void (async () => {
      const result = await listInboxAction(buildFilter());
      if (cancelled) {
        return;
      }
      if (result.error) {
        toast.error(result.error);
      } else {
        setItems(result.data ?? []);
      }
      setIsLoadingList(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [accountFilter, platformFilter, statusFilter, buildFilter]);

  // Selection "efektif" — dihitung SAAT RENDER (bukan `useEffect` +
  // `setState`, pola sama `useSyncedState`) dari `selectedId` + `items`
  // yang sedang berlaku: kalau `selectedId` masih ada di `items`, pakai
  // itu; kalau tidak (belum pernah memilih, atau item yang dipilih hilang
  // karena filter berubah/`markAsDoneAction` mengeluarkannya dari list),
  // fallback ke item pertama (mockup selalu menampilkan baris pertama
  // sebagai "active" dengan detail terisi). Tidak pernah `null` selama
  // `items` tidak kosong.
  const effectiveSelectedId = items.some((item) => item.id === selectedId)
    ? selectedId
    : (items[0]?.id ?? null);

  // Fetch detail HANYA saat `effectiveSelectedId` berubah (klik item lain,
  // atau fallback pindah ke item pertama di atas) — bukan setiap kali
  // `items` berubah referensinya (mis. re-fetch filter yang hasilnya
  // masih memuat id yang sama). Semua `setState` di sini terjadi di dalam
  // IIFE async (efek async yang menyinkronkan ke sistem luar/Server
  // Action — bukan derive-state sinkron, jadi tidak kena
  // `react-hooks/set-state-in-effect`).
  useEffect(() => {
    let cancelled = false;
    const seq = detailRequestSeqRef.current + 1;
    detailRequestSeqRef.current = seq;

    void (async () => {
      if (!effectiveSelectedId) {
        if (!cancelled) {
          setDetail(null);
          setIsLoadingDetail(false);
        }
        return;
      }

      setIsLoadingDetail(true);
      setDetail(null);
      const result = await getInboxItemDetailAction(effectiveSelectedId);
      if (cancelled || detailRequestSeqRef.current !== seq) {
        // Sudah disusul selection lain (out-of-order response) — buang.
        return;
      }
      if (result.error) {
        toast.error(result.error);
        setDetail(null);
      } else {
        setDetail(result.data ?? null);
      }
      setIsLoadingDetail(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveSelectedId]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const refreshResult = await refreshInboxAction();
    if (refreshResult.error) {
      toast.error(refreshResult.error);
      setIsRefreshing(false);
      return;
    }

    const listResult = await listInboxAction(buildFilter());
    if (listResult.error) {
      toast.error(listResult.error);
    } else {
      setItems(listResult.data ?? []);
    }

    setLastUpdatedAt(new Date());
    setIsRefreshing(false);

    const newCommentsCount = refreshResult.newCommentsCount ?? 0;
    toast(
      newCommentsCount > 0
        ? `${newCommentsCount} komentar baru`
        : "Tidak ada komentar baru",
    );
  }, [buildFilter]);

  const handleMarkAsDone = useCallback(async () => {
    if (!detail) {
      return;
    }
    const result = await markAsDoneAction(detail.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const updated = result.data;
    if (!updated) {
      return;
    }

    setItems((prev) => {
      const stillMatchesFilter =
        statusFilter === ALL_STATUS_FILTER_VALUE ||
        updated.status === statusFilter;
      if (!stillMatchesFilter) {
        return prev.filter((item) => item.id !== updated.id);
      }
      return prev.map((item) => (item.id === updated.id ? updated : item));
    });
    setDetail((prev) =>
      prev && prev.id === updated.id ? { ...prev, ...updated } : prev,
    );
    toast("Komentar ditandai selesai");
  }, [detail, statusFilter]);

  const handleSendReply = useCallback(async () => {
    if (!detail || !replyDraft.trim()) {
      return;
    }
    setIsSendingReply(true);
    const result = await replyToCommentAction(detail.id, replyDraft);
    setIsSendingReply(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const sentReply = result.data;
    setReplyDraft("");
    if (sentReply) {
      setDetail((prev) =>
        prev && prev.id === sentReply.inboxItemId
          ? { ...prev, replies: [...prev.replies, sentReply] }
          : prev,
      );
    }
    toast("Balasan terkirim");
  }, [detail, replyDraft]);

  const accountOptions = [
    { value: ALL_ACCOUNTS_FILTER_VALUE, label: "Semua Akun" },
    ...accounts.map((account) => ({
      value: account.id as string,
      label: account.handle,
    })),
  ];

  const platformOptions = [
    { value: ALL_PLATFORMS_FILTER_VALUE, label: "Semua Platform" },
    ...Object.values(SocialPlatform).map((platform) => ({
      value: platform as string,
      label: PLATFORM_ICON[platform].label,
    })),
  ];

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-053: file baru, dikomposisi Tailwind langsung (ADR-097)
    <div className="flex h-full flex-col gap-4">
      {/* eslint-disable-next-line no-restricted-syntax -- T-053: layout-only; T-111.6: disembunyikan di mobile saat `.thread-detail` full-bleed (CSS asli `.main:has(...) > .page-head {display:none}`) */}
      <div
        className={cn(
          "flex items-center justify-between gap-4",
          mobileView === "detail" && "hidden md:flex",
        )}
      >
        {/* eslint-disable-next-line no-restricted-syntax -- T-053: layout-only */}
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Engage
          </h1>
          <Text variant="muted">
            Diperbarui {formatUpdatedAtLabel(lastUpdatedAt)} · sinkronisasi tiap
            30 menit
          </Text>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handleRefresh()}
          disabled={isRefreshing}
        >
          <HugeiconsIcon
            icon={Refresh01Icon}
            strokeWidth={2}
            className={cn(isRefreshing && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {/* eslint-disable-next-line no-restricted-syntax -- T-053: layout-only, `.inbox-filter`; T-111.6: disembunyikan di mobile saat `.thread-detail` full-bleed (CSS asli `.main:has(...) > .inbox-filter {display:none}`) */}
      <div
        className={cn(
          "flex flex-wrap gap-2",
          mobileView === "detail" && "hidden md:flex",
        )}
      >
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
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger
            size="sm"
            aria-label="Filter platform"
            className="w-44"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {platformOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      </div>

      {items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Belum ada komentar</EmptyTitle>
            <EmptyDescription>
              Komentar dari akun terkoneksi akan muncul di sini setelah
              sinkronisasi.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        // eslint-disable-next-line no-restricted-syntax -- T-053: `.inbox-shell`, grid 2 kolom (lebar list = konstanta struktural, bukan token, lihat komentar THREAD_LIST_WIDTH_PX); T-111.6: `max-md:!grid-cols-1` (breakpoint bawaan Tailwind, bukan arbitrary value) menimpa `style` inline 340px/1fr HANYA di ≤768px — push navigation 1 panel full-width per state `mobileView`
        <div
          className={cn(
            "grid min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card max-md:grid-cols-1!",
            isLoadingList && "opacity-60",
          )}
          style={{
            gridTemplateColumns: `${THREAD_LIST_WIDTH_PX}px 1fr`,
          }}
        >
          {/* eslint-disable-next-line no-restricted-syntax -- T-053: `.thread-list`; T-111.6: disembunyikan total di mobile saat state "detail" */}
          <div
            className={cn(
              "h-full min-h-0 overflow-y-auto border-r border-border",
              mobileView === "detail" && "hidden md:block",
            )}
          >
            <ItemGroup className="gap-0 has-data-[size=sm]:gap-0">
              {items.map((item) => {
                const isSelected = item.id === effectiveSelectedId;
                const isDone = item.status === "done";
                return (
                  <Item
                    key={item.id}
                    asChild
                    variant={isSelected ? "muted" : "default"}
                    size="sm"
                    className="cursor-pointer items-start gap-2 rounded-none border-b border-border p-3 text-left last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(item.id);
                        setMobileView("detail");
                      }}
                      aria-current={isSelected ? "true" : undefined}
                    >
                      <ItemMedia className="mt-1.5 items-start justify-start">
                        <span
                          className={cn(
                            "block size-1.5 shrink-0 rounded-full",
                            isDone ? "bg-transparent" : "bg-primary",
                          )}
                        />
                      </ItemMedia>
                      <ItemContent className="min-w-0 gap-0.5">
                        <ItemTitle className="line-clamp-none block w-full font-normal whitespace-normal">
                          <span className="font-semibold text-foreground">
                            {item.authorHandle}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            — {item.content}
                          </span>
                        </ItemTitle>
                        <Text variant="muted" as="span" className="text-xs">
                          {PLATFORM_ICON[item.platform].label} ·{" "}
                          {formatRelativeTime(item.receivedAt)}
                          {isDone ? " · Done" : ""}
                        </Text>
                      </ItemContent>
                    </button>
                  </Item>
                );
              })}
            </ItemGroup>
          </div>

          {/* eslint-disable-next-line no-restricted-syntax -- T-053: `.thread-detail`; T-111.6: `hidden md:flex` saat state "list" (mobile) vs selalu `flex` di desktop/state "detail" */}
          <div
            className={cn(
              "min-w-0 flex-col gap-4 overflow-y-auto p-5",
              mobileView === "list" ? "hidden md:flex" : "flex",
            )}
          >
            {mobileView === "detail" ? (
              // eslint-disable-next-line no-restricted-syntax -- T-111.6: `.thread-detail-mobile-header`, reuse style `.settings-back-btn` (SettingsSideNav), full-bleed lewat `-m-5` menegasikan padding parent `p-5`
              <div className="-m-5 mb-4 flex items-center gap-2 border-b border-border p-3 md:hidden">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Kembali ke daftar pesan"
                  onClick={() => setMobileView("list")}
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                </Button>
                <Text as="span" className="truncate font-semibold">
                  {detail?.authorHandle ?? ""}
                </Text>
              </div>
            ) : null}
            {isLoadingDetail ? (
              // eslint-disable-next-line no-restricted-syntax -- T-053: layout-only
              <div className="flex flex-1 items-center justify-center">
                <Spinner />
              </div>
            ) : detail ? (
              <>
                {detail.postId && !detail.postSnapshot ? (
                  // eslint-disable-next-line no-restricted-syntax -- T-056, KI-065: fallback label generik (perilaku T-053 lama) saat post/target terkait sudah tidak ditemukan (mis. soft-deleted) walau `postId` masih ada.
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-3">
                    {/* eslint-disable-next-line no-restricted-syntax -- T-056, KI-065: placeholder thumbnail generik, layout-only */}
                    <div className="size-11 shrink-0 rounded-md bg-muted-foreground/20" />
                    {/* eslint-disable-next-line no-restricted-syntax -- T-056, KI-065: `.post-context-body`, layout-only */}
                    <div className="flex flex-col gap-0.5">
                      <Text variant="muted" as="span" className="text-xs">
                        Post asal
                      </Text>
                      <Text as="span" className="text-sm font-semibold">
                        Komentar ini terhubung ke post terjadwal/terpublish
                      </Text>
                    </div>
                  </div>
                ) : null}

                {detail.postId && detail.postSnapshot ? (
                  <PostOriginCard
                    key={detail.id}
                    postSnapshot={detail.postSnapshot}
                    account={accounts.find(
                      (account) => account.id === detail.connectedAccountId,
                    )}
                    platform={detail.platform}
                    fallbackHandle={PLATFORM_ICON[detail.platform].label}
                  />
                ) : null}

                <Text as="p" className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {detail.authorHandle}:
                  </span>{" "}
                  {detail.content}
                </Text>

                {detail.replies.length > 0 ? (
                  // eslint-disable-next-line no-restricted-syntax -- bugfix: riwayat balasan tim, layout-only
                  <div className="flex flex-col gap-2">
                    {detail.replies.map((reply) => (
                      // eslint-disable-next-line no-restricted-syntax -- bugfix: `.reply-history-item`, dibedakan dari komentar customer lewat bg-muted + indent
                      <div
                        key={reply.id}
                        className="ml-4 flex flex-col gap-0.5 rounded-lg bg-muted p-3"
                      >
                        <Text variant="muted" as="span" className="text-xs">
                          Balasan tim · {formatRelativeTime(reply.sentAt)}
                        </Text>
                        <Text as="p" className="text-sm text-foreground">
                          {reply.content}
                        </Text>
                      </div>
                    ))}
                  </div>
                ) : null}

                {detail.status !== "done" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    onClick={() => void handleMarkAsDone()}
                  >
                    Mark as Done
                  </Button>
                ) : null}

                {/* eslint-disable-next-line no-restricted-syntax -- T-053 (koreksi 2026-10-07): `.reply-box` — CSS asli `display:flex; gap; padding-top; border-top` (SATU BARIS textarea+tombol, dipisah divider dari konten di atas), bukan `flex-col` (tombol jatuh ke bawah) seperti sebelumnya */}
                <div className="mt-auto flex gap-2 border-t border-border pt-4">
                  <Textarea
                    placeholder="Balas komentar..."
                    rows={2}
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.target.value)}
                    disabled={isSendingReply}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    className="self-end"
                    disabled={isSendingReply || !replyDraft.trim()}
                    onClick={() => void handleSendReply()}
                  >
                    Kirim
                  </Button>
                </div>
              </>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Pilih komentar</EmptyTitle>
                  <EmptyDescription>
                    Pilih salah satu komentar di daftar untuk melihat detail.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
