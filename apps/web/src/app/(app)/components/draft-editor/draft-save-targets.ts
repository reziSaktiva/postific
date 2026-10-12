export interface DraftSaveTargetPayload {
  connectedAccountId: string;
  contentFormat: string;
  platformOptions?: Record<string, unknown>;
}

export type DraftSaveTargetsDecision =
  | { action: "wait" }
  | { action: "omit" }
  | { action: "replace"; targets: DraftSaveTargetPayload[] };

/**
 * KI-060 — array kosong di server menghapus semua akun tujuan.
 * Kalau daftar akun belum selesai dimuat, simpan draft ditahan.
 * Kalau id yang dipilih belum ketemu di daftar itu, caption tetap boleh
 * disimpan tetapi target yang sudah ada tidak boleh ditimpa array kosong.
 */
export function decideDraftSaveTargets(input: {
  accountsLoaded: boolean;
  selectedAccountIds: readonly string[];
  builtTargets: readonly DraftSaveTargetPayload[];
}): DraftSaveTargetsDecision {
  if (!input.accountsLoaded) {
    return { action: "wait" };
  }
  if (input.selectedAccountIds.length > 0 && input.builtTargets.length === 0) {
    return { action: "omit" };
  }
  return { action: "replace", targets: [...input.builtTargets] };
}
