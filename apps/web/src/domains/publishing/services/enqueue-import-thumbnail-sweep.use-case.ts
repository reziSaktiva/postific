import { startOfUtcDay } from "@/lib/jobs/utc-day";
import { IMPORT_THUMBNAIL_SWEEP_JOB_TYPE } from "./import-thumbnail-sweep-job-handler";

export interface EnqueueImportThumbnailSweepJobsPort {
  /**
   * `createdSince` diisi untuk fan-out harian: sudah ada job sejak awal hari
   * UTC, atau yang masih pending/running. Tanpa `createdSince`: hanya
   * pending/running (trigger paksa `?type=import-media-sweep`).
   */
  hasJob(createdSince?: Date): Promise<boolean>;
  scheduleJob(input: {
    type: string;
    payload: Record<string, unknown>;
    scheduledAt: Date;
  }): Promise<void>;
}

/**
 * Fan-out JOB-10 (T-231): satu job `import.media.sweep` per hari UTC tanpa
 * payload, pola sama JOB-08. Penyapuan idempoten, jadi dua instance yang
 * berlomba hanya membuat sapuan kedua yang menghapus 0.
 */
export class EnqueueImportThumbnailSweepUseCase {
  constructor(
    private readonly jobs: EnqueueImportThumbnailSweepJobsPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async executeIfDue(): Promise<{ enqueued: number; skipped: boolean }> {
    const now = this.now();
    if (await this.jobs.hasJob(startOfUtcDay(now))) {
      return { enqueued: 0, skipped: true };
    }
    await this.schedule(now);
    return { enqueued: 1, skipped: false };
  }

  async execute(): Promise<{ enqueued: number }> {
    if (await this.jobs.hasJob(undefined)) return { enqueued: 0 };
    await this.schedule(this.now());
    return { enqueued: 1 };
  }

  private schedule(scheduledAt: Date): Promise<void> {
    return this.jobs.scheduleJob({
      type: IMPORT_THUMBNAIL_SWEEP_JOB_TYPE,
      payload: {},
      scheduledAt,
    });
  }
}
