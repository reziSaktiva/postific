import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyOutstandWebhookSignature } from "./verify-webhook-signature";

const SECRET = "test-webhook-secret";

function sign(rawBody: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

describe("verifyOutstandWebhookSignature", () => {
  it("returns true for a correctly signed raw body (T-026.1)", () => {
    const rawBody = JSON.stringify({ event: "post.published" });
    const signature = sign(rawBody);

    expect(verifyOutstandWebhookSignature(rawBody, signature, SECRET)).toBe(
      true,
    );
  });

  it("returns true for Outstand's documented `sha256=<hex>` header format (T-311.5)", () => {
    const rawBody = JSON.stringify({ event: "account.token_expired" });
    const signature = `sha256=${sign(rawBody)}`;

    expect(verifyOutstandWebhookSignature(rawBody, signature, SECRET)).toBe(
      true,
    );
  });

  it("accepts the prefix and hex case-insensitively and ignores surrounding whitespace", () => {
    const rawBody = JSON.stringify({ event: "post.error" });
    const signature = `  SHA256=${sign(rawBody).toUpperCase()} `;

    expect(verifyOutstandWebhookSignature(rawBody, signature, SECRET)).toBe(
      true,
    );
  });

  it("returns false for a `sha256=` header signed with a different secret", () => {
    const rawBody = JSON.stringify({ event: "post.published" });
    const signature = `sha256=${sign(rawBody, "wrong-secret")}`;

    expect(verifyOutstandWebhookSignature(rawBody, signature, SECRET)).toBe(
      false,
    );
  });

  it("returns false for a `sha256=` header with an empty value", () => {
    const rawBody = JSON.stringify({ event: "post.published" });

    expect(verifyOutstandWebhookSignature(rawBody, "sha256=", SECRET)).toBe(
      false,
    );
  });

  it("returns false when the signature was computed with a different secret", () => {
    const rawBody = JSON.stringify({ event: "post.published" });
    const signature = sign(rawBody, "wrong-secret");

    expect(verifyOutstandWebhookSignature(rawBody, signature, SECRET)).toBe(
      false,
    );
  });

  it("returns false when the raw body was tampered with after signing", () => {
    const rawBody = JSON.stringify({ event: "post.published" });
    const signature = sign(rawBody);
    const tamperedBody = JSON.stringify({ event: "post.error" });

    expect(
      verifyOutstandWebhookSignature(tamperedBody, signature, SECRET),
    ).toBe(false);
  });

  it("returns false when the signature header is missing", () => {
    const rawBody = JSON.stringify({ event: "post.published" });

    expect(verifyOutstandWebhookSignature(rawBody, null, SECRET)).toBe(false);
  });

  it("returns false for a garbage signature of different length (no throw)", () => {
    const rawBody = JSON.stringify({ event: "post.published" });

    expect(
      verifyOutstandWebhookSignature(rawBody, "not-a-real-signature", SECRET),
    ).toBe(false);
  });
});
