import { describe, expect, it } from "vitest";
import {
  fingerprintRawBody,
  parseOutstandWebhookPayload,
} from "./parse-webhook-payload";

describe("parseOutstandWebhookPayload", () => {
  it("extracts eventType + outstandPostId from a post.* event", () => {
    const rawBody = JSON.stringify({
      id: "evt_1",
      event: "post.published",
      data: { id: "outstand-post-1" },
    });

    const result = parseOutstandWebhookPayload(rawBody);

    expect(result.outstandEventId).toBe("evt_1");
    expect(result.event).toEqual({
      eventType: "post.published",
      outstandPostId: "outstand-post-1",
      outstandAccountId: undefined,
    });
  });

  it("extracts outstandPostId from the real post.published delivery (data.postId, no root id) — T-313", () => {
    // Captured from staging on 2026-11-27 (outstand_webhook_events row).
    const rawBody = JSON.stringify({
      event: "post.published",
      timestamp: "2026-11-27T09:08:14.833Z",
      data: {
        postId: "CqEjv",
        orgId: "pJaTpxh82Ud5SJpNYaRdEhLP89NvMOx2",
        socialAccounts: [
          {
            accountId: "IDveX",
            network: "instagram",
            username: "turanilkerl",
            platformPostId: "18155733616547912",
            platformPostUrl:
              "https://www.instagram.com/stories/turanilkerl/4039537778925936490",
          },
        ],
      },
    });

    const result = parseOutstandWebhookPayload(rawBody);

    expect(result.outstandEventId).toBe(fingerprintRawBody(rawBody));
    expect(result.event).toEqual({
      eventType: "post.published",
      outstandPostId: "CqEjv",
      outstandAccountId: undefined,
    });
  });

  it("prefers data.postId over data.id when both are present", () => {
    const result = parseOutstandWebhookPayload(
      JSON.stringify({
        event: "post.error",
        data: { postId: "post-from-postId", id: "post-from-id" },
      }),
    );

    expect(result.event.outstandPostId).toBe("post-from-postId");
  });

  it("extracts eventType + outstandAccountId from account.token_expired", () => {
    const rawBody = JSON.stringify({
      id: "evt_2",
      event: "account.token_expired",
      data: { accountId: "outstand-account-1" },
    });

    const result = parseOutstandWebhookPayload(rawBody);

    expect(result.event).toEqual({
      eventType: "account.token_expired",
      outstandPostId: undefined,
      outstandAccountId: "outstand-account-1",
    });
  });

  it("falls back to a deterministic raw-body fingerprint when no vendor event id is present (T-026.6/integration-layer.md:336)", () => {
    const rawBody = JSON.stringify({
      event: "post.error",
      data: { id: "outstand-post-2" },
    });

    const first = parseOutstandWebhookPayload(rawBody);
    const second = parseOutstandWebhookPayload(rawBody);

    expect(first.outstandEventId).toBe(fingerprintRawBody(rawBody));
    expect(first.outstandEventId).toBe(second.outstandEventId);
  });

  it("throws for invalid JSON", () => {
    expect(() => parseOutstandWebhookPayload("not json")).toThrow();
  });

  it('throws when the payload has no "event" field', () => {
    expect(() =>
      parseOutstandWebhookPayload(JSON.stringify({ data: {} })),
    ).toThrow();
  });

  it("throws when the payload is a JSON array, not an object", () => {
    expect(() => parseOutstandWebhookPayload(JSON.stringify([1, 2]))).toThrow();
  });
});

describe("fingerprintRawBody", () => {
  it("is deterministic for identical input", () => {
    expect(fingerprintRawBody("abc")).toBe(fingerprintRawBody("abc"));
  });

  it("differs for different input", () => {
    expect(fingerprintRawBody("abc")).not.toBe(fingerprintRawBody("abcd"));
  });
});
