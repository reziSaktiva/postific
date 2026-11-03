import NextLink from "next/link";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Text } from "@/components/ui/text";

import type { ConnectedAccount } from "./form-shared";
import { PLATFORM_LABEL, isAccountDisconnected } from "./form-shared";
import { LabeledControl } from "./LabeledControl";

/**
 * Baris satu channel/akun: checkbox pilih akun, badge Disconnected, dan tautan
 * Reconnect. Dirender sebagai fragment di dalam wrapper per akun
 * (`AccountSelector`) supaya struktur DOM sama dengan sebelum dipecah.
 */
export function ChannelRow({
  account,
  checkboxId,
  isChecked,
  onToggle,
}: {
  account: ConnectedAccount;
  checkboxId: string;
  isChecked: boolean;
  onToggle: (account: ConnectedAccount, checked: boolean) => void;
}) {
  const isDisconnected = isAccountDisconnected(account);

  return (
    <>
      {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx HStack, murni Tailwind flex. */}
      <div className="flex items-center justify-between">
        <LabeledControl
          htmlFor={checkboxId}
          control={
            <Checkbox
              id={checkboxId}
              checked={isChecked}
              onCheckedChange={(checked) => onToggle(account, checked === true)}
            />
          }
        >
          {PLATFORM_LABEL[account.platform]} {account.handle}
        </LabeledControl>
        {isDisconnected ? <Badge variant="warning">Disconnected</Badge> : null}
      </div>

      {isDisconnected ? (
        <Text variant="muted">
          Akun ini terputus —{" "}
          <NextLink
            href="/settings/connected-accounts"
            className="text-primary underline underline-offset-4 hover:no-underline"
          >
            Reconnect
          </NextLink>
          .
        </Text>
      ) : null}
    </>
  );
}
