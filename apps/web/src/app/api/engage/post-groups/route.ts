import { NextResponse } from "next/server";

import { loadPostGroupsPage } from "@/app/(app)/engage/engage-queries";

import {
  engageErrorResponse,
  parseListParams,
  resolveEngageRequest,
  unauthorizedResponse,
} from "../_shared";

/**
 * GET `/api/engage/post-groups` (T-303, ADR-166 addendum 5): satu halaman
 * kelompok posting (By post). Tanpa `cursor` = halaman pertama (dengan
 * `counts=1` ikut hitungan sebenarnya). Hanya memanggil Application Service.
 */
export async function GET(request: Request) {
  const context = await resolveEngageRequest(request);
  if (!context) return unauthorizedResponse();

  const params = new URL(request.url).searchParams;
  try {
    const page = await loadPostGroupsPage(
      {
        ...parseListParams(params),
        cursor: params.get("cursor"),
        includeEmpty: params.get("includeEmpty") === "1",
        postId: params.get("postId") || undefined,
        withCounts: params.get("counts") === "1",
      },
      context.workspaceId,
      context.userId,
    );
    return NextResponse.json(page);
  } catch (error) {
    return engageErrorResponse(error);
  }
}
