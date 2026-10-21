/**
 * Migrasi satu-kali — T-133.3 (tiket `v02-publishing-mvp.md`, ADR-135).
 *
 * **BELUM DIEKSEKUSI.** Siap dijalankan, TAPI menunggu konfirmasi eksplisit
 * King Rezi — ini menulis `PublishingPostTarget.contentFormat` untuk data
 * REAL di DB staging/production (43 post `Imported` existing, akun test
 * "Cook It Real Good", ditemukan saat penulisan ADR-135 — kemungkinan
 * jumlahnya sudah berubah di saat eksekusi, script ini menghitung ulang
 * live, bukan hardcode 43).
 *
 * **Konteks:** sebelum T-132, SEMUA post hasil Import Posts disimpan
 * `contentFormat: ContentFormat.Post` hardcode (lihat komentar
 * `UNCLASSIFIED_CONTENT_FORMAT_PLACEHOLDER` di `upsert-imported-posts.ts`).
 * T-132.4 (`ClassifyImportedPostTargetsUseCase`) hanya berjalan untuk batch
 * post BARU setiap sync — post `Imported` yang SUDAH ada sebelum T-132.4
 * di-deploy tidak otomatis ikut diklasifikasi ulang. Script ini menjalankan
 * mekanisme yang SAMA PERSIS (`ClassifyImportedPostTargetsUseCase.
 * classifyBatch`, bukan logika kedua) secara retroaktif untuk SELURUH
 * `PublishingPostTarget` di bawah post `status: Imported` yang punya
 * `platformPostId` + `outstandPostId` terisi (keduanya wajib — tanpa
 * `outstandPostId` tidak ada id untuk `fetchPostMetrics`; backfill
 * `outstandPostId` itu sendiri T-114, independen, sudah berjalan otomatis
 * setiap sync biasa).
 *
 * **Query read-only ini mengimpor Prisma client LANGSUNG** (pengecualian
 * sengaja untuk script operator satu-off, BUKAN domain/application layer —
 * AGENTS.md rule 4 berlaku untuk source produksi `apps/`+`packages/`
 * domain/application, bukan script migrasi sekali-pakai yang tidak pernah
 * ikut request path aplikasi). SELURUH operasi TULIS tetap lewat
 * `ClassifyImportedPostTargetsUseCase` → `IPublishingRepository.
 * classifyImportedPostTargets` (satu jalur domain yang sudah diuji, pola
 * sama `backfill-ki025-resolve-pending-outcomes.ts`).
 *
 * Dikelompokkan per `connectedAccountId` (kontrak `classifyBatch` butuh
 * SATU `platform` per panggilan) — `actingUserId` di-resolve per akun lewat
 * `workspaceRepository.findAccountOwnerByOutstandAccountId` (pola sama
 * script T-133.2, KI-088).
 *
 * Jalankan:
 *   bun --env-file=.env.local run scripts/t133-backfill-classify-imported-content-format.ts            # dry run (aman, hanya query + cetak ringkasan)
 *   bun --env-file=.env.local run scripts/t133-backfill-classify-imported-content-format.ts --execute   # EKSEKUSI NYATA — minta konfirmasi King Rezi dulu
 *
 * Aman di-re-run (idempotent secara efek): `classifyImportedPostTargets`
 * murni `UPDATE` kolom `contentFormat` berdasarkan sinyal TERBARU dari
 * Outstand — re-run tidak menduplikasi apa pun, paling banter menulis ulang
 * nilai yang sama (atau mengoreksi kalau sinyal Outstand berubah, yang
 * seharusnya tidak terjadi untuk post lama).
 */
import {
  ContentStatus,
  type ConnectedAccountId,
  type WorkspaceId,
} from "@postific/shared";
import { ClassifyImportedPostTargetsUseCase } from "@/domains/publishing";
import { getOutstandAdapter } from "@/lib/adapters/outstand";
import { prisma } from "@/lib/prisma/client";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";

interface CandidateRow {
  connectedAccountId: string;
  platformPostId: string;
  outstandPostId: string;
  workspaceId: string;
  platform: string;
}

/**
 * Baca kandidat LANGSUNG via Prisma (lihat docstring file — pengecualian
 * disengaja untuk script operator, read-only, bukan `IPublishingRepository`
 * karena tidak ada kebutuhan produksi lain untuk query se-spesifik ini).
 * `withCurrentUser` TIDAK dipakai di sini — baris ini dibaca APA ADANYA
 * lintas workspace (`app_runtime` tidak BYPASSRLS per ADR-099, tapi migrasi
 * satu-off ini dijalankan operator dengan akses DB langsung, bukan lewat
 * jalur aplikasi bertenant) hanya untuk MENGHITUNG kandidat; penulisan tetap
 * 100% lewat `classifyImportedPostTargets` (RLS `withCurrentUser` penuh).
 */
async function findCandidates(): Promise<CandidateRow[]> {
  const rows = await prisma.publishingPostTarget.findMany({
    where: {
      platformPostId: { not: null },
      post: {
        status: ContentStatus.Imported,
        outstandPostId: { not: null },
        deletedAt: null,
      },
    },
    select: {
      connectedAccountId: true,
      platformPostId: true,
      platform: true,
      post: { select: { workspaceId: true, outstandPostId: true } },
    },
  });

  const candidates: CandidateRow[] = [];
  for (const row of rows) {
    if (!row.platformPostId || !row.post.outstandPostId) continue;
    candidates.push({
      connectedAccountId: row.connectedAccountId,
      platformPostId: row.platformPostId,
      outstandPostId: row.post.outstandPostId,
      workspaceId: row.post.workspaceId,
      platform: row.platform,
    });
  }
  return candidates;
}

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const outstandAdapter = getOutstandAdapter();
  const classifyUseCase = new ClassifyImportedPostTargetsUseCase(
    publishingRepository,
    outstandAdapter,
  );

  const candidates = await findCandidates();
  const byConnectedAccount = new Map<string, CandidateRow[]>();
  for (const candidate of candidates) {
    const list = byConnectedAccount.get(candidate.connectedAccountId) ?? [];
    list.push(candidate);
    byConnectedAccount.set(candidate.connectedAccountId, list);
  }

  console.log(
    `[t133-backfill-classify] ${candidates.length} PublishingPostTarget kandidat ditemukan di ${byConnectedAccount.size} akun. ${execute ? "EXECUTE MODE — akan memanggil Outstand fetchPostMetrics + menulis DB." : "DRY RUN — tidak ada panggilan Outstand/DB write."}`,
  );

  for (const [connectedAccountId, rows] of byConnectedAccount) {
    console.log(
      `[t133-backfill-classify] ${execute ? "Memproses" : "(dry-run) Akan memproses"} connectedAccountId=${connectedAccountId} (${rows.length} post, platform=${rows[0]?.platform})`,
    );
    if (!execute) continue;

    try {
      const firstRow = rows[0];
      if (!firstRow) continue;

      const owner =
        await workspaceRepository.findAccountOwnerByOutstandAccountId(
          // `findAccountOwnerByOutstandAccountId` butuh `outstandAccountId`
          // (Outstand), BUKAN `connectedAccountId` (id internal kita) — kedua
          // id ini beda namespace. Resolve dulu lewat `WorkspaceConnectedAccount`.
          await resolveOutstandAccountId(
            connectedAccountId as ConnectedAccountId,
          ),
        );
      if (!owner) {
        console.warn(
          `[t133-backfill-classify] SKIP ${connectedAccountId} — owner workspace tidak ditemukan (akun mungkin sudah disconnect).`,
        );
        continue;
      }

      const result = await classifyUseCase.classifyBatch({
        workspaceId: firstRow.workspaceId as WorkspaceId,
        connectedAccountId: connectedAccountId as ConnectedAccountId,
        platform: firstRow.platform as never, // `platform` kolom DB adalah string; cast ke SocialPlatform sudah divalidasi saat insert (upsertImportedPostsTx) — konsisten pola existing repository yang membaca kolom ini apa adanya.
        posts: rows.map((row) => ({
          platformPostId: row.platformPostId,
          outstandPostId: row.outstandPostId,
          caption: "",
          publishedAt: new Date(0),
          platformPostUrl: null,
          mediaUrls: [],
        })),
        actingUserId: owner.ownerUserId,
      });

      console.log(
        `[t133-backfill-classify] OK ${connectedAccountId}: classifiedCount=${result.classifiedCount}/${rows.length}`,
      );
    } catch (error) {
      console.error(
        `[t133-backfill-classify] GAGAL ${connectedAccountId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

async function resolveOutstandAccountId(
  connectedAccountId: ConnectedAccountId,
): Promise<string> {
  const account = await prisma.workspaceConnectedAccount.findUniqueOrThrow({
    where: { id: connectedAccountId },
    select: { outstandAccountId: true },
  });
  return account.outstandAccountId;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[t133-backfill-classify] fatal:", error);
    process.exit(1);
  });
