import { PostCreatedVia } from "@postific/shared";
import { describe, expect, it } from "vitest";
import {
  filterBySource,
  matchesSourceFilter,
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
