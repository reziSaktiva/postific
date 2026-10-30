/**
 * Validasi argumen tool secara manual (tanpa zod: bukan dependensi langsung
 * `apps/web`; server memakai JSON Schema mentah). Kegagalan melempar
 * `McpToolInputError`, dipetakan gerbang ke `invalid_input`.
 */

export class McpToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpToolInputError";
  }
}

/** Tolak argumen di luar `allowed` (skema memakai `additionalProperties: false`). */
export function assertKnownArgs(
  args: Record<string, unknown>,
  allowed: readonly string[],
): void {
  for (const key of Object.keys(args)) {
    if (!allowed.includes(key)) {
      throw new McpToolInputError(`Argumen "${key}" tidak dikenal.`);
    }
  }
}

export function readOptionalString(
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new McpToolInputError(
      `Argumen "${key}" harus berupa teks tidak kosong.`,
    );
  }
  return value;
}

export function readOptionalEnum<T extends string>(
  args: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const value = readOptionalString(args, key);
  if (value === undefined) {
    return undefined;
  }
  if (!(allowed as readonly string[]).includes(value)) {
    throw new McpToolInputError(
      `Argumen "${key}" harus salah satu dari: ${allowed.join(", ")}.`,
    );
  }
  return value as T;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Argumen ID opsional; harus UUID supaya filter kolom `@db.Uuid` tidak melempar error DB. */
export function readOptionalUuid(
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = readOptionalString(args, key);
  if (value !== undefined && !UUID_PATTERN.test(value)) {
    throw new McpToolInputError(`Argumen "${key}" harus berupa UUID.`);
  }
  return value;
}

/** Argumen ID wajib; harus UUID (lihat `readOptionalUuid`). */
export function readRequiredUuid(
  args: Record<string, unknown>,
  key: string,
): string {
  const value = readOptionalUuid(args, key);
  if (value === undefined) {
    throw new McpToolInputError(`Argumen "${key}" wajib diisi.`);
  }
  return value;
}

/**
 * Teks yang BOLEH kosong (mis. caption draft; Draft Editor juga mengizinkan
 * caption kosong). Beda dari `readOptionalString` yang menolak teks kosong.
 * Panjang tidak dibatasi di sini; batasnya aturan domain
 * (`DRAFT_CAPTION_MAX_LENGTH`).
 */
export function readOptionalText(
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new McpToolInputError(`Argumen "${key}" harus berupa teks.`);
  }
  return value;
}

export function readRequiredText(
  args: Record<string, unknown>,
  key: string,
): string {
  const value = readOptionalText(args, key);
  if (value === undefined) {
    throw new McpToolInputError(`Argumen "${key}" wajib diisi.`);
  }
  return value;
}

/** Array UUID opsional (mis. `mediaIds`); `[]` sah dan berarti "kosongkan". */
export function readOptionalUuidArray(
  args: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new McpToolInputError(`Argumen "${key}" harus berupa daftar UUID.`);
  }
  return value.map((item, index) => {
    if (typeof item !== "string" || !UUID_PATTERN.test(item)) {
      throw new McpToolInputError(
        `Argumen "${key}" item ke-${index + 1} harus berupa UUID.`,
      );
    }
    return item;
  });
}

export interface ParsedDraftTarget {
  connectedAccountId: string;
  contentFormat: string;
}

/**
 * Daftar target draft `[{ accountId, contentFormat }]` opsional; `[]` sah dan
 * berarti "hapus semua target". Hanya bentuk yang divalidasi di sini; nilai
 * `contentFormat` dan kepemilikan akun diperiksa aturan domain (ADR-039).
 */
export function readOptionalDraftTargets(
  args: Record<string, unknown>,
  key: string,
): ParsedDraftTarget[] | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new McpToolInputError(
      `Argumen "${key}" harus berupa daftar { accountId, contentFormat }.`,
    );
  }
  return value.map((item, index) => {
    const label = `Argumen "${key}" item ke-${index + 1}`;
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new McpToolInputError(
        `${label} harus berupa objek { accountId, contentFormat }.`,
      );
    }
    const record = item as Record<string, unknown>;
    for (const field of Object.keys(record)) {
      if (field !== "accountId" && field !== "contentFormat") {
        throw new McpToolInputError(
          `${label}: kolom "${field}" tidak dikenal.`,
        );
      }
    }
    const accountId = record.accountId;
    if (typeof accountId !== "string" || !UUID_PATTERN.test(accountId)) {
      throw new McpToolInputError(`${label}: accountId harus berupa UUID.`);
    }
    const contentFormat = record.contentFormat;
    if (typeof contentFormat !== "string" || contentFormat === "") {
      throw new McpToolInputError(`${label}: contentFormat wajib diisi.`);
    }
    return { connectedAccountId: accountId, contentFormat };
  });
}
