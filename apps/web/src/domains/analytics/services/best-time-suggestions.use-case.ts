import type { UserId, WorkspaceId } from "@postific/shared";
import { computeBestTimeSuggestions } from "../best-time";
import type { IAnalyticsRepository } from "../repositories/analytics.repository";
import {
  BEST_TIME_WINDOW_DAYS,
  type AccountBestTimeSuggestions,
} from "../types";

export interface BestTimeSuggestionsInput {
  workspaceId: WorkspaceId;
  actingUserId: UserId;
  /** Display timezone (IANA) chosen on the Publish page. */
  timezone: string;
  /** Suggestions per account; default 3. */
  limitPerAccount?: number;
  /** Test seam; defaults to the current time. */
  now?: Date;
}

/**
 * Best-time suggestions for the empty Queue (T-291, S-008). Reads stored
 * metrics only; Outstand is not called and nothing is created.
 */
export class BestTimeSuggestionsUseCase {
  constructor(private readonly repository: IAnalyticsRepository) {}

  async execute(
    input: BestTimeSuggestionsInput,
  ): Promise<AccountBestTimeSuggestions[]> {
    const now = input.now ?? new Date();
    const since = new Date(
      now.getTime() - BEST_TIME_WINDOW_DAYS * 24 * 3_600_000,
    );
    const samples = await this.repository.findBestTimeSamples(
      input.workspaceId,
      { since, until: now },
      input.actingUserId,
    );
    return computeBestTimeSuggestions({
      samples,
      timezone: input.timezone,
      now,
      limitPerAccount: input.limitPerAccount,
    });
  }
}
