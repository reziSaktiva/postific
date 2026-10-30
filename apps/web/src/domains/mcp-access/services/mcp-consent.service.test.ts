import { describe, expect, it, vi } from "vitest";
import {
  MemberRole,
  MemberStatus,
  asUserId,
  asWorkspaceId,
} from "@postific/shared";
import type { McpWorkspaceChoice } from "../entities/mcp-workspace-choice";
import { McpAccessDeniedError } from "../errors";
import type { IMcpClientIdentityRepository } from "../repositories/mcp-client-identity.repository";
import type { IMcpWorkspaceChoiceRepository } from "../repositories/mcp-workspace-choice.repository";
import {
  MCP_WORKSPACE_CHOICE_TTL_MS,
  McpConsentService,
} from "./mcp-consent.service";

const NOW = new Date("2026-10-30T03:00:00.000Z");
const USER = asUserId("user-1");
const OTHER_USER = asUserId("user-2");
const WS_A = asWorkspaceId("11111111-1111-4111-8111-111111111111");
const WS_B = asWorkspaceId("22222222-2222-4222-8222-222222222222");
const WS_C = asWorkspaceId("33333333-3333-4333-8333-333333333333");

/** Repository palsu di memori dengan kontrak `IMcpWorkspaceChoiceRepository`. */
function createChoiceRepository() {
  const rows = new Map<string, McpWorkspaceChoice>();
  const repository: IMcpWorkspaceChoiceRepository = {
    async upsert({ sessionId, userId, workspaceId, expiresAt }) {
      const row = { sessionId, userId, workspaceId, expiresAt };
      rows.set(sessionId, row);
      return row;
    },
    async findActive({ sessionId, userId }, now) {
      const row = rows.get(sessionId);
      return row && row.userId === userId && row.expiresAt > now ? row : null;
    },
    async deleteExpired(now) {
      let deleted = 0;
      for (const [key, row] of rows) {
        if (row.expiresAt <= now) {
          rows.delete(key);
          deleted += 1;
        }
      }
      return deleted;
    },
  };
  return { repository, rows };
}

function createService(
  options: {
    memberships?: Record<string, MemberStatus>;
    clock?: () => Date;
    registration?: Awaited<
      ReturnType<IMcpClientIdentityRepository["findRegistration"]>
    >;
  } = {},
) {
  const { repository, rows } = createChoiceRepository();
  const memberships = options.memberships ?? {
    [`${WS_A}:${USER}`]: MemberStatus.Active,
    [`${WS_B}:${USER}`]: MemberStatus.Active,
    [`${WS_C}:${USER}`]: MemberStatus.Pending,
  };
  const workspaces = {
    listWorkspacesForUser: vi.fn(async (userId: typeof USER) =>
      [
        { workspaceId: WS_A, name: "Kopi Selasar", role: MemberRole.Owner },
        { workspaceId: WS_B, name: "Roti Selasar", role: MemberRole.Admin },
      ].filter(
        (workspace) =>
          memberships[`${workspace.workspaceId}:${userId}`] ===
          MemberStatus.Active,
      ),
    ),
    countActiveConnectedAccounts: vi.fn(async (workspaceId: typeof WS_A) =>
      workspaceId === WS_A ? 3 : 2,
    ),
    getMembership: vi.fn(
      async (workspaceId: typeof WS_A, userId: typeof USER) => {
        const status = memberships[`${workspaceId}:${userId}`];
        return status ? { status } : null;
      },
    ),
  };
  const findRegistration = vi.fn(async () => options.registration ?? null);
  const service = new McpConsentService(
    repository,
    { findRegistration },
    workspaces,
    options.clock ?? (() => NOW),
  );
  return { service, rows, workspaces, findRegistration };
}

describe("McpConsentService", () => {
  describe("listSelectableWorkspaces", () => {
    it("returns only active-member workspaces with role and connected account count", async () => {
      const { service, workspaces } = createService();

      const result = await service.listSelectableWorkspaces(USER);

      expect(result).toEqual([
        {
          workspaceId: WS_A,
          name: "Kopi Selasar",
          role: MemberRole.Owner,
          connectedAccountCount: 3,
        },
        {
          workspaceId: WS_B,
          name: "Roti Selasar",
          role: MemberRole.Admin,
          connectedAccountCount: 2,
        },
      ]);
      expect(workspaces.countActiveConnectedAccounts).toHaveBeenCalledWith(
        WS_A,
        USER,
      );
    });

    it("returns an empty list for a user without any workspace", async () => {
      const { service } = createService();

      await expect(
        service.listSelectableWorkspaces(OTHER_USER),
      ).resolves.toEqual([]);
    });
  });

  describe("chooseWorkspace", () => {
    it("stores the choice for the session with a 10 minute expiry", async () => {
      const { service, rows } = createService();

      await service.chooseWorkspace({
        sessionId: "sess-1",
        userId: USER,
        workspaceId: WS_A,
      });

      expect(rows.get("sess-1")).toEqual({
        sessionId: "sess-1",
        userId: USER,
        workspaceId: WS_A,
        expiresAt: new Date(NOW.getTime() + MCP_WORKSPACE_CHOICE_TTL_MS),
      });
      expect(MCP_WORKSPACE_CHOICE_TTL_MS).toBe(10 * 60 * 1000);
    });

    it("overwrites an earlier choice of the same session (Ubah)", async () => {
      const { service, rows } = createService();

      await service.chooseWorkspace({
        sessionId: "sess-1",
        userId: USER,
        workspaceId: WS_A,
      });
      await service.chooseWorkspace({
        sessionId: "sess-1",
        userId: USER,
        workspaceId: WS_B,
      });

      expect(rows.size).toBe(1);
      expect(rows.get("sess-1")?.workspaceId).toBe(WS_B);
    });

    it.each([
      ["not a member at all", WS_B, OTHER_USER],
      ["a pending (not yet active) member", WS_C, USER],
    ])(
      "rejects with not_workspace_member and writes nothing when %s",
      async (_label, workspaceId, userId) => {
        const { service, rows } = createService();

        await expect(
          service.chooseWorkspace({
            sessionId: "sess-1",
            userId,
            workspaceId,
          }),
        ).rejects.toMatchObject({
          constructor: McpAccessDeniedError,
          reason: "not_workspace_member",
        });
        expect(rows.size).toBe(0);
      },
    );
  });

  describe("getActiveWorkspaceId", () => {
    it("returns the workspace chosen in this session", async () => {
      const { service } = createService();
      await service.chooseWorkspace({
        sessionId: "sess-1",
        userId: USER,
        workspaceId: WS_B,
      });

      await expect(service.getActiveWorkspaceId("sess-1", USER)).resolves.toBe(
        WS_B,
      );
    });

    it("returns null when nothing was chosen", async () => {
      const { service } = createService();

      await expect(
        service.getActiveWorkspaceId("sess-1", USER),
      ).resolves.toBeNull();
    });

    it("returns null once the choice has expired", async () => {
      let now = NOW;
      const { service } = createService({ clock: () => now });
      await service.chooseWorkspace({
        sessionId: "sess-1",
        userId: USER,
        workspaceId: WS_A,
      });

      now = new Date(NOW.getTime() + MCP_WORKSPACE_CHOICE_TTL_MS - 1);
      await expect(service.getActiveWorkspaceId("sess-1", USER)).resolves.toBe(
        WS_A,
      );
      now = new Date(NOW.getTime() + MCP_WORKSPACE_CHOICE_TTL_MS);
      await expect(
        service.getActiveWorkspaceId("sess-1", USER),
      ).resolves.toBeNull();
    });

    it("never reveals another user's choice for the same session id", async () => {
      const { service } = createService();
      await service.chooseWorkspace({
        sessionId: "sess-1",
        userId: USER,
        workspaceId: WS_A,
      });

      await expect(
        service.getActiveWorkspaceId("sess-1", OTHER_USER),
      ).resolves.toBeNull();
    });

    it("defends in depth when a repository returns a foreign row", async () => {
      const foreign: McpWorkspaceChoice = {
        sessionId: "sess-1",
        userId: OTHER_USER,
        workspaceId: WS_A,
        expiresAt: new Date(NOW.getTime() + 60_000),
      };
      const service = new McpConsentService(
        {
          upsert: vi.fn(),
          findActive: vi.fn(async () => foreign),
          deleteExpired: vi.fn(),
        },
        { findRegistration: vi.fn() },
        {
          listWorkspacesForUser: vi.fn(),
          countActiveConnectedAccounts: vi.fn(),
          getMembership: vi.fn(),
        },
        () => NOW,
      );

      await expect(
        service.getActiveWorkspaceId("sess-1", USER),
      ).resolves.toBeNull();
    });
  });

  describe("getSelectedWorkspace", () => {
    it("returns name and role of the chosen workspace", async () => {
      const { service } = createService();
      await service.chooseWorkspace({
        sessionId: "sess-1",
        userId: USER,
        workspaceId: WS_B,
      });

      await expect(
        service.getSelectedWorkspace("sess-1", USER),
      ).resolves.toEqual({
        workspaceId: WS_B,
        name: "Roti Selasar",
        role: MemberRole.Admin,
      });
    });

    it("returns null when there is no active choice", async () => {
      const { service } = createService();

      await expect(
        service.getSelectedWorkspace("sess-1", USER),
      ).resolves.toBeNull();
    });

    it("returns null when the user was removed from the chosen workspace between the steps", async () => {
      const memberships: Record<string, MemberStatus> = {
        [`${WS_A}:${USER}`]: MemberStatus.Active,
      };
      const { service } = createService({ memberships });
      await service.chooseWorkspace({
        sessionId: "sess-1",
        userId: USER,
        workspaceId: WS_A,
      });
      memberships[`${WS_A}:${USER}`] = MemberStatus.Removed;

      await expect(
        service.getSelectedWorkspace("sess-1", USER),
      ).resolves.toBeNull();
    });
  });

  describe("describeClient", () => {
    it("describes a registered client from its name and redirect hosts", async () => {
      const { service, findRegistration } = createService({
        registration: {
          name: "Claude",
          redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
        },
      });

      await expect(service.describeClient("client-1")).resolves.toEqual({
        name: "Claude",
        hosts: ["claude.ai"],
        isUnusual: false,
      });
      expect(findRegistration).toHaveBeenCalledWith("client-1");
    });

    it("returns a safe unusual identity for an unknown client", async () => {
      const { service } = createService({ registration: null });

      await expect(service.describeClient("ghost")).resolves.toEqual({
        name: null,
        hosts: [],
        isUnusual: true,
      });
    });
  });

  describe("purgeExpiredWorkspaceChoices", () => {
    it("removes only expired rows and is idempotent", async () => {
      let now = NOW;
      const { service, rows } = createService({ clock: () => now });
      await service.chooseWorkspace({
        sessionId: "old",
        userId: USER,
        workspaceId: WS_A,
      });
      now = new Date(NOW.getTime() + MCP_WORKSPACE_CHOICE_TTL_MS + 1);
      await service.chooseWorkspace({
        sessionId: "fresh",
        userId: USER,
        workspaceId: WS_B,
      });

      await expect(service.purgeExpiredWorkspaceChoices()).resolves.toBe(1);
      expect([...rows.keys()]).toEqual(["fresh"]);
      await expect(service.purgeExpiredWorkspaceChoices()).resolves.toBe(0);
    });
  });
});
