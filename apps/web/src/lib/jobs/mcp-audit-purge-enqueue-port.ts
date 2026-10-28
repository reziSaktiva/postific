import {
  MCP_AUDIT_PURGE_JOB_TYPE,
  type EnqueueMcpAuditPurgeJobsPort,
} from "@/domains/mcp-access";
import { backgroundJobScheduler } from "@/lib/jobs/job-scheduler";
import { backgroundJobStore } from "@/lib/jobs/background-job-store";

/**
 * Composition root JOB-08 — memetakan port antrian purge audit MCP ke
 * `background_jobs`. Payload job kosong, jadi dedup berbasis tipe job
 * (`hasJobOfType`), bukan kunci payload seperti analytics/import.
 */
export function createMcpAuditPurgeJobsPort(): EnqueueMcpAuditPurgeJobsPort {
  return {
    hasJob: (createdSince) =>
      backgroundJobStore.hasJobOfType({
        type: MCP_AUDIT_PURGE_JOB_TYPE,
        createdSince,
      }),
    scheduleJob: (input) => backgroundJobScheduler.scheduleJob(input),
  };
}
