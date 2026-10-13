import type { ConnectedAccountId, WorkspaceId } from "@postific/shared";

/**
 * Import Posts dari Social Account (T-090, ADR-093 poin 7-9) — repository
 * terpisah dari `IPublishingRepository` karena backing table-nya
 * (`background_jobs`) adalah tabel SISTEM generic (reuse sebagai audit log,
 * BUKAN skema counter baru, ADR-093 "Alternatives Considered") — bukan
 * tabel domain `publishing` murni seperti `publishing_posts`. Interface ini
 * HANYA mencakup operasi yang dibutuhkan JOB-05 (Import Posts Trigger,
 * tipe `import.sync`); tidak dimaksudkan sebagai repository generic untuk
 * SEMUA job type (YAGNI, konsisten ADR-059 poin 5).
 *
 * `background_jobs` TIDAK punya RLS (`system-internal queue, not
 * workspace-scoped`, lihat migration T-017) — method di bawah ini TIDAK
 * menerima `userId`/`withCurrentUser`, berbeda dari method
 * `IPublishingRepository` lain.
 */

export type ImportSyncTrigger = "auto" | "periodic" | "manual";
export type ImportSyncJobStatus = "pending" | "running" | "done" | "failed";

export interface ImportSyncJobPayload {
  workspaceId: WorkspaceId;
  connectedAccountId: ConnectedAccountId;
  outstandAccountId: string;
  trigger: ImportSyncTrigger;
  /** ISO string — rentang yang diminta untuk `importPosts` (bukan `Date`, JSON kolom `payload` menyimpan string). */
  since: string;
  until: string;
}

export interface ImportSyncJobRecord {
  id: string;
  payload: ImportSyncJobPayload;
  status: ImportSyncJobStatus;
  createdAt: Date;
}

export interface IImportJobRepository {
  /**
   * Insert baris `background_jobs` baru (`type: "import.sync"`, ADR-093
   * poin 7) berstatus `pending` — dipanggil SEBELUM
   * `IOutstandAdapter.importPosts` (urutan "persist dulu, network call
   * sesudah", konsisten `schedulePost`/`publishNow`). Dipakai sebagai audit
   * log DAN sumber hitung cap mingguan (`countManualImportSyncJobsSince`).
   *
   * Melempar `ConflictError` (`@/lib/utils/errors`) kalau partial unique
   * index `background_jobs_active_import_sync_account_key` (migration
   * `20261008130000_t090_concurrent_import_guard`) menolak insert —
   * code review PR #148 (finding #2): `hasActiveImportSyncJob` adalah soft
   * pre-check (TOCTOU), constraint DB ini adalah gate sebenarnya untuk dua
   * trigger yang nyaris bersamaan. Caller (`runImportSync`) menangkap error
   * ini dan mengembalikan `outcome: "rejected_concurrent"`.
   */
  createImportSyncJob(
    payload: ImportSyncJobPayload,
  ): Promise<ImportSyncJobRecord>;

  /**
   * Update status job SETELAH `importPosts`/`fetchImportJobStatus`/
   * `ImportPostsProcessUseCase` resolve. `done` berarti SELURUH alur
   * (trigger + process) sukses; `failed` membawa `lastError` untuk audit.
   */
  markImportSyncJobStatus(
    jobId: string,
    status: "running" | "done" | "failed",
    lastError?: string,
  ): Promise<void>;

  /**
   * Guard concurrent-import per akun (ADR-093 poin 8) — true kalau ada
   * `import.sync` job untuk `connectedAccountId` ini yang BELUM mencapai
   * status terminal (`pending`/`running`). Karena `ImportPostsTriggerUseCase`
   * memproses JOB-05+JOB-06 SINKRON dalam satu pemanggilan (Fake instant,
   * belum ada queue/cron asli — lihat catatan di `ImportPostsTriggerUseCase`),
   * baris HANYA pernah berstatus `pending`/`running` selama eksekusi
   * `execute()` itu sendiri sedang berjalan — guard ini terutama
   * melindungi dari concurrent CALL (dua request/tab Sync Now yang
   * tumpang tindih), bukan job async yang benar-benar lama di real
   * adapter (T-025 follow-up: real adapter polling/webhook akan
   * memperpanjang window `pending`/`running` ini secara alami, guard yang
   * sama tetap berlaku tanpa perubahan).
   *
   * Code review PR #148 (finding #4) — implementasi membatasi "aktif" ke
   * job yang dibuat dalam beberapa menit terakhir (lihat
   * `STALE_IMPORT_SYNC_JOB_TIMEOUT_MS` di Prisma impl), supaya baris yang
   * macet (mis. `markImportSyncJobStatus` di catch block `runImportSync`
   * sendiri gagal menulis status akhir) tidak mengunci akun ini dari
   * sinkronisasi berikutnya selamanya.
   */
  hasActiveImportSyncJob(
    connectedAccountId: ConnectedAccountId,
  ): Promise<boolean>;

  /**
   * Cap mingguan level-workspace (ADR-093 poin 9) — COUNT `background_jobs`
   * bertipe `import.sync` dengan `payload.trigger = "manual"` milik
   * `workspaceId` ini dalam 7 hari terakhir (`createdAt >= since`), lintas
   * SEMUA akun (bukan per akun). Guard "paling dominan" — ditegakkan
   * SEBELUM cooldown per-akun di `ImportPostsTriggerUseCase`.
   *
   * Code review PR #148 (finding #3) — job berstatus `failed` TIDAK
   * dihitung: cap ini dimaksudkan membatasi PEMAKAIAN (endpoint berbayar),
   * bukan menghukum percobaan yang gagal di sisi infrastruktur kita sendiri
   * (mis. adapter belum di-wire, ADR-119).
   */
  countManualImportSyncJobsSince(
    workspaceId: WorkspaceId,
    since: Date,
  ): Promise<number>;
}
