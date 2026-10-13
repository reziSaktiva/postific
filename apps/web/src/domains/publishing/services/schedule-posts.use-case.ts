import type {
  ConnectedAccountId,
  ContentFormat,
  PostId,
  SocialPlatform,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import { ConflictError } from "@/lib/utils/errors";
import type { IOutstandAdapter } from "../adapters/outstand-adapter";
import type { IJobScheduler } from "../adapters/job-scheduler";
import { assertContentFormatAllowed } from "../content-format-matrix";
import { assertPinterestBoardConstraints } from "../pinterest-board-constraints";
import { assertScheduledAtNotInPast } from "../schedule-time-constraints";
import { enqueueResolveOutcomeFallback } from "./enqueue-resolve-outcome-fallback";
import type {
  IPublishingRepository,
  PublishingPostRecord,
} from "../repositories/publishing.repository";
import {
  resolveOutstandPostMedia,
  type PostMediaLookupPort,
} from "./resolve-outstand-post-media";

export interface SchedulePostsTargetInput {
  connectedAccountId: ConnectedAccountId;
  platform: SocialPlatform;
  contentFormat: ContentFormat;
  platformOptions?: Record<string, unknown>;
  /**
   * `WorkspaceConnectedAccount.outstandAccountId` — bukan `connectedAccountId`
   * (Prisma id) itu sendiri. `SchedulePostsUseCase` tidak mengimpor domain
   * Workspace, jadi caller (Server Action) wajib me-resolve nilai ini lebih
   * dulu dari `WorkspaceService.listConnectedAccounts` sebelum memanggil
   * `execute`. Hanya dipakai untuk panggilan `OutstandAdapter` — tidak
   * dipersist ke `IPublishingRepository` karena bukan kolom DB.
   */
  outstandAccountId: string;
}

/**
 * Use-case terpisah dari `PublishingService` (bukan method di dalamnya)
 * supaya constructor bisa MEWAJIBKAN `IOutstandAdapter` secara tipe — lupa
 * pass adapter di call site baru langsung ketahuan TypeScript, bukan cuma
 * runtime throw (temuan review Ridwan Architecture Reviewer). Satu-satunya
 * call site saat ini: `scheduleDraftAction` di
 * `components/draft-editor/actions.ts`.
 *
 * Urutan kritis: persist dulu (`PublishingPostTarget` status `pending`)
 * lewat `repository.schedulePost`, baru panggil adapter, baru persist
 * `outstandPostId` — supaya tidak ada job Outstand yang "orphan" tanpa
 * jejak di DB kalau adapter gagal.
 *
 * **Redesain 2026-08-26** (ADR baru, mismatch dengan kontrak resmi
 * Outstand `create-a-post`): SATU call `outstandAdapter.schedulePost`
 * untuk SEMUA target sekaligus (bukan 1 call per target seperti
 * sebelumnya) — Outstand menghasilkan SATU `outstandPostId` untuk seluruh
 * target. Berbeda dari `PublishNowUseCase`: use-case ini SENGAJA TIDAK
 * memanggil `fetchPostOutcome` setelahnya — post yang dijadwalkan ke masa
 * depan belum punya outcome publish apa pun untuk dibaca (Outstand belum
 * memprosesnya), jadi seluruh target tetap berstatus `scheduled` sampai
 * outcome sungguhan diketahui belakangan lewat polling (T-027) atau
 * webhook `post.published`/`post.error` (T-026) — konsisten dengan model
 * async Outstand di `integration-layer.md`, bukan diagnosa instan Fake.
 *
 * **T-027.5 — enqueue job polling outcome:** SETELAH `outstandPostId`
 * persist dan seluruh target ditandai `scheduled` (jalur sukses SAJA — lihat
 * `catch` di bawah, tidak ada yang perlu di-poll kalau adapter call-nya
 * sendiri gagal, sudah `markPostFailed`), use-case ini meng-enqueue SATU
 * `BackgroundJob` (`RESOLVE_SCHEDULED_POST_OUTCOME_JOB_TYPE`) via
 * `jobScheduler` (port, constructor param ketiga — pola sama
 * `IOutstandAdapter`, wajib di-pass supaya lupa wiring ketahuan TypeScript,
 * bukan cuma runtime). `scheduledAt` job = `scheduledAt` post — job baru
 * boleh dieksekusi job runner (Railway Cron) setelah waktu jadwal post itu
 * sendiri tiba, sama waktunya dengan saat Outstand baru mengeksekusi publish
 * di sisi mereka. Payload `{ outstandPostId }` (bukan `postId` domain) —
 * lihat catatan lengkap desain ini di
 * `ResolveScheduledPostOutcomeJobHandler`.
 *
 * **Bug fix (review Ridwan Architecture Reviewer, T-027):** `jobScheduler.
 * scheduleJob()` dipanggil di LUAR `try`/`catch` yang menangani kegagalan
 * `outstandAdapter.schedulePost()` (lihat `scheduleResult` di bawah) — kalau
 * TIDAK dipisah, exception dari `scheduleJob()` (mis. DB down saat insert
 * `BackgroundJob`) akan tertangkap oleh `catch` yang sama dan SALAH menandai
 * post/seluruh target sebagai `failed`, padahal Outstand SUDAH benar-benar
 * menjadwalkan post itu (`outstandPostId` valid, sudah persist, target sudah
 * `scheduled`). Kegagalan enqueue job adalah bug data/observability
 * terpisah — bukan kegagalan publish/schedule — jadi hanya di-log
 * (`console.error`), TIDAK mengubah status post/target sama sekali. Outcome
 * post ini tetap bisa terselesaikan belakangan lewat webhook `post.published`/
 * `post.error` (T-026, independen dari job polling T-027) kalau job resolve
 * outcome-nya gagal ter-enqueue.
 */
export class SchedulePostsUseCase {
  constructor(
    private readonly repository: IPublishingRepository,
    private readonly outstandAdapter: IOutstandAdapter,
    private readonly jobScheduler: IJobScheduler,
    /** Opsional — resolve mediaIds → URL Outstand sebelum create-post. */
    private readonly mediaLookup?: PostMediaLookupPort,
  ) {}

  async execute(input: {
    workspaceId: WorkspaceId;
    postId: PostId;
    scheduledAt: Date;
    targets: SchedulePostsTargetInput[];
    /** RLS (KI-026 follow-up) — acting user for `withCurrentUser`. */
    actingUserId: UserId;
  }): Promise<PublishingPostRecord> {
    for (const target of input.targets) {
      assertContentFormatAllowed(target.platform, target.contentFormat);
    }
    assertPinterestBoardConstraints(input.targets);
    // T-108.2 (KI-044) — defense-in-depth: validasi client di `Modal.tsx`
    // bisa dilewati (request langsung ke Server Action, jam sistem client
    // berbeda dari server, dll). Reject di sini juga, sebelum apa pun
    // dipersist.
    assertScheduledAtNotInPast(input.scheduledAt);

    const record = await this.repository.schedulePost(
      {
        workspaceId: input.workspaceId,
        postId: input.postId,
        scheduledAt: input.scheduledAt,
        targets: input.targets.map((target) => ({
          connectedAccountId: target.connectedAccountId,
          platform: target.platform,
          contentFormat: target.contentFormat,
          platformOptions: target.platformOptions,
        })),
      },
      input.actingUserId,
    );

    if (!record) {
      throw new ConflictError(
        "Post tidak bisa dijadwalkan — status saat ini bukan Draft atau Ready to Schedule, salah satu akun bukan milik workspace ini, atau post tidak ditemukan.",
      );
    }

    // Non-null HANYA kalau `outstandAdapter.schedulePost()` + persist DB
    // setelahnya (`setOutstandPostId`/`updateTargetOutcome`) semuanya
    // sukses — dipakai di luar blok `try`/`catch` di bawah untuk memutuskan
    // apakah job polling outcome (T-027.5) perlu di-enqueue sama sekali.
    let scheduleResult: { outstandPostId: string } | null = null;

    try {
      const media = await resolveOutstandPostMedia({
        workspaceId: input.workspaceId,
        mediaIds: record.mediaIds,
        actingUserId: input.actingUserId,
        outstandAdapter: this.outstandAdapter,
        mediaLookup: this.mediaLookup,
      });

      const result = await this.outstandAdapter.schedulePost({
        caption: record.caption,
        scheduledAt: input.scheduledAt,
        targets: input.targets.map((target) => ({
          outstandAccountId: target.outstandAccountId,
          platform: target.platform,
          contentFormat: target.contentFormat,
          platformOptions: target.platformOptions,
        })),
        ...(media ? { media } : {}),
      });

      await this.repository.setOutstandPostId(
        {
          workspaceId: input.workspaceId,
          postId: input.postId,
          outstandPostId: result.outstandPostId,
        },
        input.actingUserId,
      );

      await Promise.all(
        record.targets.map((scheduledTarget) =>
          this.repository.updateTargetOutcome(
            { postTargetId: scheduledTarget.id, status: "scheduled" },
            input.actingUserId,
          ),
        ),
      );

      scheduleResult = result;
    } catch (error) {
      // Satu call mencakup semua target (redesain 2026-08-26) — gagal
      // berarti SEMUA target gagal bersamaan (all-or-nothing), beda dari
      // model lama yang bisa partial per target. Post dikoreksi ke
      // `Failed` (sama pola dengan bug fix `PublishNowUseCase`, lihat
      // `IPublishingRepository.markPostFailed`).
      const message = error instanceof Error ? error.message : String(error);
      await Promise.all(
        record.targets.map((scheduledTarget) =>
          this.repository.updateTargetOutcome(
            {
              postTargetId: scheduledTarget.id,
              status: "failed",
              error: message,
            },
            input.actingUserId,
          ),
        ),
      );
      await this.repository.markPostFailed(
        {
          workspaceId: input.workspaceId,
          postId: input.postId,
          reason: message,
        },
        input.actingUserId,
      );
    }

    // T-027.5 — SENGAJA di LUAR try/catch di atas (bug fix review Ridwan,
    // lihat catatan panjang di atas class ini): enqueue job hanya dicoba
    // kalau schedule ke Outstand sungguhan sukses (`scheduleResult` tidak
    // null), dan kegagalannya sendiri TIDAK BOLEH menandai post/target
    // sebagai `failed` — post itu sudah benar-benar terjadwal di Outstand,
    // ini murni gagal mencatat job internal untuk polling belakangan.
    if (scheduleResult) {
      // Log-only kalau gagal enqueue (pola sama dengan kegagalan pemrosesan
      // non-fatal lain di codebase ini, mis. `OutstandWebhookProcessor` di
      // `/api/webhooks/outstand/route.ts`) — post TETAP `Scheduled`, TIDAK
      // di-`markPostFailed`. Outcome post ini masih bisa terselesaikan lewat
      // webhook `post.published`/`post.error` (T-026, independen dari job
      // polling T-027); kegagalan enqueue perlu diinvestigasi manual (MVP
      // monitoring, BG-D06) kalau webhook juga tidak kunjung datang.
      await enqueueResolveOutcomeFallback({
        jobScheduler: this.jobScheduler,
        outstandPostId: scheduleResult.outstandPostId,
        scheduledAt: input.scheduledAt,
        callerLabel: "SchedulePostsUseCase",
        postId: input.postId,
        onFailureNote: "post TETAP berstatus Scheduled, BUKAN ditandai gagal.",
      });
    }

    return record;
  }
}
