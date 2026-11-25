import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPublishJson } from "./publish-page-fetch";

function stubFetch(response: { ok?: boolean; status?: number; body?: string }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: response.ok ?? true,
      status: response.status ?? 200,
      text: async () => response.body ?? "{}",
    })),
  );
}

describe("fetchPublishJson (S-009)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("turns the date fields of items back into dates and leaves captions alone", async () => {
    stubFetch({
      body: JSON.stringify({
        items: [
          {
            caption: "2026-11-25T10:00:00.000Z",
            updatedAt: "2026-11-25T10:00:00.000Z",
            scheduledAt: null,
          },
        ],
        nextCursor: null,
      }),
    });
    const page = await fetchPublishJson<{
      items: { caption: string; updatedAt: Date; scheduledAt: Date | null }[];
    }>("/api/publish/list?tab=queue");
    expect(page.items[0]?.updatedAt).toBeInstanceOf(Date);
    expect(page.items[0]?.caption).toBe("2026-11-25T10:00:00.000Z");
    expect(page.items[0]?.scheduledAt).toBeNull();
  });

  it("throws on a non-OK answer, so the Retry Alert shows", async () => {
    stubFetch({ ok: false, status: 0 });
    await expect(fetchPublishJson("/api/publish/list")).rejects.toThrow();
  });

  it("throws on an error body", async () => {
    stubFetch({ body: JSON.stringify({ error: "unauthorized" }) });
    await expect(fetchPublishJson("/api/publish/list")).rejects.toThrow(
      "unauthorized",
    );
  });
});
