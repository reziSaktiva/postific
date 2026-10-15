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
 * dipanggil kalau existence check menemukan gap. Baris yang terisi, dan
 * baris yang tidak bisa diisi (ditandai `outstandIdBackfillSkippedAt`),
 * keluar dari cek itu — sync berikutnya untuk akun yang sama tidak kena
 * biaya panggilan tambahan ini lagi. Riwayat yang terbaca sampai habis
 * dengan shape yang dikenali menandai baris yang tidak cocok, termasuk
 * kalau tidak ada satupun post published (akun kosong atau semua post
 * sudah tidak tayang). Scan yang terpotong atau shape-nya tidak dikenali
 * TIDAK menandai baris itu — gap tetap terbuka untuk sync berikutnya.
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

    const history = await this.outstandAdapter.fetchAllPostIdMappings(
      input.outstandAccountId,
    );
    // Scan terpotong atau shape tidak dikenali: jangan anggap baris yang
    // tidak muncul sebagai "memang tidak ada". Mapping kosong dalam kasus
    // itu juga bukan bukti riwayat habis — gap tetap terbuka.
    const settleUnmatched = history.complete && !history.shapeDrift;
    if (history.mappings.length === 0 && !settleUnmatched) {
      return { backfilled: false, updatedCount: 0 };
    }

    const result = await this.repository.backfillImportedPostOutstandIds(
      {
        workspaceId: input.workspaceId,
        connectedAccountId: input.connectedAccountId,
        mappings: history.mappings,
        settleUnmatched,
      },
      input.actingUserId,
    );

    return { backfilled: true, updatedCount: result.updatedCount };
  }
}
