import { MediaService } from "@/domains/media";
import type { PostMediaLookupPort } from "@/domains/publishing";
import { mediaRepository } from "@/lib/repositories/media";

import { supabaseMediaStorageAdapter } from "./supabase-media-storage-adapter";

/**
 * Composition root `PostMediaLookupPort` (resolve `mediaIds` ke URL Outstand
 * saat schedule/publish/retry): satu-satunya tempat perakitannya (T-192.2),
 * dipakai Server Action Draft Editor, History, dan tool MCP. `mediaService`
 * boleh disuplai supaya instance yang sudah ada dipakai ulang.
 */
export function createPostMediaLookup(
  mediaService: MediaService = new MediaService(mediaRepository),
): PostMediaLookupPort {
  return {
    listByIds: (input, userId) => mediaService.listByIds(input, userId),
    downloadBytes: (storagePath) =>
      supabaseMediaStorageAdapter.downloadMedia(storagePath),
    saveOutstandWorkingCopy: (input, userId) =>
      mediaService.saveOutstandWorkingCopy(input, userId),
  };
}
