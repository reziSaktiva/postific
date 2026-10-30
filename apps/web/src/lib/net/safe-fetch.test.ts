import { describe, expect, it, vi } from "vitest";

import {
  SafeFetchError,
  safeFetch,
  type PinnedRequest,
  type ResolvedAddress,
  type SafeFetchDeps,
  type SafeFetchErrorCode,
  type SafeFetchOptions,
  type TransportResponse,
} from "./safe-fetch";

const PUBLIC: ResolvedAddress = { address: "93.184.216.34", family: 4 };
const PRIVATE: ResolvedAddress = { address: "10.0.0.5", family: 4 };

function body(...chunks: number[][]): AsyncIterable<Uint8Array> {
  return (async function* () {
    for (const chunk of chunks) {
      yield Uint8Array.from(chunk);
    }
  })();
}

function ok(
  chunks: number[][] = [[1, 2, 3]],
  headers: Record<string, string> = {},
): TransportResponse {
  return {
    status: 200,
    headers,
    body: body(...chunks),
    destroy: vi.fn(),
  };
}

function redirect(
  location: string | undefined,
  status = 302,
): TransportResponse {
  return {
    status,
    headers: location === undefined ? {} : { location },
    body: body(),
    destroy: vi.fn(),
  };
}

interface Setup {
  deps: SafeFetchDeps;
  resolve: ReturnType<typeof vi.fn>;
  transport: ReturnType<typeof vi.fn>;
  calls: PinnedRequest[];
}

function setup(
  resolver: (host: string, n: number) => readonly ResolvedAddress[] | Error,
  responder: (
    req: PinnedRequest,
    n: number,
  ) => TransportResponse | Promise<TransportResponse>,
): Setup {
  const calls: PinnedRequest[] = [];
  const counts = new Map<string, number>();
  const resolve = vi.fn(async (host: string) => {
    const n = (counts.get(host) ?? 0) + 1;
    counts.set(host, n);
    const out = resolver(host, n);
    if (out instanceof Error) throw out;
    return out;
  });
  const transport = vi.fn(async (req: PinnedRequest) => {
    calls.push(req);
    return responder(req, calls.length);
  });
  return { deps: { resolve, transport }, resolve, transport, calls };
}

async function expectCode(promise: Promise<unknown>, code: SafeFetchErrorCode) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(SafeFetchError);
  expect((error as SafeFetchError).code).toBe(code);
  return error as SafeFetchError;
}

const fetchSafe = (
  url: string,
  deps: SafeFetchDeps,
  options: Partial<SafeFetchOptions> = {},
) => safeFetch(url, deps, { maxBytes: 1000, ...options });

const simple = () =>
  setup(
    () => [PUBLIC],
    () => ok(),
  );

describe("safeFetch URL checks", () => {
  it.each([
    ["http://example.com/a.png", "invalid_url"],
    ["ftp://example.com/a.png", "invalid_url"],
    ["not a url", "invalid_url"],
    ["https://user:pw@example.com/a.png", "invalid_url"],
    ["https://user@example.com/a.png", "invalid_url"],
    ["https://@example.com/a.png", "invalid_url"],
    ["https://example.com:8443/a.png", "invalid_url"],
    ["https://example.com:80/a.png", "invalid_url"],
    ["https://127.0.0.1/a.png", "blocked_destination"],
    ["https://[::1]/a.png", "blocked_destination"],
    ["https://[::ffff:7f00:1]/a.png", "blocked_destination"],
    ["https://8.8.8.8/a.png", "blocked_destination"],
    ["https://2130706433/a.png", "blocked_destination"],
    ["https://0x7f000001/a.png", "blocked_destination"],
    ["https://0177.0.0.1/a.png", "blocked_destination"],
    ["https://0x7f.1/a.png", "blocked_destination"],
    ["https://localhost/a.png", "blocked_destination"],
    ["https://foo.localhost/a.png", "blocked_destination"],
    ["https://metadata.internal/a.png", "blocked_destination"],
    ["https://printer.local/a.png", "blocked_destination"],
    ["https://[::ffff:127.0.0.1]/a.png", "blocked_destination"],
    ["https://localhost./a.png", "blocked_destination"],
    ["https://foo.localhost./a.png", "blocked_destination"],
    ["https://metadata.google.internal./a.png", "blocked_destination"],
    ["https://127.0.0.1./a.png", "blocked_destination"],
  ] as const)(
    "rejects %s without resolving or connecting",
    async (url, code) => {
      const s = simple();
      await expectCode(fetchSafe(url, s.deps), code);
      expect(s.resolve).not.toHaveBeenCalled();
      expect(s.transport).not.toHaveBeenCalled();
    },
  );

  it("accepts explicit default port 443", async () => {
    const s = simple();
    const result = await fetchSafe("https://example.com:443/a.png", s.deps);
    expect(result.bytes).toEqual(Buffer.from([1, 2, 3]));
  });
});

describe("safeFetch DNS validation and pinning", () => {
  it.each([
    ["10.0.0.5", "10.0.0.5"],
    ["loopback", "127.0.0.1"],
    ["metadata", "169.254.169.254"],
    ["CGNAT", "100.64.0.1"],
    ["ULA", "fd00::1"],
    ["IPv4-mapped", "::ffff:10.0.0.1"],
    ["6to4 wrapping private", "2002:0a00:0001::1"],
    ["NAT64 wrapping private", "64:ff9b::a00:1"],
  ])("blocks a host resolving to %s", async (_label, address) => {
    const s = setup(
      () => [{ address, family: address.includes(":") ? 6 : 4 }],
      () => ok(),
    );
    const error = await expectCode(
      fetchSafe("https://evil.example/a.png", s.deps),
      "blocked_destination",
    );
    expect(s.transport).not.toHaveBeenCalled();
    expect(error.message).not.toContain(address);
  });

  it("blocks when ANY resolved address is private (public + private mix)", async () => {
    const s = setup(
      () => [PUBLIC, PRIVATE],
      () => ok(),
    );
    await expectCode(
      fetchSafe("https://mixed.example/a.png", s.deps),
      "blocked_destination",
    );
    expect(s.transport).not.toHaveBeenCalled();
  });

  it("fails closed on DNS error or empty answer with a generic error", async () => {
    await expectCode(
      fetchSafe(
        "https://x.example/a",
        setup(
          () => new Error("NXDOMAIN 10.1.1.1"),
          () => ok(),
        ).deps,
      ),
      "network_error",
    );
    await expectCode(
      fetchSafe(
        "https://x.example/a",
        setup(
          () => [],
          () => ok(),
        ).deps,
      ),
      "network_error",
    );
  });

  it("resolves once and connects to the validated IP (anti DNS rebinding)", async () => {
    // Resolusi kedua akan mengembalikan IP privat; koneksi tidak boleh bergantung padanya.
    const s = setup(
      (_host, n) => (n === 1 ? [PUBLIC] : [PRIVATE]),
      () => ok(),
    );
    await fetchSafe("https://rebind.example/a.png", s.deps);
    expect(s.resolve).toHaveBeenCalledTimes(1);
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0]?.addresses).toEqual([PUBLIC]);
    expect(s.calls[0]?.url.hostname).toBe("rebind.example");
  });
});

describe("safeFetch redirects", () => {
  it("follows a relative redirect, re-resolves and pins each hop", async () => {
    const s = setup(
      (host) => [
        host === "a.example" ? PUBLIC : { address: "8.8.8.8", family: 4 },
      ],
      (_req, n) =>
        n === 1
          ? redirect("/final.png")
          : n === 2
            ? redirect("https://b.example/x.png", 301)
            : ok(),
    );
    const result = await fetchSafe("https://a.example/start", s.deps);
    expect(s.calls.map((c) => c.url.href)).toEqual([
      "https://a.example/start",
      "https://a.example/final.png",
      "https://b.example/x.png",
    ]);
    expect(s.calls[2]?.addresses[0]?.address).toBe("8.8.8.8");
    expect(result.finalUrl.href).toBe("https://b.example/x.png");
  });

  it("rejects redirect to a private IP literal", async () => {
    const s = setup(
      () => [PUBLIC],
      () => redirect("https://169.254.169.254/latest"),
    );
    await expectCode(
      fetchSafe("https://a.example/", s.deps),
      "blocked_destination",
    );
    expect(s.transport).toHaveBeenCalledTimes(1);
  });

  it("rejects redirect to a host resolving to a private IP", async () => {
    const s = setup(
      (host) => (host === "a.example" ? [PUBLIC] : [PRIVATE]),
      () => redirect("https://internal.example/"),
    );
    await expectCode(
      fetchSafe("https://a.example/", s.deps),
      "blocked_destination",
    );
    expect(s.transport).toHaveBeenCalledTimes(1);
  });

  it("rejects redirect to http, to another port, and with userinfo", async () => {
    for (const target of [
      "http://a.example/x",
      "https://a.example:8443/x",
      "https://u:p@a.example/x",
    ]) {
      const s = setup(
        () => [PUBLIC],
        () => redirect(target),
      );
      await expectCode(fetchSafe("https://a.example/", s.deps), "invalid_url");
    }
  });

  it("rejects a redirect without Location", async () => {
    const s = setup(
      () => [PUBLIC],
      () => redirect(undefined),
    );
    await expectCode(fetchSafe("https://a.example/", s.deps), "bad_status");
  });

  it("rejects redirect loops", async () => {
    const s = setup(
      () => [PUBLIC],
      () => redirect("/loop"),
    );
    await expectCode(
      fetchSafe("https://a.example/loop", s.deps),
      "too_many_redirects",
    );
  });

  it("allows exactly 3 redirects and rejects the 4th", async () => {
    const three = setup(
      () => [PUBLIC],
      (_r, n) => (n <= 3 ? redirect(`/h${n}`) : ok()),
    );
    await expect(
      fetchSafe("https://a.example/", three.deps),
    ).resolves.toBeDefined();
    const four = setup(
      () => [PUBLIC],
      (_r, n) => (n <= 4 ? redirect(`/h${n}`) : ok()),
    );
    await expectCode(
      fetchSafe("https://a.example/", four.deps),
      "too_many_redirects",
    );
  });
});

describe("safeFetch limits and response checks", () => {
  it("rejects by Content-Length before reading the body", async () => {
    const response = ok([[1]], { "content-length": "100" });
    const s = setup(
      () => [PUBLIC],
      () => response,
    );
    await expectCode(
      fetchSafe("https://a.example/", s.deps, { maxBytes: 50 }),
      "too_large",
    );
    expect(response.destroy).toHaveBeenCalled();
  });

  it("aborts a stream without Content-Length once it passes the limit", async () => {
    const response = ok([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    const s = setup(
      () => [PUBLIC],
      () => response,
    );
    await expectCode(
      fetchSafe("https://a.example/", s.deps, { maxBytes: 5 }),
      "too_large",
    );
    expect(response.destroy).toHaveBeenCalled();
  });

  it("accepts a body exactly at the limit", async () => {
    const s = setup(
      () => [PUBLIC],
      () =>
        ok([
          [1, 2, 3],
          [4, 5],
        ]),
    );
    const result = await fetchSafe("https://a.example/", s.deps, {
      maxBytes: 5,
    });
    expect(result.bytes.byteLength).toBe(5);
  });

  it("times out when the transport never answers", async () => {
    const s = setup(
      () => [PUBLIC],
      () => new Promise<TransportResponse>(() => undefined),
    );
    await expectCode(
      fetchSafe("https://a.example/", s.deps, { timeoutMs: 20 }),
      "timeout",
    );
  });

  it("times out on a stalled body", async () => {
    const stalled: TransportResponse = {
      status: 200,
      headers: {},
      body: (async function* () {
        yield Uint8Array.from([1]);
        await new Promise(() => undefined);
      })(),
      destroy: vi.fn(),
    };
    const s = setup(
      () => [PUBLIC],
      () => stalled,
    );
    await expectCode(
      fetchSafe("https://a.example/", s.deps, { timeoutMs: 20 }),
      "timeout",
    );
    expect(stalled.destroy).toHaveBeenCalled();
  });

  it("rejects non-2xx, odd Content-Encoding, and empty bodies", async () => {
    await expectCode(
      fetchSafe(
        "https://a.example/",
        setup(
          () => [PUBLIC],
          () => ({ ...ok(), status: 404 }),
        ).deps,
      ),
      "bad_status",
    );
    await expectCode(
      fetchSafe(
        "https://a.example/",
        setup(
          () => [PUBLIC],
          () => ok([[1]], { "content-encoding": "gzip" }),
        ).deps,
      ),
      "unsupported_encoding",
    );
    await expectCode(
      fetchSafe(
        "https://a.example/",
        setup(
          () => [PUBLIC],
          () => ok([]),
        ).deps,
      ),
      "empty_body",
    );
  });

  it("accepts Content-Encoding identity", async () => {
    const s = setup(
      () => [PUBLIC],
      () => ok([[1]], { "content-encoding": "identity" }),
    );
    await expect(
      fetchSafe("https://a.example/", s.deps),
    ).resolves.toBeDefined();
  });

  it("maps transport failures to a generic network error", async () => {
    const s = setup(
      () => [PUBLIC],
      () => {
        throw new Error("ECONNREFUSED 10.0.0.9:443");
      },
    );
    const error = await expectCode(
      fetchSafe("https://a.example/", s.deps),
      "network_error",
    );
    expect(error.message).not.toContain("10.0.0.9");
  });
});

describe("safeFetch concurrency cap", () => {
  it("rejects the 4th simultaneous download with a generic busy error and frees slots afterwards", async () => {
    const release: Array<() => void> = [];
    const hanging = setup(
      () => [PUBLIC],
      () =>
        new Promise<TransportResponse>((resolve) => {
          release.push(() => resolve(ok()));
        }),
    );
    const first = [1, 2, 3].map(() =>
      fetchSafe("https://a.example/", hanging.deps, { timeoutMs: 5000 }),
    );
    await vi.waitFor(() => expect(release).toHaveLength(3));
    await expectCode(fetchSafe("https://a.example/", simple().deps), "busy");
    release.forEach((r) => r());
    await Promise.all(first);
    await expect(
      fetchSafe("https://a.example/", simple().deps),
    ).resolves.toBeDefined();
  });
});

describe("safeFetch pinning of all addresses", () => {
  it("passes every validated address to the transport, order preserved (AAAA first, then A)", async () => {
    const v6: ResolvedAddress = { address: "2606:4700::1111", family: 6 };
    const s = setup(
      () => [v6, PUBLIC],
      () => ok(),
    );
    await fetchSafe("https://dual.example/a", s.deps);
    expect(s.calls[0]?.addresses).toEqual([v6, PUBLIC]);
  });

  it("still blocks when only the second of two addresses is forbidden", async () => {
    const v6: ResolvedAddress = { address: "2606:4700::1111", family: 6 };
    const s = setup(
      () => [v6, { address: "::ffff:10.0.0.1", family: 6 }],
      () => ok(),
    );
    await expectCode(
      fetchSafe("https://dual.example/a", s.deps),
      "blocked_destination",
    );
    expect(s.transport).not.toHaveBeenCalled();
  });
});

describe("safeFetch hostname normalization", () => {
  it("gives resolver and transport a lowercase hostname without trailing dot", async () => {
    const s = setup(
      () => [PUBLIC],
      () => ok(),
    );
    await fetchSafe("https://Example.COM./a.png", s.deps);
    expect(s.resolve).toHaveBeenCalledWith("example.com");
    expect(s.calls[0]?.url.hostname).toBe("example.com");
    expect(s.calls[0]?.url.host).toBe("example.com");
  });

  it("normalizes redirect targets too", async () => {
    const s = setup(
      () => [PUBLIC],
      (_r, n) => (n === 1 ? redirect("https://B.Example./x") : ok()),
    );
    await fetchSafe("https://a.example/", s.deps);
    expect(s.calls[1]?.url.hostname).toBe("b.example");
  });
});

describe("safeFetch memory and shared counter", () => {
  it("returns the single chunk without a final copy", async () => {
    const chunk = Buffer.from([1, 2, 3]);
    const response: TransportResponse = {
      status: 200,
      headers: {},
      body: (async function* () {
        yield chunk;
      })(),
      destroy: vi.fn(),
    };
    const s = setup(
      () => [PUBLIC],
      () => response,
    );
    const result = await fetchSafe("https://a.example/", s.deps);
    expect(result.bytes).toBe(chunk);
  });

  it("keeps the concurrency counter on globalThis (shared across module copies)", async () => {
    const holder = globalThis as unknown as Record<symbol, { count: number }>;
    const key = Symbol.for("postific.safeFetch.active");
    holder[key] = { count: 3 };
    try {
      await expectCode(fetchSafe("https://a.example/", simple().deps), "busy");
    } finally {
      holder[key] = { count: 0 };
    }
  });
});
