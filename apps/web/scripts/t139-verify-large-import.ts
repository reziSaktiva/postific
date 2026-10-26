/**
 * Verifikasi satu-kali — T-139.4 (`tickets/known-issues.md`, KI-099).
 *
 * Memicu import satu akun Instagram bervolume besar di luar job runner
 * (Server Action "Sync Now" dibatasi 25 detik menunggu Outstand), dengan
 * polling longgar, lalu menulis hasilnya lewat jalur produksi yang sama
 * (`ImportPostsProcessUseCase` → `upsertImportedPosts` → chunk per transaksi,
 * T-139) supaya terbukti insert batch besar tidak lagi kena timeout 5000 ms.
 *
 * Berbeda dari `t133-retrigger-import-extended-lookback.ts`: hanya SATU akun
 * (dipilih lewat argumen) dan TIDAK memajukan watermark / mengklasifikasi —
 * murni uji tulis batch besar. Dedup `upsertImportedPostsTx` membuat re-run
 * aman, tapi tiap run memanggil Outstand sungguhan dan menulis data nyata.
 *
 *   bun --env-file=.env.local run scripts/t139-verify-large-import.ts <platform>   (mis. instagram)
 */
import { SocialPlatform } from "@postific/shared";
import { ImportPostsProcessUseCase } from "@/domains/publishing";
import { getOutstandAdapter } from "@/lib/adapters/outstand";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";

const LOOKBACK_DAYS = 365;
const IMPORT_LIMIT = 1000;
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 15 * 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const platformArg = process.argv[2];
  if (
    !platformArg ||
    !(Object.values(SocialPlatform) as string[]).includes(platformArg)
  ) {
    throw new Error(
      `Usage: <platform> — salah satu dari: ${Object.values(SocialPlatform).join(", ")}`,
    );
  }

  const adapter = getOutstandAdapter();
  const processUseCase = new ImportPostsProcessUseCase(publishingRepository);

  const accounts = (
    await workspaceRepository.listAccountsForPeriodicImportSync()
  ).filter((account) => account.platform === platformArg);
  if (accounts.length !== 1) {
    throw new Error(
      `Harus tepat 1 akun ${platformArg} active, ditemukan ${accounts.length}.`,
    );
  }
  const account = accounts[0]!;
  const owner = await workspaceRepository.findAccountOwnerByOutstandAccountId(
    account.outstandAccountId,
  );
  if (!owner) throw new Error("Owner workspace akun tidak ditemukan.");

  const until = new Date();
  const since = new Date(until.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const handle = await adapter.importPosts(account.outstandAccountId, {
    since,
    until,
    limit: IMPORT_LIMIT,
  });
  console.log(`[t139-verify] importJobId=${handle.importJobId}, polling...`);

  const startedAt = Date.now();
  let outcome = await adapter.fetchImportJobStatus(
    account.outstandAccountId,
    handle.importJobId,
  );
  while (
    outcome.status === "pending" &&
    Date.now() - startedAt < POLL_TIMEOUT_MS
  ) {
    await sleep(POLL_INTERVAL_MS);
    outcome = await adapter.fetchImportJobStatus(
      account.outstandAccountId,
      handle.importJobId,
    );
  }
  console.log(
    `[t139-verify] outstand status=${outcome.status} posts=${outcome.status === "completed" ? outcome.posts.length : 0} waited=${Math.round((Date.now() - startedAt) / 1000)}s`,
  );
  if (outcome.status !== "completed") {
    throw new Error(
      `Import Outstand belum completed: ${outcome.status} ${outcome.error ?? ""}`,
    );
  }

  const writeStartedAt = Date.now();
  const processed = await processUseCase.process({
    workspaceId: account.workspaceId,
    connectedAccountId: account.connectedAccountId,
    platform: account.platform,
    posts: outcome.posts,
    actingUserId: owner.ownerUserId,
  });
  console.log(
    `[t139-verify] OK inserted=${processed.insertedCount} skippedDuplicate=${processed.skippedDuplicateCount} writeMs=${Date.now() - writeStartedAt}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[t139-verify] fatal:", error);
    process.exit(1);
  });
