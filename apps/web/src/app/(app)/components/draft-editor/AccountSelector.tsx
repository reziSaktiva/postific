import { Text } from "@/components/ui/text";

import { ChannelRow } from "./ChannelRow";
import type { ConnectedAccount } from "./form-shared";

/**
 * Bagian "Akun tujuan" di atas editor: judul dan baris channel (T-201). Blok
 * pengaturan per jaringan dirender terpisah di bawah editor oleh
 * `NetworkBlocks` (T-202.2).
 */
export function AccountSelector({
  accounts,
  isLoadingAccounts,
  selectedAccountIds,
  lastUsedAccountIds,
  onToggleAccount,
  onSetSelection,
}: {
  accounts: ConnectedAccount[];
  isLoadingAccounts: boolean;
  selectedAccountIds: string[];
  /** Akun yang dipakai sebelumnya (pintasan "Terakhir dipakai"); sumber datanya belum diputuskan (T-201.2). */
  lastUsedAccountIds?: string[];
  onToggleAccount: (account: ConnectedAccount, checked: boolean) => void;
  onSetSelection: (nextAccountIds: string[]) => void;
}) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex.
    <div className="flex flex-col gap-3">
      <Text variant="h4" as="h3">
        Akun tujuan
      </Text>
      {isLoadingAccounts ? (
        <Text variant="muted">Memuat akun terhubung…</Text>
      ) : accounts.length === 0 ? (
        <Text variant="muted">
          Belum ada akun terhubung untuk workspace ini.
        </Text>
      ) : (
        <ChannelRow
          accounts={accounts}
          selectedAccountIds={selectedAccountIds}
          lastUsedAccountIds={lastUsedAccountIds}
          onToggleAccount={onToggleAccount}
          onSetSelection={onSetSelection}
        />
      )}
    </div>
  );
}
