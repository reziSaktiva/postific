import { retryDelayMs } from "./backoff";
import type { ClaimedBackgroundJob } from "./background-job-store";

/**
 * JobRunner generik (T-027.1/.2/.3) — `POST /api/jobs/run` Route Handler
 * (composition root) menyuplai `store` (Prisma, `background-job-store.ts`)
 * dan `handlers` (registry `type → handler`, dirakit di route.ts dari
 * Application Service tiap domain, mis. `ResolveScheduledPostOutcomeJobHandler`
 * untuk T-027.5). Modul ini sendiri TIDAK mengimpor domain/Prisma apa pun
 * secara langsung — murni orkestrasi generik, supaya:
 * 1. Testable tanpa DB nyata (`store`/`handlers` di-mock di unit test).
 * 2. Bisa menampung job type lain nanti (JOB-01/02/03/04/05/06, kalau
 *    dipindah dari inline ke enqueue+async) tanpa mengubah file ini sama
 *    sekali — cukup daftar handler baru di composition root.
 *
 * **Tidak mengimpor dari `@/domains/*` maupun `@/generated/prisma/*`** —
 * lihat `JobRunnerStore`/`JobHandler` di bawah, keduanya port lokal murni
 * struktural (bukan re-export tipe Prisma), konsisten prinsip "domain
 * TIDAK diimpor infra generik" walau modul ini sendiri infra (bukan
 * domain) — tetap dijaga supaya reusable dan gampang di-unit-test.
 */

export type JobHandler = (payload: unknown) => Promise<void>;

export interface JobRunnerStore {
  claimPending(limit: number): Promise<ClaimedBackgroundJob[]>;
  markDone(id: string): Promise<void>;
  scheduleRetry(
    id: string,
    input: { attempts: number; scheduledAt: Date; error: string },
  ): Promise<void>;
  markFailed(
    id: string,
    input: { attempts: number; error: string },
  ): Promise<void>;
}

export type JobRunOutcome = "done" | "retry" | "dead_lettered" | "no_handler";

export interface JobRunResult {
  id: string;
  type: string;
  outcome: JobRunOutcome;
  error?: string;
}

export interface JobRunSummary {
  claimed: number;
  results: JobRunResult[];
}

/** BG-D05 — max 10 job per run, mencegah timeout Railway (batas request 30 detik). */
export const DEFAULT_JOB_BATCH_LIMIT = 10;

/**
 * Eksekusi SATU job yang sudah diklaim (status `running`) — tidak pernah
 * throw (semua error ditangkap di sini dan dipetakan ke
 * `scheduleRetry`/`markFailed`), supaya `Promise.all` di `runPendingJobs`
 * aman menjalankan seluruh batch PARALEL tanpa satu job gagal
 * menggagalkan job lain di batch yang sama (beda job = independen
 * sepenuhnya, tidak ada alasan menjalankannya sekuensial — penting untuk
 * batas waktu Railway 30 detik per request, BG-D05).
 */
async function runOne(
  store: JobRunnerStore,
  handlers: Record<string, JobHandler>,
  job: ClaimedBackgroundJob,
  now: () => Date,
): Promise<JobRunResult> {
  const handler = handlers[job.type];
  if (!handler) {
    // Tipe job tidak terdaftar sama sekali — kesalahan konfigurasi
    // internal (deploy tanpa handler baru terdaftar, typo tipe, dst.),
    // BUKAN kegagalan transient — retry tidak akan pernah membantu.
    // Dead-letter langsung (skip perhitungan attempts/backoff).
    const error = `Tidak ada job handler terdaftar untuk type "${job.type}".`;
    await store.markFailed(job.id, { attempts: job.attempts, error });
    return { id: job.id, type: job.type, outcome: "no_handler", error };
  }

  try {
    await handler(job.payload);
    await store.markDone(job.id);
    return { id: job.id, type: job.type, outcome: "done" };
  } catch (rawError) {
    const error =
      rawError instanceof Error ? rawError.message : String(rawError);
    const attempts = job.attempts + 1;

    if (attempts >= job.maxAttempts) {
      // BG-D06 — dead letter, tidak retry otomatis lagi.
      await store.markFailed(job.id, { attempts, error });
      return { id: job.id, type: job.type, outcome: "dead_lettered", error };
    }

    const scheduledAt = new Date(now().getTime() + retryDelayMs(attempts));
    await store.scheduleRetry(job.id, { attempts, scheduledAt, error });
    return { id: job.id, type: job.type, outcome: "retry", error };
  }
}

/**
 * T-027.1 — klaim batch job due, eksekusi via handler registry, update
 * status masing-masing (done/retry/dead-letter). Dipanggil oleh
 * `POST /api/jobs/run` SETELAH otentikasi `X-Job-Secret` (T-027.2) sukses.
 */
export async function runPendingJobs(
  store: JobRunnerStore,
  handlers: Record<string, JobHandler>,
  options?: { limit?: number; now?: () => Date },
): Promise<JobRunSummary> {
  const limit = options?.limit ?? DEFAULT_JOB_BATCH_LIMIT;
  const now = options?.now ?? (() => new Date());

  const jobs = await store.claimPending(limit);
  const results = await Promise.all(
    jobs.map((job) => runOne(store, handlers, job, now)),
  );

  return { claimed: jobs.length, results };
}
