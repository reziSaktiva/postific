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
 * merekam urutan pemanggilan method (termasuk `$executeRaw` lock) supaya
 * bisa diverifikasi lock diambil SEBELUM SELECT/INSERT mana pun.
 */
function createStore(
  seededPosts: { id: string; outstandPostId: string | null }[] = [],
) {
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
  let nextPostId = 1;

  const tx = {
    $executeRaw: async (
      _strings: TemplateStringsArray,
      ...values: unknown[]
    ) => {
      calls.push(`lock:${String(values[0])}`);
      return 1;
    },
    publishingPostTarget: {
      findMany: async () => {
        calls.push("target.findMany");
        return [];
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
        return seededPosts.filter(
          (row) =>
            row.outstandPostId !== null && wanted.has(row.outstandPostId),
        );
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
    },
  };

  return { tx, calls, createdPosts, createdTargets };
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
        if (honorLock) {
          release = await lock.acquire(workspaceId);
        }
        return 1;
      },
      publishingPostTarget: {
        findMany: async () => [],
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
});
