/**
 * T-186.2 — pencari lokasi: ID atau kata kunci judul -> `path:baris`.
 * Dihitung saat dijalankan dari dokumen yang ada (tidak ada indeks yang
 * di-commit, karena nomor baris cepat usang).
 */
import { type Definition, isId } from "./parse";

export interface Match {
  def: Definition;
  /** `definition` = ID didefinisikan di sini; `mention` = ID hanya disebut di judul. */
  how: "definition" | "mention" | "keyword";
}

const MAX_KEYWORD_RESULTS = 20;

/** `t186` / `T186` / `t-186` -> `T-186`; selain itu dikembalikan apa adanya. */
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

/** Satu baris per hasil: `path:baris  ID  judul  [offset=.. limit=..]`. */
export function formatMatch({ def, how }: Match): string {
  const where = `${def.path}:${def.line}`;
  const range =
    def.endLine !== undefined
      ? `  [offset=${def.line} limit=${def.endLine - def.line + 1}]`
      : "";
  const note = how === "mention" ? "  (hanya disebut di judul)" : "";
  return `${where}  ${def.id}  ${def.title}${range}${note}`;
}
