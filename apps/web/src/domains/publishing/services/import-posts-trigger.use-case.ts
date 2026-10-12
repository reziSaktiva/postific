import type {
  ConnectedAccountId,
  ImportJobOutcome,
  IOutstandAdapter,
  MemberRole,
  SocialPlatform,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import { ConflictError } from "@/lib/utils/errors";
import { assertActorCanTriggerManualImportSync } from "../rbac";
import type {
  IImportJobRepository,
  ImportSyncTrigger,
} from "../repositories/import-job.repository";
import type { ImportPostsProcessUseCase } from "./import-posts-process.use-case";

const DEFAULT_IMPORT_LOOKBACK_DAYS = 90;
const DEFAULT_IMPORT_LIMIT = 100;
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

function defaultSince(now: Date): Date {
  return new Date(
    now.getTime() - DEFAULT_IMPORT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );
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
}

interface RunImportSyncInput {
  trigger: ImportSyncTrigger;
  workspaceId: WorkspaceId;
  connectedAccountId: ConnectedAccountId;
  outstandAccountId: string;
  platform: SocialPlatform;
  since: Date;
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
  /**
   * **Gap diketahui (dilaporkan ke King Rezi, bukan diputuskan sepihak):**
   * trigger periodik (Railway Cron) tidak punya sesi/user manusia — RLS
   * `publishing_posts_workspace_isolation` tetap butuh `app.current_user_id`
   * berupa member AKTIF workspace itu. Caller (handler cron, belum
   * diwiring — di luar scope T-090) wajib me-resolve user ini sendiri
   * (kandidat paling sederhana: Account Owner workspace) SEBELUM memanggil
   * `triggerPeriodicForAccounts`; use-case ini tidak membuat keputusan itu
   * sendiri karena butuh akses domain `workspace` (cross-domain, AGENTS.md
   * #7).
   */
  actingUserId: UserId;
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
 * (`triggerPeriodicForAccounts`, menerima list akun `active` — caller yang
 * meresolve daftarnya, TIDAK ada Railway Cron wiring asli di sini, lihat
 * catatan T-090 di `tasks/v02-publishing-mvp.md`), dan manual
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
 * keberadaannya.
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

  /** Otomatis on-connect (ADR-093 poin 7) — `since` SELALU 90 hari ke belakang (`lastImportedUntil` dijamin kosong, akun baru dibuat). */
  async triggerAuto(input: TriggerAutoInput): Promise<ImportSyncTriggerResult> {
    return this.runImportSync({
      trigger: "auto",
      workspaceId: input.workspaceId,
      connectedAccountId: input.connectedAccountId,
      outstandAccountId: input.outstandAccountId,
      platform: input.platform,
      since: defaultSince(new Date()),
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
   */
  async triggerPeriodicForAccounts(
    accounts: TriggerPeriodicAccountInput[],
  ): Promise<Map<ConnectedAccountId, ImportSyncTriggerResult>> {
    const results = new Map<ConnectedAccountId, ImportSyncTriggerResult>();

    for (const account of accounts) {
      try {
        const result = await this.runImportSync({
          trigger: "periodic",
          workspaceId: account.workspaceId,
          connectedAccountId: account.connectedAccountId,
          outstandAccountId: account.outstandAccountId,
          platform: account.platform,
          since: account.lastImportedUntil ?? defaultSince(new Date()),
          actingUserId: account.actingUserId,
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
      since: input.lastImportedUntil ?? defaultSince(now),
      actingUserId: input.actingUserId,
    });
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

    // `lastImportRequestedAt` di-update SETIAP KALI import direquest, dari
    // jalur manapun (ADR-093 poin 6) — SEBELUM network call, konsisten
    // "persist dulu, network call sesudah".
    await this.connectedAccounts.updateImportWatermark({
      connectedAccountId: input.connectedAccountId,
      lastImportRequestedAt: until,
      actingUserId: input.actingUserId,
    });

    try {
      const handle = await this.outstandAdapter.importPosts(
        input.outstandAccountId,
        { since: input.since, until, limit: DEFAULT_IMPORT_LIMIT },
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
      // kalau hasil batch ini PAS sejumlah `DEFAULT_IMPORT_LIMIT`, mungkin
      // masih ada post lain dalam rentang `since`-`until` yang belum
      // terambil. Watermark HANYA dimajukan ke `until` kalau batch ini
      // TIDAK penuh (berarti seluruh rentang sudah habis) — kalau penuh,
      // watermark dibiarkan apa adanya supaya trigger berikutnya mengulang
      // rentang yang sama (aman berkat dedup `upsertImportedPosts`)
      // daripada diam-diam melompati sisa post yang belum terambil.
      const isPossiblyTruncated =
        jobOutcome.posts.length >= DEFAULT_IMPORT_LIMIT;
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
}
