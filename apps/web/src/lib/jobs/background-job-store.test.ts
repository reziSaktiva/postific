import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("@/lib/prisma/client", () => ({
  prisma: { backgroundJob: { findFirst } },
}));

import { backgroundJobStore } from "./background-job-store";

describe("backgroundJobStore.hasJobOfType", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("tanpa createdSince hanya menghitung job pending/running", async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      backgroundJobStore.hasJobOfType({ type: "mcp.audit.purge" }),
    ).resolves.toBe(false);

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        type: "mcp.audit.purge",
        status: { in: ["pending", "running"] },
      },
      select: { id: true },
    });
  });

  it("dengan createdSince menghitung job yang dibuat sejak itu ATAU yang masih pending/running", async () => {
    const since = new Date("2026-10-26T00:00:00.000Z");
    findFirst.mockResolvedValue({ id: "job-1" });

    await expect(
      backgroundJobStore.hasJobOfType({
        type: "mcp.audit.purge",
        createdSince: since,
      }),
    ).resolves.toBe(true);

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        type: "mcp.audit.purge",
        OR: [
          { createdAt: { gte: since } },
          { status: { in: ["pending", "running"] } },
        ],
      },
      select: { id: true },
    });
  });
});
