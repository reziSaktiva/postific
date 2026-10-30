import { PostCreatedVia } from "@postific/shared";

/**
 * Filter sumber konten (T-157): Semua / Dibuat Manual / Lewat MCP.
 * Murni dan client-side, dipakai History, Drafts, dan Queue.
 */
export const SourceFilter = {
  All: "all",
  Manual: "manual",
  Mcp: "mcp",
} as const;

export type SourceFilterValue =
  (typeof SourceFilter)[keyof typeof SourceFilter];

export const SOURCE_FILTER_OPTIONS: ReadonlyArray<{
  value: SourceFilterValue;
  label: string;
}> = [
  { value: SourceFilter.All, label: "Semua Sumber" },
  { value: SourceFilter.Manual, label: "Dibuat Manual" },
  { value: SourceFilter.Mcp, label: "Lewat MCP" },
];

export function matchesSourceFilter(
  item: { createdVia?: PostCreatedVia },
  filter: SourceFilterValue,
): boolean {
  if (filter === SourceFilter.All) {
    return true;
  }
  const isMcp = item.createdVia === PostCreatedVia.Mcp;
  return filter === SourceFilter.Mcp ? isMcp : !isMcp;
}

export function filterBySource<T extends { createdVia?: PostCreatedVia }>(
  items: readonly T[],
  filter: SourceFilterValue,
): T[] {
  return items.filter((item) => matchesSourceFilter(item, filter));
}

/** Jenis state kosong: `base` = teks kosong asli layar. */
export type FilteredEmptyKind = "base" | "mcp" | "manual" | "generic";

/**
 * Putuskan state kosong saat daftar terfilter kosong (T-157).
 * - `mcp`: filter Lewat MCP, filter lain di posisi Semua.
 * - `manual`: filter Dibuat Manual, filter lain Semua, dan ada item MCP.
 * - `generic`: ada filter aktif tetapi sumber data tidak kosong.
 * - `base`: data memang kosong (atau tidak ada filter aktif).
 */
export function resolveFilteredEmptyKind(input: {
  sourceFilter: SourceFilterValue;
  /** True bila semua filter selain sumber (Status/Akun) di posisi Semua. */
  otherFiltersAtDefault: boolean;
  /** Jumlah item sebelum filter apa pun. */
  totalItems: number;
  hasMcpItems: boolean;
}): FilteredEmptyKind {
  const { sourceFilter, otherFiltersAtDefault, totalItems, hasMcpItems } =
    input;
  if (sourceFilter === SourceFilter.Mcp && otherFiltersAtDefault) {
    return "mcp";
  }
  if (totalItems === 0) {
    return "base";
  }
  if (
    sourceFilter === SourceFilter.Manual &&
    otherFiltersAtDefault &&
    hasMcpItems
  ) {
    return "manual";
  }
  const anyFilterActive =
    sourceFilter !== SourceFilter.All || !otherFiltersAtDefault;
  return anyFilterActive ? "generic" : "base";
}
