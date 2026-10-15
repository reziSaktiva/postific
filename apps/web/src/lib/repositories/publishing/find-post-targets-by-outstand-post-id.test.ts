import {
  asConnectedAccountId,
  asPostId,
  asPostTargetId,
  asWorkspaceId,
} from "@postific/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();

vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
  },
}));

import { publishingRepository } from "./publishing.repository";

describe("findPostTargetsByOutstandPostId — post Imported", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("mengembalikan null kalau author_id null, supaya webhook tidak gagal", async () => {
    queryRaw.mockResolvedValueOnce([
      {
        post_id: "post-imported",
        workspace_id: "workspace-1",
        author_id: null,
        post_target_id: "target-1",
        connected_account_id: "account-1",
        outstand_account_id: "outstand-account-1",
      },
    ]);

    const result =
      await publishingRepository.findPostTargetsByOutstandPostId(
        "outstand-imported",
      );

    expect(result).toBeNull();
  });

  it("tetap mengembalikan lookup untuk post publish yang punya author", async () => {
    queryRaw.mockResolvedValueOnce([
      {
        post_id: "post-published",
        workspace_id: "workspace-1",
        author_id: "user-1",
        post_target_id: "target-1",
        connected_account_id: "account-1",
        outstand_account_id: "outstand-account-1",
      },
    ]);

    const result =
      await publishingRepository.findPostTargetsByOutstandPostId(
        "outstand-published",
      );

    expect(result).toEqual({
      postId: asPostId("post-published"),
      workspaceId: asWorkspaceId("workspace-1"),
      authorId: "user-1",
      targets: [
        {
          postTargetId: asPostTargetId("target-1"),
          connectedAccountId: asConnectedAccountId("account-1"),
          outstandAccountId: "outstand-account-1",
        },
      ],
    });
  });
});
