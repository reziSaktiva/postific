import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemberRole, asUserId, asWorkspaceId } from "@postific/shared";

const { memberFindFirst, accountGroupBy, withCurrentUser } = vi.hoisted(() => ({
  memberFindFirst: vi.fn(),
  accountGroupBy: vi.fn(),
  withCurrentUser: vi.fn(),
}));

vi.mock("@/lib/prisma/client", () => ({ prisma: {} }));
vi.mock("@/lib/prisma/with-current-user", () => ({
  withCurrentUser,
  setCurrentUserId: vi.fn(),
}));

import { workspaceRepository } from "./workspace.repository";

const USER = asUserId("user-1");
const WS_A = asWorkspaceId("11111111-1111-4111-8111-111111111111");
const WS_B = asWorkspaceId("22222222-2222-4222-8222-222222222222");

describe("workspaceRepository (T-180.6: lookup per id dan hitungan batch)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    withCurrentUser.mockImplementation((_userId, fn) =>
      fn({
        workspaceMember: { findFirst: memberFindFirst },
        workspaceConnectedAccount: { groupBy: accountGroupBy },
      }),
    );
  });

  describe("findWorkspaceForUser", () => {
    it("filters by workspace, user, and active membership, and maps the summary", async () => {
      memberFindFirst.mockResolvedValue({
        role: "admin",
        workspace: { id: WS_A, name: "Kopi", slug: "kopi" },
      });

      await expect(
        workspaceRepository.findWorkspaceForUser(WS_A, USER),
      ).resolves.toEqual({
        workspaceId: WS_A,
        name: "Kopi",
        slug: "kopi",
        role: MemberRole.Admin,
      });
      expect(withCurrentUser).toHaveBeenCalledWith(USER, expect.any(Function));
      expect(memberFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: WS_A, userId: USER, status: "active" },
        }),
      );
    });

    it("returns null when the user is not an active member", async () => {
      memberFindFirst.mockResolvedValue(null);

      await expect(
        workspaceRepository.findWorkspaceForUser(WS_A, USER),
      ).resolves.toBeNull();
    });
  });

  describe("countActiveConnectedAccountsByWorkspace", () => {
    it("counts only active accounts in one grouped query and zero-fills missing ids", async () => {
      accountGroupBy.mockResolvedValue([
        { workspaceId: WS_A, _count: { _all: 3 } },
      ]);

      const counts =
        await workspaceRepository.countActiveConnectedAccountsByWorkspace(
          [WS_A, WS_B],
          USER,
        );

      expect(counts.get(WS_A)).toBe(3);
      expect(counts.get(WS_B)).toBe(0);
      expect(accountGroupBy).toHaveBeenCalledTimes(1);
      expect(accountGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: { in: [WS_A, WS_B] }, status: "active" },
        }),
      );
    });

    it("skips the query for an empty list", async () => {
      const counts =
        await workspaceRepository.countActiveConnectedAccountsByWorkspace(
          [],
          USER,
        );

      expect(counts.size).toBe(0);
      expect(withCurrentUser).not.toHaveBeenCalled();
    });
  });
});
