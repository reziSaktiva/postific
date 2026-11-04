"use client";

import type { ContentFormat } from "@postific/shared";

import { ChannelAvatarBadge } from "@/components/shared/ChannelAvatarBadge";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";

import type {
  ConnectedAccount,
  FormNotice,
  PendingAction,
} from "./form-shared";
import { FORMAT_LABEL, PLATFORM_LABEL, getDefaultFormat } from "./form-shared";
import { formatScheduleSummary } from "./schedule-label";

/**
 * Ringkasan konfirmasi (UXP-04) yang dipakai bersama Schedule dan Publish Now
 * (KSP-05-F12, ADR-047) — hanya baris "Waktu" dan label tombol konfirmasi
 * (di `EditorFooter`) yang berbeda antar keduanya. Tampil di kolom kiri;
 * panel Pratinjau tetap terlihat di kanan (T-205.5, ADR-155 addendum B.5).
 */
export function ConfirmationSummary({
  pendingAction,
  notice,
  caption,
  selectedAccounts,
  formatByAccount,
  scheduleDate,
  scheduleTime,
}: {
  pendingAction: Exclude<PendingAction, null>;
  notice: FormNotice | null;
  caption: string;
  selectedAccounts: ConnectedAccount[];
  formatByAccount: Record<string, ContentFormat>;
  scheduleDate: string | undefined;
  scheduleTime: string | undefined;
}) {
  const timeZone = useUserTimeZone();

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-205: susunan vertikal ringkasan, murni Tailwind flex.
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {notice?.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{notice.title}</AlertTitle>
        </Alert>
      ) : null}
      <dl
        aria-label="Ringkasan konfirmasi"
        className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card text-sm"
      >
        {/* eslint-disable-next-line no-restricted-syntax -- T-205: baris dua kolom ringkasan, murni Tailwind grid. */}
        <div className="flex gap-3 px-4 py-3.5">
          <dt className="w-24 shrink-0 text-muted-foreground">Caption</dt>
          <dd className="min-w-0 flex-1 break-words whitespace-pre-wrap">
            {caption || "(kosong)"}
          </dd>
        </div>
        {/* eslint-disable-next-line no-restricted-syntax -- T-205: baris dua kolom ringkasan, murni Tailwind grid. */}
        <div className="flex gap-3 px-4 py-3.5">
          <dt className="w-24 shrink-0 text-muted-foreground">Akun</dt>
          <dd className="flex min-w-0 flex-1 flex-col gap-1">
            {selectedAccounts.map((account) => (
              // eslint-disable-next-line no-restricted-syntax -- T-205: baris akun, murni Tailwind flex.
              <div key={account.id} className="flex items-center gap-2.5 py-1">
                <ChannelAvatarBadge
                  handle={account.handle}
                  platform={account.platform}
                />
                <span className="min-w-0 flex-1 truncate">
                  {PLATFORM_LABEL[account.platform]} {account.handle}
                </span>
                <Badge variant="outline">
                  {
                    FORMAT_LABEL[
                      formatByAccount[account.id] ??
                        getDefaultFormat(account.platform)
                    ]
                  }
                </Badge>
              </div>
            ))}
          </dd>
        </div>
        {/* eslint-disable-next-line no-restricted-syntax -- T-205: baris dua kolom ringkasan, murni Tailwind grid. */}
        <div className="flex gap-3 px-4 py-3.5">
          <dt className="w-24 shrink-0 text-muted-foreground">Waktu</dt>
          <dd className="min-w-0 flex-1 font-medium">
            {pendingAction === "publish-now"
              ? "Sekarang"
              : formatScheduleSummary(scheduleDate, scheduleTime, timeZone)}
          </dd>
        </div>
      </dl>
      {pendingAction === "publish-now" ? (
        <p className="text-xs text-muted-foreground">
          Publish Now tayang langsung ke semua akun di atas.
        </p>
      ) : null}
    </div>
  );
}
