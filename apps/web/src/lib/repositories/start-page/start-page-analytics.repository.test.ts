import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRawMock } = vi.hoisted(() => ({ queryRawMock: vi.fn() }));

vi.mock("@/lib/prisma/client", () => ({
  prisma: { $queryRaw: queryRawMock },
}));

import { startPageAnalyticsRepository } from "./start-page-analytics.repository";

describe("startPageAnalyticsRepository", () => {
  beforeEach(() => queryRawMock.mockReset());

  it("recordView binds the slug and reads the boolean result", async () => {
    queryRawMock.mockResolvedValue([{ recorded: true }]);
    await expect(
      startPageAnalyticsRepository.recordView("raka'; DROP TABLE x;--"),
    ).resolves.toBe(true);
    const [strings, ...values] = queryRawMock.mock.calls[0]!;
    expect(strings.join("?")).toContain("start_page_record_view");
    expect(strings.join("")).not.toContain("DROP");
    expect(values).toEqual(["raka'; DROP TABLE x;--"]);
  });

  it("recordView is false when no row is returned or recorded is false", async () => {
    queryRawMock.mockResolvedValue([{ recorded: false }]);
    await expect(startPageAnalyticsRepository.recordView("x-y")).resolves.toBe(
      false,
    );
    queryRawMock.mockResolvedValue([]);
    await expect(startPageAnalyticsRepository.recordView("x-y")).resolves.toBe(
      false,
    );
  });

  it("recordClickAndGetUrl binds both params with an explicit uuid cast", async () => {
    queryRawMock.mockResolvedValue([{ url: "https://example.com/" }]);
    await expect(
      startPageAnalyticsRepository.recordClickAndGetUrl("raka", "link-id"),
    ).resolves.toBe("https://example.com/");
    const [strings, ...values] = queryRawMock.mock.calls[0]!;
    const sql = strings.join("?");
    expect(sql).toContain("start_page_record_click_and_get_url");
    expect(sql).toContain("::uuid");
    expect(values).toEqual(["raka", "link-id"]);
  });

  it("recordClickAndGetUrl returns null for NULL or no rows", async () => {
    queryRawMock.mockResolvedValue([{ url: null }]);
    await expect(
      startPageAnalyticsRepository.recordClickAndGetUrl("raka", "l"),
    ).resolves.toBeNull();
    queryRawMock.mockResolvedValue([]);
    await expect(
      startPageAnalyticsRepository.recordClickAndGetUrl("raka", "l"),
    ).resolves.toBeNull();
  });
});
