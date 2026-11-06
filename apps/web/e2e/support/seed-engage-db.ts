import { withTx } from "./seed-db";

/**
 * Semai data Engage per posting (T-222.1) di workspace "E2E Sandbox":
 * dua akun palsu (Instagram dan Facebook, `active`), tiga posting
 * `published`, dan enam komentar (`engagement_inbox_items`) dengan status dan
 * waktu terima berbeda, termasuk satu komentar tanpa posting.
 *
 * Aturan keras (ADR-081, ADR-149, konvensi `seed-db.ts`):
 * - Tidak pernah memublikasikan atau menjadwalkan: posting `published` ditulis
 *   langsung ke DB TANPA `outstand_post_id`, jadi sync komentar
 *   (`listSyncablePostsByConnectedAccount`) tidak memiliki apa pun untuk
 *   diambil dari Outstand. Akun palsu berid Outstand palsu.
 * - Semua baris berawalan `ENGAGE_PREFIX` + `stamp` milik run ini; cleanup
 *   hanya menghapus baris berawalan itu (dengan `stamp`: milik run itu;
 *   tanpa `stamp`: sisa lebih tua dari `STALE_AFTER`).
 * - Lewat `withTx` (role runtime, RLS aktif, hanya workspace E2E Sandbox).
 */
export const ENGAGE_PREFIX = "e2e-engage-";
const STALE_AFTER = "2 hours";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export interface EngageSeed {
  stamp: string;
  accounts: { instagram: string; facebook: string };
  captions: { p1: string; p2: string; p3: string };
  /** `https://...` yang disemai sebagai `platform_post_url` P1. */
  p1Url: string;
  /**
   * URL media eksternal (T-227) di `platform_options.mediaUrls` target P2 dan
   * P3 (`media_ids` kosong, seperti posting impor). Domain `.invalid`: tidak
   * pernah dimuat sungguhan, tes mencegatnya lewat route mocking.
   */
  externalMedia: { p2: string; p3: string };
  /** Tiap komentar: handle penulis (unik) dan isi. */
  comments: Record<
    "c1" | "c2" | "c3" | "c4" | "c5" | "c6",
    { handle: string; content: string }
  >;
}

export async function seedEngageFixtures(): Promise<EngageSeed> {
  const stamp = Date.now().toString(36);
  const handle = (n: string) => `@e2e-eng-${stamp}-${n}`;
  const seed: EngageSeed = {
    stamp,
    accounts: {
      instagram: `${ENGAGE_PREFIX}ig-${stamp}`,
      facebook: `${ENGAGE_PREFIX}fb-${stamp}`,
    },
    captions: {
      p1: `${ENGAGE_PREFIX}${stamp} posting satu`,
      p2: `${ENGAGE_PREFIX}${stamp} posting dua lama`,
      p3: `${ENGAGE_PREFIX}${stamp} posting tiga facebook`,
    },
    p1Url: `https://www.instagram.com/p/${ENGAGE_PREFIX}${stamp}/`,
    externalMedia: {
      p2: `https://e2e-cdn.invalid/${ENGAGE_PREFIX}${stamp}-p2-ok.png`,
      p3: `https://e2e-cdn.invalid/${ENGAGE_PREFIX}${stamp}-p3-rusak.png`,
    },
    comments: {
      c1: { handle: handle("c1"), content: `komentar c1 ${stamp} belum` },
      c2: { handle: handle("c2"), content: `komentar c2 ${stamp} lawas` },
      c3: { handle: handle("c3"), content: `komentar c3 ${stamp} dibalas` },
      c4: { handle: handle("c4"), content: `komentar c4 ${stamp} dua puluh` },
      c5: { handle: handle("c5"), content: `komentar c5 ${stamp} facebook` },
      c6: { handle: handle("c6"), content: `komentar c6 ${stamp} tanpa post` },
    },
  };

  await withTx(async (client, { workspaceId, actorId }) => {
    const insertAccount = async (platform: string, accountHandle: string) =>
      (
        await client.query<{ id: string }>(
          `INSERT INTO workspace_connected_accounts
             (workspace_id, platform, outstand_account_id, handle, status, updated_at)
           VALUES ($1, $2, $3, $4, 'active', now()) RETURNING id`,
          [workspaceId, platform, accountHandle, accountHandle],
        )
      ).rows[0].id;
    const igId = await insertAccount("instagram", seed.accounts.instagram);
    const fbId = await insertAccount("facebook", seed.accounts.facebook);

    const insertPost = async (
      caption: string,
      accountId: string,
      platform: string,
      url: string,
      mediaUrl?: string,
    ) => {
      const post = await client.query<{ id: string }>(
        `INSERT INTO publishing_posts
           (workspace_id, author_id, status, caption, published_at, updated_at)
         VALUES ($1, $2, 'published', $3, now(), now()) RETURNING id`,
        [workspaceId, actorId, caption],
      );
      await client.query(
        `INSERT INTO publishing_post_targets
           (post_id, connected_account_id, platform, status, content_format,
            platform_post_url, platform_options, updated_at)
         VALUES ($1, $2, $3, 'published', 'post', $4, $5::jsonb, now())`,
        [
          post.rows[0].id,
          accountId,
          platform,
          url,
          mediaUrl ? JSON.stringify({ mediaUrls: [mediaUrl] }) : null,
        ],
      );
      return post.rows[0].id;
    };
    const p1 = await insertPost(
      seed.captions.p1,
      igId,
      "instagram",
      seed.p1Url,
    );
    const p2 = await insertPost(
      seed.captions.p2,
      igId,
      "instagram",
      `https://www.instagram.com/p/${ENGAGE_PREFIX}${stamp}-dua/`,
      seed.externalMedia.p2,
    );
    const p3 = await insertPost(
      seed.captions.p3,
      fbId,
      "facebook",
      `https://www.facebook.com/${ENGAGE_PREFIX}${stamp}-tiga`,
      seed.externalMedia.p3,
    );

    const now = Date.now();
    const insertComment = async (c: {
      key: keyof EngageSeed["comments"];
      accountId: string;
      platform: string;
      postId: string | null;
      status: string;
      ageMs: number;
    }) => {
      await client.query(
        `INSERT INTO engagement_inbox_items
           (workspace_id, connected_account_id, platform, external_id,
            author_handle, content, status, post_id, received_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
        [
          workspaceId,
          c.accountId,
          c.platform,
          `${ENGAGE_PREFIX}${stamp}-${c.key}`,
          seed.comments[c.key].handle,
          seed.comments[c.key].content,
          c.status,
          c.postId,
          new Date(now - c.ageMs),
        ],
      );
    };
    // Urutan waktu P1 sengaja membedakan tiga urutan: Terbaru = c3, c1, c2;
    // Belum dibalas dulu = c1, c2, c3; Terlama = c2, c1, c3.
    await insertComment({
      key: "c1",
      accountId: igId,
      platform: "instagram",
      postId: p1,
      status: "unread",
      ageMs: 3 * HOUR,
    });
    await insertComment({
      key: "c2",
      accountId: igId,
      platform: "instagram",
      postId: p1,
      status: "unread",
      ageMs: 2 * DAY,
    });
    await insertComment({
      key: "c3",
      accountId: igId,
      platform: "instagram",
      postId: p1,
      status: "replied",
      ageMs: 30 * MIN,
    });
    await insertComment({
      key: "c4",
      accountId: igId,
      platform: "instagram",
      postId: p2,
      status: "unread",
      ageMs: 20 * DAY,
    });
    await insertComment({
      key: "c5",
      accountId: fbId,
      platform: "facebook",
      postId: p3,
      status: "unread",
      ageMs: 5 * HOUR,
    });
    await insertComment({
      key: "c6",
      accountId: igId,
      platform: "instagram",
      postId: null,
      status: "unread",
      ageMs: 1 * DAY,
    });
  });

  return seed;
}

/**
 * Hapus semua data semai Engage. Dengan `stamp`: hanya milik run itu. Tanpa
 * `stamp`: sisa berawalan `ENGAGE_PREFIX` yang lebih tua dari `STALE_AFTER`
 * (run lain di DB bersama tidak kehilangan fixture yang sedang dipakai).
 * Mengembalikan jumlah baris yang dihapus.
 */
export async function cleanupEngageFixtures(
  options: { stamp?: string } = {},
): Promise<{ comments: number; posts: number; accounts: number }> {
  const { stamp } = options;
  const tail = stamp ? `${stamp}%` : "%";
  const stale = (col: string) =>
    stamp ? "" : ` AND ${col} < now() - interval '${STALE_AFTER}'`;
  return withTx(async (client, { workspaceId }) => {
    const comments = await client.query(
      `DELETE FROM engagement_inbox_items
        WHERE workspace_id = $1 AND external_id LIKE $2${stale("created_at")}`,
      [workspaceId, `${ENGAGE_PREFIX}${tail}`],
    );
    const posts = await client.query<{ id: string }>(
      `SELECT id FROM publishing_posts
        WHERE workspace_id = $1 AND caption LIKE $2${stale("created_at")}`,
      [workspaceId, `${ENGAGE_PREFIX}${tail}`],
    );
    const ids = posts.rows.map((r) => r.id);
    if (ids.length > 0) {
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
      `DELETE FROM workspace_connected_accounts
        WHERE workspace_id = $1 AND handle LIKE $2${stale("created_at")}`,
      [workspaceId, `${ENGAGE_PREFIX}%-${tail}`],
    );
    return {
      comments: comments.rowCount ?? 0,
      posts: ids.length,
      accounts: accounts.rowCount ?? 0,
    };
  });
}
