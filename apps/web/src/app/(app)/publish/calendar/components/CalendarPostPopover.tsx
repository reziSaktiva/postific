"use client";

import { type ReactNode, useState } from "react";

import { ContentStatus } from "@postific/shared";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { getInitials } from "@/lib/utils";

import {
  CONTENT_STATUS_BADGE_VARIANT,
  CONTENT_STATUS_LABEL,
} from "../../../components/draft-editor/status-badge";
import { useDraftEditor } from "../../../components/draft-editor/Context";
import {
  formatEngagementRate,
  formatMetricCount,
  MetricTile,
} from "../../../components/post-metric-tile";
import { PLATFORM_ICON } from "../../../components/platform-icons";
import {
  type CalendarCardEntry,
  CONTENT_FORMAT_LABEL,
} from "./calendar-grid-shared";

const POPOVER_WIDTH = 296;

export interface CalendarPostPopoverProps {
  /** Kartu per-target hasil `flattenCalendarItemsToEntries` — satu Popover per kartu. */
  entry: CalendarCardEntry;
  /** Trigger — dibungkus `PopoverTrigger asChild`, jadi cukup elemen tunggal yang punya `onClick`/focus bawaan (mis. tombol/`role="button"`). */
  children: ReactNode;
}

/**
 * Popover ringkasan post saat klik item Calendar (T-033.8, KSP-02-F08,
 * ADR-090/ADR-091 — Popover click-triggered, BUKAN HoverCard, lihat
 * ADR-091 — dipertahankan penuh di migrasi T-101.1 ke shadcn `Popover`).
 * Acuan visual `components/popover.html` + wiring `openPostPopover` di
 * `templates/app-prototype/AppPrototype.dc.html` (Claude Design). State
 * `isOpen` lokal per kartu (bukan diangkat ke grid) — shadcn `Popover`
 * (Radix) uncontrolled-per-instance sudah cukup karena light-dismiss
 * (klik di luar) & Escape-dismiss aktif secara default, sama seperti
 * Astryx `Popover` sebelumnya — tidak butuh koordinasi "hanya satu
 * popover terbuka" karena klik kartu lain otomatis menutup yang sedang
 * terbuka lewat outside-click itu juga.
 *
 * Tidak ada thumbnail media asli — domain model (`PublishingPost`) belum
 * punya field media (lihat `CalendarItemRecord`), jadi placeholder di sini
 * permanen, bukan state loading.
 *
 * T-102 cleanup: `Badge` status/format dimigrasi ke shadcn (KI-041 masih
 * terbuka — lihat `status-badge.ts`), melengkapi komponen lain (`Popover`,
 * `Avatar`, `Divider`->`Separator`, `Button`, `Text`, layout) yang sudah
 * shadcn sejak T-101.1.
 *
 * T-090.5 (ADR-093) — varian `Imported` (read-only): LOCKED PATTERN
 * (`components/popover.html`, Claude Design, 2026-10-08, King Rezi
 * confirmed). Berbeda dari varian lain: (1) "Buka Draft Editor" DIHILANGKAN
 * total (bukan disabled) — post ini tidak berasal dari tool ini, jadi tidak
 * ada draft untuk diedit; (2) CTA satu-satunya adalah link "Lihat di
 * [Platform] →" ke `entry.platformPostUrl`; (3) baris catatan read-only
 * ditambahkan sebelum footer; (4) metrics block sengaja TIDAK ditampilkan
 * (post Imported belum tentu sudah disinkronkan Analytics, JOB-04 — beda
 * dari `Published` yang selalu lewat publish flow tool ini sendiri).
 */
export function CalendarPostPopover({
  entry,
  children,
}: CalendarPostPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { openEditDraft } = useDraftEditor();
  const platformLabel = PLATFORM_ICON[entry.platform].label;
  const isPublished = entry.status === ContentStatus.Published;
  const isImported = entry.status === ContentStatus.Imported;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        style={{ width: POPOVER_WIDTH }}
        aria-label={`Ringkasan post ${entry.accountHandle}`}
      >
        {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
          <div className="flex flex-col gap-0">
            <Text variant="small" as="span" className="font-bold">
              {entry.accountHandle}
            </Text>
            <Text variant="muted" as="span" className="text-xs">
              {platformLabel}
            </Text>
          </div>

          {/* `contentFormat` ditambahkan di sini (revisi keempat T-033, poin 5
              opsional) — info yang jadi icon-only di footer card mobile
              (≤768px) tetap punya representasi teks lengkap saat kartu
              di-tap. `flex-wrap` berjaga-jaga kalau lebar Avatar+2 Badge
              melebihi POPOVER_WIDTH di label status terpanjang. */}
          {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
          <div className="flex flex-wrap items-center gap-2">
            <Avatar className="size-6">
              <AvatarFallback className="text-xs">
                {getInitials(entry.accountHandle)}
              </AvatarFallback>
            </Avatar>
            <Badge variant="outline">
              {CONTENT_FORMAT_LABEL[entry.contentFormat]}
            </Badge>
            <Badge variant={CONTENT_STATUS_BADGE_VARIANT[entry.status]}>
              {CONTENT_STATUS_LABEL[entry.status]}
            </Badge>
          </div>

          <Text variant="p" as="span" className="mt-0! text-sm">
            {entry.caption || "(Tanpa caption)"}
          </Text>

          {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
          <div className="rounded-2xl bg-muted p-2">
            <Text variant="muted" as="span" className="text-xs">
              Media belum tersedia untuk preview
            </Text>
          </div>

          {isPublished && (
            // eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only
            <div className="flex flex-col gap-1">
              <Separator />
              {/* eslint-disable-next-line no-restricted-syntax -- T-101.1: layout-only */}
              <div className="flex flex-wrap gap-2">
                <MetricTile
                  label="Views"
                  value={
                    entry.metrics
                      ? formatMetricCount(entry.metrics.impressions)
                      : "–"
                  }
                />
                <MetricTile
                  label="Reach"
                  value={
                    entry.metrics ? formatMetricCount(entry.metrics.reach) : "–"
                  }
                />
                <MetricTile
                  label="Replies"
                  value={
                    entry.metrics
                      ? formatMetricCount(entry.metrics.comments)
                      : "–"
                  }
                />
                <MetricTile
                  label="Eng. Rate"
                  value={
                    entry.metrics
                      ? formatEngagementRate(entry.metrics.engagementRate)
                      : "–"
                  }
                />
              </div>
              {entry.platformPostUrl && (
                <a
                  href={entry.platformPostUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Text
                    variant="muted"
                    as="span"
                    className="text-xs text-primary"
                  >
                    Go to post →
                  </Text>
                </a>
              )}
            </div>
          )}

          {isImported ? (
            // eslint-disable-next-line no-restricted-syntax -- T-090.5: layout-only
            <div className="flex flex-col gap-1">
              <Text variant="muted" as="span" className="text-xs">
                Post ini diimpor dari {platformLabel}, tidak bisa diedit di
                sini.
              </Text>
              {entry.platformPostUrl ? (
                <Button variant="secondary" className="w-full" asChild>
                  <a
                    href={entry.platformPostUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Lihat di {platformLabel} →
                  </a>
                </Button>
              ) : (
                <Button variant="secondary" className="w-full" disabled>
                  Lihat di {platformLabel} →
                </Button>
              )}
            </div>
          ) : (
            <Button
              variant="default"
              className="w-full"
              onClick={() => {
                setIsOpen(false);
                openEditDraft(entry.postId);
              }}
            >
              Buka Draft Editor
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
