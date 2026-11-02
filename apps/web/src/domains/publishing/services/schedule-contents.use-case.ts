import { ContentStatus } from "@postific/shared";
import type {
  ConnectedAccountId,
  ContentFormat,
  PostId,
  SocialPlatform,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import type { ConnectedAccountRecord } from "@/domains/workspace";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/utils/errors";
import { PublishingDomainError } from "../errors";
import type {
  IPublishingRepository,
  PostCreationSource,
} from "../repositories/publishing.repository";
import {
  assertCaptionWithinLimit,
  type ComposeDraftTargetRequest,
  type ComposeDraftUseCase,
  type DraftAccountsPort,
} from "./compose-draft.use-case";
import {
  resolveScheduleTargets,
  type ScheduleTargetRequest,
} from "./resolve-schedule-targets";
import type {
  SchedulePostsTargetInput,
  SchedulePostsUseCase,
} from "./schedule-posts.use-case";

/** Satu konten yang diminta entry point non-UI (tool MCP `schedule_posts`, T-153). */
export interface ScheduleContentInput {
  caption: string;
  /** `undefined` atau kosong = tanpa media. */
  mediaIds?: string[];
  scheduledAt: Date;
  targets: ComposeDraftTargetRequest[];
}

export interface ScheduledContentTarget {
  connectedAccountId: ConnectedAccountId;
  platform: SocialPlatform;
  contentFormat: ContentFormat;
}

/**
 * Alasan satu konten gagal. `invalid`: input ditolak aturan (aman ditampilkan
 * ke AI klien supaya bisa memperbaiki); `conflict`: status post tidak
 * mengizinkan; `not_found`; `schedule_failed`: penyedia (Outstand) menolak,
 * post sudah ditandai Failed; `internal`: galat tak terduga (pesan generik).
 */
export type ScheduleContentFailureKind =
  "invalid" | "conflict" | "not_found" | "schedule_failed" | "internal";

export type ScheduleContentOutcome =
  | {
      index: number;
      status: "scheduled";
      postId: PostId;
      caption: string;
      mediaIds: string[];
      scheduledAt: Date;
      targets: ScheduledContentTarget[];
    }
  | {
      index: number;
      status: "failed";
      kind: ScheduleContentFailureKind;
      message: string;
      /** Ada bila draft sudah terlanjur dibuat sebelum gagal (mis. `schedule_failed`). */
      postId?: PostId;
    };

const SCHEDULE_FAILED_MESSAGE =
  "Penyedia sosial menolak jadwal ini. Post ditandai gagal; cek di Publish > History atau coba jadwalkan ulang.";
const INTERNAL_MESSAGE =
  "Terjadi kesalahan saat menjadwalkan konten ini. Coba lagi nanti.";

interface ContentPlan {
  index: number;
  content: ScheduleContentInput;
  targets: SchedulePostsTargetInput[];
}

/**
 * Menjadwalkan beberapa konten sekaligus untuk entry point non-UI (T-153):
 * satu panggilan, banyak konten, hasil dilaporkan per konten (sebagian
 * berhasil boleh). Merangkai use-case yang sudah ada, tanpa menyalin aturan:
 * `ComposeDraftUseCase.createDraft` (draft bertanda sumber, validasi media dan
 * caption) lalu `SchedulePostsUseCase.execute` (aturan jadwal, Outstand, job
 * polling), sama dengan jalur Draft Editor.
 *
 * Urutan: (1) periksa semua konten tanpa menulis apa pun (`planContent`);
 * (2) `reserveQuota` SEKALI untuk jumlah konten yang lolos (kuota
 * all-or-nothing, tidak ada refund; konten yang gagal diperiksa tidak memakai
 * kuota; kuota ditolak berarti tidak ada yang dijadwalkan); (3) buat dan
 * jadwalkan satu per satu. Galat satu konten tidak menghentikan konten lain
 * dan tidak menghilangkan laporan konten yang sudah terjadwal.
 */
export class ScheduleContentsUseCase {
  constructor(
    private readonly compose: Pick<ComposeDraftUseCase, "createDraft">,
    private readonly scheduler: Pick<SchedulePostsUseCase, "execute">,
    private readonly repository: Pick<
      IPublishingRepository,
      "findPostStatusById"
    >,
    private readonly accounts: DraftAccountsPort,
    private readonly logger: Pick<Console, "error"> = console,
  ) {}

  async execute(input: {
    workspaceId: WorkspaceId;
    actingUserId: UserId;
    contents: ScheduleContentInput[];
    source: PostCreationSource;
    /** Dipanggil sekali dengan jumlah konten yang lolos pemeriksaan; melempar bila kuota habis. */
    reserveQuota?: (count: number) => Promise<void>;
  }): Promise<ScheduleContentOutcome[]> {
    if (input.contents.length === 0) {
      throw new ValidationError("Isi minimal satu konten untuk dijadwalkan.");
    }

    const accounts = await this.accounts.listConnectedAccounts(
      input.workspaceId,
      input.actingUserId,
    );

    const outcomes: ScheduleContentOutcome[] = [];
    const plans: ContentPlan[] = [];
    input.contents.forEach((content, index) => {
      try {
        plans.push({
          index,
          content,
          targets: planContent(content, accounts),
        });
      } catch (error) {
        outcomes[index] = this.failureOutcome(index, error);
      }
    });

    if (plans.length > 0 && input.reserveQuota) {
      await input.reserveQuota(plans.length);
    }

    for (const plan of plans) {
      outcomes[plan.index] = await this.scheduleOne(input, plan);
    }
    return outcomes;
  }

  private async scheduleOne(
    input: {
      workspaceId: WorkspaceId;
      actingUserId: UserId;
      source: PostCreationSource;
    },
    plan: ContentPlan,
  ): Promise<ScheduleContentOutcome> {
    const { content, index } = plan;
    let postId: PostId | undefined;
    try {
      const draft = await this.compose.createDraft({
        workspaceId: input.workspaceId,
        authorId: input.actingUserId,
        caption: content.caption,
        source: input.source,
        ...(content.mediaIds !== undefined
          ? { mediaIds: content.mediaIds }
          : {}),
        targets: content.targets,
      });
      postId = draft.post.id;

      const scheduled = await this.scheduler.execute({
        workspaceId: input.workspaceId,
        postId,
        scheduledAt: content.scheduledAt,
        targets: plan.targets,
        actingUserId: input.actingUserId,
      });

      // `SchedulePostsUseCase` tidak melempar saat penyedia menolak: ia
      // menandai post Failed dan tetap mengembalikan record. Status dibaca
      // ulang supaya kegagalan itu tidak dilaporkan sebagai berhasil.
      const status = await this.repository.findPostStatusById(
        { workspaceId: input.workspaceId, postId },
        input.actingUserId,
      );
      if (status?.status === ContentStatus.Failed) {
        return {
          index,
          status: "failed",
          kind: "schedule_failed",
          message: SCHEDULE_FAILED_MESSAGE,
          postId,
        };
      }

      return {
        index,
        status: "scheduled",
        postId,
        caption: scheduled.caption,
        mediaIds: (scheduled.mediaIds ?? []).map(String),
        scheduledAt: content.scheduledAt,
        targets: plan.targets.map((target) => ({
          connectedAccountId: target.connectedAccountId,
          platform: target.platform,
          contentFormat: target.contentFormat,
        })),
      };
    } catch (error) {
      return this.failureOutcome(index, error, postId);
    }
  }

  private failureOutcome(
    index: number,
    error: unknown,
    postId?: PostId,
  ): ScheduleContentOutcome {
    const withPost = postId !== undefined ? { postId } : {};
    if (
      error instanceof ValidationError ||
      error instanceof PublishingDomainError
    ) {
      return {
        index,
        status: "failed",
        kind: "invalid",
        message: error.message,
        ...withPost,
      };
    }
    if (error instanceof ConflictError) {
      return {
        index,
        status: "failed",
        kind: "conflict",
        message: error.message,
        ...withPost,
      };
    }
    if (error instanceof NotFoundError) {
      return {
        index,
        status: "failed",
        kind: "not_found",
        message: error.message,
        ...withPost,
      };
    }
    this.logger.error("[publishing] schedule contents: galat tak terduga", {
      index,
      error,
    });
    return {
      index,
      status: "failed",
      kind: "internal",
      message: INTERNAL_MESSAGE,
      ...withPost,
    };
  }
}

/**
 * Pemeriksaan satu konten tanpa menulis apa pun. Melempar `ValidationError`
 * atau `PublishingDomainError` bila ditolak; mengembalikan target yang sudah
 * di-resolve (identitas akun otentik dari DB, bukan dari input).
 */
function planContent(
  content: ScheduleContentInput,
  accounts: ConnectedAccountRecord[],
): SchedulePostsTargetInput[] {
  assertCaptionWithinLimit(content.caption);
  return resolveTargets(content.targets, accounts);
}

function resolveTargets(
  requests: ComposeDraftTargetRequest[],
  accounts: ConnectedAccountRecord[],
): SchedulePostsTargetInput[] {
  if (requests.length === 0) {
    throw new ValidationError(
      "Pilih minimal satu akun tujuan. Konten tanpa target tidak bisa dijadwalkan.",
    );
  }
  if (requests.length > accounts.length) {
    throw new ValidationError(
      `Target (${requests.length}) melebihi jumlah akun terhubung di workspace ini (${accounts.length}).`,
    );
  }
  const seen = new Set<string>();
  for (const request of requests) {
    if (seen.has(request.connectedAccountId)) {
      throw new ValidationError(
        "Akun yang sama dipilih lebih dari sekali. Satu akun cukup satu target.",
      );
    }
    seen.add(request.connectedAccountId);
  }
  // Bukan `ScheduleTargetRequest` penuh: `platformOptions` sengaja tidak
  // diterima entry point ini (lihat `ComposeDraftTargetRequest`).
  const asRequests: ScheduleTargetRequest[] = requests.map((request) => ({
    connectedAccountId: request.connectedAccountId,
    contentFormat: request.contentFormat,
  }));
  return resolveScheduleTargets(accounts, asRequests);
}
