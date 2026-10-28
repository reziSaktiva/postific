import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpGrantId, UserId, WorkspaceId } from "@postific/shared";

const { create, executeRaw } = vi.hoisted(() => ({
  create: vi.fn(),
  executeRaw: vi.fn(),
}));

vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    mcpAuditLog: { create },
    $executeRaw: executeRaw,
  },
}));

import {
  MCP_AUDIT_PURGE_BATCH_SIZE,
  mcpAuditRepository,
} from "./mcp-audit.repository";

const CREATED = new Date("2026-10-26T10:00:00.000Z");

describe("mcpAuditRepository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("create()", () => {
    it("stores the already-redacted summary as-is and maps the row to an entity", async () => {
      create.mockResolvedValue({
        id: "33333333-3333-4333-8333-333333333333",
        workspaceId: "ws-1",
        userId: "user-1",
        grantId: null,
        clientId: "client-1",
        toolName: "create_draft",
        scope: "draft",
        inputSummary: "caption: 120 karakter",
        status: "denied",
        errorCode: "no_active_grant",
        durationMs: 12,
        targetId: null,
        createdAt: CREATED,
      });

      const entry = await mcpAuditRepository.create({
        workspaceId: "ws-1" as WorkspaceId,
        userId: "user-1" as UserId,
        grantId: null,
        clientId: "client-1",
        toolName: "create_draft",
        scope: "draft",
        inputSummary: "caption: 120 karakter",
        status: "denied",
        errorCode: "no_active_grant",
        durationMs: 12,
        targetId: null,
        createdAt: CREATED,
      });

      expect(create).toHaveBeenCalledWith({
        data: {
          workspaceId: "ws-1",
          userId: "user-1",
          grantId: null,
          clientId: "client-1",
          toolName: "create_draft",
          scope: "draft",
          inputSummary: "caption: 120 karakter",
          status: "denied",
          errorCode: "no_active_grant",
          durationMs: 12,
          targetId: null,
          createdAt: CREATED,
        },
      });
      expect(entry).toMatchObject({
        id: "33333333-3333-4333-8333-333333333333",
        grantId: null,
        scope: "draft",
        status: "denied",
        errorCode: "no_active_grant",
      });
    });

    it("brands a non-null grant id", async () => {
      create.mockResolvedValue({
        id: "a",
        workspaceId: "ws-1",
        userId: "user-1",
        grantId: "grant-1",
        clientId: "c",
        toolName: "t",
        scope: "read",
        inputSummary: null,
        status: "success",
        errorCode: null,
        durationMs: null,
        targetId: null,
        createdAt: CREATED,
      });

      const entry = await mcpAuditRepository.create({
        workspaceId: "ws-1" as WorkspaceId,
        userId: "user-1" as UserId,
        grantId: "grant-1" as McpGrantId,
        clientId: "c",
        toolName: "t",
        scope: "read",
        inputSummary: null,
        status: "success",
        errorCode: null,
        durationMs: null,
        targetId: null,
        createdAt: CREATED,
      });

      expect(entry.grantId).toBe("grant-1");
    });
  });

  describe("deleteOlderThan()", () => {
    const cutoff = new Date("2026-07-28T00:00:00.000Z");

    it("returns 0 and issues a single statement when nothing is expired (idempotent)", async () => {
      executeRaw.mockResolvedValue(0);

      await expect(mcpAuditRepository.deleteOlderThan(cutoff)).resolves.toBe(0);

      expect(executeRaw).toHaveBeenCalledTimes(1);
      const call = executeRaw.mock.calls[0] as unknown[];
      const sql = (call[0] as readonly string[]).join("?").replace(/\s+/g, " ");
      expect(sql).toContain('DELETE FROM "mcp_audit_logs"');
      expect(sql).toContain('"created_at" < ?');
      expect(call.slice(1)).toEqual([cutoff, MCP_AUDIT_PURGE_BATCH_SIZE]);
    });

    it("deletes in batches until a batch is smaller than the batch size and returns the total", async () => {
      executeRaw
        .mockResolvedValueOnce(MCP_AUDIT_PURGE_BATCH_SIZE)
        .mockResolvedValueOnce(MCP_AUDIT_PURGE_BATCH_SIZE)
        .mockResolvedValueOnce(42);

      const total = await mcpAuditRepository.deleteOlderThan(cutoff);

      expect(executeRaw).toHaveBeenCalledTimes(3);
      expect(total).toBe(2 * MCP_AUDIT_PURGE_BATCH_SIZE + 42);
    });
  });
});
