import { beforeEach, describe, expect, it, vi } from "vitest";

const list = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    storage: { from: () => ({ list, remove: vi.fn() }) },
  }),
}));

import {
  latestTimestamp,
  supabaseImportThumbnailStorage,
} from "./supabase-import-thumbnail-storage";

const WS = "11111111-1111-4111-8111-111111111111";

describe("latestTimestamp", () => {
  it("memilih stempel terbaru", () => {
    expect(
      latestTimestamp("2026-11-01T00:00:00Z", "2026-11-02T00:00:00Z"),
    ).toEqual(new Date("2026-11-02T00:00:00Z"));
  });

  it("mengabaikan nilai kosong atau tak terbaca, null bila tak ada", () => {
    expect(latestTimestamp(null, "2026-11-01T00:00:00Z")).toEqual(
      new Date("2026-11-01T00:00:00Z"),
    );
    expect(latestTimestamp(undefined, "bukan-tanggal")).toBeNull();
  });
});

describe("supabaseImportThumbnailStorage", () => {
  beforeEach(() => list.mockReset());

  it("listWorkspaceIds hanya mengembalikan folder berawalan UUID", async () => {
    list.mockResolvedValueOnce({
      data: [
        { name: WS },
        { name: "bukan-uuid" },
        { name: ".emptyFolderPlaceholder" },
      ],
      error: null,
    });
    await expect(
      supabaseImportThumbnailStorage.listWorkspaceIds(),
    ).resolves.toEqual([WS]);
  });

  it("listWorkspaceThumbnails menyaring folder dan memakai waktu sentuh terbaru", async () => {
    list.mockResolvedValueOnce({
      data: [
        {
          id: "a",
          name: "t1.webp",
          created_at: "2026-11-01T00:00:00Z",
          updated_at: "2026-11-03T00:00:00Z",
        },
        { id: null, name: "subfolder", created_at: null, updated_at: null },
      ],
      error: null,
    });
    const result = await supabaseImportThumbnailStorage.listWorkspaceThumbnails(
      WS,
      {
        offset: 0,
        limit: 100,
      },
    );
    expect(result).toEqual([
      {
        path: `${WS}/imports/t1.webp`,
        createdAt: new Date("2026-11-03T00:00:00Z"),
      },
    ]);
  });

  it("melempar galat bila Storage gagal", async () => {
    list.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(
      supabaseImportThumbnailStorage.listWorkspaceThumbnails(WS, {
        offset: 0,
        limit: 10,
      }),
    ).rejects.toThrow(/boom/);
  });
});
