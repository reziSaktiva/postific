import { describe, expect, it, vi } from "vitest";
import type { IPublicStartPageRepository } from "../repositories/start-page.repository";
import type { PublicStartPage } from "../types";
import { GetPublicStartPageBySlug } from "./get-public-start-page-by-slug";

const PAGE: PublicStartPage = {
  slug: "raka",
  title: "Raka",
  bio: null,
  avatarUrl: null,
  theme: "default",
  links: [{ id: "l1", label: "Shop", url: "https://example.com" }],
};

function setup(result: PublicStartPage | null = PAGE) {
  const findPublishedBySlug = vi.fn().mockResolvedValue(result);
  const repository: IPublicStartPageRepository = { findPublishedBySlug };
  return {
    useCase: new GetPublicStartPageBySlug(repository),
    findPublishedBySlug,
  };
}

describe("GetPublicStartPageBySlug", () => {
  it("returns the page without any session/workspace input", async () => {
    const { useCase, findPublishedBySlug } = setup();
    await expect(useCase.execute("raka")).resolves.toEqual({
      ...PAGE,
      links: [{ id: "l1", label: "Shop", url: "https://example.com/" }],
    });
    expect(findPublishedBySlug).toHaveBeenCalledWith("raka");
  });

  it("normalizes case/whitespace before lookup", async () => {
    const { useCase, findPublishedBySlug } = setup();
    await useCase.execute("  Raka ");
    expect(findPublishedBySlug).toHaveBeenCalledWith("raka");
  });

  it("returns null when the repository has no published page", async () => {
    const { useCase } = setup(null);
    await expect(useCase.execute("ghost")).resolves.toBeNull();
  });

  it.each(["login", "a", "bad_slug", "-x-", "x--y"])(
    "returns null without hitting the repository for invalid/reserved slug %j",
    async (slug) => {
      const { useCase, findPublishedBySlug } = setup();
      await expect(useCase.execute(slug)).resolves.toBeNull();
      expect(findPublishedBySlug).not.toHaveBeenCalled();
    },
  );

  it("drops links with non-http(s) urls, nulls a non-https avatar, and falls back the theme", async () => {
    const { useCase } = setup({
      ...PAGE,
      avatarUrl: "javascript:alert(1)",
      theme: "evil" as never,
      links: [
        { id: "l1", label: "ok", url: "https://example.com" },
        { id: "l2", label: "xss", url: "javascript:alert(1)" },
        { id: "l3", label: "data", url: "data:text/html,x" },
        { id: "l4", label: "creds", url: "https://u:p@example.com" },
      ],
    });
    const result = await useCase.execute("raka");
    expect(result?.links).toEqual([
      { id: "l1", label: "ok", url: "https://example.com/" },
    ]);
    expect(result?.avatarUrl).toBeNull();
    expect(result?.theme).toBe("default");
  });

  it("propagates unexpected repository errors", async () => {
    const repository: IPublicStartPageRepository = {
      findPublishedBySlug: vi.fn().mockRejectedValue(new Error("db down")),
    };
    await expect(
      new GetPublicStartPageBySlug(repository).execute("raka"),
    ).rejects.toThrow("db down");
  });
});
