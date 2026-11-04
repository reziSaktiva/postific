"use client";

import { useState } from "react";

import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { AccountSelector } from "./AccountSelector";
import { CaptionEditor } from "./CaptionEditor";
import { ConfirmationSummary } from "./ConfirmationSummary";
import { EditorFooter } from "./EditorFooter";
import { EditorHeader } from "./EditorHeader";
import { resolveSelectedAccounts } from "./account-selection";
import { FormAlerts } from "./FormAlerts";
import {
  resolveDialogLayout,
  type DialogVariant,
  type EditorTab,
} from "./dialog-layout";
import { countFooterWarnings } from "./footer-actions";
import { MediaSection } from "./MediaSection";
import { NetworkBlocks } from "./NetworkBlocks";
import { PreviewPanel } from "./PreviewPanel";
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
  isNarrow = false,
  ...formParams
}: DraftEditorFormParams & {
  onOpenChange: (open: boolean) => void;
  dialogVariant: DialogVariant;
  onToggleDialogVariant: () => void;
  /** Layar sempit (T-206.3): Pratinjau pindah ke tab, toggle header hilang. */
  isNarrow?: boolean;
}) {
  const form = useDraftEditorForm(formParams);
  const { pendingAction } = form;
  // Toggle Pratinjau di header (T-203.1): murni state tampilan, tidak ikut
  // tersimpan di draft.
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [narrowTab, setNarrowTab] = useState<EditorTab>("editor");
  const layout = resolveDialogLayout({
    variant: dialogVariant,
    isNarrow,
    isPreviewVisible,
    isConfirming: pendingAction !== null,
  });
  // Di layar sempit Pratinjau hanya ada di tab; layar konfirmasi tanpa tab.
  const showNarrowPreview =
    layout.showEditorPreviewTabs && narrowTab === "preview";

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-100.1: struktur Layout Astryx sudah diganti shadcn Dialog (ADR-097); wrapper flex-column header/body/footer ini tidak punya padanan primitive shadcn, murni komposisi Tailwind.
    <div className="flex h-full min-h-0 flex-col">
      <EditorHeader
        pendingAction={pendingAction}
        isEdit={form.isEdit}
        status={form.status}
        dialogVariant={dialogVariant}
        showVariantToggle={layout.showVariantToggle}
        showPreviewToggle={layout.showPreviewToggle}
        isNarrow={isNarrow}
        onToggleDialogVariant={onToggleDialogVariant}
        isPreviewVisible={isPreviewVisible}
        onTogglePreview={() => setIsPreviewVisible((visible) => !visible)}
        onClose={() => onOpenChange(false)}
      />
      {layout.showEditorPreviewTabs ? (
        <Tabs
          value={narrowTab}
          onValueChange={(value) => setNarrowTab(value as EditorTab)}
          className="px-3 pt-2"
        >
          <TabsList className="w-full">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="preview">Pratinjau</TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}
      {/* eslint-disable-next-line no-restricted-syntax -- T-203: baris body dua kolom (form + Pratinjau) tidak punya padanan primitive shadcn, murni Tailwind. */}
      <div className="flex min-h-0 flex-1">
        {/* eslint-disable-next-line no-restricted-syntax -- T-100.1: area body scrollable Dialog (dulu Astryx LayoutContent) tidak punya padanan primitive shadcn, murni Tailwind. */}
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-y-auto p-6",
            isNarrow && "px-3 pt-3.5 pb-5",
            showNarrowPreview && "hidden",
          )}
        >
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
              {form.isLoadingDraft ? (
                <Text variant="muted">Memuat draft…</Text>
              ) : (
                <>
                  <AccountSelector
                    accounts={form.accounts}
                    isLoadingAccounts={form.isLoadingAccounts}
                    selectedAccountIds={form.selectedAccountIds}
                    onToggleAccount={form.toggleAccount}
                    onSetSelection={form.setAccountSelection}
                    lastUsedAccountIds={form.lastUsedAccountIds}
                  />
                  <FormAlerts
                    crossNetworkIssues={form.networkValidation.cross}
                    notice={form.notice}
                  />
                  <section
                    aria-label="Komposer"
                    className="flex flex-col gap-3 rounded-lg border border-border p-3"
                  >
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
                  </section>
                  <NetworkBlocks
                    accounts={resolveSelectedAccounts(
                      form.selectedAccounts,
                      form.selectedAccountIds,
                    )}
                    activeAccountId={form.activeAccountId}
                    onActiveAccountChange={form.setActiveAccountId}
                    formatByAccount={form.formatByAccount}
                    onFormatChange={form.changeFormat}
                    caption={form.caption}
                    mediaItems={form.mediaItems}
                    issuesByAccount={form.networkValidation.byAccount}
                    pinTitle={form.pinTitle}
                    pinLink={form.pinLink}
                    onPinTitleChange={form.setPinTitle}
                    onPinLinkChange={form.setPinLink}
                    boardIdByAccount={form.boardIdByAccount}
                    pinterestBoardsByAccount={form.pinterestBoardsByAccount}
                    onBoardChange={form.changeBoard}
                    onRetryBoards={form.fetchPinterestBoards}
                  />
                </>
              )}
            </div>
          )}
        </div>
        {layout.showSidePreview || showNarrowPreview ? (
          <PreviewPanel
            placement={showNarrowPreview ? "full" : "side"}
            selectedAccounts={form.selectedAccounts}
            selectedAccountIds={form.selectedAccountIds}
            formatByAccount={form.formatByAccount}
            caption={form.caption}
            mediaItems={form.mediaItems}
            pinTitle={form.pinTitle}
            pinLink={form.pinLink}
            boardIdByAccount={form.boardIdByAccount}
            pinterestBoardsByAccount={form.pinterestBoardsByAccount}
          />
        ) : null}
      </div>
      <EditorFooter
        isNarrow={isNarrow}
        isLoadingDraft={form.isLoadingDraft}
        pendingAction={pendingAction}
        isSavingDraft={form.isSavingDraft}
        isScheduling={form.isScheduling}
        isPublishingNow={form.isPublishingNow}
        isLoadingAccounts={form.isLoadingAccounts}
        isReadyToSchedule={form.isReadyToSchedule}
        isReadyToPublishNow={form.isReadyToPublishNow}
        selectedAccountCount={form.selectedAccounts.length}
        warningCount={countFooterWarnings(
          form.networkValidation,
          form.scheduleTimeMessage,
        )}
        scheduleDate={form.scheduleDate}
        scheduleTime={form.scheduleTime}
        scheduleTimeMessage={form.scheduleTimeMessage}
        onScheduleDateChange={form.setScheduleDate}
        onScheduleTimeChange={form.setScheduleTime}
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
