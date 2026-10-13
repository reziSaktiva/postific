/** App-level error utilities. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string = "APP_ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Error hierarchy per "Error Handling Strategy" (application-layer.md).
 * Application Services throw these; Entry Points (Server Action, Route
 * Handler, Server Component) catch and translate per their own concern
 * (structured response, HTTP status, error UI state).
 */
export class ApplicationError extends AppError {}

export class AuthorizationError extends ApplicationError {
  constructor(message: string) {
    super(message, "AUTHORIZATION_ERROR");
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message: string) {
    super(message, "NOT_FOUND_ERROR");
    this.name = "NotFoundError";
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string) {
    super(message, "CONFLICT_ERROR");
    this.name = "ConflictError";
  }
}

/**
 * Subclass `ConflictError` (KI-079) — percobaan Connect ke akun yang
 * SUDAH terhubung di workspace ini dari alur/waktu yang berbeda (BUKAN
 * double-submit genuine dari request susulan Next.js untuk akun yang
 * baru saja dibuat). Dibedakan supaya Route Handler callback
 * (`/api/integrations/outstand/callback`) bisa memberi tahu user secara
 * eksplisit alih-alih redirect "success" diam-diam — lihat
 * `WorkspaceService.createOrRecoverConnectedAccount`.
 */
export class AlreadyConnectedError extends ConflictError {
  constructor(message: string) {
    super(message);
    this.name = "AlreadyConnectedError";
  }
}

export class ExternalServiceError extends ApplicationError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, "EXTERNAL_SERVICE_ERROR");
    this.name = "ExternalServiceError";
    if (options && "cause" in options) {
      this.cause = options.cause;
    }
  }
}

/**
 * Shared Server Action error mapper — sebelumnya diduplikasi identik di
 * beberapa file `actions.ts` (settings, settings/members, sidebar-channels,
 * publish/queue). `ApplicationError` sudah jadi base class seluruh error
 * domain (Authorization/NotFound/Validation/Conflict/ExternalService), jadi
 * satu `instanceof` di sini menggantikan allowlist per-file yang harus
 * disinkronkan manual tiap ada error type baru.
 */
export function toActionError(error: unknown): { error: string } {
  if (error instanceof ApplicationError) {
    return { error: error.message };
  }
  throw error;
}
