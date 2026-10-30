import {
  MediaType,
  MemberStatus,
  asMcpAuditLogId,
  asMcpGrantId,
  asMediaId,
  asUserId,
  asWorkspaceId,
} from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import {
  McpAccessService,
  McpRateLimitExceededError,
  type IMcpAuditRepository,
  type IMcpGrantRepository,
  type McpAuditEntry,
  type McpGrant,
} from "@/domains/mcp-access";
import type { MediaItemRecord } from "@/domains/media";
import { ValidationError } from "@/lib/utils/errors";
import { SafeFetchError } from "@/lib/net/safe-fetch";

import type { McpClaims } from "../claims";
import { runMcpTool, type McpGateDeps } from "../run-tool";
import { McpToolInputError, McpToolTemporaryError } from "../tool-input";
import type { McpToolContext, McpToolServices } from "../tool-types";
import { MCP_MEDIA_TOOLS, sanitizeFilename } from "./media-tools";

const WORKSPACE = asWorkspaceId("ws-1");
const USER = asUserId("user-1");
const CLIENT = "client-abc";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const HTML = Buffer.from("<html>not an image</html>");

const upload = MCP_MEDIA_TOOLS[0]!;

function record(overrides: Partial<MediaItemRecord> = {}): MediaItemRecord {
  return {
    id: asMediaId("33333333-3333-4333-8333-333333333333"),
    workspaceId: WORKSPACE,
    uploaderId: USER,
    filename: "pic.png",
    mimeType: "image/png",
    size: BigInt(PNG.byteLength),
    url: "https://signed.example/pic",
    storagePath: "p",
    outstandMediaId: null,
    outstandMediaUrl: null,
    outstandUploadedAt: null,
    outstandExpiresAt: null,
    type: MediaType.Image,
    width: null,
    height: null,
    duration: null,
    createdAt: new Date("2026-10-30T03:00:00.000Z"),
    ...overrides,
  };
}

function fakes(opts: { bytes?: Buffer; downloadError?: Error } = {}) {
  const execute = vi.fn(async () => record());
  const download = vi.fn(async (url: string) => {
    if (opts.downloadError) throw opts.downloadError;
    return { bytes: opts.bytes ?? PNG, finalUrl: new URL(url) };
  });
  const services = {
    mediaUpload: { execute },
    remoteMedia: { download },
  } as unknown as McpToolServices;
  return { services, execute, download };
}

function context(services: McpToolServices): McpToolContext {
  return {
    workspaceId: WORKSPACE,
    userId: USER,
    clientId: CLIENT,
    clientName: "Claude",
    grantScopes: ["read", "draft"],
    services,
  };
}

describe("upload_media tool", () => {
  it("is registered once with scope draft and a closed schema without identity params", () => {
    expect(MCP_MEDIA_TOOLS.map((t) => [t.name, t.scope])).toEqual([
      ["upload_media", "draft"],
    ]);
    expect(Object.keys(upload.inputSchema.properties).sort()).toEqual([
      "filename",
      "url",
    ]);
    expect(upload.inputSchema.required).toEqual(["url"]);
    expect(upload.inputSchema.additionalProperties).toBe(false);
  });

  it("downloads, detects type from content, uploads with grant identity, and maps the result", async () => {
    const f = fakes();
    const out = await upload.handler(context(f.services), {
      url: "https://cdn.example/path/pic.png",
    });
    expect(f.download).toHaveBeenCalledWith("https://cdn.example/path/pic.png");
    expect(f.execute).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      uploaderId: USER,
      actingUserId: USER,
      filename: "pic.png",
      mimeType: "image/png",
      fileBuffer: PNG,
    });
    expect(out.targetId).toBe("33333333-3333-4333-8333-333333333333");
    expect(out.data).toMatchObject({
      id: "33333333-3333-4333-8333-333333333333",
      filename: "pic.png",
      type: "image",
      mimeType: "image/png",
      sizeBytes: PNG.byteLength,
      url: "https://signed.example/pic",
    });
  });

  it("omits url when storage returned none", async () => {
    const f = fakes();
    f.execute.mockResolvedValueOnce(record({ url: null }));
    const out = await upload.handler(context(f.services), {
      url: "https://a.example/x",
    });
    expect(out.data).not.toHaveProperty("url");
  });

  it("ignores a lying server: only content decides, HTML body is rejected and nothing is stored", async () => {
    const f = fakes({ bytes: HTML });
    await expect(
      upload.handler(context(f.services), { url: "https://a.example/x.png" }),
    ).rejects.toThrow(/tipe yang didukung/);
    expect(f.execute).not.toHaveBeenCalled();
  });

  it("uses the detected MIME even when the URL extension claims otherwise", async () => {
    const f = fakes();
    await upload.handler(context(f.services), {
      url: "https://a.example/x.mp4",
    });
    expect(f.execute).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: "image/png" }),
    );
  });

  it("rejects unknown arguments, including identity overrides", async () => {
    const f = fakes();
    for (const extra of [
      { workspaceId: "other" },
      { userId: "x" },
      { mimeType: "video/mp4" },
    ]) {
      await expect(
        upload.handler(context(f.services), {
          url: "https://a.example/x",
          ...extra,
        }),
      ).rejects.toBeInstanceOf(McpToolInputError);
    }
    expect(f.download).not.toHaveBeenCalled();
  });

  it("validates url and filename arguments", async () => {
    const f = fakes();
    const run = (args: Record<string, unknown>) =>
      upload.handler(context(f.services), args);
    await expect(run({})).rejects.toBeInstanceOf(McpToolInputError);
    await expect(run({ url: 5 })).rejects.toBeInstanceOf(McpToolInputError);
    await expect(run({ url: "  " })).rejects.toBeInstanceOf(McpToolInputError);
    await expect(
      run({ url: `https://a.example/${"a".repeat(3000)}` }),
    ).rejects.toBeInstanceOf(McpToolInputError);
    await expect(
      run({ url: "https://a.example/x", filename: "a".repeat(121) }),
    ).rejects.toBeInstanceOf(McpToolInputError);
    await expect(
      run({ url: "https://a.example/x", filename: 5 }),
    ).rejects.toBeInstanceOf(McpToolInputError);
    expect(f.download).not.toHaveBeenCalled();
  });

  it("sanitizes the provided filename and falls back to the URL, then a generic name", async () => {
    const f = fakes();
    await upload.handler(context(f.services), {
      url: "https://a.example/ignored.png",
      filename: "../../etc/pa\u0000sswd\n.png",
    });
    expect(f.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ filename: "passwd .png".replace(" ", "") }),
    );
    await upload.handler(context(f.services), {
      url: "https://a.example/",
      filename: "///",
    });
    expect(f.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ filename: "media.png" }),
    );
  });

  it("maps SafeFetchError to a generic ValidationError without leaking details", async () => {
    const f = fakes({
      downloadError: new SafeFetchError("blocked_destination"),
    });
    const error = await upload
      .handler(context(f.services), { url: "https://a.example/x" })
      .catch((e: unknown) => e);
    expect((error as Error).name).toBe("ValidationError");
    expect((error as Error).message).toBe(
      new SafeFetchError("blocked_destination").message,
    );
    expect(f.execute).not.toHaveBeenCalled();
  });

  it.each([
    "too_large",
    "empty_body",
    "bad_status",
    "invalid_url",
    "blocked_destination",
    "unsupported_encoding",
    "too_many_redirects",
    "network_error",
  ] as const)(
    "maps SafeFetchError %s to a generic ValidationError (invalid_input)",
    async (code) => {
      const f = fakes({ downloadError: new SafeFetchError(code) });
      const error = await upload
        .handler(context(f.services), { url: "https://a.example/x" })
        .catch((e: unknown) => e);
      expect((error as Error).name).toBe("ValidationError");
      expect((error as Error).message).toBe(new SafeFetchError(code).message);
      expect(f.execute).not.toHaveBeenCalled();
    },
  );

  it.each(["busy", "timeout"] as const)(
    "maps SafeFetchError %s to a retryable error, not invalid_input",
    async (code) => {
      const f = fakes({ downloadError: new SafeFetchError(code) });
      const error = await upload
        .handler(context(f.services), { url: "https://a.example/x" })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(McpToolTemporaryError);
      expect((error as Error).message).toBe(new SafeFetchError(code).message);
      expect(f.execute).not.toHaveBeenCalled();
    },
  );

  it("propagates a ValidationError thrown by mediaUpload.execute", async () => {
    const f = fakes();
    f.execute.mockRejectedValueOnce(
      new ValidationError("Ukuran file melebihi batas."),
    );
    await expect(
      upload.handler(context(f.services), { url: "https://a.example/x" }),
    ).rejects.toMatchObject({
      name: "ValidationError",
      message: "Ukuran file melebihi batas.",
    });
  });

  it("lets unexpected download errors propagate (gate reports internal_error)", async () => {
    const f = fakes({ downloadError: new Error("boom") });
    await expect(
      upload.handler(context(f.services), { url: "https://a.example/x" }),
    ).rejects.toThrow("boom");
  });
});

describe("sanitizeFilename", () => {
  it("strips paths, control chars, leading dots; returns null when empty", () => {
    expect(sanitizeFilename("a/b\\c.png")).toBe("c.png");
    expect(sanitizeFilename("..hidden.png")).toBe("hidden.png");
    expect(sanitizeFilename("   ")).toBeNull();
    expect(sanitizeFilename("fo\u202Eo\u200Bb.png")).toBe("foob.png");
    expect(sanitizeFilename("\u202E\u200B\u2028")).toBeNull();
    expect(sanitizeFilename("x".repeat(300))).toHaveLength(120);
  });
});

describe("upload_media behind the real authorization gate", () => {
  const claims = (scopes: McpClaims["scopes"]): McpClaims => ({
    userId: USER,
    clientId: CLIENT,
    workspaceId: WORKSPACE,
    scopes,
  });

  function gate(grantScopes: McpGrant["scopes"], rateLimitError?: Error) {
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
    const assertWithinLimit = vi.fn(async () => {
      if (rateLimitError) throw rateLimitError;
    });
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
      undefined,
      { assertWithinLimit } as never,
    );
    const f = fakes();
    const deps: McpGateDeps = { access, services: f.services };
    return { deps, audits, assertWithinLimit, ...f };
  }

  const args = { url: "https://a.example/pic.png" };

  it("runs with draft scope, counts it as a write action, and audits the media id", async () => {
    const g = gate(["read", "draft"]);
    const res = await runMcpTool(
      g.deps,
      claims(["read", "draft"]),
      upload,
      args,
    );
    expect(res.isError).toBeUndefined();
    expect(g.assertWithinLimit).toHaveBeenCalledWith(
      expect.objectContaining({ requiredScope: "draft" }),
    );
    expect(g.audits[0]).toMatchObject({
      toolName: "upload_media",
      scope: "draft",
      status: "success",
      targetId: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("refuses a read-only token and never downloads", async () => {
    const g = gate(["read", "draft"]);
    const res = await runMcpTool(g.deps, claims(["read"]), upload, args);
    expect(res.isError).toBe(true);
    expect(
      JSON.parse((res.content[0] as { text: string }).text).error.code,
    ).toBe("token_scope_insufficient");
    expect(g.download).not.toHaveBeenCalled();
  });

  it("refuses when the grant has no draft scope", async () => {
    const g = gate(["read"]);
    const res = await runMcpTool(
      g.deps,
      claims(["read", "draft"]),
      upload,
      args,
    );
    expect(
      JSON.parse((res.content[0] as { text: string }).text).error.code,
    ).toBe("grant_scope_insufficient");
    expect(g.download).not.toHaveBeenCalled();
  });

  it("returns rate_limited before any download when the write quota is exhausted", async () => {
    const g = gate(
      ["read", "draft"],
      new McpRateLimitExceededError({
        grantId: asMcpGrantId("g-1"),
        quota: "write_actions",
        limit: 30,
        retryAfterSeconds: 60,
      } as never),
    );
    const res = await runMcpTool(
      g.deps,
      claims(["read", "draft"]),
      upload,
      args,
    );
    expect(
      JSON.parse((res.content[0] as { text: string }).text).error.code,
    ).toBe("rate_limited");
    expect(g.download).not.toHaveBeenCalled();
  });

  it.each(["busy", "timeout"] as const)(
    "reports %s through the gate as temporarily_unavailable",
    async (code) => {
      const g = gate(["read", "draft"]);
      g.download.mockRejectedValueOnce(new SafeFetchError(code));
      const res = await runMcpTool(
        g.deps,
        claims(["read", "draft"]),
        upload,
        args,
      );
      const body = JSON.parse((res.content[0] as { text: string }).text);
      expect(body.error.code).toBe("temporarily_unavailable");
      expect(g.audits[0]).toMatchObject({
        status: "error",
        errorCode: "temporarily_unavailable",
      });
    },
  );

  it("makes network_error and blocked_destination indistinguishable at the gate (no DNS enumeration oracle)", async () => {
    const results: string[] = [];
    for (const code of ["network_error", "blocked_destination"] as const) {
      const g = gate(["read", "draft"]);
      g.download.mockRejectedValueOnce(new SafeFetchError(code));
      const res = await runMcpTool(
        g.deps,
        claims(["read", "draft"]),
        upload,
        args,
      );
      results.push((res.content[0] as { text: string }).text);
      expect(g.audits[0]).toMatchObject({ errorCode: "invalid_input" });
    }
    expect(results[0]).toBe(results[1]);
    expect(JSON.parse(results[0] as string).error.code).toBe("invalid_input");
  });

  it("reports a blocked destination as invalid_input with the generic message", async () => {
    const g = gate(["read", "draft"]);
    g.download.mockRejectedValueOnce(new SafeFetchError("blocked_destination"));
    const res = await runMcpTool(
      g.deps,
      claims(["read", "draft"]),
      upload,
      args,
    );
    const body = JSON.parse((res.content[0] as { text: string }).text);
    expect(body.error.code).toBe("invalid_input");
    expect(g.audits[0]).toMatchObject({
      status: "error",
      errorCode: "invalid_input",
    });
  });
});
