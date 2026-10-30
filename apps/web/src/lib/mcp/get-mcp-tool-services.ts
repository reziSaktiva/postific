import { AnalyticsService } from "@/domains/analytics";
import { EngagementService } from "@/domains/engagement";
import { MediaService } from "@/domains/media";
import { ComposeDraftUseCase, PublishingService } from "@/domains/publishing";
import { WorkspaceService } from "@/domains/workspace";
import { getOutstandAdapter } from "@/lib/adapters/outstand";
import { analyticsRepository } from "@/lib/repositories/analytics";
import { engagementRepository } from "@/lib/repositories/engagement";
import { mediaRepository } from "@/lib/repositories/media";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";

import type { McpToolServices } from "./tool-types";

/**
 * Composition root service BC lain untuk tool MCP (baca T-150.3, draft T-152), pola sama
 * composition root Server Action/halaman (`publish/calendar/page.tsx`,
 * `engage/page.tsx`, `page.tsx`). Stateless dan murah, dirakit per request.
 *
 * - `AnalyticsService` butuh `ActiveAccountsPort` (`WorkspaceService`).
 * - `MediaService` tanpa storage adapter: tidak ada signed URL dibuat dan
 *   `url` tidak dikembalikan tool.
 * - `EngagementService` dirakit malas: `getOutstandAdapter()` melempar bila
 *   `OUTSTAND_API_KEY` kosong, dan itu tidak boleh merusak tool lain.
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

  let engagement: EngagementService | undefined;
  return {
    workspace,
    media,
    publishing,
    analytics,
    drafts,
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
