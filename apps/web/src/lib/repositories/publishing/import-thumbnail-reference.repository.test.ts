import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("@/lib/prisma/client", () => ({ prisma: { $queryRaw: queryRaw } }));

import { importThumbnailReferenceRepository } from "./import-thumbnail-reference.repository";

describe("importThumbnailReferenceRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the referenced paths from the SECURITY DEFINER function", async () => {
    queryRaw.mockResolvedValue([{ storage_path: "w/imports/a.webp" }]);

    await expect(
      importThumbnailReferenceRepository.findReferencedThumbnailPaths([
        "w/imports/a.webp",
        "w/imports/b.webp",
      ]),
    ).resolves.toEqual(["w/imports/a.webp"]);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("skips the query for an empty list", async () => {
    await expect(
      importThumbnailReferenceRepository.findReferencedThumbnailPaths([]),
    ).resolves.toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
