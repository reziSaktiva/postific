import { asPostId, asUserId } from "@postific/shared";
import { notFound, redirect } from "next/navigation";

import { AnalyticsService } from "@/domains/analytics";
import { PublishingService } from "@/domains/publishing";
import type { HistoryDetailItem } from "@/domains/publishing";
import { MediaService } from "@/domains/media";
import { getCachedSession } from "@/lib/better-auth/session";
import { getWorkspaceContext } from "@/lib/workspace/workspace-context";
import { analyticsRepository } from "@/lib/repositories/analytics";
import { publishingRepository } from "@/lib/repositories/publishing";
import { mediaRepository } from "@/lib/repositories/media";
import { supabaseMediaStorageAdapter } from "@/lib/adapters/media-storage/supabase-media-storage-adapter";
import { NotFoundError } from "@/lib/utils/errors";

import { HistoryDetail } from "./components/HistoryDetail";

/**
 * `/publish/history/[postId]` (T-034.3, KSP-D10) — entry point tipis:
 * resolve `postId`, panggil `PublishingService.getHistoryById` langsung
 * (RSC boleh memanggil Application Service tanpa Server Action perantara
 * kalau tidak ada mutasi/composition cross-domain, sama pola
 * `invite/[token]/page.tsx`). `NotFoundError` (post tidak ada, bukan milik
 * workspace ini, atau belum berstatus terminal Published/Failed — invariant
 * ditegakkan di repository, lihat `IPublishingRepository.getHistoryById`)
 * diterjemahkan ke halaman 404 Next.js bawaan (`notFound()`) di sini —
 * satu-satunya tempat yang boleh menerjemahkan error domain ke response
 * (AGENTS.md #5).
 *
 * `AnalyticsService` disuplai sebagai `PostMetricsPort` (T-043.3) — pola
 * sama dengan composition root Calendar Server Action
 * (`publish/calendar/actions.ts`, T-033.2): cross-domain `publishing` →
 * `analytics` HANYA lewat public API barrel (`@/domains/analytics`),
 * bukan import internal repository domain lain (AGENTS.md #7).
 */
export default async function Page({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;

  const { workspaceId } = await getWorkspaceContext();
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  const userId = asUserId(session.user.id);

  const publishingService = new PublishingService(
    publishingRepository,
    new AnalyticsService(analyticsRepository),
  );

  let item: HistoryDetailItem;
  try {
    item = await publishingService.getHistoryById(
      workspaceId,
      asPostId(postId),
      userId,
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  // Thumbnail media post asli (KI-082) — media PERTAMA saja, satu per post
  // (ADR-107, bukan per target row). Resolve lewat
  // `MediaService.resolveFirstThumbnail` (shared dengan
  // `getInboxItemDetailAction`, T-056, `engage/actions.ts`): kombinasi dua
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
  const thumbnail = await mediaService.resolveFirstThumbnail(
    { workspaceId, mediaIds: item.mediaIds },
    userId,
  );

  return <HistoryDetail item={item} thumbnail={thumbnail} />;
}
