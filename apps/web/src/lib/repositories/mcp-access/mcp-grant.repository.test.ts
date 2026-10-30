import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpGrantId, UserId, WorkspaceId } from "@postific/shared";

const { findFirst, findMany, updateMany, queryRaw } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    mcpGrant: { findFirst, findMany, updateMany },
    $queryRaw: queryRaw,
  },
}));

import { mcpGrantRepository } from "./mcp-grant.repository";

const USER = "user-1" as UserId;
const OTHER_USER = "user-2" as UserId;
const WORKSPACE = "11111111-1111-4111-8111-111111111111" as WorkspaceId;
const GRANT_ID = "22222222-2222-4222-8222-222222222222" as McpGrantId;
const CREATED = new Date("2026-10-26T10:00:00.000Z");

const ROW = {
  id: GRANT_ID,
  workspaceId: WORKSPACE,
  userId: USER,
  clientId: "client-1",
  clientName: "Claude Code",
  // Urutan acak + nilai tak dikenal: harus dinormalkan dan dibuang.
  scopes: ["schedule", "read", "mcp:legacy", "read"],
  createdAt: CREATED,
  lastUsedAt: null as Date | null,
  revokedAt: null as Date | null,
};

describe("mcpGrantRepository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("row -> entity mapping", () => {
    it("maps branded ids, normalizes scopes and drops unknown ones (fail closed)", async () => {
      findFirst.mockResolvedValue(ROW);

      const grant = await mcpGrantRepository.findById(GRANT_ID, USER);

      expect(grant).toEqual({
        id: GRANT_ID,
        workspaceId: WORKSPACE,
        userId: USER,
        clientId: "client-1",
        clientName: "Claude Code",
        scopes: ["read", "schedule"],
        createdAt: CREATED,
        lastUsedAt: null,
        revokedAt: null,
      });
    });

    it("returns null when the grant does not exist", async () => {
      findFirst.mockResolvedValue(null);
      expect(await mcpGrantRepository.findById(GRANT_ID, USER)).toBeNull();
    });

    it("filters on id AND user_id (a grant of another user is never read by id alone)", async () => {
      findFirst.mockResolvedValue(null);

      await mcpGrantRepository.findById(GRANT_ID, OTHER_USER);

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: GRANT_ID, userId: OTHER_USER },
      });
    });
  });

  describe("findActiveByConnection()", () => {
    it("filters on ALL key columns and revoked_at IS NULL (no RLS safety net)", async () => {
      findFirst.mockResolvedValue(ROW);

      await mcpGrantRepository.findActiveByConnection({
        userId: USER,
        clientId: "client-1",
        workspaceId: WORKSPACE,
      });

      expect(findFirst).toHaveBeenCalledWith({
        where: {
          userId: USER,
          clientId: "client-1",
          workspaceId: WORKSPACE,
          revokedAt: null,
        },
      });
    });

    it("returns null when no active grant matches", async () => {
      findFirst.mockResolvedValue(null);

      const grant = await mcpGrantRepository.findActiveByConnection({
        userId: USER,
        clientId: "client-1",
        workspaceId: WORKSPACE,
      });

      expect(grant).toBeNull();
    });
  });

  describe("listActiveByUser()", () => {
    it("only lists the user's active grants, newest first", async () => {
      findMany.mockResolvedValue([ROW]);

      const grants = await mcpGrantRepository.listActiveByUser(USER);

      expect(findMany).toHaveBeenCalledWith({
        where: { userId: USER, revokedAt: null },
        orderBy: { createdAt: "desc" },
      });
      expect(grants).toHaveLength(1);
      expect(grants[0]?.id).toBe(GRANT_ID);
    });
  });

  describe("touchLastUsed()", () => {
    it("updates only an active grant of the exact connection (id, user, client, workspace, revoked_at IS NULL) and tolerates zero matches", async () => {
      updateMany.mockResolvedValue({ count: 0 });
      const usedAt = new Date("2026-10-26T11:00:00.000Z");

      await expect(
        mcpGrantRepository.touchLastUsed(
          GRANT_ID,
          { userId: USER, clientId: "client-1", workspaceId: WORKSPACE },
          usedAt,
        ),
      ).resolves.toBeUndefined();

      expect(updateMany).toHaveBeenCalledWith({
        where: {
          id: GRANT_ID,
          userId: USER,
          clientId: "client-1",
          workspaceId: WORKSPACE,
          revokedAt: null,
        },
        data: { lastUsedAt: usedAt },
      });
    });
  });

  describe("upsertActive()", () => {
    const RAW_ROW = {
      id: GRANT_ID,
      workspace_id: WORKSPACE,
      user_id: USER,
      client_id: "client-1",
      client_name: "Claude Code",
      scopes: ["read", "draft"],
      created_at: CREATED,
      last_used_at: null,
      revoked_at: null,
    };

    function sqlOf(call: unknown[]): string {
      const strings = call[0] as readonly string[];
      return strings.join("?").replace(/\s+/g, " ").trim();
    }

    it("issues INSERT ... ON CONFLICT on the partial unique index with the documented update semantics", async () => {
      queryRaw.mockResolvedValue([RAW_ROW]);

      const grant = await mcpGrantRepository.upsertActive({
        workspaceId: WORKSPACE,
        userId: USER,
        clientId: "client-1",
        clientName: "Claude Code",
        scopes: ["read", "draft"],
        createdAt: CREATED,
      });

      expect(queryRaw).toHaveBeenCalledTimes(1);
      const call = queryRaw.mock.calls[0] as unknown[];
      const sql = sqlOf(call);

      expect(sql).toContain('INSERT INTO "mcp_grants"');
      expect(sql).toContain(
        'ON CONFLICT ("user_id", "client_id", "workspace_id") WHERE "revoked_at" IS NULL DO UPDATE',
      );
      // scopes selalu diperbarui; client_name hanya bila input tidak NULL.
      expect(sql).toContain('"scopes" = EXCLUDED."scopes"');
      expect(sql).toContain(
        '"client_name" = COALESCE(EXCLUDED."client_name", "mcp_grants"."client_name")',
      );
      // id, created_at, last_used_at, revoked_at TIDAK pernah di-SET.
      const setClause = sql.slice(sql.indexOf("DO UPDATE SET"));
      const beforeReturning = setClause.slice(
        0,
        setClause.indexOf("RETURNING"),
      );
      expect(beforeReturning).not.toMatch(
        /"(id|created_at|last_used_at|revoked_at)" =/,
      );
      expect(sql).toContain("RETURNING");

      // Nilai terikat sebagai parameter (bukan disambung ke SQL).
      expect(call.slice(1)).toEqual([
        WORKSPACE,
        USER,
        "client-1",
        "Claude Code",
        ["read", "draft"],
        CREATED,
      ]);
      expect(sql).not.toContain("client-1");

      expect(grant).toMatchObject({
        id: GRANT_ID,
        workspaceId: WORKSPACE,
        userId: USER,
        clientId: "client-1",
        clientName: "Claude Code",
        scopes: ["read", "draft"],
        createdAt: CREATED,
        lastUsedAt: null,
        revokedAt: null,
      });
    });

    it("passes a null client name through (COALESCE keeps the stored name)", async () => {
      queryRaw.mockResolvedValue([{ ...RAW_ROW, client_name: "Nama lama" }]);

      const grant = await mcpGrantRepository.upsertActive({
        workspaceId: WORKSPACE,
        userId: USER,
        clientId: "client-1",
        clientName: null,
        scopes: ["read"],
        createdAt: CREATED,
      });

      const call = queryRaw.mock.calls[0] as unknown[];
      expect(call[4]).toBeNull();
      expect(grant.clientName).toBe("Nama lama");
    });

    it("throws when the statement returns no row", async () => {
      queryRaw.mockResolvedValue([]);

      await expect(
        mcpGrantRepository.upsertActive({
          workspaceId: WORKSPACE,
          userId: USER,
          clientId: "client-1",
          clientName: null,
          scopes: ["read"],
          createdAt: CREATED,
        }),
      ).rejects.toThrow(/tidak mengembalikan baris/);
    });
  });

  describe("findClientNames (T-157)", () => {
    it("filters by workspace and clientIds, includes revoked grants, newest name wins", async () => {
      findMany.mockResolvedValue([
        { clientId: "c1", clientName: "Terbaru" },
        { clientId: "c2", clientName: "Claude Code" },
        { clientId: "c1", clientName: "Lama" },
      ]);

      const names = await mcpGrantRepository.findClientNames(WORKSPACE, [
        "c1",
        "c2",
      ]);

      expect(names).toEqual(
        new Map([
          ["c1", "Terbaru"],
          ["c2", "Claude Code"],
        ]),
      );
      expect(findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: WORKSPACE,
          clientId: { in: ["c1", "c2"] },
          clientName: { not: null },
        },
        orderBy: { createdAt: "desc" },
        select: { clientId: true, clientName: true },
      });
      // Tidak memfilter revokedAt: grant dicabut tetap memberi nama.
      expect(JSON.stringify(findMany.mock.calls[0][0].where)).not.toContain(
        "revokedAt",
      );
    });

    it("returns an empty map without querying for empty clientIds", async () => {
      expect(await mcpGrantRepository.findClientNames(WORKSPACE, [])).toEqual(
        new Map(),
      );
      expect(findMany).not.toHaveBeenCalled();
    });
  });
});
