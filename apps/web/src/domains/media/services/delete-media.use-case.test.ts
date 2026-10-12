import {
  asMediaId,
  asUserId,
  asWorkspaceId,
  MediaType,
} from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/utils/errors";
import type { IMediaStorageAdapter } from "../adapters/media-storage-adapter";
import type { IMediaRepository } from "../repositories/media.repository";
import type { MediaItemRecord } from "../types";
import { DeleteMediaUseCase } from "./delete-media.use-case";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const USER_ID = asUserId("user-1");
const MEDIA_ID = asMediaId("media-1");
const STORAGE_PATH = `${WORKSPACE_ID}/2026/09/uuid.jpg`;

function fakeRecord(overrides: Partial<MediaItemRecord> = {}): MediaItemRecord {
  return {
    id: MEDIA_ID,
    workspaceId: WORKSPACE_ID,
    uploaderId: USER_ID,
    filename: "photo.jpg",
    mimeType: "image/jpeg",
    size: BigInt(1024),
    url: "https://storage.example/signed-url",
    storagePath: STORAGE_PATH,
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
    delete: async () => fakeRecord(),
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
      storagePath: STORAGE_PATH,
    }),
    deleteMedia: async () => undefined,
    downloadMedia: async () => Buffer.from(""),
    getSignedUrl: async () => "https://storage.example/signed-url",
    ...overrides,
  };
}

describe("DeleteMediaUseCase.execute", () => {
  const baseInput = { workspaceId: WORKSPACE_ID, mediaId: MEDIA_ID };

  it("happy path: deletes the DB record first, then best-effort deletes the storage file using its storagePath", async () => {
    const calls: string[] = [];
    const deleteRecord = vi.fn(async () => {
      calls.push("db");
      return fakeRecord();
    });
    const deleteMedia = vi.fn(async () => {
      calls.push("storage");
    });

    const useCase = new DeleteMediaUseCase(
      createFakeRepository({ delete: deleteRecord }),
      createFakeMediaStorage({ deleteMedia }),
    );

    await useCase.execute(baseInput, USER_ID);

    expect(deleteRecord).toHaveBeenCalledWith(baseInput, USER_ID);
    expect(deleteMedia).toHaveBeenCalledWith(STORAGE_PATH);
    expect(calls).toEqual(["db", "storage"]);
  });

  it("record not found (or not owned by this workspace): throws NotFoundError WITHOUT touching storage at all", async () => {
    const deleteMedia = vi.fn();

    const useCase = new DeleteMediaUseCase(
      createFakeRepository({ delete: async () => null }),
      createFakeMediaStorage({ deleteMedia: deleteMedia as never }),
    );

    await expect(useCase.execute(baseInput, USER_ID)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(deleteMedia).not.toHaveBeenCalled();
  });

  it("storage delete fails after DB delete succeeded: does NOT throw — best-effort, swallowed", async () => {
    const useCase = new DeleteMediaUseCase(
      createFakeRepository({ delete: async () => fakeRecord() }),
      createFakeMediaStorage({
        deleteMedia: async () => {
          throw new Error("storage down");
        },
      }),
    );

    await expect(useCase.execute(baseInput, USER_ID)).resolves.toBeUndefined();
  });
});
