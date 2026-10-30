import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/prisma/client", () => ({ prisma: {} }));
vi.mock("@/lib/prisma/with-current-user", () => ({
  withCurrentUser: (
    _userId: string,
    fn: (tx: unknown) => Promise<unknown>,
  ): Promise<unknown> => fn({ publishingPost: { findMany } }),
}));

import { asUserId, asWorkspaceId } from "@postific/shared";
import { publishingRepository } from "./publishing.repository";

function row(id: string, publishedAt: Date, updatedAt: Date) {
  return {
    id,
    caption: id,
    status: "imported",
    scheduledAt: null,
    publishedAt,
    failedAt: null,
    createdAt: updatedAt,
    updatedAt,
    mediaIds: [],
    authorId: null,
    targets: [],
  };
}

describe("publishingRepository.listHistory ordering (T-142, T-145)", () => {
  beforeEach(() => findMany.mockReset());

  it("meminta urutan ke DB: occurredAt desc, tie-breaker updatedAt desc lalu id desc", async () => {
    findMany.mockResolvedValue([]);

    await publishingRepository.listHistory(
      { workspaceId: asWorkspaceId("w1") },
      asUserId("u1"),
    );

    expect(findMany.mock.calls[0]?.[0].orderBy).toEqual([
      { occurredAt: "desc" },
      { updatedAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("mempertahankan urutan baris dari DB (tanpa sort ulang di JS)", async () => {
    const importAt = new Date("2026-10-19T07:49:00Z");
    // DB sudah mengurutkan; repository tidak boleh mengubahnya.
    findMany.mockResolvedValue([
      row("new", new Date("2026-09-02T10:00:00Z"), importAt),
      row("old", new Date("2026-08-15T10:00:00Z"), importAt),
    ]);

    const items = await publishingRepository.listHistory(
      { workspaceId: asWorkspaceId("w1") },
      asUserId("u1"),
    );

    expect(items.map((i) => i.id)).toEqual(["new", "old"]);
  });
});

describe("publishingRepository.listHistory sumber pembuatan (T-157)", () => {
  beforeEach(() => findMany.mockReset());

  it("memetakan createdVia, createdViaClientId, dan nama klien beku (null bila belum terisi)", async () => {
    const at = new Date("2026-10-19T07:49:00Z");
    findMany.mockResolvedValue([
      {
        ...row("m", at, at),
        createdVia: "mcp",
        createdViaClientId: "c1",
        createdViaClientName: "Beku",
      },
      {
        ...row("a", at, at),
        createdVia: "app",
        createdViaClientId: null,
        createdViaClientName: null,
      },
    ]);

    const items = await publishingRepository.listHistory(
      { workspaceId: asWorkspaceId("w1") },
      asUserId("u1"),
    );

    expect(
      items.map((i) => [
        i.createdVia,
        i.createdViaClientId,
        i.createdViaClientName,
      ]),
    ).toEqual([
      ["mcp", "c1", "Beku"],
      ["app", null, null],
    ]);
  });
});
