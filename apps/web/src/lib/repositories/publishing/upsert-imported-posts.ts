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
  // commit/rollback — pola sama `EngagementRepository.upsertInboxItem`,
  // `engagement.repository.ts`) — review Ridwan Architecture Reviewer
  // (T-113 follow-up, ronde 2): guard cross-post SELECT-lalu-INSERT di
  // bawah TIDAK atomik lintas TRANSAKSI/invocation berbeda. Kalau 2 akun
  // di workspace yang sama di-Import lewat 2 transaksi konkuren (mis.
  // "Sync Now" 2 tab hampir bersamaan) yang kebetulan membawa
  // `outstandPostId` yang sama (post cross-post), keduanya bisa
  // sama-sama lolos SELECT (belum ada yang commit) sebelum salah satu
  // INSERT — transaksi kedua tetap menabrak unique index
  // `publishing_posts_outstand_post_id_unique`. Lock ini menyerialkan
  // ANTAR invocation `upsertImportedPostsTx` untuk workspace yang sama
  // (bukan dalam satu transaksi — SELECT+INSERT di bawah sudah atomik
  // terhadap dirinya sendiri), sama semangat komentar di
  // `upsertInboxItem`.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId})::bigint)`;

  // Dedup (ADR-093 poin 4) — satu query batch untuk SELURUH
  // `platformPostId` di input, bukan satu query per post (N+1).
  // `connectedAccountId` ikut disaring karena `platformPostId` hanya
  // unik PER AKUN (dua akun berbeda bisa kebetulan punya
  // `platformPostId` yang sama secara string, walau jarang — defensif,
  // sama semangat dedup existing di ADR-092).
  const connectedAccountIds = [
    ...new Set(posts.map((post) => post.connectedAccountId)),
  ];
  const platformPostIds = [
    ...new Set(posts.map((post) => post.platformPostId)),
  ];

  const existing = await tx.publishingPostTarget.findMany({
    where: {
      connectedAccountId: { in: connectedAccountIds },
      platformPostId: { in: platformPostIds },
    },
    select: { connectedAccountId: true, platformPostId: true },
  });
  const existingKeys = new Set(
    existing.map((row) => `${row.connectedAccountId}:${row.platformPostId}`),
  );

  // Cross-post guard (T-113 follow-up, temuan Ridwan Architecture
  // Reviewer) — satu post Outstand (satu `outstandPostId`) bisa sudah
  // di-cross-post ke beberapa `connectedAccountId` berbeda. Dedup di
  // atas (keyed `connectedAccountId:platformPostId`) tidak menangkap
  // ini karena akun kedua punya key yang berbeda, tapi
  // `PublishingPost.outstandPostId` punya partial unique index GLOBAL
  // (migration `20260907130000_t026_unique_outstand_post_id`) yang
  // akan menolak `PublishingPost` KEDUA dengan `outstandPostId` yang
  // sama — tanpa guard ini, insert kedua melempar error Postgres
  // mentah yang membatalkan SELURUH transaksi batch ini (lihat
  // docstring `IPublishingRepository.upsertImportedPosts`).
  const outstandPostIds = [
    ...new Set(
      posts
        .map((post) => post.outstandPostId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
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

  let insertedCount = 0;
  let skippedDuplicateCount = 0;

  for (const post of posts) {
    const key = `${post.connectedAccountId}:${post.platformPostId}`;
    if (existingKeys.has(key)) {
      skippedDuplicateCount++;
      continue;
    }

    const existingPostId = post.outstandPostId
      ? postIdByOutstandId.get(post.outstandPostId)
      : undefined;

    if (existingPostId) {
      // Post Outstand yang sama sudah punya `PublishingPost` (dari
      // Import akun lain) — tambah TARGET baru ke post yang sudah ada,
      // JANGAN buat `PublishingPost` baru (akan menabrak unique index
      // `outstandPostId`). Akun ini tetap terlihat sebagai target post
      // yang sama di Engage/History, tidak di-skip diam-diam.
      await tx.publishingPostTarget.create({
        data: {
          postId: existingPostId,
          connectedAccountId: post.connectedAccountId,
          platform: post.platform,
          contentFormat: ContentFormat.Post,
          platformPostId: post.platformPostId,
          platformPostUrl: post.platformPostUrl,
          status: "published",
          platformOptions:
            post.mediaUrls.length > 0
              ? { mediaUrls: post.mediaUrls }
              : undefined,
        },
      });

      existingKeys.add(key);
      insertedCount++;
      continue;
    }

    const createdPost = await tx.publishingPost.create({
      data: {
        workspaceId,
        // ADR-093 poin 3 — authorId null HANYA untuk status Imported.
        authorId: null,
        status: ContentStatus.Imported,
        // T-113/KI-090 — tanpa ini, `listSyncablePostsByConnectedAccount`
        // (syarat `outstandPostId: { not: null }`) tidak pernah
        // menyertakan post Imported, jadi comment-nya tidak pernah
        // ter-sync ke Engage Inbox. `null` kalau Outstand tidak
        // membawa id valid untuk post ini (defensif, tidak
        // menghalangi import).
        outstandPostId: post.outstandPostId,
        caption: post.caption,
        publishedAt: post.publishedAt,
        targets: {
          create: [
            {
              connectedAccountId: post.connectedAccountId,
              platform: post.platform,
              contentFormat: ContentFormat.Post,
              platformPostId: post.platformPostId,
              platformPostUrl: post.platformPostUrl,
              // Target hasil import sudah live di platform sejak
              // sebelum tool ini tahu soal post ini — "published" (bukan
              // "pending") adalah outcome yang benar, bukan hasil
              // percobaan publish kita sendiri.
              status: "published",
              // Media eksternal (`ImportedPostData.mediaUrls`) belum
              // punya kolom DB khusus (T-090 scope) — disimpan di sini
              // supaya tidak hilang untuk UI Imported nanti (T-090.5).
              platformOptions:
                post.mediaUrls.length > 0
                  ? { mediaUrls: post.mediaUrls }
                  : undefined,
            },
          ],
        },
      },
      select: { id: true },
    });

    if (post.outstandPostId) {
      // Post lain dalam BATCH YANG SAMA (seharusnya tidak terjadi untuk
      // satu akun — tapi defensif) yang kebetulan merujuk
      // `outstandPostId` ini juga ikut ter-attach ke post yang baru
      // dibuat ini, bukan mencoba create baru lagi.
      postIdByOutstandId.set(post.outstandPostId, createdPost.id);
    }

    // Supaya post lain dalam BATCH YANG SAMA dengan `platformPostId`
    // kebetulan identik (seharusnya tidak terjadi — Outstand tidak
    // pernah mengembalikan duplikat dalam satu `fetchImportJobStatus`
    // — tapi defensif) tidak ikut ter-insert dobel.
    existingKeys.add(key);
    insertedCount++;
  }

  return { insertedCount, skippedDuplicateCount };
}
