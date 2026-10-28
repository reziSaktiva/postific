/**
 * Helper cursor untuk tool daftar MCP (T-150.2). Service BC lain belum punya
 * paginasi, jadi daftar dipotong di memori: cursor membawa offset, dan sidik
 * filter supaya cursor dari satu filter tidak dipakai untuk filter lain.
 * Kontrak: `application-layer.md` § Kontrak output tool baca.
 */

export const MCP_PAGE_SIZE = 20;

const CURSOR_VERSION = 1;

export class McpInvalidCursorError extends Error {
  constructor() {
    super("Cursor tidak valid atau kedaluwarsa. Ulangi dari halaman pertama.");
    this.name = "McpInvalidCursorError";
  }
}

export interface McpPage<T> {
  items: T[];
  nextCursor: string | null;
}

function encodeCursor(offset: number, filter: string): string {
  return Buffer.from(
    JSON.stringify({ v: CURSOR_VERSION, o: offset, f: filter }),
  ).toString("base64url");
}

function decodeOffset(cursor: string, filter: string): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new McpInvalidCursorError();
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { v?: unknown }).v !== CURSOR_VERSION ||
    (parsed as { f?: unknown }).f !== filter
  ) {
    throw new McpInvalidCursorError();
  }
  const offset = (parsed as { o?: unknown }).o;
  if (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0) {
    throw new McpInvalidCursorError();
  }
  return offset;
}

/**
 * Ambil satu halaman (`MCP_PAGE_SIZE`) dari `items`. `filter` adalah sidik
 * deterministik argumen filter tool (mis. nama tool + status). Tanpa
 * `cursor` mulai dari awal; cursor rusak atau milik filter lain melempar
 * `McpInvalidCursorError`.
 */
export function paginate<T>(
  items: readonly T[],
  cursor: string | undefined,
  filter: string,
): McpPage<T> {
  const offset = cursor === undefined ? 0 : decodeOffset(cursor, filter);
  const end = offset + MCP_PAGE_SIZE;
  return {
    items: items.slice(offset, end),
    nextCursor: end < items.length ? encodeCursor(end, filter) : null,
  };
}
