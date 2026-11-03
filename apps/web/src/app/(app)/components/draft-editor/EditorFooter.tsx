import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

import type { PendingAction } from "./form-shared";

export function EditorFooter({
  isLoadingDraft,
  pendingAction,
  isSavingDraft,
  isScheduling,
  isPublishingNow,
  isLoadingAccounts,
  isReadyToSchedule,
  isReadyToPublishNow,
  onCancelPending,
  onConfirmSchedule,
  onConfirmPublishNow,
  onSaveDraft,
  onRequestPublishNow,
  onRequestSchedule,
}: {
  isLoadingDraft: boolean;
  pendingAction: PendingAction;
  isSavingDraft: boolean;
  isScheduling: boolean;
  isPublishingNow: boolean;
  isLoadingAccounts: boolean;
  isReadyToSchedule: boolean;
  isReadyToPublishNow: boolean;
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

  return (
    <DialogFooter className="flex-row border-t border-border px-6 py-4 [&>*]:flex-1">
      <Button
        variant="secondary"
        onClick={onSaveDraft}
        disabled={isSavingDraft || isLoadingAccounts}
      >
        {isSavingDraft ? <Spinner /> : null}
        Save as Draft
      </Button>
      <Button
        variant="secondary"
        disabled={!isReadyToPublishNow}
        onClick={onRequestPublishNow}
      >
        Publish Now
      </Button>
      <Button disabled={!isReadyToSchedule} onClick={onRequestSchedule}>
        Schedule
      </Button>
    </DialogFooter>
  );
}
