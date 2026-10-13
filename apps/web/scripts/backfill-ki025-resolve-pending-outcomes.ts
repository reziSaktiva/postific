/**
 * Backfill one-off — KI-025 (follow-up) item 3 (`PROJECT_STATE.md` § Blockers).
 *
 * `PublishNowUseCase` (sebelum fix 2026-10-05) tidak pernah enqueue job
 * `resolve_outcome` untuk target yang outcome-nya masih "pending" saat
 * `fetchPostOutcome` dipanggil — akibatnya 5 `PublishingPostTarget` baris
 * (workspace `b28e4284-39e5-4d24-ad27-32c2cb286880`, ditemukan via query
 * staging `publishing_post_targets WHERE status = 'pending'`) stuck
 * `"pending"` permanen sejak 2026-09-25/26, padahal outcome aslinya di
 * Outstand sudah lama resolve (dikonfirmasi manual lewat `get_post` sebelum
 * script ini ditulis — 4 `published`, 1 `failed`).
 *
 * Script ini REUSE `OutstandWebhookProcessor.resolvePostOutcome` (logika
 * yang SAMA PERSIS dipakai webhook T-026 dan job handler T-027.5) — bukan
 * UPDATE SQL manual — supaya resolusi outcome, transisi status post
 * (`markPostFailed` kalau semua target gagal), dan notifikasi tetap lewat
 * satu jalur domain yang sudah diuji, tidak ada logika kedua yang bisa
 * divergen.
 *
 * Jalankan SEKALI dari `apps/web`:
 *   bun --env-file=.env.local run scripts/backfill-ki025-resolve-pending-outcomes.ts
 *
 * Aman dijalankan ulang (idempotent) — `resolvePostOutcome` skip target
 * yang outcome-nya sudah bukan "pending" di DB kita? TIDAK — ia selalu
 * fetch ulang ke Outstand dan overwrite dengan outcome TERBARU; untuk 5
 * post ini outcome-nya sudah final di sisi Outstand (published/failed),
 * jadi re-run tidak mengubah apa pun selain `updatedAt`.
 */
import { OutstandWebhookProcessor } from "@/domains/publishing";
import { NotificationService } from "@/domains/notification";
import { getOutstandAdapter } from "@/lib/adapters/outstand";
import { notificationRepository } from "@/lib/repositories/notification";
import { publishingRepository } from "@/lib/repositories/publishing";
import { workspaceRepository } from "@/lib/repositories/workspace";

// outstandPostId dari 5 `PublishingPostTarget` yang stuck "pending" —
// ditemukan via query Supabase staging (lihat catatan di atas), DIKONFIRMASI
// manual via `mcp__outstand__get_post` sebelum backfill ini ditulis:
// l21bW/MAnO3/FWnBp/XnD5d -> published, 3YuZC -> failed (media error Outstand).
const STUCK_OUTSTAND_POST_IDS = ["l21bW", "MAnO3", "FWnBp", "XnD5d", "3YuZC"];

async function main(): Promise<void> {
  const processor = new OutstandWebhookProcessor(
    publishingRepository,
    getOutstandAdapter(),
    workspaceRepository,
    new NotificationService(notificationRepository),
  );

  for (const outstandPostId of STUCK_OUTSTAND_POST_IDS) {
    try {
      const result = await processor.resolvePostOutcome(outstandPostId, {
        notifyOnFailure: true,
      });
      console.log(
        `[backfill-ki025] outstandPostId=${outstandPostId} -> outcome=${result.outcome}` +
          (result.detail ? ` detail=${result.detail}` : "") +
          (result.targetsTotal !== undefined
            ? ` targetsResolved=${result.targetsResolved}/${result.targetsTotal}`
            : ""),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[backfill-ki025] GAGAL outstandPostId=${outstandPostId}: ${message}`,
      );
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[backfill-ki025] fatal:", error);
    process.exit(1);
  });
