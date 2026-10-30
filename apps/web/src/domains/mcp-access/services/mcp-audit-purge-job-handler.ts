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
 * `McpAccessService.purgeAudit()` (retensi 90 hari ada di service) dan, bila
 * disuplai, `McpConsentService.purgeExpiredWorkspaceChoices()` (T-151: baris
 * pilihan workspace per sesi OAuth berumur 10 menit, jadi pembersihan harian
 * cukup; kedaluwarsa sudah diabaikan saat dibaca). Idempoten: run kedua tanpa
 * baris kedaluwarsa menghapus 0 dan tidak error. Kegagalan dilempar apa adanya
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
    await this.purger.purgeAudit();
    await this.workspaceChoicePurger?.purgeExpiredWorkspaceChoices();
  }
}
