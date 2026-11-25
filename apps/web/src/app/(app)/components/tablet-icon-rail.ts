/**
 * Pure rules of the tablet icon rail (T-292, fix T-296, S-008). At tablet
 * width (768-1023 px) the workspace sidebar collapses to an icon rail on its
 * own. That automatic collapse is a layout choice, not the user's: it must
 * not be saved as the user's sidebar preference (cookie `sidebar_state`),
 * and leaving the tablet width restores what the user had.
 */

export interface TabletRailWidthStep {
  /** Value to pass to the sidebar's `setOpen`, or `null` to leave it. */
  setOpen: boolean | null;
  /**
   * Preference to write back to the sidebar cookie right after `setOpen`,
   * because `setOpen` always saves its value; `null` when nothing to undo.
   */
  restorePreference: boolean | null;
  collapsedByRail: boolean;
}

/** What to do when the viewport enters or leaves the tablet width. */
export function stepTabletRailOnWidth(input: {
  isTablet: boolean;
  open: boolean;
  collapsedByRail: boolean;
}): TabletRailWidthStep {
  if (input.isTablet && input.open) {
    // The user had it expanded: collapse for the layout, keep "expanded" saved.
    return { setOpen: false, restorePreference: true, collapsedByRail: true };
  }
  if (!input.isTablet && input.collapsedByRail) {
    // Back to desktop: give the user's expanded sidebar back.
    return { setOpen: true, restorePreference: null, collapsedByRail: false };
  }
  return {
    setOpen: null,
    restorePreference: null,
    collapsedByRail: input.collapsedByRail,
  };
}

/**
 * The user expanded the sidebar themselves while it was a rail: from then
 * on the state is theirs, so leaving the tablet width changes nothing.
 */
export function stepTabletRailOnOpenChange(input: {
  open: boolean;
  collapsedByRail: boolean;
}): boolean {
  return input.open ? false : input.collapsedByRail;
}

/** Same cookie and lifetime as `components/ui/sidebar.tsx` writes. */
export const SIDEBAR_STATE_COOKIE = "sidebar_state";
const SIDEBAR_STATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export function sidebarStateCookie(open: boolean): string {
  return `${SIDEBAR_STATE_COOKIE}=${open}; path=/; max-age=${SIDEBAR_STATE_COOKIE_MAX_AGE}`;
}
