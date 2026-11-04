/**
 * Kapan Schedule dan Publish Now boleh ditekan (KSP-05-F12). Save as Draft
 * sengaja TIDAK memakai fungsi ini: draft boleh tidak lengkap (ADR-125,
 * S-005). Pelanggaran jaringan, termasuk aturan Reel (T-200), menahan Schedule
 * dan Publish Now di klien supaya tidak mengirim request yang pasti ditolak
 * server (keputusan King Rezi 2026-11-04, T-202).
 */
export interface ActionReadinessInput {
  isCaptionRequired: boolean;
  caption: string;
  selectedAccountCount: number;
  scheduleDate: string | undefined;
  scheduleTime: string | undefined;
  hasBlockingNetworkIssues: boolean;
  /** Pesan validasi jadwal (masa lampau, batas 30 hari); `null` bila sah. */
  scheduleTimeMessage: string | null;
}

export interface ActionReadiness {
  isReadyToSchedule: boolean;
  isReadyToPublishNow: boolean;
}

export function getActionReadiness(
  input: ActionReadinessInput,
): ActionReadiness {
  const hasRequiredCaption =
    !input.isCaptionRequired || input.caption.trim().length > 0;
  const common =
    hasRequiredCaption &&
    input.selectedAccountCount > 0 &&
    !input.hasBlockingNetworkIssues;

  return {
    isReadyToSchedule:
      common &&
      Boolean(input.scheduleDate) &&
      Boolean(input.scheduleTime) &&
      input.scheduleTimeMessage === null,
    // Publish Now melewati Schedule Picker: tanggal dan waktu tidak relevan.
    isReadyToPublishNow: common,
  };
}
