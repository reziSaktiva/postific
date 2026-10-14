import type {
  MemberRole,
  PostId,
  PostTargetId,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import { ConflictError } from "@/lib/utils/errors";
import type { IOutstandAdapter } from "../adapters/outstand-adapter";
import type { IJobScheduler } from "../adapters/job-scheduler";
import { assertContentFormatAllowed } from "../content-format-matrix";
import { summarizeFailureReasons } from "../failure-reason";
import { assertPinterestBoardConstraints } from "../pinterest-board-constraints";
import { assertActorCanPublishNow } from "../rbac";
import type {
  IPublishingRepository,
  PublishingPostRecord,
} from "../repositories/publishing.repository";
import type { SchedulePostsTargetInput } from "./schedule-posts.use-case";
import { enqueueResolveOutcomeFallback } from "./enqueue-resolve-outcome-fallback";
import {
  resolveOutstandPostMedia,
  type PostMediaLookupPort,
} from "./resolve-outstand-post-media";

/**
 * Use-case terpisah dari `PublishingService`, mengikuti pola
 * `SchedulePostsUseCase` (T-028/ADR-059) — constructor mewajibkan
 * `IOutstandAdapter` secara tipe supaya lupa pass adapter di call site baru
 * langsung ketahuan TypeScript. Satu-satunya call site saat ini:
 * `publishNowAction` di `components/draft-editor/actions.ts`.
 *
 * Beda dari `SchedulePostsUseCase`:
 * - Tidak ada `scheduledAt` — aksi ini tayang langsung (KSP-05-F12).
 * - RBAC eksplisit (`assertActorCanPublishNow`) dijalankan lebih dulu,
 *   sebelum validasi format — Publish Now lebih berisiko daripada Schedule
 *   (tanpa jeda koreksi `cancelSchedule`), jadi guard otorisasi diperiksa
 *   duluan (fail fast) sebelum melakukan pekerjaan lain.
 * - Urutan kritis yang sama dengan Schedule tetap dipertahankan: persist
 *   dulu (`PublishingPostTarget` status `pending`, post → `Published`)
 *   lewat `repository.publishNow`, baru panggil adapter, baru update
 *   outcome — supaya tidak ada job Outstand yang "orphan" tanpa jejak di
 *   DB kalau adapter gagal.
 *
 * **Redesain 2026-08-26** (ADR baru, mismatch dengan kontrak resmi
 * Outstand `create-a-post`): SATU call `outstandAdapter.publishNow` untuk
 * SEMUA target sekaligus (bukan 1 call per target). Berbeda dari
 * `SchedulePostsUseCase`: Publish Now butuh outcome per akun SEKARANG
 * (untuk `platformPostUrl` yang ditampilkan di UI, T-034 detail post) —
 * jadi use-case ini memanggil `fetchPostOutcome(outstandPostId)` SEGERA
 * setelah `publishNow` resolve, bukan menunggu polling/webhook belakangan
 * seperti Schedule. Ini valid karena niat aksinya sendiri adalah publish
 * SEKARANG (bukan menjadwalkan ke masa depan) — Fake adapter (ADR-059)
 * kebetulan always-success instan, tapi arsitekturnya tetap benar untuk
 * adapter real nanti (T-025): Outstand memang bisa menyelesaikan publish
 * instan sangat cepat untuk aksi tanpa jadwal, walau responsnya tetap async
 * secara kontrak.
 *
 * **Follow-up KI-025 (2026-10-05) — fallback enqueue `resolve_outcome`
 * kalau `fetchPostOutcome` masih "pending":** sebelum perbaikan ini, kalau
 * Outstand belum punya outcome instan untuk SATU/LEBIH target saat
 * `fetchPostOutcome` dipanggil, target itu dibiarkan `pending` di DB
 * SELAMANYA — tidak ada job polling/webhook lanjutan yang pernah
 * di-enqueue khusus untuknya (beda dari `SchedulePostsUseCase` yang SELALU
 * enqueue job ini). Akibatnya `PublishingPostTarget.status` stuck
 * `"pending"` permanen dan post itu tidak pernah dianggap "syncable" oleh
 * `SyncCommentsUseCase` — komentar yang sebenarnya ada di Outstand tidak
 * pernah ter-pull ke app (root cause Comments Inbox `/engage` kosong untuk
 * post Publish Now). Fix: kalau SETELAH `fetchPostOutcome` resolve masih
 * ada target berstatus "pending", enqueue SATU `BackgroundJob`
 * (`RESOLVE_SCHEDULED_POST_OUTCOME_JOB_TYPE`, lewat helper bersama
 * `enqueueResolveOutcomeFallback` — pola yang sama juga dipakai
 * `SchedulePostsUseCase`) via `jobScheduler` (port, constructor param
 * ketiga — wajib di-pass sama seperti `IOutstandAdapter`), `scheduledAt` =
 * `new Date()` (beda dari Schedule yang punya `scheduledAt` masa depan — di
 * sini publish-nya sendiri sudah terjadi SEKARANG, jadi job polling boleh
 * langsung dieksekusi job runner secepat tick berikutnya).
 *
 * **Code-review PR #141 (2026-10-06) — dua fix tambahan:**
 * 1. **Publish vs fetch-outcome dipisah jadi dua try/catch.** Sebelumnya
 *    SATU try/catch mencakup `publishNow` + `setOutstandPostId` +
 *    `fetchPostOutcome` + loop update per-target — kalau `fetchPostOutcome`
 *    sendiri throw (mis. network error transient) PADAHAL `publishNow` dan
 *    `setOutstandPostId` sudah sukses (Outstand SUDAH menerima post,
 *    `outstandPostId` sudah persist), seluruh target malah ditandai
 *    `failed` permanen oleh `catch` yang sama — tanpa fallback job sama
 *    sekali, karena `pendingOutcomeOutstandPostId` tidak pernah ter-set di
 *    jalur itu. Sekarang: try/catch pertama HANYA mencakup `publishNow` +
 *    `setOutstandPostId` (gagal di sini = Outstand benar-benar belum punya
 *    post ini, aman ditandai `failed`). Try/catch kedua (hanya dijalankan
 *    kalau yang pertama sukses) mencakup `fetchPostOutcome` + loop update —
 *    kalau INI yang throw, target TIDAK ditandai `failed` (biarkan tetap
 *    `pending`, status awal dari `repository.publishNow`) dan
 *    `pendingOutcomeOutstandPostId` tetap di-set supaya fallback job di
 *    bawah tetap ter-enqueue untuk resolve belakangan.
 * 2. **Dead writes ke `allTargetsFailed` dihapus.** Variabel ini dulu
 *    ditulis 3× (inisialisasi awal, di dalam loop per-target saat ada yang
 *    pending, lalu di-overwrite lagi setelah `Promise.all`) padahal cuma
 *    nilai TERAKHIR sebelum satu-satunya pembacaan (`if (allTargetsFailed)`
 *    di bawah) yang pernah berefek. Sekarang diinisialisasi `false` sekali
 *    dan hanya diubah di titik yang benar-benar menentukan hasil akhirnya.
 */
export class PublishNowUseCase {
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
    targets: SchedulePostsTargetInput[];
    /** RBAC (T-029.1, ADR-047/ADR-074) — role actor yang sudah tervalidasi. */
    actorRole: MemberRole;
    /** RLS (KI-026 follow-up) — acting user for `withCurrentUser`. */
    actingUserId: UserId;
  }): Promise<PublishingPostRecord> {
    assertActorCanPublishNow(input.actorRole);

    for (const target of input.targets) {
      assertContentFormatAllowed(target.platform, target.contentFormat);
    }
    assertPinterestBoardConstraints(input.targets);

    const record = await this.repository.publishNow(
      {
        workspaceId: input.workspaceId,
        postId: input.postId,
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
        "Post tidak bisa dipublikasikan — status saat ini bukan Draft atau Ready to Schedule, salah satu akun bukan milik workspace ini, atau post tidak ditemukan.",
      );
    }

    // Mapping berbasis `connectedAccountId` (bukan index/order array) —
    // `record.targets` datang dari `findMany` Prisma yang TIDAK menjamin
    // urutan sama dengan `input.targets`, sama pola aman yang sudah dipakai
    // sebelum redesain ini.
    const targetInputByConnectedAccountId = new Map(
      input.targets.map((target) => [target.connectedAccountId, target]),
    );
    const targetIdByOutstandAccountId = new Map<string, PostTargetId>();
    for (const target of record.targets) {
      const targetInput = targetInputByConnectedAccountId.get(
        target.connectedAccountId,
      );
      if (targetInput) {
        targetIdByOutstandAccountId.set(
          targetInput.outstandAccountId,
          target.id,
        );
      }
    }

    // Code-review PR #141 — diinisialisasi `false` sekali (dulu ditulis 3×,
    // 2 di antaranya dead code, lihat catatan panjang di atas class ini).
    let allTargetsFailed = false;
    // T-107 (koreksi KI-049/KI-063) — dikumpulkan supaya `markPostFailed`
    // di bawah punya `reason` yang berarti (bukan sekadar mengubah
    // `status`). Diisi dari exception adapter (catch di bawah, all-or-
    // nothing) ATAU dari `PostTargetOutcome.error` tiap target yang
    // diketahui gagal (try di bawah) — diringkas lewat
    // `summarizeFailureReasons` (dedup + join `"; "` + fallback generik).
    const failureMessages = new Set<string>();
    // Follow-up KI-025 (2026-10-05) — non-null HANYA kalau adapter call +
    // persist `outstandPostId` sukses DAN (a) minimal satu target masih
    // "pending" setelah `fetchPostOutcome`, ATAU (b) `fetchPostOutcome`
    // sendiri gagal (code-review PR #141, lihat catatan panjang di atas
    // class ini). Dipakai di LUAR kedua try/catch di bawah untuk memutuskan
    // apakah job fallback resolve-outcome perlu di-enqueue.
    let pendingOutcomeOutstandPostId: string | null = null;

    // Code-review PR #141 — dipisah dari try/catch fetch-outcome di bawah.
    // Try/catch INI hanya mencakup `publishNow` + `setOutstandPostId`: kalau
    // salah satu gagal, Outstand benar-benar belum punya post ini sama
    // sekali, jadi aman menandai seluruh target `failed`.
    let publishResult: { outstandPostId: string } | null = null;
    try {
      const media = await resolveOutstandPostMedia({
        workspaceId: input.workspaceId,
        mediaIds: record.mediaIds,
        actingUserId: input.actingUserId,
        outstandAdapter: this.outstandAdapter,
        mediaLookup: this.mediaLookup,
      });

      const result = await this.outstandAdapter.publishNow({
        caption: record.caption,
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

      publishResult = result;
    } catch (error) {
      // Satu call mencakup semua target (redesain 2026-08-26) — gagal
      // berarti SEMUA target gagal bersamaan (all-or-nothing).
      const message = error instanceof Error ? error.message : String(error);
      await Promise.all(
        record.targets.map((publishedTarget) =>
          this.repository.updateTargetOutcome(
            {
              postTargetId: publishedTarget.id,
              status: "failed",
              error: message,
            },
            input.actingUserId,
          ),
        ),
      );
      failureMessages.add(message);
      allTargetsFailed = true;
    }

    // Code-review PR #141 — try/catch KEDUA, hanya dijalankan kalau publish
    // di atas sukses (`publishResult` tidak null). Kalau `fetchPostOutcome`
    // ATAU loop update per-target di bawah ini throw, target TIDAK ditandai
    // `failed` (dibiarkan `pending`, status awal dari `repository.publishNow`)
    // — Outstand sudah benar-benar menerima post ini, jadi `allTargetsFailed`
    // TIDAK disentuh di sini, cukup pastikan fallback job tetap ter-enqueue
    // supaya outcome-nya di-resolve ulang belakangan.
    if (publishResult) {
      try {
        // T-027 bug fix (root-cause) — `expectedOutstandAccountIds`
        // eksplisit, BUKAN mengandalkan Fake adapter "mengingat" set akun
        // dari `publishNow` di atas (lihat catatan panjang di
        // `IOutstandAdapter.fetchPostOutcome`). `input.targets` sudah
        // tersedia di scope ini, tidak perlu resolve tambahan.
        const outcomes = await this.outstandAdapter.fetchPostOutcome(
          publishResult.outstandPostId,
          input.targets.map((target) => target.outstandAccountId),
        );

        const outcomeByOutstandAccountId = new Map(
          outcomes.map((outcome) => [outcome.outstandAccountId, outcome]),
        );

        const targetOutcomes = await Promise.all(
          input.targets.map(async (targetInput) => {
            const postTargetId = targetIdByOutstandAccountId.get(
              targetInput.outstandAccountId,
            );
            // Selalu ada — targets di record berasal dari input.targets
            // yang sama.
            if (!postTargetId) {
              return "failed" as const;
            }

            const outcome = outcomeByOutstandAccountId.get(
              targetInput.outstandAccountId,
            );

            // Outstand belum melaporkan outcome akun ini (mis. masih
            // "pending" di sisi mereka) — perlakukan sebagai belum
            // diketahui, biarkan status `pending` DB tidak diubah sampai
            // polling/webhook (T-026/T-027) menyusul. Tidak dihitung
            // sebagai gagal.
            if (!outcome || outcome.status === "pending") {
              return "pending" as const;
            }

            await this.repository.updateTargetOutcome(
              {
                postTargetId,
                status: outcome.status,
                platformPostId: outcome.platformPostId ?? undefined,
                platformPostUrl: outcome.platformPostUrl ?? undefined,
                error: outcome.error ?? undefined,
              },
              input.actingUserId,
            );

            if (outcome.status === "failed" && outcome.error) {
              failureMessages.add(outcome.error);
            }

            return outcome.status;
          }),
        );

        allTargetsFailed =
          targetOutcomes.length > 0 &&
          targetOutcomes.every((outcome) => outcome === "failed");

        // Minimal satu target masih "pending" (Outstand belum instan
        // melaporkan outcome-nya) → job fallback perlu di-enqueue supaya
        // target itu tidak stuck "pending" permanen.
        if (targetOutcomes.includes("pending")) {
          pendingOutcomeOutstandPostId = publishResult.outstandPostId;
        }
      } catch (outcomeError) {
        // Code-review PR #141 (correctness fix) — `fetchPostOutcome`/loop
        // update di atas gagal SETELAH publish sukses. Outstand sudah
        // benar-benar menerima post ini (`outstandPostId` sudah persist),
        // jadi ini BUKAN kegagalan publish — jangan tandai target `failed`.
        // Tetap set `pendingOutcomeOutstandPostId` supaya fallback job di
        // bawah tetap ter-enqueue, mencegah target stuck tanpa job polling
        // sama sekali (ini persis bug KI-025 yang coba diperbaiki PR ini).
        const message =
          outcomeError instanceof Error
            ? outcomeError.message
            : String(outcomeError);
        console.error(
          `[PublishNowUseCase] fetchPostOutcome gagal setelah publish sukses ` +
            `(postId=${input.postId}, outstandPostId=${publishResult.outstandPostId}): ` +
            `${message} — target dibiarkan pending, resolve_outcome job tetap dicoba di-enqueue.`,
        );
        pendingOutcomeOutstandPostId = publishResult.outstandPostId;
      }
    }

    // SENGAJA di LUAR try/catch di atas (pola sama `SchedulePostsUseCase`,
    // lihat catatan panjang di atas class ini): enqueue job fallback hanya
    // dicoba kalau ada outcome "pending"/gagal-resolve yang perlu
    // di-resolve belakangan, dan kegagalannya sendiri TIDAK BOLEH menandai
    // post/target sebagai `failed` — ini murni gagal mencatat job internal
    // untuk polling belakangan, bukan kegagalan publish.
    if (pendingOutcomeOutstandPostId) {
      await enqueueResolveOutcomeFallback({
        jobScheduler: this.jobScheduler,
        outstandPostId: pendingOutcomeOutstandPostId,
        // Beda dari `SchedulePostsUseCase` (yang pakai `scheduledAt` masa
        // depan post) — publish-nya sendiri sudah terjadi SEKARANG, jadi
        // job polling boleh langsung dieksekusi job runner secepat tick
        // berikutnya.
        scheduledAt: new Date(),
        callerLabel: "PublishNowUseCase",
        postId: input.postId,
        onFailureNote:
          "target yang masih pending TIDAK ditandai gagal, perlu diselesaikan " +
          "manual/webhook kalau job ini tidak kunjung sukses ter-enqueue.",
      });
    }

    // Bug fix (2026-08-26) — post sudah ditandai `Published` di atas
    // (`repository.publishNow`) sebelum hasil per target diketahui. Kalau
    // SEMUA target gagal, koreksi status post jadi `Failed` — semantik
    // sama dengan `post.error` webhook Outstand (integration-layer.md
    // :269-270): "semua target gagal" → status domain `failed`. Minimal 1
    // target sukses (partial atau full) → status post TETAP `Published`,
    // tidak disentuh di sini.
    if (allTargetsFailed) {
      const reason = summarizeFailureReasons(failureMessages);
      await this.repository.markPostFailed(
        { workspaceId: input.workspaceId, postId: input.postId, reason },
        input.actingUserId,
      );
    }

    return record;
  }
}
