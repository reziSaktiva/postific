import {
  ContentFormat,
  MemberStatus,
  PostCreatedVia,
  SocialPlatform,
  asConnectedAccountId,
  asMcpAuditLogId,
  asMcpGrantId,
  asPostId,
  asUserId,
  asWorkspaceId,
} from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import {
  McpAccessService,
  McpRateLimitService,
  type IMcpAuditRepository,
  type IMcpGrantRepository,
  type IMcpRateLimitRepository,
  type McpAuditEntry,
  type McpGrant,
} from "@/domains/mcp-access";
import type {
  ScheduleContentOutcome,
  ScheduleContentsUseCase,
} from "@/domains/publishing";

import type { McpClaims } from "../claims";
import { MCP_RATE_LIMIT_DEFAULTS, MCP_SCHEDULE_MAX_CONTENTS } from "../config";
import { runMcpTool, type McpGateDeps } from "../run-tool";
import { fakeIdentity } from "../test-support";
import { McpToolInputError } from "../tool-input";
import type { McpToolContext, McpToolServices } from "../tool-types";
import { MCP_SCHEDULE_TOOLS } from "./schedule-tools";

/**
 * Handler `schedule_posts` dites dengan use-case palsu lokal yang merekam
 * panggilan (AGENTS.md #11): yang diuji pemetaan argumen -> use-case,
 * tafsir waktu di zona pengguna, identitas dari grant, kuota lewat
 * `McpAccessService` asli, dan bentuk hasil per konten. Aturan domain
 * (matriks, Safety Check, penjadwalan) dites di `schedule-contents.use-case.test.ts`.
 */

const WORKSPACE = asWorkspaceId("ws-1");
const USER = asUserId("user-1");
const CLIENT = "client-abc";
const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_2 = "44444444-4444-4444-8444-444444444444";
const MEDIA = "33333333-3333-4333-8333-333333333333";
const POST_1 = asPostId("post-1");
const POST_2 = asPostId("post-2");

const schedulePosts = MCP_SCHEDULE_TOOLS[0]!;

function scheduledOutcome(
  index: number,
  postId = POST_1,
): ScheduleContentOutcome {
  return {
    index,
    status: "scheduled",
    postId,
    caption: "Halo",
    mediaIds: [MEDIA],
    scheduledAt: new Date("2026-11-10T02:00:00.000Z"),
    targets: [
      {
        connectedAccountId: asConnectedAccountId(ACCOUNT),
        platform: SocialPlatform.Instagram,
        contentFormat: ContentFormat.Reel,
      },
    ],
  };
}

function fakeUseCase(
  outcomes: ScheduleContentOutcome[] | ((count: number) => unknown),
) {
  const execute = vi.fn(
    async (input: Parameters<ScheduleContentsUseCase["execute"]>[0]) => {
      if (input.reserveQuota) await input.reserveQuota(input.contents.length);
      return typeof outcomes === "function"
        ? (outcomes(input.contents.length) as ScheduleContentOutcome[])
        : outcomes;
    },
  );
  return { execute, scheduleContents: { execute } };
}

function context(
  scheduleContents: McpToolServices["scheduleContents"],
  overrides: Partial<McpToolContext> = {},
): McpToolContext {
  return {
    workspaceId: WORKSPACE,
    userId: USER,
    clientId: CLIENT,
    clientName: "Claude Code",
    grantScopes: ["read", "schedule"],
    timeZone: "Asia/Jakarta",
    consumeQuota: async () => undefined,
    services: { scheduleContents } as McpToolServices,
    ...overrides,
  };
}

const content = (overrides: Record<string, unknown> = {}) => ({
  caption: "Halo",
  scheduledAt: "2026-11-10T09:00:00",
  targets: [{ accountId: ACCOUNT, contentFormat: "reel" }],
  mediaIds: [MEDIA],
  ...overrides,
});

describe("schedule_posts definition", () => {
  it("is the schedule-scope tool with a closed schema, the configured batch cap, and no identity parameters", () => {
    expect(MCP_SCHEDULE_TOOLS.map((t) => [t.name, t.scope])).toEqual([
      ["schedule_posts", "schedule"],
    ]);
    const posts = schedulePosts.inputSchema.properties.posts as {
      maxItems: number;
      items: { required: string[]; properties: Record<string, unknown> };
    };
    expect(posts.maxItems).toBe(MCP_SCHEDULE_MAX_CONTENTS);
    expect(MCP_SCHEDULE_MAX_CONTENTS).toBe(10);
    expect(posts.items.required).toEqual(["caption", "scheduledAt", "targets"]);
    expect(Object.keys(posts.items.properties)).not.toContain("workspaceId");
    expect(Object.keys(posts.items.properties)).not.toContain("userId");
    expect(schedulePosts.inputSchema.additionalProperties).toBe(false);
  });
});

describe("schedule_posts description (contract for the AI client)", () => {
  it("warns about missing idempotency, says rejected contents cost no quota while later failures do, and that one bad scheduledAt fails the call", () => {
    const text = schedulePosts.description;
    expect(text).toMatch(/idempotensi/);
    expect(text).toContain("list_scheduled_posts");
    expect(text).toMatch(/tidak memakai kuota/);
    expect(text).toMatch(/tetap memakai kuota/);
    expect(text).toMatch(/SELURUH panggilan.*invalid_input/);
  });
});

describe("schedule_posts handler", () => {
  it("passes grant identity, MCP source, and contents with the time read in the user zone", async () => {
    const { execute, scheduleContents } = fakeUseCase([scheduledOutcome(0)]);

    await schedulePosts.handler(context(scheduleContents), {
      posts: [content()],
    });

    const input = execute.mock.calls[0]![0];
    expect(input).toMatchObject({
      workspaceId: WORKSPACE,
      actingUserId: USER,
      source: {
        createdVia: PostCreatedVia.Mcp,
        clientId: CLIENT,
        clientName: "Claude Code",
      },
    });
    expect(input.contents).toEqual([
      {
        caption: "Halo",
        scheduledAt: new Date("2026-11-10T02:00:00.000Z"),
        targets: [{ connectedAccountId: ACCOUNT, contentFormat: "reel" }],
        mediaIds: [MEDIA],
      },
    ]);
  });

  it("reads the same wall-clock time in another user zone, and keeps an explicit offset as given", async () => {
    const { execute, scheduleContents } = fakeUseCase([
      scheduledOutcome(0),
      scheduledOutcome(1),
    ]);

    await schedulePosts.handler(
      context(scheduleContents, { timeZone: "America/New_York" }),
      {
        posts: [
          content(),
          content({ scheduledAt: "2026-11-10T09:00:00+07:00" }),
        ],
      },
    );

    const times = execute.mock.calls[0]![0].contents.map((c) =>
      c.scheduledAt.toISOString(),
    );
    expect(times).toEqual([
      "2026-11-10T14:00:00.000Z",
      "2026-11-10T02:00:00.000Z",
    ]);
  });

  it("reports each content, with the time in the user zone and error codes mapped for failures", async () => {
    const { scheduleContents } = fakeUseCase([
      scheduledOutcome(0, POST_1),
      {
        index: 1,
        status: "failed",
        kind: "invalid",
        message: "Format tidak diizinkan.",
      },
      {
        index: 2,
        status: "failed",
        kind: "schedule_failed",
        message: "Ditolak penyedia.",
        postId: POST_2,
      },
    ]);

    const output = await schedulePosts.handler(
      context(scheduleContents, { timeZone: "America/New_York" }),
      { posts: [content(), content(), content()] },
    );

    expect(output.data).toEqual({
      timezone: "America/New_York",
      summary: { requested: 3, scheduled: 1, failed: 2 },
      results: [
        {
          index: 0,
          status: "scheduled",
          postId: POST_1,
          caption: "Halo",
          mediaIds: [MEDIA],
          scheduledAt: "2026-11-09T21:00:00-05:00",
          targets: [
            {
              accountId: ACCOUNT,
              platform: "instagram",
              contentFormat: "reel",
            },
          ],
        },
        {
          index: 1,
          status: "failed",
          error: { code: "invalid_input", message: "Format tidak diizinkan." },
        },
        {
          index: 2,
          status: "failed",
          error: { code: "schedule_failed", message: "Ditolak penyedia." },
          postId: POST_2,
        },
      ],
    });
    // Tepat satu konten terjadwal: id post itu menjadi target audit.
    expect(output.targetId).toBe(POST_1);
  });

  it("gives no audit target when more than one content was scheduled", async () => {
    const { scheduleContents } = fakeUseCase([
      scheduledOutcome(0, POST_1),
      scheduledOutcome(1, POST_2),
    ]);

    const output = await schedulePosts.handler(context(scheduleContents), {
      posts: [
        content(),
        content({ targets: [{ accountId: ACCOUNT_2, contentFormat: "post" }] }),
      ],
    });

    expect(output.targetId).toBeUndefined();
  });

  it("forwards the use-case quota request to the context as scheduled_contents with the requested count (no workspace argument)", async () => {
    const { scheduleContents } = fakeUseCase([scheduledOutcome(0)]);
    const consumeQuota = vi.fn(async () => undefined);

    await schedulePosts.handler(context(scheduleContents, { consumeQuota }), {
      posts: [content()],
    });

    expect(consumeQuota).toHaveBeenCalledWith("scheduled_contents", 1);
  });

  it("rejects bad batches before touching the use-case: none, too many, not a list, unknown argument", async () => {
    const { execute, scheduleContents } = fakeUseCase([]);
    const run = (args: Record<string, unknown>) =>
      schedulePosts.handler(context(scheduleContents), args);

    await expect(run({ posts: [] })).rejects.toThrow(McpToolInputError);
    await expect(
      run({ posts: Array.from({ length: 11 }, () => content()) }),
    ).rejects.toThrow(/maksimum 10 konten/);
    await expect(run({ posts: "x" })).rejects.toThrow(McpToolInputError);
    await expect(run({})).rejects.toThrow(McpToolInputError);
    await expect(
      run({ posts: [content()], workspaceId: "ws-x" }),
    ).rejects.toThrow(/tidak dikenal/);
    expect(execute).not.toHaveBeenCalled();
  });

  it("accepts exactly the maximum batch size", async () => {
    const { execute, scheduleContents } = fakeUseCase(() =>
      Array.from({ length: 10 }, (_, i) => scheduledOutcome(i)),
    );

    await schedulePosts.handler(context(scheduleContents), {
      posts: Array.from({ length: 10 }, () => content()),
    });

    expect(execute.mock.calls[0]![0].contents).toHaveLength(10);
  });

  it("names the offending content when its shape is wrong", async () => {
    const { execute, scheduleContents } = fakeUseCase([]);
    const run = (posts: unknown[]) =>
      schedulePosts.handler(context(scheduleContents), { posts });

    await expect(
      run([content(), content({ scheduledAt: "besok" })]),
    ).rejects.toThrow(/posts\[1\]: scheduledAt/);
    await expect(run([content({ caption: 5 })])).rejects.toThrow(
      /posts\[0\]: .*caption/,
    );
    await expect(run([content({ targets: undefined })])).rejects.toThrow(
      /posts\[0\]: .*targets/,
    );
    await expect(run([content({ mediaIds: ["bukan-uuid"] })])).rejects.toThrow(
      /posts\[0\]: .*UUID/,
    );
    await expect(run([content({ extra: 1 })])).rejects.toThrow(
      /posts\[0\]: .*"extra"/,
    );
    await expect(run(["teks"])).rejects.toThrow(
      /posts\[0\] harus berupa objek/,
    );
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("schedule_posts through the gate (real McpAccessService and rate limit)", () => {
  const NOW = new Date("2026-11-02T03:00:20.000Z");
  const claims: McpClaims = {
    userId: USER,
    clientId: CLIENT,
    workspaceId: WORKSPACE,
    scopes: ["read", "schedule"],
  };
  const grant: McpGrant = {
    id: asMcpGrantId("grant-1"),
    workspaceId: WORKSPACE,
    userId: USER,
    clientId: CLIENT,
    clientName: "Claude",
    scopes: ["read", "schedule"],
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    lastUsedAt: null,
    revokedAt: null,
  };

  /** Penghitung dalam memori: menolak (all-or-nothing) bila melebihi batas. */
  function counters(): IMcpRateLimitRepository & {
    used: Record<string, number>;
    workspaces: Set<unknown>;
  } {
    const used: Record<string, number> = {};
    const workspaces = new Set<unknown>();
    return {
      used,
      workspaces,
      consume: async ({ workspaceId, quota, amount, limit }) => {
        workspaces.add(workspaceId);
        const next = (used[quota] ?? 0) + amount;
        if (next > limit) return { allowed: false };
        used[quota] = next;
        return { allowed: true, count: next } as never;
      },
      deleteExpired: async () => 0,
    };
  }

  function gate(
    repo: IMcpRateLimitRepository,
    execute: ReturnType<typeof vi.fn>,
  ) {
    const audits: Record<string, unknown>[] = [];
    const access = new McpAccessService(
      {
        findActiveByConnection: async () => grant,
        touchLastUsed: async () => undefined,
      } as unknown as IMcpGrantRepository,
      {
        create: async (input: Record<string, unknown>) => {
          audits.push(input);
          return { id: asMcpAuditLogId("a-1"), ...input } as McpAuditEntry;
        },
      } as unknown as IMcpAuditRepository,
      { revokeAtomically: async () => ({ revoked: true }) },
      { getMembership: async () => ({ status: MemberStatus.Active }) },
      () => NOW,
      new McpRateLimitService(repo, MCP_RATE_LIMIT_DEFAULTS, () => NOW),
    );
    const deps: McpGateDeps = {
      access,
      services: {
        identity: fakeIdentity("Asia/Jakarta"),
        scheduleContents: { execute },
      } as unknown as McpGateDeps["services"],
      logger: { error: vi.fn() },
    };
    return { deps, audits };
  }

  const parse = (r: { content: { type: string; text?: string }[] }) =>
    JSON.parse(r.content[0]?.text ?? "null");

  it("counts the quota the use-case reserves on the workspace of the grant, next to the call and write action", async () => {
    const repo = counters();
    const { deps } = gate(
      repo,
      vi.fn(async (input) => {
        await input.reserveQuota(input.contents.length);
        return input.contents.map((_: unknown, i: number) =>
          scheduledOutcome(i, asPostId(`p-${i}`)),
        );
      }),
    );

    const result = await runMcpTool(deps, claims, schedulePosts, {
      posts: [content(), content(), content()],
    });

    expect(result.isError).toBeUndefined();
    expect(repo.used.scheduled_contents).toBe(3);
    expect(repo.used.write_actions).toBe(1);
    expect(repo.used.calls).toBe(1);
    expect([...repo.workspaces]).toEqual([WORKSPACE]);
  });

  it("surfaces a refused reservation as rate_limited and leaves the counter untouched", async () => {
    const repo = counters();
    repo.used.scheduled_contents = 49; // batas bawaan 50 per hari
    const scheduled = vi.fn();
    const { deps } = gate(
      repo,
      vi.fn(async (input) => {
        await input.reserveQuota(input.contents.length); // 2 > sisa 1
        scheduled();
        return [];
      }),
    );

    const result = await runMcpTool(deps, claims, schedulePosts, {
      posts: [content(), content()],
    });

    expect(result.isError).toBe(true);
    expect(parse(result).error).toMatchObject({
      code: "rate_limited",
      quota: "scheduled_contents",
      limit: 50,
    });
    expect(scheduled).not.toHaveBeenCalled();
    expect(repo.used.scheduled_contents).toBe(49);
  });

  it("is refused without the schedule scope on the grant", async () => {
    const repo = counters();
    const execute = vi.fn();
    const { deps } = gate(repo, execute);

    const result = await runMcpTool(
      deps,
      { ...claims, scopes: ["read", "draft"] },
      schedulePosts,
      { posts: [content()] },
    );

    expect(result.isError).toBe(true);
    expect(parse(result).error.code).toBe("token_scope_insufficient");
    expect(execute).not.toHaveBeenCalled();
  });
});
