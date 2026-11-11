import type { SweepImportThumbnailsResult } from "./purge-import-thumbnails.use-case";

/** Job type JOB-10 (T-231, ADR-158): sapu berkas thumbnail posting impor yang tidak dirujuk. */
export const IMPORT_THUMBNAIL_SWEEP_JOB_TYPE = "import.media.sweep";

export interface ImportThumbnailSweeper {
  sweepOrphans(): Promise<SweepImportThumbnailsResult>;
}

/** Handler JOB-10: tanpa payload, delegasi ke `PurgeImportThumbnailsUseCase.sweepOrphans`. */
export class ImportThumbnailSweepJobHandler {
  constructor(private readonly sweeper: ImportThumbnailSweeper) {}

  async handle(): Promise<void> {
    const result = await this.sweeper.sweepOrphans();
    console.info(
      `[ImportThumbnailSweepJobHandler] dipindai ${result.scanned}, dihapus ${result.removed}${result.incomplete ? " (belum selesai)" : ""}`,
    );
  }
}
