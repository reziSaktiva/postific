import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PREFIX = /^sha256=/i;

/**
 * Verifikasi HMAC-SHA256 signature webhook Outstand (T-026.1,
 * `integration-layer.md` § "Keamanan Webhook") atas RAW body — signature
 * dihitung Outstand dari byte mentah request, jadi verifikasi WAJIB
 * memakai raw body juga (bukan `JSON.stringify(JSON.parse(rawBody))`, yang
 * bisa berbeda whitespace/urutan key dan membuat signature valid terlihat
 * tidak valid).
 *
 * Perbandingan memakai `timingSafeEqual` (bukan `===`/`Buffer.equals`)
 * untuk mencegah timing attack yang bisa membocorkan signature valid byte
 * demi byte lewat selisih waktu respons.
 */
export function verifyOutstandWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
): boolean {
  if (!signatureHeader) {
    return false;
  }

  // Outstand sends `X-Outstand-Signature: sha256=<hex>`
  // (https://www.outstand.so/docs/webhooks, read 2026-11-27, T-311.5).
  // Strip the algorithm prefix; a bare hex value is still accepted.
  const actualHex = signatureHeader
    .trim()
    .replace(SIGNATURE_PREFIX, "")
    .toLowerCase();

  const expectedHex = createHmac("sha256", webhookSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedHex, "utf8");
  const actualBuffer = Buffer.from(actualHex, "utf8");

  // `timingSafeEqual` throws if buffer lengths differ — compare length
  // first (this length check itself isn't timing-sensitive in a way that
  // leaks the actual signature value, only its length, which the header
  // already exposes).
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
