import type {
  ConnectedAccountId,
  IOutstandAdapter,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import type { IPublishingRepository } from "../repositories/publishing.repository";

export interface BackfillOutstandPostIdsInput {
  workspaceId: WorkspaceId;
  connectedAccountId: ConnectedAccountId;
  outstandAccountId: string;
  /** RLS (`publishing_posts_workspace_isolation` di-scope ke membership workspace) — sama acting user yang dipakai caller untuk `runImportSync`. */
  actingUserId: UserId;
}

export interface BackfillOutstandPostIdsResult {
  /** `false` kalau cek existence (`hasImportedPostsMissingOutstandId`) menemukan TIDAK ADA gap — `fetchAllPostIdMappings` TIDAK dipanggil sama sekali. */
  backfilled: boolean;
  updatedCount: number;
}

/**
 * Backfill otomatis `outstandPostId` untuk `PublishingPost` berstatus
 * Imported yang dibuat SEBELUM fix T-113 (T-114, perluasan T-113/KI-090) —
 * use-case terpisah dari `ImportPostsProcessUseCase` (pola sama pemisahan
 * trigger/process JOB-05 vs JOB-06) karena tanggung jawabnya beda: bukan
 * memproses hasil import BARU, melainkan MENAMBAL baris LAMA yang sudah
 * ada sebelum `outstandPostId` pernah disimpan.
 *
 * **Keputusan "mekanisme permanen, bukan script one-off" (King Rezi,
 * 2026-10-15):** dipanggil otomatis SETIAP `ImportPostsTriggerUseCase.
 * runImportSync` (manual "Sync Now" MAUPUN periodik) untuk SATU
 * `connectedAccountId` — lihat wiring-nya di `ImportPostsTriggerUseCase.
 * attemptBackfill`. Cek existence murah (`hasImportedPostsMissingOutstandId`,
 * satu query) SELALU dijalankan lebih dulu; `IOutstandAdapter.
 * fetchAllPostIdMappings` (panggilan Outstand yang menanyakan ULANG
 * seluruh riwayat akun, bukan window `since`/`until` biasa) HANYA
 * dipanggil kalau existence check menemukan gap — begitu satu kali
 * berhasil menutup gap-nya, sync berikutnya untuk akun yang sama tidak
 * pernah kena biaya panggilan tambahan ini lagi.
 */
export class BackfillOutstandPostIdsUseCase {
  constructor(
    private readonly repository: IPublishingRepository,
    private readonly outstandAdapter: IOutstandAdapter,
  ) {}

  async backfillIfNeeded(
    input: BackfillOutstandPostIdsInput,
  ): Promise<BackfillOutstandPostIdsResult> {
    const hasGap = await this.repository.hasImportedPostsMissingOutstandId(
      {
        workspaceId: input.workspaceId,
        connectedAccountId: input.connectedAccountId,
      },
      input.actingUserId,
    );
    if (!hasGap) {
      return { backfilled: false, updatedCount: 0 };
    }

    const mappings = await this.outstandAdapter.fetchAllPostIdMappings(
      input.outstandAccountId,
    );
    if (mappings.length === 0) {
      // Outstand tidak mengembalikan satu pun mapping yang bisa dipakai
      // (akun baru/kosong, atau drift shape API) — tidak ada apa pun untuk
      // di-backfill sekarang; `hasImportedPostsMissingOutstandId` akan tetap
      // `true` sampai ada mapping yang cocok di sync berikutnya, BUKAN
      // dianggap "sudah selesai" secara keliru (tidak menulis apa pun yang
      // bisa membuat gap ini tampak tertutup padahal belum).
      return { backfilled: false, updatedCount: 0 };
    }

    const result = await this.repository.backfillImportedPostOutstandIds(
      {
        workspaceId: input.workspaceId,
        connectedAccountId: input.connectedAccountId,
        mappings,
      },
      input.actingUserId,
    );

    return { backfilled: true, updatedCount: result.updatedCount };
  }
}
