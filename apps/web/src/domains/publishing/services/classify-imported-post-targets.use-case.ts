import {
  ContentFormat,
  SocialPlatform,
  type ConnectedAccountId,
  type FetchPostMetricsResult,
  type ImportedPostData,
  type IOutstandAdapter,
  type UserId,
  type WorkspaceId,
} from "@postific/shared";
import { mapWithConcurrency } from "@/lib/utils/map-with-concurrency";
import type {
  ClassifyImportedPostTargetUpdate,
  IPublishingRepository,
} from "../repositories/publishing.repository";

/**
 * Panggilan `fetchPostMetrics` jalan paralel terbatas (pola sama
 * `analytics-ingestion.use-case.ts`) — job runner menganggap job `running`
 * macet setelah 30 detik (BG-D05); fetch berurutan untuk batch sampai 1000
 * post (limit import T-131) melewati batas itu jauh.
 */
const OUTSTAND_FETCH_CONCURRENCY = 8;

export interface ClassifyImportedPostTargetsInput {
  workspaceId: WorkspaceId;
  connectedAccountId: ConnectedAccountId;
  platform: SocialPlatform;
  /**
   * Batch post YANG BARU SAJA diproses `ImportPostsProcessUseCase.process`
   * pada sync ini (T-132.4) — BUKAN seluruh riwayat Imported akun ini.
   * Post tanpa `outstandPostId` dilewati (tidak ada id untuk
   * `fetchPostMetrics`, lihat catatan `ImportedPostData.outstandPostId`).
   */
  posts: ImportedPostData[];
  /** RLS acting user — sama pola `ImportPostsProcessInput.actingUserId`. */
  actingUserId: UserId;
}

export interface ClassifyImportedPostTargetsResult {
  classifiedCount: number;
}

/**
 * ADR-135 — mapping murni `FetchPostMetricsResult` (sinyal klasifikasi
 * ADR-135: `mediaProductType`/`isReel`/`storyExpired`) → `ContentFormat`
 * internal. Diekspor terpisah dari class di bawah supaya diuji tanpa
 * network/DB sama sekali (T-132.6).
 *
 * `undefined` = FALLBACK EKSPLISIT (ADR-135 poin 4) — caller TIDAK BOLEH
 * menulis `contentFormat` untuk kasus ini, biarkan nilai placeholder yang
 * sudah diisi `upsertImportedPosts` apa adanya:
 * - `storyExpired` true (jenis konten tidak bisa diketahui lagi).
 * - Instagram dengan `mediaProductType` kosong/tidak dikenal.
 * - Facebook dengan `isReel` kosong (`undefined` — BEDA dari `false`,
 *   yang berarti "dikonfirmasi bukan Reel" dan menghasilkan `Post`).
 * - Platform selain Instagram/Facebook (belum ada sinyal resmi Outstand
 *   untuk platform itu di endpoint `get-post-analytics`).
 */
export function mapFetchPostMetricsToContentFormat(
  platform: SocialPlatform,
  metrics: Pick<
    FetchPostMetricsResult,
    "mediaProductType" | "isReel" | "storyExpired"
  >,
): ContentFormat | undefined {
  // Story expired berlaku lintas platform (ADR-135) — dicek SEBELUM
  // percabangan per-platform supaya tidak ada kombinasi platform yang lolos
  // tanpa guard ini.
  if (metrics.storyExpired) return undefined;

  if (platform === SocialPlatform.Instagram) {
    switch (metrics.mediaProductType) {
      case "FEED":
        return ContentFormat.Post;
      case "REELS":
        return ContentFormat.Reel;
      case "STORY":
        return ContentFormat.Story;
      default:
        return undefined;
    }
  }

  if (platform === SocialPlatform.Facebook) {
    if (metrics.isReel === true) return ContentFormat.Reel;
    if (metrics.isReel === false) return ContentFormat.Post;
    return undefined;
  }

  // Platform lain: ADR-135 belum mendefinisikan sinyal resmi apa pun untuk
  // platform ini di endpoint `get-post-analytics` — fallback, bukan tebakan.
  return undefined;
}

/**
 * Klasifikasi `ContentFormat` (Post/Reel/Story) post hasil Import (ADR-135,
 * T-132.4) — use-case BEST-EFFORT terpisah dari `ImportPostsProcessUseCase`
 * (pola sama `BackfillOutstandPostIdsUseCase`/T-114): dipanggil SETELAH
 * `ImportPostsProcessUseCase.process` selesai pada
 * `ImportPostsTriggerUseCase.runImportJob`, untuk SEMUA post yang baru
 * diimpor di batch sync ini. Gagal di sini (satu post, atau seluruh batch)
 * TIDAK membatalkan import yang sudah sukses — caller menelan error dari
 * method ini sama seperti `attemptBackfill` menelan error
 * `BackfillOutstandPostIdsUseCase`.
 *
 * TIDAK ada mekanisme retry/mark-skipped untuk post yang gagal
 * diklasifikasikan (beda dari T-114 backfill `outstandPostId`) — lihat
 * ADR-135 poin 4 untuk alasan: sinyal `mediaProductType`/`isReel` kosong
 * atau `storyExpired` untuk satu `outstandPostId` bersifat permanen,
 * mencoba ulang tidak akan menghasilkan sinyal baru. Kegagalan NETWORK
 * (bukan fallback sinyal kosong) tetap best-effort per post — satu post
 * gagal fetch tidak menghentikan post lain dalam batch yang sama.
 */
export class ClassifyImportedPostTargetsUseCase {
  constructor(
    private readonly repository: IPublishingRepository,
    private readonly outstandAdapter: IOutstandAdapter,
  ) {}

  async classifyBatch(
    input: ClassifyImportedPostTargetsInput,
  ): Promise<ClassifyImportedPostTargetsResult> {
    const perPostUpdates = await mapWithConcurrency(
      input.posts,
      OUTSTAND_FETCH_CONCURRENCY,
      async (post): Promise<ClassifyImportedPostTargetUpdate | undefined> => {
        if (!post.outstandPostId) return undefined;

        let metrics: FetchPostMetricsResult;
        try {
          metrics = await this.outstandAdapter.fetchPostMetrics(
            post.outstandPostId,
          );
        } catch (error) {
          console.warn(
            `[ClassifyImportedPostTargetsUseCase] fetchPostMetrics gagal untuk outstandPostId=${post.outstandPostId} (platformPostId=${post.platformPostId}): ${error instanceof Error ? error.message : String(error)} — best-effort, lanjut ke post berikutnya di batch ini.`,
          );
          return undefined;
        }

        const contentFormat = mapFetchPostMetricsToContentFormat(
          input.platform,
          metrics,
        );
        if (contentFormat === undefined) return undefined;

        return { platformPostId: post.platformPostId, contentFormat };
      },
    );

    const updates = perPostUpdates.filter(
      (update): update is ClassifyImportedPostTargetUpdate =>
        update !== undefined,
    );

    if (updates.length === 0) {
      return { classifiedCount: 0 };
    }

    const result = await this.repository.classifyImportedPostTargets(
      {
        workspaceId: input.workspaceId,
        connectedAccountId: input.connectedAccountId,
        updates,
      },
      input.actingUserId,
    );

    return { classifiedCount: result.updatedCount };
  }
}
