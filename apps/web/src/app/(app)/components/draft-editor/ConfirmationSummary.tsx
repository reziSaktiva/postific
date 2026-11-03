import { Alert, AlertTitle } from "@/components/ui/alert";
import { Text } from "@/components/ui/text";
import type { ContentFormat } from "@postific/shared";

import type {
  ConnectedAccount,
  FormNotice,
  PendingAction,
} from "./form-shared";
import { FORMAT_LABEL, PLATFORM_LABEL, getDefaultFormat } from "./form-shared";

/**
 * Ringkasan konfirmasi (UXP-04) yang dipakai bersama Schedule dan Publish Now
 * (KSP-05-F12, ADR-047) — hanya baris "Waktu" dan label tombol konfirmasi
 * (di `EditorFooter`) yang berbeda antar keduanya.
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
  return (
    // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex.
    <div className="flex flex-col gap-3">
      {notice?.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{notice.title}</AlertTitle>
        </Alert>
      ) : null}
      <Text>Caption: {caption || "(kosong)"}</Text>
      {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex. */}
      <div className="flex flex-col gap-1">
        <Text variant="muted">Akun:</Text>
        {selectedAccounts.map((account) => (
          <Text key={account.id}>
            · {PLATFORM_LABEL[account.platform]} {account.handle} —{" "}
            {
              FORMAT_LABEL[
                formatByAccount[account.id] ??
                  getDefaultFormat(account.platform)
              ]
            }
          </Text>
        ))}
      </div>
      {pendingAction === "publish-now" ? (
        <Text>Waktu: Sekarang</Text>
      ) : (
        <Text>
          Waktu: {scheduleDate ?? "-"} {scheduleTime ?? ""}
        </Text>
      )}
    </div>
  );
}
