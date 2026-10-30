import { isBlockedAddress, parseIPv4, parseIPv6 } from "./ip-classify";

/**
 * Unduh URL milik pihak ketiga dengan proteksi SSRF (T-155, ADR-138 § 5).
 * Infrastruktur murni: tidak ada logika domain. Resolver DNS dan transport
 * disuntikkan supaya tes tidak butuh jaringan; implementasi produksi ada di
 * `node-transport.ts`.
 *
 * Jaminan:
 * - hanya `https`, tanpa userinfo, hanya port default 443;
 * - host IP literal (termasuk bentuk desimal/hex/oktal, yang dinormalkan
 *   parser URL WHATWG menjadi IPv4 bertitik) ditolak;
 * - DNS di-resolve SEKALI per hop; bila SALAH SATU alamat terlarang, hop
 *   ditolak. Koneksi di-pin ke alamat hasil validasi (transport menerima IP,
 *   bukan hostname untuk di-resolve ulang) sehingga DNS rebinding tidak
 *   mungkin;
 * - redirect manual, maksimum `MAX_REDIRECTS`, validasi penuh tiap hop;
 * - batas waktu total dan batas ukuran (header dan hitungan byte stream).
 *
 * Pesan error sengaja generik: tidak membocorkan IP hasil resolve.
 */

export const SAFE_FETCH_MAX_REDIRECTS = 3;
export const SAFE_FETCH_TIMEOUT_MS = 15_000;
/** Batas unduhan serentak per proses; sisanya ditolak (bukan antre) supaya memori terbatas. */
export const SAFE_FETCH_MAX_CONCURRENT = 3;

/**
 * Penghitung di `globalThis` (bukan variabel modul) supaya tetap satu per
 * proses walau modul ini dimuat lebih dari sekali (bundle route berbeda).
 */
const ACTIVE_KEY = Symbol.for("postific.safeFetch.active");
function activeCounter(): { count: number } {
  const holder = globalThis as unknown as Record<symbol, { count: number }>;
  return (holder[ACTIVE_KEY] ??= { count: 0 });
}

export type SafeFetchErrorCode =
  | "invalid_url"
  | "blocked_destination"
  | "too_many_redirects"
  | "timeout"
  | "too_large"
  | "bad_status"
  | "unsupported_encoding"
  | "network_error"
  | "empty_body"
  | "busy";

const MESSAGES: Record<SafeFetchErrorCode, string> = {
  invalid_url: "URL tidak valid. Gunakan URL https tanpa kredensial dan port.",
  blocked_destination:
    "Alamat tujuan tidak diizinkan atau tidak dapat dijangkau.",
  too_many_redirects: "Terlalu banyak pengalihan (redirect) saat mengunduh.",
  timeout: "Pengunduhan melewati batas waktu.",
  too_large: "Ukuran file melebihi batas maksimum 50 MB.",
  bad_status: "Server asal tidak mengembalikan file (status bukan sukses).",
  unsupported_encoding:
    "Server asal memakai encoding respons yang tidak didukung.",
  network_error: "Alamat tujuan tidak diizinkan atau tidak dapat dijangkau.",
  empty_body: "File yang diunduh kosong.",
  busy: "Server sedang sibuk mengunduh file lain. Coba lagi sebentar.",
};

export class SafeFetchError extends Error {
  constructor(readonly code: SafeFetchErrorCode) {
    super(MESSAGES[code]);
    this.name = "SafeFetchError";
  }
}

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface PinnedRequest {
  url: URL;
  /**
   * SEMUA IP hasil validasi, urutan resolver dipertahankan; transport WAJIB
   * hanya menyambung ke daftar ini (bukan me-resolve `url.hostname`) dan
   * boleh fallback antar alamat (mis. autoSelectFamily).
   */
  addresses: readonly ResolvedAddress[];
  signal: AbortSignal;
}

export interface TransportResponse {
  status: number;
  /** Nama header huruf kecil. */
  headers: Record<string, string | undefined>;
  body: AsyncIterable<Uint8Array>;
  /** Tutup koneksi tanpa membaca sisa body. */
  destroy(): void;
}

export interface SafeFetchDeps {
  resolve(hostname: string): Promise<readonly ResolvedAddress[]>;
  transport(request: PinnedRequest): Promise<TransportResponse>;
}

export interface SafeFetchOptions {
  /** Wajib dari pemanggil (infra tidak mengenal aturan domain). */
  maxBytes: number;
  timeoutMs?: number;
  maxRedirects?: number;
}

export interface SafeFetchResult {
  bytes: Buffer;
  /** URL akhir setelah redirect (untuk menurunkan nama file). */
  finalUrl: URL;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function parseAndCheckUrl(raw: string, base?: URL): URL {
  let url: URL;
  try {
    url = base ? new URL(raw, base) : new URL(raw);
  } catch {
    throw new SafeFetchError("invalid_url");
  }
  if (url.protocol !== "https:") {
    throw new SafeFetchError("invalid_url");
  }
  if (url.username !== "" || url.password !== "") {
    throw new SafeFetchError("invalid_url");
  }
  // Mencakup `https://@host`, yang tidak mengisi username/password.
  if (/^\s*(?:[a-z][a-z0-9+.-]*:)?[/\\]{2}[^/\\?#]*@/i.test(raw)) {
    throw new SafeFetchError("invalid_url");
  }
  // Port default dinormalkan parser menjadi "".
  if (url.port !== "") {
    throw new SafeFetchError("invalid_url");
  }
  // Titik di akhir (FQDN) dibuang sebelum semua pemeriksaan nama.
  const host = url.hostname.toLowerCase().replace(/\.+$/, "");
  if (host === "") {
    throw new SafeFetchError("invalid_url");
  }
  // IP literal (IPv6 berkurung; IPv4 sudah dinormalkan parser) dilarang;
  // host harus nama DNS.
  if (host.startsWith("[") || parseIPv4(host) || parseIPv6(host)) {
    throw new SafeFetchError("blocked_destination");
  }
  // Sisa bentuk angka yang tidak dinormalkan (defensif).
  if (/^[0-9a-fx.]+$/i.test(host) && /[0-9]$/.test(host)) {
    throw new SafeFetchError("blocked_destination");
  }
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new SafeFetchError("blocked_destination");
  }
  // Normalisasi sekali: hostname tanpa titik akhir dan huruf kecil dipakai
  // untuk resolve, SNI, dan Host.
  if (url.hostname !== host) {
    url.hostname = host;
  }
  return url;
}

async function resolveValidated(
  deps: SafeFetchDeps,
  hostname: string,
): Promise<readonly ResolvedAddress[]> {
  let addresses: readonly ResolvedAddress[];
  try {
    addresses = await deps.resolve(hostname);
  } catch {
    throw new SafeFetchError("network_error");
  }
  if (addresses.length === 0) {
    throw new SafeFetchError("network_error");
  }
  // Tolak bila SALAH SATU alamat terlarang, bukan hanya yang dipilih.
  if (addresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new SafeFetchError("blocked_destination");
  }
  return addresses;
}

function raceDeadline<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    promise.catch(() => undefined);
    return Promise.reject(new SafeFetchError("timeout"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new SafeFetchError("timeout"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

async function readBody(
  response: TransportResponse,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Buffer> {
  const contentLength = response.headers["content-length"];
  if (contentLength !== undefined && /^[0-9]+$/.test(contentLength.trim())) {
    if (Number(contentLength) > maxBytes) {
      response.destroy();
      throw new SafeFetchError("too_large");
    }
  }
  const chunks: Buffer[] = [];
  let total = 0;
  const iterator = response.body[Symbol.asyncIterator]();
  try {
    for (;;) {
      const next = await raceDeadline(iterator.next(), signal);
      if (next.done) {
        break;
      }
      total += next.value.byteLength;
      if (total > maxBytes) {
        throw new SafeFetchError("too_large");
      }
      // Tampilan tanpa salinan atas buffer yang sama; `concat` di akhir satu-satunya salinan.
      chunks.push(
        Buffer.isBuffer(next.value)
          ? next.value
          : Buffer.from(
              next.value.buffer,
              next.value.byteOffset,
              next.value.byteLength,
            ),
      );
    }
  } catch (error) {
    response.destroy();
    if (error instanceof SafeFetchError) {
      throw error;
    }
    throw new SafeFetchError("network_error");
  }
  if (total === 0) {
    throw new SafeFetchError("empty_body");
  }
  // Satu chunk: pakai langsung, tanpa salinan akhir.
  return chunks.length === 1
    ? (chunks[0] as Buffer)
    : Buffer.concat(chunks, total);
}

export async function safeFetch(
  rawUrl: string,
  deps: SafeFetchDeps,
  options: SafeFetchOptions,
): Promise<SafeFetchResult> {
  const maxBytes = options.maxBytes;
  const maxRedirects = options.maxRedirects ?? SAFE_FETCH_MAX_REDIRECTS;
  const active = activeCounter();
  if (active.count >= SAFE_FETCH_MAX_CONCURRENT) {
    throw new SafeFetchError("busy");
  }
  active.count++;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? SAFE_FETCH_TIMEOUT_MS,
  );
  const { signal } = controller;

  try {
    let url = parseAndCheckUrl(rawUrl);
    for (let hop = 0; ; hop++) {
      const addresses = await raceDeadline(
        resolveValidated(deps, url.hostname),
        signal,
      );

      let response: TransportResponse;
      try {
        response = await raceDeadline(
          deps.transport({ url, addresses, signal }),
          signal,
        );
      } catch (error) {
        if (error instanceof SafeFetchError) {
          throw error;
        }
        throw new SafeFetchError("network_error");
      }

      if (REDIRECT_STATUSES.has(response.status)) {
        response.destroy();
        const location = response.headers.location;
        if (location === undefined || location.trim() === "") {
          throw new SafeFetchError("bad_status");
        }
        if (hop >= maxRedirects) {
          throw new SafeFetchError("too_many_redirects");
        }
        // Validasi penuh hop berikutnya (skema, host, port) di iterasi berikut.
        url = parseAndCheckUrl(location.trim(), url);
        continue;
      }

      if (response.status < 200 || response.status > 299) {
        response.destroy();
        throw new SafeFetchError("bad_status");
      }
      const encoding = response.headers["content-encoding"]
        ?.trim()
        .toLowerCase();
      if (
        encoding !== undefined &&
        encoding !== "" &&
        encoding !== "identity"
      ) {
        response.destroy();
        throw new SafeFetchError("unsupported_encoding");
      }

      const bytes = await readBody(response, maxBytes, signal);
      return { bytes, finalUrl: url };
    }
  } finally {
    active.count--;
    clearTimeout(timer);
    controller.abort();
  }
}
