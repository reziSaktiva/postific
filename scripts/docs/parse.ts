/**
 * T-186 — parser Markdown bersama untuk `docs:where` dan `docs:check`.
 *
 * Murni (tanpa I/O): menerima teks, mengembalikan definisi ID, rujukan ID, dan
 * penunjuk path. Semua keluaran membawa nomor baris 1-based supaya bisa dibaca
 * dengan `offset`/`limit`. Blok kode berpagar (```) diabaikan.
 */

/** Bentuk ID: `T-186`, `T-186.1`, `ADR-153`, `S-003`, `KSP-12`, `CI-D03`, `BC-04`. */
export const ID_SOURCE = "[A-Z]{1,4}-D?\\d{2,3}(?:\\.\\d+)?";
const ID_ONLY = new RegExp(`^${ID_SOURCE}$`);
const ID_ANYWHERE = new RegExp(
  `(?<![A-Za-z0-9-])(${ID_SOURCE})(?![A-Za-z0-9])`,
  "g",
);

export type DefinitionKind = "heading" | "table-row" | "bullet";

export interface Definition {
  id: string;
  path: string;
  line: number;
  title: string;
  kind: DefinitionKind;
  /** Hanya untuk heading: level (1-6) dan baris terakhir bagiannya. */
  level?: number;
  endLine?: number;
}

export interface Reference {
  id: string;
  path: string;
  line: number;
  /** Ujung rentang (`T-046–T-049`): rentang boleh mencakup ID yang sengaja kosong. */
  inRange: boolean;
}

export interface Pointer {
  target: string;
  path: string;
  line: number;
  /** `link` = `[x](target)`, `code` = `` `target` ``. */
  via: "link" | "code";
}

export function isId(value: string): boolean {
  return ID_ONLY.test(value);
}

interface ScannedLine {
  line: number;
  text: string;
  fenced: boolean;
}

/** Tandai tiap baris apakah ia berada di dalam blok kode berpagar. */
function scan(text: string): ScannedLine[] {
  const out: ScannedLine[] = [];
  let fence: { char: string; length: number } | null = null;
  text.split(/\r?\n/).forEach((raw, index) => {
    const marker = /^\s*(```+|~~~+)/.exec(raw);
    if (marker) {
      const char = marker[1][0];
      const length = marker[1].length;
      if (fence === null) fence = { char, length };
      else if (fence.char === char && length >= fence.length) fence = null;
      out.push({ line: index + 1, text: raw, fenced: true });
      return;
    }
    out.push({ line: index + 1, text: raw, fenced: fence !== null });
  });
  return out;
}

/** Sel pertama setelah ID yang berisi teks (melewati sel status berisi emoji saja). */
function firstTextCell(rest: string): string {
  const cells = rest.split("|").map(plain);
  return cells.find((cell) => /[A-Za-z]{3,}/.test(cell)) ?? "";
}

function plain(value: string): string {
  return value
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_]{1,3}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const HEADING = new RegExp(
  "^(#{1,6})\\s+(?:Decision\\s+)?`?(" +
    ID_SOURCE +
    ")`?\\s*(?:[·—–:-]\\s*)?(.*)$",
);
const TABLE_ROW = new RegExp("^\\|\\s*`?(" + ID_SOURCE + ")`?\\s*\\|(.*)$");
const BULLET = new RegExp(
  "^\\s*[-*]\\s+(?:\\[[ xX]\\]\\s+)?\\*\\*(" +
    ID_SOURCE +
    ")\\*\\*[\\s:·—–-]*(.*)$",
);

/** Berkas ADR: judul ada di baris isi pertama di bawah `### Title`. */
function titleBelow(lines: ScannedLine[], index: number): string {
  for (const next of lines.slice(index + 1, index + 6)) {
    const text = next.text.trim();
    if (text && !text.startsWith("#")) return plain(text);
  }
  return "";
}

export function parseDefinitions(path: string, text: string): Definition[] {
  const lines = scan(text);
  const defs: Definition[] = [];
  const headings: { index: number; level: number }[] = [];

  lines.forEach((entry, index) => {
    if (entry.fenced) return;
    const anyHeading = /^(#{1,6})\s/.exec(entry.text);
    if (anyHeading) headings.push({ index, level: anyHeading[1].length });

    const heading = HEADING.exec(entry.text);
    if (heading) {
      defs.push({
        id: heading[2],
        path,
        line: entry.line,
        title: plain(heading[3]) || titleBelow(lines, index),
        kind: "heading",
        level: heading[1].length,
      });
      return;
    }
    const row = TABLE_ROW.exec(entry.text);
    if (row) {
      defs.push({
        id: row[1],
        path,
        line: entry.line,
        title: firstTextCell(row[2]),
        kind: "table-row",
      });
      return;
    }
    const bullet = BULLET.exec(entry.text);
    if (bullet) {
      defs.push({
        id: bullet[1],
        path,
        line: entry.line,
        title: plain(bullet[2]).slice(0, 120),
        kind: "bullet",
      });
    }
  });

  // Satu lintasan mundur dengan tumpukan: heading berikutnya yang levelnya
  // sama atau lebih tinggi untuk tiap heading, tanpa memindai ulang daftar.
  const nextAtOrAbove = new Map<number, number>();
  const stack: { index: number; level: number }[] = [];
  for (let i = headings.length - 1; i >= 0; i--) {
    const heading = headings[i];
    while (stack.length > 0 && stack[stack.length - 1].level > heading.level) {
      stack.pop();
    }
    if (stack.length > 0) {
      nextAtOrAbove.set(heading.index, stack[stack.length - 1].index);
    }
    stack.push(heading);
  }

  for (const def of defs) {
    if (def.kind !== "heading") continue;
    const start = def.line - 1;
    const next = nextAtOrAbove.get(start);
    let end = next ?? lines.length;
    while (end > start + 1 && /^\s*(---)?\s*$/.test(lines[end - 1].text)) {
      end--;
    }
    def.endLine = end;
  }
  return defs;
}

export function parseReferences(path: string, text: string): Reference[] {
  const refs: Reference[] = [];
  for (const entry of scan(text)) {
    if (entry.fenced) continue;
    for (const match of entry.text.matchAll(ID_ANYWHERE)) {
      const before = entry.text.slice(0, match.index);
      const end = match.index + match[0].length;
      refs.push({
        id: match[1],
        path,
        line: entry.line,
        inRange:
          /[–—]\s*$/.test(before) ||
          /\bsampai\s*$/.test(before) ||
          new RegExp(`^[–—]\\s*${ID_SOURCE}`).test(entry.text.slice(end)),
      });
    }
  }
  return refs;
}

const FILE_EXTENSIONS =
  "md|mdx|ts|tsx|js|mjs|cjs|json|ya?ml|sh|sql|prisma|css|html";
const CODE_TOKEN = new RegExp(`^[\\w@./-]+\\.(?:${FILE_EXTENSIONS})$`);
const PLACEHOLDER = /[*<>{}[\]$|]|\.\.\.|XX|NNN/;

/** Penunjuk path: tautan Markdown relatif dan token `kode` berbentuk path berkas. */
export function parsePointers(path: string, text: string): Pointer[] {
  const pointers: Pointer[] = [];
  for (const entry of scan(text)) {
    if (entry.fenced) continue;
    for (const match of entry.text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = match[1].split("#")[0];
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      pointers.push({ target, path, line: entry.line, via: "link" });
    }
    for (const match of entry.text.matchAll(/`([^`\s]+)`/g)) {
      const target = match[1].split("#")[0].replace(/:\d+(?:-\d+)?$/, "");
      if (!CODE_TOKEN.test(target) || PLACEHOLDER.test(target)) continue;
      pointers.push({ target, path, line: entry.line, via: "code" });
    }
  }
  return pointers;
}

/** Judul tanpa potongan kode dan penjelas dalam kurung, untuk uji bahasa. */
export function titleProse(title: string): string {
  return title.replace(/`[^`]*`/g, " ").replace(/\([^)]*\)/g, " ");
}
