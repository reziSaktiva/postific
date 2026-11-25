import { asPageCursor, type PageCursor } from "@postific/shared";

import {
  InvalidPageCursorError,
  type PublishPostOrder,
  type PublishPostSelection,
} from "@/domains/publishing";
import { Prisma } from "@/generated/prisma/client";

/**
 * Keyset paging of the Publish lists (S-009, ADR-166): the SQL that reads
 * one page of post ids, and the opaque cursor that marks where the next
 * page starts. Only this repository builds and reads the cursor.
 *
 * Times are carried as Postgres text (`timestamptz::text`, microseconds and
 * offset kept), not as a JS `Date`: a `Date` keeps milliseconds only, so a
 * cursor made from one would skip posts whose times differ below a
 * millisecond. The id is the last tie-breaker of every order, so two posts
 * with the same time never repeat or go missing across a page edge.
 */

const CURSOR_VERSION = 1;
const TIMESTAMP_TEXT =
  /^\d{4}-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d{1,6})?[+-]\d{2}(:\d{2}){0,2}$/;
const UUID_TEXT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sort keys of one row, as read by `postPageIdsSql`. */
export interface PostPageKeyRow {
  id: string;
  updated: string;
  scheduled: string | null;
  occurred: string;
}

interface CursorPayload {
  v: number;
  /** Order the cursor was made for. */
  o: PublishPostOrder;
  /**
   * Fingerprint of the list the cursor was made for (workspace, statuses,
   * order, filters): a cursor from the Drafts tab sent with another tab or
   * another filter is rejected, never read as a position in that list.
   */
  f: string;
  id: string;
  /** Main sort time of the order (updated, scheduled or occurred). */
  t: string;
  /** `updated_at`, the second key of `occurred-desc`. */
  u?: string;
}

/**
 * Identifies one list: the same workspace, statuses, order and filters give
 * the same text whatever order the arrays came in.
 */
export function postSelectionFingerprint(
  selection: PublishPostSelection,
): string {
  return JSON.stringify([
    selection.workspaceId,
    selection.order,
    [...selection.statuses].sort(),
    [...(selection.connectedAccountIds ?? [])].sort(),
    selection.source ?? null,
  ]);
}

export function encodePostPageCursor(
  selection: PublishPostSelection,
  row: PostPageKeyRow,
): PageCursor {
  const order = selection.order;
  const t =
    order === "updated-desc"
      ? row.updated
      : order === "scheduled-asc"
        ? row.scheduled
        : row.occurred;
  if (t === null) {
    // `postPageIdsSql` keeps only rows with a publish time for this order.
    throw new Error("encodePostPageCursor: row without a sort time");
  }
  const payload: CursorPayload = {
    v: CURSOR_VERSION,
    o: order,
    f: postSelectionFingerprint(selection),
    id: row.id,
    t,
    ...(order === "occurred-desc" ? { u: row.updated } : {}),
  };
  return asPageCursor(
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
  );
}

/** Postgres `timestamptz::text` with every field in range, so the cast cannot fail. */
function isTimestampText(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = TIMESTAMP_TEXT.exec(value);
  if (!match) return false;
  const [month, day, hour, minute, second] = match.slice(1, 6).map(Number);
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31 &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59
  );
}

/**
 * Reads a cursor made by `encodePostPageCursor` for the same `selection`.
 * Anything else (broken text, another version, order, tab or filter, a bad
 * id or time) throws `InvalidPageCursorError`.
 */
export function decodePostPageCursor(
  cursor: PageCursor,
  selection: PublishPostSelection,
): CursorPayload {
  const order = selection.order;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new InvalidPageCursorError();
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new InvalidPageCursorError();
  }
  const payload = parsed as Partial<CursorPayload>;
  if (
    payload.v !== CURSOR_VERSION ||
    payload.o !== order ||
    payload.f !== postSelectionFingerprint(selection) ||
    typeof payload.id !== "string" ||
    !UUID_TEXT.test(payload.id) ||
    !isTimestampText(payload.t) ||
    (order === "occurred-desc" && !isTimestampText(payload.u))
  ) {
    throw new InvalidPageCursorError();
  }
  return payload as CursorPayload;
}

function selectionWhere(selection: PublishPostSelection): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`p."workspace_id" = ${selection.workspaceId}::uuid`,
    Prisma.sql`p."deleted_at" IS NULL`,
    Prisma.sql`p."status" IN (${Prisma.join([...selection.statuses])})`,
  ];
  if (selection.order === "scheduled-asc") {
    parts.push(Prisma.sql`p."scheduled_at" IS NOT NULL`);
  }
  if (selection.source === "mcp") {
    parts.push(Prisma.sql`p."created_via" = 'mcp'`);
  } else if (selection.source === "manual") {
    parts.push(Prisma.sql`p."created_via" <> 'mcp'`);
  }
  if (
    selection.connectedAccountIds &&
    selection.connectedAccountIds.length > 0
  ) {
    parts.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "publishing_post_targets" t
      WHERE t."post_id" = p."id"
        AND t."connected_account_id" IN (${Prisma.join(
          selection.connectedAccountIds.map((id) => Prisma.sql`${id}::uuid`),
        )})
    )`);
  }
  return Prisma.join(parts, " AND ");
}

function keysetWhere(
  order: PublishPostOrder,
  cursor: CursorPayload,
): Prisma.Sql {
  switch (order) {
    case "updated-desc":
      return Prisma.sql`(p."updated_at", p."id") < (${cursor.t}::timestamptz, ${cursor.id}::uuid)`;
    case "scheduled-asc":
      return Prisma.sql`(p."scheduled_at", p."id") > (${cursor.t}::timestamptz, ${cursor.id}::uuid)`;
    case "occurred-desc":
      return Prisma.sql`(p."occurred_at", p."updated_at", p."id") < (${cursor.t}::timestamptz, ${cursor.u}::timestamptz, ${cursor.id}::uuid)`;
  }
}

const ORDER_BY: Record<PublishPostOrder, Prisma.Sql> = {
  "updated-desc": Prisma.sql`p."updated_at" DESC, p."id" DESC`,
  "scheduled-asc": Prisma.sql`p."scheduled_at" ASC, p."id" ASC`,
  "occurred-desc": Prisma.sql`p."occurred_at" DESC, p."updated_at" DESC, p."id" DESC`,
};

/**
 * Ids and sort keys of one page plus one row (to tell whether more pages
 * exist). `cursor` must come from `decodePostPageCursor` for the same order.
 */
export function postPageIdsSql(
  selection: PublishPostSelection,
  cursor: CursorPayload | null,
  limit: number,
): Prisma.Sql {
  const where = cursor
    ? Prisma.sql`${selectionWhere(selection)} AND ${keysetWhere(selection.order, cursor)}`
    : selectionWhere(selection);
  return Prisma.sql`
    SELECT p."id"::text AS "id",
           p."updated_at"::text AS "updated",
           p."scheduled_at"::text AS "scheduled",
           p."occurred_at"::text AS "occurred"
    FROM "publishing_posts" p
    WHERE ${where}
    ORDER BY ${ORDER_BY[selection.order]}
    LIMIT ${limit + 1}
  `;
}

/** Prisma `where` with the same rows as `selectionWhere`, for the count query. */
export function selectionPrismaWhere(
  selection: PublishPostSelection,
): Prisma.PublishingPostWhereInput {
  return {
    workspaceId: selection.workspaceId,
    deletedAt: null,
    status: { in: [...selection.statuses] },
    ...(selection.order === "scheduled-asc"
      ? { scheduledAt: { not: null } }
      : {}),
    ...(selection.source === "mcp"
      ? { createdVia: "mcp" }
      : selection.source === "manual"
        ? { createdVia: { not: "mcp" } }
        : {}),
    ...(selection.connectedAccountIds &&
    selection.connectedAccountIds.length > 0
      ? {
          targets: {
            some: {
              connectedAccountId: { in: [...selection.connectedAccountIds] },
            },
          },
        }
      : {}),
  };
}
