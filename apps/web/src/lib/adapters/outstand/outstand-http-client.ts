import {
  mapHttpErrorToIntegrationError,
  mapNetworkErrorToIntegrationError,
  redactSensitiveOutstandText,
} from "./outstand-integration-error";

/**
 * HTTP client generik Outstand API (T-025.1) — SATU-SATUNYA tempat yang
 * mengetahui detail transport (auth header, base URL, timeout, JSON
 * parsing) untuk `RealOutstandAdapter`. Tidak ada business logic di sini,
 * murni "susun request → kirim → parse response → map error" (AGENTS.md
 * batasan tanggung jawab `OutstandAdapter` — bagian ini murni transport,
 * mapping wire→domain tetap di `real-outstand-adapter.ts`).
 *
 * **Skema auth (diverifikasi terhadap OpenAPI spec resmi Outstand — endpoint
 * `openapi.json` per-domain, mis. `/v1/posts/openapi.json`, diambil
 * 2026-09-23):**
 * `Authorization: Bearer <OUTSTAND_API_KEY>` — dikonfirmasi benar, tidak
 * berubah dari implementasi sebelumnya.
 *
 * **Base URL (diverifikasi terhadap OpenAPI spec resmi Outstand,
 * 2026-09-23):** `https://api.outstand.so` — TANPA suffix `/v1`, karena
 * setiap path di spec resmi sudah menyertakan `/v1/...` sendiri (mis.
 * `/v1/posts`, `/v1/media/upload`, `/v1/social-accounts`). Override lewat
 * env `OUTSTAND_API_BASE_URL` tetap tersedia untuk fleksibilitas (mis.
 * sandbox/staging Outstand kalau ada), tapi caller (`real-outstand-adapter.ts`)
 * WAJIB menyertakan `/v1` di setiap path yang dipanggil — base URL ini
 * sendiri tidak lagi mencakupnya.
 */
const DEFAULT_BASE_URL = "https://api.outstand.so";

/**
 * Timeout request JSON (T-025.1) — 15 detik. Batas 30 detik di BG-D05
 * berlaku untuk SATU run job runner, bukan untuk unggah byte media.
 */
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Timeout `PUT` byte media. Video/gambar besar tidak selesai dalam 15 detik.
 * Terpisah dari timeout JSON supaya publish bermedia tidak gagal lebih dulu
 * di langkah unggah.
 */
const DEFAULT_MEDIA_UPLOAD_TIMEOUT_MS = 120_000;

/**
 * Label aman untuk error context — jangan log/leak full presigned URL
 * (query string sering berisi credential/signature). Pathname saja, atau
 * label tetap `media-upload` kalau parse gagal.
 */
export function redactUrlForErrorContext(urlOrPath: string): string {
  const withoutToken = redactSensitiveOutstandText(urlOrPath);
  if (withoutToken.startsWith("/") && !withoutToken.includes("://")) {
    return withoutToken;
  }
  try {
    const parsed = new URL(withoutToken);
    return parsed.pathname || "media-upload";
  } catch {
    return withoutToken.includes("pending") ? withoutToken : "media-upload";
  }
}

/**
 * Signature call minimal `fetch` (bukan `typeof fetch` penuh) — `typeof
 * fetch` di runtime Bun juga mensyaratkan properti statis seperti
 * `preconnect` yang tidak dimiliki `vi.fn()` biasa, jadi interface longgar
 * ini dipakai supaya mock test (T-025.7) tetap type-safe tanpa perlu
 * meniru seluruh permukaan `fetch` asli.
 */
export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface OutstandHttpClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  /** Timeout khusus `PUT` byte media. Default 120 detik. */
  uploadTimeoutMs?: number;
  /** Injectable untuk unit test (T-025.7) — default `globalThis.fetch`. */
  fetchImpl?: FetchLike;
}

export type OutstandHttpMethod = "GET" | "POST" | "DELETE" | "PATCH";

export interface OutstandRequestInit {
  method: OutstandHttpMethod;
  body?: unknown;
  query?: Record<string, string | undefined>;
}

export class OutstandHttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly uploadTimeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(
    private readonly apiKey: string,
    options: OutstandHttpClientOptions = {},
  ) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.uploadTimeoutMs =
      options.uploadTimeoutMs ?? DEFAULT_MEDIA_UPLOAD_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /**
   * Request JSON standar (auth header + timeout + error mapping). `path`
   * relatif terhadap `baseUrl` (mis. `/posts`, `/posts/abc123`).
   */
  async request<T>(path: string, init: OutstandRequestInit): Promise<T> {
    const url = this.buildUrl(path, init.query);
    const safePath = redactSensitiveOutstandText(path);
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
          ...(init.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });
    } catch (rawError) {
      throw mapNetworkErrorToIntegrationError(rawError, { path: safePath });
    } finally {
      clearTimeout(timeoutHandle);
    }

    const parsedBody = await this.parseBody(response);

    if (!response.ok) {
      throw mapHttpErrorToIntegrationError(response.status, parsedBody, {
        path: safePath,
      });
    }

    return parsedBody as T;
  }

  /**
   * `PUT` bytes mentah ke URL upload working copy media (T-025.5, langkah
   * 2 dari 3 narasi Outstand Media API — lihat `uploadMediaWorkingCopy` di
   * `real-outstand-adapter.ts`). `uploadUrl` adalah URL yang DIKEMBALIKAN
   * Outstand sendiri (bukan `baseUrl` kita) — dipanggil apa adanya, TANPA
   * header `Authorization` Outstand (ASUMSI: pola upload-URL presigned
   * lazim TIDAK butuh auth header tambahan, kredensial sudah melekat di
   * URL/query-nya sendiri — konsisten dengan pola Supabase Storage signed
   * URL yang sudah dipakai di adapter lain, `supabase-media-storage-adapter.ts`).
   * Kalau ternyata Outstand mensyaratkan auth header juga di langkah PUT
   * ini, perlu direvisi saat kredensial nyata diuji end-to-end.
   */
  async putBytes(
    uploadUrl: string,
    bytes: Buffer,
    contentType: string,
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(
      () => controller.abort(),
      this.uploadTimeoutMs,
    );

    let response: Response;
    try {
      response = await this.fetchImpl(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        // `fetch`'s `BodyInit` tidak mengenal `Buffer` Node secara langsung
        // (walau kompatibel di runtime Bun/Node) — cast eksplisit ke
        // `Uint8Array` (superclass yang dikenali `BodyInit`) untuk lolos
        // typecheck tanpa copy tambahan.
        body: new Uint8Array(bytes),
        signal: controller.signal,
      });
    } catch (rawError) {
      throw mapNetworkErrorToIntegrationError(rawError, {
        path: redactUrlForErrorContext(uploadUrl),
      });
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (!response.ok) {
      const parsedBody = await this.parseBody(response);
      throw mapHttpErrorToIntegrationError(response.status, parsedBody, {
        path: redactUrlForErrorContext(uploadUrl),
      });
    }
  }

  private async parseBody(response: Response): Promise<unknown> {
    const rawText = await response.text();
    if (!rawText) return undefined;
    try {
      return JSON.parse(rawText);
    } catch {
      return rawText;
    }
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | undefined>,
  ): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${normalizedPath}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }
}
