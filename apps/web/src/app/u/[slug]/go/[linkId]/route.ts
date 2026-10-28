import { NextResponse, type NextRequest } from "next/server";

import { ResolveStartPageLinkRedirect } from "@/domains/start-page";
import {
  publicStartPageRepository,
  startPageAnalyticsRepository,
} from "@/lib/repositories/start-page";

/**
 * Redirect klik tautan Start Page (T-074, ADR-128/ADR-141). Publik tanpa
 * session (di bawah bypass `/u` di `proxy.ts`). Route Handler tipis: seluruh
 * logika (validasi slug/linkId, hitung klik, validasi ulang http/https,
 * abaikan bot) ada di `ResolveStartPageLinkRedirect`. Redirect 302 (bukan
 * 301) supaya tidak di-cache permanen — tautan bisa diubah/dinonaktifkan
 * dan klik harus tetap terhitung. Tidak valid -> 404 tanpa membedakan sebab.
 */
const NOT_INDEXED = {
  "X-Robots-Tag": "noindex, nofollow",
  // Jangan pernah di-cache (browser/CDN/proxy): cache akan melewatkan counter
  // klik dan mempertahankan redirect ke tautan yang sudah diubah/dinonaktifkan.
  "Cache-Control": "no-store",
} as const;

type RouteContext = { params: Promise<{ slug: string; linkId: string }> };

async function resolve(
  request: NextRequest,
  context: RouteContext,
  countClick: boolean,
): Promise<NextResponse> {
  const { slug, linkId } = await context.params;
  const url = await new ResolveStartPageLinkRedirect(
    startPageAnalyticsRepository,
    publicStartPageRepository,
  ).execute({
    slug,
    linkId,
    userAgent: request.headers.get("user-agent"),
    countClick,
  });

  if (!url) {
    return new NextResponse(null, { status: 404, headers: NOT_INDEXED });
  }
  return NextResponse.redirect(url, { status: 302, headers: NOT_INDEXED });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return resolve(request, context, true);
}

/** HEAD tidak boleh menaikkan counter (cek tautan/pratinjau tidak sama dengan klik). */
export async function HEAD(request: NextRequest, context: RouteContext) {
  return resolve(request, context, false);
}
