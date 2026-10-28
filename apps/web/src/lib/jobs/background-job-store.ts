import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";

/**
 * Persistence infra untuk `BackgroundJob` (T-027, `background-jobs.md`).
 * Sama pola dengan `outstandWebhookReceiptStore`
 * (`src/lib/webhooks/outstand-webhook-receipt-store.ts`): tabel
 * `background_jobs` system-internal, TIDAK memakai RLS (lihat catatan
 * "Tables intentionally WITHOUT workspace-isolation RLS" di migration
 * `20260813045625_t017_add_rls_policies`) — modul ini boleh memakai Prisma
 * langsung tanpa melanggar AGENTS.md #6 (yang melarang DOMAIN logic
 * mengimpor Prisma); ini infra, bukan domain logic, dan tidak butuh
 * `withCurrentUser`/`app.current_user_id` sama sekali untuk tabel ini
 * sendiri (beda dari tabel tenant-scoped seperti `publishing_posts` yang
 * job HANDLER-nya baca/tulis — itu tetap lewat `IPublishingRepository`
 * seperti biasa, lihat `ResolveScheduledPostOutcomeJobHandler`).
 */

export interface ClaimedBackgroundJob {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
}

interface ClaimedJobRow {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
}

/**
 * BG-D04 (`background-jobs.md`) — job timeout: kalau proses mati (restart
 * Railway, OOM) setelah `claimPending` menandai job `running` tapi sebelum
 * `runOne` sempat memanggil `markDone`/`scheduleRetry`/`markFailed`, job itu
 * harus di-reclaim, bukan macet permanen di `running` (tidak ada jalur lain
 * yang pernah membacanya lagi karena `claimPending` hanya menyeleksi
 * `status = 'pending'`).
 */
const STALE_RUNNING_TIMEOUT_SECONDS = 30;

export const backgroundJobStore = {
  /** T-027.5 — dipanggil `job-scheduler.ts` (implementasi `IJobScheduler`). */
  async enqueue(input: {
    type: string;
    payload: Record<string, unknown>;
    scheduledAt: Date;
  }): Promise<void> {
    await prisma.backgroundJob.create({
      data: {
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
        scheduledAt: input.scheduledAt,
      },
    });
  },

  /**
   * Cek apakah sudah ada job `type` dengan `payload[key] === value` yang
   * masih `pending`/`running` — dipakai composition root sebelum men-seed
   * job self-reschedule (mis. `engagement.sync`) supaya disconnect→reconnect
   * cepat pada `ConnectedAccount` yang sama tidak membuat dua chain paralel
   * (tidak ada apa pun yang membatalkan chain lama saat disconnect).
   *
   * `staleAfterMs` (opsional, code review PR #148) — kalau diisi, baris
   * `pending`/`running` yang lebih tua dari ini TIDAK dihitung aktif lagi.
   * Dipakai caller yang job-nya diproses SINKRON dalam satu request (bukan
   * lewat `claimPending`/job-runner, yang sudah punya reclaim sendiri lewat
   * `STALE_RUNNING_TIMEOUT_SECONDS` di atas) supaya satu kegagalan menulis
   * status akhir tidak mengunci guard ini selamanya. Default (tidak diisi):
   * perilaku lama, tidak ada batas waktu.
   */
  async hasActiveJobForPayloadKey(input: {
    type: string;
    key: string;
    value: string;
    staleAfterMs?: number;
  }): Promise<boolean> {
    const existing = await prisma.backgroundJob.findFirst({
      where: {
        type: input.type,
        status: { in: ["pending", "running"] },
        payload: { path: [input.key], equals: input.value },
        ...(input.staleAfterMs !== undefined
          ? { createdAt: { gte: new Date(Date.now() - input.staleAfterMs) } }
          : {}),
      },
      select: { id: true },
    });

    return existing !== null;
  },

  /**
   * Sama seperti `hasActiveJobForPayloadKey`, dengan mode harian (T-048):
   * kalau `createdSince` diisi, job dihitung sudah ada bila dibuat sejak
   * waktu itu (status apa pun) atau masih `pending`/`running` dari hari
   * sebelumnya. Tanpa `createdSince`, hanya `pending`/`running`.
   */
  async hasJobMatchingPayloadKey(input: {
    type: string;
    key: string;
    value: string;
    createdSince?: Date;
  }): Promise<boolean> {
    const existing = await prisma.backgroundJob.findFirst({
      where: {
        type: input.type,
        payload: { path: [input.key], equals: input.value },
        ...(input.createdSince
          ? {
              OR: [
                { createdAt: { gte: input.createdSince } },
                { status: { in: ["pending", "running"] } },
              ],
            }
          : { status: { in: ["pending", "running"] } }),
      },
      select: { id: true },
    });

    return existing !== null;
  },

  /**
   * Varian `hasJobMatchingPayloadKey` untuk job tanpa kunci payload (mis.
   * JOB-08 `mcp.audit.purge`, payload `{}`): kalau `createdSince` diisi, job
   * dihitung sudah ada bila dibuat sejak waktu itu (status apa pun) atau
   * masih `pending`/`running`. Tanpa `createdSince`, hanya `pending`/`running`.
   */
  async hasJobOfType(input: {
    type: string;
    createdSince?: Date;
  }): Promise<boolean> {
    const existing = await prisma.backgroundJob.findFirst({
      where: {
        type: input.type,
        ...(input.createdSince
          ? {
              OR: [
                { createdAt: { gte: input.createdSince } },
                { status: { in: ["pending", "running"] } },
              ],
            }
          : { status: { in: ["pending", "running"] } }),
      },
      select: { id: true },
    });

    return existing !== null;
  },

  /**
   * T-027.1 — klaim batch job `pending` yang sudah due
   * (`scheduled_at <= now()`), locking aman untuk eksekusi paralel via
   * `SELECT ... FOR UPDATE SKIP LOCKED` (BG-D03, `background-jobs.md` §
   * "Concurrency & Locking") — dua instance `web` (atau dua overlapping
   * cron trigger) yang memanggil ini bersamaan TIDAK akan mengambil job
   * yang sama. Prisma Client API tidak punya locking clause ini secara
   * native, jadi SELECT-nya raw SQL, tapi tetap dalam SATU
   * `$transaction` interaktif bersama `updateMany` supaya lock dipegang
   * sampai status berubah jadi `running` (mencegah race antara SELECT dan
   * UPDATE terpisah).
   */
  async claimPending(limit: number): Promise<ClaimedBackgroundJob[]> {
    return prisma.$transaction(async (tx) => {
      // BG-D04 — reclaim job yang macet di `running` melewati timeout
      // (>30 detik): kembalikan ke `pending` dengan `attempts + 1` supaya
      // bisa diambil lagi oleh SELECT di bawah pada run yang sama.
      await tx.$executeRaw`
        UPDATE "background_jobs"
        SET status = 'pending',
            attempts = attempts + 1,
            scheduled_at = now()
        WHERE status = 'running'
          AND started_at <= now() - (${STALE_RUNNING_TIMEOUT_SECONDS} * interval '1 second')
      `;

      const rows = await tx.$queryRaw<ClaimedJobRow[]>`
        SELECT id, type, payload, attempts, max_attempts
        FROM "background_jobs"
        WHERE status = 'pending' AND scheduled_at <= now()
        ORDER BY created_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `;

      if (rows.length === 0) {
        return [];
      }

      await tx.backgroundJob.updateMany({
        where: { id: { in: rows.map((row) => row.id) } },
        data: { status: "running", startedAt: new Date() },
      });

      return rows.map((row) => ({
        id: row.id,
        type: row.type,
        payload: row.payload,
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
      }));
    });
  },

  /** T-027.1 — handler berhasil, tidak ada lagi yang perlu dilakukan untuk job ini. */
  async markDone(id: string): Promise<void> {
    await prisma.backgroundJob.update({
      where: { id },
      data: { status: "done", completedAt: new Date(), lastError: null },
    });
  },

  /**
   * T-027.3 — retry internal dengan backoff: `attempts` sudah
   * di-increment oleh caller (`job-runner.ts`, sebelum menghitung delay),
   * status kembali ke `pending` dengan `scheduled_at` baru (`now() + delay`)
   * supaya `claimPending` berikutnya (setelah delay lewat) mengambilnya
   * lagi — BUKAN dieksekusi ulang segera.
   */
  async scheduleRetry(
    id: string,
    input: { attempts: number; scheduledAt: Date; error: string },
  ): Promise<void> {
    await prisma.backgroundJob.update({
      where: { id },
      data: {
        status: "pending",
        attempts: input.attempts,
        scheduledAt: input.scheduledAt,
        lastError: input.error,
      },
    });
  },

  /**
   * T-027.3 — dead letter: `attempts >= maxAttempts`, tidak ada retry
   * otomatis lagi (BG-D06, `background-jobs.md`). Monitoring MVP murni
   * manual (query `status = 'failed'` / Railway dashboard), tidak ada
   * alerting di sini.
   */
  async markFailed(
    id: string,
    input: { attempts: number; error: string },
  ): Promise<void> {
    await prisma.backgroundJob.update({
      where: { id },
      data: {
        status: "failed",
        attempts: input.attempts,
        completedAt: new Date(),
        lastError: input.error,
      },
    });
  },
};
