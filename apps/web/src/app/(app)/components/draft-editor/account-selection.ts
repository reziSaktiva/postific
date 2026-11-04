import type { ConnectedAccount } from "./form-shared";
import { PLATFORM_LABEL, isAccountDisconnected } from "./form-shared";

/**
 * Logika murni pemilihan akun di baris channel Draft Editor (T-201, ADR-155).
 * Tanpa React dan tanpa request jaringan: semuanya dihitung di klien dari
 * daftar akun yang sudah dimuat.
 */

export type ConnectionStatus = "connected" | "disconnected";

export function getConnectionStatus(
  account: ConnectedAccount,
): ConnectionStatus {
  return isAccountDisconnected(account) ? "disconnected" : "connected";
}

/** Akun yang ikut "Pilih semua" dan "Semua": hanya yang terhubung (ADR-155 addendum B.2). */
export function getConnectedAccounts(
  accounts: ConnectedAccount[],
): ConnectedAccount[] {
  return accounts.filter((account) => !isAccountDisconnected(account));
}

/** Cari berdasarkan nama platform atau handle, tanpa peduli huruf besar/kecil dan spasi tepi. */
export function filterAccountsByQuery(
  accounts: ConnectedAccount[],
  query: string,
): ConnectedAccount[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    return accounts;
  }
  return accounts.filter((account) =>
    `${PLATFORM_LABEL[account.platform]} ${account.handle}`
      .toLowerCase()
      .includes(needle),
  );
}

/** Id semua akun terhubung, urut seperti daftar akun. */
export function selectAllConnectedIds(accounts: ConnectedAccount[]): string[] {
  return getConnectedAccounts(accounts).map((account) => account.id);
}

/**
 * Aksi "Pilih semua": gabungan pilihan saat ini dan semua akun terhubung.
 * Akun Disconnected yang sudah dicentang tetap terpilih; urutan pilihan
 * saat ini dipertahankan, akun baru ditambahkan di belakang. Id yang sudah
 * tidak ada di daftar akun tetap dibawa apa adanya (bukan urusan fungsi ini).
 */
export function selectAllKeepingCurrent(
  accounts: ConnectedAccount[],
  currentIds: readonly string[],
): string[] {
  const result = [...currentIds];
  for (const id of selectAllConnectedIds(accounts)) {
    if (!result.includes(id)) {
      result.push(id);
    }
  }
  return result;
}

/** Checkbox "Pilih semua": true hanya bila ada akun terhubung dan semuanya terpilih. */
export function areAllConnectedSelected(
  accounts: ConnectedAccount[],
  selectedIds: readonly string[],
): boolean {
  const connected = getConnectedAccounts(accounts);
  return (
    connected.length > 0 &&
    connected.every((account) => selectedIds.includes(account.id))
  );
}

/**
 * Pintasan "Terakhir dipakai": dari id akun yang dipakai sebelumnya (urutan
 * dipertahankan), buang duplikat, akun yang sudah tidak ada, dan akun
 * Disconnected (pintasan tidak boleh memilihkan akun yang tidak bisa dipakai).
 */
export function resolveLastUsedIds(
  accounts: ConnectedAccount[],
  lastUsedIds: readonly string[],
): string[] {
  const connectedIds = new Set(selectAllConnectedIds(accounts));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of lastUsedIds) {
    if (connectedIds.has(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

/** Selisih pilihan lama dan baru; dipakai untuk menjalankan efek samping per akun (format default, board Pinterest). */
export function diffSelection(
  previousIds: readonly string[],
  nextIds: readonly string[],
): { added: string[]; removed: string[] } {
  return {
    added: nextIds.filter((id) => !previousIds.includes(id)),
    removed: previousIds.filter((id) => !nextIds.includes(id)),
  };
}

/**
 * Akun untuk chip: sesuai urutan pilihan, hanya yang masih ada di daftar akun
 * workspace. Id yang tidak dikenal (mis. akun dilepas setelah draft disimpan)
 * tidak menghasilkan chip.
 */
export function resolveSelectedAccounts(
  accounts: ConnectedAccount[],
  selectedIds: readonly string[],
): ConnectedAccount[] {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  return selectedIds.flatMap((id) => {
    const account = byId.get(id);
    return account ? [account] : [];
  });
}
