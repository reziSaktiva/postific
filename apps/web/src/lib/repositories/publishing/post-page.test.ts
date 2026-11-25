import { asPageCursor, asWorkspaceId, ContentStatus } from "@postific/shared";
import { describe, expect, it } from "vitest";

import { InvalidPageCursorError } from "@/domains/publishing";

import {
  decodePostPageCursor,
  encodePostPageCursor,
  postPageIdsSql,
} from "./post-page";

const ID = "0b6f1d6e-3c1a-4d2b-9f4e-1a2b3c4d5e6f";
const row = {
  id: ID,
  updated: "2026-11-25 10:00:00.123456+00",
  scheduled: "2026-12-01 08:00:00+00",
  occurred: "2026-11-24 19:00:00.5+07",
};

describe("post page cursor (S-009)", () => {
  it("keeps the database time text with its microseconds", () => {
    const cursor = encodePostPageCursor("updated-desc", row);
    expect(decodePostPageCursor(cursor, "updated-desc")).toMatchObject({
      id: ID,
      t: "2026-11-25 10:00:00.123456+00",
    });
  });

  it("carries the second key of the business-time order", () => {
    const cursor = encodePostPageCursor("occurred-desc", row);
    expect(decodePostPageCursor(cursor, "occurred-desc")).toMatchObject({
      t: row.occurred,
      u: row.updated,
    });
  });

  it("rejects a cursor made for another order", () => {
    const cursor = encodePostPageCursor("scheduled-asc", row);
    expect(() => decodePostPageCursor(cursor, "updated-desc")).toThrow(
      InvalidPageCursorError,
    );
  });

  it.each([
    ["not base64 json", asPageCursor("%%%")],
    [
      "a bad time",
      asPageCursor(
        Buffer.from(
          JSON.stringify({ v: 1, o: "updated-desc", id: ID, t: "yesterday" }),
        ).toString("base64url"),
      ),
    ],
    [
      "a bad id",
      asPageCursor(
        Buffer.from(
          JSON.stringify({
            v: 1,
            o: "updated-desc",
            id: "1; drop",
            t: row.updated,
          }),
        ).toString("base64url"),
      ),
    ],
    [
      "another version",
      asPageCursor(
        Buffer.from(
          JSON.stringify({ v: 9, o: "updated-desc", id: ID, t: row.updated }),
        ).toString("base64url"),
      ),
    ],
  ])("rejects %s", (_label, cursor) => {
    expect(() => decodePostPageCursor(cursor, "updated-desc")).toThrow(
      InvalidPageCursorError,
    );
  });
});

describe("postPageIdsSql", () => {
  const selection = {
    workspaceId: asWorkspaceId(ID),
    statuses: [ContentStatus.Published, ContentStatus.Imported],
    order: "occurred-desc" as const,
    connectedAccountIds: [],
    source: "mcp" as const,
  };

  it("orders with the id last and asks for one extra row", () => {
    const sql = postPageIdsSql(selection, null, 20);
    expect(sql.sql).toContain(
      `ORDER BY p."occurred_at" DESC, p."updated_at" DESC, p."id" DESC`,
    );
    expect(sql.sql).toContain(`p."created_via" = 'mcp'`);
    expect(sql.values).toContain(21);
  });

  it("starts after the cursor row with a row-value comparison", () => {
    const cursor = decodePostPageCursor(
      encodePostPageCursor("occurred-desc", row),
      "occurred-desc",
    );
    const sql = postPageIdsSql(selection, cursor, 20);
    expect(sql.sql).toContain(
      `(p."occurred_at", p."updated_at", p."id") < (?::timestamptz, ?::timestamptz, ?::uuid)`,
    );
    expect(sql.values).toEqual(
      expect.arrayContaining([row.occurred, row.updated, ID]),
    );
  });
});
