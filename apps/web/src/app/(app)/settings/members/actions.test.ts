import {
  asMemberId,
  asUserId,
  asWorkspaceId,
  MemberRole,
} from "@postific/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "@/lib/utils/errors";

const { getSessionMock, redirectMock, revalidatePathMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/better-auth/auth", () => ({
  auth: { api: { getSession: getSessionMock } },
}));

// getWorkspaceContext() (ADR-076) membaca workspaceId/role dari header yang
// di-inject proxy.ts — di test ini disimulasikan lewat Headers berisi
// x-workspace-id/x-workspace-role, bukan Headers() kosong seperti sebelum
// migrasi (waktu itu workspace di-resolve dari `slug`, bukan header).
// String workspace id di-literal-kan (bukan referensi ke `WORKSPACE.id` di
// bawah) karena factory ini dieksekusi saat modul "next/headers" pertama
// di-resolve (lewat import "./actions" di bawah) — sebelum `const WORKSPACE`
// di file ini terinisialisasi.
vi.mock("next/headers", () => ({
  headers: vi.fn(
    async () =>
      new Headers({
        "x-workspace-id": "workspace-1",
        "x-workspace-role": MemberRole.Owner,
      }),
  ),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

// `@/lib/repositories/workspace` loads the Prisma client at module scope —
// stub it out so tests don't need a real DB connection. The fake repository
// is never actually exercised: `WorkspaceService` methods are spied on
// directly below, since this test verifies action→service wiring only,
// not domain/RBAC logic (already covered by workspace.service.test.ts).
vi.mock("@/lib/repositories/workspace", () => ({
  workspaceRepository: {},
}));

import { WorkspaceService } from "@/domains/workspace";
import { removeMemberAction, updateMemberRoleAction } from "./actions";

const WORKSPACE = {
  id: asWorkspaceId("workspace-1"),
  name: "Acme",
  slug: "acme",
};
const TARGET_MEMBER_ID = "member-1";

describe("members server actions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getSessionMock.mockReset();
    redirectMock.mockClear();
    revalidatePathMock.mockClear();
  });

  describe("removeMemberAction", () => {
    it("redirects to /login and does not call the service when unauthenticated", async () => {
      getSessionMock.mockResolvedValue(null);
      const removeMemberSpy = vi.spyOn(
        WorkspaceService.prototype,
        "removeMember",
      );

      await expect(removeMemberAction(TARGET_MEMBER_ID)).rejects.toThrow(
        "REDIRECT:/login",
      );

      expect(redirectMock).toHaveBeenCalledWith("/login");
      expect(removeMemberSpy).not.toHaveBeenCalled();
    });

    it("translates a domain error into { error } instead of throwing", async () => {
      getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
      vi.spyOn(WorkspaceService.prototype, "removeMember").mockRejectedValue(
        new AuthorizationError(
          "Hanya Owner atau Admin yang bisa menghapus anggota.",
        ),
      );

      const result = await removeMemberAction(TARGET_MEMBER_ID);

      expect(result).toEqual({
        error: "Hanya Owner atau Admin yang bisa menghapus anggota.",
      });
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });

    it("delegates to WorkspaceService.removeMember and revalidates on success", async () => {
      getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
      const removeMemberSpy = vi
        .spyOn(WorkspaceService.prototype, "removeMember")
        .mockResolvedValue(undefined);

      const result = await removeMemberAction(TARGET_MEMBER_ID);

      expect(result).toEqual({});
      expect(removeMemberSpy).toHaveBeenCalledWith(
        WORKSPACE.id,
        asUserId("user-1"),
        asMemberId(TARGET_MEMBER_ID),
      );
      expect(revalidatePathMock).toHaveBeenCalledWith("/settings/members");
    });
  });

  describe("updateMemberRoleAction", () => {
    it("redirects to /login and does not call the service when unauthenticated", async () => {
      getSessionMock.mockResolvedValue(null);
      const updateMemberRoleSpy = vi.spyOn(
        WorkspaceService.prototype,
        "updateMemberRole",
      );

      await expect(
        updateMemberRoleAction(TARGET_MEMBER_ID, MemberRole.Admin),
      ).rejects.toThrow("REDIRECT:/login");

      expect(redirectMock).toHaveBeenCalledWith("/login");
      expect(updateMemberRoleSpy).not.toHaveBeenCalled();
    });

    it("translates a domain error into { error } instead of throwing", async () => {
      getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
      vi.spyOn(
        WorkspaceService.prototype,
        "updateMemberRole",
      ).mockRejectedValue(
        new AuthorizationError(
          "Hanya Owner atau Admin yang bisa mengubah role anggota.",
        ),
      );

      const result = await updateMemberRoleAction(
        TARGET_MEMBER_ID,
        MemberRole.Admin,
      );

      expect(result).toEqual({
        error: "Hanya Owner atau Admin yang bisa mengubah role anggota.",
      });
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });

    it("delegates to WorkspaceService.updateMemberRole and revalidates on success", async () => {
      getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
      const updateMemberRoleSpy = vi
        .spyOn(WorkspaceService.prototype, "updateMemberRole")
        .mockResolvedValue(undefined);

      const result = await updateMemberRoleAction(
        TARGET_MEMBER_ID,
        MemberRole.Admin,
      );

      expect(result).toEqual({});
      expect(updateMemberRoleSpy).toHaveBeenCalledWith(
        WORKSPACE.id,
        asUserId("user-1"),
        asMemberId(TARGET_MEMBER_ID),
        MemberRole.Admin,
      );
      expect(revalidatePathMock).toHaveBeenCalledWith("/settings/members");
    });
  });
});
