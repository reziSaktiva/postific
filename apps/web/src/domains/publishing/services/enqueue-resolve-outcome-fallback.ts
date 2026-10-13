import type { IJobScheduler } from "../adapters/job-scheduler";
import { RESOLVE_SCHEDULED_POST_OUTCOME_JOB_TYPE } from "./resolve-scheduled-post-outcome-job-handler";

/**
 * Helper bersama (code-review PR #141, KI-025) — dulu diduplikasi hand-copy
 * di `SchedulePostsUseCase` dan `PublishNowUseCase` (shape identik: guard →
 * `jobScheduler.scheduleJob` → try/catch sendiri → `console.error` log-only
 * saat gagal). Diekstrak supaya use-case BARU yang juga memanggil
 * `schedulePost`/`publishNow`/`fetchPostOutcome` tidak perlu lagi
 * mengingat-mengarang ulang pola ini dari nol — persis cara KI-025 asli
 * terjadi (`PublishNowUseCase` lupa meniru pola yang sudah ada di
 * `SchedulePostsUseCase`).
 *
 * WAJIB dipanggil di LUAR try/catch yang menangani kegagalan
 * `outstandAdapter.schedulePost`/`publishNow`/`fetchPostOutcome` di
 * caller — kegagalan enqueue job ini murni gagal mencatat job internal
 * untuk polling belakangan, BUKAN kegagalan publish/schedule, jadi hanya
 * di-log, tidak pernah menandai post/target sebagai `failed`.
 */
export async function enqueueResolveOutcomeFallback(input: {
  jobScheduler: IJobScheduler;
  outstandPostId: string;
  scheduledAt: Date;
  /** Nama class pemanggil, untuk prefix log (`[SchedulePostsUseCase]` dst). */
  callerLabel: string;
  postId: string;
  /** Kalimat penutup log yang menjelaskan status post TIDAK berubah. */
  onFailureNote: string;
}): Promise<void> {
  try {
    await input.jobScheduler.scheduleJob({
      type: RESOLVE_SCHEDULED_POST_OUTCOME_JOB_TYPE,
      payload: { outstandPostId: input.outstandPostId },
      scheduledAt: input.scheduledAt,
    });
  } catch (jobError) {
    const message =
      jobError instanceof Error ? jobError.message : String(jobError);
    console.error(
      `[${input.callerLabel}] gagal enqueue job resolve-outcome ` +
        `(postId=${input.postId}, outstandPostId=${input.outstandPostId}): ` +
        `${message} — ${input.onFailureNote}`,
    );
  }
}
