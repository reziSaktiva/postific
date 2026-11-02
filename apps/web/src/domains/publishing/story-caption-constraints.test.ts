import { ContentFormat } from "@postific/shared";
import { describe, expect, it } from "vitest";

import {
  CAPTION_REQUIRED_MESSAGE,
  MIXED_STORY_CAPTION_MESSAGE,
  MIXED_STORY_CAPTION_SCHEDULE_MESSAGE,
  captionRequiredConstraintMessage,
  isCaptionRequiredForFormats,
  mixedStoryCaptionConstraintMessage,
} from "./story-caption-constraints";

const { Post, Reel, Story } = ContentFormat;

describe("captionRequiredConstraintMessage", () => {
  it("requires a caption unless a Story target exists", () => {
    expect(isCaptionRequiredForFormats([Post, Reel])).toBe(true);
    expect(isCaptionRequiredForFormats([Story])).toBe(false);
    expect(captionRequiredConstraintMessage("  ", [Post])).toBe(
      CAPTION_REQUIRED_MESSAGE,
    );
    expect(captionRequiredConstraintMessage("Halo", [Post])).toBeNull();
    expect(captionRequiredConstraintMessage("", [Story])).toBeNull();
  });
});

describe("mixedStoryCaptionConstraintMessage", () => {
  it("rejects Story combined with another format only while the caption is filled", () => {
    expect(mixedStoryCaptionConstraintMessage("Halo", [Story, Post])).toBe(
      MIXED_STORY_CAPTION_MESSAGE,
    );
    expect(mixedStoryCaptionConstraintMessage("  ", [Story, Post])).toBeNull();
    expect(mixedStoryCaptionConstraintMessage("Halo", [Story])).toBeNull();
    expect(mixedStoryCaptionConstraintMessage("Halo", [Post, Reel])).toBeNull();
  });

  it("uses the scheduling wording on the server path without changing the UI wording", () => {
    expect(
      mixedStoryCaptionConstraintMessage(
        "Halo",
        [Story, Post],
        MIXED_STORY_CAPTION_SCHEDULE_MESSAGE,
      ),
    ).toBe(MIXED_STORY_CAPTION_SCHEDULE_MESSAGE);
    expect(MIXED_STORY_CAPTION_SCHEDULE_MESSAGE).toContain("jadwalkan Story");
    expect(MIXED_STORY_CAPTION_MESSAGE).toContain("publish Story");
  });
});
