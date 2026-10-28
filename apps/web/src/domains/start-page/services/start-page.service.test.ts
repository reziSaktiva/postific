import { MemberRole, asUserId, asWorkspaceId } from "@postific/shared";
import { describe, expect, it, vi } from "vitest";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/utils/errors";
import {
  StartPageAlreadyExistsError,
  StartPageSlugTakenError,
} from "../errors";
import type { IStartPageRepository } from "../repositories/start-page-write.repository";
import type {
  StartPageActorContext,
  StartPageLinkRecord,
  StartPageRecord,
} from "../types";
import { StartPageService } from "./start-page.service";

const WS = asWorkspaceId("11111111-1111-4111-8111-111111111111");
const LINK_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LINK_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const ctx: StartPageActorContext = {
  workspaceId: WS,
  actorRole: MemberRole.Admin,
  actingUserId: asUserId("user-1"),
};

function link(id: string, position = 0): StartPageLinkRecord {
  return {
    id,
    label: "Shop",
    url: "https://example.com/",
    position,
    isActive: true,
    clickCount: 0,
  };
}

function page(overrides: Partial<StartPageRecord> = {}): StartPageRecord {
  return {
    id: "p1",
    workspaceId: WS,
    slug: "raka",
    title: "Raka",
    bio: null,
    avatarUrl: null,
    theme: "default",
    isPublished: false,
    viewCount: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    links: [],
    ...overrides,
  };
}

function setup(overrides: Partial<IStartPageRepository> = {}) {
  const repository = {
    findByWorkspace: vi.fn().mockResolvedValue(page()),
    create: vi.fn().mockResolvedValue(page()),
    update: vi.fn().mockResolvedValue(page()),
    addLink: vi.fn().mockResolvedValue(link(LINK_A)),
    updateLink: vi.fn().mockResolvedValue(link(LINK_A)),
    deleteLink: vi.fn().mockResolvedValue(true),
    reorderLinks: vi.fn().mockResolvedValue(true),
    ...overrides,
  } satisfies IStartPageRepository;
  return { service: new StartPageService(repository), repository };
}

describe("StartPageService RBAC", () => {
  it("rejects an invalid role before touching the repository", async () => {
    const { service, repository } = setup();
    const bad = { ...ctx, actorRole: "viewer" as MemberRole };
    await expect(service.getStartPage(bad)).rejects.toThrow(AuthorizationError);
    await expect(
      service.createStartPage(bad, { title: "x", slug: "raka" }),
    ).rejects.toThrow(AuthorizationError);
    await expect(service.deleteLink(bad, LINK_A)).rejects.toThrow(
      AuthorizationError,
    );
    expect(repository.findByWorkspace).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.deleteLink).not.toHaveBeenCalled();
  });
});

describe("createStartPage", () => {
  it("normalizes slug, defaults theme, and passes acting user for RLS", async () => {
    const { service, repository } = setup({
      findByWorkspace: vi.fn().mockResolvedValue(null),
    });
    await service.createStartPage(ctx, {
      title: "  Raka  ",
      slug: "  Raka-Store ",
      bio: "",
    });
    expect(repository.create).toHaveBeenCalledWith(
      {
        workspaceId: WS,
        data: {
          title: "Raka",
          slug: "raka-store",
          bio: null,
          avatarUrl: null,
          theme: "default",
        },
      },
      ctx.actingUserId,
    );
  });

  it("rejects when the workspace already has a page", async () => {
    const { service, repository } = setup();
    await expect(
      service.createStartPage(ctx, { title: "x", slug: "raka" }),
    ).rejects.toThrow(ConflictError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("maps repository unique violations to ConflictError", async () => {
    const taken = setup({
      findByWorkspace: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockRejectedValue(new StartPageSlugTakenError("raka")),
    });
    await expect(
      taken.service.createStartPage(ctx, { title: "x", slug: "raka" }),
    ).rejects.toThrow(/Slug sudah dipakai/);

    const exists = setup({
      findByWorkspace: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockRejectedValue(new StartPageAlreadyExistsError()),
    });
    await expect(
      exists.service.createStartPage(ctx, { title: "x", slug: "raka" }),
    ).rejects.toThrow(ConflictError);
  });

  it.each([
    [{ title: "", slug: "raka" }, /Judul wajib/],
    [{ title: "x".repeat(81), slug: "raka" }, /Judul maksimal/],
    [{ title: "x", slug: "login" }, /dicadangkan/],
    [{ title: "x", slug: "ab" }, /Slug harus 3-40 karakter/],
    [{ title: "x", slug: "raka", bio: "b".repeat(281) }, /Bio maksimal/],
    [
      { title: "x", slug: "raka", avatarUrl: "http://a.test/x.png" },
      /avatar harus/,
    ],
    [
      { title: "x", slug: "raka", avatarUrl: "javascript:alert(1)" },
      /avatar harus/,
    ],
    [{ title: "x", slug: "raka", theme: "neon" }, /Tema tidak dikenal/],
  ])("rejects invalid input %j", async (input, message) => {
    const { service, repository } = setup({
      findByWorkspace: vi.fn().mockResolvedValue(null),
    });
    await expect(service.createStartPage(ctx, input)).rejects.toThrow(
      ValidationError,
    );
    await expect(service.createStartPage(ctx, input)).rejects.toThrow(message);
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("updateProfile / setPublished", () => {
  it("sends only provided fields and allows clearing bio/avatar with null", async () => {
    const { service, repository } = setup();
    await service.updateProfile(ctx, { bio: null, avatarUrl: null });
    expect(repository.update).toHaveBeenCalledWith(
      { workspaceId: WS, data: { bio: null, avatarUrl: null } },
      ctx.actingUserId,
    );
  });

  it("rejects an empty patch", async () => {
    const { service } = setup();
    await expect(service.updateProfile(ctx, {})).rejects.toThrow(
      /Tidak ada perubahan/,
    );
  });

  it("maps slug collision on update to ConflictError", async () => {
    const { service } = setup({
      update: vi.fn().mockRejectedValue(new StartPageSlugTakenError("x-y")),
    });
    await expect(service.updateProfile(ctx, { slug: "x-y" })).rejects.toThrow(
      ConflictError,
    );
  });

  it("throws NotFoundError when no page exists", async () => {
    const { service } = setup({ update: vi.fn().mockResolvedValue(null) });
    await expect(service.setPublished(ctx, true)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("toggles published and rejects non-boolean", async () => {
    const { service, repository } = setup();
    await service.setPublished(ctx, true);
    expect(repository.update).toHaveBeenCalledWith(
      { workspaceId: WS, data: { isPublished: true } },
      ctx.actingUserId,
    );
    await expect(
      service.setPublished(ctx, "yes" as unknown as boolean),
    ).rejects.toThrow(ValidationError);
  });
});

describe("addLink", () => {
  it("canonicalizes the url and defaults to active", async () => {
    const { service, repository } = setup();
    await service.addLink(ctx, { label: " Shop ", url: "https://Example.com" });
    expect(repository.addLink).toHaveBeenCalledWith(
      {
        workspaceId: WS,
        data: { label: "Shop", url: "https://example.com/", isActive: true },
      },
      ctx.actingUserId,
    );
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,x",
    "ftp://x.test",
    "not a url",
    "",
  ])("rejects url %j", async (url) => {
    const { service, repository } = setup();
    await expect(service.addLink(ctx, { label: "x", url })).rejects.toThrow(
      ValidationError,
    );
    expect(repository.addLink).not.toHaveBeenCalled();
  });

  it("rejects label over the limit and empty label", async () => {
    const { service } = setup();
    await expect(
      service.addLink(ctx, { label: "x".repeat(61), url: "https://a.test" }),
    ).rejects.toThrow(/Label maksimal/);
    await expect(
      service.addLink(ctx, { label: "  ", url: "https://a.test" }),
    ).rejects.toThrow(/Label wajib/);
  });

  it("enforces the max link count", async () => {
    const links = Array.from({ length: 50 }, (_, i) =>
      link(`00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, i),
    );
    const { service, repository } = setup({
      findByWorkspace: vi.fn().mockResolvedValue(page({ links })),
    });
    await expect(
      service.addLink(ctx, { label: "x", url: "https://a.test" }),
    ).rejects.toThrow(/Maksimal 50/);
    expect(repository.addLink).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when the workspace has no page", async () => {
    const { service } = setup({
      findByWorkspace: vi.fn().mockResolvedValue(null),
    });
    await expect(
      service.addLink(ctx, { label: "x", url: "https://a.test" }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("updateLink / deleteLink", () => {
  it("rejects a non-uuid link id without hitting the repository", async () => {
    const { service, repository } = setup();
    await expect(
      service.updateLink(ctx, "nope", { label: "x" }),
    ).rejects.toThrow(NotFoundError);
    await expect(service.deleteLink(ctx, "1; DROP")).rejects.toThrow(
      NotFoundError,
    );
    expect(repository.updateLink).not.toHaveBeenCalled();
    expect(repository.deleteLink).not.toHaveBeenCalled();
  });

  it("validates the url on update and rejects an empty patch", async () => {
    const { service } = setup();
    await expect(
      service.updateLink(ctx, LINK_A, { url: "javascript:alert(1)" }),
    ).rejects.toThrow(ValidationError);
    await expect(service.updateLink(ctx, LINK_A, {})).rejects.toThrow(
      /Tidak ada perubahan/,
    );
  });

  it("updates isActive and reports NotFound for foreign/missing links", async () => {
    const ok = setup();
    await ok.service.updateLink(ctx, LINK_A, { isActive: false });
    expect(ok.repository.updateLink).toHaveBeenCalledWith(
      { workspaceId: WS, linkId: LINK_A, data: { isActive: false } },
      ctx.actingUserId,
    );
    const missing = setup({ updateLink: vi.fn().mockResolvedValue(null) });
    await expect(
      missing.service.updateLink(ctx, LINK_A, { label: "x" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("delete reports NotFound when nothing was deleted", async () => {
    const { service } = setup({ deleteLink: vi.fn().mockResolvedValue(false) });
    await expect(service.deleteLink(ctx, LINK_A)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("reorderLinks", () => {
  it("passes a valid order to the repository", async () => {
    const { service, repository } = setup();
    await service.reorderLinks(ctx, [LINK_B, LINK_A]);
    expect(repository.reorderLinks).toHaveBeenCalledWith(
      { workspaceId: WS, orderedLinkIds: [LINK_B, LINK_A] },
      ctx.actingUserId,
    );
  });

  it("rejects duplicates, non-uuids, and non-arrays", async () => {
    const { service, repository } = setup();
    await expect(service.reorderLinks(ctx, [LINK_A, LINK_A])).rejects.toThrow(
      ValidationError,
    );
    await expect(service.reorderLinks(ctx, ["x"])).rejects.toThrow(
      ValidationError,
    );
    await expect(
      service.reorderLinks(ctx, "nope" as unknown as string[]),
    ).rejects.toThrow(ValidationError);
    expect(repository.reorderLinks).not.toHaveBeenCalled();
  });

  it("maps a stale/foreign set (repository false) to ConflictError", async () => {
    const { service } = setup({
      reorderLinks: vi.fn().mockResolvedValue(false),
    });
    await expect(service.reorderLinks(ctx, [LINK_A])).rejects.toThrow(
      ConflictError,
    );
  });
});
