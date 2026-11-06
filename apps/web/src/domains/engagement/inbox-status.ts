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
export const INBOX_ITEM_STATUSES: readonly InboxItemStatus[] = [
  "unread",
  "replied",
  "resolved",
  "dismissed",
];

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
  // `from` datang dari kolom TEXT: baris `done` lama (sebelum migrasi T-217.4)
  // tidak ada di tabel, jadi jangan sampai melempar TypeError.
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * `done` = nama lama `resolved` (ADR-157). Satu-satunya tempat pemetaan alias,
 * dipakai entry point (mis. tool MCP) agar semantiknya tidak tersebar.
 */
export function resolveInboxStatusAlias(
  status: InboxItemStatus | "done" | undefined,
): InboxItemStatus | undefined {
  return status === "done" ? "resolved" : status;
}

/** Jendela hitungan badge sidebar dan Engagement Snapshot (T-217.7): 12 bulan terakhir. */
export const INBOX_COUNT_WINDOW_MONTHS = 12;

/** Batas bawah `receivedAt` (UTC) untuk hitungan badge/Snapshot terhadap `now`. */
export function inboxCountWindowStart(now: Date): Date {
  // `setUTCMonth` meluap (29 Feb -> 1 Mar); jepit tanggal ke akhir bulan target.
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() - INBOX_COUNT_WINDOW_MONTHS;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(now.getUTCDate(), lastDay),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds(),
    ),
  );
}
