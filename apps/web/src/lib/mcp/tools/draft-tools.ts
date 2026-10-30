import { ContentFormat, PostCreatedVia, asPostId } from "@postific/shared";
import {
  DRAFT_CAPTION_MAX_LENGTH,
  type ComposeDraftResult,
} from "@/domains/publishing";

import { toWibIso } from "../format";
import {
  assertKnownArgs,
  readOptionalDraftTargets,
  readOptionalText,
  readOptionalUuidArray,
  readRequiredText,
  readRequiredUuid,
} from "../tool-input";
import type { McpJsonSchema, McpToolDefinition } from "../tool-types";

/**
 * Dua tool tulis scope `draft` (T-152): `create_draft` dan `update_draft`.
 * Handler tipis: parse bentuk argumen, satu panggilan `ComposeDraftUseCase`
 * (domain `publishing`), lalu petakan hasil. Aturan (status hanya draft,
 * matriks `ContentFormat`, batas media dan caption, kepemilikan akun/media)
 * hidup di use-case, bukan di sini. `workspaceId`, `userId`, dan `clientId`
 * selalu dari grant yang lolos `authorizeCall`, tidak pernah dari argumen.
 *
 * Tidak ada tool hapus, jadwal, atau publish di sini (ADR-138): `schedule`
 * ada di T-153, `publish` ditunda.
 */

const MEDIA_IDS_PROPERTY = {
  type: "array",
  items: { type: "string" },
  maxItems: 10,
  description:
    "ID media dari list_media, urutan = urutan tampil. Maksimum 10; format Reel, Story, dan Pin hanya menerima 1 media.",
} as const;

const TARGETS_PROPERTY = {
  type: "array",
  items: {
    type: "object",
    properties: {
      accountId: {
        type: "string",
        description: "ID akun dari list_accounts.",
      },
      contentFormat: {
        type: "string",
        enum: Object.values(ContentFormat),
        description:
          "Format konten; harus termasuk supportedContentFormats akun itu di list_accounts.",
      },
    },
    required: ["accountId", "contentFormat"],
    additionalProperties: false,
  },
  description:
    "Akun tujuan. Satu akun paling banyak satu kali. Hanya akun yang terhubung di workspace ini.",
} as const;

const CAPTION_PROPERTY = {
  type: "string",
  maxLength: DRAFT_CAPTION_MAX_LENGTH,
} as const;

const CREATE_DRAFT_SCHEMA: McpJsonSchema = {
  type: "object",
  properties: {
    caption: {
      ...CAPTION_PROPERTY,
      description: `Caption draft (boleh kosong). Maksimum ${DRAFT_CAPTION_MAX_LENGTH} karakter.`,
    },
    mediaIds: MEDIA_IDS_PROPERTY,
    targets: TARGETS_PROPERTY,
  },
  required: ["caption"],
  additionalProperties: false,
};

const UPDATE_DRAFT_SCHEMA: McpJsonSchema = {
  type: "object",
  properties: {
    postId: {
      type: "string",
      description: "ID draft dari list_drafts atau create_draft.",
    },
    caption: {
      ...CAPTION_PROPERTY,
      description:
        "Caption baru (menggantikan yang lama). Kosongkan argumen ini untuk tidak mengubah caption.",
    },
    mediaIds: {
      ...MEDIA_IDS_PROPERTY,
      description: `${MEDIA_IDS_PROPERTY.description} Menggantikan seluruh media draft; [] mengosongkan; tidak diisi = tidak diubah.`,
    },
    targets: {
      ...TARGETS_PROPERTY,
      description: `${TARGETS_PROPERTY.description} Menggantikan seluruh target draft; [] mengosongkan; tidak diisi = tidak diubah.`,
    },
  },
  required: ["postId"],
  additionalProperties: false,
};

function formatResult({ post, targets }: ComposeDraftResult) {
  return {
    id: post.id,
    status: post.status,
    caption: post.caption,
    mediaIds: post.mediaIds ?? [],
    targets: targets.map((target) => ({
      accountId: target.connectedAccountId,
      platform: target.platform,
      contentFormat: target.contentFormat,
    })),
    createdVia: post.createdVia ?? PostCreatedVia.App,
    createdAt: toWibIso(post.createdAt),
    updatedAt: toWibIso(post.updatedAt),
  };
}

const createDraft: McpToolDefinition = {
  name: "create_draft",
  description:
    "Buat satu draft baru di workspace (tidak dijadwalkan atau dipublikasikan; manusia atau tool lain yang menjadwalkannya). Draft ditandai dibuat lewat MCP. Tanggal dan jam dalam WIB (Asia/Jakarta, +07:00).",
  scope: "draft",
  inputSchema: CREATE_DRAFT_SCHEMA,
  async handler(context, args) {
    assertKnownArgs(args, ["caption", "mediaIds", "targets"]);
    const caption = readRequiredText(args, "caption");
    const mediaIds = readOptionalUuidArray(args, "mediaIds");
    const targets = readOptionalDraftTargets(args, "targets");

    const result = await context.services.drafts.createDraft({
      workspaceId: context.workspaceId,
      authorId: context.userId,
      caption,
      source: { createdVia: PostCreatedVia.Mcp, clientId: context.clientId },
      ...(mediaIds !== undefined ? { mediaIds } : {}),
      ...(targets !== undefined ? { targets } : {}),
    });
    return { targetId: result.post.id, data: formatResult(result) };
  },
};

const updateDraft: McpToolDefinition = {
  name: "update_draft",
  description:
    "Ubah draft yang sudah ada (caption, media, atau akun tujuan; yang tidak diisi tidak berubah). Hanya post berstatus draft: post yang sudah dijadwalkan, terbit, gagal, atau diimpor ditolak dengan error conflict. Tidak mengubah penanda sumber pembuatan. Tanggal dan jam dalam WIB (Asia/Jakarta, +07:00).",
  scope: "draft",
  inputSchema: UPDATE_DRAFT_SCHEMA,
  async handler(context, args) {
    assertKnownArgs(args, ["postId", "caption", "mediaIds", "targets"]);
    const postId = readRequiredUuid(args, "postId");
    const caption = readOptionalText(args, "caption");
    const mediaIds = readOptionalUuidArray(args, "mediaIds");
    const targets = readOptionalDraftTargets(args, "targets");

    const result = await context.services.drafts.updateDraft({
      workspaceId: context.workspaceId,
      actingUserId: context.userId,
      postId: asPostId(postId),
      ...(caption !== undefined ? { caption } : {}),
      ...(mediaIds !== undefined ? { mediaIds } : {}),
      ...(targets !== undefined ? { targets } : {}),
    });
    return { targetId: result.post.id, data: formatResult(result) };
  },
};

export const MCP_DRAFT_TOOLS: readonly McpToolDefinition[] = [
  createDraft,
  updateDraft,
];
