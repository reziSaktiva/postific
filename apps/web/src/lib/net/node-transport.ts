import { request } from "node:https";
import { lookup } from "node:dns/promises";
import type { LookupFunction } from "node:net";

import type {
  PinnedRequest,
  ResolvedAddress,
  SafeFetchDeps,
  TransportResponse,
} from "./safe-fetch";

/**
 * Implementasi produksi `SafeFetchDeps` (Node). Pinning IP: `https.request`
 * dipanggil dengan `host` = hostname asli (SNI, header `Host`, dan verifikasi
 * sertifikat tetap atas nama asli) tetapi `lookup` kustom hanya mengembalikan
 * alamat yang sudah divalidasi `safeFetch`; tidak ada resolve kedua.
 * `agent: false`: koneksi baru per hop, tanpa pooling lintas panggilan.
 */

async function resolveAll(hostname: string): Promise<ResolvedAddress[]> {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map((entry) => ({
    address: entry.address,
    family: entry.family === 6 ? 6 : 4,
  }));
}

export function pinnedLookup(
  addresses: readonly ResolvedAddress[],
): LookupFunction {
  return (hostname, options, callback) => {
    const wanted =
      options.family === 4 || options.family === 6 ? options.family : 0;
    const list = wanted
      ? addresses.filter((a) => a.family === wanted)
      : addresses;
    if (list.length === 0) {
      const error = Object.assign(
        new Error(`getaddrinfo ENOTFOUND ${hostname}`),
        {
          code: "ENOTFOUND",
        },
      );
      callback(error as NodeJS.ErrnoException, "", 0);
      return;
    }
    if (options.all) {
      callback(
        null,
        list.map((a) => ({ address: a.address, family: a.family })),
      );
    } else {
      const first = list[0] as ResolvedAddress;
      callback(null, first.address, first.family);
    }
  };
}

/** Hanya untuk tes integrasi; produksi tidak pernah memberi opsi ini (CA sistem, port 443). */
export interface PinnedTransportTestOverrides {
  ca: string;
  port: number;
}

export function createPinnedTransport(
  testOverrides?: PinnedTransportTestOverrides,
): SafeFetchDeps["transport"] {
  return (req) => pinnedRequest(req, testOverrides);
}

function pinnedRequest(
  req: PinnedRequest,
  testOverrides?: PinnedTransportTestOverrides,
): Promise<TransportResponse> {
  return new Promise((resolve, reject) => {
    const clientRequest = request(
      {
        protocol: "https:",
        host: req.url.hostname,
        servername: req.url.hostname,
        port: testOverrides?.port ?? 443,
        ...(testOverrides ? { ca: testOverrides.ca } : {}),
        method: "GET",
        path: `${req.url.pathname}${req.url.search}`,
        lookup: pinnedLookup(req.addresses),
        agent: false,
        signal: req.signal,
        headers: {
          host: req.url.host,
          "user-agent": "Postific-MediaFetcher/1.0",
          accept: "image/*,video/*",
          "accept-encoding": "identity",
        },
      },
      (res) => {
        const headers: Record<string, string | undefined> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          headers[key.toLowerCase()] = Array.isArray(value)
            ? value.join(", ")
            : value;
        }
        resolve({
          status: res.statusCode ?? 0,
          headers,
          body: res,
          destroy: () => {
            res.destroy();
            clientRequest.destroy();
          },
        });
      },
    );
    clientRequest.on("error", reject);
    clientRequest.end();
  });
}

export const nodeSafeFetchDeps: SafeFetchDeps = {
  resolve: resolveAll,
  transport: createPinnedTransport(),
};
