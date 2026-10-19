/**
 * Label penulis (T-121, menutup KI-050) — diekstrak dari `HistoryDetail.tsx`
 * supaya layar lain yang nanti butuh label "dibuat oleh siapa" (mis.
 * Calendar, kalau `CalendarPostItem` suatu saat membawa `authorName` juga)
 * tidak perlu menduplikasi logiknya — pola sama `formatMetricCount`/
 * `MetricTile` (`post-metric-tile.tsx`, T-033.8/T-043.3) di file sebelah.
 * Semantik null-nya: lihat `HistoryDetailItem.authorName`
 * (`publishing.service.ts`) — `authorId` null = post `Imported` (ADR-093),
 * `authorName` null (`authorId` ada) = user terhapus/`AuthorPort` tidak
 * disuplai, baris di-skip caller.
 */
export function formatAuthorLabel(item: {
  authorId: unknown;
  authorName: string | null;
}): string | null {
  if (!item.authorId) {
    return "Diimpor dari platform";
  }
  if (item.authorName !== null) {
    return `Dibuat oleh ${item.authorName}`;
  }
  return null;
}
