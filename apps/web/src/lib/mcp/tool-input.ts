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
