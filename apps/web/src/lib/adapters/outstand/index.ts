import type { IOutstandAdapter } from "@postific/shared";
import { getServerEnv } from "@/lib/env";
import { ExternalServiceError } from "@/lib/utils/errors";
import { createRealOutstandAdapter } from "./real-outstand-adapter";

/**
 * Factory `OutstandAdapter` (ADR-040, real adapter T-025, ADR-119).
 * `IOutstandAdapter` sejak T-041 didefinisikan di `@postific/shared`
 * (promosi cross-domain) — satu factory ini dipakai domain `publishing`,
 * `analytics`, `engagement`, dan `workspace`.
 *
 * - `OUTSTAND_API_KEY` wajib (trim non-kosong). Kosong/whitespace → throw
 *   jelas yang menyebut nama env var (ADR-119; amandemen switch Fake
 *   ADR-059).
 * - Key terisi → `RealOutstandAdapter`, disuplai `appOrigin`
 *   (`BETTER_AUTH_URL`, dibutuhkan `connectAccount` untuk membentuk
 *   `redirectUri` callback) dan `OUTSTAND_API_BASE_URL` opsional (default
 *   di `outstand-http-client.ts` kalau kosong).
 */
export function getOutstandAdapter(): IOutstandAdapter {
  const {
    OUTSTAND_API_KEY,
    OUTSTAND_API_BASE_URL,
    OUTSTAND_ORG_ID,
    BETTER_AUTH_URL,
  } = getServerEnv();

  const apiKey = OUTSTAND_API_KEY?.trim();
  if (!apiKey) {
    // `ExternalServiceError` (bukan `Error` polos) supaya Server Action
    // yang memanggil factory ini (langsung atau tidak langsung lewat
    // use-case) bisa ditangkap `toActionError()` (`@/lib/utils/errors`)
    // dan dikembalikan sebagai `{error}` rapi, bukan unhandled exception
    // yang crash jadi Next.js error overlay. Tetap `instanceof Error` jadi
    // Route Handler (webhook, `/api/jobs/run`) yang hanya mengecek
    // `instanceof Error` untuk extract message tidak terdampak.
    throw new ExternalServiceError(
      "OUTSTAND_API_KEY wajib diisi. Factory OutstandAdapter tidak lagi fallback ke Fake (ADR-119).",
    );
  }

  const baseUrl = OUTSTAND_API_BASE_URL?.trim() || undefined;

  return createRealOutstandAdapter(apiKey, {
    appOrigin: BETTER_AUTH_URL,
    baseUrl,
    orgId: OUTSTAND_ORG_ID?.trim() || undefined,
  });
}
