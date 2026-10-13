import { describe, expect, it } from "vitest";
import {
  GENERIC_PUBLISH_FAILURE_MESSAGE,
  summarizeFailureReasons,
} from "./failure-reason";

describe("summarizeFailureReasons", () => {
  it("returns the generic fallback when given no reasons", () => {
    expect(summarizeFailureReasons([])).toBe(GENERIC_PUBLISH_FAILURE_MESSAGE);
  });

  it("joins unique reasons with '; '", () => {
    expect(
      summarizeFailureReasons(["Token kadaluarsa", "Rate limit exceeded"]),
    ).toBe("Token kadaluarsa; Rate limit exceeded");
  });

  it("dedupes identical reasons from multiple targets", () => {
    expect(
      summarizeFailureReasons(["Token kadaluarsa", "Token kadaluarsa"]),
    ).toBe("Token kadaluarsa");
  });

  it("accepts a Set directly (PublishNowUseCase's accumulator shape)", () => {
    const reasons = new Set<string>();
    reasons.add("Network error");
    expect(summarizeFailureReasons(reasons)).toBe("Network error");
  });
});
