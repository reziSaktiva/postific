import {
  asConnectedAccountId,
  asWorkspaceId,
  SocialPlatform,
} from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import type { ImportedPostTargetInput } from "@/domains/publishing/repositories/publishing.repository";
import {
  UPSERT_IMPORTED_POSTS_CHUNK_SIZE,
  upsertImportedPostsInChunks,
  upsertImportedPostsTx,
} from "./upsert-imported-posts";

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

describe("upsertImportedPostsInChunks (T-139, KI-099)", () => {
  function posts(count: number, offset = 0): ImportedPostTargetInput[] {
    return Array.from({ length: count }, (_, index) =>
      post({
        platformPostId: `platform-post-${offset + index}`,
        outstandPostId: `outstand-post-${offset + index}`,
      }),
    );
  }

  it("tidak memanggil runChunk untuk batch kosong", async () => {
    const runChunk = vi.fn();

    const result = await upsertImportedPostsInChunks([], runChunk);

    expect(result).toEqual({ insertedCount: 0, skippedDuplicateCount: 0 });
    expect(runChunk).not.toHaveBeenCalled();
  });

  it("memecah batch sesuai chunkSize secara berurutan dan menjumlahkan hasilnya", async () => {
    const sizes: number[] = [];
    const runChunk = async (chunk: ImportedPostTargetInput[]) => {
      sizes.push(chunk.length);
      return { insertedCount: chunk.length - 1, skippedDuplicateCount: 1 };
    };

    const result = await upsertImportedPostsInChunks(posts(120), runChunk, 50);

    expect(sizes).toEqual([50, 50, 20]);
    expect(result).toEqual({ insertedCount: 117, skippedDuplicateCount: 3 });
  });

  it("memakai UPSERT_IMPORTED_POSTS_CHUNK_SIZE sebagai default", async () => {
    const sizes: number[] = [];
    await upsertImportedPostsInChunks(
      posts(UPSERT_IMPORTED_POSTS_CHUNK_SIZE * 2 + 1),
      async (chunk) => {
        sizes.push(chunk.length);
        return { insertedCount: chunk.length, skippedDuplicateCount: 0 };
      },
    );

    expect(sizes).toEqual([
      UPSERT_IMPORTED_POSTS_CHUNK_SIZE,
      UPSERT_IMPORTED_POSTS_CHUNK_SIZE,
      1,
    ]);
  });

  it("menghentikan chunk berikutnya dan melempar error kalau satu chunk gagal", async () => {
    const runChunk = vi
      .fn()
      .mockResolvedValueOnce({ insertedCount: 50, skippedDuplicateCount: 0 })
      .mockRejectedValueOnce(new Error("boom"));

    await expect(
      upsertImportedPostsInChunks(posts(150), runChunk, 50),
    ).rejects.toThrow("boom");
    expect(runChunk).toHaveBeenCalledTimes(2);
  });
});

/**
 * DB simulasi PERSISTEN lintas transaksi (berbeda dari `createStore` di atas
 * yang seed-nya statis): tiap "transaksi" menulis ke buffer yang baru
 * di-commit kalau callback selesai tanpa error, di-buang kalau melempar —
 * meniru semantik rollback per transaksi supaya bisa menguji chunking
 * (T-139). `queryCount` per transaksi dipakai sebagai proksi durasi
 * (timeout 5000 ms Prisma bergantung pada jumlah round-trip).
 */
function createPersistentChunkDb(
  options: { failOnCreateNumber?: number } = {},
) {
  const posts: {
    id: string;
    outstandPostId: string | null;
    targets: { connectedAccountId: string; platformPostId: string }[];
  }[] = [];
  // Target yang ditempelkan ke post yang SUDAH ada (cross-post guard) —
  // di-commit/di-buang bersama transaksinya, sama seperti `posts`.
  const attachedTargets: {
    postId: string;
    connectedAccountId: string;
    platformPostId: string;
  }[] = [];
  const queryCounts: number[] = [];
  let createCalls = 0;

  async function runInTransaction(
    chunk: ImportedPostTargetInput[],
  ): Promise<{ insertedCount: number; skippedDuplicateCount: number }> {
    const buffered: typeof posts = [];
    const bufferedAttached: typeof attachedTargets = [];
    let queries = 0;
    const visible = () => [...posts, ...buffered];

    const tx = {
      $executeRaw: async () => {
        queries++;
        return 1;
      },
      $queryRaw: async () => {
        queries++;
        return [];
      },
      publishingPostTarget: {
        findMany: async (args: {
          where: {
            platformPostId?: { in: string[] };
            postId?: { in: string[] };
            connectedAccountId: { in: string[] };
          };
        }) => {
          queries++;
          const accountIds = new Set(args.where.connectedAccountId.in);
          if (args.where.platformPostId) {
            const platformIds = new Set(args.where.platformPostId.in);
            return visible().flatMap((row) =>
              row.targets
                .filter(
                  (target) =>
                    accountIds.has(target.connectedAccountId) &&
                    platformIds.has(target.platformPostId),
                )
                .map((target) => ({
                  id: `target-${row.id}`,
                  postId: row.id,
                  connectedAccountId: target.connectedAccountId,
                  platformPostId: target.platformPostId,
                  post: { outstandPostId: row.outstandPostId },
                })),
            );
          }
          const postIds = new Set(args.where.postId?.in ?? []);
          return visible()
            .filter((row) => postIds.has(row.id))
            .flatMap((row) =>
              row.targets
                .filter((target) => accountIds.has(target.connectedAccountId))
                .map((target) => ({
                  id: `target-${row.id}`,
                  postId: row.id,
                  connectedAccountId: target.connectedAccountId,
                  platformPostId: target.platformPostId,
                })),
            );
        },
        updateMany: async () => {
          queries++;
          return { count: 0 };
        },
        create: async (args: {
          data: {
            postId: string;
            connectedAccountId: string;
            platformPostId: string;
          };
        }) => {
          queries++;
          bufferedAttached.push(args.data);
          return { id: `target-attached-${bufferedAttached.length}` };
        },
      },
      publishingPost: {
        findMany: async (args: {
          where: { outstandPostId: { in: string[] } };
        }) => {
          queries++;
          const wanted = new Set(args.where.outstandPostId.in);
          return visible()
            .filter(
              (row) =>
                row.outstandPostId !== null && wanted.has(row.outstandPostId),
            )
            .map((row) => ({ ...row, workspaceId: WORKSPACE_ID }));
        },
        create: async (args: {
          data: {
            outstandPostId: string | null;
            targets: {
              create: { connectedAccountId: string; platformPostId: string }[];
            };
          };
        }) => {
          queries++;
          createCalls++;
          if (createCalls === options.failOnCreateNumber) {
            throw new Error("Transaction API error: expired transaction");
          }
          const row = {
            id: `post-${posts.length + buffered.length + 1}`,
            outstandPostId: args.data.outstandPostId,
            targets: args.data.targets.create,
          };
          buffered.push(row);
          return { id: row.id };
        },
        updateMany: async () => {
          queries++;
          return { count: 0 };
        },
      },
    };

    try {
      const result = await upsertImportedPostsTx(
        tx as never,
        WORKSPACE_ID,
        chunk,
      );
      posts.push(...buffered);
      attachedTargets.push(...bufferedAttached);
      return result;
    } finally {
      queryCounts.push(queries);
    }
  }

  return { posts, attachedTargets, queryCounts, runInTransaction };
}

describe("upsertImportedPostsInChunks + upsertImportedPostsTx — batch besar (T-139, KI-099)", () => {
  function bigBatch(count: number): ImportedPostTargetInput[] {
    return Array.from({ length: count }, (_, index) =>
      post({
        platformPostId: `platform-post-${index}`,
        outstandPostId: `outstand-post-${index}`,
      }),
    );
  }

  it("batch 230 post tersimpan seluruhnya lewat 5 transaksi, tiap transaksi dibatasi ukurannya", async () => {
    const db = createPersistentChunkDb();

    const result = await upsertImportedPostsInChunks(
      bigBatch(230),
      db.runInTransaction,
    );

    expect(result).toEqual({ insertedCount: 230, skippedDuplicateCount: 0 });
    expect(db.posts).toHaveLength(230);
    expect(db.queryCounts).toHaveLength(5);
    // Satu transaksi untuk 230 post butuh >230 round-trip; dengan chunk 50
    // tiap transaksi cukup ~50 insert + sedikit lock/lookup, tidak tumbuh
    // mengikuti ukuran batch — inilah yang menahan durasi di bawah timeout.
    for (const queries of db.queryCounts) {
      expect(queries).toBeLessThanOrEqual(
        UPSERT_IMPORTED_POSTS_CHUNK_SIZE + 10,
      );
    }
  });

  it("import ulang batch yang sama idempoten: semua dihitung duplikat, tidak ada post baru", async () => {
    const db = createPersistentChunkDb();
    await upsertImportedPostsInChunks(bigBatch(120), db.runInTransaction);

    const result = await upsertImportedPostsInChunks(
      bigBatch(120),
      db.runInTransaction,
    );

    expect(result).toEqual({ insertedCount: 0, skippedDuplicateCount: 120 });
    expect(db.posts).toHaveLength(120);
  });

  it("post yang sama muncul di dua chunk berbeda hanya disimpan sekali (dedup lintas chunk)", async () => {
    const db = createPersistentChunkDb();
    const batch = bigBatch(60);
    // Post indeks 55 (chunk ke-2) menduplikasi indeks 5 (chunk ke-1).
    batch[55] = batch[5] as ImportedPostTargetInput;

    const result = await upsertImportedPostsInChunks(
      batch,
      db.runInTransaction,
    );

    expect(result).toEqual({ insertedCount: 59, skippedDuplicateCount: 1 });
    expect(db.posts).toHaveLength(59);
  });

  it("outstandPostId yang sama dengan platformPostId berbeda di dua chunk: post tidak digandakan, akun kedua dapat target di post yang sudah commit", async () => {
    const db = createPersistentChunkDb();
    const batch = bigBatch(60);
    // Indeks 55 (chunk ke-2) = post yang SAMA di Outstand (outstandPostId
    // indeks 5, chunk ke-1) tapi milik akun lain dengan platformPostId lain.
    batch[55] = post({
      connectedAccountId: asConnectedAccountId("account-2"),
      platformPostId: "platform-post-account-2",
      outstandPostId: "outstand-post-5",
    });

    const result = await upsertImportedPostsInChunks(
      batch,
      db.runInTransaction,
    );

    expect(result).toEqual({ insertedCount: 60, skippedDuplicateCount: 0 });
    // 59 post (indeks 55 tidak membuat post baru) + 1 target tambahan.
    expect(db.posts).toHaveLength(59);
    expect(db.attachedTargets).toHaveLength(1);
    expect(db.attachedTargets[0]).toMatchObject({
      postId: db.posts.find((row) => row.outstandPostId === "outstand-post-5")
        ?.id,
      connectedAccountId: asConnectedAccountId("account-2"),
      platformPostId: "platform-post-account-2",
    });
  });

  it("chunk gagal: chunk sebelumnya tetap commit, chunk gagal rollback, retry hanya menyelesaikan sisanya", async () => {
    // 130 post → chunk 50/50/30. `post.create` ke-101 = post pertama chunk 3.
    const db = createPersistentChunkDb({ failOnCreateNumber: 101 });
    const batch = bigBatch(130);

    await expect(
      upsertImportedPostsInChunks(batch, db.runInTransaction),
    ).rejects.toThrow("expired transaction");
    expect(db.posts).toHaveLength(100);

    const retry = await upsertImportedPostsInChunks(batch, db.runInTransaction);

    expect(retry).toEqual({ insertedCount: 30, skippedDuplicateCount: 100 });
    expect(db.posts).toHaveLength(130);
  });
});
