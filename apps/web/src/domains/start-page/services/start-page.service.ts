import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/utils/errors";
import {
  StartPageAlreadyExistsError,
  StartPageSlugTakenError,
} from "../errors";
import { assertActorCanManageStartPage } from "../rbac";
import type {
  IStartPageRepository,
  UpdateStartPageData,
  UpdateStartPageLinkData,
} from "../repositories/start-page-write.repository";
import type {
  StartPageActorContext,
  StartPageLinkRecord,
  StartPageRecord,
} from "../types";
import {
  isUuid,
  validateAvatarUrlInput,
  validateBioInput,
  validateLinkLabelInput,
  validateLinkUrlInput,
  validateSlugInput,
  validateThemeInput,
  validateTitleInput,
} from "../validation";
import { START_PAGE_MAX_LINKS } from "../value-objects/limits";
import { DEFAULT_START_PAGE_THEME } from "../value-objects/theme";

export interface CreateStartPageInput {
  title: string;
  slug: string;
  bio?: string | null;
  avatarUrl?: string | null;
  theme?: string;
}

/** Patch profil: field yang tidak dikirim tidak diubah; `bio`/`avatarUrl` `null` = hapus. */
export interface UpdateStartPageProfileInput {
  title?: string;
  slug?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  theme?: string;
}

export interface AddStartPageLinkInput {
  label: string;
  url: string;
  isActive?: boolean;
}

export interface UpdateStartPageLinkInput {
  label?: string;
  url?: string;
  isActive?: boolean;
}

const NO_PAGE_MESSAGE = "Start Page belum dibuat untuk workspace ini.";

/**
 * Application Service jalur tulis/baca editor Start Page (T-072, BC-07).
 * Semua method workspace-scoped dan RBAC-gated (`assertActorCanManageStartPage`).
 * Satu workspace = satu halaman (`database-strategy.md`), jadi tidak ada
 * page id dari klien. Validasi input (panjang, http/https, https avatar,
 * slug, theme allowlist) di sini, BUKAN di Server Action. Semua error
 * dilempar sebagai `ApplicationError` (`toActionError` di entry point).
 */
export class StartPageService {
  constructor(private readonly repository: IStartPageRepository) {}

  /** Data Page Editor; `null` bila halaman belum dibuat (UI tampilkan state "buat halaman"). */
  async getStartPage(
    ctx: StartPageActorContext,
  ): Promise<StartPageRecord | null> {
    assertActorCanManageStartPage(ctx.actorRole);
    return this.repository.findByWorkspace(
      { workspaceId: ctx.workspaceId },
      ctx.actingUserId,
    );
  }

  async createStartPage(
    ctx: StartPageActorContext,
    input: CreateStartPageInput,
  ): Promise<StartPageRecord> {
    assertActorCanManageStartPage(ctx.actorRole);
    const data = {
      title: validateTitleInput(input.title),
      slug: validateSlugInput(input.slug),
      bio: validateBioInput(input.bio),
      avatarUrl: validateAvatarUrlInput(input.avatarUrl),
      theme:
        input.theme === undefined
          ? DEFAULT_START_PAGE_THEME
          : validateThemeInput(input.theme),
    };

    const existing = await this.repository.findByWorkspace(
      { workspaceId: ctx.workspaceId },
      ctx.actingUserId,
    );
    if (existing) {
      throw new ConflictError("Workspace ini sudah memiliki Start Page.");
    }

    try {
      return await this.repository.create(
        { workspaceId: ctx.workspaceId, data },
        ctx.actingUserId,
      );
    } catch (error) {
      throw this.translateWriteError(error);
    }
  }

  async updateProfile(
    ctx: StartPageActorContext,
    input: UpdateStartPageProfileInput,
  ): Promise<StartPageRecord> {
    assertActorCanManageStartPage(ctx.actorRole);
    const data: UpdateStartPageData = {};
    if (input.title !== undefined) data.title = validateTitleInput(input.title);
    if (input.slug !== undefined) data.slug = validateSlugInput(input.slug);
    if (input.bio !== undefined) data.bio = validateBioInput(input.bio);
    if (input.avatarUrl !== undefined) {
      data.avatarUrl = validateAvatarUrlInput(input.avatarUrl);
    }
    if (input.theme !== undefined) data.theme = validateThemeInput(input.theme);
    if (Object.keys(data).length === 0) {
      throw new ValidationError("Tidak ada perubahan yang dikirim.");
    }
    return this.applyPageUpdate(ctx, data);
  }

  /** Toggle Published/Unpublished. Halaman tanpa tautan aktif tetap boleh dipublikasikan. */
  async setPublished(
    ctx: StartPageActorContext,
    isPublished: boolean,
  ): Promise<StartPageRecord> {
    assertActorCanManageStartPage(ctx.actorRole);
    if (typeof isPublished !== "boolean") {
      throw new ValidationError("Status publikasi tidak valid.");
    }
    return this.applyPageUpdate(ctx, { isPublished });
  }

  async addLink(
    ctx: StartPageActorContext,
    input: AddStartPageLinkInput,
  ): Promise<StartPageLinkRecord> {
    assertActorCanManageStartPage(ctx.actorRole);
    const data = {
      label: validateLinkLabelInput(input.label),
      url: validateLinkUrlInput(input.url),
      isActive: input.isActive ?? true,
    };
    if (typeof data.isActive !== "boolean") {
      throw new ValidationError("Status aktif tidak valid.");
    }

    const page = await this.repository.findByWorkspace(
      { workspaceId: ctx.workspaceId },
      ctx.actingUserId,
    );
    if (!page) throw new NotFoundError(NO_PAGE_MESSAGE);
    if (page.links.length >= START_PAGE_MAX_LINKS) {
      throw new ValidationError(
        `Maksimal ${START_PAGE_MAX_LINKS} tautan per halaman.`,
      );
    }

    const link = await this.repository.addLink(
      { workspaceId: ctx.workspaceId, data },
      ctx.actingUserId,
    );
    if (!link) throw new NotFoundError(NO_PAGE_MESSAGE);
    return link;
  }

  async updateLink(
    ctx: StartPageActorContext,
    linkId: string,
    input: UpdateStartPageLinkInput,
  ): Promise<StartPageLinkRecord> {
    assertActorCanManageStartPage(ctx.actorRole);
    this.assertLinkId(linkId);
    const data: UpdateStartPageLinkData = {};
    if (input.label !== undefined) {
      data.label = validateLinkLabelInput(input.label);
    }
    if (input.url !== undefined) data.url = validateLinkUrlInput(input.url);
    if (input.isActive !== undefined) {
      if (typeof input.isActive !== "boolean") {
        throw new ValidationError("Status aktif tidak valid.");
      }
      data.isActive = input.isActive;
    }
    if (Object.keys(data).length === 0) {
      throw new ValidationError("Tidak ada perubahan yang dikirim.");
    }

    const link = await this.repository.updateLink(
      { workspaceId: ctx.workspaceId, linkId, data },
      ctx.actingUserId,
    );
    if (!link) throw new NotFoundError("Tautan tidak ditemukan.");
    return link;
  }

  /**
   * Hapus tautan. Konfirmasi (ADR-049) ditangani UI; service langsung
   * menghapus. Celah `position` tidak dipadatkan (urutan tampil memakai
   * `ORDER BY position, id`, celah tidak berpengaruh).
   */
  async deleteLink(ctx: StartPageActorContext, linkId: string): Promise<void> {
    assertActorCanManageStartPage(ctx.actorRole);
    this.assertLinkId(linkId);
    const deleted = await this.repository.deleteLink(
      { workspaceId: ctx.workspaceId, linkId },
      ctx.actingUserId,
    );
    if (!deleted) throw new NotFoundError("Tautan tidak ditemukan.");
  }

  /**
   * Urutan baru: `orderedLinkIds` harus PERSIS himpunan id tautan halaman
   * (tanpa duplikat/kurang/lebih) — jadi tidak ada id asing yang bisa
   * menyusup, dan urutan basi (tab lain menambah/menghapus) ditolak.
   */
  async reorderLinks(
    ctx: StartPageActorContext,
    orderedLinkIds: string[],
  ): Promise<void> {
    assertActorCanManageStartPage(ctx.actorRole);
    if (
      !Array.isArray(orderedLinkIds) ||
      orderedLinkIds.length > START_PAGE_MAX_LINKS ||
      !orderedLinkIds.every(isUuid) ||
      new Set(orderedLinkIds).size !== orderedLinkIds.length
    ) {
      throw new ValidationError("Urutan tautan tidak valid.");
    }
    const applied = await this.repository.reorderLinks(
      { workspaceId: ctx.workspaceId, orderedLinkIds },
      ctx.actingUserId,
    );
    if (!applied) {
      throw new ConflictError(
        "Daftar tautan sudah berubah. Muat ulang halaman lalu coba lagi.",
      );
    }
  }

  private assertLinkId(linkId: string): void {
    if (!isUuid(linkId)) throw new NotFoundError("Tautan tidak ditemukan.");
  }

  private async applyPageUpdate(
    ctx: StartPageActorContext,
    data: UpdateStartPageData,
  ): Promise<StartPageRecord> {
    try {
      const page = await this.repository.update(
        { workspaceId: ctx.workspaceId, data },
        ctx.actingUserId,
      );
      if (!page) throw new NotFoundError(NO_PAGE_MESSAGE);
      return page;
    } catch (error) {
      throw this.translateWriteError(error);
    }
  }

  private translateWriteError(error: unknown): unknown {
    if (error instanceof StartPageSlugTakenError) {
      return new ConflictError("Slug sudah dipakai. Pilih slug lain.");
    }
    if (error instanceof StartPageAlreadyExistsError) {
      return new ConflictError("Workspace ini sudah memiliki Start Page.");
    }
    return error;
  }
}
