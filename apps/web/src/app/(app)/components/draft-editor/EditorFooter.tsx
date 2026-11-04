import type { ContentStatus } from "@postific/shared";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

import { getFooterActions, getFooterHelpText } from "./footer-actions";
import type { PendingAction } from "./form-shared";
import { ScheduleSection } from "./ScheduleSection";

export function EditorFooter({
  isLoadingDraft,
  pendingAction,
  status,
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
  isLoadingDraft: boolean;
  pendingAction: PendingAction;
  status: ContentStatus;
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
    status,
    isSavingDraft,
    isScheduling,
    isPublishingNow,
    isLoadingAccounts,
  });

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-205: footer dua baris (pesan jadwal + kontrol), tanpa padanan primitive shadcn, murni Tailwind.
    <div
      data-slot="dialog-footer"
      className="flex flex-col gap-2 border-t border-border px-5 py-3"
    >
      {scheduleTimeMessage ? (
        <Alert variant="destructive" data-testid="schedule-message">
          <AlertTitle>{scheduleTimeMessage}</AlertTitle>
        </Alert>
      ) : null}
      {/* eslint-disable-next-line no-restricted-syntax -- T-205: baris kontrol footer, murni Tailwind flex. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {getFooterHelpText(selectedAccountCount, warningCount)}
        </span>
        {/* eslint-disable-next-line no-restricted-syntax -- T-205: kelompok tombol aksi, murni Tailwind flex. */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ScheduleSection
            scheduleDate={scheduleDate}
            scheduleTime={scheduleTime}
            disabled={actions.scheduleTriggerDisabled}
            onScheduleDateChange={onScheduleDateChange}
            onScheduleTimeChange={onScheduleTimeChange}
          />
          <Button
            variant="secondary"
            onClick={onSaveDraft}
            disabled={actions.saveDraftDisabled}
          >
            {isSavingDraft ? <Spinner /> : null}
            Save as Draft
          </Button>
          <Button
            variant="secondary"
            disabled={actions.publishNowDisabled}
            onClick={onRequestPublishNow}
          >
            Publish Now
          </Button>
          <Button
            disabled={actions.scheduleDisabled}
            onClick={onRequestSchedule}
          >
            Schedule
          </Button>
        </div>
      </div>
    </div>
  );
}
