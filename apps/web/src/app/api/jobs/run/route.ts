import { NextResponse } from "next/server";
import {
  ANALYTICS_SYNC_JOB_TYPE,
  AnalyticsIngestionUseCase,
  AnalyticsSyncJobHandler,
  EnqueueAnalyticsSyncUseCase,
} from "@/domains/analytics";
import {
  ENGAGEMENT_SYNC_JOB_TYPE,
  EngagementSyncJobHandler,
  SyncCommentsUseCase,
} from "@/domains/engagement";
import {
  BackfillOutstandPostIdsUseCase,
  ClassifyImportedPostTargetsUseCase,
  EnqueueImportSyncUseCase,
  IMPORT_SYNC_JOB_TYPE,
  ImportPostsProcessUseCase,
  ImportPostsTriggerUseCase,
  ImportSyncJobHandler,
  OutstandWebhookProcessor,
  RESOLVE_SCHEDULED_POST_OUTCOME_JOB_TYPE,
  ResolveScheduledPostOutcomeJobHandler,
} from "@/domains/publishing";
import { NotificationService } from "@/domains/notification";
import { getOutstandAdapter } from "@/lib/adapters/outstand";
import { getServerEnv } from "@/lib/env";
import { backgroundJobStore } from "@/lib/jobs/background-job-store";
import { engagementRepository } from "@/lib/repositories/engagement";
import { runPendingJobs, type JobHandler } from "@/lib/jobs/job-runner";
import { backgroundJobScheduler } from "@/lib/jobs/job-scheduler";
import { notificationRepository } from "@/lib/repositories/notification";
import { analyticsRepository } from "@/lib/repositories/analytics";
import { createAnalyticsSyncJobsPort } from "@/lib/jobs/analytics-sync-enqueue-port";
import { createImportSyncJobsPort } from "@/lib/jobs/import-sync-enqueue-port";
import {
  importJobRepository,
  publishingRepository,
} from "@/lib/repositories/publishing";
import { timingSafeEqualString } from "@/lib/utils/timing-safe-equal-string";
import { createActiveWorkspaceMembersPort } from "@/lib/workspace/active-members-port";
import { workspaceRepository } from "@/lib/repositories/workspace";

/**
 * Job runner Route Handler (T-027.1/.2, ADR-022/`background-jobs.md`).
 * Dipanggil Railway Cron (`cron` service, `railway.cron.json`) secara
 * periodik — TIDAK boleh dipanggil publik (T-027.2).
 *
 * Route Handler ini TIDAK boleh berisi business logic (AGENTS.md #5) —
 * hanya: (1) otentikasi header, (2) merakit handler registry dari
 * Application Service tiap domain (composition root, sama pola dengan
 * `/api/webhooks/outstand/route.ts` merakit `OutstandWebhookProcessor`),
 * (3) delegasi eksekusi ke `runPendingJobs` (`@/lib/jobs/job-runner`, murni
 * orkestrasi generik claim/retry/dead-letter).
 *
 * Registry: JOB-07 (`RESOLVE_SCHEDULED_POST_OUTCOME_JOB_TYPE`), JOB-03
 * (`ENGAGEMENT_SYNC_JOB_TYPE`), JOB-04 (`ANALYTICS_SYNC_JOB_TYPE`, T-048),
 * JOB-05 (`IMPORT_SYNC_JOB_TYPE`, T-115 — hanya baris antrian
 * `queued: true`). JOB-01 (webhook processing) SENGAJA TETAP inline sync di
 * `/api/webhooks/outstand/route.ts`.
 *
 * Fan-out JOB-04 dan JOB-05 menumpang cron menit yang sudah hidup
 * (`railway.cron.json`, tanpa crontab baru): paling banyak sekali per hari
 * UTC lewat `executeIfDue`, lalu `runPendingJobs` mengeksekusi job yang
 * due. `?type=analytics` dan `?type=import` memaksa antrian baru untuk
 * verifikasi manual. Kegagalan salah satu fan-out tidak boleh menahan
 * fan-out lain maupun JOB-03/JOB-07.
 */
export async function POST(request: Request): Promise<Response> {
  const { JOB_SECRET } = getServerEnv();
  const providedSecret = request.headers.get("x-job-secret");

  if (
    !JOB_SECRET ||
    !providedSecret ||
    !timingSafeEqualString(providedSecret, JOB_SECRET)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhookProcessor = new OutstandWebhookProcessor(
    publishingRepository,
    getOutstandAdapter(),
    workspaceRepository,
    new NotificationService(notificationRepository),
  );
  const resolveScheduledPostOutcomeHandler =
    new ResolveScheduledPostOutcomeJobHandler(webhookProcessor);

  // JOB-03 Engagement Sync (T-051, `background-jobs.md`). `backgroundJobScheduler`
  // di-reuse LANGSUNG dari `publishing` (singleton generic, cuma pass-through
  // ke `backgroundJobStore.enqueue`) — structural typing membuatnya valid
  // untuk `IJobScheduler` versi `engagement` juga tanpa implementasi
  // terpisah. `workspaceRepository` dipakai dua kali: sebagai
  // `WorkspaceOwnerLookupPort` (resolve acting user, lihat catatan
  // `EngagementSyncJobHandler`) DAN sebagai sumber `listActiveMembers` untuk
  // notifikasi aggregate (fan-out ke seluruh member aktif workspace).
  const syncCommentsUseCase = new SyncCommentsUseCase(
    engagementRepository,
    getOutstandAdapter(),
    publishingRepository,
    new NotificationService(notificationRepository),
    createActiveWorkspaceMembersPort(),
  );
  const engagementSyncHandler = new EngagementSyncJobHandler(
    syncCommentsUseCase,
    backgroundJobScheduler,
    workspaceRepository,
  );

  const analyticsIngestion = new AnalyticsIngestionUseCase(
    analyticsRepository,
    getOutstandAdapter(),
    // T-130/KI-093 — `publishingRepository` structural-typed sebagai
    // `TerminalPostsCountPort` (pola sama `publishingRepository` dipakai
    // langsung sebagai `AnalyticsSyncPostsPort` di bawah): `totalPosts`
    // snapshot sekarang dihitung dari status internal `PublishingPost`,
    // bukan `posts_count` Outstand (null untuk Facebook Page).
    publishingRepository,
  );
  const analyticsSyncHandler = new AnalyticsSyncJobHandler(
    analyticsIngestion,
    workspaceRepository,
    publishingRepository,
    workspaceRepository,
  );
  const enqueueAnalyticsSync = new EnqueueAnalyticsSyncUseCase(
    workspaceRepository,
    createAnalyticsSyncJobsPort(),
  );
  const outstandAdapter = getOutstandAdapter();
  const enqueueImportSync = new EnqueueImportSyncUseCase(
    workspaceRepository,
    createImportSyncJobsPort(),
  );
  const importSyncHandler = new ImportSyncJobHandler(
    new ImportPostsTriggerUseCase(
      importJobRepository,
      outstandAdapter,
      workspaceRepository,
      new ImportPostsProcessUseCase(publishingRepository),
      new BackfillOutstandPostIdsUseCase(publishingRepository, outstandAdapter),
      new ClassifyImportedPostTargetsUseCase(
        publishingRepository,
        outstandAdapter,
      ),
    ),
  );

  const jobType = new URL(request.url).searchParams.get("type");

  try {
    if (jobType === "analytics") {
      await enqueueAnalyticsSync.execute();
    } else {
      await enqueueAnalyticsSync.executeIfDue();
    }
  } catch (error) {
    console.error(
      "[jobs/run] fan-out analytics gagal, job lain tetap dijalankan:",
      error,
    );
  }

  try {
    if (jobType === "import") {
      await enqueueImportSync.execute();
    } else {
      await enqueueImportSync.executeIfDue();
    }
  } catch (error) {
    console.error(
      "[jobs/run] fan-out import gagal, job lain tetap dijalankan:",
      error,
    );
  }

  const handlers: Record<string, JobHandler> = {
    [RESOLVE_SCHEDULED_POST_OUTCOME_JOB_TYPE]: (payload) =>
      resolveScheduledPostOutcomeHandler.handle(payload),
    [ENGAGEMENT_SYNC_JOB_TYPE]: (payload) =>
      engagementSyncHandler.handle(payload),
    [ANALYTICS_SYNC_JOB_TYPE]: (payload) =>
      analyticsSyncHandler.handle(payload),
    [IMPORT_SYNC_JOB_TYPE]: (payload, jobId) =>
      importSyncHandler.handle(payload, jobId),
  };

  const summary = await runPendingJobs(backgroundJobStore, handlers);

  return NextResponse.json({ ok: true, ...summary }, { status: 200 });
}
