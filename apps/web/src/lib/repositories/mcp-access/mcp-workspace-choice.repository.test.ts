import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserId, WorkspaceId } from "@postific/shared";

const { upsert, findFirst, deleteMany } = vi.hoisted(() => ({
  upsert: vi.fn(),
  findFirst: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma/client", () => ({
  prisma: { mcpWorkspaceChoice: { upsert, findFirst, deleteMany } },
}));

import { mcpWorkspaceChoiceRepository } from "./mcp-workspace-choice.repository";

const USER = "user-1" as UserId;
const WORKSPACE = "11111111-1111-4111-8111-111111111111" as WorkspaceId;
const NOW = new Date("2026-10-30T03:00:00.000Z");
const EXPIRES = new Date("2026-10-30T03:10:00.000Z");

const ROW = {
  sessionId: "sess-1",
  userId: USER,
  workspaceId: WORKSPACE,
  createdAt: NOW,
  expiresAt: EXPIRES,
};

describe("mcpWorkspaceChoiceRepository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("upsert()", () => {
    it("upserts by session id so a new choice replaces the old one", async () => {
      upsert.mockResolvedValue(ROW);

      const choice = await mcpWorkspaceChoiceRepository.upsert({
        sessionId: "sess-1",
        userId: USER,
        workspaceId: WORKSPACE,
        expiresAt: EXPIRES,
        createdAt: NOW,
      });

      expect(upsert).toHaveBeenCalledWith({
        where: { sessionId: "sess-1" },
        create: {
          sessionId: "sess-1",
          userId: USER,
          workspaceId: WORKSPACE,
          expiresAt: EXPIRES,
          createdAt: NOW,
        },
        update: {
          userId: USER,
          workspaceId: WORKSPACE,
          expiresAt: EXPIRES,
          createdAt: NOW,
        },
      });
      expect(choice).toEqual({
        sessionId: "sess-1",
        userId: USER,
        workspaceId: WORKSPACE,
        expiresAt: EXPIRES,
      });
    });
  });

  describe("findActive()", () => {
    it("filters session id, owner and expiry in the query (ADR-141: no per-user RLS)", async () => {
      findFirst.mockResolvedValue(ROW);

      const choice = await mcpWorkspaceChoiceRepository.findActive(
        { sessionId: "sess-1", userId: USER },
        NOW,
      );

      expect(findFirst).toHaveBeenCalledWith({
        where: { sessionId: "sess-1", userId: USER, expiresAt: { gt: NOW } },
      });
      expect(choice).toEqual({
        sessionId: "sess-1",
        userId: USER,
        workspaceId: WORKSPACE,
        expiresAt: EXPIRES,
      });
    });

    it("returns null when there is no matching active row", async () => {
      findFirst.mockResolvedValue(null);

      await expect(
        mcpWorkspaceChoiceRepository.findActive(
          { sessionId: "sess-1", userId: "user-2" as UserId },
          NOW,
        ),
      ).resolves.toBeNull();
    });
  });

  describe("deleteExpired()", () => {
    it("deletes rows with expires_at <= now and reports the count", async () => {
      deleteMany.mockResolvedValue({ count: 4 });

      await expect(
        mcpWorkspaceChoiceRepository.deleteExpired(NOW),
      ).resolves.toBe(4);
      expect(deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lte: NOW } },
      });
    });

    it("returns 0 when nothing expired (idempotent)", async () => {
      deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        mcpWorkspaceChoiceRepository.deleteExpired(NOW),
      ).resolves.toBe(0);
    });
  });
});
