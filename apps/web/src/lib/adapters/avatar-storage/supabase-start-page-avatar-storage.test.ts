import { asWorkspaceId } from "@postific/shared";
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
import { supabaseStartPageAvatarStorage } from "./supabase-start-page-avatar-storage";

const WS = asWorkspaceId("11111111-1111-4111-8111-111111111111");

describe("supabaseStartPageAvatarStorage", () => {
  beforeEach(() => {
    upload.mockReset();
    getPublicUrl.mockReset();
    remove.mockReset();
    from.mockClear();
    createServerSupabaseClient.mockClear();
    vi.useRealTimers();
  });

  it("uploads to avatars/{workspaceId}/avatar.{ext} and returns a cache-busted public URL", async () => {
    upload.mockResolvedValue({ error: null });
    getPublicUrl.mockReturnValue({
      data: {
        publicUrl: `https://cdn.example/avatars/${WS}/avatar.jpg`,
      },
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T00:00:00Z"));

    const result = await supabaseStartPageAvatarStorage.uploadAvatar({
      workspaceId: WS,
      fileBuffer: Buffer.from("fake-bytes"),
      contentType: "image/jpeg",
      extension: "jpg",
    });

    expect(from).toHaveBeenCalledWith("avatars");
    expect(upload).toHaveBeenCalledWith(
      `${WS}/avatar.jpg`,
      expect.any(Buffer),
      { contentType: "image/jpeg", upsert: true },
    );
    expect(result.url).toBe(
      `https://cdn.example/avatars/${WS}/avatar.jpg?v=${Date.now()}`,
    );
  });

  it("throws ExternalServiceError without the provider message", async () => {
    upload.mockResolvedValue({ error: { message: "bucket not found" } });

    await expect(
      supabaseStartPageAvatarStorage.uploadAvatar({
        workspaceId: WS,
        fileBuffer: Buffer.from("fake-bytes"),
        contentType: "image/png",
        extension: "png",
      }),
    ).rejects.toThrow(ExternalServiceError);
    await expect(
      supabaseStartPageAvatarStorage.uploadAvatar({
        workspaceId: WS,
        fileBuffer: Buffer.from("fake-bytes"),
        contentType: "image/png",
        extension: "png",
      }),
    ).rejects.toThrow("Gagal upload avatar.");
    expect(getPublicUrl).not.toHaveBeenCalled();
  });

  it("removes avatars/{workspaceId}/avatar.{ext} and ignores storage errors", async () => {
    remove.mockResolvedValue({ error: { message: "not found" } });

    await expect(
      supabaseStartPageAvatarStorage.deleteAvatar({
        workspaceId: WS,
        extension: "png",
      }),
    ).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith([`${WS}/avatar.png`]);
  });
});
