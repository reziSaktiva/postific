"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar03Icon,
  KanbanIcon,
  LeftToRightListBulletIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  buildPublishSearch,
  isPublishView,
  PUBLISH_VIEW_COOKIE,
  type PublishListTab,
  type PublishView,
} from "@/domains/publishing";

import { useDraftEditor } from "../../components/draft-editor/Context";

const VIEWS = [
  { value: "calendar", label: "Calendar", icon: Calendar03Icon },
  { value: "list", label: "List", icon: LeftToRightListBulletIcon },
  { value: "board", label: "Board", icon: KanbanIcon },
] as const satisfies ReadonlyArray<{
  value: PublishView;
  label: string;
  icon: unknown;
}>;

/** One year; the cookie only remembers which view to reopen (T-286). */
const VIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Header of the single Publish page (T-286, S-008, design
 * `ScreenPublishRedesain`): title, the view switcher Calendar · List · Board
 * (shadcn `ToggleGroup`, outline, as the design) and "+ New Post", which
 * opens the Draft Editor as before. Replaces the route tabbar
 * Calendar / Queue / Drafts / History.
 *
 * The design's "save this view" bookmark is left out on purpose: S-008 has
 * no "Save current view" control; the page reopens the last used view
 * instead, remembered here in the `PUBLISH_VIEW_COOKIE` cookie. Below `sm`
 * the switcher shows icons only and New Post becomes an icon button.
 */
export function PublishPageHeader({
  view,
  tab,
  timeZone,
  profileTimeZone,
}: {
  view: PublishView;
  tab: PublishListTab;
  timeZone: string;
  profileTimeZone: string;
}) {
  const router = useRouter();
  const { openNewPost } = useDraftEditor();

  useEffect(() => {
    document.cookie = `${PUBLISH_VIEW_COOKIE}=${view}; path=/; max-age=${VIEW_COOKIE_MAX_AGE}; samesite=lax`;
  }, [view]);

  return (
    // eslint-disable-next-line no-restricted-syntax -- T-286: Tailwind layout composition (ADR-097), not an Astryx stack.
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line no-restricted-syntax -- T-286, same as above */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-10 flex-none items-center justify-center rounded-xl border border-border bg-card"
        >
          <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} />
        </span>
        <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
          Publish
        </h1>
      </div>
      {/* eslint-disable-next-line no-restricted-syntax -- T-286, same as above */}
      <div className="flex items-center gap-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={view}
          aria-label="Tampilan"
          onValueChange={(next) => {
            if (!isPublishView(next) || next === view) return;
            router.push(
              `/publish${buildPublishSearch({
                view: next,
                tab,
                timeZone,
                profileTimeZone,
              })}`,
            );
          }}
        >
          {VIEWS.map((item) => (
            <ToggleGroupItem
              key={item.value}
              value={item.value}
              aria-label={item.label}
            >
              <HugeiconsIcon icon={item.icon} strokeWidth={2} />
              <span className="hidden sm:inline">{item.label}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button
          type="button"
          className="hidden sm:inline-flex"
          onClick={() => openNewPost()}
        >
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
          New Post
        </Button>
        <Button
          type="button"
          size="icon"
          aria-label="New Post"
          className="sm:hidden"
          onClick={() => openNewPost()}
        >
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
        </Button>
      </div>
    </div>
  );
}
