/**
 * Port lokal (T-027, background jobs) — `SchedulePostsUseCase` butuh
 * meng-enqueue satu job "resolve outcome nanti" (T-027.5) SETELAH
 * `outstandAdapter.schedulePost()` sukses, tapi domain `publishing` TIDAK
 * boleh mengimpor Prisma/`background_jobs` langsung (AGENTS.md #6) —
 * implementasi konkret (`apps/web/src/lib/jobs/job-scheduler.ts`, Prisma
 * `BackgroundJob`) di-supply composition root (Server Action), pola yang
 * sama dengan `IOutstandAdapter` sebelum promosinya ke `@postific/shared`
 * (ADR-079) dan `WorkspaceReconnectPort`/`NotificationPort` di
 * `OutstandWebhookProcessor`.
 *
 * Ini TIDAK dipromosikan ke `@postific/shared` seperti `IOutstandAdapter` —
 * belum ada domain lain yang butuh (YAGNI, sama alasan ADR-059/ADR-079
 * sebelum promosi). Kalau nanti JOB-01/JOB-02/dst. benar-benar dipindah
 * dari inline sync ke enqueue+async (lihat catatan gap di
 * `OutstandWebhookProcessor`), port ini kandidat kuat untuk dipromosikan.
 */
export interface ScheduleJobInput {
  /**
   * Tipe job (lihat Job Type Registry `background-jobs.md`). String biasa
   * (bukan enum union) di level port ini — job runner (`apps/web/src/lib/jobs/`)
   * yang memvalidasi/mendaftarkan handler per tipe, domain hanya butuh
   * mengirim konstanta yang benar (`RESOLVE_SCHEDULED_POST_OUTCOME_JOB_TYPE`).
   */
  type: string;
  /** Payload JSONB — bentuk konkret ditentukan tiap job type, lihat handler masing-masing. */
  payload: Record<string, unknown>;
  /** Waktu job boleh dieksekusi pertama kali (kolom `background_jobs.scheduled_at`). */
  scheduledAt: Date;
}

export interface IJobScheduler {
  scheduleJob(input: ScheduleJobInput): Promise<void>;
}
