import type { IJobScheduler } from "@/domains/publishing";
import { backgroundJobStore } from "./background-job-store";

/**
 * Implementasi konkret `IJobScheduler` (port domain `publishing`, T-027.5)
 * — satu-satunya adopter saat ini adalah `SchedulePostsUseCase`. Singleton
 * sama pola dengan `publishingRepository` / composition-root adapters.
 */
export const backgroundJobScheduler: IJobScheduler = {
  async scheduleJob(input) {
    await backgroundJobStore.enqueue({
      type: input.type,
      payload: input.payload,
      scheduledAt: input.scheduledAt,
    });
  },
};
