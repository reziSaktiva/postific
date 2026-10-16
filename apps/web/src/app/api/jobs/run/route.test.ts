import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getServerEnv,
  runPendingJobs,
  listActiveConnectedAccountsForSync,
  hasJobMatchingPayloadKey,
  scheduleJob,
  executeImportSync,
  executeImportSyncIfDue,
} = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
  runPendingJobs: vi.fn(),
  listActiveConnectedAccountsForSync: vi.fn(
    async () =>
      [] as Array<{
        workspaceId: string;
        connectedAccountId: string;
        outstandAccountId: string;
      }>,
  ),
  hasJobMatchingPayloadKey: vi.fn<(input: unknown) => Promise<boolean>>(),
  scheduleJob: vi.fn<(input: unknown) => Promise<void>>(),
  executeImportSync: vi.fn(async () => ({ enqueued: 0 })),
  executeImportSyncIfDue: vi.fn(async () => ({ enqueued: 0, skipped: true })),
}));
vi.mock("@/lib/env", () => ({ getServerEnv }));

vi.mock("@/lib/adapters/outstand", () => ({
  getOutstandAdapter: vi.fn(() => ({})),
}));
vi.mock("@/lib/repositories/publishing", () => ({
  publishingRepository: {},
  importJobRepository: {},
}));
vi.mock("@/lib/repositories/workspace", () => ({
  workspaceRepository: {
    listActiveConnectedAccountsForSync: () =>
      listActiveConnectedAccountsForSync(),
  },
}));
vi.mock("@/lib/repositories/notification", () => ({
  notificationRepository: {},
}));
vi.mock("@/lib/repositories/engagement", () => ({ engagementRepository: {} }));
vi.mock("@/lib/repositories/analytics", () => ({ analyticsRepository: {} }));
vi.mock("@/lib/jobs/job-scheduler", () => ({
  backgroundJobScheduler: {
    scheduleJob: (input: unknown) => scheduleJob(input),
  },
}));

vi.mock("@/domains/publishing", () => ({
  OutstandWebhookProcessor: class {},
  RESOLVE_SCHEDULED_POST_OUTCOME_JOB_TYPE:
    "publishing.scheduled_post.resolve_outcome",
  ResolveScheduledPostOutcomeJobHandler: class {
    handle = vi.fn();
  },
  IMPORT_SYNC_JOB_TYPE: "import.sync",
  ImportSyncJobHandler: class {
    handle = vi.fn();
  },
  EnqueueImportSyncUseCase: class {
    execute = executeImportSync;
    executeIfDue = executeImportSyncIfDue;
  },
  ImportPostsTriggerUseCase: class {},
  ImportPostsProcessUseCase: class {},
  BackfillOutstandPostIdsUseCase: class {},
}));
vi.mock("@/domains/notification", () => ({
  NotificationService: class {},
}));
vi.mock("@/domains/engagement", () => ({
  ENGAGEMENT_SYNC_JOB_TYPE: "engagement.sync",
  EngagementSyncJobHandler: class {
    handle = vi.fn();
  },
  SyncCommentsUseCase: class {},
}));

vi.mock("@/lib/jobs/job-runner", () => ({ runPendingJobs }));
vi.mock("@/lib/jobs/background-job-store", () => ({
  backgroundJobStore: {
    hasJobMatchingPayloadKey: (input: unknown) =>
      hasJobMatchingPayloadKey(input),
  },
}));

const SECRET = "test-job-secret";

function buildRequest(
  headerValue: string | null,
  url = "http://localhost/api/jobs/run",
): Request {
  const headers = new Headers();
  if (headerValue !== null) {
    headers.set("x-job-secret", headerValue);
  }
  return new Request(url, {
    method: "POST",
    headers,
  });
}

describe("POST /api/jobs/run (T-027.1/.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerEnv.mockReturnValue({ JOB_SECRET: SECRET });
    runPendingJobs.mockResolvedValue({ claimed: 0, results: [] });
    listActiveConnectedAccountsForSync.mockResolvedValue([]);
    hasJobMatchingPayloadKey.mockResolvedValue(true);
    scheduleJob.mockResolvedValue(undefined);
  });

  it("rejects with 401 when JOB_SECRET is not configured server-side", async () => {
    getServerEnv.mockReturnValue({ JOB_SECRET: undefined });
    const { POST } = await import("./route");

    const response = await POST(buildRequest(SECRET));

    expect(response.status).toBe(401);
    expect(runPendingJobs).not.toHaveBeenCalled();
    expect(executeImportSync).not.toHaveBeenCalled();
    expect(executeImportSyncIfDue).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the X-Job-Secret header is missing", async () => {
    const { POST } = await import("./route");

    const response = await POST(buildRequest(null));

    expect(response.status).toBe(401);
    expect(runPendingJobs).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the X-Job-Secret header does not match", async () => {
    const { POST } = await import("./route");

    const response = await POST(buildRequest("wrong-secret"));

    expect(response.status).toBe(401);
    expect(runPendingJobs).not.toHaveBeenCalled();
  });

  it("runs pending jobs and returns 200 with the summary when the secret matches", async () => {
    runPendingJobs.mockResolvedValue({
      claimed: 1,
      results: [
        {
          id: "job-1",
          type: "publishing.scheduled_post.resolve_outcome",
          outcome: "done",
        },
      ],
    });
    const { POST } = await import("./route");

    const response = await POST(buildRequest(SECRET));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(runPendingJobs).toHaveBeenCalledTimes(1);
    expect(body).toEqual({
      ok: true,
      claimed: 1,
      results: [
        {
          id: "job-1",
          type: "publishing.scheduled_post.resolve_outcome",
          outcome: "done",
        },
      ],
    });
  });

  it("enqueues analytics from the minute cron when nothing was created today", async () => {
    listActiveConnectedAccountsForSync.mockResolvedValue([
      {
        workspaceId: "workspace-1",
        connectedAccountId: "account-1",
        outstandAccountId: "outstand-1",
      },
    ]);
    hasJobMatchingPayloadKey.mockResolvedValue(false);
    const { POST } = await import("./route");

    const response = await POST(buildRequest(SECRET));

    expect(response.status).toBe(200);
    expect(scheduleJob).toHaveBeenCalledTimes(2);
    expect(scheduleJob).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ connectedAccountId: "account-1" }),
      }),
    );
    expect(scheduleJob).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          scope: "workspace",
          workspaceSnapshotId: "workspace-1",
        }),
      }),
    );
    expect(runPendingJobs).toHaveBeenCalledTimes(1);
  });

  it("does not enqueue analytics again the same UTC day", async () => {
    listActiveConnectedAccountsForSync.mockResolvedValue([
      {
        workspaceId: "workspace-1",
        connectedAccountId: "account-1",
        outstandAccountId: "outstand-1",
      },
    ]);
    hasJobMatchingPayloadKey.mockImplementation(async (input: unknown) => {
      return (
        typeof input === "object" &&
        input !== null &&
        "createdSince" in input &&
        input.createdSince instanceof Date
      );
    });
    const { POST } = await import("./route");

    const response = await POST(buildRequest(SECRET));

    expect(response.status).toBe(200);
    expect(scheduleJob).not.toHaveBeenCalled();
    expect(runPendingJobs).toHaveBeenCalledTimes(1);
  });

  it("forces a new analytics enqueue for the manual trigger even after today's fan-out", async () => {
    listActiveConnectedAccountsForSync.mockResolvedValue([
      {
        workspaceId: "workspace-1",
        connectedAccountId: "account-1",
        outstandAccountId: "outstand-1",
      },
    ]);
    hasJobMatchingPayloadKey.mockImplementation(async (input: unknown) => {
      return (
        typeof input === "object" &&
        input !== null &&
        "createdSince" in input &&
        input.createdSince instanceof Date
      );
    });
    const { POST } = await import("./route");

    const response = await POST(
      buildRequest(SECRET, "http://localhost/api/jobs/run?type=analytics"),
    );

    expect(response.status).toBe(200);
    expect(scheduleJob).toHaveBeenCalledTimes(2);
    expect(runPendingJobs).toHaveBeenCalledTimes(1);
  });

  it("still runs pending jobs when the analytics fan-out fails", async () => {
    listActiveConnectedAccountsForSync.mockRejectedValue(
      new Error("fungsi postgres belum ada"),
    );
    const { POST } = await import("./route");

    const response = await POST(buildRequest(SECRET));

    expect(response.status).toBe(200);
    expect(runPendingJobs).toHaveBeenCalledTimes(1);
    expect(scheduleJob).not.toHaveBeenCalled();
  });

  it("calls import executeIfDue from the minute cron, not the forced execute", async () => {
    const { POST } = await import("./route");

    const response = await POST(buildRequest(SECRET));

    expect(response.status).toBe(200);
    expect(executeImportSyncIfDue).toHaveBeenCalledTimes(1);
    expect(executeImportSync).not.toHaveBeenCalled();
    const handlers = runPendingJobs.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(typeof handlers["import.sync"]).toBe("function");
  });

  it("calls import execute when the request asks for type=import", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      buildRequest(SECRET, "http://localhost/api/jobs/run?type=import"),
    );

    expect(response.status).toBe(200);
    expect(executeImportSync).toHaveBeenCalledTimes(1);
    expect(executeImportSyncIfDue).not.toHaveBeenCalled();
    expect(runPendingJobs).toHaveBeenCalledTimes(1);
  });

  it("still returns 200 and runs pending jobs when the import fan-out fails", async () => {
    executeImportSyncIfDue.mockRejectedValueOnce(
      new Error("fungsi import belum ada"),
    );
    listActiveConnectedAccountsForSync.mockResolvedValue([
      {
        workspaceId: "workspace-1",
        connectedAccountId: "account-1",
        outstandAccountId: "outstand-1",
      },
    ]);
    hasJobMatchingPayloadKey.mockResolvedValue(false);
    const { POST } = await import("./route");

    const response = await POST(buildRequest(SECRET));

    expect(response.status).toBe(200);
    expect(runPendingJobs).toHaveBeenCalledTimes(1);
    expect(scheduleJob).toHaveBeenCalled();
  });
});
