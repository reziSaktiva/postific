import { PostCreatedVia } from "@postific/shared";
import { describe, expect, it } from "vitest";
import {
  filterBySource,
  matchesSourceFilter,
  resolveFilteredEmptyKind,
  SourceFilter,
} from "./source-filter";

const manual = { id: "a", createdVia: PostCreatedVia.App };
const mcp = { id: "b", createdVia: PostCreatedVia.Mcp };

describe("source filter", () => {
  it("Semua meloloskan semua item", () => {
    expect(filterBySource([manual, mcp], SourceFilter.All)).toEqual([
      manual,
      mcp,
    ]);
  });

  it("Dibuat Manual hanya item non-MCP", () => {
    expect(filterBySource([manual, mcp], SourceFilter.Manual)).toEqual([
      manual,
    ]);
    expect(matchesSourceFilter(mcp, SourceFilter.Manual)).toBe(false);
  });

  it("Lewat MCP hanya item MCP; kosong bila tidak ada", () => {
    expect(filterBySource([manual, mcp], SourceFilter.Mcp)).toEqual([mcp]);
    expect(filterBySource([manual], SourceFilter.Mcp)).toEqual([]);
  });
});

describe("resolveFilteredEmptyKind", () => {
  const base = {
    otherFiltersAtDefault: true,
    totalItems: 3,
    hasMcpItems: true,
  };

  it("Lewat MCP + filter lain Semua => mcp, bahkan saat data kosong", () => {
    expect(
      resolveFilteredEmptyKind({ ...base, sourceFilter: SourceFilter.Mcp }),
    ).toBe("mcp");
    expect(
      resolveFilteredEmptyKind({
        ...base,
        totalItems: 0,
        hasMcpItems: false,
        sourceFilter: SourceFilter.Mcp,
      }),
    ).toBe("mcp");
  });

  it("Dibuat Manual kosong padahal ada item MCP => manual", () => {
    expect(
      resolveFilteredEmptyKind({ ...base, sourceFilter: SourceFilter.Manual }),
    ).toBe("manual");
  });

  it("filter lain aktif dengan data ada => generic", () => {
    expect(
      resolveFilteredEmptyKind({
        ...base,
        sourceFilter: SourceFilter.Mcp,
        otherFiltersAtDefault: false,
      }),
    ).toBe("generic");
    expect(
      resolveFilteredEmptyKind({
        ...base,
        sourceFilter: SourceFilter.Manual,
        otherFiltersAtDefault: false,
      }),
    ).toBe("generic");
    expect(
      resolveFilteredEmptyKind({
        ...base,
        sourceFilter: SourceFilter.All,
        otherFiltersAtDefault: false,
      }),
    ).toBe("generic");
  });

  it("data memang kosong tanpa filter aktif => base", () => {
    expect(
      resolveFilteredEmptyKind({
        sourceFilter: SourceFilter.All,
        otherFiltersAtDefault: true,
        totalItems: 0,
        hasMcpItems: false,
      }),
    ).toBe("base");
    expect(
      resolveFilteredEmptyKind({
        sourceFilter: SourceFilter.Manual,
        otherFiltersAtDefault: true,
        totalItems: 0,
        hasMcpItems: false,
      }),
    ).toBe("base");
  });
});
