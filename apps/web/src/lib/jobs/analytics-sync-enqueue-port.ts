import {
  ANALYTICS_SYNC_JOB_TYPE,
  type EnqueueAnalyticsSyncJobsPort,
} from "@/domains/analytics";
import { backgroundJobScheduler } from "@/lib/jobs/job-scheduler";
import { backgroundJobStore } from "@/lib/jobs/background-job-store";

/**
 * Composition root JOB-04 — satu tempat yang memetakan port antrian
 * analytics ke `background_jobs`, supaya route cron dan seed saat connect
 * memakai kunci payload yang sama.
 */
export function createAnalyticsSyncJobsPort(): EnqueueAnalyticsSyncJobsPort {
  return {
    hasAccountJob: (connectedAccountId, createdSince) =>
      backgroundJobStore.hasJobMatchingPayloadKey({
        type: ANALYTICS_SYNC_JOB_TYPE,
        key: "connectedAccountId",
        value: connectedAccountId,
        createdSince,
      }),
    hasWorkspaceSnapshot: (workspaceId, createdSince) =>
      backgroundJobStore.hasJobMatchingPayloadKey({
        type: ANALYTICS_SYNC_JOB_TYPE,
        key: "workspaceSnapshotId",
        value: workspaceId,
        createdSince,
      }),
    scheduleJob: (input) => backgroundJobScheduler.scheduleJob(input),
  };
}
