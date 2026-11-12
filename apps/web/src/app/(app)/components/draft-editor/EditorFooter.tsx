import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

import { getFooterActions, getFooterHelpText } from "./footer-actions";
import type { PendingAction } from "./form-shared";
import { ScheduleSection } from "./ScheduleSection";

export function EditorFooter({
  isNarrow = false,
  isLoadingDraft,
  pendingAction,
  isSavingDraft,
  isScheduling,
  isPublishingNow,
  isLoadingAccounts,
  isReadyToSchedule,
  isReadyToPublishNow,
  selectedAccountCount,
  warningCount,
  scheduleDate,
  scheduleTime,
  scheduleTimeMessage,
  onScheduleDateChange,
  onScheduleTimeChange,
  onCancelPending,
  onConfirmSchedule,
  onConfirmPublishNow,
  onSaveDraft,
  onRequestPublishNow,
  onRequestSchedule,
}: {
  /** Layar sempit (T-206.3): footer ditumpuk, tombol selebar penuh. */
  isNarrow?: boolean;
  isLoadingDraft: boolean;
  pendingAction: PendingAction;
  isSavingDraft: boolean;
  isScheduling: boolean;
  isPublishingNow: boolean;
  isLoadingAccounts: boolean;
  isReadyToSchedule: boolean;
  isReadyToPublishNow: boolean;
  selectedAccountCount: number;
  warningCount: number;
  scheduleDate: string | undefined;
  scheduleTime: string | undefined;
  scheduleTimeMessage: string | null;
  onScheduleDateChange: (date: string | undefined) => void;
  onScheduleTimeChange: (time: string | undefined) => void;
  onCancelPending: () => void;
  onConfirmSchedule: () => void;
  onConfirmPublishNow: () => void;
  onSaveDraft: () => void;
  onRequestPublishNow: () => void;
  onRequestSchedule: () => void;
}) {
  if (isLoadingDraft) {
    return null;
  }

  if (pendingAction === "schedule") {
    return (
      <DialogFooter className="border-t border-border px-6 py-4">
        <Button
          variant="secondary"
          onClick={onCancelPending}
          disabled={isScheduling}
        >
          Batal
        </Button>
        <Button onClick={onConfirmSchedule} disabled={isScheduling}>
          {isScheduling ? <Spinner /> : null}
          Konfirmasi & Jadwalkan
        </Button>
      </DialogFooter>
    );
  }

  if (pendingAction === "publish-now") {
    return (
      <DialogFooter className="border-t border-border px-6 py-4">
        <Button
          variant="secondary"
          onClick={onCancelPending}
          disabled={isPublishingNow}
        >
          Batal
        </Button>
        <Button onClick={onConfirmPublishNow} disabled={isPublishingNow}>
          {isPublishingNow ? <Spinner /> : null}
          Konfirmasi & Publish
        </Button>
      </DialogFooter>
    );
  }

  const actions = getFooterActions({
    readiness: { isReadyToSchedule, isReadyToPublishNow },
    isSavingDraft,
    isScheduling,
    isPublishingNow,
    isLoadingAccounts,
  });

  return (
    <DialogFooter
      className={cn(
        "flex-col gap-2 border-t border-border px-5 py-3 sm:flex-col sm:justify-start",
        isNarrow && "px-3 py-2.5",
      )}
    >
      {scheduleTimeMessage ? (
        <Alert variant="destructive" data-testid="schedule-message">
          <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
          <AlertTitle>{scheduleTimeMessage}</AlertTitle>
        </Alert>
      ) : null}
      {/* eslint-disable-next-line no-restricted-syntax -- T-205: baris kontrol footer, murni Tailwind flex. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isNarrow ? null : (
          <span className="text-xs text-muted-foreground">
            {getFooterHelpText(selectedAccountCount, warningCount)}
          </span>
        )}
        {/* eslint-disable-next-line no-restricted-syntax -- T-205: kelompok tombol aksi, murni Tailwind flex. */}
        <div
          className={cn(
            "flex flex-wrap items-center justify-end gap-2",
            isNarrow && "w-full",
          )}
        >
          <ScheduleSection
            scheduleDate={scheduleDate}
            scheduleTime={scheduleTime}
            disabled={actions.scheduleTriggerDisabled}
            triggerClassName={
              isNarrow ? "w-full flex-[1_1_100%] justify-start" : undefined
            }
            onScheduleDateChange={onScheduleDateChange}
            onScheduleTimeChange={onScheduleTimeChange}
          />
          <Button
            variant="secondary"
            className={isNarrow ? "min-w-0 flex-1" : undefined}
            onClick={onSaveDraft}
            disabled={actions.saveDraftDisabled}
          >
            {isSavingDraft ? <Spinner /> : null}
            Save as Draft
          </Button>
          <Button
            variant="secondary"
            className={isNarrow ? "min-w-0 flex-1" : undefined}
            disabled={actions.publishNowDisabled}
            onClick={onRequestPublishNow}
          >
            Publish Now
          </Button>
          <Button
            className={isNarrow ? "min-w-0 flex-1" : undefined}
            disabled={actions.scheduleDisabled}
            onClick={onRequestSchedule}
          >
            Schedule
          </Button>
        </div>
      </div>
    </DialogFooter>
  );
}
