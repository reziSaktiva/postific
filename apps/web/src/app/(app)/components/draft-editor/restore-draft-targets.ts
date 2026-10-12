import { ContentFormat } from "@postific/shared";

export interface DraftTargetSelection {
  connectedAccountId: string;
  contentFormat: string;
  platformOptions?: Record<string, unknown> | null;
}

export interface RestoredDraftTargets {
  selectedAccountIds: string[];
  formatByAccount: Record<string, ContentFormat>;
  boardIdByAccount: Record<string, string | undefined>;
  pinTitle: string;
  pinLink: string;
}

const CONTENT_FORMATS: ReadonlySet<string> = new Set(
  Object.values(ContentFormat),
);

function readOption(
  options: Record<string, unknown> | null | undefined,
  key: string,
): string {
  const value = options?.[key];
  return typeof value === "string" ? value : "";
}

/**
 * KI-060 — ubah target yang tersimpan di server jadi state form Draft Editor.
 * Jadwal (tanggal/jam) sengaja tidak ikut: field itu belum dipersist saat Save Draft.
 */
export function restoreDraftTargetSelection(
  targets: DraftTargetSelection[],
): RestoredDraftTargets {
  const selectedAccountIds: string[] = [];
  const formatByAccount: Record<string, ContentFormat> = {};
  const boardIdByAccount: Record<string, string | undefined> = {};
  let pinTitle = "";
  let pinLink = "";

  for (const target of targets) {
    selectedAccountIds.push(target.connectedAccountId);
    if (CONTENT_FORMATS.has(target.contentFormat)) {
      formatByAccount[target.connectedAccountId] =
        target.contentFormat as ContentFormat;
    }
    const boardId = readOption(target.platformOptions, "boardId");
    if (boardId) {
      boardIdByAccount[target.connectedAccountId] = boardId;
    }
    if (!pinTitle) {
      pinTitle = readOption(target.platformOptions, "pinTitle");
    }
    if (!pinLink) {
      pinLink = readOption(target.platformOptions, "pinLink");
    }
  }

  return {
    selectedAccountIds,
    formatByAccount,
    boardIdByAccount,
    pinTitle,
    pinLink,
  };
}
