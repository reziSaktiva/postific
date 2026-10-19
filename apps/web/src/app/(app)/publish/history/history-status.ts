import type { VariantProps } from "class-variance-authority";

import { ContentStatus } from "@postific/shared";
import type { PublishingPostTargetStatus } from "@/domains/publishing";
import type { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/**
 * Label status untuk History (T-034.2/.3, KSP-D10) — SENGAJA terpisah dari
 * `CONTENT_STATUS_LABEL` (`components/draft-editor/status-badge.ts`), yang
 * memakai label "Failed" untuk `ContentStatus.Failed` (dipakai Calendar,
 * Drafts, dst.). Desain History yang sudah dikonfirmasi King Rezi
 * (2026-09-08, Claude Design `templates/publish-history.html`) memakai
 * istilah "Error" — mengubah `CONTENT_STATUS_LABEL` langsung akan
 * berdampak ke layar lain yang sudah disetujui (Calendar filter, dsb),
 * jadi override lokal di sini saja. `HistoryItemRecord.status` berisi
 * `Published`/`Failed`/`Imported` (invariant `HISTORY_TERMINAL_STATUSES`,
 * T-126 menambahkan `Imported` 2026-10-19).
 */
export const HISTORY_STATUS_LABEL: Record<ContentStatus, string> = {
  [ContentStatus.Draft]: "Draft",
  [ContentStatus.InReview]: "In Review",
  [ContentStatus.ReadyToSchedule]: "Ready to Schedule",
  [ContentStatus.Scheduled]: "Scheduled",
  [ContentStatus.Published]: "Published",
  [ContentStatus.Failed]: "Error",
  // T-126 (2026-10-19) — reuse badge "Imported" yang sudah LOCKED di
  // Calendar/Popover (T-090.5, ADR-093), dikonfirmasi King Rezi untuk
  // History juga. Bukan lagi placeholder exhaustiveness semata.
  [ContentStatus.Imported]: "Imported",
};

/**
 * Badge variant untuk chip status post-level History — reuse konvensi
 * `CONTENT_STATUS_BADGE_VARIANT` (Published → `success`, Failed →
 * `destructive`). Varian shadcn `Badge` "success" (token `--success`,
 * ADR-098) sudah di-wire ke `components/ui/badge.tsx` saat penutupan
 * KI-051 — dipakai di sini supaya chip "Published" tampil hijau sesuai
 * mockup Claude Design (`components/status-chips.html`).
 */
export const HISTORY_STATUS_BADGE_VARIANT: Record<ContentStatus, BadgeVariant> =
  {
    [ContentStatus.Draft]: "outline",
    [ContentStatus.InReview]: "warning",
    [ContentStatus.ReadyToSchedule]: "secondary",
    [ContentStatus.Scheduled]: "warning",
    [ContentStatus.Published]: "success",
    [ContentStatus.Failed]: "destructive",
    // T-126 — reuse variant `outline` yang sama dengan badge Imported di
    // Calendar (T-090.5), lihat catatan di `HISTORY_STATUS_LABEL`.
    [ContentStatus.Imported]: "outline",
  };

/** Label status per-target (`HistoryItemTargetRecord.status`, T-034.1) — dipakai section "Hasil per Akun" (T-034.3). */
export const TARGET_STATUS_LABEL: Record<PublishingPostTargetStatus, string> = {
  pending: "Menunggu",
  scheduled: "Terjadwal",
  published: "Published",
  failed: "Error",
};

/** Badge variant per-target — sama konvensi `HISTORY_STATUS_BADGE_VARIANT`. */
export const TARGET_STATUS_BADGE_VARIANT: Record<
  PublishingPostTargetStatus,
  BadgeVariant
> = {
  pending: "outline",
  scheduled: "warning",
  published: "success",
  failed: "destructive",
};
