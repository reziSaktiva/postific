import { asUserId } from "@postific/shared";
import { cache } from "react";

import { IdentityService, type TimeZoneSource } from "@/domains/identity";
import { supabaseAvatarStorageAdapter } from "@/lib/adapters/avatar-storage";
import { identityRepository } from "@/lib/repositories/identity";

import { getCachedSession } from "./session";

/** Zona default bila sesi/pengguna tidak ada (sama dengan default kolom DB). */
const FALLBACK_TIME_ZONE = "Asia/Jakarta";

/**
 * Zona waktu pengguna sesi (T-147/ADR-146), di-dedupe per request lewat
 * `React.cache()` (layout + page memakai satu query). Composition root:
 * dipakai RSC/page untuk menghitung rentang/kelompok tanggal dan oleh layout
 * untuk provider client.
 */
export const getCachedUserTimeZoneState = cache(
  async (): Promise<{ timeZone: string; source: TimeZoneSource }> => {
    const session = await getCachedSession();
    if (!session) {
      return { timeZone: FALLBACK_TIME_ZONE, source: "legacy" };
    }
    const profile = await new IdentityService(
      identityRepository,
      supabaseAvatarStorageAdapter,
    ).getProfile(asUserId(session.user.id));
    return {
      timeZone: profile?.timeZone ?? FALLBACK_TIME_ZONE,
      source: profile?.timeZoneSource ?? "legacy",
    };
  },
);

export async function getCachedUserTimeZone(): Promise<string> {
  return (await getCachedUserTimeZoneState()).timeZone;
}
