import type {
  ConnectedAccountId,
  SocialPlatform,
  UserId,
  WorkspaceId,
} from "@postific/shared";
import type {
  AccountBestTimeSuggestions,
  BestTimeSlot,
} from "@/domains/analytics";

/**
 * Local ports (cross-domain, same pattern as `PostMetricsPort`): the
 * composition root passes a `BestTimeSuggestionsUseCase` (analytics public
 * API) and `WorkspaceService`; neither concrete class is imported here.
 */
interface BestTimePort {
  execute(input: {
    workspaceId: WorkspaceId;
    actingUserId: UserId;
    timezone: string;
    limitPerAccount?: number;
    now?: Date;
  }): Promise<AccountBestTimeSuggestions[]>;
}

interface ConnectedAccountsPort {
  listConnectedAccounts(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<
    {
      id: ConnectedAccountId;
      platform: SocialPlatform;
      handle: string;
      status: string;
      reconnectRequired: boolean;
    }[]
  >;
}

export interface QueueSuggestionAccount {
  connectedAccountId: ConnectedAccountId;
  platform: SocialPlatform;
  handle: string;
  slots: BestTimeSlot[];
}

export interface GetBestTimeSuggestionsInput {
  workspaceId: WorkspaceId;
  userId: UserId;
  /** Display timezone (IANA) of the Publish page. */
  timezone: string;
  /** Suggestions per account; default 3. Raise it for "show more times". */
  limitPerAccount?: number;
  now?: Date;
}

/**
 * Application Service the empty Queue calls (T-291, S-008): best-time slots
 * for the workspace's usable connected accounts. Accounts that are not active,
 * need a reconnect, or have no suggestion are left out; an empty result means
 * the Queue shows its normal empty state. Read-only: creates nothing.
 */
export class GetBestTimeSuggestionsUseCase {
  constructor(
    private readonly bestTime: BestTimePort,
    private readonly accounts: ConnectedAccountsPort,
  ) {}

  async execute(
    input: GetBestTimeSuggestionsInput,
  ): Promise<QueueSuggestionAccount[]> {
    const [suggestions, accounts] = await Promise.all([
      this.bestTime.execute({
        workspaceId: input.workspaceId,
        actingUserId: input.userId,
        timezone: input.timezone,
        limitPerAccount: input.limitPerAccount,
        now: input.now,
      }),
      this.accounts.listConnectedAccounts(input.workspaceId, input.userId),
    ]);

    const slotsByAccount = new Map(
      suggestions.map((s) => [s.connectedAccountId, s.slots]),
    );
    return accounts
      .filter((a) => a.status === "active" && !a.reconnectRequired)
      .flatMap((a) => {
        const slots = slotsByAccount.get(a.id);
        return slots && slots.length > 0
          ? [
              {
                connectedAccountId: a.id,
                platform: a.platform,
                handle: a.handle,
                slots,
              },
            ]
          : [];
      });
  }
}
