import { ContentStatus } from "@postific/shared";
import type {
  ConnectedAccountId,
  ContentFormat,
  MediaId,
  PostId,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import { asMediaId } from "@postific/shared";
import type { ConnectedAccountRecord } from "@/domains/workspace";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/utils/errors";
import { assertMediaCountWithinLimit } from "../content-format-matrix";
import {
  READONLY_TERMINAL_CONFLICT_MESSAGE,
  isReadonlyTerminalStatus,
} from "../readonly-terminal-status";
import type {
  DraftTargetRecord,
  IPublishingRepository,
  PostCreationSource,
  PublishingPostRecord,
  SchedulePostTargetInput,
} from "../repositories/publishing.repository";
import {
  resolveDraftMediaIds,
  type MediaOwnershipRecord,
} from "./resolve-draft-media-ids";
import {
  resolveScheduleTargets,
  type ScheduleTargetRequest,
} from "./resolve-schedule-targets";
import type { PublishingService } from "./publishing.service";

/**
 * Batas panjang caption draft yang dibuat lewat `ComposeDraftUseCase` (T-152).
 * Satu caption dipakai semua akun target, jadi batas ini tidak mengikuti satu
 * platform saja; batas per platform (mis. 2.200 untuk Instagram) tetap
 * tanggung jawab platform saat publish. Angka ini jaring pengaman terhadap
 * output AI yang tak terkendali, bukan aturan produk platform. Konstanta
 * konfigurasi, boleh diubah.
 */
export const DRAFT_CAPTION_MAX_LENGTH = 5000;

/** Port lokal `publishing` -> `workspace` (daftar akun terhubung); `WorkspaceService` memenuhinya. */
export interface DraftAccountsPort {
  listConnectedAccounts(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<ConnectedAccountRecord[]>;
}

/** Port lokal `publishing` -> `media` (cek kepemilikan media); `MediaService` memenuhinya. */
export interface DraftMediaPort {
  listByIds(
    input: { workspaceId: WorkspaceId; mediaIds: MediaId[] },
    userId: UserId,
  ): Promise<MediaOwnershipRecord[]>;
}

/** Target draft yang diminta entry point; `platformOptions` sengaja tidak diterima (lihat `updateDraft`). */
export type ComposeDraftTargetRequest = Pick<
  ScheduleTargetRequest,
  "connectedAccountId" | "contentFormat"
>;

export interface ComposeDraftResult {
  post: PublishingPostRecord;
  /** Target yang tersimpan sesudah operasi (hasil resolve, atau yang lama bila tidak diubah). */
  targets: DraftTargetRecord[];
}

/**
 * Membuat dan mengubah draft untuk entry point non-UI (tool MCP, T-152):
 * satu tempat yang merangkai validasi domain yang sudah ada
 * (`resolveScheduleTargets` + matriks `ContentFormat` ADR-039,
 * `resolveDraftMediaIds` + batas media ADR-107) di depan
 * `PublishingService.saveDraft`/`updateDraft`, supaya entry point tidak
 * berisi business logic dan tidak menyalin aturan itu. Server Action Draft
 * Editor (`draft-editor/actions.ts`) merangkai hal yang sama di sisinya dan
 * belum memakai use-case ini (di luar scope T-152).
 *
 * Kebijakan khusus use-case ini (bukan di Draft Editor):
 * - Hanya post berstatus `Draft`; status lain ditolak dengan pesan yang
 *   menyebut alasannya (`updateDraft`).
 * - `updateDraft` parsial: argumen yang tidak diisi tidak diubah (caption
 *   lama dipertahankan, `mediaIds`/`targets` tidak disentuh). Target yang
 *   dipertahankan membawa `platformOptions`-nya (mis. board Pinterest yang
 *   dipilih manusia di aplikasi) karena entry point ini tidak menerimanya.
 * - Caption dibatasi `DRAFT_CAPTION_MAX_LENGTH`, akun target tidak boleh
 *   ganda, `mediaIds` tidak boleh ganda.
 */
export class ComposeDraftUseCase {
  constructor(
    private readonly drafts: Pick<
      PublishingService,
      "saveDraft" | "updateDraft"
    >,
    private readonly repository: Pick<
      IPublishingRepository,
      "findPostStatusById" | "findDraftById"
    >,
    private readonly accounts: DraftAccountsPort,
    private readonly media: DraftMediaPort,
  ) {}

  async createDraft(input: {
    workspaceId: WorkspaceId;
    authorId: UserId;
    caption: string;
    mediaIds?: string[];
    targets?: ComposeDraftTargetRequest[];
    source: PostCreationSource;
  }): Promise<ComposeDraftResult> {
    assertCaptionWithinLimit(input.caption);

    const targets = await this.resolveTargets(
      input.workspaceId,
      input.authorId,
      input.targets,
    );
    const mediaIds = await this.resolveMedia(
      input.workspaceId,
      input.authorId,
      input.mediaIds,
      (targets ?? []).map((target) => target.contentFormat),
    );

    const post = await this.drafts.saveDraft({
      workspaceId: input.workspaceId,
      authorId: input.authorId,
      caption: input.caption,
      source: input.source,
      ...(mediaIds !== undefined ? { mediaIds } : {}),
      ...(targets !== undefined ? { targets } : {}),
    });
    return { post, targets: targets ?? [] };
  }

  async updateDraft(input: {
    workspaceId: WorkspaceId;
    postId: PostId;
    actingUserId: UserId;
    caption?: string;
    mediaIds?: string[];
    targets?: ComposeDraftTargetRequest[];
  }): Promise<ComposeDraftResult> {
    if (
      input.caption === undefined &&
      input.mediaIds === undefined &&
      input.targets === undefined
    ) {
      throw new ValidationError(
        "Tidak ada yang diubah: isi minimal satu dari caption, mediaIds, atau targets.",
      );
    }
    if (input.caption !== undefined) {
      assertCaptionWithinLimit(input.caption);
    }

    const ids = { workspaceId: input.workspaceId, postId: input.postId };
    const existingStatus = await this.repository.findPostStatusById(
      ids,
      input.actingUserId,
    );
    if (!existingStatus) {
      throw new NotFoundError("Draft tidak ditemukan.");
    }
    assertStatusEditable(existingStatus.status);

    // Status sudah dipastikan Draft, jadi `findDraftById` aman (authorId ada).
    const existing = await this.repository.findDraftById(
      ids,
      input.actingUserId,
    );
    if (!existing) {
      throw new NotFoundError("Draft tidak ditemukan.");
    }

    const resolvedTargets = await this.resolveTargets(
      input.workspaceId,
      input.actingUserId,
      input.targets,
    );
    const nextTargets = resolvedTargets
      ? carryOverPlatformOptions(resolvedTargets, existing.draftTargets ?? [])
      : undefined;

    // Format efektif untuk batas media: target baru, atau yang sudah tersimpan.
    const effectiveFormats = (nextTargets ?? existing.draftTargets ?? []).map(
      (target) => target.contentFormat,
    );
    const mediaIds = await this.resolveMedia(
      input.workspaceId,
      input.actingUserId,
      input.mediaIds,
      effectiveFormats,
    );

    const post = await this.drafts.updateDraft(
      {
        ...ids,
        caption: input.caption ?? existing.caption,
        ...(mediaIds !== undefined ? { mediaIds } : {}),
        ...(nextTargets !== undefined ? { targets: nextTargets } : {}),
      },
      input.actingUserId,
    );
    return {
      post,
      targets: nextTargets ?? existing.draftTargets ?? [],
    };
  }

  private async resolveTargets(
    workspaceId: WorkspaceId,
    userId: UserId,
    requests: ComposeDraftTargetRequest[] | undefined,
  ): Promise<SchedulePostTargetInput[] | undefined> {
    if (requests === undefined) {
      return undefined;
    }
    if (requests.length === 0) {
      return [];
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

    const accounts = await this.accounts.listConnectedAccounts(
      workspaceId,
      userId,
    );
    return resolveScheduleTargets(accounts, requests).map((target) => ({
      connectedAccountId: target.connectedAccountId,
      platform: target.platform,
      contentFormat: target.contentFormat,
      ...(target.platformOptions !== undefined
        ? { platformOptions: target.platformOptions }
        : {}),
    }));
  }

  private async resolveMedia(
    workspaceId: WorkspaceId,
    userId: UserId,
    requested: string[] | undefined,
    formats: ContentFormat[],
  ): Promise<MediaId[] | undefined> {
    if (requested === undefined) {
      return undefined;
    }
    if (requested.length === 0) {
      return [];
    }
    if (new Set(requested).size !== requested.length) {
      throw new ValidationError(
        "Media yang sama dipilih lebih dari sekali. Satu media cukup satu kali.",
      );
    }
    // Tolak lebih dulu daftar yang pasti melebihi batas format terlonggar,
    // sebelum menyentuh DB (batas per format tetap dicek setelah resolve).
    assertMediaCountWithinLimit(requested.length, []);

    const mediaIds = requested.map((id) => asMediaId(id));
    const found = await this.media.listByIds({ workspaceId, mediaIds }, userId);
    const resolved = resolveDraftMediaIds(found, mediaIds);
    assertMediaCountWithinLimit(resolved.length, formats);
    return resolved;
  }
}

function assertCaptionWithinLimit(caption: string): void {
  // Panjang apa adanya (tanpa trim): yang disimpan juga caption utuh.
  const length = caption.length;
  if (length > DRAFT_CAPTION_MAX_LENGTH) {
    throw new ValidationError(
      `Caption terlalu panjang (${length} karakter). Batas maksimum ${DRAFT_CAPTION_MAX_LENGTH} karakter.`,
    );
  }
}

/** Hanya `Draft` yang boleh diubah; pesan dibedakan supaya AI klien tahu langkah berikutnya. */
function assertStatusEditable(status: ContentStatus): void {
  if (status === ContentStatus.Draft) {
    return;
  }
  if (status === ContentStatus.Scheduled) {
    throw new ConflictError(
      "Post ini sudah dijadwalkan sehingga tidak bisa diubah lewat update_draft. Batalkan jadwalnya di aplikasi Postific lebih dulu bila ingin mengubahnya.",
    );
  }
  if (isReadonlyTerminalStatus(status)) {
    throw new ConflictError(READONLY_TERMINAL_CONFLICT_MESSAGE);
  }
  throw new ConflictError(
    `Hanya post berstatus draft yang bisa diubah lewat update_draft (status saat ini: ${status}).`,
  );
}

/** Pertahankan `platformOptions` target lama untuk akun yang tetap dipilih. */
function carryOverPlatformOptions(
  next: SchedulePostTargetInput[],
  existing: readonly DraftTargetRecord[],
): SchedulePostTargetInput[] {
  const optionsByAccount = new Map<
    ConnectedAccountId,
    Record<string, unknown>
  >();
  for (const target of existing) {
    if (target.platformOptions !== undefined) {
      optionsByAccount.set(target.connectedAccountId, target.platformOptions);
    }
  }
  return next.map((target) => {
    const options =
      target.platformOptions ?? optionsByAccount.get(target.connectedAccountId);
    return options !== undefined
      ? { ...target, platformOptions: options }
      : target;
  });
}
