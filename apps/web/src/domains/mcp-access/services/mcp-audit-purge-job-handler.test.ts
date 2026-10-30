import { describe, expect, it, vi } from "vitest";
import { McpAccessService } from "./mcp-access.service";
import {
  MCP_AUDIT_PURGE_JOB_TYPE,
  McpAuditPurgeJobHandler,
} from "./mcp-audit-purge-job-handler";
import type { IMcpAuditRepository } from "../repositories/mcp-audit.repository";

const NOW = new Date("2026-10-26T00:05:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("McpAuditPurgeJobHandler", () => {
  it("registers the JOB-08 job type", () => {
    expect(MCP_AUDIT_PURGE_JOB_TYPE).toBe("mcp.audit.purge");
  });

  it("delegates to purgeAudit on every run", async () => {
    const purgeAudit = vi.fn(async () => ({ deleted: 3, cutoff: NOW }));
    const handler = new McpAuditPurgeJobHandler({ purgeAudit });

    await handler.handle();
    await handler.handle();

    expect(purgeAudit).toHaveBeenCalledTimes(2);
  });

  it("also purges expired rate limit windows in the same job (T-154, no new cron)", async () => {
    const purgeAudit = vi.fn(async () => ({ deleted: 0, cutoff: NOW }));
    const purgeRateLimitWindows = vi.fn(async () => ({ deleted: 4 }));
    const handler = new McpAuditPurgeJobHandler({
      purgeAudit,
      purgeRateLimitWindows,
    });

    await handler.handle();

    expect(purgeAudit).toHaveBeenCalledTimes(1);
    expect(purgeRateLimitWindows).toHaveBeenCalledTimes(1);
  });

  it("still purges rate limit windows when the audit purge fails, then rethrows", async () => {
    const purgeRateLimitWindows = vi.fn(async () => ({ deleted: 1 }));
    const handler = new McpAuditPurgeJobHandler({
      purgeAudit: async () => {
        throw new Error("audit down");
      },
      purgeRateLimitWindows,
    });

    await expect(handler.handle()).rejects.toThrow("audit down");
    expect(purgeRateLimitWindows).toHaveBeenCalledTimes(1);
  });

  it("still purges audit when the rate limit purge fails, then rethrows", async () => {
    const purgeAudit = vi.fn(async () => ({ deleted: 0, cutoff: NOW }));
    const handler = new McpAuditPurgeJobHandler({
      purgeAudit,
      purgeRateLimitWindows: async () => {
        throw new Error("counters down");
      },
    });

    await expect(handler.handle()).rejects.toThrow("counters down");
    expect(purgeAudit).toHaveBeenCalledTimes(1);
  });

  it("also purges expired OAuth workspace choices when a purger is supplied (T-151)", async () => {
    const order: string[] = [];
    const purgeAudit = vi.fn(async () => {
      order.push("audit");
      return { deleted: 0, cutoff: NOW };
    });
    const purgeExpiredWorkspaceChoices = vi.fn(async () => {
      order.push("choices");
      return 2;
    });
    const handler = new McpAuditPurgeJobHandler(
      { purgeAudit },
      { purgeExpiredWorkspaceChoices },
    );

    await handler.handle();

    expect(order).toEqual(["audit", "choices"]);
  });

  it("propagates a workspace choice purge failure so the job is retried", async () => {
    const handler = new McpAuditPurgeJobHandler(
      { purgeAudit: async () => ({ deleted: 0, cutoff: NOW }) },
      {
        purgeExpiredWorkspaceChoices: async () => {
          throw new Error("db down");
        },
      },
    );

    await expect(handler.handle()).rejects.toThrow("db down");
  });

  it("propagates errors so the job runner applies the generic retry", async () => {
    const handler = new McpAuditPurgeJobHandler({
      purgeAudit: async () => {
        throw new Error("db down");
      },
    });

    await expect(handler.handle()).rejects.toThrow("db down");
  });

  describe("idempotency against McpAccessService (fake audit repository)", () => {
    function createService(rows: Date[]) {
      const deleteOlderThan = vi.fn(async (cutoff: Date) => {
        const before = rows.length;
        const kept = rows.filter((createdAt) => createdAt >= cutoff);
        rows.length = 0;
        rows.push(...kept);
        return before - kept.length;
      });
      const audit = {
        create: vi.fn(),
        deleteOlderThan,
      } as unknown as IMcpAuditRepository;
      const service = new McpAccessService(
        {} as never,
        audit,
        {} as never,
        {} as never,
        () => NOW,
      );
      return { service, rows, deleteOlderThan };
    }

    it("second run without expired rows deletes nothing", async () => {
      const rows = [
        new Date(NOW.getTime() - 91 * DAY_MS),
        new Date(NOW.getTime() - 95 * DAY_MS),
        new Date(NOW.getTime() - 10 * DAY_MS),
      ];
      const { service, deleteOlderThan } = createService(rows);
      const handler = new McpAuditPurgeJobHandler(service);

      await handler.handle();
      expect(rows).toHaveLength(1);

      await handler.handle();
      expect(rows).toHaveLength(1);
      expect(deleteOlderThan).toHaveBeenCalledTimes(2);
      // Run kedua memakai cutoff sama (90 hari dari NOW) dan menghapus 0.
      const [firstCutoff] = deleteOlderThan.mock.calls[0] ?? [];
      const [secondCutoff] = deleteOlderThan.mock.calls[1] ?? [];
      expect(secondCutoff).toEqual(firstCutoff);
      await expect(service.purgeAudit()).resolves.toMatchObject({ deleted: 0 });
    });
  });
});
