import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "@/components/ui/badge";

import {
  CONTENT_STATUS_BADGE_VARIANT,
  CONTENT_STATUS_LABEL,
} from "../../../components/draft-editor/status-badge";
import {
  type CalendarCardEntry,
  CONTENT_FORMAT_ICON,
  CONTENT_FORMAT_LABEL,
  CONTENT_STATUS_DOT_CLASSNAME,
} from "./calendar-grid-shared";

export interface CalendarEntryFooterProps {
  entry: Pick<CalendarCardEntry, "status" | "contentFormat">;
}

/**
 * Footer status/format kartu Calendar (revisi keempat T-033 poin 2-3) —
 * dipakai `CalendarMonthGrid`/`CalendarWeekGrid`, sebelumnya duplikat
 * verbatim di kedua file. ≤768px 2 `Badge` teks overflow di kolom grid
 * yang sempit (breakpoint sama dengan AppShell mobile nav, `md: 768` di
 * `AppShell.tsx`) — diganti dot+icon compact di bawah 768px, 2 Badge tetap
 * seperti semula di >768px. CSS murni (Tailwind `md:`), bukan JS
 * resize-hook. Detail lengkap tetap ada lewat tap kartu → `CalendarPostPopover`.
 *
 * T-102 cleanup (ADR-097): `Badge`/dot compact dimigrasi penuh ke shadcn +
 * Tailwind (`calendar-grid-shared.ts` — `CONTENT_FORMAT_ICON`,
 * `CONTENT_STATUS_DOT_CLASSNAME`), menggantikan `StatusDot`/`Icon` Astryx.
 * KI-041 (token warna semantik) masih terbuka — dot dipetakan ke token yang
 * sudah ada, sama seperti `CONTENT_STATUS_BADGE_VARIANT`, bukan warna baru.
 */
export function CalendarEntryFooter({ entry }: CalendarEntryFooterProps) {
  const FormatIcon = CONTENT_FORMAT_ICON[entry.contentFormat];

  return (
    <>
      {/* eslint-disable-next-line no-restricted-syntax -- T-102: layout-only, murni Tailwind flex. */}
      <div className="flex items-center gap-1.5 md:hidden">
        <span
          className={`inline-block size-1.5 shrink-0 rounded-full ${CONTENT_STATUS_DOT_CLASSNAME[entry.status]}`}
          role="img"
          aria-label={CONTENT_STATUS_LABEL[entry.status]}
          title={CONTENT_STATUS_LABEL[entry.status]}
        />
        <span title={CONTENT_FORMAT_LABEL[entry.contentFormat]}>
          <HugeiconsIcon
            icon={FormatIcon}
            className="size-3 shrink-0 text-muted-foreground"
            aria-label={CONTENT_FORMAT_LABEL[entry.contentFormat]}
          />
        </span>
      </div>
      {/* eslint-disable-next-line no-restricted-syntax -- T-102: layout-only, murni Tailwind flex. */}
      <div className="hidden flex-wrap items-center gap-1 md:flex">
        <Badge variant="outline">
          {CONTENT_FORMAT_LABEL[entry.contentFormat]}
        </Badge>
        <Badge variant={CONTENT_STATUS_BADGE_VARIANT[entry.status]}>
          {CONTENT_STATUS_LABEL[entry.status]}
        </Badge>
      </div>
    </>
  );
}
