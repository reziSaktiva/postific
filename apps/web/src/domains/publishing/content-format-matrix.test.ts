import { ContentFormat, SocialPlatform } from "@postific/shared";
import { describe, expect, it } from "vitest";
import { PublishingDomainError } from "./errors";
import {
  assertContentFormatAllowed,
  assertMediaCountMeetsMinimum,
  assertMediaCountWithinLimit,
  getAllowedContentFormats,
  maxMediaCountForFormat,
  maxMediaCountForFormats,
  minMediaCountConstraintMessage,
  minMediaCountForFormat,
  minMediaCountForTargets,
  targetRequiresMedia,
} from "./content-format-matrix";

describe("assertContentFormatAllowed", () => {
  it("allows Post/Reel/Story for Instagram", () => {
    expect(() =>
      assertContentFormatAllowed(SocialPlatform.Instagram, ContentFormat.Reel),
    ).not.toThrow();
  });

  it("throws for a format not allowed on the platform", () => {
    expect(() =>
      assertContentFormatAllowed(SocialPlatform.Pinterest, ContentFormat.Reel),
    ).toThrow(PublishingDomainError);
  });
});

describe("getAllowedContentFormats", () => {
  it("returns the ADR-039 formats per platform", () => {
    expect(getAllowedContentFormats(SocialPlatform.Instagram)).toEqual([
      ContentFormat.Post,
      ContentFormat.Reel,
      ContentFormat.Story,
    ]);
    expect(getAllowedContentFormats(SocialPlatform.Pinterest)).toEqual([
      ContentFormat.Pin,
    ]);
  });

  it("falls back to Post for platforms outside the matrix", () => {
    expect(getAllowedContentFormats(SocialPlatform.Twitter)).toEqual([
      ContentFormat.Post,
    ]);
  });

  it("returns a copy so callers cannot mutate the matrix", () => {
    getAllowedContentFormats(SocialPlatform.Instagram).pop();
    expect(getAllowedContentFormats(SocialPlatform.Instagram)).toHaveLength(3);
  });
});

describe("maxMediaCountForFormat", () => {
  it("returns 10 for Post (IG/FB carousel limit)", () => {
    expect(maxMediaCountForFormat(ContentFormat.Post)).toBe(10);
  });

  it("returns 1 for Reel/Story/Pin (single-media platform limits)", () => {
    expect(maxMediaCountForFormat(ContentFormat.Reel)).toBe(1);
    expect(maxMediaCountForFormat(ContentFormat.Story)).toBe(1);
    expect(maxMediaCountForFormat(ContentFormat.Pin)).toBe(1);
  });
});

describe("maxMediaCountForFormats", () => {
  it("defaults to 10 (most permissive) when no format is selected yet", () => {
    expect(maxMediaCountForFormats([])).toBe(10);
  });

  it("returns the single format's limit when only one format is selected", () => {
    expect(maxMediaCountForFormats([ContentFormat.Post])).toBe(10);
    expect(maxMediaCountForFormats([ContentFormat.Reel])).toBe(1);
  });

  it("returns the MINIMUM across formats when multiple targets with different formats are selected (ADR-107)", () => {
    expect(
      maxMediaCountForFormats([ContentFormat.Post, ContentFormat.Reel]),
    ).toBe(1);
    expect(
      maxMediaCountForFormats([
        ContentFormat.Post,
        ContentFormat.Story,
        ContentFormat.Pin,
      ]),
    ).toBe(1);
  });
});

describe("assertMediaCountWithinLimit", () => {
  it("does not throw when count is within the effective limit", () => {
    expect(() =>
      assertMediaCountWithinLimit(5, [ContentFormat.Post]),
    ).not.toThrow();
  });

  it("does not throw when count equals the effective limit exactly", () => {
    expect(() =>
      assertMediaCountWithinLimit(1, [ContentFormat.Reel]),
    ).not.toThrow();
  });

  it("throws PublishingDomainError when count exceeds the effective limit", () => {
    expect(() => assertMediaCountWithinLimit(2, [ContentFormat.Reel])).toThrow(
      PublishingDomainError,
    );
  });

  it("uses the minimum limit across mixed formats (e.g. IG Reel + FB Story in one post)", () => {
    expect(() =>
      assertMediaCountWithinLimit(2, [ContentFormat.Post, ContentFormat.Story]),
    ).toThrow(PublishingDomainError);
  });
});

describe("minMediaCountForFormat", () => {
  it("returns 0 for Post (caption-only feed post is valid)", () => {
    expect(minMediaCountForFormat(ContentFormat.Post)).toBe(0);
  });

  it("returns 1 for Reel/Story/Pin (native media-only formats, KI-074)", () => {
    expect(minMediaCountForFormat(ContentFormat.Reel)).toBe(1);
    expect(minMediaCountForFormat(ContentFormat.Story)).toBe(1);
    expect(minMediaCountForFormat(ContentFormat.Pin)).toBe(1);
  });
});

const IG = SocialPlatform.Instagram;
const FB = SocialPlatform.Facebook;

function target(platform: SocialPlatform, contentFormat: ContentFormat) {
  return { platform, contentFormat };
}

describe("targetRequiresMedia (ADR-154)", () => {
  it("requires media for every Instagram format", () => {
    for (const format of [
      ContentFormat.Post,
      ContentFormat.Reel,
      ContentFormat.Story,
    ]) {
      expect(targetRequiresMedia(target(IG, format))).toBe(true);
    }
  });

  it("requires media for TikTok, YouTube, and Pinterest", () => {
    expect(
      targetRequiresMedia(target(SocialPlatform.TikTok, ContentFormat.Post)),
    ).toBe(true);
    expect(
      targetRequiresMedia(target(SocialPlatform.YouTube, ContentFormat.Post)),
    ).toBe(true);
    expect(
      targetRequiresMedia(target(SocialPlatform.Pinterest, ContentFormat.Pin)),
    ).toBe(true);
  });

  it("requires media for Facebook Reel and Story but not Facebook Post", () => {
    expect(targetRequiresMedia(target(FB, ContentFormat.Reel))).toBe(true);
    expect(targetRequiresMedia(target(FB, ContentFormat.Story))).toBe(true);
    expect(targetRequiresMedia(target(FB, ContentFormat.Post))).toBe(false);
  });

  it("allows text-only for LinkedIn, Threads, and X", () => {
    for (const platform of [
      SocialPlatform.LinkedIn,
      SocialPlatform.Threads,
      SocialPlatform.Twitter,
    ]) {
      expect(targetRequiresMedia(target(platform, ContentFormat.Post))).toBe(
        false,
      );
    }
  });
});

describe("minMediaCountForTargets", () => {
  it("returns 0 when no target is selected yet", () => {
    expect(minMediaCountForTargets([])).toBe(0);
  });

  it("returns 1 when ANY target requires media (stricter target wins)", () => {
    expect(
      minMediaCountForTargets([
        target(FB, ContentFormat.Post),
        target(IG, ContentFormat.Post),
      ]),
    ).toBe(1);
  });

  it("returns 0 when only text-only-capable targets are selected", () => {
    expect(minMediaCountForTargets([target(FB, ContentFormat.Post)])).toBe(0);
  });
});

describe("minMediaCountConstraintMessage", () => {
  it("returns null for Facebook Post with 0 media (caption-only is valid)", () => {
    expect(
      minMediaCountConstraintMessage(0, [target(FB, ContentFormat.Post)]),
    ).toBeNull();
  });

  it("returns null when a required target has at least 1 media", () => {
    expect(
      minMediaCountConstraintMessage(1, [target(IG, ContentFormat.Post)]),
    ).toBeNull();
  });

  it("names Instagram when an Instagram Post has 0 media", () => {
    expect(
      minMediaCountConstraintMessage(0, [target(IG, ContentFormat.Post)]),
    ).toBe(
      "Instagram tidak bisa dipublish tanpa media. Tambahkan minimal 1 gambar atau video.",
    );
  });

  it("names every offending target once, Facebook with its format", () => {
    expect(
      minMediaCountConstraintMessage(0, [
        target(FB, ContentFormat.Reel),
        target(SocialPlatform.Pinterest, ContentFormat.Pin),
        target(FB, ContentFormat.Post),
        target(IG, ContentFormat.Post),
        target(IG, ContentFormat.Reel),
      ]),
    ).toBe(
      "Facebook Reel, Pinterest dan Instagram tidak bisa dipublish tanpa media. Tambahkan minimal 1 gambar atau video.",
    );
  });
});

describe("assertMediaCountMeetsMinimum", () => {
  it("does not throw for Facebook Post with 0 media", () => {
    expect(() =>
      assertMediaCountMeetsMinimum(0, [target(FB, ContentFormat.Post)]),
    ).not.toThrow();
  });

  it("does not throw when Story has exactly the minimum (1 media)", () => {
    expect(() =>
      assertMediaCountMeetsMinimum(1, [target(IG, ContentFormat.Story)]),
    ).not.toThrow();
  });

  it("throws PublishingDomainError when Instagram Post has 0 media (KI-107)", () => {
    expect(() =>
      assertMediaCountMeetsMinimum(0, [target(IG, ContentFormat.Post)]),
    ).toThrow(PublishingDomainError);
  });

  it("throws PublishingDomainError when Reel/Story/Pin has 0 media (KI-074)", () => {
    for (const t of [
      target(FB, ContentFormat.Reel),
      target(FB, ContentFormat.Story),
      target(SocialPlatform.Pinterest, ContentFormat.Pin),
    ]) {
      expect(() => assertMediaCountMeetsMinimum(0, [t])).toThrow(
        PublishingDomainError,
      );
    }
  });
});
