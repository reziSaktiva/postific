import { describe, expect, it } from "vitest";

import { countItems, formatMatch, locate } from "./locate";
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
    expect(matches.map((match) => formatMatch(match))).toEqual([
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

  describe("open-item counts (T-284)", () => {
    const text = [
      "### T-300 · Mixed",
      "",
      "- [ ] **T-300.1** Open one",
      "- [ ] **T-300.2** Open two",
      "- [~] **T-300.3** Partial one",
      "- [x] **T-300.4** Done",
      "",
      "```md",
      "- [ ] **T-300.9** Inside a fence",
      "```",
      "",
      "### T-301 · All done",
      "",
      "- [x] **T-301.1** Done",
      "",
      "### T-302 · No checklist",
      "",
      "Just prose.",
    ].join("\n");
    const ticketDefs = parseDefinitions("tickets/v02.md", text);
    const line = (id: string) =>
      formatMatch(locate(ticketDefs, id).matches[0], text);

    it("shows open and partial counts next to the range, ignoring fenced lines", () => {
      expect(line("T-300")).toBe(
        "tickets/v02.md:1  T-300  Mixed  [offset=1 limit=10]  open 2, partial 1",
      );
    });

    it("shows zero counts for a ticket whose items are all done", () => {
      expect(line("T-301")).toContain("open 0, partial 0");
    });

    it("prints nothing extra for a ticket with no checklist", () => {
      expect(line("T-302")).toBe(
        "tickets/v02.md:16  T-302  No checklist  [offset=16 limit=3]",
      );
    });

    it("prints nothing extra for non-ticket hits or without document text", () => {
      const [adr] = locate(defs, "ADR-007").matches;
      expect(countItems(adr.def, DECISIONS)).toBeNull();
      expect(formatMatch(locate(ticketDefs, "T-300").matches[0])).not.toContain(
        "open",
      );
    });
  });
});
