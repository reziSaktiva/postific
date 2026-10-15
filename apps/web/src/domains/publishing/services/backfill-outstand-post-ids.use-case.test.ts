import {
  asConnectedAccountId,
  asUserId,
  asWorkspaceId,
  type FetchAllPostIdMappingsResult,
} from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import { BackfillOutstandPostIdsUseCase } from "./backfill-outstand-post-ids.use-case";

const WORKSPACE_ID = asWorkspaceId("workspace-1");
const CONNECTED_ACCOUNT_ID = asConnectedAccountId("account-1");
const ACTING_USER_ID = asUserId("user-1");
const OUTSTAND_ACCOUNT_ID = "outstand-account-1";

function createFakeRepository(
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

function history(
  mappings: FetchAllPostIdMappingsResult["mappings"],
  overrides: Partial<FetchAllPostIdMappingsResult> = {},
): FetchAllPostIdMappingsResult {
  return { mappings, complete: true, shapeDrift: false, ...overrides };
}

function createFakeAdapter(
  fetchAllPostIdMappings?: () => Promise<FetchAllPostIdMappingsResult>,
) {
  return {
    fetchAllPostIdMappings: vi.fn(
      fetchAllPostIdMappings ?? (async () => history([])),
    ),
  };
}

describe("BackfillOutstandPostIdsUseCase.backfillIfNeeded (T-114)", () => {
  it("skips entirely (no Outstand call) when hasImportedPostsMissingOutstandId finds no gap", async () => {
    const repository = createFakeRepository({
      hasImportedPostsMissingOutstandId: async () => false,
    });
    const adapter = createFakeAdapter();
    const useCase = new BackfillOutstandPostIdsUseCase(
      repository as never,
      adapter as never,
    );

    const result = await useCase.backfillIfNeeded({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      actingUserId: ACTING_USER_ID,
    });

    expect(result).toEqual({ backfilled: false, updatedCount: 0 });
    expect(adapter.fetchAllPostIdMappings).not.toHaveBeenCalled();
    expect(repository.backfillImportedPostOutstandIds).not.toHaveBeenCalled();
  });

  it("fetches mappings and backfills when a gap exists, returning the updated count", async () => {
    const repository = createFakeRepository({
      hasImportedPostsMissingOutstandId: async () => true,
      backfillImportedPostOutstandIds: async () => ({ updatedCount: 36 }),
    });
    const mappings = [
      { platformPostId: "platform-1", outstandPostId: "outstand-1" },
      { platformPostId: "platform-2", outstandPostId: "outstand-2" },
    ];
    const adapter = createFakeAdapter(async () => history(mappings));
    const useCase = new BackfillOutstandPostIdsUseCase(
      repository as never,
      adapter as never,
    );

    const result = await useCase.backfillIfNeeded({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      actingUserId: ACTING_USER_ID,
    });

    expect(result).toEqual({ backfilled: true, updatedCount: 36 });
    expect(adapter.fetchAllPostIdMappings).toHaveBeenCalledWith(
      OUTSTAND_ACCOUNT_ID,
    );
    expect(repository.backfillImportedPostOutstandIds).toHaveBeenCalledWith(
      {
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        mappings,
        settleUnmatched: true,
      },
      ACTING_USER_ID,
    );
  });

  it("complete empty history settles the gap (repository called with settleUnmatched) so the next sync does not refetch", async () => {
    const repository = createFakeRepository({
      hasImportedPostsMissingOutstandId: async () => true,
      backfillImportedPostOutstandIds: async () => ({
        updatedCount: 0,
        skippedCount: 4,
      }),
    });
    const adapter = createFakeAdapter(async () => history([]));
    const useCase = new BackfillOutstandPostIdsUseCase(
      repository as never,
      adapter as never,
    );

    const result = await useCase.backfillIfNeeded({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      actingUserId: ACTING_USER_ID,
    });

    expect(result).toEqual({ backfilled: true, updatedCount: 0 });
    expect(repository.backfillImportedPostOutstandIds).toHaveBeenCalledWith(
      {
        workspaceId: WORKSPACE_ID,
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        mappings: [],
        settleUnmatched: true,
      },
      ACTING_USER_ID,
    );
  });

  it("gap exists but the history scan is unusable (shape drift) — does not call the repository, gap stays open", async () => {
    const repository = createFakeRepository({
      hasImportedPostsMissingOutstandId: async () => true,
    });
    const adapter = createFakeAdapter(async () =>
      history([], { shapeDrift: true }),
    );
    const useCase = new BackfillOutstandPostIdsUseCase(
      repository as never,
      adapter as never,
    );

    const result = await useCase.backfillIfNeeded({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: OUTSTAND_ACCOUNT_ID,
      actingUserId: ACTING_USER_ID,
    });

    expect(result).toEqual({ backfilled: false, updatedCount: 0 });
    expect(repository.backfillImportedPostOutstandIds).not.toHaveBeenCalled();
  });
});
