import {
  ContentFormat,
  ContentStatus,
  MemberStatus,
  PostCreatedVia,
  SocialPlatform,
  asConnectedAccountId,
  asMcpAuditLogId,
  asMcpGrantId,
  asMediaId,
  asPostId,
  asUserId,
  asWorkspaceId,
} from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import {
  McpAccessService,
  type IMcpAuditRepository,
  type IMcpGrantRepository,
  type McpAuditEntry,
  type McpGrant,
} from "@/domains/mcp-access";
import type {
  ComposeDraftResult,
  ComposeDraftUseCase,
} from "@/domains/publishing";
import { ConflictError } from "@/lib/utils/errors";

import type { McpClaims } from "../claims";
import { runMcpTool, type McpGateDeps } from "../run-tool";
import { McpToolInputError } from "../tool-input";
import type { McpToolContext, McpToolServices } from "../tool-types";
import { MCP_DRAFT_TOOLS } from "./draft-tools";

/**
 * Handler tool draft dites dengan use-case palsu lokal yang merekam panggilan
 * (AGENTS.md #11): yang diuji pemetaan argumen -> use-case, identitas dari
 * grant, penanda sumber MCP, dan bentuk keluaran. Aturan domain (status,
 * matriks format, batas) dites di `compose-draft.use-case.test.ts`.
 */

const WORKSPACE = asWorkspaceId("ws-1");
const USER = asUserId("user-1");
const CLIENT = "client-abc";
const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const MEDIA = "33333333-3333-4333-8333-333333333333";
const POST = "22222222-2222-4222-8222-222222222222";

function result(overrides: Partial<ComposeDraftResult["post"]> = {}) {
  return {
    post: {
      id: asPostId(POST),
      workspaceId: WORKSPACE,
      authorId: USER,
      caption: "Halo dunia",
      status: ContentStatus.Draft,
      mediaIds: [asMediaId(MEDIA)],
      createdVia: PostCreatedVia.Mcp,
      createdViaClientId: CLIENT,
      createdAt: new Date("2026-10-30T03:00:00.000Z"),
      updatedAt: new Date("2026-10-30T03:30:00.000Z"),
      ...overrides,
    },
    targets: [
      {
        connectedAccountId: asConnectedAccountId(ACCOUNT),
        platform: SocialPlatform.Instagram,
        contentFormat: ContentFormat.Reel,
      },
    ],
  } satisfies ComposeDraftResult;
}

function fakeDrafts(error?: Error) {
  const createDraft = vi.fn(async () => {
    if (error) throw error;
    return result();
  });
  const updateDraft = vi.fn(async () => {
    if (error) throw error;
    return result({ createdVia: PostCreatedVia.App, createdViaClientId: null });
  });
  const drafts = { createDraft, updateDraft } as unknown as Pick<
    ComposeDraftUseCase,
    "createDraft" | "updateDraft"
  >;
  return { drafts, createDraft, updateDraft };
}

function context(drafts: McpToolServices["drafts"]): McpToolContext {
  return {
    workspaceId: WORKSPACE,
    userId: USER,
    clientId: CLIENT,
    clientName: "Claude Code",
    grantScopes: ["read", "draft"],
    services: { drafts } as McpToolServices,
  };
}

function tool(name: string) {
  const found = MCP_DRAFT_TOOLS.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`tool ${name} tidak ada`);
  return found;
}

describe("MCP_DRAFT_TOOLS registry", () => {
  it("exposes exactly create_draft and update_draft, both scope draft", () => {
    expect(MCP_DRAFT_TOOLS.map((t) => [t.name, t.scope])).toEqual([
      ["create_draft", "draft"],
      ["update_draft", "draft"],
    ]);
  });

  it("declares no workspaceId or userId parameter (identity comes from the grant)", () => {
    for (const t of MCP_DRAFT_TOOLS) {
      expect(Object.keys(t.inputSchema.properties)).not.toContain(
        "workspaceId",
      );
      expect(Object.keys(t.inputSchema.properties)).not.toContain("userId");
      expect(t.inputSchema.additionalProperties).toBe(false);
    }
  });

  it("limits contentFormat in the schema to the known ContentFormat values", () => {
    const targets = tool("create_draft").inputSchema.properties.targets as {
      items: { properties: { contentFormat: { enum: string[] } } };
    };
    expect(targets.items.properties.contentFormat.enum).toEqual(
      Object.values(ContentFormat),
    );
  });
});

describe("create_draft", () => {
  it("stamps the MCP source with the grant client id and takes workspace and user from the context", async () => {
    const { drafts, createDraft } = fakeDrafts();

    const output = await tool("create_draft").handler(context(drafts), {
      caption: "Halo dunia",
      mediaIds: [MEDIA],
      targets: [{ accountId: ACCOUNT, contentFormat: "reel" }],
    });

    expect(createDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      authorId: USER,
      caption: "Halo dunia",
      source: {
        createdVia: PostCreatedVia.Mcp,
        clientId: CLIENT,
        clientName: "Claude Code",
      },
      mediaIds: [MEDIA],
      targets: [{ connectedAccountId: ACCOUNT, contentFormat: "reel" }],
    });
    expect(output.targetId).toBe(POST);
    expect(output.data).toEqual({
      id: POST,
      status: "draft",
      caption: "Halo dunia",
      mediaIds: [MEDIA],
      targets: [
        { accountId: ACCOUNT, platform: "instagram", contentFormat: "reel" },
      ],
      createdVia: "mcp",
      createdAt: "2026-10-30T10:00:00+07:00",
      updatedAt: "2026-10-30T10:30:00+07:00",
    });
  });

  it("omits media and targets when the arguments are absent and accepts an empty caption", async () => {
    const { drafts, createDraft } = fakeDrafts();

    await tool("create_draft").handler(context(drafts), { caption: "" });

    expect(createDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      authorId: USER,
      caption: "",
      source: {
        createdVia: PostCreatedVia.Mcp,
        clientId: CLIENT,
        clientName: "Claude Code",
      },
    });
  });

  it("rejects a workspaceId smuggled in the arguments", async () => {
    const { drafts, createDraft } = fakeDrafts();
    await expect(
      tool("create_draft").handler(context(drafts), {
        caption: "x",
        workspaceId: "ws-other",
      }),
    ).rejects.toThrow(McpToolInputError);
    expect(createDraft).not.toHaveBeenCalled();
  });

  it.each([
    ["caption missing", {}],
    ["caption not a string", { caption: 5 }],
    ["mediaIds not an array", { caption: "x", mediaIds: MEDIA }],
    ["mediaIds item not a uuid", { caption: "x", mediaIds: ["nope"] }],
    ["targets not an array", { caption: "x", targets: {} }],
    ["target not an object", { caption: "x", targets: ["a"] }],
    [
      "target accountId not a uuid",
      { caption: "x", targets: [{ accountId: "a", contentFormat: "post" }] },
    ],
    [
      "target without contentFormat",
      { caption: "x", targets: [{ accountId: ACCOUNT }] },
    ],
    [
      "target with unknown field",
      {
        caption: "x",
        targets: [
          { accountId: ACCOUNT, contentFormat: "post", platformOptions: {} },
        ],
      },
    ],
  ])("rejects %s before touching the use-case", async (_label, args) => {
    const { drafts, createDraft } = fakeDrafts();
    await expect(
      tool("create_draft").handler(context(drafts), args),
    ).rejects.toThrow(McpToolInputError);
    expect(createDraft).not.toHaveBeenCalled();
  });
});

describe("update_draft", () => {
  it("passes only the provided fields and the acting user, and never sets a creation source", async () => {
    const { drafts, updateDraft } = fakeDrafts();

    const output = await tool("update_draft").handler(context(drafts), {
      postId: POST,
      caption: "Baru",
    });

    expect(updateDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      actingUserId: USER,
      postId: POST,
      caption: "Baru",
    });
    expect(output.targetId).toBe(POST);
    // Penanda sumber pembuatan tidak berubah oleh update.
    expect((output.data as { createdVia: string }).createdVia).toBe("app");
  });

  it("forwards empty arrays (clear media and targets) distinct from absent ones", async () => {
    const { drafts, updateDraft } = fakeDrafts();

    await tool("update_draft").handler(context(drafts), {
      postId: POST,
      mediaIds: [],
      targets: [],
    });

    expect(updateDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      actingUserId: USER,
      postId: POST,
      mediaIds: [],
      targets: [],
    });
  });

  it.each([
    ["postId missing", { caption: "x" }],
    ["postId not a uuid", { postId: "bukan-uuid" }],
    ["caption not a string", { postId: POST, caption: 1 }],
  ])("rejects %s", async (_label, args) => {
    const { drafts, updateDraft } = fakeDrafts();
    await expect(
      tool("update_draft").handler(context(drafts), args),
    ).rejects.toThrow(McpToolInputError);
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it("lets a domain conflict (e.g. a scheduled post) propagate to the gate", async () => {
    const { drafts } = fakeDrafts(new ConflictError("Post sudah dijadwalkan."));
    await expect(
      tool("update_draft").handler(context(drafts), { postId: POST }),
    ).rejects.toThrow("Post sudah dijadwalkan.");
  });
});

/**
 * Gerbang + `McpAccessService` asli: tool draft butuh scope `draft` di token
 * DAN di grant; koneksi `read` saja ditolak dan handler tidak jalan.
 */
describe("draft tools behind the real authorization gate", () => {
  const claims = (scopes: McpClaims["scopes"]): McpClaims => ({
    userId: USER,
    clientId: CLIENT,
    workspaceId: WORKSPACE,
    scopes,
  });

  function gate(grantScopes: McpGrant["scopes"]) {
    const audits: Record<string, unknown>[] = [];
    const grant: McpGrant = {
      id: asMcpGrantId("g-1"),
      workspaceId: WORKSPACE,
      userId: USER,
      clientId: CLIENT,
      clientName: "Claude",
      scopes: grantScopes,
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      lastUsedAt: null,
      revokedAt: null,
    };
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
    );
    const { drafts, createDraft } = fakeDrafts();
    const deps: McpGateDeps = {
      access,
      services: { drafts } as McpToolServices,
    };
    return { deps, audits, createDraft };
  }

  const args = { caption: "Rahasia jangan dicatat penuh" };

  it("runs create_draft with draft scope on token and grant, audits success with the new post id and no caption", async () => {
    const { deps, audits, createDraft } = gate(["read", "draft"]);

    const response = await runMcpTool(
      deps,
      claims(["read", "draft"]),
      tool("create_draft"),
      args,
    );

    expect(response.isError).toBeUndefined();
    expect(createDraft).toHaveBeenCalledOnce();
    expect(audits[0]).toMatchObject({
      toolName: "create_draft",
      scope: "draft",
      status: "success",
      targetId: POST,
    });
    expect(JSON.stringify(audits[0])).not.toContain("Rahasia");
  });

  it("refuses a read-only token, runs no handler, and audits the denial", async () => {
    const { deps, audits, createDraft } = gate(["read", "draft"]);

    const response = await runMcpTool(
      deps,
      claims(["read"]),
      tool("create_draft"),
      args,
    );

    expect(response.isError).toBe(true);
    expect(
      JSON.parse(String((response.content[0] as { text: string }).text)),
    ).toMatchObject({ error: { code: "token_scope_insufficient" } });
    expect(createDraft).not.toHaveBeenCalled();
    expect(audits[0]).toMatchObject({ status: "denied" });
  });

  it("refuses when the grant was narrowed to read even though the token still says draft", async () => {
    const { deps, createDraft } = gate(["read"]);

    const response = await runMcpTool(
      deps,
      claims(["read", "draft"]),
      tool("update_draft"),
      { postId: POST, caption: "x" },
    );

    expect(
      JSON.parse(String((response.content[0] as { text: string }).text)).error
        .code,
    ).toBe("grant_scope_insufficient");
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("maps a conflict from update_draft to a clear conflict error and audits it as an error", async () => {
    const { deps, audits } = gate(["read", "draft"]);
    deps.services = {
      drafts: fakeDrafts(new ConflictError("Post ini sudah dijadwalkan."))
        .drafts,
    } as McpToolServices;

    const response = await runMcpTool(
      deps,
      claims(["read", "draft"]),
      tool("update_draft"),
      { postId: POST, caption: "x" },
    );

    expect(response.isError).toBe(true);
    expect(
      JSON.parse(String((response.content[0] as { text: string }).text)),
    ).toEqual({
      error: { code: "conflict", message: "Post ini sudah dijadwalkan." },
    });
    expect(audits[0]).toMatchObject({ status: "error", errorCode: "conflict" });
  });
});
