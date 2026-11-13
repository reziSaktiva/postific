/**
 * T-186.3 — document checker. `runChecks(root)` reads the disk through
 * `corpus.ts` and returns `path:line` findings; it never changes any file.
 *
 * Checks: (1) path pointers are valid, (2) referenced IDs exist, (3) the "Next"
 * counters = max ID + 1, (4) the rule 12 twin pairs (AGENTS.md) have not
 * diverged, (5) skill folder names and new ticket titles are in English (S-003).
 *
 * The counters are recognized in the English form only (`Next:`, `Next spec:`;
 * ADR-163, T-276 removed the old Indonesian keywords).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { type Doc, loadCorpus, loadDefinitions, vendorSkills } from "./corpus";
import {
  type Definition,
  parsePointers,
  parseReferences,
  titleProse,
} from "./parse";

export interface Finding {
  rule:
    | "pointer"
    | "id-ref"
    | "counter"
    | "twin-pair"
    | "naming-skill"
    | "naming-title";
  path: string;
  line: number;
  message: string;
}

/**
 * The English naming rule applies to new tickets: IDs start here (T-181 = the
 * first ticket after S-003 set the rule). Older tickets have Indonesian titles
 * and are not renamed (IDs are never recycled).
 */
export const ENGLISH_TITLES_FROM_TICKET = 181;

/** ID prefixes whose existence is not checked: finished KIs are removed from the list (ADR-067). */
const UNCHECKED_PREFIXES = new Set(["KI"]);

/**
 * IDs that are deliberately referenced without a definition (T-186.5, approved
 * by King Rezi 2026-11-02): JOB-05 and JOB-06 are reserved by ADR-093 for Import
 * Posts, UXP-08 is a proposed new ID in ADR-049, T-049 is deliberately left
 * empty in v03.
 */
const RESERVED_IDS = new Set(["JOB-05", "JOB-06", "UXP-08", "T-049"]);

/**
 * Pointers that deliberately point at a file that does not exist (T-186.5): the
 * "Update CHANGELOG" step in design-tokens.md is left alone because replacing
 * it would change its meaning.
 */
const ALLOWED_POINTERS = new Set([
  "product-discovery/06-engineering/design-tokens.md→../../project-os/CHANGELOG.md",
]);

/** Documents that are the source of truth for pointers (not historical records). */
function inPointerScope(docPath: string): boolean {
  return (
    !/^project-os\/(decisions|tickets|reports|specs)\//.test(docPath) &&
    docPath !== "project-os/CONVERSATIONS.md" &&
    docPath !== "project-os/DECISIONS.md"
  );
}

/** Indonesian function words and verbs that do not appear in English-language titles. */
const INDONESIAN_WORDS = new Set([
  "yang",
  "dan",
  "di",
  "ke",
  "dari",
  "untuk",
  "dengan",
  "tidak",
  "atau",
  "pada",
  "dalam",
  "saat",
  "setelah",
  "sebelum",
  "tanpa",
  "agar",
  "belum",
  "sudah",
  "bila",
  "jika",
  "oleh",
  "lintas",
  "hapus",
  "buat",
  "tambah",
  "ubah",
  "pasang",
  "putuskan",
  "periksa",
  "siapkan",
  "jalankan",
  "pakai",
  "aturan",
  "gelombang",
  "tiket",
  "bersihkan",
  "selaraskan",
  "pantau",
  "perbaikan",
  "tindak",
  "lanjut",
  "lanjutan",
  "kembali",
  "semua",
  "sisa",
  "baru",
  "lama",
  "masuk",
  "keluar",
  "tampil",
  "tampilkan",
  "hapuskan",
  "ganti",
  "uji",
  "tes",
  "kedipan",
  "terang",
  "gelap",
  "halaman",
  "kustom",
  "mengikuti",
  "pengguna",
  "zona",
  "terapkan",
  "kerjakan",
  "perbarui",
  "tinjau",
  "rapikan",
  "pindahkan",
  "gabungkan",
  "selesaikan",
  "waktu",
]);

function indonesianWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+/g) ?? []).filter((word) =>
    INDONESIAN_WORDS.has(word),
  );
}

function maxNumber(defs: Definition[], prefix: string, dir: string): number {
  let max = 0;
  for (const def of defs.filter((d) => d.path.startsWith(dir))) {
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(def.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

function lineOf(text: string, needle: RegExp): number {
  const index = text.split("\n").findIndex((line) => needle.test(line));
  return index === -1 ? 1 : index + 1;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function checkIds(docs: Doc[], defs: Definition[]): Finding[] {
  const defined = new Set(defs.map((def) => def.id));
  const prefixes = new Set(
    defs
      .map((def) => def.id.split("-")[0])
      .filter((p) => !UNCHECKED_PREFIXES.has(p)),
  );
  const findings: Finding[] = [];
  for (const doc of docs) {
    const lines = doc.text.split("\n");
    for (const ref of parseReferences(doc.path, doc.text)) {
      if (ref.inRange || RESERVED_IDS.has(ref.id)) continue;
      // The "Next: **T-NNN**" counter
      // deliberately names an ID that does not exist yet; only that counter ID is
      // skipped, not the whole line.
      const counters = [
        ...lines[ref.line - 1].matchAll(
          /next(?: spec)?:\s*\*\*([A-Z]{1,4}-\d+)\*\*/gi,
        ),
      ];
      if (counters.some((counter) => counter[1] === ref.id)) continue;
      const prefix = ref.id.split("-")[0];
      if (!prefixes.has(prefix)) continue;
      const base = ref.id.replace(/\.\d+$/, "");
      if (defined.has(ref.id) || defined.has(base)) continue;
      findings.push({
        rule: "id-ref",
        path: ref.path,
        line: ref.line,
        message: `ID ${ref.id} is referenced but not defined in any document`,
      });
    }
  }
  return findings;
}

/** Files that belong to the design artifact (ADR-140), not this repo. */
const ARTIFACT_ROOTS = /^(project|templates|components|foundations)\//;

const SEARCH_ROOTS = [
  "",
  "project-os",
  "context",
  "product-discovery",
  ".claude",
  ".claude/skills",
  "apps/web",
  "apps/web/src",
];

function resolvesPointer(
  root: string,
  docPath: string,
  target: string,
  via: "link" | "code",
): boolean {
  const clean = target.replace(/\/$/, "");
  const docDir = path.posix.dirname(docPath);
  if (via === "link") return existsSync(path.join(root, docDir, clean));
  // A bare file name is too ambiguous to map to a single path.
  if (!clean.includes("/")) return true;
  // npm packages, scheme-less URLs, and design artifact files are not repo paths.
  if (clean.startsWith("@") || ARTIFACT_ROOTS.test(clean)) return true;
  if (/^[^/.][^/]*\.[a-z]{2,}\//.test(clean)) return true;
  return [docDir, ...SEARCH_ROOTS].some((base) =>
    existsSync(path.join(root, base, clean)),
  );
}

function checkPointers(root: string, docs: Doc[]): Finding[] {
  const findings: Finding[] = [];
  for (const doc of docs.filter((d) => inPointerScope(d.path))) {
    for (const pointer of parsePointers(doc.path, doc.text)) {
      if (ALLOWED_POINTERS.has(`${doc.path}→${pointer.target}`)) continue;
      if (!resolvesPointer(root, doc.path, pointer.target, pointer.via)) {
        findings.push({
          rule: "pointer",
          path: doc.path,
          line: pointer.line,
          message: `pointer to \`${pointer.target}\` does not exist`,
        });
      }
    }
  }
  return findings;
}

function checkCounters(root: string, defs: Definition[]): Finding[] {
  const file = "project-os/AVAILABLE_TICKETS.md";
  const abs = path.join(root, file);
  if (!existsSync(abs)) return [];
  const text = readFileSync(abs, "utf8");
  const findings: Finding[] = [];
  const counters: {
    label: string;
    prefix: string;
    dir: string;
    width: number;
    pattern: RegExp;
  }[] = [
    {
      label: "ticket",
      prefix: "T",
      dir: "project-os/tickets/",
      width: 3,
      pattern: /Next:\s*\*\*T-(\d+)\*\*/,
    },
    {
      label: "spec",
      prefix: "S",
      dir: "project-os/specs/",
      width: 3,
      pattern: /next spec:\s*\*\*S-(\d+)\*\*/i,
    },
  ];
  for (const { label, prefix, dir, width, pattern } of counters) {
    const found = pattern.exec(text);
    const line = lineOf(text, pattern);
    const expected = maxNumber(defs, prefix, dir) + 1;
    if (!found) {
      findings.push({
        rule: "counter",
        path: file,
        line,
        message: `next ${label} ID counter not found`,
      });
    } else if (Number(found[1]) !== expected) {
      findings.push({
        rule: "counter",
        path: file,
        line,
        message: `${label} counter ${prefix}-${found[1]} should be ${prefix}-${pad(expected, width)} (max ID + 1)`,
      });
    }
  }
  return findings;
}

function readJson(root: string, file: string): unknown {
  const abs = path.join(root, file);
  return existsSync(abs) ? JSON.parse(readFileSync(abs, "utf8")) : undefined;
}

/** JSON.stringify with sorted object keys, so key order is not seen as a difference. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function checkTwins(root: string): Finding[] {
  const findings: Finding[] = [];

  const claude = readJson(root, ".mcp.json");
  const cursor = readJson(root, ".cursor/mcp.json");
  if (claude !== undefined || cursor !== undefined) {
    if (stableStringify(claude) !== stableStringify(cursor)) {
      findings.push({
        rule: "twin-pair",
        path: ".cursor/mcp.json",
        line: 1,
        message:
          "content differs from `.mcp.json` (rule 12: change both together)",
      });
    }
  }

  const settings = readJson(root, ".claude/settings.json") as
    { permissions?: { deny?: string[] } } | undefined;
  const ignoreFile = path.join(root, ".cursorignore");
  if (settings !== undefined || existsSync(ignoreFile)) {
    const deny = (settings?.permissions?.deny ?? [])
      .map((rule) => /^Read\(\.\/(.*)\)$/.exec(rule)?.[1])
      .filter((pattern): pattern is string => pattern !== undefined);
    const ignored = existsSync(ignoreFile)
      ? readFileSync(ignoreFile, "utf8")
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"))
      : [];
    for (const pattern of deny.filter((p) => !ignored.includes(p))) {
      findings.push({
        rule: "twin-pair",
        path: ".cursorignore",
        line: 1,
        message: `pattern \`${pattern}\` is in permissions.deny but not in .cursorignore`,
      });
    }
    for (const pattern of ignored.filter((p) => !deny.includes(p))) {
      findings.push({
        rule: "twin-pair",
        path: ".claude/settings.json",
        line: 1,
        message: `pattern \`${pattern}\` is in .cursorignore but not in permissions.deny`,
      });
    }
  }
  return findings;
}

function checkNaming(root: string, defs: Definition[]): Finding[] {
  const findings: Finding[] = [];
  const skillsDir = path.join(root, ".claude/skills");
  if (existsSync(skillsDir)) {
    const vendor = vendorSkills(root);
    // Listing folders through the corpus is not enough (folders without .md); read directly.
    for (const name of listDirs(skillsDir).filter((n) => !vendor.has(n))) {
      const bad = indonesianWords(name.replace(/-/g, " "));
      if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
        findings.push({
          rule: "naming-skill",
          path: `.claude/skills/${name}`,
          line: 1,
          message: "skill folder name must be lowercase, kebab-case, ASCII",
        });
      } else if (bad.length > 0) {
        findings.push({
          rule: "naming-skill",
          path: `.claude/skills/${name}`,
          line: 1,
          message: `skill folder name must be in English (Indonesian words: ${bad.join(", ")})`,
        });
      }
    }
  }
  for (const def of defs) {
    const match = /^T-(\d+)$/.exec(def.id);
    if (
      def.kind !== "heading" ||
      !match ||
      !def.path.startsWith("project-os/tickets/")
    )
      continue;
    if (Number(match[1]) < ENGLISH_TITLES_FROM_TICKET) continue;
    const bad = indonesianWords(titleProse(def.title));
    if (bad.length > 0) {
      findings.push({
        rule: "naming-title",
        path: def.path,
        line: def.line,
        message: `title ${def.id} must be in English (Indonesian words: ${bad.join(", ")})`,
      });
    }
  }
  return findings;
}

function listDirs(dir: string): string[] {
  return readdirSync(dir).filter((name) =>
    statSync(path.join(dir, name)).isDirectory(),
  );
}

export function runChecks(root: string): Finding[] {
  const docs = loadCorpus(root);
  const defs = loadDefinitions(docs);
  return [
    ...checkPointers(root, docs),
    ...checkIds(docs, defs),
    ...checkCounters(root, defs),
    ...checkTwins(root),
    ...checkNaming(root, defs),
  ].sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
}

export function formatFinding(finding: Finding): string {
  return `${finding.path}:${finding.line}  [${finding.rule}] ${finding.message}`;
}
