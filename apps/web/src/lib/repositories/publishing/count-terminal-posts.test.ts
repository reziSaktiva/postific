import { describe, expect, it } from "vitest";
import { countTerminalPostsWhere } from "./count-terminal-posts";

describe("countTerminalPostsWhere (T-130/KI-093)", () => {
  it("filters by workspace, terminal statuses, and a half-open publishedAt range", () => {
    const since = new Date("2026-10-01T00:00:00.000Z");
    const until = new Date("2026-10-21T00:00:00.000Z");

    expect(countTerminalPostsWhere("workspace-1", since, until)).toEqual({
      workspaceId: "workspace-1",
      deletedAt: null,
      status: { in: ["published", "failed", "imported"] },
      publishedAt: { gte: since, lt: until },
    });
  });
});
