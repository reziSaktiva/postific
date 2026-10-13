import { NextResponse, type NextRequest } from "next/server";
import { asUserId } from "@postific/shared";
import { auth } from "@/lib/better-auth/auth";
import { getServerEnv } from "@/lib/env";
import { workspaceRepository } from "@/lib/repositories/workspace";
import { WorkspaceService } from "@/domains/workspace";
import {
  ACTIVE_WORKSPACE_ID_COOKIE,
  activeWorkspaceCookieOptions,
} from "@/lib/workspace/active-workspace-cookie";

/**
 * Menutup gap redirect-loop (ADR-076): `onboarding/page.tsx` (RSC) tidak
 * bisa `cookies().set()`, jadi user yang sudah punya workspace tapi belum
 * punya `ACTIVE_WORKSPACE_ID_COOKIE` (mis. cookie expired/dihapus) di-redirect
 * ke sini dulu supaya cookie-nya di-set lewat Route Handler sebelum lanjut ke
 * Home (`/`).
 */
export async function GET(request: NextRequest) {
  // `request.url` bisa mencerminkan alamat bind internal container
  // (mis. Railway) alih-alih domain publik — pakai BETTER_AUTH_URL sebagai
  // origin redirect yang stabil, sama seperti proxy.ts.
  const appOrigin = getServerEnv().BETTER_AUTH_URL;

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.redirect(new URL("/login", appOrigin));
  }

  const workspaceService = new WorkspaceService(workspaceRepository);
  const memberships = await workspaceService.listWorkspacesForUser(
    asUserId(session.user.id),
  );

  // Hanya auto-pick kalau tepat 1 membership aktif — kalau >1, kembalikan ke
  // `/onboarding` supaya `WorkspacePicker` (T-039.4) yang menanyakan user,
  // bukan diam-diam pilih salah satu. Menutup gap: route ini bisa diakses
  // langsung (proxy.ts mengecualikan `/onboarding/*` dari validasi
  // workspace), jadi tidak boleh punya logic auto-pick sendiri yang beda
  // dari `onboarding/page.tsx`.
  const workspace = memberships.length === 1 ? memberships[0] : null;

  const response = NextResponse.redirect(
    new URL(workspace ? "/" : "/onboarding", appOrigin),
  );
  if (workspace) {
    response.cookies.set(
      ACTIVE_WORKSPACE_ID_COOKIE,
      workspace.workspaceId,
      activeWorkspaceCookieOptions(),
    );
  }
  return response;
}
