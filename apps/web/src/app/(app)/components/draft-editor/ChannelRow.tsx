"use client";

import {
  Add01Icon,
  Alert02Icon,
  Cancel01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import NextLink from "next/link";
import { useState } from "react";

import { ChannelAvatarBadge } from "@/components/shared/ChannelAvatarBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import {
  areAllConnectedSelected,
  filterAccountsByQuery,
  getConnectionStatus,
  resolveLastUsedIds,
  resolveSelectedAccounts,
  selectAllConnectedIds,
} from "./account-selection";
import type { ConnectedAccount } from "./form-shared";
import { PLATFORM_LABEL } from "./form-shared";

const CONNECTED_ACCOUNTS_HREF = "/settings/connected-accounts";

/**
 * Baris channel di atas editor (T-201, ADR-155): tombol Channels membuka
 * popover pemilihan akun; pintasan "Terakhir dipakai" dan "Semua" saat belum
 * ada pilihan; setelah ada pilihan baris menjadi chip avatar plus
 * "+ Tambah akun". Semua perhitungan di klien, tanpa request jaringan.
 */
export function ChannelRow({
  accounts,
  selectedAccountIds,
  lastUsedAccountIds,
  onToggleAccount,
  onSetSelection,
}: {
  accounts: ConnectedAccount[];
  selectedAccountIds: string[];
  /** Id akun yang dipakai sebelumnya; kosong atau tidak diisi menyembunyikan pintasan. */
  lastUsedAccountIds?: string[];
  onToggleAccount: (account: ConnectedAccount, checked: boolean) => void;
  onSetSelection: (nextAccountIds: string[]) => void;
}) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const selectedAccounts = resolveSelectedAccounts(
    accounts,
    selectedAccountIds,
  );
  const hasSelection = selectedAccounts.length > 0;
  const lastUsedIds = resolveLastUsedIds(accounts, lastUsedAccountIds ?? []);
  const connectedIds = selectAllConnectedIds(accounts);

  const trigger = (
    <Button
      type="button"
      variant={hasSelection ? "ghost" : "outline"}
      size="sm"
      aria-haspopup="listbox"
    >
      <HugeiconsIcon
        icon={Add01Icon}
        strokeWidth={2}
        data-icon="inline-start"
      />
      {hasSelection ? "Tambah akun" : "Channels"}
    </Button>
  );

  return (
    // eslint-disable-next-line no-restricted-syntax -- ADR-155: baris chip, murni komposisi Tailwind flex.
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid="channel-row"
    >
      {hasSelection
        ? selectedAccounts.map((account) => {
            const isDisconnected =
              getConnectionStatus(account) === "disconnected";
            return (
              <span
                key={account.id}
                data-testid="channel-chip"
                className={cn(
                  "inline-flex h-9 max-w-full items-center gap-2 rounded-full border bg-input/30 px-1 text-sm",
                  isDisconnected && "border-warning",
                )}
              >
                <ChannelAvatarBadge
                  handle={account.handle}
                  platform={account.platform}
                />
                <span className="max-w-40 truncate font-medium">
                  {account.handle}
                </span>
                {isDisconnected ? (
                  <span className="text-warning" title="Akun terputus">
                    <HugeiconsIcon
                      icon={Alert02Icon}
                      strokeWidth={2}
                      size={15}
                    />
                    <span className="sr-only">Akun terputus</span>
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="rounded-full"
                  aria-label={`Hapus ${PLATFORM_LABEL[account.platform]} ${account.handle}`}
                  onClick={() => onToggleAccount(account, false)}
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                </Button>
              </span>
            );
          })
        : null}

      <ChannelsPopover
        open={isPopoverOpen}
        onOpenChange={setIsPopoverOpen}
        trigger={trigger}
        accounts={accounts}
        selectedAccountIds={selectedAccountIds}
        onToggleAccount={onToggleAccount}
        onSetSelection={onSetSelection}
      />

      {!hasSelection && lastUsedIds.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSetSelection(lastUsedIds)}
        >
          Terakhir dipakai ({lastUsedIds.length})
        </Button>
      ) : null}
      {!hasSelection && connectedIds.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSetSelection(connectedIds)}
        >
          Semua ({connectedIds.length})
        </Button>
      ) : null}
    </div>
  );
}

function ChannelsPopover({
  open,
  onOpenChange,
  trigger,
  accounts,
  selectedAccountIds,
  onToggleAccount,
  onSetSelection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  accounts: ConnectedAccount[];
  selectedAccountIds: string[];
  onToggleAccount: (account: ConnectedAccount, checked: boolean) => void;
  onSetSelection: (nextAccountIds: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const visibleAccounts = filterAccountsByQuery(accounts, query);
  const connectedIds = selectAllConnectedIds(accounts);
  const allSelected = areAllConnectedSelected(accounts, selectedAccountIds);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        aria-label="Pilih akun tujuan"
        className="w-85 gap-0 p-0"
      >
        {/* eslint-disable-next-line no-restricted-syntax -- ADR-155: area pencarian popover, murni Tailwind. */}
        <div className="px-3 pt-3 pb-2">
          <InputGroup>
            <InputGroupAddon>
              <HugeiconsIcon icon={Search01Icon} strokeWidth={2} size={16} />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Cari akun..."
              aria-label="Cari akun"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>
        </div>
        {/* eslint-disable-next-line no-restricted-syntax -- ADR-155: baris Pilih semua, murni Tailwind. */}
        <div className="flex items-center justify-between px-4 pb-2 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              disabled={connectedIds.length === 0}
              onCheckedChange={(checked) =>
                onSetSelection(checked === true ? connectedIds : [])
              }
            />
            Pilih semua ({connectedIds.length})
          </label>
          <Text variant="muted">{selectedAccountIds.length} dipilih</Text>
        </div>
        {/* eslint-disable-next-line no-restricted-syntax -- ADR-155: daftar akun scrollable popover, murni Tailwind. */}
        <div
          role="listbox"
          aria-multiselectable="true"
          className="max-h-85 overflow-y-auto border-y p-1"
        >
          {accounts.length === 0 ? (
            <Text variant="muted" className="p-4 text-center">
              Belum ada akun terhubung untuk workspace ini.
            </Text>
          ) : visibleAccounts.length === 0 ? (
            <Text variant="muted" className="p-4 text-center">
              Tidak ada akun yang cocok.
            </Text>
          ) : (
            visibleAccounts.map((account) => {
              const checked = selectedAccountIds.includes(account.id);
              const isDisconnected =
                getConnectionStatus(account) === "disconnected";
              const optionId = `draft-account-${account.id}`;
              return (
                // eslint-disable-next-line no-restricted-syntax -- ADR-155: baris opsi akun, murni Tailwind.
                <div
                  key={account.id}
                  role="option"
                  aria-selected={checked}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-muted"
                >
                  <Checkbox
                    id={optionId}
                    checked={checked}
                    aria-label={`Pilih ${PLATFORM_LABEL[account.platform]} ${account.handle}`}
                    onCheckedChange={(value) =>
                      onToggleAccount(account, value === true)
                    }
                  />
                  <ChannelAvatarBadge
                    handle={account.handle}
                    platform={account.platform}
                  />
                  <label
                    htmlFor={optionId}
                    className="flex min-w-0 flex-1 cursor-pointer flex-col"
                  >
                    <span className="truncate font-medium">
                      {account.handle}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {PLATFORM_LABEL[account.platform]}
                      {isDisconnected ? (
                        <Badge variant="warning">Disconnected</Badge>
                      ) : null}
                    </span>
                  </label>
                  {isDisconnected ? (
                    <NextLink
                      href={CONNECTED_ACCOUNTS_HREF}
                      className="text-xs text-primary underline underline-offset-4 hover:no-underline"
                    >
                      Reconnect
                    </NextLink>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
                      <span
                        className="size-1.5 rounded-full bg-success"
                        aria-hidden
                      />
                      Terhubung
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
        {/* eslint-disable-next-line no-restricted-syntax -- ADR-155: footer popover, murni Tailwind. */}
        <div className="px-3 py-2">
          <NextLink
            href={CONNECTED_ACCOUNTS_HREF}
            className="inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-4 hover:no-underline"
          >
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} size={14} />
            Hubungkan akun
          </NextLink>
        </div>
      </PopoverContent>
    </Popover>
  );
}
