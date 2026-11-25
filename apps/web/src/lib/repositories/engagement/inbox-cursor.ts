import { asPageCursor, type PageCursor } from "@postific/shared";

import { ValidationError } from "@/lib/utils/errors";

/**
 * Cursor opak untuk daftar komentar dan daftar kelompok posting Engage (T-303,
 * ADR-166). Hanya repository ini yang membuat dan membaca isinya: versi,
 * sidik filter+sort (cursor dari filter lain ditolak), dan posisi terakhir
 * (waktu + id, tie-breaker stabil). Cursor datang dari browser, jadi setiap
 * bidang divalidasi; yang rusak melempar `ValidationError` (Route Handler
 * menjawabnya dengan error, bukan halaman kosong).
 *
 * Waktu dibawa sebagai ISO milidetik: `received_at` selalu ditulis aplikasi
 * dari `Date` (presisi milidetik), jadi pembandingan sama persis aman.
 */

const CURSOR_VERSION = 1;
const INVALID_CURSOR =
  "Cursor tidak valid atau kedaluwarsa. Muat ulang daftar.";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalid(): never {
  throw new ValidationError(INVALID_CURSOR);
}

function encode(payload: Record<string, unknown>): PageCursor {
  return asPageCursor(
    Buffer.from(JSON.stringify({ v: CURSOR_VERSION, ...payload })).toString(
      "base64url",
    ),
  );
}

function decode(
  cursor: PageCursor,
  fingerprint: string,
): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    return invalid();
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { v?: unknown }).v !== CURSOR_VERSION ||
    (parsed as { f?: unknown }).f !== fingerprint
  ) {
    return invalid();
  }
  return parsed as Record<string, unknown>;
}

function readTime(value: unknown): Date {
  if (typeof value !== "string") return invalid();
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    return invalid();
  }
  return date;
}

function readId(value: unknown): string {
  return typeof value === "string" && UUID_PATTERN.test(value)
    ? value
    : invalid();
}

/** Posisi terakhir yang sudah dikirim: waktu terima + id baris. */
export interface ItemPosition {
  receivedAt: Date;
  id: string;
}

/**
 * Daftar komentar dibaca dalam bagian berurutan (`segment`): `unreplied_first`
 * = `unread` dulu lalu sisanya; sort lain = satu bagian. `after` kosong =
 * awal bagian itu.
 */
export interface ItemsCursorPosition {
  segment: number;
  after: ItemPosition | null;
}

export function encodeItemsCursor(
  fingerprint: string,
  position: ItemsCursorPosition,
): PageCursor {
  return encode({
    f: fingerprint,
    g: position.segment,
    ...(position.after
      ? { t: position.after.receivedAt.toISOString(), i: position.after.id }
      : {}),
  });
}

export function decodeItemsCursor(
  cursor: PageCursor | null | undefined,
  fingerprint: string,
  segmentCount: number,
): ItemsCursorPosition {
  if (!cursor) return { segment: 0, after: null };
  const payload = decode(cursor, fingerprint);
  const segment = payload.g;
  if (
    typeof segment !== "number" ||
    !Number.isInteger(segment) ||
    segment < 0 ||
    segment >= segmentCount
  ) {
    return invalid();
  }
  if (payload.t === undefined && payload.i === undefined) {
    return { segment, after: null };
  }
  return {
    segment,
    after: { receivedAt: readTime(payload.t), id: readId(payload.i) },
  };
}

/** Posisi terakhir di daftar kelompok posting. `unreplied` hanya untuk `unreplied_first`. */
export interface GroupPosition {
  unreplied: number | null;
  latestReceivedAt: Date;
  postId: string;
}

export function encodeGroupsCursor(
  fingerprint: string,
  position: GroupPosition,
): PageCursor {
  return encode({
    f: fingerprint,
    ...(position.unreplied !== null ? { u: position.unreplied } : {}),
    t: position.latestReceivedAt.toISOString(),
    i: position.postId,
  });
}

export function decodeGroupsCursor(
  cursor: PageCursor,
  fingerprint: string,
  withUnreplied: boolean,
): GroupPosition {
  const payload = decode(cursor, fingerprint);
  let unreplied: number | null = null;
  if (withUnreplied) {
    if (
      typeof payload.u !== "number" ||
      !Number.isInteger(payload.u) ||
      payload.u < 0
    ) {
      return invalid();
    }
    unreplied = payload.u;
  } else if (payload.u !== undefined) {
    return invalid();
  }
  return {
    unreplied,
    latestReceivedAt: readTime(payload.t),
    postId: readId(payload.i),
  };
}
