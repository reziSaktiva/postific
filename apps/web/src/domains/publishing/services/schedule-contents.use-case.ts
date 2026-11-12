import { ContentStatus, asMediaId } from "@postific/shared";
import type {
  MemberRole,
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
import { assertReelMediaRule } from "../content-format-matrix";
import { assertActorCanSchedule } from "../rbac";
import { assertScheduleSafetyCheck } from "../schedule-safety-check";
import type {
  IPublishingRepository,
  PostCreationSource,
} from "../repositories/publishing.repository";
import {
  assertCaptionWithinLimit,
  type ComposeDraftTargetRequest,
  type ComposeDraftUseCase,
  type DraftAccountsPort,
  type DraftMediaPort,
} from "./compose-draft.use-case";
import {
  resolveDraftMediaIds,
  type MediaOwnershipRecord,
} from "./resolve-draft-media-ids";
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
  /** Hasil baca media fase pemeriksaan; `undefined` bila konten tanpa media. */
  foundMedia: MediaOwnershipRecord[] | undefined;
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
    private readonly media: DraftMediaPort,
    private readonly logger: Pick<Console, "error"> = console,
  ) {}

  async execute(input: {
    workspaceId: WorkspaceId;
    actingUserId: UserId;
    /** Role member (ADR-074); ditegakkan sebelum efek samping apa pun (T-252). */
    actorRole: MemberRole;
    contents: ScheduleContentInput[];
    source: PostCreationSource;
    /** Dipanggil sekali dengan jumlah konten yang lolos pemeriksaan; melempar bila kuota habis. */
    reserveQuota?: (count: number) => Promise<void>;
  }): Promise<ScheduleContentOutcome[]> {
    // T-252 — RBAC dulu: peran tak sah ditolak sebelum baca akun, kuota, atau draft.
    // Dipanggil juga di sini (bukan hanya di `SchedulePostsUseCase`) karena galat
    // per konten di `scheduleOne` ditangkap, dan draft sudah terlanjur dibuat.
    assertActorCanSchedule(input.actorRole);

    if (input.contents.length === 0) {
      throw new ValidationError("Isi minimal satu konten untuk dijadwalkan.");
    }

    const accounts = await this.accounts.listConnectedAccounts(
      input.workspaceId,
      input.actingUserId,
    );

    const outcomes: ScheduleContentOutcome[] = [];
    const plans: ContentPlan[] = [];
    for (const [index, content] of input.contents.entries()) {
      try {
        plans.push({
          index,
          content,
          ...(await this.planContent(input, content, accounts)),
        });
      } catch (error) {
        outcomes[index] = this.failureOutcome(index, error);
      }
    }

    if (plans.length > 0 && input.reserveQuota) {
      await input.reserveQuota(plans.length);
    }

    for (const plan of plans) {
      outcomes[plan.index] = await this.scheduleOne(input, accounts, plan);
    }
    return outcomes;
  }

  private async scheduleOne(
    input: {
      workspaceId: WorkspaceId;
      actingUserId: UserId;
      actorRole: MemberRole;
      source: PostCreationSource;
    },
    accounts: ConnectedAccountRecord[],
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
        prefetched: {
          accounts,
          ...(plan.foundMedia !== undefined ? { media: plan.foundMedia } : {}),
        },
      });
      postId = draft.post.id;

      const scheduled = await this.scheduler.execute({
        workspaceId: input.workspaceId,
        postId,
        scheduledAt: content.scheduledAt,
        targets: plan.targets,
        actingUserId: input.actingUserId,
        actorRole: input.actorRole,
      });

      // `SchedulePostsUseCase` tidak melempar saat penyedia menolak: ia
      // menandai post Failed dan tetap mengembalikan record. Status dibaca
      // ulang supaya kegagalan itu tidak dilaporkan sebagai berhasil. Pembacaan
      // ini hanya pelaporan: post sudah terjadwal, jadi galatnya tidak boleh
      // mengubah hasil menjadi gagal (klien akan mengulang dan membuat post ganda).
      const status = await this.repository
        .findPostStatusById(
          { workspaceId: input.workspaceId, postId },
          input.actingUserId,
        )
        .catch((statusError: unknown) => {
          this.logger.error(
            "[publishing] schedule contents: gagal membaca status setelah penjadwalan",
            {
              workspaceId: input.workspaceId,
              postId,
              error:
                statusError instanceof Error ? statusError.message : "unknown",
            },
          );
          return null;
        });
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

  /**
   * Pemeriksaan satu konten tanpa menulis apa pun: caption, target (matriks
   * `ContentFormat` ADR-039, akun aktif), Safety Check
   * (`assertScheduleSafetyCheck`), lalu kepemilikan media workspace. Semua
   * ini sebelum kuota dipesan. Melempar `ValidationError` atau
   * `PublishingDomainError` bila ditolak; mengembalikan target yang sudah
   * di-resolve (identitas akun otentik dari DB, bukan dari input).
   */
  private async planContent(
    input: { workspaceId: WorkspaceId; actingUserId: UserId },
    content: ScheduleContentInput,
    accounts: ConnectedAccountRecord[],
  ): Promise<{
    targets: SchedulePostsTargetInput[];
    foundMedia: MediaOwnershipRecord[] | undefined;
  }> {
    assertCaptionWithinLimit(content.caption);
    const targets = resolveTargets(content.targets, accounts);
    assertScheduleSafetyCheck({
      caption: content.caption,
      mediaCount: content.mediaIds?.length ?? 0,
      scheduledAt: content.scheduledAt,
      targets,
    });

    const requested = content.mediaIds ?? [];
    let foundMedia: MediaOwnershipRecord[] | undefined;
    if (requested.length > 0) {
      if (
        new Set(requested.map((id) => id.toLowerCase())).size !==
        requested.length
      ) {
        throw new ValidationError(
          "Media yang sama dipilih lebih dari sekali. Satu media cukup satu kali.",
        );
      }
      const mediaIds = requested.map((id) => asMediaId(id));
      foundMedia = await this.media.listByIds(
        { workspaceId: input.workspaceId, mediaIds },
        input.actingUserId,
      );
      resolveDraftMediaIds(foundMedia, mediaIds);
      // T-200: jenis media baru diketahui setelah dibaca, jadi aturan Reel
      // wajib video dicek di sini (masih sebelum kuota dan sebelum menulis).
      assertReelMediaRule(targets, foundMedia);
    }
    return { targets, foundMedia };
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
    if (seen.has(request.connectedAccountId.toLowerCase())) {
      throw new ValidationError(
        "Akun yang sama dipilih lebih dari sekali. Satu akun cukup satu target.",
      );
    }
    seen.add(request.connectedAccountId.toLowerCase());
  }
  // Bukan `ScheduleTargetRequest` penuh: `platformOptions` sengaja tidak
  // diterima entry point ini (lihat `ComposeDraftTargetRequest`).
  const asRequests: ScheduleTargetRequest[] = requests.map((request) => ({
    connectedAccountId: request.connectedAccountId,
    contentFormat: request.contentFormat,
  }));
  const resolved = resolveScheduleTargets(accounts, asRequests);
  const byId = new Map(accounts.map((account) => [account.id, account]));
  for (const target of resolved) {
    const account = byId.get(target.connectedAccountId);
    if (account && !isAccountUsable(account)) {
      throw new ValidationError(
        `Akun ${account.handle} (${target.platform}) tidak aktif${account.reconnectRequired ? " dan perlu dihubungkan ulang" : ""}. Hubungkan ulang di Settings > Connected Accounts, lalu jadwalkan lagi.`,
      );
    }
  }
  return resolved;
}

/** Akun yang boleh menerima jadwal: status `active` dan tidak menunggu hubung ulang. */
function isAccountUsable(account: ConnectedAccountRecord): boolean {
  return account.status === "active" && !account.reconnectRequired;
}
