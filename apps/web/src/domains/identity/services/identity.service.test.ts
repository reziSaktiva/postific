import { asUserId } from "@postific/shared";
import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/utils/errors";
import type { IAvatarStorageAdapter } from "../adapters/avatar-storage-adapter";
import type { IIdentityRepository } from "../repositories/identity.repository";
import type { UserProfileRecord } from "../types";
import { MAX_AVATAR_BYTES, MAX_NAME_LENGTH } from "../validation";
import { IdentityService } from "./identity.service";

const USER_ID = asUserId("user-1");

function createRecord(
  overrides: Partial<UserProfileRecord> = {},
): UserProfileRecord {
  return {
    id: USER_ID,
    name: "Raka",
    email: "raka@example.com",
    image: null,
    ...overrides,
  };
}

function createFakeRepository(
  overrides: Partial<IIdentityRepository> = {},
): IIdentityRepository {
  return {
    findById: async () => createRecord(),
    updateProfile: async (userId, data) =>
      createRecord({
        id: userId,
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.image !== undefined ? { image: data.image } : {}),
      }),
    findNotificationPreferences: async () => ({
      notifyRepliesAndMentions: true,
      notifyPublishSchedule: true,
      notifyAnalyticsReport: false,
    }),
    updateNotificationPreferences: async (_userId, data) => data,
    ...overrides,
  };
}

function createFakeAvatarStorage(
  overrides: Partial<IAvatarStorageAdapter> = {},
): IAvatarStorageAdapter {
  return {
    uploadAvatar: async () => ({ url: "https://storage.example/avatar.jpg" }),
    deleteAvatar: async () => undefined,
    ...overrides,
  };
}

describe("IdentityService", () => {
  describe("getProfile()", () => {
    it("delegates to repository.findById() and returns the record", async () => {
      const repository = createFakeRepository({
        findById: async () => createRecord({ name: "Maya" }),
      });
      const service = new IdentityService(
        repository,
        createFakeAvatarStorage(),
      );

      const result = await service.getProfile(USER_ID);

      expect(result?.name).toBe("Maya");
    });

    it("returns null when repository returns null (not found)", async () => {
      const repository = createFakeRepository({ findById: async () => null });
      const service = new IdentityService(
        repository,
        createFakeAvatarStorage(),
      );

      const result = await service.getProfile(USER_ID);

      expect(result).toBeNull();
    });
  });

  describe("updateProfile()", () => {
    it("trims the name and delegates to repository.updateProfile() without avatarFile", async () => {
      let captured: { name?: string; image?: string } | null = null;
      const repository = createFakeRepository({
        updateProfile: async (userId, data) => {
          captured = data;
          return createRecord({ id: userId, name: data.name ?? "" });
        },
      });
      const service = new IdentityService(
        repository,
        createFakeAvatarStorage(),
      );

      const result = await service.updateProfile({
        userId: USER_ID,
        name: "  Sinta  ",
      });

      expect(captured).toEqual({ name: "Sinta", image: undefined });
      expect(result.name).toBe("Sinta");
    });

    it("throws ValidationError when name is empty after trim", async () => {
      const repository = createFakeRepository();
      const service = new IdentityService(
        repository,
        createFakeAvatarStorage(),
      );

      await expect(
        service.updateProfile({ userId: USER_ID, name: "   " }),
      ).rejects.toThrow(ValidationError);
    });

    it(`throws ValidationError when name exceeds ${MAX_NAME_LENGTH} characters`, async () => {
      const repository = createFakeRepository();
      const service = new IdentityService(
        repository,
        createFakeAvatarStorage(),
      );

      await expect(
        service.updateProfile({
          userId: USER_ID,
          name: "a".repeat(MAX_NAME_LENGTH + 1),
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError for an unsupported avatar mime type, without calling avatarStorage", async () => {
      let uploadCalled = false;
      const avatarStorage = createFakeAvatarStorage({
        uploadAvatar: async () => {
          uploadCalled = true;
          return { url: "https://storage.example/avatar.jpg" };
        },
      });
      const service = new IdentityService(
        createFakeRepository(),
        avatarStorage,
      );

      await expect(
        service.updateProfile({
          userId: USER_ID,
          name: "Dimas",
          avatarFile: { buffer: Buffer.from("fake"), contentType: "image/gif" },
        }),
      ).rejects.toThrow(ValidationError);
      expect(uploadCalled).toBe(false);
    });

    it("throws ValidationError when the avatar buffer exceeds the size limit, without calling avatarStorage", async () => {
      let uploadCalled = false;
      const avatarStorage = createFakeAvatarStorage({
        uploadAvatar: async () => {
          uploadCalled = true;
          return { url: "https://storage.example/avatar.jpg" };
        },
      });
      const service = new IdentityService(
        createFakeRepository(),
        avatarStorage,
      );
      const oversizedBuffer = Buffer.alloc(MAX_AVATAR_BYTES + 1);

      await expect(
        service.updateProfile({
          userId: USER_ID,
          name: "Dimas",
          avatarFile: { buffer: oversizedBuffer, contentType: "image/png" },
        }),
      ).rejects.toThrow(ValidationError);
      expect(uploadCalled).toBe(false);
    });

    it("uploads the avatar and passes its url to repository.updateProfile() on the happy path", async () => {
      let captured: { name?: string; image?: string } | null = null;
      const repository = createFakeRepository({
        updateProfile: async (userId, data) => {
          captured = data;
          return createRecord({
            id: userId,
            name: data.name ?? "",
            image: data.image ?? null,
          });
        },
      });
      const avatarStorage = createFakeAvatarStorage({
        uploadAvatar: async () => ({
          url: "https://storage.example/users/user-1/avatar.jpg",
        }),
      });
      const service = new IdentityService(repository, avatarStorage);

      const result = await service.updateProfile({
        userId: USER_ID,
        name: "Lara",
        avatarFile: { buffer: Buffer.from("fake"), contentType: "image/jpeg" },
      });

      expect(captured).toEqual({
        name: "Lara",
        image: "https://storage.example/users/user-1/avatar.jpg",
      });
      expect(result.image).toBe(
        "https://storage.example/users/user-1/avatar.jpg",
      );
    });

    it("cleans up the uploaded avatar (best-effort) when repository.updateProfile() fails after a successful upload", async () => {
      let deleteInput: { userId: string; extension: string } | null = null;
      const repository = createFakeRepository({
        updateProfile: async () => {
          throw new Error("DB write failed");
        },
      });
      const avatarStorage = createFakeAvatarStorage({
        uploadAvatar: async () => ({
          url: "https://storage.example/users/user-1/avatar.png",
        }),
        deleteAvatar: async (input) => {
          deleteInput = input;
        },
      });
      const service = new IdentityService(repository, avatarStorage);

      await expect(
        service.updateProfile({
          userId: USER_ID,
          name: "Raka",
          avatarFile: { buffer: Buffer.from("fake"), contentType: "image/png" },
        }),
      ).rejects.toThrow("DB write failed");
      expect(deleteInput).toEqual({ userId: USER_ID, extension: "png" });
    });

    it("does not swallow the original error even if the best-effort cleanup itself fails", async () => {
      const repository = createFakeRepository({
        updateProfile: async () => {
          throw new Error("DB write failed");
        },
      });
      const avatarStorage = createFakeAvatarStorage({
        uploadAvatar: async () => ({
          url: "https://storage.example/users/user-1/avatar.png",
        }),
        deleteAvatar: async () => {
          throw new Error("cleanup also failed");
        },
      });
      const service = new IdentityService(repository, avatarStorage);

      await expect(
        service.updateProfile({
          userId: USER_ID,
          name: "Raka",
          avatarFile: { buffer: Buffer.from("fake"), contentType: "image/png" },
        }),
      ).rejects.toThrow("DB write failed");
    });

    it("does not attempt avatar cleanup when the failure happens without an avatarFile", async () => {
      let deleteCalled = false;
      const repository = createFakeRepository({
        updateProfile: async () => {
          throw new Error("DB write failed");
        },
      });
      const avatarStorage = createFakeAvatarStorage({
        deleteAvatar: async () => {
          deleteCalled = true;
        },
      });
      const service = new IdentityService(repository, avatarStorage);

      await expect(
        service.updateProfile({ userId: USER_ID, name: "Raka" }),
      ).rejects.toThrow("DB write failed");
      expect(deleteCalled).toBe(false);
    });
  });

  describe("getNotificationPreferences()", () => {
    it("delegates to repository.findNotificationPreferences()", async () => {
      const repository = createFakeRepository({
        findNotificationPreferences: async () => ({
          notifyRepliesAndMentions: false,
          notifyPublishSchedule: true,
          notifyAnalyticsReport: true,
        }),
      });
      const service = new IdentityService(
        repository,
        createFakeAvatarStorage(),
      );

      const result = await service.getNotificationPreferences(USER_ID);

      expect(result).toEqual({
        notifyRepliesAndMentions: false,
        notifyPublishSchedule: true,
        notifyAnalyticsReport: true,
      });
    });

    it("returns null when repository returns null (user not found)", async () => {
      const repository = createFakeRepository({
        findNotificationPreferences: async () => null,
      });
      const service = new IdentityService(
        repository,
        createFakeAvatarStorage(),
      );

      const result = await service.getNotificationPreferences(USER_ID);

      expect(result).toBeNull();
    });
  });

  describe("updateNotificationPreferences()", () => {
    it("delegates to repository.updateNotificationPreferences() with the given payload", async () => {
      let captured: unknown = null;
      const repository = createFakeRepository({
        updateNotificationPreferences: async (userId, data) => {
          captured = { userId, data };
          return data;
        },
      });
      const service = new IdentityService(
        repository,
        createFakeAvatarStorage(),
      );

      const result = await service.updateNotificationPreferences(USER_ID, {
        notifyRepliesAndMentions: false,
        notifyPublishSchedule: false,
        notifyAnalyticsReport: true,
      });

      expect(captured).toEqual({
        userId: USER_ID,
        data: {
          notifyRepliesAndMentions: false,
          notifyPublishSchedule: false,
          notifyAnalyticsReport: true,
        },
      });
      expect(result).toEqual({
        notifyRepliesAndMentions: false,
        notifyPublishSchedule: false,
        notifyAnalyticsReport: true,
      });
    });

    it("drops extra fields and forwards only the three booleans", async () => {
      let captured: unknown = null;
      const repository = createFakeRepository({
        updateNotificationPreferences: async (_userId, data) => {
          captured = data;
          return data;
        },
      });
      const service = new IdentityService(
        repository,
        createFakeAvatarStorage(),
      );

      await service.updateNotificationPreferences(USER_ID, {
        notifyRepliesAndMentions: true,
        notifyPublishSchedule: false,
        notifyAnalyticsReport: true,
        email: "lain@example.com",
      } as never);

      expect(captured).toEqual({
        notifyRepliesAndMentions: true,
        notifyPublishSchedule: false,
        notifyAnalyticsReport: true,
      });
    });

    it.each([
      ["a field is not a boolean", { notifyRepliesAndMentions: "true" }],
      [
        "a field is missing",
        { notifyPublishSchedule: true, notifyAnalyticsReport: false },
      ],
      ["the payload is null", null],
    ])(
      "throws ValidationError and does not write when %s",
      async (_label, payload) => {
        let called = false;
        const repository = createFakeRepository({
          updateNotificationPreferences: async (_userId, data) => {
            called = true;
            return data;
          },
        });
        const service = new IdentityService(
          repository,
          createFakeAvatarStorage(),
        );

        await expect(
          service.updateNotificationPreferences(USER_ID, payload as never),
        ).rejects.toThrow(ValidationError);
        expect(called).toBe(false);
      },
    );
  });
});
