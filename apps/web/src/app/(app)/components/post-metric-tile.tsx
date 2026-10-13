import { Text } from "@/components/ui/text";

/**
 * `MetricTile` + formatter — diekstrak dari `CalendarPostPopover.tsx`
 * (T-033.8) supaya bisa dipakai ulang di halaman detail History (T-043.3)
 * tanpa duplikasi implementasi render metrik ringkas (mapping label yang
 * sama: Views→`impressions`, Reach→`reach`, Replies→`comments`, Eng.
 * Rate→`engagementRate`, lihat `readme.md` Claude Design T-033.8). Perilaku
 * identik dengan definisi lokal semula — pure extraction, bukan perubahan
 * tampilan/behavior Calendar Popover.
 */
export function formatMetricCount(value: number): string {
  return value.toLocaleString("id-ID");
}

export function formatEngagementRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- layout-only, konsisten pola shadcn+Tailwind lain
    <div className="flex w-16 flex-col gap-0">
      <Text variant="small" as="span" className="font-bold">
        {value}
      </Text>
      <Text variant="muted" as="span" className="text-xs">
        {label}
      </Text>
    </div>
  );
}
