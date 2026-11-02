import { asMediaId } from "@postific/shared";
import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/utils/errors";
import { resolveDraftMediaIds } from "./resolve-draft-media-ids";

describe("resolveDraftMediaIds", () => {
  it("returns the requested mediaIds as-is when every id is found (owned by this workspace)", () => {
    const mediaIds = [asMediaId("media-1"), asMediaId("media-2")];
    const found = mediaIds.map((id) => ({ id }));

    expect(resolveDraftMediaIds(found, mediaIds)).toEqual(mediaIds);
  });

  it("returns an empty array when no mediaIds are requested", () => {
    expect(resolveDraftMediaIds([], [])).toEqual([]);
  });

  it("matches ids case-insensitively and returns the stored (canonical) ids", () => {
    const stored = asMediaId("0a1b2c3d-0000-4000-8000-00000000000a");

    expect(
      resolveDraftMediaIds([{ id: stored }], [asMediaId(stored.toUpperCase())]),
    ).toEqual([stored]);
  });

  it("rejects the same media requested twice with different letter case", () => {
    const stored = asMediaId("0a1b2c3d-0000-4000-8000-00000000000a");

    expect(() =>
      resolveDraftMediaIds(
        [{ id: stored }],
        [stored, asMediaId(stored.toUpperCase())],
      ),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError when a requested mediaId is not found (not owned by this workspace, deleted, or invalid)", () => {
    const mediaIds = [asMediaId("media-1"), asMediaId("media-other-workspace")];
    const found = [{ id: asMediaId("media-1") }];

    expect(() => resolveDraftMediaIds(found, mediaIds)).toThrow(
      ValidationError,
    );
  });
});
