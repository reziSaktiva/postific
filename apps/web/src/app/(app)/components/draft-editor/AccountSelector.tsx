import type { ContentFormat } from "@postific/shared";

import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";

import { resolveSelectedAccounts } from "./account-selection";
import { ChannelRow } from "./ChannelRow";
import type { ConnectedAccount, PinterestBoardState } from "./form-shared";
import { PLATFORM_LABEL } from "./form-shared";
import { NetworkBlock } from "./NetworkBlock";

export function AccountSelector({
  accounts,
  isLoadingAccounts,
  selectedAccountIds,
  formatByAccount,
  lastUsedAccountIds,
  onToggleAccount,
  onSetSelection,
  onFormatChange,
  pinTitle,
  pinLink,
  onPinTitleChange,
  onPinLinkChange,
  boardIdByAccount,
  pinterestBoardsByAccount,
  onBoardChange,
  onRetryBoards,
}: {
  accounts: ConnectedAccount[];
  isLoadingAccounts: boolean;
  selectedAccountIds: string[];
  formatByAccount: Record<string, ContentFormat>;
  /** Akun yang dipakai sebelumnya (pintasan "Terakhir dipakai"); sumber datanya belum diputuskan (T-201.2). */
  lastUsedAccountIds?: string[];
  onToggleAccount: (account: ConnectedAccount, checked: boolean) => void;
  onSetSelection: (nextAccountIds: string[]) => void;
  onFormatChange: (accountId: string, format: ContentFormat) => void;
  pinTitle: string;
  pinLink: string;
  onPinTitleChange: (value: string) => void;
  onPinLinkChange: (value: string) => void;
  boardIdByAccount: Record<string, string | undefined>;
  pinterestBoardsByAccount: Record<string, PinterestBoardState>;
  onBoardChange: (accountId: string, boardId: string | undefined) => void;
  onRetryBoards: (accountId: string) => void;
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
      {resolveSelectedAccounts(accounts, selectedAccountIds).map((account) => (
        // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex.
        <div key={account.id} className="flex flex-col gap-2">
          <Text variant="small">
            {PLATFORM_LABEL[account.platform]} {account.handle}
          </Text>
          <NetworkBlock
            account={account}
            checkboxId={`draft-account-${account.id}`}
            isChecked
            currentFormat={formatByAccount[account.id]}
            onFormatChange={(format) => onFormatChange(account.id, format)}
            pinterest={{
              pinTitle,
              pinLink,
              onPinTitleChange,
              onPinLinkChange,
              boardState: pinterestBoardsByAccount[account.id],
              boardId: boardIdByAccount[account.id],
              onBoardChange: (boardId) => onBoardChange(account.id, boardId),
              onRetryBoards: () => onRetryBoards(account.id),
            }}
          />
          <Separator />
        </div>
      ))}
    </div>
  );
}
