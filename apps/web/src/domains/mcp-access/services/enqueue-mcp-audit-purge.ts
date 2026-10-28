import { startOfUtcDay } from "@/lib/jobs/utc-day";
import { MCP_AUDIT_PURGE_JOB_TYPE } from "./mcp-audit-purge-job-handler";

export interface EnqueueMcpAuditPurgeJobsPort {
  /**
   * `createdSince` diisi untuk fan-out harian: sudah ada job `mcp.audit.purge`
   * sejak awal hari UTC, atau yang masih pending/running. Tanpa
   * `createdSince`: hanya pending/running (trigger paksa `?type=...`).
   */
  hasJob(createdSince?: Date): Promise<boolean>;
  scheduleJob(input: {
    type: string;
    payload: Record<string, unknown>;
    scheduledAt: Date;
  }): Promise<void>;
}

/**
 * Fan-out JOB-08 (T-149.7). Satu job `mcp.audit.purge` per hari UTC, tanpa
 * payload (audit dihapus lintas workspace). Dipanggil cron menit yang sudah
 * hidup lewat `executeIfDue`; tidak menjalankan purge-nya, runner yang
 * mengklaim barisnya. Dua instance yang berlomba boleh menghasilkan dua job:
 * purge idempoten, jadi yang kedua menghapus 0.
 */
export class EnqueueMcpAuditPurgeUseCase {
  constructor(
    private readonly jobs: EnqueueMcpAuditPurgeJobsPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Paksa antrian baru. Job yang masih pending/running tidak digandakan. */
  async execute(): Promise<{ enqueued: number }> {
    return { enqueued: await this.enqueue() };
  }

  /**
   * Antrian harian. Dilewati bila sudah ada job sejak tengah malam UTC,
   * termasuk sisa job kemarin yang masih berjalan.
   */
  async executeIfDue(): Promise<{ enqueued: number; skipped: boolean }> {
    const enqueued = await this.enqueue(startOfUtcDay(this.now()));
    return { enqueued, skipped: enqueued === 0 };
  }

  private async enqueue(createdSince?: Date): Promise<number> {
    if (await this.jobs.hasJob(createdSince)) {
      return 0;
    }
    await this.jobs.scheduleJob({
      type: MCP_AUDIT_PURGE_JOB_TYPE,
      payload: {},
      scheduledAt: this.now(),
    });
    return 1;
  }
}
