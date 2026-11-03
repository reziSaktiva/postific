import { ContentFormat, PostCreatedVia } from "@postific/shared";
import { McpInvalidRateLimitInputError } from "@/domains/mcp-access";
import {
  DRAFT_CAPTION_MAX_LENGTH,
  maxMediaCountForFormat,
  minMediaCountForFormat,
  platformLabel,
  platformsWhosePostRequiresMedia,
  REEL_REQUIRES_VIDEO_MESSAGE,
  SCHEDULE_MAX_DAYS_AHEAD,
  type ScheduleContentFailureKind,
  type ScheduleContentInput,
  type ScheduleContentOutcome,
} from "@/domains/publishing";

import { MCP_SCHEDULE_MAX_CONTENTS } from "../config";
import { toZonedIso } from "../format";
import { parseScheduledAt } from "../scheduled-at";
import {
  McpToolInputError,
  assertKnownArgs,
  readOptionalDraftTargets,
  readOptionalUuidArray,
  readRequiredText,
} from "../tool-input";
import type { McpJsonSchema, McpToolDefinition } from "../tool-types";

/**
 * Tool tulis scope `schedule` (T-153): `schedule_posts`, batch sampai
 * `MCP_SCHEDULE_MAX_CONTENTS` konten. Handler tipis: parse bentuk argumen
 * (termasuk tafsir `scheduledAt` di zona pengguna), satu panggilan
 * `ScheduleContentsUseCase` (domain `publishing`), lalu petakan hasil per
 * konten. Aturan (matriks `ContentFormat`, Safety Check, kuota, penjadwalan)
 * hidup di use-case dan `McpAccessService`, bukan di sini. `workspaceId`,
 * `userId`, dan klien selalu dari grant, tidak pernah dari argumen.
 *
 * Tidak ada tool batal, hapus, atau publish langsung (ADR-138).
 */

const FAILURE_CODE: Record<ScheduleContentFailureKind, string> = {
  invalid: "invalid_input",
  conflict: "conflict",
  not_found: "not_found",
  schedule_failed: "schedule_failed",
  internal: "internal_error",
};

const CONTENT_KEYS = ["caption", "mediaIds", "scheduledAt", "targets"] as const;

/**
 * Angka dan teks aturan media diturunkan dari matriks domain
 * (`content-format-matrix.ts`), bukan ditulis manual (T-192.4): format yang
 * batas min dan maks-nya sama dikelompokkan ("Reel, Story, dan Pin wajib tepat
 * 1 media"), sisanya ditulis sebagai rentang ("Post boleh 0 sampai 10").
 */
const MEDIA_MAX_ITEMS = Math.max(
  ...Object.values(ContentFormat).map(maxMediaCountForFormat),
);
const POST_REQUIRES_MEDIA_NAMES = joinNames(
  platformsWhosePostRequiresMedia().map(platformLabel),
);
const MEDIA_RULE_TEXT = describeMediaRules();

function joinNames(names: string[]): string {
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")}, dan ${names[names.length - 1]}`
    : (names[0] ?? "");
}

function describeMediaRules(): string {
  const groups = new Map<string, ContentFormat[]>();
  for (const format of Object.values(ContentFormat)) {
    const key = `${minMediaCountForFormat(format)}-${maxMediaCountForFormat(format)}`;
    groups.set(key, [...(groups.get(key) ?? []), format]);
  }
  const sentences = [...groups.entries()].map(([key, formats]) => {
    const [min, max] = key.split("-");
    const names = formats.map(
      (format) => format.charAt(0).toUpperCase() + format.slice(1),
    );
    const list =
      names.length > 1
        ? `${names.slice(0, -1).join(", ")}, dan ${names[names.length - 1]}`
        : (names[0] ?? "");
    return min === max
      ? `${list} wajib tepat ${min} media`
      : `${list} boleh ${min} sampai ${max}`;
  });
  return `${sentences.join("; ")}. Khusus Post (ADR-154), ${POST_REQUIRES_MEDIA_NAMES} wajib minimal 1 media; akun lain boleh tanpa media. Khusus Reel di Facebook dan Instagram, medianya wajib satu video (gambar, GIF, atau lebih dari satu media ditolak)`;
}

const SCHEDULE_POSTS_SCHEMA: McpJsonSchema = {
  type: "object",
  properties: {
    posts: {
      type: "array",
      minItems: 1,
      maxItems: MCP_SCHEDULE_MAX_CONTENTS,
      description: `Konten yang dijadwalkan; maksimum ${MCP_SCHEDULE_MAX_CONTENTS} per panggilan. Tiap konten menjadi satu post baru bertanda MCP.`,
      items: {
        type: "object",
        properties: {
          caption: {
            type: "string",
            maxLength: DRAFT_CAPTION_MAX_LENGTH,
            description: `Caption. Wajib terisi kecuali semua target berformat story. Maksimum ${DRAFT_CAPTION_MAX_LENGTH} karakter.`,
          },
          mediaIds: {
            type: "array",
            items: { type: "string" },
            maxItems: MEDIA_MAX_ITEMS,
            description: `ID media dari list_media, urutan = urutan tampil. ${MEDIA_RULE_TEXT}.`,
          },
          scheduledAt: {
            type: "string",
            description: `Waktu terbit, ISO 8601, harus di masa depan dan paling jauh ${SCHEDULE_MAX_DAYS_AHEAD} hari dari sekarang. Tanpa offset (mis. 2026-11-10T09:00:00) dibaca di zona waktu pengguna (lihat get_workspace); dengan offset (mis. 2026-11-10T09:00:00+07:00) dipakai apa adanya.`,
          },
          targets: {
            type: "array",
            minItems: 1,
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
              "Akun tujuan, satu akun paling banyak satu kali, paling banyak sejumlah akun terhubung di workspace.",
          },
        },
        required: ["caption", "scheduledAt", "targets"],
        additionalProperties: false,
      },
    },
  },
  required: ["posts"],
  additionalProperties: false,
};

function parseContent(
  item: unknown,
  index: number,
  timeZone: string,
): ScheduleContentInput {
  const label = `posts[${index}]`;
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw new McpToolInputError(`${label} harus berupa objek.`);
  }
  const record = item as Record<string, unknown>;
  try {
    assertKnownArgs(record, CONTENT_KEYS);
    const caption = readRequiredText(record, "caption");
    const mediaIds = readOptionalUuidArray(record, "mediaIds");
    const targets = readOptionalDraftTargets(record, "targets");
    if (targets === undefined) {
      throw new McpToolInputError('Argumen "targets" wajib diisi.');
    }
    return {
      caption,
      scheduledAt: parseScheduledAt(record.scheduledAt, timeZone, label),
      targets,
      ...(mediaIds !== undefined ? { mediaIds } : {}),
    };
  } catch (error) {
    // Sebut konten mana yang salah; pesan parse waktu sudah memuat labelnya.
    if (
      error instanceof McpToolInputError &&
      !error.message.startsWith(label)
    ) {
      throw new McpToolInputError(`${label}: ${error.message}`);
    }
    throw error;
  }
}

function formatOutcome(outcome: ScheduleContentOutcome, timeZone: string) {
  if (outcome.status === "scheduled") {
    return {
      index: outcome.index,
      status: "scheduled" as const,
      postId: outcome.postId,
      caption: outcome.caption,
      mediaIds: outcome.mediaIds,
      scheduledAt: toZonedIso(outcome.scheduledAt, timeZone),
      targets: outcome.targets.map((target) => ({
        accountId: target.connectedAccountId,
        platform: target.platform,
        contentFormat: target.contentFormat,
      })),
    };
  }
  return {
    index: outcome.index,
    status: "failed" as const,
    error: { code: FAILURE_CODE[outcome.kind], message: outcome.message },
    ...(outcome.postId !== undefined ? { postId: outcome.postId } : {}),
  };
}

const schedulePosts: McpToolDefinition = {
  name: "schedule_posts",
  description:
    `Jadwalkan sampai ${MCP_SCHEDULE_MAX_CONTENTS} konten sekaligus; tiap konten menjadi satu post baru (bertanda dibuat lewat MCP) ke satu atau beberapa akun terhubung. ` +
    "Hasil dilaporkan per konten: sebagian bisa berhasil dan sebagian gagal, jadi periksa results[].status. " +
    "Aturan yang sama dengan Draft Editor berlaku di server: akun harus aktif, format per akun, caption wajib (kecuali Story), Story tidak digabung dengan target lain bila caption terisi, jumlah media per format, dan waktu harus di masa depan dan paling jauh " +
    `${SCHEDULE_MAX_DAYS_AHEAD} hari dari sekarang (Outstand menolak jadwal lebih jauh). ` +
    `${POST_REQUIRES_MEDIA_NAMES} tidak bisa dijadwalkan tanpa media. ` +
    `${REEL_REQUIRES_VIDEO_MESSAGE} (berlaku untuk Facebook dan Instagram). ` +
    "Akun Pinterest belum bisa dijadwalkan lewat MCP karena board belum bisa diisi. " +
    "Kuota: konten yang ditolak pemeriksaan di atas tidak dijadwalkan dan tidak memakai kuota. Konten yang gagal SETELAH draft dibuat (penyedia menolak, galat internal, konflik) tetap memakai kuota dan meninggalkan post yang tidak terjadwal: berstatus Failed bila penyedia menolak, atau masih Draft untuk galat lain (hasilnya memuat postId); kuota tidak dikembalikan. " +
    "Satu scheduledAt yang salah bentuk atau mustahil (mis. 30 Februari) menggagalkan SELURUH panggilan sebagai invalid_input dengan indeks konten (mis. posts[2]); tidak ada konten yang diproses. " +
    "PERINGATAN idempotensi: tidak ada kunci idempotensi. Bila panggilan terputus atau kehabisan waktu tanpa hasil, periksa list_scheduled_posts sebelum mengulang; mengulang tanpa memeriksa membuat post ganda. " +
    "Pembatalan jadwal hanya bisa dilakukan manusia di aplikasi Postific. " +
    "Tampilkan ringkasan hasil (caption, akun, format, waktu) kepada pengguna. Waktu tanpa offset dibaca di zona waktu pengguna; hasil memakai zona yang sama dengan offset. Pecahan detik pada scheduledAt dibuang (dibulatkan ke bawah ke detik); jam dinding yang tidak ada karena perpindahan DST ditolak (kirim offset eksplisit); waktu lebih dari 2 tahun ke depan ditolak.",
  scope: "schedule",
  inputSchema: SCHEDULE_POSTS_SCHEMA,
  async handler(context, args) {
    assertKnownArgs(args, ["posts"]);
    const posts = args.posts;
    if (!Array.isArray(posts)) {
      throw new McpToolInputError(
        'Argumen "posts" wajib berupa daftar konten.',
      );
    }
    if (posts.length === 0) {
      throw new McpToolInputError('Argumen "posts" minimal berisi 1 konten.');
    }
    if (posts.length > MCP_SCHEDULE_MAX_CONTENTS) {
      throw new McpToolInputError(
        `Argumen "posts" maksimum ${MCP_SCHEDULE_MAX_CONTENTS} konten per panggilan (dapat ${posts.length}). Bagi menjadi beberapa panggilan.`,
      );
    }
    const contents = posts.map((item, index) =>
      parseContent(item, index, context.timeZone),
    );

    const outcomes = await context.services.scheduleContents.execute({
      workspaceId: context.workspaceId,
      actingUserId: context.userId,
      contents,
      source: {
        createdVia: PostCreatedVia.Mcp,
        clientId: context.clientId,
        clientName: context.clientName,
      },
      reserveQuota: async (count) => {
        try {
          await context.consumeQuota("scheduled_contents", count);
        } catch (error) {
          // Batas harian yang dikonfigurasi lebih kecil dari ukuran batch
          // bukan galat internal: klien perlu tahu harus mengecilkan batch.
          if (error instanceof McpInvalidRateLimitInputError) {
            throw new McpToolInputError(
              `Batas kuota harian scheduled_contents lebih kecil dari ${count} konten dalam panggilan ini. Kurangi jumlah konten per panggilan.`,
            );
          }
          throw error;
        }
      },
    });

    const scheduled = outcomes.filter(
      (outcome) => outcome.status === "scheduled",
    );
    const only = scheduled.length === 1 ? scheduled[0] : undefined;
    return {
      ...(only?.status === "scheduled" ? { targetId: only.postId } : {}),
      data: {
        timezone: context.timeZone,
        summary: {
          requested: outcomes.length,
          scheduled: scheduled.length,
          failed: outcomes.length - scheduled.length,
        },
        results: outcomes.map((outcome) =>
          formatOutcome(outcome, context.timeZone),
        ),
      },
    };
  },
};

export const MCP_SCHEDULE_TOOLS: readonly McpToolDefinition[] = [schedulePosts];
