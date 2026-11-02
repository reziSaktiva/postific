import {
  ContentFormat,
  ContentStatus,
  PostCreatedVia,
  SocialPlatform,
  asConnectedAccountId,
  asMediaId,
  asPostId,
  asPostTargetId,
  asUserId,
  asWorkspaceId,
} from "@postific/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ConnectedAccountRecord } from "@/domains/workspace";
import { ConflictError } from "@/lib/utils/errors";
import type { IJobScheduler } from "../adapters/job-scheduler";
import type { IOutstandAdapter } from "../adapters/outstand-adapter";
import type {
  IPublishingRepository,
  PublishingPostRecord,
} from "../repositories/publishing.repository";
import { ComposeDraftUseCase } from "./compose-draft.use-case";
import { PublishingService } from "./publishing.service";
import {
  ScheduleContentsUseCase,
  type ScheduleContentInput,
} from "./schedule-contents.use-case";
import { SchedulePostsUseCase } from "./schedule-posts.use-case";

const WORKSPACE = asWorkspaceId("ws-1");
const USER = asUserId("user-1");
const IG = asConnectedAccountId("acc-ig");
const FB = asConnectedAccountId("acc-fb");
const PIN = asConnectedAccountId("acc-pin");
const SOURCE = {
  createdVia: PostCreatedVia.Mcp,
  clientId: "client-1",
  clientName: "Claude",
} as const;

const NOW = new Date("2026-11-02T03:00:00.000Z");
const LATER = new Date("2026-11-10T03:00:00.000Z");

function account(
  id: ReturnType<typeof asConnectedAccountId>,
  platform: SocialPlatform,
): ConnectedAccountRecord {
  return {
    id,
    workspaceId: WORKSPACE,
    platform,
    outstandAccountId: `out-${id}`,
    handle: `@${id}`,
    status: "active",
    reconnectRequired: false,
    connectedAt: new Date(0),
    lastImportedUntil: null,
    lastImportRequestedAt: null,
  };
}

const ACCOUNTS = [
  account(IG, SocialPlatform.Instagram),
  account(FB, SocialPlatform.Facebook),
  account(PIN, SocialPlatform.Pinterest),
];

/**
 * Dunia palsu lokal (AGENTS.md #11): repository berstatus yang menyimpan post,
 * adapter Outstand yang merekam, dan job scheduler kosong. Use-case yang
 * diuji, `ComposeDraftUseCase`, `PublishingService`, dan `SchedulePostsUseCase`
 * semuanya ASLI, jadi yang diuji adalah perilaku hasil akhirnya.
 */
function world(
  options: {
    ownedMedia?: string[];
    outstandFails?: (caption: string) => boolean;
    outstandThrowsUnexpected?: (caption: string) => boolean;
  } = {},
) {
  const posts = new Map<string, PublishingPostRecord>();
  const sources: unknown[] = [];
  const outstandCalls: { caption: string; targets: number; at: Date }[] = [];
  let counter = 0;

  const repository = {
    createDraft: async (
      input: Parameters<IPublishingRepository["createDraft"]>[0],
    ) => {
      counter += 1;
      const record: PublishingPostRecord = {
        id: asPostId(`post-${counter}`),
        workspaceId: input.workspaceId,
        authorId: input.authorId,
        caption: input.caption,
        status: ContentStatus.Draft,
        mediaIds: input.mediaIds ?? [],
        createdVia: input.source?.createdVia ?? PostCreatedVia.App,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      };
      sources.push(input.source);
      posts.set(record.id, record);
      return record;
    },
    findPostStatusById: async (input: { postId: string }) => {
      const found = posts.get(input.postId);
      return found ? { status: found.status } : null;
    },
    schedulePost: async (input: {
      postId: string;
      targets: {
        connectedAccountId: ReturnType<typeof asConnectedAccountId>;
      }[];
    }) => {
      const found = posts.get(input.postId);
      if (!found) return null;
      found.status = ContentStatus.Scheduled;
      return {
        ...found,
        targets: input.targets.map((target, i) => ({
          id: asPostTargetId(`${input.postId}-t${i}`),
          connectedAccountId: target.connectedAccountId,
        })),
      };
    },
    setOutstandPostId: async () => undefined,
    updateTargetOutcome: async () => undefined,
    markPostFailed: async (input: { postId: string }) => {
      const found = posts.get(input.postId);
      if (found) found.status = ContentStatus.Failed;
    },
  } as unknown as IPublishingRepository;

  const adapter = {
    schedulePost: async (input: {
      caption: string;
      targets: unknown[];
      scheduledAt: Date;
    }) => {
      if (options.outstandThrowsUnexpected?.(input.caption)) {
        throw new Error("boom");
      }
      if (options.outstandFails?.(input.caption)) {
        throw new Error("Outstand menolak");
      }
      outstandCalls.push({
        caption: input.caption,
        targets: input.targets.length,
        at: input.scheduledAt,
      });
      return { outstandPostId: `out-${outstandCalls.length}` };
    },
  } as unknown as IOutstandAdapter;
  const jobs: IJobScheduler = { scheduleJob: async () => undefined };

  const owned = options.ownedMedia ?? [];
  const compose = new ComposeDraftUseCase(
    new PublishingService(repository),
    repository,
    { listConnectedAccounts: async () => ACCOUNTS },
    {
      listByIds: async (input) =>
        input.mediaIds.filter((id) => owned.includes(id)).map((id) => ({ id })),
    },
  );
  const logger = { error: vi.fn() };
  const useCase = new ScheduleContentsUseCase(
    compose,
    new SchedulePostsUseCase(repository, adapter, jobs, {
      listByIds: async ({ mediaIds }) =>
        mediaIds.map((id) => ({
          id,
          filename: `${id}.png`,
          mimeType: "image/png",
          storagePath: `ws/${id}.png`,
          url: null,
          outstandMediaUrl: `https://outstand.example/${id}.png`,
          outstandExpiresAt: new Date("2027-01-01T00:00:00.000Z"),
        })),
      downloadBytes: async () => Buffer.from(""),
      saveOutstandWorkingCopy: async () => undefined,
    }),
    repository,
    { listConnectedAccounts: async () => ACCOUNTS },
    logger,
  );
  return { useCase, posts, sources, outstandCalls, logger };
}

function content(
  overrides: Partial<ScheduleContentInput> = {},
): ScheduleContentInput {
  return {
    caption: "Halo",
    scheduledAt: LATER,
    targets: [{ connectedAccountId: IG, contentFormat: ContentFormat.Post }],
    ...overrides,
  };
}

function run(
  w: ReturnType<typeof world>,
  contents: ScheduleContentInput[],
  reserveQuota?: (count: number) => Promise<void>,
) {
  return w.useCase.execute({
    workspaceId: WORKSPACE,
    actingUserId: USER,
    contents,
    source: SOURCE,
    ...(reserveQuota ? { reserveQuota } : {}),
  });
}

describe("ScheduleContentsUseCase", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("schedules every content as an MCP-stamped post and reports each one", async () => {
    const w = world();

    const outcomes = await run(w, [
      content({ caption: "Satu" }),
      content({
        caption: "Dua",
        targets: [
          { connectedAccountId: IG, contentFormat: ContentFormat.Post },
          { connectedAccountId: FB, contentFormat: ContentFormat.Post },
        ],
      }),
    ]);

    expect(outcomes.map((o) => o.status)).toEqual(["scheduled", "scheduled"]);
    const [first, second] = outcomes;
    expect(first).toMatchObject({
      index: 0,
      caption: "Satu",
      scheduledAt: LATER,
      targets: [
        {
          connectedAccountId: IG,
          platform: SocialPlatform.Instagram,
          contentFormat: ContentFormat.Post,
        },
      ],
    });
    expect(second).toMatchObject({ index: 1 });
    expect(w.outstandCalls.map((c) => [c.caption, c.targets])).toEqual([
      ["Satu", 1],
      ["Dua", 2],
    ]);
    expect(w.sources).toEqual([SOURCE, SOURCE]);
    for (const outcome of outcomes) {
      if (outcome.status !== "scheduled") throw new Error("harus terjadwal");
      expect(w.posts.get(outcome.postId)?.status).toBe(ContentStatus.Scheduled);
    }
  });

  it("lets a good content succeed when another is rejected, and only the good one costs quota", async () => {
    const w = world();
    const reserve = vi.fn(async () => undefined);

    const outcomes = await run(
      w,
      [
        content({
          caption: "Salah akun",
          targets: [
            {
              connectedAccountId: asConnectedAccountId("acc-asing"),
              contentFormat: ContentFormat.Post,
            },
          ],
        }),
        content({ caption: "Benar" }),
      ],
      reserve,
    );

    expect(outcomes[0]).toMatchObject({
      index: 0,
      status: "failed",
      kind: "invalid",
    });
    expect(outcomes[1]).toMatchObject({ index: 1, status: "scheduled" });
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(reserve).toHaveBeenCalledWith(1);
    // Konten yang ditolak tidak meninggalkan draft.
    expect(w.posts.size).toBe(1);
  });

  it("schedules nothing when the quota is refused", async () => {
    const w = world();
    const refusal = new Error("kuota habis");

    await expect(
      run(w, [content(), content({ caption: "Dua" })], async () => {
        throw refusal;
      }),
    ).rejects.toBe(refusal);

    expect(w.posts.size).toBe(0);
    expect(w.outstandCalls).toEqual([]);
  });

  it("does not ask for quota when no content passes the checks", async () => {
    const w = world();
    const reserve = vi.fn(async () => undefined);

    const outcomes = await run(w, [content({ targets: [] })], reserve);

    expect(outcomes[0]).toMatchObject({ status: "failed", kind: "invalid" });
    expect(reserve).not.toHaveBeenCalled();
  });

  it("rejects more targets than connected accounts and a repeated account", async () => {
    const w = world();
    const tooMany = Array.from({ length: ACCOUNTS.length + 1 }, () => ({
      connectedAccountId: IG,
      contentFormat: ContentFormat.Post,
    }));

    const outcomes = await run(w, [
      content({ targets: tooMany }),
      content({
        targets: [
          { connectedAccountId: IG, contentFormat: ContentFormat.Post },
          { connectedAccountId: IG, contentFormat: ContentFormat.Post },
        ],
      }),
    ]);

    expect(outcomes[0]).toMatchObject({
      status: "failed",
      kind: "invalid",
      message: expect.stringContaining("melebihi jumlah akun terhubung"),
    });
    expect(outcomes[1]).toMatchObject({
      status: "failed",
      kind: "invalid",
      message: expect.stringContaining("lebih dari sekali"),
    });
    expect(w.posts.size).toBe(0);
  });

  it("enforces the ContentFormat matrix per account (ADR-039)", async () => {
    const w = world();

    const outcomes = await run(w, [
      content({
        targets: [{ connectedAccountId: IG, contentFormat: ContentFormat.Pin }],
      }),
      content({
        targets: [
          { connectedAccountId: IG, contentFormat: "podcast" as never },
        ],
      }),
    ]);

    expect(outcomes[0]).toMatchObject({
      status: "failed",
      kind: "invalid",
      message: expect.stringContaining("tidak diizinkan"),
    });
    expect(outcomes[1]).toMatchObject({
      status: "failed",
      kind: "invalid",
      message: expect.stringContaining("tidak dikenal"),
    });
    expect(w.posts.size).toBe(0);
  });

  it("rejects media the workspace does not own without scheduling", async () => {
    const w = world({ ownedMedia: [] });

    const [outcome] = await run(w, [content({ mediaIds: ["media-asing"] })]);

    expect(outcome).toMatchObject({ status: "failed", kind: "invalid" });
    expect(w.outstandCalls).toEqual([]);
  });

  it("reports a provider refusal as failed, with the post id, not as scheduled", async () => {
    const w = world({ outstandFails: (caption) => caption === "Ditolak" });

    const outcomes = await run(w, [
      content({ caption: "Ditolak" }),
      content({ caption: "Lolos" }),
    ]);

    expect(outcomes[0]).toMatchObject({
      status: "failed",
      kind: "schedule_failed",
      postId: expect.any(String),
    });
    expect(outcomes[1]).toMatchObject({ status: "scheduled" });
  });

  it("keeps reporting contents that were scheduled when a later one hits an unexpected error", async () => {
    const w = world({
      outstandThrowsUnexpected: (caption) => caption === "Meledak",
    });

    const outcomes = await run(w, [
      content({ caption: "Aman" }),
      content({ caption: "Meledak" }),
      content({ caption: "Aman juga" }),
    ]);

    expect(outcomes.map((o) => o.status)).toEqual([
      "scheduled",
      // Kegagalan penyedia yang tak terduga ditandai gagal oleh SchedulePostsUseCase.
      "failed",
      "scheduled",
    ]);
  });

  it("does not leak the text of unexpected errors", async () => {
    const w = world();
    const useCase = new ScheduleContentsUseCase(
      {
        createDraft: async () => {
          throw new Error("password=hunter2 di string koneksi");
        },
      },
      { execute: async () => ({}) as never },
      { findPostStatusById: async () => null },
      { listConnectedAccounts: async () => ACCOUNTS },
      w.logger,
    );

    const [outcome] = await useCase.execute({
      workspaceId: WORKSPACE,
      actingUserId: USER,
      contents: [content()],
      source: SOURCE,
    });

    expect(outcome).toMatchObject({ status: "failed", kind: "internal" });
    expect(JSON.stringify(outcome)).not.toContain("hunter2");
    expect(w.logger.error).toHaveBeenCalled();
  });

  it("maps a conflict raised while scheduling to a conflict failure", async () => {
    const w = world();
    const useCase = new ScheduleContentsUseCase(
      {
        createDraft: async () => ({
          post: { id: asPostId("p-1") } as PublishingPostRecord,
          targets: [],
        }),
      },
      {
        execute: async () => {
          throw new ConflictError("Post tidak bisa dijadwalkan.");
        },
      },
      { findPostStatusById: async () => null },
      { listConnectedAccounts: async () => ACCOUNTS },
      w.logger,
    );

    const [outcome] = await useCase.execute({
      workspaceId: WORKSPACE,
      actingUserId: USER,
      contents: [content()],
      source: SOURCE,
    });

    expect(outcome).toMatchObject({
      status: "failed",
      kind: "conflict",
      postId: "p-1",
    });
  });

  it("refuses an empty batch", async () => {
    await expect(run(world(), [])).rejects.toThrow(/minimal satu konten/);
  });

  it("passes the requested media to the post and echoes them back", async () => {
    const media = asMediaId("media-a");
    const w = world({ ownedMedia: [media] });

    const [outcome] = await run(w, [content({ mediaIds: [media] })]);

    expect(outcome).toMatchObject({ status: "scheduled", mediaIds: [media] });
  });
});
