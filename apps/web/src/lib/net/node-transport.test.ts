import { createServer, type Server } from "node:https";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createPinnedTransport, pinnedLookup } from "./node-transport";
import { testTlsCert, testTlsKey } from "./test-tls-fixture";

describe("pinnedLookup", () => {
  const lookup = pinnedLookup({ address: "93.184.216.34", family: 4 });

  it("always returns the validated address, whatever hostname is asked (all:true)", () => {
    const cb = vi.fn();
    lookup("attacker.example", { all: true }, cb);
    expect(cb).toHaveBeenCalledWith(null, [
      { address: "93.184.216.34", family: 4 },
    ]);
  });

  it("returns the validated address in the single-result form", () => {
    const cb = vi.fn();
    lookup("attacker.example", {}, cb);
    expect(cb).toHaveBeenCalledWith(null, "93.184.216.34", 4);
  });
});

/**
 * Integrasi nyata: server TLS lokal di 127.0.0.1 (cert self-signed untuk
 * `pinned.test`, nama yang TIDAK ada di DNS). Berhasilnya koneksi membuktikan
 * transport menyambung ke IP yang di-pin, bukan me-resolve hostname; Host dan
 * verifikasi sertifikat tetap atas nama asli. Hanya `ca` dan `port` yang
 * di-override lewat opsi khusus tes; kode produksi memakai CA sistem dan 443.
 */
describe("createPinnedTransport (TLS lokal)", () => {
  let server: Server;
  let port: number;
  let seenHost: string | undefined;

  beforeAll(async () => {
    server = createServer(
      { key: testTlsKey(), cert: testTlsCert() },
      (req, res) => {
        seenHost = req.headers.host;
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("hello");
      },
    );
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const pinned = { address: "127.0.0.1", family: 4 as const };

  it("connects to the pinned IP although the hostname does not resolve, keeping Host", async () => {
    const transport = createPinnedTransport({ ca: testTlsCert(), port });
    const res = await transport({
      url: new URL("https://pinned.test/x?y=1"),
      address: pinned,
      signal: new AbortController().signal,
    });
    const chunks: Buffer[] = [];
    for await (const chunk of res.body) chunks.push(Buffer.from(chunk));
    expect(res.status).toBe(200);
    expect(Buffer.concat(chunks).toString()).toBe("hello");
    expect(seenHost).toBe("pinned.test");
  });

  it("still verifies the certificate against the original hostname", async () => {
    const transport = createPinnedTransport({ ca: testTlsCert(), port });
    await expect(
      transport({
        url: new URL("https://other.test/"),
        address: pinned,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow();
  });
});
