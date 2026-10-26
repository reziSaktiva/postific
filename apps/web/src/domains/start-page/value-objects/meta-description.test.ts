import { describe, expect, it } from "vitest";
import { buildPublicPagePath, buildLinkRedirectPath } from "./link-path";
import { buildMetaDescription } from "./meta-description";

describe("buildMetaDescription", () => {
  it("uses fallback for empty bio", () => {
    expect(buildMetaDescription(null, "fb")).toBe("fb");
    expect(buildMetaDescription("  \n ", "fb")).toBe("fb");
  });
  it("collapses whitespace", () => {
    expect(buildMetaDescription("a\n\n b   c", "fb")).toBe("a b c");
  });
  it("truncates to 160 chars with an ellipsis", () => {
    const out = buildMetaDescription("x".repeat(500), "fb");
    expect(out.length).toBe(160);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("paths", () => {
  it("builds encoded public and redirect paths", () => {
    expect(buildPublicPagePath("raka")).toBe("/u/raka");
    expect(buildLinkRedirectPath("raka", "abc")).toBe("/u/raka/go/abc");
    expect(buildLinkRedirectPath("a/b", "c?d")).toBe("/u/a%2Fb/go/c%3Fd");
  });
});
