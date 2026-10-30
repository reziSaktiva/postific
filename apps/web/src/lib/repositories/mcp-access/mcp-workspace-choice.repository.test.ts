import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserId, WorkspaceId } from "@postific/shared";

const { updateMany, create, findFirst, deleteMany } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    mcpWorkspaceChoice: { updateMany, create, findFirst, deleteMany },
  },
}));

import { Prisma } from "@/generated/prisma/client";

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
    const input = {
      sessionId: "sess-1",
      userId: USER,
      workspaceId: WORKSPACE,
      expiresAt: EXPIRES,
      createdAt: NOW,
    };
    const data = { workspaceId: WORKSPACE, expiresAt: EXPIRES, createdAt: NOW };

    function p2002() {
      return new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "test",
        meta: { modelName: "McpWorkspaceChoice" },
      });
    }

    it("updates only the row owned by the same user and skips create when it exists", async () => {
      updateMany.mockResolvedValue({ count: 1 });

      const choice = await mcpWorkspaceChoiceRepository.upsert(input);

      expect(updateMany).toHaveBeenCalledWith({
        where: { sessionId: "sess-1", userId: USER },
        data,
      });
      expect(create).not.toHaveBeenCalled();
      expect(choice).toEqual({
        sessionId: "sess-1",
        userId: USER,
        workspaceId: WORKSPACE,
        expiresAt: EXPIRES,
      });
    });

    it("creates the row when none is owned by this user yet", async () => {
      updateMany.mockResolvedValue({ count: 0 });
      create.mockResolvedValue(ROW);

      await mcpWorkspaceChoiceRepository.upsert(input);

      expect(create).toHaveBeenCalledWith({
        data: {
          sessionId: "sess-1",
          userId: USER,
          workspaceId: WORKSPACE,
          expiresAt: EXPIRES,
          createdAt: NOW,
        },
      });
    });

    it("retries the update when a concurrent save of the same user wins the create", async () => {
      updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });
      create.mockRejectedValue(p2002());

      await expect(
        mcpWorkspaceChoiceRepository.upsert(input),
      ).resolves.toMatchObject({ sessionId: "sess-1", userId: USER });
      expect(updateMany).toHaveBeenCalledTimes(2);
    });

    it("rethrows when the session id belongs to another user (never overwrites their row)", async () => {
      updateMany.mockResolvedValue({ count: 0 });
      const conflict = p2002();
      create.mockRejectedValue(conflict);

      await expect(mcpWorkspaceChoiceRepository.upsert(input)).rejects.toBe(
        conflict,
      );
      expect(updateMany).toHaveBeenCalledTimes(2);
    });

    it("rethrows errors that are not unique violations without retrying", async () => {
      updateMany.mockResolvedValue({ count: 0 });
      create.mockRejectedValue(new Error("db down"));

      await expect(mcpWorkspaceChoiceRepository.upsert(input)).rejects.toThrow(
        "db down",
      );
      expect(updateMany).toHaveBeenCalledTimes(1);
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

  describe("deleteForSession()", () => {
    it("deletes only the row owned by this session and user", async () => {
      deleteMany.mockResolvedValue({ count: 1 });

      await mcpWorkspaceChoiceRepository.deleteForSession({
        sessionId: "sess-1",
        userId: USER,
      });
      expect(deleteMany).toHaveBeenCalledWith({
        where: { sessionId: "sess-1", userId: USER },
      });
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
