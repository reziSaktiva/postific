/**
 * Migrasi satu-kali — T-133.2 (tiket `v02-publishing-mvp.md`, ADR-135).
 *
 * **BELUM DIEKSEKUSI.** Ditulis King Rezi minta sekaligus, TAPI eksekusi
 * nyata (memanggil Outstand API sungguhan + menulis `PublishingPost` baru
 * ke DB staging/production) WAJIB menunggu konfirmasi eksplisit — ini
 * memanggil API eksternal nyata dan menulis data real yang tidak trivial
 * dibatalkan (lihat `--execute` guard di bawah).
 *
 * **Konteks:** T-131 memperluas `since` default untuk trigger auto/manual
 * ke 1 tahun (`AUTO_MANUAL_LOOKBACK_DAYS`), tapi HANYA berlaku untuk akun
 * yang belum pernah di-sync (`lastImportedUntil === null`) atau trigger
 * baru. Akun EXISTING yang sudah "maju" watermark-nya (`lastImportedUntil`
 * sudah terisi, kadang jauh lebih baru dari 1 tahun lalu) TIDAK otomatis
 * mundur menangkap konten lama yang terlewat SEBELUM perluasan T-131 ada —
 * `ImportPostsTriggerUseCase.triggerManual`/`triggerPeriodicForAccounts`
 * SELALU memakai `lastImportedUntil` kalau sudah ada (`since: input.
 * lastImportedUntil ?? defaultSince(now)` — lihat `import-posts-trigger.
 * use-case.ts`), tidak ada jalur publik yang memaksa `since` mundur lebih
 * jauh dari watermark yang sudah ada.
 *
 * Script ini MEMAKSA `since` ke 1 tahun ke belakang (`FORCE_LOOKBACK_DAYS`)
 * untuk SEMUA `WorkspaceConnectedAccount` `active` (prioritas Instagram →
 * Facebook, sesuai urutan King Rezi — TikTok/Pinterest TIDAK termasuk,
 * lihat T-133.1: tidak ada akun test representatif DAN belum terverifikasi
 * didukung Outstand sama sekali), mereplikasi subset logic
 * `ImportPostsTriggerUseCase.runImportJob` SECARA LANGSUNG di sini (bukan
 * memanggil method itu) karena ketiga entry point publik
 * (`triggerAuto`/`triggerManual`/`triggerPeriodicForAccounts`) semuanya
 * menghormati watermark yang sudah ada — tidak ada parameter untuk
 * memaksanya mundur. Langkah per akun:
 *
 *   1. `IOutstandAdapter.importPosts(outstandAccountId, { since: 1 tahun
 *      lalu, until: now, limit: 1000 })`.
 *   2. Poll `fetchImportJobStatus` sampai `completed`/`failed` (pola sama
 *      `pollImportJobStatus`, interval lebih longgar karena script ini
 *      tidak terikat budget "30 detik per job runner" seperti Server
 *      Action "Sync Now").
 *   3. `ImportPostsProcessUseCase.process(...)` — REUSE `upsertImportedPostsTx`
 *      via `publishingRepository.upsertImportedPosts` (sudah aman dedup
 *      berdasarkan `(connectedAccountId, platformPostId)`, lihat
 *      `upsert-imported-posts.ts` — me-retrigger akun yang post-nya SUDAH
 *      ada tidak menduplikasi, hanya insert yang benar-benar baru).
 *   4. `ClassifyImportedPostTargetsUseCase.classifyBatch(...)` (T-132.4,
 *      ADR-135) — post BARU hasil retrigger ini langsung ikut
 *      diklasifikasi, konsisten alur sync biasa.
 *   5. `workspaceRepository.updateImportWatermark({ lastImportedUntil: until
 *      })` HANYA kalau batch TIDAK penuh (`posts.length < limit`) — pola
 *      sama `runImportJob` (ADR-093 poin 7): kalau penuh (kemungkinan masih
 *      ada post lebih lama yang belum terambil dalam limit 1000), watermark
 *      DIBIARKAN supaya operator bisa re-run script ini dengan `since` yang
 *      sama (dedup aman) untuk menangkap sisa.
 *
 * Satu akun gagal (network, rate limit, dst.) TIDAK menghentikan akun lain
 * dalam batch — try/catch per akun, log lalu lanjut (pola sama
 * `triggerPeriodicForAccounts`).
 *
 * **Guard eksekusi — WAJIB dibaca sebelum menjalankan:**
 * Default adalah DRY RUN (hanya mencetak akun yang AKAN diproses, TIDAK
 * memanggil Outstand atau menulis DB sama sekali). Jalankan dengan
 * `--execute` untuk benar-benar menjalankan langkah 1-5 di atas:
 *
 *   bun --env-file=.env.local run scripts/t133-retrigger-import-extended-lookback.ts            # dry run (aman)
 *   bun --env-file=.env.local run scripts/t133-retrigger-import-extended-lookback.ts --execute   # EKSEKUSI NYATA — minta konfirmasi King Rezi dulu
 *
 * TIDAK idempotent dalam arti "aman di-re-run tanpa efek" — re-run dengan
 * `since` yang sama tidak menduplikasi post (dedup `upsertImportedPostsTx`),
 * TAPI tiap run tetap memanggil Outstand API sungguhan (biaya/rate-limit
 * nyata) dan tiap run yang classifyBatch-nya menemukan sinyal baru akan
 * meng-overwrite `contentFormat` lagi (tidak merusak apa pun, tapi bukan
 * no-op murni).
 */
import { SocialPlatform } from "@postific/shared";
import {
  ClassifyImportedPostTargetsUseCase,
  ImportPostsProcessUseCase,
} from "@/domains/publishing";
import { getOutstandAdapter } from "@/lib/adapters/outstand";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";

const FORCE_LOOKBACK_DAYS = 365;
const IMPORT_LIMIT = 1000;
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 120_000; // longgar — script ini bukan Server Action, tidak terikat budget 30s job runner.

// Prioritas King Rezi: Instagram → Facebook dulu. TikTok/Pinterest TIDAK
// dimasukkan — T-133.1 belum memverifikasi dukungan Import Outstand untuk
// kedua platform ini (tidak ada akun test representatif tersedia saat T-132/
// T-133 dikerjakan, 2026-10-20), menambahkannya di sini akan diam-diam
// mengasumsikan endpoint generic bekerja — persis yang DILARANG tiket ini.
const PRIORITY_PLATFORMS: SocialPlatform[] = [
  SocialPlatform.Instagram,
  SocialPlatform.Facebook,
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const outstandAdapter = getOutstandAdapter();
  const processUseCase = new ImportPostsProcessUseCase(publishingRepository);
  const classifyUseCase = new ClassifyImportedPostTargetsUseCase(
    publishingRepository,
    outstandAdapter,
  );

  const allAccounts =
    await workspaceRepository.listAccountsForPeriodicImportSync();
  const accounts = allAccounts.filter((account) =>
    PRIORITY_PLATFORMS.includes(account.platform),
  );

  console.log(
    `[t133-retrigger-import] ${accounts.length}/${allAccounts.length} akun active cocok prioritas (Instagram/Facebook). ${execute ? "EXECUTE MODE — akan memanggil Outstand sungguhan." : "DRY RUN — tidak ada panggilan Outstand/DB write."}`,
  );

  for (const account of accounts) {
    console.log(
      `[t133-retrigger-import] ${execute ? "Memproses" : "(dry-run) Akan memproses"} connectedAccountId=${account.connectedAccountId} outstandAccountId=${account.outstandAccountId} platform=${account.platform}`,
    );
    if (!execute) continue;

    try {
      const owner =
        await workspaceRepository.findAccountOwnerByOutstandAccountId(
          account.outstandAccountId,
        );
      if (!owner) {
        console.warn(
          `[t133-retrigger-import] SKIP ${account.connectedAccountId} — owner workspace tidak ditemukan (akun mungkin sudah disconnect).`,
        );
        continue;
      }

      const until = new Date();
      const since = new Date(
        until.getTime() - FORCE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
      );

      const handle = await outstandAdapter.importPosts(
        account.outstandAccountId,
        {
          since,
          until,
          limit: IMPORT_LIMIT,
        },
      );

      const startedAt = Date.now();
      let outcome = await outstandAdapter.fetchImportJobStatus(
        account.outstandAccountId,
        handle.importJobId,
      );
      while (
        outcome.status === "pending" &&
        Date.now() - startedAt < POLL_TIMEOUT_MS
      ) {
        await sleep(POLL_INTERVAL_MS);
        outcome = await outstandAdapter.fetchImportJobStatus(
          account.outstandAccountId,
          handle.importJobId,
        );
      }

      if (outcome.status !== "completed") {
        console.error(
          `[t133-retrigger-import] GAGAL ${account.connectedAccountId}: status=${outcome.status} error=${outcome.error ?? "(timeout polling)"}`,
        );
        continue;
      }

      const processed = await processUseCase.process({
        workspaceId: account.workspaceId,
        connectedAccountId: account.connectedAccountId,
        platform: account.platform,
        posts: outcome.posts,
        actingUserId: owner.ownerUserId,
      });

      let classifiedCount = 0;
      if (outcome.posts.length > 0) {
        const classified = await classifyUseCase.classifyBatch({
          workspaceId: account.workspaceId,
          connectedAccountId: account.connectedAccountId,
          platform: account.platform,
          posts: outcome.posts,
          actingUserId: owner.ownerUserId,
        });
        classifiedCount = classified.classifiedCount;
      }

      const isPossiblyTruncated = outcome.posts.length >= IMPORT_LIMIT;
      if (!isPossiblyTruncated) {
        await workspaceRepository.updateImportWatermark({
          connectedAccountId: account.connectedAccountId,
          lastImportedUntil: until,
          actingUserId: owner.ownerUserId,
        });
      }

      console.log(
        `[t133-retrigger-import] OK ${account.connectedAccountId}: imported=${processed.insertedCount} skippedDuplicate=${processed.skippedDuplicateCount} classified=${classifiedCount}${isPossiblyTruncated ? " (batch PENUH — limit 1000 tercapai, watermark TIDAK dimajukan, re-run script ini untuk sisa post lebih lama)" : ""}`,
      );
    } catch (error) {
      console.error(
        `[t133-retrigger-import] GAGAL ${account.connectedAccountId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[t133-retrigger-import] fatal:", error);
    process.exit(1);
  });
