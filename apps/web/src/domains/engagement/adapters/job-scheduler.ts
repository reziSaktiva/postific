/**
 * Port lokal (T-051, background jobs) — `EngagementSyncJobHandler` butuh
 * meng-enqueue job berikutnya (self-reschedule, siklus 30 menit) SETELAH
 * satu sync sukses, tapi domain `engagement` TIDAK boleh mengimpor
 * Prisma/`background_jobs` langsung (AGENTS.md #6).
 *
 * Bentuk field PERSIS SAMA dengan `IJobScheduler`/`ScheduleJobInput` di
 * `domains/publishing/adapters/job-scheduler.ts` — didefinisikan ulang di
 * sini (bukan import lintas domain, AGENTS.md #7: cross-domain harus lewat
 * public API barrel, bukan file internal domain lain) supaya `engagement`
 * tidak punya dependency langsung ke `publishing` hanya demi satu tipe
 * port yang sebetulnya generic. Implementasi konkret di composition root
 * (`/api/jobs/run/route.ts`) di-REUSE dari `backgroundJobScheduler`
 * (`@/lib/jobs/job-scheduler`, singleton yang sama dipakai `publishing`) —
 * struktural identik jadi satu objek itu valid untuk kedua interface tanpa
 * perlu implementasi/file terpisah (TypeScript structural typing).
 */
export interface ScheduleJobInput {
  /** Tipe job (Job Type Registry `background-jobs.md`) — job runner yang memvalidasi/mendaftarkan handler per tipe. */
  type: string;
  /** Payload JSONB — bentuk konkret ditentukan tiap job type. */
  payload: Record<string, unknown>;
  /** Waktu job boleh dieksekusi (kolom `background_jobs.scheduled_at`). */
  scheduledAt: Date;
}

export interface IJobScheduler {
  scheduleJob(input: ScheduleJobInput): Promise<void>;
}
