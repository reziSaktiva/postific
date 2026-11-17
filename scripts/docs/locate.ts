/**
 * T-186.2 — locator: ID or title keyword -> `path:line`. Computed at run time
 * from the existing documents (no committed index, because line numbers go
 * stale quickly).
 */
import { type Definition, isId } from "./parse";

export interface Match {
  def: Definition;
  /** `definition` = the ID is defined here; `mention` = the ID is only mentioned in a title. */
  how: "definition" | "mention" | "keyword";
}

const MAX_KEYWORD_RESULTS = 20;

/** `t186` / `T186` / `t-186` -> `T-186`; anything else returns null. */
export function normalizeId(query: string): string | null {
  const trimmed = query.trim();
  const compact = /^([A-Za-z]{1,4})-?(D?\d{2,3}(?:\.\d+)?)$/.exec(trimmed);
  if (!compact) return null;
  const id = `${compact[1].toUpperCase()}-${compact[2].toUpperCase()}`;
  return isId(id) ? id : null;
}

function mentions(def: Definition, id: string): boolean {
  return new RegExp(
    `(?<![A-Za-z0-9-])${id.replace(".", "\\.")}(?![A-Za-z0-9])`,
  ).test(def.title);
}

const KIND_ORDER = { heading: 0, "table-row": 1, bullet: 2 } as const;

function byLocation(a: Match, b: Match): number {
  return (
    KIND_ORDER[a.def.kind] - KIND_ORDER[b.def.kind] ||
    a.def.path.localeCompare(b.def.path) ||
    a.def.line - b.def.line
  );
}

export function locate(
  defs: Definition[],
  query: string,
): { matches: Match[]; truncated: number } {
  const id = normalizeId(query);
  if (id) {
    const exact = defs
      .filter((def) => def.id === id)
      .map((def): Match => ({ def, how: "definition" }));
    if (exact.length > 0)
      return { matches: exact.sort(byLocation), truncated: 0 };
    const mentioned = defs
      .filter((def) => def.kind !== "bullet" && mentions(def, id))
      .map((def): Match => ({ def, how: "mention" }));
    return { matches: mentioned.sort(byLocation), truncated: 0 };
  }

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { matches: [], truncated: 0 };
  const all = defs
    .filter((def) => def.kind !== "bullet")
    .filter((def) => {
      const haystack = `${def.id} ${def.title}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    })
    .map((def): Match => ({ def, how: "keyword" }))
    .sort(byLocation);
  return {
    matches: all.slice(0, MAX_KEYWORD_RESULTS),
    truncated: Math.max(0, all.length - MAX_KEYWORD_RESULTS),
  };
}

/**
 * T-284 — open `[ ]` and partial `[~]` checklist items inside a ticket's own
 * section. Returns null when the hit is not a ticket heading or the section
 * has no checklist at all. Lines inside code fences are ignored.
 */
export function countItems(
  def: Definition,
  docText: string,
): { open: number; partial: number } | null {
  if (def.kind !== "heading" || !/^T-\d/.test(def.id)) return null;
  const end = def.endLine ?? def.line;
  const lines = docText.split(/\r?\n/).slice(def.line - 1, end);
  let open = 0;
  let partial = 0;
  let total = 0;
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/^\s*- \[ \] \*\*T-\d+(?:\.\d+)?\*\*/.test(line)) {
      open += 1;
      total += 1;
    } else if (/^\s*- \[~\] /.test(line)) {
      partial += 1;
      total += 1;
    } else if (/^\s*- \[[xX]\] /.test(line)) {
      total += 1;
    }
  }
  return total === 0 ? null : { open, partial };
}

/**
 * One line per result: `path:line  ID  title  [offset=.. limit=..]`. When the
 * text of the document is given, a ticket hit also shows `open N, partial M`.
 */
export function formatMatch({ def, how }: Match, docText?: string): string {
  const where = `${def.path}:${def.line}`;
  const counts = docText === undefined ? null : countItems(def, docText);
  const countText = counts
    ? `  open ${counts.open}, partial ${counts.partial}`
    : "";
  const range =
    def.endLine !== undefined
      ? `  [offset=${def.line} limit=${def.endLine - def.line + 1}]`
      : "";
  const note = how === "mention" ? "  (only mentioned in a title)" : "";
  return `${where}  ${def.id}  ${def.title}${range}${countText}${note}`;
}
