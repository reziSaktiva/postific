import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Finding, formatFinding, runChecks } from "./check";

let root: string;

function write(file: string, content: string): void {
  const abs = path.join(root, file);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

/** Pohon dokumen minimal yang lolos semua pemeriksaan. */
function cleanTree(): void {
  write(
    "project-os/tickets/v01.md",
    "### T-001 · First ticket\n\n### T-002 · Second ticket\n",
  );
  write("project-os/specs/S-001.md", "# S-001 · First spec\n");
  write(
    "project-os/AVAILABLE_TICKETS.md",
    "Next: **T-003**. Next spec: **S-002**.\n",
  );
  write("AGENTS.md", "Lihat `project-os/AVAILABLE_TICKETS.md` dan T-001.\n");
}

function rules(findings: Finding[]): string[] {
  return findings.map((f) => `${f.rule}@${f.path}`);
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "docs-check-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("docs:check", () => {
  it("reports nothing for a consistent tree", () => {
    cleanTree();
    expect(runChecks(root)).toEqual([]);
  });

  describe("allowlist", () => {
    it("skips reserved IDs but still flags other undefined IDs", () => {
      cleanTree();
      write("AGENTS.md", "Lihat JOB-05 dan T-050 dan T-049.\n");
      expect(runChecks(root).map(formatFinding)).toEqual([
        "AGENTS.md:1  [id-ref] ID T-050 is referenced but not defined in any document",
      ]);
    });
  });

  describe("pointers", () => {
    it("flags a backticked path that does not exist, with path:line", () => {
      cleanTree();
      write("AGENTS.md", "Baris satu\nBuka `project-os/MISSING.md` dulu.\n");
      const findings = runChecks(root);
      expect(findings.map(formatFinding)).toEqual([
        "AGENTS.md:2  [pointer] pointer to `project-os/MISSING.md` does not exist",
      ]);
    });

    it("resolves relative Markdown links against the document folder", () => {
      cleanTree();
      write(
        "project-os/README.md",
        "[ok](AVAILABLE_TICKETS.md) [bad](nope.md)\n",
      );
      const findings = runChecks(root);
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        path: "project-os/README.md",
        rule: "pointer",
      });
      expect(findings[0].message).toContain("nope.md");
    });

    it("leaves placeholders, URLs, npm packages, design-artifact files and fenced code alone", () => {
      cleanTree();
      write(
        "AGENTS.md",
        [
          "`tickets/vXX-*.md` `apps/web/src/<domain>/x.ts` [site](https://example.com/a.md)",
          "`@scope/pkg/dist/theme.css` `project/tokens.css` `page.tsx`",
          "```",
          "`project-os/IN_FENCE.md`",
          "```",
        ].join("\n"),
      );
      expect(runChecks(root)).toEqual([]);
    });

    it("does not police historical records (ADRs, tickets, reports)", () => {
      cleanTree();
      write(
        "project-os/decisions/ADR-001-x.md",
        "Dulu ada `OLD_FILE.md` di `gone/dir/file.ts`.\n",
      );
      expect(runChecks(root)).toEqual([]);
    });
  });

  describe("ID references", () => {
    it("flags a referenced ID that is defined nowhere", () => {
      cleanTree();
      write("context/ctx.md", "Lihat T-777 untuk detail.\n");
      expect(runChecks(root).map(formatFinding)).toEqual([
        "context/ctx.md:1  [id-ref] ID T-777 is referenced but not defined in any document",
      ]);
    });

    it("accepts a subtask reference when its ticket exists", () => {
      cleanTree();
      write("context/ctx.md", "Butir T-001.4 dikerjakan.\n");
      expect(runChecks(root)).toEqual([]);
    });

    it("does not check resolved-issue IDs, ranges, or fenced examples", () => {
      cleanTree();
      write(
        "project-os/tickets/v01.md",
        "### T-001 · First ticket\n\n### T-002 · Second ticket\n\n" +
          "KI-050 sudah ditutup. T-001–T-099 dipakai berurutan. T-001 sampai T-098.\n" +
          "```\nT-555\n```\n",
      );
      expect(runChecks(root)).toEqual([]);
    });
  });

  describe('"Next" counters', () => {
    it("flags a ticket counter that is not max ID + 1", () => {
      cleanTree();
      write(
        "project-os/AVAILABLE_TICKETS.md",
        "Next: **T-009**. Next spec: **S-002**.\n",
      );
      expect(runChecks(root).map(formatFinding)).toEqual([
        "project-os/AVAILABLE_TICKETS.md:1  [counter] ticket counter T-009 should be T-003 (max ID + 1)",
      ]);
    });

    it("flags a wrong spec counter in the English form", () => {
      cleanTree();
      write(
        "project-os/AVAILABLE_TICKETS.md",
        "Next: **T-003**. Next spec: **S-007**.\n",
      );
      expect(runChecks(root).map(formatFinding)).toEqual([
        "project-os/AVAILABLE_TICKETS.md:1  [counter] spec counter S-007 should be S-002 (max ID + 1)",
      ]);
    });

    it("no longer recognizes the old Indonesian counter keywords", () => {
      cleanTree();
      write(
        "project-os/AVAILABLE_TICKETS.md",
        "Berikutnya: **T-003**. ID spec berikutnya: **S-002**.\n",
      );
      const messages = runChecks(root).map(formatFinding);
      expect(messages).toContain(
        "project-os/AVAILABLE_TICKETS.md:1  [counter] next ticket ID counter not found",
      );
      expect(messages).toContain(
        "project-os/AVAILABLE_TICKETS.md:1  [counter] next spec ID counter not found",
      );
    });

    it("counts spec IDs only from project-os/specs, not scenario IDs elsewhere", () => {
      cleanTree();
      write("product-discovery/user-scenarios.md", "## S-09 — Some scenario\n");
      expect(runChecks(root)).toEqual([]);
    });

    it("flags a counter line that is missing", () => {
      cleanTree();
      write("project-os/AVAILABLE_TICKETS.md", "empty\n");
      expect(rules(runChecks(root))).toEqual([
        "counter@project-os/AVAILABLE_TICKETS.md",
        "counter@project-os/AVAILABLE_TICKETS.md",
      ]);
    });
  });

  describe("twin files (AGENTS.md rule 12)", () => {
    const mcp = (url: string) =>
      JSON.stringify({ mcpServers: { a: { type: "http", url } } });

    it("passes when both MCP configs match", () => {
      cleanTree();
      write(".mcp.json", mcp("https://a"));
      write(".cursor/mcp.json", mcp("https://a"));
      expect(runChecks(root)).toEqual([]);
    });

    it("flags MCP configs that drifted apart", () => {
      cleanTree();
      write(".mcp.json", mcp("https://a"));
      write(".cursor/mcp.json", mcp("https://b"));
      expect(rules(runChecks(root))).toEqual(["twin-pair@.cursor/mcp.json"]);
    });

    it("flags a deny rule missing from .cursorignore and the reverse", () => {
      cleanTree();
      write(
        ".claude/settings.json",
        JSON.stringify({
          permissions: { deny: ["Read(./.env)", "Read(./**/*.pem)"] },
        }),
      );
      write(".cursorignore", "# komentar\n.env\nsecrets/**\n");
      const messages = runChecks(root).map((f) => `${f.path}: ${f.message}`);
      expect(messages).toEqual([
        ".claude/settings.json: pattern `secrets/**` is in .cursorignore but not in permissions.deny",
        ".cursorignore: pattern `**/*.pem` is in permissions.deny but not in .cursorignore",
      ]);
    });
  });

  describe("English naming (S-003)", () => {
    it("flags an Indonesian skill folder name but ignores vendor skills", () => {
      cleanTree();
      write(
        "skills-lock.json",
        JSON.stringify({ skills: { "buat-sesuatu": {} } }),
      );
      write(".claude/skills/buat-sesuatu/SKILL.md", "# vendor\n");
      write(".claude/skills/wave-plan/SKILL.md", "# ok\n");
      write(".claude/skills/jalankan-gelombang/SKILL.md", "# bad\n");
      const findings = runChecks(root);
      expect(rules(findings)).toEqual([
        "naming-skill@.claude/skills/jalankan-gelombang",
      ]);
    });

    it("flags a skill folder that is not lowercase kebab-case", () => {
      cleanTree();
      write(".claude/skills/Wave_Plan/SKILL.md", "# bad\n");
      expect(rules(runChecks(root))).toEqual([
        "naming-skill@.claude/skills/Wave_Plan",
      ]);
    });

    it("requires English titles for new tickets only", () => {
      cleanTree();
      write(
        "project-os/tickets/v01.md",
        [
          "### T-001 · Pasang Playwright untuk tes dan verifikasi",
          "### T-002 · Second ticket",
          "### T-181 · Draft status ladder for `staging` (ADR-153)",
          "### T-182 · Terapkan tangga status ke dokumen",
        ].join("\n\n") + "\n",
      );
      write(
        "project-os/AVAILABLE_TICKETS.md",
        "Next: **T-183**. Next spec: **S-002**.\n",
      );
      const findings = runChecks(root);
      expect(findings.map((f) => `${f.rule}:${f.line}`)).toEqual([
        "naming-title:7",
      ]);
      expect(findings[0].message).toContain("T-182");
    });
  });
});
