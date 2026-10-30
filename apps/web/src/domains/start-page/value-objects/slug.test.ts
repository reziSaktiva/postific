import { describe, expect, it } from "vitest";
import { InvalidSlugError, ReservedSlugError } from "../errors";
import {
  RESERVED_SLUGS,
  SLUG_MAX_LENGTH,
  isReservedSlug,
  normalizeSlug,
  parseSlug,
} from "./slug";

describe("parseSlug", () => {
  it.each(["raka", "raka-store", "abc", "a1b2c3", "tim-2026-acme"])(
    "accepts %s",
    (slug) => {
      expect(parseSlug(slug)).toBe(slug);
    },
  );

  it.each([
    "ab",
    "",
    "Raka",
    "raka_store",
    "raka store",
    "-raka",
    "raka-",
    "raka--store",
    "raka.store",
    "raka/store",
    "räka",
    "a".repeat(SLUG_MAX_LENGTH + 1),
  ])("rejects invalid format %j", (slug) => {
    expect(() => parseSlug(slug)).toThrow(InvalidSlugError);
  });

  it("accepts a slug exactly at the max length", () => {
    expect(parseSlug("a".repeat(SLUG_MAX_LENGTH))).toHaveLength(
      SLUG_MAX_LENGTH,
    );
  });

  it.each(["login", "api", "admin", "settings", "invite", "start-page"])(
    "rejects reserved slug %s",
    (slug) => {
      expect(() => parseSlug(slug)).toThrow(ReservedSlugError);
    },
  );
});

describe("reserved slugs", () => {
  it("only contains values that are themselves well-formed (lowercase)", () => {
    for (const slug of RESERVED_SLUGS) expect(slug).toBe(slug.toLowerCase());
  });

  it("covers the app routes under (app) and (auth)", () => {
    for (const slug of ["login", "register", "dashboard", "publish", "api"]) {
      expect(isReservedSlug(slug)).toBe(true);
    }
    expect(isReservedSlug("raka")).toBe(false);
  });
});

describe("normalizeSlug", () => {
  it("trims and lowercases", () => {
    expect(normalizeSlug("  Raka-Store ")).toBe("raka-store");
  });
});
