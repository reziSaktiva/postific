import {
  asConnectedAccountId,
  asPageCursor,
  asWorkspaceId,
  ContentStatus,
} from "@postific/shared";
import { describe, expect, it } from "vitest";

import { InvalidPageCursorError } from "@/domains/publishing";

import type { PublishPostSelection } from "@/domains/publishing";

import {
  decodePostPageCursor,
  encodePostPageCursor,
  postPageIdsSql,
  postSelectionFingerprint,
} from "./post-page";

const ID = "0b6f1d6e-3c1a-4d2b-9f4e-1a2b3c4d5e6f";
const row = {
  id: ID,
  updated: "2026-11-25 10:00:00.123456+00",
  scheduled: "2026-12-01 08:00:00+00",
  occurred: "2026-11-24 19:00:00.5+07",
};

const ACCOUNT_A = asConnectedAccountId("1b6f1d6e-3c1a-4d2b-9f4e-1a2b3c4d5e6f");
const ACCOUNT_B = asConnectedAccountId("2b6f1d6e-3c1a-4d2b-9f4e-1a2b3c4d5e6f");

/** The Drafts tab: updated-desc over Draft. */
const drafts: PublishPostSelection = {
  workspaceId: asWorkspaceId(ID),
  statuses: [ContentStatus.Draft],
  order: "updated-desc",
};
/** The Approvals tab: the same order as Drafts, other statuses. */
const approvals: PublishPostSelection = {
  ...drafts,
  statuses: [ContentStatus.InReview],
};
const history: PublishPostSelection = {
  workspaceId: asWorkspaceId(ID),
  statuses: [ContentStatus.Published, ContentStatus.Failed],
  order: "occurred-desc",
};
const queue: PublishPostSelection = {
  workspaceId: asWorkspaceId(ID),
  statuses: [ContentStatus.Scheduled],
  order: "scheduled-asc",
};

function rawCursor(payload: Record<string, unknown>) {
  return asPageCursor(
    Buffer.from(
      JSON.stringify({ f: postSelectionFingerprint(drafts), ...payload }),
    ).toString("base64url"),
  );
}

describe("post page cursor (S-009)", () => {
  it("keeps the database time text with its microseconds", () => {
    const cursor = encodePostPageCursor(drafts, row);
    expect(decodePostPageCursor(cursor, drafts)).toMatchObject({
      id: ID,
      t: "2026-11-25 10:00:00.123456+00",
    });
  });

  it("stays short and readable with the most channels a filter allows (200)", () => {
    const manyChannels: PublishPostSelection = {
      ...history,
      connectedAccountIds: Array.from({ length: 200 }, (_, index) =>
        asConnectedAccountId(
          `${index.toString(16).padStart(8, "0")}-3c1a-4d2b-9f4e-1a2b3c4d5e6f`,
        ),
      ),
      source: "mcp",
    };
    const cursor = encodePostPageCursor(manyChannels, row);
    // The page query rejects a cursor longer than 1 024 characters.
    expect(cursor.length).toBeLessThan(400);
    expect(decodePostPageCursor(cursor, manyChannels)).toMatchObject({
      id: ID,
    });
    // One channel fewer is another list: its cursor is rejected.
    const fewer = {
      ...manyChannels,
      connectedAccountIds: manyChannels.connectedAccountIds?.slice(1),
    };
    expect(() => decodePostPageCursor(cursor, fewer)).toThrow(
      InvalidPageCursorError,
    );
  });

  it("carries the second key of the business-time order", () => {
    const cursor = encodePostPageCursor(history, row);
    expect(decodePostPageCursor(cursor, history)).toMatchObject({
      t: row.occurred,
      u: row.updated,
    });
  });

  it("rejects a cursor made for another order", () => {
    const cursor = encodePostPageCursor(queue, row);
    expect(() => decodePostPageCursor(cursor, drafts)).toThrow(
      InvalidPageCursorError,
    );
  });

  it("rejects a Drafts cursor sent with the Approvals tab (same order)", () => {
    const cursor = encodePostPageCursor(drafts, row);
    expect(() => decodePostPageCursor(cursor, approvals)).toThrow(
      InvalidPageCursorError,
    );
  });

  it.each([
    ["another account filter", { connectedAccountIds: [ACCOUNT_A] }],
    ["another source filter", { source: "mcp" as const }],
    ["another workspace", { workspaceId: asWorkspaceId(ACCOUNT_B) }],
  ])("rejects a cursor sent with %s", (_label, change) => {
    const cursor = encodePostPageCursor(drafts, row);
    expect(() =>
      decodePostPageCursor(cursor, { ...drafts, ...change }),
    ).toThrow(InvalidPageCursorError);
  });

  it("accepts the same list with its arrays in another order", () => {
    const selection: PublishPostSelection = {
      ...history,
      connectedAccountIds: [ACCOUNT_A, ACCOUNT_B],
    };
    const cursor = encodePostPageCursor(selection, row);
    expect(
      decodePostPageCursor(cursor, {
        ...selection,
        statuses: [...selection.statuses].reverse(),
        connectedAccountIds: [
          ...(selection.connectedAccountIds ?? []),
        ].reverse(),
      }),
    ).toMatchObject({ id: ID });
  });

  it("rejects a cursor without a fingerprint", () => {
    const cursor = asPageCursor(
      Buffer.from(
        JSON.stringify({ v: 1, o: "updated-desc", id: ID, t: row.updated }),
      ).toString("base64url"),
    );
    expect(() => decodePostPageCursor(cursor, drafts)).toThrow(
      InvalidPageCursorError,
    );
  });

  it.each([
    ["not base64 json", asPageCursor("%%%")],
    [
      "a bad time",
      rawCursor({ v: 1, o: "updated-desc", id: ID, t: "yesterday" }),
    ],
    [
      "a bad id",
      rawCursor({
        v: 1,
        o: "updated-desc",
        id: "1; drop",
        t: row.updated,
      }),
    ],
    [
      "another version",
      rawCursor({ v: 9, o: "updated-desc", id: ID, t: row.updated }),
    ],
  ])("rejects %s", (_label, cursor) => {
    expect(() => decodePostPageCursor(cursor, drafts)).toThrow(
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
      encodePostPageCursor(selection, row),
      selection,
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
