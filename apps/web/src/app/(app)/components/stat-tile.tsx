import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";

/**
 * `StatTile` — diekstrak dari `DashboardHome.tsx` (T-042.3) supaya bisa
 * dipakai ulang di Summary row `/analyze` (T-047.2) tanpa duplikasi
 * implementasi Card+heading metrik. Perilaku identik dengan definisi lokal
 * semula — pure extraction, bukan perubahan tampilan/behavior Dashboard
 * Home.
 */
export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent>
        {/* eslint-disable-next-line no-restricted-syntax -- T-101.5: layout-only, file sudah dimigrasi shadcn */}
        <div className="flex flex-col gap-2">
          <Text variant="muted">{label}</Text>
          <Text variant="h3" as="h2" className="mt-0 scroll-m-0">
            {value}
          </Text>
        </div>
      </CardContent>
    </Card>
  );
}
