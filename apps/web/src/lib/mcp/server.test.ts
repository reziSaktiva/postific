import { asMcpGrantId, asUserId, asWorkspaceId } from "@postific/shared";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { describe, expect, it, vi } from "vitest";
import { McpAccessDeniedError } from "@/domains/mcp-access";

import type { McpClaims } from "./claims";
import type { McpGateDeps } from "./run-tool";
import { createMcpServer } from "./server";

const WS = asWorkspaceId("ws-1");
const claims: McpClaims = {
  userId: asUserId("user-1"),
  clientId: "client-1",
  workspaceId: WS,
  scopes: ["read"],
};

async function rpc(deps: McpGateDeps, body: unknown) {
  const server = createMcpServer(claims, deps);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  const response = await transport.handleRequest(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(body),
    }),
  );
  return JSON.parse(await response.text());
}

function deps(overrides: Partial<McpGateDeps["access"]> = {}) {
  const access = {
    authorizeCall: vi.fn(async () => ({
      grantId: asMcpGrantId("g-1"),
      userId: claims.userId,
      workspaceId: WS,
      clientId: claims.clientId,
      clientName: "Claude",
      grantScopes: ["read" as const],
    })),
    recordAudit: vi.fn(async () => ({}) as never),
    ...overrides,
  };
  const services = {
    workspace: {
      getWorkspaceById: vi.fn(async () => ({
        id: WS,
        name: "Brand Co",
        slug: "b",
      })),
      listConnectedAccounts: vi.fn(async () => []),
    },
  } as unknown as McpGateDeps["services"];
  return { value: { access, services } as McpGateDeps, access, services };
}

describe("createMcpServer over Streamable HTTP", () => {
  it("lists the eight read tools, the two draft tools, and upload_media with JSON Schema inputs", async () => {
    const { value } = deps();
    const body = await rpc(value, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });
    const names = body.result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toEqual([
      "get_workspace",
      "list_accounts",
      "list_media",
      "list_drafts",
      "list_scheduled_posts",
      "list_published_posts",
      "get_analytics",
      "list_comments",
      "create_draft",
      "update_draft",
      "upload_media",
    ]);
    expect(body.result.tools[0].inputSchema.type).toBe("object");
    expect(body.result.tools[0].annotations.readOnlyHint).toBe(true);
    const createDraft = body.result.tools.find(
      (tool: { name: string }) => tool.name === "create_draft",
    );
    expect(createDraft.annotations.readOnlyHint).toBe(false);
    expect(createDraft.inputSchema.required).toEqual(["caption"]);
  });

  it("calls get_workspace end to end, with the workspace taken from the claims", async () => {
    const { value, access, services } = deps();
    const body = await rpc(value, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "get_workspace", arguments: {} },
    });

    expect(body.result.isError).toBeUndefined();
    expect(JSON.parse(body.result.content[0].text)).toMatchObject({
      workspaceId: "ws-1",
      name: "Brand Co",
      grantedScopes: ["read"],
    });
    expect(access.authorizeCall).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: WS, requiredScope: "read" }),
    );
    expect(services.workspace.getWorkspaceById).toHaveBeenCalledWith(WS);
  });

  it("returns a tool error (not a protocol error, not empty data) when authorization is denied", async () => {
    const { value } = deps({
      authorizeCall: vi.fn(async () => {
        throw new McpAccessDeniedError("no_active_grant");
      }),
    });
    const body = await rpc(value, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_workspace", arguments: {} },
    });
    expect(body.error).toBeUndefined();
    expect(body.result.isError).toBe(true);
    expect(JSON.parse(body.result.content[0].text).error.code).toBe(
      "no_active_grant",
    );
  });

  it("rejects an unknown tool without touching authorization", async () => {
    const { value, access } = deps();
    const body = await rpc(value, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "delete_everything", arguments: {} },
    });
    expect(body.result.isError).toBe(true);
    expect(access.authorizeCall).not.toHaveBeenCalled();
  });
});
