import { useCallback, useState } from "react";
import {
  Clock01Icon,
  Film01Icon,
  Image01Icon,
  PinIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

import type {
  ConnectedAccountId,
  PostId,
  SocialPlatform,
} from "@postific/shared";
import { ContentFormat, ContentStatus } from "@postific/shared";

import type { PostMetricsRecord } from "@/domains/analytics";
import {
  effectiveCalendarDate,
  getDateParts,
  getHour,
  MS_PER_DAY,
  toDateKey,
  zonedMidnightUtc,
  type CalendarPostItem,
} from "@/domains/publishing";

/**
 * Util bersama untuk grid Week (T-033.3) & Month (T-033.4) — acuan visual
 * `templates/publish-calendar.html` (Claude Design). Kalender di **zona
 * waktu pengguna** (T-147; zona IANA selalu eksplisit, DST ikut), konsisten dengan
 * `getWeekRange`/`getMonthRange` (`@/domains/publishing`) dan pola
 * `formatGroupDateHeading` di `QueueList.tsx`.
 */

export { toDateKey };

export { MS_PER_DAY };

/**
 * Jumlah kolom hari grid Week & Month — 7 kolom sama lebar, responsive
 * mengikuti lebar container (`Grid columns={CALENDAR_DAY_COLUMNS}`, bukan
 * lagi lebar fixed px). Dipakai `CalendarWeekGrid`/`CalendarMonthGrid`
 * untuk header + body grid supaya kolom header dan body selalu sejajar
 * (revisi kedua T-033 — membatalkan `CALENDAR_COLUMN_WIDTH` fixed 200px
 * dari revisi sebelumnya).
 */
export const CALENDAR_DAY_COLUMNS = 7;

/**
 * Maks kartu tampil langsung per sel sebelum "+N More" (mockup: 3 +
 * "+1 More") — sama untuk grid Week & Month.
 */
export const MAX_VISIBLE_PER_CELL = 3;

/**
 * Class trigger kartu entry Calendar (T-101.1) — replikasi manual visual
 * `Card` (`components/ui/card.tsx`: `rounded-2xl bg-card ring-1
 * ring-foreground/10`) ditambah state interaktif (`p-1.5 text-left
 * transition-colors hover:bg-muted/50 focus-visible:*`), dipakai sebagai
 * `<button>` trigger tunggal `PopoverTrigger asChild`. Astryx
 * `ClickableCard` sebelumnya menyatukan ini dalam satu komponen; shadcn
 * belum punya padanan siap-pakai, jadi dipusatkan di sini (bukan
 * diduplikasi di `CalendarMonthGrid`/`CalendarWeekGrid`) supaya perubahan
 * visual kartu klik (ring, radius, hover) cukup diubah sekali.
 */
export const CALENDAR_ENTRY_BUTTON_CLASSNAME =
  "w-full rounded-2xl bg-card p-1.5 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/**
 * `ContentFormat` → label singkat untuk indikator compact di card Calendar
 * (revisi ketiga T-033, Month poin 7 / Week poin 5) — belum ada mapping
 * label existing untuk enum ini di codebase manapun, pola sama
 * `CONTENT_STATUS_LABEL` (`components/draft-editor/status-badge.ts`).
 */
export const CONTENT_FORMAT_LABEL: Record<ContentFormat, string> = {
  [ContentFormat.Post]: "Post",
  [ContentFormat.Reel]: "Reel",
  [ContentFormat.Story]: "Story",
  [ContentFormat.Pin]: "Pin",
};

/**
 * `ContentFormat` → icon untuk indikator compact footer card Calendar di
 * layar ≤768px (revisi keempat T-033 poin 3, dipertahankan T-102 cleanup)
 * — 2 `Badge` teks penuh (`CalendarEntryFooter`) overflow di kolom grid
 * Month/Week yang sempit (~50-90px per hari), jadi diganti icon+dot compact
 * di bawah breakpoint itu. Set icon dari `hugeicons` (ADR-148, T-169), dirender lewat
 * `HugeiconsIcon`.
 */
export const CONTENT_FORMAT_ICON: Record<ContentFormat, IconSvgElement> = {
  [ContentFormat.Post]: Image01Icon,
  [ContentFormat.Reel]: Film01Icon,
  [ContentFormat.Story]: Clock01Icon,
  [ContentFormat.Pin]: PinIcon,
};

/**
 * `ContentStatus` → warna dot compact (Tailwind class token-backed) untuk
 * indikator ≤768px (T-102 cleanup) — pengganti `StatusDot` Astryx (5 variant
 * `success|warning|error|accent|neutral`, sudah dihapus). KI-041: Stone
 * theme shadcn belum punya token success/warning/info/purple, jadi dot
 * dipetakan ke token yang SUDAH ADA, selaras dengan
 * `CONTENT_STATUS_BADGE_VARIANT` (`status-badge.ts`) supaya compact (mobile)
 * dan full (desktop) tidak mengarang 2 skema warna berbeda: `outline`→
 * `bg-muted-foreground`, `secondary`→`bg-foreground`, `default`→
 * `bg-primary`, `destructive`→`bg-destructive`.
 */
export const CONTENT_STATUS_DOT_CLASSNAME: Record<ContentStatus, string> = {
  [ContentStatus.Draft]: "bg-muted-foreground",
  [ContentStatus.InReview]: "bg-muted-foreground",
  [ContentStatus.ReadyToSchedule]: "bg-foreground",
  [ContentStatus.Scheduled]: "bg-foreground",
  [ContentStatus.Published]: "bg-primary",
  [ContentStatus.Failed]: "bg-destructive",
  // LOCKED PATTERN (T-090.5, ADR-093, 2026-10-08, King Rezi confirmed) — neutral,
  // reuse treatment Draft (lihat `CONTENT_STATUS_BADGE_VARIANT` di
  // `components/draft-editor/status-badge.ts`). `listCalendarPosts` TIDAK LAGI
  // meng-exclude `Imported` dari query default Calendar (filter dilonggarkan
  // setelah rancangan dikunci) — dot ini memang tampil by design sekarang.
  [ContentStatus.Imported]: "bg-muted-foreground",
};

/** Senin di index 0 — minggu mulai Senin (sama seperti `getWeekRange`). */
export const DAY_LABELS = [
  "Sen",
  "Sel",
  "Rab",
  "Kam",
  "Jum",
  "Sab",
  "Ming",
] as const;

/**
 * 24 label baris jam grid Week (revisi kedua T-033 — satu baris PER JAM,
 * bukan lagi di-bucket per 2 jam). Index = jam 0-23 (zona pengguna) (`entry.hour`
 * langsung, tanpa `Math.floor(hour / 2)`). Label teks cuma diisi di index
 * genap (jam genap); index ganjil string kosong `""` — barisnya tetap
 * render (bukan dihilangkan), cuma kolom label waktunya kosong, supaya
 * post jam ganjil (1 AM, 3 AM, dst) tidak numpuk 1 baris dengan jam genap
 * sebelumnya seperti sebelum revisi ini.
 */
export const WEEK_HOUR_LABELS = [
  "12 AM",
  "",
  "2 AM",
  "",
  "4 AM",
  "",
  "6 AM",
  "",
  "8 AM",
  "",
  "10 AM",
  "",
  "12 PM",
  "",
  "2 PM",
  "",
  "4 PM",
  "",
  "6 PM",
  "",
  "8 PM",
  "",
  "10 PM",
  "",
] as const;

/**
 * Class Tailwind border-kanan token-backed untuk pemisah vertikal antar
 * kolom hari grid Week & Month (revisi keenam T-033 — sebelumnya grid cuma
 * punya garis horizontal via `Divider variant="strong"` antar baris, tanpa
 * pemisah vertikal apapun antar kolom Sen/Sel/Rab/dst). `VStack`/`Card`
 * Astryx tidak punya prop border per-sisi (`astryx component VStack/Card
 * --dense` sudah dicek, tidak ada), jadi fallback Tailwind utility
 * token-backed sesuai urutan aturan `apps/web/.claude/CLAUDE.md`
 * ("component props first; else Tailwind utilities backed by tokens").
 *
 * Warna diganti di revisi ketujuh T-033 (poin 2) — sebelumnya
 * `border-border-strong` (`--color-border-emphasized`, sama dengan
 * `Divider variant="strong"` horizontal) terlihat terlalu tegas dibanding
 * border `Card`/`ClickableCard` post. Sekarang pakai `border-border` (tanpa
 * suffix) → `--color-border` di `tailwind-theme.css`
 * (`node_modules/@astryxdesign/core/src/tailwind-theme.css:87`,
 * `--color-border: var(--color-border)`), token PERSIS sama yang dipakai
 * `Card` untuk `borderColor` default
 * (`node_modules/@astryxdesign/core/src/Card/Card.tsx:93`,
 * `colorVars['--color-border']`) — diverifikasi lewat source CLI-terpin,
 * bukan tebakan. Garis HORIZONTAL (`Divider variant="strong"`) sengaja
 * TIDAK ikut berubah, tetap `--color-border-emphasized` seperti sebelumnya.
 *
 * Dipakai di HEADER (`DAY_LABELS`/hari) **dan** tiap baris body (week-row
 * Month, hour-row Week) dengan index kolom yang sama, supaya garis vertikal
 * tersambung dari atas ke bawah — bukan cuma sebagian baris. Kolom terakhir
 * (`CALENDAR_DAY_COLUMNS - 1`, kolom Minggu) sengaja `undefined` (tanpa
 * border kanan) supaya tidak ada garis nempel di tepi kanan card/grid.
 */
export function columnDividerClassName(
  columnIndex: number,
): string | undefined {
  return columnIndex === CALENDAR_DAY_COLUMNS - 1
    ? undefined
    : "border-r border-border";
}

/** Format jam (0-23) jadi label "HH:00" (mis. 7 → "07:00") — dipakai kartu Month (poin M2). */
export function formatCalendarHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * Geser `date` sejumlah hari KALENDER di `timeZone` dan kembalikan 00:00 hari
 * itu. Bukan `+ n * 24 jam`: pada hari DST (23/25 jam) tambah 24 jam
 * mendarat di tanggal yang salah.
 */
export function addDays(date: Date, days: number, timeZone: string): Date {
  const { year, month, day } = getDateParts(date, timeZone);
  return zonedMidnightUtc(year, month, day + days, timeZone);
}

/**
 * Geser `date` sejumlah bulan kalender di `timeZone`, dipatok ke tanggal 1 (bukan
 * mempertahankan tanggal-di-bulan) supaya aman dari overflow bulan
 * pendek — 31 Jan + 1 bulan via `Date.UTC` day-preserving akan lompat ke
 * 3 Maret, bukan akhir Februari. Anchor Calendar hanya perlu jatuh di
 * bulan yang benar (`getMonthRange`/`getWeekRange` yang menghitung rentang
 * sebenarnya), jadi tanggal-di-dalam-bulan tidak relevan di sini.
 */
export function addMonths(date: Date, months: number, timeZone: string): Date {
  const { year, month } = getDateParts(date, timeZone);
  return zonedMidnightUtc(year, month + months, 1, timeZone);
}

/**
 * Satu kartu post di grid — **satu kartu per target** (bukan per post),
 * supaya post multi-platform tampil sebagai beberapa kartu granular sesuai
 * mockup (`item.targets.map(...)` per kartu).
 */
export interface CalendarCardEntry {
  key: string;
  postId: PostId;
  connectedAccountId: ConnectedAccountId;
  caption: string;
  status: ContentStatus;
  platform: SocialPlatform;
  /** Post/Reel/Story/Pin (revisi ketiga T-033) — label lewat `CONTENT_FORMAT_LABEL`. */
  contentFormat: ContentFormat;
  accountHandle: string;
  /** Kalender "YYYY-MM-DD" (zona pengguna) dari tanggal efektif (`scheduledAt ?? publishedAt`). */
  dateKey: string;
  /** Jam (0-23, zona pengguna) dari tanggal efektif — dipakai grid Week untuk bucket per jam. */
  hour: number;
  /**
   * Metrik untuk TARGET INI SAJA (T-033.8, Popover KSP-02-F08) — dicocokkan
   * dari `CalendarPostItem.metrics` (array per akun/platform milik post)
   * lewat `connectedAccountId`, bukan array mentah. `null` untuk post
   * non-Published (`item.metrics === null`, tidak pernah di-fetch) MAUPUN
   * post Published yang belum punya baris metrik untuk target ini
   * (`item.metrics` ada tapi tidak match) — Popover membedakan status lewat
   * `entry.status`, bukan lewat `metrics`.
   */
  metrics: PostMetricsRecord | null;
  /** `PublishingPostTarget.platformPostUrl` — tautan "Go to post" (Popover), null kalau belum dilaporkan Outstand. */
  platformPostUrl: string | null;
}

/**
 * Ratakan `CalendarPostItem[]` jadi kartu per target, dengan tanggal
 * efektif dihitung lewat `effectiveCalendarDate` (`@/domains/publishing`
 * — satu-satunya sumber aturan "tanggal efektif", sama yang dipakai
 * `sortCalendarItemsByEffectiveDate`, termasuk fallback `createdAt`-nya).
 * Item tanpa target dilewati (post tanpa `targets` tidak punya kartu untuk
 * ditampilkan).
 *
 * `connectedAccountIds` (opsional, array kosong = tanpa filter) dicocokkan
 * ULANG per target di sini — filter Channels di repository (`listCalendarPosts`)
 * hanya mensyaratkan post punya SALAH SATU target yang cocok (`targets: {
 * some: {...} }`), jadi tanpa re-filter ini target lain milik post yang sama
 * (mis. akun Facebook post multi-platform) tetap ikut tampil walau tidak
 * dipilih di filter Channels.
 */
export function flattenCalendarItemsToEntries(
  items: CalendarPostItem[],
  timeZone: string,
  connectedAccountIds: readonly ConnectedAccountId[] = [],
): CalendarCardEntry[] {
  const entries: CalendarCardEntry[] = [];

  for (const item of items) {
    const effectiveDate = effectiveCalendarDate(item);
    const dateKey = toDateKey(effectiveDate, timeZone);
    // Jam di zona pengguna (T-147), bukan jam lokal browser — tanggal dan jam kartu satu
    // zona dengan kunci grup supaya tidak pernah beda hari.
    const hour = getHour(effectiveDate, timeZone);

    for (const target of item.targets) {
      if (
        connectedAccountIds.length > 0 &&
        !connectedAccountIds.includes(target.connectedAccountId)
      ) {
        continue;
      }

      entries.push({
        key: `${item.id}-${target.id}`,
        postId: item.id,
        connectedAccountId: target.connectedAccountId,
        caption: item.caption,
        status: item.status,
        platform: target.platform,
        contentFormat: target.contentFormat,
        accountHandle: target.accountHandle,
        dateKey,
        hour,
        metrics:
          item.metrics?.find(
            (metric) => metric.connectedAccountId === target.connectedAccountId,
          ) ?? null,
        platformPostUrl: target.platformPostUrl,
      });
    }
  }

  return entries;
}

/**
 * State expand/collapse "+N More" per sel (Month: `dateKey`, Week: `cellKey`)
 * — logic identik dipakai `CalendarMonthGrid`/`CalendarWeekGrid`, sebelumnya
 * duplikat verbatim di kedua file (beda cuma nama variabel).
 */
export function useExpandableKeys() {
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const toggle = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  return { expandedKeys, toggle };
}
