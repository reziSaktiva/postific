"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ContentStatus } from "@postific/shared";
import type { PostMetricsRecord } from "@/domains/analytics";
import type {
  HistoryDetailItem,
  HistoryItemRecord,
} from "@/domains/publishing";
import type { MediaThumbnailDto } from "@/domains/media";
import { formatRelativeTime } from "@/lib/utils/format-relative-time";
import { linkifyCaption } from "@/lib/linkify";

import { MediaThumbnail } from "../../../../components/media-thumbnail";
import { ChannelAvatarBadge } from "@/components/shared/ChannelAvatarBadge";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  formatEngagementRate,
  formatMetricCount,
  MetricTile,
} from "../../../../components/post-metric-tile";
import {
  HISTORY_STATUS_BADGE_VARIANT,
  HISTORY_STATUS_LABEL,
  TARGET_STATUS_BADGE_VARIANT,
  TARGET_STATUS_LABEL,
} from "../../history-status";
import { RetryTargetButton } from "./RetryTargetButton";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Label judul Dialog (T-111.1 LOCKED PATTERN) — Published pakai
 * `publishedAt`; Failed pakai `scheduledAt` kalau ada (post yang gagal
 * padahal sempat dijadwalkan), fallback `updatedAt` (Publish Now yang
 * gagal, tidak pernah punya `scheduledAt` — lihat
 * `IPublishingRepository.publishNow`).
 */
function formatWhenLabel(item: HistoryItemRecord): string {
  if (item.status === ContentStatus.Published) {
    const date = item.publishedAt ?? item.updatedAt;
    return `Dipublikasikan ${DATE_TIME_FORMATTER.format(date)}`;
  }
  if (item.scheduledAt) {
    return `Dijadwalkan ${DATE_TIME_FORMATTER.format(item.scheduledAt)}`;
  }
  return `Percobaan publish ${DATE_TIME_FORMATTER.format(item.updatedAt)}`;
}

/**
 * Link "Lihat post asli" (T-034.3) — kalau `platformPostUrl` kosong
 * (Published tapi Fake OutstandAdapter, ADR-059, belum tentu mengisi URL
 * nyata), King Rezi mengonfirmasi (2026-09-08) link tetap TAMPIL tapi
 * disabled/non-interaktif — bukan disembunyikan, bukan link mati yang bisa
 * diklik.
 */
function ViewOriginalPostLink({ url }: { url: string | null }) {
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Button type="button" variant="link" size="sm" className="px-0">
          Lihat post asli
        </Button>
      </a>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="px-0"
            disabled
          >
            Lihat post asli
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>URL post asli belum tersedia</TooltipContent>
    </Tooltip>
  );
}

/**
 * Metrik ringkas per target (T-043.3) — mapping label sama seperti Popover
 * Calendar (T-033.8): Views→`impressions`, Reach→`reach`,
 * Replies→`comments`, Eng. Rate→`engagementRate`. `metric` bernilai `null`
 * kalau `item.metrics` (array) tidak punya baris untuk `connectedAccountId`
 * target ini — post Published tapi belum ada `AnalyticsPostMetric`
 * ter-ingest untuk akun spesifik ini (pola sama T-043.4 di
 * `AnalyzeDashboard.tsx`: "Belum ada data", bukan nol).
 */
function TargetMetrics({ metric }: { metric: PostMetricsRecord | null }) {
  if (!metric) {
    return (
      <Text variant="muted" as="span" className="text-xs">
        Belum ada data
      </Text>
    );
  }

  return (
    // eslint-disable-next-line no-restricted-syntax -- layout-only, konsisten pola shadcn+Tailwind lain di publish/
    <div className="flex flex-wrap gap-2">
      <MetricTile label="Views" value={formatMetricCount(metric.impressions)} />
      <MetricTile label="Reach" value={formatMetricCount(metric.reach)} />
      <MetricTile label="Replies" value={formatMetricCount(metric.comments)} />
      <MetricTile
        label="Eng. Rate"
        value={formatEngagementRate(metric.engagementRate)}
      />
    </div>
  );
}

export interface HistoryDetailProps {
  item: HistoryDetailItem;
  thumbnail: MediaThumbnailDto | null;
}

/**
 * Detail satu History item (T-034.3, KSP-D10), direstrukturisasi total
 * jadi Modal/Dialog (T-111.2, promosi KI-083 → T-111, LOCKED PATTERN
 * T-111.1 di Claude Design `templates/publish-history-detail.html`,
 * primitive `.dialog-md-backdrop`/`.dialog-md` → `Dialog`/`DialogContent`
 * shadcn) — menggantikan halaman penuh + thumbnail kotak kecil fixed-size
 * dari fix KI-082 (PR #144).
 *
 * Struktur LOCKED (`.dialog-fs-header` + `.dialog-fs-body` SAJA, TIDAK
 * ADA footer terpisah — dua area scroll dalam satu dialog dibatalkan
 * King Rezi di iterasi sebelumnya): header = judul "Dipublikasikan
 * <tanggal>" + status chip; body = SATU scroll area berurutan caption
 * (linkify) → media natural-size → divider → "Hasil per Akun" (tiap baris
 * `ChannelAvatarBadge` sendiri, menggantikan `PlatformGlyph` generik).
 *
 * **Dialog dibuka `open` (bukan `isOpen` state lokal) + `onOpenChange`
 * menavigasi balik ke `/publish/history`** — route `[postId]` TETAP ada
 * (dibutuhkan untuk direct link/bookmark satu item History, dan supaya
 * `page.tsx` composition root tidak berubah drastis), tapi kontennya
 * sekarang Dialog, bukan Card halaman penuh. **Keputusan disengaja
 * dilaporkan (T-111.2):** ini BUKAN Next.js intercepting route/parallel
 * slot (`@modal` + `(.)[postId]`) yang membuat `HistoryList` tetap
 * ter-mount di belakang overlay — pola itu belum pernah dipakai di
 * codebase ini sama sekali, jadi menambahkannya sekarang adalah
 * perubahan arsitektur routing baru di luar scope "restrukturisasi
 * HistoryDetail.tsx" yang diminta. Secara visual hasilnya tetap modal
 * penuh (overlay `bg-black/80` menutupi seluruh viewport terlepas apa
 * yang ter-mount di baliknya) — kalau King Rezi memang mau List History
 * tetap terlihat ter-mount di belakang (untuk transisi/animasi tertentu),
 * itu perlu task terpisah untuk setup intercepting route.
 *
 * **Gap dilaporkan (sudah ada sejak T-034.3, belum berubah):** mockup
 * asli menyebut meta "dibuat oleh siapa", tapi `HistoryItemRecord` tidak
 * membawa `authorId`/nama author — field baru tidak ditambahkan di luar
 * scope task ini.
 *
 * **Gap baru (T-111.2):** `HistoryItemTargetRecord` tidak membawa
 * `avatarUrl` akun (hanya `accountHandle`) — `ChannelAvatarBadge` per
 * baris "Hasil per Akun" karena itu SELALU jatuh ke `AvatarFallback`
 * (inisial), tidak pernah menampilkan foto profil asli. Ini bukan
 * keputusan diam-diam: menambah `avatarUrl` ke `HistoryItemTargetRecord`
 * adalah perubahan repository/service (join ke data akun), di luar scope
 * "restrukturisasi UI murni" task ini — laporkan ke King Rezi kalau foto
 * profil asli memang wajib tampil di sini.
 */
export function HistoryDetail({ item, thumbnail }: HistoryDetailProps) {
  const router = useRouter();
  // `isOpen` lokal (bukan `open` literal) supaya Escape/klik overlay
  // langsung menutup Dialog secara visual, tanpa menunggu navigasi
  // `router.push` selesai (bisa lambat di koneksi lemah) — lihat komentar
  // di atas soal keputusan tidak memakai intercepting route.
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setIsOpen(false);
          router.push("/publish/history");
        }
      }}
    >
      {/* eslint-disable-next-line tailwindcss/no-arbitrary-value -- `max-h-[82vh]` mengikuti nilai pasti LOCKED PATTERN T-111.1 (`.dialog-md{max-height:82vh}`, Claude Design styles.css), tidak ada utility Tailwind native untuk persentase viewport-height ini. */}
      <DialogContent className="flex max-h-[82vh] w-full flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-140">
        <DialogHeader className="shrink-0 gap-0 border-b border-border px-6 py-4">
          {/* eslint-disable-next-line no-restricted-syntax -- layout-only, konsisten pola shadcn+Tailwind lain di publish/ */}
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle>{formatWhenLabel(item)}</DialogTitle>
            <Badge variant={HISTORY_STATUS_BADGE_VARIANT[item.status]}>
              {HISTORY_STATUS_LABEL[item.status]}
            </Badge>
          </div>
        </DialogHeader>

        {/* Satu-satunya scroll area di dalam Dialog (LOCKED PATTERN
            T-111.1) — caption, media, divider, "Hasil per Akun" semua di
            sini, bukan dipecah jadi beberapa area scroll. */}
        {/* eslint-disable-next-line no-restricted-syntax -- layout-only */}
        <div className="flex flex-col gap-4 overflow-x-hidden overflow-y-auto px-8 py-6">
          {/* eslint-disable-next-line no-restricted-syntax -- layout-only */}
          <div className="flex flex-col gap-1">
            <Text
              variant="p"
              className="mt-0! text-sm break-words whitespace-pre-wrap"
            >
              {item.caption ? linkifyCaption(item.caption) : "(Tanpa caption)"}
            </Text>
            <Text variant="muted" as="span" className="text-xs">
              Dibuat {formatRelativeTime(item.createdAt)}
            </Text>
          </div>

          {thumbnail ? (
            // eslint-disable-next-line no-restricted-syntax -- T-111.1/T-111.2: media natural-size (`fit="natural"`, lebar penuh + tinggi mengikuti aspect ratio asli) — media di-omit sepenuhnya kalau post tidak bermedia (bukan kotak kosong), sama pola T-056/KI-082.
            <div className="overflow-hidden rounded-lg border border-border bg-muted">
              <MediaThumbnail
                url={thumbnail.url}
                type={thumbnail.type}
                alt="Media post asal"
                fit="natural"
              />
            </div>
          ) : null}

          <Separator />

          {/* eslint-disable-next-line no-restricted-syntax -- layout-only */}
          <div className="flex flex-col gap-3">
            <Text variant="h4" as="h2" className="mt-0!">
              Hasil per Akun
            </Text>

            {/* eslint-disable-next-line no-restricted-syntax -- layout-only */}
            <div className="flex flex-col gap-4">
              {item.targets.map((target) => {
                return (
                  // eslint-disable-next-line no-restricted-syntax -- layout-only
                  <div className="flex flex-col gap-1.5" key={target.id}>
                    {/* eslint-disable-next-line no-restricted-syntax -- layout-only */}
                    <div className="flex items-center justify-between gap-2">
                      {/* eslint-disable-next-line no-restricted-syntax -- layout-only */}
                      <div className="flex items-center gap-2">
                        <ChannelAvatarBadge
                          handle={target.accountHandle}
                          platform={target.platform}
                        />
                        <Text variant="small" as="span" className="font-medium">
                          {target.accountHandle}
                        </Text>
                      </div>
                      <Badge
                        variant={TARGET_STATUS_BADGE_VARIANT[target.status]}
                      >
                        {TARGET_STATUS_LABEL[target.status]}
                      </Badge>
                    </div>

                    {target.status === "published" && (
                      <>
                        <ViewOriginalPostLink url={target.platformPostUrl} />
                        {/* Guard defensif (rule brief T-043.3, poin 2): `item.metrics`
                            seharusnya tidak pernah `null` untuk target published
                            (metrik hanya `null` untuk post non-Published), tapi
                            tetap di-guard eksplisit — jangan render apapun soal
                            metrik kalau ternyata null. */}
                        {item.metrics !== null && (
                          <TargetMetrics
                            metric={
                              item.metrics.find(
                                (metric) =>
                                  metric.connectedAccountId ===
                                  target.connectedAccountId,
                              ) ?? null
                            }
                          />
                        )}
                      </>
                    )}

                    {target.status === "failed" && (
                      // eslint-disable-next-line no-restricted-syntax -- layout-only
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Text
                          variant="muted"
                          as="span"
                          className="min-w-0 flex-1 text-xs break-words text-destructive"
                        >
                          {target.error ?? "Gagal dipublikasikan."}
                        </Text>
                        <RetryTargetButton
                          postId={item.id}
                          targetId={target.id}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
