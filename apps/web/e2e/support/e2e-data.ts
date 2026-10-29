/**
 * Konvensi isolasi data E2E (T-173.3, S-002, ADR-081, ADR-149).
 *
 * Local dan staging berbagi satu DB, dan akun test terhubung ke workspace
 * nyata, jadi:
 * - Data yang dibuat tes wajib berawalan `E2E_PREFIX` (pakai `e2eName`).
 * - Tes membersihkan data `e2e-*` miliknya di akhir (afterEach/afterAll).
 * - Tes TIDAK PERNAH memublikasikan post (publish now maupun jadwal yang akan
 *   terpublish) di workspace "Cook It Real Good" atau ke akun media sosial
 *   nyata mana pun. Aksi lain boleh.
 */
export const E2E_PREFIX = "e2e-";

/** Nama unik berawalan `e2e-`, mis. `e2e-start-page-lk3j9x`. */
export function e2eName(label: string): string {
  const suffix = Date.now().toString(36);
  return `${E2E_PREFIX}${label}-${suffix}`;
}

export function isE2eData(name: string): boolean {
  return name.startsWith(E2E_PREFIX);
}
