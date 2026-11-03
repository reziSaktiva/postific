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
const TH = asConnectedAccountId("acc-th");
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
  account(TH, SocialPlatform.Threads),
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
    accounts?: ConnectedAccountRecord[];
  } = {},
) {
  const posts = new Map<string, PublishingPostRecord>();
  const sources: unknown[] = [];
  const outstandCalls: { caption: string; targets: number; at: Date }[] = [];
  /** Setiap panggilan port: workspace dan pengguna yang diteruskan use-case. */
  const calls: { port: string; workspaceId: unknown; userId: unknown }[] = [];
  const seen = (port: string, workspaceId: unknown, userId: unknown) =>
    calls.push({ port, workspaceId, userId });
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
    // Seperti repository nyata: post hanya terlihat di workspace pemiliknya.
    findPostStatusById: async (
      input: { workspaceId: unknown; postId: string },
      userId: unknown,
    ) => {
      seen("status", input.workspaceId, userId);
      const found = posts.get(input.postId);
      return found && found.workspaceId === input.workspaceId
        ? { status: found.status }
        : null;
    },
    schedulePost: async (
      input: {
        workspaceId: unknown;
        postId: string;
        targets: {
          connectedAccountId: ReturnType<typeof asConnectedAccountId>;
        }[];
      },
      userId: unknown,
    ) => {
      seen("schedule", input.workspaceId, userId);
      const found = posts.get(input.postId);
      if (!found || found.workspaceId !== input.workspaceId) return null;
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
  // Akun dan media hanya milik WORKSPACE; workspace lain tidak melihat apa pun.
  const accountsPort = {
    listConnectedAccounts: async (workspaceId: unknown, userId: unknown) => {
      seen("accounts", workspaceId, userId);
      return workspaceId === WORKSPACE ? (options.accounts ?? ACCOUNTS) : [];
    },
  };
  const mediaPort = {
    listByIds: async (
      input: { workspaceId: unknown; mediaIds: ReturnType<typeof asMediaId>[] },
      userId: unknown,
    ) => {
      seen("media", input.workspaceId, userId);
      return input.workspaceId === WORKSPACE
        ? input.mediaIds.flatMap((id) => {
            // Seperti kolom uuid di DB: cocok tanpa peka huruf, id yang
            // kembali berbentuk kanonik.
            const stored = owned.find(
              (own) => own.toLowerCase() === id.toLowerCase(),
            );
            return stored === undefined ? [] : [{ id: asMediaId(stored) }];
          })
        : [];
    },
  };
  const compose = new ComposeDraftUseCase(
    new PublishingService(repository),
    repository,
    accountsPort,
    mediaPort,
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
    accountsPort,
    mediaPort,
    logger,
  );
  return { useCase, posts, sources, outstandCalls, logger, calls };
}

function content(
  overrides: Partial<ScheduleContentInput> = {},
): ScheduleContentInput {
  return {
    caption: "Halo",
    scheduledAt: LATER,
    targets: [{ connectedAccountId: FB, contentFormat: ContentFormat.Post }],
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
          { connectedAccountId: FB, contentFormat: ContentFormat.Post },
          { connectedAccountId: TH, contentFormat: ContentFormat.Post },
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
          connectedAccountId: FB,
          platform: SocialPlatform.Facebook,
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
          { connectedAccountId: FB, contentFormat: ContentFormat.Post },
          { connectedAccountId: FB, contentFormat: ContentFormat.Post },
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

  it("keeps reporting the contents around one the provider refuses, and that refusal still costs quota", async () => {
    const w = world({ outstandFails: (caption) => caption === "Ditolak" });
    const reserve = vi.fn(async () => undefined);

    const outcomes = await run(
      w,
      [
        content({ caption: "Aman" }),
        content({ caption: "Ditolak" }),
        content({ caption: "Aman juga" }),
      ],
      reserve,
    );

    expect(outcomes.map((o) => o.status)).toEqual([
      "scheduled",
      "failed",
      "scheduled",
    ]);
    // Kuota dipesan sebelum menulis dan tidak dikembalikan (tanpa refund).
    expect(reserve).toHaveBeenCalledWith(3);
  });

  it("reports an unexpected error after the draft exists as internal, with the post id, and the quota stays spent", async () => {
    const w = world();
    const reserve = vi.fn(async () => undefined);
    const useCase = new ScheduleContentsUseCase(
      {
        createDraft: async () => ({
          post: { id: asPostId("p-9") } as PublishingPostRecord,
          targets: [],
        }),
      },
      {
        execute: async () => {
          throw new Error("koneksi DB putus: password=hunter2");
        },
      },
      { findPostStatusById: async () => null },
      { listConnectedAccounts: async () => ACCOUNTS },
      { listByIds: async () => [] },
      w.logger,
    );

    const [outcome] = await useCase.execute({
      workspaceId: WORKSPACE,
      actingUserId: USER,
      contents: [content()],
      source: SOURCE,
      reserveQuota: reserve,
    });

    expect(outcome).toMatchObject({
      status: "failed",
      kind: "internal",
      postId: "p-9",
    });
    expect(JSON.stringify(outcome)).not.toContain("hunter2");
    expect(reserve).toHaveBeenCalledWith(1);
  });

  it("still reports scheduled when only the status read after a successful schedule fails", async () => {
    const w = world();
    const reserve = vi.fn(async () => undefined);
    const logger = { error: vi.fn() };
    const useCase = new ScheduleContentsUseCase(
      {
        createDraft: async () => ({
          post: {
            id: asPostId("p-7"),
            caption: "Aman",
          } as PublishingPostRecord,
          targets: [],
        }),
      },
      {
        execute: async () =>
          ({ id: asPostId("p-7"), caption: "Aman", mediaIds: [] }) as never,
      },
      {
        findPostStatusById: async () => {
          throw new Error("DB sesaat putus");
        },
      },
      { listConnectedAccounts: async () => ACCOUNTS },
      { listByIds: async () => [] },
      logger,
    );

    const [outcome] = await useCase.execute({
      workspaceId: WORKSPACE,
      actingUserId: USER,
      contents: [content()],
      source: SOURCE,
      reserveQuota: reserve,
    });

    // Post sudah terjadwal di penyedia; galat pelaporan tidak boleh memancing
    // klien mengulang panggilan dan membuat post ganda.
    expect(outcome).toMatchObject({ status: "scheduled", postId: "p-7" });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(w.posts.size).toBe(0);
  });

  it("forwards the workspace and acting user to the account, media, status, and schedule ports", async () => {
    const media = asMediaId("media-a");
    const w = world({ ownedMedia: [media] });

    await run(w, [content({ mediaIds: [media] })]);

    const ports = new Set(w.calls.map((call) => call.port));
    expect(ports).toEqual(new Set(["accounts", "media", "status", "schedule"]));
    for (const call of w.calls) {
      expect(call, call.port).toMatchObject({
        workspaceId: WORKSPACE,
        userId: USER,
      });
    }
  });

  it("reads accounts once and media once per content for a whole batch, not again when drafting", async () => {
    const a = asMediaId("media-a");
    const b = asMediaId("media-b");
    const w = world({ ownedMedia: [a, b] });

    const outcomes = await run(w, [
      content({ caption: "Satu", mediaIds: [a] }),
      content({ caption: "Dua", mediaIds: [b] }),
      content({ caption: "Tiga" }),
    ]);

    expect(outcomes.map((o) => o.status)).toEqual([
      "scheduled",
      "scheduled",
      "scheduled",
    ]);
    const count = (port: string) =>
      w.calls.filter((call) => call.port === port).length;
    expect(count("accounts")).toBe(1);
    expect(count("media")).toBe(2);
  });

  it("matches account and media ids case-insensitively and stores the canonical ids", async () => {
    const media = asMediaId("0a1b2c3d-0000-4000-8000-00000000000a");
    const w = world({ ownedMedia: [media] });

    const [outcome] = await run(w, [
      content({
        mediaIds: [media.toUpperCase()],
        targets: [
          {
            connectedAccountId: IG.toUpperCase() as typeof IG,
            contentFormat: ContentFormat.Post,
          },
        ],
      }),
    ]);

    expect(outcome).toMatchObject({ status: "scheduled", mediaIds: [media] });
  });

  it("sees nothing of another workspace: accounts, media, and posts are scoped to the workspace passed in", async () => {
    const media = asMediaId("media-a");
    const w = world({ ownedMedia: [media] });
    const other = asWorkspaceId("ws-other");

    const [outcome] = await w.useCase.execute({
      workspaceId: other,
      actingUserId: USER,
      contents: [content({ mediaIds: [media] })],
      source: SOURCE,
    });

    expect(outcome).toMatchObject({ status: "failed", kind: "invalid" });
    expect(w.posts.size).toBe(0);
    expect(w.outstandCalls).toEqual([]);
    expect(w.calls.every((call) => call.workspaceId === other)).toBe(true);
  });

  describe("accounts and media checked before quota", () => {
    it("rejects media the workspace does not own without quota or draft", async () => {
      const w = world({ ownedMedia: [] });
      const reserve = vi.fn(async () => undefined);

      const [outcome] = await run(
        w,
        [content({ mediaIds: [asMediaId("media-asing")] })],
        reserve,
      );

      expect(outcome).toMatchObject({
        status: "failed",
        kind: "invalid",
        message: expect.stringContaining("bukan milik workspace"),
      });
      expect(reserve).not.toHaveBeenCalled();
      expect(w.posts.size).toBe(0);
    });

    it("rejects the same media twice before quota", async () => {
      const media = asMediaId("media-a");
      const w = world({ ownedMedia: [media] });
      const reserve = vi.fn(async () => undefined);

      const [outcome] = await run(
        w,
        [content({ mediaIds: [media, media] })],
        reserve,
      );

      expect(outcome).toMatchObject({ status: "failed", kind: "invalid" });
      expect(reserve).not.toHaveBeenCalled();
    });

    it.each([
      ["status is not active", { status: "disconnected" }, /tidak aktif/],
      [
        "it needs reconnecting",
        { reconnectRequired: true },
        /perlu dihubungkan ulang/,
      ],
    ])(
      "rejects an account whose %s, per content, before quota",
      async (_l, patch, message) => {
        const w = world({
          accounts: [
            { ...account(FB, SocialPlatform.Facebook), ...patch },
            account(TH, SocialPlatform.Threads),
          ],
        });
        const reserve = vi.fn(async () => undefined);

        const outcomes = await run(
          w,
          [
            content({ caption: "Ke akun mati" }),
            content({
              caption: "Ke akun sehat",
              targets: [
                { connectedAccountId: TH, contentFormat: ContentFormat.Post },
              ],
            }),
          ],
          reserve,
        );

        expect(outcomes[0]).toMatchObject({
          status: "failed",
          kind: "invalid",
          message: expect.stringMatching(message),
        });
        expect(outcomes[1]).toMatchObject({ status: "scheduled" });
        expect(reserve).toHaveBeenCalledWith(1);
        expect(w.posts.size).toBe(1);
      },
    );
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
      { listByIds: async () => [] },
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
      { listByIds: async () => [] },
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

  describe("Safety Check before anything is written", () => {
    const story = (id = IG) => ({
      connectedAccountId: id,
      contentFormat: ContentFormat.Story,
    });
    const post = (id = FB) => ({
      connectedAccountId: id,
      contentFormat: ContentFormat.Post,
    });
    const MEDIA = "media-a";

    const rejected: [string, ScheduleContentInput, RegExp][] = [
      [
        "a time that is already past",
        content({ scheduledAt: new Date("2026-11-02T02:59:59.000Z") }),
        /sudah lewat/,
      ],
      ["the current second", content({ scheduledAt: NOW }), /sudah lewat/],
      [
        "an empty caption on a non-Story target",
        content({ caption: "   " }),
        /Caption wajib/,
      ],
      [
        "a Story combined with another target while the caption is filled",
        content({
          mediaIds: [MEDIA],
          targets: [story(IG), post(FB)],
        }),
        /Story tidak bisa digabung/,
      ],
      [
        "a Story without media",
        content({ caption: "", mediaIds: undefined, targets: [story()] }),
        /tanpa media/,
      ],
      [
        "a Reel without media",
        content({
          mediaIds: [],
          targets: [
            { connectedAccountId: IG, contentFormat: ContentFormat.Reel },
          ],
        }),
        /tanpa media/,
      ],
      [
        "more media than a Reel allows",
        content({
          mediaIds: [MEDIA, "media-b"],
          targets: [
            { connectedAccountId: IG, contentFormat: ContentFormat.Reel },
          ],
        }),
        /melebihi batas maksimum 1/,
      ],
      [
        "a Pinterest target, since the board cannot be set through MCP",
        content({
          mediaIds: [MEDIA],
          targets: [
            { connectedAccountId: PIN, contentFormat: ContentFormat.Pin },
          ],
        }),
        /Pinterest belum bisa dijadwalkan lewat MCP/,
      ],
    ];

    it.each(rejected)(
      "rejects %s: failed, no draft, no quota",
      async (_label, input, message) => {
        const w = world({ ownedMedia: [MEDIA, "media-b"] });
        const reserve = vi.fn(async () => undefined);

        const [outcome] = await run(w, [input], reserve);

        expect(outcome).toMatchObject({
          status: "failed",
          kind: "invalid",
          message: expect.stringMatching(message),
        });
        expect((outcome as { postId?: string }).postId).toBeUndefined();
        expect(w.posts.size).toBe(0);
        expect(w.outstandCalls).toEqual([]);
        expect(reserve).not.toHaveBeenCalled();
      },
    );

    it("lets a caption-less Story with media through (Story has no caption)", async () => {
      const w = world({ ownedMedia: [MEDIA] });

      const [outcome] = await run(w, [
        content({ caption: "", mediaIds: [MEDIA], targets: [story()] }),
      ]);

      expect(outcome).toMatchObject({ status: "scheduled" });
    });

    it("lets a Story plus another target through when the caption is empty", async () => {
      const w = world({ ownedMedia: [MEDIA] });

      const [outcome] = await run(w, [
        content({
          caption: "",
          mediaIds: [MEDIA],
          targets: [story(IG), post(FB)],
        }),
      ]);

      expect(outcome).toMatchObject({ status: "scheduled" });
    });

    it("schedules a time one second ahead", async () => {
      const w = world();

      const [outcome] = await run(w, [
        content({ scheduledAt: new Date(NOW.getTime() + 1000) }),
      ]);

      expect(outcome).toMatchObject({ status: "scheduled" });
    });

    it("reports the rejected and the accepted content of one batch independently", async () => {
      const w = world();
      const reserve = vi.fn(async () => undefined);

      const outcomes = await run(
        w,
        [
          content({ caption: "Lolos 1" }),
          content({ scheduledAt: new Date("2020-01-01T00:00:00.000Z") }),
          content({ caption: "Lolos 2" }),
        ],
        reserve,
      );

      expect(outcomes.map((o) => o.status)).toEqual([
        "scheduled",
        "failed",
        "scheduled",
      ]);
      expect(reserve).toHaveBeenCalledWith(2);
      expect(w.posts.size).toBe(2);
    });
  });
});
