import { describe, expect, it, vi } from "vitest";
import { OutstandHttpClient } from "./outstand-http-client";
import { OutstandIntegrationError } from "./outstand-integration-error";

const API_KEY = "test-outstand-api-key";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("OutstandHttpClient.request (T-025.1)", () => {
  it("sends Authorization Bearer header + Content-Type when a body is present", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { ok: true }));
    const client = new OutstandHttpClient(API_KEY, { fetchImpl });

    await client.request("/posts", { method: "POST", body: { caption: "hi" } });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.outstand.so/posts");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ caption: "hi" });
  });

  it("omits Content-Type for a GET request without a body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    const client = new OutstandHttpClient(API_KEY, { fetchImpl });

    await client.request("/posts/abc", { method: "GET" });

    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it("appends query params, skipping undefined values", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    const client = new OutstandHttpClient(API_KEY, { fetchImpl });

    await client.request("/accounts/acc-1/comments", {
      method: "GET",
      query: { cursor: undefined, period: "last_7_days" },
    });

    const [url] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      "https://api.outstand.so/accounts/acc-1/comments?period=last_7_days",
    );
  });

  it("respects a custom baseUrl option, stripping trailing slashes", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    const client = new OutstandHttpClient(API_KEY, {
      fetchImpl,
      baseUrl: "https://sandbox.outstand.example/v2/",
    });

    await client.request("/posts", { method: "GET" });

    const [url] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://sandbox.outstand.example/v2/posts");
  });

  it("parses and returns the JSON response body on success", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { id: "post-1" }));
    const client = new OutstandHttpClient(API_KEY, { fetchImpl });

    const result = await client.request("/posts", { method: "GET" });

    expect(result).toEqual({ id: "post-1" });
  });

  describe("error mapping (T-025.1, IL-D08)", () => {
    it("maps HTTP 401 to auth_error, not retryable", async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(jsonResponse(401, { message: "invalid api key" }));
      const client = new OutstandHttpClient(API_KEY, { fetchImpl });

      await expect(
        client.request("/posts", { method: "GET" }),
      ).rejects.toMatchObject({
        type: "auth_error",
        retryable: false,
      });
    });

    it("maps HTTP 403 to account_error, not retryable", async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(jsonResponse(403, { message: "account revoked" }));
      const client = new OutstandHttpClient(API_KEY, { fetchImpl });

      await expect(
        client.request("/posts", { method: "GET" }),
      ).rejects.toMatchObject({
        type: "account_error",
        retryable: false,
      });
    });

    it("maps HTTP 404 to not_found, not retryable", async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(jsonResponse(404, { message: "post not found" }));
      const client = new OutstandHttpClient(API_KEY, { fetchImpl });

      await expect(
        client.request("/posts/x", { method: "GET" }),
      ).rejects.toMatchObject({
        type: "not_found",
        retryable: false,
      });
    });

    it("maps HTTP 400 to client_error, not retryable", async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(jsonResponse(400, { message: "bad request" }));
      const client = new OutstandHttpClient(API_KEY, { fetchImpl });

      await expect(
        client.request("/posts", { method: "POST", body: {} }),
      ).rejects.toMatchObject({
        type: "client_error",
        retryable: false,
      });
    });

    it("maps HTTP 500+ to transient, retryable", async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(503, { message: "down for maintenance" }),
        );
      const client = new OutstandHttpClient(API_KEY, { fetchImpl });

      await expect(
        client.request("/posts", { method: "GET" }),
      ).rejects.toMatchObject({
        type: "transient",
        retryable: true,
      });
    });

    it("maps HTTP 429 to transient, retryable (rate limit)", async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(jsonResponse(429, { message: "slow down" }));
      const client = new OutstandHttpClient(API_KEY, { fetchImpl });

      await expect(
        client.request("/posts", { method: "GET" }),
      ).rejects.toMatchObject({
        type: "transient",
        retryable: true,
        httpStatus: 429,
      });
    });

    it("carries the vendor error code/message through into OutstandIntegrationError", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        jsonResponse(400, {
          code: "invalid_caption",
          message: "Caption too long",
        }),
      );
      const client = new OutstandHttpClient(API_KEY, { fetchImpl });

      let caught: unknown;
      try {
        await client.request("/posts", { method: "POST", body: {} });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(OutstandIntegrationError);
      expect((caught as OutstandIntegrationError).outstandErrorCode).toBe(
        "invalid_caption",
      );
      expect((caught as OutstandIntegrationError).message).toContain(
        "Caption too long",
      );
    });

    it("maps a network failure (fetch rejects) to transient, retryable", async () => {
      const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
      const client = new OutstandHttpClient(API_KEY, { fetchImpl });

      await expect(
        client.request("/posts", { method: "GET" }),
      ).rejects.toMatchObject({ type: "transient", retryable: true });
    });

    it("maps a request timeout (AbortController fires) to transient, retryable", async () => {
      const fetchImpl = vi.fn().mockImplementation(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () => {
              const abortError = new Error("The operation was aborted");
              abortError.name = "AbortError";
              reject(abortError);
            });
          }),
      );
      const client = new OutstandHttpClient(API_KEY, {
        fetchImpl,
        timeoutMs: 10,
      });

      await expect(
        client.request("/posts", { method: "GET" }),
      ).rejects.toMatchObject({ type: "transient", retryable: true });
      expect(
        (fetchImpl.mock.calls[0][1] as { signal: AbortSignal }).signal,
      ).toBeDefined();
    });
  });
});

describe("OutstandHttpClient.putBytes (T-025.5, media upload working copy)", () => {
  it("PUTs raw bytes with the given content type, without an Authorization header", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const client = new OutstandHttpClient(API_KEY, { fetchImpl });

    await client.putBytes(
      "https://uploads.outstand.example/abc",
      Buffer.from("fake-bytes"),
      "image/png",
    );

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://uploads.outstand.example/abc");
    expect(init.method).toBe("PUT");
    expect(init.headers["Content-Type"]).toBe("image/png");
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("maps a non-2xx PUT response to an OutstandIntegrationError", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("upload expired", { status: 410 }));
    const client = new OutstandHttpClient(API_KEY, { fetchImpl });

    await expect(
      client.putBytes(
        "https://uploads.outstand.example/abc",
        Buffer.from("x"),
        "image/png",
      ),
    ).rejects.toBeInstanceOf(OutstandIntegrationError);
  });

  it("redacts presigned upload URL query string from error messages", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("socket hang up"));
    const client = new OutstandHttpClient(API_KEY, { fetchImpl });
    const presigned =
      "https://uploads.outstand.example/media/abc?X-Amz-Signature=SECRET&token=leak";

    let caught: unknown;
    try {
      await client.putBytes(presigned, Buffer.from("x"), "image/png");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(OutstandIntegrationError);
    const message = (caught as OutstandIntegrationError).message;
    expect(message).not.toContain("SECRET");
    expect(message).not.toContain("token=leak");
    expect(message).not.toContain(presigned);
    expect(message).toContain("/media/abc");
  });

  it("uses uploadTimeoutMs for PUT bytes, not the JSON request timeout", async () => {
    const fetchImpl = vi.fn().mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const abortError = new Error("The operation was aborted");
            abortError.name = "AbortError";
            reject(abortError);
          });
        }),
    );
    const client = new OutstandHttpClient(API_KEY, {
      fetchImpl,
      timeoutMs: 60_000,
      uploadTimeoutMs: 15,
    });

    await expect(
      client.putBytes(
        "https://uploads.outstand.example/abc",
        Buffer.from("x"),
        "video/mp4",
      ),
    ).rejects.toMatchObject({ type: "transient", retryable: true });
  });
});

describe("OutstandHttpClient session token redaction", () => {
  it("does not include the Facebook session token in network errors", async () => {
    const token = "super-secret-session";
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(
        new Error(
          `connect ECONNRESET https://api.outstand.so/v1/social-accounts/pending/${token}`,
        ),
      );
    const client = new OutstandHttpClient(API_KEY, { fetchImpl });

    await expect(
      client.request(`/v1/social-accounts/pending/${token}`, { method: "GET" }),
    ).rejects.toThrow(/\[redacted\]/);

    try {
      await client.request(`/v1/social-accounts/pending/${token}/finalize`, {
        method: "POST",
        body: { selectedPageIds: ["p1"] },
      });
    } catch (error) {
      expect((error as Error).message).not.toContain(token);
    }
  });
});
