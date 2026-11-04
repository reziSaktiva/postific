"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons";

import type { ContentStatus } from "@postific/shared";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { DialogVariant } from "./dialog-layout";
import type { PendingAction } from "./form-shared";
import {
  CONTENT_STATUS_BADGE_VARIANT,
  CONTENT_STATUS_LABEL,
} from "./status-badge";

export function EditorHeader({
  pendingAction,
  isEdit,
  status,
  dialogVariant,
  showVariantToggle,
  showPreviewToggle,
  isNarrow,
  onToggleDialogVariant,
  isPreviewVisible,
  onTogglePreview,
  onClose,
}: {
  pendingAction: PendingAction;
  isEdit: boolean;
  status: ContentStatus;
  dialogVariant: DialogVariant;
  showVariantToggle: boolean;
  showPreviewToggle: boolean;
  isNarrow: boolean;
  onToggleDialogVariant: () => void;
  isPreviewVisible: boolean;
  onTogglePreview: () => void;
  onClose: () => void;
}) {
  return (
    <DialogHeader
      className={cn(
        "flex-row items-start justify-between gap-3 border-b border-border px-6 py-4",
        isNarrow && "items-center px-3 py-2.5",
      )}
    >
      <DialogTitle className="text-lg">
        {pendingAction === "schedule"
          ? "Konfirmasi Jadwal"
          : pendingAction === "publish-now"
            ? "Konfirmasi Publish"
            : isEdit
              ? "Edit Draft"
              : "New Post"}
      </DialogTitle>
      <DialogDescription className="sr-only">
        {pendingAction === "schedule"
          ? "Tinjau jadwal sebelum konfirmasi."
          : pendingAction === "publish-now"
            ? "Tinjau detail sebelum konfirmasi publish."
            : isEdit
              ? "Edit caption, akun, dan jadwal draft ini."
              : "Tulis caption, pilih akun, dan atur jadwal post baru."}
      </DialogDescription>
      {/* eslint-disable-next-line no-restricted-syntax -- T-100.1: baris aksi header (status chip + toggle Fullscreen/Standard ADR-065 + tombol close) tidak punya padanan primitive shadcn, murni Tailwind. */}
      <div className="flex items-center gap-2">
        {pendingAction ? null : (
          <>
            <Badge variant={CONTENT_STATUS_BADGE_VARIANT[status]}>
              <span
                aria-hidden="true"
                className="inline-block size-1.5 rounded-full bg-current"
              />
              {CONTENT_STATUS_LABEL[status]}
            </Badge>
            {showPreviewToggle ? (
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={isPreviewVisible}
                onClick={onTogglePreview}
              >
                <HugeiconsIcon
                  icon={isPreviewVisible ? ViewIcon : ViewOffIcon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Pratinjau
              </Button>
            ) : null}
            {showVariantToggle ? (
              <Button variant="ghost" size="sm" onClick={onToggleDialogVariant}>
                {dialogVariant === "fullscreen" ? "Standard" : "Fullscreen"}
              </Button>
            ) : null}
          </>
        )}
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          <span className="sr-only">Close</span>
        </Button>
      </div>
    </DialogHeader>
  );
}
