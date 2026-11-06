/* eslint-disable no-restricted-syntax -- T-219: dikomposisi Tailwind langsung di atas shadcn/ui (ADR-097); layout-only, mengikuti kartu Postific ScreenEngagePerPosting */
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";

import type { EngagementInboxItemRecord } from "@/domains/engagement";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { NO_POST_REPLY_MESSAGE } from "./engage-model";

/**
 * Komposer balasan docked di bawah panel kanan (T-219.2, keputusan King
 * Rezi #4; area balas T-054 dipertahankan). Aktif setelah Reply dipilih pada
 * sebuah komentar; pada kelompok "Tanpa posting" nonaktif dengan pesan
 * (ADR-113, keputusan 2026-11-06).
 */
export function ReplyComposer({
  target,
  draft,
  blocked,
  isSending,
  justSent,
  inline = false,
  onDraftChange,
  onCancel,
  onSend,
}: {
  target: EngagementInboxItemRecord | null;
  draft: string;
  blocked: boolean;
  isSending: boolean;
  justSent: boolean;
  /** Komposer inline di bawah komentar (tampilan List, keputusan King Rezi #4); bawaan docked. */
  inline?: boolean;
  onDraftChange: (value: string) => void;
  onCancel: () => void;
  onSend: () => void;
}) {
  const disabled = blocked || !target;
  return (
    <div
      className={
        inline
          ? "mt-1.5 flex flex-col gap-2"
          : "shrink-0 border-t border-border bg-card px-3 py-2 md:px-4 md:pt-2.5 md:pb-3"
      }
    >
      <div
        className={
          inline
            ? "flex flex-col gap-2"
            : "mx-auto flex w-full max-w-3xl flex-col gap-2"
        }
      >
        <div
          aria-live="polite"
          className="flex min-h-6 items-center gap-2 text-xs text-muted-foreground"
        >
          {blocked ? (
            <span>{NO_POST_REPLY_MESSAGE}</span>
          ) : target ? (
            <>
              <span className="min-w-0 truncate">
                Membalas{" "}
                <b className="font-semibold text-foreground">
                  {target.authorHandle}
                </b>
                : {target.content}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Batalkan balasan"
                onClick={onCancel}
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              </Button>
            </>
          ) : justSent ? (
            <span className="text-success">
              Balasan terkirim. Komentar ditandai Dibalas.
            </span>
          ) : (
            <span>Pilih Reply pada sebuah komentar untuk membalas.</span>
          )}
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            rows={2}
            autoFocus={inline}
            placeholder="Balas komentar..."
            aria-label="Balasan"
            value={draft}
            disabled={disabled || isSending}
            onChange={(event) => onDraftChange(event.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            disabled={disabled || isSending || !draft.trim()}
            onClick={onSend}
          >
            Kirim
          </Button>
        </div>
      </div>
    </div>
  );
}
