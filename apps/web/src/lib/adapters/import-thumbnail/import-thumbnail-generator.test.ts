import { asWorkspaceId } from "@postific/shared";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    storage: { from: () => ({ upload }) },
  }),
}));

import { TransientThumbnailError } from "@/domains/publishing";
import { importThumbnailGenerator } from "./import-thumbnail-generator";

const workspaceId = asWorkspaceId("w1");
const IMAGE_URL = "https://scontent-lax3-1.xx.fbcdn.net/v/a.jpg?oe=1";
const VIDEO_URL = "https://scontent-sjc3-1.cdninstagram.com/o1/v/a.mp4?oe=1";

async function bigJpeg(width = 1600, height = 900): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 80, b: 20 },
    },
  })
    .jpeg()
    .toBuffer();
}

const fetchMock = vi.fn();

beforeEach(() => {
  upload.mockReset();
  upload.mockResolvedValue({ error: null });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.FFMPEG_PATH;
});

describe("importThumbnailGenerator (T-230, ADR-158)", () => {
  it("gambar: kecilkan ke webp 640px dan simpan di path per target", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array(await bigJpeg()), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    );

    const result = await importThumbnailGenerator.generate({
      workspaceId,
      targetId: "t1",
      sourceUrl: IMAGE_URL,
    });

    expect(result).toEqual({
      storagePath: "w1/imports/t1.webp",
      kind: "image",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      IMAGE_URL,
      expect.objectContaining({ redirect: "error" }),
    );
    const [path, body, options] = upload.mock.calls[0];
    expect(path).toBe("w1/imports/t1.webp");
    expect(options).toEqual({ contentType: "image/webp", upsert: true });
    const meta = await sharp(body as Buffer).metadata();
    expect(meta.format).toBe("webp");
    expect(Math.max(meta.width!, meta.height!)).toBe(640);
  });

  it("tidak membesarkan gambar yang sudah kecil", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array(await bigJpeg(200, 100)), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    );
    await importThumbnailGenerator.generate({
      workspaceId,
      targetId: "t1",
      sourceUrl: IMAGE_URL,
    });
    const meta = await sharp(upload.mock.calls[0][1] as Buffer).metadata();
    expect(meta.width).toBe(200);
  });

  it("host tidak dikenal: null tanpa memanggil jaringan", async () => {
    const result = await importThumbnailGenerator.generate({
      workspaceId,
      targetId: "t1",
      sourceUrl: "https://evil.example.com/a.jpg",
    });
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("URL kedaluwarsa (403): null, tidak menyimpan apa pun", async () => {
    fetchMock.mockResolvedValue(new Response("denied", { status: 403 }));
    expect(
      await importThumbnailGenerator.generate({
        workspaceId,
        targetId: "t1",
        sourceUrl: IMAGE_URL,
      }),
    ).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });

  it.each([500, 503, 429, 408])(
    "CDN membalas %i: kegagalan SEMENTARA",
    async (status) => {
      fetchMock.mockResolvedValue(new Response("x", { status }));
      await expect(
        importThumbnailGenerator.generate({
          workspaceId,
          targetId: "t1",
          sourceUrl: IMAGE_URL,
        }),
      ).rejects.toBeInstanceOf(TransientThumbnailError);
    },
  );

  it.each([404, 410])("CDN membalas %i: permanen (null)", async (status) => {
    fetchMock.mockResolvedValue(new Response("x", { status }));
    expect(
      await importThumbnailGenerator.generate({
        workspaceId,
        targetId: "t1",
        sourceUrl: IMAGE_URL,
      }),
    ).toBeNull();
  });

  it("galat jaringan saat mengunduh: kegagalan SEMENTARA", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(
      importThumbnailGenerator.generate({
        workspaceId,
        targetId: "t1",
        sourceUrl: IMAGE_URL,
      }),
    ).rejects.toBeInstanceOf(TransientThumbnailError);
  });

  it("gambar rusak (content-type benar tetapi isi sampah): permanen (null)", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    );
    expect(
      await importThumbnailGenerator.generate({
        workspaceId,
        targetId: "t1",
        sourceUrl: IMAGE_URL,
      }),
    ).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });

  it("dibatalkan lewat signal: kegagalan SEMENTARA", async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        init.signal.aborted
          ? Promise.reject(new DOMException("aborted", "AbortError"))
          : Promise.resolve(new Response("x")),
    );
    await expect(
      importThumbnailGenerator.generate({
        workspaceId,
        targetId: "t1",
        sourceUrl: IMAGE_URL,
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(TransientThumbnailError);
  });

  it("respons bukan gambar: null", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    expect(
      await importThumbnailGenerator.generate({
        workspaceId,
        targetId: "t1",
        sourceUrl: IMAGE_URL,
      }),
    ).toBeNull();
  });

  it("gambar lebih besar dari batas: null", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array(10), {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
          "content-length": String(20 * 1024 * 1024),
        },
      }),
    );
    expect(
      await importThumbnailGenerator.generate({
        workspaceId,
        targetId: "t1",
        sourceUrl: IMAGE_URL,
      }),
    ).toBeNull();
  });

  it("gagal menyimpan ke Storage: kegagalan SEMENTARA (tidak ditandai permanen)", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array(await bigJpeg()), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    );
    upload.mockResolvedValue({ error: { message: "bucket penuh" } });
    await expect(
      importThumbnailGenerator.generate({
        workspaceId,
        targetId: "t1",
        sourceUrl: IMAGE_URL,
      }),
    ).rejects.toBeInstanceOf(TransientThumbnailError);
  });

  it("video lebih besar dari 30 MB (HEAD): dilewati tanpa menjalankan ffmpeg", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { "content-length": String(40 * 1024 * 1024) },
      }),
    );
    process.env.FFMPEG_PATH = "/tidak/ada/ffmpeg";
    expect(
      await importThumbnailGenerator.generate({
        workspaceId,
        targetId: "t1",
        sourceUrl: VIDEO_URL,
      }),
    ).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      VIDEO_URL,
      expect.objectContaining({ method: "HEAD", redirect: "manual" }),
    );
  });

  it("video ketika ffmpeg tidak terpasang: kegagalan SEMENTARA, bukan null permanen (review Ridwan H1)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { "content-length": "1000" },
      }),
    );
    process.env.FFMPEG_PATH = "/tidak/ada/ffmpeg";
    await expect(
      importThumbnailGenerator.generate({
        workspaceId,
        targetId: "t1",
        sourceUrl: VIDEO_URL,
      }),
    ).rejects.toBeInstanceOf(TransientThumbnailError);
    expect(upload).not.toHaveBeenCalled();
  });

  it("video: HEAD 405 (tidak didukung) tetap lanjut ke ffmpeg (ukuran tidak diketahui)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response(null, { status: 405 }));
    process.env.FFMPEG_PATH = "/tidak/ada/ffmpeg";
    // Sampai ffmpeg dijalankan (dan gagal sementara karena tidak ada), bukan null permanen.
    await expect(
      importThumbnailGenerator.generate({
        workspaceId,
        targetId: "t1",
        sourceUrl: VIDEO_URL,
      }),
    ).rejects.toBeInstanceOf(TransientThumbnailError);
  });

  it("T-233.0: HEAD dibalas redirect (302) adalah kegagalan PERMANEN (null), bukan sementara", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://other.example/v.mp4" },
      }),
    );
    process.env.FFMPEG_PATH = "/tidak/ada/ffmpeg";
    expect(
      await importThumbnailGenerator.generate({
        workspaceId,
        targetId: "t1",
        sourceUrl: VIDEO_URL,
      }),
    ).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });

  it("T-233.0: galat HEAD membawa penyebab di pesan kegagalan sementara", async () => {
    fetchMock.mockRejectedValue(
      new TypeError("fetch failed", {
        cause: new Error("connect ETIMEDOUT 1.2.3.4:443"),
      }),
    );
    await expect(
      importThumbnailGenerator.generate({
        workspaceId,
        targetId: "t1",
        sourceUrl: VIDEO_URL,
      }),
    ).rejects.toThrow(/HEAD video gagal: fetch failed .*ETIMEDOUT/);
  });

  it("video: HEAD ditolak (403): null", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    expect(
      await importThumbnailGenerator.generate({
        workspaceId,
        targetId: "t1",
        sourceUrl: VIDEO_URL,
      }),
    ).toBeNull();
  });
});

describe("importThumbnailGenerator tanpa sharp (review: import malas)", () => {
  it("sharp gagal dimuat: kegagalan SEMENTARA per media, bukan null permanen", async () => {
    vi.resetModules();
    vi.doMock("sharp", () => {
      throw new Error("libvips tidak termuat");
    });
    const { importThumbnailGenerator: generator } =
      await import("./import-thumbnail-generator");
    const { TransientThumbnailError: Transient } =
      await import("@/domains/publishing");
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    );
    await expect(
      generator.generate({ workspaceId, targetId: "t1", sourceUrl: IMAGE_URL }),
    ).rejects.toBeInstanceOf(Transient);
    vi.doUnmock("sharp");
    vi.resetModules();
  });
});
