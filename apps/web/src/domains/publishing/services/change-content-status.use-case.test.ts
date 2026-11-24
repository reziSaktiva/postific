import {
  asPostId,
  asUserId,
  asWorkspaceId,
  ContentStatus,
  MemberRole,
  type PostId,
} from "@postific/shared";
import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
} from "@/lib/utils/errors";
import type { ContentStatusTransitionTarget } from "../content-status-transition";
import type { IContentStatusRepository } from "../repositories/publishing.repository";
import { ChangeContentStatusUseCase } from "./change-content-status.use-case";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const USER_ID = asUserId("user-1");
const POST_ID = asPostId("post-1");

/** In-memory posts of one workspace, with a compare-and-set write. */
function createRepository(initial: Record<string, ContentStatus>) {
  const statuses = new Map<string, ContentStatus>(Object.entries(initial));
  const repository: IContentStatusRepository = {
    findPostStatusById: async ({ workspaceId, postId }) =>
      workspaceId === WORKSPACE_ID && statuses.has(postId)
        ? { status: statuses.get(postId)! }
        : null,
    transitionContentStatus: async ({ workspaceId, postId, from, to }) => {
      if (workspaceId !== WORKSPACE_ID || statuses.get(postId) !== from) {
        return null;
      }
      statuses.set(postId, to);
      return {
        id: postId,
        workspaceId,
        authorId: USER_ID,
        caption: "caption",
        status: to,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      };
    },
  };
  return { repository, statusOf: (id: PostId) => statuses.get(id) };
}

function run(
  repository: IContentStatusRepository,
  to: ContentStatusTransitionTarget,
  overrides: { postId?: PostId; actorRole?: MemberRole } = {},
) {
  return new ChangeContentStatusUseCase(repository).execute({
    workspaceId: WORKSPACE_ID,
    postId: overrides.postId ?? POST_ID,
    to,
    actorRole: overrides.actorRole ?? MemberRole.Creator,
    actingUserId: USER_ID,
  });
}

describe("ChangeContentStatusUseCase", () => {
  it.each([
    [ContentStatus.Draft, ContentStatus.InReview],
    [ContentStatus.InReview, ContentStatus.Draft],
    [ContentStatus.InReview, ContentStatus.ReadyToSchedule],
  ] as const)("moves %s to %s", async (from, to) => {
    const { repository, statusOf } = createRepository({ [POST_ID]: from });

    const record = await run(repository, to);

    expect(record.status).toBe(to);
    expect(statusOf(POST_ID)).toBe(to);
  });

  it.each([MemberRole.Owner, MemberRole.Admin, MemberRole.Creator])(
    "allows the %s role",
    async (actorRole) => {
      const { repository } = createRepository({
        [POST_ID]: ContentStatus.InReview,
      });

      await expect(
        run(repository, ContentStatus.ReadyToSchedule, { actorRole }),
      ).resolves.toMatchObject({ status: ContentStatus.ReadyToSchedule });
    },
  );

  it("rejects a role outside the three roles and leaves the status", async () => {
    const { repository, statusOf } = createRepository({
      [POST_ID]: ContentStatus.InReview,
    });

    await expect(
      run(repository, ContentStatus.Draft, {
        actorRole: "viewer" as MemberRole,
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(statusOf(POST_ID)).toBe(ContentStatus.InReview);
  });

  it.each([
    [ContentStatus.Imported, ContentStatus.Draft],
    [ContentStatus.Imported, ContentStatus.InReview],
    [ContentStatus.Scheduled, ContentStatus.InReview],
    [ContentStatus.Published, ContentStatus.Draft],
    [ContentStatus.Failed, ContentStatus.InReview],
    [ContentStatus.ReadyToSchedule, ContentStatus.InReview],
    [ContentStatus.Draft, ContentStatus.ReadyToSchedule],
    [ContentStatus.InReview, ContentStatus.InReview],
    [ContentStatus.Draft, ContentStatus.Draft],
  ] as const)("rejects %s to %s and leaves the status", async (from, to) => {
    const { repository, statusOf } = createRepository({ [POST_ID]: from });

    await expect(run(repository, to)).rejects.toBeInstanceOf(ConflictError);
    expect(statusOf(POST_ID)).toBe(from);
  });

  it("reports a missing post as not found", async () => {
    const { repository } = createRepository({});

    await expect(
      run(repository, ContentStatus.ReadyToSchedule),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects when the status changed between the read and the write", async () => {
    const { repository } = createRepository({
      [POST_ID]: ContentStatus.InReview,
    });
    const racing: IContentStatusRepository = {
      ...repository,
      transitionContentStatus: async () => null,
    };

    await expect(
      run(racing, ContentStatus.ReadyToSchedule),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
