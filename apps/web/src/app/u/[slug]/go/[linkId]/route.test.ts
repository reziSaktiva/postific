import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordClickMock, findPublishedMock } = vi.hoisted(() => ({
  recordClickMock: vi.fn(),
  findPublishedMock: vi.fn(),
}));

vi.mock("@/lib/repositories/start-page", () => ({
  startPageAnalyticsRepository: {
    recordView: vi.fn(),
    recordClickAndGetUrl: recordClickMock,
  },
  publicStartPageRepository: { findPublishedBySlug: findPublishedMock },
}));

import { GET, HEAD } from "./route";

const LINK = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";

function call(
  handler: typeof GET,
  slug: string,
  linkId: string,
  ua: string | null = BROWSER,
) {
  const request = new NextRequest(`http://localhost/u/${slug}/go/${linkId}`, {
    headers: ua ? { "user-agent": ua } : {},
  });
  return handler(request, { params: Promise.resolve({ slug, linkId }) });
}

describe("GET /u/[slug]/go/[linkId]", () => {
  beforeEach(() => {
    recordClickMock.mockReset();
    findPublishedMock.mockReset();
  });

  it("302-redirects to the validated url and counts the click", async () => {
    recordClickMock.mockResolvedValue("https://example.com/shop");
    const res = await call(GET, "raka", LINK);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/shop");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    expect(recordClickMock).toHaveBeenCalledWith("raka", LINK);
  });

  it("404s when the link/page is not found or unpublished", async () => {
    recordClickMock.mockResolvedValue(null);
    const res = await call(GET, "raka", LINK);
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
  });

  it.each(["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd"])(
    "never redirects to %s (404 instead)",
    async (stored) => {
      recordClickMock.mockResolvedValue(stored);
      const res = await call(GET, "raka", LINK);
      expect(res.status).toBe(404);
      expect(res.headers.get("location")).toBeNull();
    },
  );

  it("404s on malformed ids/slugs without touching the DB", async () => {
    expect((await call(GET, "raka", "nope")).status).toBe(404);
    expect((await call(GET, "login", LINK)).status).toBe(404);
    expect(recordClickMock).not.toHaveBeenCalled();
    expect(findPublishedMock).not.toHaveBeenCalled();
  });

  it("redirects bots but does not count", async () => {
    findPublishedMock.mockResolvedValue({
      slug: "raka",
      title: "R",
      bio: null,
      avatarUrl: null,
      theme: "default",
      links: [{ id: LINK, label: "x", url: "https://example.com/" }],
    });
    const res = await call(GET, "raka", LINK, "Googlebot/2.1");
    expect(res.status).toBe(302);
    expect(recordClickMock).not.toHaveBeenCalled();
  });

  it("HEAD never increments the counter", async () => {
    findPublishedMock.mockResolvedValue({
      slug: "raka",
      title: "R",
      bio: null,
      avatarUrl: null,
      theme: "default",
      links: [{ id: LINK, label: "x", url: "https://example.com/" }],
    });
    const res = await call(HEAD, "raka", LINK);
    expect(res.status).toBe(302);
    expect(recordClickMock).not.toHaveBeenCalled();
  });
});
