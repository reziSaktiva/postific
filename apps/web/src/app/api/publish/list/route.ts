import { NextResponse } from "next/server";

import {
  InvalidPageCursorError,
  InvalidPublishPageQueryError,
  parsePublishListPageQuery,
} from "@/domains/publishing";

import {
  countPublishListTab,
  getPublishRequestContext,
  loadPublishListPage,
} from "../../../(app)/publish/components/views/publish-list-pages";

/**
 * GET `/api/publish/list` — one page of a Publish List tab (S-009, ADR-166
 * addendum 5; RS-D01: Server Actions stay for mutations). Query:
 * `buildPublishListPageSearch` (tab, filter, cursor, `count=1` for the tab
 * total only). Entry point only: parses the request, calls the page
 * composition (Application Service), and maps errors to a status. A bad
 * query or cursor answers 400, no session 401; never a redirect, so the
 * list shows its Retry Alert instead of navigating mid-scroll.
 */
export async function GET(request: Request) {
  const context = await getPublishRequestContext();
  if (!context) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const query = parsePublishListPageQuery(new URL(request.url).searchParams);
    if (query.countOnly) {
      return NextResponse.json({
        total: await countPublishListTab(context, query),
      });
    }
    return NextResponse.json(await loadPublishListPage(context, query));
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
