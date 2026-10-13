import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerEnv } = vi.hoisted(() => ({ getServerEnv: vi.fn() }));
vi.mock("@/lib/env", () => ({ getServerEnv }));

const { verifyOutstandWebhookSignature } = vi.hoisted(() => ({
  verifyOutstandWebhookSignature: vi.fn(),
}));
vi.mock("@/lib/adapters/outstand/verify-webhook-signature", () => ({
  verifyOutstandWebhookSignature,
}));

const { insertIfNew, markProcessed, markFailed } = vi.hoisted(() => ({
  insertIfNew: vi.fn(),
  markProcessed: vi.fn(),
  markFailed: vi.fn(),
}));
vi.mock("@/lib/webhooks/outstand-webhook-receipt-store", () => ({
  outstandWebhookReceiptStore: { insertIfNew, markProcessed, markFailed },
}));

const { getOutstandAdapter } = vi.hoisted(() => ({
  getOutstandAdapter: vi.fn(() => ({})),
}));
vi.mock("@/lib/adapters/outstand", () => ({
  getOutstandAdapter,
}));
vi.mock("@/lib/repositories/publishing", () => ({ publishingRepository: {} }));
vi.mock("@/lib/repositories/workspace", () => ({ workspaceRepository: {} }));
vi.mock("@/lib/repositories/notification", () => ({
  notificationRepository: {},
}));

const { processMock } = vi.hoisted(() => ({ processMock: vi.fn() }));
vi.mock("@/domains/publishing", () => ({
  OutstandWebhookProcessor: class {
    process = processMock;
  },
}));
vi.mock("@/domains/notification", () => ({
  NotificationService: class {},
}));

const SECRET = "test-secret";

function buildRequest(
  rawBody: string,
  signature: string | null = "sig",
): Request {
  const headers = new Headers();
  if (signature !== null) {
    headers.set("x-outstand-signature", signature);
  }
  return new Request("http://localhost/api/webhooks/outstand", {
    method: "POST",
    body: rawBody,
    headers,
  });
}

describe("POST /api/webhooks/outstand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerEnv.mockReturnValue({ OUTSTAND_WEBHOOK_SECRET: SECRET });
    verifyOutstandWebhookSignature.mockReturnValue(true);
    insertIfNew.mockResolvedValue({ id: "receipt-1", isNew: true });
    processMock.mockResolvedValue({ outcome: "processed" });
    getOutstandAdapter.mockReset();
    getOutstandAdapter.mockReturnValue({});
  });

  it("rejects with 401 when OUTSTAND_WEBHOOK_SECRET is not configured (T-026.1) — never a silent skip", async () => {
    getServerEnv.mockReturnValue({ OUTSTAND_WEBHOOK_SECRET: undefined });
    const { POST } = await import("./route");

    const response = await POST(
      buildRequest(JSON.stringify({ event: "post.published" })),
    );

    expect(response.status).toBe(401);
    expect(insertIfNew).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the signature is invalid, without persisting or processing anything", async () => {
    verifyOutstandWebhookSignature.mockReturnValue(false);
    const { POST } = await import("./route");

    const response = await POST(
      buildRequest(JSON.stringify({ event: "post.published" })),
    );

    expect(response.status).toBe(401);
    expect(insertIfNew).not.toHaveBeenCalled();
    expect(processMock).not.toHaveBeenCalled();
  });

  it("idempotency (T-026.6): ACKs 200 for a duplicate receipt WITHOUT re-processing", async () => {
    insertIfNew.mockResolvedValue({ id: "receipt-1", isNew: false });
    const { POST } = await import("./route");

    const response = await POST(
      buildRequest(
        JSON.stringify({ event: "post.published", data: { id: "post-1" } }),
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.duplicate).toBe(true);
    expect(processMock).not.toHaveBeenCalled();
  });

  it("processes a new event and marks the receipt processed on success", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      buildRequest(
        JSON.stringify({ event: "post.published", data: { id: "post-1" } }),
      ),
    );

    expect(response.status).toBe(200);
    expect(processMock).toHaveBeenCalledWith({
      eventType: "post.published",
      outstandPostId: "post-1",
      outstandAccountId: undefined,
    });
    expect(markProcessed).toHaveBeenCalledWith("receipt-1");
    expect(markFailed).not.toHaveBeenCalled();
  });

  it("still ACKs 200 when processing throws, but marks the receipt failed (retry boundary stays at receipt persistence, not delivery)", async () => {
    processMock.mockRejectedValue(new Error("outstand adapter down"));
    const { POST } = await import("./route");

    const response = await POST(
      buildRequest(
        JSON.stringify({ event: "post.error", data: { id: "post-1" } }),
      ),
    );

    expect(response.status).toBe(200);
    expect(markFailed).toHaveBeenCalledWith(
      "receipt-1",
      "outstand adapter down",
    );
    expect(markProcessed).not.toHaveBeenCalled();
  });

  it("returns 503 without persisting when the Outstand adapter cannot be created (ADR-119)", async () => {
    getOutstandAdapter.mockImplementation(() => {
      throw new Error("OUTSTAND_API_KEY wajib diisi.");
    });
    const { POST } = await import("./route");

    const response = await POST(
      buildRequest(
        JSON.stringify({ event: "post.published", data: { id: "post-1" } }),
      ),
    );

    expect(response.status).toBe(503);
    expect(insertIfNew).not.toHaveBeenCalled();
    expect(markProcessed).not.toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
    expect(processMock).not.toHaveBeenCalled();
  });

  it("persists a malformed payload with a fingerprint id and marks it failed WITHOUT calling the processor", async () => {
    const { POST } = await import("./route");

    const response = await POST(buildRequest("not json at all"));

    expect(response.status).toBe(200);
    expect(insertIfNew).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "unknown",
        rawBody: "not json at all",
      }),
    );
    expect(processMock).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalled();
  });
});
