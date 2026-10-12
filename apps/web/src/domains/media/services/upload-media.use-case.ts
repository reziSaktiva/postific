import type { UserId, WorkspaceId } from "@postific/shared";
import { ValidationError } from "@/lib/utils/errors";
import type { IMediaStorageAdapter } from "../adapters/media-storage-adapter";
import type { IMediaRepository } from "../repositories/media.repository";
import type { MediaItemRecord } from "../types";
import {
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_MEDIA_FILE_SIZE_BYTES,
} from "../validation";

export interface UploadMediaUseCaseInput {
  workspaceId: WorkspaceId;
  uploaderId: UserId;
  filename: string;
  mimeType: string;
  fileBuffer: Buffer;
  /** RLS (pola sama `SchedulePostsUseCase`) — acting user for `withCurrentUser`, biasanya sama dengan `uploaderId`. */
  actingUserId: UserId;
}

/**
 * Use-case terpisah dari `MediaService` (bukan method di dalamnya), pola
 * sama `SchedulePostsUseCase` (ADR-059 precedent): constructor MEWAJIBKAN
 * `IMediaStorageAdapter` secara tipe, supaya lupa pass adapter di call site
 * baru langsung ketahuan TypeScript, bukan cuma runtime throw — dan supaya
 * constructor `MediaService` tetap sederhana untuk CRUD record murni
 * (`MediaService` sendiri tidak tahu apa-apa soal Supabase Storage).
 *
 * Urutan kritis: upload fisik ke Supabase Storage DULU, baru persist record
 * DB (`IMediaRepository.create`) — kebalikan dari `SchedulePostsUseCase`
 * (yang persist DB dulu baru panggil adapter eksternal) karena di sini
 * record DB tidak valid tanpa `storagePath` yang hanya didapat SETELAH
 * upload sukses; tidak ada "record orphan" yang mungkin dibuat kalau upload
 * gagal — cukup jangan buat record sama sekali.
 *
 * Kalau create record GAGAL setelah upload SUKSES: best-effort cleanup
 * (hapus file yatim di Storage), pola identik
 * `IdentityService.updateProfile` (identity/services/identity.service.ts)
 * — kegagalan cleanup tidak boleh menutupi error asli (di-swallow via
 * `.catch(() => {})`), error DB asli tetap dilempar ke caller.
 */
export class UploadMediaUseCase {
  constructor(
    private readonly repository: IMediaRepository,
    private readonly mediaStorage: IMediaStorageAdapter,
  ) {}

  async execute(input: UploadMediaUseCaseInput): Promise<MediaItemRecord> {
    const meta = ALLOWED_MEDIA_MIME_TYPES[input.mimeType];
    if (!meta) {
      throw new ValidationError(`Tipe file tidak didukung: ${input.mimeType}.`);
    }

    if (input.fileBuffer.byteLength > MAX_MEDIA_FILE_SIZE_BYTES) {
      throw new ValidationError(
        `Ukuran file (${input.fileBuffer.byteLength} bytes) melebihi batas maksimum ${MAX_MEDIA_FILE_SIZE_BYTES} bytes (50 MB).`,
      );
    }

    const uploaded = await this.mediaStorage.uploadMedia({
      workspaceId: input.workspaceId,
      fileBuffer: input.fileBuffer,
      contentType: input.mimeType,
      extension: meta.extension,
    });

    try {
      return await this.repository.create(
        {
          workspaceId: input.workspaceId,
          uploaderId: input.uploaderId,
          filename: input.filename,
          mimeType: input.mimeType,
          size: BigInt(input.fileBuffer.byteLength),
          storagePath: uploaded.storagePath,
          type: meta.type,
          url: uploaded.url || undefined,
        },
        input.actingUserId,
      );
    } catch (error) {
      await this.mediaStorage.deleteMedia(uploaded.storagePath).catch(() => {});
      throw error;
    }
  }
}
