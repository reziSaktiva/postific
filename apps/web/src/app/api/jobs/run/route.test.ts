import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerEnv } = vi.hoisted(() => ({ getServerEnv: vi.fn() }));
vi.mock("@/lib/env", () => ({ getServerEnv }));

vi.mock("@/lib/adapters/outstand", () => ({
  getOutstandAdapter: vi.fn(() => ({})),
}));
vi.mock("@/lib/repositories/publishing", () => ({ publishingRepository: {} }));
vi.mock("@/lib/repositories/workspace", () => ({
  workspaceRepository: {
    listActiveConnectedAccountsForSync: async () => [],
  },
}));
vi.mock("@/lib/repositories/notification", () => ({
  notificationRepository: {},
}));
vi.mock("@/lib/repositories/engagement", () => ({ engagementRepository: {} }));
vi.mock("@/lib/repositories/analytics", () => ({ analyticsRepository: {} }));
vi.mock("@/lib/jobs/job-scheduler", () => ({ backgroundJobScheduler: {} }));

vi.mock("@/domains/publishing", () => ({
  OutstandWebhookProcessor: class {},
  RESOLVE_SCHEDULED_POST_OUTCOME_JOB_TYPE:
    "publishing.scheduled_post.resolve_outcome",
  ResolveScheduledPostOutcomeJobHandler: class {
    handle = vi.fn();
  },
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

const { runPendingJobs } = vi.hoisted(() => ({ runPendingJobs: vi.fn() }));
vi.mock("@/lib/jobs/job-runner", () => ({ runPendingJobs }));
vi.mock("@/lib/jobs/background-job-store", () => ({
  backgroundJobStore: {},
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
  });

  it("rejects with 401 when JOB_SECRET is not configured server-side", async () => {
    getServerEnv.mockReturnValue({ JOB_SECRET: undefined });
    const { POST } = await import("./route");

    const response = await POST(buildRequest(SECRET));

    expect(response.status).toBe(401);
    expect(runPendingJobs).not.toHaveBeenCalled();
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

  it("accepts the daily analytics trigger on the same secret-protected endpoint", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      buildRequest(SECRET, "http://localhost/api/jobs/run?type=analytics"),
    );

    expect(response.status).toBe(200);
    expect(runPendingJobs).toHaveBeenCalledTimes(1);
  });
});
