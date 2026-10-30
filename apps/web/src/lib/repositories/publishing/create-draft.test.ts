import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, findFirst } = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/prisma/client", () => ({ prisma: {} }));
vi.mock("@/lib/prisma/with-current-user", () => ({
  withCurrentUser: (
    _userId: string,
    fn: (tx: unknown) => Promise<unknown>,
  ): Promise<unknown> => fn({ publishingPost: { create, findFirst } }),
}));

import { PostCreatedVia, asUserId, asWorkspaceId } from "@postific/shared";
import { publishingRepository } from "./publishing.repository";

const WORKSPACE = asWorkspaceId("ws-1");
const AUTHOR = asUserId("user-1");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    workspaceId: "ws-1",
    authorId: "user-1",
    caption: "c",
    status: "draft",
    mediaIds: [],
    createdVia: "app",
    createdViaClientId: null,
    createdViaClientName: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

describe("publishingRepository.createDraft creation source (T-152)", () => {
  beforeEach(() => {
    create.mockReset();
    findFirst.mockReset();
  });

  it("writes the MCP source and client id when the draft comes from MCP", async () => {
    create.mockResolvedValue(
      row({ createdVia: "mcp", createdViaClientId: "client-1" }),
    );

    const post = await publishingRepository.createDraft({
      workspaceId: WORKSPACE,
      authorId: AUTHOR,
      caption: "c",
      source: { createdVia: PostCreatedVia.Mcp, clientId: "client-1" },
    });

    expect(create.mock.calls[0]?.[0].data).toEqual({
      workspaceId: WORKSPACE,
      authorId: AUTHOR,
      caption: "c",
      createdVia: "mcp",
      createdViaClientId: "client-1",
      createdViaClientName: null,
    });
    expect(post.createdVia).toBe(PostCreatedVia.Mcp);
    expect(post.createdViaClientId).toBe("client-1");
  });

  it("freezes the client name on the post when the MCP source carries one", async () => {
    create.mockResolvedValue(
      row({
        createdVia: "mcp",
        createdViaClientId: "client-1",
        createdViaClientName: "Claude Code",
      }),
    );

    const post = await publishingRepository.createDraft({
      workspaceId: WORKSPACE,
      authorId: AUTHOR,
      caption: "c",
      source: {
        createdVia: PostCreatedVia.Mcp,
        clientId: "client-1",
        clientName: "Claude Code",
      },
    });

    expect(create.mock.calls[0]?.[0].data).toMatchObject({
      createdViaClientId: "client-1",
      createdViaClientName: "Claude Code",
    });
    expect(post.createdViaClientName).toBe("Claude Code");
  });

  it("stores a null client name when the MCP source has none", async () => {
    create.mockResolvedValue(
      row({ createdVia: "mcp", createdViaClientId: "client-1" }),
    );
    await publishingRepository.createDraft({
      workspaceId: WORKSPACE,
      authorId: AUTHOR,
      caption: "c",
      source: { createdVia: PostCreatedVia.Mcp, clientId: "client-1" },
    });
    expect(create.mock.calls[0]?.[0].data.createdViaClientName).toBeNull();
  });

  it("leaves the source columns to the DB default for a manual draft (existing callers unchanged)", async () => {
    create.mockResolvedValue(row());

    const post = await publishingRepository.createDraft({
      workspaceId: WORKSPACE,
      authorId: AUTHOR,
      caption: "c",
    });

    const data = create.mock.calls[0]?.[0].data;
    expect(data).not.toHaveProperty("createdVia");
    expect(data).not.toHaveProperty("createdViaClientId");
    expect(post.createdVia).toBe(PostCreatedVia.App);
    expect(post.createdViaClientId).toBeNull();
  });

  it("an explicit app source also writes nothing (default column) and never a client id", async () => {
    create.mockResolvedValue(row());

    await publishingRepository.createDraft({
      workspaceId: WORKSPACE,
      authorId: AUTHOR,
      caption: "c",
      source: { createdVia: PostCreatedVia.App },
    });

    expect(create.mock.calls[0]?.[0].data).not.toHaveProperty(
      "createdViaClientId",
    );
  });

  it("exposes the source on a draft read back by id", async () => {
    findFirst.mockResolvedValue(
      row({ createdVia: "mcp", createdViaClientId: "client-9", targets: [] }),
    );

    const post = await publishingRepository.findDraftById(
      { workspaceId: WORKSPACE, postId: "post-1" as never },
      AUTHOR,
    );

    expect(post?.createdVia).toBe(PostCreatedVia.Mcp);
    expect(post?.createdViaClientId).toBe("client-9");
  });
});
