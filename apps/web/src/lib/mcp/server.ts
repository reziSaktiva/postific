import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import type { McpClaims } from "./claims";
import { mcpErrorResult, runMcpTool, type McpGateDeps } from "./run-tool";
import { MCP_DRAFT_TOOLS } from "./tools/draft-tools";
import { MCP_READ_TOOLS } from "./tools/read-tools";
import type { McpToolDefinition } from "./tool-types";

/**
 * Builder server MCP produksi (T-150.2). Stateless: satu `Server` baru per
 * request, identitas dari klaim token. `tools/list` statis; gerbang scope,
 * grant, dan member dijalankan per panggilan di `runMcpTool`.
 *
 * Memakai `Server` tingkat rendah (bukan `McpServer`) karena `McpServer`
 * mewajibkan skema zod, sedangkan zod bukan dependensi langsung `apps/web`;
 * input schema ditulis sebagai JSON Schema dan divalidasi di `tool-input.ts`.
 */

export const MCP_SERVER_NAME = "postific";
export const MCP_SERVER_VERSION = "0.1.0";

/**
 * Tool yang diekspos `tools/list`: baca (T-150) lalu draft (T-152). Tool
 * berikutnya (`upload_media`, `schedule_posts`) ditambah di sini.
 */
export const MCP_TOOLS: readonly McpToolDefinition[] = [
  ...MCP_READ_TOOLS,
  ...MCP_DRAFT_TOOLS,
];

export function createMcpServer(
  claims: McpClaims,
  deps: McpGateDeps,
  tools: readonly McpToolDefinition[] = MCP_TOOLS,
): Server {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const server = new Server(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: tool.scope === "read" },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = byName.get(request.params.name);
    if (!tool) {
      return mcpErrorResult(
        "invalid_input",
        `Tool "${request.params.name}" tidak dikenal.`,
      );
    }
    return runMcpTool(deps, claims, tool, request.params.arguments ?? {});
  });

  return server;
}
