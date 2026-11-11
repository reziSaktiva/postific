import { asUserId, asWorkspaceId } from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import {
  TransientThumbnailError,
  type IImportThumbnailGenerator,
} from "../adapters/import-thumbnail-generator";
import type { IPublishingRepository } from "../repositories/publishing.repository";
import {
  MAX_THUMBNAIL_ATTEMPTS,
  ProcessImportMediaUseCase,
} from "./process-import-media.use-case";

const workspaceId = asWorkspaceId("11111111-1111-4111-8111-111111111111");
const actingUserId = asUserId("user-1");

function setup(opts: {
  pending: { targetId: string; sourceUrl: string }[];
  generate: IImportThumbnailGenerator["generate"];
  budgetMs?: number;
  exhausted?: (targetId: string) => boolean;
}) {
  const save = vi.fn(async () => undefined);
  const record = vi.fn(async (input: { targetId: string }) => ({
    exhausted: opts.exhausted?.(input.targetId) ?? false,
  }));
  const repository = {
    findImportedTargetsNeedingThumbnail: vi.fn(async () => opts.pending),
    saveImportedTargetThumbnail: save,
    recordImportedTargetThumbnailFailure: record,
  } as unknown as IPublishingRepository;
  const useCase = new ProcessImportMediaUseCase(
    repository,
    { generate: opts.generate },
    opts.budgetMs,
  );
  return { useCase, save, record, repository };
}

describe("ProcessImportMediaUseCase (T-230)", () => {
  it("menyimpan thumbnail yang berhasil dan menandai yang gagal sebagai sudah dicoba", async () => {
    const { useCase, save } = setup({
      pending: [
        { targetId: "t1", sourceUrl: "https://a.fbcdn.net/1.jpg" },
        { targetId: "t2", sourceUrl: "https://a.fbcdn.net/2.jpg" },
      ],
      generate: async ({ targetId }) =>
        targetId === "t1"
          ? { storagePath: "w/imports/t1.webp", kind: "image" }
          : null,
    });

    const result = await useCase.process({
      workspaceId,
      actingUserId,
      targetIds: ["t1", "t2", "t3"],
    });

    expect(result).toEqual({
      stored: 1,
      skipped: 1,
      deferred: 0,
      alreadyHandled: 1,
    });
    expect(save).toHaveBeenCalledWith(
      {
        workspaceId,
        targetId: "t1",
        thumbnail: { storagePath: "w/imports/t1.webp", kind: "image" },
      },
      actingUserId,
    );
    expect(save).toHaveBeenCalledWith(
      { workspaceId, targetId: "t2", thumbnail: null },
      actingUserId,
    );
  });

  it("kegagalan SEMENTARA (throw) tidak menggagalkan batch dan TIDAK ditandai sudah dicoba", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { useCase, save, record } = setup({
      pending: [
        { targetId: "t1", sourceUrl: "https://a.fbcdn.net/1.jpg" },
        { targetId: "t2", sourceUrl: "https://a.fbcdn.net/2.jpg" },
      ],
      generate: async ({ targetId }) => {
        if (targetId === "t1")
          throw new TransientThumbnailError("ffmpeg tidak ada");
        return { storagePath: "w/imports/t2.webp", kind: "video_poster" };
      },
    });

    const result = await useCase.process({
      workspaceId,
      actingUserId,
      targetIds: ["t1", "t2"],
    });

    expect(result).toEqual({
      stored: 1,
      skipped: 0,
      deferred: 1,
      alreadyHandled: 0,
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalledWith(
      expect.objectContaining({ targetId: "t1" }),
      expect.anything(),
    );
    // T-233: penghitung percobaan naik hanya untuk target yang gagal.
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      { workspaceId, targetId: "t1", maxAttempts: MAX_THUMBNAIL_ATTEMPTS },
      actingUserId,
    );
  });

  it("T-233: batas percobaan tercapai menghitung target sebagai dilewati permanen, bukan tertunda", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { useCase, save } = setup({
      pending: [
        { targetId: "t1", sourceUrl: "https://a.fbcdn.net/1.jpg" },
        { targetId: "t2", sourceUrl: "https://a.fbcdn.net/2.jpg" },
      ],
      generate: async () => {
        throw new TransientThumbnailError("CDN membalas 503");
      },
      exhausted: (targetId) => targetId === "t1",
    });

    const result = await useCase.process({
      workspaceId,
      actingUserId,
      targetIds: ["t1", "t2"],
    });

    expect(result).toEqual({
      stored: 0,
      skipped: 1,
      deferred: 1,
      alreadyHandled: 0,
    });
    expect(save).not.toHaveBeenCalled();
  });

  it("T-233: log kegagalan sementara memuat penyebab bertingkat", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { useCase } = setup({
      pending: [{ targetId: "t1", sourceUrl: "https://a.fbcdn.net/1.jpg" }],
      generate: async () => {
        throw new TransientThumbnailError("HEAD video gagal", {
          cause: new Error("fetch failed", {
            cause: new Error("connect ETIMEDOUT"),
          }),
        });
      },
    });

    await useCase.process({ workspaceId, actingUserId, targetIds: ["t1"] });

    const message = String(warn.mock.calls.at(-1)?.[0]);
    expect(message).toContain("HEAD video gagal");
    expect(message).toContain("fetch failed");
    expect(message).toContain("connect ETIMEDOUT");
  });

  it("T-233: kegagalan karena anggaran waktu job habis tidak menaikkan penghitung", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { useCase, record } = setup({
      budgetMs: 20,
      pending: [{ targetId: "t1", sourceUrl: "https://a.fbcdn.net/1.jpg" }],
      generate: ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () =>
            reject(new TransientThumbnailError("dibatalkan")),
          );
        }),
    });

    const result = await useCase.process({
      workspaceId,
      actingUserId,
      targetIds: ["t1"],
    });

    expect(result.deferred).toBe(1);
    expect(record).not.toHaveBeenCalled();
  });

  it("anggaran waktu habis: pekerjaan dibatalkan, target sisa ditunda dan tidak ditandai", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let sawAbort = false;
    const { useCase, save } = setup({
      budgetMs: 20,
      pending: Array.from({ length: 7 }, (_, i) => ({
        targetId: `t${i}`,
        sourceUrl: `https://a.fbcdn.net/${i}.jpg`,
      })),
      generate: ({ signal }) =>
        new Promise((resolve) => {
          signal?.addEventListener("abort", () => (sawAbort = true));
          setTimeout(() => resolve(null), 500);
        }),
    });

    const result = await useCase.process({
      workspaceId,
      actingUserId,
      targetIds: Array.from({ length: 7 }, (_, i) => `t${i}`),
    });

    expect(result.deferred).toBe(7);
    expect(result.stored + result.skipped).toBe(0);
    expect(sawAbort).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it("idempoten: tanpa target tertunda tidak memanggil generator", async () => {
    const generate = vi.fn();
    const { useCase, save } = setup({ pending: [], generate });

    const result = await useCase.process({
      workspaceId,
      actingUserId,
      targetIds: ["t1", "t2"],
    });

    expect(result).toEqual({
      stored: 0,
      skipped: 0,
      deferred: 0,
      alreadyHandled: 2,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("memproses paling banyak 5 media bersamaan", async () => {
    let running = 0;
    let peak = 0;
    const { useCase } = setup({
      pending: Array.from({ length: 12 }, (_, i) => ({
        targetId: `t${i}`,
        sourceUrl: `https://a.fbcdn.net/${i}.jpg`,
      })),
      generate: async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 5));
        running--;
        return null;
      },
    });

    await useCase.process({
      workspaceId,
      actingUserId,
      targetIds: Array.from({ length: 12 }, (_, i) => `t${i}`),
    });

    expect(peak).toBeLessThanOrEqual(5);
  });
});
