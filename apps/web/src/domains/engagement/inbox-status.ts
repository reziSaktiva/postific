import type { InboxItemStatus } from "./types";

/**
 * Aturan status komentar Engage (T-217.2, ADR-157, S-006). Murni: tanpa
 * Prisma, tanpa IO.
 *
 * - `unread` -> `replied` | `resolved` | `dismissed`
 * - `replied` -> `resolved` | `dismissed`
 * - `resolved` | `dismissed` -> `unread` (dibuka kembali; reversibel, Q3)
 *
 * `replied` biasanya ditetapkan otomatis saat balasan terkirim (Q2), bukan
 * dipilih manual. Status sama dengan status sekarang bukan transisi (no-op,
 * ditangani pemanggil sebagai idempoten).
 */
const ALLOWED_TRANSITIONS: Record<InboxItemStatus, readonly InboxItemStatus[]> =
  {
    unread: ["replied", "resolved", "dismissed"],
    replied: ["resolved", "dismissed"],
    resolved: ["unread"],
    dismissed: ["unread"],
  };

export function canTransitionInboxStatus(
  from: InboxItemStatus,
  to: InboxItemStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Jendela hitungan badge sidebar dan Engagement Snapshot (T-217.7): 12 bulan terakhir. */
export const INBOX_COUNT_WINDOW_MONTHS = 12;

/** Batas bawah `receivedAt` (UTC) untuk hitungan badge/Snapshot terhadap `now`. */
export function inboxCountWindowStart(now: Date): Date {
  const start = new Date(now.getTime());
  start.setUTCMonth(start.getUTCMonth() - INBOX_COUNT_WINDOW_MONTHS);
  return start;
}
