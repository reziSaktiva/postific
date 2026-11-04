import { describe, expect, it } from "vitest";

import { ContentFormat, SocialPlatform } from "@postific/shared";

import {
  buildPostPreview,
  resolveActivePreviewAccountId,
  splitCaption,
} from "./preview-model";

const instagram = {
  id: "ig1",
  platform: SocialPlatform.Instagram,
  handle: "@kopiselasar",
};
const facebook = {
  id: "fb1",
  platform: SocialPlatform.Facebook,
  handle: "Kopi Selasar",
};
const image = {
  id: "m1",
  url: "https://x/a.jpg",
  type: "image",
  filename: "a.jpg",
};
const video = {
  id: "m2",
  url: "https://x/b.mp4",
  type: "video",
  filename: "b.mp4",
};

describe("splitCaption", () => {
  it("menandai hashtag tanpa kehilangan teks", () => {
    const caption = "Kopi pagi #kopisusu enak #barista!";
    const segments = splitCaption(caption);
    expect(segments.map((s) => s.text).join("")).toBe(caption);
    expect(segments.filter((s) => s.isHashtag).map((s) => s.text)).toEqual([
      "#kopisusu",
      "#barista",
    ]);
  });

  it("caption kosong tidak menghasilkan segmen", () => {
    expect(splitCaption("")).toEqual([]);
  });

  it("tanda # sendirian bukan hashtag", () => {
    expect(splitCaption("nomor # 5").some((s) => s.isHashtag)).toBe(false);
  });
});

describe("resolveActivePreviewAccountId", () => {
  it("memakai pilihan pengguna selama akun masih terpilih", () => {
    expect(resolveActivePreviewAccountId(["ig1", "fb1"], "fb1")).toBe("fb1");
  });

  it("jatuh ke akun terpilih pertama saat pilihan sudah dilepas", () => {
    expect(resolveActivePreviewAccountId(["ig1"], "fb1")).toBe("ig1");
    expect(resolveActivePreviewAccountId(["ig1", "fb1"], null)).toBe("ig1");
  });

  it("tanpa akun terpilih hasilnya null (keadaan kosong)", () => {
    expect(resolveActivePreviewAccountId([], "ig1")).toBeNull();
  });
});

describe("buildPostPreview", () => {
  it("Facebook Post memakai nama akun apa adanya dan meringkas media", () => {
    const model = buildPostPreview({
      account: facebook,
      format: ContentFormat.Post,
      caption: "Halo #kopi",
      media: [image, video],
    });
    if (model.kind !== "facebook-post") throw new Error("kind tidak sesuai");
    expect(model.displayName).toBe("Kopi Selasar");
    expect(model.initial).toBe("K");
    expect(model.hasCaption).toBe(true);
    expect(model.media.first).toEqual({
      url: "https://x/a.jpg",
      isVideo: false,
      filename: "a.jpg",
    });
    expect(model.media.count).toBe(2);
    expect(model.media.counterLabel).toBe("1/2");
  });

  it("Instagram Post membuang awalan @ dan menandai caption panjang", () => {
    const short = buildPostPreview({
      account: instagram,
      format: ContentFormat.Post,
      caption: "a".repeat(125),
      media: [image],
    });
    const long = buildPostPreview({
      account: instagram,
      format: ContentFormat.Post,
      caption: "a".repeat(126),
      media: [image],
    });
    if (short.kind !== "instagram-post" || long.kind !== "instagram-post") {
      throw new Error("kind tidak sesuai");
    }
    expect(short.displayName).toBe("kopiselasar");
    expect(short.isCaptionLong).toBe(false);
    expect(long.isCaptionLong).toBe(true);
  });

  it("caption hanya spasi belum dianggap isi, tanpa media tidak ada penanda", () => {
    const model = buildPostPreview({
      account: instagram,
      format: ContentFormat.Post,
      caption: "   \n",
      media: [],
    });
    if (model.kind !== "instagram-post") throw new Error("kind tidak sesuai");
    expect(model.hasCaption).toBe(false);
    expect(model.media.first).toBeNull();
    expect(model.media.count).toBe(0);
    expect(model.media.counterLabel).toBeNull();
  });

  it.each([
    ["Instagram", "Reel", instagram, ContentFormat.Reel],
    ["Instagram", "Story", instagram, ContentFormat.Story],
    ["Facebook", "Reel", facebook, ContentFormat.Reel],
    ["Facebook", "Story", facebook, ContentFormat.Story],
  ] as const)(
    "%s %s menghasilkan kartu vertikal",
    (_platform, _format, account, format) => {
      const model = buildPostPreview({
        account,
        format,
        caption: "x",
        media: [video],
      });
      expect(model).toMatchObject({
        kind: "vertical",
        format,
        media: { first: { isVideo: true } },
      });
    },
  );

  it("platform tanpa Pratinjau (T-204) dilaporkan unavailable", () => {
    const model = buildPostPreview({
      account: { id: "tt1", platform: SocialPlatform.TikTok, handle: "@x" },
      format: ContentFormat.Post,
      caption: "x",
      media: [],
    });
    expect(model).toEqual({
      kind: "unavailable",
      accountId: "tt1",
      platform: SocialPlatform.TikTok,
      format: ContentFormat.Post,
    });
  });
});
