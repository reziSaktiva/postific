import { describe, expect, it } from "vitest";
import { isDocumentNavigation } from "./document-navigation";

describe("isDocumentNavigation", () => {
  it("accepts a browser document navigation", () => {
    expect(
      isDocumentNavigation({ fetchDest: "document", fetchMode: "navigate" }),
    ).toBe(true);
    expect(
      isDocumentNavigation({ fetchDest: " Document ", fetchMode: "NAVIGATE" }),
    ).toBe(true);
  });

  it("rejects requests without Fetch Metadata (HEAD from tools, old clients)", () => {
    expect(isDocumentNavigation({ fetchDest: null, fetchMode: null })).toBe(
      false,
    );
    expect(
      isDocumentNavigation({ fetchDest: undefined, fetchMode: undefined }),
    ).toBe(false);
    expect(
      isDocumentNavigation({ fetchDest: "document", fetchMode: null }),
    ).toBe(false);
    expect(
      isDocumentNavigation({ fetchDest: null, fetchMode: "navigate" }),
    ).toBe(false);
  });

  it("rejects non-document destinations and modes (RSC/prefetch fetch, iframe)", () => {
    expect(
      isDocumentNavigation({ fetchDest: "empty", fetchMode: "cors" }),
    ).toBe(false);
    expect(
      isDocumentNavigation({ fetchDest: "iframe", fetchMode: "navigate" }),
    ).toBe(false);
    expect(
      isDocumentNavigation({ fetchDest: "document", fetchMode: "no-cors" }),
    ).toBe(false);
  });
});
