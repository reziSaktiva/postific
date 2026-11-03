"use client";

import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { Text } from "@/components/ui/text";

import { AccountSelector } from "./AccountSelector";
import { CaptionEditor } from "./CaptionEditor";
import { ConfirmationSummary } from "./ConfirmationSummary";
import { EditorFooter } from "./EditorFooter";
import { EditorHeader } from "./EditorHeader";
import { FormAlerts } from "./FormAlerts";
import { MediaSection } from "./MediaSection";
import { ScheduleSection } from "./ScheduleSection";
import type { DraftEditorFormParams } from "./useDraftEditorForm";
import { useDraftEditorForm } from "./useDraftEditorForm";

/**
 * Satu sesi New Post / Edit Draft. State, efek, dan aksi form ada di
 * `useDraftEditorForm`; komponen ini hanya menyusun komponen modul.
 */
export function DraftEditorForm({
  onOpenChange,
  dialogVariant,
  onToggleDialogVariant,
  ...formParams
}: DraftEditorFormParams & {
  onOpenChange: (open: boolean) => void;
  dialogVariant: "standard" | "fullscreen";
  onToggleDialogVariant: () => void;
}) {
  const form = useDraftEditorForm(formParams);
  const { pendingAction } = form;

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-100.1: struktur Layout Astryx sudah diganti shadcn Dialog (ADR-097); wrapper flex-column header/body/footer ini tidak punya padanan primitive shadcn, murni komposisi Tailwind.
    <div className="flex h-full min-h-0 flex-col">
      <EditorHeader
        pendingAction={pendingAction}
        isEdit={form.isEdit}
        status={form.status}
        dialogVariant={dialogVariant}
        onToggleDialogVariant={onToggleDialogVariant}
        onClose={() => onOpenChange(false)}
      />
      {/* eslint-disable-next-line no-restricted-syntax -- T-100.1: area body scrollable Dialog (dulu Astryx LayoutContent) tidak punya padanan primitive shadcn, murni Tailwind. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {pendingAction ? (
          <ConfirmationSummary
            pendingAction={pendingAction}
            notice={form.notice}
            caption={form.caption}
            selectedAccounts={form.selectedAccounts}
            formatByAccount={form.formatByAccount}
            scheduleDate={form.scheduleDate}
            scheduleTime={form.scheduleTime}
          />
        ) : (
          // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex.
          <div className="flex flex-col gap-4">
            <FormAlerts
              pinterestConstraintMessage={form.pinterestConstraintMessage}
              mediaMinimumMessage={form.mediaMinimumMessage}
              mixedStoryCaptionMessage={form.mixedStoryCaptionMessage}
              scheduleTimeMessage={form.scheduleTimeMessage}
              notice={form.notice}
            />

            {form.isLoadingDraft ? (
              <Text variant="muted">Memuat draft…</Text>
            ) : (
              // eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx HStack, murni Tailwind flex.
              <div className="flex flex-wrap items-start gap-6">
                {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex. */}
                <div className="flex w-full max-w-125 flex-col gap-5">
                  <CaptionEditor
                    caption={form.caption}
                    onCaptionChange={form.setCaption}
                    showStoryCaptionWarning={form.showStoryCaptionWarning}
                  />
                  <MediaSection
                    mediaItems={form.mediaItems}
                    uploadingMediaCount={form.uploadingMediaCount}
                    mediaError={form.mediaError}
                    effectiveMaxMedia={form.effectiveMaxMedia}
                    isMediaLimitReached={form.isMediaLimitReached}
                    overLimitMediaCount={form.overLimitMediaCount}
                    isDeleting={form.deleteMediaConfirm.isLoading}
                    onFilesSelected={form.handleFilesSelected}
                    onRequestDelete={form.deleteMediaConfirm.open}
                  />
                </div>

                {/* eslint-disable-next-line no-restricted-syntax -- T-102: padanan Astryx VStack, murni Tailwind flex. */}
                <div className="flex w-full max-w-85 flex-col gap-4">
                  <AccountSelector
                    accounts={form.accounts}
                    isLoadingAccounts={form.isLoadingAccounts}
                    selectedAccountIds={form.selectedAccountIds}
                    formatByAccount={form.formatByAccount}
                    onToggleAccount={form.toggleAccount}
                    onFormatChange={form.changeFormat}
                    pinTitle={form.pinTitle}
                    pinLink={form.pinLink}
                    onPinTitleChange={form.setPinTitle}
                    onPinLinkChange={form.setPinLink}
                    boardIdByAccount={form.boardIdByAccount}
                    pinterestBoardsByAccount={form.pinterestBoardsByAccount}
                    onBoardChange={form.changeBoard}
                    onRetryBoards={form.fetchPinterestBoards}
                  />
                  <ScheduleSection
                    scheduleDate={form.scheduleDate}
                    scheduleTime={form.scheduleTime}
                    onScheduleDateChange={form.setScheduleDate}
                    onScheduleTimeChange={form.setScheduleTime}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <EditorFooter
        isLoadingDraft={form.isLoadingDraft}
        pendingAction={pendingAction}
        isSavingDraft={form.isSavingDraft}
        isScheduling={form.isScheduling}
        isPublishingNow={form.isPublishingNow}
        isLoadingAccounts={form.isLoadingAccounts}
        isReadyToSchedule={form.isReadyToSchedule}
        isReadyToPublishNow={form.isReadyToPublishNow}
        onCancelPending={() => form.setPendingAction(null)}
        onConfirmSchedule={form.handleConfirmSchedule}
        onConfirmPublishNow={form.handleConfirmPublishNow}
        onSaveDraft={form.handleSaveDraft}
        onRequestPublishNow={() => form.setPendingAction("publish-now")}
        onRequestSchedule={() => form.setPendingAction("schedule")}
      />

      <ConfirmActionDialog
        isOpen={form.deleteMediaConfirm.isOpen}
        onClose={form.deleteMediaConfirm.close}
        title="Hapus media ini secara permanen?"
        description="Tindakan ini tidak bisa dibatalkan — file akan hilang permanen dari Storage dan tidak lagi bisa dipakai di post manapun."
        confirmLabel="Hapus Media"
        isLoading={form.deleteMediaConfirm.isLoading}
        error={form.deleteMediaConfirm.error}
        onConfirm={() => void form.deleteMediaConfirm.confirm()}
        variant="destructive"
      />
    </div>
  );
}
