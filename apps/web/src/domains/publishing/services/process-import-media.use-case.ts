import type { UserId, WorkspaceId } from "@postific/shared";
import type { IImportThumbnailGenerator } from "../adapters/import-thumbnail-generator";
import type { IPublishingRepository } from "../repositories/publishing.repository";

/** Unduhan paralel per job; kecil agar tidak membebani jaringan atau CPU (`sharp`/`ffmpeg`). */
const CONCURRENCY = 5;

/**
 * Anggaran waktu satu job: di bawah batas 25 detik (BG-D05) dan reclaim 30
 * detik (BG-D04). Setelah habis, pekerjaan dibatalkan dan sisa target tetap
 * tertunda untuk job berikutnya.
 */
export const IMPORT_MEDIA_JOB_BUDGET_MS = 20_000;

/**
 * Batas kegagalan SEMENTARA per target (T-233, addendum ADR-158). Setelah
 * sebanyak ini, target ditandai permanen (`thumbnail_attempted_at`) dan tidak
 * dicoba lagi pada import berikutnya; thumbnail jatuh ke fallback T-227.
 */
export const MAX_THUMBNAIL_ATTEMPTS = 5;

export interface ProcessImportMediaResult {
  /** Target yang thumbnail-nya tersimpan. */
  stored: number;
  /** Target dengan kegagalan PERMANEN (URL mati, terlalu besar, dst.) atau yang kegagalan sementaranya mencapai `MAX_THUMBNAIL_ATTEMPTS`: ditandai sudah dicoba. */
  skipped: number;
  /** Target dengan kegagalan SEMENTARA (penghitung percobaan naik, belum mencapai batas) atau waktu habis (penghitung tidak naik): dicoba lagi nanti. */
  deferred: number;
  /** Target yang sudah punya thumbnail atau sudah pernah dicoba (idempoten). */
  alreadyHandled: number;
}

/**
 * Proses satu batch thumbnail posting impor (T-230, ADR-158). Idempoten:
 * hanya target yang belum punya thumbnail DAN belum pernah dicoba yang
 * diproses, jadi job yang diulang (retry, import ulang) tidak mengunduh dua
 * kali.
 *
 * Kegagalan PERMANEN (`generate` mengembalikan `null`) ditandai sudah dicoba
 * agar URL CDN yang sudah mati tidak dicoba lagi di setiap import. Kegagalan
 * SEMENTARA (`generate` melempar: timeout, 5xx, `ffmpeg` belum terpasang,
 * error Storage) tidak langsung ditandai: penghitung percobaan target naik dan
 * dicoba lagi pada import atau backfill berikutnya (review Ridwan H1), sampai
 * `MAX_THUMBNAIL_ATTEMPTS`, lalu ditandai permanen (T-233). Pembatalan karena
 * anggaran waktu job habis BUKAN kesalahan target, jadi tidak menaikkan
 * penghitung.
 */
export class ProcessImportMediaUseCase {
  constructor(
    private readonly repository: IPublishingRepository,
    private readonly generator: IImportThumbnailGenerator,
    private readonly budgetMs: number = IMPORT_MEDIA_JOB_BUDGET_MS,
  ) {}

  async process(input: {
    workspaceId: WorkspaceId;
    actingUserId: UserId;
    targetIds: string[];
  }): Promise<ProcessImportMediaResult> {
    const pending = await this.repository.findImportedTargetsNeedingThumbnail(
      { workspaceId: input.workspaceId, targetIds: input.targetIds },
      input.actingUserId,
    );
    const result: ProcessImportMediaResult = {
      stored: 0,
      skipped: 0,
      deferred: 0,
      alreadyHandled: input.targetIds.length - pending.length,
    };

    const budget = new AbortController();
    const timer = setTimeout(() => budget.abort(), this.budgetMs);
    try {
      for (let i = 0; i < pending.length; i += CONCURRENCY) {
        const chunk = pending.slice(i, i + CONCURRENCY);
        if (budget.signal.aborted) {
          result.deferred += chunk.length;
          continue;
        }
        const outcomes = await Promise.all(
          chunk.map((target) =>
            this.processTarget(input, target, budget.signal),
          ),
        );
        for (const outcome of outcomes) result[outcome]++;
      }
    } finally {
      clearTimeout(timer);
    }
    return result;
  }

  private async processTarget(
    input: { workspaceId: WorkspaceId; actingUserId: UserId },
    target: { targetId: string; sourceUrl: string },
    signal: AbortSignal,
  ): Promise<"stored" | "skipped" | "deferred"> {
    let thumbnail;
    try {
      thumbnail = await raceAbort(
        this.generator.generate({
          workspaceId: input.workspaceId,
          targetId: target.targetId,
          sourceUrl: target.sourceUrl,
          signal,
        }),
        signal,
      );
    } catch (error) {
      console.warn(
        `[ProcessImportMediaUseCase] thumbnail target ${target.targetId} ditunda: ${describeError(error)}`,
      );
      // Waktu job habis: tertunda tanpa menghitung sebagai percobaan target.
      if (signal.aborted) return "deferred";
      const { exhausted } =
        await this.repository.recordImportedTargetThumbnailFailure(
          {
            workspaceId: input.workspaceId,
            targetId: target.targetId,
            maxAttempts: MAX_THUMBNAIL_ATTEMPTS,
          },
          input.actingUserId,
        );
      if (exhausted) {
        console.warn(
          `[ProcessImportMediaUseCase] thumbnail target ${target.targetId} dihentikan setelah ${MAX_THUMBNAIL_ATTEMPTS} kegagalan sementara`,
        );
        return "skipped";
      }
      return "deferred";
    }
    await this.repository.saveImportedTargetThumbnail(
      {
        workspaceId: input.workspaceId,
        targetId: target.targetId,
        thumbnail,
      },
      input.actingUserId,
    );
    return thumbnail ? "stored" : "skipped";
  }
}

/** Pesan galat beserta penyebab bertingkat (`cause`), agar log menunjukkan akar masalah. */
function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current !== undefined && depth < 3; depth++) {
    parts.push(current instanceof Error ? current.message : String(current));
    current = current instanceof Error ? current.cause : undefined;
  }
  return parts.join(" <- ");
}

function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new Error("anggaran waktu job habis"));
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}
