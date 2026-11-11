import type { WorkspaceId } from "@postific/shared";
import type { IImportThumbnailStorage } from "../adapters/import-thumbnail-storage";

/** Ukuran halaman daftar Storage dan batch hapus. */
const PAGE_SIZE = 100;

/** Pengaman putaran: satu workspace paling banyak membersihkan 50 halaman per pemanggilan. */
const MAX_PAGES_PER_WORKSPACE = 50;

/**
 * Berkas yang lebih muda dari ini tidak disapu: unggahan `generate` mendahului
 * penyimpanan `thumbnail_storage_path`, jadi berkas yang baru dibuat belum
 * tentu sudah dirujuk baris DB.
 */
export const ORPHAN_GRACE_MS = 60 * 60 * 1000;

/** Anggaran waktu satu sapuan: di bawah batas 25 detik (BG-D05). */
export const SWEEP_BUDGET_MS = 20_000;

/** Port baca ke DB: path mana (dari `paths`) yang masih dirujuk sebuah target. */
export interface ThumbnailReferencePort {
  findReferencedThumbnailPaths(paths: string[]): Promise<string[]>;
}

export interface SweepImportThumbnailsResult {
  scanned: number;
  removed: number;
  /** `true` bila anggaran waktu habis sebelum semua workspace selesai. */
  incomplete: boolean;
}

/**
 * Pembersihan berkas thumbnail posting impor (T-231, ADR-158). Dua jalur:
 *
 * - `purgeWorkspace`: dipanggil setelah workspace dihapus. Baris DB sudah
 *   hilang lewat cascade, jadi SELURUH `{workspaceId}/imports/` dihapus tanpa
 *   mengecek rujukan.
 * - `sweepOrphans`: job harian yang menghapus berkas `imports/` yang tidak
 *   dirujuk `thumbnail_storage_path` mana pun (target hilang, import ulang,
 *   kegagalan `purgeWorkspace`). Berkas yang lebih muda dari `ORPHAN_GRACE_MS`
 *   dilewati.
 *
 * Penghapusan berkas selalu SESUDAH baris DB berubah, jadi kegagalan di sini
 * paling buruk meninggalkan berkas yatim yang disapu pada putaran berikutnya.
 */
export class PurgeImportThumbnailsUseCase {
  constructor(
    private readonly storage: IImportThumbnailStorage,
    private readonly references: ThumbnailReferencePort,
    private readonly now: () => Date = () => new Date(),
    private readonly budgetMs: number = SWEEP_BUDGET_MS,
  ) {}

  async purgeWorkspace(workspaceId: WorkspaceId): Promise<{ removed: number }> {
    let removed = 0;
    for (let page = 0; page < MAX_PAGES_PER_WORKSPACE; page++) {
      // Setelah dihapus, halaman berikutnya selalu mulai dari offset 0.
      const files = await this.storage.listWorkspaceThumbnails(workspaceId, {
        offset: 0,
        limit: PAGE_SIZE,
      });
      if (files.length === 0) break;
      await this.storage.removePaths(files.map((file) => file.path));
      removed += files.length;
    }
    return { removed };
  }

  async sweepOrphans(): Promise<SweepImportThumbnailsResult> {
    const startedAt = this.now().getTime();
    const result: SweepImportThumbnailsResult = {
      scanned: 0,
      removed: 0,
      incomplete: false,
    };
    const workspaceIds = await this.storage.listWorkspaceIds();
    if (workspaceIds.length === 0) return result;

    // Putar titik awal per hari UTC supaya anggaran waktu yang habis tidak
    // selalu menyisakan workspace yang sama di urutan belakang.
    const dayNumber = Math.floor(startedAt / 86_400_000);
    const start = dayNumber % workspaceIds.length;
    const ordered = [
      ...workspaceIds.slice(start),
      ...workspaceIds.slice(0, start),
    ];

    for (const workspaceId of ordered) {
      if (this.now().getTime() - startedAt >= this.budgetMs) {
        result.incomplete = true;
        break;
      }
      try {
        await this.sweepWorkspace(workspaceId, result);
      } catch (error) {
        // Satu workspace yang gagal tidak boleh menahan workspace lain.
        result.incomplete = true;
        console.warn(
          `[PurgeImportThumbnailsUseCase] sapuan workspace ${workspaceId} gagal: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return result;
  }

  private async sweepWorkspace(
    workspaceId: string,
    result: SweepImportThumbnailsResult,
  ): Promise<void> {
    // Offset maju hanya sebanyak berkas yang DIPERTAHANKAN: berkas yang
    // dihapus menggeser daftar ke depan.
    let offset = 0;
    for (let page = 0; page < MAX_PAGES_PER_WORKSPACE; page++) {
      const files = await this.storage.listWorkspaceThumbnails(workspaceId, {
        offset,
        limit: PAGE_SIZE,
      });
      if (files.length === 0) return;
      result.scanned += files.length;

      const referenced = new Set(
        await this.references.findReferencedThumbnailPaths(
          files.map((file) => file.path),
        ),
      );
      const cutoff = this.now().getTime() - ORPHAN_GRACE_MS;
      const orphans = files
        .filter(
          (file) =>
            !referenced.has(file.path) &&
            file.createdAt !== null &&
            file.createdAt.getTime() <= cutoff,
        )
        .map((file) => file.path);

      if (orphans.length > 0) {
        await this.storage.removePaths(orphans);
        result.removed += orphans.length;
      }
      offset += files.length - orphans.length;
      if (files.length < PAGE_SIZE) return;
    }
  }
}
