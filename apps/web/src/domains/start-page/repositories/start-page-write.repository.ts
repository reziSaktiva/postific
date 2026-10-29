import type { UserId, WorkspaceId } from "@postific/shared";
import type { StartPageLinkRecord, StartPageRecord } from "../types";
import type { StartPageTheme } from "../value-objects/theme";

export interface CreateStartPageData {
  slug: string;
  title: string;
  bio: string | null;
  avatarUrl: string | null;
  theme: StartPageTheme;
}

/** Patch profil: field `undefined` = tidak diubah. Nilai sudah tervalidasi service. */
export interface UpdateStartPageData {
  slug?: string;
  title?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  theme?: StartPageTheme;
  isPublished?: boolean;
}

export interface UpdateStartPageLinkData {
  label?: string;
  url?: string;
  isActive?: boolean;
}

/** Hasil `addLink`: halaman tidak ada, batas tautan tercapai, atau tautan tertambah. */
export type AddStartPageLinkResult =
  | { status: "no_page" }
  | { status: "limit_reached" }
  | { status: "added"; link: StartPageLinkRecord };

/**
 * Port baca/tulis Start Page workspace-scoped (T-072). Implementasi Prisma
 * di `lib/repositories/start-page/` lewat `withCurrentUser` (RLS
 * `*_workspace_isolation`). `userId` (kolom terakhir) = acting user untuk
 * RLS. Satu workspace = satu halaman, jadi operasi di-scope ke `workspaceId`
 * (bukan page id dari klien — anti-IDOR); `linkId` selalu diverifikasi milik
 * halaman workspace itu.
 */
export interface IStartPageRepository {
  /** Halaman workspace + semua tautan terurut `position`; `null` bila belum ada. */
  findByWorkspace(
    input: { workspaceId: WorkspaceId },
    userId: UserId,
  ): Promise<StartPageRecord | null>;

  /**
   * Buat halaman (draft, `isPublished=false`). Melempar
   * `StartPageSlugTakenError` / `StartPageAlreadyExistsError` pada unique
   * violation — repository yang menerjemahkan error Prisma, domain tidak.
   */
  create(
    input: { workspaceId: WorkspaceId; data: CreateStartPageData },
    userId: UserId,
  ): Promise<StartPageRecord>;

  /** Update profil/published. `null` bila workspace belum punya halaman. Melempar `StartPageSlugTakenError`. */
  update(
    input: { workspaceId: WorkspaceId; data: UpdateStartPageData },
    userId: UserId,
  ): Promise<StartPageRecord | null>;

  /**
   * Tambah tautan di posisi terakhir. Baris halaman dikunci (`FOR UPDATE`)
   * lalu jumlah tautan dicek terhadap `maxLinks` dalam transaksi yang sama,
   * jadi dua tambah bersamaan tidak bisa melewati batas atau menghasilkan
   * `position` kembar (T-167.1).
   */
  addLink(
    input: {
      workspaceId: WorkspaceId;
      maxLinks: number;
      data: { label: string; url: string; isActive: boolean };
    },
    userId: UserId,
  ): Promise<AddStartPageLinkResult>;

  /** `null` bila tautan tidak ada / bukan milik halaman workspace ini. */
  updateLink(
    input: {
      workspaceId: WorkspaceId;
      linkId: string;
      data: UpdateStartPageLinkData;
    },
    userId: UserId,
  ): Promise<StartPageLinkRecord | null>;

  /**
   * Hapus tautan lalu padatkan `position` sisanya ke 0..n-1 (urutan relatif
   * tetap) dalam satu transaksi (T-162.2). `false` bila tautan tidak ada /
   * bukan milik workspace ini.
   */
  deleteLink(
    input: { workspaceId: WorkspaceId; linkId: string },
    userId: UserId,
  ): Promise<boolean>;

  /**
   * Terapkan urutan baru (`position` 0..n-1) secara atomik. Mengembalikan
   * `false` (tanpa mengubah apa pun) bila `orderedLinkIds` bukan PERSIS
   * himpunan tautan halaman saat ini, atau halaman tidak ada.
   */
  reorderLinks(
    input: { workspaceId: WorkspaceId; orderedLinkIds: string[] },
    userId: UserId,
  ): Promise<boolean>;
}
