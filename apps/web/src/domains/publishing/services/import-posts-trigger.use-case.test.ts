import {
  asConnectedAccountId,
  asUserId,
  asWorkspaceId,
  MemberRole,
  SocialPlatform,
} from "@postific/shared";
import type { IOutstandAdapter, ImportJobOutcome } from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import type {
  IImportJobRepository,
  ImportSyncJobPayload,
  ImportSyncJobRecord,
} from "../repositories/import-job.repository";
import { ImportPostsProcessUseCase } from "./import-posts-process.use-case";
import { ImportPostsTriggerUseCase } from "./import-posts-trigger.use-case";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const CONNECTED_ACCOUNT_ID = asConnectedAccountId("account-1");
const ACTING_USER_ID = asUserId("user-1");
const OUTSTAND_ACCOUNT_ID = "outstand-account-1";

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
    ...overrides,
  };
}

function createFakeWatermarkPort() {
  return { updateImportWatermark: vi.fn(async () => undefined) };
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
    expect(outstandAdapter.importPosts).toHaveBeenCalledWith(
      OUTSTAND_ACCOUNT_ID,
      expect.objectContaining({ limit: 100 }),
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
    expect(importJobs.markImportSyncJobStatus).toHaveBeenCalledWith(
      expect.any(String),
      "done",
      undefined,
    );
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
    );

    const result = await useCase.triggerManual(
      baseManualInput({
        actorRole: MemberRole.Admin,
        lastImportedUntil: watermarkDate,
        lastImportRequestedAt: null,
      }),
    );

    expect(result.outcome).toBe("triggered");
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
    const useCase = new ImportPostsTriggerUseCase(
      importJobs,
      outstandAdapter,
      createFakeWatermarkPort(),
      createProcessUseCase(2),
    );

    const okAccountId = asConnectedAccountId("account-ok");
    const failAccountId = asConnectedAccountId("account-fail");

    const results = await useCase.triggerPeriodicForAccounts([
      {
        workspaceId: WORKSPACE_ID,
        connectedAccountId: okAccountId,
        outstandAccountId: "outstand-ok",
        platform: SocialPlatform.Instagram,
        lastImportedUntil: null,
        actingUserId: ACTING_USER_ID,
      },
      {
        workspaceId: WORKSPACE_ID,
        connectedAccountId: failAccountId,
        outstandAccountId: "outstand-fails",
        platform: SocialPlatform.Facebook,
        lastImportedUntil: null,
        actingUserId: ACTING_USER_ID,
      },
    ]);

    expect(results.get(okAccountId)?.outcome).toBe("triggered");
    expect(results.get(failAccountId)?.outcome).toBe("failed");
    expect(results.get(failAccountId)?.message).toMatch(/boom/);
  });
});
