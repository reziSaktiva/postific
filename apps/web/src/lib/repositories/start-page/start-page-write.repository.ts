import { asWorkspaceId } from "@postific/shared";
import {
  StartPageAlreadyExistsError,
  StartPageSlugTakenError,
  parseStartPageTheme,
  type IStartPageRepository,
  type StartPageLinkRecord,
  type StartPageRecord,
} from "@/domains/start-page";
import { Prisma } from "@/generated/prisma/client";
import type { StartPageLink, StartPagePage } from "@/generated/prisma/client";
import { withCurrentUser } from "@/lib/prisma/with-current-user";

const LINKS_ORDER = [{ position: "asc" }, { id: "asc" }] as const;

function toLinkRecord(link: StartPageLink): StartPageLinkRecord {
  return {
    id: link.id,
    label: link.label,
    url: link.url,
    position: link.position,
    isActive: link.isActive,
    clickCount: Number(link.clickCount),
  };
}

function toRecord(
  page: StartPagePage & { links: StartPageLink[] },
): StartPageRecord {
  return {
    id: page.id,
    workspaceId: asWorkspaceId(page.workspaceId),
    slug: page.slug,
    title: page.title,
    bio: page.bio,
    avatarUrl: page.avatarUrl,
    theme: parseStartPageTheme(page.theme),
    isPublished: page.isPublished,
    viewCount: Number(page.viewCount),
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    links: page.links.map(toLinkRecord),
  };
}

/**
 * Unique violation pada `StartPagePage`. Dengan driver adapter pg
 * (Prisma 7), `meta.target` tidak terisi — hanya `meta.modelName` yang
 * andal. Model ini punya dua unique selain PK: `slug` dan `workspace_id`
 * (satu halaman per workspace), jadi pemanggil membedakannya lewat cek ulang.
 */
function isPageUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    error.meta?.modelName === "StartPagePage"
  );
}

/**
 * Implementasi Prisma `IStartPageRepository` (T-072). Semua query lewat
 * `withCurrentUser` (RLS `start_page_*_workspace_isolation`); `workspaceId`
 * selalu ikut WHERE (anti-IDOR) dan tautan diverifikasi milik halaman
 * workspace itu lewat relasi `startPage.workspaceId`.
 */
export const startPageRepository: IStartPageRepository = {
  async findByWorkspace({ workspaceId }, userId) {
    const page = await withCurrentUser(userId, (tx) =>
      tx.startPagePage.findFirst({
        where: { workspaceId },
        include: { links: { orderBy: [...LINKS_ORDER] } },
      }),
    );
    return page ? toRecord(page) : null;
  },

  async create({ workspaceId, data }, userId) {
    try {
      const page = await withCurrentUser(userId, (tx) =>
        tx.startPagePage.create({
          data: { workspaceId, ...data, isPublished: false },
          include: { links: { orderBy: [...LINKS_ORDER] } },
        }),
      );
      return toRecord(page);
    } catch (error) {
      if (!isPageUniqueViolation(error)) throw error;
      // Transaksi sudah abort — cek ulang di transaksi baru untuk
      // membedakan "workspace sudah punya halaman" vs "slug dipakai".
      const existing = await this.findByWorkspace({ workspaceId }, userId);
      if (existing) throw new StartPageAlreadyExistsError();
      throw new StartPageSlugTakenError(data.slug);
    }
  },

  async update({ workspaceId, data }, userId) {
    try {
      const page = await withCurrentUser(userId, async (tx) => {
        const current = await tx.startPagePage.findFirst({
          where: { workspaceId },
          select: { id: true },
        });
        if (!current) return null;
        return tx.startPagePage.update({
          where: { id: current.id },
          data,
          include: { links: { orderBy: [...LINKS_ORDER] } },
        });
      });
      return page ? toRecord(page) : null;
    } catch (error) {
      if (isPageUniqueViolation(error) && data.slug !== undefined) {
        throw new StartPageSlugTakenError(data.slug);
      }
      throw error;
    }
  },

  async addLink({ workspaceId, data }, userId) {
    const link = await withCurrentUser(userId, async (tx) => {
      const page = await tx.startPagePage.findFirst({
        where: { workspaceId },
        select: { id: true },
      });
      if (!page) return null;
      const last = await tx.startPageLink.aggregate({
        where: { startPageId: page.id },
        _max: { position: true },
      });
      return tx.startPageLink.create({
        data: {
          startPageId: page.id,
          position: (last._max.position ?? -1) + 1,
          ...data,
        },
      });
    });
    return link ? toLinkRecord(link) : null;
  },

  async updateLink({ workspaceId, linkId, data }, userId) {
    const link = await withCurrentUser(userId, async (tx) => {
      const owned = await tx.startPageLink.findFirst({
        where: { id: linkId, startPage: { workspaceId } },
        select: { id: true },
      });
      if (!owned) return null;
      return tx.startPageLink.update({ where: { id: owned.id }, data });
    });
    return link ? toLinkRecord(link) : null;
  },

  async deleteLink({ workspaceId, linkId }, userId) {
    const { count } = await withCurrentUser(userId, (tx) =>
      tx.startPageLink.deleteMany({
        where: { id: linkId, startPage: { workspaceId } },
      }),
    );
    return count > 0;
  },

  async reorderLinks({ workspaceId, orderedLinkIds }, userId) {
    return withCurrentUser(userId, async (tx) => {
      const page = await tx.startPagePage.findFirst({
        where: { workspaceId },
        select: { id: true },
      });
      if (!page) return false;
      const current = await tx.startPageLink.findMany({
        where: { startPageId: page.id },
        select: { id: true },
      });
      const currentIds = new Set(current.map((l) => l.id));
      if (
        currentIds.size !== orderedLinkIds.length ||
        !orderedLinkIds.every((id) => currentIds.has(id))
      ) {
        return false;
      }
      for (const [position, id] of orderedLinkIds.entries()) {
        await tx.startPageLink.update({ where: { id }, data: { position } });
      }
      return true;
    });
  },
};
