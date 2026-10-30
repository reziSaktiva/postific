import type { PurgeMcpAuditResult } from "../types";

/**
 * Job type registry (T-149.7) — `background-jobs.md` § JOB-08 mendaftarkan
 * tipe `mcp.audit.purge`. Payload kosong (`{}`): satu job menghapus audit
 * MCP kedaluwarsa lintas workspace. Frekuensi harian datang dari fan-out
 * `EnqueueMcpAuditPurgeUseCase`, bukan dari interval di dalam handler.
 */
export const MCP_AUDIT_PURGE_JOB_TYPE = "mcp.audit.purge";

/**
 * Port lokal: hanya `purgeAudit` yang dipakai handler. `McpAccessService`
 * cocok secara struktural, jadi handler tidak mengimpor service konkret.
 */
export interface McpAuditPurger {
  purgeAudit(): Promise<PurgeMcpAuditResult>;
  /**
   * Pembersihan jendela rate limit kedaluwarsa (T-154) menumpang job harian
   * yang sama; tidak ada cron baru. Opsional agar pemanggil lama tetap valid.
   */
  purgeRateLimitWindows?(): Promise<{ deleted: number }>;
}

/**
 * Port lokal pembersihan pilihan workspace OAuth yang kedaluwarsa (T-151).
 * `McpConsentService` cocok secara struktural.
 */
export interface McpWorkspaceChoicePurger {
  purgeExpiredWorkspaceChoices(): Promise<number>;
}

/**
 * Handler JOB-08. Tidak berisi logic selain delegasi ke
 * `McpAccessService.purgeAudit()` (retensi 90 hari ada di service),
 * `purgeRateLimitWindows()` (T-154) dan, bila disuplai,
 * `McpConsentService.purgeExpiredWorkspaceChoices()` (T-151: baris pilihan
 * workspace per sesi OAuth berumur 10 menit, kedaluwarsa sudah diabaikan saat
 * dibaca). Ketiganya dijalankan walau salah satunya gagal; error pertama
 * dilempar setelahnya. Idempoten: run kedua tanpa baris kedaluwarsa menghapus 0
 * dan tidak error. Kegagalan dilempar apa adanya
 * supaya job runner memakai retry generik (5m/15m/60m).
 */
export class McpAuditPurgeJobHandler {
  constructor(
    private readonly purger: McpAuditPurger,
    private readonly workspaceChoicePurger?: McpWorkspaceChoicePurger,
  ) {}

  /**
   * Tanpa parameter: payload JOB-08 kosong (`{}`) dan sengaja tidak
   * divalidasi, supaya payload tak terduga tidak menggagalkan purge.
   */
  async handle(): Promise<void> {
    const results = await Promise.allSettled([
      this.purger.purgeAudit(),
      this.purger.purgeRateLimitWindows?.() ?? Promise.resolve(null),
      this.workspaceChoicePurger?.purgeExpiredWorkspaceChoices() ??
        Promise.resolve(null),
    ]);
    for (const result of results) {
      if (result.status === "rejected") {
        throw result.reason;
      }
    }
  }
}
