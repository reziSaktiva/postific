"use client";

import { useState } from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import type { QueueSuggestionAccount } from "@/domains/publishing";
import { useUserTimeZone } from "@/lib/time/user-time-zone-context";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

import { useDraftEditor } from "../../../components/draft-editor/Context";
import { PLATFORM_ICON } from "../../../components/platform-icons";
import { pickVisibleSlots, suggestionSlotPreset } from "./queue-suggestions";

/**
 * Empty Queue: suggested times per connected account, from the account's own
 * published posts (T-291, S-008). Read-only hints; nothing is created until
 * the user schedules a post.
 */
export function QueueSuggestions({
  suggestions,
}: {
  suggestions: QueueSuggestionAccount[];
}) {
  const timeZone = useUserTimeZone();
  const { openNewPost } = useDraftEditor();
  const [showAll, setShowAll] = useState(false);

  /** "+ New" on a suggested slot: the Draft Editor with account and time set. */
  function handleNewFromSuggestion(
    account: QueueSuggestionAccount,
    slotAt: Date,
  ) {
    openNewPost(
      suggestionSlotPreset(account.connectedAccountId, slotAt, timeZone),
    );
  }

  const hasMore = suggestions.some(
    (account) =>
      pickVisibleSlots(account.slots, true).length >
      pickVisibleSlots(account.slots, false).length,
  );

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-291: layout-only
    <div className="flex flex-col gap-4">
      {/* eslint-disable-next-line no-restricted-syntax -- T-291: layout-only */}
      <div className="flex flex-col gap-1">
        <Text variant="h4" as="h3">
          Antrean kosong
        </Text>
        <Text variant="muted">
          Waktu yang disarankan per akun, dihitung dari posting Anda sendiri
          selama 90 hari terakhir. Saran tidak membuat apa pun sampai Anda
          menjadwalkan posting.
        </Text>
      </div>

      {suggestions.map((account) => {
        const Glyph = PLATFORM_ICON[account.platform].Icon;
        return (
          <section
            className="flex flex-col gap-2"
            key={account.connectedAccountId}
            aria-label={`Saran waktu ${account.handle}`}
          >
            {/* eslint-disable-next-line no-restricted-syntax -- T-291: layout-only */}
            <div className="flex items-center gap-2">
              <Glyph size={16} color={PLATFORM_ICON[account.platform].color} />
              <Text variant="small" as="span" className="font-medium">
                {account.handle}
              </Text>
            </div>
            {pickVisibleSlots(account.slots, showAll).map((slot) => (
              // eslint-disable-next-line no-restricted-syntax -- T-291: layout-only
              <div
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-2"
                key={slot.slotAt.toISOString()}
              >
                <Text variant="small" as="span" suppressHydrationWarning>
                  {slot.slotAt.toLocaleString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone,
                  })}
                </Text>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleNewFromSuggestion(account, slot.slotAt)}
                >
                  <HugeiconsIcon icon={Add01Icon} />
                  New
                </Button>
              </div>
            ))}
          </section>
        );
      })}

      {hasMore || showAll ? (
        // eslint-disable-next-line no-restricted-syntax -- T-291: layout-only
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll
              ? "Tampilkan lebih sedikit"
              : "Tampilkan lebih banyak waktu"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
