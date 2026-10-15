/** Shared value objects — no business logic. */

import type { ConnectedAccountId, UserId, WorkspaceId } from "./ids";

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Hasil resolve Owner workspace dari sebuah `outstandAccountId` — bentuk
 * kanonikal `IWorkspaceRepository.findAccountOwnerByOutstandAccountId`
 * (dan padanannya di port lokal `publishing`/`analytics`/`engagement`, yang
 * masing-masing butuh subset field ini untuk resolve `actingUserId` RLS di
 * job cron tanpa sesi user — KI-088). Satu tempat supaya field tidak
 * di-retype berkali-kali di tiap domain (drift kalau shape-nya berubah,
 * mis. penambahan `handle` untuk KI-068).
 */
export interface AccountOwnerLookupResult {
  workspaceId: WorkspaceId;
  connectedAccountId: ConnectedAccountId;
  ownerUserId: UserId;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export type Email = string & { readonly _brand: "Email" };
export type Url = string & { readonly _brand: "Url" };

/**
 * Format email sederhana — cukup untuk validasi domain, bukan RFC penuh.
 * Sumber tunggal dipakai backend (validasi otoritatif) dan UI (gating
 * tombol submit) supaya tidak drift (temuan CodeRabbit PR #73).
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function asEmail(value: string): Email {
  return value as Email;
}

export function asUrl(value: string): Url {
  return value as Url;
}
