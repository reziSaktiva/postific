import { describe, expect, it } from "vitest";

import { ContentFormat, SocialPlatform } from "@postific/shared";

import { REEL_REQUIRES_VIDEO_MESSAGE } from "@/domains/publishing/content-format-matrix";
import {
  PINTEREST_BOARD_REQUIRED_MESSAGE,
  PINTEREST_ONE_ACCOUNT_MESSAGE,
} from "@/domains/publishing/pinterest-board-constraints";
import { MIXED_STORY_CAPTION_MESSAGE } from "@/domains/publishing/story-caption-constraints";

import type { NetworkTarget } from "./network-validation";
import {
  getFormatOptionState,
  validateCrossNetwork,
  validateNetworkBlock,
  validateNetworks,
} from "./network-validation";

const video = { type: "video" };
const image = { type: "image" };
const gif = { type: "gif" };

function target(
  platform: SocialPlatform,
  contentFormat: ContentFormat,
  extra: Partial<NetworkTarget> = {},
): NetworkTarget {
  return { accountId: `${platform}-1`, platform, contentFormat, ...extra };
}

describe("validateNetworkBlock", () => {
  const cases: Array<
    [string, SocialPlatform, ContentFormat, Array<{ type: string }>, string[]]
  > = [
    [
      "Instagram Post tanpa media",
      SocialPlatform.Instagram,
      ContentFormat.Post,
      [],
      ["media-required"],
    ],
    [
      "Instagram Post dengan gambar",
      SocialPlatform.Instagram,
      ContentFormat.Post,
      [image],
      [],
    ],
    [
      "Facebook Post teks saja",
      SocialPlatform.Facebook,
      ContentFormat.Post,
      [],
      [],
    ],
    [
      "Facebook Story tanpa media",
      SocialPlatform.Facebook,
      ContentFormat.Story,
      [],
      ["media-required"],
    ],
    [
      "Facebook Story dengan gambar",
      SocialPlatform.Facebook,
      ContentFormat.Story,
      [image],
      [],
    ],
    [
      "Instagram Reel tanpa media (hanya media wajib)",
      SocialPlatform.Instagram,
      ContentFormat.Reel,
      [],
      ["media-required"],
    ],
    [
      "Instagram Reel satu video",
      SocialPlatform.Instagram,
      ContentFormat.Reel,
      [video],
      [],
    ],
    [
      "Instagram Reel satu gambar",
      SocialPlatform.Instagram,
      ContentFormat.Reel,
      [image],
      ["reel-requires-video"],
    ],
    [
      "Facebook Reel satu GIF",
      SocialPlatform.Facebook,
      ContentFormat.Reel,
      [gif],
      ["reel-requires-video"],
    ],
    [
      "Facebook Reel dua video",
      SocialPlatform.Facebook,
      ContentFormat.Reel,
      [video, video],
      ["reel-requires-video"],
    ],
    [
      "Facebook Reel video dan gambar",
      SocialPlatform.Facebook,
      ContentFormat.Reel,
      [video, image],
      ["reel-requires-video"],
    ],
    [
      "TikTok Post tanpa media",
      SocialPlatform.TikTok,
      ContentFormat.Post,
      [],
      ["media-required"],
    ],
    ["X Post teks saja", SocialPlatform.Twitter, ContentFormat.Post, [], []],
  ];

  it.each(cases)("%s", (_label, platform, format, media, codes) => {
    const issues = validateNetworkBlock(target(platform, format), media);
    expect(issues.map((issue) => issue.code)).toEqual(codes);
  });

  it("memakai teks pesan domain untuk Reel", () => {
    const [issue] = validateNetworkBlock(
      target(SocialPlatform.Instagram, ContentFormat.Reel),
      [image],
    );
    expect(issue?.message).toBe(REEL_REQUIRES_VIDEO_MESSAGE);
  });

  it("menyebut jaringan pada pesan media wajib", () => {
    const [issue] = validateNetworkBlock(
      target(SocialPlatform.Instagram, ContentFormat.Post),
      [],
    );
    expect(issue?.message).toContain(
      "Instagram tidak bisa dipublish tanpa media",
    );
  });

  it("Pinterest tanpa board dan tanpa media melaporkan keduanya, media lebih dulu", () => {
    const issues = validateNetworkBlock(
      target(SocialPlatform.Pinterest, ContentFormat.Pin),
      [],
    );
    expect(issues.map((issue) => issue.code)).toEqual([
      "media-required",
      "pinterest-board-required",
    ]);
    expect(issues[1]?.message).toBe(PINTEREST_BOARD_REQUIRED_MESSAGE);
  });

  it("Pinterest dengan board dan media tidak punya pelanggaran", () => {
    expect(
      validateNetworkBlock(
        target(SocialPlatform.Pinterest, ContentFormat.Pin, { boardId: "b1" }),
        [image],
      ),
    ).toEqual([]);
  });

  it("board berisi spasi saja dianggap belum dipilih", () => {
    const issues = validateNetworkBlock(
      target(SocialPlatform.Pinterest, ContentFormat.Pin, { boardId: "  " }),
      [image],
    );
    expect(issues.map((issue) => issue.code)).toEqual([
      "pinterest-board-required",
    ]);
  });
});

describe("validateCrossNetwork", () => {
  it("dua akun Pinterest melanggar aturan satu akun", () => {
    const issues = validateCrossNetwork(
      [
        target(SocialPlatform.Pinterest, ContentFormat.Pin, {
          accountId: "p1",
          boardId: "b",
        }),
        target(SocialPlatform.Pinterest, ContentFormat.Pin, {
          accountId: "p2",
          boardId: "b",
        }),
      ],
      "",
    );
    expect(issues).toEqual([
      { code: "pinterest-one-account", message: PINTEREST_ONE_ACCOUNT_MESSAGE },
    ]);
  });

  it("satu akun Pinterest tanpa board bukan pelanggaran lintas jaringan", () => {
    expect(
      validateCrossNetwork(
        [target(SocialPlatform.Pinterest, ContentFormat.Pin)],
        "",
      ),
    ).toEqual([]);
  });

  const mixedCases: Array<
    [string, ContentFormat, ContentFormat, string, number]
  > = [
    [
      "Story + Post dengan caption",
      ContentFormat.Story,
      ContentFormat.Post,
      "halo",
      1,
    ],
    [
      "Story + Post caption kosong",
      ContentFormat.Story,
      ContentFormat.Post,
      "   ",
      0,
    ],
    [
      "Story + Story dengan caption",
      ContentFormat.Story,
      ContentFormat.Story,
      "halo",
      0,
    ],
    [
      "Post + Reel dengan caption",
      ContentFormat.Post,
      ContentFormat.Reel,
      "halo",
      0,
    ],
  ];

  it.each(mixedCases)("%s", (_label, a, b, caption, count) => {
    const issues = validateCrossNetwork(
      [
        target(SocialPlatform.Instagram, a, { accountId: "a" }),
        target(SocialPlatform.Facebook, b, { accountId: "b" }),
      ],
      caption,
    );
    expect(issues).toHaveLength(count);
    if (count > 0) {
      expect(issues[0]).toEqual({
        code: "mixed-story-caption",
        message: MIXED_STORY_CAPTION_MESSAGE,
      });
    }
  });

  it("tanpa akun tidak ada pelanggaran", () => {
    expect(validateCrossNetwork([], "halo")).toEqual([]);
  });
});

describe("validateNetworks", () => {
  it("menempatkan pelanggaran per akun dan lintas jaringan terpisah", () => {
    const ig = target(SocialPlatform.Instagram, ContentFormat.Story, {
      accountId: "ig",
    });
    const fb = target(SocialPlatform.Facebook, ContentFormat.Post, {
      accountId: "fb",
    });
    const result = validateNetworks([ig, fb], "halo", []);
    expect(result.byAccount.ig?.map((i) => i.code)).toEqual(["media-required"]);
    expect(result.byAccount.fb).toEqual([]);
    expect(result.cross.map((i) => i.code)).toEqual(["mixed-story-caption"]);
    expect(result.hasBlockingIssues).toBe(true);
  });

  it("kombinasi sah tidak memblokir", () => {
    const ig = target(SocialPlatform.Instagram, ContentFormat.Reel, {
      accountId: "ig",
    });
    const fb = target(SocialPlatform.Facebook, ContentFormat.Post, {
      accountId: "fb",
    });
    const result = validateNetworks([ig, fb], "halo", [video]);
    expect(result.hasBlockingIssues).toBe(false);
    expect(result.cross).toEqual([]);
  });

  it("tanpa akun tidak memblokir", () => {
    expect(validateNetworks([], "", []).hasBlockingIssues).toBe(false);
  });
});

describe("getFormatOptionState", () => {
  it("Reel nonaktif dengan pesan T-200 bila media gambar", () => {
    expect(
      getFormatOptionState(SocialPlatform.Instagram, ContentFormat.Reel, [
        image,
      ]),
    ).toEqual({ disabled: true, reason: REEL_REQUIRES_VIDEO_MESSAGE });
  });

  it("Reel nonaktif bila lebih dari satu video", () => {
    expect(
      getFormatOptionState(SocialPlatform.Facebook, ContentFormat.Reel, [
        video,
        video,
      ]).disabled,
    ).toBe(true);
  });

  it("Reel aktif bila satu video atau belum ada media", () => {
    expect(
      getFormatOptionState(SocialPlatform.Instagram, ContentFormat.Reel, [
        video,
      ]).disabled,
    ).toBe(false);
    expect(
      getFormatOptionState(SocialPlatform.Instagram, ContentFormat.Reel, [])
        .disabled,
    ).toBe(false);
  });

  it("Post dan Story selalu aktif", () => {
    for (const format of [ContentFormat.Post, ContentFormat.Story]) {
      expect(
        getFormatOptionState(SocialPlatform.Instagram, format, [image, image]),
      ).toEqual({ disabled: false, reason: null });
    }
  });
});
