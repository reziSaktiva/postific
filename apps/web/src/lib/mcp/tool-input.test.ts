import { describe, expect, it } from "vitest";

import {
  MAX_DRAFT_TARGET_ITEMS,
  MAX_UUID_ARRAY_ITEMS,
  McpToolInputError,
  readOptionalDraftTargets,
  readOptionalUuidArray,
} from "./tool-input";

const ID = "11111111-1111-4111-8111-111111111111";

describe("array size caps (enforced before elements are processed)", () => {
  it("rejects a uuid array over the cap without validating its elements", () => {
    const oversized = Array.from({ length: MAX_UUID_ARRAY_ITEMS + 1 }, () => 1);
    expect(() =>
      readOptionalUuidArray({ mediaIds: oversized }, "mediaIds"),
    ).toThrow(/maksimum 10 item/);
  });

  it("accepts exactly the cap", () => {
    const ids = Array.from({ length: MAX_UUID_ARRAY_ITEMS }, () => ID);
    expect(readOptionalUuidArray({ mediaIds: ids }, "mediaIds")).toHaveLength(
      MAX_UUID_ARRAY_ITEMS,
    );
  });

  it("rejects a target list over the cap", () => {
    const oversized = Array.from(
      { length: MAX_DRAFT_TARGET_ITEMS + 1 },
      () => ({
        accountId: ID,
        contentFormat: "post",
      }),
    );
    expect(() =>
      readOptionalDraftTargets({ targets: oversized }, "targets"),
    ).toThrow(McpToolInputError);
  });
});
