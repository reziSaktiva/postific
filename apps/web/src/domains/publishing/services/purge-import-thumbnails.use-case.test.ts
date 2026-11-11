import { describe, expect, it, vi } from "vitest";
import { asWorkspaceId } from "@postific/shared";
import type {
  IImportThumbnailStorage,
  StoredImportThumbnail,
} from "../adapters/import-thumbnail-storage";
import {
  ORPHAN_GRACE_MS,
  PurgeImportThumbnailsUseCase,
} from "./purge-import-thumbnails.use-case";

const NOW = new Date("2026-11-11T12:00:00.000Z");
const OLD = new Date(NOW.getTime() - ORPHAN_GRACE_MS - 60_000);
const FRESH = new Date(NOW.getTime() - 60_000);
const WS_A = "aaaaaaaa-0000-4000-8000-000000000001";
const WS_B = "bbbbbbbb-0000-4000-8000-000000000002";

/** Storage palsu berbasis memori: path -> createdAt; urut nama, mengikuti kontrak port. */
function createStorage(initial: Record<string, Date | null>) {
  const files = new Map(Object.entries(initial));
  const storage: IImportThumbnailStorage = {
    async listWorkspaceIds() {
      return [...new Set([...files.keys()].map((path) => path.split("/")[0]!))];
    },
    async listWorkspaceThumbnails(workspaceId, { offset, limit }) {
      return [...files.entries()]
        .filter(([path]) => path.startsWith(`${workspaceId}/imports/`))
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(offset, offset + limit)
        .map(([path, createdAt]): StoredImportThumbnail => ({
          path,
          createdAt,
        }));
    },
    async removePaths(paths) {
      for (const path of paths) files.delete(path);
    },
  };
  return { storage, files };
}

const path = (ws: string, id: string) => `${ws}/imports/${id}.webp`;

describe("PurgeImportThumbnailsUseCase.purgeWorkspace", () => {
  it("removes every imports file of the workspace and leaves other workspaces alone", async () => {
    const { storage, files } = createStorage({
      [path(WS_A, "t1")]: OLD,
      [path(WS_A, "t2")]: FRESH,
      [path(WS_B, "t3")]: OLD,
    });
    const useCase = new PurgeImportThumbnailsUseCase(
      storage,
      { findReferencedThumbnailPaths: async () => [] },
      () => NOW,
    );

    const result = await useCase.purgeWorkspace(asWorkspaceId(WS_A));

    expect(result).toEqual({ removed: 2 });
    expect([...files.keys()]).toEqual([path(WS_B, "t3")]);
  });

  it("handles more than one page of files", async () => {
    const many: Record<string, Date> = {};
    for (let i = 0; i < 230; i++) {
      many[path(WS_A, `t${String(i).padStart(4, "0")}`)] = OLD;
    }
    const { storage, files } = createStorage(many);
    const useCase = new PurgeImportThumbnailsUseCase(
      storage,
      { findReferencedThumbnailPaths: async () => [] },
      () => NOW,
    );

    const result = await useCase.purgeWorkspace(asWorkspaceId(WS_A));

    expect(result.removed).toBe(230);
    expect(files.size).toBe(0);
  });

  it("propagates a Storage failure so the caller can log it", async () => {
    const { storage } = createStorage({ [path(WS_A, "t1")]: OLD });
    storage.removePaths = async () => {
      throw new Error("storage down");
    };
    const useCase = new PurgeImportThumbnailsUseCase(storage, {
      findReferencedThumbnailPaths: async () => [],
    });

    await expect(useCase.purgeWorkspace(asWorkspaceId(WS_A))).rejects.toThrow(
      "storage down",
    );
  });
});

describe("PurgeImportThumbnailsUseCase.sweepOrphans", () => {
  it("removes old unreferenced files and keeps referenced and fresh ones", async () => {
    const { storage, files } = createStorage({
      [path(WS_A, "kept")]: OLD,
      [path(WS_A, "orphan")]: OLD,
      [path(WS_A, "fresh-orphan")]: FRESH,
      [path(WS_A, "no-date")]: null,
    });
    const references = {
      findReferencedThumbnailPaths: async (paths: string[]) =>
        paths.filter((p) => p === path(WS_A, "kept")),
    };
    const useCase = new PurgeImportThumbnailsUseCase(
      storage,
      references,
      () => NOW,
    );

    const result = await useCase.sweepOrphans();

    expect(result).toEqual({ scanned: 4, removed: 1, incomplete: false });
    expect([...files.keys()].sort()).toEqual(
      [
        path(WS_A, "fresh-orphan"),
        path(WS_A, "kept"),
        path(WS_A, "no-date"),
      ].sort(),
    );
  });

  it("sweeps across pages without skipping files shifted by deletions", async () => {
    const many: Record<string, Date> = {};
    for (let i = 0; i < 250; i++) {
      many[path(WS_A, `t${String(i).padStart(4, "0")}`)] = OLD;
    }
    const { storage, files } = createStorage(many);
    // Hanya kelipatan 5 yang masih dirujuk; sisanya yatim.
    const referencedIds = new Set(
      Object.keys(many).filter((_, i) => i % 5 === 0),
    );
    const useCase = new PurgeImportThumbnailsUseCase(
      storage,
      {
        findReferencedThumbnailPaths: async (paths) =>
          paths.filter((p) => referencedIds.has(p)),
      },
      () => NOW,
    );

    const result = await useCase.sweepOrphans();

    expect(result.removed).toBe(200);
    expect(new Set(files.keys())).toEqual(referencedIds);
  });

  it("keeps sweeping other workspaces when one fails and reports incomplete", async () => {
    const { storage, files } = createStorage({
      [path(WS_A, "orphan-a")]: OLD,
      [path(WS_B, "orphan-b")]: OLD,
    });
    const original = storage.listWorkspaceThumbnails;
    storage.listWorkspaceThumbnails = async (workspaceId, page) => {
      if (workspaceId === WS_A) throw new Error("boom");
      return original(workspaceId, page);
    };
    const useCase = new PurgeImportThumbnailsUseCase(
      storage,
      { findReferencedThumbnailPaths: async () => [] },
      () => NOW,
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await useCase.sweepOrphans();

    expect(result.incomplete).toBe(true);
    expect(result.removed).toBe(1);
    expect(files.has(path(WS_A, "orphan-a"))).toBe(true);
    expect(files.has(path(WS_B, "orphan-b"))).toBe(false);
  });

  it("stops at the time budget and reports incomplete", async () => {
    // Lebih banyak workspace daripada konkurensi sapuan (5), supaya anggaran
    // waktu bisa habis di antara dua kelompok.
    const workspaceIds = Array.from(
      { length: 6 },
      (_, i) => `00000000-0000-4000-8000-00000000000${i}`,
    );
    const { storage } = createStorage(
      Object.fromEntries(workspaceIds.map((ws) => [path(ws, "a"), OLD])),
    );
    let tick = 0;
    const clock = () => new Date(NOW.getTime() + tick++ * 10_000);
    const useCase = new PurgeImportThumbnailsUseCase(
      storage,
      { findReferencedThumbnailPaths: async () => [] },
      clock,
      15_000,
    );

    const result = await useCase.sweepOrphans();

    expect(result.incomplete).toBe(true);
    expect(result.removed).toBeLessThan(6);
  });

  it("does nothing for an empty bucket", async () => {
    const { storage } = createStorage({});
    const useCase = new PurgeImportThumbnailsUseCase(storage, {
      findReferencedThumbnailPaths: async () => [],
    });

    await expect(useCase.sweepOrphans()).resolves.toEqual({
      scanned: 0,
      removed: 0,
      incomplete: false,
    });
  });
});
