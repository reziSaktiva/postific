import { describe, expect, it } from "vitest";
import {
  DEFAULT_START_PAGE_THEME,
  START_PAGE_THEMES,
  isStartPageTheme,
  parseStartPageTheme,
} from "./theme";

describe("start page theme allowlist", () => {
  it("default is part of the allowlist", () => {
    expect(START_PAGE_THEMES).toContain(DEFAULT_START_PAGE_THEME);
  });

  it.each([...START_PAGE_THEMES])("accepts %s", (theme) => {
    expect(isStartPageTheme(theme)).toBe(true);
    expect(parseStartPageTheme(theme)).toBe(theme);
  });

  it.each([
    "",
    "Dark",
    "minimal",
    "red; background:url(x)",
    null,
    undefined,
    3,
  ])("rejects %j and falls back to default on read", (value) => {
    expect(isStartPageTheme(value)).toBe(false);
    expect(parseStartPageTheme(value)).toBe("default");
  });
});
