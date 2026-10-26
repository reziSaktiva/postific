import { describe, expect, it } from "vitest";

import type { StartPageRecord } from "@/domains/start-page";

import {
  buildProfilePatch,
  hasNoAnalyticsData,
  isPublishedSlugChange,
  toPreviewPage,
  toProfileDraft,
} from "./profile-draft";

const PAGE = {
  id: "p1",
  workspaceId: "w1",
  slug: "kopi-selasar",
  title: "Kopi Selasar",
  bio: "Kedai kopi",
  avatarUrl: null,
  theme: "default",
  isPublished: true,
  viewCount: 12,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  links: [
    {
      id: "l1",
      label: "Menu",
      url: "https://a.test/",
      position: 0,
      isActive: true,
      clickCount: 3,
    },
    {
      id: "l2",
      label: "Tersembunyi",
      url: "https://b.test/",
      position: 1,
      isActive: false,
      clickCount: 0,
    },
  ],
} as unknown as StartPageRecord;

describe("profile draft helpers", () => {
  it("round-trips an unchanged page to an empty patch", () => {
    expect(buildProfilePatch(PAGE, toProfileDraft(PAGE))).toEqual({});
  });

  it("patches only the changed fields", () => {
    const draft = {
      ...toProfileDraft(PAGE),
      title: "Kopi Baru",
      theme: "dark" as const,
    };
    expect(buildProfilePatch(PAGE, draft)).toEqual({
      title: "Kopi Baru",
      theme: "dark",
    });
  });

  it("sends null to clear bio/avatar and ignores whitespace-only changes", () => {
    const base = toProfileDraft(PAGE);
    expect(buildProfilePatch(PAGE, { ...base, bio: "   " })).toEqual({
      bio: null,
    });
    expect(
      buildProfilePatch(PAGE, {
        ...base,
        avatarUrl: "  ",
        title: "  Kopi Selasar ",
      }),
    ).toEqual({});
  });

  it("treats a case/space-only slug edit as unchanged", () => {
    const base = toProfileDraft(PAGE);
    expect(
      buildProfilePatch(PAGE, { ...base, slug: " Kopi-Selasar " }),
    ).toEqual({});
    expect(buildProfilePatch(PAGE, { ...base, slug: "baru" })).toEqual({
      slug: "baru",
    });
  });

  it("warns about slug change only while published", () => {
    const changed = { ...toProfileDraft(PAGE), slug: "baru" };
    expect(isPublishedSlugChange(PAGE, changed)).toBe(true);
    expect(
      isPublishedSlugChange({ ...PAGE, isPublished: false }, changed),
    ).toBe(false);
    expect(isPublishedSlugChange(PAGE, toProfileDraft(PAGE))).toBe(false);
  });

  it("projects the draft to a public preview: active links only, https avatar only", () => {
    const draft = {
      ...toProfileDraft(PAGE),
      theme: "accent" as const,
      avatarUrl: "http://insecure.test/a.png",
      title: "  ",
    };
    const preview = toPreviewPage(PAGE, draft);
    expect(preview.links.map((l) => l.id)).toEqual(["l1"]);
    expect(preview.avatarUrl).toBeNull();
    expect(preview.title).toBe("Kopi Selasar");
    expect(preview.theme).toBe("accent");
    expect(
      toPreviewPage(PAGE, { ...draft, avatarUrl: "https://a.test/x.png" })
        .avatarUrl,
    ).toBe("https://a.test/x.png");
  });

  it("detects the zero-data state", () => {
    expect(hasNoAnalyticsData(PAGE)).toBe(false);
    expect(
      hasNoAnalyticsData({
        ...PAGE,
        viewCount: 0,
        links: PAGE.links.map((l) => ({ ...l, clickCount: 0 })),
      }),
    ).toBe(true);
  });
});
