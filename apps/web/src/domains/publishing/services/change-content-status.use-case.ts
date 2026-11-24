import type { MemberRole, PostId, UserId, WorkspaceId } from "@postific/shared";
import { ConflictError, NotFoundError } from "@/lib/utils/errors";
import {
  CONTENT_STATUS_TRANSITION_SOURCE,
  isAllowedContentStatusTransition,
  type ContentStatusTransitionTarget,
} from "../content-status-transition";
import { assertActorCanChangeContentStatus } from "../rbac";
import type {
  IContentStatusRepository,
  PublishingPostRecord,
} from "../repositories/publishing.repository";

/** User-facing message when the post is not in the one allowed source status. */
export const CONTENT_STATUS_TRANSITION_CONFLICT_MESSAGE =
  "Status konten sudah berubah, jadi aksi ini tidak bisa dijalankan. Muat ulang halaman lalu coba lagi.";

/**
 * Change the coordination status of a post (T-289, S-008): Draft -> In
 * Review, In Review -> Draft (Back to Draft), In Review -> Ready to Schedule
 * (Mark Ready). Rules in `../content-status-transition.ts`; RBAC first,
 * then the current status is checked, then a compare-and-set write so a
 * concurrent change is rejected instead of overwritten.
 */
export class ChangeContentStatusUseCase {
  constructor(private readonly repository: IContentStatusRepository) {}

  async execute(input: {
    workspaceId: WorkspaceId;
    postId: PostId;
    to: ContentStatusTransitionTarget;
    actorRole: MemberRole;
    /** RLS (KI-026 follow-up): acting user for `withCurrentUser`. */
    actingUserId: UserId;
  }): Promise<PublishingPostRecord> {
    assertActorCanChangeContentStatus(input.actorRole);

    const ids = { workspaceId: input.workspaceId, postId: input.postId };
    const existing = await this.repository.findPostStatusById(
      ids,
      input.actingUserId,
    );
    if (!existing) {
      throw new NotFoundError("Konten tidak ditemukan.");
    }
    if (!isAllowedContentStatusTransition(existing.status, input.to)) {
      throw new ConflictError(CONTENT_STATUS_TRANSITION_CONFLICT_MESSAGE);
    }

    const record = await this.repository.transitionContentStatus(
      {
        ...ids,
        from: CONTENT_STATUS_TRANSITION_SOURCE[input.to],
        to: input.to,
      },
      input.actingUserId,
    );
    if (!record) {
      throw new ConflictError(CONTENT_STATUS_TRANSITION_CONFLICT_MESSAGE);
    }
    return record;
  }
}
