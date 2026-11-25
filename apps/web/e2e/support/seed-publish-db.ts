import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { withTx } from "./seed-db";

/**
 * Fixtures for the S-008 Publish golden path (T-294), seeded straight into
 * the "E2E Sandbox" workspace:
 *
 * - one fake Instagram account (`active`, fake Outstand id);
 * - a `published` post with a real, playable mp4 in the media library
 *   (`media_items` row plus the file in the `media` bucket);
 * - an `in_review` post (for Mark Ready in Approvals);
 * - 12 `published`/`imported` posts with `analytics_post_metrics` in the
 *   last 90 days, 3 per weekday-and-hour bucket (4 buckets), so the empty
 *   Queue has best-time suggestions for the fake account (T-291).
 *
 * Hard rules (same as `seed-db.ts`, ADR-081, ADR-149):
 * - Never publishes or schedules: rows are written to the DB without an
 *   `outstand_post_id`, and the account has a fake Outstand id. No Outstand
 *   call. No `scheduled` post is created, so the Queue stays empty.
 * - Only the `E2E_WORKSPACE_NAME` workspace (through `withTx`, RLS on) and
 *   only rows carrying `S008_PREFIX`. Idempotent: `cleanupPublishFixtures()`
 *   without a stamp removes leftovers older than `STALE_AFTER`; with a stamp
 *   it removes this run's rows.
 */
export const S008_PREFIX = "e2e-s008-";
const STALE_AFTER = "2 hours";
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const VIDEO_FILE = path.join(__dirname, "..", "fixtures", "e2e-video.mp4");

export interface PublishSeed {
  stamp: string;
  workspaceId: string;
  accountId: string;
  accountHandle: string;
  /** `null` when Supabase Storage is not configured (no video seeded). */
  videoPostId: string | null;
  inReviewPostId: string;
  captions: {
    video: string;
    inReview: string;
    /** Caption for a post the test itself creates (cleaned up by prefix). */
    submitted: string;
  };
}

function storageClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function mediaFolder(workspaceId: string) {
  return `${workspaceId}/e2e`;
}

export async function seedPublishFixtures(): Promise<PublishSeed> {
  const stamp = Date.now().toString(36);
  const accountHandle = `${S008_PREFIX}${stamp}-ig`;
  const captions = {
    video: `${S008_PREFIX}${stamp} video`,
    inReview: `${S008_PREFIX}${stamp} in review`,
    submitted: `${S008_PREFIX}${stamp} ajukan review`,
  };
  const storage = storageClient();

  return withTx(async (client, { workspaceId, actorId }) => {
    const accountId = (
      await client.query<{ id: string }>(
        `INSERT INTO workspace_connected_accounts
           (workspace_id, platform, outstand_account_id, handle, status, updated_at)
         VALUES ($1, 'instagram', $2, $2, 'active', now()) RETURNING id`,
        [workspaceId, accountHandle],
      )
    ).rows[0].id;

    const insertPost = async (p: {
      status: string;
      caption: string;
      publishedAt?: Date;
      mediaIds?: string[];
      targetStatus: string;
    }) => {
      const post = await client.query<{ id: string }>(
        `INSERT INTO publishing_posts
           (workspace_id, author_id, status, caption, media_ids, scheduled_at,
            published_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::uuid[], $6, $6, now()) RETURNING id`,
        [
          workspaceId,
          p.status === "imported" ? null : actorId,
          p.status,
          p.caption,
          p.mediaIds ?? [],
          p.publishedAt ?? null,
        ],
      );
      const postId = post.rows[0].id;
      await client.query(
        `INSERT INTO publishing_post_targets
           (post_id, connected_account_id, platform, status, content_format,
            platform_post_url, updated_at)
         VALUES ($1, $2, 'instagram', $3, 'post', $4, now())`,
        [
          postId,
          accountId,
          p.targetStatus,
          p.targetStatus === "published"
            ? `https://www.instagram.com/p/${S008_PREFIX}${stamp}/`
            : null,
        ],
      );
      return postId;
    };

    const now = Date.now();

    // Published video post, kept in the current month so the month
    // Calendar always shows it (also on the 1st of the month).
    let videoPostId: string | null = null;
    if (storage) {
      const storagePath = `${mediaFolder(workspaceId)}/${S008_PREFIX}${stamp}.mp4`;
      const bytes = fs.readFileSync(VIDEO_FILE);
      const { error } = await storage.storage
        .from("media")
        .upload(storagePath, bytes, { contentType: "video/mp4", upsert: true });
      if (error) throw new Error(`video seed failed: ${error.message}`);
      const mediaId = (
        await client.query<{ id: string }>(
          `INSERT INTO media_items
             (workspace_id, uploader_id, filename, mime_type, size, storage_path,
              type, width, height, duration)
           VALUES ($1, $2, $3, 'video/mp4', $4, $5, 'video', 160, 120, 3)
           RETURNING id`,
          [
            workspaceId,
            actorId,
            `${S008_PREFIX}${stamp}.mp4`,
            bytes.length,
            storagePath,
          ],
        )
      ).rows[0].id;
      const nowDate = new Date(now);
      const monthStart = Date.UTC(
        nowDate.getUTCFullYear(),
        nowDate.getUTCMonth(),
        1,
        8,
      );
      videoPostId = await insertPost({
        status: "published",
        caption: captions.video,
        publishedAt: new Date(Math.min(now, Math.max(now - DAY, monthStart))),
        mediaIds: [mediaId],
        targetStatus: "published",
      });
    }

    const inReviewPostId = await insertPost({
      status: "in_review",
      caption: captions.inReview,
      targetStatus: "pending",
    });

    // Best-time samples: 4 weekday-and-hour buckets x 3 weeks back = 12
    // posts. A bucket's next occurrence is within the next 4 days, so it
    // falls inside the 7-day lookahead in any display time zone.
    const bucketOffsets = [
      2 * HOUR,
      DAY + 3 * HOUR,
      2 * DAY + 4 * HOUR,
      3 * DAY + 5 * HOUR,
    ];
    let n = 0;
    for (const [bucket, offset] of bucketOffsets.entries()) {
      for (let week = 1; week <= 3; week++) {
        n++;
        const postId = await insertPost({
          status: n % 3 === 0 ? "imported" : "published",
          caption: `${S008_PREFIX}${stamp} best-time ${n}`,
          publishedAt: new Date(now - week * 7 * DAY + offset),
          targetStatus: "published",
        });
        await client.query(
          `INSERT INTO analytics_post_metrics
             (post_id, connected_account_id, platform, impressions, reach,
              likes, comments, shares, engagement_rate, fetched_at)
           VALUES ($1, $2, 'instagram', $3, $4, $5, 2, 1, $6, now())`,
          [
            postId,
            accountId,
            1000 + n * 10,
            800 + n * 10,
            40 + n,
            // Distinct medians per bucket, so the ranking is deterministic.
            (0.02 + bucket * 0.01).toFixed(4),
          ],
        );
      }
    }

    return {
      stamp,
      workspaceId,
      accountId,
      accountHandle,
      videoPostId,
      inReviewPostId,
      captions,
    };
  });
}

/** Status of a seeded post, read through the same RLS context as the seed. */
export async function readPostStatus(postId: string): Promise<string | null> {
  return withTx(async (client, { workspaceId }) => {
    const { rows } = await client.query<{ status: string }>(
      "SELECT status FROM publishing_posts WHERE id = $1 AND workspace_id = $2",
      [postId, workspaceId],
    );
    return rows[0]?.status ?? null;
  });
}

/**
 * Captions of posts that keep the Queue from being empty (Scheduled, not
 * deleted). The seed never creates one; anything here belongs to another run.
 */
export async function listQueuedCaptions(): Promise<string[]> {
  return withTx(async (client, { workspaceId }) => {
    const { rows } = await client.query<{ caption: string }>(
      `SELECT caption FROM publishing_posts
        WHERE workspace_id = $1 AND status = 'scheduled' AND deleted_at IS NULL`,
      [workspaceId],
    );
    return rows.map((row) => row.caption);
  });
}

/**
 * Remove S-008 fixtures. With `stamp`: this run's rows only. Without:
 * leftovers older than `STALE_AFTER` (a run on the shared DB keeps its own).
 * Posts created by the test itself carry the same caption prefix.
 */
export async function cleanupPublishFixtures(
  options: { stamp?: string } = {},
): Promise<{ posts: number; accounts: number; media: number; files: number }> {
  const { stamp } = options;
  const prefix = `${S008_PREFIX}${stamp ?? ""}`;
  const staleOnly = stamp
    ? ""
    : ` AND created_at < now() - interval '${STALE_AFTER}'`;

  const result = await withTx(async (client, { workspaceId }) => {
    const posts = await client.query<{ id: string }>(
      `SELECT id FROM publishing_posts WHERE workspace_id = $1 AND caption LIKE $2${staleOnly}`,
      [workspaceId, `${prefix}%`],
    );
    const ids = posts.rows.map((row) => row.id);
    if (ids.length > 0) {
      await client.query(
        "DELETE FROM analytics_post_metrics WHERE post_id = ANY($1::uuid[])",
        [ids],
      );
      await client.query(
        "DELETE FROM publishing_post_targets WHERE post_id = ANY($1::uuid[])",
        [ids],
      );
      await client.query(
        "DELETE FROM publishing_posts WHERE id = ANY($1::uuid[]) AND workspace_id = $2",
        [ids, workspaceId],
      );
    }
    const accounts = await client.query(
      `DELETE FROM workspace_connected_accounts WHERE workspace_id = $1 AND handle LIKE $2${staleOnly}`,
      [workspaceId, `${prefix}%`],
    );
    const media = await client.query(
      `DELETE FROM media_items WHERE workspace_id = $1 AND filename LIKE $2${staleOnly}`,
      [workspaceId, `${prefix}%`],
    );
    return {
      workspaceId,
      posts: ids.length,
      accounts: accounts.rowCount ?? 0,
      media: media.rowCount ?? 0,
    };
  });

  let files = 0;
  const storage = storageClient();
  if (storage) {
    const folder = mediaFolder(result.workspaceId);
    const { data } = await storage.storage
      .from("media")
      .list(folder, { limit: 1000, search: prefix });
    const staleBefore = Date.now() - STALE_AFTER_MS;
    const names = (data ?? [])
      .filter((file) => file.name.startsWith(prefix))
      .filter(
        (file) =>
          stamp !== undefined ||
          (file.created_at != null &&
            Date.parse(file.created_at) < staleBefore),
      )
      .map((file) => `${folder}/${file.name}`);
    if (names.length > 0) {
      await storage.storage.from("media").remove(names);
      files = names.length;
    }
  }

  return {
    posts: result.posts,
    accounts: result.accounts,
    media: result.media,
    files,
  };
}
