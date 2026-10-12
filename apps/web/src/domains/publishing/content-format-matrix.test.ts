import { ContentFormat, SocialPlatform } from "@postific/shared";
import { describe, expect, it } from "vitest";
import { PublishingDomainError } from "./errors";
import {
  assertContentFormatAllowed,
  assertMediaCountMeetsMinimum,
  assertMediaCountWithinLimit,
  maxMediaCountForFormat,
  maxMediaCountForFormats,
  minMediaCountConstraintMessage,
  minMediaCountForFormat,
  minMediaCountForFormats,
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

describe("minMediaCountForFormats", () => {
  it("returns 0 when no format is selected yet", () => {
    expect(minMediaCountForFormats([])).toBe(0);
  });

  it("returns the single format's minimum when only one format is selected", () => {
    expect(minMediaCountForFormats([ContentFormat.Post])).toBe(0);
    expect(minMediaCountForFormats([ContentFormat.Story])).toBe(1);
  });

  it("returns the MAXIMUM across formats when multiple targets with different formats are selected (stricter format wins)", () => {
    expect(
      minMediaCountForFormats([ContentFormat.Post, ContentFormat.Story]),
    ).toBe(1);
    expect(
      minMediaCountForFormats([ContentFormat.Post, ContentFormat.Reel]),
    ).toBe(1);
  });
});

describe("minMediaCountConstraintMessage", () => {
  it("returns null when Post-only has 0 media (caption-only is valid)", () => {
    expect(minMediaCountConstraintMessage(0, [ContentFormat.Post])).toBeNull();
  });

  it("returns null when Story has at least 1 media", () => {
    expect(minMediaCountConstraintMessage(1, [ContentFormat.Story])).toBeNull();
  });

  it("returns a message when Story has 0 media", () => {
    expect(minMediaCountConstraintMessage(0, [ContentFormat.Story])).toEqual(
      expect.stringContaining("minimal 1 media"),
    );
  });

  it("returns a message when a mixed Post+Story selection has 0 media (Story in the mix still requires media)", () => {
    expect(
      minMediaCountConstraintMessage(0, [
        ContentFormat.Post,
        ContentFormat.Story,
      ]),
    ).toEqual(expect.stringContaining("minimal 1 media"));
  });
});

describe("assertMediaCountMeetsMinimum", () => {
  it("does not throw when Post has 0 media", () => {
    expect(() =>
      assertMediaCountMeetsMinimum(0, [ContentFormat.Post]),
    ).not.toThrow();
  });

  it("does not throw when Story has exactly the minimum (1 media)", () => {
    expect(() =>
      assertMediaCountMeetsMinimum(1, [ContentFormat.Story]),
    ).not.toThrow();
  });

  it("throws PublishingDomainError when Story has 0 media (KI-074)", () => {
    expect(() =>
      assertMediaCountMeetsMinimum(0, [ContentFormat.Story]),
    ).toThrow(PublishingDomainError);
  });

  it("throws PublishingDomainError when Reel has 0 media", () => {
    expect(() => assertMediaCountMeetsMinimum(0, [ContentFormat.Reel])).toThrow(
      PublishingDomainError,
    );
  });

  it("throws PublishingDomainError when Pin has 0 media", () => {
    expect(() => assertMediaCountMeetsMinimum(0, [ContentFormat.Pin])).toThrow(
      PublishingDomainError,
    );
  });
});
