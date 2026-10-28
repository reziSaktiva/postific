import { asUserId, asWorkspaceId } from "@postific/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { txMock, withCurrentUserMock } = vi.hoisted(() => {
  const txMock = {
    startPagePage: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    startPageLink: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return {
    txMock,
    withCurrentUserMock: vi.fn(
      async (_userId: string, cb: (tx: typeof txMock) => Promise<unknown>) =>
        cb(txMock),
    ),
  };
});

vi.mock("@/lib/prisma/with-current-user", () => ({
  withCurrentUser: withCurrentUserMock,
}));

import { Prisma } from "@/generated/prisma/client";
import {
  StartPageAlreadyExistsError,
  StartPageSlugTakenError,
} from "@/domains/start-page";
import { startPageRepository } from "./start-page-write.repository";

const WS = asWorkspaceId("11111111-1111-4111-8111-111111111111");
const USER = asUserId("user-1");

function p2025() {
  return new Prisma.PrismaClientKnownRequestError("not found", {
    code: "P2025",
    clientVersion: "test",
  });
}

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("unique", {
    code: "P2002",
    clientVersion: "test",
    meta: { modelName: "StartPagePage" },
  });
}

const ROW = {
  id: "p1",
  workspaceId: WS,
  slug: "raka",
  title: "Raka",
  bio: null,
  avatarUrl: null,
  theme: "legacy-theme",
  isPublished: false,
  viewCount: BigInt(7),
  createdAt: new Date(0),
  updatedAt: new Date(0),
  links: [
    {
      id: "l1",
      startPageId: "p1",
      label: "Shop",
      url: "https://a.test/",
      position: 0,
      isActive: true,
      clickCount: BigInt(3),
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
  ],
};

describe("startPageRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findByWorkspace scopes by workspace, runs under withCurrentUser, and maps bigint/theme", async () => {
    txMock.startPagePage.findFirst.mockResolvedValue(ROW);
    const result = await startPageRepository.findByWorkspace(
      { workspaceId: WS },
      USER,
    );
    expect(withCurrentUserMock.mock.calls[0]![0]).toBe(USER);
    expect(txMock.startPagePage.findFirst.mock.calls[0]![0].where).toEqual({
      workspaceId: WS,
    });
    expect(result?.viewCount).toBe(7);
    expect(result?.links[0]?.clickCount).toBe(3);
    expect(result?.theme).toBe("default");
  });

  it("findByWorkspace returns null when there is no page", async () => {
    txMock.startPagePage.findFirst.mockResolvedValue(null);
    await expect(
      startPageRepository.findByWorkspace({ workspaceId: WS }, USER),
    ).resolves.toBeNull();
  });

  it("create forces isPublished=false and translates a slug collision", async () => {
    txMock.startPagePage.create.mockRejectedValueOnce(p2002());
    txMock.startPagePage.findFirst.mockResolvedValue(null);
    await expect(
      startPageRepository.create(
        {
          workspaceId: WS,
          data: {
            slug: "raka",
            title: "Raka",
            bio: null,
            avatarUrl: null,
            theme: "default",
          },
        },
        USER,
      ),
    ).rejects.toBeInstanceOf(StartPageSlugTakenError);
    expect(txMock.startPagePage.create.mock.calls[0]![0].data.isPublished).toBe(
      false,
    );
  });

  it("create translates a workspace-unique collision to AlreadyExists", async () => {
    txMock.startPagePage.create.mockRejectedValueOnce(p2002());
    txMock.startPagePage.findFirst.mockResolvedValue(ROW);
    await expect(
      startPageRepository.create(
        {
          workspaceId: WS,
          data: {
            slug: "raka",
            title: "Raka",
            bio: null,
            avatarUrl: null,
            theme: "default",
          },
        },
        USER,
      ),
    ).rejects.toBeInstanceOf(StartPageAlreadyExistsError);
  });

  it("update returns null without a page and maps slug collision", async () => {
    txMock.startPagePage.findFirst.mockResolvedValue(null);
    await expect(
      startPageRepository.update(
        { workspaceId: WS, data: { title: "x" } },
        USER,
      ),
    ).resolves.toBeNull();

    txMock.startPagePage.findFirst.mockResolvedValue({ id: "p1" });
    txMock.startPagePage.update.mockRejectedValue(p2002());
    await expect(
      startPageRepository.update(
        { workspaceId: WS, data: { slug: "taken" } },
        USER,
      ),
    ).rejects.toBeInstanceOf(StartPageSlugTakenError);
  });

  it("update rethrows non-unique errors", async () => {
    txMock.startPagePage.findFirst.mockResolvedValue({ id: "p1" });
    txMock.startPagePage.update.mockRejectedValue(new Error("db down"));
    await expect(
      startPageRepository.update(
        { workspaceId: WS, data: { slug: "taken" } },
        USER,
      ),
    ).rejects.toThrow("db down");
  });

  it("addLink appends after the max position", async () => {
    txMock.startPagePage.findFirst.mockResolvedValue({ id: "p1" });
    txMock.startPageLink.aggregate.mockResolvedValue({ _max: { position: 4 } });
    txMock.startPageLink.create.mockResolvedValue(ROW.links[0]);
    await startPageRepository.addLink(
      {
        workspaceId: WS,
        data: { label: "Shop", url: "https://a.test/", isActive: true },
      },
      USER,
    );
    expect(txMock.startPageLink.create.mock.calls[0]![0].data).toMatchObject({
      startPageId: "p1",
      position: 5,
    });
  });

  it("addLink starts at 0 on an empty page and returns null without a page", async () => {
    txMock.startPagePage.findFirst.mockResolvedValueOnce({ id: "p1" });
    txMock.startPageLink.aggregate.mockResolvedValue({
      _max: { position: null },
    });
    txMock.startPageLink.create.mockResolvedValue(ROW.links[0]);
    await startPageRepository.addLink(
      {
        workspaceId: WS,
        data: { label: "Shop", url: "https://a.test/", isActive: true },
      },
      USER,
    );
    expect(txMock.startPageLink.create.mock.calls[0]![0].data.position).toBe(0);

    txMock.startPagePage.findFirst.mockResolvedValueOnce(null);
    await expect(
      startPageRepository.addLink(
        {
          workspaceId: WS,
          data: { label: "x", url: "https://a.test/", isActive: true },
        },
        USER,
      ),
    ).resolves.toBeNull();
  });

  it("updateLink/deleteLink scope by the owning page's workspace (anti-IDOR)", async () => {
    txMock.startPageLink.findFirst.mockResolvedValue(null);
    await expect(
      startPageRepository.updateLink(
        { workspaceId: WS, linkId: "l1", data: { label: "x" } },
        USER,
      ),
    ).resolves.toBeNull();
    expect(txMock.startPageLink.findFirst.mock.calls[0]![0].where).toEqual({
      id: "l1",
      startPage: { workspaceId: WS },
    });
    expect(txMock.startPageLink.update).not.toHaveBeenCalled();

    txMock.startPagePage.findFirst.mockResolvedValue({ id: "p1" });
    txMock.startPageLink.deleteMany.mockResolvedValue({ count: 0 });
    await expect(
      startPageRepository.deleteLink({ workspaceId: WS, linkId: "l1" }, USER),
    ).resolves.toBe(false);
    expect(txMock.startPagePage.findFirst.mock.calls.at(-1)![0].where).toEqual({
      workspaceId: WS,
    });
    expect(txMock.startPageLink.deleteMany.mock.calls[0]![0].where).toEqual({
      id: "l1",
      startPage: { workspaceId: WS },
    });
    // Tidak ada yang terhapus: tidak ada pemadatan.
    expect(txMock.startPageLink.findMany).not.toHaveBeenCalled();
    expect(txMock.startPageLink.updateMany).not.toHaveBeenCalled();
  });

  it("deleteLink returns false without a page and never deletes", async () => {
    txMock.startPagePage.findFirst.mockResolvedValue(null);
    await expect(
      startPageRepository.deleteLink({ workspaceId: WS, linkId: "l1" }, USER),
    ).resolves.toBe(false);
    expect(txMock.startPageLink.deleteMany).not.toHaveBeenCalled();
  });

  it("deleteLink compacts remaining positions to 0..n-1 in the same transaction (T-162.2)", async () => {
    txMock.startPagePage.findFirst.mockResolvedValue({ id: "p1" });
    txMock.startPageLink.deleteMany.mockResolvedValue({ count: 1 });
    // Posisi 1 dihapus: sisa 0, 2, 3 -> harus jadi 0, 1, 2 (urutan dijaga).
    txMock.startPageLink.findMany.mockResolvedValue([
      { id: "a", position: 0 },
      { id: "c", position: 2 },
      { id: "d", position: 3 },
    ]);
    txMock.startPageLink.updateMany.mockResolvedValue({ count: 1 });
    await expect(
      startPageRepository.deleteLink({ workspaceId: WS, linkId: "b" }, USER),
    ).resolves.toBe(true);

    expect(withCurrentUserMock).toHaveBeenCalledTimes(1);
    expect(txMock.startPageLink.findMany.mock.calls[0]![0]).toMatchObject({
      where: { startPageId: "p1" },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    });
    // Baris yang sudah benar (a: 0) tidak ditulis ulang; sisanya dipadatkan
    // dan di-scope ke halaman workspace.
    expect(txMock.startPageLink.updateMany.mock.calls.map((c) => c[0])).toEqual(
      [
        { where: { id: "c", startPageId: "p1" }, data: { position: 1 } },
        { where: { id: "d", startPageId: "p1" }, data: { position: 2 } },
      ],
    );
  });

  it("deleteLink does not rewrite positions that are already dense", async () => {
    txMock.startPagePage.findFirst.mockResolvedValue({ id: "p1" });
    txMock.startPageLink.deleteMany.mockResolvedValue({ count: 1 });
    txMock.startPageLink.findMany.mockResolvedValue([
      { id: "a", position: 0 },
      { id: "b", position: 1 },
    ]);
    await expect(
      startPageRepository.deleteLink({ workspaceId: WS, linkId: "c" }, USER),
    ).resolves.toBe(true);
    expect(txMock.startPageLink.updateMany).not.toHaveBeenCalled();
  });

  it("reorderLinks applies positions 0..n-1 only for the exact link set", async () => {
    txMock.startPagePage.findFirst.mockResolvedValue({ id: "p1" });
    txMock.startPageLink.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    await expect(
      startPageRepository.reorderLinks(
        { workspaceId: WS, orderedLinkIds: ["b", "a"] },
        USER,
      ),
    ).resolves.toBe(true);
    expect(txMock.startPageLink.update.mock.calls.map((c) => c[0])).toEqual([
      { where: { id: "b" }, data: { position: 0 } },
      { where: { id: "a" }, data: { position: 1 } },
    ]);
  });

  it("reorderLinks refuses foreign or stale sets without writing", async () => {
    txMock.startPagePage.findFirst.mockResolvedValue({ id: "p1" });
    txMock.startPageLink.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    await expect(
      startPageRepository.reorderLinks(
        { workspaceId: WS, orderedLinkIds: ["a", "foreign"] },
        USER,
      ),
    ).resolves.toBe(false);
    await expect(
      startPageRepository.reorderLinks(
        { workspaceId: WS, orderedLinkIds: ["a"] },
        USER,
      ),
    ).resolves.toBe(false);
    expect(txMock.startPageLink.update).not.toHaveBeenCalled();
  });

  it("reorderLinks turns P2025 (link deleted mid-transaction) into false, other errors propagate", async () => {
    txMock.startPagePage.findFirst.mockResolvedValue({ id: "p1" });
    txMock.startPageLink.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    txMock.startPageLink.update.mockRejectedValueOnce(p2025());
    await expect(
      startPageRepository.reorderLinks(
        { workspaceId: WS, orderedLinkIds: ["b", "a"] },
        USER,
      ),
    ).resolves.toBe(false);

    txMock.startPageLink.update.mockRejectedValueOnce(new Error("db down"));
    await expect(
      startPageRepository.reorderLinks(
        { workspaceId: WS, orderedLinkIds: ["b", "a"] },
        USER,
      ),
    ).rejects.toThrow("db down");
  });

  it("updateLink and update turn P2025 into null (not found)", async () => {
    txMock.startPageLink.findFirst.mockResolvedValue({ id: "l1" });
    txMock.startPageLink.update.mockRejectedValue(p2025());
    await expect(
      startPageRepository.updateLink(
        { workspaceId: WS, linkId: "l1", data: { label: "x" } },
        USER,
      ),
    ).resolves.toBeNull();

    txMock.startPagePage.findFirst.mockResolvedValue({ id: "p1" });
    txMock.startPagePage.update.mockRejectedValue(p2025());
    await expect(
      startPageRepository.update(
        { workspaceId: WS, data: { title: "x" } },
        USER,
      ),
    ).resolves.toBeNull();
  });
});
