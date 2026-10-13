import {
  asMediaId,
  asUserId,
  asWorkspaceId,
  MediaType,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import { NotFoundError } from "@/lib/utils/errors";
import type { IMediaStorageAdapter } from "../adapters/media-storage-adapter";
import type { IMediaRepository } from "../repositories/media.repository";
import type { MediaItemRecord } from "../types";
import { MediaService } from "./media.service";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const UPLOADER_ID = asUserId("user-1");
const MEDIA_ID = asMediaId("media-1");

function createRecord(
  overrides: Partial<MediaItemRecord> = {},
): MediaItemRecord {
  return {
    id: MEDIA_ID,
    workspaceId: WORKSPACE_ID,
    uploaderId: UPLOADER_ID,
    filename: "photo.jpg",
    mimeType: "image/jpeg",
    size: BigInt(1024),
    url: null,
    storagePath: "workspace-1/photo.jpg",
    outstandMediaId: null,
    outstandMediaUrl: null,
    outstandUploadedAt: null,
    outstandExpiresAt: null,
    type: MediaType.Image,
    width: 800,
    height: 600,
    duration: null,
    createdAt: new Date("2026-09-14T00:00:00Z"),
    ...overrides,
  };
}

function createFakeRepository(
  overrides: Partial<IMediaRepository> = {},
): IMediaRepository {
  return {
    create: async () => createRecord(),
    findById: async () => null,
    findByWorkspace: async () => [],
    findByIds: async () => [],
    delete: async () => null,
    saveOutstandWorkingCopy: async () => undefined,
    ...overrides,
  };
}

function createFakeStorageAdapter(
  overrides: Partial<IMediaStorageAdapter> = {},
): IMediaStorageAdapter {
  return {
    uploadMedia: async () => ({
      url: "https://storage.example/upload-signed-url",
      storagePath: "workspace-1/photo.jpg",
    }),
    deleteMedia: async () => undefined,
    downloadMedia: async () => Buffer.from(""),
    getSignedUrl: async (storagePath) =>
      `https://storage.example/fresh?path=${storagePath}`,
    ...overrides,
  };
}

describe("MediaService", () => {
  it("createMediaItem() delegates to repository.create() and returns the created record", async () => {
    let captured: Parameters<IMediaRepository["create"]>[0] | null = null;
    const repository = createFakeRepository({
      create: async (input) => {
        captured = input;
        return createRecord({ filename: input.filename });
      },
    });
    const service = new MediaService(repository);

    const result = await service.createMediaItem(
      {
        workspaceId: WORKSPACE_ID,
        uploaderId: UPLOADER_ID,
        filename: "photo.jpg",
        mimeType: "image/jpeg",
        size: BigInt(1024),
        storagePath: "workspace-1/photo.jpg",
        type: MediaType.Image,
        width: 800,
        height: 600,
      },
      UPLOADER_ID,
    );

    expect(captured).toEqual({
      workspaceId: WORKSPACE_ID,
      uploaderId: UPLOADER_ID,
      filename: "photo.jpg",
      mimeType: "image/jpeg",
      size: BigInt(1024),
      storagePath: "workspace-1/photo.jpg",
      type: MediaType.Image,
      width: 800,
      height: 600,
    });
    expect(result.id).toBe(MEDIA_ID);
    expect(result.filename).toBe("photo.jpg");
  });

  it("getMediaItem() returns the record when found", async () => {
    const repository = createFakeRepository({
      findById: async () => createRecord(),
    });
    const service = new MediaService(repository);

    const result = await service.getMediaItem(
      { workspaceId: WORKSPACE_ID, mediaId: MEDIA_ID },
      UPLOADER_ID,
    );

    expect(result.id).toBe(MEDIA_ID);
  });

  it("getMediaItem() throws NotFoundError when repository returns null (not found or wrong workspace)", async () => {
    const repository = createFakeRepository({ findById: async () => null });
    const service = new MediaService(repository);

    await expect(
      service.getMediaItem(
        { workspaceId: WORKSPACE_ID, mediaId: MEDIA_ID },
        UPLOADER_ID,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("listMediaItems() delegates to repository.findByWorkspace()", async () => {
    const records = [
      createRecord(),
      createRecord({ id: asMediaId("media-2") }),
    ];
    const repository = createFakeRepository({
      findByWorkspace: async () => records,
    });
    const service = new MediaService(repository);

    const result = await service.listMediaItems(
      { workspaceId: WORKSPACE_ID },
      UPLOADER_ID,
    );

    expect(result).toHaveLength(2);
  });

  it("deleteMediaItem() returns the deleted record when found", async () => {
    const repository = createFakeRepository({
      delete: async () => createRecord(),
    });
    const service = new MediaService(repository);

    const result = await service.deleteMediaItem(
      { workspaceId: WORKSPACE_ID, mediaId: MEDIA_ID },
      UPLOADER_ID,
    );

    expect(result.id).toBe(MEDIA_ID);
  });

  it("deleteMediaItem() throws NotFoundError when repository returns null (not found or wrong workspace)", async () => {
    const repository = createFakeRepository({ delete: async () => null });
    const service = new MediaService(repository);

    await expect(
      service.deleteMediaItem(
        { workspaceId: WORKSPACE_ID, mediaId: MEDIA_ID },
        UPLOADER_ID,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("listByIds() returns [] without calling the repository when mediaIds is empty", async () => {
    let called = false;
    const repository = createFakeRepository({
      findByIds: async () => {
        called = true;
        return [createRecord()];
      },
    });
    const service = new MediaService(repository);

    const result = await service.listByIds(
      { workspaceId: WORKSPACE_ID, mediaIds: [] },
      UPLOADER_ID,
    );

    expect(result).toEqual([]);
    expect(called).toBe(false);
  });

  it("listByIds() delegates to repository.findByIds() when mediaIds is non-empty", async () => {
    const records = [
      createRecord(),
      createRecord({ id: asMediaId("media-2") }),
    ];
    const repository = createFakeRepository({
      findByIds: async () => records,
    });
    const service = new MediaService(repository);

    const result = await service.listByIds(
      { workspaceId: WORKSPACE_ID, mediaIds: [MEDIA_ID, asMediaId("media-2")] },
      UPLOADER_ID,
    );

    expect(result).toHaveLength(2);
  });

  // Bug fix QA T-056 (2026-10-06): `url` yang di-cache di DB sejak upload
  // expired setelah 1 jam (`SIGNED_URL_EXPIRES_IN_SECONDS`) — thumbnail
  // broken di mana pun media ditampilkan lama setelah upload (Comments
  // Inbox "Post asal", draft editor dibuka lagi). Fix: `MediaService`
  // SELALU meregenerate `url` dari `storagePath` lewat
  // `storageAdapter.getSignedUrl` saat `storageAdapter` disuplai.
  describe("regenerate url dari storagePath (bug fix QA T-056, 2026-10-06)", () => {
    it("getMediaItem() mengembalikan url yang diregenerate, bukan url cache dari repository", async () => {
      const repository = createFakeRepository({
        findById: async () =>
          createRecord({ url: "https://storage.example/expired" }),
      });
      const storageAdapter = createFakeStorageAdapter();
      const service = new MediaService(repository, storageAdapter);

      const result = await service.getMediaItem(
        { workspaceId: WORKSPACE_ID, mediaId: MEDIA_ID },
        UPLOADER_ID,
      );

      expect(result.url).toBe(
        "https://storage.example/fresh?path=workspace-1/photo.jpg",
      );
    });

    it("listByIds() meregenerate url tiap item memakai storagePath masing-masing", async () => {
      const records = [
        createRecord({
          url: "https://storage.example/expired-1",
          storagePath: "workspace-1/a.jpg",
        }),
        createRecord({
          id: asMediaId("media-2"),
          url: "https://storage.example/expired-2",
          storagePath: "workspace-1/b.jpg",
        }),
      ];
      const repository = createFakeRepository({
        findByIds: async () => records,
      });
      const storageAdapter = createFakeStorageAdapter();
      const service = new MediaService(repository, storageAdapter);

      const result = await service.listByIds(
        {
          workspaceId: WORKSPACE_ID,
          mediaIds: [MEDIA_ID, asMediaId("media-2")],
        },
        UPLOADER_ID,
      );

      expect(result.map((item) => item.url)).toEqual([
        "https://storage.example/fresh?path=workspace-1/a.jpg",
        "https://storage.example/fresh?path=workspace-1/b.jpg",
      ]);
    });

    it("listByIds() mengembalikan url: null untuk item yang gagal diregenerate, tanpa menggagalkan item lain", async () => {
      const records = [
        createRecord({ storagePath: "workspace-1/ok.jpg" }),
        createRecord({
          id: asMediaId("media-2"),
          storagePath: "workspace-1/missing.jpg",
        }),
      ];
      const repository = createFakeRepository({
        findByIds: async () => records,
      });
      const storageAdapter = createFakeStorageAdapter({
        getSignedUrl: async (storagePath) => {
          if (storagePath === "workspace-1/missing.jpg") {
            throw new Error("file tidak ditemukan di Storage");
          }
          return `https://storage.example/fresh?path=${storagePath}`;
        },
      });
      const service = new MediaService(repository, storageAdapter);

      const result = await service.listByIds(
        {
          workspaceId: WORKSPACE_ID,
          mediaIds: [MEDIA_ID, asMediaId("media-2")],
        },
        UPLOADER_ID,
      );

      expect(result[0].url).toBe(
        "https://storage.example/fresh?path=workspace-1/ok.jpg",
      );
      expect(result[1].url).toBeNull();
    });

    it("listByIds() tidak memanggil storageAdapter kalau tidak disuplai (backward compatible, url apa adanya dari repository)", async () => {
      const repository = createFakeRepository({
        findByIds: async () => [
          createRecord({ url: "https://storage.example/cached" }),
        ],
      });
      const service = new MediaService(repository);

      const result = await service.listByIds(
        { workspaceId: WORKSPACE_ID, mediaIds: [MEDIA_ID] },
        UPLOADER_ID,
      );

      expect(result[0].url).toBe("https://storage.example/cached");
    });

    it("listMediaItems() meregenerate url tiap item juga", async () => {
      const records = [createRecord({ storagePath: "workspace-1/x.jpg" })];
      const repository = createFakeRepository({
        findByWorkspace: async () => records,
      });
      const storageAdapter = createFakeStorageAdapter();
      const service = new MediaService(repository, storageAdapter);

      const result = await service.listMediaItems(
        { workspaceId: WORKSPACE_ID },
        UPLOADER_ID,
      );

      expect(result[0].url).toBe(
        "https://storage.example/fresh?path=workspace-1/x.jpg",
      );
    });
  });

  // T-111.4: varian multi-item dari `resolveFirstThumbnail`, dipakai kartu
  // "Post asal" carousel (T-111.3) yang perlu SEMUA media, bukan cuma yang
  // pertama.
  describe("resolveThumbnails() (T-111.4)", () => {
    it("mengembalikan [] tanpa memanggil repository kalau mediaIds kosong", async () => {
      let called = false;
      const repository = createFakeRepository({
        findByIds: async () => {
          called = true;
          return [];
        },
      });
      const service = new MediaService(repository);

      const result = await service.resolveThumbnails(
        { workspaceId: WORKSPACE_ID, mediaIds: [] },
        UPLOADER_ID,
      );

      expect(result).toEqual([]);
      expect(called).toBe(false);
    });

    it("resolve seluruh mediaIds jadi array {url, type}, bukan cuma yang pertama", async () => {
      const mediaId2 = asMediaId("media-2");
      const records = [
        createRecord({
          url: "https://storage.example/expired-1",
          storagePath: "workspace-1/a.jpg",
          type: MediaType.Image,
        }),
        createRecord({
          id: mediaId2,
          url: "https://storage.example/expired-2",
          storagePath: "workspace-1/b.mp4",
          type: MediaType.Video,
        }),
      ];
      const repository = createFakeRepository({
        findByIds: async () => records,
      });
      const storageAdapter = createFakeStorageAdapter();
      const service = new MediaService(repository, storageAdapter);

      const result = await service.resolveThumbnails(
        { workspaceId: WORKSPACE_ID, mediaIds: [MEDIA_ID, mediaId2] },
        UPLOADER_ID,
      );

      expect(result).toEqual([
        {
          url: "https://storage.example/fresh?path=workspace-1/a.jpg",
          type: MediaType.Image,
        },
        {
          url: "https://storage.example/fresh?path=workspace-1/b.mp4",
          type: MediaType.Video,
        },
      ]);
    });

    it("skip item yang gagal diresolve (url null), tanpa menggagalkan item lain", async () => {
      const mediaId2 = asMediaId("media-2");
      const records = [
        createRecord({ storagePath: "workspace-1/ok.jpg" }),
        createRecord({ id: mediaId2, storagePath: "workspace-1/missing.jpg" }),
      ];
      const repository = createFakeRepository({
        findByIds: async () => records,
      });
      const storageAdapter = createFakeStorageAdapter({
        getSignedUrl: async (storagePath) => {
          if (storagePath === "workspace-1/missing.jpg") {
            throw new Error("file tidak ditemukan di Storage");
          }
          return `https://storage.example/fresh?path=${storagePath}`;
        },
      });
      const service = new MediaService(repository, storageAdapter);

      const result = await service.resolveThumbnails(
        { workspaceId: WORKSPACE_ID, mediaIds: [MEDIA_ID, mediaId2] },
        UPLOADER_ID,
      );

      expect(result).toEqual([
        {
          url: "https://storage.example/fresh?path=workspace-1/ok.jpg",
          type: MediaType.Image,
        },
      ]);
    });

    it("mengembalikan [] (bukan throw) kalau listByIds sendiri gagal", async () => {
      const repository = createFakeRepository({
        findByIds: async () => {
          throw new Error("DB error");
        },
      });
      const service = new MediaService(repository);

      const result = await service.resolveThumbnails(
        { workspaceId: WORKSPACE_ID, mediaIds: [MEDIA_ID] },
        UPLOADER_ID,
      );

      expect(result).toEqual([]);
    });
  });
});
