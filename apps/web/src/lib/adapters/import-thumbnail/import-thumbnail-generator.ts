import { spawn } from "node:child_process";
import sharp from "sharp";
import {
  TransientThumbnailError,
  type IImportThumbnailGenerator,
  type ImportThumbnailKind,
} from "@/domains/publishing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAllowedThumbnailSource, looksLikeVideoUrl } from "./source-url";

/**
 * Pembuat thumbnail posting impor (T-230, ADR-158). Gambar: unduh (dibatasi
 * ukuran dan waktu), kecilkan dengan `sharp` ke webp. Video: `ffmpeg` membaca
 * URL HTTP dan mengambil SATU frame (spike T-229: sekitar 3% berkas yang
 * ditarik), lalu dikecilkan sama. Hasil disimpan di bucket `media` pada path
 * `{workspaceId}/imports/{targetId}.webp` (satu file per target, `upsert`
 * membuatnya idempoten).
 *
 * Dua jenis kegagalan (review Ridwan H1):
 * - PERMANEN, dikembalikan `null` dan ditandai oleh pemanggil: host tidak
 *   dikenal, URL kedaluwarsa (403/404/410 dan 4xx lain), bukan gambar, terlalu
 *   besar, media rusak.
 * - SEMENTARA, dilempar sebagai `TransientThumbnailError` dan TIDAK ditandai:
 *   timeout, 408/429/5xx, galat jaringan, `ffmpeg` tidak terpasang, galat
 *   Storage, dibatalkan.
 */
const MEDIA_BUCKET = "media";
const THUMBNAIL_MAX_SIDE_PX = 640;
const THUMBNAIL_WEBP_QUALITY = 75;
/** Batas piksel sumber untuk `sharp` (default 268 MP terlalu longgar untuk beberapa unduhan paralel). */
const MAX_INPUT_PIXELS = 50_000_000;
/** Batas unduhan gambar sumber. */
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
/** Batas ukuran video (`Content-Length` dari HEAD); lebih besar dilewati (spike T-229.1). */
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
/** Total waktu per media sesudah mendapat giliran, di bawah anggaran job. */
const TOTAL_TIMEOUT_MS = 9_000;
const FRAME_MAX_BYTES = 4 * 1024 * 1024;
/** Jumlah pekerjaan (`fetch`, `sharp`, `ffmpeg`) aktif bersamaan per proses, lintas job (review Ridwan H2). */
const MAX_CONCURRENT = 4;

class Semaphore {
  private active = 0;
  private readonly waiters: (() => void)[] = [];
  constructor(private readonly max: number) {}

  async acquire(signal?: AbortSignal): Promise<void> {
    while (this.active >= this.max) {
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          const index = this.waiters.indexOf(wake);
          if (index >= 0) this.waiters.splice(index, 1);
          reject(
            new TransientThumbnailError("dibatalkan saat menunggu giliran"),
          );
        };
        const wake = () => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        };
        if (signal?.aborted) return onAbort();
        signal?.addEventListener("abort", onAbort, { once: true });
        this.waiters.push(wake);
      });
    }
    this.active++;
  }

  release(): void {
    this.active--;
    this.waiters.shift()?.();
  }
}

const semaphore = new Semaphore(MAX_CONCURRENT);

function ffmpegBinary(): string {
  return process.env.FFMPEG_PATH || "ffmpeg";
}

let ffmpegMissingLogged = false;

function transient(message: string, cause?: unknown): TransientThumbnailError {
  return new TransientThumbnailError(message, { cause });
}

/** 408, 429, dan 5xx sementara; 4xx lain (403/404/410, dst.) permanen. */
function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function readBodyCapped(
  response: Response,
  maxBytes: number,
): Promise<Buffer | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    return null;
  }
  if (!response.body) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function fetchImage(
  url: string,
  signal: AbortSignal,
): Promise<Buffer | null> {
  let response: Response;
  try {
    response = await fetch(url, { redirect: "error", signal });
  } catch (error) {
    throw transient("gagal mengunduh gambar", error);
  }
  if (!response.ok) {
    await response.body?.cancel();
    if (isTransientStatus(response.status)) {
      throw transient(`CDN membalas ${response.status}`);
    }
    return null;
  }
  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) {
    await response.body?.cancel();
    return null;
  }
  try {
    return await readBodyCapped(response, MAX_IMAGE_BYTES);
  } catch (error) {
    throw transient("gagal membaca isi gambar", error);
  }
}

/** `ok` = boleh diproses, `refused` = permanen (terlalu besar atau sudah hilang). */
async function checkVideo(
  url: string,
  signal: AbortSignal,
): Promise<"ok" | "refused"> {
  let response: Response;
  try {
    response = await fetch(url, { method: "HEAD", redirect: "error", signal });
  } catch (error) {
    throw transient("HEAD video gagal", error);
  }
  if (
    response.status === 403 ||
    response.status === 404 ||
    response.status === 410
  ) {
    return "refused";
  }
  // `HEAD` ditolak dengan status lain (mis. 405): ukuran tidak diketahui,
  // `ffmpeg` tetap dibatasi waktu dan keluaran (review Ridwan L8).
  if (!response.ok) return "ok";
  const length = Number(response.headers.get("content-length"));
  return Number.isFinite(length) && length > MAX_VIDEO_BYTES ? "refused" : "ok";
}

/** Satu frame JPEG dari video, atau `null` (media rusak/URL mati); melempar untuk kegagalan sementara. */
export function extractVideoFrame(
  url: string,
  signal?: AbortSignal,
): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      fn();
    };
    const child = spawn(
      ffmpegBinary(),
      [
        "-v",
        "error",
        "-threads",
        "1",
        "-protocol_whitelist",
        "https,tls,tcp,crypto",
        "-rw_timeout",
        String(TOTAL_TIMEOUT_MS * 1000),
        // Paksa demuxer MP4/MOV: menolak playlist (HLS/DASH) atau concat yang
        // memicu permintaan ke host lain (review Ridwan L7).
        "-f",
        "mov",
        "-i",
        url,
        "-frames:v",
        "1",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "pipe:1",
      ],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    const chunks: Buffer[] = [];
    let total = 0;
    const onAbort = () => {
      child.kill("SIGKILL");
      settle(() => reject(transient("ffmpeg dibatalkan")));
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      settle(() => reject(transient("ffmpeg melewati batas waktu")));
    }, TOTAL_TIMEOUT_MS);
    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });

    child.stdout.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > FRAME_MAX_BYTES) {
        child.kill("SIGKILL");
        settle(() => resolve(null));
        return;
      }
      chunks.push(chunk);
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT" && !ffmpegMissingLogged) {
        ffmpegMissingLogged = true;
        console.error(
          `[importThumbnailGenerator] ffmpeg tidak ditemukan ("${ffmpegBinary()}"): poster video ditunda sampai ffmpeg tersedia (set FFMPEG_PATH atau pasang ffmpeg di build).`,
        );
      }
      settle(() => reject(transient("ffmpeg tidak dapat dijalankan", error)));
    });
    child.on("close", (code) =>
      settle(() =>
        resolve(code === 0 && total > 0 ? Buffer.concat(chunks) : null),
      ),
    );
  });
}

/** Kecilkan ke webp; `null` bila sumber bukan gambar yang valid. */
async function toThumbnailWebp(source: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(source, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({
        width: THUMBNAIL_MAX_SIDE_PX,
        height: THUMBNAIL_MAX_SIDE_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: THUMBNAIL_WEBP_QUALITY })
      .toBuffer();
  } catch {
    return null;
  }
}

async function upload(
  path: string,
  body: Buffer,
  signal: AbortSignal,
): Promise<void> {
  const supabase = createServerSupabaseClient();
  const result = await new Promise<{ error: { message: string } | null }>(
    (resolve, reject) => {
      const onAbort = () => reject(transient("upload dibatalkan"));
      if (signal.aborted) return onAbort();
      signal.addEventListener("abort", onAbort, { once: true });
      supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, body, { contentType: "image/webp", upsert: true })
        .then(resolve, reject)
        .finally(() => signal.removeEventListener("abort", onAbort));
    },
  );
  if (result.error) {
    throw transient(`gagal menyimpan thumbnail: ${result.error.message}`);
  }
}

export const importThumbnailGenerator: IImportThumbnailGenerator = {
  async generate({ workspaceId, targetId, sourceUrl, signal }) {
    if (!isAllowedThumbnailSource(sourceUrl)) return null;

    await semaphore.acquire(signal);
    try {
      const work = AbortSignal.any(
        signal
          ? [signal, AbortSignal.timeout(TOTAL_TIMEOUT_MS)]
          : [AbortSignal.timeout(TOTAL_TIMEOUT_MS)],
      );

      let kind: ImportThumbnailKind;
      let source: Buffer | null;
      if (looksLikeVideoUrl(sourceUrl)) {
        kind = "video_poster";
        source =
          (await checkVideo(sourceUrl, work)) === "ok"
            ? await extractVideoFrame(sourceUrl, work)
            : null;
      } else {
        kind = "image";
        source = await fetchImage(sourceUrl, work);
      }
      if (!source) return null;

      const webp = await toThumbnailWebp(source);
      if (!webp) return null;

      const storagePath = `${workspaceId}/imports/${targetId}.webp`;
      await upload(storagePath, webp, work);
      return { storagePath, kind };
    } finally {
      semaphore.release();
    }
  },
};
