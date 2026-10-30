import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRawMock } = vi.hoisted(() => ({ queryRawMock: vi.fn() }));

vi.mock("@/lib/prisma/client", () => ({
  prisma: { $queryRaw: queryRawMock },
}));

import { publicStartPageRepository } from "./start-page.repository";

const PAGE_COLUMNS = {
  slug: "raka",
  title: "Raka",
  bio: "hi",
  avatar_url: null,
  theme: "default",
};

describe("publicStartPageRepository.findPublishedBySlug", () => {
  beforeEach(() => queryRawMock.mockReset());

  it("calls the SECURITY DEFINER function with a bound slug parameter (no string interpolation)", async () => {
    queryRawMock.mockResolvedValue([]);

    await publicStartPageRepository.findPublishedBySlug(
      "raka'; DROP TABLE x;--",
    );

    const [strings, ...values] = queryRawMock.mock.calls[0]!;
    expect(strings.join("?")).toContain("start_page_get_public_by_slug");
    expect(strings.join("")).not.toContain("DROP");
    expect(values).toEqual(["raka'; DROP TABLE x;--"]);
  });

  it("returns null when the function returns no rows (missing or unpublished)", async () => {
    queryRawMock.mockResolvedValue([]);
    await expect(
      publicStartPageRepository.findPublishedBySlug("ghost"),
    ).resolves.toBeNull();
  });

  it("maps flat rows to the public projection, keeping link order from the function", async () => {
    queryRawMock.mockResolvedValue([
      {
        ...PAGE_COLUMNS,
        link_id: "l1",
        link_label: "Shop",
        link_url: "https://a.test",
      },
      {
        ...PAGE_COLUMNS,
        link_id: "l2",
        link_label: "Blog",
        link_url: "https://b.test",
      },
    ]);

    await expect(
      publicStartPageRepository.findPublishedBySlug("raka"),
    ).resolves.toEqual({
      slug: "raka",
      title: "Raka",
      bio: "hi",
      avatarUrl: null,
      theme: "default",
      links: [
        { id: "l1", label: "Shop", url: "https://a.test" },
        { id: "l2", label: "Blog", url: "https://b.test" },
      ],
    });
  });

  it("returns an empty links array for a published page with no active links (single row, NULL link columns)", async () => {
    queryRawMock.mockResolvedValue([
      { ...PAGE_COLUMNS, link_id: null, link_label: null, link_url: null },
    ]);

    const result = await publicStartPageRepository.findPublishedBySlug("raka");

    expect(result?.links).toEqual([]);
    expect(result?.title).toBe("Raka");
  });

  it("drops any unexpected extra columns from the result", async () => {
    queryRawMock.mockResolvedValue([
      {
        ...PAGE_COLUMNS,
        workspace_id: "leak",
        view_count: BigInt(9),
        link_id: null,
        link_label: null,
        link_url: null,
      },
    ]);

    const result = await publicStartPageRepository.findPublishedBySlug("raka");

    expect(Object.keys(result!).sort()).toEqual([
      "avatarUrl",
      "bio",
      "links",
      "slug",
      "theme",
      "title",
    ]);
  });
});
