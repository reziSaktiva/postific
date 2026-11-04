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

  it("Reel dan Story menghasilkan kartu vertikal untuk Instagram dan Facebook", () => {
    for (const account of [instagram, facebook]) {
      for (const format of [ContentFormat.Reel, ContentFormat.Story] as const) {
        const model = buildPostPreview({
          account,
          format,
          caption: "x",
          media: [video],
        });
        if (model.kind !== "vertical") throw new Error("kind tidak sesuai");
        expect(model.format).toBe(format);
        expect(model.media.first?.isVideo).toBe(true);
      }
    }
  });

  it("TikTok selalu kartu tiktok apa pun formatnya, dengan media video", () => {
    for (const format of [ContentFormat.Post, ContentFormat.Reel]) {
      const model = buildPostPreview({
        account: { id: "tt1", platform: SocialPlatform.TikTok, handle: "@x" },
        format,
        caption: "Seduh #kopi",
        media: [video],
      });
      if (model.kind !== "tiktok") throw new Error("kind tidak sesuai");
      expect(model.displayName).toBe("@x");
      expect(model.hasCaption).toBe(true);
      expect(model.media.first?.isVideo).toBe(true);
    }
  });

  it("platform tanpa Pratinjau khusus memakai kartu generik", () => {
    for (const platform of [
      SocialPlatform.Twitter,
      SocialPlatform.LinkedIn,
      SocialPlatform.YouTube,
      SocialPlatform.Threads,
    ]) {
      const model = buildPostPreview({
        account: { id: "x1", platform, handle: "Kopi" },
        format: ContentFormat.Post,
        caption: "",
        media: [],
      });
      if (model.kind !== "generic") throw new Error("kind tidak sesuai");
      expect(model.platform).toBe(platform);
      expect(model.hasCaption).toBe(false);
      expect(model.media.first).toBeNull();
    }
  });
});

describe("buildPostPreview Pinterest", () => {
  const pinAccount = {
    id: "pin1",
    platform: SocialPlatform.Pinterest,
    handle: "Kopi Selasar",
  };
  const boards = [
    { id: "b1", name: "Resep" },
    { id: "b2", name: "Menu" },
  ];

  it("memetakan judul, host link, dan nama board dari blok jaringan", () => {
    const model = buildPostPreview({
      account: pinAccount,
      format: ContentFormat.Pin,
      caption: "Resep rumahan",
      media: [image],
      pinterest: {
        title: "  Kopi Susu  ",
        link: "https://kopiselasar.id/resep/kopi",
        boardId: "b2",
        boards,
      },
    });
    if (model.kind !== "pinterest-pin") throw new Error("kind tidak sesuai");
    expect(model.pinTitle).toBe("Kopi Susu");
    expect(model.linkHost).toBe("kopiselasar.id");
    expect(model.boardName).toBe("Menu");
  });

  it("board belum dipilih, tidak ada di daftar, atau daftar belum termuat menghasilkan null", () => {
    const base = {
      account: pinAccount,
      format: ContentFormat.Pin,
      caption: "",
      media: [],
    };
    const cases = [
      { title: "", link: "", boardId: undefined, boards },
      { title: "", link: "", boardId: "tidak-ada", boards },
      { title: "", link: "", boardId: "b1", boards: [] },
    ];
    for (const pinterest of cases) {
      const model = buildPostPreview({ ...base, pinterest });
      if (model.kind !== "pinterest-pin") throw new Error("kind tidak sesuai");
      expect(model.boardName).toBeNull();
    }
  });

  it("link kosong, bukan URL, atau bukan http(s) tidak menghasilkan host", () => {
    for (const link of ["", "   ", "kopi.id/resep", "javascript:alert(1)"]) {
      const model = buildPostPreview({
        account: pinAccount,
        format: ContentFormat.Pin,
        caption: "",
        media: [],
        pinterest: { title: "", link, boardId: undefined, boards },
      });
      if (model.kind !== "pinterest-pin") throw new Error("kind tidak sesuai");
      expect(model.linkHost).toBeNull();
    }
  });

  it("tanpa data blok jaringan pin tetap valid dengan judul kosong", () => {
    const model = buildPostPreview({
      account: pinAccount,
      format: ContentFormat.Pin,
      caption: "x",
      media: [],
    });
    if (model.kind !== "pinterest-pin") throw new Error("kind tidak sesuai");
    expect(model.pinTitle).toBe("");
    expect(model.linkHost).toBeNull();
    expect(model.boardName).toBeNull();
  });
});
