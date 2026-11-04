import type { ContentStatus } from "@postific/shared";

import { isReadonlyTerminalStatus } from "@/domains/publishing/readonly-terminal-status";

import type { ActionReadiness } from "./action-readiness";
import type { NetworkValidation } from "./network-validation";

/**
 * Logika murni footer Draft Editor (T-205.4, T-205.7, T-205.8): kapan tiap
 * tombol aktif, teks bantuan, dan aksi per status konten.
 *
 * RBAC (ADR-047, ADR-074): Schedule dan Publish Now terbuka untuk Account
 * Owner, Admin, dan Creator, jadi tidak ada peran yang perlu dinonaktifkan di
 * tombol. Penegakannya tetap di server (`assertActorCanPublishNow` pada
 * `publishNowAction`); penolakan server tampil sebagai notice error.
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
  status: ContentStatus;
  isSavingDraft: boolean;
  isScheduling: boolean;
  isPublishingNow: boolean;
  isLoadingAccounts: boolean;
}

export interface FooterActions {
  saveDraftDisabled: boolean;
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
    input.isSavingDraft || input.isScheduling || input.isPublishingNow;
  const isMutable = isEditableInDraftEditor(input.status);
  return {
    saveDraftDisabled: !isMutable || isBusy || input.isLoadingAccounts,
    publishNowDisabled:
      !isMutable || isBusy || !input.readiness.isReadyToPublishNow,
    scheduleDisabled:
      !isMutable || isBusy || !input.readiness.isReadyToSchedule,
    scheduleTriggerDisabled: !isMutable || isBusy,
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
