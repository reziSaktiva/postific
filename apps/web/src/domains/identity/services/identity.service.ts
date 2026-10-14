import type { UserId } from "@postific/shared";
import { ValidationError } from "@/lib/utils/errors";

import type { IAvatarStorageAdapter } from "../adapters/avatar-storage-adapter";
import type { IIdentityRepository } from "../repositories/identity.repository";
import type {
  NotificationPreferencesRecord,
  UserProfileRecord,
} from "../types";
import {
  ALLOWED_AVATAR_MIME_TYPES,
  MAX_AVATAR_BYTES,
  MAX_NAME_LENGTH,
  parseNotificationPreferences,
} from "../validation";

export interface UpdateProfileInput {
  userId: UserId;
  name: string;
  /** `null`/`undefined` = tidak ganti avatar. */
  avatarFile?: { buffer: Buffer; contentType: string } | null;
}

export class IdentityService {
  constructor(
    private readonly repository: IIdentityRepository,
    private readonly avatarStorage: IAvatarStorageAdapter,
  ) {}

  async getProfile(userId: UserId): Promise<UserProfileRecord | null> {
    return this.repository.findById(userId);
  }

  /**
   * Scope T-016.2: hanya nama + avatar. Email tetap read-only — tidak ada
   * parameter email di sini secara sengaja (tidak ada flow ganti email).
   */
  async updateProfile(input: UpdateProfileInput): Promise<UserProfileRecord> {
    const name = input.name.trim();

    if (!name) {
      throw new ValidationError("Nama wajib diisi.");
    }
    if (name.length > MAX_NAME_LENGTH) {
      throw new ValidationError(`Nama maksimal ${MAX_NAME_LENGTH} karakter.`);
    }

    let image: string | undefined;
    let uploadedAvatarExtension: string | undefined;

    if (input.avatarFile) {
      const extension = ALLOWED_AVATAR_MIME_TYPES[input.avatarFile.contentType];
      if (!extension) {
        throw new ValidationError("Format avatar harus JPG atau PNG.");
      }
      if (input.avatarFile.buffer.byteLength > MAX_AVATAR_BYTES) {
        throw new ValidationError("Ukuran avatar maksimal 2MB.");
      }

      const uploaded = await this.avatarStorage.uploadAvatar({
        userId: input.userId,
        fileBuffer: input.avatarFile.buffer,
        contentType: input.avatarFile.contentType,
        extension,
      });
      image = uploaded.url;
      uploadedAvatarExtension = extension;
    }

    try {
      return await this.repository.updateProfile(input.userId, { name, image });
    } catch (error) {
      if (uploadedAvatarExtension) {
        // Upload sudah sukses tapi DB write gagal — bersihkan file yatim
        // (best-effort; kegagalan cleanup tidak boleh menutupi error asli).
        await this.avatarStorage
          .deleteAvatar({
            userId: input.userId,
            extension: uploadedAvatarExtension,
          })
          .catch(() => {});
      }
      throw error;
    }
  }

  /** T-016.4: `null` = user tidak ditemukan. */
  async getNotificationPreferences(
    userId: UserId,
  ): Promise<NotificationPreferencesRecord | null> {
    return this.repository.findNotificationPreferences(userId);
  }

  async updateNotificationPreferences(
    userId: UserId,
    preferences: NotificationPreferencesRecord,
  ): Promise<NotificationPreferencesRecord> {
    const parsed = parseNotificationPreferences(preferences);
    return this.repository.updateNotificationPreferences(userId, parsed);
  }
}
