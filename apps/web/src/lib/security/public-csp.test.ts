import { describe, expect, it } from "vitest";

import {
  buildPublicPageCsp,
  generateNonce,
  isPublicStartPagePath,
} from "./public-csp";

function directive(csp: string, name: string): string | undefined {
  return csp.split("; ").find((part) => part.startsWith(`${name} `));
}

describe("generateNonce", () => {
  it("returns a base64 128-bit value that differs on every call", () => {
    const nonces = new Set(Array.from({ length: 50 }, () => generateNonce()));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    }
  });
});

describe("isPublicStartPagePath", () => {
  it("matches /u and its sub-paths only", () => {
    for (const path of ["/u", "/u/raka", "/u/raka/go/abc"]) {
      expect(isPublicStartPagePath(path)).toBe(true);
    }
    for (const path of ["/", "/user", "/uploads/x", "/u-raka", "/login"]) {
      expect(isPublicStartPagePath(path)).toBe(false);
    }
  });
});

describe("buildPublicPageCsp (production)", () => {
  const nonce = "dGVzdC1ub25jZQ==";
  const csp = buildPublicPageCsp({ nonce });

  it("puts the nonce with strict-dynamic in script-src and no unsafe-eval/inline", () => {
    const script = directive(csp, "script-src")!;
    expect(script).toBe(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
    expect(script).not.toContain("unsafe");
  });

  it("uses nonce (no unsafe-inline) for both style-src and script-src", () => {
    expect(directive(csp, "style-src")).toBe(
      `style-src 'self' 'nonce-${nonce}'`,
    );
    expect(csp).not.toContain("unsafe-inline");
  });

  it("locks down framing, objects, base-uri and form-action", () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("default-src 'self'");
  });

  it("allows https images (avatar) but not plain http", () => {
    const img = directive(csp, "img-src")!;
    expect(img).toContain("https:");
    expect(img.split(" ")).not.toContain("http:");
  });

  it("does not allow websockets or eval outside dev", () => {
    expect(csp).not.toContain("ws:");
    expect(csp).not.toContain("unsafe-eval");
  });
});

describe("buildPublicPageCsp (dev)", () => {
  it("adds unsafe-eval and websockets for HMR", () => {
    const csp = buildPublicPageCsp({ nonce: "abc", isDev: true });
    expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
    expect(directive(csp, "connect-src")).toContain("ws:");
  });
});
