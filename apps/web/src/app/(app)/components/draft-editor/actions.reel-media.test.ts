import {
  asConnectedAccountId,
  asMediaId,
  asPostId,
  asUserId,
  asWorkspaceId,
  ContentFormat,
  ContentStatus,
  MediaType,
  MemberRole,
  SocialPlatform,
} from "@postific/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * T-200 (ADR-155 addendum B.1): Reel (Facebook dan Instagram) hanya sah dengan
 * tepat satu video. Diuji di batas publik Server Action: `scheduleDraftAction`
 * dan `publishNowAction` menolak sebelum menulis atau memanggil use-case;
 * Save as Draft (`saveDraftAction`) tetap boleh karena draft boleh belum lengkap.
 * Service dan use-case di-spy di prototype, pola `actions.media-ids.test.ts`.
 */

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const USER_ID = asUserId("user-1");
const REEL_MESSAGE =
  "Reel membutuhkan satu video. Ganti media dengan video, atau pilih format Post atau Story.";

const { getSessionMock, redirectMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/better-auth/session", () => ({
  getCachedSession: getSessionMock,
}));
vi.mock("@/lib/workspace/workspace-context", () => ({
  getWorkspaceContext: vi.fn(async () => ({
    workspaceId: WORKSPACE_ID,
    role: MemberRole.Owner,
  })),
}));
vi.mock("@/lib/repositories/publishing", () => ({ publishingRepository: {} }));
vi.mock("@/lib/repositories/media", () => ({ mediaRepository: {} }));
vi.mock("@/lib/repositories/workspace", () => ({ workspaceRepository: {} }));
vi.mock("@/lib/adapters/outstand", () => ({
  getOutstandAdapter: vi.fn(() => ({})),
}));
vi.mock("@/lib/adapters/media-storage/supabase-media-storage-adapter", () => ({
  supabaseMediaStorageAdapter: {},
}));
vi.mock("@/lib/jobs/job-scheduler", () => ({
  backgroundJobScheduler: { scheduleJob: vi.fn(async () => undefined) },
}));

import { MediaService } from "@/domains/media";
import {
  PublishingService,
  PublishNowUseCase,
  reelMediaConstraintMessage,
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

function account(platform: SocialPlatform) {
  return {
    id: asConnectedAccountId("account-1"),
    workspaceId: WORKSPACE_ID,
    platform,
    outstandAccountId: "outstand-1",
    handle: "@acme",
    status: "active",
    reconnectRequired: false,
    connectedAt: new Date(),
  };
}

const VIDEO_1 = asMediaId("media-video-1");
const VIDEO_2 = asMediaId("media-video-2");
const IMAGE_1 = asMediaId("media-image-1");
const GIF_1 = asMediaId("media-gif-1");
const DELETED = asMediaId("media-deleted");

/** Media tersimpan di "DB": `listByIds` hanya mengembalikan yang diminta. */
function stubStoredMedia() {
  const stored = [
    { id: VIDEO_1, type: MediaType.Video },
    { id: VIDEO_2, type: MediaType.Video },
    { id: IMAGE_1, type: MediaType.Image },
    { id: GIF_1, type: MediaType.Gif },
  ];
  vi.spyOn(MediaService.prototype, "listByIds").mockImplementation((async ({
    mediaIds,
  }: {
    mediaIds: (typeof VIDEO_1)[];
  }) => stored.filter((item) => mediaIds.includes(item.id))) as never);
}

const reelTarget = (contentFormat: ContentFormat) => [
  { connectedAccountId: "account-1", contentFormat },
];

describe.each([
  ["Instagram", SocialPlatform.Instagram],
  ["Facebook", SocialPlatform.Facebook],
])("Reel wajib satu video di server (T-200), %s", (_name, platform) => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    vi.spyOn(
      WorkspaceService.prototype,
      "listConnectedAccounts",
    ).mockResolvedValue([account(platform)] as never);
    stubStoredMedia();
  });

  const paths = [
    {
      name: "scheduleDraftAction",
      useCase: () =>
        vi
          .spyOn(SchedulePostsUseCase.prototype, "execute")
          .mockResolvedValue(
            fakePost({ status: ContentStatus.Scheduled }) as never,
          ),
      call: (input: {
        postId?: string;
        mediaIds?: string[];
        contentFormat: ContentFormat;
      }) =>
        scheduleDraftAction({
          postId: input.postId,
          caption: "hello",
          scheduledAt: new Date().toISOString(),
          targets: reelTarget(input.contentFormat),
          mediaIds: input.mediaIds,
        }),
    },
    {
      name: "publishNowAction",
      useCase: () =>
        vi
          .spyOn(PublishNowUseCase.prototype, "execute")
          .mockResolvedValue(
            fakePost({ status: ContentStatus.Published }) as never,
          ),
      call: (input: {
        postId?: string;
        mediaIds?: string[];
        contentFormat: ContentFormat;
      }) =>
        publishNowAction({
          postId: input.postId,
          caption: "hello",
          targets: reelTarget(input.contentFormat),
          mediaIds: input.mediaIds,
        }),
    },
  ];

  describe.each(paths)("$name", ({ useCase, call }) => {
    it("menerima Reel dengan tepat satu video", async () => {
      const execute = useCase();
      vi.spyOn(PublishingService.prototype, "saveDraft").mockResolvedValue(
        fakePost() as never,
      );

      const result = await call({
        mediaIds: [VIDEO_1],
        contentFormat: ContentFormat.Reel,
      });

      expect(result).toEqual({ postId: "post-1" });
      expect(execute).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["satu gambar", [IMAGE_1]],
      ["satu GIF", [GIF_1]],
    ])(
      "menolak Reel dengan %s lewat aturan Reel, tanpa menyimpan atau memanggil use-case",
      async (_label, mediaIds) => {
        const execute = useCase();
        const saveDraft = vi.spyOn(PublishingService.prototype, "saveDraft");

        const result = await call({
          mediaIds,
          contentFormat: ContentFormat.Reel,
        });

        expect(result).toEqual({ error: REEL_MESSAGE });
        expect(saveDraft).not.toHaveBeenCalled();
        expect(execute).not.toHaveBeenCalled();
      },
    );

    // Dua media atau lebih ke target Reel ditolak lebih dulu oleh batas
    // maksimum ADR-107 ("melebihi batas maksimum 1"), bukan oleh aturan Reel.
    // Urutan cek ini sengaja tidak dibalik: keputusannya sama (ditolak), teksnya
    // beda. Klien memakai pesan Reel dari `reelMediaConstraintMessage` untuk
    // kasus yang sama, jadi dua jaringan pesan ini memang berbeda.
    it.each([
      ["gambar dan video", [IMAGE_1, VIDEO_1]],
      ["dua video", [VIDEO_1, VIDEO_2]],
    ])(
      "menolak Reel dengan %s lewat batas maksimum ADR-107 (bukan aturan Reel), sementara pesan klien tetap pesan Reel",
      async (_label, mediaIds) => {
        const execute = useCase();
        const saveDraft = vi.spyOn(PublishingService.prototype, "saveDraft");

        const result = await call({
          mediaIds,
          contentFormat: ContentFormat.Reel,
        });

        expect(result).toEqual({
          error: expect.stringMatching(/melebihi batas maksimum 1/),
        });
        expect(saveDraft).not.toHaveBeenCalled();
        expect(execute).not.toHaveBeenCalled();
        expect(
          reelMediaConstraintMessage(
            [{ platform, contentFormat: ContentFormat.Reel }],
            mediaIds.map((id) => ({
              type:
                id === VIDEO_1 || id === VIDEO_2
                  ? MediaType.Video
                  : MediaType.Image,
            })),
          ),
        ).toBe(REEL_MESSAGE);
      },
    );

    it("memberi pesan Reel yang dikonfirmasi saat medianya gambar", async () => {
      useCase();

      const result = await call({
        mediaIds: [IMAGE_1],
        contentFormat: ContentFormat.Reel,
      });

      expect(result).toEqual({ error: REEL_MESSAGE });
    });

    it("tetap menerima Post dengan gambar", async () => {
      const execute = useCase();
      vi.spyOn(PublishingService.prototype, "saveDraft").mockResolvedValue(
        fakePost() as never,
      );

      const result = await call({
        mediaIds: [IMAGE_1],
        contentFormat: ContentFormat.Post,
      });

      expect(result).toEqual({ postId: "post-1" });
      expect(execute).toHaveBeenCalledTimes(1);
    });

    describe("mediaIds tidak dikirim, media diambil dari draft tersimpan", () => {
      it("menolak bila draft tersimpan berisi gambar", async () => {
        const execute = useCase();
        vi.spyOn(PublishingService.prototype, "getDraftById").mockResolvedValue(
          { ...fakePost(), mediaIds: [IMAGE_1], draftTargets: [] } as never,
        );
        const updateDraft = vi.spyOn(
          PublishingService.prototype,
          "updateDraft",
        );

        const result = await call({
          postId: "post-1",
          contentFormat: ContentFormat.Reel,
        });

        expect(result).toEqual({ error: REEL_MESSAGE });
        expect(updateDraft).not.toHaveBeenCalled();
        expect(execute).not.toHaveBeenCalled();
      });

      // Draft dengan dua media tersimpan atau lebih sudah ditolak batas
      // maksimum Reel lebih dulu, jadi kasus yang menembus ke pembacaan media
      // adalah draft dengan satu media yang sudah hilang.
      it("menolak dengan pesan kepemilikan bila media draft sudah terhapus atau bukan milik workspace, bukan meloloskan aturan Reel", async () => {
        const execute = useCase();
        vi.spyOn(PublishingService.prototype, "getDraftById").mockResolvedValue(
          { ...fakePost(), mediaIds: [DELETED], draftTargets: [] } as never,
        );
        const updateDraft = vi.spyOn(
          PublishingService.prototype,
          "updateDraft",
        );

        const result = await call({
          postId: "post-1",
          contentFormat: ContentFormat.Reel,
        });

        expect(result).toEqual({
          error: expect.stringMatching(
            /tidak ditemukan atau bukan milik workspace ini/,
          ),
        });
        expect(updateDraft).not.toHaveBeenCalled();
        expect(execute).not.toHaveBeenCalled();
      });

      it("menerima bila draft tersimpan berisi tepat satu video", async () => {
        const execute = useCase();
        vi.spyOn(PublishingService.prototype, "getDraftById").mockResolvedValue(
          { ...fakePost(), mediaIds: [VIDEO_1], draftTargets: [] } as never,
        );
        vi.spyOn(PublishingService.prototype, "updateDraft").mockResolvedValue(
          fakePost() as never,
        );

        const result = await call({
          postId: "post-1",
          contentFormat: ContentFormat.Reel,
        });

        expect(result).toEqual({ postId: "post-1" });
        expect(execute).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("Save as Draft tetap boleh melanggar aturan Reel", () => {
    it("saveDraftAction menyimpan draft Reel berisi gambar", async () => {
      const saveDraft = vi
        .spyOn(PublishingService.prototype, "saveDraft")
        .mockResolvedValue(fakePost() as never);

      const result = await saveDraftAction({
        caption: "hello",
        mediaIds: [IMAGE_1],
        activeFormats: [ContentFormat.Reel],
        targets: reelTarget(ContentFormat.Reel),
      });

      expect(result).toEqual({ postId: "post-1" });
      expect(saveDraft).toHaveBeenCalledTimes(1);
      expect(saveDraft.mock.calls[0]?.[0].mediaIds).toEqual([IMAGE_1]);
    });

    it("updateDraftAction menyimpan draft Reel berisi gambar", async () => {
      const updateDraft = vi
        .spyOn(PublishingService.prototype, "updateDraft")
        .mockResolvedValue(fakePost() as never);

      const result = await updateDraftAction("post-1", {
        caption: "hello",
        mediaIds: [IMAGE_1],
        activeFormats: [ContentFormat.Reel],
        targets: reelTarget(ContentFormat.Reel),
      });

      expect(result).toEqual({ postId: "post-1" });
      expect(updateDraft).toHaveBeenCalledTimes(1);
    });
  });
});
