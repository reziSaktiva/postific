import {
  asConnectedAccountId,
  asWorkspaceId,
  type UserId,
} from "@postific/shared";
import type { IJobScheduler } from "../adapters/job-scheduler";
import type { SyncCommentsUseCase } from "./sync-comments.use-case";

/**
 * Job type registry (T-051) — `background-jobs.md` § JOB-03 sudah
 * mendaftarkan tipe ini secara resmi sejak penulisan dokumen itu (beda dari
 * `RESOLVE_SCHEDULED_POST_OUTCOME_JOB_TYPE` di `publishing` yang butuh ADR
 * baru) — tidak perlu pelaporan ADR terpisah untuk konstanta ini.
 */
export const ENGAGEMENT_SYNC_JOB_TYPE = "engagement.sync";

/** Siklus sync JOB-03 — "Railway Cron (periodik, setiap 30 menit)" (`background-jobs.md` § JOB-03). */
const SYNC_INTERVAL_MS = 30 * 60 * 1000;

export interface EngagementSyncJobPayload {
  workspaceId: string;
  connectedAccountId: string;
  outstandAccountId: string;
}

function parsePayload(payload: unknown): EngagementSyncJobPayload {
  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as { workspaceId?: unknown }).workspaceId !== "string" ||
    typeof (payload as { connectedAccountId?: unknown }).connectedAccountId !==
      "string" ||
    typeof (payload as { outstandAccountId?: unknown }).outstandAccountId !==
      "string"
  ) {
    throw new Error(
      `Payload job "${ENGAGEMENT_SYNC_JOB_TYPE}" tidak valid — diharapkan ` +
        `{ workspaceId: string, connectedAccountId: string, outstandAccountId: string }, ` +
        `dapat: ${JSON.stringify(payload)}`,
    );
  }
  return payload as EngagementSyncJobPayload;
}

/**
 * Port lokal cross-domain `engagement` → `workspace` (T-051) — resolves
 * acting `userId` untuk `SyncCommentsUseCase.sync`. Job periodik ini TIDAK
 * punya Better Auth session (payload JOB-03 resmi `background-jobs.md`
 * juga tidak menyertakan `userId`) — chicken-and-egg yang SAMA dengan
 * webhook Outstand T-026 (`OutstandWebhookProcessor`/`WorkspaceReconnectPort`):
 * tidak ada acting user yang legitimate untuk `withCurrentUser` sebelum
 * SATU user ditemukan. Preseden T-026.5 (`markAccountReconnectRequired`)
 * sudah menyediakan SECURITY DEFINER lookup persis untuk kasus ini — Owner
 * workspace by `outstandAccountId`, dijamin member aktif di workspace-nya
 * sendiri. Diekspos di sini sebagai read-only variant
 * (`IWorkspaceRepository.findAccountOwnerByOutstandAccountId`, T-051) TANPA
 * efek samping `reconnectRequired`. `engagement` TIDAK mengimpor
 * `WorkspaceService`/`workspaceRepository` konkret — composition root (job
 * route) menyuplai instance lewat constructor, pola sama
 * `WorkspaceReconnectPort` di `OutstandWebhookProcessor`.
 */
export interface WorkspaceOwnerLookupPort {
  findAccountOwnerByOutstandAccountId(outstandAccountId: string): Promise<{
    workspaceId: string;
    connectedAccountId: string;
    ownerUserId: UserId;
    /**
     * Redesain KI-068/ADR-113 — `handle` (`WorkspaceConnectedAccount.handle`)
     * dibutuhkan untuk mengisi `SyncCommentsPayload.accountUsername` (API
     * resmi Outstand butuh username untuk `fetchComments`, bukan lagi
     * `outstandAccountId`).
     */
    handle: string;
  } | null>;
}

/**
 * Job handler JOB-03 Engagement Sync (T-051, `background-jobs.md`). Reuse
 * `SyncCommentsUseCase.sync` untuk logic sync MURNI (fetch, upsert
 * idempoten, notifikasi aggregate) — handler ini HANYA menambahkan dua hal
 * yang genuinely baru dibanding preseden `publishing` (JOB-07, enqueue
 * SEKALI, bukan self-rescheduling):
 *
 * 1. **Resolve acting user** lewat `WorkspaceOwnerLookupPort` (lihat
 *    catatan di sana) — dibutuhkan SEBELUM `sync()` bisa menulis
 *    `EngagementInboxItem` apa pun (RLS).
 * 2. **Self-reschedule** — setelah `sync()` SUKSES, SATU job baru dengan
 *    tipe+payload SAMA di-enqueue lewat `IJobScheduler`,
 *    `scheduledAt = now + 30 menit`. Siklus berjalan terus selama tidak
 *    ada error permanen (kalau `sync()`/lookup throw, job runner
 *    (`background-jobs.md`: "Retry maksimal 2 kali, interval 10 menit")
 *    menangani retry seperti biasa; job berikutnya BARU di-enqueue setelah
 *    percobaan ini berhasil, bukan sebelumnya).
 *
 * **Akun tidak ditemukan** (`findAccountOwnerByOutstandAccountId` return
 * `null`) — dianggap anomali (payload JOB-03 seharusnya selalu merujuk akun
 * yang masih ada saat di-enqueue), handler throw supaya job runner retry;
 * TIDAK self-reschedule (siklus untuk akun yang sudah tidak ada berhenti
 * dengan sendirinya setelah `maxAttempts` habis — dead-letter, bukan
 * perilaku salah, konsisten pola `ResolveScheduledPostOutcomeJobHandler`
 * membiarkan job "tidak relevan lagi" berhenti).
 *
 * **Seeding job pertama untuk `ConnectedAccount` baru** (Temuan #1 review
 * Ridwan Architecture Reviewer, T-051): handler ini HANYA memproses SATU
 * payload yang sudah di-enqueue oleh pemanggil, tidak mem-bootstrap job
 * untuk seluruh akun aktif — itu tetap benar. Tapi seeding job PERTAMA
 * (sebelum handler ini pernah punya sesuatu untuk di-reschedule) TIDAK lagi
 * "di luar scope" begitu saja: `WorkspaceService.completeAccountConnection`
 * (`domains/workspace/services/workspace.service.ts`, via
 * `EngagementSyncSeederPort` + composition root
 * `createWorkspaceServiceWithOutstandAdapter`) sekarang men-enqueue job
 * `engagement.sync` PERTAMA persis saat `ConnectedAccount` created/activated
 * (`background-jobs.md` § "Workspace BC → Background Job"), konsisten
 * dengan baseline dokumen itu. Manual refresh (T-052) tetap TIDAK
 * mem-bootstrap apa pun — ia memanggil `SyncCommentsUseCase.sync` langsung
 * tanpa lewat handler ini sama sekali.
 */
export class EngagementSyncJobHandler {
  constructor(
    private readonly useCase: SyncCommentsUseCase,
    private readonly jobScheduler: IJobScheduler,
    private readonly workspaceOwner: WorkspaceOwnerLookupPort,
  ) {}

  async handle(rawPayload: unknown): Promise<void> {
    const payload = parsePayload(rawPayload);

    const owner = await this.workspaceOwner.findAccountOwnerByOutstandAccountId(
      payload.outstandAccountId,
    );
    if (!owner) {
      throw new Error(
        `EngagementSyncJobHandler: outstandAccountId=${payload.outstandAccountId} ` +
          `tidak ditemukan — akun mungkin sudah di-disconnect/dihapus.`,
      );
    }
    if (
      owner.workspaceId !== payload.workspaceId ||
      owner.connectedAccountId !== payload.connectedAccountId
    ) {
      // Defense-in-depth (konsisten guard `findPostTargetsByOutstandPostId`/
      // `markAccountReconnectRequired`) — payload job seharusnya selalu
      // konsisten dengan lookup live, drift berarti data stale/salah.
      throw new Error(
        `EngagementSyncJobHandler: payload (workspaceId=${payload.workspaceId}, ` +
          `connectedAccountId=${payload.connectedAccountId}) tidak cocok dengan hasil lookup ` +
          `(workspaceId=${owner.workspaceId}, connectedAccountId=${owner.connectedAccountId}) ` +
          `untuk outstandAccountId=${payload.outstandAccountId}.`,
      );
    }

    await this.useCase.sync(
      {
        workspaceId: asWorkspaceId(payload.workspaceId),
        connectedAccountId: asConnectedAccountId(payload.connectedAccountId),
        accountUsername: owner.handle,
      },
      owner.ownerUserId,
    );

    // Self-reschedule (T-051, genuinely baru — lihat catatan class ini):
    // HANYA di sini, BUKAN di dalam `SyncCommentsUseCase.sync`, supaya
    // method itu tetap reusable untuk manual refresh (T-052) yang TIDAK
    // self-reschedule.
    await this.jobScheduler.scheduleJob({
      type: ENGAGEMENT_SYNC_JOB_TYPE,
      payload: {
        workspaceId: payload.workspaceId,
        connectedAccountId: payload.connectedAccountId,
        outstandAccountId: payload.outstandAccountId,
      },
      scheduledAt: new Date(Date.now() + SYNC_INTERVAL_MS),
    });
  }
}
