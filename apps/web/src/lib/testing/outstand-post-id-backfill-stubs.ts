import type { IOutstandAdapter } from "@postific/shared";
import type { IPublishingRepository } from "@/domains/publishing/repositories/publishing.repository";

/**
 * No-op stubs for the T-114 backfill surface (`IPublishingRepository.
 * hasImportedPostsMissingOutstandId`/`backfillImportedPostOutstandIds` and
 * `IOutstandAdapter.fetchAllPostIdMappings`) — for fakes in tests that don't
 * exercise backfill behavior themselves and previously copy-pasted an
 * identical literal into every `createFakeRepository`/`createFakeOutstandAdapter`
 * (code-review PR #170). Tests that actually exercise backfill (e.g.
 * `backfill-outstand-post-ids.use-case.test.ts`, `import-posts-trigger.use-case.test.ts`)
 * should keep their own bespoke implementations, not use these.
 */
export const noopBackfillRepositoryStubs: Pick<
  IPublishingRepository,
  "hasImportedPostsMissingOutstandId" | "backfillImportedPostOutstandIds"
> = {
  hasImportedPostsMissingOutstandId: async () => false,
  backfillImportedPostOutstandIds: async () => ({
    updatedCount: 0,
    skippedCount: 0,
  }),
};

export const noopFetchAllPostIdMappings: IOutstandAdapter["fetchAllPostIdMappings"] =
  async () => ({
    mappings: [],
    complete: true,
    shapeDrift: false,
  });
