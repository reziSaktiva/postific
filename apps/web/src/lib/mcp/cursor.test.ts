import { describe, expect, it } from "vitest";

import { MCP_PAGE_SIZE, McpInvalidCursorError, paginate } from "./cursor";

const items = Array.from({ length: 45 }, (_, index) => index);

describe("paginate", () => {
  it("returns 20 items and a cursor for the first page", () => {
    const page = paginate(items, undefined, "f");
    expect(page.items).toEqual(items.slice(0, MCP_PAGE_SIZE));
    expect(page.nextCursor).not.toBeNull();
  });

  it("walks all pages and ends with a null cursor", () => {
    const seen: number[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = paginate(items, cursor, "f");
      seen.push(...page.items);
      cursor = page.nextCursor ?? undefined;
      pages += 1;
    } while (cursor);
    expect(pages).toBe(3);
    expect(seen).toEqual(items);
  });

  it("has no cursor when the list fits one page", () => {
    expect(paginate([1, 2, 3], undefined, "f")).toEqual({
      items: [1, 2, 3],
      nextCursor: null,
    });
    expect(paginate([], undefined, "f")).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it("rejects garbage cursors", () => {
    expect(() => paginate(items, "not-a-cursor", "f")).toThrow(
      McpInvalidCursorError,
    );
    const negative = Buffer.from(
      JSON.stringify({ v: 1, o: -5, f: "f" }),
    ).toString("base64url");
    expect(() => paginate(items, negative, "f")).toThrow(McpInvalidCursorError);
    const wrongVersion = Buffer.from(
      JSON.stringify({ v: 2, o: 0, f: "f" }),
    ).toString("base64url");
    expect(() => paginate(items, wrongVersion, "f")).toThrow(
      McpInvalidCursorError,
    );
  });

  it("rejects a cursor made for another filter", () => {
    const { nextCursor } = paginate(items, undefined, "list_comments|unread|");
    expect(() => paginate(items, nextCursor!, "list_comments|done|")).toThrow(
      McpInvalidCursorError,
    );
  });
});
