/**
 * T-186 — pemuat korpus dokumen: satu-satunya bagian skrip docs yang menyentuh
 * disk. Memilih berkas Markdown project (bukan skill vendor di `skills-lock.json`).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { type Definition, parseDefinitions } from "./parse";

export interface Doc {
  /** Path relatif terhadap root repo, selalu dengan `/`. */
  path: string;
  text: string;
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  ".claude/worktrees",
]);

/** Folder skill vendor (dicatat di `skills-lock.json`); namanya bukan milik kita. */
export function vendorSkills(root: string): Set<string> {
  const lock = path.join(root, "skills-lock.json");
  if (!existsSync(lock)) return new Set();
  const parsed = JSON.parse(readFileSync(lock, "utf8")) as {
    skills?: Record<string, unknown>;
  };
  return new Set(Object.keys(parsed.skills ?? {}));
}

function walk(root: string, rel: string, out: string[]): void {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) return;
  for (const name of readdirSync(abs)) {
    const child = rel ? `${rel}/${name}` : name;
    if (SKIP_DIRS.has(name) || SKIP_DIRS.has(child)) continue;
    const stat = statSync(path.join(root, child));
    if (stat.isDirectory()) walk(root, child, out);
    else if (name.endsWith(".md")) out.push(child);
  }
}

/** Berkas Markdown yang dipindai: root, project-os, context, product-discovery, agen, skill project. */
export function loadCorpus(root: string): Doc[] {
  const files: string[] = [];
  for (const name of readdirSync(root)) {
    if (name.endsWith(".md") && statSync(path.join(root, name)).isFile()) {
      files.push(name);
    }
  }
  for (const dir of [
    "project-os",
    "context",
    "product-discovery",
    ".claude/agents",
    "apps/web/.claude",
  ]) {
    walk(root, dir, files);
  }
  const vendor = vendorSkills(root);
  const skillsDir = path.join(root, ".claude/skills");
  if (existsSync(skillsDir)) {
    for (const name of readdirSync(skillsDir)) {
      if (!vendor.has(name)) walk(root, `.claude/skills/${name}`, files);
    }
  }
  return files.sort().map((file) => ({
    path: file,
    text: readFileSync(path.join(root, file), "utf8"),
  }));
}

export function loadDefinitions(docs: Doc[]): Definition[] {
  return docs.flatMap((doc) => parseDefinitions(doc.path, doc.text));
}
