import {
  asMediaId,
  asUserId,
  asWorkspaceId,
  MediaType,
} from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "@/lib/utils/errors";
import type { IMediaStorageAdapter } from "../adapters/media-storage-adapter";
import type { IMediaRepository } from "../repositories/media.repository";
import type { MediaItemRecord } from "../types";
import { MAX_MEDIA_FILE_SIZE_BYTES } from "../validation";
import { UploadMediaUseCase } from "./upload-media.use-case";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const UPLOADER_ID = asUserId("user-1");

function fakeRecord(overrides: Partial<MediaItemRecord> = {}): MediaItemRecord {
  return {
    id: asMediaId("media-1"),
    workspaceId: WORKSPACE_ID,
    uploaderId: UPLOADER_ID,
    filename: "photo.jpg",
    mimeType: "image/jpeg",
    size: BigInt(1024),
    url: "https://storage.example/signed-url",
    storagePath: `${WORKSPACE_ID}/2026/09/uuid.jpg`,
    outstandMediaId: null,
    outstandMediaUrl: null,
    outstandUploadedAt: null,
    outstandExpiresAt: null,
    type: MediaType.Image,
    width: null,
    height: null,
    duration: null,
    createdAt: new Date(0),
    ...overrides,
  };
}

function createFakeRepository(
  overrides: Partial<IMediaRepository> = {},
): IMediaRepository {
  return {
    create: async () => fakeRecord(),
    findById: async () => null,
    findByWorkspace: async () => [],
    findByIds: async () => [],
    delete: async () => null,
    saveOutstandWorkingCopy: async () => undefined,
    ...overrides,
  };
}

function createFakeMediaStorage(
  overrides: Partial<IMediaStorageAdapter> = {},
): IMediaStorageAdapter {
  return {
    uploadMedia: async () => ({
      url: "https://storage.example/signed-url",
      storagePath: `${WORKSPACE_ID}/2026/09/uuid.jpg`,
    }),
    deleteMedia: async () => undefined,
    downloadMedia: async () => Buffer.from(""),
    getSignedUrl: async () => "https://storage.example/signed-url",
    ...overrides,
  };
}

describe("UploadMediaUseCase.execute", () => {
  const baseInput = {
    workspaceId: WORKSPACE_ID,
    uploaderId: UPLOADER_ID,
    actingUserId: UPLOADER_ID,
    filename: "photo.jpg",
    mimeType: "image/jpeg",
    fileBuffer: Buffer.from("fake-bytes"),
  };

  it("happy path: uploads to storage then persists the record with storagePath/url from storage", async () => {
    const uploadMedia = vi.fn(async () => ({
      url: "https://storage.example/signed-url",
      storagePath: `${WORKSPACE_ID}/2026/09/uuid.jpg`,
    }));
    const create = vi.fn(async () => fakeRecord());
    const deleteMedia = vi.fn(async () => undefined);

    const useCase = new UploadMediaUseCase(
      createFakeRepository({ create }),
      createFakeMediaStorage({ uploadMedia, deleteMedia }),
    );

    const result = await useCase.execute(baseInput);

    expect(uploadMedia).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      fileBuffer: baseInput.fileBuffer,
      contentType: "image/jpeg",
      extension: "jpg",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        uploaderId: UPLOADER_ID,
        filename: "photo.jpg",
        mimeType: "image/jpeg",
        size: BigInt(baseInput.fileBuffer.byteLength),
        storagePath: `${WORKSPACE_ID}/2026/09/uuid.jpg`,
        type: MediaType.Image,
        url: "https://storage.example/signed-url",
      }),
      UPLOADER_ID,
    );
    expect(deleteMedia).not.toHaveBeenCalled();
    expect(result).toEqual(fakeRecord());
  });

  it("rejects unsupported mime type WITHOUT calling storage at all", async () => {
    const uploadMedia = vi.fn();
    const create = vi.fn();

    const useCase = new UploadMediaUseCase(
      createFakeRepository({ create }),
      createFakeMediaStorage({ uploadMedia: uploadMedia as never }),
    );

    await expect(
      useCase.execute({ ...baseInput, mimeType: "application/pdf" }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(uploadMedia).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects file exceeding 50 MB limit WITHOUT calling storage at all", async () => {
    const uploadMedia = vi.fn();
    const create = vi.fn();

    const useCase = new UploadMediaUseCase(
      createFakeRepository({ create }),
      createFakeMediaStorage({ uploadMedia: uploadMedia as never }),
    );

    const oversizedBuffer = Buffer.alloc(MAX_MEDIA_FILE_SIZE_BYTES + 1);

    await expect(
      useCase.execute({ ...baseInput, fileBuffer: oversizedBuffer }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(uploadMedia).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("upload to storage fails: does NOT create a DB record", async () => {
    const create = vi.fn();

    const useCase = new UploadMediaUseCase(
      createFakeRepository({ create }),
      createFakeMediaStorage({
        uploadMedia: async () => {
          throw new Error("storage down");
        },
      }),
    );

    await expect(useCase.execute(baseInput)).rejects.toThrow("storage down");
    expect(create).not.toHaveBeenCalled();
  });

  it("create record fails after upload succeeded: best-effort cleans up the orphaned file, then rethrows the original error", async () => {
    const deleteMedia = vi.fn(async () => undefined);
    const originalError = new Error("db write failed");

    const useCase = new UploadMediaUseCase(
      createFakeRepository({
        create: async () => {
          throw originalError;
        },
      }),
      createFakeMediaStorage({ deleteMedia }),
    );

    await expect(useCase.execute(baseInput)).rejects.toBe(originalError);
    expect(deleteMedia).toHaveBeenCalledWith(
      `${WORKSPACE_ID}/2026/09/uuid.jpg`,
    );
  });

  it("cleanup itself failing does NOT mask the original DB error", async () => {
    const originalError = new Error("db write failed");

    const useCase = new UploadMediaUseCase(
      createFakeRepository({
        create: async () => {
          throw originalError;
        },
      }),
      createFakeMediaStorage({
        deleteMedia: async () => {
          throw new Error("cleanup also failed");
        },
      }),
    );

    await expect(useCase.execute(baseInput)).rejects.toBe(originalError);
  });
});
