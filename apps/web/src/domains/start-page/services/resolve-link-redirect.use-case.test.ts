import { describe, expect, it, vi } from "vitest";
import type { IStartPageAnalyticsRepository } from "../repositories/start-page-analytics.repository";
import type { IPublicStartPageRepository } from "../repositories/start-page.repository";
import type { PublicStartPage } from "../types";
import { ResolveStartPageLinkRedirect } from "./resolve-link-redirect.use-case";

const LINK = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";

const PAGE: PublicStartPage = {
  slug: "raka",
  title: "Raka",
  bio: null,
  avatarUrl: null,
  theme: "default",
  links: [{ id: LINK, label: "Shop", url: "https://example.com/" }],
};

function setup(
  clickUrl: string | null = "https://example.com/",
  page: PublicStartPage | null = PAGE,
) {
  const recordClickAndGetUrl = vi.fn().mockResolvedValue(clickUrl);
  const findPublishedBySlug = vi.fn().mockResolvedValue(page);
  const analytics: IStartPageAnalyticsRepository = {
    recordView: vi.fn(),
    recordClickAndGetUrl,
  };
  const publicRepo: IPublicStartPageRepository = { findPublishedBySlug };
  return {
    useCase: new ResolveStartPageLinkRedirect(analytics, publicRepo),
    recordClickAndGetUrl,
    findPublishedBySlug,
  };
}

describe("ResolveStartPageLinkRedirect", () => {
  it("counts the click and returns the validated url", async () => {
    const { useCase, recordClickAndGetUrl } = setup();
    await expect(
      useCase.execute({ slug: "Raka", linkId: LINK, userAgent: BROWSER }),
    ).resolves.toBe("https://example.com/");
    expect(recordClickAndGetUrl).toHaveBeenCalledWith("raka", LINK);
  });

  it("returns null when the counter function finds nothing", async () => {
    const { useCase } = setup(null);
    await expect(
      useCase.execute({ slug: "raka", linkId: LINK, userAgent: BROWSER }),
    ).resolves.toBeNull();
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,x",
    "file:///etc/passwd",
    "//evil.test",
  ])("never returns a non-http(s) target (%s)", async (stored) => {
    const { useCase } = setup(stored);
    await expect(
      useCase.execute({ slug: "raka", linkId: LINK, userAgent: BROWSER }),
    ).resolves.toBeNull();
  });

  it.each([
    [{ slug: "login", linkId: LINK }],
    [{ slug: "raka", linkId: "not-a-uuid" }],
    [{ slug: "raka", linkId: "1; DROP TABLE x" }],
  ])("rejects invalid %j without touching the DB", async (input) => {
    const { useCase, recordClickAndGetUrl, findPublishedBySlug } = setup();
    await expect(
      useCase.execute({ ...input, userAgent: BROWSER }),
    ).resolves.toBeNull();
    expect(recordClickAndGetUrl).not.toHaveBeenCalled();
    expect(findPublishedBySlug).not.toHaveBeenCalled();
  });

  it("redirects bots and HEAD without counting, via the public read path", async () => {
    const bot = setup();
    await expect(
      bot.useCase.execute({
        slug: "raka",
        linkId: LINK,
        userAgent: "Googlebot/2.1",
      }),
    ).resolves.toBe("https://example.com/");
    expect(bot.recordClickAndGetUrl).not.toHaveBeenCalled();

    const head = setup();
    await expect(
      head.useCase.execute({
        slug: "raka",
        linkId: LINK,
        userAgent: BROWSER,
        countClick: false,
      }),
    ).resolves.toBe("https://example.com/");
    expect(head.recordClickAndGetUrl).not.toHaveBeenCalled();
  });

  it("returns null for bots when the link is not in the published page", async () => {
    const { useCase } = setup(null, { ...PAGE, links: [] });
    await expect(
      useCase.execute({ slug: "raka", linkId: LINK, userAgent: "curl/8" }),
    ).resolves.toBeNull();
  });
});
