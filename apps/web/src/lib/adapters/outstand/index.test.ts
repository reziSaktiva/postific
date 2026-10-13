import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerEnv } = vi.hoisted(() => ({ getServerEnv: vi.fn() }));
const { createRealOutstandAdapter } = vi.hoisted(() => ({
  createRealOutstandAdapter: vi.fn(() => ({ kind: "real-outstand-adapter" })),
}));

vi.mock("@/lib/env", () => ({ getServerEnv }));
vi.mock("./real-outstand-adapter", () => ({ createRealOutstandAdapter }));

import { getOutstandAdapter } from "./index";

describe("getOutstandAdapter (ADR-119)", () => {
  beforeEach(() => {
    getServerEnv.mockReset();
    createRealOutstandAdapter.mockClear();
  });

  it("throws when OUTSTAND_API_KEY is empty or whitespace", () => {
    getServerEnv.mockReturnValue({
      OUTSTAND_API_KEY: "   ",
      OUTSTAND_API_BASE_URL: undefined,
      OUTSTAND_ORG_ID: undefined,
      BETTER_AUTH_URL: "http://localhost:3000",
    });

    expect(() => getOutstandAdapter()).toThrow(/OUTSTAND_API_KEY/);
    expect(createRealOutstandAdapter).not.toHaveBeenCalled();
  });

  it("throws when OUTSTAND_API_KEY is undefined", () => {
    getServerEnv.mockReturnValue({
      OUTSTAND_API_KEY: undefined,
      OUTSTAND_API_BASE_URL: undefined,
      OUTSTAND_ORG_ID: undefined,
      BETTER_AUTH_URL: "http://localhost:3000",
    });

    expect(() => getOutstandAdapter()).toThrow(/OUTSTAND_API_KEY/);
    expect(createRealOutstandAdapter).not.toHaveBeenCalled();
  });

  it("returns RealOutstandAdapter when OUTSTAND_API_KEY is set (no Fake fallback)", () => {
    getServerEnv.mockReturnValue({
      OUTSTAND_API_KEY: "test-key",
      OUTSTAND_API_BASE_URL: "https://api.outstand.so",
      OUTSTAND_ORG_ID: "org-1",
      BETTER_AUTH_URL: "http://localhost:3000",
    });

    const adapter = getOutstandAdapter();

    expect(createRealOutstandAdapter).toHaveBeenCalledTimes(1);
    expect(createRealOutstandAdapter).toHaveBeenCalledWith("test-key", {
      appOrigin: "http://localhost:3000",
      baseUrl: "https://api.outstand.so",
      orgId: "org-1",
    });
    expect(adapter).toEqual({ kind: "real-outstand-adapter" });
  });
});
