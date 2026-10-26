import { describe, expect, it, vi } from "vitest";
import type { IStartPageAnalyticsRepository } from "../repositories/start-page-analytics.repository";
import { RecordStartPageView } from "./record-start-page-view.use-case";

const BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";

function setup(recorded = true) {
  const recordView = vi.fn().mockResolvedValue(recorded);
  const analytics: IStartPageAnalyticsRepository = {
    recordView,
    recordClickAndGetUrl: vi.fn(),
  };
  return { useCase: new RecordStartPageView(analytics), recordView };
}

describe("RecordStartPageView", () => {
  it("counts a browser visit with a normalized slug", async () => {
    const { useCase, recordView } = setup();
    await expect(
      useCase.execute({ slug: " Raka ", userAgent: BROWSER }),
    ).resolves.toBe(true);
    expect(recordView).toHaveBeenCalledWith("raka");
  });

  it("ignores bots and missing user-agent without touching the DB", async () => {
    const { useCase, recordView } = setup();
    await expect(
      useCase.execute({ slug: "raka", userAgent: "Googlebot/2.1" }),
    ).resolves.toBe(false);
    await expect(
      useCase.execute({ slug: "raka", userAgent: null }),
    ).resolves.toBe(false);
    expect(recordView).not.toHaveBeenCalled();
  });

  it("ignores invalid/reserved slugs", async () => {
    const { useCase, recordView } = setup();
    await expect(
      useCase.execute({ slug: "login", userAgent: BROWSER }),
    ).resolves.toBe(false);
    expect(recordView).not.toHaveBeenCalled();
  });

  it("returns false when the page is unpublished/missing", async () => {
    const { useCase } = setup(false);
    await expect(
      useCase.execute({ slug: "raka", userAgent: BROWSER }),
    ).resolves.toBe(false);
  });
});
