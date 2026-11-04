import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("@/lib/prisma/client", () => ({ prisma: {} }));
vi.mock("@/lib/prisma/with-current-user", () => ({
  withCurrentUser: (
    _userId: string,
    fn: (tx: unknown) => Promise<unknown>,
  ): Promise<unknown> => fn({ publishingPost: { findFirst } }),
}));

import { asUserId, asWorkspaceId } from "@postific/shared";
import { publishingRepository } from "./publishing.repository";

const WORKSPACE = asWorkspaceId("ws-1");
const USER = asUserId("user-1");

describe("publishingRepository.findLatestPostTargetAccountIds (T-201.2)", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("maps the latest post's targets to account ids in target order", async () => {
    findFirst.mockResolvedValue({
      targets: [
        { connectedAccountId: "acc-1" },
        { connectedAccountId: "acc-2" },
      ],
    });

    await expect(
      publishingRepository.findLatestPostTargetAccountIds(
        { workspaceId: WORKSPACE },
        USER,
      ),
    ).resolves.toEqual(["acc-1", "acc-2"]);
  });

  it("returns an empty list when the workspace has no post with targets", async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      publishingRepository.findLatestPostTargetAccountIds(
        { workspaceId: WORKSPACE },
        USER,
      ),
    ).resolves.toEqual([]);
  });

  it("ignores imported posts, deleted posts, and posts without targets, newest first", async () => {
    findFirst.mockResolvedValue(null);

    await publishingRepository.findLatestPostTargetAccountIds(
      { workspaceId: WORKSPACE },
      USER,
    );

    const args = findFirst.mock.calls[0]?.[0];
    expect(args.where).toMatchObject({
      workspaceId: "ws-1",
      deletedAt: null,
      status: { not: "imported" },
      targets: { some: {} },
    });
    expect(args.orderBy).toEqual({ createdAt: "desc" });
  });
});
