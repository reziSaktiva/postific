import {
  ContentFormat,
  ContentStatus,
  PostCreatedVia,
  SocialPlatform,
  asConnectedAccountId,
  asMediaId,
  asPostId,
  asUserId,
  asWorkspaceId,
} from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import type { ConnectedAccountRecord } from "@/domains/workspace";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/utils/errors";
import { PublishingDomainError } from "../errors";
import type {
  DraftTargetRecord,
  IPublishingRepository,
  PublishingPostRecord,
} from "../repositories/publishing.repository";
import {
  ComposeDraftUseCase,
  DRAFT_CAPTION_MAX_LENGTH,
} from "./compose-draft.use-case";
import { PublishingService } from "./publishing.service";

const WORKSPACE = asWorkspaceId("ws-1");
const USER = asUserId("user-1");
const POST = asPostId("post-1");
const IG = asConnectedAccountId("acc-ig");
const PIN = asConnectedAccountId("acc-pin");
const TT = asConnectedAccountId("acc-tt");
const SOURCE = {
  createdVia: PostCreatedVia.Mcp,
  clientId: "client-1",
} as const;

function account(
  id: ReturnType<typeof asConnectedAccountId>,
  platform: SocialPlatform,
): ConnectedAccountRecord {
  return {
    id,
    workspaceId: WORKSPACE,
    platform,
    outstandAccountId: `out-${id}`,
    handle: `@${id}`,
    status: "active",
    reconnectRequired: false,
    connectedAt: new Date(0),
    lastImportedUntil: null,
    lastImportRequestedAt: null,
  };
}

const ACCOUNTS = [
  account(IG, SocialPlatform.Instagram),
  account(PIN, SocialPlatform.Pinterest),
  account(TT, SocialPlatform.TikTok),
];

function post(overrides: Partial<PublishingPostRecord> = {}) {
  return {
    id: POST,
    workspaceId: WORKSPACE,
    authorId: USER,
    caption: "lama",
    status: ContentStatus.Draft,
    mediaIds: [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  } satisfies PublishingPostRecord;
}

/**
 * Repository palsu lokal: merekam `createDraft`/`updateDraftCaption` dan
 * memegang satu post tersimpan, supaya `PublishingService` ASLI ikut jalan
 * (use-case dites di atas service sungguhan, bukan service palsu).
 */
function setup(
  options: {
    stored?: PublishingPostRecord | null;
    storedStatus?: ContentStatus | null;
    ownedMedia?: string[];
  } = {},
) {
  const stored =
    options.stored === undefined ? post({ draftTargets: [] }) : options.stored;
  const status =
    options.storedStatus !== undefined
      ? options.storedStatus
      : (stored?.status ?? null);

  const createDraft = vi.fn(
    async (input: Parameters<IPublishingRepository["createDraft"]>[0]) =>
      post({
        caption: input.caption,
        mediaIds: input.mediaIds ?? [],
        createdVia: input.source?.createdVia ?? PostCreatedVia.App,
        createdViaClientId:
          input.source?.createdVia === PostCreatedVia.Mcp
            ? input.source.clientId
            : null,
      }),
  );
  const updateDraftCaption = vi.fn(
    async (input: Parameters<IPublishingRepository["updateDraftCaption"]>[0]) =>
      post({ caption: input.caption, mediaIds: input.mediaIds ?? [] }),
  );
  const findPostStatusById = vi.fn(async () =>
    status === null ? null : { status },
  );
  const findDraftById = vi.fn(async () => stored);
  const repository = {
    createDraft,
    updateDraftCaption,
    findPostStatusById,
    findDraftById,
  } as unknown as IPublishingRepository;

  const listConnectedAccounts = vi.fn(async () => ACCOUNTS);
  const owned = options.ownedMedia ?? [];
  const listByIds = vi.fn(
    async (input: { mediaIds: ReturnType<typeof asMediaId>[] }) =>
      input.mediaIds.filter((id) => owned.includes(id)).map((id) => ({ id })),
  );

  const useCase = new ComposeDraftUseCase(
    new PublishingService(repository),
    repository,
    { listConnectedAccounts },
    { listByIds },
  );
  return {
    useCase,
    createDraft,
    updateDraftCaption,
    findDraftById,
    listConnectedAccounts,
    listByIds,
  };
}

const MEDIA_A = "media-a";
const MEDIA_B = "media-b";

describe("ComposeDraftUseCase.createDraft", () => {
  it("saves a draft stamped with the MCP source and returns the resolved targets", async () => {
    const { useCase, createDraft } = setup({ ownedMedia: [MEDIA_A] });

    const result = await useCase.createDraft({
      workspaceId: WORKSPACE,
      authorId: USER,
      caption: "  Halo  ",
      mediaIds: [MEDIA_A],
      targets: [{ connectedAccountId: IG, contentFormat: ContentFormat.Reel }],
      source: SOURCE,
    });

    expect(createDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      authorId: USER,
      caption: "Halo",
      mediaIds: [asMediaId(MEDIA_A)],
      targets: [
        {
          connectedAccountId: IG,
          platform: SocialPlatform.Instagram,
          contentFormat: ContentFormat.Reel,
        },
      ],
      source: SOURCE,
    });
    expect(result.post.createdVia).toBe(PostCreatedVia.Mcp);
    expect(result.post.createdViaClientId).toBe("client-1");
    expect(result.targets).toEqual([
      expect.objectContaining({ connectedAccountId: IG }),
    ]);
  });

  it("does not look up accounts or media when none are given", async () => {
    const { useCase, createDraft, listConnectedAccounts, listByIds } = setup();

    await useCase.createDraft({
      workspaceId: WORKSPACE,
      authorId: USER,
      caption: "Saja caption",
      source: SOURCE,
    });

    expect(listConnectedAccounts).not.toHaveBeenCalled();
    expect(listByIds).not.toHaveBeenCalled();
    expect(createDraft.mock.calls[0]?.[0]).not.toHaveProperty("targets");
    expect(createDraft.mock.calls[0]?.[0]).not.toHaveProperty("mediaIds");
  });

  it("rejects a caption over the limit but accepts exactly the limit", async () => {
    const { useCase, createDraft } = setup();
    const base = { workspaceId: WORKSPACE, authorId: USER, source: SOURCE };

    await expect(
      useCase.createDraft({
        ...base,
        caption: "a".repeat(DRAFT_CAPTION_MAX_LENGTH + 1),
      }),
    ).rejects.toThrow(ValidationError);
    expect(createDraft).not.toHaveBeenCalled();

    await useCase.createDraft({
      ...base,
      caption: "a".repeat(DRAFT_CAPTION_MAX_LENGTH),
    });
    expect(createDraft).toHaveBeenCalledOnce();
  });

  it("measures the caption as stored: trailing whitespace counts toward the limit", async () => {
    const { useCase, createDraft } = setup();

    await expect(
      useCase.createDraft({
        workspaceId: WORKSPACE,
        authorId: USER,
        source: SOURCE,
        caption: `a${" ".repeat(DRAFT_CAPTION_MAX_LENGTH)}`,
      }),
    ).rejects.toThrow(ValidationError);
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("rejects a content format the platform does not allow (ADR-039 matrix)", async () => {
    const { useCase, createDraft } = setup();
    await expect(
      useCase.createDraft({
        workspaceId: WORKSPACE,
        authorId: USER,
        caption: "x",
        targets: [
          { connectedAccountId: TT, contentFormat: ContentFormat.Reel },
        ],
        source: SOURCE,
      }),
    ).rejects.toThrow(PublishingDomainError);
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("rejects an unknown content format and an account outside the workspace", async () => {
    const { useCase } = setup();
    const base = {
      workspaceId: WORKSPACE,
      authorId: USER,
      caption: "x",
      source: SOURCE,
    };

    await expect(
      useCase.createDraft({
        ...base,
        targets: [{ connectedAccountId: IG, contentFormat: "carousel" }],
      }),
    ).rejects.toThrow(ValidationError);
    await expect(
      useCase.createDraft({
        ...base,
        targets: [
          {
            connectedAccountId: asConnectedAccountId("acc-asing"),
            contentFormat: ContentFormat.Post,
          },
        ],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects the same account twice", async () => {
    const { useCase, listConnectedAccounts } = setup();
    await expect(
      useCase.createDraft({
        workspaceId: WORKSPACE,
        authorId: USER,
        caption: "x",
        targets: [
          { connectedAccountId: IG, contentFormat: ContentFormat.Post },
          { connectedAccountId: IG, contentFormat: ContentFormat.Reel },
        ],
        source: SOURCE,
      }),
    ).rejects.toThrow(/lebih dari sekali/);
    expect(listConnectedAccounts).not.toHaveBeenCalled();
  });

  it("rejects media that is not owned by the workspace (anti-IDOR)", async () => {
    const { useCase, createDraft } = setup({ ownedMedia: [MEDIA_A] });
    await expect(
      useCase.createDraft({
        workspaceId: WORKSPACE,
        authorId: USER,
        caption: "x",
        mediaIds: [MEDIA_A, MEDIA_B],
        source: SOURCE,
      }),
    ).rejects.toThrow(ValidationError);
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("rejects duplicated media ids and more than 10 media before querying the DB", async () => {
    const { useCase, listByIds } = setup();
    const base = {
      workspaceId: WORKSPACE,
      authorId: USER,
      caption: "x",
      source: SOURCE,
    };

    await expect(
      useCase.createDraft({ ...base, mediaIds: [MEDIA_A, MEDIA_A] }),
    ).rejects.toThrow(/lebih dari sekali/);
    await expect(
      useCase.createDraft({
        ...base,
        mediaIds: Array.from({ length: 11 }, (_, i) => `m-${i}`),
      }),
    ).rejects.toThrow(PublishingDomainError);
    expect(listByIds).not.toHaveBeenCalled();
  });

  it("enforces the single-media limit of Reel/Story/Pin against the chosen targets (ADR-107)", async () => {
    const { useCase } = setup({ ownedMedia: [MEDIA_A, MEDIA_B] });
    await expect(
      useCase.createDraft({
        workspaceId: WORKSPACE,
        authorId: USER,
        caption: "x",
        mediaIds: [MEDIA_A, MEDIA_B],
        targets: [
          { connectedAccountId: IG, contentFormat: ContentFormat.Reel },
        ],
        source: SOURCE,
      }),
    ).rejects.toThrow(PublishingDomainError);
  });
});

describe("ComposeDraftUseCase.updateDraft", () => {
  const base = { workspaceId: WORKSPACE, postId: POST, actingUserId: USER };

  it("updates only the caption and keeps media and targets untouched", async () => {
    const stored = post({
      draftTargets: [
        {
          connectedAccountId: IG,
          platform: SocialPlatform.Instagram,
          contentFormat: ContentFormat.Post,
        },
      ],
    });
    const { useCase, updateDraftCaption } = setup({ stored });

    const result = await useCase.updateDraft({ ...base, caption: "baru" });

    expect(updateDraftCaption).toHaveBeenCalledWith(
      { workspaceId: WORKSPACE, postId: POST, caption: "baru" },
      USER,
    );
    expect(result.targets).toEqual(stored.draftTargets);
  });

  it("keeps the existing caption when only media is changed", async () => {
    const { useCase, updateDraftCaption } = setup({
      stored: post({ caption: "caption lama", draftTargets: [] }),
      ownedMedia: [MEDIA_A],
    });

    await useCase.updateDraft({ ...base, mediaIds: [MEDIA_A] });

    expect(updateDraftCaption).toHaveBeenCalledWith(
      {
        workspaceId: WORKSPACE,
        postId: POST,
        caption: "caption lama",
        mediaIds: [asMediaId(MEDIA_A)],
      },
      USER,
    );
  });

  it("passes empty arrays through to clear media and targets", async () => {
    const { useCase, updateDraftCaption } = setup();

    await useCase.updateDraft({ ...base, mediaIds: [], targets: [] });

    expect(updateDraftCaption.mock.calls[0]?.[0]).toMatchObject({
      mediaIds: [],
      targets: [],
    });
  });

  it("carries over the platformOptions (e.g. Pinterest board) of an account that stays selected", async () => {
    const existing: DraftTargetRecord = {
      connectedAccountId: PIN,
      platform: SocialPlatform.Pinterest,
      contentFormat: ContentFormat.Pin,
      platformOptions: { boardId: "board-1" },
    };
    const { useCase, updateDraftCaption } = setup({
      stored: post({ draftTargets: [existing] }),
    });

    await useCase.updateDraft({
      ...base,
      targets: [
        { connectedAccountId: PIN, contentFormat: ContentFormat.Pin },
        { connectedAccountId: IG, contentFormat: ContentFormat.Post },
      ],
    });

    expect(updateDraftCaption.mock.calls[0]?.[0].targets).toEqual([
      {
        connectedAccountId: PIN,
        platform: SocialPlatform.Pinterest,
        contentFormat: ContentFormat.Pin,
        platformOptions: { boardId: "board-1" },
      },
      {
        connectedAccountId: IG,
        platform: SocialPlatform.Instagram,
        contentFormat: ContentFormat.Post,
      },
    ]);
  });

  it("checks the media limit against the stored targets when only media is sent", async () => {
    const { useCase, updateDraftCaption } = setup({
      stored: post({
        draftTargets: [
          {
            connectedAccountId: IG,
            platform: SocialPlatform.Instagram,
            contentFormat: ContentFormat.Story,
          },
        ],
      }),
      ownedMedia: [MEDIA_A, MEDIA_B],
    });

    await expect(
      useCase.updateDraft({ ...base, mediaIds: [MEDIA_A, MEDIA_B] }),
    ).rejects.toThrow(PublishingDomainError);
    expect(updateDraftCaption).not.toHaveBeenCalled();
  });

  it("rejects a call that changes nothing", async () => {
    const { useCase, findDraftById } = setup();
    await expect(useCase.updateDraft(base)).rejects.toThrow(ValidationError);
    expect(findDraftById).not.toHaveBeenCalled();
  });

  it("rejects an over-long caption before touching the repository", async () => {
    const { useCase, findDraftById } = setup();
    await expect(
      useCase.updateDraft({
        ...base,
        caption: "a".repeat(DRAFT_CAPTION_MAX_LENGTH + 1),
      }),
    ).rejects.toThrow(ValidationError);
    expect(findDraftById).not.toHaveBeenCalled();
  });

  it("returns not found when the post does not exist in this workspace", async () => {
    const { useCase, updateDraftCaption } = setup({
      stored: null,
      storedStatus: null,
    });
    await expect(
      useCase.updateDraft({ ...base, caption: "x" }),
    ).rejects.toThrow(NotFoundError);
    expect(updateDraftCaption).not.toHaveBeenCalled();
  });

  it("refuses a scheduled post with a message that tells the AI how to proceed", async () => {
    const { useCase, updateDraftCaption } = setup({
      stored: post({ status: ContentStatus.Scheduled }),
    });
    const error = await useCase
      .updateDraft({ ...base, caption: "x" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as Error).message).toMatch(/sudah dijadwalkan/);
    expect((error as Error).message).toMatch(/Batalkan jadwal/);
    expect(updateDraftCaption).not.toHaveBeenCalled();
  });

  it.each([
    ContentStatus.Published,
    ContentStatus.Failed,
    ContentStatus.Imported,
  ])("refuses a %s post as read-only without loading it", async (status) => {
    const { useCase, updateDraftCaption, findDraftById } = setup({
      stored: post({ status }),
    });
    await expect(
      useCase.updateDraft({ ...base, caption: "x" }),
    ).rejects.toThrow(/read-only/);
    // Imported tidak boleh lewat `findDraftById` (authorId null).
    expect(findDraftById).not.toHaveBeenCalled();
    expect(updateDraftCaption).not.toHaveBeenCalled();
  });

  it.each([ContentStatus.InReview, ContentStatus.ReadyToSchedule])(
    "refuses a %s post: only drafts are editable through MCP",
    async (status) => {
      const { useCase, updateDraftCaption } = setup({
        stored: post({ status }),
      });
      await expect(
        useCase.updateDraft({ ...base, caption: "x" }),
      ).rejects.toThrow(/Hanya post berstatus draft/);
      expect(updateDraftCaption).not.toHaveBeenCalled();
    },
  );

  it("turns a lost race (status changed after the check) into a conflict, not a silent success", async () => {
    const { useCase, updateDraftCaption } = setup();
    updateDraftCaption.mockResolvedValueOnce(null as never);
    await expect(
      useCase.updateDraft({ ...base, caption: "x" }),
    ).rejects.toThrow(ConflictError);
  });
});
