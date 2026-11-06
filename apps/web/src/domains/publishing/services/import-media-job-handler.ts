import {
  asUserId,
  asWorkspaceId,
  type UserId,
  type WorkspaceId,
} from "@postific/shared";

/** Job type JOB-09 (T-230, ADR-158): unduh dan simpan thumbnail posting impor per batch kecil. */
export const IMPORT_MEDIA_JOB_TYPE = "import.media";

/** Batas target per job: sama dengan konkurensi pemroses, jadi satu job = satu giliran paralel, jauh di bawah 30 detik (BG-D05). */
export const IMPORT_MEDIA_BATCH_SIZE = 5;

export interface ImportMediaPayload {
  workspaceId: string;
  actingUserId: string;
  targetIds: string[];
}

export interface ImportMediaProcessor {
  process(input: {
    workspaceId: WorkspaceId;
    actingUserId: UserId;
    targetIds: string[];
  }): Promise<unknown>;
}

function invalidPayload(payload: unknown): Error {
  return new Error(
    `Payload job "${IMPORT_MEDIA_JOB_TYPE}" tidak valid — diharapkan ` +
      `{ workspaceId, actingUserId, targetIds: string[] }, dapat: ${JSON.stringify(payload)}`,
  );
}

export function parseImportMediaPayload(payload: unknown): ImportMediaPayload {
  if (typeof payload !== "object" || payload === null) {
    throw invalidPayload(payload);
  }
  const record = payload as Record<string, unknown>;
  const { workspaceId, actingUserId, targetIds } = record;
  if (
    typeof workspaceId !== "string" ||
    workspaceId.length === 0 ||
    typeof actingUserId !== "string" ||
    actingUserId.length === 0 ||
    !Array.isArray(targetIds) ||
    targetIds.length === 0 ||
    targetIds.length > IMPORT_MEDIA_BATCH_SIZE ||
    !targetIds.every((id) => typeof id === "string" && id.length > 0)
  ) {
    throw invalidPayload(payload);
  }
  return { workspaceId, actingUserId, targetIds: targetIds as string[] };
}

/** Handler JOB-09: tipis, parse payload lalu delegasi ke `ProcessImportMediaUseCase`. */
export class ImportMediaJobHandler {
  constructor(private readonly processor: ImportMediaProcessor) {}

  async handle(rawPayload: unknown): Promise<void> {
    const payload = parseImportMediaPayload(rawPayload);
    await this.processor.process({
      workspaceId: asWorkspaceId(payload.workspaceId),
      actingUserId: asUserId(payload.actingUserId),
      targetIds: payload.targetIds,
    });
  }
}
