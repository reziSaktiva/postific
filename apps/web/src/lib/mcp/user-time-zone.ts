import type { UserId } from "@postific/shared";
import { isValidTimeZone, WIB_TIME_ZONE } from "@/domains/publishing";

import type { McpToolServices } from "./tool-types";

/**
 * Zona waktu pemilik koneksi (T-168, ADR-146): `User.timeZone`. Kegagalan
 * membaca profil dilempar apa adanya (menjadi `internal_error`), bukan diganti
 * zona tebakan: waktu jadwal yang salah zona lebih buruk daripada panggilan
 * yang gagal. Profil tanpa zona valid (pengguna terhapus, nilai rusak) jatuh
 * ke default WIB, sama dengan `getCachedUserTimeZoneState` di sisi UI.
 */
export async function resolveUserTimeZone(
  identity: McpToolServices["identity"],
  userId: UserId,
): Promise<string> {
  const profile = await identity.getProfile(userId);
  const zone = profile?.timeZone;
  return zone && isValidTimeZone(zone) ? zone : WIB_TIME_ZONE;
}
