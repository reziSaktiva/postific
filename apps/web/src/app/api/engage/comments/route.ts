import { NextResponse } from "next/server";

import { loadCommentsPage } from "@/app/(app)/engage/engage-queries";

import {
  engageErrorResponse,
  parseListParams,
  resolveEngageRequest,
  unauthorizedResponse,
} from "../_shared";

/**
 * GET `/api/engage/comments` (T-303, ADR-166 addendum 5): satu halaman
 * komentar. `postId` = komentar satu posting, `postId=none` = "Tanpa
 * posting", tanpa `postId` = semua komentar (tampilan List, dengan
 * `captions=1` ikut caption posting asal). Hanya memanggil Application Service.
 */
export async function GET(request: Request) {
  const context = await resolveEngageRequest(request);
  if (!context) return unauthorizedResponse();

  const params = new URL(request.url).searchParams;
  const postId = params.get("postId");
  try {
    const page = await loadCommentsPage(
      {
        ...parseListParams(params),
        cursor: params.get("cursor"),
        ...(postId !== null && { postId: postId === "none" ? null : postId }),
        withCounts: params.get("counts") === "1",
        includePostCaptions: params.get("captions") === "1",
      },
      context.workspaceId,
      context.userId,
    );
    return NextResponse.json(page);
  } catch (error) {
    return engageErrorResponse(error);
  }
}
