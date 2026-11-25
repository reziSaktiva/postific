import { asUserId, type PostId } from "@postific/shared";
import { notFound, redirect } from "next/navigation";

import { AnalyticsService } from "@/domains/analytics";
import { PublishingService } from "@/domains/publishing";
import type { HistoryDetailItem } from "@/domains/publishing";
import { IdentityService } from "@/domains/identity";
import { MediaService } from "@/domains/media";
import { getCachedSession } from "@/lib/better-auth/session";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { analyticsRepository } from "@/lib/repositories/analytics";
import { publishingRepository } from "@/lib/repositories/publishing";
import { identityRepository } from "@/lib/repositories/identity";
import { supabaseAvatarStorageAdapter } from "@/lib/adapters/avatar-storage";
import { mediaRepository } from "@/lib/repositories/media";
import { supabaseMediaStorageAdapter } from "@/lib/adapters/media-storage/supabase-media-storage-adapter";
import { NotFoundError } from "@/lib/utils/errors";

import { HistoryDetail } from "../../history/[postId]/components/HistoryDetail";
import { resolveHistoryThumbnail } from "../../history/[postId]/history-thumbnail";

/**
 * One post of List · History on the Publish page (T-286): the History Detail
 * screen of the old `/publish/history/[postId]` route, moved as is (T-288
 * replaces it with the post preview dialog). Old links redirect to
 * `/publish?view=list&tab=history&post=<id>`. Composition only: services of
 * `publishing`, `analytics`, `identity` and `media` through their public API
 * (hard rules 3 and 5); `NotFoundError` becomes the Next.js 404 here.
 */
export async function HistoryPostView({ postId }: { postId: PostId }) {
  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const userId = asUserId(session.user.id);

  const identityService = new IdentityService(
    identityRepository,
    supabaseAvatarStorageAdapter,
  );

  const publishingService = new PublishingService(
    publishingRepository,
    new AnalyticsService(analyticsRepository),
    undefined,
    { findById: (userId) => identityService.getProfile(userId) },
  );

  let item: HistoryDetailItem;
  try {
    item = await publishingService.getHistoryById(workspaceId, postId, userId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  // Thumbnail media post asli (KI-082) — media PERTAMA saja, satu per post
  // (ADR-107, bukan per target row). Resolve lewat
  // `MediaService.resolveFirstThumbnail` (dulu juga dipakai
  // detail komentar Engage, T-056, dihapus T-219): kombinasi dua
  // Application Service lalu dipetakan jadi DTO siap-render, bukan
  // keputusan bisnis baru (AGENTS.md #5). `supabaseMediaStorageAdapter`
  // diteruskan supaya `url` diregenerasi (signed URL) setiap request, bukan
  // dipakai apa adanya dari waktu upload (sudah expired untuk post lama).
  // Kegagalan resolve (termasuk error DB/RLS, bukan cuma signed-URL
  // regenerate per-item) sengaja tidak melempar — lihat
  // `MediaService.resolveFirstThumbnail` — supaya halaman ini tidak ikut
  // gagal render hanya karena thumbnail gagal di-resolve.
  const mediaService = new MediaService(
    mediaRepository,
    supabaseMediaStorageAdapter,
  );
  // T-232 (ADR-158): posting impor tanpa `mediaIds` memakai thumbnail
  // tersimpan lewat resolver bersama dengan Engage (lihat `history-thumbnail`).
  const thumbnail = await resolveHistoryThumbnail(
    item,
    workspaceId,
    userId,
    mediaService,
  );

  return <HistoryDetail item={item} thumbnail={thumbnail} />;
}
