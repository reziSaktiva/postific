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
