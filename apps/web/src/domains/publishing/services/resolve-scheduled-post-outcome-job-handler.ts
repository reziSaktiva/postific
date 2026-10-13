import type { OutstandWebhookProcessor } from "./outstand-webhook-processor";

/**
 * Job type registry (T-027.5) — belum ada di daftar resmi JOB-01..JOB-04
 * `background-jobs.md` (dokumen itu ditulis sebelum redesain ACL
 * 2026-08-26/ADR-092 yang memisahkan "inisiasi" `schedulePost`/`publishNow`
 * dari "resolve outcome" `fetchPostOutcome" belakangan — lihat komentar
 * `SchedulePostsUseCase`). Penomoran berikutnya setelah JOB-05/JOB-06
 * (ADR-093, import posts) adalah **JOB-07** — job type baru ini perlu
 * ditambahkan ke `background-jobs.md` § "Job Type Registry" via ADR baru
 * oleh Gibran Project Manager, BUKAN diputuskan/dicatat sendiri di sini
 * (AGENTS.md #4/#17 rule 19 pattern — dilaporkan, bukan diam-diam
 * memperluas baseline).
 */
export const RESOLVE_SCHEDULED_POST_OUTCOME_JOB_TYPE =
  "publishing.scheduled_post.resolve_outcome";

/**
 * Prefix penanda `lastError` untuk kasus "masih pending, retry nanti" (BUKAN
 * kegagalan sungguhan) — monitoring MVP untuk `background_jobs` murni query
 * manual `status = 'failed'` (BG-D06), dan tanpa prefix ini dead-letter
 * "masih pending" (outcome yang diharapkan/benign, lihat catatan panjang di
 * bawah) tidak bisa dibedakan dari bug/error sungguhan hanya dari `status`.
 * Query monitoring bisa `WHERE last_error NOT LIKE 'PENDING_TIMEOUT: %'`
 * untuk menyaring dead-letter yang benar-benar butuh perhatian.
 */
export const PENDING_TIMEOUT_ERROR_PREFIX = "PENDING_TIMEOUT: ";

export interface ResolveScheduledPostOutcomeJobPayload {
  outstandPostId: string;
}

function parsePayload(payload: unknown): ResolveScheduledPostOutcomeJobPayload {
  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as { outstandPostId?: unknown }).outstandPostId !== "string"
  ) {
    throw new Error(
      `Payload job "${RESOLVE_SCHEDULED_POST_OUTCOME_JOB_TYPE}" tidak valid — ` +
        `diharapkan { outstandPostId: string }, dapat: ${JSON.stringify(payload)}`,
    );
  }
  return {
    outstandPostId: (payload as { outstandPostId: string }).outstandPostId,
  };
}

/**
 * Job handler T-027.5 — "publish scheduled post saat waktunya tiba".
 *
 * **Klarifikasi desain penting (dievaluasi sendiri, bukan tebakan liar —
 * lihat catatan di `SchedulePostsUseCase` dan laporan task untuk King
 * Rezi):** teks task T-027.5 berbunyi literal "publish scheduled post",
 * tapi publish-nya SENDIRI sudah terjadi di sisi Outstand lewat
 * `outstandAdapter.schedulePost()` yang dipanggil DI MUKA saat
 * `SchedulePostsUseCase.execute()` (bukan saat due) — kontrak resmi
 * Outstand (ADR-092) melakukan scheduling di sisi mereka. Yang BELUM
 * diketahui saat itu adalah OUTCOME per akun (published/failed), yang
 * baru bisa dibaca belakangan lewat `fetchPostOutcome` (polling, T-027)
 * atau webhook `post.published`/`post.error` (T-026). Job handler ini
 * karena itu MERESOLVE OUTCOME, bukan memicu publish — reuse penuh
 * `OutstandWebhookProcessor.resolvePostOutcome` (logika yang sama persis
 * dipakai webhook T-026) supaya tidak ada dua implementasi mapping
 * outcome→status yang bisa divergen.
 *
 * **Desain job-per-post (bukan scan-tick):** `SchedulePostsUseCase`
 * meng-enqueue SATU `BackgroundJob` row per post yang berhasil dijadwalkan
 * (`scheduledAt` job = `scheduledAt` post), payload `{ outstandPostId }` —
 * BUKAN JobRunner yang setiap tick men-scan tabel `PublishingPost` untuk
 * yang due (pola JOB-03/04 "generate on each cron tick" per
 * `ConnectedAccount` aktif). Alasan: kolom `background_jobs.scheduled_at`
 * ("waktu job boleh dieksekusi, untuk delay/retry") sudah persis didesain
 * untuk kasus per-item dengan waktu due individual seperti ini — beda dari
 * JOB-03/04 yang periodic per akun tanpa "due time" individual per item.
 * Payload memakai `outstandPostId` (bukan `postId` domain) supaya bisa
 * REUSE LANGSUNG fungsi Postgres `SECURITY DEFINER`
 * `webhook_find_post_targets_by_outstand_post_id` (ADR-099, T-026) tanpa
 * membuat fungsi baru — job runner (Railway Cron) sama seperti webhook
 * tidak punya acting `userId` sebelum lookup ini resolve, persis skenario
 * yang diantisipasi ADR-099 sebagai preseden wajib dipakai ulang.
 *
 * **Retry sebagai mekanisme "masih pending" (bukan cuma error sungguhan):**
 * kalau setelah `resolvePostOutcome` masih ada target berstatus "pending"
 * di sisi Outstand (`targetsResolved < targetsTotal`), handler ini THROW
 * supaya job runner (T-027.3) menjadwalkan ulang dengan backoff (5m/15m/
 * 60m) — pragmatis me-reuse mekanisme retry generik sebagai "polling
 * ulang nanti" alih-alih membuat state "masih menunggu" terpisah di luar
 * `attempts`/`scheduledAt` yang sudah ada. Post yang tetap "pending" di
 * SEMUA percobaan (habis `maxAttempts`) akan dead-letter (`status=failed`
 * di `background_jobs`, BUKAN mengubah status domain post) — outcome
 * sungguhan post itu sendiri tetap bisa menyusul lewat webhook T-026
 * kapan pun (dua jalur ini independen/komplementer, bukan
 * saling-menggantikan, sesuai desain `integration-layer.md`).
 *
 * **Post sudah tidak lagi relevan (Cancel Schedule, atau outcome-nya
 * sudah lengkap duluan lewat webhook):** `resolvePostOutcome` mengembalikan
 * `skipped_no_match` kalau `outstandPostId` job ini tidak lagi cocok
 * dengan post manapun (`Cancel Schedule` menghapus SELURUH
 * `PublishingPostTarget` post itu — JOIN di fungsi lookup otomatis kosong;
 * reschedule ke `outstandPostId` baru juga membuat filter tidak match
 * lagi) — handler menganggap ini SELESAI (bukan error), tidak retry.
 */
export class ResolveScheduledPostOutcomeJobHandler {
  constructor(private readonly processor: OutstandWebhookProcessor) {}

  async handle(rawPayload: unknown): Promise<void> {
    const { outstandPostId } = parsePayload(rawPayload);

    const result = await this.processor.resolvePostOutcome(outstandPostId, {
      // Beda dari webhook: job polling ini SELALU notify kalau semua
      // target yang sudah diketahui gagal — lihat catatan panjang
      // `notifyOnFailure` di `OutstandWebhookProcessor.resolvePostOutcome`.
      notifyOnFailure: true,
    });

    if (result.outcome === "skipped_no_match") {
      // Post sudah di-cancel / outstandPostId sudah berganti (reschedule) —
      // tidak ada lagi yang perlu dikerjakan, job ini selesai (bukan gagal).
      return;
    }

    const targetsTotal = result.targetsTotal ?? 0;
    const targetsResolved = result.targetsResolved ?? 0;
    if (targetsResolved < targetsTotal) {
      // Masih ada target berstatus "pending" di sisi Outstand — throw
      // supaya job runner retry dengan backoff (T-027.3), bukan permanent
      // failure. Lihat catatan panjang di atas class ini.
      throw new Error(
        `${PENDING_TIMEOUT_ERROR_PREFIX}Outcome post (outstandPostId=${outstandPostId}) belum lengkap: ` +
          `${targetsResolved}/${targetsTotal} target resolved — retry nanti.`,
      );
    }
  }
}
