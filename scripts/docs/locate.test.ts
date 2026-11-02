import { describe, expect, it } from "vitest";

import { formatMatch, locate } from "./locate";
import { parseDefinitions } from "./parse";

const TICKETS = [
  "# Tickets",
  "",
  "### T-100 · First ticket",
  "",
  "`⏳` · **Mode** AFK",
  "",
  "- [ ] **T-100.1** Do the first thing",
  "- [ ] **T-100.2** Do the second thing",
  "",
  "### T-101 · Second ticket (KI-009, ADR-007)",
  "",
  "Body of the second ticket.",
  "",
  "```md",
  "### T-999 · Heading inside a code fence",
  "```",
  "",
  "## Footer",
].join("\n");

const DECISIONS = [
  "| ADR#    | Title | Status |",
  "| ------- | ----- | ------ |",
  "| ADR-007 | Choose the locator format | Accepted |",
  "| CI-D03  | Branch promotion | Accepted |",
].join("\n");

const defs = [
  ...parseDefinitions("tickets/v01.md", TICKETS),
  ...parseDefinitions("DECISIONS.md", DECISIONS),
];

describe("docs:where locate", () => {
  it("returns path:line and a readable section range for a ticket ID", () => {
    const { matches } = locate(defs, "T-100");
    expect(matches.map(formatMatch)).toEqual([
      "tickets/v01.md:3  T-100  First ticket  [offset=3 limit=6]",
    ]);
  });

  it("section range ends before the next heading of equal or higher level (fenced lines stay inside)", () => {
    const [match] = locate(defs, "T-101").matches;
    expect(match.def.line).toBe(10);
    expect(match.def.endLine).toBe(16);
  });

  it("accepts sloppy spelling of an ID", () => {
    expect(locate(defs, "t100").matches[0].def.id).toBe("T-100");
    expect(locate(defs, "ci-d03").matches[0].def.path).toBe("DECISIONS.md");
  });

  it("finds ADR and domain-decision IDs defined as table rows", () => {
    const { matches } = locate(defs, "ADR-007");
    expect(matches).toHaveLength(1);
    expect(formatMatch(matches[0])).toBe(
      "DECISIONS.md:3  ADR-007  Choose the locator format",
    );
  });

  it("finds a subtask by its own ID", () => {
    const { matches } = locate(defs, "T-100.2");
    expect(matches[0].def).toMatchObject({ line: 8, id: "T-100.2" });
  });

  it("falls back to headings that mention an ID that has no definition", () => {
    const { matches } = locate(defs, "KI-009");
    expect(matches).toHaveLength(1);
    expect(matches[0].how).toBe("mention");
    expect(matches[0].def.id).toBe("T-101");
  });

  it("matches title keywords case-insensitively, all words required", () => {
    expect(locate(defs, "SECOND ticket").matches.map((m) => m.def.id)).toEqual([
      "T-101",
    ]);
    expect(locate(defs, "second locator").matches).toEqual([]);
  });

  it("ignores IDs inside fenced code blocks", () => {
    expect(locate(defs, "T-999").matches).toEqual([]);
  });

  it("returns nothing for an unknown ID", () => {
    expect(locate(defs, "T-555").matches).toEqual([]);
  });

  it("caps keyword results and reports how many were left out", () => {
    const many = Array.from(
      { length: 25 },
      (_, i) => `### T-${200 + i} · Shared word`,
    ).join("\n\n");
    const result = locate(parseDefinitions("many.md", many), "shared");
    expect(result.matches).toHaveLength(20);
    expect(result.truncated).toBe(5);
  });
});
