import { AnalyticsService } from "@/domains/analytics";
import { EngagementService } from "@/domains/engagement";
import { IdentityService } from "@/domains/identity";
import {
  MAX_MEDIA_FILE_SIZE_BYTES,
  MediaService,
  UploadMediaUseCase,
} from "@/domains/media";
import {
  ComposeDraftUseCase,
  PublishingService,
  SchedulePostsUseCase,
  ScheduleContentsUseCase,
  type PostMediaLookupPort,
} from "@/domains/publishing";
import { WorkspaceService } from "@/domains/workspace";
import { supabaseAvatarStorageAdapter } from "@/lib/adapters/avatar-storage";
import { supabaseMediaStorageAdapter } from "@/lib/adapters/media-storage/supabase-media-storage-adapter";
import { nodeSafeFetchDeps } from "@/lib/net/node-transport";
import { safeFetch } from "@/lib/net/safe-fetch";
import { getOutstandAdapter } from "@/lib/adapters/outstand";
import { backgroundJobScheduler } from "@/lib/jobs/job-scheduler";
import { analyticsRepository } from "@/lib/repositories/analytics";
import { engagementRepository } from "@/lib/repositories/engagement";
import { identityRepository } from "@/lib/repositories/identity";
import { mediaRepository } from "@/lib/repositories/media";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";

import type { McpToolServices } from "./tool-types";

/**
 * Lookup media untuk penjadwalan (resolve `mediaIds` ke URL Outstand): pola
 * sama `createPostMediaLookup` di Server Action Draft Editor.
 */
function postMediaLookup(mediaService: MediaService): PostMediaLookupPort {
  return {
    listByIds: (input, userId) => mediaService.listByIds(input, userId),
    downloadBytes: (storagePath) =>
      supabaseMediaStorageAdapter.downloadMedia(storagePath),
    saveOutstandWorkingCopy: (input, userId) =>
      mediaService.saveOutstandWorkingCopy(input, userId),
  };
}

/**
 * Composition root service BC lain untuk tool MCP (baca T-150.3, draft T-152), pola sama
 * composition root Server Action/halaman (`publish/calendar/page.tsx`,
 * `engage/page.tsx`, `page.tsx`). Stateless dan murah, dirakit per request.
 *
 * - `AnalyticsService` butuh `ActiveAccountsPort` (`WorkspaceService`).
 * - `MediaService` tanpa storage adapter: tidak ada signed URL dibuat dan
 *   `url` tidak dikembalikan tool.
 * - `EngagementService` dan `ScheduleContentsUseCase` dirakit malas:
 *   `getOutstandAdapter()` melempar bila `OUTSTAND_API_KEY` kosong, dan itu
 *   tidak boleh merusak tool lain.
 */
export function getMcpToolServices(): McpToolServices {
  const workspace = new WorkspaceService(workspaceRepository);
  const analytics = new AnalyticsService(analyticsRepository, workspace);
  const publishing = new PublishingService(publishingRepository, analytics);
  const media = new MediaService(mediaRepository);
  const drafts = new ComposeDraftUseCase(
    publishing,
    publishingRepository,
    workspace,
    media,
  );

  let scheduleContents: ScheduleContentsUseCase | undefined;
  let engagement: EngagementService | undefined;
  return {
    workspace,
    media,
    publishing,
    analytics,
    identity: new IdentityService(
      identityRepository,
      supabaseAvatarStorageAdapter,
    ),
    drafts,
    mediaUpload: new UploadMediaUseCase(
      mediaRepository,
      supabaseMediaStorageAdapter,
    ),
    remoteMedia: {
      download: (url) =>
        safeFetch(url, nodeSafeFetchDeps, {
          maxBytes: MAX_MEDIA_FILE_SIZE_BYTES,
        }),
    },
    get scheduleContents() {
      scheduleContents ??= new ScheduleContentsUseCase(
        drafts,
        new SchedulePostsUseCase(
          publishingRepository,
          getOutstandAdapter(),
          backgroundJobScheduler,
          postMediaLookup(media),
        ),
        publishingRepository,
        workspace,
      );
      return scheduleContents;
    },
    get engagement() {
      engagement ??= new EngagementService(
        engagementRepository,
        getOutstandAdapter(),
        publishingRepository,
        workspaceRepository,
      );
      return engagement;
    },
  };
}
