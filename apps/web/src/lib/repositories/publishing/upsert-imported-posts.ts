import {
  ContentFormat,
  ContentStatus,
  type WorkspaceId,
} from "@postific/shared";
import type {
  ImportedPostTargetInput,
  UpsertImportedPostsResult,
} from "@/domains/publishing/repositories/publishing.repository";
import type { PrismaTransactionClient } from "@/lib/prisma/with-current-user";
import {
  findOutstandPostOwners,
  lockOutstandPostIds,
  lockWorkspaceForOutstandIdWrite,
  type OutstandPostOwner,
} from "./outstand-post-id-locks";

/**
 * Jumlah post maksimum per transaksi interaktif Prisma (T-139, KI-099).
 * `upsertImportedPostsTx` menulis post satu per satu (beberapa query per
 * post), jadi satu transaksi untuk seluruh batch import besar melewati
 * timeout default Prisma 5000 ms dan seluruh job gagal. Dipecah supaya
 * durasi tiap transaksi dibatasi, tidak tumbuh mengikuti ukuran batch.
 */
export const UPSERT_IMPORTED_POSTS_CHUNK_SIZE = 50;

/**
 * Timeout tiap transaksi chunk (ms) — pengaman di atas default Prisma 5000
 * ms untuk satu chunk yang lambat (latensi DB tinggi), BUKAN pengganti
 * chunking: durasi total tetap tidak dibatasi oleh angka ini.
 */
export const UPSERT_IMPORTED_POSTS_TX_TIMEOUT_MS = 15_000;

/**
 * Pecah `posts` jadi chunk berurutan dan jalankan `runChunk` (satu
 * transaksi) per chunk, lalu jumlahkan hasilnya (T-139, KI-099).
 *
 * Konsekuensi yang disengaja: all-or-nothing per BATCH hilang, hanya
 * per CHUNK. Aman karena `upsertImportedPostsTx` idempoten (dedup
 * `connectedAccountId`+`platformPostId` dan `outstandPostId`) dan tiap
 * chunk membaca ulang DB, jadi chunk yang sudah commit terlihat oleh chunk
 * berikutnya. Kalau satu chunk melempar error, chunk sebelumnya tetap
 * tersimpan, error dilempar ke pemanggil (job retry), dan retry hanya
 * menghitung ulang sisanya sebagai duplikat — watermark tidak dimajukan
 * kalau use-case pemanggil gagal (lihat `import-posts-trigger.use-case.ts`).
 */
export async function upsertImportedPostsInChunks(
  posts: ImportedPostTargetInput[],
  runChunk: (
    chunk: ImportedPostTargetInput[],
  ) => Promise<UpsertImportedPostsResult>,
  chunkSize: number = UPSERT_IMPORTED_POSTS_CHUNK_SIZE,
): Promise<UpsertImportedPostsResult> {
  let insertedCount = 0;
  let skippedDuplicateCount = 0;

  for (let start = 0; start < posts.length; start += chunkSize) {
    const result = await runChunk(posts.slice(start, start + chunkSize));
    insertedCount += result.insertedCount;
    skippedDuplicateCount += result.skippedDuplicateCount;
  }

  return { insertedCount, skippedDuplicateCount };
}

/**
 * Import Posts dari Social Account (T-090.4, ADR-093 poin 3-4, 7) — logika
 * inti `IPublishingRepository.upsertImportedPosts` (lihat docstring lengkap
 * di sana), diekstrak ke fungsi berdiri sendiri (pola sama
 * `replaceDraftTargets`) supaya bisa di-unit-test dengan `tx` palsu tanpa
 * DB sungguhan — `PublishingRepository.upsertImportedPosts` di
 * `publishing.repository.ts` hanya membungkusnya dengan `withCurrentUser`.
 */
export async function upsertImportedPostsTx(
  tx: PrismaTransactionClient,
  workspaceId: WorkspaceId,
  posts: ImportedPostTargetInput[],
): Promise<UpsertImportedPostsResult> {
  // Advisory lock per `workspaceId` (dilepas otomatis saat transaksi
  // commit/rollback — pola sama `EngagementRepository.upsertInboxItem`).
  // Menyerialkan import di workspace yang sama supaya dua akun tidak
  // sama-sama INSERT `outstandPostId` yang identik.
  await lockWorkspaceForOutstandIdWrite(tx, workspaceId);

  const outstandPostIds = [
    ...new Set(
      posts
        .map((post) => post.outstandPostId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ].sort();

  // Lock kedua, key-space `(int, int)` — TERPISAH dari lock bigint di atas
  // dan dari lock engagement (`hashtext(connectedAccountId)`). Mengunci
  // tiap `outstandPostId` secara global (urut, supaya tidak deadlock)
  // sebelum baca/tulis, karena unique index `outstand_post_id` juga global:
  // dua workspace bisa mengimpor id yang sama tanpa saling menunggu lock
  // workspace. Satu query batched, namespace yang sama dengan backfill.
  await lockOutstandPostIds(tx, outstandPostIds);

  const connectedAccountIds = [
    ...new Set(posts.map((post) => post.connectedAccountId)),
  ];
  const platformPostIds = [
    ...new Set(posts.map((post) => post.platformPostId)),
  ];

  const existingTargets = await tx.publishingPostTarget.findMany({
    where: {
      connectedAccountId: { in: connectedAccountIds },
      platformPostId: { in: platformPostIds },
    },
    select: {
      id: true,
      postId: true,
      connectedAccountId: true,
      platformPostId: true,
      post: { select: { outstandPostId: true } },
    },
  });
  const existingTargetByKey = new Map<string, ExistingTargetRef>(
    existingTargets.flatMap((row) =>
      row.platformPostId
        ? [
            [
              `${row.connectedAccountId}:${row.platformPostId}`,
              {
                postId: row.postId,
                connectedAccountId: row.connectedAccountId,
                platformPostId: row.platformPostId,
                currentOutstandPostId: row.post.outstandPostId,
              },
            ] as const,
          ]
        : [],
    ),
  );

  const existingPostsByOutstandId =
    outstandPostIds.length > 0
      ? await tx.publishingPost.findMany({
          where: {
            workspaceId,
            outstandPostId: { in: outstandPostIds },
            deletedAt: null,
          },
          select: { id: true, outstandPostId: true },
        })
      : [];
  const postIdByOutstandId = new Map<string, string>(
    existingPostsByOutstandId
      .filter(
        (row): row is { id: string; outstandPostId: string } =>
          row.outstandPostId !== null,
      )
      .map((row) => [row.outstandPostId, row.id]),
  );

  // Index unique `outstand_post_id` global, sementara RLS
  // `publishing_posts_workspace_isolation` menyembunyikan baris workspace
  // lain dari `findMany` di atas (`app_runtime` tidak BYPASSRLS, ADR-099).
  // Reuse fungsi SECURITY DEFINER yang sudah ada — satu query batched
  // (`unnest`+`LATERAL`), bukan fungsi bypass baru.
  const globalOwners = await findOutstandPostOwners(tx, outstandPostIds);

  const localPostIds = [
    ...new Set([
      ...postIdByOutstandId.values(),
      ...[...globalOwners.values()]
        .filter((owner) => owner.workspaceId === workspaceId)
        .map((owner) => owner.postId),
    ]),
  ];
  const targetsOnLocalPosts =
    localPostIds.length > 0
      ? await tx.publishingPostTarget.findMany({
          where: {
            postId: { in: localPostIds },
            connectedAccountId: { in: connectedAccountIds },
          },
          select: {
            id: true,
            postId: true,
            connectedAccountId: true,
            platformPostId: true,
          },
        })
      : [];
  const targetByPostAccount = new Map(
    targetsOnLocalPosts.map((row) => [
      `${row.postId}:${row.connectedAccountId}`,
      row,
    ]),
  );

  let insertedCount = 0;
  let skippedDuplicateCount = 0;

  for (const post of posts) {
    const key = `${post.connectedAccountId}:${post.platformPostId}`;
    const duplicate = existingTargetByKey.get(key);
    if (duplicate) {
      if (post.outstandPostId) {
        const filled = await backfillOutstandPostId(
          tx,
          workspaceId,
          duplicate.postId,
          duplicate.currentOutstandPostId,
          post.outstandPostId,
          globalOwners,
          postIdByOutstandId,
        );
        if (filled) duplicate.currentOutstandPostId = post.outstandPostId;
      }
      skippedDuplicateCount++;
      continue;
    }

    const owner = post.outstandPostId
      ? globalOwners.get(post.outstandPostId)
      : undefined;
    if (owner && owner.workspaceId !== workspaceId) {
      // Id sudah milik workspace lain. Unique index global menolak baris
      // kedua, dan attach lintas tenant tidak boleh. Post tetap diimpor
      // tanpa `outstandPostId` supaya satu tabrakan tidak membatalkan
      // seluruh batch. Comment sync untuk salinan ini tidak jalan — id
      // itu sudah mengarah ke workspace pemiliknya.
      const created = await createImportedPost(tx, workspaceId, post, null);
      existingTargetByKey.set(key, {
        postId: created.id,
        connectedAccountId: post.connectedAccountId,
        platformPostId: post.platformPostId,
        currentOutstandPostId: null,
      });
      insertedCount++;
      continue;
    }

    const existingPostId = post.outstandPostId
      ? (postIdByOutstandId.get(post.outstandPostId) ??
        (owner?.workspaceId === workspaceId ? owner.postId : undefined))
      : undefined;

    if (existingPostId) {
      const accountKey = `${existingPostId}:${post.connectedAccountId}`;
      const existingAccountTarget = targetByPostAccount.get(accountKey);
      const accountAlreadyOnPost =
        existingAccountTarget !== undefined ||
        (owner?.connectedAccountIds.has(post.connectedAccountId) ?? false);

      if (accountAlreadyOnPost) {
        if (
          existingAccountTarget &&
          existingAccountTarget.platformPostId === null
        ) {
          await tx.publishingPostTarget.updateMany({
            where: {
              id: existingAccountTarget.id,
              postId: existingPostId,
              connectedAccountId: post.connectedAccountId,
              platformPostId: null,
            },
            data: targetFillData(post),
          });
          existingAccountTarget.platformPostId = post.platformPostId;
        }
        existingTargetByKey.set(key, {
          postId: existingPostId,
          connectedAccountId: post.connectedAccountId,
          platformPostId: post.platformPostId,
          currentOutstandPostId: post.outstandPostId,
        });
        skippedDuplicateCount++;
        continue;
      }

      await tx.publishingPostTarget.create({
        data: {
          postId: existingPostId,
          ...targetCreateFields(post),
        },
      });
      targetByPostAccount.set(accountKey, {
        id: "local",
        postId: existingPostId,
        connectedAccountId: post.connectedAccountId,
        platformPostId: post.platformPostId,
      });
      owner?.connectedAccountIds.add(post.connectedAccountId);
      existingTargetByKey.set(key, {
        postId: existingPostId,
        connectedAccountId: post.connectedAccountId,
        platformPostId: post.platformPostId,
        currentOutstandPostId: post.outstandPostId,
      });
      insertedCount++;
      continue;
    }

    const createdPost = await createImportedPost(
      tx,
      workspaceId,
      post,
      post.outstandPostId,
    );

    if (post.outstandPostId) {
      postIdByOutstandId.set(post.outstandPostId, createdPost.id);
      globalOwners.set(post.outstandPostId, {
        postId: createdPost.id,
        workspaceId,
        connectedAccountIds: new Set([post.connectedAccountId]),
      });
    }
    targetByPostAccount.set(`${createdPost.id}:${post.connectedAccountId}`, {
      id: "local",
      postId: createdPost.id,
      connectedAccountId: post.connectedAccountId,
      platformPostId: post.platformPostId,
    });
    existingTargetByKey.set(key, {
      postId: createdPost.id,
      connectedAccountId: post.connectedAccountId,
      platformPostId: post.platformPostId,
      currentOutstandPostId: post.outstandPostId,
    });
    insertedCount++;
  }

  return { insertedCount, skippedDuplicateCount };
}

type ExistingTargetRef = {
  postId: string;
  connectedAccountId: string;
  platformPostId: string;
  currentOutstandPostId: string | null;
};

async function backfillOutstandPostId(
  tx: PrismaTransactionClient,
  workspaceId: WorkspaceId,
  postId: string,
  currentOutstandPostId: string | null,
  incomingOutstandPostId: string,
  globalOwners: Map<string, OutstandPostOwner>,
  postIdByOutstandId: Map<string, string>,
): Promise<boolean> {
  if (currentOutstandPostId) return false;

  const owner = globalOwners.get(incomingOutstandPostId);
  if (owner && owner.postId !== postId) return false;

  const updated = await tx.publishingPost.updateMany({
    where: {
      id: postId,
      workspaceId,
      outstandPostId: null,
      deletedAt: null,
    },
    data: { outstandPostId: incomingOutstandPostId },
  });
  if (updated.count === 0) return false;

  postIdByOutstandId.set(incomingOutstandPostId, postId);
  const connectedAccountIds = owner?.connectedAccountIds ?? new Set<string>();
  globalOwners.set(incomingOutstandPostId, {
    postId,
    workspaceId,
    connectedAccountIds,
  });
  return true;
}

/**
 * Default placeholder `ContentFormat` untuk post hasil Import (ADR-135,
 * T-132.5) — Outstand TIDAK menyediakan jenis konten (Post/Reel/Story) sama
 * sekali di endpoint import (`GET /v1/posts`, `GET /v1/posts/{id}`),
 * dipastikan lewat OpenAPI resmi DAN data nyata. `ContentFormat.Post` di
 * sini BUKAN asumsi "semua post hasil import memang Post" — murni nilai
 * "belum terklasifikasi" sementara (ADR-135 TIDAK menambah enum
 * `ContentFormat` baru untuk kasus ini, lihat ADR-135 poin 4). Nilai ini
 * di-OVERWRITE belakangan oleh `ClassifyImportedPostTargetsUseCase`
 * (T-132.4, dipanggil `ImportPostsTriggerUseCase.runImportJob` SETELAH
 * `upsertImportedPosts` ini selesai) KALAU sinyal analytics
 * (`IOutstandAdapter.fetchPostMetrics`) tersedia — kalau tidak (Story
 * expired, platform tanpa sinyal resmi), nilai placeholder ini TETAP di DB
 * apa adanya.
 */
const UNCLASSIFIED_CONTENT_FORMAT_PLACEHOLDER = ContentFormat.Post;

function targetCreateFields(post: ImportedPostTargetInput) {
  return {
    connectedAccountId: post.connectedAccountId,
    platform: post.platform,
    contentFormat: UNCLASSIFIED_CONTENT_FORMAT_PLACEHOLDER,
    platformPostId: post.platformPostId,
    platformPostUrl: post.platformPostUrl,
    status: "published" as const,
    platformOptions:
      post.mediaUrls.length > 0 ? { mediaUrls: post.mediaUrls } : undefined,
  };
}

function targetFillData(post: ImportedPostTargetInput) {
  return {
    platformPostId: post.platformPostId,
    platformPostUrl: post.platformPostUrl,
    ...(post.mediaUrls.length > 0
      ? { platformOptions: { mediaUrls: post.mediaUrls } }
      : {}),
  };
}

async function createImportedPost(
  tx: PrismaTransactionClient,
  workspaceId: WorkspaceId,
  post: ImportedPostTargetInput,
  outstandPostId: string | null,
): Promise<{ id: string }> {
  return tx.publishingPost.create({
    data: {
      workspaceId,
      authorId: null,
      status: ContentStatus.Imported,
      outstandPostId,
      caption: post.caption,
      publishedAt: post.publishedAt,
      targets: {
        create: [targetCreateFields(post)],
      },
    },
    select: { id: true },
  });
}
