import {
  asUserId,
  asWorkspaceId,
  type UserId,
  type WorkspaceId,
} from "@postific/shared";
import { NextResponse } from "next/server";

import type { EngageListParams } from "@/app/(app)/engage/engage-dto";
import { auth } from "@/lib/better-auth/auth";
import {
  ApplicationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "@/lib/utils/errors";
import { WORKSPACE_ID_HEADER } from "@/lib/workspace/workspace-context-headers";

/**
 * Pelengkap Route Handler GET `/api/engage/*` (T-303, ADR-166 addendum 5):
 * halaman berikutnya daftar Engage. Hanya plumbing HTTP (sesi, workspace,
 * query string, pemetaan error); logika ada di `EngagementService`.
 *
 * Kontrak untuk klien (`loadPage` hook `useInfiniteList`): jawaban selalu
 * JSON; sesi hilang atau parameter/cursor tidak valid menjadi `{ error }`
 * dengan status 4xx, TIDAK PERNAH redirect di tengah scroll (Alert Coba
 * Lagi yang tampil). `proxy.ts` menyuntik `x-workspace-id` untuk path ini.
 */

export interface EngageRequestContext {
  workspaceId: WorkspaceId;
  userId: UserId;
}

export async function resolveEngageRequest(
  request: Request,
): Promise<EngageRequestContext | null> {
  const workspaceId = request.headers.get(WORKSPACE_ID_HEADER);
  if (!workspaceId) return null;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  return {
    workspaceId: asWorkspaceId(workspaceId),
    userId: asUserId(session.user.id),
  };
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Sesi berakhir. Muat ulang halaman lalu coba lagi." },
    { status: 401 },
  );
}

/** Parameter daftar bersama dari query string; nilai tak dikenal ditolak service. */
export function parseListParams(
  searchParams: URLSearchParams,
): EngageListParams {
  const get = (name: string) => searchParams.get(name) || undefined;
  return {
    connectedAccountId: get("account"),
    platform: get("platform"),
    status: get("status") as EngageListParams["status"],
    sort: get("sort") as EngageListParams["sort"],
    dateRange: get("range") as EngageListParams["dateRange"],
  };
}

export function engageErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApplicationError) {
    const status =
      error instanceof ValidationError
        ? 400
        : error instanceof AuthorizationError
          ? 403
          : error instanceof NotFoundError
            ? 404
            : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  console.error("engage route: gagal memuat daftar", error);
  return NextResponse.json(
    { error: "Gagal memuat daftar. Coba lagi." },
    { status: 500 },
  );
}
