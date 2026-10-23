import type {
  AccountOwnerLookupResult,
  ConnectedAccountId,
  ImportJobOutcome,
  IOutstandAdapter,
  MemberRole,
  SocialPlatform,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import { ConflictError } from "@/lib/utils/errors";
import { resolveVerifiedAccountOwner } from "@/lib/jobs/account-owner-resolution";
import { IMPORT_SYNC_JOB_TYPE } from "./import-sync-job-handler";
import { assertActorCanTriggerManualImportSync } from "../rbac";
import type {
  IImportJobRepository,
  ImportSyncJobRecord,
  ImportSyncJobResult,
  ImportSyncTrigger,
} from "../repositories/import-job.repository";
import type { BackfillOutstandPostIdsUseCase } from "./backfill-outstand-post-ids.use-case";
import type { ClassifyImportedPostTargetsUseCase } from "./classify-imported-post-targets.use-case";
import type { ImportPostsProcessUseCase } from "./import-posts-process.use-case";

/**
 * T-131 — sebelum tiket ini, `DEFAULT_IMPORT_LOOKBACK_DAYS`/`DEFAULT_IMPORT_LIMIT`
 * satu konstanta dipakai ketiga trigger (auto/manual/periodik) sekaligus.
 * King Rezi (AskUserQuestion, 2026-10-20) minta ketiganya benar-benar beda
 * kebijakan — dipecah jadi dua pasang konstanta di bawah, bukan lagi satu:
 * - Auto (on-connect) & manual ("Sync Now"): lookback 1 tahun, limit 1000.
 * - Periodik (cron harian + antrian T-115): limit tetap 100; lookback-nya
 *   BUKAN angka hari tetap lagi — lihat `periodicImportSince` (anti-gap,
 *   pakai `CRON_LOOKBACK_MS` sebagai salah satu dari dua kandidat `since`).
 */
const AUTO_MANUAL_LOOKBACK_DAYS = 365;
const AUTO_MANUAL_IMPORT_LIMIT = 1000;
const CRON_IMPORT_LIMIT = 100;
const CRON_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const MANUAL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MANUAL_CAP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Bug ditemukan King Rezi 2026-10-08 testing "Sync Now" sungguhan (sesudah
 * T-112 wiring HTTP selesai, SEBELUM fix ini): `POST /v1/social-accounts/
 * {id}/imports` async beneran di sisi Outstand (ADR-093 Context — job
 * di-enqueue, hasil belakangan) — status PERTAMA yang didapat SELALU
 * `queued`/`running` (dipetakan `"pending"`, lihat `RealOutstandAdapter.
 * fetchImportJobStatus`), BUKAN `completed`. `runImportSync` versi T-112
 * memanggil `fetchImportJobStatus` SEKALI saja lalu langsung mark
 * `"failed"` kalau bukan `"completed"` — artinya "Sync Now" HAMPIR SELALU
 * gagal padahal job-nya sebenarnya masih berjalan normal di Outstand,
 * bukan error. Fix: polling berbatas waktu di bawah ini.
 *
 * Interval 2 detik, timeout total 25 detik (BUKAN 30 — sengaja disisakan
 * margin dari budget "30 detik per run job runner" BG-D05 yang disebut di
 * komentar lain file ini, supaya Server Action "Sync Now" yang memanggil
 * use-case ini sinkron dari klik tombol tidak pernah menyentuh timeout
 * lapisan lain seperti Server Action Next.js). Resume background
 * (job/cron terpisah untuk status yang masih pending setelah 25 detik)
 * SENGAJA TIDAK dibangun di sini — perubahan infrastruktur lebih besar,
 * di luar scope perbaikan bug ini; job lokal tetap di-mark `"failed"` dan
 * user disilakan klik "Sync Now" lagi nanti (pesan errornya eksplisit
 * membedakan ini dari kegagalan permanen).
 */
const IMPORT_STATUS_POLL_INTERVAL_MS = 2_000;
const IMPORT_STATUS_POLL_TIMEOUT_MS = 25_000;

/** Injectable (test memakai versi instan, bukan `setTimeout` sungguhan) — default sungguhan di bawah. */
export type SleepFn = (ms: number) => Promise<void>;

const defaultSleep: SleepFn = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** `since` default untuk trigger auto (on-connect) & manual ("Sync Now") — 1 tahun ke belakang (T-131.1/T-131.2). */
function defaultSince(now: Date): Date {
  return new Date(
    now.getTime() - AUTO_MANUAL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );
}

/**
 * `since` periodik (cron harian T-115 + antrian `executeQueuedPeriodicImport`)
 * — T-131.3, pengaman anti-gap. BUKAN sekadar watermark atau sekadar 24 jam
 * lalu: ambil yang LEBIH JAUH ke belakang (lebih tua) di antara keduanya,
 * `since = min(lastImportedUntil ?? (now - 24 jam), now - 24 jam)`. Kalau
 * cron sempat gagal/terlewat beberapa hari, watermark lebih tua dari 24 jam
 * lalu akan tetap dipakai (mengejar gap), BUKAN terpotong jadi cuma 24 jam
 * terakhir seperti sebelum tiket ini.
 */
function periodicImportSince(lastImportedUntil: Date | null, now: Date): Date {
  const twentyFourHoursAgo = new Date(now.getTime() - CRON_LOOKBACK_MS);
  const candidate = lastImportedUntil ?? twentyFourHoursAgo;
  return candidate.getTime() < twentyFourHoursAgo.getTime()
    ? candidate
    : twentyFourHoursAgo;
}

/**
 * T-143.1 — rencana `since`/`limit` untuk import periodik. Akun yang belum
 * pernah sync sukses (`lastImportedUntil === null`) harus mengejar riwayat
 * penuh seperti import connect/manual (1 tahun, limit 1000); kalau tidak,
 * cron cuma meminta 24 jam terakhir dan import connect yang gagal/timeout
 * tidak pernah dipulihkan (KI-102). Akun dengan watermark memakai
 * `periodicImportSince` + `CRON_IMPORT_LIMIT` seperti sebelumnya. Watermark
 * tetap dimajukan hanya kalau batch tidak penuh (aturan di `runImportJob`).
 */
function periodicImportPlan(
  lastImportedUntil: Date | null,
  now: Date,
): { since: Date; limit: number } {
  if (lastImportedUntil === null) {
    return { since: defaultSince(now), limit: AUTO_MANUAL_IMPORT_LIMIT };
  }
  return {
    since: periodicImportSince(lastImportedUntil, now),
    limit: CRON_IMPORT_LIMIT,
  };
}

/**
 * T-143.3 — ringkasan hasil job untuk disimpan di payload `import.sync`.
 * Hanya field yang tersedia yang diisi (adapter nyata saja yang membawa
 * `counts`).
 */
function buildImportJobResult(
  limit: number,
  outcome: ImportJobOutcome,
  processed?: { insertedCount: number; skippedDuplicateCount: number },
): ImportSyncJobResult {
  return {
    limit,
    fetchedPosts: outcome.posts.length,
    ...(outcome.counts
      ? {
          outstandImported: outcome.counts.imported,
          outstandSkipped: outcome.counts.skipped,
          outstandFailed: outcome.counts.failed,
        }
      : {}),
    ...(processed
      ? {
          insertedCount: processed.insertedCount,
          skippedDuplicateCount: processed.skippedDuplicateCount,
        }
      : {}),
  };
}

/**
 * Port lokal cross-domain `publishing` → `workspace` (T-090.3, AGENTS.md
 * #7) — pola sama `WorkspaceReconnectPort`/`NotificationPort` di
 * `OutstandWebhookProcessor`/`WorkspaceService`. `WorkspaceConnectedAccount`
 * (tabel + watermark `lastImportedUntil`/`lastImportRequestedAt`) adalah
 * milik domain `workspace` — `ImportPostsTriggerUseCase` TIDAK boleh
 * mengimpor `WorkspaceService`/`workspaceRepository` konkret, composition
 * root yang menyuplai instance ini lewat constructor.
 */
interface ConnectedAccountWatermarkPort {
  updateImportWatermark(input: {
    connectedAccountId: ConnectedAccountId;
    lastImportedUntil?: Date;
    lastImportRequestedAt?: Date;
    /**
     * RLS acting user (bug fix 2026-10-08, ditemukan testing end-to-end DB
     * nyata) — `workspace_connected_accounts` dijaga RLS `FOR ALL` (migration
     * `20260813045625_t017_add_rls_policies`), jadi implementasi Prisma WAJIB
     * `withCurrentUser` supaya `updateMany` benar-benar match baris, bukan
     * silent no-op. Semua caller (`triggerAuto`/`triggerPeriodicForAccounts`/
     * `triggerManual`) sudah punya `actingUserId` di input masing-masing.
     */
    actingUserId: UserId;
  }): Promise<void>;

  /**
   * Resolusi `actingUserId` untuk jalur periodik (KI-088, resolved
   * 2026-10-15) — pola yang sama persis dengan `AnalyticsSyncOwnerLookupPort`
   * (`analytics-sync-job-handler.ts`, JOB-04) dan `EngagementSyncJobHandler`
   * (JOB-03): Railway Cron tidak punya sesi user, jadi `actingUserId`
   * di-resolve lewat Owner workspace dari akun itu sendiri (bukan
   * `Workspace.ownerId` langsung — kandidat yang disebut di versi sebelumnya
   * docstring ini, dibuang setelah King Rezi memilih reuse pola JOB-04/JOB-03
   * yang sudah teruji produksi). Structural-typing cocok dengan
   * `IWorkspaceRepository.findAccountOwnerByOutstandAccountId` — composition
   * root (`createImportPostsTriggerUseCase`) tidak perlu menyuplai dependency
   * baru, `workspaceRepository` yang sudah dipakai untuk `connectedAccounts`
   * sudah mengimplementasikan method ini juga. `null` kalau akun tidak
   * ditemukan/tidak aktif. Return shape `AccountOwnerLookupResult`
   * (`@postific/shared`, AGENTS.md #8) — satu deklarasi dipakai bersama port
   * lokal manapun yang butuh lookup ini, bukan di-retype per domain.
   */
  findAccountOwnerByOutstandAccountId(
    outstandAccountId: string,
  ): Promise<AccountOwnerLookupResult | null>;

  /**
   * Watermark saat eksekusi job antrian (T-115). `null` kalau akun tidak
   * terlihat oleh `actingUserId` (RLS).
   */
  getImportWatermark(input: {
    connectedAccountId: ConnectedAccountId;
    actingUserId: UserId;
  }): Promise<{ lastImportedUntil: Date | null } | null>;
}

export type ImportSyncTriggerOutcome =
  | "triggered"
  | "rejected_concurrent"
  | "rejected_cap"
  | "rejected_cooldown"
  | "failed";

export interface ImportSyncTriggerResult {
  outcome: ImportSyncTriggerOutcome;
  message?: string;
  importedCount?: number;
  skippedDuplicateCount?: number;
  /**
   * T-114 — jumlah `PublishingPost` Imported lama yang baru saja
   * ter-backfill `outstandPostId`-nya pada sync ini. `undefined` kalau
   * backfill tidak dijalankan sama sekali (tidak ada gap untuk akun ini,
   * ATAU `backfillUseCase` tidak diinjeksi — lihat `attemptBackfill`) atau
   * gagal (best-effort, tidak pernah menggagalkan `outcome` di atas).
   */
  backfillUpdatedCount?: number;
}

interface RunImportSyncInput {
  trigger: ImportSyncTrigger;
  workspaceId: WorkspaceId;
  connectedAccountId: ConnectedAccountId;
  outstandAccountId: string;
  platform: SocialPlatform;
  since: Date;
  /**
   * T-131 — `limit` sekarang per-trigger (bukan satu `DEFAULT_IMPORT_LIMIT`
   * untuk ketiganya): 1000 untuk auto/manual, 100 untuk periodik. Dipakai
   * baik sebagai body request `importPosts` maupun sebagai ambang
   * `isPossiblyTruncated` di `runImportJob` — HARUS angka yang SAMA dengan
   * yang benar-benar dikirim ke Outstand untuk trigger ini.
   */
  limit: number;
  /** RLS acting user — lihat catatan `IPublishingRepository.upsertImportedPosts` untuk kenapa ini boleh bukan "pemilik" post (post Imported tidak punya pemilik). */
  actingUserId: UserId;
}

export interface TriggerAutoInput {
  workspaceId: WorkspaceId;
  connectedAccountId: ConnectedAccountId;
  outstandAccountId: string;
  platform: SocialPlatform;
  /** User yang baru saja men-connect akun (`WorkspaceService.completeAccountConnection` actorId) — dipakai sebagai acting user RLS. */
  actingUserId: UserId;
}

export interface TriggerPeriodicAccountInput {
  workspaceId: WorkspaceId;
  connectedAccountId: ConnectedAccountId;
  outstandAccountId: string;
  platform: SocialPlatform;
  lastImportedUntil: Date | null;
}

export interface TriggerManualInput {
  actorRole: MemberRole;
  workspaceId: WorkspaceId;
  connectedAccountId: ConnectedAccountId;
  outstandAccountId: string;
  platform: SocialPlatform;
  actingUserId: UserId;
  lastImportedUntil: Date | null;
  lastImportRequestedAt: Date | null;
}

/**
 * JOB-05 — Import Posts Trigger (T-090.3, ADR-093 poin 7-9,
 * `background-jobs.md`). Tiga entry point berbagi satu core
 * (`runImportSync`): otomatis on-connect (`triggerAuto`, dipanggil lewat
 * port dari `WorkspaceService.completeAccountConnection`), periodik
 * (`triggerPeriodicForAccounts`, batch inline — tetap dipakai test dan
 * pemanggil yang sudah memegang daftar akun; fan-out produksi T-115 tidak
 * memanggil method ini, karena itu akan menyisipkan baris job kedua.
 * Antrian harian: `EnqueueImportSyncUseCase` + `executeQueuedPeriodicImport`.
 * `actingUserId` per akun
 * di-resolve SENDIRI oleh method ini lewat `ConnectedAccountWatermarkPort.
 * findAccountOwnerByOutstandAccountId` — KI-088, resolved 2026-10-15, lihat
 * docstring port tsb.), dan manual
 * (`triggerManual`, dipanggil Server Action "Sync Now").
 *
 * **Penyesuaian pragmatis (dicatat eksplisit, sama pola T-027 di
 * `OutstandWebhookProcessor`):** JOB-05 (trigger) dan JOB-06 (processing,
 * `ImportPostsProcessUseCase`) dipanggil SINKRON dalam SATU eksekusi
 * `runImportSync` di sini — bukan dua job terpisah lewat queue
 * `background_jobs` seperti didesripsikan `background-jobs.md`, karena job
 * runner asli (`/api/jobs/run`) belum dibangun (T-027 belum dikerjakan).
 * Baris `background_jobs` TETAP di-insert (audit log + cap-counting,
 * ADR-093 poin 7, 9) — hanya CARA ia diproses yang sinkron, bukan
 * keberadaannya. Baris antrian harian (T-115) adalah pengecualian:
 * status awal `pending`, dieksekusi runner lewat
 * `executeQueuedPeriodicImport`, bukan lewat `runImportSync`.
 *
 * **Amandemen ADR-119 (2026-10-08, rebase branch `claude/t-090-e6bb6d`
 * ke `staging`):** `FakeOutstandAdapter` sudah dihapus total dari jalur
 * produksi (ADR-119) — `getOutstandAdapter()` SELALU mengembalikan
 * `RealOutstandAdapter`, yang untuk `importPosts`/`fetchImportJobStatus`
 * masih stub-throw (endpoint Outstand belum benar-benar di-wire, lihat
 * docstring kedua method itu di `real-outstand-adapter.ts`). Konsekuensi:
 * SETIAP pemanggilan `runImportSync` SEKARANG PASTI jatuh ke `catch` di
 * bawah dan job tercatat `status: "failed"` sampai method itu benar-benar
 * diimplementasikan — ini bukan regresi, melainkan throw-loud yang
 * disengaja (semangat ADR-059/ADR-119) sampai ada keputusan lanjutan untuk
 * mengimplementasikan HTTP call sungguhan. Caller (`WorkspaceService.
 * completeAccountConnection`, Server Action `syncNowAction`) sudah
 * menangani kegagalan ini best-effort — tidak pernah menggagalkan proses
 * Connect Account yang sudah berhasil.
 *
 * Guard concurrent-import per akun (ADR-093 poin 8) ditegakkan di SEMUA
 * jalur (bukan cuma manual) — dua trigger untuk akun yang sama yang
 * tumpang tindih (mis. auto + periodik kebetulan bersamaan) tetap saling
 * menolak.
 */
export class ImportPostsTriggerUseCase {
  constructor(
    private readonly importJobs: IImportJobRepository,
    private readonly outstandAdapter: IOutstandAdapter,
    private readonly connectedAccounts: ConnectedAccountWatermarkPort,
    private readonly processUseCase: ImportPostsProcessUseCase,
    /**
     * T-114 — WAJIB (bukan opsional lagi, code-review PR #170): diposisikan
     * SEBELUM `sleep` supaya TypeScript menolak kompilasi kalau composition
     * root mana pun lupa menyuplainya, alih-alih silently no-op di
     * `attemptBackfill` seperti sebelumnya.
     */
    private readonly backfillUseCase: BackfillOutstandPostIdsUseCase,
    /**
     * T-132.4 (ADR-135) — WAJIB (bukan opsional), pola sama `backfillUseCase`
     * di atas (code-review PR #170 untuk alasan "required, bukan diam-diam
     * no-op"): klasifikasi `ContentFormat` post hasil Import dipanggil
     * SETIAP sync yang benar-benar memproses post baru, lihat
     * `attemptClassification` di bawah.
     */
    private readonly classifyUseCase: ClassifyImportedPostTargetsUseCase,
    /** Injectable sleep (test memakai versi instan) — lihat `SleepFn`/`IMPORT_STATUS_POLL_*` di atas. */
    private readonly sleep: SleepFn = defaultSleep,
  ) {}

  /**
   * Polling `fetchImportJobStatus` sampai resolve `completed`/`failed`
   * (kontrak `ImportJobStatus` di titik ini hanya punya 3 nilai — real API
   * `partial` SUDAH dipetakan jadi `"completed"` satu lapis di bawah,
   * `RealOutstandAdapter.fetchImportJobStatus`, ADR-123 — jadi method ini
   * TIDAK PERNAH melihat `"partial"`), atau sampai
   * `IMPORT_STATUS_POLL_TIMEOUT_MS` terlampaui (lihat catatan bug di atas
   * konstanta modul ini). Panggilan PERTAMA selalu terjadi SEGERA (tanpa
   * delay) — delay hanya di ANTARA percobaan berikutnya.
   */
  private async pollImportJobStatus(
    outstandAccountId: string,
    importJobId: string,
  ): Promise<ImportJobOutcome> {
    const startedAt = Date.now();
    let outcome = await this.outstandAdapter.fetchImportJobStatus(
      outstandAccountId,
      importJobId,
    );

    while (
      outcome.status === "pending" &&
      Date.now() - startedAt < IMPORT_STATUS_POLL_TIMEOUT_MS
    ) {
      await this.sleep(IMPORT_STATUS_POLL_INTERVAL_MS);
      outcome = await this.outstandAdapter.fetchImportJobStatus(
        outstandAccountId,
        importJobId,
      );
    }

    return outcome;
  }

  /** Otomatis on-connect (ADR-093 poin 7, T-131.1) — `since` SELALU 1 tahun ke belakang (`lastImportedUntil` dijamin kosong, akun baru dibuat), `limit` 1000. */
  async triggerAuto(input: TriggerAutoInput): Promise<ImportSyncTriggerResult> {
    return this.runImportSync({
      trigger: "auto",
      workspaceId: input.workspaceId,
      connectedAccountId: input.connectedAccountId,
      outstandAccountId: input.outstandAccountId,
      platform: input.platform,
      since: defaultSince(new Date()),
      limit: AUTO_MANUAL_IMPORT_LIMIT,
      actingUserId: input.actingUserId,
    });
  }

  /**
   * Periodik (ADR-093 poin 7, Railway Cron harian — wiring cron asli di
   * luar scope T-090) — dipanggil per batch akun `active` yang sudah
   * di-resolve caller. Satu kegagalan/penolakan pada satu akun TIDAK
   * menghentikan akun lain dalam batch (`Promise.allSettled`-style,
   * manual try/catch per akun) — konsisten semangat JOB-03/JOB-04
   * (`background-jobs.md`: satu job per `ConnectedAccount`, independen).
   *
   * **`actingUserId` (KI-088, resolved 2026-10-15)** — jalur ini TIDAK
   * punya sesi/user manusia (Railway Cron), jadi di-resolve DI SINI per akun
   * lewat `resolveVerifiedAccountOwner` (`@/lib/jobs/account-owner-resolution`
   * — rationale lengkap di docstring `ConnectedAccountWatermarkPort.
   * findAccountOwnerByOutstandAccountId` di atas). Lookup gagal/akun tidak
   * aktif/mismatch ditangani sama seperti kegagalan lain di batch ini —
   * masuk `catch`, tidak menghentikan akun lain.
   */
  async triggerPeriodicForAccounts(
    accounts: TriggerPeriodicAccountInput[],
  ): Promise<Map<ConnectedAccountId, ImportSyncTriggerResult>> {
    const results = new Map<ConnectedAccountId, ImportSyncTriggerResult>();

    for (const account of accounts) {
      try {
        const owner = await resolveVerifiedAccountOwner(
          this.connectedAccounts,
          account.outstandAccountId,
          {
            workspaceId: account.workspaceId,
            connectedAccountId: account.connectedAccountId,
          },
          "triggerPeriodicForAccounts",
        );

        const plan = periodicImportPlan(account.lastImportedUntil, new Date());
        const result = await this.runImportSync({
          trigger: "periodic",
          workspaceId: account.workspaceId,
          connectedAccountId: account.connectedAccountId,
          outstandAccountId: account.outstandAccountId,
          platform: account.platform,
          since: plan.since,
          limit: plan.limit,
          actingUserId: owner.ownerUserId,
        });
        results.set(account.connectedAccountId, result);
      } catch (error) {
        results.set(account.connectedAccountId, {
          outcome: "failed",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Manual "Sync Now" (ADR-093 poin 9) — TIGA lapis pengaman biaya, SEMUA
   * dicek SEBELUM `runImportSync` (jadi ditolak tidak pernah membuat baris
   * `background_jobs`/memanggil Outstand sama sekali):
   * 1. RBAC Owner/Admin (`assertActorCanTriggerManualImportSync`).
   * 2. Cap mingguan workspace (paling dominan, dicek LEBIH DULU dari
   *    cooldown per-akun — ADR-093 poin 9 eksplisit "guard ini paling
   *    dominan").
   * 3. Cooldown 24 jam per akun.
   * Guard concurrent-import (poin 8) tetap dicek di `runImportSync` sendiri
   * (lapis ke-4, berlaku semua jalur).
   */
  async triggerManual(
    input: TriggerManualInput,
  ): Promise<ImportSyncTriggerResult> {
    assertActorCanTriggerManualImportSync(input.actorRole);

    const now = new Date();

    const manualCountThisWeek =
      await this.importJobs.countManualImportSyncJobsSince(
        input.workspaceId,
        new Date(now.getTime() - MANUAL_CAP_WINDOW_MS),
      );
    if (manualCountThisWeek >= 1) {
      return {
        outcome: "rejected_cap",
        message:
          "Workspace ini sudah memakai jatah sinkronisasi impor manual minggu ini. Coba lagi minggu depan.",
      };
    }

    if (input.lastImportRequestedAt) {
      const elapsedMs = now.getTime() - input.lastImportRequestedAt.getTime();
      if (elapsedMs < MANUAL_COOLDOWN_MS) {
        const retryAt = new Date(
          input.lastImportRequestedAt.getTime() + MANUAL_COOLDOWN_MS,
        );
        return {
          outcome: "rejected_cooldown",
          message: `Akun ini baru saja disinkronkan. Coba lagi setelah ${retryAt.toISOString()}.`,
        };
      }
    }

    return this.runImportSync({
      trigger: "manual",
      workspaceId: input.workspaceId,
      connectedAccountId: input.connectedAccountId,
      outstandAccountId: input.outstandAccountId,
      platform: input.platform,
      // T-131.2 — tetap watermark kalau ada; default 1 tahun (bukan 90 hari
      // lagi) kalau akun belum pernah sukses diimpor, konsisten T-131.1.
      since: input.lastImportedUntil ?? defaultSince(now),
      limit: AUTO_MANUAL_IMPORT_LIMIT,
      actingUserId: input.actingUserId,
    });
  }

  /**
   * Eksekusi baris antrian `import.sync` yang SUDAH ada (T-115) — job yang
   * baru diklaim runner (`status: running`, `payload.queued: true`).
   *
   * Tidak memanggil `runImportSync` / `triggerPeriodicForAccounts`: keduanya
   * menyisipkan baris baru dan menabrak unique index akun ini. Guard
   * concurrent tetap berlaku untuk job aktif LAIN; baris yang sedang
   * di-handle adalah job itu sendiri, jadi tidak ditolak.
   *
   * `since` dihitung saat eksekusi dari watermark (`periodicImportSince`),
   * bukan dari placeholder payload enqueue. Kegagalan dilempar supaya
   * runner retry/dead-letter — tidak ditelan seperti batch inline.
   */
  async executeQueuedPeriodicImport(input: {
    jobId: string;
    workspaceId: WorkspaceId;
    connectedAccountId: ConnectedAccountId;
    outstandAccountId: string;
    platform: SocialPlatform;
  }): Promise<void> {
    const owner = await resolveVerifiedAccountOwner(
      this.connectedAccounts,
      input.outstandAccountId,
      {
        workspaceId: input.workspaceId,
        connectedAccountId: input.connectedAccountId,
      },
      "executeQueuedPeriodicImport",
    );

    const watermark = await this.connectedAccounts.getImportWatermark({
      connectedAccountId: input.connectedAccountId,
      actingUserId: owner.ownerUserId,
    });
    if (!watermark) {
      throw new Error(
        `executeQueuedPeriodicImport: watermark akun ${input.connectedAccountId} tidak ditemukan.`,
      );
    }

    // `jobId` datang dari `JobHandler`/`job-runner.ts` (baris yang BENAR-BENAR
    // diklaim runner) — bukan di-derive dari `connectedAccountId`, supaya
    // tidak salah ambil baris lain kalau suatu saat ada lebih dari satu job
    // `running` untuk akun ini.
    const job = await this.importJobs.findImportSyncJobById(input.jobId);
    if (
      !job ||
      job.payload.queued !== true ||
      job.payload.trigger !== "periodic" ||
      job.payload.connectedAccountId !== input.connectedAccountId
    ) {
      throw new Error(
        `executeQueuedPeriodicImport: tidak menemukan job ${IMPORT_SYNC_JOB_TYPE} running queued periodic jobId=${input.jobId} untuk connectedAccountId=${input.connectedAccountId}.`,
      );
    }

    const until = new Date();
    const plan = periodicImportPlan(watermark.lastImportedUntil, until);
    const runInput: RunImportSyncInput = {
      trigger: "periodic",
      workspaceId: input.workspaceId,
      connectedAccountId: input.connectedAccountId,
      outstandAccountId: input.outstandAccountId,
      platform: input.platform,
      since: plan.since,
      limit: plan.limit,
      actingUserId: owner.ownerUserId,
    };

    await this.connectedAccounts.updateImportWatermark({
      connectedAccountId: input.connectedAccountId,
      lastImportRequestedAt: until,
      actingUserId: owner.ownerUserId,
    });

    const result = await this.runImportJob(runInput, job, until);
    await this.attemptBackfill(runInput);
    if (result.outcome === "failed") {
      throw new Error(result.message ?? "Import periodik antrian gagal.");
    }
  }

  private async runImportSync(
    input: RunImportSyncInput,
  ): Promise<ImportSyncTriggerResult> {
    const hasActive = await this.importJobs.hasActiveImportSyncJob(
      input.connectedAccountId,
    );
    if (hasActive) {
      return {
        outcome: "rejected_concurrent",
        message:
          "Sinkronisasi impor untuk akun ini sedang berjalan — coba lagi setelah selesai.",
      };
    }

    const until = new Date();
    let job;
    try {
      job = await this.importJobs.createImportSyncJob({
        workspaceId: input.workspaceId,
        connectedAccountId: input.connectedAccountId,
        outstandAccountId: input.outstandAccountId,
        trigger: input.trigger,
        since: input.since.toISOString(),
        until: until.toISOString(),
      });
    } catch (error) {
      // Code review PR #148 (finding #2) — pre-check `hasActiveImportSyncJob`
      // di atas adalah soft check (TOCTOU: dua trigger nyaris bersamaan bisa
      // sama-sama lolos sebelum salah satunya sempat insert). Partial unique
      // index `background_jobs_active_import_sync_account_key` adalah gate
      // sebenarnya — `createImportSyncJob` menerjemahkannya ke
      // `ConflictError`, yang ditangkap di sini sebagai penolakan normal,
      // bukan error tak tertangani.
      if (error instanceof ConflictError) {
        return {
          outcome: "rejected_concurrent",
          message:
            "Sinkronisasi impor untuk akun ini sedang berjalan — coba lagi setelah selesai.",
        };
      }
      throw error;
    }

    // T-115 — `running` sebelum network call. Cron hanya mengklaim
    // `pending` (atau `running` yang stale > 30 detik). Job inline yang
    // dibiarkan `pending` selama polling Outstand (sampai 25 detik) bisa
    // diambil runner dan dead-letter karena bukan payload queued.
    await this.importJobs.markImportSyncJobStatus(job.id, "running");

    // `lastImportRequestedAt` di-update SETIAP KALI import direquest, dari
    // jalur manapun (ADR-093 poin 6) — SEBELUM network call, konsisten
    // "persist dulu, network call sesudah".
    await this.connectedAccounts.updateImportWatermark({
      connectedAccountId: input.connectedAccountId,
      lastImportRequestedAt: until,
      actingUserId: input.actingUserId,
    });

    const result = await this.runImportJob(input, job, until);

    // T-114 — backfill otomatis `outstandPostId` post Imported lama,
    // dipanggil SETIAP sync (manual/periodik) yang benar-benar berjalan
    // (lolos guard concurrency di atas, sampai titik ini) — INDEPENDEN dari
    // sukses/gagalnya job import utama di atas (`result.outcome` bisa
    // `"triggered"` ATAU `"failed"`, backfill tetap dicoba: gap lama tidak
    // ada hubungannya dengan apakah import post BARU kali ini berhasil).
    // Best-effort (lihat `attemptBackfill`) — tidak pernah melempar atau
    // menimpa `result.outcome`/`message` di atas, hanya menambahkan
    // `backfillUpdatedCount` kalau backfill benar-benar berjalan.
    const backfillUpdatedCount = await this.attemptBackfill(input);
    return backfillUpdatedCount === undefined
      ? result
      : { ...result, backfillUpdatedCount };
  }

  /**
   * Eksekusi inti JOB-05+JOB-06 (`importPosts` → poll `fetchImportJobStatus`
   * → `ImportPostsProcessUseCase.process` → watermark/job bookkeeping) —
   * diekstrak dari `runImportSync` (T-114) supaya backfill T-114 bisa
   * dijalankan SETELAH method ini selesai apa pun hasilnya (sukses atau
   * `catch` di bawah), tanpa menduplikasi logika backfill di dua tempat.
   * Perilaku method ini sendiri TIDAK berubah dari sebelum T-114.
   */
  private async runImportJob(
    input: RunImportSyncInput,
    job: ImportSyncJobRecord,
    until: Date,
  ): Promise<ImportSyncTriggerResult> {
    try {
      const handle = await this.outstandAdapter.importPosts(
        input.outstandAccountId,
        { since: input.since, until, limit: input.limit },
      );
      const jobOutcome = await this.pollImportJobStatus(
        input.outstandAccountId,
        handle.importJobId,
      );

      if (jobOutcome.status !== "completed") {
        // `"pending"` di titik ini (bukan `"completed"`/`"failed"`) berarti
        // polling di atas HABIS WAKTU (25 detik) sementara Outstand masih
        // `queued`/`running` — beda dari kegagalan sungguhan, pesannya
        // sengaja dibedakan supaya user tahu ini bukan error permanen.
        // Code review PR #149 — TIDAK menjanjikan jendela waktu retry
        // spesifik ("beberapa menit") di sini: untuk trigger `manual`,
        // `lastImportRequestedAt` SUDAH diupdate di atas SEBELUM polling
        // ini (persist-dulu, ADR-093 poin 6) — `triggerManual` akan tetap
        // menegakkan `MANUAL_COOLDOWN_MS` (24 jam) pada percobaan
        // berikutnya walau job ini gagal karena timeout, bukan kegagalan
        // permanen. Menjanjikan retry cepat di sini akan kontradiksi
        // dengan guard cooldown yang sungguhan berlaku.
        const message =
          jobOutcome.status === "pending"
            ? "Import masih diproses di Outstand setelah menunggu 25 detik. Job ini ditandai gagal untuk sementara di sisi kita, tapi proses di Outstand TIDAK dibatalkan — coba Sync Now lagi nanti (jatah cooldown akun ini tetap berlaku seperti biasa)."
            : (jobOutcome.error ??
              `Import job berstatus "${jobOutcome.status}".`);
        await this.importJobs.markImportSyncJobStatus(
          job.id,
          "failed",
          message,
          buildImportJobResult(input.limit, jobOutcome),
        );
        return { outcome: "failed", message };
      }

      const processed = await this.processUseCase.process({
        workspaceId: input.workspaceId,
        connectedAccountId: input.connectedAccountId,
        platform: input.platform,
        posts: jobOutcome.posts,
        actingUserId: input.actingUserId,
      });

      // T-132.4 (ADR-135) — klasifikasi `ContentFormat` (Post/Reel/Story)
      // untuk SEMUA post pada batch sync ini (`jobOutcome.posts`, BUKAN
      // seluruh riwayat Imported akun), dipanggil SETELAH process() di atas
      // selesai (apa pun hasilnya — `processed` tetap valid walau sebagian
      // post di batch ini duplikat/sudah ada). Best-effort, lihat
      // `attemptClassification` — gagal di sini tidak pernah menggagalkan
      // import yang sudah berhasil di atas.
      await this.attemptClassification(input, jobOutcome.posts);

      // Code review PR #149 — `jobOutcome.error` di titik ini (status
      // SUDAH `"completed"`) hanya terisi untuk kasus real API `partial`
      // (lihat `RealOutstandAdapter.fetchImportJobStatus`, ADR-123): post
      // yang berhasil TETAP diproses di atas, tapi job ini TIDAK 100%
      // sukses. Sebelumnya info ini didiamkan (job tercatat `"done"` polos,
      // tidak ada jejak sama sekali) — sekarang disimpan sebagai
      // `lastError` job (status tetap `"done"`, BUKAN `"failed"` — post
      // yang berhasil memang berhasil) dan diteruskan ke caller lewat
      // `message`, supaya UI/log punya jejak kegagalan sebagian ini.
      const partialWarning = jobOutcome.error ?? undefined;

      // Code review PR #148 (finding #5) — `IOutstandAdapter.importPosts`
      // tidak punya cursor/next-page (kontrak `packages/shared`), jadi
      // kalau hasil batch ini PAS sejumlah `input.limit` (T-131 — limit kini
      // per-trigger, bukan satu `DEFAULT_IMPORT_LIMIT` lagi), mungkin masih
      // ada post lain dalam rentang `since`-`until` yang belum terambil.
      // Watermark HANYA dimajukan ke `until` kalau batch ini TIDAK penuh
      // (berarti seluruh rentang sudah habis) — kalau penuh, watermark
      // dibiarkan apa adanya supaya trigger berikutnya mengulang rentang
      // yang sama (aman berkat dedup `upsertImportedPosts`) daripada diam-
      // diam melompati sisa post yang belum terambil.
      const isPossiblyTruncated = jobOutcome.posts.length >= input.limit;
      if (!isPossiblyTruncated) {
        // `lastImportedUntil` ke nilai `until` yang DIPAKAI job ini (ADR-093
        // poin 7) — BUKAN publishedAt post terbaru, supaya trigger berikutnya
        // tidak pernah menarik ulang rentang yang sama walau batch ini
        // kosong (0 post baru).
        await this.connectedAccounts.updateImportWatermark({
          connectedAccountId: input.connectedAccountId,
          lastImportedUntil: until,
          actingUserId: input.actingUserId,
        });
      }

      await this.importJobs.markImportSyncJobStatus(
        job.id,
        "done",
        partialWarning,
        buildImportJobResult(input.limit, jobOutcome, processed),
      );

      return {
        outcome: "triggered",
        importedCount: processed.insertedCount,
        skippedDuplicateCount: processed.skippedDuplicateCount,
        message: partialWarning,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await this.importJobs.markImportSyncJobStatus(
          job.id,
          "failed",
          message,
          // T-143.3 — job yang gagal lewat exception tetap mencatat limit
          // supaya kasus terpotong bisa dibuktikan ulang.
          { limit: input.limit },
        );
      } catch {
        // Code review PR #148 (finding #4) — kalau PENULISAN status gagal
        // ini sendiri gagal (mis. DB error transient), jangan biarkan
        // exception ini menimpa `message` asli dan propagate tak
        // tertangani — baris job tetap `pending`/`running` untuk sementara,
        // tapi `hasActiveImportSyncJob` sekarang punya `staleAfterMs`
        // (lihat Prisma impl) supaya guard ini tidak mengunci akun ini
        // selamanya.
      }
      return { outcome: "failed", message };
    }
  }

  /**
   * T-114 — attempt backfill `outstandPostId` post Imported lama untuk akun
   * ini. `undefined` kalau tidak ada gap untuk akun ini (cek existence
   * murah di `BackfillOutstandPostIdsUseCase.backfillIfNeeded`), atau
   * backfill gagal — kegagalan DITANGKAP di sini (best-effort, pola sama
   * `completeAccountConnection`/`syncNowAction` menangani kegagalan
   * `runImportSync` itu sendiri): backfill murni perbaikan data lama, satu
   * kali gagal (mis. Outstand rate-limit sesaat) tidak boleh menggagalkan
   * sync utama yang sudah berhasil, cukup dicoba lagi di sync berikutnya
   * (existence check tetap `true` sampai benar-benar berhasil).
   */
  private async attemptBackfill(
    input: RunImportSyncInput,
  ): Promise<number | undefined> {
    try {
      const outcome = await this.backfillUseCase.backfillIfNeeded({
        workspaceId: input.workspaceId,
        connectedAccountId: input.connectedAccountId,
        outstandAccountId: input.outstandAccountId,
        actingUserId: input.actingUserId,
      });
      return outcome.backfilled ? outcome.updatedCount : undefined;
    } catch (error) {
      console.warn(
        `[ImportPostsTriggerUseCase] T-114 backfill outstandPostId gagal untuk akun ${input.connectedAccountId}: ${error instanceof Error ? error.message : String(error)} — best-effort, tidak menggagalkan sync utama.`,
      );
      return undefined;
    }
  }

  /**
   * T-132.4 (ADR-135) — klasifikasi `ContentFormat` untuk batch post yang
   * baru diproses `ImportPostsProcessUseCase.process` pada sync ini.
   * Kegagalan (network Outstand, atau kegagalan tak terduga lain) DITANGKAP
   * di sini — best-effort, pola sama `attemptBackfill`: klasifikasi murni
   * perbaikan data, gagal sekali (mis. Outstand rate-limit sesaat) tidak
   * boleh menggagalkan sync import yang sudah berhasil. Beda dari
   * `attemptBackfill`, TIDAK ada existence check terpisah — method ini
   * SELALU dipanggil setiap `runImportJob` berhasil sampai titik ini
   * (`jobOutcome.posts` adalah daftar post YANG BARU diproses, bisa kosong).
   */
  private async attemptClassification(
    input: RunImportSyncInput,
    posts: ImportJobOutcome["posts"],
  ): Promise<void> {
    if (posts.length === 0) return;
    try {
      await this.classifyUseCase.classifyBatch({
        workspaceId: input.workspaceId,
        connectedAccountId: input.connectedAccountId,
        platform: input.platform,
        posts,
        actingUserId: input.actingUserId,
      });
    } catch (error) {
      console.warn(
        `[ImportPostsTriggerUseCase] T-132.4 klasifikasi ContentFormat gagal untuk akun ${input.connectedAccountId}: ${error instanceof Error ? error.message : String(error)} — best-effort, tidak menggagalkan sync utama.`,
      );
    }
  }
}
