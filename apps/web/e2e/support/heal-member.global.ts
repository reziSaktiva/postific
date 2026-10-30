import { mcpSkipReason, scrub } from "./mcp";
import {
  hasDbConnection,
  probeSandboxMember,
  restoreMemberActive,
} from "./member-db";

/**
 * `globalSetup` Playwright (T-178): pulihkan member akun test yang tertinggal
 * `removed` di workspace "E2E Sandbox" (sisa skenario (f) yang terhenti).
 *
 * Harus jalan SEBELUM proyek `setup`: bila member masih `removed`,
 * `ensureE2eWorkspaceActive` (`auth.setup.ts`) tidak melihat workspace itu dan
 * membuat "E2E Sandbox" KEDUA, yang membuat probe gagal ("tidak tepat satu")
 * dan (f) di-skip permanen sampai workspace ganda dihapus manual. Karena itu
 * penyembuhan tidak boleh ada di `beforeAll` berkas tes.
 *
 * Hanya bila target staging dan ada koneksi DB yang boleh dipakai; selain itu
 * tidak melakukan apa pun (mis. CI, yang tidak punya variabel DB). Kegagalan
 * hanya dicatat. Bila baris member tidak terlihat (0) atau ganda (2+), itu
 * dicatat sebagai peringatan supaya tidak diam: di bawah `app_runtime` baris
 * `removed` memang tidak terlihat dan tidak bisa dipulihkan otomatis (RUNBOOK di
 * `member-db.ts`).
 */
export default async function healLeftoverRemovedMember(): Promise<void> {
  const email = process.env.E2E_USER_EMAIL;
  if (!email || mcpSkipReason() !== null || !hasDbConnection()) return;
  try {
    const probe = await probeSandboxMember(email);
    if (!probe.ok) {
      if (probe.memberRows !== undefined && probe.memberRows !== 1) {
        console.warn(
          `[mcp.e2e] heal: baris member E2E di "E2E Sandbox" ${probe.memberRows === 0 ? "tidak terlihat (mungkin tertinggal removed)" : `ganda (${probe.memberRows})`}; pulihkan manual bila run sebelumnya terhenti: lihat RUNBOOK di support/member-db.ts`,
        );
      }
      return;
    }
    if (probe.ref.status !== "removed") return;
    console.warn(
      `[mcp.e2e] heal: member E2E tertinggal "removed" (sisa run terhenti); memulihkan ke active lewat ${probe.ref.connectionVar}`,
    );
    await restoreMemberActive(probe.ref);
    console.warn("[mcp.e2e] heal: member E2E dipulihkan ke active");
  } catch (error) {
    console.warn(
      `[mcp.e2e] heal dilewati: ${error instanceof Error ? scrub(error.message) : "galat tak dikenal"}`,
    );
  }
}
