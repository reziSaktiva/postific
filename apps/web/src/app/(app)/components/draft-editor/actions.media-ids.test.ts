import {
  asConnectedAccountId,
  asMediaId,
  asPostId,
  asUserId,
  asWorkspaceId,
  ContentFormat,
  ContentStatus,
  MemberRole,
  SocialPlatform,
} from "@postific/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regresi review Ridwan (T-024.4, temuan MEDIUM): `resolveAndValidateMediaIds`
 * (dipakai `saveDraftAction`/`updateDraftAction`) dan resolusi serupa di
 * `scheduleDraftAction`/`publishNowAction` sempat SELALU meng-collapse
 * `mediaIds` yang tidak dikirim client (`undefined`) jadi `[]` lewat
 * `input.mediaIds ?? []` — sehingga partial-update semantics yang
 * didokumentasikan di `PublishingService.saveDraft`/`updateDraft` (`undefined`
 * = kolom `media_ids` tidak disentuh) tidak pernah benar-benar tereksekusi
 * dari satu-satunya caller yang ada. Test ini memverifikasi TEPAT di layer
 * gap-nya (Server Action → `PublishingService.saveDraft`/`updateDraft`),
 * bukan cuma sampai `PublishingService` (yang sudah benar sebelum fix ini).
 */

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const USER_ID = asUserId("user-1");

const { getSessionMock, redirectMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/better-auth/session", () => ({
  getCachedSession: getSessionMock,
}));

vi.mock("@/lib/workspace/workspace-context", () => ({
  getWorkspaceContext: vi.fn(async () => ({
    workspaceId: WORKSPACE_ID,
    role: MemberRole.Owner,
  })),
}));

// Repository/adapter modul-modul ini menginisialisasi Prisma client / env
// server di module scope — di-stub supaya test tidak butuh DB/kredensial
// nyata. Method yang benar-benar dipakai (`PublishingService`/`MediaService`/
// `WorkspaceService`/use-case) di-spy langsung di prototype-nya, sama pola
// `apps/web/src/app/(app)/settings/members/actions.test.ts`.
vi.mock("@/lib/repositories/publishing", () => ({ publishingRepository: {} }));
vi.mock("@/lib/repositories/media", () => ({ mediaRepository: {} }));
vi.mock("@/lib/repositories/workspace", () => ({ workspaceRepository: {} }));
vi.mock("@/lib/adapters/outstand", () => ({
  getOutstandAdapter: vi.fn(() => ({})),
}));
vi.mock("@/lib/adapters/media-storage/supabase-media-storage-adapter", () => ({
  supabaseMediaStorageAdapter: {},
}));
// T-027.5 — `scheduleDraftAction` sekarang meng-enqueue job polling outcome
// lewat `backgroundJobScheduler` (Prisma `BackgroundJob` di baliknya) — mock
// supaya modul ini tidak menginisialisasi `PrismaClient` nyata (butuh
// `DATABASE_URL`) hanya untuk test Server Action yang sudah memalsukan
// seluruh repository/adapter lain.
vi.mock("@/lib/jobs/job-scheduler", () => ({
  backgroundJobScheduler: { scheduleJob: vi.fn(async () => undefined) },
}));

import { MediaService } from "@/domains/media";
import {
  PublishingService,
  PublishNowUseCase,
  SchedulePostsUseCase,
} from "@/domains/publishing";
import { WorkspaceService } from "@/domains/workspace";
import {
  publishNowAction,
  saveDraftAction,
  scheduleDraftAction,
  updateDraftAction,
} from "./actions";

function fakePost(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: asPostId("post-1"),
    workspaceId: WORKSPACE_ID,
    authorId: USER_ID,
    caption: "caption",
    status: ContentStatus.Draft,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("draft-editor actions — mediaIds undefined vs [] (T-024.4 fix)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    redirectMock.mockClear();
  });

  describe("saveDraftAction", () => {
    it("(a) field mediaIds tidak dikirim → diteruskan sebagai undefined ke PublishingService.saveDraft (kolom tidak disentuh)", async () => {
      const saveDraftSpy = vi
        .spyOn(PublishingService.prototype, "saveDraft")
        .mockResolvedValue(fakePost() as never);
      const listByIdsSpy = vi.spyOn(MediaService.prototype, "listByIds");

      await saveDraftAction({ caption: "hello" });

      expect(saveDraftSpy).toHaveBeenCalledTimes(1);
      const callArg = saveDraftSpy.mock.calls[0][0];
      expect(callArg.mediaIds).toBeUndefined();
      expect(listByIdsSpy).not.toHaveBeenCalled();
    });

    it("(b) mediaIds: [] eksplisit → tetap diteruskan sebagai [] (kolom benar-benar dikosongkan)", async () => {
      const saveDraftSpy = vi
        .spyOn(PublishingService.prototype, "saveDraft")
        .mockResolvedValue(fakePost() as never);

      await saveDraftAction({ caption: "hello", mediaIds: [] });

      const callArg = saveDraftSpy.mock.calls[0][0];
      expect(callArg.mediaIds).toEqual([]);
    });

    it("(c) mediaIds dengan isi → diteruskan apa adanya setelah validasi ownership", async () => {
      const mediaId = asMediaId("media-1");
      vi.spyOn(MediaService.prototype, "listByIds").mockResolvedValue([
        { id: mediaId } as never,
      ]);
      const saveDraftSpy = vi
        .spyOn(PublishingService.prototype, "saveDraft")
        .mockResolvedValue(fakePost() as never);

      await saveDraftAction({ caption: "hello", mediaIds: ["media-1"] });

      const callArg = saveDraftSpy.mock.calls[0][0];
      expect(callArg.mediaIds).toEqual([mediaId]);
    });
  });

  describe("updateDraftAction", () => {
    it("(a) field mediaIds tidak dikirim → diteruskan sebagai undefined ke PublishingService.updateDraft", async () => {
      const updateDraftSpy = vi
        .spyOn(PublishingService.prototype, "updateDraft")
        .mockResolvedValue(fakePost() as never);

      await updateDraftAction("post-1", { caption: "hello" });

      const callArg = updateDraftSpy.mock.calls[0][0];
      expect(callArg.mediaIds).toBeUndefined();
    });

    it("(b) mediaIds: [] eksplisit → tetap diteruskan sebagai []", async () => {
      const updateDraftSpy = vi
        .spyOn(PublishingService.prototype, "updateDraft")
        .mockResolvedValue(fakePost() as never);

      await updateDraftAction("post-1", { caption: "hello", mediaIds: [] });

      const callArg = updateDraftSpy.mock.calls[0][0];
      expect(callArg.mediaIds).toEqual([]);
    });

    it("(c) mediaIds dengan isi → diteruskan apa adanya setelah validasi ownership", async () => {
      const mediaId = asMediaId("media-1");
      vi.spyOn(MediaService.prototype, "listByIds").mockResolvedValue([
        { id: mediaId } as never,
      ]);
      const updateDraftSpy = vi
        .spyOn(PublishingService.prototype, "updateDraft")
        .mockResolvedValue(fakePost() as never);

      await updateDraftAction("post-1", {
        caption: "hello",
        mediaIds: ["media-1"],
      });

      const callArg = updateDraftSpy.mock.calls[0][0];
      expect(callArg.mediaIds).toEqual([mediaId]);
    });
  });

  const CONNECTED_ACCOUNT = {
    id: asConnectedAccountId("account-1"),
    workspaceId: WORKSPACE_ID,
    platform: SocialPlatform.Instagram,
    outstandAccountId: "outstand-1",
    handle: "@acme",
    status: "active",
    reconnectRequired: false,
    connectedAt: new Date(),
  };
  const TARGETS = [
    {
      connectedAccountId: "account-1",
      contentFormat: ContentFormat.Post,
    },
  ];

  describe("scheduleDraftAction", () => {
    beforeEach(() => {
      vi.spyOn(
        WorkspaceService.prototype,
        "listConnectedAccounts",
      ).mockResolvedValue([CONNECTED_ACCOUNT] as never);
      vi.spyOn(SchedulePostsUseCase.prototype, "execute").mockResolvedValue(
        fakePost({ status: ContentStatus.Scheduled }) as never,
      );
    });

    it("(a) field mediaIds tidak dikirim → diteruskan sebagai undefined ke saveDraft", async () => {
      const saveDraftSpy = vi
        .spyOn(PublishingService.prototype, "saveDraft")
        .mockResolvedValue(fakePost() as never);
      const listByIdsSpy = vi.spyOn(MediaService.prototype, "listByIds");

      await scheduleDraftAction({
        caption: "hello",
        scheduledAt: new Date().toISOString(),
        targets: TARGETS,
      });

      const callArg = saveDraftSpy.mock.calls[0][0];
      expect(callArg.mediaIds).toBeUndefined();
      expect(listByIdsSpy).not.toHaveBeenCalled();
    });

    it("(b) mediaIds: [] eksplisit → tetap diteruskan sebagai []", async () => {
      const saveDraftSpy = vi
        .spyOn(PublishingService.prototype, "saveDraft")
        .mockResolvedValue(fakePost() as never);

      await scheduleDraftAction({
        caption: "hello",
        scheduledAt: new Date().toISOString(),
        targets: TARGETS,
        mediaIds: [],
      });

      const callArg = saveDraftSpy.mock.calls[0][0];
      expect(callArg.mediaIds).toEqual([]);
    });

    it("(c) mediaIds dengan isi → diteruskan apa adanya setelah validasi ownership", async () => {
      const mediaId = asMediaId("media-1");
      vi.spyOn(MediaService.prototype, "listByIds").mockResolvedValue([
        { id: mediaId } as never,
      ]);
      const saveDraftSpy = vi
        .spyOn(PublishingService.prototype, "saveDraft")
        .mockResolvedValue(fakePost() as never);

      await scheduleDraftAction({
        caption: "hello",
        scheduledAt: new Date().toISOString(),
        targets: TARGETS,
        mediaIds: ["media-1"],
      });

      const callArg = saveDraftSpy.mock.calls[0][0];
      expect(callArg.mediaIds).toEqual([mediaId]);
    });

    it("(d) target Story tanpa media → menolak (KI-074), tidak sampai memanggil use-case", async () => {
      vi.spyOn(PublishingService.prototype, "saveDraft").mockResolvedValue(
        fakePost() as never,
      );
      const executeSpy = vi.spyOn(SchedulePostsUseCase.prototype, "execute");

      // T-108 code-review (PR #140, finding #1): `scheduleDraftAction`
      // sekarang menangkap `PublishingDomainError`/`ApplicationError` dan
      // mengembalikannya sebagai `{ error }` (bukan reject) — menghindari
      // Next.js men-mask pesan error di production build. Lihat
      // `isKnownActionError` di `actions.ts`.
      const result = await scheduleDraftAction({
        caption: "",
        scheduledAt: new Date().toISOString(),
        targets: [
          {
            connectedAccountId: "account-1",
            contentFormat: ContentFormat.Story,
          },
        ],
        mediaIds: [],
      });
      expect(result).toMatchObject({
        error: expect.stringMatching(/minimal 1 media/),
      });
      expect(executeSpy).not.toHaveBeenCalled();
    });

    it("(e) target Story, field mediaIds tidak dikirim sama sekali (undefined) DAN tanpa postId → tetap menolak (effectiveMediaCount 0), tidak sampai memanggil use-case", async () => {
      vi.spyOn(PublishingService.prototype, "saveDraft").mockResolvedValue(
        fakePost() as never,
      );
      const executeSpy = vi.spyOn(SchedulePostsUseCase.prototype, "execute");

      const result = await scheduleDraftAction({
        caption: "",
        scheduledAt: new Date().toISOString(),
        targets: [
          {
            connectedAccountId: "account-1",
            contentFormat: ContentFormat.Story,
          },
        ],
        // `mediaIds` SENGAJA tidak diisi (bukan `[]`) — post baru tanpa
        // `postId`, jadi tidak ada draft existing untuk di-lookup;
        // `effectiveMediaCount` harus tetap dievaluasi sebagai 0, bukan
        // silently lolos karena field-nya undefined.
      });
      expect(result).toMatchObject({
        error: expect.stringMatching(/minimal 1 media/),
      });
      expect(executeSpy).not.toHaveBeenCalled();
    });
  });

  describe("publishNowAction", () => {
    beforeEach(() => {
      vi.spyOn(
        WorkspaceService.prototype,
        "listConnectedAccounts",
      ).mockResolvedValue([CONNECTED_ACCOUNT] as never);
      vi.spyOn(PublishNowUseCase.prototype, "execute").mockResolvedValue(
        fakePost({ status: ContentStatus.Published }) as never,
      );
    });

    it("(a) field mediaIds tidak dikirim → diteruskan sebagai undefined ke saveDraft", async () => {
      const saveDraftSpy = vi
        .spyOn(PublishingService.prototype, "saveDraft")
        .mockResolvedValue(fakePost() as never);

      await publishNowAction({ caption: "hello", targets: TARGETS });

      const callArg = saveDraftSpy.mock.calls[0][0];
      expect(callArg.mediaIds).toBeUndefined();
    });

    it("(b) mediaIds: [] eksplisit → tetap diteruskan sebagai []", async () => {
      const saveDraftSpy = vi
        .spyOn(PublishingService.prototype, "saveDraft")
        .mockResolvedValue(fakePost() as never);

      await publishNowAction({
        caption: "hello",
        targets: TARGETS,
        mediaIds: [],
      });

      const callArg = saveDraftSpy.mock.calls[0][0];
      expect(callArg.mediaIds).toEqual([]);
    });

    it("(c) mediaIds dengan isi → diteruskan apa adanya setelah validasi ownership", async () => {
      const mediaId = asMediaId("media-1");
      vi.spyOn(MediaService.prototype, "listByIds").mockResolvedValue([
        { id: mediaId } as never,
      ]);
      const saveDraftSpy = vi
        .spyOn(PublishingService.prototype, "saveDraft")
        .mockResolvedValue(fakePost() as never);

      await publishNowAction({
        caption: "hello",
        targets: TARGETS,
        mediaIds: ["media-1"],
      });

      const callArg = saveDraftSpy.mock.calls[0][0];
      expect(callArg.mediaIds).toEqual([mediaId]);
    });

    it("(d) target Story tanpa media → menolak (KI-074), tidak sampai memanggil use-case", async () => {
      vi.spyOn(PublishingService.prototype, "saveDraft").mockResolvedValue(
        fakePost() as never,
      );
      const executeSpy = vi.spyOn(PublishNowUseCase.prototype, "execute");

      const result = await publishNowAction({
        caption: "",
        targets: [
          {
            connectedAccountId: "account-1",
            contentFormat: ContentFormat.Story,
          },
        ],
        mediaIds: [],
      });
      expect(result).toMatchObject({
        error: expect.stringMatching(/minimal 1 media/),
      });
      expect(executeSpy).not.toHaveBeenCalled();
    });
  });
});
