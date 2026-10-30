import { asWorkspaceId } from "@postific/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { upload, getPublicUrl, remove, list, from, createServerSupabaseClient } =
  vi.hoisted(() => {
    const upload = vi.fn();
    const getPublicUrl = vi.fn();
    const remove = vi.fn();
    const list = vi.fn();
    const from = vi.fn(() => ({ upload, getPublicUrl, remove, list }));
    const createServerSupabaseClient = vi.fn(() => ({
      storage: { from },
    }));
    return {
      upload,
      getPublicUrl,
      remove,
      list,
      from,
      createServerSupabaseClient,
    };
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
    list.mockReset();
    from.mockClear();
    createServerSupabaseClient.mockClear();
  });

  it("uploads to a unique avatars/{workspaceId}/avatar-{id}.{ext} path", async () => {
    upload.mockResolvedValue({ error: null });
    getPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://cdn.example/avatars/${path}` },
    }));

    const result = await supabaseStartPageAvatarStorage.uploadAvatar({
      workspaceId: WS,
      fileBuffer: Buffer.from("fake-bytes"),
      contentType: "image/jpeg",
      extension: "jpg",
    });

    expect(from).toHaveBeenCalledWith("avatars");
    expect(result.fileName).toMatch(/^avatar-[0-9a-f-]{36}\.jpg$/);
    expect(upload).toHaveBeenCalledWith(
      `${WS}/${result.fileName}`,
      expect.any(Buffer),
      { contentType: "image/jpeg" },
    );
    expect(result.url).toBe(
      `https://cdn.example/avatars/${WS}/${result.fileName}`,
    );
  });

  it("throws ExternalServiceError without the provider message", async () => {
    upload.mockResolvedValue({ error: { message: "bucket not found" } });
    const input = {
      workspaceId: WS,
      fileBuffer: Buffer.from("fake-bytes"),
      contentType: "image/png",
      extension: "png",
    };
    await expect(
      supabaseStartPageAvatarStorage.uploadAvatar(input),
    ).rejects.toThrow(ExternalServiceError);
    await expect(
      supabaseStartPageAvatarStorage.uploadAvatar(input),
    ).rejects.toThrow("Gagal upload avatar.");
    expect(getPublicUrl).not.toHaveBeenCalled();
  });

  it("removes one file and surfaces storage errors", async () => {
    remove.mockResolvedValue({ error: null });
    await supabaseStartPageAvatarStorage.deleteAvatar({
      workspaceId: WS,
      fileName: "avatar-1.png",
    });
    expect(remove).toHaveBeenCalledWith([`${WS}/avatar-1.png`]);

    remove.mockResolvedValue({ error: { message: "denied" } });
    await expect(
      supabaseStartPageAvatarStorage.deleteAvatar({
        workspaceId: WS,
        fileName: "avatar-1.png",
      }),
    ).rejects.toThrow(ExternalServiceError);
  });

  it("removes only old start-page avatar files other than the kept one", async () => {
    const uuid = (n: number) =>
      `${String(n).repeat(8)}-1111-1111-1111-111111111111`;
    const old = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const fresh = new Date().toISOString();
    list.mockResolvedValue({
      data: [
        { name: `avatar-${uuid(1)}.jpg`, created_at: old },
        { name: `avatar-${uuid(2)}.png`, created_at: old },
        { name: `avatar-${uuid(3)}.png`, created_at: fresh },
        { name: "avatar.png", created_at: old },
      ],
      error: null,
    });
    remove.mockResolvedValue({ error: null });
    await supabaseStartPageAvatarStorage.deleteOtherAvatars({
      workspaceId: WS,
      keepFileName: `avatar-${uuid(1)}.jpg`,
    });
    expect(list).toHaveBeenCalledWith(WS, { limit: 1000 });
    expect(remove).toHaveBeenCalledWith([`${WS}/avatar-${uuid(2)}.png`]);
  });
});
