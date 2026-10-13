import { timingSafeEqual } from "node:crypto";

/**
 * Bandingkan dua string secret secara constant-time (mis. bearer token/
 * shared secret header) — sama pola dengan
 * `verify-webhook-signature.ts`'s penggunaan `timingSafeEqual` untuk HMAC
 * Outstand, supaya endpoint secret-bearing lain tidak perlu menulis ulang
 * perbandingan `===`/`!==` yang bocor lewat timing side-channel.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
}
