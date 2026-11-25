import { asPageCursor, asUserId } from "@postific/shared";
import { NextResponse } from "next/server";
import {
  InvalidNotificationCursorError,
  NotificationService,
} from "@/domains/notification";
import { getCachedSession } from "@/lib/better-auth/session";
import { notificationRepository } from "@/lib/repositories/notification";

/**
 * GET /api/notifications?cursor=... (T-304, ADR-166 addendum 5, RS-D01):
 * next pages of the Notifications panel. Entry point only: it checks the
 * session, hands the cursor to the Application Service and returns the page.
 * It never redirects (an expired session is a 401 the panel shows as the
 * Retry Alert, not a navigation mid-scroll). The first page stays
 * server-rendered by the app layout.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getCachedSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cursor = new URL(request.url).searchParams.get("cursor");
  try {
    const page = await new NotificationService(notificationRepository).listPage(
      asUserId(session.user.id),
      cursor ? asPageCursor(cursor) : null,
    );
    return NextResponse.json(page, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof InvalidNotificationCursorError) {
      return NextResponse.json({ error: "invalid_cursor" }, { status: 400 });
    }
    throw error;
  }
}
