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
import {
  withCurrentUser,
  type PrismaTransactionClient,
} from "@/lib/prisma/with-current-user";

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
 * P2025 ("record to update not found"): baris hilang di antara cek dan
 * write (mis. tautan dihapus dari tab lain). Diterjemahkan jadi hasil
 * "tidak ditemukan"/gagal biasa, bukan error mentah ke pengguna.
 */
function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

/** Dilempar di dalam transaksi reorder agar UPDATE parsial di-rollback. */
class ReorderSetMismatch extends Error {}

/**
 * Kunci baris halaman workspace (`FOR UPDATE`) sampai transaksi selesai
 * (T-167.1). Semua operasi yang membaca lalu menulis `position`/jumlah tautan
 * (`addLink`, `deleteLink`, `reorderLinks`) mengambil kunci ini lebih dulu,
 * jadi berjalan serial per halaman. Mengembalikan id halaman, atau `null`
 * bila workspace belum punya halaman (RLS ikut berlaku lewat `withCurrentUser`).
 */
async function lockPage(
  tx: PrismaTransactionClient,
  workspaceId: string,
): Promise<string | null> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "start_page_pages"
    WHERE "workspace_id" = ${workspaceId}::uuid
    FOR UPDATE`;
  return rows[0]?.id ?? null;
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
      if (isRecordNotFound(error)) return null;
      if (isPageUniqueViolation(error) && data.slug !== undefined) {
        throw new StartPageSlugTakenError(data.slug);
      }
      throw error;
    }
  },

  async addLink({ workspaceId, maxLinks, data }, userId) {
    return withCurrentUser(userId, async (tx) => {
      const pageId = await lockPage(tx, workspaceId);
      if (!pageId) return { status: "no_page" as const };
      const stats = await tx.startPageLink.aggregate({
        where: { startPageId: pageId },
        _max: { position: true },
        _count: { _all: true },
      });
      if (stats._count._all >= maxLinks) {
        return { status: "limit_reached" as const };
      }
      const link = await tx.startPageLink.create({
        data: {
          startPageId: pageId,
          position: (stats._max.position ?? -1) + 1,
          ...data,
        },
      });
      return { status: "added" as const, link: toLinkRecord(link) };
    });
  },

  async updateLink({ workspaceId, linkId, data }, userId) {
    try {
      const link = await withCurrentUser(userId, async (tx) => {
        const owned = await tx.startPageLink.findFirst({
          where: { id: linkId, startPage: { workspaceId } },
          select: { id: true },
        });
        if (!owned) return null;
        return tx.startPageLink.update({ where: { id: owned.id }, data });
      });
      return link ? toLinkRecord(link) : null;
    } catch (error) {
      if (isRecordNotFound(error)) return null;
      throw error;
    }
  },

  async deleteLink({ workspaceId, linkId }, userId) {
    // Hapus + padatkan `position` sisa tautan (0..n-1, urutan relatif
    // dipertahankan) dalam SATU transaksi, tetap workspace-scoped (T-162.2).
    // Halaman dikunci dulu (T-167.1) dan pemadatan satu UPDATE (T-167.3).
    return withCurrentUser(userId, async (tx) => {
      const pageId = await lockPage(tx, workspaceId);
      if (!pageId) return false;
      const { count } = await tx.startPageLink.deleteMany({
        where: { id: linkId, startPage: { workspaceId } },
      });
      if (count === 0) return false;
      // Hanya baris yang posisinya berubah yang ditulis.
      await tx.$executeRaw`
        UPDATE "start_page_links" AS l
           SET "position" = r."rn" - 1, "updated_at" = now()
          FROM (
            SELECT "id", row_number() OVER (ORDER BY "position", "id") AS "rn"
              FROM "start_page_links"
             WHERE "start_page_id" = ${pageId}::uuid
          ) AS r
         WHERE l."id" = r."id"
           AND l."position" <> r."rn" - 1`;
      return true;
    });
  },

  async reorderLinks({ workspaceId, orderedLinkIds }, userId) {
    try {
      return await withCurrentUser(userId, async (tx) => {
        const pageId = await lockPage(tx, workspaceId);
        if (!pageId) return false;
        // Satu UPDATE untuk semua posisi (T-167.3), hanya berlaku bila jumlah
        // tautan halaman sama dengan daftar yang dikirim. Id asing atau basi
        // bisa membuat UPDATE parsial (sebagian baris sudah tertulis), jadi
        // jumlah baris terpengaruh yang kurang dari daftar melempar error agar
        // transaksi rollback (id unik sudah dijamin service).
        const positions = orderedLinkIds.map((_, index) => index);
        const total = orderedLinkIds.length;
        const updated = await tx.$executeRaw`
        UPDATE "start_page_links" AS l
           SET "position" = v."position", "updated_at" = now()
          FROM unnest(${orderedLinkIds}::uuid[], ${positions}::int[])
               AS v("id", "position")
         WHERE l."id" = v."id"
           AND l."start_page_id" = ${pageId}::uuid
           AND (SELECT count(*) FROM "start_page_links"
                 WHERE "start_page_id" = ${pageId}::uuid) = ${total}::int`;
        if (updated !== total) throw new ReorderSetMismatch();
        return true;
      });
    } catch (error) {
      if (error instanceof ReorderSetMismatch) return false;
      throw error;
    }
  },
};
