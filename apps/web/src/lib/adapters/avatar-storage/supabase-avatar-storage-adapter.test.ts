import { beforeEach, describe, expect, it, vi } from "vitest";

const { upload, getPublicUrl, remove, from, createServerSupabaseClient } =
  vi.hoisted(() => {
    const upload = vi.fn();
    const getPublicUrl = vi.fn();
    const remove = vi.fn();
    const from = vi.fn(() => ({ upload, getPublicUrl, remove }));
    const createServerSupabaseClient = vi.fn(() => ({
      storage: { from },
    }));
    return { upload, getPublicUrl, remove, from, createServerSupabaseClient };
  });

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));

import { ExternalServiceError } from "@/lib/utils/errors";
import { supabaseAvatarStorageAdapter } from "./supabase-avatar-storage-adapter";

describe("supabaseAvatarStorageAdapter", () => {
  beforeEach(() => {
    upload.mockReset();
    getPublicUrl.mockReset();
    remove.mockReset();
    from.mockClear();
    createServerSupabaseClient.mockClear();
    vi.useRealTimers();
  });

  describe("uploadAvatar()", () => {
    it("uploads to the `avatars` bucket at users/{userId}/avatar.{extension} with upsert, and returns a cache-busted public URL", async () => {
      upload.mockResolvedValue({ error: null });
      getPublicUrl.mockReturnValue({
        data: {
          publicUrl: "https://cdn.example/avatars/users/user-1/avatar.jpg",
        },
      });
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-13T00:00:00Z"));

      const result = await supabaseAvatarStorageAdapter.uploadAvatar({
        userId: "user-1" as never,
        fileBuffer: Buffer.from("fake-bytes"),
        contentType: "image/jpeg",
        extension: "jpg",
      });

      expect(from).toHaveBeenCalledWith("avatars");
      expect(upload).toHaveBeenCalledWith(
        "users/user-1/avatar.jpg",
        expect.any(Buffer),
        { contentType: "image/jpeg", upsert: true },
      );
      expect(result.url).toBe(
        `https://cdn.example/avatars/users/user-1/avatar.jpg?v=${Date.now()}`,
      );
    });

    it("throws ExternalServiceError when Supabase Storage returns an upload error, without the provider message", async () => {
      upload.mockResolvedValue({ error: { message: "bucket not found" } });

      let caught: unknown;
      try {
        await supabaseAvatarStorageAdapter.uploadAvatar({
          userId: "user-1" as never,
          fileBuffer: Buffer.from("fake-bytes"),
          contentType: "image/png",
          extension: "png",
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ExternalServiceError);
      expect((caught as Error).message).toBe("Gagal upload avatar.");
      expect((caught as Error).message).not.toContain("bucket not found");
      expect(getPublicUrl).not.toHaveBeenCalled();
    });
  });

  describe("deleteAvatar()", () => {
    it("removes the file at users/{userId}/avatar.{extension} from the `avatars` bucket", async () => {
      remove.mockResolvedValue({ error: null });

      await supabaseAvatarStorageAdapter.deleteAvatar({
        userId: "user-1" as never,
        extension: "png",
      });

      expect(from).toHaveBeenCalledWith("avatars");
      expect(remove).toHaveBeenCalledWith(["users/user-1/avatar.png"]);
    });

    it("does not throw when Supabase Storage returns an error (best-effort cleanup)", async () => {
      remove.mockResolvedValue({ error: { message: "not found" } });

      await expect(
        supabaseAvatarStorageAdapter.deleteAvatar({
          userId: "user-1" as never,
          extension: "png",
        }),
      ).resolves.toBeUndefined();
    });
  });
});
