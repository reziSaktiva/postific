import type { UserId, WorkspaceId } from "@postific/shared";

/**
 * Pilihan workspace satu sesi login pada alur OAuth klien AI (T-151,
 * ADR-139 poin 4). Dibutuhkan karena `consentReferenceId` plugin OAuth hanya
 * menerima `user`, `session`, dan `scopes`, jadi workspace pilihan pengguna di
 * langkah 1 harus disimpan di tempat yang bisa dibaca server saat langkah 2.
 *
 * Sementara dan per sesi: satu baris per `sessionId`, pilihan baru menimpa
 * yang lama, dan baris tidak berlaku lagi setelah `expiresAt`.
 */
export interface McpWorkspaceChoice {
  /** `identity_session.id` sesi login pengguna. */
  sessionId: string;
  userId: UserId;
  workspaceId: WorkspaceId;
  expiresAt: Date;
}

export function isMcpWorkspaceChoiceActive(
  choice: Pick<McpWorkspaceChoice, "expiresAt">,
  now: Date,
): boolean {
  return choice.expiresAt.getTime() > now.getTime();
}
