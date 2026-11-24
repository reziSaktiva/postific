import { describe, expect, it } from "vitest";

import {
  sidebarStateCookie,
  stepTabletRailOnOpenChange,
  stepTabletRailOnWidth,
  type TabletRailWidthStep,
} from "./tablet-icon-rail";

/**
 * Walks a sequence of width changes and user toggles the way the hook in
 * `WorkspaceSideNav.tsx` does, and returns the visible state and the saved
 * preference (what `setOpen` and the hook wrote to the cookie last).
 */
function simulate(
  initialOpen: boolean,
  events: ({ width: "tablet" | "desktop" } | { userSetsOpen: boolean })[],
) {
  let open = initialOpen;
  let saved = initialOpen;
  let collapsedByRail = false;
  for (const event of events) {
    if ("userSetsOpen" in event) {
      open = event.userSetsOpen;
      saved = event.userSetsOpen;
      collapsedByRail = stepTabletRailOnOpenChange({ open, collapsedByRail });
      continue;
    }
    const step: TabletRailWidthStep = stepTabletRailOnWidth({
      isTablet: event.width === "tablet",
      open,
      collapsedByRail,
    });
    collapsedByRail = step.collapsedByRail;
    if (step.setOpen !== null) {
      open = step.setOpen;
      saved = step.setOpen;
    }
    if (step.restorePreference !== null) {
      saved = step.restorePreference;
    }
    collapsedByRail = stepTabletRailOnOpenChange({ open, collapsedByRail });
  }
  return { open, saved };
}

describe("tablet icon rail (T-292, T-296 fix)", () => {
  it("collapses an expanded sidebar at tablet width without saving that as the preference", () => {
    expect(simulate(true, [{ width: "tablet" }])).toEqual({
      open: false,
      saved: true,
    });
  });

  it("returning to desktop width restores the expanded sidebar", () => {
    expect(simulate(true, [{ width: "tablet" }, { width: "desktop" }])).toEqual(
      { open: true, saved: true },
    );
  });

  it("a rail chosen on desktop stays a rail through tablet and back", () => {
    expect(
      simulate(false, [
        { width: "desktop" },
        { width: "tablet" },
        { width: "desktop" },
      ]),
    ).toEqual({ open: false, saved: false });
  });

  it("the user expanding on a tablet owns the state from then on", () => {
    expect(
      simulate(true, [
        { width: "tablet" },
        { userSetsOpen: true },
        { userSetsOpen: false },
        { width: "desktop" },
      ]),
    ).toEqual({ open: false, saved: false });
  });

  it("writes the same cookie the shadcn sidebar reads on reload", () => {
    expect(sidebarStateCookie(true)).toBe(
      "sidebar_state=true; path=/; max-age=604800",
    );
  });
});
