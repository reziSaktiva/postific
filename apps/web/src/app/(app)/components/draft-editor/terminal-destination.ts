import { ContentStatus } from "@postific/shared";

import { buildPublishSearch, type PublishListTab } from "@/domains/publishing";

/**
 * Tujuan navigasi setelah aksi terminal Draft Editor — ADR-054 / NP-D13.
 *
 * Dipisah dari `modal.tsx` supaya aturannya bisa diuji tanpa merender
 * component: sejak CTA sidebar aktif (ADR-053) editor bisa dibuka dari section
 * manapun, jadi salah destinasi tidak lagi kelihatan sebagai bug lokal di
 * Publish — pengguna hanya "tertinggal" di Home/Analyze tanpa jejak aksi.
 *
 * Destinations use the URL `buildPublishSearch` produces for the unified
 * Publish page (S-008), not the old `/publish/<route>` redirects.
 * `publish-now` (T-029, T-031.4): Calendar, as ADR-054 set it.
 */
export type TerminalAction =
  "save-draft" | "submit-review" | "schedule" | "publish-now";

/**
 * `status` is the status of the post being saved: Save keeps it (T-297), so
 * the user lands on the tab where the post lives, which is Approvals for an
 * `In Review` post and Drafts for `Draft` and `Ready to Schedule`.
 *
 * `currentSearch` is the query of the current Publish URL (empty outside
 * Publish): its display zone `tz` is kept, and for the Calendar destination
 * its `range` and `date` too, so the action does not reset what the user
 * was looking at.
 */
export function resolveTerminalDestination(
  action: TerminalAction,
  status?: ContentStatus,
  currentSearch: string | URLSearchParams = "",
): string {
  const current = new URLSearchParams(currentSearch);
  const timeZone = current.get("tz");
  const list = (tab: PublishListTab) =>
    `/publish${buildPublishSearch({ view: "list", tab, timeZone })}`;
  switch (action) {
    case "save-draft":
      return status === ContentStatus.InReview
        ? list("approvals")
        : list("drafts");
    // T-296 — Ajukan Review → Publish > List > Approvals (kartu
    // `ScreenDraftEditorSubmitReview`), tempat posting In Review menunggu.
    case "submit-review":
      return list("approvals");
    case "schedule":
      return list("queue");
    case "publish-now":
      return `/publish${buildPublishSearch({
        view: "calendar",
        timeZone,
        calendar: {
          range: current.get("range") ?? undefined,
          date: current.get("date") ?? undefined,
        },
      })}`;
  }
}

/**
 * `true` when the user is already on the destination screen, so refreshing
 * the data is enough and no new history entry is pushed. The Publish screens
 * share the path `/publish` and differ in the query (S-008), so every query
 * key of `destination` must match `search` (the current `location.search`);
 * extra keys such as `tz` or `post` do not count against it.
 */
export function isAlreadyAtDestination(
  pathname: string | null,
  destination: string,
  search: string = "",
): boolean {
  const [destinationPath, destinationQuery = ""] = destination.split("?");
  if (pathname !== destinationPath) {
    return false;
  }
  const current = new URLSearchParams(search);
  for (const [key, value] of new URLSearchParams(destinationQuery)) {
    if (current.get(key) !== value) {
      return false;
    }
  }
  return true;
}
