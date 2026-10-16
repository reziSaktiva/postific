import {
  asConnectedAccountId,
  asWorkspaceId,
  SocialPlatform,
  type ConnectedAccountId,
  type WorkspaceId,
} from "@postific/shared";

/**
 * Job type registry JOB-05 (T-115). String yang sama dipakai baris
 * `background_jobs` inline (`runImportSync`) dan baris antrian harian.
 * Satu konstanta supaya repository Prisma tidak meng-hardcode literal
 * kedua.
 */
export const IMPORT_SYNC_JOB_TYPE = "import.sync";

const PLATFORMS = new Set<string>(Object.values(SocialPlatform));

export interface QueuedPeriodicImportExecutor {
  executeQueuedPeriodicImport(input: {
    jobId: string;
    workspaceId: WorkspaceId;
    connectedAccountId: ConnectedAccountId;
    outstandAccountId: string;
    platform: SocialPlatform;
  }): Promise<void>;
}

interface QueuedPeriodicImportPayload {
  workspaceId: string;
  connectedAccountId: string;
  outstandAccountId: string;
  platform: SocialPlatform;
}

function invalidPayload(payload: unknown): Error {
  return new Error(
    `Payload job "${IMPORT_SYNC_JOB_TYPE}" tidak valid — diharapkan ` +
      `{ trigger: "periodic", queued: true, workspaceId, connectedAccountId, ` +
      `outstandAccountId, platform }, dapat: ${JSON.stringify(payload)}`,
  );
}

function notRunnerJob(payload: { trigger?: unknown; queued?: unknown }): Error {
  return new Error(
    `Job "${IMPORT_SYNC_JOB_TYPE}" ini bukan milik runner — hanya payload ` +
      `queued periodic (queued: true, trigger: "periodic") yang dieksekusi ` +
      `di sini. Job inline manual/auto/periodik ditandai running oleh ` +
      `runImportSync dan tidak boleh diklaim. Dapat trigger=${String(payload.trigger)}, ` +
      `queued=${String(payload.queued)}.`,
  );
}

function parsePayload(payload: unknown): QueuedPeriodicImportPayload {
  if (typeof payload !== "object" || payload === null) {
    throw invalidPayload(payload);
  }

  const record = payload as {
    trigger?: unknown;
    queued?: unknown;
    workspaceId?: unknown;
    connectedAccountId?: unknown;
    outstandAccountId?: unknown;
    platform?: unknown;
  };

  if (record.queued !== true || record.trigger !== "periodic") {
    throw notRunnerJob(record);
  }

  if (
    typeof record.workspaceId !== "string" ||
    record.workspaceId.length === 0 ||
    typeof record.connectedAccountId !== "string" ||
    record.connectedAccountId.length === 0 ||
    typeof record.outstandAccountId !== "string" ||
    record.outstandAccountId.length === 0 ||
    typeof record.platform !== "string" ||
    !PLATFORMS.has(record.platform)
  ) {
    throw invalidPayload(payload);
  }

  return {
    workspaceId: record.workspaceId,
    connectedAccountId: record.connectedAccountId,
    outstandAccountId: record.outstandAccountId,
    platform: record.platform as SocialPlatform,
  };
}

/**
 * Handler JOB-05 untuk baris antrian (`queued: true`). Tipis: parse
 * payload, delegasi ke `ImportPostsTriggerUseCase.executeQueuedPeriodicImport`.
 * Tidak memanggil `triggerPeriodicForAccounts` / `runImportSync` — keduanya
 * menyisipkan baris `background_jobs` baru dan akan menabrak unique index
 * akun yang job-nya sedang dipegang runner.
 */
export class ImportSyncJobHandler {
  constructor(private readonly imports: QueuedPeriodicImportExecutor) {}

  async handle(rawPayload: unknown, jobId: string): Promise<void> {
    const payload = parsePayload(rawPayload);
    await this.imports.executeQueuedPeriodicImport({
      jobId,
      workspaceId: asWorkspaceId(payload.workspaceId),
      connectedAccountId: asConnectedAccountId(payload.connectedAccountId),
      outstandAccountId: payload.outstandAccountId,
      platform: payload.platform,
    });
  }
}
