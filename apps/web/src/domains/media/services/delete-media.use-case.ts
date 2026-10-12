import type { MediaId, UserId, WorkspaceId } from "@postific/shared";
import type { IMediaStorageAdapter } from "../adapters/media-storage-adapter";
import type { IMediaRepository } from "../repositories/media.repository";
import { MediaService } from "./media.service";

export interface DeleteMediaUseCaseInput {
  workspaceId: WorkspaceId;
  mediaId: MediaId;
}

/**
 * Use-case terpisah dari `MediaService` (bukan method di dalamnya), pola
 * sama `UploadMediaUseCase`: constructor mewajibkan `IMediaStorageAdapter`
 * secara tipe, supaya lupa pass adapter di call site baru langsung
 * ketahuan TypeScript, bukan cuma runtime throw.
 *
 * Delete PERMANEN (T-024.5, ADR-049 Tier 2) — bukan lagi "unlink dari post
 * ini saja" seperti perilaku lama di client (`Modal.tsx` sebelum T-024.5).
 *
 * Urutan operasi SENGAJA dibalik dari `UploadMediaUseCase` (upload dulu,
 * baru persist DB): di sini record DB dihapus DULU (`MediaService.
 * deleteMediaItem`, throws `NotFoundError` kalau tidak ada/bukan milik
 * workspace ini — storage TIDAK disentuh sama sekali kalau ini gagal),
 * BARU best-effort hapus file fisik di Storage memakai `storagePath` dari
 * record yang baru dihapus. Alasan konsistensi: kalau salah satu langkah
 * gagal secara parsial, orphan file di Storage tanpa record DB itu
 * harmless (tidak pernah muncul lagi ke user, tidak ada yang mengarah ke
 * situ) — dibanding urutan sebaliknya (Storage dulu) yang bisa
 * meninggalkan record DB yang menunjuk ke file yang sudah hilang, yaitu
 * kondisi broken yang justru user-visible (thumbnail rusak). Ini juga
 * konsisten dengan catatan di `MediaService.deleteMediaItem` sendiri
 * ("hapus record DB dulu, lalu best-effort hapus file Storage").
 *
 * Kegagalan `deleteMedia` (Storage) SENGAJA di-swallow (`.catch(() => {})`)
 * — dari sisi use-case ini tetap dianggap sukses karena data DB (source of
 * truth yang user-visible) sudah konsisten; file yatim di Storage bisa
 * dibersihkan lewat proses terpisah nanti kalau perlu, tidak menutupi
 * suksesnya penghapusan record dari sisi caller/UI.
 */
export class DeleteMediaUseCase {
  private readonly mediaService: MediaService;

  constructor(
    repository: IMediaRepository,
    private readonly mediaStorage: IMediaStorageAdapter,
  ) {
    this.mediaService = new MediaService(repository);
  }

  async execute(input: DeleteMediaUseCaseInput, userId: UserId): Promise<void> {
    const deleted = await this.mediaService.deleteMediaItem(input, userId);

    await this.mediaStorage.deleteMedia(deleted.storagePath).catch(() => {});
  }
}
