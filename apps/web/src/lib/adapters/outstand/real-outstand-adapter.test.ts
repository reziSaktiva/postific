import { ContentFormat, SocialPlatform } from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import { createRealOutstandAdapter } from "./real-outstand-adapter";
import type { FetchLike } from "./outstand-http-client";
import { OutstandIntegrationError } from "./outstand-integration-error";

const API_KEY = "test-outstand-api-key";
const APP_ORIGIN = "https://app.example.local";
const ORG_ID = "org-abc123";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildAdapter(
  fetchImpl: ReturnType<typeof vi.fn>,
  overrides: { orgId?: string | null } = {},
) {
  return createRealOutstandAdapter(API_KEY, {
    appOrigin: APP_ORIGIN,
    orgId: overrides.orgId === null ? undefined : (overrides.orgId ?? ORG_ID),
    fetchImpl: fetchImpl as unknown as FetchLike,
  });
}

describe("RealOutstandAdapter.schedulePost / publishNow (T-025.2/T-025.3)", () => {
  it("schedulePost sends ONE call with all targets + scheduledAt, mapping to Outstand's real `content`/`accounts` shape", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { success: true, post: { id: "post-123" } }),
      );
    const adapter = buildAdapter(fetchImpl);
    const scheduledAt = new Date("2026-10-01T10:00:00.000Z");

    const result = await adapter.schedulePost({
      caption: "Hello world",
      scheduledAt,
      targets: [
        {
          outstandAccountId: "acc-ig-1",
          platform: SocialPlatform.Instagram,
          contentFormat: ContentFormat.Reel,
          platformOptions: { coverImageUrl: "https://x/cover.png" },
        },
        {
          outstandAccountId: "acc-fb-1",
          platform: SocialPlatform.Facebook,
          contentFormat: ContentFormat.Post,
        },
      ],
    });

    expect(result).toEqual({ outstandPostId: "post-123" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.outstand.so/v1/posts");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Bearer ${API_KEY}`);

    const body = JSON.parse(init.body);
    expect(body.accounts).toEqual(["acc-ig-1", "acc-fb-1"]);
    expect(body.content).toBe("Hello world");
    expect(body.scheduledAt).toBe(scheduledAt.toISOString());
    // Instagram Reel + coverImageUrl → reelCoverUrl; Facebook Post = no override.
    expect(body.instagram).toEqual({
      reelCoverUrl: "https://x/cover.png",
    });
    expect(body.facebook).toBeUndefined();
    expect(body.targetOptions).toBeUndefined();
    expect(body.caption).toBeUndefined();
  });

  it("publishNow sends the same shape WITHOUT scheduledAt", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { success: true, post: { id: "post-456" } }),
      );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.publishNow({
      caption: "Ship it now",
      targets: [
        {
          outstandAccountId: "acc-1",
          platform: SocialPlatform.LinkedIn,
          contentFormat: ContentFormat.Post,
        },
      ],
    });

    expect(result).toEqual({ outstandPostId: "post-456" });
    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.scheduledAt).toBeUndefined();
    expect(body.content).toBe("Ship it now");
  });

  it("throws OutstandIntegrationError when create-a-post response has no post.id", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { success: true }));
    const adapter = buildAdapter(fetchImpl);

    await expect(
      adapter.schedulePost({
        caption: "x",
        scheduledAt: new Date(),
        targets: [
          {
            outstandAccountId: "acc-1",
            platform: SocialPlatform.Instagram,
            contentFormat: ContentFormat.Post,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(OutstandIntegrationError);
  });

  it("propagates HTTP error mapping (5xx → transient/retryable) from schedulePost", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(502, { message: "bad gateway" }));
    const adapter = buildAdapter(fetchImpl);

    await expect(
      adapter.schedulePost({
        caption: "x",
        scheduledAt: new Date(),
        targets: [
          {
            outstandAccountId: "acc-1",
            platform: SocialPlatform.Instagram,
            contentFormat: ContentFormat.Post,
          },
        ],
      }),
    ).rejects.toMatchObject({ type: "transient", retryable: true });
  });
});

describe("RealOutstandAdapter.schedulePost — platform-specific overrides (KI-069, ADR-114)", () => {
  async function schedulePostAndGetBody(
    fetchImpl: ReturnType<typeof vi.fn>,
    targets: Parameters<
      ReturnType<typeof buildAdapter>["schedulePost"]
    >[0]["targets"],
    caption = "caption",
  ) {
    const adapter = buildAdapter(fetchImpl);
    await adapter.schedulePost({
      caption,
      scheduledAt: new Date("2026-10-01T10:00:00.000Z"),
      targets,
    });
    const [, init] = fetchImpl.mock.calls[0];
    return JSON.parse(init.body);
  }

  it("sends `instagram: { publishAsStory: true }` for Instagram Story and clears caption", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { success: true, post: { id: "post-1" } }),
      );

    const body = await schedulePostAndGetBody(fetchImpl, [
      {
        outstandAccountId: "acc-ig-1",
        platform: SocialPlatform.Instagram,
        contentFormat: ContentFormat.Story,
      },
    ]);

    expect(body.instagram).toEqual({ publishAsStory: true });
    expect(body.content).toBe("");
    expect(body.facebook).toBeUndefined();
    expect(body.pinterest).toBeUndefined();
  });

  it("throws client_error when mixing Story with captioned non-Story targets", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { success: true, post: { id: "post-1" } }),
      );
    const adapter = buildAdapter(fetchImpl);

    await expect(
      adapter.schedulePost({
        caption: "Caption for feed",
        scheduledAt: new Date("2026-10-01T10:00:00.000Z"),
        targets: [
          {
            outstandAccountId: "acc-ig-story",
            platform: SocialPlatform.Instagram,
            contentFormat: ContentFormat.Story,
          },
          {
            outstandAccountId: "acc-ig-feed",
            platform: SocialPlatform.Instagram,
            contentFormat: ContentFormat.Post,
          },
        ],
      }),
    ).rejects.toMatchObject({
      type: "client_error",
      retryable: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends containers with media when media is provided (text-only keeps content)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { success: true, post: { id: "post-media" } }),
      );
    const adapter = buildAdapter(fetchImpl);

    await adapter.publishNow({
      caption: "With photo",
      targets: [
        {
          outstandAccountId: "acc-1",
          platform: SocialPlatform.Instagram,
          contentFormat: ContentFormat.Post,
        },
      ],
      media: [
        {
          url: "https://outstand.example/media/a.jpg",
          filename: "a.jpg",
        },
      ],
    });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.content).toBeUndefined();
    expect(body.containers).toEqual([
      {
        content: "With photo",
        media: [
          {
            url: "https://outstand.example/media/a.jpg",
            filename: "a.jpg",
          },
        ],
      },
    ]);
  });

  it("sends NO `instagram` key for Instagram Reel (no explicit flag — auto-detected by Outstand)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { success: true, post: { id: "post-1" } }),
      );

    const body = await schedulePostAndGetBody(fetchImpl, [
      {
        outstandAccountId: "acc-ig-1",
        platform: SocialPlatform.Instagram,
        contentFormat: ContentFormat.Reel,
      },
    ]);

    expect(body.instagram).toBeUndefined();
  });

  it("sends `facebook: { publishAsStory: true }` for Facebook Story", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { success: true, post: { id: "post-1" } }),
      );

    const body = await schedulePostAndGetBody(fetchImpl, [
      {
        outstandAccountId: "acc-fb-1",
        platform: SocialPlatform.Facebook,
        contentFormat: ContentFormat.Story,
      },
    ]);

    expect(body.facebook).toEqual({ publishAsStory: true });
  });

  it("sends `facebook: { publishAsReel: true }` for Facebook Reel", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { success: true, post: { id: "post-1" } }),
      );

    const body = await schedulePostAndGetBody(fetchImpl, [
      {
        outstandAccountId: "acc-fb-1",
        platform: SocialPlatform.Facebook,
        contentFormat: ContentFormat.Reel,
      },
    ]);

    expect(body.facebook).toEqual({ publishAsReel: true });
  });

  it("sends NO override key for a plain Post (Instagram or Facebook)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { success: true, post: { id: "post-1" } }),
      );

    const body = await schedulePostAndGetBody(fetchImpl, [
      {
        outstandAccountId: "acc-ig-1",
        platform: SocialPlatform.Instagram,
        contentFormat: ContentFormat.Post,
      },
      {
        outstandAccountId: "acc-fb-1",
        platform: SocialPlatform.Facebook,
        contentFormat: ContentFormat.Post,
      },
    ]);

    expect(body.instagram).toBeUndefined();
    expect(body.facebook).toBeUndefined();
  });

  it("rejects a Pinterest target without boardId before calling Outstand (KI-072 review)", async () => {
    const fetchImpl = vi.fn();
    const adapter = buildAdapter(fetchImpl);

    await expect(
      adapter.schedulePost({
        caption: "caption",
        scheduledAt: new Date("2026-10-01T10:00:00.000Z"),
        targets: [
          {
            outstandAccountId: "acc-pin-1",
            platform: SocialPlatform.Pinterest,
            contentFormat: ContentFormat.Pin,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(OutstandIntegrationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a whitespace boardId before calling Outstand (KI-072 review)", async () => {
    const fetchImpl = vi.fn();
    const adapter = buildAdapter(fetchImpl);

    await expect(
      adapter.schedulePost({
        caption: "caption",
        scheduledAt: new Date("2026-10-01T10:00:00.000Z"),
        targets: [
          {
            outstandAccountId: "acc-pin-1",
            platform: SocialPlatform.Pinterest,
            contentFormat: ContentFormat.Pin,
            platformOptions: { boardId: "   " },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(OutstandIntegrationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects two Pinterest accounts so the first board_id is not applied to the second (KI-072 review)", async () => {
    const fetchImpl = vi.fn();
    const adapter = buildAdapter(fetchImpl);

    await expect(
      adapter.schedulePost({
        caption: "caption",
        scheduledAt: new Date("2026-10-01T10:00:00.000Z"),
        targets: [
          {
            outstandAccountId: "acc-pin-1",
            platform: SocialPlatform.Pinterest,
            contentFormat: ContentFormat.Pin,
            platformOptions: { boardId: "board-a" },
          },
          {
            outstandAccountId: "acc-pin-2",
            platform: SocialPlatform.Pinterest,
            contentFormat: ContentFormat.Pin,
            platformOptions: { boardId: "board-b" },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(OutstandIntegrationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a Pinterest account without a board even when another Pinterest account has one (KI-072 review)", async () => {
    const fetchImpl = vi.fn();
    const adapter = buildAdapter(fetchImpl);

    await expect(
      adapter.publishNow({
        caption: "caption",
        targets: [
          {
            outstandAccountId: "acc-pin-1",
            platform: SocialPlatform.Pinterest,
            contentFormat: ContentFormat.Pin,
          },
          {
            outstandAccountId: "acc-pin-2",
            platform: SocialPlatform.Pinterest,
            contentFormat: ContentFormat.Pin,
            platformOptions: { boardId: "board-b" },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(OutstandIntegrationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends `pinterest: { board_id, title, link }` when `platformOptions.boardId` is present (closes KI-072)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { success: true, post: { id: "post-1" } }),
      );

    const body = await schedulePostAndGetBody(fetchImpl, [
      {
        outstandAccountId: "acc-pin-1",
        platform: SocialPlatform.Pinterest,
        contentFormat: ContentFormat.Pin,
        platformOptions: {
          boardId: "987654321098765432",
          pinTitle: "Resep Kopi Susu",
          pinLink: "https://example.com/resep-kopi-susu",
        },
      },
    ]);

    expect(body.pinterest).toEqual({
      board_id: "987654321098765432",
      title: "Resep Kopi Susu",
      link: "https://example.com/resep-kopi-susu",
    });
  });

  it("sends `pinterest: { board_id }` only, omitting `title`/`link` when pinTitle/pinLink are absent (closes KI-072)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { success: true, post: { id: "post-1" } }),
      );

    const body = await schedulePostAndGetBody(fetchImpl, [
      {
        outstandAccountId: "acc-pin-1",
        platform: SocialPlatform.Pinterest,
        contentFormat: ContentFormat.Pin,
        platformOptions: { boardId: "987654321098765432" },
      },
    ]);

    expect(body.pinterest).toEqual({ board_id: "987654321098765432" });
  });

  it("first-match-wins + warns on a same-network contentFormat conflict across multiple targets", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { success: true, post: { id: "post-1" } }),
      );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Caption kosong — Story+Reel campur dengan caption akan throw
    // (aturan terpisah); di sini kita menguji first-match override saja.
    const body = await schedulePostAndGetBody(
      fetchImpl,
      [
        {
          outstandAccountId: "acc-fb-1",
          platform: SocialPlatform.Facebook,
          contentFormat: ContentFormat.Story,
        },
        {
          outstandAccountId: "acc-fb-2",
          platform: SocialPlatform.Facebook,
          contentFormat: ContentFormat.Reel,
        },
      ],
      "",
    );

    // First target (Story) wins — second (Reel) is dropped, not silently.
    expect(body.facebook).toEqual({ publishAsStory: true });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("Konflik contentFormat");

    warnSpy.mockRestore();
  });
});

describe("RealOutstandAdapter.fetchPostOutcome (T-025.2, ADR-092/ADR-108)", () => {
  it("maps get-post-details response (post.socialAccounts[], real `id` field) per account, defaulting missing expected accounts to pending", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        post: {
          id: "post-123",
          socialAccounts: [
            {
              id: "acc-1",
              nickname: "My Company",
              network: "instagram",
              username: "mycompany",
              status: "published",
              platformPostId: "ig-media-1",
              platformPostUrl: "https://instagram.com/p/abc",
              publishedAt: "2026-09-20T00:00:00.000Z",
              error: null,
            },
          ],
        },
      }),
    );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.fetchPostOutcome("post-123", [
      "acc-1",
      "acc-2",
    ]);

    expect(result).toEqual([
      {
        outstandAccountId: "acc-1",
        status: "published",
        error: null,
        platformPostId: "ig-media-1",
        platformPostUrl: "https://instagram.com/p/abc",
        publishedAt: new Date("2026-09-20T00:00:00.000Z"),
      },
      {
        outstandAccountId: "acc-2",
        status: "pending",
        error: null,
        platformPostId: null,
        platformPostUrl: null,
        publishedAt: null,
      },
    ]);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.outstand.so/v1/posts/post-123");
    expect(init.method).toBe("GET");
  });

  it("normalizes a failed-account status + error message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        post: {
          id: "post-123",
          socialAccounts: [
            { id: "acc-1", status: "failed", error: "token revoked" },
          ],
        },
      }),
    );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.fetchPostOutcome("post-123", ["acc-1"]);

    expect(result[0].status).toBe("failed");
    expect(result[0].error).toBe("token revoked");
  });
});

describe("RealOutstandAdapter.cancelScheduledPost / deletePost (T-030/T-034.4)", () => {
  it("cancelScheduledPost sends DELETE /v1/posts/{id} (cancel-before-publish, not remote delete)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const adapter = buildAdapter(fetchImpl);

    await adapter.cancelScheduledPost("post-123");

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.outstand.so/v1/posts/post-123");
    expect(init.method).toBe("DELETE");
  });

  it("deletePost without accountIds calls DELETE /v1/posts/{id}/remote", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { success: true, results: [] }));
    const adapter = buildAdapter(fetchImpl);

    await adapter.deletePost("post-123");

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.outstand.so/v1/posts/post-123/remote");
    expect(init.method).toBe("DELETE");
  });

  it("deletePost with accountIds throws client_error (API cannot scoped-delete)", async () => {
    const fetchImpl = vi.fn();
    const adapter = buildAdapter(fetchImpl);

    await expect(
      adapter.deletePost("post-123", ["acc-1", "acc-2"]),
    ).rejects.toMatchObject({
      type: "client_error",
      retryable: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("RealOutstandAdapter analytics (fetchPostMetrics/fetchWorkspaceMetrics, T-041 via T-025)", () => {
  it("fetchPostMetrics reads aggregated_metrics.total_* (real field names) and computes engagementRate when absent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        post: {
          id: "post-123",
          publishedAt: "2026-09-20T00:00:00.000Z",
          createdAt: "2026-09-19T00:00:00.000Z",
        },
        metrics_by_account: [],
        aggregated_metrics: {
          total_impressions: 1000,
          total_reach: 500,
          total_likes: 40,
          total_comments: 5,
          total_shares: 5,
          total_views: 100,
        },
      }),
    );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.fetchPostMetrics("post-123");

    expect(result).toEqual({
      impressions: 1000,
      reach: 500,
      likes: 40,
      comments: 5,
      shares: 5,
      clicks: null,
      engagementRate: 0.1,
    });

    const [url] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.outstand.so/v1/posts/post-123/analytics");
  });

  it("fetchWorkspaceMetrics passes since/until as Unix timestamps to /v1/social-accounts/{id}/metrics and maps the best-effort shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        data: {
          account_id: "acc-1",
          network: "instagram",
          followers_count: 1000,
          posts_count: 12,
          engagement: { likes: 300, comments: 80, shares: 20, reach: 5000 },
        },
      }),
    );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.fetchWorkspaceMetrics("acc-1", "last_30_days");

    expect(result.totalPosts).toBe(12);
    expect(result.totalReach).toBe(5000);
    expect(result.totalEngagements).toBe(400);
    // Known gap (2026-09-23): Outstand's account metrics endpoint has no
    // average-engagement-rate field at all.
    expect(result.avgEngagementRate).toBe(0);

    const [url] = fetchImpl.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/v1/social-accounts/acc-1/metrics");
    expect(parsed.searchParams.has("since")).toBe(true);
    expect(parsed.searchParams.has("until")).toBe(true);
    expect(Number(parsed.searchParams.get("since"))).not.toBeNaN();
  });
});

describe("RealOutstandAdapter.fetchComments / replyToComment (T-025.6, redesain KI-068/ADR-113)", () => {
  it("fetchComments calls GET /v1/posts/{id}/replies with network+username query and maps NormalizedReply[] from `data`", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        replies: [],
        data: [
          {
            id: "reply-1",
            author: "johndoe",
            text: "Great post!",
            created_at: "2026-01-15T10:30:00Z",
          },
          {
            id: "reply-2",
            author: "janedoe",
            text: "Agreed!",
            created_at: null,
          },
        ],
      }),
    );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.fetchComments({
      outstandPostId: "post-123",
      platform: SocialPlatform.Twitter,
      accountUsername: "mycompany",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/v1/posts/post-123/replies");
    // Twitter -> "x" (SAME mapping as `toOutstandNetwork` dipakai `connectAccount`/`schedulePost`).
    expect(parsed.searchParams.get("network")).toBe("x");
    expect(parsed.searchParams.get("username")).toBe("mycompany");
    expect(init.method).toBe("GET");

    expect(result.comments).toHaveLength(2);
    expect(result.comments[0]).toEqual({
      outstandCommentId: "reply-1",
      platform: SocialPlatform.Twitter,
      authorHandle: "johndoe",
      content: "Great post!",
      outstandPostId: "post-123",
      receivedAt: new Date("2026-01-15T10:30:00Z"),
    });
    // `created_at: null` -> fallback ke waktu fetch (bukan error), lihat docstring method ini.
    expect(result.comments[1].receivedAt).toBeInstanceOf(Date);
  });

  it("fetchComments skips malformed entries (missing/empty id) instead of throwing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        replies: [],
        data: [
          { author: "no-id", text: "missing id field entirely" },
          { id: "", author: "empty-id", text: "empty id string" },
          { id: "reply-valid", author: "ok", text: "valid", created_at: null },
        ],
      }),
    );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.fetchComments({
      outstandPostId: "post-123",
      platform: SocialPlatform.Instagram,
      accountUsername: "mycompany",
    });

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].outstandCommentId).toBe("reply-valid");
  });

  it("replyToComment calls POST /v1/posts/{id}/replies with content + account_username + parent_comment_id and maps reply_id", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { success: true, reply_id: "platform-reply-1" }),
      );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.replyToComment({
      outstandPostId: "post-123",
      content: "Great post! I agree with you.",
      accountUsername: "mycompany",
      parentOutstandCommentId: "comment-abc",
    });

    expect(result).toEqual({ outstandReplyId: "platform-reply-1" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.outstand.so/v1/posts/post-123/replies");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      content: "Great post! I agree with you.",
      account_username: "mycompany",
      parent_comment_id: "comment-abc",
    });
  });

  it("replyToComment always sends account_username even when parent_comment_id is omitted", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { success: true, reply_id: "platform-reply-2" }),
      );
    const adapter = buildAdapter(fetchImpl);

    await adapter.replyToComment({
      outstandPostId: "post-123",
      content: "No threading here.",
      accountUsername: "brand_handle",
    });

    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      content: "No threading here.",
      account_username: "brand_handle",
    });
  });

  it("replyToComment throws OutstandIntegrationError when response has no valid reply_id", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { success: true }));
    const adapter = buildAdapter(fetchImpl);

    await expect(
      adapter.replyToComment({
        outstandPostId: "post-123",
        content: "Hi",
        accountUsername: "mycompany",
      }),
    ).rejects.toBeInstanceOf(OutstandIntegrationError);
  });
});

/** Base64url JSON state — SAMA bentuknya dengan `encodeState` privat di `real-outstand-adapter.ts` (ADR-105/ADR-112), dipakai untuk membangun `state` yang valid di test tanpa meng-export helper privat itu. */
function buildState(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

describe("RealOutstandAdapter.connectAccount / resolveConnectCallback (T-025.4, ADR-105, redesain ADR-112)", () => {
  it("connectAccount builds the real Outstand redirect URL directly (no HTTP call) using OUTSTAND_ORG_ID", async () => {
    const fetchImpl = vi.fn();
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.connectAccount({
      workspaceId: "ws-1",
      platform: SocialPlatform.Instagram,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    const url = new URL(result.redirectUrl);
    expect(url.origin).toBe("https://www.outstand.so");
    expect(url.pathname).toBe(`/app/api/socials/instagram/${ORG_ID}`);
    const redirectUri = url.searchParams.get("redirect_uri");
    expect(redirectUri).toContain(
      `${APP_ORIGIN}/api/integrations/outstand/callback`,
    );
    expect(redirectUri).toContain("state=");
  });

  it("connectAccount maps SocialPlatform.Twitter to Outstand's 'x' network name", async () => {
    const fetchImpl = vi.fn();
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.connectAccount({
      workspaceId: "ws-1",
      platform: SocialPlatform.Twitter,
    });

    const url = new URL(result.redirectUrl);
    expect(url.pathname).toBe(`/app/api/socials/x/${ORG_ID}`);
  });

  it("connectAccount throws OutstandIntegrationError when OUTSTAND_ORG_ID is not configured", async () => {
    const fetchImpl = vi.fn();
    const adapter = buildAdapter(fetchImpl, { orgId: null });

    await expect(
      adapter.connectAccount({
        workspaceId: "ws-1",
        platform: SocialPlatform.Instagram,
      }),
    ).rejects.toBeInstanceOf(OutstandIntegrationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("resolveConnectCallback maps account_id/username directly to ConnectedAccountData, WITHOUT an exchange call (ADR-112 — platform from state)", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: { id: "acc-ig-1", profile_picture_url: null },
      }),
    );
    const adapter = buildAdapter(fetchImpl);
    const state = buildState({
      workspaceId: "ws-1",
      platform: SocialPlatform.Instagram,
      nonce: "nonce-1",
    });

    const result = await adapter.resolveConnectCallback({
      state,
      outstandAccountId: "acc-ig-1",
      username: "@realuser",
    });

    expect(result).toEqual({
      outstandAccountId: "acc-ig-1",
      platform: SocialPlatform.Instagram,
      handle: "@realuser",
      status: "active",
      avatarUrl: null,
    });
  });

  it("resolveConnectCallback fetches GET /v1/social-accounts/{id} for the avatar (KI-076/ADR-120) and maps profile_picture_url to avatarUrl", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: {
          id: "acc-ig-1",
          profile_picture_url: "https://cdn.example.com/avatar.jpg",
        },
      }),
    );
    const adapter = buildAdapter(fetchImpl);
    const state = buildState({
      workspaceId: "ws-1",
      platform: SocialPlatform.Instagram,
      nonce: "nonce-1",
    });

    const result = await adapter.resolveConnectCallback({
      state,
      outstandAccountId: "acc-ig-1",
      username: "@realuser",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchImpl.mock.calls[0] as [
      string | URL,
      RequestInit,
    ];
    expect(String(calledUrl)).toContain("/v1/social-accounts/acc-ig-1");
    expect(calledInit.method).toBe("GET");
    expect(result.avatarUrl).toBe("https://cdn.example.com/avatar.jpg");
  });

  it("resolveConnectCallback falls back to avatarUrl: null (best-effort) when the avatar fetch fails, WITHOUT failing the connect itself (KI-076/ADR-120)", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(404, {}));
    const adapter = buildAdapter(fetchImpl);
    const state = buildState({
      workspaceId: "ws-1",
      platform: SocialPlatform.Instagram,
      nonce: "nonce-1",
    });

    const result = await adapter.resolveConnectCallback({
      state,
      outstandAccountId: "acc-ig-1",
      username: "@realuser",
    });

    expect(result).toEqual({
      outstandAccountId: "acc-ig-1",
      platform: SocialPlatform.Instagram,
      handle: "@realuser",
      status: "active",
      avatarUrl: null,
    });
  });

  it("resolveConnectCallback throws OutstandIntegrationError for a malformed state, WITHOUT calling fetch", async () => {
    const fetchImpl = vi.fn();
    const adapter = buildAdapter(fetchImpl);

    await expect(
      adapter.resolveConnectCallback({
        state: "not-a-valid-base64url-json-state",
        outstandAccountId: "acc-ig-1",
        username: "@realuser",
      }),
    ).rejects.toBeInstanceOf(OutstandIntegrationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("resolveConnectCallback throws OutstandIntegrationError for Facebook (multi-page flow out of scope, KI-070), WITHOUT calling fetch", async () => {
    const fetchImpl = vi.fn();
    const adapter = buildAdapter(fetchImpl);
    const state = buildState({
      workspaceId: "ws-1",
      platform: SocialPlatform.Facebook,
      nonce: "nonce-1",
    });

    await expect(
      adapter.resolveConnectCallback({
        state,
        outstandAccountId: "page-1",
        username: "Fake Page",
      }),
    ).rejects.toBeInstanceOf(OutstandIntegrationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("resolveConnectCallback throws OutstandIntegrationError when outstandAccountId/username is empty, WITHOUT calling fetch", async () => {
    const fetchImpl = vi.fn();
    const adapter = buildAdapter(fetchImpl);
    const state = buildState({
      workspaceId: "ws-1",
      platform: SocialPlatform.Instagram,
      nonce: "nonce-1",
    });

    await expect(
      adapter.resolveConnectCallback({
        state,
        outstandAccountId: "",
        username: "@realuser",
      }),
    ).rejects.toBeInstanceOf(OutstandIntegrationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("RealOutstandAdapter.listPendingFacebookPages / confirmFacebookPagesConnection (T-025.4, ADR-115, wire-format dikoreksi ADR-116)", () => {
  it("listPendingFacebookPages calls GET /v1/social-accounts/pending/{sessionToken} and maps data.availablePages[] (real Outstand response is wrapped, not flat)", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: {
          network: "facebook",
          expiresAt: 1734567890000,
          availablePages: [
            {
              id: "fb-page-1",
              type: "page",
              name: "Kopi Selasar",
              username: "kopi.selasar",
              profilePictureUrl: "https://example.com/kopi-selasar.jpg",
              category: "Coffee Shop",
              urn: "urn:fb:page:1",
              accountId: "accounts/1",
              address: "Jl. Selasar No. 1",
            },
            // Baris tanpa `id`/`name` valid harus di-skip diam-diam.
            { id: "", name: "Invalid" },
          ],
        },
      }),
    );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.listPendingFacebookPages({
      sessionToken: "session-token-1",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.outstand.so/v1/social-accounts/pending/session-token-1",
    );
    expect(init.method).toBe("GET");
    expect(result).toEqual({
      pages: [
        {
          pageId: "fb-page-1",
          name: "Kopi Selasar",
          pictureUrl: "https://example.com/kopi-selasar.jpg",
          category: "Coffee Shop",
        },
      ],
    });
  });

  it("listPendingFacebookPages returns an empty list when data.availablePages is missing", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: {} }));
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.listPendingFacebookPages({
      sessionToken: "session-token-1",
    });

    expect(result).toEqual({ pages: [] });
  });

  it("confirmFacebookPagesConnection calls POST /v1/social-accounts/pending/{sessionToken}/finalize with { selectedPageIds } and maps response.connectedAccounts[] (real Outstand response, not { accounts })", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        connectedAccounts: [
          {
            id: "fb-page-1",
            nickname: "kopiselasar",
            username: "kopi.selasar",
            network: "facebook",
            accountType: "page",
          },
          // Baris tanpa `id` valid harus di-skip diam-diam.
          { nickname: "Invalid" },
        ],
      }),
    );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.confirmFacebookPagesConnection({
      sessionToken: "session-token-1",
      selectedPageIds: ["fb-page-1"],
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.outstand.so/v1/social-accounts/pending/session-token-1/finalize",
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      selectedPageIds: ["fb-page-1"],
    });
    expect(result).toEqual({
      accounts: [
        {
          outstandAccountId: "fb-page-1",
          platform: SocialPlatform.Facebook,
          handle: "kopi.selasar",
          status: "active",
          // KI-076/ADR-120 — response finalize TIDAK PERNAH membawa foto
          // profil; join balik dari `listPendingFacebookPages` adalah
          // tanggung jawab WorkspaceService, bukan adapter ini.
          avatarUrl: null,
        },
      ],
    });
  });

  it("confirmFacebookPagesConnection falls back to `nickname` when `username` is absent", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        connectedAccounts: [
          { id: "fb-page-2", nickname: "Roti Selasar", network: "facebook" },
        ],
      }),
    );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.confirmFacebookPagesConnection({
      sessionToken: "session-token-1",
      selectedPageIds: ["fb-page-2"],
    });

    expect(result.accounts[0]?.handle).toBe("Roti Selasar");
  });

  it("confirmFacebookPagesConnection throws OutstandIntegrationError for an empty selectedPageIds, WITHOUT calling fetch", async () => {
    const fetchImpl = vi.fn();
    const adapter = buildAdapter(fetchImpl);

    await expect(
      adapter.confirmFacebookPagesConnection({
        sessionToken: "session-token-1",
        selectedPageIds: [],
      }),
    ).rejects.toBeInstanceOf(OutstandIntegrationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("drops accounts outside selectedPageIds when at least one id matches", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        connectedAccounts: [
          { id: "fb-page-1", username: "kept" },
          { id: "not-selected", username: "dropped" },
        ],
      }),
    );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.confirmFacebookPagesConnection({
      sessionToken: "session-token-1",
      selectedPageIds: ["fb-page-1"],
    });

    expect(result.accounts.map((account) => account.outstandAccountId)).toEqual(
      ["fb-page-1"],
    );
  });

  it("keeps Outstand account ids that do not share the Facebook page id namespace", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        connectedAccounts: [{ id: "9dyJS", username: "johndoe" }],
      }),
    );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.confirmFacebookPagesConnection({
      sessionToken: "session-token-1",
      selectedPageIds: ["abc123"],
    });

    expect(result.accounts[0]?.outstandAccountId).toBe("9dyJS");
  });

  it("throws when finalize returns more accounts than selected pages", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        connectedAccounts: [
          { id: "9dyJS", username: "one" },
          { id: "other", username: "two" },
        ],
      }),
    );
    const adapter = buildAdapter(fetchImpl);

    await expect(
      adapter.confirmFacebookPagesConnection({
        sessionToken: "session-token-1",
        selectedPageIds: ["abc123"],
      }),
    ).rejects.toBeInstanceOf(OutstandIntegrationError);
  });

  it("throws when every connected account is missing a handle", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        connectedAccounts: [{ id: "fb-page-1" }],
      }),
    );
    const adapter = buildAdapter(fetchImpl);

    await expect(
      adapter.confirmFacebookPagesConnection({
        sessionToken: "session-token-1",
        selectedPageIds: ["fb-page-1"],
      }),
    ).rejects.toBeInstanceOf(OutstandIntegrationError);
  });
});

describe("RealOutstandAdapter.listPinterestBoards (closes KI-072, sisa scope ADR-114)", () => {
  it("calls GET /v1/pinterest/accounts/{id}/boards and maps id/name, ignoring extra fields", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        count: 2,
        data: [
          {
            id: "987654321098765432",
            name: "Resep & Minuman",
            description: "My favourite recipes",
            pin_count: 42,
            privacy: "PUBLIC",
            owner: { username: "myaccount" },
            created_at: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "111222333444555666",
            name: "Interior Kedai",
            privacy: "PUBLIC",
          },
        ],
      }),
    );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.listPinterestBoards("acc-pin-1");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.outstand.so/v1/pinterest/accounts/acc-pin-1/boards",
    );
    expect(init.method).toBe("GET");
    expect(result).toEqual([
      { id: "987654321098765432", name: "Resep & Minuman" },
      { id: "111222333444555666", name: "Interior Kedai" },
    ]);
  });

  it("skips entries missing a valid id/name and returns an empty list when data is missing", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: [{ id: "", name: "Invalid" }, { id: "valid-no-name" }],
      }),
    );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.listPinterestBoards("acc-pin-1");
    expect(result).toEqual([]);

    const fetchImplNoData = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));
    const adapterNoData = buildAdapter(fetchImplNoData);
    expect(await adapterNoData.listPinterestBoards("acc-pin-1")).toEqual([]);
  });
});

describe("RealOutstandAdapter.uploadMediaWorkingCopy (T-025.5, ADR-106)", () => {
  it("chains POST /v1/media/upload → PUT bytes → POST /v1/media/{id}/confirm, returning the mapped result", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            id: "media-1",
            upload_url: "https://uploads.outstand.example/put-here",
            expires_in: 3600,
          },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 })) // PUT bytes
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            id: "media-1",
            filename: "upload-abc.png",
            url: "https://outstand.example/media/media-1.png",
            content_type: "image/png",
            size: 10,
            status: "active",
            created_at: "2026-09-23T00:00:00.000Z",
            expires_at: "2026-11-22T00:00:00.000Z",
          },
        }),
      );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.uploadMediaWorkingCopy({
      fileBuffer: Buffer.from("fake-bytes"),
      mimeType: "image/png",
    });

    expect(result).toEqual({
      outstandMediaId: "media-1",
      outstandMediaUrl: "https://outstand.example/media/media-1.png",
      expiresAt: new Date("2026-11-22T00:00:00.000Z"),
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const [firstUrl, firstInit] = fetchImpl.mock.calls[0];
    expect(firstUrl).toBe("https://api.outstand.so/v1/media/upload");
    const firstBody = JSON.parse(firstInit.body);
    expect(firstBody.content_type).toBe("image/png");
    expect(typeof firstBody.filename).toBe("string");
    expect(firstBody.filename.length).toBeGreaterThan(0);

    const [putUrl, putInit] = fetchImpl.mock.calls[1];
    expect(putUrl).toBe("https://uploads.outstand.example/put-here");
    expect(putInit.method).toBe("PUT");

    const [confirmUrl, confirmInit] = fetchImpl.mock.calls[2];
    expect(confirmUrl).toBe("https://api.outstand.so/v1/media/media-1/confirm");
    expect(JSON.parse(confirmInit.body)).toEqual({ size: 10 });
  });

  it("throws OutstandIntegrationError when the upload step returns no upload_url/id", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { success: true, data: {} }));
    const adapter = buildAdapter(fetchImpl);

    await expect(
      adapter.uploadMediaWorkingCopy({
        fileBuffer: Buffer.from("x"),
        mimeType: "image/png",
      }),
    ).rejects.toBeInstanceOf(OutstandIntegrationError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("RealOutstandAdapter.importPosts / fetchImportJobStatus (T-112)", () => {
  it("importPosts POSTs to /v1/social-accounts/{id}/imports with since/until/limit and maps data.id to importJobId", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(202, {
        success: true,
        data: {
          id: "import-job-1",
          orgId: ORG_ID,
          socialAccountId: "acc-ig-1",
          status: "queued",
          since: "2026-07-10T00:00:00.000Z",
          until: "2026-10-08T00:00:00.000Z",
          limit: 100,
          imported: 0,
          skipped: 0,
          failed: 0,
          error: null,
          createdAt: "2026-10-08T00:00:00.000Z",
          updatedAt: "2026-10-08T00:00:00.000Z",
          completedAt: null,
        },
      }),
    );
    const adapter = buildAdapter(fetchImpl);
    const since = new Date("2026-07-10T00:00:00.000Z");
    const until = new Date("2026-10-08T00:00:00.000Z");

    const result = await adapter.importPosts("acc-ig-1", {
      since,
      until,
      limit: 100,
    });

    expect(result).toEqual({ importJobId: "import-job-1" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      "https://api.outstand.so/v1/social-accounts/acc-ig-1/imports",
    );
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      since: since.toISOString(),
      until: until.toISOString(),
      limit: 100,
    });
  });

  it("importPosts throws OutstandIntegrationError when response has no valid data.id", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(202, { success: true, data: {} }));
    const adapter = buildAdapter(fetchImpl);

    await expect(adapter.importPosts("acc-ig-1", {})).rejects.toBeInstanceOf(
      OutstandIntegrationError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fetchImportJobStatus maps queued/running to pending WITHOUT calling GET /v1/posts", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        data: {
          id: "import-job-1",
          status: "queued",
          imported: 0,
          skipped: 0,
          failed: 0,
          error: null,
        },
      }),
    );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.fetchImportJobStatus(
      "acc-ig-1",
      "import-job-1",
    );

    expect(result).toEqual({ status: "pending", posts: [], error: null });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      "https://api.outstand.so/v1/social-accounts/acc-ig-1/imports/import-job-1",
    );
  });

  it("fetchImportJobStatus maps failed to failed WITHOUT calling GET /v1/posts", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        data: {
          id: "import-job-1",
          status: "failed",
          imported: 0,
          skipped: 0,
          failed: 0,
          error: "Outstand rate limited",
        },
      }),
    );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.fetchImportJobStatus(
      "acc-ig-1",
      "import-job-1",
    );

    expect(result).toEqual({
      status: "failed",
      posts: [],
      error: "Outstand rate limited",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fetchImportJobStatus maps completed to completed, fetching GET /v1/posts?social_account_id=... and mapping matched socialAccounts entry + containers to ImportedPostData[]", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            id: "import-job-1",
            status: "completed",
            since: "2026-07-10T00:00:00.000Z",
            until: "2026-10-08T00:00:00.000Z",
            imported: 1,
            skipped: 0,
            failed: 0,
            error: null,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: [
            {
              id: "post-1",
              publishedAt: "2026-08-01T00:00:00.000Z",
              containers: [
                {
                  id: "container-1",
                  content: "Hello from Instagram",
                  media: [
                    { url: "https://cdn.example/a.png", filename: "a.png" },
                  ],
                },
              ],
              socialAccounts: [
                {
                  id: "acc-ig-1",
                  network: "instagram",
                  status: "published",
                  platformPostId: "ig-post-1",
                  platformPostUrl: "https://instagram.com/p/ig-post-1",
                  publishedAt: "2026-08-01T00:05:00.000Z",
                },
              ],
            },
            {
              // Post targeting a DIFFERENT account — must be skipped.
              id: "post-2",
              containers: [{ id: "c2", content: "Other account", media: [] }],
              socialAccounts: [
                {
                  id: "acc-other",
                  status: "published",
                  platformPostId: "other-1",
                  platformPostUrl: null,
                  publishedAt: null,
                },
              ],
            },
          ],
          pagination: { limit: 1, offset: 0, total: 2, count: 2 },
        }),
      );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.fetchImportJobStatus(
      "acc-ig-1",
      "import-job-1",
    );

    expect(result).toEqual({
      status: "completed",
      posts: [
        {
          platformPostId: "ig-post-1",
          caption: "Hello from Instagram",
          publishedAt: new Date("2026-08-01T00:05:00.000Z"),
          platformPostUrl: "https://instagram.com/p/ig-post-1",
          mediaUrls: ["https://cdn.example/a.png"],
        },
      ],
      error: null,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [secondUrl] = fetchImpl.mock.calls[1];
    // Code review PR #149 — `GET /v1/posts` sekarang disempitkan dengan
    // `created_after`/`created_before` dari `since`/`until` JOB ini (bukan
    // hanya `social_account_id`+`limit` seperti sebelumnya), supaya hasil
    // tidak match post lain di akun yang sama di luar rentang job ini.
    expect(secondUrl).toBe(
      "https://api.outstand.so/v1/posts?social_account_id=acc-ig-1&limit=1" +
        "&created_after=2026-07-10T00%3A00%3A00.000Z" +
        "&created_before=2026-10-08T00%3A00%3A00.000Z",
    );
  });

  it("fetchImportJobStatus maps partial to completed WITH posts + a summarized error message", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            id: "import-job-1",
            status: "partial",
            since: "2026-07-10T00:00:00.000Z",
            until: "2026-10-08T00:00:00.000Z",
            imported: 1,
            skipped: 0,
            failed: 2,
            error: null,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: [
            {
              id: "post-1",
              containers: [
                { id: "c1", content: "Partial success post", media: [] },
              ],
              socialAccounts: [
                {
                  id: "acc-ig-1",
                  status: "published",
                  platformPostId: "ig-post-1",
                  platformPostUrl: null,
                  publishedAt: null,
                },
              ],
            },
          ],
        }),
      );
    const adapter = buildAdapter(fetchImpl);

    const result = await adapter.fetchImportJobStatus(
      "acc-ig-1",
      "import-job-1",
    );

    expect(result.status).toBe("completed");
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]?.platformPostId).toBe("ig-post-1");
    expect(result.error).toBe("2 dari 3 post gagal diimport.");
  });

  it("fetchImportJobStatus throws OutstandIntegrationError for an unrecognized status value (throw-loud, ADR-059)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        data: { id: "import-job-1", status: "unknown_future_status" },
      }),
    );
    const adapter = buildAdapter(fetchImpl);

    await expect(
      adapter.fetchImportJobStatus("acc-ig-1", "import-job-1"),
    ).rejects.toBeInstanceOf(OutstandIntegrationError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
