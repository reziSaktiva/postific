import {
  asConnectedAccountId,
  asUserId,
  asWorkspaceId,
  MemberRole,
  SocialPlatform,
} from "@postific/shared";
import type {
  AccountOwnerLookupResult,
  IOutstandAdapter,
  ImportJobOutcome,
} from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import { ConflictError } from "@/lib/utils/errors";
import type {
  IImportJobRepository,
  ImportSyncJobPayload,
  ImportSyncJobRecord,
} from "../repositories/import-job.repository";
import { BackfillOutstandPostIdsUseCase } from "./backfill-outstand-post-ids.use-case";
import { ClassifyImportedPostTargetsUseCase } from "./classify-imported-post-targets.use-case";
import { ImportPostsProcessUseCase } from "./import-posts-process.use-case";
import { ImportPostsTriggerUseCase } from "./import-posts-trigger.use-case";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const CONNECTED_ACCOUNT_ID = asConnectedAccountId("account-1");
const ACTING_USER_ID = asUserId("user-1");
const OUTSTAND_ACCOUNT_ID = "outstand-account-1";

/**
 * `backfillUseCase` jadi dependency WAJIB `ImportPostsTriggerUseCase`
 * (code-review PR #170) — dipakai di test yang tidak peduli perilaku
 * backfill sama sekali (tidak ada gap, lewat `createFakePublishingRepositoryForBackfill`
 * default `hasImportedPostsMissingOutstandId: async () => false`).
 */
const noopBackfillUseCase = new BackfillOutstandPostIdsUseCase(
  createFakePublishingRepositoryForBackfill() as never,
  createFakeOutstandAdapter(),
);

/**
 * `classifyUseCase` jadi dependency WAJIB `ImportPostsTriggerUseCase`
 * (T-132.4, ADR-135, pola sama `noopBackfillUseCase` di atas) — dipakai di
 * test yang tidak peduli perilaku klasifikasi sama sekali. Wiring itu
 * sendiri diuji terpisah, lihat describe block "T-132.4" di bawah.
 */
const noopClassifyUseCase = new ClassifyImportedPostTargetsUseCase(
  { classifyImportedPostTargets: async () => ({ updatedCount: 0 }) } as never,
  createFakeOutstandAdapter(),
);

function createFakeImportJobRepository(
  overrides: Partial<IImportJobRepository> = {},
): IImportJobRepository {
  let jobCounter = 0;
  return {
    createImportSyncJob: vi.fn(
      async (payload: ImportSyncJobPayload): Promise<ImportSyncJobRecord> => ({
        id: `job-${++jobCounter}`,
        payload,
        status: "pending",
        createdAt: new Date(),
      }),
    ),
    markImportSyncJobStatus: vi.fn(async () => undefined),
    hasActiveImportSyncJob: vi.fn(async () => false),
    findImportSyncJobById: vi.fn(async () => null),
    countManualImportSyncJobsSince: vi.fn(async () => 0),
    ...overrides,
  };
}

function createFakeOutstandAdapter(
  overrides: Partial<IOutstandAdapter> = {},
): IOutstandAdapter {
  return {
    connectAccount: async () => ({ redirectUrl: "/unused" }),
    resolveConnectCallback: async () => ({
      outstandAccountId: "unused",
      platform: SocialPlatform.Instagram,
      handle: "unused",
      status: "active",
    }),
    listPendingFacebookPages: async () => ({ pages: [] }),
    confirmFacebookPagesConnection: async () => ({ accounts: [] }),
    listPinterestBoards: async () => [],
    uploadMediaWorkingCopy: async () => ({
      outstandMediaId: "unused",
      outstandMediaUrl: "https://fake.outstand.local/media/unused",
      expiresAt: new Date(),
    }),
    schedulePost: async () => ({ outstandPostId: "unused" }),
    publishNow: async () => ({ outstandPostId: "unused" }),
    fetchPostOutcome: async () => [],
    cancelScheduledPost: async () => undefined,
    deletePost: async () => undefined,
    fetchPostMetrics: async () => ({
      impressions: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: null,
      engagementRate: 0,
    }),
    fetchWorkspaceMetrics: async () => ({
      totalPosts: 0,
      totalReach: 0,
      totalEngagements: 0,
      avgEngagementRate: 0,
    }),
    fetchComments: async () => ({ comments: [] }),
    replyToComment: async () => ({ outstandReplyId: "unused" }),
    importPosts: vi.fn(async () => ({ importJobId: "fake-import-job" })),
    fetchImportJobStatus: vi.fn(async (): Promise<ImportJobOutcome> => ({
      status: "completed",
      posts: [],
      error: null,
    })),
    fetchAllPostIdMappings: vi.fn(async () => ({
      mappings: [],
      complete: true,
      shapeDrift: false,
    })),
    ...overrides,
  };
}

function createFakeWatermarkPort(
  overrides: {
    findAccountOwnerByOutstandAccountId?: (
      outstandAccountId: string,
    ) => Promise<AccountOwnerLookupResult | null>;
    getImportWatermark?: () => Promise<{
      lastImportedUntil: Date | null;
    } | null>;
  } = {},
) {
  return {
    updateImportWatermark: vi.fn(async () => undefined),
    findAccountOwnerByOutstandAccountId:
      overrides.findAccountOwnerByOutstandAccountId ??
      vi.fn(async (outstandAccountId: string) => ({
        workspaceId: WORKSPACE_ID,
        connectedAccountId: asConnectedAccountId(
          `account-for-${outstandAccountId}`,
        ),
        ownerUserId: ACTING_USER_ID,
      })),
    getImportWatermark:
      overrides.getImportWatermark ??
      vi.fn(async () => ({ lastImportedUntil: null })),
  };
}

function createProcessUseCase(insertedCount = 0) {
  const repository = {
    upsertImportedPosts: vi.fn(async () => ({
      insertedCount,
      skippedDuplicateCount: 0,
    })),
  } as never;
  return new ImportPostsProcessUseCase(repository);
}

describe("ImportPostsTriggerUseCase.triggerAuto (T-090.3, ADR-093 poin 7)", () => {
  it("creates a job, calls importPosts/fetchImportJobStatus, processes posts, and updates both watermarks", async () => {
    const importJobs = createFakeImportJobRepository();
    const outstandAdapter = createFakeOutstandAdapter();
    const watermark = createFakeWatermarkPort();
    const processUseCase = createProcessUseCase(3);

    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      outstandAdapter,
      watermark,
      processUseCase,
      noopBackfillUseCase,
      noopClassifyUseCase,
    );

    const result = await useCase.triggerAuto({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      actingUserId: ACTING_USER_ID,
    });

    expect(result.outcome).toBe("triggered");
    expect(result.importedCount).toBe(3);
    expect(importJobs.createImportSyncJob).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: "auto" }),
    );
    // T-131.1 — auto (on-connect) sekarang limit 1000 (bukan 100).
    expect(outstandAdapter.importPosts).toHaveBeenCalledWith(
      OUTSTAND_ACCOUNT_ID,
      expect.objectContaining({ limit: 1000 }),
    );
    // T-112/ADR-123 — `fetchImportJobStatus` sekarang butuh `outstandAccountId`
    // SELAIN `importJobId` (endpoint real `GET /v1/social-accounts/{id}/
    // imports/{importId}` butuh account id di path) — pastikan use-case
    // menyuplai `outstandAccountId` yang SAMA dengan yang dipakai `importPosts`,
    // bukan cuma `importJobId` dari hasil `importPosts`.
    expect(outstandAdapter.fetchImportJobStatus).toHaveBeenCalledWith(
      OUTSTAND_ACCOUNT_ID,
      "fake-import-job",
    );
    // Dipanggil dua kali: sekali saat request mulai (lastImportRequestedAt),
    // sekali saat sukses selesai (lastImportedUntil) — ADR-093 poin 6.
    expect(watermark.updateImportWatermark).toHaveBeenCalledTimes(2);
    expect(watermark.updateImportWatermark).toHaveBeenNthCalledWith(1, {
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      lastImportRequestedAt: expect.any(Date),
      actingUserId: ACTING_USER_ID,
    });
    expect(watermark.updateImportWatermark).toHaveBeenNthCalledWith(2, {
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      lastImportedUntil: expect.any(Date),
      actingUserId: ACTING_USER_ID,
    });
    // Code review PR #149 — `markImportSyncJobStatus` sekarang selalu
    // disuplai argumen ke-3 (`lastError`, di sini `undefined` karena
    // `jobOutcome.error` null/full-success) supaya kasus `partial` (lihat
    // test baru di bawah) bisa meneruskan ringkasan kegagalan sebagian ke
    // `lastError` lewat jalur yang sama, bukan jalur baru/terpisah.
    expect(importJobs.markImportSyncJobStatus).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      "running",
    );
    expect(importJobs.markImportSyncJobStatus).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      "done",
      undefined,
      expect.objectContaining({
        limit: 1000,
        insertedCount: expect.any(Number),
      }),
    );
    const runningOrder = vi.mocked(importJobs.markImportSyncJobStatus).mock
      .invocationCallOrder[0];
    const networkOrder = vi.mocked(outstandAdapter.importPosts).mock
      .invocationCallOrder[0];
    expect(runningOrder).toBeLessThan(networkOrder!);
  });

  it("marks the job failed and does not update lastImportedUntil when fetchImportJobStatus does not resolve completed", async () => {
    const importJobs = createFakeImportJobRepository();
    const outstandAdapter = createFakeOutstandAdapter({
      fetchImportJobStatus: async () => ({
        status: "failed",
        posts: [],
        error: "Outstand down",
      }),
    });
    const watermark = createFakeWatermarkPort();
    const processUseCase = createProcessUseCase();

    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      outstandAdapter,
      watermark,
      processUseCase,
      noopBackfillUseCase,
      noopClassifyUseCase,
    );

    const result = await useCase.triggerAuto({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      actingUserId: ACTING_USER_ID,
    });

    expect(result.outcome).toBe("failed");
    expect(result.message).toMatch(/Outstand down/);
    expect(importJobs.markImportSyncJobStatus).toHaveBeenCalledWith(
      expect.any(String),
      "failed",
      expect.stringContaining("Outstand down"),
      expect.objectContaining({ limit: 1000, fetchedPosts: 0 }),
    );
    // Hanya 1 call (request mulai) — TIDAK ada update lastImportedUntil
    // karena job gagal (ADR-093 poin 7).
    expect(watermark.updateImportWatermark).toHaveBeenCalledTimes(1);
    // Bug fix 2026-10-08 (RLS silent no-op di `updateImportWatermark` Prisma
    // real — lihat docstring `IWorkspaceRepository.updateImportWatermark`) —
    // pastikan `actingUserId` dari input `triggerAuto` diteruskan apa adanya
    // ke port, bukan cuma field watermark-nya.
    expect(watermark.updateImportWatermark).toHaveBeenCalledWith(
      expect.objectContaining({ actingUserId: ACTING_USER_ID }),
    );
  });
});

describe("ImportPostsTriggerUseCase — polling fetchImportJobStatus (bug fix 2026-10-09, King Rezi testing manual)", () => {
  it('polls with the injected sleep (not real setTimeout) until status resolves completed, instead of failing immediately on the first "pending" response', async () => {
    const importJobs = createFakeImportJobRepository();
    let callCount = 0;
    const fetchImportJobStatus = vi.fn(async (): Promise<ImportJobOutcome> => {
      callCount += 1;
      // Outstand async beneran — 2 panggilan pertama "pending" (queued/running
      // dipetakan ke ini di RealOutstandAdapter), baru yang ketiga "completed".
      if (callCount < 3) {
        return { status: "pending", posts: [], error: null };
      }
      return { status: "completed", posts: [], error: null };
    });
    const outstandAdapter = createFakeOutstandAdapter({
      fetchImportJobStatus,
    });
    const watermark = createFakeWatermarkPort();
    const processUseCase = createProcessUseCase(0);
    const sleep = vi.fn(async () => undefined);

    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      outstandAdapter,
      watermark,
      processUseCase,
      noopBackfillUseCase,
      noopClassifyUseCase,
      sleep,
    );

    const result = await useCase.triggerAuto({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      actingUserId: ACTING_USER_ID,
    });

    expect(result.outcome).toBe("triggered");
    expect(fetchImportJobStatus).toHaveBeenCalledTimes(3);
    // Delay HANYA di antara percobaan (2 kali untuk 3 panggilan), bukan
    // sebelum panggilan pertama — dan selalu 2 detik (IMPORT_STATUS_POLL_INTERVAL_MS).
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 2_000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2_000);
  });

  it('gives up after the ~25s timeout budget and marks the job failed with a message distinguishing "still processing" from a real failure', async () => {
    const importJobs = createFakeImportJobRepository();
    const fetchImportJobStatus = vi.fn(async (): Promise<ImportJobOutcome> => ({
      status: "pending",
      posts: [],
      error: null,
    }));
    const outstandAdapter = createFakeOutstandAdapter({
      fetchImportJobStatus,
    });
    const watermark = createFakeWatermarkPort();
    const processUseCase = createProcessUseCase(0);
    // Sleep palsu yang memajukan Date.now() secara efektif dengan TIDAK
    // menunggu sungguhan — simulasikan 25+ detik berlalu lewat mock
    // Date.now() supaya test ini TIDAK benar-benar lambat 25 detik.
    const realDateNow = Date.now;
    let elapsedMs = 0;
    vi.spyOn(Date, "now").mockImplementation(() => realDateNow() + elapsedMs);
    const sleep = vi.fn(async () => {
      elapsedMs += 2_000;
    });

    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      outstandAdapter,
      watermark,
      processUseCase,
      noopBackfillUseCase,
      noopClassifyUseCase,
      sleep,
    );

    try {
      const result = await useCase.triggerAuto({
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        outstandAccountId: OUTSTAND_ACCOUNT_ID,
        platform: SocialPlatform.Instagram,
        actingUserId: ACTING_USER_ID,
      });

      expect(result.outcome).toBe("failed");
      expect(result.message).toMatch(/masih diproses di Outstand/);
      expect(result.message).not.toMatch(/Outstand down/);
      expect(importJobs.markImportSyncJobStatus).toHaveBeenCalledWith(
        expect.any(String),
        "failed",
        expect.stringContaining("masih diproses di Outstand"),
        expect.objectContaining({ fetchedPosts: 0 }),
      );
      // Code review PR #149 — komentar lama di sini salah hitung ("call
      // ke-13"); ditulis ulang + assertion dipertegas jadi angka pasti
      // (sebelumnya `toBeGreaterThan(1)`, longgar, tidak akan gagal kalau
      // math timeout berubah tanpa sengaja).
      //
      // Timeout 25s / interval 2s, loop cek KONDISI dulu baru sleep+fetch:
      // call #1 di elapsed=0 (pending) → cek 0<25_000 true → sleep
      // (elapsed=2_000) → call #2 (pending) → cek 2_000<25_000 true →
      // sleep (4_000) → call #3 ... berlanjut sampai cek elapsed=24_000
      // (<25_000, masih true) → sleep (elapsed=26_000) → call #14 (masih
      // "pending") → cek 26_000<25_000 FALSE → loop berhenti. Total 14
      // panggilan `fetchImportJobStatus`, 13 panggilan `sleep` (satu sleep
      // di antara setiap pasang panggilan berurutan).
      expect(fetchImportJobStatus).toHaveBeenCalledTimes(14);
      expect(sleep).toHaveBeenCalledTimes(13);
    } finally {
      vi.spyOn(Date, "now").mockRestore();
    }
  });

  it("does NOT poll at all when the first fetchImportJobStatus call already resolves completed/failed (no wasted delay on the happy path)", async () => {
    const importJobs = createFakeImportJobRepository();
    const fetchImportJobStatus = vi.fn(async (): Promise<ImportJobOutcome> => ({
      status: "completed",
      posts: [],
      error: null,
    }));
    const outstandAdapter = createFakeOutstandAdapter({
      fetchImportJobStatus,
    });
    const watermark = createFakeWatermarkPort();
    const processUseCase = createProcessUseCase(0);
    const sleep = vi.fn(async () => undefined);

    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      outstandAdapter,
      watermark,
      processUseCase,
      noopBackfillUseCase,
      noopClassifyUseCase,
      sleep,
    );

    await useCase.triggerAuto({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      actingUserId: ACTING_USER_ID,
    });

    expect(fetchImportJobStatus).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it(
    "surfaces jobOutcome.error as a non-blocking warning (job still marked done, outcome still triggered) " +
      'when the real API status was "partial" (code review PR #149 — previously silently dropped)',
    async () => {
      const importJobs = createFakeImportJobRepository();
      const fetchImportJobStatus = vi.fn(
        async (): Promise<ImportJobOutcome> => ({
          status: "completed",
          posts: [],
          error: "1 dari 3 post gagal diimport.",
        }),
      );
      const outstandAdapter = createFakeOutstandAdapter({
        fetchImportJobStatus,
      });
      const watermark = createFakeWatermarkPort();
      const processUseCase = createProcessUseCase(2);
      const sleep = vi.fn(async () => undefined);

      const useCase = new ImportPostsTriggerUseCase(
        importJobs,
        outstandAdapter,
        watermark,
        processUseCase,
        noopBackfillUseCase,
        noopClassifyUseCase,
        sleep,
      );

      const result = await useCase.triggerAuto({
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        outstandAccountId: OUTSTAND_ACCOUNT_ID,
        platform: SocialPlatform.Instagram,
        actingUserId: ACTING_USER_ID,
      });

      // Outcome is still success (posts that DID succeed are not dropped).
      expect(result.outcome).toBe("triggered");
      expect(result.importedCount).toBe(2);
      // But the partial-failure summary must now reach the caller...
      expect(result.message).toBe("1 dari 3 post gagal diimport.");
      // ...and be persisted as `lastError` on the job record, even though
      // the job's own status stays "done" (not "failed" — the posts that
      // succeeded genuinely succeeded).
      expect(importJobs.markImportSyncJobStatus).toHaveBeenCalledWith(
        expect.any(String),
        "done",
        "1 dari 3 post gagal diimport.",
        expect.objectContaining({ fetchedPosts: expect.any(Number) }),
      );
    },
  );
});

describe("ImportPostsTriggerUseCase — guard concurrent-import (ADR-093 poin 8)", () => {
  it("rejects (outcome rejected_concurrent) without creating a job or calling the adapter when an active job already exists for the account", async () => {
    const importJobs = createFakeImportJobRepository({
      hasActiveImportSyncJob: vi.fn(async () => true),
    });
    const outstandAdapter = createFakeOutstandAdapter();
    const watermark = createFakeWatermarkPort();
    const processUseCase = createProcessUseCase();

    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      outstandAdapter,
      watermark,
      processUseCase,
      noopBackfillUseCase,
      noopClassifyUseCase,
    );

    const result = await useCase.triggerAuto({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      actingUserId: ACTING_USER_ID,
    });

    expect(result.outcome).toBe("rejected_concurrent");
    expect(importJobs.createImportSyncJob).not.toHaveBeenCalled();
    expect(outstandAdapter.importPosts).not.toHaveBeenCalled();
    expect(watermark.updateImportWatermark).not.toHaveBeenCalled();
  });
});

describe("ImportPostsTriggerUseCase.triggerManual (T-090.3, ADR-093 poin 9)", () => {
  function baseManualInput(
    overrides: Partial<
      Parameters<ImportPostsTriggerUseCase["triggerManual"]>[0]
    > = {},
  ): Parameters<ImportPostsTriggerUseCase["triggerManual"]>[0] {
    return {
      actorRole: MemberRole.Owner,
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      actingUserId: ACTING_USER_ID,
      lastImportedUntil: null,
      lastImportRequestedAt: null,
      ...overrides,
    };
  }

  it("rejects with AuthorizationError-equivalent throw for a Creator (RBAC Owner/Admin only)", async () => {
    const useCase = new ImportPostsTriggerUseCase(
      createFakeImportJobRepository(),
      createFakeOutstandAdapter(),
      createFakeWatermarkPort(),
      createProcessUseCase(),
      noopBackfillUseCase,
      noopClassifyUseCase,
    );

    await expect(
      useCase.triggerManual(baseManualInput({ actorRole: MemberRole.Creator })),
    ).rejects.toThrow(/Owner atau Admin/);
  });

  it("rejects (outcome rejected_cap) when the workspace already used its manual sync this week — dominant guard, checked before cooldown", async () => {
    const importJobs = createFakeImportJobRepository({
      countManualImportSyncJobsSince: vi.fn(async () => 1),
    });
    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      createFakeOutstandAdapter(),
      createFakeWatermarkPort(),
      createProcessUseCase(),
      noopBackfillUseCase,
      noopClassifyUseCase,
    );

    const result = await useCase.triggerManual(
      baseManualInput({ lastImportRequestedAt: new Date(0) }),
    );

    expect(result.outcome).toBe("rejected_cap");
    expect(importJobs.createImportSyncJob).not.toHaveBeenCalled();
  });

  it("rejects (outcome rejected_cooldown) when lastImportRequestedAt was less than 24h ago", async () => {
    const importJobs = createFakeImportJobRepository();
    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      createFakeOutstandAdapter(),
      createFakeWatermarkPort(),
      createProcessUseCase(),
      noopBackfillUseCase,
      noopClassifyUseCase,
    );

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const result = await useCase.triggerManual(
      baseManualInput({ lastImportRequestedAt: oneHourAgo }),
    );

    expect(result.outcome).toBe("rejected_cooldown");
    expect(importJobs.createImportSyncJob).not.toHaveBeenCalled();
  });

  it("succeeds (outcome triggered) for Owner/Admin when cap and cooldown both pass, using lastImportedUntil as since", async () => {
    const importJobs = createFakeImportJobRepository();
    const outstandAdapter = createFakeOutstandAdapter();
    const watermark = createFakeWatermarkPort();
    const watermarkDate = new Date("2026-09-01T00:00:00Z");

    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      outstandAdapter,
      watermark,
      createProcessUseCase(1),
      noopBackfillUseCase,
      noopClassifyUseCase,
    );

    const result = await useCase.triggerManual(
      baseManualInput({
        actorRole: MemberRole.Admin,
        lastImportedUntil: watermarkDate,
        lastImportRequestedAt: null,
      }),
    );

    expect(result.outcome).toBe("triggered");
    expect(importJobs.countManualImportSyncJobsSince).toHaveBeenCalledWith(
      WORKSPACE_ID,
      expect.any(Date),
    );
    const manualPayload = vi.mocked(importJobs.createImportSyncJob).mock
      .calls[0]?.[0];
    expect(manualPayload?.trigger).toBe("manual");
    expect(outstandAdapter.importPosts).toHaveBeenCalledWith(
      OUTSTAND_ACCOUNT_ID,
      expect.objectContaining({ since: watermarkDate }),
    );
    // Bug fix 2026-10-08 (RLS silent no-op — lihat docstring
    // `IWorkspaceRepository.updateImportWatermark`) — `actingUserId` dari
    // input `triggerManual` wajib diteruskan ke port di KEDUA call
    // (`lastImportRequestedAt` saat mulai, `lastImportedUntil` saat selesai).
    expect(watermark.updateImportWatermark).toHaveBeenCalledTimes(2);
    expect(watermark.updateImportWatermark).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ actingUserId: ACTING_USER_ID }),
    );
    expect(watermark.updateImportWatermark).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ actingUserId: ACTING_USER_ID }),
    );
  });
});

describe("ImportPostsTriggerUseCase — T-131 per-trigger since/limit policy", () => {
  it("triggerAuto (T-131.1) requests ~1 year lookback and limit 1000", async () => {
    const importJobs = createFakeImportJobRepository();
    const outstandAdapter = createFakeOutstandAdapter();
    const watermark = createFakeWatermarkPort();
    const processUseCase = createProcessUseCase(1);

    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      outstandAdapter,
      watermark,
      processUseCase,
      noopBackfillUseCase,
      noopClassifyUseCase,
    );

    await useCase.triggerAuto({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      actingUserId: ACTING_USER_ID,
    });

    const callArgs = vi.mocked(outstandAdapter.importPosts).mock.calls[0]?.[1];
    expect(callArgs?.limit).toBe(1000);
    const elapsed = Date.now() - (callArgs?.since as Date).getTime();
    expect(elapsed).toBeGreaterThan(364 * 24 * 60 * 60 * 1000);
    expect(elapsed).toBeLessThan(366 * 24 * 60 * 60 * 1000);
  });

  it("triggerManual (T-131.2) uses the watermark as since (unchanged) but limit is now 1000", async () => {
    const importJobs = createFakeImportJobRepository();
    const outstandAdapter = createFakeOutstandAdapter();
    const watermark = createFakeWatermarkPort();
    const watermarkDate = new Date("2026-09-01T00:00:00Z");

    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      outstandAdapter,
      watermark,
      createProcessUseCase(1),
      noopBackfillUseCase,
      noopClassifyUseCase,
    );

    await useCase.triggerManual({
      actorRole: MemberRole.Owner,
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      actingUserId: ACTING_USER_ID,
      lastImportedUntil: watermarkDate,
      lastImportRequestedAt: null,
    });

    expect(outstandAdapter.importPosts).toHaveBeenCalledWith(
      OUTSTAND_ACCOUNT_ID,
      expect.objectContaining({ since: watermarkDate, limit: 1000 }),
    );
  });

  it("triggerManual (T-131.2) falls back to ~1 year (not 90 days) when the account never synced before", async () => {
    const importJobs = createFakeImportJobRepository();
    const outstandAdapter = createFakeOutstandAdapter();
    const watermark = createFakeWatermarkPort();

    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      outstandAdapter,
      watermark,
      createProcessUseCase(1),
      noopBackfillUseCase,
      noopClassifyUseCase,
    );

    await useCase.triggerManual({
      actorRole: MemberRole.Owner,
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      actingUserId: ACTING_USER_ID,
      lastImportedUntil: null,
      lastImportRequestedAt: null,
    });

    const callArgs = vi.mocked(outstandAdapter.importPosts).mock.calls[0]?.[1];
    expect(callArgs?.limit).toBe(1000);
    const elapsed = Date.now() - (callArgs?.since as Date).getTime();
    expect(elapsed).toBeGreaterThan(364 * 24 * 60 * 60 * 1000);
    expect(elapsed).toBeLessThan(366 * 24 * 60 * 60 * 1000);
  });

  it("triggerPeriodicForAccounts (T-131.3) keeps limit 100 and uses the anti-gap since (stale watermark wins over 24h-ago)", async () => {
    const importJobs = createFakeImportJobRepository();
    const outstandAdapter = createFakeOutstandAdapter();
    const watermark = createFakeWatermarkPort({
      findAccountOwnerByOutstandAccountId: vi.fn(async () => ({
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        ownerUserId: ACTING_USER_ID,
      })),
    });
    const staleWatermark = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      outstandAdapter,
      watermark,
      createProcessUseCase(1),
      noopBackfillUseCase,
      noopClassifyUseCase,
    );

    await useCase.triggerPeriodicForAccounts([
      {
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        outstandAccountId: OUTSTAND_ACCOUNT_ID,
        platform: SocialPlatform.Instagram,
        lastImportedUntil: staleWatermark,
      },
    ]);

    expect(outstandAdapter.importPosts).toHaveBeenCalledWith(
      OUTSTAND_ACCOUNT_ID,
      expect.objectContaining({ since: staleWatermark, limit: 100 }),
    );
  });

  it("triggerPeriodicForAccounts (T-143.1) uses 1 year since and limit 1000 when lastImportedUntil is null, and keeps the watermark when the batch is full", async () => {
    const importJobs = createFakeImportJobRepository();
    const posts = Array.from({ length: 1000 }, (_, i) => ({
      platformPostId: `p-${i}`,
      outstandPostId: `o-${i}`,
      caption: "",
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      platformPostUrl: null,
      mediaUrls: [],
    }));
    const outstandAdapter = createFakeOutstandAdapter({
      fetchImportJobStatus: vi.fn(async (): Promise<ImportJobOutcome> => ({
        status: "completed",
        posts,
        error: null,
        counts: { imported: 900, skipped: 100, failed: 0 },
      })),
    });
    const watermark = createFakeWatermarkPort({
      findAccountOwnerByOutstandAccountId: vi.fn(async () => ({
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        ownerUserId: ACTING_USER_ID,
      })),
    });
    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      outstandAdapter,
      watermark,
      createProcessUseCase(1),
      noopBackfillUseCase,
      noopClassifyUseCase,
    );

    await useCase.triggerPeriodicForAccounts([
      {
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        outstandAccountId: OUTSTAND_ACCOUNT_ID,
        platform: SocialPlatform.Instagram,
        lastImportedUntil: null,
      },
    ]);

    const callArgs = vi.mocked(outstandAdapter.importPosts).mock.calls[0]?.[1];
    expect(callArgs?.limit).toBe(1000);
    const elapsed = Date.now() - (callArgs?.since as Date).getTime();
    expect(elapsed).toBeGreaterThan(364 * 24 * 60 * 60 * 1000);
    expect(elapsed).toBeLessThan(366 * 24 * 60 * 60 * 1000);
    // Batch penuh (1000 >= limit) -> watermark TIDAK dimajukan.
    expect(watermark.updateImportWatermark).not.toHaveBeenCalledWith(
      expect.objectContaining({ lastImportedUntil: expect.any(Date) }),
    );
    // T-143.3 — angka job tersimpan di payload job.
    expect(importJobs.markImportSyncJobStatus).toHaveBeenCalledWith(
      expect.any(String),
      "done",
      undefined,
      expect.objectContaining({
        limit: 1000,
        fetchedPosts: 1000,
        outstandImported: 900,
        outstandSkipped: 100,
        outstandFailed: 0,
        insertedCount: 1,
      }),
    );
  });

  function t143Posts(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      platformPostId: `p-${i}`,
      outstandPostId: `o-${i}`,
      caption: "",
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      platformPostUrl: null,
      mediaUrls: [],
    }));
  }

  function t143UseCase(
    importJobs: ReturnType<typeof createFakeImportJobRepository>,
    outcome: ImportJobOutcome,
  ) {
    const outstandAdapter = createFakeOutstandAdapter({
      fetchImportJobStatus: vi.fn(
        async (): Promise<ImportJobOutcome> => outcome,
      ),
    });
    const watermark = createFakeWatermarkPort({
      findAccountOwnerByOutstandAccountId: vi.fn(async () => ({
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        ownerUserId: ACTING_USER_ID,
      })),
    });
    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      outstandAdapter,
      watermark,
      createProcessUseCase(1),
      noopBackfillUseCase,
      noopClassifyUseCase,
    );
    return { useCase, watermark };
  }

  const t143Account = {
    workspaceId: WORKSPACE_ID,
    connectedAccountId: CONNECTED_ACCOUNT_ID,
    outstandAccountId: OUTSTAND_ACCOUNT_ID,
    platform: SocialPlatform.Instagram,
    lastImportedUntil: null,
  };

  it("triggerPeriodicForAccounts (T-143) advances the watermark when Outstand counts stay below the limit even if more posts than the limit were paginated", async () => {
    const importJobs = createFakeImportJobRepository();
    const { useCase, watermark } = t143UseCase(importJobs, {
      status: "completed",
      posts: t143Posts(1200),
      error: null,
      counts: { imported: 600, skipped: 100, failed: 0 },
    });

    await useCase.triggerPeriodicForAccounts([t143Account]);

    expect(watermark.updateImportWatermark).toHaveBeenCalledWith(
      expect.objectContaining({ lastImportedUntil: expect.any(Date) }),
    );
  });

  it("triggerPeriodicForAccounts (T-143) keeps the watermark when Outstand counts reach the limit", async () => {
    const importJobs = createFakeImportJobRepository();
    const { useCase, watermark } = t143UseCase(importJobs, {
      status: "completed",
      posts: t143Posts(10),
      error: null,
      counts: { imported: 900, skipped: 50, failed: 50 },
    });

    await useCase.triggerPeriodicForAccounts([t143Account]);

    expect(watermark.updateImportWatermark).not.toHaveBeenCalledWith(
      expect.objectContaining({ lastImportedUntil: expect.any(Date) }),
    );
  });

  it("keeps the computed counts and since in the failed result when writing the 'done' status throws (T-143.3)", async () => {
    const markImportSyncJobStatus = vi.fn(
      async (_id: string, status: string) => {
        if (status === "done") throw new Error("db transient");
      },
    );
    const importJobs = createFakeImportJobRepository({
      markImportSyncJobStatus,
    });
    const { useCase } = t143UseCase(importJobs, {
      status: "completed",
      posts: t143Posts(5),
      error: null,
      counts: { imported: 5, skipped: 0, failed: 0 },
    });

    await useCase.triggerPeriodicForAccounts([t143Account]);

    expect(markImportSyncJobStatus).toHaveBeenLastCalledWith(
      expect.any(String),
      "failed",
      expect.stringContaining("db transient"),
      expect.objectContaining({
        limit: 1000,
        since: expect.any(String),
        fetchedPosts: 5,
        outstandImported: 5,
        insertedCount: 1,
      }),
    );
  });

  // T-131.5 — regresi guard biaya existing: kenaikan limit (1000) tidak
  // mengubah semantik guard concurrent-import (ADR-093 poin 8), cooldown
  // 24 jam, atau cap mingguan manual (ADR-093 poin 9) — ketiganya dicek
  // SEBELUM runImportSync, jadi independen dari nilai limit/since.
  describe("T-131.5 — cost guard regression (limit bump must not change guard semantics)", () => {
    it("manual cap guard (payload.trigger = 'manual') still rejects before calling Outstand, even with the new limit/since values", async () => {
      const importJobs = createFakeImportJobRepository({
        countManualImportSyncJobsSince: vi.fn(async () => 1),
      });
      const outstandAdapter = createFakeOutstandAdapter();
      const useCase = new ImportPostsTriggerUseCase(
        importJobs,
        outstandAdapter,
        createFakeWatermarkPort(),
        createProcessUseCase(),
        noopBackfillUseCase,
        noopClassifyUseCase,
      );

      const result = await useCase.triggerManual({
        actorRole: MemberRole.Owner,
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        outstandAccountId: OUTSTAND_ACCOUNT_ID,
        platform: SocialPlatform.Instagram,
        actingUserId: ACTING_USER_ID,
        lastImportedUntil: null,
        lastImportRequestedAt: null,
      });

      expect(result.outcome).toBe("rejected_cap");
      expect(outstandAdapter.importPosts).not.toHaveBeenCalled();
    });

    it("manual cooldown guard (24h) still rejects before calling Outstand", async () => {
      const importJobs = createFakeImportJobRepository();
      const outstandAdapter = createFakeOutstandAdapter();
      const useCase = new ImportPostsTriggerUseCase(
        importJobs,
        outstandAdapter,
        createFakeWatermarkPort(),
        createProcessUseCase(),
        noopBackfillUseCase,
        noopClassifyUseCase,
      );

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const result = await useCase.triggerManual({
        actorRole: MemberRole.Owner,
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        outstandAccountId: OUTSTAND_ACCOUNT_ID,
        platform: SocialPlatform.Instagram,
        actingUserId: ACTING_USER_ID,
        lastImportedUntil: null,
        lastImportRequestedAt: oneHourAgo,
      });

      expect(result.outcome).toBe("rejected_cooldown");
      expect(outstandAdapter.importPosts).not.toHaveBeenCalled();
    });

    it("createImportSyncJob payload still records trigger: 'manual' (cap-counting query relies on this field, unaffected by the limit bump)", async () => {
      const importJobs = createFakeImportJobRepository();
      const outstandAdapter = createFakeOutstandAdapter();
      const useCase = new ImportPostsTriggerUseCase(
        importJobs,
        outstandAdapter,
        createFakeWatermarkPort(),
        createProcessUseCase(1),
        noopBackfillUseCase,
        noopClassifyUseCase,
      );

      await useCase.triggerManual({
        actorRole: MemberRole.Owner,
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        outstandAccountId: OUTSTAND_ACCOUNT_ID,
        platform: SocialPlatform.Instagram,
        actingUserId: ACTING_USER_ID,
        lastImportedUntil: null,
        lastImportRequestedAt: null,
      });

      expect(importJobs.createImportSyncJob).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: "manual" }),
      );
    });

    it("concurrent-import guard (ADR-093 poin 8) still rejects manual before calling Outstand, with the new limit in play", async () => {
      const importJobs = createFakeImportJobRepository({
        hasActiveImportSyncJob: vi.fn(async () => true),
      });
      const outstandAdapter = createFakeOutstandAdapter();
      const useCase = new ImportPostsTriggerUseCase(
        importJobs,
        outstandAdapter,
        createFakeWatermarkPort(),
        createProcessUseCase(),
        noopBackfillUseCase,
        noopClassifyUseCase,
      );

      const result = await useCase.triggerManual({
        actorRole: MemberRole.Owner,
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        outstandAccountId: OUTSTAND_ACCOUNT_ID,
        platform: SocialPlatform.Instagram,
        actingUserId: ACTING_USER_ID,
        lastImportedUntil: null,
        lastImportRequestedAt: null,
      });

      expect(result.outcome).toBe("rejected_concurrent");
      expect(outstandAdapter.importPosts).not.toHaveBeenCalled();
    });
  });
});

describe("ImportPostsTriggerUseCase.triggerPeriodicForAccounts (T-090.3)", () => {
  it("processes each account independently and isolates one account's failure from the others", async () => {
    const importJobs = createFakeImportJobRepository();
    const outstandAdapter = createFakeOutstandAdapter({
      importPosts: vi.fn(async (outstandAccountId: string) => {
        if (outstandAccountId === "outstand-fails") {
          throw new Error("boom");
        }
        return { importJobId: `job-for-${outstandAccountId}` };
      }),
    });

    const okAccountId = asConnectedAccountId("account-ok");
    const failAccountId = asConnectedAccountId("account-fail");

    const watermark = createFakeWatermarkPort({
      findAccountOwnerByOutstandAccountId: vi.fn(async (outstandAccountId) => {
        const connectedAccountId =
          outstandAccountId === "outstand-ok" ? okAccountId : failAccountId;
        return {
          workspaceId: WORKSPACE_ID,
          connectedAccountId,
          ownerUserId: ACTING_USER_ID,
        };
      }),
    });

    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      outstandAdapter,
      watermark,
      createProcessUseCase(2),
      noopBackfillUseCase,
      noopClassifyUseCase,
    );

    const results = await useCase.triggerPeriodicForAccounts([
      {
        workspaceId: WORKSPACE_ID,
        connectedAccountId: okAccountId,
        outstandAccountId: "outstand-ok",
        platform: SocialPlatform.Instagram,
        lastImportedUntil: null,
      },
      {
        workspaceId: WORKSPACE_ID,
        connectedAccountId: failAccountId,
        outstandAccountId: "outstand-fails",
        platform: SocialPlatform.Facebook,
        lastImportedUntil: null,
      },
    ]);

    expect(results.get(okAccountId)?.outcome).toBe("triggered");
    expect(results.get(failAccountId)?.outcome).toBe("failed");
    expect(results.get(failAccountId)?.message).toMatch(/boom/);
  });

  /**
   * KI-088 (resolved 2026-10-15) — `actingUserId` di-resolve lewat
   * `findAccountOwnerByOutstandAccountId` (pola JOB-04/JOB-03), caller TIDAK
   * perlu/boleh lagi menyuplainya sendiri di `TriggerPeriodicAccountInput`.
   */
  it("resolves actingUserId per account via the owner lookup port instead of accepting it as input", async () => {
    const importJobs = createFakeImportJobRepository();
    const outstandAdapter = createFakeOutstandAdapter();
    const watermark = createFakeWatermarkPort({
      findAccountOwnerByOutstandAccountId: vi.fn(async () => ({
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        ownerUserId: ACTING_USER_ID,
      })),
    });
    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      outstandAdapter,
      watermark,
      createProcessUseCase(1),
      noopBackfillUseCase,
      noopClassifyUseCase,
    );

    const results = await useCase.triggerPeriodicForAccounts([
      {
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        outstandAccountId: OUTSTAND_ACCOUNT_ID,
        platform: SocialPlatform.Instagram,
        lastImportedUntil: null,
      },
    ]);

    expect(watermark.findAccountOwnerByOutstandAccountId).toHaveBeenCalledWith(
      OUTSTAND_ACCOUNT_ID,
    );
    const createdPayload = vi.mocked(importJobs.createImportSyncJob).mock
      .calls[0]?.[0];
    expect(createdPayload?.trigger).toBe("periodic");
    expect(createdPayload?.queued).toBeUndefined();
    expect(importJobs.countManualImportSyncJobsSince).not.toHaveBeenCalled();
    expect(watermark.updateImportWatermark).toHaveBeenCalledWith(
      expect.objectContaining({ actingUserId: ACTING_USER_ID }),
    );
    expect(results.get(CONNECTED_ACCOUNT_ID)?.outcome).toBe("triggered");
  });

  /**
   * Dua mode gagal `resolveVerifiedAccountOwner` (owner lookup kosong, dan
   * owner ditemukan tapi tidak cocok dengan input) — ditabelkan jadi satu
   * `it.each` karena arrange/assert-nya identik, hanya mock lookup + regex
   * pesan error yang berbeda per kasus.
   */
  it.each([
    {
      name: "owner lookup finds no active account",
      lookup: async () => null,
      messagePattern: /tidak ditemukan atau tidak aktif/,
    },
    {
      name: "owner lookup result doesn't match the input (workspace/connectedAccountId mismatch)",
      lookup: async () => ({
        workspaceId: asWorkspaceId("workspace-other"),
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        ownerUserId: ACTING_USER_ID,
      }),
      messagePattern: /tidak cocok dengan hasil/,
    },
  ])(
    "marks an account as failed (without affecting others) when $name",
    async ({ lookup, messagePattern }) => {
      const importJobs = createFakeImportJobRepository();
      const outstandAdapter = createFakeOutstandAdapter();
      const watermark = createFakeWatermarkPort({
        findAccountOwnerByOutstandAccountId: vi.fn(lookup),
      });
      const useCase = new ImportPostsTriggerUseCase(
        importJobs,
        outstandAdapter,
        watermark,
        createProcessUseCase(1),
        noopBackfillUseCase,
        noopClassifyUseCase,
      );

      const results = await useCase.triggerPeriodicForAccounts([
        {
          workspaceId: WORKSPACE_ID,
          connectedAccountId: CONNECTED_ACCOUNT_ID,
          outstandAccountId: OUTSTAND_ACCOUNT_ID,
          platform: SocialPlatform.Instagram,
          lastImportedUntil: null,
        },
      ]);

      expect(results.get(CONNECTED_ACCOUNT_ID)?.outcome).toBe("failed");
      expect(results.get(CONNECTED_ACCOUNT_ID)?.message).toMatch(
        messagePattern,
      );
      expect(outstandAdapter.importPosts).not.toHaveBeenCalled();
    },
  );
});

/**
 * T-114 — wiring `BackfillOutstandPostIdsUseCase` ke `runImportSync`
 * (dipanggil lewat `triggerAuto`, entry point paling sederhana — tidak ada
 * guard RBAC/cap/cooldown seperti `triggerManual`, perilaku backfill-nya
 * sendiri sama untuk ketiga entry point karena ketiganya lewat
 * `runImportSync` yang sama, T-114.4).
 */
function createFakePublishingRepositoryForBackfill(
  overrides: Partial<{
    hasImportedPostsMissingOutstandId: () => Promise<boolean>;
    backfillImportedPostOutstandIds: () => Promise<{ updatedCount: number }>;
  }> = {},
) {
  return {
    hasImportedPostsMissingOutstandId: vi.fn(
      overrides.hasImportedPostsMissingOutstandId ?? (async () => false),
    ),
    backfillImportedPostOutstandIds: vi.fn(
      overrides.backfillImportedPostOutstandIds ??
        (async () => ({ updatedCount: 0 })),
    ),
  };
}

describe("ImportPostsTriggerUseCase — T-114 backfill outstandPostId wiring", () => {
  it("backfillUseCase required (code-review PR #170 — no longer optional) — with no gap, sync succeeds exactly as before, no backfillUpdatedCount in result", async () => {
    const useCase = new ImportPostsTriggerUseCase(
      createFakeImportJobRepository(),
      createFakeOutstandAdapter(),
      createFakeWatermarkPort(),
      createProcessUseCase(1),
      noopBackfillUseCase,
      noopClassifyUseCase,
    );

    const result = await useCase.triggerAuto({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      actingUserId: ACTING_USER_ID,
    });

    expect(result.outcome).toBe("triggered");
    expect(result.backfillUpdatedCount).toBeUndefined();
  });

  it("gap exists — calls backfillUseCase.backfillIfNeeded with the SAME workspaceId/connectedAccountId/outstandAccountId/actingUserId, and merges backfillUpdatedCount into the result", async () => {
    const publishingRepo = createFakePublishingRepositoryForBackfill({
      hasImportedPostsMissingOutstandId: async () => true,
      backfillImportedPostOutstandIds: async () => ({ updatedCount: 5 }),
    });
    const backfillAdapter = createFakeOutstandAdapter({
      fetchAllPostIdMappings: vi.fn(async () => ({
        mappings: [
          { platformPostId: "platform-1", outstandPostId: "outstand-1" },
        ],
        complete: true,
        shapeDrift: false,
      })),
    });
    const backfillUseCase = new BackfillOutstandPostIdsUseCase(
      publishingRepo as never,
      backfillAdapter,
    );

    const useCase = new ImportPostsTriggerUseCase(
      createFakeImportJobRepository(),
      createFakeOutstandAdapter(),
      createFakeWatermarkPort(),
      createProcessUseCase(1),
      backfillUseCase,
      noopClassifyUseCase,
    );

    const result = await useCase.triggerAuto({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      actingUserId: ACTING_USER_ID,
    });

    expect(result.outcome).toBe("triggered");
    expect(result.backfillUpdatedCount).toBe(5);
    expect(
      publishingRepo.hasImportedPostsMissingOutstandId,
    ).toHaveBeenCalledWith(
      { workspaceId: WORKSPACE_ID, connectedAccountId: CONNECTED_ACCOUNT_ID },
      ACTING_USER_ID,
    );
    expect(backfillAdapter.fetchAllPostIdMappings).toHaveBeenCalledWith(
      OUTSTAND_ACCOUNT_ID,
    );
  });

  it("no gap — backfillIfNeeded resolves backfilled:false, result has no backfillUpdatedCount (Outstand fetchAllPostIdMappings never called, verified via BackfillOutstandPostIdsUseCase's own existence-check gate)", async () => {
    const publishingRepo = createFakePublishingRepositoryForBackfill({
      hasImportedPostsMissingOutstandId: async () => false,
    });
    const backfillAdapter = createFakeOutstandAdapter({
      fetchAllPostIdMappings: vi.fn(async () => ({
        mappings: [
          { platformPostId: "platform-1", outstandPostId: "outstand-1" },
        ],
        complete: true,
        shapeDrift: false,
      })),
    });
    const backfillUseCase = new BackfillOutstandPostIdsUseCase(
      publishingRepo as never,
      backfillAdapter,
    );

    const useCase = new ImportPostsTriggerUseCase(
      createFakeImportJobRepository(),
      createFakeOutstandAdapter(),
      createFakeWatermarkPort(),
      createProcessUseCase(1),
      backfillUseCase,
      noopClassifyUseCase,
    );

    const result = await useCase.triggerAuto({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      actingUserId: ACTING_USER_ID,
    });

    expect(result.outcome).toBe("triggered");
    expect(result.backfillUpdatedCount).toBeUndefined();
    expect(backfillAdapter.fetchAllPostIdMappings).not.toHaveBeenCalled();
  });

  it("backfill failure (adapter throws) is best-effort — does NOT fail the main sync, backfillUpdatedCount stays undefined", async () => {
    const publishingRepo = createFakePublishingRepositoryForBackfill({
      hasImportedPostsMissingOutstandId: async () => true,
    });
    const backfillAdapter = createFakeOutstandAdapter({
      fetchAllPostIdMappings: vi.fn(async () => {
        throw new Error("Outstand rate limited");
      }),
    });
    const backfillUseCase = new BackfillOutstandPostIdsUseCase(
      publishingRepo as never,
      backfillAdapter,
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const useCase = new ImportPostsTriggerUseCase(
      createFakeImportJobRepository(),
      createFakeOutstandAdapter(),
      createFakeWatermarkPort(),
      createProcessUseCase(1),
      backfillUseCase,
      noopClassifyUseCase,
    );

    const result = await useCase.triggerAuto({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      actingUserId: ACTING_USER_ID,
    });

    expect(result.outcome).toBe("triggered");
    expect(result.backfillUpdatedCount).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("T-114 backfill outstandPostId gagal"),
    );
    warnSpy.mockRestore();
  });

  it("backfill still runs even when the main import job itself fails — the two are independent (gap repair isn't gated on today's import succeeding)", async () => {
    const publishingRepo = createFakePublishingRepositoryForBackfill({
      hasImportedPostsMissingOutstandId: async () => true,
      backfillImportedPostOutstandIds: async () => ({ updatedCount: 2 }),
    });
    const backfillAdapter = createFakeOutstandAdapter({
      fetchAllPostIdMappings: vi.fn(async () => ({
        mappings: [
          { platformPostId: "platform-1", outstandPostId: "outstand-1" },
        ],
        complete: true,
        shapeDrift: false,
      })),
    });
    const backfillUseCase = new BackfillOutstandPostIdsUseCase(
      publishingRepo as never,
      backfillAdapter,
    );
    const failingOutstandAdapter = createFakeOutstandAdapter({
      importPosts: vi.fn(async () => {
        throw new Error("boom");
      }),
    });

    const useCase = new ImportPostsTriggerUseCase(
      createFakeImportJobRepository(),
      failingOutstandAdapter,
      createFakeWatermarkPort(),
      createProcessUseCase(1),
      backfillUseCase,
      noopClassifyUseCase,
    );

    const result = await useCase.triggerAuto({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      actingUserId: ACTING_USER_ID,
    });

    expect(result.outcome).toBe("failed");
    expect(result.message).toMatch(/boom/);
    // Gap-nya tetap ditutup walau import post BARU hari ini gagal.
    expect(result.backfillUpdatedCount).toBe(2);
    expect(
      publishingRepo.backfillImportedPostOutstandIds,
    ).toHaveBeenCalledTimes(1);
  });
});

function fakeClassifyUseCase(
  classifyBatch: (input: unknown) => Promise<{ classifiedCount: number }>,
) {
  return {
    classifyBatch: vi.fn(classifyBatch),
  } as unknown as ClassifyImportedPostTargetsUseCase;
}

describe("ImportPostsTriggerUseCase — T-132.4 classify ContentFormat wiring (ADR-135)", () => {
  it("classifyUseCase required (ADR-135, pola sama backfillUseCase) — with no posts imported this batch, classifyBatch is never called", async () => {
    const classifyBatch = vi.fn(async () => ({ classifiedCount: 0 }));
    const useCase = new ImportPostsTriggerUseCase(
      createFakeImportJobRepository(),
      createFakeOutstandAdapter(), // fetchImportJobStatus default posts: []
      createFakeWatermarkPort(),
      createProcessUseCase(0),
      noopBackfillUseCase,
      fakeClassifyUseCase(classifyBatch),
    );

    const result = await useCase.triggerAuto({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      actingUserId: ACTING_USER_ID,
    });

    expect(result.outcome).toBe("triggered");
    expect(classifyBatch).not.toHaveBeenCalled();
  });

  it("calls classifyUseCase.classifyBatch with the batch's posts, workspaceId/connectedAccountId/platform/actingUserId, AFTER processUseCase.process", async () => {
    const importedPosts = [
      {
        platformPostId: "platform-post-1",
        outstandPostId: "outstand-post-1",
        caption: "caption",
        publishedAt: new Date("2026-10-01T00:00:00.000Z"),
        platformPostUrl: null,
        mediaUrls: [],
      },
    ];
    const outstandAdapter = createFakeOutstandAdapter({
      fetchImportJobStatus: vi.fn(async (): Promise<ImportJobOutcome> => ({
        status: "completed",
        posts: importedPosts,
        error: null,
      })),
    });
    const classifyBatch = vi.fn(async () => ({ classifiedCount: 1 }));
    const useCase = new ImportPostsTriggerUseCase(
      createFakeImportJobRepository(),
      outstandAdapter,
      createFakeWatermarkPort(),
      createProcessUseCase(1),
      noopBackfillUseCase,
      fakeClassifyUseCase(classifyBatch),
    );

    const result = await useCase.triggerAuto({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      actingUserId: ACTING_USER_ID,
    });

    expect(result.outcome).toBe("triggered");
    expect(classifyBatch).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      posts: importedPosts,
      actingUserId: ACTING_USER_ID,
    });
  });

  it("classification failure (classifyBatch throws) is best-effort — does NOT fail the main sync", async () => {
    const importedPosts = [
      {
        platformPostId: "platform-post-1",
        outstandPostId: "outstand-post-1",
        caption: "caption",
        publishedAt: new Date("2026-10-01T00:00:00.000Z"),
        platformPostUrl: null,
        mediaUrls: [],
      },
    ];
    const outstandAdapter = createFakeOutstandAdapter({
      fetchImportJobStatus: vi.fn(async (): Promise<ImportJobOutcome> => ({
        status: "completed",
        posts: importedPosts,
        error: null,
      })),
    });
    const classifyBatch = vi.fn(async () => {
      throw new Error("Outstand rate limited");
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const useCase = new ImportPostsTriggerUseCase(
      createFakeImportJobRepository(),
      outstandAdapter,
      createFakeWatermarkPort(),
      createProcessUseCase(1),
      noopBackfillUseCase,
      fakeClassifyUseCase(classifyBatch),
    );

    const result = await useCase.triggerAuto({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      actingUserId: ACTING_USER_ID,
    });

    expect(result.outcome).toBe("triggered");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("T-132.4 klasifikasi ContentFormat gagal"),
    );
    warnSpy.mockRestore();
  });
});

describe("ImportPostsTriggerUseCase — concurrent guard stays on for manual and auto (T-115.4)", () => {
  it("rejects manual sync when another import is already active for the account", async () => {
    const importJobs = createFakeImportJobRepository({
      hasActiveImportSyncJob: vi.fn(async () => true),
    });
    const outstandAdapter = createFakeOutstandAdapter();
    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      outstandAdapter,
      createFakeWatermarkPort(),
      createProcessUseCase(),
      noopBackfillUseCase,
      noopClassifyUseCase,
    );

    const result = await useCase.triggerManual({
      actorRole: MemberRole.Owner,
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      platform: SocialPlatform.Instagram,
      actingUserId: ACTING_USER_ID,
      lastImportedUntil: null,
      lastImportRequestedAt: null,
    });

    expect(result.outcome).toBe("rejected_concurrent");
    expect(importJobs.createImportSyncJob).not.toHaveBeenCalled();
    expect(outstandAdapter.importPosts).not.toHaveBeenCalled();
  });

  it.each(["auto", "manual"] as const)(
    "maps a unique-index ConflictError to rejected_concurrent for %s without calling Outstand",
    async (path) => {
      const importJobs = createFakeImportJobRepository({
        createImportSyncJob: vi.fn(async () => {
          throw new ConflictError("sudah berjalan");
        }),
      });
      const outstandAdapter = createFakeOutstandAdapter();
      const useCase = new ImportPostsTriggerUseCase(
        importJobs,
        outstandAdapter,
        createFakeWatermarkPort(),
        createProcessUseCase(),
        noopBackfillUseCase,
        noopClassifyUseCase,
      );

      const result =
        path === "auto"
          ? await useCase.triggerAuto({
              workspaceId: WORKSPACE_ID,
              connectedAccountId: CONNECTED_ACCOUNT_ID,
              outstandAccountId: OUTSTAND_ACCOUNT_ID,
              platform: SocialPlatform.Instagram,
              actingUserId: ACTING_USER_ID,
            })
          : await useCase.triggerManual({
              actorRole: MemberRole.Owner,
              workspaceId: WORKSPACE_ID,
              connectedAccountId: CONNECTED_ACCOUNT_ID,
              outstandAccountId: OUTSTAND_ACCOUNT_ID,
              platform: SocialPlatform.Instagram,
              actingUserId: ACTING_USER_ID,
              lastImportedUntil: null,
              lastImportRequestedAt: null,
            });

      expect(result.outcome).toBe("rejected_concurrent");
      expect(outstandAdapter.importPosts).not.toHaveBeenCalled();
      expect(importJobs.markImportSyncJobStatus).not.toHaveBeenCalled();
    },
  );
});

describe("ImportPostsTriggerUseCase.executeQueuedPeriodicImport (T-115)", () => {
  const WATERMARK = new Date("2026-09-01T00:00:00.000Z");

  function runningJob(
    overrides: Partial<ImportSyncJobRecord["payload"]> = {},
  ): ImportSyncJobRecord {
    return {
      id: "running-job",
      status: "running",
      createdAt: new Date("2026-10-16T00:00:00.000Z"),
      payload: {
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        outstandAccountId: OUTSTAND_ACCOUNT_ID,
        trigger: "periodic",
        queued: true,
        platform: SocialPlatform.Instagram,
        since: "",
        until: "",
        ...overrides,
      },
    };
  }

  function createQueuedUseCase(options: {
    lastImportedUntil?: Date | null;
    job?: ImportSyncJobRecord | null;
    fetchImportJobStatus?: () => Promise<ImportJobOutcome>;
  }) {
    const importJobs = createFakeImportJobRepository({
      findImportSyncJobById: vi.fn(async () =>
        options.job === undefined ? runningJob() : options.job,
      ),
    });
    const outstandAdapter = createFakeOutstandAdapter(
      options.fetchImportJobStatus
        ? { fetchImportJobStatus: options.fetchImportJobStatus }
        : {},
    );
    const watermark = createFakeWatermarkPort({
      findAccountOwnerByOutstandAccountId: vi.fn(async () => ({
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        ownerUserId: ACTING_USER_ID,
      })),
      getImportWatermark: vi.fn(async () =>
        options.lastImportedUntil === undefined
          ? { lastImportedUntil: WATERMARK }
          : { lastImportedUntil: options.lastImportedUntil },
      ),
    });
    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      outstandAdapter,
      watermark,
      createProcessUseCase(2),
      noopBackfillUseCase,
      noopClassifyUseCase,
    );
    return { useCase, importJobs, outstandAdapter, watermark };
  }

  const queuedInput = {
    jobId: "running-job",
    workspaceId: WORKSPACE_ID,
    connectedAccountId: CONNECTED_ACCOUNT_ID,
    outstandAccountId: OUTSTAND_ACCOUNT_ID,
    platform: SocialPlatform.Instagram,
  };

  it("imports from the watermark without inserting another job or counting the manual cap", async () => {
    const { useCase, importJobs, outstandAdapter, watermark } =
      createQueuedUseCase({});

    await useCase.executeQueuedPeriodicImport(queuedInput);

    expect(importJobs.findImportSyncJobById).toHaveBeenCalledWith(
      "running-job",
    );
    expect(importJobs.createImportSyncJob).not.toHaveBeenCalled();
    expect(importJobs.hasActiveImportSyncJob).not.toHaveBeenCalled();
    expect(importJobs.countManualImportSyncJobsSince).not.toHaveBeenCalled();
    expect(outstandAdapter.importPosts).toHaveBeenCalledWith(
      OUTSTAND_ACCOUNT_ID,
      expect.objectContaining({ since: WATERMARK }),
    );
    expect(watermark.updateImportWatermark).toHaveBeenNthCalledWith(1, {
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      lastImportRequestedAt: expect.any(Date),
      actingUserId: ACTING_USER_ID,
    });
    expect(importJobs.markImportSyncJobStatus).toHaveBeenCalledWith(
      "running-job",
      "done",
      undefined,
      expect.objectContaining({ limit: 100, insertedCount: 2 }),
    );
    const requestedOrder = vi.mocked(watermark.updateImportWatermark).mock
      .invocationCallOrder[0];
    const networkOrder = vi.mocked(outstandAdapter.importPosts).mock
      .invocationCallOrder[0];
    expect(requestedOrder).toBeLessThan(networkOrder!);
  });

  // T-143.1/KI-102 — watermark null (belum pernah sync sukses) TIDAK lagi
  // jatuh ke 24 jam / limit 100: periodik mengejar riwayat penuh seperti
  // auto/manual (1 tahun, limit 1000).
  it("catches up the full history (1 year, limit 1000) when lastImportedUntil is null (T-143.1)", async () => {
    const { useCase, outstandAdapter } = createQueuedUseCase({
      lastImportedUntil: null,
    });

    await useCase.executeQueuedPeriodicImport(queuedInput);

    const since = vi.mocked(outstandAdapter.importPosts).mock.calls[0]?.[1]
      .since as Date;
    const elapsed = Date.now() - since.getTime();
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    expect(elapsed).toBeGreaterThanOrEqual(oneYear - 1000);
    expect(elapsed).toBeLessThan(oneYear + 5000);
    expect(outstandAdapter.importPosts).toHaveBeenCalledWith(
      OUTSTAND_ACCOUNT_ID,
      expect.objectContaining({ limit: 1000 }),
    );
  });

  // T-131.3 — limit periodik akun ber-watermark tetap 100 (bukan ikut naik ke 1000 seperti
  // auto/manual).
  it("still requests limit 100 (unchanged by the T-131 auto/manual limit bump)", async () => {
    const { useCase, outstandAdapter } = createQueuedUseCase({});

    await useCase.executeQueuedPeriodicImport(queuedInput);

    expect(outstandAdapter.importPosts).toHaveBeenCalledWith(
      OUTSTAND_ACCOUNT_ID,
      expect.objectContaining({ limit: 100 }),
    );
  });

  // T-131.4 — skenario gap cron eksplisit: watermark 3 hari lalu (lebih tua
  // dari 24 jam) HARUS tetap dipakai sebagai `since` (anti-gap), bukan
  // terpotong jadi cuma 24 jam terakhir.
  it("uses the stale watermark (older than 24h) as since when cron missed several days — anti-gap guard (T-131.3/T-131.4)", async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const { useCase, outstandAdapter } = createQueuedUseCase({
      lastImportedUntil: threeDaysAgo,
    });

    await useCase.executeQueuedPeriodicImport(queuedInput);

    expect(outstandAdapter.importPosts).toHaveBeenCalledWith(
      OUTSTAND_ACCOUNT_ID,
      expect.objectContaining({ since: threeDaysAgo }),
    );
  });

  // Kontras dengan test di atas: watermark LEBIH BARU dari 24 jam lalu (mis.
  // 2 jam lalu, cron sempat jalan ekstra atau manual sync terjadi di antara
  // cron) — `since` harus 24 jam lalu (yang "lebih jauh ke belakang" di
  // kasus ini), BUKAN watermark yang lebih baru.
  it("uses 24h-ago as since (not the fresher watermark) when the watermark is more recent than 24h ago", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const { useCase, outstandAdapter } = createQueuedUseCase({
      lastImportedUntil: twoHoursAgo,
    });

    await useCase.executeQueuedPeriodicImport(queuedInput);

    const since = vi.mocked(outstandAdapter.importPosts).mock.calls[0]?.[1]
      .since as Date;
    expect(since.getTime()).toBeLessThan(twoHoursAgo.getTime());
    const elapsed = Date.now() - since.getTime();
    expect(elapsed).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
    expect(elapsed).toBeLessThan(24 * 60 * 60 * 1000 + 5000);
  });

  it("throws when the import fails so the runner can retry, without swallowing the error", async () => {
    const { useCase, importJobs } = createQueuedUseCase({
      fetchImportJobStatus: async () => ({
        status: "failed",
        posts: [],
        error: "Outstand down",
      }),
    });

    await expect(
      useCase.executeQueuedPeriodicImport(queuedInput),
    ).rejects.toThrow(/Outstand down/);
    expect(importJobs.markImportSyncJobStatus).toHaveBeenCalledWith(
      "running-job",
      "failed",
      expect.stringContaining("Outstand down"),
      expect.objectContaining({ limit: 100 }),
    );
    expect(importJobs.createImportSyncJob).not.toHaveBeenCalled();
  });

  it("throws when there is no running queued job, so it does not import twice", async () => {
    const { useCase, outstandAdapter } = createQueuedUseCase({ job: null });

    await expect(
      useCase.executeQueuedPeriodicImport(queuedInput),
    ).rejects.toThrow(/tidak menemukan job/);
    expect(outstandAdapter.importPosts).not.toHaveBeenCalled();
  });
});
