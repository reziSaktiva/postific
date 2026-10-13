import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExternalServiceError, ValidationError } from "@/lib/utils/errors";

const { getSessionMock, redirectMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/better-auth/auth", () => ({
  auth: { api: { getSession: getSessionMock } },
}));

vi.mock("@/lib/repositories/identity", () => ({ identityRepository: {} }));
vi.mock("@/lib/adapters/avatar-storage", () => ({
  supabaseAvatarStorageAdapter: {},
}));

import { IdentityService } from "@/domains/identity";
import { updateProfileAction } from "./actions";

function profileForm(name = "Raka") {
  const formData = new FormData();
  formData.set("name", name);
  return formData;
}

describe("updateProfileAction", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    redirectMock.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("meneruskan pesan ValidationError ke form", async () => {
    vi.spyOn(IdentityService.prototype, "updateProfile").mockRejectedValue(
      new ValidationError("Nama wajib diisi."),
    );

    const result = await updateProfileAction(profileForm("   "));

    expect(result).toEqual({ ok: false, error: "Nama wajib diisi." });
  });

  it("menyembunyikan teks provider dari ExternalServiceError", async () => {
    vi.spyOn(IdentityService.prototype, "updateProfile").mockRejectedValue(
      new ExternalServiceError("Gagal upload avatar.", {
        cause: { message: "bucket not found" },
      }),
    );

    const result = await updateProfileAction(profileForm());

    expect(result).toEqual({
      ok: false,
      error: "Gagal menyimpan profil. Coba lagi.",
    });
    if ("error" in result) {
      expect(result.error).not.toContain("bucket not found");
    }
  });

  it("menyembunyikan error tak terduga di balik pesan generik", async () => {
    vi.spyOn(IdentityService.prototype, "updateProfile").mockRejectedValue(
      new Error("prisma exploded"),
    );

    const result = await updateProfileAction(profileForm());

    expect(result).toEqual({
      ok: false,
      error: "Gagal menyimpan profil. Coba lagi.",
    });
  });
});
