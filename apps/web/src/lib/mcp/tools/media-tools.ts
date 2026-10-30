import { ValidationError } from "@/lib/utils/errors";
import { ALLOWED_MEDIA_MIME_TYPES, detectMediaMimeType } from "@/domains/media";
import { SafeFetchError, type SafeFetchErrorCode } from "@/lib/net/safe-fetch";

import { toWibIso } from "../format";
import {
  McpToolInputError,
  McpToolTemporaryError,
  assertKnownArgs,
  readOptionalString,
  readRequiredText,
} from "../tool-input";
import type { McpToolDefinition } from "../tool-types";

/**
 * Tool tulis scope `draft` `upload_media` (T-155, ADR-138 § 3-5): satu URL per
 * panggilan. Handler tipis: validasi argumen, unduh lewat `remoteMedia`
 * (proteksi SSRF di `lib/net/safe-fetch`), deteksi tipe dari isi, lalu
 * `UploadMediaUseCase`. Kuota `write_actions` sudah dihitung gerbang
 * (`authorizeCall`) untuk setiap tool bercakup `draft`. Identitas dari grant.
 */

/**
 * `network_error` SENGAJA tidak di sini: pesannya sama dengan
 * `blocked_destination`, dan memetakannya ke kode berbeda akan menjadi oracle
 * enumerasi nama DNS internal (resolve privat vs. tidak ada).
 */
const TEMPORARY_FETCH_CODES: ReadonlySet<SafeFetchErrorCode> = new Set([
  "busy",
  "timeout",
]);

const MAX_URL_LENGTH = 2048;
const MAX_FILENAME_LENGTH = 120;

/** Buang path, karakter kontrol, dan pemisah; batasi panjang. Kosong -> null. */
export function sanitizeFilename(raw: string): string | null {
  const cleaned = raw.replace(/[\u0000-\u001f\u007f\p{Cf}\p{Zl}\p{Zp}]/gu, "");
  const base = cleaned.split(/[\\/]/).pop() ?? "";
  const trimmed = base.replace(/\s+/g, " ").trim().replace(/^\.+/, "");
  return trimmed === "" ? null : trimmed.slice(0, MAX_FILENAME_LENGTH);
}

function filenameFromUrl(url: URL): string | null {
  try {
    return sanitizeFilename(
      decodeURIComponent(url.pathname.split("/").pop() ?? ""),
    );
  } catch {
    return null;
  }
}

const uploadMedia: McpToolDefinition = {
  name: "upload_media",
  description:
    "Unggah satu file gambar/video ke Media Library workspace dari URL https publik (satu URL per panggilan, maksimum 50 MB). Hanya JPEG, PNG, WebP, GIF, MP4, dan MOV; tipe ditentukan dari isi file, bukan header server. Pengalihan (redirect) maksimum 3 kali; alamat internal ditolak. Pakai id hasilnya di mediaIds create_draft/update_draft.",
  scope: "draft",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        maxLength: MAX_URL_LENGTH,
        description: "URL https publik file media (tanpa kredensial dan port).",
      },
      filename: {
        type: "string",
        maxLength: MAX_FILENAME_LENGTH,
        description:
          "Nama file opsional untuk Media Library. Bawaan: dari URL.",
      },
    },
    required: ["url"],
    additionalProperties: false,
  },
  async handler(context, args) {
    assertKnownArgs(args, ["url", "filename"]);
    const url = readRequiredText(args, "url").trim();
    if (url === "" || url.length > MAX_URL_LENGTH) {
      throw new McpToolInputError(
        `Argumen "url" wajib diisi, maksimum ${MAX_URL_LENGTH} karakter.`,
      );
    }
    const filenameArg = readOptionalString(args, "filename");
    if (filenameArg !== undefined && filenameArg.length > MAX_FILENAME_LENGTH) {
      throw new McpToolInputError(
        `Argumen "filename" maksimum ${MAX_FILENAME_LENGTH} karakter.`,
      );
    }

    let downloaded;
    try {
      downloaded = await context.services.remoteMedia.download(url);
    } catch (error) {
      if (error instanceof SafeFetchError) {
        // Sementara (bisa dicoba lagi) vs. salah input; pesan tetap generik.
        // Catatan kuota: `write_actions` sudah dihitung `authorizeCall` sebelum
        // handler jalan, jadi panggilan yang ditolak `busy` tetap terhitung;
        // mengembalikannya butuh mengubah gerbang dan tidak dilakukan di sini.
        if (TEMPORARY_FETCH_CODES.has(error.code)) {
          throw new McpToolTemporaryError(error.message);
        }
        throw new ValidationError(error.message);
      }
      throw error;
    }

    const mimeType = detectMediaMimeType(downloaded.bytes);
    const meta = mimeType ? ALLOWED_MEDIA_MIME_TYPES[mimeType] : undefined;
    if (!mimeType || !meta) {
      throw new ValidationError(
        "Isi file bukan tipe yang didukung (JPEG, PNG, WebP, GIF, MP4, MOV).",
      );
    }

    const filename =
      (filenameArg !== undefined ? sanitizeFilename(filenameArg) : null) ??
      filenameFromUrl(downloaded.finalUrl) ??
      `media.${meta.extension}`;

    const item = await context.services.mediaUpload.execute({
      workspaceId: context.workspaceId,
      uploaderId: context.userId,
      actingUserId: context.userId,
      filename,
      mimeType,
      fileBuffer: downloaded.bytes,
    });

    return {
      targetId: item.id,
      data: {
        id: item.id,
        filename: item.filename,
        type: item.type,
        mimeType: item.mimeType,
        sizeBytes: Number(item.size),
        ...(item.url ? { url: item.url } : {}),
        createdAt: toWibIso(item.createdAt),
      },
    };
  },
};

export const MCP_MEDIA_TOOLS: readonly McpToolDefinition[] = [uploadMedia];
