import { Client } from "pg";

import { E2E_WORKSPACE_NAME } from "./workspace";

/**
 * Semai data khusus workspace "E2E Sandbox" untuk QA status post dan akun
 * (T-207.4): post `Published`, `Failed`, `Imported` (status ini tidak bisa
 * dibuat lewat UI tanpa benar-benar memublikasikan), akun `Disconnected`, dan
 * draft Pinterest dengan board, judul, dan link tersimpan.
 *
 * Aturan keras:
 * - Tidak pernah memublikasikan atau menjadwalkan; baris `published`/`failed`
 *   ditulis langsung ke DB dan tidak punya `outstand_post_id`. Tidak ada
 *   panggilan ke Outstand.
 * - Hanya menyentuh workspace bernama `E2E_WORKSPACE_NAME` (harus tepat satu)
 *   dan hanya baris berawalan `SEED_CAPTION_PREFIX` / `SEED_HANDLE_PREFIX`.
 * - Memakai `DATABASE_URL` (role runtime, RLS aktif): `app.current_user_id`
 *   diset ke akun test yang menjadi member aktif workspace itu. `DIRECT_URL`
 *   tidak dipakai.
 * - Galat driver tidak diteruskan mentah (bisa memuat host); hanya kode.
 */
export const SEED_CAPTION_PREFIX = "e2e-qa-seed-";
export const SEED_HANDLE_PREFIX = "e2e-seed-";

export function seedDbSkipReason(): string | null {
  if (!process.env.DATABASE_URL) return "DATABASE_URL tidak tersedia";
  if (!process.env.E2E_USER_EMAIL) return "E2E_USER_EMAIL tidak tersedia";
  return null;
}

export interface SeedIds {
  workspaceId: string;
  actorId: string;
  stamp: string;
  publishedPostId: string;
  failedPostId: string;
  importedPostId: string;
  pinterestDraftId: string;
  disconnectedDraftId: string;
  pinterestAccountId: string;
  disconnectedAccountId: string;
  /** `true` bila akun Pinterest memakai id Outstand nyata (papan sungguhan). */
  pinterestIsReal: boolean;
  captions: {
    published: string;
    failed: string;
    imported: string;
    pinterestDraft: string;
    disconnectedDraft: string;
  };
  pinterest: { title: string; link: string; boardId: string };
}

export interface SeedOptions {
  /**
   * Id akun Pinterest di Outstand (hanya dibaca untuk daftar board; tidak
   * pernah dipakai menulis). Kosong: id palsu, daftar board gagal dimuat.
   */
  pinterestOutstandId?: string;
  pinterestBoardId?: string;
}

function code(error: unknown): string {
  const c = (error as { code?: unknown } | null)?.code;
  return typeof c === "string"
    ? c
    : error instanceof Error
      ? error.name
      : "tidak diketahui";
}

async function withTx<T>(
  fn: (
    client: Client,
    ctx: { workspaceId: string; actorId: string },
  ) => Promise<T>,
): Promise<T> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 20_000,
    query_timeout: 30_000,
  });
  client.on("error", () => undefined);
  try {
    await client.connect();
    await client.query("BEGIN");
    const user = await client.query<{ id: string }>(
      "SELECT id FROM identity_user WHERE email = $1",
      [process.env.E2E_USER_EMAIL],
    );
    if (user.rowCount !== 1) throw new Error("akun test tidak ditemukan");
    const actorId = user.rows[0].id;
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [
      actorId,
    ]);
    const ws = await client.query<{ id: string }>(
      "SELECT id FROM workspaces WHERE name = $1",
      [E2E_WORKSPACE_NAME],
    );
    if (ws.rowCount !== 1) {
      throw new Error(`workspace ${E2E_WORKSPACE_NAME} tidak tepat satu`);
    }
    const workspaceId = ws.rows[0].id;
    const member = await client.query(
      "SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'",
      [workspaceId, actorId],
    );
    if (member.rowCount !== 1) throw new Error("akun test bukan member aktif");
    const result = await fn(client, { workspaceId, actorId });
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof Error && !("code" in error)) throw error;
    throw new Error(`seed DB gagal (kode ${code(error)})`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

const DAY = 86_400_000;

export async function seedPostStatusFixtures(
  options: SeedOptions = {},
): Promise<SeedIds> {
  const stamp = Date.now().toString(36);
  const captions = {
    published: `${SEED_CAPTION_PREFIX}${stamp} published`,
    failed: `${SEED_CAPTION_PREFIX}${stamp} failed`,
    imported: `${SEED_CAPTION_PREFIX}${stamp} imported`,
    pinterestDraft: `${SEED_CAPTION_PREFIX}${stamp} pinterest`,
    disconnectedDraft: `${SEED_CAPTION_PREFIX}${stamp} disconnected`,
  };
  const pinterest = {
    title: `Judul Pin ${stamp}`,
    link: "https://example.com/e2e-seed",
    boardId: options.pinterestBoardId ?? "e2e-seed-board",
  };
  const pinterestIsReal = Boolean(options.pinterestOutstandId);

  return withTx(async (client, { workspaceId, actorId }) => {
    const insertAccount = async (
      platform: string,
      handle: string,
      outstandId: string,
      status: string,
    ) =>
      (
        await client.query<{ id: string }>(
          `INSERT INTO workspace_connected_accounts
             (workspace_id, platform, outstand_account_id, handle, status, updated_at)
           VALUES ($1, $2, $3, $4, $5, now()) RETURNING id`,
          [workspaceId, platform, outstandId, handle, status],
        )
      ).rows[0].id;

    const ig = await client.query<{ id: string }>(
      "SELECT id FROM workspace_connected_accounts WHERE workspace_id = $1 AND platform = 'instagram' AND status = 'active' ORDER BY created_at LIMIT 1",
      [workspaceId],
    );
    if (ig.rowCount !== 1) throw new Error("tidak ada akun Instagram aktif");
    const instagramId = ig.rows[0].id;

    const disconnectedAccountId = await insertAccount(
      "facebook",
      `${SEED_HANDLE_PREFIX}fb-${stamp}`,
      `${SEED_HANDLE_PREFIX}fb-${stamp}`,
      "disconnected",
    );
    const pinterestAccountId = await insertAccount(
      "pinterest",
      `${SEED_HANDLE_PREFIX}pin-${stamp}`,
      options.pinterestOutstandId ?? `${SEED_HANDLE_PREFIX}pin-${stamp}`,
      "active",
    );

    const now = Date.now();
    const insertPost = async (p: {
      status: string;
      caption: string;
      scheduledAt?: Date;
      publishedAt?: Date;
      failedAt?: Date;
      failureReason?: string;
      accountId: string;
      platform: string;
      format: string;
      targetStatus: string;
      targetError?: string;
      platformPostUrl?: string;
      platformOptions?: Record<string, unknown>;
    }) => {
      const post = await client.query<{ id: string }>(
        `INSERT INTO publishing_posts
           (workspace_id, author_id, status, caption, scheduled_at, published_at,
            failed_at, failure_reason, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now()) RETURNING id`,
        [
          workspaceId,
          actorId,
          p.status,
          p.caption,
          p.scheduledAt ?? null,
          p.publishedAt ?? null,
          p.failedAt ?? null,
          p.failureReason ?? null,
        ],
      );
      await client.query(
        `INSERT INTO publishing_post_targets
           (post_id, connected_account_id, platform, status, error, content_format,
            platform_options, platform_post_url, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
        [
          post.rows[0].id,
          p.accountId,
          p.platform,
          p.targetStatus,
          p.targetError ?? null,
          p.format,
          p.platformOptions ? JSON.stringify(p.platformOptions) : null,
          p.platformPostUrl ?? null,
        ],
      );
      return post.rows[0].id;
    };

    // Tetap di bulan berjalan (zona WIB) supaya entri selalu tampil di
    // Calendar bulan ini, bahkan pada tanggal 1 sampai 3.
    const nowDate = new Date(now);
    const monthStart = Date.UTC(
      nowDate.getUTCFullYear(),
      nowDate.getUTCMonth(),
      1,
      8,
    );
    const daysAgo = (days: number) =>
      new Date(Math.min(now, Math.max(now - days * DAY, monthStart)));
    const publishedAt = daysAgo(1);
    const failedAt = daysAgo(2);
    const importedAt = daysAgo(3);
    const publishedPostId = await insertPost({
      status: "published",
      caption: captions.published,
      scheduledAt: publishedAt,
      publishedAt,
      accountId: instagramId,
      platform: "instagram",
      format: "post",
      targetStatus: "published",
      platformPostUrl: "https://www.instagram.com/p/e2e-seed/",
    });
    const failedPostId = await insertPost({
      status: "failed",
      caption: captions.failed,
      scheduledAt: failedAt,
      failedAt,
      failureReason:
        "Seed QA: kegagalan disemai langsung di DB (bukan publish).",
      accountId: instagramId,
      platform: "instagram",
      format: "post",
      targetStatus: "failed",
      targetError: "Seed QA: kegagalan disemai langsung di DB.",
    });
    const importedPostId = await insertPost({
      status: "imported",
      caption: captions.imported,
      publishedAt: importedAt,
      accountId: instagramId,
      platform: "instagram",
      format: "post",
      targetStatus: "published",
      platformPostUrl: "https://www.instagram.com/p/e2e-seed-imported/",
    });
    const pinterestDraftId = await insertPost({
      status: "draft",
      caption: captions.pinterestDraft,
      accountId: pinterestAccountId,
      platform: "pinterest",
      format: "pin",
      targetStatus: "pending",
      platformOptions: {
        boardId: pinterest.boardId,
        pinTitle: pinterest.title,
        pinLink: pinterest.link,
      },
    });

    const disconnectedDraftId = await insertPost({
      status: "draft",
      caption: captions.disconnectedDraft,
      accountId: disconnectedAccountId,
      platform: "facebook",
      format: "post",
      targetStatus: "pending",
    });

    return {
      workspaceId,
      actorId,
      stamp,
      publishedPostId,
      failedPostId,
      importedPostId,
      pinterestDraftId,
      disconnectedDraftId,
      pinterestAccountId,
      disconnectedAccountId,
      pinterestIsReal,
      captions,
      pinterest,
    };
  });
}

/**
 * Hapus data semai. Dengan `stamp`: hanya milik run itu (akhir run). Tanpa
 * `stamp`: hanya sisa yang lebih tua dari `STALE_AFTER`, supaya run lain di DB
 * bersama tidak kehilangan fixture yang sedang dipakai. Mengembalikan jumlah
 * baris yang dihapus.
 */
const STALE_AFTER = "2 hours";

export async function cleanupSeedFixtures(
  options: { stamp?: string } = {},
): Promise<{
  posts: number;
  accounts: number;
}> {
  const { stamp } = options;
  const postPattern = `${SEED_CAPTION_PREFIX}${stamp ?? ""}%`;
  const accountPattern = stamp
    ? `${SEED_HANDLE_PREFIX}%-${stamp}`
    : `${SEED_HANDLE_PREFIX}%`;
  const staleOnly = stamp
    ? ""
    : ` AND created_at < now() - interval '${STALE_AFTER}'`;
  return withTx(async (client, { workspaceId }) => {
    const posts = await client.query(
      `SELECT id FROM publishing_posts WHERE workspace_id = $1 AND caption LIKE $2${staleOnly}`,
      [workspaceId, postPattern],
    );
    const ids = posts.rows.map((r: { id: string }) => r.id);
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
      `DELETE FROM workspace_connected_accounts WHERE workspace_id = $1 AND handle LIKE $2${staleOnly}`,
      [workspaceId, accountPattern],
    );
    return { posts: ids.length, accounts: accounts.rowCount ?? 0 };
  });
}
