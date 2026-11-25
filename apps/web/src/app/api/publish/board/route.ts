import { NextResponse } from "next/server";

import {
  InvalidPageCursorError,
  InvalidPublishPageQueryError,
  parseBoardColumnPageQuery,
} from "@/domains/publishing";

import {
  getPublishRequestContext,
  loadBoardColumnPage,
} from "../../../(app)/publish/components/views/publish-list-pages";

/**
 * GET `/api/publish/board` — the next page of one Publish Board column
 * (S-009, ADR-166 addendum 5). Query: `buildBoardColumnPageSearch`. The
 * first page of every column is rendered by the server. Entry point only:
 * parses, calls the page composition, maps errors (400 bad query or
 * cursor, 401 no session; never a redirect).
 */
export async function GET(request: Request) {
  const context = await getPublishRequestContext();
  if (!context) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const query = parseBoardColumnPageQuery(new URL(request.url).searchParams);
    return NextResponse.json(await loadBoardColumnPage(context, query));
  } catch (error) {
    if (
      error instanceof InvalidPublishPageQueryError ||
      error instanceof InvalidPageCursorError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
