import type { VariantProps } from "class-variance-authority";

import { ContentStatus } from "@postific/shared";

import type { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/**
 * Status → label mapping (components/status-chips.html, Claude Design).
 *
 * `[ContentStatus.Imported]` (T-090.5, ADR-093) — LOCKED PATTERN dikunci di
 * Claude Design 2026-10-08 (King Rezi confirmed): label "Imported", badge
 * neutral/gray — reuse token yang sama dengan `Draft`, BUKAN hue baru (lihat
 * `CONTENT_STATUS_BADGE_VARIANT` di bawah).
 */
export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  [ContentStatus.Draft]: "Draft",
  [ContentStatus.InReview]: "In Review",
  [ContentStatus.ReadyToSchedule]: "Ready to Schedule",
  [ContentStatus.Scheduled]: "Scheduled",
  [ContentStatus.Published]: "Published",
  [ContentStatus.Failed]: "Failed",
  [ContentStatus.Imported]: "Imported",
};

/**
 * Status → shadcn `Badge` variant (T-102 cleanup, ADR-097). `badge.tsx`
 * punya variant `warning` (token `--warning`, ADR-098) — dipakai di sini
 * untuk `InReview`/`Scheduled` supaya tetap beda warna dari
 * `Draft`/`ReadyToSchedule` yang berbagi tahap yang sama (code review PR
 * #105), bukan cuma beda label teks. `Published` memakai variant `success`
 * (token `--success`, ADR-098, di-wire ke `Badge` saat penutupan KI-051)
 * supaya konsisten dengan mockup Claude Design (`components/status-chips.html`).
 */
export const CONTENT_STATUS_BADGE_VARIANT: Record<ContentStatus, BadgeVariant> =
  {
    [ContentStatus.Draft]: "outline",
    [ContentStatus.InReview]: "warning",
    [ContentStatus.ReadyToSchedule]: "secondary",
    [ContentStatus.Scheduled]: "warning",
    [ContentStatus.Published]: "success",
    [ContentStatus.Failed]: "destructive",
    // T-090.5, ADR-093 — LOCKED PATTERN: `Imported` reuse variant `outline`
    // yang sama dengan `Draft` (neutral/gray token), bukan hue baru. Catatan
    // Claude Design (`components/status-chips.html`) menyebut "secondary"
    // sebagai padanan kode, tapi `Draft` di baseline ini sudah `outline`
    // (bukan `secondary`) — `outline` dipilih di sini supaya benar-benar
    // "share token dengan Draft" sesuai intent desain, bukan `secondary`
    // literal. Dilaporkan ke King Rezi sebagai penyesuaian kecil, bukan
    // deviasi pola yang perlu dikunci ulang.
    [ContentStatus.Imported]: "outline",
  };
