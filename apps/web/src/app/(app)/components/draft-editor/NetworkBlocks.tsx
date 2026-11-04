import type { ContentFormat } from "@postific/shared";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Text } from "@/components/ui/text";

import type { DraftMediaDto } from "./actions";
import type { ConnectedAccount, PinterestBoardState } from "./form-shared";
import { getDefaultFormat } from "./form-shared";
import { NetworkBlockBody, NetworkBlockSummary } from "./NetworkBlock";
import { summarizeBlockIssues } from "./network-blocks-state";
import type { NetworkIssue } from "./network-validation";

/**
 * Pengaturan per jaringan di bawah editor (T-202.2, ADR-155). Satu akun
 * terpilih: blok selalu terbuka tanpa akordeon. Dua akun atau lebih:
 * akordeon dengan satu blok terbuka, lainnya baris ringkas. Caption dan media
 * sama untuk semua jaringan.
 */
export function NetworkBlocks({
  accounts,
  activeAccountId,
  onActiveAccountChange,
  formatByAccount,
  onFormatChange,
  caption,
  mediaItems,
  issuesByAccount,
  pinTitle,
  pinLink,
  onPinTitleChange,
  onPinLinkChange,
  boardIdByAccount,
  pinterestBoardsByAccount,
  onBoardChange,
  onRetryBoards,
}: {
  /** Akun terpilih, urutan tampil. */
  accounts: ConnectedAccount[];
  activeAccountId: string | undefined;
  onActiveAccountChange: (accountId: string) => void;
  formatByAccount: Record<string, ContentFormat>;
  onFormatChange: (accountId: string, format: ContentFormat) => void;
  caption: string;
  mediaItems: DraftMediaDto[];
  issuesByAccount: Record<string, NetworkIssue[]>;
  pinTitle: string;
  pinLink: string;
  onPinTitleChange: (value: string) => void;
  onPinLinkChange: (value: string) => void;
  boardIdByAccount: Record<string, string | undefined>;
  pinterestBoardsByAccount: Record<string, PinterestBoardState>;
  onBoardChange: (accountId: string, boardId: string | undefined) => void;
  onRetryBoards: (accountId: string) => void;
}) {
  if (accounts.length === 0) {
    return null;
  }

  function renderBody(account: ConnectedAccount) {
    return (
      <NetworkBlockBody
        account={account}
        checkboxId={`draft-account-${account.id}`}
        currentFormat={formatByAccount[account.id]}
        onFormatChange={(format) => onFormatChange(account.id, format)}
        mediaItems={mediaItems}
        issues={issuesByAccount[account.id] ?? []}
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
    );
  }

  function warningOf(account: ConnectedAccount) {
    return summarizeBlockIssues(issuesByAccount[account.id]);
  }

  function formatOf(account: ConnectedAccount) {
    return formatByAccount[account.id] ?? getDefaultFormat(account.platform);
  }

  const single = accounts.length === 1 ? accounts[0] : undefined;

  return (
    <section className="flex flex-col gap-2" aria-labelledby="draft-networks">
      {/* eslint-disable-next-line no-restricted-syntax -- T-202: baris judul seksi, murni Tailwind flex. */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Text variant="h4" as="h3" id="draft-networks">
          Pengaturan per jaringan
        </Text>
        <Text variant="muted">Caption dan media sama untuk semua jaringan</Text>
      </div>

      {single ? (
        // eslint-disable-next-line no-restricted-syntax -- T-202: blok tunggal tanpa akordeon, kerangka sama dengan item akordeon.
        <div className="flex flex-col gap-3 rounded-2xl border bg-muted/50 p-4">
          <NetworkBlockSummary
            account={single}
            format={formatOf(single)}
            caption={caption}
            mediaCount={mediaItems.length}
            showPreview={false}
            warningMessage={warningOf(single)}
          />
          {renderBody(single)}
        </div>
      ) : (
        <Accordion
          type="single"
          value={activeAccountId}
          onValueChange={(value) => {
            // Satu blok selalu terbuka: klik pada blok yang sudah terbuka
            // mengirim nilai kosong, abaikan.
            if (value) {
              onActiveAccountChange(value);
            }
          }}
        >
          {accounts.map((account) => {
            const isOpen = account.id === activeAccountId;
            return (
              <AccordionItem key={account.id} value={account.id}>
                <AccordionTrigger className="items-center">
                  <NetworkBlockSummary
                    account={account}
                    format={formatOf(account)}
                    caption={caption}
                    mediaCount={mediaItems.length}
                    showPreview={!isOpen}
                    warningMessage={warningOf(account)}
                  />
                </AccordionTrigger>
                <AccordionContent>{renderBody(account)}</AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </section>
  );
}
