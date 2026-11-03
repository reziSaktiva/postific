import type { ContentFormat } from "@postific/shared";

import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";

import { ChannelRow } from "./ChannelRow";
import type { ConnectedAccount, PinterestBoardState } from "./form-shared";
import { NetworkBlock } from "./NetworkBlock";

export function AccountSelector({
  accounts,
  isLoadingAccounts,
  selectedAccountIds,
  formatByAccount,
  onToggleAccount,
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
  onToggleAccount: (account: ConnectedAccount, checked: boolean) => void;
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
        Account Selector
      </Text>
      {isLoadingAccounts ? (
        <Text variant="muted">Memuat akun terhubung…</Text>
      ) : accounts.length === 0 ? (
        <Text variant="muted">
          Belum ada akun terhubung untuk workspace ini.
        </Text>
      ) : (
        accounts.map((account) => {
          const isChecked = selectedAccountIds.includes(account.id);
          const checkboxId = `draft-account-${account.id}`;

          return (
            // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex.
            <div key={account.id} className="flex flex-col gap-2">
              <ChannelRow
                account={account}
                checkboxId={checkboxId}
                isChecked={isChecked}
                onToggle={onToggleAccount}
              />
              <NetworkBlock
                account={account}
                checkboxId={checkboxId}
                isChecked={isChecked}
                currentFormat={formatByAccount[account.id]}
                onFormatChange={(format) => onFormatChange(account.id, format)}
                pinterest={{
                  pinTitle,
                  pinLink,
                  onPinTitleChange,
                  onPinLinkChange,
                  boardState: pinterestBoardsByAccount[account.id],
                  boardId: boardIdByAccount[account.id],
                  onBoardChange: (boardId) =>
                    onBoardChange(account.id, boardId),
                  onRetryBoards: () => onRetryBoards(account.id),
                }}
              />
              <Separator />
            </div>
          );
        })
      )}
    </div>
  );
}
