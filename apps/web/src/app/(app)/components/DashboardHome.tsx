"use client";

// Dashboard Home — Analytics Snapshot (T-042.3–T-042.5, KSP-01-F04).
//
// Client Component kecil yang hanya mengurus state `period` (weekly/
// monthly) dan re-fetch lewat Server Action `getDashboardSummaryAction`
// saat selector diganti — polanya sama seperti komponen client lain di
// `(app)/` yang menerima initial data dari Server Component induk
// (`page.tsx`) lalu mengelola interaktivitas di sini.
//
// Astryx: tidak ada komponen Chart (dikonfirmasi T-042.1 via
// `astryx docs chart` — kosong; dicek ulang di sesi ini via
// `astryx component BarChart`/`MetricCard` — juga tidak ada, keduanya cuma
// contoh lokal di template `dashboard` yang memakai `recharts`, bukan
// bagian dari 153 komponen inti). Representasi visual metrik (T-042.3)
// karena itu memakai `ProgressBar` (komponen inti, real) untuk
// `avgEngagementRate` — bukan menambah library chart baru.
//
// Migrasi shadcn/ui (T-101.5, ADR-097): Astryx `VStack`/`HStack`/`Heading`/
// `Text`/`Selector`/`Card`/`EmptyState`/`Grid`/`Section`/`ProgressBar`
// diganti Tailwind flex/grid + `<h1>`/`<h2>` raw (pola sama
// `PublishPageHeader.tsx` T-101.4) + shadcn `Text`, `Select`
// (`CalendarToolbar.tsx` T-101.1), `Card`/`CardContent`, `Empty`/
// `EmptyHeader`/`EmptyTitle`/`EmptyDescription` (`DraftsList.tsx` T-101.3),
// dan `Progress` (baru di-install, registry `@shadcn/progress` — belum ada
// komponen ini sebelumnya). Radix `Progress` tidak punya value-label
// formatting bawaan seperti Astryx `ProgressBar`
// (`hasValueLabel`/`formatValueLabel`) — label persentase ("6.5%")
// dirender manual sebagai `Text` di atas komponen `Progress`. `Section`
// Astryx tidak punya padanan shadcn — dihapus jadi `<div>` Tailwind polos
// (pola sama `layout.tsx` T-101.4). State `period`/`useTransition`/Server
// Action `getDashboardSummaryAction`/guard `latestRequestedPeriod` TIDAK
// diubah — murni migrasi presentasi.
//
// Catatan KI-036 (technical debt terpisah, di luar scope migrasi UI ini):
// dashboard fetch lewat Server Action `getDashboardSummaryAction`
// menyimpang dari RS-D02 (seharusnya Server Component + revalidate) —
// tidak disentuh di sini, murni migrasi UI library.

import { useRef, useState, useTransition } from "react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Text } from "@/components/ui/text";

import { getDashboardSummaryAction } from "../dashboard-actions";
import { StatTile } from "./stat-tile";

import type { DashboardSummary, SnapshotPeriod } from "@/domains/analytics";

const PERIOD_OPTIONS: Array<{ value: SnapshotPeriod; label: string }> = [
  { value: "weekly", label: "Mingguan" },
  { value: "monthly", label: "Bulanan" },
];

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function DashboardHome({
  initialPeriod,
  initialSummary,
}: {
  initialPeriod: SnapshotPeriod;
  initialSummary: DashboardSummary | null;
}) {
  const [period, setPeriod] = useState<SnapshotPeriod>(initialPeriod);
  const [summary, setSummary] = useState<DashboardSummary | null>(
    initialSummary,
  );
  const [isPending, startTransition] = useTransition();
  // Guards against out-of-order responses: only the reply to the most
  // recently requested period is allowed to update `summary`.
  const latestRequestedPeriod = useRef<SnapshotPeriod>(initialPeriod);

  function handlePeriodChange(value: string) {
    const nextPeriod = value as SnapshotPeriod;
    setPeriod(nextPeriod);
    latestRequestedPeriod.current = nextPeriod;
    startTransition(async () => {
      const result = await getDashboardSummaryAction(nextPeriod);
      if (latestRequestedPeriod.current === nextPeriod) {
        setSummary(result);
      }
    });
  }

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-101.5: layout-only, file sudah dimigrasi shadcn
    <div className="flex flex-col gap-6">
      {/* eslint-disable-next-line no-restricted-syntax -- T-101.5: layout-only */}
      <div className="flex items-center justify-between gap-4">
        {/* eslint-disable-next-line no-restricted-syntax -- T-101.5: layout-only */}
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Home
          </h1>
          <Text variant="muted">Ringkasan performa konten</Text>
        </div>
        <Select
          value={period}
          onValueChange={handlePeriodChange}
          disabled={isPending}
        >
          <SelectTrigger aria-label="Rentang waktu" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* eslint-disable-next-line no-restricted-syntax -- T-101.5: layout-only */}
      <div className="flex flex-col gap-4">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Analytics Snapshot
        </h2>

        {summary === null ? (
          <Card>
            <CardContent>
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Belum ada data metrik</EmptyTitle>
                  <EmptyDescription>
                    Snapshot untuk rentang waktu ini belum tersedia. Data akan
                    muncul setelah sinkronisasi metrik berjalan.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        ) : (
          // eslint-disable-next-line no-restricted-syntax -- T-101.5: layout-only
          <div className="flex flex-col gap-4">
            {/* eslint-disable-next-line no-restricted-syntax -- T-101.5: layout-only */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatTile
                label="Post terpublikasi"
                value={summary.totalPosts.toLocaleString("id-ID")}
              />
              <StatTile
                label="Total engagement"
                value={summary.totalEngagements.toLocaleString("id-ID")}
              />
              <StatTile
                label="Akun aktif"
                value={summary.activeAccounts.toLocaleString("id-ID")}
              />
            </div>

            <Card>
              <CardContent>
                {/* eslint-disable-next-line no-restricted-syntax -- T-101.5: layout-only */}
                <div className="flex flex-col gap-3">
                  {/* eslint-disable-next-line no-restricted-syntax -- T-101.5: layout-only */}
                  <div className="flex items-center justify-between gap-2">
                    <Text variant="small" as="span" className="font-medium">
                      Rata-rata engagement rate
                    </Text>
                    <Text variant="small" as="span" className="font-medium">
                      {formatPercentage(summary.avgEngagementRate)}
                    </Text>
                  </div>
                  <Progress
                    value={Math.min(summary.avgEngagementRate * 100, 100)}
                    aria-label="Rata-rata engagement rate"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
