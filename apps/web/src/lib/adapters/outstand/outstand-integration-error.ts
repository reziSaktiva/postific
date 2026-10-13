import { ExternalServiceError } from "@/lib/utils/errors";

/** Session token Facebook duduk di path `/social-accounts/pending/{token}`. */
const PENDING_SESSION_TOKEN = /\/social-accounts\/pending\/[^/?#\s]+/g;

/** Hapus bearer session Facebook dari path atau pesan error sebelum di-log/dikembalikan ke UI. */
export function redactSensitiveOutstandText(text: string): string {
  return text.replace(
    PENDING_SESSION_TOKEN,
    "/social-accounts/pending/[redacted]",
  );
}

/**
 * `IntegrationError` (T-025.1, ACL error translation) — implementasi
 * konkret dari klasifikasi error yang didefinisikan
 * `integration-layer.md` § "Error Handling Strategy" / "IntegrationError":
 *
 * ```
 * IntegrationError
 *   ├── type: 'transient' | 'client_error' | 'auth_error' | 'account_error' | 'not_found'
 *   ├── outstandErrorCode: string?
 *   ├── message: string
 *   └── retryable: boolean
 * ```
 *
 * Kelas ini EXTENDS `ExternalServiceError` (`@/lib/utils/errors`) — bukan
 * `Error` polos — supaya tetap kompatibel dengan seluruh catch-block
 * existing yang sudah menangani error adapter secara generik lewat
 * `instanceof ApplicationError`/`error.message` (mis.
 * `SchedulePostsUseCase`, `PublishNowUseCase`, `job-runner.ts` — lihat
 * inspeksi kode sebelum menulis file ini: TIDAK ADA caller produksi yang
 * saat ini membaca `type`/`retryable` untuk mengubah keputusan retry;
 * job-runner generik retry SEMUA error dengan backoff tetap 5m/15m/60m,
 * bukan bercabang per klasifikasi). Field `type`/`outstandErrorCode`/
 * `retryable` tetap disertakan sebagai properti tambahan pada instance ini
 * (bukan cuma di `message`) supaya IL-D08 (integration-layer.md) terpenuhi
 * SECARA STRUKTURAL — bukan hanya string — dan caller yang lebih spesifik
 * (mis. use-case yang nanti ingin membedakan retry manual vs otomatis
 * berdasarkan `retryable`) bisa mulai membacanya tanpa perlu mengubah
 * kontrak error lagi.
 *
 * Domain internal (Publishing/Analytics/Engagement/Workspace) tidak pernah
 * melihat HTTP status code atau bentuk response Outstand secara langsung —
 * hanya instance `OutstandIntegrationError` ini (AGENTS.md #6, IL-D08).
 */
export type OutstandErrorType =
  "transient" | "client_error" | "auth_error" | "account_error" | "not_found";

export interface OutstandIntegrationErrorParams {
  type: OutstandErrorType;
  message: string;
  outstandErrorCode?: string;
  retryable: boolean;
  /** HTTP status asli (kalau ada) — murni untuk observability/log, bukan dibaca domain. */
  httpStatus?: number;
}

export class OutstandIntegrationError extends ExternalServiceError {
  readonly type: OutstandErrorType;
  readonly outstandErrorCode?: string;
  readonly retryable: boolean;
  readonly httpStatus?: number;

  constructor(params: OutstandIntegrationErrorParams) {
    super(params.message);
    this.name = "OutstandIntegrationError";
    this.type = params.type;
    this.outstandErrorCode = params.outstandErrorCode;
    this.retryable = params.retryable;
    this.httpStatus = params.httpStatus;
  }
}

/** Cari field pesan error yang lazim dipakai REST API (`message`/`error`/`detail`/`error_description`). */
function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    const candidate =
      rec.message ?? rec.error ?? rec.detail ?? rec.error_description;
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }
  if (typeof body === "string" && body.length > 0) {
    return body;
  }
  return fallback;
}

/** Cari field kode error vendor lazim (`code`/`error_code`/`errorCode`). */
function extractErrorCode(body: unknown): string | undefined {
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    const code = rec.code ?? rec.error_code ?? rec.errorCode;
    if (typeof code === "string") return code;
  }
  return undefined;
}

/**
 * Klasifikasi status HTTP → `IntegrationError` mengikuti tabel
 * "Klasifikasi Error" di `integration-layer.md`:
 *
 * | Tipe | Contoh | Penanganan |
 * | Transient | Timeout, 5xx, network error | Retry exponential backoff |
 * | Client Error | 400 Bad Request | Log + gagalkan, jangan retry |
 * | Auth Error | 401 | Alert monitoring, jangan retry |
 * | Account Error | 403 | `ConnectedAccount.status = error` |
 * | Not Found | 404 | Log + skip (idempotent) |
 *
 * **ASUMSI (dicatat untuk laporan T-025):** dokumentasi ADR-040/
 * `integration-layer.md` mendefinisikan KLASIFIKASI error di atas, tapi
 * TIDAK mendokumentasikan bentuk JSON body error Outstand yang sesungguhnya
 * (field nama pesan/kode). `extractErrorMessage`/`extractErrorCode` di atas
 * mencoba beberapa nama field REST API yang lazim (`message`/`error`/
 * `code`/dst.) sebagai best-effort — perlu diverifikasi ulang begitu
 * response error Outstand asli pernah teramati (mis. lewat Railway log
 * staging setelah kredensial dipakai).
 */
export function mapHttpErrorToIntegrationError(
  status: number,
  body: unknown,
  context: { path: string },
): OutstandIntegrationError {
  const safePath = redactSensitiveOutstandText(context.path);
  const outstandErrorCode = extractErrorCode(body);
  const baseMessage = redactSensitiveOutstandText(
    extractErrorMessage(
      body,
      `Outstand API mengembalikan HTTP ${status} pada ${safePath}`,
    ),
  );

  if (status === 401) {
    return new OutstandIntegrationError({
      type: "auth_error",
      message: `Outstand auth error (API key tidak valid/kedaluwarsa): ${baseMessage}`,
      outstandErrorCode,
      retryable: false,
      httpStatus: status,
    });
  }
  if (status === 403) {
    return new OutstandIntegrationError({
      type: "account_error",
      message: `Outstand account error (akses akun dicabut/tidak diizinkan): ${baseMessage}`,
      outstandErrorCode,
      retryable: false,
      httpStatus: status,
    });
  }
  if (status === 404) {
    return new OutstandIntegrationError({
      type: "not_found",
      message: `Outstand resource tidak ditemukan: ${baseMessage}`,
      outstandErrorCode,
      retryable: false,
      httpStatus: status,
    });
  }
  // 429 Too Many Requests — transient (rate limit), retryable seperti 5xx.
  if (status === 429 || status >= 500) {
    return new OutstandIntegrationError({
      type: "transient",
      message:
        status === 429
          ? `Outstand rate limited (HTTP 429): ${baseMessage}`
          : `Outstand server error (HTTP ${status}): ${baseMessage}`,
      outstandErrorCode,
      retryable: true,
      httpStatus: status,
    });
  }
  // Sisa 4xx (400, 409, 422, dst.) — client error, tidak retryable.
  return new OutstandIntegrationError({
    type: "client_error",
    message: `Outstand client error (HTTP ${status}): ${baseMessage}`,
    outstandErrorCode,
    retryable: false,
    httpStatus: status,
  });
}

/** Network failure (DNS/connection refused/dsb) atau timeout (`AbortError`) → transient, retryable. */
export function mapNetworkErrorToIntegrationError(
  rawError: unknown,
  context: { path: string },
): OutstandIntegrationError {
  const isAbort = rawError instanceof Error && rawError.name === "AbortError";
  const safePath = redactSensitiveOutstandText(context.path);
  const detail = redactSensitiveOutstandText(
    rawError instanceof Error ? rawError.message : String(rawError),
  );

  return new OutstandIntegrationError({
    type: "transient",
    message: isAbort
      ? `Outstand API request timeout pada ${safePath}`
      : `Outstand API network error pada ${safePath}: ${detail}`,
    retryable: true,
  });
}
