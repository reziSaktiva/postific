import {
  asConnectedAccountId,
  asWorkspaceId,
  SocialPlatform,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import type { ImportedPostTargetInput } from "@/domains/publishing/repositories/publishing.repository";
import { upsertImportedPostsTx } from "./upsert-imported-posts";

const WORKSPACE_ID = asWorkspaceId("workspace-1");

function post(
  overrides: Partial<ImportedPostTargetInput> = {},
): ImportedPostTargetInput {
  return {
    connectedAccountId: asConnectedAccountId("account-1"),
    platform: SocialPlatform.Instagram,
    platformPostId: "platform-post-1",
    platformPostUrl: "https://instagram.com/p/xyz",
    outstandPostId: "outstand-post-1",
    caption: "Halo dunia",
    publishedAt: new Date("2026-09-01T00:00:00Z"),
    mediaUrls: [],
    ...overrides,
  };
}

/**
 * Fake `tx` — hanya mengimplementasikan method Prisma yang dipakai
 * `upsertImportedPostsTx`, pola sama `createStore` di
 * `replace-draft-targets.test.ts`. `publishingPost` di-seed dengan baris
 * yang "sudah ada" (simulasi hasil Import akun lain sebelumnya). `calls`
 * merekam urutan pemanggilan method (termasuk lock) supaya bisa
 * diverifikasi lock diambil SEBELUM SELECT/INSERT mana pun. Lock
 * per-`outstandPostId` dibatch lewat `$queryRaw` (`unnest`), sama seperti
 * fake di `backfill-outstand-post-ids.test.ts`.
 */
type SeededTarget = {
  id: string;
  postId: string;
  connectedAccountId: string;
  platformPostId: string | null;
  postOutstandPostId: string | null;
};

type GlobalOwnerRow = {
  outstandPostId: string;
  postId: string;
  workspaceId: string;
  connectedAccountId: string;
};

function createStore(
  seededPosts: { id: string; outstandPostId: string | null }[] = [],
  options: {
    seededTargets?: SeededTarget[];
    globalRows?: GlobalOwnerRow[];
  } = {},
) {
  const seededTargets = options.seededTargets ?? [];
  const calls: string[] = [];
  const createdPosts: {
    id: string;
    workspaceId: string;
    outstandPostId: string | null;
  }[] = [];
  const createdTargets: {
    postId: string;
    connectedAccountId: string;
    platformPostId: string;
  }[] = [];
  const updatedPosts: { id: string; outstandPostId: string }[] = [];
  const updatedTargets: {
    id: string;
    platformPostId: string;
    platformPostUrl: string | null;
  }[] = [];
  let nextPostId = 1;

  const tx = {
    $executeRaw: async (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => {
      const sql = strings.join("?");
      if (sql.includes("publishing.outstand_post_id")) {
        const ids = values[0] as string[];
        for (const id of ids) calls.push(`post-lock:${id}`);
        return 1;
      }
      calls.push(`lock:${String(values[0])}`);
      return 1;
    },
    $queryRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const ids = values[0] as string[];
      const rows: {
        outstand_post_id: string;
        post_id: string;
        workspace_id: string;
        connected_account_id: string;
      }[] = [];
      for (const outstandPostId of ids) {
        calls.push(`global:${outstandPostId}`);
        for (const row of (options.globalRows ?? []).filter(
          (candidate) => candidate.outstandPostId === outstandPostId,
        )) {
          rows.push({
            outstand_post_id: outstandPostId,
            post_id: row.postId,
            workspace_id: row.workspaceId,
            connected_account_id: row.connectedAccountId,
          });
        }
      }
      return rows;
    },
    publishingPostTarget: {
      findMany: async (args: {
        where: {
          connectedAccountId?: { in: string[] };
          platformPostId?: { in: string[] };
          postId?: { in: string[] };
        };
      }) => {
        calls.push("target.findMany");
        const accountIds = new Set(args.where.connectedAccountId?.in ?? []);
        if (args.where.platformPostId) {
          const platformIds = new Set(args.where.platformPostId.in);
          return seededTargets
            .filter(
              (row) =>
                row.platformPostId !== null &&
                accountIds.has(row.connectedAccountId) &&
                platformIds.has(row.platformPostId),
            )
            .map((row) => ({
              id: row.id,
              postId: row.postId,
              connectedAccountId: row.connectedAccountId,
              platformPostId: row.platformPostId,
              post: { outstandPostId: row.postOutstandPostId },
            }));
        }
        const postIds = new Set(args.where.postId?.in ?? []);
        return seededTargets
          .filter(
            (row) =>
              postIds.has(row.postId) && accountIds.has(row.connectedAccountId),
          )
          .map((row) => ({
            id: row.id,
            postId: row.postId,
            connectedAccountId: row.connectedAccountId,
            platformPostId: row.platformPostId,
          }));
      },
      updateMany: async (args: {
        where: { id: string };
        data: { platformPostId: string; platformPostUrl: string | null };
      }) => {
        calls.push("target.updateMany");
        updatedTargets.push({
          id: args.where.id,
          platformPostId: args.data.platformPostId,
          platformPostUrl: args.data.platformPostUrl,
        });
        return { count: 1 };
      },
      create: async (args: {
        data: {
          postId: string;
          connectedAccountId: string;
          platformPostId: string;
        };
      }) => {
        calls.push("target.create");
        createdTargets.push({
          postId: args.data.postId,
          connectedAccountId: args.data.connectedAccountId,
          platformPostId: args.data.platformPostId,
        });
        return { id: `target-${createdTargets.length}` };
      },
    },
    publishingPost: {
      findMany: async (args: {
        where: { outstandPostId: { in: string[] } };
      }) => {
        calls.push("post.findMany");
        const wanted = new Set(args.where.outstandPostId.in);
        return seededPosts
          .filter(
            (row) =>
              row.outstandPostId !== null && wanted.has(row.outstandPostId),
          )
          .map((row) => ({
            id: row.id,
            outstandPostId: row.outstandPostId,
            workspaceId: WORKSPACE_ID,
          }));
      },
      create: async (args: {
        data: {
          workspaceId: string;
          outstandPostId: string | null;
          targets: {
            create: { connectedAccountId: string; platformPostId: string }[];
          };
        };
      }) => {
        calls.push("post.create");
        const id = `post-${nextPostId++}`;
        createdPosts.push({
          id,
          workspaceId: args.data.workspaceId,
          outstandPostId: args.data.outstandPostId,
        });
        for (const target of args.data.targets.create) {
          createdTargets.push({
            postId: id,
            connectedAccountId: target.connectedAccountId,
            platformPostId: target.platformPostId,
          });
        }
        return { id };
      },
      updateMany: async (args: {
        where: { id: string };
        data: { outstandPostId: string };
      }) => {
        calls.push("post.updateMany");
        updatedPosts.push({
          id: args.where.id,
          outstandPostId: args.data.outstandPostId,
        });
        return { count: 1 };
      },
    },
  };

  return {
    tx,
    calls,
    createdPosts,
    createdTargets,
    updatedPosts,
    updatedTargets,
  };
}

/**
 * Mutex keyed sederhana (promise-chain) untuk mensimulasikan apa yang
 * `pg_advisory_xact_lock` lakukan di Postgres sungguhan: menyerialkan
 * pemanggil dengan key yang sama, dilepas saat "transaksi" (di sini:
 * fungsi `runImport` pembungkus) selesai. **Ini BUKAN pengganti
 * verifikasi terhadap Postgres sungguhan** (locking level DB sungguhan
 * tidak bisa diuji penuh tanpa koneksi nyata — keterbatasan yang sama
 * dengan T-113.3) — tujuannya murni membuktikan logika guard cross-post
 * BENAR *kalau* lock-nya menyerialkan seperti yang akan dilakukan
 * Postgres, dan untuk membuktikan secara kontras bahwa TANPA lock dua
 * invocation konkuren bisa sama-sama lolos SELECT.
 */
function createKeyedLock() {
  const queues = new Map<string, Promise<void>>();
  return {
    async acquire(key: string): Promise<() => void> {
      const previous = queues.get(key) ?? Promise.resolve();
      let release!: () => void;
      const current = new Promise<void>((resolve) => {
        release = resolve;
      });
      queues.set(
        key,
        previous.then(() => current),
      );
      await previous;
      return release;
    },
  };
}

/** Shared in-memory "DB" dipakai 2 invocation `upsertImportedPostsTx` sekaligus, untuk simulasi race T-113 follow-up ronde 2. */
function createSharedSimulatedDb() {
  const posts: {
    id: string;
    workspaceId: string;
    outstandPostId: string | null;
  }[] = [];
  const targets: {
    postId: string;
    connectedAccountId: string;
    platformPostId: string;
  }[] = [];
  let nextId = 1;
  const lock = createKeyedLock();

  function buildTx(workspaceId: string, honorLock: boolean) {
    let release: (() => void) | null = null;
    const tx = {
      $executeRaw: async () => {
        // Hanya panggilan pertama (lock workspace). Lock per
        // `outstandPostId` yang menyusul tidak boleh mengantri di mutex
        // yang sama — pemanggil ini masih memegang release-nya.
        if (honorLock && release === null) {
          release = await lock.acquire(workspaceId);
        }
        return 1;
      },
      $queryRaw: async () => [],
      publishingPostTarget: {
        findMany: async () => [],
        updateMany: async () => ({ count: 0 }),
        create: async (args: {
          data: {
            postId: string;
            connectedAccountId: string;
            platformPostId: string;
          };
        }) => {
          targets.push({
            postId: args.data.postId,
            connectedAccountId: args.data.connectedAccountId,
            platformPostId: args.data.platformPostId,
          });
          return { id: `target-${targets.length}` };
        },
      },
      publishingPost: {
        findMany: async (args: {
          where: { outstandPostId: { in: string[] } };
        }) => {
          const wanted = new Set(args.where.outstandPostId.in);
          return posts.filter(
            (row) =>
              row.outstandPostId !== null && wanted.has(row.outstandPostId),
          );
        },
        create: async (args: {
          data: {
            workspaceId: string;
            outstandPostId: string | null;
            targets: {
              create: {
                connectedAccountId: string;
                platformPostId: string;
              }[];
            };
          };
        }) => {
          const id = `post-${nextId++}`;
          posts.push({
            id,
            workspaceId: args.data.workspaceId,
            outstandPostId: args.data.outstandPostId,
          });
          for (const target of args.data.targets.create) {
            targets.push({
              postId: id,
              connectedAccountId: target.connectedAccountId,
              platformPostId: target.platformPostId,
            });
          }
          return { id };
        },
        updateMany: async () => ({ count: 0 }),
      },
    };

    return { tx, release: () => release?.() };
  }

  return { posts, targets, buildTx };
}

describe("upsertImportedPostsTx (T-090.4, cross-post guard T-113 follow-up)", () => {
  it("creates a new PublishingPost + target when outstandPostId has no existing post", async () => {
    const { tx, createdPosts, createdTargets } = createStore([]);

    const result = await upsertImportedPostsTx(tx as never, WORKSPACE_ID, [
      post(),
    ]);

    expect(result).toEqual({ insertedCount: 1, skippedDuplicateCount: 0 });
    expect(createdPosts).toHaveLength(1);
    expect(createdPosts[0]?.outstandPostId).toBe("outstand-post-1");
    expect(createdTargets).toHaveLength(1);
  });

  it("acquires a workspace-scoped pg_advisory_xact_lock as the FIRST statement, before any SELECT/INSERT (T-113 follow-up ronde 2, temuan Ridwan)", async () => {
    const { tx, calls } = createStore([]);

    await upsertImportedPostsTx(tx as never, WORKSPACE_ID, [post()]);

    expect(calls[0]).toBe(`lock:${WORKSPACE_ID}`);
    expect(calls.indexOf(`lock:${WORKSPACE_ID}`)).toBeLessThan(
      calls.indexOf("target.findMany"),
    );
    expect(calls.indexOf(`lock:${WORKSPACE_ID}`)).toBeLessThan(
      calls.indexOf("post.findMany"),
    );
  });

  it("cross-post guard (Ridwan finding): a second connected account importing the SAME outstandPostId attaches a new target to the EXISTING post instead of crashing on the unique index", async () => {
    const { tx, createdPosts, createdTargets } = createStore([
      { id: "post-existing", outstandPostId: "outstand-shared" },
    ]);

    const result = await upsertImportedPostsTx(tx as never, WORKSPACE_ID, [
      post({
        connectedAccountId: asConnectedAccountId("account-2"),
        platformPostId: "platform-post-account-2",
        outstandPostId: "outstand-shared",
      }),
    ]);

    // Insert succeeded (batch NOT aborted) — but as a new TARGET on the
    // existing post, not a new PublishingPost.
    expect(result).toEqual({ insertedCount: 1, skippedDuplicateCount: 0 });
    expect(createdPosts).toHaveLength(0);
    expect(createdTargets).toEqual([
      {
        postId: "post-existing",
        connectedAccountId: asConnectedAccountId("account-2"),
        platformPostId: "platform-post-account-2",
      },
    ]);
  });

  it("cross-post guard handles two posts in the SAME batch sharing an outstandPostId (defensive — first creates the post, second attaches as a target)", async () => {
    const { tx, createdPosts, createdTargets } = createStore([]);

    const result = await upsertImportedPostsTx(tx as never, WORKSPACE_ID, [
      post({
        connectedAccountId: asConnectedAccountId("account-1"),
        platformPostId: "platform-post-1",
        outstandPostId: "outstand-both",
      }),
      post({
        connectedAccountId: asConnectedAccountId("account-2"),
        platformPostId: "platform-post-2",
        outstandPostId: "outstand-both",
      }),
    ]);

    expect(result).toEqual({ insertedCount: 2, skippedDuplicateCount: 0 });
    expect(createdPosts).toHaveLength(1);
    expect(createdTargets).toHaveLength(2);
    expect(createdTargets[1]?.postId).toBe(createdPosts[0]?.id);
  });

  it("outstandPostId: null never looks up or collides with an existing post (defensif, skip cross-post guard entirely)", async () => {
    const { tx, createdPosts, createdTargets } = createStore([
      { id: "post-existing", outstandPostId: null },
    ]);

    const result = await upsertImportedPostsTx(tx as never, WORKSPACE_ID, [
      post({ outstandPostId: null }),
    ]);

    expect(result).toEqual({ insertedCount: 1, skippedDuplicateCount: 0 });
    expect(createdPosts).toHaveLength(1);
    expect(createdPosts[0]?.outstandPostId).toBeNull();
    expect(createdTargets).toHaveLength(1);
  });

  it("race (T-113 follow-up ronde 2, temuan Ridwan): WITH the lock serializing two concurrent imports for the same workspace + outstandPostId, only ONE PublishingPost is created and the second account still gets its own target (simulated mutex — real cross-transaction serialization can only be verified against a live Postgres connection, same limitation as T-113.3)", async () => {
    const db = createSharedSimulatedDb();

    async function runImport(
      connectedAccountId: string,
      platformPostId: string,
    ) {
      const { tx, release } = db.buildTx(WORKSPACE_ID, true);
      try {
        return await upsertImportedPostsTx(tx as never, WORKSPACE_ID, [
          post({
            connectedAccountId: asConnectedAccountId(connectedAccountId),
            platformPostId,
            outstandPostId: "outstand-race",
          }),
        ]);
      } finally {
        release();
      }
    }

    const [resultA, resultB] = await Promise.all([
      runImport("account-a", "platform-post-a"),
      runImport("account-b", "platform-post-b"),
    ]);

    expect(resultA.insertedCount).toBe(1);
    expect(resultB.insertedCount).toBe(1);
    // The bug Ridwan found: WITHOUT the lock, both invocations could pass
    // their SELECT before either commits, each trying to create its own
    // PublishingPost with outstandPostId "outstand-race" — the second one
    // would hit the Postgres unique index and the whole batch would fail.
    // WITH the lock serializing them, exactly ONE PublishingPost exists.
    expect(db.posts).toHaveLength(1);
    expect(db.posts[0]?.outstandPostId).toBe("outstand-race");
    // Both accounts still end up with their own target row against that
    // single post — account B's import isn't silently dropped.
    expect(db.targets).toHaveLength(2);
    expect(
      db.targets.map((target) => target.connectedAccountId).sort(),
    ).toEqual(["account-a", "account-b"].sort());
  });

  it("WITHOUT the lock (honorLock: false), the same concurrent scenario races both invocations past the SELECT — demonstrates why the guard alone (ronde 1 fix) wasn't sufficient", async () => {
    const db = createSharedSimulatedDb();

    async function runImportWithoutLock(
      connectedAccountId: string,
      platformPostId: string,
    ) {
      const { tx, release } = db.buildTx(WORKSPACE_ID, false);
      try {
        return await upsertImportedPostsTx(tx as never, WORKSPACE_ID, [
          post({
            connectedAccountId: asConnectedAccountId(connectedAccountId),
            platformPostId,
            outstandPostId: "outstand-race-no-lock",
          }),
        ]);
      } finally {
        release();
      }
    }

    await Promise.all([
      runImportWithoutLock("account-a", "platform-post-a"),
      runImportWithoutLock("account-b", "platform-post-b"),
    ]);

    // Without the lock, this fake in-memory store (unlike real Postgres)
    // has no unique constraint to enforce, so both invocations create
    // their OWN PublishingPost for the same outstandPostId — exactly the
    // duplicate that the real unique index would reject with a raw
    // Postgres error in production. This test exists to document/pin the
    // contrast, not to assert desired behavior.
    expect(db.posts).toHaveLength(2);
  });

  it("re-import mengisi outstandPostId yang masih null pada post yang sudah ada", async () => {
    const { tx, createdPosts, updatedPosts } = createStore([], {
      seededTargets: [
        {
          id: "target-old",
          postId: "post-old",
          connectedAccountId: "account-1",
          platformPostId: "platform-post-1",
          postOutstandPostId: null,
        },
      ],
    });

    const result = await upsertImportedPostsTx(tx as never, WORKSPACE_ID, [
      post({ outstandPostId: "outstand-backfill" }),
    ]);

    expect(result).toEqual({ insertedCount: 0, skippedDuplicateCount: 1 });
    expect(createdPosts).toHaveLength(0);
    expect(updatedPosts).toEqual([
      { id: "post-old", outstandPostId: "outstand-backfill" },
    ]);
  });

  it("re-import tidak menimpa outstandPostId yang sudah terisi", async () => {
    const { tx, updatedPosts } = createStore([], {
      seededTargets: [
        {
          id: "target-old",
          postId: "post-old",
          connectedAccountId: "account-1",
          platformPostId: "platform-post-1",
          postOutstandPostId: "outstand-existing",
        },
      ],
    });

    const result = await upsertImportedPostsTx(tx as never, WORKSPACE_ID, [
      post({ outstandPostId: "outstand-other" }),
    ]);

    expect(result).toEqual({ insertedCount: 0, skippedDuplicateCount: 1 });
    expect(updatedPosts).toHaveLength(0);
  });

  it("outstandPostId milik workspace lain diimpor dengan id null, batch tetap jalan", async () => {
    const { tx, createdPosts, createdTargets } = createStore([], {
      globalRows: [
        {
          outstandPostId: "outstand-foreign",
          postId: "post-other-workspace",
          workspaceId: "workspace-other",
          connectedAccountId: "account-foreign",
        },
      ],
    });

    const result = await upsertImportedPostsTx(tx as never, WORKSPACE_ID, [
      post({ outstandPostId: "outstand-foreign" }),
    ]);

    expect(result).toEqual({ insertedCount: 1, skippedDuplicateCount: 0 });
    expect(createdPosts).toEqual([
      {
        id: "post-1",
        workspaceId: WORKSPACE_ID,
        outstandPostId: null,
      },
    ]);
    expect(createdTargets).toHaveLength(1);
  });

  it("akun yang sudah punya target pada post yang sama tidak dapat target kedua; platformPostId null diisi", async () => {
    const { tx, createdPosts, createdTargets, updatedTargets } = createStore(
      [{ id: "post-existing", outstandPostId: "outstand-shared" }],
      {
        seededTargets: [
          {
            id: "target-pending",
            postId: "post-existing",
            connectedAccountId: "account-1",
            platformPostId: null,
            postOutstandPostId: "outstand-shared",
          },
        ],
      },
    );

    const result = await upsertImportedPostsTx(tx as never, WORKSPACE_ID, [
      post({
        connectedAccountId: asConnectedAccountId("account-1"),
        platformPostId: "platform-post-filled",
        outstandPostId: "outstand-shared",
      }),
    ]);

    expect(result).toEqual({ insertedCount: 0, skippedDuplicateCount: 1 });
    expect(createdPosts).toHaveLength(0);
    expect(createdTargets).toHaveLength(0);
    expect(updatedTargets).toEqual([
      {
        id: "target-pending",
        platformPostId: "platform-post-filled",
        platformPostUrl: "https://instagram.com/p/xyz",
      },
    ]);
  });

  it("mengunci tiap outstandPostId setelah lock workspace dan sebelum lookup global", async () => {
    const { tx, calls } = createStore([]);

    await upsertImportedPostsTx(tx as never, WORKSPACE_ID, [post()]);

    const workspaceLock = calls.indexOf(`lock:${WORKSPACE_ID}`);
    const postLock = calls.indexOf("post-lock:outstand-post-1");
    const globalLookup = calls.indexOf("global:outstand-post-1");
    expect(workspaceLock).toBe(0);
    expect(postLock).toBeGreaterThan(workspaceLock);
    expect(globalLookup).toBeGreaterThan(postLock);
  });
});
