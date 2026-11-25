import { ContentStatus } from "@postific/shared";

import { isReadonlyTerminalStatus } from "@/domains/publishing/readonly-terminal-status";

import type { ActionReadiness } from "./action-readiness";
import type { NetworkValidation } from "./network-validation";

/**
 * Logika murni footer Draft Editor (T-205.4, T-205.7, T-205.8): kapan tiap
 * tombol aktif, teks bantuan, dan status yang boleh dibuka. Status read-only
 * ditangani sekali, di hook (`useDraftEditorForm`), yang menutup editor.
 *
 * RBAC (ADR-047, ADR-074): Schedule dan Publish Now terbuka untuk Account
 * Owner, Admin, dan Creator, jadi tidak ada peran yang perlu dinonaktifkan di
 * tombol. Penegakan di server hanya untuk Publish Now
 * (`assertActorCanPublishNow` pada `publishNowAction`); Schedule belum punya
 * pengecekan peran di server. Penolakan server tampil sebagai notice error.
 */

/**
 * Status yang boleh dibuka di Draft Editor (Edit Draft). `Published`,
 * `Failed`, dan `Imported` read-only (T-091); `Draft`, `In Review`,
 * `Ready to Schedule`, dan `Scheduled` boleh dibuka, perilaku `Scheduled`
 * tidak diubah redesain (KSP-05 State Handling).
 */
export function isEditableInDraftEditor(status: ContentStatus): boolean {
  return !isReadonlyTerminalStatus(status);
}

export interface FooterActionsInput {
  readiness: ActionReadiness;
  isSavingDraft: boolean;
  /** T-296: "Ajukan Review" sedang berjalan (simpan lalu Draft -> In Review). */
  isSubmittingReview?: boolean;
  isScheduling: boolean;
  isPublishingNow: boolean;
  isLoadingAccounts: boolean;
}

export interface FooterActions {
  saveDraftDisabled: boolean;
  submitReviewDisabled: boolean;
  publishNowDisabled: boolean;
  scheduleDisabled: boolean;
  /** Kontrol "Atur jadwal" ikut terkunci selama aksi berjalan. */
  scheduleTriggerDisabled: boolean;
}

/**
 * Save as Draft sengaja tidak memakai `readiness` (draft boleh tidak lengkap,
 * ADR-125); hanya menunggu daftar akun selesai dimuat supaya akun tujuan
 * tersimpan lengkap. Schedule dan Publish Now aktif hanya bila validasi lulus
 * dan tidak ada aksi lain yang berjalan.
 */
export function getFooterActions(input: FooterActionsInput): FooterActions {
  const isBusy =
    input.isSavingDraft ||
    Boolean(input.isSubmittingReview) ||
    input.isScheduling ||
    input.isPublishingNow;
  return {
    saveDraftDisabled: isBusy || input.isLoadingAccounts,
    // Sama dengan Save as Draft: menyimpan dulu, jadi draft boleh belum lengkap.
    submitReviewDisabled: isBusy || input.isLoadingAccounts,
    publishNowDisabled: isBusy || !input.readiness.isReadyToPublishNow,
    scheduleDisabled: isBusy || !input.readiness.isReadyToSchedule,
    scheduleTriggerDisabled: isBusy,
  };
}

/**
 * Jumlah peringatan di footer: pelanggaran per jaringan, lintas jaringan, dan
 * pesan jadwal (satu bila ada).
 */
export function countFooterWarnings(
  validation: Pick<NetworkValidation, "byAccount" | "cross">,
  scheduleTimeMessage: string | null,
): number {
  const perNetwork = Object.values(validation.byAccount).reduce(
    (total, issues) => total + issues.length,
    0,
  );
  return perNetwork + validation.cross.length + (scheduleTimeMessage ? 1 : 0);
}

export const FOOTER_HELP_NO_ACCOUNT = "Pilih akun tujuan untuk mulai.";

/** Teks bantuan di kiri footer: "3 akun · 2 peringatan". */
export function getFooterHelpText(
  selectedAccountCount: number,
  warningCount: number,
): string {
  if (selectedAccountCount === 0) {
    return FOOTER_HELP_NO_ACCOUNT;
  }
  const accounts = `${selectedAccountCount} akun`;
  return warningCount > 0
    ? `${accounts} · ${warningCount} peringatan`
    : accounts;
}

export const SUBMIT_REVIEW_LABEL = "Ajukan Review";
export const AWAITING_REVIEW_NOTE =
  "Menunggu review · Tandai Ready di Publish > Approvals";

export interface FooterReviewControls {
  /** Tombol "Ajukan Review" (Draft -> In Review). */
  showSubmitReview: boolean;
  /** Catatan kiri footer untuk posting yang sedang In Review. */
  awaitingReviewNote: string | null;
  /** Label tombol simpan: menyimpan In Review/Ready to Schedule tidak mengubah status. */
  saveLabel: "Save as Draft" | "Simpan";
}

/**
 * T-296 (kartu `ScreenDraftEditorSubmitReview`, keputusan King Rezi
 * 2026-11-24): "Ajukan Review" hanya untuk posting Draft (baru atau
 * tersimpan, semua peran). Posting In Review menampilkan catatan menunggu
 * review; In Review dan Ready to Schedule memakai label "Simpan" karena
 * menyimpan tidak mengubah status (T-297). Schedule dan Publish Now tidak
 * diatur di sini: tetap tersedia untuk semua status ini.
 */
export function getFooterReviewControls(
  status: ContentStatus,
): FooterReviewControls {
  const keepsStatusOnSave =
    status === ContentStatus.InReview ||
    status === ContentStatus.ReadyToSchedule;
  return {
    showSubmitReview: status === ContentStatus.Draft,
    awaitingReviewNote:
      status === ContentStatus.InReview ? AWAITING_REVIEW_NOTE : null,
    saveLabel: keepsStatusOnSave ? "Simpan" : "Save as Draft",
  };
}
