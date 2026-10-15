import type {
  AccountOwnerLookupResult,
  ConnectedAccountId,
  WorkspaceId,
} from "@postific/shared";

/**
 * Port generik untuk resolve Owner workspace dari `outstandAccountId` — satu
 * bentuk dipakai oleh port lokal domain manapun yang butuh `actingUserId`
 * untuk job cron tanpa sesi user (KI-088: JOB-05 `publishing`; precedent
 * JOB-04 `analytics`/JOB-03 `engagement`).
 */
export interface AccountOwnerLookupPort {
  findAccountOwnerByOutstandAccountId(
    outstandAccountId: string,
  ): Promise<AccountOwnerLookupResult | null>;
}

/**
 * Lookup + validasi Owner workspace sebuah akun, dipakai job cron yang tidak
 * punya sesi user untuk resolve `actingUserId` RLS (KI-088). Throw kalau
 * akun tidak ditemukan/tidak aktif, ATAU kalau hasil lookup tidak cocok
 * dengan `expected` (`workspaceId`/`connectedAccountId`) yang sudah
 * diketahui caller — sinyal data caller sendiri sudah tidak konsisten,
 * bukan cuma akun tidak aktif. `callerLabel` masuk ke pesan error supaya
 * log tetap bisa dilacak ke pemanggilnya.
 */
export async function resolveVerifiedAccountOwner(
  lookup: AccountOwnerLookupPort,
  outstandAccountId: string,
  expected: {
    workspaceId: WorkspaceId;
    connectedAccountId: ConnectedAccountId;
  },
  callerLabel: string,
): Promise<AccountOwnerLookupResult> {
  const owner =
    await lookup.findAccountOwnerByOutstandAccountId(outstandAccountId);
  if (!owner) {
    throw new Error(
      `${callerLabel}: outstandAccountId=${outstandAccountId} tidak ditemukan atau tidak aktif (owner lookup kosong).`,
    );
  }
  if (
    owner.workspaceId !== expected.workspaceId ||
    owner.connectedAccountId !== expected.connectedAccountId
  ) {
    throw new Error(
      `${callerLabel}: input (workspaceId=${expected.workspaceId}, ` +
        `connectedAccountId=${expected.connectedAccountId}) tidak cocok dengan hasil ` +
        `owner lookup (workspaceId=${owner.workspaceId}, connectedAccountId=` +
        `${owner.connectedAccountId}) untuk outstandAccountId=${outstandAccountId}.`,
    );
  }
  return owner;
}
