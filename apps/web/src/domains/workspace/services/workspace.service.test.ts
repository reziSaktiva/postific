import {
  asConnectedAccountId,
  asInvitationId,
  asMemberId,
  asUserId,
  asWorkspaceId,
  InvitationStatus,
  MemberRole,
  MemberStatus,
  SocialPlatform,
} from "@postific/shared";
import type { IOutstandAdapter, MemberId, UserId } from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import {
  AlreadyConnectedError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/utils/errors";
import type {
  ConnectedAccountRecord,
  IWorkspaceRepository,
  WorkspaceInvitationRecord,
  WorkspaceMemberRecord,
  WorkspaceRecord,
} from "../repositories/workspace.repository";
import {
  hashInviteVerificationCode,
  WorkspaceService,
} from "./workspace.service";

const USER_ID = asUserId("user-1");
const WORKSPACE_ID = asWorkspaceId("workspace-1");

function createFakeRepository(
  overrides: Partial<IWorkspaceRepository> = {},
): IWorkspaceRepository {
  const members = new Map<string, WorkspaceMemberRecord>();
  const invitations = new Map<string, WorkspaceInvitationRecord>();
  const holder: { repo?: IWorkspaceRepository } = {};

  const repo: IWorkspaceRepository = {
    createWithOwner: async ({ name, slug }): Promise<WorkspaceRecord> => ({
      id: asWorkspaceId("workspace-1"),
      name,
      slug,
    }),
    findDefaultWorkspaceForUser: async () => null,
    listWorkspacesForUser: async () => [],
    findById: async () => null,
    listConnectedAccounts: async () => [],
    countActiveConnectedAccounts: async () => 0,
    listMembers: async () => [],
    findUsersByIds: async () => [],
    saveChannelOrder: async () => undefined,
    getChannelOrder: async () => [],
    deleteWorkspace: async () => undefined,
    setPendingOwnerTransfer: async () => undefined,
    clearPendingOwnerTransfer: async () => undefined,
    acceptOwnershipTransfer: async () => undefined,
    markAccountReconnectRequired: async () => null,
    findAccountOwnerByOutstandAccountId: async () => null,
    disconnectAccount: async () => undefined,
    findConnectedAccountById: async () => null,
    findConnectedAccountByOutstandId: async () => null,
    isConnectedAccountWithinWindow: async () => false,
    createConnectedAccount: async ({
      workspaceId,
      platform,
      outstandAccountId,
      handle,
      avatarUrl,
    }): Promise<ConnectedAccountRecord> => ({
      id: asConnectedAccountId(`conn-created-${outstandAccountId}`),
      workspaceId,
      platform,
      outstandAccountId,
      handle,
      status: "active",
      reconnectRequired: false,
      connectedAt: new Date(),
      // KI-076/ADR-120 — thread through so `createConnectedAccounts`'
      // default wrapper below (which delegates to this method) doesn't
      // silently drop avatarUrl for tests that don't override either.
      avatarUrl: avatarUrl ?? null,
      lastImportedUntil: null,
      lastImportRequestedAt: null,
    }),
    reconnectAccount: async ({
      workspaceId,
      connectedAccountId,
      outstandAccountId,
      handle,
      avatarUrl,
    }): Promise<ConnectedAccountRecord> => ({
      id: connectedAccountId,
      workspaceId,
      platform: SocialPlatform.Twitter,
      outstandAccountId,
      handle,
      status: "active",
      reconnectRequired: false,
      connectedAt: new Date(),
      avatarUrl: avatarUrl ?? null,
      lastImportedUntil: null,
      lastImportRequestedAt: null,
    }),
    renameWorkspace: async (workspaceId, name) => ({
      id: workspaceId,
      name,
      slug: "workspace-1",
    }),
    getMember: async (_workspaceId, userId) => {
      for (const member of members.values()) {
        if (member.userId === userId) {
          return member;
        }
      }
      return null;
    },
    findMemberById: async (_workspaceId, memberId) =>
      members.get(memberId) ?? null,
    removeMember: async (_workspaceId, memberId) => {
      members.delete(memberId);
    },
    updateMemberRole: async (_workspaceId, memberId, role) => {
      const existing = members.get(memberId);
      if (existing) {
        members.set(memberId, { ...existing, role });
      }
    },
    createInvitation: async (input): Promise<WorkspaceInvitationRecord> => {
      const invitation: WorkspaceInvitationRecord = {
        id: asInvitationId(`invitation-${invitations.size + 1}`),
        workspaceId: input.workspaceId,
        email: input.email,
        role: input.role,
        token: input.token,
        status: InvitationStatus.Pending,
        invitedByUserId: input.invitedByUserId,
        expiresAt: input.expiresAt,
        verificationCodeHash: null,
        verificationCodeExpiresAt: null,
        verificationAttempts: 0,
        emailVerifiedAt: null,
      };
      invitations.set(invitation.token, invitation);
      return invitation;
    },
    findInvitationByToken: async (token) => invitations.get(token) ?? null,
    setInvitationVerificationCode: async (token, { codeHash, expiresAt }) => {
      const invitation = invitations.get(token);
      if (!invitation || invitation.status !== InvitationStatus.Pending) {
        throw new ConflictError("Undangan ini sudah tidak berlaku.");
      }
      invitations.set(token, {
        ...invitation,
        verificationCodeHash: codeHash,
        verificationCodeExpiresAt: expiresAt,
        verificationAttempts: 0,
      });
    },
    markInvitationEmailVerified: async (token) => {
      const invitation = invitations.get(token);
      if (!invitation || invitation.status !== InvitationStatus.Pending) {
        throw new ConflictError("Undangan ini sudah tidak berlaku.");
      }
      invitations.set(token, {
        ...invitation,
        emailVerifiedAt: new Date(),
        verificationCodeHash: null,
        verificationCodeExpiresAt: null,
      });
    },
    incrementInvitationVerificationAttempts: async (token) => {
      const invitation = invitations.get(token);
      if (!invitation || invitation.status !== InvitationStatus.Pending) {
        throw new ConflictError("Undangan ini sudah tidak berlaku.");
      }
      const verificationAttempts = invitation.verificationAttempts + 1;
      invitations.set(token, { ...invitation, verificationAttempts });
      return verificationAttempts;
    },
    listPendingInvitations: async (workspaceId) =>
      [...invitations.values()].filter(
        (invitation) =>
          invitation.workspaceId === workspaceId &&
          invitation.status === InvitationStatus.Pending &&
          invitation.expiresAt.getTime() > Date.now(),
      ),
    revokeInvitation: async (_workspaceId, invitationId) => {
      const entry = [...invitations.entries()].find(
        ([, invitation]) => invitation.id === invitationId,
      );
      if (!entry) {
        throw new NotFoundError("Undangan tidak ditemukan.");
      }
      const [token, invitation] = entry;
      if (invitation.status !== InvitationStatus.Pending) {
        throw new ConflictError(
          "Undangan ini sudah pernah dipakai atau dibatalkan.",
        );
      }
      invitations.set(token, {
        ...invitation,
        status: InvitationStatus.Revoked,
      });
    },
    findUserByEmail: async () => null,
    acceptInvitation: async ({ workspaceId, invitationId, userId, role }) => {
      const entry = [...invitations.entries()].find(
        ([, invitation]) => invitation.id === invitationId,
      );
      if (!entry || entry[1].status !== InvitationStatus.Pending) {
        throw new ConflictError(
          "Undangan ini sudah pernah dipakai atau dibatalkan.",
        );
      }
      const [token, invitation] = entry;
      invitations.set(token, {
        ...invitation,
        status: InvitationStatus.Accepted,
      });

      const existing = [...members.values()].find(
        (candidate) =>
          candidate.workspaceId === workspaceId && candidate.userId === userId,
      );
      const newMember: WorkspaceMemberRecord = existing
        ? { ...existing, role, status: MemberStatus.Active }
        : {
            id: asMemberId(`member-${members.size + 1}`),
            workspaceId,
            userId,
            role,
            status: MemberStatus.Active,
          };
      members.set(newMember.id, newMember);
      return newMember;
    },
    updateImportWatermark: async () => undefined,
    ...overrides,
    createConnectedAccounts: async (input) => {
      const current = holder.repo;
      if (!current) {
        throw new Error("Fake repository belum siap.");
      }
      const created: ConnectedAccountRecord[] = [];
      for (const account of input.accounts) {
        try {
          created.push(
            await current.createConnectedAccount({
              workspaceId: input.workspaceId,
              actingUserId: input.actingUserId,
              platform: account.platform,
              outstandAccountId: account.outstandAccountId,
              handle: account.handle,
              avatarUrl: account.avatarUrl,
            }),
          );
        } catch (error) {
          if (error instanceof ConflictError) continue;
          throw error;
        }
      }
      return created;
    },
  };

  holder.repo = repo;
  return repo;
}

/** Helper — daftarkan member fake langsung ke Map internal via seed override. */
function seedMembers(
  seed: WorkspaceMemberRecord[],
): Partial<IWorkspaceRepository> {
  const members = new Map<string, WorkspaceMemberRecord>();
  for (const member of seed) {
    members.set(member.id, member);
  }

  return {
    getMember: async (_workspaceId, userId) => {
      for (const member of members.values()) {
        if (member.userId === userId) {
          return member;
        }
      }
      return null;
    },
    findMemberById: async (_workspaceId, memberId) =>
      members.get(memberId) ?? null,
    removeMember: async (_workspaceId, memberId) => {
      members.delete(memberId);
    },
    updateMemberRole: async (_workspaceId, memberId, role) => {
      const existing = members.get(memberId);
      if (existing) {
        members.set(memberId, { ...existing, role });
      }
    },
  };
}

function member(
  userId: UserId,
  memberId: MemberId,
  role: MemberRole,
  status: MemberStatus = MemberStatus.Active,
): WorkspaceMemberRecord {
  return { id: memberId, workspaceId: WORKSPACE_ID, userId, role, status };
}

describe("WorkspaceService.createWorkspace", () => {
  it("rejects an empty name without calling the repository", async () => {
    let calls = 0;
    const service = new WorkspaceService(
      createFakeRepository({
        createWithOwner: async (input) => {
          calls += 1;
          return { id: asWorkspaceId("x"), name: input.name, slug: input.slug };
        },
      }),
    );

    await expect(
      service.createWorkspace({ userId: USER_ID, name: "   " }),
    ).rejects.toThrow(ValidationError);
    expect(calls).toBe(0);
  });

  it("rejects a name longer than 100 characters", async () => {
    const service = new WorkspaceService(createFakeRepository());

    await expect(
      service.createWorkspace({ userId: USER_ID, name: "a".repeat(101) }),
    ).rejects.toThrow(ValidationError);
  });

  it("creates a workspace with a slug derived from the name", async () => {
    const service = new WorkspaceService(createFakeRepository());

    const workspace = await service.createWorkspace({
      userId: USER_ID,
      name: "Tim Marketing Acme",
    });

    expect(workspace.slug).toBe("tim-marketing-acme");
  });

  it("retries with a numeric suffix when the slug conflicts", async () => {
    let attempt = 0;
    const service = new WorkspaceService(
      createFakeRepository({
        createWithOwner: async ({ name, slug }) => {
          attempt += 1;
          if (attempt < 3) {
            throw new ConflictError("slug taken");
          }
          return { id: asWorkspaceId("workspace-1"), name, slug };
        },
      }),
    );

    const workspace = await service.createWorkspace({
      userId: USER_ID,
      name: "Acme",
    });

    expect(attempt).toBe(3);
    expect(workspace.slug).toBe("acme-3");
  });

  it("throws once all slug retry attempts are exhausted", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        createWithOwner: async () => {
          throw new ConflictError("slug taken");
        },
      }),
    );

    await expect(
      service.createWorkspace({ userId: USER_ID, name: "Acme" }),
    ).rejects.toThrow(ConflictError);
  });

  it("does not swallow errors unrelated to slug conflicts", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        createWithOwner: async () => {
          throw new Error("unexpected");
        },
      }),
    );

    await expect(
      service.createWorkspace({ userId: USER_ID, name: "Acme" }),
    ).rejects.toThrow("unexpected");
  });
});

describe("WorkspaceService.getWorkspaceById", () => {
  it("delegates to the repository", async () => {
    const record: WorkspaceRecord = {
      id: WORKSPACE_ID,
      name: "Acme",
      slug: "acme",
    };
    const service = new WorkspaceService(
      createFakeRepository({
        findById: async () => record,
      }),
    );

    await expect(service.getWorkspaceById(WORKSPACE_ID)).resolves.toEqual(
      record,
    );
  });

  it("returns null when no workspace matches the id", async () => {
    const service = new WorkspaceService(createFakeRepository());

    await expect(
      service.getWorkspaceById(asWorkspaceId("missing")),
    ).resolves.toBeNull();
  });
});

describe("WorkspaceService.getMembership", () => {
  it("delegates to the repository", async () => {
    const ownerId = asUserId("owner-user");
    const ownerMemberId = asMemberId("member-owner");
    const record = member(ownerId, ownerMemberId, MemberRole.Owner);
    const service = new WorkspaceService(
      createFakeRepository(seedMembers([record])),
    );

    await expect(service.getMembership(WORKSPACE_ID, ownerId)).resolves.toEqual(
      record,
    );
  });

  it("returns null when the user has no membership", async () => {
    const service = new WorkspaceService(createFakeRepository());

    await expect(
      service.getMembership(WORKSPACE_ID, asUserId("stranger-user")),
    ).resolves.toBeNull();
  });
});

describe("WorkspaceService.listConnectedAccounts", () => {
  it("delegates to the repository", async () => {
    const accounts: ConnectedAccountRecord[] = [
      {
        id: asConnectedAccountId("conn-1"),
        workspaceId: asWorkspaceId("workspace-1"),
        platform: SocialPlatform.Instagram,
        outstandAccountId: "mock-ig-001",
        handle: "@insvire.demo",
        status: "active",
        reconnectRequired: false,
        connectedAt: new Date("2026-01-01T00:00:00Z"),
        lastImportedUntil: null,
        lastImportRequestedAt: null,
      },
    ];
    const service = new WorkspaceService(
      createFakeRepository({
        listConnectedAccounts: async () => accounts,
      }),
    );

    await expect(
      service.listConnectedAccounts(asWorkspaceId("workspace-1"), USER_ID),
    ).resolves.toBe(accounts);
  });
});

describe("WorkspaceService.getConnectedAccountById", () => {
  it("delegates to the repository (code review Ridwan, T-090 — dipakai syncNowAction supaya entry point tidak akses repository langsung)", async () => {
    const account: ConnectedAccountRecord = {
      id: asConnectedAccountId("conn-1"),
      workspaceId: WORKSPACE_ID,
      platform: SocialPlatform.Instagram,
      outstandAccountId: "mock-ig-001",
      handle: "@insvire.demo",
      status: "active",
      reconnectRequired: false,
      connectedAt: new Date("2026-01-01T00:00:00Z"),
      lastImportedUntil: null,
      lastImportRequestedAt: null,
    };
    const service = new WorkspaceService(
      createFakeRepository({
        findConnectedAccountById: async () => account,
      }),
    );

    await expect(
      service.getConnectedAccountById(WORKSPACE_ID, account.id, USER_ID),
    ).resolves.toBe(account);
  });

  it("returns null when the repository finds no matching account", async () => {
    const service = new WorkspaceService(
      createFakeRepository({ findConnectedAccountById: async () => null }),
    );

    await expect(
      service.getConnectedAccountById(
        WORKSPACE_ID,
        asConnectedAccountId("conn-missing"),
        USER_ID,
      ),
    ).resolves.toBeNull();
  });
});

describe("WorkspaceService.countActiveConnectedAccounts", () => {
  it("delegates to the repository's count-only query (T-042.2)", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        countActiveConnectedAccounts: async () => 2,
      }),
    );

    await expect(
      service.countActiveConnectedAccounts(
        asWorkspaceId("workspace-1"),
        USER_ID,
      ),
    ).resolves.toBe(2);
  });

  it("returns 0 when the repository reports no active accounts", async () => {
    const service = new WorkspaceService(
      createFakeRepository({ countActiveConnectedAccounts: async () => 0 }),
    );

    await expect(
      service.countActiveConnectedAccounts(
        asWorkspaceId("workspace-1"),
        USER_ID,
      ),
    ).resolves.toBe(0);
  });
});

describe("WorkspaceService.listMembersWithUser", () => {
  it("joins member records with user name/email", async () => {
    const ownerId = asUserId("owner-user");
    const adminId = asUserId("admin-user");
    const ownerMemberId = asMemberId("member-owner");
    const adminMemberId = asMemberId("member-admin");

    const service = new WorkspaceService(
      createFakeRepository({
        listMembers: async () => [
          member(ownerId, ownerMemberId, MemberRole.Owner),
          member(adminId, adminMemberId, MemberRole.Admin),
        ],
        findUsersByIds: async () => [
          { id: ownerId, name: "Raka", email: "raka@example.com" },
          { id: adminId, name: "Maya", email: "maya@example.com" },
        ],
      }),
    );

    const result = await service.listMembersWithUser(WORKSPACE_ID, USER_ID);

    expect(result).toEqual([
      {
        id: ownerMemberId,
        userId: ownerId,
        name: "Raka",
        email: "raka@example.com",
        role: MemberRole.Owner,
        status: MemberStatus.Active,
      },
      {
        id: adminMemberId,
        userId: adminId,
        name: "Maya",
        email: "maya@example.com",
        role: MemberRole.Admin,
        status: MemberStatus.Active,
      },
    ]);
  });

  it("silently skips members whose user record is missing", async () => {
    const ownerId = asUserId("owner-user");
    const orphanUserId = asUserId("orphan-user");
    const ownerMemberId = asMemberId("member-owner");
    const orphanMemberId = asMemberId("member-orphan");

    const service = new WorkspaceService(
      createFakeRepository({
        listMembers: async () => [
          member(ownerId, ownerMemberId, MemberRole.Owner),
          member(orphanUserId, orphanMemberId, MemberRole.Creator),
        ],
        findUsersByIds: async () => [
          { id: ownerId, name: "Raka", email: "raka@example.com" },
        ],
      }),
    );

    const result = await service.listMembersWithUser(WORKSPACE_ID, USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(ownerMemberId);
  });
});

describe("WorkspaceService.removeMember", () => {
  const OWNER_USER = asUserId("owner-user");
  const ADMIN_USER = asUserId("admin-user");
  const CREATOR_USER = asUserId("creator-user");

  const OWNER_MEMBER_ID = asMemberId("member-owner");
  const ADMIN_MEMBER_ID = asMemberId("member-admin");
  const CREATOR_MEMBER_ID = asMemberId("member-creator");

  function baseSeed(): WorkspaceMemberRecord[] {
    return [
      member(OWNER_USER, OWNER_MEMBER_ID, MemberRole.Owner),
      member(ADMIN_USER, ADMIN_MEMBER_ID, MemberRole.Admin),
      member(CREATOR_USER, CREATOR_MEMBER_ID, MemberRole.Creator),
    ];
  }

  it("allows Owner to remove an Admin or Creator member", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await service.removeMember(WORKSPACE_ID, OWNER_USER, CREATOR_MEMBER_ID);

    await expect(
      service.removeMember(WORKSPACE_ID, OWNER_USER, CREATOR_MEMBER_ID),
    ).rejects.toThrow(NotFoundError);
  });

  it("allows Admin to remove a Creator member", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.removeMember(WORKSPACE_ID, ADMIN_USER, CREATOR_MEMBER_ID),
    ).resolves.toBeUndefined();
  });

  it("rejects Admin trying to remove the Owner", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.removeMember(WORKSPACE_ID, ADMIN_USER, OWNER_MEMBER_ID),
    ).rejects.toThrow(AuthorizationError);
  });

  it("rejects Creator as actor even against a valid target", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.removeMember(WORKSPACE_ID, CREATOR_USER, ADMIN_MEMBER_ID),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws NotFoundError when the target member id does not exist", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.removeMember(WORKSPACE_ID, OWNER_USER, asMemberId("missing")),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when the actor is not an active member", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.removeMember(
        WORKSPACE_ID,
        asUserId("stranger-user"),
        CREATOR_MEMBER_ID,
      ),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws AuthorizationError when the actor's membership is not Active", async () => {
    const seed = baseSeed();
    seed.push(
      member(
        asUserId("pending-user"),
        asMemberId("member-pending"),
        MemberRole.Admin,
        MemberStatus.Pending,
      ),
    );
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(seed)),
    );

    await expect(
      service.removeMember(
        WORKSPACE_ID,
        asUserId("pending-user"),
        CREATOR_MEMBER_ID,
      ),
    ).rejects.toThrow(AuthorizationError);
  });
});

describe("WorkspaceService.disconnectAccount", () => {
  const OWNER_USER = asUserId("da-owner-user");
  const ADMIN_USER = asUserId("da-admin-user");
  const CREATOR_USER = asUserId("da-creator-user");

  const OWNER_MEMBER_ID = asMemberId("da-member-owner");
  const ADMIN_MEMBER_ID = asMemberId("da-member-admin");
  const CREATOR_MEMBER_ID = asMemberId("da-member-creator");

  const CONNECTED_ACCOUNT_ID = asConnectedAccountId("conn-1");

  function baseSeed(): WorkspaceMemberRecord[] {
    return [
      member(OWNER_USER, OWNER_MEMBER_ID, MemberRole.Owner),
      member(ADMIN_USER, ADMIN_MEMBER_ID, MemberRole.Admin),
      member(CREATOR_USER, CREATOR_MEMBER_ID, MemberRole.Creator),
    ];
  }

  it("allows Owner to disconnect an account", async () => {
    const disconnectAccount = vi.fn(async () => undefined);
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        disconnectAccount,
      }),
    );

    await expect(
      service.disconnectAccount(WORKSPACE_ID, OWNER_USER, CONNECTED_ACCOUNT_ID),
    ).resolves.toBeUndefined();
    expect(disconnectAccount).toHaveBeenCalledWith(
      WORKSPACE_ID,
      CONNECTED_ACCOUNT_ID,
      OWNER_USER,
    );
  });

  it("allows Admin to disconnect an account", async () => {
    const disconnectAccount = vi.fn(async () => undefined);
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        disconnectAccount,
      }),
    );

    await expect(
      service.disconnectAccount(WORKSPACE_ID, ADMIN_USER, CONNECTED_ACCOUNT_ID),
    ).resolves.toBeUndefined();
    expect(disconnectAccount).toHaveBeenCalledOnce();
  });

  it("rejects Creator as actor", async () => {
    const disconnectAccount = vi.fn(async () => undefined);
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        disconnectAccount,
      }),
    );

    await expect(
      service.disconnectAccount(
        WORKSPACE_ID,
        CREATOR_USER,
        CONNECTED_ACCOUNT_ID,
      ),
    ).rejects.toThrow(AuthorizationError);
    expect(disconnectAccount).not.toHaveBeenCalled();
  });

  it("throws AuthorizationError when the actor is not an active member", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.disconnectAccount(
        WORKSPACE_ID,
        asUserId("da-stranger-user"),
        CONNECTED_ACCOUNT_ID,
      ),
    ).rejects.toThrow(AuthorizationError);
  });

  it("propagates NotFoundError from the repository when the account doesn't exist", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        disconnectAccount: async () => {
          throw new NotFoundError("Akun terhubung tidak ditemukan.");
        },
      }),
    );

    await expect(
      service.disconnectAccount(
        WORKSPACE_ID,
        OWNER_USER,
        asConnectedAccountId("missing"),
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("propagates ConflictError from the repository when the account is already disconnected", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        disconnectAccount: async () => {
          throw new ConflictError("Akun ini sudah terputus.");
        },
      }),
    );

    await expect(
      service.disconnectAccount(WORKSPACE_ID, OWNER_USER, CONNECTED_ACCOUNT_ID),
    ).rejects.toThrow(ConflictError);
  });
});

/** Fake `IOutstandAdapter` minimal — hanya `connectAccount`/`resolveConnectCallback`/`listPendingFacebookPages`/`confirmFacebookPagesConnection`/`listPinterestBoards` dipakai test-test terkait Connect Account/Facebook Pages/Pinterest boards di file ini, method lain sengaja tidak dipanggil (mock, bukan dipakai). */
function fakeOutstandAdapter(
  overrides: Partial<IOutstandAdapter> = {},
): IOutstandAdapter {
  return {
    connectAccount: async () => ({
      redirectUrl:
        "/api/integrations/outstand/callback?account_id=fake&username=fake&state=fake",
    }),
    resolveConnectCallback: async () => ({
      outstandAccountId: "outstand-account-1",
      platform: SocialPlatform.Twitter,
      handle: "@fake",
      status: "active",
    }),
    listPendingFacebookPages: async () => ({
      pages: [
        { pageId: "fb-page-1", name: "Fake Page 1" },
        { pageId: "fb-page-2", name: "Fake Page 2" },
      ],
    }),
    confirmFacebookPagesConnection: async () => ({
      accounts: [
        {
          outstandAccountId: "fb-page-1",
          platform: SocialPlatform.Facebook,
          handle: "Fake Page 1",
          status: "active",
        },
      ],
    }),
    listPinterestBoards: async () => [
      { id: "fake-board-1", name: "Fake Board 1" },
    ],
    uploadMediaWorkingCopy: async () => ({
      outstandMediaId: "unused",
      outstandMediaUrl: "https://fake.outstand.local/media/unused",
      expiresAt: new Date(),
    }),
    schedulePost: async () => ({ outstandPostId: "unused" }),
    publishNow: async () => ({ outstandPostId: "unused" }),
    fetchPostOutcome: async () => [],
    cancelScheduledPost: async () => undefined,
    deletePost: async () => undefined,
    fetchPostMetrics: async () => ({
      impressions: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: null,
      engagementRate: 0,
    }),
    fetchWorkspaceMetrics: async () => ({
      totalPosts: 0,
      totalReach: 0,
      totalEngagements: 0,
      avgEngagementRate: 0,
    }),
    fetchComments: async () => ({ comments: [], nextCursor: null }),
    replyToComment: async () => ({ outstandReplyId: "fake-reply" }),
    importPosts: async () => ({ importJobId: "fake-import-job" }),
    fetchImportJobStatus: async () => ({
      status: "completed" as const,
      posts: [],
      error: null,
    }),
    ...overrides,
  };
}

describe("WorkspaceService.initiateConnectAccount", () => {
  const OWNER_USER = asUserId("ica-owner-user");
  const ADMIN_USER = asUserId("ica-admin-user");
  const CREATOR_USER = asUserId("ica-creator-user");

  const OWNER_MEMBER_ID = asMemberId("ica-member-owner");
  const ADMIN_MEMBER_ID = asMemberId("ica-member-admin");
  const CREATOR_MEMBER_ID = asMemberId("ica-member-creator");

  const CONNECTED_ACCOUNT_ID = asConnectedAccountId("ica-conn-1");

  function baseSeed(): WorkspaceMemberRecord[] {
    return [
      member(OWNER_USER, OWNER_MEMBER_ID, MemberRole.Owner),
      member(ADMIN_USER, ADMIN_MEMBER_ID, MemberRole.Admin),
      member(CREATOR_USER, CREATOR_MEMBER_ID, MemberRole.Creator),
    ];
  }

  function existingAccount(
    overrides: Partial<ConnectedAccountRecord> = {},
  ): ConnectedAccountRecord {
    return {
      id: CONNECTED_ACCOUNT_ID,
      workspaceId: WORKSPACE_ID,
      platform: SocialPlatform.Twitter,
      outstandAccountId: "outstand-account-old",
      handle: "@old",
      status: "active",
      reconnectRequired: true,
      connectedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastImportedUntil: null,
      lastImportRequestedAt: null,
      ...overrides,
    };
  }

  it("returns redirectUrl for Owner connecting a new platform", async () => {
    const connectAccount = vi.fn(fakeOutstandAdapter().connectAccount);
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
      undefined,
      undefined,
      fakeOutstandAdapter({ connectAccount }),
    );

    const result = await service.initiateConnectAccount({
      workspaceId: WORKSPACE_ID,
      actorId: OWNER_USER,
      platform: SocialPlatform.Twitter,
    });

    expect(result.redirectUrl).toContain("/api/integrations/outstand/callback");
    expect(connectAccount).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      platform: SocialPlatform.Twitter,
      redirectAccountId: undefined,
    });
  });

  it("allows Admin to initiate connect", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
      undefined,
      undefined,
      fakeOutstandAdapter(),
    );

    await expect(
      service.initiateConnectAccount({
        workspaceId: WORKSPACE_ID,
        actorId: ADMIN_USER,
        platform: SocialPlatform.Twitter,
      }),
    ).resolves.toHaveProperty("redirectUrl");
  });

  it("rejects Creator as actor", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
      undefined,
      undefined,
      fakeOutstandAdapter(),
    );

    await expect(
      service.initiateConnectAccount({
        workspaceId: WORKSPACE_ID,
        actorId: CREATOR_USER,
        platform: SocialPlatform.Twitter,
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("validates redirectAccountId belongs to the workspace before requesting a reconnect redirect", async () => {
    const connectAccount = vi.fn(fakeOutstandAdapter().connectAccount);
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        findConnectedAccountById: async () => existingAccount(),
      }),
      undefined,
      undefined,
      fakeOutstandAdapter({ connectAccount }),
    );

    await service.initiateConnectAccount({
      workspaceId: WORKSPACE_ID,
      actorId: OWNER_USER,
      platform: SocialPlatform.Twitter,
      redirectAccountId: CONNECTED_ACCOUNT_ID,
    });

    expect(connectAccount).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      platform: SocialPlatform.Twitter,
      redirectAccountId: CONNECTED_ACCOUNT_ID,
    });
  });

  it("throws NotFoundError when redirectAccountId doesn't belong to the workspace", async () => {
    const connectAccount = vi.fn(fakeOutstandAdapter().connectAccount);
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        findConnectedAccountById: async () => null,
      }),
      undefined,
      undefined,
      fakeOutstandAdapter({ connectAccount }),
    );

    await expect(
      service.initiateConnectAccount({
        workspaceId: WORKSPACE_ID,
        actorId: OWNER_USER,
        platform: SocialPlatform.Twitter,
        redirectAccountId: CONNECTED_ACCOUNT_ID,
      }),
    ).rejects.toThrow(NotFoundError);
    expect(connectAccount).not.toHaveBeenCalled();
  });

  it("throws ValidationError when platform doesn't match the existing account being reconnected", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        findConnectedAccountById: async () =>
          existingAccount({ platform: SocialPlatform.Instagram }),
      }),
      undefined,
      undefined,
      fakeOutstandAdapter(),
    );

    await expect(
      service.initiateConnectAccount({
        workspaceId: WORKSPACE_ID,
        actorId: OWNER_USER,
        platform: SocialPlatform.Twitter,
        redirectAccountId: CONNECTED_ACCOUNT_ID,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("throws when no IOutstandAdapter is supplied to the constructor", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.initiateConnectAccount({
        workspaceId: WORKSPACE_ID,
        actorId: OWNER_USER,
        platform: SocialPlatform.Twitter,
      }),
    ).rejects.toThrow(/IOutstandAdapter tidak disuplai/);
  });
});

describe("WorkspaceService.completeAccountConnection", () => {
  const OWNER_USER = asUserId("cac-owner-user");
  const CREATOR_USER = asUserId("cac-creator-user");

  const OWNER_MEMBER_ID = asMemberId("cac-member-owner");
  const CREATOR_MEMBER_ID = asMemberId("cac-member-creator");

  const CONNECTED_ACCOUNT_ID = asConnectedAccountId("cac-conn-1");

  function baseSeed(): WorkspaceMemberRecord[] {
    return [
      member(OWNER_USER, OWNER_MEMBER_ID, MemberRole.Owner),
      member(CREATOR_USER, CREATOR_MEMBER_ID, MemberRole.Creator),
    ];
  }

  function existingAccount(): ConnectedAccountRecord {
    return {
      id: CONNECTED_ACCOUNT_ID,
      workspaceId: WORKSPACE_ID,
      platform: SocialPlatform.Twitter,
      outstandAccountId: "outstand-account-old",
      handle: "@old",
      status: "active",
      reconnectRequired: true,
      connectedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastImportedUntil: null,
      lastImportRequestedAt: null,
    };
  }

  it("creates a new ConnectedAccount when redirectAccountId is absent", async () => {
    const createConnectedAccount = vi.fn(
      async (input: {
        workspaceId: typeof WORKSPACE_ID;
        platform: (typeof SocialPlatform)["Twitter"];
        outstandAccountId: string;
        handle: string;
        actingUserId: typeof OWNER_USER;
      }): Promise<ConnectedAccountRecord> => ({
        id: asConnectedAccountId("cac-conn-new"),
        workspaceId: input.workspaceId,
        platform: input.platform,
        outstandAccountId: input.outstandAccountId,
        handle: input.handle,
        status: "active",
        reconnectRequired: false,
        connectedAt: new Date(),
        lastImportedUntil: null,
        lastImportRequestedAt: null,
      }),
    );
    const reconnectAccount = vi.fn();
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        createConnectedAccount,
        reconnectAccount,
      }),
      undefined,
      undefined,
      fakeOutstandAdapter(),
    );

    const result = await service.completeAccountConnection({
      workspaceId: WORKSPACE_ID,
      actorId: OWNER_USER,
      accountId: "fake-account-id",
      username: "fake-username",
      state: "fake-state",
    });

    expect(result.status).toBe("active");
    expect(createConnectedAccount).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      platform: SocialPlatform.Twitter,
      outstandAccountId: "outstand-account-1",
      handle: "@fake",
      actingUserId: OWNER_USER,
    });
    expect(reconnectAccount).not.toHaveBeenCalled();
  });

  it("KI-079: recovers (returns existing row) when the conflicting account was just created — genuine double-submit", async () => {
    const conflictingRow: ConnectedAccountRecord = {
      ...existingAccount(),
      id: asConnectedAccountId("cac-conn-recent"),
      outstandAccountId: "outstand-account-1",
      handle: "@fake",
      status: "active",
      reconnectRequired: false,
      connectedAt: new Date(Date.now() - 2_000),
    };
    const createConnectedAccount = vi.fn(async () => {
      throw new ConflictError("Akun ini sudah terhubung di workspace ini.");
    });
    const findConnectedAccountByOutstandId = vi.fn(async () => conflictingRow);
    // Code review PR #139 (Opsi B) — window check dihitung di sisi
    // repository (Postgres `now()`), bukan lagi dari `connectedAt` yang
    // dibandingkan `Date.now()` di service. Fake ini mensimulasikan baris
    // yang MASIH di dalam window (`true`), simulasi request susulan yang
    // aman dari double-submit genuine.
    const isConnectedAccountWithinWindow = vi.fn(async () => true);
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        createConnectedAccount,
        findConnectedAccountByOutstandId,
        isConnectedAccountWithinWindow,
      }),
      undefined,
      undefined,
      fakeOutstandAdapter(),
    );

    const result = await service.completeAccountConnection({
      workspaceId: WORKSPACE_ID,
      actorId: OWNER_USER,
      accountId: "fake-account-id",
      username: "fake-username",
      state: "fake-state",
    });

    expect(result).toEqual(conflictingRow);
    expect(findConnectedAccountByOutstandId).toHaveBeenCalledWith(
      WORKSPACE_ID,
      "outstand-account-1",
      OWNER_USER,
    );
    expect(isConnectedAccountWithinWindow).toHaveBeenCalledWith(
      conflictingRow.id,
      expect.any(Number),
      OWNER_USER,
    );
  });

  it("KI-079: throws AlreadyConnectedError when the conflicting account is not recent — separate connect attempt", async () => {
    const conflictingRow: ConnectedAccountRecord = {
      ...existingAccount(),
      id: asConnectedAccountId("cac-conn-old"),
      outstandAccountId: "outstand-account-1",
      handle: "@fake",
      status: "active",
      reconnectRequired: false,
      connectedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const createConnectedAccount = vi.fn(async () => {
      throw new ConflictError("Akun ini sudah terhubung di workspace ini.");
    });
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        createConnectedAccount,
        findConnectedAccountByOutstandId: async () => conflictingRow,
        // Baris di luar window (code review PR #139 — Opsi B: keputusan ini
        // sekarang datang dari repository, bukan dihitung dari `connectedAt`
        // di sini).
        isConnectedAccountWithinWindow: async () => false,
      }),
      undefined,
      undefined,
      fakeOutstandAdapter(),
    );

    await expect(
      service.completeAccountConnection({
        workspaceId: WORKSPACE_ID,
        actorId: OWNER_USER,
        accountId: "fake-account-id",
        username: "fake-username",
        state: "fake-state",
      }),
    ).rejects.toBeInstanceOf(AlreadyConnectedError);
  });

  it("KI-079 (code review PR #139): throws AlreadyConnectedError when the conflicting row is within window but no longer active (disconnected/reconnect-required)", async () => {
    const conflictingRow: ConnectedAccountRecord = {
      ...existingAccount(),
      id: asConnectedAccountId("cac-conn-disconnected"),
      outstandAccountId: "outstand-account-1",
      handle: "@fake",
      status: "disconnected",
      reconnectRequired: false,
      connectedAt: new Date(Date.now() - 2_000),
    };
    const createConnectedAccount = vi.fn(async () => {
      throw new ConflictError("Akun ini sudah terhubung di workspace ini.");
    });
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        createConnectedAccount,
        findConnectedAccountByOutstandId: async () => conflictingRow,
        isConnectedAccountWithinWindow: async () => true,
      }),
      undefined,
      undefined,
      fakeOutstandAdapter(),
    );

    await expect(
      service.completeAccountConnection({
        workspaceId: WORKSPACE_ID,
        actorId: OWNER_USER,
        accountId: "fake-account-id",
        username: "fake-username",
        state: "fake-state",
      }),
    ).rejects.toBeInstanceOf(AlreadyConnectedError);
  });

  it("updates the existing ConnectedAccount (preserving connectedAt) when redirectAccountId is present", async () => {
    const createConnectedAccount = vi.fn();
    const reconnectAccount = vi.fn(async () => ({
      ...existingAccount(),
      outstandAccountId: "outstand-account-1",
      handle: "@fake",
      status: "active",
      reconnectRequired: false,
    }));
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        findConnectedAccountById: async () => existingAccount(),
        createConnectedAccount,
        reconnectAccount,
      }),
      undefined,
      undefined,
      fakeOutstandAdapter(),
    );

    const result = await service.completeAccountConnection({
      workspaceId: WORKSPACE_ID,
      actorId: OWNER_USER,
      accountId: "fake-account-id",
      username: "fake-username",
      state: "fake-state",
      redirectAccountId: CONNECTED_ACCOUNT_ID,
    });

    expect(result.reconnectRequired).toBe(false);
    expect(result.connectedAt).toEqual(existingAccount().connectedAt);
    expect(reconnectAccount).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: "outstand-account-1",
      handle: "@fake",
      actingUserId: OWNER_USER,
    });
    expect(createConnectedAccount).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when redirectAccountId doesn't belong to the workspace (IDOR defense-in-depth)", async () => {
    const reconnectAccount = vi.fn();
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        findConnectedAccountById: async () => null,
        reconnectAccount,
      }),
      undefined,
      undefined,
      fakeOutstandAdapter(),
    );

    await expect(
      service.completeAccountConnection({
        workspaceId: WORKSPACE_ID,
        actorId: OWNER_USER,
        accountId: "fake-account-id",
        username: "fake-username",
        state: "fake-state",
        redirectAccountId: CONNECTED_ACCOUNT_ID,
      }),
    ).rejects.toThrow(NotFoundError);
    expect(reconnectAccount).not.toHaveBeenCalled();
  });

  it("throws ValidationError when the exchanged platform doesn't match the existing account being reconnected", async () => {
    // existingAccount() punya platform Twitter; `state` (yang membawa
    // `platform` klaim) hanya dilindungi lewat pencocokan nonce, bukan
    // tanda tangan penuh atas seluruh payload — jadi platform di dalamnya
    // secara teori bisa ditamper sebelum callback ini dieksekusi. Guard ini
    // menyamakan defense-in-depth yang sudah ada di `initiateConnectAccount`
    // (temuan review Ridwan).
    const reconnectAccount = vi.fn();
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        findConnectedAccountById: async () => existingAccount(),
        reconnectAccount,
      }),
      undefined,
      undefined,
      fakeOutstandAdapter({
        resolveConnectCallback: async () => ({
          outstandAccountId: "outstand-account-1",
          platform: SocialPlatform.Instagram,
          handle: "@fake",
          status: "active",
        }),
      }),
    );

    await expect(
      service.completeAccountConnection({
        workspaceId: WORKSPACE_ID,
        actorId: OWNER_USER,
        accountId: "fake-account-id",
        username: "fake-username",
        state: "fake-state",
        redirectAccountId: CONNECTED_ACCOUNT_ID,
      }),
    ).rejects.toThrow(ValidationError);
    expect(reconnectAccount).not.toHaveBeenCalled();
  });

  it("rejects Creator as actor", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
      undefined,
      undefined,
      fakeOutstandAdapter(),
    );

    await expect(
      service.completeAccountConnection({
        workspaceId: WORKSPACE_ID,
        actorId: CREATOR_USER,
        accountId: "fake-account-id",
        username: "fake-username",
        state: "fake-state",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  // KI-076/ADR-120 — `resolveConnectCallback().avatarUrl` harus mengalir
  // sampai `IWorkspaceRepository.createConnectedAccount`/`reconnectAccount`,
  // bukan cuma ditambahkan ke tipe tanpa pernah benar-benar diisi.
  it("forwards avatarUrl from resolveConnectCallback to createConnectedAccount (KI-076)", async () => {
    const createConnectedAccount = vi.fn(
      async (input: {
        workspaceId: typeof WORKSPACE_ID;
        platform: (typeof SocialPlatform)["Twitter"];
        outstandAccountId: string;
        handle: string;
        avatarUrl?: string | null;
        actingUserId: typeof OWNER_USER;
      }): Promise<ConnectedAccountRecord> => ({
        id: asConnectedAccountId("cac-conn-new"),
        workspaceId: input.workspaceId,
        platform: input.platform,
        outstandAccountId: input.outstandAccountId,
        handle: input.handle,
        status: "active",
        reconnectRequired: false,
        connectedAt: new Date(),
        avatarUrl: input.avatarUrl ?? null,
        lastImportedUntil: null,
        lastImportRequestedAt: null,
      }),
    );
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        createConnectedAccount,
      }),
      undefined,
      undefined,
      fakeOutstandAdapter({
        resolveConnectCallback: async () => ({
          outstandAccountId: "outstand-account-1",
          platform: SocialPlatform.Twitter,
          handle: "@fake",
          status: "active",
          avatarUrl: "https://cdn.example.com/ig-avatar.jpg",
        }),
      }),
    );

    await service.completeAccountConnection({
      workspaceId: WORKSPACE_ID,
      actorId: OWNER_USER,
      accountId: "fake-account-id",
      username: "fake-username",
      state: "fake-state",
    });

    expect(createConnectedAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        avatarUrl: "https://cdn.example.com/ig-avatar.jpg",
      }),
    );
  });

  it("forwards avatarUrl from resolveConnectCallback to reconnectAccount (KI-076)", async () => {
    const reconnectAccount = vi.fn(async () => ({
      ...existingAccount(),
      outstandAccountId: "outstand-account-1",
      handle: "@fake",
      status: "active",
      reconnectRequired: false,
      avatarUrl: "https://cdn.example.com/ig-avatar.jpg",
    }));
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        findConnectedAccountById: async () => existingAccount(),
        reconnectAccount,
      }),
      undefined,
      undefined,
      fakeOutstandAdapter({
        resolveConnectCallback: async () => ({
          outstandAccountId: "outstand-account-1",
          platform: SocialPlatform.Twitter,
          handle: "@fake",
          status: "active",
          avatarUrl: "https://cdn.example.com/ig-avatar.jpg",
        }),
      }),
    );

    await service.completeAccountConnection({
      workspaceId: WORKSPACE_ID,
      actorId: OWNER_USER,
      accountId: "fake-account-id",
      username: "fake-username",
      state: "fake-state",
      redirectAccountId: CONNECTED_ACCOUNT_ID,
    });

    expect(reconnectAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        avatarUrl: "https://cdn.example.com/ig-avatar.jpg",
      }),
    );
  });

  // Temuan #1 (review Ridwan Architecture Reviewer, T-051) — seeding JOB-03
  // pertama lewat `EngagementSyncSeederPort` (parameter ke-5).
  it("calls engagementSyncSeeder.onAccountConnected after creating a new ConnectedAccount", async () => {
    const onAccountConnected = vi.fn(async () => undefined);
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        createConnectedAccount: async (input) => ({
          id: asConnectedAccountId("cac-conn-new"),
          workspaceId: input.workspaceId,
          platform: input.platform,
          outstandAccountId: input.outstandAccountId,
          handle: input.handle,
          status: "active",
          reconnectRequired: false,
          connectedAt: new Date(),
          lastImportedUntil: null,
          lastImportRequestedAt: null,
        }),
      }),
      undefined,
      undefined,
      fakeOutstandAdapter(),
      { onAccountConnected },
    );

    await service.completeAccountConnection({
      workspaceId: WORKSPACE_ID,
      actorId: OWNER_USER,
      accountId: "fake-account-id",
      username: "fake-username",
      state: "fake-state",
    });

    expect(onAccountConnected).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: asConnectedAccountId("cac-conn-new"),
      outstandAccountId: "outstand-account-1",
    });
  });

  it("calls engagementSyncSeeder.onAccountConnected after reconnecting an existing ConnectedAccount", async () => {
    const onAccountConnected = vi.fn(async () => undefined);
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        findConnectedAccountById: async () => existingAccount(),
        reconnectAccount: async () => ({
          ...existingAccount(),
          outstandAccountId: "outstand-account-1",
          handle: "@fake",
          status: "active",
          reconnectRequired: false,
        }),
      }),
      undefined,
      undefined,
      fakeOutstandAdapter(),
      { onAccountConnected },
    );

    await service.completeAccountConnection({
      workspaceId: WORKSPACE_ID,
      actorId: OWNER_USER,
      accountId: "fake-account-id",
      username: "fake-username",
      state: "fake-state",
      redirectAccountId: CONNECTED_ACCOUNT_ID,
    });

    expect(onAccountConnected).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: CONNECTED_ACCOUNT_ID,
      outstandAccountId: "outstand-account-1",
    });
  });

  it("does not throw when engagementSyncSeeder is not supplied (optional port)", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        createConnectedAccount: async (input) => ({
          id: asConnectedAccountId("cac-conn-new"),
          workspaceId: input.workspaceId,
          platform: input.platform,
          outstandAccountId: input.outstandAccountId,
          handle: input.handle,
          status: "active",
          reconnectRequired: false,
          connectedAt: new Date(),
          lastImportedUntil: null,
          lastImportRequestedAt: null,
        }),
      }),
      undefined,
      undefined,
      fakeOutstandAdapter(),
    );

    await expect(
      service.completeAccountConnection({
        workspaceId: WORKSPACE_ID,
        actorId: OWNER_USER,
        accountId: "fake-account-id",
        username: "fake-username",
        state: "fake-state",
      }),
    ).resolves.toBeDefined();
  });
});

describe("WorkspaceService.listFacebookPendingPages (T-025.4, ADR-115)", () => {
  const OWNER_USER = asUserId("lfp-owner-user");
  const CREATOR_USER = asUserId("lfp-creator-user");

  const OWNER_MEMBER_ID = asMemberId("lfp-member-owner");
  const CREATOR_MEMBER_ID = asMemberId("lfp-member-creator");

  function baseSeed(): WorkspaceMemberRecord[] {
    return [
      member(OWNER_USER, OWNER_MEMBER_ID, MemberRole.Owner),
      member(CREATOR_USER, CREATOR_MEMBER_ID, MemberRole.Creator),
    ];
  }

  it("delegates to IOutstandAdapter.listPendingFacebookPages and returns its pages", async () => {
    const listPendingFacebookPages = vi.fn(async () => ({
      pages: [{ pageId: "fb-page-1", name: "Kopi Selasar" }],
    }));
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
      undefined,
      undefined,
      fakeOutstandAdapter({ listPendingFacebookPages }),
    );

    const pages = await service.listFacebookPendingPages({
      workspaceId: WORKSPACE_ID,
      actorId: OWNER_USER,
      sessionToken: "session-token-1",
    });

    expect(listPendingFacebookPages).toHaveBeenCalledWith({
      sessionToken: "session-token-1",
    });
    expect(pages).toEqual([{ pageId: "fb-page-1", name: "Kopi Selasar" }]);
  });

  it("rejects Creator as actor", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
      undefined,
      undefined,
      fakeOutstandAdapter(),
    );

    await expect(
      service.listFacebookPendingPages({
        workspaceId: WORKSPACE_ID,
        actorId: CREATOR_USER,
        sessionToken: "session-token-1",
      }),
    ).rejects.toThrow(AuthorizationError);
  });
});

describe("WorkspaceService.listPinterestBoards (menutup KI-072, sisa scope ADR-114)", () => {
  const OWNER_USER = asUserId("lpb-owner-user");
  const OTHER_USER = asUserId("lpb-other-user");
  const OWNER_MEMBER_ID = asMemberId("lpb-member-owner");
  const PINTEREST_CONNECTED_ACCOUNT_ID = asConnectedAccountId("lpb-conn-pin-1");
  const TWITTER_CONNECTED_ACCOUNT_ID = asConnectedAccountId("lpb-conn-tw-1");

  function baseSeed(): WorkspaceMemberRecord[] {
    return [member(OWNER_USER, OWNER_MEMBER_ID, MemberRole.Owner)];
  }

  function pinterestAccount(): ConnectedAccountRecord {
    return {
      id: PINTEREST_CONNECTED_ACCOUNT_ID,
      workspaceId: WORKSPACE_ID,
      platform: SocialPlatform.Pinterest,
      outstandAccountId: "outstand-account-pinterest-1",
      handle: "@dapurselasar",
      status: "active",
      reconnectRequired: false,
      connectedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastImportedUntil: null,
      lastImportRequestedAt: null,
    };
  }

  function twitterAccount(): ConnectedAccountRecord {
    return {
      id: TWITTER_CONNECTED_ACCOUNT_ID,
      workspaceId: WORKSPACE_ID,
      platform: SocialPlatform.Twitter,
      outstandAccountId: "outstand-account-twitter-1",
      handle: "@selasar",
      status: "active",
      reconnectRequired: false,
      connectedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastImportedUntil: null,
      lastImportRequestedAt: null,
    };
  }

  it("delegates to IOutstandAdapter.listPinterestBoards using the resolved outstandAccountId", async () => {
    const listPinterestBoards = vi.fn(async () => [
      { id: "board-1", name: "Resep & Minuman" },
    ]);
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        listConnectedAccounts: async () => [
          pinterestAccount(),
          twitterAccount(),
        ],
      }),
      undefined,
      undefined,
      fakeOutstandAdapter({ listPinterestBoards }),
    );

    const boards = await service.listPinterestBoards({
      workspaceId: WORKSPACE_ID,
      actorId: OWNER_USER,
      connectedAccountId: PINTEREST_CONNECTED_ACCOUNT_ID,
    });

    expect(listPinterestBoards).toHaveBeenCalledWith(
      "outstand-account-pinterest-1",
    );
    expect(boards).toEqual([{ id: "board-1", name: "Resep & Minuman" }]);
  });

  it("throws ConflictError when connectedAccountId does not belong to this workspace/user (anti-IDOR)", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        listConnectedAccounts: async () => [pinterestAccount()],
      }),
      undefined,
      undefined,
      fakeOutstandAdapter(),
    );

    await expect(
      service.listPinterestBoards({
        workspaceId: WORKSPACE_ID,
        actorId: OWNER_USER,
        connectedAccountId: asConnectedAccountId("not-owned-account"),
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("throws ValidationError when connectedAccountId is not a Pinterest account", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        listConnectedAccounts: async () => [twitterAccount()],
      }),
      undefined,
      undefined,
      fakeOutstandAdapter(),
    );

    await expect(
      service.listPinterestBoards({
        workspaceId: WORKSPACE_ID,
        actorId: OWNER_USER,
        connectedAccountId: TWITTER_CONNECTED_ACCOUNT_ID,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("does not require Owner/Admin — any active member can list boards while composing a post", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers([
          ...baseSeed(),
          member(
            OTHER_USER,
            asMemberId("lpb-member-other"),
            MemberRole.Creator,
          ),
        ]),
        listConnectedAccounts: async () => [pinterestAccount()],
      }),
      undefined,
      undefined,
      fakeOutstandAdapter({
        listPinterestBoards: async () => [{ id: "board-1", name: "Board" }],
      }),
    );

    await expect(
      service.listPinterestBoards({
        workspaceId: WORKSPACE_ID,
        actorId: OTHER_USER,
        connectedAccountId: PINTEREST_CONNECTED_ACCOUNT_ID,
      }),
    ).resolves.toEqual([{ id: "board-1", name: "Board" }]);
  });
});

describe("WorkspaceService.confirmFacebookPagesConnection (T-025.4, ADR-115)", () => {
  const OWNER_USER = asUserId("cfp-owner-user");
  const CREATOR_USER = asUserId("cfp-creator-user");

  const OWNER_MEMBER_ID = asMemberId("cfp-member-owner");
  const CREATOR_MEMBER_ID = asMemberId("cfp-member-creator");

  function baseSeed(): WorkspaceMemberRecord[] {
    return [
      member(OWNER_USER, OWNER_MEMBER_ID, MemberRole.Owner),
      member(CREATOR_USER, CREATOR_MEMBER_ID, MemberRole.Creator),
    ];
  }

  function fakePage(outstandAccountId: string, handle: string) {
    return {
      outstandAccountId,
      platform: SocialPlatform.Facebook,
      handle,
      status: "active" as const,
    };
  }

  it("creates a ConnectedAccount per confirmed Page and seeds JOB-03 once per new Page", async () => {
    const createConnectedAccount = vi.fn(async (input) => ({
      id: asConnectedAccountId(`conn-${input.outstandAccountId}`),
      workspaceId: input.workspaceId,
      platform: input.platform,
      outstandAccountId: input.outstandAccountId,
      handle: input.handle,
      status: "active" as const,
      reconnectRequired: false,
      connectedAt: new Date(),
      lastImportedUntil: null,
      lastImportRequestedAt: null,
    }));
    const onAccountConnected = vi.fn(async () => undefined);
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        createConnectedAccount,
      }),
      undefined,
      undefined,
      fakeOutstandAdapter({
        confirmFacebookPagesConnection: async () => ({
          accounts: [
            fakePage("fb-page-1", "Kopi Selasar"),
            fakePage("fb-page-2", "Roti Selasar"),
          ],
        }),
      }),
      { onAccountConnected },
    );

    const result = await service.confirmFacebookPagesConnection({
      workspaceId: WORKSPACE_ID,
      actorId: OWNER_USER,
      sessionToken: "session-token-1",
      selectedPageIds: ["fb-page-1", "fb-page-2"],
    });

    expect(result).toHaveLength(2);
    expect(createConnectedAccount).toHaveBeenCalledTimes(2);
    expect(onAccountConnected).toHaveBeenCalledTimes(2);
    expect(onAccountConnected).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      connectedAccountId: asConnectedAccountId("conn-fb-page-1"),
      outstandAccountId: "fb-page-1",
    });
  });

  it("skips (not fails) a Page that is already connected (ConflictError, idempotent-guard ADR-109) and still creates the rest", async () => {
    const createConnectedAccount = vi.fn(async (input) => {
      if (input.outstandAccountId === "fb-page-1") {
        throw new ConflictError("Akun ini sudah terhubung.");
      }
      return {
        id: asConnectedAccountId(`conn-${input.outstandAccountId}`),
        workspaceId: input.workspaceId,
        platform: input.platform,
        outstandAccountId: input.outstandAccountId,
        handle: input.handle,
        status: "active" as const,
        reconnectRequired: false,
        connectedAt: new Date(),
        lastImportedUntil: null,
        lastImportRequestedAt: null,
      };
    });
    const onAccountConnected = vi.fn(async () => undefined);
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        createConnectedAccount,
      }),
      undefined,
      undefined,
      fakeOutstandAdapter({
        confirmFacebookPagesConnection: async () => ({
          accounts: [
            fakePage("fb-page-1", "Kopi Selasar"),
            fakePage("fb-page-2", "Roti Selasar"),
          ],
        }),
      }),
      { onAccountConnected },
    );

    const result = await service.confirmFacebookPagesConnection({
      workspaceId: WORKSPACE_ID,
      actorId: OWNER_USER,
      sessionToken: "session-token-1",
      selectedPageIds: ["fb-page-1", "fb-page-2"],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.outstandAccountId).toBe("fb-page-2");
    expect(onAccountConnected).toHaveBeenCalledTimes(1);
  });

  // KI-076/ADR-120 — `confirmFacebookPagesConnection` (finalize) TIDAK
  // PERNAH membawa foto profil; `WorkspaceService` harus re-fetch
  // `listPendingFacebookPages` dan join balik `pictureUrl` per pageId
  // SEBELUM menyimpan lewat `createConnectedAccounts`.
  it("joins pictureUrl from listPendingFacebookPages into avatarUrl, matched by pageId/outstandAccountId (KI-076)", async () => {
    const listPendingFacebookPages = vi.fn(async () => ({
      pages: [
        {
          pageId: "fb-page-1",
          name: "Kopi Selasar",
          pictureUrl: "https://cdn.example.com/kopi-selasar.jpg",
        },
        { pageId: "fb-page-2", name: "Roti Selasar" },
      ],
    }));
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
      }),
      undefined,
      undefined,
      fakeOutstandAdapter({
        listPendingFacebookPages,
        confirmFacebookPagesConnection: async () => ({
          accounts: [
            fakePage("fb-page-1", "Kopi Selasar"),
            fakePage("fb-page-2", "Roti Selasar"),
          ],
        }),
      }),
    );

    const result = await service.confirmFacebookPagesConnection({
      workspaceId: WORKSPACE_ID,
      actorId: OWNER_USER,
      sessionToken: "session-token-1",
      selectedPageIds: ["fb-page-1", "fb-page-2"],
    });

    // list re-fetch harus terjadi SEBELUM finalize (avatar didapat sebelum
    // Page benar-benar dikonfirmasi/disimpan).
    expect(listPendingFacebookPages).toHaveBeenCalledWith({
      sessionToken: "session-token-1",
    });
    expect(
      result.find((account) => account.outstandAccountId === "fb-page-1")
        ?.avatarUrl,
    ).toBe("https://cdn.example.com/kopi-selasar.jpg");
    expect(
      result.find((account) => account.outstandAccountId === "fb-page-2")
        ?.avatarUrl,
    ).toBeNull();
  });

  it("falls back to avatarUrl: null for all Pages (best-effort) when the listPendingFacebookPages re-fetch fails, WITHOUT failing the connect (KI-076)", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
      }),
      undefined,
      undefined,
      fakeOutstandAdapter({
        listPendingFacebookPages: async () => {
          throw new Error("session expired");
        },
        confirmFacebookPagesConnection: async () => ({
          accounts: [fakePage("fb-page-1", "Kopi Selasar")],
        }),
      }),
    );

    const result = await service.confirmFacebookPagesConnection({
      workspaceId: WORKSPACE_ID,
      actorId: OWNER_USER,
      sessionToken: "session-token-1",
      selectedPageIds: ["fb-page-1"],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.avatarUrl).toBeNull();
  });

  it("throws ValidationError for an empty selectedPageIds (defense-in-depth, does not trust the client)", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
      undefined,
      undefined,
      fakeOutstandAdapter(),
    );

    await expect(
      service.confirmFacebookPagesConnection({
        workspaceId: WORKSPACE_ID,
        actorId: OWNER_USER,
        sessionToken: "session-token-1",
        selectedPageIds: [],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects Creator as actor", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
      undefined,
      undefined,
      fakeOutstandAdapter(),
    );

    await expect(
      service.confirmFacebookPagesConnection({
        workspaceId: WORKSPACE_ID,
        actorId: CREATOR_USER,
        sessionToken: "session-token-1",
        selectedPageIds: ["fb-page-1"],
      }),
    ).rejects.toThrow(AuthorizationError);
  });
});

describe("WorkspaceService.canManageMembers", () => {
  const OWNER_USER = asUserId("cmm-owner-user");
  const ADMIN_USER = asUserId("cmm-admin-user");
  const CREATOR_USER = asUserId("cmm-creator-user");

  const OWNER_MEMBER_ID = asMemberId("cmm-member-owner");
  const ADMIN_MEMBER_ID = asMemberId("cmm-member-admin");
  const CREATOR_MEMBER_ID = asMemberId("cmm-member-creator");

  function baseSeed(): WorkspaceMemberRecord[] {
    return [
      member(OWNER_USER, OWNER_MEMBER_ID, MemberRole.Owner),
      member(ADMIN_USER, ADMIN_MEMBER_ID, MemberRole.Admin),
      member(CREATOR_USER, CREATOR_MEMBER_ID, MemberRole.Creator),
    ];
  }

  // Gate akses halaman Members (bukan cuma aksi kelola) — Creator harus
  // "Tidak ada akses" sama sekali per roles-permissions.md, beda dari
  // removeMember/updateMemberRole yang jadi target tapi bukan actor di
  // sini. Regression test untuk bug KI-038 (halaman Members tetap
  // terbuka + data member/email terkirim ke Creator).
  it("returns true for Owner", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.canManageMembers(WORKSPACE_ID, OWNER_USER),
    ).resolves.toBe(true);
  });

  it("returns true for Admin", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.canManageMembers(WORKSPACE_ID, ADMIN_USER),
    ).resolves.toBe(true);
  });

  it("returns false for Creator", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.canManageMembers(WORKSPACE_ID, CREATOR_USER),
    ).resolves.toBe(false);
  });

  it("returns false for a non-member / stranger", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.canManageMembers(WORKSPACE_ID, asUserId("cmm-stranger")),
    ).resolves.toBe(false);
  });

  it("returns false when the actor's membership is not Active", async () => {
    const seed = baseSeed();
    seed.push(
      member(
        asUserId("cmm-pending-user"),
        asMemberId("cmm-member-pending"),
        MemberRole.Admin,
        MemberStatus.Pending,
      ),
    );
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(seed)),
    );

    await expect(
      service.canManageMembers(WORKSPACE_ID, asUserId("cmm-pending-user")),
    ).resolves.toBe(false);
  });
});

describe("WorkspaceService.canManageConnectedAccounts", () => {
  const OWNER_USER = asUserId("cmca-owner-user");
  const ADMIN_USER = asUserId("cmca-admin-user");
  const CREATOR_USER = asUserId("cmca-creator-user");

  const OWNER_MEMBER_ID = asMemberId("cmca-member-owner");
  const ADMIN_MEMBER_ID = asMemberId("cmca-member-admin");
  const CREATOR_MEMBER_ID = asMemberId("cmca-member-creator");

  function baseSeed(): WorkspaceMemberRecord[] {
    return [
      member(OWNER_USER, OWNER_MEMBER_ID, MemberRole.Owner),
      member(ADMIN_USER, ADMIN_MEMBER_ID, MemberRole.Admin),
      member(CREATOR_USER, CREATOR_MEMBER_ID, MemberRole.Creator),
    ];
  }

  // T-109 (KI-058): gate UI aksi Connect/Disconnect/Reconnect di halaman
  // Connected Accounts — beda dari canManageMembers, Creator TETAP `false`
  // di sini tapi halaman itu sendiri tidak di-redirect (read-only per
  // roles-permissions.md § Connected Accounts) — page.tsx tidak memanggil
  // ini untuk gating akses halaman, hanya untuk kontrol render tombol.
  it("returns true for Owner", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.canManageConnectedAccounts(WORKSPACE_ID, OWNER_USER),
    ).resolves.toBe(true);
  });

  it("returns true for Admin", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.canManageConnectedAccounts(WORKSPACE_ID, ADMIN_USER),
    ).resolves.toBe(true);
  });

  it("returns false for Creator", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.canManageConnectedAccounts(WORKSPACE_ID, CREATOR_USER),
    ).resolves.toBe(false);
  });

  it("returns false for a non-member / stranger", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.canManageConnectedAccounts(
        WORKSPACE_ID,
        asUserId("cmca-stranger"),
      ),
    ).resolves.toBe(false);
  });

  it("returns false when the actor's membership is not Active", async () => {
    const seed = baseSeed();
    seed.push(
      member(
        asUserId("cmca-pending-user"),
        asMemberId("cmca-member-pending"),
        MemberRole.Admin,
        MemberStatus.Pending,
      ),
    );
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(seed)),
    );

    await expect(
      service.canManageConnectedAccounts(
        WORKSPACE_ID,
        asUserId("cmca-pending-user"),
      ),
    ).resolves.toBe(false);
  });
});

describe("WorkspaceService.updateMemberRole", () => {
  const OWNER_USER = asUserId("owner-user");
  const ADMIN_USER = asUserId("admin-user");
  const CREATOR_USER = asUserId("creator-user");

  const OWNER_MEMBER_ID = asMemberId("member-owner");
  const ADMIN_MEMBER_ID = asMemberId("member-admin");
  const CREATOR_MEMBER_ID = asMemberId("member-creator");

  function baseSeed(): WorkspaceMemberRecord[] {
    return [
      member(OWNER_USER, OWNER_MEMBER_ID, MemberRole.Owner),
      member(ADMIN_USER, ADMIN_MEMBER_ID, MemberRole.Admin),
      member(CREATOR_USER, CREATOR_MEMBER_ID, MemberRole.Creator),
    ];
  }

  it("allows Owner to update an Admin or Creator member's role", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.updateMemberRole(
        WORKSPACE_ID,
        OWNER_USER,
        CREATOR_MEMBER_ID,
        MemberRole.Admin,
      ),
    ).resolves.toBeUndefined();
  });

  it("allows Admin to update a Creator member's role", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.updateMemberRole(
        WORKSPACE_ID,
        ADMIN_USER,
        CREATOR_MEMBER_ID,
        MemberRole.Admin,
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects Admin trying to change the Owner's role", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.updateMemberRole(
        WORKSPACE_ID,
        ADMIN_USER,
        OWNER_MEMBER_ID,
        MemberRole.Admin,
      ),
    ).rejects.toThrow(AuthorizationError);
  });

  it("rejects Creator as actor even against a valid target", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.updateMemberRole(
        WORKSPACE_ID,
        CREATOR_USER,
        ADMIN_MEMBER_ID,
        MemberRole.Admin,
      ),
    ).rejects.toThrow(AuthorizationError);
  });

  it("rejects promoting a member to Owner via updateMemberRole", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.updateMemberRole(
        WORKSPACE_ID,
        OWNER_USER,
        CREATOR_MEMBER_ID,
        MemberRole.Owner,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("throws NotFoundError when the target member id does not exist", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.updateMemberRole(
        WORKSPACE_ID,
        OWNER_USER,
        asMemberId("missing"),
        MemberRole.Admin,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when the actor is not an active member", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.updateMemberRole(
        WORKSPACE_ID,
        asUserId("stranger-user"),
        CREATOR_MEMBER_ID,
        MemberRole.Admin,
      ),
    ).rejects.toThrow(AuthorizationError);
  });
});

describe("WorkspaceService.inviteMember", () => {
  const OWNER_USER = asUserId("owner-user");
  const ADMIN_USER = asUserId("admin-user");
  const CREATOR_USER = asUserId("creator-user");

  const OWNER_MEMBER_ID = asMemberId("member-owner");
  const ADMIN_MEMBER_ID = asMemberId("member-admin");
  const CREATOR_MEMBER_ID = asMemberId("member-creator");

  function baseSeed(): WorkspaceMemberRecord[] {
    return [
      member(OWNER_USER, OWNER_MEMBER_ID, MemberRole.Owner),
      member(ADMIN_USER, ADMIN_MEMBER_ID, MemberRole.Admin),
      member(CREATOR_USER, CREATOR_MEMBER_ID, MemberRole.Creator),
    ];
  }

  it("allows Owner to invite a new member and generates a token + 7-day expiry", async () => {
    const before = Date.now();
    const baseRepository = createFakeRepository(seedMembers(baseSeed()));
    const captured: {
      input?: Parameters<IWorkspaceRepository["createInvitation"]>[0];
    } = {};
    const service = new WorkspaceService({
      ...baseRepository,
      createInvitation: async (input) => {
        captured.input = input;
        return baseRepository.createInvitation(input);
      },
    });

    const invitation = await service.inviteMember(WORKSPACE_ID, OWNER_USER, {
      email: "Newbie@Example.com",
      role: MemberRole.Creator,
    });

    expect(invitation.email).toBe("newbie@example.com");
    expect(invitation.role).toBe(MemberRole.Creator);
    expect(invitation.status).toBe(InvitationStatus.Pending);
    expect(invitation.token).toMatch(/^[0-9a-f]{64}$/);
    expect(invitation.workspaceId).toBe(WORKSPACE_ID);
    // WorkspaceInvitationRecord (return value) tidak menyimpan
    // invitedByUserId — verifikasi lewat input yang diteruskan ke
    // repository (temuan CodeRabbit PR #73: pastikan actorUserId benar-benar
    // di-forward, bukan cuma workspaceId/token).
    expect(captured.input?.invitedByUserId).toBe(OWNER_USER);
    expect(captured.input?.workspaceId).toBe(WORKSPACE_ID);

    const expectedMinExpiry = before + 7 * 24 * 60 * 60 * 1000;
    const expectedMaxExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
    expect(invitation.expiresAt.getTime()).toBeGreaterThanOrEqual(
      expectedMinExpiry,
    );
    expect(invitation.expiresAt.getTime()).toBeLessThanOrEqual(
      expectedMaxExpiry,
    );
  });

  it("allows Admin to invite a new member", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.inviteMember(WORKSPACE_ID, ADMIN_USER, {
        email: "another@example.com",
        role: MemberRole.Admin,
      }),
    ).resolves.toMatchObject({ email: "another@example.com" });
  });

  it("rejects Creator as actor", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.inviteMember(WORKSPACE_ID, CREATOR_USER, {
        email: "another@example.com",
        role: MemberRole.Creator,
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws AuthorizationError when the actor is not a member", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.inviteMember(WORKSPACE_ID, asUserId("stranger-user"), {
        email: "another@example.com",
        role: MemberRole.Creator,
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("rejects inviting a new member as Owner", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.inviteMember(WORKSPACE_ID, OWNER_USER, {
        email: "another@example.com",
        role: MemberRole.Owner,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects an empty email", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.inviteMember(WORKSPACE_ID, OWNER_USER, {
        email: "   ",
        role: MemberRole.Creator,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a malformed email", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.inviteMember(WORKSPACE_ID, OWNER_USER, {
        email: "not-an-email",
        role: MemberRole.Creator,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("propagates ConflictError when an invitation for the email already exists", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        createInvitation: async () => {
          throw new ConflictError(
            'Undangan untuk "dup@example.com" di workspace ini sudah ada.',
          );
        },
      }),
    );

    await expect(
      service.inviteMember(WORKSPACE_ID, OWNER_USER, {
        email: "dup@example.com",
        role: MemberRole.Creator,
      }),
    ).rejects.toThrow(ConflictError);
  });
});

/** Invitation seed helper untuk describe blocks T-093 di bawah. */
function pendingInvitation(
  overrides: Partial<WorkspaceInvitationRecord> = {},
): WorkspaceInvitationRecord {
  return {
    id: asInvitationId("invitation-1"),
    workspaceId: WORKSPACE_ID,
    email: "invitee@example.com",
    role: MemberRole.Creator,
    token: "a".repeat(64),
    status: InvitationStatus.Pending,
    invitedByUserId: asUserId("owner-user"),
    expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    verificationCodeHash: null,
    verificationCodeExpiresAt: null,
    verificationAttempts: 0,
    emailVerifiedAt: null,
    ...overrides,
  };
}

describe("WorkspaceService.getInviteToAccept (T-093.1)", () => {
  it("returns invalid when the token does not exist", async () => {
    const service = new WorkspaceService(
      createFakeRepository({ findInvitationByToken: async () => null }),
    );

    await expect(service.getInviteToAccept("does-not-exist")).resolves.toEqual({
      state: "invalid",
    });
  });

  it("returns invalid when the invitation was already accepted", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () =>
          pendingInvitation({ status: InvitationStatus.Accepted }),
      }),
    );

    await expect(service.getInviteToAccept("token")).resolves.toEqual({
      state: "invalid",
    });
  });

  it("returns invalid when the invitation was revoked", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () =>
          pendingInvitation({ status: InvitationStatus.Revoked }),
      }),
    );

    await expect(service.getInviteToAccept("token")).resolves.toEqual({
      state: "invalid",
    });
  });

  it("returns expired when the token is still pending but past expiresAt (ADR-072, 7 days)", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () =>
          pendingInvitation({
            expiresAt: new Date(Date.now() - 1000),
          }),
      }),
    );

    await expect(service.getInviteToAccept("token")).resolves.toEqual({
      state: "expired",
    });
  });

  it("returns valid with isExistingUser=false when the email has no account yet", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () => pendingInvitation(),
        findById: async () => ({
          id: WORKSPACE_ID,
          name: "Acme",
          slug: "acme",
        }),
        findUsersByIds: async () => [
          { id: asUserId("owner-user"), name: "Raka", email: "raka@acme.com" },
        ],
        findUserByEmail: async () => null,
      }),
    );

    await expect(service.getInviteToAccept("token")).resolves.toEqual({
      state: "valid",
      details: {
        workspaceName: "Acme",
        invitedByName: "Raka",
        role: MemberRole.Creator,
        email: "invitee@example.com",
        isExistingUser: false,
      },
    });
  });

  it("returns valid with isExistingUser=true when the email already has an account", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () => pendingInvitation(),
        findById: async () => ({
          id: WORKSPACE_ID,
          name: "Acme",
          slug: "acme",
        }),
        findUsersByIds: async () => [
          { id: asUserId("owner-user"), name: "Raka", email: "raka@acme.com" },
        ],
        findUserByEmail: async () => ({
          id: asUserId("existing-user"),
          createdAt: new Date(),
        }),
      }),
    );

    const result = await service.getInviteToAccept("token");
    expect(result).toMatchObject({
      state: "valid",
      details: { isExistingUser: true },
    });
  });
});

describe("WorkspaceService.acceptInvite (T-093.2/.3)", () => {
  it("throws NotFoundError when the token does not exist", async () => {
    const service = new WorkspaceService(
      createFakeRepository({ findInvitationByToken: async () => null }),
    );

    await expect(
      service.acceptInvite({
        token: "missing",
        actorUserId: asUserId("new-user"),
        actorEmail: "invitee@example.com",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws ConflictError when the invitation was already accepted (no token reuse)", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () =>
          pendingInvitation({ status: InvitationStatus.Accepted }),
      }),
    );

    await expect(
      service.acceptInvite({
        token: "token",
        actorUserId: asUserId("new-user"),
        actorEmail: "invitee@example.com",
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("throws ValidationError when the invitation has expired", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () =>
          pendingInvitation({ expiresAt: new Date(Date.now() - 1000) }),
      }),
    );

    await expect(
      service.acceptInvite({
        token: "token",
        actorUserId: asUserId("new-user"),
        actorEmail: "invitee@example.com",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("throws AuthorizationError when the acting account's email does not match the invitation (email-bound, ADR-080)", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () => pendingInvitation(),
      }),
    );

    await expect(
      service.acceptInvite({
        token: "token",
        actorUserId: asUserId("new-user"),
        actorEmail: "someone-else@example.com",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("accepts a new-account signup that HAS completed OTP verification (T-110), assigns the role from the invitation (not a default), and returns the workspace id", async () => {
    const captured: {
      input?: Parameters<IWorkspaceRepository["acceptInvitation"]>[0];
    } = {};
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () =>
          pendingInvitation({
            role: MemberRole.Admin,
            emailVerifiedAt: new Date(),
          }),
        acceptInvitation: async (input) => {
          captured.input = input;
          return {
            id: asMemberId("member-new"),
            workspaceId: input.workspaceId,
            userId: input.userId,
            role: input.role,
            status: MemberStatus.Active,
          };
        },
      }),
    );

    const result = await service.acceptInvite({
      token: "token",
      actorUserId: asUserId("new-user"),
      // Email dari akun yang baru dibuat harus persis sama dengan
      // invitation.email — case-insensitive (invitation di-lowercase saat
      // dibuat, akun Better Auth mungkin mengembalikan casing asli).
      actorEmail: "Invitee@Example.com",
    });

    expect(captured.input).toMatchObject({
      workspaceId: WORKSPACE_ID,
      invitationId: asInvitationId("invitation-1"),
      userId: asUserId("new-user"),
      role: MemberRole.Admin,
    });
    expect(result).toEqual({
      workspaceId: WORKSPACE_ID,
      role: MemberRole.Admin,
    });
  });

  it("accepts an existing-user sign-in whose invitation never went through the OTP flow at all (T-110: no OTP required, isExistingUser: true path)", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        // `verificationCodeHash`/`verificationAttempts` default null/0
        // (lihat `pendingInvitation()`) — invitation ini TIDAK PERNAH
        // tersentuh `requestInviteEmailVerification` sama sekali, persis
        // jalur existing-user (isExistingUser: true) yang langsung sign-in
        // tanpa pernah melalui OTP (KI-053 "Scope aman"). Guard T-110.3
        // HARUS meloloskan ini apa pun umur akunnya — akun sengaja TIDAK
        // dibuat "baru" di sini untuk membuktikan guard tidak lagi
        // bergantung pada umur akun (revisi 2026-09-28, temuan Najwa QA
        // Engineer: window umur akun salah blokir sign-in sah).
        findInvitationByToken: async () =>
          pendingInvitation({ role: MemberRole.Creator }),
        acceptInvitation: async (input) => ({
          id: asMemberId("member-existing"),
          workspaceId: input.workspaceId,
          userId: input.userId,
          role: input.role,
          status: MemberStatus.Active,
        }),
      }),
    );

    await expect(
      service.acceptInvite({
        token: "token",
        actorUserId: asUserId("existing-user"),
        actorEmail: "invitee@example.com",
      }),
    ).resolves.toEqual({ workspaceId: WORKSPACE_ID, role: MemberRole.Creator });
  });

  it("rejects an accept attempt when THIS invitation's OTP flow was started but never confirmed (T-110.3, KI-053 attack path)", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        // `verificationCodeHash` terisi (kode pernah di-generate lewat
        // `requestInviteEmailVerification` untuk TOKEN INI) tapi
        // `emailVerifiedAt` masih null — persis pola serangan KI-053: coba
        // buat akun baru untuk email undangan ini, tapi verifikasi kode
        // tidak pernah (atau belum) benar-benar dikonfirmasi. Harus
        // ditolak, TIDAK boleh sampai memanggil repository.acceptInvitation
        // sama sekali — TERLEPAS dari umur akunnya (guard ini scoped ke
        // invitation, bukan umur akun, sejak revisi 2026-09-28).
        findInvitationByToken: async () =>
          pendingInvitation({
            verificationCodeHash: hashInviteVerificationCode("111111"),
            verificationCodeExpiresAt: new Date(Date.now() + 60_000),
            verificationAttempts: 1,
          }),
        acceptInvitation: async () => {
          throw new Error(
            "acceptInvitation tidak boleh dipanggil — guard T-110.3 harus menolak lebih dulu.",
          );
        },
      }),
    );

    await expect(
      service.acceptInvite({
        token: "token",
        actorUserId: asUserId("new-user"),
        actorEmail: "invitee@example.com",
      }),
    ).rejects.toThrow(AuthorizationError);
  });
});

/** Double lokal untuk `InviteEmailSenderPort` (T-110, AGENTS.md rule 19 — bukan singleton produksi). */
function fakeInviteEmailSender() {
  const sent: { email: string; code: string; workspaceName: string }[] = [];
  return {
    sender: {
      async sendInviteVerificationCode(input: {
        email: string;
        code: string;
        workspaceName: string;
      }) {
        sent.push(input);
      },
    },
    sent,
  };
}

describe("WorkspaceService.requestInviteEmailVerification (T-110.2, KI-053)", () => {
  it("throws NotFoundError when the token does not exist", async () => {
    const service = new WorkspaceService(
      createFakeRepository({ findInvitationByToken: async () => null }),
      undefined,
      undefined,
      undefined,
      undefined,
      fakeInviteEmailSender().sender,
    );

    await expect(
      service.requestInviteEmailVerification("missing"),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws ValidationError when the invitation has expired", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () =>
          pendingInvitation({ expiresAt: new Date(Date.now() - 1000) }),
      }),
      undefined,
      undefined,
      undefined,
      undefined,
      fakeInviteEmailSender().sender,
    );

    await expect(
      service.requestInviteEmailVerification("token"),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ConflictError (race condition) when the email already has an account by the time the code is requested", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () => pendingInvitation(),
        findUserByEmail: async () => ({
          id: asUserId("someone"),
          createdAt: new Date(),
        }),
      }),
      undefined,
      undefined,
      undefined,
      undefined,
      fakeInviteEmailSender().sender,
    );

    await expect(
      service.requestInviteEmailVerification("token"),
    ).rejects.toThrow(ConflictError);
  });

  it("generates a 6-digit code, persists only its hash, and sends the plaintext code via the email port", async () => {
    let persisted: { codeHash: string; expiresAt: Date } | undefined;
    const { sender, sent } = fakeInviteEmailSender();
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () => pendingInvitation(),
        findById: async () => ({
          id: WORKSPACE_ID,
          name: "Acme",
          slug: "acme",
        }),
        setInvitationVerificationCode: async (_token, input) => {
          persisted = input;
        },
      }),
      undefined,
      undefined,
      undefined,
      undefined,
      sender,
    );

    await service.requestInviteEmailVerification("token");

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      email: "invitee@example.com",
      workspaceName: "Acme",
    });
    expect(sent[0].code).toMatch(/^\d{6}$/);
    expect(persisted?.codeHash).toBe(hashInviteVerificationCode(sent[0].code));
    expect(persisted?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("throws when InviteEmailSenderPort was not supplied to the constructor (composition root forgot to wire it)", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () => pendingInvitation(),
      }),
    );

    await expect(
      service.requestInviteEmailVerification("token"),
    ).rejects.toThrow();
  });
});

describe("WorkspaceService.confirmInviteEmailVerification (T-110.3, KI-053)", () => {
  it("throws NotFoundError when the token does not exist", async () => {
    const service = new WorkspaceService(
      createFakeRepository({ findInvitationByToken: async () => null }),
    );

    await expect(
      service.confirmInviteEmailVerification("missing", "123456"),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws ValidationError when there is no active verification code", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () => pendingInvitation(),
      }),
    );

    await expect(
      service.confirmInviteEmailVerification("token", "123456"),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError and increments verificationAttempts when the code is wrong", async () => {
    let incrementCalls = 0;
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () =>
          pendingInvitation({
            verificationCodeHash: hashInviteVerificationCode("111111"),
            verificationCodeExpiresAt: new Date(Date.now() + 60_000),
            verificationAttempts: 0,
          }),
        incrementInvitationVerificationAttempts: async () => {
          incrementCalls += 1;
          return incrementCalls;
        },
      }),
    );

    await expect(
      service.confirmInviteEmailVerification("token", "000000"),
    ).rejects.toThrow(ValidationError);
    expect(incrementCalls).toBe(1);
  });

  it("throws ValidationError WITHOUT incrementing further once the attempt limit is already reached", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () =>
          pendingInvitation({
            verificationCodeHash: hashInviteVerificationCode("111111"),
            verificationCodeExpiresAt: new Date(Date.now() + 60_000),
            verificationAttempts: 5,
          }),
        incrementInvitationVerificationAttempts: async () => {
          throw new Error(
            "tidak boleh dipanggil — batas percobaan sudah tercapai.",
          );
        },
      }),
    );

    await expect(
      service.confirmInviteEmailVerification("token", "111111"),
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when the code itself has expired", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () =>
          pendingInvitation({
            verificationCodeHash: hashInviteVerificationCode("111111"),
            verificationCodeExpiresAt: new Date(Date.now() - 1000),
            verificationAttempts: 0,
          }),
      }),
    );

    await expect(
      service.confirmInviteEmailVerification("token", "111111"),
    ).rejects.toThrow(ValidationError);
  });

  it("marks the email as verified (single-use) when the correct code is confirmed", async () => {
    let markedVerified = false;
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () =>
          pendingInvitation({
            verificationCodeHash: hashInviteVerificationCode("111111"),
            verificationCodeExpiresAt: new Date(Date.now() + 60_000),
            verificationAttempts: 2,
          }),
        // Code-review PR #142 fix — reservasi atomic sekarang SELALU
        // dipanggil sebelum membandingkan kode (lihat
        // confirmInviteEmailVerification), termasuk saat kodenya benar.
        // Double lokal: naikkan attempts persis seperti repository
        // Prisma sungguhan untuk kasus "masih di bawah cap" (3 <= 5).
        incrementInvitationVerificationAttempts: async () => 3,
        markInvitationEmailVerified: async () => {
          markedVerified = true;
        },
      }),
    );

    await service.confirmInviteEmailVerification("token", "111111");
    expect(markedVerified).toBe(true);
  });

  it("code-review PR #142: rejects WITHOUT verifying when the atomic reservation reports the cap already reached (race-condition fix)", async () => {
    // Simulasi race: baca awal (findInvitationByToken) masih melihat
    // attempts=4 (di bawah cap), TAPI repository (Prisma sungguhan, lewat
    // `UPDATE ... WHERE verification_attempts < max` atomic) melaporkan
    // reservasi GAGAL karena request konkuren lain baru saja mengisi slot
    // terakhir — sentinel `maxAttempts + 1` (lihat
    // `incrementInvitationVerificationAttempts` di
    // `lib/repositories/workspace/workspace.repository.ts`). Kode yang
    // dikirim BENAR, tapi harus tetap ditolak TANPA pernah dibandingkan —
    // membuktikan reservasi-dulu-baru-bandingkan menutup race, bukan
    // sekadar percaya baca awal yang sudah basi.
    let markedVerified = false;
    const service = new WorkspaceService(
      createFakeRepository({
        findInvitationByToken: async () =>
          pendingInvitation({
            verificationCodeHash: hashInviteVerificationCode("111111"),
            verificationCodeExpiresAt: new Date(Date.now() + 60_000),
            verificationAttempts: 4,
          }),
        incrementInvitationVerificationAttempts: async () => 6, // sentinel: maxAttempts(5) + 1
        markInvitationEmailVerified: async () => {
          markedVerified = true;
        },
      }),
    );

    await expect(
      service.confirmInviteEmailVerification("token", "111111"),
    ).rejects.toThrow(ValidationError);
    expect(markedVerified).toBe(false);
  });
});

describe("WorkspaceService.listMembersAndPendingInvitations (T-007.8, ADR-101)", () => {
  const OWNER_USER = asUserId("owner-user");
  const OWNER_MEMBER_ID = asMemberId("member-owner");

  it("gabungan member asli + undangan pending sebagai MemberListRow[], member dulu baru invitation", async () => {
    const invitation = pendingInvitation();
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers([member(OWNER_USER, OWNER_MEMBER_ID, MemberRole.Owner)]),
        listMembers: async () => [
          member(OWNER_USER, OWNER_MEMBER_ID, MemberRole.Owner),
        ],
        findUsersByIds: async () => [
          { id: OWNER_USER, name: "Raka", email: "raka@example.com" },
        ],
        listPendingInvitations: async () => [invitation],
      }),
    );

    const rows = await service.listMembersAndPendingInvitations(
      WORKSPACE_ID,
      OWNER_USER,
    );

    expect(rows).toEqual([
      {
        kind: "member",
        member: {
          id: OWNER_MEMBER_ID,
          userId: OWNER_USER,
          name: "Raka",
          email: "raka@example.com",
          role: MemberRole.Owner,
          status: MemberStatus.Active,
        },
      },
      { kind: "pending-invitation", invitation },
    ]);
  });

  it("mengembalikan array kosong ketika tidak ada member maupun undangan pending", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        listMembers: async () => [],
        listPendingInvitations: async () => [],
      }),
    );

    await expect(
      service.listMembersAndPendingInvitations(WORKSPACE_ID, OWNER_USER),
    ).resolves.toEqual([]);
  });
});

describe("WorkspaceService.cancelInvitation (T-007.8, ADR-101)", () => {
  const OWNER_USER = asUserId("owner-user");
  const ADMIN_USER = asUserId("admin-user");
  const CREATOR_USER = asUserId("creator-user");
  const OWNER_MEMBER_ID = asMemberId("member-owner");
  const ADMIN_MEMBER_ID = asMemberId("member-admin");
  const CREATOR_MEMBER_ID = asMemberId("member-creator");

  function baseSeed(): WorkspaceMemberRecord[] {
    return [
      member(OWNER_USER, OWNER_MEMBER_ID, MemberRole.Owner),
      member(ADMIN_USER, ADMIN_MEMBER_ID, MemberRole.Admin),
      member(CREATOR_USER, CREATOR_MEMBER_ID, MemberRole.Creator),
    ];
  }

  it("allows Owner to cancel a pending invitation", async () => {
    let revoked: string | null = null;
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        revokeInvitation: async (_workspaceId, invitationId) => {
          revoked = invitationId;
        },
      }),
    );

    await expect(
      service.cancelInvitation(
        WORKSPACE_ID,
        OWNER_USER,
        asInvitationId("invitation-1"),
      ),
    ).resolves.toBeUndefined();
    expect(revoked).toBe(asInvitationId("invitation-1"));
  });

  it("allows Admin to cancel a pending invitation", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        revokeInvitation: async () => undefined,
      }),
    );

    await expect(
      service.cancelInvitation(
        WORKSPACE_ID,
        ADMIN_USER,
        asInvitationId("invitation-1"),
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects Creator as actor — RBAC sama dengan removeMember/inviteMember", async () => {
    let calls = 0;
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        revokeInvitation: async () => {
          calls += 1;
        },
      }),
    );

    await expect(
      service.cancelInvitation(
        WORKSPACE_ID,
        CREATOR_USER,
        asInvitationId("invitation-1"),
      ),
    ).rejects.toThrow(AuthorizationError);
    expect(calls).toBe(0);
  });

  it("rejects a non-member actor", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.cancelInvitation(
        WORKSPACE_ID,
        asUserId("stranger-user"),
        asInvitationId("invitation-1"),
      ),
    ).rejects.toThrow(AuthorizationError);
  });

  it("propagates ConflictError from the repository when the invitation is no longer pending", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        revokeInvitation: async () => {
          throw new ConflictError(
            "Undangan ini sudah pernah dipakai atau dibatalkan.",
          );
        },
      }),
    );

    await expect(
      service.cancelInvitation(
        WORKSPACE_ID,
        OWNER_USER,
        asInvitationId("invitation-1"),
      ),
    ).rejects.toThrow(ConflictError);
  });
});

describe("WorkspaceService.saveChannelOrder", () => {
  it("drops ids that are not owned by the workspace before persisting", async () => {
    const ownedAccount: ConnectedAccountRecord = {
      id: asConnectedAccountId("conn-owned"),
      workspaceId: WORKSPACE_ID,
      platform: SocialPlatform.Instagram,
      outstandAccountId: "mock-ig-owned",
      handle: "@owned",
      status: "active",
      reconnectRequired: false,
      connectedAt: new Date("2026-01-01T00:00:00Z"),
      lastImportedUntil: null,
      lastImportRequestedAt: null,
    };
    let received:
      Parameters<IWorkspaceRepository["saveChannelOrder"]>[0] | null = null;
    const service = new WorkspaceService(
      createFakeRepository({
        listConnectedAccounts: async () => [ownedAccount],
        saveChannelOrder: async (input) => {
          received = input;
        },
      }),
    );

    await service.saveChannelOrder(WORKSPACE_ID, USER_ID, [
      asConnectedAccountId("conn-foreign"),
      ownedAccount.id,
    ]);

    expect(received).toEqual({
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      orderedConnectedAccountIds: [ownedAccount.id],
    });
  });
});

describe("WorkspaceService.listTransferEligibleMembers", () => {
  it("returns only Active Admins, excluding Owner/Creator/pending Admin", async () => {
    const ownerId = asUserId("owner-user");
    const activeAdminId = asUserId("active-admin");
    const pendingAdminId = asUserId("pending-admin");
    const creatorId = asUserId("creator-user");

    const service = new WorkspaceService(
      createFakeRepository({
        listMembers: async () => [
          member(ownerId, asMemberId("m-owner"), MemberRole.Owner),
          member(activeAdminId, asMemberId("m-admin-active"), MemberRole.Admin),
          member(
            pendingAdminId,
            asMemberId("m-admin-pending"),
            MemberRole.Admin,
            MemberStatus.Pending,
          ),
          member(creatorId, asMemberId("m-creator"), MemberRole.Creator),
        ],
        findUsersByIds: async () => [
          { id: ownerId, name: "Raka", email: "raka@example.com" },
          { id: activeAdminId, name: "Maya", email: "maya@example.com" },
          { id: pendingAdminId, name: "Sinta", email: "sinta@example.com" },
          { id: creatorId, name: "Dimas", email: "dimas@example.com" },
        ],
      }),
    );

    const result = await service.listTransferEligibleMembers(
      WORKSPACE_ID,
      ownerId,
    );

    expect(result).toEqual([
      {
        id: asMemberId("m-admin-active"),
        userId: activeAdminId,
        name: "Maya",
        email: "maya@example.com",
        role: MemberRole.Admin,
        status: MemberStatus.Active,
      },
    ]);
  });
});

describe("WorkspaceService.deleteWorkspace", () => {
  const OWNER_USER = asUserId("owner-user");
  const ADMIN_USER = asUserId("admin-user");
  const OWNER_MEMBER_ID = asMemberId("member-owner");
  const ADMIN_MEMBER_ID = asMemberId("member-admin");

  function baseSeed(): WorkspaceMemberRecord[] {
    return [
      member(OWNER_USER, OWNER_MEMBER_ID, MemberRole.Owner),
      member(ADMIN_USER, ADMIN_MEMBER_ID, MemberRole.Admin),
    ];
  }

  it("allows Owner to delete the workspace", async () => {
    let deleted = 0;
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        deleteWorkspace: async () => {
          deleted += 1;
        },
      }),
    );

    await expect(
      service.deleteWorkspace(WORKSPACE_ID, OWNER_USER),
    ).resolves.toBeUndefined();
    expect(deleted).toBe(1);
  });

  it("rejects Admin trying to delete the workspace", async () => {
    let deleted = 0;
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        deleteWorkspace: async () => {
          deleted += 1;
        },
      }),
    );

    await expect(
      service.deleteWorkspace(WORKSPACE_ID, ADMIN_USER),
    ).rejects.toThrow(AuthorizationError);
    expect(deleted).toBe(0);
  });

  it("rejects a non-member", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.deleteWorkspace(WORKSPACE_ID, asUserId("stranger-user")),
    ).rejects.toThrow(AuthorizationError);
  });
});

describe("WorkspaceService.transferOwnership", () => {
  const OWNER_USER = asUserId("owner-user");
  const ADMIN_USER = asUserId("admin-user");
  const CREATOR_USER = asUserId("creator-user");
  const OWNER_MEMBER_ID = asMemberId("member-owner");
  const ADMIN_MEMBER_ID = asMemberId("member-admin");
  const CREATOR_MEMBER_ID = asMemberId("member-creator");

  function baseSeed(): WorkspaceMemberRecord[] {
    return [
      member(OWNER_USER, OWNER_MEMBER_ID, MemberRole.Owner),
      member(ADMIN_USER, ADMIN_MEMBER_ID, MemberRole.Admin),
      member(CREATOR_USER, CREATOR_MEMBER_ID, MemberRole.Creator),
    ];
  }

  it("sets pendingOwnerTransferTo and notifies the target Admin", async () => {
    let pendingCall: { targetUserId: string; actingUserId: string } | null =
      null;
    let notified: unknown = null;
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        setPendingOwnerTransfer: async (
          _workspaceId,
          targetUserId,
          actingUserId,
        ) => {
          pendingCall = { targetUserId, actingUserId };
        },
      }),
      undefined,
      {
        notify: async (input) => {
          notified = input;
        },
      },
    );

    await service.transferOwnership(WORKSPACE_ID, OWNER_USER, ADMIN_MEMBER_ID);

    expect(pendingCall).toEqual({
      targetUserId: ADMIN_USER,
      actingUserId: OWNER_USER,
    });
    expect(notified).toMatchObject({
      workspaceId: WORKSPACE_ID,
      userId: ADMIN_USER,
      type: "ownership_transfer_requested",
    });
  });

  it("rejects a non-Owner actor", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.transferOwnership(WORKSPACE_ID, ADMIN_USER, CREATOR_MEMBER_ID),
    ).rejects.toThrow(AuthorizationError);
  });

  it("rejects a target that is not an Admin", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.transferOwnership(WORKSPACE_ID, OWNER_USER, CREATOR_MEMBER_ID),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a non-existent target", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.transferOwnership(
        WORKSPACE_ID,
        OWNER_USER,
        asMemberId("missing"),
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("WorkspaceService.cancelOwnershipTransfer", () => {
  const OWNER_USER = asUserId("owner-user");
  const ADMIN_USER = asUserId("admin-user");
  const OWNER_MEMBER_ID = asMemberId("member-owner");
  const ADMIN_MEMBER_ID = asMemberId("member-admin");

  function baseSeed(): WorkspaceMemberRecord[] {
    return [
      member(OWNER_USER, OWNER_MEMBER_ID, MemberRole.Owner),
      member(ADMIN_USER, ADMIN_MEMBER_ID, MemberRole.Admin),
    ];
  }

  it("allows Owner to cancel a pending transfer", async () => {
    let cleared = 0;
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        clearPendingOwnerTransfer: async () => {
          cleared += 1;
        },
      }),
    );

    await service.cancelOwnershipTransfer(WORKSPACE_ID, OWNER_USER);
    expect(cleared).toBe(1);
  });

  it("rejects a non-Owner actor", async () => {
    const service = new WorkspaceService(
      createFakeRepository(seedMembers(baseSeed())),
    );

    await expect(
      service.cancelOwnershipTransfer(WORKSPACE_ID, ADMIN_USER),
    ).rejects.toThrow(AuthorizationError);
  });
});

describe("WorkspaceService.acceptOwnershipTransfer", () => {
  const OWNER_USER = asUserId("owner-user");
  const ADMIN_USER = asUserId("admin-user");
  const OWNER_MEMBER_ID = asMemberId("member-owner");
  const ADMIN_MEMBER_ID = asMemberId("member-admin");

  function baseSeed(): WorkspaceMemberRecord[] {
    return [
      member(OWNER_USER, OWNER_MEMBER_ID, MemberRole.Owner),
      member(ADMIN_USER, ADMIN_MEMBER_ID, MemberRole.Admin),
    ];
  }

  it("swaps roles and notifies the old Owner when the target accepts", async () => {
    let swapInput: unknown = null;
    let notified: unknown = null;
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        findById: async () => ({
          id: WORKSPACE_ID,
          name: "Acme",
          slug: "acme",
          pendingOwnerTransferTo: ADMIN_USER,
        }),
        listMembers: async () => baseSeed(),
        acceptOwnershipTransfer: async (input) => {
          swapInput = input;
        },
      }),
      undefined,
      {
        notify: async (input) => {
          notified = input;
        },
      },
    );

    await service.acceptOwnershipTransfer(WORKSPACE_ID, ADMIN_USER);

    expect(swapInput).toEqual({
      workspaceId: WORKSPACE_ID,
      currentOwnerMemberId: OWNER_MEMBER_ID,
      targetMemberId: ADMIN_MEMBER_ID,
      newOwnerUserId: ADMIN_USER,
    });
    expect(notified).toMatchObject({
      workspaceId: WORKSPACE_ID,
      userId: OWNER_USER,
      type: "ownership_transfer_resolved",
    });
  });

  it("rejects a user with no pending transfer directed at them", async () => {
    const service = new WorkspaceService(
      createFakeRepository({
        ...seedMembers(baseSeed()),
        findById: async () => ({
          id: WORKSPACE_ID,
          name: "Acme",
          slug: "acme",
          pendingOwnerTransferTo: null,
        }),
      }),
    );

    await expect(
      service.acceptOwnershipTransfer(WORKSPACE_ID, ADMIN_USER),
    ).rejects.toThrow(AuthorizationError);
  });

  it("rejects when the workspace does not exist", async () => {
    const service = new WorkspaceService(
      createFakeRepository({ findById: async () => null }),
    );

    await expect(
      service.acceptOwnershipTransfer(WORKSPACE_ID, ADMIN_USER),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("WorkspaceService.listWorkspacesForUser", () => {
  it("delegates to the repository", async () => {
    const summaries = [
      {
        workspaceId: WORKSPACE_ID,
        name: "Acme",
        slug: "acme",
        role: MemberRole.Owner,
      },
    ];
    const service = new WorkspaceService(
      createFakeRepository({
        listWorkspacesForUser: async () => summaries,
      }),
    );

    await expect(service.listWorkspacesForUser(USER_ID)).resolves.toBe(
      summaries,
    );
  });
});

describe("WorkspaceService.switchWorkspace", () => {
  const MEMBER_USER = asUserId("member-user");
  const MEMBER_ID = asMemberId("member-1");

  it("returns the membership record when the user is an active member", async () => {
    const record = member(MEMBER_USER, MEMBER_ID, MemberRole.Admin);
    const service = new WorkspaceService(
      createFakeRepository(seedMembers([record])),
    );

    await expect(
      service.switchWorkspace({
        userId: MEMBER_USER,
        targetWorkspaceId: WORKSPACE_ID,
      }),
    ).resolves.toEqual(record);
  });

  it("throws AuthorizationError when the user has no membership in the target workspace", async () => {
    const service = new WorkspaceService(createFakeRepository());

    await expect(
      service.switchWorkspace({
        userId: asUserId("stranger-user"),
        targetWorkspaceId: WORKSPACE_ID,
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws AuthorizationError when the membership is not Active", async () => {
    const record = member(
      MEMBER_USER,
      MEMBER_ID,
      MemberRole.Creator,
      MemberStatus.Pending,
    );
    const service = new WorkspaceService(
      createFakeRepository(seedMembers([record])),
    );

    await expect(
      service.switchWorkspace({
        userId: MEMBER_USER,
        targetWorkspaceId: WORKSPACE_ID,
      }),
    ).rejects.toThrow(AuthorizationError);
  });
});

describe("WorkspaceService.listSidebarChannels", () => {
  function account(
    id: string,
    connectedAt: string,
    avatarUrl: string | null = null,
  ): ConnectedAccountRecord {
    return {
      id: asConnectedAccountId(id),
      workspaceId: WORKSPACE_ID,
      platform: SocialPlatform.Instagram,
      outstandAccountId: `mock-${id}`,
      handle: `@${id}`,
      status: "active",
      reconnectRequired: false,
      connectedAt: new Date(connectedAt),
      avatarUrl,
      lastImportedUntil: null,
      lastImportRequestedAt: null,
    };
  }

  it("orders accounts by stored channel order, appending new channels at the end", async () => {
    const accA = account("conn-a", "2026-01-01T00:00:00Z");
    const accB = account("conn-b", "2026-01-02T00:00:00Z");
    const accC = account("conn-c", "2026-01-03T00:00:00Z");
    const service = new WorkspaceService(
      createFakeRepository({
        listConnectedAccounts: async () => [accA, accB, accC],
        getChannelOrder: async () => [accB.id, accA.id],
      }),
    );

    const result = await service.listSidebarChannels(WORKSPACE_ID, USER_ID);

    expect(result.map((c) => c.id)).toEqual([accB.id, accA.id, accC.id]);
  });

  it("defaults scheduledCount to 0 when constructed without a scheduledCounts port", async () => {
    const acc = account("conn-a", "2026-01-01T00:00:00Z");
    const service = new WorkspaceService(
      createFakeRepository({
        listConnectedAccounts: async () => [acc],
      }),
    );

    const result = await service.listSidebarChannels(WORKSPACE_ID, USER_ID);

    expect(result).toEqual([
      {
        id: acc.id,
        platform: acc.platform,
        handle: acc.handle,
        status: acc.status,
        reconnectRequired: acc.reconnectRequired,
        scheduledCount: 0,
        avatarUrl: null,
      },
    ]);
  });

  // KI-076/ADR-120 — avatar/foto profil tidak pernah tampil di sidebar
  // Channels karena field ini tidak pernah mengalir dari repository ke
  // shape yang dikonsumsi UI. Regression test langsung untuk mapping ini.
  it("maps ConnectedAccountRecord.avatarUrl through to SidebarChannelAccount.avatarUrl (KI-076)", async () => {
    const withPhoto = account(
      "conn-a",
      "2026-01-01T00:00:00Z",
      "https://cdn.example.com/avatar.jpg",
    );
    const withoutPhoto = account("conn-b", "2026-01-02T00:00:00Z", null);
    const service = new WorkspaceService(
      createFakeRepository({
        listConnectedAccounts: async () => [withPhoto, withoutPhoto],
      }),
    );

    const result = await service.listSidebarChannels(WORKSPACE_ID, USER_ID);

    expect(result.find((c) => c.id === withPhoto.id)?.avatarUrl).toBe(
      "https://cdn.example.com/avatar.jpg",
    );
    expect(result.find((c) => c.id === withoutPhoto.id)?.avatarUrl).toBeNull();
  });

  it("fills scheduledCount from the provided ScheduledCountsPort", async () => {
    const acc = account("conn-a", "2026-01-01T00:00:00Z");
    const service = new WorkspaceService(
      createFakeRepository({
        listConnectedAccounts: async () => [acc],
      }),
      {
        countScheduledByAccount: async () => new Map([[acc.id, 5]]),
      },
    );

    const result = await service.listSidebarChannels(WORKSPACE_ID, USER_ID);

    expect(result[0]?.scheduledCount).toBe(5);
  });
});
